"""Reliable headless caller for Google's Antigravity CLI (`agy`).

Why this exists: `agy -p <prompt>` prints its answer to the terminal but does
NOT exit afterward (it keeps the process alive). It also gates output on
isatty(), so it must run inside a real pty. This wrapper:

  1. spawns `agy` inside a fresh ConPTY (pywinpty),
  2. reads with IDLE detection — once output has arrived and then goes quiet for
     `idle` seconds, we consider the answer complete and terminate the process,
  3. strips ANSI / TUI noise and returns clean text.

Usage:
    from agy_call import agy
    text = agy("your prompt", idle=4.0, hard_cap=240.0)
"""
from __future__ import annotations
import re, time, threading, os, sys
from winpty import PtyProcess

AGY_PATH = os.environ.get("AGY_PATH", r"C:\Users\jchox\AppData\Local\agy\bin\agy.exe")

_ANSI_CSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
_ANSI_OSC = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")
_ANSI_OTHER = re.compile(r"\x1b[@-Z\\-_]")
_SPINNER = set("⠁⠂⠄⡀⢀⠠⠐⠈⣾⣽⣻⢿⡿⣟⣯⣷⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏│─┌┐└┘├┤┬┴┼╭╮╰╯═║╔╗╚╝▌▐█▏▕")


def clean(raw: str) -> str:
    raw = _ANSI_OSC.sub("", raw)
    raw = _ANSI_CSI.sub("", raw)
    raw = _ANSI_OTHER.sub("", raw)
    raw = raw.replace("\r\n", "\n")
    lines = ["".join(seg for seg in ln.split("\r")[-1:]) for ln in raw.split("\n")]
    raw = "\n".join(lines)
    raw = "".join(ch for ch in raw if ch in "\n\t" or ord(ch) >= 0x20)
    out = []
    for ln in raw.split("\n"):
        s = "".join(c for c in ln if c not in _SPINNER).strip()
        if s:
            out.append(s)
    return "\n".join(out).strip()


def agy(prompt: str, idle: float = 4.0, hard_cap: float = 240.0,
        skip_permissions: bool = True, agy_path: str | None = None) -> str:
    if not prompt or not prompt.strip():
        raise ValueError("prompt must be non-empty")
    path = agy_path or AGY_PATH
    argv = [path]
    if skip_permissions:
        argv.append("--dangerously-skip-permissions")
    argv += ["-p", prompt]

    proc = PtyProcess.spawn(argv, dimensions=(50, 200))
    chunks: list[str] = []
    last_data = {"t": time.time()}
    got_data = {"v": False}
    stop = threading.Event()

    def reader():
        try:
            while not stop.is_set():
                data = proc.read(4096)
                if data:
                    chunks.append(data)
                    got_data["v"] = True
                    last_data["t"] = time.time()
                elif not proc.isalive():
                    break
        except EOFError:
            pass

    t = threading.Thread(target=reader, daemon=True)
    t.start()

    start = time.time()
    while True:
        if not proc.isalive():
            break
        now = time.time()
        if now - start > hard_cap:
            break
        if got_data["v"] and (now - last_data["t"]) > idle:
            break  # output went quiet -> answer complete
        time.sleep(0.2)

    stop.set()
    try:
        proc.terminate(force=True)
    except Exception:
        pass
    return clean("".join(chunks))


if __name__ == "__main__":
    p = " ".join(sys.argv[1:]) or "Reply with exactly: AGY_OK"
    t0 = time.time()
    print(agy(p))
    print(f"[elapsed {time.time()-t0:.1f}s]", file=sys.stderr)

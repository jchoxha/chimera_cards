import threading, time, sys
from winpty import PtyProcess

AGY = r"C:\Users\jchox\AppData\Local\agy\bin\agy.exe"
# Try with skip-permissions in case agy is blocking on a permission prompt.
argv = [AGY, "--dangerously-skip-permissions", "-p", "Reply with exactly: AGY_OK"]
TIMEOUT = 35.0

proc = PtyProcess.spawn(argv, dimensions=(50, 200))
chunks = []

def reader():
    try:
        while True:
            data = proc.read(4096)
            if data:
                chunks.append(data)
            elif not proc.isalive():
                break
    except EOFError:
        pass

t = threading.Thread(target=reader, daemon=True)
t.start()
t.join(TIMEOUT)
timed_out = t.is_alive()
try:
    proc.terminate(force=True)
except Exception:
    pass

raw = "".join(chunks)
print("=== timed_out:", timed_out, "raw_len:", len(raw))
print("=== RAW REPR ===")
print(repr(raw[:4000]))
print("=== RAW RENDERED ===")
print(raw[:4000])

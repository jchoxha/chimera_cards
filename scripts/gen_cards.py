"""Generate Variant-B ability art for every card via the agy pipeline.
Reads each card's `artPrompt` from src/data/cards/*.json, appends the locked
style block, and saves PNGs to public/art/gen/cards/<id>.png. Then add the
generated ids to src/data/cardGenArt.json so the UI prefers them.
See docs/art-pipeline.md.  Usage:
  python scripts/gen_cards.py                 # all cards missing art
  python scripts/gen_cards.py warrior_strike  # just these ids
  python scripts/gen_cards.py --force         # regenerate everything
"""
import os, sys, json, glob, time
sys.path.insert(0, os.path.dirname(__file__))
from agy_call import agy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS_DIR = os.path.join(ROOT, "src", "data", "cards")
OUT = os.path.join(ROOT, "public", "art", "gen", "cards")
MANIFEST = os.path.join(ROOT, "src", "data", "cardGenArt.json")
os.makedirs(OUT, exist_ok=True)

STYLE = ("Flat 2D hand-drawn cartoon illustration in the spirit of Adventure Time / Pendleton Ward: "
         "simple bold shapes, thick confident black outlines, flat matte color fills, minimal shading, "
         "genuinely charming and characterful. BUT with the dramatic seriousness of Yu-Gi-Oh trading-card "
         "art: an intense, dynamic action, moody dramatic lighting, an epic elemental backdrop. "
         "Absolutely NOT Disney, NOT Pixar, NOT 3D, NOT glossy, NOT soft, NOT overly cute. Centered subject "
         "filling the frame. No text, no card frame, no border, no UI — only the illustration. Square 1:1.")


def load_cards():
    cards = []
    for f in sorted(glob.glob(os.path.join(CARDS_DIR, "*.json"))):
        data = json.load(open(f, encoding="utf-8"))
        cards.extend(data if isinstance(data, list) else data.get("cards", []))
    return cards


def load_manifest():
    try:
        return set(json.load(open(MANIFEST, encoding="utf-8")))
    except Exception:
        return set()


def save_manifest(ids):
    json.dump(sorted(ids), open(MANIFEST, "w", encoding="utf-8"), indent=0)


def generate(args):
    force = "--force" in args
    only = [a for a in args if not a.startswith("--")]
    done = load_manifest()
    cards = load_cards()
    todo = []
    for c in cards:
        cid = c.get("id")
        if not cid:
            continue
        if only and cid not in only:
            continue
        if not only and not force and cid in done:
            continue
        todo.append(c)

    t0 = time.time()
    for i, c in enumerate(todo, 1):
        cid = c["id"]
        scene = c.get("artPrompt") or f'"{c.get("name", cid)}"'
        path = os.path.join(OUT, f"{cid}.png").replace("\\", "/")
        prompt = (f"generate the following image and save it as a PNG file at this exact path: {path}\n\n"
                  f"Fantasy ability-card art depicting {scene}\n\nStyle: {STYLE}")
        print(f"[{i}/{len(todo)}] {cid} ...", flush=True)
        agy(prompt, idle=45.0, hard_cap=240.0)
        if os.path.exists(path):
            done.add(cid)
            save_manifest(done)   # persist incrementally so a crash keeps progress
            print("  ok", flush=True)
        else:
            print("  MISSING", flush=True)
    print(f"=== done in {time.time()-t0:.0f}s — {len(done)} cards have art ===", flush=True)


if __name__ == "__main__":
    generate(sys.argv[1:])

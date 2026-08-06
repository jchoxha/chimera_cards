"""Bake the creature PART sprites for the Cassette-Beasts-style rig.

    python3 scripts/gen_parts.py --list
    python3 scripts/gen_parts.py wings tail claws          # bake specific parts
    python3 scripts/gen_parts.py --all                     # bake everything missing

WHY THIS IS ITS OWN SCRIPT (and not just gen_roster with a different prompt):
generating parts independently is a COHERENCE problem, not a prompting problem.
Thirty-eight parts drawn in thirty-eight separate calls will not share a palette,
a light direction, or a line weight, and the composite looks like a ransom note.
Three things fix that here:

  1. SHEET GENERATION — one request per part produces a GRID of variants of that
     part. Everything inside a single image is stylistically consistent by
     construction, so you pick the best cell and the neighbours still match.
  2. ONE SHARED STYLE — the Variant-B block is imported from gen_roster.py, never
     retyped, so parts and full-creature art speak the same visual language.
  3. FLAT CHROMA KEY + the existing cutout — parts must be background-free to
     composite, so they are drawn on magenta and keyed out by sprite_cutout.py
     (already proven on the HD-2D environment sprites).

ANCHORS come for free: after autocrop the sprite is tight to its own bounds, and
the rig's pivot is expressed in those normalised bounds — so a wing cut from any
sheet lands correctly without hand-measuring.

Provider is Pollinations (free, no API key — same as the in-game art path), so
this runs anywhere with a network connection and nothing to configure.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, "public", "art", "parts")
MANIFEST = os.path.join(ROOT, "src", "data", "partsBaked.json")

def _shared_style():
    """The Variant-B style block, read out of gen_roster.py as TEXT.

    Deliberately not `from gen_roster import STYLE`: that module pulls in the
    Windows-only agy bridge, which would make this script unrunnable anywhere
    else. Parsing the literal keeps the single-source-of-truth guarantee without
    the dependency. (src/data/artStyle.js holds the same text for the JS side,
    and npm run test:artprompt asserts the two match.)
    """
    import ast
    src = open(os.path.join(HERE, "gen_roster.py")).read()
    start = src.index("STYLE = (") + len("STYLE = ")
    depth, i = 0, start
    while i < len(src):
        if src[i] == "(":
            depth += 1
        elif src[i] == ")":
            depth -= 1
            if depth == 0:
                break
        i += 1
    return ast.literal_eval(src[start:i + 1])


STYLE = _shared_style()

# ── what each part should look like, in isolation ──────────────────────────────
# Keys MUST match the `id`s in src/data/partsRig.js. The phrasing describes ONE
# part, alone, in a fixed orientation — the rig handles placement and mirroring,
# so parts must never be drawn attached to a creature.
PART_SUBJECT = {
    # bodies — headless torsos; the rig always adds a head on top
    "body-humanoid": "a HEADLESS humanoid torso with arms, standing, facing the viewer, NO head and NO neck",
    "body-beast": "a HEADLESS four-legged beast body seen from the side, facing left, NO head and NO neck",
    "body-aberration": "a HEADLESS amorphous eldritch body, bulbous and tapering, NO head",
    # heads — always facing left so they seat consistently on a body
    "head-humanoid": "a single humanoid head in profile facing left, no neck, no body",
    "head-beast": "a single snouted beast head in profile facing left, no neck, no body",
    "head-aberration": "a single bulbous eldritch head with several eyes, facing left, no neck",
    "head-draconic": "a single horned dragon head in profile facing left, no neck, no body",
    "head-avian": "a single sharp-beaked bird head in profile facing left, no neck",
    # attachments — one part, isolated, in the rig's default orientation
    "wings": "a single outspread wing, side view, pointing RIGHT, detached, just the one wing",
    "tail": "a single long tapering tail, curving, detached, horizontal",
    "claws": "a single curved claw / talon, pointing DOWN, detached",
    "horns": "a single curved horn, pointing UP, detached",
    "teeth": "a pair of sharp pointed fangs, detached, pointing down",
    "maw": "a gaping open mouth full of teeth, front view, detached",
    "eye": "a cluster of three staring eyeballs, detached",
    "beak": "a single sharp hooked beak, pointing LEFT, detached",
    "quills": "a row of sharp upright quills / spines, detached",
    "shell": "a domed turtle-like shell carapace, front view, detached",
    "carapace": "a segmented insect carapace plate, front view, detached",
    "tentacle": "a single writhing tentacle, pointing DOWN, detached",
    "pseudopod": "a single blobby ooze pseudopod limb, pointing DOWN, detached",
    "roots": "a bundle of gnarled roots spreading downward, detached",
    "spore": "a scattering of floating round spore puffs",
    "miasma": "a soft cloud of drifting toxic miasma vapour",
    "shard": "a single sharp crystal shard, pointing UP, detached",
    "mandible": "a pair of curved insect mandibles / pincers, detached",
    "cilia": "a row of fine waving cilia hairs, detached",
    "membrane": "a single translucent webbed membrane fin, pointing RIGHT, detached",
    "ichor": "several thick dripping droplets of glowing ichor",
    "venom": "several dripping droplets of venom",
    "hide": "a patch of thick armoured animal hide plating, front view",
    "hooves": "a single hoof, pointing DOWN, detached",
    "roar": "a wide roaring open maw, front view, detached",
    "breath": "a cone of elemental breath billowing to the LEFT",
    # weapons — upright, gripped end at the bottom
    "w-sword": "a single sword, blade pointing UP, vertical, detached",
    "w-axe": "a single battle axe, head at the top, vertical, detached",
    "w-hammer": "a single great warhammer, head at the top, vertical, detached",
    "w-mace": "a single spiked mace, head at the top, vertical, detached",
    "w-spear": "a single spear, point UP, vertical, detached",
    "w-staff": "a single wizard staff with a glowing orb on top, vertical, detached",
    "w-wand": "a single short magic wand, vertical, detached",
    "w-dagger": "a single dagger, blade pointing UP, vertical, detached",
    "w-bow": "a single longbow, strung, vertical, detached",
    "w-crossbow": "a single crossbow, front view, detached",
    "w-shield": "a single round shield, front view, detached",
    "w-fist": "a single clenched armoured gauntlet fist, detached",
}

# The clauses that make a sheet cuttable + keyable. This is the whole trick.
SHEET = (
    "A reference SHEET of {n} DIFFERENT design variations of the SAME subject, "
    "arranged in a neat {cols}x{rows} grid, evenly spaced, each variation fully "
    "separate from the others and not touching or overlapping. "
    "Each variation is the SAME kind of object drawn in a different style. "
    "Plain flat SOLID BRIGHT MAGENTA (RGB 255,0,255) background everywhere, "
    "including BETWEEN the items and around every edge — the magenta must be a "
    "single uniform colour with no gradient, no shadow, no vignette, no texture. "
    "The object is a single isolated element on that magenta: NO ground, NO scene, "
    "NO creature attached, NO text, NO labels, NO grid lines, NO borders."
)


def prompt_for(part_id, cols=3, rows=2):
    subject = PART_SUBJECT[part_id]
    sheet = SHEET.format(n=cols * rows, cols=cols, rows=rows)
    return f"Subject: {subject}.\n\n{sheet}\n\nStyle: {STYLE}"


def pollinations_url(prompt, width=1024, height=768, seed=0):
    q = urllib.parse.urlencode({
        "width": width, "height": height, "seed": seed,
        "model": "flux", "nologo": "true", "private": "true",
    })
    return f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}?{q}"


def bake(part_id, cols, rows, seed, timeout=180):
    os.makedirs(OUT_DIR, exist_ok=True)
    sheet_path = os.path.join(OUT_DIR, f"_sheet-{part_id}.png")
    url = pollinations_url(prompt_for(part_id, cols, rows), seed=seed)
    print(f"  → requesting sheet for {part_id} …")
    with urllib.request.urlopen(url, timeout=timeout) as r:
        data = r.read()
    with open(sheet_path, "wb") as f:
        f.write(data)
    print(f"    saved {sheet_path} ({len(data)//1024} KB)")
    print(f"    now cut a cell you like:\n"
          f"      python3 scripts/sprite_cutout.py {sheet_path} "
          f"{os.path.join(OUT_DIR, part_id + '.png')} --size 512\n"
          f"    (crop the chosen cell first — the cutout keys out the magenta and autocrops)")
    return sheet_path


def rig_part_ids():
    """Read the part ids straight out of the rig so the two can't drift."""
    src = open(os.path.join(ROOT, "src", "data", "partsRig.js")).read()
    import re
    return re.findall(r"\{ id: '([\w-]+)'", src)


def main():
    ap = argparse.ArgumentParser(description="Bake creature part sprites.")
    ap.add_argument("parts", nargs="*", help="part ids (see --list)")
    ap.add_argument("--all", action="store_true", help="bake every part not yet in the manifest")
    ap.add_argument("--list", action="store_true", help="list part ids and their bake status")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--rows", type=int, default=2)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    rig_ids = rig_part_ids()
    baked = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}

    missing_prompt = [p for p in rig_ids if p not in PART_SUBJECT]
    if missing_prompt:
        print(f"⚠ rig parts with no prompt yet: {', '.join(missing_prompt)}\n")

    if a.list:
        print(f"{len(rig_ids)} parts in the rig · {len(baked)} baked\n")
        for p in rig_ids:
            mark = "✓ baked" if p in baked else ("· ready" if p in PART_SUBJECT else "✗ no prompt")
            print(f"  {mark:10} {p}")
        return

    targets = a.parts or ([p for p in rig_ids if p not in baked and p in PART_SUBJECT] if a.all else [])
    if not targets:
        ap.print_help()
        return

    for p in targets:
        if p not in PART_SUBJECT:
            print(f"  ✗ {p}: no prompt defined, skipping")
            continue
        try:
            bake(p, a.cols, a.rows, a.seed)
        except Exception as e:                                  # noqa: BLE001
            print(f"  ✗ {p}: {e}")

    print(f"\nWhen a part is cut to {OUT_DIR}/<id>.png, register it:")
    print(f'  {MANIFEST}  →  {{ "wings": "art/parts/wings.png" }}')
    print("The rig picks baked art over the procedural shape automatically.")


if __name__ == "__main__":
    main()

"""Generate Variant-B portraits for the demo roster via the agy pipeline.
Saves PNGs to public/art/gen/<id>.png. See docs/art-pipeline.md."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from agy_call import agy

OUT = r"C:/Projects/Experiments/chimera_cards/public/art/gen"
os.makedirs(OUT, exist_ok=True)

STYLE = ("Flat 2D hand-drawn cartoon illustration in the spirit of Adventure Time / Pendleton Ward: "
         "simple bold shapes, thick confident black outlines, flat matte color fills, minimal shading, "
         "genuinely charming and characterful. BUT with the dramatic seriousness of Yu-Gi-Oh trading-card "
         "monster art: a dynamic heroic pose, moody dramatic lighting, an epic elemental backdrop. "
         "Absolutely NOT Disney, NOT Pixar, NOT 3D, NOT glossy, NOT soft, NOT overly cute. Single creature, "
         "centered, filling the frame. No text, no card frame, no border, no UI, no humans unless described "
         "— only the creature illustration. Square 1:1 composition.")

CREATURES = [
    ("ironhide",   "a colossal armored brute — a mountain of muscle and iron plating, hefting a massive warhammer, immovable and grim"),
    ("voltfang",   "a feral wolf-beast crackling with electricity, blue lightning arcing off its bristling fur, snarling mid-pounce"),
    ("nightveil",  "a lithe hooded assassin wreathed in living shadow, twin curved daggers, faintly glowing eyes in the dark"),
    ("emberwisp",  "a small living flame elemental — a floating wisp of fire with a bright molten core, trailing embers"),
    ("frostmind",  "a frost sorcerer in jagged icy robes, conjuring sharp shards of blue ice, frozen breath, cold and composed"),
    ("grimsoul",   "an undead lich warlock in tattered dark robes, a skull face with glowing violet eyes, shadow energy swirling"),
    ("dawnkeeper", "a radiant holy guardian in golden robes, a halo of warm light, raising a glowing holy staff"),
    ("thornroot",  "a beast-spirit shaman covered in thorny vines and broad leaves, branching antlers, rooted and wild"),
    ("tidecaller", "a water elemental shaman whose body is swirling translucent water, summoning a curling wave"),
    ("wildeye",    "a feral cat-like beast ranger drawing a longbow, half-camouflaged among jungle foliage, sharp focused eyes"),
    ("cogwright",  "a sturdy engineer construct built of carved stone blocks and brass gears, steam venting, blocky and tough"),
    ("maw",        "an eldritch void horror — writhing dark tentacles and too many glowing eyes, warped purple space behind it"),
]

t0 = time.time()
for i, (cid, subject) in enumerate(CREATURES, 1):
    path = f"{OUT}/{cid}.png"
    prompt = (f"generate the following image and save it as a PNG file at this exact path: {path}\n\n"
              f"Subject: {subject}.\n\nStyle: {STYLE}")
    print(f"[{i}/{len(CREATURES)}] {cid} ...", flush=True)
    out = agy(prompt, idle=45.0, hard_cap=240.0)
    print(("  ok" if os.path.exists(path) else "  MISSING") + f"  ({out[:80]!r})", flush=True)
print(f"=== roster art done in {time.time()-t0:.0f}s ===", flush=True)

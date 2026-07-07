"""Generate Variant-B portraits for the demo roster via the agy pipeline.
Saves PNGs to public/art/gen/<id>.png (base = 'regular' size). With per-size
generation on, each form also gets public/art/gen/<id>-<form>.png so sizes are
DRAWN differently rather than one image rescaled. See docs/art-pipeline.md.

After a per-size run, add the generated forms to src/data/creatureArtSizes.json
(the run prints a ready-to-paste snippet) so the game swaps to them."""
import os, sys, time, json
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

# Per-form phrasing — MUST stay in sync with src/data/sizeArt.js FORM_ART_DESC so
# the picture matches the size word/badge the game shows. 'regular' → base <id>.png.
SIZE_DESC = {
    "baby": "Depict this creature as a tiny, adorable JUVENILE: soft rounded proportions, an oversized head and eyes, small and unthreatening — a baby version.",
    "small": "Depict this creature as a SMALL, young specimen: lean and compact, not yet grown into its full size.",
    "regular": "Depict this creature at its typical ADULT size: balanced, characteristic proportions.",
    "large": "Depict this creature as an unusually LARGE, powerful adult: heavier build, thicker limbs, an imposing presence.",
    "elite": "Depict this creature as a battle-hardened ELITE: scarred and ornamented, bristling with menacing extra detail.",
    "boss": "Depict this creature as a COLOSSAL, towering BOSS: monstrous in scale, elaborate and terrifying, dominating the frame.",
}
ALL_FORMS = ["baby", "small", "regular", "large", "elite", "boss"]

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


def _path(cid, form):
    return f"{OUT}/{cid}.png" if form == "regular" else f"{OUT}/{cid}-{form}.png"


def generate(only=None, forms=("regular",)):
    """Generate roster portraits. `only` = optional list of ids; `forms` = which
    sizes to draw (default just 'regular' = the base file). Guarded under __main__
    so importing STYLE/OUT/CREATURES never triggers the batch."""
    t0 = time.time()
    todo = [c for c in CREATURES if (not only or c[0] in only)]
    made = {}
    jobs = [(cid, subj, form) for (cid, subj) in todo for form in forms]
    for i, (cid, subject, form) in enumerate(jobs, 1):
        path = _path(cid, form)
        prompt = (f"generate the following image and save it as a PNG file at this exact path: {path}\n\n"
                  f"Subject: {subject}.\n\n{SIZE_DESC.get(form, '')}\n\nStyle: {STYLE}")
        print(f"[{i}/{len(jobs)}] {cid} ({form}) ...", flush=True)
        out = agy(prompt, idle=45.0, hard_cap=240.0)
        ok = os.path.exists(path)
        print(("  ok" if ok else "  MISSING") + f"  ({out[:80]!r})", flush=True)
        if ok and form != "regular":
            made.setdefault(cid, []).append(form)
    if made:
        print("\nAdd these to src/data/creatureArtSizes.json:", flush=True)
        print(json.dumps(made, indent=2), flush=True)
    print(f"=== done in {time.time()-t0:.0f}s ===", flush=True)


if __name__ == "__main__":
    # Flags: --sizes / --all-sizes generates every form; --form=baby,boss picks some.
    args = [a for a in sys.argv[1:]]
    forms = ("regular",)
    if "--sizes" in args or "--all-sizes" in args:
        forms = tuple(ALL_FORMS); args = [a for a in args if a not in ("--sizes", "--all-sizes")]
    picked = next((a for a in args if a.startswith("--form=")), None)
    if picked:
        forms = tuple(f for f in picked.split("=", 1)[1].split(",") if f in ALL_FORMS)
        args = [a for a in args if a != picked]
    # remaining positionals = creature ids to (re)generate
    generate(args or None, forms)

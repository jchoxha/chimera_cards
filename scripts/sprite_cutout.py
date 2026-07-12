"""Turn an AGY-generated JPEG (magenta chroma-key background) into a clean,
backgroundless RGBA PNG sprite for the HD-2D combat scene.

AGY returns JPEG (no alpha), so environment sprites are generated on a flat
bright-magenta backdrop and keyed out here. Usage:

    python3 scripts/sprite_cutout.py in.jpg public/art/sprites/tree-oak.png [--size 640]

Pipeline: magenta -> alpha, despill the magenta fringe left by JPEG edges,
autocrop to the sprite bounds (+small transparent pad), optional downscale.
"""
import sys
from PIL import Image


def cutout(src, dst, max_size=640, pad=12):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size

    # Magenta key: background = high R, high B, low G.
    # score = min(R,B) - G  ->  ~255 for pure magenta, <=0 for foliage/trunk/outline.
    KEY = 90        # score above this = definitely background
    SOFT = 45       # score in [SOFT, KEY] = edge -> partial alpha + despill
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            score = min(r, b) - g
            if score >= KEY:
                px[x, y] = (r, g, b, 0)
            elif score >= SOFT:
                # feather edge alpha and despill: pull G up toward min(R,B)
                t = (score - SOFT) / (KEY - SOFT)      # 0..1, 1 = more background
                alpha = int(255 * (1 - t))
                ng = int(g + (min(r, b) - g) * t)      # reduce magenta cast
                px[x, y] = (min(r, ng + 40), ng, min(b, ng + 40), alpha)

    # Autocrop to non-transparent bounds, then pad with transparency.
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
        w, h = im.size
        padded = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
        padded.paste(im, (pad, pad))
        im = padded

    # Downscale (never upscale) so the longest side <= max_size.
    if max(im.size) > max_size:
        scale = max_size / max(im.size)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)

    im.save(dst)
    print(f"wrote {dst}  {im.size}  ({im.width}x{im.height} RGBA)")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    size = 640
    for a in sys.argv[1:]:
        if a.startswith("--size"):
            size = int(a.split("=", 1)[1]) if "=" in a else int(sys.argv[sys.argv.index(a) + 1])
    cutout(args[0], args[1], max_size=size)

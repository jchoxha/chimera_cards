"""Decode a saved get_image_base64 tool-result (JSON {result: b64-jpeg}) and run
the chroma-key cutout in one step.

    python3 scripts/decode_and_cut.py <result.txt> public/art/sprites/<name>.png [--size 640]
"""
import sys, json, base64, os, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from sprite_cutout import cutout

src_json, dst = sys.argv[1], sys.argv[2]
size = 640
for a in sys.argv[3:]:
    if a.startswith("--size"):
        size = int(a.split("=", 1)[1])
raw = base64.b64decode(json.load(open(src_json))["result"])
tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
tmp.write(raw); tmp.close()
cutout(tmp.name, dst, max_size=size)
os.unlink(tmp.name)

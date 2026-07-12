# HD-2D billboard sprites (environment)

Backgroundless 2D sprites (trees first) placed into the **combat-v2 3D** WebGL board
(`src/ui/battle/Board3D.jsx`) as camera-facing **billboards**. The flat art + the
receding 3D table + parallax between near/far sprites gives the "2D HD, sort-of-3D"
(Octopath / Paper Mario) look. Started 2026-07-12.

## What ships

- **Sprites:** `public/art/sprites/<id>.png` — transparent RGBA PNGs, auto-cropped,
  longest side ≤ 640px. Trees are `tree-<name>` (e.g. `tree-oak`, `tree-pine`).
- **Manifest:** `src/data/sprites.json` — `{ id, file, kind, w, h, aspect, anchor }`
  per sprite. `w/h` are the natural pixels; `anchor:"bottom"` means the billboard
  pivots at the base (the trunk sits on the ground plane). Regenerate with
  `python3 scripts/gen_sprite_manifest.py` after baking new sprites.

## Generation pipeline (proven in-session via the AGY MCP)

AGY returns **JPEG (no alpha)**, so we generate on a flat chroma-key background and
cut it out:

1. `generate_image` with the tree prompt — the key clause is a *flat uniform SOLID
   bright magenta (RGB 255,0,255) chroma-key backdrop, clear margin on all sides, the
   tree must not touch any edge*, plus the game's Adventure-Time flat-2D style block.
2. Poll `get_image_base64` → save the JSON result file.
3. `python3 scripts/decode_and_cut.py <result.json> public/art/sprites/tree-<name>.png`
   — decodes the JPEG and runs `scripts/sprite_cutout.py`: magenta→alpha (score =
   `min(R,B) − G`, with an edge feather + despill so JPEG fringing doesn't leave a pink
   halo), autocrop, downscale. Verified: transparent corners, zero residual magenta.
4. `python3 scripts/gen_sprite_manifest.py` to refresh `sprites.json`.

## Wiring into the board (for the combat-v2 session)

The sprites are drop-in for r3f. A minimal camera-facing billboard, anchored at the
base, sized to the sprite's true aspect (import `sprites.json`, `useTexture` the
`file` under Vite `BASE`):

```jsx
import { useTexture, Billboard } from '@react-three/drei';
import SPRITES from '../../data/sprites.json';
const BASE = import.meta.env.BASE_URL;

function TreeBillboard({ id, position, height = 3 }) {
  const s = SPRITES.sprites.find(e => e.id === id);
  const tex = useTexture(BASE + s.file);
  const w = height * s.aspect;
  // anchor at the base: lift the plane so its bottom sits at position.y
  return (
    <Billboard position={[position[0], position[1] + height / 2, position[2]]}
               follow lockX lockZ>{/* lockX/lockZ = yaw-only, stays upright */}
      <mesh>
        <planeGeometry args={[w, height]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}
```

Notes: `alphaTest` avoids transparent-sort artifacts against other transparent meshes
(cards); `lockX/lockZ` keeps trees vertical while yawing to the camera; scatter several
at different Z for parallax depth. `drei` is already a dep of the board.

## Backlog

- More tree variety + biome sets (temperate / evergreen / dead-shadow / tropical /
  fungal-aberration) once the starter set's look is locked with Jeton.
- Other environment sprites (rocks, bushes, stumps, ground clutter) via the same loop.

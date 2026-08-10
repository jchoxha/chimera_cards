# Local part baking — free creature sprites on the Strix Halo iGPU

Replaces the paid Retro Diffusion bake (`scripts/bake_parts_rd.mjs`) with an
unlimited local one (`scripts/bake_parts_local.mjs`) that talks to a ComfyUI on
`127.0.0.1:8188`. Same CLI, same output contract, no API key, no per-image cost.

```bash
node scripts/bake_parts_local.mjs --probe          # body-beast + head-beast
node scripts/bake_parts_local.mjs --bodies         # the three bodies
node scripts/bake_parts_local.mjs wings tail claws # named parts
node scripts/bake_parts_local.mjs                  # everything in partsRig.js
```

Useful flags: `--keep-raw` (stash the 1024px renders in a temp dir so the cutout
can be re-tuned with no GPU cost), `--no-ref` (disable reference locking),
`--key-hard/--key-soft` (cutout thresholds), `--retries`, `--seed`, `--steps`.

## The backend, and why it is not Vulkan

The plan called for a Vulkan backend because ROCm on Strix Halo is known to hang.
That advice is real but dated: **ROCm 7.2.1 for Windows supports gfx1151
natively**, and it was already installed here as a ComfyUI Desktop standalone. It
was measured before being trusted, and it holds up — so it is what we use.
stable-diffusion.cpp + Vulkan remains the documented fallback if a driver update
regresses this.

| | |
|---|---|
| Machine | ASUS ROG Flow Z13 (2025), Ryzen AI Max+ 395, Radeon 8060S, 64 GB unified |
| Arch | `gfx1151` — detected natively, **no `HSA_OVERRIDE_GFX_VERSION` needed** |
| Runtime | ComfyUI v0.20.1 standalone · Python 3.12.12 · torch 2.9.1+rocm7.2.1 |
| VRAM | 37.6 GB exposed to torch out of the 64 GB unified pool |
| Attention | "pytorch attention" (see gotcha 3) |

Measured on the iGPU before committing to it:

* fp16 matmul 4096³ — **7.1 TFLOPS**
* conv2d 320ch@128² — **1.2 ms/iter warm**
* SDPA 4096 tokens — runs, no hang

## Model + settings

| | |
|---|---|
| Checkpoint | `sd_xl_base_1.0.safetensors` (6.94 GB) |
| LoRA | `nerijs/pixel-art-xl` @ **1.0** — "pixel art" must also appear in the prompt |
| Reference lock | `ip-adapter_sdxl_vit-h` + `CLIP-ViT-H-14` @ **0.35**, `weight_type: style transfer` |
| Sampler | `dpmpp_2m` / `karras`, **28 steps**, **CFG 7**, seed **12345** (stable → reproducible re-bakes) |
| Canvas | 1024² generated, cut down to ≤256² |

**~40 s per image** steady state (first image 46.7 s cold, including model load).
A full 46-part bake is ≈30 minutes and costs nothing. Models live in the shared
store at `C:\Users\jchox\ComfyUI-Shared\models` via `extra_model_paths.yaml`.

## How the three cloud-only features were replaced

| Retro Diffusion | Local equivalent |
|---|---|
| `reference_images` | IP-Adapter pass over the already-baked body sprite |
| `remove_bg` | generate on a flat backdrop, then a border flood-fill cutout |
| `check_cost` | nothing to price — local generation is free; only wall-clock is reported |

### Reference locking is two-tier

Taken literally, "each part references the relevant body" would give **three
style islands**, because the three bodies are generated independently. So:

1. the **first body baked is the style anchor** — it references nothing, it *is*
   the house style — and the other two bodies reference it, pulling all three
   onto one palette;
2. a **head prefers its own body type** (`head-beast` → `body-beast`) when that
   body exists; every other attachment falls back to the anchor.

Bodies already on disk seed the reference pool, so re-baking one head still
matches the committed body without regenerating it.

> **Ordering hazard:** bodies define the style and are *not* themselves
> reference-locked, so **re-baking a body invalidates every head baked against
> it**. Re-bake bodies and heads together, or not at all.

## Prompt engineering — what actually mattered

These were all found by probing, and each one produced a visibly broken sprite
before it was fixed.

1. **Subject first.** SDXL's encoder works in 77-token chunks and the first chunk
   dominates. A first draft that led with the style block pushed the subject into
   a later chunk and returned *two near-identical full-body ogres* for
   `body-beast` **and** `head-beast`.
2. **Negations do not work in a positive prompt.** "a HEADLESS torso, NO head"
   reliably renders a head. `negationsFrom()` lifts `no X` / `HEADLESS` /
   `detached` out of `PART_SUBJECT` mechanically and re-files them in the
   negative prompt — so `src/data/partSubjects.js` stays the single source of
   truth instead of being forked.
3. **Do not name a saturated backdrop colour.** Asking for magenta (the classic
   chroma-key colour, and what the old AGY pipeline used) bled the colour into
   the subject: a magenta lion on a magenta field, the worst possible case for
   keying. Plain white is safe here because the style lock mandates a bold dark
   outline, which is what actually stops the cutout flood.
4. **"wide shot / zoomed out" backfires on a part.** It reads as *show the whole
   animal* and turned `head-beast` into a full-body creature. Isolation belongs
   in the positive prompt; zoom belongs in the negative (`close-up`, `filling the
   frame`).
5. **Clipping is unrecoverable, so reroll instead.** A part touching the canvas
   edge stamps into the rig with a sawn-off side. `assessCut().touchesEdge`
   triggers a seed reroll (`--retries`, default 2).
6. **"Isolated single object" + "16-bit sprite" reads as ICON.** A large slice of
   the first full batch came back as a subject inside a rounded-rect card border.
   `border, frame` was already in the negative and lost; it needed weighting
   (`(border:1.5)`) plus the whole UI-asset family named explicitly (card, icon,
   badge, sticker, button, inventory slot), and the positive clause reworded from
   "empty margin on all sides" to "floating alone on an empty background".
7. **The model completes a fragment into the whole organism.** `beak` returned an
   entire bird, `roots` an entire tree, `w-hammer` a whole armoured warrior
   holding one. Countered with negatives keyed off `detached` in the subject
   text, plus a weapons-only clause; see Known limitations for the residue.
8. **Scope a negative to the part it is for — a global one can wreck the palette.**
   The single most damaging change of this build was adding `tree, plant` to the
   *base* negative to stop `roots` drawing a whole tree. Suppressing those tokens
   drains green from everything, and the locked sage-green house style drifted to
   brown-and-white **across all 46 parts at once**. (It was also self-contradictory:
   `roots` genuinely *is* part of a plant.) Part-specific negatives now attach
   per-part — `WEAPON_NEG` for `w-*`, the `detached` set for fragments — and the
   base negative holds only things true of every part.

> **The style anchor is load-bearing.** Everything IP-Adapters off the first body,
> so *any* prompt edit that changes `body-beast` re-styles the whole set. Judge a
> prompt change by re-baking `--bodies` and looking at the anchor **before**
> spending 40 minutes on a full pass. Note that baking one body alone does not
> test this — the other two, still on disk, seed the reference and mask the change.

## Quality gates

Two automatic checks trigger a seed reroll, because neither defect can be
repaired after the fact:

| gate | catches |
|---|---|
| `assessCut().touchesEdge` | subject clipped by the canvas — pixels are gone |
| `borderRing() > --max-ring` (0.45) | the framed-icon artifact |

`borderRing()` traces a rectangle just inside the sprite's bounds and reports how
much of it is opaque. **Coverage does not separate these** — a thin frame around a
small subject scores low on coverage — but the ring does, and the two populations
measured over a real batch are far apart:

```
framed   0.66 … 0.92   head-humanoid, breath, w-sword, w-dagger, carapace, cilia
organic  0.00 … 0.30   bodies, heads, most weapons
```

Neither gate catches a *wrong subject* (a beak rendered as a whole bird is
geometrically perfect), so a batch still wants a human look. `contact_sheet`-style
review over `public/art/parts/` is the fast way to do it.

## The cutout

Magenta chroma-keying was rejected in favour of a **border flood fill**. The part
list contains subjects that are legitimately magenta-adjacent — `tentacle`,
`miasma`, `ichor`, `shard`, anything Void-attuned — and a per-pixel colour key
punches holes straight through them. The backdrop's real defining property is
topological: it is the flat region *connected to the border*. Flooding inward
keeps every enclosed pixel safe at any hue, and makes the key colour-agnostic.

Thresholds come from a measured histogram of a body render's bottom strip, not
from eyeballing:

```
 ~20   backdrop         (178k px)
~160   cast shadow      ( 17k px)   <- survives the negative prompt every time
~240+  the sprite       (outline, then body)
```

There is a clean empty gap between 175 and 240, so the cut sits at
`--key-hard 185 / --key-soft 220`. Earlier values of 110/155 stopped the flood
*below* the shadow, which is why it kept surviving as a grey ghost.

Crop bounds and the quality read come from the repo's own `src/lab/cutout.js`
(`alphaBounds`, `assessCut`), so a sprite baked here and one cut in the browser
Parts Studio stay interchangeable. `--key magenta` reproduces the browser's exact
per-pixel algorithm if that is ever needed.

PNG encode/decode is `scripts/png.mjs` — a ~150-line codec on `node:zlib`, so the
bake tool adds **no dependency** to `package.json`, matching the RD script.

## Strix Halo gotchas

1. **MIOpen's first-run autotune looks like the hang you were warned about.**
   Cold conv2d measured **600 ms/iter**; warm, **1.2 ms/iter** — a 500× swing.
   The first generation of a session is slow, every one after is not. Do not
   diagnose this as a GPU hang and go rebuild on Vulkan.
2. **`[WARNING] failed to run offload-arch: binary not found` is benign.** It
   prints on every torch import and means nothing here.
3. **Flash / mem-efficient SDPA are experimental on ROCm** and silently disabled
   (`TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1` to force them). ComfyUI falls back
   to "pytorch attention", which is fine at SDXL sizes.
4. **ComfyUI sets `torch.backends.cudnn.enabled = False`** for AMD, by design.
5. **Unified memory is a real advantage.** 37.6 GB of VRAM means SDXL + a LoRA +
   IP-Adapter + CLIP-ViT-H coexist with room to spare — no offload thrash, which
   is normally what makes an 8 GB discrete card slower than this iGPU here.
6. Native ROCm on Windows needs **Python 3.12** (AMD's universal `rocm-sdk`
   wheels), which is why the standalone env is pinned to 3.12.12.

## Known limitations

* **Bodies come back with a head**, though `PART_SUBJECT` asks for a headless
  torso. Three escalating attempts failed — a plain negative, a weighted
  `(head:1.8)` negative, and a positive clause describing a cut neck stump (which
  also dragged the palette off-style). SDXL treats a head as obligatory on a
  quadruped. **The paid RD reference has exactly the same trait** — the
  previously shipped `body-beast.png` is a full beast with a head — so this is a
  property of the model class, not of going local. The rig already compensates:
  `BODY_ANCHORS` puts the head slot directly over the body's own head. The
  residual artifact is that a wide-jawed body head can peek out below a smaller
  stamped head.
* A faint cast shadow can still survive on individual parts. Re-cut just that
  part with a higher `--key-hard`; with `--keep-raw` this costs no GPU time.
* Soft-edged parts without a strong outline (`miasma`, `spore`) are the ones most
  at risk from a greedy flood — check them after a batch.
* **Neither quality gate catches a wrong subject.** A beak rendered as a whole
  bird is geometrically perfect: unclipped, unframed, well covered. Run
  `scripts/parts_contact_sheet.mjs` and actually look at the sheet after a batch;
  re-bake offenders by name, optionally with `--seed`.
* The house palette is whatever the anchor happens to be for a given prompt — it
  has landed on sage-green and on grey-stone across builds. It is **coherence**
  that is pinned here, not a specific hue. If a particular palette is wanted, art-
  direct it explicitly in `STYLE` rather than hoping the anchor lands there.

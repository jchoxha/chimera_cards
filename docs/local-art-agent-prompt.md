# Prompt for the local art-generation agent (run on the ASUS Z13)

Copy everything below the line into your local coding agent. It is written to be
self-contained — it does not assume the agent has seen any prior conversation.

---

## Task

Set up **local AI image generation on this machine** and wire it into an existing
game's art-baking pipeline, so I can generate creature **part sprites** for free
and unlimited, replacing a paid cloud API (Retro Diffusion). The end state: I run
one command (or you run it) and the game's ~46 part sprites are generated locally,
cut to transparent PNGs, written into the repo, and visible in the game's art
preview.

## This machine

- **ASUS ROG Flow Z13 (2025)** — AMD **Ryzen AI Max+ 395 "Strix Halo"**, integrated
  **Radeon 8060S** GPU (RDNA 3.5, GPU arch **gfx1151**), **64 GB unified LPDDR5X**.
- No NVIDIA / no CUDA. The huge unified memory means the iGPU can use tens of GB as
  VRAM, so SDXL and even FLUX fit comfortably.
- Detect the OS yourself and pick the most reliable backend. Known facts (verify,
  they change fast):
  - **ROCm on Strix Halo is still flaky** (GPU hangs, memory errors). Prefer a
    **Vulkan** backend, which uses Mesa RADV and has solid RDNA 3.5 support.
  - On Linux, the **`smarttechlabs-projects/strix-halo-comfyui`** toolkit provides a
    prebuilt PyTorch wheel with gfx1151 support and gets ComfyUI running with minimal
    friction.
  - On Windows, use **ComfyUI-Zluda** or **stable-diffusion.cpp with the Vulkan
    backend**. **AMD's "Amuse"** app is a zero-setup GUI fallback for a manual
    quality check.
  - CPU-only works but is slow; fine as a last resort for a one-time batch.

## The repo and the pipeline you must plug into

- Repo: `https://github.com/jchoxha/chimera_cards`, branch **`main`**. Clone it (or
  use my local checkout if present). It's a Vite + React project; `npm install`,
  `npm run dev` serves it, `npm run build` builds it.
- **Read `scripts/bake_parts_rd.mjs` first — it is the REFERENCE IMPLEMENTATION you
  are mirroring.** It talks to the Retro Diffusion cloud API. Your job is to produce
  an equivalent that talks to the LOCAL generator instead, keeping the same
  input/output contract. Either add a `--provider comfy` branch to that script or
  write a parallel `scripts/bake_parts_local.mjs`.
- Shared data the pipeline uses (do NOT duplicate — import/read these):
  - `src/data/partSubjects.js` — `PART_SUBJECT` (partId → text description of what
    that part depicts, isolated) and `BODY_PART_IDS`. **Single source of truth for
    prompts.**
  - `src/data/partsRig.js` — the full part list; part ids are the keys matched by
    `/\{ id: '([\w-]+)'/`. ~46 parts: 3 bodies, 5 heads, ~38 attachments (wings,
    claws, horns, tentacle, weapons, etc.).
  - `src/data/partsBaked.json` — the manifest, `{ "<partId>": "art/parts/<partId>.png" }`.
    The game renderer reads this; adding an entry makes that part's art appear.
- **Output contract (must match exactly):**
  - Write each sprite to `public/art/parts/<partId>.png` — a **transparent-background
    RGBA PNG**, the part tightly cropped with a small margin, **256×256 or smaller**.
  - Add/update its entry in `src/data/partsBaked.json`.
  - Commit both to `main` and push. (Pages + OTA redeploy automatically.)

## Art requirements (this is the hard part — coherence)

The system composites these parts into one creature (a body + a head + attachments),
so the parts must look like they belong together. This, not raw quality, is the goal.

1. **One consistent style across ALL parts.** Target: **pixel art** in the spirit of
   Cassette Beasts — clean limited palette, readable silhouettes, chunky pixels. Pick
   ONE model + LoRA + settings and use them for every part. Recommended starting
   point: **SDXL + the `nerijs/pixel-art-xl` LoRA** (no trigger word; put "pixel" in
   the prompt). Alternatives worth trying: a FLUX pixel-sprite LoRA, or Z-Image-Turbo
   (fast on Vulkan).
2. **Reference-locked coherence — the key trick.** Generate the **3 bodies FIRST**.
   Then, for every head/attachment, feed the relevant body PNG as a **reference image
   (IP-Adapter or reference-only ControlNet for SDXL)** so its palette, shading and
   line weight MATCH the body. The reference implementation does this via the cloud
   API's `reference_images`; replicate it locally. Bodies already on disk should be
   auto-loaded as references so re-baking one part stays cheap/consistent.
3. **Isolated parts in a FIXED orientation** (the rig handles placement + mirroring —
   never draw a part attached to a creature). The reference script already encodes
   these; reuse them:
   - Each part drawn **small and centered with a wide empty margin, NOT cropped, NOT
     touching any edge** (models tend to fill the canvas → clipped parts).
   - Heads: **face LEFT, with a short flat neck stump at the bottom-centre** so they
     seat on the body's neck.
   - Wing points RIGHT, claw points DOWN, weapons stand upright grip-at-bottom, etc.
     (exact orientations are in `PART_SUBJECT`).
4. **Transparent background.** Best: a ComfyUI background-remover / rembg node for
   clean alpha. Fallback: generate on a flat solid **magenta (255,0,255)** backdrop
   and chroma-key it out — the repo already has that exact cutout logic in
   `src/lab/cutout.js` (`keyMagenta` + `alphaBounds`) and `scripts/sprite_cutout.py`;
   reuse rather than reinvent.

## How to talk to ComfyUI

ComfyUI exposes an HTTP API on `http://127.0.0.1:8188`: `POST /prompt` with a
workflow graph (JSON), poll `GET /history/{prompt_id}`, fetch results from
`GET /view`. Build a workflow that does: load checkpoint → load LoRA → CLIP encode
(positive/negative) → (optional IP-Adapter with the body reference) → KSampler →
VAE decode → background removal → save. Your bake script POSTs one job per part,
waits, decodes the PNG, applies cutout if needed, and writes the file.

## Do it in this order (don't boil the ocean)

1. **Stand up the backend** and generate ONE test image by hand (or via Amuse) to
   confirm the machine produces pixel art at all. Report the backend you chose.
2. **Probe two parts:** generate `body-beast`, then `head-beast` referencing it.
   Write them to `public/art/parts/`, update `partsBaked.json`.
3. **Verify in the game:** `npm run dev`, open `/lab.html`, go to the **🧬 Fuse**
   tab, fuse two beast creatures (e.g. Voltfang + Grizzlord). The composited creature
   should show your baked body + head. Iterate model/LoRA/steps/prompt until the two
   parts look like the same creature (coherent palette + line weight, head not
   clipped, neck seats on the body).
4. **Only once the probe looks good, batch the rest** — all ~46 parts, bodies first,
   attachments referencing the bodies. Commit + push.
5. **Stretch goal (best coherence):** train a small **style LoRA** on the approved
   parts / a reference set, then regenerate everything through it for a locked house
   style. This is what the cloud service itself does.

## Acceptance criteria

- ComfyUI (or chosen backend) runs on the iGPU (or documents why CPU fallback was
  needed) and is reachable via its HTTP API.
- `scripts/bake_parts_local.mjs` (or `--provider comfy`) generates any requested part
  by id, matching the RD script's CLI shape (`--probe`, `--bodies`, or part ids), and
  writes transparent PNGs + updates `partsBaked.json`.
- The `body-beast` + `head-beast` probe composites coherently in `/lab.html`'s Fuse
  tab: matching palette, no clipping, head seated on the neck.
- Everything committed to `main`. Report: the backend chosen, model + LoRA + key
  settings, per-image generation time, and any Strix-Halo-specific gotchas so I can
  reproduce.

## Notes / guardrails

- Keep prompts sourced from `PART_SUBJECT` — don't hardcode a second copy.
- Don't touch game logic, only the art pipeline + a new bake script + the parts
  manifest + the generated PNGs.
- The renderer already prefers a baked PNG over its procedural placeholder
  automatically (via `composeCreature` reading `partsBaked.json`), so you never edit
  rendering code — just drop files + manifest entries.
- If AMD GPU acceleration proves too painful, say so explicitly and fall back to
  Amuse-for-quality-check + CPU-batch, rather than silently producing nothing.

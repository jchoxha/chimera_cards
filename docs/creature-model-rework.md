# Creature-model rework — design stub (opened 2026-07-07, Jeton)

Jeton: *"we will likely have to rework our existing model for creature generation,
both because we still need to flesh out our typing axes as well as for this new
size differentiation with different images."* This doc collects the threads so the
rework session starts from one place. Nothing here is locked.

## Why a rework

1. **Typing axes still half-fleshed.** The body-type migration (biology-kits.md §9)
   landed the 3 body types + 4 built subtypes, but the subtype backlog
   (Undead/Hallowed/Feral/Ancient/Swarm/Cursed/Spectral…), deeper subtype rules
   (Giant throw/immovable), and the 28 archetype hybrids are all unbuilt. The
   generator (`makeCreature`) consumes the axes but doesn't yet express most of
   what the spec (synthesis-matrix-spec.md §7/§14) wants per axis.
2. **Size is now a first-class identity axis.** v3.102.0 made sizes REAL objects:
   per-(id, size) collection entries (discovered/captured), per-size team-assembly
   variants (`<id>#<form>`, re-derived HP/Might), per-size codex pages, and a
   per-size ART slot (`<id>-<form>.png` + `creatureArtSizes.json`). The generator
   still treats size as a scalar multiplier stapled on at the end — it should
   become part of the creature's generated identity (per-size stats curves? size-
   gated cards? evolution = moving up the ladder with a NEW image?).

## Size-art learnings (from the first live bake, 2026-07-07)

The `ironhide-boss` sample exposed three concrete generation-model problems:

- **Size adjectives in the base subject fight the form.** Ironhide's subject says
  "colossal" — so the "boss" render looked like… the base. FIXED in prompts: every
  size instruction now explicitly OVERRIDES subject size-words and encodes the size
  in COMPOSITION (camera angle, frame fill, environment scale cues), not adjectives.
  → Base subject texts should be rewritten SIZE-NEUTRAL (describe identity, not
  scale) so the form phrasing owns scale exclusively.
- **White border.** The sample came back with a white frame despite "no border" in
  the style block. FIXED in prompts: an explicit FULL-BLEED clause (art must reach
  all four edges; no border/frame/margin/white edge). Post-process guard idea:
  detect a uniform border ring and auto-crop before the 384² downscale.
- **Anatomy glitches.** The ORIGINAL `ironhide.png` has an extra arm (flagged).
  Every bake needs an eyeball pass; regen list lives in art-pipeline.md §TODO.

Both prompt fixes are live in `scripts/gen_roster.py` (`STYLE`/`SIZE_DESC`) and
`src/data/sizeArt.js` (`FORM_ART_DESC`) — they are mirrored; keep them in sync.

## Rework scope (to settle with Jeton before building)

- Size-neutral subject rewrite for all 15 roster creatures (+ forge `description`
  guidance so forged creatures are also size-neutral).
- Per-size generated identity: what ELSE besides HP/Might/art should differ by
  size? (candidates: deck size, size-gated cards, stat curve shape, AI tier).
- Evolution ↔ size ↔ art: evolving up the ladder should reveal the next size's
  image + codex entry (ties into the collection's discovered-forms).
- Axis flesh-out order: remaining subtypes vs archetype hybrids vs attunement
  variant depth — pick the next axis to build.
- Discovery events in gameplay: encounters should `addDiscovered`, captures
  `addCaptured` (module: `src/app/collection.js`) — today only the Admin panel
  and the starter pick write to the collection.

## Regen queue (needs the image pipeline: AGY MCP in-session, or agy on Windows)

- `ironhide.png` (base) — extra-arm glitch.
- `ironhide-boss.png` — looked like a base variant + white border. Currently
  PUBLISHED in `creatureArtSizes.json` as the visible proof the per-size swap
  works; replace with a clean regen (fixed prompts) when the image tool is on.
- `tidecaller.png` — still missing entirely (icon fallback).
- `frostmind.png` — flagged off-model (2026-06-23).

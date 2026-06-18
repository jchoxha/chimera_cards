# Chimera Cards

A Pokémon × Slay-the-Spire prototype: capture monsters, build card-driven teams,
descend dungeons, and generate/fuse monsters with AI. Vite + React 18, originally
a single-file Claude artifact now split into ES modules.

## ⚑ Project state — read this first (updated 2026-06-18)

This repo currently holds **two codebases** that coexist:

1. **The React prototype** (`index.html` → `src/main.jsx` → `src/App.jsx`): the
   original, fully playable game. Live at https://jchoxha.github.io/chimera_cards/
2. **The new engine** (`src/engine/`): a ground-up, framework-agnostic rebuild of
   the base mechanics toward an ambitious *dynamic multiplayer creature deckbuilder*
   (StS2-grounded). This is the active direction. Playable combat demo at
   https://jchoxha.github.io/chimera_cards/combat.html

**Stack decision:** stay on **Vite + React + JS** for now (no TS migration yet);
spec "TS interfaces" are JSDoc `@typedef`s. Renderer when we build the view = **Phaser**
(deferred — combat UI is React today, wearing the ornate-TCG skin below). See memory `chimera-engine-architecture`.

**🔒 ACTIVE DESIGN DIRECTION (LOCKED 2026-06-18): the Vanguard/Peek rebuild.**
The engine combat model is being rebuilt from 1-v-1 into a **symmetrical Active
Vanguard + Bench action-economy engine** with per-monster decks, a **symmetrical
energy economy** (`max(3, benched)` for **both** sides), escalating-cost swaps,
per-card targeting scopes, and a limited-charge **Peek** system that scouts the
enemy's forecasted multi-action turn. The authoritative spec is
**`docs/combat-engine-spec.md`** — read it before touching `src/engine/combat/`.
Key consequences that override older notes below: monsters have **exactly 1–2
types** (not ≤3); **Team Shield is removed**; the **elemental Reaction matrix is
frozen** for this milestone; the **+1 shared-element synergy is removed**; and
**`combat.html` is retired** (engine validation is now via `node` smoke-tests).
Targeting scopes use the **locked 18-token vocabulary** (consumables reuse it; the
`fortifySlot` is a positional spatial aura addressed via `CardEffects.fortify`, not
a scope token). **Block** is **creature-bound** — it rides mid-turn swaps and
decays to 0 **at the start of its own side's turn** (per-side, StS-style);
`fortifySlot` Block escapes that decay (card-defined duration). **DoTs** tick at
the **opponent's** turn-end, **Regen** at the **carrier's own** turn-end. **Peek**
reveals are turn-wide and persist
even through forced re-plans (no charge refund; charges reset per combat encounter).
**All §7 rulings locked 2026-06-18.** **Phase 1 boilerplate COMPLETE**: the
symmetrical `Fighter`/`Side`/`PlannedAction`/`CombatState` typedefs (`types.js`),
structural factories (`src/engine/combat/state.js`), the 18-token `TARGET_SCOPES`
vocabulary + classifier (`src/engine/combat/scopes.js`), all validated by
`npm run test:combat` (37 checks, structural only — **ready for turn behavior**).

**Done so far:**
- **Vanguard turn engine — Layers 1, 2, 3, & 4 (swaps & AI planner), DONE 2026-06-18.** All turn cycle
  foundations, block decay, DoT/Regen timings, manual swaps, entry boons, forced displacement, and
  free death-swaps are complete. Layer 4 is fully implemented: player Peek charge limits,
  Version-B AI Planner (priority rules, lookahead simulation, and element matchup swaps), and symmetric
  card/swap execution. Validated by `npm run test:turn` (85 checks).

- **Engine Phase 1** — core in `src/engine/`: `types.js`, `GameEngine`,
  `combat/CombatManager` (StS turn cycle + status system), `cards/CardDeck`,
  `cards/rarity.js` (adaptive Pity-Offset engine + combined-typing draft pools),
  `party/MonsterParty` (3-type matrix), `ai/AIPipeline` (serverless connector).
- **Engine Phase 2** — `engine/content/` (adapts the 108-monster roster + 339-card
  pool + enemy AI into engine shapes), `src/store/combatStore.js` (Zustand),
  `src/ui/combat/CombatScreen.jsx` (mobile combat view), `combat.html` standalone
  entry, and `api/` serverless backend (forge/fuse functional, art stubbed).
- **Combat UI redesign** — `src/ui/combat/CombatScreen.jsx` now wears the locked
  ornate-TCG skin (`src/ui/combat/combat.css`, ported from `public/mockup-battle.html`):
  dynamic type×rarity card frames (`src/ui/combat/frames.js` — weighted type-hue
  gradient + metallic rarity finish + holo sheen on rare+), element badges +
  type-matchup line, enemy overview strip + carousel-targeting, switchable bench
  (`combatStore.switchActive`), energy orb, fanned hand, combat log. Uses Iconify
  (game-icons) + Cinzel/Spectral fonts via CDN in `combat.html`. Enemy archetypes gained
  `element`/`icon`/`rarity`/`form`; adapted monsters carry `sprite`/`form`/`rarity`.
- **Progression ruleset — no levels, size/form only.** Forms (`baby·small·regular·
  large·elite·boss`, each with `hpMult`+Strength+`art` scale in `elements.jsx`) replace
  levels. Cards show a size badge (base = none) and scale creature art by form. Elite &
  Boss are allowed at *any* evolution stage but **terminal** — enforced at the source in
  `monster.evolutionTarget` via new `formAllowsEvolution`/`TERMINAL_FORMS`. The snapshot
  drops `level`, adds `form`+`rarity` for both party and enemies.
- **Debug console (prototype)** — `CheatPanel` (`src/ui/components.jsx`) gained: a
  **collection editor** (State tab — edit any captured monster's name/sprite/typing/
  rarity/form/maxHp, toggle team membership, heal, delete) and a **⚔️ Battle tab** that
  builds a custom fight: pick ≤3 of your monsters vs an ordered enemy *gauntlet* (the
  single-enemy engine fights the queue in sequence, HP carrying between them; sandbox —
  no rewards/captures/progress). Handlers live in `App.jsx` (`cheatEditMonster`,
  `cheatDeleteMonster`, `cheatToggleTeam`, `cheatHealMonster`, `startCustomBattle`/
  `advanceCustomBattle`, the latter hooked into `afterWin`); `CheatPanel` only reads props.
- **Art direction** — locked "Variant B" (flat 2D Adventure-Time look); see
  `docs/art-pipeline.md`, `experiments/art-direction/`, memory `chimera-art-direction`.
- **Art generation** — via `agy` (Antigravity CLI) headless: `scripts/agy_call.py`;
  see memory `agy-headless-image-gen`.

**Deep-dive docs:** `docs/combat-engine-spec.md` (**LOCKED Vanguard/Peek combat
spec — the active rebuild**), `src/engine/README.md` (engine map + spec mapping;
Phase 1, partly superseded by the Vanguard spec), `api/README.md`
(backend + deploy), `docs/art-pipeline.md` (art), `experiments/art-direction/README.md`.

## Commands

```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # production build to dist/ (set VITE_BASE for GH Pages)
npm run preview  # serve the production build
npm run lint     # eslint src — no-undef guards against missing cross-module imports
npm run test:engine  # node smoke test for the new engine (src/engine/__smoke__.mjs)
# content layer test: node src/engine/content/__smoke__.mjs
```

The prototype is `index.html`; the new engine combat demo is `combat.html`
(both built via Vite multi-page — see `vite.config.js`).

## Golden rules (must follow on every gameplay edit)

1. **Bump `APP_VERSION` in `src/version.js`** on every gameplay edit — shown in the
   header and debug menu so the player can confirm they have the latest build.
2. **Regenerate the dex** (`src/data/dex.js`) on any roster change.
3. **New content must be reachable from the admin/debug console** (CheatPanel).
4. **UI components only read props** — no game state lives in `src/ui/`. All state
   and game-logic handlers live in `App.jsx`; check for scope leaks when adding systems.

## Layout

- `src/main.jsx` — React entry.
- `src/App.jsx` — root `ChimeraCards` component; **all** state + game logic handlers.
- `src/version.js` — `APP_VERSION`.
- `src/utils.js` — `uid`, `shuffle`, `clamp`.
- `src/ai/claude.js` — Anthropic API access (art + JSON generation).
- `src/data/` — pure content: `monsters`, `moves`, `dex`, `items`, `materials`
  (+recipes), `artifacts`, `quests`.
- `src/game/` — derived logic: `monster` (make/evolve/fuse), `evolution` (gates),
  `fighter` (deck/fighter build).
- `src/systems/` — `save`, `sfx`, `elements` (matchups/forms/lines), `forge`
  (rarity rolls), `map` (dungeon + overworld).
- `src/ui/` — `components.jsx` (all screens/widgets), `styles.js` (`S`, `tcg`, `CSS`),
  `icons.jsx` (procedural + AI icon art).
- `index.html` — page shell + optional local AI key.

**New engine (the active rebuild):**
- `src/engine/` — framework-agnostic core (see `src/engine/README.md`).
- `src/engine/content/` — adapters from `src/data` → engine shapes + reward pool + enemies.
- `src/store/combatStore.js` — Zustand store wrapping `GameEngine`.
- `src/ui/combat/CombatScreen.jsx` — mobile combat view; `src/combat-demo/main.jsx` + `combat.html` are its standalone entry.
- `api/` — serverless backend (forge/fuse/art); **does not run on GitHub Pages**, needs Vercel.

## Conventions

- **Continuity discipline:** update this file's "Project state" section + the memory
  files *as each milestone completes*, and **commit per-milestone** (don't batch doc
  updates or commits for session end). A session can be cut off at any time; keeping
  docs+commits current means a cutoff loses at most the one in-flight change. A
  `SessionStart` hook (`C:\Projects\Experiments\.claude\settings.json`) reminds every
  session of this.
- **`MODULE:` banner comments** mark virtual-module sections inside files (a holdover
  from the single-file artifact). Each banner lists its `UPDATE WHEN:` obligations —
  the cross-codebase changes that must touch that module. Search `MODULE:` to navigate;
  keep these banners accurate when editing.
- Files import only what they use; ESLint's `no-undef` catches missing imports.

## AI features (art / forge / fusion)

`src/ai/claude.js` calls the Anthropic API directly from the browser.

- **Inside the Claude app** the endpoint needs no key.
- **Outside Claude** (local dev, GitHub Pages) set `window.ANTHROPIC_API_KEY` in
  `index.html` for **local testing only** (commented template is there).
- **Never commit a key or deploy it** — this repo and its Pages site are public.
- Without a key, AI features degrade gracefully (emoji art, error messages); the rest
  of the game works fully.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with the
correct `/<repo>/` base path (`VITE_BASE`) and publishes to GitHub Pages. Both
`index.html` (prototype) and `combat.html` (engine demo) are deployed.

## Roadmap / next steps (candidates, not yet started)

The new engine is the active direction. Likely next work:
- **Wire Vanguard engine to UI & Store (Top Priority)** — Integrate the completed `VanguardManager` and symmetrical `CombatState` into the Zustand store (`src/store/combatStore.js`) and update `src/ui/combat/CombatScreen.jsx` to display the new active Vanguard, Bench, energy economy, and Peek forecast silhouettes/reveals.

- **Wire real art** into combat via a manifest (Variant-B baked art → `public/art/`),
  using `scripts/agy_call.py`; add WebP post-processing + lazy-load.
- **Richer combat**: more enemy archetypes + smarter intent AI; expand the status
  set (only burn/poison/weak/vulnerable/strength/regen are live — others map but are
  inert); add keywords (Exhaust/Retain already in CardDeck; Orbs/Stars/Summon TBD).
- **Run layer**: map/path graph + rewards/shop/rest between fights; the `Sanctuary`
  meta-progression base.
- **Multiplayer (spec §4)**: cloud sync (Supabase/Firebase), async world map ghost
  data, Hologram-clone challenges, the Community DNA registry.
- **Generative pipeline**: finish `api/art` (image provider + bucket) and converge
  runtime forge/fuse art onto the locked Variant-B style.
- **Eventual**: Phaser view layer; optional TS migration (JSDoc typedefs convert 1:1).

> Caveats in the current build: enemy AI is a fixed cycle; combat cards are text-only
> (no art yet); `api/*` is unreachable on Pages. None block playtesting the demo.

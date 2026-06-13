# Chimera Cards

A Pokémon × Slay-the-Spire prototype: capture monsters, build card-driven
teams, descend dungeons, and generate / fuse new monsters with AI.

Originally a single-file Claude artifact, now lifted into a Vite + React
project so it can be developed across devices, hosted on the web, and later
wrapped for mobile (Capacitor) and desktop (Tauri).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

## AI features (art / forge / fusion)

The game calls the Anthropic API directly from the browser.

- **Inside the Claude app** the endpoint needs no key.
- **Outside Claude** (local dev, GitHub Pages) the AI features need a key. For
  **local testing only**, set `window.ANTHROPIC_API_KEY` in `index.html`
  (a commented template is there). **Never commit a key or deploy it** — this
  repo and its Pages site are public.
- Without a key the AI features degrade gracefully (emoji art, error messages);
  the rest of the game works fully.

A server-side proxy to keep AI working on the public page without exposing a key
is a planned follow-up.

## Deploy (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with the
correct `/<repo>/` base path and publishes to Pages. One-time setup: in the
repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Project layout

The original single-file artifact has been split into real ES modules. Files
import only what they use; ESLint's `no-undef` rule guards against missing
cross-module imports (`npm run lint`).

- `src/main.jsx` — React entry point.
- `src/App.jsx` — the root `ChimeraCards` component (all state + game logic).
- `src/version.js` — `APP_VERSION` (bump on every gameplay edit).
- `src/utils.js` — `uid`, `shuffle`, `clamp`.
- `src/ai/claude.js` — Anthropic API access, art + JSON generation.
- `src/data/` — pure content: `monsters`, `moves`, `dex`, `items`,
  `materials` (+recipes), `artifacts`, `quests`.
- `src/game/` — derived game logic: `monster` (make/evolve/fuse),
  `evolution` (gates), `fighter` (deck/fighter build).
- `src/systems/` — `save`, `sfx`, `elements` (matchups/forms/lines),
  `forge` (rarity rolls), `map` (dungeon + overworld).
- `src/ui/` — `components.jsx` (all screens/widgets), `styles.js`
  (`S`, `tcg`, `CSS`), `icons.jsx` (procedural + AI icon art).
- `index.html` — page shell + optional local AI key.

> The `MODULE:` banner comments from the original file are preserved inside the
> new files as section markers. Further splitting `ui/components.jsx` into
> per-screen files is a natural follow-up (Phase 3, the UI overhaul).

## Conventions (from the game's own golden rules)

- Bump `APP_VERSION` in `src/version.js` on every gameplay edit.
- Regenerate the dex on any roster change.
- New content must be reachable from the admin/debug console.
- UI components only read props.

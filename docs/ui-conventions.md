# UI conventions — the Chimera design system

Opened 2026-07-07 (Jeton: *"I am starting to get sick of the inconsistencies
across modals, menus, and stylings of card formats. Go through the whole app and
start to create conventions that we can utilize across development."*)

The app had drifted into **two colour themes** (a gold/wood "gilded TCG" skin used
by combat/menu/run/codex/editor, and a stray **purple** skin on the team-assembly
+ creature-creator screens), **~7 bespoke modal implementations**, and **~30 one-off
button classes**. This doc + `src/ui/theme.css` are the single source of truth going
forward. **New UI composes these; it does not invent new colours/modals/buttons.**

## The canonical look

**Gilded wood.** Dark wood surfaces, warm cream ink, gold accents, `Cinzel` for
display/headings/buttons and `Spectral` for prose. The purple palette is retired.

## Tokens — `src/ui/theme.css` (`:root`)

Always reference tokens, never raw hex, in new/edited CSS.

| Group | Tokens |
|---|---|
| Surfaces | `--bg` `--surface-1` `--surface-2` `--surface-3` `--scrim` |
| Ink | `--ink` `--ink-dim` `--ink-faint` |
| Gold | `--gold` `--gold-bright` `--gold-deep` `--gold-fill` |
| Lines | `--line` `--line-strong` |
| Semantic | `--good` `--info` `--bad` `--warn` (+ `-line` / `-bg` variants) |
| Radius | `--r-sm` `--r-md` `--r-lg` `--r-pill` |
| Spacing | `--s-1`…`--s-6` (4/8/12/16/24/32) |
| Elevation | `--shadow-card` `--shadow-modal` `--glow` |
| Z layers | `--z-nav` `--z-overlay` `--z-modal` `--z-popup` `--z-toast` |
| Type | `--font-display` (Cinzel) `--font-body` (Spectral) |

theme.css is imported FIRST in every page entry (`src/app/main.jsx`,
`src/editor/main.jsx`, `src/combat-demo/main.jsx`), so tokens are global.

## Primitives

**Modals — `src/ui/Modal.jsx`** (React) → renders `.uiOverlay` + `.uiModal`.
```jsx
<Modal onClose={close} title="Ironhide" icon="game-icons:…" size="lg">…</Modal>
```
Backdrop click + ✕ close; `size` = `sm|md|lg`. Don't hand-roll overlays.

**Buttons — `.uiBtn`** with modifiers `go` (primary/gold), `ghost`, `danger`,
`sm`, `big`, `block`. One class, composable: `<button class="uiBtn go big">`.

**Tabs — `.uiTabs` / `.uiTab`** (`.on` for active). Pill tab strip.

**Pills — `.uiPill`** with tones `good` / `info` / `muted`. Small status chips.

**Card grids — `.uiCardGrid` + `.uiCardTile`.** THE way to lay out `CardFace`
cards (auto-fill, hover-lift, hides the combat YOU/FOE tag). `.locked` dims an
undiscovered tile. Set `--gl` on the tile for the creature's glow colour.

**Panels — `.uiPanel`, `.uiHint`.** A bordered section / a dim helper line.

## Card format

Creatures render through ONE component: `CardFace` (`ui/combat/creatureVisuals.jsx`)
via `creatureToFace(creature)`. Do NOT build alternate creature tiles — reuse
`CardFace` in a `.uiCardTile` everywhere (team assembly, codex, editor, starter).

## Migration status — COMPLETE colour/token conversion (2026-07-07)

Every screen now draws from the tokens (one gilded-wood palette; the purple skin is
gone). Verified: menu, team-assembly, creature-creator, editor (cards + creatures),
codex, run, deck-builder, team-manager, monster-page, combat.

- ✅ `theme.css` tokens + primitives; global import; `Modal.jsx`.
- ✅ Changelog modal + creature-editor modal → `Modal` primitive (reference impls).
- ✅ Rethemed to tokens: `select.css`, `creator.css`, `editorHub.css`, `app.css`,
  `codex.css`, `deck.css`, `teamManager.css`, `MonsterPage.css`, `run.css`,
  `editor.css`, `combat.css`.
- ✅ **`--ink` naming fixed**: combat.css used to redefine `--ink`/`--ink2` on `:root`
  (dark) — clashing with theme's `--ink` (cream TEXT) *globally*. Combat's dark card
  interiors now use literals; its `:root` keeps only `--gold1..4`/`--goldB`/`--cream`.
  **Never redefine `--ink` per-screen.**

Remaining polish (opportunistic, non-blocking): route the last hand-rolled overlays
(`.miniModalWrap` combat, `.runOverlay` run, `.editModal` editor) through `<Modal>`
(their CSS already matches), and collapse the gilded one-off buttons (`.runBtn`,
`.dbBtn`, `.cbTab`, `.selBtn` …) onto `.uiBtn`/`.uiTab` when a file is touched anyway.

When you touch a file, use tokens + primitives — never raw hex, never a new palette.

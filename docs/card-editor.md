# In-Engine Card Editor + Data-Driven Cards

> Tooling to author/tune cards as data (locally AND from a phone), persist to the repo,
> and play them live. Decided 2026-06-21. Compatible with "design-complete first" — this is
> design-process tooling, and the schema it defines is the same one the Topic-8 generator emits.

## Architecture

1. **Card schema (source of truth).** Cards are JSON with an **ordered effect op-list**
   (`src/engine/cards/cardSpec.js` defines/validates it). Data lives in
   `src/data/cards/<class>.json`. The op-list expresses damage, block, buffs, debuffs, draw,
   energy, heal, stance shifts, X-hits, dynamic values (`valueFrom`), conditionals
   (`bonusIf`), and power triggers.
2. **Interpreter (playability).** `src/engine/combat/interpret.js` `applyCardSpec()` runs a
   card's op-list through the engine, applying the **Topic-1 stat scaling** (Might→damage,
   Guard→block, Focus→effects-on-others vs target Resolve, Resolve→self-buffs) and the
   **Warrior stance rules** (`src/engine/combat/stances.js`).
3. **Editor UI** (next increment): a standalone dev page — list/search, per-field + per-op
   form, live preview, raw-JSON escape hatch.
4. **Persistence — dual backend, auto-selected** (next increment):
   - **Local (`npm run dev`):** a Vite dev plugin writes the JSON to disk on Save.
   - **Remote/phone (deployed):** commit the JSON via the **GitHub API** with a PAT the user
     pastes once (localStorage only; never committed; repo is public so warn loudly).
   - **Fallback:** localStorage autosave + Export/Import JSON.
   - Every save lands as a real commit for review.

## Build increments

1. ✅ **Foundation** — schema (`cardSpec.js`) + interpreter (`interpret.js`) + stances
   (`stances.js`) + stat fields on Fighter + Warrior data (`src/data/cards/warrior.json`) +
   smoke test (`npm run test:cards`). Cards run through the engine headlessly.
2. ✅ **Editor UI + dual persistence** — `editor.html` → `src/editor/` (`CardEditor.jsx`):
   list/add/delete cards, structured per-field + per-op form, power-trigger editor, live
   `validateCard`, whole-card **raw-JSON** escape hatch, Export. Persistence
   (`persistence.js`): **dev-write** Vite plugin (`src/dev/cardWritePlugin.js`, `apply:'serve'`,
   excluded from build) for local Save-to-disk; **GitHub API** commit (fine-grained PAT in
   localStorage) for phone/deployed; localStorage autosave + Export fallback. Backend
   auto-detected. Verified: ping + save round-trip + path-escape rejection + page serves.
   Dev URL: `/editor.html`.
3. ⏳ **Combat integration** — build a playtest deck from edited cards into `CombatScreen`
   (the live author→playtest loop); fire power triggers; wire Brace decay into the turn loop.

## Effect registry (extensibility — the key to "easy to add mechanics")

`src/engine/cards/effectRegistry.js` is the **single source of truth** for the effect
vocabulary. Each op declares BOTH its engine behavior (`apply`) and its editor field
metadata (`fields`), so **adding a new mechanic = adding one registry entry** — the
interpreter runs it and the editor form renders it automatically (no edits to either).
It also defines `TRIGGER_EVENTS` (turnStart/turnEnd/onGainBlock/onPlayCard/onDeath/fatal/
passive) and `PASSIVES` (rule-modifier flags like `blockAlwaysBraces`, `extraStanceStep`).

- **Triggers** fire via `fireTriggers(state, side, event)` (powers register their hook).
- **Passives** are read via `hasPassive(fighter, id)` (e.g. block op braces if the carrier
  has `blockAlwaysBraces`).
- **`validateCard` flags non-functional cards** — a card with no effects / no trigger /
  no passive is an error, surfaced in the editor (⚠ on the card row). No card "does nothing".

## Parity targets from Nexus mod #69 ("Card editor and Card creator", Renovice)

Our north star. Status: ✅ have · ⏳ planned.
- ✅ Edit effects / costs / numbers on any card; create custom cards; per-class files.
- ✅ Registry-driven effects; triggers; passive rule-modifiers; live validation.
- ⏳ **Custom art per card** (schema has `art`; needs rendering + upload/asset pipeline).
- ⏳ **Author custom status effects & keywords** from the editor (today the status set is
  fixed; mod #69 lets you define new ones — make `PASSIVES`/statuses editor-authorable).
- ⏳ Custom starting deck, "link card", foils, GIF art, target-specific-enemy knobs.

## Card schema (v0)

```jsonc
{ "id": "...", "name": "...", "class": "Warrior", "biology": null,
  "attunement": "Physical", "type": "attack|skill|power", "cost": 1,   // -1 = X
  "rarity": "common", "keywords": [], "text": "...",
  "requires": { "stance": "Rampage", "stanceSide": "offense|defense" },  // optional play-gate
  "effects": [ /* ordered ops */ ],
  "trigger": { "on": "turnStart|onGainBlock", "effects": [ /* ops */ ] }  // powers
}
```
**Ops:** `damage{value|valueFrom, hits|"X", scope, bonusIf, bonusMult, bonusAdd, bonusPerDexterity}`
· `block{value|valueFrom, brace, bonusPerDexterity}` · `buff{status, value, temporary}` (self, Resolve)
· `debuff{status, value, scope}` (Focus vs target Resolve) · `heal{value, scope}` · `draw{value}`
· `energy{value}` · `pay{block, hp}` · `stance{set | shift:{dir,steps}}`.

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

## Parity with Nexus mod #69 ("Card editor and Card creator", Renovice)

Reviewed the shipped README + the `.pck` (it embeds the mod's C# source). Goal:
**match its functionality first, then expand** with our 3-axis / Vanguard systems.
Its core philosophy (README design note) = ours: *every knob that can vary gets its
own dropdown/field so users compose behaviour without code.* So this is mostly
**widening the effect schema + editor controls**, not re-architecting.

### Feature parity matrix

| Mod #69 feature | Ours today | Gap to close |
|---|---|---|
| Edit cost / type / numbers on any card | ✅ | — |
| **Star cost** (2nd resource) + true X-cost | energy + X (`-1`) | `starCost` — **decision: do we add a 2nd resource?** (StS2-specific; our model is energy + Vanguard) |
| **Replay count** | — | add `replayCount` (+ keyword) |
| Keywords (Exhaust/Ethereal/Retain/Innate/Unplayable) | free-text `keywords[]` | proper **keyword set** (checkboxes) + replay |
| Numbers as **dynamic vars** | `value` / `valueFrom:selfBlock` | generalize → named `dynamicVars` referenced by effects |
| Enchantment / Affliction + amount | `buff` / `debuff` ops | (naming alignment optional; mechanics ✅) |
| **Extra Effects: trigger / target / timing / duration** per effect | per-op `scope` (target ✅, our 18-token scope ⊇ their TargetType); triggers only on powers | add per-effect **trigger**, **duration/timing** knobs to ANY op |
| **Scaling** (per-effect, by play/draw/discard/exhaust/create history) | — | add `scaleBy:{event,window,filter,pile,per}` |
| **Conditional effects** (event verb, threshold, card-type filter, time window, pile) | `bonusIf:{stance,targetHpPctBelow}` (narrow) | generalize → multi-variable `condition` (gates firing or adds bonus) |
| Card types incl. **Curse / Status / Quest** | attack/skill/power | add Curse + Status (Quest later) |
| **Presets**: save/load/delete + **Revert to Vanilla** | per-file save (disk/GitHub) + bundled base | add named presets + per-card/file revert-to-bundled |
| **Creator**: custom cards + custom art from disk | add card ✅; `art` field exists | render art + upload/asset pipeline |
| Hotkey / localization / GIF / foils | n/a (web) / later | low priority |

### Effect schema v1 (the parity target — every knob a field)

Each effect op gains optional orthogonal wrappers (default = immediate / unconditional):
```jsonc
{ "op": "damage", "value": 6, "scope": "enemyActiveTarget",   // (what + target — have)
  "trigger": "onPlay",            // onPlay|turnStart|turnEnd|onGainBlock|onDamageDealt|
                                  // onDamageTaken|onDraw|onDiscard|onExhaust|onCardPlayed|
                                  // onEnergySpent|onDeath|fatal  (+ everyN, expireOnPlayed)
  "duration": { "kind": "turns", "n": 2 },        // thisTurn|thisCombat|turns:N|untilPlayed
  "scaleBy": { "event": "cardsPlayed", "window": "thisTurn", "filter": { "cardType": "attack" }, "pile": null, "per": 2 },
  "condition": { "event": "cardsPlayed", "verb": ">=", "threshold": 3, "window": "thisTurn", "filter": {}, "pile": null } }
```
Trigger events are modelled on the mod's hooks (AfterCardPlayed/Drawn/Discarded/Exhausted/
Retained, AfterBlockGained, AfterDamageGiven/Received, AfterEnergySpent, AfterPlayerTurnStart,
After-Death/Fatal). Our `effectRegistry` already pairs `apply`+`fields`; these wrappers become
shared fields rendered on every op (a "trigger / condition / scaling" sub-panel).

### Recommended build order (parity)

1. **Keyword set + replay + card types (Curse/Status)** — small, high value, unblocks content.
2. **Per-effect `trigger` + `duration`** generalized to any op (extend `fireTriggers` to all
   the events; today only turnStart/turnEnd/onGainBlock exist).
3. **Multi-variable `condition`** (replaces `bonusIf`; gates firing or grants bonus).
4. **`scaleBy` history scaling** (needs per-turn/combat event counters on the combat state).
5. **Presets + revert-to-vanilla** in the editor.
6. **Custom art** render + upload.
7. *(Decision)* **Star / 2nd resource** — only if we want it; otherwise skip (not in our model).

### Editor work implied
Keyword checkboxes + replay field; a per-effect trigger/condition/scaling sub-panel (driven by
new shared field metadata); preset save/load/revert UI; art upload + preview. All sit on the
existing registry-metadata-driven form.

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

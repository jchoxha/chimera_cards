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

**🧬🔒 MODEL REWORKED — BODY TYPES + DESCRIPTIVE SUBTYPES (2026-06-28 PM, Jeton; `docs/biology-kits.md`
§9).** The 9 biologies collapse into **3 Body Types (the FORM): Humanoid · Beast · Aberration** +
a set of **Descriptive Subtypes (composition/affliction): Mechanical · Elemental · Giant · Demonic**
(backlog: Undead/Hallowed/Feral/Ancient/Swarm/Cursed/Spectral). Subtypes apply across the whole
3-body-type **hybrid matrix** (Chimera/Anomalous/Warped) in **any combination**. **Dragonkin →
a Beast "Draconic" family** (chroma from attunement, Breath = an anatomy tag). **Aberration =
the catch-all non-person/non-animal form** (give it WIDE families). Old biology-hybrid names become
body×subtype flavor names (Cybeast=Mechanical Beast, Behemoth=Giant Beast…). **Migration is large +
not yet built — §9.3; settle §9.4 (Aberration breadth) + §9.5 refinements first.** The kit framework
below (axis-2 per body type: Humanoid→Archetype+Weapons BUILT, Beast→Family+Anatomy BUILT) still
holds — it now hangs off body types, and subtypes are a new modifier tier. *Historical: the
"biology selects the kit" framing (LOCKED 2026-06-27) and the base/condition split (§8) led here.*
**ALL 3 BODY TYPES + SUBTYPES BUILT (v3.91.0):** Humanoid (archetypes+weapons), Beast
(7 families incl. **Draconic** + **Breath** anatomy, `beastKit.json`/`beastPool.js`,
`test:beast` 276), **Aberration** (6 wide families Eldritch/Construct/Ooze/Flora/Crystalline/
Formless + 9 aberrant-feature tags, `aberrationKit.json`/`aberrationPool.js`, `test:aberration`
182). **Subtype card packages** (Mechanical/Elemental/Giant/Demonic) in `subtypeKit.json`/
`subtypePool.js` (`test:subtype` 61), stacked via `basePoolFor`. **Naming** is data-driven in
`data/biologyNaming.js` (`FAMILY_NOUN`+`FUSIONS`, reusing `BIOLOGY_SYNTHESIS`; reference list in
biology-kits.md §9.6) — Draconic+Giant="Leviathan", Mammalian+Mechanical="Cybeast", etc. The
**corner is archetype-only** with body-type catch-alls (beast-eye / eyestalk for Beast/Aberration).
**MIGRATION REGRESSIONS FIXED (v3.93.0):** stats (`biology.js` → BODY_PROFILE ×
SUBTYPE_PROFILE × FAMILY_PROFILE, legacy rows kept) + constitutions (`matchups.js`
`constitutionKeysOf` = bodies ∪ subtypes ∪ Draconic family, snapshot-`axes.*`-tolerant) are
re-keyed; the Giant subtype gates size to Large+; the Codex teaches body types + subtypes; the
card matchup banner uses `computeMatchup` (not the legacy 16-element matrix). **Pool builders
unified in `src/app/pools.js`** (App + Codex + run encounters all use it — enemies now fight
with their kit decks); `starterDeck` GUARANTEES a Strike + Defend base (kit pools without block
cards were producing defenseless 6-card decks). Balance harness re-synced to the kit era
(fs-read kits, current roster rows); enemy tier multipliers gently re-tuned (normal 0.78/0.62,
elite 1.15/0.95, boss 1.8/0.9). **FUN/FIX PASS (v3.96.0):** campfire upgrades work for EVERY card via auto-derived "+"
versions (`engine/cards/upgrade.js` `deriveUpgrade`/`upgradeFor`, authored payloads win;
`test:upgrade` 10); **subtypes grant innate TRAIT powers** (combatBridge `SUBTYPE_TRAITS`:
Mechanical plating +2 Block/turn · Undead regen-when-struck · Demonic dread Weak aura ·
Elemental turn-end discharge · Giant starts with 6 braced Block — shown as pips); the Editor
authors true hybrids (2nd body type select); flagship bestiary lore; the balance bot now reads
enemy intent + blocks (baseline ~15% bot win — a floor, players also upgrade/evolve/potion).
**Still TODO:** kit-era balance human play pass; deeper subtype rules (Giant throw/immovable).
**🔮 THE CREATURE FORGE (v3.97.0) — the vision centerpiece:** `src/data/forgeCreature.js`
`forgeCreature(concept)` — ONE prompted call authors name/lore/description/full typings/2–3
bespoke signature CardSpecs/artPrompt (+ a sanitized SVG portrait via `ai/claude.js
generateArt` when a key is present). ALL output validated + clamped (`sanitizeForgedDef`/
`sanitizeForgedCard`: axis legality, op vocabulary, numeric budgets per cost — hostile-tested).
Offline → `inferTypings` heuristics (word-boundary matching, family→body tiebreak) + template
flavor. Signature cards LEAD `basePoolFor` so the starter recipe picks them; defs persist
`signatureCards`/`portraitSvg`/`artPrompt`. CreatureCreator "Forge with AI" is the default path.
**🎬 COMBAT PRESENTATION PASS (v3.98.0):** (1) **Staged enemy turn** — `VanguardManager` split into
`endTurnPlayerHalf`/`endTurnStaged`/`_beginEnemyTurn`/`stepEnemyAction`/`finishEnemyTurn` (the sync
`endTurn()` is preserved for tests/bots); `combatStore.endTurnAnimated(stepMs=1000)` pumps ONE enemy
action per beat and publishes `enemyActing {actor,label,kind,step}` → CombatScreen shows a big
`.enemyAnnounce` banner ("Emberwisp uses Miasma") per action; End Turn disabled while acting; all
combat starts reset `enemyActing`. (2) **Card deal-in** — a `dealKey` bumped on each player-phase
start remounts the hand; the fan transform lives in the `--fanT` custom property so `@keyframes
dealIn` flies each card in from the deck (70ms stagger) and ENDS at the fan pose. (3) **Team
assembly pool view** — the creature modal shows "Starting Deck" + "Full Card Pool"
(`potentialPool`, deduped, sorted by `RARITY_POINTS`). (4) **Sizes utilized** — CardFace portrait
`<img>`s scale by `artScale(form)` (transform-origin bottom: bosses loom, babies shrink); the size
word ("Large Ironhide") shows on MiniFighter rails + the select grid; HP/Might form scaling was
already live in the generator.

**🃏 ASSEMBLY + FACTORS PASS (v3.99.0, 2026-07-06, Jeton):** (1) **Archetype is HUMANOID-ONLY,
ENFORCED** — `makeCreature` nulls `class` for any biology without Humanoid (the universal gate);
also nulled in `inferTypings`/`sanitizeForgedDef`; CreatureCreator + MonsterEditor hide the
archetype picker for non-humanoids; MonsterPage shows "Instinctive"; the dummy is now an
Aberration/Construct. `test:generate` asserts it (17). (2) **Factors are mechanically real** —
kit loaders stamp `card.factor` (anatomy tag / weapon / feature); `starterDeck` signature pick is
factor-aware (2 pool-head commons → one common per uncovered factor → fill; 4 sig slots), so a
Venom beast STARTS with a venom move. `data/factorInfo.js` `factorInfo(tag)` = kind + theme +
cards; CardFace factor icons are 22px buttons → `onInfo({kind:'factor'})` handled in CombatScreen
+ SelectScreen (popup shows the granted moves). (3) **Team assembly uses THE creature card** —
the roster grid renders CardFace tiles (`.selCardWrap.modalCardWrap`, sideTag hidden); the
creature modal is a BIG two-pane (`.selModal.big`, card+lore+stats left / `CardBrowser` right:
Starting Deck ⁄ Full Card Pool tabs, rarity-grouped with headers). (4) **Drag fixes** —
TeamManager live reorder is INSERTION-INDEX based (reading-order midpoints + 190ms FLIP cooldown;
fixes the lastOver oscillation lock, vanguard slot freely takeable); the combat hand RE-FANS over
the visible cards while one is lifted (fan computed over non-dragged cards). (5) Bugfix:
`targetHpPctBelow` authored as percent (50) in kits vs fraction (0.5) in engine — normalized in
`effectRegistry` + cardText ("5000% HP" / always-on Execute bonus fixed).
**DRAG ROBUSTNESS + BADGE CONTAINMENT (v3.99.1):** BOTH drags now track on the WINDOW (not
pointer-capture on the card node): TeamManager + CombatScreen hand bind `pointermove`/`pointerup`
to `window` while a drag is armed (keyed on the dragged id), so the ghost follows the cursor
ANYWHERE and the drag survives the live-reorder re-render (capture was being lost → the team ghost
froze once you left a small area). TeamManager only reorders while the cursor is within ~90px of
the row band; releasing in empty space snaps back. All card corner badges moved from negative
offsets INSIDE the frame: `.elem` (attunement) top/right 8px, `.submatrix` 8px, `.cost` 6px,
`.size` 7px, `.selPick` top-center (combat sideTag hidden in the roster grid).
**PHYSICAL HAND (v3.99.2):** dragging a hand card over the hand opens an INSERTION GAP that bumps
neighbours aside; releasing inside the hand commits the new order. `VanguardManager.reorderHand`
(cosmetic hand-order splice) + `combatStore.reorderHand`; CombatScreen tracks `drag.overHand`
(cursor within the `.hand` band ±74px) + `drag.insertIdx` (count of non-dragged card centres left
of the cursor, 130ms cooldown). `handList` inserts the dragged card as a full-width `.ghosted`
placeholder (opacity 0, keeps footprint) at insertIdx when overHand, else collapses it (`.dragging`
width 0 = close-ranks); FLIP keyed on `${dragId}|H${insertIdx}` animates the bump. Release: valid
target→play, else overHand→`reorderHand(insertIdx)`, else snap back.
**🎴 HAND DRAG REBUILT ON @dnd-kit (v3.99.3):** the hand-rolled window-pointer/FLIP/insert-idx/
ghosted-placeholder stack was replaced by **@dnd-kit** (`core`+`sortable`+`utilities`). CombatScreen
wraps the arena in a `<DndContext>` (`PointerSensor` distance:6 = tap-vs-drag, `TouchSensor`
delay:120): hand cards are `useSortable` items in a `SortableContext` (horizontal) → drag reorders;
units are `useDroppable` (`FoeCard`/`AllyCard` = `id`, minis via `DroppableMini` = `m:${id}`,
`unitIdOf` resolves) → drop plays. Custom `collisionDetection` prefers a unit under the pointer
(`pointerWithin`) else `closestCenter` over cards only (⚠ `args.droppableContainers` is an ARRAY,
not a Map — use `.find`, not `.get`). `onDragEnd`: over unit+valid→`play`, over card→`reorderHand(idx)`.
`DragOverlay` floats the lifted card (+hint +reaction forecast); source card `opacity:0` while
`isDragging`. `CardFace`/`MiniFighter` gained a `rootRef`/`dropRef` prop. TeamManager still uses
the DIY window-drag (untouched). Removed: the window drag effect, `useFlip` in CombatScreen,
`.dragGhost`/`.ghosted`/`.dragging`/`.pressed` CSS.
**HAND POLISH — animations back + no target-scramble (v3.99.4):** `SortableHandCard` is now an
OUTER `.moveSlot` (the sortable node — @dnd-kit owns its reorder transform) wrapping an INNER
`.frame.move` that carries the fan pose (`--fanT` by index), the StS deal-in fly-in (`@keyframes
dealIn` → transform, keyed `${dealKey}-${id}`, 60ms stagger) and the hover pop (`!important` is
safe now — different node than dnd-kit's transform). Restored the fanned hand + fly-in that the
flat-row v3.99.3 dropped. `collisionDetection` is now **pointerWithin-only** (unit → play, else the
hand card under the pointer → reorder, else none) — replacing the `closestCenter` card fallback
that reshuffled the hand while a card was dragged UP through it toward a target. `.move` base CSS
(width/margin/cursor) moved to `.moveSlot`; `.move.display`/`.move.tiny` keep their own widths.
**HAND GAP CLOSE/OPEN (v3.99.5):** the dragged card's `.moveSlot` now **collapses to width 0**
(animated, `transition: width/margin .19s`) whenever it's dragged AWAY from the hand — `collapsed =
c.id===activeId && dragAway`, `dragAway = activeId && !(overId is a hand card)`. So the ranks close
(no blank slot) when away and re-open the moving gap when the pointer returns over a hand card
(dnd-kit's single-placeholder handles that half). On away-release the collapsed slot sits at the
card's logical index, so the DragOverlay flies it back to the RIGHT spot (not the drag origin).
`useSortable` given `transition:{duration:240, easing:'cubic-bezier(.2,0,0,1)'}` so siblings glide
past instead of snapping.
**🎴 HAND REBUILT AGAIN ON SPRING PHYSICS (v3.99.6) — @dnd-kit REMOVED.** dnd-kit's sortable is
list-oriented and never felt right for a TCG hand (discrete slot swaps). Replaced with
**`src/ui/combat/HandFan.jsx`** on **@react-spring/web + @use-gesture/react** (the pmndrs card-fan
stack; researched — there is NO maintained library built specifically for a TCG hand). Each card is
a `SpringCard` keyed by IDENTITY (`${dealKey}-${id}`) with its OWN `useSpring` (declarative object
form; the lifted card gets `immediate` x/y so it tracks the finger, others `config.gentle`). The
parent `HandFan` holds one `drag` state + computes every card's fan `target` (x/rot/arc by index);
`targetFor` closes the gap when away (`gapAt==null` → `total=N-1`) and reserves a slot when over the
hand (`gapAt` from a STABLE rest-center insertion index — no feedback loop). `useDrag` (filterTaps)
per card: tap→info, drag follows, `last`→ hit-test `elementFromPoint('[data-drop-id]')` (⚠ hit-test
runs even on `last` where `down` is false; the lifted card is `pointer-events:none` so it sees the
unit under it) → valid unit=play, over hand=reorder, else spring back. Deal-in = react-spring mount
`from`(deck)+staggered `delay`. Units reverted to plain `FoeCard`/`AllyCard`/`MiniFighter`
(highlights from the reported `handDrag` state). `.handFan`/`.handCard` are absolute-positioned (no
flex layout to fight). Removed: `@dnd-kit/*` deps, `.moveSlot`/`.dragOverlayCard`/dealIn-keyframe CSS.
TeamManager still uses its own DIY window-drag (untouched).
**💥 MOVE FX — spring "juice" layer (v3.100.0):** `src/ui/combat/CombatFx.jsx` (react-spring overlay)
+ WAAPI card reactions. CombatScreen's log effect turns fresh events into FX descriptors anchored to
each unit's `[data-drop-id]` rect: a **projectile** flies `actorId`→`targetId` (from the preceding
`play` event's actor; element-tinted via `ATTUNEMENT_COLOR`/`ELEMENT_COLOR`), then a **burst** ring +
a **num** (spring pop→rise) land at the target with a ~190ms delay so they sync with the bolt's
arrival (DoT ticks have no projectile → 0 delay). The target `kickEl`+`flashEl`, the attacker
`lungeEl`, block/heal `pulseEl` — all WAAPI on the card DOM (direction from `playerIds`: enemy card
is left, ally right). Replaces the old CSS `floatUp`/`hitShake`. `CombatFx` items are pruned from
state after 1.5s. Reactions/decay render as burst+num too. **v3.100.1 fix:** the `play` actor is now
tracked in a component-level `lastActorRef` (not a per-effect-run local), so ENEMY attacks — whose
`play` and `damage` events arrive in separate `log` batches during the staged enemy turn — still
resolve the attacker node and fire the projectile + `lungeEl` (was: enemy moves showed only burst+num).
Also skips the projectile when `actorId === targetId` (self-target). **v3.100.2 fix:** FX pruning was
per-batch `setTimeout`s stored in the effect's `timers` array — but the effect's cleanup runs on EVERY
`log` change and did `timers.forEach(clearTimeout)`, so each staged enemy beat cancelled the PRIOR
beat's removal timer → FX piled up and kept flashing. Now each item carries a `born` stamp and a single
stable interval (mount-only effect) prunes items older than 1500ms; the log effect only cancels its own
`rAF`. Impact (kick/flash) delay timers moved to `fxTimersRef` (cleared on unmount only). Each FX also
gets a monotonic `fxKeyRef` id (was `Date.now()`-based, which could collide across batches and remount
react-spring nodes); the item springs use `useSpring(()=>…)` (function form) so a sibling being added
never restarts an in-flight animation.

**▶️ NEXT SESSION — BAKE THE REST OF THE PER-SIZE PORTRAITS (loop PROVEN in-session).** The v3.101.0
framework + the full generate→save→wire→verify loop are DONE and PROVEN: **`ironhide-boss.png` is baked
+ live** (v3.101.1) as the sanity sample (`sizedPortrait('…ironhide.png','boss')` → `ironhide-boss.png`,
served 200; unbaked forms fall back to base). Just REPEAT the loop for the chosen scope (sanity vs full
sweep 60). **Image generation runs IN-SESSION** — the **AGY Image Gen/Editing** MCP connector drives the
`agy` pipeline from a cloud session (VERIFIED 2026-07-07; produced a clean Variant-B boss). Loop used:
`generate_image({prompt})` → poll `get_result` → `get_image_base64` → `python3` + Pillow decode/resize to
384² PNG → `public/art/gen/<id>-<form>.png` → add form to `creatureArtSizes.json`. Prereq: the connector must be **enabled in the chat**
(`ListConnectors` → if `enabledInChat:false`, toggle it on in the chat's connector settings, else the
tools silently disappear). Load via `ToolSearch("AGY_Image_Gen_Editing")`. Async flow:
`generate_image({prompt})` → `job_id`; poll `get_result({job_id})` ~15–20s until done;
`get_image_base64({job_id})` → base64 JPEG → write `public/art/gen/<id>-<form>.png`. **Full step-by-step
plan + prompt recipe + scope options (sanity 2 imgs vs full sweep 60) is in `docs/art-pipeline.md`
§"Generating art from a CLOUD session" / §"NEXT-SESSION PLAN".** After baking: add the forms to
`src/data/creatureArtSizes.json`, verify in-browser, bump version, commit. (Also still-open from
2026-06-23: regen `tidecaller` (no portrait) + `frostmind` base portraits — same tool.)

**📐 PER-SIZE ART FRAMEWORK (v3.101.0, 2026-07-07):** size no longer rescales ONE portrait
(`CardFace` dropped the `artScale(form)` CSS `transform: scale()` — it only stretched/blurred the
image). The image renders at native size; size reads from the size word + badge. Instead each form
can have its OWN generated portrait at `public/art/gen/<id>-<form>.png` (`regular` = base `<id>.png`),
resolved by **`src/data/sizeArt.js`** `sizedPortrait(url, form)` and gated by the
**`src/data/creatureArtSizes.json`** manifest (`{ id: ["large","boss",…] }`); until a variant is baked
it falls back to the base file. Wired at every portrait render site (CardFace/SelectScreen via
CardFace, TeamManager, RunScreen, Codex, MonsterPage). Generation is size-aware: `sizeArt.js`
`FORM_ART_DESC` (mirrored in `scripts/gen_roster.py` `SIZE_DESC` — run `--sizes` / `--form=baby,boss`)
draws a Baby small/cute vs a Boss colossal, and `forgeCreature.js` stamps a size-aware
`artPromptBase`/`artPrompt`. **Images still need the `agy` Windows env to bake** (docs/art-pipeline.md
§Per-size portraits); the JS framework + prompts are done so a `<id>-<form>.png` + a manifest entry
just works.

**🧬 PRIOR FRAMING (2026-06-27) — BIOLOGY SELECTS THE KIT SYSTEM.**
The **archetype/Class system (Warrior/Rogue/Mage/…) applies ONLY to Humanoids**; every other
biology gets its own native kit system, so **Biology is the primary card-pool selector**
(it answers what Class used to: "where do this creature's cards come from?"). Attunement +
size stay orthogonal. **Resolved framework decisions:** (1) **axis-2 is biology-conditional
AND multi-valued** — keep all 3 tag slots; the 2nd slot's vocabulary depends on biology
(Humanoid→Archetype, Beast→Family, Mechanical→Chassis…) and a creature holds **one axis-2 tag
per biology base**, so a **Beast|Humanoid carries BOTH an Archetype tag and a Beast Family
tag**. (2) **Beast uses BOTH Families + Anatomy** — Families = **basic scientific animal
classes** (Mammalian/Reptilian/Avian/Piscine/Insectoid/Amphibian), Anatomy = **noun** tags
(Claws/Teeth/Beak/Horns/Tail/Hooves/Wings/Quills/Venom/Hide/Shell + Roar) that build the pool
bulk. (3) **4–6 sub-types per biology** to start, stepping through each (Dragonkin = Anatomy +
4–6 Flights keyed to colours that mesh with the attunement matrix). (4) **Hybrids = elegant
UNION of BOTH biologies' tags/kits — no primary/secondary** (budgeting TBD). (5) **Beast is
built first.** Full framework + per-biology seeds + generator/§14 impact in
**`docs/biology-kits.md`** — read before touching the §7 generator. **BEAST IS BUILT
(v3.85.0):** 6 Families + 12 Anatomy tags, 50 cards in `src/data/beastKit.json`, loader
`src/engine/cards/beastPool.js` (`beastPool({family,anatomy})`), `test:beast` (245); wired into
generation via app-layer `basePoolFor` (biology selects the base pool, injected into
`buildRoster` so roster.js stays JSON-free) + Editor Monster-page Family/Anatomy pickers.
**HUMANOID IS BUILT (v3.88.0):** Archetypes (existing) + a **Weapons** special-factor system
(12 weapons, 28 cards in `src/data/humanoidKit.json`, loader `humanoidPool.js`, `test:humanoid`
159), gated by archetype proficiency, wired through `basePoolFor` + Editor weapon pickers —
exactly parallel to Beast anatomy. **Card display (v3.86–3.88):** size moved into the name
("Large Ironhide"); top-left corner shows ONE kit icon per biology (hybrids show both); under
the name, the synthesised biology name (Beast|Humanoid → "Chimera", via `biologyName`) sits left
and special-factor icons (Beast anatomy / Humanoid weapons) right. **Next biology to author:
pick from Undead/Dragonkin/Mechanical/etc.** (the §3 seeds).

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

**🧬 IN PROGRESS (2026-06-21): the 3-axis Synthesis Matrix.** Moving from the single
16-element `type` axis to a **three-axis creature taxonomy** — **Class** (8 bases →
36 named), **Biology** (9 → 45), **Attunement** (13 → 91, REPLACES the old 16
elements). A creature carries **1–2 bases per axis** (the §1.1 "1–2 types" cap is now
**per-axis**). All three axes drive combat matchups (layered magnitudes). The matrices
are *naming/synthesis* tables; the goal is a **generative ruleset** that derives a full
monster (stats/deck/AI/matchups) from a triple. **LOCKED source data** (axis bases,
hybrid names, class→attunement legality + `synthName`/`legalAttunements`/
`attunementComboLegal`) is in **`src/data/synthesis.js`** (generated verbatim from
`Synthesis_Matrices.xlsx`). The full derived ruleset is **`docs/synthesis-matrix-spec.md`**
— design **locked through §6** (1–2 bases/axis, no per-axis weights, ≥1 legal attunement,
attunement-only self-resist, cross-axis game theory). **Combat matchups REWORKED
2026-06-21 (Jeton):** TWO layers, BOTH keyed on attunement — (1) attunement→attunement
(×1.5/.66) and (2) **biology→attunement constitution** (×1.25/.8: a biology is innately
weak/resistant to certain ELEMENTS), with an **override** (a creature attuned to the
incoming element cancels its biology weakness; self-resist applies). **Class has NO
matchup effect.** This engine is **IMPLEMENTED + tested** in `src/engine/content/matchups.js`
(`computeMatchup` returns a breakdown for the live UI readout; `npm run test:matchups`, 19
checks) — relationship NUMBERS are still REVIEW/tunable. The status/reaction system (§5)
and the generator profiles/templates (§7) are **DEEP-EXPLORATION-PENDING** — build them
**data-driven/swappable**. **Fusion/breeding PAUSED** (§6). Next code: data-model
migration (add `class`/`biology` to Fighter; `attunementsOf` seam already accepts both
shapes) → wire `computeMatchup` into `computeAttackDamage` → generator (§7) → UI (§9).

**🃏 DECK-GEN + RARITY DESIGN LOCKED (§14, 2026-06-22, Jeton).** The §7 generator's
**deck step** is now designed (`docs/synthesis-matrix-spec.md` §14): three planes of axis
interaction (**stat affinity** Class×Biology · **card content** Class×Attunement · **emergent
combos** all three); a creature's **potential pool** = class pool (attunement-skinned) ∪
attunement signature sub-pool (≈4–6 cards) ∪ biology trait cards (+ free passive). **Starter
recipe:** 4 Strike + 4 Defend (same mechanics, class-reworded, attunement-skinned) + 2–4
class-signature starters (~10–12 cards). **One `generateDeck(triple,{mode})`** serves dungeons
(`starter`→grow via rewards) AND open world (`full` deck built by **free deckbuilding vs a
rarity-weighted budget**, §14.6). **Card rarity UNIFIED onto the 7-tier monster ladder**
(`common…godly` + `basic`).
**STEP 1 IMPLEMENTED (v3.18.0):** the rarity ladder is live everywhere — `types.js`
(`CardRarity`/`RARITIES`/`LOOT_RARITIES`/`RARITY_POINTS`), `cards/rarity.js` (reward roll now
distributes a "rare-or-better" hit across `rare…godly` per-room via `HIGH_TIER_WEIGHTS`/
`pickHighTier`, pity offset unchanged), `content/adapt.js` (`mapRarity` is now pass-through →
reward pool keeps true epic/mythic/legendary/godly tiers), `ui/combat/frames.js` (frame tints
realigned to the canonical `forge.js` palette, monotonic up the ladder), the editor rarity
dropdown (driven by `RARITIES`), and a sample Warrior re-tier (Rampart/Juggernaut → epic).
First gameplay change of the synthesis direction → version bumped. **Next:** Step 2 =
`generateDeck` + `starter:true` flags + rework `starterDeck()`; Step 3 = open-world budget
deckbuilder (ships with capture mode). All suites green (test:run 49, test:engine 20, etc.).

**⚔️ ATTUNEMENTS WIRED INTO COMBAT — chunk 1 (v3.19.0, 2026-06-22).** A creature's
attunement now shapes its kit (Jeton's model): (1) **every card carries an explicit damage
element** (`card.attunement`) shown in the auto-text ("Deal 6 **Physical** damage" via
`cardText.describeCard`); the matchup (`effectRegistry.matchupOf`) keys on the **card's**
element (the card states its damage type). (2) **`imbue` rider** — a card flagged `imbue:N`
(true→1) ALSO inflicts the **CASTER creature's** attunement signature status (not the card's
element): the `ATTUNEMENT_STATUS` map in `content/matchups.js` (`imbueStatusesFor`, supports
1–2 attunements) → Fire=Burn · Frost=Weak · Nature=Poison · Shadow=Vulnerable (enemy) ·
Holy=Regen (self); the other 8 attunements are mapped but **inert until their status is built**
(§5.1). Wired in the data-driven damage op (`effectRegistry.EFFECT_OPS.damage`); 6 vanilla
Warrior attacks marked `imbue:1` (Strike/Cleave/Pommel/Whirlwind/Rampage Slam/Earthshaker) so
an off-Physical Warrior's strikes gain a status. Editor has an `imbue` field; `validateCard`
checks it; **Imbue** added to the keyword glossary. `test:cardturn` 15 (+5). **Attunement
LEGALITY already correct** (`synthesis.attunementComboLegal`: an archetype accepts any combo
containing ≥1 legal base, e.g. Warrior + Physical+Fire — plus the universals Energy/Mind/Void).
**Chunk 2 (next): attunement variant access + the attunement-own card pools** (each attunement
contributes standalone cards to a creature's potential pool — §14.3 signature sub-pool).

**🛠 DECK BUILDER — the §14.6 rarity-weighted builder (v3.20.0, 2026-06-22).** A reusable,
framework-agnostic foundation for playtest decks, **open-world deckbuilding, and pre-dungeon
drafting** (Jeton: "large build that sets up the framework"). Pure logic in
**`src/engine/deck/budget.js`** (`cardCost`/`deckCost`/`canAdd`/`validateDeck`/`expandDeck`/
`deckToCounts`/`budgetForTier`; `test:deck` 20): a deck is a counts map `{baseId: copies}`;
**cost = Σ rarity points** (`RARITY_POINTS`, basic 0…godly 7); constraints = **budget cap +
per-card cap (4) + min/max size**, with a **sandbox** bypass (min-size always enforced so combat
can draw). UI: **`src/ui/deck/DeckBuilder.jsx`** (+ `deck.css`) — pool grouped by rarity (cost +
auto-text per card), your-deck steppers, a live budget meter, editable cap, sandbox toggle;
props `{pool, budget, onConfirm(deck), onCancel}` so open-world/drafting reuse it by passing a
different pool/budget. **Wired into playtest** (`src/app/App.jsx`): **🛠 Build a Deck** opens the
builder (pool = the selected archetype file) → "Fight with this deck"; **Quick Fight** still uses
the full pool; combat "Restart" replays the built deck. Duplicates get unique `baseId#n` ids
(matches `starterDeck`). **Not yet wired:** open-world + Run-start drafting (reuse the component
later); pool is the archetype file only (attunement-own cards = chunk 2).

**🎨 PLACEHOLDER ART — game-icons.net (CC BY 3.0) via Iconify (v3.21.0, 2026-06-22).** Free/
open-source stand-ins until AI art. Central manifest **`src/data/axisIcons.js`** (every id
validated against the Iconify API): `ARCHETYPE_ICON` (8), `BIOLOGY_ICON` (9), `ATTUNEMENT_ICON`
(13), `ATTUNEMENT_COLOR` (13 identity colors), + resolvers `cardIcon(card)` (move art: explicit
`card.icon`/`art` override → attacks use their attunement element, else an effect-shape heuristic)
and `creatureIcon(c)`/`creatureColor(c)` (silhouette = primary biology → attunement → archetype,
tinted by attunement). `ART_CREDIT` = the CC-BY attribution (surface in an About screen before
public release). `test:icons` (57, completeness over the locked axis bases). **Rendered:**
DeckBuilder tiles + deck rows; CombatScreen creature silhouettes + card icons now resolve from the
new axes (`elementBadge`/`cardIcon`/`CardFace`/`MiniFighter` prefer `ATTUNEMENT_*`/`creatureIcon`,
legacy 16-element `ELEMENT_ICON` kept as fallback for the old roster/`combat.html`). AI art later
swaps in via the existing `systems/art.js` + `artManifest.json` baked pipeline. **Not done:**
editor.html doesn't load Iconify (editor uses its own custom-art `<img>`); real creature portraits.

**🖼 ILLUSTRATED CARD/CREATURE ART — bundled CC0/CC-BY pixel art (v3.22.0, 2026-06-22).** Jeton
wanted *actual* TCG-style art, not symbols. Free painterly art isn't bundleable (it ships as
100MB+ zips), so we use **pixel-art** placeholders (Jeton's pick) until the AI pass. Bundled in
`public/art/` (~422 files, attribution in `public/art/CREDITS.txt`): **`items/`** = "496 Pixel
Art Icons" by 7Soul1 (**CC0**) — `S_Fire*/S_Ice*/S_Poison*/S_Shadow*/S_Holy*/S_Thunder*/…`
spell art per element + `W_Sword*/W_Dagger*/W_Bow*/W_Staff*/…` weapons + `P_Medicine*` potions +
`S_Buff*` + armor; **`beings/`** = CodeSpree "84 RPG Beings" (**CC BY-SA 4.0**) creatures. Manifest
**`src/data/placeholderArt.json`** (generated filename lists); resolvers **`src/data/artPool.js`**
— `cardArt(card)` maps **moves by category** (damage→element spell or archetype weapon · block→armor ·
heal→potion · buff→S_Buff · power→tome · draw→scroll; deterministic variant per card id) and
`creatureArt(creature)` maps **by biology keywords** (else any being), gated on the creature having
a biology. **Rendered as `<img>` (pixelated)** in DeckBuilder tiles/rows + CombatScreen move cards
(`MoveArt`) + the creature face (`CardFace`), each **falling back to the axis icon** if no art.
`test:art` (19, manifest category coverage). The axis ICONS (archetype/biology/attunement symbols)
remain game-icons. AI Variant-B art replaces all of this via `systems/art.js`. **Caveat:** the
no-biology playtest hero still shows its attunement icon (creature art needs a biology); CC-BY-SA
share-alike + the CC0/CC-BY credits must appear in an About screen before public release.

**🤖 AI ART PIPELINE VALIDATED (v3.23.0, 2026-06-22).** Trialed the `agy` (Antigravity CLI)
headless pipeline (`scripts/agy_call.py`, docs/art-pipeline.md) end-to-end: generated a **Variant-B
portrait for the Target Dummy** in ~22s (env: agy.exe 1.0.8, Python 3.13, pywinpty). Output saved to
**`public/art/gen/training-dummy.png`** (downscaled 1024²→384², ~282 KB via System.Drawing). Wired
as a Fighter **portrait**: `buildDummy` sets `meta.portrait` (= `${BASE}art/gen/...`), `mapFighter`
exposes `portrait`, and `CardFace` renders it (a smooth `.gen` `<img>`, highest priority over
creatureArt/icon). Confirms the pipeline works in this env → the path to replacing ALL pixel/icon
placeholders with generated Variant-B art. Prompt = "generate the following image and save it as a
PNG at <path>: …{Variant-B style block}". Next when batching: a manifest-driven gen loop +
WebP post-processing (art-pipeline.md §Generation plan).

**🜂 ATTUNEMENT-OWN CARD POOLS — chunk 2 (v3.24.0, 2026-06-22).** Each of the 13 attunements now
has its own standalone card pool (§14.3 signature sub-pool): **`src/data/attunementCards.json`** —
**52 cards** (≈4/attunement: elemental bolt, AoE/multi-hit, a pure status-applier, a marquee),
each applying the element's signature status. Loader **`src/engine/cards/attunementPool.js`**
(`attunementCards(attunements)` flattens the pools). A creature attuned to an element adds those
cards to its **potential pool**: `app/App.jsx` `poolForFile()` now returns `archetype cards +
attunementCards(heroAttunement())`, so the **DeckBuilder + Quick Fight** include them (Physical
Warrior gets Physical cards; pick Fire 2nd → Fire cards appear). cardArt already maps them
(per-element pixel sprite). **Status vocab extended** (`effectRegistry`): `DEBUFF_STATUSES` +=
`bleed/soak/shock/expose/confuse/decay`, `BUFF_STATUSES` += `amplify` — so these cards author +
apply + show as **pips** (cardText `STATUS_LABEL`, CombatScreen `STATUS_META`/`EFFECT_INFO`), but
they stay **INERT (no tick)** until the §5 status system. `test:attunecards` (170 checks: every
attunement has a valid, correctly-tagged pool). **Not done:** the §14.3 "variant access" half
(archetype cards re-skinned to OTHER attunements); run starter still archetype-only (attunement
cards come via the builder).

**⚡ ATTUNEMENT STATUSES NOW LIVE — §5.1 (v3.25.0, 2026-06-22).** The 6 inert signature statuses
(+ Amplify) now have real behavior, so all 13 attunements bite. Locked designs (Jeton):
**Bleed** (Physical) — DoT (HP=stacks at opponent turn-end, decays 1) **+ grows +1 each time the
carrier is hit** (multi-hit ramp); **Decay** (Void) — DoT that also strips **Block=stacks**/turn;
**Expose** (Air) — next hit ignores **all** Block, consumed per hit; **Amplify** (Arcane, self) —
next attack ×1.5, consumed; **Shock** (Energy) — carrier loses `stacks` energy at its own turn
start (symmetric); **Confuse** (Mind) — per attack, consume 1 → ~33% fizzle, else ~50% retarget to
a random unit; **Soak** (Water) — next attack vs target **+25% per stack** then clears (stack →
devastating blow; the full reaction matrix expands it later). Hooks: DoTs (Bleed/Decay) in
`VanguardManager._tickStatuses` dots; Shock in `_applyShock` at both turn starts; Expose in
`resolve.applyDamage` (block-bypass); Soak/Amplify/Confuse/Bleed-grow in `effectRegistry`
`EFFECT_OPS.damage`. `stackingFor` + `LIVE_STATUSES` updated (new statuses = intensity, no turn
countdown); `debuff` op uses `stackingFor`. Combat tooltips (`EFFECT_INFO`) describe the live
behavior. `test:statuses` (16). **Caveats:** these resolve in the **CardSpec/effectRegistry** path
(player + data-driven enemies); the **legacy `applyCardEffects`** path (old roster enemies) doesn't
grow Bleed / apply Soak/Confuse yet. Shock's effect on the **enemy AI** is limited (the planner
doesn't re-check energy). Next attunement work: §5.2 **reactions** (Soak is the universal primer),
then §14.3 variant access.

**🔄 ATTUNEMENT TUNING ROUND 1 (v3.26.0, 2026-06-22, Jeton feedback).** (a) **Type conversion
(§14.3 variant access) — DONE:** `src/engine/cards/reskin.js` `reskinDeck(cards, attunement)`
converts **~75%** of a creature's archetype cards to its **primary attunement** (deterministic
per card, ~25% keep native Physical), so an Energy Warrior mostly deals Energy (matchup + imbue +
displayed damage type + art all follow). Wired in `app/App.jsx` `poolForFile()` (DeckBuilder/Quick
Fight) + `deckFromFile()` (run); attunement-OWN cards are NOT re-skinned. (b) **Bleed reworked:**
tick damage = **stacks × times-hit-that-turn**; hit 0 times → Bleed falls to 0; else decays 1.
Hit counter `f.hitsTaken` in `resolve.applyDamage`, consumed+reset in the dots tick (removed the
old +1/hit grow). (c) **Decay reworked:** each tick now also **strips 1 stack of every buff**
(strength/dexterity/regen/amplify) **AND removes one active Power** (`f.powers.pop()`) on top of
HP+Block — devastating vs buff/power decks. Void cards rebalanced **more expensive / lower decay**
(Entropy→cost 2 / 2 decay; Bolt/Annihilate→1 decay; Annihilate cost 3) since Decay is now potent.
`test:statuses` 20.

**🔄 ATTUNEMENT TUNING ROUND 2 — Shock v2 + Expose v2 (v3.27.0, 2026-06-22).** Both reworked into
SYSTEM mechanics (`test:statuses` 24). **Shock v2** (replaces the old energy-drain): while a side
has Shocked creatures, its **active Vanguard pays +1 energy per Shocked creature** on that side
(`_shockTax`, added to card cost in `play()` + the enemy play loop); each turn Shock also **DoTs HP
= stacks** and its stack changes by **(N−1)** (N = Shocked creatures on the side) — **persists at
N=1, GROWS when spread to 2+** (capped 9), in `_tickStatuses`. Fixes the old "3 = nullify."
**Expose v2:** block-ignore is now a **window** (while Expose > 0 ALL hits ignore Block, NOT
consumed per hit) that **decays 1/turn** (moved out of INTENSITY_STATUSES); when a creature's
**Expose > its HP** it is **force-swapped to the bench and locked** from returning until HP > Expose
(`_exposeLocked`/`_checkExposeLockout` run in `_resolveDeaths`; `swap()` + death-replacement
`_firstIncoming` skip locked units) — unless it's the last creature. Combat tooltips updated.

**✅ ALL 13 BASE ATTUNEMENTS BUILT OUT (v3.28.0, 2026-06-22).** Consistency fix: the engine made
12 signature statuses tick, but `ATTUNEMENT_STATUS.live` flags hadn't been flipped, so **imbue**
(a marked attack also applying the *creature's* attunement status) still only fired for the
original 5. Flipped Physical/Water/Air/Energy/Void/Mind/Arcane → `live:true`, so imbue now grants
all 12 (a Physical creature's imbued strike applies Bleed, Water→Soak, Energy→Shock, etc.).
**Stone is the lone intentional exception** — its signature (Fortify) is a slot-bound Block aura,
not a creature status, so Stone's identity comes from its Block cards, not an imbue rider. Each
attunement now has: matchups (§4) + icon/color + own card pool (§14.3) + a working signature
status (imbue + own cards) [Stone = Block]. `test:statuses` 27. **Attunements are complete →
ready for §5.2 reactions** (Soak = the universal primer). Reaction DESIGN locked in
`docs/mechanics.md` (master mechanics registry; engine deferred — statuses stand alone).

**🎯 FOUR-FRONT REACTIONS FOLLOW-UP (v3.44.0→v3.47.0, 2026-06-24, Jeton: "do all of those").** A
sweep across reactions, balance, content, and AI. (1) **Balance harness** — rebuilt the v3.40 harness
as a COMMITTED tool (`src/engine/run/__balance__.mjs`, `npm run balance`): full-run autoplay sims with
deck growth + a `--no-react` control. Finding: reactions are net slightly **player-positive** (the side
that attacks into statuses more — the player — benefits), so the v3.44 reaction-seeking AI did NOT
regress balance; the greedy bot is a weak lower bound, so no enemy-HP retune. (2) **Player reaction
preview (v3.45.0)** — `forecastReactions` (non-mutating verb+magnitude) drives a drag-time readout in
CombatScreen ("Combust · 8 dmg", "Freeze · Expose +3") so reactions are a deliberate player choice, not
a surprise. (3) **§14.3 variant access (v3.46.0)** — `reskin.js` `attunementVariants` re-elements a
multi-attunement creature's archetype ATTACKS to its OTHER attunement(s) as distinct `@<Att>` pickable
cards; wired into the deck-builder + reward pools (Quick Fight stays lean). A [Physical,Fire] Warrior now
builds either-element strikes. (4) **AI difficulty tiers (v3.47.0)** — `AI_SKILL`
(basic/normal/sharp/expert) gates reaction-seeking, type-swaps, defensive block + a per-action misplay
chance; tier derives from room (combat→normal, elite→sharp, boss→expert) with a floor ramp in
`startRunCombat` (early fights `basic`). New `test:reskin` 9; `test:aireact` 6; `test:reactions` 30; all
suites green (test:turn pinned to `expert` where it asserts optimal play). Remaining AI-plan threads:
forecast bluffing + value-of-Peek modelling.

**🧠 AI SEEKS REACTIONS + REACTION TUNING (v3.44.0, 2026-06-24, Jeton).** Follow-up to the reactions
engine: tuned the matrix and taught the enemy AI to play around it. **Tuning (locked):** (1) **detonate
consumes / amplify keeps** — burst cells (Combust/Steam/Melt/Ground/Freeze/Purge-Smite/Gale…) consume
their primer; amplify/spread cells (Flare-up/Fester/Collapse/Conduct/Sunder/Frostbite…) leave or grow it;
(2) **magnitude scales with primer stacks** (`c.stacks`) — bigger DoT/debuff before popping = bigger
reaction (flat cells Ground/Smash/Freeze/Melt/Transmute-confuse now scale); (3) **Soak stays a per-cell
primer** (its own Steam/Bloom/Freeze/Electrocute), NOT a universal amplifier. **AI reaction-seeking**
(`VanguardManager._generateEnemyPlan`): a pure `previewReactions(target, element, extraStatuses)` estimate
(in `reactions.js`) lets the planner score each attack by raw HP loss **+ its reaction value**, so it
prefers a reacting element over a slightly-bigger raw hit and counts a detonation burst toward lethal; a
new **Rule 3.5** **sets up its own primer** within one turn (play a debuff that applies a status the hand
can detonate, then the follow-up attack — `plannedPrimers` carries the queued status so the chain scores
and lands in sequence at execution). `test:reactions` 25 (+previewReactions/scaling/consumption),
**new `test:aireact` 4** (planner prefers/sets up reactions). Build + lint + all suites green.

**⚛️ REACTIONS ENGINE + BALANCE/ENCOUNTER PASS (v3.39.0→v3.43.0, 2026-06-23, Jeton).** Four-front
follow-up after combat became functional. (a) **Balance** (v3.40): built a headless balance harness
(3-creature party, smarter autoplay, deck growth via rewards); the old enemy HP scaling won ~3-8%
(punishing), retuned per-tier multipliers (combat 1.0→0.85, elite 1.6/1.4→1.3/1.1, boss 2.4/1.2→2.0/1.0,
floor ramp 4%→3%) to land the baseline at ~33% win-to-boss — fair, skilled play does better.
(b) **Curated encounters** (v3.41): `encounters.js` `BANDS` (early/mid/late + elite/boss) replace the
random full-roster draw so difficulty/theme don't swing; floor depth picks the band. (c) **§5.2
REACTIONS ENGINE BUILT** (v3.42): `src/engine/cards/reactions.js` — data-driven `REACTIONS` table
({element:{statusId:cell}}) + `fireReactions()`, ~30 first-pass cells across all 13 attunement verbs
(Fire detonates, Water spreads, Energy conducts, Void devours, Frost freezes, Holy purges, Shadow
corrupts, Arcane transmutes, Air disperses…). Fires in `EFFECT_OPS.damage` after a hit lands, before
Soak's standalone clear + imbue (reads pre-attack primers); keyed on the card's element; symmetric;
PURE UPSIDE (statuses stand alone). UI: a `reaction` log line + floating verb label. `test:reactions`
(17); standalone-status + replay tests use a non-reacting Stone strike to isolate. **NUMBERS are
REVIEW/tunable.** (d) **Discoverability** (v3.43): the attunement axis-info modal lists every reaction
that element triggers. Verified the FULL run loop end-to-end headlessly (no crashes/hangs). **Loose
ends still open:** §14.3 variant access (reskin to OTHER attunements) + run-start deck drafting are
features for a focused pass; legacy `applyCardEffects` reaction parity is now **obsolete** (the active
app.html game is 100% CardSpec). All suites green.

**🐞 ROGUELIKE BUGFIXES + COMBAT QoL (v3.37.0→v3.38.0, 2026-06-23, Jeton).** (a) **Enemies did
nothing** (critical): the AI planner (`VanguardManager._generateEnemyPlan`) read the legacy flat
`effects` shape and `executeEnemyAction` ran cards via `applyCardEffects`, so CardSpec (roster)
enemies forecast an EMPTY turn and never resolved. Added `effSummary()` to normalize CardSpec
op-lists for planning (dmg/block/applyStatus/buff/draw/energy/scope) and routed enemy CardSpec cards
through `applyCardSpec`. (b) **Menu mid-combat → resume marked the fight complete:** `travel`
committed the combat node `visited` on arrival. Now combat/elite/boss nodes are marked visited only
on WIN (`markVisited` action), and `runStore.loadSaved` RE-ENTERS an un-won combat node. (c) **No new
run / dead-save:** death now `clearSave()`s and the run-over screen has a **New Run** button
(`onNewRun`→select). (d) **Combat QoL:** Enemy-Intent modal shows numbered steps + arrows, button
pinned to the bottom of the foes rail; move info modal shows card **art**; the **drag ghost** is a
faithful copy (no squish); a **playtime timer** in the topbar + **log timestamps** (playtime + local
clock; events carry `_ts`, store carries `startedAt`); the **version chip opens a changelog modal**
(`src/data/changelog.js`, in both combat + menu). `test:run` 51; all suites green.
**v3.39.0 follow-up:** verified the FULL run loop end-to-end headlessly (8 seeds, 29 fights, no
crashes/hangs, proper win/loss) now that enemies act; then added **varied floor-scaled encounters**
(`enemyForNode`): elites = a beefy pair, bosses = leader + bench lieutenant, normal fights can spawn
a 2nd foe on floors ≥5, enemy HP ramps with depth (`floorMult`). Multi-enemy combat resolves cleanly.

**🧹 COMBAT DECLUTTER + CARD SYMMETRY (v3.36.0, 2026-06-23, Jeton mobile feedback).** (a) **Card
size symmetry:** the foe featured card sat in a `.foeSide` wrapper with a forecast strip, so its
height basis differed from the ally card (foe looked bigger). Removed the wrapper/strip — both
featured cards are now direct, identical children of `.cardsRow`. (b) **Declutter:** removed the
center **Peek bar**, the per-monster **forecast strips**, and the always-on **combat-log panel**.
Enemy intent + Peek now open from an **'Enemy Intent'** button under the foes bench; the log opens
from a **'Combat Log'** button under the team bench — both render in the unified modal (new
`intent`/`log` kinds; `.benchBtn`). The hand stays on-screen (primary interaction; the user mused
about moving it but it would hurt play). (c) **Load reflow:** `<iconify-icon>` is 0×0 until its SVG
loads, growing the layout on load — reserved a 1em box (`width/height:1em;flex:none`) in
combat/run/select. (d) **Balanced stance** is the default and no longer renders as a status pip (it
showed on every Warrior); stance-set cards still read "Enter <X> stance". All builds/lints + combat
node suites green.

**🎨 APP-WIDE UI COHESION PASS (v3.35.0→v3.35.2, 2026-06-23, Jeton).** The run/meta layer + menu
were plain dev forms clashing with the ornate combat skin; closed the gap. (a) **Run-layer reskin**
(`ui/run/run.css` rewritten + `RunScreen.jsx`): gilded skin (gold/ink vars from combat.css are global
on app.html, Cinzel/Spectral), the **act map is now a descending spire path** (connecting spine,
Iconify node icons in gold medallions, clear current/visited/next), the **party bar** gains creature
**crests** (`creatureColor`/`creatureIcon` or AI portrait) + styled HP bars + Iconify gold/relic/potion
icons (was identical emoji dots), and all room/reward/shop/event headers use themed glyphs. (b) **Menu
cleanup** (`app/App.jsx` + `app.css`): lead with the **roguelike run** (primary CTA), then Card Forge;
the playtest deck/attunement/dummy knobs are tucked behind a collapsible **Playtest Combat** disclosure
(collapsed by default). (c) **Combat feel pass 2** (`CombatScreen.jsx` + `combat.css`): transient
**YOUR TURN / ENEMY TURN** banner on handover, status **pips pop in**, the **energy orb pulses** on
change (keyed remount), and the **Peek button glows** while a charge is available. All builds/lints
green; combat node suites green. **ART TODO (`docs/art-pipeline.md`):** tidecaller (no portrait → icon
fallback) + frostmind need regen via the `agy` env (Windows, not the web session).

**📱 COMBAT UI MOBILE + FEEL PASS (v3.34.1→v3.34.6, 2026-06-23, Jeton).** Follow-up polish across
four fronts. (a) **Version visibility:** `APP_VERSION` now renders in the app-shell menu subtitle
(`app/App.jsx`) AND the combat topbar (`CombatScreen`) — the new `app.html` never showed it (only the
legacy `index.html` prototype did), so there was no way to confirm the live build. **Note for future
sessions: the GH-Pages ROOT url serves `index.html` (old prototype); ALL new engine/combat work is at
`/chimera_cards/app.html`.** (b) **Responsive cards:** `.combat` height changed from a fixed 296px min
(which overflowed short phone landscape) to `height:100%` capped by `max-height` so cards fill the row
and shrink on mobile; the modal creature card got an explicit wrapper height so its flex art can't
collapse. (c) **Mobile rails:** short-landscape (`max-height:440px`) media query slims the foe/team
rails, compacts mini-fighters, and stacks the energy orb above End Turn. (d) **Hand usability:** the
pressed (held) card pops up, the drag ghost is bigger + shows effect text, playable cards get a glowing
cost orb. (e) **Combat feel:** NEW — floating damage/heal/block numbers + a hit-shake, spawned from the
event stream and anchored to the target's `data-drop-id` card (`floaters` state + rAF effect in
CombatScreen; `.floatNum`/`.hitShake` CSS). (f) **Targeting/log:** log starts collapsed on phones;
bench drop targets enlarge while dragging. All builds/lints green; combat node suites green.

**🖼 COMBAT CARD UI PASS + ROSTER ENEMIES (v3.34.0, 2026-06-23, Jeton).** (a) **Run combat-log
fix:** the embedded run combat (`.runCombat`) had no height, so `.cmbt`'s `height:100%` collapsed to
content height and the log grew unbounded (only in the roguelike, not the standalone Target-Dummy
fight which is the root view). Pinned `.runCombat` to the viewport (`position:fixed;inset:0`) so the
log scrolls within its panel regardless of the ancestor height chain. (b) **Uniform creature cards +
hero art:** `.combat` cards are now a FIXED size (`width clamp(168px,16.5vw,210px)` ×
`height clamp(296px,58vh,438px)`); `.inner` is a flex column and `.art` flexes to fill all slack, so
every card is identical regardless of status/axes/matchup content, and the portrait reads as a big
TALL illustration (`object-fit:cover` for gen portraits). (c) **Every card item is clickable →
info modal:** name + art + HP → creature modal; element badge + each axes token (archetype/biology/
attunement) → new `axis` modal (`AXIS_INFO` + `ATTUNEMENT_SIGNATURE`); matchup line → new `matchup`
modal; block badge + status chips → effect modal. `CardFace` gained an `onInfo` prop (wired on the
featured Ally/Foe cards; the in-modal card stays read-only). (d) **Roguelike enemies now come from
the GENERATED ROSTER** (`engine/run/encounters.js` builds `buildRoster` over the bundled card pools
and converts a seeded pick into a fresh, uniquely-id'd enemy Fighter via the new
`combatBridge.creatureToFighter`; HP scales by node tier), so foes have real axes/portraits/decks
instead of the old hand-authored `slime`/`hexer` archetypes. Build + lint + all node suites green.

**🎮 PLAYABLE DEMO (v3.29→v3.32, 2026-06-22).** `app.html` → **Choose Your Team & Descend** →
pick ≤3 creatures → play a full StS act → win/lose. Pieces:
- **All 8 archetype kits authored** (`src/data/cards/*.json`, 162 cards, `test:kits` 486). Shape
  cards (element via attunement re-skin + imbue); signature mechanics approximated with the live
  op/trigger/scaleBy vocab (Totems/Summons/Constructs/Companions → turnStart Powers; Combo/spell-
  volume → scaleBy cardsPlayed; Channel/Doom → delayed ops; Traps → onDamageTaken Powers;
  Stealth/Conjure/Mark approximated). Tweak later.
- **Generator** `engine/content/generate.js` `makeCreature(triple+pool)` + biology profiles
  (`engine/content/biology.js`); **roster** `data/roster.js` (12 creatures, all 8 archetypes,
  `buildRoster`). `test:generate`.
- **Select screen** `app/SelectScreen.jsx` (pick ≤3, shows axes+stats+flavor+portrait). **3-creature
  party** runs through the act (Vanguard+bench; `createRun`/`partyToFighters`).
- **Rewards + shop FIXED** — draft from the party's combined archetype+attunement pool
  (`engine/run/rewards.js` `draftRunReward`; run carries `rewardPool`), on the rarity ladder; the
  **shop now sells cards** (priced by rarity) + relics/potions; a **MemberPicker** chooses which
  creature gets a card. `test:rewards`.
- **Unique AI creature portraits** (Variant-B via `scripts/gen_roster.py`/agy, 384px in
  `public/art/gen/`, gated by `data/creatureArt.json`); moves keep the pixel artPool. Combat shows
  the portrait (`CardFace`) + an archetype·biology·attunement line. **(tidecaller portrait
  regenerating; icon fallback until it lands.)**

**Archetype deep-dive (Topic 5) — `docs/archetype-design.md`.** Designing all 36
**archetypes** (the taxonomy's "Class" axis — *we call them archetypes, not classes*; code
axis still literally `class`) as full StS-style character builds. Each **base** = a THEME +
signature mechanic; each **hybrid** inherits BOTH parents' themes + a bespoke mechanic (⇒
stronger, must balance). Five-stat model **LOCKED** (§13): **Might**(dmg)/**Guard**(block)/
**Focus**(effects on others)/**Resolve**(buffs gained + debuff resist)/**Speed**(tempo) + HP.
**ALL 8 BASE ARCHETYPES DRAFTED (2026-06-22):** Warrior (Stance Spectrum + Brace/Dexterity,
**locked**), Rogue (Stealth+Combo), Mage (Overload+Conjure+Channel), Warlock (Sacrifice+
Summon+Curse), Priest (Faith+Prayer+Smite), Shaman (Totem+Spread+Soak), Ranger (Mark+Trap+
Companion), Engineer (Construct+Gadget) — each a full ~26-card pool on the 7-tier rarity ladder
with `[S]` starter signatures (§14.2). Numbers provisional. The drafts surface the **new engine
primitives** to build next (Field Entities / States / Delayed Triggers / Card Generation —
§2). **28 hybrids queued after the bases lock.**

**Card editor + data-driven cards — `docs/card-editor.md` (FOUNDATION DONE).** Cards are now
**data** (op-list schema `src/engine/cards/cardSpec.js`; data in `src/data/cards/*.json`) run
through `src/engine/combat/interpret.js` (`applyCardSpec`) with Topic-1 stat scaling + the
stance rules (`src/engine/combat/stances.js`). `createFighter` gained `stats`/`stance`/
`bracedBlock`/`powers`; `applyDamage` absorbs braced block. Warrior's 27 cards authored in
`src/data/cards/warrior.json`. `npm run test:cards` (19 checks). **Card editor DONE**
(`editor.html` → `src/editor/`): list/add/delete cards, structured per-field + per-op form,
power-trigger editor, live validation, raw-JSON escape hatch; **dual persistence** —
dev-write Vite plugin (`src/dev/cardWritePlugin.js`) Save-to-disk locally + **GitHub API**
commit (PAT in localStorage) from phone/deployed + localStorage/export fallback (backend
auto-detected). Verified end-to-end (ping/save/path-escape/serves); build ships 3 pages
(index/combat/editor). **Deployed live** at `/chimera_cards/editor.html`.
**MOD #69 PARITY COMPLETE (2026-06-21):** reviewed the mod's README + decompiled `.pck`;
matched its functionality (see `docs/card-editor.md` matrix). Shipped: (1) keyword set +
Replay + Curse/Status types; (2) per-effect `trigger` + `duration` on ANY op, fired across
the turn loop (`fireTriggers`/`_fire`, `tickTriggerDurations`); (3) multi-variable `condition`
gate (`{event,verb,threshold,window,cardType}`) backed by per-turn/combat **event counters**
on each side; (4) `scaleBy` history scaling via `effectiveValue`; (5) editor presets +
revert-to-vanilla; (6) custom art library + upload + preview. Star/2nd-resource skipped
(not in our model). `test:cards` 36, `test:cardturn` 10 — **227 checks across suites.**

**ROGUELIKE POLISH PASS, DONE 2026-06-22 (v3.17.0).** (a) **Card upgrades are real** —
all 26 Warrior cards define an `upgrade` payload (`src/data/cards/warrior.json`); campfire
upgrade applies it + renames `Name+`; editor has an **Upgrade (+) panel**. (b) **Auto card
text** — `src/engine/cards/cardText.js` `describeCard()` generates a card's description from
its op-list (triggers/conditions/scaling/keywords); `cardText()` prefers derived text (manual
`text` is an optional override); `KEYWORD_GLOSSARY` + `linkifySegments()`. CombatScreen card
modal is larger with **clickable keyword chips**; editor shows live auto-text. (c) **Stance +
powers are status pips** — `extraPips(f)` renders the Warrior Stance (per-stance icon) and
registered powers (Bloodlust/Rampart…) as persistent pips; braced Block shows distinctly;
Dexterity added to status meta/glossary. (d) **First run combat fixed** — added a `start` node
at floor 0 (combat is floor 1; was unplayable when start==first combat). (e) **Endless Stamina**
→ +1 energy/turn (extraStanceStep was meaningless; stances shift via cards), **Flex** → +3
Strength + Exhaust ("this turn only" was unenforced). (f) **Starter deck ≤10** (`starterDeck()`:
4× each basic + commons, unique instance ids; rest from rewards). `test:run` 49, `test:cards` 36.

**RUN / META LAYER — playable roguelike loop, DONE 2026-06-21 (v3.16.0).** Gap-checked vs
Slay the Web (`docs/run-layer-gap.md`): our combat was deeper, but the run layer was missing.
Built `src/engine/run/` — **action-queue + undo** architecture (Slay-the-Web style): `state.js`
(serializable run: party w/ per-monster deck+hp, gold, relics, potions, map, position),
`RunManager.js` (action-descriptor queue on immutable snapshots + past/future undo/redo),
`rng.js` (mulberry32, state in run state → deterministic through undo/save), `actions.js`
(economy/inventory/deck/upgrade/reward/heal/travel/combat-result), `map.js` (seeded LINEAR
act of typed nodes), `combatBridge.js` (party→Fighters, fold HP/win-loss back, inject relics),
`encounters.js` (real archetype enemies per node), `content.js` (relics/potions/events).
Card **upgrades**, card **reward→deck**, **relics** (onCombatStart injected via the card
interpreter), **potions** (`useConsumable` wired), **gold** shop. `npm run test:run` (45).
`src/store/runStore.js` orchestrates RunManager + combat handoff + save/load (localStorage);
`src/ui/run/RunScreen.jsx` = act map + party/gold/relics bar + embedded combat + reward picker
+ rooms (rest/treasure/shop/event) + win/lose; app menu gains **Begin a Run / Continue**.
Linear act for now; branching + ascension + more content are the StS-framework build-on.

**UNIFIED APP SHELL + playable combat, DONE 2026-06-21 (v3.15.0).** New 4th page
**`app.html`** → `src/app/` (`App.jsx` main menu) connects the **Card Forge** (CardEditor)
and the **Proving Pit** (CombatScreen) — menu → editor / playtest. Playtest builds a deck
from the chosen class file (prefers the editor's live localStorage **draft** so you play
exactly what you're tuning), vs a configurable no-axis **Target Dummy**, via
`combatStore.startPlaytest`. **CombatScreen is now CardSpec-tolerant** (`isSpec`/`cardScope`
helpers: card text via `c.text`, kind/target-side/valid-targets/scope-hint all handle the
op-list shape; `frameStyle` already tolerates a missing element). CombatScreen gained
`onMenu`/`onRestart` props (Menu button + restart-playtest); auto-starts the default encounter
only as the standalone `combat.html` demo. `CardEditor` gained an optional `onMenu` button.
Build ships 4 pages; lint + dev-server module-compile verified. **Effect system
is now registry-driven** (`src/engine/cards/effectRegistry.js`): every op declares its engine
`apply` AND its editor `fields` in ONE place, so adding a mechanic = one registry entry (the
interpreter + editor both pick it up). Adds `TRIGGER_EVENTS` + `fireTriggers()` and `PASSIVES`
+ `hasPassive()`; **`validateCard` flags any non-functional card** (no effects/trigger/passive)
— surfaced as ⚠ in the editor. All Warrior powers are now functional (Bloodlust/Juggernaut =
triggers; Rampart=`blockAlwaysBraces`, Endless Stamina=`extraStanceStep` passives).
`npm run test:cards` now 24 checks (198 total across suites). **North star = Nexus StS2 mod
#69 "Card editor and Card creator"** (docs/card-editor.md parity list: custom art, author
custom statuses/keywords, etc.). **Card system now WIRED INTO THE TURN ENGINE**:
`VanguardManager.play` routes data-driven CardSpec cards through `applyCardSpec` (legacy flat
cards still use `applyCardEffects`), rejects illegal stance plays without cost, exhausts powers,
and **fires power triggers in the turn loop** (player/enemy turnStart+turnEnd via `fireTriggers`;
Brace already persists since block-decay only zeroes `f.block`). Validated headless by
`npm run test:cardturn` (7 checks — full Warrior turn: stat-scaled damage, Rampage 2×, Bloodlust
turnStart firing across the cycle, illegal-play rejection). **Store playtest path WIRED**: `combatStore.startPlaytest({ playerCards, stats, attunement,
biology, klass, enemyHp })` builds a data-driven CardSpec deck vs a **configurable enemy**
(default: a no-axis **Target Dummy** with lots of HP), and the snapshot now carries
`stance`/`stats`/`axes`/`powers` + CardSpec-safe card cloning (`mapFighter`). `npm run
test:playtest` (7 checks). **213 checks across suites.** **Next (venue = retrofit CombatScreen,
Jeton): the CombatScreen rendering** — render data-driven cards (op-list, type/cost/text) +
a stance display, and a playtest launcher (pick deck + enemy; enemy selectable later). Then
onGainBlock triggers + extraStanceStep passive in the turn loop. That live-UI step is the
first APP_VERSION bump.

**Done so far:**
- **Combat UX tweaks round 3, DONE 2026-06-19 (v3.14.0).** (a) **Live re-planning** —
  `VanguardManager` now regenerates the enemy forecast after EVERY player action
  (`play`/`swap`), so it adapts (battered vanguard → defend/swap) and a killed vanguard's
  replacement gets a real plan instead of doing nothing. Peek is now turn-wide via
  `state.peekedThisTurn` (set by `peekAll`, reset each round): once peeked, every
  re-generated plan stays revealed (spec §2 intel persistence) — no re-paying as it adapts.
  (b) **Per-monster forecast** — removed the single intent badge from the vanguard card;
  the forecast is shown as `ActionStrip`s (icons+arrows) UNDER the vanguard card and on each
  foe's status-bar mini, each filtered to that monster's own actions (`actor` match), so an
  Attack→Swap→Attack turn shows Attack+Swap on the current vanguard and the 2nd Attack on the
  incoming one. (c) **Unified info modal** — clicking any unit (mini or via a log name) shows
  the same modal: the big monster `CardFace` + deck (allies) / observed moves (foes, from the
  log). `CardFace` is now a shared component used by AllyCard/FoeCard/modal. (d) **Cards are
  clickable** — a TAP on a hand card (vs a drag) opens its card-info modal; deck/reward cards
  are clickable too. (e) **Dock pinned** — minimizing the log no longer lifts the energy/End
  Turn dock (`margin-top:auto`). Verified headless.
- **Combat UX tweaks round 2, DONE 2026-06-19 (v3.13.0).** (a) **Action labels** — the
  enemy plan slots and the enemy-vanguard intent badge now name the action type
  ("Hidden Attack"/"Hidden Block"; multi-aspect → "Hidden Special" with an "Includes:
  Attack, Block" line); hover tooltip + click both work and reveal exact numbers once
  Peeked. The engine stores `detail.effects`/`cardName` on each `PlannedAction` so aspects
  show while still hidden. (b) **Inspect any unit** — clicking a bench/active mini opens an
  info modal: allies show their full **deck**, foes show only **observed moves** (cards seen
  via the log; `play` events now carry `actorId`). Swappable allies get a "Switch In" button
  (replaces the old confirm dialog). Store exposes the player deck (`mapFighter(f,true)`);
  enemy decks stay hidden. (c) **Drag visuals** — the dragged card now follows the cursor
  (ghost x/y updates on move). (d) **Strict targeting** — drop targets are validated against
  the card's scope (`validTargetIds`); invalid targets glow red and a release there is
  rejected with a toast ("X can only target the enemy vanguard") — no more silent
  vanguard-retarget. Verified headless.
- **Combat UX overhaul, DONE 2026-06-19 (v3.12.0).** `CombatScreen.jsx` + `combat.css`:
  (a) **fixed the landscape cutoff** — `.cmbt` itself lacked `box-sizing:border-box` (the
  `.cmbt *` reset skips the element), so `width/height:100%`+padding overflowed; reset now
  `.cmbt,.cmbt *`. (b) **Drag-to-target card play** — cards are no longer click-to-play;
  they're dragged (pointer events + `setPointerCapture`, mouse+touch) onto a target that
  highlights (`.droppable`/`.dropHover`); release over a valid target plays it. Target side
  derived from the card's scope (`cardTargetSide`). (c) **Combat log rebuilt** — persistent
  (full history, auto-scrolls), minimizable (`.logPanel`/`logHead`), and every creature /
  move / effect name is a clickable `.logEnt` opening an `InfoModal`; damage lines now say
  "takes N damage", and `status`/`block`/`heal` events are logged. Engine now emits `play`
  BEFORE effects so the log reads naturally. (d) **Swap asks for confirmation** (mini-modal).
  (e) **Enemy plan** shows `→` arrows between actions and a hover tooltip revealing each
  action's TARGET even when unpeeked (numbers still hidden until Peek). Verified headless.
- **Victory reward flow restored, DONE 2026-06-19 (v3.11.0).** `VanguardManager.generateReward(count)`
  drafts cards through the adaptive Pity-Offset engine (`cards/rarity.js`), with the card-TYPE
  distribution weighted by the SURVIVING player fighters' combined typings (spec §2A) and a
  `pickCard` resolver (`content/cardPool.js`) passed via the constructor. Store gained
  `reward` state + `rollReward`; `CombatScreen.jsx` shows a landscape OPEN-REWARD → 3-card
  overlay. Rewards are display-only (no run/deck persistence yet). Verified headless.
- **Vanguard engine → Store → UI WIRED + landscape combat, DONE 2026-06-19 (v3.10.0).**
  `src/store/combatStore.js` now wraps **`VanguardManager`** (not the old `GameEngine`/
  `CombatManager`): it builds symmetrical player/enemy `Fighter[]`, publishes an
  immutable per-render snapshot (`player`/`enemy` sides with `fighters`, `vanguardIndex`,
  energy, `enemyPlan`, `peekCharges`), and exposes `play/swap/peekAll/endTurn` actions.
  `src/ui/combat/CombatScreen.jsx` is **rebuilt landscape, no-scroll** (3-column arena:
  FOES mini-list · plan/Peek bar + featured FOE/YOU cards + fanned hand · YOUR TEAM
  mini-list + log + dock). Key fixes this milestone: (a) **Peek reveals the ENTIRE enemy
  turn for one charge** (`VanguardManager.peekAll()`) — per-slot reveal was wrong;
  (b) **status/block now visible on every unit** (mini-fighter pips + big-card chips/badges);
  (c) **content bridge fix** — `engine/content/adapt.js` now assigns each adapted card a
  `scope` (offensive→`enemyActiveTarget`, else `selfOnlyTarget`) and maps `regen`→self
  status; without a scope the resolver skipped ALL scoped effects, so player cards did
  nothing. `enemies.js` gained `makeEnemyFighter()` (archetype moves → a Fighter deck).
  `resolveScope` single-target now falls back to the default candidate instead of fizzling.
  Validated headless (Playwright) + all node smoke tests green.
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
spec — the active rebuild**), **`docs/mechanics.md` (MASTER MECHANICS REGISTRY — statuses,
the reaction framework + status×attunement matrix, keywords, AI/readout master plans)**,
`src/engine/README.md` (engine map + spec mapping; Phase 1, partly superseded by the Vanguard
spec), `api/README.md` (backend + deploy), `docs/art-pipeline.md` (art),
`experiments/art-direction/README.md`.

**⚛️ REACTIONS — design in progress (`docs/mechanics.md`, 2026-06-22).** Reactions = a
systematic **status × attunement matrix** of *interesting mechanics* (NOT just bonus damage),
fired on **attack hits, per hit, across ALL relevant statuses** in **last-updated-first** order;
consumption is **case-by-case**; power budget **both** (spice → build-defining); keyed on the
card's element; symmetric; **data-driven** `REACTIONS` table (to build). Built on the lens that
**each attunement has a reaction VERB** (Fire detonates, Frost freezes/locks, Water spreads, Void
devours, Holy purges, Shadow corrupts, Mind inverts, Physical shatters…). **Soak reframed** (REVIEW):
no longer flat +damage — the **conductive primer** that amplifies/chains reactions. First-pass
matrix authored (REVIEW, tunable). Also captured: **Combust** = consume Poison for a burst ×
turns-continuously-poisoned (needs a poison-streak counter); a generalized **predictive readout
system** to build; an **AI-reaction-awareness master plan** stub; a **status-improvement** idea
list. No code yet — iterating on the matrix with Jeton first.

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
- **✅ DONE (2026-06-19) — Wire Vanguard engine to UI & Store + victory rewards.**
  `VanguardManager` is now driven by `combatStore.js` and rendered by the landscape
  `CombatScreen.jsx` (see "Done so far"). Victory **reward flow restored** (v3.11.0):
  `VanguardManager.generateReward()` drafts via the Pity-Offset engine weighted by the
  SURVIVING fighters' combined typings; store `rollReward` + a landscape reward overlay.
  Next combat-UI candidates: animate damage/status events from the engine event stream;
  per-card target picking for future flex/any-target cards (engine + UI both currently
  front-target); "add reward card to a deck" (rewards are display-only — no run/deck
  persistence layer yet).

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

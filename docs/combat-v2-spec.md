# Combat v2 — the Squad-Round engine (LIVE SPEC, opened 2026-07-08, Jeton)

> A ground-up rework of combat from the **Vanguard/Peek** model (StS-style: you solve a full
> turn against a revealed enemy intent) toward a **Pokémon-style predictive clash**: both sides
> **commit blind**, then everything **resolves at once in Speed order**. Multi-creature **squads**
> replace the single active-vanguard + bench. This doc is the authoritative spec the way
> `docs/combat-engine-spec.md` was for v1 — read it before touching `src/engine/battle/`.
>
> **v1 is preserved** at commit `165e0a1` on `main` (the local tag `v3.108.0` marks it; tag push is
> blocked by the session's egress policy, so cite the SHA). The v1 engine (`src/engine/combat/`,
> `VanguardManager`, `CombatScreen`) stays intact and runnable while v2 is built in a **parallel
> namespace**; we flip the app over only at parity.
>
> **Legend:** ✅ LOCKED · 🔧 RECOMMENDED (default unless changed) · ❓ OPEN (needs a decision).

---

## 1. The pivot (design soul)

| | v1 (Vanguard/Peek) | v2 (Squad-Round) |
|---|---|---|
| Turn | You act fully, then enemy acts on a revealed **intent** | Both sides **commit blind**, resolve **simultaneously** by Speed |
| Core skill | *Solve the turn* (reactive puzzle) | *Predict the clash* (bluff + speed) |
| Board | 1 active Vanguard + bench, per side | up to **10 squads** per side, each 1–3 creatures |
| Intel | Peek reveals the enemy plan | **No intent/Peek** — hidden until reveal |
| Decks | one deck per creature | one **shared deck per squad**, cards owned by creatures |
| Determinism | fully deterministic | **binary hit/miss RNG** (Accuracy vs Evasion), seeded |

The genre moves from Slay-the-Spire toward Pokémon/For-the-King-style simultaneous team combat.
Reactions, statuses, and the matchup engine mostly survive but need **re-timing** (§8, §9).

---

## 2. The stat model (7 stats) ✅

A clean symmetry — three matched attacker/defender pairs + order:

| Axis | Attacker | Defender | Governs |
|---|---|---|---|
| **Damage magnitude** | **Attack** | **Defense** | how *big* an attack is |
| **Status magnitude** | **Focus** | **Resolve** | how *strong* a buff/debuff is |
| **Hit chance** | **Accuracy** | **Evasion** | whether an attack/debuff *lands* |
| **Order** | **Speed** | — | *when* an action resolves |

- **Attack** — the opposing stat to Defense. **Pokémon-style raw stat.** (was "Might".)
- **Defense** — the opposing stat to Attack. **Pokémon-style**: `damage = power × Attack ÷ Defense`
  (a raw-stat **ratio**, NOT a standalone "% less damage" modifier — Defense only matters relative to the
  attacker's Attack). ✅ Not related to Block.
- **Focus** — increases magnitude of buffs/debuffs you apply to **others**.
- **Resolve** — increases magnitude of buffs you **receive** + resistance (magnitude reduction) to
  debuffs you receive.
- **Evasion** — flat **subtraction** from an attacker's Accuracy → chance to avoid being hit by
  attacks *and* debuffs.
- **Accuracy** — base **100**. `landChance% = clamp(Accuracy − Evasion, 0, 100)`. **The floor is 0% — a
  guaranteed miss is possible** (if Evasion ≥ Accuracy) for any non-`lock-on` move; `lock-on` /
  cannot-miss cards bypass the roll entirely. Enough Evasion is a real build (a hard dodge tank) whose
  only counter is lock-on / accuracy buffs. ✅
- **Speed** — sets **resolution order** (§7). Per-creature (§4). Also decides whether your Block
  lands before an incoming hit (§7).

Accuracy / Evasion / Speed are **static creature stats that buffs/debuffs can modify** (Blind, Haste,
Smoke, True-Strike…). Attack/Defense/Focus/Resolve/HP derive from `Body × Subtype × Family` profiles
(× size), as today (`src/engine/content/biology.js`).

### Guard & Block → buffs ✅
Guard is **removed as a stat**. **Block becomes a buff** whose magnitude scales by Focus/Resolve (like
any buff): self-block `× Resolve(self)`; ally-block `× Focus(caster) × Resolve(ally)`. Block is
**temporary HP** — a pool absorbed *before* real HP.
- 🔧 **Persistence:** block persists across rounds as temp HP (no StS start-of-turn decay) — this is
  what makes **cross-turn block buffs** valuable and makes **Speed key** (a Block that resolves before
  the incoming hit actually protects). ❓ *watch for degeneracy (infinite stacking); we may cap it, add
  slow decay, or reserve true persistence to specific "lasting ward" cards. Decide during Step 3.*

### Stat derivation — raw stats, base 50 (🔧 working model, numbers tunable)
Stats are **raw Pokémon-style numbers** derived from the biology composition (`Body × Subtype ×
Family × size`), centered so a **neutral creature = Attack/Defense/Focus/Resolve 50, Accuracy 100,
Evasion 0, Speed 50** — at parity (50 vs 50) a card deals its **face value**. The existing
`biologyStats` factors (Mechanical guard ×1.4, Giant hp ×1.6…) scale the base 50 (Mechanical Defense
≈ 70, etc.). v1's `biologyStats` is untouched; v2 adds `battleStats()` beside it. Because damage uses
the **ratio** Attack/Defense, the absolute base (50) cancels at parity and only *relative* stats matter.

### The formulas (🔧 defaults, `src/engine/battle/stats.js`)
```
landChance%   = clamp(Accuracy_att − Evasion_tgt, 0, 100)   // FLOOR 0 → guaranteed miss possible ✅
hit           = seededRoll(0..100) < landChance             // binary; a MISS still spends energy ✅
                (lock-on / cannot-miss cards skip the roll)
attackDamage  = round( baseDmg × (Attack_att ÷ Defense_tgt) × matchup × stanceMult )  // Pokémon ratio ✅
                → absorbed by target Block(temp HP) → then HP
                // baseDmg = the card's LEGIBLE authored number ("Deal 8"), realized 1:1 at
                // neutral 50v50. Card FACE shows displayedDamage = baseDmg × Attack_owner/50
                // (StS-style, like Strength); Defense/matchup apply when it lands. NO "power".
debuffMag     = round( base × (Focus_caster ÷ Resolve_target) )   // landing also rolls Acc/Eva
buffMag       = round( base × (Resolve_recipient ÷ 50) × (Focus_caster ÷ 50 if caster≠recipient) )
blockGain     = buffMag   // Block (temp HP) is a buff
```
- Sure-hit / cannot-miss effects bypass the roll ✅.
- Seeded RNG (reuse `run/rng.js` mulberry32) so combat is replayable + node-testable ✅.

---

## 3. Squads ✅

- A side fields up to **10 squads**; each squad is **1–3 creatures**: **1 front Vanguard** + up to **2
  rear Support**.
- **Typical single-player: 1–3 squads**, often partial or singular; the 10-squad ceiling exists for
  intense SP + PvP/PvE. Build the data model to 10, tune encounters to the norm.
- **All three creatures can act.** **Support** creatures:
  - are **protected** (only specialized cards reach the back row — see targeting §6),
  - may provide **passive auras** (stat/effect buffs to the squad),
  - **auto-swap forward** when one of their `front` cards is played,
  - can be **repositioned without a card for energy** (a swap action),
  - **support-only cards** exist that are playable only from the back and **don't** force a swap.
- **Energy is per-squad**, base **3**, with StS-style energy-modifying cards. ❓ *flat 3 regardless of
  size, or scale with living members? (default: flat 3.)*

---

## 4. Cards & ownership ✅

**Cards are owned by / labeled with a specific creature.** This single rule resolves "who is the
caster":

- **The card's owner is the caster** → the action uses the **owner's** Attack/Focus/Accuracy/Speed,
  and (for a `front` card) **swaps the owner to Vanguard**.
- **Position model** (two orthogonal fields → the "both / neither / either" space):
  - `playablePositions: 'front' | 'support' | 'any'`
  - `swapsForward: true | false`
  - e.g. front-attack = `front`+swap · support aura = `support`+no-swap · flex utility = `any`+no-swap ·
    "charge in & buff" = `any`+swap.
- **Targeting tags** (for the dead-target ruleset, §7):
  - default = **squad-scoped** (resolves against the target's squad's live front at fire time)
  - `locked` = binds to the specific creature instance (true snipe; fizzles if it's gone)
  - `adaptive` = retargets to any valid target
- Speed lives on the **owner creature**, so an action's place in the resolution order is its owner's
  Speed (+ card priority, §7).

---

## 5. Decks ✅ (economy 🔧/❓)

- A squad has **one shared deck**, composed of cards **contributed by its member creatures**; each card
  stays labeled with its owner.
- **The members define the catalog.** The generated **potential pool** per creature (kit + attunement +
  subtype + hybrid + factors) becomes the **draft catalog**, not the deck itself. Choosing *which*
  creatures are in a squad shapes what the squad *can* run.
- **Active deckbuilding in BOTH open world and roguelike runs** ✅ — you build/grow the squad's deck
  from its members' catalogs. In runs: gain cards via rewards (drawn from the squad's catalog 🔧),
  **trim/remove cards** as a first-class strategy (campfire/shop/event removal) ✅.
- **Draw is random** ✅ — no per-creature guarantee. Want more of a creature's cards? Build the deck
  that way. A bad shuffle *can* leave a support creature idle a round; that's a deckbuilding
  consequence, and **trimming to a lean deck** is the counter-strategy.
- **Deck size** 🔧: per-creature starter ≈ **4 cards** (2 basic Strike + 1 basic Defend + 1 signature)
  → **full 3-squad ≈ 12** (StS-like). **Solo/duo bonus** so thin squads stay playable: solo ≈ 8, duo ≈
  10 (a lone creature brings a fuller personal starter). Basics are **per-creature-owned** so every
  card has a clean caster. ❓ *finalize the exact per-size numbers + the solo floor in Step 3.*
- **Hand:** per-squad, **only the selected squad's hand is visible** ✅. 🔧 fixed size **5**
  (card/relic-modifiable); Speed no longer feeds hand size. ❓ *fixed vs. a small per-squad stat.*
- Discard / shuffle / exhaust: per squad, standard.

---

## 6. Targeting ✅

- **Drag any card onto any creature card** (§10).
- **Front row is the default reachable target;** back-row Support are reached only by **specialized
  cards** (piercing / ranged / AoE / `reachesBack`). This gives front/back positioning meaning.
- Scope vocabulary carries over from v1 (the 18-token set) but is re-expressed for squads
  (this-squad / enemy-squad-front / whole-enemy-side / an aura slot…). ❓ *audit the scope tokens for
  the squad board in Step 2.*

---

## 7. The round ✅ (granularity + a couple of rulings 🔧/❓)

1. **Plan phase (blind):** each side, per squad, spends that squad's energy to queue an **ordered set
   of actions** (cards on targets). Only the selected squad's hand shows. Both sides commit; **neither
   sees the other's plan** ✅.
2. **Reveal + resolve:** all committed actions across **both** sides resolve in a **single global order
   by Speed** (per owner-creature), highest first ✅.
   - ✅ **Order key:** `(priority tier desc, owner Speed desc, seeded tiebreak)`. **Cards carry a
     `priority` field** (Pokémon-style — Quick Attack / Protect); default 0, higher resolves first,
     layered ABOVE Speed. "Order-modification effects" live here.
   - ✅ **Ties (equal priority + Speed):** **seeded coin-flip** — implemented as a per-action seeded
     random key (deterministic + fair; avoids an unstable comparator).
   - 🔧 **Granularity:** because Speed is per-creature and cards are owned, resolution is **per-action**
     (each queued card resolves on its owner's Speed tick), *not* per-squad blocks. A squad that queues
     3 cards has 3 actions interleaved with everyone else's by Speed. Readability is handled by the
     auto-focus animation (§10).
3. **Block timing** ✅: because Block resolves as an action in Speed order, a **faster** creature's
   Block lands **before** a slower incoming hit and protects; a slow Block is "too late" this round →
   value shifts toward **cross-turn / high-priority** Block. This is intentional and a core Speed lever.
4. **End-of-round step** 🔧: all DoT/Regen ticks + status-duration decrements happen here, once, after
   all actions ✅. *Later bonus:* some effects may tick at custom times (e.g. a Speed-shredding DoT that
   ticks pre-resolution) — additive polish, not v1 of v2.

### Dead-target ruling ✅ (the one you asked me to weigh — recommendation adopted)
A target can die mid-resolution (a faster action kills it first). Default behavior:
- **Squad-scoped redirect:** an attack on a now-dead creature hits **that creature's squad's current
  front line**; if the **whole squad** is gone, it **fizzles** (energy already spent).
- **`locked`** cards bind to the instance → **fizzle** if it's gone (true snipe / execute).
- **`adaptive`** cards retarget to **any** valid target.
- **Positions are live at fire time:** auto-swaps that happen earlier in the order change who is "front"
  for later incoming actions.

**Why this over pure fizzle or pure redirect:** it preserves the Pokémon-y tactics that make blind
commit + Speed matter — **focus-fire to *deny*** a slow attack (you must kill the whole squad's front
presence, not just one creature) and **bait a nuke onto a sacrificial front-liner** — while avoiding the
worst feel-bad, where a single front creature's death silently wastes an entire committed action. The
`locked`/`adaptive` tags give designers the exceptions.

---

## 8. Reactions — RE-EXAMINE UNDER A MICROSCOPE ❓

The v1 reaction matrix (`status × attunement`, fires when an attack hits a primed status) mostly still
works, but blind-commit + Speed ordering change its dynamics. Open questions to resolve cell-by-cell in
its own pass:
- **Same-round prime→detonate** now needs a **slower detonator** or a **priority combo** (the primer
  must land before the popper in Speed order). Does that make in-round combos too hard → push everything
  cross-round?
- **Consumption & ordering:** if two attacks hit one primed target in a round, the **faster** consumes
  the primer. Intended (a nice Speed payoff), but audit every "consume vs. amplify" cell under this.
- **Blind commit** means you can't *see* a primer to detonate it → reactions become **prediction-based**
  (set up a primer expecting it to survive). Does the matrix still feel discoverable?
- **AoE / multi-hit** interaction with per-target Accuracy rolls.
- Do we want a **priority tag on "detonator" cards** so combo decks can reliably pop their own primers?

Deliverable: a reactions-v2 sub-spec before Step 3.

---

## 9. AI ❓

Intent/Peek is gone, so the enemy AI must **predict** (model likely player commits + bluff) rather than
telegraph. New planner in `src/engine/battle/ai/`. Difficulty tiers carry over conceptually. Detailed
design deferred until the engine (Steps 2–3) exists.

---

## 10. UI ✅

- **Top = enemy, bottom = friendly.**
- A **semi-3D, zooming** space: every unit renders as a **full creature card**; some may be off-screen,
  but **at least one focused squad per side** is visible at once. **Carousel** to bring other squads into
  view.
- **No status-bar minis** — creatures are always their card.
- **Plan flow:** select a squad → its hand + energy show → **drag cards onto any creature card** →
  queued plan builds → repeat per squad → **Resolve**. (With many squads, an "auto/hold" for squads you
  don't want to micro. ❓)
- **Resolution:** **auto-focus/scroll to each acting creature/squad as it acts**, actions **spaced into
  a well-timed animated sequence** so an interleaved global order stays readable even across the
  carousel.
- New view: `src/ui/battle/` + a new store; the v1 `CombatScreen` is untouched.

---

## 11. Meta / squad-builder (downstream) ❓

The collection/team layer becomes a **squad-builder**: assemble creatures into squads (front/support
slots), then **draft the shared deck** from members' catalogs. The flat "team of 6" we ship today
(`SelectScreen`) is replaced/extended by squad composition. Parallel workstream to the combat engine;
spec'd separately when Steps 1–3 stabilize.

---

## 12. Staging plan (each step independently shippable, v1 stays live)

0. **Preserve v1** — commit `165e0a1` on `main` (local tag `v3.108.0`); v1 engine/UI left intact. ✅ done
1. **Stat model** — ✅ **DONE** — `src/engine/battle/stats.js` (7 stats, Pokémon ratio damage +
   `displayedDamage`, Focus/Resolve status ratios, land% floor 0, Block/buffs as temp HP; `battleStats`
   reuses v1's biology composition untouched). `test:battle` (25). `docs/game-overview.md` §Stats updated.
2. **Squad-Round engine, headless** — ✅ **CORE DONE** — `src/engine/battle/round.js`:
   commit→resolve in one global order (priority → owner Speed → seeded tiebreak), binary hit/miss,
   ratio damage → Block(temp HP) → HP, end-of-round ticks. `test:battleround` (10).
3. **Squads** — 🔨 **ENGINE DONE** — `src/engine/battle/state.js`: squad board (1–3 creatures,
   front Vanguard + Support), squad-aware targeting (default squad-scoped redirect to live front,
   `locked`/`adaptive`/`reachesBack`, auto-promote on death), auto-swap-forward, reposition. Backward-
   compatible with flat state. `test:battlesquad` (8).
   **Plan/commit + round loop DONE** — `src/engine/battle/battle.js`: per-squad energy (base 3,
   resets each round, no carry-over), `validatePlan`/`spendPlan` (blind commit ≤ squad energy),
   `flattenPlans` (both blind commits → one ordered action list), `resolveBattleRound` (validate →
   spend → resolve → win/loss via `battleOutcome`; invalid commit is a rejected no-op). `test:battleloop`
   (14). **STILL PENDING:** per-squad deck/hand **draw** (shared deck, sizing + solo floor) + the
   **reactions-v2 sub-spec**.
4. **Battle UI** — 🔨 **BUILT (iterating)** — `src/store/battleStore.js` + `src/ui/battle/BattleScreen.jsx`
   + `battle.html`. Top (enemy) / bottom (friendly). Each creature is a compact **battle token**
   (full-bleed art + name + HP + status/block pips) — the full **CardFace** opens as an enlarged info
   card ONLY after that creature's **squad is selected** (first tap selects, second opens). Front
   Vanguard **centered** between its two Support. **Semi-3D depth** (selected squad pops forward, others
   recede). Per-squad **energy pips** + selectable **hand**; **drag a card onto any token** to queue,
   with a drop **reticle** on the squad-front it will actually hit (or the specific token for
   `reachesBack`). Hand controls = **Undo · Reset · Fight** (icons, top-right). **Fight** plays the round
   back: **auto-focus** pans to each acting unit, HP bars **tween**, floating damage/block/heal/miss
   numbers. Demo cards + placeholder AI; real roster art. **PENDING:** carousel for >3 squads/side, real
   per-squad decks/hands, the AI, deeper juice.
5. **RNG polish + AI** — cannot-miss/blind status tools; prediction AI; balance pass.
6. **Squad-builder meta** + flip the app from v1 → v2 at parity.

### Open decisions still to lock (tracked)
- ~~Defense: divisor vs subtractive; Accuracy floor > 0?~~ ✅ LOCKED — Pokémon-style Attack÷Defense
  ratio; land% floor 0 (guaranteed miss for non-lock-on).
- ~~`priority` field on cards; tie-break rule~~ ✅ LOCKED — cards carry `priority` (default 0, higher
  first, above Speed); ties → seeded per-action key.
- ~~Ambiguous "power" vs legible damage~~ ✅ LOCKED — cards author concrete base damage (`value`),
  realized 1:1 at neutral stats; face shows owner-adjusted (StS-style).
- Block persistence vs decay/cap (Step 3)
- Squad energy flat vs scaling; hand size fixed vs stat (Step 3)
- Exact deck sizes + solo/duo floor (Step 3)
- Reactions-v2 cell audit (before Step 3)
- Rewards catalog scope in runs (neutral cards? only members' catalogs?) (Step 3/6)

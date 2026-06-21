# Synthesis Matrix — 3-Axis Taxonomy & Generative Ruleset

> Status: **Design locked through §6 (2026-06-21); review tables in §3/§7/§8/§9 flagged
> `REVIEW`.** Amends `combat-engine-spec.md` §1.1 (single 1–2 "type" cap → **1–2 per
> axis**) and retires the 16-element set (replaced by the 13 attunements). LOCKED source
> data lives in `src/data/synthesis.js`. **Fusion/breeding is PAUSED** (see §6).

## 0. Goal

Replace the single `element` axis with a **three-axis creature taxonomy** —
**Class** (archetype/kit), **Biology** (race/body), **Attunement** (element/affliction)
— and a **generative ruleset** that turns an `(class, biology, attunement)` triple into
a fully-specified monster (stats, deck, AI, matchups) with minimal hand-authoring.

## 1. The three axes (LOCKED source — `src/data/synthesis.js`)

| Axis | Bases | Hybrids | Total | Owns (mechanical domain) |
|---|---|---|---|---|
| **Class** | 8 | 28 | 36 | **Kit & Tempo** — card archetypes, class keyword, AI profile, attunement legality |
| **Biology** | 9 | 36 | 45 | **Body & Constitution** — stat profile, passive trait, creature-matchup |
| **Attunement** | 13 | 78 | 91 | **Affliction & Element** — damage type, signature status, reactions, primary matchup |

- **Class:** Warrior, Rogue, Mage, Warlock, Priest, Shaman, Ranger, Engineer.
- **Biology:** Beast, Humanoid, Undead, Dragonkin, Elemental, Demon, Mechanical, Giant, Aberration.
- **Attunement:** Physical, Fire, Frost, Nature, Arcane, Shadow, Holy, Void, Water, Air, Stone, Energy, Mind.

Each matrix is symmetric: diagonal = pure base, off-diagonal = the 2-base **hybrid name**
(Warrior×Rogue = *Gladiator*, Fire×Frost = *Frostfire*). The name is cosmetic; meaning
comes from the 1–2 underlying bases.

## 2. Locked decisions (2026-06-21)

| # | Decision |
|---|---|
| A1 | **1–2 bases per axis.** A creature = `{ class[1–2], biology[1–2], attunement[1–2] }`. |
| A2 | **No per-axis weights** — both bases of a hybrid are mechanically **equal**. |
| A3 | **Form** (baby→boss) stays an orthogonal 4th axis, untouched. |
| A4 | **At least one** attunement must be legal for the class (not all). A Rogue may be Shadow/Fire. (`attunementComboLegal`) |
| B1 | Matchup magnitudes: **Attunement 1.50/0.66 · Biology 1.25/0.80 · Class 1.15/0.87**, product clamped **0.25–4.0**. |
| B3 | The matchup must be **explained live in the UI** (see §10). |
| B4 | **Self-resist (0.75×) on the attunement axis only.** |
| C  | **Fusion/breeding PAUSED** (§6). |
| E1 | Rename attunement axis `types`→`attunement` (via accessor); add `class`/`biology`. |
| E2 | Cards **always** carry an attunement; may **also** be tagged as a **class card**, **biology card**, or **class+biology** card. |
| E3 | Legacy prototype (`src/App.jsx`, 16 elements) **frozen** — engine-only taxonomy. |
| E4 | Existing 108-monster roster + move list will be **sunset**; content is built fresh via the generator. |
| F1 | UI shows the **hybrid name** primary, component bases on inspect. |
| F2 | **Yu-Gi-Oh layout:** attunement type top-right of the card; "**Biology / Class**" line in the monster description. |
| G1 | First code milestone **pushes through the generator** (§5–§7) in one pass. |

## 3. Cross-axis game theory (the design core)

The three axes are **orthogonal mechanical domains** so they multiply into emergent
builds instead of overlapping:

- **Attunement = WHAT HARM** — the element of your damage and the **status** you inflict;
  reactions trigger when elements meet existing statuses.
- **Class = HOW YOU FIGHT** — your card archetypes, your **class keyword** (the engine of
  your turns), your energy/tempo shape, and your AI.
- **Biology = WHAT YOU'RE MADE OF** — your stat profile and a **passive trait**
  (immunity / on-event / innate card).

A creature is **body × kit × element**. Designed-for synergies (and anti-synergies) are
the point. Example archetypes the system should produce naturally:

| Triple | Emergent build |
|---|---|
| **Mechanical · Engineer · Stone** | Fortress: high Guard body + block-scaling kit + Fortify status → unkillable wall. |
| **Undead · Warlock · Shadow** | Attrition: can't-be-healed body + pay-HP kit + Vulnerable/Decay → grind the foe down faster than yourself. |
| **Beast · Rogue · Nature** | Tempo poison: multi-hit body + Combo kit + Poison → death by a thousand stacking cuts. |
| **Dragonkin · Mage · Fire** | Glass nuke: high-HP breath body + Overload kit + Burn → alpha-strike + lingering burn. |
| **Elemental · Shaman · Water** | Reaction engine: Attuned body (stronger statuses) + Totem kit + Soak → set up cross-element reactions. |

**Anti-synergy is legal and interesting** (Undead·Priest = a healer who can't heal
itself, leaning into ally-protection instead). The generator should *recognize* synergy
to bias card selection, but not forbid off-archetype triples.

## 4. Combat matchups (`REVIEW` — v0 relationships)

For an attack: `total = clamp( M_attune × M_biology × M_class , 0.25 , 4.0 )`. Each axis
multiplier uses the existing convention (B3): the attacker's **best** base vs the
**product** across the defender's bases. Self-resist (0.75×) applies on attunement only
(B4). Magnitudes per B1.

### 4.1 Attunement (×1.50 strong / ×0.66 weak) — `REVIEW`

| Attunement | Strong vs | Weak vs |
|---|---|---|
| Physical | Mind, Nature | Stone, Arcane |
| Fire | Frost, Nature | Water, Stone |
| Frost | Nature, Air | Fire, Energy |
| Nature | Water, Stone | Fire, Frost |
| Water | Fire, Stone | Nature, Energy |
| Air | Energy, Nature | Stone, Frost |
| Energy | Water, Frost | Stone, Air |
| Stone | Fire, Air | Water, Nature |
| Arcane | Physical, Void | Shadow, Mind |
| Shadow | Arcane, Mind | Holy, Fire |
| Holy | Shadow, Void | Physical, Mind |
| Void | Holy, Energy | Arcane, Mind |
| Mind | Holy, Physical | Shadow, Arcane |

### 4.2 Biology (×1.25 / ×0.80) — predator/prey & material — `REVIEW`

| Biology | Strong vs | Weak vs |
|---|---|---|
| Beast | Humanoid, Aberration | Dragonkin, Mechanical |
| Humanoid | Demon, Aberration | Dragonkin, Giant |
| Undead | Humanoid, Beast | Mechanical, Elemental |
| Dragonkin | Beast, Humanoid | Giant, Aberration |
| Elemental | Mechanical, Undead | Aberration, Giant |
| Demon | Humanoid, Undead | Elemental, Mechanical |
| Mechanical | Beast, Demon | Elemental, Aberration |
| Giant | Humanoid, Dragonkin | Mechanical, Aberration |
| Aberration | Mechanical, Elemental | Humanoid, Dragonkin |

### 4.3 Class (×1.15 / ×0.87) — tactical RPS — `REVIEW`

Core ring: Warrior > Rogue > Mage > Warrior.

| Class | Strong vs | Weak vs |
|---|---|---|
| Warrior | Rogue, Ranger | Mage, Warlock |
| Rogue | Mage, Priest | Warrior, Ranger |
| Mage | Warrior, Engineer | Rogue, Warlock |
| Warlock | Warrior, Mage | Priest, Ranger |
| Priest | Warlock, Shaman | Rogue, Engineer |
| Shaman | Engineer, Ranger | Priest, Mage |
| Ranger | Rogue, Warlock | Warrior, Shaman |
| Engineer | Shaman, Priest | Mage, Warrior |

## 5. Attunement statuses & reactions (D2 — fleshed out)

### 5.1 Status vocabulary

Six live in the engine today (`burn, poison, weak, vulnerable, strength, regen`). The
new set extends them; each attunement has a **signature status** it applies.

| Attunement | Status | Effect | Live? |
|---|---|---|---|
| Fire | **Burn** | HP/turn, decays | ✅ |
| Nature | **Poison** | HP/turn, does not decay | ✅ |
| Frost | **Chill** | target deals less damage (= Weak), decays | ✅ (Weak) |
| Shadow | **Vulnerable** | +50% damage taken, decays | ✅ |
| Holy | **Regen / Cleanse** | heal/turn; Holy hits cleanse a debuff | ✅ (Regen) |
| Stone | **Fortify** | slot-bound Block aura | ✅ (fortify) |
| Water | **Soak** | reaction primer; +1 to reactions on this target | new |
| Energy | **Shock** | lose 1 energy / disrupt a planned action | new |
| Void | **Decay** | lose HP *and* Block per turn | new |
| Air | **Expose** | next hit on target ignores Block | new |
| Mind | **Confuse** | target's next planned action has a chance to fizzle | new |
| Arcane | **Amplify** | (self) next spell +50% | new |
| Physical | **Bleed** | HP/turn that scales with hits taken | new |

> Implementation order: ship combat-matchups on the six live statuses; add new statuses
> incrementally (each is a small `_tickStatuses`/`applyCardEffects` addition). Not a blocker
> for the generator.

### 5.2 Reactions (`REVIEW`)

A reaction fires when an attack's attunement lands on a target carrying a primer status.
This is the cross-element depth the matrix enables (Soak is the universal primer).

| Reaction | Attune hits | Target has | Effect |
|---|---|---|---|
| **Steam** | Fire | Soak | clears Soak, +burst damage |
| **Conduct** | Energy | Soak | Shock chains to one bench unit |
| **Freeze** | Frost | Soak | clears Soak, applies Expose |
| **Shatter** | Physical/Stone | Chill | clears Chill, big bonus damage |
| **Combust** | Fire | Poison | clears Poison, damage = remaining poison |
| **Spread** | Water | Poison | Poison copies to one adjacent unit |
| **Corrode** | Void | Fortify/Block | strips Block then deals Decay |
| **Smite** | Holy | (any debuff) | consume the debuff for bonus holy damage |
| **Devour** | Void | (any status) | clears all statuses, heals attacker |
| **Sunder** | Shadow | Vulnerable | refreshes + doubles Vulnerable's bonus this hit |

## 6. Synthesis / fusion — PAUSED

> **PAUSED 2026-06-21.** With the synthesis matrices newly introduced, breeding/fusion is
> deferred until we've fleshed out how the three axes affect *combat* gameplay. Do not
> build fusion logic (pooling parents' bases, the ≤2 reduction rule, forge/fuse wiring)
> until this section is reopened. `synthName` (display naming) stays available; the
> *operation* (combine two creatures → one) is on hold. The matrices remain the future
> fusion-result tables.

## 7. Generative pipeline (G1 — build this) — `REVIEW` tables below

Given `(class[1–2], biology[1–2], attunement[1–2])`:

1. **Validate** `attunementComboLegal(class, attunement)` (A4) — else re-roll/repair.
2. **Stats** from the biology profile (§7.1) × form.
3. **Deck** from class templates (§7.2), damage-typed + status-themed by attunement,
   seasoned with biology trait cards.
4. **AI** from the class profile (§7.3).
5. **Matchups** derived live (§4) — no per-creature authoring.
6. **Name/art** seeded from the hybrid names.

### 7.1 Biology stat profiles + the stat model (D3 + D6) — `REVIEW`

**The stat model (D6):** beyond `maxHp`, biology biases a small **derived-stat vector**
that all map onto *existing* engine levers — no new combat machinery:

| Stat | Engine lever it drives |
|---|---|
| **HP** | `maxHp` multiplier |
| **Power** | starting Strength (scales attacks) |
| **Guard** | Block gained from cards (× efficiency) |
| **Recovery** | healing/Regen received (× ; 0 = can't heal) |
| **Tempo** | hand size and/or multi-hit affinity |
| **Resilience** | debuff-duration & displacement resistance |

Per-biology profile (hybrid = **average** the two vectors + carry **both** traits, A2):

| Biology | HP | Power | Guard | Recov | Tempo | Resil | Passive trait |
|---|---|---|---|---|---|---|---|
| Beast | 0.9 | +1 | 0.9 | 1.0 | +hits | 0 | **Ferocity** — gain Strength on a kill |
| Humanoid | 1.0 | 0 | 1.0 | 1.0 | +1 card | 0.1 | **Adaptable** — draw 1 extra on entry |
| Undead | 1.1 | 0 | 1.0 | **0** | 0 | poison-immune | **Undying** — first lethal → survive at 1 HP |
| Dragonkin | 1.3 | +1 | 1.1 | 1.0 | 0 | 0.2 | **Breath** — innate AoE attack card |
| Elemental | 1.0 | 0 | 1.0 | 1.0 | 0 | own-status-immune | **Attuned** — its applied statuses +1 |
| Demon | 1.0 | +1 | 0.9 | lifesteal | 0 | 0 | **Lifesteal** — attacks heal a fraction |
| Mechanical | 1.1 | 0 | **1.4** | 0 | 0 | poison/bleed-immune | **Construct** — block doesn't fully decay |
| Giant | **1.6** | +2 | 1.1 | 1.0 | −1 card | displacement-immune | **Unstoppable** — can't be force-swapped |
| Aberration | 1.0 | 0 | 1.0 | 1.0 | swingy | mind-immune | **Mutate** — random buff each turn |

### 7.2 Class card templates + keywords (D4) — `REVIEW`

Each class = a card archetype + a **keyword** (the turn engine). Cards get their damage
type/status from the creature's **attunement**; the *shape* comes from the class.

| Class | Keyword | Card shapes (attunement fills the element/status) |
|---|---|---|
| **Warrior** | **Brace** (block partly carries; on-hit Strength) | sturdy attacks, block, Strength scaling |
| **Rogue** | **Combo** (2nd+ card each turn deals bonus) | cheap multi-hits, the attunement status, draw |
| **Mage** | **Overload** (X-cost / spend-all nukes) | big single-target + strong status application |
| **Warlock** | **Sacrifice** (pay HP → power; curses) | self-damage payoffs, debuffs, drain |
| **Priest** | **Faith** (effects scale with healing done) | heal, Regen, cleanse, protect/block an ally |
| **Shaman** | **Totem** (persistent `fortifySlot` auras) | DoTs, slot auras, status spread |
| **Ranger** | **Mark** (bonus vs marked; reaches bench) | piercing/bench targeting, mark, setup |
| **Engineer** | **Construct** (gadgets + scaling block) | block-scaling, one-shot gadgets, energy |

Hybrid classes pull from **both** template pools (A2 equal), constrained by §4 legality.

### 7.3 Class AI profiles (D5) — `REVIEW`

Shifts to the version-B planner's existing priority rules (lethal → swap-advantage →
defend-if-low → best-attack → fallback). Per class:

| Class | AI bias |
|---|---|
| Warrior | defend threshold 0.5; values Block; steady pressure |
| Rogue | maximize cards/turn (Combo); apply DoT early; low defend |
| Mage | hoard energy for burst/lethal; defend low |
| Warlock | debuff-first, then burst; accepts self-HP loss |
| Priest | defend/sustain threshold 0.6; swaps to protect allies |
| Shaman | stack DoTs/totems first; medium defend; outlast |
| Ranger | focus-fire the Mark target; medium defend |
| Engineer | defend threshold 0.6; stacks block, scales late |

## 8. Data model & migration (E1/E2)

```js
// Fighter / Monster
{
  class:      ['Warrior'] | ['Warrior','Rogue'],     // 1–2 base names (no weights)
  biology:    ['Beast'] | ['Beast','Dragonkin'],
  attunement: ['Fire'] | ['Fire','Frost'],           // REPLACES `types`
}
// Card
{
  attunement: 'Fire',          // always present
  classTag?:   'Rogue',        // optional — a "class card"
  biologyTag?: 'Undead',       // optional — a "biology card"
}
```

Add an `attunementsOf(f)` accessor so the combat-math sites (`resolve.js`,
`VanguardManager`, `rarity.js`, `combatStore.mapFighter`, frames) migrate in one place;
**consolidate the duplicated element matrix** (`elements.jsx` + `VanguardManager.js`) into
`src/engine/content/matchups.js`.

## 9. UI (F1/F2/B3)

- **Card:** attunement type top-right (Yu-Gi-Oh style); description line "**Biology /
  Class**" using hybrid names; bases shown on inspect.
- **Live matchup readout (B3):** when targeting, show the three-layer breakdown, e.g.
  `Fire→Frost ×1.5 · Beast→Dragonkin ×0.8 · Warrior→Mage ×0.87 → ×1.04`, so players can
  *see why* a hit is strong/weak in real time.

## 10. Implementation sequence (after table review)

1. `src/data/synthesis.js` — ✅ DONE (source data + `synthName`/`legalAttunements`/`attunementComboLegal`).
2. `src/engine/content/matchups.js` — §4 grids + magnitudes + layered `computeMatchup()`; retire the two duplicate element matrices.
3. Data-model migration (§8) — `attunementsOf` accessor; add `class`/`biology`; card tags; snapshot.
4. Wire `computeMatchup` into `computeAttackDamage` + the AI's matchup check.
5. Generator (§7) — biology profiles, class templates, AI profiles → `(triple) → Fighter`.
6. UI (§9) — badges, hybrid names, live matchup readout.
7. New statuses/reactions (§5) — incremental.
8. Regenerate dex; bump `APP_VERSION`; reachable from CheatPanel (golden rules).

## 11. Still open (later)

- **Fusion** (§6) — reopen after combat impact is proven.
- **Cross-axis interactions** (G3) — synergies that combine *different* axes (a
  class+biology combo producing something) — the matrices don't encode these yet; explore.
- The `REVIEW` tables (§4, §5.2, §7.1–7.3) — Jeton to tune.

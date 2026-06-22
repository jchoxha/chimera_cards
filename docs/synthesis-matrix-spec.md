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
| B1 | Matchup magnitudes: **Attunement 1.50/0.66 · Biology 1.25/0.80**, product clamped **0.25–4.0**. (Class removed — see B5.) |
| B3 | The matchup must be **explained live in the UI** (see §9). |
| B4 | **Self-resist (0.75×) on the attunement axis only.** |
| B5 | **Class has NO matchup effect** (2026-06-21). Both combat layers key on attunement (B6). |
| B6 | **Biology = elemental constitution**, not a biology-vs-biology matrix: a biology is innately weak/resistant to certain *attunements*. **Override:** if the creature is itself attuned to the incoming element, its biology relationship to that element is **cancelled** (a Fire Beast isn't weak to fire); attunement self-resist applies instead. |
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

## 4. Combat matchups — IMPLEMENTED (`src/engine/content/matchups.js`)

> **Engine LOCKED, numbers REVIEW.** The two-layer structure, override, self-resist,
> and clamp are implemented + smoke-tested (`npm run test:matchups`, 19 checks). The
> relationship *tables* (§4.1, §4.2) are provisional v0 — tune freely; the engine
> doesn't change when you edit them.

**Two layers, BOTH keyed on attunement** (class removed, B5/B6):

```
for each attacker attunement a:
  mAtt = product over defender attunements of pair(a, d)      // 1.5 / 0.66 / 1.0
  if a in defender.attunements: mAtt *= 0.75                  // self-resist (B4)
  mBio = (a in defender.attunements) ? 1                       // OVERRIDE (B6)
       : product over defender biologies of bioVsElement(b, a) // 1.25 / 0.8 / 1.0
  total_a = mAtt * mBio
total = clamp( max over a of total_a , 0.25 , 4.0 )
```

The attacker takes the **best** of its attunements; the result carries a breakdown
(attune ×, biology ×, self-resist, overridden biologies, label) for the live UI (§9/B3).

### 4.1 Layer 1 — Attunement → attunement (×1.50 / ×0.66) — `REVIEW` (Jeton: "looks good")

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

### 4.2 Layer 2 — Biology → attunement constitution (×1.25 weak / ×0.80 resist) — `REVIEW` (redesigned per Jeton 2026-06-21; numbers need deep design)

A biology is innately **weak** to (takes more from) or **resistant** to (takes less from)
certain incoming **elements**. Cancelled by the own-attunement override (B6). Provisional
v0 — flavor sketch, not balanced:

| Biology | Weak to | Resists |
|---|---|---|
| Beast | Fire, Mind | Physical, Nature |
| Humanoid | Shadow, Mind | Physical |
| Undead | Holy, Fire | Shadow, Void, Frost |
| Dragonkin | Frost, Arcane | Fire, Physical |
| Elemental | Void | Physical |
| Demon | Holy | Fire, Shadow |
| Mechanical | Energy, Water | Physical |
| Giant | Mind, Air | Physical, Stone |
| Aberration | Holy | Void, Arcane |

> Some biologies also carry engine-level **immunities** via their passive trait (§7.1,
> e.g. Mechanical=poison/bleed-immune, Undead=poison-immune) — handled in the status
> system, not this matchup layer.

### 4.3 Class — **no matchup effect** (removed 2026-06-21, B5)

Class governs kit/AI only (§7.2/§7.3), not damage multipliers.

## 5. Attunement statuses & reactions (`DEEP EXPLORATION PENDING`)

> Jeton 2026-06-21: "5.1/5.2 need much deeper thought." The tables below are a v0
> starting sketch. Treat the whole status/reaction system as **provisional and
> data-driven** — keep the six live statuses working; add the rest as swappable data,
> not hard-coded special cases.

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

> **`DEEP EXPLORATION PENDING` (Jeton 2026-06-21):** §7.1–7.3 are "a fantastic start"
> but a deep area — these are **provisional**. Build the generator **data-driven** so
> every profile/template/AI-bias table can be rewritten without touching engine code.

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
2. `src/engine/content/matchups.js` — ✅ DONE (locked two-layer engine + override + self-resist + clamp + `attunementsOf`/`biologiesOf`/`classesOf` accessors + breakdown for the UI readout; `npm run test:matchups`, 19 checks). Relationship tables are REVIEW. Not yet wired into live damage. Still retires the duplicate element matrices once wired.
3. Data-model migration (§8) — add `class`/`biology` to `Fighter`/`Monster`; the `attunementsOf` seam already accepts both shapes; card tags; snapshot.
4. Wire `computeMatchup` into `computeAttackDamage` + the AI's matchup check (← first gameplay change; bump `APP_VERSION` here).
5. Generator (§7) — biology profiles, class templates, AI profiles → `(triple) → Fighter` (data-driven; profiles provisional).
6. UI (§9) — badges, hybrid names, live matchup readout.
7. New statuses/reactions (§5) — incremental, data-driven.
8. Regenerate dex; reachable from CheatPanel (golden rules).

## 12. Deep-dive design log (working queue)

Resolving the `DEEP EXPLORATION PENDING` areas in dependency order. Lock decisions
here as we go (status: ⏳ queued · 🔎 in progress · ✅ locked).

| # | Topic | Status | Locked decisions |
|---|---|---|---|
| 1 | Combat substrate & stat model (D6) | ✅ | §13: 5 stats + HP — Might(dmg)/Guard(block)/Focus(effects on others)/Resolve(buffs gained + debuff resist)/Speed(tempo); two offense/defense pairs; all damage = Might. "Resolve" locked. Minor open: F-1.1 Speed levers, F-1.3 duration. |
| 2 | Status & keyword system (§5.1) | ⏳ | must absorb keywords surfaced during class design: **Brace** (Block doesn't decay), **Dexterity** (+flat Block, block analog of Strength) — from Warrior |
| 3 | Attunement identity (damage feel + signature status) | ⏳ | — |
| 4 | Biology identity (stat profiles + traits, §7.1) | ⏳ | — |
| 5 | Archetype identity — **all 36, in `docs/archetype-design.md`** | 🔎 | Base/hybrid model locked: each base = a THEME + signature mechanic; each hybrid = 2 base themes + bespoke mechanic (⇒ stronger, must balance). 4 shared primitives (Field Entities/States/Delayed/Card-Gen). **All 8 base archetypes drafted** (Warrior locked); 28 hybrids next. |
| 6 | Reactions / cross-element depth (§5.2) | ⏳ | — |
| 7 | Cross-axis synergies (G3) | ⏳ | — |
| 8 | Generation algorithm (triple → monster) | 🔎 | §14: **deck recipe locked** — starter = 4 Strike + 4 Defend (shared, class-reworded) + 2–4 class-signature starters; one `generateDeck(triple,{mode})` serves dungeon (`starter`→grow) AND open-world (`full`+rarity-budget deckbuilding). **Card rarity unified onto the 7-tier monster ladder** (common…godly + `basic`). |

## 13. Topic 1 — Combat substrate & stat model (LOCKED 2026-06-21, names pending)

**Model: light stat line that BLENDS with deck + attunement.** Cards do the work; stats
scale card output. Damage is universal (no physical/magical split). The stats form **two
offense/defense pairs** + tempo + pool.

### 13.1 The stat line (5 combat stats + HP)

| Stat | Realm | Owns | Baseline |
|---|---|---|---|
| **HP** | — | survivability (`maxHp` pool) | — |
| **Might** | damage · offense | **all damage dealt** | ×1.0 |
| **Guard** | damage · defense | **Block** gained / damage mitigation | ×1.0 |
| **Focus** | effect · offense | potency of effects this unit applies **to OTHERS** (debuffs on enemies, buffs/heals on allies) | ×1.0 |
| **Resolve** | effect · defense | **buffs GAINED** (self) amplified **+ debuffs received resisted** | ×1.0 |
| **Speed** | tempo | energy, swap-cost discount, **Peek** efficiency, draw | 0 |

Combat stats are **multipliers centered on 1.0**, tiers **Feeble 0.7 · Low 0.85 · Average
1.0 · High 1.2 · Elite 1.4**, spent from a **balanced body budget** (strong somewhere ⇒
weak elsewhere). HP is a flatter pool (`base × biology HP tier × Form hpMult`). *Per-biology
budgets = Topic 4.*

> "Resolve" **locked** (2026-06-21). "Hex" was merged into Focus same day.

### 13.2 The blends (synergy)

1. **Focus ↔ Resolve interplay** — an effect on another unit uses the **source's Focus**,
   adjusted by the **target's Resolve** (Resolve *amplifies* incoming buffs, *resists*
   incoming debuffs). **Self**-targeted effects ("gain X Strength/Block/Regen", self-heal)
   use the unit's **Resolve only** (they are "buffs gained"). So: Focus = "I project power
   onto others"; Resolve = "what I gain and withstand." Control/support builds want Focus;
   sturdy self-buffing bruisers want Resolve.
2. **Stat × Deck** — every card is scaled at resolve time by its governing stat.
3. **Stat × Class (soft affinity)** — classes lean on stats, so coherent creatures are
   stronger (Warrior→Might/Guard, Warlock→Focus, Priest→Focus/Resolve, Rogue→Might/Speed…);
   off-profile builds are legal but weaker. Generator matches stats to class (Topic 5/8).

### 13.3 Damage & effect pipeline (ordered)

```
ATTACK, per hit:
  base = card.dmg + Strength(attacker)
  raw  = base × Might × matchup(§4) × weakMult(0.75 if attacker Weak)
                                    × vulnMult(1.5 if target Vulnerable)
  apply raw, then subtract creature Block, then fortifySlot Block;  repeat × card.hits

BLOCK:            gained = round(card.block × Guard)
EFFECT on OTHER:  potency = round(value × source.Focus × target.ResolveMod)
                  // ResolveMod amplifies buffs / reduces debuffs (target's Resolve)
EFFECT on SELF:   potency = round(value × self.Resolve)   // "buffs gained"
SPEED:            handSize/energy/swap/peek per the Speed tier (F-1.1)
```

### 13.4 Sub-forks still open

- **F-1.1 Speed's levers:** which of {energy, swap discount, Peek efficiency, draw}? *(rec: swap discount + Peek + hand size; leave the energy floor formula alone.)*
- **F-1.2 Scaling shape:** multiplier ×stat *(locked rec)*.
- **F-1.3 Duration:** Focus/Resolve scale effect **amounts/intensity + DoT ticks**, NOT debuff **duration** *(rec — avoids runaway control)*.
- **F-1.4 Resolve name:** Resolve / Spirit / Will / Ward.

## 14. Deck generation & rarity unification (LOCKED 2026-06-22, Jeton)

The §7 generator's **deck step**, plus how the three axes compose a deck and how decks
stay balanced across all classes in **both** contexts (dungeon + open world).

### 14.0 The three planes of axis interaction (the answer to "how axes interact")

Each axis has ONE job in deck-building, so they multiply instead of overlapping:

| Axis | Job | Plane it meets the others on |
|---|---|---|
| **Class** | the **shape** — card archetypes, keyword engine, AI, stat lean | — |
| **Attunement** | the **fill** — damage element + signature status on cards | **Card content** (Class × Attunement) |
| **Biology** | the **body** — stat vector + passive trait + a few trait cards | **Stat affinity** (Class × Biology) |

1. **Stat affinity (Class × Biology).** Classes lean on stats (Warrior→Might/Guard);
   biologies bias the stat vector (Giant→HP/Guard, Beast→Power/Tempo). Aligned ⇒
   naturally strong (Giant Warrior = tank); clashing ⇒ legal but weaker (§13.2.3).
2. **Card content (Class × Attunement).** Class picks a card's *shape*; attunement
   picks its *element + status*. Same shape reads differently as Fire vs Shadow.
3. **Emergent combos (all three).** class **keyword** × attunement **status** × biology
   **constitution/passive** = the §3 archetypes for free (Rogue·Combo × Nature·Poison ×
   Beast·multi-hit = stacking-poison tempo).

### 14.1 A creature's **potential pool** (what draws sample from)

```
potentialPool(triple) =
    classPool(class)              // the bulk; re-skinned by attunement (14.3)
  ∪ attunementSignatures(attun)   // 4–6 attunement-defining cards (14.3)
  ∪ biologyCards(biology)         // 0–2 trait cards (14.4); passive is FREE, non-card
```

The **starter** is a fixed slice of this pool; **rewards** (dungeon) and **open-world
deckbuilding** sample the rest of it.

### 14.2 Starter deck recipe (LOCKED) — `generateDeck(triple, {mode:'starter'})`

Every class starts with the **same skeleton**, so balance + role coverage are guaranteed,
but class identity is present from turn 1:

- **4 × Strike + 4 × Defend** — the *same mechanical* basic attack/block for every class,
  optionally **reworded/renamed per class** (Warrior "Strike/Guard", Mage "Bolt/Ward",
  Rogue "Dagger/Dodge"). `basic` rarity; **attunement-skinned** (a Fire creature's Strike
  deals fire + a little Burn). Never appear in loot.
- **+ 2–4 class-signature starter cards** — establish the class keyword from the first
  turn (Warrior: a stance-shifter + a Brace card). Marked in the class pool (a
  `starter:true` flag designating the starter subset).
- ⇒ **~10–12 card starter**, deliberately thin, with tons of progression headroom.

`starterDeck()` (`src/engine/run/state.js`) changes from "4× each basic + first commons"
to this recipe (read `starter:true` cards instead of generic commons).

### 14.3 Attunement → cards (LOCKED)

Two mechanisms, **both** used:
- **Re-skin** class cards *where appropriate*: attacks/DoTs/utility inherit the creature's
  element and apply its signature status (§5.1). Most of the deck.
- **Signature sub-pool**: a **meaningful set (≈4–6, not 1–2)** of attunement-defining
  cards across the creature's *full potential pool* — pure status-appliers, reaction
  primers (Soak), the element's marquee effects. Only attuned creatures roll these.

### 14.4 Biology → deck (LOCKED)

- **Passive trait** — free, non-card (§7.1: Undying, Lifesteal, Construct…).
- **0–2 trait cards** — Dragonkin *Breath* (AoE), Undead drain, etc.
- **Stat vector** biases output of every card it draws (§13.2).

### 14.5 Two contexts, ONE generator

`generateDeck(triple, { mode, form, rarity })` serves both; only fullness differs:

- **`mode:'starter'` (dungeon entry):** the 14.2 recipe → grow via rewards drafted from
  the creature's own potential pool, weighted by its triple, through the (extended)
  Pity-Offset engine (`rarity.js`). The StS arc.
- **`mode:'full'` (open world / capture):** a complete, immediately-playable deck **built
  by free deckbuilding against a rarity-weighted budget** (14.6), tuned to the creature's
  Form/monster-rarity. Any two captured monsters at the same tier are balanced regardless
  of triple, because the **budget**, not a fixed list, enforces it.

### 14.6 Open-world deckbuilding = rarity-weighted budget (LOCKED direction)

Open-world play is **free-form deck construction** from owned cards, balanced by a budget:
- Each card costs **deck points by rarity** (`basic` 0 · common 1 · uncommon 2 · rare 3 ·
  epic 4 · mythic 5 · legendary 6 · godly 7 — numbers REVIEW).
- A monster's **budget scales with its monster-rarity + Form** → higher-tier monsters run
  bigger / higher-rarity decks; you compose freely within budget.
- Card acquisition (drops/forge) is **rarity-weighted** using the monster ladder roll
  (14.7). (Exact budget formula = REVIEW; this is the locked *mechanism*.)

### 14.7 Card rarity UNIFIED onto the 7-tier monster ladder (LOCKED)

Cards drop the StS 4-tier scale and adopt the **prototype monster ladder**
(`src/systems/forge.js`): **`basic`** (starters — free, non-loot) **+
`common · uncommon · rare · epic · mythic · legendary · godly`**.

- **Frames** reuse the monster-rarity palette (`forge.js` RARITY_COLORS:
  common=white · uncommon=green · rare=blue · epic=purple · mythic=red · legendary=orange
  · godly=special).
- **Reward engine** (`rarity.js`) extends from binary rare/non-rare to a **weighted roll
  across the full ladder per room** (combat skews low; elite/shop higher; boss top),
  keeping the pity-offset concept (escalating chance at the *top* tiers).
- **Migration touchpoints:** `engine/types.js` `CardRarity`, `engine/cards/rarity.js`,
  `ui/combat/frames.js`, `cardSpec.validateCard`, and re-tiering the Warrior pool
  (`src/data/cards/warrior.json` — e.g. Juggernaut/Rampart → epic). Editor rarity dropdown.

> **Build order (when we code §14):** (1) unify rarity ladder + frames + reward roll
> (no gameplay change → no version bump until wired); (2) `generateDeck` + `starter:true`
> flags + rework `starterDeck()`; (3) the open-world budget deckbuilder (later, with the
> capture mode). Items (1)–(2) are the next concrete code step toward the generator (§7).

## 11. Still open (later)

- **Fusion** (§6) — reopen after combat impact is proven.
- **Cross-axis interactions** (G3) — synergies that combine *different* axes (a
  class+biology combo producing something) — the matrices don't encode these yet; explore.
- The `REVIEW` tables (§4, §5.2, §7.1–7.3) — Jeton to tune.

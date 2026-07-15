# Card Pool Composition — the deckbuilding core

*Started 2026-07-15 (Jeton: "how all our matrices impact card-pool composition / deck builds — the
fundamental core value of the game").* Companion to `synthesis-matrix-spec.md` (the axis source data)
and `biology-kits.md` (the kit systems). This doc plans **how a creature's typing turns into a deck**,
and how combining typings produces emergent archetypes. Numbers are `REVIEW` — the *structure* is what
we're locking.

## 0. The thesis

The value proposition of Chimera is: **you capture creatures, and each creature's typing determines the
cards it brings to your shared squad hand.** Deckbuilding therefore happens at *two* levels:

1. **Within a creature** — its axes compose a personal card pool (this doc).
2. **Across a squad** — you choose *which* creatures to group, blending their pools into one hand
   (formations, `formations-design.md`).

So every axis must be a meaningful *slider* on the deck, and combinations must produce recognizable
archetypes with real synergies. That emergent-combination space is the game.

## 1. The axes → what each contributes to a deck

| Axis | Values | Contributes to the deck | Also governs |
|---|---|---|---|
| **Attunement** | 13 (1–2) | element re-skin of every card + a signature sub-pool (~3–5 cards) + a signature STATUS | **matchups** (offense + defense), reactions |
| **Body Type** | Humanoid / Beast / Aberration (1–2) | *nothing directly* — it **selects the kit + factor axis** and gates hybrids | which kit system applies |
| **Kit** (per body type) | Archetype ×8 / Family ×7 / Manifestation ×6 | **the bulk of the pool + the core mechanical THEME** (the "class") | the **stat shape** |
| **Factor** (per body type) | Weapons ×12 / Anatomy ×13 / Features ×9 (hold 2–3) | **modular card CLUSTERS** — the "equipment slots" that customize inside a kit | a **stat nudge** each |
| **Subtype** | 11 (0+) | a **signature wild-card PASSIVE** + a small package that plays into it | — (no stats, no matchup) |
| **Size** | baby…boss | HP scale (+ a gentle power/cost curve) | art scale, evolution gates |

### Rough pool budget (a creature's ~12–16-card potential pool)

- **Kit** ≈ 50% — the class core: its signature mechanic cards + Strike/Defend bases (re-skinned).
- **Factors** ≈ 25% — 2–3 clusters of ~2–3 cards each (Shield→guard cards, Venom→poison cards…).
- **Attunement** ≈ 15% — the signature element sub-pool + variant re-skins.
- **Subtype** ≈ 10% — the package that supports its passive.

The point of the budget: a deck has **one clear primary identity (the kit)** with **modular
customization (factors / attunement / subtype)**. You always read a creature as "a *Fire Warrior with a
Hammer*," not a soup.

## 2. The composition pipeline (already partly built — `app/pools.js`)

```
kit base pool            (Archetype+Weapons | Family+Anatomy | Manifestation+Features)   ← body type picks this
  × attunement re-skin   (recolor kit attacks to the creature's element; imbue its status)
  + attunement sub-pool  (the element's own signature cards)
  + subtype package      (cards that feed the subtype's wild-card passive)
  + hybrid signatures    (body-pair / subtype-pair / attunement-pair bespoke cards)
  = POTENTIAL POOL   → starterDeck() carves a playable ~10-card starter → rewards/shop grow it
```

`potentialPool()` and `basePoolFor()` in `app/pools.js` already implement most of this; `kitDeckFor()`
(combat-v2) adapts the result into playable v2 cards. What's **under-built** is the *content density* per
axis and the *subtype packages* (subtypes only carry a passive today, not a card cluster).

## 3. The four synergy planes

Where the cross-axis magic lives (extends `synthesis-matrix-spec.md` §14):

1. **Stat affinity** = Kit × Factor. The kit sets the shape; factors nudge it. A Rogue+Dagger is faster
   than a Rogue+Hammer.
2. **Card content** = Kit × Attunement. The kit says *what a card does*; the attunement says *what
   element it deals + what status it imbues*. A Warrior's Cleave is Physical→Bleed; a Fire Warrior's
   Cleave is Fire→Burn.
3. **Wild-card** = Subtype × everything. The subtype passive re-contextualizes the whole deck (a Swarm
   deck wants multi-hit; a Giant deck wants big splashy hits it can afford).
4. **Reaction/status** = Attunement × Attunement. Statuses one card lays, another detonates
   (`mechanics.md` reactions) — the strongest cross-*creature* synergy in a squad.

## 4. Kit catalog — theme · stat lean · signature mechanic

Stat lean on the 7-stat line (**HP · ATK · DEF · FOC · RES · EVA · SPD**); ↑ up, ↓ down.

### Archetypes (Humanoid) — from `archetype-design.md`
| Archetype | Theme / signature | Stat lean |
|---|---|---|
| **Warrior** | Stance spectrum + Brace; sustained bruiser-tank | ↑DEF ↑HP ↑ATK ↓FOC |
| **Rogue** | Stealth + Combo; chain cheap hits into a payoff | ↑ATK ↑SPD ↑EVA ↓HP ↓DEF |
| **Mage** | Overload + Channel + Conjure; burst spellcaster | ↑FOC ↑ATK ↓HP ↓DEF |
| **Warlock** | Sacrifice + Summon + Curse; pay HP for power | ↑FOC ↑HP ↓DEF |
| **Priest** | Faith + Prayer + Smite; heal the line, punish evil | ↑RES ↑FOC ↑HP ↓ATK |
| **Shaman** | Totem + Spread + Soak; board-control + priming | ↑FOC ↑RES (even) |
| **Ranger** | Mark + Trap + Companion; precise ranged control | ↑ATK ↑SPD ↑ACC ↓HP |
| **Engineer** | Construct + Gadget; build an unbreakable wall | ↑DEF ↑HP ↓SPD |

### Families (Beast)
| Family | Theme | Stat lean |
|---|---|---|
| **Mammalian** | Pursuit/pack tempo — draw + pressure | ↑ATK ↑SPD |
| **Reptilian** | Armored ambush — soak, ramp, big bite | ↑DEF ↑HP ↓SPD |
| **Avian** | Aerial skirmish — evasion + card flow | ↑SPD ↑EVA ↓HP ↓DEF |
| **Piscine** | Soak controller — prime then devastate | ↑FOC ↑HP |
| **Insectoid** | Fragile swarm — many small hits + venom | ↑SPD ↓HP ↓DEF |
| **Amphibian** | Versatile survivor — regen + toxin | ↑RES ↑FOC (even) |
| **Draconic** | Breath + scales + hoard — bulk powerhouse | ↑HP ↑ATK ↑DEF ↓SPD |

### Manifestations (Aberration)
| Manifestation | Theme | Stat lean |
|---|---|---|
| **Eldritch** | Madness/fear — attack the mind | ↑FOC ↓DEF |
| **Construct** | Relentless geometric wall/turret | ↑DEF ↑HP ↓SPD |
| **Ooze** | Engulf/dissolve/absorb attrition | ↑HP ↑RES ↓ATK ↓SPD |
| **Flora** | Toxin + regen + entangle | ↑HP ↑FOC |
| **Crystalline** | Hard/reflective/sharp | ↑DEF ↑RES ↓HP |
| **Formless** | Immaterial/evasive/pervasive | ↑EVA ↑SPD ↓DEF |

**Hybrids** (Humanoid/Beast or Humanoid/Aberration) **average their two kits' stat leans AND merge both
pools** — a Warrior/Mammalian carries stance cards *and* pursuit cards, and reads as a balanced bruiser.

## 5. Factor catalog — the "equipment slots" (card cluster + stat nudge)

A creature holds **2–3 factors**; each adds a small card cluster and a stat nudge. This is the primary
*intra-kit* customization.

### Weapons (Humanoid)
Sword `+ATK`·balanced · Axe `+ATK`·Bleed/Cleave · Dagger `+SPD +EVA`·Combo · Bow `+ACC +ATK`·ranged/Mark
· Crossbow `+ATK`·Pierce · Spear `+ATK`·reach · Mace `+ATK`·armor-break/Stun · Hammer `+ATK↑ +break`·big
slow · Staff `+FOC`·spell reach · Wand `+FOC`·cheap spells · Shield `+DEF +HP`·Block/guard · Fist
`+SPD`·flurry.

### Anatomy (Beast)
Claws `+ATK`·Bleed · Teeth `+ATK`·execute · Beak `+ACC`·Pierce · Horns `+ATK`·charge · Tail `+EVA`·sweep ·
Hooves `+SPD`·trample · Wings `+EVA +SPD`·reposition · Quills `+DEF`·thorns · Venom `+FOC`·Poison · Hide
`+DEF +HP` · Shell `+DEF`·Block · Roar `+FOC`·Weak/fear · Breath `+FOC`·AoE element (chroma = attunement).

### Features (Aberration)
Tentacle `+ATK`·reach/grab · Eye `+ACC`·gaze/Mark · Maw `+ATK`·devour/execute · Pseudopod `+EVA`·engulf ·
Spore `+FOC`·Poison/spread · Shard `+ATK`·Pierce/reflect · Miasma `+FOC`·AoE debuff cloud · Roots
`+DEF`·root/entangle · Mandible `+ATK`·crush.

> Note the overlaps (Venom/Spore→Poison, Shield/Shell/Shard→Block/reflect) — these are the seams where a
> Beast and an Aberration can feel similar, which is fine: the *kit* keeps them distinct.

## 6. Subtype wild-card catalog (the collectible weirdness)

Each subtype = a **signature passive** + a small **package** that rewards building around it. `[built]` =
a v1 trait to port/expand; `[new]` = to design. These are deliberately *build-defining*, not tuning
knobs.

| Subtype | Wild-card passive | Package |
|---|---|---|
| **Mechanical** `[built]` | **Plating** — +2 Block at turn start; immune to Poison/Bleed | Overclock, turret-deploy |
| **Elemental** `[built]` | **Volatile Core** — at end of turn, imbue its attunement's status on the front foe; immune to that status | Overload, detonate |
| **Giant** `[built]` | **Immovable** — starts braced (big Block); can't be repositioned; its single-target hits SPLASH the squad but cost +1 | Slam, Quake, throw-a-support |
| **Demonic** `[built]` | **Dread** — foes that strike it gain Weak; Sacrifice cards (pay HP → power) | Soul-drain, Pact |
| **Undead** `[new]` | **Undying** — heals a little when struck; Poison/Bleed-immune; once per combat survives a lethal hit at 1 HP | Raise, Reassemble |
| **Hallowed** `[new]` | **Sanctified** — squad gains a Regen aura; +damage vs Shadow/Undead/Demonic | Consecrate, Ward |
| **Feral** `[new]` | **Frenzy** — +ATK as HP drops; immune to Confuse; but **cannot gain Block** (no discipline) | Rampage, Reckless |
| **Ancient** `[new]` | **Timeworn** — +1 Might & +1 Guard *permanently* each round; keeps one buff between fights | Slow-scaling powers |
| **Swarm** `[new]` | **Legion** — a live "count"; multi-hit cards scale with it; on death a smaller copy replaces it (once); takes +50% from field/AoE | Split, Spread |
| **Cursed** `[new]` | **Hex** — its hits lay a worsening Curse; when it dies it curses the killer; some cards cost HP | Hex, Blood-pact |
| **Spectral** `[new]` | **Phase** — ignores the first hit each round; strikes/only-struck past the front row (reach); Bleed-immune | Haunt, Fear |

Design guardrails: a subtype passive should (a) be readable in one line, (b) change *what cards you want*
(so it interacts with the pool), and (c) be double-edged where it's strong (Feral trades Block for rage;
Swarm trades AoE-safety for count-scaling). Some of these will not survive playtest — that's expected.

## 7. Attunement catalog — element → status + role in the pool

Each attunement (1) **re-skins** the kit's attacks to its element, (2) **imbues** its signature status on
marked cards, (3) adds a **~3–5 card signature sub-pool**, (4) drives **matchups + reactions**.

| Attunement | Status | Signature flavor |
|---|---|---|
| Physical | Bleed | raw hits, execute |
| Fire | Burn | DoT + detonation |
| Frost | Chill (Weak) | slow/lock, tempo denial |
| Nature | Poison | stacking DoT attrition |
| Water | Soak | prime → payoff (Piscine/Shaman core) |
| Air | Expose | block-bypass, dispersal |
| Energy | Shock | energy tax, chain |
| Stone | Fortify | slot-bound Block aura (its identity is Block cards) |
| Arcane | Amplify | next-hit ×1.5, spell scaling |
| Shadow | Vulnerable | debuff + burst |
| Holy | Regen (self) | sustain + smite |
| Void | Decay | strip Block/buffs/powers |
| Mind | Confuse | fizzle/retarget control |

**Dual attunement** = both element sub-pools + the **hybrid name** (Steam, Kinetic, Frostfire…) + a
handful of pair-signature cards (`hybridPool.js`). Class→attunement legality (`synthesis.js`) constrains
which elements a Humanoid archetype can access (a Warrior is Physical + universals), so an archetype's
*reachable* builds are bounded — an important lever on the design space.

## 8. Emergent archetypes — worked examples

The proof the model works: distinct, recognizable decks fall out of the combinations.

1. **Fire Warrior + Hammer + Giant** → a slow **immovable smash** deck: brace up, then Giant-splash
   Hammer hits that Burn the whole squad. Wants block + big AoE.
2. **Shadow Rogue + Dagger + Undead** → a **combo assassin** that heals off trades and survives a lethal
   swing — chain cheap Shadow hits into an execute, undying through the counterplay.
3. **Fire Mage + Staff + Elemental** → a **spell-slinging detonator**: Burn everything, and Volatile Core
   auto-detonates at turn end. Glass cannon.
4. **Nature Reptilian (Beast) + Venom/Shell + Swarm** → a **poison-attrition wall**: Shell-block, ramp,
   spread Poison that Legion-scales. Tanky DoT.
5. **Void Eldritch (Aberration) + Tentacle/Eye + Ancient** → a **growing control** deck: Confuse + Decay
   to disrupt, Timeworn to out-scale a long fight. Reach from the back row.
6. **Water Shaman + Staff + (any)** paired in a squad with a **Fire** creature → the **reaction combo**:
   Shaman Soaks, the Fire creature detonates Steam. The cross-creature payoff formations exist for.

## 9. Deck construction & growth

- **Starter** (`starterDeck`): 3 Strike + 3 Defend (kit/element-reskinned) + 2–4 kit/factor signatures →
  ~10 cards, always playable.
- **Growth (run):** rewards + shop draw from the creature's **potential pool** (rarity-weighted), so a
  run *specializes* a creature down one of its latent archetypes.
- **Open world (later):** the §14.6 budget deckbuilder — free construction against a rarity-point cap,
  same potential pool.
- **Cross-creature:** the squad's shared hand is the union; rewards can be assigned per-creature
  (`grantCard(ownerId)`), so you sculpt *which* creature carries which reward.

## 10. Open questions / decisions

- **Factor count & choice:** are a creature's 2–3 factors fixed by species, rolled, or player-chosen
  (equipment)? Player-chosen factors would make them true "equipment slots" and a huge build lever.
- **Subtype packages:** do all subtypes get a card cluster, or do some stay passive-only? (Start:
  passive-only for the backlog 6, packages for the built 5.)
- **Cross-creature reward pool:** can a reward card go to *any* creature, or only ones whose typing
  "legally" supports it? Legality gating preserves identity; free assignment maximizes flexibility.
- **Size → cards:** does size touch the pool (bigger = fewer/heavier cards?) or only HP? (Lean: HP +
  a gentle cost curve only.)
- **Pool density targets:** how many authored cards per kit / factor / attunement to hit the §1 budget
  without bloat. Needs an authoring pass + `test:*` coverage.

## Build order (proposed)

1. **Matchups → attunement-only** (retire Layer-2 constitution) + **stats → kit+factor** (retire
   `BODY_PROFILE`). Mechanical, self-contained; unlocks the identity model above.
2. **Subtype wild-card engine** — passive-trigger hooks in `round.js` (turn-start / on-struck / on-death
   / turn-end) + author the 11 signatures.
3. **Content density pass** — flesh each kit/factor/attunement sub-pool to the §1 budget; wire subtype
   packages.
4. **Deck-build surfacing** — show a creature's potential pool + let rewards target a creature; later the
   budget builder.

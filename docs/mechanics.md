# Chimera — Master Mechanics Registry

> The living index of every **status**, **keyword**, **reaction**, and shared
> **primitive** in the combat engine, plus the design rules that bind them. When we
> add or change a mechanic, it gets recorded here. Companion to
> `docs/combat-engine-spec.md` (turn engine) and `docs/synthesis-matrix-spec.md`
> (the 3-axis taxonomy). **Status: reactions (§3–§4) are a FIRST-PASS DRAFT for
> review — numbers and many cells are provisional/REVIEW.**

---

## 0. Index

- **Statuses** (§1) — live creature-bound effects.
- **Reaction framework** (§2) — the locked rules for how reactions fire.
- **Attunement reaction "verbs"** (§3) — each element's reaction identity.
- **The reaction matrix** (§4) — status × attunement, first pass.
- **Keywords** (§5) — card-level keywords.
- **Open threads / master plans** (§6) — AI reaction-awareness, the predictive
  readout system, status-improvement ideas.

---

## 1. Statuses (live unless noted)

Creature-bound; travel on swaps; DoTs tick at the **opponent's** turn-end, Regen at
the **carrier's own** turn-end. `intensity` = a magnitude that's consumed/ticked;
`duration` = counts down 1/turn.

| Status | Owner-good? | Current behavior | Primer? |
|---|---|---|---|
| **Burn** (Fire) | debuff | HP = stacks/turn; decays 1 | yes |
| **Poison** (Nature) | debuff | HP = stacks/turn; persists | yes |
| **Bleed** (Physical) | debuff | HP = stacks × times-hit-that-turn; 0 hits → falls off; else decay 1 | yes |
| **Decay** (Void) | debuff | HP+Block = stacks/turn, strips 1 of every buff + 1 power; decays 1 | yes |
| **Weak / Chill** (Frost) | debuff | −25% attack damage; counts down | yes |
| **Vulnerable** (Shadow) | debuff | +50% damage taken; counts down | yes |
| **Soak** (Water) | debuff | *(reframe pending — see §4)* currently +25%/stack to next hit | yes |
| **Shock** (Energy) | debuff | Vanguard pays +1 energy/shocked ally; DoT=stacks; grows when spread | yes |
| **Expose** (Air) | debuff | all hits ignore Block while >0; >HP → force-swap+lock; decays 1 | yes |
| **Confuse** (Mind) | debuff | next attack: ~33% fizzle / ~50% random target; consumed per attack | yes |
| **Strength** | buff | +flat damage/hit | yes (as a target for Shadow/Holy/Mind) |
| **Dexterity** | buff | +flat Block gained | yes |
| **Regen** (Holy) | buff | heal = stacks at own turn-end; decays 1 | yes |
| **Amplify** (Arcane) | buff (self) | next attack ×1.5; consumed | yes |
| **Block / Fortify** | resource | absorbs damage (Fortify = slot aura) | yes (Void/Physical targets) |

> **Stone has no status** — its signature is the Fortify Block-aura, expressed
> through Block cards (see synthesis §5.1 / ATTUNEMENT_STATUS).

---

## 2. Reaction framework (LOCKED 2026-06-22, Jeton)

> **PRIME DIRECTIVE (LOCKED):** **every status must be an effective STANDALONE strategic
> tool.** Reactions / type synergies *enhance* play but are **NEVER required** — no status's
> value may depend on landing a reaction. (So the game is fully playable on statuses alone;
> reactions are pure upside.) Consequence: the **Soak reframe is REJECTED** — Soak KEEPS its
> standalone bite (+25%/stack to the next attack, already live) *and* also serves as a
> reaction primer.
>
> **IMPLEMENTATION STATUS:** the reaction *design* (§3–§4) is settled; the data-driven
> `REACTIONS` *engine* is **DEFERRED** (built after the demo). Because statuses stand alone,
> nothing is blocked.


A **reaction** fires when an **attack hit** of element **X** lands on a target
carrying a status the element reacts with. Rules:

1. **Attack hits only** trigger reactions (not skills/DoTs).
2. **Per hit.** Evaluated on every hit, even if the reaction would consume its
   primer on the first (a multi-hit card can chain reactions as primers are
   re-applied / multiple primers exist).
3. **All relevant statuses react**, not one. A single hit checks **every** status on
   the target and fires each reaction the element has — resolved in the order of
   **most-recently-updated status first** (last changed by application/decay/tick).
4. **Consumption is case-by-case** — some reactions consume the primer, some leave or
   transform it (per cell in §4).
5. **Reactions are NOT just bonus damage.** They're *mechanics* — spread, lock,
   transmute, devour, displace — on par with the statuses themselves. (See §3.)
6. **Power budget: BOTH** — reactions range from light spice (when an element happens
   to meet a status) to **build-defining** payoffs (decks built to set up a reaction
   engine).
7. **Symmetric** — both sides react identically. (AI *setup* awareness = §6.)
8. **Keyed on the card's damage element**, so a re-skinned creature reacts with its
   converted element.
9. **Data-driven** — implement as a `REACTIONS` table (condition → effect ops),
   authorable/swappable like the effect registry; the generator can reference it.

---

## 3. Attunement reaction "verbs" (the systematic lens)

Rather than 180 arbitrary cells, each attunement has a **reaction identity** — what
it *does* to a status it meets. A cell in §4 = "this verb, applied to this status."

| Attunement | Verb | What it does to a status it hits |
|---|---|---|
| **Fire** | **Detonate** | consume a DoT/primer for an immediate burst scaled to it; boil Soak |
| **Frost** | **Freeze / Lock** | harden it: extend a debuff, freeze a buff so it can't grow, lock action/swap |
| **Nature** | **Fester / Overgrow** | deepen & entrench DoTs; root; turn afflictions permanent-ish |
| **Water** | **Spread / Flow** | propagate the status to another unit; dilute (weaken) a buff |
| **Air** | **Disperse / Displace** | scatter the status off the target (cleanse/halve), or force a swap |
| **Energy** | **Conduct / Overload** | chain the status to other units; discharge a debuff for a stun/disrupt |
| **Stone** | **Entomb / Calcify** | freeze a status's timer (make it permanent/immovable); petrify |
| **Arcane** | **Transmute** | convert one status into another; duplicate or amplify a status |
| **Shadow** | **Corrupt / Deepen** | invert a buff into its debuff; deepen a debuff (Sunder) |
| **Holy** | **Judge / Purge** | punish a debuffed foe (Smite); strip a foe's buffs; convert a debuff to healing |
| **Void** | **Devour / Annihilate** | erase a status and convert it into HP drain / Decay |
| **Mind** | **Confound / Invert** | turn the status against its owner; scramble plans |
| **Physical** | **Exploit / Shatter** | capitalize on a compromised state (shatter Chill, tear Bleed, smash Expose) |

---

## 4. The reaction matrix (FIRST PASS — REVIEW)

Read as: **attacker element + (status on target) → reaction**. `consume` notes
whether the primer is spent. Numbers are placeholders. Organized by **status**; only
the logically-meaningful cells are listed (others = no reaction for now).

> **Soak (LOCKED):** keeps its **standalone** effect (+25%/stack to the next attack, then
> clears — already live) AND acts as a reaction primer. While Soaked, the §4 Soak reactions
> (Steam/Freeze/Electrocute/Bloom) can also **chain/amplify by stack** — but Soak is fully
> useful with zero reactions, per the prime directive.

### Burn (target is on fire)
- **Fire → Flare-up** — add +2 Burn (stoke it); no consume.
- **Nature → Wildfire** — Burn *spreads*: copy current Burn to one other enemy.
- **Water → Quench** — consume Burn; the steam applies **Weak** to the target (and removes Soak if present → Steam, see Soak).
- **Air → Backdraft** — consume Burn for a burst = remaining Burn, and **disperse** half of it to an adjacent enemy.
- **Void → Devour** — erase Burn, heal attacker for its remaining value.

### Poison (stacking toxin)
- **Fire → Combust** *(your design)* — **consume all Poison** for a burst = `Poison × turns the target has been continuously poisoned` (needs a poison-streak counter, §6). Trades the DoT for a big, setup-rewarding nuke.
- **Water → Spread** — Poison copies to another enemy (does not consume).
- **Nature → Fester** — Poison **doubles** (overgrowth); no consume.
- **Arcane → Transmute** — convert Poison into the same amount of **Decay** (upgrade the affliction).
- **Holy → Purge-Smite** — consume Poison for Holy damage = its value (cleanse-as-weapon).

### Bleed (physical wound)
- **Physical → Rend** — each hit already deepens Bleed; the *reaction* makes this hit's Bleed-growth **+1 extra** and deals bonus = current Bleed.
- **Frost → Frostbite** — freeze the wound: Bleed becomes **permanent** (stops decaying) until thawed.
- **Wind/Air → Hemorrhage** — consume Bleed for a burst and **force-swap** the target if Bleed > a threshold.
- **Void → Devour** — erase Bleed, heal attacker.

### Decay (entropy)
- **Void → Collapse** — Decay **doubles**; no consume (Void feeds Void).
- **Holy → Restore** — consume Decay; **cleanse** it and the target gains nothing (Holy denies entropy) — or punish: Holy damage = Decay.
- **Arcane → Transmute** — convert Decay into Vulnerable + Weak (spread the rot to its stats).

### Weak / Chill (slowed, −damage)
- **Physical/Stone → Shatter** — consume Chill for a big burst (the classic) **+ apply Vulnerable** (the cracked target is now brittle). *(Frost-shatter payoff — answers Q6: shatter = burst + Vulnerable.)*
- **Fire → Melt** — consume Chill; remove Weak and deal a Melt burst (thermal shock).
- **Frost → Deep Freeze** — extend Chill and add **Expose** (frozen solid = brittle).
- **Energy → Superconduct** — consume Chill; apply **Shock** and chain it (cold conducts).

### Vulnerable (takes +damage)
- **Shadow → Sunder** — **refresh + double** Vulnerable's bonus for this hit (does not consume).
- **Physical → Exploit** — this hit deals +50% (stacks with Vulnerable) and adds 1 Vulnerable.
- **Arcane → Transmute** — convert Vulnerable into the attacker's choice of Weak/Expose.

### Soak (wet primer — see reframe above)
- **Fire → Steam** — consume Soak; burst + apply **Weak** (scalding mist); amplified by Soak stacks.
- **Frost → Freeze** — consume Soak; apply **Expose** and the target **can't gain Block** next turn.
- **Energy → Electrocute** — consume Soak; apply **Shock** to the target **and chain Shock** to one other enemy per Soak stack (water conducts).
- **Nature → Bloom** — consume Soak; apply **Poison** ×(1+Soak) (water feeds the toxin).

### Shock (charged)
- **Energy → Overload** — consume Shock for a stun: the target's **next planned action is cancelled** (Energy discharge).
- **Water → Conduct** — Shock **spreads** to all wet (Soaked) enemies.
- **Physical → Ground** — consume Shock, bonus damage (you ground the current through them).

### Expose (armor stripped)
- **Physical → Smash** — bonus damage and **+1 Expose** (widen the breach).
- **Air → Gale** — consume Expose; **force-swap** the target (blow the unguarded unit off the line).

### Confuse (scrambled)
- **Mind → Madness** — deepen Confuse: their next attack ALSO targets randomly even if it doesn't fizzle.
- **Arcane → Transmute** — convert Confuse into **Weak** (a clearer, lasting hex).

### Buffs — Strength / Dexterity / Regen / Amplify
- **Shadow → Corrupt** — invert one buff stack into its mirror debuff (Strength→Weak, Dexterity→Frail, Regen→Poison, Amplify→Vulnerable).
- **Holy → Purge** — strip 1 stack of each of the target's buffs (Holy denies the wicked) — or, if used on an **ally**, this is a heal/extend instead.
- **Air → Disperse** — blow away (halve) the target's buffs.
- **Frost → Freeze** — a Frosted buff **can't grow** (locks Strength/Amplify from increasing) while Chill lasts.
- **Mind → Envy** — *steal* 1 buff stack from the target to the attacker.

### Block / Fortify
- **Void → Corrode** — strip all Block, then apply **Decay** = the Block removed.
- **Physical → Sunder Guard** — ignore Block this hit and reduce their max Block effect next turn.
- **Air → Expose** — bypass Block and apply **Expose**.

---

## 5. Keywords (card-level)

`exhaust` · `ethereal` · `retain` · `innate` · `replay` · `unplayable` (engine-live).
Plus the archetype keywords: **Brace**, **Dexterity** (Warrior); **Stealth**, **Combo**
(Rogue); etc. — see `docs/archetype-design.md`.

---

## 6. Open threads & master plans

- **AI reaction-awareness (master plan — TODO):** the enemy planner should eventually
  *seek* reactions — prefer hitting a Soaked target with Energy, set up its own primers
  (apply Soak then Steam next turn), and avoid wasting a detonator on an unprimed foe.
  For now reactions resolve symmetrically but the AI doesn't deliberately set them up.
  Track here as the seed of an **AI-behavior master plan** (also: difficulty tiers,
  bluffing with the forecast, value-of-Peek modelling).
- **Predictive readout system (BUILD — generalize):** a reusable "what will happen"
  readout, shown when targeting — not just "Fire→Frost ×1.5" but "**will trigger Steam:
  +X, applies Weak**". Build it generic (matchup breakdown + reaction preview +
  status-tick preview + lethal check) so it serves many cases, not only reactions.
- **Status improvement pass (IDEAS):** Jeton notes the base statuses "could be further
  improved." Candidates: Poison streak-tracking (enables Combust); Vulnerable scaling;
  making Soak the conductive primer (§4); Confuse interacting with the Peek forecast;
  Regen overheal → temp HP. Capture refinements here before they're built.
- **Poison-streak counter (needed for Combust):** track turns a target has been
  *continuously* poisoned (reset when Poison reaches 0) so Combust can scale by it.

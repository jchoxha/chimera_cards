# Archetype Design — the 36 Archetypes (Topic 5)

> Companion to `docs/synthesis-matrix-spec.md`. Designs every archetype in the
> Archetype axis (the taxonomy's "Class" axis — **we call them archetypes**):
> **8 base archetypes** + **28 hybrids**. Status: framework locked 2026-06-21;
> **all 8 base archetypes now drafted** (Warrior LOCKED; Rogue→Engineer full
> drafts awaiting review); 28 hybrids queued.
>
> *Terminology: "archetype" (not "class") throughout. The code/taxonomy axis is
> still literally named `class` (`synthesis.js` `CLASS_BASES`, `Fighter.class`) —
> a future rename, not done here to avoid a risky cross-cutting refactor.*

## 1. The base / hybrid model (LOCKED 2026-06-21)

- Each **base archetype** (8) has a **THEME** — a through-line identity — plus a
  **signature mechanic** and a stat affinity.
- Every **hybrid** is a blend of **two** base archetypes (e.g. *Gladiator* =
  Warrior+Rogue). A hybrid **inherits BOTH parents' themes** and layers a
  **bespoke mechanic** of its own.
- Consequence: **hybrids are inherently more powerful/versatile than bases**
  (two themes vs one). This is intended — but must be **balanced** (§4).
- Each base therefore has **7 hybrids** (one with each other base), and its
  theme runs through all 7.

### Design order (dependency-correct)
Design all **8 base themes first** (a hybrid needs both parents defined), then the
**28 hybrids**. Per Jeton: go through **all** combinations 1-by-1, custom mechanic
each.

## 2. Shared engine primitives (the 4 new systems)

Distinct class fantasies are built from a small shared toolkit so "unique per class"
stays buildable. (Full engine specs come when we implement; here we just name them.)

1. **Field Entities** — summoned units (minions/totems/constructs/companions): occupy
   an aux zone, have HP + a per-turn effect + a lifespan. (Warlock, Shaman, Engineer, Ranger)
2. **States** — persistent self-modes that bend rules until changed (Stances, Stealth).
   (Warrior, Rogue)
3. **Delayed Triggers** — effects scheduled to fire on a future turn/condition
   (Traps, Marks, Channels). (Ranger, Mage)
4. **Card Generation** — add temporary (ethereal) cards to hand (Conjure, Gadgets).
   (Mage, Engineer)

## 3. Per-archetype design template

Each archetype entry fills:
- **Theme (through-line)** — inherited by all its hybrids.
- **Fantasy** — flavor.
- **Signature mechanic / keyword** — the distinctive end-result mechanic.
- **Primitives used** — from §2.
- **Stat affinity** — from the 5-stat model (Might/Guard/Focus/Resolve/Speed).
- **Card pool** — the full ~26-card list + the stat each card scales with.
- **AI bias** — planner priorities.
- **Hybrid through-line** — how the theme shows up across its 7 hybrids.

**Stat-affinity map (soft synergy; overlaps are fine — coherent builds hit
harder, §13.2.3):** Warrior Might+Guard · Rogue Might+Speed · Mage Might+Focus ·
Warlock Focus+Might · Priest Resolve+Focus · Shaman Focus+Guard · Ranger
Might+Focus · Engineer Guard+Speed. (All damage scales with Might regardless;
the secondary stat is the flavor lever.)

---

## 4. Balancing the base↔subclass power gap (OPEN — to resolve later)

Subclasses carry two themes, so they're stronger. Candidate levers (pick later):
- **Rarity / generation weighting** — subclasses rarer; bases the common backbone.
- **Versatility-not-mastery** — same stat budget + card-slot count spread across two
  themes ⇒ broader but shallower; bases get a focused "mastery" depth bonus.
- **Cost** — subclass signature cards cost more / carry a drawback.
- **Encounter gating** — subclasses appear deeper in a run / as elites.
Likely a blend of rarity + versatility-not-mastery.

---

## 5. WARRIOR (base) — DRAFT

- **Theme (through-line): MARTIAL DISCIPLINE.** Masters of sustained physical combat —
  they don't burst, they **outlast and out-grind** via **Stances** and accumulating
  advantage. Reliable Might/Guard; staying power. Every Warrior subclass keeps **Stance
  access + martial reliability**.
- **Fantasy:** the disciplined frontliner who controls the tempo of a melee.
- **Keywords introduced:** **Stance**; **Strength** (+flat damage/hit, existing);
  **Dexterity** (NEW — +flat Block to block-granting cards; the block analog of Strength);
  **Brace** (NEW — affected Block does not decay between turns).
- **Signature mechanic — the STANCE SPECTRUM (a State):** a **5-point** slider. One
  position active; **shift one step/turn for free** (cards can shift extra or **snap** to
  an end). The whole **offense side cannot gain Block**; the whole **defense side cannot
  Attack**. Balanced is the only stance that can do both.

  | Stance | Side | Effect |
  |---|---|---|
  | **Rampage** | offense | deal **2× damage**; **cannot gain Block** |
  | **Offensive** | offense | gain **+1 Strength** per Attack played this turn; **cannot gain Block** |
  | **Balanced** | — | may both Attack and Block; **no bonus** (the flexible default / entry stance) |
  | **Defensive** | defense | gain **+1 Dexterity** per Skill played this turn; **cannot Attack** |
  | **Full Guard** | defense | your Block gains **Brace** (persists); **cannot Attack** |

  (Numbers provisional.) **What balances the extremes is travel distance:** committing to a
  side is one-dimensional (no Block on offense, no Attack on defense), and swinging to the
  opposite extreme costs the **full distance** — up to 4 turns Full Guard ↔ Rampage — so you
  can't oscillate between the big bonuses. Start in **Balanced**.
- **Primitives used:** States (the stance slider).
- **Stat affinity:** **Might + Guard**; **Resolve** rewards the self-buff stacking (Strength/Dexterity are "gained").
- **Two internal win-cons (very StS):**
  1. **Strength-stack aggro** — sit in **Offensive** playing attacks to pile Strength → **snap Rampage** for a 2x, Strength-amplified multi-hit nuke. (Risk: no Block on Rampage turns.)
  2. **Brace turtle / Block-payoff** — sit in **Defensive** stacking Dexterity & Block → **Full Guard** to lock a Brace wall → cash out with a "damage = your Block" finisher. (Risk: can't attack in Full Guard.)
- **Full card pool (27 cards).** Base numbers shown pre-stat-scaling (Might scales damage,
  Guard scales Block, Strength/Dexterity are flat per-hit/per-block buffs, Resolve scales
  self-buffs). Cost is energy; **X** = spend-all.

  **Basics (starter)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Strike** | Attack | 1 | Deal 6 damage. |
  | **Guard** | Skill | 1 | Gain 5 Block. |

  **Attacks — aggro / Strength-stack**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Cleave** | Attack | 1 | Deal 8 damage. |
  | **Pommel Strike** | Attack | 1 | Deal 7 damage; draw 1. |
  | **Reckless Swing** | Attack | 1 | Deal 13 damage; lose 4 Block (free downside in Rampage). |
  | **Execute** | Attack | 2 | Deal 10 damage; **double** vs a target under 50% HP. |
  | **Sunder** | Attack | 2 | Deal 8 damage; apply 2 Vulnerable (Focus). |
  | **Earthshaker** | Attack | 2 | Deal 6 damage to **all** enemies. |
  | **Whirlwind** | Attack | X | Deal 5 damage **X times** (Strength applies to every hit) — the Strength-stack payoff. |
  | **Rampage Slam** | Attack | 2 | Deal 14 damage; +6 more if in **Rampage**. |

  **Finisher**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Crushing Weight** | Attack | 1 | Deal damage equal to your current **Block** — the turtle payoff. |

  **Skills — defense / Brace-turtle**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Shield Wall** | Skill | 1 | Gain 8 Block. |
  | **Bulwark** | Skill | 2 | Gain 10 Block; it gains **Brace** (persists). |
  | **Iron Will** | Skill | 1 | Gain 2 Dexterity. |
  | **Second Wind** | Skill | 1 | Gain Block equal to 4 + (2 × Dexterity). |

  **Stance control**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Advance** | Skill | 0 | Shift 1 step toward offense; gain 1 energy. |
  | **Brace Up** | Skill | 0 | Shift 1 step toward defense; gain 4 Block. |
  | **Berserk** | Skill | 1 | **Snap to Rampage**; draw 1. |
  | **Fortify** | Skill | 1 | **Snap to Full Guard**; gain 6 Block (Braced). |

  **Self-buffs (Resolve-scaled)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **War Cry** | Skill | 1 | Gain 2 Strength. |
  | **Flex** | Skill | 0 | Gain 3 Strength this turn only (burst into a Rampage hit). |
  | **Battle Trance** | Skill | 0 | Draw 2. |

  **Powers (persistent)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Bloodlust** | Power | 2 | Start of each turn: gain 1 Strength. |
  | **Rampart** | Power | 2 | Your Block always **Braces** (never decays). |
  | **Juggernaut** | Power | 2 | Whenever you gain Block, deal 3 damage to a random enemy. |
  | **Endless Stamina** | Power | 1 | You may shift **2** stance steps per turn. |
- **AI bias:** lean Offensive/Rampage when ahead or with Strength stacked; lean
  Defensive/Full Guard when low; sequences the build-up → cash-out; rarely swaps (anchor).
- **Hybrid through-line:** every Warrior-X keeps **Stances + martial reliability**,
  fused with X's theme:
  | Hybrid | = Warrior + | Blend (Stances + …) |
  |---|---|---|
  | **Gladiator** | Rogue | Stances + Stealth/Combo → stance-dancing duelist |
  | **Spellsword** | Mage | Stances + Conjure → conjured blades; martial caster |
  | **Death Knight** | Warlock | Stances + Summon/Sacrifice → raises minions, pays HP |
  | **Paladin** | Priest | Stances + Prayer → tanky holy protector, heals on the line |
  | **Warmonger** | Shaman | Stances + Totems → war-totems that amp aggression |
  | **Hunter** | Ranger | Stances + Mark/Traps → martial tracker |
  | **Ironclad** | Engineer | Stances + Constructs → armored gadgeteer, extra-tanky |

> **Warrior LOCKED 2026-06-21** (5-stance spectrum incl. Balanced; offense side can't
> Block, defense side can't Attack — traversal distance balances the extremes; Brace +
> Dexterity are named keywords feeding Topic 2; two win-cons: Strength-stack aggro &
> Brace/Block-payoff turtle). Numbers provisional/tunable.

---

## 6. ROGUE (base) — DRAFT (full pool, for review)

- **Theme (through-line): SUBTLETY & TEMPO.** Rogues win by controlling information and
  position, striking unseen, and **chaining cheap actions into outsized payoffs** — not by
  standing and trading. Through-line for all Rogue subclasses: **Stealth access + Combo**.
- **Fantasy:** the assassin/duelist who strikes from the shadows and snowballs a turn.
- **Keywords introduced:** **Stealth** (State); **Combo** (per-turn counter); leans on the
  existing DoT/debuff statuses (**Poison**, **Weak**, **Vulnerable**) as its toolkit (the
  creature's attunement re-skins which status — §14.3).
- **Signature mechanic 1 — STEALTH (a State):** become **untargetable by enemy
  single-target actions** until you **play an Attack** or your **next turn ends**. Your first
  Attack out of Stealth is an **ambush** — the card's bonus applies and Stealth is consumed.
  Forces the enemy's planned single-target actions to re-target / waste. **RULING (locked per
  rec): Stealth dodges only single-target — AoE / `wholeEnemySide` still hits.**
- **Signature mechanic 2 — COMBO (a per-turn counter):** every **card** you play this turn
  increments Combo; **finishers** read the Combo count (cards played *before* them this turn).
  Resets to 0 at end of turn → rewards chaining many cheap cards before the payoff. **RULING
  (locked per rec): Combo counts cards played only — NOT swaps or Peek.**
- **Primitives used:** States (Stealth) + a lightweight Combo counter. *(Both are NEW engine
  primitives — implementing Rogue's pool requires a `stealth` State + a per-turn `combo`
  counter, neither live yet. Topic 2 / §2 work.)*
- **Stat affinity:** **Might + Speed** (lethal hits + the tempo/energy/draw to chain; Speed
  also feeds Peek — Rogues are the natural scouts).
- **Two internal win-cons (parallel to Warrior's two):**
  1. **Stealth assassin (alpha-strike)** — set up with Stealth + debuffs, then land one
     massive ambush (Backstab/Ambush) on a softened target. (Risk: low sustained Block;
     burns tempo entering Stealth.)
  2. **Combo tempo (death by a thousand cuts)** — chain cheap 0/1-cost cards (Shivs, draw,
     energy) to pump Combo, then cash out a Combo-scaling finisher (Eviscerate / Killing
     Spree) or stacked Poison. (Risk: clunky hand → small finisher.)
- **Full card pool (26 cards).** Base numbers pre-stat-scaling (Might scales damage, Guard
  scales Block, Focus scales debuffs applied to enemies, Speed feeds tempo/Peek). Cost is
  energy; **X** = spend-all. `[S]` marks the **2–4 class-signature starter cards** (§14.2).

  **Basics (starter — same mechanics as every class, reworded; §14.2)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Dagger** | Attack | 1 | Deal 6 damage. |
  | **Dodge** | Skill | 1 | Gain 5 Block. |

  **Stealth package (win-con 1)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Vanish** `[S]` | Skill | 1 | Enter **Stealth**; draw 1. |
  | **Backstab** `[S]` | Attack | 1 | Deal 7 damage. **Ambush:** if from Stealth, deal +10 and it is **unblockable**. |
  | **Smoke Bomb** | Skill | 1 | Enter **Stealth**; gain 6 Block. |
  | **Shadowstep** | Skill | 0 | Enter **Stealth**; the next card you play this turn costs 0. |
  | **Ambush** | Attack | 2 | Deal 12 damage. **Ambush:** if from Stealth, also apply 3 Weak. |
  | **Nightshade** | Power | 2 | At the start of your turn, if you are in Stealth, gain 1 energy. |

  **Combo fuel — cheap attacks (win-con 2)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Shiv** | Attack | 0 | Deal 4 damage. |
  | **Fan of Knives** `[S]` | Attack | 1 | Deal 3 damage twice. |
  | **Quick Slash** | Attack | 1 | Deal 6 damage; draw 1. |

  **Finishers (Combo-scaling)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Eviscerate** | Attack | 2 | Deal 8 damage, **+3 per Combo** played this turn. |
  | **Killing Spree** | Attack | X | Deal 5 damage **X times** (the tempo payoff). |
  | **Finishing Move** | Attack | 1 | Deal 9 damage; **double** vs a target under 40% HP. |

  **DoT / debuff (Focus-scaled; attunement re-skins the status)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Envenom** | Skill | 1 | Apply 4 Poison. |
  | **Expose Weakness** | Skill | 1 | Apply 2 Vulnerable; draw 1. |
  | **Crippling Cut** | Attack | 1 | Deal 5 damage; apply 2 Weak. |
  | **Toxic Blades** | Attack | 2 | Deal 6 damage; apply 3 Poison. |

  **Tempo / card advantage (Speed-flavored)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Adrenaline** | Skill | 0 | Gain 2 energy; draw 1. |
  | **Preparation** | Skill | 0 | Draw 2; discard 1. |
  | **Slice & Dice** | Attack | 1 | Deal 4 damage; if this is your **3rd+ card** this turn, deal 8 instead. |

  **Powers (persistent)**
  | Card | Type | Cost | Effect |
  |---|---|---|---|
  | **Deadly Momentum** | Power | 1 | The **first card each turn costs 0**. |
  | **Thousand Cuts** | Power | 2 | Whenever you play a card, deal 1 damage to the enemy Vanguard. |
  | **Toxicology** | Power | 1 | Whenever you apply Poison, apply **+1** more. |
  | **Predator** | Power | 2 | Whenever an enemy dies on your turn, enter **Stealth** and draw 1. |

  **Suggested rarities (new 7-tier ladder):** basic — Dagger, Dodge · common — Vanish, Shiv,
  Fan of Knives, Quick Slash, Smoke Bomb, Expose Weakness, Crippling Cut, Adrenaline ·
  uncommon — Backstab, Shadowstep, Ambush, Eviscerate, Envenom, Preparation, Slice & Dice,
  Nightshade · rare — Killing Spree, Finishing Move, Toxic Blades, Deadly Momentum, Toxicology
  · epic — Thousand Cuts, Predator. **Starter `[S]`:** Vanish, Backstab, Fan of Knives (+ the
  4 Dagger / 4 Dodge basics → the §14.2 recipe).
- **AI bias:** open from Stealth for an ambush burst on the softest target; chain cheap cards
  into a finisher; apply DoT early and outlast; exploit Peek (high Speed); swap to reposition
  out of bad matchups (lower swap-aversion than the Warrior anchor).
- **Hybrid through-line:** every Rogue-X keeps **Stealth + Combo**, fused with X:
  | Hybrid | = Rogue + | Blend (Stealth/Combo + …) |
  |---|---|---|
  | **Gladiator** | Warrior | + Stances → stance-dancing duelist (see §5) |
  | **Bard** | Mage | + Conjure → trickster caster; chains conjured spells |
  | **Assassin** | Warlock | + Summon/Sacrifice/Curse → poison-&-curse killer, expendable minions set up the ambush |
  | **Monk** | Priest | + Prayer → martial artist; chains strikes with self-sustain |
  | **Stalker** | Shaman | + Totems → ambush + lingering field traps |
  | **Scout** | Ranger | + Mark/Traps → the recon/assassin: marks, traps, stealth |
  | **Saboteur** | Engineer | + Gadgets → bombs & traps + stealth infiltration |

> **Rogue full draft 2026-06-22** — 26-card pool, two win-cons (Stealth alpha-strike &
> Combo tempo), both open rulings locked per rec (Stealth = single-target only; Combo = cards
> only). Numbers provisional/tunable; needs the `stealth` State + `combo` counter primitives
> to implement. Review/nitpick → lock → Mage.

---

## 7. MAGE (base) — DRAFT (full pool, for review)

- **Theme (through-line): ARCANE MASTERY — burst & manipulation.** Mages are the
  glass cannon: a fragile body that converts resources into overwhelming spell bursts
  and bends the hand/deck to its will. Through-line for all Mage hybrids: **Overload +
  Conjure**. Legal base attunements: **Fire / Frost / Arcane**.
- **Fantasy:** the spellcaster who banks power and unleashes a devastating turn.
- **Keywords introduced:** **Overload** (X / spend-all spells whose effect scales with
  energy spent); **Conjure** (Card Generation — add temporary *ethereal* spell cards to
  hand); **Channel** (Delayed Trigger — pay now, the big effect resolves next turn,
  telegraphed); **Amplify** (a self-status: your next spell +50%).
- **Primitives used:** Card Generation (Conjure) + Delayed Triggers (Channel).
- **Stat affinity:** **Might + Focus** (raw spell damage + potent applied statuses).
- **Two win-cons:** (1) **Overload burst** — bank energy via rituals/0-costs, then drop
  a spend-all nuke. (2) **Spell volume** — Conjure + cheap bolts to flood a high card
  count, scaling Disintegrate/Echo.
- **Full card pool (26 cards):**

  **Basics (starter, §14.2)** — **Zap** (A,1: deal 6) · **Ward** (S,1: 5 Block).

  | Group | Card | Type | Cost | Effect |
  |---|---|---|---|---|
  | Bolts | Arcane Bolt `[S]` | Attack | 1 | Deal 8 damage. |
  | Bolts | Firebolt | Attack | 1 | Deal 6; apply 2 Burn. |
  | Bolts | Frost Shard | Attack | 1 | Deal 5; apply 1 Weak (chill). |
  | Bolts | Magic Missiles | Attack | 1 | Deal 3 damage twice. |
  | Overload | **Overload** | Attack | X | Deal 7 damage **X times**. |
  | Overload | Mana Burn | Attack | 1 | Deal damage = **3× current energy**, then lose all energy. |
  | Nukes | Meteor | Attack | 3 | Deal 22 to one enemy. |
  | Nukes | Pyroblast | Attack | 2 | Deal 14; apply 3 Burn. |
  | AoE | Arcane Barrage | Attack | 2 | Deal 5 to all enemies twice. |
  | AoE | Frost Nova | Skill | 1 | Apply 2 Weak to all enemies. |
  | Channel | Channel Inferno | Skill | 1 | **Channel:** next turn, deal 16 to all enemies. |
  | Channel | Empower | Skill | 1 | **Channel:** next turn gain 3 energy and draw 2. |
  | Conjure | Conjure Spell `[S]` | Skill | 0 | **Conjure** 2 ethereal Zaps. |
  | Conjure | Arcane Study | Skill | 1 | Draw 2; **Conjure** 1 ethereal bolt. |
  | Conjure | Mirror Image | Skill | 1 | **Conjure** an ethereal copy of a card in your hand. |
  | Scaling | Disintegrate | Attack | 1 | Deal 6, **+3 per spell** played this turn. |
  | Scaling | Spellweave | Attack | 2 | Deal 8; if you've played 3+ cards this turn, +8. |
  | Buff | Amplify `[S]` | Skill | 1 | Your next spell deals **+50%** (Amplify). |
  | Utility | Teleport | Skill | 0 | Gain 1 energy; draw 1. |
  | Power | Arcane Mastery | Power | 2 | Conjured cards cost 0. |
  | Power | Overheat | Power | 1 | End of turn: deal damage = unspent energy to a random enemy. |
  | Power | Echo | Power | 2 | The **first Attack** you play each turn triggers twice. |
  | Power | Mana Font | Power | 1 | Start of turn: +1 energy. |

  **Rarities:** basic Zap/Ward · common Arcane Bolt, Firebolt, Frost Shard, Magic Missiles,
  Conjure Spell, Teleport, Frost Nova, Amplify · uncommon Overload, Arcane Barrage, Arcane
  Study, Disintegrate, Spellweave, Empower, Mirror Image, Pyroblast · rare Meteor, Mana
  Burn, Channel Inferno, Arcane Mastery, Overheat, Mana Font · epic Echo. **Starters `[S]`:**
  Arcane Bolt, Conjure Spell, Amplify.
- **AI bias:** bank energy when safe → Overload/Meteor for lethal; Channel telegraphs a
  big next turn; defends only when low; medium swap-aversion.
- **Hybrid through-line:** every Mage-X keeps **Overload + Conjure** fused with X:
  | Hybrid | = Mage + | Blend |
  |---|---|---|
  | **Spellsword** | Warrior | + Stances → conjured blades, martial caster |
  | **Bard** | Rogue | + Stealth/Combo → trickster caster, chains conjured spells |
  | **Necromancer** | Warlock | + Summon/Sacrifice → conjures + raises the undead |
  | **Arcanist** | Priest | + Faith → holy-arcane burst with sustain |
  | **Druid** | Shaman | + Totems → conjured elemental spirits |
  | **Spellbow** | Ranger | + Mark/Traps → channeled arcane shots, magic traps |
  | **Artificer** | Engineer | + Constructs → conjured gadget-spells, arcane turrets |

---

## 8. WARLOCK (base) — DRAFT (full pool, for review)

- **Theme (through-line): FORBIDDEN POWER — sacrifice & attrition.** Warlocks pay
  their own resources (HP, minions) for outsized power and grind foes down with curses
  and drain, winning the war of attrition. Through-line: **Sacrifice + Summon (curses)**.
  Legal base attunement: **Shadow**.
- **Fantasy:** the dark caster who trades life for power and commands expendable minions.
- **Keywords introduced:** **Sacrifice** (pay HP, or consume a minion, for a big effect);
  **Summon** (Field Entities — minions with HP + a per-turn effect); **Curse** (lingering
  debuffs: Vulnerable / Decay / Weak); **Drain** (lifesteal — heal for a fraction of damage).
- **Primitives used:** Field Entities (minions).
- **Stat affinity:** **Focus + Might** (debuffs/curses + drain damage).
- **Two win-cons:** (1) **Curse attrition** — stack Vulnerable + DoT and grind the foe down
  faster than your own HP loss, sustained by Drain. (2) **Minion sacrifice** — summon
  expendable minions, then sacrifice them for burst/curses.
- **Full card pool (26 cards):**

  **Basics (starter, §14.2)** — **Shadow Bolt** (A,1: deal 6) · **Shroud** (S,1: 5 Block).

  | Group | Card | Type | Cost | Effect |
  |---|---|---|---|---|
  | Curse | Curse of Weakness | Skill | 1 | Apply 3 Weak. |
  | Curse | Curse of Agony `[S]` | Skill | 1 | Apply 5 Poison/Decay. |
  | Curse | Corruption | Skill | 1 | Apply 3 Vulnerable; draw 1. |
  | Curse | Hex | Attack | 1 | Deal 5; apply 2 Vulnerable. |
  | Curse | Doom | Skill | 2 | **Doom:** after 2 turns, deal 20 shadow damage to the target. |
  | Drain | Drain Life `[S]` | Attack | 1 | Deal 7; heal 4. |
  | Drain | Siphon Soul | Attack | 2 | Deal 10; if the target is debuffed, heal = damage dealt. |
  | Drain | Soul Leech | Attack | 2 | Deal 6 to all enemies; heal 2 per enemy hit. |
  | Sacrifice | Dark Pact | Skill | 0 | Lose 4 HP; gain 2 energy and draw 1. |
  | Sacrifice | Demonic Power | Skill | 1 | Lose 5 HP; gain 3 Strength. |
  | Sacrifice | Soul Harvest | Skill | 1 | Lose 6 HP; draw 3. |
  | Sacrifice | Sacrifice | Attack | 2 | **Sacrifice a minion:** deal damage = its current HP to all enemies. |
  | Summon | Summon Imp `[S]` | Skill | 1 | Summon an Imp (8 HP): deals 3/turn. |
  | Summon | Raise Thrall | Skill | 1 | Summon a Thrall (10 HP): taunts (intercepts) and Blocks 4/turn. |
  | Summon | Summon Voidling | Skill | 2 | Summon a Voidling (12 HP): applies 1 Vulnerable/turn. |
  | Power | Soul Link | Power | 2 | Whenever a minion dies, deal 5 to all enemies. |
  | Power | Pact Keeper | Power | 1 | The first time each turn you lose HP, draw 1. |
  | Power | Nightfall | Power | 2 | End of turn: apply 1 Vulnerable to all enemies. |
  | Power | Malefic Vision | Power | 1 | Your curses apply +1. |

  **Rarities:** basic Shadow Bolt/Shroud · common Curse of Weakness, Curse of Agony,
  Corruption, Hex, Drain Life, Dark Pact, Summon Imp · uncommon Doom, Siphon Soul, Demonic
  Power, Soul Harvest, Raise Thrall, Pact Keeper, Malefic Vision · rare Soul Leech, Sacrifice,
  Summon Voidling, Soul Link, Nightfall · epic Doom-tier left common; mark **Soul Link** epic
  if it overperforms. **Starters `[S]`:** Drain Life, Curse of Agony, Summon Imp.
- **AI bias:** curse/debuff first, then drain-burst; accepts self-HP loss to ramp; summons
  early; sacrifices minions for lethal; low defend threshold.
- **Hybrid through-line:** every Warlock-X keeps **Sacrifice + Summon/Curse** fused with X:
  | Hybrid | = Warlock + | Blend |
  |---|---|---|
  | **Death Knight** | Warrior | + Stances → raises minions, pays HP, tanks |
  | **Assassin** | Rogue | + Stealth/Combo → poison-&-curse killer; minions set up ambush |
  | **Necromancer** | Mage | + Conjure → conjures spells + raises the undead |
  | **Inquisitor** | Priest | + Faith → shadow-holy: heals self by harming others |
  | **Witch Doctor** | Shaman | + Totems → curse totems, hexing field auras |
  | **Demon Hunter** | Ranger | + Mark/Traps → marks prey, drains the marked |
  | **Felcrafter** | Engineer | + Constructs → fel-powered constructs fueled by HP |

---

## 9. PRIEST (base) — DRAFT (full pool, for review)

- **Theme (through-line): FAITH & PROTECTION.** Priests keep the line alive — heal,
  shield, cleanse — and **weaponize the healing they do**. Through-line: **Faith + Prayer**.
  Legal base attunement: **Holy**.
- **Fantasy:** the holy protector who turns devotion into both salvation and judgment.
- **Keywords introduced:** **Faith** (a per-turn counter of HP healed; payoff cards scale
  with it); **Prayer** (heal / Regen / cleanse); **Smite** (Holy damage that consumes a
  debuff on the target for bonus — §5.2); **Aegis** (grant Block/protection to an ally,
  reaching the bench).
- **Primitives used:** none new (heal/regen/cleanse + bench targeting already in the model).
- **Stat affinity:** **Resolve + Focus** (sustain/self-buffs + potent heals on allies).
- **Two win-cons:** (1) **Faith battery** — heal a lot, then cash Faith into damage/buffs
  (a healer that weaponizes healing). (2) **Protection tank** — Regen + ally Block + cleanse
  keep the Vanguard unkillable; outlast.
- **Full card pool (26 cards):** *(heals on allies scale with Focus; self-buffs with Resolve.)*

  **Basics (starter, §14.2)** — **Smite** (A,1: deal 6) · **Sanctuary** (S,1: 5 Block).

  | Group | Card | Type | Cost | Effect |
  |---|---|---|---|---|
  | Heal | Heal `[S]` | Skill | 1 | Restore 8 HP to an ally. |
  | Heal | Renew | Skill | 1 | Apply 3 Regen to an ally. |
  | Heal | Lay on Hands | Skill | 2 | Restore 14 HP to an ally. |
  | Heal | Prayer of Mending | Skill | 1 | Restore 5 HP to all allies. |
  | Protect | Divine Shield | Skill | 1 | An ally gains 8 Block. |
  | Protect | Sanctify | Skill | 1 | Fortify slot: 6 Block for 2 turns. |
  | Protect | Guardian Spirit | Skill | 2 | An ally: the next lethal hit leaves it at 1 HP (once). |
  | Cleanse | Purify | Skill | 1 | Remove a debuff from an ally; restore 4 HP. |
  | Faith | Holy Nova | Attack | 1 | Deal damage = HP **healed this turn** (max 12) to all enemies. |
  | Faith | Judgment | Attack | 2 | Deal 8, **+1 per 2 HP healed** this turn. |
  | Faith | Zealotry | Skill | 1 | Gain Strength = (healing this turn ÷ 5). |
  | Faith | Conviction | Attack | 1 | Deal 7; if you healed this turn, +5. |
  | Smite | Condemn `[S]` | Attack | 2 | Deal 10. **Smite:** if the target has a debuff, consume it for +6. |
  | Smite | Holy Fire | Attack | 1 | Deal 6; apply 2 Burn (radiant). |
  | Smite | Searing Light | Attack | 2 | Deal 5 to all enemies; cleanse 1 self debuff. |
  | Buff | Inspire | Skill | 1 | An ally gains 2 Strength. |
  | Buff | Benediction | Skill | 1 | All allies gain 3 Block and 1 Regen. |
  | Power | Faith `[S]` | Power | 2 | Whenever you heal, deal 2 to a random enemy. |
  | Power | Divinity | Power | 2 | The first heal each turn is doubled. |
  | Power | Martyrdom | Power | 1 | When an ally would die, heal it 6 instead (once/combat). |
  | Power | Halo | Power | 1 | Start of turn: all allies gain 1 Regen. |

  **Rarities:** basic Smite/Sanctuary · common Heal, Renew, Divine Shield, Purify, Conviction,
  Holy Fire, Inspire · uncommon Lay on Hands, Prayer of Mending, Sanctify, Judgment, Zealotry,
  Condemn, Benediction · rare Guardian Spirit, Holy Nova, Searing Light, Faith, Divinity, Halo
  · epic Martyrdom. **Starters `[S]`:** Heal, Condemn, Faith.
- **AI bias:** sustain threshold 0.6; heal/protect the lowest ally; swaps to shield a dying
  ally; once topped up, weaponizes Faith into damage.
- **Hybrid through-line:** every Priest-X keeps **Faith + Prayer** fused with X:
  | Hybrid | = Priest + | Blend |
  |---|---|---|
  | **Paladin** | Warrior | + Stances → tanky holy protector on the line |
  | **Monk** | Rogue | + Stealth/Combo → martial artist; chains strikes with self-sustain |
  | **Arcanist** | Mage | + Conjure → holy-arcane burst with sustain |
  | **Inquisitor** | Warlock | + Curses → heals self by harming others |
  | **Cleric** | Shaman | + Totems → healing totems, faith auras |
  | **Sentinel** | Ranger | + Mark/Traps → protective marks, guardian traps |
  | **Medic** | Engineer | + Constructs → repair-bots, healing turrets |

---

## 10. SHAMAN (base) — DRAFT (full pool, for review)

- **Theme (through-line): ELEMENTAL SPIRITS — totems & field control.** Shamans win
  by placing persistent **totems** and seeding the field with statuses that snowball and
  trigger reactions. Through-line: **Totem + status spread**. Legal base attunements:
  **Nature / Water / Air / Stone**.
- **Fantasy:** the elementalist who commands spirits and bends the battlefield's weather.
- **Keywords introduced:** **Totem** (Field Entity in an aux/fortify zone: ticks an effect
  each turn for a lifespan); **Spread** (a status copies to another unit); **Soak** (a
  reaction primer — §5.2).
- **Primitives used:** Field Entities (totems).
- **Stat affinity:** **Focus + Guard** (status potency + aura/Block).
- **Two win-cons:** (1) **Totem engine** — stack persistent totems (damage/heal/block each
  turn) and snowball. (2) **DoT/reaction spread** — apply DoTs + Soak, spread them, trigger
  reactions.
- **Full card pool (26 cards):** *(totem/DoT effects scale with Focus; Block/auras with Guard.)*

  **Basics (starter, §14.2)** — **Lightning Jolt** (A,1: deal 6) · **Stoneskin** (S,1: 5 Block).

  | Group | Card | Type | Cost | Effect |
  |---|---|---|---|---|
  | Totem | Searing Totem `[S]` | Skill | 1 | Totem (3 turns): deal 4/turn to a random enemy. |
  | Totem | Stoneclaw Totem `[S]` | Skill | 1 | Totem (3 turns): grant you 4 Block/turn. |
  | Totem | Healing Totem | Skill | 1 | Totem (3 turns): heal allies 3/turn. |
  | Totem | Windfury Totem | Skill | 2 | Totem (3 turns): draw +1/turn. |
  | Totem | Grounding Totem | Skill | 1 | Totem (3 turns): absorb the next debuff each turn. |
  | DoT | Poison Spit `[S]` | Attack | 1 | Deal 5; apply 3 Poison. |
  | DoT | Frostbrand | Attack | 1 | Deal 5; apply 1 Weak. |
  | DoT | Lava Burst | Attack | 2 | Deal 8; apply 3 Burn. |
  | Primer | Soak | Skill | 1 | Apply 2 Soak (reaction primer). |
  | Primer | Earth Shock | Attack | 1 | Deal 6; if the target is Soaked, +4. |
  | Spread | Chain Lightning | Attack | 2 | Deal 6 to the Vanguard, 3 to one bench enemy. |
  | Spread | Contagion | Skill | 1 | Spread all DoTs on the target to one other enemy. |
  | Spread | Tremor | Attack | 2 | Deal 4 to all enemies; +2 if any enemy is Soaked. |
  | Utility | Regrowth | Skill | 1 | Apply 3 Regen; gain 4 Block. |
  | Utility | Spirit Surge | Skill | 0 | Gain 1 energy, +1 more per totem you control. |
  | Utility | Ancestral Aid | Skill | 1 | Draw 2. |
  | Power | Elemental Mastery | Power | 2 | Your totems last +1 turn and tick +1. |
  | Power | Totemic Focus | Power | 1 | When you place a totem, gain 3 Block. |
  | Power | Spirit Bond | Power | 2 | Whenever a totem ticks, heal 1. |
  | Power | Overgrowth | Power | 1 | Your DoTs apply +1. |

  **Rarities:** basic Lightning Jolt/Stoneskin · common Searing Totem, Stoneclaw Totem, Poison
  Spit, Frostbrand, Soak, Regrowth, Ancestral Aid · uncommon Healing Totem, Windfury Totem,
  Lava Burst, Earth Shock, Chain Lightning, Spirit Surge, Totemic Focus, Overgrowth · rare
  Grounding Totem, Contagion, Tremor, Elemental Mastery, Spirit Bond · epic — mark **Elemental
  Mastery** epic if totem stacks overperform. **Starters `[S]`:** Searing Totem, Stoneclaw
  Totem, Poison Spit.
- **AI bias:** place totems first; stack DoTs + Soak; medium defend; plays the long game.
- **Hybrid through-line:** every Shaman-X keeps **Totems + status spread** fused with X:
  | Hybrid | = Shaman + | Blend |
  |---|---|---|
  | **Warmonger** | Warrior | + Stances → war-totems that amp aggression |
  | **Stalker** | Rogue | + Stealth/Combo → ambush + lingering field traps |
  | **Druid** | Mage | + Conjure → conjured elemental spirits |
  | **Witch Doctor** | Warlock | + Curses → curse totems, hexing auras |
  | **Cleric** | Priest | + Faith → healing totems, faith auras |
  | **Beastmaster** | Ranger | + Mark/Companion → spirit beasts, totemic pets |
  | **Tracker** | Engineer | + Constructs → totem-tech, mechanical spirits |

---

## 11. RANGER (base) — DRAFT (full pool, for review)

- **Theme (through-line): THE HUNT — mark & traps.** Rangers control range and
  information: they **Mark** a target to focus it down past the frontline and pre-set
  **Traps** that punish the enemy's plan (huge synergy with Peek). Through-line: **Mark +
  Traps**. Legal base attunements: **Physical / Nature**.
- **Fantasy:** the tracker who picks off the dangerous target and turns the field against you.
- **Keywords introduced:** **Mark** (apply Mark; your cards deal bonus vs the Marked target
  and may **reach the bench** past the Vanguard); **Trap** (Delayed Trigger — fires on the
  enemy's next matching action); **Companion** (a beast Field Entity that strikes the Marked
  target).
- **Primitives used:** Delayed Triggers (traps) + Field Entities (companion).
- **Stat affinity:** **Might + Focus** (precise damage + Mark/debuff setup).
- **Two win-cons:** (1) **Mark focus-fire** — Mark a backline threat, then pierce/snipe it
  down past the Vanguard. (2) **Trap control** — pre-set traps that punish the enemy's
  forecasted actions; the Peek archetype.
- **Full card pool (26 cards):**

  **Basics (starter, §14.2)** — **Quick Shot** (A,1: deal 6) · **Roll** (S,1: 5 Block).

  | Group | Card | Type | Cost | Effect |
  |---|---|---|---|---|
  | Mark | Hunter's Mark `[S]` | Skill | 1 | Apply **Mark** to any enemy; draw 1. |
  | Mark | Precision `[S]` | Attack | 1 | Deal 6; +6 vs the Marked target. |
  | Mark | Hunt | Attack | 1 | Deal 5 to a bench enemy (piercing); +4 if Marked. |
  | Mark | Aimed Shot | Attack | 2 | Deal 12 to any single enemy (incl. bench, piercing). |
  | AoE | Multishot | Attack | 2 | Deal 4 to all enemies. |
  | AoE | Volley | Attack | 2 | Deal 5 to the Vanguard and 5 to one bench enemy. |
  | AoE | Rapid Fire | Attack | X | Deal 4 damage **X times**. |
  | Trap | Bear Trap `[S]` | Skill | 1 | **Trap:** when the enemy next attacks, deal 10 and apply 2 Weak. |
  | Trap | Snare | Skill | 1 | **Trap:** the enemy's next swap is cancelled; deal 6. |
  | Trap | Explosive Trap | Skill | 2 | **Trap:** at the start of the enemy turn, deal 6 to all enemies. |
  | Trap | Caltrops | Skill | 1 | **Trap (field):** the enemy takes 3 whenever it acts. |
  | Companion | Summon Hawk | Skill | 1 | Companion (8 HP): deals 4/turn to the Marked target. |
  | Companion | Summon Wolf | Skill | 2 | Companion (12 HP): deals 5/turn to the Vanguard. |
  | Utility | Camouflage | Skill | 1 | Gain 8 Block; can't be bench-pierced next turn. |
  | Utility | Track | Skill | 0 | Reveal an enemy planned action (mini-Peek); draw 1. |
  | Utility | Natural Remedy | Skill | 1 | Apply 3 Regen. |
  | Power | Open Season | Power | 2 | Your attacks deal +4 vs Marked targets. |
  | Power | Trapper | Power | 1 | Your traps deal +50%. |
  | Power | Steady Aim | Power | 1 | The first attack each turn can pierce to any target. |
  | Power | Pack Bond | Power | 2 | Your companion also attacks whenever you play an Attack. |

  **Rarities:** basic Quick Shot/Roll · common Hunter's Mark, Precision, Hunt, Multishot,
  Caltrops, Track, Natural Remedy · uncommon Aimed Shot, Volley, Bear Trap, Snare, Summon Hawk,
  Camouflage, Trapper, Steady Aim · rare Rapid Fire, Explosive Trap, Summon Wolf, Open Season,
  Pack Bond · epic — mark **Open Season** epic if Mark stacking overperforms. **Starters `[S]`:**
  Hunter's Mark, Precision, Bear Trap.
- **AI bias:** Mark the biggest threat (often a benched one); focus-fire it past the Vanguard;
  pre-set traps reading its own forecast; medium defend.
- **Hybrid through-line:** every Ranger-X keeps **Mark + Traps** fused with X:
  | Hybrid | = Ranger + | Blend |
  |---|---|---|
  | **Hunter** | Warrior | + Stances → martial tracker |
  | **Scout** | Rogue | + Stealth/Combo → recon assassin: marks, traps, stealth |
  | **Spellbow** | Mage | + Conjure → channeled arcane shots, magic traps |
  | **Demon Hunter** | Warlock | + Curses → marks prey, drains the marked |
  | **Sentinel** | Priest | + Faith → protective marks, guardian traps |
  | **Beastmaster** | Shaman | + Totems → spirit beasts, totemic pets |
  | **Trapper** | Engineer | + Constructs → mechanical traps, gadget snares |

---

## 12. ENGINEER (base) — DRAFT (full pool, for review)

- **Theme (through-line): INVENTION — constructs & scaling block.** Engineers build a
  machine: deploy **Constructs**, generate one-shot **Gadgets**, and ramp Block/energy into
  an engine that grinds the foe out. Through-line: **Construct + Gadget**. Legal base
  attunements: **Physical / Stone**.
- **Fantasy:** the gadgeteer who turns the fight into a fortress of turrets and shields.
- **Keywords introduced:** **Construct** (Field Entity: turret/drone/sentry with HP + a
  per-turn effect); **Gadget** (Card Generation — add a one-shot *ethereal* gadget card);
  **Overdrive** (energy ramp, often paid in Block); block-as-resource scaling.
- **Primitives used:** Field Entities (constructs) + Card Generation (gadgets).
- **Stat affinity:** **Guard + Speed** (Block scaling + energy/gadget tempo).
- **Two win-cons:** (1) **Fortress** — stack Block + Constructs (turrets that punish
  attackers) into an unkillable wall that wins slowly. (2) **Gadget tempo** — generate cheap
  gadgets + ramp energy into a machine that does everything.
- **Full card pool (26 cards):** *(Block scales with Guard; energy/gadget tempo with Speed.)*

  **Basics (starter, §14.2)** — **Wrench Strike** (A,1: deal 6) · **Plating** (S,1: 5 Block).

  | Group | Card | Type | Cost | Effect |
  |---|---|---|---|---|
  | Block | Reinforce `[S]` | Skill | 1 | Gain 8 Block. |
  | Block | Barricade | Skill | 2 | Gain 12 Block; it Braces this turn. |
  | Block | Overcharge Shield | Skill | 1 | Gain Block = 4 + (Constructs you control × 3). |
  | Block | Deflector | Skill | 1 | Gain 6 Block; when hit this turn, deal 3 back. |
  | Construct | Deploy Turret `[S]` | Skill | 1 | Turret (10 HP): deals 4/turn. |
  | Construct | Deploy Shield Drone | Skill | 1 | Drone (8 HP): grants you 3 Block/turn. |
  | Construct | Repair Bot | Skill | 1 | Bot (8 HP): heal 3/turn. |
  | Construct | Deploy Bombard | Skill | 2 | Bombard (12 HP): deals 6 to all enemies every 2 turns. |
  | Construct | Sentry | Skill | 1 | Sentry (8 HP): attacks any enemy that swaps in for 5. |
  | Gadget | Toolbox `[S]` | Skill | 0 | **Gadget:** add 2 ethereal gadgets (Bomb / Patch / Battery). |
  | Gadget | Fabricate | Skill | 1 | **Gadget:** conjure a random gadget; draw 1. |
  | Gadget | Bomb | Attack | 1 | *(ethereal gadget)* Deal 8. |
  | Gadget | Battery | Skill | 0 | *(ethereal gadget)* Gain 2 energy. |
  | Energy | Overdrive | Skill | 1 | Gain 2 energy; lose 3 Block. |
  | Energy | Recycle | Skill | 1 | Scrap a card from hand: gain 2 energy and 4 Block. |
  | Damage | Flamethrower | Attack | 2 | Deal 5 to all enemies; apply 2 Burn. |
  | Damage | Railgun | Attack | 2 | Deal 14; +1 per energy spent this turn. |
  | Damage | Piston Punch | Attack | 1 | Deal 7; +3 if you have any Block. |
  | Power | Mass Production | Power | 2 | The first Gadget each turn costs 0. |
  | Power | Auto-Defense | Power | 1 | Start of turn: gain 3 Block. |
  | Power | Reinforced Constructs | Power | 2 | Your constructs have +50% HP and tick +1. |
  | Power | Overclock | Power | 1 | When you gain energy, gain 1 Block per energy. |

  **Rarities:** basic Wrench Strike/Plating · common Reinforce, Overcharge Shield, Deflector,
  Deploy Turret, Deploy Shield Drone, Toolbox, Piston Punch · uncommon Barricade, Repair Bot,
  Sentry, Fabricate, Overdrive, Recycle, Flamethrower, Auto-Defense · rare Deploy Bombard,
  Railgun, Mass Production, Reinforced Constructs, Overclock · epic — mark **Reinforced
  Constructs** epic if construct stacking overperforms. **Starters `[S]`:** Deploy Turret,
  Reinforce, Toolbox.
- **AI bias:** defend threshold 0.6; deploy constructs early; scales late into a fortress;
  anchors (rarely swaps).
- **Hybrid through-line:** every Engineer-X keeps **Constructs + Gadgets** fused with X:
  | Hybrid | = Engineer + | Blend |
  |---|---|---|
  | **Ironclad** | Warrior | + Stances → armored gadgeteer, extra-tanky |
  | **Saboteur** | Rogue | + Stealth/Combo → bombs & traps + stealth infiltration |
  | **Artificer** | Mage | + Conjure → conjured gadget-spells, arcane turrets |
  | **Felcrafter** | Warlock | + Sacrifice → fel-constructs fueled by HP |
  | **Medic** | Priest | + Faith → repair-bots, healing turrets |
  | **Tracker** | Shaman | + Totems → totem-tech, mechanical spirits |
  | **Trapper** | Ranger | + Traps → mechanical traps, gadget snares |

---

## 13. Queue

| # | Archetype | Status |
|---|---|---|
| 1 | Warrior | ✅ locked (§5) |
| 2 | Rogue | 🔎 full draft (§6) — awaiting review → lock |
| 3 | Mage | 🔎 full draft (§7) — awaiting review |
| 4 | Warlock | 🔎 full draft (§8) — awaiting review |
| 5 | Priest | 🔎 full draft (§9) — awaiting review |
| 6 | Shaman | 🔎 full draft (§10) — awaiting review |
| 7 | Ranger | 🔎 full draft (§11) — awaiting review |
| 8 | Engineer | 🔎 full draft (§12) — awaiting review |
| 9–36 | 28 hybrids | ⏳ (after the 8 bases lock) |

> **All 8 base archetypes drafted 2026-06-22.** Numbers throughout are
> provisional/tunable. **New engine primitives** the drafts require before they can be
> authored as data: **Stealth** State + **Combo** counter (Rogue), **Conjure**/ethereal
> card-gen + **Channel** delayed triggers + **Amplify** (Mage), **Summon**/minion Field
> Entities + **Sacrifice** + **Doom** delayed (Warlock), **Faith** counter + ally/bench
> heal-protect + **Smite** consume-debuff (Priest), **Totem** Field Entities + **Soak**/
> reactions + DoT **Spread** (Shaman), **Mark** + **Trap** delayed triggers + **Companion**
> Field Entities (Ranger), **Construct** Field Entities + **Gadget** card-gen + block-as-
> resource (Engineer). These cluster into the §2 primitives (Field Entities, States,
> Delayed Triggers, Card Generation) — the natural next engine build after the bases lock.

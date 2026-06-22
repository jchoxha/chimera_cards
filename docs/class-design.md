# Class Design — the 36 Classes (Topic 5)

> Companion to `docs/synthesis-matrix-spec.md`. Designs every class in the Class
> axis: **8 base classes** + **28 hybrids ("subclasses")**. Status: framework
> locked 2026-06-21; **Warrior LOCKED**, **Rogue full draft** (awaiting review);
> Mage→Engineer queued.

## 1. The base / subclass model (LOCKED 2026-06-21)

- Each **base class** (8) has a **THEME** — a through-line identity — plus a
  **signature mechanic** and a stat affinity.
- Every **subclass** is a hybrid of **two** base classes (e.g. *Gladiator* =
  Warrior+Rogue). A subclass **inherits BOTH parents' themes** and layers a
  **bespoke mechanic** of its own.
- Consequence: **subclasses are inherently more powerful/versatile than bases**
  (two themes vs one). This is intended — but must be **balanced** (§4).
- Each base therefore has **7 subclasses** (itself + each of the 7 others), and its
  theme runs through all 7.

### Design order (dependency-correct)
Design all **8 base themes first** (a subclass needs both parents defined), then the
**28 subclasses**. Per Jeton: go through **all** combinations 1-by-1, custom mechanic
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

## 3. Per-class design template

Each class entry fills:
- **Theme (through-line)** — inherited by all its subclasses.
- **Fantasy** — flavor.
- **Signature mechanic / keyword** — the distinctive end-result mechanic.
- **Primitives used** — from §2.
- **Stat affinity** — from the 5-stat model (Might/Guard/Focus/Resolve/Speed).
- **Card archetypes** — representative cards + the stat each scales with.
- **AI bias** — planner priorities.
- **Subclass through-line** — how the theme shows up across its 7 hybrids.

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
- **Subclass through-line:** every Warrior-X keeps **Stances + martial reliability**,
  fused with X's theme:
  | Subclass | = Warrior + | Blend (Stances + …) |
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
- **Subclass through-line:** every Rogue-X keeps **Stealth + Combo**, fused with X:
  | Subclass | = Rogue + | Blend (Stealth/Combo + …) |
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

## 7. Queue

| # | Class | Status |
|---|---|---|
| 1 | Warrior | ✅ locked (§5) |
| 2 | Rogue | 🔎 full draft (§6) — full 26-card pool + rulings locked; awaiting review → lock |
| 3 | Mage | ⏳ |
| 4 | Warlock | ⏳ |
| 5 | Priest | ⏳ |
| 6 | Shaman | ⏳ |
| 7 | Ranger | ⏳ |
| 8 | Engineer | ⏳ |
| 9–36 | 28 subclasses | ⏳ (after bases) |

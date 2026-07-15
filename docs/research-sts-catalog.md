# Research Archive — Slay the Spire mechanics & mods (raw findings)

*Compiled 2026-07-15.* The **source material** behind `effect-vocabulary.md` (which is the *synthesized*
design catalog). This file preserves the raw research so we can trace any decision back to its provenance.
Five parallel deep-research sweeps + a follow-up on the same-named "Chimera Cards" mod. All numbers are
**StS1 unless flagged StS2**; wiki hosts (wiki.gg, Fandom, Steam Workshop) return 403 to automated fetch,
so several figures come from search snippets or (for Downfall) the mod's shipped localization JSON.

**Contents:** §1 StS1 base game · §2 StSLib/BaseMod/ModTheSpire libraries · §3 Downfall's 9 villains +
Hermit · §4 ~40 custom-character mods · §5 novel statuses & scaling axes · §6 the "Chimera Cards" /
CardAugments modifier mod (same name as our project).

---

## 1. StS1 BASE GAME — keywords, statuses, build identities, relics, hooks

### 1.1 Card keywords
- **Exhaust** — removed from deck for the combat when played (→ exhaust pile, not discard). Fuels
  exhaust-payoff economies (Feel No Pain, Dark Embrace, Charon's Ashes, Dead Branch).
- **Ethereal** — if still in hand at end of turn, Exhausted instead of discarded.
- **Innate** — starts in the opening hand every combat (guaranteed turn 1).
- **Retain** — not discarded at end of turn; held into the next turn.
- **Unplayable** — can't be played (Statuses Dazed/Wound/Slimed/Void/Burn + most Curses).
- **X-cost** — spends all remaining energy; effect scales per energy spent.
- **0-cost / free** — no energy; fuels combo/spam and "cards played" counters.
- **Cost reduction** — temporary (Eviscerate −1/discard) or permanent (Madness → 0-cost); Snecko Eye
  randomizes cost 0–3.
- Every card has an **upgrade (+)** variant (numbers/cost/keywords/downside-removal).

### 1.2 Status/power effects
**Intensity** (holds value): Strength (+dmg/hit), Dexterity (+Block/card), Focus (Defect orb magnitude),
Metallicize (+Block end of turn), Plated Armor (+Block end of turn, −1 on unblocked hit), Thorns,
Barricade (Block never expires), Rupture (+Str on HP loss from cards), Demon Form (+Str/turn compounding),
Juggernaut (Block gain → random dmg), Envenom (unblocked hit → +1 Poison), After Image (+1 Block/card),
Infinite Blades (Shiv/turn), Noxious Fumes (Poison-all/turn), Panache (5 cards → dmg all).
**Duration** (−1/turn): Vulnerable (+50% attack dmg taken), Weak (−25% dmg dealt), Frail (−25% Block from
cards), Intangible (all dmg→1), Blur (Block doesn't expire this turn), Flame Barrier (reflect this turn).
**DoT/special**: Poison (lose = stacks at start of turn, then −1; ignores Block; lifetime X(X+1)/2), Burn
(end-of-turn dmg), Regen (heal N end of turn, −1/turn), Constricted (flat end-of-turn dmg, no decay),
Buffer (negate next N HP-loss instances), Rage (+Block per attack this turn), Corruption (Skills cost 0 +
Exhaust), Berserk (self-Vulnerable → +1 energy/turn), Combust (end turn: −1 HP, dmg all).
**Watcher**: Wrath (deal 2× / take 2×), Calm (+2 energy on exit), Divinity (deal 3×, +3 energy on enter,
auto-exit next turn), Mantra (≥10 → Divinity), Establishment (Retain → cost −1), Mental Fortress (Block on
stance change).
**Debuff-cards / curses**: Wound, Dazed (Ethereal), Slimed (1-cost Exhaust), Burn, Void (−1 energy on
draw), Curses (Regret/Decay/Doubt/Shame/Pain/Writhe/Normality/Pride/Parasite/Necronomicurse…).

### 1.3 The 21 scaling build identities (win-con · engine · axis)
Ironclad: **1 Strength** (Demon Form/Limit Break/Heavy Blade — ×hit-count), **2 Block/Barricade/Body-Slam**,
**3 Exhaust** (Corruption/Dead Branch/Feel No Pain), **4 Self-damage/HP-cost** (Rupture/Brutality/Offering),
**5 Powers-per-turn**. Silent: **6 Poison** (Noxious Fumes/Catalyst/Corpse Explosion), **7 Shiv/0-cost**
(Infinite Blades/Accuracy/Finisher), **8 Discard** (Tactician/Reflex/Eviscerate), **9 Deck-thinning**.
Defect: **10 Orb/Focus**, **11 Lightning** (aggressive), **12 Frost** (defensive), **13 Claw/0-cost**,
**14 Power-spam** (Machine Learning/Echo Form/Creative AI). Watcher: **15 Stance-dance** (Wrath/Calm),
**16 Divinity/Mantra**, **17 Retain-hold**, **18 Wrath-nuke** (Ragnarok/Lesson Learned). Universal:
**19 Card-draw/infinite** loops, **20 Multi-hit/on-hit triggers**, **21 0-cost/cards-played spam**.

### 1.4 Energy/resource concepts
Base 3 energy/turn (lost if unspent unless Ice Cream banks it). X-cost (spend all → scale per point).
Energy-gen relics (Coffee Dripper/Cursed Key/Ectoplasm/Sozu/Mark of Pain/Runic Dome/Slaver's Collar/Velvet
Choker — each trades a downside for +1). Snecko Eye (draw +2, randomize costs). Chemical X (+2 to X-effect).

### 1.5 Relic levers (representative)
Energy-gen (§1.4). Scaling-triggers: Vajra (+Str start), Girya (train +Str), Pen Nib (every 10th attack 2×),
Nunchaku (10 cards → +1 energy), Shuriken/Kunai/Ornamental Fan (every 3 attacks → +Str/+Dex/+Block).
Turn-start: Anchor (10 Block T1), Bag of Prep (draw +2 T1), Data Disk (+Focus), Damaru (+Mantra/turn).
On-shuffle: Sundial (3 shuffles → +2 energy), Abacus (+6 Block). On-play-type: Letter Opener (3 Skills →
5 dmg all), Mummified Hand (Power → a card 0-cost), Bird-Faced Urn (Power → heal 2). On-exhaust: Charon's
Ashes, Dead Branch. On-HP-loss: Runic Cube (draw), Self-Forming Clay (+Block next turn), Red Skull (<50%
→ +3 Str), Centennial Puzzle (first loss → draw 3). Mitigation: Torii (≤5 → 1), Tungsten Rod (−1 loss),
Boot (attacks <5 → 5). Draw: Runic Pyramid (don't discard hand), Unceasing Top (draw when hand empty).

### 1.6 Trigger/timing hooks (the "when")
Turn-boundary (start/end/Nth turn, on-draw, no-draw). Card-play (on-cast any/Attack/Skill/Power, on Nth
card, on 0-cost, on first card, on X-spend). Deck-flow (on-shuffle, on-discard, on-exhaust, on-Retain, on
draw Status/Curse, hand-empty). Combat (on unblocked dmg, per-hit, on-attack count, on-being-attacked, on
HP-loss, on-block-gain, on 0-Block end of turn). Thresholds (at X resource stacks → Mantra/Mode Shift,
HP% crossing, Poison tick, stance change/enter, Power played, orb channel/evoke/slot-empty, on-kill,
on-scry).

### 1.7 Key precision notes
Vulnerable ×1.5 attack; Weak ×0.75 dealt; Frail ×0.75 Block-from-cards. Duration debuffs −1 at end of the
*afflicted's* turn; intensity buffs hold; Poison both deals *and* decays; Regen decays 1/turn. Block
expires at start of your turn unless Barricade/Calipers/Blur. Multi-hit multiplies per-hit intensity
(Strength/Poison-on-hit/Thorns) — a central lever.

---

## 2. StSLib / BaseMod / ModTheSpire — the modding stack

### 2.1 ModTheSpire (patching backbone)
`@SpirePatch` (insert/prefix/postfix/instrument/raw), `SpireField<T>` (attach a new field to a base class —
how nearly every StSLib keyword is implemented), `@SpireEnum` (new enum values: CardTarget/CardColor/player
classes), `SpireReturn` (short-circuit a method — backs "can-negate" hooks), `SpireConfig` (persistence).

### 2.2 StSLib custom keywords (each a SpireField opt-in)
**Autoplay** (plays itself on draw), **Exhaustive(N)** (N charges then Exhausts; `ExhaustiveNegationPower`
can stop the tick), **Fleeting** (Purges — gone for the run), **Grave** (starts combat in discard),
**Persist(N)** (only discards after N plays/turn; `OnPersistPower`), **Purge** (removed for combat but NOT
to exhaust pile — un-Exhumable), **Refund(N)** (returns up to N energy spent), **Retain/AlwaysRetainField**,
**Snecko** (randomize own cost on draw), **Soulbound** (can't be removed from deck), **Startup** (fires at
combat start; `StartupCard`).

### 2.3 StSLib card interfaces
**BranchingUpgradesCard** (two upgrade paths, chosen at campfire), **MultiUpgradeCard** (multiple sequential
upgrades), **SpawnModificationCard** (`canSpawn()` reject+reroll, `replaceWith()` substitute,
`onRewardListCreated()`), **OnObtainCard** (on pickup), **CommonKeywordIconsField** (inline keyword icons),
**ExtraEffectModifier** + **DynamicProvider** (cleanly add an extra effect to a card with auto-scaling text).

### 2.4 Damage Modifier system (the biggest reusable pattern)
`AbstractDamageModifier` — override `onAttackToChangeDamage`, `ignoresBlock(target)`,
`onLastDamageTakenUpdate`, `getCardDescriptor`, `isInherent`, `makeCopy`. `DamageModifierManager` attaches
mods to a card (auto-bind during `use()`). `BindingHelper`/`DamageModContainer` for non-card sources.
Push-hooks: `DamageModApplyingPower` / `DamageModApplyingRelic`. **The clean model for multi-hit / ignores-
block / typed-bonus / on-unblocked-callback riders.**

### 2.5 Block Modifier system
`AbstractBlockModifier` — `amountLostAtStartOfTurn()` (control decay), `onStartOfTurnBlockLoss`,
`isInherent`. `BlockModifierManager` (First-In→Last-Out consumption). Example **SpicyBlock** (decays 5/turn,
grants Vigor = amount lost). Hooks: `OnCreateBlockInstancePower/Relic`. → typed Block resources (temp-HP,
Shielding, Barricade-like).

### 2.6 Custom actions
StunMonsterAction (skip a turn; `StunMonsterPower`), FetchAction (pile→hand), MoveCardsAction,
AddTemporaryHPAction / RemoveAllTemporaryHPAction, EvokeSpecificOrbAction, TriggerPassiveAction,
SelectCardsAction / SelectCardsInHandAction / MultiGroupSelectAction / MultiGroupMoveAction,
DamageCallbackAction (run callback with *actual unblocked* damage → Wallop-style).

### 2.7 Temporary HP
A full subsystem: `TemporaryHPField`, display power, add/remove actions, `OnLoseTempHpPower/Relic`. Absorbs
damage before real HP — the reusable "second health resource." (StSLib ships NO generic second-energy
system; alt-energy is patched per-mod.)

### 2.8 StSLib power hooks (interfaces on a power)
**Can-negate/behavioral**: `BetterOnApplyPowerPower` (negate + change stacks), `OnReceivePowerPower`
(negate a buff/debuff applied to owner), `BetterOnExhaustPower` (knows CardGroup; works on monsters),
`BeforeRenderIntentPower` (hide intent), `OnLoseBlockPower`, `OnMyBlockBrokenPower`, `OnLoseTempHpPower`,
`OnPlayerDeathPower` (**prevent death**), `OnCardDrawPower`, `OnDrawPileShufflePower`, `OnPersistPower`,
`OnCreateCardInterface` (react to cards made mid-combat), `OnCreateBlockInstancePower`,
`DamageModApplyingPower`. **Markers**: `InvisiblePower`, `NonStackablePower`, `TwoAmountPower`,
`HealthBarRenderPower`.

### 2.9 StSLib relic hooks
ClickableRelic, OnReceivePowerRelic / OnApplyPowerRelic / OnAnyPowerAppliedRelic (all can-negate),
BetterOnLoseHpRelic, BetterOnSmithRelic, BetterOnUsePotionRelic, OnAfterUseCardRelic, OnChannelRelic,
OnSkipCardRelic / CardRewardSkipButtonRelic, OnRemoveCardFromMasterDeckRelic, OnPlayerDeathRelic
(prevent death), SuperRareRelic, OnCreateCardInterface.

### 2.10 Custom targeting + BaseMod bus
Custom `CardTarget` via `@SpireEnum` + `TargetingHandler<T>`. BaseMod subscriber bus (implement + subscribe):
OnPlayerTurnStart[PostDraw], PostDraw, PostExhaust, OnCardUse, PreMonsterTurn (skip a turn),
OnStartBattle/PostBattle, PostEnergyRecharge, OnPlayerDamaged (modify amount), OnPlayerLoseBlock,
PostPowerApply, MaxHpChange, OnCreateDescription, + the Edit*/PostInitialize content-registration hooks and
per-frame render hooks.

**Adopt into combat-v2:** (1) modifier-manager pattern for damage/block riders; (2) the can-negate hook
shape for the subtype wild-card engine (Undying/Ward/immunities); (3) temp-HP as a distinct absorb layer
(parallels our Block-as-temp-HP).

---

## 3. DOWNFALL — 9 villains + Hermit (verbatim keyword text)

Source of truth: `mikemayhemdev/DownfallSTS` per-character `localization/eng/KeywordStrings.json`. Only the
Hermit is a "standard mode" hero; the other nine are "Downfall mode" villains. Time Eater/Spirits/Wretch are
enemies, **not** playable.

### Shared pool
Goop (next attack +1 dmg/Goop, clears, triggers Consume), Pyre (exhaust a card in addition to energy cost),
Doom (lose HP = stacks at turn start, then removed **unless Afflicted = has both Weak AND Vulnerable**),
Echo (add an Ethereal-Exhaust copy; Echoes can't be Echoed), Exhume/Reclaim, Temporary HP, Blur, Invincible
(can't lose > N HP in a turn), Plated Armor, Boss (1 Boss card/turn). **Blights** = detrimental relic-bar
passives (mainly Endless-mode handicaps; not a per-villain resource).

### Hermit (75 HP · Old Locket)
**Dead On** (bonus effect while card is in the MIDDLE of hand), **Concentration** (next Dead On fires
regardless of position). **Bruise** (target takes more attack dmg, wears off end of turn), **Rugged**
(reduce next attack-dmg instance to 2), **Stun**, **Bounty** (bonus gold on kill). → hand-ordering puzzle.

### Gremlins (~16 HP each · Mob Leader's Staff)
**Swap** between 5 gremlins, each a passive while leading: Fat (attack → 1 Weak all), Mad (+2 temp Str when
attacked), Shield (skill → +2 Block), Sneaky (0-cost attacks +2; attack → 2 dmg random), Wizard (skill →
+1 **Wiz**; at 3 Wiz, attacks consume all → +7 dmg). Agony (−80% attack dmg), Cripple (can't lose Weak; lose
HP = Weak at turn end), Steal. → swap-timing identity; protect the tiny active body.

### Slime Boss (65 HP · Heart of Goo)
**Goop/Consume** (prime → payoff-attack), **Split** (spawn a Slime minion that attacks each turn; full slots
→ auto-**Absorb** oldest → +1 Str), **Command** (leading Slime attacks), **Potency** (Focus-for-Slimes;
secondary effects +1 per 2 Potency). 13 minion types. **Lick** (0-cost Goop appliers), **Tackle** (big
attacks that self-damage). → Goop-burst / Split-swarm / Absorb-Strength.

### Guardian (mid HP · Bronze Gear)
**Defensive Mode** (stance: 3 Thorns + Block doesn't expire), **Brace X** (reduce HP-loss needed to trigger
Mode Shift), **Buffer**. **Socket/Gem** (place a Gem card into a card's Socket at a rest site → permanent
graft). **Stasis** (park a card N=cost+1 turns → returns cost 0), **Accelerate** (−1 Stasis counter),
**Volatile** (Exhausts when it leaves Stasis), **Package** (generate 3 Construct cards). → block-Thorns tank
/ Gem-socketing / Stasis-burst.

### Champ (80 HP · Champion's Crown)
Four stances w/ **Skill Bonus** (in-stance skills pay off) + **Finisher** (exit stance → cash-out bonus):
**Berserker** (skill → +2 Vigor; finisher → +1 Str), **Defensive** (skill → +3 Counter; finisher → +6
Block), **Gladiator** (skill → draw; finisher → next turn draw + energy, end turn), **Ultimate** (both
Defensive+Berserker; re-enter if left early). **Vigor** (next attack +dmg), **Counter** (next hit taken →
Riposte Strike for that much), **Fatigue** (lose HP, restored end of combat, can't die from it). → Vigor
stack / Counter reflect / Ultimate hybrid / Finisher tempo.

### Automaton (70 HP · Bronze Core)
**Encode** (encode a card; at 3 encoded, effects merge into a **Function** costing 1), **Compile** (rider
baked into the Function; a bad one = **Error**), Blur, Insert (shuffle a card in), Cycle (discard→draw). →
mid-combat deckbuilding: sequence 3 Encodes into the payoff Function you want.

### Snecko (85 HP · Snecko Soul)
**Muddle** (randomize a card's cost 0–3 this turn), **Overflow** (payoffs if hand > 5), **Lucky** (Overflow
always fires this turn), **Offclass** (obtainable other-class cards incl. Colorless/Curse/Status), **Gift**
(on obtain → a card reward of a type), **Venom** (target loses HP when you apply any non-Venom debuff). →
big-hand Overflow / Muddle gambling / Offclass chaos.

### Hexaghost (66 HP · Spirit Brand)
**Ghostflame Wheel** — 6 flames in a fixed cycle (Searing, Crushing, Bolstering, Searing, Crushing,
Inferno); **Advance/Retract** to move; the **Active** flame **Ignites** when its condition is met:
Searing (2 Attacks → 3 Soulburn ×2), Crushing (2 Skills → 3 dmg ×2), Bolstering (a Power → +4 Block +1 Str),
Inferno (spend 3 energy → 4 dmg × ignited flames; all 6 → +2 **Intensity**). **Soulburn** (after 3 turns,
lose HP = stacks, then clears — **delayed detonation**). **Afterlife** (purple effect also fires when
Exhausted). **Seal** (collect-all-6 → Broken Seal). → wheel-cycling/Intensity, Soulburn burst, Afterlife.

### Collector (mid HP · Emerald Torch)
**Reserve** (alternate energy **stored across turns**), **Essence** (defeat enemies → spend to obtain a
unique collection card per enemy type into a **separate deck**, +1 draw from it/turn), **Pyre** (exhaust a
card in addition to cost), **Torch Head** (while you have Temp HP, attacks trigger riders), **Megathereal**.
→ Pyre-exhaust / Reserve-banking / collection-summon / Torch-Head+TempHP.

### Awakened One (70 HP · Ripped Doll)
**Conjure** (create the next card from a fixed **Spellbook**), **Chant** (Chant cards get permanently
stronger if the last card played was a Power), **Curiosity** (Power played → +1 Str), phase-2 at ~7 Powers
(empowers Conjured spells). **Hex** (+20%/stack from the next attack, cleared all at once), **Manaburn**
(lose HP = Manaburn whenever you lose energy). → Power/Chant scaling / spellbook caster / Hex burst.

---

## 4. ~40 CUSTOM-CHARACTER MODS — novel resources & axes

**Second-resource / spend-to-amplify**: Conductor (**Snowballs** = energy retained between turns;
**Hot/Cold** card thermal tags; **Singe**), Servant/Sakuya (**TSP/Time-Stop**: in Time Stop cards cost 6×
value in TSP not energy, cap 160, regen ~20/turn; a 12-action countdown relic exits Time Stop at 0 → enables
loop turns; **Knives**, **Blight**), Tirion (**Holy Power**), Blackbeard (**Cannonballs/Weapons/
Resistance**), Mad Scientist (**Fuel** + on-draw-effect cards), Administrix (**Yin/Yang** fuel + **Artifact**
stacking), Seeker (**Astral** power + **Static** replay-stacking cards), Astrologer (**Stars** + Major
Arcana).

**Sequence / combo**: Bard (**Notes** — 4 types queue on a music bar; **Melodies** need an ordered Note
sequence → free ability; **Inspiration**), Warrior (**Combo** counter), Vagabond (**Combo/Opener/Closer** +
**Posture** = second HP track → 1-energy execute when Posture > HP).

**Card-subtype alternation**: Mystic (**Spell↔Arte** — each keys off the other type), Enchantress (**Brew**
enchants hand cards; **Phantom/Virus** enchantments; curse-conversion).

**Summon / minion**: Duelist (**Summon** stacks → **Tribute N** to play bombs — board-gating a card tier),
Necromancer (summons + curse synergy), Packmaster (**6 random 10-card packs** each run = randomized-archetype
draft; **Hats**).

**HP-as-resource / self-harm race**: Vampire (HP-cost + heal loop), Cursed (power escalates self-curse race),
Glutton (self-dmg + exhaust + **gold-in-combat**), Yohane (big effects w/ drawbacks), Valiant (**Smite** vs
debuffed + life cycle), Slimebound (**Potency/Goop/Lick/Tackle/Split**), Remilia (**Bleeding** → Max HP).

**Timing / hand / transform**: Disciple (retain + intent-shift + card-transform + temp-relic cycling),
Juggernaut (**Overflow** in-hand end-of-turn effects), Construct (**Mode Shift + Cycle**), Jester (draft ALL
cards incl. other mods), Wanderer/Jorbs (**Remember** 1 memory at a time; **Clarity** locks it permanently;
**Snap** per-floor timer; **Material Components** 0-cost utility cards), Kokoro (**Emotions** change card
effects), Wild Card (**Persona/Arcana** transform), Pokemon Master (play an evolvable card → adds its evolved
form to discard this combat).

**RNG / gambling**: Gambler (**Poker Hand** rank = AoE dmg; **Gold** in combat), Marksman (**Crit** + Burn),
Perplexing (playable Snecko: random cards+costs), Dice of Fate (**Dice** currency → reroll rewards).

**Guardian/Clockwork temp→permanent**: Gems (Guardian) / permanent mid-combat stat growth (Clockwork).

**Touhou family**: Marisa (**Charge** exponential ×2/×4/×8 by low-cost plays, depleted on attack; **Amplify**;
spark/burn/steal/create-destroy), Reimu (**Faith/Fly/Vitality/Barrier**), Remilia (Blood/Bleeding).

**StS2-era (flagged)**: Shadowverse Beyond (**Spellboost** cost-ramp, **Enhance/Accelerate**, **Necromancy**
graveyard-count, **Earth Rite**, **Last Words**, **Fusion/Mode/Skybound Art**), CardOverhaul (**Rune of
Awakening** → Awakened full-art card), Soot (**Hex** debuff-multiplication).

**Not found / low confidence**: "The Hexer", "The Mechanic", "The Blightborn" (likely misremembered/StS2);
The Fool (Animator add-on, resource undocumented).

---

## 5. NOVEL STATUSES & SCALING AXES (cross-mod sweep)

**Delayed-detonation debuffs (biggest novel family)**: **Soulburn** (inert until ignited/3 turns → 1 HP/stack
burst; Hexaghost), **Doom** (drains then vanishes unless target is Afflicted; Collector). Distinct from
Poison (ticks+decays).
**Target-side damage mods**: **Bruise** (flat +dmg taken; Hermit), **Rugged** (next instance → 1/2; Hermit),
**Languid** (−dmg dealt, decays 1/round; Replay), **Chill** (foes attack for less; Conductor).
**Counter/reflect**: **Counter** (riposte first hit; Champ), **Reflection** (reflect on FULL block; Replay),
early-turn-only powers.
**Poison variants**: **Necrotic Poison** (double dmg, halves each turn — front-loaded; Replay), **Drowning**.
**Build-enablers**: **Vigor** (next attack +dmg), **Chant** (Power-play permanent escalation; Awakened),
**Charge-Up** (low-cost → burst), **Fuel** (generated by taking damage), **Shielding** (Block that doesn't
wear off between rounds — distinct from Barricade), **Critical**, **Muddle** (self-Confuse as a resource).

**Novel resource systems**: Ghostflame Wheel (6-slot cyclic action-gated meter), Charge (exponential
multiplier build-and-dump), Snowballs/Reserve (banked energy), Temperature/Hot-Cold (per-card thermal
state), Wiz→Bang (combo counter → burst), Gems/Sockets (deck-crafting currency), Dice (reward-reroll
currency), Gold-in-combat, Energy-from-Curses (Witch), Material Components (generated 0-cost micro-cards).

**Novel scaling axes**: Dead On / center-of-hand (positional-in-hand; Hermit), Static (replay-within-turn
stacking; Seeker), Combo counter + Opener/Closer + Posture second-HP-track (Vagabond), Melody/Note sequences
(Bard), Encode/Compile card-fusion (Automaton), Spellboost cost-ramp (Shadowverse), Amplify overspend,
Remember/Clarity/Snap memory-slot bank (Wanderer), Summon→Tribute board-gating (Duelist), multi-body party
(Gremlins), Conjure/phase threshold (Awakened), Unidentified between-combat mutation (Snecko), Persona/
Arcana + Pokémon-evolution card-transform, orb-system extensions (Crystal/Glass/Hellfire/Replicate; Replay),
crit chance/multiplier (Marksman).

**Novel keywords**: Afterlife (Ethereal fires on Exhaust; Downfall), Encode/Compile, Socket/Gem, Identify,
Muddle, Refund, Exhaustive, Shielding, Wither, Startup, Grave, Soulbound, Autoplay, Self-Retaining,
Switches (toggle forms in hand), Fetch, Cycle, Replicate, Envenom, Amplify, Hot/Cold/Snowballs, Knives/
Blight, Combo/Opener/Closer/Posture, Chant/Conjure, Spellboost/Enhance/Accelerate/Earth Rite/Necromancy/
Last Words/Fusion/Mode/Skybound Art/Super Evolution/Awakening, Persona/Arcana.

**Novel trigger hooks**: on-exhaust-for-Ethereal (Afterlife), on-card-enters-play (Startup), on-FULL-block
(Reflection), on-first-hit-taken (Counter), on-attacked retaliatory buff (Mad Gremlin), Nth-card/count-
threshold (Automaton 3-Encode, Wizard 3-Wiz, Awakened power-count), per-card-type-played side-quest advance
(Ghostflame), on-play-adds-to-sequence-bar (Bard), positional-in-hand (Hermit), replay-within-turn (Seeker
Static), on-draw-of-Curse (Witch), on-take-damage resource (Fuel), on-consume (Goop), between-combat
mutation (Unidentified/Last Words), rest-site out-of-combat hooks (Gem socketing, Identify).

---

## 6. "CHIMERA CARDS" / CardAugments — the same-named mod

Steam Workshop id **2970981743** (**"Chimera Cards"** by MistressAlison/AutumnMooncat). Amusingly it
shares our project's name. **Take the mod PAGE's *described concept* as the reference — NOT the repo
internals** (the `CardAugments` code doesn't cleanly reflect the described mod, so the framework specifics
below are illustrative, not authoritative). The valuable idea is the **card-variance system** it describes.

### The described concept (this is the takeaway)
A base card can appear as many **variants** via **prefix/suffix modifiers** that change how it works —
"instead of the same Cleave every time, you find a **Searing Cleave** (adds fire, upgradeable any number of
times) or a **Bludgeoning Cleave** (costs much more but deals proportionally more)." The mod page describes
**100+ modifiers split by rarity**, which modifiers can roll varies **per base card**, and a preview button
lists every modifier a given card can take. So one base card × its eligible modifiers = many *distinct-feeling*
cards — a **content-multiplier** layered on top of the base card set.

### Why the CONCEPT matters for us (developed in `card-pool-composition.md §12`)
This "base card × a modifier layer" idea is essentially a generalization of what we already do (attunement
**re-skin** recolors a kit card to an element) into a full **card-variance axis**: a card instance = a base +
0–N modifiers, each a **power-budget delta**, each gated by eligibility (card-shape *and* holder typing). It
multiplies content variety cheaply, gives a cost↔power lever, makes variants **collectible**, and plugs
straight into our power-budget + specificity + generation model. **We're elevating this from a footnote to a
real design consideration** — see `card-pool-composition.md §12`.

*(The name collision is coincidental — different game, different engine; our "Chimera" is the creature-fusion
theme. No mechanical concern.)*

---

*See `effect-vocabulary.md` for the synthesized, typing-tagged design catalog these findings feed.*

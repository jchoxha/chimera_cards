// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/codex — the single source for the game's player-facing    ║
// ║ reference text: statuses, the three taxonomy axes, attunement signature ║
// ║ statuses, and matchup basics. Combat tooltips AND the Codex screen both ║
// ║ read from here (reactions come from cards/reactions REACTION_INFO,       ║
// ║ keywords from cards/cardText KEYWORD_GLOSSARY).                          ║
// ║ UPDATE WHEN: a status/axis/matchup rule changes, or a new one is added. ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Status effects — id → { name, icon, desc }. Used by combat pips/tooltips + codex. */
export const EFFECT_INFO = {
  block: { name: 'Block', icon: 'game-icons:checked-shield', desc: 'Absorbs incoming damage. Creature-bound — it rides swaps and decays to 0 at the start of its own side’s turn.' },
  strength: { name: 'Strength', icon: 'game-icons:biceps', desc: 'Adds its value to the damage of each hit this creature deals.' },
  dexterity: { name: 'Dexterity', icon: 'game-icons:gloves', desc: 'Adds its value to the Block gained by Block effects.' },
  weak: { name: 'Weak', icon: 'game-icons:broken-shield', desc: 'Deals 25% less attack damage. Counts down by 1 each turn.' },
  vulnerable: { name: 'Vulnerable', icon: 'game-icons:cracked-shield', desc: 'Takes 50% more attack damage. Counts down by 1 each turn.' },
  frail: { name: 'Frail', icon: 'game-icons:shield-bash', desc: 'Gains 25% less Block. Counts down by 1 each turn.' },
  burn: { name: 'Burn', icon: 'game-icons:flame', desc: 'Loses HP equal to its stacks at the end of the opponent’s turn, then decays by 1. Bypasses Block.' },
  poison: { name: 'Poison', icon: 'game-icons:poison-bottle', desc: 'Loses HP equal to its stacks at the end of the opponent’s turn, then decays by 1. Bypasses Block.' },
  regen: { name: 'Regen', icon: 'game-icons:health-normal', desc: 'Heals HP equal to its stacks at the end of the carrier’s own turn, then decays by 1.' },
  chill: { name: 'Chill', icon: 'game-icons:snowflake-1', desc: 'A frost affliction (not yet active this milestone).' },
  soak: { name: 'Soak', icon: 'game-icons:water-drop', desc: 'The next attack against this unit deals +25% per Soak stack, then Soak clears. Stack it up for a devastating blow — and it primes Water/Fire/Frost/Energy reactions.' },
  shock: { name: 'Shock', icon: 'game-icons:lightning-arc', desc: 'While this side has Shocked creatures, its Vanguard pays +1 energy per Shocked ally. Each turn it loses HP = stacks; with 2+ Shocked allies it spreads (grows) instead of fading.' },
  decay: { name: 'Decay', icon: 'game-icons:skull-crossed-bones', desc: 'At turn-end it saps ONE random buff (Strength/Dexterity/Regen/Amplify) by its stacks — removing up to that many, wiping the buff if Decay ≥ it. Any leftover Decay is wasted that turn. Then Decay ticks down 1.' },
  bleed: { name: 'Bleed', icon: 'game-icons:drop', desc: 'At turn-end loses HP = stacks × the number of times it was hit that turn; if it was not hit, Bleed falls off entirely. Otherwise decays 1.' },
  expose: { name: 'Expose', icon: 'game-icons:cracked-shield', desc: 'While Exposed, ALL hits against this unit ignore Block (not consumed; decays 1/turn). If Expose exceeds its HP, it is forced to the bench and cannot return until HP > Expose (unless it is the last unit).' },
  confuse: { name: 'Confuse', icon: 'game-icons:brain', desc: 'This unit’s next attack is unreliable — it may fizzle, or strike a random target. Consumed per attack.' },
  amplify: { name: 'Amplify', icon: 'game-icons:magic-swirl', desc: 'This unit’s next attack deals +50%, then Amplify clears.' },
};

/** The three taxonomy axes — what each one means for a creature. */
export const AXIS_INFO = {
  class: { name: 'Archetype', icon: 'game-icons:gladius', desc: 'Its character build — the theme and signature mechanics that shape its card pool and play style.' },
  biology: { name: 'Biology', icon: 'game-icons:dna2', desc: 'Its body — drives base stats and HP, and gives an innate weakness/resistance to certain attunement elements.' },
  attunement: { name: 'Attunement', icon: 'game-icons:embrace-energy', desc: 'Its element — shapes the damage type of its attacks, its elemental matchups, and the signature status its imbued strikes inflict.' },
};

/** Each attunement element's signature status (applied by its imbued strikes + own cards). */
export const ATTUNEMENT_SIGNATURE = {
  Physical: 'Bleed', Fire: 'Burn', Frost: 'Weak', Water: 'Soak', Nature: 'Poison',
  Air: 'Expose', Energy: 'Shock', Shadow: 'Vulnerable', Holy: 'Regen', Void: 'Decay',
  Mind: 'Confuse', Arcane: 'Amplify', Stone: 'Fortify (Block)',
};

/** Short blurbs on the core combat systems — the codex "How combat works" section. */
export const SYSTEM_INFO = [
  { name: 'Vanguard & Bench', icon: 'game-icons:rank-3', desc: 'Each side fields an active Vanguard with a bench behind it. Swap a benched ally to the front for escalating energy cost; a fallen Vanguard is replaced for free.' },
  { name: 'Energy', icon: 'game-icons:lightning-arc', desc: 'Each turn you get energy = max(3, number of benched allies) to spend on cards and swaps. Both sides use the same rule.' },
  { name: 'Block', icon: 'game-icons:checked-shield', desc: 'Block absorbs damage and is creature-bound — it rides swaps and decays to 0 at the start of its own side’s turn.' },
  { name: 'Matchups', icon: 'game-icons:crossed-swords', desc: 'Damage scales with the attacking card’s element vs the target’s attunement and biology: strong → more damage, weak → less.' },
  { name: 'Reactions', icon: 'game-icons:fire-ray', desc: 'Hitting a status with the right element triggers a reaction — a bonus payoff. Statuses still work fully on their own; reactions are pure upside.' },
  { name: 'Peek', icon: 'game-icons:eye-target', desc: 'The enemy telegraphs its whole turn face-down. Spend a Peek charge to reveal the exact actions and numbers for the turn.' },
  { name: 'Sizes', icon: 'game-icons:body-height', desc: 'A creature’s size (shown top-left of its card) scales it: Baby (½ HP, −1 Might) · Small (¾) · Regular · Large (1.3× HP, +1 Might) · Elite (1.6×, +2) · Boss (2× HP, +3). Creatures evolve up the ladder; Elite and Boss are terminal.' },
];

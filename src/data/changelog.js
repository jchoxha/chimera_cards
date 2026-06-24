// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/changelog — player-facing version history. Shown in a    ║
// ║ modal when the version chip is tapped (combat topbar / app menu).     ║
// ║ UPDATE WHEN: shipping a notable gameplay/UI change (keep newest first).║
// ╚══════════════════════════════════════════════════════════════════╝

/** @type {{version:string, date:string, notes:string[]}[]} newest first */
export const CHANGELOG = [
  { version: 'v3.51.0', date: '2026-06-24', notes: [
    'New Codex (from the main menu): a browsable reference for how combat works, every status, the full reaction matrix, the three creature axes, and all keywords — the same info the in-combat tooltips show, in one place to read through.',
  ] },
  { version: 'v3.50.0', date: '2026-06-24', notes: [
    'Combat log now flags resistances: a hit that’s strong or weak against the target’s type reads “— super effective!” / “— resisted”, clickable for a quick explanation.',
    'Reactions in the combat log are now clickable — tap a reaction (e.g. Combust) to read exactly what it does.',
  ] },
  { version: 'v3.49.0', date: '2026-06-24', notes: [
    'Card rewards are now per-character: after a win, each party member shows its OWN distinct set of card options (drawn from that character’s pool). You still pick just one card total — and it goes to that character.',
  ] },
  { version: 'v3.48.1', date: '2026-06-24', notes: [
    'Actually fixed the Enemy Intent button position — it shared a CSS class with the old floating intent badge, which pinned it (absolutely) over the team rail. It now sits in the foes rail directly under the enemy bench.',
  ] },
  { version: 'v3.48.0', date: '2026-06-24', notes: [
    'Fixed the Enemy Intent button floating down over the player area — it now sits directly below the enemy bench.',
    'The Enemy Intent modal now shows arrows between the planned steps, making the order of the enemy’s actions clear.',
  ] },
  { version: 'v3.47.0', date: '2026-06-24', notes: [
    'Enemy AI difficulty tiers: foes now play at a competence level set by the encounter — early/normal fights are forgiving (simpler, occasionally fumble), while elites and bosses play sharp (seek reactions, swap for type advantage, never misplay).',
  ] },
  { version: 'v3.46.0', date: '2026-06-24', notes: [
    'Variant access: a creature attuned to two elements can now build its archetype attacks in EITHER element — the deck builder offers, e.g., both a Physical and a Fire version of each strike, so you choose your damage type per card.',
  ] },
  { version: 'v3.45.0', date: '2026-06-24', notes: [
    'Reaction preview: while dragging an attack onto a foe, you now see exactly what reaction it will trigger (e.g. “Combust · 8 dmg”, “Freeze · Expose +3”) before you commit — no more guessing.',
  ] },
  { version: 'v3.44.0', date: '2026-06-24', notes: [
    'Enemies now play around reactions: they prefer attacking with an element that detonates a status you carry, and will set up their own primer (e.g. apply Poison, then hit it with Fire) within a single turn.',
    'Reaction tuning: detonating reactions consume their status for a burst, while amplifying ones leave or grow it — and the payoff scales with how many stacks you’d built up.',
  ] },
  { version: 'v3.43.0', date: '2026-06-23', notes: [
    'Reactions are now discoverable: tap a creature’s attunement to see every reaction that element can trigger.',
  ] },
  { version: 'v3.42.0', date: '2026-06-23', notes: [
    'Elemental Reactions are live: hitting a status with the right element triggers a payoff — Fire stokes Burn, Water quenches it, Energy electrocutes the Soaked, Void devours wounds, and more.',
    'Reactions show in the log and pop as a label over the target. Statuses still work fully on their own — reactions are pure upside.',
  ] },
  { version: 'v3.41.0', date: '2026-06-23', notes: [
    'Curated enemy bands: early floors face weaker foes, deeper floors tougher ones, with dedicated elite and boss pools — no more wild difficulty swings.',
  ] },
  { version: 'v3.40.0', date: '2026-06-23', notes: [
    'Combat balance pass: enemy HP retuned so a run is challenging but winnable (was punishing).',
  ] },
  { version: 'v3.39.0', date: '2026-06-23', notes: [
    'Varied enemy encounters: elites and bosses now field a bench, deeper floors can bring a second foe, and enemy HP scales with depth.',
  ] },
  { version: 'v3.38.0', date: '2026-06-23', notes: [
    'Roguelike enemies now actually take their turn (CardSpec AI fix).',
    'Leaving a fight via Menu and resuming re-enters it instead of skipping it.',
    'Death clears the save; added a New Run button on the run-over screen.',
    'Enemy Intent modal shows numbered steps with arrows; button sits at the bottom of the foes rail.',
    'Move info now shows the card art; dragged cards keep their exact size.',
    'Playtime timer in combat; combat log entries are timestamped (playtime + local time).',
    'Tap the version to see this changelog.',
  ] },
  { version: 'v3.36.0', date: '2026-06-23', notes: [
    'Combat declutter: enemy intent and the combat log moved into modals opened from bench buttons.',
    'Both featured cards are now the same size; the "Balanced" default stance no longer shows as a pip.',
    'Icons reserve their space so the layout no longer reflows as art loads.',
  ] },
  { version: 'v3.35.0', date: '2026-06-23', notes: [
    'Reskinned the run/map/party UI to match the ornate combat look.',
    'Cleaner main menu; the run is the primary action.',
    'Turn-change banner, status pip pop-in, energy-orb pulse, Peek glow.',
  ] },
  { version: 'v3.34.0', date: '2026-06-23', notes: [
    'Uniform, taller creature cards with bigger art; every card item is tappable for info.',
    'Roguelike enemies are drawn from the generated roster (real axes/portraits/decks).',
    'Mobile: responsive cards, slimmer rails, floating damage numbers, hand polish.',
  ] },
  { version: 'v3.33.0', date: '2026-06-23', notes: [
    'Force-landscape on phones; combat-log overflow fix.',
  ] },
];

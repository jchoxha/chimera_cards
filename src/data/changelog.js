// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/changelog — player-facing version history. Shown in a    ║
// ║ modal when the version chip is tapped (combat topbar / app menu).     ║
// ║ UPDATE WHEN: shipping a notable gameplay/UI change (keep newest first).║
// ╚══════════════════════════════════════════════════════════════════╝

/** @type {{version:string, date:string, notes:string[]}[]} newest first */
export const CHANGELOG = [
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

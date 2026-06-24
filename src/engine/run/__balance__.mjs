// ╔══════════════════════════════════════════════════════════════════╗
// ║ HEADLESS BALANCE HARNESS — committed, reusable. Simulates full runs   ║
// ║ (3-creature party → a synthesized act of fights with deck growth) with ║
// ║ a fixed autoplay policy, and reports the win-rate-to-boss + how far a   ║
// ║ run typically reaches. Use it to sanity-check tuning changes (enemy HP, ║
// ║ reaction cells) without the UI. Run: node src/engine/run/__balance__.mjs ║
// ║   [seeds] [--quiet]   (npm run balance)                                  ║
// ║ NOT a pass/fail test — a measurement tool. Numbers are guidance.        ║
// ╚══════════════════════════════════════════════════════════════════╝

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { makeCreature } from '../content/generate.js';
import { createFighter } from '../combat/state.js';
import { VanguardManager } from '../combat/VanguardManager.js';
import { makeRng, hashSeed } from './rng.js';
import { draftRunReward } from './rewards.js';
import { REACTIONS } from '../cards/reactions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = join(HERE, '../../data/cards');

// ── Content: card pools + roster (mirrors data/roster.js; inlined so the harness
// runs under plain node, which can't take roster.js's Vite-only JSON import). ──
const POOLS = {};
for (const file of readdirSync(CARDS_DIR).filter((f) => f.endsWith('.json'))) {
  const f = JSON.parse(readFileSync(join(CARDS_DIR, file), 'utf8'));
  POOLS[f.class] = f.cards || [];
}
const FALLBACK = POOLS.Warrior || [];

const ROSTER = [
  { id: 'ironhide', name: 'Ironhide', class: 'Warrior', biology: ['Giant'], attunement: ['Physical'], baseHp: 60 },
  { id: 'voltfang', name: 'Voltfang', class: 'Warrior', biology: ['Beast'], attunement: ['Physical', 'Energy'], baseHp: 55 },
  { id: 'nightveil', name: 'Nightveil', class: 'Rogue', biology: ['Humanoid'], attunement: ['Shadow'], baseHp: 52 },
  { id: 'emberwisp', name: 'Emberwisp', class: 'Mage', biology: ['Elemental'], attunement: ['Fire'], baseHp: 50 },
  { id: 'frostmind', name: 'Frostmind', class: 'Mage', biology: ['Humanoid'], attunement: ['Frost'], baseHp: 52 },
  { id: 'grimsoul', name: 'Grimsoul', class: 'Warlock', biology: ['Undead'], attunement: ['Shadow'], baseHp: 56 },
  { id: 'dawnkeeper', name: 'Dawnkeeper', class: 'Priest', biology: ['Humanoid'], attunement: ['Holy'], baseHp: 55 },
  { id: 'thornroot', name: 'Thornroot', class: 'Shaman', biology: ['Beast'], attunement: ['Nature'], baseHp: 55 },
  { id: 'tidecaller', name: 'Tidecaller', class: 'Shaman', biology: ['Elemental'], attunement: ['Water'], baseHp: 54 },
  { id: 'wildeye', name: 'Wildeye', class: 'Ranger', biology: ['Beast'], attunement: ['Nature'], baseHp: 53 },
  { id: 'cogwright', name: 'Cogwright', class: 'Engineer', biology: ['Mechanical'], attunement: ['Stone'], baseHp: 58 },
  { id: 'maw', name: 'Maw', class: 'Warrior', biology: ['Aberration'], attunement: ['Void'], baseHp: 54 },
];
const build = (r) => makeCreature({ ...r, pool: POOLS[r.class] || FALLBACK });
const CREATURES = Object.fromEntries(ROSTER.map((r) => [r.id, build(r)]));

// Enemy bands + per-tier HP multipliers — kept in sync with engine/run/encounters.js.
const BANDS = {
  early: ['emberwisp', 'nightveil', 'voltfang', 'wildeye'],
  mid: ['frostmind', 'grimsoul', 'dawnkeeper', 'thornroot', 'tidecaller', 'voltfang', 'wildeye'],
  late: ['ironhide', 'cogwright', 'maw', 'grimsoul', 'frostmind', 'dawnkeeper'],
  elite: ['ironhide', 'cogwright', 'maw', 'grimsoul'],
  boss: ['maw', 'ironhide', 'cogwright'],
};
const floorMult = (floor) => 1 + Math.max(0, floor) * 0.03;
let foeSeq = 0;

function rosterFighter(id, hpMult) {
  const c = CREATURES[id];
  const tag = `foe${++foeSeq}`;
  const maxHp = Math.max(1, Math.round(c.maxHp * hpMult));
  const f = createFighter({ id: `${tag}-${id}`, name: c.name, types: c.attunement.map((a) => ({ type: a, weight: 1 })), hp: maxHp, maxHp, stats: c.stats });
  f.class = c.class; f.biology = c.biology; f.attunement = c.attunement;
  f.deck.drawPile = (c.deck ?? []).map((card) => ({ ...card, id: `${tag}:${card.id}` }));
  return f;
}
const pick = (rng, band) => band[Math.floor(rng.next() * band.length)];
function enemiesForNode(type, floor, rng) {
  const fm = floorMult(floor);
  if (type === 'boss') return [rosterFighter(pick(rng, BANDS.boss), 2.0 * fm), rosterFighter(pick(rng, BANDS.boss), 1.0 * fm)];
  if (type === 'elite') return [rosterFighter(pick(rng, BANDS.elite), 1.3 * fm), rosterFighter(pick(rng, BANDS.elite), 1.1 * fm)];
  const band = floor <= 3 ? 'early' : floor <= 6 ? 'mid' : 'late';
  if (floor >= 5 && rng.next() < 0.45) return [rosterFighter(pick(rng, BANDS[band]), 0.85 * fm), rosterFighter(pick(rng, BANDS[band]), 0.7 * fm)];
  return [rosterFighter(pick(rng, BANDS[band]), 0.85 * fm)];
}

// ── Autoplay policy ──────────────────────────────────────────────────────────
const effList = (card) => (Array.isArray(card.effects) ? card.effects : []);
const cardDmg = (card) => effList(card).filter((o) => o.op === 'damage').reduce((n, o) => n + (Number(o.value) || 0) * (Number(o.hits) || 1), 0);
const cardBlock = (card) => effList(card).filter((o) => o.op === 'block').reduce((n, o) => n + (Number(o.value) || 0), 0);

/** Play one full player turn with a simple "defend-when-low, else hit hardest" policy. */
function playTurn(vm) {
  let guard = 0;
  while (vm.state.phase === 'player' && guard++ < 40) {
    const side = vm.state.player;
    const p = side.fighters[side.vanguardIndex];
    if (!p || p.hp <= 0) break;
    const energy = side.energy;

    // Swap out a low vanguard for a much healthier benched ally (if affordable).
    if (p.hp / p.maxHp < 0.40) {
      let best = -1, bestHp = p.hp * 1.5;
      side.fighters.forEach((f, idx) => {
        if (idx !== side.vanguardIndex && f.hp > 0 && f.hp > bestHp) { bestHp = f.hp; best = idx; }
      });
      if (best >= 0 && energy >= side.manualSwapsThisTurn + 1 && vm.swap(best) !== false) continue;
    }

    const playable = p.hand.filter((c) => {
      const cost = c.cost === -1 ? energy : c.cost;
      return !c.keywords?.includes('unplayable') && c.cost !== -2 && cost <= energy;
    });
    if (!playable.length) break;
    const low = p.hp / p.maxHp < 0.40;
    let choice = null;
    if (low) choice = playable.filter(cardBlock).sort((a, b) => cardBlock(b) - cardBlock(a))[0];
    if (!choice) choice = playable.filter((c) => cardDmg(c) > 0).sort((a, b) => cardDmg(b) - cardDmg(a))[0];
    if (!choice) choice = playable.sort((a, b) => (b.cost === -1 ? energy : b.cost) - (a.cost === -1 ? energy : a.cost))[0];
    if (!choice) break;
    if (vm.play(choice.id) === false) {
      // Couldn't play it (stance gate etc.) — drop it from consideration this loop.
      p.hand = p.hand.filter((c) => c !== choice);
    }
  }
  if (vm.state.phase === 'player') vm.endTurn();
}

function runFight(party, type, floor, rng) {
  const players = party.filter((m) => m.hp > 0).map((m) => {
    const f = createFighter({ id: m.id, name: m.name, types: m.attunement.map((a) => ({ type: a, weight: 1 })), hp: m.hp, maxHp: m.maxHp, stats: m.stats });
    f.class = m.class; f.biology = m.biology; f.attunement = m.attunement;
    f.deck.drawPile = m.deck.map((c) => ({ ...c }));
    return f;
  });
  if (!players.length) return false;
  const room = type === 'boss' ? 'boss' : type === 'elite' ? 'elite' : 'combat';
  // Mirror combatBridge's floor-based AI difficulty ramp.
  const aiSkill = room === 'combat' ? (floor <= 3 ? 'basic' : 'normal') : null;
  const vm = new VanguardManager({
    playerFighters: players, enemyFighters: enemiesForNode(type, floor, rng),
    room, config: { aiSkill },
    rarity: { offset: -0.05, ascension7: false }, rng: () => rng.next(),
  });
  vm.startCombat();
  let guard = 0;
  while (vm.state.phase !== 'victory' && vm.state.phase !== 'defeat' && guard++ < 200) {
    if (vm.state.phase === 'player') playTurn(vm);
    else if (vm.state.phase === 'draw' || vm.state.phase === 'enemyIntent' || vm.state.phase === 'enemy') vm.endTurn?.();
    else break;
  }
  // Fold surviving HP back to the party.
  for (const f of vm.state.player.fighters) { const m = party.find((p) => p.id === f.id); if (m) m.hp = Math.max(0, f.hp); }
  return vm.state.phase === 'victory';
}

function simulateRun(seed) {
  const rng = makeRng(hashSeed(String(seed)));
  // Party: 3 distinct roster creatures, seeded.
  const ids = ROSTER.map((r) => r.id);
  const party = [];
  while (party.length < 3 && ids.length) {
    const id = ids.splice(Math.floor(rng.next() * ids.length), 1)[0];
    const c = build(ROSTER.find((r) => r.id === id));
    party.push({ id, name: c.name, class: c.class, biology: c.biology, attunement: c.attunement, stats: c.stats, maxHp: c.maxHp, hp: c.maxHp, deck: c.deck.map((card) => ({ ...card })) });
  }
  // Lead with the tankiest creature (a real player fronts their wall, not a glass cannon).
  party.sort((a, b) => b.maxHp - a.maxHp);
  const rewardPool = party.flatMap((m) => CREATURES[m.id].deck).map((c) => ({ ...c }));

  // Synthesized 10-floor act: combats + an elite at 5, a rest at 7, boss at 10.
  const floors = [];
  for (let fl = 1; fl <= 10; fl++) floors.push(fl === 5 ? 'elite' : fl === 10 ? 'boss' : fl === 7 ? 'rest' : 'combat');

  let reached = 0;
  for (let i = 0; i < floors.length; i++) {
    const type = floors[i], floor = i + 1;
    if (type === 'rest') { for (const m of party) m.hp = Math.min(m.maxHp, Math.round(m.hp + m.maxHp * 0.3)); continue; }
    const won = runFight(party, type, floor, rng);
    if (!won) return { reached, boss: false, alive: party.filter((m) => m.hp > 0).length };
    reached = floor;
    // Deck growth: draft a reward and give it to a random living member.
    const reward = draftRunReward(rewardPool, 3, () => rng.next())[0];
    if (reward) { const m = party.filter((p) => p.hp > 0)[Math.floor(rng.next() * party.filter((p) => p.hp > 0).length)]; if (m) m.deck.push({ ...reward, id: `${reward.id}#r${floor}` }); }
  }
  return { reached: 10, boss: true, alive: party.filter((m) => m.hp > 0).length };
}

// ── Run ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a))) || 200;
const quiet = args.includes('--quiet');

// `--no-react` neutralizes the reaction matrix (shared reference → fireReactions
// finds no cells, previewReactions returns 0) to isolate reactions' difficulty impact.
if (args.includes('--no-react')) { for (const k of Object.keys(REACTIONS)) delete REACTIONS[k]; }

let bossWins = 0, totalReached = 0;
const reachHist = {};
for (let i = 0; i < N; i++) {
  const r = simulateRun(`balance-${i}`);
  if (r.boss) bossWins++;
  totalReached += r.reached;
  reachHist[r.reached] = (reachHist[r.reached] || 0) + 1;
}

console.log(`\nBalance harness — ${N} runs (autoplay, deck growth, reaction-aware enemy AI):`);
console.log(`  win-to-boss : ${((bossWins / N) * 100).toFixed(1)}%  (${bossWins}/${N})`);
console.log(`  avg floor reached : ${(totalReached / N).toFixed(2)} / 10`);
if (!quiet) {
  console.log('  floors-reached distribution:');
  for (let f = 0; f <= 10; f++) if (reachHist[f]) console.log(`    floor ${String(f).padStart(2)} : ${'█'.repeat(Math.round((reachHist[f] / N) * 40))} ${reachHist[f]}`);
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/bestiary — per-creature codex pages (lore + gameplay).     ║
// ║ Keyed by roster id; `bestiaryEntry` also resolves by name so a combat   ║
// ║ Fighter (whose id may be a fresh instance id) still finds its page.     ║
// ║ Rendered by ui/MonsterPage (the Codex Bestiary tab + the in-combat      ║
// ║ "tap the name" modal). Creatures with no entry fall back to an          ║
// ║ axis-derived page (MonsterPage builds a generic one).                   ║
// ║ UPDATE WHEN: the roster changes, or a creature's design/lore changes.   ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * @typedef {Object} BestiaryEntry
 * @property {string} id
 * @property {string} name
 * @property {string} title    a short epithet
 * @property {string} role     one-line gameplay role
 * @property {string[]} lore   flavour paragraphs
 * @property {string[]} gameplay  strategy paragraphs
 * @property {string[]} tips   bullet tips
 */

/** @type {Record<string, BestiaryEntry>} */
export const BESTIARY = {
  ironhide: {
    id: 'ironhide', name: 'Ironhide', title: 'The Immovable',
    role: 'A Giant Warrior wall — soak hits, brace Block, and grind the foe down.',
    lore: [
      'Ironhide was old before the dungeons were dug. Legend says a smith-king tried to forge a gate that could never be broken, and what crawled out of the furnace instead was Ironhide — a mountain of muscle plated in living iron, slow to anger and slower to fall.',
      'It does not hunt. It simply stands where it chooses to stand, and waits for the world to break itself against it.',
    ],
    gameplay: [
      'Ironhide pairs a Giant biology (the deepest HP pool in the roster) with the Warrior stance engine. Its Physical strikes Bleed, but its real game is attrition: enter a defensive stance, brace Block so it carries between turns, and let the enemy exhaust itself.',
      'As your anchor Vanguard it buys time for your bench to set up. Swap it out only when you need its bulk elsewhere — its escalating swap cost means it prefers to stay planted.',
    ],
    tips: [
      'Stack braced Block before a big telegraphed hit — braced Block survives the turn.',
      'Bleed grows the more it hits; favour multi-hit turns into a single target.',
      'Keep it Vanguard early to protect fragile casters on the bench.',
    ],
  },
  voltfang: {
    id: 'voltfang', name: 'Voltfang', title: 'The Storm-Touched',
    role: 'A Beast Warrior skirmisher — Physical + Energy strikes that Shock and tax the foe.',
    lore: [
      'A wolf that was struck by lightning on a storm-peak and refused to die. Now arcs of blue current crawl through Voltfang’s fur, and the air bristles where it pads.',
      'It runs with no pack but the thunder. Where it bites, the storm follows.',
    ],
    gameplay: [
      'Voltfang is a dual-attunement bruiser: Physical for Bleed, Energy for Shock. Shock taxes the enemy Vanguard’s energy and spreads when more than one foe carries it — punishing multi-enemy fights.',
      'Use its variant access to choose Physical or Energy per attack, leaning Energy when you want to choke the enemy’s actions and Physical when you just need raw damage and Bleed.',
    ],
    tips: [
      'Spread Shock to two or more foes to make it grow instead of fade.',
      'Energy strikes are best early, before the foe has spent its turn.',
    ],
  },
  nightveil: {
    id: 'nightveil', name: 'Nightveil', title: 'The Last Breath',
    role: 'A Shadow Rogue assassin — strike from stealth, stack Vulnerable, chain the kill.',
    lore: [
      'No one remembers Nightveil’s face, only the cold after it leaves. A duelist exiled for a killing that was never proven, it learned to wear the dark like a cloak.',
      'It speaks once, at the end, and only to the one it has come for.',
    ],
    gameplay: [
      'Nightveil applies Vulnerable (Shadow’s signature) to make the next hits land harder, then cashes in with a burst. It is fragile, so it wants the enemy dead before they swing back.',
      'Open from the bench, swap it in once the front line is softened, and detonate Shadow reactions on a primed target.',
    ],
    tips: [
      'Apply Vulnerable first, then pile damage into the same turn.',
      'Keep it benched against heavy hitters — it has little HP to spare.',
    ],
  },
  emberwisp: {
    id: 'emberwisp', name: 'Emberwisp', title: 'The Hungry Spark',
    role: 'A Fire Mage glass-cannon — Burn everything, then Combust it for a payoff.',
    lore: [
      'A scrap of flame that slipped a wizard’s hearth and learned it liked being alive. Emberwisp is barely a body at all — a molten core wrapped in dancing fire, delighted and dangerous.',
      'It is not cruel. It simply burns, the way water is wet.',
    ],
    gameplay: [
      'Emberwisp is the premier reaction engine: stack Burn, then hit it with Fire to Flare-up (more Burn) or Combust (detonate Poison) for damage scaling on the stacks. Its Elemental biology is light on HP — protect it.',
      'It excels behind a tanky Vanguard like Ironhide, raining Burn from the bench and swapping in for the kill.',
    ],
    tips: [
      'Build Burn high before detonating — reaction payoffs scale with stacks.',
      'Never lead with Emberwisp into a hard-hitting foe; it is made of paper.',
    ],
  },
  frostmind: {
    id: 'frostmind', name: 'Frostmind', title: 'The Still Winter',
    role: 'A Frost Mage controller — Weaken and lock down, win the long game.',
    lore: [
      'A scholar who studied cold until cold studied back. Frostmind’s thoughts move like glaciers — slow, vast, and impossible to turn aside.',
      'It does not rush. Winter never does.',
    ],
    gameplay: [
      'Frost applies Weak, blunting enemy damage, and freezes tempo. Frostmind is a control caster: stall, sap the foe’s offense, and grind out a fight that gets safer every turn.',
      'Pair it with a sustain creature and it turns hard fights into wars of attrition the enemy cannot win.',
    ],
    tips: [
      'Keep Weak refreshed on the active foe to throttle incoming damage.',
      'Frost reactions reward chaining onto Soaked or primed targets.',
    ],
  },
  grimsoul: {
    id: 'grimsoul', name: 'Grimsoul', title: 'The Unpaid Debt',
    role: 'A Shadow Warlock — pay HP it doesn’t fear losing for overwhelming power.',
    lore: [
      'Grimsoul died once and found the ledger of the dead poorly kept. It paid its way back with someone else’s coin and has been spending borrowed life ever since.',
      'Undeath, it has decided, is mostly a matter of accounting.',
    ],
    gameplay: [
      'A Warlock pays HP to fuel huge effects — and as Undead, Grimsoul minds the cost less than most. It applies Vulnerable, summons, and curses, trading life for board dominance.',
      'Manage its HP like a resource, not a lifeline: spend down to the threshold you can sustain, then heal or swap before the bill comes due.',
    ],
    tips: [
      'Don’t pay HP you can’t get back — track your sustain before sacrificing.',
      'Summons act on their own each turn; get them down early.',
    ],
  },
  dawnkeeper: {
    id: 'dawnkeeper', name: 'Dawnkeeper', title: 'The Held Line',
    role: 'A Holy Priest support — heal the team, grant Regen, smite the wicked.',
    lore: [
      'The last warden of a temple that no longer stands, Dawnkeeper carries its light anyway. It guards the living because someone must, and no one else volunteered.',
      'Its lantern has never gone out. It refuses to learn how.',
    ],
    gameplay: [
      'Holy’s signature is Regen — healing that ticks each of the carrier’s turns. Dawnkeeper keeps the whole party standing, mends the Vanguard, and punishes with Smite when the foe overcommits.',
      'It is the glue of a 3-creature team: with Dawnkeeper behind them, your bruisers can take risks they otherwise couldn’t.',
    ],
    tips: [
      'Pre-heal before a big enemy turn rather than reacting after.',
      'Regen on a tanky Vanguard turns it nearly unkillable.',
    ],
  },
  thornroot: {
    id: 'thornroot', name: 'Thornroot', title: 'The Slow Green',
    role: 'A Nature Shaman — fester Poison and grow Totems that work each turn.',
    lore: [
      'Not one creature but a grove that learned to walk. Thornroot is bark and thorn and old patient hunger, dragging its roots from one battlefield to the next.',
      'It plants. It waits. It harvests.',
    ],
    gameplay: [
      'Nature stacks Poison (damage over time that bypasses Block), and Thornroot’s Totems are Powers that fire every turn — chip damage, healing, or buffs that compound the longer a fight runs.',
      'Get Totems down early; their value is cumulative. Then let Poison and the Totems do the work while you defend.',
    ],
    tips: [
      'Totems pay off over time — drop them on turn one, not turn five.',
      'Poison ignores Block, so it’s great against turtling foes.',
    ],
  },
  tidecaller: {
    id: 'tidecaller', name: 'Tidecaller', title: 'The Rising Wave',
    role: 'A Water Shaman — Soak the foe, then cash it in for a devastating blow.',
    lore: [
      'A current that took a shape so it could speak with the land-bound. Tidecaller remembers every shoreline it has touched, and intends to touch them all.',
      'It is patient the way the sea is patient: it always wins, eventually.',
    ],
    gameplay: [
      'Soak makes the next attack on a target hit far harder (+25% per stack) and primes Water/Fire/Frost/Energy reactions. Tidecaller is a setup creature: layer Soak, then unload — yours or an ally’s.',
      'It shines in a team with a big single hit to follow the Soak, or with Emberwisp to flash it into Steam.',
    ],
    tips: [
      'Stack Soak, then land your biggest hit on the same target.',
      'Soak is a universal reaction primer — coordinate it with elemental allies.',
    ],
  },
  wildeye: {
    id: 'wildeye', name: 'Wildeye', title: 'The Patient Shot',
    role: 'A Nature Ranger — Mark prey and snipe past the front line.',
    lore: [
      'Raised by no one, taught by everything that tried to eat it. Wildeye sees the whole battlefield at once and has already decided where the arrow goes.',
      'It misses nothing. That is not a boast; it is a diagnosis.',
    ],
    gameplay: [
      'Rangers Mark a target (amplifying what follows) and reach past the Vanguard to hit the bench — letting you kill a fragile backline caster before it ever comes forward. Traps punish the enemy for attacking.',
      'Use its reach to dictate which enemy dies first, regardless of who’s in front.',
    ],
    tips: [
      'Snipe the dangerous backliner before it swaps to the front.',
      'Lay Traps before the enemy turn — they fire when you’re hit.',
    ],
  },
  cogwright: {
    id: 'cogwright', name: 'Cogwright', title: 'The Unbreakable Wall',
    role: 'A Mechanical Engineer — build Constructs and an endless wall of Block.',
    lore: [
      'Someone built Cogwright to fix things. It has since broadened the definition of “fix” to include “remove whatever is causing the problem.”',
      'It hums while it works. No one is sure if that is contentment or a warning.',
    ],
    gameplay: [
      'The Engineer turns Block into an engine: Constructs and Gadgets are Powers that generate Block or chip damage every turn, while Stone’s Fortify locks Block into the slot so it doesn’t decay.',
      'Cogwright is the ultimate anchor — set up your machines, then become an immovable fortress your team fights behind.',
    ],
    tips: [
      'Fortify keeps Block from decaying — bank it ahead of big hits.',
      'Get Constructs online early; their Block compounds every turn.',
    ],
  },
  maw: {
    id: 'maw', name: 'Maw', title: 'The Open Hunger',
    role: 'A Void Warrior — strikes that Decay armor, buffs, and powers off the foe.',
    lore: [
      'Maw is the shape a hole in the world takes when it gets hungry enough to move. It is all teeth and folded dark, and the space behind it bends the wrong way.',
      'It does not want to rule, or survive, or be understood. It only wants more.',
    ],
    gameplay: [
      'Void’s Decay strips the enemy’s engine: each tick saps a buff and can tear away a Power outright, on top of HP and Block. Maw is the hard counter to setup-heavy foes.',
      'As an Aberration Warrior it hits hard up front while dismantling whatever the enemy is trying to build. Send it at the foe that relies on stacking buffs or totems.',
    ],
    tips: [
      'Target buff- and Power-reliant enemies — Decay unravels them.',
      'Apply Decay early so it ticks down their stacks before they peak.',
    ],
  },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Look up a bestiary entry by roster id OR by creature/fighter name. */
export function bestiaryEntry(idOrName, name) {
  if (!idOrName && !name) return null;
  const direct = BESTIARY[idOrName];
  if (direct) return direct;
  const key = norm(idOrName);
  for (const e of Object.values(BESTIARY)) if (norm(e.id) === key) return e;
  const nm = norm(name ?? idOrName);
  for (const e of Object.values(BESTIARY)) if (norm(e.name) === nm) return e;
  return null;
}

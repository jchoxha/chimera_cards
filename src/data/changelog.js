// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/changelog — player-facing version history. Shown in a    ║
// ║ modal when the version chip is tapped (combat topbar / app menu).     ║
// ║ UPDATE WHEN: shipping a notable gameplay/UI change (keep newest first).║
// ╚══════════════════════════════════════════════════════════════════╝

/** @type {{version:string, date:string, notes:string[]}[]} newest first */
export const CHANGELOG = [
  { version: 'v3.91.0', date: '2026-06-28', notes: [
    'Aberrations now have their own kit — six wide families (Eldritch, Construct, Ooze, Flora, Crystalline, Formless) with aberrant features (Tentacle, Eye, Maw, Spore…), 36 new cards. An aberration’s card reads as its family (Eldritch → “Horror”, Formless → “Wisp”), and it gets its own corner mark distinct from beasts.',
    'Dragons folded into the Beast kit as the Draconic family, with a charged Breath weapon (and chromatic identity now comes from attunement). Descriptive subtypes (Mechanical, Elemental, Giant, Demonic) now add real card packages to a creature, stacking in any combination.',
    'Comprehensive creature naming: combinations of body type + family + subtypes resolve to curated names from the matrix (Draconic+Giant = “Leviathan”; Mammalian+Mechanical = “Cybeast”; Humanoid+Demonic = “Fiend”…), with readable fallbacks. See the reference list in the design doc.',
  ] },
  { version: 'v3.90.0', date: '2026-06-28', notes: [
    'Creature names are smarter and easy to customize. The body-type family now reads into the name (a Draconic beast is a “Dragon”), and curated fusions collapse combos into evocative names — e.g. a giant, undead, draconic beast reads “Undead Leviathan”. New conventions are one-line edits in src/data/biologyNaming.js (FAMILY_NOUN + FUSIONS).',
    'The top-left corner of a card is now strictly the creature’s Archetype; instinct-driven creatures (Beasts, Aberrations) show a single catch-all “no-archetype” mark instead. Family/subtype info lives in the name now.',
  ] },
  { version: 'v3.89.0', date: '2026-06-28', notes: [
    'Creature taxonomy reworked: there are now three BODY TYPES (Humanoid, Beast, Aberration) plus DESCRIPTIVE SUBTYPES (Mechanical, Elemental, Giant, Demonic, and more) that layer on in any combination. A creature’s biology now reads as its subtypes followed by its body-type name — e.g. a giant, demonic, mechanical beast-humanoid reads “Giant Demonic Mechanical Chimera”. Dragonkin/Giant/Elemental/Mechanical/Demon/Undead are no longer standalone biologies.',
    'The Editor’s Monster page now picks a Body Type + any combination of Subtypes; roster creatures were re-tagged (Ironhide is a Giant Humanoid, Emberwisp an Elemental Aberration, Cogwright a Mechanical Humanoid…). Subtypes are display + tagging for now; their card packages come next.',
  ] },
  { version: 'v3.88.0', date: '2026-06-28', notes: [
    'Humanoids now have a WEAPON system — the Humanoid counterpart to Beast anatomy. Each archetype is proficient with a set of weapons (Sword, Axe, Dagger, Bow, Staff, Shield…), and the weapons you give a creature add their own cards to its deck and show as its special factors. 12 weapons, 28 new cards; pick them on the Editor’s Monster page when biology is Humanoid.',
    'Hybrid creatures now show their true combined name from the biology matrix (a Beast/Humanoid reads as “Chimera”) instead of listing both bases.',
  ] },
  { version: 'v3.87.0', date: '2026-06-28', notes: [
    'Hybrid creatures now show a kit icon for EACH of their biologies in the top-left corner (e.g. a Beast/Humanoid shows both its Family and its Archetype), and their special-factor row combines both halves. The biology label lists both (“Beast · Humanoid”).',
  ] },
  { version: 'v3.86.0', date: '2026-06-28', notes: [
    'Creature cards redesigned to show each creature’s kit at a glance. Size now reads as part of the name (e.g. “Large Ironhide”). The top-left corner shows the creature’s major kit icon — its Archetype for Humanoids, its Family for Beasts. Under the name, its Biology sits on the left and its special factors line up on the right as icons (for Beasts, one per Anatomy part — Claws, Teeth, Roar…).',
  ] },
  { version: 'v3.85.0', date: '2026-06-28', notes: [
    'Beasts now have their OWN card system (the first biology kit). Instead of an archetype, a Beast draws cards from its Family (a scientific animal class — Mammalian, Reptilian, Avian, Piscine, Insectoid, Amphibian) plus the Anatomy it has (Claws, Teeth, Beak, Horns, Tail, Hooves, Wings, Quills, Venom, Hide, Shell, Roar). 50 new beast cards, re-skinned to the creature’s attunement like any other kit.',
    'The Editor’s Monster page now shows Family + Anatomy pickers when you set a creature’s biology to Beast, and roster beasts (Voltfang, Thornroot, Wildeye) now fight with real beast kits.',
  ] },
  { version: 'v3.84.0', date: '2026-06-26', notes: [
    'Creature EVOLUTION (first cut): at a Campfire you can now evolve a party member one size up the ladder (Baby → Small → Regular → Large). It permanently gains HP and Might, and the added HP heals it. Elite and Boss are terminal and can’t evolve. Explained in the Codex.',
  ] },
  { version: 'v3.83.0', date: '2026-06-26', notes: [
    'The Card Forge is now the “Editor” — a tabbed admin tool with a Cards page (the old collections forge) and a new Monsters page. The Monsters page lists your custom creatures and lets you create/edit/delete them: name, lore, physical description, matrix typings, size, and an optional hand-built deck (the per-monster deck building that was removed from team assembly lives here).',
    'Monsters built in the Editor appear in your roster on the Assemble Team screen.',
  ] },
  { version: 'v3.82.0', date: '2026-06-26', notes: [
    'Custom creature creation reworked: you can now give a creature Lore and a Physical description (used for future move & art generation), and by default an AI reads that text to choose its matrix typings (Archetype / Biology / Attunement) — turn the toggle off to pick them by hand. Without an AI key it falls back to a smart keyword reading of the name + text, so it always works.',
    'Removed per-monster custom deck building from team assembly — a creature’s deck is always generated from its typings here. Hand-building a specific deck stays in the Editor (an admin tool).',
  ] },
  { version: 'v3.81.0', date: '2026-06-26', notes: [
    'Stats are now fully implemented + explained. Might (damage), Guard (block), Focus (effects on others) and Resolve (own buffs/heals + debuff resist) already mattered; Speed now does too — it’s tempo: the active Vanguard draws extra cards per turn equal to its Speed (Beasts/Humanoids +1, Giants −1). All five are documented in the Codex and explained on hover in a creature’s stat line.',
  ] },
  { version: 'v3.80.0', date: '2026-06-26', notes: [
    'Creature SIZES are in: Baby · Small · Regular · Large · Elite · Boss, shown as a badge top-left of the card. Size scales HP and Might (Baby ½ HP/−1 Might … Boss 2× HP/+3). Ironhide is Large, Emberwisp is Small; elite/boss enemies now wear Elite/Boss badges. Explained in the Codex.',
  ] },
  { version: 'v3.79.0', date: '2026-06-26', notes: [
    'Team Manager now reorders by drag-and-drop (mouse + touch) instead of up/down arrows — drag a creature; the top slot is the Active Vanguard.',
  ] },
  { version: 'v3.78.0', date: '2026-06-26', notes: [
    'Fixed the creature detail card in the Assemble screen — it was zoomed in and its archetype/biology/attunement tags were unstyled and unclickable. The card now renders correctly and the tags are tappable for info.',
    'Added Export (and Delete for your custom creatures) to the creature detail modal.',
  ] },
  { version: 'v3.77.0', date: '2026-06-26', notes: [
    'Card Forge reworked around Collections (card packs): the base game cards are a read-only “Default Collection”, and you author changes inside your own named collections that overlay it — override base cards, add new ones, or hide cards, without ever touching the base.',
    'Creating/editing/deleting a card now happens inside a collection; if you have none, you’re prompted to create one first. Each card shows whether it’s NEW or EDITED.',
    'Archetype selection moved into the filter sidebar as checkboxes (you no longer pick a file). Collections can be enabled/disabled in-game, exported as shareable packs, imported, and (advanced) published into the base game.',
    'Enabled collections’ cards now flow into runs, practice and deck-building (applied at app start).',
  ] },
  { version: 'v3.76.0', date: '2026-06-26', notes: [
    'Card Forge: archetype chips now toggle show/hide on a single click (no more double-click), and you can hide all of them.',
  ] },
  { version: 'v3.75.0', date: '2026-06-26', notes: [
    'New Codex “Cards” section: browse every card in the game (by archetype + the elemental cards), search them, and tap one for its full rules + keyword glossary.',
    'Info panels in combat now have an “Open in Codex” link that jumps straight to the matching Codex page (status, axis, reaction, card, creature…) and back — your fight is right where you left it.',
  ] },
  { version: 'v3.74.0', date: '2026-06-26', notes: [
    'New shared Team Manager: view your team and rearrange positions (set the Active Vanguard, reorder the bench). It’s on the Assemble screen AND on the run map (“Manage Team”), so you can re-order your party between combats.',
  ] },
  { version: 'v3.73.0', date: '2026-06-26', notes: [
    'Clicking a creature on the Assemble screen now opens a detail modal — the same card you see in combat — with an Add to Team / Remove from Team button (and Make Vanguard), plus a link to its Bestiary page.',
    'A creature’s deck is now an expandable dropdown (collapsed by default) in both the combat info panel and the team modal, instead of always being shown.',
  ] },
  { version: 'v3.72.0', date: '2026-06-26', notes: [
    'The playtime timer no longer resets when you leave and resume a run or practice fight — it now accumulates and is saved with the run.',
    'Shock’s side-wide energy tax is now shown on the energy orb (e.g. “⚡ +2”), so you can see the whole team is being taxed by Shocked allies — not just the one wearing the Shock pip. (Each Shocked creature already shows its own pip on the vanguard AND the bench.)',
  ] },
  { version: 'v3.71.0', date: '2026-06-26', notes: [
    'Create Custom Creatures from the Assemble screen: pick its archetype, biology and 1–2 attunements, then give it either the auto-generated deck for those typings OR a hand-built deck (via the deck builder). Custom creatures are saved and usable in runs and practice fights.',
    'Removed the separate “Card / Deck Tuning” menu — custom creatures replace it.',
  ] },
  { version: 'v3.70.0', date: '2026-06-26', notes: [
    'Practice Fight (renamed from Test Fight) now lets you choose the opponents — pick any creatures to spar against, with a passive Target Dummy as the default. Begin Run and Practice Fight are now equal-size buttons.',
    'The Target Dummy is now a selectable character (a high-HP punching bag that barely fights back).',
    'Your practice setup is remembered — a “Continue Practice Fight” option resumes the same matchup, like continuing a run.',
  ] },
  { version: 'v3.69.0', date: '2026-06-26', notes: [
    'Campfire upgrade redesigned: instead of a flat list, switch between your characters, browse that creature’s actual deck as cards, pick one, see a before→after preview, then confirm the upgrade.',
  ] },
  { version: 'v3.68.1', date: '2026-06-26', notes: [
    'Cards in hand now show their EFFECTIVE energy cost while Shocked — the Shock tax (+1 per Shocked ally) is added to the gem (which turns red) so you can see the real cost before playing.',
  ] },
  { version: 'v3.68.0', date: '2026-06-26', notes: [
    'Fixed the reward screen bug where the selected card was torn to the far left and stretched full-height — a CSS class name (“sel”) collided with the team-select screen. Selected cards now simply highlight in place.',
    'Bestiary is now the first tab in the Codex.',
    'The current-team panel on the Assemble screen is collapsible, giving the creature grid more room.',
  ] },
  { version: 'v3.67.0', date: '2026-06-25', notes: [
    'Team assembly is now its own screen from the main menu (“Assemble Your Team”). The team you build is saved and used for BOTH roguelike runs and playtest fights.',
    'The team screen shows your current team at the top, split into the Active Vanguard and the Bench — remove a member, or promote any bench creature to Vanguard.',
    'New menu flow: assemble once, then “Begin Run” or “Test Fight” (a sandbox bout vs a Target Dummy) use your saved team. The old single-hero deck knobs are now under “Card / Deck Tuning”.',
  ] },
  { version: 'v3.66.0', date: '2026-06-25', notes: [
    'New Bestiary: every roster creature has a full codex page (lore + how to play it), in the Codex’s new Bestiary tab AND in combat — tap a creature’s NAME in its info panel to read its page.',
    'In a creature’s info panel you can now tap its archetype / biology / attunement and its statuses/powers for details (previously only worked on the battlefield card).',
    'Totems, turrets, traps and other Powers now show a fitting icon (not a generic fist) and are tappable to explain exactly what they do and when they fire.',
    'Peeked enemy intent now spells out the full numbers for each action inline — no need to tap. Tapping a revealed action shows the actual card being used.',
    'Switch In is back and always visible for a benched ally — greyed with the reason when you can’t (wrong turn / not enough energy).',
    'Reaction names in the attunement panel are now tappable to read what the reaction does.',
    'Fixed the reward card jumping/stretching when selected, and the white gap at the bottom of the run-over screen.',
  ] },
  { version: 'v3.65.0', date: '2026-06-25', notes: [
    'Card Forge now shows archetypes by name (not file names) and lets you toggle several at once — click an archetype to show + focus it, double-click to hide; the gallery pools the cards of every shown archetype, and Save writes them all.',
    'Forge cards are now the EXACT same card you see in combat (shared card component), instead of a separate editor-only tile.',
    'Each card in the Forge has an editable "art prompt" field (with the auto-derived prompt shown as a placeholder) for feeding to the image generator.',
  ] },
  { version: 'v3.64.0', date: '2026-06-25', notes: [
    'Every card now carries an art description (artPrompt) written for an image generator — a per-card scene derived from its archetype, element, and effect, ready to hand-refine. A new batch script (scripts/gen_cards.py) feeds these to the Variant-B art pipeline and the game prefers any generated card art over the pixel placeholder.',
  ] },
  { version: 'v3.63.0', date: '2026-06-25', notes: [
    'Every card is now upgradable: all 162 cards across the 8 archetypes have a campfire upgrade (was Warrior-only). Attacks/blocks/heals hit harder, debuffs/buffs/draw/energy gain a point, powers strengthen their triggered effect, and effect-less utility cards get cheaper.',
  ] },
  { version: 'v3.62.0', date: '2026-06-25', notes: [
    'Card Forge redesigned into a visual card gallery (StS2-mod style): every card renders as a real card tile (cost gem, type-coloured name banner, art, auto-text), with a filter sidebar — search, card type, rarity, cost, and A–Z sort. Click a card to edit it in a popup; click + add card to make a new one.',
  ] },
  { version: 'v3.61.4', date: '2026-06-25', notes: [
    'Card editor: show the build version in the header, and hard-neutralise any animation/transform the game styles leak onto list rows (a leaked transform can paint a row over the form).',
  ] },
  { version: 'v3.61.3', date: '2026-06-25', notes: [
    'Card editor: fixed the card list pushing the edit form off-screen — the list is now a fixed, scrolling sidebar (or a height-capped panel on narrow screens) instead of a full-height column.',
  ] },
  { version: 'v3.61.2', date: '2026-06-25', notes: [
    'Card editor: scoped all of its styles under .ed so its generic class names (list/form/grid/pip…) can’t be overridden by the game’s stylesheets when the Forge is opened from the app — fixes the editor body rendering blank/invisible there.',
  ] },
  { version: 'v3.61.1', date: '2026-06-25', notes: [
    'Card editor: forced a dark colour-scheme and explicit dropdown/placeholder colours so form text stays readable (some browsers/mobile rendered select options dark-on-dark).',
  ] },
  { version: 'v3.61.0', date: '2026-06-25', notes: [
    'Decay reworked (was overpowered): instead of draining HP/Block/powers, it now saps ONE random buff by its stacks — wiping it if Decay ≥ the buff, with any leftover Decay wasted that turn.',
    'When Decay triggers it’s announced both in the combat log and as floating text over the target, naming the buff and how much was removed (or if it was wiped out).',
  ] },
  { version: 'v3.60.0', date: '2026-06-25', notes: [
    'Every creature now starts with a consistent deck: 3 Strike variants (plain damage in the creature’s element(s), no riders), 3 Defend variants, and up to 3 archetype-specific signature cards.',
  ] },
  { version: 'v3.59.3', date: '2026-06-25', notes: [
    'Fixed invisible text in the Card Forge when opened from the app menu — its stylesheet wasn’t being loaded there.',
  ] },
  { version: 'v3.59.2', date: '2026-06-25', notes: [
    'Fixed a black screen when playing power-heavy creatures (e.g. the Shaman): a card-clone step turned a power card’s empty effects into {} and the text generator crashed trying to read it.',
  ] },
  { version: 'v3.59.1', date: '2026-06-25', notes: [
    'Fixed power cards (Shaman Totems, Engineer Turrets/Drones, Ranger Traps, Warlock Summons, Mage/Priest powers…) showing blank description text — the combat UI was routing them to the wrong describer. They now show their full text everywhere.',
  ] },
  { version: 'v3.59.0', date: '2026-06-25', notes: [
    'Card audit pass: fixed Powers not showing on creature cards (a stale field crashed their pip) — Bloodlust, Totems, Turrets, etc. now display.',
    'Cleaned up stale Warrior card text so every card’s description is generated from what it actually does (one even mislabeled its target). All 162 cards verified: valid effects, accurate text, statuses shown as pips.',
  ] },
  { version: 'v3.58.0', date: '2026-06-25', notes: [
    'Shop cards are now per-character: each party member has its own cards to buy, purchasable only for that member (like combat rewards).',
    'Reward and shop cards now use the exact same card display as the cards in your hand during combat.',
  ] },
  { version: 'v3.57.0', date: '2026-06-25', notes: [
    'Combat log now names the damage type ("takes 6 Fire damage"), clickable to explain that element.',
    'Combat log modal is wider, and wrapped lines now hang-indent under the message instead of sliding under the timestamp.',
    'Info popups (creatures, statuses, reactions…) opened from the combat log now layer OVER it — closing one (X or tap-out) returns you to the log instead of closing everything.',
    'Fixed the friendly/enemy bench occasionally showing a horizontal scrollbar.',
  ] },
  { version: 'v3.56.0', date: '2026-06-25', notes: [
    'Combat log now spells out each play in full: “(enemy) Voltfang played Cleave against (friendly) Ironhide” — with the actor, their side, the move, and the target all named and clickable.',
  ] },
  { version: 'v3.55.0', date: '2026-06-24', notes: [
    'Card audit: Ranger Traps (Bear Trap, Explosive Trap, Trapper, Deflector) were dead — they only fired when you damaged yourself, never when an enemy hit you. They now correctly trigger on enemy attacks. (All other 162 cards checked out functional.)',
  ] },
  { version: 'v3.54.0', date: '2026-06-24', notes: [
    'Card rewards now look like real cards (frame, cost, art) — tap to select, then Confirm before it’s added. No more accidental picks.',
    'Combat rewards now also drop loot: a potion drops sometimes after normal fights, and elites & bosses always drop a relic (plus a potion), shown on the reward screen.',
  ] },
  { version: 'v3.53.0', date: '2026-06-24', notes: [
    'Combat log no longer yanks itself to the bottom — it only auto-scrolls if you’re already at the bottom, so you can scroll up to read history.',
    'Fixed creature portraits showing a white edge / wrong size: the decorative “moon” backdrop no longer renders behind a real portrait, and portraits aren’t zoom-scaled.',
    'Imbue is now spelled out: a card reads “Imbue: also applies Burn” (or Poison, Bleed, …) so it’s clear it inflicts your creature’s element status — which is why it differs between creatures.',
  ] },
  { version: 'v3.52.1', date: '2026-06-24', notes: [
    'Fixed a game-breaking Shock softlock: when your whole party was Shocked, the energy tax made every card unaffordable — you couldn’t act and died to the Shock damage. The tax is now capped so your cheapest card is always playable.',
  ] },
  { version: 'v3.52.0', date: '2026-06-24', notes: [
    'Events are richer: more of them, with real choices and consequences — gambles with random outcomes, gold costs, max-HP sacrifices for relics, blessings, and curses. Each choice now shows its outcome before you move on.',
  ] },
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

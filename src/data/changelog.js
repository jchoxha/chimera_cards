// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/changelog — player-facing version history. Shown in a    ║
// ║ modal when the version chip is tapped (combat topbar / app menu).     ║
// ║ UPDATE WHEN: shipping a notable gameplay/UI change (keep newest first).║
// ╚══════════════════════════════════════════════════════════════════╝

/** @type {{version:string, date:string, notes:string[]}[]} newest first */
export const CHANGELOG = [
  { version: 'v3.102.2', date: '2026-07-07', notes: [
    'The Editor’s Monsters tab is now “Creatures” and lists EVERY creature in the game (built-in roster + your customs) in one place. The separate Collection tab is gone — its discovered/captured × size controls live on each creature’s row, with a portrait, and custom creatures keep their Edit/Delete + the New Custom Creature button.',
  ] },
  { version: 'v3.102.1', date: '2026-07-07', notes: [
    'The collection editor moved into the Editor as a third “🗃 Collection” tab (alongside Cards and Monsters) — the separate Admin menu button is gone.',
    'Size-specific art is visible again: the per-size image manifest had been emptied, so every size fell back to the base picture. Boss Ironhide now shows its own dedicated artwork. (More per-size images still to be generated.)',
  ] },
  { version: 'v3.102.0', date: '2026-07-07', notes: [
    'The Codex bestiary is now “Creatures” — every discovered creature shows as its actual card, undiscovered ones as face-down mystery cards, and a creature’s page lets you toggle between every SIZE you’ve discovered (stats and art follow).',
    'Your collection is now real: creatures (and each of their sizes) must be DISCOVERED to appear in the Codex and CAPTURED to be pickable in team assembly. A captured non-native size is its own team choice with re-derived HP and Might (“Boss Voltfang”).',
    'New players now pick a STARTER creature (Emberwisp, Voltfang or Thornroot) — the collection grows from there. Existing saves keep their full roster.',
    'New ⚙ Admin console on the menu: toggle any creature/size between undiscovered, discovered, and captured for testing; bulk unlock; reset to a fresh start.',
    'Art generation prompts fixed after the first per-size sample: sizes are now drawn via composition (camera angle, frame fill, scale cues) that overrides size words in the description, and images must be full-bleed (no white border). The flawed Boss Ironhide image was unpublished pending regeneration.',
  ] },
  { version: 'v3.101.1', date: '2026-07-07', notes: [
    'First size-specific portrait is live: a Boss-scale Ironhide gets its own dedicated artwork (drawn colossal), proving the per-size art pipeline end to end. More sizes/creatures to follow.',
  ] },
  { version: 'v3.101.0', date: '2026-07-07', notes: [
    'Monster size no longer stretches or shrinks a single portrait (which just blurred it). The image now renders at its native size; a creature’s size still reads from the size word and badge on the card.',
    'Groundwork for size-specific art: each size (Baby → Boss) can now have its own generated portrait, and the game automatically uses it when available (falling back to the base image until then). The art pipeline and AI Forge now describe each size distinctly so a Baby is drawn small and a Boss colossal.',
  ] },
  { version: 'v3.100.7', date: '2026-07-06', notes: [
    'Hand card layering now works like a proper stack: by default the leftmost card is on the bottom and the rightmost on top; hovering any card raises it above its neighbours and it stays there. The stacking order is compacted each time so z-indices never creep upward.',
  ] },
  { version: 'v3.100.6', date: '2026-07-06', notes: [
    'Fixed hover layering when sweeping the mouse across the hand: previously the last card you passed jumped on top, tucking earlier ones back behind their neighbours. Raised cards now hold a left-over-right stacking order so each stays above the card to its right.',
  ] },
  { version: 'v3.100.5', date: '2026-07-06', notes: [
    'Once hovered, a hand card simply stays layered above its neighbour — no z-index reset after it settles, so there’s never a clip.',
  ] },
  { version: 'v3.100.4', date: '2026-07-06', notes: [
    'A hovered card now stays above its right-hand neighbour as it settles back down, instead of clipping behind it the moment the mouse leaves.',
  ] },
  { version: 'v3.100.3', date: '2026-07-06', notes: [
    'Hovering the mouse over a card in your hand now raises it — it lifts, straightens and pops above its neighbours so you can read it clearly before deciding to play.',
  ] },
  { version: 'v3.100.2', date: '2026-07-06', notes: [
    'Fixed move effects flashing and never clearing: during the enemy’s turn each attack cancelled the previous effect’s cleanup, so numbers and impact rings piled up and kept flickering. Effects now expire on their own timer and always disappear cleanly.',
    'Enemy attacks now play the exact same effects as yours — flying bolt, lunge, recoil, impact ring and popping number.',
  ] },
  { version: 'v3.100.1', date: '2026-07-06', notes: [
    'Fixed the enemy’s move animations: when a foe attacked, its projectile and lunge were skipped (only the impact ring and number showed). Enemy attacks now fire the full effect — bolt flying from the foe into your creature, attacker lunge, recoil and flash — exactly like your own moves.',
  ] },
  { version: 'v3.100.0', date: '2026-07-06', notes: [
    'Moves now have real punch, on the same spring-physics engine as the hand: playing a card fires a glowing bolt (tinted to the attack’s element) that flies from the attacker to the target and bursts on impact.',
    'The struck creature recoils and flashes, the attacker lunges into the blow, an impact ring rings out, and damage/heal/block numbers POP in and drift up (spring), instead of the old flat float. Blocks and heals give a soft glow pulse.',
  ] },
  { version: 'v3.99.6', date: '2026-07-06', notes: [
    'Rebuilt the combat hand on a physics engine (react-spring + use-gesture — the stack behind the well-known draggable card-fan demos). Cards now move with real spring physics: pick one up and it follows your finger, the rest glide to make room, close the gap when it leaves the hand and re-open a slot when it returns, and everything settles smoothly instead of snapping.',
    'Drop it on a creature to play, drop it in the hand to reorder, tap it for info — and it always springs back to its correct spot if you let go somewhere else.',
  ] },
  { version: 'v3.99.5', date: '2026-07-06', notes: [
    'Hand drag polish: dragging a card clear of the hand now closes the gap it left (no more blank slot), and bringing it back re-opens a space where it will land.',
    'Releasing a card away from the hand now returns it to its correct spot in the fan, and the cards glide as you brush a card through them instead of snapping.',
  ] },
  { version: 'v3.99.4', date: '2026-07-06', notes: [
    'Brought back the good animations on top of the new drag engine: cards fly in from the deck each turn (staggered) and sit in a proper fanned hand again, with the hover pop restored.',
    'Fixed the hand getting shuffled when you drag a card up to target a creature — reordering now only happens while the card is actually over the hand, so lifting one out to play it leaves the rest untouched.',
  ] },
  { version: 'v3.99.3', date: '2026-07-06', notes: [
    'Card dragging is rebuilt on a proper drag-and-drop engine (@dnd-kit) instead of hand-rolled pointer tracking — so it behaves predictably now: pick a card up and it follows your cursor smoothly, the hand shifts to reorder, drop it on an enemy/ally to play it, or tap it for info.',
    'The hand reads as a clean overlapping row of cards (a tidy TCG layout) rather than the previous jittery fan.',
  ] },
  { version: 'v3.99.2', date: '2026-07-06', notes: [
    'The hand is now physical: as you drag a card across it, the other cards bump aside to open a gap where it will land — and releasing it inside the hand leaves it in that new position. Dragging a card up onto a target still plays it.',
  ] },
  { version: 'v3.99.1', date: '2026-07-06', notes: [
    'Dragging is now tracked across the WHOLE page — both move cards and team creatures follow your cursor anywhere, even far into empty space, and simply snap back to where they belong when you release. (The team ghost previously froze once you left a small area.)',
    'Move-card drag: the rest of your hand smoothly closes the gap and re-fans around a card you lift out.',
    'Every card badge now sits INSIDE the card — the attunement icon, kit/archetype corner, cost gem and pick-order badge no longer poke outside the card’s rectangle.',
  ] },
  { version: 'v3.99.0', date: '2026-07-06', notes: [
    'Team assembly now shows REAL creature cards — the roster grid uses the same TCG card you fight with (portrait, size, biology, kit icons), not a custom tile.',
    'The creature modal is a full two-pane browser: the card + lore + stats on the left, and a tabbed, rarity-grouped card browser (Starting Deck / Full Card Pool) on the right.',
    'Anatomy & weapon icons are bigger, hoverable, and CLICKABLE — tap one to see what the trait means and the exact moves it grants. And they now MATTER: every anatomy tag / weapon / aberrant feature is guaranteed a move in the starting deck, so a Venom beast starts venomous and an Axe-wielder starts with axe work.',
    'Drag fixes: team reordering is now insertion-point based — you can freely displace the Vanguard and drag back and forth without it locking up; lifting a hand card dynamically re-fans and re-centers the remaining cards around the gap.',
    'Archetypes are HUMANOID-ONLY everywhere now: beasts and aberrations are instinct-driven (no class) — enforced in the generator, forge, editor and creator, and shown as “Instinctive” in the bestiary.',
    'Fixed Execute/Crushing Jaws: their “vs targets below 50% HP” bonus was firing on EVERY hit (and the card text read “5000%”).',
  ] },
  { version: 'v3.98.0', date: '2026-07-03', notes: [
    'The enemy turn now plays out ACTION BY ACTION, Slay-the-Spire style: each move resolves on its own beat with a big on-screen announcement (“Emberwisp uses Miasma!”) so you can actually follow what hit you — no more whole turns slamming through in one frame.',
    'Cards are DEALT into your hand each turn — they fly in from the deck one after another and settle into the fan.',
    'Team assembly now shows a creature’s FULL CARD POOL (kit + subtypes + elements + forged signature moves, sorted up the rarity ladder) alongside its Starting Deck — see everything it can learn before you commit.',
    'Sizes are visible everywhere: portraits scale with a creature’s size (Bosses loom, Babies are tiny), and the size word (“Large Ironhide”) now shows on bench minis and the team-assembly grid, not just the big card.',
  ] },
  { version: 'v3.97.0', date: '2026-07-03', notes: [
    'THE CREATURE FORGE — the game’s core fantasy is live. Write anything (even just a name) and one intelligently-prompted AI call authors the whole creature: name, two paragraphs of lore, a physical description, full typings (body types, subtypes, family, anatomy/weapons, archetype, attunements, size), 2–3 BESPOKE signature moves woven into its deck, an art prompt — and, with an API key, a style-locked portrait drawn on the spot.',
    'Everything the AI writes is validated and clamped against the engine (axis legality, card-op vocabulary, fair numeric budgets per energy), so forged creatures are always playable and never broken. With no API key the forge still works via keyword heuristics + templated flavor.',
    'Heuristic upgrades: word-boundary matching (“Gloomshell” no longer reads as demonic), and family keywords now imply the body type (a “turtle” is a Reptilian Beast).',
  ] },
  { version: 'v3.96.0', date: '2026-07-03', notes: [
    'EVERY card can now be upgraded at a Campfire. Cards without a hand-authored upgrade get a fair auto-derived “+” version (bigger damage/Block/statuses/draw — or cheaper when there’s nothing to grow). Beast, aberration, weapon, subtype and elemental cards all upgrade now.',
    'Subtypes gained innate TRAITS you can feel: Mechanical creatures re-plate 2 Block every turn, Undead knit back Regen when struck, Demonic dread Weakens the enemy Vanguard, Elementals discharge 2 damage at turn’s end, and Giants start every combat with 6 braced Block. Traits show as pips on the card.',
    'The Editor can now author true HYBRIDS — pick a 2nd body type and both kits’ pickers appear (a Beast/Humanoid gets Family + Anatomy AND Weapons).',
    'Emberdrake, Grizzlord and Felhound got full bestiary pages (lore, strategy, tips). The balance bot now reads the enemy’s telegraphed turn and blocks like a player — new baseline: ~15% bot win rate (a floor; real players upgrade, evolve, and drink potions).',
  ] },
  { version: 'v3.95.0', date: '2026-07-03', notes: [
    'Three new roster creatures show off the taxonomy: EMBERDRAKE (a Draconic beast — searing Breath, raking dives), GRIZZLORD (a true Chimera — a Beast/Humanoid hybrid fighting with claws, teeth AND an axe), and FELHOUND (a Demonic beast that trades its own blood for cursed strikes). All three also appear as enemies in the mid/late act.',
  ] },
  { version: 'v3.94.0', date: '2026-07-03', notes: [
    'AI creature creation now infers the FULL kit: describe “an ancient undead dragon with fiery breath” and you get a Draconic Beast with Teeth/Wings/Breath anatomy, Giant + Undead + Ancient subtypes, Fire attunement — and its card reads “Ancient Undead Leviathan”. Humanoids get inferred weapons; aberrations get inferred families and features.',
    'Creature placeholder art now matches the new taxonomy: a Draconic beast draws dragons, an Undead humanoid draws skeletons, an Ooze draws slimes (family → subtype → body type, most specific first).',
    'Codex bestiary pages now show the full biological identity (subtype-prefixed name + family) and the creature’s anatomy/weapons.',
  ] },
  { version: 'v3.93.0', date: '2026-07-03', notes: [
    'Fixed a major regression from the body-type rework: subtypes and families had stopped affecting stats and elemental matchups. Ironhide has his Giant bulk back (125 HP), Grimsoul his Undead resistances, Cogwright his Mechanical armor, and Draconic beasts their dragon toughness. The Giant subtype now also forces a creature to at least Large size.',
    'Every starter deck is now guaranteed a basic Strike and Defend — beasts and aberrations whose kits had no block card were starting runs with tiny, defenseless decks (a big reason runs felt unwinnable).',
    'Run enemies now fight with their real kits too: a beast foe uses its family + anatomy cards, a humanoid its weapons, instead of everyone borrowing archetype decks. Enemy HP tiers gently re-tuned for the new kits.',
    'The on-card SUPER EFFECTIVE / RESISTED banner now uses the exact same matchup engine as the damage numbers, so it can never disagree with what actually lands. The Codex now teaches the Body Type + Subtype model.',
  ] },
  { version: 'v3.92.1', date: '2026-06-28', notes: [
    'Drag reordering now reflows live: as you drag a team card over another, the cards slide to their new slots in real time (not just on release), so you can see exactly where it will land. In combat, lifting a card out of your hand now smoothly closes the gap. Both use the same FLIP slide animation.',
  ] },
  { version: 'v3.92.0', date: '2026-06-28', notes: [
    'Your team now displays as a row of CARDS (portrait, name, role, HP) instead of status bars, and reordering uses the same smooth drag as playing a card from your combat hand — a floating copy follows your finger/cursor and the order commits when you drop. No more giant glitchy ghost.',
  ] },
  { version: 'v3.91.1', date: '2026-06-28', notes: [
    'Fixed the Assemble-Team drag glitch — the browser’s native image-drag was firing on creature portraits, flashing a huge ghost image while you reordered the team. Portraits no longer hijack the drag; team reordering is smooth.',
  ] },
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

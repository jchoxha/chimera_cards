const DEFAULT_MONSTERS = [
  // =====================================================================
  // PYRE — fire, heat, ash. Status: Burn. Aggressive damage-over-time.
  // =====================================================================
  {
    name: "Cindermouse", element: "pyre", hp: 30, sprite: "🐭", rarity: "common", tier: 1, evolvesTo: "Emberat",
    desc: "A jittery rodent whose whiskers spark when it's nervous, which is always.",
    lore: "A palm-sized rodent with charcoal-grey fur that glows orange along the spine when agitated. Its oversized ears are singed at the tips, its whiskers throw tiny sparks, and a constantly-twitching nose leaves little smoke-puffs. Round, anxious eyes. Tiny clawed feet leave scorch prints. Endearingly twitchy, like a creature that has had far too much coffee and is also slightly on fire.",
    cards: [
      { id: "scorch", name: "Scorch", type: "attack", cost: 1, dmg: 8, burn: 2, text: "Deal 8 damage. Apply 2 Burn." },
      { id: "scamper", name: "Scamper", type: "skill", cost: 0, block: 4, draw: 1, text: "Gain 4 block. Draw 1." },
      { id: "flarerush", name: "Flare Rush", type: "attack", cost: 2, dmg: 14, text: "Deal 14 damage." },
    ],
  },
  {
    name: "Emberat", element: "pyre", hp: 48, sprite: "🐀", rarity: "uncommon", tier: 2, evolvesTo: "Infernyx",
    desc: "The cindermouse grown bold, its coat now a slow-burning coal.",
    lore: "A large rat the size of a housecat, fur replaced by overlapping ember-scales that pulse like breathing coals. A long whip-tail trails actual flame. It stands half-reared with a confident, troublemaking grin showing two glowing incisors. Cracks of molten light run along its limbs. No longer anxious — now it's the thing other creatures are anxious about.",
    cards: [
      { id: "cinderbite", name: "Cinder Bite", type: "attack", cost: 1, dmg: 11, burn: 3, text: "Deal 11 damage. Apply 3 Burn." },
      { id: "emberguard", name: "Ember Guard", type: "skill", cost: 1, block: 8, text: "Gain 8 block." },
      { id: "pyreleap", name: "Pyre Leap", type: "attack", cost: 2, dmg: 18, text: "Deal 18 damage." },
    ],
  },
  {
    name: "Infernyx", element: "pyre", hp: 66, sprite: "🔥", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "A blazing predator that leaves only ash and the smell of ozone.",
    cards: [
      { id: "immolate", name: "Immolate", type: "attack", cost: 2, dmg: 22, burn: 4, text: "Deal 22 damage. Apply 4 Burn." },
      { id: "magmaward", name: "Magma Ward", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "wildfire", name: "Wildfire", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
    lore: "A lean, wolf-sized fire-beast on four taloned legs, its body made of layered flame-feathers in red, orange and white-hot gold. A mane of living fire streams backward as if always running into wind. Eyes are slit pupils in molten pools. It moves like a predator that has never once been prey. Smoke curls from its nostrils; the ground blackens where it stands.",
  },
  {
    name: "Magmaw", element: "pyre", elements: ["pyre", "stone"], hp: 44, sprite: "🌋", rarity: "uncommon", tier: 1, evolvesTo: "Volcanoth",
    desc: "A lumbering maw of cooling lava that eats almost anything.",
    lore: "A bulky, toad-shaped creature the size of a boulder, its hide a crust of hardened black lava cracked to reveal glowing orange magma beneath. An enormous mouth splits its whole front, lined with stalactite teeth. Tiny stubby legs. It drools molten rock. Slow, dim, and weirdly affectionate toward whatever it isn't currently trying to swallow.",
    cards: [
      { id: "lavaspit", name: "Lava Spit", type: "attack", cost: 1, dmg: 9, burn: 2, text: "Deal 9 damage. Apply 2 Burn." },
      { id: "harden", name: "Harden", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "erupt", name: "Erupt", type: "attack", cost: 2, dmg: 16, text: "Deal 16 damage." },
    ],
  },
  {
    name: "Volcanoth", element: "pyre", elements: ["pyre", "stone"], hp: 70, sprite: "🐲", rarity: "rare", tier: 2, evolvesTo: null,
    desc: "A mountain given limbs and a furnace heart.",
    lore: "A hulking quadruped the size of a small hill, its back a literal miniature volcano that smokes and occasionally spits cinders. Obsidian armor plates over a molten core visible through the seams. Heavy clawed forelimbs, a craggy beard of cooled lava, and small fierce eyes. When it roars, the vent on its back erupts. Ancient, territorial, slow to anger but unstoppable once roused.",
    cards: [
      { id: "magmaburst", name: "Magma Burst", type: "attack", cost: 2, dmg: 20, burn: 3, text: "Deal 20 damage. Apply 3 Burn." },
      { id: "obsidian", name: "Obsidian Skin", type: "skill", cost: 1, block: 14, text: "Gain 14 block." },
      { id: "moltencore", name: "Molten Core", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Phoenetia", element: "pyre", hp: 90, sprite: "🦅", rarity: "godly", tier: 1, evolvesTo: null,
    desc: "A reborn flame-bird said to outlive the sun itself.",
    lore: "A magnificent raptor with a wingspan that blots the sky, every feather a tongue of layered fire shading from deep crimson at the body to blinding gold at the wingtips. A long tail of streaming flame, a crest of white fire, and eyes like twin suns. It leaves trails of embers that bloom into flowers of light. Regal, serene, and utterly without fear — for it has died a thousand times and returned each dawn.",
    cards: [
      { id: "rebirth", name: "Rebirth", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
      { id: "solardive", name: "Solar Dive", type: "attack", cost: 2, dmg: 26, burn: 4, text: "Deal 26 damage. Apply 4 Burn." },
      { id: "emberveil", name: "Ember Veil", type: "skill", cost: 1, block: 18, draw: 1, text: "Gain 18 block. Draw 1." },
    ],
  },

  // =====================================================================
  // FROST — ice, cold. Status: Chill (enemy hits softer). Control.
  // =====================================================================
  {
    name: "Snowpup", element: "frost", hp: 30, sprite: "🐶", rarity: "common", tier: 1, evolvesTo: "Frostfang",
    desc: "A fluffy pup that sneezes snowflakes and trips over its own paws.",
    lore: "A round, impossibly fluffy puppy with fur like fresh powder snow, pale blue at the ear-tips and tail. Its breath fogs in little crystalline clouds, and it leaves tiny frost-paw prints. Big dark wet eyes, a small blue nose, oversized clumsy paws. When it sneezes, a puff of snowflakes scatters. Pure joyful innocence that happens to flash-freeze its surroundings.",
    cards: [
      { id: "nip", name: "Frost Nip", type: "attack", cost: 1, dmg: 6, chill: 2, text: "Deal 6 damage. Apply 2 Chill." },
      { id: "fluff", name: "Fluff Up", type: "skill", cost: 1, block: 8, text: "Gain 8 block." },
      { id: "snowroll", name: "Snow Roll", type: "attack", cost: 1, dmg: 9, text: "Deal 9 damage." },
    ],
  },
  {
    name: "Frostfang", element: "frost", hp: 50, sprite: "🐺", rarity: "uncommon", tier: 2, evolvesTo: "Glaciathar",
    desc: "A winter wolf whose howl drops the temperature for miles.",
    lore: "A lean wolf with a thick double coat of white and glacier-blue fur, rimed with actual frost. Its breath is a visible cold mist, its fangs are clear ice, and a crest of icicle-spikes runs down its neck. Pale silver eyes. It moves in eerie silence over snow. Noble and aloof, the alpha of a pack that exists only in blizzards.",
    cards: [
      { id: "icefang", name: "Ice Fang", type: "attack", cost: 1, dmg: 11, chill: 3, text: "Deal 11 damage. Apply 3 Chill." },
      { id: "frostcoat", name: "Frost Coat", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "howl", name: "Winter Howl", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Glaciathar", element: "frost", elements: ["frost", "stone"], hp: 74, sprite: "🧊", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "An ancient ice-beast that wears a glacier like armor.",
    lore: "A massive bear-like behemoth sheathed in translucent blue glacier ice, the dim shape of an ancient creature visible frozen deep within. Jagged ice crowns its shoulders and skull; its breath is a freezing gale. Every step cracks like splitting icebergs. Slow, immense, and timeless — it remembers the first winter. Eyes are two points of cold white light deep in the ice.",
    cards: [
      { id: "avalanchemaw", name: "Avalanche Maw", type: "attack", cost: 2, dmg: 22, chill: 3, text: "Deal 22 damage. Apply 3 Chill." },
      { id: "glacierwall", name: "Glacier Wall", type: "skill", cost: 2, block: 22, text: "Gain 22 block." },
      { id: "deepwinter", name: "Deep Winter", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Sleetsprite", element: "frost", hp: 26, sprite: "❄️", rarity: "uncommon", tier: 1, evolvesTo: null,
    desc: "A mischievous flurry that pelts travelers with hail.",
    lore: "A tiny floating sprite, little more than a swirling spiral of sleet and frost with two bright mischievous eyes at its center and small wispy ice-crystal hands. It giggles in a sound like tinkling icicles and darts about leaving frost patterns on everything. Playful and a bit of a troublemaker, it loves to freeze puddles where people will slip.",
    cards: [
      { id: "hailshot", name: "Hail Shot", type: "attack", cost: 1, dmg: 5, chill: 2, text: "Deal 5 damage. Apply 2 Chill." },
      { id: "flurry", name: "Flurry", type: "skill", cost: 0, block: 5, draw: 1, text: "Gain 5 block. Draw 1." },
      { id: "whiteout", name: "Whiteout", type: "skill", cost: 1, chill: 4, text: "Apply 4 Chill." },
    ],
  },

  // =====================================================================
  // HYDRO — water in all forms. Status: Soak (enables reactions). Setup.
  // =====================================================================
  {
    name: "Tidalith", element: "hydro", hp: 40, sprite: "🐟", rarity: "common", tier: 1, evolvesTo: "Maelune",
    desc: "A slow river-fish that wears down its foes like water wears stone.",
    lore: "A fat, dignified carp-like fish that hovers upright in a self-sustaining bubble of water, finning calmly through the air. Iridescent blue-green scales, long flowing fins like wet silk, and a serene, almost sleepy expression with heavy-lidded eyes. Droplets constantly bead and fall from it. Patient and unbothered, the embodiment of slow inevitable erosion.",
    cards: [
      { id: "douse", name: "Douse", type: "attack", cost: 1, dmg: 6, soak: 2, text: "Deal 6 damage. Apply 2 Soak." },
      { id: "ripple", name: "Ripple Wall", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
      { id: "undertow", name: "Undertow", type: "attack", cost: 2, dmg: 10, hits: 2, text: "Deal 10 damage twice." },
    ],
  },
  {
    name: "Maelune", element: "hydro", hp: 58, sprite: "🌊", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "Tides answer its call; foes forget how to stand.",
    lore: "A graceful serpentine creature of living water, its body a coiling wave given form, translucent blue with foam-white edges and a crest of spray along its back. Two calm glowing eyes like deep-sea light. It rises and falls as if breathing with an invisible tide. Where it moves, water follows. Mesmerizing and a little melancholy, like the pull of the moon on the sea.",
    cards: [
      { id: "riptide", name: "Riptide", type: "attack", cost: 1, dmg: 8, soak: 3, text: "Deal 8 damage. Apply 3 Soak." },
      { id: "tidalwall", name: "Tidal Wall", type: "skill", cost: 1, block: 13, text: "Gain 13 block." },
      { id: "drown", name: "Drown", type: "attack", cost: 2, dmg: 13, hits: 2, text: "Deal 13 damage twice." },
    ],
  },
  {
    name: "Brineling", element: "hydro", hp: 30, sprite: "🦐", rarity: "common", tier: 1, evolvesTo: "Krakenmaw",
    desc: "A salty little sprite that nips at ankles and steals shiny things.",
    lore: "A small, semi-transparent shrimp-like creature with a blue-green shell, far too many tiny waving legs, and enormous curious eyes on stalks. It clutches a single found pebble like treasure. Bubbles stream from its mouth as it chitters. Feisty, greedy, and weirdly brave for something you could hold in one hand.",
    cards: [
      { id: "sting", name: "Brine Sting", type: "attack", cost: 0, dmg: 4, text: "Deal 4 damage." },
      { id: "bubble", name: "Bubble Shield", type: "skill", cost: 1, block: 7, draw: 1, text: "Gain 7 block. Draw 1." },
      { id: "spout", name: "Spout", type: "attack", cost: 1, dmg: 8, soak: 2, text: "Deal 8 damage. Apply 2 Soak." },
    ],
  },
  {
    name: "Krakenmaw", element: "hydro", hp: 64, sprite: "🐙", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "Eight arms, one hunger, and a thousand-yard stare.",
    lore: "A deep-sea cephalopod the size of a fishing boat, its bulbous mantle a deep blue-purple mottled with bioluminescent spots that pulse when it hunts. Eight powerful arms lined with suckers, a sharp beak, and one enormous, intelligent, unsettlingly calm eye. It can darken to near-invisibility. Ancient and patient, it has dragged things into the deep that the surface world has forgotten.",
    cards: [
      { id: "tentacle", name: "Tentacle Lash", type: "attack", cost: 1, dmg: 7, hits: 3, text: "Deal 7 damage three times." },
      { id: "inkcloud", name: "Ink Cloud", type: "skill", cost: 1, soak: 3, block: 6, text: "Gain 6 block. Apply 3 Soak." },
      { id: "crush", name: "Crush", type: "attack", cost: 2, dmg: 21, text: "Deal 21 damage." },
    ],
  },
  {
    name: "Leviathos", element: "hydro", hp: 96, sprite: "🐳", rarity: "godly", tier: 1, evolvesTo: null,
    desc: "The ocean given will; tides obey its slow, patient breath.",
    lore: "A colossal whale-serpent whose true size is never fully visible, a leviathan of deep ocean-blue with constellations of bioluminescence mapping its flanks like an undersea sky. Enormous gentle eyes that have watched continents drift. Barnacle-encrusted, trailing kelp and the wreckage of ages. When it surfaces, the sea level drops. Impossibly old, impossibly calm, the living memory of the deep.",
    cards: [
      { id: "maelstrom", name: "Maelstrom", type: "attack", cost: 2, dmg: 12, hits: 2, soak: 2, text: "Deal 12 twice. Apply 2 Soak." },
      { id: "abyss", name: "Abyssal Guard", type: "skill", cost: 2, block: 24, text: "Gain 24 block." },
      { id: "deluge", name: "Deluge", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },

  // =====================================================================
  // CHARGE — electricity. Status: Shock (enemy fumbles). Tempo.
  // =====================================================================
  {
    name: "Voltick", element: "charge", hp: 28, sprite: "🐛", rarity: "common", tier: 1, evolvesTo: "Sparkbug",
    desc: "A tiny grub humming with so much static its fuzz stands on end.",
    lore: "A small caterpillar-like grub, soft yellow with black bands, every hair standing on end and crackling with tiny arcs of static. Two big innocent eyes and little nub legs. It hovers slightly off the ground, repelled by its own charge, and zaps anything it bumps into entirely by accident. Adorably harmless until you touch it.",
    cards: [
      { id: "zap", name: "Zap", type: "attack", cost: 0, dmg: 5, text: "Deal 5 damage." },
      { id: "charge", name: "Charge Up", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
      { id: "jolt", name: "Jolt", type: "attack", cost: 1, dmg: 8, shock: 1, text: "Deal 8 damage. Apply 1 Shock." },
    ],
  },
  {
    name: "Sparkbug", element: "charge", hp: 44, sprite: "🪲", rarity: "uncommon", tier: 2, evolvesTo: "Thunderwing",
    desc: "A beetle whose shell stores a thunderclap waiting to be released.",
    lore: "A robust beetle the size of a fist with a glossy black carapace veined in glowing electric-yellow circuitry-like patterns. Its wing cases crackle with contained energy, and twin antennae spark at the tips. It stands on six sturdy legs, wings buzzing with a sound like a power line. Confident and a little smug, it knows exactly how much voltage it's carrying.",
    cards: [
      { id: "spark", name: "Spark Bolt", type: "attack", cost: 1, dmg: 10, shock: 1, text: "Deal 10 damage. Apply 1 Shock." },
      { id: "staticshell", name: "Static Shell", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "overcharge", name: "Overcharge", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Thunderwing", element: "charge", hp: 58, sprite: "🦇", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "Its wingbeats split the air with forks of lightning.",
    lore: "A sleek bat-dragon with membrane wings that crackle with branching lightning at every beat, body a deep storm-blue with glowing yellow energy lines tracing its bones like living circuitry. Sharp intelligent eyes glow electric white. A long tail ends in a conductive spear-tip. It rides thunderheads and dives like a lightning strike. Fierce, fast, and impossible to pin down.",
    cards: [
      { id: "stormbeat", name: "Storm Beat", type: "attack", cost: 1, dmg: 12, shock: 1, draw: 1, text: "Deal 12 damage. Apply 1 Shock. Draw 1." },
      { id: "staticveil", name: "Static Veil", type: "skill", cost: 1, block: 12, shock: 1, text: "Gain 12 block. Apply 1 Shock." },
      { id: "voltsurge", name: "Volt Surge", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Tempestus", element: "charge", hp: 88, sprite: "🌩️", rarity: "godly", tier: 1, evolvesTo: null,
    desc: "A walking storm front that decides where the lightning falls.",
    lore: "A towering humanoid storm-elemental, its body a churning thundercloud lit from within by constant lightning, with a crackling crown of arcing electricity and eyes like two white-hot suns. Where its feet touch, the ground scorches. Rain falls perpetually around it. It speaks in thunder. Awesome and terrible, an avatar of the sky's full fury given the patience of a god.",
    cards: [
      { id: "cyclonefury", name: "Thunderhead", type: "attack", cost: 2, dmg: 9, hits: 3, shock: 1, text: "Deal 9 three times. Apply 1 Shock." },
      { id: "eyeofstorm", name: "Eye of Storm", type: "skill", cost: 1, block: 16, draw: 2, text: "Gain 16 block. Draw 2." },
      { id: "galecrown", name: "Storm Crown", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },

  // =====================================================================
  // AERO — air, wind, flight. No status; mobility, draw, evasion.
  // =====================================================================
  {
    name: "Zephyrling", element: "aero", hp: 26, sprite: "🦗", rarity: "common", tier: 1, evolvesTo: "Gustrike",
    desc: "Fast and frail, it flickers between strikes like a leaf on the wind.",
    lore: "A delicate cricket-fairy with translucent shimmering wings that beat too fast to see, a slender pale-green body, and long graceful legs. It darts in quick zigzags, leaving faint swirls of air. Big curious eyes and twitching antennae. It never stays still, never lands for long, and seems perpetually delighted by the simple joy of moving fast.",
    cards: [
      { id: "gust", name: "Gust", type: "attack", cost: 0, dmg: 4, text: "Deal 4 damage." },
      { id: "cyclone", name: "Cyclone", type: "attack", cost: 1, dmg: 7, draw: 1, text: "Deal 7 damage. Draw 1." },
      { id: "tailwind", name: "Tailwind", type: "power", cost: 1, strength: 1, text: "Gain 1 Strength." },
    ],
  },
  {
    name: "Gustrike", element: "aero", hp: 42, sprite: "🦅", rarity: "uncommon", tier: 2, evolvesTo: "Stormcrest",
    desc: "A raptor that rides its own private thunderhead.",
    lore: "A fierce falcon with feathers in slate-grey and white that seem to blur into wind at the edges. Its wings are unusually long and swept, built for impossible speed, and a small spiral of cloud trails it always. Piercing golden eyes, sharp curved beak, talons like hooks. It folds and dives faster than the eye can track, the sky's own arrow.",
    cards: [
      { id: "talon", name: "Talon Dive", type: "attack", cost: 1, dmg: 10, draw: 1, text: "Deal 10 damage. Draw 1." },
      { id: "updraft", name: "Updraft", type: "skill", cost: 1, block: 8, draw: 1, text: "Gain 8 block. Draw 1." },
      { id: "galeforce", name: "Gale Force", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Stormcrest", element: "aero", hp: 56, sprite: "🦅", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "Where it screams, the sky itself answers.",
    lore: "A majestic eagle-phoenix with a wingspan to shame storm clouds, feathers shading from deep storm-grey at the body to brilliant white-gold at the wingtips, with a regal crest of windswept plumes. Its eyes are bright with intelligence and challenge. Air spirals visibly around its pinions. It rules the high places where only the wind goes, and bows to nothing beneath the clouds.",
    cards: [
      { id: "thunderclap", name: "Skybreak", type: "attack", cost: 1, dmg: 13, draw: 1, text: "Deal 13 damage. Draw 1." },
      { id: "stormshield", name: "Wind Shield", type: "skill", cost: 1, block: 12, draw: 1, text: "Gain 12 block. Draw 1." },
      { id: "tempest", name: "Tempest", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Mothlet", element: "aero", hp: 24, sprite: "🦋", rarity: "common", tier: 1, evolvesTo: "Spectermoth",
    desc: "Drawn to light, it dusts the air with shimmering confusion.",
    lore: "A soft, palm-sized moth with wings of pale lavender and cream patterned like dusk, fringed in downy fluff. Big gentle eyes and feathery antennae. A faint shimmer of glittering scale-dust drifts from its wings, catching the light. Dreamy and gentle, it drifts toward any glow, leaving a trail of soft sparkle.",
    cards: [
      { id: "dust", name: "Dazzle Dust", type: "skill", cost: 0, weak: 2, text: "Apply 2 Weak." },
      { id: "flutter", name: "Flutter", type: "skill", cost: 0, block: 4, draw: 1, text: "Gain 4 block. Draw 1." },
      { id: "wingbeat", name: "Wing Beat", type: "attack", cost: 1, dmg: 8, text: "Deal 8 damage." },
    ],
  },
  {
    name: "Spectermoth", element: "aero", elements: ["aero", "lumen"], hp: 40, sprite: "🌙", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A moonlit phantom that blinds before it bites.",
    lore: "A large, ghostly moth with wings like sheets of moonlit silk, deep indigo edged in glowing silver moon-patterns, semi-transparent so stars seem to shine through. Its eyes glow soft white, and it leaves a wake of luminous dust that hangs in the air like a galaxy. Silent, eerie, and beautiful, it haunts night travelers who follow its light too far.",
    cards: [
      { id: "moondust", name: "Moon Dust", type: "skill", cost: 1, weak: 4, block: 5, text: "Gain 5 block. Apply 4 Weak." },
      { id: "phaseflit", name: "Phase Flit", type: "attack", cost: 1, dmg: 11, draw: 1, text: "Deal 11 damage. Draw 1." },
      { id: "lunarbeam", name: "Lunar Beam", type: "attack", cost: 2, dmg: 17, text: "Deal 17 damage." },
    ],
  },

  // =====================================================================
  // STONE — earth, rock. No status; heavy block, raw power. Defense.
  // =====================================================================
  {
    name: "Pebblet", element: "stone", hp: 38, sprite: "🪨", rarity: "uncommon", tier: 1, evolvesTo: "Boulderkin",
    desc: "A grumpy little rock with a hard head and harder opinions.",
    lore: "A small round boulder-creature with stubby rock arms and legs, a craggy grey body flecked with mica that glitters, and a permanently grumpy face with heavy stone brows over small stubborn eyes. It sits a lot, refusing to move, and headbutts things it dislikes. Slow to trust but immovably loyal once you win it over.",
    cards: [
      { id: "tackle", name: "Rock Tackle", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "curlup", name: "Curl Up", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "rollout", name: "Rollout", type: "attack", cost: 2, dmg: 15, text: "Deal 15 damage." },
    ],
  },
  {
    name: "Boulderkin", element: "stone", hp: 60, sprite: "⛰️", rarity: "rare", tier: 2, evolvesTo: "Titanore",
    desc: "Slow, immovable, and quietly furious.",
    lore: "A hulking creature of stacked boulders held together by sheer will, mossy in the crevices, with massive fists of solid granite and a craggy brow shadowing deep-set glowing eyes. Slabs of rock form pauldrons across its shoulders. It moves like a landslide in reverse, deliberate and inevitable. Stoic and silent, it speaks only in the grinding of stone.",
    cards: [
      { id: "slam", name: "Stone Slam", type: "attack", cost: 1, dmg: 11, text: "Deal 11 damage." },
      { id: "bastion", name: "Bastion", type: "skill", cost: 1, block: 16, text: "Gain 16 block." },
      { id: "quake", name: "Quake", type: "attack", cost: 2, dmg: 18, weak: 2, text: "Deal 18 damage. Apply 2 Weak." },
    ],
  },
  {
    name: "Titanore", element: "stone", hp: 80, sprite: "🗿", rarity: "epic", tier: 3, evolvesTo: null,
    desc: "A walking monolith older than the mountains it resembles.",
    lore: "A colossal golem carved from a single mountain's heart, its body ancient weathered stone inlaid with veins of glowing ore in gold and copper. Monumental and angular like a living temple, with a great impassive face reminiscent of old idols and eyes that burn like forge-light. Runes of a forgotten age are etched across its chest. It has stood guard for ten thousand years and will stand ten thousand more.",
    cards: [
      { id: "monolith", name: "Monolith Smash", type: "attack", cost: 2, dmg: 24, text: "Deal 24 damage." },
      { id: "aegis", name: "Aegis", type: "skill", cost: 2, block: 22, text: "Gain 22 block." },
      { id: "bedrock", name: "Bedrock", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },
  {
    name: "Shellid", element: "stone", hp: 46, sprite: "🐢", rarity: "common", tier: 1, evolvesTo: null,
    desc: "A patient tortoise that wins every fight by simply outlasting it.",
    lore: "A wise old tortoise with a shell of overlapping stone plates like a fortress, weathered grey-brown with lichen growing on the dome. Its wrinkled face wears an expression of infinite calm, and its eyes are warm and ancient. It tucks fully into its shell at the first sign of trouble and waits, serene, for the danger to simply give up and leave.",
    cards: [
      { id: "shellbash", name: "Shell Bash", type: "attack", cost: 1, dmg: 6, block: 4, text: "Deal 6 damage. Gain 4 block." },
      { id: "withdraw", name: "Aegis Shell", type: "skill", cost: 1, shield: 9, text: "Gain 9 Shield (protects whole team this turn)." },
      { id: "fortify", name: "Fortify", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Terrabyss", element: "stone", hp: 100, sprite: "🌑", rarity: "godly", tier: 1, evolvesTo: null,
    desc: "The bedrock of the world, awake at last and not pleased.",
    lore: "A planet-scaled titan whose body is a fragment of the world's deep crust, continents of stone plating over a core of glowing magma seen through tectonic cracks. Mountains form its shoulders, canyons its joints. Its face is a vast, slow, ancient thing like a cliff with eyes of molten gold. When it wakes, the earth quakes for miles. It is the ground itself, given the will to stand.",
    cards: [
      { id: "continent", name: "Continental Crush", type: "attack", cost: 2, dmg: 36, exhaust: true, text: "Deal 36 damage. Banish." },
      { id: "bulwarkx", name: "Unbreakable", type: "skill", cost: 2, block: 28, text: "Gain 28 block." },
      { id: "tectonic", name: "Tectonic", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },

  // =====================================================================
  // METAL — alloys, machines. Status: none (Bulwark via cards). Defense.
  // =====================================================================
  {
    name: "Coggle", element: "metal", hp: 34, sprite: "⚙️", rarity: "common", tier: 1, evolvesTo: "Ironclad",
    desc: "A wind-up critter of spare parts that chirps in clicks and whirrs.",
    lore: "A small clockwork creature assembled from mismatched brass gears, copper wire, and a single big glass eye-lens that whirrs as it focuses. It scuttles on three spindly mechanical legs, a key turning slowly in its back. It chirps in cheerful mechanical clicks and collects shiny bolts. Endearingly earnest, like a helpful little robot that wants very much to be useful.",
    cards: [
      { id: "wrench", name: "Wrench Bash", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "plate", name: "Bolt Plate", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "windup", name: "Wind Up", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Ironclad", element: "metal", hp: 56, sprite: "🛡️", rarity: "uncommon", tier: 2, evolvesTo: "Colossite",
    desc: "An armored sentinel that has never once retreated.",
    lore: "A broad humanoid automaton plated in riveted steel armor, battered and proud, with a heavy rectangular helm hiding a single glowing blue optic. Pistons hiss at its joints, and one arm bears an integrated tower shield. It stands like a soldier at eternal attention. Dutiful, unflinching, the kind of guardian that plants its feet and says: none shall pass.",
    cards: [
      { id: "ironpunch", name: "Iron Punch", type: "attack", cost: 1, dmg: 10, text: "Deal 10 damage." },
      { id: "platearmor", name: "Bulwark", type: "skill", cost: 1, shield: 8, block: 6, text: "Gain 8 Shield and 6 block." },
      { id: "rivet", name: "Rivet", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Colossite", element: "metal", hp: 84, sprite: "🤖", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "A war-engine the size of a fortress, built to end sieges.",
    lore: "A towering mech-titan of dark burnished alloy and glowing energy conduits, all heavy armored plates, hydraulic limbs, and a fortress-like torso. Its head is a narrow slit visor blazing with cold blue light. Twin shoulder-mounted bulwark shields and fists that could level walls. It moves with ground-shaking deliberation. An ancient weapon that outlived the war it was built for, still standing guard.",
    cards: [
      { id: "siegefist", name: "Siege Fist", type: "attack", cost: 2, dmg: 24, text: "Deal 24 damage." },
      { id: "rampart", name: "Rampart", type: "skill", cost: 2, shield: 14, block: 10, text: "Gain 14 Shield and 10 block." },
      { id: "warforge", name: "War Forge", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Magnetar", element: "metal", elements: ["metal", "charge"], hp: 48, sprite: "🧲", rarity: "epic", tier: 1, evolvesTo: null,
    desc: "A magnetized core that drags loose metal into a bristling shell.",
    lore: "A floating spherical core of dark lodestone wrapped in a constantly-shifting cloud of scrap metal, nails, blades and bolts orbiting it like a deadly halo. Two slit eyes glow from within the metal storm. It pulls weapons from enemies' hands and flings them back. Restless and humming with magnetic force, surrounded always by the clatter of attracted iron.",
    cards: [
      { id: "pull", name: "Magnetic Pull", type: "attack", cost: 1, dmg: 10, weak: 2, text: "Deal 10 damage. Apply 2 Weak." },
      { id: "fieldwall", name: "Field Wall", type: "skill", cost: 2, shield: 12, text: "Gain 12 Shield." },
      { id: "polarize", name: "Polarize", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },

  // =====================================================================
  // CRYSTAL — gemstone, refraction. Status: none (burst/tech). Crystal.
  // =====================================================================
  {
    name: "Prismling", element: "crystal", hp: 34, sprite: "🔆", rarity: "uncommon", tier: 1, evolvesTo: "Gemglow",
    desc: "It splits light into a dozen cutting colors.",
    lore: "A small floating cluster of clear quartz crystals arranged like a flower bud, refracting any light into shifting rainbows that scatter across nearby surfaces. A soft glow pulses at its core where two gentle eyes float. It chimes faintly like struck glass when it moves. Delicate and luminous, it turns even dim caves into kaleidoscopes.",
    cards: [
      { id: "prismbolt", name: "Prism Bolt", type: "attack", cost: 1, dmg: 6, draw: 1, text: "Deal 6 damage. Draw 1." },
      { id: "refract", name: "Refract", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "spectrum", name: "Spectrum", type: "attack", cost: 2, dmg: 16, text: "Deal 16 damage." },
    ],
  },
  {
    name: "Gemglow", element: "crystal", hp: 52, sprite: "💎", rarity: "rare", tier: 2, evolvesTo: "Aurorach",
    desc: "A living jewel that stores blows and returns them as light.",
    lore: "A graceful deer-like creature whose body is faceted translucent gemstone in amethyst and rose-quartz, antlers branching into sharp prismatic crystals that catch and store light. It glows softly from within, brightening when struck. Calm, elegant eyes like polished gems. It steps lightly, leaving brief afterimages of refracted color, serene and otherworldly.",
    cards: [
      { id: "facetstrike", name: "Facet Strike", type: "attack", cost: 1, dmg: 11, text: "Deal 11 damage." },
      { id: "storelight", name: "Store Light", type: "skill", cost: 1, block: 13, draw: 1, text: "Gain 13 block. Draw 1." },
      { id: "prismbeam", name: "Prism Beam", type: "attack", cost: 2, dmg: 18, text: "Deal 18 damage." },
    ],
  },
  {
    name: "Aurorach", element: "crystal", hp: 72, sprite: "🌈", rarity: "epic", tier: 3, evolvesTo: null,
    desc: "A crystalline sovereign that bends the very spectrum to its will.",
    lore: "A regal stag-like beast grown into a walking cathedral of crystal, its body deep sapphire shot through with veins of every color, crowned by an immense rack of antlers like a chandelier of living gemstone that projects shifting auroras into the air. Its eyes are pools of pure white light. It moves in a hush of chiming crystal, trailing curtains of refracted color like the northern lights given a body.",
    cards: [
      { id: "auroraburst", name: "Aurora Burst", type: "attack", cost: 2, dmg: 22, text: "Deal 22 damage." },
      { id: "lattice", name: "Crystal Lattice", type: "skill", cost: 2, block: 20, draw: 1, text: "Gain 20 block. Draw 1." },
      { id: "refraction", name: "Refraction", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },

  // =====================================================================
  // TOXIN — poison, decay. Status: Poison (ramping DoT). Damage-over-time.
  // =====================================================================
  {
    name: "Sporelet", element: "toxin", hp: 30, sprite: "🍄", rarity: "common", tier: 1, evolvesTo: "Myconid",
    desc: "A bouncing mushroom that puffs spores when it giggles, which is often.",
    lore: "A small round mushroom-creature with a spotted purple-green cap, two cheerful beady eyes, and stubby legs. Every time it laughs or hops, a little puff of glowing green spores escapes its cap. It bounces everywhere, leaving faint toxic mist trails. Innocently delighted by everything, blissfully unaware that its happy spore-clouds are mildly poisonous.",
    cards: [
      { id: "sporepuff", name: "Spore Puff", type: "attack", cost: 1, dmg: 5, poison: 2, text: "Deal 5 damage. Apply 2 Poison." },
      { id: "capguard", name: "Cap Guard", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
      { id: "infect", name: "Infect", type: "skill", cost: 0, poison: 2, text: "Apply 2 Poison." },
    ],
  },
  {
    name: "Myconid", element: "toxin", hp: 50, sprite: "🍄", rarity: "uncommon", tier: 2, evolvesTo: "Rotwarden",
    desc: "A fungal sage that spreads its colony through every wound.",
    lore: "A tall, gangly humanoid fungus with a wide drooping cap shadowing glowing spore-light eyes, a body of fibrous mycelium woven like robes, and long root-fingers. Clouds of luminescent spores drift constantly around it. It moves slowly, deliberately, spreading its colony. Wise and patient in an alien way, it sees all living things as future compost, and means that kindly.",
    cards: [
      { id: "sporecloud", name: "Spore Cloud", type: "attack", cost: 1, dmg: 7, poison: 3, text: "Deal 7 damage. Apply 3 Poison." },
      { id: "myceliumwall", name: "Mycelium Wall", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "blight", name: "Blight", type: "skill", cost: 1, poison: 4, text: "Apply 4 Poison." },
    ],
  },
  {
    name: "Rotwarden", element: "toxin", hp: 72, sprite: "☣️", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "A plague-titan whose presence withers all living things.",
    lore: "A massive, looming horror of fused decay and fungal growth, vaguely humanoid but swollen with bursting spore-sacs and dripping luminescent toxins, its hide a patchwork of rot, bark, and bracket-fungus shelves. Glowing green vapor pours from cracks in its body. A crown of antler-like fungal growths frames a hollow, eyeless face lit by spore-glow. Where it walks, gardens die and new alien growths bloom.",
    cards: [
      { id: "pandemic", name: "Pandemic", type: "attack", cost: 2, dmg: 12, poison: 4, text: "Deal 12 damage. Apply 4 Poison." },
      { id: "rotshield", name: "Rot Shield", type: "skill", cost: 1, block: 16, text: "Gain 16 block." },
      { id: "virulence", name: "Virulence", type: "skill", cost: 2, poison: 7, text: "Apply 7 Poison." },
    ],
  },
  {
    name: "Vipertongue", element: "toxin", hp: 40, sprite: "🐍", rarity: "uncommon", tier: 1, evolvesTo: null,
    desc: "A serpent whose bite carries a venom that only worsens with time.",
    lore: "A sleek, vivid serpent banded in warning colors of acid-green and black, with a flared hood and a flickering forked tongue that drips visible venom. Its eyes are cold vertical slits. It coils and sways hypnotically before striking with blinding speed. Patient, precise, and utterly lethal, it knows its poison does the work long after the bite.",
    cards: [
      { id: "venomfang", name: "Venom Fang", type: "attack", cost: 1, dmg: 8, poison: 3, text: "Deal 8 damage. Apply 3 Poison." },
      { id: "coil", name: "Coil", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "envenom", name: "Envenom", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },

  // =====================================================================
  // FLORA — plants, growth. Status: Regen (self heal). Sustain.
  // =====================================================================
  {
    name: "Seedling", element: "flora", hp: 32, sprite: "🌱", rarity: "common", tier: 1, evolvesTo: "Bloomback",
    desc: "A sprout with a single leaf, reaching always toward the sun.",
    lore: "A tiny creature that is mostly a fat green sprout with two round leaf-arms and a single bigger leaf curling over its head like a sunhat. Its body is a smooth seed-pod with a cheerful little face and dewdrop eyes. It turns to follow sunlight and wiggles happily in the rain. Pure, hopeful new growth, fragile but endlessly determined to bloom.",
    cards: [
      { id: "vinewhip", name: "Vine Whip", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "photosynth", name: "Photosynthesis", type: "skill", cost: 1, regen: 3, text: "Gain 3 Regen (heal each turn)." },
      { id: "rootguard", name: "Root Guard", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
    ],
  },
  {
    name: "Bloomback", element: "flora", hp: 52, sprite: "🌺", rarity: "uncommon", tier: 2, evolvesTo: "Verdantaur",
    desc: "A gentle beast with a garden blooming across its back.",
    lore: "A deer-sized, mossy quadruped whose back is a riot of blooming flowers, ferns, and trailing vines, like a walking meadow. Its body is woven of living wood and soft green moss, with kind amber eyes and small leaf-shaped ears. Butterflies trail it. It steps softly so as not to crush the blossoms it carries. Calm, nurturing, and quietly radiant with life.",
    cards: [
      { id: "petalstorm", name: "Petal Storm", type: "attack", cost: 1, dmg: 10, text: "Deal 10 damage." },
      { id: "bloom", name: "Bloom", type: "skill", cost: 1, regen: 4, block: 6, text: "Gain 4 Regen and 6 block." },
      { id: "overgrow", name: "Overgrow", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Verdantaur", element: "flora", hp: 74, sprite: "🌳", rarity: "rare", tier: 3, evolvesTo: null,
    desc: "An ancient forest-guardian, half-beast and half-grove.",
    lore: "A towering, noble creature like a great stag fused with an ancient oak, its legs gnarled trunk and root, its body bark and living wood, an enormous canopy of leaves and blossoms crowning antlers that branch into a whole treetop. Birds nest in it. Its eyes glow warm green with the patience of centuries. Where it stands, the land heals and grows. The forest's own heart, given hooves.",
    cards: [
      { id: "forestwrath", name: "Forest's Wrath", type: "attack", cost: 2, dmg: 20, text: "Deal 20 damage." },
      { id: "rejuvenate", name: "Rejuvenate", type: "skill", cost: 2, regen: 6, teamheal: 5, text: "Gain 6 Regen. Heal team 5." },
      { id: "ancientgrowth", name: "Ancient Growth", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Cactus Kid", element: "flora", hp: 38, sprite: "🌵", rarity: "common", tier: 1, evolvesTo: null,
    desc: "A prickly little gunslinger that hugs no one and regrets nothing.",
    lore: "A small barrel cactus with two stubby arms, a wide-brimmed straw hat, and a perpetual squint of desert-tough attitude. Bright pink flowers bloom on its crown despite its grumpiness, and it's covered in defensive needles. It stands bow-legged like an old west gunslinger. Tough, dry-humored, and secretly soft on the inside, if you could ever get past the spines.",
    cards: [
      { id: "needleshot", name: "Needle Shot", type: "attack", cost: 1, dmg: 5, hits: 2, text: "Deal 5 damage twice." },
      { id: "spineguard", name: "Spine Guard", type: "skill", cost: 1, block: 11, text: "Gain 11 block." },
      { id: "deeproots", name: "Deep Roots", type: "skill", cost: 1, regen: 3, text: "Gain 3 Regen." },
    ],
  },

  // =====================================================================
  // BEAST — primal animals. Status: Frenzy (scaling strength). Snowball.
  // =====================================================================
  {
    name: "Cubrawl", element: "beast", hp: 34, sprite: "🐻", rarity: "uncommon", tier: 1, evolvesTo: "Ursurge",
    desc: "A rowdy cub that wants to wrestle absolutely everything.",
    lore: "A chubby, energetic bear cub with thick brown fur, oversized paws, and a face stuck between adorable and ferocious. It rears up to look bigger, tiny claws out, growling a growl that hasn't dropped yet. Scars and burrs in its fur from constant roughhousing. Boundlessly enthusiastic, it treats every encounter as an invitation to play-fight, and it does not know its own growing strength.",
    cards: [
      { id: "swipe", name: "Cub Swipe", type: "attack", cost: 1, dmg: 8, text: "Deal 8 damage." },
      { id: "toughen", name: "Toughen", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
      { id: "rile", name: "Rile Up", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Ursurge", element: "beast", hp: 56, sprite: "🐻‍❄️", rarity: "rare", tier: 2, evolvesTo: "Beastlord",
    desc: "A towering bruiser that grows stronger with every blow it lands.",
    lore: "A massive bear rearing on hind legs, slabs of muscle under a shaggy coat scarred from countless battles, with a notched ear and a battle-worn snarl baring real fangs. Its forelimbs end in cleaver-sized claws. A wild gleam of building fury in its eyes. With every hit it lands it grows angrier and stronger, a snowballing avalanche of raw primal power.",
    cards: [
      { id: "maul", name: "Maul", type: "attack", cost: 1, dmg: 11, text: "Deal 11 damage." },
      { id: "frenzybuild", name: "Build Frenzy", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
      { id: "guardstance", name: "Guard Stance", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
    ],
  },
  {
    name: "Beastlord", element: "beast", hp: 78, sprite: "🦁", rarity: "epic", tier: 3, evolvesTo: null,
    desc: "The apex of all wild things, crowned by instinct alone.",
    lore: "A magnificent chimeric apex predator, the build of a great lion with a mane of dark fur shot through with bone-spurs, the horns of a bull, and the scarred hide of something that has won every fight it ever had. It radiates raw dominance; lesser beasts flee its scent. Eyes of molten gold, a roar that flattens grass for acres. The wild itself crowned a king, and this is he.",
    cards: [
      { id: "apexrend", name: "Apex Rend", type: "attack", cost: 2, dmg: 22, text: "Deal 22 damage." },
      { id: "primalroar", name: "Primal Roar", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
      { id: "thickhide", name: "Thick Hide", type: "skill", cost: 1, block: 14, text: "Gain 14 block." },
    ],
  },
  {
    name: "Fennqi", element: "beast", hp: 30, sprite: "🦊", rarity: "uncommon", tier: 1, evolvesTo: null,
    desc: "A clever desert fox with too many tricks and too much charm.",
    lore: "A dainty fennec fox with enormous expressive ears, sandy-gold fur, a fluffy tail, and bright cunning eyes full of mischief. It sits with an almost smug tilt of the head, clearly several steps ahead of you. Quick, light-footed, and impossibly endearing, it survives by wit and speed rather than strength, and it knows exactly how cute it is.",
    cards: [
      { id: "pounce", name: "Pounce", type: "attack", cost: 1, dmg: 7, draw: 1, text: "Deal 7 damage. Draw 1." },
      { id: "feint", name: "Feint", type: "skill", cost: 0, block: 6, draw: 1, text: "Gain 6 block. Draw 1." },
      { id: "cunning", name: "Cunning", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },

  // =====================================================================
  // LUMEN — light, order, healing. Support: cleanse + heal.
  // =====================================================================
  {
    name: "Glimmer", element: "lumen", hp: 28, sprite: "✨", rarity: "uncommon", tier: 1, evolvesTo: "Radiel",
    desc: "A mote of dawn that mends small hurts just by being near.",
    lore: "A tiny floating wisp of warm golden light, soft and round, with a gentle glowing face and two little comet-trail arms. It pulses softly like a slow heartbeat, and faint motes of light drift off it, settling on the wounded and easing their pain. Shy, kind, and luminous, it seeks out sadness to quietly brighten.",
    cards: [
      { id: "ray", name: "Sun Ray", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "ward", name: "Light Ward", type: "skill", cost: 1, block: 8, draw: 1, text: "Gain 8 block. Draw 1." },
      { id: "mend", name: "Mend", type: "skill", cost: 1, teamheal: 5, text: "Heal team 5." },
    ],
  },
  {
    name: "Radiel", element: "lumen", hp: 46, sprite: "🌟", rarity: "rare", tier: 2, evolvesTo: "Seraphage",
    desc: "A radiant guardian that punishes the cruel and shields the kind.",
    lore: "A humanoid spirit of light clad in robes of woven sunbeam, with a halo of golden rings rotating slowly behind its head and wings made of pure radiance. Its face is serene and beautiful, eyes closed in calm focus. A staff of light in one hand. It glows warm enough to banish shadow from a whole room. Gentle to the good, blindingly fierce to the wicked.",
    cards: [
      { id: "smite", name: "Smite", type: "attack", cost: 1, dmg: 12, text: "Deal 12 damage." },
      { id: "sanctuary", name: "Sanctuary", type: "skill", cost: 1, shield: 8, teamheal: 4, text: "Gain 8 Shield. Heal team 4." },
      { id: "halo", name: "Halo", type: "power", cost: 2, strength: 3, text: "Gain 3 Strength." },
    ],
  },
  {
    name: "Seraphage", element: "lumen", hp: 62, sprite: "😇", rarity: "epic", tier: 3, evolvesTo: null,
    desc: "Six wings, one judgment, and no appeal.",
    lore: "A six-winged celestial of overwhelming radiance, its form barely contained in a humanoid shape of living light, wings of layered golden feathers spread in a great fan, a ring of fire-bright halos stacked above a face too brilliant to fully see. It holds a sword of pure dawn. It does not rage; it simply judges, and its judgment is absolute. Awe and terror in equal, holy measure.",
    cards: [
      { id: "judgment", name: "Judgment", type: "attack", cost: 2, dmg: 23, text: "Deal 23 damage." },
      { id: "aurashield", name: "Aura Shield", type: "skill", cost: 1, shield: 15, draw: 1, text: "Gain 15 Shield. Draw 1." },
      { id: "ascend", name: "Ascend", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },
  {
    name: "Candela", element: "lumen", hp: 30, sprite: "🕯️", rarity: "common", tier: 1, evolvesTo: null,
    desc: "A steadfast little flame that refuses to let the dark win.",
    lore: "A small living candle-creature with a warm teardrop flame for a head, a soft wax body that never melts away, and two tiny earnest eyes in the glow. It stands guard against darkness with quiet courage, its little flame never wavering even in the strongest wind. Humble, brave, and comforting, the light you'd want beside you on the longest night.",
    cards: [
      { id: "candleglow", name: "Candle Glow", type: "skill", cost: 1, block: 9, draw: 1, text: "Gain 9 block. Draw 1." },
      { id: "flicker", name: "Flicker", type: "attack", cost: 1, dmg: 8, text: "Deal 8 damage." },
      { id: "warmth", name: "Warmth", type: "skill", cost: 1, teamheal: 4, text: "Heal team 4." },
    ],
  },

  // =====================================================================
  // AETHER — pure energy, anti-status. Status: Ward (negate). Anti-status.
  // =====================================================================
  {
    name: "Wispveil", element: "aether", hp: 30, sprite: "🌬️", rarity: "uncommon", tier: 1, evolvesTo: "Aethernox",
    desc: "A veil of shimmering energy that turns aside what would harm it.",
    lore: "A translucent, ghostly drifting form like a floating sheet of shimmering heat-haze and starlight, faintly iridescent, with a calm glowing core and trailing ribbons of soft energy. It has no fixed shape, rippling gently. It deflects harm by simply ceasing to be where the blow lands. Serene and otherworldly, a fragment of pure aether that barely belongs to the physical world.",
    cards: [
      { id: "wardpulse", name: "Ward Pulse", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "shimmer", name: "Shimmer Strike", type: "attack", cost: 1, dmg: 9, text: "Deal 9 damage." },
      { id: "negate", name: "Negate", type: "skill", cost: 1, draw: 2, text: "Draw 2 cards." },
    ],
  },
  {
    name: "Aethernox", element: "aether", hp: 54, sprite: "✶", rarity: "rare", tier: 2, evolvesTo: null,
    desc: "A being of woven starlight that unmakes curses with a touch.",
    lore: "An elegant entity of pure aether shaped like a robed figure made of constellations and flowing cosmic energy, its 'body' a window into a star-filled void, edged in shifting auroral light. Where a face would be floats a single calm rune of light. It moves without disturbing the air. Mystical and unknowable, it scatters hexes and afflictions like smoke before the dawn.",
    cards: [
      { id: "starlance", name: "Star Lance", type: "attack", cost: 1, dmg: 13, text: "Deal 13 damage." },
      { id: "voidward", name: "Void Ward", type: "skill", cost: 1, shield: 12, text: "Gain 12 Shield." },
      { id: "channel", name: "Channel", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Cosmara", element: "aether", hp: 88, sprite: "🌌", rarity: "godly", tier: 1, evolvesTo: null,
    desc: "A fragment of the cosmos itself, vast beyond comprehension.",
    lore: "A serene, immense entity that appears as a humanoid silhouette filled with an entire swirling galaxy, nebulae and star-clusters drifting within its boundless form, crowned by a slow-turning ring of orbiting lights. Its presence warps the space around it into faint ripples. Where eyes would be, two distant supernovae burn. Calm as the void and old as light, it regards small things with cosmic, gentle indifference.",
    cards: [
      { id: "supernova", name: "Supernova", type: "attack", cost: 2, dmg: 26, text: "Deal 26 damage." },
      { id: "eventhorizon", name: "Event Horizon", type: "skill", cost: 2, shield: 20, draw: 1, text: "Gain 20 Shield. Draw 1." },
      { id: "stellardrift", name: "Stellar Drift", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },

  // =====================================================================
  // UMBRA — shadow, dark. Status: Vulnerable (amp). Debuff.
  // =====================================================================
  {
    name: "Shadepup", element: "umbra", hp: 30, sprite: "🐺", rarity: "common", tier: 1, evolvesTo: "Nightmaw",
    desc: "A pup of pure shadow with a few too many teeth in its grin.",
    lore: "A puppy made of living shadow, its body soft semi-transparent darkness like spilled ink given a wolf-cub shape, with two big glowing violet eyes and a wide grin showing rows of little pale fangs. Wisps of shadow trail off it like smoke. It melts into dark corners and reappears underfoot. Mischievous and clingy, a shadow that decided it loved you and will not be left behind.",
    cards: [
      { id: "nip", name: "Shadow Nip", type: "attack", cost: 0, dmg: 5, text: "Deal 5 damage." },
      { id: "lurk", name: "Lurk", type: "skill", cost: 1, block: 6, draw: 1, text: "Gain 6 block. Draw 1." },
      { id: "maul2", name: "Shadow Maul", type: "attack", cost: 1, dmg: 9, vulnerable: 1, text: "Deal 9 damage. Apply 1 Vulnerable." },
    ],
  },
  {
    name: "Nightmaw", element: "umbra", hp: 52, sprite: "🐕‍🦺", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "It hunts in the dark and, increasingly, it is the dark.",
    lore: "A large, lean hound-beast woven from pure night, its form rippling shadow with constellation-like points of cold light scattered across it, eyes burning violet, a maw of darkness lined with shadow-fangs. Tendrils of gloom drag behind it like a cloak. It moves in absolute silence and can pour itself through the thinnest crack of darkness. A predator made of the fear of the dark itself.",
    cards: [
      { id: "ambush", name: "Ambush", type: "attack", cost: 1, dmg: 14, text: "Deal 14 damage." },
      { id: "veil", name: "Veil of Night", type: "skill", cost: 1, block: 9, vulnerable: 2, text: "Gain 9 block. Apply 2 Vulnerable." },
      { id: "dread", name: "Dread", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },
  {
    name: "Wispling", element: "umbra", hp: 22, sprite: "👻", rarity: "rare", tier: 1, evolvesTo: "Reaperion",
    desc: "A flickering soul-light that drains the bold and warms itself.",
    lore: "A small, sad ghost-flame in deep violet-blue, a flickering wisp with two mournful hollow eyes and faint trailing wisps like tattered cloth. It bobs gently, almost shyly, drawn to the warmth of the living, which it cannot help but slowly drain. Lonely and gentle rather than malicious, a little lost soul looking for company it accidentally diminishes.",
    cards: [
      { id: "drainkiss", name: "Drain Kiss", type: "attack", cost: 1, dmg: 6, text: "Deal 6 damage." },
      { id: "phase", name: "Phase Out", type: "skill", cost: 0, block: 5, text: "Gain 5 block." },
      { id: "hex", name: "Hex", type: "skill", cost: 1, vulnerable: 2, text: "Apply 2 Vulnerable." },
    ],
  },
  {
    name: "Reaperion", element: "umbra", hp: 50, sprite: "💀", rarity: "epic", tier: 2, evolvesTo: null,
    desc: "The last thing the doomed ever see, and it is patient.",
    lore: "A tall, cloaked figure of swirling shadow, its hood a void with two cold pinpricks of pale light for eyes, skeletal hands of dark bone emerging from ragged sleeves to grip a scythe whose blade is a sliver of pure absence. Wisps of soul-light drift toward it and vanish. It moves without footfall, unhurried, certain. Not cruel, simply inevitable, the quiet end that comes for all.",
    cards: [
      { id: "scythe", name: "Soul Scythe", type: "attack", cost: 1, dmg: 12, vulnerable: 1, text: "Deal 12 damage. Apply 1 Vulnerable." },
      { id: "wither", name: "Wither", type: "skill", cost: 1, vulnerable: 3, block: 8, text: "Gain 8 block. Apply 3 Vulnerable." },
      { id: "harvest", name: "Harvest", type: "attack", cost: 2, dmg: 20, text: "Deal 20 damage." },
    ],
  },

  // =====================================================================
  // VOID — entropy, oblivion. Status: Decay (HP+block loss). Entropy.
  // =====================================================================
  {
    name: "Nullbit", element: "void", hp: 28, sprite: "⬤", rarity: "uncommon", tier: 1, evolvesTo: "Oblivox",
    desc: "A hole in the world the size of a marble, and it's hungry.",
    lore: "A small floating sphere of perfect blackness rimmed by a faint violet event-horizon glow, so dark it seems to be a hole punched in reality. It silently swallows tiny bits of nearby light and matter, never quite full. Two faint white eyes appear and vanish on its surface. Quiet and unsettling, a curious little void that erases what it touches without meaning to.",
    cards: [
      { id: "erase", name: "Erase", type: "attack", cost: 1, dmg: 7, decay: 2, text: "Deal 7 damage. Apply 2 Decay." },
      { id: "nullfield", name: "Null Field", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
      { id: "unmake", name: "Unmake", type: "skill", cost: 1, decay: 3, text: "Apply 3 Decay." },
    ],
  },
  {
    name: "Oblivox", element: "void", hp: 54, sprite: "🕳️", rarity: "rare", tier: 2, evolvesTo: null,
    desc: "A growing absence that devours light, matter, and hope alike.",
    lore: "A roiling humanoid void, a tear in space shaped vaguely like a robed giant, its interior a swirling abyss flecked with the dying sparks of swallowed stars, edges fraying into violet static. It drags loose objects slowly toward itself. Where a face should be is a deeper darkness with a single ring of pale light. Silent, vast, and entropic, the slow heat-death of things given a shape.",
    cards: [
      { id: "devour", name: "Devour", type: "attack", cost: 2, dmg: 16, decay: 3, text: "Deal 16 damage. Apply 3 Decay." },
      { id: "collapse", name: "Collapse", type: "skill", cost: 1, block: 14, text: "Gain 14 block." },
      { id: "entropy", name: "Entropy", type: "skill", cost: 2, decay: 5, text: "Apply 5 Decay." },
    ],
  },
  {
    name: "Voidwyrm", element: "void", hp: 92, sprite: "🐉", rarity: "godly", tier: 1, evolvesTo: null,
    desc: "A dragon of pure absence that swallows light and sound.",
    lore: "An enormous serpentine dragon made of cohesive void, its long sinuous body a river of starless black edged in violet, scales that are absences rather than objects, with great ragged wings that seem to delete the sky behind them. Its eyes are twin singularities, and its maw opens onto an endless abyss. Where it flies, silence falls and stars wink out. The end of all things, coiled and patient.",
    cards: [
      { id: "annihilate", name: "Annihilate", type: "attack", cost: 2, dmg: 24, decay: 3, text: "Deal 24 damage. Apply 3 Decay." },
      { id: "eclipse", name: "Eclipse", type: "skill", cost: 2, block: 18, vulnerable: 3, text: "Gain 18 block. Apply 3 Vulnerable." },
      { id: "consumeall", name: "Consume", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },

  // =====================================================================
  // BLOOD — vitality, drain. Status: Leech (lifesteal). Drain.
  // =====================================================================
  {
    name: "Leechling", element: "blood", hp: 30, sprite: "🩸", rarity: "uncommon", tier: 1, evolvesTo: "Sanguine",
    desc: "A squishy little crimson blob that heals itself by biting.",
    lore: "A small, jelly-like crimson creature shaped like a fat teardrop with a round sucker-mouth ringed in tiny teeth and two simple dot eyes. It pulses redder when it feeds, jiggling contentedly. Translucent enough to see the glow of vitality sloshing inside. Weirdly cute despite the teeth, an affectionate little parasite that just wants a hug (and a small snack).",
    cards: [
      { id: "bite", name: "Leech Bite", type: "attack", cost: 1, dmg: 7, leech: true, text: "Deal 7 damage. Heal for half." },
      { id: "clot", name: "Clot", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
      { id: "feed", name: "Feed", type: "attack", cost: 1, dmg: 9, leech: true, text: "Deal 9 damage. Heal for half." },
    ],
  },
  {
    name: "Sanguine", element: "blood", hp: 52, sprite: "🦇", rarity: "rare", tier: 2, evolvesTo: "Hemarch",
    desc: "A vampiric hunter that grows stronger on the vitality it steals.",
    lore: "A lithe, bat-winged humanoid with pale crimson-tinged skin, sleek dark hair, and elegant predatory features with two slender fangs and eyes like rubies. Membrane wings furl behind it like a cloak. It moves with unhurried aristocratic grace. Charming and lethal, it drains the life of its prey with almost courteous precision, mending its own wounds with every stolen drop.",
    cards: [
      { id: "drainfang", name: "Drain Fang", type: "attack", cost: 1, dmg: 11, leech: true, text: "Deal 11 damage. Heal for half." },
      { id: "batform", name: "Bat Form", type: "skill", cost: 1, block: 11, draw: 1, text: "Gain 11 block. Draw 1." },
      { id: "bloodlust", name: "Bloodlust", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },
  {
    name: "Hemarch", element: "blood", hp: 74, sprite: "🧛", rarity: "epic", tier: 3, evolvesTo: null,
    desc: "A blood-sovereign whose every wound only feeds its power.",
    lore: "A regal, terrifying vampire-lord robed in crimson and black, tall and imperious, with a high collar framing a gaunt pale face, burning red eyes, and a crown of crystallized blood. Ribbons of living blood swirl around it obedient as servants, forming weapons and shields at its whim. It bleeds and the blood returns to it. Ancient nobility and insatiable hunger, the master of the crimson court.",
    cards: [
      { id: "crimsontide", name: "Crimson Tide", type: "attack", cost: 2, dmg: 18, leech: true, text: "Deal 18 damage. Heal for half." },
      { id: "bloodward", name: "Blood Ward", type: "skill", cost: 1, block: 14, text: "Gain 14 block." },
      { id: "sovereign", name: "Sovereign's Thirst", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Tickfright", element: "blood", elements: ["blood", "toxin"], hp: 38, sprite: "🕷️", rarity: "uncommon", tier: 1, evolvesTo: null,
    desc: "A skittering bloodsucker that's bigger than any tick has a right to be.",
    lore: "A dog-sized tick-spider hybrid with a bloated translucent abdomen that glows redder as it feeds, eight barbed legs, and a cluster of glittering black eyes above wicked piercing mouthparts. It scuttles with horrible speed and clings where it bites. Genuinely creepy yet weirdly characterful, the kind of monster that's gross enough to loop back around to lovable.",
    cards: [
      { id: "latch", name: "Latch On", type: "attack", cost: 1, dmg: 8, leech: true, text: "Deal 8 damage. Heal for half." },
      { id: "scuttle", name: "Scuttle", type: "skill", cost: 0, block: 6, draw: 1, text: "Gain 6 block. Draw 1." },
      { id: "engorge", name: "Engorge", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },

  // =====================================================================
  // EXPANSION WAVE 2 — rounding out every element to a full bench.
  // =====================================================================

  // ----- PYRE additions -----
  {
    name: "Wicklash", element: "pyre", elements: ["pyre", "umbra"], hp: 42, sprite: "🐈‍⬛", rarity: "rare", tier: 1, evolvesTo: null,
    desc: "A sleek cat with a burning wick for a tail, always two flicks from chaos.",
    lore: "An elegant black cat with sleek charcoal fur, golden judgmental eyes, and a long tail that ends in a candle-wick burning with a steady teardrop flame. Wax-like markings drip down its haunches. It knocks things over deliberately and sets them alight accidentally. Imperious, graceful, and quietly delighted by small arsons. Walks along shelf edges leaving faint smoke calligraphy in the air.",
    cards: [
      { id: "wickwhip", name: "Wick Whip", type: "attack", cost: 1, dmg: 9, burn: 2, text: "Deal 9 damage. Apply 2 Burn." },
      { id: "ninelives", name: "Nine Lives", type: "skill", cost: 1, block: 8, regen: 2, text: "Gain 8 block and 2 Regen." },
      { id: "candleflare", name: "Candle Flare", type: "attack", cost: 2, dmg: 15, burn: 3, text: "Deal 15 damage. Apply 3 Burn." },
    ],
  },

  // ----- FROST additions: a 2-stage line -----
  {
    name: "Pengloo", element: "frost", hp: 34, sprite: "🐧", rarity: "common", tier: 1, evolvesTo: "Emperorime",
    desc: "A round penguin that carries a snowball everywhere like a prized pet.",
    lore: "An extremely round little penguin with slate-blue and white plumage, a tiny orange beak, and stubby flippers clutching a perfectly spherical snowball it treats as a beloved pet. It waddles with great self-importance and belly-slides everywhere it can. Frost patterns swirl on its belly like a knit sweater. Earnest, proud, and devastated if the snowball ever melts (it remakes it immediately).",
    cards: [
      { id: "snowtoss", name: "Snow Toss", type: "attack", cost: 1, dmg: 7, chill: 2, text: "Deal 7 damage. Apply 2 Chill." },
      { id: "bellyslide", name: "Belly Slide", type: "skill", cost: 0, block: 5, draw: 1, text: "Gain 5 block. Draw 1." },
      { id: "packice", name: "Pack Ice", type: "skill", cost: 1, shield: 7, text: "Gain 7 Shield." },
    ],
  },
  {
    name: "Emperorime", element: "frost", hp: 58, sprite: "👑", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A penguin-emperor in a mantle of living rime, ruling the white silence.",
    lore: "A tall, stately emperor penguin draped in a flowing mantle of frost that trails behind like a royal cloak, wearing a jagged crown of clear ice. Its chest plumage bears swirling silver rime patterns like ceremonial armor, and it holds a scepter-icicle under one wing. Pale aurora light follows it. Dignified, solemn, and protective, it rules the frozen wastes with a quiet, absolute authority.",
    cards: [
      { id: "rimedecree", name: "Rime Decree", type: "attack", cost: 1, dmg: 11, chill: 3, text: "Deal 11 damage. Apply 3 Chill." },
      { id: "royalmantle", name: "Royal Mantle", type: "skill", cost: 1, shield: 10, block: 5, text: "Gain 10 Shield and 5 block." },
      { id: "silentcourt", name: "Silent Court", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },

  // ----- HYDRO additions -----
  {
    name: "Drizzlit", element: "hydro", hp: 26, sprite: "🌧️", rarity: "common", tier: 1, evolvesTo: null,
    desc: "A pocket-sized raincloud with feelings. Mostly damp ones.",
    lore: "A tiny personal raincloud with a soft grey fluffy body, two big watery eyes, and little nub arms. It drizzles constantly beneath itself, intensity matching its mood: a sniffly mist when shy, a downpour when upset. A tiny rainbow appears over it when it's happy. It follows people it likes, accidentally soaking them. Sweet, soggy, and emotionally transparent in the most literal way.",
    cards: [
      { id: "drizzle", name: "Drizzle", type: "attack", cost: 0, dmg: 4, soak: 2, text: "Deal 4 damage. Apply 2 Soak." },
      { id: "mistveil", name: "Mist Veil", type: "skill", cost: 1, block: 8, text: "Gain 8 block." },
      { id: "downpour", name: "Downpour", type: "attack", cost: 1, dmg: 8, soak: 2, text: "Deal 8 damage. Apply 2 Soak." },
    ],
  },
  {
    name: "Mirrorkoi", element: "hydro", elements: ["hydro", "crystal"], hp: 48, sprite: "🎏", rarity: "epic", tier: 1, evolvesTo: null,
    desc: "A koi of liquid silver said to grant one reflection's worth of truth.",
    lore: "A long, flowing koi whose scales are perfect liquid mirrors, reflecting the world in rippling silver as it swims through air as easily as water. Its trailing fins move like silk ribbons in slow motion, and its eyes are calm pools of dark water. Legends say staring into its flank shows you not your face, but your true self. Serene, ancient, and softly luminous with moonlight it remembers.",
    cards: [
      { id: "mirrorscale", name: "Mirror Scale", type: "skill", cost: 1, shield: 9, draw: 1, text: "Gain 9 Shield. Draw 1." },
      { id: "silverfin", name: "Silver Fin", type: "attack", cost: 1, dmg: 10, soak: 2, text: "Deal 10 damage. Apply 2 Soak." },
      { id: "truthpool", name: "Truth Pool", type: "attack", cost: 2, dmg: 17, text: "Deal 17 damage." },
    ],
  },

  // ----- CHARGE additions: a 2-stage line -----
  {
    name: "Ampup", element: "charge", hp: 32, sprite: "🐹", rarity: "common", tier: 1, evolvesTo: "Dynamole",
    desc: "A staticky hamster that stores lightning in its cheeks for later.",
    lore: "A chubby golden hamster with cheek pouches that glow and crackle, visibly stuffed full of stored electricity instead of seeds. Its fur stands in permanent static puff, and tiny arcs jump between its round ears. It stockpiles charge the way hamsters hoard food, and discharges it all at once in a panic. Frantic, busy, and adorably overprepared for emergencies that never come.",
    cards: [
      { id: "cheekzap", name: "Cheek Zap", type: "attack", cost: 1, dmg: 8, shock: 1, text: "Deal 8 damage. Apply 1 Shock." },
      { id: "hoard", name: "Hoard Charge", type: "skill", cost: 1, energy: 1, block: 4, text: "Gain 4 block and 1 energy." },
      { id: "discharge", name: "Discharge", type: "attack", cost: 2, dmg: 15, text: "Deal 15 damage." },
    ],
  },
  {
    name: "Dynamole", element: "charge", elements: ["charge", "stone"], hp: 54, sprite: "⚡", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A burrowing dynamo that turns the whole earth into its power grid.",
    lore: "A burly mole with copper-sheened fur and huge digging claws of conductive metal, goggles of fused glass over tiny fierce eyes, and a back studded with humming coil-ridges that arc electricity between them. Glowing cable-like veins run down its limbs. It tunnels at shocking speed, electrifying the soil behind it. Industrious and gruff, the underground engineer of an electric world.",
    cards: [
      { id: "groundsurge", name: "Ground Surge", type: "attack", cost: 1, dmg: 11, shock: 1, text: "Deal 11 damage. Apply 1 Shock." },
      { id: "coilguard", name: "Coil Guard", type: "skill", cost: 1, block: 11, energy: 1, text: "Gain 11 block and 1 energy." },
      { id: "livewire", name: "Live Wire", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },

  // ----- AERO addition -----
  {
    name: "Banshreek", element: "aero", elements: ["aero", "umbra"], hp: 44, sprite: "🦉", rarity: "rare", tier: 1, evolvesTo: null,
    desc: "An owl whose silent flight ends in a scream you feel in your bones.",
    lore: "A ghost-pale barn owl with a heart-shaped face, unsettling pitch-black eyes, and wing feathers that fade to translucent wisps at the edges. It flies in perfect silence, then unleashes a banshee shriek that visibly ripples the air in concentric rings. Sound itself seems to bend around it. Eerie and beautiful, the hush before the scream, a haunting of the night winds.",
    cards: [
      { id: "hushwing", name: "Hush Wing", type: "skill", cost: 0, block: 6, draw: 1, text: "Gain 6 block. Draw 1." },
      { id: "sonicshriek", name: "Sonic Shriek", type: "attack", cost: 1, dmg: 9, weak: 2, text: "Deal 9 damage. Apply 2 Weak." },
      { id: "deathdive", name: "Death Dive", type: "attack", cost: 2, dmg: 18, text: "Deal 18 damage." },
    ],
  },

  // ----- STONE addition -----
  {
    name: "Geomite", element: "stone", hp: 40, sprite: "💠", rarity: "uncommon", tier: 1, evolvesTo: null,
    desc: "A grumpy geode that hides a heart of amethyst behind solid rock.",
    lore: "A rough grey boulder-creature, plain and unremarkable until it cracks open its front like a coat to flash a dazzling interior of purple amethyst crystal, which it does only when fighting or showing off. Stubby limbs, a flat unimpressed expression. Its outside says 'ordinary rock'; its inside says 'secret treasure'. Defensive in every sense, it guards its sparkle from those who haven't earned a look.",
    cards: [
      { id: "geodeflash", name: "Geode Flash", type: "attack", cost: 1, dmg: 8, vulnerable: 1, text: "Deal 8 damage. Apply 1 Vulnerable." },
      { id: "stoneshut", name: "Shut Tight", type: "skill", cost: 1, block: 13, text: "Gain 13 block." },
      { id: "innerlight", name: "Inner Light", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },

  // ----- METAL additions: a 2-stage line -----
  {
    name: "Tinwhisk", element: "metal", hp: 32, sprite: "🐁", rarity: "common", tier: 1, evolvesTo: "Quicksilverr",
    desc: "A tin mouse that squeaks in morse code and oils its own joints.",
    lore: "A mouse-sized automaton of polished tin with riveted seams, round button eyes, wire whiskers, and a wind-up tail-spring. It carries a tiny oil can and fastidiously maintains its own squeaky joints. It communicates in patterned squeaks like morse code. Tidy, punctual, and fussy, a small machine with the soul of a meticulous librarian.",
    cards: [
      { id: "whiskjab", name: "Whisk Jab", type: "attack", cost: 0, dmg: 5, text: "Deal 5 damage." },
      { id: "oilup", name: "Oil Up", type: "skill", cost: 1, block: 8, draw: 1, text: "Gain 8 block. Draw 1." },
      { id: "springsnap", name: "Spring Snap", type: "attack", cost: 1, dmg: 9, text: "Deal 9 damage." },
    ],
  },
  {
    name: "Quicksilverr", element: "metal", hp: 50, sprite: "🪞", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A shapeshifting rush of living mercury, never the same form twice.",
    lore: "A sleek creature of flowing liquid mercury, default form a long-bodied weasel that constantly half-melts and reforms mid-motion: paws becoming blades, tail becoming a whip, face rippling between expressions. Perfect chrome surface reflects everything in warped funhouse curves. It moves like spilled metal poured at high speed. Playful and uncatchable, a silver laugh given a body that refuses to keep one.",
    cards: [
      { id: "fluxstrike", name: "Flux Strike", type: "attack", cost: 1, dmg: 7, hits: 2, text: "Deal 7 damage twice." },
      { id: "meltaway", name: "Melt Away", type: "skill", cost: 1, block: 10, draw: 1, text: "Gain 10 block. Draw 1." },
      { id: "chromeedge", name: "Chrome Edge", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },

  // ----- CRYSTAL additions: a 2-stage line + standalone -----
  {
    name: "Shardle", element: "crystal", hp: 30, sprite: "🔹", rarity: "common", tier: 1, evolvesTo: "Geodon",
    desc: "A hatchling of living crystal still growing into its facets.",
    lore: "A tiny turtle-like creature whose shell is a cluster of stubby, cloudy crystal nubs that haven't yet grown sharp or clear, in soft milky blue. Its head and legs are smooth pale stone, with big hopeful gem-chip eyes. It suns itself to grow its facets, and chips of its shell that break off slowly regrow. Patient and a little self-conscious about its unfinished sparkle. A gem in progress, literally.",
    cards: [
      { id: "shardflick", name: "Shard Flick", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "facetform", name: "Facet Form", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "glint", name: "Glint", type: "skill", cost: 0, draw: 2, text: "Draw 2 cards." },
    ],
  },
  {
    name: "Geodon", element: "crystal", hp: 60, sprite: "🦕", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A crystal-backed saurian whose spines ring like bells in the wind.",
    lore: "A stocky, dinosaur-like quadruped with a hide of slate-grey stone and a magnificent double row of tall amethyst and citrine crystal spines down its back, each one chiming faintly when the wind moves through them. Heavy tail ending in a crystal mace-cluster. Gentle rose-quartz eyes. It hums harmonics when content. A walking geology lesson with the temperament of a friendly cathedral.",
    cards: [
      { id: "spinechime", name: "Spine Chime", type: "attack", cost: 1, dmg: 10, text: "Deal 10 damage." },
      { id: "crystalback", name: "Crystal Back", type: "skill", cost: 1, shield: 8, block: 6, text: "Gain 8 Shield and 6 block." },
      { id: "resonate", name: "Resonate", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Opalisk", element: "crystal", hp: 46, sprite: "🐍", rarity: "epic", tier: 1, evolvesTo: null,
    desc: "A serpent of black opal whose gaze freezes the unwary mid-step.",
    lore: "A long, hypnotic serpent whose scales are black opal, dark depths flashing with trapped fire of every color as it moves. Its eyes are spiraling opalescent disks that catch and hold the gaze. A hood like a cobra's spreads to reveal a mesmerizing mandala of shifting color. It sways with slow, deliberate grace. Beautiful and dangerous, the living embodiment of 'look, but never look too long'.",
    cards: [
      { id: "gazelock", name: "Gaze Lock", type: "skill", cost: 1, weak: 3, vulnerable: 1, text: "Apply 3 Weak and 1 Vulnerable." },
      { id: "opalstrike", name: "Opal Strike", type: "attack", cost: 1, dmg: 11, text: "Deal 11 damage." },
      { id: "fireflash", name: "Fire Flash", type: "attack", cost: 2, dmg: 16, draw: 1, text: "Deal 16 damage. Draw 1." },
    ],
  },

  // ----- TOXIN additions: a 2-stage line -----
  {
    name: "Smoglet", element: "toxin", hp: 30, sprite: "💨", rarity: "common", tier: 1, evolvesTo: "Mireviper",
    desc: "A puff of bog-gas with a face and a deeply apologetic smell.",
    lore: "A floating blob of yellow-green swamp gas with a sheepish little face, two stubby wisp arms, and an aura of visible stink-lines it seems embarrassed about. It bobs apologetically, leaving a faint haze. Flowers wilt as it passes and it always looks sorry about it. Sweet-natured and self-conscious, the nicest toxic cloud you'll ever meet.",
    cards: [
      { id: "stinkpuff", name: "Stink Puff", type: "attack", cost: 0, dmg: 4, poison: 1, text: "Deal 4 damage. Apply 1 Poison." },
      { id: "hazyform", name: "Hazy Form", type: "skill", cost: 1, block: 8, text: "Gain 8 block." },
      { id: "noxiousburp", name: "Noxious Burp", type: "skill", cost: 1, poison: 3, text: "Apply 3 Poison." },
    ],
  },
  {
    name: "Mireviper", element: "toxin", elements: ["toxin", "hydro"], hp: 56, sprite: "🐊", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A swamp predator that is half serpent, half the swamp itself.",
    lore: "A heavy, crocodilian serpent dripping with bog water, its scales mottled olive and black, half-sunken plants growing from the mud caked along its spine. Luminous green venom beads along a jaw of snaggled fangs, and its yellow eyes sit above the waterline of an invisible swamp it carries with it. Ambusher's patience, a low rumbling hiss like gas escaping mud. The bog's own hunger, coiled.",
    cards: [
      { id: "mirefang", name: "Mire Fang", type: "attack", cost: 1, dmg: 10, poison: 3, text: "Deal 10 damage. Apply 3 Poison." },
      { id: "bogcoil", name: "Bog Coil", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "swampsurge", name: "Swamp Surge", type: "attack", cost: 2, dmg: 16, poison: 2, text: "Deal 16 damage. Apply 2 Poison." },
    ],
  },

  // ----- FLORA additions: a 2-stage line -----
  {
    name: "Thistlit", element: "flora", hp: 30, sprite: "🌼", rarity: "common", tier: 1, evolvesTo: "Bramblequeen",
    desc: "A tumbling thistle-ball that hugs first and apologizes for the prickles later.",
    lore: "A round tumbleweed-creature of soft green thistle-down with little purple flower-buds dotting it, two leafy arms, and a sunny gap-toothed smile. It rolls everywhere instead of walking, gathering leaves and small friends in its fluff. Its hugs are enthusiastic and slightly prickly. Boundlessly affectionate, a rolling bundle of love with a minor occupational hazard.",
    cards: [
      { id: "tumblebash", name: "Tumble Bash", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "fluffguard", name: "Fluff Guard", type: "skill", cost: 1, block: 9, regen: 2, text: "Gain 9 block and 2 Regen." },
      { id: "seedshare", name: "Seed Share", type: "skill", cost: 1, teamheal: 4, text: "Heal team 4." },
    ],
  },
  {
    name: "Bramblequeen", element: "flora", hp: 62, sprite: "🌹", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A regal tangle of roses and thorns that rules her garden absolutely.",
    lore: "A tall, elegant figure woven entirely of climbing rose-brambles, her gown a cascade of dark green thorned vines studded with deep crimson roses, her crown a wreath of blossoms, her eyes two gleaming dewdrops. Where she walks roses erupt from the soil; where she gestures, thorn-walls rise. Gracious and imperious in equal measure, every petal beautiful and every inch of her defended.",
    cards: [
      { id: "thornlash", name: "Thorn Lash", type: "attack", cost: 1, dmg: 11, text: "Deal 11 damage." },
      { id: "rosewall", name: "Rose Wall", type: "skill", cost: 1, shield: 9, regen: 3, text: "Gain 9 Shield and 3 Regen." },
      { id: "gardendecree", name: "Garden Decree", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },

  // ----- BEAST additions: a 2-stage line + standalone -----
  {
    name: "Snortle", element: "beast", hp: 36, sprite: "🐗", rarity: "common", tier: 1, evolvesTo: "Tuskarge",
    desc: "A bristly piglet that charges first and thinks, eventually, maybe.",
    lore: "A small wild boar piglet with bristly russet fur, oversized floppy ears, stubby tusks just starting to grow, and a perpetually muddy snout. It paws the ground dramatically before launching tiny full-speed charges at things triple its size. Snorts constantly, fears nothing, learns nothing. Pure unfiltered courage in the most ridiculous possible package.",
    cards: [
      { id: "piglunge", name: "Pig Lunge", type: "attack", cost: 1, dmg: 9, text: "Deal 9 damage." },
      { id: "muddyhide", name: "Muddy Hide", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
      { id: "snort", name: "Snort", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Tuskarge", element: "beast", hp: 64, sprite: "🐗", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A battering ram of muscle and tusks that has never finished decelerating.",
    lore: "A monstrous boar the size of a wagon, slabs of muscle under a hide of bristled iron-grey fur, twin sweeping tusks like polished scythes scarred from impacts, and small furious eyes burning with forward momentum. Steam blasts from its snout. The ground shakes when it builds to a charge. It has run through walls and barely noticed. An avalanche that chose to be a pig.",
    cards: [
      { id: "ramcharge", name: "Ram Charge", type: "attack", cost: 2, dmg: 20, text: "Deal 20 damage." },
      { id: "tuskparry", name: "Tusk Parry", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "stampede", name: "Stampede", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
    ],
  },
  {
    name: "Howlphony", element: "beast", hp: 48, sprite: "🐺", rarity: "epic", tier: 1, evolvesTo: null,
    desc: "A wolf whose howl carries every voice of every pack that came before.",
    lore: "A spectral-tinged grey wolf with a thick storm-colored ruff, eyes of warm amber, and a strange gift: when it howls, dozens of overlapping ghost-howls answer from within its own voice, the echo of every ancestor in its line. Faint translucent wolf-shapes flicker around it mid-song. Dignified and deeply pack-loyal, a living chorus of everything its bloodline ever was.",
    cards: [
      { id: "chorushowl", name: "Chorus Howl", type: "power", cost: 1, strength: 3, text: "Gain 3 Strength." },
      { id: "packstrike", name: "Pack Strike", type: "attack", cost: 1, dmg: 6, hits: 2, text: "Deal 6 damage twice." },
      { id: "ancestorguard", name: "Ancestor Guard", type: "skill", cost: 1, shield: 8, text: "Gain 8 Shield." },
    ],
  },

  // ----- LUMEN additions: a 2-stage line -----
  {
    name: "Lanternaut", element: "lumen", hp: 34, sprite: "🏮", rarity: "common", tier: 1, evolvesTo: "Beaconwright",
    desc: "A little keeper of lost lights, collecting strays in its paper belly.",
    lore: "A small round creature shaped like a friendly paper lantern with stubby legs and mitten hands, its translucent belly glowing warm amber from the dozens of tiny lost lights it has rescued and shelters inside. A small flame-tuft flickers atop its head like hair. It toddles through dark places gathering stray glimmers. Gentle, dutiful, softly luminous, a night-light with a calling.",
    cards: [
      { id: "lightlend", name: "Lend Light", type: "skill", cost: 1, teamheal: 4, draw: 1, text: "Heal team 4. Draw 1." },
      { id: "glowbump", name: "Glow Bump", type: "attack", cost: 1, dmg: 8, text: "Deal 8 damage." },
      { id: "paperward", name: "Paper Ward", type: "skill", cost: 1, block: 9, text: "Gain 9 block." },
    ],
  },
  {
    name: "Beaconwright", element: "lumen", hp: 58, sprite: "🗼", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A walking lighthouse that has never let a single soul stay lost.",
    lore: "A tall, gentle giant built like a living lighthouse: a body of pale weathered stone, a glass-paned chest housing a great rotating beacon-flame, and a head crowned by a smaller lamp that tilts kindly. Sea-bird friends roost on its shoulders. Its sweeping beam cuts any darkness and always finds the lost. Patient, steadfast, endlessly watchful, the lighthouse that decided to come find you itself.",
    cards: [
      { id: "beaconsweep", name: "Beacon Sweep", type: "attack", cost: 1, dmg: 11, vulnerable: 1, text: "Deal 11 damage. Apply 1 Vulnerable." },
      { id: "guidinglight", name: "Guiding Light", type: "skill", cost: 1, shield: 8, teamheal: 4, text: "Gain 8 Shield. Heal team 4." },
      { id: "keepersvow", name: "Keeper's Vow", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },

  // ----- AETHER additions: a 2-stage line + standalone -----
  {
    name: "Pipdream", element: "aether", hp: 28, sprite: "💭", rarity: "common", tier: 1, evolvesTo: "Reverielle",
    desc: "A drifting daydream that escaped someone's nap and never went back.",
    lore: "A small cloudlike wisp in soft pastel iridescence, shaped like a sleepy comma with a dozing face, trailing a ribbon of dream-stuff: tiny floating images of sheep, stars, and half-formed thoughts that fizzle in and out. It drifts at the pace of an afternoon nap. Drowsy, harmless, and contagiously calming; people near it yawn and feel briefly, inexplicably hopeful.",
    cards: [
      { id: "doze", name: "Doze", type: "skill", cost: 0, block: 5, draw: 1, text: "Gain 5 block. Draw 1." },
      { id: "dreambump", name: "Dream Bump", type: "attack", cost: 1, dmg: 7, weak: 1, text: "Deal 7 damage. Apply 1 Weak." },
      { id: "lullaby", name: "Lullaby", type: "skill", cost: 1, weak: 3, text: "Apply 3 Weak." },
    ],
  },
  {
    name: "Reverielle", element: "aether", hp: 56, sprite: "🌠", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A sovereign of the space between sleeping and waking.",
    lore: "An elegant, drifting figure woven from twilight and half-remembered dreams, a flowing gown of deep indigo dusted with drifting constellations that rearrange themselves, long hair dissolving into auroral mist, and serene closed eyes that see only dreams. Sleeping imagery orbits her: doors, moons, staircases to nowhere. She never fully touches the ground. The threshold of sleep, given grace and quiet dominion.",
    cards: [
      { id: "dreamtide", name: "Dream Tide", type: "attack", cost: 1, dmg: 10, weak: 2, text: "Deal 10 damage. Apply 2 Weak." },
      { id: "thresholdveil", name: "Threshold Veil", type: "skill", cost: 1, shield: 11, draw: 1, text: "Gain 11 Shield. Draw 1." },
      { id: "deepreverie", name: "Deep Reverie", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Riftrick", element: "aether", hp: 44, sprite: "🌀", rarity: "rare", tier: 1, evolvesTo: null,
    desc: "A trickster that steps through tears in space like doorways.",
    lore: "A wiry, fox-faced imp of shimmering translucent energy, outlined in bending light like a heat mirage, with a too-wide grin and bright spiraling eyes. It snaps its fingers and small tears in space open like zippers, which it dives through to reappear behind you mid-sentence. Reality hiccups politely around it. Incorrigible, quick-witted, and never quite where you last looked.",
    cards: [
      { id: "blinkjab", name: "Blink Jab", type: "attack", cost: 0, dmg: 5, draw: 1, text: "Deal 5 damage. Draw 1." },
      { id: "riftstep", name: "Rift Step", type: "skill", cost: 1, block: 9, energy: 1, text: "Gain 9 block and 1 energy." },
      { id: "spacefold", name: "Space Fold", type: "attack", cost: 1, dmg: 8, hits: 2, text: "Deal 8 damage twice." },
    ],
  },

  // ----- UMBRA additions: a 2-stage line + standalone -----
  {
    name: "Inkpaw", element: "umbra", elements: ["umbra", "hydro"], hp: 32, sprite: "🐾", rarity: "common", tier: 1, evolvesTo: "Calligrim",
    desc: "A kitten of spilled ink that leaves accidental masterpieces behind it.",
    lore: "A glossy black kitten that is literally made of wet ink, leaving perfect little paw-print trails and the occasional accidental splatter that somehow always looks like art. Its surface ripples and drips without ever shrinking, eyes two bright white crescents in the dark. When startled it splashes into a puddle and reforms elsewhere. Playful, messy, and unintentionally a genius.",
    cards: [
      { id: "inksplat", name: "Ink Splat", type: "attack", cost: 1, dmg: 7, weak: 1, text: "Deal 7 damage. Apply 1 Weak." },
      { id: "puddleform", name: "Puddle Form", type: "skill", cost: 0, block: 6, text: "Gain 6 block." },
      { id: "scribblescratch", name: "Scribble Scratch", type: "attack", cost: 1, dmg: 9, text: "Deal 9 damage." },
    ],
  },
  {
    name: "Calligrim", element: "umbra", elements: ["umbra", "hydro"], hp: 56, sprite: "🖋️", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A panther of living calligraphy whose strokes cut deeper than claws.",
    lore: "A sleek panther formed of flowing black brushstrokes, its body literally written in elegant calligraphy that moves: characters and flourishes streaming along its flanks, tail ending in a fine brush-tip dripping shadow-ink. Where it slashes, dark glyphs hang briefly in the air before fading. White crescent eyes, total silence. Every motion deliberate as a master's pen-stroke, lethal as poetry.",
    cards: [
      { id: "brushslash", name: "Brush Slash", type: "attack", cost: 1, dmg: 12, vulnerable: 1, text: "Deal 12 damage. Apply 1 Vulnerable." },
      { id: "inkveil", name: "Ink Veil", type: "skill", cost: 1, block: 11, draw: 1, text: "Gain 11 block. Draw 1." },
      { id: "finalstroke", name: "Final Stroke", type: "attack", cost: 2, dmg: 19, text: "Deal 19 damage." },
    ],
  },
  {
    name: "Murmurk", element: "umbra", hp: 42, sprite: "🌫️", rarity: "uncommon", tier: 1, evolvesTo: null,
    desc: "A shadow that collects secrets and whispers them back at the worst times.",
    lore: "A hunched, hooded shadow-figure of soft dark mist, no visible face, just a deeper darkness inside the hood, with long sleeve-like arms it wrings nervously. It drifts at the edge of conversations, soaking up secrets, which occasionally leak back out of it as faint overlapping whispers in stolen voices. Shy, gossipy, and apologetic, a walking rumor that feels bad about itself.",
    cards: [
      { id: "whisper", name: "Whisper", type: "skill", cost: 0, weak: 2, text: "Apply 2 Weak." },
      { id: "secretveil", name: "Secret Veil", type: "skill", cost: 1, block: 10, text: "Gain 10 block." },
      { id: "rumormill", name: "Rumor Mill", type: "attack", cost: 1, dmg: 8, vulnerable: 1, text: "Deal 8 damage. Apply 1 Vulnerable." },
    ],
  },

  // ----- VOID additions: a 2-stage line + standalone -----
  {
    name: "Blinkout", element: "void", hp: 30, sprite: "🫥", rarity: "common", tier: 1, evolvesTo: "Vanishrym",
    desc: "A creature that flickers out of existence whenever you look directly at it.",
    lore: "A small, round, rabbit-eared creature of matte grey-violet that visibly de-renders when observed: parts of it flicker to static, vanish, then pop back when you look away. Two wide nervous eyes are the most persistent part of it. It exists most confidently when ignored. Shy in an ontological way, never fully sure it's really there, and grateful when someone insists it is.",
    cards: [
      { id: "flickerjab", name: "Flicker Jab", type: "attack", cost: 1, dmg: 7, text: "Deal 7 damage." },
      { id: "derez", name: "De-rez", type: "skill", cost: 0, block: 6, text: "Gain 6 block." },
      { id: "glitch", name: "Glitch", type: "attack", cost: 1, dmg: 6, decay: 2, text: "Deal 6 damage. Apply 2 Decay." },
    ],
  },
  {
    name: "Vanishrym", element: "void", hp: 56, sprite: "👤", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "The afterimage of something that successfully ceased to exist.",
    lore: "A tall, slender silhouette of a figure that isn't there: a person-shaped absence outlined in faint violet static, its interior showing the scene behind it slightly wrong, delayed by half a second. It has no face, only the suggestion of where one was. Objects near it lose color. It moves between moments rather than through space. Quietly tragic and deeply unsettling, the ghost of a thing that opted out of being.",
    cards: [
      { id: "absentstrike", name: "Absent Strike", type: "attack", cost: 1, dmg: 11, decay: 2, text: "Deal 11 damage. Apply 2 Decay." },
      { id: "unrender", name: "Unrender", type: "skill", cost: 1, block: 12, text: "Gain 12 block." },
      { id: "nullify", name: "Nullify", type: "skill", cost: 2, decay: 4, vulnerable: 1, text: "Apply 4 Decay and 1 Vulnerable." },
    ],
  },
  {
    name: "Hollowbell", element: "void", elements: ["void", "metal"], hp: 44, sprite: "🔔", rarity: "rare", tier: 1, evolvesTo: null,
    desc: "A bell that rings silence; whatever hears it forgets a little.",
    lore: "An ancient bronze bell floating upside-down, its interior an impossible starless void, with a clapper of pale bone that swings without sound. When it 'rings', it emits visible ripples of silence that mute everything they pass through, and small memories go missing. Faint engravings on its surface have been worn away, even the bell has forgotten its own name. Mournful, slow, and softly erasing.",
    cards: [
      { id: "silenttoll", name: "Silent Toll", type: "attack", cost: 1, dmg: 8, decay: 2, text: "Deal 8 damage. Apply 2 Decay." },
      { id: "muffleward", name: "Muffle Ward", type: "skill", cost: 1, block: 11, text: "Gain 11 block." },
      { id: "forgetting", name: "The Forgetting", type: "skill", cost: 2, decay: 3, weak: 2, text: "Apply 3 Decay and 2 Weak." },
    ],
  },

  // ----- BLOOD additions: a 2-stage line -----
  {
    name: "Pulsepetal", element: "blood", elements: ["blood", "flora"], hp: 32, sprite: "🌷", rarity: "common", tier: 1, evolvesTo: "Cardiflora",
    desc: "A flower with a heartbeat, blooming brighter when it borrows yours.",
    lore: "A tulip-like flower creature whose translucent crimson petals pulse with a visible heartbeat, a soft glow traveling up its stem with each thump. Two leaf-arms, a sweet sleepy face in the bloom, and roots that tap gently like fingertips. Near other living things, its pulse synchronizes with theirs and its color deepens. Tender, alive in a way plants shouldn't be, and oddly comforting to sit beside.",
    cards: [
      { id: "pulsetap", name: "Pulse Tap", type: "attack", cost: 1, dmg: 6, leech: true, text: "Deal 6 damage. Heal for half." },
      { id: "petalfold", name: "Petal Fold", type: "skill", cost: 1, block: 8, regen: 2, text: "Gain 8 block and 2 Regen." },
      { id: "heartbloom", name: "Heart Bloom", type: "skill", cost: 1, teamheal: 4, text: "Heal team 4." },
    ],
  },
  {
    name: "Cardiflora", element: "blood", elements: ["blood", "flora"], hp: 60, sprite: "🌺", rarity: "uncommon", tier: 2, evolvesTo: null,
    desc: "A great garden-heart whose vines beat in time with every life around it.",
    lore: "A magnificent, towering bloom whose enormous central flower is shaped like an anatomical heart of layered crimson petals, visibly beating, with a network of vine-arteries spreading from it across the ground, pulsing light with every beat. Smaller pulse-flowers bloom along the vines like a circulatory garden. It feels every heartbeat near it as its own. Majestic, strange, and overwhelmingly alive: the garden's one great shared heart.",
    cards: [
      { id: "arteriallash", name: "Arterial Lash", type: "attack", cost: 1, dmg: 12, leech: true, text: "Deal 12 damage. Heal for half." },
      { id: "vitalnetwork", name: "Vital Network", type: "skill", cost: 2, teamheal: 7, regen: 3, text: "Heal team 7. Gain 3 Regen." },
      { id: "pulseempower", name: "Pulse Empower", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  // =====================================================================
  // APEX TIER — rare-based lines and standalones that climb into mythic
  // and legendary territory. Deliberately scarce; meeting one is an event.
  // =====================================================================
  {
    name: "Wyrmling", element: "pyre", elements: ["pyre", "aether"], hp: 46, sprite: "🐲", rarity: "rare", tier: 1, evolvesTo: "Drakareth",
    desc: "A dragon hatchling whose first breath bent the air like a mirage.",
    lore: "A cat-sized dragon hatchling with smoke-grey scales that shimmer faintly violet at the edges, still wearing a fragment of opalescent eggshell on its brow like a crooked crown. Oversized amber eyes, stubby wings far too small to fly on, tiny curved horns just budding. Its breath comes out as warping heat-haze rather than flame, bending light around it. Clumsy, imperious, and utterly convinced of its future majesty.",
    cards: [
      { id: "hatchflare", name: "Hatch Flare", type: "attack", cost: 1, dmg: 10, burn: 2, text: "Deal 10 damage. Apply 2 Burn." },
      { id: "eggshell", name: "Eggshell Crown", type: "skill", cost: 1, block: 11, draw: 1, text: "Gain 11 block. Draw 1." },
      { id: "wyrmpride", name: "Wyrm Pride", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
    ],
  },
  {
    name: "Drakareth", element: "pyre", elements: ["pyre", "aether"], hp: 62, sprite: "🐉", rarity: "epic", tier: 2, evolvesTo: "Pyraxis",
    desc: "A young drake learning that the sky was always meant to be its throne.",
    lore: "A horse-sized adolescent dragon, lean and long, scales deepened to charcoal banded with veins of glowing ember-orange, wings finally grown into terrifying capability. Twin horns sweep back like a crown taking shape, and the heat-haze of its hatchling breath has become rippling cones of distortion-fire that ignite what they touch. Confident now, testing its strength against storms, circling higher with every moon.",
    cards: [
      { id: "distortbreath", name: "Distortion Breath", type: "attack", cost: 1, dmg: 13, burn: 3, text: "Deal 13 damage. Apply 3 Burn." },
      { id: "wingwall", name: "Wing Wall", type: "skill", cost: 1, block: 13, draw: 1, text: "Gain 13 block. Draw 1." },
      { id: "ascendance", name: "Ascendance", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Pyraxis", element: "pyre", elements: ["pyre", "aether"], hp: 76, sprite: "🌠", rarity: "mythic", tier: 3, evolvesTo: null,
    desc: "A dragon of fire and folded space; its wings beat once and the horizon arrives.",
    lore: "A vast adult dragon whose charcoal scales have burned through to living starfire, the seams between them glowing like a sky full of slow meteors. Its immense wings are edged in bent light, leaving lens-flare ripples in the air, and its crown of horns has fused into a single sweeping crest of aurora-flame. Its roar arrives before it does; space folds politely out of its way. Majestic, ancient-eyed, the hatchling's promise utterly kept.",
    cards: [
      { id: "novabreath", name: "Nova Breath", type: "attack", cost: 2, dmg: 23, burn: 4, text: "Deal 23 damage. Apply 4 Burn." },
      { id: "lightfold", name: "Light Fold", type: "skill", cost: 1, block: 14, draw: 1, text: "Gain 14 block. Draw 1." },
      { id: "apexflame", name: "Apex Flame", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },
  {
    name: "Gloomare", element: "umbra", elements: ["umbra", "hydro"], hp: 58, sprite: "🐴", rarity: "epic", tier: 1, evolvesTo: "Nullmare",
    desc: "A drowned-black mare that gallops on still water and bad dreams.",
    lore: "A sleek, beautiful horse of wet darkness, its coat like deep water at midnight, mane and tail flowing as drifting ink that never settles. Its hooves touch water without ripples and ground without sound, leaving small puddles of reflected nightmare behind. Eyes of pale drowned moonlight. It appears at the edges of lakes at dusk, lovely and wrong, inviting riders it never returns.",
    cards: [
      { id: "nightgallop", name: "Night Gallop", type: "attack", cost: 1, dmg: 12, vulnerable: 1, text: "Deal 12 damage. Apply 1 Vulnerable." },
      { id: "stillwater", name: "Still Water", type: "skill", cost: 1, block: 12, soak: 2, text: "Gain 12 block. Apply 2 Soak." },
      { id: "drowneddream", name: "Drowned Dream", type: "attack", cost: 2, dmg: 18, text: "Deal 18 damage." },
    ],
  },
  {
    name: "Nullmare", element: "umbra", elements: ["umbra", "void"], hp: 74, sprite: "🌑", rarity: "mythic", tier: 2, evolvesTo: null,
    desc: "The nightmare that remains when even the dream has been erased.",
    lore: "A towering spectral stallion whose body is a horse-shaped tear in reality, its interior a starless void that drinks nearby light, edged in a corona of violet static. Its mane streams upward like smoke falling in reverse, and its eyes are two slow-collapsing points of white. Where its hooves strike, sound dies and color drains in spreading rings. It does not chase; it is simply, suddenly, behind you. The void learned to gallop.",
    cards: [
      { id: "voidstampede", name: "Void Stampede", type: "attack", cost: 2, dmg: 20, decay: 3, text: "Deal 20 damage. Apply 3 Decay." },
      { id: "lightdrinker", name: "Light Drinker", type: "skill", cost: 1, block: 14, vulnerable: 2, text: "Gain 14 block. Apply 2 Vulnerable." },
      { id: "terrorgait", name: "Terror Gait", type: "power", cost: 2, strength: 5, text: "Gain 5 Strength." },
    ],
  },
  {
    name: "Solgrave", element: "lumen", elements: ["lumen", "umbra"], hp: 72, sprite: "🌗", rarity: "mythic", tier: 1, evolvesTo: null,
    desc: "A knight of the eclipse, sworn equally to the light and the dark.",
    lore: "A tall armored figure whose left half is radiant gold-white plate trailing dawn-light, and whose right half is matte black armor bleeding slow shadow, the two halves meeting in a clean eclipse-line down its body. Its helm bears a corona crest, half flame and half void; its single greatsword is bright on one edge and dark on the other. It moves with ceremonial gravity, a living balance, judge of the boundary hour where day and night negotiate.",
    cards: [
      { id: "eclipsecut", name: "Eclipse Cut", type: "attack", cost: 1, dmg: 13, vulnerable: 1, text: "Deal 13 damage. Apply 1 Vulnerable." },
      { id: "coronaguard", name: "Corona Guard", type: "skill", cost: 1, shield: 9, teamheal: 4, text: "Gain 9 Shield. Heal team 4." },
      { id: "balancekept", name: "Balance Kept", type: "power", cost: 2, strength: 4, text: "Gain 4 Strength." },
    ],
  },
  {
    name: "Chronolisk", element: "aether", elements: ["aether", "crystal"], hp: 82, sprite: "⏳", rarity: "legendary", tier: 1, evolvesTo: null,
    desc: "A basilisk of crystallized time; its gaze doesn't petrify, it pauses.",
    lore: "An immense serpentine basilisk whose body is translucent hourglass-crystal, filled with slowly falling golden sand that streams faster when it strikes. Its scales are clock-faces grown like plates, each showing a slightly different hour, and its crest is a fan of crystal shards orbiting in tick-tock rhythm. Its gaze stops things: dust hangs, water stills, the struck moment simply waits. Patient beyond meaning, it has seen every battle's ending before the first blow.",
    cards: [
      { id: "pausegaze", name: "Pausing Gaze", type: "skill", cost: 1, weak: 3, chill: 2, text: "Apply 3 Weak and 2 Chill." },
      { id: "sandstrike", name: "Sand of Ages", type: "attack", cost: 2, dmg: 24, text: "Deal 24 damage." },
      { id: "borrowedtime", name: "Borrowed Time", type: "skill", cost: 1, block: 15, energy: 1, text: "Gain 15 block and 1 energy." },
    ],
  },
  {
    name: "Ragnaroc", element: "stone", elements: ["stone", "pyre"], hp: 84, sprite: "🦅", rarity: "legendary", tier: 1, evolvesTo: null,
    desc: "The mountain-sized bird whose landing is recorded as a geological event.",
    lore: "A roc of apocalyptic scale, its feathers slabs of layered basalt edged in cooling lava-light, its wingspan casting valley-wide shadow. Magma glows through the joints of its stone plumage like a forge seen through cracks, and its talons are obsidian hooks that have carried off hills. Each wingbeat is a rockslide; its cry is a volcanic vent. It nests in calderas and preens with landslides. Where legends say a mountain moved, Ragnaroc had simply shifted in its sleep.",
    cards: [
      { id: "calderacry", name: "Caldera Cry", type: "attack", cost: 2, dmg: 22, burn: 3, text: "Deal 22 damage. Apply 3 Burn." },
      { id: "basaltplume", name: "Basalt Plumage", type: "skill", cost: 2, block: 20, shield: 6, text: "Gain 20 block and 6 Shield." },
      { id: "extinction", name: "Extinction Dive", type: "attack", cost: 2, dmg: 30, exhaust: true, text: "Deal 30 damage. Banish." },
    ],
  },

];

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/dex — fixed dex numbering
// ║ UPDATE WHEN: ANY roster add/remove/rename: regenerate this list (seeded script) or numbers shift
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Codex (dex) order ----------
// Fixed dex numbers, generated once: evolution lines stay contiguous and
// the sequence roughly follows natural discovery order (early commons
// first, apex tier late, godly beasts close the dex). Seeded, so stable.

export { DEFAULT_MONSTERS };

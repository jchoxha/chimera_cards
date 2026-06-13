import { evolutionTarget } from "./monster.js";
import { ITEMS } from "../data/items.js";
const EVOLUTION_REQS = {
  // ===== EMBER ===== aggressive, burn-it-down theme
  Cindermouse: {
    flavor: "Cindermice evolve through sheer aggression.",
    item: "evostone",
    conds: [{ stat: "xp", need: 80, label: "XP" }, { stat: "wins", need: 4, label: "Battles won" }],
  },
  Emberat: {
    flavor: "Only by surviving an inferno does it become Infernyx.",
    item: "emberheart",
    conds: [{ stat: "xp", need: 180, label: "XP" }, { stat: "eliteKills", need: 1, label: "Elites slain" }],
  },
  Magmaw: {
    flavor: "Magmaw must consume enough foes to erupt into Volcanoth.",
    item: "evostone",
    conds: [{ stat: "xp", need: 120, label: "XP" }, { stat: "kos", need: 8, label: "Enemies KO'd" }],
  },

  // ===== TIDE ===== patience, endurance, the long game
  Tidalith: {
    flavor: "Tidaliths erode their enemies slowly over many fights.",
    item: "evostone",
    conds: [{ stat: "xp", need: 90, label: "XP" }, { stat: "battles", need: 6, label: "Battles fought" }],
  },
  Brineling: {
    flavor: "A Brineling that braves the deep treasure caves becomes Krakenmaw.",
    item: "evostone",
    conds: [{ stat: "xp", need: 110, label: "XP" }, { stat: "treasures", need: 3, label: "Treasures looted" }],
  },

  // ===== GALE ===== speed, untouchability, evasion
  Zephyrling: {
    flavor: "Zephyrlings evolve by winning without ever falling.",
    item: "evostone",
    conds: [{ stat: "xp", need: 80, label: "XP" }, { stat: "flawlessWins", need: 2, label: "Flawless wins (no faint)" }],
  },
  Gustrike: {
    flavor: "Stormcrest is born of the high winds: defeat aero-touched foes.",
    item: "windcharm",
    conds: [{ stat: "xp", need: 170, label: "XP" }, { stat: "ko_aero", need: 3, label: "Aero enemies KO'd" }],
  },
  Mothlet: {
    flavor: "Mothlets transform in the quiet of rest sites under moonlight.",
    item: "evostone",
    conds: [{ stat: "xp", need: 90, label: "XP" }, { stat: "rests", need: 2, label: "Times rested" }],
  },

  // ===== STONE ===== resilience, defense, immovability
  Pebblet: {
    flavor: "Pebblets harden into Boulderkin by enduring many blows.",
    item: "evostone",
    conds: [{ stat: "xp", need: 100, label: "XP" }, { stat: "battles", need: 5, label: "Battles fought" }],
  },
  Boulderkin: {
    flavor: "Titanore awakens only after toppling a great foe.",
    item: "titanband",
    conds: [{ stat: "xp", need: 220, label: "XP" }, { stat: "bossKills", need: 1, label: "Bosses defeated" }],
  },

  // ===== UMBRA ===== solitude, the lone hunter
  Shadepup: {
    flavor: "A Shadepup proves itself as the last one standing.",
    item: "evostone",
    conds: [{ stat: "xp", need: 110, label: "XP" }, { stat: "soloKills", need: 2, label: "Kills as sole survivor" }],
  },
  Wispling: {
    flavor: "Reaperion forms where shadow gathers many souls.",
    item: "voidcrystal",
    conds: [{ stat: "xp", need: 160, label: "XP" }, { stat: "kos", need: 10, label: "Souls reaped (KOs)" }],
  },

  // ===== LUMEN ===== generosity, trials, devotion
  Glimmer: {
    flavor: "Glimmer ascends to Radiel through devotion at shrines.",
    item: "evostone",
    conds: [{ stat: "xp", need: 90, label: "XP" }, { stat: "shops", need: 1, label: "Shops visited" }, { stat: "rests", need: 1, label: "Times rested" }],
  },
  Radiel: {
    flavor: "Seraphage descends only for one who has slain an elite and a boss.",
    item: "solardisk",
    conds: [{ stat: "xp", need: 230, label: "XP" }, { stat: "eliteKills", need: 1, label: "Elites slain" }, { stat: "bossKills", need: 1, label: "Bosses defeated" }],
  },
};

// What it takes to evolve a monster. Looks up the species table; falls
// back to a generic requirement for fused/generated monsters that evolve.
function evolutionRequirement(m) {
  const target = evolutionTarget(m);
  if (!target) return null;
  if (m.forged) {
    // forged lines climb with XP and wins, scaling with how far along
    const stage = m.forgedStage || 1;
    return {
      flavor: "A forged creature must prove its worth before it can grow.",
      item: "evostone",
      conds: [
        { stat: "xp", need: 100 + stage * 60, label: "XP" },
        { stat: "wins", need: 3 + stage, label: "Battles won" },
      ],
    };
  }
  const named = EVOLUTION_REQS[m.name];
  if (named) return named;
  // generic fallback (e.g. fused monsters that happen to have evolvesTo)
  return {
    flavor: "This creature evolves with experience and an Evolution Stone.",
    item: "evostone",
    conds: [{ stat: "xp", need: 150, label: "XP" }],
  };
}

// progress value helper, including element-keyed KO stats like "ko_gale"
function progStat(prog, stat) {
  if (!prog) return 0;
  if (stat === "kos") {
    const k = prog.kosByElement || {};
    return Object.values(k).reduce((a, b) => a + b, 0);
  }
  if (stat.startsWith("ko_")) {
    const el = stat.slice(3);
    return (prog.kosByElement || {})[el] || 0;
  }
  return prog[stat] || 0;
}

// Returns { met, reasons:[{label, have, need, ok}], req } using the
// species requirement and the player's owned items.
function checkEvolution(m, ownedItems) {
  const req = evolutionRequirement(m);
  if (!req) return { met: false, reasons: [], req: null };
  const prog = m.prog || {};
  const reasons = req.conds.map((c) => {
    const have = progStat(prog, c.stat);
    return { label: c.label, have, need: c.need, ok: have >= c.need };
  });
  if (req.item) {
    const has = ownedItems.includes(req.item);
    const it = ITEMS.find((x) => x.id === req.item);
    reasons.push({ label: it ? it.name : req.item, have: has ? 1 : 0, need: 1, ok: has });
  }
  return { met: reasons.every((r) => r.ok), reasons, req };
}

// Build one monster's personal draw pile: its signature cards (doubled
// so the pile isn't tiny) plus a couple of shared universal cards any
// creature can use. Each monster fights from its own deck.

export { EVOLUTION_REQS, evolutionRequirement, progStat, checkEvolution };

import { ITEMS } from "./items.js";
const ARTIFACTS = [
  { id: "burningidol", name: "Burning Idol", icon: "🗿", text: "All attacks deal +3 damage this run.", effect: { dmgBonus: 3 } },
  { id: "granitetotem", name: "Granite Totem", icon: "🪨", text: "All skills grant +3 block this run.", effect: { blockBonus: 3 } },
  { id: "silverhourglass", name: "Silver Hourglass", icon: "⏳", text: "Draw +1 card each turn this run.", effect: { drawBonus: 1 } },
  { id: "ancientbattery", name: "Ancient Battery", icon: "🔋", text: "+1 energy each turn this run.", effect: { energyBonus: 1 } },
  { id: "heartofthedeep", name: "Heart of the Deep", icon: "🫀", text: "Team Max HP +15 this run.", effect: { maxHpBonus: 15 } },
  { id: "warbanner", name: "War Banner", icon: "🚩", text: "Team starts combat with +2 Strength this run.", effect: { startStrength: 2 } },
  { id: "duelistmask", name: "Duelist's Mask", icon: "🎭", text: "+2 damage and +2 block this run.", effect: { dmgBonus: 2, blockBonus: 2 } },
  { id: "giantsmarrow", name: "Giant's Marrow", icon: "🦴", text: "Team Max HP +25 this run.", effect: { maxHpBonus: 25 } },
  { id: "stormlens", name: "Storm Lens", icon: "🔍", text: "+1 draw and +1 damage this run.", effect: { drawBonus: 1, dmgBonus: 1 } },
  { id: "midnightcrown", name: "Midnight Crown", icon: "👑", text: "+1 Strength and +1 energy this run.", effect: { startStrength: 1, energyBonus: 1 } },
];
const artifactById = (id) => ARTIFACTS.find((a) => a.id === id);

// Sum team-wide passive bonuses from the current run's artifacts.
function artifactBonuses(artifactIds) {
  const b = { dmgBonus: 0, blockBonus: 0, drawBonus: 0, startStrength: 0, energyBonus: 0, maxHpBonus: 0 };
  (artifactIds || []).forEach((id) => {
    const a = artifactById(id);
    if (!a) return;
    for (const k in b) if (a.effect[k]) b[k] += a.effect[k];
  });
  return b;
}

// Sigils: PERMANENT team-wide passives (Artifacts are the run-scoped kind).
function sigilBonuses(ownedIds) {
  const b = { dmgBonus: 0, blockBonus: 0, drawBonus: 0, startStrength: 0, energyBonus: 0, maxHpBonus: 0, firstFree: false };
  (ownedIds || []).forEach((id) => {
    const it = ITEMS.find((x) => x.id === id);
    if (!it || it.kind !== "sigil") return;
    for (const k in b) {
      if (k === "firstFree") { if (it.effect.firstFree) b.firstFree = true; }
      else if (it.effect[k]) b[k] += it.effect[k];
    }
  });
  return b;
}

// Combine artifact (run) and sigil (permanent) passives into one bonus set.
function combinedBonuses(artifactIds, ownedIds) {
  const a = artifactBonuses(artifactIds);
  const g = sigilBonuses(ownedIds);
  const out = { ...a };
  for (const k in g) {
    if (k === "firstFree") out.firstFree = g.firstFree;
    else out[k] = (out[k] || 0) + g[k];
  }
  return out;
}

// ---------- utility ----------

export { ARTIFACTS, artifactById, artifactBonuses, sigilBonuses, combinedBonuses };

const NPCS = {
  professor: { id: "professor", name: "Professor Bramble", icon: "🧑‍🔬", greet: "Ah, my favorite field assistant! The wilds won't catalogue themselves." },
  rival: { id: "rival", name: "Kael", icon: "🧑‍🎤", greet: "Oh look who it is. Still collecting cute ones? Mine BITE." },
};
// goal: { stat, need } against the stats object, or { dex, need } against
// discovered species count. Quests unlock in chain order per giver.
const QUESTS = [
  { id: "p1", giver: "professor", title: "First Steps", text: "Win 2 battles so I know you can handle yourself out there.", goal: { stat: "battlesWon", need: 2 }, reward: { gold: 60, item: "mendtonic" } },
  { id: "p2", giver: "professor", title: "Field Researcher", text: "Capture 2 monsters. Catalogue beats conjecture!", goal: { stat: "monstersCaptured", need: 2 }, reward: { gold: 80, materials: { vitalessence: 2 } } },
  { id: "p3", giver: "professor", title: "Dex Scholar", text: "Discover 10 species. The dex hungers for data.", goal: { dex: true, need: 10 }, reward: { item: "ancienttome" } },
  { id: "p4", giver: "professor", title: "Boss Hunter", text: "Slay a dungeon boss. For science. Mostly.", goal: { stat: "bossesSlain", need: 1 }, reward: { gold: 120, item: "fusioncatalyst" } },
  { id: "r1", giver: "rival", title: "Prove It", text: "Battle me. Right here. Try to keep up.", goal: { stat: "rivalWins", need: 1 }, reward: { gold: 100 } },
  { id: "r2", giver: "rival", title: "Rematch", text: "Beginner's luck. Again — and this time I'm not holding back.", goal: { stat: "rivalWins", need: 2 }, reward: { gold: 150, materials: { primalcore: 1 } } },
];
function questProgress(q, stats, seen) {
  const cur = q.goal.dex ? seen.size : (stats[q.goal.stat] || 0);
  return { cur: Math.min(cur, q.goal.need), need: q.goal.need, done: cur >= q.goal.need };
}

// ╔══════════════════════════════════════════════════════════════════╗

export { NPCS, QUESTS, questProgress };

import { uid } from "../utils.js";
import { DEFAULT_MONSTERS } from "../data/monsters.js";
import { lineOf, FORMS, FORM_ORDER, formAllowed, formAllowsEvolution } from "../systems/elements.jsx";
function makeMonster(template) {
  return {
    uid: uid(),
    name: template.name,
    element: template.element,
    elements: [...new Set((template.elements && template.elements.length ? template.elements : [template.element]).filter(Boolean))].slice(0, 3),
    form: template.form || "regular",
    baseHp: template.baseHp || template.hp,
    maxHp: template.hp,
    hp: template.hp,
    sprite: template.sprite || "❓",
    desc: template.desc || "",
    lore: template.lore || "",
    svg: template.svg || null,
    imageUrl: template.imageUrl || null,
    rarity: template.rarity || "common",
    tier: template.tier || 1,
    evolvesTo: template.evolvesTo || null,
    boon: template.boon || null, // {id,name,text,effect}
    forged: template.forged || false, // forged monsters evolve via AI, not the roster
    forgedStage: template.forgedStage || 1,
    forgedStages: template.forgedStages || 1,
    prog: template.prog || { xp: 0, wins: 0, battles: 0, bossKills: 0, eliteKills: 0, treasures: 0, rests: 0, shops: 0, faints: 0, soloKills: 0, flawlessWins: 0, kosByElement: {} },
    cards: template.cards.map((c) => ({ ...c, cid: uid() })),
  };
}

// Find the template a monster evolves into, if any. Forged monsters have
// no roster target but DO evolve if they have stages remaining; we signal
// that with a synthetic marker the evolve flow handles via the AI.
function evolutionTarget(m) {
  // Elite/Boss bodies are terminal — a peak specimen of the current stage.
  if (!formAllowsEvolution(m.form)) return null;
  if (m.forged) {
    if ((m.forgedStage || 1) < (m.forgedStages || 1)) {
      return { forged: true, name: `${m.name} (evolved)` };
    }
    return null;
  }
  if (!m.evolvesTo) return null;
  return DEFAULT_MONSTERS.find((t) => t.name === m.evolvesTo) || null;
}

// Build the evolution chain starting from a given species name.
function chainFrom(name) {
  const chain = [];
  let cur = DEFAULT_MONSTERS.find((t) => t.name === name);
  const guard = new Set();
  while (cur && !guard.has(cur.name)) {
    guard.add(cur.name);
    chain.push(cur.name);
    cur = cur.evolvesTo ? DEFAULT_MONSTERS.find((t) => t.name === cur.evolvesTo) : null;
  }
  return chain;
}

// Find which line a monster belongs to and its 1-based stage within it.
// Forged monsters carry their own line info. Roster monsters are looked up
// in the default chains. Fused monsters default to standalone.
function evolutionInfo(m) {
  // forged monsters define their own line
  if (m.forged) {
    return {
      stage: m.forgedStage || 1,
      length: m.forgedStages || 1,
      isFinal: (m.forgedStage || 1) >= (m.forgedStages || 1),
    };
  }
  const line = lineOf(m.name);
  if (line) {
    const idx = line.members.indexOf(m.name);
    return { stage: idx + 1, length: line.length, isFinal: idx === line.length - 1, line };
  }
  // not found in roster (fused): standalone, final
  return { stage: 1, length: 1, isFinal: true };
}

// Can two monsters be fused? Allowed when their stage numbers are equal,
// OR when both are at the final stage of their line. A non-evolving
// standalone monster (length 1) is a wildcard that fuses with anything.
// Same species + same form = FORM FUSION (two regulars make a Large, etc.)
function isFormFusion(a, b) {
  if (a.name !== b.name) return false;
  if ((a.form || "regular") !== (b.form || "regular")) return false;
  const cur = FORMS[a.form || "regular"];
  const next = FORM_ORDER[cur.order + 1];
  if (!next) return false; // already boss form
  return formAllowed(next, evolutionInfo(a));
}
function nextFormOf(a) {
  const cur = FORMS[a.form || "regular"];
  return FORM_ORDER[cur.order + 1] || null;
}

function canFuse(a, b) {
  if (isFormFusion(a, b)) return true;
  const A = evolutionInfo(a);
  const B = evolutionInfo(b);
  if (A.length === 1 && A.isFinal) return true; // standalone wildcard
  if (B.length === 1 && B.isFinal) return true;
  if (A.stage === B.stage) return true; // same stage number
  if (A.isFinal && B.isFinal) return true; // both final forms
  return false;
}

// Short human label for a monster's place in its line, for the UI.
function stageLabel(m) {
  const info = evolutionInfo(m);
  if (info.length === 1) return "standalone";
  return `stage ${info.stage}/${info.length}`;
}

// Per-species evolution requirements. Each line has its own flavor.
// Trackable progress stats on m.prog: xp, wins, bossKills, eliteKills,
// treasures, rests, shops, faints, soloKills (kills while sole survivor),
// kosByElement (map element->count of enemies KO'd).
// A requirement is a list of conditions; ALL must be met.

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/evolution-reqs — named evolution gates
// ║ UPDATE WHEN: renaming/removing gated monsters; new gate items must exist in ITEMS; ko_<element> keys must be real elements
// ╚══════════════════════════════════════════════════════════════════╝

export { makeMonster, evolutionTarget, chainFrom, evolutionInfo, isFormFusion, nextFormOf, canFuse, stageLabel };

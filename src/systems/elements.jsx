import { S } from "../ui/styles.js";
import { DEFAULT_MONSTERS } from "../data/monsters.js";
const ELEMENTS = [
  "pyre", "frost", "hydro", "charge", "aero", "stone", "metal", "crystal",
  "toxin", "flora", "beast", "lumen", "aether", "umbra", "void", "blood",
];
const ELEMENT_COLOR = {
  pyre: "#ff5a2e",
  frost: "#9fe6ff",
  hydro: "#3fa9f5",
  charge: "#ffe14d",
  aero: "#9ff0b0",
  stone: "#c9a66b",
  metal: "#b8c0cc",
  crystal: "#c98bff",
  toxin: "#9bd13a",
  flora: "#5fcf5f",
  beast: "#d08b5b",
  lumen: "#ffd34d",
  aether: "#f0f0ff",
  umbra: "#a571ff",
  void: "#6b5a8a",
  blood: "#e03a5a",
};
const ELEMENT_GLYPH = {
  pyre: "🜂", frost: "❆", hydro: "🜄", charge: "⚡", aero: "🜁", stone: "🜃",
  metal: "⛭", crystal: "◈", toxin: "☣", flora: "❀", beast: "🐾", lumen: "☀",
  aether: "✶", umbra: "☾", void: "⬤", blood: "🩸",
};

// ---------- Element interactions ----------
// Hand-tuned, ASYMMETRIC matrix expressed compactly: each element lists what
// it is strong against (x1.5) and weak against (x0.66). Anything unlisted is
// neutral (x1.0). Strong/weak are independent, so A strong vs B does NOT imply
// B weak vs A. To add an element later: add it to ELEMENTS, give it a color +
// glyph above, add a MATRIX entry here, and optionally a status/affinity/reaction.
const MATRIX = {
  pyre:    { strong: ["flora", "metal", "crystal"], weak: ["hydro", "stone"] },
  frost:   { strong: ["flora", "beast", "aero"],    weak: ["pyre", "metal"] },
  hydro:   { strong: ["pyre", "stone", "void"],     weak: ["charge", "toxin"] },
  charge:  { strong: ["hydro", "aero"],             weak: ["stone", "metal"] },
  aero:    { strong: ["toxin", "beast"],            weak: ["charge", "frost"] },
  stone:   { strong: ["pyre", "charge"],            weak: ["hydro", "flora"] },
  metal:   { strong: ["crystal", "frost"],          weak: ["pyre", "void"] },
  crystal: { strong: ["charge", "umbra"],           weak: ["pyre", "metal"] },
  toxin:   { strong: ["flora", "hydro"],            weak: ["aero", "aether"] },
  flora:   { strong: ["hydro", "stone"],            weak: ["pyre", "frost", "toxin"] },
  beast:   { strong: ["toxin", "lumen"],            weak: ["frost", "aero"] },
  lumen:   { strong: ["umbra", "void", "blood"],    weak: ["aether"] },
  aether:  { strong: ["toxin", "lumen"],            weak: ["umbra"] },
  umbra:   { strong: ["lumen", "beast"],            weak: ["crystal", "aether"] },
  void:    { strong: ["metal", "aether"],           weak: ["hydro", "lumen"] },
  blood:   { strong: ["beast", "flora"],            weak: ["lumen"] },
};
const MULT_STRONG = 1.5;
const MULT_WEAK = 0.66;

// Damage multiplier of an attacking element vs a defending element.
function elementMultiplier(atk, def) {
  if (!atk || !def) return 1;
  const m = MATRIX[atk];
  if (m) {
    if (m.strong && m.strong.includes(def)) return MULT_STRONG;
    if (m.weak && m.weak.includes(def)) return MULT_WEAK;
  }
  return 1;
}
function effectivenessLabel(mult) {
  if (mult > 1) return "super effective!";
  if (mult < 1) return "not very effective…";
  return null;
}


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/elements+forms+lines — matchups, FORMS policy, line registry
// ║ UPDATE WHEN: new elements: MATRIX/ELEMENT_STATUS/color/glyph; new forms: FORM_ORDER+POLICY+fusion ladder; lines rebuild automatically from roster
// ╚══════════════════════════════════════════════════════════════════╝
// Multi-type defense: a monster can have up to 3 elements. The attack's
// multiplier is the PRODUCT across all of the defender's elements
// (Pokémon-style stacking weaknesses/resistances), plus self-resist if the
// defender shares the attacking element.
function defenseMultiplier(atkEl, defender) {
  const defs = (defender.elements && defender.elements.length ? defender.elements : [defender.element]).filter(Boolean);
  let mult = 1;
  defs.forEach((d) => { mult *= elementMultiplier(atkEl, d); });
  if (atkEl && defs.includes(atkEl)) mult *= SELF_RESIST;
  return mult;
}

// ---------- Monster FORMS ----------
// Variant bodies of the same species: from babies (bred) up to boss-form
// titans. Forms scale HP/Strength and are preserved through capture.
// `art` = relative scale of the creature art on its card (size you can see).
const FORMS = {
  baby:    { id: "baby",    label: "Baby",  badge: "🍼", hpMult: 0.5,  str: -1, order: 0, art: 0.72 },
  young:   { id: "young",   label: "Young", badge: "🌱", hpMult: 0.75, str: 0,  order: 1, art: 0.86 },
  regular: { id: "regular", label: "",      badge: "",   hpMult: 1.0,  str: 0,  order: 2, art: 1.0  },
  elite:   { id: "elite",   label: "Elite", badge: "⭐", hpMult: 1.6,  str: 2,  order: 3, art: 1.34 },
  boss:    { id: "boss",    label: "Boss",  badge: "👑", hpMult: 2.0,  str: 3,  order: 4, art: 1.55 },
};
const FORM_ALIAS = { small: "young", large: "regular" };
const FORM_ORDER = ["baby", "young", "regular", "elite", "boss"];

// Forms that are TERMINAL: a creature wearing one is a peak specimen of its
// current stage and cannot evolve (prevents power double-stacking and gives
// captures a "strong now vs. room to grow" tradeoff). See monster.evolutionTarget.
const TERMINAL_FORMS = ["elite", "boss"];
function formAllowsEvolution(formId) { return !TERMINAL_FORMS.includes(formId || "regular"); }

// POLICY: which stages of an evolution line may wear which forms.
// stage kinds: "first", "middle", "final", "standalone". Edit freely.
// Elite/Boss are now allowed at ANY stage (an "Elite Cindermouse" can exist),
// but they're TERMINAL_FORMS above, so such a creature simply can't evolve.
const FORM_POLICY = {
  baby: ["first", "standalone"],          // babies belong to base forms (breeding)
  small: ["first", "middle", "final", "standalone"],
  regular: ["first", "middle", "final", "standalone"],
  large: ["first", "middle", "final", "standalone"],
  elite: ["first", "middle", "final", "standalone"],
  boss: ["first", "middle", "final", "standalone"],
};
function stageKind(info) {
  if (info.length === 1) return "standalone";
  if (info.stage === 1) return "first";
  if (info.isFinal) return "final";
  return "middle";
}
function formAllowed(formId, info) {
  return (FORM_POLICY[formId] || []).includes(stageKind(info));
}
// All of a monster's element pills, deduped, primary first.
function monElements(m) {
  return [...new Set((m.elements && m.elements.length ? m.elements : [m.element]).filter(Boolean))];
}
// Multi-type cards get a gradient of their element colors; single-type a
// solid color (returned as a degenerate gradient so it works in any
// gradient context). monAccent gives a single solid color for glows/badges.
function monAccent(m) { return ELEMENT_COLOR[(monElements(m)[0])] || "#c9a66b"; }
function monGradient(m, angle = 135) {
  const cols = monElements(m).map((e) => ELEMENT_COLOR[e] || "#888");
  if (cols.length === 1) return `linear-gradient(${angle}deg, ${cols[0]}, ${cols[0]})`;
  return `linear-gradient(${angle}deg, ${cols.join(", ")})`;
}
// A gradient "border" that respects border-radius, via background-clip.
function gradBorderStyle(m, innerBg, width = 2) {
  return {
    border: `${width}px solid transparent`,
    background: `linear-gradient(${innerBg}, ${innerBg}) padding-box, ${monGradient(m)} border-box`,
  };
}

function ElementPills({ m, size = 9 }) {
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
      {monElements(m).map((el) => (
        <span key={el} style={{ ...S.elementPill, position: "static", display: "inline-block", background: ELEMENT_COLOR[el], fontSize: size }}>
          {el}
        </span>
      ))}
    </div>
  );
}

function formLabel(m) {
  const f = FORMS[FORM_ALIAS[m.form] || m.form || "regular"] || FORMS.regular;
  return f && f.label ? `${f.badge} ${f.label}` : "";
}
// Roll a wild/dungeon enemy's form, respecting policy.
function rollEnemyForm(info, ctx = {}) {
  if (ctx.boss && formAllowed("boss", info)) return "boss";
  if (ctx.elite && formAllowed("elite", info)) return "elite";
  const r = Math.random();
  if (r < 0.08 && formAllowed("baby", info)) return "baby";
  if (r < 0.25 && formAllowed("young", info)) return "young";
  return "regular";
}

// ---------- Evolution line registry ----------
// Backend organization of the roster by line: built once from the chain
// data, giving each line an id (its root), ordered members, shared elements,
// and the base rarity that the +1-per-stage rule climbs from.
let EVOLUTION_LINES = null;
function buildLines() {
  if (EVOLUTION_LINES) return EVOLUTION_LINES;
  const evolvedInto = new Set(DEFAULT_MONSTERS.filter((t) => t.evolvesTo).map((t) => t.evolvesTo));
  const lines = [];
  DEFAULT_MONSTERS.forEach((t) => {
    if (evolvedInto.has(t.name)) return; // not a root
    const members = [];
    let cur = t;
    const guard = new Set();
    while (cur && !guard.has(cur.name)) {
      guard.add(cur.name);
      members.push(cur);
      cur = cur.evolvesTo ? DEFAULT_MONSTERS.find((x) => x.name === cur.evolvesTo) : null;
    }
    const elements = [...new Set(members.flatMap((m) => (m.elements && m.elements.length ? m.elements : [m.element])))];
    lines.push({
      id: t.name,
      members: members.map((m) => m.name),
      length: members.length,
      elements,
      baseRarity: t.rarity,
    });
  });
  EVOLUTION_LINES = lines;
  return lines;
}
function lineOf(name) {
  return buildLines().find((l) => l.members.includes(name)) || null;
}

// Each element's themed status. Affinity boosts that status by +1 when an
// attack of the element applies it. Some elements are support/defense and have
// no enemy-status (handled via card effects instead).
const ELEMENT_STATUS = {
  pyre: "burn",       // HP loss per turn, decays
  frost: "chill",     // enemy attacks weaker, decays
  hydro: "soak",      // wet: enables reactions
  charge: "shock",    // enemy loses energy next turn
  toxin: "poison",    // HP loss per turn, does NOT decay
  umbra: "vulnerable",// +50% damage taken, decays
  void: "decay",      // loses HP and block per turn
};
// affinity = element grants +1 to its own status
const ELEMENT_AFFINITY = ELEMENT_STATUS;

// Self-element resistance: a monster takes reduced damage from its own element.
const SELF_RESIST = 0.75;

// ---------- Reactions ----------
// A reaction fires when an attack of element `atk` lands on a target that
// carries the status from a trigger element. `clears` removes the trigger
// status; otherwise it lingers. Effects are applied in the combat engine.
// id is used by the engine; label is shown in the log.
const REACTIONS = [
  { id: "shatter",    atk: "pyre",  needs: "chill",      clears: true,  label: "Shatter" },
  { id: "steam",      atk: "pyre",  needs: "soak",       clears: true,  label: "Steam" },
  { id: "conduct",    atk: "charge",needs: "soak",       clears: false, label: "Conduct" },
  { id: "combust",    atk: "pyre",  needs: "poison",     clears: true,  label: "Combust" },
  { id: "spread",     atk: "hydro", needs: "poison",     clears: false, label: "Spread" },
  { id: "brittle",    atk: "frost", needs: "burn",       clears: true,  label: "Brittle" },
  { id: "corrode",    atk: "toxin", needs: "decay",      clears: false, label: "Corrode" },
  { id: "consume",    atk: "void",  needs: "any",        clears: true,  label: "Consume" },
  { id: "hemorrhage", atk: "blood", needs: "burn",       clears: false, label: "Hemorrhage" },
  { id: "hemorrhage2",atk: "blood", needs: "poison",     clears: false, label: "Hemorrhage" },
];

// Find a reaction for an attack element vs the enemy's current statuses.
function findReaction(atkEl, enemyStatus) {
  for (const r of REACTIONS) {
    if (r.atk !== atkEl) continue;
    if (r.needs === "any") {
      const has = ["burn", "chill", "soak", "shock", "poison", "vulnerable", "decay"].some((s) => (enemyStatus[s] || 0) > 0);
      if (has) return r;
    } else if ((enemyStatus[r.needs] || 0) > 0) {
      return r;
    }
  }
  return null;
}


// Universal cards any creature can learn

// Icon-scale art for ITEMS and MOVES: a simple bold emblem, not a scene.

export { ELEMENTS, ELEMENT_COLOR, ELEMENT_GLYPH, MATRIX, MULT_STRONG, MULT_WEAK, elementMultiplier, effectivenessLabel, defenseMultiplier, FORMS, FORM_ORDER, FORM_POLICY, TERMINAL_FORMS, formAllowsEvolution, stageKind, formAllowed, monElements, monAccent, monGradient, gradBorderStyle, ElementPills, formLabel, rollEnemyForm, EVOLUTION_LINES, buildLines, lineOf, ELEMENT_STATUS, ELEMENT_AFFINITY, SELF_RESIST, REACTIONS, findReaction };

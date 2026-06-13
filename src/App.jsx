import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

// ============================================================
// CHIMERA CARDS — a Pokémon x Slay the Spire prototype
// Capture monsters, build card-driven teams, descend dungeons,
// generate new monsters with AI, and fuse two into one.
// ============================================================

// BUMP THIS ON EVERY EDIT so the player can verify they have the
// BUMP THIS ON EVERY EDIT so the player can verify they have the
// latest artifact. Shown in the header and the debug menu.
const APP_VERSION = "v3.4";

/* ════════════════ TABLE OF CONTENTS (virtual modules) ════════════════
   Search for "MODULE:" to jump. Each banner lists its UPDATE WHEN
   obligations — the cross-codebase changes that must touch that module.
   1. ai/claude            7. data/artifacts+passives
   2. data/moves           8. systems/elements+forms+lines
   3. data/monsters        9. systems/forge
   4. data/dex            10. data/evolution-reqs
   5. data/items          11. app/main (state + logic)
   6. data/materials      12. ui/chrome   13. ui/admin (+ other ui/*)
   GOLDEN RULES: bump APP_VERSION every edit · regen dex on roster change
   · new content -> admin console · components only read props.
   ═══════════════════════════════════════════════════════════════════ */

// ---------- AI helper (Claude in the artifact) ----------
// Inside the Claude app this endpoint needs no key. When running OUTSIDE
// Claude (local Vite dev, etc.), set window.ANTHROPIC_API_KEY in index.html
// to enable the AI features (forge/fusion/art). LOCAL TESTING ONLY — never
// ship a page with your key in it. Without a key, AI features fail
// gracefully (emoji art, error messages) and the rest of the game works.

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/save — persistence adapter (artifact storage or
// ║ localStorage). UPDATE WHEN: any new persistent state is added to
// ║ app/main — add it to serializeSave AND hydrateSave or it silently
// ║ won't survive a refresh.
// ╚══════════════════════════════════════════════════════════════════╝
const SAVE_KEY = "chimera_save_v1";
async function storeSet(val) {
  const json = JSON.stringify(val);
  try {
    if (typeof window !== "undefined" && window.storage) { await window.storage.set(SAVE_KEY, json); return true; }
  } catch (e) {}
  try { localStorage.setItem(SAVE_KEY, json); return true; } catch (e) {}
  return false;
}
async function storeGet() {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(SAVE_KEY);
      if (r && r.value) return JSON.parse(r.value);
    }
  } catch (e) {}
  try { const j = localStorage.getItem(SAVE_KEY); if (j) return JSON.parse(j); } catch (e) {}
  return null;
}
async function storeClear() {
  try { if (typeof window !== "undefined" && window.storage) await window.storage.delete(SAVE_KEY); } catch (e) {}
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/sfx — procedural sound via tone.js. UPDATE WHEN:
// ║ new game moments deserve audio (call SFX.<x>() at the trigger).
// ║ Audio starts on first user gesture; SFX.muted toggles globally.
// ╚══════════════════════════════════════════════════════════════════╝
const SFX = {
  muted: false,
  _ready: false,
  async _ensure() {
    if (this._ready || this.muted) return this._ready;
    try {
      await Tone.start();
      this._synth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 } }).toDestination();
      this._synth.volume.value = -10;
      this._noise = new Tone.NoiseSynth({ envelope: { attack: 0.002, decay: 0.09, sustain: 0 } }).toDestination();
      this._noise.volume.value = -16;
      this._ready = true;
    } catch (e) {}
    return this._ready;
  },
  async _notes(seq, gap = 0.09) {
    if (this.muted || !(await this._ensure())) return;
    const now = Tone.now();
    seq.forEach(([n, d], i) => this._synth.triggerAttackRelease(n, d || 0.09, now + i * gap));
  },
  async hit(big) { if (this.muted || !(await this._ensure())) return; this._noise.triggerAttackRelease(big ? 0.16 : 0.08); if (big) this._synth.triggerAttackRelease("C2", 0.12); },
  card() { this._notes([["G5", 0.04]], 0); },
  block() { this._notes([["C3", 0.08]], 0); },
  heal() { this._notes([["E5"], ["G5"]], 0.07); },
  step() { if (this.muted || !this._ready) return; this._noise.triggerAttackRelease(0.03); },
  victory() { this._notes([["C5"], ["E5"], ["G5"], ["C6", 0.22]]); },
  defeat() { this._notes([["E4"], ["C4"], ["A3", 0.3]], 0.16); },
  capture() { this._notes([["G4"], ["C5"], ["E5"], ["G5", 0.25]], 0.11); },
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/claude — API access, art + JSON generation
// ║ UPDATE WHEN: API contract changes; new AI features (forge/fuse/evolve prompts live with their systems)
// ╚══════════════════════════════════════════════════════════════════╝
async function callClaude(prompt, maxTokens = 1200) {
  const headers = { "Content-Type": "application/json" };
  if (typeof window !== "undefined" && window.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = window.ANTHROPIC_API_KEY;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.content) throw new Error("No content in response");
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Pull the first balanced {...} object out of arbitrary model text.
function extractJson(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = t.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model output");
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") {
      depth--;
      if (depth === 0) {
        const slice = t.slice(start, i + 1);
        return JSON.parse(slice);
      }
    }
  }
  throw new Error("Unbalanced JSON in model output");
}

async function askClaudeJson(prompt, maxTokens = 1200) {
  const text = await callClaude(prompt, maxTokens);
  return extractJson(text);
}

// ---------- Consistent art direction ----------
// Yu-Gi-Oh card-art energy crossed with Adventure Time's rounded,
// flat, friendly shapes. We ask Claude for a single inline SVG so the
// whole roster shares one cohesive, hand-drawn-but-bold look.
const ART_STYLE = `ART DIRECTION (follow exactly for visual consistency across the whole roster):
- Aesthetic: Yu-Gi-Oh trading-card creature art crossed with Adventure Time. Bold, dramatic, slightly menacing creature silhouettes BUT rendered with rounded, simple, friendly cartoon shapes, thick clean outlines, and flat cel-shaded color fills (no gradients on shapes except the background).
- Composition: one creature centered, filling most of the 200x200 canvas, three-quarter heroic pose.
- Outline: every shape has a dark outline, stroke-width 3-4, stroke color #1a1228, stroke-linejoin round.
- Color: 2-4 flat fill colors keyed to the element. Use simple highlight/shadow shapes, not gradients, on the body.
- Background: a soft radial-gradient glow in the element color behind the creature, plus 2-3 small decorative shapes (stars, sparks, bubbles) matching the element. Adventure Time uses simple dot eyes and rounded limbs; keep faces expressive and a little goofy-but-cool.
- Eyes: large, simple, characterful.`;

// Build the prompt that asks Claude for a self-contained SVG sprite.
function artPrompt({ name, element, desc, lore }) {
  const brief = lore && lore.length > desc.length ? lore : desc;
  return `You are an SVG illustrator. Draw a monster as a single self-contained <svg> element.

Monster: "${name}" — element: ${element}.
Visual brief: ${brief}

${ART_STYLE}

OUTPUT RULES:
- Respond with ONLY the SVG markup, starting with <svg and ending with </svg>. No prose, no markdown fences.
- Root must be: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
- Use only basic shapes (path, circle, ellipse, rect, polygon), linearGradient/radialGradient allowed ONLY for the background.
- Keep it under ~2500 characters. Make it clearly readable as the described creature.`;
}

const SAFE_SVG_TAGS = /^(svg|g|path|circle|ellipse|rect|polygon|polyline|line|defs|linearGradient|radialGradient|stop|title)$/i;

// Strip anything that isn't a known-safe drawing tag (no script/foreignObject/etc).
function sanitizeSvg(raw) {
  if (!raw) return null;
  let s = raw.trim();
  const start = s.indexOf("<svg");
  const end = s.lastIndexOf("</svg>");
  if (start === -1 || end === -1) return null;
  s = s.slice(start, end + 6);
  // reject if it smuggles scripts or handlers
  if (/<script|on\w+\s*=|javascript:|<foreignObject|<iframe/i.test(s)) return null;
  // very light tag whitelist check
  const tags = [...s.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[1]);
  if (tags.some((t) => !SAFE_SVG_TAGS.test(t))) return null;
  return s;
}

async function generateArt(meta) {
  try {
    const text = await callClaude(artPrompt(meta), 1600);
    return sanitizeSvg(text);
  } catch {
    return null; // caller falls back to emoji sprite
  }
}

// ---------- Card archetype catalogue ----------
// Cards are the moves. type: attack | skill | power. cost in energy.
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
const FORMS = {
  baby:    { id: "baby",    label: "Baby",  badge: "🍼", hpMult: 0.5,  str: -1, order: 0 },
  small:   { id: "small",   label: "Small", badge: "🐾", hpMult: 0.75, str: 0,  order: 1 },
  regular: { id: "regular", label: "",      badge: "",   hpMult: 1.0,  str: 0,  order: 2 },
  large:   { id: "large",   label: "Large", badge: "🔺", hpMult: 1.3,  str: 1,  order: 3 },
  elite:   { id: "elite",   label: "Elite", badge: "⭐", hpMult: 1.6,  str: 2,  order: 4 },
  boss:    { id: "boss",    label: "Boss",  badge: "👑", hpMult: 2.0,  str: 3,  order: 5 },
};
const FORM_ORDER = ["baby", "small", "regular", "large", "elite", "boss"];

// POLICY: which stages of an evolution line may wear which forms.
// stage kinds: "first", "middle", "final", "standalone". Edit freely.
const FORM_POLICY = {
  baby: ["first", "standalone"],          // babies belong to base forms (breeding)
  small: ["first", "middle", "final", "standalone"],
  regular: ["first", "middle", "final", "standalone"],
  large: ["first", "middle", "final", "standalone"],
  elite: ["final", "standalone"],         // elite/boss bodies are end-of-line
  boss: ["final", "standalone"],
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
  const f = FORMS[m.form || "regular"];
  return f && f.label ? `${f.badge} ${f.label}` : "";
}
// Roll a wild/dungeon enemy's form, respecting policy.
function rollEnemyForm(info, ctx = {}) {
  if (ctx.boss && formAllowed("boss", info)) return "boss";
  if (ctx.elite && formAllowed("elite", info)) return "elite";
  const r = Math.random();
  if (r < 0.08 && formAllowed("baby", info)) return "baby";
  if (r < 0.25 && formAllowed("small", info)) return "small";
  if (r > 0.88 && formAllowed("large", info)) return "large";
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
async function generateIconArt({ name, kind, desc }) {
  const prompt = `You are an SVG icon illustrator. Draw a game icon as a single self-contained <svg>.
Subject: "${name}" — a ${kind} in a monster-taming card game. Visual idea: ${desc}
Style: bold flat emblem, 2-4 colors plus a dark background circle or rounded square, thick simple shapes, readable at 48px. No text.
OUTPUT RULES: ONLY the SVG markup. Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">. Basic shapes only. Under 1200 characters.`;
  try {
    const out = await callClaude(prompt, 800);
    const m = out.match(/<svg[\s\S]*<\/svg>/);
    return m ? sanitizeSvg(m[0]) : null;
  } catch (e) {
    return null;
  }
}
// Deterministic procedural emblem art: every item/move gets an image with
// no API calls. Motif from kind/type, palette from element/rarity, shape
// variation hashed from the id. TCG-style: dark field, bold emblem.
function procIcon(id, motif, color) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const rot = h % 360, n = 5 + (h % 4), r2 = 26 + (h % 10);
  const star = Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? r2 * 0.45 : r2;
    return `${50 + rr * Math.cos(a)},${50 + rr * Math.sin(a)}`;
  }).join(" ");
  const M = {
    attack: `<g transform="rotate(${rot % 40 - 20} 50 50)"><polygon points="50,16 60,44 86,50 60,56 50,84 40,56 14,50 40,44" fill="${color}"/><circle cx="50" cy="50" r="7" fill="#fff" opacity="0.85"/></g>`,
    skill: `<path d="M50 18 L78 28 L78 52 Q78 74 50 84 Q22 74 22 52 L22 28 Z" fill="${color}"/><path d="M50 26 L70 33 L70 52 Q70 67 50 75 Q30 67 30 52 L30 33 Z" fill="#0c0b16" opacity="0.45"/>`,
    power: `<polygon points="${star}" fill="${color}" transform="rotate(${rot} 50 50)"/><circle cx="50" cy="50" r="9" fill="#ffd34d"/>`,
    potion: `<path d="M42 20 h16 v12 l10 14 a18 18 0 1 1 -36 0 l10 -14 Z" fill="${color}"/><ellipse cx="50" cy="58" rx="13" ry="9" fill="#fff" opacity="0.35"/>`,
    sigil: `<circle cx="50" cy="50" r="26" fill="none" stroke="${color}" stroke-width="6"/><circle cx="50" cy="50" r="14" fill="${color}" opacity="0.7"/>`,
    special: `<polygon points="50,18 76,40 66,78 34,78 24,40" fill="${color}"/><polygon points="50,28 66,42 60,68 40,68 34,42" fill="#fff" opacity="0.3"/>`,
    material: `<polygon points="50,16 70,38 62,80 38,80 30,38" fill="${color}" transform="rotate(${rot % 30 - 15} 50 50)"/><polygon points="50,16 70,38 50,52 30,38" fill="#fff" opacity="0.35" transform="rotate(${rot % 30 - 15} 50 50)"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect x="2" y="2" width="96" height="96" rx="18" fill="#0c0b16"/><rect x="2" y="2" width="96" height="96" rx="18" fill="${color}" opacity="0.12"/><circle cx="50" cy="50" r="34" fill="${color}" opacity="0.15"/>${M[motif] || M.special}</svg>`;
}
function itemIcon(it) {
  const motif = it.kind === "potion" ? "potion" : it.kind === "sigil" ? "sigil" : "special";
  return procIcon(it.id, motif, RARITY_COLOR[it.rarity] || "#a571ff");
}
function moveIcon(c, fallbackEl) {
  const col = ELEMENT_COLOR[c.element || fallbackEl] || "#ffd34d";
  return procIcon(c.id, c.type, col);
}

// Renders generated icon svg, falling back to an emoji.
function IconArt({ svg, emoji, size = 34 }) {
  if (svg) return <span style={{ width: size, height: size, borderRadius: 8, overflow: "hidden", display: "inline-block", verticalAlign: "middle" }} dangerouslySetInnerHTML={{ __html: svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`) }} />;
  return <span style={{ fontSize: size * 0.7 }}>{emoji}</span>;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/moves — generic, type, special move pools
// ║ UPDATE WHEN: new elements (add a type move); new statuses (consider a move); ALSO update: admin Systems moves table, Move Tutor costs text, codex mechanics
// ╚══════════════════════════════════════════════════════════════════╝
// GENERIC moves: every monster's battle deck automatically includes these
// (the Strikes/Blocks of the system). Never learned, never transferred.
const UNIVERSAL_CARDS = [
  { id: "strike", name: "Strike", type: "attack", cost: 1, dmg: 6, text: "Deal 6 damage." },
  { id: "guard", name: "Guard", type: "skill", cost: 1, block: 5, text: "Gain 5 block." },
  { id: "focus", name: "Focus", type: "skill", cost: 0, draw: 2, text: "Draw 2 cards." },
  { id: "rally", name: "Rally", type: "power", cost: 1, strength: 2, text: "Gain 2 Strength." },
];

// TYPE moves: one per element, learnable at the Den's Move Tutor by any
// monster carrying that element. They keep their own element for matchups.
const TYPE_MOVES = [
  { id: "tm_pyre", element: "pyre", name: "Flame Burst", type: "attack", cost: 1, dmg: 9, burn: 2, text: "Deal 9 damage. Apply 2 Burn." },
  { id: "tm_frost", element: "frost", name: "Ice Lance", type: "attack", cost: 1, dmg: 8, chill: 2, text: "Deal 8 damage. Apply 2 Chill." },
  { id: "tm_hydro", element: "hydro", name: "Tide Swell", type: "attack", cost: 1, dmg: 7, soak: 2, text: "Deal 7 damage. Apply 2 Soak." },
  { id: "tm_charge", element: "charge", name: "Static Jab", type: "attack", cost: 0, dmg: 4, shock: 1, text: "Deal 4 damage. Apply 1 Shock." },
  { id: "tm_aero", element: "aero", name: "Slipstream", type: "skill", cost: 0, block: 4, draw: 1, text: "Gain 4 block. Draw 1." },
  { id: "tm_stone", element: "stone", name: "Stone Wall", type: "skill", cost: 1, block: 11, text: "Gain 11 block." },
  { id: "tm_metal", element: "metal", name: "Plate Up", type: "skill", cost: 1, shield: 6, text: "Gain 6 Shield." },
  { id: "tm_crystal", element: "crystal", name: "Refract Ray", type: "attack", cost: 1, dmg: 8, draw: 1, text: "Deal 8 damage. Draw 1." },
  { id: "tm_toxin", element: "toxin", name: "Venom Dart", type: "attack", cost: 0, dmg: 3, poison: 2, text: "Deal 3 damage. Apply 2 Poison." },
  { id: "tm_flora", element: "flora", name: "Verdant Mend", type: "skill", cost: 1, regen: 3, block: 4, text: "Gain 3 Regen and 4 block." },
  { id: "tm_beast", element: "beast", name: "Feral Claw", type: "attack", cost: 1, dmg: 10, text: "Deal 10 damage." },
  { id: "tm_lumen", element: "lumen", name: "Radiant Mend", type: "skill", cost: 1, teamheal: 5, text: "Heal team 5." },
  { id: "tm_aether", element: "aether", name: "Phase Step", type: "skill", cost: 1, block: 6, draw: 1, text: "Gain 6 block. Draw 1." },
  { id: "tm_umbra", element: "umbra", name: "Dark Hex", type: "attack", cost: 1, dmg: 6, vulnerable: 2, text: "Deal 6 damage. Apply 2 Vulnerable." },
  { id: "tm_void", element: "void", name: "Erosion", type: "attack", cost: 1, dmg: 5, decay: 3, text: "Deal 5 damage. Apply 3 Decay." },
  { id: "tm_blood", element: "blood", name: "Siphon", type: "attack", cost: 1, dmg: 7, leech: true, text: "Deal 7 damage. Heal for half." },
];

// SPECIAL moves: colorless, powerful, learnable by ANY monster, but only by
// consuming an Ancient Tome at the Move Tutor.
const SPECIAL_MOVES = [
  { id: "sp_omni", name: "Omnistrike", type: "attack", cost: 2, dmg: 9, hits: 2, text: "Deal 9 damage twice." },
  { id: "sp_aegis", name: "Aegis Field", type: "skill", cost: 2, shield: 10, block: 6, text: "Gain 10 Shield and 6 block." },
  { id: "sp_wind", name: "Second Wind", type: "skill", cost: 1, teamheal: 6, draw: 1, text: "Heal team 6. Draw 1." },
  { id: "sp_clock", name: "Overclock", type: "skill", cost: 0, energy: 2, exhaust: true, text: "Gain 2 energy. Exhaust." },
];
const MOVE_CAP = 5; // max equipped moves per monster (signatures + learned)


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/monsters — the 108-species roster
// ║ UPDATE WHEN: new monsters need: desc+lore+cards, dex order REGEN (CODEX_ORDER), rarity rule check (+1/stage), EVOLUTION_REQS if gated, admin Roster shows automatically
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Default monster roster ----------
// rarity ladder: common, uncommon, rare, epic, mythic, legendary, godly
// tier: stage in evolution line. evolvesTo: next form's name (or null).
// desc: short codex line shown to players. lore: rich hidden brief used to
// drive art + move generation and to flavor the world.
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
      { id: "continent", name: "Continental Crush", type: "attack", cost: 2, dmg: 36, exhaust: true, text: "Deal 36 damage. Exhaust." },
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
      { id: "extinction", name: "Extinction Dive", type: "attack", cost: 2, dmg: 30, exhaust: true, text: "Deal 30 damage. Exhaust." },
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
const CODEX_ORDER = [
  "Coggle", "Ironclad", "Colossite", "Pengloo",
  "Emperorime", "Ampup", "Dynamole", "Brineling",
  "Krakenmaw", "Zephyrling", "Gustrike", "Stormcrest",
  "Thistlit", "Bramblequeen", "Voltick", "Sparkbug",
  "Thunderwing", "Shellid", "Drizzlit", "Snortle",
  "Tuskarge", "Tinwhisk", "Quicksilverr", "Cactus Kid",
  "Sporelet", "Myconid", "Rotwarden", "Smoglet",
  "Mireviper", "Blinkout", "Vanishrym", "Candela",
  "Pipdream", "Reverielle", "Shardle", "Geodon",
  "Cindermouse", "Emberat", "Infernyx", "Pulsepetal",
  "Cardiflora", "Lanternaut", "Beaconwright", "Mothlet",
  "Spectermoth", "Inkpaw", "Calligrim", "Snowpup",
  "Frostfang", "Glaciathar", "Magmaw", "Volcanoth",
  "Cubrawl", "Ursurge", "Beastlord", "Fennqi",
  "Geomite", "Vipertongue", "Murmurk", "Tidalith",
  "Maelune", "Seedling", "Bloomback", "Verdantaur",
  "Shadepup", "Nightmaw", "Pebblet", "Boulderkin",
  "Titanore", "Nullbit", "Oblivox", "Tickfright",
  "Sleetsprite", "Prismling", "Gemglow", "Aurorach",
  "Wispveil", "Aethernox", "Glimmer", "Radiel",
  "Seraphage", "Leechling", "Sanguine", "Hemarch",
  "Riftrick", "Banshreek", "Wispling", "Reaperion",
  "Wyrmling", "Drakareth", "Pyraxis", "Wicklash",
  "Hollowbell", "Mirrorkoi", "Opalisk", "Gloomare",
  "Nullmare", "Magnetar", "Howlphony", "Solgrave",
  "Ragnaroc", "Chronolisk", "Tempestus", "Leviathos",
  "Phoenetia", "Cosmara", "Voidwyrm", "Terrabyss",
];
const dexNumber = (name) => CODEX_ORDER.indexOf(name) + 1;




// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/items — sigils, potions, specials
// ║ UPDATE WHEN: new sigils: update sigilBonuses keys + codex mechanics; new specials: consider RECIPES + reward/shop pools (automatic via ITEMS)
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Items (sigils, potions, specials) ----------
// sigil: persistent enchantment equipped to ONE monster. potion: one-time
// use in battle. special: enables capture/evolution/fusion/forging.
const ITEMS = [
  // sigils (equippable, persistent, monster-bound)
  { id: "emberheart", name: "Ember Heart", kind: "sigil", icon: "❤️‍🔥", rarity: "common", text: "Sigil: your whole team's attacks deal +2 damage. Permanent.", effect: { dmgBonus: 2 } },
  { id: "stonescale", name: "Stonescale", kind: "sigil", icon: "🛡️", rarity: "common", text: "Sigil: your whole team's skills grant +2 block. Permanent.", effect: { blockBonus: 2 } },
  { id: "windcharm", name: "Wind Charm", kind: "sigil", icon: "🪶", rarity: "uncommon", text: "Sigil: draw +1 card each turn. Permanent.", effect: { drawBonus: 1 } },
  { id: "voidcrystal", name: "Void Crystal", kind: "sigil", icon: "🔮", rarity: "uncommon", text: "Sigil: your team starts combat with +1 Strength. Permanent.", effect: { startStrength: 1 } },
  { id: "solardisk", name: "Solar Disk", kind: "sigil", icon: "🥏", rarity: "rare", text: "Sigil: the first card each turn costs 0. Permanent.", effect: { firstFree: true } },
  { id: "titanband", name: "Titan Band", kind: "sigil", icon: "💍", rarity: "rare", text: "Sigil: team Max HP +20. Permanent.", effect: { maxHpBonus: 20 } },
  { id: "evostone", name: "Evolution Stone", kind: "special", icon: "🌀", rarity: "rare", text: "Required to evolve a monster. Consumed on use.", effect: {} },
  { id: "fusioncatalyst", name: "Fusion Catalyst", kind: "special", icon: "🧬", rarity: "rare", text: "Required to fuse two monsters. Consumed on use.", effect: {} },
  { id: "ancienttome", name: "Ancient Tome", kind: "special", icon: "📕", rarity: "rare", text: "Teaches one special move at the Den's Move Tutor. Consumed.", effect: {} },
  { id: "genesisspark", name: "Genesis Spark", kind: "special", icon: "✨", rarity: "rare", text: "Required to forge a brand-new monster. Consumed on use.", effect: {} },
  { id: "beastball", name: "Beast Ball", kind: "special", icon: "🔴", rarity: "common", text: "Required to capture a monster. Consumed on a successful catch.", effect: {} },
  // potions
  { id: "fireflask", name: "Fire Flask", kind: "potion", icon: "🧪", rarity: "common", text: "Deal 12 damage to the enemy.", effect: { potionDmg: 12 } },
  { id: "blockdraft", name: "Bulwark Draft", kind: "potion", icon: "🧴", rarity: "common", text: "Gain 15 block.", effect: { potionBlock: 15 } },
  { id: "ragevial", name: "Rage Vial", kind: "potion", icon: "⚗️", rarity: "uncommon", text: "Gain 3 Strength this combat.", effect: { potionStrength: 3 } },
  { id: "mendtonic", name: "Mend Tonic", kind: "potion", icon: "💉", rarity: "uncommon", text: "Heal 18 HP.", effect: { potionHeal: 18 } },
  { id: "energyshot", name: "Energy Shot", kind: "potion", icon: "🔋", rarity: "rare", text: "Gain 2 energy now.", effect: { potionEnergy: 2 } },
];


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/materials+recipes — materials, drops, transmute, recipes
// ║ UPDATE WHEN: new elements (signature material), new items (recipe?), new materials need battle `use`/`effect` + useMaterial support; admin Systems tables update automatically
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Crafting materials ----------
// Each element has a signature material; four universal tiers sit above.
// Monsters drop materials on defeat and yield them when transmuted, with
// chances driven by element, rarity, tier, and battle context.
const ELEMENT_MATERIAL = {
  pyre: "cinderash", frost: "rimeshard", hydro: "tidepearl", charge: "voltfilament",
  aero: "zephyrplume", stone: "granitechip", metal: "alloyscrap", crystal: "prismsliver",
  toxin: "venomsac", flora: "bloomfiber", beast: "wildclaw", lumen: "sunmote",
  aether: "starthread", umbra: "duskveil", void: "nullfragment", blood: "crimsondrop",
};
const MATERIALS = [
  { id: "cinderash", name: "Cinder Ash", icon: "🔥", element: "pyre", tier: 1, text: "Still-warm ash from a pyre creature.", use: "Apply 2 Burn.", effect: { burn: 2 } },
  { id: "rimeshard", name: "Rime Shard", icon: "❄️", element: "frost", tier: 1, text: "A sliver of never-melting frost.", use: "Apply 2 Chill.", effect: { chill: 2 } },
  { id: "tidepearl", name: "Tide Pearl", icon: "🫧", element: "hydro", tier: 1, text: "A pearl that holds a captive current.", use: "Apply 2 Soak.", effect: { soak: 2 } },
  { id: "voltfilament", name: "Volt Filament", icon: "⚡", element: "charge", tier: 1, text: "A thread of tamed lightning.", use: "Apply 1 Shock.", effect: { shock: 1 } },
  { id: "zephyrplume", name: "Zephyr Plume", icon: "🪶", element: "aero", tier: 1, text: "A feather lighter than the air around it.", use: "Draw 1 card.", effect: { draw: 1 } },
  { id: "granitechip", name: "Granite Chip", icon: "🪨", element: "stone", tier: 1, text: "A chip of stubborn living rock.", use: "Gain 5 block.", effect: { block: 5 } },
  { id: "alloyscrap", name: "Alloy Scrap", icon: "⚙️", element: "metal", tier: 1, text: "Scrap from a machine-beast's plating.", use: "Gain 4 Shield.", effect: { shield: 4 } },
  { id: "prismsliver", name: "Prism Sliver", icon: "💎", element: "crystal", tier: 1, text: "A sliver that splits light into song.", use: "Deal 5 damage.", effect: { dmg: 5 } },
  { id: "venomsac", name: "Venom Sac", icon: "☣️", element: "toxin", tier: 1, text: "Handle with thick gloves. Twice.", use: "Apply 2 Poison.", effect: { poison: 2 } },
  { id: "bloomfiber", name: "Bloom Fiber", icon: "🌿", element: "flora", tier: 1, text: "A fiber that keeps trying to take root.", use: "Gain 2 Regen.", effect: { regen: 2 } },
  { id: "wildclaw", name: "Wild Claw", icon: "🐾", element: "beast", tier: 1, text: "A shed claw, still warm with instinct.", use: "Gain 1 Strength.", effect: { strength: 1 } },
  { id: "sunmote", name: "Sun Mote", icon: "☀️", element: "lumen", tier: 1, text: "A mote of daylight that refuses dusk.", use: "Heal 5 HP.", effect: { heal: 5 } },
  { id: "starthread", name: "Star Thread", icon: "✨", element: "aether", tier: 1, text: "A strand pulled from between stars.", use: "Gain 1 energy.", effect: { energy: 1 } },
  { id: "duskveil", name: "Dusk Veil", icon: "🌑", element: "umbra", tier: 1, text: "A scrap of woven shadow.", use: "Apply 1 Vulnerable.", effect: { vulnerable: 1 } },
  { id: "nullfragment", name: "Null Fragment", icon: "⚫", element: "void", tier: 1, text: "A piece of nothing. Surprisingly heavy.", use: "Apply 2 Decay.", effect: { decay: 2 } },
  { id: "crimsondrop", name: "Crimson Drop", icon: "🩸", element: "blood", tier: 1, text: "A drop that beats faintly in the vial.", use: "Deal 4 damage, heal 2.", effect: { dmg: 4, heal: 2 } },
  { id: "chimdust", name: "Chimera Dust", icon: "🌫️", element: null, tier: 0, text: "The common residue of all monsters.", use: "Gain 3 block.", effect: { block: 3 } },
  { id: "vitalessence", name: "Vital Essence", icon: "💠", element: null, tier: 2, text: "Concentrated life-force.", use: "Heal 8 HP.", effect: { heal: 8 } },
  { id: "primalcore", name: "Primal Core", icon: "🔮", element: null, tier: 3, text: "The dense heart of a powerful creature.", use: "Gain 2 Strength.", effect: { strength: 2 } },
  { id: "celestialshard", name: "Celestial Shard", icon: "🌟", element: null, tier: 4, text: "A fragment of something beyond rarity.", use: "+1 energy, draw 1, 5 block.", effect: { energy: 1, draw: 1, block: 5 } },
];
function materialIcon(m) { return procIcon(m.id, "material", m.element ? ELEMENT_COLOR[m.element] : "#a571ff"); }
const materialById = (id) => MATERIALS.find((m) => m.id === id);

// Roll battle drops for a defeated monster. ctx: { elite, boss, wild }.
// Returns { materialId: qty }. Chances scale with rarity/tier; elite and
// boss fights boost both odds and quantities.
function rollDrops(enemy, ctx = {}) {
  const out = {};
  const add = (id, n) => { if (n > 0) out[id] = (out[id] || 0) + n; };
  const ri = Math.max(0, rarityIndex(enemy.rarity || "common"));
  const tier = enemy.tier || 1;
  const boost = ctx.boss ? 1.5 : ctx.elite ? 1.3 : ctx.wild ? 0.85 : 1;

  // universal dust: always
  add("chimdust", ctx.boss ? 3 : ctx.elite ? 2 : 1);
  // element material: likely, more from evolved monsters
  const elMat = ELEMENT_MATERIAL[enemy.element];
  if (elMat && Math.random() < Math.min(0.95, 0.7 * boost)) {
    add(elMat, 1 + (tier >= 2 ? 1 : 0) + (Math.random() < 0.25 * boost ? 1 : 0));
  }
  // vital essence: rarity-driven
  if (Math.random() < Math.min(0.9, (0.15 + 0.08 * ri) * boost)) add("vitalessence", 1);
  // primal core: rare and above
  if (ri >= 2 && Math.random() < Math.min(0.6, (0.08 + 0.05 * (ri - 2)) * boost)) add("primalcore", 1);
  // celestial shard: legendary/godly only
  if (ri >= 5 && Math.random() < 0.18 * boost) add("celestialshard", 1);
  return out;
}

// The transmute drop TABLE for a captured monster: independent chances per
// material, driven by element, rarity, stage, and earned XP. Each entry is
// rolled with "exploding" repeats: on success you gain one and roll the SAME
// chance again, until a miss. (Expected copies at chance p = p/(1-p).)
function transmuteTable(m) {
  const ri = Math.max(0, rarityIndex(m.rarity || "common"));
  const tier = m.tier || 1;
  const xp = (m.prog && m.prog.xp) || 0;
  const xpBonus = Math.min(0.15, Math.floor(xp / 150) * 0.05);
  const table = [];
  const elMat = ELEMENT_MATERIAL[m.element];
  if (elMat) table.push({ id: elMat, chance: Math.min(0.85, 0.5 + 0.1 * (tier - 1) + xpBonus) });
  table.push({ id: "chimdust", chance: 0.8 });
  table.push({ id: "vitalessence", chance: Math.min(0.6, 0.15 + 0.08 * ri) });
  if (ri >= 2) table.push({ id: "primalcore", chance: Math.min(0.3, 0.05 + 0.05 * (ri - 2)) });
  if (ri >= 5) table.push({ id: "celestialshard", chance: 0.1 });
  return table;
}

// Roll a transmute table with exploding repeats per entry.
function rollTransmute(table) {
  const out = {};
  for (const entry of table) {
    let n = 0;
    while (Math.random() < entry.chance) n++;
    if (n > 0) out[entry.id] = n;
  }
  return out;
}

// ---------- Achievements (feats that teach crafting recipes) ----------
// check receives the stats object; recipe is the ITEM id whose recipe is learned.
const ACHIEVEMENTS = [
  { id: "firstblood", label: "Win 3 battles", check: (s) => s.battlesWon >= 3, recipe: "fireflask" },
  { id: "warpath", label: "Win 12 battles", check: (s) => s.battlesWon >= 12, recipe: "ragevial" },
  { id: "collector", label: "Capture 3 monsters", check: (s) => s.monstersCaptured >= 3, recipe: "mendtonic" },
  { id: "alchemist", label: "Transmute a monster", check: (s) => s.monstersTransmuted >= 1, recipe: "blockdraft" },
  { id: "artisan", label: "Craft 3 items", check: (s) => s.itemsCrafted >= 3, recipe: "energyshot" },
  { id: "slayer", label: "Slay a boss", check: (s) => s.bossesSlain >= 1, recipe: "evostone" },
  { id: "conqueror", label: "Slay 3 bosses", check: (s) => s.bossesSlain >= 3, recipe: "fusioncatalyst" },
];

// ---------- Crafting recipes ----------
// needs: [{ id, qty }] for specific materials; anyElement: total count drawn
// from any element materials (largest stacks consumed first).
const RECIPES = [
  { item: "beastball", needs: [{ id: "chimdust", qty: 3 }], anyElement: 0 },
  { item: "fireflask", needs: [{ id: "chimdust", qty: 2 }], anyElement: 2 },
  { item: "blockdraft", needs: [{ id: "chimdust", qty: 2 }], anyElement: 2 },
  { item: "mendtonic", needs: [{ id: "vitalessence", qty: 1 }, { id: "chimdust", qty: 2 }], anyElement: 0 },
  { item: "ragevial", needs: [{ id: "vitalessence", qty: 1 }], anyElement: 3 },
  { item: "energyshot", needs: [{ id: "vitalessence", qty: 2 }], anyElement: 4 },
  { item: "emberheart", needs: [{ id: "cinderash", qty: 4 }, { id: "vitalessence", qty: 1 }], anyElement: 0 },
  { item: "stonescale", needs: [{ id: "granitechip", qty: 4 }, { id: "vitalessence", qty: 1 }], anyElement: 0 },
  { item: "windcharm", needs: [{ id: "zephyrplume", qty: 4 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "voidcrystal", needs: [{ id: "nullfragment", qty: 4 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "solardisk", needs: [{ id: "sunmote", qty: 5 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "titanband", needs: [{ id: "granitechip", qty: 3 }, { id: "alloyscrap", qty: 3 }, { id: "primalcore", qty: 1 }], anyElement: 0 },
  { item: "evostone", needs: [{ id: "vitalessence", qty: 3 }, { id: "chimdust", qty: 5 }], anyElement: 0 },
  { item: "fusioncatalyst", needs: [{ id: "primalcore", qty: 2 }, { id: "vitalessence", qty: 2 }], anyElement: 4 },
  { item: "genesisspark", needs: [{ id: "primalcore", qty: 2 }, { id: "celestialshard", qty: 1 }], anyElement: 6 },
  { item: "ancienttome", needs: [{ id: "celestialshard", qty: 1 }, { id: "vitalessence", qty: 2 }], anyElement: 0 },
];

// Can the player afford a recipe? Returns { ok, missing: [labels] }.
function canCraft(recipe, materials) {
  const missing = [];
  for (const n of recipe.needs) {
    const have = materials[n.id] || 0;
    if (have < n.qty) missing.push(`${n.qty - have} more ${materialById(n.id).name}`);
  }
  if (recipe.anyElement > 0) {
    const totalEl = MATERIALS.filter((m) => m.element).reduce((a, m) => a + (materials[m.id] || 0), 0);
    if (totalEl < recipe.anyElement) missing.push(`${recipe.anyElement - totalEl} more element materials (any)`);
  }
  return { ok: missing.length === 0, missing };
}

// Consume a recipe's cost from a materials map (returns the new map).
function consumeRecipe(recipe, materials) {
  const next = { ...materials };
  for (const n of recipe.needs) next[n.id] = (next[n.id] || 0) - n.qty;
  if (recipe.anyElement > 0) {
    let remaining = recipe.anyElement;
    // consume from the largest element stacks first
    const els = MATERIALS.filter((m) => m.element).map((m) => m.id).sort((a, b) => (next[b] || 0) - (next[a] || 0));
    for (const id of els) {
      if (remaining <= 0) break;
      const take = Math.min(next[id] || 0, remaining);
      next[id] = (next[id] || 0) - take;
      remaining -= take;
    }
  }
  for (const k in next) if (next[k] <= 0) delete next[k];
  return next;
}

const RARITY_COLOR = {
  common: "#e8e6f0",   // white
  uncommon: "#7ee787", // green
  rare: "#4d9fff",     // blue
  epic: "#a571ff",     // purple
  mythic: "#ff5a4d",   // red
  legendary: "#ff9a3d",// orange
  godly: "#ffd34d",    // yellow
};

// ---------- Forge roll system ----------
const RARITY_LADDER = ["common", "uncommon", "rare", "epic", "mythic", "legendary", "godly"];

// Stat budgets per rarity: drives the HP range and move-power scale the AI
// is told to use, so higher rarity genuinely means a stronger monster.
const RARITY_BUDGET = {
  common: { hp: [24, 32], power: "modest (Spire-scale, small numbers)" },
  uncommon: { hp: [30, 40], power: "solid (a bit above common)" },
  rare: { hp: [38, 48], power: "strong (clearly above average)" },
  epic: { hp: [46, 58], power: "powerful (well above average)" },
  mythic: { hp: [56, 70], power: "fearsome (near the top)" },
  legendary: { hp: [66, 82], power: "formidable (top-tier, still balanced)" },
  godly: { hp: [80, 100], power: "overwhelming (the strongest in the world)" },
};

// Signature boons (passives). Tagged with the minimum rarity that can roll
// them, so higher rarities reach the best ones and commons usually get none.
const BOONS = [
  { id: "none", name: "No boon", text: "No special passive.", min: "common" },
  { id: "none2", name: "No boon", text: "No special passive.", min: "common" },
  { id: "thorns", name: "Thornskin", text: "Reflect 2 damage when hit.", min: "common", effect: { thorns: 2 } },
  { id: "opener", name: "Quick Draw", text: "Draw 1 extra card on the turn this monster swaps in.", min: "uncommon", effect: { swapDraw: 1 } },
  { id: "bulwark", name: "Bulwark", text: "Start each combat with 5 block.", min: "rare", effect: { startBlock: 5 } },
  { id: "ferocity", name: "Ferocity", text: "Start each combat with 1 Strength.", min: "epic", effect: { startStrength: 1 } },
  { id: "freecard", name: "Prodigy", text: "The first card each turn costs 0.", min: "mythic", effect: { firstFree: true } },
  { id: "overflow", name: "Overflowing", text: "Gain +1 energy on the turn this monster swaps in.", min: "legendary", effect: { swapEnergy: 1 } },
  { id: "regen", name: "Undying", text: "Heal 4 HP at the start of each of this monster's turns.", min: "godly", effect: { regen: 4 } },
];

const STAT_EMPHASES = [
  { id: "offense", name: "Offense", text: "Moves lean toward heavy damage.", min: "common" },
  { id: "defense", name: "Defense", text: "Moves lean toward block and survival.", min: "common" },
  { id: "balanced", name: "Balanced", text: "A mix of attack and defense.", min: "common" },
];

const rarityIndex = (r) => RARITY_LADDER.indexOf(r);

// Weighted random rarity for a forge. Skews low but the top tiers are rare.

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: systems/forge — forge wheel rolls
// ║ UPDATE WHEN: rarity ladder changes; starter forge pins via rollForge(forced)
// ╚══════════════════════════════════════════════════════════════════╝
function rollRarity() {
  const r = Math.random();
  if (r < 0.38) return "common";
  if (r < 0.63) return "uncommon";
  if (r < 0.80) return "rare";
  if (r < 0.90) return "epic";
  if (r < 0.96) return "mythic";
  if (r < 0.99) return "legendary";
  return "godly";
}

// Evolution stages, CONSTRAINED by rarity headroom: every later stage must
// climb one rarity rung, so a higher base rarity allows fewer stages.
// We still cap evolution lines at 3 stages.
function rollStages(rarity) {
  const headroom = RARITY_LADDER.length - rarityIndex(rarity); // rungs available incl. self
  const maxStages = Math.min(3, headroom);
  // weight toward fewer stages, but allow the max
  const weights = [];
  for (let s = 1; s <= maxStages; s++) weights.push({ s, w: maxStages - s + 1 });
  const total = weights.reduce((a, b) => a + b.w, 0);
  let roll = Math.random() * total;
  for (const { s, w } of weights) {
    if (roll < w) return s;
    roll -= w;
  }
  return 1;
}

function rollBoon(rarity) {
  const ri = rarityIndex(rarity);
  // boons available at this rarity or below; higher rarity = more likely a real boon
  const pool = BOONS.filter((b) => rarityIndex(b.min) <= ri);
  // low rarities mostly get "none"; high rarities weight toward the strong end
  if (ri <= 1 && Math.random() < 0.6) return BOONS[0];
  const startBias = ri >= 4 ? Math.floor(pool.length / 2) : 0;
  const idx = startBias + Math.floor(Math.random() * (pool.length - startBias));
  return pool[idx];
}

function rollEmphasis() {
  return STAT_EMPHASES[Math.floor(Math.random() * STAT_EMPHASES.length)];
}

// Roll a full forge result. `forced` can pin rarity/stages (starter forge).
function rollForge(forced) {
  const rarity = (forced && forced.rarity) || rollRarity();
  const stages = (forced && forced.stages) || rollStages(rarity);
  const emphasis = rollEmphasis();
  const boon = rollBoon(rarity);
  return { rarity, stages, emphasis, boon };
}



// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/artifacts+passives — run artifacts, sigil/combined bonuses
// ║ UPDATE WHEN: new bonus KEYS need wiring in makeFighter/playCard; new artifacts/sigils with existing keys are automatic
// ╚══════════════════════════════════════════════════════════════════╝
// ---------- Artifacts (run-scoped dungeon passives) ----------
// Found inside dungeons; empower the whole team; LOST when the run ends.
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
const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = (a) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

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
function buildFighterDeck(m) {
  let deck = [];
  // two copies of each signature card
  m.cards.forEach((c) => {
    deck.push({ ...c, cid: uid(), owner: m.name, element: c.element || m.element });
    deck.push({ ...c, cid: uid(), owner: m.name, element: c.element || m.element });
  });
  // a strike and a guard everyone shares
  UNIVERSAL_CARDS.slice(0, 2).forEach((c) =>
    deck.push({ ...c, cid: uid(), owner: "Any", element: null })
  );
  return shuffle(deck);
}

// Turn a team monster into a battle fighter with its own HP and deck.
// startHp lets HP carry over between fights within a run.
function makeFighter(m, bonus, startHp, team) {
  const formDef = FORMS[m.form || "regular"] || FORMS.regular;
  const maxHp = Math.round(m.maxHp * formDef.hpMult) + (bonus.maxHpBonus || 0);
  const hp = startHp == null ? maxHp : clamp(startHp, 0, maxHp);
  const boon = m.boon && m.boon.effect ? m.boon.effect : {};
  // synergy: +1 Strength for each OTHER teammate sharing this element
  let synergy = 0;
  if (team && team.length) {
    const myEls = m.elements && m.elements.length ? m.elements : [m.element];
    synergy = team.filter((t) => {
      if (t.uid === m.uid) return false;
      const tEls = t.elements && t.elements.length ? t.elements : [t.element];
      return tEls.some((e) => myEls.includes(e));
    }).length;
  }
  return {
    uid: m.uid,
    name: m.name,
    element: m.element,
    sprite: m.sprite,
    svg: m.svg,
    imageUrl: m.imageUrl,
    maxHp,
    hp,
    block: boon.startBlock || 0,
    str: (bonus.startStrength || 0) + (boon.startStrength || 0) + synergy + (formDef.str || 0),
    form: m.form || "regular",
    elements: m.elements && m.elements.length ? m.elements : [m.element],
    synergy,
    boon: m.boon || null,
    firstCardThisTurn: true,
    drawPile: buildFighterDeck(m),
    hand: [],
    discard: [],
  };
}

// ---------- Map (Slay the Spire style branching paths) ----------
const NODE_TYPES = {
  fight: { icon: "⚔️", label: "Battle", color: "#ff8a4d" },
  elite: { icon: "💀", label: "Elite", color: "#ff5a4d" },
  treasure: { icon: "💎", label: "Treasure", color: "#5fd0e0" },
  mystery: { icon: "❓", label: "Mystery", color: "#a571ff" },
  shop: { icon: "🛒", label: "Shop", color: "#ffd34d" },
  rest: { icon: "🔥", label: "Rest", color: "#7ee787" },
  boss: { icon: "🐉", label: "Boss", color: "#ff4dd2" },
};

// Generate a layered DAG: ROWS rows, each with a few nodes, edges only
// to the next row. Row 0 is the start fight, last row is the boss.
function generateMap(rows = 9) {
  const layout = [];
  for (let r = 0; r < rows; r++) {
    let count;
    if (r === 0) count = 1;
    else if (r === rows - 1) count = 1; // boss
    else count = 2 + Math.floor(Math.random() * 3); // 2-4
    const row = [];
    for (let i = 0; i < count; i++) {
      row.push({
        id: `${r}-${i}`,
        row: r,
        col: i,
        type: pickNodeType(r, rows),
        edges: [],
        visited: false,
      });
    }
    layout.push(row);
  }
  // connect each node to 1-2 nodes in the next row, keeping it roughly aligned
  for (let r = 0; r < rows - 1; r++) {
    const cur = layout[r];
    const nxt = layout[r + 1];
    cur.forEach((node, i) => {
      const frac = cur.length === 1 ? 0.5 : i / (cur.length - 1);
      const targetCenter = Math.round(frac * (nxt.length - 1));
      const links = new Set();
      links.add(clamp(targetCenter, 0, nxt.length - 1));
      if (Math.random() < 0.5) links.add(clamp(targetCenter + (Math.random() < 0.5 ? 1 : -1), 0, nxt.length - 1));
      node.edges = [...links];
    });
    // ensure every next-row node has at least one incoming edge
    nxt.forEach((_, j) => {
      const hasIncoming = cur.some((n) => n.edges.includes(j));
      if (!hasIncoming) {
        // attach to nearest current node
        const frac = nxt.length === 1 ? 0.5 : j / (nxt.length - 1);
        const src = clamp(Math.round(frac * (cur.length - 1)), 0, cur.length - 1);
        cur[src].edges.push(j);
      }
    });
  }
  return layout;
}

function pickNodeType(r, rows) {
  if (r === 0) return "fight";
  if (r === rows - 1) return "boss";
  if (r === rows - 2) return "rest"; // a rest before the boss
  const roll = Math.random();
  // weight types; elites and shops rarer
  if (roll < 0.40) return "fight";
  if (roll < 0.55) return "mystery";
  if (roll < 0.68) return "treasure";
  if (roll < 0.80) return "rest";
  if (roll < 0.90) return "elite";
  return "shop";
}

// ---------- Overworld (Pokémon-style tile map) ----------
// Tiles: 0 grass, 1 tall grass (wild encounters), 2 water (blocked),
// 3 tree/wall (blocked), 4 path. Special features sit on top of walkable
// tiles: shop, inn (rest), dungeon entrances.
const OW_W = 12;
const OW_H = 10;

function generateOverworld() {
  // base: mostly grass with a water border feature and scattered trees
  const tiles = [];
  for (let y = 0; y < OW_H; y++) {
    const row = [];
    for (let x = 0; x < OW_W; x++) {
      let t = 0; // grass
      // a lake in the bottom-right
      if (x >= OW_W - 3 && y >= OW_H - 3) t = 2;
      // a river column
      else if (x === 3 && y > 1 && y < OW_H - 2) t = 2;
      // scattered trees
      else if (Math.random() < 0.10) t = 3;
      row.push(t);
    }
    tiles.push(row);
  }
  // carve two tall-grass patches
  const patch = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (x >= 0 && x < OW_W && y >= 0 && y < OW_H && tiles[y][x] !== 2) tiles[y][x] = 1;
  };
  patch(7, 2, 1);
  patch(2, 6, 1);

  // a bridge across the river so the map is traversable
  tiles[Math.floor(OW_H / 2)][3] = 4;

  const start = { x: 1, y: 1 };
  tiles[start.y][start.x] = 0;

  // features placed on walkable tiles
  const features = [
    { type: "den", x: 1, y: 2, icon: "🏠", label: "Your Den" },
    { type: "npc", npc: "professor", x: 3, y: 1, icon: "🧑‍🔬", label: "Professor Bramble" },
    { type: "npc", npc: "rival", x: 7, y: 3, icon: "🧑‍🎤", label: "Kael (rival)" },
    { type: "shop", x: 5, y: 1, icon: "🛒", label: "Town Shop" },
    { type: "inn", x: 9, y: 1, icon: "🏨", label: "Inn (Rest)" },
    { type: "dungeon", x: 8, y: 4, icon: "🏚️", label: "Ruins", depth: 1 },
    { type: "dungeon", x: 2, y: 8, icon: "🗻", label: "Cavern", depth: 2 },
    { type: "dungeon", x: 6, y: 7, icon: "🏯", label: "Citadel", depth: 3 },
  ];
  // make sure feature tiles are walkable grass
  features.forEach((f) => (tiles[f.y][f.x] = 0));

  return { tiles, features, start };
}

function featureAt(ow, x, y) {
  return ow.features.find((f) => f.x === x && f.y === y) || null;
}
function isWalkable(ow, x, y) {
  if (x < 0 || x >= OW_W || y < 0 || y >= OW_H) return false;
  const t = ow.tiles[y][x];
  return t !== 2 && t !== 3; // not water, not tree
}

// ============================================================
// COMPONENT
// ============================================================

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/quests — NPCs + quest chains. UPDATE WHEN: new stats
// ║ exist to quest against; new NPCs need an overworld feature + dialog;
// ║ quest state is PERSISTENT (serializeSave/hydrateSave must carry it).
// ╚══════════════════════════════════════════════════════════════════╝
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
// ║ MODULE: app/main — ALL state + game logic handlers
// ║ UPDATE WHEN: every new system: state here, handlers here; check scope-leak (components only see PROPS); reward/afterWin hooks; egg ticking; stats/achievements
// ╚══════════════════════════════════════════════════════════════════╝
export default function ChimeraCards() {
  const [screen, setScreen] = useState("title"); // title | collection | compendium | generate | fuse | items | battle | reward
  // Start with the six tier-1 commons; the rest are discovered through play.
  // The journey begins with the starter choice: the collection starts empty.
  const [collection, setCollection] = useState([]);
  // Compendium: every species name the player has ever owned or defeated.
  const [seen, setSeen] = useState(() => new Set());
  const [items, setItems] = useState(["beastball", "beastball", "beastball"]); // owned item ids
  const [materials, setMaterials] = useState({}); // crafting materials {id: count}
  const [runArtifacts, setRunArtifacts] = useState([]); // dungeon-run artifacts (lost when the run ends)
  const [seenMaterials, setSeenMaterials] = useState(() => new Set()); // discovered materials
  const [knownRecipes, setKnownRecipes] = useState(() => new Set(["beastball"])); // learned recipes
  const [stats, setStats] = useState({ battlesWon: 0, bossesSlain: 0, monstersCaptured: 0, monstersTransmuted: 0, itemsCrafted: 0 });
  const [achDone, setAchDone] = useState(() => new Set()); // completed achievements
  const [eggs, setEggs] = useState([]); // breeding eggs: {id, template, eggCard, hatchIn}
  const [activeQuests, setActiveQuests] = useState([]); // accepted quest ids
  const [doneQuests, setDoneQuests] = useState(() => new Set()); // turned in
  const [npcCtx, setNpcCtx] = useState(null); // npc id being talked to
  const [baseScreen, setBaseScreen] = useState("den"); // where ↩ Return leads (den/overworld/map)
  const [iconArt, setIconArt] = useState({}); // generated art: {"item:<id>"|"move:<id>": svg | "…"}
  const saveReady = useRef(false); // becomes true after load attempt completes
  function paintIcon(kind, id, name, desc) {
    const key = `${kind}:${id}`;
    if (iconArt[key] === "…") return;
    setIconArt((a) => ({ ...a, [key]: "…" }));
    (async () => {
      const svg = await generateIconArt({ name, kind, desc });
      setIconArt((a) => { const n = { ...a }; if (svg) n[key] = svg; else delete n[key]; return n; });
      if (!svg) flash("Icon art failed (need an API key outside Claude).");
    })();
  }
  useEffect(() => { if (["den", "overworld", "map"].includes(screen)) setBaseScreen(screen); }, [screen]);
  const [seenItems, setSeenItems] = useState(() => new Set(["beastball"])); // every item ever obtained
  const [team, setTeam] = useState([]); // up to 3 uids
  const [battle, setBattle] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingReward, setPendingReward] = useState(null);
  // ----- run state (one dungeon run) -----
  const [runMap, setRunMap] = useState(null); // 2D array of nodes
  const [runRow, setRunRow] = useState(-1); // current row reached (-1 = not started)
  const [runCol, setRunCol] = useState(null); // current node col
  const [runHp, setRunHp] = useState({}); // uid -> current hp, persists across fights
  const [activeNode, setActiveNode] = useState(null); // node being resolved
  const [gold, setGold] = useState(0);
  // ----- overworld state -----
  const [overworld] = useState(() => generateOverworld());
  const [playerPos, setPlayerPos] = useState(() => overworld.start);
  const [shopCtx, setShopCtx] = useState({ deep: false }); // where a shop was opened from
  const [wildBattle, setWildBattle] = useState(false); // is current battle a wild encounter?
  const [returnScreen, setReturnScreen] = useState("overworld"); // where to go after rest/shop/wild

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Add an item to the bag and mark it discovered for the Codex.
  function grantItem(id) {
    setItems((arr) => [...arr, id]);
    setSeenItems((s) => (s.has(id) ? s : new Set(s).add(id)));
  }

  // Add a {materialId: qty} map into the player's stash, marking discovery.
  function grantMaterials(drops) {
    const ids = Object.keys(drops || {});
    if (ids.length === 0) return;
    setMaterials((m) => {
      const next = { ...m };
      ids.forEach((id) => (next[id] = (next[id] || 0) + drops[id]));
      return next;
    });
    setSeenMaterials((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  // Teach the player a crafting recipe (by crafted item id).
  function learnRecipe(itemId) {
    setKnownRecipes((s) => {
      if (s.has(itemId)) return s;
      const it = ITEMS.find((x) => x.id === itemId);
      flash(`📜 Recipe learned: ${it ? it.name : itemId}!`);
      return new Set(s).add(itemId);
    });
  }

  // Increment a stat counter; completed achievements teach their recipe.
  function bumpStat(key, n = 1) {
    setStats((prev) => {
      const next = { ...prev, [key]: (prev[key] || 0) + n };
      // check achievements against the NEW totals
      setAchDone((doneSet) => {
        let done = doneSet;
        ACHIEVEMENTS.forEach((a) => {
          if (!done.has(a.id) && a.check(next)) {
            if (done === doneSet) done = new Set(doneSet);
            done.add(a.id);
            setTimeout(() => {
              flash(`🏆 Feat: ${a.label}!`);
              learnRecipe(a.recipe);
            }, 50);
          }
        });
        return done;
      });
      return next;
    });
  }

  // Destroy a captured monster for materials, rolled from its chance table
  // with exploding repeats. Guards: never the last monster; removed from team.
  function transmuteMonster(m) {
    if (collection.length <= 1) {
      flash("You can't transmute your last monster.");
      return;
    }
    const yieldMap = rollTransmute(transmuteTable(m));
    setTeam((t) => t.filter((uid) => uid !== m.uid));
    setCollection((c) => c.filter((x) => x.uid !== m.uid));
    grantMaterials(yieldMap);
    bumpStat("monstersTransmuted");
    const got = Object.keys(yieldMap);
    if (got.length === 0) {
      flash(`${m.name} transmuted... into nothing. The rolls were cruel.`);
    } else {
      const summary = got.map((id) => `${yieldMap[id]}× ${materialById(id).name}`).join(", ");
      flash(`${m.name} transmuted into: ${summary}`);
    }
  }

  // Craft a recipe into a real item. Requires knowing the recipe.
  function craftItem(recipe) {
    if (!knownRecipes.has(recipe.item)) {
      flash("You haven't learned this recipe yet.");
      return;
    }
    const check = canCraft(recipe, materials);
    if (!check.ok) {
      flash("Missing materials.");
      return;
    }
    setMaterials((m) => consumeRecipe(recipe, m));
    grantItem(recipe.item);
    bumpStat("itemsCrafted");
    const it = ITEMS.find((x) => x.id === recipe.item);
    flash(`Crafted ${it ? it.name : recipe.item}!`);
  }

  // ---------- Move Tutor ----------
  const TYPE_MOVE_COST = 80; // gold
  const SPECIAL_MOVE_COST = 120; // gold + an Ancient Tome
  const TRANSFER_GOLD = 400; // deliberately prohibitive
  function addMoveTo(uid2, move, tag) {
    setCollection((c) => c.map((m) => (m.uid === uid2 ? { ...m, cards: [...m.cards, { ...move, [tag]: true }] } : m)));
  }
  function learnTypeMove(mon, move) {
    if (mon.cards.length >= MOVE_CAP) { flash(`Moveset full (${MOVE_CAP} max). Forget or transfer a move first.`); return; }
    if (mon.cards.some((c) => c.id === move.id)) { flash("Already known."); return; }
    if (gold < TYPE_MOVE_COST) { flash(`Costs ${TYPE_MOVE_COST} gold.`); return; }
    setGold((g) => g - TYPE_MOVE_COST);
    addMoveTo(mon.uid, move, "learned");
    flash(`${mon.name} learned ${move.name}!`);
  }
  function learnSpecialMove(mon, move) {
    if (mon.cards.length >= MOVE_CAP) { flash(`Moveset full (${MOVE_CAP} max). Forget or transfer a move first.`); return; }
    if (mon.cards.some((c) => c.id === move.id)) { flash("Already known."); return; }
    if (!items.includes("ancienttome")) { flash("Requires an Ancient Tome."); return; }
    if (gold < SPECIAL_MOVE_COST) { flash(`Costs ${SPECIAL_MOVE_COST} gold + an Ancient Tome.`); return; }
    setGold((g) => g - SPECIAL_MOVE_COST);
    setItems((arr) => { const i = arr.indexOf("ancienttome"); return [...arr.slice(0, i), ...arr.slice(i + 1)]; });
    addMoveTo(mon.uid, move, "learned");
    flash(`📕 The tome crumbles. ${mon.name} learned ${move.name}!`);
  }
  function forgetMove(mon, idx) {
    const card = mon.cards[idx];
    if (!card || (!card.learned && !card.transferred)) { flash("Signature and egg moves can't be forgotten."); return; }
    setCollection((c) => c.map((m) => (m.uid === mon.uid ? { ...m, cards: m.cards.filter((_, i) => i !== idx) } : m)));
    flash(`${mon.name} forgot ${card.name}.`);
  }
  // Move TRANSFER: rip any non-generic move (even a signature) out of one
  // monster and graft it onto another. Costly by design.
  function transferMove(donor, idx, recipient) {
    const card = donor.cards[idx];
    if (!card) return;
    if (donor.uid === recipient.uid) { flash("Pick two different monsters."); return; }
    if (donor.cards.length <= 1) { flash("A monster must keep at least one move."); return; }
    if (recipient.cards.length >= MOVE_CAP) { flash(`${recipient.name}'s moveset is full.`); return; }
    if (recipient.cards.some((c) => c.id === card.id)) { flash(`${recipient.name} already knows ${card.name}.`); return; }
    if (gold < TRANSFER_GOLD || (materials.primalcore || 0) < 1) {
      flash(`Transfer costs ${TRANSFER_GOLD} gold + 1 🔮 Primal Core.`); return;
    }
    setGold((g) => g - TRANSFER_GOLD);
    setMaterials((mm) => { const n = { ...mm, primalcore: mm.primalcore - 1 }; if (n.primalcore <= 0) delete n.primalcore; return n; });
    setCollection((c) => c.map((m) => {
      if (m.uid === donor.uid) return { ...m, cards: m.cards.filter((_, i) => i !== idx) };
      if (m.uid === recipient.uid) return { ...m, cards: [...m.cards, { ...card, transferred: true }] };
      return m;
    }));
    flash(`💸 ${card.name} transferred: ${donor.name} → ${recipient.name}.`);
  }
  // ---------- quests & NPCs ----------
  function acceptQuest(q) {
    setActiveQuests((a) => (a.includes(q.id) ? a : [...a, q.id]));
    flash(`📜 Quest accepted: ${q.title}`);
  }
  function turnInQuest(q) {
    if (!questProgress(q, stats, seen).done) return;
    setActiveQuests((a) => a.filter((id) => id !== q.id));
    setDoneQuests((d) => new Set(d).add(q.id));
    const r = q.reward || {};
    if (r.gold) setGold((g) => g + r.gold);
    if (r.item) grantItem(r.item);
    if (r.materials) grantMaterials(r.materials);
    SFX.victory();
    flash(`✅ ${q.title} complete!${r.gold ? ` +${r.gold}g` : ""}${r.item ? ` +${ITEMS.find((i) => i.id === r.item).name}` : ""}`);
  }
  // Rival battles: an elite-form opponent that scales with your record.
  function startRivalBattle() {
    const wins = stats.rivalWins || 0;
    const pool = DEFAULT_MONSTERS.filter((t) => (t.tier || 1) >= 2 && ["rare", "epic"].includes(t.rarity));
    const base = pool[Math.floor(Math.random() * pool.length)];
    const info = evolutionInfo(base);
    const form = formAllowed("elite", info) ? "elite" : "large";
    const hpScale = 1 + wins * 0.25;
    const enemy = makeMonster({ ...base, form, baseHp: base.hp, hp: Math.round(base.hp * FORMS[form].hpMult * hpScale) });
    enemy.intent = null;
    setSeen((sn) => new Set(sn).add(base.name));
    const bonus = combinedBonuses(runArtifacts, items);
    const fighters = teamMonsters.map((m) => makeFighter(m, bonus, runHp[m.uid], teamMonsters));
    setWildBattle(true);
    setBattle({
      floor: 1, isBoss: false, wild: true, rival: true, enemy,
      enemyHp: enemy.maxHp, enemyMaxHp: enemy.maxHp, enemyBlock: 0,
      enemyStatus: { burn: 0, weak: 0, vulnerable: 0, chill: 0, soak: 0, shock: 0, poison: 0, decay: 0 },
      teamShield: 0, fighters, activeIdx: Math.max(0, fighters.findIndex((f) => f.hp > 0)),
      hand: [], discard: [], energy: 3, turn: "player", over: null,
      log: [`${NPCS.rival.name} sends out ${enemy.name}!`], bonus,
    });
    setScreen("battle");
  }

  // Leaving the den requires a full squad of 3 (or everyone, if fewer).
  function leaveDen() {
    if (team.length < 1) { flash("Take at least one monster with you."); return; }
    enterOverworld(); // team max of 3 is enforced by the picker itself
  }

  // ---------- breeding ----------
  // Parents are KEPT (unlike fusion). The egg hatches into a BABY-form
  // stage-1 of parent A's line, inheriting one "egg move" from parent B.
  const BREED_COST = { vitalessence: 1, chimdust: 2 };
  function canBreed(mA, mB) {
    if (!mA || !mB || mA.uid === mB.uid) return { ok: false, why: "Pick two different monsters." };
    if (eggs.length >= 3) return { ok: false, why: "The nursery is full (3 eggs max). Win battles to hatch them." };
    const aEls = mA.elements && mA.elements.length ? mA.elements : [mA.element];
    const bEls = mB.elements && mB.elements.length ? mB.elements : [mB.element];
    const sharedEl = aEls.some((e) => bEls.includes(e));
    const lA = lineOf(mA.name);
    const sameLine = lA && lA.members.includes(mB.name);
    if (!sharedEl && !sameLine) return { ok: false, why: "Parents must share an element or an evolution line." };
    for (const id in BREED_COST) {
      if ((materials[id] || 0) < BREED_COST[id]) {
        return { ok: false, why: `Costs ${BREED_COST.vitalessence}× Vital Essence + ${BREED_COST.chimdust}× Chimera Dust.` };
      }
    }
    return { ok: true, why: null };
  }
  function breedPair(mA, mB) {
    const chk = canBreed(mA, mB);
    if (!chk.ok) { flash(chk.why); return; }
    // offspring species: stage-1 root of parent A's line (A is the "dam")
    const line = lineOf(mA.name);
    const rootName = line ? line.members[0] : mA.name;
    const tmpl = DEFAULT_MONSTERS.find((t) => t.name === rootName) ||
      { name: mA.name, element: mA.element, elements: mA.elements, hp: mA.baseHp || mA.maxHp, sprite: mA.sprite, rarity: mA.rarity, desc: mA.desc, lore: mA.lore, cards: mA.cards.map(({ cid, ...c }) => c) };
    // egg move: one random card inherited from parent B
    const pool = mB.cards || [];
    const inherited = pool[Math.floor(Math.random() * pool.length)];
    const eggCard = inherited ? { ...inherited, cid: undefined, id: `egg_${inherited.id}`, eggMove: true, element: mB.element } : null;
    setMaterials((m) => {
      const next = { ...m };
      for (const id in BREED_COST) { next[id] -= BREED_COST[id]; if (next[id] <= 0) delete next[id]; }
      return next;
    });
    const hatchIn = 2 + Math.max(0, rarityIndex(tmpl.rarity || "common"));
    setEggs((e) => [...e, { id: `egg${Date.now()}_${Math.floor(Math.random() * 999)}`, template: tmpl, eggCard, hatchIn, parents: `${mA.name} + ${mB.name}` }]);
    flash(`🥚 An egg! ${mA.name} and ${mB.name} produced a ${rootName} egg (hatches after ${hatchIn} wins).`);
  }
  // Hatch countdown: called on every battle win.
  function tickEggs() {
    const current = eggs;
    if (current.length === 0) return;
    const remaining = [];
    const hatched = [];
    current.forEach((egg) => {
      if (egg.hatchIn <= 1) hatched.push(egg);
      else remaining.push({ ...egg, hatchIn: egg.hatchIn - 1 });
    });
    setEggs(remaining);
    hatched.forEach((egg) => {
      const baby = makeMonster({ ...egg.template, svg: null, imageUrl: null, form: "baby" });
      if (egg.eggCard) baby.cards = [...baby.cards.slice(0, baby.cards.length - 1), { ...egg.eggCard, cid: `c${Date.now()}_${Math.floor(Math.random() * 9999)}` }];
      setCollection((c) => [...c, baby]);
      setSeen((sn) => new Set(sn).add(baby.name));
      flash(`🐣 Hatched: Baby ${baby.name}${egg.eggCard ? ` knowing ${egg.eggCard.name} 🥚` : ""}!`);
    });
  }

  const teamMonsters = team.map((id) => collection.find((m) => m.uid === id)).filter(Boolean);

  // ---------- persistence ----------
  function serializeSave() {
    return {
      v: 1, gold, collection, team, items, materials, eggs, stats,
      seen: [...seen], seenItems: [...seenItems], seenMaterials: [...seenMaterials],
      knownRecipes: [...knownRecipes], achDone: [...achDone],
      activeQuests, doneQuests: [...doneQuests],
    };
  }
  function hydrateSave(d) {
    if (!d || d.v !== 1) return false;
    setGold(d.gold || 0);
    setCollection(d.collection || []);
    setTeam(d.team || []);
    setItems(d.items || []);
    setMaterials(d.materials || {});
    setEggs(d.eggs || []);
    setStats(d.stats || { battlesWon: 0, bossesSlain: 0, monstersCaptured: 0, monstersTransmuted: 0, itemsCrafted: 0 });
    setSeen(new Set(d.seen || []));
    setSeenItems(new Set(d.seenItems || []));
    setSeenMaterials(new Set(d.seenMaterials || []));
    setKnownRecipes(new Set(d.knownRecipes && d.knownRecipes.length ? d.knownRecipes : ["beastball"]));
    setAchDone(new Set(d.achDone || []));
    setActiveQuests(d.activeQuests || []);
    setDoneQuests(new Set(d.doneQuests || []));
    return true;
  }
  // load once on boot
  useEffect(() => {
    (async () => {
      const d = await storeGet();
      if (d) {
        const ok = hydrateSave(d);
        if (ok) flash("💾 Save loaded. Welcome back!");
      }
      saveReady.current = true;
    })();
    // eslint-disable-next-line
  }, []);
  // debounced auto-save on meaningful state changes
  useEffect(() => {
    if (!saveReady.current || collection.length === 0) return;
    const t = setTimeout(() => {
      const d = serializeSave();
      let json = JSON.stringify(d);
      if (json.length > 4500000) {
        // size guard: drop generated art before dropping the save entirely
        d.collection = d.collection.map((m) => ({ ...m, svg: null }));
      }
      storeSet(d);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [gold, collection, team, items, materials, eggs, stats, seen, seenItems, seenMaterials, knownRecipes, achDone]);
  function resetGame() {
    storeClear();
    setGold(0); setCollection([]); setTeam([]); setItems(["beastball", "beastball", "beastball"]);
    setMaterials({}); setEggs([]); setRunArtifacts([]); setBattle(null);
    setStats({ battlesWon: 0, bossesSlain: 0, monstersCaptured: 0, monstersTransmuted: 0, itemsCrafted: 0 });
    setSeen(new Set()); setSeenItems(new Set()); setSeenMaterials(new Set());
    setKnownRecipes(new Set(["beastball"])); setAchDone(new Set());
    setActiveQuests([]); setDoneQuests(new Set());
    setScreen("title");
    flash("New game. The world resets.");
  }

  // Paint the starter roster in the gallery style once, on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targets = collection.filter((m) => !m.svg);
      for (const m of targets) {
        const svg = await generateArt({ name: m.name, element: m.element, desc: m.desc, lore: m.lore });
        if (cancelled || !svg) continue;
        setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, []);
  // ---------- Overworld ----------
  function enterOverworld() {
    if (teamMonsters.length === 0) {
      flash("Pick at least one monster for your team first.");
      setScreen("collection");
      return;
    }
    // refill HP when (re)entering the overworld from base
    const hp = {};
    teamMonsters.forEach((m) => (hp[m.uid] = m.maxHp));
    setRunHp(hp);
    setScreen("overworld");
  }

  // Attempt to move the player by (dx,dy). Handles walls, features, and
  // wild encounters in tall grass.
  function movePlayer(dx, dy) {
    setPlayerPos((pos) => {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (!isWalkable(overworld, nx, ny)) return pos;
      const newPos = { x: nx, y: ny };
      const feat = featureAt(overworld, nx, ny);
      if (feat) {
        setTimeout(() => interactFeature(feat), 0);
      } else if (overworld.tiles[ny][nx] === 1) {
        if (Math.random() < 0.22) setTimeout(() => startWildEncounter(), 0);
      }
      return newPos;
    });
  }

  function interactFeature(feat) {
    SFX.step();
    if (feat.type === "den") {
      setScreen("den");
      return;
    }
    if (feat.type === "npc") {
      setNpcCtx(feat.npc);
      setScreen("talk");
      return;
    }
    if (feat.type === "shop") {
      setShopCtx({ deep: false });
      setReturnScreen("overworld");
      setScreen("shop");
    } else if (feat.type === "inn") {
      setReturnScreen("overworld");
      setScreen("rest");
    } else if (feat.type === "dungeon") {
      startDungeon(feat.depth || 1);
    }
  }

  // A single wild battle (not a full dungeon run). HP carries from overworld.
  function startWildEncounter() {
    const maxTier = 2;
    const pool = DEFAULT_MONSTERS.filter((t) => (t.tier || 1) <= maxTier);
    const base = pool[Math.floor(Math.random() * pool.length)];
    const painted = collection.find((m) => m.name === base.name && m.svg);
    const wform = rollEnemyForm(evolutionInfo(base), {});
    const enemy = makeMonster({ ...base, svg: painted ? painted.svg : null, form: wform, baseHp: base.hp, hp: Math.round(base.hp * FORMS[wform].hpMult) });
    enemy.intent = null;
    setSeen((s) => new Set(s).add(base.name));

    const bonus = combinedBonuses(runArtifacts, items);
    const fighters = teamMonsters.map((m) => makeFighter(m, bonus, runHp[m.uid], teamMonsters));
    setWildBattle(true);
    setBattle({
      floor: 1,
      isBoss: false,
      wild: true,
      enemy,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      enemyBlock: 0,
      enemyStatus: { burn: 0, weak: 0, vulnerable: 0, chill: 0, soak: 0, shock: 0, poison: 0, decay: 0 },
      teamShield: 0,
      fighters,
      activeIdx: Math.max(0, fighters.findIndex((f) => f.hp > 0)),
      swappedThisTurn: false,
      energy: 3 + bonus.energyBonus,
      maxEnergy: 3 + bonus.energyBonus,
      bonus,
      potions: items.filter((id) => (ITEMS.find((it) => it.id === id) || {}).kind === "potion"),
      log: [`A wild ${enemy.name} appeared!`],
      turn: "player",
      over: null,
    });
    setScreen("battle");
    setTimeout(() => drawHand(5 + bonus.drawBonus), 50);
  }

  function startDungeon(depth = 1) {
    if (teamMonsters.length === 0) {
      flash("Pick at least one monster for your team first.");
      setScreen("collection");
      return;
    }
    // deeper dungeons have more floors
    const rows = depth === 3 ? 11 : depth === 2 ? 10 : 8;
    setRunArtifacts([]); // a fresh run starts with no artifacts
    const map = generateMap(rows);
    map._depth = depth;
    setRunMap(map);
    setRunRow(-1);
    setRunCol(null);
    // HP carries over from the overworld; do NOT refill here
    setScreen("map");
  }

  // Player taps a node on the map. Resolve it by type.
  function chooseNode(node) {
    setActiveNode(node);
    setRunRow(node.row);
    setRunCol(node.col);
    if (node.type === "fight" || node.type === "elite" || node.type === "boss") {
      beginBattle(node);
    } else if (node.type === "rest") {
      setReturnScreen("map");
      setScreen("rest");
    } else if (node.type === "shop") {
      awardProgress({ shops: 1 });
      setShopCtx({ deep: true, depth: (runMap && runMap._depth) || 1 });
      setReturnScreen("map");
      setScreen("shop");
    } else if (node.type === "treasure") {
      resolveTreasure();
    } else if (node.type === "mystery") {
      setScreen("mystery");
    }
  }

  // Mark the current node visited and return to the map for the next pick.
  function returnToMap() {
    if (runMap && activeNode) {
      setRunMap((m) =>
        m.map((row) => row.map((n) => (n.id === activeNode.id ? { ...n, visited: true } : n)))
      );
    }
    setActiveNode(null);
    setPendingReward(null);
    // boss cleared = run complete
    if (activeNode && activeNode.type === "boss") {
      flash("You cleared the dungeon! Your artifacts crumble as you leave.");
      setRunArtifacts([]);
      setBattle(null);
      // save HP back so it carries to the overworld
      setScreen("overworld");
      return;
    }
    setScreen("map");
  }

  function beginBattle(node) {
    const floor = node.row + 1;
    const isElite = node.type === "elite";
    const isBoss = node.type === "boss";
    const maxTier = isBoss ? 3 : floor < 3 ? 1 : floor < 6 ? 2 : 3;
    const pool = DEFAULT_MONSTERS.filter((t) => (t.tier || 1) <= maxTier);
    let base;
    if (isBoss) {
      // boss is a random legendary/rare if available
      const bossPool = DEFAULT_MONSTERS.filter((t) => t.rarity === "legendary" || t.tier === 3);
      base = bossPool[Math.floor(Math.random() * bossPool.length)] || pool[0];
    } else {
      base = pool[Math.floor(Math.random() * pool.length)];
    }
    const painted = collection.find((m) => m.name === base.name && m.svg);
    const scale = 1 + (floor - 1) * 0.28;
    // form replaces the old elite/boss multiplier AND the name prefix
    const form = rollEnemyForm(evolutionInfo(base), { elite: isElite, boss: isBoss });
    const mult = FORMS[form].hpMult;
    const enemy = makeMonster({
      ...base,
      svg: painted ? painted.svg : null,
      form,
      baseHp: base.hp,
      hp: Math.round(base.hp * scale * mult),
    });
    enemy.intent = null;
    setSeen((s) => new Set(s).add(base.name));

    const bonus = combinedBonuses(runArtifacts, items);
    // build fighters using carried-over HP from the run
    const fighters = teamMonsters.map((m) => makeFighter(m, bonus, runHp[m.uid], teamMonsters));

    setBattle({
      floor,
      isBoss,
      enemy,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      enemyBlock: 0,
      enemyStatus: { burn: 0, weak: 0, vulnerable: 0, chill: 0, soak: 0, shock: 0, poison: 0, decay: 0 },
      teamShield: 0,
      fighters,
      activeIdx: Math.max(0, fighters.findIndex((f) => f.hp > 0)),
      swappedThisTurn: false,
      energy: 3 + bonus.energyBonus,
      maxEnergy: 3 + bonus.energyBonus,
      bonus,
      potions: items.filter((id) => (ITEMS.find((it) => it.id === id) || {}).kind === "potion"),
      log: [`A ${enemy.name} appears!`],
      turn: "player",
      over: null,
    });
    setScreen("battle");
    setTimeout(() => drawHand(5 + bonus.drawBonus), 50);
  }

  // ---------- battle mechanics ----------
  function setEnemyIntent(b) {
    const roll = Math.random();
    if (roll < 0.6) {
      const dmg = Math.round(4 + b.floor * 1.6 + Math.random() * 4);
      return { kind: "attack", value: dmg };
    } else if (roll < 0.85) {
      return { kind: "block", value: Math.round(5 + b.floor) };
    }
    return { kind: "buff", value: 2 };
  }

  // Helper: immutably update the active fighter inside a battle object.
  function updateActive(nb, fn) {
    const fighters = nb.fighters.map((f, i) => (i === nb.activeIdx ? fn({ ...f }) : f));
    return { ...nb, fighters };
  }

  function drawHand(n) {
    setBattle((b) => {
      if (!b) return b;
      const f = b.fighters[b.activeIdx];
      let draw = [...f.drawPile];
      let discard = [...f.discard];
      let hand = [...f.hand];
      for (let i = 0; i < n; i++) {
        if (draw.length === 0) {
          draw = shuffle(discard);
          discard = [];
        }
        if (draw.length === 0) break;
        hand.push(draw.shift());
      }
      const intent = b.enemy.intent || setEnemyIntent(b);
      const nb = updateActive(b, (af) => ({ ...af, drawPile: draw, discard, hand }));
      return { ...nb, enemy: { ...b.enemy, intent } };
    });
  }

  // Swap the active monster. Free action, once per turn. The outgoing
  // monster keeps its HP and block; the incoming one draws a fresh hand.
  function swapTo(idx) {
    setBattle((b) => {
      if (!b || b.over || b.turn !== "player") return b;
      if (idx === b.activeIdx) return b;
      if (b.swappedThisTurn) return b;
      const target = b.fighters[idx];
      if (!target || target.hp <= 0) return b;
      // stash current hand into its own discard
      let nb = updateActive(b, (af) => ({ ...af, discard: [...af.discard, ...af.hand], hand: [] }));
      nb = { ...nb, activeIdx: idx, swappedThisTurn: true };
      nb.log = [...nb.log, `${target.name} swaps in!`].slice(-6);
      // swap-in boons
      const tboon = target.boon && target.boon.effect ? target.boon.effect : {};
      if (tboon.swapEnergy) nb.energy += tboon.swapEnergy;
      const extraDraw = tboon.swapDraw || 0;
      const drawN = 5 + ((nb.bonus && nb.bonus.drawBonus) || 0) + extraDraw;
      setTimeout(() => drawHand(drawN), 40);
      return nb;
    });
  }

  function playCard(card) {
    setBattle((b) => {
      if (!b || b.turn !== "player" || b.over) return b;
      const active0 = b.fighters[b.activeIdx];
      const boon = active0.boon && active0.boon.effect ? active0.boon.effect : {};
      const bonus = b.bonus || {};
      // firstFree (boon or Solar Disk sigil): first card each turn costs 0
      const effectiveCost = (boon.firstFree || bonus.firstFree) && active0.firstCardThisTurn ? 0 : card.cost;
      if (effectiveCost > b.energy) return b;
      let nb = { ...b, energy: b.energy - effectiveCost };
      let log = [...nb.log];
      const active = nb.fighters[nb.activeIdx];

      // mark first card used this turn
      nb = updateActive(nb, (af) => ({ ...af, firstCardThisTurn: false }));

      // remove card from active hand. exhaust cards leave the deck entirely;
      // others go to the discard. (retain is handled at end of turn.)
      nb = updateActive(nb, (af) => ({
        ...af,
        hand: af.hand.filter((c) => c.cid !== card.cid),
        discard: card.exhaust ? af.discard : [...af.discard, card],
        exhausted: card.exhaust ? [...(af.exhausted || []), card] : af.exhausted || [],
      }));

      // damage (Strength, then enemy Vulnerable, then element effectiveness)
      const atkEl = card.element || active.element;
      const eff = defenseMultiplier(atkEl, nb.enemy);
      if (card.dmg) {
        const vuln = nb.enemyStatus.vulnerable > 0;
        const hits = card.hits || 1;
        let enemyHp = nb.enemyHp;
        let enemyBlock = nb.enemyBlock;
        let perHit = card.dmg + active.str + (bonus.dmgBonus || 0);
        if (vuln) perHit = Math.round(perHit * 1.5);
        if (eff !== 1) perHit = Math.round(perHit * eff);
        for (let h = 0; h < hits; h++) {
          let dmg = perHit;
          if (enemyBlock > 0) {
            const a = Math.min(enemyBlock, dmg);
            enemyBlock -= a;
            dmg -= a;
          }
          enemyHp = clamp(enemyHp - dmg, 0, nb.enemyMaxHp);
        }
        nb.enemyHp = enemyHp;
        nb.enemyBlock = enemyBlock;
        const effTxt = eff > 1 ? " super effective!" : eff < 1 ? " resisted" : "";
        nb.lastEff = eff; // for a UI flash
        log.push(`${active.name}'s ${card.name}: ${perHit}${hits > 1 ? ` x${hits}` : ""} dmg${vuln ? " (vuln)" : ""}${effTxt}.`);
      }
      if (card.block) {
        const blk = card.block + (bonus.blockBonus || 0);
        nb = updateActive(nb, (af) => ({ ...af, block: af.block + blk }));
        log.push(`${active.name} gains ${blk} block.`);
      }
      // team-wide Shield: persists across swaps, resets each of your turns
      if (card.shield) {
        nb.teamShield = (nb.teamShield || 0) + card.shield;
        log.push(`Team gains ${card.shield} Shield.`);
      }
      if (card.strength) {
        nb = updateActive(nb, (af) => ({ ...af, str: af.str + card.strength }));
        log.push(`${active.name} gains ${card.strength} Strength.`);
      }
      // immediate team heal
      if (card.teamheal) {
        nb = { ...nb, fighters: nb.fighters.map((f) => (f.hp > 0 ? { ...f, hp: clamp(f.hp + card.teamheal, 0, f.maxHp) } : f)) };
        log.push(`Whole team heals ${card.teamheal} HP.`);
      }
      // regen: active monster gains a heal-over-time stack
      if (card.regen) {
        nb = updateActive(nb, (af) => ({ ...af, regenStacks: (af.regenStacks || 0) + card.regen }));
        log.push(`${active.name} gains ${card.regen} Regen.`);
      }
      // gain energy this turn
      if (card.energy) {
        nb.energy += card.energy;
        log.push(`+${card.energy} energy.`);
      }
      // status application; the attacker's element affinity boosts its own
      // status by +1. New statuses: chill, soak, shock, poison, decay.
      const affinity = ELEMENT_AFFINITY[atkEl]; // e.g. "burn", "poison", ...
      const addStatus = (key, amt) => {
        if (!amt) return;
        const boost = affinity === key ? 1 : 0;
        nb.enemyStatus = { ...nb.enemyStatus, [key]: (nb.enemyStatus[key] || 0) + amt + boost };
      };
      addStatus("burn", card.burn);
      addStatus("weak", card.weak);
      addStatus("vulnerable", card.vulnerable);
      addStatus("chill", card.chill);
      addStatus("soak", card.soak);
      addStatus("shock", card.shock);
      addStatus("poison", card.poison);
      addStatus("decay", card.decay);
      // Blood: Leech heals the active monster for a share of damage dealt
      if (card.leech && card.dmg) {
        const heal = Math.max(1, Math.round((card.dmg + active.str) * 0.5));
        nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + heal, 0, af.maxHp) }));
        log.push(`${active.name} leeches ${heal} HP.`);
      }

      // ----- REACTIONS: attack element vs the enemy's existing statuses -----
      const reaction = findReaction(atkEl, nb.enemyStatus);
      if (reaction) {
        const es = { ...nb.enemyStatus };
        switch (reaction.id) {
          case "shatter": {
            const dmg = 8 + active.str;
            nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
            es.chill = 0;
            log.push(`Shatter! +${dmg} burst, Chill consumed.`);
            break;
          }
          case "steam": {
            es.soak = 0;
            es.vulnerable = (es.vulnerable || 0) + 2;
            log.push(`Steam! Soak burns off, +2 Vulnerable.`);
            break;
          }
          case "conduct": {
            es.shock = (es.shock || 0) + 2; // electrified water amps shock
            log.push(`Conduct! Shock surges through the water.`);
            break;
          }
          case "combust": {
            const stacks = es.poison || 0;
            const dmg = stacks * 3;
            nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
            es.poison = 0;
            log.push(`Combust! Poison detonates for ${dmg}.`);
            break;
          }
          case "spread": {
            es.poison = (es.poison || 0) + 2;
            log.push(`Spread! Poison washes wider (+2).`);
            break;
          }
          case "brittle": {
            es.burn = 0;
            es.chill = (es.chill || 0) + 3;
            log.push(`Brittle! Burn quenched, +3 Chill.`);
            break;
          }
          case "corrode": {
            nb.enemyBlock = 0;
            log.push(`Corrode! Enemy block stripped.`);
            break;
          }
          case "consume": {
            // eat one status, draw a card and heal a little
            const order = ["burn", "poison", "decay", "vulnerable", "shock", "soak", "chill"];
            const hit = order.find((s) => (es[s] || 0) > 0);
            if (hit) es[hit] = 0;
            nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + 4, 0, af.maxHp) }));
            log.push(`Consume! Devoured ${hit}, drew a card.`);
            setTimeout(() => drawHand(1), 30);
            break;
          }
          case "hemorrhage":
          case "hemorrhage2": {
            const heal = 6 + active.str;
            nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + heal, 0, af.maxHp) }));
            log.push(`Hemorrhage! Leeched ${heal} from the wound.`);
            break;
          }
          default:
            break;
        }
        nb.enemyStatus = es;
        nb.lastReaction = reaction.label;
      }
      nb.log = log.slice(-6);

      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...nb.log, `${nb.enemy.name} is defeated!`].slice(-6);
      }
      if (card.draw) setTimeout(() => drawHand(card.draw), 30);
      return nb;
    });
  }

  function endTurn() {
    setBattle((b) => {
      if (!b || b.over) return b;
      let nb = { ...b, turn: "enemy" };
      let log = [...nb.log];

      // damage-over-time ticks on the enemy
      if (nb.enemyStatus.burn > 0) {
        nb.enemyHp = clamp(nb.enemyHp - nb.enemyStatus.burn, 0, nb.enemyMaxHp);
        log.push(`${nb.enemy.name} takes ${nb.enemyStatus.burn} burn.`);
        nb.enemyStatus = { ...nb.enemyStatus, burn: Math.max(0, nb.enemyStatus.burn - 1) };
      }
      if (nb.enemyStatus.poison > 0) {
        // Poison does NOT decay; it keeps ticking at full value (ramps).
        nb.enemyHp = clamp(nb.enemyHp - nb.enemyStatus.poison, 0, nb.enemyMaxHp);
        log.push(`${nb.enemy.name} suffers ${nb.enemyStatus.poison} poison.`);
      }
      if (nb.enemyStatus.decay > 0) {
        nb.enemyHp = clamp(nb.enemyHp - nb.enemyStatus.decay, 0, nb.enemyMaxHp);
        nb.enemyBlock = Math.max(0, nb.enemyBlock - nb.enemyStatus.decay);
        log.push(`${nb.enemy.name} decays (-${nb.enemyStatus.decay} HP & block).`);
        nb.enemyStatus = { ...nb.enemyStatus, decay: Math.max(0, nb.enemyStatus.decay - 1) };
      }
      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...log, `${nb.enemy.name} succumbs!`].slice(-6);
        return nb;
      }

      // enemy attacks the ACTIVE fighter only
      const intent = nb.enemy.intent || setEnemyIntent(nb);
      let active = nb.fighters[nb.activeIdx];
      if (intent.kind === "attack") {
        let dmg = intent.value;
        if (nb.enemyStatus.weak > 0) dmg = Math.round(dmg * 0.75);
        // Chill: enemy hits softer while chilled (decays)
        if (nb.enemyStatus.chill > 0) dmg = Math.round(dmg * 0.7);
        // Shock: enemy fumbles, big one-turn damage cut, then consumed
        if (nb.enemyStatus.shock > 0) dmg = Math.round(dmg * 0.5);
        // element matchup vs ALL of the active monster's types (+self-resist)
        const eff = defenseMultiplier(nb.enemy.element, active);
        if (eff !== 1) dmg = Math.round(dmg * eff);
        // absorption order: team Shield -> active block -> HP
        if ((nb.teamShield || 0) > 0) {
          const a = Math.min(nb.teamShield, dmg);
          nb.teamShield -= a;
          dmg -= a;
        }
        let block = active.block;
        if (block > 0) {
          const a = Math.min(block, dmg);
          block -= a;
          dmg -= a;
        }
        const newHp = clamp(active.hp - dmg, 0, active.maxHp);
        nb = updateActive(nb, (af) => ({ ...af, hp: newHp, block }));
        active = nb.fighters[nb.activeIdx];
        log.push(`${nb.enemy.name} hits ${active.name} for ${dmg}.`);
        // thorns boon: reflect damage back when struck
        const boon = active.boon && active.boon.effect ? active.boon.effect : {};
        if (boon.thorns && dmg > 0) {
          let refl = boon.thorns;
          if (nb.enemyBlock > 0) {
            const a = Math.min(nb.enemyBlock, refl);
            nb.enemyBlock -= a;
            refl -= a;
          }
          nb.enemyHp = clamp(nb.enemyHp - refl, 0, nb.enemyMaxHp);
          log.push(`${active.name}'s thorns reflect ${boon.thorns}.`);
        }
      } else if (intent.kind === "block") {
        nb.enemyBlock += intent.value;
        log.push(`${nb.enemy.name} braces (+${intent.value} block).`);
      } else {
        log.push(`${nb.enemy.name} steels itself.`);
      }
      if (nb.enemyStatus.weak > 0) nb.enemyStatus = { ...nb.enemyStatus, weak: nb.enemyStatus.weak - 1 };
      if (nb.enemyStatus.vulnerable > 0) nb.enemyStatus = { ...nb.enemyStatus, vulnerable: nb.enemyStatus.vulnerable - 1 };
      if (nb.enemyStatus.chill > 0) nb.enemyStatus = { ...nb.enemyStatus, chill: nb.enemyStatus.chill - 1 };
      if (nb.enemyStatus.shock > 0) nb.enemyStatus = { ...nb.enemyStatus, shock: 0 }; // shock is one-shot
      if (nb.enemyStatus.soak > 0) nb.enemyStatus = { ...nb.enemyStatus, soak: nb.enemyStatus.soak - 1 };

      // did the active fighter faint?
      if (nb.fighters[nb.activeIdx].hp <= 0) {
        log.push(`${nb.fighters[nb.activeIdx].name} faints!`);
        const nextIdx = nb.fighters.findIndex((f, i) => i !== nb.activeIdx && f.hp > 0);
        if (nextIdx === -1 && nb.fighters[nb.activeIdx].hp <= 0) {
          nb.over = "lose";
          nb.log = [...log, "Your whole team has fallen..."].slice(-6);
          return nb;
        }
        if (nextIdx !== -1) {
          nb.activeIdx = nextIdx;
          log.push(`${nb.fighters[nextIdx].name} is forced into battle!`);
        }
      }

      // any fighters left alive?
      if (!nb.fighters.some((f) => f.hp > 0)) {
        nb.over = "lose";
        nb.log = [...log, "Your whole team has fallen..."].slice(-6);
        return nb;
      }

      nb.log = log.slice(-6);

      // start next player turn: refresh energy, clear active block & team
      // shield (Shield resets each of your turns), apply regen, draw
      nb.turn = "player";
      nb.energy = nb.maxEnergy;
      nb.swappedThisTurn = false;
      nb.teamShield = 0;
      const aboon = nb.fighters[nb.activeIdx].boon && nb.fighters[nb.activeIdx].boon.effect ? nb.fighters[nb.activeIdx].boon.effect : {};
      nb = updateActive(nb, (af) => {
        let hp = af.hp;
        const boonRegen = aboon.regen || 0;
        const cardRegen = af.regenStacks || 0;
        const totalRegen = boonRegen + cardRegen;
        if (totalRegen) hp = clamp(hp + totalRegen, 0, af.maxHp);
        // retain: keep cards flagged retain in hand; discard the rest
        const keep = af.hand.filter((c) => c.retain);
        const toDiscard = af.hand.filter((c) => !c.retain);
        return {
          ...af,
          hp,
          block: 0,
          firstCardThisTurn: true,
          discard: [...af.discard, ...toDiscard],
          hand: keep,
          _retainCount: keep.length,
        };
      });
      const af2 = nb.fighters[nb.activeIdx];
      const totalRegen = (aboon.regen || 0) + (af2.regenStacks || 0);
      if (totalRegen) log.push(`${af2.name} regenerates ${totalRegen} HP.`);
      nb.log = log.slice(-6);
      nb.enemy = { ...nb.enemy, intent: setEnemyIntent(nb) };
      // draw back up to hand size, accounting for retained cards
      const handSize = 5 + ((nb.bonus && nb.bonus.drawBonus) || 0);
      const drawN = Math.max(0, handSize - (af2._retainCount || 0));
      setTimeout(() => drawHand(drawN), 60);
      return nb;
    });
  }

  // Use a potion mid-battle; consumes it for the rest of the run.
  function usePotion(itemId) {
    const it = ITEMS.find((x) => x.id === itemId);
    if (!it) return;
    setBattle((b) => {
      if (!b || b.over) return b;
      let nb = { ...b };
      let log = [...nb.log];
      const e = it.effect;
      if (e.potionDmg) {
        let dmg = e.potionDmg;
        if (nb.enemyBlock > 0) {
          const a = Math.min(nb.enemyBlock, dmg);
          nb.enemyBlock -= a;
          dmg -= a;
        }
        nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
        log.push(`${it.name}: ${e.potionDmg} damage.`);
      }
      if (e.potionBlock) { nb = updateActive(nb, (af) => ({ ...af, block: af.block + e.potionBlock })); log.push(`${it.name}: +${e.potionBlock} block.`); }
      if (e.potionStrength) { nb = updateActive(nb, (af) => ({ ...af, str: af.str + e.potionStrength })); log.push(`${it.name}: +${e.potionStrength} Strength.`); }
      if (e.potionHeal) { nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + e.potionHeal, 0, af.maxHp) })); log.push(`${it.name}: healed ${e.potionHeal}.`); }
      if (e.potionEnergy) { nb.energy += e.potionEnergy; log.push(`${it.name}: +${e.potionEnergy} energy.`); }
      nb.potions = nb.potions.filter((p, i) => i !== nb.potions.indexOf(itemId));
      nb.log = log.slice(-6);
      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...nb.log, `${nb.enemy.name} is defeated!`].slice(-6);
      }
      return nb;
    });
    // remove one copy from owned items
    setItems((arr) => {
      const i = arr.indexOf(itemId);
      if (i === -1) return arr;
      return [...arr.slice(0, i), ...arr.slice(i + 1)];
    });
  }

  // Use a material as a weak battle consumable. Consumes one from the stash.
  function useMaterial(matId) {
    const mat = materialById(matId);
    if (!mat || !mat.effect || (materials[matId] || 0) <= 0) return;
    setBattle((b) => {
      if (!b || b.over || b.turn !== "player") return b;
      let nb = { ...b };
      let log = [...nb.log];
      const e = mat.effect;
      if (e.dmg) {
        let dmg = e.dmg;
        if (nb.enemyBlock > 0) {
          const a = Math.min(nb.enemyBlock, dmg);
          nb.enemyBlock -= a;
          dmg -= a;
        }
        nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
        log.push(`${mat.name}: ${e.dmg} damage.`);
      }
      if (e.block) { nb = updateActive(nb, (af) => ({ ...af, block: af.block + e.block })); log.push(`${mat.name}: +${e.block} block.`); }
      if (e.shield) { nb.teamShield = (nb.teamShield || 0) + e.shield; log.push(`${mat.name}: +${e.shield} Shield.`); }
      if (e.strength) { nb = updateActive(nb, (af) => ({ ...af, str: af.str + e.strength })); log.push(`${mat.name}: +${e.strength} Strength.`); }
      if (e.heal) { nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + e.heal, 0, af.maxHp) })); log.push(`${mat.name}: healed ${e.heal}.`); }
      if (e.regen) { nb = updateActive(nb, (af) => ({ ...af, regenStacks: (af.regenStacks || 0) + e.regen })); log.push(`${mat.name}: +${e.regen} Regen.`); }
      if (e.energy) { nb.energy += e.energy; log.push(`${mat.name}: +${e.energy} energy.`); }
      // enemy statuses
      const st = {};
      ["burn", "chill", "soak", "shock", "poison", "vulnerable", "decay"].forEach((k) => { if (e[k]) st[k] = e[k]; });
      if (Object.keys(st).length) {
        nb.enemyStatus = { ...nb.enemyStatus };
        for (const k in st) nb.enemyStatus[k] = (nb.enemyStatus[k] || 0) + st[k];
        log.push(`${mat.name}: applied ${Object.keys(st).map((k) => `${st[k]} ${k}`).join(", ")}.`);
      }
      if (e.draw) setTimeout(() => drawHand(e.draw), 30);
      nb.log = log.slice(-6);
      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...nb.log, `${nb.enemy.name} is defeated!`].slice(-6);
      }
      return nb;
    });
    // consume one
    setMaterials((m) => {
      const next = { ...m, [matId]: (m[matId] || 0) - 1 };
      if (next[matId] <= 0) delete next[matId];
      return next;
    });
  }

  // ---------- post-battle ----------
  // Save surviving fighters' HP so it carries to the next encounter.
  function saveRunHp() {
    if (!battle) return;
    setRunHp((hp) => {
      const next = { ...hp };
      battle.fighters.forEach((f) => (next[f.uid] = f.hp));
      return next;
    });
  }

  // Add progress to every monster currently on the team. delta may carry
  // any numeric stat plus a kosByElement map. Persists on the collection.
  function awardProgress(delta) {
    const teamIds = new Set(team);
    setCollection((c) =>
      c.map((m) => {
        if (!teamIds.has(m.uid)) return m;
        const prog = { xp: 0, wins: 0, battles: 0, bossKills: 0, eliteKills: 0, treasures: 0, rests: 0, shops: 0, faints: 0, soloKills: 0, flawlessWins: 0, kosByElement: {}, ...(m.prog || {}) };
        const next = { ...prog, kosByElement: { ...(prog.kosByElement || {}) } };
        for (const k in delta) {
          if (k === "kosByElement") {
            for (const el in delta.kosByElement) {
              next.kosByElement[el] = (next.kosByElement[el] || 0) + delta.kosByElement[el];
            }
          } else {
            next[k] = (next[k] || 0) + delta[k];
          }
        }
        return { ...m, prog: next };
      })
    );
  }

  function afterWin() {
    saveRunHp();
    const isWild = battle.wild;
    const isBoss = battle.isBoss;
    const isElite = activeNode && activeNode.type === "elite";
    const enemyEl = battle.enemy.element;
    const aliveCount = battle.fighters.filter((f) => f.hp > 0).length;
    const anyFainted = battle.fighters.some((f) => f.hp <= 0);
    const delta = {
      xp: isBoss ? 80 : isElite ? 50 : isWild ? 20 : 30,
      wins: 1,
      battles: 1,
      bossKills: isBoss ? 1 : 0,
      eliteKills: isElite ? 1 : 0,
      kosByElement: { [enemyEl]: 1 },
      flawlessWins: anyFainted ? 0 : 1,
      soloKills: aliveCount === 1 ? 1 : 0,
    };
    awardProgress(delta);
    bumpStat("battlesWon");
    tickEggs();
    if (isBoss) bumpStat("bossesSlain");
    // ----- material drops: automatic, separate from the chosen reward -----
    const drops = rollDrops(battle.enemy, { boss: isBoss, elite: isElite, wild: isWild });
    grantMaterials(drops);
    const capturedTemplate = battle.enemy;
    const choices = [];
    choices.push({ kind: "capture", template: capturedTemplate });
    if (battle.rival) {
      bumpStat("rivalWins");
      choices.length = 0; // no capturing the rival's partner
      choices.push({ kind: "gold", amount: 120 });
    } else if (isWild) {
      // wild encounters: capture or a little gold, then back to overworld
      choices.push({ kind: "gold", amount: 15 });
    } else {
      const pool = isElite || isBoss ? ITEMS.filter((i) => i.rarity !== "common") : ITEMS;
      const drop = pool[Math.floor(Math.random() * pool.length)];
      choices.push({ kind: "item", item: drop });
      if (isElite || isBoss) {
        choices.push({ kind: "generate" });
        // StS-style: elites and bosses always offer a run artifact
        const unowned = ARTIFACTS.filter((a) => !runArtifacts.includes(a.id));
        if (unowned.length > 0) {
          const art = unowned[Math.floor(Math.random() * unowned.length)];
          choices.push({ kind: "artifact", artifact: art });
        }
      }
      // rare: elite/boss loot can include an undiscovered recipe scroll
      if (isElite || isBoss) {
        const unknown = RECIPES.filter((r) => !knownRecipes.has(r.item));
        if (unknown.length > 0 && Math.random() < 0.3) {
          const r = unknown[Math.floor(Math.random() * unknown.length)];
          choices.push({ kind: "recipe", item: r.item });
        }
      }
      choices.push({ kind: "gold", amount: isBoss ? 80 : isElite ? 50 : 25 });
    }
    setPendingReward({ choices, isBoss, wild: isWild, drops });
    setScreen("reward");
  }

  function takeReward(choice) {
    const wild = pendingReward && pendingReward.wild;
    const goBack = () => {
      if (wild) {
        setBattle(null);
        setWildBattle(false);
        setPendingReward(null);
        setScreen("overworld");
      } else {
        returnToMap();
      }
    };
    if (choice.kind === "capture") {
      const ballCount = items.filter((id) => id === "beastball").length;
      if (ballCount <= 0) {
        flash("You have no Beast Balls! Buy some at a shop.");
        return; // stay on the reward screen so they can pick something else
      }
      const cleanName = choice.template.name.replace(/^(BOSS |Elite )/, "");
      const fresh = makeMonster({
        name: cleanName,
        element: choice.template.element,
        elements: choice.template.elements,
        form: choice.template.form || "regular",
        hp: choice.template.baseHp || choice.template.maxHp,
        sprite: choice.template.sprite,
        desc: choice.template.desc,
        svg: choice.template.svg,
        imageUrl: choice.template.imageUrl,
        rarity: choice.template.rarity,
        tier: choice.template.tier,
        evolvesTo: choice.template.evolvesTo,
        cards: choice.template.cards.map(({ cid, ...c }) => c),
      });
      setCollection((c) => [...c, fresh]);
      setSeen((s) => new Set(s).add(cleanName));
      bumpStat("monstersCaptured");
      SFX.capture();
      // consume one Beast Ball
      setItems((arr) => {
        const i = arr.indexOf("beastball");
        if (i === -1) return arr;
        return [...arr.slice(0, i), ...arr.slice(i + 1)];
      });
      flash(`Caught ${cleanName}! (Beast Ball used)`);
      goBack();
    } else if (choice.kind === "item") {
      grantItem(choice.item.id);
      flash(`Found ${choice.item.name}!`);
      goBack();
    } else if (choice.kind === "gold") {
      setGold((g) => g + choice.amount);
      flash(`Picked up ${choice.amount} gold.`);
      goBack();
    } else if (choice.kind === "recipe") {
      learnRecipe(choice.item);
      goBack();
    } else if (choice.kind === "artifact") {
      setRunArtifacts((a) => [...a, choice.artifact.id]);
      flash(`Artifact claimed: ${choice.artifact.name} (this run only)`);
      goBack();
    } else if (choice.kind === "generate") {
      setScreen("generate");
    }
  }

  // ----- non-combat node resolvers -----
  function resolveTreasure() {
    awardProgress({ treasures: 1 });
    // half the time a chest holds a run artifact instead of an item
    const unowned = ARTIFACTS.filter((a) => !runArtifacts.includes(a.id));
    if (unowned.length > 0 && Math.random() < 0.5) {
      const art = unowned[Math.floor(Math.random() * unowned.length)];
      setRunArtifacts((a) => [...a, art.id]);
      setGold((g) => g + 20);
      flash(`Treasure: ${art.icon} ${art.name} (this run) + 20 gold!`);
    } else {
      const pool = ITEMS.filter((i) => i.rarity !== "common");
      const drop = pool[Math.floor(Math.random() * pool.length)];
      grantItem(drop.id);
      setGold((g) => g + 20);
      flash(`Treasure: ${drop.name} + 20 gold!`);
    }
    setTimeout(returnToMap, 200);
  }

  function restHeal(kind) {
    // heal 40% of max HP to all, or full-heal one
    setRunHp((hp) => {
      const next = { ...hp };
      teamMonsters.forEach((m) => {
        const cur = next[m.uid] == null ? m.maxHp : next[m.uid];
        next[m.uid] = clamp(Math.round(cur + m.maxHp * 0.4), 0, m.maxHp);
      });
      return next;
    });
    awardProgress({ rests: 1 });
    flash("Your team rests (+40% HP).");
    if (returnScreen === "overworld") setScreen("overworld");
    else returnToMap();
  }

  function leaveShop() {
    if (returnScreen === "overworld") setScreen("overworld");
    else returnToMap();
  }

  function buyItem(it, price) {
    const cost = price != null ? price : it.rarity === "rare" || it.rarity === "legendary" ? 60 : it.rarity === "uncommon" ? 40 : 25;
    if (gold < cost) {
      flash("Not enough gold.");
      return;
    }
    setGold((g) => g - cost);
    grantItem(it.id);
    flash(`Bought ${it.name}.`);
  }

  // Buy a recipe scroll from a deep shop.
  function buyRecipe(itemId, price) {
    if (gold < price) {
      flash("Not enough gold.");
      return;
    }
    setGold((g) => g - price);
    learnRecipe(itemId);
  }

  // mystery: random good or mild-bad outcome
  function resolveMystery(outcome) {
    if (outcome === "item") {
      const drop = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      grantItem(drop.id);
      flash(`A traveler gives you ${drop.name}.`);
    } else if (outcome === "gold") {
      const g = 15 + Math.floor(Math.random() * 30);
      setGold((x) => x + g);
      flash(`You find ${g} gold.`);
    } else if (outcome === "heal") {
      setRunHp((hp) => {
        const next = { ...hp };
        teamMonsters.forEach((m) => {
          const cur = next[m.uid] == null ? m.maxHp : next[m.uid];
          next[m.uid] = clamp(cur + 15, 0, m.maxHp);
        });
        return next;
      });
      flash("A spring heals your team (+15 HP).");
    } else if (outcome === "hurt") {
      setRunHp((hp) => {
        const next = { ...hp };
        teamMonsters.forEach((m) => {
          const cur = next[m.uid] == null ? m.maxHp : next[m.uid];
          next[m.uid] = clamp(cur - 8, 1, m.maxHp);
        });
        return next;
      });
      flash("A trap! Your team takes 8 damage each.");
    }
    returnToMap();
  }

  // Evolve a monster into its next form, IF its requirements are met.
  // Consumes one Evolution Stone and carries leftover XP into the new form.
  async function evolveMonster(m) {
    const target = evolutionTarget(m);
    if (!target) return;
    const { met, req } = checkEvolution(m, items);
    if (!met) {
      flash("Requirements not met yet.");
      return;
    }
    if (req.item === "evostone") {
      setItems((arr) => {
        const i = arr.indexOf("evostone");
        if (i === -1) return arr;
        return [...arr.slice(0, i), ...arr.slice(i + 1)];
      });
    }
    const xpCond = (req.conds || []).find((c) => c.stat === "xp");
    const xpNeed = xpCond ? xpCond.need : 0;
    const leftoverXp = Math.max(0, (m.prog?.xp || 0) - xpNeed);

    // ----- forged monster: generate the next stage via AI -----
    if (m.forged) {
      flash(`${m.name} is evolving...`);
      const nextStage = (m.forgedStage || 1) + 1;
      const nextRarity = RARITY_LADDER[Math.min(RARITY_LADDER.length - 1, rarityIndex(m.rarity) + 1)];
      const budget = RARITY_BUDGET[nextRarity];
      try {
        const prompt = `Evolve a forged monster in a Pokémon x Slay the Spire card battler. Respond with ONLY a JSON object, no prose.

Current form: ${JSON.stringify({ name: m.name, element: m.element, hp: m.maxHp, desc: m.desc, cards: m.cards.map(({ cid, ...c }) => c) })}

Create its NEXT evolution: same element (${m.element}), clearly more powerful, an evolved name (related to the current one), HP in range ${budget.hp[0]}-${budget.hp[1]}, power level ${budget.power}. Keep the theme but make it look grander.
{
  "name":"evolved name",
  "hp": integer ${budget.hp[0]}-${budget.hp[1]},
  "sprite":"single emoji",
  "desc":"one vivid sentence",
  "cards":[ exactly 3 cards; fields id,name,type(attack|skill|power),cost(0-2),text, optional dmg/block/strength/burn/weak/draw/hits/shield/teamheal/regen/vulnerable/energy/chill/soak/shock/poison/decay/leech and booleans retain/exhaust. Match status to element: pyre=burn, frost=chill, hydro=soak, charge=shock, toxin=poison, umbra=vulnerable, void=decay, blood=leech. (shield=team block, teamheal=heal all, regen=heal-over-time, poison=non-decaying DoT, chill=enemy hits weaker, soak=sets up reactions, shock=enemy fumbles, decay=enemy loses HP+block, vulnerable=+50% dmg taken, leech=heal from damage) ]
}`;
        const data = await askClaudeJson(prompt);
        const evolved = makeMonster({
          name: data.name || `${m.name}+`,
          element: m.element,
          hp: clamp(Number(data.hp) || budget.hp[1], budget.hp[0], budget.hp[1]),
          sprite: data.sprite || m.sprite,
          desc: data.desc || m.desc,
          rarity: nextRarity,
          boon: m.boon,
          forged: true,
          forgedStage: nextStage,
          forgedStages: m.forgedStages,
          cards: (data.cards || m.cards.map(({ cid, ...c }) => c)).slice(0, 3),
        });
        evolved.prog = { ...evolved.prog, xp: leftoverXp };
        setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...evolved, uid: m.uid } : x)));
        flash(`${m.name} evolved into ${evolved.name}!`);
        const svg = await generateArt({ name: evolved.name, element: evolved.element, desc: evolved.desc });
        if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
      } catch (e) {
        flash("Evolution failed, try again.");
      }
      return;
    }

    // ----- roster monster: swap to the known next form -----
    const evolved = makeMonster({ ...target, svg: null, imageUrl: null });
    // egg moves are family heirlooms: they survive evolution
    const heirloom = (m.cards || []).find((c) => c.eggMove);
    if (heirloom) evolved.cards = [...evolved.cards.slice(0, evolved.cards.length - 1), { ...heirloom, cid: `c${Date.now()}_${Math.floor(Math.random() * 9999)}` }];
    const keptForm = m.form && m.form !== "regular" && formAllowed(m.form, evolutionInfo(evolved)) ? m.form : "regular";
    evolved.form = keptForm;
    evolved.prog = { ...evolved.prog, xp: leftoverXp };
    setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...evolved, uid: m.uid } : x)));
    setSeen((s) => new Set(s).add(target.name));
    flash(`${m.name} evolved into ${target.name}!`);
    const svg = await generateArt({ name: target.name, element: target.element, desc: target.desc });
    if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
  }

  // ---------- CHEAT / DEBUG helpers ----------
  function cheatGiveItem(id) {
    grantItem(id);
    const it = ITEMS.find((x) => x.id === id);
    flash(`Granted ${it ? it.name : id}.`);
  }
  function cheatGiveGold(n) {
    setGold((g) => g + n);
    flash(`+${n} gold.`);
  }
  async function cheatSpawnMonster(template) {
    const fresh = makeMonster({ ...template, svg: null });
    setCollection((c) => [...c, fresh]);
    setSeen((s) => new Set(s).add(template.name));
    flash(`Spawned ${template.name}.`);
    const svg = await generateArt({ name: template.name, element: template.element, desc: template.desc });
    if (svg) setCollection((c) => c.map((x) => (x.uid === fresh.uid ? { ...x, svg } : x)));
  }
  function cheatGiveXP(amount) {
    if (team.length === 0) {
      flash("Add monsters to your team first to grant XP.");
      return;
    }
    const allKos = {};
    ELEMENTS.forEach((e) => (allKos[e] = 5));
    awardProgress({ xp: amount, wins: 5, bossKills: 1, eliteKills: 1, treasures: 3, rests: 2, shops: 1, soloKills: 2, flawlessWins: 2, kosByElement: allKos });
    flash(`Granted ${amount} XP + deeds to your team.`);
  }
  function cheatRevealCodex() {
    setSeen(new Set(DEFAULT_MONSTERS.map((t) => t.name)));
    flash("Codex fully revealed.");
  }

  // ============================================================
  // RENDER
  // ============================================================
  const depthLabel = activeNode ? activeNode.row + 1 : runRow + 1;
  const vp = useViewport();
  const noScroll = screen === "battle" || screen === "overworld";
  return (
    <div style={noScroll ? { ...S.root, height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" } : S.root}>
      <style>{CSS}</style>
      <Header screen={screen} setScreen={setScreen} floor={depthLabel} gold={gold} inBattle={!!battle && screen === "battle"} hasStarter={collection.length > 0} baseScreen={baseScreen} />

      {toast && <div style={S.toast}>{toast}</div>}

      <div style={noScroll
        ? { width: "100%", maxWidth: vp.landscape ? 1280 : 720, margin: "0 auto", padding: screen === "battle" ? "6px 10px 0" : "6px 10px 74px", flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
        : { ...S.main, maxWidth: vp.landscape ? 1280 : 720 }}>
        {screen === "title" && <Title onStart={() => setScreen(collection.length === 0 ? "starter" : "den")} />}

        {screen === "starter" && (
          <StarterScreen
            onPick={(tmpl) => {
              const m = makeMonster(tmpl);
              setCollection([m]);
              setTeam([m.uid]);
              setSeen(new Set([m.name]));
              flash(`${m.name} joins you. Your journey begins!`);
              setScreen("den");
              // paint the chosen starter in the background
              (async () => {
                const svg = await generateArt({ name: m.name, element: m.element, desc: m.desc, lore: m.lore });
                if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
              })();
            }}
            onForged={(mon) => {
              const m = makeMonster(mon);
              setCollection([m]);
              setTeam([m.uid]);
              setSeen(new Set([m.name]));
              flash(`${m.name} is forged into being. Your journey begins!`);
              setScreen("den");
            }}
          />
        )}

        {screen === "collection" && (
          <MonstersGallery collection={collection} team={team} />
        )}

        {screen === "talk" && npcCtx && (
          <NPCTalk
            npc={NPCS[npcCtx]}
            stats={stats}
            seen={seen}
            activeQuests={activeQuests}
            doneQuests={doneQuests}
            onAccept={acceptQuest}
            onTurnIn={turnInQuest}
            onRivalBattle={npcCtx === "rival" ? startRivalBattle : null}
            onLeave={() => setScreen("overworld")}
          />
        )}

        {screen === "den" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: vp.landscape ? "1 1 420px" : "1 1 100%", minWidth: 0 }}>
            <Collection
              collection={collection}
              team={team}
              setTeam={setTeam}
              onDungeon={leaveDen}
              onEvolve={evolveMonster}
              items={items}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
              <button style={S.cheatBtn} onClick={() => setScreen("generate")}>🔥 Forge</button>
              <button style={S.cheatBtn} onClick={() => setScreen("fuse")}>⚗️ Fusion & Nursery</button>
              <button style={S.cheatBtn} onClick={() => setScreen("craft")}>⚒️ Workshop</button>
            </div>
            </div>
            <div style={{ flex: vp.landscape ? "1 1 420px" : "1 1 100%", minWidth: 0 }}>
            <MoveTutor
              collection={collection}
              gold={gold}
              items={items}
              materials={materials}
              onLearnType={learnTypeMove}
              onLearnSpecial={learnSpecialMove}
              onForget={forgetMove}
              onTransfer={transferMove}
              iconArt={iconArt}
              onPaint={paintIcon}
            />
            </div>
          </div>
        )}

        {screen === "overworld" && (
          <Overworld
            vp={vp}
            ow={overworld}
            pos={playerPos}
            onMove={movePlayer}
            onLeave={() => setScreen("collection")}
          />
        )}

        {(screen === "map" || screen === "battle") && runArtifacts.length > 0 && (
          <div style={{ ...S.dropsBar, marginBottom: 8 }}>
            <span style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>Artifacts</span>
            {runArtifacts.map((id) => {
              const a = artifactById(id);
              return a ? <span key={id} style={{ ...S.dropPill, borderColor: "#ffd34d66" }} title={a.text}>{a.icon} {a.name}</span> : null;
            })}
          </div>
        )}

        {screen === "map" && runMap && (
          <DungeonMap
            map={runMap}
            currentRow={runRow}
            currentCol={runCol}
            onPick={chooseNode}
            onLeave={() => {
              flash("You leave the dungeon. Your artifacts crumble to dust.");
              setRunArtifacts([]);
              setBattle(null);
              setScreen("overworld");
            }}
          />
        )}

        {screen === "rest" && (
          <RestSite team={teamMonsters} runHp={runHp} onRest={restHeal} />
        )}

        {screen === "shop" && (
          <Shop gold={gold} owned={items} onBuy={buyItem} onLeave={leaveShop} deep={shopCtx.deep} depth={shopCtx.depth} unknownRecipes={RECIPES.filter((r) => !knownRecipes.has(r.item)).map((r) => r.item)} onBuyRecipe={buyRecipe} />
        )}

        {screen === "mystery" && (
          <Mystery onResolve={resolveMystery} />
        )}

        {screen === "compendium" && (
          <Compendium seen={seen} collection={collection} seenItems={seenItems} />
        )}

        {screen === "items" && (
          <ItemsScreen items={items} materials={materials} iconArt={iconArt} onPaint={paintIcon} />
        )}

        {screen === "craft" && (
          <CraftScreen
            materials={materials}
            collection={collection}
            team={team}
            onCraft={craftItem}
            onTransmute={transmuteMonster}
            seenMaterials={seenMaterials}
            knownRecipes={knownRecipes}
            onBack={() => setScreen("den")}
          />
        )}

        {screen === "cheat" && (
          <CheatPanel
            onGiveItem={cheatGiveItem}
            onGiveGold={cheatGiveGold}
            onSpawn={cheatSpawnMonster}
            onGiveXP={cheatGiveXP}
            onRevealCodex={cheatRevealCodex}
            onLearnRecipes={() => { setKnownRecipes(new Set(RECIPES.map((r) => r.item))); flash("All recipes learned."); }}
            onMakeMonster={(tmpl, withArt) => {
              const m = makeMonster(tmpl);
              setCollection((c) => [...c, m]);
              setSeen((sn) => new Set(sn).add(m.name));
              flash(`🛠️ Created ${m.name}.`);
              if (withArt) {
                (async () => {
                  const svg = await generateArt({ name: m.name, element: m.element, desc: m.desc, lore: m.desc });
                  if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
                  else flash("Art generation failed (need an API key outside Claude).");
                })();
              }
            }}
            onAddMove={(uid2, card) => {
              setCollection((c) => c.map((m) => (m.uid === uid2 ? { ...m, cards: [...m.cards, { ...card, learned: true }] } : m)));
              flash(`🛠️ Move taught.`);
            }}
            onPaintIcon={paintIcon}
            onSaveNow={() => { storeSet(serializeSave()); flash("💾 Saved."); }}
            onExport={serializeSave}
            onImport={(d) => { const ok = hydrateSave(d); if (ok) { storeSet(d); flash("💾 Save imported."); } return ok; }}
            onReset={resetGame}
            onMakeItem={(item) => {
              ITEMS.push(item); // runtime registry: appears in bag/codex/shops
              grantItem(item.id);
              flash(`🛠️ Created ${item.name} (granted 1).`);
            }}
            onGiveMaterials={() => { const all = {}; MATERIALS.forEach((m) => (all[m.id] = 5)); grantMaterials(all); flash("+5 of every material."); }}
            onClose={() => setScreen("collection")}
            gold={gold}
            items={items}
            collection={collection}
            team={team}
            seen={seen}
            seenItems={seenItems}
            materials={materials}
          />
        )}

        {screen === "generate" && (
          <Generate
            items={items}
            free={!!activeNode}
            onCreated={(mon) => {
              setCollection((c) => [...c, makeMonster(mon)]);
              setSeen((s) => new Set(s).add(mon.name));
              // consume a Genesis Spark unless this was a free reward forge
              if (!activeNode) {
                setItems((arr) => {
                  const i = arr.indexOf("genesisspark");
                  if (i === -1) return arr;
                  return [...arr.slice(0, i), ...arr.slice(i + 1)];
                });
              }
              flash(`${mon.name} materializes into your collection!`);
              if (activeNode) {
                returnToMap();
              } else {
                setScreen("collection");
              }
            }}
            onCancel={() => (activeNode ? returnToMap() : setScreen("den"))}
          />
        )}

        {screen === "fuse" && (
          <Fuse
            collection={collection}
            items={items}
            eggs={eggs}
            materials={materials}
            onBreed={breedPair}
            canBreedCheck={canBreed}
            onFused={(mon) => {
              setCollection((c) => [...c, makeMonster(mon)]);
              setSeen((s) => new Set(s).add(mon.name));
              // consume one Fusion Catalyst
              setItems((arr) => {
                const i = arr.indexOf("fusioncatalyst");
                if (i === -1) return arr;
                return [...arr.slice(0, i), ...arr.slice(i + 1)];
              });
              flash(`Fusion complete: ${mon.name}!`);
              setScreen("den");
            }}
            onFormFused={(mA, mB, next) => {
              // deterministic same-species merge: both are consumed, one
              // emerges at the next form. XP is pooled; art/boons carry from A.
              const merged = {
                ...mA,
                uid: `m${Date.now()}_${Math.floor(Math.random() * 9999)}`,
                form: next,
                prog: { ...mA.prog, xp: ((mA.prog && mA.prog.xp) || 0) + ((mB.prog && mB.prog.xp) || 0) },
              };
              setTeam((t) => t.filter((uid) => uid !== mA.uid && uid !== mB.uid));
              setCollection((c) => [...c.filter((x) => x.uid !== mA.uid && x.uid !== mB.uid), merged]);
              flash(`${FORMS[next].badge} Form Fusion: ${merged.name} is now ${FORMS[next].label}!`);
              setScreen("den");
            }}
            onCancel={() => setScreen("den")}
          />
        )}

        {screen === "battle" && battle && (
          <Battle
            vp={vp}
            battle={battle}
            team={teamMonsters}
            onPlay={playCard}
            onEnd={endTurn}
            onPotion={usePotion}
            materials={materials}
            onMaterial={useMaterial}
            iconArt={iconArt}
            onSwap={swapTo}
            onWin={afterWin}
            onLose={() => {
              if (wildBattle) {
                flash("Your team fled back to safety.");
                setWildBattle(false);
                setBattle(null);
                // revive a little so the player isn't stuck at 0
                setRunHp((hp) => {
                  const next = { ...hp };
                  teamMonsters.forEach((m) => {
                    next[m.uid] = Math.max(next[m.uid] || 0, Math.round(m.maxHp * 0.3));
                  });
                  return next;
                });
                setScreen("overworld");
              } else {
                flash("Your team was defeated. Your artifacts are lost.");
                setRunArtifacts([]);
                setBattle(null);
                setScreen("overworld");
              }
            }}
          />
        )}

        {screen === "reward" && pendingReward && (
          <Reward reward={pendingReward} onTake={takeReward} floor={depthLabel} ballCount={items.filter((id) => id === "beastball").length} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/responsive — viewport + orientation hook. UPDATE WHEN:
// ║ a screen needs to reflow by shape — read useViewport() for {w,h,
// ║ landscape, compact}. landscape = wider than tall; compact = small.
// ╚══════════════════════════════════════════════════════════════════╝
function useViewport() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { w, h, landscape: w > h * 1.15, compact: Math.min(w, h) < 480 };
  };
  const [vp, setVp] = useState(get);
  useEffect(() => {
    const on = () => setVp(get());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);
  return vp;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/chrome — header, nav, version tag
// ║ UPDATE WHEN: new top-level screens (nav prune rule: deep actions = den only); APP_VERSION bump EVERY edit
// ╚══════════════════════════════════════════════════════════════════╝
function Header({ screen, setScreen, floor, gold, inBattle, hasStarter, baseScreen }) {
  const runScreens = ["battle", "rest", "shop", "mystery", "reward"]; // menus stay reachable on overworld + dungeon map
  const inRun = runScreens.includes(screen);
  const showTabs = !inRun && screen !== "title";
  const tapRef = useRef({ count: 0, last: 0 });

  function onLogoTap() {
    const now = Date.now();
    const t = tapRef.current;
    // reset the streak if taps are too far apart
    if (now - t.last > 600) t.count = 0;
    t.count += 1;
    t.last = now;
    if (t.count >= 5) {
      t.count = 0;
      setScreen("cheat");
      return;
    }
    // a normal single tap still navigates home (but not mid-run)
    if (!inRun) setScreen("title");
  }

  return (
    <>
      <div style={S.header}>
        {screen === "cheat" ? (
          // On the debug screen the logo is hidden (replaced by an inert
          // badge) so an extra tap can't accidentally navigate away.
          <div style={{ ...S.logo, cursor: "default", color: "#ffd34d" }}>
            🛠️ DEBUG <span style={S.versionTag}>{APP_VERSION}</span>
          </div>
        ) : (
          <div style={S.logo} onClick={onLogoTap}>
            CHIMERA<span style={{ color: "#ffd34d" }}>·</span>CARDS
            <span style={S.versionTag}>{APP_VERSION}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {gold > 0 && <div style={{ color: "#ffd34d", fontWeight: 700, fontSize: 14 }}>🪙 {gold}</div>}
          {inRun && floor > 0 && <div style={S.floorTag}>DEPTH {floor}</div>}
        </div>
      </div>

      {showTabs && hasStarter && screen !== "starter" && (
        <nav style={S.tabBar}>
          {[
            ...(["collection", "compendium", "items"].includes(screen) && baseScreen ? [["__back", "↩", "Return"]] : []),
            ["collection", "🐾", "Monsters"],
            ["compendium", "📖", "Codex"],
            ["items", "🎒", "Bag"],

          ].map(([key, icon, label]) => {
            const active = screen === key;
            return (
              <button
                key={key}
                style={{ ...S.tab, ...(active ? S.tabActive : null) }}
                onClick={() => setScreen(key === "__back" ? baseScreen : key)}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 10, letterSpacing: 0.5 }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

function Title({ onStart }) {
  return (
    <div style={S.title}>
      <div className="float" style={{ fontSize: 80 }}>🜂🜄🜁</div>
      <h1 style={S.h1}>CHIMERA CARDS</h1>
      <p style={S.tagline}>
        Capture beasts. Forge them from pure description. Fuse two into one.
        Descend a deck-driven dungeon that never plays the same way twice.
      </p>
      <button style={S.bigBtn} onClick={onStart}>Enter the Den →</button>
      <div style={S.featRow}>
        <Feat icon="🃏" t="Card combat" d="Every move is a card, Spire-style." />
        <Feat icon="🧬" t="AI forge" d="Describe a monster, get art + moves." />
        <Feat icon="⚗️" t="Fusion" d="Merge any two creatures." />
        <Feat icon="🗝️" t="Roguelike" d="Scaling floors, capture rewards." />
      </div>
    </div>
  );
}
function Feat({ icon, t, d }) {
  return (
    <div style={S.feat}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <strong style={{ color: "#ffd34d" }}>{t}</strong>
      <span style={{ opacity: 0.7, fontSize: 13 }}>{d}</span>
    </div>
  );
}

function MonsterSprite({ m, size = 64 }) {
  if (m.svg) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          overflow: "hidden",
          ...gradBorderStyle(m, "#0c0b16", 2),
        }}
        dangerouslySetInnerHTML={{
          __html: m.svg.replace(/<svg /, `<svg style="width:100%;height:100%;display:block" `),
        }}
      />
    );
  }
  if (m.imageUrl) {
    return (
      <img
        src={m.imageUrl}
        alt={m.name}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 12, border: "2px solid #2a2a3a" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.55,
        background: `radial-gradient(circle, ${ELEMENT_COLOR[m.element] || "#888"}33, transparent)`,
        borderRadius: 12,
      }}
    >
      {m.sprite}
    </div>
  );
}

// Fills whatever container it's in with the best art we have:
// a real rendered image (imageUrl) > AI SVG > emoji placeholder.
function MonsterArt({ m }) {
  if (m.imageUrl) {
    return (
      <img
        src={m.imageUrl}
        alt={m.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  if (m.svg) {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{
          __html: m.svg.replace(/<svg /, `<svg preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block" `),
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        fontSize: 90,
        background: `radial-gradient(circle at 50% 38%, ${ELEMENT_COLOR[m.element] || "#888"}44, transparent 70%)`,
      }}
    >
      {m.sprite}
    </div>
  );
}

// A full trading-card-game style frame. The art window accepts a
// rendered imageUrl when a backend provides one, and otherwise shows
// the AI SVG or emoji. Element drives the whole color treatment.
function TCGCard({ m, width = 280, footer = null }) {
  const accent = ELEMENT_COLOR[m.element] || "#c9a66b";
  const h = width * 1.4;
  return (
    <div style={{ ...tcg.card, width, height: h, "--accent": accent }}>
      {/* foil sheen */}
      <div style={tcg.sheen} />
      {/* ornate outer border */}
      <div style={{ ...tcg.border, ...gradBorderStyle(m, "#0f0d1c", 3), borderColor: undefined }}>
        {/* title bar */}
        <div style={tcg.titleBar}>
          <span style={tcg.name}>{m.name}{formLabel(m) ? <span style={{ fontSize: 10, color: "#ffd34d", marginLeft: 5 }}>{formLabel(m)}</span> : null}</span>
          <span style={{ ...tcg.elementGem, background: accent }}>{ELEMENT_GLYPH[m.element] || "◆"}</span>
        </div>

        {/* art window */}
        <div style={{ ...tcg.artWindow, boxShadow: `inset 0 0 0 2px ${accent}, inset 0 0 24px ${accent}55` }}>
          <MonsterArt m={m} />
          {/* HP badge */}
          <div style={{ ...tcg.hpBadge, background: accent }}>
            <span style={{ fontSize: 9, opacity: 0.8 }}>HP</span> {m.maxHp}
          </div>
          {/* corner filigree */}
          <span style={{ ...tcg.corner, top: 4, left: 4, borderColor: accent }} />
          <span style={{ ...tcg.corner, top: 4, right: 4, borderColor: accent, transform: "scaleX(-1)" }} />
        </div>

        {/* type line */}
        <div style={tcg.typeLine}>
          <span style={{ ...tcg.elementPillSm, background: accent }}>{monElements(m).join(" · ")}</span>
          <span style={{ opacity: 0.55, fontSize: 10, letterSpacing: 1 }}>SIGNATURE BEAST</span>
        </div>

        {/* description box */}
        <div style={tcg.descBox}>
          <p style={tcg.descText}>{m.desc || "A mysterious creature with untold power."}</p>
          {m.boon && (
            <div style={{ fontSize: 10, color: "#ff7ad9", fontWeight: 700, marginTop: 4 }}>
              ✦ {m.boon.name}
            </div>
          )}
          <div style={tcg.cardCount}>{m.cards.length} moves in deck</div>
        </div>

        {footer && <div style={tcg.footer}>{footer}</div>}
      </div>
    </div>
  );
}

// View-only collection, reachable from anywhere. Team changes happen at
// the Den (a place on the overworld map).
// ---------- NPC dialog + quest board ----------
function NPCTalk({ npc, stats, seen, activeQuests, doneQuests, onAccept, onTurnIn, onRivalBattle, onLeave }) {
  const chain = QUESTS.filter((q) => q.giver === npc.id);
  const next = chain.find((q) => !doneQuests.has(q.id) && !activeQuests.includes(q.id));
  const active = chain.filter((q) => activeQuests.includes(q.id));
  const allDone = chain.every((q) => doneQuests.has(q.id));
  return (
    <div>
      <div style={S.sectionHead}>
        <h2 style={S.h2}><span style={{ fontSize: 30 }}>{npc.icon}</span> {npc.name}</h2>
        <button style={{ ...S.ghostBtn, marginTop: 0 }} onClick={onLeave}>Leave</button>
      </div>
      <p style={{ opacity: 0.8, fontStyle: "italic" }}>"{allDone ? (npc.id === "rival" ? "Fine. You're... not terrible. Now stop following me." : "Splendid work. The dex sings your praises!") : npc.greet}"</p>
      {onRivalBattle && (
        <button style={{ ...S.bigBtn, marginBottom: 14 }} onClick={onRivalBattle}>⚔️ Battle {npc.name}!</button>
      )}
      {active.map((q) => {
        const pr = questProgress(q, stats, seen);
        return (
          <div key={q.id} style={{ ...S.adminRow, cursor: "default", borderColor: pr.done ? "#7ee787" : "#2c2a40" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>📜 {q.title}</strong>
              <span style={{ fontSize: 11, color: pr.done ? "#7ee787" : "#ffd34d" }}>{pr.cur}/{pr.need}</span>
              {pr.done && <button style={{ ...S.cheatBtn, marginLeft: "auto" }} onClick={() => onTurnIn(q)}>Turn in ✅</button>}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{q.text}</div>
          </div>
        );
      })}
      {next && (
        <div style={{ ...S.adminRow, cursor: "default", borderColor: "#ffd34d66" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>❗ {next.title}</strong>
            <button style={{ ...S.cheatBtn, marginLeft: "auto" }} onClick={() => onAccept(next)}>Accept</button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{next.text}</div>
        </div>
      )}
      {chain.filter((q) => doneQuests.has(q.id)).map((q) => (
        <div key={q.id} style={{ fontSize: 11, opacity: 0.45 }}>✅ {q.title}</div>
      ))}
    </div>
  );
}

function MonstersGallery({ collection, team }) {
  const [detail, setDetail] = useState(null);
  return (
    <div>
      <h2 style={S.h2}>Your Monsters ({collection.length})</h2>
      <p style={{ opacity: 0.65 }}>Browsing only. Visit 🏠 Your Den on the overworld to change your team, evolve, or tutor moves.</p>
      <div style={S.grid}>
        {collection.map((m) => (
          <div key={m.uid} style={{ ...S.monCard, borderColor: team.includes(m.uid) ? "#7ee787" : "#262633" }} onClick={() => setDetail(detail === m.uid ? null : m.uid)}>
            {team.includes(m.uid) && <div style={S.teamBadge}>TEAM</div>}
            <MonsterSprite m={m} size={52} />
            <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>
              {m.name} {formLabel(m) && <span style={{ fontSize: 10, color: "#ffd34d" }}>{formLabel(m)}</span>}
            </div>
            <ElementPills m={m} />
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{stageLabel(m)}</div>
            {detail === m.uid && (
              <div style={{ marginTop: 6, textAlign: "left" }}>
                {m.cards.map((c, i) => (
                  <div key={i} style={{ fontSize: 10, opacity: 0.8 }}>
                    {c.eggMove ? "🥚 " : c.learned ? "🎓 " : c.transferred ? "💸 " : "• "}{c.name} ({c.cost}) — {c.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Move Tutor (Den only) ----------
function MoveTutor({ collection, gold, items, materials, onLearnType, onLearnSpecial, onForget, onTransfer, iconArt, onPaint }) {
  const [uid2, setUid] = useState(null);
  const [transferIdx, setTransferIdx] = useState(null);
  const mon = collection.find((m) => m.uid === uid2) || null;
  const tomes = items.filter((i) => i === "ancienttome").length;
  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={S.h2}>🎓 Move Tutor</h2>
      <p style={{ opacity: 0.65, fontSize: 13 }}>
        Every monster fights with Strike and Guard plus up to {MOVE_CAP} of its own moves. Learn type moves (80g),
        special moves (120g + 📕 Ancient Tome, you have {tomes}), or transfer ANY non-generic move between monsters
        for 400g + 1 🔮 Primal Core.
      </p>
      <select style={S.dexSelect} value={uid2 || ""} onChange={(e) => { setUid(e.target.value || null); setTransferIdx(null); }}>
        <option value="">Select a monster…</option>
        {collection.map((m) => <option key={m.uid} value={m.uid}>{m.sprite} {m.name}{formLabel(m) ? ` (${FORMS[m.form].label})` : ""}</option>)}
      </select>
      {mon && (
        <>
          <h3 style={S.bagSub}>Known moves ({mon.cards.length}/{MOVE_CAP})</h3>
          {mon.cards.map((c, i) => (
            <div key={i} style={{ ...S.adminRow, cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <IconArt svg={iconArt && iconArt[`move:${c.id}`] && iconArt[`move:${c.id}`] !== "…" ? iconArt[`move:${c.id}`] : moveIcon(c, mon.element)} emoji="" size={22} />
                <span style={{ fontSize: 10 }}>{c.eggMove ? "🥚" : c.learned ? "🎓" : c.transferred ? "💸" : "★"}</span>
                <strong style={{ fontSize: 12 }}>{c.name}</strong>
                <span style={{ fontSize: 10, opacity: 0.7 }}>({c.cost}) {c.text}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {(c.learned || c.transferred) && <button style={{ ...S.cheatBtn, fontSize: 10, padding: "3px 7px" }} onClick={() => onForget(mon, i)}>Forget</button>}
                  {transferIdx === i ? (
                    <select style={{ ...S.dexSelect, padding: "3px 6px", fontSize: 10 }} defaultValue="" onChange={(e) => { const r = collection.find((m) => m.uid === e.target.value); if (r) onTransfer(mon, i, r); setTransferIdx(null); }}>
                      <option value="">to whom?</option>
                      {collection.filter((m) => m.uid !== mon.uid).map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                    </select>
                  ) : (
                    <button style={{ ...S.cheatBtn, fontSize: 10, padding: "3px 7px" }} onClick={() => setTransferIdx(i)}>Transfer…</button>
                  )}
                </span>
              </div>
            </div>
          ))}
          <h3 style={S.bagSub}>Learn type moves (80g)</h3>
          {TYPE_MOVES.filter((tm) => (mon.elements && mon.elements.length ? mon.elements : [mon.element]).includes(tm.element)).map((tm) => {
            const known = mon.cards.some((c) => c.id === tm.id);
            return (
              <div key={tm.id} style={{ ...S.adminRow, cursor: "default", opacity: known ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconArt svg={moveIcon(tm, tm.element)} emoji="" size={22} />
                  <strong style={{ fontSize: 12 }}>{tm.name}</strong>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>({tm.cost}) {tm.text}</span>
                  {!known && <button style={{ ...S.cheatBtn, marginLeft: "auto", fontSize: 10, padding: "3px 7px" }} onClick={() => onLearnType(mon, tm)}>Learn 80g</button>}
                  {known && <span style={{ marginLeft: "auto", fontSize: 10, color: "#7ee787" }}>known</span>}
                </div>
              </div>
            );
          })}
          <h3 style={S.bagSub}>Special moves (120g + 📕)</h3>
          {SPECIAL_MOVES.map((sm) => {
            const known = mon.cards.some((c) => c.id === sm.id);
            return (
              <div key={sm.id} style={{ ...S.adminRow, cursor: "default", opacity: known ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconArt svg={moveIcon(sm, null)} emoji="" size={22} />
                  <strong style={{ fontSize: 12 }}>{sm.name}</strong>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>({sm.cost}) {sm.text}</span>
                  {!known && <button style={{ ...S.cheatBtn, marginLeft: "auto", fontSize: 10, padding: "3px 7px" }} onClick={() => onLearnSpecial(mon, sm)}>Learn</button>}
                  {known && <span style={{ marginLeft: "auto", fontSize: 10, color: "#7ee787" }}>known</span>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Collection({ collection, team, setTeam, onDungeon, onEvolve, items }) {
  const [inspect, setInspect] = useState(null);
  const toggle = (uid) => {
    setTeam((t) => {
      if (t.includes(uid)) return t.filter((x) => x !== uid);
      if (t.length >= 3) return t;
      return [...t, uid];
    });
  };
  const evoTarget = inspect ? evolutionTarget(inspect) : null;
  const evoCheck = inspect ? checkEvolution(inspect, items || []) : null;
  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>The Den</h2>
          <p style={{ opacity: 0.65, margin: 0 }}>
            Tap a monster to add it to your team (take 1 to 3 with you). Tap “view” for its card and evolution progress.
          </p>
        </div>
        <button style={{ ...S.bigBtn, marginTop: 0 }} disabled={team.length === 0} onClick={onDungeon}>
          Exit Den 🚪 ({team.length}/3)
        </button>
      </div>
      <div style={S.grid}>
        {collection.map((m) => {
          const idx = team.indexOf(m.uid);
          const ready = !!evolutionTarget(m) && checkEvolution(m, items || []).met;
          return (
            <div
              key={m.uid}
              style={{
                ...S.monCard,
                borderColor: idx >= 0 ? ELEMENT_COLOR[m.element] : "#262633",
                boxShadow: idx >= 0 ? `0 0 0 2px ${ELEMENT_COLOR[m.element]}55` : "none",
              }}
              onClick={() => toggle(m.uid)}
            >
              {idx >= 0 && <div style={S.teamBadge}>{idx + 1}</div>}
              {ready && <div style={S.evoDot} title="Ready to evolve">⬆</div>}
              <MonsterSprite m={m} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>{m.name}</div>
              <ElementPills m={m} />
              <div style={{ fontSize: 11, color: RARITY_COLOR[m.rarity], fontWeight: 700, letterSpacing: 1 }}>
                {m.rarity}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>HP {m.maxHp} · XP {m.prog?.xp || 0}</div>
              <button
                style={S.viewBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setInspect(m);
                }}
              >
                view card
              </button>
            </div>
          );
        })}
      </div>

      {inspect && (
        <div style={S.modalBackdrop} onClick={() => setInspect(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <TCGCard m={inspect} width={300} />
            <div style={S.moveList}>
              {inspect.cards.map((c) => (
                <div key={c.cid || c.id} style={{ ...S.moveChip, borderColor: ELEMENT_COLOR[inspect.element] }}>
                  <strong>{c.name}</strong> <span style={{ opacity: 0.6 }}>· {c.cost}⚡ {c.type}</span>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>{c.text}</div>
                </div>
              ))}
            </div>

            {/* evolution panel */}
            {evoTarget && (
              <div style={S.evoPanel}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  Evolution → {evoTarget.name}
                </div>
                {evoCheck.req && evoCheck.req.flavor && (
                  <div style={{ fontSize: 11, fontStyle: "italic", opacity: 0.65, marginBottom: 8 }}>
                    {evoCheck.req.flavor}
                  </div>
                )}
                {evoCheck.reasons.map((r, i) => (
                  <div key={i} style={S.evoReq}>
                    <span style={{ color: r.ok ? "#7ee787" : "#ff8a8a" }}>{r.ok ? "✓" : "✗"}</span>
                    <span style={{ flex: 1 }}>{r.label}</span>
                    <span style={{ opacity: 0.7, fontFamily: "monospace" }}>
                      {Math.min(r.have, r.need)}/{r.need}
                    </span>
                  </div>
                ))}
                <button
                  style={{ ...S.bigBtn, marginTop: 10, opacity: evoCheck.met ? 1 : 0.4 }}
                  disabled={!evoCheck.met}
                  onClick={() => {
                    onEvolve(inspect);
                    setInspect(null);
                  }}
                >
                  {evoCheck.met ? `Evolve into ${evoTarget.name}` : "Requirements not met"}
                </button>
              </div>
            )}

            <button style={S.ghostBtn} onClick={() => setInspect(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Compendium ----------
// Discovery levels: undiscovered (locked), seen (fought: shows silhouette
// info only), owned (captured/owned now or before: shows full card).
function Compendium({ seen, collection, seenItems }) {
  const [detail, setDetail] = useState(null); // {template, level}
  const [tab, setTab] = useState("beasts"); // beasts | items | mechanics
  const [query, setQuery] = useState("");
  const [elFilter, setElFilter] = useState("all");
  const [rarFilter, setRarFilter] = useState("all");
  const ownedNames = new Set(collection.map((m) => m.name));
  const discovered = DEFAULT_MONSTERS.filter((t) => seen.has(t.name)).length;

  const levelOf = (t) => (ownedNames.has(t.name) ? "owned" : seen.has(t.name) ? "seen" : "locked");

  // dex-ordered entries; undiscovered hide whenever a filter could leak info
  const filtering = query.trim() !== "" || elFilter !== "all" || rarFilter !== "all";
  const dexEntries = CODEX_ORDER.map((name) => DEFAULT_MONSTERS.find((t) => t.name === name)).filter(Boolean).filter((t) => {
    const known = levelOf(t) !== "locked";
    if (!known) return !filtering; // ??? entries only show in the unfiltered dex
    if (query.trim() && !t.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (elFilter !== "all" && !(t.elements && t.elements.length ? t.elements : [t.element]).includes(elFilter)) return false;
    if (rarFilter !== "all" && t.rarity !== rarFilter) return false;
    return true;
  });

  return (
    <div>
      <h2 style={S.h2}>Codex</h2>

      {/* sub-tabs */}
      <div style={S.codexTabs}>
        {[
          ["beasts", "📖 Beasts"],
          ["items", "🎒 Items"],
          ["mechanics", "⚙️ Mechanics"],
        ].map(([k, label]) => (
          <button
            key={k}
            style={{ ...S.codexTab, ...(tab === k ? S.codexTabActive : null) }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "beasts" && (
        <>
          <p style={{ opacity: 0.65 }}>
            {discovered} / {DEFAULT_MONSTERS.length} species discovered. Fight one to log it; capture or own it to reveal its full card.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              style={{ ...S.textarea, minHeight: 0, flex: 1, minWidth: 120, marginBottom: 0 }}
              placeholder="Search name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select style={S.dexSelect} value={elFilter} onChange={(e) => setElFilter(e.target.value)}>
              <option value="all">All elements</option>
              {ELEMENTS.map((el) => <option key={el} value={el}>{ELEMENT_GLYPH[el]} {el}</option>)}
            </select>
            <select style={S.dexSelect} value={rarFilter} onChange={(e) => setRarFilter(e.target.value)}>
              <option value="all">All rarities</option>
              {RARITY_LADDER.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {filtering && <p style={{ fontSize: 11, opacity: 0.5, marginTop: 0 }}>Filters only search discovered species; undiscovered entries stay hidden.</p>}
          <div style={S.codexGrid}>
            {dexEntries.map((t) => {
              const level = levelOf(t);
              const known = level !== "locked";
              const els = t.elements && t.elements.length ? t.elements : [t.element];
              return (
                <button
                  key={t.name}
                  disabled={!known}
                  onClick={() => known && setDetail({ template: t, level })}
                  style={{
                    ...S.codexCard,
                    borderColor: known ? ELEMENT_COLOR[t.element] + "66" : "#222230",
                    opacity: known ? 1 : 0.45,
                    cursor: known ? "pointer" : "default",
                    color: "#e8e6f0",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 9, opacity: 0.55, fontWeight: 700 }}>#{String(dexNumber(t.name)).padStart(3, "0")}</div>
                  <div style={{ fontSize: 34 }}>{known ? t.sprite : "❔"}</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{known ? t.name : "???"}</div>
                  {known && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>
                        {els.map((el) => <span key={el} style={{ color: ELEMENT_COLOR[el], marginRight: 4 }}>{ELEMENT_GLYPH[el]}{el}</span>)}
                      </div>
                      <div style={{ fontSize: 10, color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>
                        {t.rarity} · T{t.tier}
                      </div>
                      {level === "owned" && <div style={S.ownedTag}>owned</div>}
                      {level === "seen" && <div style={S.seenTag}>seen</div>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "items" && <CodexItems seenItems={seenItems} />}
      {tab === "mechanics" && <CodexMechanics />}

      {detail && (
        <CodexDetail detail={detail} seen={seen} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

// ---- Codex: Items (only discovered items, locked otherwise) ----
function CodexItems({ seenItems }) {
  const groups = [
    ["special", "Special"],
    ["sigil", "Sigils"],
    ["potion", "Potions"],
  ];
  const discovered = ITEMS.filter((it) => seenItems.has(it.id)).length;
  return (
    <div>
      <p style={{ opacity: 0.65 }}>
        {discovered} / {ITEMS.length} items discovered. Find an item once to log it here permanently.
      </p>
      {groups.map(([kind, label]) => {
        const list = ITEMS.filter((it) => it.kind === kind);
        return (
          <div key={kind} style={{ marginBottom: 20 }}>
            <div style={S.bagSub}>{label}</div>
            <div style={S.itemGrid}>
              {list.map((it) => {
                const known = seenItems.has(it.id);
                return (
                  <div
                    key={it.id}
                    style={{
                      ...S.itemTile,
                      borderColor: known ? RARITY_COLOR[it.rarity] + "66" : "#222230",
                      opacity: known ? 1 : 0.55,
                    }}
                  >
                    <div style={{ fontSize: 26 }}>{known ? it.icon : "❔"}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{known ? it.name : "???"}</div>
                    {known ? (
                      <>
                        <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
                          {it.kind} · {it.rarity}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>{it.text}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, opacity: 0.5 }}>Undiscovered</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Codex: Mechanics reference ----
function CodexMechanics() {
  const section = (title, body) => (
    <div style={S.mechCard}>
      <div style={S.mechTitle}>{title}</div>
      <div style={S.mechBody}>{body}</div>
    </div>
  );
  return (
    <div>
      <p style={{ opacity: 0.65 }}>How the game works.</p>

      {section("⚔️ Card combat", "Each monster fights from its own deck of cards. You have energy (usually 3) per turn to play cards. Attacks deal damage, skills grant defense or utility, powers give lasting buffs. End your turn and the enemy acts.")}

      {section("🔄 Swapping & HP", "Only one monster is active at a time, with its own HP and hand. You may swap once per turn (free). HP carries between fights, so heal at rest sites and inns. A monster faints at 0 HP; lose all monsters and the battle ends.")}

      {section("🛡️ Block vs ✶ Shield", "Block protects only the active monster and resets at the start of your turn. Shield is a team-wide wall that also resets each turn but persists through swaps, so build it on a tank then swap to an attacker. Damage hits Shield first, then Block, then HP.")}

      {section("🔥 Statuses", "Burn: the enemy loses HP at end of turn (decays). Weak: the enemy deals less damage. Vulnerable 🎯: the enemy takes +50% damage. 💚 Regen heals the active monster each turn. Some cards heal the whole team at once.")}

      {section("🌟 Elements", "Six elements form a type chart. Strong matchups deal ×1.5, weak ones ×0.66. ember ▶ gale, stone · tide ▶ ember, stone · gale ▶ tide, lumen · stone ▶ gale, umbra · umbra ▶ ember, lumen · lumen ▶ tide, umbra. A monster also resists its own element (×0.75).")}

      {section("🔗 Team synergy & affinity", "Each monster gains +1 Strength for every other teammate sharing its element, so mono-element teams hit harder. Element affinity boosts themed statuses: ember adds extra Burn, tide extra Weak, umbra extra Vulnerable.")}

      {section("🃏 Card keywords", "Retain: the card stays in hand at end of turn instead of discarding. Exhaust: a powerful card that leaves the deck after one use. Some cards grant bonus energy or draw to enable combos.")}

      {section("⬆️ Evolution", "Monsters evolve when they meet their unique requirements (XP plus deeds like winning battles, defeating bosses, or looting treasure) and you hold an Evolution Stone, which is consumed. Each species has its own conditions.")}

      {section("⚗️ Fusion", "Combine two monsters at compatible evolution stages (same stage number, or both final forms) using a Fusion Catalyst. The AI designs a hybrid blending both parents' stats, art, and moves.")}

      {section("✨ Forging", "Spend a Genesis Spark to forge a brand-new monster from a description. A prize wheel rolls its rarity, evolution potential, stat focus, and a possible signature boon. Higher rarity means stronger stats but fewer possible evolutions.")}

      {section("🥚 Breeding", "In the Fusion Chamber's Nursery, two monsters sharing an element or a line can produce an egg; BOTH parents are kept. The egg hatches into a Baby of parent A's base species after a few battle wins, inheriting one egg move from parent B that survives evolution. Fusion consumes monsters to concentrate power; breeding grows your collection and customizes movesets.")}
      {section("🔴 Capture & items", "Catching a monster after a battle consumes a Beast Ball. Sigils are permanent team-wide passives, always active once owned. Artifacts are powerful passives found ONLY inside dungeons and crumble when the run ends. Potions are one-time uses; special items enable evolution, fusion, forging, and capture.")}

      {section("🗺️ Overworld & dungeons", "Explore the overworld on foot. Tall grass triggers wild encounters. Buildings are shops, inns, and dungeon entrances. Dungeons are branching runs of battles, elites, treasure, mystery, rest, and a boss, ending back in the overworld.")}
    </div>
  );
}

// Detail modal. Only renders what the player has earned the right to see.
function CodexDetail({ detail, seen, onClose }) {
  const { template: t, level } = detail;
  const accent = ELEMENT_COLOR[t.element] || "#c9a66b";
  const owned = level === "owned";
  // for the card art we reuse the TCG frame; description is hidden until owned
  const display = {
    name: t.name,
    element: t.element,
    sprite: t.sprite,
    svg: null,
    imageUrl: null,
    maxHp: owned ? t.hp : "??",
    desc: owned ? t.desc : "You have encountered this beast but not yet captured it. Its secrets remain hidden.",
    cards: owned ? t.cards : [],
    rarity: t.rarity,
  };
  // evolution line: only reveal the next form's name if that form is discovered
  const nextKnown = t.evolvesTo && seen.has(t.evolvesTo);
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 320 }}>
        <TCGCard m={display} width={300} />

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={S.codexInfoRow}>
            <span style={{ opacity: 0.6 }}>Element</span>
            <span style={{ color: accent, fontWeight: 700 }}>{t.element}</span>
          </div>
          <div style={S.codexInfoRow}>
            <span style={{ opacity: 0.6 }}>Rarity</span>
            <span style={{ color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>{t.rarity}</span>
          </div>
          <div style={S.codexInfoRow}>
            <span style={{ opacity: 0.6 }}>Evolution</span>
            <span style={{ fontWeight: 700 }}>
              {!t.evolvesTo ? "Final form" : nextKnown ? `→ ${t.evolvesTo}` : "→ ???"}
            </span>
          </div>
        </div>

        {/* moveset only when owned */}
        {owned ? (
          <div style={S.moveList}>
            {t.cards.map((c) => (
              <div key={c.id} style={{ ...S.moveChip, borderColor: accent }}>
                <strong>{c.name}</strong> <span style={{ opacity: 0.6 }}>· {c.cost}⚡ {c.type}</span>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{c.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={S.lockedMoves}>
            🔒 Moveset hidden. Capture this monster to study its cards.
          </div>
        )}

        <button style={S.ghostBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ---------- Items / Bag ----------
function ItemsScreen({ items, materials, iconArt, onPaint }) {
  const counts = {};
  items.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  const owned = Object.keys(counts).map((id) => ITEMS.find((it) => it.id === id)).filter(Boolean);
  const sigils = owned.filter((it) => it.kind === "sigil");
  const potions = owned.filter((it) => it.kind === "potion");
  const specials = owned.filter((it) => it.kind === "special");
  const matEntries = MATERIALS.filter((m) => ((materials || {})[m.id] || 0) > 0);
  const empty = owned.length === 0 && matEntries.length === 0;
  return (
    <div>
      <h2 style={S.h2}>The Bag</h2>
      <p style={{ opacity: 0.65 }}>
        What you're currently carrying. See the Codex for the full item catalog and what each does.
      </p>

      {empty && (
        <p style={{ opacity: 0.5, marginTop: 20 }}>
          Your bag is empty. Find items in shops, treasure, and battle rewards.
        </p>
      )}

      {specials.length > 0 && (
        <>
          <h3 style={S.bagSub}>Special</h3>
          <div style={S.itemGrid}>
            {specials.map((it) => (
              <ItemTile key={it.id} it={it} count={counts[it.id]} iconArt={iconArt} />
            ))}
          </div>
        </>
      )}

      {matEntries.length > 0 && (
        <>
          <h3 style={S.bagSub}>Materials</h3>
          <div style={S.dropsBar}>
            {matEntries.map((m) => (
              <span key={m.id} style={S.dropPill} title={m.text}>{m.icon} {m.name} ×{materials[m.id]}</span>
            ))}
          </div>
          <p style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>Use materials in the Workshop (⚒️ Craft tab).</p>
        </>
      )}

      {sigils.length > 0 && (
        <>
          <h3 style={S.bagSub}>Sigils</h3>
          <p style={{ fontSize: 11, opacity: 0.55, marginTop: 0 }}>
            Permanent team-wide passives, always active for your whole team in every battle.
          </p>
          <div style={S.itemGrid}>
            {sigils.map((it) => (
              <ItemTile key={it.id} it={it} count={counts[it.id]} iconArt={iconArt} />
            ))}
          </div>
        </>
      )}

      {potions.length > 0 && (
        <>
          <h3 style={S.bagSub}>Potions</h3>
          <div style={S.itemGrid}>
            {potions.map((it) => (
              <ItemTile key={it.id} it={it} count={counts[it.id]} iconArt={iconArt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Crafting workshop ----------
function CraftScreen({ materials, collection, team, onCraft, onTransmute, seenMaterials, knownRecipes, onBack }) {
  const [sub, setSub] = useState("craft"); // craft | transmute
  const [confirmUid, setConfirmUid] = useState(null); // transmute confirm

  const matEntries = MATERIALS.filter((m) => (materials[m.id] || 0) > 0);
  const known = RECIPES.filter((r) => knownRecipes.has(r.item));
  const unknownCount = RECIPES.length - known.length;

  return (
    <div>
      <div style={S.sectionHead}>
        <h2 style={S.h2}>Workshop ⚒️</h2>
        {onBack && <button style={{ ...S.ghostBtn, marginTop: 0 }} onClick={onBack}>Back to Den</button>}
      </div>
      <div style={S.codexTabs}>
        <button style={{ ...S.codexTab, ...(sub === "craft" ? S.codexTabActive : {}) }} onClick={() => setSub("craft")}>⚒️ Craft</button>
        <button style={{ ...S.codexTab, ...(sub === "transmute" ? S.codexTabActive : {}) }} onClick={() => setSub("transmute")}>⚗️ Transmute</button>
      </div>

      {/* material stash, always visible */}
      <h3 style={S.bagSub}>Your materials</h3>
      {matEntries.length === 0 && (
        <p style={{ fontSize: 12, opacity: 0.55 }}>None yet. Defeat monsters to collect materials, or transmute a captured monster.</p>
      )}
      <div style={S.dropsBar}>
        {matEntries.map((m) => (
          <span key={m.id} style={S.dropPill} title={`${m.text} In battle: ${m.use}`}>{m.icon} {m.name} ×{materials[m.id]}</span>
        ))}
      </div>

      {sub === "craft" && (
        <>
          <h3 style={S.bagSub}>Recipes ({known.length}/{RECIPES.length} learned)</h3>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0 }}>
            "Any element" costs are paid with any mix of element materials (largest stacks first).
          </p>
          {known.length === 0 && (
            <p style={{ fontSize: 12, opacity: 0.55 }}>You don't know any recipes yet.</p>
          )}
          {known.map((r) => {
            const it = ITEMS.find((x) => x.id === r.item);
            if (!it) return null;
            const check = canCraft(r, materials);
            return (
              <div key={r.item} style={{ ...S.adminRow, cursor: "default" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22 }}>{it.icon}</span>
                  <strong style={{ fontSize: 13 }}>{it.name}</strong>
                  <span style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>{it.kind}</span>
                  <button
                    style={{ ...S.cheatBtn, marginLeft: "auto", opacity: check.ok ? 1 : 0.35 }}
                    disabled={!check.ok}
                    onClick={() => onCraft(r)}
                  >
                    Craft
                  </button>
                </div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
                  Cost: {r.needs.map((n) => `${n.qty}× ${materialById(n.id).icon} ${materialById(n.id).name}`).join(", ")}
                  {r.anyElement > 0 && `${r.needs.length ? ", " : ""}${r.anyElement}× any element material`}
                </div>
                {!check.ok && (
                  <div style={{ fontSize: 10, color: "#ff8a8a", marginTop: 2 }}>Need {check.missing.join("; ")}</div>
                )}
              </div>
            );
          })}
          {unknownCount > 0 && (
            <div style={{ ...S.adminRow, cursor: "default", opacity: 0.6 }}>
              <div style={{ fontSize: 12 }}>
                📜 <strong>{unknownCount} undiscovered recipe{unknownCount > 1 ? "s" : ""}</strong>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                Find recipe scrolls in elite and boss spoils, rarely in Deep Markets, or by completing feats.
              </div>
            </div>
          )}
        </>
      )}

      {sub === "transmute" && (
        <>
          <h3 style={S.bagSub}>Transmute a monster</h3>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0 }}>
            Permanently destroys the monster. Each material below rolls independently at the shown chance; on a hit
            you gain one AND roll that chance again, repeating until a miss. Lucky streaks stack. Undiscovered
            materials show as ??? until you've found one. Your last monster can't be transmuted.
          </p>
          {collection.map((m) => {
            const table = transmuteTable(m);
            const onTeam = team.includes(m.uid);
            const isLast = collection.length <= 1;
            const confirming = confirmUid === m.uid;
            return (
              <div key={m.uid} style={{ ...S.adminRow, cursor: "default", borderColor: confirming ? "#ff5a4d" : "#2c2a40" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <MonsterSprite m={m} size={34} />
                  <strong style={{ fontSize: 13 }}>{m.name}</strong>
                  <span style={{ fontSize: 10, color: RARITY_COLOR[m.rarity] }}>{m.rarity}</span>
                  {onTeam && <span style={{ fontSize: 9, color: "#7ee787", fontWeight: 700 }}>ON TEAM</span>}
                  {!confirming ? (
                    <button
                      style={{ ...S.cheatBtn, marginLeft: "auto", opacity: isLast ? 0.35 : 1 }}
                      disabled={isLast}
                      onClick={() => setConfirmUid(m.uid)}
                    >
                      Transmute
                    </button>
                  ) : (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button
                        style={{ ...S.cheatBtn, background: "#5a1f1f", color: "#ff8a8a", borderColor: "#ff5a4d88" }}
                        onClick={() => { setConfirmUid(null); onTransmute(m); }}
                      >
                        Confirm destroy
                      </button>
                      <button style={S.cheatBtn} onClick={() => setConfirmUid(null)}>Keep</button>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {table.map((entry) => {
                    const mat = materialById(entry.id);
                    const found = seenMaterials.has(entry.id);
                    return (
                      <span key={entry.id} style={S.dropPill}>
                        {found ? `${mat.icon} ${mat.name}` : "❔ ???"} — {Math.round(entry.chance * 100)}%
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function ItemTile({ it, count, dim, iconArt }) {
  const ai = iconArt && iconArt[`item:${it.id}`];
  const art = ai && ai !== "…" ? ai : itemIcon(it);
  return (
    <div style={{ ...S.itemTile, borderColor: RARITY_COLOR[it.rarity] + "88", opacity: dim ? 0.45 : 1, background: "linear-gradient(180deg,#1b1930,#15132e)" }}>
      <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${RARITY_COLOR[it.rarity]}44`, width: 54, height: 54, margin: "0 auto" }}>
        <IconArt svg={art} emoji={it.icon} size={54} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>
        {it.name} {count > 0 && <span style={{ opacity: 0.6 }}>×{count}</span>}
      </div>
      <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
        {it.kind} · {it.rarity}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75 }}>{it.text}</div>
    </div>
  );
}

// ---------- Cheat / Debug panel ----------
// Show only the tail of a key so it's identifiable but not exposed.
function maskKey(k) {
  if (!k) return null;
  return `…${k.slice(-4)} (${k.length} chars)`;
}


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/admin — debug console
// ║ UPDATE WHEN: ANY new content type (moves, materials, recipes, forms, artifacts…) gets a viewer/cheat here — this is the sync-debt hotspot
// ╚══════════════════════════════════════════════════════════════════╝
function CheatPanel({ onGiveItem, onGiveGold, onSpawn, onGiveXP, onRevealCodex, onLearnRecipes, onGiveMaterials, onMakeMonster, onAddMove, onMakeItem, onPaintIcon, onSaveNow, onExport, onImport, onReset, onClose, gold, items, collection, team, seen, seenItems, materials }) {
  const [mk, setMk] = useState({ name: "Testbeast", el: "pyre", el2: "", hp: 40, rarity: "uncommon", form: "regular", sprite: "🧪", desc: "A debug creature.", art: true, mvName: "Test Bolt", mvType: "attack", mvCost: 1, mvDmg: 8, mvBlock: 0, mvStatus: "", mvAmt: 2, mvTarget: "", itName: "Test Charm", itKind: "potion", itIcon: "🧿", itEffect: "potionHeal", itAmt: 10 });
  const up = (k) => (e) => setMk((o) => ({ ...o, [k]: e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const [tab, setTab] = useState("cheats"); // cheats | roster | systems | state
  const [monQuery, setMonQuery] = useState("");
  const [expanded, setExpanded] = useState(null); // expanded roster monster
  const [keyInput, setKeyInput] = useState("");
  const [saveText, setSaveText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [keyStatus, setKeyStatus] = useState(() =>
    typeof window !== "undefined" && window.ANTHROPIC_API_KEY ? maskKey(window.ANTHROPIC_API_KEY) : null
  );
  const filtered = DEFAULT_MONSTERS.filter((t) =>
    t.name.toLowerCase().includes(monQuery.toLowerCase())
  );
  const tabs = [
    ["cheats", "🛠️ Cheats"],
    ["roster", "📚 Roster"],
    ["systems", "⚙️ Systems"],
    ["state", "🧠 State"],
    ["maker", "🛠️ Maker"],
  ];
  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>🛠️ Admin Console <span style={S.versionTag}>{APP_VERSION}</span></h2>
          <p style={{ opacity: 0.65, margin: 0 }}>Cheats, full content review, system tables, and live game state.</p>
        </div>
        <button style={{ ...S.ghostBtn, marginTop: 0 }} onClick={onClose}>Done</button>
      </div>

      <div style={S.codexTabs}>
        {tabs.map(([key, label]) => (
          <button key={key} style={{ ...S.codexTab, ...(tab === key ? S.codexTabActive : {}) }} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ================= CHEATS ================= */}
      {tab === "cheats" && (
        <>
          <h3 style={S.bagSub}>Quick actions</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button style={S.cheatBtn} onClick={() => onGiveGold(100)}>+100 Gold</button>
            <button style={S.cheatBtn} onClick={() => onGiveGold(1000)}>+1000 Gold</button>
            <button style={S.cheatBtn} onClick={() => onGiveXP(300)}>+300 XP & deeds (team)</button>
            <button style={S.cheatBtn} onClick={onRevealCodex}>Reveal full Codex</button>
            <button style={S.cheatBtn} onClick={onLearnRecipes}>Learn all recipes</button>
            <button style={S.cheatBtn} onClick={onGiveMaterials}>+5 of every material</button>
          </div>

          <h3 style={S.bagSub}>Grant any item</h3>
          <div style={S.itemGrid}>
            {ITEMS.map((it) => (
              <button
                key={it.id}
                style={{ ...S.itemTile, borderColor: RARITY_COLOR[it.rarity] + "66", cursor: "pointer", color: "#e8e6f0", textAlign: "left", fontFamily: "inherit" }}
                onClick={() => onGiveItem(it.id)}
              >
                <div style={{ fontSize: 24 }}>{it.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{it.name}</div>
                <div style={{ fontSize: 9, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
                  {it.kind} · {it.rarity}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{it.text}</div>
                <div style={{ fontSize: 9, color: "#7ee787", marginTop: 2 }}>tap to grant</div>
              </button>
            ))}
          </div>

          <h3 style={S.bagSub}>Spawn any monster</h3>
          <input
            style={{ ...S.textarea, minHeight: 0, marginBottom: 10 }}
            placeholder="Search monster name…"
            value={monQuery}
            onChange={(e) => setMonQuery(e.target.value)}
          />
          <div style={S.codexGrid}>
            {filtered.map((t) => (
              <button
                key={t.name}
                style={{ ...S.codexCard, borderColor: RARITY_COLOR[t.rarity] + "66", cursor: "pointer", color: "#e8e6f0", fontFamily: "inherit" }}
                onClick={() => onSpawn(t)}
              >
                <div style={{ fontSize: 30 }}>{t.sprite}</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{t.name}</div>
                <div style={{ fontSize: 9, color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>{t.rarity} · T{t.tier}</div>
                <div style={{ fontSize: 9, color: "#7ee787" }}>tap to spawn</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ================= ROSTER (full content, lore included) ================= */}
      {tab === "roster" && (
        <>
          <p style={{ fontSize: 12, opacity: 0.65 }}>
            All {DEFAULT_MONSTERS.length} monsters with full data, including the hidden lore briefs and complete movesets. Tap to expand.
          </p>
          <input
            style={{ ...S.textarea, minHeight: 0, marginBottom: 10 }}
            placeholder="Search…"
            value={monQuery}
            onChange={(e) => setMonQuery(e.target.value)}
          />
          {ELEMENTS.map((el) => {
            const mons = filtered.filter((t) => t.element === el);
            if (mons.length === 0) return null;
            return (
              <div key={el}>
                <h3 style={{ ...S.bagSub, color: ELEMENT_COLOR[el] }}>
                  {ELEMENT_GLYPH[el]} {el} ({mons.length})
                </h3>
                {mons.map((t) => {
                  const open = expanded === t.name;
                  const evoInfo = t.evolvesTo ? `→ ${t.evolvesTo}` : "final/standalone";
                  return (
                    <div key={t.name} style={S.adminRow} onClick={() => setExpanded(open ? null : t.name)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{t.sprite}</span>
                        <strong style={{ fontSize: 13 }}>{t.name}</strong>
                        <span style={{ fontSize: 10 }}>{monElements(t).map((el) => <span key={el} style={{ color: ELEMENT_COLOR[el], marginRight: 3 }}>{el}</span>)}</span>
                        <span style={{ fontSize: 10, color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>{t.rarity}</span>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>HP {t.hp} · T{t.tier} · {evoInfo}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
                      </div>
                      {open && (
                        <div style={{ marginTop: 8 }}>
                          <div style={S.adminLabel}>codex desc</div>
                          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{t.desc}</div>
                          <div style={S.adminLabel}>hidden lore (art/move brief)</div>
                          <div style={{ fontSize: 11.5, opacity: 0.75, lineHeight: 1.45, marginBottom: 6 }}>{t.lore || "(none)"}</div>
                          <div style={S.adminLabel}>cards</div>
                          {t.cards.map((c) => (
                            <div key={c.id} style={{ fontSize: 11, opacity: 0.8 }}>
                              <strong>{c.name}</strong> ({c.type}, cost {c.cost}) — {c.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {/* ================= SYSTEMS (matrix, reactions, tables) ================= */}
      {tab === "systems" && (
        <>
          <h3 style={S.bagSub}>Element matchup matrix</h3>
          {ELEMENTS.map((el) => (
            <div key={el} style={{ fontSize: 12, marginBottom: 4 }}>
              <strong style={{ color: ELEMENT_COLOR[el] }}>{ELEMENT_GLYPH[el]} {el}</strong>
              <span style={{ color: "#7ee787" }}> strong: {(MATRIX[el].strong || []).join(", ") || "none"}</span>
              <span style={{ color: "#ff8a8a" }}> · weak: {(MATRIX[el].weak || []).join(", ") || "none"}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            strong ×{MULT_STRONG} · weak ×{MULT_WEAK} · self-element resist ×{SELF_RESIST}
          </div>

          <h3 style={S.bagSub}>Element statuses & affinity</h3>
          {Object.entries(ELEMENT_STATUS).map(([el, st]) => (
            <div key={el} style={{ fontSize: 12 }}>
              <strong style={{ color: ELEMENT_COLOR[el] }}>{el}</strong> → {st} (+1 affinity bonus)
            </div>
          ))}

          <h3 style={S.bagSub}>Reactions</h3>
          {REACTIONS.map((r) => (
            <div key={r.id} style={{ fontSize: 12 }}>
              <strong style={{ color: "#ffd34d" }}>{r.label}</strong>: {r.atk} hit on {r.needs === "any" ? "any status" : r.needs} · {r.clears ? "clears it" : "lingers"}
            </div>
          ))}

          <h3 style={S.bagSub}>Rarity stat budgets</h3>
          {RARITY_LADDER.map((r) => (
            <div key={r} style={{ fontSize: 12 }}>
              <strong style={{ color: RARITY_COLOR[r] }}>{r}</strong>: HP {RARITY_BUDGET[r].hp[0]}–{RARITY_BUDGET[r].hp[1]} · {RARITY_BUDGET[r].power}
            </div>
          ))}

          <h3 style={S.bagSub}>Boons</h3>
          {BOONS.filter((b) => b.id !== "none" && b.id !== "none2").map((b) => (
            <div key={b.id} style={{ fontSize: 12 }}>
              <strong>{b.name}</strong> (min {b.min}): {b.text}
            </div>
          ))}

          <h3 style={S.bagSub}>Materials & drop rules</h3>
          {MATERIALS.map((m) => (
            <div key={m.id} style={{ fontSize: 12 }}>
              {m.icon} <strong>{m.name}</strong>{m.element ? <span style={{ color: ELEMENT_COLOR[m.element] }}> ({m.element})</span> : " (universal)"} — {m.text}
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            Drops: dust always (×2 elite, ×3 boss) · element material ~70% (+qty for evolved) · essence 15%+8%/rarity rung ·
            core from rare+ · celestial from legendary+ · elite ×1.3, boss ×1.5, wild ×0.85. Transmute is deterministic and scales with rarity, stage, and XP.
          </div>

          <h3 style={S.bagSub}>Moves</h3>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Generic (auto in every deck):</div>
          {UNIVERSAL_CARDS.slice(0, 2).map((c) => <div key={c.id} style={{ fontSize: 12 }}><strong>{c.name}</strong> ({c.cost}) — {c.text}</div>)}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Type moves (tutor, 80g, element-gated):</div>
          {TYPE_MOVES.map((c) => <div key={c.id} style={{ fontSize: 12 }}><strong style={{ color: ELEMENT_COLOR[c.element] }}>{c.name}</strong> ({c.cost}) — {c.text}</div>)}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Special moves (tutor, 120g + Ancient Tome):</div>
          {SPECIAL_MOVES.map((c) => <div key={c.id} style={{ fontSize: 12 }}><strong>✦ {c.name}</strong> ({c.cost}) — {c.text}</div>)}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Transfer: 400g + 1 Primal Core. Cap {MOVE_CAP} moves/monster.</div>

          <h3 style={S.bagSub}>Recipes</h3>
          {RECIPES.map((r) => {
            const it = ITEMS.find((x) => x.id === r.item);
            return (
              <div key={r.item} style={{ fontSize: 12 }}>
                {it.icon} <strong>{it.name}</strong>: {r.needs.map((n) => `${n.qty}× ${materialById(n.id).name}`).join(", ")}
                {r.anyElement > 0 && `${r.needs.length ? ", " : ""}${r.anyElement}× any element`}
              </div>
            );
          })}
        </>
      )}

      {/* ================= MAKER (debug content creation) ================= */}
      {tab === "maker" && (() => {
        const num = (v) => parseInt(v, 10) || 0;
        const I = (k, w = 90) => <input style={{ ...S.textarea, minHeight: 0, width: w, marginBottom: 0 }} value={mk[k]} onChange={up(k)} />;
        const row = { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 };
        return (
          <>
            <h3 style={S.bagSub}>🧬 Monster maker</h3>
            <div style={row}>
              {I("name", 120)}
              <select style={S.dexSelect} value={mk.el} onChange={up("el")}>{ELEMENTS.map((e) => <option key={e}>{e}</option>)}</select>
              <select style={S.dexSelect} value={mk.el2} onChange={up("el2")}><option value="">no 2nd type</option>{ELEMENTS.map((e) => <option key={e}>{e}</option>)}</select>
              {I("hp", 55)}
              <select style={S.dexSelect} value={mk.rarity} onChange={up("rarity")}>{RARITY_LADDER.map((r) => <option key={r}>{r}</option>)}</select>
              <select style={S.dexSelect} value={mk.form} onChange={up("form")}>{FORM_ORDER.map((f) => <option key={f}>{f}</option>)}</select>
              {I("sprite", 50)}
            </div>
            <div style={row}><input style={{ ...S.textarea, minHeight: 0, flex: 1 }} value={mk.desc} onChange={up("desc")} placeholder="description (drives AI art)" /></div>
            <div style={row}>
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={mk.art} onChange={up("art")} /> 🎨 generate AI art (needs key outside Claude)</label>
              <button style={S.cheatBtn} onClick={() => onMakeMonster({ name: mk.name, element: mk.el, elements: mk.el2 ? [mk.el, mk.el2] : [mk.el], hp: num(mk.hp), sprite: mk.sprite, rarity: mk.rarity, form: mk.form, desc: mk.desc, lore: mk.desc, cards: [TYPE_MOVES.find((t) => t.element === mk.el) || UNIVERSAL_CARDS[0], UNIVERSAL_CARDS[3]] }, mk.art)}>Create monster</button>
            </div>

            <h3 style={S.bagSub}>⚡ Move maker</h3>
            <div style={row}>
              {I("mvName", 110)}
              <select style={S.dexSelect} value={mk.mvType} onChange={up("mvType")}><option>attack</option><option>skill</option><option>power</option></select>
              cost {I("mvCost", 40)} dmg {I("mvDmg", 45)} block {I("mvBlock", 45)}
              <select style={S.dexSelect} value={mk.mvStatus} onChange={up("mvStatus")}><option value="">no status</option>{["burn","chill","soak","shock","poison","vulnerable","decay","weak","strength","draw","regen","teamheal","shield","energy"].map((k) => <option key={k}>{k}</option>)}</select>
              amt {I("mvAmt", 40)}
            </div>
            <div style={row}>
              <select style={S.dexSelect} value={mk.mvTarget} onChange={up("mvTarget")}><option value="">teach to…</option>{collection.map((m) => <option key={m.uid} value={m.uid}>{m.sprite} {m.name}</option>)}</select>
              <label style={{ fontSize: 11 }}><input type="checkbox" checked={mk.art} onChange={up("art")} /> 🎨</label>
              <button style={S.cheatBtn} onClick={() => { if (!mk.mvTarget) return; const c = { id: `mk_${Date.now()}`, name: mk.mvName, type: mk.mvType, cost: num(mk.mvCost) }; if (num(mk.mvDmg)) c.dmg = num(mk.mvDmg); if (num(mk.mvBlock)) c.block = num(mk.mvBlock); if (mk.mvStatus === "leech") c.leech = true; else if (mk.mvStatus) c[mk.mvStatus] = num(mk.mvAmt); c.text = `${c.dmg ? `Deal ${c.dmg}. ` : ""}${c.block ? `Gain ${c.block} block. ` : ""}${mk.mvStatus ? `${mk.mvStatus} ${num(mk.mvAmt)}.` : ""}`.trim() || "Debug move."; onAddMove(mk.mvTarget, c); if (mk.art) onPaintIcon("move", c.id, c.name, c.text); }}>Create & teach</button>
            </div>

            <h3 style={S.bagSub}>🧿 Item maker</h3>
            <div style={row}>
              {I("itName", 110)} {I("itIcon", 50)}
              <select style={S.dexSelect} value={mk.itKind} onChange={up("itKind")}><option>potion</option><option>sigil</option><option>special</option></select>
              <select style={S.dexSelect} value={mk.itEffect} onChange={up("itEffect")}>{["potionDmg","potionHeal","potionBlock","potionEnergy","dmgBonus","blockBonus","drawBonus","startStrength","maxHpBonus"].map((k) => <option key={k}>{k}</option>)}</select>
              amt {I("itAmt", 45)}
              <label style={{ fontSize: 11 }}><input type="checkbox" checked={mk.art} onChange={up("art")} /> 🎨</label>
              <button style={S.cheatBtn} onClick={() => { const id = `mk_${Date.now()}`; onMakeItem({ id, name: mk.itName, kind: mk.itKind, icon: mk.itIcon, rarity: "rare", text: `Debug: ${mk.itEffect} ${num(mk.itAmt)}.`, effect: { [mk.itEffect]: num(mk.itAmt) } }); if (mk.art) onPaintIcon("item", id, mk.itName, mk.itEffect); }}>Create item</button>
            </div>
            <p style={{ fontSize: 10, opacity: 0.5 }}>Maker content is session-only and skips dex numbering (#000). Sigil effects apply team-wide automatically; potion effects work in battle.</p>
          </>
        );
      })()}

      {/* ================= STATE (live game data) ================= */}
      {tab === "state" && (
        <>
          <h3 style={S.bagSub}>Build</h3>
          <div style={{ fontSize: 12 }}>Version: <strong style={{ color: "#ffd34d" }}>{APP_VERSION}</strong></div>
          <div style={{ fontSize: 12 }}>Roster size: {DEFAULT_MONSTERS.length} · Items defined: {ITEMS.length} · Elements: {ELEMENTS.length} · Reactions: {REACTIONS.length}</div>

          <h3 style={S.bagSub}>💾 Save</h3>
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 6px" }}>
            Auto-saves a moment after captures, battles, crafts, and purchases; loads on boot. Export/import below moves saves between devices.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <button style={S.cheatBtn} onClick={onSaveNow}>Save now</button>
            <button style={S.cheatBtn} onClick={() => setSaveText(JSON.stringify(onExport()))}>Export</button>
            <button style={S.cheatBtn} onClick={() => { try { const ok = onImport(JSON.parse(saveText)); if (!ok) alert("Invalid save data."); } catch (e) { alert("Could not parse save data."); } }}>Import</button>
            <button style={{ ...S.cheatBtn, color: "#ff8a8a", borderColor: "#ff5a4d88" }} onClick={() => { if (confirmReset) { onReset(); setConfirmReset(false); } else setConfirmReset(true); }}>{confirmReset ? "Really erase everything?" : "New Game"}</button>
            {confirmReset && <button style={S.cheatBtn} onClick={() => setConfirmReset(false)}>Keep save</button>}
          </div>
          <textarea style={{ ...S.textarea, minHeight: 60, fontSize: 10 }} placeholder="Export fills this; paste a save here to Import." value={saveText} onChange={(e) => setSaveText(e.target.value)} />

          <h3 style={S.bagSub}>Anthropic API key (only needed OUTSIDE Claude)</h3>
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 6px" }}>
            Inside the Claude app, AI features work with no key; leave this empty. When running the game
            elsewhere (sandbox/local), paste a key to enable forge, fusion, and art. Held in memory only:
            never saved, gone on refresh. Use a low-limit key you can revoke.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
            <input
              type="password"
              style={{ ...S.textarea, minHeight: 0, flex: 1, minWidth: 160, marginBottom: 0 }}
              placeholder="sk-ant-…"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <button
              style={{ ...S.cheatBtn, opacity: keyInput.trim() ? 1 : 0.4 }}
              disabled={!keyInput.trim()}
              onClick={() => {
                window.ANTHROPIC_API_KEY = keyInput.trim();
                setKeyInput("");
                setKeyStatus(maskKey(window.ANTHROPIC_API_KEY));
              }}
            >
              Set
            </button>
            <button
              style={S.cheatBtn}
              onClick={() => {
                delete window.ANTHROPIC_API_KEY;
                setKeyStatus(null);
              }}
            >
              Clear
            </button>
          </div>
          <div style={{ fontSize: 11, color: keyStatus ? "#7ee787" : "#b8b4d0", opacity: 0.85 }}>
            {keyStatus ? `Key active: ${keyStatus}` : "No key set (fine inside Claude; AI features need one outside)."}
          </div>

          <h3 style={S.bagSub}>Player state</h3>
          <div style={{ fontSize: 12 }}>Gold: {gold}</div>
          <div style={{ fontSize: 12 }}>Bag ({(items || []).length}): {(items || []).join(", ") || "(empty)"}</div>
          <div style={{ fontSize: 12 }}>
            Materials: {Object.keys(materials || {}).length === 0 ? "(none)" : Object.keys(materials).map((id) => `${materialById(id).name}×${materials[id]}`).join(", ")}
          </div>
          <div style={{ fontSize: 12 }}>Codex discovered: {seen ? seen.size : 0}/{DEFAULT_MONSTERS.length} beasts · {seenItems ? seenItems.size : 0}/{ITEMS.length} items</div>

          <h3 style={S.bagSub}>Collection ({(collection || []).length})</h3>
          {(collection || []).map((m) => (
            <div key={m.uid} style={S.adminRow}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>{m.sprite}</span>
                <strong style={{ fontSize: 12 }}>{m.name}</strong>
                <span style={{ fontSize: 10, color: RARITY_COLOR[m.rarity] }}>{m.rarity}</span>
                {(team || []).includes(m.uid) && <span style={{ fontSize: 9, color: "#7ee787", fontWeight: 700 }}>ON TEAM</span>}
                {m.forged && <span style={{ fontSize: 9, color: "#a571ff" }}>forged {m.forgedStage}/{m.forgedStages}</span>}
                {m.boon && <span style={{ fontSize: 9, color: "#ff7ad9" }}>✦ {m.boon.name}</span>}
              </div>
              <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>
                uid {m.uid} · HP {m.maxHp} · XP {m.prog ? m.prog.xp : 0} · wins {m.prog ? m.prog.wins : 0} · bosses {m.prog ? m.prog.bossKills : 0} · art: {m.svg ? "svg" : m.imageUrl ? "image" : "emoji"}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- Starter selection ----------
// First-launch choice: adopt an uncommon stage-1 with a full 3-stage line,
// or forge a brand-new one (guaranteed uncommon, guaranteed 3 stages).
function StarterScreen({ onPick, onForged }) {
  const [forging, setForging] = useState(false);
  const starterLines = buildLines().filter((l) => l.length === 3 && l.baseRarity === "uncommon");
  if (forging) {
    return (
      <div>
        <h2 style={S.h2}>Forge your starter 🔥</h2>
        <p style={{ opacity: 0.65 }}>
          Describe your dream companion. The forge is pre-tuned: uncommon rarity, a full 3-stage destiny.
        </p>
        <Generate
          free={true}
          items={[]}
          forced={{ rarity: "uncommon", stages: 3 }}
          onCreated={onForged}
          onCancel={() => setForging(false)}
        />
      </div>
    );
  }
  return (
    <div>
      <h2 style={S.h2}>Choose your starter</h2>
      <p style={{ opacity: 0.65 }}>
        Every legend starts with one companion. Each of these has a full three-stage destiny ahead of it.
      </p>
      <div style={S.grid}>
        {starterLines.map((line) => {
          const t = DEFAULT_MONSTERS.find((x) => x.name === line.members[0]);
          if (!t) return null;
          return (
            <div key={t.name} style={{ ...S.monCard, borderColor: ELEMENT_COLOR[t.element] + "88", cursor: "pointer" }} onClick={() => onPick(t)}>
              <div style={{ fontSize: 44 }}>{t.sprite}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{t.name}</div>
              <ElementPills m={t} />
              <div style={{ fontSize: 11, opacity: 0.7, margin: "6px 0" }}>{t.desc}</div>
              <div style={{ fontSize: 10, color: "#ffd34d" }}>{line.members.join(" → ")}</div>
            </div>
          );
        })}
        <div style={{ ...S.monCard, borderColor: "#ffd34d", cursor: "pointer", borderStyle: "dashed" }} onClick={() => setForging(true)}>
          <div style={{ fontSize: 44 }}>🔥</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Forge your own</div>
          <div style={{ fontSize: 11, opacity: 0.7, margin: "6px 0" }}>
            Describe a brand-new monster and the forge will make it real: uncommon, with a full 3-stage line to grow through.
          </div>
          <div style={{ fontSize: 10, color: "#ffd34d" }}>??? → ??? → ???</div>
        </div>
      </div>
    </div>
  );
}

function Generate({ onCreated, onCancel, items, free, forced }) {
  const [desc, setDesc] = useState("");
  const [phase, setPhase] = useState("describe"); // describe | spinning | result | forging
  const [rolls, setRolls] = useState(null);
  const [spin, setSpin] = useState({ rarity: "common", stages: 1, emphasis: STAT_EMPHASES[0], boon: BOONS[0] });
  const [loading, setLoading] = useState(false);
  const [stageMsg, setStageMsg] = useState("");
  const [err, setErr] = useState(null);

  const sparks = (items || []).filter((id) => id === "genesisspark").length;
  const hasSpark = free || sparks > 0;
  const canReroll = free ? sparks > 0 : sparks > 1; // when free, any spark lets you re-roll

  // Animate the wheels rapidly, then settle on the real rolled result.
  function doSpin(finalRolls) {
    setPhase("spinning");
    let ticks = 0;
    const maxTicks = 28;
    const iv = setInterval(() => {
      ticks++;
      // flash random faces while spinning
      setSpin({
        rarity: RARITY_LADDER[Math.floor(Math.random() * RARITY_LADDER.length)],
        stages: 1 + Math.floor(Math.random() * 3),
        emphasis: STAT_EMPHASES[Math.floor(Math.random() * STAT_EMPHASES.length)],
        boon: BOONS[Math.floor(Math.random() * BOONS.length)],
      });
      if (ticks >= maxTicks) {
        clearInterval(iv);
        setSpin(finalRolls);
        setRolls(finalRolls);
        setPhase("result");
      }
    }, 70);
  }

  function startSpin() {
    if (!desc.trim()) return;
    if (!hasSpark) {
      setErr("You need a Genesis Spark to forge. Find one in shops or as a reward.");
      return;
    }
    setErr(null);
    doSpin(rollForge(forced));
  }

  function reroll() {
    if (!canReroll) return;
    doSpin(rollForge(forced));
  }

  async function forge() {
    setPhase("forging");
    setLoading(true);
    setErr(null);
    try {
      const r = rolls;
      const budget = RARITY_BUDGET[r.rarity];
      setStageMsg("⚗️ designing stats and moveset…");
      const prompt = `You are the monster designer for a Pokémon x Slay the Spire card battler.
Design a STAGE 1 monster from the player's description, obeying the forged parameters. Respond with ONLY a JSON object, no prose.

Player description: "${desc}"
Forged parameters (obey these):
- Rarity: ${r.rarity} -> power level: ${budget.power}
- Stat emphasis: ${r.emphasis.name} (${r.emphasis.text})
- HP must be in range ${budget.hp[0]}-${budget.hp[1]}.

Return:
{
  "name": "short evocative name",
  "element": one of ${JSON.stringify(ELEMENTS)} (pick what best fits the description),
  "hp": integer ${budget.hp[0]}-${budget.hp[1]},
  "sprite": "a single emoji",
  "desc": "one vivid sentence",
  "cards": [ exactly 3 cards matching the emphasis; fields id,name,type(attack|skill|power),cost(0-2),text, optional dmg/block/strength/burn/weak/draw/hits/shield/teamheal/regen/vulnerable/energy/chill/soak/shock/poison/decay/leech and booleans retain/exhaust. Match status to element: pyre=burn, frost=chill, hydro=soak, charge=shock, toxin=poison, umbra=vulnerable, void=decay, blood=leech. (shield=team block, teamheal=heal all, regen=heal-over-time, poison=non-decaying DoT, chill=enemy hits weaker, soak=sets up reactions, shock=enemy fumbles, decay=enemy loses HP+block, vulnerable=+50% dmg taken, leech=heal from damage) ]
}
Scale card numbers to the rarity power level. Offense=more dmg, Defense=more block, Balanced=mix.`;
      const mon = await askClaudeJson(prompt);
      mon.element = ELEMENTS.includes(mon.element) ? mon.element : "umbra";
      mon.hp = clamp(Number(mon.hp) || budget.hp[0], budget.hp[0], budget.hp[1]);
      mon.cards = (mon.cards || []).slice(0, 3);
      if (mon.cards.length === 0) throw new Error("no cards returned");
      // attach forged metadata
      mon.rarity = r.rarity;
      mon.forged = true;
      mon.forgedStage = 1;
      mon.forgedStages = r.stages;
      mon.boon = r.boon && r.boon.id !== "none" && r.boon.id !== "none2" ? r.boon : null;

      setStageMsg("🎨 painting in the gallery style…");
      mon.svg = await generateArt({ name: mon.name, element: mon.element, desc: mon.desc });

      onCreated(mon); // parent consumes one Genesis Spark
    } catch (e) {
      setErr(`The forge sputtered: ${e.message}. Try again.`);
      setPhase("result");
    } finally {
      setLoading(false);
      setStageMsg("");
    }
  }

  return (
    <div style={S.panel}>
      <h2 style={S.h2}>The Forge ✨</h2>

      {phase === "describe" && (
        <>
          <p style={{ opacity: 0.65 }}>
            Describe a creature, then spin the Forge to roll its rarity, evolution potential, stat focus, and a
            possible signature boon. Requires a Genesis Spark {hasSpark ? `(×${sparks})` : "(none owned)"}.
          </p>
          <textarea
            style={S.textarea}
            rows={4}
            placeholder="e.g. a crystalline owl made of frozen moonlight that hunts in total silence"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          {err && <div style={S.errorBox}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.bigBtn, opacity: desc.trim() && hasSpark ? 1 : 0.4 }} disabled={!desc.trim() || !hasSpark} onClick={startSpin}>
              Spin the Forge
            </button>
            <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}

      {(phase === "spinning" || phase === "result" || phase === "forging") && (
        <>
          <div style={S.wheelRow}>
            <Wheel label="Rarity" value={spin.rarity} color={RARITY_COLOR[spin.rarity]} spinning={phase === "spinning"} />
            <Wheel label="Evolutions" value={`${spin.stages} stage${spin.stages > 1 ? "s" : ""}`} color="#7ee787" spinning={phase === "spinning"} />
            <Wheel label="Focus" value={spin.emphasis.name} color="#5fd0e0" spinning={phase === "spinning"} />
            <Wheel label="Boon" value={spin.boon.name} color="#ff7ad9" spinning={phase === "spinning"} />
          </div>

          {phase === "result" && rolls && (
            <>
              <div style={S.rollSummary}>
                <div style={{ color: RARITY_COLOR[rolls.rarity], fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                  {rolls.rarity} forge
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {rolls.stages === 1 ? "Standalone (no evolutions)" : `Can evolve through ${rolls.stages} stages`} · {rolls.emphasis.name}
                </div>
                {rolls.boon && rolls.boon.id !== "none" && rolls.boon.id !== "none2" && (
                  <div style={{ fontSize: 12, color: "#ff7ad9" }}>
                    ✦ {rolls.boon.name}: {rolls.boon.text}
                  </div>
                )}
              </div>
              {err && <div style={S.errorBox}>{err}</div>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={S.bigBtn} onClick={forge}>Forge this monster</button>
                <button
                  style={{ ...S.ghostBtn, opacity: canReroll ? 1 : 0.4 }}
                  disabled={!canReroll}
                  title={canReroll ? "Spend a spare Genesis Spark to re-roll" : "Need a spare Genesis Spark to re-roll"}
                  onClick={reroll}
                >
                  Re-roll {canReroll ? "(uses a spare Spark)" : "(no spare)"}
                </button>
              </div>
            </>
          )}

          {phase === "forging" && (
            <div className="pulse" style={{ ...S.forgeAnim, textAlign: "center" }}>{stageMsg}</div>
          )}
        </>
      )}
    </div>
  );
}

// A single spinning stat wheel.
function Wheel({ label, value, color, spinning }) {
  return (
    <div style={S.wheel}>
      <div style={{ fontSize: 9, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div
        style={{
          ...S.wheelFace,
          borderColor: color,
          color,
          transform: spinning ? "scale(1.04)" : "scale(1)",
          boxShadow: spinning ? `0 0 14px ${color}88` : `0 0 6px ${color}44`,
        }}
        className={spinning ? "pulse" : ""}
      >
        {value}
      </div>
    </div>
  );
}

function Fuse({ collection, onFused, onFormFused, onCancel, items, eggs, materials, onBreed, canBreedCheck }) {
  const [chamber, setChamber] = useState("fuse"); // fuse | nursery
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [err, setErr] = useState(null);

  const pick = (uid) => {
    if (a === uid) return setA(null);
    if (b === uid) return setB(null);
    if (!a) return setA(uid);
    if (!b) return setB(uid);
    setA(b);
    setB(uid);
  };

  const mA = collection.find((m) => m.uid === a);
  const mB = collection.find((m) => m.uid === b);
  const hasCatalyst = (items || []).includes("fusioncatalyst");
  const formFusion = mA && mB ? isFormFusion(mA, mB) : false;
  const nextForm = formFusion ? nextFormOf(mA) : null;
  const compatible = mA && mB ? canFuse(mA, mB) : true;
  const bothPicked = !!(mA && mB);
  // form fusion is deterministic: same species merging needs no catalyst
  const canDoFusion = bothPicked && compatible && (formFusion || hasCatalyst) && !loading;

  // why is fusion blocked? for the message
  let blockReason = null;
  if (bothPicked && !compatible) blockReason = `${mA.name} (${stageLabel(mA)}) and ${mB.name} (${stageLabel(mB)}) aren't at compatible evolution stages.`;
  else if (bothPicked && !formFusion && !hasCatalyst) blockReason = "You need a Fusion Catalyst to fuse. Find one in shops or as a reward.";

  async function fuse() {
    if (!mA || !mB) return;
    if (formFusion) {
      // deterministic: two of the same species+form merge into the next form
      onFormFused(mA, mB, nextForm);
      setA(null);
      setB(null);
      return;
    }
    if (!compatible) {
      setErr("These two can't be fused: their evolution stages don't line up.");
      return;
    }
    if (!hasCatalyst) {
      setErr("You need a Fusion Catalyst.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      setStage("⚗️ merging essence…");
      const prompt = `You fuse two monsters in a Pokémon x Slay the Spire card battler. Respond with ONLY a JSON object, no prose, no markdown fences.

Monster A: ${JSON.stringify({ name: mA.name, element: mA.element, hp: mA.maxHp, desc: mA.desc, cards: mA.cards.map(({ cid, ...c }) => c) })}
Monster B: ${JSON.stringify({ name: mB.name, element: mB.element, hp: mB.maxHp, desc: mB.desc, cards: mB.cards.map(({ cid, ...c }) => c) })}

Create a single hybrid that blends both. Return:
{
  "name":"portmanteau or new name combining both",
  "element": one of ${JSON.stringify(ELEMENTS)},
  "hp": integer between the parents' hp and a bit higher, max 50,
  "sprite":"single emoji",
  "desc":"one sentence describing the hybrid",
  "cards":[ exactly 3 cards: one inherited-feeling card from each parent plus one brand new fused card; card fields: id, name, type(attack|skill|power), cost(0-2), text, and optional dmg/block/strength/burn/weak/draw/hits/shield/teamheal/regen/vulnerable/energy integers plus retain/exhaust booleans ]
}
Keep numbers Spire-scale and balanced.`;
      const mon = await askClaudeJson(prompt);
      mon.element = ELEMENTS.includes(mon.element) ? mon.element : mA.element;
      mon.hp = clamp(Number(mon.hp) || Math.round((mA.maxHp + mB.maxHp) / 2) + 4, 24, 50);
      mon.cards = (mon.cards || []).slice(0, 3);
      if (mon.cards.length === 0) throw new Error("no cards returned");

      setStage("🎨 painting the hybrid…");
      mon.svg = await generateArt({ name: mon.name, element: mon.element, desc: mon.desc });

      onFused(mon); // parent consumes the catalyst
    } catch (e) {
      setErr(`Fusion unstable: ${e.message}. Try again.`);
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  return (
    <div>
      <h2 style={S.h2}>{chamber === "fuse" ? "Fusion Chamber ⚗️" : "Nursery 🥚"}</h2>
      <div style={S.codexTabs}>
        <button style={{ ...S.codexTab, ...(chamber === "fuse" ? S.codexTabActive : {}) }} onClick={() => setChamber("fuse")}>⚗️ Fuse</button>
        <button style={{ ...S.codexTab, ...(chamber === "nursery" ? S.codexTabActive : {}) }} onClick={() => setChamber("nursery")}>🥚 Nursery {eggs.length > 0 ? `(${eggs.length})` : ""}</button>
      </div>
      {chamber === "nursery" && (
        <Nursery collection={collection} eggs={eggs} materials={materials} onBreed={onBreed} canBreedCheck={canBreedCheck} />
      )}
      {chamber === "fuse" && (<>
      <p style={{ opacity: 0.65 }}>
        Select two monsters at compatible evolution stages (needs a Fusion Catalyst {hasCatalyst ? "✓" : "✗"}), or two of the SAME
        species and form to merge them into the next form, no catalyst needed.
      </p>

      <div style={S.fuseStage}>
        <FuseSlot m={mA} label="A" />
        <div style={{ fontSize: 34 }} className={loading ? "pulse" : ""}>＋</div>
        <FuseSlot m={mB} label="B" />
        <div style={{ fontSize: 28 }}>＝</div>
        <div style={{ ...S.fuseSlot, borderStyle: "dashed", opacity: 0.5 }}>?</div>
      </div>

      {blockReason && <div style={{ ...S.errorBox, background: "#a571ff22", borderColor: "#a571ff", color: "#d4b8ff" }}>{blockReason}</div>}
      {err && <div style={S.errorBox}>{err}</div>}
      {loading && stage && <div className="pulse" style={S.forgeAnim}>{stage}</div>}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={{ ...S.bigBtn, opacity: canDoFusion ? 1 : 0.4 }} disabled={!canDoFusion} onClick={fuse}>
          {loading ? "Fusing…" : formFusion ? `Form Fusion → ${FORMS[nextForm].badge} ${FORMS[nextForm].label}` : "Fuse"}
        </button>
        <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
      </div>

      <div style={S.grid}>
        {collection.map((m) => {
          const sel = m.uid === a ? "A" : m.uid === b ? "B" : null;
          // dim monsters that can't fuse with the currently-picked single one
          const other = a && !b ? mA : null;
          const incompatible = other && other.uid !== m.uid && !canFuse(other, m);
          return (
            <div
              key={m.uid}
              style={{
                ...S.monCard,
                borderColor: sel ? "#ffd34d" : "#262633",
                opacity: incompatible ? 0.4 : 1,
              }}
              onClick={() => pick(m.uid)}
            >
              {sel && <div style={{ ...S.teamBadge, background: "#ffd34d", color: "#111" }}>{sel}</div>}
              <MonsterSprite m={m} size={52} />
              <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>{m.name}</div>
              <ElementPills m={m} />
              <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{stageLabel(m)}{formLabel(m) ? ` · ${formLabel(m)}` : ""}</div>
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}

// ---------- Nursery (breeding) ----------
// Unlike fusion, BOTH parents are kept. Parent A decides the species (the
// egg is a baby of A's stage-1 form); parent B passes down one egg move.
function Nursery({ collection, eggs, materials, onBreed, canBreedCheck }) {
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const pick = (uid) => {
    if (a === uid) return setA(null);
    if (b === uid) return setB(null);
    if (!a) return setA(uid);
    if (!b) return setB(uid);
    setA(b); setB(uid);
  };
  const mA = collection.find((m) => m.uid === a);
  const mB = collection.find((m) => m.uid === b);
  const check = mA && mB ? canBreedCheck(mA, mB) : { ok: false, why: null };
  const rootName = mA ? (lineOf(mA.name) ? lineOf(mA.name).members[0] : mA.name) : null;
  return (
    <div>
      <p style={{ opacity: 0.65, fontSize: 13 }}>
        Pick two parents that share an element or a line. Both are KEPT. The egg hatches into a 🍼 Baby {rootName || "…"}
        (parent A's base species) that inherits one random egg move 🥚 from parent B. Egg moves survive evolution.
        Costs 1× 💠 Vital Essence + 2× 🌫️ Chimera Dust. Eggs hatch as you win battles.
      </p>

      {eggs.length > 0 && (
        <>
          <h3 style={S.bagSub}>Incubating ({eggs.length}/3)</h3>
          {eggs.map((egg) => (
            <div key={egg.id} style={{ ...S.adminRow, cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>🥚</span>
                <strong style={{ fontSize: 13 }}>{egg.template.name} egg</strong>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{egg.parents}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#ffd34d" }}>hatches in {egg.hatchIn} win{egg.hatchIn > 1 ? "s" : ""}</span>
              </div>
              {egg.eggCard && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>🥚 egg move: {egg.eggCard.name}</div>}
            </div>
          ))}
        </>
      )}

      <div style={S.fuseStage}>
        <FuseSlot m={mA} label="A" />
        <div style={{ fontSize: 30 }}>♥</div>
        <FuseSlot m={mB} label="B" />
        <div style={{ fontSize: 28 }}>＝</div>
        <div style={{ ...S.fuseSlot, borderStyle: "dashed", opacity: 0.6, fontSize: 30 }}>🥚</div>
      </div>
      {mA && mB && !check.ok && check.why && (
        <div style={{ ...S.errorBox, background: "#a571ff22", borderColor: "#a571ff", color: "#d4b8ff" }}>{check.why}</div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={{ ...S.bigBtn, opacity: check.ok ? 1 : 0.4 }} disabled={!check.ok} onClick={() => { onBreed(mA, mB); setA(null); setB(null); }}>
          Breed 🥚
        </button>
      </div>

      <div style={S.grid}>
        {collection.map((m) => {
          const sel = m.uid === a ? "A" : m.uid === b ? "B" : null;
          return (
            <div key={m.uid} style={{ ...S.monCard, borderColor: sel ? "#ff7ad9" : "#262633" }} onClick={() => pick(m.uid)}>
              {sel && <div style={{ ...S.teamBadge, background: "#ff7ad9", color: "#111" }}>{sel}</div>}
              <MonsterSprite m={m} size={52} />
              <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>{m.name}</div>
              <ElementPills m={m} />
              <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{stageLabel(m)}{formLabel(m) ? ` · ${formLabel(m)}` : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function FuseSlot({ m, label }) {
  return (
    <div style={S.fuseSlot}>
      {m ? <MonsterSprite m={m} size={64} /> : <span style={{ opacity: 0.4, fontSize: 30 }}>{label}</span>}
      {m && <div style={{ fontSize: 11, marginTop: 4 }}>{m.name}</div>}
    </div>
  );
}

function Battle({ battle, team, onPlay, onEnd, onPotion, onSwap, onWin, onLose, materials, onMaterial, iconArt, vp }) {
  const wide = vp && vp.landscape;
  // ---- juice: floating numbers, shake, sound triggers ----
  const [floaties, setFloaties] = useState([]);
  const [shake, setShake] = useState(false);
  const [viewCard, setViewCard] = useState(null);
  const [drag, setDrag] = useState(null); // {cid, card, sx, sy, x, y}
  const DRAG_PLAY_LIFT = 70; // px upward to trigger a play
  function startDrag(e, c, playable) {
    if (!playable) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    setDrag({ cid: c.cid, card: c, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY });
  }
  function moveDrag(e) {
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
  }
  function endDrag(e, c, playable) {
    setDrag((d) => {
      if (d && d.cid === c.cid && playable && d.sy - d.y >= DRAG_PLAY_LIFT) {
        SFX.card();
        setTimeout(() => onPlay(c), 0);
      }
      return null;
    });
  }
  const prevJ = useRef({ ehp: null, php: null, over: null });
  useEffect(() => {
    if (!battle) return;
    const pr = prevJ.current;
    const af = battle.fighters[battle.activeIdx];
    const spawn = (text, color, side) => setFloaties((f) => [...f.slice(-5), { id: Math.random(), text, color, side }]);
    if (pr.ehp != null && battle.enemyHp < pr.ehp) {
      const d = pr.ehp - battle.enemyHp;
      spawn(`-${d}`, "#ff8a8a", "enemy");
      SFX.hit(d >= 15);
      if (d >= 15) { setShake(true); setTimeout(() => setShake(false), 320); }
    }
    if (pr.ehp != null && battle.enemyHp > pr.ehp) spawn(`+${battle.enemyHp - pr.ehp}`, "#7ee787", "enemy");
    if (af && pr.php != null && af.hp < pr.php) { spawn(`-${pr.php - af.hp}`, "#ff8a8a", "ally"); SFX.hit(pr.php - af.hp >= 12); }
    if (af && pr.php != null && af.hp > pr.php) { spawn(`+${af.hp - pr.php}`, "#7ee787", "ally"); SFX.heal(); }
    if (battle.over && battle.over !== pr.over) { if (battle.over === "win") SFX.victory(); else SFX.defeat(); }
    prevJ.current = { ehp: battle.enemyHp, php: af ? af.hp : null, over: battle.over };
    // eslint-disable-next-line
  }, [battle && battle.enemyHp, battle && battle.fighters[battle.activeIdx] && battle.fighters[battle.activeIdx].hp, battle && battle.over]);
  const b = battle;
  const enemyHpPct = (b.enemyHp / b.enemyMaxHp) * 100;
  const active = b.fighters[b.activeIdx];
  const activeHpPct = (active.hp / active.maxHp) * 100;

  useEffect(() => {
    if (b.over === "win") {
      const t = setTimeout(onWin, 1100);
      return () => clearTimeout(t);
    }
    if (b.over === "lose") {
      const t = setTimeout(onLose, 1400);
      return () => clearTimeout(t);
    }
  }, [b.over]);

  const intentText = (it) =>
    !it ? "" : it.kind === "attack" ? `⚔ ${it.value}` : it.kind === "block" ? `🛡 ${it.value}` : "✦ buff";

  return (
    <div className={shake ? "shake" : ""} style={{ ...S.battle, position: "relative", maxWidth: wide ? 1100 : 720, width: "100%", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        style={{ position: "absolute", top: 4, right: 4, zIndex: 6, background: "#15132e", border: "1px solid #2c2a40", borderRadius: 8, color: "#e8e6f0", fontSize: 12, padding: "3px 7px", cursor: "pointer" }}
        onClick={() => { SFX.muted = !SFX.muted; setFloaties((f) => [...f]); }}
      >
        {SFX.muted ? "🔇" : "🔊"}
      </button>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        {floaties.map((f) => (
          <div key={f.id} className="floatie" style={{ position: "absolute", top: f.side === "enemy" ? "16%" : "60%", left: f.side === "enemy" ? "60%" : "22%", color: f.color, fontWeight: 900, fontSize: 22, textShadow: "0 2px 6px #000" }}>{f.text}</div>
        ))}
      </div>
      {/* play zone hint while dragging a card upward */}
      {drag && (
        <div style={{ position: "absolute", inset: "0 0 130px 0", zIndex: 4, pointerEvents: "none", border: `3px dashed ${drag.sy - drag.y >= DRAG_PLAY_LIFT ? "#7ee787" : "#ffffff44"}`, borderRadius: 14, margin: 6, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10, color: drag.sy - drag.y >= DRAG_PLAY_LIFT ? "#7ee787" : "#ffffff66", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
          {drag.sy - drag.y >= DRAG_PLAY_LIFT ? "RELEASE TO PLAY" : "DRAG UP TO PLAY"}
        </div>
      )}
      {/* stage: two matching monster cards, ally vs enemy, side by side */}
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <div style={{ display: "flex", gap: wide ? 16 : 8, alignItems: "stretch", justifyContent: "center" }}>
          <BattleCombatCard
            side="ally"
            mon={active}
            hpPct={activeHpPct}
            hp={active.hp}
            maxHp={active.maxHp}
            block={active.block}
            teamShield={b.teamShield || 0}
            str={active.str}
            regen={active.regenStacks || 0}
            synergy={active.synergy || 0}
            wide={wide}
            onView={() => { const full = (team || []).find((t) => t.uid === active.uid); setViewCard(full || active); }}
          />
          <BattleCombatCard
            side="enemy"
            mon={b.enemy}
            hpPct={enemyHpPct}
            hp={b.enemyHp}
            maxHp={b.enemyMaxHp}
            block={b.enemyBlock}
            status={b.enemyStatus}
            intent={intentText(b.enemy.intent)}
            matchup={defenseMultiplier(active.element, b.enemy)}
            matchEl={active.element}
            reaction={b.lastReaction}
            wide={wide}
            onView={() => setViewCard(b.enemy)}
          />
        </div>
        <div style={S.log}>
          {b.log.map((l, i) => (
            <div key={i} style={{ opacity: 0.4 + (i / b.log.length) * 0.6 }}>{l}</div>
          ))}
        </div>
      </div>
      {/* ===== pinned bottom: controls + consumables + hand ===== */}
      <div style={{ flex: "0 0 auto", paddingTop: 4 }}>
      {b.fighters.length > 1 && (
        <div style={S.benchRow}>
          {b.fighters.map((f, i) => {
            const isActive = i === b.activeIdx;
            const fainted = f.hp <= 0;
            const canSwap = !isActive && !fainted && !b.swappedThisTurn && b.turn === "player" && !b.over;
            return (
              <button key={f.uid} style={{ ...S.benchMon, borderColor: isActive ? ELEMENT_COLOR[f.element] : "#2c2a40", opacity: fainted ? 0.35 : isActive ? 1 : 0.85, cursor: canSwap ? "pointer" : "default" }} disabled={!canSwap} onClick={() => canSwap && onSwap(i)}>
                <MonsterSprite m={f} size={26} />
                <span style={{ fontSize: 9, marginTop: 1 }}>{fainted ? "💀" : `${f.hp}/${f.maxHp}`}</span>
                {isActive && <span style={S.activeTag}>active</span>}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "2px 2px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.energyOrb}>{b.energy}/{b.maxEnergy}</div>
          <span style={{ fontSize: 10, opacity: 0.6 }}>energy</span>
        </div>
        <button style={{ ...S.endBtn, padding: "8px 18px", fontSize: 14 }} disabled={!!b.over} onClick={onEnd}>End Turn ⏭</button>
      </div>
      {/* consumables: potions + materials in one compact, scrollable row */}
      {((b.potions && b.potions.length > 0) || (materials && Object.keys(materials).length > 0)) && (
        <div style={S.consumeBar}>
          {(b.potions || []).map((id, i) => {
            const it = ITEMS.find((x) => x.id === id);
            if (!it) return null;
            return (
              <button key={id + i} style={S.consumeBtn} disabled={!!b.over} title={`${it.name}: ${it.text}`} onClick={() => onPotion(id)}>
                <span style={{ fontSize: 17 }}>{it.icon}</span>
              </button>
            );
          })}
          {MATERIALS.filter((m) => (materials[m.id] || 0) > 0).map((m) => (
            <button key={m.id} style={{ ...S.consumeBtn, opacity: b.turn === "player" && !b.over ? 1 : 0.4 }} disabled={!!b.over || b.turn !== "player"} title={`${m.name}: ${m.use} (consumes 1)`} onClick={() => onMaterial(m.id)}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span style={S.consumeCount}>{materials[m.id]}</span>
            </button>
          ))}
        </div>
      )}

      {/* hand: drag a card up to play it; release low to cancel */}
      <div style={S.hand}>
        {active.hand.map((c) => {
          const playable = c.cost <= b.energy && !b.over && b.turn === "player";
          const accent = c.element ? ELEMENT_COLOR[c.element] : "#ffd34d";
          const dragging = drag && drag.cid === c.cid;
          return (
            <div
              key={c.cid}
              className="card"
              style={{
                ...S.playCard,
                borderColor: accent,
                opacity: dragging ? 0.25 : playable ? 1 : 0.45,
                cursor: playable ? "grab" : "default",
                touchAction: "none",
              }}
              onPointerDown={(e) => startDrag(e, c, playable)}
              onPointerMove={moveDrag}
              onPointerUp={(e) => endDrag(e, c, playable)}
              onPointerCancel={() => setDrag(null)}
            >
              <div style={{ ...S.cardCost, background: accent }}>{c.cost}</div>
              <div style={{ borderRadius: 6, overflow: "hidden", margin: "0 auto 2px", width: 30, height: 30, border: `1px solid ${accent}55` }}>
                <IconArt svg={iconArt && iconArt[`move:${c.id}`] && iconArt[`move:${c.id}`] !== "…" ? iconArt[`move:${c.id}`] : moveIcon(c, c.element)} emoji="" size={30} />
              </div>
              <div style={S.cardName}>{c.name}</div>
              <div style={S.cardText}>{c.text}</div>
            </div>
          );
        })}
      </div>
      {/* floating clone that follows the finger while dragging */}
      {drag && (() => {
        const c = drag.card;
        const accent = c.element ? ELEMENT_COLOR[c.element] : "#ffd34d";
        const arm = drag.sy - drag.y >= DRAG_PLAY_LIFT;
        return (
          <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%) rotate(-3deg)", zIndex: 50, pointerEvents: "none", ...S.playCard, borderColor: arm ? "#7ee787" : accent, opacity: 1, boxShadow: `0 10px 30px #000a, 0 0 0 2px ${arm ? "#7ee787" : accent}55` }}>
            <div style={{ ...S.cardCost, background: accent }}>{c.cost}</div>
            <div style={{ borderRadius: 6, overflow: "hidden", margin: "0 auto 2px", width: 30, height: 30, border: `1px solid ${accent}55` }}>
              <IconArt svg={iconArt && iconArt[`move:${c.id}`] && iconArt[`move:${c.id}`] !== "…" ? iconArt[`move:${c.id}`] : moveIcon(c, c.element)} emoji="" size={30} />
            </div>
            <div style={S.cardName}>{c.name}</div>
            <div style={S.cardText}>{c.text}</div>
          </div>
        );
      })()}

      <div style={S.deckInfo}>
        {active.name}'s deck · Draw {active.drawPile.length} · Discard {active.discard.length}
      </div>
      </div>

      {viewCard && (
        <div style={S.modalBackdrop} onClick={() => setViewCard(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <TCGCard m={viewCard} width={280} />
            <button style={S.ghostBtn} onClick={() => setViewCard(null)}>Close</button>
          </div>
        </div>
      )}

      {b.over && (
        <div style={S.overlay}>
          <div style={{ fontSize: 40 }}>{b.over === "win" ? "🏆" : "💀"}</div>
          <h2 style={{ margin: 0 }}>{b.over === "win" ? "Victory" : "Defeated"}</h2>
        </div>
      )}
    </div>
  );
}

// One combat card: a compact TCG-styled panel for a fighter or the enemy,
// matching on both sides. Art, name, types, HP, statuses, and a button to
// open that monster's full codex card.
function BattleCombatCard({ side, mon, hpPct, hp, maxHp, block, teamShield, str, regen, synergy, status, intent, matchup, matchEl, reaction, wide, onView }) {
  const accent = monAccent(mon);
  const isEnemy = side === "enemy";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: 240, ...gradBorderStyle(mon, "#17142e", 2), borderRadius: 14, padding: wide ? "10px 10px 8px" : "8px 8px 6px", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: `0 4px 16px #0006, inset 0 0 18px ${accent}22` }}>
      <div style={{ position: "absolute", top: 6, left: 8, fontSize: 9, letterSpacing: 1, fontWeight: 800, color: isEnemy ? "#ff8a8a" : "#7ee787", textTransform: "uppercase" }}>{isEnemy ? "Foe" : "You"}</div>
      {isEnemy && intent && <div style={{ position: "absolute", top: 4, right: 6, fontSize: 11, color: "#ffd34d", fontWeight: 700 }}>{intent}</div>}
      <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accent}66`, marginTop: 8 }}>
        <MonsterSprite m={mon} size={wide ? 60 : 64} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, textAlign: "center", lineHeight: 1.1 }}>
        {mon.name}{formLabel(mon) ? <span style={{ fontSize: 9, color: "#ffd34d", display: "block" }}>{formLabel(mon)}</span> : null}
      </div>
      <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", margin: "2px 0" }}>
        {monElements(mon).map((el) => (
          <span key={el} style={{ ...S.elementPill, background: ELEMENT_COLOR[el], position: "static", display: "inline-block", fontSize: 8 }}>{el}</span>
        ))}
      </div>
      <div style={{ width: "100%" }}>
        <Bar pct={hpPct} color={isEnemy ? "#ff5a4d" : "#7ee787"} label={`${hp}/${maxHp}`} />
      </div>
      {isEnemy && matchup > 1 && <div style={S.matchGood}>{matchEl} strong ▲</div>}
      {isEnemy && matchup < 1 && <div style={S.matchBad}>{matchEl} weak ▼</div>}
      <div style={S.statusRow}>
        {!isEnemy && (teamShield || 0) > 0 && <span style={S.statShield}>✶ {teamShield}</span>}
        {(block || 0) > 0 && <span style={S.statBlock}>🛡 {block}</span>}
        {!isEnemy && (str || 0) > 0 && <span style={S.statStr}>💪 {str}</span>}
        {!isEnemy && (regen || 0) > 0 && <span style={S.statRegen}>💚 {regen}</span>}
        {!isEnemy && (synergy || 0) > 0 && <span style={S.statSyn}>🔗 +{synergy}</span>}
        {isEnemy && status && status.burn > 0 && <span style={S.statBurn}>🔥 {status.burn}</span>}
        {isEnemy && status && status.poison > 0 && <span style={S.statPoison}>☣ {status.poison}</span>}
        {isEnemy && status && status.weak > 0 && <span style={S.statWeak}>💧 {status.weak}</span>}
        {isEnemy && status && status.vulnerable > 0 && <span style={S.statVuln}>🎯 {status.vulnerable}</span>}
        {isEnemy && status && status.chill > 0 && <span style={S.statChill}>❆ {status.chill}</span>}
        {isEnemy && status && status.soak > 0 && <span style={S.statSoak}>💦 {status.soak}</span>}
        {isEnemy && status && status.shock > 0 && <span style={S.statShock}>⚡ {status.shock}</span>}
        {isEnemy && status && status.decay > 0 && <span style={S.statDecay}>⬤ {status.decay}</span>}
      </div>
      {isEnemy && reaction && <div style={S.reactionFlash}>✦ {reaction}!</div>}
      <button style={{ marginTop: "auto", background: "none", border: `1px solid ${accent}66`, color: "#cfc8e8", borderRadius: 8, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }} onClick={onView}>📖 Codex</button>
    </div>
  );
}

function Bar({ pct, color, label }) {
  return (
    <div style={S.barOuter}>
      <div style={{ ...S.barInner, width: `${pct}%`, background: color, transition: "width 0.45s ease" }} />
      <span style={S.barLabel}>{label}</span>
    </div>
  );
}

function Reward({ reward, onTake, floor, ballCount }) {
  const [selected, setSelected] = useState(null);
  const [armed, setArmed] = useState(false);
  // Disable the confirm button briefly so a stray tap carried over from the
  // victory screen can't immediately commit a reward.
  useEffect(() => {
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 450);
    return () => clearTimeout(t);
  }, [reward]);

  const sel = selected != null ? reward.choices[selected] : null;
  const captureNoBall = sel && sel.kind === "capture" && ballCount <= 0;

  function confirm() {
    if (!sel || !armed) return;
    onTake(sel);
  }

  return (
    <div style={S.panel}>
      <h2 style={S.h2}>{reward.isBoss ? "Boss defeated!" : "Victory"}</h2>
      <p style={{ opacity: 0.65 }}>Tap a reward to select it, then confirm.</p>
      {reward.drops && Object.keys(reward.drops).length > 0 && (
        <div style={S.dropsBar}>
          <span style={{ opacity: 0.7, marginRight: 6 }}>Materials found:</span>
          {Object.keys(reward.drops).map((id) => {
            const mat = materialById(id);
            return (
              <span key={id} style={S.dropPill}>
                {mat.icon} {mat.name} ×{reward.drops[id]}
              </span>
            );
          })}
        </div>
      )}
      <div style={S.rewardRow}>
        {reward.choices.map((c, i) => {
          const isSel = selected === i;
          return (
            <div
              key={i}
              style={{
                ...S.rewardCard,
                borderColor: isSel ? "#ffd34d" : "#3a2a40",
                boxShadow: isSel ? "0 0 0 2px #ffd34d88" : "none",
              }}
              onClick={() => setSelected(i)}
            >
              {c.kind === "capture" && (
                <>
                  <MonsterSprite m={c.template} size={60} />
                  <strong style={{ marginTop: 6 }}>
                    Catch {c.template.name.replace(/^(BOSS |Elite )/, "")}
                    {formLabel(c.template) && <span style={{ fontSize: 11, color: "#ffd34d", marginLeft: 5 }}>{formLabel(c.template)}</span>}
                  </strong>
                  <span style={S.rewardDesc}>
                    Uses 1 Beast Ball 🔴 (you have {ballCount}).
                  </span>
                </>
              )}
              {c.kind === "item" && (
                <>
                  <div style={{ fontSize: 50 }}>{c.item.icon}</div>
                  <strong style={{ color: RARITY_COLOR[c.item.rarity] }}>{c.item.name}</strong>
                  <span style={S.rewardDesc}>{c.item.text}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>{c.item.kind}</span>
                </>
              )}
              {c.kind === "artifact" && (
                <>
                  <div style={{ fontSize: 50 }}>{c.artifact.icon}</div>
                  <strong style={{ color: "#ffd34d" }}>{c.artifact.name}</strong>
                  <span style={S.rewardDesc}>{c.artifact.text}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>artifact · this run only</span>
                </>
              )}
              {c.kind === "recipe" && (() => {
                const it = ITEMS.find((x) => x.id === c.item);
                return (
                  <>
                    <div style={{ fontSize: 50 }}>📜</div>
                    <strong style={{ color: "#ffd34d" }}>Recipe: {it ? it.name : c.item}</strong>
                    <span style={S.rewardDesc}>Learn to craft this in the Workshop.</span>
                  </>
                );
              })()}
              {c.kind === "generate" && (
                <>
                  <div style={{ fontSize: 50 }}>🧬</div>
                  <strong>Forge a Monster</strong>
                  <span style={S.rewardDesc}>Rare reward: describe a brand-new creature.</span>
                </>
              )}
              {c.kind === "gold" && (
                <>
                  <div style={{ fontSize: 50 }}>🪙</div>
                  <strong>{c.amount} Gold</strong>
                  <span style={S.rewardDesc}>Spend it at shops.</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {captureNoBall && (
        <div style={{ ...S.errorBox, marginTop: 14 }}>
          You have no Beast Balls. Pick another reward, or buy Beast Balls at a shop.
        </div>
      )}

      <button
        style={{
          ...S.bigBtn,
          width: "100%",
          marginTop: 16,
          opacity: sel && armed && !captureNoBall ? 1 : 0.4,
        }}
        disabled={!sel || !armed || captureNoBall}
        onClick={confirm}
      >
        {!sel ? "Select a reward" : !armed ? "…" : `Confirm: ${rewardLabel(sel)}`}
      </button>
    </div>
  );
}

function rewardLabel(c) {
  if (c.kind === "capture") return `Catch ${c.template.name.replace(/^(BOSS |Elite )/, "")}`;
  if (c.kind === "item") return c.item.name;
  if (c.kind === "recipe") { const it = ITEMS.find((x) => x.id === c.item); return `Recipe: ${it ? it.name : c.item}`; }
  if (c.kind === "artifact") return c.artifact.name;
  if (c.kind === "generate") return "Forge a Monster";
  if (c.kind === "gold") return `${c.amount} Gold`;
  return "Confirm";
}

// ---------- Dungeon Map (branching paths) ----------
function DungeonMap({ map, currentRow, currentCol, onPick, onLeave }) {
  // which nodes are reachable now?
  const reachable = (node) => {
    if (currentRow < 0) return node.row === 0; // start: pick any row-0 node
    if (node.row !== currentRow + 1) return false;
    const cur = map[currentRow][currentCol];
    return cur && cur.edges.includes(node.col);
  };

  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>The Descent</h2>
          <p style={{ opacity: 0.65, margin: 0 }}>
            Pick your path. Each choice leads deeper, ending at the boss. HP carries between fights.
          </p>
        </div>
        <button style={S.ghostBtn} onClick={onLeave}>Abandon run</button>
      </div>

      <div style={S.mapScroll}>
        <div style={S.mapInner}>
          {[...map].map((row, rIdx) => {
            const r = map.length - 1 - rIdx; // render boss at top, start at bottom
            const realRow = map[r];
            return (
              <div key={r} style={S.mapRow}>
                <div style={S.mapRowLabel}>
                  {r === map.length - 1 ? "BOSS" : r === 0 ? "START" : `L${r + 1}`}
                </div>
                <div style={S.mapNodes}>
                  {realRow.map((node) => {
                    const t = NODE_TYPES[node.type];
                    const canPick = reachable(node);
                    const isCurrent = node.row === currentRow && node.col === currentCol;
                    return (
                      <button
                        key={node.id}
                        disabled={!canPick}
                        onClick={() => canPick && onPick(node)}
                        title={t.label}
                        style={{
                          ...S.mapNode,
                          borderColor: node.visited ? "#3a3a4a" : t.color,
                          background: isCurrent
                            ? t.color + "33"
                            : canPick
                            ? "#1a1530"
                            : "#121020",
                          opacity: node.visited ? 0.4 : canPick ? 1 : 0.55,
                          boxShadow: canPick ? `0 0 12px ${t.color}66` : "none",
                          cursor: canPick ? "pointer" : "default",
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{t.icon}</span>
                        <span style={{ fontSize: 9, color: t.color, fontWeight: 700 }}>{t.label}</span>
                        {canPick && <span style={S.pickHint}>tap</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.legend}>
        {Object.entries(NODE_TYPES).map(([k, t]) => (
          <span key={k} style={{ fontSize: 11, opacity: 0.7 }}>
            {t.icon} {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Rest Site ----------
function RestSite({ team, runHp, onRest }) {
  return (
    <div style={S.panel}>
      <h2 style={S.h2}>🔥 Rest Site</h2>
      <p style={{ opacity: 0.65 }}>Your team gathers around the fire. Recover 40% of each monster's max HP.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
        {team.map((m) => {
          const cur = runHp[m.uid] == null ? m.maxHp : runHp[m.uid];
          return (
            <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MonsterSprite m={m} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                <Bar pct={(cur / m.maxHp) * 100} color="#7ee787" label={`${cur}/${m.maxHp}`} />
              </div>
            </div>
          );
        })}
      </div>
      <button style={S.bigBtn} onClick={() => onRest("all")}>Rest by the fire</button>
    </div>
  );
}

// ---------- Shop ----------
// ---------- Overworld map view ----------
const OW_TILE_COLOR = {
  0: "#2f5d3a",
  1: "#3f7d4a",
  2: "#2f6db5",
  3: "#1f3a26",
  4: "#b9975b",
};

function Overworld({ ow, pos, onMove, onLeave, vp }) {
  // ---- Canvas RPG renderer: camera follow, smooth movement, animated
  // terrain, day/night cycle. Logic (tiles/features/encounters) unchanged.
  const cnv = useRef(null);
  const anim = useRef({ x: pos.x, y: pos.y, t: 0, facing: 1 });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp" || e.key === "w") onMove(0, -1);
      else if (e.key === "ArrowDown" || e.key === "s") onMove(0, 1);
      else if (e.key === "ArrowLeft" || e.key === "a") onMove(-1, 0);
      else if (e.key === "ArrowRight" || e.key === "d") onMove(1, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMove]);

  useEffect(() => {
    let raf;
    const TS = vp && vp.landscape ? 34 : 28;
    const c = cnv.current;
    let W = c.width, H = c.height;
    if (!c) return;
    const ctx = c.getContext("2d");
    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const draw = () => {
      const a = anim.current;
      a.t += 1;
      // fit canvas to its container every frame (handles rotate/resize)
      const host = c.parentElement;
      if (host) {
        const cw = Math.max(200, Math.floor(host.clientWidth));
        const ch = Math.max(200, Math.floor(host.clientHeight));
        if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
        W = c.width; H = c.height;
      }
      // smooth camera + player tween
      const dx = pos.x - a.x, dy = pos.y - a.y;
      if (Math.abs(dx) > 0.01) a.facing = dx > 0 ? 1 : -1;
      a.x += dx * 0.18; a.y += dy * 0.18;
      const camX = a.x * TS + TS / 2 - W / 2, camY = a.y * TS + TS / 2 - H / 2;
      ctx.clearRect(0, 0, W, H);
      const x0 = Math.floor(camX / TS) - 1, y0 = Math.floor(camY / TS) - 1;
      for (let ty = y0; ty < y0 + H / TS + 2; ty++) {
        for (let tx = x0; tx < x0 + W / TS + 2; tx++) {
          const px = tx * TS - camX, py = ty * TS - camY;
          const inb = ty >= 0 && ty < ow.tiles.length && tx >= 0 && tx < ow.tiles[0].length;
          const t = inb ? ow.tiles[ty][tx] : 2;
          const h = hash(tx, ty);
          if (t === 2) { // animated water
            const ph = Math.sin(a.t * 0.04 + (tx + ty) * 0.9);
            ctx.fillStyle = ph > 0.3 ? "#2b5fae" : "#274f93";
            ctx.fillRect(px, py, TS, TS);
            ctx.fillStyle = "#4d86d8";
            const wy = py + 6 + ((h % 12) + ph * 3);
            ctx.fillRect(px + 4, wy, TS - 10, 2);
          } else { // grass base with variation
            ctx.fillStyle = h % 5 === 0 ? "#3c7a3a" : h % 7 === 0 ? "#356f35" : "#407f3d";
            ctx.fillRect(px, py, TS, TS);
            if (h % 11 === 0) { ctx.fillStyle = "#4f9347"; ctx.fillRect(px + (h % 18), py + (h % 14) + 6, 2, 3); }
            if (t === 1) { // tall grass: waving blades
              ctx.fillStyle = "#2f6b2e";
              for (let b = 0; b < 4; b++) {
                const bx = px + 4 + b * 6, sway = Math.sin(a.t * 0.06 + tx + b) * 2;
                ctx.fillRect(bx + sway, py + 8, 3, TS - 10);
              }
              ctx.fillStyle = "#57a04e";
              ctx.fillRect(px + 6 + Math.sin(a.t * 0.06 + tx) * 2, py + 6, 2, 8);
            }
            if (t === 3) { // tree: shadow, trunk, two-tone canopy
              ctx.fillStyle = "#00000033"; ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 4, 9, 3, 0, 0, 7); ctx.fill();
              ctx.fillStyle = "#5d4024"; ctx.fillRect(px + TS / 2 - 2, py + 12, 4, 12);
              ctx.fillStyle = "#2e6b2c"; ctx.beginPath(); ctx.arc(px + TS / 2, py + 10, 9, 0, 7); ctx.fill();
              ctx.fillStyle = "#3f8a39"; ctx.beginPath(); ctx.arc(px + TS / 2 - 3, py + 8, 6, 0, 7); ctx.fill();
            }
          }
        }
      }
      // features as structures (emoji renders crisply on canvas)
      ctx.font = "20px serif"; ctx.textAlign = "center";
      ow.features.forEach((f) => {
        const px = f.x * TS - camX + TS / 2, py = f.y * TS - camY + TS / 2;
        ctx.fillStyle = "#00000044"; ctx.beginPath(); ctx.ellipse(px, py + 9, 11, 4, 0, 0, 7); ctx.fill();
        ctx.fillText(f.icon, px, py + 7);
      });
      // player: drawn sprite with walk bob
      const ppx = a.x * TS - camX + TS / 2, ppy = a.y * TS - camY + TS / 2;
      const moving = Math.abs(dx) + Math.abs(dy) > 0.02;
      const bob = moving ? Math.sin(a.t * 0.4) * 1.6 : Math.sin(a.t * 0.08) * 0.6;
      ctx.fillStyle = "#00000055"; ctx.beginPath(); ctx.ellipse(ppx, ppy + 10, 8, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#e8b04b"; ctx.fillRect(ppx - 4, ppy - 2 + bob, 8, 9); // tunic
      ctx.fillStyle = "#f1c27d"; ctx.beginPath(); ctx.arc(ppx, ppy - 7 + bob, 5, 0, 7); ctx.fill(); // head
      ctx.fillStyle = "#5d4024"; ctx.fillRect(ppx - 5, ppy - 12 + bob, 10, 4); // hair
      ctx.fillStyle = "#1d1d2b"; ctx.fillRect(ppx + (a.facing > 0 ? 1 : -3), ppy - 8 + bob, 2, 2); // eye
      // day/night tint (slow cycle) + vignette
      const day = (Math.sin(a.t * 0.0015) + 1) / 2;
      ctx.fillStyle = `rgba(10,8,40,${0.28 * (1 - day)})`; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, H);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ow, pos, vp && vp.landscape, vp && vp.w, vp && vp.h]);

  const near = ow.features.find((f) => Math.abs(f.x - pos.x) + Math.abs(f.y - pos.y) <= 1);
  const Dpad = (
    <div style={{ position: "absolute", right: 14, bottom: 14, display: "grid", gridTemplateColumns: "repeat(3,40px)", gridTemplateRows: "repeat(3,40px)", gap: 4, opacity: 0.92, touchAction: "none" }}>
      <span /><button style={S.dBtn} onClick={() => onMove(0, -1)}>▲</button><span />
      <button style={S.dBtn} onClick={() => onMove(-1, 0)}>◀</button><span /><button style={S.dBtn} onClick={() => onMove(1, 0)}>▶</button>
      <span /><button style={S.dBtn} onClick={() => onMove(0, 1)}>▼</button><span />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <p style={{ opacity: 0.65, margin: "0 0 6px", fontSize: 12, flex: "0 0 auto", textAlign: "center" }}>
        {near ? `Near: ${near.icon} ${near.label} — step onto it to enter.` : "🗺️ Tall grass hides wild monsters. WASD / arrows / D-pad."}
      </p>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, borderRadius: 14, overflow: "hidden", border: "1px solid #2c2a40" }}>
        <canvas ref={cnv} style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated", touchAction: "none" }} />
        {Dpad}
      </div>
    </div>
  );
}

function Shop({ gold, owned, onBuy, onLeave, deep, depth, unknownRecipes, onBuyRecipe }) {
  // Deep (dungeon) shops: pricier, randomized, and stocked with rarer and
  // special items. Overworld shops: cheaper basics.
  const priceOf = (it) => {
    const base =
      it.rarity === "godly" ? 140 :
      it.rarity === "legendary" ? 110 :
      it.rarity === "mythic" ? 95 :
      it.rarity === "epic" ? 80 :
      it.rarity === "rare" ? 60 :
      it.rarity === "uncommon" ? 40 : 25;
    return deep ? Math.round(base * 1.5) : base;
  };
  // build stock once per shop visit
  const stock = useState(() => {
    if (deep) {
      // rarer items + always at least one special (stone/catalyst/spark)
      const specials = ITEMS.filter((it) => it.kind === "special");
      const goodies = ITEMS.filter((it) => it.rarity !== "common");
      const pick = (arr, n) => shuffle(arr).slice(0, n);
      const chosen = [
        ...pick(specials, Math.min(2, specials.length)),
        ...pick(goodies, 4),
      ];
      // dedupe by id
      const seen = new Set();
      return chosen.filter((it) => (seen.has(it.id) ? false : seen.add(it.id)));
    }
    // overworld: a spread of basics, always including Beast Balls
    const ball = ITEMS.find((it) => it.id === "beastball");
    return [ball, ...shuffle(ITEMS.filter((it) => it.id !== "beastball")).slice(0, 5)];
  })[0];

  // a rare recipe scroll in deep shops (rolled once per visit)
  const scroll = useState(() => {
    if (deep && unknownRecipes && unknownRecipes.length > 0 && Math.random() < 0.35) {
      return unknownRecipes[Math.floor(Math.random() * unknownRecipes.length)];
    }
    return null;
  })[0];
  const scrollPrice = 120;
  const scrollItem = scroll ? ITEMS.find((x) => x.id === scroll) : null;

  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>{deep ? "⛏️ Deep Market" : "🛒 Town Shop"}</h2>
          <p style={{ opacity: 0.65, margin: 0 }}>
            {deep
              ? `A hidden trader deep in the dungeon. Rare stock, steep prices.`
              : "A friendly town shop. Everyday sigils and potions."}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#ffd34d" }}>🪙 {gold}</div>
          <button style={S.ghostBtn} onClick={onLeave}>Leave</button>
        </div>
      </div>
      <div style={S.itemGrid}>
        {scrollItem && unknownRecipes.includes(scroll) && (
          <div style={{ ...S.itemTile, borderColor: "#ffd34d" }}>
            <div style={{ fontSize: 28 }}>📜</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Recipe: {scrollItem.name}</div>
            <div style={{ fontSize: 10, color: "#ffd34d", fontWeight: 700, textTransform: "uppercase" }}>scroll · rare find</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Teaches you to craft {scrollItem.name} in the Workshop.</div>
            <button
              style={{ ...S.buyBtn, opacity: gold >= scrollPrice ? 1 : 0.4, cursor: gold >= scrollPrice ? "pointer" : "default" }}
              disabled={gold < scrollPrice}
              onClick={() => onBuyRecipe(scroll, scrollPrice)}
            >
              🪙 {scrollPrice}
            </button>
          </div>
        )}
        {stock.map((it, i) => {
          const price = priceOf(it);
          const afford = gold >= price;
          return (
            <div key={it.id + i} style={{ ...S.itemTile, borderColor: RARITY_COLOR[it.rarity] + (deep ? "" : "66") }}>
              <div style={{ fontSize: 28 }}>{it.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{it.name}</div>
              <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
                {it.kind} · {it.rarity}
              </div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{it.text}</div>
              <button
                style={{ ...S.buyBtn, opacity: afford ? 1 : 0.4, cursor: afford ? "pointer" : "default" }}
                disabled={!afford}
                onClick={() => onBuy(it, price)}
              >
                🪙 {price}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Mystery ----------
function Mystery({ onResolve }) {
  const [revealed, setRevealed] = useState(null);
  const options = [
    { key: "open", label: "Open the strange chest", outcomes: ["item", "gold", "hurt"] },
    { key: "drink", label: "Drink from the glowing spring", outcomes: ["heal", "hurt"] },
    { key: "pray", label: "Pray at the old shrine", outcomes: ["gold", "item", "heal"] },
  ];
  function choose(opt) {
    const outcome = opt.outcomes[Math.floor(Math.random() * opt.outcomes.length)];
    setRevealed(outcome);
    setTimeout(() => onResolve(outcome), 900);
  }
  const outcomeText = {
    item: "✨ You receive an item!",
    gold: "🪙 You find gold!",
    heal: "💚 You feel restored.",
    hurt: "💢 It was a trap! You take damage.",
  };
  return (
    <div style={S.panel}>
      <h2 style={S.h2}>❓ A Mysterious Encounter</h2>
      {!revealed ? (
        <>
          <p style={{ opacity: 0.65 }}>Something strange lies ahead. What do you do?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {options.map((o) => (
              <button key={o.key} style={S.mysteryBtn} onClick={() => choose(o)}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 20, fontSize: 18 }} className="pulse">
          {outcomeText[revealed]}
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const S = {
  root: { minHeight: "100vh", background: "radial-gradient(ellipse at top, #1a1830, #0c0b16 60%)", color: "#e8e6f0", fontFamily: "'Georgia', serif" },
  header: { flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "nowrap", padding: "8px 14px", borderBottom: "1px solid #232136", position: "sticky", top: 0, background: "#0c0b16ee", backdropFilter: "blur(8px)", zIndex: 10 },
  logo: { fontWeight: 800, letterSpacing: 2, fontSize: 18, cursor: "pointer", fontFamily: "'Courier New', monospace" },
  nav: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" },
  navBtn: { background: "transparent", color: "#b8b4d0", border: "1px solid #2c2a40", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, whiteSpace: "nowrap" },
  navBtnActive: { background: "#ffd34d", color: "#15101f", borderColor: "#ffd34d", fontWeight: 800 },
  floorTag: { fontFamily: "monospace", color: "#ffd34d", letterSpacing: 2 },
  main: { maxWidth: 960, margin: "0 auto", padding: "20px 16px 96px" },
  tabBar: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "stretch", background: "#0c0b16f2", borderTop: "1px solid #232136", backdropFilter: "blur(8px)", zIndex: 40, paddingBottom: "env(safe-area-inset-bottom, 0px)", overflowX: "auto" },
  tab: { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "transparent", border: "none", color: "#8a86a8", padding: "8px 1px", cursor: "pointer", fontFamily: "inherit", borderTop: "2px solid transparent" },
  tabActive: { color: "#ffd34d", borderTop: "2px solid #ffd34d", background: "#ffd34d12" },
  toast: { position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", background: "#ffd34d", color: "#111", padding: "10px 18px", borderRadius: 10, fontWeight: 700, zIndex: 50, boxShadow: "0 6px 24px #0008" },

  title: { textAlign: "center", paddingTop: 30 },
  h1: { fontSize: 52, margin: "10px 0 6px", letterSpacing: 4, fontFamily: "'Courier New', monospace" },
  tagline: { maxWidth: 560, margin: "0 auto 26px", opacity: 0.7, lineHeight: 1.6 },
  bigBtn: { background: "linear-gradient(135deg,#ffd34d,#ff9a3d)", color: "#1a1208", border: "none", padding: "13px 26px", borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: "pointer", marginTop: 14, fontFamily: "inherit", boxShadow: "0 6px 20px #ffae3344" },
  ghostBtn: { background: "transparent", color: "#b8b4d0", border: "1px solid #2c2a40", padding: "13px 22px", borderRadius: 12, cursor: "pointer", marginTop: 14, fontFamily: "inherit", fontSize: 15 },
  featRow: { display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 40 },
  feat: { width: 150, display: "flex", flexDirection: "column", gap: 4, alignItems: "center", textAlign: "center", padding: 14, border: "1px solid #232136", borderRadius: 12, background: "#15132410" },

  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  h2: { fontSize: 28, margin: "0 0 4px", fontFamily: "'Courier New', monospace", letterSpacing: 1 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12 },
  monCard: { position: "relative", background: "#15132e", border: "2px solid #262633", borderRadius: 14, padding: 12, textAlign: "center", cursor: "pointer", transition: "transform .12s, border-color .12s", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  teamBadge: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "#7ee787", color: "#111", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 },
  elementPill: { fontSize: 10, fontWeight: 700, color: "#1a1208", padding: "1px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },

  panel: { maxWidth: 600, margin: "0 auto", background: "#15132e", border: "1px solid #262633", borderRadius: 16, padding: 26 },
  textarea: { width: "100%", boxSizing: "border-box", background: "#0c0b16", color: "#e8e6f0", border: "1px solid #2c2a40", borderRadius: 10, padding: 12, fontFamily: "inherit", fontSize: 15, resize: "vertical", marginBottom: 12 },
  forgeAnim: { marginTop: 16, opacity: 0.7, fontStyle: "italic" },
  errorBox: { background: "#ff5a4d22", border: "1px solid #ff5a4d", color: "#ffb4ad", fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 10 },

  fuseStage: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, margin: "20px 0", flexWrap: "wrap" },
  fuseSlot: { width: 96, height: 110, border: "2px solid #2c2a40", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#15132e" },

  battle: { maxWidth: 720, margin: "0 auto", position: "relative" },
  battleLogTight: {},
  enemyZone: { display: "flex", justifyContent: "center", marginBottom: 6 },
  enemyCard: { position: "relative", textAlign: "center", background: "#1a1530", border: "1px solid #3a2a40", borderRadius: 16, padding: "8px 16px", minWidth: 0 },
  intent: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#ff5a4d", color: "#fff", padding: "3px 12px", borderRadius: 20, fontWeight: 800, fontSize: 13, fontFamily: "monospace" },
  log: { height: 38, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", fontSize: 11, fontFamily: "monospace", color: "#9a96b8", margin: "4px 0", padding: "0 8px" },
  activeFighter: { display: "flex", alignItems: "center", gap: 10, background: "#15132e", border: "1px solid #262633", borderRadius: 14, padding: "6px 12px" },
  activeArt: { borderRadius: 10, border: "2px solid", padding: 2, background: "#0c0b16", flexShrink: 0 },
  benchRow: { display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" },
  benchMon: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, background: "#15132e", border: "2px solid #2c2a40", borderRadius: 12, padding: "6px 10px", color: "#e8e6f0", fontFamily: "inherit", minWidth: 60 },
  activeTag: { fontSize: 8, background: "#7ee787", color: "#0c0b16", padding: "0 5px", borderRadius: 5, fontWeight: 800, textTransform: "uppercase", marginTop: 1 },
  energy: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  energyOrb: { background: "radial-gradient(circle,#ffd34d,#ff9a3d)", color: "#1a1208", width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontFamily: "monospace" },
  endBtn: { background: "#2c2a40", color: "#e8e6f0", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12 },

  hand: { display: "flex", gap: 6, justifyContent: "center", flexWrap: "nowrap", marginTop: 4, overflowX: "auto", paddingBottom: 2 },
  playCard: { width: 90, flex: "0 0 auto", background: "linear-gradient(160deg,#1c1838,#15122a)", border: "2px solid #ffd34d", borderRadius: 11, padding: "6px 7px 7px", position: "relative", transition: "transform .12s", boxShadow: "0 4px 14px #0006" },
  cardCost: { position: "absolute", top: -9, left: -7, width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12, color: "#1a1208", fontFamily: "monospace", border: "2px solid #15122a" },
  cardType: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, opacity: 0.5, textAlign: "right" },
  cardName: { fontWeight: 800, fontSize: 11, margin: "1px 0 3px", lineHeight: 1.05 },
  cardText: { fontSize: 9, lineHeight: 1.25, opacity: 0.82, maxHeight: 46, overflow: "hidden" },
  cardOwner: { fontSize: 9, opacity: 0.45, marginTop: 6, fontStyle: "italic" },
  deckInfo: { textAlign: "center", fontSize: 12, opacity: 0.5, marginTop: 10, fontFamily: "monospace" },

  barOuter: { position: "relative", height: 18, background: "#0c0b16", borderRadius: 20, overflow: "hidden", border: "1px solid #2c2a40", marginTop: 6 },
  barInner: { height: "100%", transition: "width .35s", borderRadius: 20 },
  barLabel: { position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: "monospace", textShadow: "0 1px 2px #000" },
  statusRow: { display: "flex", gap: 6, justifyContent: "center", marginTop: 4, minHeight: 18 },
  statBlock: { fontSize: 11, background: "#3fa9f533", padding: "1px 7px", borderRadius: 10 },
  statShield: { fontSize: 11, background: "#a571ff44", color: "#d4b8ff", padding: "1px 7px", borderRadius: 10, fontWeight: 700 },
  statRegen: { fontSize: 11, background: "#7ee78733", padding: "1px 7px", borderRadius: 10 },
  statVuln: { fontSize: 11, background: "#ff8a4d44", padding: "1px 7px", borderRadius: 10 },
  statPoison: { fontSize: 11, background: "#9bd13a44", color: "#c8f06a", padding: "1px 7px", borderRadius: 10 },
  statChill: { fontSize: 11, background: "#9fe6ff33", color: "#cdf2ff", padding: "1px 7px", borderRadius: 10 },
  statSoak: { fontSize: 11, background: "#3fa9f544", color: "#bfe4ff", padding: "1px 7px", borderRadius: 10 },
  statShock: { fontSize: 11, background: "#ffe14d44", color: "#fff0a0", padding: "1px 7px", borderRadius: 10 },
  statDecay: { fontSize: 11, background: "#6b5a8a55", color: "#cabbe0", padding: "1px 7px", borderRadius: 10 },
  reactionFlash: { marginTop: 4, fontSize: 12, fontWeight: 800, color: "#ffd34d", letterSpacing: 1 },
  statSyn: { fontSize: 11, background: "#ffd34d33", color: "#ffd34d", padding: "1px 7px", borderRadius: 10, fontWeight: 700 },
  matchGood: { fontSize: 11, color: "#7ee787", fontWeight: 700, marginTop: 4 },
  matchBad: { fontSize: 11, color: "#ff8a8a", fontWeight: 700, marginTop: 4 },
  cardTags: { display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2, minHeight: 14 },
  cardTagRetain: { fontSize: 8, background: "#5fd0e033", color: "#5fd0e0", padding: "0 5px", borderRadius: 5, fontWeight: 700, textTransform: "uppercase" },
  cardTagExhaust: { fontSize: 8, background: "#ff5a4d33", color: "#ff8a8a", padding: "0 5px", borderRadius: 5, fontWeight: 700, textTransform: "uppercase" },
  statBurn: { fontSize: 11, background: "#ff5a4d33", padding: "1px 7px", borderRadius: 10 },
  statWeak: { fontSize: 11, background: "#3fa9f533", padding: "1px 7px", borderRadius: 10 },
  statStr: { fontSize: 11, background: "#ffd34d33", padding: "1px 7px", borderRadius: 10 },

  overlay: { position: "absolute", inset: 0, background: "#0c0b16dd", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, zIndex: 5 },

  rewardRow: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 16 },
  rewardCard: { flex: "1 1 160px", background: "#1a1530", border: "1px solid #3a2a40", borderRadius: 14, padding: 18, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "border-color .12s" },
  rewardDesc: { fontSize: 12, opacity: 0.6 },

  mapScroll: { maxHeight: "62vh", overflowY: "auto", border: "1px solid #232136", borderRadius: 14, padding: "10px 6px", background: "linear-gradient(180deg,#120f20,#0c0b16)" },
  mapInner: { display: "flex", flexDirection: "column", gap: 14 },
  mapRow: { display: "flex", alignItems: "center", gap: 8 },
  mapRowLabel: { width: 42, flexShrink: 0, fontFamily: "monospace", fontSize: 10, color: "#6a6688", textAlign: "right" },
  mapNodes: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", flex: 1 },
  mapNode: { position: "relative", width: 64, height: 64, borderRadius: 14, border: "2px solid", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: "#e8e6f0", fontFamily: "inherit" },
  pickHint: { position: "absolute", bottom: -8, fontSize: 8, background: "#ffd34d", color: "#15101f", padding: "0 5px", borderRadius: 5, fontWeight: 800, textTransform: "uppercase" },
  legend: { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 12 },

  buyBtn: { marginTop: 6, background: "#ffd34d", color: "#15101f", border: "none", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontFamily: "inherit", fontSize: 13 },
  mysteryBtn: { background: "#1a1530", color: "#e8e6f0", border: "1px solid #a571ff66", borderRadius: 10, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 14, textAlign: "left" },
  cheatBtn: { background: "#2c2a40", color: "#ffd34d", border: "1px solid #ffd34d55", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 },
  versionTag: { fontSize: 9, color: "#7ee787", fontWeight: 700, marginLeft: 6, opacity: 0.85, letterSpacing: 1, verticalAlign: "middle" },
  adminRow: { background: "#15132e", border: "1px solid #2c2a40", borderRadius: 10, padding: "8px 10px", marginBottom: 6, cursor: "pointer" },
  adminLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#ffd34d", opacity: 0.8, marginBottom: 2 },
  dropsBar: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "6px 0 12px", fontSize: 12 },
  dropPill: { background: "#15132e", border: "1px solid #2c2a40", borderRadius: 14, padding: "3px 10px", fontSize: 11, whiteSpace: "nowrap" },
  dexSelect: { background: "#15132e", color: "#e8e6f0", border: "1px solid #2c2a40", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 12 },

  owWrap: { border: "2px solid #232136", borderRadius: 12, overflow: "hidden", background: "#0c0b16" },
  owGrid: { display: "grid", gap: 0, width: "100%", aspectRatio: `${OW_W} / ${OW_H}` },
  owTile: { position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 0.5px #0003" },
  owFeature: { fontSize: "min(5vw,30px)", lineHeight: 1 },
  owPlayer: { position: "absolute", fontSize: "min(5vw,30px)", lineHeight: 1, filter: "drop-shadow(0 1px 2px #000)" },
  owStanding: { textAlign: "center", fontSize: 13, opacity: 0.8, margin: "10px 0", padding: "8px", background: "#15132e", borderRadius: 8 },
  dpad: { display: "grid", gridTemplateColumns: "repeat(3, 54px)", gridTemplateRows: "repeat(3, 54px)", gap: 6, justifyContent: "center", margin: "14px 0" },
  dBtn: { background: "#2c2a40", color: "#ffd34d", border: "1px solid #3a3850", borderRadius: 10, fontSize: 22, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" },

  viewBtn: { marginTop: 6, background: "transparent", color: "#9a96b8", border: "1px solid #2c2a40", borderRadius: 8, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" },
  evoDot: { position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: "50%", background: "#7ee787", color: "#0c0b16", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 },
  modalBackdrop: { position: "fixed", inset: 0, background: "#06050ccc", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" },
  moveList: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 300, width: "100%" },
  moveChip: { background: "#15132e", border: "1px solid", borderRadius: 8, padding: "6px 10px", fontSize: 13 },

  codexElementHead: { fontFamily: "'Courier New', monospace", fontWeight: 800, letterSpacing: 2, fontSize: 15, marginBottom: 8, borderBottom: "1px solid #232136", paddingBottom: 4 },
  codexGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 },
  codexCard: { position: "relative", background: "#15132e", border: "1px solid", borderRadius: 12, padding: 10, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minHeight: 96, justifyContent: "center" },
  ownedTag: { position: "absolute", top: 4, right: 4, fontSize: 8, background: "#7ee787", color: "#0c0b16", padding: "1px 5px", borderRadius: 6, fontWeight: 800, textTransform: "uppercase" },
  seenTag: { position: "absolute", top: 4, right: 4, fontSize: 8, background: "#5fd0e0", color: "#0c0b16", padding: "1px 5px", borderRadius: 6, fontWeight: 800, textTransform: "uppercase" },
  evoPanel: { width: "100%", maxWidth: 300, background: "#15132e", border: "1px solid #2c2a40", borderRadius: 12, padding: 12 },
  evoReq: { display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0" },
  codexInfoRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 10px", background: "#15132e", borderRadius: 8 },
  lockedMoves: { width: "100%", maxWidth: 300, textAlign: "center", fontSize: 12, opacity: 0.6, fontStyle: "italic", padding: "12px", border: "1px dashed #2c2a40", borderRadius: 10 },

  wheelRow: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", margin: "18px 0" },
  wheel: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 78 },
  wheelFace: { width: "100%", minHeight: 52, borderRadius: 12, border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 800, fontSize: 12, padding: "4px 2px", background: "#15132e", transition: "transform .1s" },
  rollSummary: { textAlign: "center", display: "flex", flexDirection: "column", gap: 4, margin: "8px 0 16px", padding: 12, background: "#15132e", border: "1px solid #2c2a40", borderRadius: 12 },

  bagSub: { fontFamily: "'Courier New', monospace", letterSpacing: 1, marginTop: 22, marginBottom: 8, color: "#b8b4d0" },
  codexTabs: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  codexTab: { background: "transparent", color: "#b8b4d0", border: "1px solid #2c2a40", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 },
  codexTabActive: { background: "#ffd34d", color: "#15101f", borderColor: "#ffd34d" },
  mechCard: { background: "#15132e", border: "1px solid #2c2a40", borderRadius: 12, padding: "12px 14px", marginBottom: 10 },
  mechTitle: { fontWeight: 800, fontSize: 14, marginBottom: 4 },
  mechBody: { fontSize: 12.5, lineHeight: 1.5, opacity: 0.82 },
  itemGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 },
  itemTile: { background: "#15132e", border: "1px solid", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 3 },
  potionBar: { display: "flex", gap: 8, justifyContent: "center", marginTop: 12, flexWrap: "wrap" },
  consumeBar: { display: "flex", gap: 5, justifyContent: "center", flexWrap: "nowrap", overflowX: "auto", margin: "0 0 4px", padding: "0 2px" },
  consumeBtn: { position: "relative", flex: "0 0 auto", display: "grid", placeItems: "center", width: 34, height: 34, background: "#1a1530", border: "1px solid #3a2a40", borderRadius: 9, cursor: "pointer", color: "#e8e6f0", fontFamily: "inherit" },
  consumeCount: { position: "absolute", bottom: -3, right: -3, background: "#2c2a40", borderRadius: 8, fontSize: 8, padding: "0 3px", fontWeight: 700 },
  potionBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "#1a1530", border: "1px solid #3a2a40", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: "#e8e6f0", fontFamily: "inherit" },
};

// ---- TCG card frame styling ----
const tcg = {
  card: {
    position: "relative",
    borderRadius: 18,
    padding: 7,
    background: "linear-gradient(145deg,#2a2238,#14101f 55%,#221a30)",
    boxShadow: "0 14px 40px #000a, inset 0 1px 0 #ffffff14",
    overflow: "hidden",
    fontFamily: "'Georgia', serif",
  },
  sheen: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(115deg, transparent 30%, #ffffff14 45%, transparent 60%)",
    pointerEvents: "none",
    zIndex: 3,
  },
  border: {
    position: "relative",
    height: "100%",
    border: "2px solid",
    borderRadius: 13,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 7,
    background: "linear-gradient(160deg,#171225,#0e0a17)",
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    background: "linear-gradient(90deg,#ffffff10,transparent)",
    borderRadius: 8,
    padding: "3px 6px",
  },
  name: {
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: 0.4,
    textShadow: "0 1px 2px #000",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  elementGem: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 13,
    color: "#15101f",
    flexShrink: 0,
    boxShadow: "0 0 8px var(--accent), inset 0 1px 2px #fff8",
  },
  artWindow: {
    position: "relative",
    flex: "0 0 48%",
    borderRadius: 8,
    overflow: "hidden",
    background: "#0c0b16",
  },
  hpBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    color: "#15101f",
    fontWeight: 800,
    fontSize: 14,
    padding: "1px 9px",
    borderRadius: 20,
    boxShadow: "0 2px 6px #0008",
  },
  corner: {
    position: "absolute",
    width: 14,
    height: 14,
    borderTop: "2px solid",
    borderLeft: "2px solid",
    borderTopLeftRadius: 6,
    opacity: 0.8,
  },
  typeLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 2px",
  },
  elementPillSm: {
    fontSize: 10,
    fontWeight: 800,
    color: "#15101f",
    padding: "2px 10px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  descBox: {
    flex: 1,
    background: "linear-gradient(180deg,#ffffff0a,#00000030)",
    border: "1px solid #ffffff14",
    borderRadius: 8,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
  },
  descText: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    fontStyle: "italic",
    color: "#d8d3ea",
    flex: 1,
  },
  cardCount: {
    fontSize: 10,
    opacity: 0.55,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 6,
    textAlign: "right",
  },
  footer: { marginTop: 2 },
};

const CSS = `
@keyframes floatUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-46px); opacity: 0; } }
.floatie { animation: floatUp 0.9s ease-out forwards; }
@keyframes shakeX { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
.shake { animation: shakeX 0.32s ease; }
.card:active { transform: scale(0.94); }

  * { box-sizing: border-box; }
  .card:hover { transform: translateY(-10px) scale(1.04); }
  .monCard:hover { transform: translateY(-3px); }
  .float { animation: float 3s ease-in-out infinite; }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  .pulse { animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
  button:disabled { opacity:.4; cursor:not-allowed; }
  textarea:focus { outline: 1px solid #ffd34d; }
  div[style*="rewardCard"]:hover { border-color:#ffd34d !important; }
`;

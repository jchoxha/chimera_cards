import { callClaude, sanitizeSvg } from "../ai/claude.js";
import { RARITY_COLOR } from "../systems/forge.js";
import { ELEMENT_COLOR } from "../systems/elements.jsx";
async function generateIconArt({ name, kind, desc }) {
  const prompt = `You are an SVG icon illustrator. Draw a game icon as a single self-contained <svg>.
Subject: "${name}" — a ${kind} in a monster-taming card game. Visual idea: ${desc}
Style: bold flat emblem, 2-4 colors plus a dark background circle or rounded square, thick simple shapes, readable at 48px. No text.
OUTPUT RULES: ONLY the SVG markup. Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">. Basic shapes only. Under 1200 characters.`;
  try {
    const out = await callClaude(prompt, 800);
    const m = out.match(/<svg[\s\S]*<\/svg>/);
    return m ? sanitizeSvg(m[0]) : null;
  } catch {
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

export { generateIconArt, procIcon, itemIcon, moveIcon, IconArt };

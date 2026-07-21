import { generateText } from "./provider.js";

// Text generation now routes through the pluggable PROVIDER seam (ai/provider.js):
// Anthropic API on the web/dev, an in-browser local model (WebLLM), or an on-device
// native model in the Android app — all behind one call, same prompts + validators.
// See docs/offline-android.md.
async function callClaude(prompt, maxTokens = 1200) {
  return generateText(prompt, { maxTokens });
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

export { callClaude, extractJson, askClaudeJson, ART_STYLE, artPrompt, SAFE_SVG_TAGS, sanitizeSvg, generateArt };

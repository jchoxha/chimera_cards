// Bake an `artPrompt` (scene description) onto every card in src/data/cards/*.json.
// Uses the data-driven generator so the field exists on every card; authors can
// then hand-refine any card's artPrompt in the editor. Idempotent: only fills in
// cards that lack a non-empty artPrompt (pass --force to overwrite all).
//   node scripts/bake_card_art_prompts.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardArtScene } from '../src/data/cardArtPrompt.js';

const force = process.argv.includes('--force');
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'cards');

let baked = 0, kept = 0, total = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const p = path.join(DIR, f);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cards = Array.isArray(data) ? data : data.cards;
  for (const c of cards) {
    total++;
    if (!force && typeof c.artPrompt === 'string' && c.artPrompt.trim()) { kept++; continue; }
    // Derive from a card WITHOUT a pre-set artPrompt so the generator runs.
    const { artPrompt, ...bare } = c;
    c.artPrompt = cardArtScene(bare);
    baked++;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
console.log(`art prompts — baked: ${baked} | kept existing: ${kept} | total: ${total}`);

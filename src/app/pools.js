// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: app/pools — the SHARED biology-aware card-pool builders (app     ║
// ║ layer, JSON imports fine here). Biology selects the kit (§9): body        ║
// ║ type(s) → base pool (Humanoid archetype+weapons / Beast family+anatomy /  ║
// ║ Aberration family+features), subtypes stack their packages, attunement    ║
// ║ re-skins + adds its own cards. Used by App (roster/customs/rewards/       ║
// ║ editor) AND the Codex bestiary so they can never drift.                   ║
// ║ UPDATE WHEN: a new kit system or pool layer is added.                    ║
// ╚══════════════════════════════════════════════════════════════════╝
import { attunementCards } from '../engine/cards/attunementPool.js';
import { beastPool, BEAST_FAMILIES, defaultAnatomy } from '../engine/cards/beastPool.js';
import { humanoidWeaponPool, weaponsForArchetype, defaultWeapons } from '../engine/cards/humanoidPool.js';
import { aberrationPool, ABERRATION_FAMILIES, defaultAberrationAnatomy } from '../engine/cards/aberrationPool.js';
import { subtypeCards } from '../engine/cards/subtypePool.js';
import { reskinDeck, attunementVariants } from '../engine/cards/reskin.js';
import { resolvePools } from '../data/collections.js';

const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);

// Archetype card pools keyed by class name — base game overlaid by any ENABLED
// collections (player card packs). Resolved fresh each session start.
export const POOLS = resolvePools();
export const ARCHETYPES = Object.keys(POOLS);          // archetypes that have a card kit

/** Biology selects the kit (docs/biology-kits.md §9): the base (Physical) card pool a
 *  creature draws from BEFORE attunement re-skin. Humanoid (or no biology) → its
 *  Archetype pool + weapons; Beast/Aberration → family + anatomy/features; hybrids →
 *  the union. Descriptive subtypes stack their packages on top. */
export function basePoolFor({ klass, biology, family, anatomy, weapons, subtypes }) {
  const bios = arr(biology);
  const out = [];
  if (!bios.length || bios.includes('Humanoid')) {
    out.push(...(POOLS[klass] || []));
    if (bios.includes('Humanoid')) {
      const w = (weapons?.length ? weapons : defaultWeapons(klass)).filter((t) => weaponsForArchetype(klass).includes(t));
      out.push(...humanoidWeaponPool(w));
    }
  }
  if (bios.includes('Beast')) {
    const fam = BEAST_FAMILIES.includes(family) ? family : BEAST_FAMILIES[0];
    out.push(...beastPool({ family: fam, anatomy: anatomy?.length ? anatomy : defaultAnatomy(fam) }));
  }
  if (bios.includes('Aberration')) {
    const fam = ABERRATION_FAMILIES.includes(family) ? family : ABERRATION_FAMILIES[0];
    out.push(...aberrationPool({ family: fam, anatomy: anatomy?.length ? anatomy : defaultAberrationAnatomy(fam) }));
  }
  if (!out.length) out.push(...(POOLS[klass] || []));   // body types w/o a built kit: archetype stand-in
  out.push(...subtypeCards(subtypes));                  // descriptive subtypes add their packages
  return out;
}

/** roster-entry → its base pool (the shape buildRoster's poolResolver expects). */
export const rosterPool = (r) => basePoolFor({ klass: r.class, biology: r.biology, family: r.family, anatomy: r.anatomy, weapons: r.weapons, subtypes: r.subtypes });

/** A creature's full potential pool: its biology base pool reskinned to its
 *  attunement + that attunement's own cards + variant-access re-elements (§14.3).
 *  Takes a def-like { class|klass, biology, attunement, family, anatomy, weapons, subtypes }. */
export function potentialPool(def = {}) {
  const atts = arr(def.attunement?.length ? def.attunement : ['Physical']);
  const base = basePoolFor({ klass: def.class?.[0] ?? def.klass, biology: def.biology, family: def.family, anatomy: def.anatomy, weapons: def.weapons, subtypes: def.subtypes });
  return [...reskinDeck(base, atts), ...attunementCards(atts), ...attunementVariants(base, atts)];
}

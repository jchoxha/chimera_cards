// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/factorInfo — lookup for a creature's SPECIAL FACTORS         ║
// ║ (Beast anatomy / Humanoid weapons / Aberration features): what the tag    ║
// ║ IS (theme text from its kit) and the CARDS it contributes to the pool.    ║
// ║ Powers the clickable factor icons on creature cards.                      ║
// ║ UPDATE WHEN: a kit gains a factor system.                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { anatomyInfo, anatomyCards } from '../engine/cards/beastPool.js';
import { weaponInfo, weaponCards } from '../engine/cards/humanoidPool.js';
import { aberrationAnatomyInfo, aberrationAnatomyCards } from '../engine/cards/aberrationPool.js';
import { ANATOMY_ICON, WEAPON_ICON } from './axisIcons.js';

/**
 * Everything to show about a factor tag.
 * @param {string} tag  e.g. 'Venom', 'Sword', 'Tentacle'
 * @returns {{ tag, kind, kindLabel, icon, theme, cards }|null}
 */
export function factorInfo(tag) {
  const beast = anatomyInfo(tag);
  if (beast) {
    return { tag, kind: 'anatomy', kindLabel: 'Beast Anatomy', icon: ANATOMY_ICON[tag] || 'game-icons:paw-print',
      theme: beast.theme || '', cards: anatomyCards(tag) };
  }
  const weapon = weaponInfo(tag);
  if (weapon) {
    return { tag, kind: 'weapon', kindLabel: 'Weapon', icon: WEAPON_ICON[tag] || 'game-icons:broadsword',
      theme: weapon.theme || '', cards: weaponCards(tag) };
  }
  const feature = aberrationAnatomyInfo(tag);
  if (feature) {
    return { tag, kind: 'feature', kindLabel: 'Aberrant Feature', icon: ANATOMY_ICON[tag] || 'game-icons:eyestalk',
      theme: feature.theme || '', cards: aberrationAnatomyCards(tag) };
  }
  return null;
}

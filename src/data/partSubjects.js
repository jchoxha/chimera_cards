// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: data/partSubjects — the canonical "what each rig part depicts"     ║
// ║ text, ALONE and in the rig's expected orientation. Single source of truth  ║
// ║ shared by the browser Parts Studio and the Retro-Diffusion bake script, so ║
// ║ a part is described the same way wherever it is generated.                 ║
// ║                                                                            ║
// ║ Parts are drawn ISOLATED, in a FIXED orientation (a wing points RIGHT, a   ║
// ║ claw DOWN, a head faces LEFT, weapons stand upright grip-at-bottom) because ║
// ║ the rig owns placement + mirroring — never draw a part attached to a body. ║
// ║ Keys MUST match the part ids in src/data/partsRig.js.                      ║
// ║ UPDATE WHEN: a rig part is added/renamed.                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

export const PART_SUBJECT = Object.freeze({
  // bodies — headless torsos; the rig always adds a head
  'body-humanoid': 'a HEADLESS humanoid torso with arms, standing, facing the viewer, NO head and NO neck',
  'body-beast': 'a HEADLESS four-legged beast body seen from the side, facing left, NO head and NO neck',
  'body-aberration': 'a HEADLESS amorphous eldritch body, bulbous and tapering, NO head',
  // heads — always facing left so they seat consistently on a body
  'head-humanoid': 'a single humanoid head in profile facing left, no neck, no body',
  'head-beast': 'a single snouted beast head in profile facing left, no neck, no body',
  'head-aberration': 'a single bulbous eldritch head with several eyes, facing left, no neck',
  'head-draconic': 'a single horned dragon head in profile facing left, no neck, no body',
  'head-avian': 'a single sharp-beaked bird head in profile facing left, no neck',
  // attachments
  wings: 'a single outspread wing, side view, pointing RIGHT, detached, just the one wing',
  tail: 'a single long tapering tail, curving, detached, horizontal',
  claws: 'a single curved claw / talon, pointing DOWN, detached',
  horns: 'a single curved horn, pointing UP, detached',
  teeth: 'a pair of sharp pointed fangs, detached, pointing down',
  maw: 'a gaping open mouth full of teeth, front view, detached',
  eye: 'a cluster of three staring eyeballs, detached',
  beak: 'a single sharp hooked beak, pointing LEFT, detached',
  quills: 'a row of sharp upright quills / spines, detached',
  shell: 'a domed turtle-like shell carapace, front view, detached',
  carapace: 'a segmented insect carapace plate, front view, detached',
  tentacle: 'a single writhing tentacle, pointing DOWN, detached',
  pseudopod: 'a single blobby ooze pseudopod limb, pointing DOWN, detached',
  roots: 'a bundle of gnarled roots spreading downward, detached',
  spore: 'a scattering of floating round spore puffs',
  miasma: 'a soft cloud of drifting toxic miasma vapour',
  shard: 'a single sharp crystal shard, pointing UP, detached',
  mandible: 'a pair of curved insect mandibles / pincers, detached',
  cilia: 'a row of fine waving cilia hairs, detached',
  membrane: 'a single translucent webbed membrane fin, pointing RIGHT, detached',
  ichor: 'several thick dripping droplets of glowing ichor',
  venom: 'several dripping droplets of venom',
  hide: 'a patch of thick armoured animal hide plating, front view',
  hooves: 'a single hoof, pointing DOWN, detached',
  roar: 'a wide roaring open maw, front view, detached',
  breath: 'a cone of elemental breath billowing to the LEFT',
  // weapons — upright, gripped end at the bottom
  'w-sword': 'a single sword, blade pointing UP, vertical, detached',
  'w-axe': 'a single battle axe, head at the top, vertical, detached',
  'w-hammer': 'a single great warhammer, head at the top, vertical, detached',
  'w-mace': 'a single spiked mace, head at the top, vertical, detached',
  'w-spear': 'a single spear, point UP, vertical, detached',
  'w-staff': 'a single wizard staff with a glowing orb on top, vertical, detached',
  'w-wand': 'a single short magic wand, vertical, detached',
  'w-dagger': 'a single dagger, blade pointing UP, vertical, detached',
  'w-bow': 'a single longbow, strung, vertical, detached',
  'w-crossbow': 'a single crossbow, front view, detached',
  'w-shield': 'a single round shield, front view, detached',
  'w-fist': 'a single clenched armoured gauntlet fist, detached',
});

/** The three body parts, in the order the bake produces them (bodies first, so
 *  every other part can reference them for a consistent style). */
export const BODY_PART_IDS = Object.freeze(['body-beast', 'body-humanoid', 'body-aberration']);

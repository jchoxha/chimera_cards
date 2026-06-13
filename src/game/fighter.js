import { uid, shuffle, clamp } from "../utils.js";
import { UNIVERSAL_CARDS } from "../data/moves.js";
import { FORMS } from "../systems/elements.jsx";
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

export { buildFighterDeck, makeFighter };

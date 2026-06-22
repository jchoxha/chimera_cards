// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: engine/cards/cardText — AUTO-GENERATE a card's description    ║
// ║ from its effect op-list (so text need not be hand-written), plus a    ║
// ║ KEYWORD GLOSSARY + a linkifier so the UI can make keywords clickable.  ║
// ║ UPDATE WHEN: new ops / keywords / statuses need phrasing or glossary.  ║
// ╚══════════════════════════════════════════════════════════════════╝

const STATUS_LABEL = {
  strength: 'Strength', dexterity: 'Dexterity', regen: 'Regen',
  vulnerable: 'Vulnerable', weak: 'Weak', burn: 'Burn', poison: 'Poison',
};
const EVENT_LABEL = {
  cardsPlayed: 'cards played', cardsDrawn: 'cards drawn', cardsDiscarded: 'cards discarded',
  cardsExhausted: 'cards exhausted', damageDealt: 'damage dealt', damageTaken: 'damage taken',
  blockGained: 'Block gained', energySpent: 'energy spent',
};
const TRIGGER_PHRASE = {
  turnStart: 'At the start of your turn, ', turnEnd: 'At the end of your turn, ',
  onGainBlock: 'Whenever you gain Block, ', onDamageDealt: 'Whenever you deal damage, ',
  onDamageTaken: 'Whenever you take damage, ', onCardPlayed: 'Whenever you play a card, ',
  onDraw: 'Whenever you draw, ', onDiscard: 'Whenever you discard, ',
  onExhaust: 'Whenever you Exhaust a card, ', onEnergySpent: 'Whenever you spend energy, ',
  onDeath: 'On death, ', fatal: 'On a kill, ',
};
const win = (w) => (w === 'thisCombat' ? 'combat' : 'turn');
const lc = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function scopePhrase(op) {
  const s = op.scope || '';
  if (/wholeEnemy/i.test(s)) return ' to ALL enemies';
  if (/wholeFriendly/i.test(s)) return ' to all allies';
  if (/flexEnemy|enemyBench|piercingEnemy/i.test(s)) return ' to any enemy';
  if (/flexFriendly|friendlyBench|piercingFriendly/i.test(s)) return ' to an ally';
  return '';
}
function scalePhrase(sb) { return ` (+${sb.per ?? 1} per ${EVENT_LABEL[sb.event] || sb.event} this ${win(sb.window)})`; }
function conditionPhrase(c) { return `If ${EVENT_LABEL[c.event] || c.event} is ${c.verb} ${c.threshold} this ${win(c.window)}, `; }

/** Human phrase for a single effect op (no trailing period). `ctx.element` = the
 * card's damage element, shown explicitly on damage ("Deal 6 Physical damage"). */
export function opPhrase(op, ctx = {}) {
  const el = ctx.element ? `${ctx.element} ` : '';
  switch (op.op) {
    case 'damage': {
      const base = op.valueFrom === 'selfBlock' ? `${el}damage equal to your Block` : `${op.value ?? 0} ${el}damage`;
      const hits = op.hits === 'X' ? ' X times' : (op.hits > 1 ? ` ${op.hits} times` : '');
      let s = `Deal ${base}${hits}${scopePhrase(op)}`;
      if (op.scaleBy) s += scalePhrase(op.scaleBy);
      if (op.bonusIf) {
        if (op.bonusIf.targetHpPctBelow != null) s += ` (${op.bonusMult ? `×${op.bonusMult}` : `+${op.bonusAdd}`} vs targets below ${Math.round(op.bonusIf.targetHpPctBelow * 100)}% HP)`;
        else if (op.bonusIf.stance) s += ` (${op.bonusAdd ? `+${op.bonusAdd}` : 'bonus'} if in ${op.bonusIf.stance})`;
      }
      return s;
    }
    case 'block': {
      const v = op.valueFrom === 'selfBlock' ? 'Block equal to your Block' : `${op.value ?? 0} Block`;
      let s = `Gain ${v}`;
      if (op.bonusPerDexterity) s += ` (+${op.bonusPerDexterity + 1}× Dexterity)`;
      if (op.brace) s += ' that Braces';
      if (op.scaleBy) s += scalePhrase(op.scaleBy);
      return s;
    }
    case 'buff': return `Gain ${op.value ?? 0} ${STATUS_LABEL[op.status] || op.status}`;
    case 'debuff': return `Apply ${op.value ?? 0} ${STATUS_LABEL[op.status] || op.status}${scopePhrase(op)}`;
    case 'heal': return `Heal ${op.value ?? 0} HP`;
    case 'draw': return `Draw ${op.value ?? 0}`;
    case 'energy': return `Gain ${op.value ?? 0} energy`;
    case 'pay': {
      const parts = [];
      if (op.block) parts.push(`${op.block} Block`);
      if (op.hp) parts.push(`${op.hp} HP`);
      return `Lose ${parts.join(' and ') || 'nothing'}`;
    }
    case 'stance': return op.set ? `Enter ${op.set} stance`
      : `Shift ${op.shift?.steps || 1} step${(op.shift?.steps || 1) > 1 ? 's' : ''} toward ${op.shift?.dir || 'offense'}`;
    default: return '';
  }
}

function clausePhrase(op, ctx = {}) {
  let p = opPhrase(op, ctx);
  if (!p) return '';
  if (op.trigger && op.trigger !== 'onPlay') p = (TRIGGER_PHRASE[op.trigger] || `On ${op.trigger}, `) + lc(p);
  else if (op.condition) p = conditionPhrase(op.condition) + lc(p);
  return p;
}

/** Build the full card description from its effects + power trigger/passive + keywords. */
export function describeCard(card) {
  if (!card) return '';
  const ctx = { element: card.attunement };
  const clauses = (card.effects || []).map((o) => clausePhrase(o, ctx)).filter(Boolean);
  let text = clauses.join('. ');
  if (text) text += '.';

  if (card.type === 'power' && card.trigger?.effects?.length) {
    const inner = card.trigger.effects.map((o) => lc(opPhrase(o, ctx))).filter(Boolean).join(', ');
    text += ` ${(TRIGGER_PHRASE[card.trigger.on] || `On ${card.trigger.on}, `)}${inner}.`;
  }
  if (card.passive) text += ` ${PASSIVE_LABEL[card.passive] || card.passive}.`;
  if (card.imbue) text += ' Imbue.';
  for (const kw of card.keywords || []) if (kw !== 'unplayable') text += ` ${cap(kw)}.`;
  return text.trim();
}

/** Derived text first; a hand-written `text` is an override fallback. */
export function cardText(card) {
  return describeCard(card) || card?.text || '';
}

const PASSIVE_LABEL = { blockAlwaysBraces: 'Your Block always Braces' };

// ── Keyword glossary + linkifier ──────────────────────────────────────────────
export const KEYWORD_GLOSSARY = {
  Block: 'Temporary HP shield; absorbs damage, then clears at the start of your turn.',
  Brace: 'Affected Block does NOT decay between turns — it persists until spent.',
  Imbue: "This card also inflicts your creature's attunement signature status (e.g. Fire→Burn, Nature→Poison, Shadow→Vulnerable). Pure-element attunements add nothing yet.",
  Strength: 'Increases the damage of each attack by its amount.',
  Dexterity: 'Increases the Block gained by Block effects by its amount.',
  Vulnerable: 'This unit takes +50% damage from attacks.',
  Weak: 'This unit deals −25% attack damage.',
  Regen: 'Heal this amount at the end of your turn; decreases by 1 each turn.',
  Burn: 'Lose HP equal to its amount each turn (bypasses Block); decays.',
  Poison: 'Lose HP equal to its amount each turn (bypasses Block); does not decay.',
  Exhaust: 'When played, this card leaves your deck for the rest of combat.',
  Ethereal: 'If still in hand at end of turn, this card Exhausts.',
  Retain: 'This card is kept in hand at the end of your turn instead of discarding.',
  Innate: 'This card starts in your opening hand.',
  Stance: 'A persistent combat mode on the Stance Spectrum (Rampage→Full Guard).',
  Rampage: 'Stance: deal ×2 damage, but you cannot gain Block.',
  Offensive: 'Stance: gain +1 Strength per Attack played; cannot gain Block.',
  Balanced: 'Stance: may both Attack and gain Block; no bonus.',
  Defensive: 'Stance: gain +1 Dexterity per Skill played; cannot Attack.',
  'Full Guard': 'Stance: your Block Braces, but you cannot Attack.',
  energy: 'The resource spent to play cards each turn.',
};

const TERMS = Object.keys(KEYWORD_GLOSSARY).sort((a, b) => b.length - a.length);
const TERM_RE = new RegExp(`\\b(${TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
const CANON = Object.fromEntries(TERMS.map((t) => [t.toLowerCase(), t]));

/**
 * Split text into segments; segments matching a glossary term carry `term`
 * (the canonical key) so the UI can render them as clickable keywords.
 * @returns {{ text:string, term?:string }[]}
 */
export function linkifySegments(text) {
  const out = [];
  let last = 0; let m;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], term: CANON[m[0].toLowerCase()] });
    last = TERM_RE.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

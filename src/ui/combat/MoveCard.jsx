// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/MoveCard — the canonical move-card tile. The SAME      ║
// ║ structure + classes the in-hand combat card uses (.frame.move with       ║
// ║ cost/inner/micon/mn/mt), styled by combat.css. The `display` modifier     ║
// ║ swaps the fan sizing for a static, clickable card. Reused by the run      ║
// ║ rewards/shop AND the Card Forge gallery so every card looks identical.    ║
// ║ UPDATE WHEN: the in-hand card markup changes (keep this in lock-step).   ║
// ╚══════════════════════════════════════════════════════════════════╝

import React from 'react';
import { cardText } from '../../engine/cards/cardText.js';
import { cardIcon as axisCardIcon } from '../../data/axisIcons.js';
import { cardArt } from '../../data/artPool.js';
import { frameStyle } from './frames.js';

const RIcon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

/** atk/def/util — the bucket that tints the art tile, same as the in-hand card. */
export function cardKind(c) {
  const e = Array.isArray(c?.effects) ? c.effects : [];
  if (e.some((o) => o.op === 'damage')) return 'atk';
  if (e.some((o) => o.op === 'block')) return 'def';
  return 'util';
}

/** The card's display element: combat sets c.element; data cards carry attunement. */
const elementOf = (c) => c.element ?? (Array.isArray(c.attunement) ? c.attunement[0] : c.attunement);

/**
 * A move card rendered exactly like the in-hand combat card.
 * @param {object}   props.c         the card (combat or CardSpec data shape)
 * @param {boolean} [props.selected] highlight ring
 * @param {boolean} [props.disabled] greyed/unplayable
 * @param {number}  [props.price]    optional gold price tag
 * @param {function}[props.onClick]
 * @param {string}  [props.className] extra classes
 */
export default function MoveCard({ c, selected, disabled, price, onClick, className = '' }) {
  const f = frameStyle({ element: elementOf(c), rarity: c.rarity });
  const art = cardArt(c);
  return (
    <button type="button" disabled={disabled}
      className={`frame move display ${f.finish}${selected ? ' sel' : ''}${disabled ? ' unplayable' : ''}${className ? ` ${className}` : ''}`}
      style={{ background: f.background }} onClick={onClick}>
      {f.holo && <div className="holo" />}
      <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
      <div className="inner">
        <div className={`micon ${cardKind(c)}`}>{art ? <img className="artImg" src={art} alt="" /> : <RIcon icon={axisCardIcon(c)} />}</div>
        <div className="mn">{c.name}</div>
        <div className="mt">{cardText(c)}</div>
        {price != null && <div className="mPrice"><RIcon icon="game-icons:two-coins" /> {price}g</div>}
      </div>
    </button>
  );
}

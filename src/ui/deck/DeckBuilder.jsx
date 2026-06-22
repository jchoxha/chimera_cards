// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/deck/DeckBuilder — reusable rarity-weighted DECK BUILDER.  ║
// ║ Pool on the left, your deck on the right, a budget meter up top. Pure  ║
// ║ presentation over engine/deck/budget.js. Reused by: the playtest flow  ║
// ║ now; open-world deckbuilding + pre-dungeon drafting later (just pass a   ║
// ║ different `pool`/`budget`). UI reads props + local build state only.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useState } from 'react';
import { cardText } from '../../engine/cards/cardText.js';
import { LOOT_RARITIES } from '../../engine/types.js';
import {
  cardCost, deckCost, deckSize, canAdd, validateDeck, indexPool, expandDeck,
  DEFAULT_BUDGET,
} from '../../engine/deck/budget.js';
import './deck.css';

const RARITY_COLOR = {
  basic: '#8c8c8c', common: '#e8e6f0', uncommon: '#7ee787', rare: '#4d9fff',
  epic: '#a571ff', mythic: '#ff5a4d', legendary: '#ff9a3d', godly: '#ffd34d',
};
const RARITY_ORDER = ['basic', ...LOOT_RARITIES];

/**
 * @param {Object} props
 * @param {Object[]} props.pool        Available CardSpec cards (the creature's potential pool).
 * @param {Object} [props.initial]     Initial counts map { baseId: copies }.
 * @param {number} [props.budget]      Points cap (default 24; open-world passes a tier budget).
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {(deck: Object[]) => void} props.onConfirm  Receives the expanded CardSpec[] deck.
 * @param {() => void} [props.onCancel]
 */
export default function DeckBuilder({ pool = [], initial = {}, budget = DEFAULT_BUDGET, title = 'Build your deck', subtitle, onConfirm, onCancel }) {
  const [counts, setCounts] = useState(() => ({ ...initial }));
  const [cap, setCap] = useState(budget);
  const [sandbox, setSandbox] = useState(false);
  const [filter, setFilter] = useState('');

  const idx = useMemo(() => indexPool(pool), [pool]);
  const opts = { budget: cap, sandbox };
  const cost = deckCost(counts, idx);
  const size = deckSize(counts);
  const result = validateDeck(counts, idx, opts);

  const add = (card) => { if (canAdd(counts, card, idx, opts).ok) setCounts((c) => ({ ...c, [card.id]: (c[card.id] ?? 0) + 1 })); };
  const remove = (id) => setCounts((c) => {
    const n = (c[id] ?? 0) - 1; const next = { ...c };
    if (n <= 0) delete next[id]; else next[id] = n;
    return next;
  });
  const clear = () => setCounts({});

  // Pool grouped by rarity (ladder order), filtered by the search box.
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const match = (c) => !q || (c.name || '').toLowerCase().includes(q) || (c.type || '').toLowerCase().includes(q);
    const byR = {};
    for (const c of pool) {
      if (!match(c)) continue;
      const r = c.rarity || 'common';
      (byR[r] = byR[r] || []).push(c);
    }
    for (const r of Object.keys(byR)) byR[r].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || (a.name || '').localeCompare(b.name || ''));
    return RARITY_ORDER.filter((r) => byR[r]?.length).map((r) => [r, byR[r]]);
  }, [pool, filter]);

  const deckList = Object.entries(counts)
    .map(([id, n]) => [idx[id], n]).filter(([c]) => c)
    .sort(([a], [b]) => RARITY_ORDER.indexOf(a.rarity || 'common') - RARITY_ORDER.indexOf(b.rarity || 'common') || (a.name || '').localeCompare(b.name || ''));

  const pct = cap > 0 ? Math.min(100, Math.round((cost / cap) * 100)) : 0;
  const over = !sandbox && cost > cap;

  return (
    <div className="db">
      <header className="dbHead">
        <div className="dbTitle">
          <h2>{title}</h2>
          {subtitle && <span className="dbSub">{subtitle}</span>}
        </div>
        <div className="dbBudget">
          <div className={`dbMeter${over ? ' over' : ''}`}><span style={{ width: `${pct}%` }} /></div>
          <div className="dbBudgetNums">
            <strong className={over ? 'over' : ''}>{cost}</strong> / {sandbox ? '∞' : cap} pts · {size} cards
          </div>
        </div>
        <div className="dbControls">
          <label className="dbCap">Budget
            <input type="number" min="0" value={cap} disabled={sandbox} onChange={(e) => setCap(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="dbSandbox"><input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} /> Sandbox</label>
          <button className="dbBtn ghost" onClick={clear}>Clear</button>
          {onCancel && <button className="dbBtn ghost" onClick={onCancel}>Back</button>}
          <button className="dbBtn go" disabled={!result.ok} title={result.errors.join('; ')}
            onClick={() => onConfirm?.(expandDeck(counts, idx))}>
            Fight with this deck →
          </button>
        </div>
      </header>

      {!result.ok && <div className="dbErr">{result.errors.join(' · ')}</div>}

      <div className="dbBody">
        <section className="dbPool">
          <div className="dbColHead">
            <span>Card Pool</span>
            <input className="dbFilter" placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {groups.map(([rarity, cards]) => (
            <div key={rarity} className="dbGroup">
              <div className="dbGroupHead" style={{ color: RARITY_COLOR[rarity] }}>{rarity} · {cardCost(cards[0])} pt</div>
              <div className="dbCards">
                {cards.map((card) => {
                  const n = counts[card.id] ?? 0;
                  const ca = canAdd(counts, card, idx, opts);
                  return (
                    <button key={card.id} className={`dbCard${n ? ' inDeck' : ''}${ca.ok ? '' : ' blocked'}`}
                      style={{ borderColor: RARITY_COLOR[card.rarity || 'common'] }}
                      title={ca.ok ? 'Add' : ca.reason} onClick={() => add(card)}>
                      <div className="dbCardTop">
                        <span className="dbCardName">{card.name}</span>
                        <span className="dbCardCost">{card.cost ?? 0}⚡ · {cardCost(card)}pt</span>
                      </div>
                      <div className="dbCardText">{cardText(card)}</div>
                      <div className="dbCardFoot">
                        <span className="dbCardType">{card.type}{card.attunement ? ` · ${card.attunement}` : ''}</span>
                        {n > 0 && <span className="dbCardN">×{n}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="dbDeck">
          <div className="dbColHead"><span>Your Deck ({size})</span></div>
          {deckList.length === 0 && <p className="dbEmpty">Tap cards on the left to add them.</p>}
          {deckList.map(([card, n]) => (
            <div key={card.id} className="dbRow" style={{ borderLeftColor: RARITY_COLOR[card.rarity || 'common'] }}>
              <span className="dbRowName">{card.name}</span>
              <span className="dbRowCost">{cardCost(card)}pt</span>
              <span className="dbStepper">
                <button onClick={() => remove(card.id)}>−</button>
                <b>{n}</b>
                <button disabled={!canAdd(counts, card, idx, opts).ok} onClick={() => add(card)}>+</button>
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

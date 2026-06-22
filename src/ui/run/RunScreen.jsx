// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/run/RunScreen — the run/meta view: act map, party/gold/    ║
// ║ relics/potions bar, non-combat rooms (rest/treasure/shop/event),       ║
// ║ card-reward picker, and win/lose. Combat is the embedded CombatScreen; ║
// ║ this host owns the post-fight flow. Reads runStore + combatStore.      ║
// ╚══════════════════════════════════════════════════════════════════╝

import React from 'react';
import { useRun } from '../../store/runStore.js';
import { useCombat } from '../../store/combatStore.js';
import CombatScreen from '../combat/CombatScreen.jsx';
import { currentNode } from '../../engine/run/map.js';
import { makeRng } from '../../engine/run/rng.js';
import { RELICS, POTIONS, EVENTS } from '../../engine/run/content.js';
import './run.css';

const NODE_ICON = { combat: '⚔', elite: '☠', boss: '👑', rest: '🔥', shop: '🛒', treasure: '💎', event: '❓' };
const roomRng = (s) => makeRng((s.rngState ^ (s.floor * 0x9e3779b1)) >>> 0);

function PartyBar({ snap }) {
  return (
    <div className="runBar">
      {snap.party.map((m) => (
        <div key={m.id} className={`pStat ${m.hp <= 0 ? 'dead' : ''}`}>
          <b>{m.name}</b> <span>{m.hp}/{m.maxHp}</span>
          <div className="pHp"><div style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%` }} /></div>
        </div>
      ))}
      <span className="runGold">💰 {snap.gold}</span>
      <span className="runRelics">{snap.relics.map((r) => <span key={r.id} title={r.text}>🟡</span>)}</span>
      <span className="runPotions">{snap.potions.map((p, i) => <span key={i} title={p.text}>🧪</span>)}</span>
    </div>
  );
}

function CardChip({ c, onClick }) {
  return (
    <button className="cardChip" onClick={onClick}>
      <div className="ccTop"><span className="ccCost">{c.cost === -1 ? 'X' : c.cost}</span><b>{c.name}</b></div>
      <div className="ccText">{c.text || ''}</div>
    </button>
  );
}

export default function RunScreen({ onMenu }) {
  const run = useRun();
  const combat = useCombat();
  const snap = run.snap;
  if (!snap) return <div className="runWrap"><p>No active run.</p></div>;

  const node = currentNode(snap);
  const reachable = (snap.map?.edges || []).filter((e) => e[0] === snap.position).map((e) => e[1]);

  // ── COMBAT (embedded) ──
  if (run.view === 'combat') {
    const over = combat.snap && (combat.snap.phase === 'victory' || combat.snap.phase === 'defeat');
    const won = combat.snap?.phase === 'victory';
    return (
      <div className="runCombat">
        <CombatScreen embedded onMenu={onMenu} />
        {over && (
          <div className="overlay"><div className="panel">
            <h1 className={won ? '' : 'lose'}>{won ? 'VICTORY' : 'DEFEAT'}</h1>
            <button className="endBtn" onClick={() => run.resolveCombat()}>Continue →</button>
          </div></div>
        )}
      </div>
    );
  }

  // ── REWARD ──
  if (run.view === 'reward') {
    return (
      <div className="runWrap">
        <h2>Choose a card</h2>
        <div className="rewardCards">
          {(snap.pendingReward || []).map((c, i) => <CardChip key={i} c={c} onClick={() => run.chooseReward(c)} />)}
        </div>
        <button className="runBtn" onClick={() => run.skipReward()}>Skip</button>
      </div>
    );
  }

  // ── NON-COMBAT ROOM ──
  if (run.view === 'room' && node) {
    return <Room run={run} snap={snap} node={node} />;
  }

  // ── OVER ──
  if (run.view === 'over') {
    const won = snap.status === 'won';
    return (
      <div className="runWrap over">
        <h1 className={won ? '' : 'lose'}>{won ? 'RUN COMPLETE' : 'YOU DIED'}</h1>
        <p>{won ? 'You cleared the act.' : 'Your party fell.'}</p>
        <div className="runActions">
          <button className="runBtn" onClick={onMenu}>Main Menu</button>
        </div>
      </div>
    );
  }

  // ── MAP ──
  return (
    <div className="runWrap">
      <div className="runHead">
        <button className="runBtn small" onClick={onMenu}>≡ Menu</button>
        <h2>Act {snap.act} — Floor {snap.floor}</h2>
        <button className="runBtn small" onClick={() => run.undo()} disabled={!run.canUndo()}>↶ Undo</button>
      </div>
      <PartyBar snap={snap} />
      <div className="actMap">
        {snap.map.nodes.map((n) => {
          const isCurrent = n.id === snap.position;
          const isNext = reachable.includes(n.id);
          return (
            <div key={n.id}
              className={`mapNode ${n.type} ${isCurrent ? 'current' : ''} ${n.visited ? 'visited' : ''} ${isNext ? 'next' : ''}`}
              onClick={isNext ? () => run.goTo(n.id) : undefined}>
              <span className="nIcon">{NODE_ICON[n.type] || '•'}</span>
              <span className="nType">{n.type}</span>
              {isNext && <span className="nGo">▶</span>}
            </div>
          );
        })}
      </div>
      <p className="runHint">Click the next ▶ node to advance.</p>
    </div>
  );
}

// ── Non-combat room views ─────────────────────────────────────────────────────
function Room({ run, snap, node }) {
  if (node.type === 'rest') {
    const member = snap.party[0];
    const upgradable = (member?.deck || []).filter((c) => !c.upgraded);
    return (
      <div className="runWrap">
        <h2>🔥 Campfire</h2>
        <PartyBar snap={snap} />
        <div className="roomCol">
          <button className="runBtn" onClick={() => { run.dispatch('healParty', { pct: 0.3 }); run.finishRoom(); }}>Rest — heal 30% HP</button>
          <div className="upgradeList">
            <p>…or upgrade a card:</p>
            {upgradable.map((c) => (
              <button key={c.id} className="cardChip" onClick={() => { run.dispatch('upgradeCard', { memberId: member.id, cardId: c.id }); run.finishRoom(); }}>
                <div className="ccTop"><span className="ccCost">{c.cost === -1 ? 'X' : c.cost}</span><b>{c.name}</b></div>
                <div className="ccText">{c.text || ''}</div>
              </button>
            ))}
            {!upgradable.length && <p className="runHint">All cards upgraded.</p>}
          </div>
        </div>
      </div>
    );
  }

  if (node.type === 'treasure') {
    const owned = new Set(snap.relics.map((r) => r.id));
    const pool = RELICS.filter((r) => !owned.has(r.id));
    const relic = pool.length ? roomRng(snap).pick(pool) : null;
    return (
      <div className="runWrap">
        <h2>💎 Treasure</h2>
        {relic ? (
          <div className="roomCol">
            <div className="relicCard"><b>{relic.name}</b><p>{relic.text}</p></div>
            <button className="runBtn" onClick={() => { run.dispatch('addRelic', { relic }); run.finishRoom(); }}>Take {relic.name}</button>
          </div>
        ) : <p>Nothing left to find.</p>}
        <button className="runBtn small" onClick={() => run.finishRoom()}>Leave</button>
      </div>
    );
  }

  if (node.type === 'shop') {
    const owned = new Set(snap.relics.map((r) => r.id));
    const relicStock = RELICS.filter((r) => !owned.has(r.id)).slice(0, 2);
    const potionStock = POTIONS.slice(0, 3);
    return (
      <div className="runWrap">
        <h2>🛒 Shop — 💰 {snap.gold}</h2>
        <div className="roomCol">
          {relicStock.map((r) => (
            <button key={r.id} className="shopItem" disabled={snap.gold < r.cost} onClick={() => run.dispatch('buyRelic', { relic: r, cost: r.cost })}>
              🟡 <b>{r.name}</b> — {r.cost}g <span className="ccText">{r.text}</span>
            </button>
          ))}
          {potionStock.map((p) => (
            <button key={p.id} className="shopItem" disabled={snap.gold < p.cost} onClick={() => run.dispatch('buyPotion', { potion: p, cost: p.cost })}>
              🧪 <b>{p.name}</b> — {p.cost}g <span className="ccText">{p.text}</span>
            </button>
          ))}
        </div>
        <button className="runBtn" onClick={() => run.finishRoom()}>Leave</button>
      </div>
    );
  }

  if (node.type === 'event') {
    const ev = roomRng(snap).pick(EVENTS);
    return (
      <div className="runWrap">
        <h2>❓ {ev.name}</h2>
        <p className="eventText">{ev.text}</p>
        <div className="roomCol">
          {ev.choices.map((ch, i) => (
            <button key={i} className="runBtn" onClick={() => { for (const a of ch.actions) run.dispatch(a.type, a); run.finishRoom(); }}>{ch.text}</button>
          ))}
        </div>
      </div>
    );
  }

  return <div className="runWrap"><p>Unknown room.</p><button className="runBtn" onClick={() => run.finishRoom()}>Continue</button></div>;
}

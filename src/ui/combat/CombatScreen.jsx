// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/CombatScreen — minimal playable view of the new   ║
// ║ engine. Mobile-portrait first (enemies top, party center, hand at   ║
// ║ the bottom thumb-zone).                                             ║
// ║ UPDATE WHEN: combat UX changes. This is a Phase-2 demo, not the      ║
// ║ final Phaser view.                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useState } from 'react';
import { useCombat } from '../../store/combatStore.js';

const C = {
  root: { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#0b0b14', color: '#e8e6f0', fontFamily: 'system-ui, sans-serif', gap: 8, padding: 10, boxSizing: 'border-box' },
  zone: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  enemy: (sel) => ({ flex: '1 1 140px', maxWidth: 220, background: '#1a1530', border: `2px solid ${sel ? '#ffd34d' : '#3a2a40'}`, borderRadius: 12, padding: 10, position: 'relative', cursor: 'pointer' }),
  mon: (active) => ({ flex: '1 1 90px', maxWidth: 140, background: '#15132e', border: `2px solid ${active ? '#7ee787' : '#2c2a40'}`, borderRadius: 12, padding: 8, textAlign: 'center' }),
  bar: { height: 14, background: '#0c0b16', borderRadius: 8, overflow: 'hidden', border: '1px solid #2c2a40', marginTop: 4, position: 'relative' },
  fill: (pct, color) => ({ width: `${pct}%`, height: '100%', background: color, transition: 'width .2s' }),
  intent: { position: 'absolute', top: -10, right: 8, background: '#ff5a4d', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 800, fontFamily: 'monospace' },
  hud: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', borderTop: '1px solid #232136', borderBottom: '1px solid #232136' },
  hand: { display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 2px 2px' },
  card: (playable) => ({ flex: '0 0 96px', minHeight: 132, background: playable ? 'linear-gradient(160deg,#1c1838,#15122a)' : '#141226', border: `2px solid ${playable ? '#ffd34d' : '#2c2a40'}`, borderRadius: 11, padding: 7, opacity: playable ? 1 : 0.5, cursor: playable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4 }),
  cost: { alignSelf: 'flex-start', background: '#ffd34d', color: '#1a1208', borderRadius: '50%', width: 22, height: 22, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 },
  btn: { background: 'linear-gradient(135deg,#ffd34d,#ff9a3d)', color: '#1a1208', border: 'none', padding: '12px 20px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  pill: { fontSize: 10, background: '#2c2a40', borderRadius: 8, padding: '1px 6px', marginRight: 3 },
  overlay: { position: 'fixed', inset: 0, background: '#0b0b14e6', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 },
};

function intentLabel(intent) {
  if (!intent) return '…';
  switch (intent.kind) {
    case 'attack': return `⚔ ${intent.value}${intent.hits > 1 ? `×${intent.hits}` : ''}`;
    case 'block': return `🛡 ${intent.value}`;
    case 'buff': return `▲ +${intent.value} STR`;
    case 'debuff': return `☠ Weak`;
    default: return '?';
  }
}

function Bar({ hp, maxHp, color = '#7ee787' }) {
  return (
    <div style={C.bar}>
      <div style={C.fill(Math.max(0, (hp / maxHp) * 100), color)} />
      <span style={{ position: 'absolute', inset: 0, fontSize: 10, textAlign: 'center', lineHeight: '14px' }}>{hp}/{maxHp}</span>
    </div>
  );
}

function StatusList({ statuses }) {
  if (!statuses?.length) return null;
  return <div style={{ marginTop: 4 }}>{statuses.map((s) => <span key={s.id} style={C.pill}>{s.id} {s.amount}</span>)}</div>;
}

export default function CombatScreen() {
  const { snap, startCombat, playCard, endTurn, reward, rollReward } = useCombat();
  const [target, setTarget] = useState(null);

  useEffect(() => { if (!snap) startCombat(); }, [snap, startCombat]);
  if (!snap) return <div style={C.root}>Loading…</div>;

  const livingEnemies = snap.enemies.filter((e) => e.hp > 0);
  const targetId = (target && livingEnemies.some((e) => e.id === target)) ? target : livingEnemies[0]?.id;
  const isPlayerTurn = snap.phase === 'player';
  const over = snap.phase === 'victory' || snap.phase === 'defeat';

  return (
    <div style={C.root}>
      {/* Enemies (top) */}
      <div style={C.zone}>
        <div style={C.row}>
          {snap.enemies.map((e) => (
            <div key={e.id} style={C.enemy(e.id === targetId && e.hp > 0)}
              onClick={() => e.hp > 0 && setTarget(e.id)}>
              {e.hp > 0 && <span style={C.intent}>{intentLabel(e.intent)}</span>}
              <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}{e.hp <= 0 ? ' 💀' : ''}</div>
              <Bar hp={e.hp} maxHp={e.maxHp} color="#ff7a6b" />
              {e.block > 0 && <div style={{ fontSize: 11, marginTop: 2 }}>🛡 {e.block}</div>}
              <StatusList statuses={e.statuses} />
            </div>
          ))}
        </div>
      </div>

      {/* HUD */}
      <div style={C.hud}>
        <span>Turn {snap.turn}</span>
        <span style={{ fontWeight: 800 }}>⚡ {snap.energy}/{snap.energyPerTurn}</span>
        <span>🛡 {snap.block}</span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>▮{snap.piles.draw} ♻{snap.piles.discard}</span>
      </div>

      {/* Party (center) */}
      <div style={{ ...C.row, flex: '1 0 auto', alignItems: 'center' }}>
        {snap.party.map((m) => (
          <div key={m.id} style={C.mon(m.id === snap.activeId && m.hp > 0)}>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{m.name}{m.hp <= 0 ? ' 💀' : ''}</div>
            <div style={{ fontSize: 9, opacity: 0.6 }}>{m.types.map((t) => `${t.type} ${Math.round(t.weight * 100)}%`).join(' · ')}</div>
            <Bar hp={m.hp} maxHp={m.maxHp} />
            {m.id === snap.activeId && <StatusList statuses={snap.statuses} />}
          </div>
        ))}
      </div>

      {/* Hand + End Turn (bottom thumb-zone) */}
      <div style={C.zone}>
        <div style={C.hand}>
          {snap.hand.map((c, i) => {
            const playable = isPlayerTurn && c.cost <= snap.energy && c.cost !== -2;
            return (
              <div key={`${c.id}-${i}`} style={C.card(playable)}
                onClick={() => playable && playCard(c.id, targetId)}>
                <div style={C.cost}>{c.cost === -1 ? 'X' : c.cost}</div>
                <div style={{ fontWeight: 700, fontSize: 11, lineHeight: 1.1 }}>{c.name}</div>
                <div style={{ fontSize: 9, opacity: 0.75 }}>{c.text ?? describe(c)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button style={C.btn} disabled={!isPlayerTurn} onClick={endTurn}>End Turn ▶</button>
        </div>
      </div>

      {/* Victory / Defeat */}
      {over && (
        <div style={C.overlay}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h1 style={{ fontFamily: 'monospace' }}>{snap.phase === 'victory' ? '🏆 Victory' : '☠ Defeat'}</h1>
            {snap.phase === 'victory' && !reward && <button style={C.btn} onClick={() => rollReward(3)}>Open reward</button>}
            {reward && (
              <div style={{ ...C.row, marginTop: 12 }}>
                {reward.map((c, i) => (
                  <div key={i} style={C.card(true)}>
                    <div style={C.cost}>{c.cost}</div>
                    <div style={{ fontWeight: 700, fontSize: 11 }}>{c.name}</div>
                    <div style={{ fontSize: 9, opacity: 0.7 }}>{c.rarity} · {c.element}</div>
                  </div>
                ))}
              </div>
            )}
            <div><button style={{ ...C.btn, marginTop: 16, background: '#2c2a40', color: '#e8e6f0' }} onClick={() => startCombat()}>New fight</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fallback one-liner if a card has no text. */
function describe(c) {
  const fx = c.effects ?? {};
  const parts = [];
  if (fx.dmg) parts.push(`Deal ${fx.dmg}${fx.hits > 1 ? `×${fx.hits}` : ''}`);
  if (fx.block) parts.push(`Block ${fx.block}`);
  if (fx.draw) parts.push(`Draw ${fx.draw}`);
  if (fx.strength) parts.push(`+${fx.strength} STR`);
  if (fx.applyStatus) for (const [k, v] of Object.entries(fx.applyStatus)) parts.push(`${k} ${v}`);
  return parts.join(', ') || '—';
}

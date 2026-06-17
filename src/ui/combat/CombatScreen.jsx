// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/CombatScreen — the playable combat view of the    ║
// ║ engine, wearing the locked "TCG" redesign (see combat.css, ported   ║
// ║ from public/mockup-battle.html). Mobile-portrait first.             ║
// ║                                                                     ║
// ║ Layout: topbar · enemy zone (overview strip of ALL foes + a         ║
// ║ carousel that features the targeted foe) · combat log · active      ║
// ║ ally card · dock (energy orb · switchable bench · End Turn) ·       ║
// ║ fanned hand. Reads ONLY the engine snapshot from combatStore.       ║
// ║ UPDATE WHEN: combat UX changes. Not the final Phaser view.          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useState } from 'react';
import { useCombat } from '../../store/combatStore.js';
import { elementMultiplier, ELEMENT_COLOR, FORMS } from '../../systems/elements.jsx';
import { frameStyle } from './frames.js';
import './combat.css';

// element → game-icons id for the element badge + attack-card art.
const ELEMENT_ICON = {
  pyre: 'game-icons:flame', frost: 'game-icons:snowflake-1', hydro: 'game-icons:water-drop',
  charge: 'game-icons:lightning-arc', aero: 'game-icons:wind-slap', stone: 'game-icons:stone-block',
  metal: 'game-icons:metal-bar', crystal: 'game-icons:crystal-cluster', toxin: 'game-icons:poison-bottle',
  flora: 'game-icons:high-grass', beast: 'game-icons:paw-print', lumen: 'game-icons:sun',
  aether: 'game-icons:sparkles', umbra: 'game-icons:moon-bats', void: 'game-icons:vortex',
  blood: 'game-icons:drop',
};

// status id → chip class + icon (only the statuses the engine currently emits;
// unknown ids fall back to a neutral chip showing the raw id).
const STATUS_META = {
  strength: { cls: 'str', icon: 'game-icons:biceps' },
  weak: { cls: 'weak', icon: 'game-icons:broken-shield' },
  vulnerable: { cls: 'vuln', icon: 'game-icons:cracked-shield' },
  frail: { cls: 'frail', icon: 'game-icons:shield-bash' },
  burn: { cls: 'burn', icon: 'game-icons:flame' },
  poison: { cls: 'pois', icon: 'game-icons:poison-bottle' },
  regen: { cls: '', icon: 'game-icons:health-normal' },
  chill: { cls: 'weak', icon: 'game-icons:snowflake-1' },
  soak: { cls: '', icon: 'game-icons:water-drop' },
  shock: { cls: 'str', icon: 'game-icons:lightning-arc' },
  decay: { cls: 'pois', icon: 'game-icons:skull-crossed-bones' },
};
// status id → enemy-strip dot class.
const DOT_CLASS = { burn: 'burn', poison: 'pois', strength: 'str', weak: 'weak', vulnerable: 'weak' };

function Icon({ icon, ...rest }) {
  return <iconify-icon icon={icon} {...rest}></iconify-icon>;
}

/** Size/form badge (top-left). Base size shows nothing. */
function SizeBadge({ form }) {
  const f = FORMS[form];
  if (!f || !f.label) return null;
  return <div className="size"><span className="bdg">{f.badge}</span>{f.label}</div>;
}
function artScale(form) { return FORMS[form]?.art ?? 1; }

function elementBadge(el) {
  if (!el) return null;
  const color = ELEMENT_COLOR[el] || '#c9a66b';
  return (
    <div className="elem" style={{ background: `radial-gradient(circle at 38% 30%, #fff6, ${color} 55%, #0006)` }}>
      <Icon icon={ELEMENT_ICON[el] || 'game-icons:rosa-shield'} />
      <em>{el}</em>
    </div>
  );
}

function StatChips({ statuses }) {
  if (!statuses?.length) return null;
  return (
    <>
      {statuses.map((s) => {
        const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
        return (
          <span key={s.id} className={`chip ${m.cls}`} title={s.id}>
            <Icon icon={m.icon} /> {s.amount}
          </span>
        );
      })}
    </>
  );
}

function intentView(intent) {
  if (!intent) return { icon: 'game-icons:help', text: '?' };
  switch (intent.kind) {
    case 'attack': return { icon: 'game-icons:crossed-swords', text: `${intent.value}${intent.hits > 1 ? `×${intent.hits}` : ''}` };
    case 'block': return { icon: 'game-icons:checked-shield', text: `${intent.value}` };
    case 'buff': return { icon: 'game-icons:upgrade', text: `+${intent.value}` };
    case 'debuff': return { icon: 'game-icons:broken-shield', text: 'Weak' };
    default: return { icon: 'game-icons:help', text: '?' };
  }
}

/** Card visual category from its mechanical effects. */
function cardKind(c) {
  const fx = c.effects ?? {};
  if (fx.dmg) return 'atk';
  if (fx.block) return 'def';
  return 'util';
}
function cardIcon(c) {
  const kind = cardKind(c);
  if (kind === 'atk') return ELEMENT_ICON[c.element] || 'game-icons:sword-clash';
  if (kind === 'def') return 'game-icons:checked-shield';
  return 'game-icons:swap-bag';
}

/** Fallback one-liner if a card has no display text. */
function describe(c) {
  const fx = c.effects ?? {};
  const parts = [];
  if (fx.dmg) parts.push(`Deal ${fx.dmg}${fx.hits > 1 ? `×${fx.hits}` : ''}`);
  if (fx.block) parts.push(`Block ${fx.block}`);
  if (fx.draw) parts.push(`Draw ${fx.draw}`);
  if (fx.energy) parts.push(`+${fx.energy} Energy`);
  if (fx.strength) parts.push(`+${fx.strength} Strength`);
  for (const [k, v] of Object.entries(fx.applyStatus ?? {})) parts.push(`${v} ${k}`);
  for (const [k, v] of Object.entries(fx.selfStatus ?? {})) parts.push(`${v} ${k}`);
  return parts.join(', ') || '—';
}

function HpBar({ hp, maxHp }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  return (
    <div className="hpWrap">
      <div className={`hpFill${pct <= 35 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
      <div className="hpTxt">{hp} / {maxHp}</div>
    </div>
  );
}

// ── combatant cards ───────────────────────────────────────────────────────────

function AllyCard({ m, block, statuses }) {
  const f = frameStyle({ types: m.types, element: m.element, rarity: m.rarity });
  return (
    <div className={`frame combat ${f.finish}`} style={{ background: f.background }}>
      {f.holo && <div className="holo" />}
      <SizeBadge form={m.form} />
      {elementBadge(m.element)}
      <span className="sideTag you">YOU</span>
      {block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          <span className="creature" style={{ transform: `scale(${artScale(m.form)})` }}>{m.sprite || '✶'}</span>
          <div className="artNote">AI-generated art goes here</div>
        </div>
        <div className="nameBan">{m.name}{m.hp <= 0 ? ' 💀' : ''}</div>
        <HpBar hp={m.hp} maxHp={m.maxHp} />
        <div className="stats"><StatChips statuses={statuses} /></div>
      </div>
    </div>
  );
}

function FoeCard({ e, matchup }) {
  const iv = intentView(e.intent);
  const f = frameStyle({ element: e.element, rarity: e.rarity });
  const scale = { transform: `scale(${artScale(e.form)})` };
  return (
    <div className={`frame combat ${f.finish}`} style={{ background: f.background }}>
      {f.holo && <div className="holo" />}
      <SizeBadge form={e.form} />
      {elementBadge(e.element)}
      <span className="sideTag foe">FOE</span>
      {e.hp > 0 && <span className="intent"><Icon icon={iv.icon} /> {iv.text}</span>}
      {e.block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {e.block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          {e.icon ? <Icon className="creature" icon={e.icon} style={scale} /> : <span className="creature" style={scale}>👾</span>}
          <div className="artNote">AI-generated art goes here</div>
        </div>
        <div className="nameBan">{e.name}{e.hp <= 0 ? ' 💀' : ''}</div>
        <HpBar hp={e.hp} maxHp={e.maxHp} />
        {matchup && <div className={`match ${matchup.good ? 'good' : 'bad'}`}>
          <Icon icon={matchup.good ? 'tabler:caret-up-filled' : 'tabler:caret-down-filled'} /> {matchup.label}
        </div>}
        <div className="stats"><StatChips statuses={e.statuses} /></div>
      </div>
    </div>
  );
}

// ── log ─────────────────────────────────────────────────────────────────────

function formatEvent(ev, nameOf) {
  const p = ev.payload ?? {};
  switch (ev.type) {
    case 'play':
      return <span><b>{p.card?.name}</b> played.</span>;
    case 'damage':
      if (p.hpLoss > 0) return <span className="dmg">{nameOf(p.targetId)} takes {p.hpLoss}{p.dot ? ' (dot)' : ''}.</span>;
      return null;
    case 'death':
      return <span className="rx">{nameOf(p.enemyId || p.monsterId)} falls.</span>;
    case 'intentResolved': {
      const iv = intentView(p.intent);
      return <span>{nameOf(p.enemyId)} acts — {iv.text}.</span>;
    }
    default:
      return null;
  }
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function CombatScreen() {
  const { snap, log, startCombat, playCard, endTurn, switchActive, reward, rollReward } = useCombat();
  const [target, setTarget] = useState(null);

  useEffect(() => { if (!snap) startCombat(); }, [snap, startCombat]);
  if (!snap) return <div className="cmbt">Loading…</div>;

  const living = snap.enemies.filter((e) => e.hp > 0);
  const targetId = (target && living.some((e) => e.id === target)) ? target : living[0]?.id;
  const featured = snap.enemies.find((e) => e.id === targetId) || snap.enemies[0];
  const activeMon = snap.party.find((m) => m.id === snap.activeId) || snap.party[0];
  const isPlayerTurn = snap.phase === 'player';
  const over = snap.phase === 'victory' || snap.phase === 'defeat';

  // matchup of the active monster's element attacking the featured foe.
  let matchup = null;
  if (activeMon?.element && featured?.element) {
    const mult = elementMultiplier(activeMon.element, featured.element);
    if (mult > 1) matchup = { good: true, label: 'SUPER EFFECTIVE' };
    else if (mult < 1) matchup = { good: false, label: 'RESISTED' };
  }

  const cycleTarget = (dir) => {
    if (living.length < 2) return;
    const i = living.findIndex((e) => e.id === targetId);
    const next = living[(i + dir + living.length) % living.length];
    setTarget(next.id);
  };

  const nameOf = (id) => snap.enemies.find((e) => e.id === id)?.name
    ?? snap.party.find((m) => m.id === id)?.name ?? 'Someone';
  const logLines = (log ?? []).slice(-8).map((ev, i) => {
    const node = formatEvent(ev, nameOf);
    return node ? <div key={i}>{node}</div> : null;
  }).filter(Boolean).slice(-4);

  return (
    <div className="cmbt">
      {/* topbar */}
      <div className="topbar">
        <span className="pill"><Icon icon="game-icons:dungeon-gate" /> The Proving Pit</span>
        <span className="pill">{over ? (snap.phase === 'victory' ? 'Victory' : 'Defeat') : isPlayerTurn ? 'Your turn' : 'Enemy turn'}</span>
        <span className="pill">Turn {snap.turn}</span>
      </div>

      {/* enemy zone: overview strip of all foes + featured (carousel) */}
      <div className="enemyZone">
        <div className="enemyStrip">
          {snap.enemies.map((e) => {
            const iv = intentView(e.intent);
            const dead = e.hp <= 0;
            return (
              <div key={e.id} className={`efoe${e.id === targetId && !dead ? ' sel' : ''}${dead ? ' dead' : ''}`}
                onClick={() => !dead && setTarget(e.id)}>
                <div className="nm">
                  <span>{e.name}</span>
                  {!dead && <span className="it"><Icon icon={iv.icon} /> {iv.text}</span>}
                </div>
                <div className="mini"><i style={{ width: `${Math.max(0, (e.hp / e.maxHp) * 100)}%` }} /></div>
                <div className="dots">{e.statuses.map((s) => <span key={s.id} className={`dot ${DOT_CLASS[s.id] || ''}`} title={`${s.id} ${s.amount}`} />)}</div>
              </div>
            );
          })}
        </div>

        {featured && (
          <div className="feature">
            <button className="carouselArrow" disabled={living.length < 2} onClick={() => cycleTarget(-1)} aria-label="Previous target">‹</button>
            <FoeCard e={featured} matchup={featured.id === targetId ? matchup : null} />
            <button className="carouselArrow" disabled={living.length < 2} onClick={() => cycleTarget(1)} aria-label="Next target">›</button>
          </div>
        )}
      </div>

      {/* combat log */}
      {logLines.length > 0 && <div className="log">{logLines}</div>}

      {/* active ally */}
      <div className="allyZone">
        {activeMon && <AllyCard m={activeMon} block={snap.block} statuses={snap.statuses} />}
      </div>

      {/* dock: energy · bench (switch) · end turn */}
      <div className="dock">
        <div className="orb"><b>{snap.energy}</b><small>/{snap.energyPerTurn}</small><small>ENERGY</small></div>
        <div className="bench">
          {snap.party.map((m) => {
            const dead = m.hp <= 0;
            const active = m.id === snap.activeId;
            return (
              <div key={m.id} className={`benchMon${active ? ' active' : ''}${dead ? ' dead' : ''}`}
                title={`${m.name} ${m.hp}/${m.maxHp}`}
                onClick={() => !active && !dead && isPlayerTurn && switchActive(m.id)}>
                <span className="em">{dead ? '💀' : (m.sprite || '✶')}</span>
                <span>{m.hp}/{m.maxHp}</span>
              </div>
            );
          })}
        </div>
        <button className="endBtn" disabled={!isPlayerTurn} onClick={endTurn}>
          END TURN <Icon icon="game-icons:fast-forward-button" />
        </button>
      </div>

      {/* fanned hand */}
      <div className="handWrap">
        <div className="hand">
          {snap.hand.map((c, i) => {
            const unplayable = !isPlayerTurn || c.cost === -2 || (c.cost !== -1 && c.cost > snap.energy);
            const n = snap.hand.length;
            const rot = (i - (n - 1) / 2) * 7;          // gentle fan
            const lift = Math.abs(i - (n - 1) / 2) * 5;  // outer cards sit lower
            const f = frameStyle({ element: c.element, rarity: c.rarity });
            return (
              <div key={`${c.id}-${i}`} className={`frame move ${f.finish}${unplayable ? ' unplayable' : ''}`}
                style={{ background: f.background, transform: `translateY(${lift}px) rotate(${rot}deg)` }}
                onClick={() => !unplayable && playCard(c.id, targetId)}>
                {f.holo && <div className="holo" />}
                <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
                <div className="inner">
                  <div className={`micon ${cardKind(c)}`}><Icon icon={cardIcon(c)} /></div>
                  <div className="mn">{c.name}</div>
                  <div className="mt">{c.text ?? describe(c)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="playHint">
        {isPlayerTurn ? <><Icon icon="game-icons:click" /> TAP A CARD TO PLAY · TAP A FOE TO TARGET</> : 'ENEMY TURN…'}
      </div>

      {/* victory / defeat / reward */}
      {over && (
        <div className="overlay">
          <div className="panel">
            <h1 className={snap.phase === 'defeat' ? 'lose' : ''}>{snap.phase === 'victory' ? 'VICTORY' : 'DEFEAT'}</h1>
            {snap.phase === 'victory' && !reward && (
              <button className="endBtn" style={{ margin: '0 auto' }} onClick={() => rollReward(3)}>OPEN REWARD</button>
            )}
            {reward && (
              <div className="rewardRow">
                {reward.map((c, i) => {
                  const f = frameStyle({ element: c.element, rarity: c.rarity });
                  return (
                  <div key={i} className={`frame move ${f.finish}`} style={{ background: f.background }}>
                    {f.holo && <div className="holo" />}
                    <div className="cost">{c.cost === -1 ? 'X' : c.cost === -2 ? '—' : c.cost}</div>
                    <div className="inner">
                      <div className={`micon ${cardKind(c)}`}><Icon icon={cardIcon(c)} /></div>
                      <div className="mn">{c.name}</div>
                      <div className="mt">{c.rarity} · {c.element || 'colorless'}</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            <div><button className="endBtn" style={{ margin: '14px auto 0' }} onClick={() => startCombat()}>NEW FIGHT</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

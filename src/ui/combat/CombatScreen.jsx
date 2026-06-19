// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/CombatScreen — the playable combat view of the    ║
// ║ Vanguard/Peek engine, wearing the "TCG" skin (combat.css).          ║
// ║ LANDSCAPE, no-scroll: a 3-column arena —                            ║
// ║   left  = FOES (mini-fighters, status visible, tap to target)       ║
// ║   center= enemy-plan/Peek bar · featured FOE + active YOU cards ·    ║
// ║           fanned hand                                                ║
// ║   right = YOUR TEAM (mini-fighters, tap to swap) · log · dock        ║
// ║ Reads ONLY the engine snapshot from combatStore.                    ║
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

// silhouette/intent kind → icon
const INTENT_ICON = {
  attack: 'game-icons:crossed-swords',
  block: 'game-icons:checked-shield',
  buff: 'game-icons:upgrade',
  debuff: 'game-icons:broken-shield',
  swap: 'game-icons:cycle',
  unknown: 'game-icons:help',
};

const STATUS_META = {
  strength: { cls: 'str', icon: 'game-icons:biceps' },
  weak: { cls: 'weak', icon: 'game-icons:broken-shield' },
  vulnerable: { cls: 'vuln', icon: 'game-icons:cracked-shield' },
  frail: { cls: 'frail', icon: 'game-icons:shield-bash' },
  burn: { cls: 'burn', icon: 'game-icons:flame' },
  poison: { cls: 'pois', icon: 'game-icons:poison-bottle' },
  regen: { cls: 'rgn', icon: 'game-icons:health-normal' },
  chill: { cls: 'weak', icon: 'game-icons:snowflake-1' },
  soak: { cls: '', icon: 'game-icons:water-drop' },
  shock: { cls: 'str', icon: 'game-icons:lightning-arc' },
  decay: { cls: 'pois', icon: 'game-icons:skull-crossed-bones' },
};

function Icon({ icon, ...rest }) {
  return <iconify-icon icon={icon} {...rest}></iconify-icon>;
}

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

/** Full status chips (used on the big featured cards). */
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

/** Compact block + status pips for the mini-fighter lists. */
function MiniStatus({ block, statuses }) {
  const has = block > 0 || statuses?.length;
  if (!has) return <div className="mfStats empty" />;
  return (
    <div className="mfStats">
      {block > 0 && (
        <span className="pip blk" title={`Block ${block}`}>
          <Icon icon="game-icons:checked-shield" /> {block}
        </span>
      )}
      {(statuses ?? []).map((s) => {
        const m = STATUS_META[s.id] || { cls: '', icon: 'game-icons:hazard-sign' };
        return (
          <span key={s.id} className={`pip ${m.cls}`} title={`${s.id} ${s.amount}`}>
            <Icon icon={m.icon} /> {s.amount}
          </span>
        );
      })}
    </div>
  );
}

/** Derive a view label/icon from a PlannedAction (or null). */
function planActionView(action) {
  if (!action) return { icon: 'game-icons:help', text: '?' };
  const icon = INTENT_ICON[action.silhouette] ?? 'game-icons:help';
  if (!action.revealed) return { icon, text: '?' };
  const d = action.detail ?? {};
  switch (action.silhouette) {
    case 'attack': return { icon, text: `${d.value ?? '?'}${d.hits > 1 ? `×${d.hits}` : ''}` };
    case 'block': return { icon, text: `${d.value ?? '?'}` };
    case 'buff': return { icon, text: `+${d.value ?? '?'}` };
    case 'debuff': return { icon, text: 'Weak' };
    case 'swap': return { icon, text: 'SWAP' };
    default: return { icon, text: '?' };
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

// ── mini-fighter (side columns) ─────────────────────────────────────────────────

function MiniFighter({ f, side, selected, vanguard, swapCost, swappable, onClick }) {
  const dead = f.hp <= 0;
  const pct = Math.max(0, (f.hp / f.maxHp) * 100);
  return (
    <div
      className={`mf ${side}${selected ? ' sel' : ''}${vanguard ? ' vanguard' : ''}${dead ? ' dead' : ''}${swappable ? ' swappable' : ''}`}
      onClick={onClick}
      title={f.name}
    >
      <div className="mfTop">
        <span className="mfName">
          {vanguard && <Icon icon="game-icons:star-formation" className="vgIcon" />}
          {f.name}
        </span>
        {f.element && <Icon className="mfEl" icon={ELEMENT_ICON[f.element]} style={{ color: ELEMENT_COLOR[f.element] }} />}
      </div>
      <div className="mfHp">
        <i className={pct <= 35 ? 'low' : ''} style={{ width: `${pct}%` }} />
        <em>{f.hp}/{f.maxHp}</em>
      </div>
      <MiniStatus block={f.block} statuses={f.statuses} />
      {swappable && <span className="mfSwap"><Icon icon="game-icons:cycle" /> {swapCost}</span>}
    </div>
  );
}

// ── big combatant cards (center) ────────────────────────────────────────────────

function AllyCard({ m }) {
  const f = frameStyle({ types: m.types, element: m.element, rarity: m.rarity });
  return (
    <div className={`frame combat ${f.finish}`} style={{ background: f.background }}>
      {f.holo && <div className="holo" />}
      <SizeBadge form={m.form} />
      {elementBadge(m.element)}
      <span className="sideTag you">YOU</span>
      {m.block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {m.block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          <span className="creature" style={{ transform: `scale(${artScale(m.form)})` }}>{m.sprite || '✶'}</span>
        </div>
        <div className="nameBan">{m.name}{m.hp <= 0 ? ' 💀' : ''}</div>
        <HpBar hp={m.hp} maxHp={m.maxHp} />
        <div className="stats"><StatChips statuses={m.statuses} /></div>
      </div>
    </div>
  );
}

function FoeCard({ e, matchup, planActions }) {
  const iv = planActionView(planActions?.[0] ?? null);
  const f = frameStyle({ element: e.element, rarity: e.rarity });
  const scale = { transform: `scale(${artScale(e.form)})` };
  return (
    <div className={`frame combat ${f.finish}`} style={{ background: f.background }}>
      {f.holo && <div className="holo" />}
      <SizeBadge form={e.form} />
      {elementBadge(e.element)}
      <span className="sideTag foe">FOE</span>
      {e.hp > 0 && planActions?.length > 0 && (
        <span className="intent"><Icon icon={iv.icon} /> {iv.text}</span>
      )}
      {e.block > 0 && <span className="blockBadge"><Icon icon="game-icons:checked-shield" /> {e.block}</span>}
      <div className="inner">
        <div className="art">
          <div className="moon" /><div className="mtn" />
          {e.icon ? <Icon className="creature" icon={e.icon} style={scale} /> : <span className="creature" style={scale}>👾</span>}
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
      return <span className="rx">{nameOf(p.fighterId)} falls.</span>;
    case 'swap':
      return p.forced
        ? <span className="rx">{p.side === 'player' ? 'Your' : 'Enemy'} vanguard falls!</span>
        : <span>{p.side === 'player' ? 'You swap' : 'Enemy swaps'} (cost {p.cost}).</span>;
    case 'peek':
      return <span className="pk">Enemy plan revealed.</span>;
    default:
      return null;
  }
}

// ── screen ────────────────────────────────────────────────────────────────────

export default function CombatScreen() {
  const { snap, log, startCombat, play, swap, peekAll, endTurn, reward, rollReward } = useCombat();
  const [target, setTarget] = useState(null);

  useEffect(() => { if (!snap) startCombat(); }, [snap, startCombat]);
  if (!snap) return <div className="cmbt">Loading…</div>;

  const { player, enemy, enemyPlan, peekCharges } = snap;
  const activeMon = player.fighters[player.vanguardIndex];
  const activeEnemy = enemy.fighters[enemy.vanguardIndex];
  const allEnemies = enemy.fighters;

  const living = allEnemies.filter((e) => e.hp > 0);
  const targetId = (target && living.some((e) => e.id === target))
    ? target
    : (activeEnemy?.hp > 0 ? activeEnemy.id : living[0]?.id);
  const featured = allEnemies.find((e) => e.id === targetId) || activeEnemy;

  const isPlayerTurn = snap.phase === 'player';
  const over = snap.phase === 'victory' || snap.phase === 'defeat';

  const featuredPlan = featured ? enemyPlan.filter((a) => a.actor === featured.id) : [];

  let matchup = null;
  if (activeMon?.element && featured?.element) {
    const mult = elementMultiplier(activeMon.element, featured.element);
    if (mult > 1) matchup = { good: true, label: 'SUPER EFFECTIVE' };
    else if (mult < 1) matchup = { good: false, label: 'RESISTED' };
  }

  const allFighters = [...player.fighters, ...enemy.fighters];
  const nameOf = (id) => allFighters.find((f) => f.id === id)?.name ?? 'Someone';

  const logLines = (log ?? []).slice(-12).map((ev, i) => {
    const node = formatEvent(ev, nameOf);
    return node ? <div key={i}>{node}</div> : null;
  }).filter(Boolean).slice(-5);

  const hand = activeMon?.hand ?? [];
  const allRevealed = enemyPlan.length > 0 && enemyPlan.every((a) => a.revealed);
  const canPeek = isPlayerTurn && peekCharges > 0 && enemyPlan.length > 0 && !allRevealed;

  return (
    <div className="cmbt land">
      {/* topbar */}
      <div className="topbar">
        <span className="pill"><Icon icon="game-icons:dungeon-gate" /> The Proving Pit</span>
        <span className="pill">{over ? (snap.phase === 'victory' ? 'Victory' : 'Defeat') : isPlayerTurn ? 'Your turn' : 'Enemy turn'}</span>
        <span className="pill">Turn {snap.turn}</span>
      </div>

      <div className="arena">
        {/* LEFT: foes */}
        <div className="sideCol foesCol">
          <div className="colHead"><Icon icon="game-icons:daemon-skull" /> Foes</div>
          <div className="miniList">
            {allEnemies.map((e) => (
              <MiniFighter
                key={e.id}
                f={e}
                side="foe"
                selected={e.id === targetId && e.hp > 0}
                vanguard={e.id === activeEnemy?.id}
                onClick={() => e.hp > 0 && setTarget(e.id)}
              />
            ))}
          </div>
        </div>

        {/* CENTER: plan/peek · cards · hand */}
        <div className="centerCol">
          {/* enemy plan + single whole-turn Peek */}
          <div className="peekBar">
            <span className="peekLabel"><Icon icon="game-icons:eye-target" /> Enemy plan</span>
            <div className="planSlots">
              {enemyPlan.length === 0 && <span className="planEmpty">—</span>}
              {enemyPlan.map((action, i) => {
                const iv = planActionView(action);
                return (
                  <span key={i} className={`planSlot${action.revealed ? ' revealed' : ''}`}
                    title={action.revealed ? `${action.silhouette}` : 'hidden'}>
                    <Icon icon={iv.icon} />
                    <small>{action.revealed ? iv.text : '???'}</small>
                  </span>
                );
              })}
            </div>
            <button className="peekBtn" disabled={!canPeek} onClick={peekAll}
              title="Spend 1 Peek charge to reveal the enemy's entire turn">
              <Icon icon="game-icons:magnifying-glass" /> PEEK
              <span className="peekCount">{peekCharges}</span>
            </button>
          </div>

          {/* the two featured cards */}
          <div className="cardsRow">
            {featured && (
              <FoeCard e={featured} matchup={featured.id === targetId ? matchup : null} planActions={featuredPlan} />
            )}
            <div className="vsMark">VS</div>
            {activeMon && <AllyCard m={activeMon} />}
          </div>

          {/* fanned hand */}
          <div className="handWrap">
            <div className="hand">
              {hand.map((c, i) => {
                const unplayable = !isPlayerTurn || c.cost === -2 || (c.cost !== -1 && c.cost > player.energy);
                const n = hand.length;
                const rot = (i - (n - 1) / 2) * 6;
                const lift = Math.abs(i - (n - 1) / 2) * 4;
                const f = frameStyle({ element: c.element, rarity: c.rarity });
                return (
                  <div key={`${c.id}-${i}`}
                    className={`frame move ${f.finish}${unplayable ? ' unplayable' : ''}`}
                    style={{ background: f.background, transform: `translateY(${lift}px) rotate(${rot}deg)` }}
                    onClick={() => !unplayable && play(c.id, targetId ? { targetId } : {})}>
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
        </div>

        {/* RIGHT: team · log · dock */}
        <div className="sideCol teamCol">
          <div className="colHead"><Icon icon="game-icons:rosa-shield" /> Your Team</div>
          <div className="miniList">
            {player.fighters.map((m, idx) => {
              const active = idx === player.vanguardIndex;
              const swapCost = player.manualSwapsThisTurn + 1;
              const swappable = !active && m.hp > 0 && isPlayerTurn && player.energy >= swapCost;
              return (
                <MiniFighter
                  key={m.id}
                  f={m}
                  side="ally"
                  vanguard={active}
                  swapCost={swapCost}
                  swappable={swappable}
                  onClick={() => swappable && swap(idx)}
                />
              );
            })}
          </div>

          <div className="log">{logLines.length ? logLines : <div className="logEmpty">…</div>}</div>

          <div className="dock">
            <div className="orb">
              <b>{player.energy}</b>
              <small>/{player.energyPerTurn}</small>
              <small>ENERGY</small>
            </div>
            <button className="endBtn" disabled={!isPlayerTurn} onClick={endTurn}>
              END TURN <Icon icon="game-icons:fast-forward-button" />
            </button>
          </div>
        </div>
      </div>

      {/* victory / defeat */}
      {over && (
        <div className="overlay">
          <div className="panel">
            <h1 className={snap.phase === 'defeat' ? 'lose' : ''}>
              {snap.phase === 'victory' ? 'VICTORY' : 'DEFEAT'}
            </h1>
            {snap.phase === 'victory' && !reward && (
              <button className="endBtn" style={{ margin: '0 auto' }} onClick={() => rollReward(3)}>
                <Icon icon="game-icons:open-treasure-chest" /> OPEN REWARD
              </button>
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
                        <div className="mt">{c.text ?? describe(c)}</div>
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

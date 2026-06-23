// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/run/RunScreen — the run/meta view: act map, party/gold/    ║
// ║ relics/potions bar, non-combat rooms (rest/treasure/shop/event),       ║
// ║ card-reward picker, and win/lose. Combat is the embedded CombatScreen; ║
// ║ this host owns the post-fight flow. Reads runStore + combatStore.      ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useState } from 'react';
import { useRun } from '../../store/runStore.js';
import { useCombat } from '../../store/combatStore.js';
import CombatScreen from '../combat/CombatScreen.jsx';
import { currentNode } from '../../engine/run/map.js';
import { makeRng } from '../../engine/run/rng.js';
import { RELICS, POTIONS, EVENTS } from '../../engine/run/content.js';
import { draftRunReward } from '../../engine/run/rewards.js';
import { creatureIcon, creatureColor } from '../../data/axisIcons.js';
import { cardText } from '../../engine/cards/cardText.js';
import './run.css';

// Gold price of a shop card by rarity (REVIEW/tunable).
const CARD_PRICE = { common: 40, uncommon: 65, rare: 90, epic: 130, mythic: 180, legendary: 240, godly: 300 };
const priceOf = (c) => CARD_PRICE[c.rarity] || 50;

/** Pick which party creature receives a bought/chosen card (≥2 living members). */
function MemberPicker({ snap, target, setTarget }) {
  const living = snap.party.filter((m) => m.hp > 0);
  if (living.length <= 1) return null;
  return (
    <div className="memberPick">Give to:
      {living.map((m) => (
        <button key={m.id} className={`mpBtn${target === m.id ? ' on' : ''}`} onClick={() => setTarget(m.id)}>{m.name}</button>
      ))}
    </div>
  );
}

const Icon = ({ icon, ...rest }) => <iconify-icon icon={icon} {...rest}></iconify-icon>;

const NODE_ICON = {
  start: 'game-icons:dungeon-gate', combat: 'game-icons:crossed-swords', elite: 'game-icons:daemon-skull',
  boss: 'game-icons:dragon-head', rest: 'game-icons:campfire', shop: 'game-icons:swap-bag',
  treasure: 'game-icons:open-treasure-chest', event: 'game-icons:perspective-dice-six-faces-random',
};
const roomRng = (s) => makeRng((s.rngState ^ (s.floor * 0x9e3779b1)) >>> 0);

/** A small creature crest (AI portrait if present, else the tinted axis icon). */
function Crest({ m }) {
  const color = creatureColor(m);
  return (
    <span className="pCrest" style={{ '--gl': color }}>
      {m.meta?.portrait
        ? <img src={m.meta.portrait} alt="" />
        : <Icon className="pCrestIcon" icon={creatureIcon(m)} style={{ color }} />}
    </span>
  );
}

function PartyBar({ snap }) {
  return (
    <div className="runBar">
      {snap.party.map((m) => (
        <div key={m.id} className={`pStat ${m.hp <= 0 ? 'dead' : ''}`}>
          <Crest m={m} />
          <div className="pInfo">
            <b>{m.name}</b>
            <div className="pHp"><i style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%` }} /><em>{m.hp}/{m.maxHp}</em></div>
          </div>
        </div>
      ))}
      <span className="runGold"><Icon icon="game-icons:two-coins" /> {snap.gold}</span>
      <span className="runRelics">{snap.relics.map((r) => <Icon key={r.id} icon="game-icons:gem-pendant" title={r.text} />)}</span>
      <span className="runPotions">{snap.potions.map((p, i) => <Icon key={i} icon="game-icons:round-potion" title={p.text} />)}</span>
    </div>
  );
}

function CardChip({ c, onClick, disabled, price }) {
  return (
    <button className={`cardChip r-${c.rarity || 'common'}`} onClick={onClick} disabled={disabled}>
      <div className="ccTop"><span className="ccCost">{c.cost === -1 ? 'X' : c.cost}</span><b>{c.name}</b>
        {price != null && <span className="ccPrice">{price}g</span>}</div>
      <div className="ccText">{cardText(c)}</div>
      <div className="ccRarity">{c.rarity || 'common'}{c.attunement ? ` · ${c.attunement}` : ''}</div>
    </button>
  );
}

export default function RunScreen({ onMenu, onNewRun }) {
  const run = useRun();
  const combat = useCombat();
  const snap = run.snap;
  const [target, setTarget] = useState(null);
  if (!snap) return <div className="runWrap"><p>No active run.</p></div>;
  // Which creature receives a chosen/bought card (default: first living member).
  const tgt = target || snap.party.find((m) => m.hp > 0)?.id || snap.party[0]?.id;

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
        <h2><Icon icon="game-icons:card-pickup" /> Choose a card</h2>
        <MemberPicker snap={snap} target={tgt} setTarget={setTarget} />
        <div className="rewardCards">
          {(snap.pendingReward || []).map((c, i) => <CardChip key={i} c={c} onClick={() => run.chooseReward(c, tgt)} />)}
        </div>
        <button className="runBtn" onClick={() => run.skipReward()}>Skip</button>
      </div>
    );
  }

  // ── NON-COMBAT ROOM ──
  if (run.view === 'room' && node) {
    return <Room run={run} snap={snap} node={node} target={tgt} setTarget={setTarget} />;
  }

  // ── OVER ──
  if (run.view === 'over') {
    const won = snap.status === 'won';
    return (
      <div className="runWrap over">
        <h1 className={won ? '' : 'lose'}>{won ? 'RUN COMPLETE' : 'YOU DIED'}</h1>
        <p>{won ? 'You cleared the act.' : 'Your party fell.'}</p>
        <div className="runActions">
          {onNewRun && <button className="runBtn" onClick={() => { run.clearSave?.(); onNewRun(); }}>New Run</button>}
          <button className="runBtn ghost" onClick={onMenu}>Main Menu</button>
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
              <span className="nIcon"><Icon icon={NODE_ICON[n.type] || 'game-icons:flat-platform'} /></span>
              <span className="nType">{n.type}</span>
              {n.visited && <Icon className="nState done" icon="game-icons:check-mark" />}
              {isCurrent && !n.visited && <span className="nState here">You are here</span>}
              {isNext && <span className="nGo"><Icon icon="game-icons:plain-arrow" /></span>}
            </div>
          );
        })}
      </div>
      <p className="runHint">Choose your next path to descend.</p>
    </div>
  );
}

// ── Non-combat room views ─────────────────────────────────────────────────────
function Room({ run, snap, node, target, setTarget }) {
  if (node.type === 'rest') {
    const member = snap.party[0];
    const upgradable = (member?.deck || []).filter((c) => !c.upgraded);
    return (
      <div className="runWrap">
        <h2><Icon icon="game-icons:campfire" /> Campfire</h2>
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
        <h2><Icon icon="game-icons:open-treasure-chest" /> Treasure</h2>
        {relic ? (
          <div className="roomCol">
            <div className="relicCard"><b><Icon icon="game-icons:gem-pendant" /> {relic.name}</b><p>{relic.text}</p></div>
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
    // Card stock drafted from the PARTY's own pool (same source as rewards).
    const shopRng = roomRng(snap);
    const cardStock = draftRunReward(snap.rewardPool || [], 4, () => shopRng.next());
    const tgt = target || snap.party.find((m) => m.hp > 0)?.id || snap.party[0]?.id;
    return (
      <div className="runWrap">
        <h2><Icon icon="game-icons:swap-bag" /> Shop <span className="runGold"><Icon icon="game-icons:two-coins" /> {snap.gold}</span></h2>
        {cardStock.length > 0 && <>
          <MemberPicker snap={snap} target={tgt} setTarget={setTarget} />
          <div className="rewardCards">
            {cardStock.map((c, i) => (
              <CardChip key={i} c={c} price={priceOf(c)} disabled={snap.gold < priceOf(c)}
                onClick={() => run.dispatch('buyCard', { memberId: tgt, card: c, cost: priceOf(c) })} />
            ))}
          </div>
        </>}
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
        <h2><Icon icon="game-icons:suspicious" /> {ev.name}</h2>
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

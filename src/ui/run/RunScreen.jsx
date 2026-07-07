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
import MoveCard from '../combat/MoveCard.jsx';
import { currentNode } from '../../engine/run/map.js';
import { makeRng } from '../../engine/run/rng.js';
import { RELICS, POTIONS, EVENTS, CURSES } from '../../engine/run/content.js';
import { draftRunReward } from '../../engine/run/rewards.js';
import { creatureIcon, creatureColor } from '../../data/axisIcons.js';
import { sizedPortrait } from '../../data/sizeArt.js';
import { evolve, sizeLabel } from '../../engine/content/evolve.js';
import { upgradedPreview } from '../../engine/cards/upgrade.js';
import TeamManager from '../TeamManager.jsx';
import './run.css';

// Gold price of a shop card by rarity (REVIEW/tunable).
const CARD_PRICE = { common: 40, uncommon: 65, rare: 90, epic: 130, mythic: 180, legendary: 240, godly: 300 };
const priceOf = (c) => CARD_PRICE[c.rarity] || 50;

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
        ? <img src={sizedPortrait(m.meta.portrait, m.meta?.form ?? m.form ?? m.size)} alt="" />
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

export default function RunScreen({ onMenu, onNewRun, onCodex }) {
  const run = useRun();
  const combat = useCombat();
  const snap = run.snap;
  const [target, setTarget] = useState(null);
  const [sel, setSel] = useState(null); // selected reward { memberId, idx, card }
  const [teamMgrOpen, setTeamMgrOpen] = useState(false);
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
        <CombatScreen embedded onMenu={onMenu} onCodex={onCodex} />
        {over && (
          <div className="overlay"><div className="panel">
            <h1 className={won ? '' : 'lose'}>{won ? 'VICTORY' : 'DEFEAT'}</h1>
            <button className="endBtn" onClick={() => run.resolveCombat()}>Continue →</button>
          </div></div>
        )}
      </div>
    );
  }

  // ── REWARD ── per-member offer groups: each character has its OWN card options;
  // pick exactly one (it goes to that character). Falls back to a flat list for
  // legacy/loaded saves that stored an un-grouped pendingReward.
  if (run.view === 'reward') {
    const pending = snap.pendingReward || [];
    const grouped = pending.length > 0 && pending[0] && Array.isArray(pending[0].cards);
    const loot = snap.pendingLoot;
    const accept = () => { if (sel) { run.chooseReward(sel.card, sel.memberId); setSel(null); } };
    const skip = () => { run.skipReward(); setSel(null); };
    return (
      <div className="runWrap rewardWrap">
        <h2><Icon icon="game-icons:card-pickup" /> Choose ONE card</h2>
        <p className="rewardHint">Each character has its own options — tap a card to select, then confirm.</p>
        {loot && (loot.relic || loot.potion) && (
          <div className="lootBanner">
            <span className="lootLabel"><Icon icon="game-icons:open-treasure-chest" /> Also found:</span>
            {loot.relic && <span className="lootItem"><Icon icon="game-icons:gem-pendant" /> {loot.relic.name}</span>}
            {loot.potion && <span className="lootItem"><Icon icon="game-icons:round-potion" /> {loot.potion.name}</span>}
          </div>
        )}
        {grouped ? (
          <div className="rewardGroups">
            {pending.map((g) => {
              const m = snap.party.find((p) => p.id === g.memberId);
              return (
                <div className="rewardGroup" key={g.memberId}>
                  <div className="rgHead">{m && <Crest m={m} />}<b>{g.name}</b></div>
                  <div className="rewardCards">
                    {g.cards.map((c, i) => (
                      <MoveCard key={i} c={c}
                        selected={sel?.memberId === g.memberId && sel?.idx === i}
                        onClick={() => setSel({ memberId: g.memberId, idx: i, card: c })} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rewardCards">
            {pending.map((c, i) => (
              <MoveCard key={i} c={c} selected={sel?.idx === i}
                onClick={() => setSel({ memberId: tgt, idx: i, card: c })} />
            ))}
          </div>
        )}
        <div className="rewardActions">
          <button className="runBtn" disabled={!sel} onClick={accept}>
            {sel ? `Add ${sel.card.name} to ${snap.party.find((p) => p.id === sel.memberId)?.name || 'deck'}` : 'Select a card'}
          </button>
          <button className="runBtn ghost" onClick={skip}>Skip</button>
        </div>
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
      <div style={{ textAlign: 'center', margin: '4px 0 10px' }}>
        <button className="runBtn small" onClick={() => setTeamMgrOpen(true)}>
          <Icon icon="game-icons:rank-3" /> Manage Team
        </button>
      </div>
      {teamMgrOpen && (
        <div className="runOverlay" onClick={() => setTeamMgrOpen(false)}>
          <div className="runTeamMgr" onClick={(e) => e.stopPropagation()}>
            <button className="runModalClose" onClick={() => setTeamMgrOpen(false)}>✕</button>
            <TeamManager members={snap.party} title="Team — set positions"
              onReorder={(order) => run.dispatch('reorderParty', { order })} />
          </div>
        </div>
      )}
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
// Resolve one event action descriptor into concrete RunManager dispatch(es). The
// three "meta" actions need run context/RNG (a random item or curse), so they're
// expanded here rather than stored statically. Returns the result text override (if any).
function applyEventAction(a, { run, snap, rng }) {
  const owned = new Set(snap.relics.map((r) => r.id));
  if (a.type === 'grantRandomRelic') {
    const pool = RELICS.filter((r) => !owned.has(r.id));
    const relic = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
    if (relic) run.dispatch('addRelic', { relic });
    return relic ? null : 'But there was nothing of worth left to find.';
  }
  if (a.type === 'grantRandomPotion') {
    const potion = POTIONS[Math.floor(rng() * POTIONS.length)];
    if (potion) run.dispatch('addPotion', { potion });
    return null;
  }
  if (a.type === 'addCurse') {
    const curse = CURSES[Math.floor(rng() * CURSES.length)];
    const living = snap.party.filter((m) => m.hp > 0);
    const m = living[Math.floor(rng() * living.length)];
    if (curse && m) run.dispatch('addCardToDeck', { memberId: m.id, card: { ...curse, id: `${curse.id}#${snap.floor}` } });
    return null;
  }
  run.dispatch(a.type, a);
  return null;
}

function EventRoom({ run, snap }) {
  const [resolved, setResolved] = useState(null); // { name, result }
  const ev = roomRng(snap).pick(EVENTS);

  function pick(choice, idx) {
    // A fresh RNG seeded by floor + choice index so gambles vary but stay deterministic.
    const rng = makeRng((snap.rngState ^ (snap.floor * 0x9e3779b1) ^ ((idx + 1) * 0x85ebca6b)) >>> 0);
    if (choice.cost?.gold) run.dispatch('spendGold', { amount: choice.cost.gold });
    // Pick the outcome: a weighted gamble, or the choice's direct actions/result.
    let result = choice.result || 'Done.';
    let actions = choice.actions || [];
    if (choice.outcomes?.length) {
      const total = choice.outcomes.reduce((n, o) => n + (o.weight || 1), 0);
      let roll = rng() * total;
      const out = choice.outcomes.find((o) => (roll -= (o.weight || 1)) < 0) || choice.outcomes[0];
      result = out.result; actions = out.actions || [];
    }
    for (const a of actions) { const override = applyEventAction(a, { run, snap, rng }); if (override) result = override; }
    setResolved({ name: ev.name, result });
  }

  if (resolved) {
    return (
      <div className="runWrap">
        <h2><Icon icon={ev.icon || 'game-icons:suspicious'} /> {resolved.name}</h2>
        <p className="eventText eventResult">{resolved.result}</p>
        <button className="runBtn" onClick={() => run.finishRoom()}>Continue</button>
      </div>
    );
  }
  return (
    <div className="runWrap">
      <h2><Icon icon={ev.icon || 'game-icons:suspicious'} /> {ev.name}</h2>
      <p className="eventText">{ev.text}</p>
      <div className="roomCol">
        {ev.choices.map((ch, i) => {
          const locked = ch.require?.gold != null && snap.gold < ch.require.gold;
          return (
            <button key={i} className="runBtn eventChoice" disabled={locked} onClick={() => pick(ch, i)}>
              <span>{ch.text}</span>
              {ch.hint && <small className="evHint">{locked ? `Requires ${ch.require.gold} gold` : ch.hint}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Room({ run, snap, node, target, setTarget }) {
  // Tracks shop cards already bought this visit (Room remounts per room → resets).
  const [bought, setBought] = useState(() => new Set());
  // Campfire: which party member's deck we're browsing + the card picked to upgrade.
  const living = snap.party.filter((m) => m.hp > 0);
  const [restMemberId, setRestMemberId] = useState(() => (living[0] || snap.party[0])?.id);
  const [restSel, setRestSel] = useState(null);

  if (node.type === 'rest') {
    const member = snap.party.find((m) => m.id === restMemberId) || snap.party[0];
    const deck = member?.deck || [];
    const selCard = deck.find((c) => c.id === restSel) || null;
    const upgradePreview = selCard ? upgradedPreview(selCard) : null;
    return (
      <div className="runWrap">
        <h2><Icon icon="game-icons:campfire" /> Campfire</h2>
        <PartyBar snap={snap} />
        <div className="roomCol restCol">
          <button className="runBtn" onClick={() => { run.dispatch('healParty', { pct: 0.3 }); run.finishRoom(); }}>Rest — heal 30% HP</button>

          <p className="restHint">…or evolve a creature — it grows one size (more HP &amp; Might):</p>
          <div className="evolveRow">
            {living.map((m) => {
              const ev = evolve(m);
              return (
                <div key={m.id} className="evolveCard">
                  <Crest m={m} /> <b>{m.name}</b>
                  <span className="evolveSize">{sizeLabel(m.size)}</span>
                  {ev
                    ? <button className="runBtn small" onClick={() => { run.dispatch('evolveMember', { memberId: m.id }); run.finishRoom(); }}>
                        Evolve → {sizeLabel(ev.to)} (+{ev.hpGain} HP{ev.mightDelta ? `, +${ev.mightDelta} Might` : ''})
                      </button>
                    : <span className="evolveMax">Max size</span>}
                </div>
              );
            })}
          </div>

          <p className="restHint">…or upgrade a card — pick a character, review their deck, choose a card:</p>

          <div className="memberTabs">
            {snap.party.map((m) => (
              <button key={m.id} className={`memberTab${m.id === member?.id ? ' on' : ''}${m.hp <= 0 ? ' dead' : ''}`}
                onClick={() => { setRestMemberId(m.id); setRestSel(null); }}>
                <Crest m={m} /> <b>{m.name}</b>
              </button>
            ))}
          </div>

          <div className="restDeck">
            {deck.map((c, i) => (
              <MoveCard key={`${c.id}-${i}`} c={c} selected={c.id === restSel} disabled={c.upgraded}
                onClick={() => { if (!c.upgraded) setRestSel(c.id); }} />
            ))}
            {deck.length === 0 && <p className="runHint">No cards in this deck.</p>}
          </div>

          {selCard && (
            <div className="restConfirm">
              {upgradePreview && (
                <div className="upgPreview">
                  <MoveCard c={selCard} />
                  <Icon className="upgArrow" icon="game-icons:upgrade" />
                  <MoveCard c={upgradePreview} />
                </div>
              )}
              <button className="runBtn" disabled={!upgradePreview}
                onClick={() => { run.dispatch('upgradeCard', { memberId: member.id, cardId: selCard.id }); run.finishRoom(); }}>
                {upgradePreview ? `Upgrade ${selCard.name}` : 'This card has no upgrade'}
              </button>
            </div>
          )}
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
    // Card stock is PER-MEMBER: each living creature has its own 2 cards drafted from
    // its own pool, buyable only for that creature (like the post-combat rewards).
    const shopRng = roomRng(snap);
    const pools = snap.rewardPools || {};
    const living = snap.party.filter((m) => m.hp > 0);
    const memberStock = living.map((m) => {
      const pool = (pools[m.id] && pools[m.id].length) ? pools[m.id] : (snap.rewardPool || []);
      return { member: m, cards: draftRunReward(pool, 2, () => shopRng.next()) };
    });
    const buy = (m, c, sid) => {
      const price = priceOf(c);
      if (snap.gold < price || bought.has(sid)) return;
      run.dispatch('buyCard', { memberId: m.id, card: c, cost: price });
      setBought((b) => new Set(b).add(sid));
    };
    return (
      <div className="runWrap">
        <h2><Icon icon="game-icons:swap-bag" /> Shop <span className="runGold"><Icon icon="game-icons:two-coins" /> {snap.gold}</span></h2>
        {memberStock.some((g) => g.cards.length) && (
          <div className="rewardGroups">
            {memberStock.map(({ member, cards }) => (
              <div className="rewardGroup" key={member.id}>
                <div className="rgHead"><Crest m={member} /><b>{member.name}</b></div>
                <div className="rewardCards">
                  {cards.map((c, i) => {
                    const sid = `${member.id}:${i}:${c.id}`;
                    return <MoveCard key={sid} c={c} price={priceOf(c)}
                      disabled={bought.has(sid) || snap.gold < priceOf(c)}
                      onClick={() => buy(member, c, sid)} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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

  if (node.type === 'event') return <EventRoom run={run} snap={snap} />;

  return <div className="runWrap"><p>Unknown room.</p><button className="runBtn" onClick={() => run.finishRoom()}>Continue</button></div>;
}

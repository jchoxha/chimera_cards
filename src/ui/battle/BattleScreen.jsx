// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/BattleScreen — the COMBAT-V2 shell. The BOARD is a real  ║
// ║ WebGL 3D scene (Board3D / react-three-fiber): creatures are textured card  ║
// ║ MESHES on a receding table, picked by RAYCAST (works on rotated meshes, so ║
// ║ tilted 3D cards stay exactly tappable on touch/mouse — what CSS rotateX    ║
// ║ could not do). This file owns the DOM chrome layered over the canvas: the  ║
// ║ hand/dock, the horizon turn/log bar, squad-nav arrows, and all overlays    ║
// ║ (card detail, pile inspect, combat log, fight confirm). The DOM hand-drag  ║
// ║ finds a 3D drop target via Board3D's raycast picker (pickRef).             ║
// ║ Top = enemy, bottom = friendly. Each creature is a compact BATTLE TOKEN   ║
// ║ (full-bleed art background + name + HP), NOT the full card. Front Vanguard ║
// ║ is CENTERED between its two rear Support. Selecting a squad is required    ║
// ║ before a token click opens the creature's FULL info card (the CardFace,   ║
// ║ enlarged). ACTION CARDS: tap to select, then click a target OR drag onto    ║
// ║ one to queue; double-tap (or tap a selected card) opens the enlarged card.  ║
// ║ Cards show cost·name, a corner attunement badge, art, a "(Scope) (Type)"    ║
// ║ line, and a priority pip; the fanned hand bumps apart on hover. A toggle     ║
// ║ SHOWS/HIDES the dock (hidden → the battlefield scales up). Fight CONFIRMS    ║
// ║ if any squad still has energy. The middle bar shows the TURN number and,    ║
// ║ during resolution, a combat-log ticker — click it for the full log.         ║
// ║ Fight plays the round back (auto-focus on the acting unit + HP tweens +     ║
// ║ floating numbers). Each side's field scrolls with EDGE buttons that focus   ║
// ║ the next squad, wrapping around. The card DOCK spans EVERY squad (yours      ║
// ║ interactive, the enemy's read-only: hand face-DOWN, piles inspectable,      ║
// ║ deck '?' until cards are seen).                                             ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useRef, useState } from 'react';
import { useBattle } from '../../store/battleStore.js';
import Board3D from './Board3D.jsx';
import { CardFace, elementBadge } from '../combat/creatureVisuals.jsx';
import { ATTUNEMENT_COLOR } from '../../data/axisIcons.js';
import { cardArt, creatureArt } from '../../data/artPool.js';
import { sizedPortrait } from '../../data/sizeArt.js';
import '../combat/combat.css';   // CardFace styling for the enlarged info card
import './battle.css';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The type line is "(Target Scope) (Attack/Skill/Power)". The attunement lives in the
// corner badge (same as creature cards), not in this line.
const SCOPE_WORD = { front: 'Vanguard', targeted: 'Targeted', squad: 'Squad', field: 'Field', self: 'Self' };
const scopeOf = (card) => card.scope || (card.reachesBack ? 'targeted' : 'front');
const isOffensiveCard = (card) => (card?.effects || []).some((e) => e.op === 'damage' || e.op === 'debuff');
function typeLine(card) {
  const word = SCOPE_WORD[scopeOf(card)] || 'Vanguard';
  return `${word} ${cap(card.type || 'Card')}`;
}
const SCOPE_ICON = { front: 'game-icons:spearhead', targeted: 'game-icons:convergence-target', squad: 'game-icons:group', field: 'game-icons:wide-arrow-dunk', self: 'game-icons:round-shield' };

/** An Action Card (hand · drag ghost · inspection · enlarged detail). */
function ActionCard({ card, dragSrc, selected, big, onPointerDown, onDoubleClick }) {
  const art = cardArt({ ...card, attunement: card.element });
  const scope = scopeOf(card);
  return (
    <div className={`bCard${dragSrc ? ' dragSrc' : ''}${selected ? ' selected' : ''}${big ? ' big' : ''}`} style={{ '--el': elColor(card.element) }}
      onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
      <div className="bCardHead"><span className="bCardCost">{card.cost}</span><span className="bCardName">{card.name}</span></div>
      {elementBadge(card.element)}
      <div className="bCardArt">
        {art ? <img src={art} alt="" /> : <span className="bCardArtIcon"><Icon icon={SCOPE_ICON[scope] || 'game-icons:crossed-swords'} /></span>}
        {card.priority ? <span className="bCardPrio" title={`Priority ${card.priority}`}><Icon icon="game-icons:sprint" />P{card.priority}</span> : null}
      </div>
      <div className={`bCardType ${scope}`}><Icon icon={SCOPE_ICON[scope] || 'game-icons:crossed-swords'} />{typeLine(card)}</div>
      <div className="bCardText">{card.text}</div>
    </div>
  );
}

export default function BattleScreen() {
  const snap = useBattle((s) => s.snapshot);
  const selectSquad = useBattle((s) => s.selectSquad);
  const queueCard = useBattle((s) => s.queueCard);
  const reorderHand = useBattle((s) => s.reorderHand);
  const undoLast = useBattle((s) => s.undoLast);
  const redoLast = useBattle((s) => s.redoLast);
  const resetPlans = useBattle((s) => s.resetPlans);
  const resolve = useBattle((s) => s.resolve);

  const dropEls = useRef(new Map());   // (reserved for in-scene FX anchoring)
  const pickRef = useRef(null);        // Board3D raycast picker: (clientX,clientY) → unitId | null
  const validRef = useRef(null);       // (cx,cy,wantSide) → is this a valid drop location?
  const camRef = useRef(null);         // Board3D imperative camera controls (yaw/tilt/zoom/reset)
  const drag = useRef(null);
  const liveRef = useRef({});          // bridge for the once-bound window drag handler → current render values
  const [d, setD] = useState(null);          // active hand-card DRAG (only once moved past threshold)
  const [zoom, setZoom] = useState(null);    // { u, side } full creature info card
  const [cardZoom, setCardZoom] = useState(null);    // enlarged Action Card detail
  const [selId2, setSelId2] = useState(null);        // selected hand-card iid (click-to-target)
  const [anim, setAnim] = useState(null);    // resolution playback
  const [displayTurn, setDisplayTurn] = useState(1);   // top-left turn — only advances once a fight resolves
  const [fx, setFx] = useState([]);
  const [fly, setFly] = useState(null);      // a card flying from hand/drop → its scope landing spot
  const flySeq = useRef(0);
  const [playSpeed, setPlaySpeed] = useState(1);     // resolution playback speed (0.5 / 1 / 2)
  const [playPaused, setPlayPaused] = useState(false);
  const speedRef = useRef(1); const pausedRef = useRef(false); const actingRef = useRef(null);
  const autoPauseRef = useRef(false);   // true when a modal auto-paused playback (resume on close)
  speedRef.current = playSpeed; pausedRef.current = playPaused;
  // hierarchical selection: Field › Side › Squad › Unit. A click drills DOWN one level
  // toward what was clicked (you must select a SIDE before a squad, a squad before a
  // unit); clicking empty space steps UP one level. Each level gets its own camera framing.
  const [sel, setSel] = useState({ level: 'field', side: null, squadId: null, unitId: null });
  const [inspect, setInspect] = useState(null);   // pile-inspection overlay { title, cards, note? }
  const [ticker, setTicker] = useState(null);     // latest combat-log line (middle bar)
  const [logOpen, setLogOpen] = useState(false);  // full combat log overlay
  const [confirmFight, setConfirmFight] = useState(false);   // "energy left" confirmation
  const [confirmReset, setConfirmReset] = useState(false);   // "reset all moves?" confirmation
  const [planOpen, setPlanOpen] = useState(false);           // "Plan" popup (queued actions + undo/redo/reset + speed)
  const [camOpen, setCamOpen] = useState(false);             // camera-control pad shown/hidden
  const [autoCam, setAutoCam] = useState(true);              // auto-frame the camera on card interaction
  const [collapsedTurns, setCollapsedTurns] = useState(() => new Set());   // combat-log turn folding
  const [dockHidden, setDockHidden] = useState(false);       // Action Cards shown/hidden
  const fxSeq = useRef(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // battle clock — ticks every second (mirrors the store's log timestamps)
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(id); }, []);

  // Hand card press → TAP (select / detail) vs DRAG-to-play. Listeners are bound ONCE
  // on mount and gate on the drag.current ref — binding lazily on a `pressing` state
  // would miss the pointer-up of a fast tap (the effect re-binds after the up fires).
  useEffect(() => {
    const onMove = (e) => {
      const g = drag.current; if (!g) return;
      g.x = e.clientX; g.y = e.clientY;
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) g.moved = true;
      if (g.moved) {
        const W = window.innerWidth, H = window.innerHeight, m = 70;
        // LIFTED = dragged above the hand zone → the card is being AIMED (camera frames the
        // target field + targets highlight). Below the line = still in the hand (reorder only,
        // camera undisturbed) so you can reorganise without moving the view.
        g.lifted = e.clientY < H * 0.58;
        g.over = g.lifted ? ((pickRef.current && pickRef.current(e.clientX, e.clientY)) || null) : null;
        const L = liveRef.current;
        if (L.updateDragHi) L.updateDragHi(g);   // (clears hi/valid when not lifted)
        // EDGE-PAN: top/left/right pan only while LIFTED; the EXTREME bottom always pans down
        // (past where you'd be reordering the hand).
        if (camRef.current?.setEdge) {
          let r = 0, f = 0;
          if (g.lifted) {
            if (e.clientX < m) r = -(m - e.clientX) / m; else if (e.clientX > W - m) r = (e.clientX - (W - m)) / m;
            if (e.clientY < m) f = (m - e.clientY) / m;
          }
          if (e.clientY > H - m) f = -((e.clientY - (H - m)) / m);   // extreme bottom → pan down
          camRef.current.setEdge(f, r);
        }
        setD({ ...g });
      }
    };
    const onUp = () => {
      const g = drag.current; if (!g) return; drag.current = null; setD(null);
      camRef.current?.resetDragCam();   // undo any drag-time camera movement (back to pickup framing)
      if (g.moved) {
        const L = liveRef.current;
        // 1) dropped over the HAND band → reorganise the hand (or just return the card)
        if (L.handReorder && L.handReorder(g.iid, g.x, g.y)) { setSelId2(null); }
        // 2) else over a VALID + AFFORDABLE target → play it (flies to the target)
        else if (g.valid) {
          const target = (L.resolveDropFromHi && L.resolveDropFromHi(g.hi)) || g.over;
          if (target && (!L.affords || L.affords(g.card))) { queueCard(g.iid, target); setSelId2(null); setFly({ key: (flySeq.current += 1), card: g.card, targetId: target, x: g.x, y: g.y, kind: 'drag' }); }
        }
        // 3) else dropped in empty space → the card simply returns to the hand (no-op)
      }
      else if (g.tapSel) setCardZoom(g.card);   // tap a selected card → detail
      else setSelId2(g.iid);                     // tap → select
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [queueCard]);

  // auto-focus: pan to the acting unit during resolution
  useEffect(() => {
    if (anim?.acting) dropEls.current.get(anim.acting)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [anim?.acting]);

  // the top-left turn counter only advances once a fight FINISHES resolving (the store bumps
  // snap.turn at resolve() time, but the playback runs after — so hold the shown value).
  useEffect(() => { if (!anim && snap?.turn) setDisplayTurn(snap.turn); }, [anim, snap?.turn]);

  // mobile: request FULLSCREEN on the first touch (best-effort — needs a user gesture and
  // is only attempted on coarse-pointer / small screens so desktop is unaffected).
  useEffect(() => {
    const wantsFs = window.matchMedia?.('(pointer: coarse)')?.matches || window.innerWidth < 900;
    if (!wantsFs) return undefined;
    const go = () => {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
      window.removeEventListener('pointerdown', go);
    };
    window.addEventListener('pointerdown', go, { once: true });
    return () => window.removeEventListener('pointerdown', go);
  }, []);

  // planning squad: whichever PLAYER squad the selection has drilled into (store-tracked)
  const selId = snap?.selectedSquadId;
  // keep the store's active planning squad in sync with the selection
  useEffect(() => {
    if (sel.side === 'p' && sel.squadId && sel.squadId !== selId) selectSquad(sel.squadId);
  }, [sel.side, sel.squadId, selId, selectSquad]);

  if (!snap) return <div className="battleScreen empty">Loading…</div>;

  const allSquads = [...snap.enemy, ...snap.player];
  // every squad (your squads first, then the enemy's) — for the hand carousel index
  const dockList = [...snap.player, ...snap.enemy];
  const squadOfUnit = (uid) => allSquads.find((sq) => sq.units.some((u) => u.id === uid));
  const sideOfSquad = (sq) => (snap.enemy.includes(sq) ? 'e' : 'p');
  const totalQueued = snap.player.reduce((n, sq) => n + (sq.plan?.length || 0), 0);
  const unspentSquads = snap.player.filter((sq) => sq.energyLeft > 0);
  const hasUnspent = unspentSquads.length > 0;
  // the hand belongs to the player squad the selection is inside (squad OR unit level)
  const planSquadId = (sel.side === 'p' && sel.squadId) ? sel.squadId : selId;
  const selectedSquad = snap.player.find((sq) => sq.id === planSquadId);
  const selectedCard = selId2 ? (selectedSquad?.hand || []).find((c) => c.iid === selId2) : null;
  // hand shows once a squad is selected: YOUR squad = playable, an ENEMY squad = face-DOWN
  const handSquad = sel.squadId ? allSquads.find((sq) => sq.id === sel.squadId) : null;
  const showHand = !dockHidden && !anim && !!handSquad;
  const handIsEnemy = handSquad ? sideOfSquad(handSquad) === 'e' : false;

  const frontOf = (sq) => sq?.units.find((u) => u.isFront)?.id || sq?.units[0]?.id || null;
  // during a drag: set the scope HIGHLIGHT (drag.hi) + which field the camera holds on.
  const scopeLevelOf = (card) => { const s = scopeOf(card); return s === 'field' ? 'field' : (s === 'squad' ? 'squad' : 'unit'); };
  liveRef.current.updateDragHi = (g) => {
    if (!g.lifted) { g.hi = null; g.valid = false; g.wantSide = null; return; }   // in the hand → no aiming
    const wantSide = isOffensiveCard(g.card) ? 'e' : 'p';
    const scopeLevel = scopeLevelOf(g.card);
    g.wantSide = wantSide; g.scopeLevel = scopeLevel;
    g.valid = validRef.current ? validRef.current(g.x, g.y, wantSide) : true;   // over a real target?
    const over = g.over ? squadOfUnit(g.over) : null;
    if (scopeLevel === 'field' || !over || sideOfSquad(over) !== wantSide) { g.hi = { level: 'side', side: wantSide }; return; }
    g.hi = scopeLevel === 'squad'
      ? { level: 'squad', side: wantSide, squadId: over.id }
      : { level: 'unit', side: wantSide, squadId: over.id, unitId: g.over };
  };
  liveRef.current.affords = (card) => (selectedSquad?.energyLeft ?? 0) >= (card?.cost ?? 1);
  // dropped over the bottom HAND band → reorganise the hand (persisted) or just return the card
  liveRef.current.handReorder = (iid, x, y) => {
    if (y < window.innerHeight * 0.72) return false;   // not in the hand band → let play/return handle it
    const sq = selectedSquad; if (!sq) return true;    // return the card (no reorder)
    const N = (sq.hand || []).length; if (N <= 1) return true;
    const W = window.innerWidth, left = W * 0.30, span = W * 0.40;
    const idx = Math.max(0, Math.min(N - 1, Math.round(((x - left) / span) * (N - 1))));
    reorderHand(sq.id, iid, idx);
    return true;
  };
  liveRef.current.resolveDropFromHi = (hi) => {
    if (!hi) return null;
    if (hi.level === 'unit') return hi.unitId;
    if (hi.level === 'squad') return frontOf(allSquads.find((sq) => sq.id === hi.squadId));
    if (hi.level === 'side') return frontOf((hi.side === 'e' ? snap.enemy : snap.player)[0]);
    return null;
  };

  const startHandDrag = (card, ne) => {
    if (anim) return;
    drag.current = { iid: card.iid, card, x0: ne.clientX, y0: ne.clientY, x: ne.clientX, y: ne.clientY, moved: false, over: null, hi: null, tapSel: selId2 === card.iid };
  };

  const disp = (u) => (anim ? { ...u, hp: anim.hp[u.id] ?? u.hp, block: anim.block[u.id] ?? u.block, dead: (anim.hp[u.id] ?? u.hp) <= 0 } : u);

  // step UP one level (Unit → Squad → Side → Field) — clicking empty table.
  // Also DESELECT any armed card so the camera returns to normal (fixes a stuck view).
  const stepUp = () => { setSelId2(null); setSel((s) => {
    if (s.level === 'unit') return { level: 'squad', side: s.side, squadId: s.squadId, unitId: null };
    if (s.level === 'squad') return { level: 'side', side: s.side, squadId: null, unitId: null };
    if (s.level === 'side') return { level: 'field', side: null, squadId: null, unitId: null };
    return { level: 'field', side: null, squadId: null, unitId: null };
  }); };
  // click a ZONE (field / squad ground plane) → select it DIRECTLY (or play a selected
  // card at it). Clicking a creature selects that UNIT (a 2nd click opens its card).
  // a select-then-target play flies the card up from the hand (screen bottom-centre) → target
  const flyFromHand = (card, targetId) => setFly({ key: (flySeq.current += 1), card, targetId, x: window.innerWidth / 2, y: window.innerHeight - 90, kind: 'select' });
  const onZone = (z) => {
    if (anim) return;
    if (selectedCard) {
      // targeting rule: offensive cards hit the ENEMY field, beneficial cards your OWN
      const wantSide = isOffensiveCard(selectedCard) ? 'e' : 'p';
      if (z.side !== wantSide) { setSelId2(null); return; }   // wrong side → cancel selection
      const t = z.level === 'squad' ? frontOf(allSquads.find((sq) => sq.id === z.squadId)) : frontOf((z.side === 'e' ? snap.enemy : snap.player)[0]);
      if (t) { if (affordCard(selectedCard)) { queueCard(selectedCard.iid, t); flyFromHand(selectedCard, t); } setSelId2(null); }
      return;
    }
    setSelId2(null);
    setSel({ level: z.level, side: z.side, squadId: z.squadId || null, unitId: null });
  };
  const onTok = (u, side) => {
    if (anim) return;
    const sq = squadOfUnit(u.id); if (!sq) return;
    if (selectedCard) {
      const wantSide = isOffensiveCard(selectedCard) ? 'e' : 'p';
      if (side === wantSide) { if (affordCard(selectedCard)) { queueCard(selectedCard.iid, u.id); flyFromHand(selectedCard, u.id); } setSelId2(null); }
      return;
    }
    setSelId2(null);
    if (sel.level === 'unit' && sel.unitId === u.id) { setZoom({ u: disp(u), side }); return; }  // 2nd click = detail
    setSel({ level: 'unit', side, squadId: sq.id, unitId: u.id });
  };

  // in-SCENE FX: a floating label anchored to a unit's 3D card, optionally preceded by a
  // PROJECTILE flying from the actor (`from`) to the target so the action reads directionally.
  const FX_COLOR = { dmg: '#ff5a4a', blocked: '#cbd5e1', block: '#f0c84a', heal: '#4ade80', miss: '#cbd5e1', death: '#ff7b7b' };
  const FX_KIND = { dmg: 'strike', blocked: 'strike', heal: 'heal', miss: 'strike' };
  const spawnFx = (unitId, kind, text, from) => {
    if (!unitId) return;
    const key = ++fxSeq.current;
    const proj = from && from !== unitId ? { from, fx: FX_KIND[kind] || 'strike' } : null;
    setFx((f) => [...f, { key, unitId, text, color: FX_COLOR[kind] || '#fff', ...proj }]);
    timers.current.push(setTimeout(() => setFx((f) => f.filter((x) => x.key !== key)), 1600));
  };

  // Fight: confirm first if any squad still has energy to spend, else resolve.
  const requestFight = () => {
    if (anim || snap.outcome) return;
    if (hasUnspent) { setConfirmFight(true); return; }
    doFight();
  };
  // DEFAULT playback timings (ms) at 1× — divided by the live speed multiplier (0.5/1/2).
  // Tuned SLOW so each action reads clearly (the old values ran ~4× too fast at "1×").
  const CAST_MS = 2600;  // beat AFTER the actor casts, before the effect lands on the target
  const HIT_MS = 2100;   // beat after an effect resolves
  const doFight = () => {
    if (anim || snap.outcome) return;
    setConfirmFight(false); setSelId2(null); setPlayPaused(false); setTicker(null); setPlanOpen(false);
    const pre = { hp: {}, block: {} };
    allSquads.forEach((sq) => sq.units.forEach((u) => { pre.hp[u.id] = u.hp; pre.block[u.id] = u.block; }));
    setAnim({ hp: { ...pre.hp }, block: { ...pre.block }, acting: null });
    const { log, entries } = resolve();
    const lines = entries || [];
    let entryIdx = 0;
    const steps = (log || []).filter((e) => ['play', 'damage', 'block', 'heal', 'regen', 'miss', 'death'].includes(e.type));
    let i = 0;
    const schedule = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    const run = () => {
      if (pausedRef.current) { schedule(run, 110); return; }   // live PAUSE: hold at this beat
      if (i >= steps.length) { setAnim(null); return; }
      const e = steps[i++];
      const sp = Math.max(0.25, speedRef.current);
      if (e.type === 'play') {
        // 1) show the ACTOR doing the action first (it lifts/glows via acting), camera on it.
        // Stamp the log entry with the battle time at the moment THIS action begins animating
        // (so a turn's actions get distinct timestamps, not one shared resolve-time).
        if (lines[entryIdx]) {
          const secs = snap.startedAt ? Math.max(0, Math.floor((Date.now() - snap.startedAt) / 1000)) : 0;
          lines[entryIdx].at = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
          setTicker(lines[entryIdx++]);
        }
        actingRef.current = e.ownerId;
        setAnim((a) => (a ? { ...a, acting: e.ownerId, focus: e.ownerId } : a));
        schedule(run, CAST_MS / sp);
        return;
      }
      // 2) effect lands on the TARGET — fly an FX from the actor to the target, then apply.
      // The CAMERA also follows to the receiving creature (focus = target) so you see impact.
      const from = actingRef.current;
      const recv = e.targetId ?? e.unitId;
      setAnim((a) => { if (!a) return a; const n = { hp: { ...a.hp }, block: { ...a.block }, acting: a.acting, focus: recv ?? a.focus };
        if (e.type === 'damage') { n.hp[e.targetId] = e.hp; if (e.blocked) n.block[e.targetId] = Math.max(0, (n.block[e.targetId] || 0) - e.blocked); }
        else if (e.type === 'block') n.block[e.unitId] = e.total;
        else if (e.type === 'heal' || e.type === 'regen') n.hp[e.targetId ?? e.unitId] = e.hp;
        return n; });
      if (e.type === 'damage') { const net = e.amount - (e.blocked || 0); spawnFx(e.targetId, net > 0 ? 'dmg' : 'blocked', net > 0 ? `-${net}` : '🛡', from); }
      else if (e.type === 'block') spawnFx(e.unitId, 'block', `+${e.amount}`);
      else if (e.type === 'heal' || e.type === 'regen') spawnFx(e.targetId ?? e.unitId, 'heal', `+${e.amount ?? ''}`, from);
      else if (e.type === 'miss') spawnFx(e.targetId, 'miss', 'MISS', from);
      else if (e.type === 'death') spawnFx(e.unitId, 'death', '☠');
      schedule(run, HIT_MS / sp);
    };
    run();
  };

  // combat log grouped by turn (latest turn first; entries within a turn in play order)
  const logByTurn = (() => {
    const groups = new Map();
    for (const en of (snap.logHistory || [])) { const t = en.turn ?? 1; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(en); }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  })();

  // flat list of queued actions this turn (for the Plan popup)
  const unitName = (id) => allSquads.flatMap((s) => s.units).find((u) => u.id === id)?.name || '—';
  const plannedActions = snap.player.flatMap((sq, i) => (sq.plan || []).map((a) => ({ squadLabel: `Squad ${i + 1}`, card: a.card, targetId: a.targetId, targetName: unitName(a.targetId) })));

  // ── selection PILL: content is relevant to the current selection level ──
  const sideName = (s) => (s === 'e' ? 'Enemy' : 'Ally');
  const selSquad = sel.squadId ? allSquads.find((sq) => sq.id === sel.squadId) : null;
  const selUnit = sel.unitId ? allSquads.flatMap((sq) => sq.units).find((u) => u.id === sel.unitId) : null;
  const roleName = (u) => (u?.isFront ? 'Vanguard' : 'Support');
  let pill = null;
  if (sel.level === 'unit' && selUnit && selSquad) {
    const arr = sel.side === 'e' ? snap.enemy : snap.player;
    pill = { kind: 'unit', side: sel.side, title: `${sideName(sel.side)} Squad ${arr.indexOf(selSquad) + 1} ${roleName(selUnit)}`, energy: sel.side === 'p' ? selSquad : null };
  } else if (sel.level === 'squad' && selSquad) {
    const arr = sel.side === 'e' ? snap.enemy : snap.player;
    pill = { kind: 'squad', side: sel.side, title: `${sideName(sel.side)} Squad (${arr.indexOf(selSquad) + 1} of ${arr.length})`, energy: sel.side === 'p' ? selSquad : null };
  } else if (sel.level === 'side' && sel.side) {
    pill = { kind: 'side', side: sel.side, title: `${sideName(sel.side)} Field`, unspent: sel.side === 'p' ? unspentSquads.length : null };
  }
  // arrows change function by scope: cycle fields / squads-in-field / creatures-in-squad
  const cycleSel = (dir) => {
    if (!pill) return;
    if (pill.kind === 'side') { setSel({ level: 'side', side: sel.side === 'e' ? 'p' : 'e', squadId: null, unitId: null }); return; }
    if (pill.kind === 'squad') {
      const arr = sel.side === 'e' ? snap.enemy : snap.player;
      const i = (((arr.indexOf(selSquad) + dir) % arr.length) + arr.length) % arr.length;
      setSel({ level: 'squad', side: sel.side, squadId: arr[i].id, unitId: null });
    } else {
      const us = selSquad.units;
      const ci = us.findIndex((u) => u.id === sel.unitId);
      const i = (((ci + dir) % us.length) + us.length) % us.length;
      setSel({ level: 'unit', side: sel.side, squadId: selSquad.id, unitId: us[i].id });
    }
  };
  const canCycle = !!pill && (pill.kind === 'side'
    || (pill.kind === 'squad' && (sel.side === 'e' ? snap.enemy : snap.player).length > 1)
    || (pill.kind === 'unit' && selSquad && selSquad.units.length > 1));
  const canToggleHand = !!sel.squadId;   // hand toggle shows on ANY selected squad (ally or enemy)

  // when a card is ARMED (selected OR mid-drag) highlight its valid TARGETS on the board:
  // offensive → enemy side (red), beneficial → your side (green); front/self scopes = vanguards.
  // a card is "armed" (targets highlight) when selected, or while dragging ONCE it's lifted
  // above the hand zone — not while it's still down in the hand being reordered.
  const armedCard = selectedCard || (d?.card && d.lifted ? d.card : null);
  const targetHint = (armedCard && !anim)
    ? { side: isOffensiveCard(armedCard) ? 'e' : 'p', scope: scopeOf(armedCard), offensive: isOffensiveCard(armedCard) }
    : null;

  // battle clock (mm:ss since start) shown in the topbar; log rows carry their own stamp (en.at)
  const battleSecs = snap.startedAt ? Math.max(0, Math.floor((nowTs - snap.startedAt) / 1000)) : 0;
  const battleClock = `${Math.floor(battleSecs / 60)}:${String(battleSecs % 60).padStart(2, '0')}`;

  // ── clickable log / ticker / plan helpers — render the ACTUAL cards involved ──
  const unitById = (id) => allSquads.flatMap((s) => s.units).find((u) => u.id === id) || null;
  const sideOfUnit = (id) => (snap.enemy.some((sq) => sq.units.some((u) => u.id === id)) ? 'e' : 'p');
  const affordCard = (card) => (selectedSquad?.energyLeft ?? 0) >= (card?.cost ?? 1);
  // opening an inspect modal DURING playback auto-pauses; closing it resumes (unless the
  // player had paused manually). autoPauseRef tracks that we were the one who paused.
  const pauseForModal = () => { if (anim && !pausedRef.current) { autoPauseRef.current = true; setPlayPaused(true); } };
  const resumeIfAuto = () => { if (autoPauseRef.current) { autoPauseRef.current = false; setPlayPaused(false); } };
  const inspectUnit = (id) => { const u = unitById(id); if (u) { pauseForModal(); setZoom({ u: disp(u), side: sideOfUnit(id) }); } };
  const openCard = (card) => { if (card) { pauseForModal(); setCardZoom(card); } };
  // skip the rest of the fight animation → jump straight to the resolved board.
  const skipFight = () => { timers.current.forEach(clearTimeout); timers.current = []; setFx([]); setTicker(null); setPlayPaused(false); autoPauseRef.current = false; setAnim(null); };
  // merge same-type effects so a multi-hit reads "18 Damage", not "6 · 6 · 6" (no runaway list).
  // keeps the number even when it sums to 0 (→ "0 Damage", not a bare "Damage").
  const mergeEffects = (arr) => {
    const m = new Map();
    for (const s of arr || []) {
      const mt = /^(-?\d+)\s+(.*)$/.exec(s);
      if (mt) { const e = m.get(mt[2]) || { sum: 0, num: true }; e.sum += Number(mt[1]); e.num = true; m.set(mt[2], e); }
      else if (!m.has(s)) m.set(s, { sum: 0, num: false });
    }
    return [...m.entries()].map(([lbl, e]) => (e.num ? `${e.sum} ${lbl}` : lbl));
  };
  const creaturePortrait = (u) => (u && (sizedPortrait(u.portrait, u.form)
    || (u.axes?.biology ? creatureArt({ id: u.id, biology: u.axes.biology, family: u.axes.family, subtypes: u.axes.subtypes }) : null)));
  // the ACTUAL creature card as a small clickable token (art + name → inspect on the battlefield).
  // NO key — rendered inline (positional); a changing key amid unkeyed siblings makes React fail
  // to remove stale nodes in the in-place-updated ticker (they would pile up).
  const CreatureTok = (id, name, side) => {
    const u = unitById(id); const cls = `bCardTok cre ${side === 'e' ? 'foe' : 'ally'}`;
    if (!u) return <span className={`${cls} dead`}><Icon icon="tabler:skull" /><em>{name}</em></span>;
    const art = creaturePortrait(u);
    return <button className={cls} title={`Inspect ${name}`} onClick={() => inspectUnit(id)}>
      <span className="bCardTokArt">{art ? <img src={art} alt="" /> : <Icon icon="tabler:paw" />}</span><em>{name}</em>
    </button>;
  };
  // the ACTUAL action card as a small clickable token (art + cost + name → open the full card).
  const CardTok = (card) => {
    if (!card) return null;
    const art = cardArt({ ...card, attunement: card.element });
    return <button className="bCardTok act" style={{ '--el': elColor(card.element) }} title={`${card.name} — view card`} onClick={() => openCard(card)}>
      <span className="bCardTokArt">{art ? <img src={art} alt="" /> : <Icon icon="game-icons:card-play" />}</span>
      {card.cost != null && <span className="bCardTokCost">{card.cost}</span>}<em>{card.name}</em>
    </button>;
  };
  // a structured combat-log / ticker line using the real cards: actor → action → target + effects
  const renderEntry = (en, withStamp) => {
    let eff = mergeEffects(en.effects);
    // render the damage/block pair as one comma phrase: "N Damage Taken, X Blocked"
    const dt = eff.find((s) => s.endsWith('Damage Taken'));
    const bl = eff.find((s) => s.endsWith('Blocked'));
    if (dt && bl) eff = [`${dt}, ${bl}`, ...eff.filter((s) => s !== dt && s !== bl)];
    return (
      <span className="bLogLine">
        {withStamp && <span className="bLogTurn">{en.at || `T${en.turn}`}</span>}
        {CreatureTok(en.ownerId, en.actor, en.side)}
        <span className={`bLogVerb ${en.offensive ? 'atk' : 'buf'}`}><Icon icon={en.offensive ? 'game-icons:crossed-swords' : 'game-icons:sparkles'} /></span>
        {CardTok(en.cardObj || { name: en.card, element: en.element, cost: null })}
        <span className="bLogArrow"><Icon icon="tabler:arrow-right" /></span>
        {CreatureTok(en.targetId, en.target, sideOfUnit(en.targetId))}
        {eff.length ? <span className="bLogEff">{eff.join(' · ')}</span> : null}
      </span>
    );
  };

  return (
    <div className={`battleScreen${d ? ' dragging' : ''}${anim ? ' resolving' : ''}${dockHidden ? ' dockHidden' : ''}${selectedCard ? ' picking' : ''}`}
      onContextMenu={(e) => e.preventDefault()}>
      {/* REAL 3D BOARD (react-three-fiber): creatures are card meshes on a table,
          raycast-picked so tilted 3D cards stay tappable. Hand/HUD stay DOM below. */}
      <div className="bArena3d">
        <Board3D
          enemy={snap.enemy.map((sq) => ({ ...sq, units: sq.units.map(disp) }))}
          player={snap.player.map((sq) => ({ ...sq, units: sq.units.map(disp) }))}
          sel={sel} onStepUp={stepUp} actingId={anim?.acting} focusId={anim?.focus} onPick={onTok} onZone={onZone} pickRef={pickRef} validRef={validRef} fx={fx} drag={d}
          handVisible={showHand} handSquadId={handSquad?.id || null}
          cardFocusSide={autoCam ? (selectedCard ? (isOffensiveCard(selectedCard) ? 'e' : 'p') : (fly ? sideOfUnit(fly.targetId) : null)) : null}
          autoCam={autoCam} targetHint={targetHint} onInspect={setInspect} camRef={camRef}
          onSelectSquad={(side, squadId) => { setSelId2(null); setSel({ level: 'squad', side, squadId, unitId: null }); }}
          fly={fly} onFlyDone={() => setFly(null)}
          hand={showHand ? {
            station: handSquad,
            selectedIid: selId2, dealKey: snap.dealKey, faceDown: handIsEnemy,
            squadIndex: Math.max(0, dockList.findIndex((sq) => sq.id === handSquad.id)),
            onCardPointerDown: startHandDrag, onInspect: setInspect,
          } : null} />

        {/* TOP-LEFT: turn tracker (holds until a fight fully resolves) + battle clock */}
        <div className="bTopLeft">
          <div className="bTurn"><b>Turn {displayTurn}</b></div>
          <div className="bTimer" title="Battle time"><Icon icon="tabler:clock" />{battleClock}</div>
        </div>

        {/* TOP-RIGHT: a single camera button opens the control pad (hidden by default;
            touch-friendly — WASD still pans). rotate ↺/↻ · tilt · zoom · recenter. */}
        <div className="bCamWrap">
          <button className={`bCamToggle${camOpen ? ' on' : ''}`} title="Camera controls" onClick={() => setCamOpen((v) => !v)}>
            <Icon icon={camOpen ? 'tabler:x' : 'tabler:video'} />
          </button>
          {camOpen && (
            <div className="bCamCtl">
              <div className="bCamRow">
                <button title="Rotate left" onClick={() => camRef.current?.yaw(-0.35)}><Icon icon="tabler:rotate" /></button>
                <button title="Tilt up (more overhead)" onClick={() => camRef.current?.tilt(-0.14)}><Icon icon="tabler:angle" /></button>
                <button title="Rotate right" onClick={() => camRef.current?.yaw(0.35)}><Icon icon="tabler:rotate-clockwise" /></button>
              </div>
              <div className="bCamRow">
                <button title="Zoom in" onClick={() => camRef.current?.zoom(-0.22)}><Icon icon="tabler:zoom-in" /></button>
                <button title="Recenter camera" onClick={() => camRef.current?.reset()}><Icon icon="tabler:focus-centered" /></button>
                <button title="Zoom out" onClick={() => camRef.current?.zoom(0.22)}><Icon icon="tabler:zoom-out" /></button>
              </div>
              <button className={`bCamAuto${autoCam ? ' on' : ''}`} title="Auto-move the camera when aiming action cards"
                onClick={() => setAutoCam((v) => !v)}>
                <Icon icon={autoCam ? 'tabler:camera-bolt' : 'tabler:camera-off'} />
                <span>Auto-camera: {autoCam ? 'On' : 'Off'}</span>
              </button>
            </div>
          )}
        </div>

        {/* CENTRE: only the outcome banner (the live action text moved to the bottom bar) */}
        {snap.outcome && (
          <div className={`bOutcome center ${snap.outcome === 'p' ? 'win' : 'lose'}`}>
            {snap.outcome === 'p' ? 'Victory' : snap.outcome === 'e' ? 'Defeat' : 'Draw'}
            <span className="bNew" onClick={() => window.location.reload()} title="New battle"><Icon icon="tabler:refresh" /></span>
          </div>
        )}
      </div>

      {/* BOTTOM HUD. During the FIGHT PHASE every planning control is replaced by a single
          centred bar: the live action line (clickable crests) + speed/pause/skip controls. */}
      <div className={`bHud${anim ? ' resolving' : ''}`}>
        {anim ? (
          <div className="bFightBar">
            <div className="bFightText">{ticker ? renderEntry(ticker, false) : <span className="bFightIdle"><Icon icon="tabler:loader-2" /> Resolving…</span>}</div>
            <div className="bFightCtl">
              <div className="bSpeed inline">
                <button className={playPaused ? 'on' : ''} title={playPaused ? 'Resume' : 'Pause'} onClick={() => setPlayPaused((v) => !v)}>
                  <Icon icon={playPaused ? 'tabler:player-play-filled' : 'tabler:player-pause-filled'} />
                </button>
                {[0.5, 1, 2].map((sp) => (
                  <button key={sp} className={!playPaused && playSpeed === sp ? 'on' : ''} onClick={() => { setPlaySpeed(sp); setPlayPaused(false); }}>{sp}×</button>
                ))}
              </div>
              <button className="bCtl skip" title="Skip the animation" onClick={skipFight}><Icon icon="tabler:player-track-next-filled" /> Skip</button>
            </div>
          </div>
        ) : (
          <>
            <div className="bHudCluster left">
              {canToggleHand && (
                <button className="bHudBtn toggle" title={dockHidden ? 'Show Action Cards' : 'Hide Action Cards'} onClick={() => setDockHidden((v) => !v)}>
                  <Icon icon="tabler:cards" />
                  {!dockHidden && <span className="bHudX"><Icon icon="tabler:x" /></span>}
                </button>
              )}
            </div>

            {pill && (
              <div className="bHudCluster center pill">
                <button className="bHudBtn" title="Previous" disabled={!canCycle} onClick={() => cycleSel(-1)}><Icon icon="tabler:chevron-left" /></button>
                <div className={`bHudSquad${pill.side === 'e' ? ' foe' : ''}`}>
                  <span className="bHudSquadName">{pill.title}</span>
                  {(pill.kind === 'squad' || pill.kind === 'unit') && pill.energy && (
                    <span className="bEnergy" title={`${pill.energy.energyLeft} of ${pill.energy.maxEnergy} AP`}>
                      <Icon icon="tabler:bolt" /><b>{pill.energy.energyLeft}/{pill.energy.maxEnergy}</b><em className="bEnergyLbl">AP</em>
                    </span>
                  )}
                </div>
                <button className="bHudBtn" title="Next" disabled={!canCycle} onClick={() => cycleSel(1)}><Icon icon="tabler:chevron-right" /></button>
              </div>
            )}

            {/* ally FIELD selected → a line per squad with its AP ratio; click one to select it */}
            {pill && pill.kind === 'side' && pill.side === 'p' && (
              <div className="bFieldPop">
                <div className="bFieldPopHead"><Icon icon="tabler:users-group" /> Ally Squads</div>
                {snap.player.map((sq, i) => (
                  <button key={sq.id} className="bEnergyLink" onClick={() => { setSelId2(null); setSel({ level: 'squad', side: 'p', squadId: sq.id, unitId: null }); }}>
                    <span><Icon icon="tabler:chevron-right" /> Squad {i + 1}</span>
                    <em className={sq.energyLeft > 0 ? 'has' : ''}><Icon icon="tabler:bolt" /> {sq.energyLeft}/{sq.maxEnergy} AP</em>
                  </button>
                ))}
              </div>
            )}

            <div className="bHudCluster right">
              {snap.logHistory?.length ? (
                <button className="bHudBtn log" title="View combat log" onClick={() => setLogOpen(true)}>
                  <Icon icon="game-icons:scroll-quill" /><span>Log</span>
                </button>
              ) : null}
              <button className={`bHudBtn plan${planOpen ? ' on' : ''}`} title="Planned actions" onClick={() => setPlanOpen((v) => !v)}>
                <Icon icon="tabler:list-check" /><span>Plan</span>{totalQueued > 0 && <span className="bPlanCount">{totalQueued}</span>}
              </button>
              <button className="bHudBtn fight" title="Fight — resolve the round" disabled={!!snap.outcome} onClick={requestFight}><Icon icon="game-icons:crossed-swords" /><span>Fight</span></button>
            </div>

            {/* PLAN popup — the queued actions this turn (clickable card + target) + Undo/Redo/Reset */}
            {planOpen && (
              <div className="bPlanPop" onClick={(e) => e.stopPropagation()}>
                <div className="bPlanHead">
                  <span><Icon icon="tabler:list-check" /> Planned Actions <em>{totalQueued}</em></span>
                  <button className="bZoomClose sm" onClick={() => setPlanOpen(false)}><Icon icon="tabler:x" /></button>
                </div>
                <div className="bPlanList">
                  {plannedActions.length === 0 && <div className="bPlanEmpty">No actions queued. Drag or select a card to plan one.</div>}
                  {plannedActions.map((pa, k) => (
                    <div key={k} className="bPlanRow">
                      <span className="bPlanSq">{pa.squadLabel}</span>
                      {CardTok(pa.card)}
                      <span className="bLogArrow"><Icon icon="tabler:arrow-right" /></span>
                      {CreatureTok(pa.targetId, pa.targetName, sideOfUnit(pa.targetId))}
                    </div>
                  ))}
                </div>
                <div className="bPlanBtns">
                  <button className="bCtl" title="Undo last" disabled={!totalQueued} onClick={undoLast}><Icon icon="tabler:arrow-back-up" /> Undo</button>
                  <button className="bCtl" title="Redo" disabled={!snap.canRedo} onClick={redoLast}><Icon icon="tabler:arrow-forward-up" /> Redo</button>
                  <button className="bCtl danger" title="Reset all" disabled={!totalQueued} onClick={() => { setPlanOpen(false); setConfirmReset(true); }}><Icon icon="tabler:refresh" /> Reset</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* the dragged Action Card is now a REAL 3D card mesh in Board3D (DragCard3D),
          lifted out of the hand and followed through the scene — no DOM ghost. */}

      {zoom && (
        <div className="bZoom" onClick={() => { setZoom(null); resumeIfAuto(); }}>
          <div className="bZoomCard" onClick={(e) => e.stopPropagation()}><CardFace f={zoom.u} side={zoom.side === 'e' ? 'enemy' : 'ally'} /></div>
          <button className="bZoomClose" onClick={() => { setZoom(null); resumeIfAuto(); }}><Icon icon="tabler:x" /></button>
        </div>
      )}

      {inspect && (
        <div className="bInspect" onClick={() => { setInspect(null); resumeIfAuto(); }} onWheel={(e) => e.stopPropagation()}>
          <div className="bInspectPanel" onClick={(e) => e.stopPropagation()}>
            <div className="bInspectHead"><span>{inspect.title} <em>· {(inspect.plays || inspect.cards).length}</em></span>
              {inspect.note && <small>{inspect.note}</small>}
              <button className="bZoomClose sm" onClick={() => { setInspect(null); resumeIfAuto(); }}><Icon icon="tabler:x" /></button>
            </div>
            {inspect.plays ? (
              // In Play / queued: one row per card showing who CAST it and who it TARGETED
              <div className="bPlayRows">
                {inspect.plays.map((pl, i) => (
                  <div key={i} className="bPlayRow">
                    {CreatureTok(pl.ownerId, unitName(pl.ownerId), sideOfUnit(pl.ownerId))}
                    <span className="bLogVerb"><Icon icon="tabler:arrow-right" /></span>
                    {CardTok(pl.card)}
                    <span className="bLogVerb"><Icon icon="tabler:arrow-right" /></span>
                    {CreatureTok(pl.targetId, unitName(pl.targetId), sideOfUnit(pl.targetId))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bInspectGrid">
                {inspect.cards.map((card, i) => (card.known === false
                  ? <div key={i} className="bCardBack big" title="Unknown card"><Icon icon="game-icons:card-random" /><span>?</span></div>
                  : <ActionCard key={card.iid || i} card={card} onDoubleClick={() => setCardZoom(card)} />))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* enlarged Action Card detail (like the creature card, but for a card) */}
      {cardZoom && (
        <div className="bZoom" onClick={() => { setCardZoom(null); resumeIfAuto(); }}>
          <div className="bZoomCard action" onClick={(e) => e.stopPropagation()}><ActionCard card={cardZoom} big /></div>
          <button className="bZoomClose" onClick={() => { setCardZoom(null); resumeIfAuto(); }}><Icon icon="tabler:x" /></button>
        </div>
      )}

      {/* Fight confirmation — energy still unspent in a squad. Each squad is a LINK that
          selects it (and closes) so you can go spend the energy. */}
      {confirmFight && (
        <div className="bInspect" onClick={() => setConfirmFight(false)}>
          <div className="bConfirm" onClick={(e) => e.stopPropagation()}>
            <h3><Icon icon="game-icons:crossed-swords" /> Fight now?</h3>
            <p>These squads still have <b>AP (Action Points) to spend</b>. Click one to go plan it, or fight anyway:</p>
            <div className="bEnergyList">
              {unspentSquads.map((sq) => {
                const n = snap.player.indexOf(sq) + 1;
                return (
                  <button key={sq.id} className="bEnergyLink" onClick={() => { setConfirmFight(false); setSelId2(null); setSel({ level: 'squad', side: 'p', squadId: sq.id, unitId: null }); }}>
                    <span><Icon icon="tabler:chevron-right" /> Ally Squad {n}</span>
                    <em><Icon icon="tabler:bolt" /> {sq.energyLeft}/{sq.maxEnergy} AP</em>
                  </button>
                );
              })}
            </div>
            <div className="bConfirmBtns">
              <button className="bCtl wide" onClick={() => setConfirmFight(false)}>Keep planning</button>
              <button className="bCtl fight wide" onClick={doFight}>Fight anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirmation */}
      {confirmReset && (
        <div className="bInspect" onClick={() => setConfirmReset(false)}>
          <div className="bConfirm" onClick={(e) => e.stopPropagation()}>
            <h3><Icon icon="tabler:refresh" /> Reset moves?</h3>
            <p>Return <b>every card</b> queued this turn to its squad's hand?</p>
            <div className="bConfirmBtns">
              <button className="bCtl wide" onClick={() => setConfirmReset(false)}>Keep them</button>
              <button className="bCtl fight wide" onClick={() => { resetPlans(); setConfirmReset(false); }}>Reset all</button>
            </div>
          </div>
        </div>
      )}

      {/* mobile: require landscape (a portrait gate) — the 3-D board needs the width */}
      <div className="bRotateGate">
        <Icon icon="tabler:device-mobile-rotated" />
        <p>Rotate your device to <b>landscape</b> to play.</p>
      </div>

      {/* full combat log */}
      {logOpen && (
        <div className="bInspect" onClick={() => setLogOpen(false)}>
          <div className="bInspectPanel log" onClick={(e) => e.stopPropagation()}>
            <div className="bInspectHead"><span><Icon icon="game-icons:scroll-quill" /> Combat Log</span>
              <button className="bZoomClose sm" onClick={() => setLogOpen(false)}><Icon icon="tabler:x" /></button>
            </div>
            <div className="bLogList">
              {(snap.logHistory || []).length === 0 && <div className="bHandEmpty">No actions yet.</div>}
              {logByTurn.map(([turn, entries]) => {
                const open = !collapsedTurns.has(turn);
                return (
                  <div key={turn} className="bLogTurnGroup">
                    <button className={`bLogTurnHead${open ? ' open' : ''}`} onClick={() => setCollapsedTurns((s) => { const n = new Set(s); if (n.has(turn)) n.delete(turn); else n.add(turn); return n; })}>
                      <Icon icon={open ? 'tabler:chevron-down' : 'tabler:chevron-right'} />
                      <span>Turn {turn}</span><em>{entries.length}</em>
                    </button>
                    {open && entries.map((en, i) => (
                      <div key={i} className={`bLogRow ${en.side === 'e' ? 'foe' : 'ally'}`}>{renderEntry(en, true)}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

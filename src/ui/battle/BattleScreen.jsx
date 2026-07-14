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
import { enterLandscapeFullscreen, wantsLandscape } from '../mobile.js';
import { BIOMES } from './SceneEnv.jsx';
import '../combat/combat.css';   // CardFace styling for the enlarged info card
import './battle.css';
import '../world/world.css';     // explore-overlay classes (minimap / dpad / event modal)

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

// A d6 face rendered as CSS pips (reliable — no icon dependency). `rolling` shakes it.
const DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function DieFace({ value = 1, rolling = false, pass = null }) {
  const on = new Set(DIE_PIPS[value] || DIE_PIPS[1]);
  const cls = `bDie${rolling ? ' rolling' : ''}${pass === true ? ' pass' : ''}${pass === false ? ' fail' : ''}`;
  return (
    <div className={cls}>
      {Array.from({ length: 9 }).map((_, i) => <span key={i} className={`bPip${on.has(i) ? ' on' : ''}`} />)}
    </div>
  );
}

// ── first-run ONBOARDING: contextual coach tips shown once each (persisted), + an on-screen goal.
const ONB_KEY = 'chimera.v2.onboard';
function loadOnbSeen() { try { return new Set(JSON.parse(localStorage.getItem(ONB_KEY) || '[]')); } catch { return new Set(); } }
const ONB_TIPS = {
  welcome: { id: 'welcome', icon: 'tabler:compass', title: 'Welcome, traveller',
    body: 'This is a RUN. Explore the world, win battles to grow your team, and defeat the BOSS (the gold ★ on your minimap) to win. Move with W — turn with A / D.' },
  battle: { id: 'battle', icon: 'game-icons:crossed-swords', title: 'Your first battle',
    body: 'Tap one of YOUR squads to select it, then drag a card onto an enemy to queue an attack. A red bar + “-N” badge preview the damage you’ll deal — a ☠ means it’s lethal. Plan each squad, then press Fight.' },
};

// ── player-centred radar MINIMAP: nearby chunks (biome-tinted), their trees/props as dots, the
// content markers, and a FACING arrow at the centre that rotates with you. ──
const MINI_R = 2;                     // chunks visible each direction → a 5×5 window on the player
const MK_COLOR = { wild: '#ff5a3c', dungeon: '#b060e0', town: '#4aa0ff', event: '#40d0c0' };
// deterministic per-chunk scatter (approximates the in-world flora so the map reads like the scene)
function miniDots(x, y) {
  let a = ((x * 73856093) ^ (y * 19349663) ^ 668265263) >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const n = 3 + ((((x + y) % 3) + 3) % 3);
  const out = [];
  for (let i = 0; i < n; i++) out.push([0.18 + rnd() * 0.64, 0.18 + rnd() * 0.64]);
  return out;
}
// a 5-point star path centred at (cx,cy) with outer/inner radii — marks the BOSS goal chunk.
function starPath(cx, cy, ro, ri) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro, a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i ? 'L' : 'M'} ${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
  }
  return d + 'Z';
}
function WorldMini({ world }) {
  const { grid, pos, facing, gridW, gridH } = world;
  const N = MINI_R * 2 + 1, S = 150, cell = S / N;
  const tiles = [];
  for (let dy = -MINI_R; dy <= MINI_R; dy++) for (let dx = -MINI_R; dx <= MINI_R; dx++) {
    tiles.push({ gx: pos.x + dx, gy: pos.y + dy, cx: (dx + MINI_R) * cell, cy: (dy + MINI_R) * cell });
  }
  const treeCol = (biome) => (biome === 'desert' ? '#9c7b3a' : biome === 'snow' ? '#88a0b0' : '#2f5a29');
  return (
    <svg className="wMiniSvg" width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
      {tiles.map((t) => {
        const inb = t.gx >= 0 && t.gx < gridW && t.gy >= 0 && t.gy < gridH;
        const ch = inb ? grid[`${t.gx},${t.gy}`] : null;
        const fill = ch ? (BIOMES[ch.biome]?.map || '#3f5a30') : '#0d0a07';
        return (
          <g key={`${t.gx},${t.gy}`}>
            <rect x={t.cx + 1} y={t.cy + 1} width={cell - 2} height={cell - 2} rx={3} fill={fill} opacity={ch && ch.cleared ? 0.45 : 1} />
            {ch && miniDots(t.gx, t.gy).map(([fx, fy], i) => (
              <circle key={i} cx={t.cx + fx * cell} cy={t.cy + fy * cell} r={1.5} fill={treeCol(ch.biome)} opacity={0.9} />
            ))}
            {ch && !ch.cleared && ch.boss && (
              <path d={starPath(t.cx + cell / 2, t.cy + cell / 2, cell * 0.28, cell * 0.13)} fill="#ffd24a" stroke="#000a" strokeWidth={1} />
            )}
            {ch && !ch.cleared && !ch.boss && MK_COLOR[ch.kind] && (
              <circle cx={t.cx + cell / 2} cy={t.cy + cell / 2} r={cell * 0.18} fill={MK_COLOR[ch.kind]} stroke="#000a" strokeWidth={1} />
            )}
          </g>
        );
      })}
      {/* the player — a facing arrow at the centre cell (N = up; rotates with facing) */}
      <g transform={`translate(${MINI_R * cell + cell / 2} ${MINI_R * cell + cell / 2}) rotate(${facing * 90})`}>
        <circle r={cell * 0.36} fill="#1a120bDD" stroke="#f0c84a" strokeWidth={1.5} />
        <path d={`M 0 ${-cell * 0.3} L ${cell * 0.2} ${cell * 0.18} L 0 ${cell * 0.05} L ${-cell * 0.2} ${cell * 0.18} Z`} fill="#f0c84a" />
      </g>
    </svg>
  );
}

export default function BattleScreen({ onFlee, onBattleEnd, initialScene, sceneBiome, worldMode = 'battle', world = null, event = null, onCloseEvent, onEventChoice, onBuyCard, reward = null, onCollectReward, onSkipReward, runOver = null, onNewRun, onStep, onTurn } = {}) {
  const exploring = worldMode === 'explore';
  const snap = useBattle((s) => s.snapshot);
  const selectSquad = useBattle((s) => s.selectSquad);
  const setCaster = useBattle((s) => s.setCaster);
  const queueCard = useBattle((s) => s.queueCard);
  const reorderHand = useBattle((s) => s.reorderHand);
  const undoLast = useBattle((s) => s.undoLast);
  const redoLast = useBattle((s) => s.redoLast);
  const resetPlans = useBattle((s) => s.resetPlans);
  const autoPlan = useBattle((s) => s.autoPlan);
  const attemptRunAway = useBattle((s) => s.attemptRunAway);
  const resolve = useBattle((s) => s.resolve);

  const dropEls = useRef(new Map());   // (reserved for in-scene FX anchoring)
  const pickRef = useRef(null);        // Board3D raycast picker: (clientX,clientY) → unitId | null
  const validRef = useRef(null);       // (cx,cy,wantSide) → is this a valid drop location?
  const zoneRef = useRef(null);        // (cx,cy) → the zone under the pointer {level, side, squadId?, unitId?}
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
  const runRef = useRef(null);          // the active playback stepper (so "Next" can drive it)
  const nextMoveRef = useRef(false);    // fast-forward: run w/o delays until the next move begins
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
  const RUN_THRESHOLD = 3;                                    // d6 result a squad must MEET or beat to escape
  const [runAway, setRunAway] = useState(null);              // { stage:'confirm'|'roll'|'result', rolls:{sqId}, success }
  const [dieSpin, setDieSpin] = useState(0);                 // ticker: cycles the shown face while a die rolls
  useEffect(() => {
    if (runAway?.stage !== 'roll') return undefined;
    const id = setInterval(() => setDieSpin((v) => (v + 1) % 6), 80);
    return () => clearInterval(id);
  }, [runAway?.stage]);
  const [camOpen, setCamOpen] = useState(false);             // camera-control pad shown/hidden
  const [autoCam, setAutoCam] = useState(true);              // auto-frame the camera on card interaction
  const [scene, setScene] = useState(sceneBiome || initialScene || 'forest');   // backdrop (chunk biome | grid=admin)
  // post-victory reward selection: which of the 3 cards, which squad gets it, optional capture.
  const [rwPick, setRwPick] = useState({ cardIdx: 0, squadId: null, capIdx: null });
  useEffect(() => { if (reward) setRwPick({ cardIdx: 0, squadId: null, capIdx: null }); }, [reward]);
  const [shopSquad, setShopSquad] = useState(null);   // which squad a town-shop card is bought for
  useEffect(() => { if (event?.kind === 'town') setShopSquad(null); }, [event]);
  const [onbSeen, setOnbSeen] = useState(loadOnbSeen);   // first-run coach tips already dismissed
  const markOnb = (id) => setOnbSeen((s) => { const n = new Set(s); n.add(id); try { localStorage.setItem(ONB_KEY, JSON.stringify([...n])); } catch { /* ignore */ } return n; });
  // in the seamless world the scene FOLLOWS the current chunk's biome (unless in the admin grid).
  useEffect(() => { if (sceneBiome) setScene((v) => (v === 'grid' ? 'grid' : sceneBiome)); }, [sceneBiome]);
  // exploring: W / ↑ walk FORWARD (in the facing direction); A/D / ←/→ TURN left/right.
  useEffect(() => {
    if (!exploring || !onStep) return undefined;
    const onKey = (e) => {
      if (e.repeat || e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') { onStep('forward'); e.preventDefault(); }
      else if (k === 'a' || k === 'arrowleft' || k === 'q') { onTurn?.(-1); e.preventDefault(); }
      else if (k === 'd' || k === 'arrowright' || k === 'e') { onTurn?.(1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exploring, onStep, onTurn]);
  const autoCamRef = useRef(true);                           // live mirror for the once-bound drag handlers
  autoCamRef.current = autoCam;
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
      // dragging a card SUPERSEDES any previously click-selected card → deselect it
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 6) { g.moved = true; setSelId2(null); }
      if (g.moved) {
        const W = window.innerWidth, H = window.innerHeight, m = 70;
        // LIFTED = dragged above the hand zone → the card is being AIMED (camera frames the
        // target field + targets highlight). Below the line = still in the hand (reorder only,
        // camera undisturbed) so you can reorganise without moving the view.
        g.lifted = e.clientY < H * 0.58;
        if (g.lifted) g.everLifted = true;   // sticky: once aimed, the camera stays on the field
        g.over = g.lifted ? ((pickRef.current && pickRef.current(e.clientX, e.clientY)) || null) : null;
        // the ZONE under the pointer (creature / squad / field) — resolves the drop target the
        // SAME way a click would (so dropping on empty squad/field space targets correctly).
        g.zone = g.lifted ? ((zoneRef.current && zoneRef.current(e.clientX, e.clientY)) || null) : null;
        const L = liveRef.current;
        if (L.updateDragHi) L.updateDragHi(g);   // (clears hi/valid when not lifted)
        // live REORDER GAP: while the card is down in the hand, where would it slot in?
        g.insertIdx = (!g.lifted && L.handInsertIdx) ? L.handInsertIdx(g.iid, e.clientX) : null;
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
    const onUp = (e) => {
      if (e && e.button !== 0) return;   // only a LEFT release ends the card drag (right = orbit)
      const g = drag.current; if (!g) return; drag.current = null; setD(null);
      // autoCam ON → snap the camera back to its pickup framing; OFF → keep the player's
      // manual view (just stop the edge-pan velocity).
      if (autoCamRef.current) camRef.current?.resetDragCam(); else camRef.current?.setEdge?.(0, 0);
      if (g.moved) {
        const L = liveRef.current;
        // 1) dropped over the HAND band → reorganise the hand (or just return the card)
        if (L.handReorder && L.handReorder(g.iid, g.x, g.y)) { setSelId2(null); }
        // 2) else over a VALID + AFFORDABLE target → play it (flies to the target). The target is
        // resolved by the SAME rule as a click (creature / squad-area / field).
        else if (g.valid) {
          const target = (L.resolveDrop && L.resolveDrop(g)) || null;
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

  // mobile: on the first touch, go FULLSCREEN + lock LANDSCAPE (best-effort — needs a user
  // gesture, only on coarse-pointer / small screens so desktop is unaffected). The portrait
  // gate's button is the explicit fallback if this is denied.
  useEffect(() => {
    if (!wantsLandscape()) return undefined;
    const go = () => { enterLandscapeFullscreen(); window.removeEventListener('pointerdown', go); };
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
  const showHand = !exploring && !dockHidden && !anim && !!handSquad;   // no cards while exploring
  const handIsEnemy = handSquad ? sideOfSquad(handSquad) === 'e' : false;

  const frontOf = (sq) => sq?.units.find((u) => u.isFront)?.id || sq?.units[0]?.id || null;
  // during a drag: set the scope HIGHLIGHT (drag.hi) + which field the camera holds on.
  const scopeLevelOf = (card) => { const s = scopeOf(card); return s === 'field' ? 'field' : (s === 'squad' ? 'squad' : 'unit'); };
  liveRef.current.updateDragHi = (g) => {
    // in the hand (dipped) → no target highlight, but KEEP the last aimed side/scope so the
    // camera holds on that field until the card is actually released (autoCam-on drag).
    if (!g.lifted) { g.hi = null; g.valid = false; return; }
    const wantSide = isOffensiveCard(g.card) ? 'e' : 'p';
    const scopeLevel = scopeLevelOf(g.card);
    g.wantSide = wantSide; g.scopeLevel = scopeLevel;
    const zone = g.zone;
    // valid iff hovering the CORRECT side (a creature, a squad's area, or the field).
    g.valid = !!(zone && zone.side === wantSide);
    if (!g.valid) { g.hi = { level: 'side', side: wantSide }; return; }
    // the highlight granularity follows the card's SCOPE, positioned at the hovered zone:
    // field → whole side; squad → the hovered squad; targeted/front → the hovered creature
    // (or the hovered squad's vanguard if the pointer is on squad ground, not a creature).
    if (scopeLevel === 'field') { g.hi = { level: 'side', side: wantSide }; return; }
    if (scopeLevel === 'squad' || zone.level !== 'unit') {
      g.hi = zone.squadId ? { level: 'squad', side: wantSide, squadId: zone.squadId } : { level: 'side', side: wantSide };
      return;
    }
    g.hi = { level: 'unit', side: wantSide, squadId: zone.squadId, unitId: zone.unitId };
  };
  // resolve a drag DROP to a concrete target unit — identical to the click flow (onZone/onTok):
  // a creature → that unit; a squad's area → that squad's vanguard; the field → its first squad's.
  liveRef.current.resolveDrop = (g) => {
    const zone = g.zone; if (!zone || zone.side !== (g.wantSide || (isOffensiveCard(g.card) ? 'e' : 'p'))) return null;
    if (zone.level === 'unit') return zone.unitId;
    if (zone.level === 'squad') return frontOf(allSquads.find((sq) => sq.id === zone.squadId));
    return frontOf((zone.side === 'e' ? snap.enemy : snap.player)[0]);
  };
  liveRef.current.affords = (card) => (selectedSquad?.energyLeft ?? 0) >= (card?.cost ?? 1);
  // where in the current squad's hand would a drop at screen-x insert (0..N-1)?
  liveRef.current.handInsertIdx = (iid, x) => {
    const sq = selectedSquad; if (!sq) return null;
    const N = (sq.hand || []).length; if (N <= 1) return 0;
    const W = window.innerWidth, left = W * 0.30, span = W * 0.40;
    return Math.max(0, Math.min(N - 1, Math.round(((x - left) / span) * (N - 1))));
  };
  // dropped over the bottom HAND band → reorganise the hand (persisted) or just return the card
  liveRef.current.handReorder = (iid, x, y) => {
    if (y < window.innerHeight * 0.58) return false;   // not in the hand zone → let play/return handle it
    const sq = selectedSquad; if (!sq || (sq.hand || []).length <= 1) return true;   // return the card (no reorder)
    reorderHand(sq.id, iid, liveRef.current.handInsertIdx(iid, x) ?? 0);
    return true;
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
      const ff = nextMoveRef.current;   // fast-forwarding (via "Next") to the start of the next move
      if (e.type === 'play') {
        // 1) show the ACTOR doing the action first (it lifts/glows via acting), camera on it.
        // Reaching a play beat ENDS a fast-forward — this is the move the player skipped to, so
        // it animates at the normal pace from here.
        nextMoveRef.current = false;
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
      setAnim((a) => { if (!a) return a; const n = { hp: { ...a.hp }, block: { ...a.block }, acting: a.acting, focus: ff ? a.focus : (recv ?? a.focus) };
        if (e.type === 'damage') { n.hp[e.targetId] = e.hp; if (e.blocked) n.block[e.targetId] = Math.max(0, (n.block[e.targetId] || 0) - e.blocked); }
        else if (e.type === 'block') n.block[e.unitId] = e.total;
        else if (e.type === 'heal' || e.type === 'regen') n.hp[e.targetId ?? e.unitId] = e.hp;
        return n; });
      // while fast-forwarding through the current move we apply state but skip the floating FX
      // (they would all pile up at once); the arrived move animates its FX normally.
      if (!ff) {
        if (e.type === 'damage') { const net = e.amount - (e.blocked || 0); spawnFx(e.targetId, net > 0 ? 'dmg' : 'blocked', net > 0 ? `-${net}` : '🛡', from); }
        else if (e.type === 'block') spawnFx(e.unitId, 'block', `+${e.amount}`);
        else if (e.type === 'heal' || e.type === 'regen') spawnFx(e.targetId ?? e.unitId, 'heal', `+${e.amount ?? ''}`, from);
        else if (e.type === 'miss') spawnFx(e.targetId, 'miss', 'MISS', from);
        else if (e.type === 'death') spawnFx(e.unitId, 'death', '☠');
      }
      schedule(run, ff ? 0 : HIT_MS / sp);
    };
    runRef.current = run;
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

  // FORECAST of the queued plan (effective damage after block + how many enemies it would drop) —
  // an at-a-glance summary of snap.incoming for the Fight decision.
  const forecast = (() => {
    const inc = snap.incoming || {};
    let dmg = 0, kills = 0;
    for (const sq of snap.enemy) for (const u of sq.units) {
      const i = inc[u.id] || 0; if (i <= 0 || u.dead) continue;
      const after = Math.max(0, i - (u.block || 0));
      dmg += Math.min(after, u.hp);
      if (after >= u.hp) kills++;
    }
    return { dmg, kills };
  })();

  // the RUN objective (shown while exploring) + the current first-run coach tip.
  const bossChunk = world ? Object.values(world.grid).find((c) => c.boss) : null;
  const activeTip = (world && !anim && !runOver && !reward && !event)
    ? (exploring && !onbSeen.has('welcome') ? ONB_TIPS.welcome
      : (!exploring && snap.enemy.length && !onbSeen.has('battle') ? ONB_TIPS.battle : null))
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
  const skipFight = () => { timers.current.forEach(clearTimeout); timers.current = []; setFx([]); setTicker(null); setPlayPaused(false); autoPauseRef.current = false; nextMoveRef.current = false; setAnim(null); };
  // "Next": fast-forward the CURRENT move to completion (state only, no FX) and begin animating
  // the next scheduled move at normal speed — unlike Skip, which jumps to the fully-resolved board.
  const advanceToNextMove = () => {
    if (!anim || !runRef.current) return;
    timers.current.forEach(clearTimeout); timers.current = []; setFx([]);
    nextMoveRef.current = true; pausedRef.current = false; setPlayPaused(false);
    runRef.current();
  };

  // ── RUN AWAY: each living squad rolls a d6; ALL must roll ≥ RUN_THRESHOLD to escape ──
  // Squads that ALREADY passed a roll this battle (snap.runPassed) are auto-passed and don't roll.
  const runSquads = snap ? snap.player.filter((sq) => sq.units.some((u) => !u.dead)) : [];
  const runPassedSet = new Set(snap?.runPassed || []);
  const rollNeeded = (sqId) => !runPassedSet.has(sqId);        // a pre-passed squad needs no roll
  const openRunAway = () => { if (anim || snap.outcome) return; setPlanOpen(false); setLogOpen(false); setRunAway({ stage: 'confirm', rolls: {} }); };
  const rollSquad = (sqId) => setRunAway((r) => {
    if (!r || r.rolls[sqId] || !rollNeeded(sqId)) return r;    // already rolled/rolling or pre-passed
    const value = 1 + Math.floor(Math.random() * 6);
    timers.current.push(setTimeout(() => setRunAway((rr) => (rr ? { ...rr, rolls: { ...rr.rolls, [sqId]: { rolling: false, value } } } : rr)), 850));
    return { ...r, rolls: { ...r.rolls, [sqId]: { rolling: true, value } } };
  });
  const rollAllSquads = () => runSquads.filter((sq) => rollNeeded(sq.id)).forEach((sq, i) => timers.current.push(setTimeout(() => rollSquad(sq.id), i * 170)));
  // a squad is "settled" if it's pre-passed OR it has finished rolling
  const runSettled = (sq) => !rollNeeded(sq.id) || (runAway?.rolls[sq.id] && !runAway.rolls[sq.id].rolling);
  const runPassedNow = (sq) => !rollNeeded(sq.id) || (runAway?.rolls[sq.id]?.value >= RUN_THRESHOLD);
  const runDone = !!runAway && runAway.stage === 'roll' && runSquads.length > 0 && runSquads.every(runSettled);
  const runSuccess = runDone && runSquads.every(runPassedNow);
  const needToRoll = runSquads.filter((sq) => rollNeeded(sq.id));   // squads that still must roll this attempt
  const finishRunAway = () => {
    const rolls = {}; needToRoll.forEach((sq) => { rolls[sq.id] = runAway.rolls[sq.id]?.value ?? 0; });
    const res = attemptRunAway(rolls, RUN_THRESHOLD);
    setRunAway(null);
    if (res.success) { onFlee?.(); }        // escaped → the shell switches to exploration
    else { doFight(); }                     // caught → the forfeited round resolves (enemy acts free)
  };
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
          enemy={snap.enemy.map((sq) => ({ ...sq, units: sq.units.map((u) => ({ ...disp(u), incoming: anim ? 0 : (snap.incoming?.[u.id] || 0) })) }))}
          player={snap.player.map((sq) => ({ ...sq, units: sq.units.map(disp) }))}
          sel={sel} onStepUp={stepUp} actingId={anim?.acting} focusId={anim?.focus} onPick={onTok} onZone={onZone} pickRef={pickRef} validRef={validRef} zoneRef={zoneRef} fx={fx} drag={d}
          handVisible={showHand} handSquadId={handSquad?.id || null}
          cardFocusSide={autoCam ? (selectedCard ? (isOffensiveCard(selectedCard) ? 'e' : 'p') : (fly ? sideOfUnit(fly.targetId) : null)) : null}
          autoCam={autoCam} scene={scene} exploring={exploring} world={world} worldFacing={world?.facing || 0} worldTurns={world?.turns || 0} targetHint={targetHint} onInspect={setInspect} camRef={camRef}
          onSelectSquad={(side, squadId) => { setSelId2(null); setDockHidden(false); setSel({ level: 'squad', side, squadId, unitId: null }); }}
          fly={fly} onFlyDone={() => setFly(null)}
          hand={showHand ? {
            station: handSquad,
            selectedIid: selId2, dealKey: snap.dealKey, faceDown: handIsEnemy,
            squadIndex: Math.max(0, dockList.findIndex((sq) => sq.id === handSquad.id)),
            insertIdx: (d && d.insertIdx != null) ? d.insertIdx : null,
            onCardPointerDown: startHandDrag, onInspect: setInspect,
          } : null} />

        {/* TOP-LEFT: exploring → the biome name; fighting → the turn tracker + battle clock */}
        <div className="bTopLeft">
          {exploring
            ? <><div className="bTurn"><b><Icon icon="tabler:compass" /> {BIOMES[scene]?.name || 'Overworld'}</b></div>
                <div className="bTimer wGoldHud" title="Gold"><Icon icon="tabler:coin" />{world?.gold ?? 0}</div>
                <div className={`wGoal${bossChunk?.cleared ? ' done' : ''}`} title="Your run objective">
                  <Icon icon="tabler:star-filled" />{bossChunk?.cleared ? 'Boss defeated!' : 'Defeat the boss'}
                </div></>
            : <>
                <div className="bTurn"><b>Turn {displayTurn}</b></div>
                <div className="bTimer" title="Battle time"><Icon icon="tabler:clock" />{battleClock}</div>
              </>}
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
              <button className={`bCamAuto${scene === 'grid' ? ' on' : ''}`} title="Toggle the admin GRID battlefield (testing)"
                onClick={() => setScene((v) => (v === 'grid' ? (initialScene || 'forest') : 'grid'))}>
                <Icon icon={scene === 'grid' ? 'tabler:grid-dots' : 'tabler:trees'} />
                <span>Scene: {scene === 'grid' ? 'Grid' : 'Biome'}</span>
              </button>
            </div>
          )}
        </div>

        {/* CENTRE: only the outcome banner (the live action text moved to the bottom bar) */}
        {snap.outcome && (
          <div className={`bOutcome center ${snap.outcome === 'p' ? 'win' : 'lose'}`}>
            {snap.outcome === 'p' ? 'Victory' : snap.outcome === 'e' ? 'Defeat' : 'Draw'}
            {onBattleEnd
              ? <button className="bOutcomeBtn" onClick={() => onBattleEnd(snap.outcome === 'p' ? 'win' : 'lose')}>
                  <Icon icon="tabler:map-2" /> {snap.outcome === 'p' ? 'To the overworld' : 'Retreat'}
                </button>
              : <span className="bNew" onClick={() => window.location.reload()} title="New battle"><Icon icon="tabler:refresh" /></span>}
          </div>
        )}
      </div>

      {/* BOTTOM HUD (combat only). During the FIGHT PHASE every planning control is replaced by
          a single centred bar. HIDDEN while exploring — the world travel HUD shows instead. */}
      {!exploring && (
      <div className={`bHud${anim ? ' resolving' : ''}`}>
        {anim ? (
          <div className="bFightBar">
            <div className="bFightText">{ticker ? renderEntry(ticker, false) : <span className="bFightIdle"><Icon icon="tabler:loader-2" /> Resolving…</span>}</div>
            <div className="bFightCtl">
              <button className={`bCtl camToggle${autoCam ? ' on' : ''}`} title={`Auto-camera: ${autoCam ? 'On' : 'Off'}`} onClick={() => setAutoCam((v) => !v)}>
                <Icon icon={autoCam ? 'tabler:camera-bolt' : 'tabler:camera-off'} />
              </button>
              <div className="bSpeed inline">
                <button className={playPaused ? 'on' : ''} title={playPaused ? 'Resume' : 'Pause'} onClick={() => setPlayPaused((v) => !v)}>
                  <Icon icon={playPaused ? 'tabler:player-play-filled' : 'tabler:player-pause-filled'} />
                </button>
                {[0.5, 1, 2].map((sp) => (
                  <button key={sp} className={!playPaused && playSpeed === sp ? 'on' : ''} onClick={() => { setPlaySpeed(sp); setPlayPaused(false); }}>{sp}×</button>
                ))}
              </div>
              <button className="bCtl next" title="Skip to the next move" onClick={advanceToNextMove}><Icon icon="tabler:player-skip-forward-filled" /> Next</button>
              <button className="bCtl skip" title="Skip the whole animation" onClick={skipFight}><Icon icon="tabler:player-track-next-filled" /> Skip</button>
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
                    pill.energy.stunned
                      ? <span className="bStun" title="Stunned by a failed escape — can't act this round"><Icon icon="tabler:bolt-off" /> Stunned</span>
                      : <span className="bEnergy" title={`${pill.energy.energyLeft} of ${pill.energy.maxEnergy} AP`}>
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

            {/* CASTER PICKER (hybrid support-casting): choose which squad member casts your cards.
                The Vanguard shows its formation aura; Support is protected in the back row. */}
            {selectedSquad && selectedSquad.units.filter((u) => !u.dead).length > 1 && (
              <div className="bCaster">
                <span className="bCasterLbl"><Icon icon="tabler:wand" /> Cast with</span>
                {selectedSquad.units.filter((u) => !u.dead).map((u) => (
                  <button key={u.id} className={`bCasterChip${selectedSquad.casterId === u.id ? ' on' : ''}${u.isFront ? ' vg' : ''}`}
                    title={u.isFront ? `${u.name} — Vanguard (front line)` : `${u.name} — Support (protected back row)`}
                    onClick={() => setCaster(planSquadId, u.id)}>
                    <Icon icon={u.isFront ? 'tabler:shield-filled' : 'tabler:user'} />{u.name}
                    {u.isFront && u.formation && (u.formation.attack || u.formation.defense)
                      ? <span className="bCasterAura" title="Formation aura from your Support">{[u.formation.attack ? `+${u.formation.attack} ATK` : '', u.formation.defense ? `+${u.formation.defense} DEF` : ''].filter(Boolean).join(' ')}</span>
                      : null}
                  </button>
                ))}
              </div>
            )}

            <div className="bHudCluster right">
              {forecast.dmg > 0 && (
                <div className="bForecast" title="Damage your queued plan will deal this turn">
                  <span className="bfDmg"><Icon icon="game-icons:crossed-swords" /> {forecast.dmg}</span>
                  {forecast.kills > 0 && <span className="bfKo"><Icon icon="tabler:skull" /> {forecast.kills}</span>}
                </div>
              )}
              <button className="bHudBtn run" title="Attempt to flee this battle" disabled={!!snap.outcome} onClick={openRunAway}>
                <Icon icon="tabler:run" /><span>Run</span>
              </button>
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
                  <div className="bPlanHeadBtns">
                    {snap.logHistory?.length ? (
                      <button className="bCtl sm" title="View combat log" onClick={() => { setPlanOpen(false); setLogOpen(true); }}><Icon icon="game-icons:scroll-quill" /></button>
                    ) : null}
                    <button className="bZoomClose sm" onClick={() => setPlanOpen(false)}><Icon icon="tabler:x" /></button>
                  </div>
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
                  <button className="bCtl auto" title="Auto-plan this turn (fills every squad's remaining AP like the AI)" disabled={!hasUnspent} onClick={autoPlan}><Icon icon="tabler:wand" /> Auto</button>
                  <button className="bCtl" title="Undo last" disabled={!totalQueued} onClick={undoLast}><Icon icon="tabler:arrow-back-up" /> Undo</button>
                  <button className="bCtl" title="Redo" disabled={!snap.canRedo} onClick={redoLast}><Icon icon="tabler:arrow-forward-up" /> Redo</button>
                  <button className="bCtl danger" title="Reset all" disabled={!totalQueued} onClick={() => { setPlanOpen(false); setConfirmReset(true); }}><Icon icon="tabler:refresh" /> Reset</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* EXPLORE HUD — the battlefield IS a chunk of the overworld: travel to adjacent chunks,
          read the minimap, no combat controls until an encounter drops enemies onto the field. */}
      {exploring && world && (
        <>
          <div className="wHint wExploreHint"><b>W</b> forward · <b>A</b>/<b>D</b> turn · <span className="wTownTxt">blue</span>=town · <span className="wEvtTxt">teal</span>=event · <span className="wDunTxt">purple</span>=dungeon · <span style={{ color: '#ff8a6a' }}>red</span>=fight</div>
          <div className="wMapWrap">
            <WorldMini world={world} />
            <div className="wLegend">
              {[['wild', 'Wild'], ['dungeon', 'Dungeon'], ['town', 'Town'], ['event', 'Event']].map(([c, l]) => (
                <span key={c} className="wLegItem"><span className={`wCell ${c}`} />{l}</span>
              ))}
            </div>
          </div>
          <div className="wPad">
            <button className="wUp" title="Forward (W)" onClick={() => onStep('forward')}><Icon icon="tabler:chevron-up" /></button>
            <button className="wLeft wTurn" title="Turn left (A)" onClick={() => onTurn?.(-1)}><Icon icon="tabler:rotate-2" /></button>
            <button className="wRight wTurn" title="Turn right (D)" onClick={() => onTurn?.(1)}><Icon icon="tabler:rotate-clockwise-2" /></button>
          </div>
        </>
      )}

      {/* town = inn + card SHOP · event = a two-way CHOICE. */}
      {event && (
        <div className="wEventWrap" onClick={event.kind === 'town' ? undefined : onCloseEvent}>
          <div className={`wEvent ${event.kind}${event.kind === 'town' ? ' wTown' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="wEventIcon"><Icon icon={event.icon} /></div>
            <h3>{event.title}</h3>
            <p>{event.text}</p>

            {/* TOWN SHOP */}
            {event.kind === 'town' && event.shop && (() => {
              const effSquad = shopSquad || snap.player[0]?.id;
              return (
                <div className="wShopWrap">
                  <div className="wShopSquadPick">
                    <span className="wShopLbl">Buy for:</span>
                    {snap.player.map((sq, i) => (
                      <button key={sq.id} className={`wShopSquad${effSquad === sq.id ? ' sel' : ''}`} onClick={() => setShopSquad(sq.id)}>Squad {i + 1}</button>
                    ))}
                  </div>
                  <div className="wShop">
                    {event.shop.map((it, i) => {
                      const sold = (event.bought || []).includes(i);
                      const afford = (world?.gold ?? 0) >= it.price;
                      return (
                        <div className="wShopItem" key={it.card.id}>
                          <ActionCard card={it.card} />
                          <button className={`wShopBuy${sold ? ' sold' : ''}`} disabled={sold || !afford} onClick={() => onBuyCard?.(i, effSquad)}>
                            {sold ? <><Icon icon="tabler:check" /> Bought</> : <><Icon icon="tabler:coin" /> {it.price}</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* EVENT CHOICES */}
            {event.kind === 'event' && event.choices && (
              <div className="wChoices">
                {event.choices.map((c, i) => (
                  <button key={i} className="wChoiceBtn" onClick={() => onEventChoice?.(c)}><Icon icon={c.icon} /> {c.label}</button>
                ))}
              </div>
            )}

            {/* town leaves via Rest; events resolve on a choice (no extra button) */}
            {event.kind === 'town'
              ? <button className="wEventBtn" onClick={onCloseEvent}><Icon icon="tabler:zzz" /> Rest &amp; Leave</button>
              : !event.choices && <button className="wEventBtn" onClick={onCloseEvent}>Continue</button>}
          </div>
        </div>
      )}

      {/* POST-VICTORY REWARD — pick a card for a squad + optionally capture a defeated creature. */}
      {reward && !runOver && (
        <div className="wEventWrap">
          <div className="wReward" onClick={(e) => e.stopPropagation()}>
            <div className="wRewardHead"><span><Icon icon="tabler:trophy" /> Victory!</span><span className="wGoldTag"><Icon icon="tabler:coin" /> +{reward.gold} gold</span></div>
            <div className="wRewardBody">
              <div className="wRewardCol">
                <h4><Icon icon="tabler:cards" /> Choose a card</h4>
                <div className="wRewardCards">
                  {reward.cards.map((c, i) => (
                    <button key={c.id} className={`wRewardCard${rwPick.cardIdx === i ? ' sel' : ''}`} onClick={() => setRwPick((p) => ({ ...p, cardIdx: i }))}>
                      <ActionCard card={c} />
                    </button>
                  ))}
                </div>
                <h4><Icon icon="tabler:users-group" /> Give it to</h4>
                <div className="wRewardSquads">
                  {snap.player.map((sq, i) => {
                    const effId = rwPick.squadId || snap.player[0]?.id;
                    return (
                      <button key={sq.id} className={`wRewardSquad${effId === sq.id ? ' sel' : ''}`} onClick={() => setRwPick((p) => ({ ...p, squadId: sq.id }))}>
                        <b>Squad {i + 1}</b><span>{sq.units.map((u) => u.name).join(', ')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {reward.captable?.length > 0 && (
                <div className="wRewardCol">
                  <h4><Icon icon="tabler:pokeball" /> Capture a creature? <em>(optional)</em></h4>
                  <div className="wRewardCaps">
                    {reward.captable.map((cr, i) => {
                      const art = sizedPortrait(cr.portrait, cr.form) || (cr.biology ? creatureArt({ id: cr.id, biology: cr.biology, family: cr.family, subtypes: cr.subtypes }) : null);
                      return (
                        <button key={i} className={`wRewardCap${rwPick.capIdx === i ? ' sel' : ''}`} onClick={() => setRwPick((p) => ({ ...p, capIdx: p.capIdx === i ? null : i }))}>
                          <span className="wRewardCapArt">{art ? <img src={art} alt="" /> : <Icon icon="tabler:paw" />}</span>
                          <em>{cr.name}</em>
                          {rwPick.capIdx === i && <span className="wRewardCapChk"><Icon icon="tabler:check" /></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="wRewardBtns">
              <button className="wRewardSkip" onClick={() => onSkipReward?.()}>Skip card</button>
              <button className="wRewardTake" onClick={() => onCollectReward?.({ card: reward.cards[rwPick.cardIdx], squadId: rwPick.squadId || snap.player[0]?.id, capture: rwPick.capIdx != null ? reward.captable[rwPick.capIdx] : null })}>
                <Icon icon="tabler:check" /> Collect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RUN OVER — boss beaten (win) or party wiped (lose). */}
      {runOver && (
        <div className="wEventWrap">
          <div className={`wEvent ${runOver === 'win' ? 'town' : ''} wRunOver`} onClick={(e) => e.stopPropagation()}>
            <div className="wEventIcon"><Icon icon={runOver === 'win' ? 'tabler:crown' : 'tabler:skull'} /></div>
            <h3>{runOver === 'win' ? 'Run Complete!' : 'Your Party Fell'}</h3>
            <p>{runOver === 'win'
              ? `You conquered the dungeon and won the run with ${world?.gold ?? 0} gold.`
              : 'Your squads were overwhelmed. The world resets for a new attempt.'}</p>
            <button className="wEventBtn" onClick={() => onNewRun?.()}><Icon icon="tabler:refresh" /> New Run</button>
          </div>
        </div>
      )}

      {/* FIRST-RUN coach tip (dismissed once each, persisted). */}
      {activeTip && (
        <div className={`wCoach ${activeTip.id}`}>
          <div className="wCoachIcon"><Icon icon={activeTip.icon} /></div>
          <div className="wCoachBody">
            <h4>{activeTip.title}</h4>
            <p>{activeTip.body}</p>
          </div>
          <button className="wCoachBtn" onClick={() => markOnb(activeTip.id)}><Icon icon="tabler:check" /> Got it</button>
        </div>
      )}

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

      {/* RUN AWAY — confirm, then roll a d6 per squad (need ≥ RUN_THRESHOLD to escape) */}
      {runAway && (
        <div className="bInspect" onClick={() => runAway.stage === 'confirm' && setRunAway(null)}>
          <div className="bConfirm run" onClick={(e) => e.stopPropagation()}>
            {runAway.stage === 'confirm' ? (
              <>
                <h3><Icon icon="tabler:run" /> Run away?</h3>
                <p>Each squad must roll <b>{RUN_THRESHOLD} or higher</b> on a d6 to escape. This <b>forfeits the turn</b>, and any squad that <b>fails</b> is <b>Stunned</b> next round. Flee only if <b>every</b> squad makes it.</p>
                <div className="bConfirmBtns">
                  <button className="bCtl wide" onClick={() => setRunAway(null)}>Stay and fight</button>
                  <button className="bCtl fight wide" onClick={() => setRunAway({ stage: 'roll', rolls: {} })}><Icon icon="tabler:dice" /> Roll to flee</button>
                </div>
              </>
            ) : (
              <>
                <h3><Icon icon="tabler:dice" /> Rolling to flee <em>· need {RUN_THRESHOLD}+</em></h3>
                <div className="bRunList">
                  {runSquads.map((sq, i) => {
                    const prePassed = !rollNeeded(sq.id);          // already escaped a prior attempt
                    const r = runAway.rolls[sq.id];
                    const rolled = r && !r.rolling;
                    const pass = prePassed ? true : (rolled ? r.value >= RUN_THRESHOLD : null);
                    const shown = r ? (r.rolling ? ((dieSpin + i) % 6) + 1 : r.value) : 6;
                    return (
                      <div key={sq.id} className={`bRunRow${prePassed || pass ? ' pass' : rolled ? ' fail' : ''}`}>
                        <span className="bRunSq">Ally Squad {snap.player.findIndex((p) => p.id === sq.id) + 1}</span>
                        <DieFace value={prePassed ? 6 : shown} rolling={!!r?.rolling} pass={prePassed ? true : pass} />
                        {prePassed ? <span className="bRunTag ok">Already out</span>
                          : !r ? <button className="bCtl sm" onClick={() => rollSquad(sq.id)}>Roll</button>
                            : r.rolling ? <span className="bRunTag rolling">…</span>
                              : <span className={`bRunTag ${pass ? 'ok' : 'no'}`}>{pass ? 'Escaped' : 'Caught'}</span>}
                      </div>
                    );
                  })}
                </div>
                {!runDone && Object.keys(runAway.rolls).length === 0 && (
                  <div className="bConfirmBtns">
                    <button className="bCtl wide" onClick={() => setRunAway(null)}>Cancel</button>
                    <button className="bCtl fight wide" onClick={rollAllSquads}><Icon icon="tabler:dice" /> Roll all</button>
                  </div>
                )}
                {runDone && (
                  <>
                    <p className={`bRunVerdict ${runSuccess ? 'ok' : 'no'}`}>
                      {runSuccess ? <><Icon icon="tabler:check" /> The party slips away!</> : <><Icon icon="tabler:alert-triangle" /> Some squads were caught — brace for a free enemy round.</>}
                    </p>
                    <div className="bConfirmBtns">
                      <button className="bCtl fight wide" onClick={finishRunAway}>{runSuccess ? 'Escape to the overworld' : 'Take the hit'}</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* mobile: portrait gate — a BUTTON that forces fullscreen + landscape (the 3-D board
          needs the width). Tapping it is the user gesture the orientation lock requires. */}
      <div className="bRotateGate">
        <Icon icon="tabler:device-mobile-rotated" />
        <p>This game plays in <b>landscape</b>.</p>
        <button className="bRotateBtn" onClick={enterLandscapeFullscreen}>
          <Icon icon="tabler:maximize" /> Enter fullscreen &amp; rotate
        </button>
        <small>If your device doesn't rotate on its own, turn it sideways.</small>
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

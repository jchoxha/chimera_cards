// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/Lab — the GENERATION + FUSION testbed (lab.html). Two tabs:   ║
// ║   🎲 Generate — spin the wheels for a creature's FATE (rarity / form /    ║
// ║      evolution line) and either roll its IDENTITY too or read it out of a ║
// ║      text prompt. The point is to compare the two sources side by side.   ║
// ║   🧬 Fuse — pick any two creatures (roster or generated) and fuse them;   ║
// ║      order matters, and the result can itself be fused again.             ║
// ║                                                                           ║
// ║ A sandbox: nothing here writes to the player's collection.                ║
// ║ UI-only — all generation logic lives in lab/generate.js + engine/.        ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useRef, useState } from 'react';
import SpinWheel from './SpinWheel.jsx';
import { generateCreature, poolForCreature } from './generate.js';
import { WHEELS, spinWheel, rarityProfile } from '../engine/content/wheels.js';
import { fuseCreatures, fuseAxes } from '../engine/content/fuse.js';
import { ROSTER, buildRosterCreature } from '../data/roster.js';
import { rosterPool } from '../app/pools.js';
import { CardFace, creatureToFace } from '../ui/combat/creatureVisuals.jsx';
import { ATTUNEMENT_COLOR } from '../data/axisIcons.js';
import { biologyDisplayName } from '../data/biologyNaming.js';
import { attunementDisplayName } from '../data/synthesis.js';
import { APP_VERSION } from '../version.js';

const RARITY_COLOR = {
  common: '#8d8d8d', uncommon: '#4d9e57', rare: '#3f7fd0', epic: '#9257c9',
  mythic: '#c9553f', legendary: '#d79a2b', godly: '#f2e08a',
};
const SPIN_MS = 3250;

/** One-line taxonomy readout used under every card. */
function typeLine(c) {
  const fams = [c?.family, c?.manifestation].filter(Boolean);
  return `${attunementDisplayName(c?.attunement ?? [])} ${biologyDisplayName(c?.biology ?? [], fams, c?.subtypes ?? [])}`.trim();
}

function StatRow({ c }) {
  if (!c?.stats) return null;
  const s = c.stats;
  return (
    <div className="labStats">
      <span>HP <b>{c.maxHp}</b></span><span>MGT <b>{s.might}</b></span><span>GRD <b>{s.guard}</b></span>
      <span>FOC <b>{s.focus}</b></span><span>RES <b>{s.resolve}</b></span><span>SPD <b>{s.speed}</b></span><span>EVA <b>{s.eva}</b></span>
    </div>
  );
}

function DeckList({ deck = [], title = 'Starting deck' }) {
  if (!deck.length) return null;
  return (
    <div className="labDeck">
      <div className="labDeckHead">{title} <span>({deck.length})</span></div>
      <div className="labDeckCards">
        {deck.map((card, i) => (
          <span key={i} className={`labChip${card.fusionPower ? ' isPower' : ''}`}>
            <b>{card.cost}</b> {card.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A generated/fused creature preview: the real card + its numbers + its deck. */
function CreaturePanel({ c, children }) {
  if (!c) return null;
  return (
    <div className="labResult">
      <div className="labCardWrap"><CardFace f={creatureToFace(c)} side="ally" /></div>
      <div className="labMeta">
        <div className="labName">{c.name}</div>
        <div className="labType">{typeLine(c)}</div>
        {c.rarity && <span className="labRarity" style={{ '--rc': RARITY_COLOR[c.rarity] ?? '#888' }}>{c.rarity}</span>}
        {c.gen && (
          <div className="labFacts">
            <span>form <b>{c.gen.form}</b></span>
            <span>evolution <b>{c.gen.stage}/{c.gen.stages}</b>{c.gen.isFinal ? ' (final)' : ''}</span>
            <span>pool <b>{c.gen.poolSize}</b></span>
          </div>
        )}
        <StatRow c={c} />
        {children}
        <DeckList deck={c.deck} />
      </div>
    </div>
  );
}

// ── Generate tab ───────────────────────────────────────────────────────────

const MODES = [
  { id: 'wheel', label: '🎲 Wheels only', hint: 'Everything is rolled — identity included.' },
  { id: 'mixed', label: '✨ Prompt + wheels', hint: 'The prompt sets IDENTITY, the wheels set FATE.' },
  { id: 'prompt', label: '✍️ Prompt-led', hint: 'Identity from text; rarity/form/evolutions still spun.' },
];

const EXAMPLES = [
  'a venomous swamp serpent that spits acid',
  'an armoured knight sworn to the dawn',
  'a drifting fungal horror wreathed in spores',
  'a storm-touched wolf with lightning in its fur',
];

function GenerateTab({ onKeep }) {
  const [mode, setMode] = useState('mixed');
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [spins, setSpins] = useState({});
  const [spinKey, setSpinKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [creature, setCreature] = useState(null);
  const timer = useRef(null);

  // Which wheels are live: identity wheels only matter when no prompt drives it.
  const keys = mode === 'wheel' ? ['rarity', 'form', 'evolutions', 'body', 'attunement'] : ['rarity', 'form', 'evolutions'];

  const spin = () => {
    if (busy) return;
    const rolled = {};
    for (const k of keys) rolled[k] = spinWheel(WHEELS[k]);
    setSpins(rolled);
    setSpinKey((k) => k + 1);
    setBusy(true);
    setCreature(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCreature(generateCreature({ mode, prompt, spins: rolled }));
      setBusy(false);
    }, SPIN_MS);
  };

  const colorFor = (key) => (value) => (
    key === 'rarity' ? (RARITY_COLOR[value] ?? '#888')
      : key === 'attunement' ? (ATTUNEMENT_COLOR[value] ?? '#888')
        : null
  );

  return (
    <div className="labTab">
      <div className="labControls">
        <div className="labModes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={`labMode${mode === m.id ? ' on' : ''}`} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="labHint">{MODES.find((m) => m.id === mode)?.hint}</div>

        {mode !== 'wheel' && (
          <div className="labPrompt">
            <textarea
              value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
              placeholder="Describe a creature — its body, element, weapons or anatomy…"
            />
            <div className="labExamples">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="labEx" onClick={() => setPrompt(ex)}>{ex.slice(0, 28)}…</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="labWheels">
        {keys.map((k) => (
          <SpinWheel
            key={k} title={k} segments={WHEELS[k]} targetIndex={spins[k]?.index ?? null}
            spinKey={spinKey} colorFor={colorFor(k)}
            result={busy ? '…' : spins[k]?.label}
          />
        ))}
      </div>

      <div className="labActions">
        <button type="button" className="labGo" onClick={spin} disabled={busy}>
          {busy ? 'Spinning…' : '🎲 SPIN & GENERATE'}
        </button>
        {creature && (
          <button type="button" className="labKeep" onClick={() => onKeep(creature)}>＋ Keep for fusion</button>
        )}
      </div>

      {creature && <CreaturePanel c={creature} />}
    </div>
  );
}

// ── Fuse tab ───────────────────────────────────────────────────────────────

function Picker({ label, options, value, onChange }) {
  return (
    <label className="labPick">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">— choose —</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
      </select>
    </label>
  );
}

function FuseTab({ stock, onKeep }) {
  const roster = useMemo(() => ROSTER.map((r) => ({ key: `r:${r.id}`, name: r.name, get: () => buildRosterCreature(r, rosterPool(r)) })), []);
  const options = useMemo(() => [
    ...roster,
    ...stock.map((c, i) => ({ key: `s:${i}`, name: `★ ${c.name}`, get: () => c })),
  ], [roster, stock]);

  const [aKey, setAKey] = useState(options[0]?.key ?? '');
  const [bKey, setBKey] = useState(options[1]?.key ?? '');
  const [fused, setFused] = useState(null);

  const resolve = (key) => options.find((o) => o.key === key)?.get() ?? null;
  const A = resolve(aKey), B = resolve(bKey);

  const doFuse = () => {
    if (!A || !B) return;
    setFused(fuseCreatures(A, B, { primaryPool: poolForCreature(A), secondaryPool: poolForCreature(B) }));
  };
  const swap = () => { setAKey(bKey); setBKey(aKey); setFused(null); };

  const axes = A && B ? fuseAxes(A, B) : null;

  return (
    <div className="labTab">
      <div className="labFuseBar">
        <Picker label="Primary (donates body + size)" options={options} value={aKey} onChange={(k) => { setAKey(k); setFused(null); }} />
        <button type="button" className="labSwap" onClick={swap} title="Order matters — swap the parents">⇄</button>
        <Picker label="Secondary (donates features)" options={options} value={bKey} onChange={(k) => { setBKey(k); setFused(null); }} />
        <button type="button" className="labGo" onClick={doFuse} disabled={!A || !B}>🧬 FUSE</button>
      </div>

      {axes && (
        <div className="labAxes">
          <span>body <b>{(axes.biology ?? []).join(' | ')}</b></span>
          <span>kit <b>{[axes.class?.[0], axes.family, axes.manifestation].filter(Boolean).join(' + ') || '—'}</b></span>
          <span>factors <b>{[...(axes.weapons ?? []), ...(axes.anatomy ?? [])].join(', ') || '—'}</b></span>
          <span>element <b>{(axes.attunement ?? []).join(' + ')}</b></span>
        </div>
      )}

      <div className="labParents">
        {[A, B].map((p, i) => p && (
          <div key={i} className="labParent">
            <div className="labParentTag">{i === 0 ? 'PRIMARY' : 'SECONDARY'}</div>
            <div className="labCardWrap sm"><CardFace f={creatureToFace(p)} side="ally" /></div>
            <div className="labType">{typeLine(p)}</div>
            <StatRow c={p} />
          </div>
        ))}
      </div>

      {fused && (
        <CreaturePanel c={fused}>
          <div className="labPower">
            <span className="labPowerTag">FUSION POWER</span>
            <b>{fused.fusion.power.name}</b>
            <span className="labPowerMeta">{fused.fusion.power.attunement} · cost {fused.fusion.power.cost}</span>
          </div>
          <button type="button" className="labKeep" onClick={() => onKeep(fused)}>＋ Keep (fuse it again)</button>
        </CreaturePanel>
      )}
    </div>
  );
}

// ── shell ──────────────────────────────────────────────────────────────────

export default function Lab() {
  const [tab, setTab] = useState('generate');
  const [stock, setStock] = useState([]);
  const keep = (c) => setStock((s) => (s.some((x) => x.id === c.id) ? s : [...s, c]));

  return (
    <div className="lab">
      <header className="labHead">
        <h1>Creature Lab</h1>
        <div className="labTabs">
          <button type="button" className={tab === 'generate' ? 'on' : ''} onClick={() => setTab('generate')}>🎲 Generate</button>
          <button type="button" className={tab === 'fuse' ? 'on' : ''} onClick={() => setTab('fuse')}>🧬 Fuse</button>
        </div>
        <div className="labVer">
          {stock.length > 0 && <span className="labStock">★ {stock.length} kept</span>}
          <a href="./index.html">← hub</a>
          <span>{APP_VERSION}</span>
        </div>
      </header>
      {tab === 'generate' ? <GenerateTab onKeep={keep} /> : <FuseTab stock={stock} onKeep={keep} />}
    </div>
  );
}

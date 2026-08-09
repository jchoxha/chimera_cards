// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/AnchorEditor — tune WHERE parts attach on each body, by drag.  ║
// ║                                                                            ║
// ║ BODY_ANCHORS (partsRig.js) was hand-guessed against imaginary bodies, so   ║
// ║ parts sit wrong. This is the art-agnostic half of the quality problem:     ║
// ║ even perfect RD sprites land in the wrong place until anchors are real.    ║
// ║ Here you drag each slot's handle on an ACTUAL body and watch a sample part ║
// ║ follow, then Copy the tuned BODY_ANCHORS JSON to commit.                    ║
// ║                                                                            ║
// ║ Non-destructive: edits live in component state + a live preview via        ║
// ║ composeCreature's anchorOverride; nothing writes to disk until you paste   ║
// ║ the copied JSON into partsRig.js.                                          ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useRef, useState } from 'react';
import { BODY_ANCHORS, SLOTS } from '../data/partsRig.js';
import PartsPortrait from '../ui/PartsPortrait.jsx';

const BODY_TYPES = ['Beast', 'Humanoid', 'Aberration'];

// A representative creature per body type whose factors exercise EVERY slot, so
// dragging an anchor visibly moves a real part. (anatomy/weapons chosen to hit
// wing/tail/limb/horn/face/held/surface/fx.)
const SAMPLE = {
  Beast: { id: 'ae-beast', name: 'Sample', biology: ['Beast'], family: 'Draconic', attunement: ['Fire'],
    anatomy: ['Wings', 'Tail', 'Claws', 'Horns', 'Teeth', 'Hide', 'Breath'] },
  Humanoid: { id: 'ae-human', name: 'Sample', biology: ['Humanoid'], class: ['Warrior'], attunement: ['Physical'],
    weapons: ['Hammer', 'Shield'], anatomy: ['Horns'] },
  Aberration: { id: 'ae-aberr', name: 'Sample', biology: ['Aberration'], manifestation: 'Eldritch', attunement: ['Void'],
    anatomy: ['Tentacle', 'Eye', 'Tail', 'Shard', 'Miasma'] },
};

// Slots that carry a positional anchor (body itself is always centred).
const SLOT_KEYS = Object.keys(SLOTS).filter((s) => s !== 'body');

const clamp01 = (n) => Math.max(0, Math.min(1, n));

export default function AnchorEditor() {
  const [bodyType, setBodyType] = useState('Beast');
  // deep clone the committed anchors so edits never mutate the frozen source
  const [anchors, setAnchors] = useState(() => structuredClone(BODY_ANCHORS));
  const [active, setActive] = useState(null);      // slot currently being dragged
  const [copied, setCopied] = useState(false);
  const stageRef = useRef(null);
  const dragging = useRef(null);

  const bodyAnchors = anchors[bodyType];
  const sample = SAMPLE[bodyType];

  const setAnchor = (slot, x, y) => {
    setAnchors((prev) => {
      const next = structuredClone(prev);
      next[bodyType][slot] = [Math.round(clamp01(x) * 1000) / 1000, Math.round(clamp01(y) * 1000) / 1000];
      return next;
    });
  };

  // pointer → normalised 0..1 within the square stage
  const toNorm = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  };

  const onDown = (slot) => (e) => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    dragging.current = slot; setActive(slot);
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const [x, y] = toNorm(e);
    setAnchor(dragging.current, x, y);
  };
  const onUp = () => { dragging.current = null; };

  const resetType = () => setAnchors((prev) => {
    const next = structuredClone(prev); next[bodyType] = structuredClone(BODY_ANCHORS[bodyType]); return next;
  });

  const json = useMemo(() => {
    // pretty-print in the exact BODY_ANCHORS shape for a clean paste
    const body = (bt) => {
      const rows = SLOT_KEYS.map((s) => `${s}: [${anchors[bt][s][0]}, ${anchors[bt][s][1]}]`);
      // group ~3 per line like the source
      const lines = [];
      for (let i = 0; i < rows.length; i += 3) lines.push('    ' + rows.slice(i, i + 3).join(', ') + ',');
      return `  ${bt}: {\n${lines.join('\n')}\n  },`;
    };
    return `export const BODY_ANCHORS = Object.freeze({\n${BODY_TYPES.map(body).join('\n')}\n});`;
  }, [anchors]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked — the textarea below is selectable as a fallback */ }
  };

  return (
    <div className="labTab">
      <div className="aeTop">
        <div className="labModes">
          {BODY_TYPES.map((bt) => (
            <button key={bt} type="button" className={`labMode${bodyType === bt ? ' on' : ''}`} onClick={() => setBodyType(bt)}>{bt}</button>
          ))}
        </div>
        <button type="button" className="labArtBtn ghost" onClick={resetType}>↺ reset {bodyType}</button>
        <button type="button" className="labGo" onClick={copy}>{copied ? '✓ copied' : '⧉ Copy anchors JSON'}</button>
      </div>
      <div className="aeHint">
        Drag a handle to move where that slot's part attaches on the <b>{bodyType}</b> body. A sample
        part follows each handle. When it looks right, Copy the JSON and paste it over
        <code> BODY_ANCHORS</code> in <code>src/data/partsRig.js</code>.
      </div>

      <div className="aeWork">
        <div className="aeStage" ref={stageRef} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <PartsPortrait creature={sample} anchorOverride={anchors} />
          {/* draggable handles, one per slot */}
          {SLOT_KEYS.map((slot) => {
            const [x, y] = bodyAnchors[slot];
            return (
              <button
                key={slot} type="button"
                className={`aeHandle${active === slot ? ' on' : ''}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                onPointerDown={onDown(slot)}
                title={slot}
              >
                <span>{slot}</span>
              </button>
            );
          })}
        </div>

        <div className="aeSide">
          <div className="psSheetHead">Anchors — {bodyType}</div>
          <table className="aeTable">
            <tbody>
              {SLOT_KEYS.map((s) => (
                <tr key={s} className={active === s ? 'on' : ''}>
                  <td>{s}</td>
                  <td>{bodyAnchors[s][0].toFixed(2)}</td>
                  <td>{bodyAnchors[s][1].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <textarea className="aeJson" readOnly value={json} onFocus={(e) => e.target.select()} />
        </div>
      </div>
    </div>
  );
}

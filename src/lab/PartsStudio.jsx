// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/PartsStudio — bake creature part sprites FROM THE BROWSER.    ║
// ║                                                                           ║
// ║ The whole pipeline that scripts/gen_parts.py + sprite_cutout.py do on a   ║
// ║ dev machine, done on the deployed static site (phone included):           ║
// ║   pick a part → get a SHEET (generate, or upload your own art)            ║
// ║   → click the cell you like → chroma-key + autocrop in-canvas             ║
// ║   → see it live on a real creature → save locally → publish to the repo.  ║
// ║                                                                           ║
// ║ Sheets, not single images, because coherence is the hard part: one        ║
// ║ request returns a grid of variants of the SAME part, consistent by        ║
// ║ construction. UPLOAD matters just as much — it takes hand-drawn or        ║
// ║ commissioned sheets, and it sidesteps cross-origin canvas restrictions.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useRef, useState } from 'react';
import { PARTS } from '../data/partsRig.js';
import { cellRect, cutCell, loadImage } from './cutout.js';
import { effectiveParts, localParts, saveLocalPart, deleteLocalPart, loadGh, saveGh, publishPart } from './partsStore.js';
import { pollinationsUrl } from '../ai/imageProvider.js';
import { ART_STYLE_VARIANT_B } from '../data/artStyle.js';
import { PART_SUBJECT } from '../data/partSubjects.js';
import PartsPortrait from '../ui/PartsPortrait.jsx';

const SUBJECT = PART_SUBJECT;   // single source of truth (shared with the RD bake script)

const sheetClause = (n, cols, rows) =>
  `A reference SHEET of ${n} DIFFERENT design variations of the SAME subject, arranged in a neat `
  + `${cols}x${rows} grid, evenly spaced, each variation fully separate from the others and not `
  + 'touching or overlapping. Plain flat SOLID BRIGHT MAGENTA (RGB 255,0,255) background everywhere, '
  + 'including BETWEEN the items and around every edge — a single uniform colour, no gradient, no '
  + 'shadow, no vignette. The object is a single isolated element on that magenta: NO ground, NO '
  + 'scene, NO creature attached, NO text, NO labels, NO grid lines, NO borders.';

const sheetPrompt = (partId, cols, rows) =>
  `Subject: ${SUBJECT[partId] ?? partId}.\n\n${sheetClause(cols * rows, cols, rows)}\n\nStyle: ${ART_STYLE_VARIANT_B}`;

/** Sample creatures so a cut part can be judged in context, not in isolation. */
const PREVIEW = {
  body: { id: 'pv1', name: 'Preview', biology: ['Beast'], family: 'Mammalian', attunement: ['Fire'], anatomy: ['Teeth'] },
  humanoid: { id: 'pv2', name: 'Preview', biology: ['Humanoid'], class: ['Warrior'], attunement: ['Physical'], weapons: ['Hammer', 'Shield'] },
  aberration: { id: 'pv3', name: 'Preview', biology: ['Aberration'], manifestation: 'Eldritch', attunement: ['Void'], anatomy: ['Tentacle', 'Eye'] },
};

function previewFor(part) {
  const base = part.match?.body === 'Humanoid' || part.id.startsWith('w-') ? PREVIEW.humanoid
    : part.match?.body === 'Aberration' ? PREVIEW.aberration : PREVIEW.body;
  const f = part.match?.factor;
  if (!f) return base;
  // make sure the preview creature actually carries this factor
  const slotKey = part.id.startsWith('w-') ? 'weapons' : 'anatomy';
  return { ...base, [slotKey]: [...new Set([...(base[slotKey] ?? []), f])] };
}

export default function PartsStudio() {
  const [partId, setPartId] = useState('wings');
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [sheet, setSheet] = useState(null);       // { src, img }
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [cut, setCut] = useState(null);           // { dataUrl, width, height, quality }
  const [baked, setBaked] = useState(() => localParts());
  const [gh, setGhState] = useState(loadGh);
  const [showGh, setShowGh] = useState(false);
  const fileRef = useRef(null);

  const part = useMemo(() => PARTS.find((p) => p.id === partId) ?? PARTS[0], [partId]);
  const published = effectiveParts();
  const preview = useMemo(() => previewFor(part), [part]);

  // A creature that renders the freshly-cut part without touching stored state.
  const previewBaked = useMemo(
    () => ({ ...published, ...(cut ? { [partId]: cut.dataUrl } : {}) }),
    [published, cut, partId],
  );

  const loadSheet = async (src, { crossOrigin } = {}) => {
    setErr(''); setCut(null); setBusy('loading sheet…');
    try {
      const img = await loadImage(src, { crossOrigin });
      setSheet({ src, img });
    } catch {
      setErr('could not load that image');
    } finally { setBusy(''); }
  };

  const generate = async () => {
    setErr(''); setCut(null); setSheet(null); setBusy('generating a sheet — 15–30s…');
    const url = pollinationsUrl({ prompt: sheetPrompt(partId, cols, rows), width: 1024, height: 768, seed: Math.floor(Math.random() * 1e9) });
    try {
      const img = await loadImage(url, { crossOrigin: 'anonymous' });
      setSheet({ src: url, img });
    } catch {
      setErr('generation failed (free tier is ~1 image/15s — wait and retry, or upload a sheet)');
    } finally { setBusy(''); }
  };

  const onUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => loadSheet(r.result, { crossOrigin: null });
    r.readAsDataURL(f);
  };

  const pickCell = (i) => {
    if (!sheet) return;
    setErr('');
    try {
      const rect = cellRect(sheet.img.naturalWidth || sheet.img.width, sheet.img.naturalHeight || sheet.img.height, cols, rows, i);
      setCut(cutCell(sheet.img, rect));
    } catch (e) {
      setCut(null);
      setErr(e.message === 'TAINTED'
        ? 'the browser blocked reading those pixels (cross-origin). Save the sheet and use “Upload a sheet” instead.'
        : e.message);
    }
  };

  const keepLocal = () => {
    try { setBaked(saveLocalPart(partId, cut.dataUrl)); setErr(''); }
    catch (e) { setErr(e.message); }
  };
  const dropLocal = () => setBaked(deleteLocalPart(partId));

  const publish = async () => {
    setBusy('publishing to GitHub…'); setErr('');
    try {
      await publishPart(partId, cut.dataUrl, gh);
      setBusy('published ✓ — live for everyone after the deploy finishes');
      setTimeout(() => setBusy(''), 6000);
    } catch (e) { setErr(e.message); setBusy(''); }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = cut.dataUrl; a.download = `${partId}.png`; a.click();
  };

  const status = (p) => (localParts()[p.id] ? '★' : published[p.id] ? '✓' : '·');

  return (
    <div className="labTab">
      <div className="psTop">
        <label className="labPick">
          <span>Part ({PARTS.length} in the rig)</span>
          <select value={partId} onChange={(e) => { setPartId(e.target.value); setCut(null); setSheet(null); }}>
            {PARTS.map((p) => <option key={p.id} value={p.id}>{status(p)} {p.id}</option>)}
          </select>
        </label>
        <label className="labPick"><span>Grid</span>
          <span className="psGrid">
            <input type="number" min="1" max="4" value={cols} onChange={(e) => setCols(+e.target.value || 1)} />
            ×
            <input type="number" min="1" max="4" value={rows} onChange={(e) => setRows(+e.target.value || 1)} />
          </span>
        </label>
        <button type="button" className="labGo" onClick={generate} disabled={!!busy}>🎨 Generate sheet</button>
        <button type="button" className="labArtBtn" onClick={() => fileRef.current?.click()}>⬆ Upload a sheet</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
        <button type="button" className="labArtBtn ghost" onClick={() => setShowGh((s) => !s)}>⚙ Publish settings</button>
      </div>

      <div className="psHint">
        Sheets beat single images: one request returns several variants of the <b>same</b> part, so they
        share a style. Upload works too — hand-drawn or commissioned art on a flat magenta background.
      </div>

      {showGh && (
        <div className="psGh">
          {['owner', 'repo', 'branch'].map((k) => (
            <label key={k}><span>{k}</span>
              <input value={gh[k]} onChange={(e) => { const n = { ...gh, [k]: e.target.value }; setGhState(n); saveGh(n); }} />
            </label>
          ))}
          <label><span>token (repo scope)</span>
            <input type="password" value={gh.token} placeholder="ghp_…"
              onChange={(e) => { const n = { ...gh, token: e.target.value }; setGhState(n); saveGh(n); }} />
          </label>
          <p>Stored only in this browser. Never bundled or committed.</p>
        </div>
      )}

      {busy && <div className="psBusy">{busy}</div>}
      {err && <div className="labArtErr">⚠ {err}</div>}

      <div className="psWork">
        <div className="psSheet">
          {sheet ? (
            <>
              <div className="psSheetHead">Click the cell you want</div>
              <div className="psSheetWrap" style={{ '--cols': cols, '--rows': rows }}>
                <img src={sheet.src} alt="generated sheet" />
                <div className="psCells">
                  {Array.from({ length: cols * rows }, (_, i) => (
                    <button key={i} type="button" onClick={() => pickCell(i)} title={`cell ${i + 1}`} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="psEmpty">
              <p><b>{partId}</b></p>
              <p className="psSubject">{SUBJECT[partId] ?? '—'}</p>
              <p>Generate a sheet, or upload one.</p>
            </div>
          )}
        </div>

        <div className="psResult">
          <div className="psSheetHead">Cut part</div>
          <div className="psCut">
            {cut ? <img src={cut.dataUrl} alt="cut part" /> : <span className="psEmptyCut">nothing cut yet</span>}
          </div>
          {cut && (
            <>
              <div className="psQuality">
                {cut.width}×{cut.height}px
                {cut.quality.touchesEdge && <em> · touches the cell edge — may be clipped</em>}
                {cut.quality.coverage > 0.85 && <em> · barely keyed — is the background flat magenta?</em>}
              </div>
              <div className="psActions">
                <button type="button" className="labKeep" onClick={keepLocal}>✓ Use it (this device)</button>
                <button type="button" className="labArtBtn" onClick={publish} disabled={!gh.token}>⬆ Publish to repo</button>
                <button type="button" className="labArtBtn ghost" onClick={download}>⬇ PNG</button>
              </div>
            </>
          )}

          <div className="psSheetHead">On a creature</div>
          <figure className="labParts"><PartsPortrait creature={preview} bakedOverride={previewBaked} /></figure>
          {baked[partId] && (
            <button type="button" className="labArtBtn ghost" onClick={dropLocal}>✕ remove local “{partId}”</button>
          )}
        </div>
      </div>
    </div>
  );
}

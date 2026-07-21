// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/AiSettings — the player-facing choice of AI backend: the       ║
// ║ Claude API (online) vs an on-device model that runs in the browser        ║
// ║ (WebGPU). Lets the user download + select a local model with progress,    ║
// ║ and run a quick "Test generation" to confirm on-device inference works.   ║
// ║ Self-styled (inline) so it drops into ANY page (hub, forge, editor) —      ║
// ║ importing it does NOT load the heavy WebLLM runtime (only "Download" does).║
// ╚══════════════════════════════════════════════════════════════════╝
import { useState } from 'react';
import { getProviderId, setProviderId, getProvider, generateText, isNativeShell } from './provider.js';
import { MODELS, getLocalModelId, setLocalModelId, webgpuAvailable, isEngineReady, ensureEngine } from './webllm.js';

const box = { display: 'grid', gap: 10, padding: 14, borderRadius: 10, border: '1px solid rgba(200,170,90,.35)', background: 'rgba(20,16,26,.55)', color: '#efe6d6', maxWidth: 520, font: '14px/1.4 system-ui, sans-serif' };
const btn = (bg) => ({ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(0,0,0,.3)', background: bg, color: '#1a1228', fontWeight: 700, cursor: 'pointer' });
const pill = (on, tone) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? tone : 'rgba(255,255,255,.15)'}`, background: on ? `${tone}22` : 'transparent', opacity: 1 });
const hint = { fontSize: 12, opacity: 0.75 };

export default function AiSettings() {
  const [providerId, setProv] = useState(getProviderId());
  const [modelId, setModel] = useState(getLocalModelId());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(isEngineReady());
  const [err, setErr] = useState('');
  const [testing, setTesting] = useState(false);
  const [testOut, setTestOut] = useState('');

  const gpu = webgpuAvailable();

  const chooseProvider = (id) => { setProviderId(id); setProv(id); setErr(''); setTestOut(''); };
  const chooseModel = (id) => { setLocalModelId(id); setModel(id); setReady(isEngineReady()); setTestOut(''); };

  async function download() {
    setDownloading(true); setErr(''); setProgress(0); setStatus('Preparing…');
    try {
      await ensureEngine(({ progress: p, text }) => {
        if (typeof p === 'number') setProgress(Math.round(p * 100));
        if (text) setStatus(text);
      });
      setReady(true); setStatus('Model ready — generation now runs on your device.');
    } catch (e) { setErr(e?.message || String(e)); setStatus(''); }
    finally { setDownloading(false); }
  }

  async function runTest() {
    setTesting(true); setErr(''); setTestOut('');
    try {
      const out = await generateText('Invent a name for a fantasy fire-lizard creature. Reply with ONLY the name, 1-3 words.', { maxTokens: 24 });
      setTestOut(out.trim() || '(empty response)');
    } catch (e) { setErr(e?.message || String(e)); }
    finally { setTesting(false); }
  }

  const activeLabel = getProvider().label;

  return (
    <div style={box}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>🧪 AI generation — backend</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={pill(providerId === 'api', '#7aa7ff')}>
          <input type="radio" name="aiProv" checked={providerId === 'api'} onChange={() => chooseProvider('api')} />
          ☁️ Claude API (online)
        </label>
        <label style={{ ...pill(providerId === 'webllm', '#7dcc88'), cursor: gpu ? 'pointer' : 'not-allowed', opacity: gpu ? 1 : 0.5 }}
          title={gpu ? '' : 'This browser/WebView has no WebGPU — on-device models need a WebGPU-capable engine.'}>
          <input type="radio" name="aiProv" checked={providerId === 'webllm'} disabled={!gpu} onChange={() => chooseProvider('webllm')} />
          📲 On-device (offline)
        </label>
      </div>

      <div style={hint}>
        WebGPU on this device: <b>{gpu ? 'available ✓' : 'NOT available ✗'}</b>
        {isNativeShell() ? ' · running in the Android app' : ' · running in a browser'}
      </div>

      {providerId === 'webllm' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}><span style={hint}>On-device model</span>
            <select value={modelId} onChange={(e) => chooseModel(e.target.value)} disabled={downloading}
              style={{ padding: 8, borderRadius: 6 }}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} · ~{Math.round(m.approxMB)}MB</option>)}
            </select>
          </label>

          {!ready && !downloading && (
            <button type="button" onClick={download} style={btn('#e8c86a')}>⬇ Download &amp; enable this model</button>
          )}
          {downloading && (
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ height: 8, background: 'rgba(0,0,0,.35)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#6cc86c', transition: 'width .2s' }} />
              </div>
              <div style={hint}>{progress}% · {status}</div>
            </div>
          )}
          {ready && !downloading && <div style={{ ...pill(true, '#6cc86c'), width: 'fit-content' }}>✓ Model ready — runs offline</div>}
          <div style={hint}>Downloads once (~{Math.round((MODELS.find((m) => m.id === modelId)?.approxMB) || 0)}MB), cached in-browser. First load takes a minute; then it's fully offline.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={runTest} disabled={testing || downloading} style={btn('#c9e8a0')}>
          {testing ? '… generating' : `▶ Test generation (${activeLabel.split(' ')[0]})`}
        </button>
        {testOut && <span style={{ fontStyle: 'italic' }}>→ “{testOut}”</span>}
      </div>

      {err && <div style={{ fontSize: 12, color: '#f0a0a0' }}>⚠ {err}</div>}
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ai/AiSettings — the player-facing choice of AI backend: the       ║
// ║ Claude API (online) vs an on-device model that runs in the browser        ║
// ║ (WebGPU). Lets the user download + select a local model with progress.    ║
// ║ Reusable; drop it wherever AI generation is offered (the Forge, editor).  ║
// ║ Importing this does NOT load the heavy WebLLM runtime — only pressing      ║
// ║ "Download" does (webllm.js dynamic-imports @mlc-ai/web-llm).              ║
// ╚══════════════════════════════════════════════════════════════════╝
import { useState } from 'react';
import { getProviderId, setProviderId, isNativeShell } from './provider.js';
import { MODELS, getLocalModelId, setLocalModelId, webgpuAvailable, isEngineReady, ensureEngine } from './webllm.js';

export default function AiSettings() {
  const [providerId, setProv] = useState(getProviderId());
  const [modelId, setModel] = useState(getLocalModelId());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(isEngineReady());
  const [err, setErr] = useState('');

  const gpu = webgpuAvailable();
  const native = isNativeShell();

  const chooseProvider = (id) => { setProviderId(id); setProv(id); setErr(''); };
  const chooseModel = (id) => { setLocalModelId(id); setModel(id); setReady(isEngineReady()); };

  async function download() {
    setDownloading(true); setErr(''); setProgress(0); setStatus('Preparing…');
    try {
      await ensureEngine(({ progress: p, text }) => {
        if (typeof p === 'number') setProgress(Math.round(p * 100));
        if (text) setStatus(text);
      });
      setReady(true); setStatus('Model ready — generation now runs on your device.');
    } catch (e) {
      setErr(e?.message || String(e));
      setStatus('');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="uiPanel aiSettings" style={{ display: 'grid', gap: 'var(--s-2, 8px)' }}>
      <div style={{ fontWeight: 700 }}>AI generation</div>

      <div className="aiProvChoice" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className={`uiPill${providerId === 'api' ? ' info' : ' muted'}`} style={{ cursor: 'pointer' }}>
          <input type="radio" name="aiProv" checked={providerId === 'api'} onChange={() => chooseProvider('api')} style={{ marginRight: 6 }} />
          ☁️ Claude API (online)
        </label>
        <label
          className={`uiPill${providerId === 'webllm' ? ' good' : ' muted'}`}
          style={{ cursor: gpu ? 'pointer' : 'not-allowed', opacity: gpu ? 1 : 0.5 }}
          title={gpu ? '' : 'This browser has no WebGPU — on-device models need Chrome/Edge on a supported device.'}
        >
          <input type="radio" name="aiProv" checked={providerId === 'webllm'} disabled={!gpu} onChange={() => chooseProvider('webllm')} style={{ marginRight: 6 }} />
          📲 On-device (offline)
        </label>
      </div>

      {providerId === 'webllm' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <label className="crFld"><span>On-device model</span>
            <select value={modelId} onChange={(e) => chooseModel(e.target.value)} disabled={downloading}>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} · ~{Math.round(m.approxMB)}MB</option>)}
            </select>
          </label>

          {!ready && !downloading && (
            <button className="uiBtn go" type="button" onClick={download}>
              ⬇ Download &amp; enable this model
            </button>
          )}
          {downloading && (
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ height: 8, background: 'rgba(0,0,0,.25)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--go, #4caf50)', transition: 'width .2s' }} />
              </div>
              <div className="uiHint" style={{ fontSize: 12 }}>{progress}% · {status}</div>
            </div>
          )}
          {ready && !downloading && <div className="uiPill good" style={{ width: 'fit-content' }}>✓ Model ready — runs offline</div>}
          {err && <div className="uiHint" style={{ color: 'var(--danger, #e06c6c)' }}>⚠ {err}</div>}
          <div className="uiHint" style={{ fontSize: 12 }}>
            The model downloads once (~{Math.round((MODELS.find((m) => m.id === modelId)?.approxMB) || 0)}MB) and is cached in your browser.
            First load takes a minute; after that, generation is fully offline.
          </div>
        </div>
      )}

      {providerId === 'api' && !native && (
        <div className="uiHint" style={{ fontSize: 12 }}>
          Uses the Claude API (needs a key outside the Claude app, and a connection).
          {gpu ? ' Pick “On-device” to generate offline with no key.' : ''}
        </div>
      )}
    </div>
  );
}

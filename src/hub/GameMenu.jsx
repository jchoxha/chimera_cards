// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: hub/GameMenu — the clean, player-facing menu shown when the app    ║
// ║ runs in the Android shell (Capacitor). Unlike the dev Hub landing, it does ║
// ║ NOT list versions/docs/other builds — just Play, Settings (on-device AI +  ║
// ║ self-update), and a subtle version line. See docs/offline-android.md §6.   ║
// ╚══════════════════════════════════════════════════════════════════╝
import { useState, useEffect } from 'react';
import AiSettings from '../ai/AiSettings.jsx';
import { checkForUpdate } from '../updateCheck.js';
import { runLiveUpdate } from '../liveUpdate.js';
import { APP_VERSION } from '../version.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const linkBtn = { background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 };

export default function GameMenu() {
  const [settings, setSettings] = useState(false);
  const [upd, setUpd] = useState(null);
  const [checking, setChecking] = useState(false);
  const [otaMsg, setOtaMsg] = useState('');

  const check = async () => { setChecking(true); try { setUpd(await checkForUpdate()); } finally { setChecking(false); } };
  useEffect(() => { check(); }, []);

  // Trigger the OTA web-bundle update (native). On success it downloads + reloads
  // into the new bundle; otherwise report status.
  const doUpdate = async () => {
    setChecking(true); setOtaMsg('Checking…');
    try {
      const r = await runLiveUpdate();
      if (r.status === 'updating') setOtaMsg('Updating — the app will reload…');
      else if (r.status === 'up-to-date') setOtaMsg('You’re on the latest version.');
      else if (r.status === 'web') setOtaMsg('Updates apply only in the installed app.');
      else if (r.status === 'error') setOtaMsg('Update failed: ' + (r.error || 'unknown'));
      else setOtaMsg('');
    } finally { setChecking(false); }
  };

  return (
    <div className="hubLanding">
      <div className="hubHero">
        <h1>CHIMERA<span>CARDS</span></h1>
        <p className="hubTagline">Capture monsters. Build decks. Descend.</p>
        <div style={{ marginTop: -14, marginBottom: 20, fontSize: 12, opacity: 0.6 }}>v{APP_VERSION.replace(/^v/, '')}</div>

        {upd?.updateAvailable && (
          <button type="button" onClick={doUpdate} className="hubPlay"
            style={{ display: 'block', marginBottom: 14, background: 'linear-gradient(#4caf50,#3a8f43)', boxShadow: '0 6px 0 #2c6b32', border: 'none', width: '100%' }}>
            ⬇ Update available ({upd.latest}) — tap to update
          </button>
        )}

        <a className="hubPlay" href={`${BASE}battle.html`}>▶ Play</a>

        <div style={{ marginTop: 26 }}>
          <button type="button" onClick={() => setSettings((s) => !s)}
            style={{ ...linkBtn, textDecoration: 'none', opacity: 0.85, fontSize: 15 }}>
            {settings ? '▾ Settings' : '⚙ Settings'}
          </button>
        </div>

        {settings && (
          <div style={{ marginTop: 14, display: 'grid', gap: 14, justifyItems: 'center' }}>
            <AiSettings />
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Version {APP_VERSION}{' · '}
              <button type="button" onClick={doUpdate} disabled={checking} style={linkBtn}>
                {checking ? 'checking…' : 'check for updates'}
              </button>
              {otaMsg ? ` · ${otaMsg}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: editor/persistence — dual-backend save for the card editor.  ║
// ║ Local dev → Vite dev-write plugin; remote/phone → GitHub API commit; ║
// ║ always → localStorage autosave + Export/Import JSON. See              ║
// ║ docs/card-editor.md.                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

const LS_DRAFT = (file) => `chimera:cardeditor:draft:${file}`;
const LS_GH = 'chimera:cardeditor:github';

// ── localStorage drafts ───────────────────────────────────────────────────────
export function saveDraft(file, obj) {
  try { localStorage.setItem(LS_DRAFT(file), JSON.stringify(obj)); } catch { /* quota */ }
}
export function loadDraft(file) {
  try { const s = localStorage.getItem(LS_DRAFT(file)); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function clearDraft(file) {
  try { localStorage.removeItem(LS_DRAFT(file)); } catch { /* noop */ }
}

// ── Named presets (per file) ──────────────────────────────────────────────────
const LS_PRESETS = (file) => `chimera:cardeditor:presets:${file}`;
function readPresetMap(file) {
  try { return JSON.parse(localStorage.getItem(LS_PRESETS(file)) || '{}'); } catch { return {}; }
}
export function listPresets(file) { return Object.keys(readPresetMap(file)).sort(); }
export function savePreset(file, name, obj) {
  const map = readPresetMap(file); map[name] = obj;
  try { localStorage.setItem(LS_PRESETS(file), JSON.stringify(map)); } catch { /* quota */ }
}
export function loadPreset(file, name) { return readPresetMap(file)[name] ?? null; }
export function deletePreset(file, name) {
  const map = readPresetMap(file); delete map[name];
  try { localStorage.setItem(LS_PRESETS(file), JSON.stringify(map)); } catch { /* noop */ }
}

// ── GitHub settings ───────────────────────────────────────────────────────────
export function loadGitHubSettings() {
  try {
    return { owner: 'jchoxha', repo: 'chimera_cards', branch: 'main', token: '', ...(JSON.parse(localStorage.getItem(LS_GH) || '{}')) };
  } catch { return { owner: 'jchoxha', repo: 'chimera_cards', branch: 'main', token: '' }; }
}
export function saveGitHubSettings(s) {
  try { localStorage.setItem(LS_GH, JSON.stringify(s)); } catch { /* noop */ }
}

// ── Dev-write backend (Vite plugin) ───────────────────────────────────────────
export async function detectDevWrite() {
  try {
    const r = await fetch('/__card-write-ping', { cache: 'no-store' });
    return r.ok;
  } catch { return false; }
}
export async function saveViaDev(file, obj) {
  const r = await fetch('/__save-card-file', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ file, json: obj }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.error || `dev save failed (${r.status})`);
  return data;
}

// ── GitHub backend ────────────────────────────────────────────────────────────
function b64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
export async function saveViaGitHub(file, obj, gh) {
  const { owner, repo, branch, token } = gh;
  if (!token) throw new Error('no GitHub token set');
  const path = `src/data/cards/${file}`;
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };

  // Look up current sha (file may not exist yet → 404 is fine).
  let sha;
  const head = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (head.ok) sha = (await head.json()).sha;
  else if (head.status !== 404) throw new Error(`GitHub read failed (${head.status})`);

  const body = {
    message: `Card editor: update ${path}`,
    content: b64(JSON.stringify(obj, null, 2) + '\n'),
    branch,
    ...(sha ? { sha } : {}),
  };
  const put = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!put.ok) {
    const err = await put.json().catch(() => ({}));
    throw new Error(err.message || `GitHub commit failed (${put.status})`);
  }
  return put.json();
}

// ── Export / import fallback ──────────────────────────────────────────────────
export function downloadJSON(file, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Save using the best available backend.
 * @returns {Promise<{ via: 'dev'|'github'|'download', detail?: any }>}
 */
export async function persist(file, obj, { devAvailable, gh }) {
  saveDraft(file, obj);
  if (devAvailable) { await saveViaDev(file, obj); return { via: 'dev' }; }
  if (gh?.token) { const detail = await saveViaGitHub(file, obj, gh); return { via: 'github', detail }; }
  downloadJSON(file, obj);
  return { via: 'download' };
}

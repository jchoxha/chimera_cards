// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/partsStore — where a freshly-cut part sprite LIVES.           ║
// ║                                                                           ║
// ║ Two tiers, because the site is static:                                    ║
// ║   LOCAL  — cut parts are kept in localStorage as data-URLs and merged over ║
// ║            src/data/partsBaked.json at render time. This is what makes the ║
// ║            studio feel immediate: cut a wing, every winged creature on the ║
// ║            device is wearing it a second later, with no deploy.            ║
// ║   REPO   — committing the PNG (+ the manifest entry) through the GitHub    ║
// ║            API is what makes it real for everyone. Reuses the editor's     ║
// ║            existing PAT flow (src/editor/persistence.js); the token stays  ║
// ║            in localStorage and is NEVER bundled or committed.              ║
// ║                                                                           ║
// ║ Local overrides always win, so you can try a part before publishing it.    ║
// ║ UPDATE WHEN: the manifest path or the commit target changes.               ║
// ╚══════════════════════════════════════════════════════════════════╝

import BAKED from '../data/partsBaked.json';

const LS_PARTS = 'chimera.lab.parts';
const LS_GH = 'chimera:cardeditor:github';   // shared with the card editor

// ── local overrides ──────────────────────────────────────────────────────────

/** @returns {Record<string,string>} partId → data-URL */
export function localParts() {
  try { return JSON.parse(localStorage.getItem(LS_PARTS) || '{}'); } catch { return {}; }
}

export function saveLocalPart(partId, dataUrl) {
  const all = localParts();
  all[partId] = dataUrl;
  try {
    localStorage.setItem(LS_PARTS, JSON.stringify(all));
  } catch {
    throw new Error('local storage is full — publish or clear some parts first');
  }
  return all;
}

export function deleteLocalPart(partId) {
  const all = localParts();
  delete all[partId];
  localStorage.setItem(LS_PARTS, JSON.stringify(all));
  return all;
}

export function clearLocalParts() { localStorage.removeItem(LS_PARTS); }

/**
 * What the renderer should use: committed manifest entries, overridden by
 * anything cut locally on this device.
 */
export function effectiveParts() {
  return { ...BAKED, ...localParts() };
}

// ── GitHub publishing ────────────────────────────────────────────────────────

export function loadGh() {
  try {
    return { owner: 'jchoxha', repo: 'chimera_cards', branch: 'main', token: '', ...JSON.parse(localStorage.getItem(LS_GH) || '{}') };
  } catch {
    return { owner: 'jchoxha', repo: 'chimera_cards', branch: 'main', token: '' };
  }
}
export function saveGh(s) { localStorage.setItem(LS_GH, JSON.stringify(s)); }

const ghHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' });

async function getSha(api, branch, headers) {
  const r = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (r.ok) return (await r.json()).sha;
  if (r.status === 404) return undefined;      // new file — fine
  throw new Error(`GitHub read failed (${r.status})`);
}

async function putFile({ owner, repo, branch, token }, path, contentB64, message) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = ghHeaders(token);
  const sha = await getSha(api, branch, headers);
  const r = await fetch(api, {
    method: 'PUT', headers,
    body: JSON.stringify({ message, content: contentB64, branch, ...(sha ? { sha } : {}) }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `GitHub commit failed (${r.status})`);
  }
  return r.json();
}

const b64Text = (s) => btoa(unescape(encodeURIComponent(s)));
/** data:image/png;base64,XXXX → XXXX (GitHub wants raw base64) */
export const b64FromDataUrl = (d) => String(d).split(',')[1] ?? '';

/**
 * Publish a cut part: commit the PNG, then add it to partsBaked.json so every
 * client picks it up on the next deploy.
 * @returns {Promise<{path:string}>}
 */
export async function publishPart(partId, dataUrl, gh) {
  if (!gh?.token) throw new Error('add a GitHub token first (Publish settings)');
  const path = `public/art/parts/${partId}.png`;

  await putFile(gh, path, b64FromDataUrl(dataUrl), `Parts studio: bake ${partId}`);

  // merge the manifest from the branch tip so concurrent bakes don't clobber
  const api = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/src/data/partsBaked.json`;
  const headers = ghHeaders(gh.token);
  let current = {};
  const head = await fetch(`${api}?ref=${encodeURIComponent(gh.branch)}`, { headers });
  if (head.ok) {
    const j = await head.json();
    try { current = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))))); } catch { current = {}; }
  }
  current[partId] = `art/parts/${partId}.png`;
  await putFile(gh, 'src/data/partsBaked.json',
    b64Text(`${JSON.stringify(current, null, 2)}\n`), `Parts studio: register ${partId}`);

  return { path };
}

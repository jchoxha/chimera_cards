// POST /api/art  { prompt: string, aspect?: string }  →  { url: string }
// Generates card art server-side and returns a cloud URL the client lazy-loads
// + Service-Worker caches. The image provider key stays on the server.
//
// Phase 2 is a structured seam, not a finished integration: wiring a specific
// image model + object-storage upload is deferred. The locked art style and the
// proven generation path live in docs/art-pipeline.md + scripts/agy_call.py
// (baked roster art). This endpoint is for RUNTIME player-created (forge/fuse)
// art. Until a provider + bucket are configured it returns a clear 501 so the
// client falls back gracefully (procedural art), per the design.
import { readJsonBody, methodGuard } from './_shared.js';

const ART_STYLE =
  'Flat 2D hand-drawn cartoon illustration (Adventure Time / Pendleton Ward): bold shapes, ' +
  'thick black outlines, flat matte fills, minimal shading; with Yu-Gi-Oh trading-card seriousness ' +
  '(intense, slightly menacing, dynamic pose, moody lighting). NOT Disney/3D/glossy/cute. ' +
  'No text, no card frame, no border. Square 1:1.';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  try {
    const { prompt, aspect = '1:1' } = await readJsonBody(req);
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

    const fullPrompt = `${prompt}. ${ART_STYLE}`;

    // ── Integration point (deferred) ──────────────────────────────────────
    // const url = await generateAndUpload(fullPrompt, aspect, {
    //   imageKey: process.env.GEMINI_API_KEY,        // image model key (server-only)
    //   bucket: process.env.ART_BUCKET_URL,          // object storage
    // });
    // return res.status(200).json({ url });

    if (!process.env.GEMINI_API_KEY || !process.env.ART_BUCKET_URL) {
      return res.status(501).json({
        error: 'art generation not configured',
        hint: 'set GEMINI_API_KEY + ART_BUCKET_URL on the backend; client should fall back to procedural art',
        prompt: fullPrompt,
        aspect,
      });
    }
    return res.status(501).json({ error: 'art provider wiring pending', prompt: fullPrompt, aspect });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}

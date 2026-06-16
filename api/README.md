# Serverless AI backend (`api/`)

Vercel-style functions that hold the generative-AI keys **server-side** so the
client never ships one (spec §1, §3). These power runtime forge/fuse/art for
player-created content. The deterministic stat/card **budget** is computed in the
engine (`src/engine/ai/AIPipeline.budgetFor`), never here — this layer only
returns **flavor + validated tags + art URLs**.

| Endpoint | In | Out | Status |
|---|---|---|---|
| `POST /api/forge` | `{ prompt }` | `{ elements[], archetype, statuses[] }` | functional (LLM tag extraction, server-validated) |
| `POST /api/fuse`  | `{ a, b }` (monster types) | `{ elements[], archetype, statuses[] }` | functional (dominant A + secondary B + AI tertiary) |
| `POST /api/art`   | `{ prompt, aspect? }` | `{ url }` | seam — returns 501 until provider+bucket configured |

## Env vars (set on the backend only)
- `ANTHROPIC_API_KEY` — for forge/fuse tag extraction. `ANTHROPIC_MODEL` optional.
- `GEMINI_API_KEY` + `ART_BUCKET_URL` — for `art` (deferred wiring).

## Important: this does NOT run on GitHub Pages
Pages is static hosting — it serves `index.html` / `combat.html` only and will
**not** execute `api/*`. To run the backend, deploy to Vercel (auto-detects
`api/`) or port these handlers to your Cloud Functions provider, then point the
client `AIPipeline({ baseUrl })` at that origin. The client is built to fall back
gracefully when the backend is absent (procedural art, no AI tags), so Pages
remains fully playable without it.

## Client usage
```js
import { AIPipeline, budgetFor } from './engine/ai/AIPipeline.js';
const ai = new AIPipeline({ baseUrl: import.meta.env.VITE_API_BASE || '' });
const tags = await ai.forgeTags(prompt);     // flavor/tags from the backend
const budget = budgetFor({ runDepth, materialTier }); // mechanics, local + deterministic
```

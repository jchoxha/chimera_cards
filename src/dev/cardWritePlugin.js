// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: dev/cardWritePlugin — a Vite DEV-ONLY plugin that lets the   ║
// ║ card editor write card JSON straight to src/data/cards on Save when   ║
// ║ running `npm run dev` locally. Never part of the production build.    ║
// ║ UPDATE WHEN: the card data directory or save endpoint changes.       ║
// ╚══════════════════════════════════════════════════════════════════╝

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import process from 'node:process';

const CARDS_DIR = 'src/data/cards';
const SAFE_NAME = /^[a-z0-9_-]+\.json$/i;

/** @returns {import('vite').Plugin} */
export function cardWritePlugin() {
  return {
    name: 'chimera-card-write',
    apply: 'serve', // dev server only — excluded from `vite build`
    configureServer(server) {
      // Liveness probe the editor uses to detect the local dev-write backend.
      server.middlewares.use('/__card-write-ping', (_req, res) => {
        res.statusCode = 200;
        res.end('ok');
      });

      server.middlewares.use('/__save-card-file', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); });
        req.on('end', () => {
          try {
            const { file, json } = JSON.parse(body);
            if (!SAFE_NAME.test(file)) throw new Error(`unsafe file name: ${file}`);
            const dir = resolve(process.cwd(), CARDS_DIR);
            const target = resolve(dir, file);
            if (target !== resolve(dir, file) || !target.startsWith(dir)) throw new Error('path escape');
            mkdirSync(dir, { recursive: true });
            writeFileSync(target, JSON.stringify(json, null, 2) + '\n', 'utf8');
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true, file }));
            server.config.logger.info(`[card-write] saved ${CARDS_DIR}/${file}`);
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
          }
        });
      });
    },
  };
}

#!/usr/bin/env node
/**
 * Copies the Tesseract worker + WASM core into `public/tesseract/`.
 *
 * Why: tesseract.js defaults `workerPath` and `corePath` to cdn.jsdelivr.net,
 * which the production CSP blocks (no third-party scripts). That silently kills
 * OCR the same way the missing MapLibre worker silently killed the map. These
 * two assets are self-hosted; only the per-language traineddata still comes
 * from jsDelivr (allow-listed in vercel.json `connect-src`, and loaded as data
 * via fetch, never as an executable script).
 *
 * Runs from `predev` / `prebuild` — the output is gitignored.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'tesseract');

// createWorker() defaults to OEM.LSTM_ONLY, and getCore() probes for SIMD /
// relaxed-SIMD at runtime → these three LSTM cores are the only ones reachable.
const FILES = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
];

if (!existsSync(join(root, 'node_modules', 'tesseract.js'))) {
  console.warn('[sync-tesseract] node_modules/tesseract.js not installed — skipping (run npm install first)');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const [from, to] of FILES) {
  const src = join(root, 'node_modules', from);
  if (!existsSync(src)) {
    console.warn(`[sync-tesseract] missing ${from} — skipped`);
    continue;
  }
  const dest = join(outDir, to);
  // Skip when already current (predev runs on every `npm run dev`).
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs && statSync(dest).size === statSync(src).size) {
    copied += 0;
    continue;
  }
  copyFileSync(src, dest);
  copied += 1;
}

const total = FILES.reduce((kb, [from]) => {
  const src = join(root, 'node_modules', from);
  return kb + (existsSync(src) ? statSync(src).size / 1024 : 0);
}, 0);

console.log(`[sync-tesseract] public/tesseract ready (${copied} file(s) updated, ${Math.round(total)} KB total)`);

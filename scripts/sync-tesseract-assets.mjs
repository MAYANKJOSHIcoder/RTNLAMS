#!/usr/bin/env node
/**
 * Copies Tesseract worker + WASM core into `public/tesseract/` and
 * pdfjs worker + cmaps + standard fonts into `public/pdfjs/`.
 *
 * Why:
 * 1. tesseract.js defaults `workerPath` and `corePath` to cdn.jsdelivr.net,
 *    which the production CSP blocks (no third-party scripts).
 * 2. pdfjs-dist needs `pdf.worker.min.mjs` and font/cmap data for Indic scripts
 *    and embedded fonts; self-hosting keeps production CSP compliant and offline-ready.
 *
 * Runs from `predev` / `prebuild` — the outputs in public/ are gitignored or refreshed.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outTesseractDir = join(root, 'public', 'tesseract');
const outPdfjsDir = join(root, 'public', 'pdfjs');

// --- 1. Tesseract assets ---
const TESSERACT_FILES = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
];

if (existsSync(join(root, 'node_modules', 'tesseract.js'))) {
  mkdirSync(outTesseractDir, { recursive: true });
  let copied = 0;
  for (const [from, to] of TESSERACT_FILES) {
    const src = join(root, 'node_modules', from);
    if (!existsSync(src)) {
      console.warn(`[sync-assets] missing ${from} — skipped`);
      continue;
    }
    const dest = join(outTesseractDir, to);
    if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs && statSync(dest).size === statSync(src).size) {
      continue;
    }
    copyFileSync(src, dest);
    copied += 1;
  }
  const total = TESSERACT_FILES.reduce((kb, [from]) => {
    const src = join(root, 'node_modules', from);
    return kb + (existsSync(src) ? statSync(src).size / 1024 : 0);
  }, 0);
  console.log(`[sync-assets] public/tesseract ready (${copied} file(s) updated, ${Math.round(total)} KB total)`);
}

// --- 2. pdfjs-dist assets ---
if (existsSync(join(root, 'node_modules', 'pdfjs-dist'))) {
  mkdirSync(outPdfjsDir, { recursive: true });

  // Worker
  const workerSrc = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  const workerDest = join(outPdfjsDir, 'pdf.worker.min.mjs');
  if (existsSync(workerSrc)) {
    if (!existsSync(workerDest) || statSync(workerDest).mtimeMs < statSync(workerSrc).mtimeMs) {
      copyFileSync(workerSrc, workerDest);
    }
  }

  // Cmaps
  const cmapsSrc = join(root, 'node_modules', 'pdfjs-dist', 'cmaps');
  const cmapsDest = join(outPdfjsDir, 'cmaps');
  if (existsSync(cmapsSrc) && !existsSync(cmapsDest)) {
    cpSync(cmapsSrc, cmapsDest, { recursive: true });
  }

  // Standard fonts
  const fontsSrc = join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts');
  const fontsDest = join(outPdfjsDir, 'standard_fonts');
  if (existsSync(fontsSrc) && !existsSync(fontsDest)) {
    cpSync(fontsSrc, fontsDest, { recursive: true });
  }

  console.log('[sync-assets] public/pdfjs ready (worker, cmaps, standard_fonts)');
}


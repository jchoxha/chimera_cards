// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: scripts/png — a minimal, ZERO-DEPENDENCY PNG codec (node:zlib only) ║
// ║ so the local bake script can chroma-key + autocrop sprites without adding a ║
// ║ native image dependency (sharp/canvas) to a repo that ships to GH Pages.    ║
// ║                                                                            ║
// ║ Scope is deliberately narrow — exactly what ComfyUI's SaveImage emits:      ║
// ║ 8-bit, non-interlaced, colour type 0/2/4/6. That keeps this ~150 lines      ║
// ║ instead of a full PNG implementation.                                      ║
// ║                                                                            ║
// ║ Pixels are exchanged as a Uint8ClampedArray of RGBA — the SAME shape        ║
// ║ src/lab/cutout.js operates on, so the browser Parts Studio and this script  ║
// ║ share one cutout implementation instead of two that can drift.             ║
// ║ UPDATE WHEN: ComfyUI starts emitting a format outside the scope above.     ║
// ╚══════════════════════════════════════════════════════════════════╝

import { inflateSync, deflateSync } from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };   // grey, RGB, grey+A, RGBA

// ── CRC32 (the PNG variant) ──────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Undo one scanline's filter, in place. `pre` = the already-unfiltered line above. */
function unfilter(type, line, pre, bpp) {
  switch (type) {
    case 0: break;                                            // None
    case 1:                                                   // Sub
      for (let i = bpp; i < line.length; i++) line[i] = (line[i] + line[i - bpp]) & 0xff;
      break;
    case 2:                                                   // Up
      for (let i = 0; i < line.length; i++) line[i] = (line[i] + pre[i]) & 0xff;
      break;
    case 3:                                                   // Average
      for (let i = 0; i < line.length; i++) {
        const left = i >= bpp ? line[i - bpp] : 0;
        line[i] = (line[i] + ((left + pre[i]) >> 1)) & 0xff;
      }
      break;
    case 4:                                                   // Paeth
      for (let i = 0; i < line.length; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const b = pre[i];
        const c = i >= bpp ? pre[i - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[i] = (line[i] + pr) & 0xff;
      }
      break;
    default: throw new Error(`unsupported PNG filter ${type}`);
  }
}

/**
 * Decode a PNG buffer to RGBA.
 * @returns {{width:number, height:number, data:Uint8ClampedArray}}
 */
export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, depth = 0, colorType = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;                                   // len + type + data + crc
  }

  if (depth !== 8) throw new Error(`unsupported PNG bit depth ${depth}`);
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error(`unsupported PNG colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = ch;                                      // bytes per pixel at depth 8
  const stride = width * bpp;
  const out = new Uint8ClampedArray(width * height * 4);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const off = y * (stride + 1);
    const filter = raw[off];
    const line = raw.subarray(off + 1, off + 1 + stride);
    unfilter(filter, line, prev, bpp);
    for (let x = 0; x < width; x++) {
      const s = x * bpp, d = (y * width + x) * 4;
      if (ch === 1) { out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = 255; }
      else if (ch === 2) { out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = line[s + 1]; }
      else if (ch === 3) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255; }
      else { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3]; }
    }
    prev = line;
  }
  return { width, height, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode RGBA pixels to a PNG buffer (filter 0 — pixel-art sprites compress fine). */
export function encodePNG({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                          // filter: None
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = data[y * stride + i];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // colour type: RGBA
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Box-average downscale. For pixel art the source is generated at an integer
 * multiple of the target (1024 → 128 = ÷8), so each output pixel averages one
 * whole source "pixel block" and the result stays crisp rather than smeared.
 * Alpha-weighted so transparent pixels never bleed colour into the edges.
 */
export function resizeRGBA(src, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = src.width / w, sy = src.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, aw = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < src.height; yy++) {
        for (let xx = x0; xx < x1 && xx < src.width; xx++) {
          const i = (yy * src.width + xx) * 4;
          const al = src.data[i + 3];
          r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al;
          a += al; aw += al; n++;
        }
      }
      const d = (y * w + x) * 4;
      if (aw > 0) { out[d] = r / aw; out[d + 1] = g / aw; out[d + 2] = b / aw; }
      out[d + 3] = n ? a / n : 0;
    }
  }
  return { width: w, height: h, data: out };
}

/** Crop an RGBA image to a rect. */
export function cropRGBA(src, { x, y, w, h }) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const s = ((y + yy) * src.width + (x + xx)) * 4, d = (yy * w + xx) * 4;
      out[d] = src.data[s]; out[d + 1] = src.data[s + 1];
      out[d + 2] = src.data[s + 2]; out[d + 3] = src.data[s + 3];
    }
  }
  return { width: w, height: h, data: out };
}

/** Place an image onto a transparent canvas with `pad` px of margin on all sides. */
export function padRGBA(src, pad) {
  const w = src.width + pad * 2, h = src.height + pad * 2;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const s = (y * src.width + x) * 4, d = ((y + pad) * w + (x + pad)) * 4;
      out[d] = src.data[s]; out[d + 1] = src.data[s + 1];
      out[d + 2] = src.data[s + 2]; out[d + 3] = src.data[s + 3];
    }
  }
  return { width: w, height: h, data: out };
}

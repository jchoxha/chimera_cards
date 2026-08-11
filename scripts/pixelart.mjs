// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/pixelart.mjs — a tiny PIXEL-ART drawing toolkit. The point of      ║
// ║ raster-over-vector: real sprites read as sprites because they have a        ║
// ║ LIMITED PALETTE, a base + shadow + highlight RAMP, hard 1px OUTLINES, and   ║
// ║ a little dithering — none of which flat SVG blobs have. Everything here     ║
// ║ exists to make code-drawn parts look hand-pixelled, coherent across the     ║
// ║ whole set (one palette, one shading language), and immune to the AI failure ║
// ║ modes (a part is exactly the pixels you plot — never a whole bird, never    ║
// ║ mis-cropped). Zero-dependency: plain RGBA buffers for scripts/png.mjs.      ║
// ╚══════════════════════════════════════════════════════════════════╝

/** A canvas is a flat RGBA Uint8ClampedArray + its size. Origin top-left. */
export function canvas(size) {
  return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) };
}

const hex = (h) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};

/** Plot one pixel (integer coords, bounds-checked, straight alpha over). */
export function px(c, x, y, rgb, a = 255) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 4;
  if (a >= 255) { c.data[i] = rgb[0]; c.data[i + 1] = rgb[1]; c.data[i + 2] = rgb[2]; c.data[i + 3] = 255; return; }
  const na = a / 255, ia = 1 - na, oa = c.data[i + 3] / 255;
  const outA = na + oa * ia;
  c.data[i] = (rgb[0] * na + c.data[i] * oa * ia) / (outA || 1);
  c.data[i + 1] = (rgb[1] * na + c.data[i + 1] * oa * ia) / (outA || 1);
  c.data[i + 2] = (rgb[2] * na + c.data[i + 2] * oa * ia) / (outA || 1);
  c.data[i + 3] = outA * 255;
}
const getA = (c, x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : c.data[(y * c.width + x) * 4 + 3]);

/** Filled disc. */
export function disc(c, cx, cy, r, rgb, a = 255) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(c, cx + x, cy + y, rgb, a);
}
/** Filled axis-aligned ellipse. */
export function ellipse(c, cx, cy, rx, ry, rgb, a = 255) {
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(c, cx + x, cy + y, rgb, a);
  }
}
/** Filled rectangle. */
export function rect(c, x0, y0, w, h, rgb, a = 255) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(c, x0 + x, y0 + y, rgb, a);
}
/** Thick line (Bresenham + radius). */
export function line(c, x0, y0, x1, y1, rgb, w = 1, a = 255) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, r = (w - 1) / 2;
  for (;;) {
    if (w <= 1) px(c, x0, y0, rgb, a); else disc(c, x0, y0, r, rgb, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
/** Filled polygon (even-odd scanline). pts = [[x,y],…]. */
export function poly(c, pts, rgb, a = 255) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x <= Math.round(xs[k + 1]); x++) px(c, x, y, rgb, a);
  }
}

/**
 * A shading RAMP built from one base hex: [outline, shadow, base, mid, highlight].
 * This single relationship is what makes every part read as the same material set.
 */
export function ramp(baseHex) {
  const [r, g, b] = hex(baseHex);
  const mix = (t, to) => [r + (to[0] - r) * t, g + (to[1] - g) * t, b + (to[2] - b) * t].map(Math.round);
  const BLACK = [26, 18, 40], WHITE = [255, 250, 235];
  return {
    outline: mix(0.72, BLACK),
    shadow: mix(0.34, BLACK),
    base: [r, g, b],
    mid: mix(0.22, WHITE),
    hi: mix(0.5, WHITE),
  };
}

/** Ordered-dither: plot `rgb` on a 4×4 Bayer pattern of strength t (0..1). */
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function dither(c, x0, y0, w, h, rgb, t) {
  const thr = Math.round(t * 16);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (BAYER[y & 3][x & 3] < thr) px(c, x0 + x, y0 + y, rgb);
}

/** Trace a 1px dark OUTLINE around every opaque pixel that borders transparency. */
export function outline(c, rgb) {
  const snap = new Uint8ClampedArray(c.data); // read original alpha while writing
  const op = (x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : snap[(y * c.width + x) * 4 + 3]);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (op(x, y) > 32) continue;
    if (op(x - 1, y) > 32 || op(x + 1, y) > 32 || op(x, y - 1) > 32 || op(x, y + 1) > 32) px(c, x, y, rgb);
  }
}

// One global light (top-left-front) shared by every part so a composited creature
// reads as lit by a single sun.
const LIGHT = (() => { const v = [-0.5, -0.62, 0.61]; const m = Math.hypot(...v); return v.map((n) => n / m); })();
const QUANT = [0.46, 0.66, 0.86, 1.0, 1.12, 1.28];   // brightness bands (pixel-art stepping)

/**
 * VOLUMETRIC form shading — the big quality lever. Treats the sprite's silhouette
 * as a HEIGHT FIELD (blurred alpha → a smooth dome), derives a surface NORMAL per
 * pixel, lights it with the one global sun, and quantises the brightness into a
 * few bands so any flat-filled shape reads as a rounded, lit volume — not a blob.
 * Material-agnostic: it MODULATES whatever colour is already there, so a steel
 * blade and a wood grip in one part each light correctly.
 * @param {{roundness?:number, blur?:number, ambient?:number}} o
 *   roundness: lower = rounder/softer (0.05 puffy … 0.2 flat) · blur: form scale.
 */
export function formShade(c, { roundness = 0.09, blur = 10, ambient = 0.36 } = {}) {
  const { width: w, height: h, data } = c;
  let H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = data[i * 4 + 3] > 60 ? 1 : 0;
  for (let pass = 0; pass < blur; pass++) {
    const t = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        s += H[yy * w + xx]; n++;
      }
      t[y * w + x] = s / n;
    }
    H = t;
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : H[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 200) continue;
    const gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
    const nx = -gx, ny = -gy, nz = roundness;
    const len = Math.hypot(nx, ny, nz) || 1;
    let b = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / len;
    b = ambient + (1 - ambient) * Math.max(0, b) + 0.16 * at(x, y);
    const f = QUANT[Math.max(0, Math.min(QUANT.length - 1, Math.round(b * (QUANT.length - 1))))];
    data[i] = Math.min(255, data[i] * f);
    data[i + 1] = Math.min(255, data[i + 1] * f);
    data[i + 2] = Math.min(255, data[i + 2] * f);
  }
}

/** A crisp 1px RIM highlight on the top-left lit edge. Run after formShade,
 *  before outline — reads as a hard light catching the form. */
export function rim(c, rgb) {
  const snap = new Uint8ClampedArray(c.data);
  const op = (x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : snap[(y * c.width + x) * 4 + 3]);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (op(x, y) < 200) continue;
    if (op(x - 1, y) < 60 || op(x, y - 1) < 60) px(c, x, y, rgb);
  }
}

export { hex, getA };

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

/**
 * Trace a 1px dark OUTLINE around every opaque pixel that borders transparency,
 * and add a soft top-left rim highlight. Called last — this is 80% of why it
 * stops looking like a flat blob.
 */
export function outline(c, rgb) {
  const snap = new Uint8ClampedArray(c.data); // read original alpha while writing
  const op = (x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : snap[(y * c.width + x) * 4 + 3]);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (op(x, y) > 32) continue;
    if (op(x - 1, y) > 32 || op(x + 1, y) > 32 || op(x, y - 1) > 32 || op(x, y + 1) > 32) px(c, x, y, rgb);
  }
}

/** Apply a top-left→bottom-right light gradient over already-filled pixels: the
 *  lit half gets `hi`, the shadowed corner gets `shadow`, keeping the base between.
 *  A cheap, consistent light direction across the whole part set. */
export function shade(c, rmp, cx, cy) {
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (c.data[i + 3] < 200) continue;
    // only recolour pixels currently at the base colour (leave detail pixels alone)
    if (c.data[i] !== rmp.base[0] || c.data[i + 1] !== rmp.base[1] || c.data[i + 2] !== rmp.base[2]) continue;
    const d = ((x - cx) + (y - cy)) / (c.width);        // -~1 (top-left) .. +~1 (bottom-right)
    const col = d < -0.18 ? rmp.hi : d > 0.30 ? rmp.shadow : d > 0.12 ? rmp.mid : rmp.base;
    px(c, x, y, col);
  }
}

export { hex, getA };

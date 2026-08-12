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

// ── The two "light colours" every part shares ────────────────────────────────
// The single most important pixel-art colour rule: shadows aren't just darker,
// they shift toward a COOL hue; highlights shift toward a WARM one. Ramps and the
// shader both blend toward these instead of pure black/white, so nothing looks
// muddy/plastic and the whole set reads as lit by one warm sun in cool ambient.
const COOL = [46, 44, 92];     // deep desaturated blue-violet (shadow tint)
const WARM = [255, 240, 202];  // warm cream (highlight tint)
const INK = [24, 18, 34];      // near-black used only as a floor for outlines

/**
 * A hue-shifted shading RAMP from one base hex: {outline, shadow, base, mid, hi}.
 * shadow → toward COOL, mid/hi → toward WARM. This single relationship is what
 * makes every part read as the same material lit the same way.
 */
export function ramp(baseHex) {
  const [r, g, b] = hex(baseHex);
  const base = [r, g, b];
  const mix = (to, t) => [r + (to[0] - r) * t, g + (to[1] - g) * t, b + (to[2] - b) * t].map(Math.round);
  return {
    outline: mix(INK, 0.66),     // colored-dark, not pure black (selective outline reuses this only as a floor)
    shadow: mix(COOL, 0.30),
    base,
    mid: mix(WARM, 0.20),
    hi: mix(WARM, 0.44),
  };
}

/** Ordered-dither: plot `rgb` on a 4×4 Bayer pattern of strength t (0..1). */
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function dither(c, x0, y0, w, h, rgb, t) {
  const thr = Math.round(t * 16);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (BAYER[y & 3][x & 3] < thr) px(c, x0 + x, y0 + y, rgb);
}

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const mixTo = (rgb, to, t) => [rgb[0] + (to[0] - rgb[0]) * t, rgb[1] + (to[1] - rgb[1]) * t, rgb[2] + (to[2] - rgb[2]) * t];

/**
 * SELECTIVE OUTLINE (selout). Not a flat black keyline: each border pixel takes a
 * darkened+cooled version of the INTERIOR colour it hugs, so the outline belongs
 * to the form instead of caging it — and the top-left LIT edges are skipped
 * (light "opens" the outline there, where rim() puts a highlight instead).
 */
export function outline(c) {
  const snap = new Uint8ClampedArray(c.data);
  const op = (x, y) => (x < 0 || y < 0 || x >= c.width || y >= c.height ? 0 : snap[(y * c.width + x) * 4 + 3]);
  const col = (x, y) => { const j = (y * c.width + x) * 4; return [snap[j], snap[j + 1], snap[j + 2]]; };
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (op(x, y) > 32) continue;
    // find the opaque interior neighbour (prefer a cardinal one) and where it sits
    let nx = 0, ny = 0, found = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (op(x + dx, y + dy) > 32) { nx = x + dx; ny = y + dy; found = true; break; }
    if (!found) continue;
    // lit (top-left) edge? the interior lies down-right of us → skip so light bleeds out
    const litEdge = (nx > x || ny > y) && lum(...col(nx, ny)) > 150;
    if (litEdge) continue;
    const base = col(nx, ny);
    px(c, x, y, mixTo(base, INK, 0.62).map(Math.round));
  }
}

// One global light (top-left-front) shared by every part so a composited creature
// reads as lit by a single sun. 2D component drives the DIRECTIONAL term below.
const LIGHT = (() => { const v = [-0.5, -0.62, 0.61]; const m = Math.hypot(...v); return v.map((n) => n / m); })();

/**
 * DIRECTIONAL CLUSTER shading — the big quality lever, and the OPPOSITE of the
 * pillow-shading it replaces. Pillow-shading lights the blurred-silhouette normal,
 * which always ramps toward the form's centre → a flat, radial, "puffy" look.
 * Instead this lights each pixel by BOTH a little form-normal AND a global
 * DIRECTIONAL gradient (bright on the sun side, dark on the far side), then
 * SNAPS the result into 4 hard tone CLUSTERS (deepShadow/shadow/base/hi) with the
 * base cluster widest. Cluster boundaries are ORDERED-DITHERED so value edges
 * stipple instead of forming banding lines parallel to the silhouette. Tones are
 * hue-shifted (shadows→COOL, highlights→WARM). Material-agnostic: it recolours
 * whatever is already there, so a steel blade and a wood grip both light right.
 * @param {{roundness?:number, blur?:number, ambient?:number}} o
 */
export function formShade(c, { roundness = 0.5, blur = 8, ambient = 0.34 } = {}) {
  const { width: w, height: h, data } = c;
  let H = new Float32Array(w * h);
  let minx = w, maxx = 0, miny = h, maxy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 60) { H[y * w + x] = 1; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
  }
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
  const spanX = Math.max(1, maxx - minx), spanY = Math.max(1, maxy - miny);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 200) continue;
    // form-normal term (small weight — just enough to feel round, not to dominate)
    const gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
    const nz = roundness, len = Math.hypot(-gx, -gy, nz) || 1;
    const nl = Math.max(0, (-gx * LIGHT[0] + -gy * LIGHT[1] + nz * LIGHT[2]) / len);
    // DIRECTIONAL term: 1 on the sun (top-left) side of the bbox, 0 on the far side
    const g = Math.max(0, Math.min(1, ((maxx - x) / spanX * 0.5 + (maxy - y) / spanY * 0.62) / 1.12));
    let L = ambient + 0.34 * nl + 0.42 * g;
    L = Math.max(0, Math.min(1, L));
    // CLEAN snap into 5 hard tone clusters — no dither (a smooth gradient dithered
    // everywhere is just noise). Base clusters are widest; the terminator falls on a
    // diagonal so it reads as directional light, not contour-hugging pillow banding.
    const lvl = L < 0.30 ? 0 : L < 0.46 ? 1 : L < 0.74 ? 2 : L < 0.88 ? 3 : 4;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    let out = rgb;
    if (lvl === 0) out = mixTo(rgb, COOL, 0.46);
    else if (lvl === 1) out = mixTo(rgb, COOL, 0.22);
    else if (lvl === 3) out = mixTo(rgb, WARM, 0.24);
    else if (lvl === 4) out = mixTo(rgb, WARM, 0.48);
    data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2];
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

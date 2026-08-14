// ╔══════════════════════════════════════════════════════════════════╗
// ║ scripts/sprite3d.mjs — render a sprite from a tiny 3D PRIMITIVE model.       ║
// ║ A creature = a list of spheres / capsules (sphere-chains) / quads posed in   ║
// ║ 3D. We rotate the model (Ry by facing, fixed iso Rx tilt), orthographically  ║
// ║ project, and rasterise with a Z-BUFFER so overlapping forms sort correctly.  ║
// ║ Each sphere is BALL-SHADED from its EXACT surface normal (no height-field /   ║
// ║ pillow hack) by one camera-space sun, quantised to a few hue-shifted bands.   ║
// ║ 8 facings come free by re-rendering at theta += 45°. Zero-dependency: plain   ║
// ║ RGBA buffers for scripts/png.mjs — the whole thing runs in JS at runtime.     ║
// ╚══════════════════════════════════════════════════════════════════╝

const COOL = [46, 44, 92];
const WARM = [255, 240, 202];
const INK = [22, 16, 30];
const hex = (h) => { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; };
const rgbOf = (col) => (typeof col === 'string' ? hex(col) : col);
const mixTo = (c, to, t) => [c[0] + (to[0] - c[0]) * t, c[1] + (to[1] - c[1]) * t, c[2] + (to[2] - c[2]) * t];

// one camera-space sun (upper-left-front) — fixed relative to the CAMERA, so every
// facing is lit the same way and the 8-frame turn reads cleanly.
const LIGHT = (() => { const v = [-0.45, 0.72, 0.55]; const m = Math.hypot(...v); return v.map((n) => n / m); })();

/** Ball-shade: exact normal · sun → 4 hue-shifted bands (cool shadow, warm hi). */
function shadeNormal(color, nx, ny, nz) {
  const d = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  const b = 0.30 + 0.70 * d;                          // ambient + lambert
  const lvl = b < 0.34 ? 0 : b < 0.58 ? 1 : b < 0.84 ? 2 : 3;
  if (lvl === 0) return mixTo(color, COOL, 0.44);
  if (lvl === 1) return mixTo(color, COOL, 0.20);
  if (lvl === 3) return mixTo(color, WARM, 0.34);
  return color;
}

// ── model builders ───────────────────────────────────────────────────────────
export const sphere = (c, r, color) => ({ t: 'sphere', c, r, color });
/** A capsule as a chain of spheres from a→b, radius ra→rb. */
export function capsule(a, b, ra, rb, color, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) { const u = i / n; out.push(sphere([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], ra + (rb - ra) * u, color)); }
  return out;
}
/** A flat quad (4 corners in model space) — blades, fins, wings, shields. */
export const quad = (pts, color, dark = 0.12) => ({ t: 'quad', pts, color, dark });

// ── transforms ───────────────────────────────────────────────────────────────
function rot(theta, tilt) {
  const cy = Math.cos(theta), sy = Math.sin(theta), cx = Math.cos(tilt), sx = Math.sin(tilt);
  return (p) => {
    const x = p[0] * cy + p[2] * sy;                  // Ry
    const z0 = -p[0] * sy + p[2] * cy;
    const y = p[1] * cx - z0 * sx;                    // Rx (iso tilt)
    const z = p[1] * sx + z0 * cx;
    return [x, y, z];
  };
}

/**
 * Render a model (flat array of primitives) to an RGBA canvas of `size`.
 * @param {Array} prims  spheres/quads (spread capsule() results in)
 * @param {object} o  { size, theta, tilt, scale, groundY, shadow }
 */
export function render(prims, { size = 64, theta = 0, tilt = 0.5, scale = 16, cx = 0, cy = 0.1, shadow = true } = {}) {
  const W = size, H = size;
  const data = new Uint8ClampedArray(W * H * 4);
  const zbuf = new Float32Array(W * H).fill(-1e9);
  const R = rot(theta, tilt);
  const ox = W / 2 - cx * scale, oy = H * 0.72 + cy * scale;   // feet near lower third
  const toScreen = (cc) => [ox + cc[0] * scale, oy - cc[1] * scale];

  // baked drop shadow: flatten every primitive centre onto the ground (y=0) plane
  if (shadow) {
    let sxs = [], minx = 1e9, maxx = -1e9, sumx = 0, k = 0;
    for (const p of prims) { const cc = R(p.t === 'quad' ? p.pts[0] : p.c); const s = toScreen([cc[0], 0, cc[2]]); sxs.push(s[0]); minx = Math.min(minx, s[0]); maxx = Math.max(maxx, s[0]); sumx += s[0]; k++; }
    void sxs;
    const gx = sumx / (k || 1), gw = Math.max(8, (maxx - minx) / 2 + 6), gh = gw * 0.34, gy = oy + 2;
    for (let y = -gh; y <= gh; y++) for (let x = -gw; x <= gw; x++) {
      if ((x * x) / (gw * gw) + (y * y) / (gh * gh) > 1) continue;
      const X = Math.round(gx + x), Y = Math.round(gy + y); if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = (Y * W + X) * 4; if (data[i + 3]) continue;
      data[i] = 20; data[i + 1] = 16; data[i + 2] = 26; data[i + 3] = 90;
    }
  }

  const put = (X, Y, depth, rgb) => {
    X = Math.round(X); Y = Math.round(Y); if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    const idx = Y * W + X; if (depth <= zbuf[idx]) return;
    zbuf[idx] = depth; const i = idx * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };

  for (const p of prims) {
    if (p.t === 'sphere') {
      const cc = R(p.c), [sx, sy] = toScreen(cc), rr = p.r * scale, col = rgbOf(p.color);
      for (let dy = -Math.ceil(rr); dy <= rr; dy++) for (let dx = -Math.ceil(rr); dx <= rr; dx++) {
        const q = (dx * dx + dy * dy) / (rr * rr); if (q > 1) continue;
        const nx = dx / rr, ny = -dy / rr, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        put(sx + dx, sy + dy, cc[2] + nz * p.r, shadeNormal(col, nx, ny, nz));
      }
    } else if (p.t === 'quad') {
      const cs = p.pts.map(R), ss = cs.map(toScreen);
      // face normal (camera space) for flat shading
      const u = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1], cs[1][2] - cs[0][2]];
      const v = [cs[2][0] - cs[0][0], cs[2][1] - cs[0][1], cs[2][2] - cs[0][2]];
      let nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nl = Math.hypot(...nrm) || 1; nrm = nrm.map((n) => n / nl); if (nrm[2] < 0) nrm = nrm.map((n) => -n);
      const rgb = shadeNormal(rgbOf(p.color), nrm[0], nrm[1], nrm[2]);
      const zc = (cs[0][2] + cs[1][2] + cs[2][2] + cs[3][2]) / 4;
      let minY = 1e9, maxY = -1e9; for (const s of ss) { minY = Math.min(minY, s[1]); maxY = Math.max(maxY, s[1]); }
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const xs = [];
        for (let i = 0; i < 4; i++) { const a = ss[i], b = ss[(i + 1) % 4]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])); }
        xs.sort((m, n) => m - n);
        for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.round(xs[j]); x <= Math.round(xs[j + 1]); x++) put(x, y, zc, rgb);
      }
    }
  }

  // 1px silhouette outline (colored-dark, like selout)
  const snap = new Uint8ClampedArray(data);
  const op = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : snap[(y * W + x) * 4 + 3]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (op(x, y) === 255) continue;
    let hit = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (op(x + dx, y + dy) === 255) { const j = ((y + dy) * W + (x + dx)) * 4; hit = [snap[j], snap[j + 1], snap[j + 2]]; break; }
    if (!hit) continue;
    const o = mixTo(hit, INK, 0.6).map(Math.round), i = (y * W + x) * 4;
    data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2]; data[i + 3] = 255;
  }

  return { width: W, height: H, data, project: (pt) => { const cc = R(pt); return [ox + cc[0] * scale, oy - cc[1] * scale, cc[2]]; } };
}

export { COOL, WARM };

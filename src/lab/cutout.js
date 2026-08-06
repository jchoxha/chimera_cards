// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: lab/cutout — IN-BROWSER chroma-key + autocrop, so part sprites can ║
// ║ be cut from a sheet on the GitHub Pages site with no Python and no local   ║
// ║ tooling (phone included).                                                  ║
// ║                                                                            ║
// ║ This is a faithful port of scripts/sprite_cutout.py, which is already      ║
// ║ proven on the HD-2D environment sprites: magenta → alpha, feather + despill ║
// ║ the JPEG fringe so no pink halo survives, autocrop to the sprite's bounds,  ║
// ║ downscale. Keeping the same constants means browser-cut and script-cut      ║
// ║ parts are interchangeable.                                                 ║
// ║                                                                            ║
// ║ The pixel maths is PURE (operates on a Uint8ClampedArray) so it is node-    ║
// ║ testable; only the thin wrappers at the bottom touch canvas/DOM.           ║
// ║ UPDATE WHEN: the keying constants change — keep sprite_cutout.py in step.  ║
// ╚══════════════════════════════════════════════════════════════════╝

/** Matches sprite_cutout.py. score = min(R,B) − G  →  ~255 on pure magenta. */
export const KEY = 90;    // above this: definitely background
export const SOFT = 45;   // between SOFT..KEY: edge → partial alpha + despill

/**
 * Knock the magenta backdrop out of RGBA pixels, in place.
 * @param {Uint8ClampedArray} data  RGBA, length w*h*4
 * @returns {number} how many pixels were made fully transparent
 */
export function keyMagenta(data, { key = KEY, soft = SOFT } = {}) {
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const score = Math.min(r, b) - g;
    if (score >= key) {
      data[i + 3] = 0;
      cleared++;
    } else if (score >= soft) {
      // feather the edge and pull green up toward min(R,B) to kill the pink fringe
      const t = (score - soft) / (key - soft);
      data[i + 3] = Math.round(255 * (1 - t));
      const ng = Math.round(g + (Math.min(r, b) - g) * t);
      data[i] = Math.min(r, ng + 40);
      data[i + 1] = ng;
      data[i + 2] = Math.min(b, ng + 40);
    }
  }
  return cleared;
}

/**
 * Tight bounds of the non-transparent pixels.
 * @returns {{x,y,w,h}|null} null when the region is entirely transparent
 */
export function alphaBounds(data, w, h, { threshold = 8 } = {}) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * How usable is a cut cell? Sheets sometimes come back with a subject that
 * bleeds to the edge, or a cell that is pure background. Surfacing this lets the
 * studio warn instead of silently registering a broken part.
 * @returns {{coverage:number, touchesEdge:boolean, empty:boolean}}
 */
export function assessCut(data, w, h) {
  const bounds = alphaBounds(data, w, h);
  if (!bounds) return { coverage: 0, touchesEdge: false, empty: true };
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 8) opaque++;
  const touchesEdge = bounds.x === 0 || bounds.y === 0
    || bounds.x + bounds.w >= w || bounds.y + bounds.h >= h;
  return { coverage: opaque / (w * h), touchesEdge, empty: false };
}

/**
 * The grid a sheet is cut on. Sheets are generated as cols×rows of variants.
 * `inset` trims a little off each cell so neighbouring items and grid seams
 * don't bleed in.
 */
export function cellRect(sheetW, sheetH, cols, rows, index, inset = 0.04) {
  const col = index % cols, row = Math.floor(index / cols);
  const cw = sheetW / cols, ch = sheetH / rows;
  const ix = cw * inset, iy = ch * inset;
  return { x: Math.round(col * cw + ix), y: Math.round(row * ch + iy),
    w: Math.round(cw - ix * 2), h: Math.round(ch - iy * 2) };
}

// ── DOM wrappers ─────────────────────────────────────────────────────────────

/** Load a URL (or blob/data URL) into an ImageBitmap-ish drawable. */
export function loadImage(src, { crossOrigin = 'anonymous' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = src;
  });
}

/**
 * Cut one cell out of a sheet: crop → chroma-key → autocrop → downscale → PNG.
 *
 * @param {HTMLImageElement|ImageBitmap} img
 * @param {{x,y,w,h}} rect       the cell to take
 * @param {{max?:number, pad?:number}} [opts]
 * @returns {{dataUrl:string, width:number, height:number, quality:object}}
 * @throws if the canvas is tainted (a cross-origin image without CORS headers)
 */
export function cutCell(img, rect, { max = 512, pad = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = rect.w; c.height = rect.h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

  let image;
  try {
    image = ctx.getImageData(0, 0, rect.w, rect.h);
  } catch {
    // Reading pixels from a cross-origin image without permissive CORS headers
    // throws a SecurityError. The studio offers Upload as the way around it.
    throw new Error('TAINTED');
  }

  keyMagenta(image.data);
  const quality = assessCut(image.data, rect.w, rect.h);
  if (quality.empty) throw new Error('that cell is empty — nothing but background');

  const b = alphaBounds(image.data, rect.w, rect.h);
  ctx.putImageData(image, 0, 0);

  // autocrop + a transparent margin so the sprite never sits flush to the edge
  const out = document.createElement('canvas');
  const scale = Math.min(1, max / Math.max(b.w, b.h));
  out.width = Math.max(1, Math.round(b.w * scale) + pad * 2);
  out.height = Math.max(1, Math.round(b.h * scale) + pad * 2);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(c, b.x, b.y, b.w, b.h, pad, pad, out.width - pad * 2, out.height - pad * 2);

  return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height, quality };
}

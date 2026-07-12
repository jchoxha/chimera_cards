// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/battle/cardArt3d — shared TCG card-face baking for the 3-D board.        ║
// ║ Both ACTION cards (the hand) and CREATURE cards (the board) draw their faces        ║
// ║ through the SAME gilded frame here, so the two card types read as one set:          ║
// ║ a double gold border, a header banner with a corner gem, an inset art window, a     ║
// ║ type ribbon, and a rules/lore box. Creatures leave the very bottom free for the     ║
// ║ live HP bar (drawn as a mesh over the baked face so it can update without a rebake). ║
// ╚══════════════════════════════════════════════════════════════════╝
import * as THREE from 'three';
import { ATTUNEMENT_COLOR } from '../../data/axisIcons.js';

const GOLD = '#c9922e', GOLD_HI = '#f0d68a';
const elColor = (el) => ATTUNEMENT_COLOR[el] || '#c9a66b';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function mix(hex, other, t) {   // simple hex lerp
  const a = parseInt(hex.slice(1), 16), b = parseInt(other.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

/** The shared gilded chrome (border + inner panel). The whole canvas is filled OPAQUE
 *  (dark) first so the card texture has no transparent pixels — it renders solid on the
 *  board / hand with correct occlusion (no see-through corners). */
export function drawShell(ctx, W, H, accent) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0705'; ctx.fillRect(0, 0, W, H);   // opaque backing (rounded corners read dark, not see-through)
  roundRect(ctx, 0, 0, W, H, 30); ctx.fillStyle = '#0d0906'; ctx.fill();
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mix('#241a10', accent, 0.18)); bg.addColorStop(0.5, '#1b130c'); bg.addColorStop(1, mix('#241a10', accent, 0.14));
  roundRect(ctx, 7, 7, W - 14, H - 14, 24); ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = GOLD; roundRect(ctx, 7, 7, W - 14, H - 14, 24); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = GOLD_HI; roundRect(ctx, 13.5, 13.5, W - 27, H - 27, 19); ctx.stroke();
}

function header(ctx, W, accent, title, cornerText, cornerCol) {
  const x = 22, y = 24, w = W - 44, h = 62;
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, mix('#1c130b', accent, 0.6)); g.addColorStop(1, '#1c130b');
  roundRect(ctx, x, y, w, h, 12); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = mix(GOLD, accent, 0.4); ctx.stroke();
  // corner gem
  const cx = x + 34, cy = y + h / 2;
  const gem = ctx.createRadialGradient(cx - 8, cy - 8, 3, cx, cy, 28);
  gem.addColorStop(0, '#fff'); gem.addColorStop(0.4, cornerCol); gem.addColorStop(1, mix(cornerCol, '#000000', 0.55));
  ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.fillStyle = gem; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = GOLD_HI; ctx.stroke();
  if (cornerText != null && cornerText !== '') {
    ctx.fillStyle = '#160f08'; ctx.font = 'bold 32px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(cornerText), cx, cy + 1);
  }
  // title
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f6e7b0';
  let name = String(title || '');
  ctx.font = 'bold 30px Cinzel, Georgia, serif';
  while (ctx.measureText(name).width > w - 84 && name.length > 3) name = name.slice(0, -2);
  ctx.fillText(name + (name !== String(title || '') ? '…' : ''), x + 68, cy + 1);
  return y + h;
}

function artWindow(ctx, W, top, h, accent, img) {
  const x = 24, w = W - 48;
  roundRect(ctx, x, top, w, h, 10); ctx.save(); ctx.clip();
  ctx.fillStyle = mix('#0d0805', accent, 0.12); ctx.fillRect(x, top, w, h);
  if (img) {
    try {
      const ir = img.width / img.height, wr = w / h;
      let dw = w, dh = h, dx = x, dy = top;
      if (ir > wr) { dh = h; dw = h * ir; dx = x - (dw - w) / 2; } else { dw = w; dh = w / ir; dy = top - (dh - h) / 2; }
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch { /* ignore */ }
  }
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = mix(GOLD, accent, 0.35); roundRect(ctx, x, top, w, h, 10); ctx.stroke();
  return top + h;
}

function ribbon(ctx, W, top, accent, text) {
  ctx.font = 'bold 22px Cinzel, Georgia, serif';
  const tw = ctx.measureText(text).width + 40;
  const x = (W - tw) / 2, h = 34;
  roundRect(ctx, x, top, tw, h, 17); ctx.fillStyle = mix('#160f08', accent, 0.5); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = mix(GOLD, accent, 0.5); ctx.stroke();
  ctx.fillStyle = '#f6e7b0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, top + h / 2 + 1);
  return top + h;
}

function textBox(ctx, W, top, bottom, lines, { size = 27, color = '#e6d8b8' } = {}) {
  const x = 24, w = W - 48;
  roundRect(ctx, x, top, w, bottom - top, 9); ctx.fillStyle = '#0c0805cc'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a431f88'; ctx.stroke();
  ctx.fillStyle = color; ctx.font = `600 ${size}px Georgia`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const words = String(lines || '').split(/\s+/); let line = ''; let yy = top + 13;
  const lh = size + 7, pad = 14;
  for (const word of words) {
    if (ctx.measureText(line + word).width > w - pad * 2 && line) { ctx.fillText(line, x + pad, yy); line = word + ' '; yy += lh; if (yy > bottom - size) break; }
    else line += word + ' ';
  }
  if (line && yy <= bottom - size + 4) ctx.fillText(line, x + pad, yy);
}

/** Bake an ACTION card face (cost gem · name · art · scope ribbon · rules).
 *  The art window is smaller than a creature card's so the RULES text can be set MUCH
 *  larger (readable at hand size without inspecting) — the trade-off cards can afford. */
export function drawActionFace(ctx, card, img, { W = 384, H = 540, scopeWord = 'Vanguard', typeWord = 'Attack' } = {}) {
  const accent = elColor(card.element);
  drawShell(ctx, W, H, accent);
  const hb = header(ctx, W, accent, card.name, card.cost ?? '', accent);
  const artBottom = artWindow(ctx, W, hb + 10, 184, accent, img);
  const rb = ribbon(ctx, W, artBottom + 10, accent, `${scopeWord} · ${typeWord}`);
  textBox(ctx, W, rb + 10, H - 22, card.text || '', { size: 27 });
}

/** Bake a CREATURE card face (HP is drawn LIVE as a mesh over the reserved bottom band). */
export function drawCreatureFace(ctx, u, img, { W = 384, H = 528 } = {}) {
  const accent = elColor(u.element);
  drawShell(ctx, W, H, accent);
  const nm = u.sizeWord ? `${u.sizeWord} ${u.name}` : u.name;
  const hb = header(ctx, W, accent, nm, '', accent);
  const artBottom = artWindow(ctx, W, hb + 12, 262, accent, img);
  const typ = [u.axes?.biology, u.axes?.attunement].filter(Boolean).join(' · ') || (u.element || 'Creature');
  ribbon(ctx, W, artBottom + 12, accent, typ);
  // the bottom ~78px is left for the live HP bar mesh — draw its recessed plate only
  const y = H - 74, x = 26, w = W - 52;
  roundRect(ctx, x, y, w, 52, 9); ctx.fillStyle = '#0c0805cc'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a431f88'; ctx.stroke();
}

/** The shared physical REVERSE side of every card — an ornate gilded medallion on a
 *  warm filigree field (matches the front frame's gold-on-wood artstyle). Baked once. */
export function drawCardBack(ctx, W, H) {
  ctx.fillStyle = '#0a0705'; ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 0, 0, W, H, 30); ctx.fillStyle = '#160d07'; ctx.fill();
  roundRect(ctx, 16, 16, W - 32, H - 32, 20); ctx.save(); ctx.clip();
  const g = ctx.createRadialGradient(W / 2, H / 2, 16, W / 2, H / 2, H * 0.62);
  g.addColorStop(0, '#452a14'); g.addColorStop(0.6, '#241408'); g.addColorStop(1, '#100803');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(201,146,46,0.15)'; ctx.lineWidth = 3;
  for (let d = -H; d < W; d += 34) {
    ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d + H, 0); ctx.lineTo(d, H); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = GOLD; roundRect(ctx, 10, 10, W - 20, H - 20, 22); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = GOLD_HI; roundRect(ctx, 17, 17, W - 34, H - 34, 17); ctx.stroke();
  const cx = W / 2, cy = H / 2;
  ctx.beginPath(); ctx.arc(cx, cy, H * 0.205, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = GOLD; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, H * 0.16, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = GOLD_HI; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, H * 0.118, 0, Math.PI * 2); ctx.fillStyle = '#160d07'; ctx.fill();
  ctx.strokeStyle = 'rgba(240,214,138,0.55)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * H * 0.122, cy + Math.sin(a) * H * 0.122); ctx.lineTo(cx + Math.cos(a) * H * 0.155, cy + Math.sin(a) * H * 0.155); ctx.stroke(); }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = GOLD; ctx.fillRect(-H * 0.05, -H * 0.05, H * 0.1, H * 0.1); ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, H * 0.052, 0, Math.PI * 2); ctx.fillStyle = '#160d07'; ctx.fill();
  ctx.fillStyle = GOLD_HI; ctx.font = `bold ${Math.round(H * 0.1)}px Cinzel, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('C', cx, cy + H * 0.006);
  ctx.fillStyle = GOLD;
  for (const [x, y] of [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); }
}

let _backTex = null;
export function cardBackTexture() {
  if (_backTex) return _backTex;
  const { texture } = makeFaceTexture(256, 356, (ctx) => drawCardBack(ctx, 256, 356));
  _backTex = texture; return _backTex;
}

export function makeFaceTexture(W, H, draw) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { texture: t, canvas: c };
}

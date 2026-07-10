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

/** The shared gilded chrome (border + inner panel). Returns key rects for the caller. */
export function drawShell(ctx, W, H, accent) {
  ctx.clearRect(0, 0, W, H);
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

function textBox(ctx, W, top, bottom, lines, { size = 21, color = '#d8c7a2' } = {}) {
  const x = 26, w = W - 52;
  roundRect(ctx, x, top, w, bottom - top, 9); ctx.fillStyle = '#0c0805cc'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a431f88'; ctx.stroke();
  ctx.fillStyle = color; ctx.font = `${size}px Georgia`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const words = String(lines || '').split(/\s+/); let line = ''; let yy = top + 12;
  for (const word of words) {
    if (ctx.measureText(line + word).width > w - 20 && line) { ctx.fillText(line, x + 10, yy); line = word + ' '; yy += size + 6; if (yy > bottom - size) break; }
    else line += word + ' ';
  }
  if (line && yy <= bottom - size + 4) ctx.fillText(line, x + 10, yy);
}

/** Bake an ACTION card face (cost gem · name · art · scope ribbon · rules). */
export function drawActionFace(ctx, card, img, { W = 384, H = 540, scopeWord = 'Vanguard', typeWord = 'Attack' } = {}) {
  const accent = elColor(card.element);
  drawShell(ctx, W, H, accent);
  const hb = header(ctx, W, accent, card.name, card.cost ?? '', accent);
  const artBottom = artWindow(ctx, W, hb + 12, 250, accent, img);
  const rb = ribbon(ctx, W, artBottom + 12, accent, `${scopeWord} · ${typeWord}`);
  textBox(ctx, W, rb + 12, H - 26, card.text || '');
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

export function makeFaceTexture(W, H, draw) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { texture: t, canvas: c };
}

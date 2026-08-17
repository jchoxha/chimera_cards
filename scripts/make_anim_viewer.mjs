// Dev tool: build a SELF-CONTAINED HTML viewer for a creature's animation sheet
// (the sheet PNG is embedded as a data URI, so the file opens anywhere with no
// server). Shows every direction looping + an arrow-key "walk around" demo.
//   node scripts/make_anim_viewer.mjs voltfang walk [outfile.html]
import { readFileSync, writeFileSync } from 'fs';

const id = process.argv[2] || 'voltfang';
const action = process.argv[3] || 'walk';
const out = process.argv[4] || `/tmp/${id}-${action}-viewer.html`;
const dir = 'public/art/anim';

const manifest = JSON.parse(readFileSync(`${dir}/${id}-${action}.json`, 'utf8'));
const b64 = readFileSync(`${dir}/${manifest.sheet}`).toString('base64');
const M = JSON.stringify({ ...manifest });

const html = `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${id} · ${action}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#14121a;color:#e8e4f0;font:15px/1.5 system-ui,sans-serif;padding:24px;display:flex;flex-direction:column;gap:26px;align-items:center}
  h1{font-size:20px;margin:0;font-weight:650} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#9b93b4;margin:0 0 10px}
  canvas{image-rendering:pixelated;background:#0d0b12;border-radius:8px}
  .row{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
  .cell{display:flex;flex-direction:column;align-items:center;gap:6px}
  .cell span{font-size:12px;color:#9b93b4}
  .panel{background:#1d1a26;border:1px solid #2c2838;border-radius:12px;padding:18px 20px}
  .hint{font-size:13px;color:#9b93b4;text-align:center;max-width:520px}
  .field{background:#0d0b12;border-radius:10px;touch-action:none}
  input[type=range]{width:180px;vertical-align:middle}
  .ctl{display:flex;gap:16px;align-items:center;font-size:13px;color:#c7c1d8}
  b{color:#7fe3ff}
</style></head><body>
<h1>${id} — ${action} <span style="color:#9b93b4;font-weight:400">(${manifest.size}px · ${manifest.directions.length} directions)</span></h1>

<div class="panel">
  <h2>All directions (looping)</h2>
  <div class="row" id="strip"></div>
  <div class="ctl" style="margin-top:14px;justify-content:center">
    <label>Speed <input id="fps" type="range" min="1" max="14" value="7"></label>
    <span id="fpsv">7 fps</span>
  </div>
</div>

<div class="panel">
  <h2>Walk around — arrow keys / WASD (or drag on touch)</h2>
  <canvas class="field" id="field" width="480" height="300" tabindex="0"></canvas>
  <div class="hint">Click the field first, then hold an arrow key. Voltfang faces where it walks and idles when still.</div>
</div>

<script>
const MAN = ${M};
const SHEET = new Image();
SHEET.src = "data:image/png;base64,${b64}";
const S = MAN.size, N = MAN.frames, DIRS = MAN.directions; // e.g. [south,east,north,west]
const rowOf = {}; DIRS.forEach((d,i)=>rowOf[d]=i);
const SCALE = 4;

function drawCell(ctx, dx, dy, dir, frame, scale){
  const r = rowOf[dir] ?? 0;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(SHEET, frame*S, r*S, S, S, dx, dy, S*scale, S*scale);
}

// ── strip: one looping canvas per direction ──
const strip = document.getElementById('strip');
const cells = DIRS.map(d=>{
  const wrap=document.createElement('div'); wrap.className='cell';
  const c=document.createElement('canvas'); c.width=S*SCALE; c.height=S*SCALE;
  const lbl=document.createElement('span'); lbl.textContent=d;
  wrap.append(c,lbl); strip.append(wrap);
  return {dir:d, ctx:c.getContext('2d')};
});

let fps=7; const fpsEl=document.getElementById('fps'), fpsv=document.getElementById('fpsv');
fpsEl.oninput=()=>{fps=+fpsEl.value; fpsv.textContent=fps+' fps';};

// ── field: movable sprite ──
const field=document.getElementById('field'), fctx=field.getContext('2d');
const keys={}; let px=240, py=150, facing='south', moving=false;
const K={ArrowUp:'north',ArrowDown:'south',ArrowLeft:'west',ArrowRight:'east',w:'north',s:'south',a:'west',d:'east'};
addEventListener('keydown',e=>{ if(K[e.key]){keys[K[e.key]]=1; e.preventDefault();}});
addEventListener('keyup',e=>{ if(K[e.key]) keys[K[e.key]]=0; });
// touch drag
let touch=null;
field.addEventListener('pointerdown',e=>{touch={x:e.offsetX,y:e.offsetY}; field.focus();});
addEventListener('pointerup',()=>touch=null);
field.addEventListener('pointermove',e=>{ if(touch) touch={x:e.offsetX,y:e.offsetY}; });

let t0=performance.now();
function loop(now){
  const dt=(now-t0)/1000; t0=now;
  const frame=Math.floor(now/1000*fps)%N;
  // strip
  cells.forEach(c=>{ c.ctx.clearRect(0,0,S*SCALE,S*SCALE); drawCell(c.ctx,0,0,c.dir,frame,SCALE); });
  // field movement
  let vx=0,vy=0;
  if(keys.north)vy-=1; if(keys.south)vy+=1; if(keys.west)vx-=1; if(keys.east)vx+=1;
  if(touch){ const dx=touch.x-px, dy=touch.y-py; if(Math.hypot(dx,dy)>6){ vx=dx; vy=dy; } }
  moving = vx||vy;
  if(moving){
    const len=Math.hypot(vx,vy)||1; const spd=90*dt;
    px+=vx/len*spd; py+=vy/len*spd;
    px=Math.max(24,Math.min(field.width-24,px)); py=Math.max(24,Math.min(field.height-24,py));
    facing = Math.abs(vx)>Math.abs(vy) ? (vx>0?'east':'west') : (vy>0?'south':'north');
  }
  fctx.clearRect(0,0,field.width,field.height);
  // ground grid
  fctx.strokeStyle='#1c1926'; fctx.lineWidth=1;
  for(let x=0;x<field.width;x+=30){fctx.beginPath();fctx.moveTo(x,0);fctx.lineTo(x,field.height);fctx.stroke();}
  for(let y=0;y<field.height;y+=30){fctx.beginPath();fctx.moveTo(0,y);fctx.lineTo(field.width,y);fctx.stroke();}
  const fr = moving?frame:0;
  drawCell(fctx, px-S*SCALE/2, py-S*SCALE/2, facing, fr, SCALE);
  requestAnimationFrame(loop);
}
SHEET.onload=()=>requestAnimationFrame(loop);
</script></body></html>`;

writeFileSync(out, html);
console.log(`→ ${out} (${(html.length/1024|0)} KB, sheet embedded)`);

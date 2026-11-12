import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
const out = process.argv[3] || 'scratch/preview.html';

const ctx = { window: {}, console, Math, JSON, Date, performance };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/model.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/cad-io.js', 'utf8'), ctx);
const FC = ctx.window.FC;
const plan = FC.CAD.importDXF(fs.readFileSync(file, 'utf8'), { filename: file });

const b = FC.planBounds(plan);
const pad = 0.6;
const W = b.w + pad * 2;
const H = b.d + pad * 2;
const S = 22;
const tx = (p) => ((p.x - b.x0 + pad) * S).toFixed(1);
const ty = (p) => ((p.y - b.y0 + pad) * S).toFixed(1);

const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${(W * S).toFixed(0)}" height="${(H * S).toFixed(0)}" style="background:#faf9f6">`);
// grid
for (let gx = Math.floor(b.x0); gx <= b.x1 + 1; gx++) {
  parts.push(`<line x1="${tx({ x: gx })}" y1="0" x2="${tx({ x: gx })}" y2="${H * S}" stroke="#eceaf3" stroke-width="1"/>`);
}
for (let gy = Math.floor(b.y0); gy <= b.y1 + 1; gy++) {
  parts.push(`<line x1="0" y1="${ty({ y: gy })}" x2="${W * S}" y2="${ty({ y: gy })}" stroke="#eceaf3" stroke-width="1"/>`);
}
// rooms
plan.rooms.forEach((r) => {
  const pts = r.polygon.map((p) => `${tx(p)},${ty(p)}`).join(' ');
  parts.push(`<polygon points="${pts}" fill="#e9e3d6" stroke="none" opacity="0.55"/>`);
});
// outline
const oPts = plan.outline.map((p) => `${tx(p)},${ty(p)}`).join(' ');
parts.push(`<polygon points="${oPts}" fill="none" stroke="#1b1b1f" stroke-width="${(plan.settings.extThickness * S).toFixed(1)}" stroke-linejoin="round"/>`);
// walls
plan.walls.forEach((w) => {
  parts.push(
    `<line x1="${tx(w.a)}" y1="${ty(w.a)}" x2="${tx(w.b)}" y2="${ty(w.b)}" stroke="#1b1b1f" stroke-width="${(plan.settings.intThickness * S).toFixed(1)}" stroke-linecap="butt"/>`
  );
});
// openings
const segs = FC.getSegments(plan);
plan.openings.forEach((op) => {
  const pl = FC.openingPlacement(plan, op, segs);
  if (!pl) return;
  const half = pl.width / 2;
  const cos = Math.cos(pl.angle);
  const sin = Math.sin(pl.angle);
  const p1 = { x: pl.x - cos * half, y: pl.y - sin * half };
  const p2 = { x: pl.x + cos * half, y: pl.y + sin * half };
  const color = op.kind === 'window' ? '#0284c7' : '#c2410c';
  parts.push(`<line x1="${tx(p1)}" y1="${ty(p1)}" x2="${tx(p2)}" y2="${ty(p2)}" stroke="#ffffff" stroke-width="${(plan.settings.extThickness * S + 2).toFixed(1)}"/>`);
  parts.push(`<line x1="${tx(p1)}" y1="${ty(p1)}" x2="${tx(p2)}" y2="${ty(p2)}" stroke="${color}" stroke-width="2.5"/>`);
});
// room labels
plan.rooms.forEach((r) => {
  if (!r.centroid) return;
  parts.push(
    `<text x="${tx(r.centroid)}" y="${ty(r.centroid)}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="#3a3a42" text-anchor="middle">${(r.name || r.type)} ${(r.area || 0).toFixed(1)}</text>`
  );
});
parts.push('</svg>');

const html = `<!doctype html><meta charset="utf-8"><title>CAD import preview</title><div style="margin:0;padding:10px;font-family:Inter,system-ui,sans-serif">${parts.join('\n')}</div>`;
fs.writeFileSync(out, html);
console.log('wrote', out, 'walls', plan.walls.length, 'rooms', plan.rooms.length);

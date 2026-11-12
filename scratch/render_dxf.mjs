import fs from 'node:fs';

const file = process.argv[2];
const out = process.argv[3] || 'scratch/preview-dxf.html';
const only = process.argv[4];

const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
let i = 0;
const ents = [];
let cur = null;
let inEntities = false;
const next = () => {
  if (i >= lines.length) return null;
  const code = parseInt(lines[i++].trim(), 10);
  const val = i < lines.length ? lines[i++].trim() : '';
  return { code, val };
};
while (i < lines.length) {
  const p = next();
  if (!p) break;
  if (p.code === 0 && p.val === 'SECTION') {
    const s = next();
    if (s && s.val === 'ENTITIES') inEntities = true;
  } else if (p.code === 0 && p.val === 'ENDSEC') {
    inEntities = false;
  } else if (inEntities && p.code === 0) {
    if (cur) ents.push(cur);
    cur = { type: p.val, props: {} };
  } else if (inEntities && cur) {
    (cur.props[p.code] = cur.props[p.code] || []).push(p.val);
  }
}
if (cur) ents.push(cur);

const color = (layer) => {
  if (/window/i.test(layer)) return ['#0284c7', 0.9];
  if (/door/i.test(layer)) return ['#dc2626', 0.9];
  if (/outer|exterior/i.test(layer)) return ['#111827', 1];
  if (/inner|internal/i.test(layer)) return ['#2563eb', 0.8];
  if (/blue/i.test(layer)) return ['#7c3aed', 0.7];
  if (/construct/i.test(layer)) return ['#f59e0b', 0.5];
  return ['#9ca3af', 0.6];
};

// bounds from wall-ish layers only
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (const e of ents) {
  const layer = (e.props[8] || [''])[0] || '0';
  if (!/outer|exterior|inner|internal|blue/i.test(layer)) continue;
  const xs = [...(e.props[10] || []), ...(e.props[11] || [])].map(parseFloat);
  const ys = [...(e.props[20] || []), ...(e.props[21] || [])].map(parseFloat);
  xs.forEach((x) => { if (Number.isFinite(x) && Math.abs(x) < 5000) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } });
  ys.forEach((y) => { if (Number.isFinite(y) && Math.abs(y) < 5000) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
}
const S = Math.min(860 / (x1 - x0), 700 / (y1 - y0));
const tx = (x) => ((x - x0) * S).toFixed(1);
const ty = (y) => ((y1 - y) * S).toFixed(1);

const parts = [];
ents.forEach((e) => {
  const layer = (e.props[8] || [''])[0] || '0';
  if (only && layer !== only) return;
  const [c, o] = color(layer);
  if (e.type === 'LINE') {
    const n = (k) => parseFloat((e.props[k] || ['0'])[0]);
    const x1v = n(10), y1v = n(20), x2v = n(11), y2v = n(21);
    if (Math.abs(x1v) > 5000 || Math.abs(y1v) > 5000) return;
    parts.push(`<line x1="${tx(x1v)}" y1="${ty(y1v)}" x2="${tx(x2v)}" y2="${ty(y2v)}" stroke="${c}" stroke-width="1.6" opacity="${o}" stroke-linecap="round"/>`);
  } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
    const xs = (e.props[10] || []).map(parseFloat);
    const ys = (e.props[20] || []).map(parseFloat);
    const pts = xs.map((x, k) => `${tx(x)},${ty(ys[k])}`).join(' ');
    parts.push(`<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.8" opacity="${o}"/>`);
  } else if (e.type === 'INSERT') {
    const n = (k) => parseFloat((e.props[k] || ['0'])[0]);
    const x = n(10), y = n(20);
    if (Math.abs(x) > 5000 || Math.abs(y) > 5000) return;
    parts.push(`<circle cx="${tx(x)}" cy="${ty(y)}" r="3.5" fill="none" stroke="${c}" opacity="${o}" stroke-width="1.5"/>`);
  } else if (e.type === 'ARC') {
    const n = (k) => parseFloat((e.props[k] || ['0'])[0]);
    const cx = n(10), cy = n(20), r = n(40);
    parts.push(`<circle cx="${tx(cx)}" cy="${ty(cy)}" r="${(r * S).toFixed(1)}" fill="none" stroke="${c}" opacity="0.5" stroke-width="1.2" stroke-dasharray="3 3"/>`);
  }
});

const legend = ['Outer Walls', 'Inner Walls', 'Blue idk', 'Windows', 'Doors', '0']
  .map((l) => {
    const [c] = color(l);
    return `<span style="display:inline-flex;gap:6px;align-items:center;margin-right:14px"><i style="width:14px;height:3px;background:${c};display:inline-block"></i>${l}</span>`;
  })
  .join('');

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111827">
<div style="padding:8px 12px;font:12px Inter,system-ui,sans-serif;color:#e5e7eb">${legend}</div>
<svg xmlns="http://www.w3.org/2000/svg" width="${((x1 - x0) * S).toFixed(0)}" height="${((y1 - y0) * S).toFixed(0)}">
${parts.join('\n')}
</svg></body>`;
fs.writeFileSync(out, html);
console.log('wrote', out, 'entities', parts.length, 'bounds', [x0, y0, x1, y1].map((v) => Math.round(v)));

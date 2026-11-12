import fs from 'node:fs';

const text = fs.readFileSync(process.argv[2], 'utf8');
const lines = text.split(/\r?\n/);
let i = 0;
const entities = [];
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
    if (cur) entities.push(cur);
    cur = { type: p.val, props: {} };
  } else if (inEntities && cur) {
    (cur.props[p.code] = cur.props[p.code] || []).push(p.val);
  }
}
if (cur) entities.push(cur);

const stat = new Map();
for (const e of entities) {
  const layer = (e.props[8] || [''])[0] || '0';
  const nums = (c) => (e.props[c] || []).map(parseFloat).filter(Number.isFinite);
  const xs = [...nums(10), ...nums(11)];
  const ys = [...nums(20), ...nums(21)];
  if (!xs.length) continue;
  const rec = stat.get(layer) || { layer, n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  rec.n++;
  rec.x0 = Math.min(rec.x0, ...xs);
  rec.x1 = Math.max(rec.x1, ...xs);
  rec.y0 = Math.min(rec.y0, ...ys);
  rec.y1 = Math.max(rec.y1, ...ys);
  stat.set(layer, rec);
}
[...stat.values()]
  .sort((a, b) => b.n - a.n)
  .forEach((r) =>
    console.log(
      r.layer.padEnd(22),
      String(r.n).padStart(4),
      'x',
      r.x0.toFixed(0).padStart(6),
      '..',
      r.x1.toFixed(0).padStart(6),
      '  y',
      r.y0.toFixed(0).padStart(6),
      '..',
      r.y1.toFixed(0).padStart(6)
    )
  );

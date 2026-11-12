import fs from 'node:fs';

const text = fs.readFileSync(process.argv[2], 'utf8');
const [x0, y0, x1, y1] = process.argv.slice(3, 7).map(Number);
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

for (const e of ents) {
  const layer = (e.props[8] || [''])[0] || '0';
  const nums = (c) => (e.props[c] || []).map(parseFloat).filter(Number.isFinite);
  const xs = [...nums(10), ...nums(11)];
  const ys = [...nums(20), ...nums(21)];
  if (!xs.length) continue;
  const inside = xs.some((x) => x >= x0 && x <= x1) && ys.some((y) => y >= y0 && y <= y1);
  if (!inside) continue;
  if (e.type === 'LINE') {
    console.log(layer.padEnd(14), 'LINE', `(${xs[0]},${ys[0]}) -> (${xs[1]},${ys[1]})`);
  } else if (e.type === 'INSERT') {
    console.log(layer.padEnd(14), 'INSERT', (e.props[2] || [''])[0], `at (${xs[0]},${ys[0]}) rot ${(e.props[50] || [''])[0]}`);
  } else {
    console.log(layer.padEnd(14), e.type, `(${xs[0]},${ys[0]}) .. (${xs[xs.length - 1]},${ys[ys.length - 1]})`);
  }
}

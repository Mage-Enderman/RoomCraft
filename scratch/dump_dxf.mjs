import fs from 'node:fs';

const text = fs.readFileSync(process.argv[2], 'utf8');
const onlyLayer = process.argv[3];
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

const groups = new Map();
for (const e of entities) {
  const layer = (e.props[8] || [''])[0] || '0';
  if (onlyLayer && layer !== onlyLayer) continue;
  if (!groups.has(layer)) groups.set(layer, []);
  groups.get(layer).push(e);
}

for (const [layer, ents] of groups) {
  console.log(`\n--- layer ${JSON.stringify(layer)} (${ents.length}) ---`);
  for (const e of ents) {
    if (e.type === 'LINE') {
      const n = (c) => Math.round(parseFloat((e.props[c] || ['0'])[0]) * 1000) / 1000;
      console.log(`LINE (${n(10)},${n(20)}) -> (${n(11)},${n(21)})`);
    } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
      const xs = (e.props[10] || []).map((v) => Math.round(parseFloat(v) * 1000) / 1000);
      const ys = (e.props[20] || []).map((v) => Math.round(parseFloat(v) * 1000) / 1000);
      const closed = ((parseInt((e.props[70] || ['0'])[0], 10) || 0) & 1) !== 0;
      const pts = xs.map((x, k) => `(${x},${ys[k]})`).join(' ');
      console.log(`${e.type}${closed ? ' closed' : ''} [${xs.length}] ${pts}`);
    } else if (e.type === 'INSERT') {
      const n = (c) => Math.round(parseFloat((e.props[c] || ['0'])[0]) * 1000) / 1000;
      console.log(`INSERT ${(e.props[2] || [''])[0]} at (${n(10)},${n(20)}) rot ${(e.props[50] || ['0'])[0]} scale ${(e.props[41] || [''])[0]},${(e.props[42] || [''])[0]}`);
    } else if (e.type === 'ARC') {
      const n = (c) => Math.round(parseFloat((e.props[c] || ['0'])[0]) * 1000) / 1000;
      console.log(`ARC c(${n(10)},${n(20)}) r ${n(40)} ${(e.props[50] || [''])[0]}->${(e.props[51] || [''])[0]}`);
    } else {
      console.log(e.type);
    }
  }
}

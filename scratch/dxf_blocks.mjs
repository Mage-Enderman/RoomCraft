import fs from 'node:fs';

const text = fs.readFileSync(process.argv[2], 'utf8');
const lines = text.split(/\r?\n/);
const out = [];
for (let i = 0; i < lines.length - 1; i += 2) {
  out.push({ code: parseInt(lines[i].trim(), 10), val: lines[i + 1].trim() });
}

let inBlocks = false;
let cur = null;
const blocks = [];
const insertsByBlock = new Map();

for (let k = 0; k < out.length; k++) {
  const { code, val } = out[k];
  if (code === 0 && val === 'SECTION') {
    const nextVal = out[k + 1];
    inBlocks = nextVal && nextVal.val === 'BLOCKS';
    continue;
  }
  if (code === 0 && val === 'ENDSEC') {
    inBlocks = false;
    if (cur) blocks.push(cur);
    cur = null;
    continue;
  }
  if (inBlocks && code === 0 && val === 'BLOCK') {
    if (cur) blocks.push(cur);
    cur = { name: '', entities: 0, types: new Set(), pts: [] };
    continue;
  }
  if (inBlocks && cur) {
    if (code === 2 && !cur.name) cur.name = val;
    if (code === 0) { cur.entities++; cur.types.add(val); }
    if (code === 10) cur.pts.push(parseFloat(val));
    if (code === 20) cur.pts.push(parseFloat(val));
    continue;
  }
  if (code === 0 && val === 'INSERT') {
    const namePair = out.slice(k, k + 12).find((p) => p.code === 2);
    if (namePair) insertsByBlock.set(namePair.val, (insertsByBlock.get(namePair.val) || 0) + 1);
  }
}

blocks
  .filter((b) => b.name)
  .sort((a, b) => b.entities - a.entities)
  .slice(0, 40)
  .forEach((b) => console.log(b.name.padEnd(28), String(b.entities).padStart(4), 'entities', [...b.types].filter((t) => t !== 'BLOCK').join(','), ' inserts:', insertsByBlock.get(b.name) || 0));

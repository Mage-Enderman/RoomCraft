import fs from 'node:fs';
import { LibreDwg, Dwg_File_Type } from '../vendor/libredwg/libredwg-web.js';

const wasmDir = new URL('../vendor/libredwg/', import.meta.url).href;
const lib = await LibreDwg.create(wasmDir);
const bytes = new Uint8Array(fs.readFileSync(process.argv[2]));
const data = lib.dwg_read_data(bytes, Dwg_File_Type.DWG);
const db = lib.convert(data);
lib.dwg_free(data);

const ents = db.entities;
console.log('entities', ents.length);
const byLayer = new Map();
for (const e of ents) {
  const k = (e.layer || '0') + ' | ' + e.type;
  byLayer.set(k, (byLayer.get(k) || 0) + 1);
}
[...byLayer.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ', k.padEnd(38), n));

console.log('\nINSERTs:');
ents
  .filter((e) => e.type === 'INSERT')
  .forEach((e) => {
    const p = e.insertionPoint || {};
    console.log('  ', String(e.layer).padEnd(12), String(e.name || e.blockName || '').padEnd(22), 'at', [p.x, p.y].map((v) => (typeof v === 'number' ? v.toFixed(1) : v)).join(','), 'rot', e.rotation, 'scale', e.xScale, e.yScale);
  });

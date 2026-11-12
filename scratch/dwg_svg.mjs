import fs from 'node:fs';
import { LibreDwg, Dwg_File_Type } from '../vendor/libredwg/libredwg-web.js';

const wasmDir = new URL('../vendor/libredwg/', import.meta.url).href;
const lib = await LibreDwg.create(wasmDir);
const bytes = new Uint8Array(fs.readFileSync(process.argv[2]));
const out = process.argv[3] || 'scratch/preview-dwg.html';
const data = lib.dwg_read_data(bytes, Dwg_File_Type.DWG);
const db = lib.convert(data);
lib.dwg_free(data);
const svg = lib.dwg_to_svg(db);
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${svg}</body>`);
console.log('wrote', out, 'entities', db.entities.length, 'blocks', (db.blocks || []).length);

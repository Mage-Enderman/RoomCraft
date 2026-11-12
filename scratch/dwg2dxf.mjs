import fs from 'node:fs';
import path from 'node:path';
import { LibreDwg } from '../vendor/libredwg/libredwg-web.js';

const wasmDir = new URL('../vendor/libredwg/', import.meta.url).href;
const lib = await LibreDwg.create(wasmDir);

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error('usage: node scratch/dwg2dxf.mjs <file.dwg> [more.dwg]');
  process.exit(1);
}

for (const input of inputs) {
  const bytes = new Uint8Array(fs.readFileSync(input));
  const dxf = lib.dwg_write_dxf(bytes);
  if (!dxf || !dxf.length) {
    console.error('conversion failed:', input);
    process.exitCode = 1;
    continue;
  }
  const out = path.join('scratch/fixtures', path.basename(input).replace(/\.dwg$/i, '.dxf'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(new TextDecoder('utf-8').decode(dxf)));
  console.log(out, fs.statSync(out).size, 'bytes');
}

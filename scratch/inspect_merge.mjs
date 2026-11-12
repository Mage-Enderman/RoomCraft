import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
const logs = [];
const ctx = { window: {}, console: { log: (...a) => logs.push(a), error: console.error }, Math, JSON, Date, performance };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/model.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/cad-io.js', 'utf8'), ctx);
const FC = ctx.window.FC;
const text = fs.readFileSync(file, 'utf8');
FC.CAD.importDXF(text, { filename: file, debug: true });

const rawMerged = logs.find((a) => a[0] === 'CAD debug raw/merged');
const raw = rawMerged[1];
const merged = rawMerged[3].map(([a, b, thickness, exterior]) => ({ a, b, thickness, exterior }));
const outlineLog = logs.find((a) => a[0] === 'CAD debug outline');
const outline = outlineLog[1];
const interior = outlineLog[4].map(([a, b]) => ({ a, b }));

const len = (w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
console.log('raw', raw, 'merged', merged.length, 'interior', interior.length);
console.log('outline', JSON.stringify(outline));

const byThick = new Map();
merged.forEach((w) => {
  const k = w.thickness == null ? 'none' : w.thickness.toFixed(3);
  byThick.set(k, (byThick.get(k) || 0) + 1);
});
console.log('merged thickness histogram', JSON.stringify([...byThick]));
console.log('\nmerged walls (len >= 0.3):');
merged
  .filter((w) => len(w) >= 0.3)
  .sort((a, b) => len(b) - len(a))
  .forEach((w) => {
    console.log('  ', len(w).toFixed(2).padStart(6), w.thickness == null ? ' single' : ' t=' + w.thickness.toFixed(3), JSON.stringify([w.a.x, w.a.y]), '->', JSON.stringify([w.b.x, w.b.y]));
  });
console.log('\ninterior walls:');
interior
  .sort((a, b) => len(b) - len(a))
  .forEach((w) => {
    console.log('  ', len(w).toFixed(2).padStart(6), JSON.stringify([w.a.x, w.a.y]), '->', JSON.stringify([w.b.x, w.b.y]));
  });

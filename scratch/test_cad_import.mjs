import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
const debug = process.argv.includes('--debug');

const ctx = { window: {}, console, Math, JSON, Date, performance };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/model.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/cad-io.js', 'utf8'), ctx);
const FC = ctx.window.FC;

const text = fs.readFileSync(file, 'utf8');
const a = FC.CAD.analyzeDXF(text);
console.log('=== analysis ===');
console.log('unit', a.unit, a.unitFactor, 'raw', a.rawW, a.rawH, 'entities', a.entityCount, 'doors', a.doorCount, 'windows', a.windowCount);
console.log('layers:');
a.layers
  .slice()
  .sort((x, y) => y.count - x.count)
  .forEach((l) => console.log('  ', JSON.stringify(l.name).padEnd(28), String(l.count).padStart(5), l.role.padEnd(8), l.types.join(',')));

const plan = FC.CAD.importDXF(text, { filename: file, debug });
const walls = (plan.walls || []).map((w) => {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
  return {
    a: [w.a.x, w.a.y],
    b: [w.b.x, w.b.y],
    len: Math.round(len * 1000) / 1000,
    orient: Math.abs(w.b.y - w.a.y) < 0.03 ? 'H' : Math.abs(w.b.x - w.a.x) < 0.03 ? 'V' : 'D',
  };
});

console.log('\n=== plan ===');
console.log('outline pts', plan.outline.length, 'walls', walls.length, 'openings', plan.openings.length, 'rooms', plan.rooms.length);
console.log('settings ext/int', plan.settings.extThickness, plan.settings.intThickness);
console.log('\nwalls:');
walls.forEach((w) => console.log('  ', w.orient, w.len.toFixed(2).padStart(6), JSON.stringify(w.a), '->', JSON.stringify(w.b)));
console.log('\nopenings:');
plan.openings.forEach((o) => {
  console.log('  ', o.kind.padEnd(7), o.style.padEnd(8), 'host', o.hostKey.padEnd(16), 'off', String(o.offset).padStart(7), 'w', String(o.width).padStart(6));
});

console.log('\nrooms:');
plan.rooms.forEach((r) => {
  const b = r.bounds || {};
  const dims = b.w != null ? `${b.w.toFixed(1)}x${b.d.toFixed(1)}` : '';
  console.log('  ', (r.name || r.type).padEnd(14), (r.area || 0).toFixed(2).padStart(7), 'm2  ', dims);
});

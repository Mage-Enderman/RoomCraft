const fs = require('fs');
const assert = require('assert');

// Mock browser globals
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.innerWidth = 1200;
global.window.innerHeight = 800;

function makeMockElement() {
  const el = {
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    remove: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {},
    dataset: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getContext: () => new Proxy({
      measureText: () => ({ width: 50 }),
      canvas: { width: 800, height: 600 },
    }, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      }
    }),
  };
  return el;
}

global.document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  getElementById: () => makeMockElement(),
  createElement: () => makeMockElement(),
  body: makeMockElement(),
};
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// Mock THREE
global.THREE = new Proxy({}, { get: () => function () { return new Proxy({}, { get: () => () => ({}) }); } });

// Load files
eval(fs.readFileSync('js/model.js', 'utf8'));
eval(fs.readFileSync('js/icons.js', 'utf8'));
eval(fs.readFileSync('js/furniture3d.js', 'utf8'));
eval(fs.readFileSync('js/cad-io.js', 'utf8'));
eval(fs.readFileSync('js/editor.js', 'utf8'));
eval(fs.readFileSync('js/ui.js', 'utf8'));
eval(fs.readFileSync('js/viewer3d.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));

console.log('Testing App, Editor & UI manual wall connections...');

const app = new FC.App();

// Setup plan with 2 disconnected walls
app.plan = FC.createPlan('Connect Test');
app.plan.outline = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];
app.plan.walls = [
  { id: 'w1', a: { x: 2, y: 2 }, b: { x: 4.9, y: 2 } },
  { id: 'w2', a: { x: 5, y: 2.1 }, b: { x: 5, y: 7 } },
];
app.plan.openings = [
  { id: 'd1', kind: 'door', hostKey: 'w:w1', offset: 1.5, width: 0.9, height: 2.1 },
];

// Test 1: Multi-wall selection and app.connectWalls()
app.select({ type: 'walls', keys: ['w:w1', 'w:w2'], ids: ['w1', 'w2'] });
assert.strictEqual(app.ui.selection.type, 'walls');
assert.strictEqual(app.ui.selection.ids.length, 2);

// Check selection HTML in UI
const html = app.ui.selectionHTML();
assert(html.includes('2 walls selected'), 'UI should show 2 walls selected');
assert(html.includes('data-action="connect-selected-walls"'), 'UI should include Connect walls button');

// Run connectWalls
app.connectWalls();
assert.strictEqual(app.plan.walls[0].b.x, 5);
assert.strictEqual(app.plan.walls[0].b.y, 2);
assert.strictEqual(app.plan.walls[1].a.x, 5);
assert.strictEqual(app.plan.walls[1].a.y, 2);

// Verify door d1 is still intact
const d1 = app.plan.openings.find((o) => o.id === 'd1');
assert(d1, 'Door d1 should be present');
assert.strictEqual(d1.hostKey, 'w:w1');
console.log('✓ Test 1: Multi-selection connectWalls succeeded and preserved door');

// Test 2: Interactive connect mode
app.plan.walls.push({ id: 'w3', a: { x: 5.1, y: 4 }, b: { x: 8, y: 4 } });
app.select({ type: 'wall', key: 'w:w3' });
const singleWallHtml = app.ui.selectionHTML();
assert(singleWallHtml.includes('data-action="wall-connect-mode"'), 'Wall card includes Connect wall button');
assert(singleWallHtml.includes('data-action="wall-connect-nearest"'), 'Wall card includes Connect nearest button');

// Start connect mode
app.startConnectMode('w3');
assert(app.editor.connectMode, 'Connect mode is active on editor');
assert.strictEqual(app.editor.connectMode.sourceWallId, 'w3');

// Connect to w2 (which is vertical at x=5 from y=2 to y=7)
// w3 meets w2 at (5, 4) - a T-junction!
app.connectWalls(['w3', 'w2']);
assert.strictEqual(app.plan.walls.find((w) => w.id === 'w3').a.x, 5);
assert.strictEqual(app.plan.walls.find((w) => w.id === 'w3').a.y, 4);

// Junction at (5, 4) should connect w3 and the split parts of w2
const junctions = FC.findJunctions(app.plan, 0.05);
const j = junctions.find((x) => Math.hypot(x.x - 5, x.y - 4) < 0.01);
assert(j, 'Junction exists at T-intersection (5, 4)');
assert.strictEqual(j.refs.length, 3, 'Junction connects 3 wall segments');
console.log('✓ Test 2: Interactive connect mode and T-junction connect passed');

// Test 3: Connect to nearest
app.plan.walls.push({ id: 'w4', a: { x: 8, y: 4.1 }, b: { x: 8, y: 8 } });
app.connectWallToNearest('w4');
// w4 should connect to w3's end at (8, 4)
const w4 = app.plan.walls.find((w) => w.id === 'w4');
const w3 = app.plan.walls.find((w) => w.id === 'w3');
assert.strictEqual(w4.a.x, w3.b.x);
assert.strictEqual(w4.a.y, w3.b.y);
console.log('✓ Test 3: Connect to nearest passed');
assert.strictEqual(w4.a.y, w3.b.y);
console.log('✓ Test 3: Connect to nearest passed');

// Test 4: Sliding connected walls together
const initialW3Bx = w3.b.x;
const jCorner = junctions.find((x) => Math.hypot(x.x - 5, x.y - 2) < 0.01);
assert(jCorner, 'Corner junction at (5, 2) exists');

// Slide junction at (5, 2) to (5.5, 2)
FC.moveJunction(app.plan, jCorner, 5.5, 2);
assert.strictEqual(app.plan.walls[0].b.x, 5.5);
assert.strictEqual(app.plan.walls[1].a.x, 5.5);
console.log('✓ Test 4: Sliding connected walls smoothly verified');

// Test 5: Multi-wall delete
app.select({ type: 'walls', keys: ['w:w4'], ids: ['w4'] });
app.deleteSelection();
assert(!app.plan.walls.some((w) => w.id === 'w4'), 'w4 deleted by multi-wall delete');
console.log('✓ Test 5: Multi-wall delete verified');

console.log('All end-to-end connect tests passed!');

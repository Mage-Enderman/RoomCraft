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
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
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

// Load FloorCraft scripts
global.THREE = new Proxy({}, { get: () => function () { return new Proxy({}, { get: () => () => ({}) }); } });
eval(fs.readFileSync('js/model.js', 'utf8'));
eval(fs.readFileSync('js/icons.js', 'utf8'));
eval(fs.readFileSync('js/furniture3d.js', 'utf8'));
eval(fs.readFileSync('js/cad-io.js', 'utf8'));
eval(fs.readFileSync('js/editor.js', 'utf8'));
eval(fs.readFileSync('js/ui.js', 'utf8'));
eval(fs.readFileSync('js/viewer3d.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));

console.log('Testing FloorCraft Furniture Movement & Persistence...');

// Create App instance
const app = new FC.App();
app.loadSample();

// 1. Verify sample apartment is furnished
assert(app.plan.furnished === true, 'Sample plan should be furnished');
assert(app.furniture && app.furniture.length > 0, 'app.furniture should contain furniture items');
assert(app.plan.furniture && app.plan.furniture.length > 0, 'app.plan.furniture should be synchronized');

const firstPiece = app.furniture[0];
const origX = firstPiece.x;
const origY = firstPiece.y;
const origRot = firstPiece.rot || 0;

console.log(`Original piece (${firstPiece.kind}): x=${origX}, y=${origY}, rot=${origRot}`);

// 2. Simulate dragging furniture
const targetX = origX + 1.5;
const targetY = origY + 1.2;

// Set up editor drag
app.editor.drag = {
  type: 'furniture',
  furniture: firstPiece,
  startW: { x: origX, y: origY },
  orig: { x: origX, y: origY },
  moved: true,
  pushed: true,
};

// Simulate move
firstPiece.x = targetX;
firstPiece.y = targetY;
firstPiece.custom = true;

// Simulate pointer up
app.editor.onPointerUp();

// ASSERT: Piece MUST NOT snap back to origX, origY!
assert.strictEqual(firstPiece.x, targetX, 'Furniture x position should NOT snap back after drag!');
assert.strictEqual(firstPiece.y, targetY, 'Furniture y position should NOT snap back after drag!');
assert.strictEqual(firstPiece.custom, true, 'Furniture should be marked custom');
assert.strictEqual(app.plan.furniture[0].x, targetX, 'app.plan.furniture should reflect dragged x position');
assert.strictEqual(app.plan.furniture[0].y, targetY, 'app.plan.furniture should reflect dragged y position');

console.log('✓ Test 1 Passed: Furniture does not snap back after drag');

// 3. Test Undo and Redo
// Let's test rotating via app.rotateSelectedFurniture
app.select({ type: 'furniture', id: firstPiece.id });
const rotBefore = firstPiece.rot || 0;
app.rotateSelectedFurniture(Math.PI / 2);
const rotAfter = firstPiece.rot;
assert(Math.abs(rotAfter - (rotBefore + Math.PI / 2)) < 0.01, 'Rotation should update');

// Undo rotation
assert(app.canUndo(), 'Should be able to undo rotation');
app.undo();
const pieceAfterUndo = app.furniture.find(f => f.id === firstPiece.id);
assert(pieceAfterUndo, 'Piece should exist after undo');
assert(Math.abs((pieceAfterUndo.rot || 0) - rotBefore) < 0.01, 'Undo should restore previous rotation');

// Redo rotation
assert(app.canRedo(), 'Should be able to redo rotation');
app.redo();
const pieceAfterRedo = app.furniture.find(f => f.id === firstPiece.id);
assert(pieceAfterRedo, 'Piece should exist after redo');
assert(Math.abs((pieceAfterRedo.rot || 0) - rotAfter) < 0.01, 'Redo should restore rotated angle');

console.log('✓ Test 2 Passed: Undo and Redo accurately tracks furniture rotation');

// 4. Test Persistence & Reload
const serialized = JSON.stringify(app.plan);
const restoredPlan = FC.normalizePlan(JSON.parse(serialized));

assert(Array.isArray(restoredPlan.furniture), 'Restored plan must have furniture array');
assert.strictEqual(restoredPlan.furniture.length, app.plan.furniture.length, 'Furniture count must match');
assert.strictEqual(restoredPlan.furniture[0].x, targetX, 'Restored plan must retain dragged x position');
assert.strictEqual(restoredPlan.furniture[0].y, targetY, 'Restored plan must retain dragged y position');
assert.strictEqual(restoredPlan.furniture[0].custom, true, 'Restored plan must retain custom flag');

// Load into app
app._activatePlan(restoredPlan);
assert.strictEqual(app.furniture[0].x, targetX, 'Loaded plan must keep moved furniture at custom position');

console.log('✓ Test 3 Passed: Custom furniture positions persist through serialization and reload');

// 5. Test Generate Interior (Variation)
const currentVariation = app.plan.layoutVariation || 0;
app.generateInterior();
assert.strictEqual(app.plan.layoutVariation, currentVariation + 1, 'Generate interior should increment layout variation');
assert(app.furniture.length > 0, 'New furniture should be generated');

console.log('✓ Test 4 Passed: Generate interior variation still functions on demand');

console.log('\nALL FURNITURE TESTS PASSED SUCCESSFULLY! 🎉');

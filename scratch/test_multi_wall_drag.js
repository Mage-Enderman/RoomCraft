const fs = require('fs');
const assert = require('assert');

// Mock browser globals
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.innerWidth = 1200;
global.window.innerHeight = 800;

function makeMockElement() {
  return {
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    remove: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
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
      },
    }),
  };
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
global.THREE = new Proxy({}, { get: () => function () { return new Proxy({}, { get: () => () => ({}) }); } });

eval(fs.readFileSync('js/model.js', 'utf8'));
eval(fs.readFileSync('js/icons.js', 'utf8'));
eval(fs.readFileSync('js/furniture3d.js', 'utf8'));
eval(fs.readFileSync('js/cad-io.js', 'utf8'));
eval(fs.readFileSync('js/editor.js', 'utf8'));
eval(fs.readFileSync('js/ui.js', 'utf8'));
eval(fs.readFileSync('js/viewer3d.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));

function makeHarness(walls) {
  const app = new FC.App();
  app.plan = FC.createPlan('Drag Test');
  app.plan.outline = [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 10 },
    { x: 0, y: 10 },
  ];
  app.plan.walls = walls;
  app.plan.openings = [];
  const ed = app.editor;
  ed.view.scale = 60;
  ed.view.cx = 6;
  ed.view.cy = 5;
  ed.W = 800;
  ed.H = 600;
  app.ui.tool = 'select';
  return { app, ed };
}

function ptr(ed, x, y, opts = {}) {
  const s = ed.w2s({ x, y });
  return {
    clientX: s.x,
    clientY: s.y,
    button: 0,
    pointerId: 1,
    shiftKey: !!opts.shiftKey,
    preventDefault() {},
    stopPropagation() {},
    target: makeMockElement(),
  };
}

function click(app, ed, x, y, opts) {
  ed.onPointerDown(ptr(ed, x, y, opts));
  ed.onPointerUp();
}

function drag(ed, from, to) {
  ed.onPointerDown(ptr(ed, from.x, from.y));
  const type = ed.drag && ed.drag.type;
  ed.onPointerMove(ptr(ed, (from.x + to.x) / 2, (from.y + to.y) / 2));
  ed.onPointerMove(ptr(ed, to.x, to.y));
  ed.onPointerUp();
  return type;
}

console.log('1. Shift-click two connected walls, then drag from the shared junction');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
    { id: 'w2', a: { x: 6, y: 2 }, b: { x: 6, y: 6 } },
  ]);
  click(app, ed, 3, 2);
  click(app, ed, 6, 4, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  const dragType = drag(ed, { x: 5.95, y: 2 }, { x: 7, y: 4 });
  assert.strictEqual(dragType, 'walls-group', 'dragging at the shared corner must start a group drag');
  const [w1, w2] = app.plan.walls;
  assert.deepStrictEqual(w1.a, { x: 3, y: 4 }, 'w1 start moved by the drag delta');
  assert.deepStrictEqual(w1.b, { x: 7, y: 4 }, 'w1 end moved by the drag delta');
  assert.deepStrictEqual(w2.a, { x: 7, y: 4 }, 'w2 start moved by the drag delta');
  assert.deepStrictEqual(w2.b, { x: 7, y: 8 }, 'w2 end moved by the drag delta');
  console.log('   ok');
}

console.log('2. Group drag from near a shared wall end (inside junction tolerance)');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 2.6, y: 2 } },
    { id: 'w2', a: { x: 2.6, y: 2 }, b: { x: 4, y: 4 } },
  ]);
  click(app, ed, 2.3, 2);
  click(app, ed, 3.5, 3.5, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  const dragType = drag(ed, { x: 2.05, y: 2 }, { x: 3.05, y: 2 });
  assert.strictEqual(dragType, 'walls-group');
  assert.deepStrictEqual(app.plan.walls[0].a, { x: 3, y: 2 });
  assert.deepStrictEqual(app.plan.walls[0].b, { x: 3.6, y: 2 });
  assert.deepStrictEqual(app.plan.walls[1].a, { x: 3.6, y: 2 });
  console.log('   ok');
}

console.log('3. Shift-click toggling still works (no group drag)');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
    { id: 'w2', a: { x: 2, y: 4 }, b: { x: 6, y: 4 } },
  ]);
  click(app, ed, 3, 2);
  ed.onPointerDown(ptr(ed, 3, 4, { shiftKey: true }));
  assert.strictEqual(ed.drag, null, 'shift-click must not start a drag');
  assert.strictEqual(app.ui.selection.type, 'walls');
  ed.onPointerUp();
  ed.onPointerDown(ptr(ed, 3, 4, { shiftKey: true }));
  ed.onPointerUp();
  assert.strictEqual(app.ui.selection.type, 'wall', 'shift-clicking a selected wall removes it from the group');
  console.log('   ok');
}

console.log('4. Junction not belonging to the selection still drags normally');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 6, y: 6 }, b: { x: 9, y: 6 } },
    { id: 'w2', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
    { id: 'w3', a: { x: 6, y: 2 }, b: { x: 6, y: 4 } },
  ]);
  click(app, ed, 3, 2);
  click(app, ed, 6, 3, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  // Junction at (6, 6) belongs to w1, which is not selected.
  ed.onPointerDown(ptr(ed, 6, 6));
  assert.strictEqual(ed.drag && ed.drag.type, 'junction');
  ed.onPointerUp();
  console.log('   ok');
}

console.log('5. Openings hosted on selected walls move with the group');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
    { id: 'w2', a: { x: 2, y: 4 }, b: { x: 6, y: 4 } },
  ]);
  const door = { id: 'd1', kind: 'door', style: 'single', hostKey: 'w:w1', offset: 2, width: 0.9, height: 2.1, sill: 0, swingSide: 1, hinge: 'left' };
  const win = { id: 'g1', kind: 'window', style: 'standard', hostKey: 'w:w2', offset: 1.5, width: 1.2, height: 1.3, sill: 0.9 };
  app.plan.openings.push(door, win);
  click(app, ed, 5, 2);
  click(app, ed, 5, 4, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  const before = app.plan.openings.map((op) => FC.openingPlacement(app.plan, op, FC.getSegments(app.plan)));
  const dragType = drag(ed, { x: 5, y: 2 }, { x: 6, y: 2 });
  assert.strictEqual(dragType, 'walls-group');
  assert.deepStrictEqual(app.plan.walls[0].a, { x: 3, y: 2 });
  const after = app.plan.openings.map((op) => FC.openingPlacement(app.plan, op, FC.getSegments(app.plan)));
  after.forEach((pl, i) => {
    assert.ok(Math.abs(pl.x - (before[i].x + 1)) < 1e-6, `opening ${i} x should follow the wall`);
    assert.ok(Math.abs(pl.y - before[i].y) < 1e-6, `opening ${i} y should follow the wall`);
  });
  console.log('   ok');
}

console.log('5b. Openings on a selected exterior edge follow the group');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
  ]);
  const win = { id: 'g1', kind: 'window', style: 'standard', hostKey: 'o:0', offset: 6, width: 1.6, height: 1.3, sill: 0.9 };
  app.plan.openings.push(win);
  click(app, ed, 2, 0);
  click(app, ed, 12, 5, { shiftKey: true });
  const before = FC.openingPlacement(app.plan, win, FC.getSegments(app.plan));
  drag(ed, { x: 12, y: 0 }, { x: 13, y: 1 });
  assert.deepStrictEqual(app.plan.outline[1], { x: 13, y: 1 });
  const after = FC.openingPlacement(app.plan, win, FC.getSegments(app.plan));
  assert.ok(Math.abs(after.x - (before.x + 1)) < 1e-6, 'window x should follow the exterior edge');
  assert.ok(Math.abs(after.y - (before.y + 1)) < 1e-6, 'window y should follow the exterior edge');
  console.log('   ok');
}

console.log('6. Boundary-only multi-selection translates the selected outline edges');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
  ]);
  // Select the south and east outline edges.
  click(app, ed, 6, 0);
  click(app, ed, 12, 5, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  assert.deepStrictEqual(app.ui.selection.ids, [], 'outline edges have no interior wall ids');
  const dragType = drag(ed, { x: 12, y: 0 }, { x: 13, y: 1 });
  assert.strictEqual(dragType, 'walls-group', 'boundary-only selections must start a group drag');
  assert.deepStrictEqual(app.plan.outline, [
    { x: 1, y: 1 },
    { x: 13, y: 1 },
    { x: 13, y: 11 },
    { x: 0, y: 10 },
  ]);
  console.log('   ok');
}

console.log('7. Mixed interior + boundary selection moves every selected wall');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
  ]);
  click(app, ed, 3, 2);
  click(app, ed, 6, 0, { shiftKey: true });
  click(app, ed, 12, 5, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  assert.strictEqual(app.ui.selection.ids.length, 1);
  assert.strictEqual(app.ui.selection.keys.length, 3);
  const dragType = drag(ed, { x: 12, y: 0 }, { x: 13, y: 1 });
  assert.strictEqual(dragType, 'walls-group');
  assert.deepStrictEqual(app.plan.walls[0].a, { x: 3, y: 3 });
  assert.deepStrictEqual(app.plan.walls[0].b, { x: 7, y: 3 });
  assert.deepStrictEqual(app.plan.outline[1], { x: 13, y: 1 });
  console.log('   ok');
}

console.log('8. Extending a segmented south side moves every segment together');
{
  const { app, ed } = makeHarness([
    { id: 'w1', a: { x: 2, y: 2 }, b: { x: 6, y: 2 } },
  ]);
  // Bottom side is split into two collinear edges by an inserted corner.
  app.plan.outline = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 10 },
    { x: 0, y: 10 },
  ];
  click(app, ed, 2.5, 0);
  click(app, ed, 8.5, 0, { shiftKey: true });
  assert.strictEqual(app.ui.selection.type, 'walls');
  assert.deepStrictEqual(app.ui.selection.keys, ['o:0', 'o:1']);
  const dragType = drag(ed, { x: 8.5, y: 0 }, { x: 8.5, y: 1 });
  assert.strictEqual(dragType, 'walls-group');
  assert.deepStrictEqual(app.plan.outline, [
    { x: 0, y: 1 },
    { x: 5, y: 1 },
    { x: 12, y: 1 },
    { x: 12, y: 10 },
    { x: 0, y: 10 },
  ]);
  console.log('   ok');
}

console.log('All multi-wall drag tests passed!');

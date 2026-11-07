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

// Load code
global.THREE = new Proxy({}, { get: () => function () { return new Proxy({}, { get: () => () => ({}) }); } });
eval(fs.readFileSync('js/model.js', 'utf8'));
eval(fs.readFileSync('js/icons.js', 'utf8'));
eval(fs.readFileSync('js/furniture3d.js', 'utf8'));
eval(fs.readFileSync('js/cad-io.js', 'utf8'));
eval(fs.readFileSync('js/editor.js', 'utf8'));
eval(fs.readFileSync('js/ui.js', 'utf8'));
eval(fs.readFileSync('js/viewer3d.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));

console.log('Testing FloorCraft Room Auto-Detection & Manual Mode...');

// 1. Plan creation & normalization
const p1 = FC.createPlan('Test Plan');
assert.strictEqual(p1.autoDetectRooms, true, 'createPlan must initialize autoDetectRooms: true');

const norm1 = FC.normalizePlan({ name: 'Normalized' });
assert.strictEqual(norm1.autoDetectRooms, true, 'normalizePlan defaults autoDetectRooms to true');

const norm2 = FC.normalizePlan({ name: 'Manual', autoDetectRooms: false });
assert.strictEqual(norm2.autoDetectRooms, false, 'normalizePlan preserves autoDetectRooms: false');

// 2. Scale plan in manual mode
const scaleTestPlan = FC.createPlan('Scale Test');
scaleTestPlan.autoDetectRooms = false;
scaleTestPlan.rooms = [
  {
    id: 'r1',
    name: 'Custom Room',
    type: 'bedroom',
    polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
    centroid: { x: 2, y: 1.5 },
    area: 12,
  }
];
FC.scalePlan(scaleTestPlan, 2);
assert.strictEqual(scaleTestPlan.rooms[0].polygon[1].x, 8, 'scalePlan scales room polygon x');
assert.strictEqual(scaleTestPlan.rooms[0].centroid.x, 4, 'scalePlan scales room centroid x');
assert.strictEqual(scaleTestPlan.rooms[0].area, 48, 'scalePlan scales room area by factor^2');

// 3. App testing
const app = new FC.App();

// Build a sample enclosed 2-room plan
app.plan.outline = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }, { x: 0, y: 6 }
];
app.plan.walls = [
  // dividing wall in middle
  { id: 'w_mid', a: { x: 5, y: 0 }, b: { x: 5, y: 6 } }
];
app.plan.autoDetectRooms = true;
app.recomputeRooms();

console.log(`Detected rooms count: ${app.rooms.length}`);
assert.strictEqual(app.rooms.length, 2, 'Should detect 2 rooms from dividing wall');
assert.strictEqual(app.plan.autoDetectRooms, true, 'Initially autoDetectRooms is true');

const firstRoom = app.rooms[0];
const originalName = firstRoom.name;

// 4. Test setting room name disables auto-detection
app.setRoomName(firstRoom.id, 'My Custom Suite');
assert.strictEqual(app.plan.autoDetectRooms, false, 'Renaming room must set autoDetectRooms to false');
assert.strictEqual(firstRoom.name, 'My Custom Suite', 'Room name should be updated');

// 5. Test wall edits do NOT overwrite manual rooms when autoDetectRooms is false
app.plan.walls.push({ id: 'w_extra', a: { x: 2.5, y: 0 }, b: { x: 2.5, y: 6 } });
app.recomputeRooms(); // Called during wall edits
assert.strictEqual(app.rooms.length, 2, 'Manual rooms count must remain unchanged when autoDetectRooms is false');
assert.strictEqual(app.rooms[0].name, 'My Custom Suite', 'Manual room name must not be overwritten');

// 6. Test Preview Mode
assert.strictEqual(app.detectedRoomsPreview, null, 'Preview is initially null');
app.toggleDetectedRoomsPreview();
assert(Array.isArray(app.detectedRoomsPreview), 'Preview should contain detected rooms list');
console.log(`Preview candidate count: ${app.detectedRoomsPreview.length}`);
assert.strictEqual(app.detectedRoomsPreview.length, 3, 'Preview should detect 3 rooms from current walls');
assert.strictEqual(app.rooms.length, 2, 'app.rooms must remain unchanged during preview');

// 7. Test Adopt candidate room
const candToAdopt = app.detectedRoomsPreview[0];
const candId = candToAdopt.id;
app.adoptDetectedRoom(candId);
assert(app.rooms.some(r => r.id === candId || r.name === candToAdopt.name), 'Candidate should be adopted into rooms');

// 8. Test Apply All Detected
app.toggleDetectedRoomsPreview(); // re-generate preview if needed
if (!app.detectedRoomsPreview) app.toggleDetectedRoomsPreview();
app.applyDetectedRooms(true);
assert.strictEqual(app.plan.autoDetectRooms, true, 'Applying all detected rooms re-enables auto-detection');
assert.strictEqual(app.rooms.length, 3, 'Should have applied all 3 detected rooms');
assert.strictEqual(app.detectedRoomsPreview, null, 'Preview should be cleared after apply');

// 9. Test setRoomType disables auto-detection
app.setRoomType(app.rooms[0].id, 'kitchen');
assert.strictEqual(app.plan.autoDetectRooms, false, 'Changing room type must disable auto-detection');
assert.strictEqual(app.rooms[0].type, 'kitchen', 'Room type should be updated');

// 10. Test toggleAutoDetectRooms
app.toggleAutoDetectRooms();
assert.strictEqual(app.plan.autoDetectRooms, true, 'toggleAutoDetectRooms should toggle to true');
app.toggleAutoDetectRooms();
assert.strictEqual(app.plan.autoDetectRooms, false, 'toggleAutoDetectRooms should toggle back to false');

// 11. Test deleteRoom in manual mode
const countBeforeDelete = app.rooms.length;
const deleteId = app.rooms[0].id;
app.deleteRoom(deleteId);
assert.strictEqual(app.rooms.length, countBeforeDelete - 1, 'Deleting room in manual mode decreases room count');
assert(!app.rooms.some(r => r.id === deleteId), 'Deleted room must no longer be in rooms');

// 12. Test manual room serialization & persistence
const meta = app._roomMeta();
assert(meta.every(r => Array.isArray(r.polygon) && r.polygon.length >= 3), 'All room metadata must include polygons');
assert(meta.every(r => r.centroid && r.centroid.x != null), 'All room metadata must include centroid');

console.log('ALL TESTS PASSED SUCCESSFULLY!');

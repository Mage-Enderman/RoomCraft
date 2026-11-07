const fs = require('fs');
const assert = require('assert');

// Mock browser globals with real Three.js loaded from vendor/three.min.js
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.innerWidth = 1280;
global.window.innerHeight = 800;
global.window.devicePixelRatio = 1;
global.performance = global.performance || { now: () => Date.now() };

function makeMockElement() {
  const el = {
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    addEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    remove: () => {},
    setPointerCapture: () => {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, f) { if (f === undefined) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); } else if (f) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    style: { setProperty: () => {} },
    dataset: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    getContext: () => new Proxy({
      measureText: () => ({ width: 50 }),
      canvas: { width: 1000, height: 700 },
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
global.requestAnimationFrame = () => {};

// Load real Three.js for authentic 3D scene graph & raycasting
global.THREE = window.THREE = Object.assign({}, require('../vendor/three.min.js'));

// Stub WebGLRenderer so Viewer3D can initialize without a GPU context in Node
THREE.WebGLRenderer = function () {
  this.shadowMap = { enabled: false, type: null };
  this.setPixelRatio = () => {};
  this.setSize = () => {};
  this.render = () => {};
};

eval(fs.readFileSync('js/model.js', 'utf8'));
eval(fs.readFileSync('js/icons.js', 'utf8'));
eval(fs.readFileSync('js/furniture3d.js', 'utf8'));
eval(fs.readFileSync('js/cad-io.js', 'utf8'));
eval(fs.readFileSync('js/editor.js', 'utf8'));
eval(fs.readFileSync('js/ui.js', 'utf8'));
eval(fs.readFileSync('js/viewer3d.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));

console.log('Testing 3D Mode Furniture Selection, Movement & Rotation...');

const app = new FC.App();
app.loadSample();
app.enter3D(7);
// Settle camera at goal and update world matrices
app.viewer.isTransitioning = false;
if (app.viewer.structure) app.viewer.structure.scale.y = 1;
if (app.viewer.furnitureGroup) {
  app.viewer.furnitureGroup.scale.y = 1;
  app.viewer.furnitureGroup.position.y = 0;
}
app.viewer.orbit = Object.assign({}, app.viewer.goal);
const p = app.viewer.orbit;
app.viewer.camera.position.set(
  p.tx + Math.sin(p.yaw) * Math.cos(p.pitch) * p.dist,
  p.ty + Math.sin(p.pitch) * p.dist,
  p.tz + Math.cos(p.yaw) * Math.cos(p.pitch) * p.dist
);
app.viewer.camera.lookAt(p.tx, p.ty, p.tz);
app.viewer.camera.updateMatrixWorld(true);
app.viewer.scene.updateMatrixWorld(true);

// Helper to project a 3D world point (x, y, z) to canvas clientX, clientY
function projectToScreen(wx, wy, wz) {
  app.viewer.camera.updateMatrixWorld(true);
  const v = new THREE.Vector3(wx, wy, wz).project(app.viewer.camera);
  return {
    clientX: ((v.x + 1) / 2) * 1000,
    clientY: ((-v.y + 1) / 2) * 700,
  };
}

// 1. Verify furniture meshes are registered in viewer.furnitureMeshes
assert(app.viewer.furnitureMeshes.size === app.furniture.length, 'Every furniture item must be registered in viewer.furnitureMeshes');

// Pick a non-rug item to test selecting, moving, and rotating in 3D
const targetItem = app.furniture.find((f) => f.kind === 'diningTable' || f.kind === 'bed' || f.kind === 'sofa') || app.furniture[0];
assert(targetItem, 'Should find a target furniture item');
const meshGroup = app.viewer.furnitureMeshes.get(targetItem.id);
assert(meshGroup, 'Target item 3D group should exist');
assert.strictEqual(meshGroup.userData.furnitureId, targetItem.id, '3D group should carry furnitureId');

// 2. Test clicking the furniture in 3D to select it
const clickScreen = projectToScreen(targetItem.x, 0.35, targetItem.y);
app.viewer.onDown({
  button: 0,
  shiftKey: false,
  altKey: false,
  clientX: clickScreen.clientX,
  clientY: clickScreen.clientY,
  pointerId: 1,
  preventDefault: () => {},
});
app.viewer.onUp({
  button: 0,
  clientX: clickScreen.clientX,
  clientY: clickScreen.clientY,
});

assert(app.ui.selection && app.ui.selection.type === 'furniture', 'Clicking furniture in 3D must select it');
assert.strictEqual(app.ui.selection.id, targetItem.id, 'Selected furniture ID must match clicked 3D mesh');
assert(app.viewer.selectionGizmo, 'Selection gizmo must be created in 3D scene when furniture is selected');
assert.strictEqual(app.viewer.selectionGizmo.userData.furnitureId, targetItem.id, 'Selection gizmo must track selected furnitureId');

console.log('✓ Test 1 Passed: Raycast click in 3D selects furniture and spawns 3D selection gizmo');

// 3. Test dragging furniture across the floor in 3D (with Alt held for exact coordinate check)
const origX = targetItem.x;
const origY = targetItem.y;
const downScreen = projectToScreen(origX, 0.35, origY);
const destX = origX + 0.8;
const destY = origY + 0.6;
const moveScreen = projectToScreen(destX, 0, destY);

app.viewer.onDown({
  button: 0,
  shiftKey: false,
  altKey: true,
  clientX: downScreen.clientX,
  clientY: downScreen.clientY,
  pointerId: 1,
  preventDefault: () => {},
});
app.viewer.onMove({
  button: 0,
  shiftKey: false,
  altKey: true,
  clientX: moveScreen.clientX,
  clientY: moveScreen.clientY,
});
app.viewer.onUp({
  button: 0,
  clientX: moveScreen.clientX,
  clientY: moveScreen.clientY,
});

assert(Math.abs(targetItem.x - origX) > 0.2 || Math.abs(targetItem.y - origY) > 0.2, 'Dragging in 3D must move furniture position');
assert.strictEqual(meshGroup.position.x, targetItem.x, '3D mesh X must sync with furniture X');
assert.strictEqual(meshGroup.position.z, targetItem.y, '3D mesh Z must sync with furniture Y');
assert.strictEqual(app.viewer.selectionGizmo.position.x, targetItem.x, '3D gizmo X must sync with furniture X');
assert.strictEqual(app.viewer.selectionGizmo.position.z, targetItem.y, '3D gizmo Z must sync with furniture Y');

console.log(`✓ Test 2 Passed: Dragging furniture in 3D moves item from (${origX}, ${origY}) to (${targetItem.x}, ${targetItem.y})`);

// 4. Test Undo / Redo of 3D move
app.undo();
const afterUndoMove = app.furniture.find((f) => f.id === targetItem.id);
assert.strictEqual(afterUndoMove.x, origX, 'Undo must restore original X after 3D drag');
assert.strictEqual(afterUndoMove.y, origY, 'Undo must restore original Y after 3D drag');
app.redo();
const afterRedoMove = app.furniture.find((f) => f.id === targetItem.id);
assert(Math.abs(afterRedoMove.x - origX) > 0.2 || Math.abs(afterRedoMove.y - origY) > 0.2, 'Redo must re-apply 3D drag position');

console.log('✓ Test 3 Passed: Undo & Redo work for 3D furniture movement');

// 5. Test rotating furniture in 3D via the 3D rotation handle gizmo
app.select({ type: 'furniture', id: afterRedoMove.id });
app.viewer.scene.updateMatrixWorld(true);

const d = (afterRedoMove.d || 0.8) + 0.08;
const handleDist = d / 2 + 0.42;
const rotBefore = afterRedoMove.rot || 0;
const handleWorldX = afterRedoMove.x - Math.sin(rotBefore) * handleDist;
const handleWorldZ = afterRedoMove.y + Math.cos(rotBefore) * handleDist;
const handleScreen = projectToScreen(handleWorldX, 0.08, handleWorldZ);

const hitRot = app.viewer.hitRotateHandle3D({
  clientX: handleScreen.clientX,
  clientY: handleScreen.clientY,
});
assert(hitRot && hitRot.id === afterRedoMove.id, 'Raycasting at 3D rotation handle screen coords must hit the rotation handle');

// Drag handle to rotate to +90 degrees around the item
const rotatedTargetScreen = projectToScreen(afterRedoMove.x - 1.0, 0, afterRedoMove.y);
app.viewer.onDown({
  button: 0,
  shiftKey: false,
  altKey: false,
  clientX: handleScreen.clientX,
  clientY: handleScreen.clientY,
  pointerId: 1,
  preventDefault: () => {},
});
assert.strictEqual(app.viewer.dragging.mode, 'furniture-rotate', 'Pointer down on handle must enter furniture-rotate mode');

app.viewer.onMove({
  button: 0,
  shiftKey: false,
  altKey: false,
  clientX: rotatedTargetScreen.clientX,
  clientY: rotatedTargetScreen.clientY,
});
app.viewer.onUp({
  button: 0,
  clientX: rotatedTargetScreen.clientX,
  clientY: rotatedTargetScreen.clientY,
});

assert(Math.abs(afterRedoMove.rot - Math.PI / 2) < 0.01, `Dragging 3D rotation handle to -X should rotate to ~90° (got ${afterRedoMove.rot})`);
const updatedGroup = app.viewer.furnitureMeshes.get(afterRedoMove.id);
assert(Math.abs(updatedGroup.rotation.y - (-afterRedoMove.rot)) < 0.01, '3D group rotation.y must equal -item.rot');

console.log('✓ Test 4 Passed: 3D rotation handle raycasts and rotates furniture smoothly');

// 6. Test sidebar continuous rotation method & keyboard nudge in 3D
app.setSelectedFurnitureRotation(135);
assert(Math.abs(afterRedoMove.rot - (135 * Math.PI) / 180) < 0.01, 'setSelectedFurnitureRotation(135) must set rotation to 135°');

const xBeforeNudge = afterRedoMove.x;
app.nudgeSelectedFurniture(0.15, -0.1);
assert.strictEqual(afterRedoMove.x, FC.round(xBeforeNudge + 0.15, 3), 'nudgeSelectedFurniture must update X');

console.log('✓ Test 5 Passed: Continuous rotation angle control & keyboard nudge work in 3D');

// 7. Clicking empty background in 3D clears selection without breaking orbit
const emptyScreen = { clientX: 20, clientY: 20 };
app.viewer.onDown({
  button: 0,
  shiftKey: false,
  altKey: false,
  clientX: emptyScreen.clientX,
  clientY: emptyScreen.clientY,
  pointerId: 1,
  preventDefault: () => {},
});
app.viewer.onUp({
  button: 0,
  clientX: emptyScreen.clientX,
  clientY: emptyScreen.clientY,
});
assert.strictEqual(app.ui.selection, null, 'Clicking empty space in 3D without dragging must clear selection');
assert.strictEqual(app.viewer.selectionGizmo, null, 'Selection gizmo must be removed when selection is cleared');

console.log('✓ Test 6 Passed: Clicking empty space in 3D deselects furniture and removes gizmo');

console.log('\nALL 3D FURNITURE TESTS PASSED SUCCESSFULLY! 🎉');

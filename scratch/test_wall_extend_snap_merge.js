// Automated test for wall lengthening without moving hosted items,
// magnetic snapping to walls/doors, and merging collinear and parallel walls.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser window/DOM environment
global.window = global;
global.document = {
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
  getElementById: () => null,
  body: { classList: { contains: () => false, add: () => {}, remove: () => {} } },
  addEventListener: () => {}
};

// Load model
require(path.join(__dirname, '../js/model.js'));
const FC = global.FC;

console.log('Testing Wall Lengthening, Snapping, and Merging...');

function createSamplePlan() {
  return {
    outline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ],
    walls: [
      { id: 'w1', a: { x: 2, y: 5 }, b: { x: 6, y: 5 }, thickness: 0.15 }
    ],
    openings: [
      { id: 'd1', hostKey: 'w:w1', kind: 'door', offset: 2.0, width: 0.9, height: 2.1, style: 'single' }
    ],
    rooms: [],
    furniture: [],
    lights: [],
    settings: {
      wallHeight: 2.7,
      extThickness: 0.25,
      intThickness: 0.15,
      snapGrid: 0.1
    }
  };
}

// -------------------------------------------------------------
// Test 1: Lengthening wall from End A (End A stays fixed, End B extends)
// -------------------------------------------------------------
{
  const plan = createSamplePlan();
  const d1BeforeWorld = FC.openingPlacement(plan, plan.openings[0]);
  assert(d1BeforeWorld, 'Opening placement exists');
  console.log('  Original door center:', { x: d1BeforeWorld.x, y: d1BeforeWorld.y });

  // Extend w1 from 4.0m to 6.0m with End A fixed (fromEnd = 0)
  const ok = FC.resizeWall(plan, 'w1', 6.0, 0);
  assert(ok, 'resizeWall succeeded');

  const w1 = plan.walls.find(w => w.id === 'w1');
  assert.strictEqual(w1.a.x, 2, 'End A remains at x=2');
  assert.strictEqual(w1.a.y, 5, 'End A remains at y=5');
  assert.strictEqual(w1.b.x, 8, 'End B moved to x=8');
  assert.strictEqual(w1.b.y, 5, 'End B remains at y=5');

  const d1AfterWorld = FC.openingPlacement(plan, plan.openings[0]);
  console.log('  Door center after End B extension:', { x: d1AfterWorld.x, y: d1AfterWorld.y });
  assert(Math.abs(d1BeforeWorld.x - d1AfterWorld.x) < 1e-4, 'Door X unchanged');
  assert(Math.abs(d1BeforeWorld.y - d1AfterWorld.y) < 1e-4, 'Door Y unchanged');
  console.log('✓ Test 1: Lengthening with End A fixed preserves door world position');
}

// -------------------------------------------------------------
// Test 2: Lengthening wall from End B (End B stays fixed, End A extends backward)
// -------------------------------------------------------------
{
  const plan = createSamplePlan();
  const d1BeforeWorld = FC.openingPlacement(plan, plan.openings[0]);

  // Extend w1 from 4.0m to 6.0m with End B fixed (fromEnd = 1)
  // End A should move from x=2 to x=0. Door offset was 2.0m from End A.
  // With End A moving to 0, door offset must become 4.0m from new End A to stay at x=4.0.
  const ok = FC.resizeWall(plan, 'w1', 6.0, 1);
  assert(ok, 'resizeWall succeeded');

  const w1 = plan.walls.find(w => w.id === 'w1');
  assert.strictEqual(w1.b.x, 6, 'End B remains at x=6');
  assert.strictEqual(w1.b.y, 5, 'End B remains at y=5');
  assert.strictEqual(w1.a.x, 0, 'End A moved backward to x=0');
  assert.strictEqual(w1.a.y, 5, 'End A remains at y=5');

  const d1AfterWorld = FC.openingPlacement(plan, plan.openings[0]);
  console.log('  Door center after End A extension:', { x: d1AfterWorld.x, y: d1AfterWorld.y });
  assert(Math.abs(d1BeforeWorld.x - d1AfterWorld.x) < 1e-4, 'Door X unchanged');
  assert(Math.abs(d1BeforeWorld.y - d1AfterWorld.y) < 1e-4, 'Door Y unchanged');
  console.log('✓ Test 2: Lengthening with End B fixed automatically adjusts opening offset to keep world position identical');
}

// -------------------------------------------------------------
// Test 3: Extend wall along its axis to boundary (raycast & weld)
// -------------------------------------------------------------
{
  const plan = createSamplePlan();
  const d1BeforeWorld = FC.openingPlacement(plan, plan.openings[0]);

  // Wall w1 goes from (2,5) to (6,5). Boundary outline has right wall at x=10.
  // Extending End B forward should hit the right boundary at (10,5).
  const res = FC.extendWallToBoundary(plan, 'w1', 0);
  assert(res && res.extended, 'extendWallToBoundary succeeded');
  assert.strictEqual(res.fromEnd, 0);
  assert(Math.abs(res.hitPoint.x - 10) < 1e-3, 'Hit x=10');
  assert(Math.abs(res.hitPoint.y - 5) < 1e-3, 'Hit y=5');

  const w1 = plan.walls.find(w => w.id === 'w1');
  assert.strictEqual(w1.b.x, 10, 'End B extended to x=10');

  const d1AfterWorld = FC.openingPlacement(plan, plan.openings[0]);
  assert(Math.abs(d1BeforeWorld.x - d1AfterWorld.x) < 1e-4, 'Door world position preserved during raycast extend');
  console.log('✓ Test 3: Extend wall along axis cleanly raycasts to boundary outline');
}

// -------------------------------------------------------------
// Test 4: Opening Snap Points (center and jamb edges)
// -------------------------------------------------------------
{
  const plan = createSamplePlan();
  const snaps = FC.getOpeningSnapPoints(plan);
  assert(snaps.length > 0, 'Snap points returned');

  // Door is on w1 at (2,5)->(6,5), offset 2.0 -> center is (4,5), width 0.9.
  // Along horizontal wall, direction is (1,0).
  // Jamb 1 should be (4 - 0.45, 5) = (3.55, 5)
  // Jamb 2 should be (4 + 0.45, 5) = (4.45, 5)
  const centerSnap = snaps.find(s => s.type === 'opening-center');
  const jambSnaps = snaps.filter(s => s.type === 'opening-edge');

  assert(centerSnap, 'Door center snap point found');
  assert(Math.abs(centerSnap.x - 4.0) < 1e-3, 'Center snap x=4');
  assert(Math.abs(centerSnap.y - 5.0) < 1e-3, 'Center snap y=5');

  assert.strictEqual(jambSnaps.length, 2, 'Two jamb snap points found');
  const jambXs = jambSnaps.map(j => j.x).sort((a,b) => a - b);
  assert(Math.abs(jambXs[0] - 3.55) < 1e-3, 'Left jamb x=3.55');
  assert(Math.abs(jambXs[1] - 4.45) < 1e-3, 'Right jamb x=4.45');
  console.log('✓ Test 4: Opening snap points correctly generate door center and frame jamb coordinates');
}

// -------------------------------------------------------------
// Test 5: Merge Collinear Walls
// -------------------------------------------------------------
{
  const plan = {
    outline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ],
    walls: [
      { id: 'w1', a: { x: 1, y: 4 }, b: { x: 4, y: 4 }, thickness: 0.15 },
      { id: 'w2', a: { x: 4, y: 4 }, b: { x: 8, y: 4 }, thickness: 0.15 }
    ],
    openings: [
      { id: 'd1', hostKey: 'w:w1', kind: 'door', offset: 1.5, width: 0.9, height: 2.1 }, // world x=2.5, y=4
      { id: 'd2', hostKey: 'w:w2', kind: 'door', offset: 2.0, width: 0.9, height: 2.1 }  // world x=6.0, y=4
    ],
    rooms: [],
    furniture: [],
    lights: [],
    settings: { wallHeight: 2.7 }
  };

  const d1Before = FC.openingPlacement(plan, plan.openings[0]);
  const d2Before = FC.openingPlacement(plan, plan.openings[1]);

  const mergeRes = FC.mergeWalls(plan, 'w1', 'w2');
  assert(mergeRes && mergeRes.merged, 'mergeWalls succeeded');
  assert.strictEqual(mergeRes.type, 'collinear', 'Detected collinear merge');

  // Now plan should only have 1 wall
  assert.strictEqual(plan.walls.length, 1, 'Walls consolidated to 1');
  const mergedW = plan.walls[0];
  assert.strictEqual(mergedW.id, 'w1');
  assert(Math.abs(mergedW.a.x - 1) < 1e-3, 'Merged wall starts at x=1');
  assert(Math.abs(mergedW.b.x - 8) < 1e-3, 'Merged wall ends at x=8');

  // Both doors should still exist and belong to w1
  assert.strictEqual(plan.openings.length, 2, 'Both doors preserved');
  assert(plan.openings.every(o => o.hostKey === 'w:w1'), 'All doors reassigned to w1');

  const d1After = FC.openingPlacement(plan, plan.openings.find(o => o.id === 'd1'));
  const d2After = FC.openingPlacement(plan, plan.openings.find(o => o.id === 'd2'));

  assert(Math.abs(d1Before.x - d1After.x) < 1e-3, 'Door 1 world x preserved');
  assert(Math.abs(d2Before.x - d2After.x) < 1e-3, 'Door 2 world x preserved');
  console.log('✓ Test 5: Collinear wall merge unifies walls and accurately preserves all hosted doors');
}

// -------------------------------------------------------------
// Test 6: Merge Parallel Double Walls
// -------------------------------------------------------------
{
  const plan = {
    outline: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ],
    walls: [
      { id: 'w1', a: { x: 2, y: 3.9 }, b: { x: 7, y: 3.9 }, thickness: 0.1 },
      { id: 'w2', a: { x: 2, y: 4.1 }, b: { x: 7, y: 4.1 }, thickness: 0.1 }
    ],
    openings: [],
    rooms: [],
    furniture: [],
    lights: [],
    settings: { wallHeight: 2.7 }
  };

  const mergeRes = FC.mergeWalls(plan, 'w1', 'w2');
  assert(mergeRes && mergeRes.merged, 'mergeWalls parallel succeeded');
  assert.strictEqual(mergeRes.type, 'parallel', 'Detected parallel merge');
  assert.strictEqual(plan.walls.length, 1, 'Consolidated to 1 wall');
  console.log('✓ Test 6: Parallel double wall merge consolidates cleanly via unified mergeWalls');
}

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');

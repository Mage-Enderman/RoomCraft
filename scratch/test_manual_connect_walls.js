const assert = require('assert');

// Mock window and FC
global.window = global;
require('../js/model.js');
const FC = global.FC;

console.log('--- Testing FC.connectTwoWalls & FC.connectWalls ---');

// Test 1: L-Corner with slight gap
{
  const plan = FC.createPlan();
  plan.walls = [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 4.95, y: 0 } },      // Horizontal wall ending at 4.95, 0
    { id: 'w2', a: { x: 5, y: 0.1 }, b: { x: 5, y: 4 } },        // Vertical wall starting at 5, 0.1
  ];

  const res = FC.connectTwoWalls(plan, 'w1', 'w2');
  assert(res && res.success, 'L-Corner connection should succeed');
  assert.strictEqual(res.type, 'corner', 'Should be corner type');
  // Endpoints should match exactly at (5, 0)
  assert.strictEqual(plan.walls[0].b.x, 5);
  assert.strictEqual(plan.walls[0].b.y, 0);
  assert.strictEqual(plan.walls[1].a.x, 5);
  assert.strictEqual(plan.walls[1].a.y, 0);

  // Check findJunctions
  const junctions = FC.findJunctions(plan, 0.05);
  const j = junctions.find((x) => Math.hypot(x.x - 5, x.y - 0) < 0.01);
  assert(j, 'Junction should exist at (5,0)');
  assert.strictEqual(j.refs.length, 2, 'Junction should have 2 refs');

  // Test sliding the junction
  FC.moveJunction(plan, j, 6, 1);
  assert.strictEqual(plan.walls[0].b.x, 6);
  assert.strictEqual(plan.walls[0].b.y, 1);
  assert.strictEqual(plan.walls[1].a.x, 6);
  assert.strictEqual(plan.walls[1].a.y, 1);
  console.log('✓ Test 1 Passed: L-Corner snapped and slid together');
}

// Test 2: T-Junction with door migration
{
  const plan = FC.createPlan();
  // Host wall w1 from (0, 0) to (10, 0) with a door at offset 7.0
  plan.walls = [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
    { id: 'w2', a: { x: 4, y: 0.2 }, b: { x: 4, y: 5 } }, // Approaching at x=4, y=0.2
  ];
  plan.openings = [
    { id: 'd1', kind: 'door', hostKey: 'w:w1', offset: 7.0, width: 0.9, height: 2.1 },
    { id: 'd2', kind: 'door', hostKey: 'w:w1', offset: 2.0, width: 0.9, height: 2.1 },
  ];

  const res = FC.connectTwoWalls(plan, 'w2', 'w1');
  assert(res && res.success, 'T-Junction connection should succeed');
  assert.strictEqual(res.type, 't-junction', 'Should be t-junction type');
  assert.strictEqual(plan.walls.length, 3, 'Host wall should be split into 2 walls (total 3 walls)');

  // w2 endpoint should be at (4, 0)
  const w2 = plan.walls.find((w) => w.id === 'w2');
  assert.strictEqual(w2.a.x, 4);
  assert.strictEqual(w2.a.y, 0);

  // Door at offset 2.0 should remain on w1
  const d2 = plan.openings.find((o) => o.id === 'd2');
  assert.strictEqual(d2.hostKey, 'w:w1');
  assert.strictEqual(d2.offset, 2.0);

  // Door at offset 7.0 should now be re-hosted on the new wall segment (offset 7.0 - 4.0 = 3.0)
  const d1 = plan.openings.find((o) => o.id === 'd1');
  assert.notStrictEqual(d1.hostKey, 'w:w1');
  assert.strictEqual(d1.offset, 3.0);

  // Check findJunctions
  const junctions = FC.findJunctions(plan, 0.05);
  const j = junctions.find((x) => Math.hypot(x.x - 4, x.y - 0) < 0.01);
  assert(j, 'Junction should exist at (4,0)');
  assert.strictEqual(j.refs.length, 3, 'Junction should have 3 refs (w1 part 1, w1 part 2, w2)');

  // Test sliding the T-junction along X
  FC.moveJunction(plan, j, 4.5, 0);
  assert.strictEqual(w2.a.x, 4.5);
  console.log('✓ Test 2 Passed: T-Junction connected, split, doors preserved, and slid together');
}

// Test 3: Crossing X-Junction
{
  const plan = FC.createPlan();
  plan.walls = [
    { id: 'w1', a: { x: 0, y: 5 }, b: { x: 10, y: 5 } },
    { id: 'w2', a: { x: 5, y: 0 }, b: { x: 5, y: 10 } },
  ];

  const res = FC.connectTwoWalls(plan, 'w1', 'w2');
  assert(res && res.success, 'Cross connection should succeed');
  assert.strictEqual(res.type, 'cross', 'Should be cross type');
  assert.strictEqual(plan.walls.length, 4, 'Both walls split into 4 half-walls');

  const junctions = FC.findJunctions(plan, 0.05);
  const j = junctions.find((x) => Math.hypot(x.x - 5, x.y - 5) < 0.01);
  assert(j, 'Junction should exist at (5,5)');
  assert.strictEqual(j.refs.length, 4, 'Junction should have 4 refs');
  console.log('✓ Test 3 Passed: Crossing X-Junction connected into 4-way sliding junction');
}

// Test 4: Wall to Outline connection
{
  const plan = FC.createPlan();
  plan.outline = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  plan.walls = [
    { id: 'w1', a: { x: 5, y: 0.15 }, b: { x: 5, y: 6 } }, // Approaches bottom outline segment
  ];

  const res = FC.connectTwoWalls(plan, 'w1', 'o:0');
  assert(res && res.success, 'Outline connection should succeed');
  assert.strictEqual(res.type, 'outline');
  assert.strictEqual(plan.walls[0].a.x, 5);
  assert.strictEqual(plan.walls[0].a.y, 0);
  assert.strictEqual(plan.outline.length, 5, 'Outline vertex should be inserted at (5,0)');

  const junctions = FC.findJunctions(plan, 0.05);
  const j = junctions.find((x) => Math.hypot(x.x - 5, x.y - 0) < 0.01);
  assert(j, 'Junction should exist at (5,0)');
  assert(j.refs.some((r) => r.type === 'outline'), 'Has outline ref');
  assert(j.refs.some((r) => r.type === 'wall'), 'Has wall ref');
  console.log('✓ Test 4 Passed: Wall to Outline connected and shares junction');
}

// Test 5: Multi-wall connect (3 walls)
{
  const plan = FC.createPlan();
  plan.walls = [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 4.9, y: 0 } },
    { id: 'w2', a: { x: 5, y: 0.1 }, b: { x: 5, y: 5 } },
    { id: 'w3', a: { x: 5.1, y: 0 }, b: { x: 10, y: 0 } },
  ];

  const res = FC.connectWalls(plan, ['w1', 'w2', 'w3']);
  assert(res && res.length >= 1, 'Multi-wall connect should succeed');
  const junctions = FC.findJunctions(plan, 0.05);
  const j = junctions.find((x) => Math.hypot(x.x - 5, x.y - 0) < 0.01);
  assert(j, 'Unified junction exists at (5,0)');
  console.log('✓ Test 5 Passed: Multi-wall connection creates unified junction');
}

// Test 6: findNearestWallToWall
{
  const plan = FC.createPlan();
  plan.walls = [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 5, y: 0 } },
    { id: 'w2', a: { x: 5.2, y: 0 }, b: { x: 10, y: 0 } },
    { id: 'w3', a: { x: 50, y: 50 }, b: { x: 60, y: 50 } },
  ];
  const nearest = FC.findNearestWallToWall(plan, 'w1');
  assert(nearest, 'Should find nearest wall');
  assert.strictEqual(nearest.targetIdOrKey, 'w2');
  console.log('✓ Test 6 Passed: findNearestWallToWall correctly found w2');
}

console.log('All model tests passed successfully!');

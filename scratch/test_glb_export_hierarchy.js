const fs = require('fs');
const assert = require('assert');

// Mock browser globals with real Three.js & GLTFExporter loaded from vendor/
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.innerWidth = 1280;
global.window.innerHeight = 800;
global.window.devicePixelRatio = 1;
global.performance = global.performance || { now: () => Date.now() };

function makeMockElement() {
  return {
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
      toggle(c, f) {
        if (f === undefined) {
          if (this._set.has(c)) this._set.delete(c);
          else this._set.add(c);
        } else if (f) this._set.add(c);
        else this._set.delete(c);
      },
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
global.window.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (typeof this.onloadend === 'function') this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      const b64 = Buffer.from(buf).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
      if (typeof this.onloadend === 'function') this.onloadend();
    });
  }
};

// Load real Three.js & GLTFExporter
global.THREE = window.THREE = Object.assign({}, require('../vendor/three.min.js'));
eval(fs.readFileSync('vendor/GLTFExporter.js', 'utf8'));

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

function parseGLBJsonChunk(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);
  assert.strictEqual(magic, 0x46546C67, 'GLB magic header must be "glTF"');
  const version = view.getUint32(4, true);
  assert.strictEqual(version, 2, 'GLB version must be 2');
  const chunkLen = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  assert.strictEqual(chunkType, 0x4E4F534A, 'First chunk must be JSON');
  const jsonBytes = new Uint8Array(arrayBuffer, 20, chunkLen);
  const jsonStr = new TextDecoder().decode(jsonBytes);
  return JSON.parse(jsonStr);
}

(async () => {
  console.log('Testing Organized GLB Export Hierarchy & Labeling...');

  const app = new FC.App();
  app.loadSample();
  // Enable ceiling and add a couple of user light fixtures + passage to test all branches
  app.plan.view.ceiling = true;
  app.addLightAt(3.0, 2.5, 'pendant');
  app.addLightAt(6.0, 3.0, 'lamp');
  if (app.plan.openings && app.plan.openings.length > 0) {
    // Also add a passage opening
    const segs = FC.getSegments(app.plan);
    const intSeg = segs.find((s) => !s.boundary && s.len > 2.0);
    if (intSeg) {
      app.plan.openings.push({
        id: FC.uid('op'),
        kind: 'opening',
        style: 'opening',
        hostKey: intSeg.key,
        offset: intSeg.len / 2,
        width: 1.0,
        height: 2.1,
        sill: 0,
      });
    }
  }
  app.viewer.needsBuild = true;

  const blob = await app.viewer.exportGLB();
  assert(blob, 'exportGLB must return a Blob');
  const arrayBuffer = await blob.arrayBuffer();
  const gltf = parseGLBJsonChunk(arrayBuffer);

  assert(Array.isArray(gltf.scenes) && gltf.scenes.length === 1, 'GLB must contain 1 scene');
  const scene = gltf.scenes[0];
  assert(scene.name && scene.name.length > 0, 'Scene must have a name');

  const topNodes = scene.nodes.map((idx) => gltf.nodes[idx]);
  const topNames = topNodes.map((n) => n.name);
  console.log('Top-level Scene Nodes:', topNames);
  assert.deepStrictEqual(topNames, ['Architecture', 'Rooms'], 'Top-level nodes must be Architecture and Rooms');

  // Verify every single node in gltf.nodes has a non-empty, unique name
  const seenNodeNames = new Set();
  gltf.nodes.forEach((n, idx) => {
    assert(n.name && typeof n.name === 'string' && n.name.trim().length > 0, `Node at index ${idx} is missing a name!`);
    assert(!/^Node_\d+$|^Mesh_\d+$/.test(n.name), `Node ${idx} has generic unnamed default: ${n.name}`);
    assert(!seenNodeNames.has(n.name), `Duplicate node name "${n.name}" found (would cause .001 in Blender)!`);
    seenNodeNames.add(n.name);
  });
  console.log(`✓ All ${gltf.nodes.length} glTF nodes have unique, descriptive names (0 generic Node_### or Mesh_###)!`);

  // Verify every single mesh in gltf.meshes has a non-empty name and is TRIANGLES (no wireframe LINES)
  assert(Array.isArray(gltf.meshes) && gltf.meshes.length > 0, 'GLB must contain meshes');
  gltf.meshes.forEach((m, idx) => {
    assert(m.name && typeof m.name === 'string' && m.name.trim().length > 0, `Mesh at index ${idx} is missing a name!`);
    assert(!/^Mesh_\d+$/.test(m.name), `Mesh ${idx} has generic unnamed default: ${m.name}`);
    (m.primitives || []).forEach((prim) => {
      // mode 4 is TRIANGLES (or undefined which defaults to 4 in glTF 2.0 spec); mode 1 is LINES
      assert(prim.mode === undefined || prim.mode === 4, `Mesh "${m.name}" has non-triangle primitive mode ${prim.mode} (wireframe line leaked into export)!`);
    });
  });
  console.log(`✓ All ${gltf.meshes.length} glTF meshes have descriptive names and zero wireframe line primitives!`);

  // Verify materials have names
  assert(Array.isArray(gltf.materials) && gltf.materials.length > 0, 'GLB must contain materials');
  gltf.materials.forEach((mat, idx) => {
    assert(mat.name && typeof mat.name === 'string' && mat.name.trim().length > 0, `Material at index ${idx} is missing a name!`);
  });
  console.log(`✓ All ${gltf.materials.length} glTF materials have descriptive names!`);

  // Inspect Architecture children
  const archNode = topNodes[0];
  const archChildren = (archNode.children || []).map((i) => gltf.nodes[i].name);
  console.log('Architecture children:', archChildren);
  assert(archChildren.includes('Foundation_Slab'), 'Architecture must contain Foundation_Slab');
  assert(archChildren.includes('Walls'), 'Architecture must contain Walls');
  assert(archChildren.includes('Openings'), 'Architecture must contain Openings');

  const wallsNode = (archNode.children || []).map((i) => gltf.nodes[i]).find((n) => n.name === 'Walls');
  const wallSubfolders = (wallsNode.children || []).map((i) => gltf.nodes[i].name);
  console.log('Walls subfolders:', wallSubfolders);
  assert(wallSubfolders.includes('Exterior_Walls'), 'Walls must contain Exterior_Walls');
  assert(wallSubfolders.includes('Interior_Walls'), 'Walls must contain Interior_Walls');

  const openingsNode = (archNode.children || []).map((i) => gltf.nodes[i]).find((n) => n.name === 'Openings');
  const openingSubfolders = (openingsNode.children || []).map((i) => gltf.nodes[i].name);
  console.log('Openings subfolders:', openingSubfolders);
  assert(openingSubfolders.includes('Doors'), 'Openings must contain Doors');
  assert(openingSubfolders.includes('Windows'), 'Openings must contain Windows');

  // Inspect Rooms children
  const roomsNode = topNodes[1];
  const roomNodes = (roomsNode.children || []).map((i) => gltf.nodes[i]);
  console.log('Rooms folders:', roomNodes.map((n) => n.name));
  assert(roomNodes.length >= app.rooms.length, 'Every room must have a folder Empty under Rooms');

  // Print sample hierarchy tree up to depth 4 for visual inspection
  function printTree(nodeIdx, indent = '') {
    const n = gltf.nodes[nodeIdx];
    const tag = n.mesh !== undefined ? `[Mesh: ${gltf.meshes[n.mesh].name}]` : '[Empty]';
    console.log(`${indent}- ${n.name} ${tag}`);
    if (indent.length < 8 && n.children) {
      n.children.slice(0, 5).forEach((cIdx) => printTree(cIdx, indent + '  '));
      if (n.children.length > 5) {
        console.log(`${indent}  ... (+${n.children.length - 5} more)`);
      }
    }
  }
  console.log('\nSample Exported GLB Hierarchy Preview:');
  scene.nodes.forEach((idx) => printTree(idx));

  console.log('\nALL GLB EXPORT HIERARCHY & LABELING TESTS PASSED! 🎉');
})();

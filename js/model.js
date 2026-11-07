/* RoomCraft — plan model, geometry, room detection and furnishing recipes. */
(function () {
  const FC = (window.FC = window.FC || {});

  /* ------------------------------------------------------------------ */
  /* Constants                                                          */
  /* ------------------------------------------------------------------ */

  FC.VERSION = 1;

  FC.defaultSettings = {
    wallHeight: 2.7,
    extThickness: 0.2,
    intThickness: 0.12,
    slabThickness: 0.18,
    doorHeight: 2.1,
    doorWidth: 0.9,
    windowSill: 0.9,
    windowHeight: 1.2,
    windowWidth: 1.4,
    showDims: true,
    snapGrid: true,
    snapAngle: true,
  };

  FC.roomTypes = {
    living: { label: 'Living room', color: '#d9c3a1', ink: '#8b6f47', icon: 'sofa' },
    bedroom: { label: 'Bedroom', color: '#cdb9a3', ink: '#82674f', icon: 'bed' },
    kitchen: { label: 'Kitchen', color: '#c8c1b3', ink: '#6f6a5d', icon: 'wall' },
    dining: { label: 'Dining room', color: '#d6c3a9', ink: '#836c4d', icon: 'layout' },
    bathroom: { label: 'Bathroom', color: '#b7c5ca', ink: '#5b747c', icon: 'window' },
    hallway: { label: 'Hallway', color: '#cbc5bb', ink: '#736e65', icon: 'door' },
    office: { label: 'Office', color: '#c6c0b1', ink: '#6b6658', icon: 'file' },
    garage: { label: 'Garage', color: '#b2b8bf', ink: '#475569', icon: 'garage' },
    utility: { label: 'Utility / Laundry', color: '#c2c9d1', ink: '#334155', icon: 'sliders' },
    patio: { label: 'Patio / Porch', color: '#c4ccb8', ink: '#4d5d40', icon: 'sun' },
    balcony: { label: 'Balcony', color: '#b9c2ac', ink: '#5e6f53', icon: 'sun' },
    storage: { label: 'Storage', color: '#c4beb4', ink: '#6e6960', icon: 'layers' },
    closet: { label: 'Closet / Walk-in', color: '#c9c3be', ink: '#5c544d', icon: 'layers' },
  };

  FC.roomTypeOrder = ['living', 'bedroom', 'kitchen', 'dining', 'bathroom', 'hallway', 'office', 'garage', 'utility', 'patio', 'balcony', 'storage', 'closet'];

  FC.styles = {
    scandinavian: {
      name: 'Scandinavian',
      swatches: ['#d8c3a5', '#f1ede5', '#bfa987', '#87998f'],
      wall: '#f1ece3', wallOutside: '#e5ded3', floor: '#d9c5a8', wood: '#c8a97c',
      cabinet: '#eae3d7', fabric: '#cfc7ba', accent: '#87998f', linen: '#f6f2ea',
      metal: '#3f3e3a', dark: '#33322f', rug: '#e4dccf', stone: '#e9e6df',
    },
    japandi: {
      name: 'Japandi',
      swatches: ['#c3ab8c', '#ece5d8', '#8c7458', '#687966'],
      wall: '#ece5d7', wallOutside: '#dfd6c6', floor: '#c6ad8d', wood: '#8f7455',
      cabinet: '#d8cab6', fabric: '#b9afa1', accent: '#687966', linen: '#f1eadf',
      metal: '#35342f', dark: '#2e2c27', rug: '#d9cebd', stone: '#e4dfd4',
    },
    warmmodern: {
      name: 'Warm Modern',
      swatches: ['#c89b72', '#efe2d3', '#a9754c', '#b15f3a'],
      wall: '#efe3d5', wallOutside: '#e3d3c1', floor: '#c99f78', wood: '#a8784f',
      cabinet: '#e4d3c0', fabric: '#c9926e', accent: '#b15f3a', linen: '#f7efe4',
      metal: '#403a34', dark: '#342e28', rug: '#dfc8b1', stone: '#eae2d7',
    },
    urbanloft: {
      name: 'Urban Loft',
      swatches: ['#9e9b97', '#e5e1dc', '#6a6560', '#2f3032'],
      wall: '#e5e1da', wallOutside: '#d5d1c9', floor: '#a4a09b', wood: '#7c5f45',
      cabinet: '#50504f', fabric: '#57575a', accent: '#2f3032', linen: '#cfcac2',
      metal: '#2e2f31', dark: '#232426', rug: '#bab4aa', stone: '#dedad2',
    },
    minimalist: {
      name: 'Minimalist',
      swatches: ['#ffffff', '#ebebeb', '#888888', '#111111'],
      wall: '#fdfdfd', wallOutside: '#efefef', floor: '#dedede', wood: '#3a3a3c',
      cabinet: '#f5f5f7', fabric: '#8e8e93', accent: '#111111', linen: '#ffffff',
      metal: '#1c1c1e', dark: '#000000', rug: '#ebebf0', stone: '#f2f2f7',
    },
    terracotta: {
      name: 'Terracotta',
      swatches: ['#d97d54', '#f5e6d3', '#9c5333', '#4f6b58'],
      wall: '#f5ede4', wallOutside: '#e8dbce', floor: '#c47853', wood: '#824936',
      cabinet: '#eedbc5', fabric: '#ba6e50', accent: '#4f6b58', linen: '#faf3eb',
      metal: '#3b2f2f', dark: '#2b1f1a', rug: '#e2ccb8', stone: '#d99b82',
    },
    slatebrass: {
      name: 'Nordic Slate',
      swatches: ['#475569', '#f8fafc', '#d97706', '#1e293b'],
      wall: '#f1f5f9', wallOutside: '#e2e8f0', floor: '#64748b', wood: '#78350f',
      cabinet: '#334155', fabric: '#94a3b8', accent: '#d97706', linen: '#ffffff',
      metal: '#b45309', dark: '#0f172a', rug: '#cbd5e1', stone: '#475569',
    },
    sageoak: {
      name: 'Sage & Oak',
      swatches: ['#82957b', '#f6f5f0', '#b5885c', '#465541'],
      wall: '#f3f4ed', wallOutside: '#e5e7dc', floor: '#bfa37e', wood: '#8a623f',
      cabinet: '#cad2c5', fabric: '#84a98c', accent: '#465541', linen: '#faf9f6',
      metal: '#2f3e2e', dark: '#1e281d', rug: '#d8e2dc', stone: '#c5d3c1',
    },
  };
  FC.styleOrder = ['scandinavian', 'japandi', 'warmmodern', 'urbanloft', 'minimalist', 'terracotta', 'slatebrass', 'sageoak'];

  /* ------------------------------------------------------------------ */
  /* Math helpers                                                       */
  /* ------------------------------------------------------------------ */

  const TAU = Math.PI * 2;
  const clamp = (FC.clamp = (v, a, b) => Math.max(a, Math.min(b, v)));
  const round = (FC.round = (v, n = 3) => {
    const m = Math.pow(10, n);
    return Math.round(v * m) / m;
  });
  FC.uid = (prefix = 'id') =>
    (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  FC.dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  FC.lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  FC.add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  FC.sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  FC.mul = (a, s) => ({ x: a.x * s, y: a.y * s });
  FC.cross = (a, b) => a.x * b.y - a.y * b.x;
  FC.dot = (a, b) => a.x * b.x + a.y * b.y;
  FC.norm = (a) => {
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  };
  FC.angleDiff = (a, b) => {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  FC.fmt = (v, digits = 2) => (Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits);
  FC.fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

  FC.pointSegment = function (p, a, b) {
    const ab = FC.sub(b, a);
    const len2 = ab.x * ab.x + ab.y * ab.y;
    if (len2 < 1e-12) return { t: 0, dist: FC.dist(p, a), point: { x: a.x, y: a.y } };
    const t = clamp(FC.dot(FC.sub(p, a), ab) / len2, 0, 1);
    const point = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return { t, dist: FC.dist(p, point), point };
  };

  FC.segmentIntersection = function (a, b, c, d) {
    const r = FC.sub(b, a);
    const s = FC.sub(d, c);
    const den = FC.cross(r, s);
    if (Math.abs(den) < 1e-9) return null;
    const qp = FC.sub(c, a);
    const t = FC.cross(qp, s) / den;
    const u = FC.cross(qp, r) / den;
    if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null;
    return { t, u, point: { x: a.x + r.x * t, y: a.y + r.y * t } };
  };

  FC.polygonArea = function (pts) {
    if (!pts || pts.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
  };

  FC.polygonCentroid = function (pts) {
    if (!pts || !pts.length) return { x: 0, y: 0 };
    const area = FC.polygonArea(pts);
    if (Math.abs(area) < 1e-9) {
      let x = 0;
      let y = 0;
      pts.forEach((p) => {
        x += p.x;
        y += p.y;
      });
      return { x: x / pts.length, y: y / pts.length };
    }
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const f = a.x * b.y - b.x * a.y;
      cx += (a.x + b.x) * f;
      cy += (a.y + b.y) * f;
    }
    return { x: cx / (6 * area), y: cy / (6 * area) };
  };

  FC.pointInPolygon = function (p, pts) {
    if (!pts || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };

  FC.polygonBounds = function (pts) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    (pts || []).forEach((p) => {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    });
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, d: 0, cx: 0, cy: 0 };
    return { x0, y0, x1, y1, w: x1 - x0, d: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  FC.isSimplePolygon = function (pts) {
    if (!pts || pts.length < 3) return false;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a1 = pts[i];
      const a2 = pts[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        if (j === i) continue;
        const b1 = pts[j];
        const b2 = pts[(j + 1) % n];
        if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;
        if (FC.segmentIntersection(a1, a2, b1, b2)) return false;
      }
    }
    return Math.abs(FC.polygonArea(pts)) > 0.001;
  };

  FC.dedupePolygon = function (pts) {
    const out = [];
    (pts || []).forEach((p) => {
      const last = out[out.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 1e-5) out.push({ x: round(p.x, 4), y: round(p.y, 4) });
    });
    if (out.length > 2) {
      const first = out[0];
      const last = out[out.length - 1];
      if (first.x === last.x && first.y === last.y) out.pop();
    }
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Junctions and wall operations                                      */
  /* ------------------------------------------------------------------ */

  FC.findJunctions = function (plan, tol = 0.06) {
    const junctions = [];
    function findNear(p) {
      return junctions.find((j) => Math.hypot(j.x - p.x, j.y - p.y) <= tol);
    }
    (plan.outline || []).forEach((p, idx) => {
      let j = findNear(p);
      if (!j) {
        j = { id: 'j_out_' + idx, x: p.x, y: p.y, refs: [] };
        junctions.push(j);
      }
      j.refs.push({ type: 'outline', index: idx });
    });
    (plan.walls || []).forEach((w) => {
      [{ p: w.a, end: 0 }, { p: w.b, end: 1 }].forEach((pt) => {
        let j = findNear(pt.p);
        if (!j) {
          j = { id: 'j_w_' + w.id + '_' + pt.end, x: pt.p.x, y: pt.p.y, refs: [] };
          junctions.push(j);
        }
        j.refs.push({ type: 'wall', wallId: w.id, end: pt.end });
      });
    });
    return junctions;
  };

  FC.moveJunction = function (plan, junction, newX, newY) {
    const rx = FC.round(newX, 3);
    const ry = FC.round(newY, 3);
    junction.refs.forEach((ref) => {
      if (ref.type === 'outline') {
        const p = plan.outline[ref.index];
        if (p) {
          p.x = rx;
          p.y = ry;
        }
      } else if (ref.type === 'wall') {
        const wall = plan.walls.find((w) => w.id === ref.wallId);
        if (wall) {
          const target = ref.end === 0 ? wall.a : wall.b;
          target.x = rx;
          target.y = ry;
        }
      }
    });
    junction.x = rx;
    junction.y = ry;
  };

  FC.resizeWall = function (plan, wallId, newLen, fromEnd = 0) {
    const wall = plan.walls.find((w) => w.id === wallId);
    if (!wall) return false;
    const curLen = FC.dist(wall.a, wall.b);
    if (curLen < 1e-4) return false;
    newLen = Math.max(0.3, newLen);
    const dir = { x: (wall.b.x - wall.a.x) / curLen, y: (wall.b.y - wall.a.y) / curLen };

    if (fromEnd === 0) {
      wall.b.x = FC.round(wall.a.x + dir.x * newLen, 3);
      wall.b.y = FC.round(wall.a.y + dir.y * newLen, 3);
    } else if (fromEnd === 1) {
      wall.a.x = FC.round(wall.b.x - dir.x * newLen, 3);
      wall.a.y = FC.round(wall.b.y - dir.y * newLen, 3);
    } else {
      const mid = FC.lerp(wall.a, wall.b, 0.5);
      const half = newLen / 2;
      wall.a.x = FC.round(mid.x - dir.x * half, 3);
      wall.a.y = FC.round(mid.y - dir.y * half, 3);
      wall.b.x = FC.round(mid.x + dir.x * half, 3);
      wall.b.y = FC.round(mid.y + dir.y * half, 3);
    }
    return true;
  };

  FC.splitWall = function (plan, wallId, point) {
    const wall = plan.walls.find((w) => w.id === wallId);
    if (!wall) return null;
    const p = { x: FC.round(point.x, 3), y: FC.round(point.y, 3) };
    const oldB = { x: wall.b.x, y: wall.b.y };
    wall.b.x = p.x;
    wall.b.y = p.y;
    const newWall = {
      id: FC.uid('w'),
      a: { x: p.x, y: p.y },
      b: oldB,
    };
    plan.walls.push(newWall);
    return newWall;
  };

  /* ------------------------------------------------------------------ */
  /* Plans                                                              */
  /* ------------------------------------------------------------------ */

  FC.createPlan = function (name) {
    return {
      id: FC.uid('plan'),
      version: FC.VERSION,
      name: name || 'My first floor plan',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      outline: [],
      walls: [],
      openings: [],
      rooms: [],
      lights: [],
      settings: Object.assign({}, FC.defaultSettings),
      style: 'scandinavian',
      customStyle: null,
      density: 1,
      layoutVariation: 0,
      furnished: false,
      view: { sunTime: 14.5, ceiling: false, xray: false, autoRotate: false },
    };
  };

  FC.normalizePlan = function (raw) {
    const base = FC.createPlan(raw && raw.name);
    if (!raw || typeof raw !== 'object') return base;
    const plan = Object.assign(base, raw);
    plan.settings = Object.assign({}, FC.defaultSettings, raw.settings || {});
    plan.view = Object.assign({ sunTime: 14.5, ceiling: false, xray: false, autoRotate: false }, raw.view || {});
    plan.outline = Array.isArray(raw.outline) ? raw.outline.map((p) => ({ x: +p.x || 0, y: +p.y || 0 })) : [];
    plan.walls = Array.isArray(raw.walls)
      ? raw.walls
          .filter((w) => w && w.a && w.b)
          .map((w) => ({ id: w.id || FC.uid('w'), a: { x: +w.a.x || 0, y: +w.a.y || 0 }, b: { x: +w.b.x || 0, y: +w.b.y || 0 } }))
      : [];
    plan.openings = Array.isArray(raw.openings)
      ? raw.openings
          .filter((o) => o && typeof o.hostKey === 'string')
          .map((o) => ({
            id: o.id || FC.uid('op'),
            kind: o.kind === 'window' ? 'window' : o.kind === 'opening' ? 'opening' : 'door',
            style: o.style || (o.kind === 'window' ? 'standard' : 'single'),
            hostKey: o.hostKey,
            offset: +o.offset || 0,
            width: +o.width || (o.kind === 'window' ? 1.4 : 0.9),
            height: +o.height || (o.kind === 'window' ? 1.2 : 2.1),
            sill: +o.sill || 0,
          }))
      : [];
    plan.rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
    plan.lights = Array.isArray(raw.lights)
      ? raw.lights.map((l) => ({
          id: l.id || FC.uid('lit'),
          type: l.type || 'ceiling',
          x: +l.x || 0,
          y: +l.y || 0,
          z: +l.z || 2.4,
          intensity: l.intensity != null ? +l.intensity : 1.0,
          color: l.color || '#fff1de',
          range: +l.range || 6.0,
        }))
      : [];
    plan.layoutVariation = parseInt(raw.layoutVariation, 10) || 0;
    plan.settings.wallHeight = clamp(plan.settings.wallHeight, 1.8, 5);
    plan.density = clamp(+raw.density || 1, 0.4, 1.6);
    return plan;
  };

  FC.samplePlan = function () {
    const plan = FC.createPlan('Sample apartment');
    plan.outline = [
      { x: 0, y: 0 },
      { x: 11, y: 0 },
      { x: 11, y: 8 },
      { x: 0, y: 8 },
    ];
    plan.walls = [
      { id: 'w1', a: { x: 5, y: 0 }, b: { x: 5, y: 4.4 } },
      { id: 'w2', a: { x: 5, y: 2.6 }, b: { x: 7.4, y: 2.6 } },
      { id: 'w3', a: { x: 7.4, y: 0 }, b: { x: 7.4, y: 4.4 } },
      { id: 'w4', a: { x: 0, y: 4.4 }, b: { x: 5, y: 4.4 } },
      { id: 'w5', a: { x: 7.4, y: 4.4 }, b: { x: 11, y: 4.4 } },
      { id: 'w6', a: { x: 5, y: 4.4 }, b: { x: 7.4, y: 4.4 } },
    ];
    plan.openings = [
      { id: 'd1', kind: 'door', style: 'single', hostKey: 'w:w4', offset: 3.65, width: 0.9, height: 2.1, sill: 0 },
      { id: 'd2', kind: 'door', style: 'single', hostKey: 'w:w5', offset: 0.85, width: 0.9, height: 2.1, sill: 0 },
      { id: 'd3', kind: 'door', style: 'single', hostKey: 'w:w2', offset: 1.35, width: 0.8, height: 2.05, sill: 0 },
      { id: 'd4', kind: 'opening', style: 'opening', hostKey: 'w:w6', offset: 1.2, width: 1.7, height: 2.25, sill: 0 },
      { id: 'd5', kind: 'door', style: 'single', hostKey: 'o:2', offset: 5.8, width: 1.0, height: 2.2, sill: 0 },
      { id: 'g1', kind: 'window', style: 'standard', hostKey: 'o:0', offset: 2.5, width: 2.0, height: 1.3, sill: 0.9 },
      { id: 'g2', kind: 'window', style: 'standard', hostKey: 'o:0', offset: 6.2, width: 0.8, height: 0.8, sill: 1.25 },
      { id: 'g3', kind: 'window', style: 'standard', hostKey: 'o:0', offset: 9.1, width: 1.6, height: 1.3, sill: 0.9 },
      { id: 'g4', kind: 'window', style: 'sliding', hostKey: 'o:1', offset: 2.0, width: 1.4, height: 1.4, sill: 0.8 },
      { id: 'g5', kind: 'window', style: 'standard', hostKey: 'o:2', offset: 3.0, width: 2.4, height: 1.4, sill: 0.7 },
      { id: 'g6', kind: 'window', style: 'standard', hostKey: 'o:3', offset: 2.2, width: 1.6, height: 1.2, sill: 1.0 },
    ];
    plan.lights = [
      { id: 'l1', type: 'pendant', x: 2.5, y: 6.2, z: 2.4, color: '#fff1de', intensity: 1.0, range: 6 },
      { id: 'l2', type: 'ceiling', x: 2.5, y: 2.2, z: 2.6, color: '#ffeacc', intensity: 0.9, range: 5 },
      { id: 'l3', type: 'spot', x: 9.2, y: 2.2, z: 2.5, color: '#fef3e2', intensity: 1.1, range: 5 },
      { id: 'l4', type: 'lamp', x: 4.6, y: 7.4, z: 1.6, color: '#ffd6aa', intensity: 0.8, range: 4 },
      { id: 'l5', type: 'ceiling', x: 6.2, y: 1.3, z: 2.6, color: '#ffffff', intensity: 0.9, range: 4 },
    ];
    plan.style = 'scandinavian';
    plan.furnished = true;
    plan.density = 1;
    return plan;
  };

  /* ------------------------------------------------------------------ */
  /* Walls and openings                                                 */
  /* ------------------------------------------------------------------ */

  FC.getSegments = function (plan) {
    const segs = [];
    const outline = plan.outline || [];
    const s = plan.settings || FC.defaultSettings;
    if (outline.length >= 2) {
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-4) continue;
        segs.push({
          key: 'o:' + i,
          a,
          b,
          boundary: true,
          index: i,
          thickness: s.extThickness,
          len: FC.dist(a, b),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
        });
      }
    }
    (plan.walls || []).forEach((w, index) => {
      if (Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) < 1e-4) return;
      segs.push({
        key: 'w:' + w.id,
        id: w.id,
        a: w.a,
        b: w.b,
        wall: w,
        boundary: false,
        index,
        thickness: s.intThickness,
        len: FC.dist(w.a, w.b),
        angle: Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x),
      });
    });
    return segs;
  };

  FC.segmentByKey = function (plan, key) {
    return FC.getSegments(plan).find((s) => s.key === key) || null;
  };

  FC.openingPlacement = function (plan, op, segments) {
    const segs = segments || FC.getSegments(plan);
    const s = plan.settings;
    const seg = segs.find((x) => x.key === op.hostKey);
    if (!seg) return null;
    const width = Math.min(op.width, Math.max(0.2, seg.len - 0.08));
    const offset = clamp(op.offset, width / 2 + 0.02, seg.len - width / 2 - 0.02);
    const p = FC.lerp(seg.a, seg.b, offset / seg.len);
    const height = op.kind === 'window' ? Math.min(op.height, s.wallHeight - 0.1) : Math.min(op.height, s.wallHeight - 0.05);
    const sill = op.kind === 'window' ? clamp(op.sill, 0, Math.max(0, s.wallHeight - height - 0.05)) : 0;
    return {
      op,
      seg,
      width,
      height,
      sill,
      offset,
      x: p.x,
      y: p.y,
      angle: seg.angle,
      nx: -Math.sin(seg.angle),
      ny: Math.cos(seg.angle),
    };
  };

  FC.openingBounds = function (op, segments) {
    const seg = segments.find((s) => s.key === op.hostKey);
    if (!seg) return null;
    const half = op.width / 2;
    return { start: op.offset - half - 0.08, end: op.offset + half + 0.08, len: seg.len };
  };

  FC.canPlaceOpening = function (plan, hostKey, offset, width, ignoreId) {
    const segs = FC.getSegments(plan);
    const seg = segs.find((s) => s.key === hostKey);
    if (!seg) return false;
    if (width > seg.len - 0.12) return false;
    const lo = offset - width / 2 - 0.06;
    const hi = offset + width / 2 + 0.06;
    if (lo < 0 || hi > seg.len) return false;
    for (const op of plan.openings) {
      if (op.id === ignoreId || op.hostKey !== hostKey) continue;
      const a = op.offset - op.width / 2 - 0.05;
      const b = op.offset + op.width / 2 + 0.05;
      if (lo < b && hi > a) return false;
    }
    return true;
  };

  FC.nearestWall = function (plan, p, maxDist, filterFn) {
    let best = null;
    FC.getSegments(plan).forEach((seg) => {
      if (filterFn && !filterFn(seg)) return;
      const hit = FC.pointSegment(p, seg.a, seg.b);
      if (hit.dist <= maxDist && (!best || hit.dist < best.dist)) best = { seg, dist: hit.dist, offset: hit.t * seg.len, point: hit.point };
    });
    return best;
  };

  FC.ensureOpeningHosts = function (plan) {
    const segs = FC.getSegments(plan);
    const removed = [];
    plan.openings = (plan.openings || []).filter((op) => {
      let seg = segs.find((s) => s.key === op.hostKey);
      if (!seg) {
        const pos = FC.openingPlacement(plan, op, segs);
        const near = pos ? FC.nearestWall(plan, { x: pos.x, y: pos.y }, 0.9) : null;
        if (!near) {
          removed.push(op);
          return false;
        }
        op.hostKey = near.seg.key;
        op.offset = near.offset;
        seg = near.seg;
      }
      const w = op.width || 0.9;
      op.offset = clamp(op.offset, w / 2 + 0.02, seg.len - w / 2 - 0.02);
      return true;
    });

    // De-duplicate and resolve overlaps on the same wall segment
    const byHost = new Map();
    plan.openings.forEach((op) => {
      if (!byHost.has(op.hostKey)) byHost.set(op.hostKey, []);
      byHost.get(op.hostKey).push(op);
    });

    const keptOpenings = [];
    byHost.forEach((ops, hostKey) => {
      if (ops.length === 1) {
        keptOpenings.push(ops[0]);
        return;
      }
      ops.sort((a, b) => a.offset - b.offset);
      const filtered = [];
      for (let i = 0; i < ops.length; i++) {
        const cur = ops[i];
        if (filtered.length > 0) {
          const prev = filtered[filtered.length - 1];
          const minCenterDist = (cur.width + prev.width) / 2;
          const centerDist = cur.offset - prev.offset;
          if (centerDist < 0.25) {
            // Duplicate opening detected, skip
            continue;
          } else if (centerDist < minCenterDist + 0.04) {
            // Overlapping adjacent openings: separate them
            const seg = segs.find((s) => s.key === hostKey);
            const neededShift = (minCenterDist + 0.04 - centerDist) / 2;
            prev.offset = Math.max(prev.width / 2 + 0.02, prev.offset - neededShift);
            cur.offset = Math.min((seg ? seg.len : 999) - cur.width / 2 - 0.02, cur.offset + neededShift);
          }
        }
        filtered.push(cur);
      }
      filtered.forEach((op) => keptOpenings.push(op));
    });

    plan.openings = keptOpenings;
    return removed;
  };

  FC.rectifyWalls = function (plan) {
    if (!plan || !plan.walls) return;

    for (let pass = 0; pass < 2; pass++) {
      plan.walls.forEach((w) => {
        const dx = w.b.x - w.a.x;
        const dy = w.b.y - w.a.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.04) return;
        const deg = (((Math.atan2(dy, dx) * 180) / Math.PI % 180) + 180) % 180;

        if (deg < 6 || deg > 174 || Math.abs(dy) < 0.08) {
          const avgY = FC.round((w.a.y + w.b.y) / 2, 3);
          w.a.y = avgY;
          w.b.y = avgY;
        } else if (Math.abs(deg - 90) < 6 || Math.abs(dx) < 0.08) {
          const avgX = FC.round((w.a.x + w.b.x) / 2, 3);
          w.a.x = avgX;
          w.b.x = avgX;
        } else if (Math.abs(deg - 45) < 5 || Math.abs(deg - 135) < 5) {
          const signX = w.b.x - w.a.x >= 0 ? 1 : -1;
          const signY = w.b.y - w.a.y >= 0 ? 1 : -1;
          const avgD = (Math.abs(dx) + Math.abs(dy)) / 2;
          w.b.x = FC.round(w.a.x + signX * avgD, 3);
          w.b.y = FC.round(w.a.y + signY * avgD, 3);
        }
      });

      const weldDist = 0.08;
      for (let i = 0; i < plan.walls.length; i++) {
        const w1 = plan.walls[i];
        const isHoriz1 = w1.a.y === w1.b.y;
        const isVert1 = w1.a.x === w1.b.x;

        for (let j = i + 1; j < plan.walls.length; j++) {
          const w2 = plan.walls[j];
          const isHoriz2 = w2.a.y === w2.b.y;
          const isVert2 = w2.a.x === w2.b.x;

          ['a', 'b'].forEach((k1) => {
            ['a', 'b'].forEach((k2) => {
              if (Math.hypot(w1[k1].x - w2[k2].x, w1[k1].y - w2[k2].y) <= weldDist) {
                if (isHoriz1 && isVert2) {
                  w1[k1].x = w2[k2].x;
                  w2[k2].y = w1[k1].y;
                } else if (isVert1 && isHoriz2) {
                  w1[k1].y = w2[k2].y;
                  w2[k2].x = w1[k1].x;
                } else if (isHoriz1 && isHoriz2) {
                  const avgY = FC.round((w1[k1].y + w2[k2].y) / 2, 3);
                  w1.a.y = w1.b.y = w2.a.y = w2.b.y = avgY;
                  const midX = FC.round((w1[k1].x + w2[k2].x) / 2, 3);
                  w1[k1].x = w2[k2].x = midX;
                } else if (isVert1 && isVert2) {
                  const avgX = FC.round((w1[k1].x + w2[k2].x) / 2, 3);
                  w1.a.x = w1.b.x = w2.a.x = w2.b.x = avgX;
                  const midY = FC.round((w1[k1].y + w2[k2].y) / 2, 3);
                  w1[k1].y = w2[k2].y = midY;
                } else {
                  const midX = FC.round((w1[k1].x + w2[k2].x) / 2, 3);
                  const midY = FC.round((w1[k1].y + w2[k2].y) / 2, 3);
                  w1[k1].x = w2[k2].x = midX;
                  w1[k1].y = w2[k2].y = midY;
                }
              }
            });
          });
        }
      }
    }

    plan.walls.forEach((w) => {
      const deg = (((Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180) / Math.PI % 180) + 180) % 180;
      if (deg < 1 || deg > 179) {
        w.b.y = w.a.y;
      } else if (Math.abs(deg - 90) < 1) {
        w.b.x = w.a.x;
      }
    });

    plan.walls = plan.walls.filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) >= 0.05);
  };

  /* ------------------------------------------------------------------ */
  /* Room detection (planar face walk)                                  */
  /* ------------------------------------------------------------------ */

  FC.healWallJunctions = function (plan, options) {
    options = options || {};
    const walls = plan.walls || [];
    const outline = plan.outline || [];
    if (!outline.length && !walls.length) return;

    const s = plan.settings || FC.defaultSettings;
    const extThick = options.extThickness || s.extThickness || 0.20;
    const intThick = options.intThickness || s.intThickness || 0.12;
    // CAD interior walls stop at inside drywall face of exterior walls:
    // Gap to outer outline is extThick (typically 0.15 - 0.25m).
    const maxExtGap = options.maxExtGap || Math.max(extThick * 1.6, 0.36);
    // CAD walls meeting other walls stop at drywall face (gap intThick/2 to intThick):
    const maxIntGap = options.maxIntGap || Math.max(intThick * 2.2, 0.28);
    const weldDist = options.weldDist || 0.08;

    const outSegs = [];
    for (let i = 0; i < outline.length; i++) {
      outSegs.push({ a: outline[i], b: outline[(i + 1) % outline.length], idx: i });
    }

    // 1. Ray-extension to outline:
    // If extending a wall forward along its longitudinal vector intersects an outline segment within maxExtGap,
    // extend that wall endpoint right to the outline intersection point.
    walls.forEach((w) => {
      const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.05) return;
      const ux = dx / len, uy = dy / len;

      // Forward extension of endpoint b (+u)
      let bestDistB = Infinity, bestPtB = null;
      outSegs.forEach((os) => {
        const sx = os.b.x - os.a.x, sy = os.b.y - os.a.y;
        const denom = ux * sy - uy * sx;
        if (Math.abs(denom) > 1e-5) {
          const t = ((os.a.x - w.b.x) * sy - (os.a.y - w.b.y) * sx) / denom;
          const sParam = ((os.a.x - w.b.x) * uy - (os.a.y - w.b.y) * ux) / denom;
          if (t >= -0.01 && t <= maxExtGap && sParam >= -0.01 && sParam <= 1.01) {
            if (t < bestDistB) {
              bestDistB = t;
              bestPtB = { x: w.b.x + ux * t, y: w.b.y + uy * t };
            }
          }
        }
      });
      if (bestPtB && bestDistB <= maxExtGap) {
        w.b.x = FC.round(bestPtB.x, 3);
        w.b.y = FC.round(bestPtB.y, 3);
      }

      // Backward extension of endpoint a (-u)
      let bestDistA = Infinity, bestPtA = null;
      outSegs.forEach((os) => {
        const sx = os.b.x - os.a.x, sy = os.b.y - os.a.y;
        const denom = -ux * sy - (-uy) * sx;
        if (Math.abs(denom) > 1e-5) {
          const t = ((os.a.x - w.a.x) * sy - (os.a.y - w.a.y) * sx) / denom;
          const sParam = ((os.a.x - w.a.x) * (-uy) - (os.a.y - w.a.y) * (-ux)) / denom;
          if (t >= -0.01 && t <= maxExtGap && sParam >= -0.01 && sParam <= 1.01) {
            if (t < bestDistA) {
              bestDistA = t;
              bestPtA = { x: w.a.x - ux * t, y: w.a.y - uy * t };
            }
          }
        }
      });
      if (bestPtA && bestDistA <= maxExtGap) {
        w.a.x = FC.round(bestPtA.x, 3);
        w.a.y = FC.round(bestPtA.y, 3);
      }
    });

    // 2. Intersection extension between interior walls (T-junctions & L-junctions)
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < walls.length; i++) {
        const w1 = walls[i];
        const dx1 = w1.b.x - w1.a.x, dy1 = w1.b.y - w1.a.y;
        const len1 = Math.hypot(dx1, dy1);
        if (len1 < 0.05) continue;

        for (let j = 0; j < walls.length; j++) {
          if (i === j) continue;
          const w2 = walls[j];
          const dx2 = w2.b.x - w2.a.x, dy2 = w2.b.y - w2.a.y;
          const len2 = Math.hypot(dx2, dy2);
          if (len2 < 0.05) continue;

          const denom = dx1 * dy2 - dy1 * dx2;
          if (Math.abs(denom) < 1e-5) continue; // parallel

          // Line-line intersection point P
          const t1 = ((w2.a.x - w1.a.x) * dy2 - (w2.a.y - w1.a.y) * dx2) / denom;
          const t2 = ((w2.a.x - w1.a.x) * dy1 - (w2.a.y - w1.a.y) * dx1) / denom;

          const px = w1.a.x + dx1 * t1;
          const py = w1.a.y + dy1 * t1;

          // Check if intersection is close to an endpoint of w1
          const distToA1 = Math.hypot(px - w1.a.x, py - w1.a.y);
          const distToB1 = Math.hypot(px - w1.b.x, py - w1.b.y);
          const isNearEnd1 = (distToA1 <= maxIntGap && t1 <= 0.08) || (distToB1 <= maxIntGap && t1 >= 0.92);

          // Check if P falls on or near w2's segment
          const isWithinW2 = t2 >= -0.15 && t2 <= 1.15;

          if (isNearEnd1 && isWithinW2) {
            // L-junction check: is P also near an endpoint of w2?
            const distToA2 = Math.hypot(px - w2.a.x, py - w2.a.y);
            const distToB2 = Math.hypot(px - w2.b.x, py - w2.b.y);
            const isNearEnd2 = distToA2 <= maxIntGap || distToB2 <= maxIntGap;

            if (distToA1 < distToB1) {
              w1.a.x = FC.round(px, 3);
              w1.a.y = FC.round(py, 3);
            } else {
              w1.b.x = FC.round(px, 3);
              w1.b.y = FC.round(py, 3);
            }

            if (isNearEnd2) {
              if (distToA2 < distToB2) {
                w2.a.x = FC.round(px, 3);
                w2.a.y = FC.round(py, 3);
              } else {
                w2.b.x = FC.round(px, 3);
                w2.b.y = FC.round(py, 3);
              }
            }
          }
        }
      }
    }

    // 3. Perpendicular projection fallback for any endpoints still slightly off outline or other walls
    walls.forEach((w) => {
      ['a', 'b'].forEach((k) => {
        let bestDist = Infinity, bestPt = null;
        outSegs.forEach((os) => {
          const h = FC.pointSegment(w[k], os.a, os.b);
          if (h.dist < bestDist) {
            bestDist = h.dist;
            bestPt = h.point;
          }
        });
        if (bestDist > 1e-4 && bestDist <= maxExtGap && bestPt) {
          w[k].x = FC.round(bestPt.x, 3);
          w[k].y = FC.round(bestPt.y, 3);
        }
      });
    });

    walls.forEach((w1) => {
      ['a', 'b'].forEach((k) => {
        let bestDist = Infinity, bestPt = null;
        walls.forEach((w2) => {
          if (w1 === w2) return;
          const h = FC.pointSegment(w1[k], w2.a, w2.b);
          if (h.dist < bestDist) {
            bestDist = h.dist;
            bestPt = h.point;
          }
        });
        if (bestDist > 1e-4 && bestDist <= maxIntGap && bestPt) {
          w1[k].x = FC.round(bestPt.x, 3);
          w1[k].y = FC.round(bestPt.y, 3);
        }
      });
    });

    // 4. Union-Find Cluster Welding: Weld very close endpoints (< weldDist, 0.08m) into unified joints (eliminates double-dots)
    const pts = [];
    walls.forEach((w) => { pts.push(w.a); pts.push(w.b); });

    const parent = pts.map((_, idx) => idx);
    function findRoot(idx) {
      if (parent[idx] === idx) return idx;
      return (parent[idx] = findRoot(parent[idx]));
    }
    function unionRoots(i1, i2) {
      const r1 = findRoot(i1);
      const r2 = findRoot(i2);
      if (r1 !== r2) parent[r1] = r2;
    }

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) <= weldDist) {
          unionRoots(i, j);
        }
      }
    }

    const clusters = new Map();
    for (let i = 0; i < pts.length; i++) {
      const root = findRoot(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(pts[i]);
    }

    clusters.forEach((members) => {
      if (members.length <= 1) return;
      let sumX = 0, sumY = 0;
      members.forEach((p) => { sumX += p.x; sumY += p.y; });
      const avgX = FC.round(sumX / members.length, 3);
      const avgY = FC.round(sumY / members.length, 3);
      members.forEach((p) => { p.x = avgX; p.y = avgY; });
    });

    // 5. Rectify walls so that healing never leaves walls crooked or skewed off orthogonal axes
    if (FC.rectifyWalls) {
      FC.rectifyWalls(plan);
    }
  };

  FC.closeWallGaps = function (plan, maxGap) {
    FC.healWallJunctions(plan, { maxExtGap: maxGap, maxIntGap: maxGap });
  };

  function buildHalfEdgeGraph(plan) {
    const base = FC.getSegments(plan).filter((s) => s.len > 0.12);
    const cuts = base.map(() => [0, 1]);

    for (let i = 0; i < base.length; i++) {
      for (let j = 0; j < base.length; j++) {
        if (i === j) continue;
        // T-junction: endpoint of segment j meets interior of segment i
        ['a', 'b'].forEach((k) => {
          const pt = base[j][k];
          const hit = FC.pointSegment(pt, base[i].a, base[i].b);
          if (hit.dist < 0.04 && hit.t > 0.005 && hit.t < 0.995) {
            cuts[i].push(hit.t);
          }
        });
        if (j > i) {
          const hit = FC.segmentIntersection(base[i].a, base[i].b, base[j].a, base[j].b);
          if (hit) {
            if (hit.t > 1e-5 && hit.t < 1 - 1e-5) cuts[i].push(hit.t);
            if (hit.u > 1e-5 && hit.u < 1 - 1e-5) cuts[j].push(hit.u);
          }
        }
      }
    }

    const nodes = new Map();
    const adjacency = new Map();
    const keyFor = (x, y) => Math.round(x * 100) + ',' + Math.round(y * 100);

    function addNode(x, y) {
      const k = keyFor(x, y);
      if (!nodes.has(k)) nodes.set(k, { key: k, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
      return k;
    }
    function addDir(from, to) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      const list = adjacency.get(from);
      if (list.some((n) => n.to === to)) return;
      const A = nodes.get(from);
      const B = nodes.get(to);
      list.push({ to, angle: Math.atan2(B.y - A.y, B.x - A.x) });
    }

    base.forEach((seg, idx) => {
      const list = Array.from(new Set(cuts[idx])).sort((a, b) => a - b);
      for (let k = 0; k < list.length - 1; k++) {
        const t0 = list[k];
        const t1 = list[k + 1];
        if ((t1 - t0) * seg.len < 0.02) continue;
        const a = FC.lerp(seg.a, seg.b, t0);
        const b = FC.lerp(seg.a, seg.b, t1);
        const u = addNode(a.x, a.y);
        const v = addNode(b.x, b.y);
        if (u === v) continue;
        addDir(u, v);
        addDir(v, u);
      }
    });

    adjacency.forEach((list) => list.sort((a, b) => a.angle - b.angle));
    return { nodes, adjacency };
  }

  FC.detectRooms = function (plan) {
    if (!plan.outline || plan.outline.length < 3) return [];
    const outline = plan.outline;
    const outlineArea = Math.abs(FC.polygonArea(outline));
    if (outlineArea < 0.5) return [];

    // Automatically close minor wall gaps before planar graph walk
    FC.closeWallGaps(plan, 0.22);

    const graph = buildHalfEdgeGraph(plan);
    const { nodes, adjacency } = graph;
    const visited = new Set();
    const faces = [];
    let guard = 0;

    adjacency.forEach((list, startU) => {
      list.forEach((startEdge) => {
        const startV = startEdge.to;
        if (visited.has(startU + '>' + startV)) return;
        const cycle = [];
        let cu = startU;
        let cv = startV;
        let steps = 0;
        do {
          visited.add(cu + '>' + cv);
          cycle.push(cu);
          const nbrs = adjacency.get(cv) || [];
          let idx = nbrs.findIndex((n) => n.to === cu);
          if (idx < 0) break;
          const next = nbrs[(idx - 1 + nbrs.length) % nbrs.length];
          cu = cv;
          cv = next.to;
          steps++;
        } while (!(cu === startU && cv === startV) && steps < 10000 && guard++ < 50000);

        if (cycle.length >= 3) {
          const poly = cycle.map((k) => ({ x: nodes.get(k).x, y: nodes.get(k).y }));
          const area = FC.polygonArea(poly);
          if (area > 0.4) {
            const clean = FC.dedupePolygon(poly);
            if (clean.length >= 3) {
              const centroid = FC.polygonCentroid(clean);
              if (FC.pointInPolygon(centroid, outline)) {
                faces.push({ polygon: clean, area: Math.abs(FC.polygonArea(clean)), centroid });
              }
            }
          }
        }
      });
    });

    // Deduplicate identical / near-identical faces
    const unique = [];
    faces.sort((a, b) => b.area - a.area);
    for (const f of faces) {
      const dup = unique.find((u) => Math.abs(u.area - f.area) < 0.1 && FC.dist(u.centroid, f.centroid) < 0.25);
      if (!dup) unique.push(f);
    }

    // Merge in any manually defined rooms from plan.manualRooms
    if (Array.isArray(plan.manualRooms)) {
      plan.manualRooms.forEach((mr) => {
        if (!mr || !mr.polygon || mr.polygon.length < 3) return;
        const clean = FC.dedupePolygon(mr.polygon);
        const area = mr.area || Math.abs(FC.polygonArea(clean));
        const centroid = mr.centroid || FC.polygonCentroid(clean);
        unique.push({
          id: mr.id || FC.uid('room_manual'),
          name: mr.name || 'Custom Room',
          type: mr.type || 'living',
          polygon: clean,
          area,
          centroid,
          bounds: mr.bounds || FC.polygonBounds(clean),
          isManual: true,
        });
      });
    }

    // Filter out ignored rooms if user removed them
    const ignored = new Set(plan.ignoredRooms || []);
    const filtered = unique.filter((r) => !ignored.has(r.id));

    filtered.forEach((r, i) => {
      if (!r.id) {
        r.id = 'room_' + i + '_' + Math.round(r.centroid.x * 10) + '_' + Math.round(r.centroid.y * 10);
      }
      if (!r.bounds) {
        r.bounds = FC.polygonBounds(r.polygon);
      }
      if (!r.isManual) {
        r.type = null;
        r.name = '';
      }
    });

    assignRoomMeta(plan, filtered);
    return filtered.sort((a, b) => b.area - a.area);
  };

  function matchPreviousRoom(room, prev) {
    let best = null;
    let bestScore = Infinity;
    (prev || []).forEach((p) => {
      if (!p || !p.centroid || !p.type) return;
      const d = FC.dist(p.centroid, room.centroid);
      const ar = Math.abs((p.area || room.area) - room.area) / Math.max(1, room.area);
      const score = d + ar * 4;
      if (score < bestScore && d < 3.2 && ar < 0.8) {
        bestScore = score;
        best = p;
      }
    });
    return best;
  }

  function assignRoomMeta(plan, rooms) {
    if (!rooms.length) return;
    const attempted = new Set();
    rooms.forEach((r) => {
      const prev = matchPreviousRoom(r, plan.rooms);
      if (prev) {
        r.type = prev.type;
        r.name = prev.name || '';
        attempted.add(prev.id);
      }
    });

    const used = {};
    rooms.forEach((r) => {
      if (r.type) used[r.type] = (used[r.type] || 0) + 1;
    });

    const unassigned = rooms.filter((r) => !r.type).sort((a, b) => a.area - b.area);
    const smalls = unassigned.filter((r) => r.area < 8.8);

    if (rooms.length >= 4 && !used.hallway && smalls.length) {
      const hall = smalls.shift();
      if (hall) {
        hall.type = 'hallway';
        used.hallway = 1;
      }
    }
    if (!used.bathroom && smalls.length) {
      const bath = smalls.shift();
      if (bath) {
        bath.type = 'bathroom';
        used.bathroom = 1;
      }
    }

    const rest = rooms.filter((r) => !r.type).sort((a, b) => b.area - a.area);
    rest.forEach((r) => {
      if (!used.living) {
        r.type = 'living';
        used.living = 1;
      } else if (!used.bedroom) {
        r.type = 'bedroom';
        used.bedroom = 1;
      } else if (!used.bedroom2 && r.area > 8) {
        r.type = 'bedroom';
        used.bedroom2 = 1;
      } else if (!used.bedroom3 && r.area > 10 && rooms.length >= 6) {
        r.type = 'bedroom';
        used.bedroom3 = 1;
      } else if (!used.office && r.area > 7) {
        r.type = 'office';
        used.office = 1;
      } else if (!used.kitchen && r.area > 6) {
        r.type = 'kitchen';
        used.kitchen = 1;
      } else if (r.area <= 4.5) {
        r.type = 'closet';
      } else {
        r.type = 'storage';
      }
    });

    const counts = {};
    rooms.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    const idx = {};
    rooms.forEach((r) => {
      idx[r.type] = (idx[r.type] || 0) + 1;
      const type = FC.roomTypes[r.type] || FC.roomTypes.living;
      if (!r.name) {
        if (r.type === 'bedroom' && counts.bedroom > 1) r.name = 'Bedroom ' + idx.bedroom;
        else if (r.type === 'bathroom' && counts.bathroom > 1) r.name = 'Bathroom ' + idx.bathroom;
        else if (r.type === 'closet') r.name = r.area > 2.2 ? 'Walk-in Closet' : (counts.closet > 1 ? 'Closet ' + idx.closet : 'Closet');
        else if (r.type === 'storage' && counts.storage > 1) r.name = 'Storage ' + idx.storage;
        else r.name = type.label;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Dimensions / helpers                                               */
  /* ------------------------------------------------------------------ */

  FC.planArea = function (plan) {
    if (!plan.outline || plan.outline.length < 3) return 0;
    return Math.abs(FC.polygonArea(plan.outline));
  };

  FC.planBounds = function (plan) {
    if (plan.outline && plan.outline.length >= 3) return FC.polygonBounds(plan.outline);
    const pts = [];
    (plan.walls || []).forEach((w) => pts.push(w.a, w.b));
    if (pts.length) return FC.polygonBounds(pts);
    return { x0: 0, y0: 0, x1: 12, y1: 8, w: 12, d: 8, cx: 6, cy: 4 };
  };

  FC.defaultOpening = function (plan, kind, hostKey, offset) {
    const s = plan.settings;
    if (kind === 'window') {
      return {
        id: FC.uid('op'),
        kind: 'window',
        style: 'standard',
        hostKey,
        offset,
        width: Math.min(s.windowWidth, 3),
        height: Math.min(s.windowHeight, s.wallHeight - s.windowSill - 0.05),
        sill: s.windowSill,
      };
    }
    if (kind === 'opening') {
      return {
        id: FC.uid('op'),
        kind: 'opening',
        style: 'opening',
        hostKey,
        offset,
        width: Math.min(1.7, s.doorWidth + 0.7),
        height: Math.min(2.25, s.wallHeight - 0.2),
        sill: 0,
      };
    }
    return {
      id: FC.uid('op'),
      kind: 'door',
      style: 'single',
      hostKey,
      offset,
      width: Math.min(s.doorWidth, 1.4),
      height: Math.min(s.doorHeight, s.wallHeight - 0.05),
      sill: 0,
    };
  };

  /* ------------------------------------------------------------------ */
  /* Furniture recipes (2D data)                                        */
  /* ------------------------------------------------------------------ */

  const FURNITURE_HEIGHTS = {
    bed: 0.62,
    nightstand: 0.52,
    wardrobe: 2.15,
    sofa: 0.86,
    rug: 0.015,
    coffeeTable: 0.4,
    tvConsole: 0.48,
    tv: 0.72,
    plant: 1.25,
    diningTable: 0.75,
    chair: 0.88,
    counter: 0.92,
    upperCabinets: 0.7,
    island: 0.92,
    stool: 0.66,
    fridge: 1.95,
    toilet: 0.78,
    vanity: 0.86,
    shower: 2.05,
    bathtub: 0.58,
    desk: 0.76,
    bookshelf: 1.95,
    console: 0.82,
    boxes: 0.7,
    sideboard: 0.8,
    pendant: 0.45,
    bathMat: 0.015,
    floorLamp: 1.55,
    monitor: 0.45,
    shelf: 1.8,
    tableSmall: 0.52,
  };

  /* ------------------------------------------------------------------ */
  /* Furniture Placement & Collision Engine                             */
  /* ------------------------------------------------------------------ */

  FC.itemCorners = function (item, margin) {
    margin = margin || 0;
    const hw = item.w / 2 + margin;
    const hd = item.d / 2 + margin;
    const rot = item.rot || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return [
      { x: item.x - hw * cos + hd * sin, y: item.y - hw * sin - hd * cos },
      { x: item.x + hw * cos + hd * sin, y: item.y + hw * sin - hd * cos },
      { x: item.x + hw * cos - hd * sin, y: item.y + hw * sin + hd * cos },
      { x: item.x - hw * cos - hd * sin, y: item.y - hw * sin + hd * cos },
    ];
  };

  FC.itemInPolygon = function (item, polygon, margin) {
    if (!polygon || polygon.length < 3) return false;
    if (!FC.pointInPolygon({ x: item.x, y: item.y }, polygon)) return false;
    const corners = FC.itemCorners(item, margin || 0.02);
    for (let i = 0; i < 4; i++) {
      if (!FC.pointInPolygon(corners[i], polygon)) return false;
    }
    const n = polygon.length;
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      for (let j = 0; j < n; j++) {
        const p1 = polygon[j];
        const p2 = polygon[(j + 1) % n];
        if (FC.segmentIntersection(c1, c2, p1, p2)) return false;
      }
    }
    return true;
  };

  FC.polygonsIntersect = function (polyA, polyB) {
    const polys = [polyA, polyB];
    for (let p = 0; p < 2; p++) {
      const poly = polys[p];
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const nx = -(p2.y - p1.y);
        const ny = p2.x - p1.x;
        let minA = Infinity, maxA = -Infinity;
        for (let k = 0; k < polyA.length; k++) {
          const dot = polyA[k].x * nx + polyA[k].y * ny;
          if (dot < minA) minA = dot;
          if (dot > maxA) maxA = dot;
        }
        let minB = Infinity, maxB = -Infinity;
        for (let k = 0; k < polyB.length; k++) {
          const dot = polyB[k].x * nx + polyB[k].y * ny;
          if (dot < minB) minB = dot;
          if (dot > maxB) maxB = dot;
        }
        if (maxA <= minB + 1e-4 || maxB <= minA + 1e-4) return false;
      }
    }
    return true;
  };

  FC.isNonSolid = function (item) {
    return item.kind === 'rug' || item.kind === 'bathMat' || item.kind === 'pendant';
  };

  FC.itemsOverlap = function (itemA, itemB, margin) {
    if (FC.isNonSolid(itemA) || FC.isNonSolid(itemB)) return false;
    const elevA = itemA.elev || 0;
    const elevB = itemB.elev || 0;
    const hA = itemA.h || 0.6;
    const hB = itemB.h || 0.6;
    if (elevA + hA <= elevB + 0.05 || elevB + hB <= elevA + 0.05) return false;
    if ((itemA.kind === 'chair' && (itemB.kind === 'diningTable' || itemB.kind === 'desk')) ||
        (itemB.kind === 'chair' && (itemA.kind === 'diningTable' || itemA.kind === 'desk'))) {
      return false;
    }
    const cornersA = FC.itemCorners(itemA, margin || 0.02);
    const cornersB = FC.itemCorners(itemB, margin || 0.02);
    return FC.polygonsIntersect(cornersA, cornersB);
  };

  FC.itemBlocksDoor = function (item, doorZones) {
    if (FC.isNonSolid(item)) return false;
    const corners = FC.itemCorners(item, 0.02);
    for (let d = 0; d < doorZones.length; d++) {
      const dz = doorZones[d];
      if (Math.hypot(item.x - dz.x, item.y - dz.y) < dz.radius) return true;
      for (let i = 0; i < 4; i++) {
        if (Math.hypot(corners[i].x - dz.x, corners[i].y - dz.y) < dz.radius) return true;
      }
      for (let i = 0; i < 4; i++) {
        const c1 = corners[i];
        const c2 = corners[(i + 1) % 4];
        const h = FC.pointSegment({ x: dz.x, y: dz.y }, c1, c2);
        if (h.dist < dz.radius) return true;
      }
    }
    return false;
  };

  FC.itemIntersectsWall = function (item, wallSegments) {
    if (FC.isNonSolid(item)) return false;
    const corners = FC.itemCorners(item, 0.02);
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[(i + 1) % 4];
      for (let s = 0; s < wallSegments.length; s++) {
        const seg = wallSegments[s];
        if (FC.segmentIntersection(c1, c2, seg.a, seg.b)) return true;
      }
    }
    return false;
  };

  FC.findPrimaryZone = function (poly, bounds) {
    const b = bounds || FC.polygonBounds(poly);
    const area = Math.abs(FC.polygonArea(poly));
    const bArea = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (bArea > 0 && area / bArea > 0.88) {
      return b;
    }
    let best = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, area: 0, w: b.w, d: b.d, cx: b.cx, cy: b.cy };
    const step = Math.max(0.35, Math.min(b.w, b.d) / 10);
    const xs = [];
    const ys = [];
    for (let x = b.x0 + 0.15; x <= b.x1 - 0.15; x += step) xs.push(x);
    for (let y = b.y0 + 0.15; y <= b.y1 - 0.15; y += step) ys.push(y);
    const n = poly.length;

    for (let i = 0; i < xs.length; i++) {
      const x0 = xs[i];
      for (let j = 0; j < ys.length; j++) {
        const y0 = ys[j];
        if (!FC.pointInPolygon({ x: x0 + 0.08, y: y0 + 0.08 }, poly)) continue;
        for (let k = i + 1; k < xs.length; k++) {
          const x1 = xs[k];
          for (let l = j + 1; l < ys.length; l++) {
            const y1 = ys[l];
            const rArea = (x1 - x0) * (y1 - y0);
            if (rArea <= best.area) continue;

            const corners = [
              { x: x0, y: y0 }, { x: x1, y: y0 },
              { x: x1, y: y1 }, { x: x0, y: y1 },
              { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
            ];
            let ok = true;
            for (let p = 0; p < 5; p++) {
              if (!FC.pointInPolygon(corners[p], poly)) { ok = false; break; }
            }
            if (ok) {
              for (let c = 0; c < 4 && ok; c++) {
                const cA = corners[c];
                const cB = corners[(c + 1) % 4];
                for (let s = 0; s < n; s++) {
                  if (FC.segmentIntersection(cA, cB, poly[s], poly[(s + 1) % n])) {
                    ok = false;
                    break;
                  }
                }
              }
            }
            if (ok) {
              best = { x0, y0, x1, y1, area: rArea, w: x1 - x0, d: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
            }
          }
        }
      }
    }
    return best.area > 0 ? best : b;
  };

  FC.canPlaceFurniture = function (plan, room, item, placedItems, doorZones, wallSegments) {
    if (room && room.polygon && !FC.itemInPolygon(item, room.polygon, 0.02)) {
      return false;
    }
    if (doorZones && FC.itemBlocksDoor(item, doorZones)) {
      return false;
    }
    if (wallSegments && FC.itemIntersectsWall(item, wallSegments)) {
      return false;
    }
    if (placedItems) {
      for (let i = 0; i < placedItems.length; i++) {
        if (FC.itemsOverlap(item, placedItems[i])) return false;
      }
    }
    return true;
  };

  FC.furnishPlan = function (plan, rooms) {
    if (!plan.furnished) return [];
    const density = plan.density == null ? 1 : plan.density;
    const items = [];
    let count = 0;
    const globalVar = parseInt(plan.layoutVariation, 10) || 0;

    const wallSegments = FC.getSegments(plan);
    const doors = (plan.openings || []).filter((o) => o.kind === 'door');
    const doorZones = [];
    doors.forEach((d) => {
      const pl = FC.openingPlacement(plan, d, wallSegments);
      if (pl) {
        let r = 0.8;
        if (d.style === 'sliding' || d.style === 'bifold') {
          r = 0.65;
        } else {
          r = Math.min(0.85, Math.max(0.65, (pl.width || 0.8) * 0.85));
        }
        doorZones.push({ x: pl.x, y: pl.y, radius: r, door: d });
      }
    });

    function add(room, kind, x, y, w, d, rot, opts) {
      opts = opts || {};
      const item = {
        id: opts.id || (room.id ? room.id + '_' + kind + '_' + count++ : 'f' + count++),
        roomId: room.id,
        kind,
        x: FC.round(x, 3),
        y: FC.round(y, 3),
        w: FC.round(w, 3),
        d: FC.round(d, 3),
        rot: FC.round(rot || 0, 3),
        h: opts.h || FURNITURE_HEIGHTS[kind] || 0.6,
        elev: opts.elev || 0,
        mat: opts.mat || 'wood',
        variant: opts.variant || '',
        decor: !!opts.decor,
      };
      if (item.decor && density < 0.7) return null;

      // Primary check
      if (FC.canPlaceFurniture(plan, room, item, items, doorZones, wallSegments)) {
        items.push(item);
        return item;
      }

      // Try small positional nudges if allowed
      if (opts.canNudge !== false) {
        const deltas = [
          { dx: 0, dy: 0.2 }, { dx: 0, dy: -0.2 },
          { dx: 0.2, dy: 0 }, { dx: -0.2, dy: 0 },
          { dx: 0, dy: 0.4 }, { dx: 0, dy: -0.4 },
          { dx: 0.4, dy: 0 }, { dx: -0.4, dy: 0 }
        ];
        for (let i = 0; i < deltas.length; i++) {
          const testItem = Object.assign({}, item, {
            x: FC.round(x + deltas[i].dx, 3),
            y: FC.round(y + deltas[i].dy, 3)
          });
          if (FC.canPlaceFurniture(plan, room, testItem, items, doorZones, wallSegments)) {
            items.push(testItem);
            return testItem;
          }
        }
      }

      return null;
    }

    rooms.forEach((room, roomIdx) => {
      const zone = FC.findPrimaryZone(room.polygon, room.bounds);
      const pad = 0.16;
      const x0 = zone.x0 + pad;
      const y0 = zone.y0 + pad;
      const x1 = zone.x1 - pad;
      const y1 = zone.y1 - pad;
      const W = Math.max(0.6, x1 - x0);
      const D = Math.max(0.6, y1 - y0);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const type = room.type || 'living';
      const variant = (globalVar + (room.layoutVariant != null ? room.layoutVariant : roomIdx)) % 3;

      if (type === 'bedroom') {
        const bedW = clamp(W * 0.44, 1.3, 1.9);
        const bedD = clamp(D * 0.48, 1.85, 2.1);

        let placedBed = null;
        const orientations = variant === 0 ? [0, 1, 2] : (variant === 1 ? [1, 2, 0] : [2, 0, 1]);
        for (let o = 0; o < orientations.length && !placedBed; o++) {
          const ori = orientations[o];
          if (ori === 0) {
            const bedX = cx;
            const bedY = y0 + bedD / 2 + 0.1;
            placedBed = add(room, 'bed', bedX, bedY, bedW, bedD, 0, { mat: 'wood' });
            if (placedBed) {
              add(room, 'nightstand', placedBed.x - bedW / 2 - 0.28, y0 + 0.32, 0.44, 0.4, 0, { mat: 'wood' });
              add(room, 'nightstand', placedBed.x + bedW / 2 + 0.28, y0 + 0.32, 0.44, 0.4, 0, { mat: 'wood' });
              const wardrobeW = Math.min(2.0, W * 0.48);
              add(room, 'wardrobe', cx, y1 - 0.32, wardrobeW, 0.6, Math.PI, { mat: 'cabinet' });
              if (W > 3.0 && D > 3.0) add(room, 'rug', cx, Math.min(y1 - 0.8, y0 + bedD + 0.6), Math.min(2.4, W * 0.55), 0.95, 0, { mat: 'rug', decor: true });
            }
          } else if (ori === 1) {
            const bedX = x0 + bedD / 2 + 0.1;
            const bedY = cy;
            placedBed = add(room, 'bed', bedX, bedY, bedD, bedW, Math.PI / 2, { mat: 'wood' });
            if (placedBed) {
              add(room, 'nightstand', x0 + 0.3, bedY - bedW / 2 - 0.28, 0.4, 0.44, Math.PI / 2, { mat: 'wood' });
              add(room, 'nightstand', x0 + 0.3, bedY + bedW / 2 + 0.28, 0.4, 0.44, Math.PI / 2, { mat: 'wood' });
              const wardrobeW = Math.min(2.0, D * 0.48);
              add(room, 'wardrobe', x1 - 0.32, cy, 0.6, wardrobeW, -Math.PI / 2, { mat: 'cabinet' });
              add(room, 'rug', bedX + 0.7, bedY, 1.2, Math.min(2.2, D * 0.55), 0, { mat: 'rug', decor: true });
            }
          } else {
            const bedX = x1 - bedD / 2 - 0.1;
            const bedY = cy;
            placedBed = add(room, 'bed', bedX, bedY, bedD, bedW, -Math.PI / 2, { mat: 'wood' });
            if (placedBed) {
              add(room, 'nightstand', x1 - 0.3, bedY - bedW / 2 - 0.28, 0.4, 0.44, -Math.PI / 2, { mat: 'wood' });
              add(room, 'nightstand', x1 - 0.3, bedY + bedW / 2 + 0.28, 0.4, 0.44, -Math.PI / 2, { mat: 'wood' });
              add(room, 'wardrobe', x0 + 0.32, cy, 0.6, Math.min(2.0, D * 0.48), Math.PI / 2, { mat: 'cabinet' });
              add(room, 'rug', cx, cy, Math.min(2.0, W * 0.5), Math.min(1.6, D * 0.4), 0, { mat: 'rug', decor: true });
            }
          }
        }
      } else if (type === 'bathroom') {
        const sh = Math.min(0.95, Math.min(W * 0.48, D * 0.5));
        const s1 = add(room, 'shower', x0 + sh / 2 + 0.05, y0 + sh / 2 + 0.05, sh, sh, 0, { mat: 'stone' });
        if (!s1) add(room, 'shower', x1 - sh / 2 - 0.05, y0 + sh / 2 + 0.05, sh, sh, 0, { mat: 'stone' });
        add(room, 'vanity', cx, y1 - 0.28, Math.min(0.95, W * 0.52), 0.48, Math.PI, { mat: 'cabinet' });
        add(room, 'toilet', x1 - 0.3, cy, 0.42, 0.65, Math.PI / 2, { mat: 'stone' });
        add(room, 'bathMat', cx, cy, Math.min(0.8, W * 0.5), 0.5, 0, { mat: 'linen', decor: true });
      } else if (type === 'hallway') {
        const long = D > W;
        if (long) {
          add(room, 'rug', cx, cy, Math.min(0.85, W - 0.3), Math.min(2.0, D - 0.6), 0, { mat: 'rug' });
          add(room, 'console', x0 + 0.18, cy, Math.min(1.0, D * 0.5), 0.3, -Math.PI / 2, { mat: 'wood', decor: true });
        } else {
          add(room, 'rug', cx, cy, Math.min(2.0, W - 0.6), Math.min(0.85, D - 0.3), 0, { mat: 'rug' });
          add(room, 'console', cx, y1 - 0.18, Math.min(1.1, W * 0.5), 0.3, Math.PI, { mat: 'wood', decor: true });
        }
      } else if (type === 'kitchen') {
        add(room, 'counter', cx, y0 + 0.31, Math.max(1.0, W - 0.5), 0.6, 0, { mat: 'cabinet', variant: 'sink' });
        add(room, 'upperCabinets', cx, y0 + 0.19, Math.max(0.9, W - 1.0), 0.32, 0, { mat: 'cabinet', elev: 1.5, h: 0.7 });
        add(room, 'fridge', x0 + 0.4, y1 - 0.4, 0.72, 0.7, Math.PI, { mat: 'metal' });
        if (W > 3.6 && D > 2.8) {
          add(room, 'island', cx, cy, 1.4, 0.7, 0, { mat: 'cabinet' });
        }
      } else if (type === 'dining') {
        const tw = Math.min(1.8, W * 0.55);
        const td = Math.min(0.95, D * 0.45);
        const table = add(room, 'diningTable', cx, cy, tw, td, 0, { mat: 'wood' });
        if (table) {
          const chairDist = td / 2 + 0.4;
          add(room, 'chair', cx - tw / 4, cy - chairDist, 0.44, 0.44, 0, { mat: 'wood' });
          add(room, 'chair', cx + tw / 4, cy - chairDist, 0.44, 0.44, 0, { mat: 'wood' });
          add(room, 'chair', cx - tw / 4, cy + chairDist, 0.44, 0.44, Math.PI, { mat: 'wood' });
          add(room, 'chair', cx + tw / 4, cy + chairDist, 0.44, 0.44, Math.PI, { mat: 'wood' });
          add(room, 'pendant', cx, cy, 0.45, 0.45, 0, { mat: 'metal', elev: 2.05, h: 0.4, decor: true });
        }
      } else if (type === 'office') {
        const dw = Math.min(1.6, W * 0.6);
        add(room, 'desk', cx, y0 + 0.38, dw, 0.65, 0, { mat: 'wood' });
        add(room, 'monitor', cx, y0 + 0.22, 0.6, 0.12, 0, { mat: 'metal', elev: 0.78, h: 0.4 });
        add(room, 'chair', cx, y0 + 0.95, 0.48, 0.48, Math.PI, { mat: 'fabric' });
        add(room, 'bookshelf', x1 - 0.2, cy, Math.min(1.8, D * 0.5), 0.35, Math.PI / 2, { mat: 'wood' });
        add(room, 'rug', cx, cy + 0.3, Math.min(2.1, W * 0.6), Math.min(1.5, D * 0.4), 0, { mat: 'rug', decor: true });
      } else if (type === 'closet' || type === 'storage') {
        let shelfPlaced = add(room, 'shelf', cx, y0 + 0.22, Math.max(0.8, W - 0.4), 0.35, 0, { mat: 'wood' });
        if (!shelfPlaced) {
          shelfPlaced = add(room, 'shelf', cx, y1 - 0.22, Math.max(0.8, W - 0.4), 0.35, Math.PI, { mat: 'wood' });
        }
        if (!shelfPlaced) {
          shelfPlaced = add(room, 'shelf', x0 + 0.22, cy, 0.35, Math.max(0.8, D - 0.4), Math.PI / 2, { mat: 'wood' });
        }
        add(room, 'boxes', cx, cy, 0.45, 0.45, 0, { mat: 'wood', decor: true });
      } else {
        // Living room in primary zone
        const sofaW = clamp(W * 0.35, 1.8, 2.4);
        const sofaY = y1 - 0.65;
        if (variant === 0) {
          add(room, 'rug', cx, cy, Math.min(2.8, sofaW + 0.4), Math.min(2.0, D * 0.6), 0, { mat: 'rug' });
          add(room, 'sofa', cx, sofaY, sofaW, 0.9, Math.PI, { mat: 'fabric' });
          add(room, 'coffeeTable', cx, Math.max(y0 + 1.1, sofaY - 1.15), 1.0, 0.55, 0, { mat: 'wood' });
          add(room, 'tvConsole', cx, y0 + 0.28, Math.min(1.9, sofaW), 0.42, 0, { mat: 'wood' });
          add(room, 'tv', cx, y0 + 0.15, Math.min(1.3, sofaW * 0.7), 0.07, 0, { mat: 'screen', elev: 0.92, h: 0.78 });
        } else if (variant === 1) {
          add(room, 'rug', cx, cy, Math.min(3.0, sofaW + 0.6), Math.min(2.2, D * 0.65), 0, { mat: 'rug' });
          add(room, 'sofa', cx, sofaY, sofaW, 0.88, Math.PI, { mat: 'fabric' });
          add(room, 'coffeeTable', cx, cy, 1.05, 0.55, 0, { mat: 'wood' });
          add(room, 'chair', cx - sofaW * 0.35, cy - 0.75, 0.65, 0.65, 0, { mat: 'fabric' });
          add(room, 'chair', cx + sofaW * 0.35, cy - 0.75, 0.65, 0.65, 0, { mat: 'fabric' });
          add(room, 'tvConsole', cx, y0 + 0.28, Math.min(1.8, sofaW), 0.4, 0, { mat: 'wood' });
        } else {
          add(room, 'rug', cx, cy, Math.min(3.0, sofaW + 0.5), Math.min(2.2, D * 0.6), 0, { mat: 'rug' });
          add(room, 'sofa', cx, sofaY, sofaW, 0.9, Math.PI, { mat: 'fabric' });
          add(room, 'chair', cx - sofaW / 2 + 0.3, cy + 0.1, 0.7, 0.7, -Math.PI / 2, { mat: 'fabric' });
          add(room, 'coffeeTable', cx + 0.2, cy, 0.95, 0.55, 0, { mat: 'wood' });
          add(room, 'tvConsole', cx, y0 + 0.26, Math.min(1.9, sofaW), 0.42, 0, { mat: 'wood' });
        }
      }
    });

    return items.filter((i) => !i.decor || density >= 0.7);
  };

  FC.furnitureCount = function (items) {
    return (items || []).filter((i) => i.kind !== 'rug' && i.kind !== 'bathMat' && i.kind !== 'pendant').length;
  };

  FC.openingLabel = function (op) {
    if (op.kind === 'window') return 'Window';
    if (op.kind === 'opening') return 'Open passage';
    if (op.style === 'double') return 'Double door';
    if (op.style === 'sliding') return 'Sliding door';
    if (op.style === 'bifold') return 'Bifold door';
    return 'Door';
  };

  /* ------------------------------------------------------------------ */
  /* Scaling and CAD consolidation                                       */
  /* ------------------------------------------------------------------ */

  FC.scalePlan = function (plan, factor) {
    if (!plan || !factor || factor === 1 || !isFinite(factor) || factor <= 0) return plan;
    if (plan.outline) {
      plan.outline.forEach((p) => {
        p.x = FC.round(p.x * factor, 4);
        p.y = FC.round(p.y * factor, 4);
      });
    }
    if (plan.walls) {
      plan.walls.forEach((w) => {
        w.a.x = FC.round(w.a.x * factor, 4);
        w.a.y = FC.round(w.a.y * factor, 4);
        w.b.x = FC.round(w.b.x * factor, 4);
        w.b.y = FC.round(w.b.y * factor, 4);
      });
    }
    if (plan.openings) {
      plan.openings.forEach((op) => {
        op.offset = FC.round(op.offset * factor, 4);
        op.width = FC.round(op.width * factor, 4);
      });
    }
    if (plan.lights) {
      plan.lights.forEach((l) => {
        l.x = FC.round(l.x * factor, 4);
        l.y = FC.round(l.y * factor, 4);
        if (l.range) l.range = FC.round(l.range * factor, 2);
      });
    }
    if (plan.furnitureOverrides) {
      Object.keys(plan.furnitureOverrides).forEach((k) => {
        const f = plan.furnitureOverrides[k];
        if (f && f.x != null) f.x = FC.round(f.x * factor, 4);
        if (f && f.y != null) f.y = FC.round(f.y * factor, 4);
      });
    }
    return plan;
  };

  FC.findParallelWall = function (plan, wallId, maxDist) {
    maxDist = maxDist || 0.65;
    const walls = plan.walls || [];
    const w1 = walls.find((w) => w.id === wallId);
    if (!w1) return null;

    const dx1 = w1.b.x - w1.a.x;
    const dy1 = w1.b.y - w1.a.y;
    const len1 = Math.hypot(dx1, dy1);
    if (len1 < 1e-4) return null;
    const angle1 = Math.atan2(dy1, dx1);

    let best = null;
    let minPerp = Infinity;

    walls.forEach((w2) => {
      if (w2.id === wallId) return;
      const dx2 = w2.b.x - w2.a.x;
      const dy2 = w2.b.y - w2.a.y;
      const len2 = Math.hypot(dx2, dy2);
      if (len2 < 1e-4) return;
      const angle2 = Math.atan2(dy2, dx2);

      let diff = Math.abs(angle1 - angle2);
      while (diff > Math.PI) diff -= Math.PI;
      if (diff > Math.PI / 2) diff = Math.PI - diff;

      // Must be roughly parallel within ~8.5 degrees
      if (diff > 0.15) return;

      const mid2 = { x: (w2.a.x + w2.b.x) / 2, y: (w2.a.y + w2.b.y) / 2 };
      const perpDist = Math.abs((mid2.x - w1.a.x) * dy1 - (mid2.y - w1.a.y) * dx1) / len1;

      if (perpDist < 0.02 || perpDist > maxDist) return;

      const tA = ((w2.a.x - w1.a.x) * dx1 + (w2.a.y - w1.a.y) * dy1) / (len1 * len1);
      const tB = ((w2.b.x - w1.a.x) * dx1 + (w2.b.y - w1.a.y) * dy1) / (len1 * len1);
      const minT = Math.min(tA, tB);
      const maxT = Math.max(tA, tB);

      if (maxT > -0.2 && minT < 1.2) {
        if (perpDist < minPerp) {
          minPerp = perpDist;
          best = {
            wall: w2,
            dist: perpDist,
            thicknessCm: Math.round(perpDist * 100),
          };
        }
      }
    });

    return best;
  };

  FC.mergeParallelWalls = function (plan, wallId1, wallId2) {
    const walls = plan.walls || [];
    const idx1 = walls.findIndex((w) => w.id === wallId1);
    const idx2 = walls.findIndex((w) => w.id === wallId2);
    if (idx1 < 0 || idx2 < 0 || idx1 === idx2) return null;

    const w1 = walls[idx1];
    const w2 = walls[idx2];

    const dx1 = w1.b.x - w1.a.x;
    const dy1 = w1.b.y - w1.a.y;
    const len1 = Math.hypot(dx1, dy1);
    if (len1 < 1e-4) return null;
    const ux = dx1 / len1;
    const uy = dy1 / len1;
    const nx = -uy;
    const ny = ux;

    const offset = (w2.a.x - w1.a.x) * nx + (w2.a.y - w1.a.y) * ny;
    const halfOffset = offset / 2;
    const p0 = { x: w1.a.x + nx * halfOffset, y: w1.a.y + ny * halfOffset };

    const proj = (p) => (p.x - p0.x) * ux + (p.y - p0.y) * uy;
    const tMin = Math.min(proj(w1.a), proj(w1.b), proj(w2.a), proj(w2.b));
    const tMax = Math.max(proj(w1.a), proj(w1.b), proj(w2.a), proj(w2.b));

    const thickness = Math.abs(offset);

    w1.a = { x: FC.round(p0.x + ux * tMin, 3), y: FC.round(p0.y + uy * tMin, 3) };
    w1.b = { x: FC.round(p0.x + ux * tMax, 3), y: FC.round(p0.y + uy * tMax, 3) };

    walls.splice(idx2, 1);

    (plan.openings || []).forEach((op) => {
      if (op.hostKey === 'w:' + w2.id) {
        op.hostKey = 'w:' + w1.id;
      }
    });

    if (thickness >= 0.05 && thickness <= 0.45 && plan.settings) {
      plan.settings.intThickness = FC.round(thickness, 2);
    }

    return { mergedWall: w1, thickness, removedWallId: w2.id };
  };

  FC.consolidateAllDoubleWalls = function (plan, maxDist) {
    maxDist = maxDist || 0.45;
    let count = 0;
    let changed = true;
    while (changed) {
      changed = false;
      const walls = plan.walls || [];
      for (let i = 0; i < walls.length; i++) {
        const candidate = FC.findParallelWall(plan, walls[i].id, maxDist);
        if (candidate) {
          FC.mergeParallelWalls(plan, walls[i].id, candidate.wall.id);
          count++;
          changed = true;
          break;
        }
      }
    }
    if (count > 0 && FC.healWallJunctions) {
      FC.healWallJunctions(plan);
    }
    return count;
  };
})();

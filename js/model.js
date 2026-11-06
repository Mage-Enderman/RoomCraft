/* Floorcraft — plan model, geometry, room detection and furnishing recipes. */
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
  };

  FC.roomTypes = {
    living: { label: 'Living room', color: '#d9c3a1', ink: '#8b6f47', icon: 'sofa' },
    bedroom: { label: 'Bedroom', color: '#cdb9a3', ink: '#82674f', icon: 'bed' },
    kitchen: { label: 'Kitchen', color: '#c8c1b3', ink: '#6f6a5d', icon: 'wall' },
    dining: { label: 'Dining room', color: '#d6c3a9', ink: '#836c4d', icon: 'layout' },
    bathroom: { label: 'Bathroom', color: '#b7c5ca', ink: '#5b747c', icon: 'window' },
    hallway: { label: 'Hallway', color: '#cbc5bb', ink: '#736e65', icon: 'door' },
    office: { label: 'Office', color: '#c6c0b1', ink: '#6b6658', icon: 'file' },
    balcony: { label: 'Balcony', color: '#b9c2ac', ink: '#5e6f53', icon: 'sun' },
    storage: { label: 'Storage', color: '#c4beb4', ink: '#6e6960', icon: 'layers' },
  };

  FC.roomTypeOrder = ['living', 'bedroom', 'kitchen', 'dining', 'bathroom', 'hallway', 'office', 'balcony', 'storage'];

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
  };
  FC.styleOrder = ['scandinavian', 'japandi', 'warmmodern', 'urbanloft'];

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
      settings: Object.assign({}, FC.defaultSettings),
      style: 'scandinavian',
      density: 1,
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
      if (!seg || op.offset < 0 || op.offset > seg.len) {
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
      if (op.offset < 0.05 || op.offset > seg.len - 0.05) {
        let px;
        let py;
        const old = FC.openingPlacement(plan, op, segs);
        if (old) {
          px = old.x;
          py = old.y;
          const near = FC.nearestWall(plan, { x: px, y: py }, 0.9);
          if (near) {
            op.hostKey = near.seg.key;
            op.offset = near.offset;
          }
        }
      }
      return true;
    });
    return removed;
  };

  /* ------------------------------------------------------------------ */
  /* Room detection (planar face walk)                                  */
  /* ------------------------------------------------------------------ */

  function buildHalfEdgeGraph(plan) {
    const base = FC.getSegments(plan).filter((s) => s.len > 0.15);
    const cuts = base.map(() => [0, 1]);

    for (let i = 0; i < base.length; i++) {
      for (let j = i + 1; j < base.length; j++) {
        const hit = FC.segmentIntersection(base[i].a, base[i].b, base[j].a, base[j].b);
        if (!hit) continue;
        if (hit.t > 1e-5 && hit.t < 1 - 1e-5) cuts[i].push(hit.t);
        if (hit.u > 1e-5 && hit.u < 1 - 1e-5) cuts[j].push(hit.u);
      }
    }

    const nodes = new Map();
    const adjacency = new Map();
    const keyFor = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000);

    function addNode(x, y) {
      const k = keyFor(x, y);
      if (!nodes.has(k)) nodes.set(k, { key: k, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
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
      const list = cuts[idx].slice().sort((a, b) => a - b);
      for (let k = 0; k < list.length - 1; k++) {
        const t0 = list[k];
        const t1 = list[k + 1];
        if ((t1 - t0) * seg.len < 0.01) continue;
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
          if (area > 0.6) {
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

    // Deduplicate identical / near-identical faces (can occur with dangling walls).
    const unique = [];
    faces.sort((a, b) => b.area - a.area);
    for (const f of faces) {
      const dup = unique.find((u) => Math.abs(u.area - f.area) < 0.05 && FC.dist(u.centroid, f.centroid) < 0.15);
      if (!dup) unique.push(f);
    }

    unique.forEach((r, i) => {
      r.id = 'room_' + i + '_' + Math.round(r.centroid.x * 10) + '_' + Math.round(r.centroid.y * 10);
      r.bounds = FC.polygonBounds(r.polygon);
      r.type = null;
      r.name = '';
    });

    assignRoomMeta(plan, unique);
    return unique.sort((a, b) => b.area - a.area);
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
      } else if (!used.office && r.area > 7) {
        r.type = 'office';
        used.office = 1;
      } else if (!used.kitchen && r.area > 6) {
        r.type = 'kitchen';
        used.kitchen = 1;
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

  FC.furnishPlan = function (plan, rooms) {
    if (!plan.furnished) return [];
    const style = FC.styles[plan.style] || FC.styles.scandinavian;
    const density = plan.density == null ? 1 : plan.density;
    const items = [];
    let count = 0;

    function add(room, kind, x, y, w, d, rot, opts) {
      opts = opts || {};
      const item = {
        id: 'f' + count++,
        roomId: room.id,
        kind,
        x,
        y,
        w,
        d,
        rot: rot || 0,
        h: opts.h || FURNITURE_HEIGHTS[kind] || 0.6,
        elev: opts.elev || 0,
        mat: opts.mat || 'wood',
        variant: opts.variant || '',
        decor: !!opts.decor,
      };
      if (item.decor && density < 0.7) return item;
      items.push(item);
      return item;
    }

    rooms.forEach((room) => {
      const b = room.bounds || FC.polygonBounds(room.polygon);
      const pad = 0.12;
      const x0 = b.x0 + pad;
      const y0 = b.y0 + pad;
      const x1 = b.x1 - pad;
      const y1 = b.y1 - pad;
      const W = Math.max(0.6, x1 - x0);
      const D = Math.max(0.6, y1 - y0);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const type = room.type || 'living';

      if (type === 'bedroom') {
        const bedW = clamp(W * 0.44, 1.25, 1.9);
        const bedD = clamp(D * 0.48, 1.85, 2.1);
        const bedX = x0 + Math.min(W - bedW / 2 - 0.15, W * 0.44);
        const bedY = y0 + bedD / 2 + 0.1;
        add(room, 'bed', bedX, bedY, bedW, bedD, 0, { mat: 'wood' });
        add(room, 'nightstand', bedX - bedW / 2 - 0.28, y0 + 0.32, 0.44, 0.4, 0, { mat: 'wood' });
        if (bedX + bedW / 2 + 0.5 < x1) add(room, 'nightstand', bedX + bedW / 2 + 0.28, y0 + 0.32, 0.44, 0.4, 0, { mat: 'wood' });
        const wardrobeW = Math.min(2.1, W * 0.5);
        add(room, 'wardrobe', x0 + wardrobeW / 2 + 0.05, y1 - 0.32, wardrobeW, 0.62, Math.PI, { mat: 'cabinet' });
        if (W > 3.4 && D > 3.4) add(room, 'rug', bedX, Math.min(y1 - 0.8, y0 + bedD + 0.75), Math.min(2.4, W * 0.6), 0.9, 0, { mat: 'rug', decor: true });
        if (density > 1.05) add(room, 'plant', x1 - 0.32, y1 - 0.32, 0.5, 0.5, 0, { mat: 'plant', decor: true });
      } else if (type === 'bathroom') {
        const sh = Math.min(0.98, Math.min(W * 0.48, D * 0.5));
        add(room, 'shower', x0 + sh / 2 + 0.05, y0 + sh / 2 + 0.05, sh, sh, 0, { mat: 'stone' });
        add(room, 'vanity', x0 + Math.min(0.95, W * 0.52) / 2 + 0.06, y1 - 0.3, Math.min(0.95, W * 0.52), 0.5, Math.PI, { mat: 'cabinet' });
        add(room, 'toilet', x1 - 0.32, y0 + 0.62, 0.42, 0.66, Math.PI / 2, { mat: 'stone' });
        add(room, 'bathMat', cx, cy + 0.25, Math.min(0.8, W * 0.5), 0.55, 0, { mat: 'linen', decor: true });
      } else if (type === 'hallway') {
        const long = D > W;
        if (long) {
          add(room, 'rug', cx, cy, Math.min(0.85, W - 0.3), Math.min(2.1, D - 0.5), 0, { mat: 'rug' });
          add(room, 'console', x0 + 0.18, cy, Math.min(1.0, D * 0.55), 0.32, -Math.PI / 2, { mat: 'wood', decor: true });
        } else {
          add(room, 'rug', cx, cy, Math.min(2.0, W - 0.5), Math.min(0.85, D - 0.25), 0, { mat: 'rug' });
          add(room, 'console', x0 + 0.5, y1 - 0.2, Math.min(1.1, W * 0.5), 0.32, Math.PI, { mat: 'wood', decor: true });
        }
        if (density > 1.15) add(room, 'plant', x1 - 0.32, y1 - 0.32, 0.45, 0.45, 0, { mat: 'plant', decor: true });
      } else if (type === 'kitchen') {
        add(room, 'counter', cx, y0 + 0.31, Math.max(1.0, W - 0.55), 0.62, 0, { mat: 'cabinet', variant: 'sink' });
        add(room, 'upperCabinets', cx, y0 + 0.19, Math.max(0.9, W - 1.2), 0.34, 0, { mat: 'cabinet', elev: 1.5, h: 0.7 });
        const sideLen = Math.min(D - 1.0, 2.6);
        if (sideLen > 1.0) {
          add(room, 'counter', x1 - 0.31, y0 + 0.7 + sideLen / 2, sideLen, 0.62, Math.PI / 2, { mat: 'cabinet', variant: 'stove' });
        }
        add(room, 'fridge', x0 + 0.4, y1 - 0.42, 0.74, 0.72, Math.PI, { mat: 'metal' });
        if (W > 4.6 && D > 3) {
          add(room, 'island', cx, cy + 0.2, 1.5, 0.7, 0, { mat: 'cabinet' });
          add(room, 'stool', cx - 0.4, cy + 0.78, 0.38, 0.38, 0, { mat: 'wood' });
          add(room, 'stool', cx + 0.4, cy + 0.78, 0.38, 0.38, 0, { mat: 'wood' });
        }
      } else if (type === 'dining') {
        const tw = Math.min(1.8, W * 0.55);
        const td = Math.min(0.95, D * 0.45);
        add(room, 'diningTable', cx, cy, tw, td, 0, { mat: 'wood' });
        const chairDist = td / 2 + 0.42;
        add(room, 'chair', cx - tw / 4, cy - chairDist, 0.46, 0.46, 0, { mat: 'wood' });
        add(room, 'chair', cx + tw / 4, cy - chairDist, 0.46, 0.46, 0, { mat: 'wood' });
        add(room, 'chair', cx - tw / 4, cy + chairDist, 0.46, 0.46, Math.PI, { mat: 'wood' });
        add(room, 'chair', cx + tw / 4, cy + chairDist, 0.46, 0.46, Math.PI, { mat: 'wood' });
        add(room, 'pendant', cx, cy, 0.5, 0.5, 0, { mat: 'metal', elev: 2.05, h: 0.4, decor: true });
        if (W > 3.6) add(room, 'sideboard', cx, y0 + 0.25, Math.min(1.8, W * 0.55), 0.42, 0, { mat: 'wood', decor: true });
      } else if (type === 'office') {
        const dw = Math.min(1.9, W * 0.6);
        add(room, 'desk', cx, y0 + 0.38, dw, 0.66, 0, { mat: 'wood' });
        add(room, 'monitor', cx, y0 + 0.22, 0.62, 0.12, 0, { mat: 'metal', elev: 0.78, h: 0.4 });
        add(room, 'chair', cx, y0 + 1.05, 0.5, 0.5, Math.PI, { mat: 'fabric' });
        add(room, 'bookshelf', x1 - 0.2, cy, Math.min(1.9, D * 0.55), 0.36, Math.PI / 2, { mat: 'wood' });
        add(room, 'rug', cx, cy + 0.35, Math.min(2.3, W * 0.65), Math.min(1.6, D * 0.4), 0, { mat: 'rug', decor: true });
      } else if (type === 'balcony') {
        add(room, 'chair', cx - W * 0.18, cy - 0.15, 0.62, 0.62, -0.35, { mat: 'fabric' });
        add(room, 'chair', cx + W * 0.18, cy - 0.15, 0.62, 0.62, 0.35, { mat: 'fabric' });
        add(room, 'tableSmall', cx, cy + 0.5, 0.55, 0.55, 0, { mat: 'wood' });
        add(room, 'plant', x0 + 0.32, y1 - 0.32, 0.5, 0.5, 0, { mat: 'plant' });
        add(room, 'plant', x1 - 0.32, y1 - 0.32, 0.55, 0.55, 0, { mat: 'plant', decor: true });
      } else if (type === 'storage') {
        add(room, 'shelf', cx, y0 + 0.22, Math.max(1.0, W - 0.5), 0.4, 0, { mat: 'metal' });
        add(room, 'boxes', x0 + 0.5, y1 - 0.45, 0.55, 0.55, 0, { mat: 'wood', decor: true });
        add(room, 'boxes', x0 + 1.15, y1 - 0.4, 0.45, 0.45, 0.2, { mat: 'wood', decor: true });
      } else {
        // Living room. Wide rooms include a kitchenette and dining zone.
        const wide = W > 7.2 && D > 3.0;
        if (wide) {
          const counterLen = Math.min(D - 1.1, 2.5);
          add(room, 'counter', x0 + 0.32, cy, counterLen, 0.62, -Math.PI / 2, { mat: 'cabinet', variant: 'sink' });
          add(room, 'upperCabinets', x0 + 0.19, cy, Math.max(1.0, counterLen - 0.4), 0.34, -Math.PI / 2, { mat: 'cabinet', elev: 1.5, h: 0.7 });
          add(room, 'island', x0 + 1.5, cy, 1.15, 0.66, 0, { mat: 'cabinet', variant: 'stove' });
          add(room, 'stool', x0 + 2.1, cy - 0.38, 0.36, 0.36, 0, { mat: 'wood' });
          add(room, 'stool', x0 + 2.1, cy + 0.38, 0.36, 0.36, 0, { mat: 'wood' });
          const tableX = x0 + 3.55;
          if (tableX + 0.9 < x1 - 2.2) {
            add(room, 'diningTable', tableX, cy, 1.38, 0.86, 0, { mat: 'wood' });
            add(room, 'chair', tableX - 0.36, cy - 0.74, 0.44, 0.44, 0, { mat: 'wood' });
            add(room, 'chair', tableX + 0.36, cy - 0.74, 0.44, 0.44, 0, { mat: 'wood' });
            add(room, 'chair', tableX - 0.36, cy + 0.74, 0.44, 0.44, Math.PI, { mat: 'wood' });
            add(room, 'chair', tableX + 0.36, cy + 0.74, 0.44, 0.44, Math.PI, { mat: 'wood' });
            add(room, 'pendant', tableX, cy, 0.42, 0.42, 0, { mat: 'metal', elev: 2.05, h: 0.38, decor: true });
          }
        } else if (W > 4.4) {
          add(room, 'diningTable', x0 + 1.15, cy, 1.4, 0.85, 0, { mat: 'wood' });
          add(room, 'chair', x0 + 0.8, cy - 0.72, 0.44, 0.44, 0, { mat: 'wood' });
          add(room, 'chair', x0 + 1.5, cy + 0.72, 0.44, 0.44, Math.PI, { mat: 'wood' });
        }

        const loungeCx = wide ? x1 - 1.45 : cx + (W > 4.4 ? 1.2 : 0);
        const sofaW = clamp(W * 0.26, 1.75, 2.5);
        const sofaY = y1 - 0.68;
        add(room, 'rug', loungeCx, Math.max(y0 + 1.2, y1 - 1.7), Math.min(3.0, sofaW + 0.6), Math.min(2.0, D - 0.9), 0, { mat: 'rug' });
        add(room, 'sofa', loungeCx, sofaY, sofaW, 0.92, Math.PI, { mat: 'fabric' });
        add(room, 'coffeeTable', loungeCx, Math.max(y0 + 1.15, sofaY - 1.28), 1.05, 0.56, 0, { mat: 'wood' });
        add(room, 'tvConsole', loungeCx, y0 + 0.27, Math.min(1.9, sofaW), 0.44, 0, { mat: 'wood' });
        add(room, 'tv', loungeCx, y0 + 0.12, Math.min(1.35, sofaW * 0.7), 0.07, 0, { mat: 'screen', elev: 0.92, h: 0.78 });
        add(room, 'plant', x0 + 0.3, y1 - 0.3, 0.5, 0.5, 0, { mat: 'plant', decor: true });
        if (density > 1.1) add(room, 'floorLamp', x1 - 0.28, sofaY - 0.35, 0.4, 0.4, 0, { mat: 'metal', decor: true });
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
    return 'Door';
  };
})();

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
    units: 'm',
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

  /* ------------------------------------------------------------------ */
  /* Metric (m) and Imperial (ft / in) unit helpers                     */
  /* ------------------------------------------------------------------ */

  FC.METERS_TO_FEET = 3.280839895;
  FC.FEET_TO_METERS = 0.3048;
  FC.INCHES_TO_METERS = 0.0254;
  FC.SQM_TO_SQFT = 10.7639104;

  FC.isImperial = function (planOrUnits) {
    if (!planOrUnits) return false;
    if (typeof planOrUnits === 'string') return planOrUnits === 'ft' || planOrUnits === 'imperial';
    if (planOrUnits.settings && planOrUnits.settings.units) {
      return planOrUnits.settings.units === 'ft' || planOrUnits.settings.units === 'imperial';
    }
    if (planOrUnits.units) return planOrUnits.units === 'ft' || planOrUnits.units === 'imperial';
    return false;
  };

  FC.formatLength = function (meters, planOrUnits, decimals = 2) {
    const val = Number(meters) || 0;
    if (FC.isImperial(planOrUnits)) {
      const sign = val < 0 ? '-' : '';
      const totalInches = Math.abs(val) / FC.INCHES_TO_METERS;
      let feet = Math.floor(totalInches / 12 + 1e-6);
      let remInches = totalInches - feet * 12;
      // Round to nearest 0.5 inch if decimals >= 2, else nearest 1 inch
      const step = decimals >= 2 ? 0.5 : 1;
      remInches = Math.round(remInches / step) * step;
      if (remInches >= 12 - 1e-6) {
        feet += 1;
        remInches = 0;
      }
      const inStr = remInches % 1 === 0 ? String(Math.round(remInches)) : remInches.toFixed(1);
      if (feet === 0 && remInches > 0) return `${sign}${inStr}"`;
      if (remInches === 0) return `${sign}${feet}' 0"`;
      return `${sign}${feet}' ${inStr}"`;
    }
    return FC.fmt(val, decimals) + ' m';
  };

  FC.formatLengthShort = function (meters, planOrUnits, decimals = 2) {
    const val = Number(meters) || 0;
    if (FC.isImperial(planOrUnits)) {
      return FC.formatLength(val, 'ft', decimals);
    }
    return FC.fmt(val, decimals);
  };

  FC.formatArea = function (sqMeters, planOrUnits, decimals = 1) {
    const val = Number(sqMeters) || 0;
    if (FC.isImperial(planOrUnits)) {
      const sqft = val * FC.SQM_TO_SQFT;
      return (sqft >= 10 ? Math.round(sqft) : sqft.toFixed(1)) + ' sq ft';
    }
    return FC.fmt(val, decimals) + ' m²';
  };

  FC.formatAreaValue = function (sqMeters, planOrUnits) {
    const val = Number(sqMeters) || 0;
    if (FC.isImperial(planOrUnits)) {
      const sqft = val * FC.SQM_TO_SQFT;
      return sqft >= 10 ? String(Math.round(sqft)) : sqft.toFixed(1);
    }
    return val.toFixed(1);
  };

  FC.areaUnitLabel = function (planOrUnits) {
    return FC.isImperial(planOrUnits) ? 'sq ft' : 'm²';
  };

  FC.lengthUnitLabel = function (planOrUnits) {
    return FC.isImperial(planOrUnits) ? 'ft' : 'm';
  };

  FC.formatThickness = function (meters, planOrUnits) {
    const val = Number(meters) || 0;
    if (FC.isImperial(planOrUnits)) {
      const inches = val / FC.INCHES_TO_METERS;
      return (Math.round(inches * 10) / 10) + ' in';
    }
    return Math.round(val * 100) + ' cm';
  };

  FC.formatInputLength = function (meters, planOrUnits, opts) {
    const val = Number(meters) || 0;
    if (FC.isImperial(planOrUnits)) {
      if (opts && opts.thickness) {
        const inches = val / FC.INCHES_TO_METERS;
        return String(Math.round(inches * 10) / 10);
      }
      return FC.formatLength(val, 'ft', 2);
    }
    return FC.fmt(val, 2);
  };

  FC.inputUnitLabel = function (planOrUnits, opts) {
    if (FC.isImperial(planOrUnits)) {
      return opts && opts.thickness ? 'in' : 'ft/in';
    }
    return 'm';
  };

  function parseInchesPart(str) {
    if (str == null) return 0;
    const s = String(str).trim();
    if (!s) return 0;
    // Mixed fraction e.g. "6 1/2" or "6-1/2"
    const mixed = s.match(/^(-?\d+)\s*(?:\s+|-)\s*(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
      const whole = parseFloat(mixed[1]) || 0;
      const num = parseFloat(mixed[2]) || 0;
      const den = parseFloat(mixed[3]) || 1;
      const frac = den !== 0 ? num / den : 0;
      return whole < 0 ? whole - frac : whole + frac;
    }
    // Simple fraction e.g. "1/2"
    const fracMatch = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (fracMatch) {
      const num = parseFloat(fracMatch[1]) || 0;
      const den = parseFloat(fracMatch[2]) || 1;
      return den !== 0 ? num / den : 0;
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  FC.parseLengthInput = function (rawStr, planOrUnits, opts) {
    if (rawStr == null) return NaN;
    let s = String(rawStr)
      .trim()
      .replace(/[’‘′]/g, "'")
      .replace(/[“”″]/g, '"')
      .replace(/''/g, '"');
    if (!s) return NaN;

    // Explicit feet and inches e.g. 12' 6", 12'6, 12' 6.5", 12' 6 1/2", 12ft 6in, 12 ft 6.5 in
    const ftInMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:[- ]?\s*(\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|in|inch|inches)?)?$/i);
    if (ftInMatch) {
      const ft = parseFloat(ftInMatch[1]) || 0;
      const inc = ftInMatch[2] != null ? parseInchesPart(ftInMatch[2]) || 0 : 0;
      return ft * FC.FEET_TO_METERS + (ft < 0 ? -inc : inc) * FC.INCHES_TO_METERS;
    }

    // Explicit inches only e.g. 36", 36in, 36.5", 36 1/2", 1/2"
    const inOnlyMatch = s.match(/^(-?\d+(?:\.\d+)?(?:\s+\d+\s*\/\s*\d+)?|-?\d+\s*\/\s*\d+)\s*(?:"|in|inch|inches)$/i);
    if (inOnlyMatch) {
      const inc = parseInchesPart(inOnlyMatch[1]);
      return isFinite(inc) ? inc * FC.INCHES_TO_METERS : NaN;
    }

    // Explicit feet only e.g. 12ft
    const ftOnlyMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|feet)$/i);
    if (ftOnlyMatch) {
      return (parseFloat(ftOnlyMatch[1]) || 0) * FC.FEET_TO_METERS;
    }

    // Explicit cm or mm or m
    const cmMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*cm$/i);
    if (cmMatch) return (parseFloat(cmMatch[1]) || 0) * 0.01;
    const mmMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*mm$/i);
    if (mmMatch) return (parseFloat(mmMatch[1]) || 0) * 0.001;
    const mMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*m$/i);
    if (mMatch) return parseFloat(mMatch[1]) || 0;

    // Hyphenated or space-separated feet-inches in imperial mode e.g. 3-6 or 3 6 -> 3' 6"
    if (FC.isImperial(planOrUnits)) {
      const dashOrSpaceMatch = s.match(/^(\d+)\s*(?:-|\s+)\s*(\d+(?:\.\d+)?)$/);
      if (dashOrSpaceMatch) {
        const ft = parseFloat(dashOrSpaceMatch[1]) || 0;
        const inc = parseFloat(dashOrSpaceMatch[2]) || 0;
        return ft * FC.FEET_TO_METERS + inc * FC.INCHES_TO_METERS;
      }
      const fracOnly = s.match(/^(-?\d+(?:\s+\d+)?\s*\/\s*\d+)$/);
      if (fracOnly) {
        const v = parseInchesPart(fracOnly[1]);
        if (isFinite(v)) {
          return opts && opts.unit === 'in' ? v * FC.INCHES_TO_METERS : v * FC.FEET_TO_METERS;
        }
      }
    }

    if (!/^-?\d+(?:\.\d+)?$/.test(s)) return NaN;
    const num = parseFloat(s);
    if (!isFinite(num)) return NaN;
    if (FC.isImperial(planOrUnits)) {
      if (opts && opts.unit === 'in') return num * FC.INCHES_TO_METERS;
      return num * FC.FEET_TO_METERS;
    }
    return num;
  };

  FC.parseBoxInput = function (rawStr, planOrUnits) {
    if (!rawStr) return null;
    const parts = String(rawStr).trim().split(/\s*[xX×,]\s*/);
    if (parts.length !== 2) return null;
    const w = FC.parseLengthInput(parts[0], planOrUnits);
    const d = FC.parseLengthInput(parts[1], planOrUnits);
    if (!isFinite(w) || !isFinite(d) || w <= 0.1 || d <= 0.1) return null;
    return { w: FC.round(w, 3), d: FC.round(d, 3) };
  };

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

  FC.lineLineIntersection = function (a, b, c, d) {
    const r = FC.sub(b, a);
    const s = FC.sub(d, c);
    const den = FC.cross(r, s);
    if (Math.abs(den) < 1e-9) return null;
    const qp = FC.sub(c, a);
    const t = FC.cross(qp, s) / den;
    const u = FC.cross(qp, r) / den;
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
      (plan.openings || []).forEach((op) => {
        if (op.hostKey === 'w:' + wall.id || op.hostKey === 'wall_' + wall.id) {
          op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, op.offset)), 3);
        }
      });
    } else if (fromEnd === 1) {
      const delta = newLen - curLen;
      wall.a.x = FC.round(wall.b.x - dir.x * newLen, 3);
      wall.a.y = FC.round(wall.b.y - dir.y * newLen, 3);
      // Offset all openings by delta so their physical world positions do not move!
      (plan.openings || []).forEach((op) => {
        if (op.hostKey === 'w:' + wall.id || op.hostKey === 'wall_' + wall.id) {
          op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, op.offset + delta)), 3);
        }
      });
    } else {
      const delta = (newLen - curLen) / 2;
      const mid = FC.lerp(wall.a, wall.b, 0.5);
      const half = newLen / 2;
      wall.a.x = FC.round(mid.x - dir.x * half, 3);
      wall.a.y = FC.round(mid.y - dir.y * half, 3);
      wall.b.x = FC.round(mid.x + dir.x * half, 3);
      wall.b.y = FC.round(mid.y + dir.y * half, 3);
      (plan.openings || []).forEach((op) => {
        if (op.hostKey === 'w:' + wall.id || op.hostKey === 'wall_' + wall.id) {
          op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, op.offset + delta)), 3);
        }
      });
    }
    return true;
  };

  FC.extendWallToBoundary = function (plan, wallId, fromEnd = 0) {
    const wall = (plan.walls || []).find((w) => w.id === wallId || 'w:' + w.id === wallId);
    if (!wall) return null;
    const curLen = FC.dist(wall.a, wall.b);
    if (curLen < 1e-4) return null;

    const isFromEndB = fromEnd === 0;
    const startPt = isFromEndB ? wall.b : wall.a;
    const dir = isFromEndB
      ? { x: (wall.b.x - wall.a.x) / curLen, y: (wall.b.y - wall.a.y) / curLen }
      : { x: (wall.a.x - wall.b.x) / curLen, y: (wall.a.y - wall.b.y) / curLen };

    const segs = FC.getSegments(plan);
    let bestDist = Infinity;
    let bestHit = null;
    let bestSeg = null;

    const maxRayDist = 35;
    const farPt = { x: startPt.x + dir.x * maxRayDist, y: startPt.y + dir.y * maxRayDist };

    segs.forEach((seg) => {
      if (seg.wall && seg.wall.id === wall.id) return;
      const isect = FC.segmentIntersection(startPt, farPt, seg.a, seg.b);
      if (isect && isect.t > 1e-4) {
        const d = isect.t * maxRayDist;
        if (d < bestDist) {
          bestDist = d;
          bestHit = isect.point;
          bestSeg = seg;
        }
      }
    });

    if (!bestHit || bestDist > 30) return null;

    const P = { x: FC.round(bestHit.x, 3), y: FC.round(bestHit.y, 3) };

    if (isFromEndB) {
      wall.b.x = P.x;
      wall.b.y = P.y;
    } else {
      const delta = FC.dist(wall.a, P);
      wall.a.x = P.x;
      wall.a.y = P.y;
      const newLen = FC.dist(wall.a, wall.b);
      (plan.openings || []).forEach((op) => {
        if (op.hostKey === 'w:' + wall.id || op.hostKey === 'wall_' + wall.id) {
          op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, op.offset + delta)), 3);
        }
      });
    }

    if (bestSeg && bestSeg.wall) {
      const hitWall = bestSeg.wall;
      const hitEndA = FC.dist(P, hitWall.a) < 0.04;
      const hitEndB = FC.dist(P, hitWall.b) < 0.04;
      if (hitEndA) {
        hitWall.a.x = P.x;
        hitWall.a.y = P.y;
      } else if (hitEndB) {
        hitWall.b.x = P.x;
        hitWall.b.y = P.y;
      } else {
        FC.splitWall(plan, hitWall.id, P);
      }
    } else if (bestSeg && bestSeg.boundary) {
      const hitCorner = plan.outline.some((pt) => FC.dist(P, pt) < 0.04);
      if (!hitCorner && plan.outline && plan.outline.length >= 3) {
        const insIdx = (bestSeg.index + 1) % (plan.outline.length + 1);
        plan.outline.splice(insIdx, 0, { x: P.x, y: P.y });
      }
    }

    return {
      success: true,
      extended: true,
      point: P,
      hitPoint: P,
      fromEnd,
      delta: bestDist,
      extendedDistance: bestDist,
      targetSeg: bestSeg,
    };
  };

  FC.getOpeningSnapPoints = function (plan) {
    const segs = FC.getSegments(plan);
    const points = [];
    (plan.openings || []).forEach((op) => {
      const pl = FC.openingPlacement(plan, op, segs);
      if (!pl) return;
      const dir = { x: Math.cos(pl.angle), y: Math.sin(pl.angle) };
      const label = op.kind === 'door' ? 'Door' : (op.kind === 'window' ? 'Window' : 'Opening');
      points.push({
        x: pl.x,
        y: pl.y,
        type: 'opening-center',
        label: `${label} center`,
        op,
      });
      points.push({
        x: pl.x - dir.x * (pl.width / 2),
        y: pl.y - dir.y * (pl.width / 2),
        type: 'opening-edge',
        label: `${label} frame`,
        op,
      });
      points.push({
        x: pl.x + dir.x * (pl.width / 2),
        y: pl.y + dir.y * (pl.width / 2),
        type: 'opening-edge',
        label: `${label} frame`,
        op,
      });
    });
    return points;
  };

  FC.splitWall = function (plan, wallId, point) {
    const wall = plan.walls.find((w) => w.id === wallId);
    if (!wall) return null;
    const p = { x: FC.round(point.x, 3), y: FC.round(point.y, 3) };
    const oldB = { x: wall.b.x, y: wall.b.y };
    const cutDist = FC.dist(wall.a, p);
    const newLen = FC.dist(p, oldB);
    if (cutDist < 0.03 || newLen < 0.03) return null;

    wall.b.x = p.x;
    wall.b.y = p.y;
    const newWall = {
      id: FC.uid('w'),
      a: { x: p.x, y: p.y },
      b: oldB,
    };
    if (wall.virtual) newWall.virtual = true;
    if (wall.orient) newWall.orient = wall.orient;
    plan.walls.push(newWall);

    // Re-host openings that fell on the second half of the split wall
    (plan.openings || []).forEach((op) => {
      if (op.hostKey === 'w:' + wall.id || op.hostKey === 'wall_' + wall.id) {
        if (op.offset > cutDist) {
          op.hostKey = 'w:' + newWall.id;
          const newOffset = op.offset - cutDist;
          op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, newOffset)), 3);
        } else {
          op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(cutDist - op.width / 2 - 0.02, op.offset)), 3);
        }
      }
    });

    return newWall;
  };

  FC.insertOutlineVertex = function (plan, segIndex, point) {
    if (!plan || !Array.isArray(plan.outline) || plan.outline.length < 3) return null;
    const n = plan.outline.length;
    const idx = ((segIndex % n) + n) % n;
    const a = plan.outline[idx];
    const b = plan.outline[(idx + 1) % n];
    const hit = point ? FC.pointSegment(point, a, b) : { t: 0.5, point: FC.lerp(a, b, 0.5) };
    const pt = { x: FC.round(hit.point.x, 3), y: FC.round(hit.point.y, 3) };
    const cutDist = FC.dist(a, pt);
    const secondLen = FC.dist(pt, b);
    if (cutDist < 0.05 || secondLen < 0.05) return null;

    // Insert vertex at idx + 1
    const insertAt = idx + 1;
    plan.outline.splice(insertAt, 0, pt);

    // Update openings hosted on outline segments:
    // Segments o:k where k > idx shift to o:(k + 1)
    // Segment o:idx splits at cutDist into o:idx and o:(idx + 1)
    (plan.openings || []).forEach((op) => {
      if (typeof op.hostKey !== 'string' || !op.hostKey.startsWith('o:')) return;
      const k = parseInt(op.hostKey.slice(2), 10);
      if (!isFinite(k)) return;
      if (k > idx) {
        op.hostKey = 'o:' + (k + 1);
      } else if (k === idx) {
        if (op.offset > cutDist) {
          op.hostKey = 'o:' + (idx + 1);
          op.offset = FC.round(clamp(op.offset - cutDist, op.width / 2 + 0.02, Math.max(op.width / 2 + 0.02, secondLen - op.width / 2 - 0.02)), 3);
        } else {
          op.offset = FC.round(clamp(op.offset, op.width / 2 + 0.02, Math.max(op.width / 2 + 0.02, cutDist - op.width / 2 - 0.02)), 3);
        }
      }
    });

    return { index: insertAt, point: pt };
  };

  FC.deleteOutlineVertex = function (plan, vertexIndex) {
    if (!plan || !Array.isArray(plan.outline) || plan.outline.length <= 3) return false;
    const n = plan.outline.length;
    const idx = ((vertexIndex % n) + n) % n;
    const prevIdx = (idx - 1 + n) % n;
    const nextIdx = (idx + 1) % n;
    const prevPt = plan.outline[prevIdx];
    const nextPt = plan.outline[nextIdx];
    const oldPrevLen = FC.dist(prevPt, plan.outline[idx]);
    const newMergedLen = FC.dist(prevPt, nextPt);

    plan.outline.splice(idx, 1);

    // Update openings on outline segments:
    // Segment o:prevIdx and o:idx merge into the new segment at index (idx === 0 ? n - 2 : prevIdx)
    const updatedOpenings = [];
    (plan.openings || []).forEach((op) => {
      if (typeof op.hostKey !== 'string' || !op.hostKey.startsWith('o:')) {
        updatedOpenings.push(op);
        return;
      }
      const k = parseInt(op.hostKey.slice(2), 10);
      if (!isFinite(k)) {
        updatedOpenings.push(op);
        return;
      }
      if (k === prevIdx) {
        const newHostIdx = idx === 0 ? plan.outline.length - 1 : prevIdx;
        op.hostKey = 'o:' + newHostIdx;
        op.offset = FC.round(clamp(op.offset, op.width / 2 + 0.02, Math.max(op.width / 2 + 0.02, newMergedLen - op.width / 2 - 0.02)), 3);
        updatedOpenings.push(op);
      } else if (k === idx) {
        const newHostIdx = idx === 0 ? plan.outline.length - 1 : prevIdx;
        op.hostKey = 'o:' + newHostIdx;
        op.offset = FC.round(clamp(oldPrevLen + op.offset, op.width / 2 + 0.02, Math.max(op.width / 2 + 0.02, newMergedLen - op.width / 2 - 0.02)), 3);
        updatedOpenings.push(op);
      } else if (k > idx) {
        op.hostKey = 'o:' + (k - 1);
        updatedOpenings.push(op);
      } else {
        updatedOpenings.push(op);
      }
    });
    plan.openings = updatedOpenings;
    return true;
  };

  FC.addRoomBox = function (plan, p1, p2) {
    if (!plan || !p1 || !p2) return null;
    const x0 = FC.round(Math.min(p1.x, p2.x), 3);
    const y0 = FC.round(Math.min(p1.y, p2.y), 3);
    const x1 = FC.round(Math.max(p1.x, p2.x), 3);
    const y1 = FC.round(Math.max(p1.y, p2.y), 3);
    const w = FC.round(x1 - x0, 3);
    const d = FC.round(y1 - y0, 3);
    if (w < 0.25 || d < 0.25) return null;

    const corners = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];

    // If plan has no closed outline yet, make this rectangle the building footprint
    if (!plan.outline || plan.outline.length < 3) {
      plan.outline = corners;
      return { kind: 'outline', w, d, area: w * d, corners };
    }

    // Otherwise add 4 interior wall segments (skipping any segment that already coincides with an existing wall/outline edge)
    plan.walls = plan.walls || [];
    const existingSegs = FC.getSegments(plan);
    const addedWalls = [];

    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const duplicate = existingSegs.some((s) => {
        return (FC.dist(s.a, a) < 0.03 && FC.dist(s.b, b) < 0.03) || (FC.dist(s.a, b) < 0.03 && FC.dist(s.b, a) < 0.03);
      });
      if (!duplicate) {
        const nw = { id: FC.uid('w'), a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
        plan.walls.push(nw);
        addedWalls.push(nw);
      }
    }
    return { kind: 'walls', w, d, area: w * d, corners, walls: addedWalls };
  };

  FC.snapFurnitureToWalls = function (plan, item, rawX, rawY, tol = 0.35) {
    if (!plan || !item) return null;
    if (item.kind === 'rug' || item.kind === 'bathMat' || item.kind === 'diningTable' || item.kind === 'coffeeTable') {
      return null;
    }
    const segs = FC.getSegments(plan).filter((s) => !s.wall || !s.wall.virtual);
    if (!segs.length) return null;

    const halfD = (item.d || 0.8) / 2;
    let best = null;

    segs.forEach((seg) => {
      const hit = FC.pointSegment({ x: rawX, y: rawY }, seg.a, seg.b);
      const wallHalfThick = (seg.thickness || 0.12) / 2;
      const targetClearance = wallHalfThick + halfD;
      const edgeGap = Math.abs(hit.dist - targetClearance);

      // Snap when cursor is near the wall or when furniture back edge is within tol of wall face
      if (hit.t >= 0.04 && hit.t <= 0.96 && (edgeGap <= tol || hit.dist <= targetClearance + tol * 0.6)) {
        const dx = rawX - hit.point.x;
        const dy = rawY - hit.point.y;
        // Normal pointing from wall hit point toward furniture center
        const wallNx = -Math.sin(seg.angle);
        const wallNy = Math.cos(seg.angle);
        const dotSide = dx * wallNx + dy * wallNy;
        const sideSign = dotSide >= 0 ? 1 : -1;
        const nx = wallNx * sideSign;
        const ny = wallNy * sideSign;

        const snappedX = FC.round(hit.point.x + nx * targetClearance, 3);
        const snappedY = FC.round(hit.point.y + ny * targetClearance, 3);
        // Furniture local -Y is its back (headboard/sofa back), so local +Y should point along (nx, ny)
        // Since local +Y in world is (-sin(rot), cos(rot)), we want (-sin(rot), cos(rot)) = (nx, ny) => rot = atan2(-nx, ny)
        const snappedRot = FC.round(Math.atan2(-nx, ny), 3);

        const score = edgeGap;
        if (!best || score < best.score) {
          best = {
            score,
            x: snappedX,
            y: snappedY,
            rot: snappedRot,
            seg,
            wallPoint: hit.point,
          };
        }
      }
    });

    return best;
  };

  FC.connectTwoWalls = function (plan, idA, targetIdOrKey, options) {
    options = options || {};
    const wallA = (plan.walls || []).find((w) => w.id === idA || 'w:' + w.id === idA || 'wall_' + w.id === idA);
    if (!wallA) return null;

    const isOutline = typeof targetIdOrKey === 'string' && (targetIdOrKey.startsWith('o:') || targetIdOrKey.startsWith('outline'));
    if (isOutline) {
      const segs = FC.getSegments(plan);
      let outSeg = segs.find((s) => s.boundary && (s.key === targetIdOrKey || ('outline_' + s.index) === targetIdOrKey));
      if (!outSeg) {
        // Fallback to nearest outline segment
        let bestDist = Infinity;
        segs.forEach((s) => {
          if (!s.boundary) return;
          const hA = FC.pointSegment(wallA.a, s.a, s.b);
          const hB = FC.pointSegment(wallA.b, s.a, s.b);
          const d = Math.min(hA.dist, hB.dist);
          if (d < bestDist) {
            bestDist = d;
            outSeg = s;
          }
        });
      }
      if (!outSeg) return null;

      const hitA = FC.pointSegment(wallA.a, outSeg.a, outSeg.b);
      const hitB = FC.pointSegment(wallA.b, outSeg.a, outSeg.b);
      const useA = hitA.dist <= hitB.dist;
      const ptA = useA ? wallA.a : wallA.b;
      const bestHit = useA ? hitA : hitB;
      const P = { x: FC.round(bestHit.point.x, 3), y: FC.round(bestHit.point.y, 3) };

      ptA.x = P.x;
      ptA.y = P.y;

      // If strictly in segment interior, insert outline vertex so they share a junction
      if (bestHit.t > 0.02 && bestHit.t < 0.98 && plan.outline && plan.outline.length >= 3) {
        const insIdx = (outSeg.index + 1) % (plan.outline.length + 1);
        plan.outline.splice(insIdx, 0, { x: P.x, y: P.y });
      }
      return { success: true, type: 'outline', point: P, wallId: wallA.id, outlineIndex: outSeg.index };
    }

    const wallB = (plan.walls || []).find((w) => (w.id === targetIdOrKey || 'w:' + w.id === targetIdOrKey || 'wall_' + w.id === targetIdOrKey) && w.id !== wallA.id);
    if (!wallB) return null;

    // Check intersection
    const isect = FC.segmentIntersection(wallA.a, wallA.b, wallB.a, wallB.b);
    if (isect) {
      const P = { x: FC.round(isect.point.x, 3), y: FC.round(isect.point.y, 3) };
      if (isect.t >= 0.02 && isect.t <= 0.98 && isect.u >= 0.02 && isect.u <= 0.98) {
        // Cross intersection
        FC.splitWall(plan, wallA.id, P);
        FC.splitWall(plan, wallB.id, P);
        return { success: true, type: 'cross', point: P, walls: [wallA.id, wallB.id] };
      }
      if (isect.u >= 0.02 && isect.u <= 0.98) {
        // Wall A meets Wall B body
        const ptA = isect.t < 0.5 ? wallA.a : wallA.b;
        ptA.x = P.x;
        ptA.y = P.y;
        FC.splitWall(plan, wallB.id, P);
        return { success: true, type: 't-junction', point: P, walls: [wallA.id, wallB.id] };
      }
      if (isect.t >= 0.02 && isect.t <= 0.98) {
        // Wall B meets Wall A body
        const ptB = isect.u < 0.5 ? wallB.a : wallB.b;
        ptB.x = P.x;
        ptB.y = P.y;
        FC.splitWall(plan, wallA.id, P);
        return { success: true, type: 't-junction', point: P, walls: [wallA.id, wallB.id] };
      }
      // End-to-end intersection
      const ptA = isect.t < 0.5 ? wallA.a : wallA.b;
      const ptB = isect.u < 0.5 ? wallB.a : wallB.b;
      ptA.x = P.x;
      ptA.y = P.y;
      ptB.x = P.x;
      ptB.y = P.y;
      return { success: true, type: 'corner', point: P, walls: [wallA.id, wallB.id] };
    }

    // No direct intersection: calculate endpoint distances and projections
    const pairs = [
      { ptA: wallA.a, ptB: wallB.a, d: FC.dist(wallA.a, wallB.a) },
      { ptA: wallA.a, ptB: wallB.b, d: FC.dist(wallA.a, wallB.b) },
      { ptA: wallA.b, ptB: wallB.a, d: FC.dist(wallA.b, wallB.a) },
      { ptA: wallA.b, ptB: wallB.b, d: FC.dist(wallA.b, wallB.b) },
    ];
    pairs.sort((a, b) => a.d - b.d);
    const closestEndPair = pairs[0];

    const projA_a = FC.pointSegment(wallA.a, wallB.a, wallB.b);
    const projA_b = FC.pointSegment(wallA.b, wallB.a, wallB.b);
    const projB_a = FC.pointSegment(wallB.a, wallA.a, wallA.b);
    const projB_b = FC.pointSegment(wallB.b, wallA.a, wallA.b);

    const projs = [
      { type: 'A_in_B', pt: wallA.a, targetWall: wallB, hit: projA_a },
      { type: 'A_in_B', pt: wallA.b, targetWall: wallB, hit: projA_b },
      { type: 'B_in_A', pt: wallB.a, targetWall: wallA, hit: projB_a },
      { type: 'B_in_A', pt: wallB.b, targetWall: wallA, hit: projB_b },
    ].filter((pr) => pr.hit.t > 0.02 && pr.hit.t < 0.98);

    projs.sort((a, b) => a.hit.dist - b.hit.dist);
    const bestProj = projs[0];

    // Favor T-junction if an endpoint is closest to the interior of the other wall
    if (bestProj && (bestProj.hit.dist < closestEndPair.d * 0.85 || closestEndPair.d > 0.35)) {
      const P = { x: FC.round(bestProj.hit.point.x, 3), y: FC.round(bestProj.hit.point.y, 3) };
      bestProj.pt.x = P.x;
      bestProj.pt.y = P.y;
      FC.splitWall(plan, bestProj.targetWall.id, P);
      return { success: true, type: 't-junction', point: P, walls: [wallA.id, wallB.id] };
    }

    // Otherwise connect closest endpoint pair (L-corner or extension)
    let P = null;
    const aIsConnected = (plan.walls || []).some((w) => w.id !== wallA.id && (FC.dist(w.a, closestEndPair.ptA) < 0.005 || FC.dist(w.b, closestEndPair.ptA) < 0.005)) ||
      (plan.outline || []).some((p) => FC.dist(p, closestEndPair.ptA) < 0.005);
    const bIsConnected = (plan.walls || []).some((w) => w.id !== wallB.id && (FC.dist(w.a, closestEndPair.ptB) < 0.005 || FC.dist(w.b, closestEndPair.ptB) < 0.005)) ||
      (plan.outline || []).some((p) => FC.dist(p, closestEndPair.ptB) < 0.005);

    if (aIsConnected && !bIsConnected) {
      P = { x: closestEndPair.ptA.x, y: closestEndPair.ptA.y };
    } else if (bIsConnected && !aIsConnected) {
      P = { x: closestEndPair.ptB.x, y: closestEndPair.ptB.y };
    } else {
      const lineIsect = FC.lineLineIntersection(wallA.a, wallA.b, wallB.a, wallB.b);
      if (lineIsect) {
        const dA = FC.dist(lineIsect.point, closestEndPair.ptA);
        const dB = FC.dist(lineIsect.point, closestEndPair.ptB);
        const angA = Math.atan2(wallA.b.y - wallA.a.y, wallA.b.x - wallA.a.x);
        const angB = Math.atan2(wallB.b.y - wallB.a.y, wallB.b.x - wallB.a.x);
        const diff = Math.abs(FC.angleDiff(angA, angB));
        if (diff > 0.25 && diff < Math.PI - 0.25 && dA < 1.8 && dB < 1.8) {
          P = { x: FC.round(lineIsect.point.x, 3), y: FC.round(lineIsect.point.y, 3) };
        }
      }
    }
    if (!P) {
      P = {
        x: FC.round((closestEndPair.ptA.x + closestEndPair.ptB.x) / 2, 3),
        y: FC.round((closestEndPair.ptA.y + closestEndPair.ptB.y) / 2, 3),
      };
    }

    closestEndPair.ptA.x = P.x;
    closestEndPair.ptA.y = P.y;
    closestEndPair.ptB.x = P.x;
    closestEndPair.ptB.y = P.y;
    return { success: true, type: 'corner', point: P, walls: [wallA.id, wallB.id] };
  };

  FC.connectWalls = function (plan, wallIdsOrKeys, options) {
    let ids = [];
    if (Array.isArray(wallIdsOrKeys)) {
      ids = wallIdsOrKeys.slice();
    } else if (arguments.length >= 3) {
      ids = [wallIdsOrKeys, arguments[2]];
    } else {
      ids = [wallIdsOrKeys];
    }
    ids = ids.filter(Boolean);
    if (ids.length < 2) return null;

    const results = [];
    for (let i = 0; i < ids.length - 1; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const res = FC.connectTwoWalls(plan, ids[i], ids[j], options);
        if (res && res.success) {
          results.push(res);
        }
      }
    }
    return results.length ? results : null;
  };

  FC.findNearestWallToWall = function (plan, wallId) {
    const wallA = (plan.walls || []).find((w) => w.id === wallId || 'w:' + w.id === wallId || 'wall_' + w.id === wallId);
    if (!wallA) return null;

    let best = null;
    const segs = FC.getSegments(plan);
    segs.forEach((seg) => {
      if (seg.wall && seg.wall.id === wallA.id) return;
      const hA = FC.pointSegment(wallA.a, seg.a, seg.b);
      const hB = FC.pointSegment(wallA.b, seg.a, seg.b);
      const d = Math.min(hA.dist, hB.dist);
      if (!best || d < best.dist) {
        best = {
          seg,
          dist: d,
          targetIdOrKey: seg.wall ? seg.wall.id : seg.key,
          boundary: seg.boundary,
        };
      }
    });
    return best;
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
      furniture: [],
      settings: Object.assign({}, FC.defaultSettings),
      style: 'scandinavian',
      customStyle: null,
      density: 1,
      layoutVariation: 0,
      furnished: false,
      autoDetectRooms: true,
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
          .map((w) => ({
            id: w.id || FC.uid('w'),
            a: { x: +w.a.x || 0, y: +w.a.y || 0 },
            b: { x: +w.b.x || 0, y: +w.b.y || 0 },
            virtual: !!w.virtual,
          }))
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
            swingSide: o.swingSide === -1 ? -1 : 1,
            hinge: o.hinge === 'right' ? 'right' : 'left',
          }))
      : [];
    plan.rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
    plan.autoDetectRooms = raw.autoDetectRooms !== false;
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
    plan.furniture = Array.isArray(raw.furniture)
      ? raw.furniture
          .filter((f) => f && typeof f === 'object')
          .map((f) => ({
            id: f.id || FC.uid('f'),
            roomId: f.roomId || null,
            kind: f.kind || 'chair',
            name: f.name || '',
            x: +f.x || 0,
            y: +f.y || 0,
            w: +f.w || 0.8,
            d: +f.d || 0.8,
            h: +f.h || 0.75,
            rot: +f.rot || 0,
            elev: +f.elev || 0,
            mat: f.mat || 'wood',
            variant: f.variant || '',
            decor: !!f.decor,
            custom: !!f.custom,
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
      { id: 'd1', kind: 'door', style: 'single', hostKey: 'w:w4', offset: 3.65, width: 0.9, height: 2.1, sill: 0, swingSide: 1, hinge: 'left' },
      { id: 'd2', kind: 'door', style: 'single', hostKey: 'w:w5', offset: 0.85, width: 0.9, height: 2.1, sill: 0, swingSide: 1, hinge: 'left' },
      { id: 'd3', kind: 'door', style: 'single', hostKey: 'w:w2', offset: 1.35, width: 0.8, height: 2.05, sill: 0, swingSide: 1, hinge: 'left' },
      { id: 'd4', kind: 'opening', style: 'opening', hostKey: 'w:w6', offset: 1.2, width: 1.7, height: 2.25, sill: 0 },
      { id: 'd5', kind: 'door', style: 'single', hostKey: 'o:2', offset: 5.8, width: 1.0, height: 2.2, sill: 0, swingSide: 1, hinge: 'left' },
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

  FC.findFreeOpeningOffset = function (plan, hostKey, preferredOffset, width, ignoreId) {
    const segs = FC.getSegments(plan);
    const seg = segs.find((s) => s.key === hostKey);
    if (!seg || seg.len < 0.35) return null;
    const w = Math.min(width || 0.9, Math.max(0.25, seg.len - 0.14));
    const minOff = w / 2 + 0.06;
    const maxOff = seg.len - w / 2 - 0.06;
    if (maxOff < minOff) return null;
    const pref = clamp(preferredOffset != null && isFinite(preferredOffset) ? preferredOffset : seg.len / 2, minOff, maxOff);
    if (FC.canPlaceOpening(plan, hostKey, pref, w, ignoreId)) {
      return { offset: FC.round(pref, 3), width: FC.round(w, 3) };
    }
    for (let step = 0.05; step <= seg.len; step = Math.round((step + 0.05) * 100) / 100) {
      const c1 = pref + step;
      if (c1 <= maxOff && FC.canPlaceOpening(plan, hostKey, c1, w, ignoreId)) {
        return { offset: FC.round(c1, 3), width: FC.round(w, 3) };
      }
      const c2 = pref - step;
      if (c2 >= minOff && FC.canPlaceOpening(plan, hostKey, c2, w, ignoreId)) {
        return { offset: FC.round(c2, 3), width: FC.round(w, 3) };
      }
    }
    return null;
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
    plan.walls.forEach((w) => {
      const dx = Math.abs(w.b.x - w.a.x);
      const dy = Math.abs(w.b.y - w.a.y);
      const len = Math.hypot(dx, dy);
      if (len < 0.04) return;
      const deg = (((Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI) % 180) + 180) % 180;
      if (deg < 3 || deg > 177 || dy < 0.03) {
        w.b.y = w.a.y;
      } else if (Math.abs(deg - 90) < 3 || dx < 0.03) {
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
    const maxExtGap = options.maxExtGap || Math.max(extThick * 1.6, 0.36);
    const maxIntGap = options.maxIntGap || Math.max(intThick * 2.2, 0.28);
    const weldDist = options.weldDist || 0.08;

    // Step 0: Classify wall orientation and make initially orthogonal walls strictly orthogonal
    walls.forEach((w) => {
      const dx = Math.abs(w.b.x - w.a.x);
      const dy = Math.abs(w.b.y - w.a.y);
      const len = Math.hypot(dx, dy);
      if (len < 0.04) return;
      const deg = (((Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180 / Math.PI) % 180) + 180) % 180;
      if (deg < 5 || deg > 175 || dy < 0.06) {
        w.orient = 'H';
        const avgY = FC.round((w.a.y + w.b.y) / 2, 3);
        w.a.y = avgY;
        w.b.y = avgY;
      } else if (Math.abs(deg - 90) < 5 || dx < 0.06) {
        w.orient = 'V';
        const avgX = FC.round((w.a.x + w.b.x) / 2, 3);
        w.a.x = avgX;
        w.b.x = avgX;
      } else {
        w.orient = 'D';
      }
    });

    const outSegs = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      const orient = dy < 0.04 ? 'H' : (dx < 0.04 ? 'V' : 'D');
      outSegs.push({ a, b, idx: i, orient });
    }

    // Step 1: Align wall lines with nearby parallel outline segments or outline corners
    // If an entire vertical wall is within extThick of a vertical outline segment/corner, align it
    walls.forEach((w) => {
      if (w.orient === 'V') {
        let bestDist = Infinity, bestX = null;
        outSegs.forEach((os) => {
          if (os.orient === 'V') {
            const d = Math.abs(w.a.x - os.a.x);
            const minY = Math.min(os.a.y, os.b.y) - maxExtGap;
            const maxY = Math.max(os.a.y, os.b.y) + maxExtGap;
            if (d <= maxExtGap && d < bestDist && ((w.a.y >= minY && w.a.y <= maxY) || (w.b.y >= minY && w.b.y <= maxY))) {
              bestDist = d;
              bestX = os.a.x;
            }
          }
        });
        outline.forEach((opt) => {
          ['a', 'b'].forEach((k) => {
            const d = Math.hypot(w[k].x - opt.x, w[k].y - opt.y);
            if (d <= maxExtGap && Math.abs(w.a.x - opt.x) <= extThick * 1.5) {
              if (Math.abs(w.a.x - opt.x) < bestDist) {
                bestDist = Math.abs(w.a.x - opt.x);
                bestX = opt.x;
              }
            }
          });
        });
        if (bestX !== null && bestDist <= maxExtGap) {
          w.a.x = bestX;
          w.b.x = bestX;
        }
      } else if (w.orient === 'H') {
        let bestDist = Infinity, bestY = null;
        outSegs.forEach((os) => {
          if (os.orient === 'H') {
            const d = Math.abs(w.a.y - os.a.y);
            const minX = Math.min(os.a.x, os.b.x) - maxExtGap;
            const maxX = Math.max(os.a.x, os.b.x) + maxExtGap;
            if (d <= maxExtGap && d < bestDist && ((w.a.x >= minX && w.a.x <= maxX) || (w.b.x >= minX && w.b.x <= maxX))) {
              bestDist = d;
              bestY = os.a.y;
            }
          }
        });
        outline.forEach((opt) => {
          ['a', 'b'].forEach((k) => {
            const d = Math.hypot(w[k].x - opt.x, w[k].y - opt.y);
            if (d <= maxExtGap && Math.abs(w.a.y - opt.y) <= extThick * 1.5) {
              if (Math.abs(w.a.y - opt.y) < bestDist) {
                bestDist = Math.abs(w.a.y - opt.y);
                bestY = opt.y;
              }
            }
          });
        });
        if (bestY !== null && bestDist <= maxExtGap) {
          w.a.y = bestY;
          w.b.y = bestY;
        }
      }
    });

    // Step 2: Longitudinal ray extension of walls to outline
    walls.forEach((w) => {
      const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.05) return;
      const ux = dx / len, uy = dy / len;

      ['b', 'a'].forEach((k) => {
        const dir = k === 'b' ? 1 : -1;
        const curPt = w[k];
        let bestDist = Infinity, bestPt = null;

        outSegs.forEach((os) => {
          const sx = os.b.x - os.a.x, sy = os.b.y - os.a.y;
          const denom = (dir * ux) * sy - (dir * uy) * sx;
          if (Math.abs(denom) > 1e-5) {
            const t = ((os.a.x - curPt.x) * sy - (os.a.y - curPt.y) * sx) / denom;
            const sParam = ((os.a.x - curPt.x) * (dir * uy) - (os.a.y - curPt.y) * (dir * ux)) / denom;
            const segLen = Math.hypot(sx, sy);
            const sTol = Math.max(0.05, maxExtGap / segLen);
            if (t >= -0.01 && t <= maxExtGap && sParam >= -sTol && sParam <= 1 + sTol) {
              if (t < bestDist) {
                bestDist = t;
                let px = curPt.x + dir * ux * t;
                let py = curPt.y + dir * uy * t;
                if (w.orient === 'V') px = w.a.x;
                if (w.orient === 'H') py = w.a.y;
                bestPt = { x: px, y: py };
              }
            }
          }
        });

        if (bestPt && bestDist <= maxExtGap) {
          w[k].x = FC.round(bestPt.x, 3);
          w[k].y = FC.round(bestPt.y, 3);
        }
      });
    });

    // Step 3: Intersection extension between interior walls
    for (let round = 0; round < 3; round++) {
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
          if (Math.abs(denom) < 1e-5) continue;

          const t1 = ((w2.a.x - w1.a.x) * dy2 - (w2.a.y - w1.a.y) * dx2) / denom;
          const t2 = ((w2.a.x - w1.a.x) * dy1 - (w2.a.y - w1.a.y) * dx1) / denom;

          let px = w1.a.x + dx1 * t1;
          let py = w1.a.y + dy1 * t1;

          if (w1.orient === 'V' && w2.orient === 'H') {
            px = w1.a.x;
            py = w2.a.y;
          } else if (w1.orient === 'H' && w2.orient === 'V') {
            px = w2.a.x;
            py = w1.a.y;
          }

          const distToA1 = Math.hypot(px - w1.a.x, py - w1.a.y);
          const distToB1 = Math.hypot(px - w1.b.x, py - w1.b.y);
          const isNearEnd1 = (distToA1 <= maxIntGap && t1 <= 0.15) || (distToB1 <= maxIntGap && t1 >= 0.85);
          const isWithinW2 = t2 >= -0.20 && t2 <= 1.20;

          if (isNearEnd1 && isWithinW2) {
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

    // Step 4: Perpendicular projection fallback strictly along longitudinal axis
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
          if (w.orient === 'V') {
            w[k].y = FC.round(bestPt.y, 3);
          } else if (w.orient === 'H') {
            w[k].x = FC.round(bestPt.x, 3);
          } else {
            w[k].x = FC.round(bestPt.x, 3);
            w[k].y = FC.round(bestPt.y, 3);
          }
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
          if (w1.orient === 'V') {
            w1[k].y = FC.round(bestPt.y, 3);
          } else if (w1.orient === 'H') {
            w1[k].x = FC.round(bestPt.x, 3);
          } else {
            w1[k].x = FC.round(bestPt.x, 3);
            w1[k].y = FC.round(bestPt.y, 3);
          }
        }
      });
    });

    // Step 5: Corner & joint welding
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < walls.length; i++) {
        const w1 = walls[i];
        for (let j = i + 1; j < walls.length; j++) {
          const w2 = walls[j];
          ['a', 'b'].forEach((k1) => {
            ['a', 'b'].forEach((k2) => {
              if (Math.hypot(w1[k1].x - w2[k2].x, w1[k1].y - w2[k2].y) <= weldDist) {
                if (w1.orient === 'V' && w2.orient === 'H') {
                  w1[k1].x = w1.a.x;
                  w1[k1].y = w2.a.y;
                  w2[k2].x = w1.a.x;
                  w2[k2].y = w2.a.y;
                } else if (w1.orient === 'H' && w2.orient === 'V') {
                  w1[k1].x = w2.a.x;
                  w1[k1].y = w1.a.y;
                  w2[k2].x = w2.a.x;
                  w2[k2].y = w1.a.y;
                } else if (w1.orient === 'H' && w2.orient === 'H') {
                  const avgY = FC.round((w1.a.y + w2.a.y) / 2, 3);
                  w1.a.y = w1.b.y = w2.a.y = w2.b.y = avgY;
                  const midX = FC.round((w1[k1].x + w2[k2].x) / 2, 3);
                  w1[k1].x = w2[k2].x = midX;
                } else if (w1.orient === 'V' && w2.orient === 'V') {
                  const avgX = FC.round((w1.a.x + w2.a.x) / 2, 3);
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

    // Snap endpoints to outline vertices within weldDist
    walls.forEach((w) => {
      ['a', 'b'].forEach((k) => {
        outline.forEach((opt) => {
          if (Math.hypot(w[k].x - opt.x, w[k].y - opt.y) <= weldDist) {
            if (w.orient === 'V') {
              w[k].y = opt.y;
              w[k].x = opt.x;
              w[k === 'a' ? 'b' : 'a'].x = opt.x;
            } else if (w.orient === 'H') {
              w[k].x = opt.x;
              w[k].y = opt.y;
              w[k === 'a' ? 'b' : 'a'].y = opt.y;
            } else {
              w[k].x = opt.x;
              w[k].y = opt.y;
            }
          }
        });
      });
    });

    // Strict final orthogonal check
    walls.forEach((w) => {
      if (w.orient === 'H') w.b.y = w.a.y;
      if (w.orient === 'V') w.b.x = w.a.x;
    });
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
    const hasOutline = plan.outline && plan.outline.length >= 3 && Math.abs(FC.polygonArea(plan.outline)) >= 0.5;
    const hasWalls = Array.isArray(plan.walls) && plan.walls.length >= 3;
    const hasManual = Array.isArray(plan.manualRooms) && plan.manualRooms.length > 0;
    if (!hasOutline && !hasWalls && !hasManual) return [];

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
              faces.push({ polygon: clean, area: Math.abs(FC.polygonArea(clean)), centroid });
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
    if (plan.outline && plan.outline.length >= 3) {
      return Math.abs(FC.polygonArea(plan.outline));
    }
    if (Array.isArray(plan.rooms) && plan.rooms.length) {
      return plan.rooms.reduce((sum, r) => sum + (Number(r.area) || 0), 0);
    }
    return 0;
  };

  FC.planBounds = function (plan) {
    const pts = [];
    if (plan.outline && plan.outline.length >= 3) {
      plan.outline.forEach((p) => pts.push(p));
    }
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
      hinge: 'left',
      swingSide: 1,
    };
  };

  /* ------------------------------------------------------------------ */
  /* Furniture catalog & recipes                                         */
  /* ------------------------------------------------------------------ */

  FC.furnitureCatalog = {
    // Living Room
    sofa: { label: 'Straight Sofa', category: 'living', w: 2.1, d: 0.9, h: 0.86, mat: 'fabric', icon: 'sofa', desc: '3-seater contemporary upholstered couch' },
    sectionalSofa: { label: 'Sectional Sofa', category: 'living', w: 2.4, d: 1.8, h: 0.84, mat: 'fabric', icon: 'sofa', desc: 'L-shaped modern corner sectional' },
    armchair: { label: 'Armchair', category: 'living', w: 0.85, d: 0.85, h: 0.82, mat: 'fabric', icon: 'armchair', desc: 'Plush accent lounge chair' },
    coffeeTable: { label: 'Coffee Table', category: 'living', w: 1.05, d: 0.55, h: 0.40, mat: 'wood', icon: 'layout', desc: 'Low living room center table' },
    tvConsole: { label: 'TV Media Console', category: 'living', w: 1.8, d: 0.42, h: 0.48, mat: 'wood', icon: 'sliders', desc: 'Credenza with media storage' },
    tv: { label: 'Flat-screen TV', category: 'living', w: 1.3, d: 0.08, h: 0.75, mat: 'screen', elev: 0.92, icon: 'layout', desc: 'Wall or stand mounted television' },
    fireplace: { label: 'Modern Fireplace', category: 'living', w: 1.2, d: 0.32, h: 0.82, mat: 'stone', icon: 'sun', desc: 'Linear architectural fireplace' },
    floorLamp: { label: 'Floor Lamp', category: 'living', w: 0.4, d: 0.4, h: 1.55, mat: 'metal', decor: true, icon: 'sun', desc: 'Tall ambient standing lamp' },
    rug: { label: 'Area Rug', category: 'living', w: 2.6, d: 1.8, h: 0.015, mat: 'rug', decor: true, icon: 'layers', desc: 'Woven fabric floor covering' },
    plant: { label: 'Indoor Plant', category: 'living', w: 0.55, d: 0.55, h: 1.25, mat: 'plant', decor: true, icon: 'sparkles', desc: 'Potted indoor greenery' },
    bookshelf: { label: 'Bookshelf', category: 'living', w: 1.2, d: 0.35, h: 1.95, mat: 'wood', icon: 'layers', desc: 'Multi-tier storage bookcase' },
    artwork: { label: 'Framed Artwork', category: 'living', w: 1.2, d: 0.04, h: 0.80, mat: 'wood', elev: 1.35, decor: true, icon: 'palette', desc: 'Wall art canvas' },

    // Bedroom
    bed: { label: 'Double Bed', category: 'bedroom', w: 1.6, d: 2.0, h: 0.62, mat: 'wood', icon: 'bed', desc: 'Queen/Double bed with headboard' },
    singleBed: { label: 'Single Bed', category: 'bedroom', w: 1.0, d: 2.0, h: 0.58, mat: 'wood', icon: 'bed', desc: 'Twin single bed' },
    crib: { label: 'Baby Crib', category: 'bedroom', w: 1.35, d: 0.75, h: 0.92, mat: 'wood', icon: 'bed', desc: 'Wooden nursery cot with slats' },
    nightstand: { label: 'Nightstand', category: 'bedroom', w: 0.45, d: 0.40, h: 0.52, mat: 'wood', icon: 'layout', desc: 'Bedside drawer table with lamp' },
    wardrobe: { label: 'Wardrobe', category: 'bedroom', w: 1.8, d: 0.60, h: 2.15, mat: 'cabinet', icon: 'layers', desc: 'Tall double-door clothes closet' },
    dresser: { label: 'Dresser', category: 'bedroom', w: 1.2, d: 0.48, h: 0.86, mat: 'wood', icon: 'layers', desc: 'Wide chest of drawers' },
    fullMirror: { label: 'Floor Mirror', category: 'bedroom', w: 0.55, d: 0.10, h: 1.65, elev: 0.15, mat: 'metal', decor: true, icon: 'sliders', desc: 'Full-length dressing mirror' },

    // Kitchen
    counter: { label: 'Kitchen Counter', category: 'kitchen', w: 1.8, d: 0.60, h: 0.92, mat: 'cabinet', icon: 'wall', desc: 'Cabinet base with countertop & sink' },
    island: { label: 'Kitchen Island', category: 'kitchen', w: 1.4, d: 0.75, h: 0.92, mat: 'cabinet', icon: 'layout', desc: 'Freestanding prep island with stone top' },
    upperCabinets: { label: 'Upper Cabinets', category: 'kitchen', w: 1.8, d: 0.34, h: 0.70, elev: 1.50, mat: 'cabinet', icon: 'layers', desc: 'Wall-mounted upper storage' },
    ovenRange: { label: 'Cooking Range / Oven', category: 'kitchen', w: 0.75, d: 0.65, h: 0.90, mat: 'metal', icon: 'sliders', desc: 'Range oven with burners and glass door' },
    rangeHood: { label: 'Range Vent Hood', category: 'kitchen', w: 0.75, d: 0.50, h: 0.65, elev: 1.55, mat: 'metal', decor: true, icon: 'ceiling', desc: 'Stainless extractor hood' },
    fridge: { label: 'Refrigerator', category: 'kitchen', w: 0.75, d: 0.70, h: 1.95, mat: 'metal', icon: 'layers', desc: 'Full-size tall double-door fridge' },
    dishwasher: { label: 'Dishwasher', category: 'kitchen', w: 0.60, d: 0.60, h: 0.86, mat: 'metal', icon: 'washer', desc: 'Under-counter stainless dishwasher' },
    microwave: { label: 'Microwave', category: 'kitchen', w: 0.54, d: 0.38, h: 0.34, elev: 0.92, mat: 'metal', icon: 'cube', desc: 'Countertop/recessed microwave oven' },

    // Dining
    diningTable: { label: 'Dining Table', category: 'dining', w: 1.6, d: 0.90, h: 0.75, mat: 'wood', icon: 'layout', desc: '4-6 person dining table' },
    chair: { label: 'Dining Chair', category: 'dining', w: 0.46, d: 0.46, h: 0.88, mat: 'wood', icon: 'armchair', desc: 'Dining or side chair' },
    sideboard: { label: 'Sideboard Buffet', category: 'dining', w: 1.5, d: 0.42, h: 0.80, mat: 'wood', icon: 'layers', desc: 'Low storage credenza' },
    stool: { label: 'Bar Stool', category: 'dining', w: 0.40, d: 0.40, h: 0.66, mat: 'wood', icon: 'sun', desc: 'High counter seating' },
    pendant: { label: 'Pendant Light', category: 'dining', w: 0.45, d: 0.45, h: 0.45, elev: 2.05, mat: 'metal', decor: true, icon: 'ceiling', desc: 'Hanging ceiling luminaire' },

    // Bathroom
    vanity: { label: 'Bath Vanity & Basin', category: 'bathroom', w: 0.90, d: 0.48, h: 0.86, mat: 'cabinet', icon: 'window', desc: 'Sink cabinet with mirror' },
    toilet: { label: 'Toilet', category: 'bathroom', w: 0.42, d: 0.65, h: 0.78, mat: 'stone', icon: 'bath', desc: 'Ceramic toilet bowl & cistern' },
    shower: { label: 'Walk-in Shower', category: 'bathroom', w: 0.90, d: 0.90, h: 2.05, mat: 'stone', icon: 'bath', desc: 'Glass enclosure with shower head' },
    bathtub: { label: 'Bathtub', category: 'bathroom', w: 1.65, d: 0.75, h: 0.58, mat: 'stone', icon: 'bath', desc: 'Soaking tub with faucet' },
    mirrorCabinet: { label: 'Mirror Cabinet', category: 'bathroom', w: 0.80, d: 0.14, h: 0.75, elev: 1.35, mat: 'cabinet', decor: true, icon: 'window', desc: 'Medicine cabinet with mirror' },
    towelRack: { label: 'Towel Warmer Rack', category: 'bathroom', w: 0.55, d: 0.12, h: 0.95, elev: 0.80, mat: 'metal', decor: true, icon: 'layers', desc: 'Wall-hung heated ladder rack' },
    bathMat: { label: 'Bath Mat', category: 'bathroom', w: 0.75, d: 0.45, h: 0.015, mat: 'linen', decor: true, icon: 'layers', desc: 'Soft bathroom floor mat' },

    // Home Office
    desk: { label: 'Work Desk', category: 'office', w: 1.4, d: 0.65, h: 0.76, mat: 'wood', icon: 'file', desc: 'Writing and computer desk' },
    officeChair: { label: 'Ergonomic Office Chair', category: 'office', w: 0.62, d: 0.62, h: 0.96, mat: 'fabric', icon: 'armchair', desc: 'Swivel chair with star base' },
    monitor: { label: 'Desktop Monitor', category: 'office', w: 0.60, d: 0.15, h: 0.45, elev: 0.76, mat: 'metal', icon: 'layout', desc: 'Widescreen PC display' },

    // Utility & Laundry
    washer: { label: 'Washing Machine', category: 'utility', w: 0.62, d: 0.62, h: 0.86, mat: 'metal', icon: 'washer', desc: 'Front-load washing machine' },
    dryer: { label: 'Tumble Dryer', category: 'utility', w: 0.62, d: 0.62, h: 0.86, mat: 'metal', icon: 'washer', desc: 'Front-load clothes dryer' },
    laundrySink: { label: 'Utility Laundry Sink', category: 'utility', w: 0.65, d: 0.60, h: 0.88, mat: 'cabinet', icon: 'bath', desc: 'Deep basin wash tub' },
    ironingBoard: { label: 'Ironing Board', category: 'utility', w: 1.25, d: 0.38, h: 0.85, mat: 'fabric', icon: 'sliders', desc: 'Folding ironing table' },

    // Garage
    car: { label: 'Passenger Car', category: 'garage', w: 1.85, d: 4.40, h: 1.45, mat: 'metal', icon: 'car', desc: 'Full-size sedan/SUV vehicle' },
    workbench: { label: 'Heavy Workbench', category: 'garage', w: 1.60, d: 0.65, h: 0.90, mat: 'wood', icon: 'tool', desc: 'Workshop bench with tool backing' },
    toolCabinet: { label: 'Tool Chest', category: 'garage', w: 0.85, d: 0.50, h: 1.05, mat: 'metal', icon: 'tool', desc: 'Rolling multi-drawer mechanic chest' },
    garageShelving: { label: 'Industrial Shelving', category: 'garage', w: 1.50, d: 0.50, h: 1.95, mat: 'metal', icon: 'layers', desc: 'Heavy-duty steel storage racks' },
    bicycle: { label: 'Bicycle', category: 'garage', w: 1.75, d: 0.45, h: 1.05, mat: 'metal', icon: 'sliders', desc: 'Wall/floor bicycle' },
    boxes: { label: 'Storage Boxes', category: 'garage', w: 0.45, d: 0.45, h: 0.70, mat: 'wood', decor: true, icon: 'cube', desc: 'Stacked storage cartons' },
    shelf: { label: 'Utility Shelf', category: 'garage', w: 1.20, d: 0.35, h: 1.80, mat: 'metal', icon: 'layers', desc: 'Multi-shelf metal rack' },

    // Outdoor & Patio
    patioTable: { label: 'Patio Table', category: 'outdoor', w: 0.90, d: 0.90, h: 0.74, mat: 'wood', icon: 'layout', desc: 'Outdoor garden dining table' },
    patioChair: { label: 'Patio Chair', category: 'outdoor', w: 0.55, d: 0.55, h: 0.82, mat: 'wood', icon: 'armchair', desc: 'Weatherproof outdoor chair' },
    sunLounger: { label: 'Sun Lounger', category: 'outdoor', w: 0.68, d: 1.90, h: 0.42, mat: 'fabric', icon: 'sun', desc: 'Reclining chaise lounge' },
    parasol: { label: 'Patio Umbrella', category: 'outdoor', w: 2.20, d: 2.20, h: 2.35, mat: 'fabric', decor: true, icon: 'umbrella', desc: 'Freestanding garden parasol' },
    bbq: { label: 'Barbecue Grill', category: 'outdoor', w: 1.15, d: 0.60, h: 1.10, mat: 'metal', icon: 'sliders', desc: 'Outdoor charcoal/gas BBQ grill' },
    planterBox: { label: 'Planter Box', category: 'outdoor', w: 1.20, d: 0.35, h: 0.48, mat: 'wood', decor: true, icon: 'sparkles', desc: 'Railing flower planter with shrubs' },
  };

  const FURNITURE_HEIGHTS = {
    bed: 0.62,
    singleBed: 0.58,
    crib: 0.92,
    nightstand: 0.52,
    wardrobe: 2.15,
    dresser: 0.86,
    fullMirror: 1.65,
    sofa: 0.86,
    sectionalSofa: 0.84,
    armchair: 0.82,
    rug: 0.015,
    coffeeTable: 0.4,
    tvConsole: 0.48,
    tv: 0.72,
    fireplace: 0.82,
    plant: 1.25,
    diningTable: 0.75,
    chair: 0.88,
    counter: 0.92,
    upperCabinets: 0.7,
    island: 0.92,
    stool: 0.66,
    fridge: 1.95,
    ovenRange: 0.90,
    rangeHood: 0.65,
    dishwasher: 0.86,
    microwave: 0.34,
    toilet: 0.78,
    vanity: 0.86,
    shower: 2.05,
    bathtub: 0.58,
    mirrorCabinet: 0.75,
    towelRack: 0.95,
    desk: 0.76,
    officeChair: 0.96,
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
    artwork: 0.8,
    // Utility & Laundry
    washer: 0.86,
    dryer: 0.86,
    laundrySink: 0.88,
    ironingBoard: 0.85,
    // Garage
    car: 1.45,
    workbench: 0.90,
    toolCabinet: 1.05,
    garageShelving: 1.95,
    bicycle: 1.05,
    // Outdoor
    patioTable: 0.74,
    patioChair: 0.82,
    sunLounger: 0.42,
    parasol: 2.35,
    bbq: 1.10,
    planterBox: 0.48,
  };
  FC.FURNITURE_HEIGHTS = FURNITURE_HEIGHTS;

  /* ------------------------------------------------------------------ */
  /* Furniture Placement & Collision Engine                             */
  /* ------------------------------------------------------------------ */

  FC.ITEM_RULES = {
    // Corner items
    shower: { archetype: 'corner', minWallDist: 0.04, blocksWindow: 'always' },
    bathtub: { archetype: 'corner-or-wall', minWallDist: 0.04, blocksWindow: 'tall-only' },
    toilet: { archetype: 'wall-perimeter', tuckCorner: true, blocksWindow: 'always' },
    plant: { archetype: 'corner', blocksWindow: 'never', decor: true },
    floorLamp: { archetype: 'corner-or-relative', blocksWindow: 'never', decor: true },
    sectionalSofa: { archetype: 'corner-or-center', faceWall: true, blocksWindow: 'never' },

    // Perimeter wall items
    wardrobe: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    dresser: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    bookshelf: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    tvConsole: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    sideboard: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    vanity: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    workbench: { archetype: 'wall-perimeter', minWallDist: 0.03, blocksWindow: 'always' },
    toolCabinet: { archetype: 'wall-perimeter', minWallDist: 0.03, blocksWindow: 'always' },
    garageShelving: { archetype: 'wall-perimeter', minWallDist: 0.03, blocksWindow: 'always' },
    washer: { archetype: 'wall-perimeter', minWallDist: 0.03, blocksWindow: 'always' },
    dryer: { archetype: 'relative-adjacent', parentKind: 'washer' },
    ovenRange: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    dishwasher: { archetype: 'relative-adjacent', parentKind: 'counter' },
    counter: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'never' },
    desk: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'low-permitted' },
    fridge: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    fireplace: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },
    console: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'low-permitted' },
    shelf: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'always' },

    // Head-to-wall items
    bed: { archetype: 'head-to-wall', headMargin: 0.04, blocksWindow: 'head-only' },
    singleBed: { archetype: 'head-to-wall', headMargin: 0.04, blocksWindow: 'head-only' },
    crib: { archetype: 'wall-perimeter', minWallDist: 0.04, blocksWindow: 'always' },
    car: { archetype: 'parking-bay', minDrivewayW: 2.4, minDrivewayD: 4.2 },

    // Floating island & social grouping
    armchair: { archetype: 'relative-angle', parentKind: 'sofa', blocksWindow: 'never' },
    officeChair: { archetype: 'relative-tuck', parentKind: 'desk', blocksWindow: 'never' },
    diningTable: { archetype: 'floating-zone', clearance: 0.8 },
    coffeeTable: { archetype: 'relative-front', parentKind: 'sofa', dist: 0.4 },
    patioTable: { archetype: 'floating-zone', clearance: 0.7 },
    patioChair: { archetype: 'relative-tuck', parentKind: 'patioTable', blocksWindow: 'never' },
    sunLounger: { archetype: 'floating-or-wall', clearance: 0.5 },
    parasol: { archetype: 'relative-adjacent', parentKind: 'patioTable', blocksWindow: 'never' },
    bbq: { archetype: 'wall-perimeter', outdoor: true },
    planterBox: { archetype: 'perimeter-edge', outdoor: true },
    bicycle: { archetype: 'wall-perimeter', minWallDist: 0.04, blocksWindow: 'never' },
    laundrySink: { archetype: 'wall-perimeter', minWallDist: 0.02, blocksWindow: 'never' },
    ironingBoard: { archetype: 'wall-perimeter', minWallDist: 0.04, blocksWindow: 'never' },
    island: { archetype: 'floating-zone', clearance: 0.9 },

    // Elevated wall mounts
    rangeHood: { archetype: 'relative-stacked', parentKind: 'ovenRange', elev: 1.55 },
    mirrorCabinet: { archetype: 'relative-stacked', parentKind: 'vanity', elev: 1.35 },
    towelRack: { archetype: 'wall-perimeter', elev: 0.80 },
    microwave: { archetype: 'relative-stacked', parentKind: 'counter', elev: 0.92 },
    upperCabinets: { archetype: 'wall-perimeter', elev: 1.50, blocksWindow: 'always' },
    fullMirror: { archetype: 'wall-perimeter', elev: 0.15, blocksWindow: 'always' },
    artwork: { archetype: 'wall-perimeter', elev: 1.35, blocksWindow: 'always' }
  };

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
    if (!item) return false;
    return item.kind === 'rug' || item.kind === 'bathMat' || item.kind === 'pendant';
  };

  FC.itemsOverlap = function (itemA, itemB, margin) {
    if (!itemA || !itemB) return false;

    // Floor coverings (rugs, bath mats): other furniture stands on top of them
    const isFloorCoveringA = itemA.kind === 'rug' || itemA.kind === 'bathMat';
    const isFloorCoveringB = itemB.kind === 'rug' || itemB.kind === 'bathMat';
    if (isFloorCoveringA || isFloorCoveringB) {
      if (itemA.kind === itemB.kind) {
        const cornersA = FC.itemCorners(itemA, margin || 0.02);
        const cornersB = FC.itemCorners(itemB, margin || 0.02);
        return FC.polygonsIntersect(cornersA, cornersB);
      }
      return false;
    }

    // Ceiling fixtures (pendants) hang from ceiling and don't collide with floor/wall items
    if (itemA.kind === 'pendant' || itemB.kind === 'pendant') {
      if (itemA.kind === itemB.kind) {
        return Math.hypot(itemA.x - itemB.x, itemA.y - itemB.y) < ((itemA.w + itemB.w) / 2);
      }
      return false;
    }

    // Look up elevations and heights if not explicitly provided
    const ruleA = (FC.ITEM_RULES && FC.ITEM_RULES[itemA.kind]) || {};
    const ruleB = (FC.ITEM_RULES && FC.ITEM_RULES[itemB.kind]) || {};
    const defA = (FC.furnitureCatalog && FC.furnitureCatalog[itemA.kind]) || {};
    const defB = (FC.furnitureCatalog && FC.furnitureCatalog[itemB.kind]) || {};

    const elevA = itemA.elev != null ? itemA.elev : (ruleA.elev != null ? ruleA.elev : (defA.elev != null ? defA.elev : 0));
    const elevB = itemB.elev != null ? itemB.elev : (ruleB.elev != null ? ruleB.elev : (defB.elev != null ? defB.elev : 0));
    const hA = itemA.h != null ? itemA.h : (defA.h != null ? defA.h : (FC.FURNITURE_HEIGHTS && FC.FURNITURE_HEIGHTS[itemA.kind]) || 0.6);
    const hB = itemB.h != null ? itemB.h : (defB.h != null ? defB.h : (FC.FURNITURE_HEIGHTS && FC.FURNITURE_HEIGHTS[itemB.kind]) || 0.6);

    // Wall accessories (artwork, fullMirror, mirrorCabinet, towelRack):
    // They share wall space and must NEVER overlap each other on the wall
    const isWallDecorA = itemA.kind === 'artwork' || itemA.kind === 'fullMirror' || itemA.kind === 'mirrorCabinet' || itemA.kind === 'towelRack';
    const isWallDecorB = itemB.kind === 'artwork' || itemB.kind === 'fullMirror' || itemB.kind === 'mirrorCabinet' || itemB.kind === 'towelRack';
    if (isWallDecorA && isWallDecorB) {
      const cornersA = FC.itemCorners(itemA, margin || 0.08);
      const cornersB = FC.itemCorners(itemB, margin || 0.08);
      return FC.polygonsIntersect(cornersA, cornersB);
    }

    // Full mirror is a full-height mirror extending to near floor level:
    // It must NEVER overlap floor furniture (bed, sofa, desk, wardrobe, etc.)
    if (
      (itemA.kind === 'fullMirror' && (itemB.kind === 'bed' || itemB.kind === 'singleBed' || itemB.kind === 'crib')) ||
      (itemB.kind === 'fullMirror' && (itemA.kind === 'bed' || itemA.kind === 'singleBed' || itemA.kind === 'crib'))
    ) {
      const cornersA = FC.itemCorners(itemA, margin || 0.15);
      const cornersB = FC.itemCorners(itemB, margin || 0.15);
      return FC.polygonsIntersect(cornersA, cornersB);
    }

    // Vertical bounding box clearance check
    if (elevA + hA <= elevB + 0.04 || elevB + hB <= elevA + 0.04) {
      return false;
    }

    // Allowed paired / tucked items
    if (
      (itemA.kind === 'chair' && (itemB.kind === 'diningTable' || itemB.kind === 'desk')) ||
      (itemB.kind === 'chair' && (itemA.kind === 'diningTable' || itemA.kind === 'desk')) ||
      (itemA.kind === 'patioChair' && itemB.kind === 'patioTable') ||
      (itemB.kind === 'patioChair' && itemA.kind === 'patioTable') ||
      (itemA.kind === 'officeChair' && itemB.kind === 'desk') ||
      (itemB.kind === 'officeChair' && itemA.kind === 'desk')
    ) {
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

  FC.findPrimaryZone = function (poly, bounds, wallSegments, otherRooms) {
    const b = bounds || FC.polygonBounds(poly);
    const area = Math.abs(FC.polygonArea(poly));
    const bArea = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (bArea > 0 && area / bArea > 0.88 && (!otherRooms || !otherRooms.length)) {
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

            const cx = (x0 + x1) / 2;
            const cy = (y0 + y1) / 2;
            if (otherRooms && otherRooms.length) {
              let inOther = false;
              for (let r = 0; r < otherRooms.length; r++) {
                if (FC.pointInPolygon({ x: cx, y: cy }, otherRooms[r].polygon)) {
                  inOther = true;
                  break;
                }
              }
              if (inOther) continue;
            }

            const corners = [
              { x: x0, y: y0 }, { x: x1, y: y0 },
              { x: x1, y: y1 }, { x: x0, y: y1 },
              { x: cx, y: cy }
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
                if (ok && wallSegments && wallSegments.length) {
                  for (let s = 0; s < wallSegments.length; s++) {
                    if (FC.segmentIntersection(cA, cB, wallSegments[s].a, wallSegments[s].b)) {
                      ok = false;
                      break;
                    }
                  }
                }
              }
            }
            if (ok) {
              best = { x0, y0, x1, y1, area: rArea, w: x1 - x0, d: y1 - y0, cx, cy };
            }
          }
        }
      }
    }
    return best.area > 0 ? best : b;
  };

  FC.itemBlocksCirculation = function (item, doorZones, roomPoly) {
    if (FC.isNonSolid(item) || item.elev > 0.5) return false;
    const rule = FC.ITEM_RULES[item.kind];
    // Perimeter and corner wall items hug walls and don't block center corridors
    if (rule && (rule.archetype === 'wall-perimeter' || rule.archetype === 'corner' || rule.archetype === 'relative-stacked')) {
      return false;
    }
    const itemPt = { x: item.x, y: item.y };
    const clearance = (rule && rule.clearance) || 0.65;
    for (let i = 0; i < doorZones.length; i++) {
      for (let j = i + 1; j < doorZones.length; j++) {
        const d1 = doorZones[i];
        const d2 = doorZones[j];
        const h = FC.pointSegment(itemPt, d1, d2);
        if (h.dist < clearance) {
          return true;
        }
      }
    }
    return false;
  };

  FC.canPlaceFurniture = function (plan, room, item, placedItems, doorZones, wallSegments) {
    if (room && room.polygon && !FC.itemInPolygon(item, room.polygon, 0.02)) {
      return false;
    }
    if (plan && plan.rooms && room) {
      for (let r = 0; r < plan.rooms.length; r++) {
        const other = plan.rooms[r];
        if (other.id !== room.id && (other.area || 0) < (room.area || 0) && other.polygon && other.polygon.length >= 3) {
          if (FC.pointInPolygon({ x: item.x, y: item.y }, other.polygon)) {
            return false;
          }
        }
      }
    }
    if (doorZones && FC.itemBlocksDoor(item, doorZones)) {
      return false;
    }
    if (doorZones && doorZones.length >= 2 && room && room.polygon && FC.itemBlocksCirculation(item, doorZones, room.polygon)) {
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

  FC.findCornerPlacement = function (room, itemKind, itemW, itemD, placedItems, doorZones, roomWins, segs) {
    const corners = FC.findRoomCorners(room);
    if (!corners || !corners.length) return null;
    for (let c = 0; c < corners.length; c++) {
      const cr = corners[c];
      // Orientation 1: along u1
      const cx1 = cr.pt.x + cr.u1.x * (itemW / 2 + 0.04) + cr.u2.x * (itemD / 2 + 0.04);
      const cy1 = cr.pt.y + cr.u1.y * (itemW / 2 + 0.04) + cr.u2.y * (itemD / 2 + 0.04);
      const rot1 = Math.atan2(cr.u1.y, cr.u1.x);
      const cand1 = { kind: itemKind, x: FC.round(cx1, 3), y: FC.round(cy1, 3), w: itemW, d: itemD, rot: FC.round(rot1, 3) };
      if ((!roomWins || !roomWins.length || !FC.itemBlocksWindow(cand1, roomWins, 0.08)) &&
          FC.canPlaceFurniture(null, room, cand1, placedItems, doorZones, segs)) {
        return cand1;
      }
      // Orientation 2: along u2
      const cx2 = cr.pt.x + cr.u2.x * (itemW / 2 + 0.04) + cr.u1.x * (itemD / 2 + 0.04);
      const cy2 = cr.pt.y + cr.u2.y * (itemW / 2 + 0.04) + cr.u1.y * (itemD / 2 + 0.04);
      const rot2 = Math.atan2(cr.u2.y, cr.u2.x);
      const cand2 = { kind: itemKind, x: FC.round(cx2, 3), y: FC.round(cy2, 3), w: itemW, d: itemD, rot: FC.round(rot2, 3) };
      if ((!roomWins || !roomWins.length || !FC.itemBlocksWindow(cand2, roomWins, 0.08)) &&
          FC.canPlaceFurniture(null, room, cand2, placedItems, doorZones, segs)) {
        return cand2;
      }
    }
    return null;
  };

  FC.findWallSegmentsForRoom = function (room, wallSegs) {
    if (!room || !room.polygon || !wallSegs) return [];
    const poly = room.polygon;
    const n = poly.length;
    const matched = [];
    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      const len = FC.dist(p1, p2);
      if (len < 0.5) continue;
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      for (let s = 0; s < wallSegs.length; s++) {
        const seg = wallSegs[s];
        const h1 = FC.pointSegment(p1, seg.a, seg.b);
        const h2 = FC.pointSegment(p2, seg.a, seg.b);
        const hm = FC.pointSegment(mid, seg.a, seg.b);
        if (h1.dist < 0.15 && h2.dist < 0.15 && hm.dist < 0.15) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          let nx = -dy / len;
          let ny = dx / len;
          const testPt = { x: mid.x + nx * 0.15, y: mid.y + ny * 0.15 };
          if (!FC.pointInPolygon(testPt, room.polygon)) {
            nx = -nx;
            ny = -ny;
          }
          matched.push({
            p1, p2, len, mid, nx, ny,
            rot: Math.atan2(ny, nx) - Math.PI / 2,
            seg
          });
          break;
        }
      }
    }
    return matched;
  };

  FC.findWallPlacement = function (plan, room, segs, itemKind, itemW, itemD, placedItems, doorZones, filterFn, roomWindows) {
    const walls = FC.findWallSegmentsForRoom(room, segs);
    walls.sort((a, b) => b.len - a.len);

    const rule = (FC.ITEM_RULES && FC.ITEM_RULES[itemKind]) || {};
    const isWindowSensitive = rule.blocksWindow === 'always' || (FURNITURE_HEIGHTS[itemKind] || 0.6) > 1.05;
    const roomWins = isWindowSensitive ? (roomWindows || FC.findRoomWindows(room, plan, segs)) : null;

    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (filterFn && !filterFn(w)) continue;
      if (w.len < itemW + 0.1) continue;

      const uX = (w.p2.x - w.p1.x) / w.len;
      const uY = (w.p2.y - w.p1.y) / w.len;
      const maxOffset = (w.len - itemW) / 2;
      const offsets = [0];
      if (maxOffset >= 0.25) offsets.push(0.25, -0.25);
      if (maxOffset >= 0.55) offsets.push(0.55, -0.55);

      for (let o = 0; o < offsets.length; o++) {
        const off = offsets[o];
        const cx = w.mid.x + uX * off + w.nx * (itemD / 2 + 0.04);
        const cy = w.mid.y + uY * off + w.ny * (itemD / 2 + 0.04);
        const def = (FC.furnitureCatalog && FC.furnitureCatalog[itemKind]) || {};
        const elev = rule.elev != null ? rule.elev : (def.elev != null ? def.elev : 0);
        const h = def.h || (FC.FURNITURE_HEIGHTS && FC.FURNITURE_HEIGHTS[itemKind]) || 0.6;
        const item = {
          kind: itemKind,
          x: FC.round(cx, 3),
          y: FC.round(cy, 3),
          w: FC.round(itemW, 3),
          d: FC.round(itemD, 3),
          rot: FC.round(w.rot, 3),
          elev,
          h,
          nx: w.nx,
          ny: w.ny,
          wall: w,
        };

        if (roomWins && roomWins.length && FC.itemBlocksWindow(item, roomWins)) {
          continue;
        }

        if (FC.canPlaceFurniture(plan, room, item, placedItems, doorZones, segs)) {
          return item;
        }
      }
    }
    return null;
  };

  FC.findRoomWindows = function (room, plan, wallSegments) {
    if (!room || !room.polygon || !plan.openings) return [];
    const segs = wallSegments || FC.getSegments(plan);
    const windows = plan.openings.filter((o) => o.kind === 'window');
    const matched = [];
    const n = room.polygon.length;
    windows.forEach((w) => {
      const pl = FC.openingPlacement(plan, w, segs);
      if (!pl) return;
      const p = { x: pl.x, y: pl.y };
      for (let i = 0; i < n; i++) {
        const p1 = room.polygon[i];
        const p2 = room.polygon[(i + 1) % n];
        if (FC.pointSegment(p, p1, p2).dist < 0.25) {
          matched.push({
            window: w,
            x: pl.x,
            y: pl.y,
            width: pl.width || 0.9,
            wallSeg: pl.wallSeg,
          });
          break;
        }
      }
    });
    return matched;
  };

  FC.findDoorZones = function (plan, wallSegments) {
    const segs = wallSegments || FC.getSegments(plan);
    const walkableOpenings = (plan.openings || []).filter((o) => o.kind === 'door' || o.kind === 'opening');
    const doorZones = [];
    walkableOpenings.forEach((d) => {
      const pl = FC.openingPlacement(plan, d, segs);
      if (pl) {
        let r = 0.8;
        if (d.kind === 'opening') {
          r = Math.max(0.75, (pl.width || 0.9) * 0.7);
        } else if (d.style === 'sliding' || d.style === 'bifold') {
          r = 0.65;
        } else {
          r = Math.min(0.85, Math.max(0.65, (pl.width || 0.8) * 0.85));
        }
        doorZones.push({ x: pl.x, y: pl.y, radius: r, door: d });
      }
    });
    return doorZones;
  };

  FC.collectAllWalls = function (plan) {
    return FC.getSegments(plan);
  };

  FC.bedBlocksWindow = function (bed, roomWindows) {
    if (!roomWindows || !roomWindows.length) return false;
    const hDist = bed.d / 2;
    const hx = bed.x + hDist * Math.sin(bed.rot);
    const hy = bed.y - hDist * Math.cos(bed.rot);
    const hw = bed.w / 2;
    const dx = Math.cos(bed.rot) * hw;
    const dy = Math.sin(bed.rot) * hw;
    const hA = { x: hx - dx, y: hy - dy };
    const hB = { x: hx + dx, y: hy + dy };

    for (let i = 0; i < roomWindows.length; i++) {
      const wz = roomWindows[i];
      const wPt = { x: wz.x, y: wz.y };
      const h = FC.pointSegment(wPt, hA, hB);
      if (h.dist < (wz.width || 0.9) / 2 + 0.35) return true;
      if (Math.hypot(bed.x - wz.x, bed.y - wz.y) < (wz.width || 0.9) / 2 + 0.6) return true;
    }
    return false;
  };

  FC.itemBlocksWindow = function (item, roomWindows, margin) {
    if (!roomWindows || !roomWindows.length) return false;
    const m = margin == null ? 0.2 : margin;
    const itemHalfDiag = Math.hypot(item.w, item.d) / 2;

    for (let i = 0; i < roomWindows.length; i++) {
      const wz = roomWindows[i];
      const winHalfW = (wz.width || 0.9) / 2;
      const d = Math.hypot(item.x - wz.x, item.y - wz.y);
      if (d > itemHalfDiag + winHalfW + m + 0.3) continue;

      const cos = Math.cos(item.rot || 0);
      const sin = Math.sin(item.rot || 0);
      const dx = wz.x - item.x;
      const dy = wz.y - item.y;
      // Local coordinates (lx along item width / wall direction, ly along item depth)
      const lx = Math.abs(dx * cos + dy * sin);
      const ly = Math.abs(-dx * sin + dy * cos);

      if (lx < (item.w / 2 + winHalfW + m) && ly < (item.d / 2 + 0.45)) {
        return true;
      }
    }
    return false;
  };

  FC.findRoomCorners = function (room) {
    if (!room || !room.polygon || room.polygon.length < 3) return [];
    const poly = room.polygon;
    const n = poly.length;
    const corners = [];
    for (let i = 0; i < n; i++) {
      const prev = poly[(i - 1 + n) % n];
      const curr = poly[i];
      const next = poly[(i + 1) % n];
      const d1x = prev.x - curr.x, d1y = prev.y - curr.y;
      const d2x = next.x - curr.x, d2y = next.y - curr.y;
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      if (l1 < 0.4 || l2 < 0.4) continue;
      const u1x = d1x / l1, u1y = d1y / l1;
      const u2x = d2x / l2, u2y = d2y / l2;
      const bisectX = u1x + u2x, bisectY = u1y + u2y;
      const bl = Math.hypot(bisectX, bisectY);
      if (bl < 0.1) continue;
      const inX = bisectX / bl, inY = bisectY / bl;
      const testPt = { x: curr.x + inX * 0.2, y: curr.y + inY * 0.2 };
      if (FC.pointInPolygon(testPt, poly)) {
        corners.push({
          pt: curr,
          u1: { x: u1x, y: u1y, len: l1 },
          u2: { x: u2x, y: u2y, len: l2 },
          inDir: { x: inX, y: inY },
        });
      }
    }
    return corners;
  };

  FC.furnishPlan = function (plan, rooms) {
    if (!plan.furnished) return [];
    const density = plan.density == null ? 1 : plan.density;
    const items = [];
    let count = 0;
    const globalVar = parseInt(plan.layoutVariation, 10) || 0;

    const wallSegments = FC.getSegments(plan);
    const doorZones = FC.findDoorZones(plan, wallSegments);

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
      const otherRooms = (plan.rooms || []).filter((r) => r.id !== room.id);
      const zone = FC.findPrimaryZone(room.polygon, room.bounds, wallSegments, otherRooms);
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
        const roomWins = FC.findRoomWindows(room, plan, wallSegments);
        const walls = FC.findWallSegmentsForRoom(room, wallSegments);
        walls.sort((a, b) => b.len - a.len);

        const bedW = clamp(W * 0.44, 1.3, 1.9);
        const bedD = clamp(D * 0.48, 1.85, 2.1);
        const preferCorner = variant === 1 || room.area < 14;

        let placedBed = null;
        let bedWall = null;
        let isCorner = false;

        // Build candidate list across available walls
        const bedCandidates = [];
        walls.forEach((w) => {
          if (w.len < bedW + 0.2) return;
          const uX = (w.p2.x - w.p1.x) / w.len;
          const uY = (w.p2.y - w.p1.y) / w.len;
          const rot = Math.atan2(w.ny, w.nx) - Math.PI / 2;

          const midX = w.mid.x + w.nx * (bedD / 2 + 0.08);
          const midY = w.mid.y + w.ny * (bedD / 2 + 0.08);
          const centerCand = {
            isCorner: false, wall: w, rot, uX, uY,
            x: midX, y: midY, w: bedW, d: bedD,
            ns: [
              { x: midX - uX * (bedW / 2 + 0.3) + w.nx * 0.22, y: midY - uY * (bedW / 2 + 0.3) + w.ny * 0.22 },
              { x: midX + uX * (bedW / 2 + 0.3) + w.nx * 0.22, y: midY + uY * (bedW / 2 + 0.3) + w.ny * 0.22 }
            ]
          };

          const cornerCands = [];
          if (w.len >= bedW + 0.8) {
            // Tucked near p1
            const c1X = w.p1.x + uX * (bedW / 2 + 0.15) + w.nx * (bedD / 2 + 0.08);
            const c1Y = w.p1.y + uY * (bedW / 2 + 0.15) + w.ny * (bedD / 2 + 0.08);
            cornerCands.push({
              isCorner: true, wall: w, rot, uX, uY,
              x: c1X, y: c1Y, w: bedW, d: bedD,
              ns: [
                { x: c1X + uX * (bedW / 2 + 0.3) + w.nx * 0.22, y: c1Y + uY * (bedW / 2 + 0.3) + w.ny * 0.22 }
              ]
            });
            // Tucked near p2
            const c2X = w.p2.x - uX * (bedW / 2 + 0.15) + w.nx * (bedD / 2 + 0.08);
            const c2Y = w.p2.y - uY * (bedW / 2 + 0.15) + w.ny * (bedD / 2 + 0.08);
            cornerCands.push({
              isCorner: true, wall: w, rot, uX, uY,
              x: c2X, y: c2Y, w: bedW, d: bedD,
              ns: [
                { x: c2X - uX * (bedW / 2 + 0.3) + w.nx * 0.22, y: c2Y - uY * (bedW / 2 + 0.3) + w.ny * 0.22 }
              ]
            });
          }

          if (preferCorner) {
            bedCandidates.push(...cornerCands, centerCand);
          } else {
            bedCandidates.push(centerCand, ...cornerCands);
          }
        });

        // Fallback to zone center if no wall segment was long enough
        if (!bedCandidates.length) {
          bedCandidates.push({
            isCorner: false, wall: null, rot: 0, uX: 1, uY: 0,
            x: cx, y: y0 + bedD / 2 + 0.1, w: bedW, d: bedD,
            ns: [
              { x: cx - bedW / 2 - 0.28, y: y0 + 0.32 },
              { x: cx + bedW / 2 + 0.28, y: y0 + 0.32 }
            ]
          });
        }

        // Try candidates that don't block windows first
        for (let pass = 0; pass < 2 && !placedBed; pass++) {
          for (let i = 0; i < bedCandidates.length && !placedBed; i++) {
            const cand = bedCandidates[i];
            if (pass === 0 && FC.bedBlocksWindow(cand, roomWins)) continue;
            placedBed = add(room, 'bed', cand.x, cand.y, cand.w, cand.d, cand.rot, { mat: 'wood' });
            if (placedBed) {
              bedWall = cand.wall;
              isCorner = cand.isCorner;
              cand.ns.forEach((nPos) => {
                add(room, 'nightstand', nPos.x, nPos.y, 0.44, 0.4, cand.rot, { mat: 'wood' });
              });
              break;
            }
          }
        }

        // Wardrobe
        const wPlaced = FC.findWallPlacement(plan, room, wallSegments, 'wardrobe', Math.min(2.0, W * 0.48), 0.6, items, doorZones, (w) => w !== bedWall);
        if (wPlaced) {
          add(room, 'wardrobe', wPlaced.x, wPlaced.y, wPlaced.w, wPlaced.d, wPlaced.rot, { mat: 'cabinet' });
        }

        // Rug
        if (placedBed) {
          const rugW = Math.min(2.4, bedW + 0.6);
          const rugD = Math.min(2.0, bedD * 0.7);
          const rOff = bedWall ? bedWall.nx * 0.4 : 0;
          const rOffY = bedWall ? bedWall.ny * 0.4 : 0.4;
          add(room, 'rug', placedBed.x + rOff, placedBed.y + rOffY, rugW, rugD, placedBed.rot, { mat: 'rug', decor: true });
        }

        // Study Desk with Computer / Monitor & Ergonomic Chair
        if (room.area >= 12) {
          const dPlaced = FC.findWallPlacement(plan, room, wallSegments, 'desk', Math.min(1.4, Math.max(1.0, W * 0.35)), 0.6, items, doorZones, (w) => w !== bedWall);
          if (dPlaced) {
            const desk = add(room, 'desk', dPlaced.x, dPlaced.y, dPlaced.w, dPlaced.d, dPlaced.rot, { mat: 'wood' });
            if (desk) {
              const nx = Math.round(Math.cos(dPlaced.rot + Math.PI / 2) * 1000) / 1000;
              const ny = Math.round(Math.sin(dPlaced.rot + Math.PI / 2) * 1000) / 1000;
              add(room, 'monitor', desk.x - nx * 0.15, desk.y - ny * 0.15, 0.55, 0.12, dPlaced.rot, { mat: 'metal', elev: 0.76, h: 0.4 });
              add(room, 'officeChair', desk.x + nx * 0.55, desk.y + ny * 0.55, 0.58, 0.58, dPlaced.rot + Math.PI, { mat: 'fabric' });
            }
          }
        }

        // Dresser (Chest of Drawers)
        if (room.area >= 10) {
          const drPlaced = FC.findWallPlacement(plan, room, wallSegments, 'dresser', Math.min(1.3, W * 0.4), 0.48, items, doorZones, (w) => w !== bedWall);
          if (drPlaced) {
            add(room, 'dresser', drPlaced.x, drPlaced.y, drPlaced.w, drPlaced.d, drPlaced.rot, { mat: 'wood' });
          }
        }

        // Full-length Mirror
        if (room.area >= 12) {
          const fmPlaced = FC.findWallPlacement(plan, room, wallSegments, 'fullMirror', 0.55, 0.1, items, doorZones, (w) => w !== bedWall);
          if (fmPlaced) {
            add(room, 'fullMirror', fmPlaced.x, fmPlaced.y, fmPlaced.w, fmPlaced.d, fmPlaced.rot, { elev: 0.15, h: 1.65, mat: 'metal', decor: true });
          }
        }

        // Bookshelf or Wall Shelving
        if (room.area >= 18) {
          const bsPlaced = FC.findWallPlacement(plan, room, wallSegments, 'bookshelf', 1.1, 0.35, items, doorZones, (w) => w !== bedWall);
          if (bsPlaced) {
            add(room, 'bookshelf', bsPlaced.x, bsPlaced.y, bsPlaced.w, bsPlaced.d, bsPlaced.rot, { mat: 'wood' });
          }
        }

        // Artwork on Wall
        if (placedBed && bedWall) {
          const hDist = bedD / 2;
          const hx = placedBed.x - bedWall.nx * (hDist - 0.03);
          const hy = placedBed.y - bedWall.ny * (hDist - 0.03);
          const testBedArt = { x: hx, y: hy, w: 1.0, d: 0.04, rot: placedBed.rot };
          if (!FC.bedBlocksWindow(testBedArt, roomWins)) {
            add(room, 'artwork', hx, hy, 1.0, 0.04, placedBed.rot, { elev: 1.35, h: 0.75, decor: true });
          } else {
            const artPlaced = FC.findWallPlacement(plan, room, wallSegments, 'artwork', 1.0, 0.04, items, doorZones);
            if (artPlaced) {
              add(room, 'artwork', artPlaced.x, artPlaced.y, artPlaced.w, artPlaced.d, artPlaced.rot, { elev: 1.35, h: 0.75, decor: true });
            }
          }
        }
      } else if (type === 'bathroom' || type === 'bath') {
        const roomWins = FC.findRoomWindows(room, plan, wallSegments);
        const corners = FC.findRoomCorners(room);
        const walls = FC.findWallSegmentsForRoom(room, wallSegments);
        walls.sort((a, b) => b.len - a.len);

        // 1. Shower or Bathtub in corner
        let showerPlaced = null;
        if (room.area >= 2.4) {
          const useTub = room.area >= 3.8;
          if (useTub) {
            const tubW = 1.6;
            const tubD = 0.75;
            const tubCand = FC.findCornerPlacement(room, 'bathtub', tubW, tubD, items, doorZones, roomWins, wallSegments);
            if (tubCand) {
              showerPlaced = add(room, 'bathtub', tubCand.x, tubCand.y, tubW, tubD, tubCand.rot, { mat: 'stone' });
            }
          }
          if (!showerPlaced) {
            const shW = Math.min(0.95, Math.max(0.78, Math.sqrt(room.area) * 0.38));
            const shCand = FC.findCornerPlacement(room, 'shower', shW, shW, items, doorZones, roomWins, wallSegments);
            if (shCand) {
              showerPlaced = add(room, 'shower', shCand.x, shCand.y, shW, shW, shCand.rot, { mat: 'stone' });
            }
          }
        }

        // 2. Vanity aligned with wall, plus Medicine Mirror Cabinet above
        const vanityW = Math.min(1.0, Math.max(0.55, Math.sqrt(room.area) * 0.32));
        const vPlaced = FC.findWallPlacement(plan, room, wallSegments, 'vanity', vanityW, 0.44, items, doorZones, null, roomWins);
        if (vPlaced) {
          add(room, 'vanity', vPlaced.x, vPlaced.y, vPlaced.w, vPlaced.d, vPlaced.rot, { mat: 'cabinet' });
          add(room, 'mirrorCabinet', vPlaced.x, vPlaced.y, Math.min(0.8, vPlaced.w * 0.85), 0.12, vPlaced.rot, { elev: 1.35, h: 0.75, mat: 'cabinet', decor: true });
        }

        // 3. Toilet tucked into corner / wall-end
        const toiletW = 0.42;
        const toiletD = 0.62;
        let toiletPlaced = null;

        for (let w = 0; w < walls.length && !toiletPlaced; w++) {
          const wall = walls[w];
          if (wall.len < toiletW + 0.15) continue;
          const uX = (wall.p2.x - wall.p1.x) / wall.len;
          const uY = (wall.p2.y - wall.p1.y) / wall.len;
          const rot = Math.atan2(wall.ny, wall.nx) - Math.PI / 2;

          // Corner end 1
          const c1X = wall.p1.x + uX * (toiletW / 2 + 0.1) + wall.nx * (toiletD / 2 + 0.04);
          const c1Y = wall.p1.y + uY * (toiletW / 2 + 0.1) + wall.ny * (toiletD / 2 + 0.04);
          const tCand1 = { kind: 'toilet', x: c1X, y: c1Y, w: toiletW, d: toiletD, rot };
          if (!roomWins || !roomWins.length || !FC.itemBlocksWindow(tCand1, roomWins, 0.1)) {
            toiletPlaced = add(room, 'toilet', c1X, c1Y, toiletW, toiletD, rot, { mat: 'stone' });
            if (toiletPlaced) break;
          }

          // Corner end 2
          const c2X = wall.p2.x - uX * (toiletW / 2 + 0.1) + wall.nx * (toiletD / 2 + 0.04);
          const c2Y = wall.p2.y - uY * (toiletW / 2 + 0.1) + wall.ny * (toiletD / 2 + 0.04);
          const tCand2 = { kind: 'toilet', x: c2X, y: c2Y, w: toiletW, d: toiletD, rot };
          if (!roomWins || !roomWins.length || !FC.itemBlocksWindow(tCand2, roomWins, 0.1)) {
            toiletPlaced = add(room, 'toilet', c2X, c2Y, toiletW, toiletD, rot, { mat: 'stone' });
            if (toiletPlaced) break;
          }

          // Mid wall fallback
          const midX = wall.mid.x + wall.nx * (toiletD / 2 + 0.04);
          const midY = wall.mid.y + wall.ny * (toiletD / 2 + 0.04);
          const tCandMid = { kind: 'toilet', x: midX, y: midY, w: toiletW, d: toiletD, rot };
          if (!roomWins || !roomWins.length || !FC.itemBlocksWindow(tCandMid, roomWins, 0.1)) {
            toiletPlaced = add(room, 'toilet', midX, midY, toiletW, toiletD, rot, { mat: 'stone' });
            if (toiletPlaced) break;
          }
        }

        // 4. Towel Rack
        const trPlaced = FC.findWallPlacement(plan, room, wallSegments, 'towelRack', 0.55, 0.12, items, doorZones);
        if (trPlaced) {
          add(room, 'towelRack', trPlaced.x, trPlaced.y, trPlaced.w, trPlaced.d, trPlaced.rot, { elev: 0.8, h: 0.95, mat: 'metal', decor: true });
        }

        // 5. Bath mat
        const b = room.bounds || FC.polygonBounds(room.polygon);
        add(room, 'bathMat', b.cx, b.cy, Math.min(0.8, W * 0.5), 0.45, 0, { mat: 'linen', decor: true });
      } else if (type === 'hallway') {
        const long = D > W;
        if (long) {
          add(room, 'rug', cx, cy, Math.min(0.85, W - 0.3), Math.min(2.0, D - 0.6), 0, { mat: 'rug' });
          const c1 = FC.findWallPlacement(plan, room, wallSegments, 'console', Math.min(1.0, D * 0.5), 0.3, items, doorZones);
          if (c1) {
            add(room, 'console', c1.x, c1.y, c1.w, c1.d, c1.rot, { mat: 'wood', decor: true });
            add(room, 'artwork', c1.x, c1.y, Math.min(0.9, c1.w), 0.04, c1.rot, { elev: 1.35, h: 0.75, decor: true });
          }
        } else {
          add(room, 'rug', cx, cy, Math.min(2.0, W - 0.6), Math.min(0.85, D - 0.3), 0, { mat: 'rug' });
          const c1 = FC.findWallPlacement(plan, room, wallSegments, 'console', Math.min(1.1, W * 0.5), 0.3, items, doorZones);
          if (c1) {
            add(room, 'console', c1.x, c1.y, c1.w, c1.d, c1.rot, { mat: 'wood', decor: true });
            add(room, 'artwork', c1.x, c1.y, Math.min(0.9, c1.w), 0.04, c1.rot, { elev: 1.35, h: 0.75, decor: true });
          }
        }
      } else if (type === 'kitchen') {
        // Main sink counter & upper wall cabinets
        const counter = add(room, 'counter', cx, y0 + 0.31, Math.max(1.0, W - 0.5), 0.6, 0, { mat: 'cabinet', variant: 'sink' });
        add(room, 'upperCabinets', cx, y0 + 0.19, Math.max(0.9, W - 1.0), 0.32, 0, { mat: 'cabinet', elev: 1.5, h: 0.7 });
        add(room, 'fridge', x0 + 0.4, y1 - 0.4, 0.75, 0.7, Math.PI, { mat: 'metal' });

        // Freestanding Cooking Range & Vent Hood
        const ovenPlaced = FC.findWallPlacement(plan, room, wallSegments, 'ovenRange', 0.75, 0.65, items, doorZones);
        if (ovenPlaced) {
          add(room, 'ovenRange', ovenPlaced.x, ovenPlaced.y, ovenPlaced.w, ovenPlaced.d, ovenPlaced.rot, { mat: 'metal' });
          add(room, 'rangeHood', ovenPlaced.x, ovenPlaced.y, ovenPlaced.w, 0.5, ovenPlaced.rot, { mat: 'metal', elev: 1.55, h: 0.65, decor: true });
        }

        // Dishwasher
        if (room.area >= 7.0) {
          const dwPlaced = FC.findWallPlacement(plan, room, wallSegments, 'dishwasher', 0.6, 0.6, items, doorZones);
          if (dwPlaced) add(room, 'dishwasher', dwPlaced.x, dwPlaced.y, dwPlaced.w, dwPlaced.d, dwPlaced.rot, { mat: 'metal' });
        }

        // Microwave on counter
        if (counter && counter.w >= 1.4) {
          add(room, 'microwave', counter.x - counter.w * 0.3, counter.y, 0.54, 0.38, counter.rot, { mat: 'metal', elev: 0.92, h: 0.34, decor: true });
        }

        // Prep Island
        if (W > 3.6 && D > 2.8) {
          add(room, 'island', cx, cy, 1.4, 0.75, 0, { mat: 'cabinet' });
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
        const sb = FC.findWallPlacement(plan, room, wallSegments, 'sideboard', Math.min(1.6, W * 0.5), 0.4, items, doorZones);
        if (sb) {
          add(room, 'sideboard', sb.x, sb.y, sb.w, sb.d, sb.rot, { mat: 'wood', decor: true });
          add(room, 'artwork', sb.x, sb.y, Math.min(1.2, sb.w), 0.04, sb.rot, { elev: 1.35, h: 0.75, decor: true });
        }
      } else if (type === 'office') {
        const dw = Math.min(1.6, W * 0.6);
        add(room, 'desk', cx, y0 + 0.38, dw, 0.65, 0, { mat: 'wood' });
        add(room, 'monitor', cx, y0 + 0.22, 0.6, 0.12, 0, { mat: 'metal', elev: 0.78, h: 0.4 });
        add(room, 'officeChair', cx, y0 + 0.95, 0.58, 0.58, Math.PI, { mat: 'fabric' });
        add(room, 'rug', cx, cy + 0.3, Math.min(2.1, W * 0.6), Math.min(1.5, D * 0.4), 0, { mat: 'rug', decor: true });
        const bs = FC.findWallPlacement(plan, room, wallSegments, 'bookshelf', Math.min(1.6, Math.max(0.9, W * 0.4)), 0.35, items, doorZones);
        if (bs) add(room, 'bookshelf', bs.x, bs.y, bs.w, bs.d, bs.rot, { mat: 'wood' });
      } else if (type === 'closet' || type === 'storage') {
        const shelfW = type === 'closet' ? Math.min(1.2, Math.max(0.8, W - 0.3)) : Math.min(1.8, Math.max(0.9, W - 0.4));
        const sPlaced = FC.findWallPlacement(plan, room, wallSegments, 'shelf', shelfW, 0.35, items, doorZones);
        if (sPlaced) add(room, 'shelf', sPlaced.x, sPlaced.y, sPlaced.w, sPlaced.d, sPlaced.rot, { mat: 'wood' });
        if (type === 'storage' && room.area > 3.0) {
          add(room, 'boxes', cx, cy, 0.45, 0.45, 0, { mat: 'wood', decor: true });
        }
      } else if (type === 'garage') {
        // Vehicle in parking bay
        if (W >= 2.4 && D >= 3.8) {
          const carRot = D >= W ? 0 : Math.PI / 2;
          add(room, 'car', cx, cy, 1.85, 4.4, carRot, { mat: 'metal' });
        }
        // Heavy workbench
        const wb = FC.findWallPlacement(plan, room, wallSegments, 'workbench', Math.min(1.8, Math.max(1.2, W * 0.5)), 0.65, items, doorZones);
        if (wb) add(room, 'workbench', wb.x, wb.y, wb.w, wb.d, wb.rot, { mat: 'wood' });
        // Tool cabinet
        const tc = FC.findWallPlacement(plan, room, wallSegments, 'toolCabinet', 0.85, 0.5, items, doorZones);
        if (tc) add(room, 'toolCabinet', tc.x, tc.y, tc.w, tc.d, tc.rot, { mat: 'metal' });
        // Garage metal shelving
        const sh = FC.findWallPlacement(plan, room, wallSegments, 'garageShelving', Math.min(1.6, W * 0.45), 0.5, items, doorZones);
        if (sh) add(room, 'garageShelving', sh.x, sh.y, sh.w, sh.d, sh.rot, { mat: 'metal' });
        // Bicycle
        if (room.area >= 14) {
          const bi = FC.findWallPlacement(plan, room, wallSegments, 'bicycle', 1.75, 0.45, items, doorZones);
          if (bi) add(room, 'bicycle', bi.x, bi.y, bi.w, bi.d, bi.rot, { mat: 'metal' });
        }
      } else if (type === 'utility') {
        // Laundry pair: washer and dryer
        const wPlaced = FC.findWallPlacement(plan, room, wallSegments, 'washer', 0.65, 0.65, items, doorZones);
        if (wPlaced) {
          add(room, 'washer', wPlaced.x, wPlaced.y, 0.62, 0.62, wPlaced.rot, { mat: 'metal' });
          const uX = Math.cos(wPlaced.rot);
          const uY = Math.sin(wPlaced.rot);
          add(room, 'dryer', wPlaced.x + uX * 0.66, wPlaced.y + uY * 0.66, 0.62, 0.62, wPlaced.rot, { mat: 'metal' }) ||
            add(room, 'dryer', wPlaced.x - uX * 0.66, wPlaced.y - uY * 0.66, 0.62, 0.62, wPlaced.rot, { mat: 'metal' });
        }
        // Deep laundry sink
        const ls = FC.findWallPlacement(plan, room, wallSegments, 'laundrySink', 0.65, 0.6, items, doorZones);
        if (ls) add(room, 'laundrySink', ls.x, ls.y, ls.w, ls.d, ls.rot, { mat: 'cabinet' });
        // Ironing board or shelving
        if (room.area >= 5.0) {
          const ib = FC.findWallPlacement(plan, room, wallSegments, 'ironingBoard', 1.25, 0.38, items, doorZones);
          if (ib) add(room, 'ironingBoard', ib.x, ib.y, ib.w, ib.d, ib.rot, { mat: 'fabric' });
        } else {
          add(room, 'shelf', cx, cy, Math.min(1.2, W * 0.6), 0.35, 0, { mat: 'metal' });
        }
      } else if (type === 'patio' || type === 'balcony') {
        const isBalcony = type === 'balcony';
        if (room.area >= 6.0 && !isBalcony) {
          // Patio dining setup
          const table = add(room, 'patioTable', cx, cy, 1.0, 1.0, 0, { mat: 'wood' });
          if (table) {
            add(room, 'patioChair', cx - 0.6, cy, 0.55, 0.55, Math.PI / 2, { mat: 'wood' });
            add(room, 'patioChair', cx + 0.6, cy, 0.55, 0.55, -Math.PI / 2, { mat: 'wood' });
            add(room, 'patioChair', cx, cy - 0.6, 0.55, 0.55, 0, { mat: 'wood' });
            add(room, 'patioChair', cx, cy + 0.6, 0.55, 0.55, Math.PI, { mat: 'wood' });
            if (room.area >= 10.0) {
              add(room, 'parasol', cx + 0.8, cy + 0.8, 2.2, 2.2, 0, { mat: 'fabric', decor: true });
            }
          }
          // BBQ Grill
          const bbq = FC.findWallPlacement(plan, room, wallSegments, 'bbq', 1.15, 0.6, items, doorZones);
          if (bbq) add(room, 'bbq', bbq.x, bbq.y, bbq.w, bbq.d, bbq.rot, { mat: 'metal' });
          // Planter box
          const pb = FC.findWallPlacement(plan, room, wallSegments, 'planterBox', 1.2, 0.35, items, doorZones);
          if (pb) add(room, 'planterBox', pb.x, pb.y, pb.w, pb.d, pb.rot, { mat: 'wood', decor: true });
        } else {
          // Bistro set or sun lounger for balconies and compact patios
          if (Math.max(W, D) >= 2.2 && Math.min(W, D) <= 1.8) {
            add(room, 'sunLounger', cx, cy, 0.68, 1.85, D > W ? 0 : Math.PI / 2, { mat: 'fabric' });
            const pb = FC.findWallPlacement(plan, room, wallSegments, 'planterBox', Math.min(1.2, W * 0.7), 0.32, items, doorZones);
            if (pb) add(room, 'planterBox', pb.x, pb.y, pb.w, pb.d, pb.rot, { mat: 'wood', decor: true });
          } else {
            const table = add(room, 'patioTable', cx, cy, 0.75, 0.75, 0, { mat: 'wood' });
            if (table) {
              add(room, 'patioChair', cx - 0.5, cy, 0.5, 0.5, Math.PI / 2, { mat: 'wood' });
              add(room, 'patioChair', cx + 0.5, cy, 0.5, 0.5, -Math.PI / 2, { mat: 'wood' });
            }
            const pb = FC.findWallPlacement(plan, room, wallSegments, 'planterBox', 1.0, 0.32, items, doorZones);
            if (pb) add(room, 'planterBox', pb.x, pb.y, pb.w, pb.d, pb.rot, { mat: 'wood', decor: true });
          }
        }
      } else {
        // Living room in primary zone
        const sofaW = clamp(W * 0.35, 1.8, 2.4);
        const sofaY = y1 - 0.65;
        if (variant === 0 && room.area >= 16) {
          // Attempt corner placement for sectional sofa first, else primary zone
          const secW = Math.min(2.5, sofaW + 0.3);
          const secCorner = FC.findCornerPlacement(room, 'sectionalSofa', secW, 1.8, items, doorZones, null, wallSegments);
          if (secCorner) {
            add(room, 'rug', secCorner.x, secCorner.y, Math.min(3.2, W * 0.7), Math.min(2.4, D * 0.65), secCorner.rot, { mat: 'rug' });
            add(room, 'sectionalSofa', secCorner.x, secCorner.y, secW, 1.8, secCorner.rot, { mat: 'fabric' });
            add(room, 'coffeeTable', secCorner.x + 0.4 * Math.cos(secCorner.rot), secCorner.y + 0.4 * Math.sin(secCorner.rot), 1.05, 0.55, secCorner.rot, { mat: 'wood' });
            const tvW = FC.findWallPlacement(plan, room, wallSegments, 'tvConsole', Math.min(1.9, sofaW), 0.42, items, doorZones);
            if (tvW) {
              add(room, 'tvConsole', tvW.x, tvW.y, tvW.w, tvW.d, tvW.rot, { mat: 'wood' });
              add(room, 'tv', tvW.x, tvW.y, Math.min(1.3, tvW.w * 0.7), 0.07, tvW.rot, { mat: 'screen', elev: 0.92, h: 0.78 });
            }
          } else {
            add(room, 'rug', cx, cy, Math.min(3.2, W * 0.7), Math.min(2.4, D * 0.65), 0, { mat: 'rug' });
            add(room, 'sectionalSofa', cx, sofaY, secW, 1.8, Math.PI, { mat: 'fabric' });
            add(room, 'coffeeTable', cx, Math.max(y0 + 1.1, sofaY - 1.15), 1.05, 0.55, 0, { mat: 'wood' });
            add(room, 'tvConsole', cx, y0 + 0.28, Math.min(1.9, sofaW), 0.42, 0, { mat: 'wood' });
            add(room, 'tv', cx, y0 + 0.15, Math.min(1.3, sofaW * 0.7), 0.07, 0, { mat: 'screen', elev: 0.92, h: 0.78 });
          }
          add(room, 'floorLamp', cx + 1.3, sofaY - 0.15, 0.4, 0.4, 0, { mat: 'metal', decor: true });
        } else if (variant === 0) {
          add(room, 'rug', cx, cy, Math.min(2.8, sofaW + 0.4), Math.min(2.0, D * 0.6), 0, { mat: 'rug' });
          add(room, 'sofa', cx, sofaY, sofaW, 0.9, Math.PI, { mat: 'fabric' });
          add(room, 'coffeeTable', cx, Math.max(y0 + 1.1, sofaY - 1.15), 1.0, 0.55, 0, { mat: 'wood' });
          add(room, 'tvConsole', cx, y0 + 0.28, Math.min(1.9, sofaW), 0.42, 0, { mat: 'wood' });
          add(room, 'tv', cx, y0 + 0.15, Math.min(1.3, sofaW * 0.7), 0.07, 0, { mat: 'screen', elev: 0.92, h: 0.78 });
          add(room, 'floorLamp', cx + sofaW / 2 + 0.25, sofaY, 0.4, 0.4, 0, { mat: 'metal', decor: true });
        } else if (variant === 1) {
          add(room, 'rug', cx, cy, Math.min(3.0, sofaW + 0.6), Math.min(2.2, D * 0.65), 0, { mat: 'rug' });
          add(room, 'sofa', cx, sofaY, sofaW, 0.88, Math.PI, { mat: 'fabric' });
          add(room, 'coffeeTable', cx, cy, 1.05, 0.55, 0, { mat: 'wood' });
          add(room, 'armchair', cx - sofaW * 0.38, cy - 0.75, 0.85, 0.85, 0.15, { mat: 'fabric' });
          add(room, 'armchair', cx + sofaW * 0.38, cy - 0.75, 0.85, 0.85, -0.15, { mat: 'fabric' });
          add(room, 'tvConsole', cx, y0 + 0.28, Math.min(1.8, sofaW), 0.4, 0, { mat: 'wood' });
          add(room, 'tv', cx, y0 + 0.15, Math.min(1.3, sofaW * 0.7), 0.07, 0, { mat: 'screen', elev: 0.92, h: 0.78 });
        } else {
          add(room, 'rug', cx, cy, Math.min(3.0, sofaW + 0.5), Math.min(2.2, D * 0.6), 0, { mat: 'rug' });
          add(room, 'sofa', cx, sofaY, sofaW, 0.9, Math.PI, { mat: 'fabric' });
          add(room, 'armchair', cx - sofaW / 2 + 0.2, cy + 0.1, 0.85, 0.85, -Math.PI / 2, { mat: 'fabric' });
          add(room, 'coffeeTable', cx + 0.2, cy, 0.95, 0.55, 0, { mat: 'wood' });
          add(room, 'tvConsole', cx, y0 + 0.26, Math.min(1.9, sofaW), 0.42, 0, { mat: 'wood' });
          add(room, 'tv', cx, y0 + 0.15, Math.min(1.3, sofaW * 0.7), 0.07, 0, { mat: 'screen', elev: 0.92, h: 0.78 });
        }

        // Modern linear fireplace along perimeter wall
        if (room.area >= 18) {
          const fp = FC.findWallPlacement(plan, room, wallSegments, 'fireplace', 1.2, 0.32, items, doorZones);
          if (fp) add(room, 'fireplace', fp.x, fp.y, fp.w, fp.d, fp.rot, { mat: 'stone' });
        }

        // Bookshelf along available wall
        if (room.area >= 18) {
          const bs = FC.findWallPlacement(plan, room, wallSegments, 'bookshelf', 1.4, 0.35, items, doorZones);
          if (bs) add(room, 'bookshelf', bs.x, bs.y, bs.w, bs.d, bs.rot, { mat: 'wood' });
        }

        // Living room wall artwork
        if (room.area >= 16) {
          const art = FC.findWallPlacement(plan, room, wallSegments, 'artwork', 1.4, 0.04, items, doorZones);
          if (art) add(room, 'artwork', art.x, art.y, art.w, art.d, art.rot, { elev: 1.35, h: 0.8, decor: true });
        }

        // Secondary area utilization in large living rooms (e.g. Great Room >= 32m2):
        if (room.area >= 32) {
          const b = room.bounds || FC.polygonBounds(room.polygon);
          const loungeCenter = { x: cx, y: sofaY };
          let bestSecAnchor = null;
          let maxSecDist = 0;
          for (let sx = b.x0 + 1.2; sx <= b.x1 - 1.2; sx += 0.8) {
            for (let sy = b.y0 + 1.2; sy <= b.y1 - 1.2; sy += 0.8) {
              const p = { x: sx, y: sy };
              if (!FC.pointInPolygon(p, room.polygon)) continue;
              const dist = FC.dist(p, loungeCenter);
              if (dist >= 3.8 && dist > maxSecDist) {
                const testBox = { kind: 'diningTable', x: sx, y: sy, w: 1.8, d: 1.8, rot: 0 };
                if (FC.canPlaceFurniture(plan, room, testBox, items, doorZones, wallSegments)) {
                  maxSecDist = dist;
                  bestSecAnchor = p;
                }
              }
            }
          }

          if (bestSecAnchor) {
            const ax = bestSecAnchor.x;
            const ay = bestSecAnchor.y;
            if (variant === 0 || variant === 2) {
              const table = add(room, 'diningTable', ax, ay, 1.4, 0.9, 0, { mat: 'wood' });
              if (table) {
                add(room, 'chair', ax - 0.4, ay - 0.72, 0.44, 0.44, 0, { mat: 'wood' });
                add(room, 'chair', ax + 0.4, ay - 0.72, 0.44, 0.44, 0, { mat: 'wood' });
                add(room, 'chair', ax - 0.4, ay + 0.72, 0.44, 0.44, Math.PI, { mat: 'wood' });
                add(room, 'chair', ax + 0.4, ay + 0.72, 0.44, 0.44, Math.PI, { mat: 'wood' });
                add(room, 'pendant', ax, ay, 0.45, 0.45, 0, { mat: 'metal', elev: 2.05, h: 0.4, decor: true });
              }
            } else {
              add(room, 'armchair', ax, ay, 0.85, 0.85, 0, { mat: 'fabric' });
              add(room, 'tableSmall', ax + 0.7, ay, 0.5, 0.5, 0, { mat: 'wood' });
              add(room, 'floorLamp', ax - 0.55, ay - 0.35, 0.4, 0.4, 0, { mat: 'metal', decor: true });
            }
          }
        }
      }
    });

    return items.filter((i) => !i.decor || density >= 0.7);
  };

  FC.furnitureCount = function (items) {
    return (items || []).filter(
      (i) =>
        i.kind !== 'rug' &&
        i.kind !== 'bathMat' &&
        i.kind !== 'pendant' &&
        i.kind !== 'artwork' &&
        i.kind !== 'mirrorCabinet' &&
        i.kind !== 'towelRack' &&
        i.kind !== 'rangeHood' &&
        i.kind !== 'fullMirror'
    ).length;
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
    if (plan.furniture) {
      plan.furniture.forEach((f) => {
        if (f.x != null) f.x = FC.round(f.x * factor, 4);
        if (f.y != null) f.y = FC.round(f.y * factor, 4);
        if (f.w != null) f.w = FC.round(f.w * factor, 4);
        if (f.d != null) f.d = FC.round(f.d * factor, 4);
        if (f.h != null) f.h = FC.round(f.h * factor, 4);
        if (f.elev != null) f.elev = FC.round(f.elev * factor, 4);
      });
    }
    if (plan.furnitureOverrides) {
      Object.keys(plan.furnitureOverrides).forEach((k) => {
        const f = plan.furnitureOverrides[k];
        if (f && f.x != null) f.x = FC.round(f.x * factor, 4);
        if (f && f.y != null) f.y = FC.round(f.y * factor, 4);
      });
    }
    const scaleRoomList = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach((r) => {
        if (!r) return;
        if (Array.isArray(r.polygon)) {
          r.polygon.forEach((p) => {
            p.x = FC.round(p.x * factor, 4);
            p.y = FC.round(p.y * factor, 4);
          });
        }
        if (r.centroid) {
          r.centroid.x = FC.round(r.centroid.x * factor, 4);
          r.centroid.y = FC.round(r.centroid.y * factor, 4);
        }
        if (r.area != null) r.area = FC.round(r.area * factor * factor, 2);
        if (r.polygon && r.polygon.length >= 3) {
          r.bounds = FC.polygonBounds(r.polygon);
        }
      });
    };
    scaleRoomList(plan.rooms);
    scaleRoomList(plan.manualRooms);
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

    return { success: true, merged: true, mergedWall: w1, wall: w1, thickness, removedWallId: w2.id, type: 'parallel' };
  };

  FC.mergeCollinearWalls = function (plan, wallId1, wallId2) {
    const walls = plan.walls || [];
    const w1 = walls.find((w) => w.id === wallId1 || 'w:' + w.id === wallId1);
    const w2 = walls.find((w) => w.id === wallId2 || 'w:' + w.id === wallId2);
    if (!w1 || !w2 || w1.id === w2.id) return null;

    const dx1 = w1.b.x - w1.a.x;
    const dy1 = w1.b.y - w1.a.y;
    const len1 = Math.hypot(dx1, dy1);
    const dx2 = w2.b.x - w2.a.x;
    const dy2 = w2.b.y - w2.a.y;
    const len2 = Math.hypot(dx2, dy2);
    if (len1 < 1e-4 || len2 < 1e-4) return null;

    const u1 = { x: dx1 / len1, y: dy1 / len1 };
    const ang1 = Math.atan2(dy1, dx1);
    const ang2 = Math.atan2(dy2, dx2);
    const diff = Math.abs(FC.angleDiff(ang1, ang2));
    const isCollinear = diff < 0.26 || Math.abs(diff - Math.PI) < 0.26; // Within ~15°
    if (!isCollinear) return null;

    // Check lateral distance of w2 from line of w1
    const n1 = { x: -u1.y, y: u1.x };
    const latA = Math.abs((w2.a.x - w1.a.x) * n1.x + (w2.a.y - w1.a.y) * n1.y);
    const latB = Math.abs((w2.b.x - w1.a.x) * n1.x + (w2.b.y - w1.a.y) * n1.y);
    if (latA > 0.4 || latB > 0.4) return null;

    // Project all 4 endpoints onto primary direction from w1.a
    const proj = (p) => (p.x - w1.a.x) * u1.x + (p.y - w1.a.y) * u1.y;
    const tList = [
      { t: proj(w1.a), p: w1.a },
      { t: proj(w1.b), p: w1.b },
      { t: proj(w2.a), p: w2.a },
      { t: proj(w2.b), p: w2.b },
    ];
    tList.sort((a, b) => a.t - b.t);

    const tMin = tList[0].t;
    const tMax = tList[3].t;

    const newA = { x: FC.round(w1.a.x + u1.x * tMin, 3), y: FC.round(w1.a.y + u1.y * tMin, 3) };
    const newB = { x: FC.round(w1.a.x + u1.x * tMax, 3), y: FC.round(w1.a.y + u1.y * tMax, 3) };
    const newLen = FC.dist(newA, newB);

    // Migrate openings on w1: adjust offset by -tMin (since newA is at tMin)
    (plan.openings || []).forEach((op) => {
      if (op.hostKey === 'w:' + w1.id || op.hostKey === 'wall_' + w1.id) {
        op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, op.offset - tMin)), 3);
      }
    });

    // Migrate openings on w2 onto w1
    (plan.openings || []).forEach((op) => {
      if (op.hostKey === 'w:' + w2.id || op.hostKey === 'wall_' + w2.id) {
        const pOld = FC.lerp(w2.a, w2.b, op.offset / len2);
        const tOp = proj(pOld);
        const newOffset = tOp - tMin;
        op.hostKey = 'w:' + w1.id;
        op.offset = FC.round(Math.max(op.width / 2 + 0.02, Math.min(newLen - op.width / 2 - 0.02, newOffset)), 3);
      }
    });

    w1.a = newA;
    w1.b = newB;

    const w2Idx = walls.findIndex((w) => w.id === w2.id);
    if (w2Idx >= 0) walls.splice(w2Idx, 1);

    return { success: true, merged: true, mergedWall: w1, wall: w1, removedWallId: w2.id, type: 'collinear' };
  };

  FC.mergeWalls = function (plan, wallId1, wallId2) {
    if (!wallId1 || !wallId2) return null;
    const parallelCandidate = FC.findParallelWall(plan, wallId1, 0.45);
    if (parallelCandidate && parallelCandidate.wall && parallelCandidate.wall.id === wallId2) {
      return FC.mergeParallelWalls(plan, wallId1, wallId2);
    }
    const parallelCandidate2 = FC.findParallelWall(plan, wallId2, 0.45);
    if (parallelCandidate2 && parallelCandidate2.wall && parallelCandidate2.wall.id === wallId1) {
      return FC.mergeParallelWalls(plan, wallId1, wallId2);
    }

    const resCollinear = FC.mergeCollinearWalls(plan, wallId1, wallId2);
    if (resCollinear) return resCollinear;

    return null;
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

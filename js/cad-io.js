/* RoomCraft — CAD (DWG/DXF) export and import bridge.
 * Generates and parses standard AutoCAD-compliant DXF interchange format,
 * fully compatible with AutoCAD, CadCraft, LibreCAD, Revit, and SketchUp.
 */
(function () {
  const FC = (window.FC = window.FC || {});

  const CAD = (FC.CAD = {});

  /* ------------------------------------------------------------------ */
  /* DXF Generator (Export)                                             */
  /* ------------------------------------------------------------------ */

  CAD.exportDXF = function (plan) {
    const lines = [];

    function w(code, val) {
      lines.push(String(code));
      lines.push(String(val));
    }

    // R12 has no LWPOLYLINE; write the equivalent old-style POLYLINE.
    function writePolyline(layer, points, closed, width) {
      w(0, 'POLYLINE');
      w(8, layer);
      w(66, 1);
      w(10, 0.0);
      w(20, 0.0);
      w(30, 0.0);
      w(70, closed ? 1 : 0);
      if (width) {
        w(40, width.toFixed(4));
        w(41, width.toFixed(4));
      }
      points.forEach((pt) => {
        w(0, 'VERTEX');
        w(8, layer);
        w(10, pt.x.toFixed(4));
        w(20, (-pt.y).toFixed(4));
        w(30, 0.0);
        if (width) {
          w(40, width.toFixed(4));
          w(41, width.toFixed(4));
        }
      });
      w(0, 'SEQEND');
      w(8, layer);
    }

    // Header section. R12 (AC1009) is used deliberately: it needs no
    // subclass markers, handles or object section, so AutoCAD can always
    // open the generated file. Newer version tags require a full R2000+
    // DXF structure and make AutoCAD reject this minimal geometry.
    w(0, 'SECTION');
    w(2, 'HEADER');
    w(9, '$ACADVER');
    w(1, 'AC1009'); // AutoCAD R12 DXF
    w(9, '$MEASUREMENT');
    w(70, 1); // 1 = Metric
    w(0, 'ENDSEC');

    // Tables section: required symbol tables for R12
    w(0, 'SECTION');
    w(2, 'TABLES');

    // Linetype table
    w(0, 'TABLE');
    w(2, 'LTYPE');
    w(70, 1);
    w(0, 'LTYPE');
    w(2, 'CONTINUOUS');
    w(70, 64);
    w(3, 'Solid line');
    w(72, 65);
    w(73, 0);
    w(40, 0.0);
    w(0, 'ENDTAB');

    const layers = [
      { name: 'WALL_EXTERIOR', color: 7 }, // White / Black
      { name: 'WALL_INTERIOR', color: 8 }, // Gray
      { name: 'DOORS', color: 1 },         // Red
      { name: 'WINDOWS', color: 4 },       // Cyan
      { name: 'ROOMS', color: 3 },         // Green
      { name: 'FURNITURE', color: 2 },     // Yellow
      { name: 'DIMENSIONS', color: 6 },    // Magenta
      { name: 'LIGHTS', color: 5 },        // Blue
    ];

    // Layer table
    w(0, 'TABLE');
    w(2, 'LAYER');
    w(70, layers.length);

    layers.forEach((lay) => {
      w(0, 'LAYER');
      w(2, lay.name);
      w(70, 0);
      w(62, lay.color);
      w(6, 'CONTINUOUS');
    });

    w(0, 'ENDTAB');

    // Text style table (TEXT entities reference STANDARD)
    w(0, 'TABLE');
    w(2, 'STYLE');
    w(70, 1);
    w(0, 'STYLE');
    w(2, 'STANDARD');
    w(70, 0);
    w(40, 0.0);
    w(41, 1.0);
    w(50, 0.0);
    w(71, 0);
    w(42, 0.2);
    w(3, 'txt');
    w(4, '');
    w(0, 'ENDTAB');

    w(0, 'ENDSEC');

    // Blocks section (empty table required by AutoCAD)
    w(0, 'SECTION');
    w(2, 'BLOCKS');
    w(0, 'ENDSEC');

    // Entities section
    w(0, 'SECTION');
    w(2, 'ENTITIES');

    // 1. Exterior Walls (Outline)
    const outline = plan.outline || [];
    if (outline.length >= 3) {
      writePolyline(
        'WALL_EXTERIOR',
        outline,
        true,
        plan.settings ? plan.settings.extThickness || 0.2 : 0.2
      );
    }

    // 2. Interior Walls
    const walls = plan.walls || [];
    walls.forEach((wall) => {
      w(0, 'LINE');
      w(8, 'WALL_INTERIOR');
      w(10, wall.a.x.toFixed(4));
      w(20, (-wall.a.y).toFixed(4));
      w(30, 0.0);
      w(11, wall.b.x.toFixed(4));
      w(21, (-wall.b.y).toFixed(4));
      w(31, 0.0);
    });

    // 3. Openings (Doors and Windows)
    const segs = FC.getSegments(plan);
    const openings = plan.openings || [];
    openings.forEach((op) => {
      const pl = FC.openingPlacement(plan, op, segs);
      if (!pl) return;
      const layer = op.kind === 'window' ? 'WINDOWS' : 'DOORS';
      const halfW = pl.width / 2;
      const cos = Math.cos(pl.angle);
      const sin = Math.sin(pl.angle);

      // Start & end points of opening along wall
      const p1x = pl.x - cos * halfW;
      const p1y = pl.y - sin * halfW;
      const p2x = pl.x + cos * halfW;
      const p2y = pl.y + sin * halfW;

      // Draw opening threshold line
      w(0, 'LINE');
      w(8, layer);
      w(10, p1x.toFixed(4));
      w(20, (-p1y).toFixed(4));
      w(30, 0.0);
      w(11, p2x.toFixed(4));
      w(21, (-p2y).toFixed(4));
      w(31, 0.0);

      if (op.kind === 'door') {
        // Draw 90-degree swing arc and leaf line
        const isRight = op.hinge === 'right';
        const swingSign = op.swingSide === -1 ? -1 : 1;
        const normalX = -sin * swingSign;
        const normalY = cos * swingSign;

        const hx = isRight ? p2x : p1x;
        const hy = isRight ? p2y : p1y;
        const closedX = isRight ? p1x : p2x;
        const closedY = isRight ? p1y : p2y;

        const leafEndX = hx + normalX * pl.width;
        const leafEndY = hy + normalY * pl.width;

        // Door leaf
        w(0, 'LINE');
        w(8, layer);
        w(10, hx.toFixed(4));
        w(20, (-hy).toFixed(4));
        w(30, 0.0);
        w(11, leafEndX.toFixed(4));
        w(21, (-leafEndY).toFixed(4));
        w(31, 0.0);

        // Door swing arc (CAD Y is inverted: y_cad = -y)
        const vClosedX = closedX - hx;
        const vClosedY = -closedY - (-hy);
        const vOpenX = leafEndX - hx;
        const vOpenY = -leafEndY - (-hy);

        let aClosed = (Math.atan2(vClosedY, vClosedX) * 180) / Math.PI;
        let aOpen = (Math.atan2(vOpenY, vOpenX) * 180) / Math.PI;
        if (aClosed < 0) aClosed += 360;
        if (aOpen < 0) aOpen += 360;

        // DXF arcs sweep counter-clockwise from group 50 to 51
        const cross = vClosedX * vOpenY - vClosedY * vOpenX;
        const startAngle = cross > 0 ? aClosed : aOpen;
        const endAngle = cross > 0 ? aOpen : aClosed;

        w(0, 'ARC');
        w(8, layer);
        w(10, hx.toFixed(4));
        w(20, (-hy).toFixed(4));
        w(30, 0.0);
        w(40, pl.width.toFixed(4)); // Radius
        w(50, startAngle.toFixed(2));
        w(51, endAngle.toFixed(2));
      } else if (op.kind === 'window') {
        // Double lines for window glazing
        const offset = 0.04;
        const nx = -sin * offset;
        const ny = cos * offset;
        w(0, 'LINE');
        w(8, layer);
        w(10, (p1x + nx).toFixed(4));
        w(20, (-(p1y + ny)).toFixed(4));
        w(30, 0.0);
        w(11, (p2x + nx).toFixed(4));
        w(21, (-(p2y + ny)).toFixed(4));
        w(31, 0.0);

        w(0, 'LINE');
        w(8, layer);
        w(10, (p1x - nx).toFixed(4));
        w(20, (-(p1y - ny)).toFixed(4));
        w(30, 0.0);
        w(11, (p2x - nx).toFixed(4));
        w(21, (-(p2y - ny)).toFixed(4));
        w(31, 0.0);
      }
    });

    // 4. Rooms (Labels & Areas)
    const rooms = FC.detectRooms(plan);
    rooms.forEach((r) => {
      if (r.centroid) {
        w(0, 'TEXT');
        w(8, 'ROOMS');
        w(10, r.centroid.x.toFixed(4));
        w(20, (-r.centroid.y).toFixed(4));
        w(30, 0.0);
        w(40, '0.28'); // Text height
        w(1, r.name || (r.type ? r.type.toUpperCase() : 'ROOM'));

        // Area text
        w(0, 'TEXT');
        w(8, 'ROOMS');
        w(10, r.centroid.x.toFixed(4));
        w(20, (-r.centroid.y - 0.35).toFixed(4));
        w(30, 0.0);
        w(40, '0.20');
        w(1, r.area ? r.area.toFixed(1) + ' m²' : '');
      }
    });

    // 5. Furniture
    const furniture = (plan.furniture && plan.furniture.length)
      ? plan.furniture
      : (FC.furnishPlan ? FC.furnishPlan(plan, rooms) : []);
    furniture.forEach((f) => {
      // Draw rectangular boundary for furniture
      const hw = f.w / 2;
      const hd = f.d / 2;
      const cos = Math.cos(f.rot || 0);
      const sin = Math.sin(f.rot || 0);

      const corners = [
        { x: f.x + (-hw * cos - -hd * sin), y: f.y + (-hw * sin + -hd * cos) },
        { x: f.x + (hw * cos - -hd * sin), y: f.y + (hw * sin + -hd * cos) },
        { x: f.x + (hw * cos - hd * sin), y: f.y + (hw * sin + hd * cos) },
        { x: f.x + (-hw * cos - hd * sin), y: f.y + (-hw * sin + hd * cos) },
      ];

      writePolyline('FURNITURE', corners, true, 0);

      // Label
      w(0, 'TEXT');
      w(8, 'FURNITURE');
      w(10, f.x.toFixed(4));
      w(20, (-f.y).toFixed(4));
      w(30, 0.0);
      w(40, '0.14');
      w(1, f.kind);
    });

    // 6. Lights
    const lights = plan.lights || [];
    lights.forEach((l) => {
      w(0, 'CIRCLE');
      w(8, 'LIGHTS');
      w(10, l.x.toFixed(4));
      w(20, (-l.y).toFixed(4));
      w(30, (l.z || 2.4).toFixed(4));
      w(40, '0.15'); // Radius
    });

    w(0, 'ENDSEC');
    w(0, 'EOF');

    return lines.join('\r\n');
  };

  /* ------------------------------------------------------------------ */
  /* DWG Transcoder Bridge (WebAssembly)                                */
  /* ------------------------------------------------------------------ */

  CAD.isDWGBinary = function (bufferOrBytes) {
    if (!bufferOrBytes) return false;
    const bytes = bufferOrBytes instanceof Uint8Array ? bufferOrBytes : new Uint8Array(bufferOrBytes);
    if (bytes.length < 6) return false;
    // 'AC10' in ASCII (AutoCAD DWG header magic bytes)
    return bytes[0] === 0x41 && bytes[1] === 0x43 && bytes[2] === 0x31 && bytes[3] === 0x30;
  };

  let _dwgInstancePromise = null;
  CAD.convertDWGtoDXF = async function (arrayBuffer, options) {
    options = options || {};
    const uint8 = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

    if (!_dwgInstancePromise) {
      _dwgInstancePromise = (async () => {
        let LibreDwgClass = null;
        let wasmDir = options.wasmDir || 'vendor/libredwg';

        if (typeof window !== 'undefined' && window.location) {
          const isFileProtocol = window.location.protocol === 'file:';
          const baseHref = window.location.href.replace(/\/[^/]*$/, '/');
          const moduleUrl = new URL('vendor/libredwg/libredwg-web.js', baseHref).href;
          wasmDir = options.wasmDir || (isFileProtocol ? 'vendor/libredwg' : new URL('vendor/libredwg', baseHref).href);
          try {
            const mod = await import(moduleUrl);
            LibreDwgClass = mod.LibreDwg;
          } catch (importErr) {
            if (isFileProtocol) {
              throw new Error('WebAssembly modules cannot be loaded directly over file:// due to browser security restrictions. Please serve FloorCraft over HTTP (e.g. npx serve or Live Server) or convert the file to .dxf.');
            }
            throw importErr;
          }
        } else {
          const mod = await import('../vendor/libredwg/libredwg-web.js');
          LibreDwgClass = mod.LibreDwg;
        }

        return await LibreDwgClass.create(wasmDir);
      })();
    }

    const libredwg = await _dwgInstancePromise;
    const dxfBytes = libredwg.dwg_write_dxf(uint8);
    if (!dxfBytes || !dxfBytes.length) {
      throw new Error('AutoCAD DWG transcode failed. The DWG file may be damaged, encrypted, or use an incompatible version.');
    }
    return new TextDecoder('utf-8').decode(dxfBytes);
  };

  /* ------------------------------------------------------------------ */
  /* Layer / entity classification helpers                              */
  /* ------------------------------------------------------------------ */

  function isWindowLayer(layer) {
    return /win|glaz|fenster|vitr|vidrio/i.test(layer || '');
  }

  function isDoorLayer(layer) {
    return /door|tuer|porte|porta|puerta/i.test(layer || '');
  }

  function isIgnoredLayer(layer) {
    const s = String(layer || '');
    if (!s) return true;
    return /construct|guide|grid|axis|centre|center|dimension|dim\b|text|label|annot|hatch|fill|furniture|furn\b|light|electric|plumb|sanit|defpoint|viewport|title|border|frame|roof|site|terrain|landscap|elevation|section|detail|legend|schedule|north|marker|symbol|template|xref|hidden|stair|handrail|railing|shelv|cabinet|appliance/i.test(s);
  }

  function isExteriorLayer(layer) {
    return /outer|exterior|perimeter|boundary|facade|shell|outside/i.test(layer || '');
  }

  function isWallLayer(layer) {
    return /wall|wand|muro|muri|mur\b|partition|cloison|parede|pared|tabique|divider|interior/i.test(layer || '');
  }

  function layerRole(layer, hasNamedWallLayers) {
    if (isWindowLayer(layer)) return 'windows';
    if (isDoorLayer(layer)) return 'doors';
    if (isIgnoredLayer(layer)) return 'ignored';
    if (isExteriorLayer(layer)) return 'outline';
    if (isWallLayer(layer)) return 'walls';
    // Unnamed layer: walls are detected from the geometry (paired faces).
    return hasNamedWallLayers ? 'auto' : 'walls';
  }

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /* ------------------------------------------------------------------ */
  /* DXF Analyzer (Pre-import inspection)                               */
  /* ------------------------------------------------------------------ */

  CAD.analyzeDXF = function (text) {
    const rawLines = text.split(/\r?\n/);
    let i = 0;
    function next() {
      if (i >= rawLines.length) return null;
      const code = parseInt(rawLines[i++].trim(), 10);
      const val = i < rawLines.length ? rawLines[i++].trim() : '';
      return { code, val };
    }

    let inEntities = false;
    const entities = [];
    let cur = null;

    while (i < rawLines.length) {
      const p = next();
      if (!p) break;
      if (p.code === 0 && p.val === 'SECTION') {
        const s = next();
        if (s && s.val === 'ENTITIES') inEntities = true;
      } else if (p.code === 0 && p.val === 'ENDSEC') {
        inEntities = false;
      } else if (inEntities && p.code === 0) {
        if (cur) entities.push(cur);
        cur = { type: p.val, props: {} };
      } else if (inEntities && cur) {
        if (!cur.props[p.code]) cur.props[p.code] = [];
        cur.props[p.code].push(p.val);
      }
    }
    if (cur) entities.push(cur);

    const layerNames = new Set();
    entities.forEach((e) => layerNames.add((e.props[8] && e.props[8][0]) || '0'));
    const hasNamedWallLayers = Array.from(layerNames).some(
      (l) => isWallLayer(l) || isExteriorLayer(l)
    );

    const pts = [];
    let doorCount = 0;
    let windowCount = 0;

    entities.forEach((e) => {
      const layer = (e.props[8] && e.props[8][0]) || '0';
      if (isIgnoredLayer(layer)) return;
      if (e.type === 'LINE') {
        const x1 = parseFloat(e.props[10] ? e.props[10][0] : 0);
        const y1 = parseFloat(e.props[20] ? e.props[20][0] : 0);
        const x2 = parseFloat(e.props[11] ? e.props[11][0] : 0);
        const y2 = parseFloat(e.props[21] ? e.props[21][0] : 0);
        pts.push({ x: x1, y: y1 });
        pts.push({ x: x2, y: y2 });
      } else if (e.type === 'LWPOLYLINE') {
        const xs = (e.props[10] || []).map(Number);
        const ys = (e.props[20] || []).map(Number);
        for (let j = 0; j < xs.length; j++) pts.push({ x: xs[j], y: ys[j] });
      } else if (e.type === 'ARC') {
        const cx = parseFloat(e.props[10] ? e.props[10][0] : 0);
        const cy = parseFloat(e.props[20] ? e.props[20][0] : 0);
        const r = parseFloat(e.props[40] ? e.props[40][0] : 0);
        pts.push({ x: cx - r, y: cy - r });
        pts.push({ x: cx + r, y: cy + r });
        if (isDoorLayer(layer)) doorCount++;
      } else if (e.type === 'INSERT') {
        const name = (e.props[2] && e.props[2][0]) || '';
        if (/door/i.test(name) || isDoorLayer(layer)) doorCount++;
        if (/window|glaz/i.test(name) || isWindowLayer(layer)) windowCount++;
        const x = parseFloat(e.props[10] ? e.props[10][0] : 0);
        const y = parseFloat(e.props[20] ? e.props[20][0] : 0);
        pts.push({ x, y, isInsert: true });
      }
    });

    const layerMap = new Map();
    entities.forEach((e) => {
      const l = (e.props[8] && e.props[8][0]) || '0';
      if (!layerMap.has(l)) layerMap.set(l, { name: l, count: 0, types: new Set() });
      const rec = layerMap.get(l);
      rec.count++;
      rec.types.add(e.type);
    });
    const layers = Array.from(layerMap.values()).map((l) => {
      const role = layerRole(l.name, hasNamedWallLayers);
      return { name: l.name, count: l.count, role, types: Array.from(l.types) };
    });

    if (!pts.length) {
      return { rawW: 10, rawH: 10, unit: 'm', unitFactor: 1.0, unitLabel: 'Meters (m)', scaledW: 10, scaledH: 10, entityCount: 0, doorCount: 0, windowCount: 0, outliersFiltered: 0, layers };
    }

    const xs = pts.map((p) => p.x).sort((a, b) => a - b);
    const ys = pts.map((p) => p.y).sort((a, b) => a - b);
    const medX = xs[Math.floor(xs.length / 2)] || 0;
    const medY = ys[Math.floor(ys.length / 2)] || 0;
    const q1X = xs[Math.floor(xs.length * 0.25)] || 0, q3X = xs[Math.floor(xs.length * 0.75)] || 0;
    const q1Y = ys[Math.floor(ys.length * 0.25)] || 0, q3Y = ys[Math.floor(ys.length * 0.75)] || 0;
    const iqrX = Math.max(q3X - q1X, 10);
    const iqrY = Math.max(q3Y - q1Y, 10);

    const cleanPts = pts.filter((p) => {
      return Math.abs(p.x - medX) <= iqrX * 3.5 && Math.abs(p.y - medY) <= iqrY * 3.5;
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cleanPts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const rawW = maxX - minX;
    const rawH = maxY - minY;

    let unit = 'in';
    let unitFactor = 0.0254;
    let unitLabel = 'Inches (in)';
    const maxDim = Math.max(rawW, rawH);
    if (maxDim > 1500) {
      unit = 'mm';
      unitFactor = 0.001;
      unitLabel = 'Millimeters (mm)';
    } else if (maxDim < 45) {
      unit = 'm';
      unitFactor = 1.0;
      unitLabel = 'Meters (m)';
    }

    return {
      rawW: Math.round(rawW * 10) / 10,
      rawH: Math.round(rawH * 10) / 10,
      unit,
      unitFactor,
      unitLabel,
      scaledW: Math.round(rawW * unitFactor * 100) / 100,
      scaledH: Math.round(rawH * unitFactor * 100) / 100,
      entityCount: entities.length,
      doorCount,
      windowCount,
      outliersFiltered: pts.length - cleanPts.length,
      layers,
    };
  };

  /* ------------------------------------------------------------------ */
  /* Geometry helpers for CAD reconstruction                            */
  /* ------------------------------------------------------------------ */

  function angleDiff(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  }

  function segLength(s) {
    return Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
  }

  function segMid(s) {
    return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
  }

  // Pair the two parallel face lines of CAD walls into one centreline and
  // discard the short perpendicular caps / jambs that join those faces.
  function mergeWallCenterlines(segments, enabled, capLength, debug) {
    if (!enabled) {
      return segments
        .filter((s) => segLength(s) > 0.08)
        .map((s) => ({ a: s.a, b: s.b, layer: s.layer, thickness: null, exterior: isExteriorLayer(s.layer) }));
    }

    // Remove exact duplicates first (same wall face exported twice)
    const unique = [];
    const seen = new Set();
    segments.forEach((s) => {
      if (segLength(s) < 0.05) return;
      const k1 = Math.round(s.a.x * 1000) + ',' + Math.round(s.a.y * 1000);
      const k2 = Math.round(s.b.x * 1000) + ',' + Math.round(s.b.y * 1000);
      const key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(s);
    });

    // Score every parallel pair that could be the two faces of one wall, then
    // accept the best pairs first. Pairing each line with its closest parallel
    // neighbour (the old greedy-by-index scan) let a long wall face be stolen
    // by a neighbouring wall, which silently deleted whole partitions.
    const items = unique.map((s) => {
      const len = segLength(s);
      const ux = len > 0 ? (s.b.x - s.a.x) / len : 0;
      const uy = len > 0 ? (s.b.y - s.a.y) / len : 0;
      return { s, len, ux, uy, angle: Math.atan2(uy, ux) };
    });

    const candidates = [];
    for (let i = 0; i < items.length; i++) {
      const s1 = items[i];
      if (s1.len < 0.06) continue;
      for (let j = i + 1; j < items.length; j++) {
        const s2 = items[j];
        if (s2.len < 0.06) continue;
        if (angleDiff(s1.angle, s2.angle) > 0.14) continue;

        const m2 = segMid(s2.s);
        const perp = Math.abs((m2.x - s1.s.a.x) * s1.uy - (m2.y - s1.s.a.y) * s1.ux);
        // Wall faces from an unnamed layer must look like a real wall before
        // they are trusted: a plausible thickness instead of any close line
        // (window sills, glazing, furniture outlines).
        const weakPair = s1.s.weak || s2.s.weak;
        const minPerp = weakPair ? 0.07 : 0.035;
        const maxPerp = weakPair ? 0.4 : 0.55;
        if (perp < minPerp || perp > maxPerp) continue;

        const dx1 = s1.ux * s1.len;
        const dy1 = s1.uy * s1.len;
        const tA = ((s2.s.a.x - s1.s.a.x) * dx1 + (s2.s.a.y - s1.s.a.y) * dy1) / (s1.len * s1.len);
        const tB = ((s2.s.b.x - s1.s.a.x) * dx1 + (s2.s.b.y - s1.s.a.y) * dy1) / (s1.len * s1.len);
        const overlap = (Math.min(1, Math.max(tA, tB)) - Math.max(0, Math.min(tA, tB))) * s1.len;
        if (overlap < 0.06) continue;
        if (overlap < Math.min(0.16, Math.min(s1.len, s2.len) * 0.5)) continue;

        // Long shared span wins; a thin offset wins over a wide one so two
        // parallel partitions are not stitched into one fat fake wall.
        const score = overlap * (1 - Math.min(perp, 0.5) / 0.5);
        candidates.push({ i, j, perp, overlap, score });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.perp - b.perp);

    const used = new Array(unique.length).fill(false);
    const centre = [];
    const loose = [];

    candidates.forEach(({ i, j, perp, overlap }) => {
      if (used[i] || used[j]) return;
      const s1 = items[i];
      const s2 = items[j];
      if (perp < 0.06 || overlap < 0.2) return;

      const nx1 = -s1.uy;
      const ny1 = s1.ux;
      const offset = (s2.s.a.x - s1.s.a.x) * nx1 + (s2.s.a.y - s1.s.a.y) * ny1;
      const half = offset / 2;
      const p0 = { x: s1.s.a.x + nx1 * half, y: s1.s.a.y + ny1 * half };
      const proj = (p) => (p.x - p0.x) * s1.ux + (p.y - p0.y) * s1.uy;
      const tMin = Math.min(proj(s1.s.a), proj(s1.s.b), proj(s2.s.a), proj(s2.s.b));
      const tMax = Math.max(proj(s1.s.a), proj(s1.s.b), proj(s2.s.a), proj(s2.s.b));
      const exterior = isExteriorLayer(s1.s.layer) || isExteriorLayer(s2.s.layer);
      if (debug) console.log('PAIR', i, j, s1.len.toFixed(2), s2.len.toFixed(2), 'perp', perp.toFixed(3), 'ov', overlap.toFixed(2), 's1', s1.s.a, s1.s.b, 's2', s2.s.a, s2.s.b);
      centre.push({
        a: { x: p0.x + s1.ux * tMin, y: p0.y + s1.uy * tMin },
        b: { x: p0.x + s1.ux * tMax, y: p0.y + s1.uy * tMax },
        layer: exterior ? (isExteriorLayer(s1.s.layer) ? s1.s.layer : s2.s.layer) : s1.s.layer,
        thickness: Math.abs(offset),
        exterior,
      });
      used[i] = true;
      used[j] = true;
    });

    items.forEach((item, i) => {
      if (used[i] || item.len < 0.06) return;
      loose.push({ a: item.s.a, b: item.s.b, layer: item.s.layer, thickness: null, exterior: isExteriorLayer(item.s.layer), weak: !!item.s.weak });
      if (debug) console.log('LOOSE', i, item.len.toFixed(2), item.s.a, item.s.b, item.s.layer, item.s.weak ? 'weak' : '');
    });

    // Keep single-line walls, but drop short caps/jambs that sit on a
    // double-line wall (they are the ends of the missing wall thickness).
    const result = centre.slice();
    loose.forEach((s) => {
      const len = segLength(s);
      if (len < 0.08) return;
      // A single line from an unnamed layer is far more likely to be a symbol,
      // a dimension or a construction line than a wall, so it is dropped.
      if (s.weak) return;
      if (len < capLength) {
        const mid = segMid(s);
        const angle = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
        const nearFace = centre.some((c) => {
          const cLen = segLength(c);
          if (cLen < 0.1) return false;
          const cAngle = Math.atan2(c.b.y - c.a.y, c.b.x - c.a.x);
          const cMid = segMid(c);
          const dist = Math.abs((mid.x - c.a.x) * (c.b.y - c.a.y) - (mid.y - c.a.y) * (c.b.x - c.a.x)) / cLen;
          const dot = Math.abs((mid.x - cMid.x) * (c.b.x - c.a.x) + (mid.y - cMid.y) * (c.b.y - c.a.y)) / (cLen * cLen);
          const inSpan = dot > -0.15 && dot < 1.15;
          const parallel = angleDiff(angle, cAngle) < 0.25;
          const perpendicular = Math.abs(angleDiff(angle, cAngle) - Math.PI / 2) < 0.25;
          return inSpan && dist < 0.36 && (parallel || perpendicular);
        });
        if (nearFace) return;
      }
      result.push(s);
    });

    return result;
  }

  // Join collinear wall pieces across door/window gaps (typical CAD drafting
  // leaves the wall line open where an opening is scheduled).
  function bridgeCollinearWalls(walls, maxGap) {
    const list = walls.slice();
    list.forEach((w) => {
      const dx = Math.abs(w.b.x - w.a.x);
      const dy = Math.abs(w.b.y - w.a.y);
      if (dy < 0.03 && dx > 0.03) {
        w.a.y = w.b.y = (w.a.y + w.b.y) / 2;
        w.orient = 'H';
      } else if (dx < 0.03 && dy > 0.03) {
        w.a.x = w.b.x = (w.a.x + w.b.x) / 2;
        w.orient = 'V';
      } else {
        w.orient = 'D';
      }
    });

    let changed = true;
    while (changed) {
      changed = false;
      outer:
      for (let i = 0; i < list.length; i++) {
        const w1 = list[i];
        if (w1.orient === 'D') continue;
        const c1 = w1.orient === 'H' ? w1.a.y : w1.a.x;
        const s1a = w1.orient === 'H' ? Math.min(w1.a.x, w1.b.x) : Math.min(w1.a.y, w1.b.y);
        const s1b = w1.orient === 'H' ? Math.max(w1.a.x, w1.b.x) : Math.max(w1.a.y, w1.b.y);
        for (let j = i + 1; j < list.length; j++) {
          const w2 = list[j];
          if (w2.orient !== w1.orient) continue;
          const c2 = w2.orient === 'H' ? w2.a.y : w2.a.x;
          if (Math.abs(c1 - c2) > 0.08) continue;
          const s2a = w2.orient === 'H' ? Math.min(w2.a.x, w2.b.x) : Math.min(w2.a.y, w2.b.y);
          const s2b = w2.orient === 'H' ? Math.max(w2.a.x, w2.b.x) : Math.max(w2.a.y, w2.b.y);
          const gap = Math.max(s1a, s2a) - Math.min(s1b, s2b);
          if (gap <= maxGap) {
            const lo = Math.min(s1a, s2a);
            const hi = Math.max(s1b, s2b);
            const c = (c1 + c2) / 2;
            if (w1.orient === 'H') {
              w1.a = { x: lo, y: c };
              w1.b = { x: hi, y: c };
            } else {
              w1.a = { x: c, y: lo };
              w1.b = { x: c, y: hi };
            }
            list.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    }
    return list.filter((w) => segLength(w) > 0.1);
  }

  function segLiesOnOutline(w, outline, tol) {
    if (!outline || outline.length < 2) return false;
    const len = segLength(w);
    if (len < 0.05) return false;
    const ux = (w.b.x - w.a.x) / len;
    const uy = (w.b.y - w.a.y) / len;
    const mid = segMid(w);
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i];
      const b = outline[(i + 1) % outline.length];
      const eLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (eLen < 0.05) continue;
      const ex = (b.x - a.x) / eLen;
      const ey = (b.y - a.y) / eLen;
      if (Math.abs(ux * ex + uy * ey) < 0.995) continue;
      const dist = Math.abs((mid.x - a.x) * ey - (mid.y - a.y) * ex);
      if (dist > tol) continue;
      const t = ((mid.x - a.x) * ex + (mid.y - a.y) * ey) / eLen;
      if (t >= -0.08 && t <= 1.08) return true;
    }
    return false;
  }

  function findHostSegment(segs, mid, dir, maxDist) {
    let best = null;
    segs.forEach((s) => {
      if (s.len < 0.3) return;
      const ux = Math.cos(s.angle);
      const uy = Math.sin(s.angle);
      const dot = Math.abs(dir.x * ux + dir.y * uy);
      if (dot < 0.85) return;
      const dx = s.b.x - s.a.x;
      const dy = s.b.y - s.a.y;
      const t = ((mid.x - s.a.x) * dx + (mid.y - s.a.y) * dy) / (s.len * s.len);
      if (t < -0.1 || t > 1.1) return;
      const px = s.a.x + Math.max(0, Math.min(1, t)) * dx;
      const py = s.a.y + Math.max(0, Math.min(1, t)) * dy;
      const d = Math.hypot(mid.x - px, mid.y - py);
      if (d <= maxDist && (!best || d < best.dist)) {
        best = { seg: s, dist: d, t, point: { x: px, y: py } };
      }
    });
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* DXF Parser (Import)                                                */
  /* ------------------------------------------------------------------ */

  CAD.importDXF = function (text, options) {
    options = options || {};
    let scale = options.scale;
    if (scale == null) {
      const a = CAD.analyzeDXF(text);
      scale = a.unitFactor || 1.0;
    }
    const mergeDoubleLines = options.mergeDoubleLines !== false;
    const filterOutliers = options.filterOutliers !== false;
    const importDoors = options.importDoors !== false;

    const rawLines = text.split(/\r?\n/);
    let i = 0;

    function next() {
      if (i >= rawLines.length) return null;
      const code = parseInt(rawLines[i++].trim(), 10);
      const val = i < rawLines.length ? rawLines[i++].trim() : '';
      return { code, val };
    }

    // Read the remaining inline tags of the current entity until the next
    // group code 0 (the start of the following entity).
    function readEntity(cb) {
      while (i < rawLines.length) {
        const peekCode = parseInt(rawLines[i].trim(), 10);
        if (peekCode === 0) break;
        const p = next();
        if (p) cb(p);
      }
    }

    let inEntities = false;
    const cadLines = [];
    const cadPolylines = [];
    const cadArcs = [];
    const cadInserts = [];

    while (i < rawLines.length) {
      const pair = next();
      if (!pair) break;

      if (pair.code === 0 && pair.val === 'SECTION') {
        const secName = next();
        if (secName && secName.val === 'ENTITIES') inEntities = true;
      } else if (pair.code === 0 && pair.val === 'ENDSEC') {
        inEntities = false;
      } else if (inEntities && pair.code === 0) {
        const entityType = pair.val;

        if (entityType === 'LINE') {
          let x1 = 0, y1 = 0, x2 = 0, y2 = 0, layer = '';
          readEntity((p) => {
            if (p.code === 8) layer = p.val;
            else if (p.code === 10) x1 = parseFloat(p.val) * scale;
            else if (p.code === 20) y1 = -parseFloat(p.val) * scale;
            else if (p.code === 11) x2 = parseFloat(p.val) * scale;
            else if (p.code === 21) y2 = -parseFloat(p.val) * scale;
          });
          if (Math.hypot(x2 - x1, y2 - y1) > 0.02) {
            cadLines.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, layer });
          }
        } else if (entityType === 'LWPOLYLINE') {
          let closed = false, layer = '', curX = null;
          const pts = [];
          readEntity((p) => {
            if (p.code === 8) layer = p.val;
            else if (p.code === 70) closed = (parseInt(p.val, 10) & 1) !== 0;
            else if (p.code === 10) curX = parseFloat(p.val) * scale;
            else if (p.code === 20 && curX !== null) {
              pts.push({ x: curX, y: -parseFloat(p.val) * scale });
              curX = null;
            }
          });
          if (pts.length >= 2) cadPolylines.push({ pts, closed, layer });
        } else if (entityType === 'POLYLINE') {
          // Old-style R12 polyline: header, VERTEX entities, SEQEND.
          let closed = false, layer = '';
          readEntity((p) => {
            if (p.code === 8) layer = p.val;
            else if (p.code === 70) closed = (parseInt(p.val, 10) & 1) !== 0;
          });
          const pts = [];
          while (i < rawLines.length) {
            const entCode = parseInt(rawLines[i].trim(), 10);
            if (entCode !== 0) { i++; continue; }
            const ent = next();
            if (!ent || ent.val !== 'VERTEX') break;
            let vx = null, vy = null;
            readEntity((p) => {
              if (p.code === 10) vx = parseFloat(p.val) * scale;
              else if (p.code === 20) vy = -parseFloat(p.val) * scale;
            });
            if (vx !== null && vy !== null) pts.push({ x: vx, y: vy });
            if (i < rawLines.length) {
              const nextCode = parseInt(rawLines[i].trim(), 10);
              if (nextCode === 0 && rawLines[i + 1] && rawLines[i + 1].trim() === 'SEQEND') {
                next();
                readEntity(() => {});
                break;
              }
            }
          }
          if (pts.length >= 2) cadPolylines.push({ pts, closed, layer });
        } else if (entityType === 'ARC') {
          let cx = 0, cy = 0, r = 0, a0 = 0, a1 = 0, layer = '';
          readEntity((p) => {
            if (p.code === 8) layer = p.val;
            else if (p.code === 10) cx = parseFloat(p.val) * scale;
            else if (p.code === 20) cy = -parseFloat(p.val) * scale;
            else if (p.code === 40) r = parseFloat(p.val) * scale;
            else if (p.code === 50) a0 = parseFloat(p.val);
            else if (p.code === 51) a1 = parseFloat(p.val);
          });
          if (r > 0) cadArcs.push({ cx, cy, r, a0, a1, layer });
        } else if (entityType === 'INSERT') {
          let blockName = '', layer = '', ix = 0, iy = 0, rot = 0, scaleX = 1, scaleY = 1;
          readEntity((p) => {
            if (p.code === 2) blockName = p.val;
            else if (p.code === 8) layer = p.val;
            else if (p.code === 10) ix = parseFloat(p.val) * scale;
            else if (p.code === 20) iy = -parseFloat(p.val) * scale;
            else if (p.code === 50) rot = parseFloat(p.val);
            else if (p.code === 41) scaleX = parseFloat(p.val);
            else if (p.code === 42) scaleY = parseFloat(p.val);
          });
          cadInserts.push({ blockName, layer, x: ix, y: iy, rot, scaleX, scaleY });
        }
      }
    }

    if (!cadLines.length && !cadPolylines.length) {
      throw new Error('No compatible line or polyline entities found in CAD file.');
    }

    const allLayers = new Set();
    cadLines.forEach((e) => allLayers.add(e.layer || '0'));
    cadPolylines.forEach((e) => allLayers.add(e.layer || '0'));
    cadArcs.forEach((e) => allLayers.add(e.layer || '0'));
    cadInserts.forEach((e) => allLayers.add(e.layer || '0'));
    const hasNamedWallLayers = Array.from(allLayers).some(
      (l) => isWallLayer(l) || isExteriorLayer(l)
    );

    const isWallEntityLayer = (layer) => {
      if (isWindowLayer(layer) || isDoorLayer(layer) || isIgnoredLayer(layer)) return false;
      if (isWallLayer(layer) || isExteriorLayer(layer)) return true;
      // Untagged geometry is only treated as a wall when the file does not
      // provide explicit wall layers (common in very old simple DXF files).
      return !hasNamedWallLayers;
    };

    // Layers that are not named like walls but are also not windows, doors or
    // drafting clutter. CAD files often put real partitions on a layer with an
    // unhelpful name ("0", "Blue idk", "A-ARCH"...), so these are kept as
    // candidates and only promoted to walls when they pair up into a wall.
    const isWeakWallEntityLayer = (layer) => {
      if (!hasNamedWallLayers) return false;
      if (isWallEntityLayer(layer)) return false;
      if (isWindowLayer(layer) || isDoorLayer(layer) || isIgnoredLayer(layer)) return false;
      return true;
    };

    // Raw wall geometry
    let wallSegs = [];
    let wallPolys = [];
    cadLines.forEach((l) => {
      if (isWallEntityLayer(l.layer)) wallSegs.push({ a: l.a, b: l.b, layer: l.layer, weak: false });
      else if (isWeakWallEntityLayer(l.layer)) wallSegs.push({ a: l.a, b: l.b, layer: l.layer, weak: true });
    });
    cadPolylines.forEach((p) => {
      const strong = isWallEntityLayer(p.layer);
      const weak = strong ? false : isWeakWallEntityLayer(p.layer);
      if (!strong && !weak) return;
      wallPolys.push(p);
      const count = p.pts.length - (p.closed ? 0 : 1);
      for (let j = 0; j < count; j++) {
        const a = p.pts[j];
        const b = p.pts[(j + 1) % p.pts.length];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 0.02) {
          wallSegs.push({ a, b, layer: p.layer, weak });
        }
      }
    });

    let windowLines = cadLines.filter((l) => isWindowLayer(l.layer));
    let doorLines = cadLines.filter((l) => isDoorLayer(l.layer));
    let arcs = cadArcs.filter((a) => isDoorLayer(a.layer));
    let inserts = cadInserts.slice();

    if (filterOutliers && wallSegs.length > 5) {
      const allPts = [];
      wallSegs.forEach((l) => { allPts.push(l.a); allPts.push(l.b); });
      const xs = allPts.map((p) => p.x).sort((a, b) => a - b);
      const ys = allPts.map((p) => p.y).sort((a, b) => a - b);
      const medX = xs[Math.floor(xs.length / 2)] || 0;
      const medY = ys[Math.floor(ys.length / 2)] || 0;
      const q1X = xs[Math.floor(xs.length * 0.25)] || 0, q3X = xs[Math.floor(xs.length * 0.75)] || 0;
      const q1Y = ys[Math.floor(ys.length * 0.25)] || 0, q3Y = ys[Math.floor(ys.length * 0.75)] || 0;
      const iqrX = Math.max(q3X - q1X, 1);
      const iqrY = Math.max(q3Y - q1Y, 1);

      const isOutlier = (p) =>
        Math.abs(p.x - medX) > iqrX * 4 || Math.abs(p.y - medY) > iqrY * 4;

      wallSegs = wallSegs.filter((l) => !isOutlier(l.a) && !isOutlier(l.b));
      wallPolys = wallPolys.filter((poly) => !poly.pts.some(isOutlier));
      windowLines = windowLines.filter((l) => !isOutlier(l.a) && !isOutlier(l.b));
      doorLines = doorLines.filter((l) => !isOutlier(l.a) && !isOutlier(l.b));
      arcs = arcs.filter((a) => !isOutlier({ x: a.cx, y: a.cy }));
      inserts = inserts.filter((ins) => !isOutlier(ins));
    }

    // Convert extracted CAD entities into a new RoomCraft plan
    const plan = FC.createPlan(options.filename || 'Imported CAD Floorplan');

    // 1. Merge double-line wall faces into centreline walls
    const merged = mergeWallCenterlines(wallSegs, mergeDoubleLines, 0.5, options.debug);
    if (options.debug) console.log('CAD debug raw/merged', wallSegs.length, merged.length, merged.map((w) => [w.a, w.b, w.thickness, w.exterior]));

    const extSamples = merged.filter((w) => w.thickness && w.exterior).map((w) => w.thickness);
    const intSamples = merged.filter((w) => w.thickness && !w.exterior).map((w) => w.thickness);
    const extThickness = Math.max(0.08, Math.min(0.6, median(extSamples) || 0.2));
    const intThickness = Math.max(0.06, Math.min(0.4, median(intSamples) || 0.12));
    plan.settings.extThickness = FC.round(extThickness, 3);
    plan.settings.intThickness = FC.round(intThickness, 3);

    // 2. Determine the building outline.
    // Prefer a closed (or nearly closed) wall polyline that actually covers
    // most of the drawing. Otherwise reconstruct it from the outer wall
    // faces. This prevents a small porch/entry polyline being mistaken for
    // the whole house envelope.
    function polyGap(p) {
      if (p.closed) return 0;
      const a = p.pts[0];
      const b = p.pts[p.pts.length - 1];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    const outerSource = wallSegs.filter((s) => isExteriorLayer(s.layer));
    const boundsSource = outerSource.length ? outerSource : wallSegs;
    const rawPts = [];
    boundsSource.forEach((s) => { rawPts.push(s.a); rawPts.push(s.b); });
    const rawBounds = rawPts.length ? FC.polygonBounds(rawPts) : null;
    const rawBBoxArea = rawBounds ? Math.max(0.01, rawBounds.w * rawBounds.d) : 0;

    let bestOutline = null;
    let bestArea = 0;
    wallPolys.forEach((p) => {
      if (!p.pts || p.pts.length < 3) return;
      const gap = polyGap(p);
      const maxGap = isExteriorLayer(p.layer) ? 1.2 : 0.5;
      if (gap > maxGap) return;
      const area = Math.abs(FC.polygonArea(p.pts));
      if (area < 2) return;
      const b = FC.polygonBounds(p.pts);
      if (!rawBounds) return;
      if (b.w < rawBounds.w * 0.7 || b.d < rawBounds.d * 0.7) return;
      if (area < rawBBoxArea * 0.3) return;
      if (area > bestArea) {
        bestArea = area;
        bestOutline = p.pts;
      }
    });

    if (bestOutline) {
      plan.outline = bestOutline.map((p) => ({ x: FC.round(p.x, 3), y: FC.round(p.y, 3) }));
      plan.settings.extThickness = FC.round(extThickness, 3);
    } else if (rawBounds && rawBounds.w > 0.2 && rawBounds.d > 0.2) {
      const inset = extSamples.length ? extThickness / 2 : 0;
      const x0 = rawBounds.x0 + inset;
      const x1 = rawBounds.x1 - inset;
      const y0 = rawBounds.y0 + inset;
      const y1 = rawBounds.y1 - inset;
      if (x1 - x0 > 0.2 && y1 - y0 > 0.2) {
        plan.outline = [
          { x: FC.round(x0, 3), y: FC.round(y0, 3) },
          { x: FC.round(x1, 3), y: FC.round(y0, 3) },
          { x: FC.round(x1, 3), y: FC.round(y1, 3) },
          { x: FC.round(x0, 3), y: FC.round(y1, 3) },
        ];
      }
    }

    // Fallback for drawings that only contain free wall lines
    if (!plan.outline || plan.outline.length < 3) {
      const allPts = [];
      merged.forEach((s) => { allPts.push(s.a); allPts.push(s.b); });
      if (!allPts.length) throw new Error('No usable wall geometry found in CAD file.');
      const bounds = FC.polygonBounds(allPts);
      plan.outline = [
        { x: bounds.x0, y: bounds.y0 },
        { x: bounds.x1, y: bounds.y0 },
        { x: bounds.x1, y: bounds.y1 },
        { x: bounds.x0, y: bounds.y1 },
      ];
    }

    // 3. Drop wall pieces that are the envelope itself. The outline now owns
    // those walls, so keeping them would duplicate every exterior wall.
    const outlineTol = Math.max(0.16, extThickness * 0.75);
    const interiorCentre = merged.filter((w) => !segLiesOnOutline(w, plan.outline, outlineTol));
    if (options.debug) console.log('CAD debug outline', plan.outline, 'interior', interiorCentre.length, interiorCentre.map((w) => [w.a, w.b]));

    // 4. Close small drafting gaps (doorways and window breaks) so rooms and
    // openings can be recognised on continuous wall segments.
    const interiorBridged = bridgeCollinearWalls(interiorCentre, 1.05);
    plan.walls = interiorBridged.map((w) => ({
      id: FC.uid('w'),
      a: { x: FC.round(w.a.x, 3), y: FC.round(w.a.y, 3) },
      b: { x: FC.round(w.b.x, 3), y: FC.round(w.b.y, 3) },
    }));

    // 5. Heal junctions now, before openings are attached to walls
    if (FC.healWallJunctions) {
      FC.healWallJunctions(plan);
    } else if (FC.closeWallGaps) {
      FC.closeWallGaps(plan, 0.28);
    }
    plan.walls = plan.walls.filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) > 0.05);

    // 6. Doors & windows
    if (importDoors) {
      const bOutline = FC.polygonBounds(plan.outline);
      const bMargin = 0.85;
      const inBuildingBounds = (p) =>
        p.x >= bOutline.x0 - bMargin &&
        p.x <= bOutline.x1 + bMargin &&
        p.y >= bOutline.y0 - bMargin &&
        p.y <= bOutline.y1 + bMargin;

      const segs = FC.getSegments(plan);
      const maxHostDist = Math.max(0.55, extThickness * 2.2);
      // Window symbols are often drawn as a box sitting inside the room next
      // to the wall they belong to, so they get a wider attachment radius than
      // door blocks, which are placed on the wall itself.
      const maxWindowDist = Math.max(1.6, extThickness * 6);

      const addOpening = (op) => {
        const existing = plan.openings.find(
          (o) => o.hostKey === op.hostKey &&
            Math.abs(o.offset - op.offset) < Math.max(0.22, Math.min(o.width, op.width) * 0.6)
        );
        if (existing) {
          if (op.width > existing.width) {
            existing.width = op.width;
            existing.offset = op.offset;
          }
          return;
        }
        plan.openings.push(op);
      };

      // Windows are drawn as parallel line pairs (and often a glazing line)
      // on a Windows layer. Take the longest line of each group so the true
      // opening width wins over the inner glazing line.
      const winCandidates = windowLines
        .filter((l) => inBuildingBounds(l.a) && inBuildingBounds(l.b))
        .map((l) => ({ l, len: Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y) }))
        .filter((x) => x.len >= 0.5 && x.len <= 3.2)
        .sort((a, b) => b.len - a.len);

      winCandidates.forEach(({ l, len }) => {
        const dir = { x: (l.b.x - l.a.x) / len, y: (l.b.y - l.a.y) / len };
        const mid = { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 };
        const host = findHostSegment(segs, mid, dir, maxWindowDist);
        if (options.debug) console.log('WIN', len.toFixed(2), [mid.x.toFixed(2), mid.y.toFixed(2)], 'dir', dir, host ? 'host ' + host.seg.key + ' d=' + host.dist.toFixed(2) : 'NO HOST');
        if (!host) return;
        const width = Math.min(len, host.seg.len - 0.08);
        if (width < 0.5) return;
        const offset = Math.max(width / 2 + 0.01, Math.min(host.seg.len - width / 2 - 0.01, host.t * host.seg.len));
        addOpening({
          id: FC.uid('op'),
          kind: 'window',
          style: 'standard',
          hostKey: host.seg.key,
          offset: FC.round(offset, 3),
          width: FC.round(width, 3),
          height: plan.settings.windowHeight || 1.2,
          sill: plan.settings.windowSill || 0.9,
          hinge: 'left',
          swingSide: 1,
        });
      });

      // Doors are usually arcs (hinge = arc centre, radius = leaf width).
      // The arc has two radii: one is the closed door along the wall, the
      // other is the open leaf. Pick the radius whose midpoint lands on a
      // wall segment parallel to it.
      arcs.forEach((arc) => {
        if (options.debug) console.log('ARC', arc.r.toFixed(2), [arc.cx.toFixed(2), arc.cy.toFixed(2)], arc.a0, arc.a1);
        if (arc.r < 0.4 || arc.r > 1.5) return;
        if (!inBuildingBounds({ x: arc.cx, y: arc.cy })) return;
        const dirs = [
          { x: Math.cos((arc.a0 * Math.PI) / 180), y: -Math.sin((arc.a0 * Math.PI) / 180) },
          { x: Math.cos((arc.a1 * Math.PI) / 180), y: -Math.sin((arc.a1 * Math.PI) / 180) },
        ];

        let best = null;
        dirs.forEach((dir, idx) => {
          const mid = { x: arc.cx + dir.x * arc.r / 2, y: arc.cy + dir.y * arc.r / 2 };
          if (!inBuildingBounds(mid)) return;
          const host = findHostSegment(segs, mid, dir, 0.55);
          if (!host) return;
          const ux = Math.cos(host.seg.angle);
          const uy = Math.sin(host.seg.angle);
          const hingeDist = Math.abs((arc.cx - host.seg.a.x) * uy - (arc.cy - host.seg.a.y) * ux);
          if (hingeDist > 0.45) return;
          const score = host.dist + hingeDist;
          if (!best || score < best.score) best = { host, dir, idx, score };
        });
        if (!best) return;

        const host = best.host;
        const width = Math.min(arc.r, host.seg.len - 0.08);
        if (width < 0.45) return;
        const offset = Math.max(width / 2 + 0.01, Math.min(host.seg.len - width / 2 - 0.01, host.t * host.seg.len));

        // Which end of the opening is the hinge?
        const ux = Math.cos(host.seg.angle);
        const uy = Math.sin(host.seg.angle);
        const hingeParam = ((arc.cx - host.seg.a.x) * ux + (arc.cy - host.seg.a.y) * uy);
        const hinge = hingeParam < offset ? 'left' : 'right';

        // Swing side: the other arc radius points to the open leaf.
        const other = dirs[best.idx === 0 ? 1 : 0];
        const nx = -Math.sin(host.seg.angle);
        const ny = Math.cos(host.seg.angle);
        const swingSide = other.x * nx + other.y * ny >= 0 ? 1 : -1;

        addOpening({
          id: FC.uid('op'),
          kind: 'door',
          style: 'single',
          hostKey: host.seg.key,
          offset: FC.round(offset, 3),
          width: FC.round(width, 3),
          height: plan.settings.doorHeight || 2.1,
          sill: 0,
          hinge,
          swingSide,
        });
      });

      // Door/window blocks (INSERT entities) from CAD libraries
      const inBoundsInserts = inserts.filter(inBuildingBounds);
      inBoundsInserts.forEach((ins) => {
        const isSliding = /sliding|pocket|bypass/i.test(ins.blockName) || /sliding|pocket|bypass/i.test(ins.layer);
        const isBifold = /bifold|folding/i.test(ins.blockName) || /bifold|folding/i.test(ins.layer);
        const isDouble = /double/i.test(ins.blockName);
        const isDoor = isSliding || isBifold || isDouble || /door/i.test(ins.blockName) || isDoorLayer(ins.layer);
        const isWindow = /window|win|glaz/i.test(ins.blockName) || isWindowLayer(ins.layer);
        if (!isDoor && !isWindow) return;

        let width = isDoor ? (plan.settings.doorWidth || 0.9) : (plan.settings.windowWidth || 1.2);
        if (/6FT/i.test(ins.blockName)) width = 1.829;
        else if (/5FT/i.test(ins.blockName)) width = 1.524;
        else if (/4FT/i.test(ins.blockName)) width = 1.219;
        else if (/3FT/i.test(ins.blockName)) width = 0.914;
        else if (/2FT8/i.test(ins.blockName)) width = 0.813;
        else if (/2FT6/i.test(ins.blockName)) width = 0.762;
        else if (/2FT/i.test(ins.blockName)) width = 0.610;
        else if (/1FT/i.test(ins.blockName)) width = 0.305;

        const theta = ((ins.rot || 0) * Math.PI) / 180;
        let dir = { x: Math.cos(theta), y: -Math.sin(theta) };
        let centre = isDoor
          ? { x: ins.x + dir.x * width / 2, y: ins.y + dir.y * width / 2 }
          : { x: ins.x, y: ins.y };
        let host = findHostSegment(segs, centre, dir, maxHostDist);
        // Door blocks are drawn along their local X axis, and CAD users rotate
        // them 0/90/180/270. The stored angle is not always the wall direction,
        // so fall back to the perpendicular axis before giving up.
        if (!host && isDoor) {
          const alt = { x: -dir.y, y: dir.x };
          const altCentre = { x: ins.x + alt.x * width / 2, y: ins.y + alt.y * width / 2 };
          const altHost = findHostSegment(segs, altCentre, alt, maxHostDist);
          if (altHost) {
            dir = alt;
            centre = altCentre;
            host = altHost;
          }
        }
        if (options.debug) console.log('INS', ins.blockName, ins.layer, [ins.x.toFixed(2), ins.y.toFixed(2)], 'rot', ins.rot, host ? 'host ' + host.seg.key : 'NO HOST');
        if (!host) return;
        const w = Math.min(width, host.seg.len - 0.08);
        if (w < 0.3) return;
        const offset = Math.max(w / 2 + 0.01, Math.min(host.seg.len - w / 2 - 0.01, host.t * host.seg.len));
        const leaf = { x: -Math.sin(theta), y: -Math.cos(theta) };
        const nx = -Math.sin(host.seg.angle);
        const ny = Math.cos(host.seg.angle);
        addOpening({
          id: FC.uid('op'),
          kind: isDoor ? 'door' : 'window',
          style: isDoor ? (isSliding ? 'sliding' : (isBifold ? 'bifold' : (isDouble ? 'double' : 'single'))) : 'standard',
          hostKey: host.seg.key,
          offset: FC.round(offset, 3),
          width: FC.round(w, 3),
          height: isDoor ? (plan.settings.doorHeight || 2.1) : (plan.settings.windowHeight || 1.2),
          sill: isDoor ? 0 : (plan.settings.windowSill || 0.9),
          hinge: isDoor ? (ins.x < centre.x + 0.01 ? 'left' : 'right') : 'left',
          swingSide: isDoor ? (leaf.x * nx + leaf.y * ny >= 0 ? 1 : -1) : 1,
        });
      });
    }

    // 7. Normalize coordinates so the plan starts near the origin
    const b = FC.planBounds(plan);
    const shiftX = -b.x0 + 1.0;
    const shiftY = -b.y0 + 1.0;

    plan.outline.forEach((p) => { p.x = FC.round(p.x + shiftX, 3); p.y = FC.round(p.y + shiftY, 3); });
    plan.walls.forEach((w) => {
      w.a.x = FC.round(w.a.x + shiftX, 3); w.a.y = FC.round(w.a.y + shiftY, 3);
      w.b.x = FC.round(w.b.x + shiftX, 3); w.b.y = FC.round(w.b.y + shiftY, 3);
    });

    if (FC.ensureOpeningHosts) {
      FC.ensureOpeningHosts(plan);
    }

    // 8. Auto-detect rooms now that walls and outline are cleanly sealed
    if (FC.detectRooms) {
      plan.rooms = FC.detectRooms(plan);
    }

    return plan;
  };
})();



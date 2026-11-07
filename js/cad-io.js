/* Floorcraft — CAD (DWG/DXF) export and import bridge.
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

    // Header section
    w(0, 'SECTION');
    w(2, 'HEADER');
    w(9, '$ACADVER');
    w(1, 'AC1018'); // AutoCAD 2004 / modern standard
    w(9, '$INSUNITS');
    w(70, 6); // 6 = Meters
    w(9, '$MEASUREMENT');
    w(70, 1); // 1 = Metric
    w(0, 'ENDSEC');

    // Tables section: Layers
    w(0, 'SECTION');
    w(2, 'TABLES');
    w(0, 'TABLE');
    w(2, 'LAYER');
    w(70, 7);

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

    layers.forEach((lay) => {
      w(0, 'LAYER');
      w(2, lay.name);
      w(70, 0);
      w(62, lay.color);
      w(6, 'CONTINUOUS');
    });

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
      w(0, 'LWPOLYLINE');
      w(8, 'WALL_EXTERIOR');
      w(90, outline.length);
      w(70, 1); // 1 = Closed polyline
      w(43, plan.settings ? plan.settings.extThickness || 0.2 : 0.2); // Constant width
      outline.forEach((pt) => {
        w(10, pt.x.toFixed(4));
        w(20, (-pt.y).toFixed(4)); // Flip Y for CAD standard (Y up)
      });
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
        const normalX = -sin;
        const normalY = cos;
        const leafEndX = p1x + normalX * pl.width;
        const leafEndY = p1y + normalY * pl.width;

        // Door leaf
        w(0, 'LINE');
        w(8, layer);
        w(10, p1x.toFixed(4));
        w(20, (-p1y).toFixed(4));
        w(30, 0.0);
        w(11, leafEndX.toFixed(4));
        w(21, (-leafEndY).toFixed(4));
        w(31, 0.0);

        // Door swing arc
        let startAngle = (Math.atan2(-(-p1y + leafEndY), leafEndX - p1x) * 180) / Math.PI;
        let endAngle = (Math.atan2(-(-p1y + p2y), p2x - p1x) * 180) / Math.PI;
        if (startAngle < 0) startAngle += 360;
        if (endAngle < 0) endAngle += 360;

        w(0, 'ARC');
        w(8, layer);
        w(10, p1x.toFixed(4));
        w(20, (-p1y).toFixed(4));
        w(30, 0.0);
        w(40, pl.width.toFixed(4)); // Radius
        w(50, Math.min(startAngle, endAngle).toFixed(2));
        w(51, Math.max(startAngle, endAngle).toFixed(2));
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
    const furniture = FC.furnishPlan ? FC.furnishPlan(plan, rooms) : [];
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

      w(0, 'LWPOLYLINE');
      w(8, 'FURNITURE');
      w(90, 4);
      w(70, 1); // Closed
      corners.forEach((c) => {
        w(10, c.x.toFixed(4));
        w(20, (-c.y).toFixed(4));
      });

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

    const pts = [];
    let doorCount = 0;
    let windowCount = 0;

    entities.forEach((e) => {
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
      } else if (e.type === 'INSERT') {
        const name = (e.props[2] && e.props[2][0]) || '';
        if (/door/i.test(name)) doorCount++;
        if (/window/i.test(name)) windowCount++;
        const x = parseFloat(e.props[10] ? e.props[10][0] : 0);
        const y = parseFloat(e.props[20] ? e.props[20][0] : 0);
        pts.push({ x, y, isInsert: true });
      }
    });

    if (!pts.length) {
      return { rawW: 10, rawH: 10, unit: 'm', unitFactor: 1.0, unitLabel: 'Meters (m)', scaledW: 10, scaledH: 10, entityCount: 0, doorCount: 0, windowCount: 0, outliersFiltered: 0 };
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
    };
  };

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

    let inEntities = false;
    const cadLines = [];
    const cadPolylines = [];
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
          let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
          let layer = '';
          while (i < rawLines.length) {
            const peekCode = parseInt(rawLines[i].trim(), 10);
            if (peekCode === 0) break;
            const p = next();
            if (p.code === 8) layer = p.val;
            else if (p.code === 10) x1 = parseFloat(p.val) * scale;
            else if (p.code === 20) y1 = -parseFloat(p.val) * scale; // Invert CAD Y
            else if (p.code === 11) x2 = parseFloat(p.val) * scale;
            else if (p.code === 21) y2 = -parseFloat(p.val) * scale;
          }
          if (Math.hypot(x2 - x1, y2 - y1) > 0.05) {
            cadLines.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, layer });
          }
        } else if (entityType === 'LWPOLYLINE') {
          let closed = false;
          const pts = [];
          let curX = null;
          let layer = '';
          while (i < rawLines.length) {
            const peekCode = parseInt(rawLines[i].trim(), 10);
            if (peekCode === 0) break;
            const p = next();
            if (p.code === 8) layer = p.val;
            else if (p.code === 70) closed = (parseInt(p.val, 10) & 1) !== 0;
            else if (p.code === 10) curX = parseFloat(p.val) * scale;
            else if (p.code === 20 && curX !== null) {
              pts.push({ x: curX, y: -parseFloat(p.val) * scale });
              curX = null;
            }
          }
          if (pts.length >= 2) {
            cadPolylines.push({ pts, closed, layer });
          }
        } else if (entityType === 'INSERT') {
          let blockName = '', layer = '', ix = 0, iy = 0, rot = 0;
          while (i < rawLines.length) {
            const peekCode = parseInt(rawLines[i].trim(), 10);
            if (peekCode === 0) break;
            const p = next();
            if (p.code === 2) blockName = p.val;
            else if (p.code === 8) layer = p.val;
            else if (p.code === 10) ix = parseFloat(p.val) * scale;
            else if (p.code === 20) iy = -parseFloat(p.val) * scale;
            else if (p.code === 50) rot = parseFloat(p.val);
          }
          cadInserts.push({ blockName, layer, x: ix, y: iy, rot });
        }
      }
    }

    if (!cadLines.length && !cadPolylines.length) {
      throw new Error('No compatible line or polyline entities found in CAD file.');
    }

    // Outlier filtering if enabled
    let validLines = cadLines;
    let validPolys = cadPolylines;
    let validInserts = cadInserts;

    if (filterOutliers && (cadLines.length + cadPolylines.length) > 5) {
      const allPts = [];
      cadLines.forEach((l) => { allPts.push(l.a); allPts.push(l.b); });
      cadPolylines.forEach((p) => p.pts.forEach((pt) => allPts.push(pt)));
      const xs = allPts.map((p) => p.x).sort((a, b) => a - b);
      const ys = allPts.map((p) => p.y).sort((a, b) => a - b);
      const medX = xs[Math.floor(xs.length / 2)] || 0;
      const medY = ys[Math.floor(ys.length / 2)] || 0;
      const q1X = xs[Math.floor(xs.length * 0.25)] || 0, q3X = xs[Math.floor(xs.length * 0.75)] || 0;
      const q1Y = ys[Math.floor(ys.length * 0.25)] || 0, q3Y = ys[Math.floor(ys.length * 0.75)] || 0;
      const iqrX = Math.max(q3X - q1X, 1);
      const iqrY = Math.max(q3Y - q1Y, 1);

      function isOutlier(p) {
        return Math.abs(p.x - medX) > iqrX * 4 || Math.abs(p.y - medY) > iqrY * 4;
      }

      validLines = cadLines.filter((l) => !isOutlier(l.a) && !isOutlier(l.b));
      validPolys = cadPolylines.filter((poly) => !poly.pts.some(isOutlier));
      validInserts = cadInserts.filter((ins) => !isOutlier(ins));
    }

    // Convert extracted CAD entities into a new Floorcraft Plan
    const plan = FC.createPlan(options.filename || 'Imported CAD Floorplan');

    // 1. Identify outer boundary & concentric outer wall shells
    const closedPolys = validPolys.filter((p) => p.closed && p.pts.length >= 3);
    closedPolys.sort((p1, p2) => Math.abs(FC.polygonArea(p2.pts)) - Math.abs(FC.polygonArea(p1.pts)));

    let bestOutline = null;
    let extThickness = 0.2;
    const excludedPolys = new Set();

    if (closedPolys.length > 0) {
      const p1 = closedPolys[0];
      const area1 = Math.abs(FC.polygonArea(p1.pts));
      if (area1 > 2) {
        bestOutline = p1.pts;
        excludedPolys.add(p1);

        // Check if second largest closed polyline is the interior shell of the exterior wall
        if (closedPolys.length >= 2) {
          const p2 = closedPolys[1];
          const area2 = Math.abs(FC.polygonArea(p2.pts));
          if (area2 > area1 * 0.65 && p2.pts.length === p1.pts.length) {
            let distSum = 0;
            for (let k = 0; k < p1.pts.length; k++) {
              distSum += Math.hypot(p1.pts[k].x - p2.pts[k].x, p1.pts[k].y - p2.pts[k].y);
            }
            const avgDist = distSum / p1.pts.length;
            if (avgDist > 0.05 && avgDist < 0.6) {
              extThickness = FC.round(avgDist, 3);
              excludedPolys.add(p2); // Exclude duplicate inner shell from interior walls
            }
          }
        }
      }
    }

    if (bestOutline) {
      plan.outline = bestOutline.map((p) => ({ x: FC.round(p.x, 3), y: FC.round(p.y, 3) }));
      plan.settings.extThickness = extThickness;
    }

    // 2. Interior Walls
    const allSegs = [];
    validLines.forEach((l) => allSegs.push({ a: l.a, b: l.b }));
    validPolys.forEach((poly) => {
      if (!excludedPolys.has(poly)) {
        for (let j = 0; j < poly.pts.length - (poly.closed ? 0 : 1); j++) {
          const a = poly.pts[j];
          const b = poly.pts[(j + 1) % poly.pts.length];
          if (Math.hypot(b.x - a.x, b.y - a.y) > 0.05) {
            allSegs.push({ a, b });
          }
        }
      }
    });

    // If no outline was found from polylines, construct bounding outline
    if (!plan.outline || plan.outline.length < 3) {
      const allPts = [];
      allSegs.forEach((s) => { allPts.push(s.a); allPts.push(s.b); });
      const bounds = FC.polygonBounds(allPts);
      plan.outline = [
        { x: bounds.x0, y: bounds.y0 },
        { x: bounds.x1, y: bounds.y0 },
        { x: bounds.x1, y: bounds.y1 },
        { x: bounds.x0, y: bounds.y1 },
      ];
    }

    // Filter segments that duplicate outline
    const cleanSegs = [];
    const out = plan.outline || [];
    allSegs.forEach((s) => {
      const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      if (len < 0.15) return;

      let isOutline = false;
      for (let k = 0; k < out.length; k++) {
        const oa = out[k];
        const ob = out[(k + 1) % out.length];
        const d1 = Math.hypot(oa.x - s.a.x, oa.y - s.a.y) + Math.hypot(ob.x - s.b.x, ob.y - s.b.y);
        const d2 = Math.hypot(oa.x - s.b.x, oa.y - s.a.y) + Math.hypot(ob.x - s.a.x, ob.y - s.b.y);
        if (d1 < 0.12 || d2 < 0.12) {
          isOutline = true;
          break;
        }
      }
      if (!isOutline) cleanSegs.push(s);
    });

    // 3. Double-line wall consolidation
    if (mergeDoubleLines) {
      const used = new Set();
      let detectedIntThickness = 0.12;

      for (let j = 0; j < cleanSegs.length; j++) {
        if (used.has(j)) continue;
        const s1 = cleanSegs[j];
        const dx1 = s1.b.x - s1.a.x, dy1 = s1.b.y - s1.a.y;
        const len1 = Math.hypot(dx1, dy1);
        if (len1 < 0.1) continue;
        const ux1 = dx1 / len1, uy1 = dy1 / len1;
        const nx1 = -uy1, ny1 = ux1;
        const angle1 = Math.atan2(dy1, dx1);

        let merged = false;
        for (let k = j + 1; k < cleanSegs.length; k++) {
          if (used.has(k)) continue;
          const s2 = cleanSegs[k];
          const dx2 = s2.b.x - s2.a.x, dy2 = s2.b.y - s2.a.y;
          const len2 = Math.hypot(dx2, dy2);
          if (len2 < 0.1) continue;
          const angle2 = Math.atan2(dy2, dx2);

          let diff = Math.abs(angle1 - angle2);
          while (diff > Math.PI) diff -= Math.PI;
          if (diff > Math.PI / 2) diff = Math.PI - diff;

          if (diff < 0.14) {
            const mid2 = { x: (s2.a.x + s2.b.x) / 2, y: (s2.a.y + s2.b.y) / 2 };
            const perpDist = Math.abs((mid2.x - s1.a.x) * dy1 - (mid2.y - s1.a.y) * dx1) / len1;
            if (perpDist >= 0.04 && perpDist <= 0.45) {
              const tA = ((s2.a.x - s1.a.x) * dx1 + (s2.a.y - s1.a.y) * dy1) / (len1 * len1);
              const tB = ((s2.b.x - s1.a.x) * dx1 + (s2.b.y - s1.a.y) * dy1) / (len1 * len1);
              if (Math.max(tA, tB) > -0.15 && Math.min(tA, tB) < 1.15) {
                const offset = (mid2.x - s1.a.x) * nx1 + (mid2.y - s1.a.y) * ny1;
                const halfOffset = offset / 2;
                const p0 = { x: s1.a.x + nx1 * halfOffset, y: s1.a.y + ny1 * halfOffset };
                const proj = (p) => (p.x - p0.x) * ux1 + (p.y - p0.y) * uy1;
                const tMin = Math.min(proj(s1.a), proj(s1.b), proj(s2.a), proj(s2.b));
                const tMax = Math.max(proj(s1.a), proj(s1.b), proj(s2.a), proj(s2.b));

                plan.walls.push({
                  id: FC.uid('w'),
                  a: { x: FC.round(p0.x + ux1 * tMin, 3), y: FC.round(p0.y + uy1 * tMin, 3) },
                  b: { x: FC.round(p0.x + ux1 * tMax, 3), y: FC.round(p0.y + uy1 * tMax, 3) },
                });
                detectedIntThickness = FC.round(perpDist, 2);
                used.add(j);
                used.add(k);
                merged = true;
                break;
              }
            }
          }
        }
        if (!merged) {
          plan.walls.push({
            id: FC.uid('w'),
            a: { x: FC.round(s1.a.x, 3), y: FC.round(s1.a.y, 3) },
            b: { x: FC.round(s1.b.x, 3), y: FC.round(s1.b.y, 3) },
          });
        }
      }
      if (detectedIntThickness >= 0.05 && detectedIntThickness <= 0.35) {
        plan.settings.intThickness = detectedIntThickness;
      }
    } else {
      cleanSegs.forEach((s) => {
        plan.walls.push({
          id: FC.uid('w'),
          a: { x: FC.round(s.a.x, 3), y: FC.round(s.a.y, 3) },
          b: { x: FC.round(s.b.x, 3), y: FC.round(s.b.y, 3) },
        });
      });
    }

    // 4. Doors & Windows from INSERT blocks
    if (importDoors && validInserts.length) {
      const segs = FC.getSegments(plan);
      validInserts.forEach((ins) => {
        const isDoor = /door/i.test(ins.blockName);
        const isWindow = /window/i.test(ins.blockName);
        if (!isDoor && !isWindow) return;

        let w = isDoor ? plan.settings.doorWidth || 0.9 : plan.settings.windowWidth || 1.2;
        if (/3FT/i.test(ins.blockName)) w = 0.914;
        else if (/2FT8/i.test(ins.blockName)) w = 0.813;
        else if (/2FT6/i.test(ins.blockName)) w = 0.762;
        else if (/4FT/i.test(ins.blockName)) w = 1.219;
        else if (/5FT/i.test(ins.blockName)) w = 1.524;
        else if (/6FT/i.test(ins.blockName)) w = 1.829;

        // Find nearest segment
        let bestSeg = null;
        let bestDist = Infinity;
        let bestOffset = 0;

        segs.forEach((s) => {
          const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
          const len = s.len;
          if (len < 0.2) return;
          const t = ((ins.x - s.a.x) * dx + (ins.y - s.a.y) * dy) / (len * len);
          if (t >= -0.05 && t <= 1.05) {
            const px = s.a.x + Math.max(0, Math.min(1, t)) * dx;
            const py = s.a.y + Math.max(0, Math.min(1, t)) * dy;
            const d = Math.hypot(ins.x - px, ins.y - py);
            if (d < bestDist) {
              bestDist = d;
              bestSeg = s;
              bestOffset = Math.max(w / 2 + 0.05, Math.min(len - w / 2 - 0.05, t * len));
            }
          }
        });

        if (bestSeg && bestDist < 1.2) {
          plan.openings.push({
            id: FC.uid('op'),
            kind: isDoor ? 'door' : 'window',
            style: isDoor ? 'single' : 'standard',
            hostKey: bestSeg.key,
            offset: FC.round(bestOffset, 3),
            width: FC.round(w, 3),
            height: isDoor ? plan.settings.doorHeight || 2.1 : plan.settings.windowHeight || 1.2,
            sill: isDoor ? 0 : plan.settings.windowSill || 0.9,
          });
        }
      });
    }

    // 5. Normalize coordinates so min coordinates are nicely centered near origin
    const b = FC.planBounds(plan);
    const shiftX = -b.x0 + 1.0;
    const shiftY = -b.y0 + 1.0;

    plan.outline.forEach((p) => { p.x = FC.round(p.x + shiftX, 3); p.y = FC.round(p.y + shiftY, 3); });
    plan.walls.forEach((w) => {
      w.a.x = FC.round(w.a.x + shiftX, 3); w.a.y = FC.round(w.a.y + shiftY, 3);
      w.b.x = FC.round(w.b.x + shiftX, 3); w.b.y = FC.round(w.b.y + shiftY, 3);
    });

    return plan;
  };
})();

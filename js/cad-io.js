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
  /* DXF Parser (Import)                                                */
  /* ------------------------------------------------------------------ */

  CAD.importDXF = function (text, options) {
    options = options || {};
    const scale = options.scale || 1.0; // 1.0 if meters, 0.001 if mm, 0.0254 if inches

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
        }
      }
    }

    if (!cadLines.length && !cadPolylines.length) {
      throw new Error('No compatible line or polyline entities found in CAD file.');
    }

    // Convert extracted CAD entities into a new Floorcraft Plan
    const plan = FC.createPlan(options.filename || 'Imported CAD Floorplan');

    // 1. Identify outer boundary
    // Prefer closed polyline on WALL_EXTERIOR or largest closed polyline/loop
    let bestOutline = null;
    let maxArea = 0;

    cadPolylines.forEach((poly) => {
      if (poly.pts.length >= 3) {
        const area = Math.abs(FC.polygonArea(poly.pts));
        if (area > maxArea) {
          maxArea = area;
          bestOutline = poly.pts;
        }
      }
    });

    if (bestOutline && maxArea > 2) {
      plan.outline = bestOutline.map((p) => ({ x: FC.round(p.x, 3), y: FC.round(p.y, 3) }));
    }

    // 2. Interior Walls
    const allSegs = [];
    cadLines.forEach((l) => allSegs.push({ a: l.a, b: l.b }));
    cadPolylines.forEach((poly) => {
      if (poly.pts !== bestOutline) {
        for (let j = 0; j < poly.pts.length - (poly.closed ? 0 : 1); j++) {
          const a = poly.pts[j];
          const b = poly.pts[(j + 1) % poly.pts.length];
          allSegs.push({ a, b });
        }
      }
    });

    // If no outline was found from polylines, construct bounding outline or use outer convex/bounds
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

    // Add interior walls (filter out lines that duplicate the boundary outline)
    allSegs.forEach((s) => {
      const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      if (len < 0.2) return;

      // Check if duplicate of boundary segment
      let isOutline = false;
      const out = plan.outline;
      for (let k = 0; k < out.length; k++) {
        const oa = out[k];
        const ob = out[(k + 1) % out.length];
        const d1 = Math.hypot(oa.x - s.a.x, oa.y - s.a.y) + Math.hypot(ob.x - s.b.x, ob.y - s.b.y);
        const d2 = Math.hypot(oa.x - s.b.x, oa.y - s.a.y) + Math.hypot(ob.x - s.a.x, ob.y - s.b.y);
        if (d1 < 0.1 || d2 < 0.1) {
          isOutline = true;
          break;
        }
      }

      if (!isOutline) {
        plan.walls.push({
          id: FC.uid('w'),
          a: { x: FC.round(s.a.x, 3), y: FC.round(s.a.y, 3) },
          b: { x: FC.round(s.b.x, 3), y: FC.round(s.b.y, 3) },
        });
      }
    });

    // Normalize coordinates so min coordinates are nicely centered near origin
    const b = FC.planBounds(plan);
    const shiftX = -b.x0 + 1.0;
    const shiftY = -b.y0 + 1.0;

    plan.outline.forEach((p) => { p.x += shiftX; p.y += shiftY; });
    plan.walls.forEach((w) => {
      w.a.x += shiftX; w.a.y += shiftY;
      w.b.x += shiftX; w.b.y += shiftY;
    });

    return plan;
  };
})();

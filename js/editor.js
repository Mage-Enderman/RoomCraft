/* RoomCraft — 2D plan editor */
(function () {
  const FC = (window.FC = window.FC || {});
  const TAU = Math.PI * 2;
  const ACCENT = '#5b4bf6';
  const CANVAS_BG = '#f7f7f8';
  const INK = '#26262a';
  const MUTED = '#8a8b93';

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  class Editor2D {
    constructor(canvas, app) {
      this.canvas = canvas;
      this.app = app;
      this.ctx = canvas.getContext('2d');
      this.W = 1;
      this.H = 1;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.view = { cx: 5.5, cy: 4, scale: 80 };
      this.showGrid = true;
      this.gridSnap = true;
      this.orthoSnap = true;
      this.altDown = false;
      this.spaceDown = false;
      this.pointer = { sx: 0, sy: 0, wx: 0, wy: 0, inside: false };
      this.snap = null;
      this.hover = null;
      this.drag = null;
      this.wallChain = null;
      this.chainFirst = null;
      this.chainJustStarted = false;
      this.rectStart = null;
      this.measureStart = null;
      this.measureEnd = null;
      this.lengthBuffer = '';
      this.lastAngle = 0;
      this.hoverOpeningWall = null;
      this._bind();
      this.resize();
    }

    /* ---------------------------------------------------------------- */
    /* View                                                              */
    /* ---------------------------------------------------------------- */

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.W = Math.max(1, rect.width);
      this.H = Math.max(1, rect.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.draw();
    }

    w2s(p) {
      return { x: (p.x - this.view.cx) * this.view.scale + this.W / 2, y: (p.y - this.view.cy) * this.view.scale + this.H / 2 };
    }
    s2w(sx, sy) {
      return { x: (sx - this.W / 2) / this.view.scale + this.view.cx, y: (sy - this.H / 2) / this.view.scale + this.view.cy };
    }

    fit() {
      const b = FC.planBounds(this.app.plan);
      if (!b || !isFinite(b.w)) return;
      const sidebar = this.app.ui && this.app.ui.sidebarOpen !== false ? 330 : 0;
      const compact = window.innerWidth <= 900;
      const padX = compact ? 48 : 120;
      // Below 1180px the stepper drops to a second row, so keep the top
      // dimension line clear of it.
      const padTop = window.innerWidth <= 1180 ? 196 : 148;
      const padBottom = compact ? 96 : 118;
      const availW = Math.max(160, this.W - sidebar - padX * 2);
      const availH = Math.max(160, this.H - padTop - padBottom);
      const bw = Math.max(b.w, 2);
      const bd = Math.max(b.d, 2);
      let scale = Math.min(availW / bw, availH / bd, 150);
      scale = Math.max(0.01, scale);
      this.view.scale = scale;
      const targetX = (this.W - sidebar) / 2;
      const targetY = padTop + availH / 2;
      this.view.cx = b.cx + (this.W / 2 - targetX) / scale;
      this.view.cy = b.cy + (this.H / 2 - targetY) / scale;
      this.updateZoomLabel();
      this.draw();
    }

    zoomBy(factor, anchor) {
      const a = anchor || { x: this.W / 2, y: this.H / 2 };
      const before = this.s2w(a.x, a.y);
      this.view.scale = FC.clamp(this.view.scale * factor, 0.01, 1500);
      const after = this.s2w(a.x, a.y);
      this.view.cx += before.x - after.x;
      this.view.cy += before.y - after.y;
      this.updateZoomLabel();
      this.draw();
    }

    setZoom(percent) {
      const target = FC.clamp((percent / 100) * 80, 0.01, 1500);
      this.zoomBy(target / this.view.scale);
    }

    updateZoomLabel() {
      const el = document.getElementById('zoomValue');
      if (el) {
        const pct = (this.view.scale / 80) * 100;
        el.textContent = pct < 10 ? pct.toFixed(1) + '%' : Math.round(pct) + '%';
      }
    }

    centerOn(x, y) {
      this.view.cx = x;
      this.view.cy = y;
      this.draw();
    }

    /* ---------------------------------------------------------------- */
    /* Coordinate helpers                                                */
    /* ---------------------------------------------------------------- */

    eventPoint(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    updatePointer(e) {
      const s = this.eventPoint(e);
      const w = this.s2w(s.x, s.y);
      this.pointer = { sx: s.x, sy: s.y, wx: w.x, wy: w.y, inside: true };
      return w;
    }

    gridStep() {
      if (FC.isImperial && FC.isImperial(this.app.plan)) {
        const ft = FC.FEET_TO_METERS || 0.3048;
        const c = [ft * 0.25, ft * 0.5, ft, ft * 2, ft * 5, ft * 10, ft * 20, ft * 50, ft * 100];
        for (const s of c) if (s * this.view.scale >= 15) return s;
        return ft * 100;
      }
      const c = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
      for (const s of c) if (s * this.view.scale >= 15) return s;
      return 1000;
    }

    snapGridValue(val) {
      if (FC.isImperial && FC.isImperial(this.app.plan)) {
        const step = this.view.scale > 120 ? 3 * (FC.INCHES_TO_METERS || 0.0254) : 6 * (FC.INCHES_TO_METERS || 0.0254);
        return Math.round(val / step) * step;
      }
      const step = this.view.scale > 150 ? 0.05 : 0.1;
      return Math.round(val / step) * step;
    }

    screenTol(px) {
      return px / this.view.scale;
    }

    allVertices() {
      const out = [];
      (this.app.plan.outline || []).forEach((p, i) => out.push({ p, type: 'vertex', index: i, label: 'Corner' }));
      (this.app.plan.walls || []).forEach((w) => {
        out.push({ p: w.a, type: 'wall-end', wallId: w.id, end: 0, label: 'Endpoint' });
        out.push({ p: w.b, type: 'wall-end', wallId: w.id, end: 1, label: 'Endpoint' });
      });
      const draggingRoomId = this.drag && this.drag.type === 'room-vertex' ? this.drag.roomId : null;
      const draggingIdx = this.drag && this.drag.type === 'room-vertex' ? this.drag.index : -1;
      (this.app.rooms || []).forEach((r) => {
        if (!r || !Array.isArray(r.polygon)) return;
        r.polygon.forEach((p, i) => {
          if (r.id === draggingRoomId && i === draggingIdx) return;
          out.push({ p, type: 'room-vertex', roomId: r.id, index: i, label: 'Room Corner' });
        });
      });
      return out;
    }

    /* ---------------------------------------------------------------- */
    /* Snapping                                                          */
    /* ---------------------------------------------------------------- */

    snapPoint(raw, from, opts) {
      opts = opts || {};
      const plan = this.app.plan;
      const tol = this.screenTol(12);
      let best = null;

      // When user holds Alt, bypass all snapping completely for free movement
      if (this.altDown) {
        return { point: { x: raw.x, y: raw.y }, type: 'free', label: '' };
      }

      // First corner / closing loop
      if (opts.outline && plan.outline.length >= 3) {
        const first = plan.outline[0];
        if (FC.dist(raw, first) < this.screenTol(16)) {
          return { point: { x: first.x, y: first.y }, type: 'close', label: 'Close outline', index: 0 };
        }
      }
      if (opts.chainFirst && FC.dist(raw, opts.chainFirst) < this.screenTol(14)) {
        return { point: { x: opts.chainFirst.x, y: opts.chainFirst.y }, type: 'close', label: 'Close loop' };
      }

      // Existing corners / endpoints / room corners
      const verts = this.allVertices();
      for (const v of verts) {
        const d = FC.dist(raw, v.p);
        if (d <= tol && (!best || d < best.d)) best = { d, point: { x: v.p.x, y: v.p.y }, type: 'point', label: v.label, hit: v };
      }
      if (best) return best;

      // Doors & openings snapping
      if (FC.getOpeningSnapPoints) {
        const opSnaps = FC.getOpeningSnapPoints(plan);
        for (const opPt of opSnaps) {
          const d = FC.dist(raw, opPt);
          if (d <= tol && (!best || d < best.d)) {
            best = { d, point: { x: opPt.x, y: opPt.y }, type: 'door', label: opPt.label, hit: opPt };
          }
        }
        if (best) return best;
      }

      // Wall midpoint snapping
      const segs = FC.getSegments(plan);
      for (const seg of segs) {
        if (seg.len < 0.4) continue;
        const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
        const d = FC.dist(raw, mid);
        if (d <= this.screenTol(11) && (!best || d < best.d)) {
          best = { d, point: mid, type: 'midpoint', label: 'Midpoint', seg };
        }
      }
      if (best) return best;

      const snapAngle = (opts.ortho || this.app.ui.ortho || this.app.plan.settings.snapAngle !== false);
      const snapGrid = this.gridSnap && this.app.plan.settings.snapGrid !== false && opts.grid !== false;

      // Wall ∩ Ortho intersection: prefer the exact crossing with any nearby wall so an
      // orthogonally-drawn edge lands on the wall line instead of drifting or stopping at the grid.
      if (from && snapAngle) {
        const angle = Math.atan2(raw.y - from.y, raw.x - from.x);
        const isHorizTry =
          Math.abs(raw.y - from.y) <= this.screenTol(14) ||
          Math.abs(FC.angleDiff(angle, 0)) < 0.17 ||
          Math.abs(FC.angleDiff(angle, Math.PI)) < 0.17;
        const isVertTry =
          Math.abs(raw.x - from.x) <= this.screenTol(14) ||
          Math.abs(FC.angleDiff(angle, Math.PI / 2)) < 0.17 ||
          Math.abs(FC.angleDiff(angle, -Math.PI / 2)) < 0.17;

        let bestInter = null;
        for (let s = 0; s < segs.length; s++) {
          const seg = segs[s];
          if (!seg || seg.len < 0.15) continue;
          const sdx = seg.b.x - seg.a.x;
          const sdy = seg.b.y - seg.a.y;

          if (isHorizTry && Math.abs(sdy) > 0.05) {
            const t = (from.y - seg.a.y) / sdy;
            if (t >= -0.02 && t <= 1.02) {
              const ipt = { x: FC.round(seg.a.x + sdx * t, 4), y: from.y };
              const d = FC.dist(raw, ipt);
              if (d <= this.screenTol(18) && (!bestInter || d < bestInter.d)) {
                bestInter = { d, point: ipt, seg, t, axis: 'Horizontal' };
              }
            }
          }
          if (isVertTry && Math.abs(sdx) > 0.05) {
            const t = (from.x - seg.a.x) / sdx;
            if (t >= -0.02 && t <= 1.02) {
              const ipt = { x: from.x, y: FC.round(seg.a.y + sdy * t, 4) };
              const d = FC.dist(raw, ipt);
              if (d <= this.screenTol(18) && (!bestInter || d < bestInter.d)) {
                bestInter = { d, point: ipt, seg, t, axis: 'Vertical' };
              }
            }
          }
        }
        if (bestInter) {
          return {
            point: bestInter.point,
            type: 'wall',
            label: 'Wall ∩ ' + bestInter.axis,
            seg: bestInter.seg,
            offset: FC.clamp(bestInter.t, 0, 1) * bestInter.seg.len,
          };
        }
      }

      // Nearest wall
      const wallHit = FC.nearestWall(plan, raw, this.screenTol(11));
      if (wallHit) {
        return { point: wallHit.point, type: 'wall', label: 'Wall', seg: wallHit.seg, offset: wallHit.offset };
      }

      // Nearest existing room boundary edge
      const draggingRoomId = this.drag && this.drag.type === 'room-vertex' ? this.drag.roomId : null;
      let bestRoomEdge = null;
      (this.app.rooms || []).forEach((r) => {
        if (!r || !Array.isArray(r.polygon) || r.polygon.length < 3 || r.id === draggingRoomId) return;
        const poly = r.polygon;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          const h = FC.pointSegment(raw, a, b);
          if (h.dist <= this.screenTol(10) && (!bestRoomEdge || h.dist < bestRoomEdge.dist)) {
            bestRoomEdge = { dist: h.dist, point: h.point, a, b, room: r };
          }
        }
      });
      if (bestRoomEdge) {
        let rpt = { x: FC.round(bestRoomEdge.point.x, 4), y: FC.round(bestRoomEdge.point.y, 4) };
        if (from && snapAngle) {
          const rdx = bestRoomEdge.b.x - bestRoomEdge.a.x;
          const rdy = bestRoomEdge.b.y - bestRoomEdge.a.y;
          if (Math.abs(raw.y - from.y) <= this.screenTol(14) && Math.abs(rdy) > 0.05) {
            const t = (from.y - bestRoomEdge.a.y) / rdy;
            if (t >= -0.02 && t <= 1.02) rpt = { x: FC.round(bestRoomEdge.a.x + rdx * t, 4), y: from.y };
          } else if (Math.abs(raw.x - from.x) <= this.screenTol(14) && Math.abs(rdx) > 0.05) {
            const t = (from.x - bestRoomEdge.a.x) / rdx;
            if (t >= -0.02 && t <= 1.02) rpt = { x: from.x, y: FC.round(bestRoomEdge.a.y + rdy * t, 4) };
          }
        }
        return { point: rpt, type: 'wall', label: 'Room Boundary' };
      }

      // Orthogonal / rotational angle snapping
      if (from && snapAngle) {
        const dx = raw.x - from.x;
        const dy = raw.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.001) {
          let angle = Math.atan2(dy, dx);
          let snapped = false;
          let label = 'Ortho';

          const nearest90 = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
          const diff90 = Math.abs(FC.angleDiff(angle, nearest90));
          const nearest45 = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const diff45 = Math.abs(FC.angleDiff(angle, nearest45));

          if (diff90 < 0.17) { // ~9.8° magnetic threshold for horizontal and vertical straight walls
            angle = nearest90;
            snapped = true;
            const deg = Math.round(((nearest90 * 180) / Math.PI + 360) % 360);
            label = deg === 0 || deg === 180 ? 'Horizontal (0°)' : 'Vertical (90°)';
          } else if (diff45 < 0.10) { // ~5.7° magnetic threshold for 45°
            angle = nearest45;
            snapped = true;
            label = 'Angle 45°';
          } else if (opts.ortho || this.app.ui.ortho) {
            angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
            snapped = true;
            label = Math.round(((angle * 180) / Math.PI + 360) % 360) + '°';
          }

          if (snapped) {
            let point;
            const isHorizontal = Math.abs(Math.sin(angle)) < 1e-4;
            const isVertical = Math.abs(Math.cos(angle)) < 1e-4;
            const alignGuides = [];
            const alignTol = this.screenTol(7);

            if (isHorizontal) {
              const sign = Math.cos(angle) >= 0 ? 1 : -1;
              point = { x: from.x + sign * len, y: from.y };
              // Check vertical alignment with existing vertices
              let alignedX = false;
              for (const v of verts) {
                if (Math.abs(v.p.x - point.x) < alignTol && Math.abs(v.p.y - point.y) > 0.05) {
                  point.x = v.p.x;
                  alignGuides.push({ from: v.p, to: point, axis: 'x' });
                  alignedX = true;
                  break;
                }
              }
              if (!alignedX && snapGrid) point.x = this.snapGridValue(point.x);
            } else if (isVertical) {
              const sign = Math.sin(angle) >= 0 ? 1 : -1;
              point = { x: from.x, y: from.y + sign * len };
              let alignedY = false;
              for (const v of verts) {
                if (Math.abs(v.p.y - point.y) < alignTol && Math.abs(v.p.x - point.x) > 0.05) {
                  point.y = v.p.y;
                  alignGuides.push({ from: v.p, to: point, axis: 'y' });
                  alignedY = true;
                  break;
                }
              }
              if (!alignedY && snapGrid) point.y = this.snapGridValue(point.y);
            } else {
              point = { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len };
              if (snapGrid) {
                point.x = this.snapGridValue(point.x);
                point.y = this.snapGridValue(point.y);
              }
            }
            this.lastAngle = angle;
            return { point, type: 'axis', label, from, alignGuides };
          }
        }
      }

      // Smart alignment guides with existing vertices (extension tracking)
      if (snapAngle && verts.length > 0) {
        const alignTol = this.screenTol(7);
        let snapX = null;
        let snapY = null;
        for (const v of verts) {
          const dx = Math.abs(raw.x - v.p.x);
          const dy = Math.abs(raw.y - v.p.y);
          if (dx < alignTol && dy > 0.05 && (!snapX || dx < snapX.d)) {
            snapX = { d: dx, val: v.p.x, from: v.p };
          }
          if (dy < alignTol && dx > 0.05 && (!snapY || dy < snapY.d)) {
            snapY = { d: dy, val: v.p.y, from: v.p };
          }
        }
        if (snapX || snapY) {
          const point = {
            x: snapX ? snapX.val : (snapGrid ? this.snapGridValue(raw.x) : raw.x),
            y: snapY ? snapY.val : (snapGrid ? this.snapGridValue(raw.y) : raw.y),
          };
          const alignGuides = [];
          if (snapX) alignGuides.push({ from: snapX.from, to: point, axis: 'x' });
          if (snapY) alignGuides.push({ from: snapY.from, to: point, axis: 'y' });
          return {
            point,
            type: 'align',
            label: snapX && snapY ? 'Align X & Y' : 'Align',
            alignGuides,
          };
        }
      }

      // Grid
      if (snapGrid) {
        const point = { x: this.snapGridValue(raw.x), y: this.snapGridValue(raw.y) };
        return { point, type: 'grid', label: 'Grid' };
      }
      return { point: { x: raw.x, y: raw.y }, type: 'free', label: '' };
    }

    typedPoint(from) {
      const v = FC.parseLengthInput ? FC.parseLengthInput(this.lengthBuffer, this.app.plan) : parseFloat(this.lengthBuffer);
      if (v === null || !isFinite(v) || v <= 0) return null;
      let angle = this.lastAngle;
      if (this.pointer.inside) {
        const dx = this.pointer.wx - from.x;
        const dy = this.pointer.wy - from.y;
        if (Math.hypot(dx, dy) > 0.001) angle = Math.atan2(dy, dx);
      }
      if (this.app.ui.ortho) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
      else {
        const near = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(FC.angleDiff(angle, near)) < 0.065) angle = near;
      }
      this.lastAngle = angle;
      return { x: from.x + Math.cos(angle) * v, y: from.y + Math.sin(angle) * v };
    }

    /* ---------------------------------------------------------------- */
    /* Events                                                            */
    /* ---------------------------------------------------------------- */

    _bind() {
      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      c.addEventListener('pointermove', (e) => this.onPointerMove(e));
      c.addEventListener('pointerup', (e) => this.onPointerUp(e));
      c.addEventListener('pointercancel', () => this.endDrag());
      c.addEventListener('dblclick', (e) => this.onDoubleClick(e));
      c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      c.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.onContextMenu(e);
      });
      c.addEventListener('pointerenter', () => (this.pointer.inside = true));
      c.addEventListener('pointerleave', () => {
        this.pointer.inside = false;
        if (!this.drag) {
          this.snap = null;
          this.hover = null;
          this.draw();
        }
      });
      window.addEventListener('resize', () => {
        this.resize();
        clearTimeout(this._fitTimer);
        this._fitTimer = setTimeout(() => {
          if (this.app.ui && this.app.ui.view3d) return;
          if (this.app.plan && this.app.plan.outline && this.app.plan.outline.length >= 3) this.fit();
        }, 140);
      });
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') this.spaceDown = false;
        if (e.key === 'Alt') {
          this.altDown = false;
          this.draw();
        }
      });
      window.addEventListener('blur', () => {
        this.spaceDown = false;
        this.altDown = false;
        this.endDrag();
      });
    }

    endDrag() {
      this.drag = null;
      this.draw();
    }

    onDoubleClick(e) {
      if (this.app.ui.view3d) return;
      const tool = this.app.ui.tool;
      if (tool !== 'select' && tool !== 'outline') return;
      const w = this.updatePointer(e);
      const hit = this.hitTest(w);
      if (hit && hit.type === 'wall' && hit.seg && hit.seg.boundary && !this.app.ui.drawingFresh) {
        if (this.app.insertOutlineCornerAt) {
          this.app.insertOutlineCornerAt(hit.seg.index, w);
        }
      }
    }

    isTypingTarget(e) {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }

    onKeyDown(e) {
      if (this.isTypingTarget(e)) return;
      if (this.app.ui.view3d) return;
      if (e.key === 'Alt') {
        this.altDown = true;
        this.draw();
      }
      if (e.code === 'Space') {
        this.spaceDown = true;
        if (this.pointer.inside) this.updateCursor();
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        this.app.toggleGridSnap();
        e.preventDefault();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        this.app.toggleOrthoSnap();
        e.preventDefault();
        return;
      }
      const tool = this.app.ui.tool;
      const drawing = tool === 'outline' || tool === 'wall' || tool === 'divider' || tool === 'rect';
      const from = this.drawingStart() || (tool === 'rect' && this.pointer.inside ? { x: this.pointer.wx, y: this.pointer.wy } : null);
      if (drawing && from) {
        const isDigit = /^[0-9]$/.test(e.key);
        const isDot = e.key === '.';
        const isImpMark = e.key === "'" || e.key === '"' || e.key === '-';
        const isBoxSep = tool === 'rect' && (e.key === 'x' || e.key === 'X' || e.key === ',');
        if (isDigit || isDot || isImpMark || isBoxSep) {
          this.lengthBuffer += e.key;
          this.snap = null;
          this.draw();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === 'Backspace') {
          if (this.lengthBuffer) {
            this.lengthBuffer = this.lengthBuffer.slice(0, -1);
            this.draw();
            e.preventDefault();
            return;
          }
          if (tool === 'outline' && this.app.ui.drawingFresh && this.app.plan.outline && this.app.plan.outline.length > 0) {
            this.app.undo();
            e.preventDefault();
            return;
          }
          if ((tool === 'wall' || tool === 'divider') && this.wallChain) {
            this.app.undo();
            e.preventDefault();
            return;
          }
        }
        if (e.key === 'Enter' && this.lengthBuffer) {
          if (tool === 'rect') {
            const boxDims = FC.parseBoxInput
              ? FC.parseBoxInput(this.lengthBuffer, this.app.plan)
              : null;
            const singleLen = !boxDims && FC.parseLengthInput
              ? FC.parseLengthInput(this.lengthBuffer, this.app.plan)
              : null;
            const dims = boxDims || (singleLen > 0 ? { w: singleLen, d: singleLen } : null);
            if (dims && this.app.createRoomBox) {
              const startPt = this.rectStart || from;
              const cur = this.pointer.inside ? { x: this.pointer.wx, y: this.pointer.wy } : { x: startPt.x + 1, y: startPt.y + 1 };
              const sx = cur.x >= startPt.x ? 1 : -1;
              const sy = cur.y >= startPt.y ? 1 : -1;
              this.app.createRoomBox(startPt, { x: startPt.x + sx * dims.w, y: startPt.y + sy * dims.d });
              this.rectStart = null;
              this.drag = null;
              this.lengthBuffer = '';
            }
          } else {
            const p = this.typedPoint(from);
            if (p) {
              this.commitPoint(p, true);
              this.lengthBuffer = '';
            }
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === 'Escape' && this.lengthBuffer) {
          this.lengthBuffer = '';
          this.draw();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      if (e.key === 'Enter') {
        if (tool === 'outline' && this.app.plan.outline.length >= 3) {
          this.finishOutline();
          e.preventDefault();
        } else if ((tool === 'wall' || tool === 'divider') && this.wallChain) {
          this.endWallChain();
          e.preventDefault();
        } else if (tool === 'room' && this.roomChain && this.roomChain.length >= 3) {
          this.app.addManualRoom(this.roomChain);
          this.roomChain = null;
          this.app.setTool('select');
          this.draw();
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        if (this.connectMode) {
          this.endConnectMode();
          e.preventDefault();
        } else if (this.rectStart) {
          this.rectStart = null;
          this.drag = null;
          this.lengthBuffer = '';
          this.draw();
          e.preventDefault();
        } else if (this.measureStart || this.measureEnd) {
          this.measureStart = null;
          this.measureEnd = null;
          this.draw();
          e.preventDefault();
        } else if (this.wallChain) {
          this.endWallChain();
          e.preventDefault();
        } else if (tool === 'room' && this.roomChain) {
          this.roomChain = null;
          this.draw();
          e.preventDefault();
        } else if (tool === 'outline' && this.app.ui.drawingFresh && this.app.plan.outline.length) {
          this.cancelOutline();
          e.preventDefault();
        } else {
          this.app.clearSelection();
          if (tool !== 'select') this.app.setTool('select');
        }
      }
    }

    drawingStart() {
      const tool = this.app.ui.tool;
      if ((tool === 'wall' || tool === 'divider') && this.wallChain) return this.wallChain;
      if (tool === 'rect' && this.rectStart) return this.rectStart;
      if (tool === 'room' && this.roomChain && this.roomChain.length) {
        return this.roomChain[this.roomChain.length - 1];
      }
      if (tool === 'outline' && this.app.ui.drawingFresh && this.app.plan.outline.length) {
        return this.app.plan.outline[this.app.plan.outline.length - 1];
      }
      return null;
    }

    onWheel(e) {
      e.preventDefault();
      if (this.app.ui.view3d) return;
      const p = this.eventPoint(e);
      const factor = Math.exp(-e.deltaY * 0.0016);
      this.zoomBy(factor, p);
    }

    onPointerDown(e) {
      if (this.app.ui.view3d) return;
      if (document.body.classList.contains('has-overlay')) return;
      const w = this.updatePointer(e);
      const tool = this.app.ui.tool;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);

      if (e.button === 1 || e.button === 2 || this.spaceDown || tool === 'pan') {
        this.drag = { type: 'pan', sx: this.pointer.sx, sy: this.pointer.sy, cx: this.view.cx, cy: this.view.cy };
        this.updateCursor();
        return;
      }
      if (e.button !== 0) return;

      if (tool === 'outline') {
        if (!this.app.ui.drawingFresh && this.app.plan.outline.length >= 3) {
          this.startVertexDrag(w);
          return;
        }
        const snap = this.snapPoint(w, this.drawingStart(), { outline: true, ortho: this.app.ui.ortho });
        if (snap.type === 'close') {
          this.finishOutline();
          return;
        }
        this.commitPoint(snap.point, false);
        return;
      }

      if (tool === 'wall' || tool === 'divider') {
        const snap = this.snapPoint(w, this.wallChain, { chainFirst: this.chainFirst, ortho: this.app.ui.ortho });
        const isDiv = tool === 'divider';
        if (snap.type === 'close' && this.wallChain && this.chainFirst) {
          this.addWall(this.wallChain, this.chainFirst, isDiv);
          this.endWallChain();
          return;
        }
        if (!this.wallChain) {
          this.wallChain = { x: snap.point.x, y: snap.point.y };
          this.chainFirst = { x: snap.point.x, y: snap.point.y };
          this.chainJustStarted = true;
          this.snap = snap;
          this.draw();
          if (this.app.ui && this.app.ui.updateUndoRedo) this.app.ui.updateUndoRedo();
          return;
        }
        if (FC.dist(this.wallChain, snap.point) > 0.12) {
          this.addWall(this.wallChain, snap.point, isDiv);
          this.wallChain = { x: snap.point.x, y: snap.point.y };
        }
        this.snap = snap;
        this.draw();
        return;
      }

      if (tool === 'rect') {
        const snap = this.snapPoint(w, null, { ortho: false });
        if (!this.rectStart) {
          this.rectStart = { x: snap.point.x, y: snap.point.y };
          this.drag = { type: 'rect-drag', start: { x: snap.point.x, y: snap.point.y }, current: { x: snap.point.x, y: snap.point.y }, moved: false };
          this.snap = snap;
          this.draw();
          return;
        } else {
          if (this.app.createRoomBox) {
            this.app.createRoomBox(this.rectStart, snap.point);
          }
          this.rectStart = null;
          this.drag = null;
          this.lengthBuffer = '';
          this.draw();
          return;
        }
      }

      if (tool === 'measure') {
        const snap = this.snapPoint(w, this.measureStart && !this.measureEnd ? this.measureStart : null, { ortho: this.app.ui.ortho });
        if (!this.measureStart || this.measureEnd) {
          this.measureStart = { x: snap.point.x, y: snap.point.y };
          this.measureEnd = null;
        } else {
          this.measureEnd = { x: snap.point.x, y: snap.point.y };
          const d = FC.dist(this.measureStart, this.measureEnd);
          const dx = Math.abs(this.measureEnd.x - this.measureStart.x);
          const dy = Math.abs(this.measureEnd.y - this.measureStart.y);
          const fmt = FC.formatLength ? (v) => FC.formatLength(v, this.app.plan) : (v) => v.toFixed(2) + ' m';
          this.app.toast(`Distance: ${fmt(d)} (ΔX ${fmt(dx)}, ΔY ${fmt(dy)})`, 'info');
        }
        this.snap = snap;
        this.draw();
        return;
      }

      if (tool === 'door' || tool === 'window' || tool === 'opening') {
        this.placeOpening(w, tool);
        return;
      }

      if (tool === 'room') {
        if (this.roomChain) {
          const first = this.roomChain[0];
          const last = this.roomChain[this.roomChain.length - 1];
          const snap = this.snapPoint(w, last, { ortho: this.app.ui.ortho });
          if (this.roomChain.length >= 3 && (snap.type === 'close' || FC.dist(snap.point, first) < this.screenTol(16))) {
            this.app.addManualRoom(this.roomChain);
            this.roomChain = null;
            this.app.setTool('select');
            this.draw();
            return;
          }
          if (FC.dist(last, snap.point) > 0.12) {
            this.roomChain.push({ x: snap.point.x, y: snap.point.y });
          }
          this.snap = snap;
          this.draw();
          return;
        }

        const room = this.hitRoom(w);
        if (room) {
          this.app.select({ type: 'room', id: room.id });
          this.app.ui.openRoomSelection(room.id);
          const vHit = this.hitRoomVertex(w, room);
          if (vHit) {
            this.drag = { type: 'room-vertex', roomId: room.id, index: vHit.index, moved: false, pushed: false };
          }
          return;
        }

        const snap = this.snapPoint(w, null, { ortho: this.app.ui.ortho });
        this.roomChain = [{ x: snap.point.x, y: snap.point.y }];
        this.snap = snap;
        this.draw();
        return;
      }

      // Select tool & interaction
      const badgeHit = this.hitOpeningBadge(w);
      if (badgeHit) {
        if (badgeHit.action === 'delete') {
          this.app.select({ type: 'opening', id: badgeHit.op.id });
          this.app.deleteSelection();
        } else if (badgeHit.action === 'flip') {
          this.app.select({ type: 'opening', id: badgeHit.op.id });
          this.app.flipDoor();
        } else if (badgeHit.action === 'hinge') {
          this.app.select({ type: 'opening', id: badgeHit.op.id });
          this.app.flipDoorHinge();
        }
        return;
      }

      const rotHit = this.hitFurnitureRotate(w);
      if (rotHit) {
        this.app.select({ type: 'furniture', id: rotHit.id });
        this.drag = { type: 'furniture-rotate', furniture: rotHit, moved: false, pushed: false };
        return;
      }

      if (tool === 'light') {
        const nearLight = this.hitLight(w);
        if (nearLight) {
          this.app.select({ type: 'light', id: nearLight.id });
          this.drag = { type: 'light', light: nearLight, startW: { x: w.x, y: w.y }, orig: { x: nearLight.x, y: nearLight.y }, moved: false, pushed: false };
        } else {
          this.app.addLightAt(w.x, w.y);
        }
        return;
      }

      if (this.connectMode) {
        const hit = this.hitTest(w);
        if (hit && (hit.type === 'wall' || hit.type === 'junction')) {
          let targetKeyOrId = null;
          if (hit.type === 'wall') {
            targetKeyOrId = hit.seg.id || hit.seg.key;
          } else if (hit.type === 'junction' && hit.junction.refs && hit.junction.refs.length) {
            const ref = hit.junction.refs[0];
            targetKeyOrId = ref.type === 'wall' ? ref.wallId : ('o:' + ref.index);
          }
          if (targetKeyOrId && targetKeyOrId !== this.connectMode.sourceWallId) {
            const src = this.connectMode.sourceWallId;
            this.endConnectMode();
            this.app.connectWalls([src, targetKeyOrId]);
            return;
          }
        }
        this.endConnectMode();
        return;
      }

      const hit = this.hitTest(w);
      if (hit) {
        if (hit.type === 'room-vertex') {
          this.app.select({ type: 'room', id: hit.roomId });
          this.drag = { type: 'room-vertex', roomId: hit.roomId, index: hit.index, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'junction') {
          this.drag = { type: 'junction', junction: hit.junction, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'opening') {
          this.app.select({ type: 'opening', id: hit.op.id });
          this.drag = { type: 'opening', id: hit.op.id, moved: false, pushed: false, hostKey: hit.op.hostKey };
          return;
        }
        if (hit.type === 'furniture') {
          const curSel = this.app.ui.selection;
          if (!e.shiftKey && curSel && curSel.type === 'walls' && Array.isArray(curSel.furnitureIds) && curSel.furnitureIds.includes(hit.furniture.id)) {
            this.drag = { type: 'walls-group', startW: { x: w.x, y: w.y }, moved: false, pushed: false };
            return;
          }
          this.app.select({ type: 'furniture', id: hit.furniture.id });
          this.drag = { type: 'furniture', furniture: hit.furniture, startW: { x: w.x, y: w.y }, orig: { x: hit.furniture.x, y: hit.furniture.y }, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'light') {
          const curSel = this.app.ui.selection;
          if (!e.shiftKey && curSel && curSel.type === 'walls' && Array.isArray(curSel.lightIds) && curSel.lightIds.includes(hit.light.id)) {
            this.drag = { type: 'walls-group', startW: { x: w.x, y: w.y }, moved: false, pushed: false };
            return;
          }
          this.app.select({ type: 'light', id: hit.light.id });
          this.drag = { type: 'light', light: hit.light, startW: { x: w.x, y: w.y }, orig: { x: hit.light.x, y: hit.light.y }, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'outline-vertex') {
          this.app.select({ type: 'vertex', index: hit.index });
          this.drag = { type: 'vertex', index: hit.index, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'wall-end') {
          this.app.select({ type: 'wall', key: hit.key });
          this.drag = { type: 'wall-end', wallId: hit.wallId, end: hit.end, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'wall-extend-handle') {
          const wall = this.app.plan.walls.find((x) => x.id === hit.wallId);
          if (wall) {
            this.drag = {
              type: 'wall-extend',
              wallId: hit.wallId,
              end: hit.end,
              orig: { a: { x: wall.a.x, y: wall.a.y }, b: { x: wall.b.x, y: wall.b.y } },
              moved: false,
              pushed: false,
            };
            return;
          }
        }
        if (hit.type === 'wall') {
          const curSel = this.app.ui.selection;
          if (e.shiftKey) {
            let currentKeys = [];
            let currentIds = [];
            let furnitureIds = [];
            let lightIds = [];
            if (curSel && curSel.type === 'walls') {
              currentKeys = curSel.keys.slice();
              currentIds = (curSel.ids || []).slice();
              furnitureIds = (curSel.furnitureIds || []).slice();
              lightIds = (curSel.lightIds || []).slice();
            } else if (curSel && curSel.type === 'wall' && curSel.key) {
              currentKeys = [curSel.key];
              const curSeg = FC.segmentByKey(this.app.plan, curSel.key);
              if (curSeg && curSeg.id) currentIds = [curSeg.id];
            }
            const key = hit.seg.key;
            const id = hit.seg.id;
            if (currentKeys.includes(key)) {
              currentKeys = currentKeys.filter((k) => k !== key);
              if (id) currentIds = currentIds.filter((x) => x !== id);
            } else {
              currentKeys.push(key);
              if (id && !currentIds.includes(id)) currentIds.push(id);
            }
            if (currentKeys.length > 1 || (currentKeys.length >= 1 && (furnitureIds.length || lightIds.length))) {
              this.app.select({ type: 'walls', keys: currentKeys, ids: currentIds, furnitureIds, lightIds });
              return;
            } else if (currentKeys.length === 1) {
              this.app.select({ type: 'wall', key: currentKeys[0] });
              return;
            } else {
              this.app.clearSelection();
              return;
            }
          }
          if (curSel && curSel.type === 'walls' && Array.isArray(curSel.keys) && curSel.keys.includes(hit.seg.key)) {
            this.drag = { type: 'walls-group', startW: { x: w.x, y: w.y }, moved: false, pushed: false };
            return;
          }
          this.app.select({ type: 'wall', key: hit.seg.key });
          this.drag = { type: 'wall', key: hit.seg.key, seg: hit.seg, startW: { x: w.x, y: w.y }, moved: false, pushed: false };
          return;
        }
        if (hit.type === 'room') {
          this.app.select({ type: 'room', id: hit.room.id });
          return;
        }
      }
      this.app.clearSelection();
      if (e.shiftKey) {
        this.drag = { type: 'marquee', x0: w.x, y0: w.y, x1: w.x, y1: w.y, sx: this.pointer.sx, sy: this.pointer.sy, moved: false };
        this.updateCursor();
        return;
      }
      this.drag = { type: 'pan', sx: this.pointer.sx, sy: this.pointer.sy, cx: this.view.cx, cy: this.view.cy };
      this.updateCursor();
    }

    commitPoint(point, typed) {
      const tool = this.app.ui.tool;
      if (tool === 'outline') {
        if (!this.app.ui.drawingFresh) {
          this.app.pushHistory();
          this.app.ui.drawingFresh = true;
          this.app.plan.outline = [];
        } else {
          this.app.pushHistory();
        }
        if (!this._outlinePushed) {
          this._outlinePushed = true;
        }
        const last = this.app.plan.outline[this.app.plan.outline.length - 1];
        if (last && FC.dist(last, point) < 0.02) return;
        this.app.plan.outline.push({ x: FC.round(point.x, 3), y: FC.round(point.y, 3) });
        this.lengthBuffer = '';
        this.app.changed({ rooms: false, furniture: false, save: false });
        this.app.ui.updateHint();
      } else if (tool === 'wall') {
        if (this.wallChain) {
          if (FC.dist(this.wallChain, point) < 0.12) return;
          this.addWall(this.wallChain, point);
          this.wallChain = { x: point.x, y: point.y };
          this.lengthBuffer = '';
        }
      }
      this.draw();
    }

    addWall(a, b, virtual) {
      if (FC.dist(a, b) < 0.15) return;
      const plan = this.app.plan;
      const dup = plan.walls.some((w) => {
        const same = (FC.dist(w.a, a) < 0.02 && FC.dist(w.b, b) < 0.02) || (FC.dist(w.a, b) < 0.02 && FC.dist(w.b, a) < 0.02);
        return same;
      });
      if (dup) return;
      this.app.pushHistory();
      this.chainJustStarted = false;
      const wallObj = {
        id: FC.uid('w'),
        a: { x: FC.round(a.x, 3), y: FC.round(a.y, 3) },
        b: { x: FC.round(b.x, 3), y: FC.round(b.y, 3) },
      };
      if (virtual || this.app.ui.tool === 'divider') wallObj.virtual = true;
      plan.walls.push(wallObj);
      this.app.changed({ rooms: true, furniture: true, save: false });
      this.app.saveSoon();
      this.app.ui.updateHint();
    }

    endWallChain() {
      this.wallChain = null;
      this.chainFirst = null;
      this.chainJustStarted = false;
      this.lengthBuffer = '';
      this.snap = null;
      this.app.changed({ rooms: true, furniture: true, save: true });
      this.app.ui.updateHint();
      this.draw();
    }

    startConnectMode(sourceWallId) {
      this.connectMode = { sourceWallId };
      this.app.toast('Click another wall or corner to connect them (Esc to cancel)', 'info');
      this.updateCursor();
      this.draw();
    }

    endConnectMode() {
      this.connectMode = null;
      this.updateCursor();
      this.draw();
    }

    cancelOutline() {
      this.app.plan.outline = [];
      this.app.ui.drawingFresh = false;
      this.lengthBuffer = '';
      this.snap = null;
      this._outlinePushed = false;
      this.app.changed({ rooms: true, furniture: true, save: true });
      this.app.setTool('select');
      this.app.toast('Outline cancelled', 'info');
    }

    finishOutline() {
      const pts = this.app.plan.outline;
      if (pts.length < 3) {
        this.app.toast('Add at least three corners first', 'info');
        return;
      }
      if (!FC.isSimplePolygon(pts)) {
        this.app.toast('That outline crosses itself — move a corner to fix it', 'error');
        return;
      }
      this.app.ui.drawingFresh = false;
      this.lengthBuffer = '';
      this.snap = null;
      this._outlinePushed = false;
      this.app.clearSelection();
      this.app.changed({ rooms: true, furniture: true, save: true });
      this.app.setStep(2, { silent: true });
      this.app.setTool('wall');
      this.app.toast('Outline closed. Draw inner walls, or jump to 3D anytime.', 'success');
      this.app.ui.hideWelcome();
      this.fit();
    }

    startVertexDrag(w) {
      const tol = this.screenTol(12);
      let best = null;
      this.app.plan.outline.forEach((p, i) => {
        const d = FC.dist(w, p);
        if (d <= tol && (!best || d < best.d)) best = { d, i };
      });
      if (best) {
        this.app.select({ type: 'vertex', index: best.i });
        this.drag = { type: 'vertex', index: best.i, moved: false, pushed: false };
        return;
      }
      const hit = this.hitTest(w);
      if (hit && hit.type === 'wall') {
        this.app.select({ type: 'wall', key: hit.seg.key });
      } else {
        this.app.clearSelection();
      }
    }

    onPointerMove(e) {
      if (this.app.ui.view3d) return;
      const w = this.updatePointer(e);
      if (this.drag) {
        if (this.drag.type === 'pan') {
          this.view.cx = this.drag.cx - (this.pointer.sx - this.drag.sx) / this.view.scale;
          this.view.cy = this.drag.cy - (this.pointer.sy - this.drag.sy) / this.view.scale;
          this.draw();
          return;
        }
        if (!this.drag.moved) {
          const dx = this.pointer.sx - (this.drag.sx || this.pointer.sx);
          this.drag.moved = true;
        }
        this.moveDrag(w);
        this.draw();
        return;
      }

      const tool = this.app.ui.tool;
      if (tool === 'outline' || tool === 'wall' || tool === 'divider' || tool === 'room' || tool === 'rect' || tool === 'measure') {
        const from = tool === 'measure' ? (this.measureStart && !this.measureEnd ? this.measureStart : null) : this.drawingStart();
        const snap = this.snapPoint(w, from, {
          outline: tool === 'outline' && this.app.ui.drawingFresh,
          chainFirst: (tool === 'wall' || tool === 'divider') ? this.chainFirst : null,
          ortho: tool === 'rect' ? false : this.app.ui.ortho,
        });
        this.snap = snap;
        if (this.lengthBuffer && tool !== 'rect') {
          const typed = this.typedPoint(from || w);
          if (typed) this.snap = { point: typed, type: 'typed', label: 'Length' };
        }
        this.hover = null;
        this.updateCursor();
        this.draw();
        return;
      }
      if (tool === 'rect') {
        const snap = this.snapPoint(w, null, { ortho: false });
        if (!this.rectStart) {
          this.rectStart = { x: snap.point.x, y: snap.point.y };
          this.drag = { type: 'rect-drag', start: { x: snap.point.x, y: snap.point.y }, current: { x: snap.point.x, y: snap.point.y }, moved: false };
          this.snap = snap;
          this.draw();
          return;
        } else {
          if (this.app.createRoomBox) {
            this.app.createRoomBox(this.rectStart, snap.point);
          }
          this.rectStart = null;
          this.drag = null;
          this.lengthBuffer = '';
          this.draw();
          return;
        }
      }

      if (tool === 'measure') {
        const snap = this.snapPoint(w, this.measureStart && !this.measureEnd ? this.measureStart : null, { ortho: this.app.ui.ortho });
        if (!this.measureStart || this.measureEnd) {
          this.measureStart = { x: snap.point.x, y: snap.point.y };
          this.measureEnd = null;
        } else {
          this.measureEnd = { x: snap.point.x, y: snap.point.y };
          const d = FC.dist(this.measureStart, this.measureEnd);
          const dx = Math.abs(this.measureEnd.x - this.measureStart.x);
          const dy = Math.abs(this.measureEnd.y - this.measureStart.y);
          const fmt = FC.formatLength ? (v) => FC.formatLength(v, this.app.plan) : (v) => v.toFixed(2) + ' m';
          this.app.toast(`Distance: ${fmt(d)} (ΔX ${fmt(dx)}, ΔY ${fmt(dy)})`, 'info');
        }
        this.snap = snap;
        this.draw();
        return;
      }

      if (tool === 'door' || tool === 'window' || tool === 'opening') {
        const wallHit = FC.nearestWall(this.app.plan, w, this.screenTol(26));
        this.hoverOpeningWall = wallHit;
        this.snap = null;
        this.hover = wallHit;
        this.updateCursor();
        this.draw();
        return;
      }
      this.snap = null;
      this.hover = this.hitTest(w);
      this.updateCursor();
      this.draw();
    }

    onPointerUp() {
      if (this.drag) {
        const wasMoving = this.drag.type !== 'pan' && this.drag.moved;
        const dragType = this.drag.type;
        if (dragType === 'rect-drag') {
          const dist = FC.dist(this.drag.start, this.drag.current);
          if (dist > 0.35 && Math.abs(this.drag.current.x - this.drag.start.x) >= 0.3 && Math.abs(this.drag.current.y - this.drag.start.y) >= 0.3) {
            if (this.app.createRoomBox) {
              this.app.createRoomBox(this.drag.start, this.drag.current);
            }
            this.rectStart = null;
            this.lengthBuffer = '';
          }
          this.drag = null;
          this.draw();
          return;
        }
        if (dragType === 'marquee') {
          const minX = Math.min(this.drag.x0, this.drag.x1);
          const maxX = Math.max(this.drag.x0, this.drag.x1);
          const minY = Math.min(this.drag.y0, this.drag.y1);
          const maxY = Math.max(this.drag.y0, this.drag.y1);
          if (maxX - minX > 0.15 && maxY - minY > 0.15) {
            const segs = FC.getSegments(this.app.plan);
            const matchedKeys = [];
            const matchedIds = [];
            segs.forEach((seg) => {
              const mid = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
              const aIn = seg.a.x >= minX && seg.a.x <= maxX && seg.a.y >= minY && seg.a.y <= maxY;
              const bIn = seg.b.x >= minX && seg.b.x <= maxX && seg.b.y >= minY && seg.b.y <= maxY;
              const mIn = mid.x >= minX && mid.x <= maxX && mid.y >= minY && mid.y <= maxY;
              if ((aIn && bIn) || mIn) {
                matchedKeys.push(seg.key);
                if (seg.id) matchedIds.push(seg.id);
              }
            });
            const matchedFurnIds = [];
            if (this.app.furniture && this.app.plan.furnished) {
              this.app.furniture.forEach((f) => {
                if (f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY) {
                  matchedFurnIds.push(f.id);
                }
              });
            }
            const matchedLightIds = [];
            if (this.app.plan.lights) {
              this.app.plan.lights.forEach((l) => {
                if (l.x >= minX && l.x <= maxX && l.y >= minY && l.y <= maxY) {
                  matchedLightIds.push(l.id);
                }
              });
            }
            if (matchedKeys.length > 1 || (matchedKeys.length >= 1 && (matchedFurnIds.length || matchedLightIds.length)) || matchedFurnIds.length > 1) {
              this.app.select({
                type: 'walls',
                keys: matchedKeys,
                ids: matchedIds,
                furnitureIds: matchedFurnIds,
                lightIds: matchedLightIds,
              });
            } else if (matchedKeys.length === 1) {
              this.app.select({ type: 'wall', key: matchedKeys[0] });
            } else if (matchedFurnIds.length === 1) {
              this.app.select({ type: 'furniture', id: matchedFurnIds[0] });
            } else if (matchedLightIds.length === 1) {
              this.app.select({ type: 'light', id: matchedLightIds[0] });
            }
          }
          this.drag = null;
          this.draw();
          return;
        }
        if (wasMoving) {
          if (dragType === 'furniture' || dragType === 'furniture-rotate') {
            const f = this.drag.furniture;
            if (f) {
              const r = this.hitRoom({ x: f.x, y: f.y });
              if (r) f.roomId = r.id;
              f.custom = true;
            }
            this.snap = null;
            if (this.app.plan) this.app.plan.furniture = this.app.furniture;
            this.app.changed({ rooms: false, furniture: false, save: true });
          } else if (dragType === 'light' || dragType === 'opening') {
            this.app.changed({ rooms: false, furniture: false, save: true });
          } else if (dragType === 'room-vertex') {
            this.snap = null;
            if (FC.snapRoomPolygons && this.app.plan && this.app.rooms) {
              FC.snapRoomPolygons(this.app.plan, this.app.rooms);
              this.app.plan.rooms = this.app.rooms;
            }
            this.app.changed({ rooms: false, furniture: false, save: true });
          } else {
            if (dragType === 'junction' && this.drag.junction) {
              const jPt = { x: this.drag.junction.x, y: this.drag.junction.y };
              const junctions = FC.findJunctions(this.app.plan, this.screenTol(14));
              const otherJ = junctions.find((other) => other.id !== this.drag.junction.id && FC.dist(jPt, other) < this.screenTol(12));
              if (otherJ) {
                FC.moveJunction(this.app.plan, this.drag.junction, otherJ.x, otherJ.y);
              }
            }
            this.snap = null;
            this.app.changed({ rooms: true, furniture: false, save: true });
          }
        } else if (this.drag.type === 'junction') {
          this.app.select({ type: 'junction', junction: this.drag.junction });
        }
        this.drag = null;
        if (wasMoving) this.updateCursor();
        this.draw();
      }
      this.app.saveSoon();
    }

    moveDrag(w) {
      const plan = this.app.plan;
      if (this.drag.type === 'rect-drag') {
        const snap = this.snapPoint(w, null, { ortho: false });
        this.drag.current = { x: snap.point.x, y: snap.point.y };
        this.snap = snap;
        return;
      }
      if (this.drag.type === 'marquee') {
        this.drag.x1 = w.x;
        this.drag.y1 = w.y;
        return;
      }
      if (this.drag.type === 'walls-group') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const sel = this.app.ui.selection;
        if (!sel || sel.type !== 'walls') return;
        if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
        if (!this.drag.origWalls) {
          this.drag.origWalls = new Map();
          (sel.ids || []).forEach((wid) => {
            const wall = plan.walls.find((x) => x.id === wid);
            if (wall) {
              this.drag.origWalls.set(wid, { a: { x: wall.a.x, y: wall.a.y }, b: { x: wall.b.x, y: wall.b.y } });
            }
          });
          this.drag.origFurn = new Map();
          if (this.app.furniture && Array.isArray(sel.furnitureIds)) {
            sel.furnitureIds.forEach((fid) => {
              const f = this.app.furniture.find((item) => item.id === fid);
              if (f) this.drag.origFurn.set(fid, { x: f.x, y: f.y });
            });
          }
          this.drag.origLights = new Map();
          if (plan.lights && Array.isArray(sel.lightIds)) {
            sel.lightIds.forEach((lid) => {
              const l = plan.lights.find((item) => item.id === lid);
              if (l) this.drag.origLights.set(lid, { x: l.x, y: l.y });
            });
          }
        }
        let dx = w.x - this.drag.startW.x;
        let dy = w.y - this.drag.startW.y;
        if (this.gridSnap && this.app.plan.settings.snapGrid !== false && !this.altDown) {
          dx = this.snapGridValue(dx);
          dy = this.snapGridValue(dy);
        }
        this.drag.origWalls.forEach((orig, wid) => {
          const wall = plan.walls.find((x) => x.id === wid);
          if (wall) {
            wall.a.x = FC.round(orig.a.x + dx, 3);
            wall.a.y = FC.round(orig.a.y + dy, 3);
            wall.b.x = FC.round(orig.b.x + dx, 3);
            wall.b.y = FC.round(orig.b.y + dy, 3);
          }
        });
        this.drag.origFurn.forEach((orig, fid) => {
          const f = (this.app.furniture || []).find((item) => item.id === fid);
          if (f) {
            f.x = FC.round(orig.x + dx, 3);
            f.y = FC.round(orig.y + dy, 3);
            f.custom = true;
          }
        });
        this.drag.origLights.forEach((orig, lid) => {
          const l = (plan.lights || []).find((item) => item.id === lid);
          if (l) {
            l.x = FC.round(orig.x + dx, 3);
            l.y = FC.round(orig.y + dy, 3);
          }
        });
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'junction') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const junction = this.drag.junction;
        const anchors = [];
        junction.refs.forEach((ref) => {
          if (ref.type === 'wall') {
            const wall = plan.walls.find((x) => x.id === ref.wallId);
            if (wall) {
              const other = ref.end === 0 ? wall.b : wall.a;
              anchors.push({ x: other.x, y: other.y, wallId: wall.id });
            }
          } else if (ref.type === 'outline') {
            const n = plan.outline.length;
            const prev = plan.outline[(ref.index - 1 + n) % n];
            const next = plan.outline[(ref.index + 1) % n];
            if (prev) anchors.push({ x: prev.x, y: prev.y, outline: true });
            if (next) anchors.push({ x: next.x, y: next.y, outline: true });
          }
        });

        let p = { x: w.x, y: w.y };
        const snapAngle = (this.app.plan.settings.snapAngle !== false || this.app.ui.ortho) && !this.altDown;
        const snapGrid = this.gridSnap && this.app.plan.settings.snapGrid !== false && !this.altDown;
        let snappedHoriz = false;
        let snappedVert = false;
        let snapGuide = null;

        if (snapAngle && anchors.length > 0) {
          const tol = this.screenTol(18);
          for (const anc of anchors) {
            const dx = Math.abs(p.x - anc.x);
            const dy = Math.abs(p.y - anc.y);
            const angle = Math.atan2(p.y - anc.y, p.x - anc.x);

            if (!snappedVert) {
              const isVert = dx < tol ||
                Math.abs(FC.angleDiff(angle, Math.PI / 2)) < 0.17 ||
                Math.abs(FC.angleDiff(angle, -Math.PI / 2)) < 0.17;
              if (isVert) {
                p.x = anc.x;
                snappedVert = true;
                snapGuide = { anchor: anc, type: 'axis', label: 'Vertical (90°)', point: p };
              }
            }
            if (!snappedHoriz) {
              const isHoriz = dy < tol ||
                Math.abs(FC.angleDiff(angle, 0)) < 0.17 ||
                Math.abs(FC.angleDiff(angle, Math.PI)) < 0.17;
              if (isHoriz) {
                p.y = anc.y;
                snappedHoriz = true;
                snapGuide = { anchor: anc, type: 'axis', label: 'Horizontal (0°)', point: p };
              }
            }
          }
        }

        if (snapGrid) {
          if (!snappedVert) p.x = this.snapGridValue(p.x);
          if (!snappedHoriz) p.y = this.snapGridValue(p.y);
        }

        if (snapGuide) {
          snapGuide.point = { x: p.x, y: p.y };
          this.snap = snapGuide;
        } else {
          this.snap = null;
        }

        FC.moveJunction(plan, junction, p.x, p.y);
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'furniture') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const f = this.drag.furniture;
        if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
        if (!this.drag.orig) this.drag.orig = { x: f.x, y: f.y, rot: f.rot || 0 };
        const dx = w.x - this.drag.startW.x;
        const dy = w.y - this.drag.startW.y;
        const candX = this.drag.orig.x + dx;
        const candY = this.drag.orig.y + dy;
        if (!this.altDown && FC.snapFurnitureToWalls) {
          const wallSnap = FC.snapFurnitureToWalls(plan, f, candX, candY, this.screenTol(16));
          if (wallSnap) {
            f.x = wallSnap.x;
            f.y = wallSnap.y;
            f.rot = wallSnap.rot;
            this.snap = { point: wallSnap.wallPoint, type: 'wall', label: 'Flush to wall' };
          } else {
            f.x = FC.round(candX, 3);
            f.y = FC.round(candY, 3);
            this.snap = null;
          }
        } else {
          f.x = FC.round(candX, 3);
          f.y = FC.round(candY, 3);
          this.snap = null;
        }
        f.custom = true;
        this.app.changed({ rooms: false, furniture: false, save: false });
        if (this.app.viewer) this.app.viewer.markDirty();
        return;
      }
      if (this.drag.type === 'furniture-rotate') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const f = this.drag.furniture;
        const angle = Math.atan2(w.y - f.y, w.x - f.x) - Math.PI / 2;
        const snapAngle = this.app.ui.ortho ? Math.round(angle / (Math.PI / 4)) * (Math.PI / 4) : Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
        f.rot = FC.round(snapAngle, 3);
        f.custom = true;
        this.app.changed({ rooms: false, furniture: false, save: false });
        if (this.app.viewer) this.app.viewer.markDirty();
        return;
      }
      if (this.drag.type === 'light') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const l = this.drag.light;
        if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
        if (!this.drag.orig) this.drag.orig = { x: l.x, y: l.y };
        const dx = w.x - this.drag.startW.x;
        const dy = w.y - this.drag.startW.y;
        l.x = FC.round(this.drag.orig.x + dx, 3);
        l.y = FC.round(this.drag.orig.y + dy, 3);
        this.app.changed({ rooms: false, furniture: false, save: false });
        if (this.app.viewer) this.app.viewer.markDirty();
        return;
      }
      if (this.drag.type === 'vertex') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const p = plan.outline[this.drag.index];
        if (!p) return;
        const n = plan.outline.length;
        const prev = plan.outline[(this.drag.index - 1 + n) % n];
        const next = plan.outline[(this.drag.index + 1) % n];
        const anchors = [prev, next].filter(Boolean);

        let pt = { x: w.x, y: w.y };
        const snapAngle = (this.app.plan.settings.snapAngle !== false || this.app.ui.ortho) && !this.altDown;
        const snapGrid = this.gridSnap && this.app.plan.settings.snapGrid !== false && !this.altDown;
        let snappedHoriz = false;
        let snappedVert = false;
        let snapGuide = null;

        if (snapAngle && anchors.length > 0) {
          const tol = this.screenTol(18);
          for (const anc of anchors) {
            const dx = Math.abs(pt.x - anc.x);
            const dy = Math.abs(pt.y - anc.y);
            const angle = Math.atan2(pt.y - anc.y, pt.x - anc.x);

            if (!snappedVert) {
              const isVert = dx < tol ||
                Math.abs(FC.angleDiff(angle, Math.PI / 2)) < 0.17 ||
                Math.abs(FC.angleDiff(angle, -Math.PI / 2)) < 0.17;
              if (isVert) {
                pt.x = anc.x;
                snappedVert = true;
                snapGuide = { anchor: anc, type: 'axis', label: 'Vertical (90°)', point: pt };
              }
            }
            if (!snappedHoriz) {
              const isHoriz = dy < tol ||
                Math.abs(FC.angleDiff(angle, 0)) < 0.17 ||
                Math.abs(FC.angleDiff(angle, Math.PI)) < 0.17;
              if (isHoriz) {
                pt.y = anc.y;
                snappedHoriz = true;
                snapGuide = { anchor: anc, type: 'axis', label: 'Horizontal (0°)', point: pt };
              }
            }
          }
        }

        if (snapGrid) {
          if (!snappedVert) pt.x = this.snapGridValue(pt.x);
          if (!snappedHoriz) pt.y = this.snapGridValue(pt.y);
        }

        if (snapGuide) {
          snapGuide.point = { x: pt.x, y: pt.y };
          this.snap = snapGuide;
        } else {
          this.snap = null;
        }

        p.x = FC.round(pt.x, 3);
        p.y = FC.round(pt.y, 3);
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'room-vertex') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const room = (this.app.rooms || []).find((r) => r.id === this.drag.roomId);
        if (!room || !Array.isArray(room.polygon) || !room.polygon[this.drag.index]) return;
        const idx = this.drag.index;
        const n = room.polygon.length;
        const prev = room.polygon[(idx - 1 + n) % n];
        const next = room.polygon[(idx + 1) % n];
        const anchors = [prev, next].filter(Boolean);

        // Ensure room is persisted in plan.manualRooms so edits survive room detection
        room.isManual = true;
        if (!Array.isArray(plan.manualRooms)) plan.manualRooms = [];
        let mr = plan.manualRooms.find((m) => m.id === room.id);
        if (!mr) {
          mr = {
            id: room.id,
            name: room.name || 'Custom Room',
            type: room.type || 'living',
            polygon: room.polygon.map((pt) => ({ x: pt.x, y: pt.y })),
            isManual: true,
          };
          plan.manualRooms.push(mr);
        }

        const rawSnap = this.snapPoint(w, prev || null, { ortho: this.app.ui.ortho });
        let pt = { x: rawSnap.point.x, y: rawSnap.point.y };
        let snapGuide = rawSnap.type !== 'free' && rawSnap.type !== 'grid' ? rawSnap : null;

        const snapAngle = (this.app.plan.settings.snapAngle !== false || this.app.ui.ortho) && !this.altDown;
        if (snapAngle && anchors.length > 0 && (!snapGuide || snapGuide.type === 'wall' || snapGuide.type === 'axis')) {
          const tol = this.screenTol(14);
          for (const anc of anchors) {
            if (Math.abs(w.y - anc.y) < tol) {
              if (snapGuide && snapGuide.type === 'wall' && snapGuide.seg) {
                const sdx = snapGuide.seg.b.x - snapGuide.seg.a.x;
                const sdy = snapGuide.seg.b.y - snapGuide.seg.a.y;
                if (Math.abs(sdy) > 0.05) {
                  const t = (anc.y - snapGuide.seg.a.y) / sdy;
                  if (t >= -0.02 && t <= 1.02) pt.x = snapGuide.seg.a.x + sdx * t;
                }
              }
              pt.y = anc.y;
              snapGuide = { anchor: anc, type: 'axis', label: 'Horizontal (0°)', point: pt };
            }
            if (Math.abs(w.x - anc.x) < tol) {
              if (snapGuide && snapGuide.type === 'wall' && snapGuide.seg) {
                const sdx = snapGuide.seg.b.x - snapGuide.seg.a.x;
                const sdy = snapGuide.seg.b.y - snapGuide.seg.a.y;
                if (Math.abs(sdx) > 0.05) {
                  const t = (anc.x - snapGuide.seg.a.x) / sdx;
                  if (t >= -0.02 && t <= 1.02) pt.y = snapGuide.seg.a.y + sdy * t;
                }
              }
              pt.x = anc.x;
              snapGuide = { anchor: anc, type: 'axis', label: 'Vertical (90°)', point: pt };
            }
          }
        }

        this.snap = snapGuide;
        room.polygon[idx].x = FC.round(pt.x, 4);
        room.polygon[idx].y = FC.round(pt.y, 4);
        room.area = FC.round(Math.abs(FC.polygonArea(room.polygon)), 2);
        room.centroid = FC.polygonCentroid(room.polygon);
        room.bounds = FC.polygonBounds(room.polygon);
        if (mr) {
          mr.polygon = room.polygon.map((p) => ({ x: p.x, y: p.y }));
          mr.area = room.area;
          mr.centroid = { x: room.centroid.x, y: room.centroid.y };
          mr.bounds = Object.assign({}, room.bounds);
        }
        plan.rooms = this.app.rooms;
        if (this.app.viewer) this.app.viewer.markDirty();
        return;
      }
      if (this.drag.type === 'wall-end') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const wall = plan.walls.find((x) => x.id === this.drag.wallId);
        if (!wall) return;
        const other = this.drag.end === 0 ? wall.b : wall.a;
        let p = { x: w.x, y: w.y };
        const snapAngle = (this.app.plan.settings.snapAngle !== false || this.app.ui.ortho) && !this.altDown;
        const snapGrid = this.gridSnap && this.app.plan.settings.snapGrid !== false && !this.altDown;
        let snappedHoriz = false;
        let snappedVert = false;
        let snapGuide = null;

        if (snapAngle) {
          const dx = Math.abs(p.x - other.x);
          const dy = Math.abs(p.y - other.y);
          const tol = this.screenTol(18);
          const angle = Math.atan2(p.y - other.y, p.x - other.x);

          if (dx < tol || Math.abs(FC.angleDiff(angle, Math.PI / 2)) < 0.17 || Math.abs(FC.angleDiff(angle, -Math.PI / 2)) < 0.17) {
            p.x = other.x;
            snappedVert = true;
            snapGuide = { anchor: other, type: 'axis', label: 'Vertical (90°)', point: p };
          }
          if (dy < tol || Math.abs(FC.angleDiff(angle, 0)) < 0.17 || Math.abs(FC.angleDiff(angle, Math.PI)) < 0.17) {
            p.y = other.y;
            snappedHoriz = true;
            snapGuide = { anchor: other, type: 'axis', label: 'Horizontal (0°)', point: p };
          }
        }

        if (snapGrid) {
          if (!snappedVert) p.x = this.snapGridValue(p.x);
          if (!snappedHoriz) p.y = this.snapGridValue(p.y);
        }

        if (snapGuide) {
          snapGuide.point = { x: p.x, y: p.y };
          this.snap = snapGuide;
        } else {
          this.snap = null;
        }

        const target = this.drag.end === 0 ? wall.a : wall.b;
        target.x = FC.round(p.x, 3);
        target.y = FC.round(p.y, 3);
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'wall-extend') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const wall = plan.walls.find((x) => x.id === this.drag.wallId);
        if (!wall) return;
        const isEndB = this.drag.end === 0;
        const origin = isEndB ? this.drag.orig.a : this.drag.orig.b;
        const curDir = isEndB
          ? { x: this.drag.orig.b.x - this.drag.orig.a.x, y: this.drag.orig.b.y - this.drag.orig.a.y }
          : { x: this.drag.orig.a.x - this.drag.orig.b.x, y: this.drag.orig.a.y - this.drag.orig.b.y };
        const baseLen = Math.hypot(curDir.x, curDir.y);
        if (baseLen < 1e-4) return;
        const u = { x: curDir.x / baseLen, y: curDir.y / baseLen };

        // Project mouse w onto collinear line
        const mouseProj = (w.x - origin.x) * u.x + (w.y - origin.y) * u.y;
        let newLen = Math.max(0.3, mouseProj);

        // Snapping to grid, doors, and walls along the ray
        const tol = this.screenTol(14);
        let snapGuide = null;
        if (this.gridSnap && this.app.plan.settings.snapGrid !== false && !this.altDown) {
          newLen = this.snapGridValue(newLen);
        }
        if (!this.altDown) {
          const targetPt = { x: origin.x + u.x * newLen, y: origin.y + u.y * newLen };
          if (FC.getOpeningSnapPoints) {
            const opSnaps = FC.getOpeningSnapPoints(plan);
            for (const opPt of opSnaps) {
              if (FC.dist(targetPt, opPt) < tol) {
                newLen = (opPt.x - origin.x) * u.x + (opPt.y - origin.y) * u.y;
                snapGuide = { point: opPt, type: 'door', label: 'Snap: ' + opPt.label };
                break;
              }
            }
          }
          if (!snapGuide) {
            const near = FC.nearestWall(plan, targetPt, tol, (s) => !s.wall || s.wall.id !== wall.id);
            if (near) {
              newLen = (near.point.x - origin.x) * u.x + (near.point.y - origin.y) * u.y;
              snapGuide = { point: near.point, type: 'wall', label: 'Snap: Wall' };
            }
          }
        }
        this.snap = snapGuide;

        FC.resizeWall(plan, wall.id, newLen, isEndB ? 0 : 1);
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'wall') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const seg = this.drag.seg;
        if (seg.boundary) {
          const n = plan.outline.length;
          const i0 = seg.index;
          const i1 = (seg.index + 1) % n;
          if (!this.drag.origEdge) {
            this.drag.origEdge = {
              a: { x: plan.outline[i0].x, y: plan.outline[i0].y },
              b: { x: plan.outline[i1].x, y: plan.outline[i1].y },
              angle: seg.angle,
            };
          }
          if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
          let dx = w.x - this.drag.startW.x;
          let dy = w.y - this.drag.startW.y;
          if (!this.altDown) {
            const nx = -Math.sin(this.drag.origEdge.angle);
            const ny = Math.cos(this.drag.origEdge.angle);
            let proj = dx * nx + dy * ny;
            if (this.gridSnap && this.app.plan.settings.snapGrid !== false) {
              proj = this.snapGridValue(proj);
            }
            dx = nx * proj;
            dy = ny * proj;
          }
          plan.outline[i0].x = FC.round(this.drag.origEdge.a.x + dx, 3);
          plan.outline[i0].y = FC.round(this.drag.origEdge.a.y + dy, 3);
          plan.outline[i1].x = FC.round(this.drag.origEdge.b.x + dx, 3);
          plan.outline[i1].y = FC.round(this.drag.origEdge.b.y + dy, 3);
        } else {
          const wall = plan.walls.find((x) => x.id === seg.id);
          if (!wall) return;
          if (!this.drag.orig) this.drag.orig = { a: { x: wall.a.x, y: wall.a.y }, b: { x: wall.b.x, y: wall.b.y } };
          if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
          let dx = w.x - this.drag.startW.x;
          let dy = w.y - this.drag.startW.y;

          let candA = { x: this.drag.orig.a.x + dx, y: this.drag.orig.a.y + dy };
          let candB = { x: this.drag.orig.b.x + dx, y: this.drag.orig.b.y + dy };
          let candMid = { x: (candA.x + candB.x) / 2, y: (candA.y + candB.y) / 2 };

          const tol = this.screenTol(14);
          let snapGuide = null;

          if (!this.altDown) {
            // 1. Snap to doors
            if (FC.getOpeningSnapPoints) {
              const opSnaps = FC.getOpeningSnapPoints(plan);
              for (const opPt of opSnaps) {
                const dA = FC.dist(candA, opPt);
                const dB = FC.dist(candB, opPt);
                const dMid = FC.dist(candMid, opPt);
                if (dA < tol) {
                  dx += opPt.x - candA.x;
                  dy += opPt.y - candA.y;
                  snapGuide = { point: opPt, type: 'door', label: 'Snap: ' + opPt.label };
                  break;
                } else if (dB < tol) {
                  dx += opPt.x - candB.x;
                  dy += opPt.y - candB.y;
                  snapGuide = { point: opPt, type: 'door', label: 'Snap: ' + opPt.label };
                  break;
                } else if (dMid < tol) {
                  dx += opPt.x - candMid.x;
                  dy += opPt.y - candMid.y;
                  snapGuide = { point: opPt, type: 'door', label: 'Snap: ' + opPt.label };
                  break;
                }
              }
            }

            // 2. Snap to other wall endpoints
            if (!snapGuide) {
              const verts = this.allVertices().filter((v) => !v.wallId || v.wallId !== wall.id);
              for (const v of verts) {
                const dA = FC.dist(candA, v.p);
                const dB = FC.dist(candB, v.p);
                if (dA < tol) {
                  dx += v.p.x - candA.x;
                  dy += v.p.y - candA.y;
                  snapGuide = { point: v.p, type: 'point', label: 'Snap: ' + v.label };
                  break;
                } else if (dB < tol) {
                  dx += v.p.x - candB.x;
                  dy += v.p.y - candB.y;
                  snapGuide = { point: v.p, type: 'point', label: 'Snap: ' + v.label };
                  break;
                }
              }
            }

            // 3. Snap to nearest wall line
            if (!snapGuide) {
              const nearA = FC.nearestWall(plan, candA, tol, (s) => !s.wall || s.wall.id !== wall.id);
              if (nearA) {
                dx += nearA.point.x - candA.x;
                dy += nearA.point.y - candA.y;
                snapGuide = { point: nearA.point, type: 'wall', label: 'Snap: Wall' };
              } else {
                const nearB = FC.nearestWall(plan, candB, tol, (s) => !s.wall || s.wall.id !== wall.id);
                if (nearB) {
                  dx += nearB.point.x - candB.x;
                  dy += nearB.point.y - candB.y;
                  snapGuide = { point: nearB.point, type: 'wall', label: 'Snap: Wall' };
                }
              }
            }
          }

          this.snap = snapGuide;

          wall.a.x = FC.round(this.drag.orig.a.x + dx, 3);
          wall.a.y = FC.round(this.drag.orig.a.y + dy, 3);
          wall.b.x = FC.round(this.drag.orig.b.x + dx, 3);
          wall.b.y = FC.round(this.drag.orig.b.y + dy, 3);
        }
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'opening') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
        const op = plan.openings.find((x) => x.id === this.drag.id);
        if (!op) return;
        const segs = FC.getSegments(plan);
        let near = FC.nearestWall(plan, w, 0.8);
        if (!near) near = FC.nearestWall(plan, w, 6);
        if (!near) return;
        const width = Math.min(op.width, Math.max(0.2, near.seg.len - 0.12));
        const offset = FC.clamp(near.offset, width / 2 + 0.03, near.seg.len - width / 2 - 0.03);
        if (FC.canPlaceOpening(plan, near.seg.key, offset, width, op.id)) {
          op.hostKey = near.seg.key;
          op.offset = FC.round(offset, 3);
          op.width = FC.round(width, 3);
          this.app.changed({ rooms: false, furniture: false, save: false });
        }
      }
    }

    updateCursor() {
      if (this.connectMode) {
        this.canvas.style.cursor = 'crosshair';
        return;
      }
      const tool = this.app.ui.tool;
      let c = 'default';
      if (this.drag && this.drag.type === 'pan') c = 'grabbing';
      else if (this.spaceDown || tool === 'pan') c = 'grab';
      else if (tool === 'outline' || tool === 'wall' || tool === 'divider' || tool === 'room' || tool === 'rect' || tool === 'measure' || tool === 'door' || tool === 'window' || tool === 'opening') c = 'crosshair';
      else if (this.hover) c = 'pointer';
      this.canvas.style.cursor = c;
    }

    /* ---------------------------------------------------------------- */
    /* Placement                                                         */
    /* ---------------------------------------------------------------- */

    placeOpening(world, tool) {
      const near = FC.nearestWall(this.app.plan, world, this.screenTol(30));
      if (!near) {
        this.app.toast('Click on a wall to place it', 'info');
        return;
      }
      const kind = tool === 'window' ? 'window' : tool === 'opening' ? 'opening' : 'door';
      const def = FC.defaultOpening(this.app.plan, kind, near.seg.key, near.offset);
      const width = Math.min(def.width, near.seg.len - 0.14);
      const offset = FC.clamp(near.offset, width / 2 + 0.03, near.seg.len - width / 2 - 0.03);
      if (!FC.canPlaceOpening(this.app.plan, near.seg.key, offset, width, null)) {
        this.app.toast('Not enough free wall there — try another spot', 'info');
        return;
      }
      def.offset = FC.round(offset, 3);
      def.width = FC.round(width, 3);
      this.app.pushHistory();
      this.app.plan.openings.push(def);
      this.app.select({ type: 'opening', id: def.id });
      this.app.changed({ rooms: false, furniture: true, save: true });
      this.app.ui.updateHint();
      this.hoverOpeningWall = null;
      this.draw();
    }

    /* ---------------------------------------------------------------- */
    /* Hit testing                                                       */
    /* ---------------------------------------------------------------- */

    hitRoom(w) {
      const rooms = this.app.rooms || [];
      for (let i = rooms.length - 1; i >= 0; i--) {
        if (FC.pointInPolygon(w, rooms[i].polygon)) return rooms[i];
      }
      return null;
    }

    hitRoomVertex(w, room, tolPx) {
      if (!room || !Array.isArray(room.polygon)) return null;
      const tol = this.screenTol(tolPx || 10);
      let best = null;
      room.polygon.forEach((p, index) => {
        const d = FC.dist(w, p);
        if (d <= tol && (!best || d < best.d)) best = { index, d, point: p };
      });
      return best;
    }

    hitOpening(w) {
      const segs = FC.getSegments(this.app.plan);
      const tol = this.screenTol(8);
      let best = null;
      this.app.plan.openings.forEach((op) => {
        const pl = FC.openingPlacement(this.app.plan, op, segs);
        if (!pl) return;
        const hit = FC.pointSegment(w, { x: pl.x - Math.cos(pl.angle) * pl.width / 2, y: pl.y - Math.sin(pl.angle) * pl.width / 2 }, { x: pl.x + Math.cos(pl.angle) * pl.width / 2, y: pl.y + Math.sin(pl.angle) * pl.width / 2 });
        if (hit.dist < tol + pl.seg.thickness * 0.7 && (!best || hit.dist < best.dist)) best = { op, dist: hit.dist };
      });
      return best ? best.op : null;
    }

    hitOpeningBadge(w) {
      const sel = this.app.ui.selection;
      if (!sel || sel.type !== 'opening') return null;
      const op = this.app.plan.openings.find((o) => o.id === sel.id);
      if (!op) return null;
      const segs = FC.getSegments(this.app.plan);
      const pl = FC.openingPlacement(this.app.plan, op, segs);
      if (!pl) return null;
      const s = this.w2s({ x: pl.x, y: pl.y });
      const badgeY = s.y - 28;
      const sw = this.w2s(w);
      if (Math.abs(sw.y - badgeY) <= 14) {
        if (op.kind === 'door') {
          if (sw.x >= s.x - 74 && sw.x <= s.x - 30) return { op, action: 'delete' };
          if (sw.x >= s.x - 22 && sw.x <= s.x + 22) return { op, action: 'flip' };
          if (sw.x >= s.x + 30 && sw.x <= s.x + 74) return { op, action: 'hinge' };
        } else {
          if (sw.x >= s.x - 22 && sw.x <= s.x + 22) return { op, action: 'delete' };
        }
      }
      return null;
    }

    hitJunction(w) {
      const junctions = FC.findJunctions(this.app.plan, this.screenTol(14));
      let best = null;
      junctions.forEach((j) => {
        const d = FC.dist(w, j);
        if (d <= this.screenTol(14) && (!best || d < best.d)) {
          best = { junction: j, d };
        }
      });
      return best ? best.junction : null;
    }

    hitFurniture(w) {
      if (!this.app.plan.furnished || !this.app.furniture) return null;
      for (let i = this.app.furniture.length - 1; i >= 0; i--) {
        const f = this.app.furniture[i];
        const dx = w.x - f.x;
        const dy = w.y - f.y;
        const cos = Math.cos(-(f.rot || 0));
        const sin = Math.sin(-(f.rot || 0));
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        if (Math.abs(lx) <= f.w / 2 + 0.08 && Math.abs(ly) <= f.d / 2 + 0.08) {
          return f;
        }
      }
      return null;
    }

    hitFurnitureRotate(w) {
      const sel = this.app.ui.selection;
      if (!sel || sel.type !== 'furniture' || !this.app.furniture) return null;
      const f = this.app.furniture.find((item) => item.id === sel.id);
      if (!f) return null;
      const cos = Math.cos(f.rot || 0);
      const sin = Math.sin(f.rot || 0);
      const hDist = f.d / 2 + 0.45;
      const handlePos = { x: f.x + -sin * hDist, y: f.y + cos * hDist };
      if (FC.dist(w, handlePos) <= this.screenTol(14)) {
        return f;
      }
      return null;
    }

    hitLight(w) {
      const lights = this.app.plan.lights || [];
      const tol = this.screenTol(14);
      let best = null;
      lights.forEach((l) => {
        const d = FC.dist(w, l);
        if (d <= tol && (!best || d < best.d)) {
          best = { light: l, d };
        }
      });
      return best ? best.light : null;
    }

    onContextMenu(e) {
      const w = this.updatePointer(e);
      const hit = this.hitTest(w);
      const items = [];
      const clip = this.app.getClipboard ? this.app.getClipboard() : null;

      if (this.app.ui && this.app.ui.selection && this.app.ui.selection.type === 'walls') {
        const wallCount = this.app.ui.selection.keys ? this.app.ui.selection.keys.length : 2;
        items.push({
          label: `Connect ${wallCount} selected walls`,
          icon: 'link',
          action: () => this.app.connectWalls(),
        });
        items.push({
          label: `Merge selected walls`,
          icon: 'merge',
          action: () => this.app.mergeWalls(),
        });
        items.push({ separator: true });
        items.push({
          label: 'Copy selected parts',
          icon: 'copy',
          shortcut: 'Ctrl+C',
          action: () => this.app.copySelection && this.app.copySelection(),
        });
        items.push({
          label: 'Duplicate selected parts',
          icon: 'plus',
          shortcut: 'Ctrl+D',
          action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
        });
        if (clip) {
          items.push({
            label: 'Paste here',
            icon: 'layers',
            shortcut: 'Ctrl+V',
            action: () => this.app.pasteClipboard && this.app.pasteClipboard(w),
          });
        }
        items.push({ separator: true });
        items.push({
          label: 'Delete selected parts',
          icon: 'trash',
          danger: true,
          action: () => this.app.deleteSelection(),
        });
        this.app.ui.openContextMenu(e.clientX, e.clientY, items);
        return;
      }

      if (hit && (hit.type === 'outline-vertex' || (hit.type === 'junction' && hit.junction && hit.junction.refs && hit.junction.refs.some((r) => r.type === 'outline')))) {
        const outlineRef = hit.type === 'outline-vertex'
          ? { index: hit.index }
          : hit.junction.refs.find((r) => r.type === 'outline');
        if (outlineRef && this.app.plan.outline && this.app.plan.outline.length > 3) {
          this.app.select({ type: 'vertex', index: outlineRef.index });
          items.push({
            label: 'Delete corner',
            icon: 'trash',
            danger: true,
            action: () => this.app.deleteOutlineCorner && this.app.deleteOutlineCorner(outlineRef.index),
          });
        }
      } else if (hit && hit.type === 'opening') {
        const op = hit.op;
        this.app.select({ type: 'opening', id: op.id });
        const label = FC.openingLabel(op);
        items.push({
          label: 'Copy ' + label,
          icon: 'copy',
          shortcut: 'Ctrl+C',
          action: () => this.app.copySelection && this.app.copySelection(),
        });
        items.push({
          label: 'Duplicate ' + label,
          icon: 'plus',
          shortcut: 'Ctrl+D',
          action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
        });
        items.push({
          label: 'Delete ' + label,
          icon: 'trash',
          danger: true,
          action: () => this.app.deleteSelection(),
        });
        if (op.kind === 'door') {
          items.push({ separator: true });
          items.push({
            label: 'Flip door swing',
            icon: 'refresh',
            action: () => this.app.flipDoor(),
          });
          items.push({
            label: 'Flip door hinge',
            icon: 'refresh',
            action: () => this.app.flipDoorHinge(),
          });
          items.push({
            label: 'Single door',
            action: () => this.app.setDoorStyle('single'),
          });
          items.push({
            label: 'Double door',
            action: () => this.app.setDoorStyle('double'),
          });
          items.push({
            label: 'Sliding door',
            action: () => this.app.setDoorStyle('sliding'),
          });
          items.push({
            label: 'Bifold door',
            action: () => this.app.setDoorStyle('bifold'),
          });
        }
      } else if (hit && hit.type === 'furniture') {
        const f = hit.furniture;
        this.app.select({ type: 'furniture', id: f.id });
        const fRoom = f.roomId && this.app.rooms ? this.app.rooms.find((r) => r.id === f.roomId) : null;
        items.push({
          label: 'Rotate 90°',
          icon: 'refresh',
          action: () => this.app.rotateSelectedFurniture(Math.PI / 2),
        });
        if (fRoom) {
          const rName = fRoom.name || (FC.roomTypes[fRoom.type] && FC.roomTypes[fRoom.type].label) || 'Room';
          items.push({
            label: `Regenerate ${rName} interior`,
            icon: 'sparkles',
            action: () => this.app.regenerateRoomInterior && this.app.regenerateRoomInterior(fRoom.id),
          });
        }
        items.push({
          label: 'Copy ' + f.kind,
          icon: 'copy',
          shortcut: 'Ctrl+C',
          action: () => this.app.copySelection && this.app.copySelection(),
        });
        items.push({
          label: 'Duplicate ' + f.kind,
          icon: 'plus',
          shortcut: 'Ctrl+D',
          action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
        });
        items.push({
          label: 'Delete ' + f.kind,
          icon: 'trash',
          danger: true,
          action: () => this.app.deleteSelectedFurniture(),
        });
      } else if (hit && hit.type === 'light') {
        const l = hit.light;
        this.app.select({ type: 'light', id: l.id });
        items.push({
          label: 'Copy light',
          icon: 'copy',
          shortcut: 'Ctrl+C',
          action: () => this.app.copySelection && this.app.copySelection(),
        });
        items.push({
          label: 'Duplicate light',
          icon: 'plus',
          shortcut: 'Ctrl+D',
          action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
        });
        items.push({
          label: 'Delete light',
          icon: 'trash',
          danger: true,
          action: () => this.app.deleteSelectedLight(),
        });
      } else if (hit && hit.type === 'wall') {
        const seg = hit.seg;
        this.app.select({ type: 'wall', key: seg.key });
        if (clip && clip.type === 'opening' && clip.opening) {
          items.push({
            label: `Paste ${FC.openingLabel(clip.opening)} here`,
            icon: 'copy',
            shortcut: 'Ctrl+V',
            action: () => this.app.pasteClipboard && this.app.pasteClipboard(w, seg.key),
          });
          items.push({ separator: true });
        }
        items.push({
          label: 'Add door here',
          icon: 'door',
          action: () => this.app.placeDoorAt(seg.key, hit.offset || seg.len / 2),
        });
        items.push({
          label: 'Add window here',
          icon: 'window',
          action: () => this.app.placeWindowAt(seg.key, hit.offset || seg.len / 2),
        });
        items.push({
          label: 'Add passage here',
          icon: 'expand',
          action: () => this.app.placeOpeningAt(seg.key, hit.offset || seg.len / 2),
        });
        if (seg.boundary) {
          items.push({ separator: true });
          items.push({
            label: 'Insert corner here',
            icon: 'plus',
            action: () => this.app.insertOutlineCornerAt && this.app.insertOutlineCornerAt(seg.index, w),
          });
          items.push({
            label: 'Copy wall',
            icon: 'copy',
            shortcut: 'Ctrl+C',
            action: () => this.app.copySelection && this.app.copySelection(),
          });
        } else {
          const cand = seg.id && FC.findParallelWall ? FC.findParallelWall(this.app.plan, seg.id) : null;
          if (cand) {
            const thickLabel = FC.formatThickness ? FC.formatThickness(cand.thicknessCm / 100, this.app.plan) : `${cand.thicknessCm} cm`;
            items.push({ separator: true });
            items.push({
              label: `Merge with parallel wall (${thickLabel})`,
              icon: 'sliders',
              action: () => this.app.mergeSelectedWallWithParallel(cand.wall.id),
            });
          }
          items.push({ separator: true });
          items.push({
            label: 'Connect to another wall...',
            icon: 'link',
            action: () => this.app.startConnectMode(seg.id),
          });
          items.push({
            label: 'Connect to nearest wall / corner',
            icon: 'sparkles',
            action: () => this.app.connectWallToNearest(seg.id),
          });
          items.push({
            label: 'Extend to next wall',
            icon: 'expand',
            action: () => this.app.extendWallToBoundary(seg.id, 2),
          });
          items.push({ separator: true });
          items.push({
            label: 'Split wall here',
            icon: 'sliders',
            action: () => this.app.splitWallAt(seg.id, w),
          });
          items.push({
            label: 'Copy wall',
            icon: 'copy',
            shortcut: 'Ctrl+C',
            action: () => this.app.copySelection && this.app.copySelection(),
          });
          items.push({
            label: 'Duplicate wall',
            icon: 'plus',
            shortcut: 'Ctrl+D',
            action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
          });
          items.push({
            label: 'Delete wall',
            icon: 'trash',
            danger: true,
            action: () => this.app.deleteSelection(),
          });
        }
      } else if (hit && hit.type === 'room') {
        const room = hit.room;
        this.app.select({ type: 'room', id: room.id });
        const rName = room.name || (FC.roomTypes[room.type] && FC.roomTypes[room.type].label) || 'Room';
        items.push({
          label: `Regenerate ${rName} interior`,
          icon: 'sparkles',
          action: () => this.app.regenerateRoomInterior && this.app.regenerateRoomInterior(room.id),
        });
        items.push({ separator: true });
        items.push({
          label: `Copy ${rName} (walls & contents)`,
          icon: 'copy',
          shortcut: 'Ctrl+C',
          action: () => this.app.copySelection && this.app.copySelection(),
        });
        items.push({
          label: `Duplicate ${rName}`,
          icon: 'plus',
          shortcut: 'Ctrl+D',
          action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
        });
        if (clip) {
          items.push({
            label: `Paste ${clip.type === 'opening' ? FC.openingLabel(clip.opening) : (clip.label || 'copied parts')} here`,
            icon: 'layers',
            shortcut: 'Ctrl+V',
            action: () => this.app.pasteClipboard && this.app.pasteClipboard(w),
          });
        }
      } else {
        if (clip) {
          items.push({
            label: `Paste ${clip.type === 'opening' ? FC.openingLabel(clip.opening) : (clip.label || 'copied parts')} here`,
            icon: 'layers',
            shortcut: 'Ctrl+V',
            action: () => this.app.pasteClipboard && this.app.pasteClipboard(w),
          });
          items.push({ separator: true });
        }
        items.push({
          label: 'Fit plan to screen',
          icon: 'expand',
          shortcut: 'F',
          action: () => this.fit(),
        });
        items.push({
          label: 'Make it 3D',
          icon: 'cube',
          shortcut: '3',
          action: () => this.app.enter3D(7),
        });
      }

      if (items.length && this.app.ui) {
        this.app.ui.openContextMenu(e.clientX, e.clientY, items);
      }
    }

    hitTest(w) {
      const plan = this.app.plan;
      const tol = this.screenTol(12);

      const badgeHit = this.hitOpeningBadge(w);
      if (badgeHit) return { type: 'opening-badge', op: badgeHit.op, action: badgeHit.action };

      const rotHit = this.hitFurnitureRotate(w);
      if (rotHit) return { type: 'furniture-rotate', furniture: rotHit };

      // Draggable corner handles on the currently selected room
      const sel = this.app.ui && this.app.ui.selection;
      if (sel && sel.type === 'room') {
        const selRoom = (this.app.rooms || []).find((r) => r.id === sel.id);
        const vHit = this.hitRoomVertex(w, selRoom, 10);
        if (vHit) return { type: 'room-vertex', roomId: selRoom.id, index: vHit.index };
      }

      const lightHit = this.hitLight(w);
      if (lightHit) return { type: 'light', light: lightHit };

      if (this.app.ui && this.app.ui.selection && this.app.ui.selection.type === 'wall') {
        const selSeg = FC.segmentByKey(plan, this.app.ui.selection.key);
        if (selSeg && !selSeg.boundary) {
          const dir = { x: Math.cos(selSeg.angle), y: Math.sin(selSeg.angle) };
          const handleTol = this.screenTol(12);
          const handleDist = this.screenTol(16);
          const pA = { x: selSeg.a.x - dir.x * handleDist, y: selSeg.a.y - dir.y * handleDist };
          const pB = { x: selSeg.b.x + dir.x * handleDist, y: selSeg.b.y + dir.y * handleDist };
          if (FC.dist(w, pB) <= handleTol) {
            return { type: 'wall-extend-handle', wallId: selSeg.id, end: 0, pt: pB };
          }
          if (FC.dist(w, pA) <= handleTol) {
            return { type: 'wall-extend-handle', wallId: selSeg.id, end: 1, pt: pA };
          }
        }
      }

      const junc = this.hitJunction(w);
      if (junc) return { type: 'junction', junction: junc };

      const op = this.hitOpening(w);
      if (op) return { type: 'opening', op };

      const f = this.hitFurniture(w);
      if (f) return { type: 'furniture', furniture: f };

      const segs = FC.getSegments(plan);
      let bestWall = null;
      for (const seg of segs) {
        const hit = FC.pointSegment(w, seg.a, seg.b);
        if (hit.dist < seg.thickness / 2 + this.screenTol(8)) {
          if (!bestWall || hit.dist < bestWall.dist) bestWall = { type: 'wall', seg, dist: hit.dist, offset: hit.t * seg.len };
        }
      }
      if (bestWall) return bestWall;

      const rooms = this.app.rooms || [];
      for (const room of rooms) {
        if (room.polygon && room.polygon.length >= 3 && FC.pointInPolygon(w, room.polygon)) {
          return { type: 'room', room, id: room.id };
        }
      }
      return null;
    }

    /* ---------------------------------------------------------------- */
    /* Draw                                                              */
    /* ---------------------------------------------------------------- */

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      const W = this.W;
      const H = this.H;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, W, H);

      if (this.showGrid) this.drawGrid();

      const plan = this.app.plan;
      const rooms = this.app.rooms || [];
      const segs = FC.getSegments(plan);

      this.drawRooms(rooms);
      if (this.app.detectedRoomsPreview && this.app.detectedRoomsPreview.length) {
        this.drawDetectedRoomsPreview(this.app.detectedRoomsPreview);
      }
      if (this.app.plan.furnished) this.drawFurniture();
      this.drawRoomLabels(rooms);
      if (this.app.detectedRoomsPreview && this.app.detectedRoomsPreview.length) {
        this.drawDetectedRoomLabels(this.app.detectedRoomsPreview);
      }
      this.drawWalls(segs);
      this.drawOpenings(segs);
      this.drawOpeningOffsets(segs);
      this.drawLights();
      this.drawRoomVertexHandles(rooms);
      this.drawOutlineHandles();
      if (plan.settings.showDims && plan.outline.length >= 3 && !this.app.ui.drawingFresh) this.drawDims();
      this.drawDraft(segs);
      this.drawHover(segs);
      this.drawSnap();
      if (this.lengthBuffer) this.drawLengthInput();
    }

    drawGrid() {
      const ctx = this.ctx;
      const step = this.gridStep();
      const major = step * 4;
      const W = this.W;
      const H = this.H;
      const w0 = this.s2w(0, 0);
      const w1 = this.s2w(W, H);
      const x0 = Math.floor(w0.x / step) * step;
      const y0 = Math.floor(w0.y / step) * step;
      const x1 = w1.x + step;
      const y1 = w1.y + step;

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ececee';
      ctx.beginPath();
      for (let x = x0; x <= x1; x += step) {
        if (Math.abs(x / major - Math.round(x / major)) < 1e-6) continue;
        const s = this.w2s({ x, y: 0 }).x;
        ctx.moveTo(Math.round(s) + 0.5, 0);
        ctx.lineTo(Math.round(s) + 0.5, H);
      }
      for (let y = y0; y <= y1; y += step) {
        if (Math.abs(y / major - Math.round(y / major)) < 1e-6) continue;
        const s = this.w2s({ x: 0, y }).y;
        ctx.moveTo(0, Math.round(s) + 0.5);
        ctx.lineTo(W, Math.round(s) + 0.5);
      }
      ctx.stroke();

      ctx.strokeStyle = '#e1e1e5';
      ctx.beginPath();
      for (let x = Math.floor(w0.x / major) * major; x <= x1; x += major) {
        const s = this.w2s({ x, y: 0 }).x;
        ctx.moveTo(Math.round(s) + 0.5, 0);
        ctx.lineTo(Math.round(s) + 0.5, H);
      }
      for (let y = Math.floor(w0.y / major) * major; y <= y1; y += major) {
        const s = this.w2s({ x: 0, y }).y;
        ctx.moveTo(0, Math.round(s) + 0.5);
        ctx.lineTo(W, Math.round(s) + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawRooms(rooms) {
      const ctx = this.ctx;
      rooms.forEach((room) => {
        const type = FC.roomTypes[room.type] || FC.roomTypes.living;
        const selected = this.app.ui.selection && this.app.ui.selection.type === 'room' && this.app.ui.selection.id === room.id;
        ctx.beginPath();
        room.polygon.forEach((p, i) => {
          const s = this.w2s(p);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
        ctx.fillStyle = hexA(type.color, selected ? 0.42 : 0.26);
        ctx.fill();
        if (selected) {
          ctx.strokeStyle = hexA('#5b4bf6', 0.8);
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }

    drawRoomVertexHandles(rooms) {
      const sel = this.app.ui && this.app.ui.selection;
      if (!sel || sel.type !== 'room') return;
      const room = (rooms || []).find((r) => r.id === sel.id);
      if (!room || !Array.isArray(room.polygon)) return;
      const ctx = this.ctx;
      const hover = this.hover && this.hover.type === 'room-vertex' && this.hover.roomId === room.id ? this.hover.index : -1;
      ctx.save();
      room.polygon.forEach((p, i) => {
        const s = this.w2s(p);
        const active = i === hover;
        ctx.beginPath();
        ctx.arc(s.x, s.y, active ? 6 : 4.5, 0, TAU);
        ctx.fillStyle = active ? ACCENT : '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = ACCENT;
        ctx.stroke();
      });
      ctx.restore();
    }

    drawRoomLabels(rooms) {
      const ctx = this.ctx;
      const plan = this.app.plan;
      const showDims = plan && plan.settings && plan.settings.showDims !== false;
      rooms.forEach((room) => {
        const type = FC.roomTypes[room.type] || FC.roomTypes.living;
        const s = this.w2s(room.centroid);
        const rw = room.bounds.w * this.view.scale;
        if (rw < 52) return;
        const areaStr = FC.formatArea ? FC.formatArea(room.area, plan, 1) : FC.fmt(room.area, 1) + ' m²';
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#54555d';
        ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(room.name || type.label, s.x, showDims && rw >= 76 ? s.y - 12 : s.y - 7);
        ctx.fillStyle = '#8b8c94';
        ctx.font = '500 10.5px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(areaStr, s.x, showDims && rw >= 76 ? s.y + 3 : s.y + 9);
        if (showDims && rw >= 76 && room.bounds && room.bounds.w > 0.4 && room.bounds.d > 0.4) {
          const wStr = FC.formatLengthShort ? FC.formatLengthShort(room.bounds.w, plan, 1) : FC.fmt(room.bounds.w, 1);
          const dStr = FC.formatLength ? FC.formatLength(room.bounds.d, plan, 1) : FC.fmt(room.bounds.d, 1) + ' m';
          ctx.fillStyle = '#a0a1aa';
          ctx.font = '500 9.5px "Segoe UI", system-ui, sans-serif';
          ctx.fillText(wStr + ' × ' + dStr, s.x, s.y + 17);
        }
        ctx.restore();
      });
    }

    drawDetectedRoomsPreview(candidates) {
      const ctx = this.ctx;
      ctx.save();
      candidates.forEach((cand) => {
        if (!cand.polygon || cand.polygon.length < 3) return;
        ctx.beginPath();
        cand.polygon.forEach((p, i) => {
          const s = this.w2s(p);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(139, 92, 246, 0.16)';
        ctx.fill();

        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawDetectedRoomLabels(candidates) {
      const ctx = this.ctx;
      candidates.forEach((cand) => {
        if (!cand.centroid || !cand.polygon) return;
        const type = FC.roomTypes[cand.type] || FC.roomTypes.living;
        const s = this.w2s(cand.centroid);
        const name = cand.name || type.label;
        const areaTxt = FC.formatArea ? FC.formatArea(cand.area, this.app.plan, 1) : FC.fmt(cand.area, 1) + ' m²';
        const labelTxt = '✨ ' + name + ' · ' + areaTxt;

        ctx.save();
        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        const textMetrics = ctx.measureText(labelTxt);
        const padX = 8;
        const padY = 4;
        const boxW = textMetrics.width + padX * 2;
        const boxH = 20;

        ctx.fillStyle = 'rgba(24, 25, 32, 0.90)';
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(s.x - boxW / 2, s.y - boxH / 2, boxW, boxH, 10);
        } else {
          ctx.rect(s.x - boxW / 2, s.y - boxH / 2, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f5f3ff';
        ctx.fillText(labelTxt, s.x, s.y + 0.5);
        ctx.restore();
      });
    }

    drawWalls(segs) {
      const ctx = this.ctx;
      if (!segs.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // soft under-shadow
      ctx.strokeStyle = 'rgba(28,28,34,0.10)';
      segs.forEach((seg) => {
        if (seg.wall && seg.wall.virtual) return;
        const a = this.w2s(seg.a);
        const b = this.w2s(seg.b);
        ctx.lineWidth = seg.thickness * this.view.scale + 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      segs.forEach((seg) => {
        const a = this.w2s(seg.a);
        const b = this.w2s(seg.b);
        if (seg.wall && seg.wall.virtual) {
          ctx.save();
          ctx.setLineDash([7, 5]);
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.lineWidth = seg.thickness * this.view.scale;
        ctx.strokeStyle = seg.boundary ? '#26262b' : '#37373d';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      // rounded joints
      const joints = new Map();
      segs.forEach((seg) => {
        if (seg.wall && seg.wall.virtual) return;
        [seg.a, seg.b].forEach((p) => {
          const k = Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000);
          const cur = joints.get(k);
          if (!cur || seg.thickness > cur.t) joints.set(k, { p, t: seg.thickness });
        });
      });
      joints.forEach((j) => {
        const s = this.w2s(j.p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, (j.t * this.view.scale) / 2, 0, TAU);
        ctx.fillStyle = '#2b2b30';
        ctx.fill();
      });

      // selection / hover highlight
      const sel = this.app.ui.selection;
      if (sel && sel.type === 'wall') {
        const seg = segs.find((s) => s.key === sel.key);
        if (seg) {
          const a = this.w2s(seg.a);
          const b = this.w2s(seg.b);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          ctx.strokeStyle = 'rgba(91,75,246,0.35)';
          ctx.lineWidth = seg.thickness * this.view.scale + 7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          [a, b, mid].forEach((p, idx) => this.handleDot(p, idx === 2 ? '#ffffff' : ACCENT));
          if (!seg.boundary) {
            const dir = { x: Math.cos(seg.angle), y: Math.sin(seg.angle) };
            const handleDist = 16;
            const hA = { x: a.x - dir.x * handleDist, y: a.y - dir.y * handleDist };
            const hB = { x: b.x + dir.x * handleDist, y: b.y + dir.y * handleDist };
            [hA, hB].forEach((hp) => {
              ctx.beginPath();
              ctx.arc(hp.x, hp.y, 4.5, 0, TAU);
              ctx.fillStyle = '#6366f1';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.fill();
              ctx.stroke();
            });
          }
          const wallLenStr = FC.formatLength ? FC.formatLength(seg.len, this.app.plan) : seg.len.toFixed(2) + ' m';
          this.drawPill(mid.x, mid.y - 18, wallLenStr, 'dark');
        }
      } else if (sel && sel.type === 'walls' && Array.isArray(sel.keys)) {
        sel.keys.forEach((key) => {
          const seg = segs.find((s) => s.key === key);
          if (!seg) return;
          const a = this.w2s(seg.a);
          const b = this.w2s(seg.b);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          ctx.strokeStyle = 'rgba(91,75,246,0.35)';
          ctx.lineWidth = seg.thickness * this.view.scale + 7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          [a, b, mid].forEach((p, idx) => this.handleDot(p, idx === 2 ? '#ffffff' : ACCENT));
        });
      }

      if (this.connectMode && this.connectMode.sourceWallId) {
        const srcSeg = segs.find((s) => s.id === this.connectMode.sourceWallId);
        if (srcSeg) {
          const a = this.w2s(srcSeg.a);
          const b = this.w2s(srcSeg.b);
          ctx.save();
          ctx.strokeStyle = 'rgba(99,102,241,0.5)';
          ctx.lineWidth = srcSeg.thickness * this.view.scale + 8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (!this.connectMode && this.hover && this.hover.type === 'wall' && this.hover.seg) {
        const seg = this.hover.seg;
        const a = this.w2s(seg.a);
        const b = this.w2s(seg.b);
        ctx.strokeStyle = 'rgba(91,75,246,0.20)';
        ctx.lineWidth = seg.thickness * this.view.scale + 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    handleDot(p, active) {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? 5 : 4, 0, TAU);
      ctx.fillStyle = active ? ACCENT : '#ffffff';
      ctx.strokeStyle = active ? '#ffffff' : '#4a4a51';
      ctx.lineWidth = active ? 2 : 1.4;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawOpenings(segs) {
      const ctx = this.ctx;
      const plan = this.app.plan;
      const sel = this.app.ui.selection;
      plan.openings.forEach((op) => {
        const pl = FC.openingPlacement(plan, op, segs);
        if (!pl) return;
        const s = this.w2s({ x: pl.x, y: pl.y });
        const dir = { x: Math.cos(pl.angle), y: Math.sin(pl.angle) };
        const n = { x: -dir.y, y: dir.x };
        const half = (pl.width * this.view.scale) / 2;
        const thick = pl.seg.thickness * this.view.scale;
        const selected = sel && sel.type === 'opening' && sel.id === op.id;
        const hovered = this.hover && this.hover.type === 'opening' && this.hover.op.id === op.id;

        // cut the wall open
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.strokeStyle = CANVAS_BG;
        ctx.lineWidth = thick + 2.5;
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half);
        ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half);
        ctx.stroke();
        ctx.restore();

        if (op.kind === 'window') {
          this.drawWindow(pl, s, dir, n, half, thick, selected || hovered);
        } else if (op.kind === 'opening') {
          this.drawPassage(pl, s, dir, n, half, thick, selected || hovered);
        } else {
          this.drawDoor(pl, s, dir, n, half, thick, selected || hovered);
        }

        if (selected) {
          ctx.save();
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half);
          ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = ACCENT;
          [-1, 1].forEach((k) => {
            ctx.beginPath();
            ctx.arc(s.x + dir.x * half * k, s.y + dir.y * half * k, 3.5, 0, TAU);
            ctx.fill();
          });

          // Draw inline action badges: [Del], [Flip], [Hinge]
          const badgeY = s.y - 28;
          ctx.font = 'bold 10.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (op.kind === 'door') {
            // Delete badge
            this.roundRect(s.x - 72, badgeY - 10, 40, 20, 5);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Del', s.x - 52, badgeY);

            // Flip swing badge
            this.roundRect(s.x - 20, badgeY - 10, 40, 20, 5);
            ctx.fillStyle = '#374151';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Flip', s.x, badgeY);

            // Hinge badge
            this.roundRect(s.x + 32, badgeY - 10, 40, 20, 5);
            ctx.fillStyle = '#374151';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Hinge', s.x + 52, badgeY);
          } else {
            // Delete badge only for windows / openings
            this.roundRect(s.x - 20, badgeY - 10, 40, 20, 5);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Del', s.x, badgeY);
          }

          ctx.restore();
        }
      });
    }

    drawOpeningOffsets(segs) {
      const ctx = this.ctx;
      const plan = this.app.plan;
      const sel = this.app.ui.selection;
      let targetSeg = null;
      let offset = 0;
      let width = 0;

      if (this.drag && this.drag.type === 'opening') {
        const op = plan.openings.find((o) => o.id === this.drag.id);
        if (op) {
          targetSeg = segs.find((s) => s.key === op.hostKey);
          offset = op.offset;
          width = op.width;
        }
      } else if (sel && sel.type === 'opening') {
        const op = plan.openings.find((o) => o.id === sel.id);
        if (op) {
          targetSeg = segs.find((s) => s.key === op.hostKey);
          offset = op.offset;
          width = op.width;
        }
      } else if (this.hover && this.hover.type === 'opening' && this.hover.op) {
        const op = this.hover.op;
        targetSeg = segs.find((s) => s.key === op.hostKey);
        offset = op.offset;
        width = op.width;
      } else if ((this.app.ui.tool === 'door' || this.app.ui.tool === 'window' || this.app.ui.tool === 'opening') && this.hoverOpeningWall) {
        const hit = this.hoverOpeningWall;
        const kind = this.app.ui.tool === 'window' ? 'window' : this.app.ui.tool === 'opening' ? 'opening' : 'door';
        const def = FC.defaultOpening(plan, kind, hit.seg.key, hit.offset);
        targetSeg = hit.seg;
        width = Math.min(def.width, hit.seg.len - 0.14);
        offset = FC.clamp(hit.offset, width / 2 + 0.03, hit.seg.len - width / 2 - 0.03);
      }

      if (!targetSeg || targetSeg.len <= width + 0.05) return;
      const leftDist = Math.max(0, offset - width / 2);
      const rightDist = Math.max(0, targetSeg.len - (offset + width / 2));
      const dir = { x: Math.cos(targetSeg.angle), y: Math.sin(targetSeg.angle) };
      const norm = { x: -dir.y, y: dir.x };
      const dimOffset = targetSeg.thickness / 2 + this.screenTol(18);

      const drawSpan = (p0, p1, distMeters) => {
        if (distMeters < 0.08) return;
        const o0 = { x: p0.x + norm.x * dimOffset, y: p0.y + norm.y * dimOffset };
        const o1 = { x: p1.x + norm.x * dimOffset, y: p1.y + norm.y * dimOffset };
        const s0 = this.w2s(o0);
        const s1 = this.w2s(o1);
        if (Math.hypot(s1.x - s0.x, s1.y - s0.y) < 34) return;
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // End ticks
        [s0, s1].forEach((sp) => {
          ctx.beginPath();
          ctx.moveTo(sp.x - norm.x * 4, sp.y - norm.y * 4);
          ctx.lineTo(sp.x + norm.x * 4, sp.y + norm.y * 4);
          ctx.stroke();
        });
        const midX = (s0.x + s1.x) / 2;
        const midY = (s0.y + s1.y) / 2;
        const txt = FC.formatLength ? FC.formatLength(distMeters, plan) : distMeters.toFixed(2) + ' m';
        this.drawPill(midX, midY, txt, 'light');
        ctx.restore();
      };

      const opStart = FC.lerp(targetSeg.a, targetSeg.b, leftDist / targetSeg.len);
      const opEnd = FC.lerp(targetSeg.a, targetSeg.b, (offset + width / 2) / targetSeg.len);
      drawSpan(targetSeg.a, opStart, leftDist);
      drawSpan(opEnd, targetSeg.b, rightDist);
    }

    drawDoor(pl, s, dir, n, half, thick, active) {
      const ctx = this.ctx;
      const w = half * 2;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = active ? ACCENT : '#4b4b52';

      // jambs
      [-1, 1].forEach((k) => {
        ctx.beginPath();
        ctx.moveTo(s.x + dir.x * half * k - n.x * thick * 0.5, s.y + dir.y * half * k - n.y * thick * 0.5);
        ctx.lineTo(s.x + dir.x * half * k + n.x * thick * 0.5, s.y + dir.y * half * k + n.y * thick * 0.5);
        ctx.stroke();
      });

      if (pl.op.style === 'sliding') {
        const gap = 3;
        const sign = pl.op.swingSide === -1 ? -1 : 1;
        ctx.strokeStyle = active ? ACCENT : '#55555c';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half + n.x * gap * sign, s.y - dir.y * half + n.y * gap * sign);
        ctx.lineTo(s.x + dir.x * half * 0.05 + n.x * gap * sign, s.y + dir.y * half * 0.05 + n.y * gap * sign);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half * 0.05 - n.x * gap * sign, s.y - dir.y * half * 0.05 - n.y * gap * sign);
        ctx.lineTo(s.x + dir.x * half - n.x * gap * sign, s.y + dir.y * half - n.y * gap * sign);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (pl.op.style === 'bifold') {
        const quarter = half / 2;
        const foldDepth = Math.min(quarter * 0.75, 12);
        const sign = pl.op.swingSide === -1 ? -1 : 1;
        ctx.strokeStyle = active ? ACCENT : '#2b2a30';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half);
        ctx.lineTo(s.x - dir.x * quarter + n.x * foldDepth * sign, s.y - dir.y * quarter + n.y * foldDepth * sign);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + dir.x * quarter + n.x * foldDepth * sign, s.y + dir.y * quarter + n.y * foldDepth * sign);
        ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (pl.op.style === 'double') {
        const sign = pl.op.swingSide === -1 ? -1 : 1;
        [-1, 1].forEach((k) => {
          const hinge = { x: s.x + dir.x * half * k, y: s.y + dir.y * half * k };
          const closedDir = { x: -dir.x * k, y: -dir.y * k };
          const openDir = { x: n.x * sign, y: n.y * sign };
          const aClosed = Math.atan2(closedDir.y, closedDir.x);
          const aOpen = Math.atan2(openDir.y, openDir.x);
          const cross = closedDir.x * openDir.y - closedDir.y * openDir.x;
          const anticlockwise = cross < 0;

          ctx.beginPath();
          ctx.arc(hinge.x, hinge.y, w / 2, aClosed, aOpen, anticlockwise);
          ctx.stroke();

          const ox = hinge.x + openDir.x * (w / 2);
          const oy = hinge.y + openDir.y * (w / 2);
          ctx.beginPath();
          ctx.moveTo(hinge.x, hinge.y);
          ctx.lineTo(ox, oy);
          ctx.stroke();
        });
        ctx.restore();
        return;
      }

      const isRight = pl.op.hinge === 'right';
      const sign = pl.op.swingSide === -1 ? -1 : 1;
      const hinge = isRight
        ? { x: s.x + dir.x * half, y: s.y + dir.y * half }
        : { x: s.x - dir.x * half, y: s.y - dir.y * half };
      const radius = w;
      const closedDir = isRight ? { x: -dir.x, y: -dir.y } : { x: dir.x, y: dir.y };
      const openDir = { x: n.x * sign, y: n.y * sign };

      const aClosed = Math.atan2(closedDir.y, closedDir.x);
      const aOpen = Math.atan2(openDir.y, openDir.x);
      const cross = closedDir.x * openDir.y - closedDir.y * openDir.x;
      const anticlockwise = cross < 0;

      ctx.beginPath();
      ctx.arc(hinge.x, hinge.y, radius, aClosed, aOpen, anticlockwise);
      ctx.stroke();

      const open = { x: hinge.x + openDir.x * radius, y: hinge.y + openDir.y * radius };
      ctx.strokeStyle = active ? ACCENT : '#3b3b42';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(open.x, open.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hinge.x, hinge.y, 2.2, 0, TAU);
      ctx.fillStyle = active ? ACCENT : '#3b3b42';
      ctx.fill();
      ctx.restore();
    }

    drawWindow(pl, s, dir, n, half, thick, active) {
      const ctx = this.ctx;
      ctx.save();
      // light glaze across the cut in the wall
      ctx.beginPath();
      [-1, 1].forEach((k) => {
        const x = s.x + dir.x * half * k;
        const y = s.y + dir.y * half * k;
        const px = x + n.x * thick * 0.5;
        const py = y + n.y * thick * 0.5;
        if (k === -1) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      [1, -1].forEach((k) => {
        const x = s.x + dir.x * half * k;
        const y = s.y + dir.y * half * k;
        ctx.lineTo(x - n.x * thick * 0.5, y - n.y * thick * 0.5);
      });
      ctx.closePath();
      ctx.fillStyle = active ? 'rgba(91,75,246,0.13)' : 'rgba(111,151,173,0.14)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = active ? ACCENT : '#6f97ad';
      ctx.beginPath();
      ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half);
      ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = active ? ACCENT : '#9bb9c9';
      [-0.28, 0.28].forEach((k) => {
        const ox = n.x * thick * k;
        const oy = n.y * thick * k;
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half + ox, s.y - dir.y * half + oy);
        ctx.lineTo(s.x + dir.x * half + ox, s.y + dir.y * half + oy);
        ctx.stroke();
      });
      ctx.strokeStyle = active ? ACCENT : '#4f6e7e';
      ctx.lineWidth = 1.6;
      [-1, 1].forEach((k) => {
        ctx.beginPath();
        ctx.moveTo(s.x + dir.x * half * k - n.x * thick * 0.5, s.y + dir.y * half * k - n.y * thick * 0.5);
        ctx.lineTo(s.x + dir.x * half * k + n.x * thick * 0.5, s.y + dir.y * half * k + n.y * thick * 0.5);
        ctx.stroke();
      });
      if (pl.width > 1.6) {
        [-0.5, 0.5].forEach((k) => {
          ctx.beginPath();
          ctx.moveTo(s.x + dir.x * half * k, s.y + dir.y * half * k);
          ctx.lineTo(s.x + dir.x * half * k + n.x * thick * 0.5, s.y + dir.y * half * k + n.y * thick * 0.5);
          ctx.stroke();
        });
      }
      ctx.restore();
    }

    drawPassage(pl, s, dir, n, half, thick, active) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = active ? ACCENT : '#6c6c74';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half);
      ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half);
      ctx.stroke();
      ctx.setLineDash([]);
      [-1, 1].forEach((k) => {
        ctx.beginPath();
        ctx.moveTo(s.x + dir.x * half * k - n.x * thick * 0.5, s.y + dir.y * half * k - n.y * thick * 0.5);
        ctx.lineTo(s.x + dir.x * half * k + n.x * thick * 0.5, s.y + dir.y * half * k + n.y * thick * 0.5);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawOutlineHandles() {
      const tool = this.app.ui.tool;
      const plan = this.app.plan;
      if (!plan.outline.length) return;
      if (tool !== 'outline' && !(this.app.ui.selection && this.app.ui.selection.type === 'vertex')) return;
      const ctx = this.ctx;
      plan.outline.forEach((p, i) => {
        const s = this.w2s(p);
        const selected = this.app.ui.selection && this.app.ui.selection.type === 'vertex' && this.app.ui.selection.index === i;
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, selected ? 6 : 4.5, 0, TAU);
        ctx.fillStyle = selected ? ACCENT : '#ffffff';
        ctx.strokeStyle = selected ? '#ffffff' : '#333338';
        ctx.lineWidth = selected ? 2 : 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    drawDims() {
      const ctx = this.ctx;
      const plan = this.app.plan;
      const pts = plan.outline;
      const center = FC.polygonCentroid(pts);
      const offset = 0.52;
      ctx.save();
      ctx.font = '600 10.5px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const len = FC.dist(a, b);
        if (len < 0.8) continue;
        const sa = this.w2s(a);
        const sb = this.w2s(b);
        if (Math.hypot(sb.x - sa.x, sb.y - sa.y) < 64) continue;
        let nx = -(b.y - a.y) / len;
        let ny = (b.x - a.x) / len;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if ((mid.x - center.x) * nx + (mid.y - center.y) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        const oa = { x: a.x + nx * offset, y: a.y + ny * offset };
        const ob = { x: b.x + nx * offset, y: b.y + ny * offset };
        const soa = this.w2s(oa);
        const sob = this.w2s(ob);
        const smid = this.w2s(mid);
        ctx.strokeStyle = '#a7a7ae';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(soa.x, soa.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sb.x, sb.y);
        ctx.lineTo(sob.x, sob.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(soa.x, soa.y);
        ctx.lineTo(sob.x, sob.y);
        ctx.stroke();
        // tick marks
        [-1, 1].forEach((k) => {
          const px = smid.x + (soa.x - smid.x) * k;
          const py = smid.y + (soa.y - smid.y) * k;
          const ang = Math.atan2(sob.y - soa.y, sob.x - soa.x);
          ctx.beginPath();
          ctx.moveTo(px - Math.sin(ang) * 4, py + Math.cos(ang) * 4);
          ctx.lineTo(px + Math.sin(ang) * 4, py - Math.cos(ang) * 4);
          ctx.stroke();
        });
        const text = FC.formatLength ? FC.formatLength(len, plan) : FC.fmt(len, 2) + ' m';
        const tw = ctx.measureText(text).width + 12;
        const px = (soa.x + sob.x) / 2;
        const py = (soa.y + sob.y) / 2;
        this.roundRect(px - tw / 2, py - 9, tw, 18, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fill();
        ctx.strokeStyle = '#dedee2';
        ctx.stroke();
        ctx.fillStyle = '#6a6b72';
        ctx.fillText(text, px, py + 0.5);
      }
      ctx.restore();
    }

    drawFurniture() {
      const ctx = this.ctx;
      const items = this.app.furniture || [];
      if (!items.length) return;
      ctx.save();
      items.forEach((it) => {
        const s = this.w2s({ x: it.x, y: it.y });
        const w = it.w * this.view.scale;
        const d = it.d * this.view.scale;
        if (w < 3 || d < 3) return;
        if (it.kind === 'rug' || it.kind === 'bathMat') {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(it.rot);
          this.roundRect(-w / 2, -d / 2, w, d, 4);
          ctx.fillStyle = 'rgba(120,106,88,0.13)';
          ctx.fill();
          ctx.restore();
          return;
        }
        if (it.kind === 'plant') {
          ctx.beginPath();
          ctx.arc(s.x, s.y, w * 0.35, 0, TAU);
          ctx.fillStyle = 'rgba(93,122,83,0.30)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(74,102,64,0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
          return;
        }
        if (it.kind === 'artwork') {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(it.rot);
          this.roundRect(-w / 2, -d / 2, w, d, 1);
          ctx.fillStyle = 'rgba(180,130,90,0.55)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(60,45,30,0.85)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
          return;
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(it.rot);
        this.roundRect(-w / 2, -d / 2, w, d, Math.min(4, w * 0.2));
        ctx.fillStyle = 'rgba(56,56,62,0.10)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(44,44,52,0.36)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (it.kind === 'bed' || it.kind === 'singleBed') {
          ctx.beginPath();
          ctx.moveTo(-w / 2 + 3, -d / 2 + d * 0.28);
          ctx.lineTo(w / 2 - 3, -d / 2 + d * 0.28);
          ctx.strokeStyle = 'rgba(44,44,52,0.30)';
          ctx.stroke();
        } else if (it.kind === 'sofa') {
          ctx.beginPath();
          ctx.moveTo(-w / 2 + 3, d / 2 - d * 0.26);
          ctx.lineTo(w / 2 - 3, d / 2 - d * 0.26);
          ctx.strokeStyle = 'rgba(44,44,52,0.32)';
          ctx.stroke();
        } else if (it.kind === 'sectionalSofa') {
          ctx.beginPath();
          ctx.moveTo(-w / 2 + 3, d / 2 - d * 0.26);
          ctx.lineTo(w / 2 - 3, d / 2 - d * 0.26);
          ctx.moveTo(-w / 2 + w * 0.45, -d / 2 + 3);
          ctx.lineTo(-w / 2 + w * 0.45, d / 2 - 3);
          ctx.strokeStyle = 'rgba(44,44,52,0.34)';
          ctx.stroke();
        } else if (it.kind === 'armchair') {
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(w, d) * 0.35, 0, TAU);
          ctx.strokeStyle = 'rgba(44,44,52,0.28)';
          ctx.stroke();
        } else if (it.kind === 'toilet') {
          ctx.beginPath();
          ctx.ellipse(0, d * 0.12, w * 0.32, d * 0.3, 0, 0, TAU);
          ctx.strokeStyle = 'rgba(44,44,52,0.34)';
          ctx.stroke();
        } else if (it.kind === 'bathtub') {
          this.roundRect(-w / 2 + 4, -d / 2 + 4, w - 8, d - 8, Math.min(8, d * 0.3));
          ctx.strokeStyle = 'rgba(44,44,52,0.32)';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(w / 2 - 12, 0, 3, 0, TAU);
          ctx.stroke();
        } else if (it.kind === 'car') {
          ctx.beginPath();
          // Windshield arcs
          ctx.moveTo(-w * 0.38, -d * 0.15);
          ctx.lineTo(w * 0.38, -d * 0.15);
          ctx.moveTo(-w * 0.38, d * 0.22);
          ctx.lineTo(w * 0.38, d * 0.22);
          ctx.strokeStyle = 'rgba(44,44,52,0.35)';
          ctx.stroke();
          // Wheel marks
          [-1, 1].forEach((sx) => {
            [-1, 1].forEach((sz) => {
              ctx.strokeRect(sx * (w / 2 - 3) - (sx > 0 ? 3 : 0), sz * (d * 0.32) - 6, 3, 12);
            });
          });
        } else if (it.kind === 'washer' || it.kind === 'dryer') {
          ctx.beginPath();
          ctx.arc(0, d * 0.08, Math.min(w, d) * 0.32, 0, TAU);
          ctx.arc(0, d * 0.08, Math.min(w, d) * 0.18, 0, TAU);
          ctx.moveTo(-w / 2 + 3, -d / 2 + 6);
          ctx.lineTo(w / 2 - 3, -d / 2 + 6);
          ctx.strokeStyle = 'rgba(44,44,52,0.32)';
          ctx.stroke();
        } else if (it.kind === 'ovenRange') {
          [-1, 1].forEach((bx) => {
            [-1, 1].forEach((bz) => {
              ctx.beginPath();
              ctx.arc(bx * (w * 0.24), bz * (d * 0.24), Math.min(w, d) * 0.12, 0, TAU);
              ctx.stroke();
            });
          });
        } else if (it.kind === 'fireplace') {
          ctx.beginPath();
          ctx.strokeRect(-w * 0.35, -d / 2 + 2, w * 0.7, d - 4);
          ctx.moveTo(-w / 2, -d / 2 + 3);
          ctx.lineTo(w / 2, -d / 2 + 3);
          ctx.strokeStyle = 'rgba(180,90,40,0.55)';
          ctx.stroke();
        } else if (it.kind === 'parasol') {
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(w, d) / 2 - 2, 0, TAU);
          for (let sp = 0; sp < 8; sp++) {
            const ang = (sp * Math.PI) / 4;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * (w / 2 - 2), Math.sin(ang) * (d / 2 - 2));
          }
          ctx.strokeStyle = 'rgba(44,44,52,0.28)';
          ctx.stroke();
        } else if (it.kind === 'bbq') {
          ctx.beginPath();
          ctx.ellipse(0, 0, w * 0.35, d * 0.4, 0, 0, TAU);
          for (let gl = -2; gl <= 2; gl++) {
            ctx.moveTo(-w * 0.28, gl * (d * 0.12));
            ctx.lineTo(w * 0.28, gl * (d * 0.12));
          }
          ctx.strokeStyle = 'rgba(44,44,52,0.32)';
          ctx.stroke();
        } else if (it.kind === 'dresser') {
          ctx.beginPath();
          for (let dr = 1; dr <= 3; dr++) {
            const dy = -d / 2 + (d / 4) * dr;
            ctx.moveTo(-w / 2 + 3, dy);
            ctx.lineTo(w / 2 - 3, dy);
          }
          ctx.strokeStyle = 'rgba(44,44,52,0.26)';
          ctx.stroke();
        } else if (it.kind === 'officeChair') {
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(w, d) * 0.18, 0, TAU);
          for (let sp = 0; sp < 5; sp++) {
            const ang = (sp * TAU) / 5 - Math.PI / 2;
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * (w * 0.38), Math.sin(ang) * (d * 0.38));
          }
          ctx.strokeStyle = 'rgba(44,44,52,0.32)';
          ctx.stroke();
          // Backrest at -d/2 (chair faces +d/2 toward desk)
          const backH = Math.max(2.5, d * 0.16);
          this.roundRect(-w * 0.38, -d / 2 + 1.5, w * 0.76, backH, Math.min(3, backH * 0.5));
          ctx.fillStyle = 'rgba(44,44,52,0.22)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(44,44,52,0.45)';
          ctx.stroke();
          // Armrests on left/right sides
          const armW = Math.max(1.8, w * 0.11);
          const armD = d * 0.46;
          ctx.strokeRect(-w / 2 + 1.5, -d * 0.18, armW, armD);
          ctx.strokeRect(w / 2 - 1.5 - armW, -d * 0.18, armW, armD);
        } else if (it.kind === 'chair' || it.kind === 'patioChair') {
          const backH = Math.max(2, d * 0.15);
          this.roundRect(-w * 0.4, -d / 2 + 1.5, w * 0.8, backH, 2);
          ctx.fillStyle = 'rgba(44,44,52,0.20)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(44,44,52,0.42)';
          ctx.stroke();
        } else if (it.kind === 'planterBox') {
          ctx.fillStyle = 'rgba(93,122,83,0.25)';
          ctx.fill();
        }
        ctx.restore();

        // Selection highlight and rotation handle
        const sel = this.app.ui.selection;
        if (sel && sel.type === 'furniture' && sel.id === it.id) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(it.rot);
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          this.roundRect(-w / 2 - 4, -d / 2 - 4, w + 8, d + 8, 4);
          ctx.stroke();
          ctx.setLineDash([]);

          // Rotation handle
          ctx.beginPath();
          ctx.moveTo(0, d / 2 + 4);
          ctx.lineTo(0, d / 2 + 24);
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, d / 2 + 24, 5, 0, TAU);
          ctx.fillStyle = ACCENT;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.restore();
          const fwStr = FC.formatLength ? FC.formatLength(it.w, this.app.plan) : it.w.toFixed(2) + 'm';
          const fdStr = FC.formatLength ? FC.formatLength(it.d, this.app.plan) : it.d.toFixed(2) + 'm';
          this.drawPill(s.x, s.y - d / 2 - 16, (it.kind || 'Furniture') + ' • ' + fwStr + ' × ' + fdStr, 'dark');
        }
      });
      ctx.restore();
    }

    drawLights() {
      const lights = this.app.plan.lights || [];
      if (!lights.length) return;
      const ctx = this.ctx;
      const sel = this.app.ui.selection;
      ctx.save();
      lights.forEach((l) => {
        const s = this.w2s(l);
        const selected = sel && sel.type === 'light' && sel.id === l.id;
        const rad = Math.min(50, (l.range || 6.0) * this.view.scale * 0.32);

        // Soft illumination glow
        const grad = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, rad);
        grad.addColorStop(0, 'rgba(255, 225, 150, 0.35)');
        grad.addColorStop(1, 'rgba(255, 225, 150, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad, 0, TAU);
        ctx.fill();

        // Fixture symbol
        ctx.beginPath();
        ctx.arc(s.x, s.y, selected ? 7 : 5.5, 0, TAU);
        ctx.fillStyle = selected ? ACCENT : (l.color || '#f59e0b');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Rays
        [-1, 1].forEach((dir) => {
          ctx.beginPath();
          ctx.moveTo(s.x + dir * 8, s.y);
          ctx.lineTo(s.x + dir * 12, s.y);
          ctx.moveTo(s.x, s.y + dir * 8);
          ctx.lineTo(s.x, s.y + dir * 12);
          ctx.strokeStyle = selected ? ACCENT : '#b45309';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });

        if (selected) {
          this.drawPill(s.x, s.y - 18, (l.type || 'Light').toUpperCase() + ' • ' + (l.intensity || 1).toFixed(1) + 'x', 'dark');
        }
      });
      ctx.restore();
    }

    drawDraft(segs) {
      const tool = this.app.ui.tool;
      const ctx = this.ctx;
      const plan = this.app.plan;
      const accent = ACCENT;

      if (tool === 'outline' && this.app.ui.drawingFresh) {
        const pts = plan.outline;
        if (!pts.length) return;
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        pts.forEach((p, i) => {
          const s = this.w2s(p);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        const last = this.snap && this.snap.type !== 'close' ? this.snap.point : null;
        if (last) {
          const sl = this.w2s(pts[pts.length - 1]);
          const sn = this.w2s(last);
          ctx.lineTo(sn.x, sn.y);
          this.drawMeasure(sl, sn, FC.dist(pts[pts.length - 1], last));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // faint closing edge
        if (pts.length >= 3 && this.snap && this.snap.type === 'close') {
          const s0 = this.w2s(pts[0]);
          const sl = this.w2s(pts[pts.length - 1]);
          ctx.strokeStyle = 'rgba(91,75,246,0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sl.x, sl.y);
          ctx.lineTo(s0.x, s0.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      if ((tool === 'wall' || tool === 'divider') && this.wallChain) {
        const start = this.w2s(this.wallChain);
        if (this.snap) {
          const end = this.w2s(this.snap.point);
          ctx.save();
          ctx.strokeStyle = tool === 'divider' ? '#6366f1' : accent;
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          ctx.setLineDash([]);
          this.drawMeasure(start, end, FC.dist(this.wallChain, this.snap.point));
          this.handleDot(start, true);
          ctx.restore();
        }
      }

      if (tool === 'room' && this.roomChain && this.roomChain.length) {
        ctx.save();
        ctx.beginPath();
        this.roomChain.forEach((pt, i) => {
          const s = this.w2s(pt);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        if (this.snap) {
          const sEnd = this.w2s(this.snap.point);
          ctx.lineTo(sEnd.x, sEnd.y);
        }
        ctx.fillStyle = 'rgba(99, 102, 241, 0.16)';
        ctx.fill();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        this.roomChain.forEach((pt) => this.handleDot(this.w2s(pt), false));
        ctx.restore();
      }

      if (tool === 'rect' && (this.rectStart || (this.drag && this.drag.type === 'rect-drag'))) {
        const p1 = this.drag && this.drag.type === 'rect-drag' ? this.drag.start : this.rectStart;
        const p2 = this.drag && this.drag.type === 'rect-drag'
          ? this.drag.current
          : (this.snap ? this.snap.point : { x: this.pointer.wx, y: this.pointer.wy });
        if (p1 && p2) {
          const s1 = this.w2s(p1);
          const s2 = this.w2s(p2);
          const rx = Math.min(s1.x, s2.x);
          const ry = Math.min(s1.y, s2.y);
          const rw = Math.abs(s2.x - s1.x);
          const rh = Math.abs(s2.y - s1.y);
          const wMeters = Math.abs(p2.x - p1.x);
          const dMeters = Math.abs(p2.y - p1.y);
          ctx.save();
          ctx.fillStyle = 'rgba(91, 75, 246, 0.12)';
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.setLineDash([]);
          this.handleDot(s1, true);
          this.handleDot(s2, true);
          if (wMeters > 0.05 || dMeters > 0.05) {
            const wStr = FC.formatLength ? FC.formatLength(wMeters, plan) : wMeters.toFixed(2) + ' m';
            const dStr = FC.formatLength ? FC.formatLength(dMeters, plan) : dMeters.toFixed(2) + ' m';
            const areaStr = FC.formatArea ? FC.formatArea(wMeters * dMeters, plan, 1) : (wMeters * dMeters).toFixed(1) + ' m²';
            this.drawPill(rx + rw / 2, ry + rh / 2, `${wStr} × ${dStr} · ${areaStr}`, 'accent');
          }
          ctx.restore();
        }
      }

      if (this.measureStart) {
        const p1 = this.measureStart;
        const p2 = this.measureEnd || (this.snap ? this.snap.point : { x: this.pointer.wx, y: this.pointer.wy });
        if (p1 && p2) {
          const s1 = this.w2s(p1);
          const s2 = this.w2s(p2);
          const dist = FC.dist(p1, p2);
          const dx = Math.abs(p2.x - p1.x);
          const dy = Math.abs(p2.y - p1.y);
          const ang = Math.round((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI);
          ctx.save();
          // Orthogonal componentlegs
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
          // Main tape line
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
          ctx.setLineDash([]);
          this.handleDot(s1, true);
          this.handleDot(s2, true);
          if (dist > 0.01) {
            const dStr = FC.formatLength ? FC.formatLength(dist, plan) : dist.toFixed(2) + ' m';
            const dxStr = FC.formatLengthShort ? FC.formatLengthShort(dx, plan, 2) : dx.toFixed(2);
            const dyStr = FC.formatLengthShort ? FC.formatLengthShort(dy, plan, 2) : dy.toFixed(2);
            this.drawPill((s1.x + s2.x) / 2, (s1.y + s2.y) / 2 - 18, `📏 ${dStr} · ΔX ${dxStr} ΔY ${dyStr} · ${ang}°`, 'dark');
          }
          ctx.restore();
        }
      }

      if (this.drag && this.drag.type === 'marquee') {
        const s0 = this.w2s({ x: this.drag.x0, y: this.drag.y0 });
        const s1 = this.w2s({ x: this.drag.x1, y: this.drag.y1 });
        const rx = Math.min(s0.x, s1.x);
        const ry = Math.min(s0.y, s1.y);
        const rw = Math.abs(s1.x - s0.x);
        const rh = Math.abs(s1.y - s0.y);
        ctx.save();
        ctx.fillStyle = 'rgba(91, 75, 246, 0.10)';
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.restore();
      }

      if ((tool === 'door' || tool === 'window' || tool === 'opening') && this.hoverOpeningWall) {
        const hit = this.hoverOpeningWall;
        const kind = tool === 'window' ? 'window' : tool === 'opening' ? 'opening' : 'door';
        const def = FC.defaultOpening(plan, kind, hit.seg.key, hit.offset);
        const width = Math.min(def.width, hit.seg.len - 0.14);
        const offset = FC.clamp(hit.offset, width / 2 + 0.03, hit.seg.len - width / 2 - 0.03);
        const ok = FC.canPlaceOpening(plan, hit.seg.key, offset, width, null);
        const p = FC.lerp(hit.seg.a, hit.seg.b, offset / hit.seg.len);
        const s = this.w2s(p);
        const dir = { x: Math.cos(hit.seg.angle), y: Math.sin(hit.seg.angle) };
        const half = (width * this.view.scale) / 2;
        const thick = hit.seg.thickness * this.view.scale;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = ok ? accent : '#d04a4a';
        ctx.fillStyle = ok ? 'rgba(91,75,246,0.10)' : 'rgba(208,74,74,0.10)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half);
        ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillRect(s.x - thick / 2, s.y - 1, thick, 2);
        const label = kind === 'window' ? 'Window' : kind === 'opening' ? 'Opening' : 'Door';
        this.drawPill(s.x, s.y - 24, label + (ok ? '' : ' · blocked'), ok ? 'dark' : 'danger');
        ctx.restore();
      }
    }

    drawMeasure(a, b, len) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const off = 18;
      const nx = -Math.sin(angle) * off;
      const ny = Math.cos(angle) * off;
      const lenStr = FC.formatLength ? FC.formatLength(len, this.app.plan) : FC.fmt(len, 2) + ' m';
      this.drawPill(mx + nx, my + ny, lenStr + ' · ' + Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) + '°', 'accent');
    }

    drawHover(segs) {
      if (!this.hover) return;
      const ctx = this.ctx;
      if (this.connectMode && this.hover.type === 'wall' && this.hover.seg) {
        const seg = this.hover.seg;
        const a = this.w2s(seg.a);
        const b = this.w2s(seg.b);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = seg.thickness * this.view.scale + 6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        this.drawPill(mid.x, mid.y - 22, 'Click to connect with this wall', 'dark');
        ctx.restore();
        return;
      }
      if (this.hover.type === 'wall-extend-handle') {
        const s = this.w2s(this.hover.point);
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, TAU);
        ctx.fillStyle = 'rgba(234, 88, 12, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();
        this.drawPill(s.x, s.y - 22, 'Drag to extend wall (doors stay fixed)', 'dark');
        ctx.restore();
        return;
      }
      if (this.hover.type === 'junction') {
        const j = this.hover.junction;
        const s = this.w2s(j);
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, TAU);
        ctx.fillStyle = 'rgba(91, 75, 246, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#5b4bf6';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.stroke();
        const wallCount = j.refs ? j.refs.length : 1;
        const label = wallCount > 1 ? `Slide junction (${wallCount} walls)` : 'Slide wall end';
        this.drawPill(s.x, s.y - 22, label, 'accent');
        ctx.restore();
        return;
      }
      if (this.hover.type === 'outline-vertex' || this.hover.type === 'wall-end') {
        const p = this.hover.type === 'outline-vertex' ? this.app.plan.outline[this.hover.index] : null;
        if (p) this.handleDot(this.w2s(p), false);
      }
    }

    drawSnap() {
      if (!this.snap || this.snap.type === 'grid' || this.snap.type === 'free') return;
      const ctx = this.ctx;
      const s = this.w2s(this.snap.point);
      const typed = this.snap.type === 'typed';
      ctx.save();

      const guideFrom = this.snap.from || this.snap.anchor;
      if (guideFrom) {
        const sf = this.w2s(guideFrom);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#5b4bf6';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sf.x, sf.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.restore();
      }

      if (this.snap.alignGuides && this.snap.alignGuides.length) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 1.3;
        this.snap.alignGuides.forEach((g) => {
          const sf = this.w2s(g.from);
          const st = this.w2s(g.to);
          ctx.beginPath();
          ctx.moveTo(sf.x, sf.y);
          ctx.lineTo(st.x, st.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sf.x, sf.y, 3.5, 0, TAU);
          ctx.fillStyle = '#0ea5e9';
          ctx.fill();
        });
        ctx.restore();
      }

      ctx.strokeStyle = typed ? ACCENT : this.snap.type === 'close' ? '#e0952f' : this.snap.type === 'midpoint' ? '#0ea5e9' : ACCENT;
      ctx.fillStyle = typed ? ACCENT : this.snap.type === 'close' ? '#e0952f' : '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.snap.type === 'close' ? 8 : 5.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (this.snap.type === 'point' || this.snap.type === 'close' || this.snap.type === 'axis' || this.snap.type === 'wall' || this.snap.type === 'door' || this.snap.type === 'midpoint' || this.snap.type === 'align') {
        const label = this.snap.label;
        if (label) this.drawPill(s.x, s.y - 20, label, this.snap.type === 'close' ? 'warning' : (this.snap.type === 'door' ? 'accent' : 'light'));
      }
      ctx.restore();
    }

    drawLengthInput() {
      const tool = this.app.ui.tool;
      const from = this.drawingStart() || (tool === 'rect' && this.pointer.inside ? { x: this.pointer.wx, y: this.pointer.wy } : null);
      if (!from) return;
      const ctx = this.ctx;
      const typed = tool !== 'rect' ? this.typedPoint(from) : null;
      const p = typed ? typed : { x: this.pointer.wx, y: this.pointer.wy };
      const s = this.w2s({ x: p.x, y: p.y });
      const hasUnitMark = /['"xX,-]/.test(this.lengthBuffer);
      const unitSuffix = hasUnitMark ? '' : ' ' + (FC.lengthUnitLabel ? FC.lengthUnitLabel(this.app.plan) : 'm');
      ctx.save();
      this.drawPill(s.x + 26, s.y + 32, this.lengthBuffer + unitSuffix + '  ⏎', 'accent');
      ctx.restore();
    }

    drawPill(x, y, text, tone) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      const w = ctx.measureText(text).width + 16;
      const h = 22;
      let bg = '#202124';
      let fg = '#f3f3f5';
      let border = 'rgba(0,0,0,0)';
      if (tone === 'accent') {
        bg = ACCENT;
        fg = '#ffffff';
      } else if (tone === 'light') {
        bg = 'rgba(255,255,255,0.96)';
        fg = '#3b3b42';
        border = '#dedee3';
      } else if (tone === 'warning') {
        bg = '#f1a33a';
        fg = '#1e1f22';
      } else if (tone === 'danger') {
        bg = '#cf4747';
        fg = '#ffffff';
      }
      this.roundRect(x - w / 2, y - h / 2, w, h, 7);
      ctx.fillStyle = bg;
      ctx.fill();
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 0.5);
      ctx.restore();
    }

    roundRect(x, y, w, h, r) {
      const ctx = this.ctx;
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  FC.Editor2D = Editor2D;
})();

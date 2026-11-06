/* Floorcraft — 2D plan editor */
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
      this.spaceDown = false;
      this.pointer = { sx: 0, sy: 0, wx: 0, wy: 0, inside: false };
      this.snap = null;
      this.hover = null;
      this.drag = null;
      this.wallChain = null;
      this.chainFirst = null;
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
      const padX = 120;
      const padTop = 148;
      const padBottom = 118;
      const availW = Math.max(160, this.W - sidebar - padX * 2);
      const availH = Math.max(160, this.H - padTop - padBottom);
      const bw = Math.max(b.w, 2);
      const bd = Math.max(b.d, 2);
      let scale = Math.min(availW / bw, availH / bd, 150);
      scale = Math.max(18, scale);
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
      this.view.scale = FC.clamp(this.view.scale * factor, 10, 700);
      const after = this.s2w(a.x, a.y);
      this.view.cx += before.x - after.x;
      this.view.cy += before.y - after.y;
      this.updateZoomLabel();
      this.draw();
    }

    setZoom(percent) {
      const target = FC.clamp(percent / 100 * 80, 10, 700);
      this.zoomBy(target / this.view.scale);
    }

    updateZoomLabel() {
      const el = document.getElementById('zoomValue');
      if (el) el.textContent = Math.round((this.view.scale / 80) * 100) + '%';
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
      const c = [0.25, 0.5, 1, 2, 5, 10, 20];
      for (const s of c) if (s * this.view.scale >= 15) return s;
      return 20;
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

      // Existing corners / endpoints
      const verts = this.allVertices();
      for (const v of verts) {
        const d = FC.dist(raw, v.p);
        if (d <= tol && (!best || d < best.d)) best = { d, point: { x: v.p.x, y: v.p.y }, type: 'point', label: v.label, hit: v };
      }
      if (best) return best;

      // Nearest wall
      const wallHit = FC.nearestWall(plan, raw, this.screenTol(11));
      if (wallHit) {
        return { point: wallHit.point, type: 'wall', label: 'Wall', seg: wallHit.seg, offset: wallHit.offset };
      }

      // Orthogonal / angle snapping
      if (from) {
        const dx = raw.x - from.x;
        const dy = raw.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.001) {
          let angle = Math.atan2(dy, dx);
          let snapped = false;
          if (opts.ortho || this.app.ui.ortho) {
            angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
            snapped = true;
          } else {
            const nearest = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
            if (Math.abs(FC.angleDiff(angle, nearest)) < 0.065) {
              angle = nearest;
              snapped = true;
            }
          }
          if (snapped) {
            let point = { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len };
            if (this.gridSnap) {
              point.x = Math.round(point.x * 10) / 10;
              point.y = Math.round(point.y * 10) / 10;
            }
            this.lastAngle = angle;
            return { point, type: 'axis', label: 'Ortho' };
          }
        }
      }

      // Grid
      if (this.gridSnap) {
        const point = { x: Math.round(raw.x * 10) / 10, y: Math.round(raw.y * 10) / 10 };
        return { point, type: 'grid', label: 'Grid' };
      }
      return { point: { x: raw.x, y: raw.y }, type: 'free', label: '' };
    }

    typedPoint(from) {
      const v = parseFloat(this.lengthBuffer);
      if (!isFinite(v) || v <= 0) return null;
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
      c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('pointerenter', () => (this.pointer.inside = true));
      c.addEventListener('pointerleave', () => {
        this.pointer.inside = false;
        if (!this.drag) {
          this.snap = null;
          this.hover = null;
          this.draw();
        }
      });
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') this.spaceDown = false;
      });
      window.addEventListener('blur', () => {
        this.spaceDown = false;
        this.endDrag();
      });
    }

    isTypingTarget(e) {
      const t = e.target;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }

    onKeyDown(e) {
      if (this.isTypingTarget(e)) return;
      if (this.app.ui.view3d) return;
      if (e.code === 'Space') {
        this.spaceDown = true;
        if (this.pointer.inside) this.updateCursor();
        return;
      }
      const tool = this.app.ui.tool;
      const drawing = tool === 'outline' || tool === 'wall';
      const from = this.drawingStart();
      if (drawing && from) {
        if (/^[0-9]$/.test(e.key) || (e.key === '.' && this.lengthBuffer.indexOf('.') < 0)) {
          this.lengthBuffer += e.key;
          this.snap = null;
          this.draw();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === 'Backspace' && this.lengthBuffer) {
          this.lengthBuffer = this.lengthBuffer.slice(0, -1);
          this.draw();
          e.preventDefault();
          return;
        }
        if (e.key === 'Enter' && this.lengthBuffer) {
          const p = this.typedPoint(from);
          if (p) {
            this.commitPoint(p, true);
            this.lengthBuffer = '';
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
        } else if (tool === 'wall' && this.wallChain) {
          this.endWallChain();
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        if (this.wallChain) {
          this.endWallChain();
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
      if (tool === 'wall' && this.wallChain) return this.wallChain;
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

      if (tool === 'wall') {
        const snap = this.snapPoint(w, this.wallChain, { chainFirst: this.chainFirst, ortho: this.app.ui.ortho });
        if (snap.type === 'close' && this.wallChain && this.chainFirst) {
          this.addWall(this.wallChain, this.chainFirst);
          this.endWallChain();
          return;
        }
        if (!this.wallChain) {
          this.wallChain = { x: snap.point.x, y: snap.point.y };
          this.chainFirst = { x: snap.point.x, y: snap.point.y };
          this.snap = snap;
          this.draw();
          return;
        }
        if (FC.dist(this.wallChain, snap.point) > 0.12) {
          this.addWall(this.wallChain, snap.point);
          this.wallChain = { x: snap.point.x, y: snap.point.y };
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
        const room = this.hitRoom(w);
        if (room) {
          this.app.select({ type: 'room', id: room.id });
          this.app.ui.openRoomSelection(room.id);
        } else {
          this.app.clearSelection();
        }
        return;
      }

      // Select tool
      const hit = this.hitTest(w);
      if (hit) {
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
        if (hit.type === 'opening') {
          this.app.select({ type: 'opening', id: hit.op.id });
          this.drag = { type: 'opening', id: hit.op.id, moved: false, pushed: false, hostKey: hit.op.hostKey };
          return;
        }
        if (hit.type === 'wall') {
          this.app.select({ type: 'wall', key: hit.seg.key });
          this.drag = { type: 'wall', key: hit.seg.key, seg: hit.seg, moved: false, pushed: false };
          return;
        }
      }
      this.app.clearSelection();
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

    addWall(a, b) {
      if (FC.dist(a, b) < 0.15) return;
      const plan = this.app.plan;
      const dup = plan.walls.some((w) => {
        const same = (FC.dist(w.a, a) < 0.02 && FC.dist(w.b, b) < 0.02) || (FC.dist(w.a, b) < 0.02 && FC.dist(w.b, a) < 0.02);
        return same;
      });
      if (dup) return;
      this.app.pushHistory();
      plan.walls.push({
        id: FC.uid('w'),
        a: { x: FC.round(a.x, 3), y: FC.round(a.y, 3) },
        b: { x: FC.round(b.x, 3), y: FC.round(b.y, 3) },
      });
      this.app.changed({ rooms: true, furniture: true, save: false });
      this.app.ui.updateHint();
    }

    endWallChain() {
      this.wallChain = null;
      this.chainFirst = null;
      this.lengthBuffer = '';
      this.snap = null;
      this.app.changed({ rooms: true, furniture: true, save: true });
      this.app.ui.updateHint();
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
        return;
      }

      const tool = this.app.ui.tool;
      if (tool === 'outline' || tool === 'wall') {
        const from = this.drawingStart();
        const snap = this.snapPoint(w, from, {
          outline: tool === 'outline' && this.app.ui.drawingFresh,
          chainFirst: tool === 'wall' ? this.chainFirst : null,
          ortho: this.app.ui.ortho,
        });
        this.snap = snap;
        if (this.lengthBuffer) {
          const typed = this.typedPoint(from || w);
          if (typed) this.snap = { point: typed, type: 'typed', label: 'Length' };
        }
        this.hover = null;
        this.updateCursor();
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
        const wasMoving = this.drag.type !== 'pan';
        if (this.drag.moved && this.drag.type !== 'pan') {
          this.app.changed({ rooms: true, furniture: true, save: true });
        }
        this.drag = null;
        if (wasMoving) this.updateCursor();
        this.draw();
      }
      this.app.saveSoon();
    }

    moveDrag(w) {
      const plan = this.app.plan;
      if (this.drag.type === 'vertex') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const p = plan.outline[this.drag.index];
        if (!p) return;
        let np = this.snapPoint(w, null, { ortho: false });
        if (np.type === 'point' || np.type === 'close') np = { point: np.point };
        p.x = FC.round(np.point.x, 3);
        p.y = FC.round(np.point.y, 3);
        this.app.changed({ rooms: true, furniture: false, save: false });
        return;
      }
      if (this.drag.type === 'wall-end') {
        if (!this.drag.pushed) {
          this.app.pushHistory();
          this.drag.pushed = true;
        }
        const wall = plan.walls.find((x) => x.id === this.drag.wallId);
        if (!wall) return;
        const snap = this.snapPoint(w, this.drag.end === 0 ? wall.b : wall.a, { ortho: false });
        const p = snap.point;
        const target = this.drag.end === 0 ? wall.a : wall.b;
        target.x = FC.round(p.x, 3);
        target.y = FC.round(p.y, 3);
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
          if (!this.drag.lastW) this.drag.lastW = { x: w.x, y: w.y };
          const dx = w.x - this.drag.lastW.x;
          const dy = w.y - this.drag.lastW.y;
          plan.outline[i0].x += dx;
          plan.outline[i0].y += dy;
          plan.outline[i1].x += dx;
          plan.outline[i1].y += dy;
          this.drag.lastW = { x: w.x, y: w.y };
        } else {
          const wall = plan.walls.find((x) => x.id === seg.id);
          if (!wall) return;
          if (!this.drag.orig) this.drag.orig = { a: { x: wall.a.x, y: wall.a.y }, b: { x: wall.b.x, y: wall.b.y } };
          if (!this.drag.startW) this.drag.startW = { x: w.x, y: w.y };
          const dx = w.x - this.drag.startW.x;
          const dy = w.y - this.drag.startW.y;
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
      const tool = this.app.ui.tool;
      let c = 'default';
      if (this.drag && this.drag.type === 'pan') c = 'grabbing';
      else if (this.spaceDown || tool === 'pan') c = 'grab';
      else if (tool === 'outline' || tool === 'wall' || tool === 'door' || tool === 'window' || tool === 'opening') c = 'crosshair';
      else if (tool === 'room') c = this.hover ? 'pointer' : 'default';
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

    hitTest(w) {
      const plan = this.app.plan;
      const tol = this.screenTol(12);
      let best = null;
      plan.outline.forEach((p, i) => {
        const d = FC.dist(w, p);
        if (d < tol && (!best || d < best.d)) best = { type: 'outline-vertex', index: i, d };
      });
      plan.walls.forEach((wall) => {
        const da = FC.dist(w, wall.a);
        const db = FC.dist(w, wall.b);
        if (da < tol && (!best || da < best.d)) best = { type: 'wall-end', wallId: wall.id, end: 0, key: 'w:' + wall.id, d: da };
        if (db < tol && (!best || db < best.d)) best = { type: 'wall-end', wallId: wall.id, end: 1, key: 'w:' + wall.id, d: db };
      });
      if (best) return best;

      const op = this.hitOpening(w);
      if (op) return { type: 'opening', op };

      const segs = FC.getSegments(plan);
      for (const seg of segs) {
        const hit = FC.pointSegment(w, seg.a, seg.b);
        if (hit.dist < seg.thickness / 2 + this.screenTol(7)) {
          if (!best || hit.dist < best.dist) best = { type: 'wall', seg, dist: hit.dist };
        }
      }
      return best;
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
      if (this.app.plan.furnished) this.drawFurniture();
      this.drawRoomLabels(rooms);
      this.drawWalls(segs);
      this.drawOpenings(segs);
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

    drawRoomLabels(rooms) {
      const ctx = this.ctx;
      rooms.forEach((room) => {
        const type = FC.roomTypes[room.type] || FC.roomTypes.living;
        const s = this.w2s(room.centroid);
        const rw = room.bounds.w * this.view.scale;
        if (rw < 52) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#54555d';
        ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(room.name || type.label, s.x, s.y - 7);
        ctx.fillStyle = '#8b8c94';
        ctx.font = '500 10.5px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(FC.fmt(room.area, 1) + ' m²', s.x, s.y + 9);
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
          [a, b].forEach((p) => this.handleDot(p, true));
        }
      } else if (this.hover && this.hover.type === 'wall' && this.hover.seg) {
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
          ctx.restore();
        }
      });
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
        ctx.strokeStyle = active ? ACCENT : '#55555c';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half, s.y - dir.y * half + gap);
        ctx.lineTo(s.x + dir.x * half * 0.05, s.y + dir.y * half * 0.05 + gap);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x - dir.x * half * 0.05, s.y - dir.y * half * 0.05 - gap);
        ctx.lineTo(s.x + dir.x * half, s.y + dir.y * half - gap);
        ctx.stroke();
        ctx.restore();
        return;
      }

      if (pl.op.style === 'double') {
        [-1, 1].forEach((k) => {
          const hinge = { x: s.x + dir.x * half * k, y: s.y + dir.y * half * k };
          const a0 = Math.atan2(dir.y * -k, dir.x * -k);
          ctx.beginPath();
          ctx.arc(hinge.x, hinge.y, w / 2, a0, a0 + Math.PI / 2, k < 0);
          ctx.stroke();
          const ox = hinge.x + n.x * (w / 2) * Math.sin(Math.PI / 2);
          const oy = hinge.y + n.y * (w / 2) * Math.sin(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(hinge.x, hinge.y);
          ctx.lineTo(ox, oy);
          ctx.stroke();
        });
        ctx.restore();
        return;
      }

      const right = pl.op.hinge === 'right';
      const hinge = right ? { x: s.x + dir.x * half, y: s.y + dir.y * half } : { x: s.x - dir.x * half, y: s.y - dir.y * half };
      const radius = w;
      const startAngle = right ? Math.atan2(-dir.y, -dir.x) : Math.atan2(dir.y, dir.x);
      ctx.beginPath();
      ctx.arc(hinge.x, hinge.y, radius, startAngle, startAngle + Math.PI / 2, false);
      ctx.stroke();

      const leafDir = right ? { x: n.x, y: n.y } : { x: n.x, y: n.y };
      const open = { x: hinge.x + leafDir.x * radius, y: hinge.y + leafDir.y * radius };
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
        const text = FC.fmt(len, 2) + ' m';
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
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(it.rot);
        this.roundRect(-w / 2, -d / 2, w, d, Math.min(4, w * 0.2));
        ctx.fillStyle = 'rgba(56,56,62,0.10)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(44,44,52,0.36)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (it.kind === 'bed') {
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
        } else if (it.kind === 'toilet') {
          ctx.beginPath();
          ctx.ellipse(0, d * 0.12, w * 0.32, d * 0.3, 0, 0, TAU);
          ctx.strokeStyle = 'rgba(44,44,52,0.34)';
          ctx.stroke();
        }
        ctx.restore();
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

      if (tool === 'wall' && this.wallChain) {
        const start = this.w2s(this.wallChain);
        if (this.snap) {
          const end = this.w2s(this.snap.point);
          ctx.save();
          ctx.strokeStyle = accent;
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
      const ctx = this.ctx;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const off = 18;
      const nx = -Math.sin(angle) * off;
      const ny = Math.cos(angle) * off;
      this.drawPill(mx + nx, my + ny, FC.fmt(len, 2) + ' m · ' + Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) + '°', 'accent');
    }

    drawHover(segs) {
      if (!this.hover) return;
      const ctx = this.ctx;
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
      ctx.strokeStyle = typed ? ACCENT : this.snap.type === 'close' ? '#e0952f' : ACCENT;
      ctx.fillStyle = typed ? ACCENT : this.snap.type === 'close' ? '#e0952f' : '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.snap.type === 'close' ? 8 : 5.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (this.snap.type === 'point' || this.snap.type === 'close' || this.snap.type === 'axis' || this.snap.type === 'wall') {
        const label = this.snap.label;
        if (label) this.drawPill(s.x, s.y - 20, label, this.snap.type === 'close' ? 'warning' : 'light');
      }
      ctx.restore();
    }

    drawLengthInput() {
      const from = this.drawingStart();
      if (!from) return;
      const ctx = this.ctx;
      const typed = this.typedPoint(from);
      const p = typed ? typed : this.pointer;
      const s = this.w2s({ x: p.x, y: p.y });
      ctx.save();
      this.drawPill(s.x + 26, s.y + 32, this.lengthBuffer + ' m  ⏎', 'accent');
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

/* Floorcraft — application controller, persistence and shortcuts */
(function () {
  const FC = (window.FC = window.FC || {});
  if (!FC) return;

  const STORAGE_KEY = 'floorcraft.projects.v1';
  const CURRENT_KEY = 'floorcraft.current.v1';
  const MAX_HISTORY = 70;
  const TOOL_STEP = {
    outline: 1,
    wall: 2,
    room: 3,
    door: 4,
    window: 4,
    opening: 4,
  };
  const STEP_TOOL = {
    1: 'outline',
    2: 'wall',
    3: 'room',
    4: 'door',
    5: 'select',
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeName(name, fallback) {
    const base = String(name || fallback || 'floorplan')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    return base || fallback || 'floorplan';
  }

  function isBlankPlan(plan) {
    return (
      !plan ||
      ((!plan.outline || plan.outline.length < 3) &&
        (!plan.walls || !plan.walls.length) &&
        (!plan.openings || !plan.openings.length))
    );
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadDataURL(data, filename) {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  class App {
    constructor() {
      this.projects = [];
      this.plan = null;
      this.rooms = [];
      this.furniture = [];
      this.saveStatus = 'saved';
      this._history = [];
      this._future = [];
      this._saveTimer = null;
      this._activeSetting = null;
      this._last2dStep = 1;
      this._viewerToken = 0;
      this._storageWarned = false;
      this._bound = false;

      /* The editor and the UI both need shared transient state. */
      this.ui = {
        step: 1,
        tool: 'outline',
        view3d: false,
        ortho: false,
        drawingFresh: false,
        selection: null,
        sidebarOpen: window.innerWidth > 700,
      };

      this._loadProjects();
      this._preparePlanState();

      const planCanvas = document.getElementById('plan');
      this.editor = new FC.Editor2D(planCanvas, this);

      const transient = this.ui;
      this.ui = new FC.UI(this);
      Object.assign(this.ui, transient);
      this.viewer = new FC.Viewer3D(document.getElementById('viewer3d'), this);

      this.ui.renderAll();
      this.ui.updateSaveChip();
      this._bindWindow();

      requestAnimationFrame(() => {
        this.editor.resize();
        if (this.plan.outline && this.plan.outline.length >= 3) this.editor.fit();
        this.ui.renderAll();
        document.body.classList.add('ready');
      });
    }

    /* ---------------------------------------------------------------- */
    /* Boot, persistence and plan state                                 */
    /* ---------------------------------------------------------------- */

    _loadProjects() {
      let stored = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) stored = parsed;
          else if (parsed && Array.isArray(parsed.projects)) stored = parsed.projects;
        }
      } catch (err) {
        stored = [];
      }

      this.projects = stored
        .filter((p) => p && typeof p === 'object')
        .map((p) => FC.normalizePlan(p));

      if (!this.projects.length) {
        const blank = FC.createPlan('My first floor plan');
        this.projects.push(blank);
      }

      let currentId = null;
      try {
        currentId = localStorage.getItem(CURRENT_KEY);
      } catch (err) {
        currentId = null;
      }

      this.plan =
        this.projects.find((p) => p.id === currentId) ||
        this.projects[0];
      this.plan = FC.normalizePlan(this.plan);
      this._syncPlan();
    }

    _preparePlanState() {
      this.plan.rooms = Array.isArray(this.plan.rooms) ? this.plan.rooms : [];
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      this.furniture = this.plan.furnished ? FC.furnishPlan(this.plan, this.rooms) : [];
      const p = this.plan;
      const hasOutline = (p.outline || []).length >= 3;
      this.ui.step = p.furnished && this.rooms.length
        ? 5
        : (p.openings || []).length
          ? 4
          : (p.walls || []).length || this.rooms.length > 1
            ? 3
            : hasOutline
              ? 2
              : 1;
      this.ui.tool = hasOutline ? 'select' : 'outline';
    }

    _roomMeta() {
      return (this.rooms || []).map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        area: r.area,
        centroid: { x: r.centroid.x, y: r.centroid.y },
        bounds: {
          x0: r.bounds.x0,
          y0: r.bounds.y0,
          x1: r.bounds.x1,
          y1: r.bounds.y1,
          w: r.bounds.w,
          d: r.bounds.d,
          cx: r.bounds.cx,
          cy: r.bounds.cy,
        },
      }));
    }

    _syncPlan() {
      if (!this.plan) return;
      const index = this.projects.findIndex((p) => p.id === this.plan.id);
      if (index >= 0) this.projects[index] = this.plan;
      else this.projects.push(this.plan);
    }

    _persist() {
      this._syncPlan();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
        localStorage.setItem(CURRENT_KEY, this.plan.id);
      } catch (err) {
        this.saveStatus = 'dirty';
        if (this.ui && this.ui.updateSaveChip) this.ui.updateSaveChip();
        if (!this._storageWarned) {
          this._storageWarned = true;
          this.toast('Local storage is unavailable — export the plan to keep it.', 'error');
        }
        return false;
      }
      return true;
    }

    saveSoon() {
      if (!this.plan) return;
      this.saveStatus = 'saving';
      if (this.ui && this.ui.updateSaveChip) this.ui.updateSaveChip();
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.saveNow(), 450);
    }

    saveNow() {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
      if (!this.plan) return;
      this.plan.updatedAt = Date.now();
      const ok = this._persist();
      this.saveStatus = ok ? 'saved' : 'dirty';
      if (this.ui && this.ui.updateSaveChip) this.ui.updateSaveChip();
    }

    /* ---------------------------------------------------------------- */
    /* Geometry / rendering state                                       */
    /* ---------------------------------------------------------------- */

    recomputeRooms() {
      if (!this.plan) return;
      FC.ensureOpeningHosts(this.plan);
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
    }

    recomputeFurniture() {
      this.furniture = this.plan.furnished
        ? FC.furnishPlan(this.plan, this.rooms || [])
        : [];
    }

    stats() {
      const plan = this.plan || FC.createPlan();
      return {
        area: FC.planArea(plan),
        rooms: this.rooms ? this.rooms.length : 0,
        doors: (plan.openings || []).filter((o) => o.kind === 'door').length,
        windows: (plan.openings || []).filter((o) => o.kind === 'window').length,
        furnished: !!(plan.furnished && this.furniture && this.furniture.length),
      };
    }

    changed(opts) {
      opts = opts || {};
      if (!this.plan) return;
      if (opts.rooms) this.recomputeRooms();
      if (opts.furniture) this.recomputeFurniture();

      if (this.editor) this.editor.draw();
      if (this.viewer) this.viewer.markDirty();

      if (opts.save !== false) {
        this.saveSoon();
        if (this.ui) {
          this.ui.renderSidebar();
          this.ui.renderStepper();
          this.ui.renderToolrail();
          this.ui.updateHeader();
          this.ui.updateHint();
          this.ui.updateUndoRedo();
          this.ui.syncWelcome();
        }
      } else if (this.ui) {
        this.ui.updateStats();
        this.ui.updateHint();
      }
    }

    pushHistory() {
      if (!this.plan) return;
      const snapshot = JSON.stringify(this.plan);
      if (this._history[this._history.length - 1] === snapshot) return;
      this._history.push(snapshot);
      if (this._history.length > MAX_HISTORY) this._history.shift();
      this._future.length = 0;
      if (this.ui && this.ui.updateUndoRedo) this.ui.updateUndoRedo();
    }

    canUndo() {
      return this._history.length > 0;
    }

    canRedo() {
      return this._future.length > 0;
    }

    undo() {
      if (!this._history.length) return;
      const current = JSON.stringify(this.plan);
      const snapshot = this._history.pop();
      this._future.push(current);
      this._restore(snapshot);
      this.toast('Undone', 'info');
    }

    redo() {
      if (!this._future.length) return;
      const current = JSON.stringify(this.plan);
      const snapshot = this._future.pop();
      this._history.push(current);
      this._restore(snapshot);
      this.toast('Redone', 'info');
    }

    _restore(snapshot) {
      let restored;
      try {
        restored = FC.normalizePlan(JSON.parse(snapshot));
      } catch (err) {
        return;
      }
      this.plan = restored;
      this._syncPlan();
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      this.recomputeFurniture();
      if (this.editor) {
        this.editor.wallChain = null;
        this.editor.chainFirst = null;
        this.editor.lengthBuffer = '';
        this.editor.snap = null;
        this.editor.drag = null;
      }
      if (this.ui) {
        this.ui.drawingFresh = false;
        this.ui.selection = null;
        this.ui.renderAll();
      }
      if (this.viewer) this.viewer.markDirty();
      this.saveSoon();
    }

    /* ---------------------------------------------------------------- */
    /* Tool and step flow                                                */
    /* ---------------------------------------------------------------- */

    setTool(tool, opts) {
      opts = opts || {};
      if (!tool) return;
      if (this.ui.view3d) this.exit3D({ silent: true, noFit: true });

      if (this.editor && this.editor.wallChain && tool !== 'wall') {
        this.editor.endWallChain();
      }
      if (this.editor) {
        this.editor.lengthBuffer = '';
        this.editor.hover = null;
        this.editor.snap = null;
      }

      this.ui.tool = tool;
      if (!opts.keepStep && TOOL_STEP[tool]) this.ui.step = TOOL_STEP[tool];

      if (this.ui) {
        this.ui.renderStepper();
        this.ui.renderToolrail();
        this.ui.renderSidebar();
        this.ui.updateHint();
      }
      if (this.editor) {
        this.editor.updateCursor();
        this.editor.draw();
      }
    }

    setStep(step, opts) {
      opts = opts || {};
      step = Math.max(1, Math.min(7, parseInt(step, 10) || 1));
      if (step >= 6) {
        this.enter3D(step);
        return;
      }
      if (this.ui.view3d) this.exit3D({ silent: true, noFit: true });
      this.ui.step = step;
      if (!opts.silent) {
        const tool = opts.keepTool ? this.ui.tool : STEP_TOOL[step] || 'select';
        this.setTool(tool, { keepStep: true });
      } else if (this.ui) {
        this.ui.renderStepper();
        this.ui.renderToolrail();
        this.ui.renderSidebar();
        this.ui.updateHint();
      }
    }

    goToStep(step) {
      step = Math.max(1, Math.min(7, parseInt(step, 10) || 1));
      if (step >= 6) {
        this.enter3D(step);
        return;
      }
      if (this.ui.view3d) this.exit3D({ silent: true, noFit: true });
      this.setStep(step);
      if (this.editor && step === 1 && this.plan.outline.length < 3) {
        this.editor.fit();
      }
    }

    /* ---------------------------------------------------------------- */
    /* Selection and editing                                            */
    /* ---------------------------------------------------------------- */

    select(selection) {
      this.ui.selection = selection || null;
      if (this.editor) this.editor.draw();
      if (this.ui) {
        this.ui.renderToolrail();
        this.ui.renderSidebar();
        this.ui.updateHint();
      }
    }

    clearSelection() {
      this.ui.selection = null;
      if (this.editor) this.editor.draw();
      if (this.ui) {
        this.ui.renderToolrail();
        this.ui.renderSidebar();
        this.ui.updateHint();
      }
    }

    focusRoom(id) {
      const room = (this.rooms || []).find((r) => r.id === id);
      if (!room) return;
      this.ui.step = 3;
      this.ui.selection = { type: 'room', id };
      if (this.ui.view3d) {
        if (this.viewer && this.viewer.goal) {
          this.viewer.goal.tx = room.centroid.x;
          this.viewer.goal.tz = room.centroid.y;
          this.viewer.goal.ty = 1;
          this.viewer.goal.dist = Math.max(6, Math.max(room.bounds.w, room.bounds.d) * 2.1 + 3);
        }
      } else if (this.editor) {
        const b = room.bounds;
        const sidebar = this.ui.sidebarOpen !== false ? 340 : 0;
        const availW = Math.max(180, this.editor.W - sidebar - 130);
        const availH = Math.max(160, this.editor.H - 170);
        this.editor.view.scale = FC.clamp(
          Math.min(availW / Math.max(2, b.w), availH / Math.max(2, b.d)),
          32,
          170
        );
        this.editor.centerOn(room.centroid.x, room.centroid.y);
        this.editor.updateZoomLabel();
      }
      if (this.ui) {
        this.ui.renderStepper();
        this.ui.renderSidebar();
        this.ui.updateHint();
      }
      if (this.editor) this.editor.draw();
    }

    setRoomType(roomId, type) {
      if (!FC.roomTypes[type]) return;
      const room = (this.rooms || []).find((r) => r.id === roomId);
      if (!room || room.type === type) return;
      this.pushHistory();
      const oldType = FC.roomTypes[room.type];
      const oldLabel = oldType ? oldType.label : '';
      room.type = type;
      if (!room.name || room.name === oldLabel) room.name = FC.roomTypes[type].label;
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.recomputeFurniture();
      this.changed({ save: true });
      if (this.ui) this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
    }

    deleteSelection() {
      const sel = this.ui.selection;
      if (!sel) return;
      if (sel.type === 'furniture') {
        this.deleteSelectedFurniture();
        return;
      }
      if (sel.type === 'light') {
        this.deleteSelectedLight();
        return;
      }
      if (sel.type === 'room') {
        this.toast('Rooms are detected automatically — change its type instead.', 'info');
        return;
      }
      if (sel.type === 'vertex') {
        this.toast('Drag an outline corner to reshape the plan.', 'info');
        return;
      }

      if (sel.type === 'wall') {
        const seg = FC.segmentByKey(this.plan, sel.key);
        if (!seg) return;
        if (seg.boundary) {
          this.toast('The exterior outline cannot be deleted — redraw it instead.', 'info');
          return;
        }
        this.pushHistory();
        this.plan.walls = this.plan.walls.filter((w) => w.id !== seg.id);
        this.plan.openings = this.plan.openings.filter((op) => op.hostKey !== sel.key);
      } else if (sel.type === 'opening') {
        if (!this.plan.openings.some((op) => op.id === sel.id)) return;
        this.pushHistory();
        this.plan.openings = this.plan.openings.filter((op) => op.id !== sel.id);
      } else {
        return;
      }

      this.ui.selection = null;
      this.changed({ rooms: true, furniture: true, save: true });
      this.toast('Deleted', 'success');
    }

    setDoorStyle(style) {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'opening') return;
      const op = this.plan.openings.find((o) => o.id === sel.id);
      if (!op || op.kind !== 'door') return;
      if (!['single', 'double', 'sliding'].includes(style)) return;
      this.pushHistory();
      op.style = style;
      this.changed({ furniture: false, save: true });
    }

    updateSelectedOpening(field, value) {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'opening') return;
      const op = this.plan.openings.find((o) => o.id === sel.id);
      if (!op) return;
      const seg = FC.segmentByKey(this.plan, op.hostKey);
      if (!seg) return;
      const wallHeight = this.plan.settings.wallHeight;
      value = parseFloat(value);
      if (!isFinite(value)) return;

      if (field === 'width') {
        let desired = FC.clamp(value, 0.3, Math.min(4, seg.len - 0.12));
        op.width = desired;
        if (!FC.canPlaceOpening(this.plan, op.hostKey, op.offset, op.width, op.id)) {
          let fit = desired;
          while (fit > 0.3 && !FC.canPlaceOpening(this.plan, op.hostKey, op.offset, fit, op.id)) {
            fit = Math.round((fit - 0.05) * 100) / 100;
          }
          op.width = Math.max(0.3, fit);
        }
        op.offset = FC.clamp(op.offset, op.width / 2 + 0.03, seg.len - op.width / 2 - 0.03);
      } else if (field === 'height') {
        const maxHeight = op.kind === 'window' ? wallHeight - op.sill - 0.05 : wallHeight - 0.05;
        op.height = FC.clamp(value, 0.3, Math.max(0.4, maxHeight));
      } else if (field === 'sill') {
        op.sill = FC.clamp(value, 0, Math.max(0, wallHeight - op.height - 0.05));
      }

      if (this.editor) this.editor.draw();
      if (this.viewer) this.viewer.markDirty();
      this.saveSoon();
    }

    updateSetting(key, value) {
      if (!this.plan || !key) return;
      value = parseFloat(value);
      if (!isFinite(value)) return;
      const ranges = {
        wallHeight: [2.2, 4.2],
        extThickness: [0.08, 0.5],
        intThickness: [0.08, 0.4],
        slabThickness: [0.08, 0.5],
        doorHeight: [1.8, 3],
        doorWidth: [0.6, 2.4],
        windowSill: [0, 2.2],
        windowHeight: [0.3, 2.6],
        windowWidth: [0.6, 4],
      };
      const range = ranges[key];
      if (range) value = FC.clamp(value, range[0], range[1]);
      if (key === 'doorHeight') value = Math.min(value, this.plan.settings.wallHeight - 0.05);
      if (key === 'windowHeight') {
        value = Math.min(value, this.plan.settings.wallHeight - this.plan.settings.windowSill - 0.05);
      }
      this.plan.settings[key] = value;
      if (key === 'wallHeight') {
        this.plan.openings.forEach((op) => {
          if (op.kind === 'window') {
            op.sill = Math.min(op.sill, Math.max(0, value - op.height - 0.05));
          }
          op.height = Math.min(op.height, value - 0.05);
        });
        this.plan.settings.doorHeight = Math.min(this.plan.settings.doorHeight, value - 0.05);
      }
      this.changed({ save: false });
      this.saveSoon();
    }

    /* ---------------------------------------------------------------- */
    /* Drawing helpers                                                  */
    /* ---------------------------------------------------------------- */

    startDrawing() {
      if (this.plan.outline && this.plan.outline.length >= 3) {
        this.redrawOutline();
        return;
      }
      this.ui.hideWelcome();
      this.pushHistory();
      this.plan.outline = [];
      this.plan.walls = [];
      this.plan.openings = [];
      this.plan.rooms = [];
      this.plan.furnished = false;
      this.furniture = [];
      this.rooms = [];
      this.ui.drawingFresh = true;
      this.ui.step = 1;
      this.ui.tool = 'outline';
      this.ui.selection = null;
      this.changed({ save: false });
      if (this.ui) {
        this.ui.renderAll();
        this.ui.updateHint();
      }
      if (this.editor) {
        this.editor.fit();
        this.editor.updateCursor();
      }
    }

    async redrawOutline() {
      const hasContent =
        (this.plan.outline && this.plan.outline.length >= 3) ||
        (this.plan.walls && this.plan.walls.length) ||
        (this.plan.openings && this.plan.openings.length);
      if (hasContent) {
        const ok = await this.ui.confirm(
          'Redraw the outline?',
          'This clears the footprint, interior walls, openings and furniture. You can undo it afterwards.',
          { okLabel: 'Redraw outline' }
        );
        if (!ok) return;
      }
      this.pushHistory();
      this.plan.outline = [];
      this.plan.walls = [];
      this.plan.openings = [];
      this.plan.rooms = [];
      this.plan.furnished = false;
      this.rooms = [];
      this.furniture = [];
      this.ui.drawingFresh = true;
      this.ui.selection = null;
      this.ui.step = 1;
      this.ui.tool = 'outline';
      this.changed({ save: false });
      this.ui.hideWelcome();
      this.ui.renderAll();
      if (this.editor) {
        this.editor.fit();
        this.editor.updateCursor();
      }
      this.toast('Click to place the first corner of your new outline.', 'info');
    }

    loadSample() {
      const sample = FC.normalizePlan(FC.samplePlan());
      const blankCurrent = isBlankPlan(this.plan) && !this.plan.furnished;
      if (blankCurrent && this.projects.length <= 1) {
        this.projects = [sample];
      } else if (blankCurrent) {
        const index = this.projects.findIndex((p) => p.id === this.plan.id);
        if (index >= 0) this.projects[index] = sample;
        else this.projects.push(sample);
      } else {
        this.projects.push(sample);
      }
      this.plan = sample;
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      this.furniture = FC.furnishPlan(this.plan, this.rooms);
      this._history = [];
      this._future = [];
      this.ui.view3d = false;
      if (this.viewer) this.viewer.deactivate();
      this.ui.step = 5;
      this.ui.tool = 'select';
      this.ui.selection = null;
      this.ui.drawingFresh = false;
      this.ui.hideWelcome();
      this._syncPlan();
      if (this.ui) {
        this.ui.setViewMode(false);
        this.ui.renderAll();
      }
      if (this.editor) {
        this.editor.wallChain = null;
        this.editor.chainFirst = null;
        this.editor.lengthBuffer = '';
        this.editor.resize();
        this.editor.fit();
      }
      this.saveNow();
      this.toast('Sample apartment loaded — 5 rooms, furnished and ready for 3D.', 'success');
    }

    /* ---------------------------------------------------------------- */
    /* Style, furniture and settings                                   */
    /* ---------------------------------------------------------------- */

    setStyle(key) {
      if (!FC.styles[key] || this.plan.style === key) return;
      this.pushHistory();
      this.plan.style = key;
      if (this.plan.furnished) this.recomputeFurniture();
      this.changed({ furniture: false, save: true });
      if (this.ui) this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
    }

    setDensity(value) {
      value = FC.clamp(parseFloat(value) || 1, 0.4, 1.6);
      this.plan.density = value;
      if (this.plan.furnished) this.recomputeFurniture();
      this.changed({ furniture: false, save: false });
      this.saveSoon();
      if (this.viewer) this.viewer.markDirty();
    }

    generateInterior() {
      if (!this.plan.outline || this.plan.outline.length < 3) {
        this.toast('Draw an outline first — then the interior can be generated.', 'info');
        return;
      }
      if (!this.rooms.length) {
        this.toast('Add an interior wall to create enclosed rooms first.', 'info');
        return;
      }
      this.pushHistory();
      this.plan.furnished = true;
      this.plan.layoutVariation = (this.plan.layoutVariation || 0) + 1;
      this.recomputeFurniture();
      this.ui.step = 5;
      this.changed({ furniture: false, save: true });
      if (this.ui) this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
      const count = FC.furnitureCount(this.furniture);
      this.toast(`Interior variation #${this.plan.layoutVariation} generated! (${count} pieces across ${this.rooms.length} rooms)`, 'success');
    }

    /* ---------------------------------------------------------------- */
    /* Interactive edits: walls, doors, furniture, lights               */
    /* ---------------------------------------------------------------- */

    resizeWall(wallId, newLen, fromEnd = 0) {
      this.pushHistory();
      const ok = FC.resizeWall(this.plan, wallId, newLen, fromEnd);
      if (ok) {
        this.changed({ rooms: true, furniture: true, save: true });
        this.toast('Wall resized to ' + FC.fmt(newLen, 2) + ' m', 'success');
      }
    }

    splitWallAt(wallId, pt) {
      this.pushHistory();
      const newW = FC.splitWall(this.plan, wallId, pt);
      if (newW) {
        this.changed({ rooms: true, furniture: true, save: true });
        this.toast('Wall split', 'success');
      }
    }

    flipDoor() {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'opening') return;
      const op = this.plan.openings.find((o) => o.id === sel.id);
      if (!op) return;
      this.pushHistory();
      if (op.kind === 'door') {
        const styles = ['single', 'double', 'sliding'];
        const nextIdx = (styles.indexOf(op.style || 'single') + 1) % styles.length;
        op.style = styles[nextIdx];
      }
      this.changed({ furniture: false, save: true });
      this.toast('Door updated (' + op.style + ')', 'info');
    }

    placeDoorAt(hostKey, offset) {
      const def = FC.defaultOpening(this.plan, 'door', hostKey, offset);
      this.pushHistory();
      this.plan.openings.push(def);
      this.select({ type: 'opening', id: def.id });
      this.changed({ rooms: false, furniture: true, save: true });
      this.toast('Door placed', 'success');
    }

    placeWindowAt(hostKey, offset) {
      const def = FC.defaultOpening(this.plan, 'window', hostKey, offset);
      this.pushHistory();
      this.plan.openings.push(def);
      this.select({ type: 'opening', id: def.id });
      this.changed({ rooms: false, furniture: true, save: true });
      this.toast('Window placed', 'success');
    }

    placeOpeningAt(hostKey, offset) {
      const def = FC.defaultOpening(this.plan, 'opening', hostKey, offset);
      this.pushHistory();
      this.plan.openings.push(def);
      this.select({ type: 'opening', id: def.id });
      this.changed({ rooms: false, furniture: true, save: true });
      this.toast('Passage placed', 'success');
    }

    rotateSelectedFurniture(delta) {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'furniture' || !this.furniture) return;
      const f = this.furniture.find((item) => item.id === sel.id);
      if (!f) return;
      this.pushHistory();
      f.rot = FC.round((f.rot || 0) + (delta || Math.PI / 2), 3);
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.viewer) this.viewer.markDirty();
      this.toast('Rotated ' + f.kind, 'info');
    }

    deleteSelectedFurniture() {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'furniture' || !this.furniture) return;
      this.pushHistory();
      this.furniture = this.furniture.filter((item) => item.id !== sel.id);
      this.clearSelection();
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.viewer) this.viewer.markDirty();
      this.toast('Furniture removed', 'info');
    }

    addFurnitureItem(kind) {
      if (!this.rooms.length) {
        this.toast('Create enclosed rooms first', 'info');
        return;
      }
      this.pushHistory();
      const r = this.rooms[0];
      const b = r.bounds || FC.polygonBounds(r.polygon);
      const item = {
        id: FC.uid('f'),
        roomId: r.id,
        kind,
        x: FC.round(b.cx, 3),
        y: FC.round(b.cy, 3),
        w: kind === 'bed' ? 1.6 : kind === 'sofa' ? 2.1 : 1.0,
        d: kind === 'bed' ? 2.0 : kind === 'sofa' ? 0.9 : 0.8,
        rot: 0,
        h: 0.75,
        elev: 0,
        mat: 'wood',
        variant: '',
        decor: false,
      };
      if (!this.furniture) this.furniture = [];
      this.furniture.push(item);
      this.plan.furnished = true;
      this.select({ type: 'furniture', id: item.id });
      this.changed({ rooms: false, furniture: false, save: true });
      this.toast('Placed ' + kind, 'success');
    }

    addLightAt(x, y, type = 'ceiling') {
      this.pushHistory();
      if (!this.plan.lights) this.plan.lights = [];
      const newLight = {
        id: FC.uid('lit'),
        type,
        x: FC.round(x, 3),
        y: FC.round(y, 3),
        z: type === 'lamp' ? 1.6 : 2.5,
        color: '#fff1de',
        intensity: 1.0,
        range: 6.0,
      };
      this.plan.lights.push(newLight);
      this.select({ type: 'light', id: newLight.id });
      this.changed({ rooms: false, furniture: false, save: true });
      this.toast('Light placed', 'success');
    }

    updateLight(id, key, val) {
      const l = (this.plan.lights || []).find((x) => x.id === id);
      if (!l) return;
      l[key] = val;
      this.changed({ rooms: false, furniture: false, save: false });
      this.saveSoon();
      if (this.viewer && this.viewer.active) this.viewer.markDirty();
    }

    deleteSelectedLight() {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'light') return;
      this.pushHistory();
      this.plan.lights = (this.plan.lights || []).filter((l) => l.id !== sel.id);
      this.clearSelection();
      this.changed({ rooms: false, furniture: false, save: true });
      this.toast('Light removed', 'info');
    }

    clearFurniture() {
      if (!this.plan.furnished) return;
      this.pushHistory();
      this.plan.furnished = false;
      this.furniture = [];
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.ui) this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
      this.toast('Furniture cleared — generate it again any time.', 'info');
    }

    toggleFurniture() {
      this.pushHistory();
      this.plan.furnished = !this.plan.furnished;
      if (this.plan.furnished) this.recomputeFurniture();
      else this.furniture = [];
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.ui) this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
    }

    toggleView(key) {
      if (!this.plan.view) this.plan.view = { sunTime: 14.5, ceiling: false, xray: false, autoRotate: false };
      this.plan.view[key] = !this.plan.view[key];
      if (this.viewer) {
        if (key === 'xray') this.viewer.applyXray(this.plan.view.xray);
        else this.viewer.markDirty();
      }
      this.saveSoon();
      if (this.ui) this.ui.renderSidebar();
    }

    toggleDimensions() {
      this.plan.settings.showDims = !this.plan.settings.showDims;
      if (this.editor) this.editor.draw();
      if (this.ui) {
        this.ui.renderSidebar();
        this.ui.renderToolrail();
      }
      this.saveSoon();
    }

    toggleGridSnap() {
      if (this.plan.settings.snapGrid === undefined) this.plan.settings.snapGrid = true;
      this.plan.settings.snapGrid = !this.plan.settings.snapGrid;
      if (this.editor) {
        this.editor.gridSnap = this.plan.settings.snapGrid;
        this.editor.draw();
      }
      this.toast(this.plan.settings.snapGrid ? 'Grid snapping enabled' : 'Grid snapping disabled (free positioning)', 'info');
      if (this.ui) this.ui.renderToolrail();
      this.saveSoon();
    }

    toggleOrthoSnap() {
      if (this.plan.settings.snapAngle === undefined) this.plan.settings.snapAngle = true;
      this.plan.settings.snapAngle = !this.plan.settings.snapAngle;
      if (this.editor) {
        this.editor.orthoSnap = this.plan.settings.snapAngle;
        this.editor.draw();
      }
      this.toast(this.plan.settings.snapAngle ? 'Rotational snap enabled (straight walls)' : 'Rotational snapping disabled', 'info');
      if (this.ui) this.ui.renderToolrail();
      this.saveSoon();
    }

    toggleInvertPitch() {
      if (this.plan.settings.invertPitch === undefined) this.plan.settings.invertPitch = true;
      this.plan.settings.invertPitch = !this.plan.settings.invertPitch;
      this.toast(this.plan.settings.invertPitch ? '3D vertical look inverted' : '3D vertical look standard', 'info');
      if (this.ui) this.ui.renderSidebar();
      this.saveSoon();
    }

    setSunTime(value) {
      const time = FC.clamp(parseFloat(value) || 14.5, 0, 24);
      this.plan.view.sunTime = time;
      if (this.viewer && this.viewer.active) this.viewer.updateLighting();
      this.saveSoon();
    }

    fit() {
      if (this.ui.view3d) {
        if (this.viewer) this.viewer.fit(true);
      } else if (this.editor) {
        this.editor.fit();
      }
    }

    /* ---------------------------------------------------------------- */
    /* 3D mode                                                          */
    /* ---------------------------------------------------------------- */

    enter3D(step) {
      step = step === 6 ? 6 : 7;
      if (this.ui.view3d) {
        this.ui.step = step;
        if (this.ui) this.ui.renderAll();
        if (this.viewer) this.viewer.markDirty();
        return;
      }
      this._last2dStep = this.ui.step && this.ui.step <= 5 ? this.ui.step : 5;
      this._viewerToken++;
      this.ui.view3d = true;
      this.ui.step = step;
      this.ui.selection = null;
      this.ui.hideWelcome();
      this.ui.setViewMode(true);
      this.ui.renderAll();

      try {
        if (this.viewer) {
          this.viewer.activate();
          this.viewer.startTransition('in');
        }
      } catch (err) {
        console.error(err);
        this.toast('3D rendering is unavailable in this browser.', 'error');
      }
    }

    exit3D(opts) {
      opts = opts || {};
      this._viewerToken++;
      if (this.viewer && this.ui.view3d) {
        this.viewer.startTransition('out', () => {
          this.ui.view3d = false;
          this.ui.step = this._last2dStep || 5;
          this.ui.selection = null;
          this.ui.setViewMode(false);
          if (this.ui) this.ui.renderAll();
          if (!opts.silent) this.toast('Back to the plan', 'info');
          requestAnimationFrame(() => {
            if (!this.editor) return;
            this.editor.resize();
            if (!opts.noFit) this.editor.fit();
            this.ui.updateHint();
          });
        });
      } else {
        this.ui.view3d = false;
        this.ui.step = this._last2dStep || 5;
        this.ui.selection = null;
        this.ui.setViewMode(false);
        if (this.ui) this.ui.renderAll();
      }
    }

    /* ---------------------------------------------------------------- */
    /* Projects and files                                               */
    /* ---------------------------------------------------------------- */

    _activatePlan(rawPlan) {
      const was3d = !!this.ui.view3d;
      if (was3d) {
        this._viewerToken++;
        if (this.viewer) this.viewer.deactivate();
      }
      this.plan = FC.normalizePlan(clone(rawPlan));
      this._syncPlan();
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      this.furniture = this.plan.furnished ? FC.furnishPlan(this.plan, this.rooms) : [];
      this._history = [];
      this._future = [];
      this.ui.view3d = false;
      this.ui.step = this.plan.outline.length >= 3 ? 5 : 1;
      this.ui.tool = 'select';
      this.ui.selection = null;
      this.ui.drawingFresh = false;
      this.ui.ortho = false;
      if (this.editor) {
        this.editor.wallChain = null;
        this.editor.chainFirst = null;
        this.editor.lengthBuffer = '';
        this.editor.snap = null;
        this.editor.drag = null;
      }
      if (this.ui) {
        this.ui.setViewMode(false);
        this.ui.renderAll();
        this.ui.updateUndoRedo();
        this.ui.resetWelcome();
        if (this.plan.outline.length >= 3) this.ui.hideWelcome();
      }
      requestAnimationFrame(() => {
        if (!this.editor) return;
        this.editor.resize();
        this.editor.fit();
        this.editor.draw();
      });
      this.saveNow();
    }

    async newProject() {
      let name = 'Untitled plan';
      if (this.ui && this.ui.prompt) {
        const answer = await this.ui.prompt('Name your new plan', name, 'Plan name');
        if (answer === null) return;
        name = answer || name;
      }
      const plan = FC.createPlan(name);
      this.projects.push(plan);
      this._activatePlan(plan);
      this.toast('New plan created', 'success');
    }

    openProject(id) {
      const raw = this.projects.find((p) => p.id === id);
      if (!raw) return;
      if (this.plan && raw.id === this.plan.id) return;
      this.saveNow();
      this._activatePlan(raw);
      this.toast('Opened ' + raw.name, 'info');
    }

    renameProject(name) {
      if (!name) return;
      this.pushHistory();
      this.plan.name = String(name).slice(0, 60);
      this._syncPlan();
      if (this.ui) this.ui.updateHeader();
      this.saveNow();
      this.toast('Plan renamed', 'success');
    }

    duplicateProject() {
      this.saveNow();
      const copy = FC.normalizePlan(clone(this.plan));
      copy.id = FC.uid('plan');
      copy.name = (this.plan.name || 'Untitled plan') + ' copy';
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      this.projects.push(copy);
      this._activatePlan(copy);
      this.toast('Plan duplicated', 'success');
    }

    deleteProject() {
      if (this.projects.length <= 1) {
        this.toast('Keep at least one plan in your workspace.', 'info');
        return;
      }
      const index = this.projects.findIndex((p) => p.id === this.plan.id);
      if (index < 0) return;
      const deletedName = this.plan.name;
      this.projects.splice(index, 1);
      const next = this.projects[Math.min(index, this.projects.length - 1)];
      this._activatePlan(next);
      this.toast('Deleted "' + deletedName + '"', 'info');
    }

    exportJSON() {
      const data = JSON.stringify(this.plan, null, 2);
      downloadBlob(new Blob([data], { type: 'application/json' }), safeName(this.plan.name) + '.floorcraft.json');
      this.toast('Plan exported as JSON', 'success');
    }

    async exportGLB() {
      if (!this.viewer) return;
      try {
        this.toast('Generating 3D GLB model...', 'info');
        const blob = await this.viewer.exportGLB();
        downloadBlob(blob, safeName(this.plan.name) + '.glb');
        this.toast('3D model exported as GLB (.glb)', 'success');
      } catch (err) {
        console.error(err);
        this.toast('Could not export GLB: ' + err.message, 'error');
      }
    }

    exportDWG() {
      try {
        const dxf = FC.CAD.exportDXF(this.plan);
        const blob = new Blob([dxf], { type: 'application/dxf' });
        downloadBlob(blob, safeName(this.plan.name) + '.dwg');
        this.toast('CAD drawing exported (.dwg / .dxf)', 'success');
      } catch (err) {
        console.error(err);
        this.toast('Could not export CAD: ' + err.message, 'error');
      }
    }

    importDWG() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.dwg,.dxf,.json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = async () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        const name = file.name.toLowerCase();
        try {
          if (name.endsWith('.json')) {
            const text = await file.text();
            this._importRaw(JSON.parse(text));
            return;
          }
          const text = await file.text();
          const importedPlan = FC.CAD.importDXF(text, { filename: file.name.replace(/\.[^/.]+$/, '') });
          this._activatePlan(importedPlan);
          this.toast('CAD floorplan imported successfully!', 'success');
        } catch (err) {
          console.error(err);
          this.toast('Could not import CAD file: ' + err.message, 'error');
        }
      };
      input.click();
    }

    importJSON() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener(
        'change',
        () => {
          const file = input.files && input.files[0];
          input.remove();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(String(reader.result));
              const candidate = parsed.plan || parsed;
              if (!candidate || typeof candidate !== 'object') throw new Error('Invalid plan');
              const hasGeometry =
                (Array.isArray(candidate.outline) && candidate.outline.length) ||
                (Array.isArray(candidate.walls) && candidate.walls.length);
              if (!hasGeometry) throw new Error('No floor plan geometry found');
              const plan = FC.normalizePlan(candidate);
              plan.id = FC.uid('plan');
              plan.name = plan.name || file.name.replace(/\.(floorcraft\.)?json$/i, '') || 'Imported plan';
              plan.createdAt = Date.now();
              plan.updatedAt = Date.now();
              this.projects.push(plan);
              this._activatePlan(plan);
              this.toast('Imported "' + plan.name + '"', 'success');
            } catch (err) {
              this.toast('Could not import that file — expected a Floorcraft JSON plan.', 'error');
            }
          };
          reader.onerror = () => this.toast('Could not read that file.', 'error');
          reader.readAsText(file);
        },
        { once: true }
      );
      input.click();
    }

    exportPNG() {
      if (!this.editor) return;
      const editor = this.editor;
      const view = { scale: editor.view.scale, cx: editor.view.cx, cy: editor.view.cy };
      const hover = editor.hover;
      const hoverOpeningWall = editor.hoverOpeningWall;
      let data;
      try {
        // Frame the whole plan, then crop the canvas to the drawing so the
        // exported image is centred instead of inheriting the sidebar offset.
        editor.hover = null;
        editor.hoverOpeningWall = null;
        editor.fit();
        const canvas = editor.canvas;
        const b = FC.planBounds(this.plan);
        if (!b) throw new Error('No plan bounds');
        const a = editor.w2s({ x: b.x0, y: b.y0 });
        const c = editor.w2s({ x: b.x1, y: b.y1 });
        const margin = 92; // dimension lines + breathing room
        const dprX = canvas.width / editor.W;
        const dprY = canvas.height / editor.H;
        const x0 = Math.max(0, Math.floor((Math.min(a.x, c.x) - margin) * dprX));
        const y0 = Math.max(0, Math.floor((Math.min(a.y, c.y) - margin) * dprY));
        const x1 = Math.min(canvas.width, Math.ceil((Math.max(a.x, c.x) + margin) * dprX));
        const y1 = Math.min(canvas.height, Math.ceil((Math.max(a.y, c.y) + margin) * dprY));
        const w = Math.max(80, x1 - x0);
        const h = Math.max(80, y1 - y0);
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const ctx = out.getContext('2d');
        ctx.drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        data = out.toDataURL('image/png');
      } catch (err) {
        try {
          data = editor.canvas.toDataURL('image/png');
        } catch (e) {
          data = null;
        }
      } finally {
        editor.view.scale = view.scale;
        editor.view.cx = view.cx;
        editor.view.cy = view.cy;
        editor.hover = hover;
        editor.hoverOpeningWall = hoverOpeningWall;
        editor.updateZoomLabel();
        editor.draw();
      }
      try {
        if (!data) throw new Error('No render');
        downloadDataURL(data, safeName(this.plan.name) + '.png');
        this.toast('Plan image saved', 'success');
      } catch (err) {
        this.toast('Could not export the plan image.', 'error');
      }
    }

    screenshot3D() {
      if (!this.ui.view3d) {
        this.enter3D(7);
        setTimeout(() => {
          if (this.ui.view3d) this.screenshot3D();
        }, 700);
        return;
      }
      if (!this.viewer) return;
      try {
        const data = this.viewer.screenshot();
        if (!data) throw new Error('No render');
        downloadDataURL(data, safeName(this.plan.name) + '-3d.png');
        this.toast('3D image saved', 'success');
      } catch (err) {
        this.toast('Could not capture the 3D view.', 'error');
      }
    }

    /* ---------------------------------------------------------------- */
    /* Shortcuts                                                        */
    /* ---------------------------------------------------------------- */

    _isTypingTarget(target) {
      return (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      );
    }

    _bindWindow() {
      if (this._bound) return;
      this._bound = true;

      window.addEventListener('keydown', (e) => {
        if (document.body.classList.contains('has-overlay')) return;
        if (this._isTypingTarget(e.target)) return;

        const mod = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        if (mod && key === 'z') {
          e.preventDefault();
          if (e.shiftKey) this.redo();
          else this.undo();
          return;
        }
        if (mod && key === 'y') {
          e.preventDefault();
          this.redo();
          return;
        }
        if (mod && key === 's') {
          e.preventDefault();
          this.saveNow();
          this.toast('Plan saved locally', 'success');
          return;
        }
        if (mod) return;

        if (e.key === 'Shift') {
          this.ui.ortho = true;
          if (this.editor) this.editor.draw();
          return;
        }

        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
          e.preventDefault();
          this.ui.showHelp();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.editor && this.editor.lengthBuffer) return;
          if (this.ui.selection) {
            e.preventDefault();
            this.deleteSelection();
          }
          return;
        }
        if (e.key === 'Escape') {
          if (this.ui.selection) {
            this.clearSelection();
            e.preventDefault();
          }
          return;
        }

        if (this.editor && (this.editor.wallChain || (this.ui.drawingFresh && this.plan.outline.length))) {
          return;
        }

        if (key === 'v') {
          this.setTool('select');
          e.preventDefault();
        } else if (key === 'h') {
          this.setTool('pan');
          e.preventDefault();
        } else if (key === 'o') {
          this.setTool('outline');
          e.preventDefault();
        } else if (key === 'w') {
          this.setTool('wall');
          e.preventDefault();
        } else if (key === 'd') {
          this.setTool('door');
          e.preventDefault();
        } else if (key === 'n') {
          this.setTool('window');
          e.preventDefault();
        } else if (key === 'r') {
          if (this.ui.selection && this.ui.selection.type === 'furniture') {
            this.rotateSelectedFurniture();
          } else {
            this.setTool('room');
          }
          e.preventDefault();
        } else if (key === 'l') {
          this.setTool('light');
          e.preventDefault();
        } else if (key === '3') {
          if (this.ui.view3d) this.exit3D();
          else this.enter3D(7);
          e.preventDefault();
        } else if (key === 'f') {
          this.fit();
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
          this.ui.ortho = false;
          if (this.editor) this.editor.draw();
        }
      });

      window.addEventListener('blur', () => {
        this.ui.ortho = false;
        if (this.editor) this.editor.draw();
      });

      window.addEventListener('beforeunload', () => {
        if (this._saveTimer) this.saveNow();
      });
    }

    /* ---------------------------------------------------------------- */
    /* Small helpers                                                    */
    /* ---------------------------------------------------------------- */

    toast(message, type) {
      if (this.ui && this.ui.toast) this.ui.toast(message, type);
      else if (window.console) console.log('[Floorcraft]', message);
    }
  }

  FC.App = App;

  function boot() {
    if (!window.FC || !window.FC.Editor2D || !window.FC.UI || !window.FC.Viewer3D) {
      setTimeout(boot, 40);
      return;
    }
    if (FC.app) return;
    try {
      FC.app = new FC.App();
      window.floorcraft = FC.app;
    } catch (err) {
      console.error('Floorcraft failed to start', err);
      const hint = document.getElementById('statusHint');
      if (hint) hint.textContent = 'Floorcraft could not start — check the browser console.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

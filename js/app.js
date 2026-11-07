/* RoomCraft — application controller, persistence and shortcuts */
(function () {
  const FC = (window.FC = window.FC || {});
  if (!FC) return;

  const STORAGE_KEY = 'roomcraft.projects.v1';
  const CURRENT_KEY = 'roomcraft.current.v1';
  const LEGACY_STORAGE_KEY = 'floorcraft.projects.v1';
  const LEGACY_CURRENT_KEY = 'floorcraft.current.v1';
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
      this.detectedRoomsPreview = null;
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
        let raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
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
        currentId = localStorage.getItem(CURRENT_KEY) || localStorage.getItem(LEGACY_CURRENT_KEY);
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
      if (this.plan.autoDetectRooms === false && this.plan.rooms.length > 0) {
        this.rooms = this.plan.rooms.map((r) => {
          const poly = Array.isArray(r.polygon) ? r.polygon.map((p) => ({ x: p.x, y: p.y })) : [];
          return Object.assign({}, r, {
            polygon: poly,
            area: r.area != null ? r.area : (poly.length >= 3 ? Math.abs(FC.polygonArea(poly)) : 0),
            centroid: r.centroid || (poly.length >= 3 ? FC.polygonCentroid(poly) : { x: 0, y: 0 }),
            bounds: r.bounds || (poly.length >= 3 ? FC.polygonBounds(poly) : null),
            isManual: r.isManual != null ? r.isManual : true,
          });
        });
      } else {
        this.rooms = FC.detectRooms(this.plan);
        this.plan.rooms = this._roomMeta();
      }
      if (Array.isArray(this.plan.furniture) && this.plan.furniture.length > 0) {
        this.furniture = this.plan.furniture;
      } else if (this.plan.furnished) {
        this.furniture = FC.furnishPlan(this.plan, this.rooms);
        this.plan.furniture = this.furniture;
      } else {
        this.furniture = [];
        this.plan.furniture = [];
      }
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
        polygon: Array.isArray(r.polygon) ? r.polygon.map((p) => ({ x: p.x, y: p.y })) : [],
        centroid: r.centroid ? { x: r.centroid.x, y: r.centroid.y } : { x: 0, y: 0 },
        bounds: r.bounds
          ? {
              x0: r.bounds.x0,
              y0: r.bounds.y0,
              x1: r.bounds.x1,
              y1: r.bounds.y1,
              w: r.bounds.w,
              d: r.bounds.d,
              cx: r.bounds.cx,
              cy: r.bounds.cy,
            }
          : null,
        isManual: !!r.isManual,
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
      if (this.plan.autoDetectRooms === false) {
        if (this.detectedRoomsPreview) {
          this.detectedRoomsPreview = FC.detectRooms(this.plan);
        }
        return;
      }
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
    }

    recomputeFurniture(force = false) {
      if (!this.plan.furnished) {
        this.furniture = [];
        this.plan.furniture = [];
        return;
      }
      if (!force && Array.isArray(this.plan.furniture) && this.plan.furniture.length > 0) {
        this.furniture = this.plan.furniture;
        return;
      }
      this.furniture = FC.furnishPlan(this.plan, this.rooms || []);
      this.plan.furniture = this.furniture;
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

    _snapshot(plan) {
      if (!plan) return '';
      const clone = Object.assign({}, plan, {
        furniture: (this.furniture || plan.furniture || []).map((f) => Object.assign({}, f)),
      });
      delete clone.updatedAt;
      return JSON.stringify(clone);
    }

    pushHistory() {
      if (!this.plan) return;
      const snapshot = this._snapshot(this.plan);
      if (this._history[this._history.length - 1] === snapshot) return;
      this._history.push(snapshot);
      if (this._history.length > MAX_HISTORY) this._history.shift();
      this._future.length = 0;
      if (this.ui && this.ui.updateUndoRedo) this.ui.updateUndoRedo();
    }

    canUndo() {
      if (this.editor && (this.ui.tool === 'wall' || this.ui.tool === 'divider') && this.editor.wallChain && this.editor.chainJustStarted) {
        return true;
      }
      return this._history.length > 0;
    }

    canRedo() {
      return this._future.length > 0;
    }

    undo() {
      if (this.editor && (this.ui.tool === 'wall' || this.ui.tool === 'divider') && this.editor.wallChain && this.editor.chainJustStarted) {
        this.editor.endWallChain();
        this.editor.draw();
        this.toast('Wall cancelled', 'info');
        if (this.ui && this.ui.updateUndoRedo) this.ui.updateUndoRedo();
        return;
      }
      if (!this._history.length) return;
      const current = this._snapshot(this.plan);
      const snapshot = this._history.pop();
      this._future.push(current);
      this._restore(snapshot);
      this.toast('Undone', 'info');
    }

    redo() {
      if (!this._future.length) return;
      const current = this._snapshot(this.plan);
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
      if (this.plan.autoDetectRooms === false && Array.isArray(this.plan.rooms) && this.plan.rooms.length > 0) {
        this.rooms = this.plan.rooms.map((r) => {
          const poly = Array.isArray(r.polygon) ? r.polygon.map((p) => ({ x: p.x, y: p.y })) : [];
          return Object.assign({}, r, {
            polygon: poly,
            area: r.area != null ? r.area : (poly.length >= 3 ? Math.abs(FC.polygonArea(poly)) : 0),
            centroid: r.centroid || (poly.length >= 3 ? FC.polygonCentroid(poly) : { x: 0, y: 0 }),
            bounds: r.bounds || (poly.length >= 3 ? FC.polygonBounds(poly) : null),
            isManual: r.isManual != null ? r.isManual : true,
          });
        });
      } else {
        this.rooms = FC.detectRooms(this.plan);
        this.plan.rooms = this._roomMeta();
      }
      if (Array.isArray(this.plan.furniture) && this.plan.furniture.length > 0) {
        this.furniture = this.plan.furniture;
      } else {
        this.recomputeFurniture();
      }
      if (this.editor) {
        const isWallTool = this.ui && (this.ui.tool === 'wall' || this.ui.tool === 'divider');
        if (isWallTool && this.editor.wallChain) {
          const walls = this.plan.walls || [];
          if (walls.length) {
            const lastW = walls[walls.length - 1];
            this.editor.wallChain = { x: lastW.b.x, y: lastW.b.y };
            this.editor.chainJustStarted = false;
          } else {
            this.editor.wallChain = null;
            this.editor.chainFirst = null;
            this.editor.chainJustStarted = false;
          }
        } else {
          this.editor.wallChain = null;
          this.editor.chainFirst = null;
          this.editor.chainJustStarted = false;
        }
        this.editor.lengthBuffer = '';
        this.editor.snap = null;
        this.editor.drag = null;
      }
      if (this.ui) {
        const outlineLen = this.plan.outline ? this.plan.outline.length : 0;
        if (this.ui.tool === 'outline' && this.ui.drawingFresh) {
          this.ui.drawingFresh = outlineLen > 0;
        } else {
          this.ui.drawingFresh = false;
        }
        this.ui.selection = null;
        this.ui.renderAll();
      }
      if (this.editor) this.editor.draw();
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

    disableAutoDetectRooms(quiet = false) {
      if (!this.plan) return;
      if (this.plan.autoDetectRooms === false) return;
      this.plan.autoDetectRooms = false;
      this.plan.rooms = this._roomMeta();
      if (!quiet) {
        this.toast('Switched to manual room mode (auto-detection paused)', 'info');
      }
      if (this.ui) {
        this.ui.renderStep();
        this.ui.renderSidebar();
      }
    }

    enableAutoDetectRooms() {
      if (!this.plan) return;
      this.pushHistory();
      this.plan.autoDetectRooms = true;
      this.detectedRoomsPreview = null;
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.recomputeFurniture();
      this.changed({ save: true });
      if (this.ui) this.ui.renderAll();
      if (this.editor) this.editor.draw();
      this.toast('Automatic room detection enabled (' + (this.rooms ? this.rooms.length : 0) + ' rooms detected)', 'success');
    }

    toggleAutoDetectRooms() {
      if (!this.plan) return;
      if (this.plan.autoDetectRooms === false) {
        this.enableAutoDetectRooms();
      } else {
        this.disableAutoDetectRooms(false);
      }
    }

    toggleDetectedRoomsPreview() {
      if (this.detectedRoomsPreview) {
        this.dismissDetectedRoomsPreview();
        return;
      }
      const candidates = FC.detectRooms(this.plan);
      this.detectedRoomsPreview = candidates;
      if (this.editor) this.editor.draw();
      if (this.ui) this.ui.renderStep();
      if (!candidates || !candidates.length) {
        this.toast('No enclosed rooms detected from current walls.', 'info');
      } else {
        this.toast(candidates.length + ' rooms detected in preview (manual layout unchanged)', 'info');
      }
    }

    dismissDetectedRoomsPreview() {
      this.detectedRoomsPreview = null;
      if (this.editor) this.editor.draw();
      if (this.ui) this.ui.renderStep();
    }

    applyDetectedRooms(enableAuto = true) {
      if (!this.plan) return;
      this.pushHistory();
      const detected = this.detectedRoomsPreview || FC.detectRooms(this.plan);
      this.rooms = detected;
      this.detectedRoomsPreview = null;
      if (enableAuto) {
        this.plan.autoDetectRooms = true;
      }
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.recomputeFurniture();
      this.changed({ save: true });
      if (this.ui) this.ui.renderAll();
      if (this.editor) this.editor.draw();
      this.toast('Applied ' + this.rooms.length + ' detected rooms', 'success');
    }

    adoptDetectedRoom(candidateId) {
      if (!this.detectedRoomsPreview) return;
      const cand = this.detectedRoomsPreview.find((c) => c.id === candidateId);
      if (!cand) return;
      this.pushHistory();
      this.disableAutoDetectRooms(true);
      this.rooms = this.rooms || [];
      this.rooms = this.rooms.filter((r) => r.id !== cand.id);
      const clean = FC.dedupePolygon(cand.polygon);
      const newRoom = {
        id: cand.id || FC.uid('room_manual'),
        name: cand.name || (FC.roomTypes[cand.type] ? FC.roomTypes[cand.type].label : 'Room'),
        type: cand.type || 'living',
        polygon: clean,
        area: cand.area || Math.abs(FC.polygonArea(clean)),
        centroid: cand.centroid || FC.polygonCentroid(clean),
        bounds: cand.bounds || FC.polygonBounds(clean),
        isManual: true,
      };
      this.rooms.push(newRoom);
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.recomputeFurniture();
      this.select({ type: 'room', id: newRoom.id });
      this.changed({ save: true });
      if (this.ui) this.ui.renderAll();
      if (this.editor) this.editor.draw();
      this.toast('Adopted "' + newRoom.name + '" (' + newRoom.area.toFixed(1) + ' m²)', 'success');
    }

    setRoomType(roomId, type) {
      if (!FC.roomTypes[type]) return;
      const room = (this.rooms || []).find((r) => r.id === roomId);
      if (!room || room.type === type) return;
      this.pushHistory();
      if (this.plan.autoDetectRooms !== false) {
        this.disableAutoDetectRooms(true);
        this.toast('Room type changed — auto-detection paused to protect manual edits', 'info');
      }
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

    setRoomName(roomId, name) {
      const room = (this.rooms || []).find((r) => r.id === roomId);
      if (!room) return;
      if (this.plan.autoDetectRooms !== false) {
        this.disableAutoDetectRooms(true);
        this.toast('Room renamed — auto-detection paused to protect manual edits', 'info');
      }
      room.name = name;
      const meta = (this.plan.rooms || []).find((m) => m.id === roomId);
      if (meta) meta.name = name;
      if (room.isManual && this.plan.manualRooms) {
        const mr = this.plan.manualRooms.find((m) => m.id === roomId);
        if (mr) mr.name = name;
      }
      this.changed({ save: true });
      if (this.editor) this.editor.draw();
      if (this.ui) this.ui.renderStep();
    }

    deleteRoom(roomId) {
      const room = (this.rooms || []).find((r) => r.id === roomId);
      if (!room) return;
      this.pushHistory();
      if (this.plan.autoDetectRooms !== false) {
        this.disableAutoDetectRooms(true);
      }
      this.plan.ignoredRooms = this.plan.ignoredRooms || [];
      if (!this.plan.ignoredRooms.includes(roomId)) {
        this.plan.ignoredRooms.push(roomId);
      }
      if (room.isManual && this.plan.manualRooms) {
        this.plan.manualRooms = this.plan.manualRooms.filter((r) => r.id !== roomId);
      }
      if (this.plan.autoDetectRooms === false) {
        this.rooms = (this.rooms || []).filter((r) => r.id !== roomId);
        this.plan.rooms = this._roomMeta();
      } else {
        this.rooms = FC.detectRooms(this.plan);
        this.plan.rooms = this._roomMeta();
      }
      if (this.plan.furnished) this.recomputeFurniture();
      this.clearSelection();
      this.changed({ save: true });
      this.ui.renderAll();
      this.toast('Room removed', 'info');
    }

    addManualRoom(poly, name, type) {
      if (!poly || poly.length < 3) return;
      this.pushHistory();
      if (this.plan.autoDetectRooms !== false) {
        this.disableAutoDetectRooms(true);
      }
      this.plan.manualRooms = this.plan.manualRooms || [];
      const clean = FC.dedupePolygon(poly);
      const area = Math.abs(FC.polygonArea(clean));
      const centroid = FC.polygonCentroid(clean);
      const bounds = FC.polygonBounds(clean);
      const id = FC.uid('room_manual');
      const t = type || 'living';
      const rName = name || (FC.roomTypes[t] ? FC.roomTypes[t].label : 'Custom Room');
      const newRoom = { id, name: rName, type: t, polygon: clean, area, centroid, bounds, isManual: true };
      this.plan.manualRooms.push(newRoom);
      if (this.plan.autoDetectRooms === false) {
        this.rooms = this.rooms || [];
        this.rooms.push(newRoom);
        this.plan.rooms = this._roomMeta();
      } else {
        this.rooms = FC.detectRooms(this.plan);
        this.plan.rooms = this._roomMeta();
      }
      if (this.plan.furnished) this.recomputeFurniture();
      this.select({ type: 'room', id });
      this.changed({ save: true });
      this.ui.renderAll();
      this.toast('Added "' + rName + '" (' + area.toFixed(1) + ' m²)', 'success');
    }

    toggleWallVirtual(wallId) {
      const wall = (this.plan.walls || []).find((w) => w.id === wallId);
      if (!wall) return;
      this.pushHistory();
      wall.virtual = !wall.virtual;
      if (this.plan.autoDetectRooms !== false) {
        this.rooms = FC.detectRooms(this.plan);
        this.plan.rooms = this._roomMeta();
        if (this.plan.furnished) this.recomputeFurniture();
      } else if (this.detectedRoomsPreview) {
        this.detectedRoomsPreview = FC.detectRooms(this.plan);
      }
      this.changed({ save: true });
      this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
      this.toast(wall.virtual ? 'Converted to Room Divider (virtual wall)' : 'Converted to Solid Wall', 'success');
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

      if (sel.type === 'walls') {
        const ids = sel.ids || [];
        const keys = sel.keys || [];
        this.pushHistory();
        this.plan.walls = this.plan.walls.filter((w) => !ids.includes(w.id));
        this.plan.openings = this.plan.openings.filter((op) => !keys.includes(op.hostKey) && !ids.some((id) => op.hostKey === 'w:' + id));
      } else if (sel.type === 'wall') {
        const seg = FC.segmentByKey(this.plan, sel.key);
        if (!seg) return;
        if (seg.boundary) {
          this.toast('The exterior outline cannot be deleted — redraw it instead.', 'info');
          return;
        }
        this.pushHistory();
        this.plan.walls = this.plan.walls.filter((w) => w.id !== seg.id);
        this.plan.openings = this.plan.openings.filter((op) => op.hostKey !== sel.key && op.hostKey !== 'w:' + seg.id);
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
      if (!['single', 'double', 'sliding', 'bifold'].includes(style)) return;
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
      this.detectedRoomsPreview = null;
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
      this.plan.furniture = this.furniture;
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
      this.recomputeFurniture(true);
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

    connectWalls(wallIds) {
      if (!wallIds || !wallIds.length) {
        if (this.ui.selection) {
          if (this.ui.selection.type === 'walls') {
            wallIds = this.ui.selection.ids || [];
          } else if (this.ui.selection.type === 'wall' && this.ui.selection.key) {
            const seg = FC.segmentByKey(this.plan, this.ui.selection.key);
            if (seg && seg.id) wallIds = [seg.id];
          }
        }
      }
      if (!wallIds || wallIds.length < 2) {
        this.toast('Select two or more walls to connect', 'info');
        return;
      }
      this.pushHistory();
      const res = FC.connectWalls(this.plan, wallIds);
      if (res && res.length) {
        this.changed({ rooms: true, furniture: true, save: true });
        this.toast(`Connected ${wallIds.length} walls! Drag the junction node to slide them together.`, 'success');
        if (this.editor) this.editor.draw();
      } else {
        this.toast('Could not find a valid connection between those walls', 'info');
      }
    }

    connectWallToNearest(wallId) {
      if (!wallId && this.ui.selection && this.ui.selection.type === 'wall') {
        const seg = FC.segmentByKey(this.plan, this.ui.selection.key);
        if (seg && seg.id) wallId = seg.id;
      }
      if (!wallId) return;
      const nearest = FC.findNearestWallToWall(this.plan, wallId);
      if (!nearest || nearest.dist > 3.0) {
        this.toast('No nearby wall found to connect with', 'info');
        return;
      }
      this.pushHistory();
      const res = FC.connectTwoWalls(this.plan, wallId, nearest.targetIdOrKey);
      if (res && res.success) {
        this.changed({ rooms: true, furniture: true, save: true });
        this.toast('Connected to nearest wall! Drag junction to slide together.', 'success');
        if (this.editor) this.editor.draw();
      } else {
        this.toast('Could not connect to nearest wall', 'info');
      }
    }

    mergeWalls(wallIds) {
      if (!wallIds || !wallIds.length) {
        if (this.ui.selection) {
          if (this.ui.selection.type === 'walls') {
            wallIds = this.ui.selection.ids || [];
          } else if (this.ui.selection.type === 'wall' && this.ui.selection.key) {
            const seg = FC.segmentByKey(this.plan, this.ui.selection.key);
            if (seg && seg.id) wallIds = [seg.id];
          }
        }
      }
      if (!wallIds || wallIds.length < 2) {
        this.toast('Select at least 2 walls to merge (Shift+Click or drag)', 'info');
        return;
      }
      this.pushHistory();
      let mergedAny = false;
      let lastMergedId = null;
      for (let i = 0; i < wallIds.length; i++) {
        for (let j = i + 1; j < wallIds.length; j++) {
          const id1 = wallIds[i];
          const id2 = wallIds[j];
          const w1 = this.plan.walls.find((w) => w.id === id1);
          const w2 = this.plan.walls.find((w) => w.id === id2);
          if (w1 && w2) {
            const res = FC.mergeWalls(this.plan, id1, id2);
            if (res && res.merged) {
              mergedAny = true;
              lastMergedId = res.wall ? res.wall.id : id1;
            }
          }
        }
      }
      if (mergedAny) {
        if (lastMergedId) {
          this.select({ type: 'wall', key: 'w:' + lastMergedId });
        } else {
          this.select(null);
        }
        this.changed({ rooms: true, furniture: true, save: true });
        this.toast('Merged walls into a single continuous wall!', 'success');
        if (this.editor) this.editor.draw();
      } else {
        this.toast('Selected walls could not be merged (must be collinear in-line or parallel)', 'warning');
      }
    }

    extendWallToBoundary(wallId, fromEnd) {
      if (!wallId && this.ui.selection && this.ui.selection.type === 'wall') {
        const seg = FC.segmentByKey(this.plan, this.ui.selection.key);
        if (seg && seg.id) wallId = seg.id;
      }
      if (!wallId) return;
      fromEnd = fromEnd !== undefined ? fromEnd : (this.wallAnchorEnd !== undefined ? this.wallAnchorEnd : 0);
      this.pushHistory();
      const res = FC.extendWallToBoundary(this.plan, wallId, fromEnd);
      if (res && res.extended) {
        this.changed({ rooms: true, furniture: true, save: true });
        this.toast(`Extended wall by ${FC.fmt(res.delta, 2)} m to nearest boundary`, 'success');
        if (this.editor) this.editor.draw();
      } else {
        this.toast('No intersecting wall found along this wall direction', 'info');
      }
    }

    lengthenWall(wallId, deltaMeters, fromEnd) {
      if (!wallId && this.ui.selection && this.ui.selection.type === 'wall') {
        const seg = FC.segmentByKey(this.plan, this.ui.selection.key);
        if (seg && seg.id) wallId = seg.id;
      }
      if (!wallId) return;
      const wall = this.plan.walls.find((w) => w.id === wallId);
      if (!wall) return;
      const currentLen = FC.dist(wall.a, wall.b);
      const newLen = Math.max(0.2, currentLen + deltaMeters);
      fromEnd = fromEnd !== undefined ? fromEnd : (this.wallAnchorEnd !== undefined ? this.wallAnchorEnd : 0);
      this.pushHistory();
      FC.resizeWall(this.plan, wallId, newLen, fromEnd);
      this.changed({ rooms: true, furniture: true, save: true });
      this.toast(`Wall length: ${FC.fmt(newLen, 2)} m (doors stay fixed)`, 'info');
      if (this.editor) this.editor.draw();
    }

    startConnectMode(wallId) {
      if (!wallId && this.ui.selection && this.ui.selection.type === 'wall') {
        const seg = FC.segmentByKey(this.plan, this.ui.selection.key);
        if (seg && seg.id) wallId = seg.id;
      }
      if (!wallId) return;
      if (this.editor) {
        this.editor.startConnectMode(wallId);
      }
    }

    flipDoor(id) {
      const targetId = id || (this.ui.selection && this.ui.selection.type === 'opening' ? this.ui.selection.id : null);
      if (!targetId) return;
      const op = this.plan.openings.find((o) => o.id === targetId);
      if (!op || op.kind !== 'door') return;
      this.pushHistory();
      // Toggle swing side (+normal vs -normal)
      op.swingSide = op.swingSide === -1 ? 1 : -1;
      this.changed({ furniture: false, save: true });
      this.toast('Door swing flipped', 'info');
    }

    flipDoorHinge(id) {
      const targetId = id || (this.ui.selection && this.ui.selection.type === 'opening' ? this.ui.selection.id : null);
      if (!targetId) return;
      const op = this.plan.openings.find((o) => o.id === targetId);
      if (!op || op.kind !== 'door') return;
      this.pushHistory();
      // Toggle hinge (left vs right)
      op.hinge = op.hinge === 'right' ? 'left' : 'right';
      this.changed({ furniture: false, save: true });
      this.toast('Door hinge flipped (' + op.hinge + ')', 'info');
    }

    setDoorStyle(style, id) {
      const targetId = id || (this.ui.selection && this.ui.selection.type === 'opening' ? this.ui.selection.id : null);
      if (!targetId) return;
      const op = this.plan.openings.find((o) => o.id === targetId);
      if (!op || op.kind !== 'door') return;
      this.pushHistory();
      op.style = style;
      this.changed({ furniture: false, save: true });
      this.toast('Door style: ' + style, 'info');
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
      f.custom = true;
      this.plan.furniture = this.furniture;
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.viewer) this.viewer.markDirty();
      this.toast('Rotated ' + f.kind, 'info');
    }

    deleteSelectedFurniture() {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'furniture' || !this.furniture) return;
      this.pushHistory();
      this.furniture = this.furniture.filter((item) => item.id !== sel.id);
      this.plan.furniture = this.furniture;
      this.clearSelection();
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.viewer) this.viewer.markDirty();
      this.toast('Furniture removed', 'info');
    }

    addFurnitureItem(kind, customX = null, customY = null, targetRoomId = null) {
      if (!this.rooms.length) {
        this.toast('Create enclosed rooms first', 'info');
        return;
      }
      this.pushHistory();
      let r = null;
      if (targetRoomId) {
        r = this.rooms.find((rm) => rm.id === targetRoomId);
      }
      if (!r && this.ui && this.ui.selection && this.ui.selection.type === 'room') {
        r = this.rooms.find((rm) => rm.id === this.ui.selection.id);
      }
      if (!r) {
        r = this.rooms[0];
      }

      const b = r.bounds || (r.polygon && r.polygon.length ? FC.polygonBounds(r.polygon) : { cx: 0, cy: 0, w: 2, d: 2 });
      const def = FC.furnitureCatalog[kind] || {};
      const w = def.w || (kind === 'bed' ? 1.6 : kind === 'sofa' ? 2.1 : 1.0);
      const d = def.d || (kind === 'bed' ? 2.0 : kind === 'sofa' ? 0.9 : 0.8);
      const h = def.h || FC.FURNITURE_HEIGHTS[kind] || 0.75;
      const elev = def.elev || 0;
      const mat = def.mat || 'wood';
      const decor = !!def.decor;

      let posX = customX != null ? customX : FC.round(b.cx, 3);
      let posY = customY != null ? customY : FC.round(b.cy, 3);
      let rot = 0;

      if (customX == null && customY == null && r.polygon && r.polygon.length >= 3) {
        const segs = FC.collectAllWalls(this.plan);
        const doorZones = FC.findDoorZones(this.plan);
        const roomWins = FC.findRoomWindows(r, this.plan, segs);
        const rule = FC.ITEM_RULES[kind] || { archetype: 'wall-perimeter' };
        if (rule.archetype === 'corner' || rule.archetype === 'corner-or-wall') {
          const cp = FC.findCornerPlacement(r, kind, w, d, this.furniture || [], doorZones, roomWins, segs);
          if (cp) {
            posX = cp.x;
            posY = cp.y;
            rot = cp.rot;
          }
        } else if (rule.archetype === 'wall-perimeter' || rule.archetype === 'head-to-wall') {
          const wp = FC.findWallPlacement(this.plan, r, segs, kind, w, d, this.furniture || [], doorZones, null, roomWins);
          if (wp) {
            posX = wp.x;
            posY = wp.y;
            rot = wp.rot;
          }
        }
      }

      const item = {
        id: FC.uid('f'),
        roomId: r.id,
        kind,
        x: posX,
        y: posY,
        w,
        d,
        rot,
        h,
        elev,
        mat,
        variant: def.category || '',
        decor,
        custom: true,
      };

      if (!this.furniture) this.furniture = [];
      this.furniture.push(item);
      this.plan.furniture = this.furniture;
      this.plan.furnished = true;
      this.select({ type: 'furniture', id: item.id });
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.viewer) this.viewer.markDirty();
      this.toast('Placed ' + (def.label || kind), 'success');
      return item;
    }

    openFurnitureCatalog(targetRoomId = null) {
      if (this.ui && this.ui.openFurnitureCatalogModal) {
        this.ui.openFurnitureCatalogModal(targetRoomId);
      }
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
      if (!this.plan.furnished && (!this.furniture || !this.furniture.length)) return;
      this.pushHistory();
      this.plan.furnished = false;
      this.furniture = [];
      this.plan.furniture = [];
      this.changed({ rooms: false, furniture: false, save: true });
      if (this.ui) this.ui.renderAll();
      if (this.viewer) this.viewer.markDirty();
      this.toast('Furniture cleared — generate it again any time.', 'info');
    }

    toggleFurniture() {
      this.pushHistory();
      this.plan.furnished = !this.plan.furnished;
      if (this.plan.furnished) {
        if (!this.plan.furniture || !this.plan.furniture.length) {
          this.recomputeFurniture(true);
        } else {
          this.furniture = this.plan.furniture;
        }
      } else {
        this.furniture = [];
      }
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
      if (Array.isArray(this.plan.furniture) && this.plan.furniture.length > 0) {
        this.furniture = this.plan.furniture;
      } else if (this.plan.furnished) {
        this.furniture = FC.furnishPlan(this.plan, this.rooms);
        this.plan.furniture = this.furniture;
      } else {
        this.furniture = [];
        this.plan.furniture = [];
      }
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
      downloadBlob(new Blob([data], { type: 'application/json' }), safeName(this.plan.name) + '.roomcraft.json');
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

          const buffer = await file.arrayBuffer();
          let text = '';
          const isDWG = name.endsWith('.dwg') || (FC.CAD && FC.CAD.isDWGBinary && FC.CAD.isDWGBinary(buffer));

          if (isDWG) {
            this.toast('Transcoding AutoCAD DWG with WebAssembly...', 'info', 3500);
            try {
              text = await FC.CAD.convertDWGtoDXF(buffer);
            } catch (dwgErr) {
              console.error(dwgErr);
              throw new Error('Could not read AutoCAD DWG (' + dwgErr.message + '). If the file is protected or unsupported, try exporting as DXF.');
            }
          } else {
            text = new TextDecoder('utf-8').decode(buffer);
          }

          const analysis = FC.CAD && FC.CAD.analyzeDXF ? FC.CAD.analyzeDXF(text) : null;
          if (analysis) {
            this.openCADImportModal(text, file.name, analysis);
          } else {
            const importedPlan = FC.CAD.importDXF(text, { filename: file.name.replace(/\.[^/.]+$/, '') });
            this._activatePlan(importedPlan);
            if (this.editor) this.editor.fit();
            this.toast('CAD floorplan imported successfully!', 'success');
          }
        } catch (err) {
          console.error(err);
          this.toast('Could not import CAD file: ' + err.message, 'error');
        }
      };
      input.click();
    }

    openCADImportModal(text, filename, analysis) {
      const cleanName = filename.replace(/\.[^/.]+$/, '');
      const rawW = analysis.rawW;
      const rawH = analysis.rawH;
      const recommendedUnit = analysis.unit;

      const units = [
        { id: 'in', label: 'Inches (in)', factor: 0.0254, w: (rawW * 0.0254).toFixed(1), h: (rawH * 0.0254).toFixed(1) },
        { id: 'mm', label: 'Millimeters (mm)', factor: 0.001, w: (rawW * 0.001).toFixed(2), h: (rawH * 0.001).toFixed(2) },
        { id: 'cm', label: 'Centimeters (cm)', factor: 0.01, w: (rawW * 0.01).toFixed(1), h: (rawH * 0.01).toFixed(1) },
        { id: 'm', label: 'Meters (m)', factor: 1.0, w: rawW.toFixed(1), h: rawH.toFixed(1) },
        { id: 'ft', label: 'Feet (ft)', factor: 0.3048, w: (rawW * 0.3048).toFixed(1), h: (rawH * 0.3048).toFixed(1) },
      ];

      const html = `
        <div style="font-size:13px;color:var(--ink-2);margin-bottom:14px;line-height:1.5;">
          <b>${filename}</b> · ${analysis.entityCount} entities
          ${analysis.doorCount ? ` · <span style="color:var(--brand-primary);">${analysis.doorCount} doors</span>` : ''}
          ${analysis.windowCount ? ` · <span style="color:#0284c7;">${analysis.windowCount} windows</span>` : ''}
          ${analysis.outliersFiltered ? ` · <span style="color:#d97706;">${analysis.outliersFiltered} rogue entities ignored</span>` : ''}
        </div>
        ${analysis.layers && analysis.layers.length ? `
        <div style="background:var(--surface-sunken);border:1px solid var(--border-soft);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;">
          <span style="font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-3);display:block;margin-bottom:6px;">Detected CAD Layers & Roles</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${analysis.layers.map(l => `<span style="background:var(--surface-card);border:1px solid var(--border-soft);padding:2px 8px;border-radius:6px;font-size:11px;"><b>${l.name}</b> (${l.count}) · <span style="color:var(--brand-primary);font-weight:500;">${l.role}</span></span>`).join('')}
          </div>
        </div>
        ` : ''}
        <div style="background:var(--surface-sunken);border:1px solid var(--border-soft);border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-3);">Drawing scale / units</span>
            <span id="cadResultDims" style="font-size:12px;font-weight:600;color:var(--brand-primary);">${analysis.scaledW} m × ${analysis.scaledH} m</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:6px;">
            ${units.map((u) => `
              <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--surface-card);border:1px solid var(--border-soft);border-radius:8px;cursor:pointer;">
                <span style="display:flex;align-items:center;gap:8px;">
                  <input type="radio" name="cadUnit" value="${u.factor}" ${u.id === recommendedUnit ? 'checked' : ''}>
                  <b>${u.label}</b>
                  ${u.id === recommendedUnit ? `<span class="badge" style="background:var(--brand-primary);color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;">Recommended</span>` : ''}
                </span>
                <span style="color:var(--ink-3);font-size:12px;">${u.w} m × ${u.h} m</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="cadMergeDouble" checked>
            <span><b>Auto-merge double-line walls</b> (consolidate CAD 2-line walls into single walls with thickness)</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="cadImportDoors" checked>
            <span><b>Import door and window blocks</b> as interactive openings</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="cadFilterOutliers" checked>
            <span><b>Ignore scrap entities</b> located far outside the floorplan bounds</span>
          </label>
        </div>
      `;

      this.ui.showModal({
        title: 'Import CAD Drawing',
        eyebrow: 'AutoCAD DXF / DWG',
        wide: true,
        html,
        actions: [
          { label: 'Cancel', value: null },
          { label: 'Import Plan', primary: true, value: 'import' },
        ],
        onMount: (overlay) => {
          const dimsSpan = overlay.querySelector('#cadResultDims');
          overlay.querySelectorAll('input[name="cadUnit"]').forEach((radio) => {
            radio.addEventListener('change', () => {
              const factor = parseFloat(radio.value);
              dimsSpan.textContent = (rawW * factor).toFixed(2) + ' m × ' + (rawH * factor).toFixed(2) + ' m';
            });
          });
        },
      }).then((result) => {
        if (!result) return;
        const selRadio = document.querySelector('input[name="cadUnit"]:checked');
        const factor = selRadio ? parseFloat(selRadio.value) : (analysis.unitFactor || 0.0254);
        const mergeDouble = document.getElementById('cadMergeDouble') ? document.getElementById('cadMergeDouble').checked : true;
        const importDoors = document.getElementById('cadImportDoors') ? document.getElementById('cadImportDoors').checked : true;
        const filterOutliers = document.getElementById('cadFilterOutliers') ? document.getElementById('cadFilterOutliers').checked : true;

        try {
          const importedPlan = FC.CAD.importDXF(text, {
            filename: cleanName,
            scale: factor,
            mergeDoubleLines: mergeDouble,
            importDoors: importDoors,
            filterOutliers: filterOutliers,
          });
          this._activatePlan(importedPlan);
          if (this.editor) this.editor.fit();
          this.toast('CAD floorplan imported successfully! (' + (importedPlan.walls.length + (importedPlan.outline ? 1 : 0)) + ' walls)', 'success');
        } catch (err) {
          console.error(err);
          this.toast('Could not import CAD file: ' + err.message, 'error');
        }
      });
    }

    scalePlan(factor) {
      if (!factor || factor <= 0 || !isFinite(factor) || factor === 1) return;
      this.pushHistory();
      FC.scalePlan(this.plan, factor);
      this._syncPlan();
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.furniture = FC.furnishPlan(this.plan, this.rooms);
      if (this.editor) this.editor.fit();
      this.ui.renderAll();
      this.toast('Plan scaled by ' + factor + 'x', 'success');
    }

    openScaleModal() {
      const b = FC.planBounds(this.plan);
      const curW = b ? b.w : 10;
      const curH = b ? b.d : 10;

      const html = `
        <div style="font-size:13px;color:var(--ink-2);margin-bottom:14px;line-height:1.5;">
          Current plan dimensions: <b style="color:var(--ink-1);">${curW.toFixed(2)} m wide × ${curH.toFixed(2)} m deep</b>
        </div>
        <div style="background:var(--surface-sunken);border:1px solid var(--border-soft);border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-3);margin-bottom:8px;">Quick Unit Conversions</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button class="btn soft sm" data-scale-btn="0.0254">Inches → Meters (×0.0254)</button>
            <button class="btn soft sm" data-scale-btn="0.001">Millimeters → Meters (×0.001)</button>
            <button class="btn soft sm" data-scale-btn="0.3048">Feet → Meters (×0.3048)</button>
            <button class="btn soft sm" data-scale-btn="3.28084">Meters → Feet (×3.28)</button>
            <button class="btn soft sm" data-scale-btn="2">Double size (2×)</button>
            <button class="btn soft sm" data-scale-btn="0.5">Half size (0.5×)</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <label class="modal-input" style="display:flex;flex-direction:column;gap:4px;">
            <span style="font-weight:600;font-size:12px;color:var(--ink-2);">Or specify Target Width (meters):</span>
            <input type="number" id="targetWidthInput" step="0.1" min="0.5" max="1000" placeholder="e.g. 21.18" style="padding:8px 10px;background:var(--surface-card);border:1px solid var(--border-soft);border-radius:8px;color:var(--ink-1);">
          </label>
          <label class="modal-input" style="display:flex;flex-direction:column;gap:4px;">
            <span style="font-weight:600;font-size:12px;color:var(--ink-2);">Or Custom Scale Factor multiplier:</span>
            <input type="number" id="customScaleInput" step="0.001" min="0.0001" max="1000" value="1.0" style="padding:8px 10px;background:var(--surface-card);border:1px solid var(--border-soft);border-radius:8px;color:var(--ink-1);">
          </label>
        </div>
      `;

      this.ui.showModal({
        title: 'Scale / Resize Floorplan',
        eyebrow: 'Dimensions & Calibration',
        wide: true,
        html,
        actions: [
          { label: 'Cancel', value: null },
          { label: 'Apply Scale', primary: true, value: 'apply' },
        ],
        onMount: (overlay, close) => {
          const targetInput = overlay.querySelector('#targetWidthInput');
          const customInput = overlay.querySelector('#customScaleInput');

          overlay.querySelectorAll('[data-scale-btn]').forEach((btn) => {
            btn.addEventListener('click', () => {
              const factor = parseFloat(btn.dataset.scaleBtn);
              close({ factor });
            });
          });

          targetInput.addEventListener('input', () => {
            const tw = parseFloat(targetInput.value);
            if (tw > 0 && curW > 0) {
              customInput.value = (tw / curW).toFixed(4);
            }
          });
        },
      }).then((res) => {
        if (!res) return;
        let factor = 1;
        if (typeof res === 'object' && res.factor) {
          factor = res.factor;
        } else {
          const customInput = document.getElementById('customScaleInput');
          factor = customInput ? parseFloat(customInput.value) : 1;
        }
        if (factor && factor > 0 && factor !== 1) {
          this.scalePlan(factor);
        }
      });
    }

    mergeSelectedWallWithParallel(targetWallId) {
      const sel = this.ui.selection;
      if (!sel || sel.type !== 'wall') return;
      const wallId = sel.key ? (sel.key.startsWith('w:') ? sel.key.slice(2) : null) : sel.id;
      if (!wallId) return;

      const cand = targetWallId ? { wall: { id: targetWallId } } : FC.findParallelWall(this.plan, wallId);
      if (!cand) {
        this.toast('No parallel wall nearby to merge with.', 'warning');
        return;
      }

      this.pushHistory();
      const res = FC.mergeParallelWalls(this.plan, wallId, cand.wall.id);
      if (!res) {
        this.toast('Could not merge walls.', 'error');
        return;
      }

      this._syncPlan();
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.furniture = FC.furnishPlan(this.plan, this.rooms);
      this.select({ type: 'wall', key: 'w:' + res.mergedWall.id });
      this.ui.renderAll();
      this.toast('Merged 2 parallel lines into 1 wall (' + Math.round(res.thickness * 100) + ' cm thick)', 'success');
    }

    consolidateDoubleWalls() {
      this.pushHistory();
      const count = FC.consolidateAllDoubleWalls(this.plan);
      if (count === 0) {
        this.toast('No double-line walls found to merge.', 'info');
        return;
      }
      this._syncPlan();
      this.rooms = FC.detectRooms(this.plan);
      this.plan.rooms = this._roomMeta();
      if (this.plan.furnished) this.furniture = FC.furnishPlan(this.plan, this.rooms);
      this.clearSelection();
      this.ui.renderAll();
      this.toast('Merged ' + count + ' double-line wall pairs into single walls!', 'success');
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
              plan.name = plan.name || file.name.replace(/\.(roomcraft\.|floorcraft\.)?json$/i, '') || 'Imported plan';
              plan.createdAt = Date.now();
              plan.updatedAt = Date.now();
              this.projects.push(plan);
              this._activatePlan(plan);
              this.toast('Imported "' + plan.name + '"', 'success');
            } catch (err) {
              this.toast('Could not import that file — expected a RoomCraft JSON plan.', 'error');
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
      else if (window.console) console.log('[RoomCraft]', message);
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
      window.roomcraft = window.floorcraft = FC.app;
    } catch (err) {
      console.error('RoomCraft failed to start', err);
      const hint = document.getElementById('statusHint');
      if (hint) hint.textContent = 'RoomCraft could not start — check the browser console.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

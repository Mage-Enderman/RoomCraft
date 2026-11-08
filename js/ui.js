/* RoomCraft — UI chrome, panels, menus and dialogs */
(function () {
  const FC = (window.FC = window.FC || {});
  const I = (name, cls) => FC.icon(name, cls);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STEPS = [
    { n: 1, label: 'Outline' },
    { n: 2, label: 'Walls' },
    { n: 3, label: 'Rooms' },
    { n: 4, label: 'Doors' },
    { n: 5, label: 'Generate' },
    { n: 6, label: 'Lighting' },
    { n: 7, label: '3D' },
  ];

  const TOOLS = [
    { tool: 'select', icon: 'cursor', label: 'Select', key: 'V' },
    { tool: 'pan', icon: 'hand', label: 'Pan', key: 'H' },
    { sep: true },
    { tool: 'outline', icon: 'home', label: 'Outline', key: 'O' },
    { tool: 'rect', icon: 'box', label: 'Room / Footprint Box', key: 'B' },
    { tool: 'wall', icon: 'wall', label: 'Interior walls', key: 'W' },
    { tool: 'door', icon: 'door', label: 'Doors', key: 'D' },
    { tool: 'window', icon: 'window', label: 'Windows', key: 'N' },
    { tool: 'room', icon: 'layout', label: 'Rooms', key: 'R' },
    { tool: 'measure', icon: 'measure', label: 'Tape Measure', key: 'M' },
    { sep: true },
    { action: 'toggle-grid', icon: 'grid', label: 'Grid snapping', key: 'G' },
    { action: 'toggle-ortho', icon: 'ortho', label: 'Straight wall & angle snap', key: 'A' },
    { action: 'toggle-dims', icon: 'ruler', label: 'Dimensions', key: '' },
    { sep: true },
    { action: 'step', step: 6, icon: 'light', label: 'Lighting & 3D', key: '' },
    { action: 'help', icon: 'help', label: 'Help', key: '?' },
  ];

  class UI {
    constructor(app) {
      this.app = app;
      this.sidebarOpen = window.innerWidth > 700;
      this.welcomeDismissed = false;
      this.structureOpen = false;
      this._activeSetting = null;
      this._menu = null;
      this._modal = null;
      this.els = {
        stepper: document.getElementById('stepper'),
        toolrail: document.getElementById('toolrail'),
        sidebar: document.getElementById('sidebar'),
        sideScroll: document.getElementById('sideScroll'),
        projectName: document.getElementById('projectName'),
        projectBtn: document.getElementById('projectBtn'),
        saveChip: document.getElementById('saveChip'),
        saveText: document.getElementById('saveText'),
        zoomValue: document.getElementById('zoomValue'),
        statusHint: document.getElementById('statusHint'),
        welcome: document.getElementById('welcome'),
        toasts: document.getElementById('toasts'),
        menuRoot: document.getElementById('menuRoot'),
        modalRoot: document.getElementById('modalRoot'),
        viewerWrap: document.getElementById('viewerWrap'),
        sidebarReopen: document.getElementById('sidebarReopen'),
        loading3d: document.getElementById('loading3d'),
        undoBtn: document.getElementById('undoBtn'),
        redoBtn: document.getElementById('redoBtn'),
        viewerBadge: document.getElementById('viewerBadge'),
        unitToggleBtn: document.getElementById('unitToggleBtn'),
      };
      FC.hydrateIcons(document);
      this._bind();
      this.renderStepper();
      this.renderToolrail();
      this.renderAll();
    }

    /* ---------------------------------------------------------------- */
    /* Bindings                                                          */
    /* ---------------------------------------------------------------- */

    _bind() {
      document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (actionEl) {
          this.handleAction(actionEl, e);
        } else if (!e.target.closest('.menu')) {
          this.closeMenus();
        }
      });

      document.addEventListener('input', (e) => this.onInput(e));
      document.addEventListener('change', (e) => this.onChange(e));
      document.addEventListener(
        'pointerdown',
        (e) => {
          const el = e.target;
          if (el.matches && el.matches('input[type="range"][data-setting], input[type="range"][data-sun], input[type="range"][data-density], input[type="range"][data-furniture-rot]')) {
            const key = el.dataset.setting
              ? 'setting:' + el.dataset.setting
              : el.dataset.sun !== undefined
                ? 'sun'
                : el.dataset.density !== undefined
                  ? 'density'
                  : el.dataset.furnitureRot
                    ? 'furnRot:' + el.dataset.furnitureRot
                    : '';
            if (!this._activeSetting) {
              this.app.pushHistory();
              this._activeSetting = key || el.name || 'range';
            }
          }
        },
        true,
      );

      document.addEventListener('toggle', (e) => {
        if (e.target.classList && e.target.classList.contains('structure')) {
          this.structureOpen = e.target.open;
        }
      }, true);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this._modal) return;
          this.closeMenus();
        }
        const el = e.target;
        if (
          el &&
          el.matches &&
          el.matches('input[data-setting]:not([type="range"]), input[data-op-field], input[data-wall-len]')
        ) {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.formatDimensionInput(el);
            el.blur();
            return;
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            this.stepDimensionInput(el, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
          }
        }
      });
    }

    /* ---------------------------------------------------------------- */
    /* Render                                                            */
    /* ---------------------------------------------------------------- */

    renderAll() {
      this.renderStepper();
      this.renderToolrail();
      this.renderSidebar();
      this.updateHeader();
      this.updateHint();
      this.updateStats();
      this.setViewMode(!!this.app.ui.view3d);
      this.syncWelcome();
      this.updateUndoRedo();
      if (this.els.unitToggleBtn && this.app.plan) {
        const imp = FC.isImperial && FC.isImperial(this.app.plan);
        this.els.unitToggleBtn.textContent = imp ? "ft' in\"" : 'm';
      }
      if (this.app.editor) this.app.editor.updateZoomLabel();
      this.syncSidebar();
    }

    renderStepper() {
      const step = this.app.ui.step || 1;
      const is3d = !!this.app.ui.view3d;
      this.els.stepper.innerHTML = STEPS.map((s) => {
        const active = is3d ? s.n === 6 || s.n === 7 ? s.n === step : false : s.n === step;
        return `<button class="step ${active ? 'active' : ''}" data-action="step" data-step="${s.n}" title="${s.label}">
          <span class="step-index">${s.n}</span><span class="step-label">${s.label}</span>
        </button>`;
      }).join('');
    }

    renderToolrail() {
      const ui = this.app.ui;
      const e = this.app.editor;
      this.els.toolrail.innerHTML = TOOLS.map((t) => {
        if (t.sep) return '<div class="rail-sep"></div>';
        let active = false;
        if (t.tool) active = ui.tool === t.tool;
        if (t.action === 'toggle-grid') active = this.app.plan.settings.snapGrid !== false && (!e || e.gridSnap !== false);
        if (t.action === 'toggle-ortho') active = this.app.plan.settings.snapAngle !== false;
        if (t.action === 'toggle-dims') active = !!this.app.plan.settings.showDims;
        if (t.action === 'step') active = ui.view3d && (ui.step === 6 || ui.step === 7);
        const attrs = t.action
          ? t.action === 'step'
            ? `data-action="${t.action}" data-step="${t.step}"`
            : `data-action="${t.action}"`
          : `data-action="tool" data-tool="${t.tool}"`;
        return `<button class="rail-btn ${active ? 'active' : ''}" ${attrs} data-tip="${t.label}${t.key ? ' <em>(' + t.key + ')</em>' : ''}" aria-label="${t.label}">
          ${I(t.icon)}
        </button>`;
      }).join('');
    }

    renderSidebar() {
      const el = this.els.sideScroll;
      const scrollTop = el.scrollTop;
      el.innerHTML = this.sidebarHTML();
      el.scrollTop = scrollTop;
      this.paintRanges(el);
      this.updateStats();
    }

    renderStep() {
      this.renderSidebar();
    }

    updateHeader() {
      this.els.projectName.textContent = this.app.plan.name || 'Untitled plan';
      this.syncSidebar();
      this.updateSaveChip();
    }

    updateUndoRedo() {
      if (this.els.undoBtn) this.els.undoBtn.disabled = !this.app.canUndo();
      if (this.els.redoBtn) this.els.redoBtn.disabled = !this.app.canRedo();
    }

    updateSaveChip() {
      const status = this.app.saveStatus || 'saved';
      const chip = this.els.saveChip;
      chip.dataset.state = status;
      const ico = chip.querySelector('.save-ico');
      if (ico) {
        chip.classList.remove('saving');
        if (status === 'saving') {
          chip.classList.add('saving');
          ico.innerHTML = I('rotate');
          this.els.saveText.textContent = 'Saving…';
        } else if (status === 'dirty' || status === 'unsaved') {
          ico.innerHTML = I('pencil');
          this.els.saveText.textContent = 'Unsaved';
        } else {
          ico.innerHTML = I('check');
          this.els.saveText.textContent = 'Saved';
        }
      }
    }

    updateStats() {
      const stats = this.app.stats();
      const plan = this.app.plan;
      const areaVal = FC.formatAreaValue ? FC.formatAreaValue(stats.area, plan, 1) : stats.area.toFixed(1);
      const areaUnit = FC.areaUnitLabel ? FC.areaUnitLabel(plan) : 'm²';
      this.els.sideScroll.querySelectorAll('[data-stat]').forEach((node) => {
        const key = node.dataset.stat;
        if (key === 'area') {
          node.querySelector('.stat-value').firstChild.textContent = areaVal;
          const unitSpan = node.querySelector('.stat-value span');
          if (unitSpan) unitSpan.textContent = areaUnit;
        }
        if (key === 'rooms') node.querySelector('.stat-value').firstChild.textContent = String(stats.rooms);
        if (key === 'doors') node.querySelector('.stat-value').firstChild.textContent = String(stats.doors);
        if (key === 'furnished') {
          node.querySelector('.stat-value').firstChild.textContent = stats.furnished ? 'Yes' : '—';
          node.querySelector('.stat-label').textContent = stats.furnished ? 'Furnished' : 'Not furnished';
        }
      });
    }

    syncSidebar() {
      const open = this.sidebarOpen;
      this.els.sidebar.classList.toggle('collapsed', !open);
      this.els.sidebarReopen.classList.toggle('visible', !open);
      this.app.ui.sidebarOpen = open;
      document.body.classList.toggle('sidebar-closed', !open);
    }

    setSidebarOpen(open) {
      this.sidebarOpen = !!open;
      this.syncSidebar();
      if (this.app.editor && !this.app.ui.view3d) {
        if (this.app.plan.outline && this.app.plan.outline.length >= 3) this.app.editor.fit();
        else this.app.editor.draw();
      }
    }

    openRoomSelection(roomId) {
      this.app.ui.selection = { type: 'room', id: roomId };
      this.app.ui.step = 3;
      if (!this.sidebarOpen) this.setSidebarOpen(true);
      this.renderStepper();
      this.renderToolrail();
      this.renderSidebar();
      this.updateHint();
      if (this.app.editor) this.app.editor.draw();
    }

    setViewMode(is3d) {
      document.body.classList.toggle('mode-3d', !!is3d);
      this.els.viewerWrap.classList.toggle('visible', !!is3d);
      this.els.viewerWrap.setAttribute('aria-hidden', is3d ? 'false' : 'true');
      this.renderStepper();
      this.renderToolrail();
      this.updateHint();
      if (is3d) this.syncWelcome();
    }

    setZoom(percent) {
      if (this.els.zoomValue) this.els.zoomValue.textContent = Math.round(percent) + '%';
    }

    updateHint() {
      if (!this.els.statusHint) return;
      const ui = this.app.ui;
      const plan = this.app.plan;
      const tool = ui.tool;
      let html = '';
      const k = (txt) => `<kbd>${txt}</kbd>`;
      if (ui.view3d) {
        if (ui.selection && ui.selection.type === 'furniture') {
          html = `${k('Drag')} move furniture &nbsp;·&nbsp; ${k('Drag handle')} or ${k('R')} rotate &nbsp;·&nbsp; ${k('Alt')} free move &nbsp;·&nbsp; ${k('Del')} delete`;
        } else {
          html = `${k('Click')} select furniture &nbsp;·&nbsp; ${k('Drag')} orbit &nbsp;·&nbsp; ${k('Right-drag')} pan &nbsp;·&nbsp; ${k('Scroll')} zoom`;
        }
      } else if (this.app.editor && this.app.editor.lengthBuffer) {
        const ex = FC.isImperial && FC.isImperial(plan) ? `e.g. 12'6" or 14` : `e.g. 4.2`;
        html = `${k('Type')} a dimension (${ex}), then ${k('Enter')} to place it`;
      } else if (tool === 'rect') {
        html = `${k('Click & drag')} or click two corners to draw a 4-wall room box &nbsp;·&nbsp; or type ${k('W×D')} + ${k('Enter')}`;
      } else if (tool === 'measure') {
        html = `${k('Click')} two points to measure distance, ΔX, ΔY, and angle &nbsp;·&nbsp; ${k('Esc')} to clear`;
      } else if (tool === 'outline') {
        if (ui.drawingFresh) {
          if (!plan.outline.length) html = `${k('Click')} to place the first corner of the apartment (or press ${k('B')} for Room Box)`;
          else html = `${k('Click')} corners &nbsp;·&nbsp; ${k('Enter')} to close &nbsp;·&nbsp; ${k('Esc')} to cancel &nbsp;·&nbsp; type a length`;
        } else if (plan.outline.length >= 3) {
          html = `${k('Drag')} a corner or wall to adjust &nbsp;·&nbsp; ${k('Double-click')} wall to insert corner &nbsp;·&nbsp; ${k('Del')} removes corner`;
        } else {
          html = `${k('Click')} to place the first corner of the apartment`;
        }
      } else if (tool === 'wall') {
        if (this.app.editor && this.app.editor.wallChain) html = `${k('Click')} next corner &nbsp;·&nbsp; ${k('Enter')} to finish &nbsp;·&nbsp; ${k('Esc')} to end`;
        else html = `${k('Click')} to start an interior wall — keep clicking to chain walls (or ${k('B')} for Box)`;
      } else if (tool === 'room') {
        html = `${k('Click')} a room to choose its type`;
      } else if (tool === 'door') {
        html = `${k('Click')} any wall to place a door`;
      } else if (tool === 'window') {
        html = `${k('Click')} an exterior or interior wall to place a window`;
      } else if (tool === 'opening') {
        html = `${k('Click')} a wall to cut an open passage`;
      } else if (tool === 'pan') {
        html = `${k('Drag')} to pan &nbsp;·&nbsp; ${k('Scroll')} to zoom`;
      } else {
        const sel = ui.selection;
        if (sel) html = `${k('Drag')} handles to edit &nbsp;·&nbsp; ${k('Ctrl+D')} duplicate &nbsp;·&nbsp; ${k('Delete')} removes &nbsp;·&nbsp; ${k('Esc')} deselect`;
        else html = `${k('Select')} a wall, door or furniture &nbsp;·&nbsp; ${k('Shift+Drag')} box select &nbsp;·&nbsp; ${k('B')} room box &nbsp;·&nbsp; ${k('M')} measure`;
      }
      this.els.statusHint.innerHTML = html;
    }

    syncWelcome() {
      const show = !this.app.ui.view3d && !this.planHasOutline() && !this.welcomeDismissed;
      this.els.welcome.classList.toggle('hidden', !show);
    }

    planHasOutline() {
      return this.app.plan.outline && this.app.plan.outline.length >= 3;
    }

    hideWelcome() {
      this.welcomeDismissed = true;
      this.els.welcome.classList.add('hidden');
    }

    resetWelcome() {
      this.welcomeDismissed = false;
      this.syncWelcome();
    }

    show3DLoading(show) {
      this.els.loading3d.classList.toggle('visible', !!show);
    }

    /* ---------------------------------------------------------------- */
    /* Sidebar HTML                                                      */
    /* ---------------------------------------------------------------- */

    sidebarHTML() {
      const app = this.app;
      const plan = app.plan;
      const stats = app.stats();
      const step = app.ui.step;
      const is3d = app.ui.view3d;
      const furnished = stats.furnished;
      const selectionHTML = this.selectionHTML();
      const stepHTML = this.stepHTML(step);
      const design = this.designHTML();
      const isViewStep = step === 6 || step === 7;

      return `
        <div class="side-head">
          <div><div class="eyebrow">Overview</div></div>
          <button class="icon-btn soft" data-action="toggle-sidebar" title="Collapse panel">
            ${I('panel')}
          </button>
        </div>
        <div class="stat-grid">
          ${this.stat('area', FC.formatAreaValue ? FC.formatAreaValue(stats.area, plan, 1) : stats.area.toFixed(1), FC.areaUnitLabel ? FC.areaUnitLabel(plan) : 'm²', 'Floor area')}
          ${this.stat('rooms', String(stats.rooms), '', 'Rooms')}
          ${this.stat('doors', String(stats.doors), '', 'Doors')}
          ${this.stat('furnished', furnished ? 'Yes' : '—', '', furnished ? 'Furnished' : 'Not furnished')}
        </div>
        ${is3d ? '' : `<div class="tips">
          ${this.tipsHTML(step, is3d)}
        </div>`}

        ${selectionHTML}

        ${stepHTML}

        ${isViewStep ? this.view3DHTML() : ''}

        ${this.designHTML ? design : ''}

        <div class="sidebar-actions">
          ${is3d
            ? `<button class="btn primary wide" data-action="exit3d">${I('chevron-left')} Back to plan</button>
               <button class="btn secondary wide" data-action="screenshot">${I('camera')} Save 3D image</button>`
            : `<button class="btn primary wide glow" data-action="generate">${I('sparkles')} ${furnished ? 'Regenerate interior' : 'Generate interior'}</button>
               <button class="btn secondary wide" data-action="enter3d">${I('cube')} Make it 3D</button>`}
        </div>
      `;
    }

    stat(key, value, unit, label) {
      return `<div class="stat" data-stat="${key}">
        <div class="stat-value">${value}${unit ? `<span>${unit}</span>` : ''}</div>
        <div class="stat-label">${label}</div>
      </div>`;
    }

    tipsHTML(step, is3d) {
      let tips;
      if (is3d) {
        tips = [
          { icon: 'rotate3d', text: 'Drag to orbit. Right-drag to pan, scroll to zoom.' },
          { icon: 'sun', text: 'Scrub the time of day to relight the rooms.' },
          { icon: 'eye', text: 'Use X-ray to see through the walls.' },
        ];
      } else if (step === 1) {
        tips = [
          { icon: 'home', text: 'Click corners to draw the outer boundary, then close it.' },
          { icon: 'wall', text: 'Split it with inner walls to create rooms.' },
          { icon: 'door', text: 'Drop doors and windows, then generate the interior.' },
        ];
      } else if (step === 2) {
        tips = [
          { icon: 'wall', text: 'Click a start point, then keep clicking to chain walls.' },
          { icon: 'expand', text: 'Endpoints snap to corners and existing walls.' },
          { icon: 'ruler', text: 'Type a length and press Enter for exact walls.' },
        ];
      } else if (step === 3) {
        tips = [
          { icon: 'layout', text: 'Rooms are detected automatically from closed walls.' },
          { icon: 'cursor', text: 'Pick a room, then choose its type on the right.' },
          { icon: 'sofa', text: 'The type guides the furniture that gets generated.' },
        ];
      } else if (step === 4) {
        tips = [
          { icon: 'door', text: 'Click a wall to drop a door — drag it to reposition.' },
          { icon: 'window', text: 'Windows use their own sill and head heights.' },
          { icon: 'ruler', text: 'Every opening is individually editable.' },
        ];
      } else if (step === 5) {
        tips = [
          { icon: 'palette', text: 'Pick a style to tint floors, walls and furniture.' },
          { icon: 'sparkles', text: 'Furniture is placed room by room, based on type.' },
          { icon: 'cube', text: 'Make it 3D to walk around your finished home.' },
        ];
      } else {
        tips = [
          { icon: 'cube', text: 'Use the view controls to frame your model.' },
          { icon: 'sun', text: 'Golden hour makes the materials sing.' },
          { icon: 'camera', text: 'Save a 3D image from the panel.' },
        ];
      }
      return tips.map((t) => `<div class="tip">${I(t.icon)}<span>${t.text}</span></div>`).join('');
    }

    selectionHTML() {
      const sel = this.app.ui.selection;
      if (!sel) return '';
      const plan = this.app.plan;
      const fmtLen = (v) => (FC.formatLength ? FC.formatLength(v, plan) : FC.fmt(v, 2) + ' m');
      const fmtLenShort = (v, d = 2) => (FC.formatLengthShort ? FC.formatLengthShort(v, plan, d) : FC.fmt(v, d));
      const fmtThick = (v) => (FC.formatThickness ? FC.formatThickness(v, plan) : Math.round(v * 100) + ' cm');
      const fmtInput = (v, opts) => (FC.formatInputLength ? FC.formatInputLength(v, plan, opts) : FC.fmt(v, 2));
      const inUnit = (opts) => (FC.inputUnitLabel ? FC.inputUnitLabel(plan, opts) : 'm');
      const lenUnit = FC.lengthUnitLabel ? FC.lengthUnitLabel(plan) : 'm';
      const areaUnit = FC.areaUnitLabel ? FC.areaUnitLabel(plan) : 'm²';
      const isImp = FC.isImperial && FC.isImperial(plan);
      const hasClip = !!(this.app.hasClipboard && this.app.hasClipboard());

      if (sel.type === 'walls') {
        const count = (sel.keys || []).length;
        const furnCount = (sel.furnitureIds || []).length;
        const lightCount = (sel.lightIds || []).length;
        const extraParts = furnCount + lightCount;
        const allSegs = FC.getSegments(plan);
        const selectedSegs = (sel.keys || []).map((k) => allSegs.find((s) => s.key === k)).filter(Boolean);
        const totalLen = selectedSegs.reduce((sum, s) => sum + s.len, 0);
        const titleText = extraParts > 0 ? `${count} walls + ${extraParts} items` : `${count} walls selected`;
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Multi-selection</span><div class="sel-title">${titleText}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${count}</b><span>walls selected</span></div>
            <div><b>${fmtLen(totalLen)}</b><span>total length</span></div>
          </div>
          <div class="btn-row two" style="margin-top:10px;">
            <button class="btn primary sm" data-action="connect-selected-walls">${I('link')} Connect walls</button>
            <button class="btn soft sm" data-action="merge-selected-walls">${I('merge')} Merge walls</button>
          </div>
          <div class="btn-row two" style="margin-top:6px;">
            <button class="btn soft sm" data-action="copy-selection" title="Copy selected parts (Ctrl+C) to paste here or in another floorplan">${I('copy')} Copy parts</button>
            <button class="btn soft sm" data-action="duplicate-selection" title="Duplicate in this plan (Ctrl+D)">${I('plus')} Duplicate</button>
          </div>
          ${hasClip ? `<button class="btn soft sm" style="width:100%;margin-top:6px;" data-action="paste-selection">${I('layers')} Paste copied parts</button>` : ''}
          <div class="sel-help" style="margin-top:8px;">Drag any selected wall to move the group together. Copy (<kbd>Ctrl+C</kbd>) and switch projects to paste (<kbd>Ctrl+V</kbd>) into another floorplan.</div>
          <button class="danger-link" data-action="delete-selection" style="margin-top:8px;">${I('trash')} Delete selected parts</button>
        </div>`;
      }
      if (sel.type === 'junction') {
        const j = sel.junction;
        const refCount = (j.refs || []).length;
        const outlineRef = (j.refs || []).find((r) => r.type === 'outline');
        const canDeleteCorner = outlineRef && plan.outline && plan.outline.length > 3;
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${outlineRef ? 'Outline Corner / Junction' : 'Wall Junction'}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${refCount}</b><span>connected walls</span></div>
            <div><b>${fmtLenShort(j.x, 2)}, ${fmtLenShort(j.y, 2)}</b><span>position (x, y)</span></div>
          </div>
          <div class="sel-help">Drag this junction handle directly on the canvas to slide all connected walls and doors together.</div>
          ${canDeleteCorner ? `<button class="danger-link" style="margin-top:8px;" data-action="delete-outline-corner" data-index="${outlineRef.index}">${I('trash')} Delete outline corner</button>` : ''}
        </div>`;
      }
      if (sel.type === 'wall') {
        const seg = FC.getSegments(plan).find((s) => s.key === sel.key);
        if (!seg) return '';
        const angle = Math.round(((seg.angle * 180) / Math.PI + 360) % 360);
        const parallelCandidate = !seg.boundary && seg.id && FC.findParallelWall ? FC.findParallelWall(plan, seg.id) : null;
        const clip = this.app.getClipboard ? this.app.getClipboard() : null;
        const canPasteOp = clip && clip.type === 'opening';
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${seg.boundary ? 'Exterior wall' : 'Interior wall'}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics">
            <div><b>${fmtLen(seg.len)}</b><span>length</span></div>
            <div><b>${fmtThick(seg.thickness)}</b><span>thickness</span></div>
            <div><b>${angle}°</b><span>bearing</span></div>
          </div>
          ${parallelCandidate ? `<div class="tip" style="margin-top:8px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.28);border-radius:8px;padding:8px 10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <div>
                <b style="color:var(--ink-1);display:block;font-size:12px;">Parallel line detected</b>
                <span style="font-size:11px;color:var(--ink-3);">${fmtThick(parallelCandidate.thicknessCm / 100)} separation (double wall)</span>
              </div>
              <button class="btn primary sm" data-action="merge-parallel-wall" data-wall="${seg.id}" data-target="${parallelCandidate.wall.id}">Merge into 1</button>
            </div>
          </div>` : ''}
          ${!seg.boundary ? `<div class="field" style="margin-top:10px;">
            <label class="num-field"><span>Resize length</span><span class="num-wrap"><input type="text" inputmode="text" data-wall-len="${seg.id}" data-min="0.5" data-max="30" data-step="0.05" value="${fmtInput(seg.len)}"><em>${inUnit()}</em></span></label>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;gap:6px;">
            <span style="font-size:11px;color:var(--ink-3);">Fixed anchor</span>
            <select data-action="set-wall-anchor" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--ink-1);">
              <option value="0" ${ (this.app.wallAnchorEnd !== undefined ? this.app.wallAnchorEnd : 0) === 0 ? 'selected' : '' }>End A (Start fixed)</option>
              <option value="1" ${ (this.app.wallAnchorEnd !== undefined ? this.app.wallAnchorEnd : 0) === 1 ? 'selected' : '' }>End B (Finish fixed)</option>
              <option value="2" ${ (this.app.wallAnchorEnd !== undefined ? this.app.wallAnchorEnd : 0) === 2 ? 'selected' : '' }>Center</option>
            </select>
          </div>
          <div class="btn-row" style="margin-top:6px; display:flex; gap:6px;">
            <button class="btn soft sm" style="flex:1" data-action="wall-lengthen" data-delta="${isImp ? '0.3048' : '0.5'}" data-wall="${seg.id}">${isImp ? "+1'" : '+0.5 m'}</button>
            <button class="btn soft sm" style="flex:1" data-action="wall-lengthen" data-delta="${isImp ? '0.9144' : '1.0'}" data-wall="${seg.id}">${isImp ? "+3'" : '+1.0 m'}</button>
            <button class="btn soft sm" style="flex:1.5" data-action="wall-extend-ray" data-wall="${seg.id}" title="Extend wall along its direction to intersect the nearest wall">${I('expand')} Extend to wall</button>
          </div>` : ''}
          <div class="btn-row two" style="margin-top:8px;">
            <button class="btn soft sm" data-action="wall-add-door" data-wall="${seg.key}">${I('door')} Add door</button>
            <button class="btn soft sm" data-action="wall-add-window" data-wall="${seg.key}">${I('window')} Add window</button>
          </div>
          ${canPasteOp ? `<button class="btn primary sm" style="width:100%;margin-top:6px;" data-action="paste-selection" data-wall="${seg.key}">${I('copy')} Paste copied ${FC.openingLabel(clip.opening).toLowerCase()} on this wall</button>` : ''}
          ${seg.boundary
            ? `<div class="btn-row two" style="margin-top:8px;">
                <button class="btn primary sm" data-action="insert-outline-corner" data-seg-index="${seg.index}">${I('plus')} Insert corner</button>
                <button class="btn soft sm" data-action="copy-selection" title="Copy wall & openings (Ctrl+C)">${I('copy')} Copy wall</button>
              </div>`
            : `<div class="btn-row two" style="margin-top:6px;">
                <button class="btn soft sm" data-action="wall-connect-mode" data-wall="${seg.id}" title="Click another wall to connect with this one">${I('link')} Connect wall...</button>
                <button class="btn soft sm" data-action="wall-connect-nearest" data-wall="${seg.id}" title="Snap and join with the closest wall or corner">${I('sparkles')} Connect nearest</button>
              </div>
              <button class="btn soft sm" style="margin-top:6px;width:100%" data-action="toggle-wall-virtual" data-wall="${seg.id}">${seg.wall && seg.wall.virtual ? `${I('wall')} Convert to solid wall` : `${I('divider')} Convert to room divider (virtual)`}</button>
              <div class="btn-row" style="margin-top:6px; display:flex; gap:6px;">
                <button class="btn soft sm" style="flex:1" data-action="wall-split" data-wall="${seg.id}">${I('sliders')} Split</button>
                <button class="btn soft sm" style="flex:1" data-action="copy-selection" title="Copy wall & openings (Ctrl+C)">${I('copy')} Copy</button>
                <button class="btn soft sm" style="flex:1" data-action="duplicate-selection" title="Duplicate wall (Ctrl+D)">${I('plus')} Duplicate</button>
              </div>`}
          <div class="sel-help" style="margin-top:8px;">${seg.boundary ? 'Drag this exterior wall to push/pull it orthogonally, or double-click on it to insert a new corner.' : 'Drag orange handles on wall tips to extend length (doors stay fixed). Drag wall body to slide with magnetic snap.'}</div>
          ${!seg.boundary ? `<button class="danger-link" data-action="delete-selection">${I('trash')} Delete wall</button>` : ''}
        </div>`;
      }
      if (sel.type === 'vertex') {
        const p = plan.outline[sel.index];
        if (!p) return '';
        const canDelete = plan.outline && plan.outline.length > 3;
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">Outline corner</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${fmtLenShort(p.x, 2)}</b><span>x · ${lenUnit}</span></div>
            <div><b>${fmtLenShort(p.y, 2)}</b><span>y · ${lenUnit}</span></div>
          </div>
          <div class="sel-help">Drag the corner to reshape the footprint. Openings follow their walls.</div>
          ${canDelete ? `<button class="danger-link" style="margin-top:8px;" data-action="delete-outline-corner" data-index="${sel.index}">${I('trash')} Delete corner</button>` : ''}
        </div>`;
      }
      if (sel.type === 'opening') {
        const op = plan.openings.find((o) => o.id === sel.id);
        if (!op) return '';
        const label = FC.openingLabel(op);
        const seg = FC.segmentByKey(plan, op.hostKey);
        const distA = seg ? Math.max(0, op.offset - op.width / 2) : 0;
        const distB = seg ? Math.max(0, seg.len - (op.offset + op.width / 2)) : 0;
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title" data-op-title>${label} (${fmtLen(op.width)})</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="num-grid">
            ${this.numField('Width', 'opWidth', 'width', op.width, 0.4, 4, 0.05)}
            ${this.numField('Height', 'opHeight', 'height', op.height, 0.5, 3.2, 0.05)}
            ${op.kind === 'window' ? this.numField('Sill', 'opSill', 'sill', op.sill, 0, 2.2, 0.05) : ''}
          </div>
          ${seg ? `<div class="num-grid" style="margin-top:6px;">
            <label class="num-field"><span data-op-dist-a-label>From Corner A (${fmtLenShort(distA, 2)})</span><span class="num-wrap">
              <input type="text" inputmode="text" data-op-field="offsetFromA" data-min="0.03" data-max="${Math.max(0.1, seg.len - op.width - 0.03).toFixed(2)}" data-step="0.05" value="${fmtInput(distA)}"><em>${inUnit()}</em>
            </span></label>
            <label class="num-field"><span data-op-dist-b-label>From Corner B (${fmtLenShort(distB, 2)})</span><span class="num-wrap">
              <input type="text" inputmode="text" data-op-field="offsetFromB" data-min="0.03" data-max="${Math.max(0.1, seg.len - op.width - 0.03).toFixed(2)}" data-step="0.05" value="${fmtInput(distB)}"><em>${inUnit()}</em>
            </span></label>
          </div>` : ''}
          ${op.kind === 'door'
            ? `<div class="chip-row small" style="margin-top:8px;">
                ${['single', 'double', 'sliding', 'bifold'].map((s) => `<button class="chip ${op.style === s ? 'active' : ''}" data-action="door-style" data-style="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
              </div>
              <div class="btn-row" style="margin-top:8px; display:flex; gap:6px;">
                <button class="btn soft sm" style="flex:1" data-action="flip-door-swing" data-opening="${op.id}">${I('rotate3d')} Flip swing</button>
                <button class="btn soft sm" style="flex:1" data-action="flip-door-hinge" data-opening="${op.id}">${I('rotate')} Hinge (${op.hinge === 'right' ? 'R' : 'L'})</button>
              </div>`
            : ''}
          <div class="btn-row two" style="margin-top:8px;">
            <button class="btn soft sm" data-action="copy-selection" title="Copy ${label.toLowerCase()} (Ctrl+C) to paste on any wall">${I('copy')} Copy ${label.toLowerCase()}</button>
            <button class="btn soft sm" data-action="duplicate-selection" title="Duplicate ${label.toLowerCase()} (Ctrl+D)">${I('plus')} Duplicate</button>
          </div>
          <div class="sel-help" style="margin-top:8px;">${op.kind === 'window' ? `Sill <b data-op-sill>${fmtLen(op.sill)}</b> · head <b data-op-head>${fmtLen(op.sill + op.height)}</b> — both stay below the <b data-op-wall>${fmtLen(this.app.plan.settings.wallHeight)}</b> wall.` : 'Drag the opening along any wall to reposition it, or press <kbd>Ctrl+C</kbd> then <kbd>Ctrl+V</kbd> over another wall.'}</div>
          <button class="danger-link" data-action="delete-selection">${I('trash')} Delete ${label.toLowerCase()}</button>
        </div>`;
      }
      if (sel.type === 'furniture') {
        const f = (this.app.furniture || []).find((item) => item.id === sel.id);
        if (!f) return '';
        const rotDeg = Math.round((((f.rot || 0) * 180) / Math.PI + 360) % 360);
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${esc(f.name || f.kind[0].toUpperCase() + f.kind.slice(1))}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${fmtLenShort(f.w, 2)} × ${fmtLen(f.d)}</b><span>size</span></div>
            <div><b data-furniture-rot-value>${rotDeg}°</b><span>rotation</span></div>
          </div>
          <div class="field" style="margin-top:10px;">
            <div class="field-head"><span>Rotation angle</span><span class="value" data-furniture-rot-value>${rotDeg}°</span></div>
            <input type="range" data-furniture-rot="${f.id}" min="0" max="360" step="5" value="${rotDeg}">
          </div>
          <div class="btn-row" style="margin-top:10px;display:flex;gap:6px;">
            <button class="btn soft sm" style="flex:1" data-action="rotate-furniture" data-furniture="${f.id}">${I('rotate3d')} Rotate 90°</button>
            <button class="btn soft sm" style="flex:1" data-action="copy-selection">${I('copy')} Copy</button>
            <button class="btn soft sm" style="flex:1" data-action="duplicate-selection">${I('plus')} Duplicate</button>
          </div>
          <button class="btn soft sm danger" style="width:100%;margin-top:6px;" data-action="delete-selection">${I('trash')} Delete</button>
          <div class="sel-help" style="margin-top:8px;">Drag in 2D or 3D to move (snaps flush against nearby walls; hold <kbd>Alt</kbd> for free placement). Drag the rotation handle or press <kbd>R</kbd> to rotate.</div>
        </div>`;
      }
      if (sel.type === 'light') {
        const l = (this.app.plan.lights || []).find((item) => item.id === sel.id);
        if (!l) return '';
        const title = l.type === 'spot' ? 'Ceiling spotlight' : l.type === 'lamp' ? 'Floor lamp' : 'Ceiling fixture';
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${title}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="field" style="margin-top:10px;">
            <div class="field-head"><span>Brightness</span><span class="value">${Math.round((l.intensity || 1) * 100)}%</span></div>
            <input type="range" data-light-intensity="${l.id}" min="0.2" max="2.5" step="0.1" value="${l.intensity || 1}">
          </div>
          <div class="sel-metrics two" style="margin-top:8px;">
            <div><b>${fmtLenShort(l.x, 2)}, ${fmtLenShort(l.y, 2)}</b><span>pos · ${lenUnit}</span></div>
            <div><b>${fmtLen(l.z || 2.4)}</b><span>height</span></div>
          </div>
          <div class="btn-row" style="margin-top:10px;display:flex;gap:6px;">
            <button class="btn soft sm" style="flex:1" data-action="copy-selection">${I('copy')} Copy</button>
            <button class="btn soft sm" style="flex:1" data-action="duplicate-selection">${I('plus')} Duplicate</button>
            <button class="btn soft sm danger" style="flex:1" data-action="delete-selection">${I('trash')} Delete</button>
          </div>
          <div class="sel-help" style="margin-top:8px;">Drag to position this light fixture. It casts real dynamic light in 3D dollhouse mode.</div>
        </div>`;
      }
      if (sel.type === 'room') {
        const room = this.app.rooms.find((r) => r.id === sel.id);
        if (!room) return '';
        const t = FC.roomTypes[room.type] || FC.roomTypes.living;
        const isManual = this.app.plan.autoDetectRooms === false || room.isManual;
        const areaVal = FC.formatAreaValue ? FC.formatAreaValue(room.area, plan, 1) : FC.fmt(room.area, 1);
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">${isManual ? 'Manual Room (Locked)' : 'Detected Room'}</span><div class="sel-title">${esc(room.name || t.label)}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${areaVal}</b><span>floor area · ${areaUnit}</span></div>
            <div><b>${fmtLenShort(room.bounds.w, 1)} × ${fmtLen(room.bounds.d)}</b><span>room size</span></div>
          </div>
          <div class="field" style="margin-top:10px;">
            <label class="num-field"><span>Room name / label</span><span class="num-wrap"><input type="text" data-room-name="${room.id}" value="${esc(room.name || '')}" placeholder="e.g. Master Bdrm., Great Rm., Garage..."></span></label>
          </div>
          <div style="margin-top:10px;">
            <div class="micro-label" style="margin-bottom:6px;">Room type & furnishing</div>
            ${this.typeGrid(room)}
          </div>
          <div class="btn-row two" style="margin-top:10px;">
            <button class="btn soft sm" data-action="tool" data-tool="divider" title="Draw an invisible room divider to partition this space">${I('divider')} Split with divider</button>
            <button class="btn soft sm" data-action="furnish-room" data-room="${room.id}" title="Regenerate furniture layout in this room">${I('sparkles')} Regenerate room</button>
          </div>
          <div class="btn-row two" style="margin-top:6px;">
            <button class="btn soft sm" data-action="copy-selection" title="Copy room walls, doors, windows & furniture (Ctrl+C) to paste in any floorplan">${I('copy')} Copy room</button>
            <button class="btn soft sm" data-action="duplicate-selection" title="Duplicate room (Ctrl+D)">${I('plus')} Duplicate room</button>
          </div>
          <button class="btn soft sm" style="width:100%;margin-top:8px;" data-action="open-furniture-catalog" data-room="${room.id}">${I('plus')} Browse & Add Furniture</button>
          <button class="danger-link" data-action="delete-room" data-room="${room.id}">${I('trash')} Remove this room</button>
        </div>`;
      }
      return '';
    }

    typeGrid(room) {
      return `<div class="type-grid">${FC.roomTypeOrder
        .map((key) => {
          const t = FC.roomTypes[key];
          return `<button class="type-chip ${room.type === key ? 'active' : ''}" data-action="room-type" data-room="${room.id}" data-type="${key}">
            <span class="dot" style="background:${t.color}"></span>${t.label}
          </button>`;
        })
        .join('')}</div>`;
    }

    stepHTML(step) {
      if (step === 1) return this.outlineStepHTML();
      if (step === 2) return this.wallsStepHTML();
      if (step === 3) return this.roomsStepHTML();
      if (step === 4) return this.doorsStepHTML();
      if (step === 5) return this.generateStepHTML();
      if (step === 6) return this.lightingStepHTML();
      return this.threeDStepHTML();
    }

    moduleHead(eyebrow, mini) {
      return `<div class="section-head"><span class="eyebrow">${eyebrow}</span><span class="mini">${mini || ''}</span></div>`;
    }

    outlineStepHTML() {
      const plan = this.app.plan;
      const b = FC.planBounds(plan);
      const has = plan.outline.length >= 3;
      const fmtLen = (v) => (FC.formatLength ? FC.formatLength(v, plan, 1) : v.toFixed(1) + ' m');
      const fmtLenShort = (v) => (FC.formatLengthShort ? FC.formatLengthShort(v, plan, 1) : v.toFixed(1));
      const lenUnit = FC.lengthUnitLabel ? FC.lengthUnitLabel(plan) : 'm';
      let perimeter = 0;
      for (let i = 0; i < plan.outline.length; i++) {
        const a = plan.outline[i];
        const c = plan.outline[(i + 1) % plan.outline.length];
        perimeter += FC.dist(a, c);
      }
      return `<section class="panel-block">
        ${this.moduleHead('Outline', has ? 'Footprint' : 'Step 1 of 7')}
        <p class="helper">${has ? 'Drag any corner or wall to reshape the footprint. Double-click an exterior wall to add a corner.' : 'Click on the canvas to trace the outer boundary, or use Room Box (B) to drag a rectangular footprint.'}</p>
        <div class="mini-stats">
          <div><b>${has ? fmtLenShort(b.w) + ' × ' + fmtLenShort(b.d) : '—'}</b><span>span · ${lenUnit}</span></div>
          <div><b>${has ? fmtLen(perimeter) : '—'}</b><span>perimeter</span></div>
          <div><b>${has ? this.app.plan.outline.length : '0'}</b><span>corners</span></div>
        </div>
        <div class="btn-row">
          <button class="btn soft sm" data-action="${has ? 'redraw-outline' : 'start-drawing'}">${I(has ? 'pencil' : 'home')} ${has ? 'Redraw outline' : 'Trace outline'}</button>
          <button class="btn soft sm" data-action="tool" data-tool="rect" title="Draw a rectangular footprint or room box (B)">${I('box')} Room Box</button>
          ${has ? '' : `<button class="btn soft sm" data-action="load-sample">${I('layout')} Sample</button>`}
        </div>
      </section>`;
    }

    wallsStepHTML() {
      const plan = this.app.plan;
      const walls = plan.walls.length;
      const tool = this.app.ui.tool;
      const fmtThick = (v) => (FC.formatThickness ? FC.formatThickness(v, plan) : v.toFixed(2) + ' m');
      return `<section class="panel-block">
        ${this.moduleHead('Interior walls', walls + ' segment' + (walls === 1 ? '' : 's'))}
        <div class="tool-chips" style="margin-bottom:10px;">
          <button class="tool-chip ${tool === 'wall' ? 'active' : ''}" data-action="tool" data-tool="wall">${I('wall')}<span>Chain Wall (W)</span></button>
          <button class="tool-chip ${tool === 'rect' ? 'active' : ''}" data-action="tool" data-tool="rect">${I('box')}<span>Room Box (B)</span></button>
        </div>
        <p class="helper">Click a start point, then keep clicking to chain walls — or use <b>Room Box (B)</b> to draw 4 walls at once.</p>
        <div class="mini-stats">
          <div><b>${fmtThick(plan.settings.intThickness)}</b><span>inner wall</span></div>
          <div><b>${fmtThick(plan.settings.extThickness)}</b><span>outer wall</span></div>
          <div><b>${walls}</b><span>walls</span></div>
        </div>
        <div class="hint-note">${I('info')} Walls snap to corners, midpoints, and alignment guides so rooms close cleanly.</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-soft);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span class="micro-label" style="margin:0;">Double-line walls</span>
            <button class="btn soft sm" data-action="consolidate-double-walls" title="Merge all double-line CAD walls into single walls with thickness">${I('sliders')} Auto-merge</button>
          </div>
          <p class="helper tight">Convert imported parallel CAD lines into single centerline walls with thickness.</p>
        </div>
      </section>`;
    }

    roomsStepHTML() {
      const rooms = this.app.rooms || [];
      const tool = this.app.ui.tool;
      const isAuto = this.app.plan.autoDetectRooms !== false;
      const preview = this.app.detectedRoomsPreview;
      const selectedRoom = this.app.ui.selection && this.app.ui.selection.type === 'room' ? rooms.find((r) => r.id === this.app.ui.selection.id) : null;

      return `<section class="panel-block">
        ${this.moduleHead('Rooms', rooms.length + (isAuto ? ' detected' : ' assigned (manual)'))}

        <div class="room-mode-banner ${isAuto ? 'auto' : 'manual'}" style="margin-bottom:10px;">
          <div class="mode-info">
            <span class="mode-pill ${isAuto ? 'auto' : 'manual'}"><span class="pill-dot"></span>${isAuto ? 'Auto-detect: Active' : 'Manual Mode'}</span>
            <span class="mode-sub">${isAuto ? 'Rooms update on wall edits' : 'Auto-detect paused; labels locked'}</span>
          </div>
          <button class="btn ${isAuto ? 'soft' : 'primary'} xs" data-action="toggle-auto-detect" title="${isAuto ? 'Pause automatic room detection to keep manual adjustments' : 'Turn on automatic room detection from current walls'}">
            ${isAuto ? 'Pause auto' : `${I('rotate')} Auto-detect`}
          </button>
        </div>

        <div class="preview-toggle-bar" style="margin-bottom:12px;">
          <button class="btn soft sm ${preview ? 'active' : ''}" style="width:100%;justify-content:center;" data-action="toggle-room-preview" title="Show what rooms the algorithm detects from closed walls without changing your manual assignments">
            ${I('eye')} <span>${preview ? 'Hide detected preview' : 'Show detected rooms'}</span>
          </button>
        </div>

        ${preview ? `<div class="room-preview-box">
          <div class="preview-box-head">
            <div>
              <span class="eyebrow" style="color:var(--primary,#7061ff);">Detection Preview</span>
              <div class="preview-title">Found ${preview.length} room${preview.length === 1 ? '' : 's'} from walls</div>
            </div>
            <button class="icon-btn soft xs" data-action="dismiss-room-preview" title="Dismiss preview">${I('close')}</button>
          </div>
          <p class="helper tight" style="margin:4px 0 8px 0;">Algorithm suggestions displayed on canvas. Manual rooms are not overridden.</p>
          <div class="btn-row two" style="margin-bottom:8px;">
            <button class="btn primary sm" data-action="apply-detected-rooms" title="Replace current rooms with detected rooms and enable auto-detect">${I('check')} Apply All</button>
            <button class="btn soft sm" data-action="dismiss-room-preview">Dismiss</button>
          </div>
          ${preview.length ? `<div class="room-list preview-list">
            ${preview.map((cand) => {
              const t = FC.roomTypes[cand.type] || FC.roomTypes.living;
              const areaStr = FC.formatArea ? FC.formatArea(cand.area, this.app.plan, 1) : FC.fmt(cand.area, 1) + ' m²';
              return `<div class="room-row preview-row">
                <span class="room-dot" style="background:${t.color}"></span>
                <span class="room-main"><b>${esc(cand.name || t.label)}</b><span>${areaStr}</span></span>
                <button class="btn soft xs adopt-btn" data-action="adopt-detected-room" data-candidate="${cand.id}" title="Add this detected room to your manual room layout">+ Adopt</button>
              </div>`;
            }).join('')}
          </div>` : `<p class="helper tight" style="color:#ef4444;">No enclosed spaces formed by current walls.</p>`}
        </div>` : ''}

        <div class="tool-chips" style="margin-bottom:12px;">
          <button class="tool-chip ${tool === 'room' ? 'active' : ''}" data-action="tool" data-tool="room" title="Click corners on canvas to manually trace a custom room polygon">${I('layout')}<span>Draw room</span></button>
          <button class="tool-chip ${tool === 'divider' ? 'active' : ''}" data-action="tool" data-tool="divider" title="Draw an invisible partition line to separate open-concept spaces">${I('divider')}<span>Room divider</span></button>
        </div>
        <p class="helper tight">Rooms can be auto-detected or manually adjusted. Use <b>Draw room</b> to trace custom spaces, or <b>Room divider</b> to partition open-concept spaces.</p>
        ${rooms.length ? `<div class="room-list" style="margin-top:10px;">
          ${rooms
            .map((r) => {
              const t = FC.roomTypes[r.type] || FC.roomTypes.living;
              const active = selectedRoom && selectedRoom.id === r.id;
              const areaStr = FC.formatArea ? FC.formatArea(r.area, this.app.plan, 1) : FC.fmt(r.area, 1) + ' m²';
              return `<div class="room-row ${active ? 'active' : ''}" data-action="focus-room" data-room="${r.id}" style="cursor:pointer;">
                <span class="room-dot" style="background:${t.color}"></span>
                <span class="room-main"><b>${esc(r.name || t.label)}</b><span>${areaStr}</span></span>
                <span class="room-kind">${t.label.replace(' room', '')}</span>
                <button class="icon-btn soft xs" data-action="furnish-room" data-room="${r.id}" title="Regenerate ${esc(r.name || t.label)} interior">${I('refresh')}</button>
              </div>`;
            })
            .join('')}
        </div>` : `<p class="helper" style="margin-top:10px;">No enclosed rooms yet. Draw walls or click <b>Draw room</b> above to define spaces.</p>`}
        ${selectedRoom ? `<div class="room-types" style="margin-top:12px;">
          <div class="micro-label" style="margin-bottom:6px;">Type: ${esc(selectedRoom.name || 'Room')}</div>
          ${this.typeGrid(selectedRoom)}
        </div>` : `<p class="helper tight" style="margin-top:10px;">Click any room on canvas or in list above to rename, assign type, or partition.</p>`}
      </section>`;
    }

    doorsStepHTML() {
      const tool = this.app.ui.tool;
      const plan = this.app.plan;
      const doors = plan.openings.filter((o) => o.kind === 'door').length;
      const windows = plan.openings.filter((o) => o.kind === 'window').length;
      const fmtLen = (v) => (FC.formatLength ? FC.formatLength(v, plan) : v.toFixed(2) + ' m');
      const clip = this.app.getClipboard ? this.app.getClipboard() : null;
      const copiedOp = clip && clip.type === 'opening' ? clip.opening : null;
      return `<section class="panel-block">
        ${this.moduleHead('Openings', doors + ' doors · ' + windows + ' windows')}
        <div class="tool-chips">
          <button class="tool-chip ${tool === 'door' ? 'active' : ''}" data-action="tool" data-tool="door">${I('door')}<span>Door</span></button>
          <button class="tool-chip ${tool === 'window' ? 'active' : ''}" data-action="tool" data-tool="window">${I('window')}<span>Window</span></button>
          <button class="tool-chip ${tool === 'opening' ? 'active' : ''}" data-action="tool" data-tool="opening">${I('expand')}<span>Passage</span></button>
        </div>
        <p class="helper tight">${tool === 'window' ? 'Click a wall to place a window. Sill and head heights are configurable below.' : tool === 'opening' ? 'Click a wall to cut an open archway between two spaces.' : 'Click a wall to place a door. Drag it along the wall to slide it.'}</p>
        ${tool === 'window'
          ? `<div class="num-grid">${this.numField('Width', null, 'windowWidth', plan.settings.windowWidth, 0.6, 4, 0.05)}${this.numField('Sill', null, 'windowSill', plan.settings.windowSill, 0, 2.2, 0.05)}${this.numField('Height', null, 'windowHeight', plan.settings.windowHeight, 0.3, 2.6, 0.05)}</div>
             <div class="hint-note small">${I('info')} Sill <b data-window-sill>${fmtLen(plan.settings.windowSill)}</b> → head <b data-window-head>${fmtLen(plan.settings.windowSill + plan.settings.windowHeight)}</b>.</div>`
          : tool === 'opening'
            ? ''
            : `<div class="num-grid">${this.numField('Width', null, 'doorWidth', plan.settings.doorWidth, 0.6, 2.4, 0.05)}${this.numField('Height', null, 'doorHeight', plan.settings.doorHeight, 1.8, 3, 0.05)}</div>`}
        ${copiedOp ? `<button class="btn soft sm" style="width:100%;margin-top:8px;" data-action="paste-selection" title="Paste copied ${FC.openingLabel(copiedOp).toLowerCase()} (Ctrl+V)">${I('copy')} Paste copied ${FC.openingLabel(copiedOp).toLowerCase()} (${fmtLen(copiedOp.width)})</button>` : ''}
      </section>`;
    }

    generateStepHTML() {
      const plan = this.app.plan;
      const rooms = this.app.rooms || [];
      const count = FC.furnitureCount(this.app.furniture);
      return `<section class="panel-block">
        ${this.moduleHead('Interior', plan.furnished ? count + ' pieces placed' : 'Not furnished')}
        <p class="helper">${plan.furnished ? 'Furniture is generated per room type. Change a room type or wall layout and it reflows automatically, or regenerate individual rooms below.' : 'Choose a style, then generate a furnished interior tailored to each room.'}</p>
        <div class="density-row">
          <div class="field-head"><span>Furnishing level</span><span class="value" data-density-value>${plan.density < 0.8 ? 'Essential' : plan.density > 1.15 ? 'Rich' : 'Comfort'}</span></div>
          <input type="range" data-density min="0.5" max="1.5" step="0.05" value="${plan.density}">
        </div>
        ${rooms.length ? `<div style="margin-top:12px;">
          <div class="micro-label" style="margin-bottom:6px;">Regenerate single room</div>
          <div class="room-list">
            ${rooms
              .map((r) => {
                const t = FC.roomTypes[r.type] || FC.roomTypes.living;
                const rPieces = (this.app.furniture || []).filter((f) => f.roomId === r.id).length;
                return `<div class="room-row" data-action="focus-room" data-room="${r.id}" style="cursor:pointer;">
                  <span class="room-dot" style="background:${t.color}"></span>
                  <span class="room-main"><b>${esc(r.name || t.label)}</b><span>${rPieces} piece${rPieces === 1 ? '' : 's'}</span></span>
                  <button class="btn soft xs" data-action="furnish-room" data-room="${r.id}" title="Regenerate ${esc(r.name || t.label)} interior">${I('refresh')} Regenerate</button>
                </div>`;
              })
              .join('')}
          </div>
        </div>` : ''}
        <button class="btn soft sm" style="width:100%;margin-top:12px;" data-action="open-furniture-catalog">${I('plus')} Browse & Add Furniture</button>
        ${plan.furnished ? `<button class="danger-link subtle" data-action="clear-furniture" style="margin-top:10px;">${I('trash')} Clear furniture</button>` : ''}
      </section>`;
    }

    lightingStepHTML() {
      const lights = this.app.plan.lights || [];
      return `<section class="panel-block">
        ${this.moduleHead('Lighting & Sun', lights.length + ' fixtures placed')}
        <p class="helper">Add interior lights or dial in the sun. Position lights in 2D or 3D dollhouse mode.</p>
        <div class="btn-row two" style="margin-bottom:12px;">
          <button class="btn soft sm" data-action="add-light" data-light-type="ceiling">${I('sun')} + Ceiling Light</button>
          <button class="btn soft sm" data-action="add-light" data-light-type="lamp">${I('sun')} + Floor Lamp</button>
        </div>
        <button class="btn soft sm" style="width:100%;margin-bottom:14px;" data-action="add-light" data-light-type="spot">${I('sun')} + Spot Light</button>
        ${this.sunControlHTML()}
      </section>`;
    }

    threeDStepHTML() {
      return `<section class="panel-block">
        ${this.moduleHead('3D view', 'Dollhouse')}
        <p class="helper">Your plan is extruded with real openings. Orbit around, peek through the walls, or close the ceiling.</p>
        ${this.viewTogglesHTML()}
        <div class="btn-row two">
          <button class="btn soft sm" data-action="camera-fit">${I('expand')} Fit</button>
          <button class="btn soft sm" data-action="camera-top">${I('grid')} Top view</button>
        </div>
        <div class="btn-row two" style="margin-top:10px;">
          <button class="btn primary sm" data-action="export-glb">${I('download')} Export .glb</button>
          <button class="btn soft sm" data-action="export-dwg">${I('download')} Export CAD</button>
        </div>
        ${this.sunControlHTML()}
      </section>`;
    }

    sunControlHTML() {
      const t = this.app.plan.view.sunTime;
      const hh = Math.floor(t);
      const mm = Math.round((t - hh) * 60);
      return `<div class="sun-block">
        <div class="field-head"><span>Time of day</span><span class="value" data-sun-value>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</span></div>
        <input type="range" data-sun min="5" max="23" step="0.5" value="${t}">
        <div class="preset-row">
          <button class="chip" data-action="sun-preset" data-hour="8">Morning</button>
          <button class="chip" data-action="sun-preset" data-hour="13">Noon</button>
          <button class="chip" data-action="sun-preset" data-hour="18">Golden</button>
          <button class="chip" data-action="sun-preset" data-hour="22">Night</button>
        </div>
      </div>`;
    }

    viewTogglesHTML() {
      const v = this.app.plan.view;
      const s = this.app.plan.settings;
      return `<div class="toggle-list">
        ${this.toggleRow('toggle-xray', 'X-ray walls', 'eye', !!v.xray)}
        ${this.toggleRow('toggle-ceiling', 'Ceiling', 'ceiling', !!v.ceiling)}
        ${this.toggleRow('toggle-furniture', 'Furniture', 'sofa', !!this.app.plan.furnished)}
        ${this.toggleRow('toggle-autorotate', 'Turntable', 'rotate3d', !!v.autoRotate)}
        ${this.toggleRow('toggle-invert-pitch', 'Flip vertical mouse look', 'rotate', s.invertPitch ?? true)}
      </div>`;
    }

    view3DHTML() {
      const plan = this.app.plan;
      const s = plan.settings;
      const style = FC.styles[plan.style] || FC.styles.scandinavian;
      const windows = plan.openings.filter((o) => o.kind === 'window').length;
      const pieces = FC.furnitureCount(this.app.furniture || []);
      const fmtLen = (v) => (FC.formatLength ? FC.formatLength(v, plan) : FC.fmt(v, 2) + ' m');
      return `<section class="panel-block model-block">
        ${this.moduleHead('The model', 'Live')}
        <div class="model-summary">
          <span class="model-swatch">${style.swatches.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
          <div class="model-copy">
            <b>${style.name}</b>
            <span>${plan.furnished ? pieces + ' pieces · ' : 'Unfurnished · '}${fmtLen(s.wallHeight)} walls</span>
          </div>
        </div>
        <div class="mini-stats">
          <div><b>${fmtLen(s.wallHeight)}</b><span>ceiling</span></div>
          <div><b>${fmtLen(s.doorHeight)}</b><span>door</span></div>
          <div><b>${windows}</b><span>windows</span></div>
        </div>
      </section>`;
    }

    toggleRow(action, label, icon, on) {
      return `<button class="toggle-row" data-action="${action}">
        <span class="toggle-label">${I(icon)} ${label}</span>
        <span class="switch ${on ? 'on' : ''}"></span>
      </button>`;
    }

    designHTML() {
      const plan = this.app.plan;
      const s = plan.settings;
      const isImp = FC.isImperial && FC.isImperial(plan);
      const wallHeightStr = FC.formatLength ? FC.formatLength(s.wallHeight, plan) : s.wallHeight.toFixed(2) + ' m';
      const gridStepLabel = isImp ? '6 in' : '0.1 m';
      return `<section class="panel-block design-block">
        <div class="section-head"><span class="eyebrow">Design</span><span class="mini">Units, walls & style</span></div>
        <div class="field" style="margin-bottom:10px;">
          <div class="field-head"><span>Measurement units</span><span class="value">${isImp ? 'Imperial (ft / in)' : 'Metric (m / cm)'}</span></div>
          <div class="chip-row small" style="margin-top:4px;">
            <button class="chip ${!isImp ? 'active' : ''}" style="flex:1;justify-content:center;" data-action="set-units" data-units="m">Meters (m)</button>
            <button class="chip ${isImp ? 'active' : ''}" style="flex:1;justify-content:center;" data-action="set-units" data-units="ft">Feet &amp; Inches (ft' in")</button>
          </div>
        </div>
        <div class="field">
          <div class="field-head"><span>Wall height</span><span class="value" data-setting-value="wallHeight">${wallHeightStr}</span></div>
          <input type="range" data-setting="wallHeight" min="2.2" max="4.2" step="0.05" value="${s.wallHeight}">
        </div>
        <div class="styles-grid">
          ${FC.styleOrder
            .map((key) => {
              const st = FC.styles[key];
              return `<button class="style-card ${plan.style === key ? 'active' : ''}" data-action="style" data-style="${key}">
                <span class="swatches">${st.swatches.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
                <span class="style-name">${st.name}</span>
              </button>`;
            })
            .join('')}
        </div>
        <div class="toggle-list" style="margin-top:10px;">
          ${this.toggleRow('toggle-grid', `Snap to grid (${gridStepLabel})`, 'grid', s.snapGrid !== false)}
          ${this.toggleRow('toggle-ortho', 'Straight wall snap (0°, 90°, 45°)', 'ortho', s.snapAngle !== false)}
        </div>
        <details class="structure" ${this.structureOpen ? 'open' : ''}>
          <summary><span>${I('sliders')} Structure & openings</span>${I('chevron-down', 'chev')}</summary>
          <div class="adv-grid">
            ${this.structField('Exterior wall', 'extThickness', s.extThickness, 0.08, 0.5, 0.01, true)}
            ${this.structField('Interior wall', 'intThickness', s.intThickness, 0.08, 0.4, 0.01, true)}
            ${this.structField('Floor slab', 'slabThickness', s.slabThickness, 0.08, 0.5, 0.01, true)}
            ${this.structField('Door height', 'doorHeight', s.doorHeight, 1.8, 3, 0.05, false)}
            ${this.structField('Door width', 'doorWidth', s.doorWidth, 0.6, 2.4, 0.05, false)}
            ${this.structField('Window sill', 'windowSill', s.windowSill, 0, 2.2, 0.05, false)}
            ${this.structField('Window height', 'windowHeight', s.windowHeight, 0.3, 2.6, 0.05, false)}
            ${this.structField('Window width', 'windowWidth', s.windowWidth, 0.6, 4, 0.05, false)}
          </div>
          <div class="hint-note small">${I('info')} Openings are clamped to stay below the wall height.</div>
        </details>
      </section>`;
    }

    structField(label, key, value, min, max, step, isThickness) {
      const plan = this.app.plan;
      const opts = isThickness ? { thickness: true } : undefined;
      const valStr = FC.formatInputLength ? FC.formatInputLength(value, plan, opts) : FC.fmt(value, 2);
      const unitStr = FC.inputUnitLabel ? FC.inputUnitLabel(plan, opts) : 'm';
      const unitAttr = isThickness ? 'data-unit-type="thickness"' : '';
      return `<label class="num-field"><span>${label}</span><span class="num-wrap"><input type="text" inputmode="text" data-setting="${key}" ${unitAttr} data-min="${min}" data-max="${max}" data-step="${step}" value="${valStr}"><em>${unitStr}</em></span></label>`;
    }

    numField(label, suffix, key, value, min, max, step) {
      const plan = this.app.plan;
      const settingKey = suffix ? null : key;
      const opField = suffix ? String(suffix).replace(/^op/i, '').toLowerCase() || key : null;
      const attrs = opField
        ? `data-op-field="${opField}"`
        : `data-setting="${settingKey}"`;
      const valStr = FC.formatInputLength ? FC.formatInputLength(value, plan) : FC.fmt(value, 2);
      const unitStr = FC.inputUnitLabel ? FC.inputUnitLabel(plan) : 'm';
      return `<label class="num-field"><span>${label}</span><span class="num-wrap">
        <input type="text" inputmode="text" ${attrs} data-min="${min}" data-max="${max}" data-step="${step}" value="${valStr}"><em>${unitStr}</em>
      </span></label>`;
    }

    paintRanges(root) {
      (root || document).querySelectorAll('input[type="range"]').forEach((el) => {
        const min = parseFloat(el.min) || 0;
        const max = parseFloat(el.max) || 100;
        const v = parseFloat(el.value) || 0;
        const pct = FC.clamp(((v - min) / (max - min)) * 100, 0, 100);
        el.style.setProperty('--pct', pct + '%');
      });
    }

    syncWindowReadouts() {
      const plan = this.app.plan;
      const s = plan.settings;
      const fmtLen = (v) => (FC.formatLength ? FC.formatLength(v, plan) : v.toFixed(2) + ' m');
      const fmtLenShort = (v, d = 2) => (FC.formatLengthShort ? FC.formatLengthShort(v, plan, d) : FC.fmt(v, d));
      const fmtInput = (v, opts) => (FC.formatInputLength ? FC.formatInputLength(v, plan, opts) : FC.fmt(v, 2));
      document.querySelectorAll('[data-window-sill]').forEach((n) => (n.textContent = fmtLen(s.windowSill)));
      document.querySelectorAll('[data-window-head]').forEach((n) => (n.textContent = fmtLen(s.windowSill + s.windowHeight)));
      document.querySelectorAll('[data-op-wall]').forEach((n) => (n.textContent = fmtLen(s.wallHeight)));
      const sel = this.app.ui.selection;
      if (sel && sel.type === 'opening') {
        const op = plan.openings.find((o) => o.id === sel.id);
        if (op) {
          const label = FC.openingLabel(op);
          document.querySelectorAll('[data-op-title]').forEach((n) => (n.textContent = `${label} (${fmtLen(op.width)})`));
          if (op.kind === 'window') {
            document.querySelectorAll('[data-op-sill]').forEach((n) => (n.textContent = fmtLen(op.sill)));
            document.querySelectorAll('[data-op-head]').forEach((n) => (n.textContent = fmtLen(op.sill + op.height)));
          }
          const seg = FC.segmentByKey(plan, op.hostKey);
          if (seg) {
            const distA = Math.max(0, op.offset - op.width / 2);
            const distB = Math.max(0, seg.len - (op.offset + op.width / 2));
            document.querySelectorAll('[data-op-dist-a-label]').forEach((n) => (n.textContent = `From Corner A (${fmtLenShort(distA, 2)})`));
            document.querySelectorAll('[data-op-dist-b-label]').forEach((n) => (n.textContent = `From Corner B (${fmtLenShort(distB, 2)})`));
            const active = document.activeElement;
            const inA = document.querySelector('input[data-op-field="offsetFromA"]');
            if (inA && inA !== active) inA.value = fmtInput(distA);
            const inB = document.querySelector('input[data-op-field="offsetFromB"]');
            if (inB && inB !== active) inB.value = fmtInput(distB);
          }
        }
      }
    }

    /* ---------------------------------------------------------------- */
    /* Inputs                                                            */
    /* ---------------------------------------------------------------- */

    settingKeyFor(el) {
      if (el.dataset.setting) return 'setting:' + el.dataset.setting;
      if (el.dataset.sun !== undefined) return 'sun';
      if (el.dataset.density !== undefined) return 'density';
      if (el.dataset.furnitureRot) return 'furnRot:' + el.dataset.furnitureRot;
      if (el.dataset.opField) return 'op:' + el.dataset.opField;
      if (el.dataset.wallLen) return 'wallLen:' + el.dataset.wallLen;
      return 'value';
    }

    ensureHistory(el) {
      const key = this.settingKeyFor(el);
      if (this._activeSetting !== key) {
        this.app.pushHistory();
        this._activeSetting = key;
      }
    }

    parseElementLength(el) {
      const isThick = el.dataset && el.dataset.unitType === 'thickness';
      if (FC.parseLengthInput) {
        return FC.parseLengthInput(el.value, this.app.plan, isThick ? { unit: 'in' } : undefined);
      }
      return parseFloat(el.value);
    }

    getModelValueForInput(el) {
      const plan = this.app.plan;
      if (!plan || !el || !el.dataset) return NaN;
      if (el.dataset.setting) {
        return plan.settings[el.dataset.setting];
      }
      if (el.dataset.opField && this.app.ui.selection && this.app.ui.selection.type === 'opening') {
        const op = plan.openings.find((o) => o.id === this.app.ui.selection.id);
        if (!op) return NaN;
        const f = el.dataset.opField;
        if (f === 'width' || f === 'height' || f === 'sill') return op[f];
        const seg = FC.segmentByKey(plan, op.hostKey);
        if (!seg) return NaN;
        if (f === 'offsetFromA') return Math.max(0, op.offset - op.width / 2);
        if (f === 'offsetFromB') return Math.max(0, seg.len - (op.offset + op.width / 2));
      }
      if (el.dataset.wallLen) {
        const seg = FC.segmentByKey(plan, 'w:' + el.dataset.wallLen);
        if (seg) return seg.len;
      }
      return NaN;
    }

    formatDimensionInput(el) {
      if (!el || !el.dataset) return;
      if (el.type === 'range') return;
      if (!el.dataset.setting && !el.dataset.opField && !el.dataset.wallLen) return;
      const val = this.getModelValueForInput(el);
      if (isFinite(val)) {
        const isThick = el.dataset.unitType === 'thickness';
        el.value = FC.formatInputLength
          ? FC.formatInputLength(val, this.app.plan, isThick ? { thickness: true } : undefined)
          : FC.fmt(val, 2);
      }
    }

    stepDimensionInput(el, dir, shiftKey) {
      this.ensureHistory(el);
      const plan = this.app.plan;
      const isImp = FC.isImperial && FC.isImperial(plan);
      const isThick = el.dataset && el.dataset.unitType === 'thickness';
      let curVal = this.parseElementLength(el);
      if (!isFinite(curVal)) curVal = this.getModelValueForInput(el);
      if (!isFinite(curVal)) return;

      let step;
      if (isImp) {
        if (isThick) step = (shiftKey ? 1 : 0.25) * FC.INCHES_TO_METERS;
        else step = (shiftKey ? 6 : 1) * FC.INCHES_TO_METERS;
      } else {
        const baseStep = parseFloat(el.dataset.step || el.step) || 0.05;
        step = shiftKey ? baseStep * 5 : baseStep;
      }

      const min = parseFloat(el.dataset.min || el.min || '0');
      const max = parseFloat(el.dataset.max || el.max || '100');
      const nextVal = FC.clamp(curVal + dir * step, isFinite(min) ? min : 0, isFinite(max) ? max : 100);

      if (el.dataset.setting) {
        this.app.updateSetting(el.dataset.setting, nextVal);
      } else if (el.dataset.opField) {
        this.app.updateSelectedOpening(el.dataset.opField, nextVal);
      } else if (el.dataset.wallLen) {
        const fromEnd = this.app.wallAnchorEnd !== undefined ? this.app.wallAnchorEnd : 0;
        this.app.resizeWall(el.dataset.wallLen, nextVal, fromEnd);
      }
      this.formatDimensionInput(el);
      this.syncWindowReadouts();
    }

    onInput(e) {
      const el = e.target;
      if (el.dataset && el.dataset.setting) {
        this.ensureHistory(el);
        const key = el.dataset.setting;
        const value = el.type === 'range' ? parseFloat(el.value) : this.parseElementLength(el);
        if (!isFinite(value)) return;
        this.app.updateSetting(key, value);
        const label = document.querySelectorAll('[data-setting-value="' + key + '"]');
        label.forEach((node) => {
          node.textContent = FC.formatLength ? FC.formatLength(value, this.app.plan) : value.toFixed(2) + ' m';
        });
        this.paintRanges(document);
        this.syncWindowReadouts();
        return;
      }
      if (el.dataset && el.dataset.sun !== undefined) {
        this.ensureHistory(el);
        const value = parseFloat(el.value);
        if (!isFinite(value)) return;
        this.app.setSunTime(value);
        const hh = Math.floor(value);
        const mm = Math.round((value - hh) * 60);
        document.querySelectorAll('[data-sun-value]').forEach((n) => (n.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')));
        this.paintRanges(document);
        return;
      }
      if (el.dataset && el.dataset.density !== undefined) {
        this.ensureHistory(el);
        const value = parseFloat(el.value);
        if (!isFinite(value)) return;
        const label = value < 0.8 ? 'Essential' : value > 1.15 ? 'Rich' : 'Comfort';
        document.querySelectorAll('[data-density-value]').forEach((n) => (n.textContent = label));
        this.app.setDensity(value);
        this.paintRanges(document);
        return;
      }
      if (el.dataset && el.dataset.opField) {
        this.ensureHistory(el);
        const value = this.parseElementLength(el);
        if (!isFinite(value)) return;
        this.app.updateSelectedOpening(el.dataset.opField, value);
        this.syncWindowReadouts();
        return;
      }
      if (el.dataset && el.dataset.wallLen) {
        this.ensureHistory(el);
        const value = this.parseElementLength(el);
        if (isFinite(value) && value > 0.1) {
          const fromEnd = this.app.wallAnchorEnd !== undefined ? this.app.wallAnchorEnd : 0;
          this.app.resizeWall(el.dataset.wallLen, value, fromEnd);
        }
        return;
      }
      if (el.dataset && el.dataset.roomName) {
        this.app.setRoomName(el.dataset.roomName, el.value);
        return;
      }
      if (el.dataset && el.dataset.furnitureRot) {
        this.ensureHistory(el);
        const value = parseFloat(el.value);
        if (isFinite(value)) {
          this.app.setSelectedFurnitureRotation(value);
          document.querySelectorAll('[data-furniture-rot-value]').forEach((n) => (n.textContent = Math.round(value) + '°'));
          this.paintRanges(document);
        }
        return;
      }
      if (el.dataset && el.dataset.lightIntensity) {
        this.ensureHistory(el);
        const value = parseFloat(el.value);
        if (isFinite(value)) {
          this.app.updateLight(el.dataset.lightIntensity, { intensity: value });
          this.paintRanges(document);
        }
        return;
      }
    }

    onChange(e) {
      if (e.target.dataset && e.target.dataset.action === 'set-wall-anchor') {
        this.app.wallAnchorEnd = parseInt(e.target.value, 10);
        return;
      }
      if (!e.target.matches || !e.target.matches('input')) return;
      this.formatDimensionInput(e.target);
      this.syncWindowReadouts();
      if (this.app) this.app._origOpeningOffset = null;
      this._activeSetting = null;
      this.app.saveSoon();
    }

    /* ---------------------------------------------------------------- */
    /* Actions                                                           */
    /* ---------------------------------------------------------------- */

    handleAction(el) {
      const a = el.dataset.action;
      const app = this.app;
      this.closeMenus();
      switch (a) {
        case 'step':
          app.goToStep(parseInt(el.dataset.step, 10));
          break;
        case 'tool':
          app.setTool(el.dataset.tool);
          break;
        case 'toggle-units':
          app.toggleUnits();
          break;
        case 'set-units':
          app.setUnits(el.dataset.units);
          break;
        case 'insert-outline-corner':
          app.insertOutlineCornerAt(parseInt(el.dataset.segIndex, 10));
          break;
        case 'delete-outline-corner':
          app.deleteOutlineCorner(parseInt(el.dataset.index, 10));
          break;
        case 'copy-selection':
          app.copySelection();
          break;
        case 'paste-selection':
          app.pasteClipboard(null, el.dataset.wall || null);
          break;
        case 'duplicate-selection':
          app.duplicateSelection();
          break;
        case 'toggle-grid':
          app.toggleGridSnap();
          break;
        case 'toggle-ortho':
          app.toggleOrthoSnap();
          break;
        case 'toggle-dims':
          app.plan.settings.showDims = !app.plan.settings.showDims;
          app.editor.draw();
          app.saveSoon();
          this.renderToolrail();
          this.renderSidebar();
          break;
        case 'toggle-sidebar':
          this.setSidebarOpen(!this.sidebarOpen);
          break;
        case 'help':
          this.showHelp();
          break;
        case 'project-menu':
          this.openProjectMenu(el);
          break;
        case 'more-menu':
          this.openMoreMenu(el);
          break;
        case 'undo':
          app.undo();
          break;
        case 'redo':
          app.redo();
          break;
        case 'start-drawing':
          app.startDrawing();
          break;
        case 'load-sample':
          app.loadSample();
          break;
        case 'dismiss-welcome':
          this.hideWelcome();
          break;
        case 'fit':
          app.fit(1);
          break;
        case 'zoom-in':
          app.editor.zoomBy(1.25);
          break;
        case 'zoom-out':
          app.editor.zoomBy(0.8);
          break;
        case 'generate':
          app.generateInterior();
          break;
        case 'clear-furniture':
          app.clearFurniture();
          break;
        case 'enter3d':
          app.enter3D(7);
          break;
        case 'exit3d':
          app.exit3D();
          break;
        case 'style':
          app.setStyle(el.dataset.style);
          break;
        case 'room-type':
          app.setRoomType(el.dataset.room, el.dataset.type);
          break;
        case 'toggle-auto-detect':
          app.toggleAutoDetectRooms();
          break;
        case 'toggle-room-preview':
          app.toggleDetectedRoomsPreview();
          break;
        case 'dismiss-room-preview':
          app.dismissDetectedRoomsPreview();
          break;
        case 'apply-detected-rooms':
          app.applyDetectedRooms(true);
          break;
        case 'adopt-detected-room':
          app.adoptDetectedRoom(el.dataset.candidate);
          break;
        case 'focus-room':
          app.focusRoom(el.dataset.room);
          break;
        case 'redraw-outline':
          app.redrawOutline();
          break;
        case 'delete-selection':
          app.deleteSelection();
          break;
        case 'clear-selection':
          app.clearSelection();
          break;
        case 'door-style':
          app.setDoorStyle(el.dataset.style);
          this.renderSidebar();
          break;
        case 'camera-fit':
          app.viewer.fit(true);
          break;
        case 'camera-top':
          app.viewer.topView();
          break;
        case 'wall-add-door':
          app.placeDoorAt(el.dataset.wall);
          break;
        case 'wall-add-window':
          app.placeWindowAt(el.dataset.wall);
          break;
        case 'wall-split':
          app.splitWallAt(el.dataset.wall);
          break;
        case 'connect-selected-walls':
          app.connectWalls();
          break;
        case 'merge-selected-walls':
          app.mergeWalls();
          break;
        case 'wall-extend-ray':
          app.extendWallToBoundary(el.dataset.wall);
          break;
        case 'wall-lengthen':
          app.lengthenWall(el.dataset.wall, parseFloat(el.dataset.delta) || 0.5);
          this.renderSidebar();
          break;
        case 'wall-connect-mode':
          app.startConnectMode(el.dataset.wall);
          break;
        case 'wall-connect-nearest':
          app.connectWallToNearest(el.dataset.wall);
          break;
        case 'merge-parallel-wall':
          app.mergeSelectedWallWithParallel(el.dataset.target);
          break;
        case 'consolidate-double-walls':
          app.consolidateDoubleWalls();
          break;
        case 'toggle-wall-virtual':
          app.toggleWallVirtual(el.dataset.wall);
          break;
        case 'delete-room':
          app.deleteRoom(el.dataset.room);
          break;
        case 'furnish-room':
          app.regenerateRoomInterior(el.dataset.room);
          break;
        case 'open-furniture-catalog':
          app.openFurnitureCatalog(el.dataset.room || null);
          break;
        case 'flip-door':
        case 'flip-door-swing':
          app.flipDoor(el.dataset.opening);
          this.renderSidebar();
          break;
        case 'flip-door-hinge':
          app.flipDoorHinge(el.dataset.opening);
          this.renderSidebar();
          break;
        case 'rotate-furniture': {
          const deg = el.dataset.angle ? parseFloat(el.dataset.angle) : 90;
          app.rotateSelectedFurniture((deg * Math.PI) / 180);
          break;
        }
        case 'add-light':
          app.addLightAt(null, null, el.dataset.lightType || 'ceiling');
          break;
        case 'export-glb':
          app.exportGLB();
          break;
        case 'export-dwg':
          app.exportDWG();
          break;
        case 'import-dwg':
          app.importDWG();
          break;
        case 'screenshot':
          app.screenshot3D();
          break;
        case 'toggle-xray':
          app.toggleView('xray');
          break;
        case 'toggle-ceiling':
          app.toggleView('ceiling');
          break;
        case 'toggle-furniture':
          app.toggleFurniture();
          break;
        case 'toggle-autorotate':
          app.toggleView('autoRotate');
          break;
        case 'toggle-invert-pitch':
          app.toggleInvertPitch();
          break;
        case 'sun-preset':
          app.setSunTime(parseFloat(el.dataset.hour));
          this.renderSidebar();
          break;
        default:
          break;
      }
    }

    /* ---------------------------------------------------------------- */
    /* Menus                                                             */
    /* ---------------------------------------------------------------- */

    openMenu(anchor, items, align) {
      this.closeMenus();
      const root = this.els.menuRoot;
      const rect = anchor.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.className = 'menu';
      menu.style.top = Math.round(rect.bottom + 8) + 'px';
      const width = 248;
      let left = align === 'right' ? rect.right - width : rect.left;
      if (align === 'right' && left < 12) left = 12;
      if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
      menu.style.left = Math.max(12, Math.round(left)) + 'px';
      menu.style.width = width + 'px';

      items.forEach((item) => {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'menu-sep';
          menu.appendChild(sep);
          return;
        }
        const btn = document.createElement('button');
        btn.className = 'menu-item' + (item.danger ? ' danger' : '') + (item.checked ? ' checked' : '') + (item.disabled ? ' disabled' : '');
        btn.disabled = !!item.disabled;
        btn.innerHTML = `<span class="menu-ico">${I(item.icon || 'file')}</span>
          <span class="menu-label">${item.labelHTML || esc(item.label)}</span>
          ${item.shortcut ? `<span class="menu-short">${item.shortcut}</span>` : ''}
          ${item.checked ? `<span class="menu-check">${I('check')}</span>` : ''}
          ${item.hint ? `<span class="menu-hint">${item.hint}</span>` : ''}`;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.closeMenus();
          if (typeof item.action === 'function') item.action();
        });
        menu.appendChild(btn);
      });
      root.appendChild(menu);
      this._menu = menu;
    }

    openContextMenu(x, y, items) {
      this.closeMenus();
      const root = this.els.menuRoot;
      const menu = document.createElement('div');
      menu.className = 'menu';
      const width = 230;
      let left = x;
      let top = y;
      if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
      if (top + 240 > window.innerHeight - 12) top = Math.max(12, window.innerHeight - 260);
      menu.style.top = Math.max(12, Math.round(top)) + 'px';
      menu.style.left = Math.max(12, Math.round(left)) + 'px';
      menu.style.width = width + 'px';

      items.forEach((item) => {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'menu-sep';
          menu.appendChild(sep);
          return;
        }
        const btn = document.createElement('button');
        btn.className = 'menu-item' + (item.danger ? ' danger' : '') + (item.checked ? ' checked' : '') + (item.disabled ? ' disabled' : '');
        btn.disabled = !!item.disabled;
        btn.innerHTML = `<span class="menu-ico">${I(item.icon || 'file')}</span>
          <span class="menu-label">${item.labelHTML || esc(item.label)}</span>
          ${item.shortcut ? `<span class="menu-short">${item.shortcut}</span>` : ''}
          ${item.checked ? `<span class="menu-check">${I('check')}</span>` : ''}
          ${item.hint ? `<span class="menu-hint">${item.hint}</span>` : ''}`;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.closeMenus();
          if (typeof item.action === 'function') item.action();
        });
        menu.appendChild(btn);
      });
      root.appendChild(menu);
      this._menu = menu;
    }

    closeMenus() {
      if (this._menu) {
        this._menu.remove();
        this._menu = null;
      }
    }

    openProjectMenu(anchor) {
      const app = this.app;
      const items = app.projects.map((p) => ({
        label: p.name,
        icon: p.id === app.plan.id ? 'home' : 'file',
        checked: p.id === app.plan.id,
        action: () => app.openProject(p.id),
      }));
      items.push({ separator: true });
      items.push({ label: 'Rename plan', icon: 'pencil', action: () => this.renamePlan() });
      items.push({ label: 'Duplicate plan', icon: 'copy', action: () => app.duplicateProject() });
      items.push({ label: 'New plan', icon: 'plus', shortcut: 'Ctrl N', action: () => app.newProject() });
      items.push({ label: 'Scale / Resize plan…', icon: 'ruler', action: () => app.openScaleModal() });
      items.push({ separator: true });
      items.push({ label: 'Import plan…', icon: 'upload', action: () => app.importJSON() });
      items.push({ label: 'Export plan', icon: 'download', action: () => app.exportJSON() });
      items.push({ label: 'Export CAD (.dwg/.dxf)', icon: 'download', action: () => app.exportDWG() });
      items.push({ label: 'Import CAD (.dwg/.dxf)…', icon: 'upload', action: () => app.importDWG() });
      items.push({ separator: true });
      items.push({ label: 'Delete plan', icon: 'trash', danger: true, action: () => this.deletePlan() });
      this.openMenu(anchor, items);
    }

    openMoreMenu(anchor) {
      const app = this.app;
      const hasClip = !!(app.hasClipboard && app.hasClipboard());
      this.openMenu(
        anchor,
        [
          { label: 'Copy selection', icon: 'copy', shortcut: 'Ctrl C', disabled: !app.ui.selection, action: () => app.copySelection() },
          { label: 'Paste copied parts', icon: 'layers', shortcut: 'Ctrl V', disabled: !hasClip, action: () => app.pasteClipboard() },
          { separator: true },
          { label: 'Fit plan to screen', icon: 'expand', shortcut: 'F', action: () => app.fit(1) },
          { label: 'Toggle dimensions', icon: 'ruler', action: () => app.toggleDimensions() },
          { label: `Units: ${FC.isImperial && FC.isImperial(app.plan) ? 'Switch to Meters (m)' : 'Switch to Feet & Inches (ft/in)'}`, icon: 'measure', shortcut: 'U', action: () => app.toggleUnits() },
          { label: 'Scale / Resize plan…', icon: 'sliders', action: () => app.openScaleModal() },
          { separator: true },
          { label: 'Export 3D Model (.glb)', icon: 'download', action: () => app.exportGLB() },
          { label: 'Export CAD (.dwg / .dxf)', icon: 'download', action: () => app.exportDWG() },
          { label: 'Import CAD (.dwg / .dxf)…', icon: 'upload', action: () => app.importDWG() },
          { separator: true },
          { label: 'Save plan image', icon: 'camera', action: () => app.exportPNG() },
          { label: 'Export plan (.json)', icon: 'download', action: () => app.exportJSON() },
          { label: 'Import plan…', icon: 'upload', action: () => app.importJSON() },
          { separator: true },
          { label: 'Keyboard shortcuts', icon: 'key', shortcut: '?', action: () => this.showHelp() },
          { label: 'About RoomCraft', icon: 'info', action: () => this.showAbout() },
        ],
        'right',
      );
    }

    showHelp() {
      this.showModal({
        title: 'RoomCraft quick start',
        eyebrow: 'Help',
        html: `<div class="help-grid">
          <div class="help-item"><span class="key">1</span><div><b>Trace the outline</b><p>Click corners on the canvas. Close the loop by clicking the first corner or pressing Enter.</p></div></div>
          <div class="help-item"><span class="key">2</span><div><b>Add inner walls</b><p>Keep clicking to chain partitions. Walls snap to corners and to each other.</p></div></div>
          <div class="help-item"><span class="key">3</span><div><b>Type the rooms</b><p>Rooms are found automatically. Click one to pick a type — that selects its furniture.</p></div></div>
          <div class="help-item"><span class="key">4</span><div><b>Drop openings</b><p>Place doors and windows on walls. Drag them to move; edit width, height and sill in the panel.</p></div></div>
          <div class="help-item"><span class="key">5</span><div><b>Generate the interior</b><p>Pick a style and furnishing level, then let RoomCraft furnish each room by type.</p></div></div>
          <div class="help-item"><span class="key">6</span><div><b>Make it 3D</b><p>Explore real wall heights and cut openings, relight the scene with the time-of-day slider, and save an image.</p></div></div>
        </div>
        <div class="shortcut-head">Keyboard</div>
        <div class="shortcut-grid">
          <span><kbd>V</kbd> Select</span><span><kbd>H</kbd> Pan</span>
          <span><kbd>O</kbd> Outline</span><span><kbd>B</kbd> Room Box</span>
          <span><kbd>W</kbd> Walls</span><span><kbd>M</kbd> Measure</span>
          <span><kbd>D</kbd> Door</span><span><kbd>N</kbd> Window</span>
          <span><kbd>R</kbd> Rooms</span><span><kbd>U</kbd> Units (m / ft'in")</span>
          <span><kbd>3</kbd> Toggle 3D</span><span><kbd>F</kbd> Fit</span>
          <span><kbd>Ctrl C</kbd> Copy parts / opening</span><span><kbd>Ctrl V</kbd> Paste parts / opening</span>
          <span><kbd>Ctrl D</kbd> Duplicate</span><span><kbd>Del</kbd> Delete selection</span>
          <span><kbd>Ctrl Z</kbd> Undo</span><span><kbd>Shift Ctrl Z</kbd> Redo</span>
          <span><kbd>Shift</kbd> Ortho / Box select</span><span><kbd>Alt</kbd> Free move (no snap)</span>
        </div>
        <p class="help-foot">Everything is stored locally in your browser. Export the plan as JSON to keep a copy.</p>`,
        actions: [{ label: 'Got it', primary: true, value: true }],
      });
    }

    showAbout() {
      this.showModal({
        title: 'About RoomCraft',
        eyebrow: 'Beta',
        html: `<div class="about">
          <div class="about-mark">${I('home')}</div>
          <p><b>RoomCraft</b> is a sketch-to-3D floorplan studio. Draw walls with CAD-style snapping, configure real construction heights, furnish by room type and walk through the result.</p>
          <p class="muted">Built with vanilla JavaScript, Canvas 2D and Three.js. Your plans never leave this browser.</p>
          <div class="about-badges"><span>Plan editor</span><span>Openings</span><span>Procedural furniture</span><span>Live 3D</span></div>
        </div>`,
        actions: [{ label: 'Close', primary: true, value: true }],
      });
    }

    openFurnitureCatalogModal(targetRoomId = null) {
      let room = null;
      if (targetRoomId) {
        room = this.app.rooms.find((r) => r.id === targetRoomId);
      }
      if (!room && this.selection && this.selection.type === 'room') {
        room = this.app.rooms.find((r) => r.id === this.selection.id);
      }
      const roomLabel = room ? (room.name || (FC.roomTypes[room.type] && FC.roomTypes[room.type].label) || 'Selected Room') : 'Floor Plan';

      const categories = [
        { id: 'all', label: 'All Items' },
        { id: 'living', label: 'Living' },
        { id: 'bedroom', label: 'Bedroom' },
        { id: 'kitchen', label: 'Kitchen' },
        { id: 'dining', label: 'Dining' },
        { id: 'bath', label: 'Bath' },
        { id: 'office', label: 'Office' },
        { id: 'laundry', label: 'Laundry' },
        { id: 'garage', label: 'Garage' },
        { id: 'outdoor', label: 'Outdoor' },
      ];

      let activeCategory = 'all';
      if (room && room.type) {
        if (room.type === 'living') activeCategory = 'living';
        else if (room.type === 'bedroom') activeCategory = 'bedroom';
        else if (room.type === 'kitchen') activeCategory = 'kitchen';
        else if (room.type === 'dining') activeCategory = 'dining';
        else if (room.type === 'bath') activeCategory = 'bath';
        else if (room.type === 'office') activeCategory = 'office';
        else if (room.type === 'utility') activeCategory = 'laundry';
        else if (room.type === 'garage') activeCategory = 'garage';
        else if (room.type === 'patio' || room.type === 'balcony') activeCategory = 'outdoor';
      }

      const renderGrid = (cat) => {
        const items = Object.entries(FC.furnitureCatalog || {}).filter(([k, def]) => {
          if (cat === 'all') return true;
          return def.category === cat;
        });

        if (!items.length) {
          return '<p class="muted" style="grid-column: 1/-1; text-align: center; padding: 20px;">No items in this category.</p>';
        }

        return items
          .map(([kind, def]) => {
            const iconSvg = I(def.icon || 'sofa');
            const dimStr = FC.formatLength
              ? `${FC.formatLengthShort(def.w, this.app.plan, 2)} × ${FC.formatLength(def.d, this.app.plan)}`
              : `${def.w.toFixed(2)} × ${def.d.toFixed(2)} m`;
            return `<button type="button" class="catalog-card" data-catalog-kind="${kind}">
              <div class="catalog-card-icon">${iconSvg}</div>
              <div class="catalog-card-body">
                <span class="catalog-card-name">${esc(def.label)}</span>
                <span class="catalog-card-dim">${dimStr}</span>
                <p class="catalog-card-desc">${esc(def.desc || '')}</p>
              </div>
            </button>`;
          })
          .join('');
      };

      const modalHTML = `<div class="catalog-modal-content">
        <div class="catalog-tabs">
          ${categories.map((c) => `<button type="button" class="catalog-tab ${c.id === activeCategory ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
        <div class="catalog-grid" id="catalogItemGrid">
          ${renderGrid(activeCategory)}
        </div>
      </div>`;

      this.showModal({
        title: 'Furniture & Object Catalog',
        eyebrow: 'Target: ' + roomLabel,
        wide: true,
        html: modalHTML,
        actions: [{ label: 'Close', value: null }],
        onMount: (overlay, close) => {
          const grid = overlay.querySelector('#catalogItemGrid');
          const tabs = overlay.querySelectorAll('.catalog-tab');

          tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
              tabs.forEach((t) => t.classList.remove('active'));
              tab.classList.add('active');
              activeCategory = tab.dataset.cat;
              grid.innerHTML = renderGrid(activeCategory);
              bindCardClicks();
            });
          });

          const bindCardClicks = () => {
            overlay.querySelectorAll('.catalog-card').forEach((card) => {
              card.addEventListener('click', () => {
                const kind = card.dataset.catalogKind;
                try {
                  this.app.addFurnitureItem(kind, null, null, room ? room.id : null);
                } catch (err) {
                  console.error('Error adding furniture item:', err);
                }
                close(kind);
              });
            });
          };

          bindCardClicks();
        },
      });
    }

    /* ---------------------------------------------------------------- */
    /* Modals                                                            */
    /* ---------------------------------------------------------------- */

    showModal(opts) {
      return new Promise((resolve) => {
        const root = this.els.modalRoot;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
          <div class="modal-head">
            <div><span class="eyebrow">${esc(opts.eyebrow || 'RoomCraft')}</span><h2>${esc(opts.title)}</h2></div>
            <button class="icon-btn soft modal-x" aria-label="Close">${I('close')}</button>
          </div>
          ${opts.input ? `<label class="modal-input"><span>${esc(opts.inputLabel || 'Name')}</span><input type="text" value="${esc(opts.input)}" maxlength="60"></label>` : ''}
          ${opts.html || (opts.message ? `<p class="modal-message">${esc(opts.message)}</p>` : '')}
          <div class="modal-actions">
            ${(opts.actions || [{ label: 'Close', value: null }])
              .map((a, i) => `<button class="btn ${a.primary ? 'primary' : 'soft'}" data-i="${i}">${esc(a.label)}</button>`)
              .join('')}
          </div>
        </div>`;
        root.appendChild(overlay);
        document.body.classList.add('has-overlay');
        this._modal = overlay;
        if (typeof opts.onMount === 'function') {
          try {
            opts.onMount(overlay, (v) => close(v));
          } catch (e) {
            console.error('Modal onMount error:', e);
          }
        }
        const input = overlay.querySelector('input[type="text"]');
        if (input) {
          setTimeout(() => {
            input.focus();
            input.select();
          }, 30);
        }
        const close = (value) => {
          overlay.remove();
          document.body.classList.remove('has-overlay');
          this._modal = null;
          resolve(value);
        };
        overlay.querySelector('.modal-x').addEventListener('click', () => close(opts.input !== undefined ? null : null));
        overlay.addEventListener('mousedown', (e) => {
          if (e.target === overlay) close(null);
        });
        overlay.querySelectorAll('.modal-actions [data-i]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.i, 10);
            const action = (opts.actions || [{ label: 'Close', value: null }])[idx];
            close(input ? input.value.trim() : action.value);
          });
        });
        if (input) {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              close(input.value.trim());
            }
          });
        }
      });
    }

    async confirm(title, message, opts) {
      const r = await this.showModal({
        title,
        message,
        html: opts && opts.html,
        eyebrow: 'Please confirm',
        actions: [
          { label: (opts && opts.cancelLabel) || 'Cancel', value: false },
          { label: (opts && opts.okLabel) || 'Continue', primary: true, value: true },
        ],
      });
      return !!r;
    }

    async prompt(title, value, label) {
      const r = await this.showModal({
        title,
        eyebrow: 'Rename',
        input: value,
        inputLabel: label || 'Plan name',
        actions: [
          { label: 'Cancel', value: null },
          { label: 'Save', primary: true, value: value },
        ],
      });
      return r;
    }

    async renamePlan() {
      const name = await this.prompt('Rename plan', this.app.plan.name, 'Plan name');
      if (name) this.app.renameProject(name);
    }

    async deletePlan() {
      if (this.app.projects.length <= 1) {
        this.toast('Keep at least one plan', 'info');
        return;
      }
      const ok = await this.confirm('Delete this plan?', 'This removes "' + this.app.plan.name + '" from this browser. Export it first if you want a copy.', {
        okLabel: 'Delete plan',
        danger: true,
      });
      if (ok) this.app.deleteProject();
    }

    /* ---------------------------------------------------------------- */
    /* Toasts                                                            */
    /* ---------------------------------------------------------------- */

    toast(message, type) {
      const el = document.createElement('div');
      el.className = 'toast ' + (type || 'info');
      const icon = type === 'error' ? 'info' : type === 'success' ? 'check' : type === 'warn' ? 'info' : 'info';
      el.innerHTML = `<span class="toast-ico">${I(icon)}</span><span>${esc(message)}</span>`;
      this.els.toasts.appendChild(el);
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 260);
      }, 2800);
    }
  }

  FC.UI = UI;
})();

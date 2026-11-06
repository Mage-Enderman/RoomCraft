/* Floorcraft — UI chrome, panels, menus and dialogs */
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
    { tool: 'wall', icon: 'wall', label: 'Interior walls', key: 'W' },
    { tool: 'door', icon: 'door', label: 'Doors', key: 'D' },
    { tool: 'window', icon: 'window', label: 'Windows', key: 'N' },
    { tool: 'room', icon: 'layout', label: 'Rooms', key: 'R' },
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
          if (el.matches && el.matches('input[type="range"][data-setting], input[type="range"][data-sun], input[type="range"][data-density]')) {
            const key = el.dataset.setting
              ? 'setting:' + el.dataset.setting
              : el.dataset.sun !== undefined
                ? 'sun'
                : el.dataset.density !== undefined
                  ? 'density'
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
      this.els.sideScroll.querySelectorAll('[data-stat]').forEach((node) => {
        const key = node.dataset.stat;
        if (key === 'area') node.querySelector('.stat-value').firstChild.textContent = stats.area.toFixed(1);
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
        html = `${k('Drag')} orbit &nbsp;·&nbsp; ${k('Right-drag')} pan &nbsp;·&nbsp; ${k('Scroll')} zoom`;
      } else if (this.app.editor && this.app.editor.lengthBuffer) {
        html = `${k('Type')} a length in metres, then ${k('Enter')} to place it`;
      } else if (tool === 'outline') {
        if (ui.drawingFresh) {
          if (!plan.outline.length) html = `${k('Click')} to place the first corner of the apartment`;
          else html = `${k('Click')} corners &nbsp;·&nbsp; ${k('Enter')} to close &nbsp;·&nbsp; ${k('Esc')} to cancel &nbsp;·&nbsp; type a length`;
        } else if (plan.outline.length >= 3) {
          html = `${k('Drag')} a corner to adjust &nbsp;·&nbsp; use ${k('Redraw outline')} in the panel`;
        } else {
          html = `${k('Click')} to place the first corner of the apartment`;
        }
      } else if (tool === 'wall') {
        if (this.app.editor && this.app.editor.wallChain) html = `${k('Click')} next corner &nbsp;·&nbsp; ${k('Enter')} to finish &nbsp;·&nbsp; ${k('Esc')} to end`;
        else html = `${k('Click')} to start an interior wall — keep clicking to chain walls`;
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
        if (sel) html = `${k('Drag')} handles to edit &nbsp;·&nbsp; ${k('Delete')} removes &nbsp;·&nbsp; ${k('Esc')} to deselect`;
        else html = `${k('Select')} a wall, door or window &nbsp;·&nbsp; ${k('Scroll')} to zoom &nbsp;·&nbsp; ${k('O')} to draw`;
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
          ${this.stat('area', stats.area.toFixed(1), 'm²', 'Floor area')}
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
      if (sel.type === 'wall') {
        const seg = FC.getSegments(plan).find((s) => s.key === sel.key);
        if (!seg) return '';
        const angle = Math.round(((seg.angle * 180) / Math.PI + 360) % 360);
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${seg.boundary ? 'Exterior wall' : 'Interior wall'}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics">
            <div><b>${FC.fmt(seg.len, 2)}</b><span>length · m</span></div>
            <div><b>${Math.round(seg.thickness * 100)}</b><span>thickness · cm</span></div>
            <div><b>${angle}°</b><span>bearing</span></div>
          </div>
          <div class="field" style="margin-top:10px;">
            <label class="num-field"><span>Resize length</span><span class="num-wrap"><input type="number" data-wall-len="${seg.id}" min="0.5" max="30" step="0.05" value="${FC.fmt(seg.len, 2)}"><em>m</em></span></label>
          </div>
          <div class="btn-row two" style="margin-top:8px;">
            <button class="btn soft sm" data-action="wall-add-door" data-wall="${seg.id}">${I('door')} Add door</button>
            <button class="btn soft sm" data-action="wall-add-window" data-wall="${seg.id}">${I('window')} Add window</button>
          </div>
          ${!seg.boundary ? `<button class="btn soft sm" style="margin-top:6px;width:100%" data-action="wall-split" data-wall="${seg.id}">${I('sliders')} Split wall into two</button>` : ''}
          <div class="sel-help" style="margin-top:8px;">${seg.boundary ? 'Drag the wall or its corners in Outline mode to reshape it.' : 'Drag the wall to move it, drag junction nodes to move connected walls together, or type an exact length above.'}</div>
          ${!seg.boundary ? `<button class="danger-link" data-action="delete-selection">${I('trash')} Delete wall</button>` : ''}
        </div>`;
      }
      if (sel.type === 'vertex') {
        const p = plan.outline[sel.index];
        if (!p) return '';
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">Outline corner</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${FC.fmt(p.x, 2)}</b><span>x · m</span></div>
            <div><b>${FC.fmt(p.y, 2)}</b><span>y · m</span></div>
          </div>
          <div class="sel-help">Drag the corner to reshape the footprint. Openings follow their walls.</div>
        </div>`;
      }
      if (sel.type === 'opening') {
        const op = plan.openings.find((o) => o.id === sel.id);
        if (!op) return '';
        const label = FC.openingLabel(op);
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${label}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="num-grid">
            ${this.numField('Width', 'opWidth', 'width', op.width, 0.4, 4, 0.05)}
            ${this.numField('Height', 'opHeight', 'height', op.height, 0.5, 3.2, 0.05)}
            ${op.kind === 'window' ? this.numField('Sill', 'opSill', 'sill', op.sill, 0, 2.2, 0.05) : ''}
          </div>
          ${op.kind === 'door'
            ? `<div class="chip-row small" style="margin-top:8px;">
                ${['single', 'double', 'sliding'].map((s) => `<button class="chip ${op.style === s ? 'active' : ''}" data-action="door-style" data-style="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
              </div>
              <div class="btn-row" style="margin-top:8px;">
                <button class="btn soft sm" style="width:100%" data-action="flip-door" data-opening="${op.id}">${I('rotate3d')} Flip door swing</button>
              </div>`
            : ''}
          <div class="sel-help">${op.kind === 'window' ? `Sill <b data-op-sill>${op.sill.toFixed(2)}</b> m · head <b data-op-head>${(op.sill + op.height).toFixed(2)}</b> m — both must stay below the <b data-op-wall>${this.app.plan.settings.wallHeight.toFixed(2)}</b> m wall.` : 'Drag the opening along the wall to reposition it. Click Del badge to remove.'}</div>
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
            <div><b>${FC.fmt(f.w, 2)} × ${FC.fmt(f.d, 2)}</b><span>size · m</span></div>
            <div><b>${rotDeg}°</b><span>rotation</span></div>
          </div>
          <div class="btn-row two" style="margin-top:10px;">
            <button class="btn soft sm" data-action="rotate-furniture" data-furniture="${f.id}">${I('rotate3d')} Rotate 90°</button>
            <button class="btn soft sm danger" data-action="delete-selection">${I('trash')} Delete</button>
          </div>
          <div class="sel-help" style="margin-top:8px;">Drag to reposition anywhere in the room. Drag the round top handle to rotate freely, or press <kbd>R</kbd>.</div>
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
            <div><b>${FC.fmt(l.x, 2)}, ${FC.fmt(l.y, 2)}</b><span>pos · m</span></div>
            <div><b>${FC.fmt(l.z || 2.4, 2)}</b><span>height · m</span></div>
          </div>
          <div class="btn-row" style="margin-top:10px;">
            <button class="btn soft sm danger" style="width:100%" data-action="delete-selection">${I('trash')} Delete light</button>
          </div>
          <div class="sel-help" style="margin-top:8px;">Drag to position this light fixture. It casts real dynamic light in 3D dollhouse mode.</div>
        </div>`;
      }
      if (sel.type === 'room') {
        const room = this.app.rooms.find((r) => r.id === sel.id);
        if (!room) return '';
        return `<div class="sel-card">
          <div class="sel-head">
            <div><span class="eyebrow">Selected</span><div class="sel-title">${esc(room.name)}</div></div>
            <button class="icon-btn soft" data-action="clear-selection" title="Deselect">${I('close')}</button>
          </div>
          <div class="sel-metrics two">
            <div><b>${FC.fmt(room.area, 1)}</b><span>floor area · m²</span></div>
            <div><b>${room.bounds.w.toFixed(1)} × ${room.bounds.d.toFixed(1)}</b><span>room size · m</span></div>
          </div>
          ${this.typeGrid(room)}
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
      let perimeter = 0;
      for (let i = 0; i < plan.outline.length; i++) {
        const a = plan.outline[i];
        const c = plan.outline[(i + 1) % plan.outline.length];
        perimeter += FC.dist(a, c);
      }
      return `<section class="panel-block">
        ${this.moduleHead('Outline', has ? 'Footprint' : 'Step 1 of 7')}
        <p class="helper">${has ? 'Drag any corner to reshape the footprint. Openings and furniture stay attached.' : 'Click on the canvas to trace the outer boundary. Snap to the grid, or type an exact length.'}</p>
        <div class="mini-stats">
          <div><b>${has ? b.w.toFixed(1) + ' × ' + b.d.toFixed(1) : '—'}</b><span>metres</span></div>
          <div><b>${has ? perimeter.toFixed(1) : '—'}</b><span>perimeter · m</span></div>
          <div><b>${has ? this.app.plan.outline.length : '0'}</b><span>corners</span></div>
        </div>
        <div class="btn-row">
          <button class="btn soft sm" data-action="${has ? 'redraw-outline' : 'start-drawing'}">${I(has ? 'pencil' : 'home')} ${has ? 'Redraw outline' : 'Start drawing'}</button>
          ${has ? '' : `<button class="btn soft sm" data-action="load-sample">${I('layout')} Sample</button>`}
        </div>
      </section>`;
    }

    wallsStepHTML() {
      const walls = this.app.plan.walls.length;
      return `<section class="panel-block">
        ${this.moduleHead('Interior walls', walls + ' segment' + (walls === 1 ? '' : 's'))}
        <p class="helper">Click a start point, then keep clicking to chain walls. End with <kbd>Enter</kbd> or <kbd>Esc</kbd>. Type a number for an exact length.</p>
        <div class="mini-stats">
          <div><b>${this.app.plan.settings.intThickness.toFixed(2)}</b><span>inner · m</span></div>
          <div><b>${this.app.plan.settings.extThickness.toFixed(2)}</b><span>outer · m</span></div>
          <div><b>${walls}</b><span>walls</span></div>
        </div>
        <div class="hint-note">${I('info')} Walls snap to outline corners and to each other, so rooms close cleanly.</div>
      </section>`;
    }

    roomsStepHTML() {
      const rooms = this.app.rooms;
      if (!rooms.length) {
        return `<section class="panel-block">
          ${this.moduleHead('Rooms', 'Step 3 of 7')}
          <p class="helper">No enclosed rooms yet. Draw walls that meet the outline or each other and rooms appear here automatically.</p>
          <button class="btn soft sm" data-action="tool" data-tool="wall">${I('wall')} Draw interior walls</button>
        </section>`;
      }
      const selectedRoom = this.app.ui.selection && this.app.ui.selection.type === 'room' ? this.app.rooms.find((r) => r.id === this.app.ui.selection.id) : null;
      return `<section class="panel-block">
        ${this.moduleHead('Rooms', rooms.length + ' detected')}
        <div class="room-list">
          ${rooms
            .map((r) => {
              const t = FC.roomTypes[r.type] || FC.roomTypes.living;
              const active = selectedRoom && selectedRoom.id === r.id;
              return `<button class="room-row ${active ? 'active' : ''}" data-action="focus-room" data-room="${r.id}">
                <span class="room-dot" style="background:${t.color}"></span>
                <span class="room-main"><b>${esc(r.name)}</b><span>${FC.fmt(r.area, 1)} m²</span></span>
                <span class="room-kind">${t.label.replace(' room', '').replace('Living', 'Living')}</span>
              </button>`;
            })
            .join('')}
        </div>
        ${selectedRoom ? `<div class="room-types"><div class="micro-label">Room type</div>${this.typeGrid(selectedRoom)}</div>` : `<p class="helper tight">Select a room to change its type and furnishing recipe.</p>`}
      </section>`;
    }

    doorsStepHTML() {
      const tool = this.app.ui.tool;
      const plan = this.app.plan;
      const doors = plan.openings.filter((o) => o.kind === 'door').length;
      const windows = plan.openings.filter((o) => o.kind === 'window').length;
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
             <div class="hint-note small">${I('info')} Sill <b data-window-sill>${plan.settings.windowSill.toFixed(2)}</b> m → head <b data-window-head>${(plan.settings.windowSill + plan.settings.windowHeight).toFixed(2)}</b> m.</div>`
          : tool === 'opening'
            ? ''
            : `<div class="num-grid">${this.numField('Width', null, 'doorWidth', plan.settings.doorWidth, 0.6, 2.4, 0.05)}${this.numField('Height', null, 'doorHeight', plan.settings.doorHeight, 1.8, 3, 0.05)}</div>`}
      </section>`;
    }

    generateStepHTML() {
      const plan = this.app.plan;
      const count = FC.furnitureCount(this.app.furniture);
      return `<section class="panel-block">
        ${this.moduleHead('Interior', plan.furnished ? count + ' pieces placed' : 'Not furnished')}
        <p class="helper">${plan.furnished ? 'Furniture is generated per room type. Change a room type or wall layout and it reflows automatically.' : 'Choose a style, then generate a furnished interior tailored to each room.'}</p>
        <div class="density-row">
          <div class="field-head"><span>Furnishing level</span><span class="value" data-density-value>${plan.density < 0.8 ? 'Essential' : plan.density > 1.15 ? 'Rich' : 'Comfort'}</span></div>
          <input type="range" data-density min="0.5" max="1.5" step="0.05" value="${plan.density}">
        </div>
        ${plan.furnished ? `<button class="danger-link subtle" data-action="clear-furniture">${I('trash')} Clear furniture</button>` : ''}
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
      return `<section class="panel-block model-block">
        ${this.moduleHead('The model', 'Live')}
        <div class="model-summary">
          <span class="model-swatch">${style.swatches.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
          <div class="model-copy">
            <b>${style.name}</b>
            <span>${plan.furnished ? pieces + ' pieces · ' : 'Unfurnished · '}${FC.fmt(s.wallHeight, 2)} m walls</span>
          </div>
        </div>
        <div class="mini-stats">
          <div><b>${FC.fmt(s.wallHeight, 2)}</b><span>ceiling · m</span></div>
          <div><b>${FC.fmt(s.doorHeight, 2)}</b><span>door · m</span></div>
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
      return `<section class="panel-block design-block">
        <div class="section-head"><span class="eyebrow">Design</span><span class="mini">Walls, style & density</span></div>
        <div class="field">
          <div class="field-head"><span>Wall height</span><span class="value" data-setting-value="wallHeight">${s.wallHeight.toFixed(2)} m</span></div>
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
          ${this.toggleRow('toggle-grid', 'Snap to grid (0.1m)', 'grid', s.snapGrid !== false)}
          ${this.toggleRow('toggle-ortho', 'Straight wall snap (0°, 90°, 45°)', 'ortho', s.snapAngle !== false)}
        </div>
        <details class="structure" ${this.structureOpen ? 'open' : ''}>
          <summary><span>${I('sliders')} Structure & openings</span>${I('chevron-down', 'chev')}</summary>
          <div class="adv-grid">
            ${this.structField('Exterior wall', 'extThickness', s.extThickness, 0.08, 0.5, 0.01, 'm')}
            ${this.structField('Interior wall', 'intThickness', s.intThickness, 0.08, 0.4, 0.01, 'm')}
            ${this.structField('Floor slab', 'slabThickness', s.slabThickness, 0.08, 0.5, 0.01, 'm')}
            ${this.structField('Door height', 'doorHeight', s.doorHeight, 1.8, 3, 0.05, 'm')}
            ${this.structField('Door width', 'doorWidth', s.doorWidth, 0.6, 2.4, 0.05, 'm')}
            ${this.structField('Window sill', 'windowSill', s.windowSill, 0, 2.2, 0.05, 'm')}
            ${this.structField('Window height', 'windowHeight', s.windowHeight, 0.3, 2.6, 0.05, 'm')}
            ${this.structField('Window width', 'windowWidth', s.windowWidth, 0.6, 4, 0.05, 'm')}
          </div>
          <div class="hint-note small">${I('info')} Openings are clamped to stay below the wall height.</div>
        </details>
      </section>`;
    }

    structField(label, key, value, min, max, step, unit) {
      return `<label class="num-field"><span>${label}</span><span class="num-wrap"><input type="number" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${FC.fmt(value, 2)}"><em>${unit}</em></span></label>`;
    }

    numField(label, suffix, key, value, min, max, step) {
      const settingKey = suffix ? null : key;
      const opField = suffix ? String(suffix).replace(/^op/i, '').toLowerCase() || key : null;
      const attrs = opField
        ? `data-op-field="${opField}"`
        : `data-setting="${settingKey}"`;
      return `<label class="num-field"><span>${label}</span><span class="num-wrap">
        <input type="number" ${attrs} min="${min}" max="${max}" step="${step}" value="${FC.fmt(value, 2)}"><em>m</em>
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
      const s = this.app.plan.settings;
      document.querySelectorAll('[data-window-sill]').forEach((n) => (n.textContent = s.windowSill.toFixed(2)));
      document.querySelectorAll('[data-window-head]').forEach((n) => (n.textContent = (s.windowSill + s.windowHeight).toFixed(2)));
      document.querySelectorAll('[data-op-wall]').forEach((n) => (n.textContent = s.wallHeight.toFixed(2)));
      const sel = this.app.ui.selection;
      if (sel && sel.type === 'opening') {
        const op = this.app.plan.openings.find((o) => o.id === sel.id);
        if (op && op.kind === 'window') {
          document.querySelectorAll('[data-op-sill]').forEach((n) => (n.textContent = op.sill.toFixed(2)));
          document.querySelectorAll('[data-op-head]').forEach((n) => (n.textContent = (op.sill + op.height).toFixed(2)));
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
      if (el.dataset.opField) return 'op:' + el.dataset.opField;
      return 'value';
    }

    ensureHistory(el) {
      const key = this.settingKeyFor(el);
      if (this._activeSetting !== key) {
        this.app.pushHistory();
        this._activeSetting = key;
      }
    }

    onInput(e) {
      const el = e.target;
      if (el.dataset && el.dataset.setting) {
        this.ensureHistory(el);
        const key = el.dataset.setting;
        const value = parseFloat(el.value);
        if (!isFinite(value)) return;
        this.app.updateSetting(key, value);
        const label = document.querySelectorAll('[data-setting-value="' + key + '"]');
        label.forEach((node) => {
          const unit = ['extThickness', 'intThickness', 'slabThickness', 'doorHeight', 'doorWidth', 'windowSill', 'windowHeight', 'windowWidth'].includes(key) ? ' m' : ' m';
          node.textContent = (key === 'wallHeight' ? value.toFixed(2) : value.toFixed(2)) + (key === 'wallHeight' || unit ? ' m' : '');
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
        const value = parseFloat(el.value);
        if (!isFinite(value)) return;
        this.app.updateSelectedOpening(el.dataset.opField, value);
        this.syncWindowReadouts();
        return;
      }
      if (el.dataset && el.dataset.wallLen) {
        this.ensureHistory(el);
        const value = parseFloat(el.value);
        if (isFinite(value) && value > 0.1) {
          this.app.resizeWall(el.dataset.wallLen, value);
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
      if (!e.target.matches || !e.target.matches('input')) return;
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
        case 'flip-door':
          app.flipDoor();
          break;
        case 'rotate-furniture':
          app.rotateSelectedFurniture(Math.PI / 2);
          break;
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
      this.openMenu(
        anchor,
        [
          { label: 'Fit plan to screen', icon: 'expand', shortcut: 'F', action: () => app.fit(1) },
          { label: 'Toggle dimensions', icon: 'ruler', action: () => app.toggleDimensions() },
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
          { label: 'About Floorcraft', icon: 'info', action: () => this.showAbout() },
        ],
        'right',
      );
    }

    showHelp() {
      this.showModal({
        title: 'Floorcraft quick start',
        eyebrow: 'Help',
        html: `<div class="help-grid">
          <div class="help-item"><span class="key">1</span><div><b>Trace the outline</b><p>Click corners on the canvas. Close the loop by clicking the first corner or pressing Enter.</p></div></div>
          <div class="help-item"><span class="key">2</span><div><b>Add inner walls</b><p>Keep clicking to chain partitions. Walls snap to corners and to each other.</p></div></div>
          <div class="help-item"><span class="key">3</span><div><b>Type the rooms</b><p>Rooms are found automatically. Click one to pick a type — that selects its furniture.</p></div></div>
          <div class="help-item"><span class="key">4</span><div><b>Drop openings</b><p>Place doors and windows on walls. Drag them to move; edit width, height and sill in the panel.</p></div></div>
          <div class="help-item"><span class="key">5</span><div><b>Generate the interior</b><p>Pick a style and furnishing level, then let Floorcraft furnish each room by type.</p></div></div>
          <div class="help-item"><span class="key">6</span><div><b>Make it 3D</b><p>Explore real wall heights and cut openings, relight the scene with the time-of-day slider, and save an image.</p></div></div>
        </div>
        <div class="shortcut-head">Keyboard</div>
        <div class="shortcut-grid">
          <span><kbd>V</kbd> Select</span><span><kbd>H</kbd> Pan</span>
          <span><kbd>O</kbd> Outline</span><span><kbd>W</kbd> Walls</span>
          <span><kbd>D</kbd> Door</span><span><kbd>N</kbd> Window</span>
          <span><kbd>R</kbd> Rooms</span><span><kbd>3</kbd> Toggle 3D</span>
          <span><kbd>F</kbd> Fit</span><span><kbd>Del</kbd> Delete selection</span>
          <span><kbd>Ctrl Z</kbd> Undo</span><span><kbd>Shift Ctrl Z</kbd> Redo</span>
          <span><kbd>Shift</kbd> Ortho / 15°</span><span><kbd>Esc</kbd> Cancel / deselect</span>
        </div>
        <p class="help-foot">Everything is stored locally in your browser. Export the plan as JSON to keep a copy.</p>`,
        actions: [{ label: 'Got it', primary: true, value: true }],
      });
    }

    showAbout() {
      this.showModal({
        title: 'About Floorcraft',
        eyebrow: 'Beta',
        html: `<div class="about">
          <div class="about-mark">${I('home')}</div>
          <p><b>Floorcraft</b> is a sketch-to-3D floorplan studio. Draw walls with CAD-style snapping, configure real construction heights, furnish by room type and walk through the result.</p>
          <p class="muted">Built with vanilla JavaScript, Canvas 2D and Three.js. Your plans never leave this browser.</p>
          <div class="about-badges"><span>Plan editor</span><span>Openings</span><span>Procedural furniture</span><span>Live 3D</span></div>
        </div>`,
        actions: [{ label: 'Close', primary: true, value: true }],
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
            <div><span class="eyebrow">${esc(opts.eyebrow || 'Floorcraft')}</span><h2>${esc(opts.title)}</h2></div>
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

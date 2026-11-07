/* RoomCraft — Three.js dollhouse viewer */
(function () {
  const FC = (window.FC = window.FC || {});
  if (!window.THREE) return;

  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
    });
    if (obj.parent) obj.parent.remove(obj);
  }

  function blend(a, b, t) {
    return new THREE.Color(a).lerp(new THREE.Color(b), t);
  }

  class Viewer3D {
    constructor(canvas, app) {
      this.canvas = canvas;
      this.wrap = document.getElementById('viewerWrap');
      this.app = app;
      this.active = false;
      this.needsBuild = true;
      this.needsRender = true;
      this.world = null;
      this.structure = null;
      this.furnitureGroup = null;
      this.ceilingGroup = null;
      this.roomLights = [];
      this.wallMats = [];
      this.sun = null;
      this.hemi = null;
      this.ambient = null;
      this.ground = null;
      this.grid = null;
      this.camera = null;
      this.renderer = null;
      this.orbit = { yaw: -0.65, pitch: 0.82, dist: 24, tx: 5, ty: 1, tz: 4 };
      this.goal = Object.assign({}, this.orbit);
      this.dragging = null;
      this.clock = null;
      this.lastT = 0;
      this._bind();
    }

    _bind() {
      const c = this.canvas;
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', () => this.onUp());
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!this.active) return;
        const factor = Math.exp(FC.clamp(e.deltaY, -120, 120) * 0.0015);
        this.goal.dist = FC.clamp(this.goal.dist * factor, 3.2, 90);
      }, { passive: false });
      window.addEventListener('resize', () => {
        if (this.active) this.resize();
      });
    }

    initThree() {
      if (this.renderer) return;
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.95;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, 1.6, 0.1, 250);

      this.ambient = new THREE.AmbientLight(0xffffff, 0.24);
      this.scene.add(this.ambient);

      this.hemi = new THREE.HemisphereLight(0xf7f4ee, 0x8f8474, 0.52);
      this.scene.add(this.hemi);

      this.sun = new THREE.DirectionalLight(0xfff2dd, 1.5);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
      this.sun.shadow.camera.near = 0.5;
      this.sun.shadow.camera.far = 120;
      this.scene.add(this.sun);
      this.scene.add(this.sun.target);

      this.world = new THREE.Group();
      this.scene.add(this.world);

      this.clock = new THREE.Clock();
      this.resize();
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    resize() {
      if (!this.renderer) return;
      const rect = this.wrap.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    activate() {
      this.initThree();
      this.active = true;
      this.needsBuild = true;
      this.resize();
      this.fit(false);
      this.updateLighting();
      this.build();
      this.setLightingFog();
    }

    deactivate() {
      this.active = false;
    }

    markDirty() {
      if (!this.active) return;
      this.needsBuild = true;
      this.needsRender = true;
    }

    fit(animate) {
      const b = FC.planBounds(this.app.plan);
      this.goal.tx = b.cx;
      this.goal.tz = b.cy;
      this.goal.ty = 0.9;
      this.goal.dist = Math.max(9, Math.max(b.w, b.d) * 1.8 + 2);
      this.goal.pitch = 0.86;
      this.goal.yaw = -0.62;
      if (!animate) this.orbit = Object.assign({}, this.goal);
      this.updateShadowFrustum(b);
      this.needsRender = true;
    }

    topView() {
      this.goal.pitch = 1.48;
      this.goal.yaw = 0;
      this.goal.dist = Math.max(10, Math.max(FC.planBounds(this.app.plan).w, FC.planBounds(this.app.plan).d) * 1.5 + 3);
      this.needsRender = true;
    }

    updateShadowFrustum(b) {
      if (!this.sun) return;
      const r = Math.max(7, Math.max(b.w, b.d) * 1.1);
      const cam = this.sun.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.updateProjectionMatrix();
    }

    /* ---------------------------------------------------------------- */
    /* Scene build                                                      */
    /* ---------------------------------------------------------------- */

    build() {
      if (!this.active || !this.renderer) return;
      const plan = this.app.plan;
      if (!plan.outline || plan.outline.length < 3) {
        this.buildEmpty();
        return;
      }
      if (this.world) {
        this.scene.remove(this.world);
        disposeObject(this.world);
      }
      this.wallMats = [];
      this.roomLights = [];
      this.world = new THREE.Group();
      this.scene.add(this.world);

      this.structure = new THREE.Group();
      this.furnitureGroup = new THREE.Group();
      this.userLightsGroup = new THREE.Group();
      this.world.add(this.structure);
      this.world.add(this.furnitureGroup);
      this.world.add(this.userLightsGroup);

      const style = (plan.style === 'custom' && plan.customStyle)
        ? plan.customStyle
        : FC.styles[plan.style] || FC.styles.scandinavian;
      const s = plan.settings;
      const H = s.wallHeight;
      const b = FC.planBounds(plan);

      this.buildGround(b, style);
      this.buildSlab(plan, style, H);
      this.buildFloors(plan, this.app.rooms || [], style);
      this.buildWalls(plan, FC.getSegments(plan), style, H);
      if (plan.furnished) this.buildFurniture(plan, this.app.furniture || [], style, H);
      if (plan.view && plan.view.ceiling) this.buildCeiling(plan, this.app.rooms || [], style, H);
      this.buildLights(plan);
      this.needsBuild = false;
      this.needsRender = true;
      this.applyXray(plan.view && plan.view.xray);
      this.updateLighting();
    }

    buildEmpty() {
      if (this.world) {
        this.scene.remove(this.world);
        disposeObject(this.world);
      }
      this.world = new THREE.Group();
      this.scene.add(this.world);
      const b = { cx: 6, cy: 4, w: 12, d: 8 };
      this.buildGround(b, FC.styles.scandinavian);
      this.goal.tx = 6;
      this.goal.tz = 4;
      this.goal.dist = 22;
      this.orbit = Object.assign({}, this.goal);
      this.needsBuild = false;
    }

    buildGround(b, style) {
      const size = 200;
      const geo = new THREE.CircleGeometry(size / 2, 64);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d7cdbf'), roughness: 1, metalness: 0 });
      const ground = new THREE.Mesh(geo, mat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(b.cx, -0.22, b.cy);
      ground.receiveShadow = true;
      this.world.add(ground);

      const gridSize = Math.max(28, Math.ceil(Math.max(b.w, b.d) + 16));
      const grid = new THREE.GridHelper(gridSize, Math.round(gridSize * 2), 0xcfc8bc, 0xdcd6cb);
      grid.position.set(b.cx, -0.2, b.cy);
      grid.material.opacity = 0.38;
      grid.material.transparent = true;
      this.world.add(grid);
      this.ground = ground;
      this.grid = grid;
    }

    buildSlab(plan, style, H) {
      const shape = new THREE.Shape();
      plan.outline.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, -p.y);
        else shape.lineTo(p.x, -p.y);
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: plan.settings.slabThickness, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -plan.settings.slabThickness, 0);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(blend(style.stone, '#8b8378', 0.25)), roughness: 0.95 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = -0.001;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.world.add(mesh);
    }

    floorColorFor(room, style) {
      const type = FC.roomTypes[room.type] || FC.roomTypes.living;
      const wet = room.type === 'bathroom' || room.type === 'kitchen' || room.type === 'hallway' || room.type === 'storage';
      if (room.type === 'balcony') return blend(style.stone, '#a8ada0', 0.5);
      if (wet) return blend(style.stone, type.color, 0.22);
      return blend(style.floor, type.color, 0.16);
    }

    buildFloors(plan, rooms, style) {
      rooms.forEach((room) => {
        if (!room.polygon || room.polygon.length < 3) return;
        const shape = new THREE.Shape();
        room.polygon.forEach((p, i) => {
          if (i === 0) shape.moveTo(p.x, -p.y);
          else shape.lineTo(p.x, -p.y);
        });
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
          color: this.floorColorFor(room, style),
          roughness: room.type === 'bathroom' || room.type === 'kitchen' ? 0.55 : 0.82,
          metalness: 0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.006;
        mesh.receiveShadow = true;
        this.world.add(mesh);

        // Plank / tile joints for a more architectural floor
        if (room.area > 5 && this.app.plan.style !== 'urbanloft') {
          const bb = room.bounds;
          const lines = [];
          const step = room.type === 'bathroom' || room.type === 'kitchen' ? 0.6 : 0.9;
          const horizontal = bb.w > bb.d;
          const n = Math.ceil((horizontal ? bb.d : bb.w) / step);
          for (let i = 1; i < n; i++) {
            if (horizontal) {
              const z = bb.y0 + i * step;
              lines.push(bb.x0 + 0.05, 0.009, z, bb.x1 - 0.05, 0.009, z);
            } else {
              const x = bb.x0 + i * step;
              lines.push(x, 0.009, bb.y0 + 0.05, x, 0.009, bb.y1 - 0.05);
            }
          }
          if (lines.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
            const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.055 }));
            this.world.add(line);
          }
        }
      });
    }

    buildWalls(plan, segs, style, H) {
      const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.wall), roughness: 0.95, metalness: 0 });
      const wallOutMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.wallOutside), roughness: 0.95, metalness: 0 });
      // Darker section caps make the cutaway read like an architectural model.
      const capMat = new THREE.MeshStandardMaterial({
        color: blend(style.wallOutside, '#4a443a', 0.82),
        roughness: 0.9,
        metalness: 0,
      });
      this.wallMats = [wallMat, wallOutMat, capMat];

      segs.forEach((seg) => {
        if (seg.len < 0.1 || (seg.wall && seg.wall.virtual)) return;
        const L = seg.len;
        const t = seg.thickness;
        const ops = [];
        plan.openings.forEach((op) => {
          if (op.hostKey !== seg.key) return;
          const pl = FC.openingPlacement(plan, op, segs);
          if (pl) ops.push(pl);
        });
        ops.sort((a, b) => a.offset - b.offset);

        const shape = new THREE.Shape();
        shape.moveTo(-L / 2, 0);
        shape.lineTo(L / 2, 0);
        shape.lineTo(L / 2, H);
        shape.lineTo(-L / 2, H);
        shape.closePath();

        ops.forEach((pl) => {
          const w = Math.min(pl.width, L - 0.12);
          if (w < 0.2) return;
          const cx = pl.offset - L / 2;
          const x0 = FC.clamp(cx - w / 2, -L / 2 + 0.03, L / 2 - 0.03);
          const x1 = FC.clamp(cx + w / 2, -L / 2 + 0.03, L / 2 - 0.03);
          if (x1 - x0 < 0.15) return;
          let y0 = 0;
          let y1 = H - 0.03;
          if (pl.op.kind === 'window') {
            y0 = FC.clamp(pl.sill, 0.05, H - 0.2);
            y1 = FC.clamp(pl.sill + pl.height, y0 + 0.15, H - 0.04);
          } else {
            y0 = 0;
            y1 = FC.clamp(pl.height, 0.4, H - 0.04);
          }
          const hole = new THREE.Path();
          hole.moveTo(x0, y0);
          hole.lineTo(x0, y1);
          hole.lineTo(x1, y1);
          hole.lineTo(x1, y0);
          hole.closePath();
          shape.holes.push(hole);
        });

        const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
        geo.translate(0, 0, -t / 2);
        const mesh = new THREE.Mesh(geo, [seg.boundary ? wallOutMat : wallMat, capMat]);
        mesh.position.set((seg.a.x + seg.b.x) / 2, 0, (seg.a.y + seg.b.y) / 2);
        mesh.rotation.y = -seg.angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.structure.add(mesh);

        // fine architectural outline keeps wall tops and openings legible
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x4c4841, transparent: true, opacity: 0.16 });
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 32), edgeMat);
        edges.position.copy(mesh.position);
        edges.rotation.copy(mesh.rotation);
        this.structure.add(edges);

        // opening details
        const details = new THREE.Group();
        details.position.set((seg.a.x + seg.b.x) / 2, 0, (seg.a.y + seg.b.y) / 2);
        details.rotation.y = -seg.angle;
        this.structure.add(details);
        ops.forEach((pl) => {
          this.buildOpeningDetail(details, pl, L, t, H, style);
        });
      });
    }

    buildOpeningDetail(group, pl, L, t, H, style) {
      const w = Math.min(pl.width, L - 0.12);
      const cx = pl.offset - L / 2;
      const trimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.dark), roughness: 0.72 });
      const woodMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.wood), roughness: 0.66 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#c2dce4'),
        transparent: true,
        opacity: 0.24,
        roughness: 0.05,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const frameD = t + 0.02;

      if (pl.op.kind === 'window') {
        const sill = FC.clamp(pl.sill, 0.05, H - 0.2);
        const h = Math.max(0.15, Math.min(pl.height, H - sill - 0.04));
        const top = sill + h;
        const f = 0.045;
        const box = (bw, bh, bd, bx, by, bz, mat) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat || trimMat);
          m.position.set(bx, by, bz);
          m.castShadow = true;
          m.receiveShadow = true;
          group.add(m);
        };
        box(w, f, frameD, cx, top, 0);
        box(w, f, frameD, cx, sill, 0);
        box(f, h, frameD, cx - w / 2 + f / 2, sill + h / 2, 0);
        box(f, h, frameD, cx + w / 2 - f / 2, sill + h / 2, 0);
        const mullions = w > 1.6 ? 2 : 1;
        for (let i = 1; i <= mullions; i++) {
          const x = cx - w / 2 + (w / (mullions + 1)) * i;
          box(0.025, h - f * 2, frameD * 0.7, x, sill + h / 2, 0, trimMat);
        }
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - f * 2, h - f * 2), glassMat);
        glass.position.set(cx, sill + h / 2, 0);
        group.add(glass);
        // exterior sill board
        box(w + 0.12, 0.04, t + 0.16, cx, sill - 0.035, 0, woodMat);
      } else if (pl.op.kind === 'opening') {
        const h = Math.min(pl.height, H - 0.05);
        const f = 0.035;
        const box = (bw, bh, bd, bx, by) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), trimMat);
          m.position.set(bx, by, 0);
          m.castShadow = true;
          m.receiveShadow = true;
          group.add(m);
        };
        box(f, h, frameD, cx - w / 2 + f / 2, h / 2);
        box(f, h, frameD, cx + w / 2 - f / 2, h / 2);
        box(w, f, frameD, cx, h);
      } else {
        const h = Math.min(pl.height, H - 0.05);
        const f = 0.045;
        const box = (bw, bh, bd, bx, by, bz, mat) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
          m.position.set(bx, by, bz || 0);
          m.castShadow = true;
          m.receiveShadow = true;
          group.add(m);
        };
        box(f, h, frameD, cx - w / 2 + f / 2, h / 2, 0, trimMat);
        box(f, h, frameD, cx + w / 2 - f / 2, h / 2, 0, trimMat);
        box(w, f, frameD, cx, h, 0, trimMat);

        if (pl.op.style === 'sliding') {
          const panelW = w / 2 - 0.03;
          const panelH = h - 0.07;
          const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.linen), roughness: 0.7, transparent: true, opacity: 0.94 });
          box(panelW, panelH, 0.035, cx - w / 4, panelH / 2 + 0.01, -0.025, mat);
          box(panelW, panelH, 0.035, cx + w / 4, panelH / 2 + 0.01, 0.025, mat);
          box(0.018, 0.4, 0.02, cx - 0.06, 1.05, 0.055, trimMat);
          box(0.018, 0.4, 0.02, cx + 0.06, 1.05, -0.055, trimMat);
        } else if (pl.op.style === 'bifold') {
          // Double bifold closet door: 4 folding leaves
          const leafW = (w - 0.08) / 4;
          const leafH = h - 0.06;
          const fold = 0.72;

          box(w, 0.035, 0.035, cx, h - 0.02, 0, trimMat);

          const gL1 = new THREE.Group();
          gL1.position.set(cx - w / 2 + 0.04, 0, 0);
          gL1.rotation.y = fold;
          const mL1 = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat);
          mL1.position.set(leafW / 2, leafH / 2 + 0.02, 0);
          mL1.castShadow = true;
          gL1.add(mL1);

          const gL2 = new THREE.Group();
          gL2.position.set(leafW, 0, 0);
          gL2.rotation.y = -fold * 2;
          const mL2 = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat);
          mL2.position.set(leafW / 2, leafH / 2 + 0.02, 0);
          mL2.castShadow = true;
          gL2.add(mL2);

          const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), trimMat);
          handleL.position.set(leafW - 0.04, 1.05, 0.028);
          gL2.add(handleL);
          gL1.add(gL2);
          group.add(gL1);

          const gR1 = new THREE.Group();
          gR1.position.set(cx + w / 2 - 0.04, 0, 0);
          gR1.rotation.y = -fold;
          const mR1 = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat);
          mR1.position.set(-leafW / 2, leafH / 2 + 0.02, 0);
          mR1.castShadow = true;
          gR1.add(mR1);

          const gR2 = new THREE.Group();
          gR2.position.set(-leafW, 0, 0);
          gR2.rotation.y = fold * 2;
          const mR2 = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat);
          mR2.position.set(-leafW / 2, leafH / 2 + 0.02, 0);
          mR2.castShadow = true;
          gR2.add(mR2);

          const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), trimMat);
          handleR.position.set(-leafW + 0.04, 1.05, 0.028);
          gR2.add(handleR);
          gR1.add(gR2);
          group.add(gR1);
        } else {
          const leaves = pl.op.style === 'double' ? 2 : 1;
          const leafW = (w - 0.08) / leaves;
          const leafH = h - 0.06;
          for (let i = 0; i < leaves; i++) {
            const side = i === 0 ? 1 : -1;
            const hingeX = side > 0 ? cx - w / 2 + 0.04 : cx + w / 2 - 0.04;
            const hinge = new THREE.Group();
            hinge.position.set(hingeX, 0, 0);
            hinge.rotation.y = side * 0.82;
            const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.042), woodMat);
            leaf.position.set((side > 0 ? 1 : -1) * leafW / 2, leafH / 2 + 0.02, 0);
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            hinge.add(leaf);
            // panel inset
            const inset = new THREE.Mesh(
              new THREE.BoxGeometry(leafW - 0.14, leafH - 0.28, 0.008),
              new THREE.MeshStandardMaterial({ color: new THREE.Color(style.cabinet), roughness: 0.72 })
            );
            inset.position.set((side > 0 ? 1 : -1) * leafW / 2, leafH / 2 + 0.02, 0.024);
            hinge.add(inset);
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), trimMat);
            knob.position.set((side > 0 ? 1 : -1) * (leafW - 0.1), 1.02, 0.05);
            hinge.add(knob);
            group.add(hinge);
          }
        }
        // threshold
        box(w + 0.04, 0.02, t + 0.04, cx, 0.01, 0, trimMat);
      }
    }

    buildFurniture(plan, items, style, H) {
      const group = new THREE.Group();
      items.forEach((item) => {
        try {
          const g = FC.buildFurniture3D(item, style, H);
          group.add(g);
        } catch (err) {
          /* Keep the house usable even if one item fails */
        }
      });
      this.furnitureGroup = group;
      this.world.add(group);
    }

    buildCeiling(plan, rooms, style, H) {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(style.wall),
        roughness: 0.95,
        side: THREE.DoubleSide,
      });
      rooms.forEach((room) => {
        if (!room.polygon || room.polygon.length < 3) return;
        const shape = new THREE.Shape();
        room.polygon.forEach((p, i) => {
          if (i === 0) shape.moveTo(p.x, -p.y);
          else shape.lineTo(p.x, -p.y);
        });
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = H - 0.01;
        mesh.receiveShadow = true;
        group.add(mesh);
      });
      this.ceilingGroup = group;
      this.structure.add(group);
    }

    buildLights(plan) {
      if (this.userLightsGroup) {
        disposeObject(this.userLightsGroup);
      }
      this.userLightsGroup = new THREE.Group();
      this.world.add(this.userLightsGroup);

      const lights = plan.lights || [];
      lights.forEach((l) => {
        const col = new THREE.Color(l.color || '#fff1de');
        const intensity = (l.intensity != null ? l.intensity : 1.0) * 1.8;
        const dist = (l.range || 6.0) * 1.2;

        const pLight = new THREE.PointLight(col, intensity, dist, 2);
        pLight.position.set(l.x, l.z || 2.4, l.y);
        pLight.castShadow = true;
        pLight.shadow.bias = -0.002;
        pLight.shadow.mapSize.set(512, 512);
        this.userLightsGroup.add(pLight);

        // Fixture mesh (glow bulb and casing)
        const fixGroup = new THREE.Group();
        fixGroup.position.copy(pLight.position);

        const bulbGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const bulbMat = new THREE.MeshBasicMaterial({ color: col });
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        fixGroup.add(bulbMesh);

        if (l.type === 'pendant') {
          const H = (plan.settings && plan.settings.wallHeight) || 2.7;
          const cordLen = Math.max(0.15, H - (l.z || 2.4));
          const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, cordLen);
          const cordMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
          const cord = new THREE.Mesh(cordGeo, cordMat);
          cord.position.y = cordLen / 2;
          fixGroup.add(cord);
        } else if (l.type === 'lamp') {
          const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, l.z || 1.6);
          const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b });
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.y = -(l.z || 1.6) / 2;
          fixGroup.add(pole);
        }

        this.userLightsGroup.add(fixGroup);
      });
    }

    /* ---------------------------------------------------------------- */
    /* Transitions & Export                                             */
    /* ---------------------------------------------------------------- */

    startTransition(dir, onDone) {
      this.isTransitioning = true;
      this.transitionDir = dir;
      this.transitionStart = performance.now();
      this.transitionDuration = dir === 'in' ? 950 : 450;
      this.onTransitionEnd = onDone;
      const b = FC.planBounds(this.app.plan);

      if (dir === 'in') {
        this.transitionProgress = 0.001;
        if (this.structure) this.structure.scale.y = 0.001;
        if (this.furnitureGroup) {
          this.furnitureGroup.scale.y = 0.001;
          this.furnitureGroup.position.y = -0.15;
        }
        this.orbit.pitch = 1.55; // Straight top-down
        this.orbit.yaw = 0;
        this.orbit.tx = b.cx;
        this.orbit.tz = b.cy;
        this.orbit.ty = 0;
        this.orbit.dist = Math.max(9, Math.max(b.w, b.d) * 1.5 + 2);
        this.goal.pitch = 0.82; // Perspective dollhouse view
        this.goal.yaw = -0.65;
        this.goal.ty = 0.9;
        this.goal.dist = Math.max(9, Math.max(b.w, b.d) * 1.8 + 2);
      } else {
        this.goal.pitch = 1.55;
        this.goal.yaw = 0;
        this.goal.ty = 0;
      }
    }

    exportGLB() {
      if (!this.world) this.build();
      if (!window.THREE || !window.THREE.GLTFExporter) {
        return Promise.reject(new Error('GLTFExporter is not loaded.'));
      }
      const exporter = new window.THREE.GLTFExporter();
      const exportGroup = new THREE.Group();
      this.world.traverse((child) => {
        if (child.isMesh && child !== this.ground && child !== this.grid) {
          exportGroup.add(child.clone());
        }
      });
      return new Promise((resolve, reject) => {
        exporter.parse(
          exportGroup,
          (gltf) => {
            const blob = new Blob([gltf], { type: 'model/gltf-binary' });
            resolve(blob);
          },
          (err) => reject(err),
          { binary: true }
        );
      });
    }

    /* ---------------------------------------------------------------- */
    /* Lighting                                                         */
    /* ---------------------------------------------------------------- */

    updateLighting() {
      if (!this.renderer) return;
      const plan = this.app.plan;
      const time = plan.view && typeof plan.view.sunTime === 'number' ? plan.view.sunTime : 14.5;
      const day = FC.clamp(Math.sin(((time - 6) / 13.5) * Math.PI), 0, 1);
      const night = day < 0.06;
      const azimuth = ((time - 6) / 13.5) * Math.PI;
      const b = FC.planBounds(plan);
      const radius = Math.max(18, Math.max(b.w, b.d) * 2.2);
      if (this.sun) {
        this.sun.position.set(b.cx + Math.cos(azimuth) * radius, 4 + day * 14, b.cy - 10 - Math.sin(azimuth) * 7);
        this.sun.target.position.set(b.cx, 0, b.cy);
        this.sun.intensity = 0.12 + day * 1.05;
        const warm = new THREE.Color('#ffa15e');
        const neutral = new THREE.Color('#fff6e6');
        this.sun.color.copy(day < 0.55 ? warm.lerp(neutral, FC.clamp((day - 0.1) / 0.45, 0, 1)) : neutral);
        this.sun.castShadow = day > 0.08;
        this.updateShadowFrustum(b);
      }
      if (this.hemi) {
        this.hemi.intensity = 0.07 + day * 0.34;
        this.hemi.color.set(day > 0.2 ? '#f7f4ee' : '#93a3bf');
        this.hemi.groundColor.set(day > 0.2 ? '#8f8474' : '#2f3542');
      }
      if (this.ambient) this.ambient.intensity = 0.05 + day * 0.14;

      if (this.ground) {
        if (day > 0.12) {
          const golden = new THREE.Color('#c6a37a').lerp(new THREE.Color('#d7cdbf'), FC.clamp((day - 0.12) / 0.45, 0, 1));
          this.ground.material.color.copy(golden);
        } else {
          this.ground.material.color.set('#2b3340');
        }
      }
      if (this.grid) {
        this.grid.material.opacity = 0.16 + day * 0.24;
      }

      // room lights for evening / night
      if (this.world) {
        const existing = this.roomLights.length;
        if (existing === 0 && this.app.rooms) {
          this.app.rooms.forEach((room) => {
            const light = new THREE.PointLight(0xffce8a, 0, 7.5, 2);
            light.position.set(room.centroid.x, 2.15, room.centroid.y);
            this.roomLights.push(light);
            this.world.add(light);
          });
        }
        this.roomLights.forEach((l) => {
          l.intensity = (1 - day) * (1 - day) * 1.5;
        });
      }
      this.updateBackgroundGradient(day, time);
      this.needsRender = true;
    }

    updateBackgroundGradient(day, time) {
      if (!this.wrap) return;
      let top;
      let bottom;
      if (day > 0.55) {
        top = '#fbfaf7';
        bottom = '#e3dccf';
      } else if (day > 0.12) {
        top = '#f7d9b9';
        bottom = '#b58e69';
      } else {
        top = '#232b37';
        bottom = '#12161d';
      }
      this.wrap.style.background = 'radial-gradient(ellipse at 50% 26%, ' + top + ' 0%, ' + bottom + ' 100%)';
      this.wrap.classList.toggle('night', day <= 0.03);
    }

    setLightingFog() {
      /* Reserved for future fog / environment tweaks */
    }

    applyXray(on) {
      this.wallMats.forEach((m) => {
        m.transparent = !!on;
        m.opacity = on ? 0.28 : 1;
        m.depthWrite = !on;
        m.needsUpdate = true;
      });
      this.needsRender = true;
    }

    /* ---------------------------------------------------------------- */
    /* Camera + loop                                                    */
    /* ---------------------------------------------------------------- */

    onDown(e) {
      if (!this.active) return;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
      this.dragging = {
        x: e.clientX,
        y: e.clientY,
        mode: e.button === 0 && !e.shiftKey ? 'rotate' : 'pan',
      };
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }

    onMove(e) {
      if (!this.active || !this.dragging) return;
      const dx = e.clientX - this.dragging.x;
      const dy = e.clientY - this.dragging.y;
      this.dragging.x = e.clientX;
      this.dragging.y = e.clientY;
      if (this.dragging.mode === 'rotate') {
        this.goal.yaw -= dx * 0.006;
        const invert = this.app.plan.settings.invertPitch ?? true;
        const sign = invert ? 1 : -1;
        this.goal.pitch = FC.clamp(this.goal.pitch + sign * dy * 0.005, 0.08, 1.52);
      } else {
        const f = this.goal.dist * 0.0018;
        const right = { x: Math.cos(this.goal.yaw), z: -Math.sin(this.goal.yaw) };
        const fwd = { x: -Math.sin(this.goal.yaw), z: -Math.cos(this.goal.yaw) };
        this.goal.tx -= right.x * dx * f - fwd.x * dy * f;
        this.goal.tz -= right.z * dx * f - fwd.z * dy * f;
      }
    }

    onUp() {
      this.dragging = null;
      this.canvas.style.cursor = 'grab';
    }

    animate() {
      requestAnimationFrame(this.animate);
      if (!this.active) return;
      if (this.needsBuild) this.build();

      if (this.isTransitioning) {
        const now = performance.now();
        const elapsed = now - this.transitionStart;
        const dur = this.transitionDuration || 900;
        const t = Math.min(1, elapsed / dur);
        // Smooth easeInOutCubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.transitionProgress = this.transitionDir === 'in' ? ease : 1 - ease;
        if (this.structure) this.structure.scale.y = Math.max(0.001, this.transitionProgress);
        if (this.furnitureGroup) {
          this.furnitureGroup.scale.y = Math.max(0.001, this.transitionProgress);
          this.furnitureGroup.position.y = (this.transitionProgress - 1) * 0.15;
        }
        if (t >= 1) {
          this.isTransitioning = false;
          if (this.structure) this.structure.scale.y = this.transitionDir === 'in' ? 1 : 0.001;
          if (this.furnitureGroup) {
            this.furnitureGroup.scale.y = this.transitionDir === 'in' ? 1 : 0.001;
            this.furnitureGroup.position.y = 0;
          }
          if (this.onTransitionEnd) {
            const cb = this.onTransitionEnd;
            this.onTransitionEnd = null;
            cb();
          }
        }
      }

      const dt = Math.min(0.05, this.clock ? this.clock.getDelta() : 0.016);
      if (this.app.plan.view && this.app.plan.view.autoRotate && !this.dragging && !this.isTransitioning) {
        this.goal.yaw += dt * 0.16;
      }
      const k = this.isTransitioning ? 0.09 : 0.16;
      this.orbit.yaw += (this.goal.yaw - this.orbit.yaw) * k;
      this.orbit.pitch += (this.goal.pitch - this.orbit.pitch) * k;
      this.orbit.dist += (this.goal.dist - this.orbit.dist) * k;
      this.orbit.tx += (this.goal.tx - this.orbit.tx) * k;
      this.orbit.ty += (this.goal.ty - this.orbit.ty) * k;
      this.orbit.tz += (this.goal.tz - this.orbit.tz) * k;

      const p = this.orbit;
      this.camera.position.set(
        p.tx + Math.sin(p.yaw) * Math.cos(p.pitch) * p.dist,
        p.ty + Math.sin(p.pitch) * p.dist,
        p.tz + Math.cos(p.yaw) * Math.cos(p.pitch) * p.dist
      );
      this.camera.lookAt(p.tx, p.ty, p.tz);
      this.renderer.render(this.scene, this.camera);
    }

    screenshot() {
      if (!this.renderer) return null;
      this.renderer.render(this.scene, this.camera);
      return this.canvas.toDataURL('image/png');
    }
  }

  FC.Viewer3D = Viewer3D;
})();

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
      this.furnitureMeshes = new Map();
      this.selectionGizmo = null;
      this.raycaster = null;
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
      this.slabMesh = null;
      this.floorMeshes = [];
      this.wallMeshes = [];
      this.openingGroups = [];
      this.ceilingMeshes = [];
      this.lightFixtureGroups = [];

      this.world = new THREE.Group();
      this.world.name = 'World';
      this.scene.add(this.world);

      this.structure = new THREE.Group();
      this.structure.name = 'Structure';
      this.world.add(this.structure);

      this.furnitureGroup = new THREE.Group();
      this.furnitureGroup.name = 'Furniture';
      this.world.add(this.furnitureGroup);

      this.userLightsGroup = new THREE.Group();
      this.userLightsGroup.name = 'Lighting';
      this.world.add(this.userLightsGroup);

      const style = (plan.style === 'custom' && plan.customStyle)
        ? plan.customStyle
        : FC.styles[plan.style] || FC.styles.scandinavian;
      const s = plan.settings;
      const H = s.wallHeight;
      const b = FC.planBounds(plan);

      this.buildGround(b, style);
      this.buildSlab(plan, style, H, b);
      this.buildFloors(plan, this.app.rooms || [], style);
      this.buildWalls(plan, FC.getSegments(plan), style, H);
      if (plan.furnished) this.buildFurniture(plan, this.app.furniture || [], style, H);
      if (plan.view && plan.view.ceiling) this.buildCeiling(plan, this.app.rooms || [], style, H);
      this.buildLights(plan);
      this.updateSelectionGizmo();
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
      this.world.name = 'World';
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
      geo.name = 'Ground_Plane';
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#d7cdbf'), roughness: 1, metalness: 0 });
      mat.name = 'Ground_Material';
      const ground = new THREE.Mesh(geo, mat);
      ground.name = 'Ground_Plane';
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(b.cx, -0.22, b.cy);
      ground.receiveShadow = true;
      this.world.add(ground);

      const gridSize = Math.max(28, Math.ceil(Math.max(b.w, b.d) + 16));
      const grid = new THREE.GridHelper(gridSize, Math.round(gridSize * 2), 0xcfc8bc, 0xdcd6cb);
      grid.name = 'World_Grid';
      grid.position.set(b.cx, -0.2, b.cy);
      grid.material.opacity = 0.38;
      grid.material.transparent = true;
      this.world.add(grid);
      this.ground = ground;
      this.grid = grid;
    }

    buildSlab(plan, style, H, bounds) {
      const b = bounds || FC.planBounds(plan);
      const shape = new THREE.Shape();
      plan.outline.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, -p.y);
        else shape.lineTo(p.x, -p.y);
      });
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: plan.settings.slabThickness, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.translate(-b.cx, -plan.settings.slabThickness, -b.cy);
      geo.name = 'Foundation_Slab';
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(blend(style.stone, '#8b8378', 0.25)), roughness: 0.95 });
      mat.name = 'Foundation_Slab_Concrete';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'Foundation_Slab';
      mesh.position.set(b.cx, -0.001, b.cy);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { isSlab: true };
      this.slabMesh = mesh;
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
      this.floorMeshes = [];
      rooms.forEach((room, idx) => {
        if (!room.polygon || room.polygon.length < 3) return;
        const cx = (room.centroid && room.centroid.x) || 0;
        const cy = (room.centroid && room.centroid.y) || 0;
        const roomLabel = String(room.name || (FC.roomTypes[room.type] && FC.roomTypes[room.type].label) || ('Room_' + (idx + 1)))
          .replace(/&/g, 'and')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

        const shape = new THREE.Shape();
        room.polygon.forEach((p, i) => {
          if (i === 0) shape.moveTo(p.x, -p.y);
          else shape.lineTo(p.x, -p.y);
        });
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        geo.translate(-cx, 0, -cy);
        geo.name = `${roomLabel}_Floor`;
        const offsetIndex = idx % 8;
        const floorY = 0.006 + (idx % 12) * 0.00025;
        const mat = new THREE.MeshStandardMaterial({
          color: this.floorColorFor(room, style),
          roughness: room.type === 'bathroom' || room.type === 'kitchen' ? 0.55 : 0.82,
          metalness: 0,
          // Stagger overlapping floor meshes so coplanar room seams never Z-fight
          polygonOffset: true,
          polygonOffsetFactor: -offsetIndex,
          polygonOffsetUnits: -1,
        });
        mat.name = `Floor_${roomLabel}`;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `${roomLabel}_Floor`;
        mesh.position.set(cx, floorY, cy);
        mesh.renderOrder = offsetIndex;
        mesh.receiveShadow = true;
        mesh.userData = { isFloor: true, roomId: room.id, roomLabel, cx, cy };
        this.floorMeshes.push(mesh);
        this.world.add(mesh);

        // Plank / tile joints for a more architectural floor (excluded from GLB export)
        if (room.area > 5 && this.app.plan.style !== 'urbanloft') {
          const bb = room.bounds;
          const lines = [];
          const step = room.type === 'bathroom' || room.type === 'kitchen' ? 0.6 : 0.9;
          const horizontal = bb.w > bb.d;
          const n = Math.ceil((horizontal ? bb.d : bb.w) / step);
          for (let i = 1; i < n; i++) {
            const jointY = floorY + 0.003;
            if (horizontal) {
              const z = bb.y0 + i * step;
              lines.push(bb.x0 + 0.05, jointY, z, bb.x1 - 0.05, jointY, z);
            } else {
              const x = bb.x0 + i * step;
              lines.push(x, jointY, bb.y0 + 0.05, x, jointY, bb.y1 - 0.05);
            }
          }
          if (lines.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
            const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.055 }));
            line.name = `${roomLabel}_Floor_Joints`;
            line.userData = { isWireframeLine: true, roomId: room.id };
            this.world.add(line);
          }
        }
      });
    }

    buildWalls(plan, segs, style, H) {
      const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.wall), roughness: 0.95, metalness: 0 });
      wallMat.name = 'Wall_Interior';
      const wallOutMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.wallOutside), roughness: 0.95, metalness: 0 });
      wallOutMat.name = 'Wall_Exterior';
      // Darker section caps make the cutaway read like an architectural model.
      const capMat = new THREE.MeshStandardMaterial({
        color: blend(style.wallOutside, '#4a443a', 0.82),
        roughness: 0.9,
        metalness: 0,
      });
      capMat.name = 'Wall_Section_Cap';
      this.wallMats = [wallMat, wallOutMat, capMat];
      this.wallMeshes = [];
      this.openingGroups = [];

      let extCount = 0;
      let intCount = 0;

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

        const isExt = !!seg.boundary;
        const wallName = isExt ? `Exterior_Wall_${++extCount}` : `Interior_Wall_${++intCount}`;
        const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
        geo.translate(0, 0, -t / 2);
        geo.name = wallName;
        const mesh = new THREE.Mesh(geo, [isExt ? wallOutMat : wallMat, capMat]);
        mesh.name = wallName;
        mesh.position.set((seg.a.x + seg.b.x) / 2, 0, (seg.a.y + seg.b.y) / 2);
        mesh.rotation.y = -seg.angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { isWall: true, isExterior: isExt, segKey: seg.key, wallName };
        this.wallMeshes.push(mesh);
        this.structure.add(mesh);

        // Fine architectural outline keeps wall tops and openings legible in live 3D view
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x4c4841, transparent: true, opacity: 0.16 });
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 32), edgeMat);
        edges.name = `${wallName}_Edges`;
        edges.position.copy(mesh.position);
        edges.rotation.copy(mesh.rotation);
        edges.userData = { isWireframeLine: true };
        this.structure.add(edges);

        // Opening details positioned directly at each opening's world center
        ops.forEach((pl) => {
          const opGroup = this.buildOpeningDetail(this.structure, pl, L, t, H, style);
          if (opGroup) this.openingGroups.push(opGroup);
        });
      });
    }

    buildOpeningDetail(parentGroup, pl, L, t, H, style) {
      const w = Math.min(pl.width, L - 0.12);
      const trimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.dark), roughness: 0.72 });
      trimMat.name = 'Opening_Trim';
      const woodMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.wood), roughness: 0.66 });
      woodMat.name = 'Opening_Wood';
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#c2dce4'),
        transparent: true,
        opacity: 0.24,
        roughness: 0.05,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      glassMat.name = 'Window_Glass';
      const frameD = t + 0.02;

      let baseLabel = 'Single_Door';
      if (pl.op.kind === 'window') {
        baseLabel = 'Window';
      } else if (pl.op.kind === 'opening') {
        baseLabel = 'Passage';
      } else if (pl.op.style === 'double') {
        baseLabel = 'Double_Door';
      } else if (pl.op.style === 'sliding') {
        baseLabel = 'Sliding_Door';
      } else if (pl.op.style === 'bifold') {
        baseLabel = 'Bifold_Door';
      }

      const group = new THREE.Group();
      group.name = baseLabel;
      group.position.set(pl.x, 0, pl.y);
      group.rotation.y = -pl.angle;
      group.userData = {
        isOpening: true,
        openingKind: pl.op.kind,
        openingStyle: pl.op.style || 'single',
        openingId: pl.op.id,
        baseLabel,
      };
      parentGroup.add(group);

      const addPartMesh = (target, geo, mat, bx, by, bz, partName) => {
        if (geo && partName) geo.name = partName;
        const m = new THREE.Mesh(geo, mat || trimMat);
        if (partName) {
          m.name = partName;
          m.userData = { partName };
        }
        m.position.set(bx || 0, by || 0, bz || 0);
        m.castShadow = true;
        m.receiveShadow = true;
        target.add(m);
        return m;
      };

      const box = (bw, bh, bd, bx, by, bz, mat, partName) =>
        addPartMesh(group, new THREE.BoxGeometry(bw, bh, bd), mat || trimMat, bx, by, bz, partName);

      if (pl.op.kind === 'window') {
        const sill = FC.clamp(pl.sill, 0.05, H - 0.2);
        const h = Math.max(0.15, Math.min(pl.height, H - sill - 0.04));
        const top = sill + h;
        const f = 0.045;
        box(w, f, frameD, 0, top, 0, trimMat, 'Window_Frame_Top');
        box(w, f, frameD, 0, sill, 0, trimMat, 'Window_Frame_Bottom');
        box(f, h, frameD, -w / 2 + f / 2, sill + h / 2, 0, trimMat, 'Window_Frame_Left');
        box(f, h, frameD, w / 2 - f / 2, sill + h / 2, 0, trimMat, 'Window_Frame_Right');
        const mullions = w > 1.6 ? 2 : 1;
        for (let i = 1; i <= mullions; i++) {
          const x = -w / 2 + (w / (mullions + 1)) * i;
          box(0.025, h - f * 2, frameD * 0.7, x, sill + h / 2, 0, trimMat, mullions > 1 ? `Window_Mullion_${i}` : 'Window_Mullion');
        }
        const glassGeo = new THREE.PlaneGeometry(w - f * 2, h - f * 2);
        glassGeo.name = 'Window_Glass';
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.name = 'Window_Glass';
        glass.userData = { partName: 'Window_Glass' };
        glass.position.set(0, sill + h / 2, 0);
        group.add(glass);
        // exterior sill board
        box(w + 0.12, 0.04, t + 0.16, 0, sill - 0.035, 0, woodMat, 'Window_Sill');
      } else if (pl.op.kind === 'opening') {
        const h = Math.min(pl.height, H - 0.05);
        const f = 0.035;
        box(f, h, frameD, -w / 2 + f / 2, h / 2, 0, trimMat, 'Passage_Frame_Left');
        box(f, h, frameD, w / 2 - f / 2, h / 2, 0, trimMat, 'Passage_Frame_Right');
        box(w, f, frameD, 0, h, 0, trimMat, 'Passage_Frame_Top');
      } else {
        const h = Math.min(pl.height, H - 0.05);
        const f = 0.045;
        box(f, h, frameD, -w / 2 + f / 2, h / 2, 0, trimMat, 'Door_Frame_Left');
        box(f, h, frameD, w / 2 - f / 2, h / 2, 0, trimMat, 'Door_Frame_Right');
        box(w, f, frameD, 0, h, 0, trimMat, 'Door_Frame_Top');

        const swingSign = pl.op.swingSide === -1 ? -1 : 1;

        if (pl.op.style === 'sliding') {
          const panelW = w / 2 - 0.03;
          const panelH = h - 0.07;
          const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.linen), roughness: 0.7, transparent: true, opacity: 0.94 });
          mat.name = 'Sliding_Door_Panel';
          box(panelW, panelH, 0.035, -w / 4, panelH / 2 + 0.01, -0.025 * swingSign, mat, 'Sliding_Panel_Left');
          box(panelW, panelH, 0.035, w / 4, panelH / 2 + 0.01, 0.025 * swingSign, mat, 'Sliding_Panel_Right');
          box(0.018, 0.4, 0.02, -0.06, 1.05, 0.055 * swingSign, trimMat, 'Sliding_Handle_Left');
          box(0.018, 0.4, 0.02, 0.06, 1.05, -0.055 * swingSign, trimMat, 'Sliding_Handle_Right');
        } else if (pl.op.style === 'bifold') {
          // Double bifold closet door: 4 folding leaves
          const leafW = (w - 0.08) / 4;
          const leafH = h - 0.06;
          const fold = 0.72;

          box(w, 0.035, 0.035, 0, h - 0.02, 0, trimMat, 'Bifold_Header_Track');

          const gL1 = new THREE.Group();
          gL1.name = 'Bifold_Hinge_Left_Inner';
          gL1.userData = { partName: 'Bifold_Hinge_Left_Inner' };
          gL1.position.set(-w / 2 + 0.04, 0, 0);
          // Local +Z is the wall normal used by the 2D plan, so folding toward the
          // plan's swing side requires a negative Y rotation for +X-pointing leaves.
          gL1.rotation.y = -fold * swingSign;
          addPartMesh(gL1, new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat, leafW / 2, leafH / 2 + 0.02, 0, 'Bifold_Leaf_Left_1');

          const gL2 = new THREE.Group();
          gL2.name = 'Bifold_Hinge_Left_Outer';
          gL2.userData = { partName: 'Bifold_Hinge_Left_Outer' };
          gL2.position.set(leafW, 0, 0);
          gL2.rotation.y = fold * 2 * swingSign;
          addPartMesh(gL2, new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat, leafW / 2, leafH / 2 + 0.02, 0, 'Bifold_Leaf_Left_2');
          addPartMesh(gL2, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), trimMat, leafW - 0.04, 1.05, 0.028 * swingSign, 'Bifold_Handle_Left');
          gL1.add(gL2);
          group.add(gL1);

          const gR1 = new THREE.Group();
          gR1.name = 'Bifold_Hinge_Right_Inner';
          gR1.userData = { partName: 'Bifold_Hinge_Right_Inner' };
          gR1.position.set(w / 2 - 0.04, 0, 0);
          gR1.rotation.y = fold * swingSign;
          addPartMesh(gR1, new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat, -leafW / 2, leafH / 2 + 0.02, 0, 'Bifold_Leaf_Right_1');

          const gR2 = new THREE.Group();
          gR2.name = 'Bifold_Hinge_Right_Outer';
          gR2.userData = { partName: 'Bifold_Hinge_Right_Outer' };
          gR2.position.set(-leafW, 0, 0);
          gR2.rotation.y = -fold * 2 * swingSign;
          addPartMesh(gR2, new THREE.BoxGeometry(leafW, leafH, 0.036), woodMat, -leafW / 2, leafH / 2 + 0.02, 0, 'Bifold_Leaf_Right_2');
          addPartMesh(gR2, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), trimMat, -leafW + 0.04, 1.05, 0.028 * swingSign, 'Bifold_Handle_Right');
          gR1.add(gR2);
          group.add(gR1);
        } else {
          const leaves = pl.op.style === 'double' ? 2 : 1;
          const leafW = (w - 0.08) / leaves;
          const leafH = h - 0.06;
          const insetMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(style.cabinet), roughness: 0.72 });
          insetMat.name = 'Door_Panel_Inset';
          for (let i = 0; i < leaves; i++) {
            let side = i === 0 ? 1 : -1;
            if (leaves === 1) {
              side = pl.op.hinge === 'right' ? -1 : 1;
            }
            const leafTag = leaves > 1 ? (i === 0 ? '_Left' : '_Right') : '';
            const hingeX = side > 0 ? -w / 2 + 0.04 : w / 2 - 0.04;
            const hinge = new THREE.Group();
            hinge.name = `Door_Hinge${leafTag}`;
            hinge.userData = { partName: `Door_Hinge${leafTag}` };
            hinge.position.set(hingeX, 0, 0);
            hinge.rotation.y = -side * swingSign * 0.82;
            addPartMesh(hinge, new THREE.BoxGeometry(leafW, leafH, 0.042), woodMat, (side > 0 ? 1 : -1) * leafW / 2, leafH / 2 + 0.02, 0, `Door_Leaf${leafTag}`);
            addPartMesh(hinge, new THREE.BoxGeometry(leafW - 0.14, leafH - 0.28, 0.008), insetMat, (side > 0 ? 1 : -1) * leafW / 2, leafH / 2 + 0.02, 0.024 * swingSign, `Door_Panel_Inset${leafTag}`);
            addPartMesh(hinge, new THREE.SphereGeometry(0.035, 10, 8), trimMat, (side > 0 ? 1 : -1) * (leafW - 0.1), 1.02, 0.05 * swingSign, `Door_Knob${leafTag}`);
            group.add(hinge);
          }
        }
        // threshold
        box(w + 0.04, 0.02, t + 0.04, 0, 0.01, 0, trimMat, 'Door_Threshold');
      }
      return group;
    }

    buildFurniture(plan, items, style, H) {
      if (!this.furnitureGroup) {
        this.furnitureGroup = new THREE.Group();
        this.furnitureGroup.name = 'Furniture';
        this.world.add(this.furnitureGroup);
      }
      this.furnitureMeshes = new Map();
      items.forEach((item) => {
        try {
          const g = FC.buildFurniture3D(item, style, H);
          g.userData = Object.assign(g.userData || {}, {
            isFurniture: true,
            furnitureId: item.id,
            furnitureKind: item.kind,
            roomId: item.roomId || null,
          });
          if (typeof g.traverse === 'function') {
            g.traverse((node) => {
              node.userData = Object.assign(node.userData || {}, {
                furnitureId: item.id,
              });
            });
          }
          this.furnitureMeshes.set(item.id, g);
          this.furnitureGroup.add(g);
        } catch (err) {
          /* Keep the house usable even if one item fails */
        }
      });
    }

    syncFurnitureTransform(item) {
      if (!item) return;
      const g = this.furnitureMeshes && this.furnitureMeshes.get(item.id);
      if (g && g.position && g.rotation) {
        g.position.set(item.x, 0.002, item.y);
        g.rotation.y = -(item.rot || 0);
      }
      if (
        this.selectionGizmo &&
        this.selectionGizmo.userData &&
        this.selectionGizmo.userData.furnitureId === item.id &&
        this.selectionGizmo.position &&
        this.selectionGizmo.rotation
      ) {
        this.selectionGizmo.position.set(item.x, 0.005, item.y);
        this.selectionGizmo.rotation.y = -(item.rot || 0);
      } else {
        this.updateSelectionGizmo();
      }
      this.needsRender = true;
    }

    updateSelectionGizmo() {
      if (this.selectionGizmo) {
        disposeObject(this.selectionGizmo);
        this.selectionGizmo = null;
      }
      if (!this.world || !this.app || !this.app.ui) return;
      const sel = this.app.ui.selection;
      if (!sel || sel.type !== 'furniture' || !this.app.plan || !this.app.plan.furnished) {
        this.needsRender = true;
        return;
      }
      const item = (this.app.furniture || []).find((f) => f.id === sel.id);
      if (!item) return;

      const gizmo = new THREE.Group();
      gizmo.name = 'Selection_Gizmo';
      gizmo.userData = { isGizmo: true, furnitureId: item.id };
      gizmo.position.set(item.x, 0.005, item.y);
      gizmo.rotation.y = -(item.rot || 0);

      const w = (item.w || 0.8) + 0.08;
      const d = (item.d || 0.8) + 0.08;
      const h = Math.max(0.06, item.h || 0.75);
      const elev = item.elev || 0;

      // 3D selection wireframe box
      const boxGeo = new THREE.BoxGeometry(w, h, d);
      const edgeGeo = new THREE.EdgesGeometry(boxGeo);
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x5b4bf6,
        transparent: true,
        opacity: 0.9,
      });
      const wireBox = new THREE.LineSegments(edgeGeo, edgeMat);
      wireBox.position.set(0, elev + h / 2, 0);
      gizmo.add(wireBox);
      if (boxGeo && typeof boxGeo.dispose === 'function') boxGeo.dispose();

      // Subtle translucent floor footprint highlight
      const plateGeo = new THREE.PlaneGeometry(w, d);
      if (typeof plateGeo.rotateX === 'function') plateGeo.rotateX(-Math.PI / 2);
      const plateMat = new THREE.MeshBasicMaterial({
        color: 0x5b4bf6,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.set(0, 0.006, 0);
      plate.userData = { furnitureId: item.id };
      gizmo.add(plate);

      // Interactive 3D rotation handle extending from front (+Z in local furniture space)
      const stemLen = 0.42;
      const handleZ = d / 2 + stemLen;
      const handleY = Math.min(0.22, Math.max(0.05, elev + 0.05));
      const accentMat = new THREE.MeshBasicMaterial({ color: 0x5b4bf6 });
      const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, stemLen, 10);
      if (typeof stemGeo.rotateX === 'function') stemGeo.rotateX(Math.PI / 2);
      const stem = new THREE.Mesh(stemGeo, accentMat);
      stem.position.set(0, handleY, d / 2 + stemLen / 2);
      stem.userData = { isRotateHandle: true, furnitureId: item.id };
      gizmo.add(stem);

      const knobGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.036, 24);
      const knob = new THREE.Mesh(knobGeo, accentMat);
      knob.position.set(0, handleY, handleZ);
      knob.userData = { isRotateHandle: true, furnitureId: item.id };
      gizmo.add(knob);

      const innerGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.042, 20);
      const inner = new THREE.Mesh(innerGeo, whiteMat);
      inner.position.set(0, handleY, handleZ);
      inner.userData = { isRotateHandle: true, furnitureId: item.id };
      gizmo.add(inner);

      // Invisible enlarged hit target for comfortable pointer grabbing
      const hitGeo = new THREE.SphereGeometry(0.22, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitSphere = new THREE.Mesh(hitGeo, hitMat);
      hitSphere.position.set(0, handleY, handleZ);
      hitSphere.userData = { isRotateHandle: true, furnitureId: item.id };
      gizmo.add(hitSphere);

      this.selectionGizmo = gizmo;
      this.world.add(gizmo);
      this.needsRender = true;
    }

    buildCeiling(plan, rooms, style, H) {
      const group = new THREE.Group();
      group.name = 'Ceilings';
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(style.wall),
        roughness: 0.95,
        side: THREE.DoubleSide,
      });
      mat.name = 'Ceiling_Plaster';
      this.ceilingMeshes = [];
      rooms.forEach((room, idx) => {
        if (!room.polygon || room.polygon.length < 3) return;
        const cx = (room.centroid && room.centroid.x) || 0;
        const cy = (room.centroid && room.centroid.y) || 0;
        const roomLabel = String(room.name || (FC.roomTypes[room.type] && FC.roomTypes[room.type].label) || ('Room_' + (idx + 1)))
          .replace(/&/g, 'and')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        const shape = new THREE.Shape();
        room.polygon.forEach((p, i) => {
          if (i === 0) shape.moveTo(p.x, -p.y);
          else shape.lineTo(p.x, -p.y);
        });
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        geo.translate(-cx, 0, -cy);
        geo.name = `${roomLabel}_Ceiling`;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `${roomLabel}_Ceiling`;
        mesh.position.set(cx, H - 0.01, cy);
        mesh.receiveShadow = true;
        mesh.userData = { isCeiling: true, roomId: room.id, roomLabel, cx, cy };
        this.ceilingMeshes.push(mesh);
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
      this.userLightsGroup.name = 'Lighting';
      this.world.add(this.userLightsGroup);
      this.lightFixtureGroups = [];

      const lights = plan.lights || [];
      lights.forEach((l, idx) => {
        const col = new THREE.Color(l.color || '#fff1de');
        const intensity = (l.intensity != null ? l.intensity : 1.0) * 1.8;
        const dist = (l.range || 6.0) * 1.2;

        const pLight = new THREE.PointLight(col, intensity, dist, 2);
        pLight.name = `Point_Light_${idx + 1}`;
        pLight.position.set(l.x, l.z || 2.4, l.y);
        pLight.castShadow = true;
        pLight.shadow.bias = -0.002;
        pLight.shadow.mapSize.set(512, 512);
        this.userLightsGroup.add(pLight);

        const typeLabel = l.type === 'pendant' ? 'Pendant_Fixture' : (l.type === 'lamp' ? 'Floor_Lamp_Fixture' : (l.type === 'spot' ? 'Spot_Light_Fixture' : 'Ceiling_Light_Fixture'));

        // Fixture mesh (glow bulb and casing)
        const fixGroup = new THREE.Group();
        fixGroup.name = typeLabel;
        fixGroup.position.copy(pLight.position);
        fixGroup.userData = {
          isLightFixture: true,
          lightType: l.type || 'ceiling',
          baseLabel: typeLabel,
          x: l.x,
          y: l.y,
          z: l.z || 2.4,
        };

        const bulbGeo = new THREE.SphereGeometry(0.08, 12, 12);
        bulbGeo.name = 'Light_Bulb';
        const bulbMat = new THREE.MeshBasicMaterial({ color: col });
        bulbMat.name = 'Light_Bulb_Glow';
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.name = 'Light_Bulb';
        bulbMesh.userData = { partName: 'Light_Bulb' };
        fixGroup.add(bulbMesh);

        if (l.type === 'pendant') {
          const H = (plan.settings && plan.settings.wallHeight) || 2.7;
          const cordLen = Math.max(0.15, H - (l.z || 2.4));
          const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, cordLen);
          cordGeo.name = 'Pendant_Cord';
          const cordMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
          cordMat.name = 'Fixture_Cord';
          const cord = new THREE.Mesh(cordGeo, cordMat);
          cord.name = 'Pendant_Cord';
          cord.userData = { partName: 'Pendant_Cord' };
          cord.position.y = cordLen / 2;
          fixGroup.add(cord);
        } else if (l.type === 'lamp') {
          const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, l.z || 1.6);
          poleGeo.name = 'Lamp_Stand_Pole';
          const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b });
          poleMat.name = 'Fixture_Stand_Metal';
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.name = 'Lamp_Stand_Pole';
          pole.userData = { partName: 'Lamp_Stand_Pole' };
          pole.position.y = -(l.z || 1.6) / 2;
          fixGroup.add(pole);
        }

        this.lightFixtureGroups.push(fixGroup);
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
      if (!this.renderer) this.initThree();
      const wasActive = this.active;
      this.active = true;
      if (!this.world || this.needsBuild) this.build();
      this.active = wasActive;

      if (!window.THREE || !window.THREE.GLTFExporter) {
        return Promise.reject(new Error('GLTFExporter is not loaded.'));
      }
      const exporter = new window.THREE.GLTFExporter();
      exporter.register(() => ({
        writeMesh(mesh, meshDef) {
          if (mesh && mesh.name) {
            meshDef.name = String(mesh.name);
          } else if (mesh && mesh.geometry && mesh.geometry.name) {
            meshDef.name = String(mesh.geometry.name);
          }
        },
      }));

      // Ensure structure and furniture are full scale (not collapsed by 2D/3D transition animation)
      const oldStructScaleY = this.structure ? this.structure.scale.y : 1;
      const oldFurnScaleY = this.furnitureGroup ? this.furnitureGroup.scale.y : 1;
      const oldFurnPosY = this.furnitureGroup ? this.furnitureGroup.position.y : 0;
      if (this.structure) this.structure.scale.set(1, 1, 1);
      if (this.furnitureGroup) {
        this.furnitureGroup.scale.set(1, 1, 1);
        this.furnitureGroup.position.set(0, 0, 0);
      }
      this.world.updateMatrixWorld(true);

      const sanitizeName = (str, fallback = 'Object') => {
        const cleaned = String(str || fallback)
          .replace(/&/g, 'and')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .split('_')
          .filter(Boolean)
          .map((w) => (w.toLowerCase() === 'and' ? 'and' : w.charAt(0).toUpperCase() + w.slice(1)))
          .join('_');
        return cleaned || fallback;
      };

      const usedNames = new Set();
      const nameCounters = new Map();
      const claimUniqueName = (base, alwaysNumber = false) => {
        const clean = sanitizeName(base);
        const nextCount = (nameCounters.get(clean) || 0) + 1;
        nameCounters.set(clean, nextCount);
        if (!alwaysNumber && !usedNames.has(clean) && nextCount === 1) {
          usedNames.add(clean);
          return clean;
        }
        let idx = nextCount;
        let candidate = `${clean}_${idx}`;
        while (usedNames.has(candidate)) {
          idx += 1;
          candidate = `${clean}_${idx}`;
        }
        usedNames.add(candidate);
        return candidate;
      };

      const mergeRootAndPartName = (rootName, partName) => {
        const cleanPart = sanitizeName(partName);
        const rootWords = rootName.replace(/_\d+$/, '').split('_').filter(Boolean);
        const partWords = cleanPart.split('_').filter(Boolean);
        if (partWords.length > 1 && rootWords.length > 0) {
          const firstPartWord = partWords[0].toLowerCase();
          const hasOverlap = rootWords.some((rw) => rw.toLowerCase() === firstPartWord);
          if (hasOverlap) {
            return `${rootName}_${partWords.slice(1).join('_')}`;
          }
        }
        return `${rootName}_${cleanPart}`;
      };

      const cloneCleanTree = (sourceObj, rootName, prefixPartsWithRoot = false) => {
        const clone = sourceObj.clone(true);
        const assignedRoot = claimUniqueName(rootName);
        clone.name = assignedRoot;
        if (clone.isMesh && clone.geometry) {
          clone.geometry = clone.geometry.clone();
          clone.geometry.name = assignedRoot;
        }
        const toRemove = [];
        clone.traverse((node) => {
          if (node === clone) return;
          if (node.isLine || node.isLineSegments || (node.userData && node.userData.isWireframeLine)) {
            toRemove.push(node);
            return;
          }
          const rawPart = (node.userData && node.userData.partName) || node.name || (node.isMesh ? 'Part' : 'Group');
          const desired = prefixPartsWithRoot ? mergeRootAndPartName(assignedRoot, rawPart) : sanitizeName(rawPart);
          const uniquePart = claimUniqueName(desired);
          node.name = uniquePart;
          if (node.isMesh && node.geometry) {
            node.geometry = node.geometry.clone();
            node.geometry.name = uniquePart;
          }
        });
        toRemove.forEach((n) => {
          if (n.parent) n.parent.remove(n);
        });
        return clone;
      };

      const exportScene = new THREE.Scene();
      exportScene.name = sanitizeName((this.app.plan && this.app.plan.name) || 'FloorPlan', 'FloorPlan');
      usedNames.add(exportScene.name);

      /* -------------------------------------------------------------- */
      /* 1. Architecture Hierarchy                                      */
      /* -------------------------------------------------------------- */
      const archGroup = new THREE.Group();
      archGroup.name = claimUniqueName('Architecture');
      exportScene.add(archGroup);

      // 1a. Foundation Slab
      if (this.slabMesh) {
        const slabClone = cloneCleanTree(this.slabMesh, 'Foundation_Slab');
        archGroup.add(slabClone);
      }

      // 1b. Walls (Exterior_Walls & Interior_Walls)
      const wallsRoot = new THREE.Group();
      wallsRoot.name = claimUniqueName('Walls');
      const extWallsGroup = new THREE.Group();
      extWallsGroup.name = claimUniqueName('Exterior_Walls');
      const intWallsGroup = new THREE.Group();
      intWallsGroup.name = claimUniqueName('Interior_Walls');

      (this.wallMeshes || []).forEach((wMesh) => {
        const isExt = !!(wMesh.userData && wMesh.userData.isExterior);
        const wName = (wMesh.userData && wMesh.userData.wallName) || wMesh.name || (isExt ? 'Exterior_Wall' : 'Interior_Wall');
        const wClone = cloneCleanTree(wMesh, wName);
        if (isExt) extWallsGroup.add(wClone);
        else intWallsGroup.add(wClone);
      });

      if (extWallsGroup.children.length > 0) wallsRoot.add(extWallsGroup);
      if (intWallsGroup.children.length > 0) wallsRoot.add(intWallsGroup);
      if (wallsRoot.children.length > 0) archGroup.add(wallsRoot);

      // 1c. Openings (Doors, Windows, Passages)
      if (this.openingGroups && this.openingGroups.length > 0) {
        const openingsRoot = new THREE.Group();
        openingsRoot.name = claimUniqueName('Openings');
        const doorsGroup = new THREE.Group();
        doorsGroup.name = claimUniqueName('Doors');
        const windowsGroup = new THREE.Group();
        windowsGroup.name = claimUniqueName('Windows');
        const passagesGroup = new THREE.Group();
        passagesGroup.name = claimUniqueName('Passages');

        const opTypeCounts = new Map();
        this.openingGroups.forEach((opGrp) => {
          const kind = (opGrp.userData && opGrp.userData.openingKind) || 'door';
          const base = (opGrp.userData && opGrp.userData.baseLabel) || opGrp.name || 'Opening';
          const num = (opTypeCounts.get(base) || 0) + 1;
          opTypeCounts.set(base, num);
          const numberedBase = `${base}_${num}`;
          const opClone = cloneCleanTree(opGrp, numberedBase, true);

          if (kind === 'window') windowsGroup.add(opClone);
          else if (kind === 'opening') passagesGroup.add(opClone);
          else doorsGroup.add(opClone);
        });

        if (doorsGroup.children.length > 0) openingsRoot.add(doorsGroup);
        if (windowsGroup.children.length > 0) openingsRoot.add(windowsGroup);
        if (passagesGroup.children.length > 0) openingsRoot.add(passagesGroup);
        if (openingsRoot.children.length > 0) archGroup.add(openingsRoot);
      }

      /* -------------------------------------------------------------- */
      /* 2. Rooms Hierarchy (Floor, Ceiling, Furniture by Type, Lights) */
      /* -------------------------------------------------------------- */
      const roomsRoot = new THREE.Group();
      roomsRoot.name = claimUniqueName('Rooms');
      exportScene.add(roomsRoot);

      const rooms = this.app.rooms || [];
      const roomEntries = new Map();

      rooms.forEach((room, idx) => {
        const rawName = room.name || (FC.roomTypes[room.type] && FC.roomTypes[room.type].label) || `Room_${idx + 1}`;
        const roomFolderName = claimUniqueName(rawName);
        const rcx = (room.centroid && room.centroid.x) || 0;
        const rcy = (room.centroid && room.centroid.y) || 0;

        const roomGroup = new THREE.Group();
        roomGroup.name = roomFolderName;
        roomGroup.position.set(rcx, 0, rcy);
        roomsRoot.add(roomGroup);

        roomEntries.set(room.id, {
          room,
          roomGroup,
          roomFolderName,
          rcx,
          rcy,
          furnitureRoot: null,
          categoryGroups: new Map(),
          lightingGroup: null,
        });
      });

      const getOrCreateUnassignedRoom = () => {
        if (roomEntries.has('__unassigned__')) return roomEntries.get('__unassigned__');
        const b = FC.planBounds(this.app.plan);
        const roomFolderName = claimUniqueName('Unassigned_Area');
        const roomGroup = new THREE.Group();
        roomGroup.name = roomFolderName;
        roomGroup.position.set(b.cx, 0, b.cy);
        roomsRoot.add(roomGroup);
        const entry = {
          room: null,
          roomGroup,
          roomFolderName,
          rcx: b.cx,
          rcy: b.cy,
          furnitureRoot: null,
          categoryGroups: new Map(),
          lightingGroup: null,
        };
        roomEntries.set('__unassigned__', entry);
        return entry;
      };

      const findRoomEntryForPoint = (roomId, x, y) => {
        if (roomId && roomEntries.has(roomId)) {
          return roomEntries.get(roomId);
        }
        if (FC.pointInPolygon) {
          for (let i = 0; i < rooms.length; i++) {
            const r = rooms[i];
            if (r.polygon && r.polygon.length >= 3 && FC.pointInPolygon({ x, y }, r.polygon)) {
              return roomEntries.get(r.id);
            }
          }
        }
        if (rooms.length > 0) {
          let best = null;
          let bestDist = Infinity;
          rooms.forEach((r) => {
            if (!r.centroid) return;
            const d = Math.hypot(x - r.centroid.x, y - r.centroid.y);
            if (d < bestDist) {
              bestDist = d;
              best = roomEntries.get(r.id);
            }
          });
          if (best && bestDist < 12) return best;
        }
        return getOrCreateUnassignedRoom();
      };

      // 2a. Attach Floor Meshes to each Room Empty
      (this.floorMeshes || []).forEach((fMesh) => {
        const rId = fMesh.userData && fMesh.userData.roomId;
        const entry = (rId && roomEntries.get(rId)) || getOrCreateUnassignedRoom();
        const floorClone = cloneCleanTree(fMesh, `${entry.roomFolderName}_Floor`);
        floorClone.position.set(fMesh.position.x - entry.rcx, fMesh.position.y, fMesh.position.z - entry.rcy);
        entry.roomGroup.add(floorClone);
      });

      // 2b. Attach Ceiling Meshes to each Room Empty (if ceiling is enabled)
      (this.ceilingMeshes || []).forEach((cMesh) => {
        const rId = cMesh.userData && cMesh.userData.roomId;
        const entry = (rId && roomEntries.get(rId)) || getOrCreateUnassignedRoom();
        const ceilClone = cloneCleanTree(cMesh, `${entry.roomFolderName}_Ceiling`);
        ceilClone.position.set(cMesh.position.x - entry.rcx, cMesh.position.y, cMesh.position.z - entry.rcy);
        entry.roomGroup.add(ceilClone);
      });

      // 2c. Attach Furniture grouped by Furniture Category inside each Room Empty
      if (this.app.plan && this.app.plan.furnished && this.furnitureMeshes) {
        const items = this.app.furniture || [];
        // Pre-count furniture labels so singletons stay clean and multiples get _1, _2...
        const labelTotals = new Map();
        items.forEach((item) => {
          const lbl = FC.getFurnitureLabel ? FC.getFurnitureLabel(item) : sanitizeName(item.kind || 'Furniture');
          labelTotals.set(lbl, (labelTotals.get(lbl) || 0) + 1);
        });
        const labelSeen = new Map();

        items.forEach((item) => {
          const g = this.furnitureMeshes.get(item.id);
          if (!g) return;
          const entry = findRoomEntryForPoint(item.roomId, item.x, item.y);
          if (!entry.furnitureRoot) {
            const fRoot = new THREE.Group();
            fRoot.name = claimUniqueName(`${entry.roomFolderName}_Furniture`);
            entry.furnitureRoot = fRoot;
            entry.roomGroup.add(fRoot);
          }

          const catKey = FC.getFurnitureExportCategory
            ? FC.getFurnitureExportCategory(item.kind)
            : 'Other_Furniture';
          let catGroup = entry.categoryGroups.get(catKey);
          if (!catGroup) {
            catGroup = new THREE.Group();
            catGroup.name = claimUniqueName(`${entry.roomFolderName}_${catKey}`);
            entry.categoryGroups.set(catKey, catGroup);
            entry.furnitureRoot.add(catGroup);
          }

          const baseLabel = FC.getFurnitureLabel ? FC.getFurnitureLabel(item) : sanitizeName(item.kind || 'Furniture');
          const count = (labelSeen.get(baseLabel) || 0) + 1;
          labelSeen.set(baseLabel, count);
          const itemDesiredName = (labelTotals.get(baseLabel) || 1) > 1 ? `${baseLabel}_${count}` : baseLabel;

          const itemClone = cloneCleanTree(g, itemDesiredName, true);
          itemClone.position.set(g.position.x - entry.rcx, g.position.y, g.position.z - entry.rcy);
          catGroup.add(itemClone);
        });
      }

      // 2d. Attach Light Fixtures inside each Room Empty
      if (this.lightFixtureGroups && this.lightFixtureGroups.length > 0) {
        const lightCounts = new Map();
        this.lightFixtureGroups.forEach((fixGrp) => {
          const lx = (fixGrp.userData && fixGrp.userData.x) || fixGrp.position.x;
          const ly = (fixGrp.userData && fixGrp.userData.y) || fixGrp.position.z;
          const entry = findRoomEntryForPoint(null, lx, ly);
          if (!entry.lightingGroup) {
            const lGroup = new THREE.Group();
            lGroup.name = claimUniqueName(`${entry.roomFolderName}_Lighting`);
            entry.lightingGroup = lGroup;
            entry.roomGroup.add(lGroup);
          }
          const base = (fixGrp.userData && fixGrp.userData.baseLabel) || fixGrp.name || 'Light_Fixture';
          const num = (lightCounts.get(base) || 0) + 1;
          lightCounts.set(base, num);
          const fixClone = cloneCleanTree(fixGrp, `${base}_${num}`, true);
          fixClone.position.set(fixGrp.position.x - entry.rcx, fixGrp.position.y, fixGrp.position.z - entry.rcy);
          entry.lightingGroup.add(fixClone);
        });
      }

      exportScene.updateMatrixWorld(true);

      // Restore live scene transition state
      if (this.structure) {
        this.structure.scale.y = oldStructScaleY;
      }
      if (this.furnitureGroup) {
        this.furnitureGroup.scale.y = oldFurnScaleY;
        this.furnitureGroup.position.y = oldFurnPosY;
      }
      this.world.updateMatrixWorld(true);

      return new Promise((resolve, reject) => {
        exporter.parse(
          exportScene,
          (gltf) => {
            if (gltf instanceof ArrayBuffer) {
              resolve(new Blob([gltf], { type: 'model/gltf-binary' }));
            } else {
              resolve(new Blob([JSON.stringify(gltf, null, 2)], { type: 'application/json' }));
            }
          },
          (err) => reject(err),
          { binary: true, trs: true }
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
    /* Raycasting & 3D interaction                                      */
    /* ---------------------------------------------------------------- */

    _updateRaycaster(e) {
      if (!this.raycaster) this.raycaster = new THREE.Raycaster();
      const rect = this.canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const ndcX = ((e.clientX - rect.left) / w) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / h) * 2 + 1;
      this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
      return this.raycaster;
    }

    hitRotateHandle3D(e) {
      if (!this.selectionGizmo || !this.camera) return null;
      const rc = this._updateRaycaster(e);
      if (typeof rc.intersectObjects !== 'function') return null;
      const hits = rc.intersectObjects(this.selectionGizmo.children || [], true);
      if (!Array.isArray(hits)) return null;
      for (const h of hits) {
        let obj = h.object;
        while (obj) {
          if (obj.userData && obj.userData.isRotateHandle) {
            const id = obj.userData.furnitureId;
            return (this.app.furniture || []).find((f) => f.id === id) || null;
          }
          obj = obj.parent;
        }
      }
      return null;
    }

    hitFurniture3D(e) {
      if (!this.furnitureGroup || !this.camera || !this.app.plan || !this.app.plan.furnished) return null;
      const rc = this._updateRaycaster(e);
      if (typeof rc.intersectObjects !== 'function') return null;
      const hits = rc.intersectObjects(this.furnitureGroup.children || [], true);
      if (!Array.isArray(hits) || !hits.length) return null;
      for (const h of hits) {
        let obj = h.object;
        while (obj && obj !== this.furnitureGroup) {
          if (obj.userData && obj.userData.furnitureId) {
            const item = (this.app.furniture || []).find((f) => f.id === obj.userData.furnitureId);
            if (item) return { item, point: h.point, distance: h.distance };
          }
          obj = obj.parent;
        }
      }
      return null;
    }

    intersectFloorPlane(e, planeY = 0) {
      if (!this.camera) return null;
      const rc = this._updateRaycaster(e);
      const ray = rc && rc.ray;
      if (!ray || !ray.origin || !ray.direction) return null;
      const dy = ray.direction.y;
      if (Math.abs(dy) < 1e-5) return null;
      const t = (planeY - ray.origin.y) / dy;
      if (t < 0) return null;
      return {
        x: ray.origin.x + ray.direction.x * t,
        y: planeY,
        z: ray.origin.z + ray.direction.z * t,
      };
    }

    /* ---------------------------------------------------------------- */
    /* Camera + loop                                                    */
    /* ---------------------------------------------------------------- */

    onDown(e) {
      if (!this.active || this.isTransitioning) return;
      if (document.body && document.body.classList && document.body.classList.contains('has-overlay')) return;
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);

      if (e.button === 0 && !e.shiftKey) {
        const rotItem = this.hitRotateHandle3D(e);
        if (rotItem) {
          this.dragging = {
            mode: 'furniture-rotate',
            item: rotItem,
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
            pushed: false,
          };
          this.canvas.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }

        const furnHit = this.hitFurniture3D(e);
        if (furnHit && furnHit.item) {
          const item = furnHit.item;
          this.app.select({ type: 'furniture', id: item.id });
          const planeY = item.elev || 0;
          const floorPt = this.intersectFloorPlane(e, planeY) || { x: item.x, z: item.y };
          this.dragging = {
            mode: 'furniture-move',
            item,
            planeY,
            startW: { x: floorPt.x, y: floorPt.z },
            orig: { x: item.x, y: item.y, rot: item.rot || 0 },
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
            pushed: false,
          };
          this.canvas.style.cursor = 'grabbing';
          e.preventDefault();
          return;
        }
      }

      this.dragging = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        button: e.button,
        moved: false,
        mode: e.button === 0 && !e.shiftKey ? 'rotate' : 'pan',
      };
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }

    onMove(e) {
      if (!this.active) return;
      if (!this.dragging) {
        if (this.hitRotateHandle3D(e) || this.hitFurniture3D(e)) {
          this.canvas.style.cursor = 'pointer';
        } else {
          this.canvas.style.cursor = 'grab';
        }
        return;
      }

      const dx = e.clientX - this.dragging.x;
      const dy = e.clientY - this.dragging.y;
      this.dragging.x = e.clientX;
      this.dragging.y = e.clientY;
      const totalDist = Math.hypot(
        e.clientX - (this.dragging.startX ?? e.clientX),
        e.clientY - (this.dragging.startY ?? e.clientY)
      );
      if (totalDist > 3) this.dragging.moved = true;

      if (this.dragging.mode === 'furniture-move') {
        if (!this.dragging.moved) return;
        const item = this.dragging.item;
        if (!item) return;
        const floorPt = this.intersectFloorPlane(e, this.dragging.planeY || 0);
        if (!floorPt) return;
        if (!this.dragging.pushed) {
          this.app.pushHistory();
          this.dragging.pushed = true;
        }
        const wdx = floorPt.x - this.dragging.startW.x;
        const wdy = floorPt.z - this.dragging.startW.y;
        const candX = this.dragging.orig.x + wdx;
        const candY = this.dragging.orig.y + wdy;
        const plan = this.app.plan;

        if (!e.altKey && FC.snapFurnitureToWalls) {
          const wallSnap = FC.snapFurnitureToWalls(plan, item, candX, candY, 0.35);
          if (wallSnap) {
            item.x = wallSnap.x;
            item.y = wallSnap.y;
            item.rot = wallSnap.rot;
          } else {
            item.x = FC.round(candX, 3);
            item.y = FC.round(candY, 3);
          }
        } else {
          item.x = FC.round(candX, 3);
          item.y = FC.round(candY, 3);
        }
        item.custom = true;
        this.syncFurnitureTransform(item);
        if (this.app.editor) this.app.editor.draw();
        return;
      }

      if (this.dragging.mode === 'furniture-rotate') {
        if (!this.dragging.moved) return;
        const item = this.dragging.item;
        if (!item) return;
        const floorPt = this.intersectFloorPlane(e, item.elev || 0);
        if (!floorPt) return;
        if (!this.dragging.pushed) {
          this.app.pushHistory();
          this.dragging.pushed = true;
        }
        const angle = Math.atan2(floorPt.z - item.y, floorPt.x - item.x) - Math.PI / 2;
        let snapAngle = angle;
        if (!e.altKey) {
          const step = e.shiftKey || (this.app.ui && this.app.ui.ortho) ? Math.PI / 4 : Math.PI / 12;
          snapAngle = Math.round(angle / step) * step;
        }
        snapAngle = Math.atan2(Math.sin(snapAngle), Math.cos(snapAngle));
        item.rot = FC.round(snapAngle, 3);
        item.custom = true;
        this.syncFurnitureTransform(item);
        if (this.app.editor) this.app.editor.draw();
        if (this.app.ui) this.app.ui.renderSidebar();
        return;
      }

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

    onUp(e) {
      if (this.dragging) {
        const drag = this.dragging;
        this.dragging = null;
        if (drag.mode === 'furniture-move' || drag.mode === 'furniture-rotate') {
          if (drag.moved && drag.item) {
            const rooms = this.app.rooms || [];
            for (let i = rooms.length - 1; i >= 0; i--) {
              if (FC.pointInPolygon && FC.pointInPolygon({ x: drag.item.x, y: drag.item.y }, rooms[i].polygon)) {
                drag.item.roomId = rooms[i].id;
                break;
              }
            }
            drag.item.custom = true;
            if (this.app.plan) this.app.plan.furniture = this.app.furniture;
            this.app.changed({ rooms: false, furniture: false, save: true });
          }
          this.canvas.style.cursor = 'pointer';
          return;
        }
        if (drag.mode === 'rotate' && !drag.moved) {
          if (this.app.ui && this.app.ui.selection) {
            this.app.clearSelection();
          }
        } else if (drag.mode === 'pan' && drag.button === 2 && !drag.moved && e) {
          const furnHit = this.hitFurniture3D(e);
          if (furnHit && furnHit.item && this.app.ui && this.app.ui.openContextMenu) {
            const f = furnHit.item;
            this.app.select({ type: 'furniture', id: f.id });
            this.app.ui.openContextMenu(e.clientX, e.clientY, [
              {
                label: 'Rotate 90°',
                icon: 'refresh',
                shortcut: 'R',
                action: () => this.app.rotateSelectedFurniture(Math.PI / 2),
              },
              {
                label: 'Duplicate ' + f.kind,
                icon: 'copy',
                shortcut: 'Ctrl+D',
                action: () => this.app.duplicateSelection && this.app.duplicateSelection(),
              },
              {
                label: 'Delete ' + f.kind,
                icon: 'trash',
                danger: true,
                action: () => this.app.deleteSelectedFurniture(),
              },
            ]);
          }
        }
      }
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
      const gizmoWasVisible = this.selectionGizmo ? this.selectionGizmo.visible : false;
      if (this.selectionGizmo) this.selectionGizmo.visible = false;
      this.renderer.render(this.scene, this.camera);
      const data = this.canvas.toDataURL('image/png');
      if (this.selectionGizmo) this.selectionGizmo.visible = gizmoWasVisible;
      this.renderer.render(this.scene, this.camera);
      return data;
    }
  }

  FC.Viewer3D = Viewer3D;
})();

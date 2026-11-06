/* Floorcraft — procedural low-poly furniture for the 3D view. */
(function () {
  const FC = (window.FC = window.FC || {});
  if (!window.THREE) return;

  const materialCache = new Map();

  function material(color, roughness, metalness, extra) {
    const key = color + '|' + (roughness || 0) + '|' + (metalness || 0) + '|' + (extra ? JSON.stringify(extra) : '');
    if (materialCache.has(key)) return materialCache.get(key);
    const params = {
      color: new THREE.Color(color),
      roughness: roughness == null ? 0.75 : roughness,
      metalness: metalness || 0,
    };
    if (extra) Object.assign(params, extra);
    const m = new THREE.MeshStandardMaterial(params);
    materialCache.set(key, m);
    return m;
  }

  function glass() {
    const key = 'glass-mat';
    if (materialCache.has(key)) return materialCache.get(key);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#cfe5ea'),
      transparent: true,
      opacity: 0.22,
      roughness: 0.05,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    materialCache.set(key, m);
    return m;
  }

  function groupWith(x, y, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0.002, y);
    g.rotation.y = -rot;
    return g;
  }

  function addMesh(parent, geo, mat, x, y, z, opts) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = !(opts && opts.noShadow);
    mesh.receiveShadow = true;
    if (opts && opts.ry) mesh.rotation.y = opts.ry;
    if (opts && opts.rx) mesh.rotation.x = opts.rx;
    if (opts && opts.rz) mesh.rotation.z = opts.rz;
    parent.add(mesh);
    return mesh;
  }

  function box(parent, w, h, d, mat, x, y, z, opts) {
    return addMesh(parent, new THREE.BoxGeometry(Math.max(0.005, w), Math.max(0.005, h), Math.max(0.005, d)), mat, x, y, z, opts);
  }

  function cyl(parent, rTop, rBot, h, mat, x, y, z, seg, opts) {
    return addMesh(parent, new THREE.CylinderGeometry(rTop, rBot, h, seg || 16), mat, x, y, z, opts);
  }

  function sphere(parent, r, mat, x, y, z, seg) {
    return addMesh(parent, new THREE.SphereGeometry(r, seg || 12, seg || 10), mat, x, y, z);
  }

  function legs(parent, w, d, h, mat, inset) {
    inset = inset == null ? 0.08 : inset;
    const lw = 0.045;
    [-1, 1].forEach((sx) => {
      [-1, 1].forEach((sz) => {
        box(parent, lw, h, lw, mat, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset));
      });
    });
  }

  FC.buildFurniture3D = function (item, palette, wallHeight) {
    const g = groupWith(item.x, item.y, item.rot);
    const pal = palette || FC.styles.scandinavian;
    const H = wallHeight || 2.7;
    const map = {
      wood: pal.wood,
      cabinet: pal.cabinet,
      fabric: pal.fabric,
      accent: pal.accent,
      linen: pal.linen,
      metal: pal.metal,
      stone: pal.stone,
      rug: pal.rug,
      screen: '#16191d',
      plant: '#5d7a53',
      dark: pal.dark,
    };
    const main = material(map[item.mat] || pal.wood, 0.72);
    const accent = material(pal.accent, 0.8);
    const linen = material(pal.linen, 0.92);
    const wood = material(pal.wood, 0.68);
    const dark = material(pal.dark, 0.6);
    const metal = material(pal.metal, 0.42, 0.35);
    const stone = material(pal.stone, 0.5);
    const cabinet = material(pal.cabinet, 0.7);
    const fabric = material(pal.fabric, 0.95);
    const rug = material(pal.rug, 1);
    const w = item.w;
    const d = item.d;
    const elev = item.elev || 0;

    switch (item.kind) {
      case 'bed': {
        box(g, w + 0.08, 0.24, d + 0.06, wood, 0, 0.14, 0);
        box(g, w, 0.8, 0.07, wood, 0, 0.42, -d / 2 + 0.035);
        box(g, w - 0.06, 0.2, d - 0.08, linen, 0, 0.36, 0.02);
        box(g, w - 0.1, 0.12, d * 0.66, fabric, 0, 0.49, d * 0.17);
        box(g, w - 0.14, 0.05, d * 0.22, accent, 0, 0.56, d * 0.3);
        [-1, 1].forEach((s) => {
          box(g, w * 0.35, 0.13, 0.32, linen, s * w * 0.2, 0.55, -d / 2 + 0.3, { ry: s * 0.04 });
        });
        break;
      }
      case 'nightstand': {
        box(g, w, 0.42, d, wood, 0, 0.23, 0);
        box(g, w - 0.04, 0.03, d - 0.02, material(pal.dark, 0.7), 0, 0.45, 0);
        box(g, w * 0.8, 0.012, 0.012, dark, 0, 0.33, d / 2 + 0.002);
        cyl(g, 0.035, 0.05, 0.04, metal, 0.02, 0.49, 0);
        cyl(g, 0.012, 0.012, 0.22, metal, 0.02, 0.62, 0);
        cyl(g, 0.09, 0.12, 0.16, material(pal.linen, 0.9), 0.02, 0.79, 0);
        break;
      }
      case 'wardrobe': {
        box(g, w, 2.1, d, cabinet, 0, 1.05, 0);
        box(g, w - 0.06, 1.98, 0.02, material(pal.wall, 0.8), 0, 1.05, d / 2 + 0.008);
        box(g, 0.012, 1.9, 0.015, dark, 0, 1.05, d / 2 + 0.02);
        [-1, 1].forEach((s) => {
          box(g, 0.02, 0.18, 0.025, metal, s * 0.06, 1.05, d / 2 + 0.03);
        });
        box(g, w + 0.04, 0.05, d + 0.03, wood, 0, 2.12, 0);
        break;
      }
      case 'sofa': {
        box(g, w, 0.26, d, fabric, 0, 0.16, 0);
        box(g, w, 0.72, 0.22, fabric, 0, 0.52, -d / 2 + 0.11);
        [-1, 1].forEach((s) => {
          box(g, 0.17, 0.5, d, fabric, s * (w / 2 - 0.085), 0.4, 0);
          box(g, w, 0.16, 0.14, fabric, 0, 0.62, -d / 2 + 0.12);
        });
        const seatW = (w - 0.34) / 2;
        [-1, 1].forEach((s) => {
          box(g, seatW - 0.02, 0.14, d - 0.24, material(pal.linen, 0.95), s * (seatW / 2 + 0.02), 0.37, 0.04);
        });
        box(g, 0.32, 0.28, 0.12, accent, -w * 0.24, 0.55, -d / 2 + 0.3, { rz: 0.12 });
        box(g, 0.32, 0.28, 0.12, material(pal.rug, 0.95), w * 0.24, 0.55, -d / 2 + 0.3, { rz: -0.1 });
        legs(g, w, d, 0.1, wood, 0.1);
        break;
      }
      case 'rug': {
        box(g, w, 0.018, d, rug, 0, 0.012, 0, { noShadow: true });
        box(g, w - 0.18, 0.004, d - 0.18, material(pal.linen, 1), 0, 0.023, 0, { noShadow: true });
        break;
      }
      case 'coffeeTable': {
        box(g, w, 0.06, d, wood, 0, 0.37, 0);
        box(g, w - 0.18, 0.035, d - 0.18, wood, 0, 0.16, 0);
        legs(g, w, d, 0.34, dark, 0.07);
        box(g, 0.22, 0.045, 0.16, accent, 0.1, 0.42, 0);
        break;
      }
      case 'tvConsole': {
        box(g, w, 0.42, d, wood, 0, 0.23, 0);
        [-1, 1].forEach((s) => {
          box(g, w / 2 - 0.04, 0.32, 0.02, cabinet, s * w / 4, 0.24, d / 2 + 0.012);
          box(g, 0.1, 0.015, 0.02, metal, s * w / 4, 0.3, d / 2 + 0.03);
        });
        box(g, 0.24, 0.035, 0.16, material(pal.linen, 0.9), -w * 0.28, 0.47, 0);
        break;
      }
      case 'tv': {
        box(g, w, item.h, 0.055, material('#101215', 0.35, 0.2), 0, elev + item.h / 2, 0);
        box(g, w - 0.06, item.h - 0.06, 0.01, material('#22343c', 0.25, 0.1, { emissive: new THREE.Color('#0e2027'), emissiveIntensity: 0.7 }), 0, elev + item.h / 2, 0.032);
        break;
      }
      case 'plant': {
        const pot = material('#b8a48f', 0.85);
        cyl(g, w * 0.28, w * 0.34, 0.34, pot, 0, 0.17, 0);
        cyl(g, 0.03, 0.035, 0.45, material('#5a4634', 0.9), 0, 0.45, 0);
        sphere(g, w * 0.36, material('#5b7651', 0.9), 0, 0.72, 0);
        sphere(g, w * 0.28, material('#68865c', 0.9), w * 0.22, 0.9, 0.05);
        sphere(g, w * 0.24, material('#4d6a46', 0.9), -w * 0.18, 1.0, -0.04);
        break;
      }
      case 'diningTable': {
        box(g, w, 0.06, d, wood, 0, 0.72, 0);
        legs(g, w, d, 0.69, dark, 0.09);
        box(g, 0.3, 0.035, 0.2, accent, 0, 0.77, 0);
        break;
      }
      case 'chair': {
        box(g, w, 0.07, d, fabric, 0, 0.45, 0);
        box(g, w, 0.48, 0.06, fabric, 0, 0.7, -d / 2 + 0.03);
        legs(g, w, d, 0.44, wood, 0.05);
        break;
      }
      case 'counter': {
        box(g, w, 0.84, d, cabinet, 0, 0.44, 0);
        box(g, w + 0.03, 0.045, d + 0.03, stone, 0, 0.88, 0);
        const n = Math.max(2, Math.round(w / 0.55));
        for (let i = 1; i < n; i++) {
          box(g, 0.012, 0.72, 0.014, material(pal.dark, 0.7), -w / 2 + (w / n) * i, 0.44, d / 2 + 0.005);
        }
        if (item.variant === 'sink') {
          box(g, Math.min(0.5, w * 0.45), 0.015, d * 0.62, metal, w * 0.12, 0.907, 0);
          cyl(g, 0.02, 0.02, 0.28, metal, w * 0.12, 1.02, -d * 0.22);
          box(g, 0.16, 0.025, 0.025, metal, w * 0.12, 1.15, -d * 0.16);
        }
        if (item.variant === 'stove') {
          for (let ix = -1; ix <= 1; ix += 2) {
            for (let iz = -1; iz <= 1; iz += 2) {
              cyl(g, 0.075, 0.075, 0.012, dark, ix * 0.17, 0.91, iz * 0.14);
            }
          }
        }
        break;
      }
      case 'upperCabinets': {
        box(g, w, item.h, d, cabinet, 0, elev + item.h / 2, 0);
        const n = Math.max(2, Math.round(w / 0.6));
        for (let i = 1; i < n; i++) {
          box(g, 0.012, item.h - 0.06, 0.012, dark, -w / 2 + (w / n) * i, elev + item.h / 2, d / 2 + 0.004);
        }
        break;
      }
      case 'island': {
        box(g, w, 0.84, d, cabinet, 0, 0.44, 0);
        box(g, w + 0.1, 0.05, d + 0.1, stone, 0, 0.885, 0);
        if (item.variant === 'stove') {
          for (let ix = -1; ix <= 1; ix += 2) {
            for (let iz = -1; iz <= 1; iz += 2) {
              cyl(g, 0.07, 0.07, 0.012, dark, ix * 0.18, 0.917, iz * 0.13);
            }
          }
        }
        break;
      }
      case 'stool': {
        cyl(g, w / 2, w / 2, 0.07, wood, 0, 0.6, 0);
        [-1, 1].forEach((s) => {
          box(g, 0.035, 0.58, 0.035, metal, s * w * 0.25, 0.29, -w * 0.2);
          box(g, 0.035, 0.58, 0.035, metal, s * w * 0.25, 0.29, w * 0.2);
        });
        break;
      }
      case 'fridge': {
        box(g, w, 1.9, d, metal, 0, 0.96, 0);
        box(g, w + 0.01, 0.012, d + 0.01, dark, 0, 1.28, 0);
        box(g, 0.02, 0.42, 0.035, material('#b9b9b9', 0.3, 0.7), w * 0.3, 1.5, d / 2 + 0.02);
        box(g, 0.02, 0.32, 0.035, material('#b9b9b9', 0.3, 0.7), w * 0.3, 0.98, d / 2 + 0.02);
        break;
      }
      case 'toilet': {
        box(g, 0.36, 0.5, d, stone, 0, 0.25, -0.02);
        cyl(g, w * 0.5, w * 0.38, 0.16, stone, 0, 0.5, 0.06, 20);
        box(g, w + 0.02, 0.05, d * 0.5, material('#f7f6f2', 0.55), 0, 0.6, 0.02);
        box(g, 0.4, 0.42, 0.18, stone, 0, 0.5, -d / 2 + 0.09);
        break;
      }
      case 'vanity': {
        box(g, w, 0.76, d, cabinet, 0, 0.42, 0);
        box(g, w + 0.04, 0.045, d + 0.03, stone, 0, 0.82, 0);
        cyl(g, Math.min(0.17, w * 0.24), Math.min(0.15, w * 0.21), 0.07, material('#fbfaf6', 0.4), 0, 0.86, 0.02, 20);
        cyl(g, 0.016, 0.016, 0.24, metal, 0, 0.95, -d * 0.28);
        box(g, w * 0.72, 0.8, 0.025, material('#c9d5d8', 0.15, 0.15), 0, 1.55, -d / 2 + 0.02);
        break;
      }
      case 'shower': {
        box(g, w, 0.08, d, stone, 0, 0.04, 0);
        box(g, w, 2.0, 0.025, glass(), -w / 2 + 0.012, 1.02, 0, { noShadow: true });
        box(g, 0.025, 2.0, d, glass(), 0, 1.02, -d / 2 + 0.012, { noShadow: true });
        cyl(g, 0.016, 0.016, 0.9, metal, w / 2 - 0.1, 1.55, -d / 2 + 0.08);
        cyl(g, 0.11, 0.11, 0.02, metal, w / 2 - 0.1, 1.98, -d / 2 + 0.2);
        break;
      }
      case 'bathtub': {
        box(g, w, 0.54, d, stone, 0, 0.28, 0);
        box(g, w - 0.16, 0.06, d - 0.16, material('#f7f6f2', 0.4), 0, 0.53, 0);
        box(g, w - 0.22, 0.2, d - 0.22, material('#dfe9eb', 0.3), 0, 0.45, 0);
        cyl(g, 0.02, 0.02, 0.3, metal, w / 2 - 0.12, 0.65, 0);
        break;
      }
      case 'desk': {
        box(g, w, 0.055, d, wood, 0, 0.72, 0);
        [-1, 1].forEach((s) => box(g, 0.045, 0.7, d - 0.06, dark, s * (w / 2 - 0.05), 0.36, 0));
        box(g, w - 0.4, 0.02, d - 0.15, material(pal.dark, 0.8), 0, 0.55, 0);
        break;
      }
      case 'monitor': {
        box(g, 0.22, 0.02, 0.16, metal, 0, elev - 0.36, 0);
        box(g, 0.035, 0.34, 0.035, metal, 0, elev - 0.2, 0);
        box(g, w, item.h - 0.12, 0.04, material('#101215', 0.35, 0.2), 0, elev + (item.h - 0.12) / 2, 0.02);
        box(g, w - 0.05, item.h - 0.18, 0.005, material('#233a42', 0.3, 0.1, { emissive: new THREE.Color('#0d2027'), emissiveIntensity: 0.6 }), 0, elev + (item.h - 0.12) / 2, 0.045);
        break;
      }
      case 'bookshelf': {
        box(g, w, item.h, d, wood, 0, item.h / 2, 0);
        const shelves = Math.max(3, Math.round(item.h / 0.42));
        for (let i = 1; i < shelves; i++) {
          box(g, w - 0.06, 0.025, d + 0.01, cabinet, 0, (item.h / shelves) * i, 0.005);
        }
        for (let i = 0; i < 8; i++) {
          const bw = 0.05 + ((i * 37) % 5) * 0.012;
          const bh = 0.22 + ((i * 53) % 4) * 0.03;
          const col = [pal.accent, pal.wood, pal.fabric, pal.linen][i % 4];
          box(g, bw, bh, 0.17, material(col, 0.8), -w / 2 + 0.12 + (i % 4) * 0.17, item.h * 0.25 + bh / 2, d / 2 - 0.12);
        }
        break;
      }
      case 'shelf': {
        box(g, w, 0.04, d, metal, 0, 0.02, 0);
        [-1, 1].forEach((s) => box(g, 0.04, item.h, d, metal, s * (w / 2 - 0.02), item.h / 2, 0));
        for (let i = 1; i <= 3; i++) box(g, w - 0.06, 0.025, d - 0.03, metal, 0, (item.h / 4) * i, 0);
        break;
      }
      case 'console': {
        box(g, w, 0.045, d, wood, 0, 0.8, 0);
        legs(g, w, d, 0.78, dark, 0.06);
        cyl(g, 0.06, 0.09, 0.22, accent, -w * 0.2, 0.94, 0);
        break;
      }
      case 'sideboard': {
        box(g, w, 0.68, d, wood, 0, 0.46, 0);
        [-1, 1].forEach((s) => {
          box(g, w / 2 - 0.04, 0.58, 0.015, cabinet, s * w / 4, 0.46, d / 2 + 0.01);
          box(g, 0.12, 0.015, 0.02, metal, s * w / 4, 0.5, d / 2 + 0.026);
        });
        legs(g, w, d, 0.12, dark, 0.07);
        break;
      }
      case 'boxes': {
        box(g, w, item.h, d, wood, 0, item.h / 2, 0);
        box(g, w * 0.8, 0.02, d * 0.8, material(pal.dark, 0.8), 0, item.h + 0.01, 0);
        box(g, w * 0.62, item.h * 0.45, d * 0.62, wood, 0.05, item.h + item.h * 0.22, 0.02, { ry: 0.2 });
        break;
      }
      case 'pendant': {
        cyl(g, 0.012, 0.012, 0.02, metal, 0, Math.max(elev + 0.1, H - 0.02), 0);
        cyl(g, 0.006, 0.006, Math.max(0.05, H - elev - 0.2), metal, 0, (H + elev) / 2, 0);
        cyl(g, w * 0.5, w * 0.65, 0.28, material(pal.metal, 0.5, 0.2), 0, elev, 0);
        sphere(g, 0.07, material('#ffe8b8', 0.2, 0, { emissive: new THREE.Color('#ffd793'), emissiveIntensity: 1.5 }), 0, elev - 0.12, 0, 10);
        break;
      }
      case 'floorLamp': {
        cyl(g, 0.18, 0.2, 0.03, metal, 0, 0.015, 0);
        cyl(g, 0.016, 0.016, 1.45, metal, 0, 0.74, 0);
        cyl(g, 0.2, 0.27, 0.3, material(pal.linen, 0.95), 0, 1.52, 0);
        break;
      }
      case 'bathMat': {
        box(g, w, 0.014, d, linen, 0, 0.01, 0, { noShadow: true });
        break;
      }
      case 'tableSmall': {
        cyl(g, w / 2, w / 2, 0.05, wood, 0, 0.52, 0, 20);
        cyl(g, 0.035, 0.035, 0.5, dark, 0, 0.26, 0);
        cyl(g, 0.15, 0.17, 0.03, dark, 0, 0.015, 0);
        break;
      }
      default:
        box(g, w, Math.min(item.h, 0.9), d, main, 0, Math.min(item.h, 0.9) / 2, 0);
        break;
    }
    return g;
  };

  FC.clearFurnitureMaterialCache = function () {
    materialCache.clear();
  };
})();

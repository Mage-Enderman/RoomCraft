/* RoomCraft — procedural low-poly furniture for the 3D view. */
(function () {
  const FC = (window.FC = window.FC || {});
  if (!window.THREE) return;

  const materialCache = new Map();

  const FURNITURE_CATEGORY_MAP = {
    // Seating
    sofa: 'Seating',
    sectionalSofa: 'Seating',
    armchair: 'Seating',
    chair: 'Seating',
    officeChair: 'Seating',
    stool: 'Seating',
    patioChair: 'Seating',
    sunLounger: 'Seating',

    // Tables & Desks
    coffeeTable: 'Tables_and_Desks',
    diningTable: 'Tables_and_Desks',
    desk: 'Tables_and_Desks',
    nightstand: 'Tables_and_Desks',
    tableSmall: 'Tables_and_Desks',
    console: 'Tables_and_Desks',
    patioTable: 'Tables_and_Desks',

    // Beds
    bed: 'Beds',
    singleBed: 'Beds',
    crib: 'Beds',

    // Storage & Cabinets
    wardrobe: 'Storage_and_Cabinets',
    dresser: 'Storage_and_Cabinets',
    bookshelf: 'Storage_and_Cabinets',
    shelf: 'Storage_and_Cabinets',
    garageShelving: 'Storage_and_Cabinets',
    tvConsole: 'Storage_and_Cabinets',
    sideboard: 'Storage_and_Cabinets',
    counter: 'Storage_and_Cabinets',
    upperCabinets: 'Storage_and_Cabinets',
    island: 'Storage_and_Cabinets',
    mirrorCabinet: 'Storage_and_Cabinets',
    toolCabinet: 'Storage_and_Cabinets',
    workbench: 'Storage_and_Cabinets',
    boxes: 'Storage_and_Cabinets',

    // Appliances
    tv: 'Appliances',
    monitor: 'Appliances',
    fridge: 'Appliances',
    ovenRange: 'Appliances',
    rangeHood: 'Appliances',
    dishwasher: 'Appliances',
    microwave: 'Appliances',
    washer: 'Appliances',
    dryer: 'Appliances',
    fireplace: 'Appliances',
    bbq: 'Appliances',

    // Bathroom & Plumbing
    vanity: 'Plumbing_and_Fixtures',
    toilet: 'Plumbing_and_Fixtures',
    shower: 'Plumbing_and_Fixtures',
    bathtub: 'Plumbing_and_Fixtures',
    laundrySink: 'Plumbing_and_Fixtures',
    towelRack: 'Plumbing_and_Fixtures',

    // Lighting & Decor
    pendant: 'Lighting_and_Decor',
    floorLamp: 'Lighting_and_Decor',
    rug: 'Lighting_and_Decor',
    bathMat: 'Lighting_and_Decor',
    plant: 'Lighting_and_Decor',
    planterBox: 'Lighting_and_Decor',
    artwork: 'Lighting_and_Decor',
    fullMirror: 'Lighting_and_Decor',
    ironingBoard: 'Lighting_and_Decor',
    parasol: 'Lighting_and_Decor',

    // Vehicles & Mobility
    car: 'Vehicles_and_Mobility',
    bicycle: 'Vehicles_and_Mobility',
  };

  const FALLBACK_LABELS = {
    bed: 'Double_Bed',
    singleBed: 'Single_Bed',
    crib: 'Baby_Crib',
    nightstand: 'Nightstand',
    wardrobe: 'Wardrobe',
    dresser: 'Dresser',
    fullMirror: 'Floor_Mirror',
    sofa: 'Straight_Sofa',
    sectionalSofa: 'Sectional_Sofa',
    armchair: 'Armchair',
    rug: 'Area_Rug',
    coffeeTable: 'Coffee_Table',
    tvConsole: 'TV_Media_Console',
    tv: 'Flat_Screen_TV',
    fireplace: 'Modern_Fireplace',
    plant: 'Indoor_Plant',
    diningTable: 'Dining_Table',
    chair: 'Dining_Chair',
    counter: 'Kitchen_Counter',
    upperCabinets: 'Upper_Cabinets',
    island: 'Kitchen_Island',
    stool: 'Bar_Stool',
    fridge: 'Refrigerator',
    ovenRange: 'Cooking_Range',
    rangeHood: 'Range_Vent_Hood',
    dishwasher: 'Dishwasher',
    microwave: 'Microwave',
    toilet: 'Toilet',
    vanity: 'Bath_Vanity',
    shower: 'Walk_In_Shower',
    bathtub: 'Bathtub',
    mirrorCabinet: 'Mirror_Cabinet',
    towelRack: 'Towel_Warmer_Rack',
    desk: 'Work_Desk',
    officeChair: 'Office_Chair',
    bookshelf: 'Bookshelf',
    console: 'Console_Table',
    boxes: 'Storage_Boxes',
    sideboard: 'Sideboard_Buffet',
    pendant: 'Pendant_Light',
    bathMat: 'Bath_Mat',
    floorLamp: 'Floor_Lamp',
    monitor: 'Desktop_Monitor',
    shelf: 'Utility_Shelf',
    tableSmall: 'Side_Table',
    artwork: 'Framed_Artwork',
    washer: 'Washing_Machine',
    dryer: 'Tumble_Dryer',
    laundrySink: 'Utility_Sink',
    ironingBoard: 'Ironing_Board',
    car: 'Passenger_Car',
    workbench: 'Workbench',
    toolCabinet: 'Tool_Chest',
    garageShelving: 'Industrial_Shelving',
    bicycle: 'Bicycle',
    patioTable: 'Patio_Table',
    patioChair: 'Patio_Chair',
    sunLounger: 'Sun_Lounger',
    parasol: 'Patio_Umbrella',
    bbq: 'Barbecue_Grill',
    planterBox: 'Planter_Box',
  };

  function sanitizeLabel(str) {
    return String(str || 'Object')
      .replace(/&/g, 'and')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  FC.getFurnitureExportCategory = function (kind) {
    return FURNITURE_CATEGORY_MAP[kind] || 'Other_Furniture';
  };

  FC.getFurnitureLabel = function (itemOrKind) {
    const kind = typeof itemOrKind === 'string' ? itemOrKind : (itemOrKind && itemOrKind.kind) || 'furniture';
    if (FALLBACK_LABELS[kind]) return FALLBACK_LABELS[kind];
    if (FC.furnitureCatalog && FC.furnitureCatalog[kind] && FC.furnitureCatalog[kind].label) {
      return sanitizeLabel(FC.furnitureCatalog[kind].label);
    }
    return sanitizeLabel(kind.replace(/([A-Z])/g, '_$1'));
  };

  function material(color, roughness, metalness, extra, matName) {
    const nameKey = matName || '';
    const key = color + '|' + (roughness || 0) + '|' + (metalness || 0) + '|' + (extra ? JSON.stringify(extra) : '') + '|' + nameKey;
    if (materialCache.has(key)) return materialCache.get(key);
    const params = {
      color: new THREE.Color(color),
      roughness: roughness == null ? 0.75 : roughness,
      metalness: metalness || 0,
    };
    if (extra) Object.assign(params, extra);
    const m = new THREE.MeshStandardMaterial(params);
    m.name = matName || 'Furniture_Material';
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
    m.name = 'Furniture_Glass';
    materialCache.set(key, m);
    return m;
  }

  function groupWith(x, y, rot, name) {
    const g = new THREE.Group();
    if (name) g.name = name;
    g.position.set(x, 0.002, y);
    g.rotation.y = -rot;
    return g;
  }

  function normalizeOpts(opts) {
    if (!opts) return {};
    if (typeof opts === 'string') return { name: opts };
    return opts;
  }

  function addMesh(parent, geo, mat, x, y, z, opts) {
    const o = normalizeOpts(opts);
    const mesh = new THREE.Mesh(geo, mat);
    const partName = o.name || 'Part';
    mesh.name = partName;
    if (geo) geo.name = partName;
    mesh.userData = Object.assign(mesh.userData || {}, { partName });
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = !o.noShadow;
    mesh.receiveShadow = true;
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    parent.add(mesh);
    return mesh;
  }

  function box(parent, w, h, d, mat, x, y, z, opts) {
    return addMesh(parent, new THREE.BoxGeometry(Math.max(0.005, w), Math.max(0.005, h), Math.max(0.005, d)), mat, x, y, z, opts);
  }

  function cyl(parent, rTop, rBot, h, mat, x, y, z, seg, opts) {
    return addMesh(parent, new THREE.CylinderGeometry(rTop, rBot, h, seg || 16), mat, x, y, z, opts);
  }

  function sphere(parent, r, mat, x, y, z, seg, opts) {
    return addMesh(parent, new THREE.SphereGeometry(r, seg || 12, seg || 10), mat, x, y, z, opts);
  }

  function legs(parent, w, d, h, mat, inset, prefix) {
    inset = inset == null ? 0.08 : inset;
    const lw = 0.045;
    const base = prefix || 'Leg';
    const corners = [
      { sx: -1, sz: -1, tag: 'BL' },
      { sx: -1, sz: 1, tag: 'FL' },
      { sx: 1, sz: -1, tag: 'BR' },
      { sx: 1, sz: 1, tag: 'FR' },
    ];
    corners.forEach((c) => {
      box(parent, lw, h, lw, mat, c.sx * (w / 2 - inset), h / 2, c.sz * (d / 2 - inset), `${base}_${c.tag}`);
    });
  }

  FC.buildFurniture3D = function (item, palette, wallHeight) {
    const label = FC.getFurnitureLabel(item);
    const g = groupWith(item.x, item.y, item.rot, label);
    g.userData = {
      isFurniture: true,
      furnitureId: item.id,
      furnitureKind: item.kind,
      furnitureCategory: FC.getFurnitureExportCategory(item.kind),
      furnitureLabel: label,
      roomId: item.roomId || null,
    };
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
    const main = material(map[item.mat] || pal.wood, 0.72, 0, null, 'Furniture_' + sanitizeLabel(item.mat || 'Wood'));
    const accent = material(pal.accent, 0.8, 0, null, 'Furniture_Accent');
    const linen = material(pal.linen, 0.92, 0, null, 'Furniture_Linen');
    const wood = material(pal.wood, 0.68, 0, null, 'Furniture_Wood');
    const dark = material(pal.dark, 0.6, 0, null, 'Furniture_Dark_Trim');
    const metal = material(pal.metal, 0.42, 0.35, null, 'Furniture_Metal');
    const stone = material(pal.stone, 0.5, 0, null, 'Furniture_Stone');
    const cabinet = material(pal.cabinet, 0.7, 0, null, 'Furniture_Cabinet');
    const fabric = material(pal.fabric, 0.95, 0, null, 'Furniture_Fabric');
    const rug = material(pal.rug, 1, 0, null, 'Furniture_Rug');
    const w = item.w;
    const d = item.d;
    const elev = item.elev || 0;

    switch (item.kind) {
      case 'bed': {
        box(g, w + 0.08, 0.24, d + 0.06, wood, 0, 0.14, 0, 'Bed_Frame');
        box(g, w, 0.8, 0.07, wood, 0, 0.42, -d / 2 + 0.035, 'Headboard');
        box(g, w - 0.06, 0.2, d - 0.08, linen, 0, 0.36, 0.02, 'Mattress');
        box(g, w - 0.1, 0.12, d * 0.66, fabric, 0, 0.49, d * 0.17, 'Duvet');
        box(g, w - 0.14, 0.05, d * 0.22, accent, 0, 0.56, d * 0.3, 'Throw_Blanket');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, w * 0.35, 0.13, 0.32, linen, s * w * 0.2, 0.55, -d / 2 + 0.3, { ry: s * 0.04, name: `Pillow_${side}` });
        });
        break;
      }
      case 'nightstand': {
        box(g, w, 0.42, d, wood, 0, 0.23, 0, 'Cabinet_Body');
        box(g, w - 0.04, 0.03, d - 0.02, material(pal.dark, 0.7, 0, null, 'Furniture_Dark_Top'), 0, 0.45, 0, 'Top_Surface');
        box(g, w * 0.8, 0.012, 0.012, dark, 0, 0.33, d / 2 + 0.002, 'Drawer_Handle');
        cyl(g, 0.035, 0.05, 0.04, metal, 0.02, 0.49, 0, 16, 'Lamp_Base');
        cyl(g, 0.012, 0.012, 0.22, metal, 0.02, 0.62, 0, 16, 'Lamp_Stem');
        cyl(g, 0.09, 0.12, 0.16, material(pal.linen, 0.9, 0, null, 'Lamp_Shade_Linen'), 0.02, 0.79, 0, 16, 'Lamp_Shade');
        break;
      }
      case 'wardrobe': {
        box(g, w, 2.1, d, cabinet, 0, 1.05, 0, 'Wardrobe_Body');
        box(g, w - 0.06, 1.98, 0.02, material(pal.wall, 0.8, 0, null, 'Wardrobe_Door_Panel'), 0, 1.05, d / 2 + 0.008, 'Door_Panels');
        box(g, 0.012, 1.9, 0.015, dark, 0, 1.05, d / 2 + 0.02, 'Door_Center_Seam');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.02, 0.18, 0.025, metal, s * 0.06, 1.05, d / 2 + 0.03, `Handle_${side}`);
        });
        box(g, w + 0.04, 0.05, d + 0.03, wood, 0, 2.12, 0, 'Crown_Molding');
        break;
      }
      case 'sofa': {
        box(g, w, 0.26, d, fabric, 0, 0.16, 0, 'Sofa_Base');
        box(g, w, 0.72, 0.22, fabric, 0, 0.52, -d / 2 + 0.11, 'Backrest');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.17, 0.5, d, fabric, s * (w / 2 - 0.085), 0.4, 0, `Armrest_${side}`);
          box(g, w, 0.16, 0.14, fabric, 0, 0.62, -d / 2 + 0.12, `Back_Cushion_${side}`);
        });
        const seatW = (w - 0.34) / 2;
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, seatW - 0.02, 0.14, d - 0.24, material(pal.linen, 0.95, 0, null, 'Furniture_Linen'), s * (seatW / 2 + 0.02), 0.37, 0.04, `Seat_Cushion_${side}`);
        });
        box(g, 0.32, 0.28, 0.12, accent, -w * 0.24, 0.55, -d / 2 + 0.3, { rz: 0.12, name: 'Throw_Pillow_Left' });
        box(g, 0.32, 0.28, 0.12, material(pal.rug, 0.95, 0, null, 'Furniture_Rug'), w * 0.24, 0.55, -d / 2 + 0.3, { rz: -0.1, name: 'Throw_Pillow_Right' });
        legs(g, w, d, 0.1, wood, 0.1, 'Sofa_Leg');
        break;
      }
      case 'rug': {
        box(g, w, 0.018, d, rug, 0, 0.012, 0, { noShadow: true, name: 'Rug_Base' });
        box(g, w - 0.18, 0.004, d - 0.18, material(pal.linen, 1, 0, null, 'Furniture_Linen'), 0, 0.023, 0, { noShadow: true, name: 'Rug_Inner_Border' });
        break;
      }
      case 'coffeeTable': {
        box(g, w, 0.06, d, wood, 0, 0.37, 0, 'Table_Top');
        box(g, w - 0.18, 0.035, d - 0.18, wood, 0, 0.16, 0, 'Lower_Shelf');
        legs(g, w, d, 0.34, dark, 0.07, 'Table_Leg');
        box(g, 0.22, 0.045, 0.16, accent, 0.1, 0.42, 0, 'Decor_Book');
        break;
      }
      case 'tvConsole': {
        box(g, w, 0.42, d, wood, 0, 0.23, 0, 'Console_Body');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, w / 2 - 0.04, 0.32, 0.02, cabinet, s * w / 4, 0.24, d / 2 + 0.012, `Cabinet_Door_${side}`);
          box(g, 0.1, 0.015, 0.02, metal, s * w / 4, 0.3, d / 2 + 0.03, `Door_Handle_${side}`);
        });
        box(g, 0.24, 0.035, 0.16, material(pal.linen, 0.9, 0, null, 'Furniture_Linen'), -w * 0.28, 0.47, 0, 'Media_Player');
        break;
      }
      case 'tv': {
        box(g, w, item.h, 0.055, material('#101215', 0.35, 0.2, null, 'TV_Bezel'), 0, elev + item.h / 2, 0, 'TV_Frame');
        box(g, w - 0.06, item.h - 0.06, 0.01, material('#22343c', 0.25, 0.1, { emissive: new THREE.Color('#0e2027'), emissiveIntensity: 0.7 }, 'TV_Screen_Panel'), 0, elev + item.h / 2, 0.032, 'TV_Screen');
        break;
      }
      case 'plant': {
        const pot = material('#b8a48f', 0.85, 0, null, 'Planter_Ceramic');
        cyl(g, w * 0.28, w * 0.34, 0.34, pot, 0, 0.17, 0, 16, 'Planter_Pot');
        cyl(g, 0.03, 0.035, 0.45, material('#5a4634', 0.9, 0, null, 'Plant_Stem_Bark'), 0, 0.45, 0, 16, 'Plant_Trunk');
        sphere(g, w * 0.36, material('#5b7651', 0.9, 0, null, 'Plant_Foliage_Main'), 0, 0.72, 0, 12, 'Foliage_Main');
        sphere(g, w * 0.28, material('#68865c', 0.9, 0, null, 'Plant_Foliage_Light'), w * 0.22, 0.9, 0.05, 12, 'Foliage_Right');
        sphere(g, w * 0.24, material('#4d6a46', 0.9, 0, null, 'Plant_Foliage_Dark'), -w * 0.18, 1.0, -0.04, 12, 'Foliage_Left');
        break;
      }
      case 'diningTable': {
        box(g, w, 0.06, d, wood, 0, 0.72, 0, 'Table_Top');
        legs(g, w, d, 0.69, dark, 0.09, 'Table_Leg');
        box(g, 0.3, 0.035, 0.2, accent, 0, 0.77, 0, 'Table_Centerpiece');
        break;
      }
      case 'chair': {
        box(g, w, 0.07, d, fabric, 0, 0.45, 0, 'Chair_Seat');
        box(g, w, 0.48, 0.06, fabric, 0, 0.7, -d / 2 + 0.03, 'Chair_Backrest');
        legs(g, w, d, 0.44, wood, 0.05, 'Chair_Leg');
        break;
      }
      case 'counter': {
        box(g, w, 0.84, d, cabinet, 0, 0.44, 0, 'Counter_Cabinet_Base');
        box(g, w + 0.03, 0.045, d + 0.03, stone, 0, 0.88, 0, 'Countertop_Slab');
        const n = Math.max(2, Math.round(w / 0.55));
        for (let i = 1; i < n; i++) {
          box(g, 0.012, 0.72, 0.014, material(pal.dark, 0.7, 0, null, 'Furniture_Dark_Trim'), -w / 2 + (w / n) * i, 0.44, d / 2 + 0.005, `Door_Divider_${i}`);
        }
        if (item.variant === 'sink') {
          box(g, Math.min(0.5, w * 0.45), 0.015, d * 0.62, metal, w * 0.12, 0.907, 0, 'Sink_Basin');
          cyl(g, 0.02, 0.02, 0.28, metal, w * 0.12, 1.02, -d * 0.22, 16, 'Faucet_Neck');
          box(g, 0.16, 0.025, 0.025, metal, w * 0.12, 1.15, -d * 0.16, 'Faucet_Spout');
        }
        if (item.variant === 'stove') {
          let bIdx = 1;
          for (let ix = -1; ix <= 1; ix += 2) {
            for (let iz = -1; iz <= 1; iz += 2) {
              cyl(g, 0.075, 0.075, 0.012, dark, ix * 0.17, 0.91, iz * 0.14, 16, `Stove_Burner_${bIdx++}`);
            }
          }
        }
        break;
      }
      case 'upperCabinets': {
        box(g, w, item.h, d, cabinet, 0, elev + item.h / 2, 0, 'Upper_Cabinet_Body');
        const n = Math.max(2, Math.round(w / 0.6));
        for (let i = 1; i < n; i++) {
          box(g, 0.012, item.h - 0.06, 0.012, dark, -w / 2 + (w / n) * i, elev + item.h / 2, d / 2 + 0.004, `Door_Divider_${i}`);
        }
        break;
      }
      case 'island': {
        box(g, w, 0.84, d, cabinet, 0, 0.44, 0, 'Island_Base');
        box(g, w + 0.1, 0.05, d + 0.1, stone, 0, 0.885, 0, 'Island_Countertop');
        if (item.variant === 'stove') {
          let bIdx = 1;
          for (let ix = -1; ix <= 1; ix += 2) {
            for (let iz = -1; iz <= 1; iz += 2) {
              cyl(g, 0.07, 0.07, 0.012, dark, ix * 0.18, 0.917, iz * 0.13, 16, `Island_Burner_${bIdx++}`);
            }
          }
        }
        break;
      }
      case 'stool': {
        cyl(g, w / 2, w / 2, 0.07, wood, 0, 0.6, 0, 16, 'Stool_Seat');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.035, 0.58, 0.035, metal, s * w * 0.25, 0.29, -w * 0.2, `Stool_Leg_Back_${side}`);
          box(g, 0.035, 0.58, 0.035, metal, s * w * 0.25, 0.29, w * 0.2, `Stool_Leg_Front_${side}`);
        });
        break;
      }
      case 'fridge': {
        box(g, w, 1.9, d, metal, 0, 0.96, 0, 'Fridge_Body');
        box(g, w + 0.01, 0.012, d + 0.01, dark, 0, 1.28, 0, 'Door_Divider_Seam');
        const handleMat = material('#b9b9b9', 0.3, 0.7, null, 'Stainless_Steel');
        box(g, 0.02, 0.42, 0.035, handleMat, w * 0.3, 1.5, d / 2 + 0.02, 'Upper_Door_Handle');
        box(g, 0.02, 0.32, 0.035, handleMat, w * 0.3, 0.98, d / 2 + 0.02, 'Lower_Door_Handle');
        break;
      }
      case 'toilet': {
        box(g, 0.36, 0.5, d, stone, 0, 0.25, -0.02, 'Bowl_Pedestal');
        cyl(g, w * 0.5, w * 0.38, 0.16, stone, 0, 0.5, 0.06, 20, 'Toilet_Bowl');
        box(g, w + 0.02, 0.05, d * 0.5, material('#f7f6f2', 0.55, 0, null, 'Porcelain_White'), 0, 0.6, 0.02, 'Toilet_Seat_Lid');
        box(g, 0.4, 0.42, 0.18, stone, 0, 0.5, -d / 2 + 0.09, 'Cistern_Tank');
        break;
      }
      case 'vanity': {
        box(g, w, 0.76, d, cabinet, 0, 0.42, 0, 'Vanity_Cabinet');
        box(g, w + 0.04, 0.045, d + 0.03, stone, 0, 0.82, 0, 'Vanity_Countertop');
        cyl(g, Math.min(0.17, w * 0.24), Math.min(0.15, w * 0.21), 0.07, material('#fbfaf6', 0.4, 0, null, 'Porcelain_Basin'), 0, 0.86, 0.02, 20, 'Wash_Basin');
        cyl(g, 0.016, 0.016, 0.24, metal, 0, 0.95, -d * 0.28, 16, 'Basin_Faucet');
        box(g, w * 0.72, 0.8, 0.025, material('#c9d5d8', 0.15, 0.15, null, 'Mirror_Surface'), 0, 1.55, -d / 2 + 0.02, 'Vanity_Mirror');
        break;
      }
      case 'shower': {
        box(g, w, 0.08, d, stone, 0, 0.04, 0, 'Shower_Tray');
        box(g, w, 2.0, 0.025, glass(), -w / 2 + 0.012, 1.02, 0, { noShadow: true, name: 'Glass_Screen_Side' });
        box(g, 0.025, 2.0, d, glass(), 0, 1.02, -d / 2 + 0.012, { noShadow: true, name: 'Glass_Screen_Back' });
        cyl(g, 0.016, 0.016, 0.9, metal, w / 2 - 0.1, 1.55, -d / 2 + 0.08, 16, 'Shower_Riser_Pipe');
        cyl(g, 0.11, 0.11, 0.02, metal, w / 2 - 0.1, 1.98, -d / 2 + 0.2, 16, 'Rain_Shower_Head');
        break;
      }
      case 'bathtub': {
        box(g, w, 0.54, d, stone, 0, 0.28, 0, 'Bathtub_Shell');
        box(g, w - 0.16, 0.06, d - 0.16, material('#f7f6f2', 0.4, 0, null, 'Acrylic_White'), 0, 0.53, 0, 'Bathtub_Rim');
        box(g, w - 0.22, 0.2, d - 0.22, material('#dfe9eb', 0.3, 0, null, 'Bath_Water'), 0, 0.45, 0, 'Bathtub_Basin');
        cyl(g, 0.02, 0.02, 0.3, metal, w / 2 - 0.12, 0.65, 0, 16, 'Tub_Faucet');
        break;
      }
      case 'desk': {
        box(g, w, 0.055, d, wood, 0, 0.72, 0, 'Desk_Top');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.045, 0.7, d - 0.06, dark, s * (w / 2 - 0.05), 0.36, 0, `Desk_Leg_Panel_${side}`);
        });
        box(g, w - 0.4, 0.02, d - 0.15, material(pal.dark, 0.8, 0, null, 'Furniture_Dark_Trim'), 0, 0.55, 0, 'Under_Desk_Tray');
        break;
      }
      case 'monitor': {
        box(g, 0.22, 0.02, 0.16, metal, 0, elev - 0.36, 0, 'Monitor_Stand_Base');
        box(g, 0.035, 0.34, 0.035, metal, 0, elev - 0.2, 0, 'Monitor_Stand_Neck');
        box(g, w, item.h - 0.12, 0.04, material('#101215', 0.35, 0.2, null, 'Monitor_Bezel'), 0, elev + (item.h - 0.12) / 2, 0.02, 'Monitor_Frame');
        box(g, w - 0.05, item.h - 0.18, 0.005, material('#233a42', 0.3, 0.1, { emissive: new THREE.Color('#0d2027'), emissiveIntensity: 0.6 }, 'Monitor_Display'), 0, elev + (item.h - 0.12) / 2, 0.045, 'Monitor_Screen');
        break;
      }
      case 'bookshelf': {
        box(g, w, item.h, d, wood, 0, item.h / 2, 0, 'Bookcase_Frame');
        const shelves = Math.max(3, Math.round(item.h / 0.42));
        for (let i = 1; i < shelves; i++) {
          box(g, w - 0.06, 0.025, d + 0.01, cabinet, 0, (item.h / shelves) * i, 0.005, `Shelf_Board_${i}`);
        }
        for (let i = 0; i < 8; i++) {
          const bw = 0.05 + ((i * 37) % 5) * 0.012;
          const bh = 0.22 + ((i * 53) % 4) * 0.03;
          const col = [pal.accent, pal.wood, pal.fabric, pal.linen][i % 4];
          box(g, bw, bh, 0.17, material(col, 0.8, 0, null, 'Book_Cover_' + ((i % 4) + 1)), -w / 2 + 0.12 + (i % 4) * 0.17, item.h * 0.25 + bh / 2, d / 2 - 0.12, `Book_${i + 1}`);
        }
        break;
      }
      case 'shelf': {
        box(g, w, 0.04, d, metal, 0, 0.02, 0, 'Shelf_Base');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.04, item.h, d, metal, s * (w / 2 - 0.02), item.h / 2, 0, `Shelf_Frame_${side}`);
        });
        for (let i = 1; i <= 3; i++) box(g, w - 0.06, 0.025, d - 0.03, metal, 0, (item.h / 4) * i, 0, `Shelf_Tier_${i}`);
        break;
      }
      case 'console': {
        box(g, w, 0.045, d, wood, 0, 0.8, 0, 'Console_Top');
        legs(g, w, d, 0.78, dark, 0.06, 'Console_Leg');
        cyl(g, 0.06, 0.09, 0.22, accent, -w * 0.2, 0.94, 0, 16, 'Decor_Vase');
        break;
      }
      case 'sideboard': {
        box(g, w, 0.68, d, wood, 0, 0.46, 0, 'Sideboard_Body');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, w / 2 - 0.04, 0.58, 0.015, cabinet, s * w / 4, 0.46, d / 2 + 0.01, `Cabinet_Door_${side}`);
          box(g, 0.12, 0.015, 0.02, metal, s * w / 4, 0.5, d / 2 + 0.026, `Door_Handle_${side}`);
        });
        legs(g, w, d, 0.12, dark, 0.07, 'Sideboard_Leg');
        break;
      }
      case 'boxes': {
        box(g, w, item.h, d, wood, 0, item.h / 2, 0, 'Storage_Box_Bottom');
        box(g, w * 0.8, 0.02, d * 0.8, material(pal.dark, 0.8, 0, null, 'Furniture_Dark_Trim'), 0, item.h + 0.01, 0, 'Box_Lid');
        box(g, w * 0.62, item.h * 0.45, d * 0.62, wood, 0.05, item.h + item.h * 0.22, 0.02, { ry: 0.2, name: 'Storage_Box_Top' });
        break;
      }
      case 'pendant': {
        cyl(g, 0.012, 0.012, 0.02, metal, 0, Math.max(elev + 0.1, H - 0.02), 0, 16, 'Ceiling_Canopy');
        cyl(g, 0.006, 0.006, Math.max(0.05, H - elev - 0.2), metal, 0, (H + elev) / 2, 0, 16, 'Suspension_Cord');
        cyl(g, w * 0.5, w * 0.65, 0.28, material(pal.metal, 0.5, 0.2, null, 'Pendant_Shade_Metal'), 0, elev, 0, 16, 'Pendant_Shade');
        sphere(g, 0.07, material('#ffe8b8', 0.2, 0, { emissive: new THREE.Color('#ffd793'), emissiveIntensity: 1.5 }, 'Bulb_Glow'), 0, elev - 0.12, 0, 10, 'Light_Bulb');
        break;
      }
      case 'floorLamp': {
        cyl(g, 0.18, 0.2, 0.03, metal, 0, 0.015, 0, 16, 'Lamp_Base');
        cyl(g, 0.016, 0.016, 1.45, metal, 0, 0.74, 0, 16, 'Lamp_Pole');
        cyl(g, 0.2, 0.27, 0.3, material(pal.linen, 0.95, 0, null, 'Lamp_Shade_Linen'), 0, 1.52, 0, 16, 'Lamp_Shade');
        break;
      }
      case 'bathMat': {
        box(g, w, 0.014, d, linen, 0, 0.01, 0, { noShadow: true, name: 'Bath_Mat_Fabric' });
        break;
      }
      case 'tableSmall': {
        cyl(g, w / 2, w / 2, 0.05, wood, 0, 0.52, 0, 20, 'Table_Top');
        cyl(g, 0.035, 0.035, 0.5, dark, 0, 0.26, 0, 16, 'Pedestal_Stem');
        cyl(g, 0.15, 0.17, 0.03, dark, 0, 0.015, 0, 16, 'Pedestal_Base');
        break;
      }
      case 'artwork': {
        const frameCol = pal.dark || '#2b2b2b';
        box(g, w, item.h, 0.035, material(frameCol, 0.6, 0, null, 'Artwork_Frame'), 0, elev + item.h / 2, 0, 'Picture_Frame');
        const canvasMat = material(pal.accent || '#8a5a36', 0.85, 0.05, {
          color: new THREE.Color(item.variant === 'warm' ? '#c89666' : (item.variant === 'cool' ? '#5a8276' : '#bf616a'))
        }, 'Artwork_Canvas');
        box(g, w - 0.08, item.h - 0.08, 0.012, canvasMat, 0, elev + item.h / 2, 0.015, 'Canvas_Background');
        box(g, (w - 0.08) * 0.5, (item.h - 0.08) * 0.35, 0.004, material(pal.linen, 0.95, 0, null, 'Furniture_Linen'), 0.04, elev + item.h / 2 + 0.05, 0.022, 'Canvas_Motif_Main');
        box(g, (w - 0.08) * 0.28, 0.025, 0.004, material(frameCol, 0.8, 0, null, 'Artwork_Frame'), -0.06, elev + item.h / 2 - 0.06, 0.023, 'Canvas_Motif_Accent');
        break;
      }
      case 'sectionalSofa': {
        const seatD = Math.min(0.88, d * 0.55);
        const chaiseW = Math.min(0.95, w * 0.45);
        box(g, w, 0.24, seatD, fabric, 0, 0.16, -d / 2 + seatD / 2, 'Main_Base');
        box(g, w, 0.72, 0.22, fabric, 0, 0.52, -d / 2 + 0.11, 'Backrest');
        box(g, chaiseW, 0.24, d - seatD, fabric, -w / 2 + chaiseW / 2, 0.16, d / 2 - (d - seatD) / 2, 'Chaise_Base');
        box(g, 0.18, 0.52, seatD, fabric, w / 2 - 0.09, 0.42, -d / 2 + seatD / 2, 'Armrest_Right');
        box(g, 0.18, 0.52, d - seatD, fabric, -w / 2 + 0.09, 0.42, d / 2 - (d - seatD) / 2, 'Armrest_Left');
        box(g, w - chaiseW - 0.2, 0.14, seatD - 0.24, linen, chaiseW / 2, 0.35, -d / 2 + seatD / 2, 'Main_Seat_Cushion');
        box(g, chaiseW - 0.2, 0.14, d - 0.24, linen, -w / 2 + chaiseW / 2, 0.35, 0, 'Chaise_Seat_Cushion');
        legs(g, w, d, 0.1, wood, 0.12, 'Sofa_Leg');
        break;
      }
      case 'armchair': {
        box(g, w, 0.24, d, fabric, 0, 0.16, 0, 'Chair_Base');
        box(g, w, 0.72, 0.20, fabric, 0, 0.52, -d / 2 + 0.1, 'Backrest');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.16, 0.52, d, fabric, s * (w / 2 - 0.08), 0.42, 0, `Armrest_${side}`);
        });
        box(g, w - 0.34, 0.14, d - 0.22, linen, 0, 0.35, 0.02, 'Seat_Cushion');
        legs(g, w, d, 0.1, wood, 0.08, 'Chair_Leg');
        break;
      }
      case 'fireplace': {
        box(g, w, item.h, d, stone, 0, item.h / 2, 0, 'Fireplace_Surround');
        box(g, w + 0.08, 0.05, d + 0.06, wood, 0, item.h + 0.025, 0, 'Mantel_Shelf');
        box(g, w * 0.65, item.h * 0.55, 0.04, dark, 0, item.h * 0.45, d / 2 + 0.005, 'Firebox_Chamber');
        const fireMat = material('#ff6a00', 0.2, 0, { emissive: new THREE.Color('#ff5500'), emissiveIntensity: 2.0 }, 'Fireplace_Flame');
        box(g, w * 0.55, 0.08, 0.12, fireMat, 0, item.h * 0.24, d / 2 - 0.04, 'Flame_Embers');
        break;
      }
      case 'car': {
        const bodyCol = pal.accent || '#3b5998';
        const bodyMat = material(bodyCol, 0.3, 0.4, null, 'Car_Paint');
        const glassMat = material('#1a2634', 0.1, 0.9, null, 'Car_Windshield');
        const wheelMat = material('#1c1c1f', 0.8, 0.2, null, 'Car_Tire_Rubber');
        box(g, w, 0.48, d, bodyMat, 0, 0.42, 0, 'Car_Chassis');
        box(g, w * 0.88, 0.46, d * 0.52, glassMat, 0, 0.86, -d * 0.04, 'Cabin_Windows');
        box(g, w * 0.84, 0.04, d * 0.48, bodyMat, 0, 1.10, -d * 0.04, 'Car_Roof');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.32, 0.12, 0.04, material('#fff3d6', 0.1, 0, { emissive: new THREE.Color('#fff3d6'), emissiveIntensity: 1.2 }, 'Car_Headlight'), s * (w * 0.35), 0.46, d / 2 + 0.01, `Headlight_${side}`);
          box(g, 0.32, 0.12, 0.04, material('#e63946', 0.2, 0, { emissive: new THREE.Color('#cc0000'), emissiveIntensity: 1.0 }, 'Car_Taillight'), s * (w * 0.35), 0.46, -d / 2 - 0.01, `Taillight_${side}`);
        });
        [
          { sx: -1, sz: 1, tag: 'FL' },
          { sx: 1, sz: 1, tag: 'FR' },
          { sx: -1, sz: -1, tag: 'BL' },
          { sx: 1, sz: -1, tag: 'BR' },
        ].forEach((c) => {
          cyl(g, 0.32, 0.32, 0.18, wheelMat, c.sx * (w / 2 + 0.02), 0.32, c.sz * (d * 0.32), 16, { rz: Math.PI / 2, name: `Wheel_${c.tag}` });
        });
        break;
      }
      case 'workbench': {
        box(g, w, 0.08, d, material('#9c7a4c', 0.65, 0, null, 'Butcher_Block_Wood'), 0, item.h - 0.04, 0, 'Workbench_Top');
        legs(g, w, d, item.h - 0.08, dark, 0.06, 'Workbench_Leg');
        box(g, w - 0.14, 0.03, d - 0.14, metal, 0, 0.25, 0, 'Lower_Storage_Shelf');
        box(g, w, 0.65, 0.03, material('#45484d', 0.8, 0, null, 'Pegboard_Steel'), 0, item.h + 0.325, -d / 2 + 0.015, 'Tool_Pegboard');
        break;
      }
      case 'toolCabinet': {
        const redChest = material('#a82020', 0.4, 0.4, null, 'Tool_Chest_Red');
        box(g, w, item.h, d, redChest, 0, item.h / 2, 0, 'Cabinet_Body');
        const drawers = 5;
        for (let i = 0; i < drawers; i++) {
          box(g, w - 0.06, item.h / drawers - 0.04, 0.015, metal, 0, (item.h / drawers) * (i + 0.5), d / 2 + 0.008, `Drawer_Front_${i + 1}`);
          box(g, w * 0.4, 0.02, 0.025, dark, 0, (item.h / drawers) * (i + 0.5), d / 2 + 0.02, `Drawer_Handle_${i + 1}`);
        }
        [
          { sx: -1, sz: 1, tag: 'FL' },
          { sx: 1, sz: 1, tag: 'FR' },
          { sx: -1, sz: -1, tag: 'BL' },
          { sx: 1, sz: -1, tag: 'BR' },
        ].forEach((c) => {
          cyl(g, 0.04, 0.04, 0.04, dark, c.sx * (w / 2 - 0.08), 0.04, c.sz * (d / 2 - 0.08), 8, `Caster_Wheel_${c.tag}`);
        });
        break;
      }
      case 'garageShelving': {
        [
          { sx: -1, sz: 1, tag: 'FL' },
          { sx: 1, sz: 1, tag: 'FR' },
          { sx: -1, sz: -1, tag: 'BL' },
          { sx: 1, sz: -1, tag: 'BR' },
        ].forEach((c) => {
          box(g, 0.05, item.h, 0.05, metal, c.sx * (w / 2 - 0.03), item.h / 2, c.sz * (d / 2 - 0.03), `Support_Post_${c.tag}`);
        });
        const shelves = 5;
        for (let i = 0; i < shelves; i++) {
          const sy = (item.h / (shelves - 0.3)) * (i + 0.2);
          box(g, w, 0.03, d, metal, 0, sy, 0, `Rack_Shelf_${i + 1}`);
          if (i > 0 && i < 4) {
            box(g, w * 0.35, 0.24, d * 0.65, material('#2b3d4f', 0.8, 0, null, 'Storage_Tote_Blue'), (i % 2 === 0 ? 1 : -1) * w * 0.2, sy + 0.13, 0, `Storage_Bin_${i}`);
          }
        }
        break;
      }
      case 'bicycle': {
        const bikeFrame = material('#e65100', 0.4, 0.5, null, 'Bike_Frame_Orange');
        [-1, 1].forEach((s) => {
          const wheelPos = s < 0 ? 'Rear' : 'Front';
          cyl(g, 0.32, 0.32, 0.04, dark, 0, 0.32, s * (d * 0.35), 16, { rx: Math.PI / 2, name: `Tire_${wheelPos}` });
          cyl(g, 0.28, 0.28, 0.02, metal, 0, 0.32, s * (d * 0.35), 16, { rx: Math.PI / 2, name: `Wheel_Rim_${wheelPos}` });
        });
        box(g, 0.04, 0.04, d * 0.65, bikeFrame, 0, 0.58, 0, 'Top_Tube');
        box(g, 0.04, 0.45, 0.04, bikeFrame, 0, 0.55, -d * 0.05, { rx: 0.2, name: 'Seat_Tube' });
        box(g, 0.42, 0.03, 0.04, dark, 0, 0.95, d * 0.3, 'Handlebars');
        box(g, 0.14, 0.04, 0.24, dark, 0, 0.82, -d * 0.1, 'Bike_Saddle');
        break;
      }
      case 'washer':
      case 'dryer': {
        const isDryer = item.kind === 'dryer';
        box(g, w, item.h, d, metal, 0, item.h / 2, 0, 'Appliance_Cabinet');
        box(g, w - 0.04, 0.14, 0.02, dark, 0, item.h - 0.09, d / 2 + 0.01, 'Control_Panel');
        cyl(g, 0.03, 0.03, 0.02, metal, -w * 0.25, item.h - 0.09, d / 2 + 0.025, 12, { rx: Math.PI / 2, name: 'Program_Dial' });
        cyl(g, w * 0.28, w * 0.28, 0.03, material(isDryer ? '#3a444a' : '#22323d', 0.2, 0.6, null, 'Drum_Door_Trim'), 0, item.h * 0.45, d / 2 + 0.015, 20, { rx: Math.PI / 2, name: 'Door_Bezel' });
        cyl(g, w * 0.22, w * 0.22, 0.04, material('#0f171d', 0.1, 0.8, null, 'Drum_Door_Glass'), 0, item.h * 0.45, d / 2 + 0.015, 20, { rx: Math.PI / 2, name: 'Door_Window' });
        break;
      }
      case 'laundrySink': {
        box(g, w, item.h - 0.06, d, cabinet, 0, (item.h - 0.06) / 2, 0, 'Sink_Cabinet');
        box(g, w + 0.02, 0.06, d + 0.02, stone, 0, item.h - 0.03, 0, 'Sink_Rim');
        box(g, w * 0.75, 0.35, d * 0.7, material('#f5f5f5', 0.3, 0, null, 'Porcelain_White'), 0, item.h - 0.2, 0, 'Utility_Basin');
        cyl(g, 0.018, 0.018, 0.35, metal, 0, item.h + 0.175, -d * 0.3, 16, 'Gooseneck_Faucet');
        break;
      }
      case 'ironingBoard': {
        box(g, w, 0.04, d, fabric, 0, item.h, 0, 'Ironing_Surface');
        box(g, w * 0.25, 0.038, d * 0.6, fabric, w * 0.45, item.h, 0, 'Ironing_Board_Nose');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.03, item.h, 0.03, metal, s * (w * 0.22), item.h / 2, 0, { rz: s * 0.35, name: `Folding_Leg_${side}` });
        });
        break;
      }
      case 'patioTable': {
        box(g, w, 0.05, d, wood, 0, item.h - 0.025, 0, 'Table_Top');
        legs(g, w, d, item.h - 0.05, dark, 0.06, 'Table_Leg');
        cyl(g, 0.025, 0.025, 0.06, dark, 0, item.h - 0.025, 0, 10, 'Umbrella_Ring');
        break;
      }
      case 'patioChair': {
        box(g, w, 0.05, d, wood, 0, 0.44, 0, 'Chair_Seat');
        box(g, w, 0.42, 0.04, wood, 0, 0.66, -d / 2 + 0.02, 'Chair_Backrest');
        legs(g, w, d, 0.42, dark, 0.05, 'Chair_Leg');
        break;
      }
      case 'sunLounger': {
        box(g, w, 0.12, d, wood, 0, 0.18, 0, 'Lounger_Frame');
        legs(g, w, d, 0.12, dark, 0.06, 'Lounger_Leg');
        box(g, w - 0.06, 0.08, d * 0.65, fabric, 0, 0.28, d * 0.12, 'Body_Cushion');
        box(g, w - 0.06, 0.08, d * 0.32, fabric, 0, 0.42, -d * 0.32, { rx: -0.38, name: 'Reclining_Headrest' });
        break;
      }
      case 'parasol': {
        cyl(g, 0.24, 0.26, 0.08, dark, 0, 0.04, 0, 16, 'Umbrella_Base');
        cyl(g, 0.024, 0.024, item.h, metal, 0, item.h / 2, 0, 16, 'Umbrella_Pole');
        cyl(g, 0.08, w * 0.5, 0.42, material(pal.linen, 0.9, 0, null, 'Parasol_Canopy_Fabric'), 0, item.h - 0.1, 0, 8, 'Umbrella_Canopy');
        break;
      }
      case 'bbq': {
        const grillBody = material('#202224', 0.4, 0.5, null, 'BBQ_Black_Steel');
        box(g, w * 0.6, 0.52, d * 0.8, grillBody, 0, 0.42, 0, 'Grill_Cabinet');
        legs(g, w * 0.6, d * 0.8, 0.25, dark, 0.04, 'Grill_Leg');
        cyl(g, d * 0.36, d * 0.38, w * 0.58, grillBody, 0, 0.82, 0, 16, { rz: Math.PI / 2, name: 'Grill_Lid_Hood' });
        box(g, 0.35, 0.03, 0.05, metal, 0, 0.88, d * 0.34, 'Hood_Handle');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.28, 0.03, d * 0.7, metal, s * (w * 0.42), 0.68, 0, `Side_Prep_Shelf_${side}`);
        });
        break;
      }
      case 'planterBox': {
        box(g, w, item.h, d, wood, 0, item.h / 2, 0, 'Planter_Trough');
        box(g, w - 0.06, 0.03, d - 0.06, dark, 0, item.h - 0.02, 0, 'Soil_Bed');
        const foliageMat = material('#4d6b42', 0.9, 0, null, 'Shrub_Foliage');
        const bushes = Math.max(2, Math.round(w / 0.35));
        for (let i = 0; i < bushes; i++) {
          const bx = -w / 2 + (w / bushes) * (i + 0.5);
          sphere(g, 0.16 + ((i * 17) % 3) * 0.03, foliageMat, bx, item.h + 0.12, 0, 10, `Shrub_${i + 1}`);
        }
        break;
      }
      case 'ovenRange': {
        box(g, w, item.h, d, metal, 0, item.h / 2, 0, 'Range_Body');
        box(g, w - 0.1, 0.45, 0.02, material('#101215', 0.2, 0.8, null, 'Oven_Window_Glass'), 0, 0.44, d / 2 + 0.012, 'Oven_Door_Window');
        box(g, w * 0.7, 0.025, 0.035, metal, 0, 0.68, d / 2 + 0.035, 'Oven_Door_Handle');
        for (let k = 0; k < 5; k++) {
          cyl(g, 0.02, 0.02, 0.02, dark, -w * 0.35 + (w * 0.7 / 4) * k, item.h - 0.06, d / 2 + 0.015, 8, { rx: Math.PI / 2, name: `Control_Knob_${k + 1}` });
        }
        let bIdx = 1;
        [-1, 1].forEach((bx) => {
          [-1, 1].forEach((bz) => {
            cyl(g, 0.08, 0.08, 0.015, dark, bx * (w * 0.24), item.h + 0.01, bz * (d * 0.24), 16, `Cooktop_Burner_${bIdx++}`);
          });
        });
        break;
      }
      case 'rangeHood': {
        box(g, w, 0.12, d, metal, 0, elev + 0.06, 0, 'Hood_Canopy');
        cyl(g, 0.16, w * 0.45, item.h - 0.12, metal, 0, elev + (item.h + 0.12) / 2, -d * 0.08, 4, { ry: Math.PI / 4, name: 'Exhaust_Chimney' });
        break;
      }
      case 'dishwasher': {
        box(g, w, item.h, d, metal, 0, item.h / 2, 0, 'Dishwasher_Body');
        box(g, w - 0.04, 0.08, 0.015, dark, 0, item.h - 0.08, d / 2 + 0.01, 'Control_Panel');
        box(g, w * 0.7, 0.025, 0.03, metal, 0, item.h - 0.18, d / 2 + 0.025, 'Door_Handle');
        break;
      }
      case 'microwave': {
        box(g, w, item.h, d, metal, 0, elev + item.h / 2, 0, 'Microwave_Body');
        box(g, w * 0.6, item.h * 0.7, 0.015, dark, -w * 0.14, elev + item.h / 2, d / 2 + 0.01, 'Door_Window');
        box(g, w * 0.18, item.h * 0.7, 0.012, material(pal.dark, 0.7, 0, null, 'Furniture_Dark_Trim'), w * 0.32, elev + item.h / 2, d / 2 + 0.01, 'Touch_Keypad');
        break;
      }
      case 'mirrorCabinet': {
        box(g, w, item.h, d, cabinet, 0, elev + item.h / 2, 0, 'Medicine_Cabinet_Body');
        box(g, w - 0.04, item.h - 0.04, 0.01, material('#c8d8dc', 0.1, 0.9, null, 'Mirror_Glass'), 0, elev + item.h / 2, d / 2 + 0.008, 'Mirror_Door');
        break;
      }
      case 'towelRack': {
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          cyl(g, 0.015, 0.015, item.h, metal, s * (w / 2 - 0.03), elev + item.h / 2, 0, 16, `Vertical_Rail_${side}`);
        });
        for (let i = 1; i <= 4; i++) {
          const ry = elev + (item.h / 5) * i;
          cyl(g, 0.012, 0.012, w - 0.04, metal, 0, ry, 0, 8, { rz: Math.PI / 2, name: `Heated_Bar_${i}` });
          if (i === 2) box(g, w * 0.45, 0.35, 0.04, linen, -w * 0.1, ry - 0.16, 0, 'Hanging_Towel');
        }
        break;
      }
      case 'dresser': {
        box(g, w, item.h, d, wood, 0, item.h / 2, 0, 'Dresser_Body');
        const tiers = 4;
        for (let i = 0; i < tiers; i++) {
          const dy = (item.h / tiers) * (i + 0.5);
          box(g, w - 0.08, item.h / tiers - 0.03, 0.015, cabinet, 0, dy, d / 2 + 0.008, `Drawer_Front_${i + 1}`);
          [-1, 1].forEach((s) => {
            const side = s < 0 ? 'Left' : 'Right';
            box(g, 0.08, 0.015, 0.02, metal, s * (w * 0.22), dy, d / 2 + 0.025, `Drawer_${i + 1}_Handle_${side}`);
          });
        }
        break;
      }
      case 'crib': {
        box(g, w, 0.12, d, wood, 0, 0.25, 0, 'Mattress_Support');
        box(g, w - 0.06, 0.1, d - 0.06, linen, 0, 0.35, 0, 'Crib_Mattress');
        [
          { sx: -1, sz: 1, tag: 'FL' },
          { sx: 1, sz: 1, tag: 'FR' },
          { sx: -1, sz: -1, tag: 'BL' },
          { sx: 1, sz: -1, tag: 'BR' },
        ].forEach((c) => {
          box(g, 0.05, item.h, 0.05, wood, c.sx * (w / 2 - 0.02), item.h / 2, c.sz * (d / 2 - 0.02), `Corner_Post_${c.tag}`);
        });
        const slats = 8;
        for (let i = 1; i < slats; i++) {
          const sz = -d / 2 + (d / slats) * i;
          [-1, 1].forEach((sx) => {
            const side = sx < 0 ? 'Left' : 'Right';
            box(g, 0.02, item.h * 0.55, 0.02, wood, sx * (w / 2 - 0.02), item.h * 0.6, sz, `Side_Slat_${side}_${i}`);
          });
        }
        break;
      }
      case 'singleBed': {
        box(g, w + 0.06, 0.22, d + 0.06, wood, 0, 0.14, 0, 'Bed_Frame');
        box(g, w, 0.78, 0.06, wood, 0, 0.42, -d / 2 + 0.03, 'Headboard');
        box(g, w - 0.06, 0.18, d - 0.08, linen, 0, 0.34, 0.02, 'Mattress');
        box(g, w - 0.08, 0.12, d * 0.68, fabric, 0, 0.46, d * 0.16, 'Duvet');
        box(g, w * 0.55, 0.12, 0.32, linen, 0, 0.52, -d / 2 + 0.28, 'Pillow');
        break;
      }
      case 'fullMirror': {
        box(g, w, item.h, d, metal, 0, elev + item.h / 2, 0, 'Mirror_Frame');
        box(g, w - 0.08, item.h - 0.08, 0.01, material('#cfe2e8', 0.08, 0.95, null, 'Mirror_Glass'), 0, elev + item.h / 2, d / 2 + 0.005, 'Mirror_Glass');
        break;
      }
      case 'officeChair': {
        cyl(g, 0.28, 0.28, 0.04, dark, 0, 0.12, 0, 8, 'Star_Base');
        cyl(g, 0.03, 0.03, 0.32, metal, 0, 0.28, 0, 16, 'Gas_Lift_Cylinder');
        box(g, w * 0.8, 0.08, d * 0.8, fabric, 0, 0.46, 0, 'Seat_Cushion');
        box(g, w * 0.75, 0.48, 0.06, material('#1e2227', 0.9, 0, null, 'Mesh_Backrest'), 0, 0.72, -d * 0.32, 'Backrest');
        [-1, 1].forEach((s) => {
          const side = s < 0 ? 'Left' : 'Right';
          box(g, 0.06, 0.22, 0.28, dark, s * (w * 0.38), 0.58, 0, `Armrest_${side}`);
        });
        break;
      }
      default:
        box(g, w, Math.min(item.h, 0.9), d, main, 0, Math.min(item.h, 0.9) / 2, 0, 'Furniture_Body');
        break;
    }
    return g;
  };

  FC.clearFurnitureMaterialCache = function () {
    materialCache.clear();
  };
})();

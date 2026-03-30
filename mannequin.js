/**
 * mannequin.js
 * Builds and manages a 3D mannequin using Three.js primitives.
 * Each body segment is an individually addressable mesh so outfit
 * pieces can be swapped / recolored independently.
 */

export class Mannequin {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.parts = {}; // named body segments
    this.clothingMeshes = []; // overlay clothing meshes
    scene.add(this.group);
    this._build();
  }

  // ── Build base body ────────────────────────────────────────────
  _build() {
    const skin = new THREE.MeshStandardMaterial({
      color: 0xd4a87a,
      roughness: 0.8,
      metalness: 0.0,
    });

    // Helper: add a mesh segment
    const add = (name, geo, mat, x, y, z) => {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.parts[name] = mesh;
      return mesh;
    };

    // ── HEAD
    add('head',
      new THREE.SphereGeometry(0.18, 24, 24),
      skin, 0, 1.72, 0
    );

    // ── NECK
    add('neck',
      new THREE.CylinderGeometry(0.065, 0.075, 0.18, 16),
      skin, 0, 1.54, 0
    );

    // ── TORSO (upper)
    add('torso',
      new THREE.CylinderGeometry(0.19, 0.16, 0.52, 20),
      skin, 0, 1.18, 0
    );

    // ── TORSO (lower / abdomen)
    add('abdomen',
      new THREE.CylinderGeometry(0.16, 0.17, 0.26, 20),
      skin, 0, 0.86, 0
    );

    // ── HIPS
    add('hips',
      new THREE.CylinderGeometry(0.19, 0.18, 0.20, 20),
      skin, 0, 0.69, 0
    );

    // ── SHOULDERS (L / R) — decorative bumps
    add('shoulder_l',
      new THREE.SphereGeometry(0.09, 16, 16),
      skin, -0.23, 1.38, 0
    );
    add('shoulder_r',
      new THREE.SphereGeometry(0.09, 16, 16),
      skin,  0.23, 1.38, 0
    );

    // ── UPPER ARM L / R
    add('upperarm_l',
      new THREE.CylinderGeometry(0.065, 0.055, 0.32, 14),
      skin, -0.30, 1.12, 0
    );
    add('upperarm_r',
      new THREE.CylinderGeometry(0.065, 0.055, 0.32, 14),
      skin,  0.30, 1.12, 0
    );

    // ── ELBOW L / R
    add('elbow_l',
      new THREE.SphereGeometry(0.055, 14, 14),
      skin, -0.30, 0.94, 0
    );
    add('elbow_r',
      new THREE.SphereGeometry(0.055, 14, 14),
      skin,  0.30, 0.94, 0
    );

    // ── FOREARM L / R
    add('forearm_l',
      new THREE.CylinderGeometry(0.050, 0.040, 0.30, 14),
      skin, -0.30, 0.76, 0
    );
    add('forearm_r',
      new THREE.CylinderGeometry(0.050, 0.040, 0.30, 14),
      skin,  0.30, 0.76, 0
    );

    // ── HAND L / R
    add('hand_l',
      new THREE.BoxGeometry(0.08, 0.10, 0.04),
      skin, -0.30, 0.58, 0
    );
    add('hand_r',
      new THREE.BoxGeometry(0.08, 0.10, 0.04),
      skin,  0.30, 0.58, 0
    );

    // ── UPPER LEG L / R
    add('thigh_l',
      new THREE.CylinderGeometry(0.10, 0.085, 0.42, 16),
      skin, -0.10, 0.38, 0
    );
    add('thigh_r',
      new THREE.CylinderGeometry(0.10, 0.085, 0.42, 16),
      skin,  0.10, 0.38, 0
    );

    // ── KNEE L / R
    add('knee_l',
      new THREE.SphereGeometry(0.07, 14, 14),
      skin, -0.10, 0.15, 0
    );
    add('knee_r',
      new THREE.SphereGeometry(0.07, 14, 14),
      skin,  0.10, 0.15, 0
    );

    // ── LOWER LEG L / R
    add('calf_l',
      new THREE.CylinderGeometry(0.068, 0.050, 0.38, 16),
      skin, -0.10, -0.07, 0
    );
    add('calf_r',
      new THREE.CylinderGeometry(0.068, 0.050, 0.38, 16),
      skin,  0.10, -0.07, 0
    );

    // ── ANKLE / FOOT L / R
    add('foot_l',
      new THREE.BoxGeometry(0.10, 0.06, 0.20),
      skin, -0.10, -0.29, 0.04
    );
    add('foot_r',
      new THREE.BoxGeometry(0.10, 0.06, 0.20),
      skin,  0.10, -0.29, 0.04
    );

    // Center group so feet are near y=0
    this.group.position.y = 0.32;
  }

  // ── Clear all clothing overlays ──────────────────────────────
  clearClothing() {
    this.clothingMeshes.forEach(m => this.group.remove(m));
    this.clothingMeshes = [];
  }

  // ── Dress the mannequin from outfit data ─────────────────────
  applyOutfit(outfitData) {
    this.clearClothing();
    outfitData.pieces.forEach(piece => {
      const meshes = this._createClothingPiece(piece);
      meshes.forEach(m => {
        this.group.add(m);
        this.clothingMeshes.push(m);
      });
    });
  }

  // ── Build clothing geometry for one piece ───────────────────
  _createClothingPiece(piece) {
    const color = piece.color_hex || '#888888';
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: piece.roughness ?? 0.85,
      metalness: piece.metalness ?? 0.0,
    });

    const meshes = [];
    const type = piece.type.toLowerCase();

    if (type.includes('shirt') || type.includes('top') || type.includes('tee') || type.includes('tshirt')) {
      meshes.push(...this._makeShirt(mat, piece));
    } else if (type.includes('blazer') || type.includes('jacket') || type.includes('coat') || type.includes('hoodie') || type.includes('sweater')) {
      meshes.push(...this._makeJacket(mat, piece));
    } else if (type.includes('trouser') || type.includes('pant') || type.includes('jeans') || type.includes('chino') || type.includes('shorts')) {
      const isShorts = type.includes('shorts');
      meshes.push(...this._makePants(mat, piece, isShorts));
    } else if (type.includes('skirt') || type.includes('dress')) {
      meshes.push(...this._makeSkirt(mat, piece));
    } else if (type.includes('shoe') || type.includes('boot') || type.includes('sneaker') || type.includes('loafer') || type.includes('heel') || type.includes('oxford')) {
      meshes.push(...this._makeShoes(mat, piece));
    } else if (type.includes('sock')) {
      meshes.push(...this._makeSocks(mat, piece));
    } else if (type.includes('hat') || type.includes('cap') || type.includes('beanie')) {
      meshes.push(...this._makeHat(mat, piece));
    } else if (type.includes('scarf') || type.includes('tie') || type.includes('necktie') || type.includes('bow')) {
      meshes.push(...this._makeTie(mat, piece));
    } else if (type.includes('belt')) {
      meshes.push(...this._makeBelt(mat, piece));
    }

    return meshes;
  }

  // ── Shirt ────────────────────────────────────────────────────
  _makeShirt(mat) {
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.200, 0.172, 0.54, 22),
      mat
    );
    torso.position.set(0, 1.18, 0);

    const sleeveL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.056, 0.30, 14),
      mat
    );
    sleeveL.position.set(-0.30, 1.12, 0);

    const sleeveR = sleeveL.clone();
    sleeveR.position.set(0.30, 1.12, 0);

    return [torso, sleeveL, sleeveR];
  }

  // ── Jacket / Blazer (bulkier than shirt) ────────────────────
  _makeJacket(mat) {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.185, 0.78, 22),
      mat
    );
    body.position.set(0, 1.05, 0);

    const sleeveL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.062, 0.62, 14),
      mat
    );
    sleeveL.position.set(-0.30, 1.05, 0);

    const sleeveR = sleeveL.clone();
    sleeveR.position.set(0.30, 1.05, 0);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.10, 0.025, 8, 24, Math.PI),
      mat
    );
    collar.rotation.x = -Math.PI / 2;
    collar.position.set(0, 1.44, 0.05);

    return [body, sleeveL, sleeveR, collar];
  }

  // ── Pants / Trousers ────────────────────────────────────────
  _makePants(mat, piece, isShorts = false) {
    const legLen = isShorts ? 0.22 : 0.40;
    const waist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.185, 0.22, 20),
      mat
    );
    waist.position.set(0, 0.69, 0);

    const legL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.085, legLen, 16),
      mat
    );
    legL.position.set(-0.10, 0.69 - 0.11 - legLen / 2, 0);

    const legR = legL.clone();
    legR.position.set(0.10, 0.69 - 0.11 - legLen / 2, 0);

    return [waist, legL, legR];
  }

  // ── Skirt / Dress ────────────────────────────────────────────
  _makeSkirt(mat, piece) {
    const isDress = piece.type.toLowerCase().includes('dress');
    const topY    = isDress ? 1.18 : 0.69;
    const height  = isDress ? 1.05 : 0.55;
    const topR    = isDress ? 0.205 : 0.200;
    const botR    = isDress ? 0.28 : 0.26;

    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(topR, botR, height, 24),
      mat
    );
    skirt.position.set(0, topY - height / 2 + 0.05, 0);

    const meshes = [skirt];
    if (isDress) {
      // Add bodice
      const bodice = new THREE.Mesh(
        new THREE.CylinderGeometry(0.200, 0.205, 0.54, 22),
        mat
      );
      bodice.position.set(0, 1.18, 0);
      meshes.push(bodice);
    }
    return meshes;
  }

  // ── Shoes ────────────────────────────────────────────────────
  _makeShoes(mat) {
    const shoeL = new THREE.Mesh(
      new THREE.BoxGeometry(0.115, 0.072, 0.24),
      mat
    );
    shoeL.position.set(-0.10, -0.29, 0.045);

    const shoeR = shoeL.clone();
    shoeR.position.set(0.10, -0.29, 0.045);
    return [shoeL, shoeR];
  }

  // ── Socks ───────────────────────────────────────────────────
  _makeSocks(mat) {
    const sockL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.053, 0.050, 0.18, 12),
      mat
    );
    sockL.position.set(-0.10, -0.21, 0);
    const sockR = sockL.clone();
    sockR.position.set(0.10, -0.21, 0);
    return [sockL, sockR];
  }

  // ── Hat ─────────────────────────────────────────────────────
  _makeHat(mat, piece) {
    const type = piece.type.toLowerCase();
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.27, 0.025, 24),
      mat
    );
    brim.position.set(0, 1.88, 0);
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.185, 0.19, type.includes('beanie') ? 0.22 : 0.16, 20),
      mat
    );
    crown.position.set(0, 1.98, 0);
    return type.includes('cap') ? [crown] : [brim, crown];
  }

  // ── Tie / Scarf ─────────────────────────────────────────────
  _makeTie(mat) {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.38, 0.015),
      mat
    );
    tie.position.set(0, 1.22, 0.205);
    return [tie];
  }

  // ── Belt ─────────────────────────────────────────────────────
  _makeBelt(mat) {
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.018, 8, 32),
      mat
    );
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, 0.78, 0);
    return [belt];
  }

  // ── Toggle wireframe ────────────────────────────────────────
  setWireframe(on) {
    [...Object.values(this.parts), ...this.clothingMeshes].forEach(m => {
      m.material.wireframe = on;
    });
  }
}

import * as THREE from 'three';
import {
  ALL_RYB_COLORS,
  PRIMARY_COLOR_IDS,
  SECONDARY_COLOR_IDS,
  TERTIARY_COLOR_IDS,
  getColorDef,
} from '../colors';
import { RYBColorId } from '../types';

export interface HazardNode {
  mesh: THREE.Group;
  position: THREE.Vector3;
  hp: number;
  maxHp: number;
  isExploded: boolean;
  radius: number;
}

export interface JumpPad {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  boostVelocity: number;
  radius: number;
}

export interface BossCrystalNode {
  id: string;
  colorId: RYBColorId;
  colorHex: string;
  group: THREE.Group;
  crystalMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  position: THREE.Vector3;
  isCollected: boolean;
  respawnTimer: number;
  pickupRadius: number;
}

export class CyberArena {
  public scene: THREE.Scene;
  public hazardNodes: HazardNode[] = [];
  public jumpPads: JumpPad[] = [];
  public bossCrystals: BossCrystalNode[] = [];
  public colliders: THREE.Box3[] = [];
  private rimMaterials: THREE.MeshBasicMaterial[] = [];
  private pillarStripeMaterials: THREE.MeshBasicMaterial[] = [];
  private pillarBeacons: THREE.Mesh[] = [];
  private stagePropsGroup: THREE.Group;
  private gridTexture: THREE.CanvasTexture | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.stagePropsGroup = new THREE.Group();
    this.scene.add(this.stagePropsGroup);

    this.setupEnvironment();
    this.setupLighting();
    this.buildArenaSurfaces();
    this.buildPillars();
    this.buildJumpPads();
    this.spawnHazardNodes();
    this.setStageTheme(1);
  }

  private setupEnvironment() {
    this.scene.background = new THREE.Color('#0b1120');
    this.scene.fog = new THREE.Fog('#0b1120', 48, 125);
  }

  private setupLighting() {
    // Pencahayaan netral putih-kebiruan agar warna pigmen RYB pada Chromabots tidak terdistorsi
    const ambientLight = new THREE.AmbientLight('#e2e8f0', 1.65);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#f8fafc', '#0f172a', 1.4);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 2.0);
    dirLight.position.set(25, 45, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    const d = 38;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const centerLight = new THREE.PointLight('#38bdf8', 2.2, 50);
    centerLight.position.set(0, 10, 0);
    this.scene.add(centerLight);

    const corners = [
      [-18, 8, -18],
      [18, 8, -18],
      [-18, 8, 18],
      [18, 8, 18],
    ];
    corners.forEach(([x, y, z]) => {
      const cornerLight = new THREE.PointLight('#e0f2fe', 1.3, 35);
      cornerLight.position.set(x, y, z);
      this.scene.add(cornerLight);
    });
  }

  private createGridTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 3;
    const step = 64;
    for (let x = 0; x <= 512; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#38bdf822';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 512; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#00f0ff44';
    ctx.beginPath();
    ctx.arc(256, 256, 12, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    this.gridTexture = texture;
    return texture;
  }

  private buildArenaSurfaces() {
    const floorGeo = new THREE.PlaneGeometry(68, 68);
    const gridTexture = this.createGridTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.35,
      metalness: 0.65,
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallGeo = new THREE.BoxGeometry(68, 6.5, 1.2);
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#081024',
      roughness: 0.6,
      metalness: 0.5,
      emissive: '#001833',
      emissiveIntensity: 0.25,
    });

    const wallPositions = [
      { pos: [0, 3.25, -34], rot: [0, 0, 0] },
      { pos: [0, 3.25, 34], rot: [0, 0, 0] },
      { pos: [-34, 3.25, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [34, 3.25, 0], rot: [0, Math.PI / 2, 0] },
    ];

    wallPositions.forEach((wp) => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(wp.pos[0], wp.pos[1], wp.pos[2]);
      wall.rotation.set(wp.rot[0], wp.rot[1], wp.rot[2]);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);

      const rimGeo = new THREE.BoxGeometry(68, 0.22, 0.25);
      const rimMat = new THREE.MeshBasicMaterial({ color: '#00f0ff' });
      this.rimMaterials.push(rimMat);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(wp.pos[0], wp.pos[1] + 3.25, wp.pos[2]);
      rim.rotation.set(wp.rot[0], wp.rot[1], wp.rot[2]);
      this.scene.add(rim);

      const box = new THREE.Box3().setFromObject(wall);
      this.colliders.push(box);
    });
  }

  private buildPillars() {
    const pillarPositions = [
      [-15, 0, -15],
      [15, 0, -15],
      [-15, 0, 15],
      [15, 0, 15],
    ];

    pillarPositions.forEach(([px, py, pz]) => {
      const group = new THREE.Group();
      group.position.set(px, py, pz);

      const baseGeo = new THREE.CylinderGeometry(2.3, 2.7, 1.1, 8);
      const baseMat = new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.4,
        metalness: 0.8,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.55;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      const colGeo = new THREE.BoxGeometry(2.0, 8.2, 2.0);
      const colMat = new THREE.MeshStandardMaterial({
        color: '#090e1c',
        roughness: 0.25,
        metalness: 0.9,
      });
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.y = 4.1;
      col.castShadow = true;
      col.receiveShadow = true;
      group.add(col);

      const stripeGeo = new THREE.BoxGeometry(0.18, 7.2, 2.12);
      const stripeMat = new THREE.MeshBasicMaterial({ color: '#00f0ff' });
      this.pillarStripeMaterials.push(stripeMat);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 4.1;
      group.add(stripe);

      // Mahkota kristal energi di puncak pilar (tinggi di atas pandangan bidik musuh)
      const beaconGeo = new THREE.OctahedronGeometry(0.95, 0);
      const beaconMat = new THREE.MeshBasicMaterial({ color: '#00f0ff' });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 9.4;
      group.add(beacon);
      this.pillarBeacons.push(beacon);

      this.scene.add(group);

      const box = new THREE.Box3().setFromObject(group);
      this.colliders.push(box);
    });
  }

  private buildJumpPads() {
    const padLocations = [
      new THREE.Vector3(-19, 0.05, 0),
      new THREE.Vector3(19, 0.05, 0),
    ];

    padLocations.forEach((pos) => {
      const padGeo = new THREE.CylinderGeometry(2.1, 2.4, 0.25, 16);
      const padMat = new THREE.MeshStandardMaterial({
        color: '#06b6d4',
        emissive: '#0891b2',
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.8,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.copy(pos);
      pad.receiveShadow = true;
      this.scene.add(pad);

      this.jumpPads.push({
        mesh: pad,
        position: pos.clone(),
        boostVelocity: 16.0,
        radius: 2.2,
      });
    });
  }

  public spawnHazardNodes() {
    // Bersihkan hazard lama
    this.hazardNodes.forEach((h) => this.scene.remove(h.mesh));
    this.hazardNodes = [];

    const positions = [
      new THREE.Vector3(-10, 0, -22),
      new THREE.Vector3(10, 0, -22),
      new THREE.Vector3(0, 0, 22),
    ];

    positions.forEach((pos) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 })
      );
      ped.position.y = 0.25;
      group.add(ped);

      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.6, 0),
        new THREE.MeshBasicMaterial({ color: '#38bdf8', wireframe: true })
      );
      core.position.y = 1.1;
      group.add(core);

      this.scene.add(group);
      this.hazardNodes.push({
        mesh: group,
        position: pos.clone().setY(1.0),
        hp: 40,
        maxHp: 40,
        isExploded: false,
        radius: 9.0,
      });
    });
  }

  /**
   * Mengatur tema arsitektur energi untuk Stage 1 (Primer), Stage 2 (Sekunder), dan Stage 3 (Tersier).
   * Elemen dekoratif ditempatkan di bagian atas/tepi luar arena agar tidak mengaburkan warna Chromabots.
   */
  public setStageTheme(stageNumber: 1 | 2 | 3) {
    // Bersihkan dekorasi stage sebelumnya
    while (this.stagePropsGroup.children.length > 0) {
      const child = this.stagePropsGroup.children[0];
      this.stagePropsGroup.remove(child);
    }

    const colorIds =
      stageNumber === 1
        ? PRIMARY_COLOR_IDS
        : stageNumber === 2
        ? SECONDARY_COLOR_IDS
        : TERTIARY_COLOR_IDS;

    const paletteHex = colorIds.map((id) => getColorDef(id).hex);

    // Perbarui warna mahkota pilar dan aksen garis
    this.pillarBeacons.forEach((beacon, idx) => {
      const hex = paletteHex[idx % paletteHex.length];
      (beacon.material as THREE.MeshBasicMaterial).color.set(hex);
    });

    this.pillarStripeMaterials.forEach((mat, idx) => {
      if (stageNumber === 1) {
        mat.color.set('#00f0ff');
      } else if (stageNumber === 2) {
        mat.color.set('#a855f7');
      } else {
        mat.color.set(paletteHex[idx % paletteHex.length]);
      }
    });

    this.rimMaterials.forEach((mat, idx) => {
      mat.color.set(paletteHex[idx % paletteHex.length]);
    });

    // Tambahkan cincin energi melayang tinggi di langit arena (y = 13-16) sesuai identitas stage
    const ringCount = stageNumber === 1 ? 3 : stageNumber === 2 ? 3 : 6;
    const ringRadius = stageNumber === 3 ? 24 : 18;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const hex = paletteHex[i % paletteHex.length];

      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(
        Math.cos(angle) * ringRadius,
        12.5,
        Math.sin(angle) * ringRadius
      );

      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.14, 8, 24),
        new THREE.MeshBasicMaterial({ color: hex })
      );
      torus.rotation.x = Math.PI / 2;
      pylonGroup.add(torus);

      this.stagePropsGroup.add(pylonGroup);
    }

    // Reset hazard nodes & kristal boss setiap pergantian stage
    this.spawnHazardNodes();
    this.clearBossCrystals();
  }

  /**
   * Menghapus seluruh Kristal Warna Boss dari arena
   */
  public clearBossCrystals() {
    this.bossCrystals.forEach((c) => {
      this.scene.remove(c.group);
    });
    this.bossCrystals = [];
  }

  /**
   * Memunculkan 4 Kristal Warna 3D di arena saat melawan CHROMA TITAN.
   * Salah satu kristal DIJAMIN memiliki warna yang sama dengan Color Core Boss saat ini (`targetColorId`).
   */
  public spawnBossCrystals(targetColorId: RYBColorId, phaseColorPool: RYBColorId[]) {
    this.clearBossCrystals();

    // Pilih 1 warna target yang benar + 3 warna pengecoh unik
    const distractors = phaseColorPool.filter((c) => c !== targetColorId);
    const extraFallbacks = ALL_RYB_COLORS.map((c) => c.id).filter(
      (c) => c !== targetColorId && !distractors.includes(c)
    );
    const candidatePool = [...distractors, ...extraFallbacks];

    const chosenColors: RYBColorId[] = [targetColorId];
    while (chosenColors.length < 4 && candidatePool.length > 0) {
      const idx = Math.floor(Math.random() * candidatePool.length);
      chosenColors.push(candidatePool.splice(idx, 1)[0]);
    }

    // 4 titik strategis di arena yang mudah dilihat dan dijangkau pemain
    const crystalLocations = [
      new THREE.Vector3(-10.5, 0, -7.5),
      new THREE.Vector3(10.5, 0, -7.5),
      new THREE.Vector3(-10.5, 0, 9.5),
      new THREE.Vector3(10.5, 0, 9.5),
    ];

    // Acak urutan posisi agar lokasi kristal yang benar selalu menantang
    for (let i = crystalLocations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = crystalLocations[i];
      crystalLocations[i] = crystalLocations[j];
      crystalLocations[j] = temp;
    }

    chosenColors.forEach((colorId, i) => {
      const pos = crystalLocations[i % crystalLocations.length];
      const colDef = getColorDef(colorId);
      const group = new THREE.Group();
      group.position.copy(pos);

      // 1. Pedestal Dasar & Cincin lantai bercahaya
      const basePed = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.28, 0.22, 16),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          roughness: 0.35,
          metalness: 0.85,
        })
      );
      basePed.position.y = 0.11;
      group.add(basePed);

      const floorRing = new THREE.Mesh(
        new THREE.RingGeometry(1.0, 1.32, 32),
        new THREE.MeshBasicMaterial({
          color: colDef.hex,
          side: THREE.DoubleSide,
        })
      );
      floorRing.rotation.x = -Math.PI / 2;
      floorRing.position.y = 0.04;
      group.add(floorRing);

      // 2. Pilar Cahaya Vertikal (Beacon) agar kristal mudah terlihat dari kejauhan
      const beamMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 4.4, 12),
        new THREE.MeshBasicMaterial({
          color: colDef.hex,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        })
      );
      beamMesh.position.y = 2.2;
      group.add(beamMesh);

      // 3. Inti Kristal Berlian 3D (Octahedron) Solid & Bercahaya Sesuai Warna RYB
      const crystalMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.76, 0),
        new THREE.MeshStandardMaterial({
          color: colDef.hex,
          emissive: colDef.hex,
          emissiveIntensity: 0.55,
          roughness: 0.15,
          metalness: 0.2,
        })
      );
      crystalMesh.scale.set(0.88, 1.48, 0.88);
      crystalMesh.position.y = 1.65;
      crystalMesh.castShadow = true;
      group.add(crystalMesh);

      // 4. Cincin Orbit di Sekeliling Kristal
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.055, 8, 28),
        new THREE.MeshBasicMaterial({
          color: '#ffffff',
        })
      );
      ringMesh.position.y = 1.65;
      group.add(ringMesh);

      this.scene.add(group);
      this.bossCrystals.push({
        id: `crystal_${i}_${colorId}`,
        colorId,
        colorHex: colDef.hex,
        group,
        crystalMesh,
        ringMesh,
        position: pos.clone(),
        isCollected: false,
        respawnTimer: 0,
        pickupRadius: 2.5,
      });
    });
  }

  public update(time: number, dt: number) {
    this.pillarBeacons.forEach((b, i) => {
      b.rotation.y = time * 1.2 + i;
      b.position.y = 9.4 + Math.sin(time * 2 + i) * 0.25;
    });

    // Animasi putaran & melayang pada Kristal Warna Boss
    this.bossCrystals.forEach((c, idx) => {
      if (c.isCollected) {
        if (c.respawnTimer > 0) {
          c.respawnTimer -= dt;
          if (c.respawnTimer <= 0) {
            c.isCollected = false;
            c.group.visible = true;
          }
        }
        return;
      }

      const bob = Math.sin(time * 2.8 + idx * 1.3) * 0.2;
      c.crystalMesh.position.y = 1.65 + bob;
      c.crystalMesh.rotation.y = time * 1.8 + idx;
      c.ringMesh.position.y = 1.65 + bob;
      c.ringMesh.rotation.x = Math.PI / 3 + Math.sin(time * 1.5 + idx) * 0.35;
      c.ringMesh.rotation.y = -time * 1.4;
    });
  }

  public dispose() {
    if (this.gridTexture) {
      this.gridTexture.dispose();
    }
  }
}

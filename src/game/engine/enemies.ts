import * as THREE from 'three';
import { BossPhase, EnemyDef, EnemyType, GameColorId } from '../types';
import { ENEMY_ARCHETYPES, getColorDef, getBossPhaseForHp } from '../rules';
import { ALL_RYB_COLORS } from '../colors';
import { sound } from '../audio';

const _scratchToPlayer = new THREE.Vector3();
const _scratchDir = new THREE.Vector3();
const _scratchSideDir = new THREE.Vector3();
const _scratchPlayerCenter = new THREE.Vector3();

export function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry && !mesh.userData?.sharedGeo) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });
}

function createChamferedPlateGeo(
  width: number,
  height: number,
  depth: number,
  chamfer: number = 0.06,
  bevel: number = 0.03
): THREE.BufferGeometry {
  const hw = Math.max(0.02, width / 2 - bevel);
  const hh = Math.max(0.02, height / 2 - bevel);
  const c = Math.min(chamfer, hw * 0.6, hh * 0.6);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + c, -hh);
  shape.lineTo(hw - c, -hh);
  shape.lineTo(hw, -hh + c);
  shape.lineTo(hw, hh - c);
  shape.lineTo(hw - c, hh);
  shape.lineTo(-hw + c, hh);
  shape.lineTo(-hw, hh - c);
  shape.lineTo(-hw, -hh + c);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  });
  geo.center();
  return geo;
}

function createEliteCrestGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.2, -0.02);
  shape.lineTo(0.18, -0.02);
  shape.lineTo(0.12, 0.24);
  shape.lineTo(-0.08, 0.27);
  shape.lineTo(-0.22, 0.08);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  geo.center();
  // Putar agar sirip memanjang di sumbu Z (depan-belakang)
  geo.rotateY(Math.PI / 2);
  return geo;
}

function createTitanWingGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.42);
  shape.lineTo(1.25, -0.18);
  shape.lineTo(1.42, 0.68);
  shape.lineTo(0.18, 0.44);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

function createSweptHornGeo(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.14, -0.2);
  shape.lineTo(0.18, -0.14);
  shape.lineTo(0.46, 0.28);
  shape.lineTo(0.38, 0.92);
  shape.lineTo(0.16, 0.56);
  shape.lineTo(0.06, 0.16);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  geo.center();
  return geo;
}

interface SharedEnemyGeometryBank {
  // Chromabot shared geos
  botHipJoint: THREE.BufferGeometry;
  botThigh: THREE.BufferGeometry;
  botKneeBall: THREE.BufferGeometry;
  botKneePlate: THREE.BufferGeometry;
  botShin: THREE.BufferGeometry;
  botFootUpper: THREE.BufferGeometry;
  botFootSole: THREE.BufferGeometry;
  botPelvis: THREE.BufferGeometry;
  botWaistCore: THREE.BufferGeometry;
  botChest: THREE.BufferGeometry;
  botCollar: THREE.BufferGeometry;
  botBackpack: THREE.BufferGeometry;
  botPackVent: THREE.BufferGeometry;
  botCoreFrame: THREE.BufferGeometry;
  botCoreRing: THREE.BufferGeometry;
  botChestGem: THREE.BufferGeometry;
  botShoulderBall: THREE.BufferGeometry;
  botShoulderCap: THREE.BufferGeometry;
  botElitePauldron: THREE.BufferGeometry;
  botElitePauldronTrim: THREE.BufferGeometry;
  botUpperArm: THREE.BufferGeometry;
  botElbowBall: THREE.BufferGeometry;
  botForearm: THREE.BufferGeometry;
  botWristCuff: THREE.BufferGeometry;
  botPalm: THREE.BufferGeometry;
  botHandGuard: THREE.BufferGeometry;
  botFingers: THREE.BufferGeometry;
  botHeadDome: THREE.BufferGeometry;
  botBrowPlate: THREE.BufferGeometry;
  botJawGuard: THREE.BufferGeometry;
  botVisorArc: THREE.BufferGeometry;
  botEye: THREE.BufferGeometry;
  botEarOuter: THREE.BufferGeometry;
  botEarInner: THREE.BufferGeometry;
  botEliteCrest: THREE.BufferGeometry;
  botEliteGorget: THREE.BufferGeometry;
  // Titan shared geos
  titanThigh: THREE.BufferGeometry;
  titanKneeHex: THREE.BufferGeometry;
  titanKneeTrim: THREE.BufferGeometry;
  titanShin: THREE.BufferGeometry;
  titanBoot: THREE.BufferGeometry;
  titanBootToe: THREE.BufferGeometry;
  titanWaist: THREE.BufferGeometry;
  titanChestHull: THREE.BufferGeometry;
  titanChestPlate: THREE.BufferGeometry;
  titanCollarRim: THREE.BufferGeometry;
  titanWing: THREE.BufferGeometry;
  titanBackpack: THREE.BufferGeometry;
  titanCoreHousing: THREE.BufferGeometry;
  titanCoreBezel: THREE.BufferGeometry;
  titanCoreRingOuter: THREE.BufferGeometry;
  titanCoreRingInner: THREE.BufferGeometry;
  titanChestGem: THREE.BufferGeometry;
  titanPauldronBody: THREE.BufferGeometry;
  titanPauldronTrim: THREE.BufferGeometry;
  titanUpperArm: THREE.BufferGeometry;
  titanElbowCuff: THREE.BufferGeometry;
  titanCannonBarrel: THREE.BufferGeometry;
  titanCannonSleeve: THREE.BufferGeometry;
  titanCannonFin: THREE.BufferGeometry;
  titanMuzzleRing: THREE.BufferGeometry;
  titanMuzzleGlow: THREE.BufferGeometry;
  titanHelm: THREE.BufferGeometry;
  titanVisor: THREE.BufferGeometry;
  titanHorn: THREE.BufferGeometry;
}

let cachedEnemyGeos: SharedEnemyGeometryBank | null = null;

function getSharedEnemyGeometries(): SharedEnemyGeometryBank {
  if (cachedEnemyGeos) return cachedEnemyGeos;

  const botVisorArc = new THREE.CylinderGeometry(
    0.295,
    0.285,
    0.19,
    12,
    1,
    false,
    -Math.PI * 0.36,
    Math.PI * 0.72
  );

  cachedEnemyGeos = {
    botHipJoint: new THREE.SphereGeometry(0.105, 8, 8),
    botThigh: new THREE.CylinderGeometry(0.095, 0.082, 0.28, 10),
    botKneeBall: new THREE.SphereGeometry(0.095, 8, 8),
    botKneePlate: createChamferedPlateGeo(0.18, 0.16, 0.08, 0.04, 0.02),
    botShin: new THREE.CylinderGeometry(0.135, 0.095, 0.32, 10),
    botFootUpper: createChamferedPlateGeo(0.22, 0.12, 0.31, 0.05, 0.025),
    botFootSole: new THREE.BoxGeometry(0.23, 0.045, 0.33),
    botPelvis: createChamferedPlateGeo(0.46, 0.18, 0.34, 0.07, 0.03),
    botWaistCore: new THREE.CylinderGeometry(0.21, 0.24, 0.22, 10),
    botChest: createChamferedPlateGeo(0.84, 0.48, 0.56, 0.14, 0.06),
    botCollar: new THREE.CylinderGeometry(0.29, 0.37, 0.12, 12),
    botBackpack: createChamferedPlateGeo(0.44, 0.38, 0.22, 0.07, 0.03),
    botPackVent: new THREE.CylinderGeometry(0.065, 0.08, 0.1, 8),
    botCoreFrame: new THREE.CylinderGeometry(0.185, 0.185, 0.08, 14),
    botCoreRing: new THREE.TorusGeometry(0.155, 0.018, 6, 16),
    botChestGem: new THREE.IcosahedronGeometry(0.13, 0),
    botShoulderBall: new THREE.SphereGeometry(0.12, 8, 8),
    botShoulderCap: new THREE.SphereGeometry(0.175, 10, 10),
    botElitePauldron: createChamferedPlateGeo(0.32, 0.18, 0.38, 0.07, 0.03),
    botElitePauldronTrim: createChamferedPlateGeo(0.34, 0.06, 0.4, 0.05, 0.015),
    botUpperArm: new THREE.CylinderGeometry(0.072, 0.068, 0.24, 8),
    botElbowBall: new THREE.SphereGeometry(0.082, 8, 8),
    botForearm: new THREE.CylinderGeometry(0.105, 0.128, 0.28, 10),
    botWristCuff: new THREE.CylinderGeometry(0.105, 0.105, 0.06, 10),
    botPalm: new THREE.BoxGeometry(0.11, 0.11, 0.12),
    botHandGuard: createChamferedPlateGeo(0.12, 0.1, 0.11, 0.03, 0.015),
    botFingers: new THREE.BoxGeometry(0.08, 0.09, 0.09),
    botHeadDome: new THREE.SphereGeometry(0.315, 14, 12),
    botBrowPlate: createChamferedPlateGeo(0.42, 0.08, 0.16, 0.04, 0.02),
    botJawGuard: createChamferedPlateGeo(0.46, 0.13, 0.36, 0.08, 0.03),
    botVisorArc,
    botEye: new THREE.CapsuleGeometry(0.028, 0.055, 4, 6),
    botEarOuter: new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10),
    botEarInner: new THREE.CylinderGeometry(0.065, 0.065, 0.11, 10),
    botEliteCrest: createEliteCrestGeo(),
    botEliteGorget: createChamferedPlateGeo(0.66, 0.15, 0.34, 0.08, 0.025),
    // CHROMA TITAN geos
    titanThigh: createChamferedPlateGeo(0.76, 0.96, 0.84, 0.12, 0.05),
    titanKneeHex: new THREE.CylinderGeometry(0.44, 0.44, 0.28, 6),
    titanKneeTrim: new THREE.CylinderGeometry(0.5, 0.5, 0.22, 6),
    titanShin: new THREE.CylinderGeometry(0.54, 0.68, 1.12, 8),
    titanBoot: createChamferedPlateGeo(1.06, 0.38, 1.44, 0.16, 0.05),
    titanBootToe: createChamferedPlateGeo(0.92, 0.24, 0.55, 0.1, 0.035),
    titanWaist: new THREE.CylinderGeometry(1.26, 1.04, 0.72, 8),
    titanChestHull: new THREE.CylinderGeometry(2.02, 1.4, 2.04, 8),
    titanChestPlate: createChamferedPlateGeo(3.2, 1.75, 0.72, 0.32, 0.09),
    titanCollarRim: createChamferedPlateGeo(2.2, 0.34, 1.35, 0.2, 0.05),
    titanWing: createTitanWingGeo(),
    titanBackpack: createChamferedPlateGeo(2.2, 1.5, 0.85, 0.2, 0.06),
    titanCoreHousing: new THREE.CylinderGeometry(1.16, 1.24, 0.44, 14),
    titanCoreBezel: new THREE.TorusGeometry(1.14, 0.09, 8, 20),
    titanCoreRingOuter: new THREE.TorusGeometry(0.98, 0.085, 8, 24),
    titanCoreRingInner: new THREE.TorusGeometry(0.72, 0.06, 6, 20),
    titanChestGem: new THREE.IcosahedronGeometry(0.56, 0),
    titanPauldronBody: createChamferedPlateGeo(1.42, 1.22, 1.56, 0.24, 0.07),
    titanPauldronTrim: createChamferedPlateGeo(1.48, 0.28, 1.62, 0.2, 0.04),
    titanUpperArm: createChamferedPlateGeo(0.68, 1.02, 0.68, 0.1, 0.04),
    titanElbowCuff: createChamferedPlateGeo(0.78, 0.36, 0.82, 0.1, 0.03),
    titanCannonBarrel: new THREE.CylinderGeometry(0.42, 0.52, 1.68, 10),
    titanCannonSleeve: new THREE.CylinderGeometry(0.49, 0.55, 0.58, 10),
    titanCannonFin: createChamferedPlateGeo(0.14, 0.26, 0.95, 0.04, 0.02),
    titanMuzzleRing: new THREE.TorusGeometry(0.39, 0.075, 8, 16),
    titanMuzzleGlow: new THREE.CircleGeometry(0.33, 14),
    titanHelm: new THREE.CylinderGeometry(0.62, 0.72, 0.86, 8),
    titanVisor: createChamferedPlateGeo(0.84, 0.24, 0.22, 0.06, 0.02),
    titanHorn: createSweptHornGeo(),
  };

  return cachedEnemyGeos;
}

function makeSharedMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.userData.sharedGeo = true;
  return m;
}

export function resolveCircleXZCollision(
  pos: THREE.Vector3,
  radius: number,
  colliders: THREE.Box3[]
) {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (pos.y > box.max.y + 0.5) continue;

    const cx = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    const cz = Math.max(box.min.z, Math.min(pos.z, box.max.z));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        // Pusat berada tepat di dalam box: dorong keluar ke sisi terdekat
        const dLeft = Math.abs(pos.x - box.min.x);
        const dRight = Math.abs(box.max.x - pos.x);
        const dTop = Math.abs(pos.z - box.min.z);
        const dBottom = Math.abs(box.max.z - pos.z);
        const minD = Math.min(dLeft, dRight, dTop, dBottom);
        if (minD === dLeft) pos.x = box.min.x - radius;
        else if (minD === dRight) pos.x = box.max.x + radius;
        else if (minD === dTop) pos.z = box.min.z - radius;
        else pos.z = box.max.z + radius;
      }
    }
  }
}

export interface ArticulatedRig {
  bodyGroup: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  chestCore: THREE.Mesh;
  coreRingOuter?: THREE.Mesh;
  coreRingInner?: THREE.Mesh;
}

export interface EnemyInstance {
  id: string;
  type: EnemyType;
  colorId: GameColorId;
  mesh: THREE.Group;
  rig: ArticulatedRig;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  state: 'spawning' | 'active' | 'dead';
  spawnTimer: number;
  spawnDuration: number;
  walkPhase: number;
  idlePhase: number;
  shootCooldown: number;
  attackAnimTimer: number;
  hitReactionTimer: number;
  wrongHitFlash: number;
  deathTimer: number;
  bossDeathBurstAccum?: number;
  isStunned: number;
  preferredDist: number;
  scoreAwarded: boolean;
  bossPhase?: BossPhase;
  telegraphMesh?: THREE.Mesh;
  armorMaterials: THREE.MeshStandardMaterial[];
  emissiveBasicMaterials: THREE.MeshBasicMaterial[];
}

export interface EnergyProjectile {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
  colorHex: string;
  isBossOrb: boolean;
}

export class EnemyManager {
  public scene: THREE.Scene;
  public enemies: EnemyInstance[] = [];
  public projectiles: EnergyProjectile[] = [];
  private fragments: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

  // Jeda adaptasi setelah target warna baru muncul agar pemain punya waktu membaca petunjuk
  public targetGraceTimer: number = 0;

  private sharedProjGeo = new THREE.SphereGeometry(1, 14, 14);
  private sharedFragGeo = new THREE.OctahedronGeometry(0.18, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public triggerTargetGracePeriod(seconds: number = 2.5) {
    this.targetGraceTimer = Math.max(this.targetGraceTimer, seconds);
  }

  public spawnEnemy(
    type: EnemyType,
    colorId: GameColorId,
    spawnPos: THREE.Vector3,
    hpMult: number = 1.0,
    speedMult: number = 1.0
  ): EnemyInstance {
    const def = ENEMY_ARCHETYPES[type];
    const built = this.buildStylizedCharacter(type, colorId, def);
    const group = built.group;
    group.position.copy(spawnPos);

    const isBoss = type === 'chroma_titan';
    const spawnDuration = isBoss ? 1.5 : 0.55;

    if (isBoss) {
      group.position.y = 12.0;
    } else {
      group.scale.set(0.01, 0.01, 0.01);
    }

    this.scene.add(group);

    let preferredDist = 18.0;
    if (type === 'chromabot_normal') preferredDist = 15.5 + Math.random() * 4.5;
    else if (type === 'chromabot_elite') preferredDist = 17.5 + Math.random() * 4.5;
    else if (type === 'chroma_titan') preferredDist = 12.0;

    const shootCooldown =
      def.shootCooldownMin + Math.random() * (def.shootCooldownMax - def.shootCooldownMin);

    const enemy: EnemyInstance = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      colorId,
      mesh: group,
      rig: built.rig,
      hp: Math.round(def.maxHp * hpMult),
      maxHp: Math.round(def.maxHp * hpMult),
      speed: def.speed * speedMult,
      damage: def.damage,
      position: group.position,
      velocity: new THREE.Vector3(),
      state: 'spawning',
      spawnTimer: spawnDuration,
      spawnDuration,
      walkPhase: Math.random() * Math.PI * 2,
      idlePhase: Math.random() * Math.PI * 2,
      shootCooldown,
      attackAnimTimer: 0,
      hitReactionTimer: 0,
      wrongHitFlash: 0,
      deathTimer: 0,
      isStunned: 0,
      preferredDist,
      scoreAwarded: false,
      bossPhase: isBoss ? 1 : undefined,
      telegraphMesh: built.telegraphMesh,
      armorMaterials: built.armorMaterials,
      emissiveBasicMaterials: built.emissiveBasicMaterials,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * Mengubah identitas warna RYB pada Chromabot atau COLOR CORE milik CHROMA TITAN secara konsisten.
   */
  public setEnemyColor(enemy: EnemyInstance, newColorId: GameColorId) {
    enemy.colorId = newColorId;
    // Boss CHROMA TITAN mempertahankan warna netralnya agar tidak membocorkan warna target
    if (enemy.type === 'chroma_titan') return;

    const cDef = getColorDef(newColorId);

    enemy.armorMaterials.forEach((mat) => {
      mat.color.set(cDef.hex);
      mat.emissive.set(cDef.hex);
    });

    enemy.emissiveBasicMaterials.forEach((mat) => {
      mat.color.set(cDef.hex);
    });
  }

  /**
   * Membangun karakter 3D Stylized Semi-Cartoon:
   * - Satu Base Model konsisten untuk Chromabot Normal & Elite (proporsi robot penjaga energi warna,
   *   kepala dengan visor ekspresif, badan kompak, 2 lengan berartikulasi, 2 kaki mekanis seimbang, inti dada).
   * - Model khusus Colossus Mech untuk Final Boss CHROMA TITAN dengan COLOR CORE raksasa di dada.
   */
  private buildStylizedCharacter(
    type: EnemyType,
    colorId: GameColorId,
    def: EnemyDef
  ): {
    group: THREE.Group;
    rig: ArticulatedRig;
    telegraphMesh: THREE.Mesh;
    armorMaterials: THREE.MeshStandardMaterial[];
    emissiveBasicMaterials: THREE.MeshBasicMaterial[];
  } {
    const geos = getSharedEnemyGeometries();
    if (type === 'chromabot_normal' || type === 'chromabot_elite') {
      return this.buildChromabotRig(type === 'chromabot_elite', colorId, def, geos);
    }
    return this.buildChromaTitanRig(def, geos);
  }

  private buildChromabotRig(
    isElite: boolean,
    colorId: GameColorId,
    def: EnemyDef,
    geos: SharedEnemyGeometryBank
  ) {
    const group = new THREE.Group();
    const cDef = getColorDef(colorId);
    const scale = isElite ? 1.32 : 1.0;

    const armorMaterials: THREE.MeshStandardMaterial[] = [];
    const emissiveBasicMaterials: THREE.MeshBasicMaterial[] = [];

    // Material Utama Warna RYB: Solid, Jelas, Rim Halus, Tetap Terbaca di Semua Pencahayaan
    const primaryColorMat = new THREE.MeshStandardMaterial({
      color: cDef.hex,
      emissive: cDef.hex,
      emissiveIntensity: 0.36,
      roughness: 0.28,
      metalness: 0.16,
    });
    armorMaterials.push(primaryColorMat);

    const coreGlowMat = new THREE.MeshBasicMaterial({
      color: cDef.hex,
    });
    emissiveBasicMaterials.push(coreGlowMat);

    const darkJointMat = new THREE.MeshStandardMaterial({
      color: '#172030',
      roughness: 0.42,
      metalness: 0.68,
    });

    const visorGlassMat = new THREE.MeshStandardMaterial({
      color: '#070b14',
      roughness: 0.12,
      metalness: 0.92,
    });

    const eyeLightMat = new THREE.MeshBasicMaterial({
      color: '#f8fafc',
    });

    const bodyGroup = new THREE.Group();
    bodyGroup.scale.setScalar(scale);
    group.add(bodyGroup);

    // === 1. DUA KAKI MEKANIS BER-ARMOR LUTUT & SEPATU STABILIZER ===
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.23, 0.72, 0);
    bodyGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.23, 0.72, 0);
    bodyGroup.add(rightLegPivot);

    [leftLegPivot, rightLegPivot].forEach((legPivot) => {
      legPivot.add(makeSharedMesh(geos.botHipJoint, darkJointMat));

      const thigh = makeSharedMesh(geos.botThigh, darkJointMat);
      thigh.position.set(0, -0.17, 0);
      legPivot.add(thigh);

      const kneeBall = makeSharedMesh(geos.botKneeBall, darkJointMat);
      kneeBall.position.set(0, -0.33, 0.01);
      legPivot.add(kneeBall);

      const kneePlate = makeSharedMesh(geos.botKneePlate, primaryColorMat);
      kneePlate.position.set(0, -0.32, 0.09);
      kneePlate.rotation.x = -0.18;
      legPivot.add(kneePlate);

      const shin = makeSharedMesh(geos.botShin, primaryColorMat);
      shin.position.set(0, -0.49, 0.02);
      legPivot.add(shin);

      const footUpper = makeSharedMesh(geos.botFootUpper, primaryColorMat);
      footUpper.position.set(0, -0.64, 0.055);
      legPivot.add(footUpper);

      const sole = makeSharedMesh(geos.botFootSole, darkJointMat);
      sole.position.set(0, -0.7, 0.055);
      legPivot.add(sole);
    });

    // === 2. PINGGUL, PINGGANG MEKANIS & DADA BEVELED STYLIZED ===
    const pelvis = makeSharedMesh(geos.botPelvis, primaryColorMat);
    pelvis.position.set(0, 0.76, 0);
    bodyGroup.add(pelvis);

    const waistCore = makeSharedMesh(geos.botWaistCore, darkJointMat);
    waistCore.position.set(0, 0.92, 0);
    bodyGroup.add(waistCore);

    const chest = makeSharedMesh(geos.botChest, primaryColorMat);
    chest.position.set(0, 1.18, 0.02);
    bodyGroup.add(chest);

    const collar = makeSharedMesh(geos.botCollar, primaryColorMat);
    collar.position.set(0, 1.44, 0);
    bodyGroup.add(collar);

    const backpack = makeSharedMesh(geos.botBackpack, primaryColorMat);
    backpack.position.set(0, 1.19, -0.32);
    bodyGroup.add(backpack);

    for (let side = -1; side <= 1; side += 2) {
      const vent = makeSharedMesh(geos.botPackVent, darkJointMat);
      vent.position.set(side * 0.12, 1.02, -0.36);
      vent.rotation.x = 0.25;
      bodyGroup.add(vent);
    }

    // === 3. INTI ENERGI DADA BERFESET (CHEST CORE) ===
    const coreFrame = makeSharedMesh(geos.botCoreFrame, darkJointMat);
    coreFrame.rotation.x = Math.PI / 2;
    coreFrame.position.set(0, 1.18, 0.29);
    bodyGroup.add(coreFrame);

    const coreRing = makeSharedMesh(geos.botCoreRing, coreGlowMat);
    coreRing.position.set(0, 1.18, 0.34);
    bodyGroup.add(coreRing);

    const chestCore = makeSharedMesh(geos.botChestGem, coreGlowMat);
    chestCore.position.set(0, 1.18, 0.35);
    bodyGroup.add(chestCore);

    // === 4. DUA LENGAN MEKANIS + TANGAN JARI STYLIZED ===
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.52, 1.32, 0);
    bodyGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.52, 1.32, 0);
    bodyGroup.add(rightArmPivot);

    [leftArmPivot, rightArmPivot].forEach((armPivot, idx) => {
      const side = idx === 0 ? -1 : 1;

      const shoulderSocket = makeSharedMesh(geos.botShoulderBall, darkJointMat);
      armPivot.add(shoulderSocket);

      const shoulderCap = makeSharedMesh(geos.botShoulderCap, primaryColorMat);
      shoulderCap.scale.set(1.06, 0.92, 1.0);
      shoulderCap.position.set(side * 0.04, 0.03, 0);
      armPivot.add(shoulderCap);

      if (isElite) {
        const elitePauldron = makeSharedMesh(geos.botElitePauldron, primaryColorMat);
        elitePauldron.position.set(side * 0.11, 0.12, 0);
        elitePauldron.rotation.z = -side * 0.36;
        armPivot.add(elitePauldron);

        const pauldronTrim = makeSharedMesh(geos.botElitePauldronTrim, darkJointMat);
        pauldronTrim.position.set(side * 0.1, 0.05, 0);
        pauldronTrim.rotation.z = -side * 0.36;
        armPivot.add(pauldronTrim);
      }

      const upperArm = makeSharedMesh(geos.botUpperArm, darkJointMat);
      upperArm.position.set(side * 0.07, -0.18, 0);
      armPivot.add(upperArm);

      const elbow = makeSharedMesh(geos.botElbowBall, darkJointMat);
      elbow.position.set(side * 0.08, -0.31, 0.01);
      armPivot.add(elbow);

      const forearm = makeSharedMesh(geos.botForearm, primaryColorMat);
      forearm.position.set(side * 0.085, -0.45, 0.07);
      forearm.rotation.x = 0.28;
      armPivot.add(forearm);

      const wristCuff = makeSharedMesh(geos.botWristCuff, darkJointMat);
      wristCuff.position.set(side * 0.085, -0.58, 0.12);
      wristCuff.rotation.x = 0.28;
      armPivot.add(wristCuff);

      const palm = makeSharedMesh(geos.botPalm, darkJointMat);
      palm.position.set(side * 0.085, -0.65, 0.14);
      armPivot.add(palm);

      const handGuard = makeSharedMesh(geos.botHandGuard, primaryColorMat);
      handGuard.position.set(side * 0.115, -0.64, 0.15);
      armPivot.add(handGuard);

      const fingers = makeSharedMesh(geos.botFingers, darkJointMat);
      fingers.position.set(side * 0.065, -0.71, 0.16);
      fingers.rotation.z = side * 0.18;
      armPivot.add(fingers);
    });

    // === 5. KEPALA HELM STYLIZED DENGAN VISOR MELENGKUNG & MATA EKSPRESIF ===
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.53, 0);
    bodyGroup.add(headPivot);

    const headDome = makeSharedMesh(geos.botHeadDome, primaryColorMat);
    headDome.scale.set(1.06, 0.94, 1.02);
    headDome.position.set(0, 0.22, 0);
    headPivot.add(headDome);

    const browPlate = makeSharedMesh(geos.botBrowPlate, primaryColorMat);
    browPlate.position.set(0, 0.315, 0.235);
    browPlate.rotation.x = 0.24;
    headPivot.add(browPlate);

    const jawGuard = makeSharedMesh(geos.botJawGuard, primaryColorMat);
    jawGuard.position.set(0, 0.075, 0.06);
    headPivot.add(jawGuard);

    const visorArc = makeSharedMesh(geos.botVisorArc, visorGlassMat);
    visorArc.position.set(0, 0.21, 0.055);
    headPivot.add(visorArc);

    for (let side = -1; side <= 1; side += 2) {
      const eye = makeSharedMesh(geos.botEye, eyeLightMat);
      eye.rotation.z = Math.PI / 2 - side * 0.16;
      eye.rotation.y = side * 0.25;
      eye.position.set(side * 0.105, 0.22, 0.33);
      headPivot.add(eye);

      const earOuter = makeSharedMesh(geos.botEarOuter, primaryColorMat);
      earOuter.rotation.z = Math.PI / 2;
      earOuter.position.set(side * 0.33, 0.22, 0);
      headPivot.add(earOuter);

      const earInner = makeSharedMesh(geos.botEarInner, darkJointMat);
      earInner.rotation.z = Math.PI / 2;
      earInner.position.set(side * 0.345, 0.22, 0);
      headPivot.add(earInner);
    }

    // Mahkota Sirip & Gorget Pelindung Dada khusus ELITE CHROMABOT
    if (isElite) {
      const crest = makeSharedMesh(geos.botEliteCrest, primaryColorMat);
      crest.position.set(0, 0.51, -0.02);
      headPivot.add(crest);

      const gorget = makeSharedMesh(geos.botEliteGorget, primaryColorMat);
      gorget.position.set(0, 1.42, 0.15);
      gorget.rotation.x = -0.18;
      bodyGroup.add(gorget);
    }

    const telegraph = new THREE.Mesh(
      new THREE.SphereGeometry(def.projectileSize, 10, 10),
      coreGlowMat
    );
    telegraph.name = 'attack_telegraph';
    telegraph.position.set(0, 1.18, 0.85);
    telegraph.visible = false;
    bodyGroup.add(telegraph);

    return {
      group,
      rig: {
        bodyGroup,
        headPivot,
        leftArmPivot,
        rightArmPivot,
        leftLegPivot,
        rightLegPivot,
        chestCore,
      },
      telegraphMesh: telegraph,
      armorMaterials,
      emissiveBasicMaterials,
    };
  }

  private buildChromaTitanRig(
    def: EnemyDef,
    geos: SharedEnemyGeometryBank
  ) {
    const group = new THREE.Group();
    const armorMaterials: THREE.MeshStandardMaterial[] = [];
    const emissiveBasicMaterials: THREE.MeshBasicMaterial[] = [];

    const titanArmorMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.3,
      metalness: 0.82,
    });

    const titanSubArmorMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.38,
      metalness: 0.72,
    });

    const coreAccentArmorMat = new THREE.MeshStandardMaterial({
      color: '#64748b',
      emissive: '#475569',
      emissiveIntensity: 0.42,
      roughness: 0.25,
      metalness: 0.4,
    });
    armorMaterials.push(coreAccentArmorMat);

    const corePureMat = new THREE.MeshBasicMaterial({
      color: '#f1f5f9',
    });
    emissiveBasicMaterials.push(corePureMat);

    const bodyGroup = new THREE.Group();
    group.add(bodyGroup);

    // 1. Kaki Colossus Ber-Armor Lutut Segi Enam & Sepatu Berat
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-1.05, 2.1, 0);
    bodyGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(1.05, 2.1, 0);
    bodyGroup.add(rightLegPivot);

    [leftLegPivot, rightLegPivot].forEach((legPivot) => {
      const upperLeg = makeSharedMesh(geos.titanThigh, titanSubArmorMat);
      upperLeg.position.set(0, -0.46, 0);
      legPivot.add(upperLeg);

      const kneeTrim = makeSharedMesh(geos.titanKneeTrim, coreAccentArmorMat);
      kneeTrim.rotation.x = Math.PI / 2;
      kneeTrim.position.set(0, -0.94, 0.39);
      legPivot.add(kneeTrim);

      const kneeHex = makeSharedMesh(geos.titanKneeHex, titanArmorMat);
      kneeHex.rotation.x = Math.PI / 2;
      kneeHex.position.set(0, -0.94, 0.45);
      legPivot.add(kneeHex);

      const lowerLeg = makeSharedMesh(geos.titanShin, titanArmorMat);
      lowerLeg.position.set(0, -1.45, 0);
      legPivot.add(lowerLeg);

      const heavyBoot = makeSharedMesh(geos.titanBoot, titanArmorMat);
      heavyBoot.position.set(0, -1.92, 0.18);
      legPivot.add(heavyBoot);

      const bootToe = makeSharedMesh(geos.titanBootToe, coreAccentArmorMat);
      bootToe.position.set(0, -1.95, 0.65);
      legPivot.add(bootToe);
    });

    // 2. Pinggang, Torso Benteng & Sayap Punggung
    const waistBlock = makeSharedMesh(geos.titanWaist, titanSubArmorMat);
    waistBlock.position.set(0, 2.35, 0);
    bodyGroup.add(waistBlock);

    const chestHull = makeSharedMesh(geos.titanChestHull, titanArmorMat);
    chestHull.position.set(0, 3.65, 0);
    chestHull.scale.set(1.12, 1.0, 0.8);
    bodyGroup.add(chestHull);

    const chestPlate = makeSharedMesh(geos.titanChestPlate, titanSubArmorMat);
    chestPlate.position.set(0, 3.72, 0.66);
    bodyGroup.add(chestPlate);

    const collarRim = makeSharedMesh(geos.titanCollarRim, coreAccentArmorMat);
    collarRim.position.set(0, 4.72, 0.15);
    bodyGroup.add(collarRim);

    const titanBack = makeSharedMesh(geos.titanBackpack, titanSubArmorMat);
    titanBack.position.set(0, 3.85, -1.05);
    bodyGroup.add(titanBack);

    for (let side = -1; side <= 1; side += 2) {
      const wing = makeSharedMesh(geos.titanWing, titanSubArmorMat);
      wing.scale.x = side;
      wing.position.set(side * 2.02, 4.78, -0.58);
      wing.rotation.y = -side * 0.18;
      bodyGroup.add(wing);
    }

    // 3. COLOR CORE RAKSASA DI DADA (Housing + Bezel + 2 Cincin Gyro + Inti Berfaset)
    const coreHousing = makeSharedMesh(geos.titanCoreHousing, titanSubArmorMat);
    coreHousing.rotation.x = Math.PI / 2;
    coreHousing.position.set(0, 3.65, 1.08);
    bodyGroup.add(coreHousing);

    const coreBezel = makeSharedMesh(geos.titanCoreBezel, coreAccentArmorMat);
    coreBezel.position.set(0, 3.65, 1.24);
    bodyGroup.add(coreBezel);

    const coreRingOuter = makeSharedMesh(geos.titanCoreRingOuter, corePureMat);
    coreRingOuter.position.set(0, 3.65, 1.29);
    bodyGroup.add(coreRingOuter);

    const coreRingInner = makeSharedMesh(geos.titanCoreRingInner, corePureMat);
    coreRingInner.position.set(0, 3.65, 1.32);
    bodyGroup.add(coreRingInner);

    const chestCore = makeSharedMesh(geos.titanChestGem, corePureMat);
    chestCore.position.set(0, 3.65, 1.35);
    chestCore.name = 'color_core';
    bodyGroup.add(chestCore);

    // 4. Dua Lengan Meriam Forearm Cannon + Pauldron Oktagonal Berlis
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-2.38, 4.25, 0);
    bodyGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(2.38, 4.25, 0);
    bodyGroup.add(rightArmPivot);

    [leftArmPivot, rightArmPivot].forEach((armPivot, idx) => {
      const side = idx === 0 ? -1 : 1;

      const pauldron = makeSharedMesh(geos.titanPauldronBody, titanArmorMat);
      pauldron.position.set(side * 0.08, 0.08, 0);
      pauldron.rotation.z = -side * 0.16;
      armPivot.add(pauldron);

      const pauldronTrim = makeSharedMesh(geos.titanPauldronTrim, coreAccentArmorMat);
      pauldronTrim.position.set(side * 0.05, -0.34, 0);
      pauldronTrim.rotation.z = -side * 0.16;
      armPivot.add(pauldronTrim);

      const upperArm = makeSharedMesh(geos.titanUpperArm, titanSubArmorMat);
      upperArm.position.set(side * 0.16, -0.95, 0);
      armPivot.add(upperArm);

      const elbowCuff = makeSharedMesh(geos.titanElbowCuff, coreAccentArmorMat);
      elbowCuff.position.set(side * 0.18, -1.42, 0.05);
      armPivot.add(elbowCuff);

      const forearmCannon = makeSharedMesh(geos.titanCannonBarrel, titanArmorMat);
      forearmCannon.position.set(side * 0.2, -1.85, 0.48);
      forearmCannon.rotation.x = Math.PI / 3;
      armPivot.add(forearmCannon);

      const cannonSleeve = makeSharedMesh(geos.titanCannonSleeve, titanSubArmorMat);
      cannonSleeve.position.set(side * 0.2, -1.64, 0.12);
      cannonSleeve.rotation.x = Math.PI / 3;
      armPivot.add(cannonSleeve);

      const cannonFin = makeSharedMesh(geos.titanCannonFin, coreAccentArmorMat);
      cannonFin.position.set(side * 0.2, -1.48, 0.56);
      cannonFin.rotation.x = -Math.PI / 6;
      armPivot.add(cannonFin);

      const muzzleRing = makeSharedMesh(geos.titanMuzzleRing, corePureMat);
      muzzleRing.position.set(side * 0.2, -2.27, 1.21);
      muzzleRing.rotation.x = Math.PI / 3;
      armPivot.add(muzzleRing);

      const muzzleGlow = makeSharedMesh(geos.titanMuzzleGlow, corePureMat);
      muzzleGlow.position.set(side * 0.2, -2.28, 1.22);
      muzzleGlow.rotation.x = Math.PI / 3;
      armPivot.add(muzzleGlow);
    });

    // 5. Kepala Helm Berfaset dengan Visor Tajam & Tanduk Mekanis Melengkung
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 4.9, 0.12);
    bodyGroup.add(headPivot);

    const headHelm = makeSharedMesh(geos.titanHelm, titanArmorMat);
    headHelm.position.set(0, 0.45, 0);
    headPivot.add(headHelm);

    const titanVisor = makeSharedMesh(geos.titanVisor, corePureMat);
    titanVisor.position.set(0, 0.46, 0.57);
    headPivot.add(titanVisor);

    for (let side = -1; side <= 1; side += 2) {
      const horn = makeSharedMesh(geos.titanHorn, coreAccentArmorMat);
      horn.scale.x = side;
      horn.position.set(side * 0.72, 0.88, -0.02);
      headPivot.add(horn);
    }

    const telegraph = new THREE.Mesh(
      new THREE.SphereGeometry(def.projectileSize, 10, 10),
      corePureMat
    );
    telegraph.name = 'attack_telegraph';
    telegraph.position.set(0, 3.65, 2.3);
    telegraph.visible = false;
    bodyGroup.add(telegraph);

    return {
      group,
      rig: {
        bodyGroup,
        headPivot,
        leftArmPivot,
        rightArmPivot,
        leftLegPivot,
        rightLegPivot,
        chestCore,
        coreRingOuter,
        coreRingInner,
      },
      telegraphMesh: telegraph,
      armorMaterials,
      emissiveBasicMaterials,
    };
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onPlayerHurt: (dmg: number) => void,
    onEnemyExplode?: (
      pos: THREE.Vector3,
      colorHex: string,
      isBoss: boolean,
      isPreBurst: boolean
    ) => void,
    colliders?: THREE.Box3[]
  ) {
    if (this.targetGraceTimer > 0) {
      this.targetGraceTimer = Math.max(0, this.targetGraceTimer - dt);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const def = ENEMY_ARCHETYPES[e.type];
      const isBoss = e.type === 'chroma_titan';
      const baseScale = e.type === 'chromabot_elite' ? 1.32 : 1.0;

      // === 1. ANIMASI SPAWN & INTRO BOSS ===
      if (e.state === 'spawning') {
        e.spawnTimer -= dt;
        const progress = 1 - Math.max(0, e.spawnTimer / e.spawnDuration);

        if (isBoss) {
          // Boss turun dari langit dan mendarat dengan hentakan
          e.position.y = THREE.MathUtils.lerp(12.0, 0, Math.min(1, progress * 1.25));
          const crouch = progress > 0.75 ? Math.sin(((progress - 0.75) / 0.25) * Math.PI) * 0.4 : 0;
          e.rig.bodyGroup.position.y = -crouch;
        } else {
          // Chromabot muncul dengan kurva elastis halus
          const easeBack = 1 + 1.7 * Math.pow(progress - 1, 3) + 0.7 * Math.pow(progress - 1, 2);
          const s = Math.max(0.05, Math.min(1.12, easeBack));
          e.mesh.scale.setScalar(s);
          e.rig.bodyGroup.position.y = (1 - progress) * -0.5;
        }

        if (e.spawnTimer <= 0) {
          e.position.y = 0;
          e.mesh.scale.setScalar(1);
          e.rig.bodyGroup.position.y = 0;
          e.state = 'active';
        }
        continue;
      }

      // === 2. ANIMASI MATI / HANCUR ===
      if (e.state === 'dead') {
        e.deathTimer += dt;
        const cDef = getColorDef(e.colorId);

        if (!isBoss) {
          // Musuh kecil: Overload flash & getar singkat, lalu meledak menjadi partikel & fragmen warna
          const explodeTime = 0.14;
          const p = Math.min(1, e.deathTimer / explodeTime);

          e.rig.bodyGroup.position.x = (Math.random() - 0.5) * 0.16;
          e.rig.bodyGroup.position.z = (Math.random() - 0.5) * 0.16;
          e.rig.bodyGroup.position.y = p * 0.18;
          e.mesh.scale.setScalar(1 + p * 0.18);

          e.armorMaterials.forEach((m) => {
            m.emissive.set('#ffffff');
            m.emissiveIntensity = 0.7 + p * 1.6;
          });

          if (e.deathTimer >= explodeTime) {
            const burstPos = _scratchPlayerCenter.copy(e.position).setY(1.1);
            this.spawnDeathDebris(burstPos, cDef.hex, e.type === 'chromabot_elite' ? 10 : 7, 1.35, 1.0);
            onEnemyExplode?.(burstPos, cDef.hex, false, false);
            this.scene.remove(e.mesh);
            disposeHierarchy(e.mesh);
            this.enemies.splice(i, 1);
          }
          continue;
        } else {
          // BOSS CHROMA TITAN: Sekuens kematian epik 3 fase (~1.85 detik)
          const maxDeathTime = 1.85;
          if (e.deathTimer < 1.25) {
            // Fase 1: Destabilisasi, getar hebat, putaran gyro liar, ledakan beruntun
            const p1 = e.deathTimer / 1.25;
            e.rig.bodyGroup.position.x = (Math.random() - 0.5) * 0.36;
            e.rig.bodyGroup.position.z = (Math.random() - 0.5) * 0.36;
            e.rig.bodyGroup.rotation.x = -Math.sin(e.deathTimer * 8) * 0.1 - p1 * 0.25;
            e.rig.leftArmPivot.rotation.z = -0.3 - Math.sin(e.deathTimer * 14) * 0.25;
            e.rig.rightArmPivot.rotation.z = 0.3 + Math.sin(e.deathTimer * 14) * 0.25;

            if (e.rig.coreRingOuter) e.rig.coreRingOuter.rotation.z += dt * 14;
            if (e.rig.coreRingInner) e.rig.coreRingInner.rotation.z -= dt * 18;

            const colorIdx = Math.floor(e.deathTimer * 12) % ALL_RYB_COLORS.length;
            const flashHex = ALL_RYB_COLORS[colorIdx].hex;
            e.armorMaterials.forEach((m) => {
              m.emissive.set(flashHex);
              m.emissiveIntensity = 0.9;
            });

            e.bossDeathBurstAccum = (e.bossDeathBurstAccum || 0) + dt;
            if (e.bossDeathBurstAccum >= 0.22) {
              e.bossDeathBurstAccum = 0;
              const burstPos = _scratchPlayerCenter.set(
                e.position.x + (Math.random() - 0.5) * 2.4,
                1.4 + Math.random() * 2.4,
                e.position.z + (Math.random() - 0.5) * 2.4
              );
              this.spawnDeathDebris(burstPos, flashHex, 4, 1.1, 1.15);
              onEnemyExplode?.(burstPos, flashHex, true, true);
            }
          } else if (e.deathTimer < maxDeathTime) {
            // Fase 2: Overcharge lift & inti dada membesar putih-cyan sebelum klimaks
            const p2 = (e.deathTimer - 1.25) / (maxDeathTime - 1.25);
            e.rig.bodyGroup.position.x = (Math.random() - 0.5) * 0.18;
            e.rig.bodyGroup.position.z = (Math.random() - 0.5) * 0.18;
            e.rig.bodyGroup.position.y = p2 * 1.1;
            e.rig.bodyGroup.rotation.x = -0.25 - p2 * 0.2;
            e.rig.chestCore.scale.setScalar(1 + p2 * 1.5);
            if (e.rig.coreRingOuter) e.rig.coreRingOuter.rotation.z += dt * 22;
            if (e.rig.coreRingInner) e.rig.coreRingInner.rotation.z -= dt * 26;

            e.armorMaterials.forEach((m) => {
              m.emissive.set('#ffffff');
              m.emissiveIntensity = 0.9 + p2 * 1.8;
            });
          } else {
            // Fase 3: Klimaks Ledakan Spektrum 12 Warna + Fragmen Besar
            const climaxPos = _scratchPlayerCenter.copy(e.position).setY(3.0);
            this.spawnBossDeathDebris(climaxPos);
            onEnemyExplode?.(climaxPos, cDef.hex, true, false);
            this.scene.remove(e.mesh);
            disposeHierarchy(e.mesh);
            this.enemies.splice(i, 1);
          }
          continue;
        }
      }

      // Stun dari EMP Shockwave
      if (e.isStunned > 0) {
        e.isStunned -= dt;
        e.rig.headPivot.rotation.z = Math.sin(performance.now() * 0.025) * 0.25;
        continue;
      } else {
        e.rig.headPivot.rotation.z = 0;
      }

      // === 3. REAKSI TERKENA TEMBAKAN (HIT REACTION & IMPACT FLASH) ===
      const cDef = getColorDef(e.colorId);
      if (e.hitReactionTimer > 0) {
        e.hitReactionTimer = Math.max(0, e.hitReactionTimer - dt);
        const ratio = e.hitReactionTimer / 0.22;
        const kick = ratio * 0.42;
        e.rig.bodyGroup.rotation.x = -kick;
        e.rig.headPivot.rotation.x = -kick * 1.35;
        e.rig.leftArmPivot.rotation.z = -ratio * 0.4;
        e.rig.rightArmPivot.rotation.z = ratio * 0.4;
        e.rig.bodyGroup.scale.set(1 + ratio * 0.14, 1 - ratio * 0.1, 1 + ratio * 0.14);

        // Kilatan putih terang pada armor saat terkena hit
        e.armorMaterials.forEach((mat) => {
          mat.emissive.set('#ffffff');
          mat.emissiveIntensity = 1.4 * ratio + 0.34;
        });
      } else {
        e.rig.bodyGroup.rotation.x = THREE.MathUtils.lerp(e.rig.bodyGroup.rotation.x, 0, dt * 14);
        e.rig.headPivot.rotation.x = THREE.MathUtils.lerp(e.rig.headPivot.rotation.x, 0, dt * 14);
        e.rig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(e.rig.leftArmPivot.rotation.z, 0, dt * 12);
        e.rig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(e.rig.rightArmPivot.rotation.z, 0, dt * 12);
        e.rig.bodyGroup.scale.set(1, 1, 1);

        e.armorMaterials.forEach((mat) => {
          mat.emissive.set(isBoss ? '#475569' : cDef.emissiveHex);
          mat.emissiveIntensity = 0.34;
        });
      }

      if (e.wrongHitFlash > 0) {
        e.wrongHitFlash = Math.max(0, e.wrongHitFlash - dt);
        e.rig.headPivot.rotation.y = Math.sin(performance.now() * 0.06) * 0.35;
      } else {
        e.rig.headPivot.rotation.y = 0;
      }

      // Putaran Inti Energi Dada & Cincin Gyro Boss
      e.rig.chestCore.rotation.y += dt * 2.2;
      if (e.rig.coreRingOuter) e.rig.coreRingOuter.rotation.z += dt * 1.2;
      if (e.rig.coreRingInner) e.rig.coreRingInner.rotation.z -= dt * 2.0;

      // === 4. NAVIGASI & PERGERAKAN BERBOBOT ===
      _scratchToPlayer.subVectors(playerPos, e.position);
      _scratchToPlayer.y = 0;
      const dist = _scratchToPlayer.length();
      if (dist > 0.001) {
        _scratchDir.copy(_scratchToPlayer).divideScalar(dist);
      } else {
        _scratchDir.set(0, 0, 1);
      }
      const dir = _scratchDir;

      if (dist > 0.1) {
        const targetYaw = Math.atan2(dir.x, dir.z);
        let diff = targetYaw - e.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        e.mesh.rotation.y += diff * Math.min(1, dt * 10);
      }

      const minThreshold = e.preferredDist - 2.5;
      const maxThreshold = e.preferredDist + 4.0;
      let moveVelocity = 0;
      let lateralAmount = 0;
      let forwardAmount = 0;

      if (isBoss) {
        // Pergerakan Dinamis CHROMA TITAN: mengejar, menjaga tekanan, dan strafing menyamping secara agresif
        const bossPhaseInfo = getBossPhaseForHp(e.hp, e.maxHp);
        const phaseSpeedBoost =
          bossPhaseInfo.phase === 3 ? 1.45 : bossPhaseInfo.phase === 2 ? 1.22 : 1.0;
        const bossSpeed = e.speed * phaseSpeedBoost;

        _scratchSideDir.set(-dir.z, 0, dir.x);
        const sideDir = _scratchSideDir;
        const weaveWave = Math.sin(e.idlePhase * 0.85);
        const surgeFactor = Math.abs(Math.sin(e.idlePhase * 0.42)) > 0.82 ? 1.55 : 1.0;
        const lateralSpeed =
          (weaveWave >= 0 ? Math.max(0.45, weaveWave) : Math.min(-0.45, weaveWave)) *
          bossSpeed *
          0.95 *
          surgeFactor;

        let forwardSpeed = 0;
        if (dist > e.preferredDist + 2.0) {
          forwardSpeed = bossSpeed * 0.9;
        } else if (dist < e.preferredDist - 3.0) {
          forwardSpeed = -bossSpeed * 0.75;
        } else {
          forwardSpeed = Math.cos(e.idlePhase * 0.65) * bossSpeed * 0.45;
        }

        e.position.addScaledVector(dir, forwardSpeed * dt);
        e.position.addScaledVector(sideDir, lateralSpeed * dt);
        moveVelocity = Math.hypot(forwardSpeed, lateralSpeed);
        lateralAmount = lateralSpeed / Math.max(1, bossSpeed);
        forwardAmount = forwardSpeed / Math.max(1, bossSpeed);
      } else {
        _scratchSideDir.set(-dir.z, 0, dir.x);
        const sideDir = _scratchSideDir;
        const strafeDir = Math.sin(e.idlePhase * 0.85 + i * 1.9);

        if (dist < minThreshold) {
          e.position.addScaledVector(dir, -e.speed * dt);
          e.position.addScaledVector(sideDir, strafeDir * e.speed * 0.35 * dt);
          moveVelocity = e.speed;
          forwardAmount = -0.8;
          lateralAmount = strafeDir * 0.35;
        } else if (dist > maxThreshold) {
          // Maju sambil zigzag halus agar gerakan terlihat lincah & dinamis
          e.position.addScaledVector(dir, e.speed * dt);
          e.position.addScaledVector(sideDir, strafeDir * e.speed * 0.4 * dt);
          moveVelocity = e.speed * 1.05;
          forwardAmount = 1.0;
          lateralAmount = strafeDir * 0.4;
        } else {
          const strafeSpeed = e.speed * 0.72;
          e.position.addScaledVector(sideDir, strafeDir * strafeSpeed * dt);
          moveVelocity = Math.abs(strafeDir) * strafeSpeed;
          lateralAmount = strafeDir * 0.72;
        }
      }

      // Kolisi tiang & rintangan arena agar musuh tidak menembus tiang
      if (colliders && colliders.length > 0) {
        resolveCircleXZCollision(e.position, isBoss ? 1.85 : 0.78, colliders);
      }

      e.position.x = Math.max(-26, Math.min(26, e.position.x));
      e.position.z = Math.max(-26, Math.min(26, e.position.z));
      e.position.y = 0;

      // === 5. ANIMASI WALKING, BANKING & IDLE BERARTIKULASI ===
      e.idlePhase += dt * 2.4;
      const isWalking = moveVelocity > 0.15;

      // Kemiringan tubuh (body banking saat strafing & condong saat maju)
      const targetLeanX = forwardAmount * (isBoss ? 0.08 : 0.14);
      const targetBankZ = -lateralAmount * (isBoss ? 0.09 : 0.16);
      if (e.hitReactionTimer <= 0) {
        e.rig.bodyGroup.rotation.x = THREE.MathUtils.lerp(
          e.rig.bodyGroup.rotation.x,
          targetLeanX,
          dt * 8
        );
      }
      e.rig.bodyGroup.rotation.z = THREE.MathUtils.lerp(
        e.rig.bodyGroup.rotation.z,
        targetBankZ,
        dt * 8
      );

      if (isWalking) {
        const strideFreq = isBoss ? 4.4 : 7.2;
        e.walkPhase += dt * strideFreq * (moveVelocity / Math.max(0.8, e.speed));
        const legSwing = Math.sin(e.walkPhase) * (isBoss ? 0.38 : 0.56);

        e.rig.leftLegPivot.rotation.x = legSwing;
        e.rig.rightLegPivot.rotation.x = -legSwing;

        // Bobbing langkah kaki & sedikit gelengan kepala/bahu yang dinamis
        const stepBob = Math.abs(Math.cos(e.walkPhase)) * (isBoss ? 0.14 : 0.085);
        e.rig.bodyGroup.position.y = stepBob * baseScale;
        e.rig.headPivot.rotation.z = Math.sin(e.walkPhase) * 0.06;
      } else {
        // Kembali ke posisi berdiri seimbang + nafas halus (Idle)
        e.rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftLegPivot.rotation.x,
          0,
          dt * 8
        );
        e.rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightLegPivot.rotation.x,
          0,
          dt * 8
        );
        e.rig.bodyGroup.position.y = Math.sin(e.idlePhase) * 0.04 * baseScale;
        e.rig.headPivot.rotation.z = Math.sin(e.idlePhase * 0.7) * 0.04;
      }

      // === 6. ANIMASI ATTACK & COOLDOWN SERANGAN ===
      const phaseDef = isBoss ? getBossPhaseForHp(e.hp, e.maxHp) : undefined;
      const cdRate = phaseDef ? 1 / phaseDef.shootCooldownMult : 1.0;

      // Selama masa jeda adaptasi target baru (targetGraceTimer > 0), perlambat pengisian serangan musuh
      const graceFactor = this.targetGraceTimer > 0 ? 0.25 : 1.0;
      e.shootCooldown -= dt * cdRate * graceFactor;

      if (e.shootCooldown <= 0.85 && e.shootCooldown > 0) {
        // Mengangkat kedua lengan mekanis ke depan untuk mengisi bola energi
        const chargeRatio = 1 - e.shootCooldown / 0.85;
        const aimAngle = -1.15 * chargeRatio;
        e.rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftArmPivot.rotation.x,
          aimAngle,
          dt * 10
        );
        e.rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightArmPivot.rotation.x,
          aimAngle,
          dt * 10
        );

        if (e.telegraphMesh) {
          e.telegraphMesh.visible = true;
          const pulse = 0.5 + chargeRatio * 0.7;
          e.telegraphMesh.scale.setScalar(pulse);
        }
      } else if (e.attackAnimTimer > 0) {
        // Recoil lengan sesaat setelah menembak
        e.attackAnimTimer = Math.max(0, e.attackAnimTimer - dt);
        e.rig.leftArmPivot.rotation.x = -0.35;
        e.rig.rightArmPivot.rotation.x = -0.35;
      } else {
        // Ayunan lengan normal mengikuti langkah kaki atau idle
        const armSwing = isWalking
          ? -Math.sin(e.walkPhase) * (isBoss ? 0.25 : 0.38)
          : Math.sin(e.idlePhase) * 0.06;
        e.rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftArmPivot.rotation.x,
          armSwing,
          dt * 8
        );
        e.rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightArmPivot.rotation.x,
          -armSwing,
          dt * 8
        );
      }

      if (e.shootCooldown <= 0) {
        this.performAttack(e, def, playerPos, phaseDef?.projectileSpeedMult || 1.0);
        e.shootCooldown =
          def.shootCooldownMin + Math.random() * (def.shootCooldownMax - def.shootCooldownMin);
        e.attackAnimTimer = 0.25;
        if (e.telegraphMesh) {
          e.telegraphMesh.visible = false;
          e.telegraphMesh.scale.setScalar(1);
        }
      }
    }

    // Perbarui Proyektil Energi Musuh
    for (let p = this.projectiles.length - 1; p >= 0; p--) {
      const proj = this.projectiles[p];
      proj.life -= dt;

      proj.position.addScaledVector(proj.velocity, dt);
      proj.mesh.rotation.x += proj.rotationSpeed.x * dt;
      proj.mesh.rotation.y += proj.rotationSpeed.y * dt;

      _scratchPlayerCenter.copy(playerPos);
      _scratchPlayerCenter.y = 1.1;
      const distToPlayer = proj.position.distanceTo(_scratchPlayerCenter);
      const hitRadius = proj.radius + 0.72;

      if (distToPlayer <= hitRadius) {
        onPlayerHurt(proj.damage);
        sound.playPlayerHurt();
        sound.playProjectileImpact();
        this.shatterProjectile(proj.position, proj.radius, proj.colorHex, proj.isBossOrb);
        this.scene.remove(proj.mesh);
        (proj.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(p, 1);
        continue;
      }

      if (
        proj.position.y <= 0.15 ||
        Math.abs(proj.position.x) >= 34 ||
        Math.abs(proj.position.z) >= 34 ||
        proj.life <= 0
      ) {
        this.shatterProjectile(proj.position, proj.radius, proj.colorHex, proj.isBossOrb);
        this.scene.remove(proj.mesh);
        (proj.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(p, 1);
      }
    }

    // Perbarui serpihan proyektil
    for (let f = this.fragments.length - 1; f >= 0; f--) {
      const frag = this.fragments[f];
      frag.life -= dt;
      frag.vel.y -= 9.8 * dt;
      frag.mesh.position.addScaledVector(frag.vel, dt);
      frag.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 2.4));

      if (frag.life <= 0 || frag.mesh.position.y <= 0) {
        this.scene.remove(frag.mesh);
        (frag.mesh.material as THREE.Material).dispose();
        this.fragments.splice(f, 1);
      }
    }
  }

  private performAttack(
    enemy: EnemyInstance,
    def: EnemyDef,
    playerPos: THREE.Vector3,
    speedMult: number = 1.0
  ) {
    sound.playEnemyAttack();
    const cDef = getColorDef(enemy.colorId);
    const speed = def.projectileSpeed * speedMult;

    const toPlayerXZ = new THREE.Vector3(
      playerPos.x - enemy.position.x,
      0,
      playerPos.z - enemy.position.z
    );
    if (toPlayerXZ.lengthSq() < 0.0001) toPlayerXZ.set(0, 0, 1);
    else toPlayerXZ.normalize();
    const rightXZ = new THREE.Vector3(-toPlayerXZ.z, 0, toPlayerXZ.x);

    if (enemy.type === 'chromabot_normal') {
      const origin = enemy.position
        .clone()
        .addScaledVector(toPlayerXZ, 0.45)
        .add(new THREE.Vector3(0, 1.25, 0));
      const target = playerPos.clone().setY(1.25);
      const dir = new THREE.Vector3().subVectors(target, origin).normalize();
      this.spawnProjectile(origin, dir, speed, def.damage, def.projectileSize, cDef.hex, false);
    } else if (enemy.type === 'chromabot_elite') {
      for (let s = -1; s <= 1; s += 2) {
        const origin = enemy.position
          .clone()
          .addScaledVector(toPlayerXZ, 0.45)
          .addScaledVector(rightXZ, s * 0.55)
          .add(new THREE.Vector3(0, 1.5, 0));
        const target = playerPos
          .clone()
          .setY(1.25)
          .addScaledVector(rightXZ, s * 1.1);
        const dir = new THREE.Vector3().subVectors(target, origin).normalize();
        this.spawnProjectile(origin, dir, speed, def.damage, def.projectileSize, cDef.hex, false);
      }
    } else if (enemy.type === 'chroma_titan') {
      const bossPhase = getBossPhaseForHp(enemy.hp, enemy.maxHp).phase;
      const origin = enemy.position
        .clone()
        .addScaledVector(toPlayerXZ, 1.6)
        .add(new THREE.Vector3(0, 3.65, 0));
      const target = playerPos.clone().setY(1.25);
      const centerDir = new THREE.Vector3().subVectors(target, origin).normalize();

      this.spawnProjectile(origin, centerDir, speed, def.damage, def.projectileSize, cDef.hex, true);

      const spreadAngles = bossPhase === 3 ? [-0.26, 0.26] : [-0.22];
      spreadAngles.forEach((ang) => {
        const sideDir = centerDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
        this.spawnProjectile(
          origin.clone(),
          sideDir,
          speed * 0.9,
          Math.round(def.damage * 0.65),
          0.4,
          cDef.hex,
          false
        );
      });
    }
  }

  private spawnProjectile(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    radius: number,
    colorHex: string,
    isBossOrb: boolean
  ) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
    });

    const mesh = new THREE.Mesh(this.sharedProjGeo, mat);
    mesh.scale.setScalar(radius);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    const velocity = direction.clone().multiplyScalar(speed);
    const rotationSpeed = new THREE.Vector3(3.0, 5.0, 2.0);

    this.projectiles.push({
      mesh,
      position: mesh.position,
      velocity,
      rotationSpeed,
      damage,
      radius,
      life: 5.2,
      colorHex,
      isBossOrb,
    });
  }

  private shatterProjectile(
    pos: THREE.Vector3,
    _baseRadius: number,
    colorHex: string,
    isBoss: boolean
  ) {
    const count = isBoss ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const fragMesh = new THREE.Mesh(this.sharedFragGeo, mat);
      fragMesh.position.copy(pos);
      this.scene.add(fragMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 7,
        Math.random() * 4 + 1.5,
        (Math.random() - 0.5) * 7
      );

      this.fragments.push({
        mesh: fragMesh,
        vel,
        life: 0.35,
      });
    }
  }

  private spawnDeathDebris(
    pos: THREE.Vector3,
    colorHex: string,
    count: number,
    speedMult: number = 1.0,
    scale: number = 1.0
  ) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? '#ffffff' : colorHex,
      });
      const fragMesh = new THREE.Mesh(this.sharedFragGeo, mat);
      fragMesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6,
        pos.y + (Math.random() - 0.5) * 0.6,
        pos.z + (Math.random() - 0.5) * 0.6
      );
      fragMesh.scale.setScalar(scale * (0.75 + Math.random() * 0.65));
      this.scene.add(fragMesh);

      const angle = Math.random() * Math.PI * 2;
      const horiz = (2.5 + Math.random() * 6.5) * speedMult;
      const vel = new THREE.Vector3(
        Math.cos(angle) * horiz,
        (2.5 + Math.random() * 5.5) * speedMult,
        Math.sin(angle) * horiz
      );

      this.fragments.push({
        mesh: fragMesh,
        vel,
        life: 0.45 + Math.random() * 0.25,
      });
    }
  }

  private spawnBossDeathDebris(pos: THREE.Vector3) {
    const count = 22;
    for (let i = 0; i < count; i++) {
      const col = ALL_RYB_COLORS[i % ALL_RYB_COLORS.length].hex;
      const mat = new THREE.MeshBasicMaterial({ color: col });
      const fragMesh = new THREE.Mesh(this.sharedFragGeo, mat);
      fragMesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.6,
        pos.y + (Math.random() - 0.5) * 1.6,
        pos.z + (Math.random() - 0.5) * 1.6
      );
      fragMesh.scale.setScalar(1.3 + Math.random() * 1.4);
      this.scene.add(fragMesh);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const horiz = 6 + Math.random() * 10;
      const vel = new THREE.Vector3(
        Math.cos(angle) * horiz,
        4 + Math.random() * 9,
        Math.sin(angle) * horiz
      );

      this.fragments.push({
        mesh: fragMesh,
        vel,
        life: 0.65 + Math.random() * 0.35,
      });
    }
  }

  public checkProjectileInterception(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3): boolean {
    const ray = new THREE.Ray(rayOrigin, rayDir);
    for (let s = this.projectiles.length - 1; s >= 0; s--) {
      const proj = this.projectiles[s];
      const sphere = new THREE.Sphere(proj.position, proj.radius * 1.4);
      if (ray.intersectsSphere(sphere)) {
        sound.playProjectileImpact();
        sound.playHitmarker(false);
        this.shatterProjectile(proj.position, proj.radius, proj.colorHex, proj.isBossOrb);
        this.scene.remove(proj.mesh);
        (proj.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(s, 1);
        return true;
      }
    }
    return false;
  }

  public damageEnemy(
    enemy: EnemyInstance,
    damage: number,
    shotDir: THREE.Vector3
  ): { killed: boolean; firstKillAward: boolean } {
    if (enemy.state === 'dead') {
      return { killed: false, firstKillAward: false };
    }

    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitReactionTimer = 0.22;

    if (enemy.type !== 'chroma_titan') {
      enemy.position.addScaledVector(shotDir, 0.32);
    }

    if (enemy.hp <= 0) {
      const firstKillAward = !enemy.scoreAwarded;
      enemy.scoreAwarded = true;
      this.killEnemy(enemy);
      return { killed: true, firstKillAward };
    }

    return { killed: false, firstKillAward: false };
  }

  public triggerWrongColorFeedback(enemy: EnemyInstance) {
    enemy.wrongHitFlash = 0.2;
  }

  public killEnemy(enemy: EnemyInstance) {
    if (enemy.state === 'dead') return;
    enemy.state = 'dead';
    sound.playEnemyDeath();
  }

  public stunAllInRadius(center: THREE.Vector3, radius: number, duration: number) {
    this.enemies.forEach((e) => {
      if (e.position.distanceTo(center) <= radius && e.state === 'active') {
        e.isStunned = duration;
      }
    });

    for (let s = this.projectiles.length - 1; s >= 0; s--) {
      const proj = this.projectiles[s];
      if (proj.position.distanceTo(center) <= radius) {
        this.shatterProjectile(proj.position, proj.radius, proj.colorHex, proj.isBossOrb);
        this.scene.remove(proj.mesh);
        (proj.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(s, 1);
      }
    }
  }

  public clearAll() {
    this.enemies.forEach((e) => {
      this.scene.remove(e.mesh);
      disposeHierarchy(e.mesh);
    });
    this.projectiles.forEach((p) => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.fragments.forEach((f) => {
      this.scene.remove(f.mesh);
      (f.mesh.material as THREE.Material).dispose();
    });
    this.enemies = [];
    this.projectiles = [];
    this.fragments = [];
  }
}

import * as THREE from 'three';
import { BossPhase, EnemyDef, EnemyType, GameColorId } from '../types';
import { ENEMY_ARCHETYPES, getColorDef, getBossPhaseForHp } from '../rules';
import { ALL_RYB_COLORS } from '../colors';
import { sound } from '../audio';

const _scratchToPlayer = new THREE.Vector3();
const _scratchDir = new THREE.Vector3();
const _scratchSideDir = new THREE.Vector3();
const _scratchPlayerCenter = new THREE.Vector3();
const _scratchToPlayerXZ = new THREE.Vector3();
const _scratchRightXZ = new THREE.Vector3();
const _scratchAttackOrigin = new THREE.Vector3();
const _scratchAttackTarget = new THREE.Vector3();
const _scratchAttackDir = new THREE.Vector3();
const _scratchInterceptRay = new THREE.Ray();
const _scratchInterceptSphere = new THREE.Sphere();
const _Y_AXIS = new THREE.Vector3(0, 1, 0);

export function disposeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry && !mesh.userData?.sharedGeo) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            if (!m.userData?.sharedMaterial) m.dispose();
          });
        } else if (!mesh.material.userData?.sharedMaterial) {
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
  unitSphereGeo: THREE.BufferGeometry;
  // Shared static materials across all enemies (never mutated per enemy)
  botDarkJointMat: THREE.MeshStandardMaterial;
  botVisorGlassMat: THREE.MeshStandardMaterial;
  botEyeLightMat: THREE.MeshBasicMaterial;
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

  const botDarkJointMat = new THREE.MeshStandardMaterial({
    color: '#172030',
    roughness: 0.42,
    metalness: 0.68,
  });
  botDarkJointMat.userData.sharedMaterial = true;

  const botVisorGlassMat = new THREE.MeshStandardMaterial({
    color: '#070b14',
    roughness: 0.12,
    metalness: 0.92,
  });
  botVisorGlassMat.userData.sharedMaterial = true;

  const botEyeLightMat = new THREE.MeshBasicMaterial({
    color: '#f8fafc',
  });
  botEyeLightMat.userData.sharedMaterial = true;

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
    unitSphereGeo: new THREE.SphereGeometry(1, 8, 8),
    botDarkJointMat,
    botVisorGlassMat,
    botEyeLightMat,
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
  leftForearmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftShinPivot: THREE.Group;
  rightShinPivot: THREE.Group;
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
  public difficultyDamageMult: number = 1.0;
  public difficultyCooldownMult: number = 1.0;
  public difficultyProjectileSpeedMult: number = 1.0;

  private sharedProjGeo = new THREE.SphereGeometry(1, 14, 14);
  private sharedFragGeo = new THREE.OctahedronGeometry(0.18, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public setDifficultyModifiers(
    damageMult: number = 1.0,
    shootCooldownMult: number = 1.0,
    projectileSpeedMult: number = 1.0
  ) {
    this.difficultyDamageMult = damageMult;
    this.difficultyCooldownMult = shootCooldownMult;
    this.difficultyProjectileSpeedMult = projectileSpeedMult;
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
      (def.shootCooldownMin + Math.random() * (def.shootCooldownMax - def.shootCooldownMin)) *
      this.difficultyCooldownMult;

    const enemy: EnemyInstance = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      colorId,
      mesh: group,
      rig: built.rig,
      hp: Math.round(def.maxHp * hpMult),
      maxHp: Math.round(def.maxHp * hpMult),
      speed: def.speed * speedMult,
      damage: Math.max(1, Math.round(def.damage * this.difficultyDamageMult)),
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

    const darkJointMat = geos.botDarkJointMat;
    const visorGlassMat = geos.botVisorGlassMat;
    const eyeLightMat = geos.botEyeLightMat;

    const bodyGroup = new THREE.Group();
    bodyGroup.scale.setScalar(scale);
    group.add(bodyGroup);

    // === 1. DUA KAKI MEKANIS 2-SENDI (PINGGUL + LUTUT BERARTIKULASI) ===
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.23, 0.72, 0);
    bodyGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.23, 0.72, 0);
    bodyGroup.add(rightLegPivot);

    const leftShinPivot = new THREE.Group();
    const rightShinPivot = new THREE.Group();

    [
      { legPivot: leftLegPivot, shinPivot: leftShinPivot },
      { legPivot: rightLegPivot, shinPivot: rightShinPivot },
    ].forEach(({ legPivot, shinPivot }) => {
      legPivot.add(makeSharedMesh(geos.botHipJoint, darkJointMat));

      const thigh = makeSharedMesh(geos.botThigh, darkJointMat);
      thigh.position.set(0, -0.17, 0);
      legPivot.add(thigh);

      const kneeBall = makeSharedMesh(geos.botKneeBall, darkJointMat);
      kneeBall.position.set(0, -0.33, 0.01);
      legPivot.add(kneeBall);

      shinPivot.position.set(0, -0.33, 0.01);
      legPivot.add(shinPivot);

      const kneePlate = makeSharedMesh(geos.botKneePlate, primaryColorMat);
      kneePlate.position.set(0, 0.01, 0.08);
      kneePlate.rotation.x = -0.18;
      shinPivot.add(kneePlate);

      const shin = makeSharedMesh(geos.botShin, primaryColorMat);
      shin.position.set(0, -0.16, 0.01);
      shinPivot.add(shin);

      const footUpper = makeSharedMesh(geos.botFootUpper, primaryColorMat);
      footUpper.position.set(0, -0.31, 0.045);
      shinPivot.add(footUpper);

      const sole = makeSharedMesh(geos.botFootSole, darkJointMat);
      sole.position.set(0, -0.37, 0.045);
      shinPivot.add(sole);
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

    // === 4. DUA LENGAN MEKANIS 2-SENDI (BAHU + SIKU) + TANGAN JARI STYLIZED ===
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.52, 1.32, 0);
    bodyGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.52, 1.32, 0);
    bodyGroup.add(rightArmPivot);

    const leftForearmPivot = new THREE.Group();
    const rightForearmPivot = new THREE.Group();

    [
      { armPivot: leftArmPivot, forearmPivot: leftForearmPivot, side: -1 },
      { armPivot: rightArmPivot, forearmPivot: rightForearmPivot, side: 1 },
    ].forEach(({ armPivot, forearmPivot, side }) => {
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

      forearmPivot.position.set(side * 0.08, -0.31, 0.01);
      armPivot.add(forearmPivot);

      const forearm = makeSharedMesh(geos.botForearm, primaryColorMat);
      forearm.position.set(side * 0.005, -0.14, 0.06);
      forearm.rotation.x = 0.28;
      forearmPivot.add(forearm);

      const wristCuff = makeSharedMesh(geos.botWristCuff, darkJointMat);
      wristCuff.position.set(side * 0.005, -0.27, 0.11);
      wristCuff.rotation.x = 0.28;
      forearmPivot.add(wristCuff);

      const palm = makeSharedMesh(geos.botPalm, darkJointMat);
      palm.position.set(side * 0.005, -0.34, 0.13);
      forearmPivot.add(palm);

      const handGuard = makeSharedMesh(geos.botHandGuard, primaryColorMat);
      handGuard.position.set(side * 0.035, -0.33, 0.14);
      forearmPivot.add(handGuard);

      const fingers = makeSharedMesh(geos.botFingers, darkJointMat);
      fingers.position.set(-side * 0.015, -0.4, 0.15);
      fingers.rotation.z = side * 0.18;
      forearmPivot.add(fingers);
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

    const telegraph = makeSharedMesh(geos.unitSphereGeo, coreGlowMat);
    telegraph.name = 'attack_telegraph';
    telegraph.position.set(0, 1.18, 0.85);
    telegraph.scale.setScalar(def.projectileSize);
    telegraph.visible = false;
    bodyGroup.add(telegraph);

    return {
      group,
      rig: {
        bodyGroup,
        headPivot,
        leftArmPivot,
        rightArmPivot,
        leftForearmPivot,
        rightForearmPivot,
        leftLegPivot,
        rightLegPivot,
        leftShinPivot,
        rightShinPivot,
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

    // 1. Kaki Colossus 2-Sendi (Pinggul + Lutut Segi Enam & Sepatu Berat)
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-1.05, 2.1, 0);
    bodyGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(1.05, 2.1, 0);
    bodyGroup.add(rightLegPivot);

    const leftShinPivot = new THREE.Group();
    const rightShinPivot = new THREE.Group();

    [
      { legPivot: leftLegPivot, shinPivot: leftShinPivot },
      { legPivot: rightLegPivot, shinPivot: rightShinPivot },
    ].forEach(({ legPivot, shinPivot }) => {
      const upperLeg = makeSharedMesh(geos.titanThigh, titanSubArmorMat);
      upperLeg.position.set(0, -0.46, 0);
      legPivot.add(upperLeg);

      shinPivot.position.set(0, -0.94, 0);
      legPivot.add(shinPivot);

      const kneeTrim = makeSharedMesh(geos.titanKneeTrim, coreAccentArmorMat);
      kneeTrim.rotation.x = Math.PI / 2;
      kneeTrim.position.set(0, 0, 0.39);
      shinPivot.add(kneeTrim);

      const kneeHex = makeSharedMesh(geos.titanKneeHex, titanArmorMat);
      kneeHex.rotation.x = Math.PI / 2;
      kneeHex.position.set(0, 0, 0.45);
      shinPivot.add(kneeHex);

      const lowerLeg = makeSharedMesh(geos.titanShin, titanArmorMat);
      lowerLeg.position.set(0, -0.51, 0);
      shinPivot.add(lowerLeg);

      const heavyBoot = makeSharedMesh(geos.titanBoot, titanArmorMat);
      heavyBoot.position.set(0, -0.98, 0.18);
      shinPivot.add(heavyBoot);

      const bootToe = makeSharedMesh(geos.titanBootToe, coreAccentArmorMat);
      bootToe.position.set(0, -1.01, 0.65);
      shinPivot.add(bootToe);
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

    // 4. Dua Lengan Meriam Forearm Cannon 2-Sendi + Pauldron Oktagonal Berlis
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-2.38, 4.25, 0);
    bodyGroup.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(2.38, 4.25, 0);
    bodyGroup.add(rightArmPivot);

    const leftForearmPivot = new THREE.Group();
    const rightForearmPivot = new THREE.Group();

    [
      { armPivot: leftArmPivot, forearmPivot: leftForearmPivot, side: -1 },
      { armPivot: rightArmPivot, forearmPivot: rightForearmPivot, side: 1 },
    ].forEach(({ armPivot, forearmPivot, side }) => {
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

      forearmPivot.position.set(side * 0.2, -1.42, 0.05);
      armPivot.add(forearmPivot);

      const forearmCannon = makeSharedMesh(geos.titanCannonBarrel, titanArmorMat);
      forearmCannon.position.set(0, -0.43, 0.43);
      forearmCannon.rotation.x = Math.PI / 3;
      forearmPivot.add(forearmCannon);

      const cannonSleeve = makeSharedMesh(geos.titanCannonSleeve, titanSubArmorMat);
      cannonSleeve.position.set(0, -0.22, 0.07);
      cannonSleeve.rotation.x = Math.PI / 3;
      forearmPivot.add(cannonSleeve);

      const cannonFin = makeSharedMesh(geos.titanCannonFin, coreAccentArmorMat);
      cannonFin.position.set(0, -0.06, 0.51);
      cannonFin.rotation.x = -Math.PI / 6;
      forearmPivot.add(cannonFin);

      const muzzleRing = makeSharedMesh(geos.titanMuzzleRing, corePureMat);
      muzzleRing.position.set(0, -0.85, 1.16);
      muzzleRing.rotation.x = Math.PI / 3;
      forearmPivot.add(muzzleRing);

      const muzzleGlow = makeSharedMesh(geos.titanMuzzleGlow, corePureMat);
      muzzleGlow.position.set(0, -0.86, 1.17);
      muzzleGlow.rotation.x = Math.PI / 3;
      forearmPivot.add(muzzleGlow);
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
        leftForearmPivot,
        rightForearmPivot,
        leftLegPivot,
        rightLegPivot,
        leftShinPivot,
        rightShinPivot,
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
      let desiredForwardSpeed = 0;
      let desiredLateralSpeed = 0;

      // Saat sedang membidik/mengisi bola serangan (0.85s terakhir), Chromabot menapakkan kaki (Planted Stance)
      const isChargingShot = e.shootCooldown <= 0.85 && e.shootCooldown > 0;
      const stanceDamp = isChargingShot ? (isBoss ? 0.35 : 0.12) : 1.0;

      if (isBoss) {
        // Pergerakan Dinamis CHROMA TITAN: langkah berat berinersia & tekanan bertahap
        const bossPhaseInfo = getBossPhaseForHp(e.hp, e.maxHp);
        const phaseSpeedBoost =
          bossPhaseInfo.phase === 3 ? 1.38 : bossPhaseInfo.phase === 2 ? 1.18 : 1.0;
        const bossSpeed = e.speed * phaseSpeedBoost;

        const weaveWave = Math.sin(e.idlePhase * 0.65);
        desiredLateralSpeed = weaveWave * bossSpeed * 0.78 * stanceDamp;

        if (dist > e.preferredDist + 2.0) {
          desiredForwardSpeed = bossSpeed * 0.88 * stanceDamp;
        } else if (dist < e.preferredDist - 3.0) {
          desiredForwardSpeed = -bossSpeed * 0.68 * stanceDamp;
        } else {
          desiredForwardSpeed = Math.cos(e.idlePhase * 0.5) * bossSpeed * 0.35 * stanceDamp;
        }
      } else {
        // Siklus Taktis Chromabot: Advance -> Planted Aim -> Reposition tanpa zig-zag liar yang bikin meluncur
        const strafeCycle = Math.sin(e.idlePhase * 0.58 + i * 1.7);
        const tacticalStrafe =
          Math.abs(strafeCycle) > 0.28 ? Math.sign(strafeCycle) * (Math.abs(strafeCycle) - 0.15) : 0;

        if (dist < minThreshold) {
          desiredForwardSpeed = -e.speed * 0.88 * stanceDamp;
          desiredLateralSpeed = tacticalStrafe * e.speed * 0.35 * stanceDamp;
        } else if (dist > maxThreshold) {
          desiredForwardSpeed = e.speed * 1.0 * stanceDamp;
          desiredLateralSpeed = tacticalStrafe * e.speed * 0.28 * stanceDamp;
        } else {
          desiredForwardSpeed = Math.cos(e.idlePhase * 0.45 + i) * e.speed * 0.18 * stanceDamp;
          desiredLateralSpeed = tacticalStrafe * e.speed * 0.68 * stanceDamp;
        }
      }

      _scratchSideDir.set(-dir.z, 0, dir.x);
      const sideDir = _scratchSideDir;

      const targetVelX = dir.x * desiredForwardSpeed + sideDir.x * desiredLateralSpeed;
      const targetVelZ = dir.z * desiredForwardSpeed + sideDir.z * desiredLateralSpeed;

      // Akselerasi & pengereman halus berinersia untuk menghilangkan efek patah-patah / meluncur di es
      const inertiaRate = Math.min(1, dt * (isBoss ? 5.2 : 6.8));
      e.velocity.x = THREE.MathUtils.lerp(e.velocity.x, targetVelX, inertiaRate);
      e.velocity.z = THREE.MathUtils.lerp(e.velocity.z, targetVelZ, inertiaRate);

      e.position.x += e.velocity.x * dt;
      e.position.z += e.velocity.z * dt;

      const moveVelocity = Math.hypot(e.velocity.x, e.velocity.z);
      const actualForwardSpeed = e.velocity.x * dir.x + e.velocity.z * dir.z;
      const actualLateralSpeed = e.velocity.x * sideDir.x + e.velocity.z * sideDir.z;
      const refSpeed = Math.max(0.8, e.speed);
      const forwardAmount = THREE.MathUtils.clamp(actualForwardSpeed / refSpeed, -1.2, 1.2);
      const lateralAmount = THREE.MathUtils.clamp(actualLateralSpeed / refSpeed, -1.2, 1.2);

      // Kolisi tiang & rintangan arena agar musuh tidak menembus tiang
      if (colliders && colliders.length > 0) {
        resolveCircleXZCollision(e.position, isBoss ? 1.85 : 0.78, colliders);
      }

      e.position.x = Math.max(-26, Math.min(26, e.position.x));
      e.position.z = Math.max(-26, Math.min(26, e.position.z));
      e.position.y = 0;

      // === 5. BIOMEKANIKA JALAN 2-SENDI (LUTUT & SIKU), COUNTER-ROTATION & KUDA-KUDA ===
      e.idlePhase += dt * 2.4;
      const isWalking = moveVelocity > 0.14;

      // Kemiringan tubuh proporsional terhadap percepatan & arah langkah
      const targetLeanX = forwardAmount * (isBoss ? 0.08 : 0.12) + (isChargingShot ? 0.06 : 0);
      const targetBankZ = -lateralAmount * (isBoss ? 0.07 : 0.11);
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
        // Frekuensi langkah terkunci langsung dengan kecepatan aktual di lantai (bebas foot-sliding)
        const strideScale = isBoss ? 1.25 : 3.9;
        const walkDirSign = actualForwardSpeed < -0.25 ? -1 : 1;
        e.walkPhase += dt * moveVelocity * strideScale * walkDirSign;

        const phaseL = e.walkPhase;
        const phaseR = e.walkPhase + Math.PI;

        const hipAmp = isBoss ? 0.42 : 0.54;
        const kneeAmp = isBoss ? 0.54 : 0.76;

        // Paha mengayun ke depan (rotasi X negatif = maju ke +Z lokal)
        const hipL = -Math.sin(phaseL) * hipAmp;
        const hipR = -Math.sin(phaseR) * hipAmp;

        // Lutut menekuk ke belakang secara natural saat kaki diayun terangkat, lalu lurus saat menapak
        const liftL = Math.max(0, Math.sin(phaseL - 0.65));
        const liftR = Math.max(0, Math.sin(phaseR - 0.65));
        const kneeL = liftL * kneeAmp + 0.06;
        const kneeR = liftR * kneeAmp + 0.06;

        e.rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftLegPivot.rotation.x,
          hipL,
          dt * 16
        );
        e.rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightLegPivot.rotation.x,
          hipR,
          dt * 16
        );
        e.rig.leftShinPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftShinPivot.rotation.x,
          kneeL,
          dt * 18
        );
        e.rig.rightShinPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightShinPivot.rotation.x,
          kneeR,
          dt * 18
        );

        // Buka sedikit arah paha saat strafing menyamping agar langkah samping terlihat natural
        const strafeYaw = THREE.MathUtils.clamp(-lateralAmount * 0.24, -0.28, 0.28);
        e.rig.leftLegPivot.rotation.y = THREE.MathUtils.lerp(
          e.rig.leftLegPivot.rotation.y,
          strafeYaw,
          dt * 10
        );
        e.rig.rightLegPivot.rotation.y = THREE.MathUtils.lerp(
          e.rig.rightLegPivot.rotation.y,
          strafeYaw,
          dt * 10
        );
        e.rig.leftLegPivot.rotation.z = THREE.MathUtils.lerp(
          e.rig.leftLegPivot.rotation.z,
          -0.04 - lateralAmount * 0.06,
          dt * 10
        );
        e.rig.rightLegPivot.rotation.z = THREE.MathUtils.lerp(
          e.rig.rightLegPivot.rotation.z,
          0.04 - lateralAmount * 0.06,
          dt * 10
        );

        // Bobbing vertikal, perpindahan titik berat kiri-kanan (weight shift), & counter-rotation torso
        if (isBoss) {
          // Gaya jalan Heavy Mech Stomp khusus CHROMA TITAN (kompresi suspensi saat kaki mendarat)
          const stompWave = Math.pow(Math.abs(Math.sin(e.walkPhase)), 1.5);
          const stompDip = (stompWave - 0.35) * 0.18;
          e.rig.bodyGroup.position.y = THREE.MathUtils.lerp(
            e.rig.bodyGroup.position.y,
            stompDip,
            dt * 14
          );
          e.rig.bodyGroup.position.x = THREE.MathUtils.lerp(
            e.rig.bodyGroup.position.x,
            -Math.cos(e.walkPhase) * 0.08,
            dt * 10
          );
          e.rig.bodyGroup.rotation.y = THREE.MathUtils.lerp(
            e.rig.bodyGroup.rotation.y,
            Math.sin(e.walkPhase) * 0.07,
            dt * 10
          );
        } else {
          const stepBob = (Math.abs(Math.sin(e.walkPhase)) - 0.3) * 0.095 * baseScale;
          e.rig.bodyGroup.position.y = THREE.MathUtils.lerp(
            e.rig.bodyGroup.position.y,
            stepBob,
            dt * 16
          );
          e.rig.bodyGroup.position.x = THREE.MathUtils.lerp(
            e.rig.bodyGroup.position.x,
            -Math.cos(e.walkPhase) * 0.038 * baseScale,
            dt * 12
          );
          e.rig.bodyGroup.rotation.y = THREE.MathUtils.lerp(
            e.rig.bodyGroup.rotation.y,
            Math.sin(e.walkPhase) * 0.11,
            dt * 12
          );
        }

        e.rig.headPivot.rotation.z = Math.sin(e.walkPhase) * 0.045;
      } else {
        // Posisi Berdiri / Kuda-Kuda Tembak (Planted Combat Stance) dengan tekukan lutut siap tempur
        const readyKnee = isChargingShot ? (isBoss ? 0.22 : 0.28) : 0.1;
        const readyHip = -readyKnee * 0.5;
        const stanceSpread = isChargingShot ? 0.075 : 0.04;

        e.rig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftLegPivot.rotation.x,
          readyHip,
          dt * 10
        );
        e.rig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightLegPivot.rotation.x,
          readyHip * 0.7,
          dt * 10
        );
        e.rig.leftShinPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftShinPivot.rotation.x,
          readyKnee,
          dt * 10
        );
        e.rig.rightShinPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightShinPivot.rotation.x,
          readyKnee,
          dt * 10
        );
        e.rig.leftLegPivot.rotation.y = THREE.MathUtils.lerp(e.rig.leftLegPivot.rotation.y, 0, dt * 10);
        e.rig.rightLegPivot.rotation.y = THREE.MathUtils.lerp(e.rig.rightLegPivot.rotation.y, 0, dt * 10);
        e.rig.leftLegPivot.rotation.z = THREE.MathUtils.lerp(
          e.rig.leftLegPivot.rotation.z,
          -stanceSpread,
          dt * 10
        );
        e.rig.rightLegPivot.rotation.z = THREE.MathUtils.lerp(
          e.rig.rightLegPivot.rotation.z,
          stanceSpread,
          dt * 10
        );

        const breatheY =
          (Math.sin(e.idlePhase) * 0.032 - (isChargingShot ? 0.045 : 0)) * baseScale;
        e.rig.bodyGroup.position.y = THREE.MathUtils.lerp(
          e.rig.bodyGroup.position.y,
          breatheY,
          dt * 10
        );
        e.rig.bodyGroup.position.x = THREE.MathUtils.lerp(e.rig.bodyGroup.position.x, 0, dt * 10);
        e.rig.bodyGroup.rotation.y = THREE.MathUtils.lerp(e.rig.bodyGroup.rotation.y, 0, dt * 10);
        e.rig.headPivot.rotation.z = Math.sin(e.idlePhase * 0.7) * 0.03;
      }

      // === 6. ANIMASI LENGAN & SIKU (AYUNAN NATURAL + BIDIKAN TEMBAK) ===
      const phaseDef = isBoss ? getBossPhaseForHp(e.hp, e.maxHp) : undefined;
      const cdRate =
        (phaseDef ? 1 / phaseDef.shootCooldownMult : 1.0) / Math.max(0.5, this.difficultyCooldownMult);

      // Selama masa jeda adaptasi target baru (targetGraceTimer > 0), perlambat pengisian serangan musuh
      const graceFactor = this.targetGraceTimer > 0 ? 0.25 : 1.0;
      e.shootCooldown -= dt * cdRate * graceFactor;

      if (isChargingShot) {
        // Mengangkat lengan & menekuk siku secara presisi untuk mengarahkan tembakan ke pemain
        const chargeRatio = 1 - e.shootCooldown / 0.85;
        const shoulderAim = -0.82 * chargeRatio;
        const elbowAim = -0.45 * chargeRatio;
        e.rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftArmPivot.rotation.x,
          shoulderAim,
          dt * 12
        );
        e.rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightArmPivot.rotation.x,
          shoulderAim,
          dt * 12
        );
        e.rig.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftForearmPivot.rotation.x,
          elbowAim,
          dt * 14
        );
        e.rig.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightForearmPivot.rotation.x,
          elbowAim,
          dt * 14
        );

        if (e.telegraphMesh) {
          e.telegraphMesh.visible = true;
          const pulse = 0.5 + chargeRatio * 0.7;
          e.telegraphMesh.scale.setScalar(pulse);
        }
      } else if (e.attackAnimTimer > 0) {
        // Recoil lengan & siku sesaat setelah menembak
        e.attackAnimTimer = Math.max(0, e.attackAnimTimer - dt);
        e.rig.leftArmPivot.rotation.x = -0.28;
        e.rig.rightArmPivot.rotation.x = -0.28;
        e.rig.leftForearmPivot.rotation.x = -0.62;
        e.rig.rightForearmPivot.rotation.x = -0.62;
      } else {
        // Ayunan lengan & tekukan siku dinamis berlawanan fase dengan kaki
        const armAmp = isBoss ? 0.24 : 0.38;
        const armSwingL = isWalking
          ? Math.sin(e.walkPhase) * armAmp
          : Math.sin(e.idlePhase) * 0.05;
        const armSwingR = isWalking
          ? -Math.sin(e.walkPhase) * armAmp
          : -Math.sin(e.idlePhase) * 0.05;

        // Siku menekuk lebih dalam saat lengan mengayun ke depan
        const elbowFlexL = isWalking
          ? -0.22 - Math.max(0, -armSwingL) * 0.65
          : -0.18;
        const elbowFlexR = isWalking
          ? -0.22 - Math.max(0, -armSwingR) * 0.65
          : -0.18;

        e.rig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftArmPivot.rotation.x,
          armSwingL,
          dt * 10
        );
        e.rig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightArmPivot.rotation.x,
          armSwingR,
          dt * 10
        );
        e.rig.leftForearmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.leftForearmPivot.rotation.x,
          elbowFlexL,
          dt * 12
        );
        e.rig.rightForearmPivot.rotation.x = THREE.MathUtils.lerp(
          e.rig.rightForearmPivot.rotation.x,
          elbowFlexR,
          dt * 12
        );
      }

      if (e.shootCooldown <= 0) {
        this.performAttack(
          e,
          def,
          playerPos,
          (phaseDef?.projectileSpeedMult || 1.0) * this.difficultyProjectileSpeedMult
        );
        e.shootCooldown =
          (def.shootCooldownMin + Math.random() * (def.shootCooldownMax - def.shootCooldownMin)) *
          this.difficultyCooldownMult;
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

    _scratchToPlayerXZ.set(
      playerPos.x - enemy.position.x,
      0,
      playerPos.z - enemy.position.z
    );
    if (_scratchToPlayerXZ.lengthSq() < 0.0001) _scratchToPlayerXZ.set(0, 0, 1);
    else _scratchToPlayerXZ.normalize();
    _scratchRightXZ.set(-_scratchToPlayerXZ.z, 0, _scratchToPlayerXZ.x);

    if (enemy.type === 'chromabot_normal') {
      _scratchAttackOrigin
        .copy(enemy.position)
        .addScaledVector(_scratchToPlayerXZ, 0.45);
      _scratchAttackOrigin.y += 1.25;
      _scratchAttackTarget.set(playerPos.x, 1.25, playerPos.z);
      _scratchAttackDir.subVectors(_scratchAttackTarget, _scratchAttackOrigin).normalize();
      this.spawnProjectile(
        _scratchAttackOrigin,
        _scratchAttackDir,
        speed,
        def.damage,
        def.projectileSize,
        cDef.hex,
        false
      );
    } else if (enemy.type === 'chromabot_elite') {
      for (let s = -1; s <= 1; s += 2) {
        _scratchAttackOrigin
          .copy(enemy.position)
          .addScaledVector(_scratchToPlayerXZ, 0.45)
          .addScaledVector(_scratchRightXZ, s * 0.55);
        _scratchAttackOrigin.y += 1.5;
        _scratchAttackTarget
          .set(playerPos.x, 1.25, playerPos.z)
          .addScaledVector(_scratchRightXZ, s * 1.1);
        _scratchAttackDir.subVectors(_scratchAttackTarget, _scratchAttackOrigin).normalize();
        this.spawnProjectile(
          _scratchAttackOrigin,
          _scratchAttackDir,
          speed,
          def.damage,
          def.projectileSize,
          cDef.hex,
          false
        );
      }
    } else if (enemy.type === 'chroma_titan') {
      const bossPhase = getBossPhaseForHp(enemy.hp, enemy.maxHp).phase;
      _scratchAttackOrigin
        .copy(enemy.position)
        .addScaledVector(_scratchToPlayerXZ, 1.6);
      _scratchAttackOrigin.y += 3.65;
      _scratchAttackTarget.set(playerPos.x, 1.25, playerPos.z);
      _scratchAttackDir.subVectors(_scratchAttackTarget, _scratchAttackOrigin).normalize();

      this.spawnProjectile(
        _scratchAttackOrigin,
        _scratchAttackDir,
        speed,
        def.damage,
        def.projectileSize,
        cDef.hex,
        true
      );

      const spreadAngles = bossPhase === 3 ? [-0.26, 0.26] : [-0.22];
      spreadAngles.forEach((ang) => {
        _scratchSideDir.copy(_scratchAttackDir).applyAxisAngle(_Y_AXIS, ang);
        this.spawnProjectile(
          _scratchAttackOrigin,
          _scratchSideDir,
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
    if (this.fragments.length >= 36) return;
    const count = isBoss ? 4 : 2;
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
    const budget = Math.max(0, Math.min(count, 36 - this.fragments.length));
    for (let i = 0; i < budget; i++) {
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
    const count = 16;
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
    _scratchInterceptRay.set(rayOrigin, rayDir);
    for (let s = this.projectiles.length - 1; s >= 0; s--) {
      const proj = this.projectiles[s];
      _scratchInterceptSphere.set(proj.position, proj.radius * 1.4);
      if (_scratchInterceptRay.intersectsSphere(_scratchInterceptSphere)) {
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

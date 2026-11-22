import * as THREE from 'three';

export interface LaserBeam {
  mesh: THREE.Line | THREE.Mesh;
  life: number;
  maxLife: number;
  initialOpacity: number;
  expandRate?: number;
  sharedGeo?: boolean;
}

export interface FlyingPlasma {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
}

const _UP_AXIS = new THREE.Vector3(0, 1, 0);
const _X_AXIS = new THREE.Vector3(1, 0, 0);
const _scratchBeamDir = new THREE.Vector3();
const _scratchBeamMid = new THREE.Vector3();
const _scratchBeamAxis = new THREE.Vector3();
const _scratchBeamQuat = new THREE.Quaternion();

export class VisualShotSystem {
  public scene: THREE.Scene;
  private activeBeams: LaserBeam[] = [];
  public activePlasma: FlyingPlasma[] = [];
  private sharedBeamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  private sharedImpactSphereGeo = new THREE.SphereGeometry(1, 8, 8);
  private sharedImpactRingGeo = new THREE.TorusGeometry(1, 0.14, 6, 16);
  private sharedPlasmaGeo = new THREE.SphereGeometry(0.18, 8, 8);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Spawns a visible 2-layer glowing hitscan beam from muzzle to target (zero geometry allocation)
   */
  public addLaserBeam(
    from: THREE.Vector3,
    to: THREE.Vector3,
    colorHex: string,
    thickness: number = 0.04,
    duration: number = 0.09
  ) {
    _scratchBeamDir.subVectors(to, from);
    const length = _scratchBeamDir.length();
    if (length < 0.1) return;

    _scratchBeamMid.addVectors(from, to).multiplyScalar(0.5);
    _scratchBeamDir.divideScalar(length);
    _scratchBeamQuat.identity();
    _scratchBeamAxis.crossVectors(_UP_AXIS, _scratchBeamDir);

    if (_scratchBeamAxis.lengthSq() > 0.0001) {
      _scratchBeamAxis.normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, _UP_AXIS.dot(_scratchBeamDir))));
      _scratchBeamQuat.setFromAxisAngle(_scratchBeamAxis, angle);
    } else if (_UP_AXIS.dot(_scratchBeamDir) < -0.99) {
      _scratchBeamQuat.setFromAxisAngle(_X_AXIS, Math.PI);
    }

    // 1. Inti Laser Putih Terang (Core)
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(this.sharedBeamGeo, coreMat);
    coreMesh.position.copy(_scratchBeamMid);
    coreMesh.quaternion.copy(_scratchBeamQuat);
    coreMesh.scale.set(thickness * 0.45, length, thickness * 0.45);
    this.scene.add(coreMesh);

    this.activeBeams.push({
      mesh: coreMesh,
      life: duration,
      maxLife: duration,
      initialOpacity: 0.98,
      sharedGeo: true,
    });

    // 2. Halo Glow Berwarna (Outer Glow)
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(this.sharedBeamGeo, glowMat);
    glowMesh.position.copy(_scratchBeamMid);
    glowMesh.quaternion.copy(_scratchBeamQuat);
    glowMesh.scale.set(thickness * 2.1, length, thickness * 2.1);
    this.scene.add(glowMesh);

    this.activeBeams.push({
      mesh: glowMesh,
      life: duration * 1.15,
      maxLife: duration * 1.15,
      initialOpacity: 0.55,
      sharedGeo: true,
    });
  }

  /**
   * Efek visual impact 3D (Kilatan Bola Energi + Cincin Shockwave) memakai geometri bersama yang ringan
   */
  public addHitImpactEffect(
    hitPoint: THREE.Vector3,
    colorHex: string,
    isCrit: boolean = false,
    isWrong: boolean = false
  ) {
    const flashColor = isWrong ? '#f43f5e' : isCrit ? '#ffffff' : colorHex;
    const ringColor = isWrong ? '#fb7185' : isCrit ? '#22d3ee' : colorHex;

    // 1. Inti kilatan impact (Expanding Flash Sphere)
    const coreMat = new THREE.MeshBasicMaterial({
      color: flashColor,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(this.sharedImpactSphereGeo, coreMat);
    coreMesh.position.copy(hitPoint);
    coreMesh.scale.setScalar(isCrit ? 0.34 : 0.25);
    this.scene.add(coreMesh);

    this.activeBeams.push({
      mesh: coreMesh,
      life: 0.16,
      maxLife: 0.16,
      initialOpacity: 0.95,
      expandRate: isCrit ? 3.2 : 2.2,
      sharedGeo: true,
    });

    // 2. Cincin gelombang kejut (Expanding Shockwave Torus)
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(this.sharedImpactRingGeo, ringMat);
    ringMesh.position.copy(hitPoint);
    ringMesh.scale.setScalar(isCrit ? 0.42 : 0.3);
    ringMesh.rotation.set(
      (Math.random() - 0.5) * 0.8,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.8
    );
    this.scene.add(ringMesh);

    this.activeBeams.push({
      mesh: ringMesh,
      life: 0.22,
      maxLife: 0.22,
      initialOpacity: 0.9,
      expandRate: isCrit ? 4.0 : 3.0,
      sharedGeo: true,
    });
  }

  /**
   * Spawns flying physical plasma bolt for Plasma SMG
   */
  public addPlasmaProjectile(
    from: THREE.Vector3,
    dir: THREE.Vector3,
    damage: number,
    speed: number = 55,
    colorHex: string = '#22c55e'
  ) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(this.sharedPlasmaGeo, mat);
    mesh.position.copy(from);
    this.scene.add(mesh);

    this.activePlasma.push({
      mesh,
      velocity: dir.clone().multiplyScalar(speed),
      damage,
      life: 2.0,
    });
  }

  /**
   * Update active beams, impact rings, and plasma
   */
  public update(dt: number) {
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        if (!b.sharedGeo && 'geometry' in b.mesh) b.mesh.geometry.dispose();
        if ('material' in b.mesh && b.mesh.material instanceof THREE.Material) {
          b.mesh.material.dispose();
        }
        this.activeBeams.splice(i, 1);
      } else {
        const mat = (b.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = (b.life / b.maxLife) * b.initialOpacity;
        if (b.expandRate) {
          b.mesh.scale.addScalar(b.expandRate * dt);
        }
      }
    }

    for (let i = this.activePlasma.length - 1; i >= 0; i--) {
      const p = this.activePlasma[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);

      if (p.life <= 0 || p.mesh.position.y < 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.activePlasma.splice(i, 1);
      }
    }
  }

  public clearAll() {
    this.activeBeams.forEach((b) => {
      this.scene.remove(b.mesh);
      if (!b.sharedGeo) b.mesh.geometry.dispose();
      if ('material' in b.mesh && b.mesh.material instanceof THREE.Material) {
        b.mesh.material.dispose();
      }
    });
    this.activePlasma.forEach((p) => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.activeBeams = [];
    this.activePlasma = [];
  }
}

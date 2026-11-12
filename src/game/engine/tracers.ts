import * as THREE from 'three';

export interface LaserBeam {
  mesh: THREE.Line | THREE.Mesh;
  life: number;
  maxLife: number;
  initialOpacity: number;
  expandRate?: number;
}

export interface FlyingPlasma {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
}

export class VisualShotSystem {
  public scene: THREE.Scene;
  private activeBeams: LaserBeam[] = [];
  public activePlasma: FlyingPlasma[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Spawns a visible hitscan beam from muzzle to target
   */
  public addLaserBeam(
    from: THREE.Vector3,
    to: THREE.Vector3,
    colorHex: string,
    thickness: number = 0.04,
    duration: number = 0.09
  ) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const length = dir.length();
    if (length < 0.1) return;

    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);

    const geo = new THREE.CylinderGeometry(thickness, thickness, length, 6, 1, false);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(mid);

    const up = new THREE.Vector3(0, 1, 0);
    const normalizedDir = dir.clone().normalize();
    const axis = new THREE.Vector3().crossVectors(up, normalizedDir).normalize();
    const angle = Math.acos(Math.max(-1, Math.min(1, up.dot(normalizedDir))));

    if (axis.lengthSq() > 0.0001) {
      mesh.quaternion.setFromAxisAngle(axis, angle);
    } else if (up.dot(normalizedDir) < -0.99) {
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    }

    this.scene.add(mesh);

    this.activeBeams.push({
      mesh,
      life: duration,
      maxLife: duration,
      initialOpacity: 0.95,
    });
  }

  /**
   * Efek visual impact 3D (Kilatan Bola Energi + Cincin Shockwave) saat peluru mengenai musuh
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
    const coreGeo = new THREE.SphereGeometry(isCrit ? 0.34 : 0.25, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(flashColor),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(hitPoint);
    this.scene.add(coreMesh);

    this.activeBeams.push({
      mesh: coreMesh,
      life: 0.16,
      maxLife: 0.16,
      initialOpacity: 0.95,
      expandRate: isCrit ? 9.5 : 7.0,
    });

    // 2. Cincin gelombang kejut (Expanding Shockwave Torus)
    const ringGeo = new THREE.TorusGeometry(isCrit ? 0.42 : 0.3, 0.045, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ringColor),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(hitPoint);
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
      expandRate: isCrit ? 12.0 : 9.0,
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
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
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
        if ('geometry' in b.mesh) b.mesh.geometry.dispose();
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
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.activePlasma.splice(i, 1);
      }
    }
  }

  public clearAll() {
    this.activeBeams.forEach((b) => {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
    });
    this.activePlasma.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    });
    this.activeBeams = [];
    this.activePlasma = [];
  }
}

import * as THREE from 'three';
import { ALL_RYB_COLORS } from '../colors';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private poolSize = 400;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  public pointsMesh: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.poolSize * 3);
    this.colors = new Float32Array(this.poolSize * 3);

    for (let i = 0; i < this.poolSize; i++) {
      this.particles.push({
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        size: 0.1,
        life: 0,
        maxLife: 1,
      });
      this.positions[i * 3 + 1] = -999;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    scene.add(this.pointsMesh);
  }

  public emit(pos: THREE.Vector3, count: number, baseColor: string, speedMult: number = 1.0) {
    const color = new THREE.Color(baseColor);
    let emitted = 0;

    for (let i = 0; i < this.poolSize && emitted < count; i++) {
      const p = this.particles[i];
      if (p.life <= 0) {
        p.position.copy(pos);
        p.velocity.set(
          (Math.random() - 0.5) * 8 * speedMult,
          (Math.random() * 5 + 1.5) * speedMult,
          (Math.random() - 0.5) * 8 * speedMult
        );
        p.color.copy(color);
        p.life = Math.random() * 0.4 + 0.25;
        p.maxLife = p.life;
        emitted++;
      }
    }
  }

  public emitSpectrumExplosion(pos: THREE.Vector3, countPerColor: number = 12) {
    ALL_RYB_COLORS.forEach((cDef) => {
      this.emit(pos, countPerColor, cDef.hex, 2.8);
    });
  }

  public update(dt: number) {
    let dirty = false;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        dirty = true;
        p.life -= dt;
        p.position.addScaledVector(p.velocity, dt);
        p.velocity.y -= 9.8 * dt * 0.5;

        const alpha = Math.max(0, p.life / p.maxLife);
        this.positions[i * 3] = p.position.x;
        this.positions[i * 3 + 1] = p.position.y;
        this.positions[i * 3 + 2] = p.position.z;

        this.colors[i * 3] = p.color.r * alpha;
        this.colors[i * 3 + 1] = p.color.g * alpha;
        this.colors[i * 3 + 2] = p.color.b * alpha;

        if (p.life <= 0) {
          this.positions[i * 3 + 1] = -999;
        }
      }
    }

    if (dirty) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }
  }

  public dispose(scene: THREE.Scene) {
    scene.remove(this.pointsMesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}

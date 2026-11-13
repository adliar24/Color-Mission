import * as THREE from 'three';
import { GameColorId, WeaponType } from '../types';
import { WEAPON_REGISTRY, getColorDef } from '../rules';

export interface VRWristWatchState {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  ammo: number;
  maxAmmo: number;
  weapon: WeaponType;
  targetColorId: GameColorId;
  crystalColorId: GameColorId | null;
  stage: number;
}

/**
 * Jam tangan taktis 3D pada pergelangan tangan kiri di mode VR.
 * Menampilkan Darah, Perisai, Ammo, Senjata aktif, dan Target Warna.
 */
export class VRWristWatch {
  public group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  private screenMesh: THREE.Mesh;
  private lastSignature = '';

  constructor() {
    this.group = new THREE.Group();
    // Posisikan di pergelangan tangan kiri dengan ukuran lebih besar & sudut baca natural
    this.group.position.set(0.018, 0.056, 0.048);
    this.group.rotation.set(-0.62, 0.32, -0.18);
    this.group.scale.setScalar(1.38);

    // Strap / Body Jam
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.016, 0.088),
      new THREE.MeshStandardMaterial({
        color: '#0f172a',
        roughness: 0.45,
        metalness: 0.75,
      })
    );
    strap.position.set(0, -0.008, 0);
    this.group.add(strap);

    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.118, 0.012, 0.078),
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        emissive: '#082f49',
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.85,
      })
    );
    bezel.position.set(0, 0, 0);
    this.group.add(bezel);

    // Layar CanvasTexture Resolusi Tinggi
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 320;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;

    this.screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.108, 0.068),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: false,
      })
    );
    this.screenMesh.rotation.x = -Math.PI / 2;
    this.screenMesh.position.set(0, 0.007, 0);
    this.group.add(this.screenMesh);

    this.group.visible = false;
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public update(state: VRWristWatchState) {
    const sig = [
      Math.round(state.hp),
      Math.round(state.maxHp),
      Math.round(state.shield),
      Math.round(state.maxShield),
      state.ammo,
      state.maxAmmo,
      state.weapon,
      state.targetColorId,
      state.crystalColorId ?? 'none',
      state.stage,
    ].join('|');

    if (sig === this.lastSignature || !this.ctx) return;
    this.lastSignature = sig;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background gelap cyber
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    // Border neon tipis
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Header: Stage + Target Warna
    const targetColor = getColorDef(state.targetColorId);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, 14, w - 28, 56);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`STAGE ${state.stage}`, 28, 49);

    // Kotak Target Warna di kanan header
    ctx.fillStyle = targetColor.hex;
    ctx.fillRect(w - 196, 22, 38, 38);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(w - 196, 22, 38, 38);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(targetColor.nameId.toUpperCase(), w - 148, 49);

    // Bar DARAH (HP)
    const hpRatio = state.maxHp > 0 ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText('DARAH', 24, 102);

    ctx.textAlign = 'right';
    ctx.fillStyle = hpRatio > 0.35 ? '#34d399' : '#fb7185';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(state.hp)} / ${Math.ceil(state.maxHp)}`, w - 24, 102);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 112, w - 48, 22);
    ctx.fillStyle = hpRatio > 0.35 ? '#10b981' : '#f43f5e';
    ctx.fillRect(24, 112, (w - 48) * hpRatio, 22);

    // Bar PERISAI (Shield)
    const shRatio =
      state.maxShield > 0 ? Math.max(0, Math.min(1, state.shield / state.maxShield)) : 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText('PERISAI', 24, 166);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(state.shield)} / ${Math.ceil(state.maxShield)}`, w - 24, 166);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 176, w - 48, 18);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(24, 176, (w - 48) * shRatio, 18);

    // Footer: Senjata & Ammo
    const weaponDef = WEAPON_REGISTRY[state.weapon];
    const crystalColor = state.crystalColorId ? getColorDef(state.crystalColorId) : null;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, 212, w - 28, 92);

    // Indikator warna senjata / kristal
    ctx.fillStyle = crystalColor ? crystalColor.hex : weaponDef.color;
    ctx.fillRect(24, 226, 12, 64);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('SENJATA AKTIF', 48, 244);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText(weaponDef.name.toUpperCase(), 48, 276);

    if (crystalColor) {
      ctx.fillStyle = crystalColor.hex;
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText(`LASER: ${crystalColor.nameId.toUpperCase()}`, 48, 297);
    }

    // Ammo di kanan bawah
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('AMMO', w - 28, 244);

    ctx.fillStyle = state.ammo > 0 ? '#22d3ee' : '#fb7185';
    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillText(`${state.ammo}`, w - 82, 288);

    ctx.fillStyle = '#64748b';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(`/${state.maxAmmo}`, w - 26, 288);

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.screenMesh.geometry.dispose();
    (this.screenMesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}


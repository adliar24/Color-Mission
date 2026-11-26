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

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Jam tangan taktis 3D pada pergelangan tangan kiri di mode VR.
 * Menampilkan Stage, Target Warna, Darah (HP), Perisai (Shield), Senjata aktif, dan Peluru.
 */
export class VRWristWatch {
  public group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  private screenMesh: THREE.Mesh;
  private lastSignature = '';

  private isHandTrackingPose = false;

  constructor() {
    this.group = new THREE.Group();
    // Posisikan lebih rendah & miring menghadap wajah (+rotation.x) agar saat controller dipegang biasa layar jam langsung terbaca jelas
    this.group.position.set(0.018, 0.042, 0.045);
    this.group.rotation.set(0.58, 0.18, -0.1);
    this.group.scale.setScalar(1.38);

    // Strap / Dudukan Jam (berbentuk rounded ramping)
    const strapShape = createRoundedRectShape(0.064, 0.094, 0.014);
    const strapGeo = new THREE.ExtrudeGeometry(strapShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    strapGeo.rotateX(-Math.PI / 2);
    const strap = new THREE.Mesh(
      strapGeo,
      new THREE.MeshStandardMaterial({
        color: '#0b1220',
        roughness: 0.45,
        metalness: 0.72,
      })
    );
    strap.position.set(0, -0.014, 0);
    this.group.add(strap);

    // Casing / Bezel Smartwatch Rounded dengan bevel halus
    const bezelShape = createRoundedRectShape(0.122, 0.082, 0.014);
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.0025,
      bevelSize: 0.0025,
      bevelSegments: 3,
    });
    bezelGeo.rotateX(-Math.PI / 2);
    const bezel = new THREE.Mesh(
      bezelGeo,
      new THREE.MeshStandardMaterial({
        color: '#162238',
        emissive: '#082f49',
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.85,
      })
    );
    bezel.position.set(0, -0.004, 0);
    this.group.add(bezel);

    // Tombol Crown Samping Smartwatch (detail estetika taktis)
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0045, 0.012, 10),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.8,
      })
    );
    crown.rotation.z = Math.PI / 2;
    crown.position.set(0.064, 0.001, -0.014);
    this.group.add(crown);

    // Layar CanvasTexture Resolusi Tinggi (Rounded Corners transparan)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 320;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;

    this.screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.114, 0.072),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
      })
    );
    this.screenMesh.rotation.x = -Math.PI / 2;
    this.screenMesh.position.set(0, 0.009, 0);
    this.group.add(this.screenMesh);

    this.group.visible = false;
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public setHandTrackingMode(isHandTracking: boolean) {
    if (this.isHandTrackingPose === isHandTracking) return;
    this.isHandTrackingPose = isHandTracking;
    if (isHandTracking) {
      // Di sendi wrist tangan kiri, posisikan di sisi luar punggung pergelangan agar layar menghadap wajah & tidak tertutup
      this.group.position.set(-0.008, 0.038, 0.016);
      this.group.rotation.set(-0.18, 0.08, -0.35);
      this.group.scale.setScalar(1.22);
    } else {
      this.group.position.set(0.018, 0.042, 0.045);
      this.group.rotation.set(0.58, 0.18, -0.1);
      this.group.scale.setScalar(1.38);
    }
  }

  private drawPillBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    ratio: number,
    colorStart: string,
    colorEnd: string
  ) {
    const r = height / 2;
    // Track gelap rounded penuh
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const clamped = Math.max(0, Math.min(1, ratio));
    const fillW = width * clamped;
    if (fillW > 2) {
      const grad = ctx.createLinearGradient(x, y, x + width, y);
      grad.addColorStop(0, colorStart);
      grad.addColorStop(1, colorEnd);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, r);
      ctx.clip();

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(height, fillW), height, r);
      ctx.fill();

      // Kilau halus bagian atas bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 2, Math.max(0, fillW - 6), height * 0.34, r);
      ctx.fill();
      ctx.restore();
    }
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

    ctx.clearRect(0, 0, w, h);

    // Clip seluruh layar menjadi sudut membulat (Smartwatch Glass)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 34);
    ctx.clip();

    // Background gradien gelap cyber premium
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0c162c');
    bgGrad.addColorStop(1, '#050811');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Garis bingkai layar glowing tipis
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 32);
    ctx.stroke();

    // =========================================================================
    // 1. HEADER: BADGE STAGE + TARGET WARNA (ROUNDED)
    // =========================================================================
    const targetColor = getColorDef(state.targetColorId);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(18, 16, w - 36, 60, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pill STAGE di kiri
    ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.beginPath();
    ctx.roundRect(28, 26, 126, 40, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE ${state.stage}`, 28 + 63, 53);

    // Pill TARGET WARNA di kanan
    const swatchX = 174;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(swatchX, 24, w - swatchX - 28, 44, 13);
    ctx.fill();

    // Kotak warna Target (rounded)
    ctx.fillStyle = targetColor.hex;
    ctx.beginPath();
    ctx.roundRect(swatchX + 8, 30, 32, 32, 9);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillText('TARGET WARNA', swatchX + 50, 41);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 18px system-ui, sans-serif';
    const targetName = targetColor.nameId.toUpperCase();
    ctx.fillText(targetName.length > 15 ? `${targetName.slice(0, 14)}…` : targetName, swatchX + 50, 61);

    // =========================================================================
    // 2. VITALS CARD: BAR DARAH (HP) & PERISAI (SHIELD) FULL-ROUNDED PILL
    // =========================================================================
    ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
    ctx.beginPath();
    ctx.roundRect(18, 86, w - 36, 118, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bar DARAH (HP)
    const hpRatio = state.maxHp > 0 ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 0;
    const isLowHp = hpRatio <= 0.35;

    // Dot indikator HP
    ctx.fillStyle = isLowHp ? '#fb7185' : '#34d399';
    ctx.beginPath();
    ctx.arc(38, 108, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('DARAH', 50, 114);

    ctx.textAlign = 'right';
    ctx.fillStyle = isLowHp ? '#fb7185' : '#34d399';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(state.hp)} / ${Math.ceil(state.maxHp)}`, w - 32, 114);

    this.drawPillBar(
      ctx,
      32,
      122,
      w - 64,
      20,
      hpRatio,
      isLowHp ? '#e11d48' : '#059669',
      isLowHp ? '#fb7185' : '#34d399'
    );

    // Bar PERISAI (Shield)
    const shRatio =
      state.maxShield > 0 ? Math.max(0, Math.min(1, state.shield / state.maxShield)) : 0;

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(38, 162, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('PERISAI', 50, 168);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(state.shield)} / ${Math.ceil(state.maxShield)}`, w - 32, 168);

    this.drawPillBar(ctx, 32, 176, w - 64, 18, shRatio, '#0284c7', '#38bdf8');

    // =========================================================================
    // 3. FOOTER CARD: SENJATA AKTIF & PELURU (ROUNDED)
    // =========================================================================
    const weaponDef = WEAPON_REGISTRY[state.weapon];
    const crystalColor = state.crystalColorId ? getColorDef(state.crystalColorId) : null;
    const accentColor = crystalColor ? crystalColor.hex : weaponDef.color;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(18, 214, w - 36, 88, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Strip indikator warna senjata / kristal (rounded pill vertikal)
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(30, 228, 10, 60, 5);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText('SENJATA AKTIF', 50, 244);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(weaponDef.name.toUpperCase(), 50, 272);

    if (crystalColor) {
      ctx.fillStyle = crystalColor.hex;
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillText(`KRISTAL: ${crystalColor.nameId.toUpperCase()}`, 50, 293);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('Bahu Kanan: Ganti Senjata', 50, 293);
    }

    // Kotak Peluru (Ammo) rounded di kanan bawah
    ctx.fillStyle = 'rgba(5, 8, 17, 0.78)';
    ctx.beginPath();
    ctx.roundRect(w - 154, 224, 126, 68, 14);
    ctx.fill();
    ctx.strokeStyle = state.ammo > 0 ? 'rgba(34, 211, 238, 0.35)' : 'rgba(251, 113, 133, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText('PELURU', w - 91, 241);

    ctx.textAlign = 'right';
    ctx.fillStyle = state.ammo > 0 ? '#22d3ee' : '#fb7185';
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillText(`${state.ammo}`, w - 82, 281);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillText(`/${state.maxAmmo}`, w - 78, 281);

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.screenMesh.geometry.dispose();
    (this.screenMesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}

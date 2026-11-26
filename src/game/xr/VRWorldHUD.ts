import * as THREE from 'three';
import { GameColorId, PlayerStats, ShotFeedback, WeaponType } from '../types';
import { WEAPON_REGISTRY, buildColorInstructionClue, STAGE_DEFINITIONS } from '../rules';

function drawVRWeaponSilhouette(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponType,
  x: number,
  y: number
) {
  // Gambar siluet senjata 2D presisi tinggi (skala dari viewBox 360x180 -> 88x44 px) sesuai Weapon2DIcon
  const scale = 88 / 360;
  ctx.save();
  ctx.translate(x, y);

  // Kotak latar tipis agar siluet senjata sangat kontras di HUD VR
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.roundRect(-4, -2, 96, 48, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.scale(scale, scale);

  if (weapon === 'cyber_shotgun') {
    // Stock + arm
    ctx.fillStyle = '#120a1c';
    ctx.strokeStyle = '#6b4d8a';
    ctx.lineWidth = 4;
    ctx.fillRect(28, 64, 16, 48);
    ctx.strokeRect(28, 64, 16, 48);
    ctx.fillRect(42, 75, 46, 22);
    ctx.strokeRect(42, 75, 46, 22);

    // Grip & Mag + Rose Stripe
    ctx.beginPath();
    ctx.moveTo(116, 104); ctx.lineTo(143, 104); ctx.lineTo(131, 153); ctx.lineTo(103, 150);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(162, 104); ctx.lineTo(188, 104); ctx.lineTo(197, 147); ctx.lineTo(170, 152);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff1e68';
    ctx.beginPath();
    ctx.moveTo(166, 133); ctx.lineTo(196, 127); ctx.lineTo(199, 137); ctx.lineTo(168, 143);
    ctx.closePath();
    ctx.fill();

    // Twin rose-pink barrels
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(228, 60, 92, 16);
    ctx.fillStyle = '#ff1e68';
    ctx.fillRect(228, 72, 98, 17);

    // Chunky body
    ctx.fillStyle = '#221433';
    ctx.strokeStyle = '#7c5ca0';
    ctx.fillRect(84, 56, 148, 50);
    ctx.strokeRect(84, 56, 148, 50);
  } else if (weapon === 'railgun') {
    // Stock
    ctx.fillStyle = '#0a1120';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.fillRect(22, 65, 16, 48);
    ctx.strokeRect(22, 65, 16, 48);
    ctx.fillRect(36, 76, 40, 22);
    ctx.strokeRect(36, 76, 40, 22);

    // Grip & Mag + Purple Stripe
    ctx.beginPath();
    ctx.moveTo(108, 108); ctx.lineTo(134, 108); ctx.lineTo(123, 155); ctx.lineTo(96, 152);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(156, 108); ctx.lineTo(182, 108); ctx.lineTo(192, 150); ctx.lineTo(165, 155);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#c026d3';
    ctx.beginPath();
    ctx.moveTo(160, 135); ctx.lineTo(190, 129); ctx.lineTo(193, 139); ctx.lineTo(162, 145);
    ctx.closePath();
    ctx.fill();

    // Dual purple magnetic rails
    ctx.fillStyle = '#bf00ff';
    ctx.fillRect(195, 51, 142, 12);
    ctx.fillRect(195, 113, 142, 12);

    // Main body
    ctx.fillStyle = '#131d33';
    ctx.strokeStyle = '#64748b';
    ctx.fillRect(72, 60, 174, 52);
    ctx.strokeRect(72, 60, 174, 52);
  } else {
    // Pulse Laser Rifle
    ctx.fillStyle = '#0d1422';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.fillRect(26, 65, 16, 46);
    ctx.strokeRect(26, 65, 16, 46);
    ctx.fillRect(40, 76, 46, 20);
    ctx.strokeRect(40, 76, 46, 20);

    // Grip & Mag + Cyan Stripe
    ctx.beginPath();
    ctx.moveTo(116, 102); ctx.lineTo(141, 102); ctx.lineTo(129, 151); ctx.lineTo(103, 148);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(164, 102); ctx.lineTo(189, 102); ctx.lineTo(198, 144); ctx.lineTo(172, 149);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(168, 130); ctx.lineTo(197, 125); ctx.lineTo(199, 134); ctx.lineTo(170, 140);
    ctx.closePath();
    ctx.fill();

    // Cyan barrel
    ctx.fillStyle = '#00d8ff';
    ctx.fillRect(228, 70, 98, 18);

    // Wireframe cyan optic
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(132, 34, 58, 22);

    // Main receiver
    ctx.fillStyle = '#151e30';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.fillRect(84, 58, 148, 46);
    ctx.strokeRect(84, 58, 148, 46);
  }
  ctx.restore();
}

/**
 * HUD 3D Stereoskopik di dalam dunia WebXR (Meta Quest 3S)
 * Menggunakan kotak warna polos (tanpa teks nama warna) dan angka kontras tinggi.
 */
export class VRWorldHUD {
  public mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private lastRedrawTime = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 220;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geo = new THREE.PlaneGeometry(1.12, 0.32);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.02,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, 0.34, -1.85);
    this.mesh.renderOrder = 999;
    this.mesh.visible = false;
  }

  public update(
    nowMs: number,
    isVRActive: boolean,
    player: PlayerStats,
    targetColorId: GameColorId,
    ammo: number,
    maxAmmo: number,
    bossHp: number | undefined,
    bossMaxHp: number,
    feedback: ShotFeedback | null
  ) {
    this.mesh.visible = isVRActive;
    if (!isVRActive) return;

    if (nowMs - this.lastRedrawTime < 65) return;
    this.lastRedrawTime = nowMs;

    const ctx = this.ctx;
    const clue = buildColorInstructionClue(targetColorId, player.stage);
    const stageDef = STAGE_DEFINITIONS[player.stage] || STAGE_DEFINITIONS[1];

    ctx.clearRect(0, 0, 768, 220);

    // Panel dark-navy SOLID (tidak transparan) agar warna target terbaca 100% akurat
    ctx.fillStyle = '#090d18';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(12, 12, 744, 196, 22);
    ctx.fill();
    ctx.stroke();

    // KIRI: HP, SHIELD, AMMO, SKOR
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`HP ${Math.round(player.hp)}`, 36, 56);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(`SHIELD ${Math.round(player.shield)}`, 160, 56);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`AMMO ${ammo}/${maxAmmo}`, 36, 96);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`SKOR ${player.score}`, 36, 136);

    // KANAN: Kotak Warna Polos (Tanpa Teks Nama Warna)
    if (clue.displayMode === 'direct') {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('TARGET', 430, 88);

      ctx.fillStyle = clue.directHex || '#ef4444';
      ctx.beginPath();
      ctx.roundRect(525, 38, 86, 86, 16);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      // Kotak Polos 1
      ctx.fillStyle = clue.ingredient1?.hex || '#ef4444';
      ctx.beginPath();
      ctx.roundRect(410, 44, 72, 72, 14);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // +
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('+', 498, 92);

      // Kotak Polos 2
      ctx.fillStyle = clue.ingredient2?.hex || '#facc15';
      ctx.beginPath();
      ctx.roundRect(532, 44, 72, 72, 14);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // =
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('=', 618, 92);

      // Kotak ?
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(650, 44, 72, 72, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('?', 676, 92);
    }

    // BARIS BAWAH: Stage / Boss / Feedback Singkat
    if (feedback && nowMs - feedback.timestamp < 1400) {
      if (feedback.type === 'pickup') {
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 20px sans-serif';
        if (feedback.weaponType) {
          drawVRWeaponSilhouette(ctx, feedback.weaponType, 38, 152);
          ctx.fillText(
            `${feedback.title} · ${WEAPON_REGISTRY[feedback.weaponType].name.toUpperCase()}`,
            142,
            182
          );
        } else {
          ctx.fillText(feedback.title, 36, 182);
        }
      } else {
        ctx.fillStyle = feedback.type === 'wrong' ? '#fb7185' : '#34d399';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(feedback.type === 'wrong' ? 'SALAH!' : 'TEPAT!', 36, 182);
      }
    } else if (bossHp !== undefined) {
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`CHROMA TITAN: ${Math.max(0, Math.round(bossHp))} / ${bossMaxHp}`, 36, 182);
    } else {
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(
        `STAGE ${player.stage} · ${player.stageKills}/${stageDef.targetEliminations}`,
        36,
        182
      );
    }

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

import * as THREE from 'three';
import { GameColorId, PlayerStats, ShotFeedback } from '../types';
import { buildColorInstructionClue, STAGE_DEFINITIONS } from '../rules';

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
    if (feedback && nowMs - feedback.timestamp < 1100) {
      ctx.fillStyle = feedback.type === 'wrong' ? '#fb7185' : '#34d399';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(feedback.type === 'wrong' ? 'SALAH!' : 'TEPAT!', 36, 182);
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

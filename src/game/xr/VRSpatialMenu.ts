import * as THREE from 'three';
import {
  CharacterId,
  GameSettings,
  GameState,
  RunSummary,
  resolveAudioSettings,
  resolveSpeedSettings,
} from '../types';
import {
  STAGE_DEFINITIONS,
  CHARACTER_REGISTRY,
  DIFFICULTY_REGISTRY,
  getColorsByCategory,
} from '../rules';

export type VRMenuAction =
  | 'start_mission'
  | 'cycle_character'
  | 'cycle_difficulty'
  | 'open_tutorial'
  | 'open_settings'
  | 'open_lkpd'
  | 'close_subpanel'
  | 'exit_vr'
  | 'continue_stage'
  | 'resume'
  | 'restart'
  | 'return_menu'
  | 'toggle_vr_turn'
  | 'toggle_vr_move'
  | 'toggle_vr_vignette'
  | 'toggle_mute'
  | 'speed_slow'
  | 'speed_normal'
  | 'speed_fast'
  | 'speed_custom'
  | 'move_speed_down'
  | 'move_speed_up'
  | 'cam_speed_down'
  | 'cam_speed_up'
  | 'bgm_vol_down'
  | 'bgm_vol_up'
  | 'sfx_vol_down'
  | 'sfx_vol_up'
  | 'vr_setup_start'
  | 'vr_setup_back_to_menu'
  | 'vr_setup_select_name_input'
  | 'vr_setup_select_class_input'
  | 'vr_setup_next_to_character'
  | 'vr_setup_back_to_identity'
  | 'vr_setup_pick_raka'
  | 'vr_setup_pick_rana'
  | 'vr_setup_confirm_start'
  | `kb_${string}`;

interface MenuButtonRect {
  id: VRMenuAction;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  variant: 'primary' | 'secondary' | 'danger';
}

export interface VRSpatialMenuState {
  gameState: GameState;
  showSettings: boolean;
  showTutorial: boolean;
  stageTransitionMode: 'stage_clear' | 'stage_intro';
  stageNumber: 1 | 2 | 3;
  stageScore: number;
  isHandTracking?: boolean;
  stageBonus: number;
  score: number;
  summary: RunSummary;
  settings: GameSettings;
  isMuted: boolean;
  lkpdUnlocked?: boolean;
  vrWarningMsg?: string | null;

  // In-Game Setup Identitas & Karakter di VR
  vrSetupStep?: 'none' | 'identity' | 'character';
  studentName?: string;
  studentClass?: string;
  activeInputField?: 'name' | 'class';
  selectedCharacterId?: CharacterId;
}

const BOARD_WIDTH = 2.24;
const BOARD_HEIGHT = 1.4;
const CANVAS_W = 1024;
const CANVAS_H = 640;

/**
 * Papan UI 3D melayang di arena 360° VR.
 * Mendukung raycast pointer dari controller kanan dan klik trigger untuk navigasi penuh di dalam headset.
 */
export class VRSpatialMenu {
  public group: THREE.Group;
  private panelMesh: THREE.Mesh;
  private frameMesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  private buttons: MenuButtonRect[] = [];
  private hoveredId: VRMenuAction | null = null;
  private graceHoveredId: VRMenuAction | null = null;
  private graceHoverExpiry = 0;
  private pressedId: VRMenuAction | null = null;
  private pressAnimStart = 0;
  private pressAnimUntil = 0;
  private pressProgress = 0;
  private lastSignature = '';
  private raycaster = new THREE.Raycaster();
  private prevTriggerPressed = false;
  private rakaImg: HTMLImageElement | null = null;
  private ranaImg: HTMLImageElement | null = null;

  private static readonly ORIGIN = new THREE.Vector3();
  private static readonly QUAT = new THREE.Quaternion();
  private static readonly DIR = new THREE.Vector3();

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 1.55, -2.35);

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;

    this.panelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        alphaTest: 0.02,
      })
    );
    this.group.add(this.panelMesh);

    this.frameMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.01, 0.01),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.group.add(this.frameMesh);

    // Preload gambar karakter PNG untuk Papan Pemilihan Karakter di VR
    if (typeof window !== 'undefined') {
      this.rakaImg = new Image();
      this.rakaImg.src = '/characters/agen-raka.png';
      this.ranaImg = new Image();
      this.ranaImg.src = '/characters/agen-naya.png';
      const markTextureUpdate = () => {
        this.lastSignature = ''; // trigger kanvas redraw saat gambar selesai dimuat
      };
      this.rakaImg.onload = markTextureUpdate;
      this.ranaImg.onload = markTextureUpdate;
    }

    this.group.visible = false;
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
    if (!visible) {
      this.hoveredId = null;
      this.graceHoveredId = null;
      this.graceHoverExpiry = 0;
      this.prevTriggerPressed = false;
    }
  }

  public update(
    state: VRSpatialMenuState,
    rightController: THREE.Group | null,
    xrSession: XRSession | null,
    handAimRay?: { origin: THREE.Vector3 | null; dir: THREE.Vector3 | null } | null,
    handPinchPressed?: boolean
  ): { hitPoint: THREE.Vector3 | null; action: VRMenuAction | null } {
    let hitPoint: THREE.Vector3 | null = null;
    let nextHover: VRMenuAction | null = null;
    let action: VRMenuAction | null = null;

    if (this.group.visible) {
      let hasRay = false;
      if (handAimRay?.origin && handAimRay?.dir) {
        VRSpatialMenu.ORIGIN.copy(handAimRay.origin);
        VRSpatialMenu.DIR.copy(handAimRay.dir).normalize();
        hasRay = true;
      } else if (rightController) {
        rightController.getWorldPosition(VRSpatialMenu.ORIGIN);
        rightController.getWorldQuaternion(VRSpatialMenu.QUAT);
        VRSpatialMenu.DIR.set(0, 0, -1).applyQuaternion(VRSpatialMenu.QUAT).normalize();
        hasRay = true;
      }

      if (hasRay) {
        this.raycaster.set(VRSpatialMenu.ORIGIN, VRSpatialMenu.DIR);
        const hits = this.raycaster.intersectObject(this.panelMesh, false);
        if (hits.length > 0 && hits[0].uv) {
          hitPoint = hits[0].point.clone();
          const px = hits[0].uv.x * CANVAS_W;
          const py = (1 - hits[0].uv.y) * CANVAS_H;

          for (const btn of this.buttons) {
            if (
              px >= btn.x - 14 &&
              px <= btn.x + btn.w + 14 &&
              py >= btn.y - 10 &&
              py <= btn.y + btn.h + 10
            ) {
              nextHover = btn.id;
              break;
            }
          }
        }
      }
    }

    // Cek trigger controller kanan ATAU cubit tangan kanan untuk klik tombol
    let triggerPressed = Boolean(handPinchPressed);
    if (!triggerPressed && xrSession) {
      for (const src of xrSession.inputSources) {
        if (!src.gamepad) continue;
        if (src.handedness === 'right' || src.handedness === 'none') {
          const btn = src.gamepad.buttons[0];
          if (btn?.pressed || (btn?.value ?? 0) > 0.55) {
            triggerPressed = true;
            break;
          }
        }
      }
    }

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nextHover) {
      this.graceHoveredId = nextHover;
      this.graceHoverExpiry = nowMs + 300;
    }

    const clickTarget = nextHover ?? (nowMs <= this.graceHoverExpiry ? this.graceHoveredId : null);
    if (triggerPressed && !this.prevTriggerPressed && clickTarget) {
      action = clickTarget;
      this.pressedId = clickTarget;
      this.pressAnimStart = nowMs;
      this.pressAnimUntil = nowMs + 220;
    }
    this.prevTriggerPressed = triggerPressed;

    if (this.pressedId && nowMs < this.pressAnimUntil) {
      this.pressProgress = THREE.MathUtils.clamp(
        (nowMs - this.pressAnimStart) / (this.pressAnimUntil - this.pressAnimStart),
        0,
        1
      );
      this.panelMesh.position.z = -0.016 * Math.sin(this.pressProgress * Math.PI);
      this.lastSignature = '';
    } else {
      if (this.pressedId) {
        this.pressedId = null;
        this.pressProgress = 0;
        this.lastSignature = '';
      }
      this.panelMesh.position.z = THREE.MathUtils.lerp(this.panelMesh.position.z, 0, 0.35);
    }

    if (nextHover !== this.hoveredId) {
      this.hoveredId = nextHover;
      this.lastSignature = '';
    }

    this.renderBoard(state);
    return { hitPoint, action };
  }

  private renderBoard(state: VRSpatialMenuState) {
    const speedInfo = resolveSpeedSettings(state.settings);
    const audioInfo = resolveAudioSettings(state.settings);
    const sig = JSON.stringify({
      g: state.gameState,
      s: state.showSettings,
      t: state.showTutorial,
      m: state.stageTransitionMode,
      n: state.stageNumber,
      sc: state.score,
      h: this.hoveredId,
      turn: state.settings.vrTurnMode,
      move: state.settings.vrMovementMode,
      vig: state.settings.vrComfortVignette,
      mute: state.isMuted,
      bgmVol: audioInfo.bgmVolumePercent,
      sfxVol: audioInfo.sfxVolumePercent,
      ht: Boolean(state.isHandTracking),
      sp: speedInfo.preset,
      msp: speedInfo.moveSpeedPercent,
      csp: speedInfo.cameraSpeedPercent,
      char: state.settings.characterId ?? 'raka',
      diff: state.settings.difficulty ?? 'normal',
      lkpd: Boolean(state.lkpdUnlocked),
      warn: state.vrWarningMsg || '',
      setupStep: state.vrSetupStep || 'none',
      sName: state.studentName || '',
      sClass: state.studentClass || '',
      actIn: state.activeInputField || 'name',
      selChar: state.selectedCharacterId || state.settings.characterId || 'raka',
    });
    if (sig === this.lastSignature || !this.ctx) return;
    this.lastSignature = sig;

    const ctx = this.ctx;
    this.buttons = [];
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Backdrop papan rounded persis seperti versi Desktop & Mobile (#090d18 + border putih halus)
    ctx.fillStyle = '#090d18';
    ctx.beginPath();
    ctx.roundRect(14, 14, CANVAS_W - 28, CANVAS_H - 28, 44);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    if (state.showSettings) {
      this.drawSettingsBoard(ctx, state);
    } else if (state.showTutorial) {
      this.drawTutorialBoard(ctx);
    } else if (state.gameState === 'title') {
      if (state.vrSetupStep === 'identity') {
        this.drawVRIdentityBoard(ctx, state);
      } else if (state.vrSetupStep === 'character') {
        this.drawVRCharacterBoard(ctx, state);
      } else {
        this.drawMainMenuBoard(ctx, state);
      }
    } else if (state.gameState === 'stage_transition') {
      this.drawStageTransitionBoard(ctx, state);
    } else if (state.gameState === 'paused') {
      this.drawPauseBoard(ctx);
    } else if (state.gameState === 'gameover' || state.gameState === 'victory') {
      this.drawEndBoard(ctx, state);
    }

    this.texture.needsUpdate = true;
  }

  private drawButton(
    ctx: CanvasRenderingContext2D,
    btn: MenuButtonRect
  ) {
    this.buttons.push(btn);
    const isHover = this.hoveredId === btn.id;
    const isPressed = this.pressedId === btn.id;
    const radius = 22;

    const cx = btn.x + btn.w / 2;
    const cy = btn.y + btn.h / 2;
    let scale = isHover ? 1.03 : 1.0;
    let pressPulse = 0;
    if (isPressed) {
      pressPulse = Math.sin(this.pressProgress * Math.PI);
      scale = 1.0 - 0.07 * pressPulse;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    if (isHover || isPressed) {
      ctx.save();
      ctx.shadowColor = btn.variant === 'danger' ? 'rgba(251, 113, 133, 0.75)' : 'rgba(34, 211, 238, 0.85)';
      ctx.shadowBlur = isPressed ? 28 : 16;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, radius);
      ctx.strokeStyle = isPressed ? '#ffffff' : 'rgba(103, 232, 249, 0.6)';
      ctx.lineWidth = isPressed ? 3.5 : 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, radius);

    if (btn.variant === 'primary') {
      ctx.fillStyle = isPressed ? '#a5f3fc' : isHover ? '#67e8f9' : '#22d3ee';
      ctx.fill();
      ctx.fillStyle = '#020617';
    } else if (btn.variant === 'danger') {
      ctx.fillStyle = isPressed
        ? 'rgba(244, 63, 94, 0.52)'
        : isHover
          ? 'rgba(244, 63, 94, 0.32)'
          : 'rgba(244, 63, 94, 0.14)';
      ctx.fill();
      ctx.strokeStyle = isPressed ? '#ffffff' : isHover ? '#fb7185' : 'rgba(244, 63, 94, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#fecdd3';
    } else {
      ctx.fillStyle = isPressed
        ? 'rgba(34, 211, 238, 0.32)'
        : isHover
          ? 'rgba(255, 255, 255, 0.14)'
          : 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = isPressed ? '#ffffff' : isHover ? '#22d3ee' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
    }

    if (isPressed && pressPulse > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, radius);
      ctx.clip();
      const rippleR = (btn.w * 0.65) * (0.2 + this.pressProgress * 0.9);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.32 * (1 - this.pressProgress)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.font = '800 22px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, cx, cy);
    ctx.restore();
  }

  private drawMainMenuBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    // Tiga kotak warna primer RYB persis seperti Main Menu Desktop & Mobile
    const swatchColors = ['#EF233C', '#FFD60A', '#1D6FFF'];
    const swSize = 30;
    const swGap = 16;
    const totalSwW = swatchColors.length * swSize + (swatchColors.length - 1) * swGap;
    const swStartX = (CANVAS_W - totalSwW) / 2;
    swatchColors.forEach((hex, idx) => {
      const sx = swStartX + idx * (swSize + swGap);
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(sx, 50, swSize, swSize, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // Logo COLOR MISSION (Putih + Cyan)
    ctx.font = '900 70px Inter, system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const part1 = 'COLOR ';
    const part2 = 'MISSION';
    const w1 = ctx.measureText(part1).width;
    const w2 = ctx.measureText(part2).width;
    const titleStartX = (CANVAS_W - (w1 + w2)) / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(part1, titleStartX, 162);
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(part2, titleStartX + w1, 162);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 21px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('Kuasai Warna. Selesaikan Misi.', CANVAS_W / 2, 202);

    const bw = 540;
    const bx = (CANVAS_W - bw) / 2;
    const halfW = (bw - 18) / 2;
    const activeChar = CHARACTER_REGISTRY[state.settings.characterId ?? 'raka'] || CHARACTER_REGISTRY.raka;
    const activeDiff = DIFFICULTY_REGISTRY[state.settings.difficulty ?? 'normal'] || DIFFICULTY_REGISTRY.normal;

    this.drawButton(ctx, {
      id: 'vr_setup_start',
      label: 'MULAI MISI',
      x: bx,
      y: 222,
      w: bw,
      h: 64,
      variant: 'primary',
    });

    this.drawButton(ctx, {
      id: 'cycle_character',
      label: `AGEN: ${activeChar.name.toUpperCase()}`,
      x: bx,
      y: 298,
      w: halfW,
      h: 52,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'cycle_difficulty',
      label: `MODE: ${activeDiff.label}`,
      x: bx + halfW + 18,
      y: 298,
      w: halfW,
      h: 52,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'open_tutorial',
      label: 'CARA MAIN',
      x: bx,
      y: 362,
      w: halfW,
      h: 54,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'open_settings',
      label: 'PENGATURAN',
      x: bx + halfW + 18,
      y: 362,
      w: halfW,
      h: 54,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'open_lkpd',
      label: state.lkpdUnlocked ? 'LKPD EVALUASI · TERBUKA' : '🔒 LKPD EVALUASI · TERKUNCI',
      x: bx,
      y: 428,
      w: bw,
      h: 54,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'exit_vr',
      label: 'KELUAR MODE VR',
      x: bx,
      y: 494,
      w: bw,
      h: 50,
      variant: 'danger',
    });

    if (state.vrWarningMsg) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.roundRect(112, 554, CANVAS_W - 224, 44, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fde68a';
      ctx.font = '700 19px Inter, system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.vrWarningMsg, CANVAS_W / 2, 576);
    }
  }

  /**
   * Papan Setup Misi Langkah 1: Input Identitas Siswa + Virtual Keyboard QWERTY 3D di VR
   */
  private drawVRIdentityBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const studentName = state.studentName || '';
    const studentClass = state.studentClass || '';
    const activeField = state.activeInputField || 'name';
    const isNameValid = studentName.trim().length >= 2;

    // Header Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect((CANVAS_W - 220) / 2, 34, 220, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#f0f9ff';
    ctx.font = '800 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LANGKAH 1 DARI 2', CANVAS_W / 2, 54);

    // Title
    ctx.font = '900 34px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('IDENTITAS AGEN', CANVAS_W / 2, 96);

    ctx.font = '500 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Masukkan nama dan kelas sebelum memulai misi penyelamatan', CANVAS_W / 2, 122);

    // Input Field 1: NAMA SISWA (WAJIB)
    const nameX = 64;
    const nameY = 140;
    const nameW = 560;
    const nameH = 64;
    const isNameActive = activeField === 'name';

    ctx.fillStyle = isNameActive ? '#0f172a' : '#080e1a';
    ctx.beginPath();
    ctx.roundRect(nameX, nameY, nameW, nameH, 14);
    ctx.fill();

    ctx.strokeStyle = isNameActive ? '#22d3ee' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isNameActive ? 3 : 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = isNameActive ? '#38bdf8' : '#64748b';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillText('NAMA SISWA (WAJIB)', nameX + 16, nameY + 22);

    ctx.font = '700 20px Inter, system-ui, sans-serif';
    if (studentName) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(studentName + (isNameActive ? '|' : ''), nameX + 16, nameY + 49);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillText(isNameActive ? '| Ketik nama siswa...' : 'Ketik nama siswa...', nameX + 16, nameY + 49);
    }

    this.drawButton(ctx, {
      id: 'vr_setup_select_name_input',
      label: '',
      x: nameX,
      y: nameY,
      w: nameW,
      h: nameH,
      variant: 'secondary',
    });

    // Input Field 2: KELAS (OPSIONAL)
    const classX = 640;
    const classY = 140;
    const classW = 320;
    const classH = 64;
    const isClassActive = activeField === 'class';

    ctx.fillStyle = isClassActive ? '#0f172a' : '#080e1a';
    ctx.beginPath();
    ctx.roundRect(classX, classY, classW, classH, 14);
    ctx.fill();

    ctx.strokeStyle = isClassActive ? '#22d3ee' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isClassActive ? 3 : 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = isClassActive ? '#38bdf8' : '#64748b';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillText('KELAS (OPSIONAL)', classX + 16, classY + 22);

    ctx.font = '700 20px Inter, system-ui, sans-serif';
    if (studentClass) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(studentClass + (isClassActive ? '|' : ''), classX + 16, classY + 49);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillText(isClassActive ? '| Contoh: 7A' : 'Contoh: 7A', classX + 16, classY + 49);
    }

    this.drawButton(ctx, {
      id: 'vr_setup_select_class_input',
      label: '',
      x: classX,
      y: classY,
      w: classW,
      h: classH,
      variant: 'secondary',
    });

    // In-Game Virtual Keyboard (QWERTY + Angka)
    const kbRows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ];

    const startY = 220;
    const rowHeight = 48;
    const rowGap = 8;

    kbRows.forEach((row, rIdx) => {
      const keyW = 78;
      const keyGap = 8;
      const totalRowW = row.length * keyW + (row.length - 1) * keyGap;
      const rowStartX = (CANVAS_W - totalRowW) / 2;
      const y = startY + rIdx * (rowHeight + rowGap);

      row.forEach((char, cIdx) => {
        const x = rowStartX + cIdx * (keyW + keyGap);
        this.drawButton(ctx, {
          id: `kb_${char}` as VRMenuAction,
          label: char,
          x,
          y,
          w: keyW,
          h: rowHeight,
          variant: 'secondary',
        });
      });
    });

    // Baris Aksi Keyboard (Space, Backspace, Clear)
    const actY = startY + 4 * (rowHeight + rowGap);
    const spaceW = 380;
    const bsW = 160;
    const clrW = 160;
    const actGap = 12;
    const totalActW = spaceW + bsW + clrW + 2 * actGap;
    const actStartX = (CANVAS_W - totalActW) / 2;

    this.drawButton(ctx, {
      id: 'kb_space',
      label: 'SPASI',
      x: actStartX,
      y: actY,
      w: spaceW,
      h: rowHeight,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'kb_backspace',
      label: '⌫ HAPUS',
      x: actStartX + spaceW + actGap,
      y: actY,
      w: bsW,
      h: rowHeight,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'kb_clear',
      label: 'BERSIHKAN',
      x: actStartX + spaceW + actGap + bsW + actGap,
      y: actY,
      w: clrW,
      h: rowHeight,
      variant: 'secondary',
    });

    // Baris Navigasi Bawah
    const navY = 562;
    this.drawButton(ctx, {
      id: 'vr_setup_back_to_menu',
      label: '⬅ BATAL',
      x: 64,
      y: navY,
      w: 200,
      h: 52,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'vr_setup_next_to_character',
      label: isNameValid ? 'LANJUT KE PILIH KARAKTER ➔' : 'NAMA WAJIB DIISI (MIN. 2 HURUF)',
      x: 280,
      y: navY,
      w: 680,
      h: 52,
      variant: isNameValid ? 'primary' : 'secondary',
    });
  }

  /**
   * Papan Setup Misi Langkah 2: Pemilihan Karakter dengan Visual Gambar PNG di VR
   */
  private drawVRCharacterBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const selectedChar = state.selectedCharacterId || state.settings.characterId || 'raka';

    // Header Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect((CANVAS_W - 220) / 2, 34, 220, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#f0f9ff';
    ctx.font = '800 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LANGKAH 2 DARI 2', CANVAS_W / 2, 54);

    // Title
    ctx.font = '900 34px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PILIH KARAKTER AGEN', CANVAS_W / 2, 96);

    ctx.font = '500 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Tentukan agen dan kemampuan khusus Anda untuk misi ini', CANVAS_W / 2, 122);

    const cardY = 138;
    const cardW = 430;
    const cardH = 404;
    const cardRadius = 24;

    // === KARTU 1: AGEN RAKA ===
    const isRaka = selectedChar === 'raka';
    const rakaX = 64;

    ctx.fillStyle = isRaka ? 'rgba(15, 23, 42, 0.96)' : 'rgba(8, 14, 26, 0.88)';
    ctx.beginPath();
    ctx.roundRect(rakaX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.strokeStyle = isRaka ? '#22d3ee' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = isRaka ? 4 : 2;
    ctx.stroke();

    // Visual Gambar PNG Agen Raka
    const imgSize = 164;
    const imgRakaX = rakaX + (cardW - imgSize) / 2;
    const imgRakaY = cardY + 18;

    if (this.rakaImg && this.rakaImg.complete) {
      ctx.drawImage(this.rakaImg, imgRakaX, imgRakaY, imgSize, imgSize);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(imgRakaX, imgRakaY, imgSize, imgSize, 16);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.font = '900 24px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('AGEN RAKA', rakaX + cardW / 2, cardY + 218);

    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('SPESIALIS PERTAHANAN', rakaX + cardW / 2, cardY + 242);

    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Jurus: PERISAI SUPER (Grip Kiri)', rakaX + cardW / 2, cardY + 276);
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Kebal 100% damage selama 6 detik', rakaX + cardW / 2, cardY + 298);

    this.drawButton(ctx, {
      id: 'vr_setup_pick_raka',
      label: isRaka ? '✔ TERPILIH' : 'PILIH RAKA',
      x: rakaX + 30,
      y: cardY + 332,
      w: cardW - 60,
      h: 52,
      variant: isRaka ? 'primary' : 'secondary',
    });

    // === KARTU 2: AGEN RANA ===
    const isRana = selectedChar === 'naya';
    const ranaX = 530;

    ctx.fillStyle = isRana ? 'rgba(15, 23, 42, 0.96)' : 'rgba(8, 14, 26, 0.88)';
    ctx.beginPath();
    ctx.roundRect(ranaX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.strokeStyle = isRana ? '#22d3ee' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = isRana ? 4 : 2;
    ctx.stroke();

    // Visual Gambar PNG Agen Rana
    const imgRanaX = ranaX + (cardW - imgSize) / 2;
    const imgRanaY = cardY + 18;

    if (this.ranaImg && this.ranaImg.complete) {
      ctx.drawImage(this.ranaImg, imgRanaX, imgRanaY, imgSize, imgSize);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(imgRanaX, imgRanaY, imgSize, imgSize, 16);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.font = '900 24px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('AGEN RANA', ranaX + cardW / 2, cardY + 218);

    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('SPESIALIS PEMULIHAN', ranaX + cardW / 2, cardY + 242);

    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Jurus: RECOVERY HP (Grip Kiri)', ranaX + cardW / 2, cardY + 276);
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Langsung pulihkan +20% HP', ranaX + cardW / 2, cardY + 298);

    this.drawButton(ctx, {
      id: 'vr_setup_pick_rana',
      label: isRana ? '✔ TERPILIH' : 'PILIH RANA',
      x: ranaX + 30,
      y: cardY + 332,
      w: cardW - 60,
      h: 52,
      variant: isRana ? 'primary' : 'secondary',
    });

    // Baris Navigasi Bawah
    const navY = 562;
    this.drawButton(ctx, {
      id: 'vr_setup_back_to_identity',
      label: '⬅ KEMBALI KE IDENTITAS',
      x: 64,
      y: navY,
      w: 320,
      h: 52,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'vr_setup_confirm_start',
      label: '🚀 MULAI PERTEMPURAN VR',
      x: 410,
      y: navY,
      w: 550,
      h: 52,
      variant: 'primary',
    });
  }

  private drawTutorialBoard(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillText('CARA BERMAIN VR', CANVAS_W / 2, 74);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('Tangan Kanan: Bidik & Tembak (Trigger) · Tangan Kiri: Jam Status & Gerak', CANVAS_W / 2, 126);

    // Ringkasan 3 Stage Warna
    const stages = [
      { title: 'STAGE 1 · PRIMER', colors: getColorsByCategory('primer') },
      { title: 'STAGE 2 · SEKUNDER', colors: getColorsByCategory('sekunder') },
      { title: 'STAGE 3 · TERSIER + BOSS', colors: getColorsByCategory('tersier') },
    ];

    stages.forEach((st, idx) => {
      const y = 172 + idx * 98;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(80, y, CANVAS_W - 160, 82);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText(st.title, 108, y + 48);

      st.colors.slice(0, 6).forEach((col, cIdx) => {
        const cx = 560 + cIdx * 56;
        ctx.fillStyle = col.hex;
        ctx.fillRect(cx, y + 21, 40, 40);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, y + 21, 40, 40);
      });
    });

    this.drawButton(ctx, {
      id: 'close_subpanel',
      label: 'KEMBALI',
      x: 160,
      y: 516,
      w: 320,
      h: 66,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'start_mission',
      label: 'MULAI MISI',
      x: 544,
      y: 516,
      w: 320,
      h: 66,
      variant: 'primary',
    });
  }

  private drawSettingsBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const speedInfo = resolveSpeedSettings(state.settings);
    const audioInfo = resolveAudioSettings(state.settings);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = '900 34px system-ui, sans-serif';
    ctx.fillText('PENGATURAN VR', CANVAS_W / 2, 62);

    // Baris Preset Kecepatan: LAMBAT | NORMAL | CEPAT | KUSTOM
    const presetRowW = 860;
    const presetRowX = (CANVAS_W - presetRowW) / 2;
    const presetGap = 12;
    const presetBtnW = (presetRowW - presetGap * 3) / 4;
    const presets: { id: VRMenuAction; key: string; label: string }[] = [
      { id: 'speed_slow', key: 'slow', label: 'LAMBAT 40%' },
      { id: 'speed_normal', key: 'normal', label: 'NORMAL 70%' },
      { id: 'speed_fast', key: 'fast', label: 'CEPAT 100%' },
      { id: 'speed_custom', key: 'custom', label: 'KUSTOM' },
    ];
    presets.forEach((p, idx) => {
      this.drawButton(ctx, {
        id: p.id,
        label: p.label,
        x: presetRowX + idx * (presetBtnW + presetGap),
        y: 92,
        w: presetBtnW,
        h: 48,
        variant: speedInfo.preset === p.key ? 'primary' : 'secondary',
      });
    });

    // Baris Stepper Kustom (per 10%): JALAN & KAMERA
    const stepperY = 152;
    const stepperH = 48;
    const stepBtnW = 84;
    const halfW = 418;
    const leftX = presetRowX;
    const rightX = presetRowX + presetRowW - halfW;

    this.drawButton(ctx, {
      id: 'move_speed_down',
      label: '-10%',
      x: leftX,
      y: stepperY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `JALAN: ${speedInfo.moveSpeedPercent}%`,
      leftX + halfW / 2,
      stepperY + 31
    );
    this.drawButton(ctx, {
      id: 'move_speed_up',
      label: '+10%',
      x: leftX + halfW - stepBtnW,
      y: stepperY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'cam_speed_down',
      label: '-10%',
      x: rightX,
      y: stepperY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `KAMERA: ${speedInfo.cameraSpeedPercent}%`,
      rightX + halfW / 2,
      stepperY + 31
    );
    this.drawButton(ctx, {
      id: 'cam_speed_up',
      label: '+10%',
      x: rightX + halfW - stepBtnW,
      y: stepperY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });

    // Baris Stepper Volume Audio (per 10%): MUSIK BGM & EFEK SFX
    const audioY = 212;
    this.drawButton(ctx, {
      id: 'bgm_vol_down',
      label: '-10%',
      x: leftX,
      y: audioY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });
    ctx.fillStyle = state.isMuted ? '#64748b' : '#22d3ee';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      state.isMuted ? 'BGM: MATI' : `BGM: ${audioInfo.bgmVolumePercent}%`,
      leftX + halfW / 2,
      audioY + 31
    );
    this.drawButton(ctx, {
      id: 'bgm_vol_up',
      label: '+10%',
      x: leftX + halfW - stepBtnW,
      y: audioY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'sfx_vol_down',
      label: '-10%',
      x: rightX,
      y: audioY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });
    ctx.fillStyle = state.isMuted ? '#64748b' : '#22d3ee';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      state.isMuted ? 'EFEK: MATI' : `EFEK: ${audioInfo.sfxVolumePercent}%`,
      rightX + halfW / 2,
      audioY + 31
    );
    this.drawButton(ctx, {
      id: 'sfx_vol_up',
      label: '+10%',
      x: rightX + halfW - stepBtnW,
      y: audioY,
      w: stepBtnW,
      h: stepperH,
      variant: 'secondary',
    });

    const bw = 560;
    const bx = (CANVAS_W - bw) / 2;

    this.drawButton(ctx, {
      id: 'toggle_vr_turn',
      label: state.isHandTracking
        ? 'PUTARAN VR: SNAP (TANGAN KOSONG)'
        : `PUTARAN VR: ${state.settings.vrTurnMode === 'snap' ? 'SNAP' : 'HALUS'}`,
      x: bx,
      y: 274,
      w: bw,
      h: 48,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'toggle_vr_move',
      label: `GERAK VR: ${state.settings.vrMovementMode === 'teleport' ? 'TELEPORT' : 'HALUS'}`,
      x: bx,
      y: 334,
      w: bw,
      h: 48,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'toggle_vr_vignette',
      label: `VIGNETTE KENYAMANAN: ${state.settings.vrComfortVignette ? 'AKTIF' : 'MATI'}`,
      x: bx,
      y: 394,
      w: bw,
      h: 48,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'toggle_mute',
      label: `SUARA GAME: ${state.isMuted ? 'MATI' : 'AKTIF'}`,
      x: bx,
      y: 454,
      w: bw,
      h: 48,
      variant: 'secondary',
    });

    this.drawButton(ctx, {
      id: 'close_subpanel',
      label: 'SIMPAN & KEMBALI',
      x: bx,
      y: 522,
      w: bw,
      h: 64,
      variant: 'primary',
    });
  }

  private drawStageTransitionBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    ctx.textAlign = 'center';
    if (state.stageTransitionMode === 'stage_clear') {
      const nextNum = state.stageNumber + 1;
      ctx.fillStyle = '#34d399';
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.fillText(`STAGE ${state.stageNumber} BERHASIL!`, CANVAS_W / 2, 130);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillText(
        `Skor Stage: ${state.stageScore.toLocaleString('id-ID')}  ·  Bonus: +${state.stageBonus.toLocaleString('id-ID')}`,
        CANVAS_W / 2,
        210
      );

      this.drawButton(ctx, {
        id: 'continue_stage',
        label: `LANJUT KE STAGE ${nextNum}`,
        x: 262,
        y: 440,
        w: 500,
        h: 80,
        variant: 'primary',
      });
      return;
    }

    const stageDef = STAGE_DEFINITIONS[state.stageNumber];
    const colors = getColorsByCategory(stageDef.category);

    ctx.fillStyle = '#22d3ee';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(
      `STAGE ${state.stageNumber} · ${stageDef.targetEliminations} ELIMINASI${stageDef.hasBossAtEnd ? ' + BOSS' : ''}`,
      CANVAS_W / 2,
      100
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillText(stageDef.subtitle.toUpperCase(), CANVAS_W / 2, 168);

    // Swatch warna stage
    const count = colors.length;
    const size = 64;
    const gap = 22;
    const totalW = count * size + (count - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    colors.forEach((col, i) => {
      const x = startX + i * (size + gap);
      ctx.fillStyle = col.hex;
      ctx.fillRect(x, 240, size, size);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, 240, size, size);
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText('Lihat Target Warna di Jam Tangan Kiri saat bertempur.', CANVAS_W / 2, 360);

    this.drawButton(ctx, {
      id: 'continue_stage',
      label: `MULAI STAGE ${state.stageNumber}`,
      x: 262,
      y: 446,
      w: 500,
      h: 80,
      variant: 'primary',
    });
  }

  private drawPauseBoard(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.fillText('JEDA PERMAINAN', CANVAS_W / 2, 110);

    const bw = 460;
    const bx = (CANVAS_W - bw) / 2;

    this.drawButton(ctx, {
      id: 'resume',
      label: 'LANJUTKAN',
      x: bx,
      y: 184,
      w: bw,
      h: 74,
      variant: 'primary',
    });
    this.drawButton(ctx, {
      id: 'restart',
      label: 'ULANGI MISI',
      x: bx,
      y: 278,
      w: bw,
      h: 64,
      variant: 'secondary',
    });
    this.drawButton(ctx, {
      id: 'open_settings',
      label: 'PENGATURAN VR',
      x: bx,
      y: 360,
      w: bw,
      h: 64,
      variant: 'secondary',
    });
    this.drawButton(ctx, {
      id: 'return_menu',
      label: 'MENU UTAMA',
      x: bx,
      y: 448,
      w: bw,
      h: 64,
      variant: 'danger',
    });
  }

  private drawEndBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const isVictory = state.gameState === 'victory';
    ctx.textAlign = 'center';
    ctx.fillStyle = isVictory ? '#34d399' : '#fb7185';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.fillText(isVictory ? 'MISI SELESAI!' : 'MISI GAGAL', CANVAS_W / 2, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillText(`SKOR: ${state.score.toLocaleString('id-ID')}`, CANVAS_W / 2, 200);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(
      `Stage Selesai: ${state.summary.stagesCleared}/3  ·  Akurasi: ${state.summary.accuracy}%`,
      CANVAS_W / 2,
      258
    );

    const bw = 460;
    const bx = (CANVAS_W - bw) / 2;

    if (isVictory) {
      this.drawButton(ctx, {
        id: 'open_lkpd',
        label: 'BUKA LKPD EVALUASI (KELUAR VR)',
        x: bx,
        y: 308,
        w: bw,
        h: 70,
        variant: 'primary',
      });
      this.drawButton(ctx, {
        id: 'restart',
        label: 'MAIN LAGI',
        x: bx,
        y: 396,
        w: bw,
        h: 64,
        variant: 'secondary',
      });
      this.drawButton(ctx, {
        id: 'return_menu',
        label: 'MENU UTAMA',
        x: bx,
        y: 478,
        w: bw,
        h: 60,
        variant: 'secondary',
      });
    } else {
      this.drawButton(ctx, {
        id: 'restart',
        label: 'COBA LAGI',
        x: bx,
        y: 344,
        w: bw,
        h: 74,
        variant: 'primary',
      });
      this.drawButton(ctx, {
        id: 'return_menu',
        label: 'MENU UTAMA',
        x: bx,
        y: 440,
        w: bw,
        h: 68,
        variant: 'secondary',
      });
    }
  }

  public dispose() {
    this.panelMesh.geometry.dispose();
    (this.panelMesh.material as THREE.Material).dispose();
    this.frameMesh.geometry.dispose();
    (this.frameMesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}

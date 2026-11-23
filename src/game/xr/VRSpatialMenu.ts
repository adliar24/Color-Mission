import * as THREE from 'three';
import {
  CharacterId,
  DifficultyLevel,
  GameSettings,
  GameState,
  RunSummary,
  RYBColorId,
  resolveAudioSettings,
  resolveSpeedSettings,
} from '../types';
import {
  STAGE_DEFINITIONS,
  CHARACTER_REGISTRY,
  DIFFICULTY_REGISTRY,
  getColorsByCategory,
} from '../rules';
import {
  LKPD_LAB_INGREDIENTS,
  LKPD_LAB_CHALLENGES,
  LKPD_QUIZ_QUESTIONS,
  LKPD_REFLECTION_PROMPTS,
  LKPDScoreBreakdown,
  mixRYBColors,
} from '../lkpd';
import { getColorDef } from '../colors';

export type VRMenuAction =
  | 'start_mission'
  | 'cycle_character'
  | 'cycle_difficulty'
  | 'set_difficulty_easy'
  | 'set_difficulty_normal'
  | 'set_difficulty_hard'
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
  // In-Game VR LKPD Actions
  | 'vr_lkpd_open_lab'
  | 'vr_lkpd_open_quiz'
  | 'vr_lkpd_open_reflection'
  | 'vr_lkpd_open_result'
  | 'vr_lkpd_lab_select_slot_a'
  | 'vr_lkpd_lab_select_slot_b'
  | 'vr_lkpd_lab_mix'
  | 'vr_lkpd_lab_reset'
  | 'vr_lkpd_quiz_next'
  | 'vr_lkpd_quiz_prev'
  | 'vr_lkpd_submit'
  | 'vr_lkpd_exit'
  | `vr_lkpd_lab_pick_${string}`
  | `vr_lkpd_quiz_ans_${string}`
  | `vr_lkpd_reflection_select_${string}`
  | `vr_lkpd_quick_${string}`
  | `kb_${string}`;

interface MenuButtonRect {
  id: VRMenuAction;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  variant: 'primary' | 'secondary' | 'danger';
  fontSize?: number;
  radius?: number;
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

  // In-Game WebXR LKPD Evaluasi
  vrLkpdStep?: 'none' | 'lab' | 'quiz' | 'reflection' | 'result';
  vrLkpdLabSlotA?: RYBColorId | null;
  vrLkpdLabSlotB?: RYBColorId | null;
  vrLkpdLabActiveSlot?: 'a' | 'b';
  vrLkpdLabSolvedIds?: RYBColorId[];
  vrLkpdQuizIndex?: number;
  vrLkpdQuizAnswers?: Record<string, string>;
  vrLkpdReflectionAnswers?: Record<string, string>;
  vrLkpdActiveReflectionPrompt?: string;
  vrLkpdScore?: LKPDScoreBreakdown;
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
      // In-Game LKPD Signature
      lkpdStep: state.vrLkpdStep || 'none',
      lkpdSlotA: state.vrLkpdLabSlotA || '',
      lkpdSlotB: state.vrLkpdLabSlotB || '',
      lkpdActSlot: state.vrLkpdLabActiveSlot || 'a',
      lkpdSolved: (state.vrLkpdLabSolvedIds || []).join(','),
      lkpdQIdx: state.vrLkpdQuizIndex ?? 0,
      lkpdQAns: JSON.stringify(state.vrLkpdQuizAnswers || {}),
      lkpdRefAns: JSON.stringify(state.vrLkpdReflectionAnswers || {}),
      lkpdRefPrompt: state.vrLkpdActiveReflectionPrompt || 'ref_kesan',
      lkpdScore: state.vrLkpdScore ? state.vrLkpdScore.objectiveScore : 0,
    });
    if (sig === this.lastSignature || !this.ctx) return;
    this.lastSignature = sig;

    const ctx = this.ctx;
    this.buttons = [];
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const isMainMenu =
      state.gameState === 'title' &&
      (!state.vrSetupStep || state.vrSetupStep === 'none') &&
      !state.showSettings &&
      !state.showTutorial &&
      (!state.vrLkpdStep || state.vrLkpdStep === 'none');

    // Hanya gambar backdrop kanvas penuh untuk layar multi-kolom yang membutuhkan bidang lebar.
    // Pada Menu Utama VR, jangan gambar backdrop luar agar papan kartu tampil melayang tunggal (tidak dobel).
    if (!isMainMenu) {
      ctx.fillStyle = '#090d18';
      ctx.beginPath();
      ctx.roundRect(14, 14, CANVAS_W - 28, CANVAS_H - 28, 44);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    if (state.showSettings) {
      this.drawSettingsBoard(ctx, state);
    } else if (state.showTutorial) {
      this.drawTutorialBoard(ctx);
    } else if (state.vrLkpdStep && state.vrLkpdStep !== 'none') {
      if (state.vrLkpdStep === 'lab') {
        this.drawVRLkpdLabBoard(ctx, state);
      } else if (state.vrLkpdStep === 'quiz') {
        this.drawVRLkpdQuizBoard(ctx, state);
      } else if (state.vrLkpdStep === 'reflection') {
        this.drawVRLkpdReflectionBoard(ctx, state);
      } else if (state.vrLkpdStep === 'result') {
        this.drawVRLkpdResultBoard(ctx, state);
      }
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
    const radius = btn.radius ?? (btn.h < 36 ? Math.floor(btn.h / 2) : 22);
    const fontSize = btn.fontSize ?? (btn.h < 36 ? 12 : btn.h < 46 ? 16 : 20);

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

    ctx.font = `800 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, cx, cy);
    ctx.restore();
  }

  /**
   * Render input field teks VR yang mulus, stabil, dan bebas dari glitch hover.
   */
  private drawVRInputField(
    ctx: CanvasRenderingContext2D,
    config: {
      id: VRMenuAction;
      label: string;
      value: string;
      placeholder: string;
      badgeText: string;
      badgeVariant: 'cyan' | 'emerald' | 'slate';
      isActive: boolean;
      x: number;
      y: number;
      w: number;
      h: number;
    }
  ) {
    this.buttons.push({
      id: config.id,
      label: '',
      x: config.x,
      y: config.y,
      w: config.w,
      h: config.h,
      variant: 'secondary',
    });

    const isHover = this.hoveredId === config.id;
    const isFocused = config.isActive;
    const radius = 16;

    // Background input box
    ctx.fillStyle = isFocused ? '#0c1527' : isHover ? '#0f172a' : '#080d19';
    ctx.beginPath();
    ctx.roundRect(config.x, config.y, config.w, config.h, radius);
    ctx.fill();

    // Border with neon cyan glow if active / hover
    if (isFocused || isHover) {
      ctx.save();
      ctx.shadowColor = isFocused ? 'rgba(34, 211, 238, 0.75)' : 'rgba(34, 211, 238, 0.35)';
      ctx.shadowBlur = isFocused ? 18 : 10;
      ctx.beginPath();
      ctx.roundRect(config.x, config.y, config.w, config.h, radius);
      ctx.strokeStyle = isFocused ? '#22d3ee' : 'rgba(34, 211, 238, 0.6)';
      ctx.lineWidth = isFocused ? 3 : 2;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Top Label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = isFocused ? '#38bdf8' : isHover ? '#94a3b8' : '#64748b';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillText(config.label, config.x + 18, config.y + 22);

    // Top Right Pill Badge (WAJIB / ✔ TERISI / OPSIONAL)
    const badgeW = config.badgeVariant === 'emerald' ? 76 : config.badgeVariant === 'cyan' ? 56 : 74;
    const badgeH = 20;
    const badgeX = config.x + config.w - badgeW - 14;
    const badgeY = config.y + 8;
    ctx.fillStyle =
      config.badgeVariant === 'emerald'
        ? 'rgba(16, 185, 129, 0.16)'
        : config.badgeVariant === 'cyan'
          ? 'rgba(34, 211, 238, 0.16)'
          : 'rgba(100, 116, 139, 0.16)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.strokeStyle =
      config.badgeVariant === 'emerald'
        ? 'rgba(16, 185, 129, 0.5)'
        : config.badgeVariant === 'cyan'
          ? 'rgba(34, 211, 238, 0.5)'
          : 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle =
      config.badgeVariant === 'emerald'
        ? '#34d399'
        : config.badgeVariant === 'cyan'
          ? '#22d3ee'
          : '#94a3b8';
    ctx.fillText(config.badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

    // Text content
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    if (config.value) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(config.value + (isFocused ? '|' : ''), config.x + 18, config.y + 50);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillText(isFocused ? '| ' + config.placeholder : config.placeholder, config.x + 18, config.y + 50);
    }
  }

  /**
   * Main Menu VR persis 1:1 sesuai gambar referensi pengguna:
   * - Rounded Card gelap (#080d19)
   * - 3 titik warna primer RYB
   * - COLOR (putih) & MISSION (cyan)
   * - Tombol cyan pill ▶ MULAI MISI
   * - Segmented Difficulty pill (MUDAH | NORMAL | SULIT) dengan indikator aktif solid putih teks hitam
   * - Grid 2 kolom [ 📖 CARA MAIN ] & [ 🎚 PENGATURAN ]
   * - Card LKPD Evaluasi dengan icon gembok & badge status (TERKUNCI / TERBUKA)
   * - Tombol Keluar Mode VR diletakkan secara elegan di bawah kartu agar estetika kartu tetap bersih
   */
  private drawMainMenuBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const cardW = 470;
    const cardH = 496;
    const cardX = (CANVAS_W - cardW) / 2;
    const cardY = 32;
    const cardRadius = 30;

    // Latar belakang kartu gelap
    ctx.fillStyle = '#080d19';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Border kartu halus
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 1. Tiga titik rounded RYB di bagian atas (Merah, Kuning, Biru)
    const dots = ['#ef4444', '#facc15', '#3b82f6'];
    const dotW = 28;
    const dotH = 20;
    const dotGap = 12;
    const totalDotsW = dots.length * dotW + (dots.length - 1) * dotGap;
    const dotStartX = cardX + (cardW - totalDotsW) / 2;
    const dotY = cardY + 28;

    dots.forEach((hex, idx) => {
      const dx = dotStartX + idx * (dotW + dotGap);
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.roundRect(dx, dotY, dotW, dotH, 7);
      ctx.fill();
    });

    // 2. Logo / Judul: COLOR (Putih) & MISSION (Cyan)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 48px Inter, system-ui, -apple-system, sans-serif';

    // Baris 1: COLOR
    ctx.fillStyle = '#ffffff';
    ctx.fillText('COLOR', CANVAS_W / 2, cardY + 102);

    // Baris 2: MISSION
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('MISSION', CANVAS_W / 2, cardY + 152);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('Kuasai Warna. Selesaikan Misi.', CANVAS_W / 2, cardY + 184);

    const innerW = 400;
    const innerX = cardX + (cardW - innerW) / 2;

    // 3. Tombol Utama Cyan: ▶ MULAI MISI
    this.drawButton(ctx, {
      id: 'vr_setup_start',
      label: '▶  MULAI MISI',
      x: innerX,
      y: cardY + 208,
      w: innerW,
      h: 56,
      variant: 'primary',
      radius: 28,
    });

    // 4. Segmented Control Tingkat Kesulitan: MUDAH | NORMAL | SULIT
    const segH = 50;
    const segY = cardY + 278;
    const segRadius = 25;
    const currentDiff = state.settings.difficulty ?? 'normal';

    // Container Bar Segmented
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(innerX, segY, innerW, segH, segRadius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const segBtnW = (innerW - 12) / 3;
    const segDiffs: { id: VRMenuAction; key: DifficultyLevel; label: string }[] = [
      { id: 'set_difficulty_easy', key: 'easy', label: 'MUDAH' },
      { id: 'set_difficulty_normal', key: 'normal', label: 'NORMAL' },
      { id: 'set_difficulty_hard', key: 'hard', label: 'SULIT' },
    ];

    segDiffs.forEach((seg, idx) => {
      const sx = innerX + 6 + idx * segBtnW;
      const sy = segY + 4;
      const sh = segH - 8;
      const isActive = currentDiff === seg.key;
      const isHover = this.hoveredId === seg.id;

      this.buttons.push({
        id: seg.id,
        label: seg.label,
        x: sx,
        y: sy,
        w: segBtnW,
        h: sh,
        variant: 'secondary',
        radius: 20,
      });

      if (isActive) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(sx, sy, segBtnW, sh, 20);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = '900 15px Inter, system-ui, sans-serif';
      } else {
        if (isHover) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.roundRect(sx, sy, segBtnW, sh, 20);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = '#94a3b8';
        }
        ctx.font = '700 15px Inter, system-ui, sans-serif';
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seg.label, sx + segBtnW / 2, sy + sh / 2);
    });

    // 5. Dua Kolom Tombol: [ 📖 CARA MAIN ] & [ 🎚 PENGATURAN ]
    const gridY = cardY + 342;
    const gridGap = 12;
    const gridBtnW = (innerW - gridGap) / 2;
    const gridH = 50;

    this.drawButton(ctx, {
      id: 'open_tutorial',
      label: '📖 CARA MAIN',
      x: innerX,
      y: gridY,
      w: gridBtnW,
      h: gridH,
      variant: 'secondary',
      radius: 18,
    });

    this.drawButton(ctx, {
      id: 'open_settings',
      label: '🎚 PENGATURAN',
      x: innerX + gridBtnW + gridGap,
      y: gridY,
      w: gridBtnW,
      h: gridH,
      variant: 'secondary',
      radius: 18,
    });

    // 6. Kartu LKPD Evaluasi (Gembok di kiri + Badge Status di kanan)
    const lkpdY = cardY + 406;
    const lkpdH = 54;
    const isLkpdUnlocked = Boolean(state.lkpdUnlocked);
    const isLkpdHover = this.hoveredId === 'open_lkpd';

    this.buttons.push({
      id: 'open_lkpd',
      label: '',
      x: innerX,
      y: lkpdY,
      w: innerW,
      h: lkpdH,
      variant: 'secondary',
      radius: 18,
    });

    ctx.fillStyle = isLkpdHover ? '#131e36' : '#111827';
    ctx.beginPath();
    ctx.roundRect(innerX, lkpdY, innerW, lkpdH, 18);
    ctx.fill();
    ctx.strokeStyle = isLkpdHover ? 'rgba(34, 211, 238, 0.6)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Label LKPD di kiri
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🔒  LKPD EVALUASI', innerX + 20, lkpdY + lkpdH / 2);

    // Badge Pill di kanan (TERKUNCI / TERBUKA)
    const badgeW = 96;
    const badgeH = 26;
    const badgeX = innerX + innerW - badgeW - 14;
    const badgeY = lkpdY + (lkpdH - badgeH) / 2;

    ctx.fillStyle = isLkpdUnlocked ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 13);
    ctx.fill();
    ctx.strokeStyle = isLkpdUnlocked ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '800 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = isLkpdUnlocked ? '#34d399' : '#f59e0b';
    ctx.fillText(isLkpdUnlocked ? 'TERBUKA' : 'TERKUNCI', badgeX + badgeW / 2, badgeY + badgeH / 2);

    // 7. Tombol Keluar VR di bawah kartu secara rapi & proporsional
    const exitW = 240;
    const exitX = (CANVAS_W - exitW) / 2;
    const exitY = cardY + cardH + 20;
    this.drawButton(ctx, {
      id: 'exit_vr',
      label: '✕  KELUAR MODE VR',
      x: exitX,
      y: exitY,
      w: exitW,
      h: 38,
      variant: 'secondary',
      fontSize: 13,
      radius: 19,
    });

    // Banner Pesan Peringatan jika LKPD belum terbuka (melayang di bawah kartu)
    if (state.vrWarningMsg) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.beginPath();
      ctx.roundRect(cardX + 20, cardY + cardH - 60, cardW - 40, 42, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#fde68a';
      ctx.font = '700 14px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.vrWarningMsg, CANVAS_W / 2, cardY + cardH - 39);
    }
  }

  /**
   * Papan Setup Misi Langkah 1: Input Identitas Siswa + Virtual Keyboard QWERTY 3D di VR
   * (Diperbarui dengan drawVRInputField agar raycast hover mulus & teks tidak tertutup)
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
    this.drawVRInputField(ctx, {
      id: 'vr_setup_select_name_input',
      label: 'NAMA SISWA',
      value: studentName,
      placeholder: 'Ketik nama siswa...',
      badgeText: isNameValid ? '✔ TERISI' : 'WAJIB',
      badgeVariant: isNameValid ? 'emerald' : 'cyan',
      isActive: activeField === 'name',
      x: 64,
      y: 140,
      w: 560,
      h: 64,
    });

    // Input Field 2: KELAS (OPSIONAL)
    this.drawVRInputField(ctx, {
      id: 'vr_setup_select_class_input',
      label: 'KELAS',
      value: studentClass,
      placeholder: 'Contoh: 7A / 8B...',
      badgeText: 'OPSIONAL',
      badgeVariant: 'slate',
      isActive: activeField === 'class',
      x: 640,
      y: 140,
      w: 320,
      h: 64,
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
          fontSize: 18,
          radius: 12,
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
      fontSize: 15,
      radius: 12,
    });

    this.drawButton(ctx, {
      id: 'kb_backspace',
      label: '⌫ HAPUS',
      x: actStartX + spaceW + actGap,
      y: actY,
      w: bsW,
      h: rowHeight,
      variant: 'secondary',
      fontSize: 15,
      radius: 12,
    });

    this.drawButton(ctx, {
      id: 'kb_clear',
      label: 'BERSIHKAN',
      x: actStartX + spaceW + actGap + bsW + actGap,
      y: actY,
      w: clrW,
      h: rowHeight,
      variant: 'secondary',
      fontSize: 15,
      radius: 12,
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
      fontSize: 15,
      radius: 16,
    });

    this.drawButton(ctx, {
      id: 'vr_setup_next_to_character',
      label: isNameValid ? 'LANJUT KE PILIH KARAKTER ➔' : 'NAMA WAJIB DIISI (MIN. 2 HURUF)',
      x: 280,
      y: navY,
      w: 680,
      h: 52,
      variant: isNameValid ? 'primary' : 'secondary',
      fontSize: 16,
      radius: 16,
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

  /**
   * Papan Evaluasi LKPD Langkah 1: Laboratorium Campur Warna di VR
   */
  private drawVRLkpdLabBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    // Header Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect((CANVAS_W - 240) / 2, 28, 240, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#f0f9ff';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LKPD TAHAP 1 DARI 3 · LAB WARNA', CANVAS_W / 2, 47);

    // Title & Subtitle
    ctx.font = '900 32px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LABORATORIUM CAMPUR WARNA (VR)', CANVAS_W / 2, 88);

    ctx.font = '500 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Pilih 2 tabung warna di kanan lalu tekan CAMPUR untuk menguji teori!', CANVAS_W / 2, 114);

    const slotA = state.vrLkpdLabSlotA;
    const slotB = state.vrLkpdLabSlotB;
    const activeSlot = state.vrLkpdLabActiveSlot || 'a';
    const solvedIds = new Set(state.vrLkpdLabSolvedIds || []);

    // === PANEL KIRI: MEJA PENCAMPURAN (MIXING BENCH) ===
    const benchX = 54;
    const benchY = 132;
    const benchW = 430;
    const benchH = 412;
    const benchRadius = 22;

    ctx.fillStyle = 'rgba(11, 18, 32, 0.94)';
    ctx.beginPath();
    ctx.roundRect(benchX, benchY, benchW, benchH, benchRadius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label Meja
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.fillText('MEJA CAMPUR WARNA', benchX + 22, benchY + 28);

    // Slot 1 (Wadah 1)
    const slotW = 168;
    const slotH = 74;
    const slot1X = benchX + 20;
    const slot1Y = benchY + 42;
    const isSlot1Active = activeSlot === 'a';

    this.buttons.push({
      id: 'vr_lkpd_lab_select_slot_a',
      label: '',
      x: slot1X,
      y: slot1Y,
      w: slotW,
      h: slotH,
      variant: 'secondary',
    });

    ctx.fillStyle = isSlot1Active ? '#0f172a' : '#080e1a';
    ctx.beginPath();
    ctx.roundRect(slot1X, slot1Y, slotW, slotH, 14);
    ctx.fill();
    ctx.strokeStyle = isSlot1Active ? '#22d3ee' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = isSlot1Active ? 3 : 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = isSlot1Active ? '#38bdf8' : '#64748b';
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.fillText('WADAH 1 ' + (isSlot1Active ? '(AKTIF)' : ''), slot1X + slotW / 2, slot1Y + 18);

    const swatchSize = 40;
    const swatch1X = slot1X + (slotW - swatchSize) / 2;
    const swatch1Y = slot1Y + 24;

    if (slotA) {
      const defA = getColorDef(slotA);
      ctx.fillStyle = defA.hex;
      ctx.beginPath();
      ctx.roundRect(swatch1X, swatch1Y, swatchSize, swatchSize, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(swatch1X, swatch1Y, swatchSize, swatchSize, 10);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = '900 18px Inter, system-ui, sans-serif';
      ctx.fillText('?', slot1X + slotW / 2, slot1Y + 50);
    }

    // Tanda Plus (+)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '900 24px Inter, system-ui, sans-serif';
    ctx.fillText('+', benchX + 203, slot1Y + 44);

    // Slot 2 (Wadah 2)
    const slot2X = benchX + 222;
    const slot2Y = slot1Y;
    const isSlot2Active = activeSlot === 'b';

    this.buttons.push({
      id: 'vr_lkpd_lab_select_slot_b',
      label: '',
      x: slot2X,
      y: slot2Y,
      w: slotW,
      h: slotH,
      variant: 'secondary',
    });

    ctx.fillStyle = isSlot2Active ? '#0f172a' : '#080e1a';
    ctx.beginPath();
    ctx.roundRect(slot2X, slot2Y, slotW, slotH, 14);
    ctx.fill();
    ctx.strokeStyle = isSlot2Active ? '#22d3ee' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = isSlot2Active ? 3 : 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = isSlot2Active ? '#38bdf8' : '#64748b';
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.fillText('WADAH 2 ' + (isSlot2Active ? '(AKTIF)' : ''), slot2X + slotW / 2, slot2Y + 18);

    const swatch2X = slot2X + (slotW - swatchSize) / 2;
    const swatch2Y = slot2Y + 24;

    if (slotB) {
      const defB = getColorDef(slotB);
      ctx.fillStyle = defB.hex;
      ctx.beginPath();
      ctx.roundRect(swatch2X, swatch2Y, swatchSize, swatchSize, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(swatch2X, swatch2Y, swatchSize, swatchSize, 10);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = '900 18px Inter, system-ui, sans-serif';
      ctx.fillText('?', slot2X + slotW / 2, slot2Y + 50);
    }

    // Tombol Campur & Reset
    const btnY = benchY + 128;
    this.drawButton(ctx, {
      id: 'vr_lkpd_lab_mix',
      label: '🧪 CAMPUR WARNA',
      x: benchX + 20,
      y: btnY,
      w: 248,
      h: 48,
      variant: 'primary',
    });

    this.drawButton(ctx, {
      id: 'vr_lkpd_lab_reset',
      label: '↺ RESET',
      x: benchX + 280,
      y: btnY,
      w: 130,
      h: 48,
      variant: 'secondary',
    });

    // Kotak Hasil Campuran
    const resY = benchY + 190;
    const resH = 200;
    const resW = benchW - 40;
    const resX = benchX + 20;

    const mixedDef = slotA && slotB ? mixRYBColors(slotA, slotB) : null;

    ctx.fillStyle = '#080e1a';
    ctx.beginPath();
    ctx.roundRect(resX, resY, resW, resH, 16);
    ctx.fill();
    ctx.strokeStyle = mixedDef ? 'rgba(34, 211, 238, 0.45)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (mixedDef) {
      // Swatch besar visual
      ctx.fillStyle = mixedDef.hex;
      ctx.beginPath();
      ctx.roundRect(resX + 24, resY + 24, 72, 72, 14);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Keterangan Kategori & Status (tanpa teks nama warna)
      ctx.textAlign = 'left';
      ctx.fillStyle = '#22d3ee';
      ctx.font = '900 20px Inter, system-ui, sans-serif';
      ctx.fillText('HASIL CAMPURAN', resX + 112, resY + 52);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 14px Inter, system-ui, sans-serif';
      const catLabel =
        mixedDef.category === 'primer'
          ? 'Kategori: Warna Primer'
          : mixedDef.category === 'sekunder'
            ? 'Kategori: Warna Sekunder'
            : 'Kategori: Warna Tersier';
      ctx.fillText(catLabel, resX + 112, resY + 78);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.fillText('✔ Hasil pencampuran terverifikasi!', resX + 24, resY + 140);
    } else {
      // Swatch kosong
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(resX + 24, resY + 24, 72, 72, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '900 26px Inter, system-ui, sans-serif';
      ctx.fillText('?', resX + 60, resY + 68);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.fillText('Pilih 2 kotak warna bahan di sebelah kanan,', resX + 112, resY + 54);
      ctx.fillText('lalu tekan tombol CAMPUR WARNA di atas.', resX + 112, resY + 76);
    }

    // === PANEL KANAN: PALET BAHAN & STATUS TANTANGAN ===
    const palX = 514;
    const palY = 132;
    const palW = 456;
    const palH = 412;
    const palRadius = 22;

    ctx.fillStyle = 'rgba(11, 18, 32, 0.94)';
    ctx.beginPath();
    ctx.roundRect(palX, palY, palW, palH, palRadius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Header Palet
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.fillText('KOTAK BAHAN WARNA (KLIK UNTUK MEMILIH)', palX + 22, palY + 28);

    // 6 Kotak Warna Bahan Visual (3 Primer + 3 Sekunder)
    const tubes = LKPD_LAB_INGREDIENTS;
    const tubeW = 128;
    const tubeH = 46;
    const tubeGapX = 14;
    const tubeGapY = 10;
    const tubeStartX = palX + 20;
    const tubeStartY = palY + 42;

    tubes.forEach((tId, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const tx = tubeStartX + col * (tubeW + tubeGapX);
      const ty = tubeStartY + row * (tubeH + tubeGapY);
      const def = getColorDef(tId);

      this.buttons.push({
        id: `vr_lkpd_lab_pick_${tId}` as VRMenuAction,
        label: '',
        x: tx,
        y: ty,
        w: tubeW,
        h: tubeH,
        variant: 'secondary',
      });

      const isHover = this.hoveredId === `vr_lkpd_lab_pick_${tId}`;
      ctx.fillStyle = isHover ? '#1e293b' : '#0f172a';
      ctx.beginPath();
      ctx.roundRect(tx, ty, tubeW, tubeH, 12);
      ctx.fill();
      ctx.strokeStyle = isHover ? '#22d3ee' : 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = isHover ? 2.5 : 1.2;
      ctx.stroke();

      // Swatch Visual Penuh/Besar tanpa teks nama warna
      const swW = 60;
      const swH = 30;
      const swX = tx + (tubeW - swW) / 2;
      const swY = ty + (tubeH - swH) / 2;
      ctx.fillStyle = def.hex;
      ctx.beginPath();
      ctx.roundRect(swX, swY, swW, swH, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    });

    // Checklist Target Tantangan
    const chY = palY + 160;
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.fillText('TARGET TANTANGAN PENCAMPURAN (5):', palX + 22, chY);

    LKPD_LAB_CHALLENGES.forEach((ch, idx) => {
      const rowY = chY + 22 + idx * 42;
      const isSolved = solvedIds.has(ch.targetColorId);
      const targetDef = getColorDef(ch.targetColorId);

      ctx.fillStyle = isSolved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.roundRect(palX + 20, rowY, palW - 40, 36, 10);
      ctx.fill();
      ctx.strokeStyle = isSolved ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Swatch Target Visual
      ctx.fillStyle = targetDef.hex;
      ctx.beginPath();
      ctx.roundRect(palX + 28, rowY + 6, 30, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Label Misi & Kategori Target (Tanpa teks nama warna)
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.fillText(`Misi ${idx + 1} (${targetDef.categoryLabelId})`, palX + 68, rowY + 23);

      // Status Badge
      ctx.textAlign = 'right';
      ctx.fillStyle = isSolved ? '#34d399' : '#64748b';
      ctx.font = '800 12px Inter, system-ui, sans-serif';
      ctx.fillText(isSolved ? '✔ TERCAPAI' : '○ BELUM', palX + palW - 32, rowY + 23);
      ctx.textAlign = 'left';
    });

    // === BARIS NAVIGASI BAWAH ===
    const navY = 562;
    this.drawButton(ctx, {
      id: 'vr_lkpd_exit',
      label: '⬅ KEMBALI KE MENU',
      x: 54,
      y: navY,
      w: 260,
      h: 52,
      variant: 'secondary',
    });

    const solvedCount = state.vrLkpdLabSolvedIds?.length || 0;
    this.drawButton(ctx, {
      id: 'vr_lkpd_open_quiz',
      label: `LANJUT KE KUIS TEORI (${solvedCount}/5 SELESAI) ➔`,
      x: 334,
      y: navY,
      w: 636,
      h: 52,
      variant: 'primary',
    });
  }

  /**
   * Papan Evaluasi LKPD Langkah 2: Kuis Pemahaman Teori Warna di VR
   */
  private drawVRLkpdQuizBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const qIdx = state.vrLkpdQuizIndex ?? 0;
    const totalQ = LKPD_QUIZ_QUESTIONS.length;
    const q = LKPD_QUIZ_QUESTIONS[qIdx] || LKPD_QUIZ_QUESTIONS[0];
    const userAnswers = state.vrLkpdQuizAnswers || {};
    const selectedOptId = userAnswers[q.id];

    // Header Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect((CANVAS_W - 240) / 2, 28, 240, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#f0f9ff';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`LKPD TAHAP 2 DARI 3 · SOAL ${qIdx + 1}/${totalQ}`, CANVAS_W / 2, 47);

    // Title
    ctx.font = '900 32px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('KUIS PEMAHAMAN TEORI WARNA', CANVAS_W / 2, 88);

    // Kotak Pertanyaan
    const qBoxX = 54;
    const qBoxY = 114;
    const qBoxW = 916;
    const qBoxH = 104;

    ctx.fillStyle = 'rgba(11, 18, 32, 0.94)';
    ctx.beginPath();
    ctx.roundRect(qBoxX, qBoxY, qBoxW, qBoxH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.fillText(`PERTANYAAN ${qIdx + 1}:`, qBoxX + 24, qBoxY + 30);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.fillText(q.question, qBoxX + 24, qBoxY + 62);

    // Kotak Swatch Preview Pertanyaan jika ada
    if (q.previewColorIds && q.previewColorIds.length > 0) {
      q.previewColorIds.forEach((pCol, pIdx) => {
        const def = getColorDef(pCol as RYBColorId);
        const px = qBoxX + 24 + pIdx * 42;
        ctx.fillStyle = def.hex;
        ctx.beginPath();
        ctx.roundRect(px, qBoxY + 72, 32, 22, 6);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
    }

    // 4 Kartu Opsi Pilihan (Grid 2 Kolom x 2 Baris)
    const optW = 444;
    const optH = 76;
    const optGapX = 28;
    const optGapY = 16;
    const optStartX = 54;
    const optStartY = 236;

    q.options.forEach((opt, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ox = optStartX + col * (optW + optGapX);
      const oy = optStartY + row * (optH + optGapY);
      const isSelected = selectedOptId === opt.id;
      const isHover = this.hoveredId === `vr_lkpd_quiz_ans_${opt.id}`;

      this.buttons.push({
        id: `vr_lkpd_quiz_ans_${opt.id}` as VRMenuAction,
        label: '',
        x: ox,
        y: oy,
        w: optW,
        h: optH,
        variant: isSelected ? 'primary' : 'secondary',
      });

      ctx.fillStyle = isSelected ? '#0f243c' : isHover ? '#131e36' : '#080e1a';
      ctx.beginPath();
      ctx.roundRect(ox, oy, optW, optH, 16);
      ctx.fill();

      if (isSelected || isHover) {
        ctx.save();
        ctx.shadowColor = isSelected ? 'rgba(34, 211, 238, 0.7)' : 'rgba(34, 211, 238, 0.3)';
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.beginPath();
        ctx.roundRect(ox, oy, optW, optH, 16);
        ctx.strokeStyle = isSelected ? '#22d3ee' : 'rgba(34, 211, 238, 0.6)';
        ctx.lineWidth = isSelected ? 3 : 1.8;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Huruf Opsi [ A ]
      const optLetter = opt.id.toUpperCase();
      ctx.fillStyle = isSelected ? '#22d3ee' : '#64748b';
      ctx.beginPath();
      ctx.roundRect(ox + 16, oy + 18, 40, 40, 10);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#020617' : '#f8fafc';
      ctx.font = '900 18px Inter, system-ui, sans-serif';
      ctx.fillText(optLetter, ox + 36, oy + 38);

      // Label Opsi
      ctx.textAlign = 'left';
      ctx.fillStyle = isSelected ? '#f8fafc' : '#cbd5e1';
      ctx.font = '700 17px Inter, system-ui, sans-serif';
      ctx.fillText(opt.label, ox + 68, oy + 38);

      // Swatches Opsi jika ada
      if (opt.swatchHexes && opt.swatchHexes.length > 0) {
        opt.swatchHexes.forEach((hex, hIdx) => {
          const sx = ox + optW - 32 - hIdx * 28;
          ctx.fillStyle = hex;
          ctx.beginPath();
          ctx.roundRect(sx, oy + 26, 24, 24, 6);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        });
      }
    });

    // Indikator Titik Soal (Progress Dots 1-6)
    const dotY = 442;
    const dotSize = 16;
    const dotGap = 20;
    const totalDotsW = totalQ * dotSize + (totalQ - 1) * dotGap;
    const dotStartX = (CANVAS_W - totalDotsW) / 2;

    for (let i = 0; i < totalQ; i++) {
      const qItem = LKPD_QUIZ_QUESTIONS[i];
      const isAnswered = Boolean(userAnswers[qItem.id]);
      const isCurrent = i === qIdx;
      const dx = dotStartX + i * (dotSize + dotGap);

      ctx.fillStyle = isCurrent ? '#22d3ee' : isAnswered ? '#10b981' : '#334155';
      ctx.beginPath();
      ctx.roundRect(dx, dotY, dotSize, dotSize, 8);
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // === BARIS NAVIGASI BAWAH ===
    const navY = 562;
    if (qIdx === 0) {
      this.drawButton(ctx, {
        id: 'vr_lkpd_open_lab',
        label: '⬅ KEMBALI KE LAB',
        x: 54,
        y: navY,
        w: 260,
        h: 52,
        variant: 'secondary',
      });
    } else {
      this.drawButton(ctx, {
        id: 'vr_lkpd_quiz_prev',
        label: '⬅ SOAL SEBELUMNYA',
        x: 54,
        y: navY,
        w: 260,
        h: 52,
        variant: 'secondary',
      });
    }

    const isLastQ = qIdx === totalQ - 1;
    this.drawButton(ctx, {
      id: isLastQ ? 'vr_lkpd_open_reflection' : 'vr_lkpd_quiz_next',
      label: isLastQ ? 'LANJUT KE LEMBAR REFLEKSI ➔' : 'SOAL BERIKUTNYA ➔',
      x: 334,
      y: navY,
      w: 636,
      h: 52,
      variant: 'primary',
    });
  }

  /**
   * Papan Evaluasi LKPD Langkah 3: Lembar Refleksi & Analisis Siswa di VR
   */
  private drawVRLkpdReflectionBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const activePrompt = LKPD_REFLECTION_PROMPTS[0];
    const refAnswers = state.vrLkpdReflectionAnswers || {};
    const curAnswer = refAnswers[activePrompt.id] || refAnswers['ref_1_kategori'] || '';

    // Header Badge
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect((CANVAS_W - 240) / 2, 28, 240, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#f0f9ff';
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LKPD TAHAP 3 DARI 3 · REFLEKSI', CANVAS_W / 2, 47);

    // Title
    ctx.font = '900 32px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LEMBAR REFLEKSI & ANALISIS SISWA', CANVAS_W / 2, 88);

    // Box Pertanyaan Aktif (Tunggal & Jelas)
    const pBoxX = 54;
    const pBoxY = 106;
    const pBoxW = 916;
    const pBoxH = 50;

    ctx.fillStyle = '#0b1325';
    ctx.beginPath();
    ctx.roundRect(pBoxX, pBoxY, pBoxW, pBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Badge REFLEKSI SISWA
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.beginPath();
    ctx.roundRect(pBoxX + 12, pBoxY + 10, 116, 30, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.fillText('REFLEKSI SISWA', pBoxX + 70, pBoxY + 25);

    // Teks Pertanyaan
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 17px Inter, system-ui, sans-serif';
    ctx.fillText(activePrompt.question, pBoxX + 140, pBoxY + 25);

    // Box Input Respon Siswa
    const inBoxY = 168;
    const inBoxH = 68;
    ctx.fillStyle = '#080e1a';
    ctx.beginPath();
    ctx.roundRect(pBoxX, inBoxY, pBoxW, inBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pastikan teks jawaban tidak tembus kotak input jika panjang
    ctx.save();
    ctx.beginPath();
    ctx.rect(pBoxX + 12, inBoxY + 2, pBoxW - 24, inBoxH - 4);
    ctx.clip();

    ctx.textBaseline = 'middle';
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    if (curAnswer) {
      const answerDisplay = curAnswer + '|';
      const textW = ctx.measureText(answerDisplay).width;
      const maxW = pBoxW - 40;
      if (textW > maxW) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(answerDisplay, pBoxX + pBoxW - 20, inBoxY + inBoxH / 2);
      } else {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(answerDisplay, pBoxX + 20, inBoxY + inBoxH / 2);
      }
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.fillText('| ' + activePrompt.placeholder, pBoxX + 20, inBoxY + inBoxH / 2);
    }
    ctx.restore();

    // Chip Kata Kunci Cepat (1-Tap Suggestion Chips)
    const chips = [
      'Paham teori warna RYB',
      'Bisa campur warna primer & sekunder',
      'Menguasai strategi perlawanan boss',
      'Game sangat seru & edukatif',
    ];

    const chipY = 248;
    const chipH = 34;
    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SARAN CEPAT (1-KLIK):', pBoxX + 2, chipY + chipH / 2);

    const labelW = Math.ceil(ctx.measureText('SARAN CEPAT (1-KLIK):').width) + 14;
    let curChipX = pBoxX + labelW;
    const chipFontSize = 12;
    ctx.font = `700 ${chipFontSize}px Inter, system-ui, sans-serif`;

    chips.forEach((phrase) => {
      const cW = Math.ceil(ctx.measureText(phrase).width) + 24;
      this.drawButton(ctx, {
        id: `vr_lkpd_quick_${phrase}` as VRMenuAction,
        label: phrase,
        x: curChipX,
        y: chipY,
        w: cW,
        h: chipH,
        variant: 'secondary',
        fontSize: chipFontSize,
        radius: 16,
      });
      curChipX += cW + 10;
    });

    // Virtual Keyboard (QWERTY + Angka)
    const kbRows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
    ];

    const startY = 294;
    const rowHeight = 44;
    const rowGap = 6;

    kbRows.forEach((row, rIdx) => {
      const keyW = rIdx === 2 ? 82 : rIdx === 3 ? 86 : 78;
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
          fontSize: 17,
          radius: 10,
        });
      });
    });

    // Baris Aksi Keyboard (Spasi, Hapus, Bersihkan)
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
      fontSize: 15,
      radius: 12,
    });

    this.drawButton(ctx, {
      id: 'kb_backspace',
      label: '⌫ HAPUS',
      x: actStartX + spaceW + actGap,
      y: actY,
      w: bsW,
      h: rowHeight,
      variant: 'secondary',
      fontSize: 15,
      radius: 12,
    });

    this.drawButton(ctx, {
      id: 'kb_clear',
      label: 'BERSIHKAN',
      x: actStartX + spaceW + actGap + bsW + actGap,
      y: actY,
      w: clrW,
      h: rowHeight,
      variant: 'secondary',
      fontSize: 15,
      radius: 12,
    });

    // === BARIS NAVIGASI BAWAH ===
    const navY = 554;
    const navH = 52;
    this.drawButton(ctx, {
      id: 'vr_lkpd_open_quiz',
      label: '⬅ KEMBALI KE KUIS',
      x: 54,
      y: navY,
      w: 260,
      h: navH,
      variant: 'secondary',
      fontSize: 14,
      radius: 16,
    });

    this.drawButton(ctx, {
      id: 'vr_lkpd_submit',
      label: '🚀 KIRIM & SELESAIKAN EVALUASI LKPD',
      x: 330,
      y: navY,
      w: 640,
      h: navH,
      variant: 'primary',
      fontSize: 16,
      radius: 16,
    });
  }

  /**
   * Papan Evaluasi LKPD Langkah 4: Rekapitulasi Nilai & Konfirmasi Sinkronisasi Cloud
   */
  private drawVRLkpdResultBoard(ctx: CanvasRenderingContext2D, state: VRSpatialMenuState) {
    const cardW = 760;
    const cardH = 550;
    const cardX = (CANVAS_W - cardW) / 2;
    const cardY = 45;
    const cardRadius = 32;

    ctx.fillStyle = '#080d19';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = 'rgba(34, 211, 238, 0.4)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();
    ctx.restore();

    // Celebration Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 38px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText('🎉 EVALUASI LKPD SELESAI!', CANVAS_W / 2, cardY + 70);

    ctx.font = '600 16px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      `Agen: ${state.studentName || 'Siswa'}  ·  Kelas: ${state.studentClass || '-'}`,
      CANVAS_W / 2,
      cardY + 104
    );

    const score = state.vrLkpdScore ? state.vrLkpdScore.objectiveScore : 100;
    const predicate = state.vrLkpdScore ? state.vrLkpdScore.predicate : 'Sangat Baik';

    // Big Score Display Box
    const scoreBoxW = 440;
    const scoreBoxH = 100;
    const scoreBoxX = (CANVAS_W - scoreBoxW) / 2;
    const scoreBoxY = cardY + 128;

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#34d399';
    ctx.font = '900 44px Inter, system-ui, sans-serif';
    ctx.fillText(`NILAI: ${score}/100`, CANVAS_W / 2, scoreBoxY + 56);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 16px Inter, system-ui, sans-serif';
    ctx.fillText(`PREDIKAT: ${predicate.toUpperCase()}`, CANVAS_W / 2, scoreBoxY + 86);

    // 3 Metric Cards
    const labCorrect = state.vrLkpdScore ? state.vrLkpdScore.labCorrect : 5;
    const labTotal = state.vrLkpdScore ? state.vrLkpdScore.labTotal : 5;
    const quizCorrect = state.vrLkpdScore ? state.vrLkpdScore.quizCorrect : 6;
    const quizTotal = state.vrLkpdScore ? state.vrLkpdScore.quizTotal : 6;
    const refCount = state.vrLkpdScore ? state.vrLkpdScore.reflectionAnswered : 1;
    const refTotal = state.vrLkpdScore ? state.vrLkpdScore.reflectionTotal : 1;

    const metrics = [
      { label: 'LAB CAMPUR WARNA', val: `${labCorrect}/${labTotal} Selesai` },
      { label: 'KUIS TEORI', val: `${quizCorrect}/${quizTotal} Benar` },
      { label: 'REFLEKSI SISWA', val: `${refCount}/${refTotal} Terisi` },
    ];

    const mBoxW = 200;
    const mBoxH = 68;
    const mGap = 16;
    const mStartX = (CANVAS_W - (3 * mBoxW + 2 * mGap)) / 2;
    const mY = cardY + 246;

    metrics.forEach((m, idx) => {
      const mx = mStartX + idx * (mBoxW + mGap);
      ctx.fillStyle = '#0d1527';
      ctx.beginPath();
      ctx.roundRect(mx, mY, mBoxW, mBoxH, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      ctx.fillText(m.label, mx + mBoxW / 2, mY + 24);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 18px Inter, system-ui, sans-serif';
      ctx.fillText(m.val, mx + mBoxW / 2, mY + 52);
    });

    // Cloud Sync Badge
    const syncBoxW = 632;
    const syncBoxH = 46;
    const syncBoxX = (CANVAS_W - syncBoxW) / 2;
    const syncBoxY = cardY + 332;

    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.beginPath();
    ctx.roundRect(syncBoxX, syncBoxY, syncBoxW, syncBoxH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#34d399';
    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillText('☁️ Data otomatis tersinkronisasi ke Cloud Supabase & LocalStorage', CANVAS_W / 2, syncBoxY + syncBoxH / 2);

    // Tombol Selesai & Kembali
    this.drawButton(ctx, {
      id: 'vr_lkpd_exit',
      label: '✔ KEMBALI KE MENU UTAMA',
      x: (CANVAS_W - 440) / 2,
      y: cardY + 412,
      w: 440,
      h: 58,
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
        label: 'BUKA LKPD EVALUASI (VR)',
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

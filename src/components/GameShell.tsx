import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { CyberArena, JumpPad, HazardNode } from '../game/engine/cyberScene';
import { WeaponRig } from '../game/engine/weapons';
import { EnemyManager, EnemyInstance, resolveCircleXZCollision } from '../game/engine/enemies';
import { ParticleSystem } from '../game/engine/particles';
import { VisualShotSystem } from '../game/engine/tracers';
import { InputManager } from '../game/input/InputManager';
import { VRManager } from '../game/xr/VRManager';
import { VRWorldHUD } from '../game/xr/VRWorldHUD';
import { VRWristWatch } from '../game/xr/VRWristWatch';
import { VRSpatialMenu, VRMenuAction } from '../game/xr/VRSpatialMenu';
import { VRHandGestures } from '../game/xr/VRHandGestures';
import { PlayingHUD } from './PlayingHUD';
import { MobileTouchControls } from './MobileTouchControls';
import { TutorialModal } from './TutorialModal';
import { SettingsModal } from './SettingsModal';
import { StageTransitionModal } from './StageTransitionModal';
import { GameOverModal } from './GameOverModal';
import { VictoryModal } from './VictoryModal';
import { PauseModal } from './PauseModal';
import { LKPDModal } from './LKPDModal';
import { MissionSetupModal } from './MissionSetupModal';
import { AnimatedPresence } from './AnimatedPresence';
import { GamepadBadge } from './GamepadBadge';
import {
  GameCompletionProgress,
  loadGameCompletionProgress,
  saveGameCompletionProgress,
  loadLKPDSubmission,
  saveLKPDSubmission,
  calculateLKPDScore,
  LKPDSubmissionState,
  LKPDScoreBreakdown,
  LKPD_QUIZ_QUESTIONS,
  LKPD_DEFAULT_SCHOOL,
  LKPD_DEFAULT_TEACHER,
  mixRYBColors,
} from '../game/lkpd';
import {
  recordGameSessionAsync,
  recordInitialSessionStartAsync,
  recordLKPDSubmissionAsync,
} from '../lib/syncService';
import {
  PlayerStats,
  WeaponType,
  GameState,
  RunSummary,
  EnemyType,
  GameColorId,
  RYBColorId,
  ShotFeedback,
  GameSettings,
  GraphicsQuality,
  PlatformMode,
  CharacterId,
  DifficultyLevel,
  SPEED_PRESET_CONFIG,
  clampAudioPercent,
  clampSteppedSpeedPercent,
  resolveAudioSettings,
  resolveSpeedSettings,
} from '../game/types';
import {
  STAGE_DEFINITIONS,
  BOSS_PHASES,
  CHARACTER_REGISTRY,
  DIFFICULTY_REGISTRY,
  activateCharacterAbility,
  getEffectiveStageDef,
  getBossPhaseForHp,
  validateColorShot,
  validateBossCrystalShot,
  calculateEliminationScore,
  calculatePlayerDamage,
  calculateRunSummary,
  WEAPON_REGISTRY,
  getColorDef,
  selectNextTargetColor,
  buildColorInstructionClue,
  getUnlockedWeaponsForStage,
} from '../game/rules';
import { sound } from '../game/audio';
import {
  Play,
  BookOpen,
  Sliders,
  Maximize2,
  Minimize2,
  RotateCw,
  Lock,
  ClipboardCheck,
  AlertTriangle,
  X,
  Shield,
} from 'lucide-react';

interface GameShellProps {
  autostart?: boolean;
  onOpenAdmin?: () => void;
}

function getActiveUiBoard(): HTMLElement | null {
  const boards = Array.from(
    document.querySelectorAll<HTMLElement>('[data-ui-board="true"]')
  ).filter((el) => !el.closest('.ui-modal-closing'));
  return boards.length > 0 ? boards[boards.length - 1] : null;
}

function getBoardControls(board: HTMLElement): HTMLElement[] {
  return Array.from(
    board.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input[type="range"]:not(:disabled)'
    )
  ).filter((el) => el.offsetParent !== null);
}

function focusDefaultBoardControl(board: HTMLElement): void {
  const controls = getBoardControls(board);
  if (controls.length > 0 && !board.contains(document.activeElement)) {
    const defaultBtn =
      controls.find((el) => el.tagName === 'BUTTON' && el.className.includes('bg-cyan-400')) ||
      controls.find((el) => el.tagName === 'BUTTON') ||
      controls[0];
    defaultBtn?.focus();
  }
}

function moveBoardFocus(board: HTMLElement, step: 1 | -1): void {
  const controls = getBoardControls(board);
  if (controls.length === 0) return;
  const activeEl = document.activeElement as HTMLElement | null;
  const currentIdx = activeEl ? controls.indexOf(activeEl) : -1;
  const nextIdx =
    currentIdx === -1
      ? step > 0
        ? 0
        : controls.length - 1
      : (currentIdx + step + controls.length) % controls.length;
  const target = controls[nextIdx];
  if (target) {
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
  }
}

function adjustFocusedRange(rangeEl: HTMLInputElement, deltaSign: 1 | -1): void {
  const min = parseFloat(rangeEl.min || '0');
  const max = parseFloat(rangeEl.max || '100');
  const step = parseFloat(rangeEl.step || '1');
  const current = parseFloat(rangeEl.value || String(min));
  const decimals = (rangeEl.step.split('.')[1] || '').length;
  const next = Math.min(max, Math.max(min, Number((current + deltaSign * step).toFixed(decimals))));
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(rangeEl, String(next));
    rangeEl.dispatchEvent(new Event('input', { bubbles: true }));
    rangeEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function activateBoardControl(board: HTMLElement): void {
  const controls = getBoardControls(board);
  if (controls.length === 0) return;
  const activeEl = document.activeElement as HTMLElement | null;
  const isRangeInput =
    activeEl?.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'range';
  if (activeEl && activeEl.tagName === 'BUTTON' && board.contains(activeEl)) {
    activeEl.click();
  } else if (!isRangeInput) {
    const primaryBtn =
      controls.find((el) => el.tagName === 'BUTTON' && el.className.includes('bg-cyan-400')) ||
      controls.find((el) => el.tagName === 'BUTTON');
    primaryBtn?.click();
  }
}

const INITIAL_PLAYER_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  shield: 50,
  maxShield: 50,
  dataCores: 0,
  totalDataCoresCollected: 0,
  score: 0,
  combo: 0,
  bestCombo: 0,
  kills: 0,
  stageKills: 0,
  headshots: 0,
  shotsFired: 0,
  correctHits: 0,
  wrongHits: 0,
  stage: 1,
  lifestealPercent: 0,
  damageMult: 1.0,
  fireRateMult: 1.0,
  reloadTimeMult: 1.0,
  magSizeBonus: 0,
  moveSpeedMult: 1.0,
  dashCooldownMult: 1.0,
  overdriveDuration: 6.0,
  headshotBonusMult: 0,
};

const _scratchWishDir = new THREE.Vector3();
const _scratchForward = new THREE.Vector3();
const _scratchRight = new THREE.Vector3();
const _scratchWorldWish = new THREE.Vector3();
const _scratchRaycaster = new THREE.Raycaster();
const _scratchScreenCenter = new THREE.Vector2(0, 0);
const _scratchEnemyBox = new THREE.Box3();
const _scratchEnemyCenter = new THREE.Vector3();
const _scratchEnemySize = new THREE.Vector3();
const _scratchAimOrigin = new THREE.Vector3();
const _scratchAimDir = new THREE.Vector3();
const _scratchMuzzlePos = new THREE.Vector3();
const _scratchTargetPoint = new THREE.Vector3();
const _scratchHitPoint = new THREE.Vector3();
const _scratchShootDir = new THREE.Vector3();
const _scratchSpreadDir = new THREE.Vector3();
const _scratchPelletEnd = new THREE.Vector3();
const _scratchNodeBox = new THREE.Box3();
const _scratchCandidateDir = new THREE.Vector3();
const _scratchEnemyWorldPos = new THREE.Vector3();

function getPixelRatioForQuality(quality: GraphicsQuality): number {
  if (typeof window === 'undefined') return 1.0;
  const dpr = window.devicePixelRatio || 1;
  if (quality === 'low') return Math.min(dpr, 0.85);
  if (quality === 'medium') return Math.min(dpr, 1.0);
  return Math.min(dpr, 1.25);
}

function detectOptimalQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'high';
  const isMobile =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 1 ||
    window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  if (cores <= 2 || memory <= 2) {
    return 'low';
  }
  if (isMobile || cores <= 4 || memory <= 4) {
    return 'medium';
  }
  return 'high';
}

const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  mobileGyroEnabled: false,
  gyroSensitivity: 1.0,
  hapticsEnabled: true,
  keyboardCameraMode: true,
  graphicsQuality: detectOptimalQuality(),
  vrTurnMode: 'snap',
  vrSnapAngle: 45,
  vrSmoothTurnSpeed: 2.0,
  vrMovementMode: 'smooth',
  vrComfortVignette: true,
  speedPreset: 'normal',
  moveSpeedPercent: 70,
  cameraSpeedPercent: 70,
  bgmVolumePercent: 85,
  sfxVolumePercent: 65,
  difficulty: 'normal',
  characterId: 'raka',
};

export const GameShell: React.FC<GameShellProps> = ({ autostart = false, onOpenAdmin }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // State utama permainan
  const [gameState, setGameState] = useState<GameState>(autostart ? 'playing' : 'title');
  const [player, setPlayer] = useState<PlayerStats>(INITIAL_PLAYER_STATS);
  const [targetColorId, setTargetColorId] = useState<GameColorId>('red');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [wrongStreakOnTarget, setWrongStreakOnTarget] = useState<number>(0);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('laser_rifle');
  const [ammo, setAmmo] = useState<number>(WEAPON_REGISTRY.laser_rifle.magSize);
  const [bossHp, setBossHp] = useState<number | undefined>(undefined);
  const [bossMaxHp, setBossMaxHp] = useState<number>(1500);
  const [activeCrystalColorId, setActiveCrystalColorId] = useState<GameColorId | null>(null);
  const activeCrystalColorIdRef = useRef<GameColorId | null>(null);
  const [mobileFullscreenConfirmed, setMobileFullscreenConfirmed] = useState<boolean>(false);
  const [desktopFullscreenConfirmed, setDesktopFullscreenConfirmed] = useState<boolean>(false);
  const [mobileOrientation, setMobileOrientation] = useState<'landscape' | 'portrait'>(() =>
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth
      ? 'portrait'
      : 'landscape'
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Umpan balik & Modal
  const [shotFeedback, setShotFeedback] = useState<ShotFeedback | null>(null);
  const [stageModalMode, setStageModalMode] = useState<'stage_clear' | 'stage_intro'>('stage_intro');
  const [stageModalNumber, setStageModalNumber] = useState<1 | 2 | 3>(1);
  const [stageClearScore, setStageClearScore] = useState<number>(0);
  const stageStartScoreRef = useRef<number>(0);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showMissionSetup, setShowMissionSetup] = useState<boolean>(false);
  const [lkpdProgress, setLkpdProgress] = useState<GameCompletionProgress>(() =>
    loadGameCompletionProgress()
  );
  const [showLKPD, setShowLKPD] = useState<boolean>(false);
  const [showLKPDLockedAlert, setShowLKPDLockedAlert] = useState<boolean>(false);
  const [vrWarningMsg, setVrWarningMsg] = useState<string | null>(null);
  const vrWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hitmarkerActive, setHitmarkerActive] = useState<boolean>(false);
  const [hitmarkerCrit, setHitmarkerCrit] = useState<boolean>(false);
  const [hitmarkerWrong, setHitmarkerWrong] = useState<boolean>(false);
  const [playerDamageFlash, setPlayerDamageFlash] = useState<boolean>(false);
  const [isPlayerDying, setIsPlayerDying] = useState<boolean>(false);
  const isPlayerDyingRef = useRef<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.isMuted);
  const damageFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bossVictoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerDeathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mode Platform Otomatis (Desktop, Mobile, VR) & Gamepad — dideteksi sinkron sejak render pertama
  const inputManagerRef = useRef<InputManager>(new InputManager());
  const [platformMode, setPlatformMode] = useState<PlatformMode>(() =>
    inputManagerRef.current.detectInitialMode()
  );
  const [isGamepadConnected, setIsGamepadConnected] = useState<boolean>(false);
  const [vrComfortVignetteActive, setVrComfortVignetteActive] = useState<boolean>(false);
  const [isVRActive, setIsVRActive] = useState<boolean>(false);
  const [vrErrorMsg, setVrErrorMsg] = useState<string | null>(null);

  // In-Game Setup Identitas & Karakter di Mode 360° VR
  const [vrSetupStep, setVrSetupStep] = useState<'none' | 'identity' | 'character'>('none');
  const [vrStudentName, setVrStudentName] = useState<string>(() => {
    return loadLKPDSubmission().studentName || '';
  });
  const [vrStudentClass, setVrStudentClass] = useState<string>(() => {
    return loadLKPDSubmission().studentClass || '';
  });
  const [vrActiveInput, setVrActiveInput] = useState<'name' | 'class'>('name');
  const [vrSelectedChar, setVrSelectedChar] = useState<CharacterId>('raka');

  // In-Game WebXR LKPD Evaluasi di Mode 360° VR
  const [vrLkpdStep, setVrLkpdStep] = useState<'none' | 'lab' | 'quiz' | 'reflection' | 'result'>('none');
  const [vrLkpdLabSlotA, setVrLkpdLabSlotA] = useState<RYBColorId | null>(null);
  const [vrLkpdLabSlotB, setVrLkpdLabSlotB] = useState<RYBColorId | null>(null);
  const [vrLkpdLabActiveSlot, setVrLkpdLabActiveSlot] = useState<'a' | 'b'>('a');
  const [vrLkpdLabSolvedIds, setVrLkpdLabSolvedIds] = useState<RYBColorId[]>(() => {
    return loadLKPDSubmission().labSolvedIds || [];
  });
  const [vrLkpdQuizIndex, setVrLkpdQuizIndex] = useState<number>(0);
  const [vrLkpdQuizAnswers, setVrLkpdQuizAnswers] = useState<Record<string, string>>(() => {
    return loadLKPDSubmission().quizAnswers || {};
  });
  const [vrLkpdReflectionAnswers, setVrLkpdReflectionAnswers] = useState<Record<string, string>>(() => {
    return loadLKPDSubmission().reflectionAnswers || {};
  });
  const [vrLkpdActiveReflectionPrompt, setVrLkpdActiveReflectionPrompt] = useState<string>('ref_kesan');
  const [vrLkpdScore, setVrLkpdScore] = useState<LKPDScoreBreakdown | undefined>(() => {
    const sub = loadLKPDSubmission();
    return sub.completedAt ? calculateLKPDScore(sub) : undefined;
  });

  // Pengaturan yang disimpan di localStorage
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('color_mission_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch { }
    return DEFAULT_SETTINGS;
  });

  // Refs untuk Engine 3D dan Input Terpusat
  const sceneRef = useRef<THREE.Scene | null>(null);
  const playerRigRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const arenaRef = useRef<THREE.Scene | null | CyberArena>(null);
  const weaponsRef = useRef<WeaponRig | null>(null);
  const enemiesRef = useRef<EnemyManager | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const tracersRef = useRef<VisualShotSystem | null>(null);
  const vrManagerRef = useRef<VRManager | null>(null);
  const vrHudRef = useRef<VRWorldHUD | null>(null);

  // Refs simulasi fisika & progres (pitch & yaw 0 agar kamera 100% lurus sejajar horison)
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.7, 0));
  const playerVel = useRef<THREE.Vector3>(new THREE.Vector3());
  const cameraRot = useRef<{ pitch: number; yaw: number }>({ pitch: 0, yaw: 0 });
  const isGrounded = useRef<boolean>(true);
  const spawnTimer = useRef<number>(0);
  const ammoRef = useRef<number>(WEAPON_REGISTRY.laser_rifle.magSize);
  const runStartTime = useRef<number>(Date.now());
  const bossInstanceRef = useRef<EnemyInstance | null>(null);
  const bossDamageSinceSwitch = useRef<number>(0);
  const stageTransitionLock = useRef<boolean>(false);

  // Sinkronisasi state ke dalam ref untuk loop animasi
  const stateRef = useRef({
    gameState,
    player,
    targetColorId,
    currentWeapon,
    settings,
    platformMode,
    shotFeedback,
    bossHp,
    bossMaxHp,
    showTutorial,
    showSettings,
    showLKPD,
    showLKPDLockedAlert,
  });

  useEffect(() => {
    stateRef.current = {
      gameState,
      player,
      targetColorId,
      currentWeapon,
      settings,
      platformMode,
      shotFeedback,
      bossHp,
      bossMaxHp,
      showTutorial,
      showSettings,
      showLKPD,
      showLKPDLockedAlert,
    };
    document.body.dataset.state = gameState;
  }, [
    gameState,
    player,
    targetColorId,
    currentWeapon,
    settings,
    platformMode,
    shotFeedback,
    bossHp,
    bossMaxHp,
    showTutorial,
    showSettings,
    showLKPD,
    showLKPDLockedAlert,
  ]);

  const menuCallbacksRef = useRef<{
    startRun: () => void;
    returnToMenu: () => void;
    continueStage: () => void;
  }>({
    startRun: () => { },
    returnToMenu: () => { },
    continueStage: () => { },
  });

  const vrTriggerReleaseGuardRef = useRef<boolean>(false);
  const vrShootCooldownUntilRef = useRef<number>(0);

  const vrMenuInfoRef = useRef({
    stageModalMode,
    stageModalNumber,
    stageClearScore,
    runSummary,
    finalScore,
    isMuted,
    lkpdUnlocked: lkpdProgress.gameCompleted,
    vrWarningMsg,
    vrSetupStep,
    vrStudentName,
    vrStudentClass,
    vrActiveInput,
    vrSelectedChar,
    vrLkpdStep,
    vrLkpdLabSlotA,
    vrLkpdLabSlotB,
    vrLkpdLabActiveSlot,
    vrLkpdLabSolvedIds,
    vrLkpdQuizIndex,
    vrLkpdQuizAnswers,
    vrLkpdReflectionAnswers,
    vrLkpdActiveReflectionPrompt,
    vrLkpdScore,
  });

  useEffect(() => {
    vrMenuInfoRef.current = {
      stageModalMode,
      stageModalNumber,
      stageClearScore,
      runSummary,
      finalScore,
      isMuted,
      lkpdUnlocked: lkpdProgress.gameCompleted,
      vrWarningMsg,
      vrSetupStep,
      vrStudentName,
      vrStudentClass,
      vrActiveInput,
      vrSelectedChar,
      vrLkpdStep,
      vrLkpdLabSlotA,
      vrLkpdLabSlotB,
      vrLkpdLabActiveSlot,
      vrLkpdLabSolvedIds,
      vrLkpdQuizIndex,
      vrLkpdQuizAnswers,
      vrLkpdReflectionAnswers,
      vrLkpdActiveReflectionPrompt,
      vrLkpdScore,
    };
  }, [
    stageModalMode,
    stageModalNumber,
    stageClearScore,
    runSummary,
    finalScore,
    isMuted,
    lkpdProgress.gameCompleted,
    vrWarningMsg,
    vrSetupStep,
    vrStudentName,
    vrStudentClass,
    vrActiveInput,
    vrSelectedChar,
    vrLkpdStep,
    vrLkpdLabSlotA,
    vrLkpdLabSlotB,
    vrLkpdLabActiveSlot,
    vrLkpdLabSolvedIds,
    vrLkpdQuizIndex,
    vrLkpdQuizAnswers,
    vrLkpdReflectionAnswers,
    vrLkpdActiveReflectionPrompt,
    vrLkpdScore,
  ]);

  useEffect(() => {
    if ((gameState === 'victory' || gameState === 'gameover') && runSummary) {
      const saved = saveGameCompletionProgress(runSummary);
      setLkpdProgress(saved);
      recordGameSessionAsync(runSummary);
    }
  }, [gameState, runSummary]);

  useEffect(() => {
    try {
      localStorage.setItem('color_mission_settings', JSON.stringify(settings));
    } catch { }
    const audioInfo = resolveAudioSettings(settings);
    sound.setVolumes(audioInfo.bgmVolumePercent, audioInfo.sfxVolumePercent);
    if (rendererRef.current && !rendererRef.current.xr.isPresenting) {
      rendererRef.current.setPixelRatio(getPixelRatioForQuality(settings.graphicsQuality));
      rendererRef.current.shadowMap.enabled = settings.graphicsQuality === 'high';
      if (arenaRef.current && 'setGraphicsQuality' in arenaRef.current) {
        (arenaRef.current as CyberArena).setGraphicsQuality(settings.graphicsQuality);
      }
    }
  }, [settings]);

  const triggerShotBanner = useCallback((fb: ShotFeedback) => {
    setShotFeedback(fb);
  }, []);

  const handleTriggerAbility = useCallback(() => {
    const curState = stateRef.current;
    if (curState.gameState !== 'playing' || isPlayerDyingRef.current) return;
    const charId: CharacterId = curState.settings.characterId ?? curState.player.characterId ?? 'raka';
    const res = activateCharacterAbility(curState.player, charId);
    if (!res.activated) return;

    stateRef.current.player = res.updatedPlayer;
    setPlayer(res.updatedPlayer);
    sound.playOverdrive();
    inputManagerRef.current.triggerHaptic(
      'emp',
      curState.settings,
      vrManagerRef.current?.currentSession || null
    );
    particlesRef.current?.emit(
      playerPos.current.clone().setY(1.2),
      28,
      res.abilityProfile.accentHex,
      2.0
    );

    if (charId === 'raka') {
      triggerShotBanner({
        type: 'streak',
        title: 'PERISAI SUPER AKTIF!',
        subtitle: 'Kebal penuh selama 6 detik (0 damage ke HP & Shield)',
        colorHex: '#22d3ee',
        timestamp: performance.now(),
      });
    } else {
      triggerShotBanner({
        type: 'pickup',
        title: `RECOVERY +${res.healedAmount} HP!`,
        subtitle: 'Agen Rana memulihkan +20% Kesehatan Maksimum',
        colorHex: '#34d399',
        timestamp: performance.now(),
      });
    }
  }, [triggerShotBanner]);

  // Pastikan di arena selalu ada minimal 1 Chromabot dengan warna target aktif
  const ensureTargetColorPresentInArena = useCallback(
    (desiredTarget: GameColorId, stageNum: 1 | 2 | 3) => {
      const enemies = enemiesRef.current;
      if (!enemies) return;

      if (bossInstanceRef.current && bossInstanceRef.current.state !== 'dead') {
        if (bossInstanceRef.current.colorId !== desiredTarget) {
          enemies.setEnemyColor(bossInstanceRef.current, desiredTarget);
        }
        return;
      }

      const activeBots = enemies.enemies.filter(
        (e) => e.state !== 'dead' && e.type !== 'chroma_titan'
      );
      const hasMatchingBot = activeBots.some((e) => e.colorId === desiredTarget);

      if (!hasMatchingBot) {
        if (activeBots.length > 0) {
          enemies.setEnemyColor(activeBots[0], desiredTarget);
        } else {
          const stageDef = getEffectiveStageDef(
            stageNum,
            stateRef.current.settings.difficulty ?? 'normal'
          );
          const angle = Math.random() * Math.PI * 2;
          const radius = 20 + Math.random() * 4;
          const pos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
          const type: EnemyType =
            Math.random() < stageDef.eliteChance ? 'chromabot_elite' : 'chromabot_normal';
          enemies.spawnEnemy(
            type,
            desiredTarget,
            pos,
            stageDef.enemyHpMult,
            stageDef.enemySpeedMult
          );
        }
      }
    },
    []
  );

  // Pemrosesan hasil mengenai musuh (dengan dukungan penuh Color Mixing Challenge)
  const processEnemyHit = useCallback(
    (
      enemy: EnemyInstance,
      hitPoint: THREE.Vector3,
      baseDamage: number,
      isHeadshot: boolean,
      shotDir: THREE.Vector3
    ) => {
      const enemies = enemiesRef.current;
      const particles = particlesRef.current;
      if (!enemies || !particles) return;

      const currentTarget = stateRef.current.targetColorId;
      const pStats = stateRef.current.player;

      // === PENANGANAN KHUSUS BOSS CHROMA TITAN (WAJIB MENGGUNAKAN KRISTAL WARNA YANG SESUAI) ===
      if (enemy.type === 'chroma_titan') {
        const bossVal = validateBossCrystalShot(
          enemy.colorId,
          activeCrystalColorIdRef.current,
          baseDamage,
          isHeadshot,
          pStats.damageMult,
          pStats.headshotBonusMult
        );

        if (!bossVal.isCorrectCrystal) {
          // Tembakan tanpa kristal atau kristal salah warna -> TIDAK mengurangi darah Boss!
          enemies.triggerWrongColorFeedback(enemy);
          sound.playWrongColorHit();
          particles.emit(hitPoint, 12, '#f43f5e', 1.25);
          tracersRef.current?.addHitImpactEffect(hitPoint, '#f43f5e', false, true);
          inputManagerRef.current.triggerHaptic(
            'wrong',
            stateRef.current.settings,
            vrManagerRef.current?.currentSession || null
          );

          setHitmarkerActive(true);
          setHitmarkerWrong(true);
          setHitmarkerCrit(false);
          setTimeout(() => setHitmarkerActive(false), 120);

          if (bossVal.reason === 'no_crystal') {
            triggerShotBanner({
              type: 'wrong',
              title: 'AMBIL KRISTAL!',
              subtitle: 'Ambil kristal warna yang sesuai di arena untuk melukai Boss',
              colorHex: '#f43f5e',
              timestamp: performance.now(),
            });
          } else {
            triggerShotBanner({
              type: 'wrong',
              title: 'KRISTAL SALAH!',
              subtitle: 'Warna laser tidak sesuai dengan warna Boss · Kombo Terputus',
              colorHex: '#f43f5e',
              timestamp: performance.now(),
            });
            setPlayer((prev) => ({
              ...prev,
              combo: 0,
              wrongHits: prev.wrongHits + 1,
            }));
          }
          return;
        }

        // Kristal warna sesuai dengan warna Boss -> kurangi darah Boss!
        const hitColorDef = getColorDef(enemy.colorId);
        const clue = buildColorInstructionClue(currentTarget, pStats.stage);
        const res = enemies.damageEnemy(enemy, bossVal.damage, shotDir);

        particles.emit(hitPoint, 18, hitColorDef.hex, 1.6);
        particles.emit(hitPoint, 10, '#ffffff', 1.2);
        tracersRef.current?.addHitImpactEffect(
          hitPoint,
          hitColorDef.hex,
          bossVal.isCrit,
          false
        );
        sound.playHitmarker(bossVal.isCrit);
        inputManagerRef.current.triggerHaptic(
          res.killed ? 'kill' : 'enemyHit',
          stateRef.current.settings,
          vrManagerRef.current?.currentSession || null
        );

        setHitmarkerActive(true);
        setHitmarkerWrong(false);
        setHitmarkerCrit(bossVal.isCrit);
        setTimeout(() => setHitmarkerActive(false), 100);

        setBossHp(Math.max(0, enemy.hp));
        bossDamageSinceSwitch.current += bossVal.damage;

        const newPhaseDef = getBossPhaseForHp(enemy.hp, enemy.maxHp);
        const phaseChanged = enemy.bossPhase !== newPhaseDef.phase;

        if (res.killed && res.firstKillAward) {
          sound.playWaveFanfare();

          // Hapus musuh pengawal & proyektil, namun biarkan Boss di state 'dead' agar animasi ledakan klimaks 3 fase tampil penuh
          enemies.enemies.forEach((other) => {
            if (other !== enemy && other.state !== 'dead') {
              other.state = 'dead';
              other.deathTimer = 0.14;
            }
          });
          enemies.projectiles.forEach((p) => {
            enemies.scene.remove(p.mesh);
            (p.mesh.material as THREE.Material).dispose();
          });
          enemies.projectiles = [];

          if (arenaRef.current && 'clearBossCrystals' in arenaRef.current) {
            arenaRef.current.clearBossCrystals();
          }
          bossInstanceRef.current = null;
          setBossHp(0);
          activeCrystalColorIdRef.current = null;
          setActiveCrystalColorId(null);
          weaponsRef.current?.setCrystalTint(null);

          const newCombo = pStats.combo + 1;
          const elimScore = calculateEliminationScore(newCombo);

          setPlayer((prev) => {
            const updated: PlayerStats = {
              ...prev,
              correctHits: prev.correctHits + 1,
              headshots: bossVal.isCrit ? prev.headshots + 1 : prev.headshots,
              kills: prev.kills + 1,
              combo: newCombo,
              bestCombo: Math.max(prev.bestCombo, newCombo),
              score: prev.score + elimScore.pointsAwarded + STAGE_DEFINITIONS[3].stageClearBonus,
              dataCores: prev.dataCores + 35,
              totalDataCoresCollected: prev.totalDataCoresCollected + 35,
            };

            const elapsed = (Date.now() - runStartTime.current) / 1000;
            const summary = calculateRunSummary(updated, elapsed, true);
            saveGameCompletionProgress(summary);
            setRunSummary(summary);
            setFinalScore(summary.score);
            return updated;
          });

          if (bossVictoryTimerRef.current) {
            clearTimeout(bossVictoryTimerRef.current);
          }
          bossVictoryTimerRef.current = setTimeout(() => {
            bossVictoryTimerRef.current = null;
            tracersRef.current?.clearAll();
            setBossHp(undefined);
            inputManagerRef.current.desktop.releasePointerLock();
            setGameState('victory');
          }, 3100);
          return;
        }

        if (phaseChanged || bossDamageSinceSwitch.current >= 200) {
          bossDamageSinceSwitch.current = 0;
          enemy.bossPhase = newPhaseDef.phase;
          if (phaseChanged) {
            sound.playBossPhaseShift();
          }
          const nextBossColor = selectNextTargetColor(
            newPhaseDef.colorPool,
            [],
            currentTarget
          );
          enemies.setEnemyColor(enemy, nextBossColor);
          enemies.triggerTargetGracePeriod(2.5);
          setTargetColorId(nextBossColor);
          setWrongStreakOnTarget(0);
          setShowHint(false);

          // Reset kristal senjata pemain & munculkan kristal warna baru di arena!
          activeCrystalColorIdRef.current = null;
          setActiveCrystalColorId(null);
          weaponsRef.current?.setCrystalTint(null);
          if (arenaRef.current && 'spawnBossCrystals' in arenaRef.current) {
            arenaRef.current.spawnBossCrystals(nextBossColor, newPhaseDef.colorPool);
          }

          triggerShotBanner({
            type: 'correct',
            title: 'TARGET BARU AKTIF!',
            subtitle: 'Ambil kristal warna yang sesuai di arena!',
            colorHex: getColorDef(nextBossColor).hex,
            timestamp: performance.now(),
          });
        } else {
          triggerShotBanner({
            type: 'correct',
            title: 'TEPAT!',
            subtitle: `-${bossVal.damage} HP pada COLOR CORE`,
            colorHex: hitColorDef.hex,
            timestamp: performance.now(),
          });
        }

        setPlayer((prev) => ({
          ...prev,
          correctHits: prev.correctHits + 1,
          headshots: bossVal.isCrit ? prev.headshots + 1 : prev.headshots,
        }));
        return;
      }

      const validation = validateColorShot(
        currentTarget,
        enemy.colorId,
        baseDamage,
        isHeadshot,
        pStats.damageMult,
        pStats.headshotBonusMult
      );

      if (!validation.isCorrectColor) {
        // === TEMBAKAN SALAH WARNA ===
        // Damage nol, combo kembali nol, tidak mengurangi HP pemain, dan TIDAK membocorkan jawaban!
        enemies.triggerWrongColorFeedback(enemy);
        sound.playWrongColorHit();
        particles.emit(hitPoint, 12, '#f43f5e', 1.25);
        tracersRef.current?.addHitImpactEffect(hitPoint, '#f43f5e', false, true);
        inputManagerRef.current.triggerHaptic(
          'wrong',
          stateRef.current.settings,
          vrManagerRef.current?.currentSession || null
        );

        const wrongDef = getColorDef(enemy.colorId);

        setHitmarkerActive(true);
        setHitmarkerWrong(true);
        setHitmarkerCrit(false);
        setTimeout(() => setHitmarkerActive(false), 120);

        setWrongStreakOnTarget((prev) => prev + 1);

        triggerShotBanner({
          type: 'wrong',
          title: 'WARNA SALAH!',
          subtitle: `Mengenai ${wrongDef.nameId} · Kombo Terputus`,
          colorHex: '#f43f5e',
          timestamp: performance.now(),
        });

        setPlayer((prev) => ({
          ...prev,
          combo: 0,
          wrongHits: prev.wrongHits + 1,
        }));
        return;
      }

      // === TEMBAKAN WARNA BENAR (CHROMABOT NORMAL & ELITE) ===
      const hitColorDef = getColorDef(enemy.colorId);
      const clue = buildColorInstructionClue(currentTarget, pStats.stage);
      const res = enemies.damageEnemy(enemy, validation.damage, shotDir);

      particles.emit(hitPoint, 18, hitColorDef.hex, 1.6);
      particles.emit(hitPoint, 10, '#ffffff', 1.2);
      tracersRef.current?.addHitImpactEffect(
        hitPoint,
        hitColorDef.hex,
        validation.isCrit,
        false
      );
      sound.playHitmarker(validation.isCrit);
      inputManagerRef.current.triggerHaptic(
        res.killed ? 'kill' : 'enemyHit',
        stateRef.current.settings,
        vrManagerRef.current?.currentSession || null
      );

      setHitmarkerActive(true);
      setHitmarkerWrong(false);
      setHitmarkerCrit(validation.isCrit);
      setTimeout(() => setHitmarkerActive(false), 100);

      // Penanganan Chromabot Normal & Elite
      if (res.killed && res.firstKillAward) {
        const newCombo = pStats.combo + 1;
        const elim = calculateEliminationScore(newCombo);
        sound.playCorrectTargetKill(newCombo);
        particles.emit(enemy.position.clone().setY(1.2), 26, hitColorDef.hex, 2.0);

        const coreDrop = enemy.type === 'chromabot_elite' ? 5 : 2;
        const currentStageDef = getEffectiveStageDef(
          pStats.stage,
          stateRef.current.settings.difficulty ?? 'normal'
        );
        const newStageKills = pStats.stageKills + 1;

        // Setelah target berhasil dieliminasi, tampilkan penjelasan pencampuran warna!
        triggerShotBanner({
          type: elim.streakLabel ? 'streak' : 'correct',
          title: clue.solvedFormulaTextId,
          subtitle: `+${elim.pointsAwarded} Poin · Kombo ${newCombo}x`,
          colorHex: hitColorDef.hex,
          points: elim.pointsAwarded,
          timestamp: performance.now(),
        });

        setPlayer((prev) => {
          let nextHp = prev.hp;
          if (prev.lifestealPercent > 0 && validation.isCrit) {
            nextHp = Math.min(
              prev.maxHp,
              prev.hp + Math.round(prev.maxHp * prev.lifestealPercent)
            );
          }
          return {
            ...prev,
            hp: nextHp,
            correctHits: prev.correctHits + 1,
            headshots: validation.isCrit ? prev.headshots + 1 : prev.headshots,
            kills: prev.kills + 1,
            stageKills: prev.stageKills + 1,
            combo: newCombo,
            bestCombo: Math.max(prev.bestCombo, newCombo),
            score: prev.score + elim.pointsAwarded,
            dataCores: prev.dataCores + coreDrop,
            totalDataCoresCollected: prev.totalDataCoresCollected + coreDrop,
          };
        });

        setWrongStreakOnTarget(0);
        setShowHint(false);

        // Pilih target warna berikutnya dan berikan jeda adaptasi (grace period)
        if (newStageKills < currentStageDef.targetEliminations) {
          const remainingBotColors = enemies.enemies
            .filter((e) => e.state !== 'dead' && e.id !== enemy.id && e.type !== 'chroma_titan')
            .map((e) => e.colorId);

          const nextTarget = selectNextTargetColor(
            currentStageDef.colorPool,
            remainingBotColors,
            currentTarget
          );
          setTargetColorId(nextTarget);
          ensureTargetColorPresentInArena(nextTarget, pStats.stage);
          enemies.triggerTargetGracePeriod(currentStageDef.targetGracePeriodSeconds);
        }
      } else {
        triggerShotBanner({
          type: 'correct',
          title: 'WARNA BENAR!',
          subtitle: `-${validation.damage} HP · Lanjutkan tembakan!`,
          colorHex: hitColorDef.hex,
          timestamp: performance.now(),
        });

        setPlayer((prev) => ({
          ...prev,
          correctHits: prev.correctHits + 1,
          headshots: validation.isCrit ? prev.headshots + 1 : prev.headshots,
        }));
      }
    },
    [ensureTargetColorPresentInArena, triggerShotBanner]
  );

  // Inisialisasi Engine Three.js, InputManager, dan WebXR
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const initialPlatform = inputManagerRef.current.detectInitialMode();
    setPlatformMode(initialPlatform);
    setIsGamepadConnected(inputManagerRef.current.isGamepadConnected);
    inputManagerRef.current.attachAutoDetection(
      (detectedMode) => {
        setPlatformMode(detectedMode);
      },
      (gpConnected) => {
        setIsGamepadConnected(gpConnected);
      }
    );

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const playerRig = new THREE.Group();
    scene.add(playerRig);
    playerRigRef.current = playerRig;

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      150
    );
    camera.position.set(0, 1.7, 0);
    cameraRef.current = camera;
    playerRig.add(camera);

    const vrHud = new VRWorldHUD();
    camera.add(vrHud.mesh);
    vrHudRef.current = vrHud;

    // Efek layar merah full-screen (clip-space) khusus mode VR saat terkena tembakan musuh
    const vrDamageMat = new THREE.ShaderMaterial({
      uniforms: {
        uIntensity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          vec2 centered = vUv * 2.0 - 1.0;
          float dist = length(centered);
          float edgeVignette = smoothstep(0.22, 1.12, dist);
          float alpha = uIntensity * mix(0.22, 0.78, edgeVignette);
          gl_FragColor = vec4(0.92, 0.12, 0.14, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const vrDamageMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vrDamageMat);
    vrDamageMesh.frustumCulled = false;
    vrDamageMesh.renderOrder = 9999;
    vrDamageMesh.visible = false;
    scene.add(vrDamageMesh);
    let vrDamageFlash = 0;

    const initialPixelRatio = getPixelRatioForQuality(stateRef.current.settings.graphicsQuality);

    const renderer = new THREE.WebGLRenderer({
      antialias: stateRef.current.settings.graphicsQuality === 'high',
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(initialPixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = stateRef.current.settings.graphicsQuality === 'high';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const arena = new CyberArena(scene);
    arena.setGraphicsQuality(stateRef.current.settings.graphicsQuality);
    arenaRef.current = arena;

    const weapons = new WeaponRig(camera);
    weaponsRef.current = weapons;

    const enemies = new EnemyManager(scene);
    enemiesRef.current = enemies;

    const particles = new ParticleSystem(scene);
    particlesRef.current = particles;

    const tracers = new VisualShotSystem(scene);
    tracersRef.current = tracers;

    const shotScene = new URLSearchParams(window.location.search).get('shotScene');
    if (shotScene) {
      setDesktopFullscreenConfirmed(true);
      setMobileFullscreenConfirmed(true);
      if (shotScene === 'stage1') {
        arena.setStageTheme(1);
        arena.resetArenaPickups(1);
        weapons.switchWeapon('laser_rifle');
        setCurrentWeapon('laser_rifle');
        setAmmo(weapons.ammoCount);
        setTargetColorId('red');
        setPlayer((p) => ({ ...p, stage: 1, stageKills: 3, score: 400, combo: 2 }));
        enemies.spawnEnemy('chromabot_normal', 'yellow', new THREE.Vector3(-4.2, 0, -11.5), 0.9, 0);
        enemies.spawnEnemy('chromabot_normal', 'red', new THREE.Vector3(0.2, 0, -10.5), 0.9, 0);
        enemies.spawnEnemy('chromabot_normal', 'blue', new THREE.Vector3(4.4, 0, -12.0), 0.9, 0);
        setGameState('playing');
      } else if (shotScene === 'stage2') {
        arena.setStageTheme(2);
        arena.resetArenaPickups(2);
        weapons.switchWeapon('cyber_shotgun');
        setCurrentWeapon('cyber_shotgun');
        setAmmo(weapons.ammoCount);
        setTargetColorId('orange');
        setPlayer((p) => ({ ...p, stage: 2, stageKills: 6, score: 1850, combo: 3 }));
        enemies.spawnEnemy('chromabot_normal', 'green', new THREE.Vector3(-4.3, 0, -11.2), 1.0, 0);
        enemies.spawnEnemy('chromabot_elite', 'orange', new THREE.Vector3(0.1, 0, -10.2), 1.0, 0);
        enemies.spawnEnemy('chromabot_normal', 'purple', new THREE.Vector3(4.5, 0, -11.8), 1.0, 0);
        setGameState('playing');
      } else if (shotScene === 'stage3') {
        arena.setStageTheme(3);
        arena.resetArenaPickups(3);
        weapons.switchWeapon('railgun');
        setCurrentWeapon('railgun');
        setAmmo(weapons.ammoCount);
        setTargetColorId('blue_green');
        setPlayer((p) => ({ ...p, stage: 3, stageKills: 11, score: 4950, combo: 5 }));
        enemies.spawnEnemy('chromabot_normal', 'red_orange', new THREE.Vector3(-4.6, 0, -12.2), 1.08, 0);
        enemies.spawnEnemy('chromabot_elite', 'blue_green', new THREE.Vector3(0.2, 0, -10.6), 1.08, 0);
        enemies.spawnEnemy('chromabot_normal', 'red_purple', new THREE.Vector3(4.8, 0, -12.4), 1.08, 0);
        setGameState('playing');
      } else if (shotScene === 'boss') {
        arena.setStageTheme(3);
        arena.resetArenaPickups(3);
        weapons.switchWeapon('railgun');
        setCurrentWeapon('railgun');
        setAmmo(weapons.ammoCount);
        const bossCol = 'purple';
        setTargetColorId(bossCol);
        setPlayer((p) => ({ ...p, stage: 3, stageKills: 20, score: 9200, combo: 4 }));
        const boss = enemies.spawnEnemy('chroma_titan', bossCol, new THREE.Vector3(0, 0, -15.5), 1.0, 0);
        bossInstanceRef.current = boss;
        setBossMaxHp(boss.maxHp);
        setBossHp(980);
        boss.hp = 980;
        arena.spawnBossCrystals(bossCol, BOSS_PHASES[1].colorPool);
        setGameState('playing');
      }
    }

    const vrWatch = new VRWristWatch();
    const vrSpatialMenu = new VRSpatialMenu();
    const vrHandGestures = new VRHandGestures();
    playerRig.add(vrSpatialMenu.group);

    const vrManager = new VRManager(renderer, playerRig, (active) => {
      setIsVRActive(active);
      if (active) {
        setVrErrorMsg(null);
        camera.position.set(0, 1.7, 0);
        camera.rotation.set(0, 0, 0);
        vrManager.leftController.add(vrWatch.group);
        inputManagerRef.current.setMode('vr');
        setPlatformMode('vr');
        sound.unlockBgm();
        const curState = stateRef.current;
        sound.setBgmMode(
          curState.gameState === 'playing'
            ? curState.bossHp !== undefined && curState.bossHp > 0
              ? 'boss'
              : 'combat'
            : 'menu'
        );
      } else {
        weapons.attachToVRHand(null);
        vrManager.setRightHandModelVisible(true);
        vrWatch.setVisible(false);
        vrSpatialMenu.setVisible(false);
        const fallback = inputManagerRef.current.detectInitialMode();
        inputManagerRef.current.setMode(fallback);
        setPlatformMode(fallback);
      }
    });
    vrManager.leftController.add(vrWatch.group);
    vrManagerRef.current = vrManager;

    let prevVRMenuVisible = false;
    let prevVRMenuState: GameState | null = null;
    let prevVRStageMode: 'stage_clear' | 'stage_intro' | null = null;
    let vrMenuSnapFramesLeft = 0;
    const _menuCamPos = new THREE.Vector3();
    const _menuCamDir = new THREE.Vector3();
    const _menuTargetWorld = new THREE.Vector3();
    const positionVRMenuInFrontOfCamera = () => {
      playerRig.updateMatrixWorld(true);
      camera.getWorldPosition(_menuCamPos);
      camera.getWorldDirection(_menuCamDir);
      _menuCamDir.y = 0;
      if (_menuCamDir.lengthSq() < 0.0001) {
        _menuCamDir.set(0, 0, -1);
      } else {
        _menuCamDir.normalize();
      }
      _menuTargetWorld.copy(_menuCamPos).addScaledVector(_menuCamDir, 1.4);
      _menuTargetWorld.y = THREE.MathUtils.clamp(_menuCamPos.y - 0.05, 1.05, 2.35);
      vrSpatialMenu.group.scale.setScalar(0.75);
      vrSpatialMenu.group.position.copy(_menuTargetWorld);
      playerRig.worldToLocal(vrSpatialMenu.group.position);
      vrSpatialMenu.group.lookAt(_menuCamPos.x, _menuTargetWorld.y, _menuCamPos.z);
    };

    inputManagerRef.current.desktop.attach(renderer.domElement);

    const handleCanvasClick = () => {
      if (
        stateRef.current.gameState === 'playing' &&
        inputManagerRef.current.mode === 'desktop'
      ) {
        inputManagerRef.current.desktop.requestPointerLock();
      }
    };
    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.addEventListener('mousedown', handleCanvasClick);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      if (renderer.xr.isPresenting) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (inputManagerRef.current.mode !== 'vr') {
        const redetected = inputManagerRef.current.detectInitialMode();
        setPlatformMode(redetected);
      }
    };
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();
    let rollingAvgDt = 0.0166;
    let adaptiveResolutionScaledDown = false;

    renderer.setAnimationLoop((now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const currentState = stateRef.current.gameState;
      const curSettings = stateRef.current.settings;
      const isPresentingVR = renderer.xr.isPresenting;

      // Auto-FPS Governor untuk perangkat spek kentang: turunkan skala piksel 3D secara halus jika FPS turun di bawah ~38 FPS
      if (currentState === 'playing' && !isPresentingVR && rawDt < 0.25) {
        rollingAvgDt = rollingAvgDt * 0.92 + rawDt * 0.08;
        if (!adaptiveResolutionScaledDown && rollingAvgDt > 0.026) {
          adaptiveResolutionScaledDown = true;
          renderer.setPixelRatio(0.75);
          renderer.shadowMap.enabled = false;
          arena.setGraphicsQuality('low');
        }
      }

      if (inputManagerRef.current.desktop.consumeMuteRequest()) {
        const muted = sound.toggleMute();
        setIsMuted(muted);
      }

      const handGestures = isPresentingVR
        ? vrHandGestures.update(
          vrManager.leftHand,
          vrManager.rightHand,
          camera,
          dt,
          curSettings,
          vrManager.leftController,
          vrManager.isLeftSelectActive,
          vrManager.consumeLeftSelectPulse(),
          vrManager.isRightSelectActive,
          vrManager.consumeRightSelectPulse(),
          vrManager.isHandTrackingRight ? vrManager.rightController : vrManager.rightGrip
        )
        : null;

      if (isPresentingVR) {
        vrManager.updateInputVisuals(
          vrManager.currentSession,
          currentState === 'playing' ? handGestures?.teleportPreview : undefined
        );
        if (
          (vrManager.isHandTrackingLeft || vrManager.isHandTrackingRight) &&
          curSettings.vrTurnMode !== 'snap'
        ) {
          setSettings((prev) =>
            prev.vrTurnMode === 'snap' ? prev : { ...prev, vrTurnMode: 'snap' }
          );
        }
      }

      const cmd = inputManagerRef.current.poll(
        curSettings,
        dt,
        vrManager.currentSession,
        vrManager.rightController,
        vrManager.isHandTrackingLeft || vrManager.isHandTrackingRight ? handGestures : null
      );

      if (cmd.pause) {
        if (currentState === 'playing') {
          inputManagerRef.current.desktop.releasePointerLock();
          inputManagerRef.current.syncMenuGamepadState();
          setGameState('paused');
        } else if (currentState === 'paused' && !stateRef.current.showSettings && !stateRef.current.showTutorial) {
          setGameState('playing');
        }
      }

      if (cmd.toggleHint && currentState === 'playing') {
        setShowHint((prev) => !prev);
      }

      // Navigasi Arah Terpusat Menu & Modal via Gamepad (D-Pad / Analog + A Konfirmasi + B/Start Kembali)
      if (
        currentState !== 'playing' ||
        stateRef.current.showSettings ||
        stateRef.current.showTutorial ||
        stateRef.current.showLKPD ||
        stateRef.current.showLKPDLockedAlert
      ) {
        const menuGp = inputManagerRef.current.pollMenuGamepad();
        const activeBoardForKbd = getActiveUiBoard();
        if (activeBoardForKbd?.getAttribute('data-gamepad-keyboard') === 'true') {
          if (
            menuGp.confirm ||
            menuGp.back ||
            menuGp.tutorial ||
            menuGp.settings ||
            menuGp.start ||
            menuGp.up ||
            menuGp.down ||
            menuGp.left ||
            menuGp.right
          ) {
            window.dispatchEvent(
              new CustomEvent('color-mission:gamepad-keyboard', { detail: menuGp })
            );
          }
        } else if (menuGp.back || menuGp.start) {
          if (stateRef.current.showLKPD) {
            setShowLKPD(false);
          } else if (stateRef.current.showLKPDLockedAlert) {
            setShowLKPDLockedAlert(false);
          } else if (stateRef.current.showTutorial) {
            setShowTutorial(false);
          } else if (stateRef.current.showSettings) {
            setShowSettings(false);
          } else if (currentState === 'paused' && (menuGp.back || menuGp.start)) {
            setGameState('playing');
          } else if ((currentState === 'gameover' || currentState === 'victory') && menuGp.back) {
            menuCallbacksRef.current.returnToMenu();
          } else if (menuGp.start) {
            const board = getActiveUiBoard();
            if (board) activateBoardControl(board);
          }
        } else if (
          menuGp.tutorial &&
          currentState === 'title' &&
          !stateRef.current.showSettings &&
          !stateRef.current.showTutorial &&
          !stateRef.current.showLKPD &&
          !stateRef.current.showLKPDLockedAlert
        ) {
          setShowTutorial(true);
        } else if (
          menuGp.settings &&
          (currentState === 'title' || currentState === 'paused') &&
          !stateRef.current.showSettings &&
          !stateRef.current.showTutorial &&
          !stateRef.current.showLKPD &&
          !stateRef.current.showLKPDLockedAlert
        ) {
          setShowSettings(true);
        } else {
          const board = getActiveUiBoard();
          if (board) {
            const activeEl = document.activeElement as HTMLElement | null;
            const isRangeInput =
              activeEl?.tagName === 'INPUT' &&
              (activeEl as HTMLInputElement).type === 'range' &&
              board.contains(activeEl);

            if (menuGp.up || menuGp.down) {
              moveBoardFocus(board, menuGp.down ? 1 : -1);
            } else if (menuGp.left || menuGp.right) {
              if (isRangeInput) {
                adjustFocusedRange(activeEl as HTMLInputElement, menuGp.right ? 1 : -1);
              } else {
                moveBoardFocus(board, menuGp.right ? 1 : -1);
              }
            } else if (menuGp.confirm) {
              activateBoardControl(board);
            }
          }
        }
      }

      const isVRMenuVisible =
        isPresentingVR &&
        (currentState !== 'playing' || stateRef.current.showSettings || stateRef.current.showTutorial);

      const keepVREquipment =
        isPresentingVR &&
        (currentState === 'playing' || currentState === 'paused') &&
        !isPlayerDyingRef.current;

      if (keepVREquipment) {
        weapons.attachToVRHand(vrManager.getRightWeaponMount(), vrManager.isHandTrackingRight);
        weapons.gunGroup.visible = true;
        vrManager.attachAimRayTo(
          currentState === 'playing' && vrManager.isHandTrackingRight
            ? weapons.muzzleTipAnchor
            : null
        );
        vrManager.setRightHandModelVisible(false);
        vrManager.setLeftHandModelVisible(false);
        const watchMount = vrManager.getLeftWatchMount();
        if (vrWatch.group.parent !== watchMount) {
          watchMount.add(vrWatch.group);
        }
        vrWatch.setHandTrackingMode(vrManager.isHandTrackingLeft);
        vrWatch.setVisible(true);
        const pStatsNow = stateRef.current.player;
        vrWatch.update({
          hp: pStatsNow.hp,
          maxHp: pStatsNow.maxHp,
          shield: pStatsNow.shield,
          maxShield: pStatsNow.maxShield,
          ammo: weapons.ammoCount,
          maxAmmo: weapons.getMaxMagSize(),
          weapon: weapons.currentWeapon,
          targetColorId: stateRef.current.targetColorId,
          crystalColorId: activeCrystalColorIdRef.current,
          stage: pStatsNow.stage,
        });
      } else {
        weapons.attachToVRHand(null);
        vrManager.attachAimRayTo(null);
        vrManager.setRightHandModelVisible(true);
        vrManager.setLeftHandModelVisible(true);
        vrWatch.setVisible(false);
      }

      if (isVRMenuVisible) {
        if (currentState === 'title' || currentState === 'gameover' || currentState === 'victory') {
          playerRig.position.set(0, 0, 0);
          playerRig.rotation.set(0, 0, 0);
        }
        const curStageMode = vrMenuInfoRef.current.stageModalMode;
        if (!prevVRMenuVisible || prevVRMenuState !== currentState || prevVRStageMode !== curStageMode) {
          vrMenuSnapFramesLeft = 4;
        }
        if (vrMenuSnapFramesLeft > 0) {
          positionVRMenuInFrontOfCamera();
          vrMenuSnapFramesLeft--;
        }
        prevVRMenuVisible = true;
        prevVRMenuState = currentState;
        prevVRStageMode = curStageMode;
        vrSpatialMenu.setVisible(true);
        const vrInfo = vrMenuInfoRef.current;
        const { hitPoint, action } = vrSpatialMenu.update(
          {
            gameState: currentState,
            showSettings: stateRef.current.showSettings,
            showTutorial: stateRef.current.showTutorial,
            stageTransitionMode: vrInfo.stageModalMode,
            stageNumber: vrInfo.stageModalNumber,
            stageScore: vrInfo.stageClearScore,
            stageBonus: STAGE_DEFINITIONS[vrInfo.stageModalNumber].stageClearBonus,
            score: vrInfo.finalScore,
            summary: vrInfo.runSummary ?? {
              score: vrInfo.finalScore,
              stagesCleared: 0,
              masteredCategories: [],
              kills: 0,
              headshots: 0,
              shotsFired: 0,
              correctHits: 0,
              wrongHits: 0,
              accuracy: 0,
              bestCombo: 0,
              dataCoresCollected: 0,
              timeSurvivedSeconds: 0,
              bossDefeated: false,
              won: false,
            },
            settings: curSettings,
            isMuted: vrInfo.isMuted,
            isHandTracking: vrManager.isHandTrackingLeft || vrManager.isHandTrackingRight,
            lkpdUnlocked: vrInfo.lkpdUnlocked,
            vrWarningMsg: vrInfo.vrWarningMsg,
            vrSetupStep: vrInfo.vrSetupStep,
            studentName: vrInfo.vrStudentName,
            studentClass: vrInfo.vrStudentClass,
            activeInputField: vrInfo.vrActiveInput,
            selectedCharacterId: vrInfo.vrSelectedChar,
            vrLkpdStep: vrInfo.vrLkpdStep,
            vrLkpdLabSlotA: vrInfo.vrLkpdLabSlotA,
            vrLkpdLabSlotB: vrInfo.vrLkpdLabSlotB,
            vrLkpdLabActiveSlot: vrInfo.vrLkpdLabActiveSlot,
            vrLkpdLabSolvedIds: vrInfo.vrLkpdLabSolvedIds,
            vrLkpdQuizIndex: vrInfo.vrLkpdQuizIndex,
            vrLkpdQuizAnswers: vrInfo.vrLkpdQuizAnswers,
            vrLkpdReflectionAnswers: vrInfo.vrLkpdReflectionAnswers,
            vrLkpdActiveReflectionPrompt: vrInfo.vrLkpdActiveReflectionPrompt,
            vrLkpdScore: vrInfo.vrLkpdScore,
          },
          vrManager.rightController,
          vrManager.currentSession,
          null,
          vrManager.isHandTrackingRight ? Boolean(handGestures?.menuPinch) : false
        );

        if (hitPoint) {
          vrManager.rightController.getWorldPosition(_scratchAimOrigin);
          vrManager.updateAimRay(hitPoint.distanceTo(_scratchAimOrigin), '#22d3ee');
        } else {
          vrManager.updateAimRay(null, '#22d3ee');
        }

        if (action) {
          sound.playUiClick();
          const dispatchVRMenuAction = (act: VRMenuAction) => {
            if (act === 'set_difficulty_easy') {
              setSettings((prev) => ({ ...prev, difficulty: 'easy' }));
            } else if (act === 'set_difficulty_normal') {
              setSettings((prev) => ({ ...prev, difficulty: 'normal' }));
            } else if (act === 'set_difficulty_hard') {
              setSettings((prev) => ({ ...prev, difficulty: 'hard' }));
            } else if (act === 'vr_setup_start' || act === 'start_mission') {
              setVrSetupStep('identity');
              setVrActiveInput('name');
            } else if (act === 'vr_setup_back_to_menu') {
              setVrSetupStep('none');
            } else if (act === 'vr_setup_select_name_input') {
              setVrActiveInput('name');
            } else if (act === 'vr_setup_select_class_input') {
              setVrActiveInput('class');
            } else if (act === 'kb_space') {
              if (vrMenuInfoRef.current.vrLkpdStep === 'reflection') {
                const curPId = vrMenuInfoRef.current.vrLkpdActiveReflectionPrompt;
                setVrLkpdReflectionAnswers((prev) => {
                  const existing = prev[curPId] || '';
                  const next = { ...prev, [curPId]: existing + ' ' };
                  const curSub = loadLKPDSubmission();
                  saveLKPDSubmission({ ...curSub, reflectionAnswers: next });
                  return next;
                });
              } else if (vrMenuInfoRef.current.vrActiveInput === 'name') {
                setVrStudentName((prev) => (prev.length < 24 ? prev + ' ' : prev));
              } else {
                setVrStudentClass((prev) => (prev.length < 12 ? prev + ' ' : prev));
              }
            } else if (act === 'kb_backspace') {
              if (vrMenuInfoRef.current.vrLkpdStep === 'reflection') {
                const curPId = vrMenuInfoRef.current.vrLkpdActiveReflectionPrompt;
                setVrLkpdReflectionAnswers((prev) => {
                  const existing = prev[curPId] || '';
                  const next = { ...prev, [curPId]: existing.slice(0, -1) };
                  const curSub = loadLKPDSubmission();
                  saveLKPDSubmission({ ...curSub, reflectionAnswers: next });
                  return next;
                });
              } else if (vrMenuInfoRef.current.vrActiveInput === 'name') {
                setVrStudentName((prev) => prev.slice(0, -1));
              } else {
                setVrStudentClass((prev) => prev.slice(0, -1));
              }
            } else if (act === 'kb_clear') {
              if (vrMenuInfoRef.current.vrLkpdStep === 'reflection') {
                const curPId = vrMenuInfoRef.current.vrLkpdActiveReflectionPrompt;
                setVrLkpdReflectionAnswers((prev) => {
                  const next = { ...prev, [curPId]: '' };
                  const curSub = loadLKPDSubmission();
                  saveLKPDSubmission({ ...curSub, reflectionAnswers: next });
                  return next;
                });
              } else if (vrMenuInfoRef.current.vrActiveInput === 'name') {
                setVrStudentName('');
              } else {
                setVrStudentClass('');
              }
            } else if (act.startsWith('kb_')) {
              const char = act.slice(3);
              if (vrMenuInfoRef.current.vrLkpdStep === 'reflection') {
                const curPId = vrMenuInfoRef.current.vrLkpdActiveReflectionPrompt;
                setVrLkpdReflectionAnswers((prev) => {
                  const existing = prev[curPId] || '';
                  const next = { ...prev, [curPId]: existing.length < 240 ? existing + char : existing };
                  const curSub = loadLKPDSubmission();
                  saveLKPDSubmission({ ...curSub, reflectionAnswers: next });
                  return next;
                });
              } else if (vrMenuInfoRef.current.vrActiveInput === 'name') {
                setVrStudentName((prev) => (prev.length < 24 ? prev + char : prev));
              } else {
                setVrStudentClass((prev) => (prev.length < 12 ? prev + char : prev));
              }
            } else if (act === 'vr_setup_next_to_character') {
              const curName = vrMenuInfoRef.current.vrStudentName.trim();
              if (curName.length >= 2) {
                const curLKPD = loadLKPDSubmission();
                saveLKPDSubmission({
                  ...curLKPD,
                  studentName: curName,
                  studentClass: vrMenuInfoRef.current.vrStudentClass.trim() || '-',
                });
                setVrSetupStep('character');
              }
            } else if (act === 'vr_setup_back_to_identity') {
              setVrSetupStep('identity');
            } else if (act === 'vr_setup_pick_raka') {
              setVrSelectedChar('raka');
              setSettings((prev) => ({ ...prev, characterId: 'raka' }));
            } else if (act === 'vr_setup_pick_rana') {
              setVrSelectedChar('naya');
              setSettings((prev) => ({ ...prev, characterId: 'naya' }));
            } else if (act === 'vr_setup_confirm_start') {
              const finalName = vrMenuInfoRef.current.vrStudentName.trim() || 'Siswa Anonim';
              const finalClass = vrMenuInfoRef.current.vrStudentClass.trim() || '-';
              const chosenChar =
                vrMenuInfoRef.current.vrSelectedChar || stateRef.current.settings.characterId || 'raka';
              const curLKPD = loadLKPDSubmission();
              saveLKPDSubmission({
                ...curLKPD,
                studentName: finalName,
                studentClass: finalClass,
              });
              recordInitialSessionStartAsync(
                finalName,
                finalClass,
                chosenChar,
                stateRef.current.settings.difficulty || 'normal'
              );
              setSettings((prev) => ({ ...prev, characterId: chosenChar }));
              setVrSetupStep('none');
              vrTriggerReleaseGuardRef.current = true;
              vrShootCooldownUntilRef.current = performance.now() + 380;
              setShowTutorial(false);
              setShowSettings(false);
              menuCallbacksRef.current.startRun();
            } else if (act === 'restart') {
              vrTriggerReleaseGuardRef.current = true;
              vrShootCooldownUntilRef.current = performance.now() + 380;
              setShowTutorial(false);
              setShowSettings(false);
              menuCallbacksRef.current.startRun();
            } else if (act === 'cycle_character') {
              setSettings((prev) => ({
                ...prev,
                characterId: (prev.characterId ?? 'raka') === 'raka' ? 'naya' : 'raka',
              }));
            } else if (act === 'cycle_difficulty') {
              setSettings((prev) => {
                const cur = prev.difficulty ?? 'normal';
                const next: DifficultyLevel =
                  cur === 'easy' ? 'normal' : cur === 'normal' ? 'hard' : 'easy';
                return {
                  ...prev,
                  difficulty: next,
                };
              });
            } else if (act === 'open_tutorial') {
              setShowTutorial(true);
            } else if (act === 'open_settings') {
              setShowSettings(true);
            } else if (act === 'open_lkpd') {
              if (vrMenuInfoRef.current.lkpdUnlocked) {
                setVrWarningMsg(null);
                setVrLkpdStep('lab');
              } else {
                setVrWarningMsg('Selesaikan Stage 1–3 & Boss dahulu untuk membuka LKPD!');
                if (vrWarningTimerRef.current) {
                  clearTimeout(vrWarningTimerRef.current);
                }
                vrWarningTimerRef.current = setTimeout(() => {
                  vrWarningTimerRef.current = null;
                  setVrWarningMsg(null);
                }, 3500);
              }
            } else if (act === 'vr_lkpd_open_lab') {
              setVrLkpdStep('lab');
            } else if (act === 'vr_lkpd_open_quiz') {
              setVrLkpdStep('quiz');
            } else if (act === 'vr_lkpd_open_reflection') {
              setVrLkpdStep('reflection');
            } else if (act === 'vr_lkpd_open_result') {
              setVrLkpdStep('result');
            } else if (act === 'vr_lkpd_exit') {
              setVrLkpdStep('none');
            } else if (act === 'vr_lkpd_lab_select_slot_a') {
              setVrLkpdLabActiveSlot('a');
            } else if (act === 'vr_lkpd_lab_select_slot_b') {
              setVrLkpdLabActiveSlot('b');
            } else if (act.startsWith('vr_lkpd_lab_pick_')) {
              const colId = act.replace('vr_lkpd_lab_pick_', '') as RYBColorId;
              if (vrMenuInfoRef.current.vrLkpdLabActiveSlot === 'a') {
                setVrLkpdLabSlotA(colId);
                setVrLkpdLabActiveSlot('b');
              } else {
                setVrLkpdLabSlotB(colId);
              }
            } else if (act === 'vr_lkpd_lab_mix') {
              const a = vrMenuInfoRef.current.vrLkpdLabSlotA;
              const b = vrMenuInfoRef.current.vrLkpdLabSlotB;
              if (a && b) {
                const mixed = mixRYBColors(a, b);
                if (mixed) {
                  setVrLkpdLabSolvedIds((prev) => {
                    const mixId = mixed.id as RYBColorId;
                    if (!prev.includes(mixId)) {
                      const next = [...prev, mixId];
                      const cur = loadLKPDSubmission();
                      saveLKPDSubmission({ ...cur, labSolvedIds: next });
                      return next;
                    }
                    return prev;
                  });
                }
              }
            } else if (act === 'vr_lkpd_lab_reset') {
              setVrLkpdLabSlotA(null);
              setVrLkpdLabSlotB(null);
              setVrLkpdLabActiveSlot('a');
            } else if (act === 'vr_lkpd_quiz_next') {
              setVrLkpdQuizIndex((prev) => Math.min(prev + 1, LKPD_QUIZ_QUESTIONS.length - 1));
            } else if (act === 'vr_lkpd_quiz_prev') {
              setVrLkpdQuizIndex((prev) => Math.max(prev - 1, 0));
            } else if (act.startsWith('vr_lkpd_quiz_ans_')) {
              const optId = act.replace('vr_lkpd_quiz_ans_', '');
              const curQ = LKPD_QUIZ_QUESTIONS[vrMenuInfoRef.current.vrLkpdQuizIndex];
              if (curQ) {
                setVrLkpdQuizAnswers((prev) => {
                  const next = { ...prev, [curQ.id]: optId };
                  const curSub = loadLKPDSubmission();
                  saveLKPDSubmission({ ...curSub, quizAnswers: next });
                  return next;
                });
              }
            } else if (act.startsWith('vr_lkpd_reflection_select_')) {
              const pId = act.replace('vr_lkpd_reflection_select_', '');
              setVrLkpdActiveReflectionPrompt(pId);
            } else if (act.startsWith('vr_lkpd_quick_')) {
              const phrase = act.replace('vr_lkpd_quick_', '');
              const curPId = vrMenuInfoRef.current.vrLkpdActiveReflectionPrompt;
              setVrLkpdReflectionAnswers((prev) => {
                const existing = prev[curPId] || '';
                const nextText = existing ? `${existing} ${phrase}` : phrase;
                const next = { ...prev, [curPId]: nextText };
                const curSub = loadLKPDSubmission();
                saveLKPDSubmission({ ...curSub, reflectionAnswers: next });
                return next;
              });
            } else if (act === 'vr_lkpd_submit') {
              const curSub = loadLKPDSubmission();
              const finalSub: LKPDSubmissionState = {
                ...curSub,
                studentName: vrMenuInfoRef.current.vrStudentName.trim() || 'Siswa Anonim',
                studentClass: vrMenuInfoRef.current.vrStudentClass.trim() || '-',
                studentAbsent: curSub.studentAbsent || '-',
                schoolName: curSub.schoolName || LKPD_DEFAULT_SCHOOL,
                teacherName: curSub.teacherName || LKPD_DEFAULT_TEACHER,
                labSolvedIds: vrMenuInfoRef.current.vrLkpdLabSolvedIds,
                quizAnswers: vrMenuInfoRef.current.vrLkpdQuizAnswers,
                quizChecked: true,
                reflectionAnswers: vrMenuInfoRef.current.vrLkpdReflectionAnswers,
                completedAt: new Date().toISOString(),
              };
              saveLKPDSubmission(finalSub);
              const scoreBreakdown = calculateLKPDScore(finalSub);
              setVrLkpdScore(scoreBreakdown);
              recordLKPDSubmissionAsync(finalSub);
              setVrLkpdStep('result');
            } else if (act === 'close_subpanel') {
              setShowTutorial(false);
              setShowSettings(false);
            } else if (act === 'exit_vr') {
              vrManager.exitVR();
            } else if (act === 'continue_stage') {
              vrTriggerReleaseGuardRef.current = true;
              vrShootCooldownUntilRef.current = performance.now() + 380;
              menuCallbacksRef.current.continueStage();
            } else if (act === 'resume') {
              vrTriggerReleaseGuardRef.current = true;
              vrShootCooldownUntilRef.current = performance.now() + 380;
              setGameState('playing');
            } else if (act === 'return_menu') {
              setShowSettings(false);
              setShowTutorial(false);
              menuCallbacksRef.current.returnToMenu();
            } else if (act === 'toggle_vr_turn') {
              const isHT = vrManager.isHandTrackingLeft || vrManager.isHandTrackingRight;
              setSettings((prev) => ({
                ...prev,
                vrTurnMode: isHT ? 'snap' : prev.vrTurnMode === 'snap' ? 'smooth' : 'snap',
              }));
            } else if (act === 'toggle_vr_move') {
              setSettings((prev) => ({
                ...prev,
                vrMovementMode: prev.vrMovementMode === 'teleport' ? 'smooth' : 'teleport',
              }));
            } else if (act === 'toggle_vr_vignette') {
              setSettings((prev) => ({
                ...prev,
                vrComfortVignette: !prev.vrComfortVignette,
              }));
            } else if (act === 'toggle_mute') {
              const m = sound.toggleMute();
              setIsMuted(m);
            } else if (
              act === 'speed_slow' ||
              act === 'speed_normal' ||
              act === 'speed_fast'
            ) {
              const preset =
                act === 'speed_slow' ? 'slow' : act === 'speed_normal' ? 'normal' : 'fast';
              const cfg = SPEED_PRESET_CONFIG[preset];
              setSettings((prev) => ({
                ...prev,
                speedPreset: preset,
                moveSpeedPercent: cfg.moveSpeedPercent,
                cameraSpeedPercent: cfg.cameraSpeedPercent,
              }));
            } else if (act === 'speed_custom') {
              setSettings((prev) => {
                const info = resolveSpeedSettings(prev);
                return {
                  ...prev,
                  speedPreset: 'custom',
                  moveSpeedPercent: info.moveSpeedPercent,
                  cameraSpeedPercent: info.cameraSpeedPercent,
                };
              });
            } else if (act === 'move_speed_down' || act === 'move_speed_up') {
              const delta = act === 'move_speed_up' ? 10 : -10;
              setSettings((prev) => {
                const info = resolveSpeedSettings(prev);
                return {
                  ...prev,
                  speedPreset: 'custom',
                  moveSpeedPercent: clampSteppedSpeedPercent(info.moveSpeedPercent + delta),
                  cameraSpeedPercent: info.cameraSpeedPercent,
                };
              });
            } else if (act === 'cam_speed_down' || act === 'cam_speed_up') {
              const delta = act === 'cam_speed_up' ? 10 : -10;
              setSettings((prev) => {
                const info = resolveSpeedSettings(prev);
                return {
                  ...prev,
                  speedPreset: 'custom',
                  moveSpeedPercent: info.moveSpeedPercent,
                  cameraSpeedPercent: clampSteppedSpeedPercent(info.cameraSpeedPercent + delta),
                };
              });
            } else if (act === 'bgm_vol_down' || act === 'bgm_vol_up') {
              const delta = act === 'bgm_vol_up' ? 10 : -10;
              setSettings((prev) => {
                const audioInfo = resolveAudioSettings(prev);
                return {
                  ...prev,
                  bgmVolumePercent: clampAudioPercent(audioInfo.bgmVolumePercent + delta),
                };
              });
            } else if (act === 'sfx_vol_down' || act === 'sfx_vol_up') {
              const delta = act === 'sfx_vol_up' ? 10 : -10;
              setSettings((prev) => {
                const audioInfo = resolveAudioSettings(prev);
                return {
                  ...prev,
                  sfxVolumePercent: clampAudioPercent(audioInfo.sfxVolumePercent + delta),
                };
              });
            }
          };
          dispatchVRMenuAction(action);
        }
      } else {
        prevVRMenuVisible = false;
        prevVRMenuState = null;
        prevVRStageMode = null;
        vrMenuSnapFramesLeft = 0;
        vrSpatialMenu.setVisible(false);
      }

      if (
        currentState === 'title' ||
        currentState === 'gameover' ||
        currentState === 'victory' ||
        currentState === 'stage_transition'
      ) {
        // Background 3D ruangan arena yang kosong & bergerak halus saat di Menu maupun saat Game Selesai
        arena.update(now / 1000, dt);
        particles.update(dt);
        weapons.gunGroup.visible = false;
        if (!isPresentingVR) {
          const orbitAngle = now * 0.00014;
          camera.position.set(
            Math.sin(orbitAngle) * 18,
            6.2 + Math.sin(now * 0.0005) * 0.4,
            Math.cos(orbitAngle) * 18
          );
          camera.rotation.set(-0.22, orbitAngle, 0, 'YXZ');
        }
      } else if (currentState === 'playing' && isPlayerDyingRef.current) {
        weapons.gunGroup.visible = false;
        playerPos.current.y = THREE.MathUtils.lerp(playerPos.current.y, 0.48, dt * 5.5);
        camera.position.copy(playerPos.current);
        camera.rotation.set(
          THREE.MathUtils.lerp(camera.rotation.x, -0.25, dt * 4),
          cameraRot.current.yaw,
          THREE.MathUtils.lerp(camera.rotation.z, 0.34, dt * 4.5),
          'YXZ'
        );
      } else if (currentState === 'playing') {
        weapons.gunGroup.visible = true;
        const pStats = stateRef.current.player;
        weapons.setModifiers(
          pStats.fireRateMult,
          pStats.reloadTimeMult,
          pStats.magSizeBonus
        );

        // Update Cooldown & Durasi Ability Karakter (Agen Raka: Perisai Super / Agen Naya: Recovery)
        const prevCd = pStats.abilityCooldownLeft ?? 0;
        const prevAct = pStats.abilityActiveLeft ?? 0;
        if (prevCd > 0 || prevAct > 0) {
          const nextCd = Math.max(0, prevCd - dt);
          const nextAct = Math.max(0, prevAct - dt);
          stateRef.current.player = {
            ...pStats,
            abilityCooldownLeft: nextCd,
            abilityActiveLeft: nextAct,
          };
          if (
            Math.ceil(prevCd * 5) !== Math.ceil(nextCd * 5) ||
            Math.ceil(prevAct * 10) !== Math.ceil(nextAct * 10) ||
            (prevAct > 0 && nextAct === 0) ||
            (prevCd > 0 && nextCd === 0)
          ) {
            setPlayer((prev) => ({
              ...prev,
              abilityCooldownLeft: nextCd,
              abilityActiveLeft: nextAct,
            }));
          }
        }

        if (cmd.useAbility) {
          handleTriggerAbility();
        }

        // --- 1. Pergerakan & Fisika Pemain ---
        cameraRot.current.yaw += cmd.lookDeltaX;
        cameraRot.current.pitch = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, cameraRot.current.pitch + cmd.lookDeltaY)
        );

        const { moveMult } = resolveSpeedSettings(stateRef.current.settings);
        const moveSpeed = 12.0 * pStats.moveSpeedMult * moveMult;
        _scratchWishDir.set(cmd.moveX, 0, cmd.moveZ);

        if (_scratchWishDir.lengthSq() > 0.001) {
          if (_scratchWishDir.lengthSq() > 1) _scratchWishDir.normalize();
          if (isPresentingVR) {
            camera.getWorldDirection(_scratchForward);
            _scratchForward.y = 0;
            if (_scratchForward.lengthSq() < 0.0001) {
              _scratchForward.set(0, 0, -1);
            } else {
              _scratchForward.normalize();
            }
            _scratchRight.set(-_scratchForward.z, 0, _scratchForward.x);
          } else {
            _scratchForward.set(
              -Math.sin(cameraRot.current.yaw),
              0,
              -Math.cos(cameraRot.current.yaw)
            );
            _scratchRight.set(
              Math.cos(cameraRot.current.yaw),
              0,
              -Math.sin(cameraRot.current.yaw)
            );
          }
          _scratchWorldWish
            .copy(_scratchForward)
            .multiplyScalar(-_scratchWishDir.z)
            .addScaledVector(_scratchRight, _scratchWishDir.x);

          playerVel.current.x = THREE.MathUtils.lerp(
            playerVel.current.x,
            _scratchWorldWish.x * moveSpeed,
            dt * 10
          );
          playerVel.current.z = THREE.MathUtils.lerp(
            playerVel.current.z,
            _scratchWorldWish.z * moveSpeed,
            dt * 10
          );
        } else {
          playerVel.current.x = THREE.MathUtils.lerp(playerVel.current.x, 0, dt * 12);
          playerVel.current.z = THREE.MathUtils.lerp(playerVel.current.z, 0, dt * 12);
        }

        let didVRTeleportThisFrame = false;
        if (handGestures?.teleportCommit && vrManager.isHandTrackingLeft) {
          const camWorld = new THREE.Vector3();
          const rigWorld = new THREE.Vector3();
          camera.getWorldPosition(camWorld);
          playerRig.getWorldPosition(rigWorld);
          const offsetX = camWorld.x - rigWorld.x;
          const offsetZ = camWorld.z - rigWorld.z;
          const desiredCamPos = new THREE.Vector3(
            THREE.MathUtils.clamp(handGestures.teleportCommit.x, -28.5, 28.5),
            1.7,
            THREE.MathUtils.clamp(handGestures.teleportCommit.z, -28.5, 28.5)
          );
          resolveCircleXZCollision(desiredCamPos, 0.65, arena.colliders);
          playerPos.current.x = THREE.MathUtils.clamp(desiredCamPos.x - offsetX, -28.5, 28.5);
          playerPos.current.z = THREE.MathUtils.clamp(desiredCamPos.z - offsetZ, -28.5, 28.5);
          playerVel.current.x = 0;
          playerVel.current.z = 0;
          didVRTeleportThisFrame = true;
          sound.playDash();
          particles.emit(
            new THREE.Vector3(desiredCamPos.x, 0.35, desiredCamPos.z),
            16,
            '#38bdf8',
            1.4
          );
        } else if (cmd.vrTeleportRequest && !vrManager.isHandTrackingLeft) {
          const forward = new THREE.Vector3(
            -Math.sin(cameraRot.current.yaw),
            0,
            -Math.cos(cameraRot.current.yaw)
          );
          playerPos.current.addScaledVector(forward, 6.5);
          sound.playDash();
        }

        if (cmd.jump && isGrounded.current) {
          playerVel.current.y = 8.5;
          isGrounded.current = false;
        }

        if (handGestures?.shoulderEntered) {
          sound.playHitmarker(false);
          inputManagerRef.current.triggerHaptic('dash', curSettings, vrManager.currentSession);
        }

        const unlockedWeapons = getUnlockedWeaponsForStage(pStats.stage);
        if ((handGestures?.weaponSwitch || cmd.weaponCycle) && unlockedWeapons.length > 1) {
          const curIdx = unlockedWeapons.indexOf(weapons.currentWeapon);
          const nextWeapon = unlockedWeapons[(curIdx + 1) % unlockedWeapons.length];
          weapons.switchWeapon(nextWeapon);
          setCurrentWeapon(nextWeapon);
          sound.playHitmarker(true);
          inputManagerRef.current.triggerHaptic('shoot', curSettings, vrManager.currentSession);
        } else if (cmd.weaponSwitch && unlockedWeapons.includes(cmd.weaponSwitch)) {
          weapons.switchWeapon(cmd.weaponSwitch);
          setCurrentWeapon(cmd.weaponSwitch);
        }

        playerVel.current.y -= 22.0 * dt;
        playerPos.current.addScaledVector(playerVel.current, dt);

        if (playerPos.current.y <= 1.7) {
          playerPos.current.y = 1.7;
          playerVel.current.y = 0;
          isGrounded.current = true;
        }

        playerPos.current.x = Math.max(-29, Math.min(29, playerPos.current.x));
        playerPos.current.z = Math.max(-29, Math.min(29, playerPos.current.z));
        if (!didVRTeleportThisFrame) {
          resolveCircleXZCollision(playerPos.current, 0.65, arena.colliders);
        }

        arena.jumpPads.forEach((jp: JumpPad) => {
          if (
            playerPos.current.distanceTo(jp.position) < jp.radius &&
            playerPos.current.y <= 2.2
          ) {
            playerVel.current.y = jp.boostVelocity;
            isGrounded.current = false;
            sound.playDash();
            particles.emit(jp.position, 20, '#22d3ee', 1.5);
          }
        });

        // Pengambilan Kristal Warna saat melawan Boss CHROMA TITAN
        if (bossInstanceRef.current && bossInstanceRef.current.state !== 'dead') {
          arena.bossCrystals.forEach((c) => {
            if (!c.isCollected) {
              const distHoriz = Math.hypot(
                playerPos.current.x - c.position.x,
                playerPos.current.z - c.position.z
              );
              if (distHoriz <= c.pickupRadius) {
                c.isCollected = true;
                c.group.visible = false;
                c.respawnTimer = 3.5;

                activeCrystalColorIdRef.current = c.colorId;
                setActiveCrystalColorId(c.colorId);
                weapons.setCrystalTint(c.colorHex);

                sound.playOverdrive();
                inputManagerRef.current.triggerHaptic(
                  'dash',
                  curSettings,
                  vrManager.currentSession
                );
                particles.emit(c.position.clone().setY(1.6), 28, c.colorHex, 2.0);
                triggerShotBanner({
                  type: 'correct',
                  title: 'KRISTAL AKTIF!',
                  subtitle: 'Senjata mengeluarkan laser kristal warna',
                  colorHex: c.colorHex,
                  timestamp: performance.now(),
                });
              }
            }
          });
        }

        // Pengambilan Item Khusus Arena (Darah, Perisai, Peluru)
        arena.arenaPickups.forEach((p) => {
          if (p.isCollected) return;
          const distHoriz = Math.hypot(
            playerPos.current.x - p.position.x,
            playerPos.current.z - p.position.z
          );
          if (distHoriz > p.pickupRadius) return;

          const curP = stateRef.current.player;
          if (p.type === 'health' && curP.hp >= curP.maxHp) return;
          if (p.type === 'shield' && curP.shield >= curP.maxShield) return;

          p.isCollected = true;
          p.group.visible = false;
          p.respawnTimer =
            p.type === 'ammo'
              ? curP.stage === 1
                ? 4.5
                : curP.stage === 2
                  ? 6.0
                  : 8.0
              : 7.0;

          sound.playOverdrive();
          particles.emit(p.position.clone().setY(1.2), 20, p.colorHex, 1.6);

          if (p.type === 'health') {
            setPlayer((prev) => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + 30) }));
            triggerShotBanner({
              type: 'pickup',
              title: 'DARAH +30!',
              subtitle: 'Kesehatan dipulihkan (+30 HP)',
              colorHex: p.colorHex,
              timestamp: performance.now(),
            });
          } else if (p.type === 'shield') {
            setPlayer((prev) => ({ ...prev, shield: Math.min(prev.maxShield, prev.shield + 25) }));
            triggerShotBanner({
              type: 'pickup',
              title: 'PERISAI +25!',
              subtitle: 'Perisai energi terisi (+25 Shield)',
              colorHex: p.colorHex,
              timestamp: performance.now(),
            });
          } else {
            const targetWeapon = p.weaponType ?? 'laser_rifle';
            const addedAmmo = weapons.addAmmoForWeapon(targetWeapon);
            ammoRef.current = weapons.ammoCount;
            setAmmo(weapons.ammoCount);
            triggerShotBanner({
              type: 'pickup',
              title: addedAmmo > 0 ? `PELURU +${addedAmmo}!` : 'PELURU PENUH!',
              subtitle:
                addedAmmo > 0
                  ? `${WEAPON_REGISTRY[targetWeapon].name} (+${addedAmmo} peluru)`
                  : `Kapasitas ${WEAPON_REGISTRY[targetWeapon].name} sudah maksimal`,
              colorHex: p.colorHex,
              timestamp: performance.now(),
            });
          }
        });

        if (isPresentingVR) {
          playerRig.position.set(
            playerPos.current.x,
            playerPos.current.y - 1.7,
            playerPos.current.z
          );
          playerRig.rotation.y = cameraRot.current.yaw;
        } else {
          playerRig.position.set(0, 0, 0);
          playerRig.rotation.set(0, 0, 0);
          camera.position.copy(playerPos.current);
          // Pastikan roll (z) SELALU 0.0 agar kamera tidak pernah miring di Desktop maupun Mobile
          camera.rotation.set(cameraRot.current.pitch, cameraRot.current.yaw, 0, 'YXZ');
        }

        const speedHoriz = Math.hypot(playerVel.current.x, playerVel.current.z);
        setVrComfortVignetteActive(
          isPresentingVR && curSettings.vrComfortVignette && speedHoriz > 3.5
        );

        // --- 2. Menembak & Validasi Target Warna ---
        const isMoving = _scratchWishDir.lengthSq() > 0.01;
        weapons.update(dt, isMoving, now / 1000);

        // Update Meta OS-style Laser Aim Ray saat gameplay VR
        if (isPresentingVR && cmd.vrAimRay) {
          if (vrManager.isHandTrackingRight) {
            weapons.getMuzzleRay(_scratchAimOrigin, _scratchAimDir);

            // Aim Assist magnetik ringan khusus mode tangan kosong agar tembakan cubit lebih akurat
            let bestDot = 0.9965; // ~4.8 derajat
            let bestDir: THREE.Vector3 | null = null;
            for (const e of enemies.enemies) {
              if (e.state === 'dead') continue;
              e.mesh.getWorldPosition(_scratchEnemyWorldPos);
              _scratchEnemyWorldPos.y += 0.95;
              _scratchCandidateDir.subVectors(_scratchEnemyWorldPos, _scratchAimOrigin);
              const dist = _scratchCandidateDir.length();
              if (dist < 0.8 || dist > 32) continue;
              _scratchCandidateDir.divideScalar(dist);
              const d = _scratchCandidateDir.dot(_scratchAimDir);
              if (d > bestDot) {
                bestDot = d;
                bestDir = _scratchCandidateDir.clone();
              }
            }
            if (bestDir) {
              _scratchAimDir.lerp(bestDir, 0.65).normalize();
            }

            cmd.vrAimRay.origin[0] = _scratchAimOrigin.x;
            cmd.vrAimRay.origin[1] = _scratchAimOrigin.y;
            cmd.vrAimRay.origin[2] = _scratchAimOrigin.z;
            cmd.vrAimRay.direction[0] = _scratchAimDir.x;
            cmd.vrAimRay.direction[1] = _scratchAimDir.y;
            cmd.vrAimRay.direction[2] = _scratchAimDir.z;
          } else {
            _scratchAimOrigin.set(...cmd.vrAimRay.origin);
            _scratchAimDir.set(...cmd.vrAimRay.direction).normalize();
          }
          _scratchRaycaster.set(_scratchAimOrigin, _scratchAimDir);
          const liveEnemyMeshes = enemies.enemies
            .filter((e) => e.state !== 'dead')
            .map((e) => e.mesh);
          const aimHits =
            liveEnemyMeshes.length > 0
              ? _scratchRaycaster.intersectObjects(liveEnemyMeshes, true)
              : [];
          vrManager.updateAimRay(aimHits.length > 0 ? aimHits[0].distance : null, '#38bdf8');
        }

        if (vrTriggerReleaseGuardRef.current) {
          if (!cmd.shoot) {
            vrTriggerReleaseGuardRef.current = false;
          }
        }

        if (cmd.shoot && !vrTriggerReleaseGuardRef.current && performance.now() >= vrShootCooldownUntilRef.current) {
          const fired = weapons.fire();
          if (fired) {
            inputManagerRef.current.triggerHaptic(
              'shoot',
              curSettings,
              vrManager.currentSession
            );

            if (isPresentingVR && cmd.vrAimRay) {
              _scratchAimOrigin.set(...cmd.vrAimRay.origin);
              _scratchAimDir.set(...cmd.vrAimRay.direction).normalize();
              _scratchRaycaster.set(_scratchAimOrigin, _scratchAimDir);
              _scratchMuzzlePos.copy(_scratchAimOrigin);
            } else {
              _scratchRaycaster.setFromCamera(_scratchScreenCenter, camera);
              weapons.getMuzzleWorldPosition(_scratchMuzzlePos);
            }

            const wDef = WEAPON_REGISTRY[weapons.currentWeapon];
            const isBossFightActive =
              bossInstanceRef.current !== null && bossInstanceRef.current.state !== 'dead';
            const activeShotColor = isBossFightActive
              ? activeCrystalColorIdRef.current
                ? getColorDef(activeCrystalColorIdRef.current).hex
                : '#94a3b8'
              : wDef.color;

            particles.emit(_scratchMuzzlePos, 5, activeShotColor, 0.8);

            enemies.checkProjectileInterception(_scratchMuzzlePos, _scratchRaycaster.ray.direction);

            _scratchTargetPoint
              .copy(_scratchMuzzlePos)
              .addScaledVector(_scratchRaycaster.ray.direction, 50);

            if (weapons.currentWeapon === 'plasma_smg') {
              tracers.addPlasmaProjectile(
                _scratchMuzzlePos,
                _scratchRaycaster.ray.direction,
                wDef.damage,
                wDef.projectileSpeed || 58,
                activeShotColor
              );
              _scratchPelletEnd
                .copy(_scratchMuzzlePos)
                .addScaledVector(_scratchRaycaster.ray.direction, 8);
              tracers.addLaserBeam(
                _scratchMuzzlePos,
                _scratchPelletEnd,
                activeShotColor,
                0.05,
                0.07
              );
            } else {
              const activeEnemies = enemies.enemies
                .filter((e) => e.state !== 'dead')
                .sort(
                  (a, b) =>
                    a.position.distanceToSquared(playerPos.current) -
                    b.position.distanceToSquared(playerPos.current)
                );

              for (const enemy of activeEnemies) {
                const isBoss = enemy.type === 'chroma_titan';
                const isElite = enemy.type === 'chromabot_elite';
                const boxH = isBoss ? 4.4 : isElite ? 2.4 : 2.1;
                const boxW = isBoss ? 3.4 : isElite ? 1.55 : 1.3;
                _scratchEnemyCenter.set(
                  enemy.position.x,
                  enemy.position.y + boxH * 0.5,
                  enemy.position.z
                );
                _scratchEnemySize.set(boxW, boxH, boxW);
                _scratchEnemyBox.setFromCenterAndSize(_scratchEnemyCenter, _scratchEnemySize);
                if (_scratchRaycaster.ray.intersectsBox(_scratchEnemyBox)) {
                  _scratchRaycaster.ray.intersectBox(_scratchEnemyBox, _scratchHitPoint);
                  _scratchTargetPoint.copy(_scratchHitPoint);

                  const isHeadshot =
                    _scratchHitPoint.y >
                    enemy.position.y + (_scratchEnemyBox.max.y - _scratchEnemyBox.min.y) * 0.68;

                  _scratchShootDir
                    .subVectors(enemy.position, playerPos.current)
                    .normalize();

                  const baseHitDmg =
                    weapons.currentWeapon === 'cyber_shotgun'
                      ? wDef.damage * 4
                      : wDef.damage;

                  processEnemyHit(enemy, _scratchHitPoint, baseHitDmg, isHeadshot, _scratchShootDir);

                  if (weapons.currentWeapon !== 'railgun') break;
                }
              }

              if (weapons.currentWeapon === 'laser_rifle') {
                tracers.addLaserBeam(_scratchMuzzlePos, _scratchTargetPoint, activeShotColor, 0.055, 0.13);
              } else if (weapons.currentWeapon === 'cyber_shotgun') {
                for (let p = 0; p < 8; p++) {
                  _scratchSpreadDir
                    .copy(_scratchRaycaster.ray.direction)
                    .add(
                      _scratchHitPoint.set(
                        (Math.random() - 0.5) * 0.13,
                        (Math.random() - 0.5) * 0.13,
                        (Math.random() - 0.5) * 0.13
                      )
                    )
                    .normalize();
                  _scratchPelletEnd
                    .copy(_scratchMuzzlePos)
                    .addScaledVector(_scratchSpreadDir, 32);
                  tracers.addLaserBeam(_scratchMuzzlePos, _scratchPelletEnd, activeShotColor, 0.034, 0.09);
                }
              } else if (weapons.currentWeapon === 'railgun') {
                tracers.addLaserBeam(_scratchMuzzlePos, _scratchTargetPoint, activeShotColor, 0.12, 0.22);
                tracers.addLaserBeam(_scratchMuzzlePos, _scratchTargetPoint, '#ffffff', 0.04, 0.18);
              }
            }

            arena.hazardNodes.forEach((node: HazardNode) => {
              if (!node.isExploded) {
                _scratchNodeBox.setFromObject(node.mesh);
                if (_scratchRaycaster.ray.intersectsBox(_scratchNodeBox)) {
                  node.isExploded = true;
                  node.mesh.visible = false;
                  sound.playEmp();
                  particles.emit(node.position, 45, '#38bdf8', 2.8);
                  enemies.stunAllInRadius(node.position, node.radius, 3.5);
                }
              }
            });

            setPlayer((prev) => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
          }
        }

        // --- 3. Update Amunisi ---
        if (weapons.ammoCount !== ammoRef.current) {
          ammoRef.current = weapons.ammoCount;
          setAmmo(weapons.ammoCount);
        }

        // --- 4. Manajemen 3 Tahap Berurutan, Chromabots, & Boss CHROMA TITAN ---
        const stageNum = stateRef.current.player.stage;
        const curDiff = stateRef.current.settings.difficulty ?? 'normal';
        const diffCfg = DIFFICULTY_REGISTRY[curDiff] || DIFFICULTY_REGISTRY.normal;
        const stageDef = getEffectiveStageDef(stageNum, curDiff);
        const stageKills = stateRef.current.player.stageKills;
        enemies.setDifficultyModifiers(
          diffCfg.enemyDamageMult,
          diffCfg.enemyShootCooldownMult,
          diffCfg.enemyProjectileSpeedMult
        );

        if (stageKills < stageDef.targetEliminations) {
          spawnTimer.current += dt;
          const activeBots = enemies.enemies.filter(
            (e) => e.state !== 'dead' && e.type !== 'chroma_titan'
          );

          if (
            spawnTimer.current >= stageDef.spawnIntervalSeconds &&
            activeBots.length < stageDef.maxConcurrentEnemies
          ) {
            spawnTimer.current = 0;

            const currentTarget = stateRef.current.targetColorId;
            const hasTargetBot = activeBots.some((e) => e.colorId === currentTarget);

            const spawnColor: GameColorId = !hasTargetBot
              ? currentTarget
              : stageDef.colorPool[Math.floor(Math.random() * stageDef.colorPool.length)];

            const isElite = Math.random() < stageDef.eliteChance;
            const botType: EnemyType = isElite ? 'chromabot_elite' : 'chromabot_normal';

            const angle = Math.random() * Math.PI * 2;
            const spawnRadius = 21 + Math.random() * 5;
            const spawnPos = new THREE.Vector3(
              Math.cos(angle) * spawnRadius,
              0,
              Math.sin(angle) * spawnRadius
            );
            resolveCircleXZCollision(spawnPos, 1.5, arena.colliders);

            enemies.spawnEnemy(
              botType,
              spawnColor,
              spawnPos,
              stageDef.enemyHpMult,
              stageDef.enemySpeedMult
            );
            particles.emit(spawnPos.clone().setY(1.0), 14, getColorDef(spawnColor).hex, 1.2);
          }
        } else if (!stageDef.hasBossAtEnd) {
          if (!stageTransitionLock.current) {
            stageTransitionLock.current = true;
            sound.playWaveFanfare();
            inputManagerRef.current.resetAll();
            playerVel.current.set(0, 0, 0);

            const clearedNum = stageNum as 1 | 2;
            const earnedInStage = Math.max(
              0,
              stateRef.current.player.score - stageStartScoreRef.current
            );
            setStageClearScore(earnedInStage);
            setPlayer((prev) => ({
              ...prev,
              score: prev.score + stageDef.stageClearBonus,
            }));

            if (stageClearTimerRef.current) {
              clearTimeout(stageClearTimerRef.current);
            }
            stageClearTimerRef.current = setTimeout(() => {
              stageClearTimerRef.current = null;
              enemies.clearAll();
              inputManagerRef.current.resetAll();
              playerVel.current.set(0, 0, 0);
              inputManagerRef.current.desktop.releasePointerLock();
              setStageModalMode('stage_clear');
              setStageModalNumber(clearedNum);
              setGameState('stage_transition');
            }, 1100);
          }
        } else {
          if (!bossInstanceRef.current && !bossVictoryTimerRef.current) {
            enemies.clearAll();
            sound.playBossPhaseShift();

            const initialBossColor = selectNextTargetColor(BOSS_PHASES[1].colorPool, []);
            setTargetColorId(initialBossColor);
            setWrongStreakOnTarget(0);
            setShowHint(false);

            const bossPos = new THREE.Vector3(0, 0, -21);
            const boss = enemies.spawnEnemy(
              'chroma_titan',
              initialBossColor,
              bossPos,
              diffCfg.bossHpMult,
              diffCfg.enemySpeedMult
            );
            enemies.triggerTargetGracePeriod(Math.max(1.8, 3.0 + diffCfg.graceBonusSeconds));
            bossInstanceRef.current = boss;
            bossDamageSinceSwitch.current = 0;

            activeCrystalColorIdRef.current = null;
            setActiveCrystalColorId(null);
            weapons.setCrystalTint(null);
            arena.spawnBossCrystals(initialBossColor, BOSS_PHASES[1].colorPool);

            setBossMaxHp(boss.maxHp);
            setBossHp(boss.hp);

            particles.emitSpectrumExplosion(bossPos.clone().setY(3.0), 10);
            triggerShotBanner({
              type: 'streak',
              title: 'AMBIL KRISTAL WARNA!',
              subtitle: 'Ambil kristal sesuai warna Boss agar senjata dapat melukainya!',
              colorHex: '#22d3ee',
              timestamp: performance.now(),
            });
          } else if (bossInstanceRef.current) {
            const boss = bossInstanceRef.current;
            const phaseDef = getBossPhaseForHp(boss.hp, boss.maxHp);
            if (phaseDef.phase === 3) {
              spawnTimer.current += dt;
              const escortBots = enemies.enemies.filter(
                (e) => e.state !== 'dead' && e.type !== 'chroma_titan'
              );
              if (spawnTimer.current >= 5.2 && escortBots.length < 2) {
                spawnTimer.current = 0;
                const escortColor =
                  phaseDef.colorPool[Math.floor(Math.random() * phaseDef.colorPool.length)];
                const ang = (Math.random() - 0.5) * Math.PI;
                const pos = new THREE.Vector3(Math.sin(ang) * 20, 0, -Math.cos(ang) * 20);
                enemies.spawnEnemy('chromabot_normal', escortColor, pos, 0.85, 0.9);
              }
            }
          }
        }

        const enemyTargetPos = isPresentingVR
          ? camera.getWorldPosition(_scratchAimOrigin)
          : playerPos.current;

        enemies.update(
          dt,
          enemyTargetPos,
          (dmg: number) => {
            if (isPlayerDyingRef.current) return;
            const superShieldActive = (stateRef.current.player.abilityActiveLeft ?? 0) > 0;
            if (superShieldActive) {
              // Agen Raka: Perisai Super menahan 100% serangan tanpa mengurangi Perisai maupun HP
              sound.playHitmarker(false);
              return;
            }
            // Efek flicker merah saat pemain terkena tembakan musuh + Haptic feedback
            vrDamageFlash = 1.0;
            setPlayerDamageFlash(true);
            if (damageFlashTimerRef.current) {
              clearTimeout(damageFlashTimerRef.current);
            }
            damageFlashTimerRef.current = setTimeout(() => {
              setPlayerDamageFlash(false);
            }, 260);
            inputManagerRef.current.triggerHaptic(
              'playerDamage',
              stateRef.current.settings,
              vrManager.currentSession
            );

            setPlayer((prev: PlayerStats) => {
              const res = calculatePlayerDamage(
                prev.hp,
                prev.shield,
                dmg,
                (prev.abilityActiveLeft ?? 0) > 0
              );
              if (res.isDead && !isPlayerDyingRef.current) {
                isPlayerDyingRef.current = true;
                setIsPlayerDying(true);
                inputManagerRef.current.desktop.releasePointerLock();
                const elapsed = (Date.now() - runStartTime.current) / 1000;
                const summary = calculateRunSummary({ ...prev, hp: 0 }, elapsed, false);

                if (playerDeathTimerRef.current) {
                  clearTimeout(playerDeathTimerRef.current);
                }
                playerDeathTimerRef.current = setTimeout(() => {
                  enemies.clearAll();
                  arena.clearBossCrystals();
                  tracers.clearAll();
                  bossInstanceRef.current = null;
                  activeCrystalColorIdRef.current = null;
                  setActiveCrystalColorId(null);
                  weapons.setCrystalTint(null);
                  setBossHp(undefined);
                  setPlayerDamageFlash(false);
                  isPlayerDyingRef.current = false;
                  setIsPlayerDying(false);
                  setRunSummary(summary);
                  setFinalScore(summary.score);
                  setGameState('gameover');
                  playerDeathTimerRef.current = null;
                }, 1100);
              }
              return {
                ...prev,
                hp: res.newHp,
                shield: res.newShield,
              };
            });
          },
          (explodePos, colorHex, isBossExplode, isPreBurst) => {
            if (!isBossExplode) {
              particles.emit(explodePos, 32, colorHex, 2.2);
              tracers.addHitImpactEffect(explodePos, colorHex, false, false);
            } else if (isPreBurst) {
              particles.emit(explodePos, 18, colorHex, 1.8);
              sound.playProjectileImpact();
            } else {
              particles.emitSpectrumExplosion(explodePos, 18);
              tracers.addHitImpactEffect(explodePos, '#22d3ee', true, false);
              tracers.addHitImpactEffect(explodePos, '#ffffff', true, false);
              sound.playEmp();
            }
          },
          arena.colliders
        );

        arena.update(now / 1000, dt);
        particles.update(dt);
        tracers.update(dt);

        for (let i = tracers.activePlasma.length - 1; i >= 0; i--) {
          const proj = tracers.activePlasma[i];
          const activeTargets = enemies.enemies.filter((e) => e.state !== 'dead');
          let hitOccurred = false;

          for (const enemy of activeTargets) {
            const hitRadius = enemy.type === 'chroma_titan' ? 2.6 : 1.35;
            const enemyCenter = enemy.position
              .clone()
              .setY(enemy.type === 'chroma_titan' ? 3.2 : 1.2);

            if (proj.mesh.position.distanceTo(enemyCenter) <= hitRadius) {
              processEnemyHit(
                enemy,
                proj.mesh.position.clone(),
                proj.damage,
                false,
                proj.velocity.clone().normalize()
              );
              scene.remove(proj.mesh);
              proj.mesh.geometry.dispose();
              (proj.mesh.material as THREE.Material).dispose();
              tracers.activePlasma.splice(i, 1);
              hitOccurred = true;
              break;
            }
          }
          if (hitOccurred) continue;
        }
      }

      if (vrHudRef.current) {
        vrHudRef.current.update(
          now,
          isPresentingVR && currentState === 'playing',
          stateRef.current.player,
          stateRef.current.targetColorId,
          weapons.ammoCount,
          weapons.getMaxMagSize(),
          stateRef.current.bossHp,
          stateRef.current.bossMaxHp,
          stateRef.current.shotFeedback
        );
      }

      if (isPresentingVR && currentState === 'playing' && vrDamageFlash > 0.01) {
        vrDamageMesh.visible = true;
        vrDamageMat.uniforms.uIntensity.value = vrDamageFlash;
        vrDamageFlash = Math.max(0, vrDamageFlash - dt * 2.8);
      } else {
        vrDamageMesh.visible = false;
        vrDamageMat.uniforms.uIntensity.value = 0;
        if (currentState !== 'playing') vrDamageFlash = 0;
      }

      if (
        isPresentingVR ||
        (currentState !== 'paused' && currentState !== 'stage_transition')
      ) {
        renderer.render(scene, camera);
      }
    });

    return () => {
      vrDamageMesh.geometry.dispose();
      vrDamageMat.dispose();
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      renderer.domElement.removeEventListener('mousedown', handleCanvasClick);
      if (bossVictoryTimerRef.current) {
        clearTimeout(bossVictoryTimerRef.current);
        bossVictoryTimerRef.current = null;
      }
      if (playerDeathTimerRef.current) {
        clearTimeout(playerDeathTimerRef.current);
        playerDeathTimerRef.current = null;
      }
      if (stageClearTimerRef.current) {
        clearTimeout(stageClearTimerRef.current);
        stageClearTimerRef.current = null;
      }
      inputManagerRef.current.dispose();
      vrWatch.dispose();
      vrSpatialMenu.dispose();
      vrManager.dispose();
      vrHud.dispose();
      arena.dispose();
      particles.dispose(scene);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    ensureTargetColorPresentInArena,
    handleTriggerAbility,
    processEnemyHit,
    triggerShotBanner,
  ]);

  // Kembali ke Menu Utama dengan Ruangan 3D Bersih Tanpa Musuh & Tanpa Boss
  const handleReturnToMenu = () => {
    setVrSetupStep('none');
    if (bossVictoryTimerRef.current) {
      clearTimeout(bossVictoryTimerRef.current);
      bossVictoryTimerRef.current = null;
    }
    if (playerDeathTimerRef.current) {
      clearTimeout(playerDeathTimerRef.current);
      playerDeathTimerRef.current = null;
    }
    if (stageClearTimerRef.current) {
      clearTimeout(stageClearTimerRef.current);
      stageClearTimerRef.current = null;
    }
    isPlayerDyingRef.current = false;
    setIsPlayerDying(false);
    inputManagerRef.current.resetAll();
    playerVel.current.set(0, 0, 0);
    _scratchWishDir.set(0, 0, 0);
    enemiesRef.current?.clearAll();
    if (arenaRef.current && 'clearBossCrystals' in arenaRef.current) {
      arenaRef.current.clearBossCrystals();
    }
    if (arenaRef.current && 'setStageTheme' in arenaRef.current) {
      arenaRef.current.setStageTheme(1);
    }
    tracersRef.current?.clearAll();
    weaponsRef.current?.setCrystalTint(null);
    bossInstanceRef.current = null;
    activeCrystalColorIdRef.current = null;
    setActiveCrystalColorId(null);
    setBossHp(undefined);
    setShotFeedback(null);
    setPlayerDamageFlash(false);
    setGameState('title');
  };

  // Mulai Misi Baru dari Stage 1 (Primer)
  const handleStartRun = () => {
    if (bossVictoryTimerRef.current) {
      clearTimeout(bossVictoryTimerRef.current);
      bossVictoryTimerRef.current = null;
    }
    if (playerDeathTimerRef.current) {
      clearTimeout(playerDeathTimerRef.current);
      playerDeathTimerRef.current = null;
    }
    if (stageClearTimerRef.current) {
      clearTimeout(stageClearTimerRef.current);
      stageClearTimerRef.current = null;
    }
    isPlayerDyingRef.current = false;
    setIsPlayerDying(false);
    const curDiff: DifficultyLevel = stateRef.current.settings.difficulty ?? 'normal';
    const curChar: CharacterId = stateRef.current.settings.characterId ?? 'raka';
    const diffCfg = DIFFICULTY_REGISTRY[curDiff] || DIFFICULTY_REGISTRY.normal;
    const initialColor = STAGE_DEFINITIONS[1].colorPool[0];
    setTargetColorId(initialColor);
    setWrongStreakOnTarget(0);
    setShowHint(false);
    setShowMissionSetup(false);

    const freshPlayer: PlayerStats = {
      ...INITIAL_PLAYER_STATS,
      hp: diffCfg.playerInitialHp,
      maxHp: diffCfg.playerInitialHp,
      shield: diffCfg.playerInitialShield,
      maxShield: diffCfg.playerInitialShield,
      stage: 1,
      characterId: curChar,
      difficulty: curDiff,
      abilityCooldownLeft: 0,
      abilityActiveLeft: 0,
    };
    stateRef.current.player = freshPlayer;
    setPlayer(freshPlayer);
    stageStartScoreRef.current = 0;
    setStageClearScore(0);

    playerPos.current.set(0, 1.7, 0);
    playerVel.current.set(0, 0, 0);
    _scratchWishDir.set(0, 0, 0);
    inputManagerRef.current.resetAll();
    cameraRot.current = { pitch: 0, yaw: 0 };
    spawnTimer.current = 0;
    runStartTime.current = Date.now();
    bossInstanceRef.current = null;
    bossDamageSinceSwitch.current = 0;
    stageTransitionLock.current = false;
    activeCrystalColorIdRef.current = null;
    setActiveCrystalColorId(null);
    setBossHp(undefined);
    setShotFeedback(null);
    setPlayerDamageFlash(false);

    if (stateRef.current.platformMode === 'mobile' && settings.mobileGyroEnabled) {
      inputManagerRef.current.mobile.requestGyroPermission();
    }

    if (arenaRef.current && 'setStageTheme' in arenaRef.current) {
      arenaRef.current.setStageTheme(1);
    }
    if (arenaRef.current && 'resetArenaPickups' in arenaRef.current) {
      arenaRef.current.resetArenaPickups(1);
    }
    if (enemiesRef.current) {
      enemiesRef.current.clearAll();
    }
    if (tracersRef.current) {
      tracersRef.current.clearAll();
    }
    if (weaponsRef.current) {
      weaponsRef.current.setCrystalTint(null);
      weaponsRef.current.switchWeapon('laser_rifle');
      weaponsRef.current.resetAllAmmo();
      setCurrentWeapon('laser_rifle');
      ammoRef.current = weaponsRef.current.ammoCount;
      setAmmo(weaponsRef.current.ammoCount);
    }

    // Tampilkan papan Stage 1 (Hint Warna Primer & Petunjuk Item) sebelum pertempuran dimulai
    setStageModalMode('stage_intro');
    setStageModalNumber(1);
    setGameState('stage_transition');
  };

  const handleContinueFromStageTransition = () => {
    inputManagerRef.current.resetAll();
    playerVel.current.set(0, 0, 0);
    _scratchWishDir.set(0, 0, 0);

    if (stageModalMode === 'stage_clear') {
      const nextStage = Math.min(3, stageModalNumber + 1) as 2 | 3;
      const nextStageDef = STAGE_DEFINITIONS[nextStage];
      const firstTarget = nextStageDef.colorPool[0];
      stageStartScoreRef.current = stateRef.current.player.score;

      setTargetColorId(firstTarget);
      setWrongStreakOnTarget(0);
      setShowHint(false);

      setPlayer((prev) => ({
        ...prev,
        stage: nextStage,
        stageKills: 0,
      }));

      playerPos.current.set(0, 1.7, 0);
      playerVel.current.set(0, 0, 0);
      cameraRot.current = { pitch: 0, yaw: 0 };
      spawnTimer.current = 0;
      bossInstanceRef.current = null;
      bossDamageSinceSwitch.current = 0;
      stageTransitionLock.current = false;
      setBossHp(undefined);
      setShotFeedback(null);

      if (arenaRef.current && 'setStageTheme' in arenaRef.current) {
        arenaRef.current.setStageTheme(nextStage);
      }

      setStageModalMode('stage_intro');
      setStageModalNumber(nextStage);
      setGameState('stage_transition');
      return;
    }

    // stage_intro -> mulai pertempuran pada stageModalNumber dalam posisi diam di tengah
    inputManagerRef.current.resetAll();
    playerPos.current.set(0, 1.7, 0);
    playerVel.current.set(0, 0, 0);
    _scratchWishDir.set(0, 0, 0);
    const activeStage = stageModalNumber;
    const curDiff: DifficultyLevel = stateRef.current.settings.difficulty ?? 'normal';
    const diffCfg = DIFFICULTY_REGISTRY[curDiff] || DIFFICULTY_REGISTRY.normal;
    const activeStageDef = getEffectiveStageDef(activeStage, curDiff);
    const firstTarget = activeStageDef.colorPool[0];
    setTargetColorId(firstTarget);
    setWrongStreakOnTarget(0);
    setShowHint(false);

    if (arenaRef.current && 'resetArenaPickups' in arenaRef.current) {
      arenaRef.current.resetArenaPickups(activeStage);
    }

    if (enemiesRef.current) {
      enemiesRef.current.setDifficultyModifiers(
        diffCfg.enemyDamageMult,
        diffCfg.enemyShootCooldownMult,
        diffCfg.enemyProjectileSpeedMult
      );
      enemiesRef.current.clearAll();
      const initialWaveColors = [
        firstTarget,
        ...activeStageDef.colorPool.filter((c) => c !== firstTarget).slice(0, 2),
      ];
      initialWaveColors.forEach((colId, idx) => {
        const ang = (idx / initialWaveColors.length) * Math.PI * 2;
        const pos = new THREE.Vector3(Math.cos(ang) * 21, 0, Math.sin(ang) * 21);
        if (arenaRef.current && 'colliders' in arenaRef.current) {
          resolveCircleXZCollision(pos, 1.5, arenaRef.current.colliders);
        }
        enemiesRef.current?.spawnEnemy(
          'chromabot_normal',
          colId,
          pos,
          activeStageDef.enemyHpMult,
          activeStageDef.enemySpeedMult
        );
      });
      enemiesRef.current.triggerTargetGracePeriod(activeStageDef.targetGracePeriodSeconds);
    }

    setGameState('playing');
    document.body.dataset.state = 'playing';
    if (
      activeStage === 1 &&
      inputManagerRef.current.mode === 'vr' &&
      vrManagerRef.current &&
      !rendererRef.current?.xr.isPresenting
    ) {
      vrManagerRef.current.enterVR().catch(() => { });
    } else if (inputManagerRef.current.mode === 'desktop') {
      inputManagerRef.current.desktop.requestPointerLock();
    }
  };

  menuCallbacksRef.current = {
    startRun: handleStartRun,
    returnToMenu: handleReturnToMenu,
    continueStage: handleContinueFromStageTransition,
  };

  const currentBossPhase =
    bossHp !== undefined ? getBossPhaseForHp(bossHp, bossMaxHp) : undefined;
  const activeInstructionClue = buildColorInstructionClue(targetColorId, player.stage);

  useEffect(() => {
    if (!shotFeedback) return;
    const t = setTimeout(() => {
      setShotFeedback(null);
    }, 1800);
    return () => clearTimeout(t);
  }, [shotFeedback]);

  useEffect(() => {
    const bgmMode =
      gameState === 'playing' ? (bossHp !== undefined && bossHp > 0 ? 'boss' : 'combat') : 'menu';
    sound.setBgmMode(bgmMode);
  }, [gameState, bossHp]);

  useEffect(() => {
    const unlock = () => sound.unlockBgm();
    const onGlobalButtonClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest('button');
      if (btn && !(btn as HTMLButtonElement).disabled) {
        sound.playUiClick();
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('click', onGlobalButtonClick, true);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('click', onGlobalButtonClick, true);
      sound.stopBgm();
    };
  }, []);

  // Navigasi Keyboard untuk Menu & Modal (Esc: kembali/lanjutkan, Panah: pindah tombol, Enter: konfirmasi)
  useEffect(() => {
    const isMenuActive =
      gameState !== 'playing' ||
      showSettings ||
      showTutorial ||
      showMissionSetup ||
      showLKPD ||
      showLKPDLockedAlert;
    if (!isMenuActive) return;

    // Fokus otomatis pada tombol utama saat papan berpindah
    const focusTimer = setTimeout(() => {
      if (showLKPD) return;
      const board = getActiveUiBoard();
      if (board) focusDefaultBoardControl(board);
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      const board = getActiveUiBoard();
      if (!board) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showLKPD) {
          setShowLKPD(false);
        } else if (showLKPDLockedAlert) {
          setShowLKPDLockedAlert(false);
        } else if (showMissionSetup) {
          setShowMissionSetup(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else if (showTutorial) {
          setShowTutorial(false);
        } else if (gameState === 'paused') {
          setGameState('playing');
          if (inputManagerRef.current.mode === 'desktop') {
            inputManagerRef.current.desktop.requestPointerLock();
          }
        } else if (gameState === 'gameover' || gameState === 'victory') {
          menuCallbacksRef.current.returnToMenu();
        }
        return;
      }

      if (showLKPD) {
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isRangeInput =
        activeEl?.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'range';

      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        (!isRangeInput && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))
      ) {
        e.preventDefault();
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        moveBoardFocus(board, step);
        return;
      }

      if (e.key === 'Enter') {
        if (activeEl && activeEl.tagName === 'BUTTON' && board.contains(activeEl)) {
          e.preventDefault();
          activeEl.click();
        } else if (!isRangeInput) {
          e.preventDefault();
          activateBoardControl(board);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    gameState,
    showSettings,
    showTutorial,
    showMissionSetup,
    showLKPD,
    showLKPDLockedAlert,
    mobileFullscreenConfirmed,
    desktopFullscreenConfirmed,
    isGamepadConnected,
  ]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const syncViewportOrientation = () => {
      if (typeof window !== 'undefined') {
        setMobileOrientation(
          window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
        );
      }
    };
    syncFullscreen();
    syncViewportOrientation();
    document.addEventListener('fullscreenchange', syncFullscreen);
    window.addEventListener('resize', syncViewportOrientation);
    window.addEventListener('orientationchange', syncViewportOrientation);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      window.removeEventListener('resize', syncViewportOrientation);
      window.removeEventListener('orientationchange', syncViewportOrientation);
    };
  }, []);

  const enterFullscreenAndLock = useCallback(async (orientation?: 'landscape' | 'portrait') => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen({
            navigationUI: 'hide',
          } as FullscreenOptions);
        } catch {
          await document.documentElement.requestFullscreen();
        }
      }
    } catch { }
    if (orientation) {
      setMobileOrientation(orientation);
      try {
        const ori = screen.orientation as unknown as {
          lock?: (o: string) => Promise<void>;
        };
        if (ori?.lock) {
          await ori.lock(orientation);
        }
      } catch { }
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch { }
    } else {
      await enterFullscreenAndLock(platformMode === 'mobile' ? mobileOrientation : undefined);
    }
  }, [enterFullscreenAndLock, mobileOrientation, platformMode]);

  const handleToggleMobileOrientation = useCallback(async () => {
    const nextOri = mobileOrientation === 'landscape' ? 'portrait' : 'landscape';
    await enterFullscreenAndLock(nextOri);
  }, [enterFullscreenAndLock, mobileOrientation]);

  return (
    <div
      data-gamepad-connected={isGamepadConnected ? 'true' : undefined}
      className="fixed inset-0 w-full h-dvh bg-slate-950 overflow-hidden select-none font-sans"
    >
      {/* Container Kanvas 3D Three.js */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* Pre-warmed Raster Cache Gambar Karakter agar saat klik MULAI MISI langsung tampil instan 0ms */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-1 h-1 overflow-hidden pointer-events-none opacity-0"
      >
        <img
          src={CHARACTER_REGISTRY.raka.imagePath}
          alt=""
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
        <img
          src={CHARACTER_REGISTRY.naya.imagePath}
          alt=""
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
      </div>

      {/* ====================================================================
          PEMBERITAHUAN PILIHAN MODE LAYAR PENUH KHUSUS PERANGKAT MOBILE
         ==================================================================== */}
      <AnimatedPresence show={platformMode === 'mobile' && !mobileFullscreenConfirmed}>
        <div className="fixed inset-0 z-50 bg-[#050811]/96 flex items-center justify-center p-5 ui-backdrop-enter">
          <div
            data-ui-board="true"
            className="bg-[#090d18] border border-cyan-400/35 px-7 py-8 rounded-3xl shadow-2xl max-w-sm w-full text-center ui-panel-enter"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Maximize2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Pilih Mode Layar Penuh
            </h2>
            <p className="text-xs font-semibold text-slate-300 mt-2.5 leading-relaxed">
              Pilih orientasi layar yang paling nyaman untuk bermain di ponsel Anda.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  await enterFullscreenAndLock('landscape');
                  setMobileFullscreenConfirmed(true);
                }}
                className="py-3.5 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-wide flex flex-col items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <svg
                  viewBox="0 0 32 22"
                  className="w-8 h-5.5"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="1.5"
                    y="1.5"
                    width="29"
                    height="19"
                    rx="3.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  />
                  <circle cx="5" cy="11" r="1.2" fill="currentColor" />
                </svg>
                <span>Landscape</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await enterFullscreenAndLock('portrait');
                  setMobileFullscreenConfirmed(true);
                }}
                className="py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/18 border border-white/20 text-white text-xs font-black uppercase tracking-wide flex flex-col items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <svg
                  viewBox="0 0 22 32"
                  className="w-5.5 h-8 text-cyan-300"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="1.5"
                    y="1.5"
                    width="19"
                    height="29"
                    rx="3.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  />
                  <circle cx="11" cy="5" r="1.2" fill="currentColor" />
                </svg>
                <span>Portrait</span>
              </button>
            </div>
          </div>
        </div>
      </AnimatedPresence>

      {/* ====================================================================
          HALAMAN MASUK LAYAR PENUH & AUDIO KHUSUS DESKTOP
         ==================================================================== */}
      <AnimatedPresence show={gameState === 'title' && platformMode === 'desktop' && !desktopFullscreenConfirmed}>
        <div className="fixed inset-0 z-50 bg-[#050811]/95 flex items-center justify-center p-6 ui-backdrop-enter">
          <div
            data-ui-board="true"
            className="bg-[#090d18] border border-cyan-400/35 px-8 py-9 rounded-3xl shadow-2xl max-w-md w-full text-center ui-panel-enter"
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-400/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Maximize2 className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              COLOR <span className="text-cyan-400">MISSION</span>
            </h2>
            <p className="text-xs font-semibold text-slate-300 mt-2.5 leading-relaxed">
              Aktifkan layar penuh dan musik latar sebelum masuk ke menu utama.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  sound.unlockBgm();
                  sound.setBgmMode('menu');
                  await enterFullscreenAndLock();
                  setDesktopFullscreenConfirmed(true);
                }}
                className="w-full py-3.5 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-sm font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Masuk Fullscreen &amp; Nyalakan Audio</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.unlockBgm();
                  sound.setBgmMode('menu');
                  setDesktopFullscreenConfirmed(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
              >
                Lanjut Tanpa Fullscreen
              </button>
            </div>
          </div>
        </div>
      </AnimatedPresence>

      {/* Backdrop Transisi Halus (Mencegah kedipan antar Menu Utama, Papan Stage, dan Arena 3D) */}
      <div
        className={`fixed inset-0 z-20 pointer-events-none transition-all duration-300 ease-out ${gameState === 'title'
          ? 'bg-[#050811]/65 opacity-100'
          : gameState === 'stage_transition'
            ? 'bg-[#050811]/92 opacity-100'
            : 'bg-[#050811]/92 opacity-0'
          }`}
      />

      {/* ====================================================================
          HALAMAN DETEKSI HEADSET VR (KHUSUS PERANGKAT VR SEBELUM IMMERSIVE)
         ==================================================================== */}
      {gameState === 'title' && platformMode === 'vr' && !isVRActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-30 bg-[#050811]/88 backdrop-blur-md">
          <div
            data-ui-board="true"
            className="bg-[#090d18]/96 border border-cyan-400/30 px-8 py-10 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-md w-full ui-panel-enter"
          >
            <div className="p-4 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400 mb-5">
              <svg viewBox="0 0 64 48" className="w-12 h-9" fill="none" aria-label="Headset VR">
                {/* Strap Atas & Samping */}
                <path d="M12 20 C12 9 22 5 32 5 C42 5 52 9 52 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                {/* Visor Utama Headset VR */}
                <rect x="6" y="16" width="52" height="24" rx="8" fill="rgba(34,211,238,0.14)" stroke="currentColor" strokeWidth="3" />
                {/* Lekuk Hidung Bawah */}
                <path d="M24 40 C26 34 38 34 40 40" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                {/* Lensa / Sensor Depan */}
                <circle cx="20" cy="28" r="3" fill="currentColor" opacity="0.85" />
                <circle cx="44" cy="28" r="3" fill="currentColor" opacity="0.85" />
                <rect x="27" y="26.5" width="10" height="3" rx="1.5" fill="currentColor" opacity="0.55" />
              </svg>
            </div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400 mb-1.5">
              PERANGKAT WEBXR SIAP
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase leading-tight mb-2">
              HEADSET VR TERDETEKSI
            </h1>
            <p className="text-sm text-slate-300 mb-7">
              Masuk ke tampilan Immersive VR 360° untuk mengakses menu utama &amp; bermain dengan
              kontrol tangan 6DoF.
            </p>

            {vrErrorMsg && (
              <div className="w-full mb-4 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-400/35 text-xs font-semibold text-rose-200">
                {vrErrorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                setVrErrorMsg(null);
                sound.unlockBgm();
                sound.setBgmMode('menu');
                const res = await vrManagerRef.current?.enterVR();
                if (res && !res.ok) {
                  setVrErrorMsg(res.message);
                }
              }}
              className="w-full h-13 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-base font-black tracking-wide uppercase rounded-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg"
            >
              <svg viewBox="0 0 64 48" className="w-6 h-5" fill="none" aria-hidden="true">
                <path d="M12 20 C12 9 22 5 32 5 C42 5 52 9 52 20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                <rect x="6" y="16" width="52" height="24" rx="8" stroke="currentColor" strokeWidth="3.5" />
                <path d="M24 40 C26 34 38 34 40 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span>MASUK KE MODE VR</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          MAIN MENU MINIMALIS & KONTRAS TINGGI (BERLATAR ARENA 3D)
         ==================================================================== */}
      {gameState === 'title' &&
        platformMode !== 'vr' &&
        !isVRActive &&
        !(platformMode === 'mobile' && !mobileFullscreenConfirmed) &&
        !(platformMode === 'desktop' && !desktopFullscreenConfirmed) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-30 overflow-y-auto">
            {/* Tombol Ikon Pojok Kanan Atas: Orientasi (Mobile) & Fullscreen */}
            <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
              {platformMode === 'mobile' && (
                <button
                  type="button"
                  onClick={handleToggleMobileOrientation}
                  title={
                    mobileOrientation === 'landscape'
                      ? 'Ubah ke Mode Portrait'
                      : 'Ubah ke Mode Landscape'
                  }
                  aria-label={
                    mobileOrientation === 'landscape'
                      ? 'Ubah ke Mode Portrait'
                      : 'Ubah ke Mode Landscape'
                  }
                  className="p-2.5 rounded-xl bg-[#090d18]/90 hover:bg-slate-900 border border-white/15 text-cyan-400 transition-colors cursor-pointer shadow-xl"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}

              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  title="Panel Guru / Admin"
                  aria-label="Panel Guru / Admin"
                  className="p-2.5 rounded-xl bg-[#090d18]/90 hover:bg-slate-900 border border-white/15 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer shadow-xl"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
                aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
                className="p-2.5 rounded-xl bg-[#090d18]/90 hover:bg-slate-900 border border-white/15 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-slate-300" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-cyan-400" />
                )}
              </button>
            </div>

            {/* Kartu Utama Tengah */}
            <div data-ui-board="true" className="bg-[#090d18]/96 border border-white/15 px-8 py-10 md:px-12 md:py-12 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-md w-full ui-panel-enter">
              {/* Tiga Kotak Polos Warna Primer RYB */}
              <div className="flex items-center gap-3 mb-5">
                <span className="w-5 h-5 rounded-md bg-[#EF233C] border border-white/80 shadow-sm" />
                <span className="w-5 h-5 rounded-md bg-[#FFD60A] border border-white/80 shadow-sm" />
                <span className="w-5 h-5 rounded-md bg-[#1D6FFF] border border-white/80 shadow-sm" />
              </div>

              {/* Logo COLOR MISSION */}
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white uppercase leading-none">
                COLOR <span className="text-cyan-400">MISSION</span>
              </h1>

              <p className="text-sm font-semibold text-slate-400 mt-2 mb-8">
                Kuasai Warna. Selesaikan Misi.
              </p>

              {/* Tiga Tombol Utama Kontras Tinggi */}
              <div className="flex flex-col gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowMissionSetup(true)}
                  data-start="true"
                  className="w-full h-13 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-base font-black tracking-wide uppercase rounded-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>MULAI MISI</span>
                </button>

                {/* Tombol Khusus Pemilihan Tingkat Kesulitan di Main Menu */}
                <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-white/5 border border-white/12 w-full">
                  {(['easy', 'normal', 'hard'] as DifficultyLevel[]).map((diffId) => {
                    const cfg = DIFFICULTY_REGISTRY[diffId];
                    const active = (settings.difficulty ?? 'normal') === diffId;
                    return (
                      <button
                        key={diffId}
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({ ...prev, difficulty: diffId }))
                        }
                        className={`h-9 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                          active
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-white/8'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => setShowTutorial(true)}
                    className="h-12 bg-white/6 hover:bg-white/12 text-white border border-white/15 text-sm font-bold tracking-wide uppercase rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>CARA MAIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="h-12 bg-white/6 hover:bg-white/12 text-white border border-white/15 text-sm font-bold tracking-wide uppercase rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>PENGATURAN</span>
                  </button>
                </div>

                {/* Seksi Evaluasi Siswa (LKPD) dengan pemisah & jarak lega */}
                <div className="pt-3 mt-1 border-t border-white/10 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      if (lkpdProgress.gameCompleted) {
                        setShowLKPD(true);
                      } else {
                        setShowLKPDLockedAlert(true);
                      }
                    }}
                    data-lkpd-button="true"
                    className={`w-full h-12 text-sm font-bold tracking-wide uppercase rounded-2xl flex items-center justify-between px-4 border transition-colors cursor-pointer ${lkpdProgress.gameCompleted
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
                      : 'bg-white/4 hover:bg-white/10 text-slate-300 border-white/12'
                      }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {lkpdProgress.gameCompleted ? (
                        <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-amber-400" />
                      )}
                      <span>LKPD EVALUASI</span>
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${lkpdProgress.gameCompleted
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        }`}
                    >
                      {lkpdProgress.gameCompleted ? 'Terbuka' : 'Terkunci'}
                    </span>
                  </button>
                </div>
              </div>

              {isGamepadConnected && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-slate-400 tracking-wide">
                  <span>↕↔ Pilih</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1">
                    <GamepadBadge button="A" visible size="sm" />
                    <span>Konfirmasi</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1">
                    <GamepadBadge button="B" visible size="sm" />
                    <span>Kembali</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* === HUD PERMAINAN & KONTROL SENTUH MOBILE === */}
      {gameState === 'playing' && (
        <>
          <PlayingHUD
            player={player}
            targetColorId={targetColorId}
            instructionClue={activeInstructionClue}
            showHint={showHint}
            wrongStreakOnTarget={wrongStreakOnTarget}
            onToggleHint={() => setShowHint((prev) => !prev)}
            currentWeapon={currentWeapon}
            unlockedWeapons={getUnlockedWeaponsForStage(player.stage)}
            ammo={ammo}
            bossHp={bossHp}
            bossMaxHp={bossMaxHp}
            bossPhase={currentBossPhase}
            activeCrystalColorId={activeCrystalColorId}
            shotFeedback={shotFeedback}
            platformMode={platformMode}
            mobileOrientation={mobileOrientation}
            isGamepadConnected={isGamepadConnected}
            vrComfortVignetteActive={vrComfortVignetteActive}
            onSwitchWeapon={(type) => {
              if (!getUnlockedWeaponsForStage(player.stage).includes(type)) return;
              weaponsRef.current?.switchWeapon(type);
              setCurrentWeapon(type);
            }}
            onPause={() => {
              inputManagerRef.current.resetAll();
              playerVel.current.set(0, 0, 0);
              inputManagerRef.current.desktop.releasePointerLock();
              setGameState('paused');
            }}
            onToggleMute={() => {
              const m = sound.toggleMute();
              setIsMuted(m);
            }}
            onToggleFullscreen={handleToggleFullscreen}
            isFullscreen={isFullscreen}
            onExitVR={() => {
              vrManagerRef.current?.exitVR();
            }}
            isMuted={isMuted}
            hitmarkerActive={hitmarkerActive}
            hitmarkerCrit={hitmarkerCrit}
            hitmarkerWrong={hitmarkerWrong}
            playerDamageFlash={playerDamageFlash}
            difficulty={settings.difficulty ?? 'normal'}
            characterId={settings.characterId ?? 'raka'}
            onTriggerAbility={handleTriggerAbility}
          />

          {platformMode === 'mobile' && !isGamepadConnected && (
            <MobileTouchControls
              mobileInput={inputManagerRef.current.mobile}
              currentWeapon={currentWeapon}
              unlockedWeapons={getUnlockedWeaponsForStage(player.stage)}
              onSwitchWeapon={(type) => {
                if (!getUnlockedWeaponsForStage(player.stage).includes(type)) return;
                weaponsRef.current?.switchWeapon(type);
                setCurrentWeapon(type);
              }}
              characterId={settings.characterId ?? 'raka'}
              abilityCooldownLeft={player.abilityCooldownLeft ?? 0}
              abilityActiveLeft={player.abilityActiveLeft ?? 0}
              onTriggerAbility={handleTriggerAbility}
              settings={settings}
              mobileOrientation={mobileOrientation}
            />
          )}
        </>
      )}

      {/* === MODAL TRANSISI EDUKASI ANTARSTAGE === */}
      <AnimatedPresence show={gameState === 'stage_transition'}>
        <StageTransitionModal
          mode={stageModalMode}
          stageNumber={stageModalNumber}
          stageScoreBonus={STAGE_DEFINITIONS[stageModalNumber].stageClearBonus}
          stageScore={stageClearScore}
          onContinue={handleContinueFromStageTransition}
          isGamepadConnected={isGamepadConnected}
        />
      </AnimatedPresence>

      {/* === TRANSISI LAYAR MERAH SAAT PEMAIN KALAH === */}
      {isPlayerDying && (
        <div
          className="fixed inset-0 z-40 pointer-events-none bg-red-600/80 animate-pulse transition-opacity duration-700"
          style={{
            background:
              'radial-gradient(circle at center, rgba(220, 38, 38, 0.72) 0%, rgba(127, 29, 29, 0.94) 100%)',
          }}
        />
      )}

      {/* === MODAL PERMAINAN BERAKHIR (GAME OVER) === */}
      <AnimatedPresence show={gameState === 'gameover' && Boolean(runSummary) && !isVRActive && platformMode !== 'vr'}>
        {runSummary && (
          <GameOverModal
            summary={runSummary}
            score={finalScore}
            onRestart={handleStartRun}
            onReturnToMenu={handleReturnToMenu}
            isGamepadConnected={isGamepadConnected}
          />
        )}
      </AnimatedPresence>

      {/* === MODAL KEMENANGAN (VICTORY) === */}
      <AnimatedPresence show={gameState === 'victory' && Boolean(runSummary) && !isVRActive && platformMode !== 'vr'}>
        {runSummary && (
          <VictoryModal
            summary={runSummary}
            score={finalScore}
            onRestart={handleStartRun}
            onReturnToMenu={handleReturnToMenu}
            onOpenLKPD={() => {
              handleReturnToMenu();
              setShowLKPD(true);
            }}
            isGamepadConnected={isGamepadConnected}
          />
        )}
      </AnimatedPresence>

      {/* === MODAL JEDA (PAUSE) === */}
      <AnimatedPresence show={gameState === 'paused' && !isVRActive && platformMode !== 'vr'}>
        <PauseModal
          onResume={() => {
            setGameState('playing');
            if (inputManagerRef.current.mode === 'desktop') {
              inputManagerRef.current.desktop.requestPointerLock();
            }
          }}
          onRestart={handleStartRun}
          onOpenSettings={() => setShowSettings(true)}
          onReturnToMenu={handleReturnToMenu}
          onToggleMute={() => {
            const m = sound.toggleMute();
            setIsMuted(m);
          }}
          isMuted={isMuted}
          isGamepadConnected={isGamepadConnected}
        />
      </AnimatedPresence>

      {/* === MODAL PEMILIHAN 2 KARAKTER SEBELUM MULAI MISI === */}
      <AnimatedPresence show={showMissionSetup && !isVRActive && platformMode !== 'vr'}>
        <MissionSetupModal
          selectedCharacter={settings.characterId ?? 'raka'}
          onSelectCharacter={(characterId) =>
            setSettings((prev) => ({ ...prev, characterId }))
          }
          onConfirmStart={() => {
            setShowMissionSetup(false);
            handleStartRun();
          }}
          onClose={() => setShowMissionSetup(false)}
          isGamepadConnected={isGamepadConnected}
        />
      </AnimatedPresence>

      {/* === MODAL CARA BERMAIN (TUTORIAL) === */}
      <AnimatedPresence show={showTutorial && !isVRActive}>
        <TutorialModal
          platformMode={platformMode}
          isGamepadConnected={isGamepadConnected}
          onClose={() => setShowTutorial(false)}
          onStartMission={() => {
            setShowTutorial(false);
            handleStartRun();
          }}
        />
      </AnimatedPresence>

      {/* === MODAL PENGATURAN (SETTINGS) === */}
      <AnimatedPresence show={showSettings && !isVRActive}>
        <SettingsModal
          settings={settings}
          onUpdateSettings={setSettings}
          isMuted={isMuted}
          onToggleMute={() => {
            const m = sound.toggleMute();
            setIsMuted(m);
          }}
          onClose={() => setShowSettings(false)}
          isGamepadConnected={isGamepadConnected}
          platformMode={platformMode}
          mobileOrientation={mobileOrientation}
        />
      </AnimatedPresence>

      {/* === MODAL PERINGATAN LKPD TERKUNCI === */}
      <AnimatedPresence show={showLKPDLockedAlert && !isVRActive}>
        <div className="fixed inset-0 bg-[#050811]/85 backdrop-blur-md flex items-center justify-center p-4 z-50 font-sans text-white ui-backdrop-enter">
          <div
            data-ui-board="true"
            className="max-w-md w-full bg-[#090d18] border border-amber-400/35 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center ui-panel-enter"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                AKSES TERKUNCI
              </span>
              <button
                type="button"
                onClick={() => setShowLKPDLockedAlert(false)}
                className="p-1.5 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-amber-300 mb-3">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              Selesaikan Game Terlebih Dahulu!
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-5">
              LKPD Evaluasi Interaktif hanya terbuka setelah kamu menamatkan seluruh misi dari{' '}
              <strong className="text-white">Stage 1, Stage 2, hingga mengalahkan Boss CHROMA TITAN di Stage 3</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setShowLKPDLockedAlert(false);
                  handleStartRun();
                }}
                className="w-full h-11 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wide rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>MULAI MISI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLKPDLockedAlert(false)}
                className="w-full h-11 bg-white/6 hover:bg-white/12 border border-white/15 text-white font-bold text-xs uppercase tracking-wide rounded-2xl cursor-pointer"
              >
                MENGERTI
              </button>
            </div>
          </div>
        </div>
      </AnimatedPresence>

      {/* === MODAL LKPD EVALUASI INTERAKTIF === */}
      <AnimatedPresence show={showLKPD && !isVRActive}>
        <LKPDModal
          progress={lkpdProgress}
          onClose={() => setShowLKPD(false)}
        />
      </AnimatedPresence>
    </div>
  );
};

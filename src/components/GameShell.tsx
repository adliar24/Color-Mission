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
import { AnimatedPresence } from './AnimatedPresence';
import { GamepadBadge } from './GamepadBadge';
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
} from '../game/types';
import {
  STAGE_DEFINITIONS,
  BOSS_PHASES,
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
} from 'lucide-react';

interface GameShellProps {
  autostart?: boolean;
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

function detectOptimalQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'high';
  const isMobile =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 1 ||
    window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  if (isMobile || cores <= 4 || memory <= 4) {
    return 'medium';
  }
  return 'high';
}

const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  mobileGyroEnabled: false,
  hapticsEnabled: true,
  keyboardCameraMode: true,
  graphicsQuality: detectOptimalQuality(),
  vrTurnMode: 'snap',
  vrSnapAngle: 45,
  vrSmoothTurnSpeed: 2.0,
  vrMovementMode: 'smooth',
  vrComfortVignette: true,
};

export const GameShell: React.FC<GameShellProps> = ({ autostart = false }) => {
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
  const [mobileOrientation, setMobileOrientation] = useState<'landscape' | 'portrait'>('landscape');
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

  // Pengaturan yang disimpan di localStorage
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('color_mission_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
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
  ]);

  const menuCallbacksRef = useRef<{
    startRun: () => void;
    returnToMenu: () => void;
    continueStage: () => void;
  }>({
    startRun: () => {},
    returnToMenu: () => {},
    continueStage: () => {},
  });

  const vrTriggerReleaseGuardRef = useRef<boolean>(false);

  const vrMenuInfoRef = useRef({
    stageModalMode,
    stageModalNumber,
    stageClearScore,
    runSummary,
    finalScore,
    isMuted,
  });

  useEffect(() => {
    vrMenuInfoRef.current = {
      stageModalMode,
      stageModalNumber,
      stageClearScore,
      runSummary,
      finalScore,
      isMuted,
    };
  }, [stageModalMode, stageModalNumber, stageClearScore, runSummary, finalScore, isMuted]);

  useEffect(() => {
    try {
      localStorage.setItem('color_mission_settings', JSON.stringify(settings));
    } catch {}
    if (rendererRef.current) {
      const pixelRatio =
        settings.graphicsQuality === 'low'
          ? 1.0
          : settings.graphicsQuality === 'medium'
          ? Math.min(window.devicePixelRatio, 1.15)
          : Math.min(window.devicePixelRatio, 1.5);
      rendererRef.current.setPixelRatio(pixelRatio);
      rendererRef.current.shadowMap.enabled = settings.graphicsQuality === 'high';
      if (arenaRef.current && 'setGraphicsQuality' in arenaRef.current) {
        (arenaRef.current as CyberArena).setGraphicsQuality(settings.graphicsQuality);
      }
    }
  }, [settings]);

  const triggerShotBanner = useCallback((fb: ShotFeedback) => {
    setShotFeedback(fb);
  }, []);

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
          const stageDef = STAGE_DEFINITIONS[stageNum];
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
        const currentStageDef = STAGE_DEFINITIONS[pStats.stage];
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

    const initialPixelRatio =
      stateRef.current.settings.graphicsQuality === 'high'
        ? Math.min(window.devicePixelRatio, 1.25)
        : 1.0;

    const renderer = new THREE.WebGLRenderer({
      antialias: stateRef.current.settings.graphicsQuality === 'high',
      powerPreference: 'high-performance',
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

    const vrWatch = new VRWristWatch();
    const vrSpatialMenu = new VRSpatialMenu();
    const vrHandGestures = new VRHandGestures();
    playerRig.add(vrSpatialMenu.group);

    const vrManager = new VRManager(renderer, playerRig, (active) => {
      setIsVRActive(active);
      if (active) {
        setVrErrorMsg(null);
        vrManager.leftController.add(vrWatch.group);
        inputManagerRef.current.setMode('vr');
        setPlatformMode('vr');
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
      _menuTargetWorld.copy(_menuCamPos).addScaledVector(_menuCamDir, 2.25);
      _menuTargetWorld.y = THREE.MathUtils.clamp(_menuCamPos.y - 0.06, 1.1, 2.45);
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

    renderer.setAnimationLoop((now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const currentState = stateRef.current.gameState;
      const curSettings = stateRef.current.settings;
      const isPresentingVR = renderer.xr.isPresenting;

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
            vrManager.consumeRightSelectPulse()
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
      if (currentState !== 'playing' || stateRef.current.showSettings || stateRef.current.showTutorial) {
        const menuGp = inputManagerRef.current.pollMenuGamepad();
        if (menuGp.back || menuGp.start) {
          if (stateRef.current.showTutorial) {
            setShowTutorial(false);
          } else if (stateRef.current.showSettings) {
            setShowSettings(false);
          } else if (currentState === 'paused' && menuGp.back) {
            setGameState('playing');
          } else if ((currentState === 'gameover' || currentState === 'victory') && menuGp.back) {
            menuCallbacksRef.current.returnToMenu();
          }
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
        if (!prevVRMenuVisible || prevVRMenuState !== currentState) {
          positionVRMenuInFrontOfCamera();
        }
        prevVRMenuVisible = true;
        prevVRMenuState = currentState;
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
          const dispatchVRMenuAction = (act: VRMenuAction) => {
            if (act === 'start_mission' || act === 'restart') {
              setShowTutorial(false);
              setShowSettings(false);
              menuCallbacksRef.current.startRun();
            } else if (act === 'open_tutorial') {
              setShowTutorial(true);
            } else if (act === 'open_settings') {
              setShowSettings(true);
            } else if (act === 'close_subpanel') {
              setShowTutorial(false);
              setShowSettings(false);
            } else if (act === 'exit_vr') {
              vrManager.exitVR();
            } else if (act === 'continue_stage') {
              vrTriggerReleaseGuardRef.current = true;
              menuCallbacksRef.current.continueStage();
            } else if (act === 'resume') {
              vrTriggerReleaseGuardRef.current = true;
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
            }
          };
          dispatchVRMenuAction(action);
        }
      } else {
        prevVRMenuVisible = false;
        prevVRMenuState = null;
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

        // --- 1. Pergerakan & Fisika Pemain ---
        cameraRot.current.yaw += cmd.lookDeltaX;
        cameraRot.current.pitch = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, cameraRot.current.pitch + cmd.lookDeltaY)
        );

        const moveSpeed = 12.0 * pStats.moveSpeedMult;
        _scratchWishDir.set(cmd.moveX, 0, cmd.moveZ);

        if (_scratchWishDir.lengthSq() > 0.001) {
          if (_scratchWishDir.lengthSq() > 1) _scratchWishDir.normalize();
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

        if (
          cmd.weaponSwitch &&
          getUnlockedWeaponsForStage(pStats.stage).includes(cmd.weaponSwitch)
        ) {
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
            const candidateDir = new THREE.Vector3();
            const enemyPos = new THREE.Vector3();
            for (const e of enemies.enemies) {
              if (e.state === 'dead') continue;
              e.mesh.getWorldPosition(enemyPos);
              enemyPos.y += 0.95;
              candidateDir.subVectors(enemyPos, _scratchAimOrigin);
              const dist = candidateDir.length();
              if (dist < 0.8 || dist > 32) continue;
              candidateDir.divideScalar(dist);
              const d = candidateDir.dot(_scratchAimDir);
              if (d > bestDot) {
                bestDot = d;
                bestDir = candidateDir.clone();
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

        if (cmd.shoot && !vrTriggerReleaseGuardRef.current) {
          const fired = weapons.fire();
          if (fired) {
            inputManagerRef.current.triggerHaptic(
              'shoot',
              curSettings,
              vrManager.currentSession
            );
            const muzzlePos = new THREE.Vector3();

            if (isPresentingVR && cmd.vrAimRay) {
              const origin = new THREE.Vector3(...cmd.vrAimRay.origin);
              const dir = new THREE.Vector3(...cmd.vrAimRay.direction).normalize();
              _scratchRaycaster.set(origin, dir);
              muzzlePos.copy(origin);
            } else {
              _scratchRaycaster.setFromCamera(_scratchScreenCenter, camera);
              weapons.getMuzzleWorldPosition(muzzlePos);
            }

            const wDef = WEAPON_REGISTRY[weapons.currentWeapon];
            const isBossFightActive =
              bossInstanceRef.current !== null && bossInstanceRef.current.state !== 'dead';
            const activeShotColor = isBossFightActive
              ? activeCrystalColorIdRef.current
                ? getColorDef(activeCrystalColorIdRef.current).hex
                : '#94a3b8'
              : wDef.color;

            particles.emit(muzzlePos, 5, activeShotColor, 0.8);

            enemies.checkProjectileInterception(muzzlePos, _scratchRaycaster.ray.direction);

            let targetPoint = muzzlePos
              .clone()
              .add(_scratchRaycaster.ray.direction.clone().multiplyScalar(50));

            if (weapons.currentWeapon === 'plasma_smg') {
              tracers.addPlasmaProjectile(
                muzzlePos,
                _scratchRaycaster.ray.direction,
                wDef.damage,
                wDef.projectileSpeed || 58,
                activeShotColor
              );
              tracers.addLaserBeam(
                muzzlePos,
                muzzlePos.clone().add(_scratchRaycaster.ray.direction.clone().multiplyScalar(8)),
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
                  const hitPoint = new THREE.Vector3();
                  _scratchRaycaster.ray.intersectBox(_scratchEnemyBox, hitPoint);
                  targetPoint.copy(hitPoint);

                  const isHeadshot =
                    hitPoint.y >
                    enemy.position.y + (_scratchEnemyBox.max.y - _scratchEnemyBox.min.y) * 0.68;

                  const shootDir = new THREE.Vector3()
                    .subVectors(enemy.position, playerPos.current)
                    .normalize();

                  const baseHitDmg =
                    weapons.currentWeapon === 'cyber_shotgun'
                      ? wDef.damage * 4
                      : wDef.damage;

                  processEnemyHit(enemy, hitPoint, baseHitDmg, isHeadshot, shootDir);

                  if (weapons.currentWeapon !== 'railgun') break;
                }
              }

              if (weapons.currentWeapon === 'laser_rifle') {
                tracers.addLaserBeam(muzzlePos, targetPoint, activeShotColor, 0.055, 0.13);
              } else if (weapons.currentWeapon === 'cyber_shotgun') {
                for (let p = 0; p < 8; p++) {
                  const spreadDir = _scratchRaycaster.ray.direction
                    .clone()
                    .add(
                      new THREE.Vector3(
                        (Math.random() - 0.5) * 0.13,
                        (Math.random() - 0.5) * 0.13,
                        (Math.random() - 0.5) * 0.13
                      )
                    )
                    .normalize();
                  const pelletEnd = muzzlePos.clone().add(spreadDir.multiplyScalar(32));
                  tracers.addLaserBeam(muzzlePos, pelletEnd, activeShotColor, 0.034, 0.09);
                }
              } else if (weapons.currentWeapon === 'railgun') {
                tracers.addLaserBeam(muzzlePos, targetPoint, activeShotColor, 0.12, 0.22);
                tracers.addLaserBeam(muzzlePos, targetPoint, '#ffffff', 0.04, 0.18);
              }
            }

            arena.hazardNodes.forEach((node: HazardNode) => {
              if (!node.isExploded) {
                const nodeBox = new THREE.Box3().setFromObject(node.mesh);
                if (_scratchRaycaster.ray.intersectsBox(nodeBox)) {
                  node.isExploded = true;
                  node.mesh.visible = false;
                  sound.playEmp();
                  particles.emit(node.position, 65, '#38bdf8', 2.8);
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
        const stageDef = STAGE_DEFINITIONS[stageNum];
        const stageKills = stateRef.current.player.stageKills;

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
            const boss = enemies.spawnEnemy('chroma_titan', initialBossColor, bossPos, 1.0, 1.0);
            enemies.triggerTargetGracePeriod(3.0);
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

        enemies.update(
          dt,
          playerPos.current,
          (dmg: number) => {
            if (isPlayerDyingRef.current) return;
            // Efek flicker merah saat pemain terkena tembakan musuh + Haptic feedback
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
              const res = calculatePlayerDamage(prev.hp, prev.shield, dmg);
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

      if (
        isPresentingVR ||
        (currentState !== 'paused' && currentState !== 'stage_transition')
      ) {
        renderer.render(scene, camera);
      }
    });

    return () => {
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
    processEnemyHit,
    triggerShotBanner,
  ]);

  // Kembali ke Menu Utama dengan Ruangan 3D Bersih Tanpa Musuh & Tanpa Boss
  const handleReturnToMenu = () => {
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
    const initialColor = STAGE_DEFINITIONS[1].colorPool[0];
    setTargetColorId(initialColor);
    setWrongStreakOnTarget(0);
    setShowHint(false);

    setPlayer({
      ...INITIAL_PLAYER_STATS,
      stage: 1,
    });
    stageStartScoreRef.current = 0;
    setStageClearScore(0);

    playerPos.current.set(0, 1.7, 0);
    playerVel.current.set(0, 0, 0);
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

    // stage_intro -> mulai pertempuran pada stageModalNumber
    const activeStage = stageModalNumber;
    const activeStageDef = STAGE_DEFINITIONS[activeStage];
    const firstTarget = activeStageDef.colorPool[0];
    setTargetColorId(firstTarget);
    setWrongStreakOnTarget(0);
    setShowHint(false);

    if (arenaRef.current && 'resetArenaPickups' in arenaRef.current) {
      arenaRef.current.resetArenaPickups(activeStage);
    }

    if (enemiesRef.current) {
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
      vrManagerRef.current.enterVR().catch(() => {});
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

  // Navigasi Keyboard untuk Menu & Modal (Esc: kembali/lanjutkan, Panah: pindah tombol, Enter: konfirmasi)
  useEffect(() => {
    const isMenuActive = gameState !== 'playing' || showSettings || showTutorial;
    if (!isMenuActive) return;

    // Fokus otomatis pada tombol utama saat papan berpindah
    const focusTimer = setTimeout(() => {
      const board = getActiveUiBoard();
      if (board) focusDefaultBoardControl(board);
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      const board = getActiveUiBoard();
      if (!board) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showSettings) {
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
  }, [gameState, showSettings, showTutorial, mobileFullscreenConfirmed, isGamepadConnected]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
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
    } catch {}
    if (orientation) {
      setMobileOrientation(orientation);
      try {
        const ori = screen.orientation as unknown as {
          lock?: (o: string) => Promise<void>;
        };
        if (ori?.lock) {
          await ori.lock(orientation);
        }
      } catch {}
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
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

      {/* Backdrop Transisi Halus (Mencegah kedipan antar Menu Utama, Papan Stage, dan Arena 3D) */}
      <div
        className={`fixed inset-0 z-20 pointer-events-none transition-all duration-300 ease-out ${
          gameState === 'title'
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
        !(platformMode === 'mobile' && !mobileFullscreenConfirmed) &&
        !(platformMode === 'vr' && !isVRActive) && (
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
                onClick={handleStartRun}
                data-start="true"
                className="w-full h-13 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-base font-black tracking-wide uppercase rounded-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>MULAI MISI</span>
              </button>

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
            isGamepadConnected={isGamepadConnected}
            vrComfortVignetteActive={vrComfortVignetteActive}
            onSwitchWeapon={(type) => {
              if (!getUnlockedWeaponsForStage(player.stage).includes(type)) return;
              weaponsRef.current?.switchWeapon(type);
              setCurrentWeapon(type);
            }}
            onPause={() => {
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
      <AnimatedPresence show={gameState === 'gameover' && Boolean(runSummary)}>
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
      <AnimatedPresence show={gameState === 'victory' && Boolean(runSummary)}>
        {runSummary && (
          <VictoryModal
            summary={runSummary}
            score={finalScore}
            onRestart={handleStartRun}
            onReturnToMenu={handleReturnToMenu}
            isGamepadConnected={isGamepadConnected}
          />
        )}
      </AnimatedPresence>

      {/* === MODAL JEDA (PAUSE) === */}
      <AnimatedPresence show={gameState === 'paused'}>
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

      {/* === MODAL CARA BERMAIN (TUTORIAL) === */}
      <AnimatedPresence show={showTutorial}>
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
      <AnimatedPresence show={showSettings}>
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
        />
      </AnimatedPresence>
    </div>
  );
};

export type GameMode = 'fps' | 'gdd';

export type GameState =
  | 'title'
  | 'tutorial'
  | 'playing'
  | 'stage_transition'
  | 'draft'
  | 'paused'
  | 'gameover'
  | 'victory';

export type ColorCategory = 'primer' | 'sekunder' | 'tersier';

export type RYBColorId =
  | 'red'
  | 'yellow'
  | 'blue'
  | 'orange'
  | 'green'
  | 'purple'
  | 'red_orange'
  | 'yellow_orange'
  | 'yellow_green'
  | 'blue_green'
  | 'blue_purple'
  | 'red_purple';

export type NeutralColorId = 'white' | 'black';
export type GameColorId = RYBColorId | NeutralColorId;

export interface RYBColorDef {
  id: GameColorId;
  nameId: string; // Nama Bahasa Indonesia (misal: "Merah", "Jingga", "Merah-Jingga")
  nameEn: string;
  category: ColorCategory;
  categoryLabelId: string; // "Primer" | "Sekunder" | "Tersier"
  hex: string;
  emissiveHex: string;
  recipeTextId: string; // misal: "Warna dasar" atau "Merah + Kuning"
  ingredients?: [RYBColorId, RYBColorId];
  shortDescId: string;
  conceptualHintId: string; // Petunjuk konseptual tanpa membocorkan nama jawaban secara langsung
  memoryHintId: string; // Bantuan pengingat setelah beberapa kali salah menembak
}

export type InstructionDisplayMode = 'direct' | 'mixing';

export interface ColorInstructionClue {
  targetColorId: GameColorId;
  displayMode: InstructionDisplayMode;
  // Hanya digunakan bila displayMode === 'direct' (Stage 1)
  directNameId?: string;
  directHex?: string;
  // Digunakan bila displayMode === 'mixing' (Stage 2 & Stage 3)
  ingredient1?: {
    id: GameColorId;
    nameId: string;
    hex: string;
  };
  ingredient2?: {
    id: GameColorId;
    nameId: string;
    hex: string;
  };
  questionPromptId: string;
  conceptualHintId: string;
  memoryHintId: string;
  solvedFormulaTextId: string; // Ditampilkan hanya SETELAH target berhasil dieliminasi
}

export type WeaponType = 'laser_rifle' | 'cyber_shotgun' | 'railgun' | 'plasma_smg';

export interface WeaponDef {
  id: WeaponType;
  name: string;
  category: string;
  damage: number;
  fireRate: number;
  magSize: number;
  reloadTime: number;
  spread: number;
  pellets?: number;
  projectileSpeed?: number;
  color: string;
  glowColor: string;
  soundType: 'laser' | 'shotgun' | 'railgun' | 'plasma';
  description: string;
  recoil: number;
}

export type EnemyType = 'chromabot_normal' | 'chromabot_elite' | 'chroma_titan';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  role: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  shootCooldownMin: number;
  shootCooldownMax: number;
  projectileSpeed: number;
  projectileSize: number;
  scoreValue: number;
  dataCoreDrop: number;
  size: [number, number, number];
}

export type BossPhase = 1 | 2 | 3;

export interface BossPhaseDef {
  phase: BossPhase;
  title: string;
  category: ColorCategory;
  colorPool: GameColorId[];
  hpThresholdMax: number;
  hpThresholdMin: number;
  shootCooldownMult: number;
  projectileSpeedMult: number;
  description: string;
}

export interface StageDef {
  stageNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  category: ColorCategory;
  categoryLabel: string;
  instructionMode: InstructionDisplayMode;
  colorPool: RYBColorId[];
  targetEliminations: number; // 12, 18, 24
  hasBossAtEnd: boolean;
  bossMaxHp?: number;
  maxConcurrentEnemies: number;
  spawnIntervalSeconds: number;
  targetGracePeriodSeconds: number; // Jeda adaptasi 2-3 detik saat target baru muncul
  enemySpeedMult: number;
  enemyHpMult: number;
  eliteChance: number;
  stageClearBonus: number;
  description: string;
  learningTitle: string;
  learningSummary: string;
  learningPoints: string[];
}

export type UpgradeRarity = 'common' | 'rare' | 'legendary';

export type DifficultyLevel = 'easy' | 'normal' | 'hard';
export type CharacterId = 'raka' | 'naya';

export interface DifficultyConfig {
  id: DifficultyLevel;
  label: string;
  tagline: string;
  description: string;
  playerInitialHp: number;
  playerInitialShield: number;
  enemySpeedMult: number;
  enemyHpMult: number;
  bossHpMult: number;
  enemyDamageMult: number;
  wrongColorPenalty: number;
  enemyShootCooldownMult: number;
  enemyProjectileSpeedMult: number;
  graceBonusSeconds: number;
  autoHintWrongStreak: number;
  stageTargetEliminations: [number, number, number];
  eliteChanceMult: number;
  scoreMult: number;
}

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  genderLabel: string;
  codename: string;
  role: string;
  imagePath: string;
  accentHex: string;
  abilityName: string;
  abilityDescription: string;
  abilityCooldownSeconds: number;
  abilityDurationSeconds: number;
  abilityHealPercent: number;
}

export interface CyberUpgrade {
  id: string;
  name: string;
  rarity: UpgradeRarity;
  rarityLabel: string;
  description: string;
  statModifier: {
    damageMult?: number;
    fireRateMult?: number;
    reloadTimeMult?: number;
    magSizeBonus?: number;
    maxHpAdd?: number;
    lifestealPercent?: number;
    moveSpeedMult?: number;
    dashCooldownMult?: number;
    shieldMaxAdd?: number;
    headshotBonusMult?: number;
  };
  synergyClue: string;
  icon: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  dataCores: number;
  totalDataCoresCollected: number;
  score: number;
  combo: number;
  bestCombo: number;
  kills: number;
  stageKills: number;
  headshots: number;
  shotsFired: number;
  correctHits: number;
  wrongHits: number;
  stage: 1 | 2 | 3;
  lifestealPercent: number;
  damageMult: number;
  fireRateMult: number;
  reloadTimeMult: number;
  magSizeBonus: number;
  moveSpeedMult: number;
  dashCooldownMult: number;
  overdriveDuration: number;
  headshotBonusMult: number;
  characterId?: CharacterId;
  difficulty?: DifficultyLevel;
  abilityCooldownLeft?: number;
  abilityActiveLeft?: number;
}

export interface MetaProgressionState {
  bankedDataCores: number;
  perks: Record<string, number>;
  stagesMastered: number[];
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type VRMovementMode = 'smooth' | 'teleport';
export type VRTurnMode = 'snap' | 'smooth';
export type SpeedPreset = 'slow' | 'normal' | 'fast' | 'custom';

export const SPEED_PRESET_CONFIG: Record<
  Exclude<SpeedPreset, 'custom'>,
  { moveSpeedPercent: number; cameraSpeedPercent: number; label: string }
> = {
  slow: { moveSpeedPercent: 40, cameraSpeedPercent: 40, label: 'LAMBAT' },
  normal: { moveSpeedPercent: 70, cameraSpeedPercent: 70, label: 'NORMAL' },
  fast: { moveSpeedPercent: 100, cameraSpeedPercent: 100, label: 'CEPAT' },
};

export function clampSteppedSpeedPercent(value: number): number {
  const snapped = Math.round(value / 10) * 10;
  return Math.max(10, Math.min(150, snapped));
}

export function resolveSpeedSettings(settings: GameSettings): {
  preset: SpeedPreset;
  moveSpeedPercent: number;
  cameraSpeedPercent: number;
  moveMult: number;
  cameraMult: number;
} {
  const preset: SpeedPreset = settings.speedPreset ?? 'normal';
  if (preset !== 'custom') {
    const cfg = SPEED_PRESET_CONFIG[preset];
    return {
      preset,
      moveSpeedPercent: cfg.moveSpeedPercent,
      cameraSpeedPercent: cfg.cameraSpeedPercent,
      moveMult: cfg.moveSpeedPercent / 100,
      cameraMult: cfg.cameraSpeedPercent / 100,
    };
  }
  const moveSpeedPercent = clampSteppedSpeedPercent(settings.moveSpeedPercent ?? 70);
  const cameraSpeedPercent = clampSteppedSpeedPercent(settings.cameraSpeedPercent ?? 70);
  return {
    preset,
    moveSpeedPercent,
    cameraSpeedPercent,
    moveMult: moveSpeedPercent / 100,
    cameraMult: cameraSpeedPercent / 100,
  };
}

export function clampAudioPercent(val: number): number {
  if (!Number.isFinite(val)) return 80;
  return Math.max(0, Math.min(100, Math.round(val / 5) * 5));
}

export function resolveAudioSettings(
  settings: Pick<GameSettings, 'bgmVolumePercent' | 'sfxVolumePercent'>
): {
  bgmVolumePercent: number;
  sfxVolumePercent: number;
  bgmGainScale: number;
  sfxGainScale: number;
} {
  const bgmVolumePercent = clampAudioPercent(settings.bgmVolumePercent ?? 85);
  const sfxVolumePercent = clampAudioPercent(settings.sfxVolumePercent ?? 65);
  return {
    bgmVolumePercent,
    sfxVolumePercent,
    bgmGainScale: bgmVolumePercent / 100,
    sfxGainScale: sfxVolumePercent / 100,
  };
}

export type MobileControlElementId =
  | 'joystick'
  | 'shoot'
  | 'jump'
  | 'ability'
  | 'weaponSwitch';

export interface MobileControlButtonConfig {
  xPercent: number;
  yPercent: number;
  scalePercent: number;
  opacityPercent: number;
}

export type MobileOrientationLayoutMap = Record<
  MobileControlElementId,
  MobileControlButtonConfig
>;

export interface MobileHudLayoutSettings {
  landscape: MobileOrientationLayoutMap;
  portrait: MobileOrientationLayoutMap;
}

export const MOBILE_CONTROL_LABELS: Record<MobileControlElementId, string> = {
  joystick: 'GERAK (ANALOG)',
  shoot: 'TEMBAK',
  jump: 'LOMPAT',
  ability: 'JURUS (SKILL)',
  weaponSwitch: 'GANTI SENJATA',
};

export const DEFAULT_MOBILE_HUD_LAYOUT: MobileHudLayoutSettings = {
  landscape: {
    joystick: { xPercent: 14, yPercent: 72, scalePercent: 100, opacityPercent: 85 },
    ability: { xPercent: 66, yPercent: 78, scalePercent: 100, opacityPercent: 85 },
    jump: { xPercent: 77, yPercent: 78, scalePercent: 100, opacityPercent: 85 },
    shoot: { xPercent: 89, yPercent: 75, scalePercent: 100, opacityPercent: 85 },
    weaponSwitch: { xPercent: 86, yPercent: 56, scalePercent: 100, opacityPercent: 85 },
  },
  portrait: {
    joystick: { xPercent: 21, yPercent: 84, scalePercent: 100, opacityPercent: 85 },
    ability: { xPercent: 49, yPercent: 87, scalePercent: 100, opacityPercent: 85 },
    jump: { xPercent: 66, yPercent: 87, scalePercent: 100, opacityPercent: 85 },
    shoot: { xPercent: 84, yPercent: 85, scalePercent: 100, opacityPercent: 85 },
    weaponSwitch: { xPercent: 80, yPercent: 74, scalePercent: 100, opacityPercent: 85 },
  },
};

export function clampMobileButtonConfig(
  cfg: Partial<MobileControlButtonConfig> | undefined,
  fallback: MobileControlButtonConfig
): MobileControlButtonConfig {
  const rawX = Number.isFinite(cfg?.xPercent) ? Number(cfg!.xPercent) : fallback.xPercent;
  const rawY = Number.isFinite(cfg?.yPercent) ? Number(cfg!.yPercent) : fallback.yPercent;
  const rawScale = Number.isFinite(cfg?.scalePercent)
    ? Number(cfg!.scalePercent)
    : fallback.scalePercent;
  const rawOpacity = Number.isFinite(cfg?.opacityPercent)
    ? Number(cfg!.opacityPercent)
    : fallback.opacityPercent;

  return {
    xPercent: Math.max(6, Math.min(94, Number(rawX.toFixed(1)))),
    yPercent: Math.max(12, Math.min(92, Number(rawY.toFixed(1)))),
    scalePercent: Math.max(50, Math.min(160, Math.round(rawScale / 5) * 5)),
    opacityPercent: Math.max(15, Math.min(100, Math.round(rawOpacity / 5) * 5)),
  };
}

export function resolveMobileHudLayout(
  settings: Pick<GameSettings, 'mobileHudLayout'> | undefined,
  orientation: 'landscape' | 'portrait' = 'landscape'
): MobileOrientationLayoutMap {
  const defaults = DEFAULT_MOBILE_HUD_LAYOUT[orientation];
  const saved = settings?.mobileHudLayout?.[orientation];
  return {
    joystick: clampMobileButtonConfig(saved?.joystick, defaults.joystick),
    shoot: clampMobileButtonConfig(saved?.shoot, defaults.shoot),
    jump: clampMobileButtonConfig(saved?.jump, defaults.jump),
    ability: clampMobileButtonConfig(saved?.ability, defaults.ability),
    weaponSwitch: clampMobileButtonConfig(saved?.weaponSwitch, defaults.weaponSwitch),
  };
}

export interface GameSettings {
  mouseSensitivity: number;
  touchSensitivity: number;
  mobileGyroEnabled: boolean;
  gyroSensitivity?: number;
  hapticsEnabled: boolean;
  keyboardCameraMode?: boolean;
  graphicsQuality: GraphicsQuality;
  vrTurnMode: VRTurnMode;
  vrSnapAngle: number;
  vrSmoothTurnSpeed: number;
  vrMovementMode: VRMovementMode;
  vrComfortVignette: boolean;
  speedPreset?: SpeedPreset;
  moveSpeedPercent?: number;
  cameraSpeedPercent?: number;
  bgmVolumePercent?: number;
  sfxVolumePercent?: number;
  difficulty?: DifficultyLevel;
  characterId?: CharacterId;
  mobileHudLayout?: MobileHudLayoutSettings;
}

export type HapticEventType =
  | 'shoot'
  | 'enemyHit'
  | 'kill'
  | 'wrong'
  | 'playerDamage'
  | 'dash'
  | 'emp';

export interface RunSummary {
  score: number;
  stagesCleared: number;
  masteredCategories: ColorCategory[];
  kills: number;
  headshots: number;
  shotsFired: number;
  correctHits: number;
  wrongHits: number;
  accuracy: number;
  bestCombo: number;
  dataCoresCollected: number;
  timeSurvivedSeconds: number;
  bossDefeated: boolean;
  won: boolean;
  difficulty?: DifficultyLevel;
  characterId?: CharacterId;
}

export type ShotFeedbackType = 'correct' | 'wrong' | 'streak' | 'pickup' | null;

export interface ShotFeedback {
  type: ShotFeedbackType;
  title: string;
  subtitle?: string;
  colorHex?: string;
  points?: number;
  weaponType?: WeaponType;
  timestamp: number;
}

export type PlatformMode = 'desktop' | 'mobile' | 'vr';

export interface GameplayInputCommand {
  moveX: number;
  moveZ: number;
  lookDeltaX: number;
  lookDeltaY: number;
  jump: boolean;
  shoot: boolean;
  reload: boolean;
  dash: boolean;
  emp: boolean;
  overdrive: boolean;
  useAbility?: boolean;
  pause: boolean;
  toggleHint?: boolean;
  weaponSwitch: WeaponType | null;
  weaponCycle?: boolean;
  vrAimRay?: {
    origin: [number, number, number];
    direction: [number, number, number];
  } | null;
  vrTeleportRequest?: boolean;
}

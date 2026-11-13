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
}

export interface MetaProgressionState {
  bankedDataCores: number;
  perks: Record<string, number>;
  stagesMastered: number[];
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type VRMovementMode = 'smooth' | 'teleport';
export type VRTurnMode = 'snap' | 'smooth';

export interface GameSettings {
  mouseSensitivity: number;
  touchSensitivity: number;
  mobileGyroEnabled: boolean;
  hapticsEnabled: boolean;
  keyboardCameraMode?: boolean;
  graphicsQuality: GraphicsQuality;
  vrTurnMode: VRTurnMode;
  vrSnapAngle: number;
  vrSmoothTurnSpeed: number;
  vrMovementMode: VRMovementMode;
  vrComfortVignette: boolean;
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
}

export type ShotFeedbackType = 'correct' | 'wrong' | 'streak' | null;

export interface ShotFeedback {
  type: ShotFeedbackType;
  title: string;
  subtitle?: string;
  colorHex?: string;
  points?: number;
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
  pause: boolean;
  toggleHint?: boolean;
  weaponSwitch: WeaponType | null;
  vrAimRay?: {
    origin: [number, number, number];
    direction: [number, number, number];
  } | null;
  vrTeleportRequest?: boolean;
}

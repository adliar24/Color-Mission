import {
  WeaponDef,
  WeaponType,
  EnemyDef,
  EnemyType,
  CyberUpgrade,
  PlayerStats,
  RunSummary,
  RYBColorId,
  ColorCategory,
} from './types';
import { STAGE_DEFINITIONS, BOSS_DEFEAT_BONUS, BOSS_PHASES, getBossPhaseForHp } from './stages';
import {
  RYB_COLOR_REGISTRY,
  ALL_RYB_COLORS,
  PRIMARY_COLOR_IDS,
  SECONDARY_COLOR_IDS,
  TERTIARY_COLOR_IDS,
  getColorDef,
  getColorsByCategory,
  selectNextTargetColor,
  buildColorInstructionClue,
} from './colors';

export {
  STAGE_DEFINITIONS,
  BOSS_DEFEAT_BONUS,
  BOSS_PHASES,
  getBossPhaseForHp,
  RYB_COLOR_REGISTRY,
  ALL_RYB_COLORS,
  PRIMARY_COLOR_IDS,
  SECONDARY_COLOR_IDS,
  TERTIARY_COLOR_IDS,
  getColorDef,
  getColorsByCategory,
  selectNextTargetColor,
  buildColorInstructionClue,
};

export const BASE_ELIMINATION_SCORE = 100;

export const ACCURACY_DEFINITION_ID =
  'Akurasi dihitung dari jumlah tembakan pada musuh dengan warna target yang benar dibagi total tembakan × 100%.';

export const WEAPON_REGISTRY: Record<WeaponType, WeaponDef> = {
  laser_rifle: {
    id: 'laser_rifle',
    name: 'Pulse Laser Rifle',
    category: 'Senapan Presisi Hitscan',
    damage: 35,
    fireRate: 8.0,
    magSize: 36,
    reloadTime: 1.3,
    spread: 0.01,
    recoil: 0.014,
    color: '#22d3ee',
    glowColor: '#06b6d4',
    soundType: 'laser',
    description:
      'Senapan cahaya koheren berakurasi tinggi. Sangat konsisten untuk menarget Chromabots jarak menengah hingga jauh.',
  },
  cyber_shotgun: {
    id: 'cyber_shotgun',
    name: 'Glitch Scattergun',
    category: 'Sebaran Kinetik 8-Pellet',
    damage: 24,
    pellets: 8,
    fireRate: 1.5,
    magSize: 8,
    reloadTime: 1.7,
    spread: 0.06,
    recoil: 0.045,
    color: '#f43f5e',
    glowColor: '#fb7185',
    soundType: 'shotgun',
    description:
      'Tembakan sebar 8-pellet berdaya hancur tinggi pada jarak dekat. Pastikan bidikan tepat pada warna target.',
  },
  railgun: {
    id: 'railgun',
    name: 'Apex Railgun',
    category: 'Meriam Akselerator Magnetik',
    damage: 220,
    fireRate: 0.95,
    magSize: 4,
    reloadTime: 1.9,
    spread: 0.001,
    recoil: 0.07,
    color: '#c084fc',
    glowColor: '#e879f9',
    soundType: 'railgun',
    description:
      'Sinar akselerator berenergi masif untuk mengeliminasi Chromabot secara instan atau menguras Color Core milik Chroma Titan.',
  },
  plasma_smg: {
    id: 'plasma_smg',
    name: 'Sub-Zero Plasma SMG',
    category: 'Proyektil Plasma Cepat',
    damage: 25,
    fireRate: 13.0,
    magSize: 45,
    reloadTime: 1.15,
    spread: 0.03,
    projectileSpeed: 60,
    recoil: 0.018,
    color: '#34d399',
    glowColor: '#6ee7b7',
    soundType: 'plasma',
    description:
      'Senjata plasma otomatis dengan kecepatan tembak sangat tinggi dan waktu isi ulang singkat.',
  },
};

/**
 * Arketipe Musuh yang telah diseimbangkan (kecepatan diturunkan ~25-30% & jeda tembak lebih adil)
 * agar pemain memiliki waktu mencerna petunjuk pencampuran warna.
 */
export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyDef> = {
  chromabot_normal: {
    type: 'chromabot_normal',
    name: 'Chromabot Unit',
    role: 'Robot Penjaga Energi Warna',
    maxHp: 64,
    speed: 1.5, // Turun ~28% dari 2.1 untuk kenyamanan membidik & belajar
    damage: 10,
    attackRange: 23.0,
    shootCooldownMin: 4.2,
    shootCooldownMax: 5.8,
    projectileSpeed: 10.5,
    projectileSize: 0.3,
    scoreValue: 100,
    dataCoreDrop: 2,
    size: [1.1, 1.9, 1.1],
  },
  chromabot_elite: {
    type: 'chromabot_elite',
    name: 'Chromabot Elite',
    role: 'Penjaga Berlapis Armor',
    maxHp: 125,
    speed: 1.75, // Turun ~30% dari 2.5
    damage: 14,
    attackRange: 25.0,
    shootCooldownMin: 3.8,
    shootCooldownMax: 5.2,
    projectileSpeed: 11.5,
    projectileSize: 0.4,
    scoreValue: 100,
    dataCoreDrop: 5,
    size: [1.45, 2.4, 1.45],
  },
  chroma_titan: {
    type: 'chroma_titan',
    name: 'CHROMA TITAN',
    role: 'Colossus Spektrum Terakhir',
    maxHp: 1400,
    speed: 3.8, // Bergerak aktif mengejar & bermanuver di arena agar lebih menantang
    damage: 18,
    attackRange: 35.0,
    shootCooldownMin: 3.0,
    shootCooldownMax: 4.2,
    projectileSpeed: 13.0,
    projectileSize: 0.85,
    scoreValue: 5000,
    dataCoreDrop: 35,
    size: [3.8, 5.6, 3.2],
  },
};

export const UPGRADE_POOL: CyberUpgrade[] = [
  {
    id: 'nanite_siphon',
    name: 'Sifon Nanit Kritis',
    rarity: 'rare',
    rarityLabel: 'Langka',
    description: 'Eliminasi headshot pada target warna benar memulihkan 15% Kesehatan maksimum.',
    statModifier: { lifestealPercent: 0.15, headshotBonusMult: 0.25 },
    synergyClue: 'Sangat efektif saat dipadukan dengan Pulse Laser Rifle atau Apex Railgun.',
    icon: 'HeartPulse',
  },
  {
    id: 'overclock_burst',
    name: 'Ruang Tembak Overclock',
    rarity: 'common',
    rarityLabel: 'Umum',
    description: '+25% Kecepatan Tembak dan -20% Waktu Isi Ulang pada seluruh senjata.',
    statModifier: { fireRateMult: 1.25, reloadTimeMult: 0.8 },
    synergyClue: 'Mempercepat ritme tembakan dan meminimalkan jeda isi ulang.',
    icon: 'Zap',
  },
  {
    id: 'expanded_magazine',
    name: 'Kapasitor Amunisi Ekstra',
    rarity: 'common',
    rarityLabel: 'Umum',
    description: '+4 Peluru tambahan di setiap magasin dan -15% Waktu Isi Ulang.',
    statModifier: { magSizeBonus: 4, reloadTimeMult: 0.85 },
    synergyClue: 'Sangat membantu untuk Apex Railgun dan Glitch Scattergun.',
    icon: 'Cpu',
  },
  {
    id: 'phase_accelerator',
    name: 'Akselerator Fase',
    rarity: 'common',
    rarityLabel: 'Umum',
    description: '+25% Kecepatan Gerak dan mengurangi cooldown Dash sebesar 35%.',
    statModifier: { moveSpeedMult: 1.25, dashCooldownMult: 0.65 },
    synergyClue: 'Memudahkan manuver mencari Chromabot target dan menghindari serangan.',
    icon: 'FastForward',
  },
  {
    id: 'titan_capacitors',
    name: 'Kapasitor Perisai Spektrum',
    rarity: 'rare',
    rarityLabel: 'Langka',
    description: '+50 Kapasitas Perisai Maksimum dan memulihkan perisai penuh seketika.',
    statModifier: { shieldMaxAdd: 50 },
    synergyClue: 'Memberikan perlindungan tebal saat menghadapi gelombang padat dan Chroma Titan.',
    icon: 'Shield',
  },
  {
    id: 'quantum_hollowpoint',
    name: 'Inti Munisi Kuantum',
    rarity: 'legendary',
    rarityLabel: 'Legendaris',
    description: '+35% Damage Senjata pada target warna yang benar dan +25% bonus kritis.',
    statModifier: { damageMult: 1.35, headshotBonusMult: 0.25 },
    synergyClue: 'Mempercepat eliminasi Chromabot Elite dan Color Core Chroma Titan.',
    icon: 'Target',
  },
  {
    id: 'cyber_plating',
    name: 'Pelapisan Vitalitas Nano',
    rarity: 'common',
    rarityLabel: 'Umum',
    description: '+40 Kesehatan Maksimum dan memulihkan Kesehatan langsung.',
    statModifier: { maxHpAdd: 40 },
    synergyClue: 'Cadangan daya tahan esensial untuk pertarungan jarak menengah.',
    icon: 'ShieldAlert',
  },
];

export function validateColorShot(
  targetColorId: RYBColorId,
  hitEnemyColorId: RYBColorId,
  baseDamage: number,
  isHeadshot: boolean,
  damageMult: number,
  headshotBonusMult: number
): {
  isCorrectColor: boolean;
  damage: number;
  isCrit: boolean;
} {
  if (targetColorId !== hitEnemyColorId) {
    return {
      isCorrectColor: false,
      damage: 0,
      isCrit: false,
    };
  }

  const calc = calculateDamage(baseDamage, isHeadshot, damageMult, headshotBonusMult);
  return {
    isCorrectColor: true,
    damage: calc.damage,
    isCrit: calc.isCrit,
  };
}

/**
 * Validasi tembakan ke CHROMA TITAN (Boss):
 * Pemain wajib mengambil Kristal Warna di arena yang sesuai dengan warna Boss (`bossColorId`).
 * Jika belum mengambil kristal (`activeCrystalColorId === null`) atau warna kristal salah,
 * tembakan tidak mengurangi darah Boss (`damage: 0`).
 */
export function validateBossCrystalShot(
  bossColorId: RYBColorId,
  activeCrystalColorId: RYBColorId | null,
  baseDamage: number,
  isHeadshot: boolean,
  damageMult: number,
  headshotBonusMult: number
): {
  isCorrectCrystal: boolean;
  reason: 'ok' | 'no_crystal' | 'wrong_crystal';
  damage: number;
  isCrit: boolean;
} {
  if (!activeCrystalColorId) {
    return {
      isCorrectCrystal: false,
      reason: 'no_crystal',
      damage: 0,
      isCrit: false,
    };
  }

  if (activeCrystalColorId !== bossColorId) {
    return {
      isCorrectCrystal: false,
      reason: 'wrong_crystal',
      damage: 0,
      isCrit: false,
    };
  }

  const calc = calculateDamage(baseDamage, isHeadshot, damageMult, headshotBonusMult);
  return {
    isCorrectCrystal: true,
    reason: 'ok',
    damage: calc.damage,
    isCrit: calc.isCrit,
  };
}

export function calculateDamage(
  baseDamage: number,
  isHeadshot: boolean,
  damageMult: number,
  headshotBonusMult: number
): { damage: number; isCrit: boolean } {
  const critMult = isHeadshot ? 1.75 + headshotBonusMult : 1.0;
  const finalDamage = Math.round(baseDamage * damageMult * critMult);
  return {
    damage: finalDamage,
    isCrit: isHeadshot,
  };
}

export function getComboMultiplier(comboCount: number): 1 | 2 | 3 {
  if (comboCount >= 5) return 3;
  if (comboCount >= 3) return 2;
  return 1;
}

export function getComboLabel(comboCount: number): string | null {
  if (comboCount >= 10) return 'PERFECT STREAK';
  if (comboCount >= 5) return 'KOMBO x3';
  if (comboCount >= 3) return 'KOMBO x2';
  return null;
}

export function calculateEliminationScore(newComboCount: number): {
  pointsAwarded: number;
  multiplier: 1 | 2 | 3;
  streakLabel: string | null;
} {
  const multiplier = getComboMultiplier(newComboCount);
  const pointsAwarded = BASE_ELIMINATION_SCORE * multiplier;
  const streakLabel = getComboLabel(newComboCount);
  return {
    pointsAwarded,
    multiplier,
    streakLabel,
  };
}

export function calculatePlayerDamage(
  currentHp: number,
  currentShield: number,
  rawIncomingDamage: number
): {
  newHp: number;
  newShield: number;
  damageToShield: number;
  damageToHp: number;
  isDead: boolean;
} {
  let damageLeft = rawIncomingDamage;
  let newShield = currentShield;
  let damageToShield = 0;

  if (newShield > 0) {
    damageToShield = Math.min(newShield, damageLeft);
    newShield -= damageToShield;
    damageLeft -= damageToShield;
  }

  const damageToHp = Math.min(currentHp, damageLeft);
  const newHp = Math.max(0, currentHp - damageToHp);

  return {
    newHp,
    newShield,
    damageToShield,
    damageToHp,
    isDead: newHp <= 0,
  };
}

export function generateDraftChoices(
  pool: CyberUpgrade[] = UPGRADE_POOL,
  count: number = 3,
  randomFn: () => number = Math.random
): CyberUpgrade[] {
  const shuffled = [...pool].sort(() => randomFn() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function applyUpgradeToPlayer(player: PlayerStats, upgrade: CyberUpgrade): PlayerStats {
  const updated: PlayerStats = { ...player };
  const mod = upgrade.statModifier;

  if (mod.damageMult) updated.damageMult *= mod.damageMult;
  if (mod.fireRateMult) updated.fireRateMult *= mod.fireRateMult;
  if (mod.reloadTimeMult) updated.reloadTimeMult *= mod.reloadTimeMult;
  if (mod.magSizeBonus) updated.magSizeBonus += mod.magSizeBonus;
  if (mod.maxHpAdd) {
    updated.maxHp += mod.maxHpAdd;
    updated.hp = Math.min(updated.hp + mod.maxHpAdd, updated.maxHp);
  }
  if (mod.shieldMaxAdd) {
    updated.maxShield += mod.shieldMaxAdd;
    updated.shield = updated.maxShield;
  }
  if (mod.lifestealPercent) updated.lifestealPercent += mod.lifestealPercent;
  if (mod.moveSpeedMult) updated.moveSpeedMult *= mod.moveSpeedMult;
  if (mod.dashCooldownMult) updated.dashCooldownMult *= mod.dashCooldownMult;
  if (mod.headshotBonusMult) updated.headshotBonusMult += mod.headshotBonusMult;

  return updated;
}

export function calculateAccuracyPercent(correctHits: number, shotsFired: number): number {
  if (shotsFired <= 0) return 0;
  return Math.min(100, Math.round((correctHits / shotsFired) * 100));
}

export function calculateRunSummary(
  stats: PlayerStats,
  elapsedTimeSeconds: number,
  won: boolean
): RunSummary {
  const accuracy = calculateAccuracyPercent(stats.correctHits, stats.shotsFired);
  const stagesCleared = won ? 3 : Math.max(0, stats.stage - 1);

  const masteredCategories: ColorCategory[] = [];
  if (stagesCleared >= 1) masteredCategories.push('primer');
  if (stagesCleared >= 2) masteredCategories.push('sekunder');
  if (stagesCleared >= 3) masteredCategories.push('tersier');

  const bossBonus = won ? BOSS_DEFEAT_BONUS : 0;
  const accuracyBonus = accuracy * 15;
  const totalScore = Math.round(stats.score + bossBonus + accuracyBonus);

  return {
    score: totalScore,
    accuracy,
    dataCoresCollected: stats.totalDataCoresCollected,
    stagesCleared,
    masteredCategories,
    kills: stats.kills,
    headshots: stats.headshots,
    shotsFired: stats.shotsFired,
    correctHits: stats.correctHits,
    wrongHits: stats.wrongHits,
    bestCombo: stats.bestCombo,
    timeSurvivedSeconds: Math.round(elapsedTimeSeconds),
    bossDefeated: won,
    won,
  };
}

export const META_PERKS_CATALOG = [
  {
    id: 'meta_hp',
    name: 'Inti Vitalitas Diperkuat',
    description: '+20 Kesehatan Maksimum awal di setiap misi per level.',
    maxLevel: 5,
    costPerLevel: 15,
    statBonus: '+20 Kesehatan',
  },
  {
    id: 'meta_shield',
    name: 'Generator Perisai Spektrum',
    description: '+15 Perisai Maksimum awal di setiap misi per level.',
    maxLevel: 5,
    costPerLevel: 15,
    statBonus: '+15 Perisai',
  },
  {
    id: 'meta_damage',
    name: 'Kalibrator Senjata Kromatik',
    description: '+6% Pengali Damage dasar pada target warna benar per level.',
    maxLevel: 5,
    costPerLevel: 25,
    statBonus: '+6% Damage',
  },
  {
    id: 'meta_dash',
    name: 'Pendorong Fase Cepat',
    description: '-10% Waktu Cooldown Dash per level.',
    maxLevel: 3,
    costPerLevel: 30,
    statBonus: '-10% Cooldown Dash',
  },
];

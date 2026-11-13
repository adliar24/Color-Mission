import { BossPhase, BossPhaseDef, StageDef } from './types';
import { PRIMARY_COLOR_IDS, SECONDARY_COLOR_IDS, TERTIARY_COLOR_IDS } from './colors';

export const STAGE_DEFINITIONS: Record<1 | 2 | 3, StageDef> = {
  1: {
    stageNumber: 1,
    title: 'Tahap 1',
    subtitle: 'Warna Primer',
    category: 'primer',
    categoryLabel: 'Primer',
    instructionMode: 'direct',
    colorPool: PRIMARY_COLOR_IDS,
    targetEliminations: 10,
    hasBossAtEnd: false,
    maxConcurrentEnemies: 3, // Arena lapang dan tenang untuk pengenalan dasar
    spawnIntervalSeconds: 2.0,
    targetGracePeriodSeconds: 2.2,
    enemySpeedMult: 0.78, // Gerakan lambat (~22% lebih santai)
    enemyHpMult: 0.9,
    eliteChance: 0.0, // Tidak ada elite di Tahap 1 agar pemain fokus adaptasi
    stageClearBonus: 1500,
    description:
      'Kenali tiga warna dasar RYB (Merah, Kuning, Biru). Tembak Chromabot yang sesuai dengan kotak warna pada panel instruksi.',
    learningTitle: 'Menguasai Warna Primer (RYB)',
    learningSummary:
      'Dalam teori warna pigmen tradisional (RYB), warna primer adalah tiga warna dasar murni yang menjadi sumber seluruh warna lainnya.',
    learningPoints: [
      'Merah, Kuning, dan Biru adalah fondasi seluruh roda warna RYB.',
      'Mencampur dua warna primer secara seimbang akan menghasilkan warna sekunder pada Tahap 2.',
      'Ketiga warna primer memiliki kontras visual paling kuat di dalam spektrum.',
    ],
  },
  2: {
    stageNumber: 2,
    title: 'Tahap 2',
    subtitle: 'Tantangan Pencampuran Sekunder',
    category: 'sekunder',
    categoryLabel: 'Sekunder',
    instructionMode: 'mixing',
    colorPool: SECONDARY_COLOR_IDS,
    targetEliminations: 15,
    hasBossAtEnd: false,
    maxConcurrentEnemies: 4, // Dibatasi 4 musuh aktif agar pemain punya ruang menganalisis petunjuk warna
    spawnIntervalSeconds: 1.8,
    targetGracePeriodSeconds: 2.8, // Jeda 2.8 detik setelah target baru muncul sebelum tekanan serangan meningkat
    enemySpeedMult: 0.88,
    enemyHpMult: 1.0,
    eliteChance: 0.15,
    stageClearBonus: 2500,
    description:
      'Tebak hasil pencampuran dua warna primer yang tampil di layar (Jingga, Hijau, atau Ungu), lalu tembak Chromabot dengan warna hasil campuran tersebut!',
    learningTitle: 'Sintesis Warna Sekunder (RYB)',
    learningSummary:
      'Warna sekunder terbentuk dari pencampuran dua warna primer secara merata pada roda warna RYB.',
    learningPoints: [
      'Merah + Kuning = Jingga.',
      'Kuning + Biru = Hijau.',
      'Merah + Biru = Ungu.',
    ],
  },
  3: {
    stageNumber: 3,
    title: 'Tahap 3',
    subtitle: 'Pencampuran Tersier & CHROMA TITAN',
    category: 'tersier',
    categoryLabel: 'Tersier',
    instructionMode: 'mixing',
    colorPool: TERTIARY_COLOR_IDS,
    targetEliminations: 20,
    hasBossAtEnd: true,
    bossMaxHp: 1400,
    maxConcurrentEnemies: 5, // Dibatasi maksimal 5 musuh aktif agar 6 warna tersier mudah diamati
    spawnIntervalSeconds: 1.7,
    targetGracePeriodSeconds: 3.0, // Jeda 3.0 detik untuk membaca petunjuk pencampuran tersier
    enemySpeedMult: 0.96,
    enemyHpMult: 1.08,
    eliteChance: 0.25,
    stageClearBonus: 4000,
    description:
      'Selesaikan tantangan pencampuran Warna Primer + Sekunder (6 Warna Tersier), lalu kalahkan boss terakhir CHROMA TITAN!',
    learningTitle: 'Harmoni Enam Warna Tersier & Spektrum Penuh',
    learningSummary:
      'Warna tersier terbentuk dengan mencampurkan satu warna primer dengan satu warna sekunder yang berdekatan pada roda warna RYB.',
    learningPoints: [
      'Merah + Jingga = Merah-Jingga | Kuning + Jingga = Kuning-Jingga.',
      'Kuning + Hijau = Kuning-Hijau | Biru + Hijau = Biru-Hijau.',
      'Biru + Ungu = Biru-Ungu | Merah + Ungu = Merah-Ungu.',
      'Total roda warna RYB lengkap terdiri dari 12 warna: 3 Primer, 3 Sekunder, dan 6 Tersier.',
    ],
  },
};

export const BOSS_PHASES: Record<BossPhase, BossPhaseDef> = {
  1: {
    phase: 1,
    title: 'Fase 1 — Primer & Netral',
    category: 'primer',
    colorPool: [...PRIMARY_COLOR_IDS, 'white', 'black'],
    hpThresholdMax: 1.0,
    hpThresholdMin: 0.66,
    shootCooldownMult: 1.15, // Pola serangan dasar yang mudah dipelajari
    projectileSpeedMult: 0.9,
    description: 'Color Core menampilkan warna Primer (Merah, Kuning, Biru) serta Putih & Hitam.',
  },
  2: {
    phase: 2,
    title: 'Fase 2 — Sekunder & Netral',
    category: 'sekunder',
    colorPool: [...SECONDARY_COLOR_IDS, 'white', 'black'],
    hpThresholdMax: 0.66,
    hpThresholdMin: 0.33,
    shootCooldownMult: 0.95,
    projectileSpeedMult: 1.0,
    description: 'Color Core beralih ke tantangan pencampuran Sekunder serta Putih & Hitam.',
  },
  3: {
    phase: 3,
    title: 'Fase 3 — Tersier & Netral',
    category: 'tersier',
    colorPool: [...TERTIARY_COLOR_IDS, 'white', 'black'],
    hpThresholdMax: 0.33,
    hpThresholdMin: 0.0,
    shootCooldownMult: 0.85,
    projectileSpeedMult: 1.08,
    description: 'Color Core menguji penguasaan 6 warna Tersier serta Putih & Hitam hingga CHROMA TITAN tumbang.',
  },
};

export const BOSS_DEFEAT_BONUS = 5000;

export function getBossPhaseForHp(currentHp: number, maxHp: number): BossPhaseDef {
  const ratio = maxHp > 0 ? Math.max(0, currentHp / maxHp) : 0;
  if (ratio > 0.66) return BOSS_PHASES[1];
  if (ratio > 0.33) return BOSS_PHASES[2];
  return BOSS_PHASES[3];
}

import {
  ColorCategory,
  ColorInstructionClue,
  RYBColorDef,
  RYBColorId,
} from './types';

/**
 * Sistem Warna Pigmen Tradisional RYB (Merah, Kuning, Biru) Terpusat
 */
export const RYB_COLOR_REGISTRY: Record<RYBColorId, RYBColorDef> = {
  // === 1. WARNA PRIMER (3 Warna Dasar) ===
  red: {
    id: 'red',
    nameId: 'Merah',
    nameEn: 'Red',
    category: 'primer',
    categoryLabelId: 'Primer',
    hex: '#EF233C',
    emissiveHex: '#D90429',
    recipeTextId: 'Warna dasar',
    shortDescId: 'Warna primer murni yang tidak diperoleh dari pencampuran warna lain.',
    conceptualHintId: 'Cari Chromabot dengan warna dasar merah menyala.',
    memoryHintId: 'INGAT: Merah adalah warna primer dasar.',
  },
  yellow: {
    id: 'yellow',
    nameId: 'Kuning',
    nameEn: 'Yellow',
    category: 'primer',
    categoryLabelId: 'Primer',
    hex: '#FFD60A',
    emissiveHex: '#FFC300',
    recipeTextId: 'Warna dasar',
    shortDescId: 'Warna primer cerah yang menjadi sumber hangat untuk jingga dan hijau.',
    conceptualHintId: 'Cari Chromabot dengan warna dasar kuning cerah.',
    memoryHintId: 'INGAT: Kuning adalah warna primer dasar.',
  },
  blue: {
    id: 'blue',
    nameId: 'Biru',
    nameEn: 'Blue',
    category: 'primer',
    categoryLabelId: 'Primer',
    hex: '#1D6FFF',
    emissiveHex: '#0050E6',
    recipeTextId: 'Warna dasar',
    shortDescId: 'Warna primer dingin yang menjadi fondasi warna hijau dan ungu.',
    conceptualHintId: 'Cari Chromabot dengan warna dasar biru terang.',
    memoryHintId: 'INGAT: Biru adalah warna primer dasar.',
  },

  // === 2. WARNA SEKUNDER (3 Hasil Campuran Primer + Primer) ===
  orange: {
    id: 'orange',
    nameId: 'Jingga',
    nameEn: 'Orange',
    category: 'sekunder',
    categoryLabelId: 'Sekunder',
    hex: '#FF7A00',
    emissiveHex: '#E85D04',
    recipeTextId: 'Merah + Kuning',
    ingredients: ['red', 'yellow'],
    shortDescId: 'Warna sekunder hangat dari pencampuran Merah dan Kuning.',
    conceptualHintId: 'Campuran dua warna hangat ini menghasilkan warna di antara merah dan kuning.',
    memoryHintId: 'INGAT: MERAH + KUNING MENGHASILKAN JINGGA.',
  },
  green: {
    id: 'green',
    nameId: 'Hijau',
    nameEn: 'Green',
    category: 'sekunder',
    categoryLabelId: 'Sekunder',
    hex: '#16A34A',
    emissiveHex: '#15803D',
    recipeTextId: 'Kuning + Biru',
    ingredients: ['yellow', 'blue'],
    shortDescId: 'Warna sekunder segar hasil perpaduan Kuning dan Biru.',
    conceptualHintId: 'Perpaduan kuning cerah dan biru dingin menghasilkan warna daun alami.',
    memoryHintId: 'INGAT: KUNING + BIRU MENGHASILKAN HIJAU.',
  },
  purple: {
    id: 'purple',
    nameId: 'Ungu',
    nameEn: 'Purple',
    category: 'sekunder',
    categoryLabelId: 'Sekunder',
    hex: '#8B5CF6',
    emissiveHex: '#7C3AED',
    recipeTextId: 'Merah + Biru',
    ingredients: ['red', 'blue'],
    shortDescId: 'Warna sekunder kaya energi dari pencampuran Merah dan Biru.',
    conceptualHintId: 'Perpaduan merah kuat dan biru pekat menghasilkan warna violet/ungu.',
    memoryHintId: 'INGAT: MERAH + BIRU MENGHASILKAN UNGU.',
  },

  // === 3. WARNA TERSIER (6 Hasil Campuran Primer + Sekunder Berdekatan) ===
  red_orange: {
    id: 'red_orange',
    nameId: 'Merah-Jingga',
    nameEn: 'Red-Orange',
    category: 'tersier',
    categoryLabelId: 'Tersier',
    hex: '#FF481F',
    emissiveHex: '#E03510',
    recipeTextId: 'Merah + Jingga',
    ingredients: ['red', 'orange'],
    shortDescId: 'Warna tersier membara dari pencampuran primer Merah dan sekunder Jingga.',
    conceptualHintId:
      'Campuran warna ini menghasilkan nuansa hangat membara yang berada di antara merah dan jingga.',
    memoryHintId:
      'PETUNJUK KONSEP: Primer Merah + Sekunder Jingga menghasilkan warna di antara keduanya (lebih merah dari jingga biasa).',
  },
  yellow_orange: {
    id: 'yellow_orange',
    nameId: 'Kuning-Jingga',
    nameEn: 'Yellow-Orange',
    category: 'tersier',
    categoryLabelId: 'Tersier',
    hex: '#FFB302',
    emissiveHex: '#E59800',
    recipeTextId: 'Kuning + Jingga',
    ingredients: ['yellow', 'orange'],
    shortDescId: 'Warna tersier keemasan dari pencampuran primer Kuning dan sekunder Jingga.',
    conceptualHintId:
      'Campuran warna ini menghasilkan nuansa kuning keemasan (amber) yang berada di antara kuning dan jingga.',
    memoryHintId:
      'PETUNJUK KONSEP: Primer Kuning + Sekunder Jingga menghasilkan warna keemasan di antara kuning dan jingga.',
  },
  yellow_green: {
    id: 'yellow_green',
    nameId: 'Kuning-Hijau',
    nameEn: 'Yellow-Green',
    category: 'tersier',
    categoryLabelId: 'Tersier',
    hex: '#84CC16',
    emissiveHex: '#65A30D',
    recipeTextId: 'Kuning + Hijau',
    ingredients: ['yellow', 'green'],
    shortDescId: 'Warna tersier limau segar dari pencampuran primer Kuning dan sekunder Hijau.',
    conceptualHintId:
      'Campuran warna ini menghasilkan nuansa hijau pucuk/limau cerah yang berada di antara kuning dan hijau.',
    memoryHintId:
      'PETUNJUK KONSEP: Primer Kuning + Sekunder Hijau menghasilkan warna hijau kekuningan (limau).',
  },
  blue_green: {
    id: 'blue_green',
    nameId: 'Biru-Hijau',
    nameEn: 'Blue-Green',
    category: 'tersier',
    categoryLabelId: 'Tersier',
    hex: '#00B4D8',
    emissiveHex: '#0096C7',
    recipeTextId: 'Biru + Hijau',
    ingredients: ['blue', 'green'],
    shortDescId: 'Warna tersier pirus/toska dari pencampuran primer Biru dan sekunder Hijau.',
    conceptualHintId:
      'Campuran warna ini menghasilkan nuansa laut pirus/toska yang berada di antara biru dan hijau.',
    memoryHintId:
      'PETUNJUK KONSEP: Primer Biru + Sekunder Hijau menghasilkan warna pirus/toska di antara biru dan hijau.',
  },
  blue_purple: {
    id: 'blue_purple',
    nameId: 'Biru-Ungu',
    nameEn: 'Blue-Purple',
    category: 'tersier',
    categoryLabelId: 'Tersier',
    hex: '#4F46E5',
    emissiveHex: '#4338CA',
    recipeTextId: 'Biru + Ungu',
    ingredients: ['blue', 'purple'],
    shortDescId: 'Warna tersier nila/indigo dari pencampuran primer Biru dan sekunder Ungu.',
    conceptualHintId:
      'Campuran warna ini menghasilkan nuansa nila/indigo pekat yang berada di antara biru dan ungu.',
    memoryHintId:
      'PETUNJUK KONSEP: Primer Biru + Sekunder Ungu menghasilkan warna nila/indigo di antara biru dan ungu.',
  },
  red_purple: {
    id: 'red_purple',
    nameId: 'Merah-Ungu',
    nameEn: 'Red-Purple',
    category: 'tersier',
    categoryLabelId: 'Tersier',
    hex: '#E01E9A',
    emissiveHex: '#C01580',
    recipeTextId: 'Merah + Ungu',
    ingredients: ['red', 'purple'],
    shortDescId: 'Warna tersier magenta dari pencampuran primer Merah dan sekunder Ungu.',
    conceptualHintId:
      'Campuran warna ini menghasilkan nuansa magenta kemerahan yang berada di antara merah dan ungu.',
    memoryHintId:
      'PETUNJUK KONSEP: Primer Merah + Sekunder Ungu menghasilkan warna magenta di antara merah dan ungu.',
  },
};

export const ALL_RYB_COLORS: RYBColorDef[] = Object.values(RYB_COLOR_REGISTRY);

export const PRIMARY_COLOR_IDS: RYBColorId[] = ['red', 'yellow', 'blue'];
export const SECONDARY_COLOR_IDS: RYBColorId[] = ['orange', 'green', 'purple'];
export const TERTIARY_COLOR_IDS: RYBColorId[] = [
  'red_orange',
  'yellow_orange',
  'yellow_green',
  'blue_green',
  'blue_purple',
  'red_purple',
];

export function getColorDef(id: RYBColorId): RYBColorDef {
  return RYB_COLOR_REGISTRY[id];
}

export function getColorsByCategory(category: ColorCategory): RYBColorDef[] {
  return ALL_RYB_COLORS.filter((c) => c.category === category);
}

export function getColorIdsByCategory(category: ColorCategory): RYBColorId[] {
  if (category === 'primer') return [...PRIMARY_COLOR_IDS];
  if (category === 'sekunder') return [...SECONDARY_COLOR_IDS];
  return [...TERTIARY_COLOR_IDS];
}

/**
 * Membangun objek instruksi warna untuk HUD sesuai aturan Color Mixing Challenge:
 * - Stage 1 (atau warna Primer): Tampilkan nama & swatch warna target secara langsung (`displayMode: 'direct'`).
 * - Stage 2 & Stage 3 (warna Sekunder & Tersier): Tampilkan HANYA dua warna penyusun (`displayMode: 'mixing'`),
 *   tanpa membocorkan nama ataupun swatch warna hasil pencampuran sebelum pemain berhasil mengeliminasi target!
 */
export function buildColorInstructionClue(
  targetColorId: RYBColorId,
  stageNumber: 1 | 2 | 3
): ColorInstructionClue {
  const targetDef = getColorDef(targetColorId);

  if (stageNumber === 1 || !targetDef.ingredients) {
    return {
      targetColorId,
      displayMode: 'direct',
      directNameId: targetDef.nameId.toUpperCase(),
      directHex: targetDef.hex,
      questionPromptId: 'TEMBAK CHROMABOT DENGAN WARNA INI',
      conceptualHintId: targetDef.conceptualHintId,
      memoryHintId: targetDef.memoryHintId,
      solvedFormulaTextId: `WARNA BENAR! TARGET: ${targetDef.nameId.toUpperCase()}`,
    };
  }

  const ing1Def = getColorDef(targetDef.ingredients[0]);
  const ing2Def = getColorDef(targetDef.ingredients[1]);

  return {
    targetColorId,
    displayMode: 'mixing',
    ingredient1: {
      id: ing1Def.id,
      nameId: ing1Def.nameId.toUpperCase(),
      hex: ing1Def.hex,
    },
    ingredient2: {
      id: ing2Def.id,
      nameId: ing2Def.nameId.toUpperCase(),
      hex: ing2Def.hex,
    },
    questionPromptId: 'TEBAK WARNA HASIL PENCAMPURAN',
    conceptualHintId: targetDef.conceptualHintId,
    memoryHintId: targetDef.memoryHintId,
    solvedFormulaTextId: `BENAR! ${ing1Def.nameId.toUpperCase()} + ${ing2Def.nameId.toUpperCase()} = ${targetDef.nameId.toUpperCase()}`,
  };
}

/**
 * Memilih warna target berikutnya dari kumpulan warna yang tersedia di arena atau dari pool stage.
 */
export function selectNextTargetColor(
  allowedPool: RYBColorId[],
  activeEnemyColors: RYBColorId[],
  previousTarget?: RYBColorId,
  randomFn: () => number = Math.random
): RYBColorId {
  const validEnemyColors = activeEnemyColors.filter((c) => allowedPool.includes(c));
  const sourcePool = validEnemyColors.length > 0 ? validEnemyColors : allowedPool;

  const differentChoices = previousTarget
    ? sourcePool.filter((c) => c !== previousTarget)
    : sourcePool;

  const finalPool = differentChoices.length > 0 ? differentChoices : sourcePool;
  const idx = Math.floor(randomFn() * finalPool.length);
  return finalPool[idx] || allowedPool[0];
}

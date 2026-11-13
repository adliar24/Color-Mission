import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_DEFINITIONS,
  ENEMY_ARCHETYPES,
  ALL_RYB_COLORS,
  RYB_COLOR_REGISTRY,
  getColorsByCategory,
  selectNextTargetColor,
  validateColorShot,
  validateBossCrystalShot,
  calculateEliminationScore,
  getComboMultiplier,
  getComboLabel,
  getBossPhaseForHp,
  BOSS_PHASES,
  calculatePlayerDamage,
  generateDraftChoices,
  calculateRunSummary,
  applyUpgradeToPlayer,
  UPGRADE_POOL,
  buildColorInstructionClue,
  getUnlockedWeaponsForStage,
  WEAPON_REGISTRY,
} from './rules';
import { InputManager } from './input/InputManager';
import { VRManager } from './xr/VRManager';
import { GameSettings, PlayerStats } from './types';

const TEST_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  mobileGyroEnabled: false,
  hapticsEnabled: true,
  graphicsQuality: 'high',
  vrTurnMode: 'snap',
  vrSnapAngle: 45,
  vrSmoothTurnSpeed: 2.0,
  vrMovementMode: 'smooth',
  vrComfortVignette: true,
};

test('RYB_COLOR_REGISTRY memiliki tepat 12 warna unik (3 primer, 3 sekunder, 6 tersier)', () => {
  assert.equal(ALL_RYB_COLORS.length, 12);

  const primer = getColorsByCategory('primer');
  const sekunder = getColorsByCategory('sekunder');
  const tersier = getColorsByCategory('tersier');

  assert.equal(primer.length, 3);
  assert.equal(sekunder.length, 3);
  assert.equal(tersier.length, 6);

  const hexSet = new Set(ALL_RYB_COLORS.map((c) => c.hex.toLowerCase()));
  assert.equal(hexSet.size, 12, 'Setiap warna harus memiliki kode hex unik');

  assert.equal(RYB_COLOR_REGISTRY.orange.recipeTextId, 'Merah + Kuning');
  assert.equal(RYB_COLOR_REGISTRY.green.recipeTextId, 'Kuning + Biru');
  assert.equal(RYB_COLOR_REGISTRY.purple.recipeTextId, 'Merah + Biru');
  assert.equal(RYB_COLOR_REGISTRY.red_orange.recipeTextId, 'Merah + Jingga');
  assert.equal(RYB_COLOR_REGISTRY.yellow_orange.recipeTextId, 'Kuning + Jingga');
  assert.equal(RYB_COLOR_REGISTRY.yellow_green.recipeTextId, 'Kuning + Hijau');
  assert.equal(RYB_COLOR_REGISTRY.blue_green.recipeTextId, 'Biru + Hijau');
  assert.equal(RYB_COLOR_REGISTRY.blue_purple.recipeTextId, 'Biru + Ungu');
  assert.equal(RYB_COLOR_REGISTRY.red_purple.recipeTextId, 'Merah + Ungu');
});

test('STAGE_DEFINITIONS mengonfigurasi 3 stage berurutan dengan mode instruksi direct (Stage 1) dan mixing (Stage 2 & 3)', () => {
  assert.equal(STAGE_DEFINITIONS[1].stageNumber, 1);
  assert.equal(STAGE_DEFINITIONS[1].category, 'primer');
  assert.equal(STAGE_DEFINITIONS[1].instructionMode, 'direct');
  assert.equal(STAGE_DEFINITIONS[1].targetEliminations, 10);
  assert.equal(STAGE_DEFINITIONS[1].maxConcurrentEnemies, 3);
  assert.equal(STAGE_DEFINITIONS[1].hasBossAtEnd, false);
  assert.deepEqual(STAGE_DEFINITIONS[1].colorPool, ['red', 'yellow', 'blue']);

  assert.equal(STAGE_DEFINITIONS[2].stageNumber, 2);
  assert.equal(STAGE_DEFINITIONS[2].category, 'sekunder');
  assert.equal(STAGE_DEFINITIONS[2].instructionMode, 'mixing');
  assert.equal(STAGE_DEFINITIONS[2].targetEliminations, 15);
  assert.equal(STAGE_DEFINITIONS[2].maxConcurrentEnemies, 4);
  assert.equal(STAGE_DEFINITIONS[2].hasBossAtEnd, false);
  assert.deepEqual(STAGE_DEFINITIONS[2].colorPool, ['orange', 'green', 'purple']);

  assert.equal(STAGE_DEFINITIONS[3].stageNumber, 3);
  assert.equal(STAGE_DEFINITIONS[3].category, 'tersier');
  assert.equal(STAGE_DEFINITIONS[3].instructionMode, 'mixing');
  assert.equal(STAGE_DEFINITIONS[3].targetEliminations, 20);
  assert.equal(STAGE_DEFINITIONS[3].maxConcurrentEnemies, 5);
  assert.equal(STAGE_DEFINITIONS[3].hasBossAtEnd, true);
  assert.equal(STAGE_DEFINITIONS[3].colorPool.length, 6);
});

test('buildColorInstructionClue menampilkan warna langsung pada Stage 1 dan petunjuk pencampuran tanpa bocoran jawaban pada Stage 2 & 3', () => {
  const stage1Clue = buildColorInstructionClue('red', 1);
  assert.equal(stage1Clue.displayMode, 'direct');
  assert.equal(stage1Clue.targetColorId, 'red');
  assert.equal(stage1Clue.directNameId, 'MERAH');
  assert.equal(stage1Clue.directHex, RYB_COLOR_REGISTRY.red.hex);

  // Stage 2: Jingga (Merah + Kuning) -> hanya menampilkan ingredient1 & ingredient2, bukan nama/hex Jingga!
  const stage2Clue = buildColorInstructionClue('orange', 2);
  assert.equal(stage2Clue.displayMode, 'mixing');
  assert.equal(stage2Clue.targetColorId, 'orange');
  assert.equal(stage2Clue.directNameId, undefined);
  assert.equal(stage2Clue.directHex, undefined);
  assert.equal(stage2Clue.ingredient1?.nameId, 'MERAH');
  assert.equal(stage2Clue.ingredient2?.nameId, 'KUNING');
  assert.equal(stage2Clue.solvedFormulaTextId, 'BENAR! MERAH + KUNING = JINGGA');

  // Stage 3: Merah-Jingga (Merah + Jingga) -> hanya menampilkan ingredient1 & ingredient2, dan conceptualHintId tidak membocorkan nama "Merah-Jingga"
  const stage3Clue = buildColorInstructionClue('red_orange', 3);
  assert.equal(stage3Clue.displayMode, 'mixing');
  assert.equal(stage3Clue.targetColorId, 'red_orange');
  assert.equal(stage3Clue.directNameId, undefined);
  assert.equal(stage3Clue.directHex, undefined);
  assert.equal(stage3Clue.ingredient1?.nameId, 'MERAH');
  assert.equal(stage3Clue.ingredient2?.nameId, 'JINGGA');
  assert.equal(stage3Clue.solvedFormulaTextId, 'BENAR! MERAH + JINGGA = MERAH-JINGGA');
  assert.equal(
    stage3Clue.conceptualHintId.toLowerCase().includes('merah-jingga'),
    false,
    'Petunjuk konseptual Stage 3 tidak boleh membocorkan nama jawaban secara langsung'
  );
});

test('validateColorShot memberikan damage pada warna yang benar dan 0 damage pada warna salah', () => {
  const correctBody = validateColorShot('red', 'red', 34, false, 1.0, 0);
  assert.equal(correctBody.isCorrectColor, true);
  assert.equal(correctBody.damage, 34);
  assert.equal(correctBody.isCrit, false);

  const correctHead = validateColorShot('red', 'red', 34, true, 1.0, 0);
  assert.equal(correctHead.isCorrectColor, true);
  assert.equal(correctHead.damage, Math.round(34 * 1.75));
  assert.equal(correctHead.isCrit, true);

  const wrongColor = validateColorShot('red', 'blue', 34, true, 1.5, 0.25);
  assert.equal(wrongColor.isCorrectColor, false);
  assert.equal(wrongColor.damage, 0);
  assert.equal(wrongColor.isCrit, false);
});

test('validateBossCrystalShot mewajibkan Kristal Warna yang sesuai untuk dapat mengurangi darah Boss', () => {
  // 1. Belum mengambil kristal -> damage 0
  const noCrystal = validateBossCrystalShot('orange', null, 35, false, 1.0, 0);
  assert.equal(noCrystal.isCorrectCrystal, false);
  assert.equal(noCrystal.reason, 'no_crystal');
  assert.equal(noCrystal.damage, 0);

  // 2. Mengambil kristal dengan warna yang salah -> damage 0
  const wrongCrystal = validateBossCrystalShot('orange', 'purple', 35, true, 1.0, 0);
  assert.equal(wrongCrystal.isCorrectCrystal, false);
  assert.equal(wrongCrystal.reason, 'wrong_crystal');
  assert.equal(wrongCrystal.damage, 0);

  // 3. Mengambil kristal dengan warna yang sesuai dengan warna Boss -> mengurangi darah Boss
  const matchingCrystal = validateBossCrystalShot('orange', 'orange', 35, false, 1.0, 0);
  assert.equal(matchingCrystal.isCorrectCrystal, true);
  assert.equal(matchingCrystal.reason, 'ok');
  assert.equal(matchingCrystal.damage, 35);
});

test('calculateEliminationScore dan pengali kombo berfungsi sesuai aturan (100 dasar, x2 di 3, x3 di 5, PERFECT STREAK di 10)', () => {
  const s1 = calculateEliminationScore(1);
  assert.equal(s1.pointsAwarded, 100);
  assert.equal(s1.multiplier, 1);
  assert.equal(s1.streakLabel, null);

  const s3 = calculateEliminationScore(3);
  assert.equal(s3.pointsAwarded, 200);
  assert.equal(s3.multiplier, 2);
  assert.equal(s3.streakLabel, 'KOMBO x2');

  const s5 = calculateEliminationScore(5);
  assert.equal(s5.pointsAwarded, 300);
  assert.equal(s5.multiplier, 3);
  assert.equal(s5.streakLabel, 'KOMBO x3');

  const s10 = calculateEliminationScore(10);
  assert.equal(s10.pointsAwarded, 300);
  assert.equal(s10.multiplier, 3);
  assert.equal(s10.streakLabel, 'PERFECT STREAK');
  assert.equal(getComboMultiplier(10), 3);
  assert.equal(getComboLabel(10), 'PERFECT STREAK');
});

test('getBossPhaseForHp memilih fase Primer, Sekunder, dan Tersier sesuai rasio HP CHROMA TITAN', () => {
  const p1 = getBossPhaseForHp(1400, 1500);
  assert.equal(p1.phase, 1);
  assert.equal(p1.category, 'primer');

  const p2 = getBossPhaseForHp(800, 1500);
  assert.equal(p2.phase, 2);
  assert.equal(p2.category, 'sekunder');

  const p3 = getBossPhaseForHp(300, 1500);
  assert.equal(p3.phase, 3);
  assert.equal(p3.category, 'tersier');
});

test('selectNextTargetColor memprioritaskan warna musuh aktif yang ada di arena', () => {
  const pool = STAGE_DEFINITIONS[1].colorPool;
  const activeColors = ['yellow' as const];
  const chosen = selectNextTargetColor(pool, activeColors, 'red');
  assert.equal(chosen, 'yellow');
});

test('calculatePlayerDamage menahan sebagian besar serangan dengan perisai sambil tetap mengurangi darah lebih sedikit daripada saat perisai 0', () => {
  const hitWithShield = calculatePlayerDamage(100, 50, 20);
  assert.equal(hitWithShield.newShield, 35);
  assert.equal(hitWithShield.newHp, 95);
  assert.equal(hitWithShield.isDead, false);

  const hitNoShield = calculatePlayerDamage(100, 0, 20);
  assert.equal(hitNoShield.newShield, 0);
  assert.equal(hitNoShield.newHp, 80);
  assert.ok(hitWithShield.damageToHp < hitNoShield.damageToHp);

  const hitBreakShield = calculatePlayerDamage(100, 10, 40);
  assert.equal(hitBreakShield.newShield, 0);
  assert.equal(hitBreakShield.newHp, 70);
  assert.equal(hitBreakShield.isDead, false);

  const fatalHit = calculatePlayerDamage(20, 0, 50);
  assert.equal(fatalHit.newHp, 0);
  assert.equal(fatalHit.isDead, true);
});

test('ENEMY_ARCHETYPES menggunakan keluarga CHROMABOTS dan CHROMA TITAN', () => {
  assert.ok(ENEMY_ARCHETYPES.chromabot_normal);
  assert.ok(ENEMY_ARCHETYPES.chromabot_elite);
  assert.ok(ENEMY_ARCHETYPES.chroma_titan);
  assert.equal(ENEMY_ARCHETYPES.chroma_titan.name, 'CHROMA TITAN');
});

test('generateDraftChoices dan applyUpgradeToPlayer menerapkan modifikasi stat dengan benar', () => {
  const choices = generateDraftChoices(UPGRADE_POOL, 3);
  assert.equal(choices.length, 3);
  const ids = new Set(choices.map((c) => c.id));
  assert.equal(ids.size, 3);

  const basePlayer: PlayerStats = {
    hp: 80,
    maxHp: 100,
    shield: 30,
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

  const magUpg = UPGRADE_POOL.find((u) => u.id === 'expanded_magazine')!;
  const afterMag = applyUpgradeToPlayer(basePlayer, magUpg);
  assert.equal(afterMag.magSizeBonus, 4);
  assert.equal(afterMag.reloadTimeMult, 0.85);
});

test('InputManager mengisolasi perintah Desktop, Mobile, dan VR tanpa duplikasi', () => {
  const im = new InputManager();
  im.setMode('mobile');
  im.mobile.setJoystick(0.5, -0.8);
  im.mobile.setShooting(true);
  im.mobile.triggerReload();
  im.mobile.triggerDash();

  const cmdMobile = im.poll(TEST_SETTINGS, 0.016);
  assert.equal(cmdMobile.moveX, 0.5);
  assert.equal(cmdMobile.moveZ, -0.8);
  assert.equal(cmdMobile.shoot, true);
  assert.equal(cmdMobile.reload, true);
  assert.equal(cmdMobile.dash, true);

  // Perintah one-shot (reload, dash) harus di-reset pada poll berikutnya
  const cmdMobileNext = im.poll(TEST_SETTINGS, 0.016);
  assert.equal(cmdMobileNext.reload, false);
  assert.equal(cmdMobileNext.dash, false);

  // Beralih kembali ke desktop mereset state mobile
  im.setMode('desktop');
  assert.equal(im.mobile.isShooting, false);
});

test('InputManager mendukung toggle Gyro HP dan Haptic Feedback tanpa error di berbagai platform', () => {
  const im = new InputManager();
  im.setMode('mobile');

  // Saat mobileGyroEnabled = false, lookDelta dari gyro tidak aktif
  const cmdGyroOff = im.poll({ ...TEST_SETTINGS, mobileGyroEnabled: false }, 0.016);
  assert.equal(cmdGyroOff.lookDeltaX, 0);
  assert.equal(cmdGyroOff.lookDeltaY, 0);

  // Saat mobileGyroEnabled = true, poll tetap aman tanpa sensor fisik
  const cmdGyroOn = im.poll({ ...TEST_SETTINGS, mobileGyroEnabled: true }, 0.016);
  assert.equal(cmdGyroOn.lookDeltaX, 0);
  assert.equal(cmdGyroOn.lookDeltaY, 0);

  // Panggilan triggerHaptic aman saat hapticsEnabled true maupun false
  assert.doesNotThrow(() => {
    im.triggerHaptic('shoot', { ...TEST_SETTINGS, hapticsEnabled: true }, null);
    im.triggerHaptic('enemyHit', { ...TEST_SETTINGS, hapticsEnabled: true }, null);
    im.triggerHaptic('playerDamage', { ...TEST_SETTINGS, hapticsEnabled: false }, null);
  });
  im.dispose();
});

test('DesktopInput mode Full Keyboard mengarahkan kamera dengan tombol Panah dan menembak dengan Enter', () => {
  const im = new InputManager();
  im.setMode('desktop');
  const desktopAny = im.desktop as unknown as {
    isActive: boolean;
    onKeyDown: (e: { code: string }) => void;
    onKeyUp: (e: { code: string }) => void;
  };
  desktopAny.isActive = true;

  desktopAny.onKeyDown({ code: 'ArrowLeft' });
  desktopAny.onKeyDown({ code: 'ArrowUp' });
  desktopAny.onKeyDown({ code: 'Enter' });

  const cmd = im.poll({ ...TEST_SETTINGS, keyboardCameraMode: true }, 0.016);
  assert.equal(cmd.moveX, 0);
  assert.equal(cmd.moveZ, 0);
  assert.ok(cmd.lookDeltaX > 0, 'ArrowLeft harus memutar kamera ke kiri (lookDeltaX > 0)');
  assert.ok(cmd.lookDeltaY > 0, 'ArrowUp harus mendongakkan kamera (lookDeltaY > 0)');
  assert.equal(cmd.shoot, true, 'Enter harus menembak pada mode Full Keyboard');

  desktopAny.onKeyUp({ code: 'ArrowLeft' });
  desktopAny.onKeyUp({ code: 'ArrowUp' });
  desktopAny.onKeyUp({ code: 'Enter' });
  im.dispose();
});

test('VRManager.checkSupport menangani lingkungan tanpa perangkat WebXR dengan aman', async () => {
  const status = await VRManager.checkSupport();
  assert.equal(status.isImmersiveVRSupported, false);
  assert.ok(status.messageId.length > 0);
});

test('calculateRunSummary menghitung akurasi, MASTERED stage, dan bonus kemenangan dengan benar', () => {
  const player: PlayerStats = {
    hp: 80,
    maxHp: 100,
    shield: 30,
    maxShield: 50,
    dataCores: 20,
    totalDataCoresCollected: 35,
    score: 8400,
    combo: 6,
    bestCombo: 11,
    kills: 54,
    stageKills: 24,
    headshots: 18,
    shotsFired: 80,
    correctHits: 64,
    wrongHits: 6,
    stage: 3,
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

  const winSummary = calculateRunSummary(player, 210, true);
  assert.equal(winSummary.accuracy, 80);
  assert.equal(winSummary.stagesCleared, 3);
  assert.deepEqual(winSummary.masteredCategories, ['primer', 'sekunder', 'tersier']);
  assert.equal(winSummary.won, true);

  // Jika kalah di Stage 2 (baru menyelesaikan Stage 1), hanya Primer yang MASTERED
  const lossStage2 = calculateRunSummary({ ...player, stage: 2 }, 95, false);
  assert.equal(lossStage2.stagesCleared, 1);
  assert.deepEqual(lossStage2.masteredCategories, ['primer']);
  assert.equal(lossStage2.won, false);
});

test('Warna Putih dan Hitam tersedia khusus pertarungan Boss tanpa mengubah 12 warna RYB', () => {
  assert.equal(ALL_RYB_COLORS.length, 12);
  assert.ok(BOSS_PHASES[1].colorPool.includes('white'));
  assert.ok(BOSS_PHASES[1].colorPool.includes('black'));
  assert.ok(BOSS_PHASES[2].colorPool.includes('white'));
  assert.ok(BOSS_PHASES[3].colorPool.includes('black'));

  const whiteClue = buildColorInstructionClue('white', 3);
  assert.equal(whiteClue.displayMode, 'direct');
  assert.equal(whiteClue.directHex, '#F8FAFC');

  const blackShot = validateBossCrystalShot('black', 'black', 35, false, 1.0, 0);
  assert.equal(blackShot.isCorrectCrystal, true);
  assert.equal(blackShot.damage, 35);
});

test('Progresi senjata per stage membuka 1 -> 2 -> 3 senjata dengan damage lebih besar dan peluru awal lebih sedikit', () => {
  assert.deepEqual(getUnlockedWeaponsForStage(1), ['laser_rifle']);
  assert.deepEqual(getUnlockedWeaponsForStage(2), ['laser_rifle', 'cyber_shotgun']);
  assert.deepEqual(getUnlockedWeaponsForStage(3), ['laser_rifle', 'cyber_shotgun', 'railgun']);

  assert.equal(WEAPON_REGISTRY.laser_rifle.magSize, 50);
  assert.equal(WEAPON_REGISTRY.cyber_shotgun.magSize, 24);
  assert.equal(WEAPON_REGISTRY.railgun.magSize, 10);

  assert.ok(WEAPON_REGISTRY.railgun.damage > WEAPON_REGISTRY.laser_rifle.damage);
});

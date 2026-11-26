import React from 'react';
import {
  BossPhaseDef,
  CharacterId,
  ColorInstructionClue,
  DifficultyLevel,
  GameColorId,
  PlatformMode,
  PlayerStats,
  ShotFeedback,
  WeaponType,
} from '../game/types';
import {
  CHARACTER_REGISTRY,
  DIFFICULTY_REGISTRY,
  WEAPON_REGISTRY,
  buildColorInstructionClue,
  getColorDef,
  getComboMultiplier,
  getEffectiveStageDef,
} from '../game/rules';
import {
  Volume2,
  VolumeX,
  Pause,
  Crosshair,
  Shield,
  Heart,
  HelpCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { GamepadBadge } from './GamepadBadge';
import { Weapon2DIcon } from './Weapon2DIcon';

interface PlayingHUDProps {
  player: PlayerStats;
  targetColorId: GameColorId;
  instructionClue?: ColorInstructionClue;
  showHint?: boolean;
  wrongStreakOnTarget?: number;
  onToggleHint?: () => void;
  currentWeapon: WeaponType;
  unlockedWeapons: WeaponType[];
  ammo: number;
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: BossPhaseDef;
  activeCrystalColorId?: GameColorId | null;
  shotFeedback: ShotFeedback | null;
  platformMode: PlatformMode;
  mobileOrientation?: 'landscape' | 'portrait';
  isGamepadConnected?: boolean;
  vrComfortVignetteActive?: boolean;
  onSwitchWeapon: (type: WeaponType) => void;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onExitVR?: () => void;
  isMuted: boolean;
  hitmarkerActive: boolean;
  hitmarkerCrit: boolean;
  hitmarkerWrong: boolean;
  playerDamageFlash?: boolean;
  pickupFlash?: { type: 'health' | 'shield'; id: number } | null;
  difficulty?: DifficultyLevel;
  characterId?: CharacterId;
  onTriggerAbility?: () => void;
}

export const PlayingHUD: React.FC<PlayingHUDProps> = ({
  player,
  targetColorId,
  instructionClue,
  showHint = false,
  wrongStreakOnTarget = 0,
  onToggleHint,
  currentWeapon,
  unlockedWeapons,
  ammo,
  bossHp,
  bossMaxHp = 1500,
  activeCrystalColorId = null,
  shotFeedback,
  platformMode,
  mobileOrientation = 'landscape',
  isGamepadConnected = false,
  vrComfortVignetteActive = false,
  onSwitchWeapon,
  onPause,
  onToggleMute,
  onToggleFullscreen,
  isFullscreen = false,
  onExitVR,
  isMuted,
  hitmarkerActive,
  hitmarkerCrit,
  hitmarkerWrong,
  playerDamageFlash = false,
  pickupFlash = null,
  difficulty = player.difficulty ?? 'normal',
  characterId = player.characterId ?? 'raka',
  onTriggerAbility,
}) => {
  const stageDef = getEffectiveStageDef(player.stage, difficulty);
  const diffCfg = DIFFICULTY_REGISTRY[difficulty] || DIFFICULTY_REGISTRY.normal;
  const charProfile = CHARACTER_REGISTRY[characterId] || CHARACTER_REGISTRY.raka;
  const isMobile = platformMode === 'mobile';
  const isMobilePortrait = isMobile && mobileOrientation === 'portrait';
  const abilityCdLeft = Math.max(0, player.abilityCooldownLeft ?? 0);
  const abilityActiveLeft = Math.max(0, player.abilityActiveLeft ?? 0);
  const abilityReady = abilityCdLeft <= 0 && abilityActiveLeft <= 0;
  const clue =
    instructionClue || buildColorInstructionClue(targetColorId, player.stage);

  const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  const shieldPercent =
    player.maxShield > 0
      ? Math.max(0, Math.min(100, (player.shield / player.maxShield) * 100))
      : 0;

  const isLowHp = hpPercent < 30;
  const isBossActive = bossHp !== undefined;
  const bossHpPercent =
    bossHp !== undefined && bossMaxHp > 0
      ? Math.max(0, Math.min(100, (bossHp / bossMaxHp) * 100))
      : 100;

  const stageProgressPercent = Math.min(
    100,
    Math.round((player.stageKills / stageDef.targetEliminations) * 100)
  );

  const comboMult = getComboMultiplier(player.combo);
  const shouldShowAssistHint =
    clue.displayMode === 'mixing' &&
    (showHint || wrongStreakOnTarget >= diffCfg.autoHintWrongStreak);

  return (
    <div className="pointer-events-none fixed inset-0 select-none overflow-hidden font-sans z-10 text-white">
      {/* Vignette Kenyamanan Gerakan VR */}
      {vrComfortVignetteActive && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            background:
              'radial-gradient(circle, transparent 42%, rgba(2,6,23,0.85) 75%, rgba(2,6,23,0.98) 100%)',
          }}
        />
      )}

      {/* Vignette HP Rendah */}
      {isLowHp && (
        <div className="absolute inset-0 bg-radial from-transparent via-rose-950/15 to-rose-600/35 pointer-events-none" />
      )}

      {/* Efek Perisai Super Agen Raka Saat Aktif */}
      {abilityActiveLeft > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-25 border-4 border-cyan-300/80 animate-pulse"
          style={{
            background:
              'radial-gradient(circle, transparent 55%, rgba(34,211,238,0.22) 100%)',
          }}
        />
      )}

      {/* Efek Flicker Merah Saat Terkena Hit Musuh */}
      {playerDamageFlash && (
        <div
          className="absolute inset-0 pointer-events-none z-30 animate-pulse border-4 border-rose-500/80"
          style={{
            background:
              'radial-gradient(circle, rgba(244,63,94,0.12) 25%, rgba(225,29,72,0.55) 100%)',
          }}
        />
      )}

      {/* Efek Layar Penuh Saat Mengambil Item Darah (Hijau + Tanda Plus) */}
      {pickupFlash?.type === 'health' && (
        <div
          key={`hp_${pickupFlash.id}`}
          className="absolute inset-0 pointer-events-none z-30 overflow-hidden pickup-screen-wash"
          style={{
            background:
              'radial-gradient(circle at center, rgba(16,185,129,0.24) 0%, rgba(16,185,129,0.42) 68%, rgba(5,150,105,0.68) 100%)',
            boxShadow: 'inset 0 0 60px rgba(52,211,153,0.55)',
          }}
        >
          {[
            { left: '10%', top: '68%', size: 32, delay: '0ms' },
            { left: '22%', top: '34%', size: 24, delay: '70ms' },
            { left: '34%', top: '76%', size: 36, delay: '40ms' },
            { left: '48%', top: '24%', size: 28, delay: '90ms' },
            { left: '62%', top: '72%', size: 34, delay: '20ms' },
            { left: '76%', top: '38%', size: 26, delay: '80ms' },
            { left: '86%', top: '66%', size: 32, delay: '50ms' },
            { left: '16%', top: '18%', size: 22, delay: '110ms' },
            { left: '82%', top: '16%', size: 24, delay: '60ms' },
          ].map((item, idx) => (
            <svg
              key={idx}
              viewBox="0 0 24 24"
              className="absolute pickup-plus-float drop-shadow-[0_0_10px_rgba(52,211,153,0.95)]"
              style={{
                left: item.left,
                top: item.top,
                width: item.size,
                height: item.size,
                animationDelay: item.delay,
              }}
              aria-hidden="true"
            >
              <path
                d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5V3z"
                fill="#6ee7b7"
                stroke="#ecfdf5"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          ))}
        </div>
      )}

      {/* Efek Layar Penuh Saat Mengambil Item Perisai (Biru + Pola Banyak Hexagon) */}
      {pickupFlash?.type === 'shield' && (
        <div
          key={`sh_${pickupFlash.id}`}
          className="absolute inset-0 pointer-events-none z-30 overflow-hidden pickup-screen-wash"
          style={{
            background:
              'radial-gradient(circle at center, rgba(14,165,233,0.22) 0%, rgba(37,99,235,0.42) 68%, rgba(2,132,199,0.70) 100%)',
            boxShadow: 'inset 0 0 64px rgba(56,189,248,0.6)',
          }}
        >
          <svg
            className="w-full h-full pickup-hex-pulse"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="shieldHexPattern"
                width="56"
                height="97"
                patternUnits="userSpaceOnUse"
              >
                <polygon
                  points="28,2 54,17 54,47 28,62 2,47 2,17"
                  fill="rgba(56,189,248,0.14)"
                  stroke="#7dd3fc"
                  strokeWidth="1.6"
                />
                <polygon
                  points="0,50.5 26,65.5 26,95.5 0,110.5 -26,95.5 -26,65.5"
                  fill="rgba(56,189,248,0.10)"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                />
                <polygon
                  points="56,50.5 82,65.5 82,95.5 56,110.5 30,95.5 30,65.5"
                  fill="rgba(56,189,248,0.10)"
                  stroke="#38bdf8"
                  strokeWidth="1.4"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#shieldHexPattern)" />
          </svg>
        </div>
      )}

      {/* ====================================================================
          KOLOM KIRI: STAGE & PROGRES + HP & SHIELD (FLEX COLUMN AGAR TIDAK PERNAH BERTUMPUK)
         ==================================================================== */}
      <div
        className={`absolute flex flex-col pointer-events-none ${
          isMobilePortrait
            ? 'top-3 left-2 gap-2 w-[104px]'
            : isMobile
              ? 'top-3 left-3.5 gap-2.5 w-[126px]'
              : 'top-4 left-4 md:top-6 md:left-7 gap-3'
        }`}
      >
        {/* Kartu Stage & Bar Progres */}
        <div
          className={`bg-[#090d18]/92 border border-white/12 shadow-xl ${
            isMobilePortrait
              ? 'px-2.5 py-1.5 rounded-xl w-full'
              : isMobile
                ? 'px-3 py-2 rounded-xl w-full'
                : 'px-4 py-3 rounded-2xl min-w-[170px] md:min-w-[200px]'
          }`}
        >
          <div
            className={`flex items-center justify-between ${
              isMobile ? 'gap-1.5 mb-1' : 'gap-3 mb-2'
            }`}
          >
            <span
              className={`font-extrabold uppercase tracking-wider text-cyan-400 ${
                isMobilePortrait ? 'text-[9px]' : isMobile ? 'text-[10px]' : 'text-xs'
              }`}
            >
              {isBossActive ? 'TITAN' : `STAGE ${player.stage}`}
            </span>
            <span
              className={`font-bold tabular-nums text-white ${
                isMobilePortrait ? 'text-[11px]' : isMobile ? 'text-xs' : 'text-sm'
              }`}
            >
              {isBossActive
                ? `${Math.max(0, Math.round(bossHp || 0))}`
                : `${player.stageKills}/${stageDef.targetEliminations}`}
            </span>
          </div>

          <div
            className={`w-full bg-white/10 rounded-full overflow-hidden ${
              isMobile ? 'h-1.5' : 'h-2'
            }`}
          >
            <div
              className={`h-full transition-all duration-200 ${
                isBossActive ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
              style={{
                width: `${isBossActive ? bossHpPercent : stageProgressPercent}%`,
              }}
            />
          </div>

          <div
            className={`mt-1 flex items-center justify-between gap-1 font-bold text-slate-300 ${
              isMobilePortrait ? 'text-[8px]' : isMobile ? 'text-[9px]' : 'mt-1.5 text-[10px]'
            }`}
          >
            <span className="truncate">
              {isMobilePortrait ? charProfile.name.replace('Agen ', '') : charProfile.name}
            </span>
            <span className="px-1 py-0.5 rounded bg-white/10 text-cyan-300 uppercase leading-none shrink-0">
              {diffCfg.label}
            </span>
          </div>
        </div>

        {/* Di Mobile: Kartu HP & Shield berada langsung di bawah kartu Stage dalam kolom kiri */}
        {isMobile && (
          <div
            className={`bg-[#090d18]/92 border border-white/12 shadow-xl rounded-xl w-full pointer-events-auto ${
              isMobilePortrait ? 'px-2.5 py-1.5' : 'px-3 py-2'
            }`}
          >
            {/* HP */}
            <div className="flex items-center justify-between text-[9px] mb-0.5">
              <div className="flex items-center gap-1 text-slate-300 font-bold">
                <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                <span>HP</span>
              </div>
              <span className="font-extrabold tabular-nums text-white text-[11px]">
                {Math.round(player.hp)}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full overflow-hidden h-1.5 mb-1.5">
              <div
                className="h-full bg-rose-500 transition-all duration-150"
                style={{ width: `${hpPercent}%` }}
              />
            </div>

            {/* SHIELD */}
            <div className="flex items-center justify-between text-[9px] mb-0.5">
              <div className="flex items-center gap-1 text-slate-300 font-bold">
                <Shield className="w-2.5 h-2.5 text-cyan-400 fill-cyan-400/30" />
                <span>SHIELD</span>
              </div>
              <span className="font-extrabold tabular-nums text-white text-[11px]">
                {Math.round(player.shield)}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full overflow-hidden h-1.5">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${shieldPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          KOLOM KANAN ATAS: SKOR, UTILITAS & (DI MOBILE) VISUAL 2D SENJATA + PELURU
         ==================================================================== */}
      <div
        data-ui="true"
        className={`absolute flex flex-col items-end pointer-events-auto ${
          isMobilePortrait
            ? 'top-3 right-2 gap-2 w-[104px]'
            : isMobile
              ? 'top-3 right-3.5 gap-2.5'
              : 'top-4 right-4 md:top-6 md:right-7 gap-2.5'
        }`}
      >
        {isMobilePortrait ? (
          /* === KHUSUS MOBILE PORTRAIT: KOLOM KANAN SIMETRIS 104PX AGAR TENGAH ATAS TERBUKA UNTUK TARGET === */
          <>
            {/* Baris 1 Kanan Portrait: 3 Tombol Utilitas Rapi */}
            <div className="grid grid-cols-3 gap-1 w-full">
              <button
                type="button"
                onClick={onToggleMute}
                className="bg-[#090d18]/92 hover:bg-slate-900 border border-white/12 text-slate-200 p-1.5 rounded-xl flex items-center justify-center shadow-xl cursor-pointer"
                aria-label={isMuted ? 'Aktifkan Suara' : 'Bisukan Suara'}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                )}
              </button>

              {onToggleFullscreen ? (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="bg-[#090d18]/92 hover:bg-slate-900 border border-white/12 text-slate-200 p-1.5 rounded-xl flex items-center justify-center shadow-xl cursor-pointer"
                  aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5 text-slate-300" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={onPause}
                className="bg-[#090d18]/92 hover:bg-slate-900 border border-white/12 text-slate-200 p-1.5 rounded-xl flex items-center justify-center shadow-xl cursor-pointer"
                aria-label="Jeda"
              >
                <Pause className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>

            {/* Baris 2 Kanan Portrait: Kartu Skor & Kombo */}
            <div className="bg-[#090d18]/92 border border-white/12 px-2 py-1.5 rounded-xl shadow-xl w-full flex items-center justify-between">
              <div>
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                  SKOR
                </span>
                <span className="text-xs font-extrabold tabular-nums text-white leading-tight">
                  {player.score.toLocaleString('id-ID')}
                </span>
              </div>
              {player.combo > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-cyan-400/15 border border-cyan-400/30 text-[9px] font-extrabold tabular-nums text-cyan-300 leading-none">
                  {player.combo}x
                </span>
              )}
            </div>

            {/* Baris 3 Kanan Portrait: Kartu Visual 2D Senjata & Peluru */}
            <div className="bg-[#090d18]/92 border border-white/12 px-2 py-1.5 rounded-xl shadow-xl w-full flex flex-col items-end">
              <div className="flex items-center justify-between w-full gap-1">
                <div className="w-12 h-6.5 rounded-lg bg-[#0b1122] border border-white/12 px-1 py-0.5 flex items-center justify-center shrink-0">
                  <Weapon2DIcon weaponId={currentWeapon} />
                </div>
                <div className="flex flex-col items-end leading-none">
                  <span className="text-[7px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                    PELURU
                  </span>
                  <span
                    className={`text-sm font-black tabular-nums leading-none ${
                      ammo <= 8 ? 'text-rose-400' : 'text-white'
                    }`}
                  >
                    {ammo}
                  </span>
                </div>
              </div>
              {ammo === 0 && (
                <span className="text-[8px] font-extrabold text-rose-400 tracking-wide mt-1">
                  HABIS
                </span>
              )}
            </div>
          </>
        ) : (
          /* === TAMPILAN MOBILE LANDSCAPE & DESKTOP / VR === */
          <>
            <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2.5'}`}>
              <div
                className={`bg-[#090d18]/92 border border-white/12 flex items-center shadow-xl ${
                  isMobile
                    ? 'px-3 py-1.5 rounded-xl gap-2.5'
                    : 'px-4 py-2.5 rounded-2xl gap-4'
                }`}
              >
                <div>
                  <span
                    className={`font-bold uppercase tracking-wider text-slate-400 block ${
                      isMobile ? 'text-[9px]' : 'text-[10px]'
                    }`}
                  >
                    SKOR
                  </span>
                  <span
                    className={`font-extrabold tabular-nums text-white leading-none ${
                      isMobile ? 'text-sm' : 'text-lg md:text-xl'
                    }`}
                  >
                    {player.score.toLocaleString('id-ID')}
                  </span>
                </div>

                {player.combo > 0 && (
                  <>
                    <div className="h-5 w-px bg-white/12" />
                    <div className="text-right">
                      <span
                        className={`font-bold uppercase tracking-wider text-slate-400 block ${
                          isMobile ? 'text-[9px]' : 'text-[10px]'
                        }`}
                      >
                        KOMBO
                      </span>
                      <span
                        className={`font-extrabold tabular-nums text-cyan-400 leading-none ${
                          isMobile ? 'text-xs' : 'text-base md:text-lg'
                        }`}
                      >
                        {player.combo}x{comboMult > 1 ? ` (x${comboMult})` : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {platformMode === 'vr' && onExitVR && (
                <button
                  type="button"
                  onClick={onExitVR}
                  className="bg-[#090d18]/90 hover:bg-slate-900 border border-rose-500/50 text-rose-300 px-3.5 py-3 rounded-2xl text-xs font-bold cursor-pointer transition-colors"
                >
                  KELUAR VR
                </button>
              )}

              <button
                type="button"
                onClick={onToggleMute}
                className={`bg-[#090d18]/90 hover:bg-slate-900 border border-white/12 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl ${
                  isMobile ? 'p-2.5 rounded-xl' : 'p-3 rounded-2xl'
                }`}
                title="Suara [M]"
                aria-label={isMuted ? 'Aktifkan Suara' : 'Bisukan Suara'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                )}
              </button>

              {onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className={`bg-[#090d18]/90 hover:bg-slate-900 border border-white/12 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl ${
                    isMobile ? 'p-2.5 rounded-xl' : 'p-3 rounded-2xl'
                  }`}
                  title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
                  aria-label={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-slate-300" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-cyan-400" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onPause}
                className={`bg-[#090d18]/90 hover:bg-slate-900 border border-white/12 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl flex items-center gap-1.5 ${
                  isMobile ? 'p-2.5 rounded-xl' : 'p-3 rounded-2xl'
                }`}
                title="Jeda [Esc]"
                aria-label="Jeda"
              >
                <Pause className="w-4 h-4 text-cyan-400" />
                <GamepadBadge button="START" visible={isGamepadConnected} size="sm" />
              </button>
            </div>

            {/* Di Mobile Landscape: Kartu Senjata 2D & Peluru berada langsung di bawah baris Skor/Tombol */}
            {isMobile && (
              <div className="bg-[#090d18]/92 border border-white/12 px-3 py-2 rounded-xl shadow-xl flex flex-col items-end">
                <div className="flex items-center gap-2.5">
                  <div className="w-15 h-8 rounded-lg bg-[#0b1122] border border-white/12 px-1.5 py-0.5 flex items-center justify-center shrink-0">
                    <Weapon2DIcon weaponId={currentWeapon} />
                  </div>
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                      PELURU
                    </span>
                    <span
                      className={`text-lg font-black tabular-nums leading-none ${
                        ammo <= 8 ? 'text-rose-400' : 'text-white'
                      }`}
                    >
                      {ammo}
                    </span>
                  </div>
                </div>
                {ammo === 0 && (
                  <span className="text-[9px] font-extrabold text-rose-400 tracking-wide mt-1">
                    PELURU HABIS
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ====================================================================
          BAGIAN TENGAH ATAS: KOTAK WARNA POLOS (TANPA TEKS NAMA WARNA)
         ==================================================================== */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center ${
          isMobilePortrait
            ? 'top-11 mt-[env(safe-area-inset-top,0px)] gap-1.5'
            : isMobile
              ? 'top-3 gap-2'
              : 'top-20 md:top-6 gap-2'
        }`}
      >
        <div
          data-ui="true"
          className={`bg-[#090d18]/92 border border-white/15 shadow-2xl pointer-events-auto flex flex-col items-center ${
            isMobilePortrait
              ? 'px-2 py-1.5 rounded-xl'
              : isMobile
                ? 'px-2.5 py-1.5 rounded-xl'
                : 'px-5 py-3 rounded-2xl'
          }`}
        >
          {clue.displayMode === 'direct' ? (
            /* STAGE 1 — SATU KOTAK POLOS BERWARNA */
            <div
              className={`flex items-center ${
                isMobile ? 'gap-2' : 'gap-3.5'
              }`}
            >
              <span
                className={`font-extrabold uppercase tracking-widest text-slate-300 ${
                  isMobilePortrait ? 'text-[9px]' : isMobile ? 'text-[10px]' : 'text-xs'
                }`}
              >
                TARGET
              </span>
              <div
                className={`border-2 border-white shadow-lg ${
                  isMobile
                    ? 'w-7 h-7 rounded-lg'
                    : 'w-12 h-12 md:w-14 md:h-14 rounded-xl'
                }`}
                style={{ backgroundColor: clue.directHex }}
              />
            </div>
          ) : (
            /* STAGE 2 & STAGE 3 — DUA KOTAK POLOS BERWARNA + TANDA ? */
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center ${
                  isMobilePortrait ? 'gap-1' : isMobile ? 'gap-1.5' : 'gap-3 md:gap-3.5'
                }`}
              >
                {/* Kotak Polos Warna 1 */}
                <div
                  className={`border-2 border-white shadow-md ${
                    isMobilePortrait
                      ? 'w-5.5 h-5.5 rounded-md'
                      : isMobile
                        ? 'w-7 h-7 rounded-lg'
                        : 'w-11 h-11 md:w-13 md:h-13 rounded-xl'
                  }`}
                  style={{ backgroundColor: clue.ingredient1?.hex }}
                />

                <span
                  className={`font-black text-cyan-400 ${
                    isMobilePortrait ? 'text-[11px]' : isMobile ? 'text-sm' : 'text-xl md:text-2xl'
                  }`}
                >
                  +
                </span>

                {/* Kotak Polos Warna 2 */}
                <div
                  className={`border-2 border-white shadow-md ${
                    isMobilePortrait
                      ? 'w-5.5 h-5.5 rounded-md'
                      : isMobile
                        ? 'w-7 h-7 rounded-lg'
                        : 'w-11 h-11 md:w-13 md:h-13 rounded-xl'
                  }`}
                  style={{ backgroundColor: clue.ingredient2?.hex }}
                />

                <span
                  className={`font-black text-slate-400 ${
                    isMobilePortrait ? 'text-[11px]' : isMobile ? 'text-sm' : 'text-xl md:text-2xl'
                  }`}
                >
                  =
                </span>

                {/* Kotak Misteri ? */}
                <div
                  className={`bg-white/5 border-2 border-cyan-400/70 flex items-center justify-center font-black text-cyan-300 ${
                    isMobilePortrait
                      ? 'w-5.5 h-5.5 rounded-md text-[11px]'
                      : isMobile
                        ? 'w-7 h-7 rounded-lg text-sm'
                        : 'w-11 h-11 md:w-13 md:h-13 rounded-xl text-xl'
                  }`}
                >
                  ?
                </div>

                {onToggleHint && (
                  <button
                    type="button"
                    onClick={onToggleHint}
                    title="Petunjuk [H]"
                    className={`border transition-colors cursor-pointer flex items-center gap-1 ${
                      isMobilePortrait
                        ? 'ml-0.5 p-1 rounded-md'
                        : isMobile
                          ? 'ml-0.5 p-1.5 rounded-lg'
                          : 'ml-1 p-2 rounded-xl'
                    } ${
                      showHint
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-white/5 border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    <HelpCircle
                      className={
                        isMobilePortrait ? 'w-3 h-3' : isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'
                      }
                    />
                    <GamepadBadge button="BACK" visible={isGamepadConnected} size="sm" />
                  </button>
                )}
              </div>

              {/* Bantuan Visual Gradien Singkat (Tanpa Teks Panjang) */}
              {shouldShowAssistHint && (
                <div className="w-full mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                  <div
                    className="w-full h-2.5 rounded-full border border-white/30"
                    style={{
                      background: `linear-gradient(90deg, ${clue.ingredient1?.hex} 0%, ${clue.ingredient2?.hex} 100%)`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Status Kristal Senjata Saat Melawan Boss CHROMA TITAN */}
          {isBossActive && (
            <div className="w-full mt-2.5 pt-2.5 border-t border-white/12 flex items-center justify-center gap-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                KRISTAL:
              </span>
              {activeCrystalColorId ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg border-2 border-white shadow-md"
                    style={{ backgroundColor: getColorDef(activeCrystalColorId).hex }}
                  />
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                    LASER AKTIF
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg border-2 border-dashed border-amber-400/80 bg-amber-400/10" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 animate-pulse">
                    AMBIL KRISTAL
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Umpan Balik Tembakan Singkat & Padat */}
        {shotFeedback && (
          <div
            key={shotFeedback.timestamp}
            className={`px-4 py-1.5 rounded-xl border text-xs md:text-sm font-extrabold tracking-wide shadow-xl flex items-center gap-2 ui-banner-enter ${
              shotFeedback.type === 'wrong'
                ? 'bg-[#090d18]/95 border-rose-500 text-rose-400'
                : shotFeedback.type === 'pickup'
                  ? 'bg-[#090d18]/95 border-cyan-400 text-cyan-200'
                  : 'bg-[#090d18]/95 border-emerald-400 text-emerald-300'
            }`}
          >
            {shotFeedback.type !== 'wrong' && (
              <span
                className="w-3.5 h-3.5 rounded-sm border border-white shrink-0"
                style={{ backgroundColor: shotFeedback.colorHex }}
              />
            )}
            <span>
              {isBossActive || shotFeedback.type === 'pickup'
                ? shotFeedback.title
                : shotFeedback.type === 'wrong'
                  ? 'SALAH!'
                  : 'TEPAT!'}
            </span>
            {shotFeedback.type === 'pickup' && shotFeedback.subtitle && (
              <span className="text-[11px] font-semibold text-slate-300 hidden sm:inline">
                · {shotFeedback.subtitle}
              </span>
            )}
            {shotFeedback.points && (
              <span className="text-white tabular-nums">+{shotFeedback.points}</span>
            )}
          </div>
        )}
      </div>

      {/* ====================================================================
          TENGAH LAYAR: CROSSHAIR KONTRAS TINGGI
         ==================================================================== */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
          <div className="absolute top-0 w-0.5 h-2 bg-white/90" />
          <div className="absolute bottom-0 w-0.5 h-2 bg-white/90" />
          <div className="absolute left-0 h-0.5 w-2 bg-white/90" />
          <div className="absolute right-0 h-0.5 w-2 bg-white/90" />

          {hitmarkerActive && (
            <>
              <div
                className={`absolute inset-0 flex items-center justify-center scale-150 transition-transform ${hitmarkerWrong
                    ? 'text-rose-500'
                    : hitmarkerCrit
                      ? 'text-cyan-300'
                      : 'text-emerald-400'
                  }`}
              >
                <Crosshair className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div
                className={`absolute w-11 h-11 rounded-full border-2 animate-ping ${hitmarkerWrong
                    ? 'border-rose-500'
                    : hitmarkerCrit
                      ? 'border-cyan-300'
                      : 'border-emerald-400'
                  }`}
              />
            </>
          )}
        </div>
      </div>

      {/* ====================================================================
          BAGIAN BAWAH KIRI (KHUSUS DESKTOP / VR): HP & SHIELD
         ==================================================================== */}
      {!isMobile && (
        <div className="absolute bottom-6 left-7 flex flex-col gap-2 pointer-events-auto">
          <div className="bg-[#090d18]/92 border border-white/12 shadow-xl px-4 py-3.5 rounded-2xl min-w-[200px] md:min-w-[230px]">
            {/* HP */}
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1 text-slate-300 font-bold">
                <Heart className="text-rose-500 fill-rose-500 w-3.5 h-3.5" />
                <span>HP</span>
              </div>
              <span className="font-extrabold tabular-nums text-white text-sm">
                {Math.round(player.hp)}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full overflow-hidden h-2 mb-2.5">
              <div
                className="h-full bg-rose-500 transition-all duration-150"
                style={{ width: `${hpPercent}%` }}
              />
            </div>

            {/* SHIELD */}
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1 text-slate-300 font-bold">
                <Shield className="text-cyan-400 fill-cyan-400/30 w-3.5 h-3.5" />
                <span>SHIELD</span>
              </div>
              <span className="font-extrabold tabular-nums text-white text-sm">
                {Math.round(player.shield)}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full overflow-hidden h-1.5">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${shieldPercent}%` }}
              />
            </div>

            {/* ABILITY KHUSUS KARAKTER */}
            <button
              type="button"
              disabled={abilityCdLeft > 0}
              onClick={() => onTriggerAbility?.()}
              className={`w-full text-left transition-all rounded-xl border mt-3 px-2.5 py-2 text-xs ${
                abilityActiveLeft > 0
                  ? 'bg-cyan-400 text-slate-950 border-white font-black animate-pulse cursor-default'
                  : abilityReady
                    ? 'bg-[#0e1e3e] hover:bg-blue-600/80 border-cyan-400/60 text-white cursor-pointer'
                    : 'bg-white/4 border-white/10 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold uppercase tracking-wide flex items-center gap-1">
                  {charProfile.id === 'raka' ? (
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Heart className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{charProfile.abilityName}</span>
                </span>
                <span className="font-black tabular-nums">
                  {abilityActiveLeft > 0
                    ? `AKTIF ${abilityActiveLeft.toFixed(1)}s`
                    : abilityReady
                      ? 'SIAP [E]'
                      : `${Math.ceil(abilityCdLeft)}s`}
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          BAGIAN BAWAH KANAN (KHUSUS DESKTOP / VR): AMUNISI & VISUAL 2D SENJATA
         ==================================================================== */}
      {!isMobile && (
        <div
          data-ui="true"
          className="absolute bottom-6 right-7 flex flex-col items-end gap-2 pointer-events-auto"
        >
          <div className="bg-[#090d18]/92 border border-white/12 px-4 py-3 rounded-2xl min-w-[175px] md:min-w-[210px] flex flex-col items-end shadow-xl">
            <div className="w-full flex flex-col items-center mb-2">
              <div className="w-full h-14 px-2.5 py-1 rounded-xl bg-[#0b1122] border border-white/12 flex items-center justify-center">
                <Weapon2DIcon weaponId={currentWeapon} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 truncate max-w-full mt-1">
                {WEAPON_REGISTRY[currentWeapon].name}
              </span>
            </div>

            <div className="flex items-baseline justify-between w-full gap-2.5 pt-1.5 border-t border-white/10">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                PELURU
              </span>
              <span
                className={`text-3xl md:text-4xl font-black tabular-nums leading-none ${
                  ammo <= 8 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {ammo}
              </span>
            </div>
            {ammo === 0 && (
              <span className="text-[11px] font-extrabold text-rose-400 tracking-wide mt-1">
                PELURU HABIS · AMBIL ITEM PELURU
              </span>
            )}

            {unlockedWeapons.length > 1 && (
              <div className="flex items-center gap-1.5 w-full mt-2.5 pt-2 border-t border-white/10">
                {isGamepadConnected && <GamepadBadge button="Y" visible size="sm" />}
                <div
                  className={`grid gap-1.5 flex-1 ${
                    unlockedWeapons.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                  }`}
                >
                  {unlockedWeapons.map((wId, idx) => {
                    const isSelected = currentWeapon === wId;
                    return (
                      <button
                        key={wId}
                        type="button"
                        onClick={() => onSwitchWeapon(wId)}
                        className={`py-1 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import {
  BossPhaseDef,
  ColorInstructionClue,
  PlatformMode,
  PlayerStats,
  RYBColorId,
  ShotFeedback,
  WeaponType,
} from '../game/types';
import {
  STAGE_DEFINITIONS,
  buildColorInstructionClue,
  getColorDef,
  getComboMultiplier,
} from '../game/rules';
import {
  Volume2,
  VolumeX,
  Pause,
  Crosshair,
  Shield,
  Heart,
  HelpCircle,
} from 'lucide-react';

interface PlayingHUDProps {
  player: PlayerStats;
  targetColorId: RYBColorId;
  instructionClue?: ColorInstructionClue;
  showHint?: boolean;
  wrongStreakOnTarget?: number;
  onToggleHint?: () => void;
  currentWeapon: WeaponType;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: BossPhaseDef;
  activeCrystalColorId?: RYBColorId | null;
  dashCooldown: number;
  dashMaxCooldown: number;
  empCooldown: number;
  empMaxCooldown: number;
  overdriveCooldown: number;
  overdriveMaxCooldown: number;
  overdriveActive: boolean;
  overdriveRemaining: number;
  shotFeedback: ShotFeedback | null;
  platformMode: PlatformMode;
  vrComfortVignetteActive?: boolean;
  onSwitchWeapon: (type: WeaponType) => void;
  onPause: () => void;
  onToggleMute: () => void;
  onExitVR?: () => void;
  isMuted: boolean;
  hitmarkerActive: boolean;
  hitmarkerCrit: boolean;
  hitmarkerWrong: boolean;
  playerDamageFlash?: boolean;
}

export const PlayingHUD: React.FC<PlayingHUDProps> = ({
  player,
  targetColorId,
  instructionClue,
  showHint = false,
  wrongStreakOnTarget = 0,
  onToggleHint,
  currentWeapon,
  ammo,
  maxAmmo,
  isReloading,
  reloadProgress,
  bossHp,
  bossMaxHp = 1500,
  activeCrystalColorId = null,
  dashCooldown,
  empCooldown,
  overdriveCooldown,
  overdriveActive,
  overdriveRemaining,
  shotFeedback,
  platformMode,
  vrComfortVignetteActive = false,
  onSwitchWeapon,
  onPause,
  onToggleMute,
  onExitVR,
  isMuted,
  hitmarkerActive,
  hitmarkerCrit,
  hitmarkerWrong,
  playerDamageFlash = false,
}) => {
  const stageDef = STAGE_DEFINITIONS[player.stage] || STAGE_DEFINITIONS[1];
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
    clue.displayMode === 'mixing' && (showHint || wrongStreakOnTarget >= 2);

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

      {/* ====================================================================
          BAGIAN ATAS: STAGE, SKOR & UTILITAS
         ==================================================================== */}
      <div className="absolute top-4 left-4 right-4 md:top-6 md:left-7 md:right-7 flex items-start justify-between gap-4">
        {/* Kiri Atas: Stage & Bar Progres */}
        <div className="bg-[#090d18]/90 border border-white/12 px-4 py-3 rounded-2xl backdrop-blur-md min-w-[170px] md:min-w-[200px] shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
              {isBossActive ? 'CHROMA TITAN' : `STAGE ${player.stage}`}
            </span>
            <span className="text-sm font-bold tabular-nums text-white">
              {isBossActive
                ? `${Math.max(0, Math.round(bossHp || 0))}`
                : `${player.stageKills} / ${stageDef.targetEliminations}`}
            </span>
          </div>

          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                isBossActive ? 'bg-rose-500' : 'bg-cyan-400'
              }`}
              style={{
                width: `${isBossActive ? bossHpPercent : stageProgressPercent}%`,
              }}
            />
          </div>
        </div>

        {/* Kanan Atas: Skor, Kombo & Kontrol */}
        <div data-ui="true" className="flex items-center gap-2.5 pointer-events-auto">
          <div className="bg-[#090d18]/90 border border-white/12 px-4 py-2.5 rounded-2xl backdrop-blur-md flex items-center gap-4 shadow-xl">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                SKOR
              </span>
              <span className="text-lg md:text-xl font-extrabold tabular-nums text-white leading-none">
                {player.score.toLocaleString('id-ID')}
              </span>
            </div>

            {player.combo > 0 && (
              <>
                <div className="h-6 w-px bg-white/12" />
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    KOMBO
                  </span>
                  <span className="text-base md:text-lg font-extrabold tabular-nums text-cyan-400 leading-none">
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
            className="bg-[#090d18]/90 hover:bg-slate-900 border border-white/12 p-3 rounded-2xl text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl"
            title="Suara [M]"
            aria-label={isMuted ? 'Aktifkan Suara' : 'Bisukan Suara'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-slate-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onPause}
            className="bg-[#090d18]/90 hover:bg-slate-900 border border-white/12 p-3 rounded-2xl text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl"
            title="Jeda [Esc]"
            aria-label="Jeda"
          >
            <Pause className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* ====================================================================
          BAGIAN TENGAH ATAS: KOTAK WARNA POLOS (TANPA TEKS NAMA WARNA)
         ==================================================================== */}
      <div className="absolute top-20 md:top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div
          data-ui="true"
          className="bg-[#090d18]/92 border border-white/15 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto flex flex-col items-center"
        >
          {clue.displayMode === 'direct' ? (
            /* STAGE 1 — SATU KOTAK POLOS BERWARNA */
            <div className="flex items-center gap-3.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-300">
                TARGET
              </span>
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 border-white shadow-lg"
                style={{ backgroundColor: clue.directHex }}
              />
            </div>
          ) : (
            /* STAGE 2 & STAGE 3 — DUA KOTAK POLOS BERWARNA + TANDA ? */
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 md:gap-3.5">
                {/* Kotak Polos Warna 1 */}
                <div
                  className="w-11 h-11 md:w-13 md:h-13 rounded-xl border-2 border-white shadow-md"
                  style={{ backgroundColor: clue.ingredient1?.hex }}
                />

                <span className="text-xl md:text-2xl font-black text-cyan-400">+</span>

                {/* Kotak Polos Warna 2 */}
                <div
                  className="w-11 h-11 md:w-13 md:h-13 rounded-xl border-2 border-white shadow-md"
                  style={{ backgroundColor: clue.ingredient2?.hex }}
                />

                <span className="text-xl md:text-2xl font-black text-slate-400">=</span>

                {/* Kotak Misteri ? */}
                <div className="w-11 h-11 md:w-13 md:h-13 rounded-xl bg-white/5 border-2 border-cyan-400/70 flex items-center justify-center text-xl font-black text-cyan-300">
                  ?
                </div>

                {onToggleHint && (
                  <button
                    type="button"
                    onClick={onToggleHint}
                    title="Petunjuk [H]"
                    className={`ml-1 p-2 rounded-xl border transition-colors cursor-pointer ${
                      showHint
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-white/5 border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
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
            className={`px-4 py-1.5 rounded-xl border text-xs md:text-sm font-extrabold tracking-wide shadow-xl backdrop-blur-md flex items-center gap-2 ${
              shotFeedback.type === 'wrong'
                ? 'bg-[#090d18]/95 border-rose-500 text-rose-400'
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
              {isBossActive
                ? shotFeedback.title
                : shotFeedback.type === 'wrong'
                ? 'SALAH!'
                : 'TEPAT!'}
            </span>
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
                className={`absolute inset-0 flex items-center justify-center scale-150 transition-transform ${
                  hitmarkerWrong
                    ? 'text-rose-500'
                    : hitmarkerCrit
                    ? 'text-cyan-300'
                    : 'text-emerald-400'
                }`}
              >
                <Crosshair className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div
                className={`absolute w-11 h-11 rounded-full border-2 animate-ping ${
                  hitmarkerWrong
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
          BAGIAN BAWAH KIRI: HP, SHIELD & KEMAMPUAN
         ==================================================================== */}
      <div
        className={`absolute flex flex-col gap-2 pointer-events-auto ${
          platformMode === 'mobile'
            ? 'top-20 left-3 scale-90 origin-top-left'
            : 'bottom-6 left-7'
        }`}
      >
        <div className="bg-[#090d18]/90 border border-white/12 px-4 py-3.5 rounded-2xl min-w-[200px] md:min-w-[230px] shadow-xl backdrop-blur-md">
          {/* HP */}
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>HP</span>
            </div>
            <span className="font-extrabold tabular-nums text-white text-sm">
              {Math.round(player.hp)}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full bg-rose-500 transition-all duration-150"
              style={{ width: `${hpPercent}%` }}
            />
          </div>

          {/* SHIELD */}
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Shield className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/30" />
              <span>SHIELD</span>
            </div>
            <span className="font-extrabold tabular-nums text-white text-sm">
              {Math.round(player.shield)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${shieldPercent}%` }}
            />
          </div>

          {/* Indikator Singkat Kemampuan */}
          {platformMode !== 'mobile' && (
            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-white/10 text-[11px] font-bold">
              <div className="bg-white/5 px-2 py-1 rounded-lg text-center">
                <span className="text-slate-400 block text-[9px]">SHIFT</span>
                <span className={dashCooldown <= 0 ? 'text-cyan-400' : 'text-slate-500 tabular-nums'}>
                  {dashCooldown <= 0 ? 'DASH' : `${dashCooldown.toFixed(0)}s`}
                </span>
              </div>
              <div className="bg-white/5 px-2 py-1 rounded-lg text-center">
                <span className="text-slate-400 block text-[9px]">Q</span>
                <span className={empCooldown <= 0 ? 'text-cyan-400' : 'text-slate-500 tabular-nums'}>
                  {empCooldown <= 0 ? 'EMP' : `${empCooldown.toFixed(0)}s`}
                </span>
              </div>
              <div className="bg-white/5 px-2 py-1 rounded-lg text-center">
                <span className="text-slate-400 block text-[9px]">E</span>
                <span
                  className={
                    overdriveActive
                      ? 'text-amber-300 tabular-nums'
                      : overdriveCooldown <= 0
                      ? 'text-cyan-400'
                      : 'text-slate-500 tabular-nums'
                  }
                >
                  {overdriveActive
                    ? `${overdriveRemaining.toFixed(0)}s`
                    : overdriveCooldown <= 0
                    ? 'TURBO'
                    : `${overdriveCooldown.toFixed(0)}s`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          BAGIAN BAWAH KANAN: AMUNISI & SENJATA
         ==================================================================== */}
      <div
        data-ui="true"
        className={`absolute flex flex-col items-end gap-2 pointer-events-auto ${
          platformMode === 'mobile'
            ? 'top-20 right-3 scale-90 origin-top-right'
            : 'bottom-6 right-7'
        }`}
      >
        <div className="bg-[#090d18]/90 border border-white/12 px-5 py-3.5 rounded-2xl flex flex-col items-end min-w-[180px] md:min-w-[210px] shadow-xl backdrop-blur-md">
          <div className="flex items-baseline justify-between w-full">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              AMMO
            </span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-3xl md:text-4xl font-black tabular-nums leading-none ${
                  overdriveActive
                    ? 'text-cyan-300'
                    : ammo <= Math.max(2, Math.floor(maxAmmo * 0.2))
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                {overdriveActive ? '∞' : ammo}
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-400">
                / {maxAmmo}
              </span>
            </div>
          </div>

          {isReloading && (
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-cyan-400 transition-all duration-75"
                style={{ width: `${reloadProgress * 100}%` }}
              />
            </div>
          )}

          {platformMode !== 'mobile' && (
            <div className="grid grid-cols-4 gap-1.5 w-full mt-3 pt-2.5 border-t border-white/10">
              {(['laser_rifle', 'cyber_shotgun', 'railgun', 'plasma_smg'] as WeaponType[]).map(
                (wId, idx) => {
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
                }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

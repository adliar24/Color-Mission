import React from 'react';
import {
  BossPhaseDef,
  ColorInstructionClue,
  GameColorId,
  PlatformMode,
  PlayerStats,
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
import { GamepadBadge } from './GamepadBadge';

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
  isGamepadConnected?: boolean;
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
  unlockedWeapons,
  ammo,
  bossHp,
  bossMaxHp = 1500,
  activeCrystalColorId = null,
  shotFeedback,
  platformMode,
  isGamepadConnected = false,
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
      <div
        className={`absolute flex items-start justify-between ${
          platformMode === 'mobile'
            ? 'top-2.5 left-3 right-3 gap-2'
            : 'top-4 left-4 right-4 md:top-6 md:left-7 md:right-7 gap-4'
        }`}
      >
        {/* Kiri Atas: Stage & Bar Progres */}
        <div
          className={`bg-[#090d18]/92 border border-white/12 shadow-xl ${
            platformMode === 'mobile'
              ? 'px-2.5 py-1.5 rounded-xl min-w-[116px]'
              : 'px-4 py-3 rounded-2xl min-w-[170px] md:min-w-[200px]'
          }`}
        >
          <div
            className={`flex items-center justify-between ${
              platformMode === 'mobile' ? 'gap-2 mb-1' : 'gap-3 mb-2'
            }`}
          >
            <span
              className={`font-extrabold uppercase tracking-wider text-cyan-400 ${
                platformMode === 'mobile' ? 'text-[10px]' : 'text-xs'
              }`}
            >
              {isBossActive ? 'CHROMA TITAN' : `STAGE ${player.stage}`}
            </span>
            <span
              className={`font-bold tabular-nums text-white ${
                platformMode === 'mobile' ? 'text-xs' : 'text-sm'
              }`}
            >
              {isBossActive
                ? `${Math.max(0, Math.round(bossHp || 0))}`
                : `${player.stageKills} / ${stageDef.targetEliminations}`}
            </span>
          </div>

          <div
            className={`w-full bg-white/10 rounded-full overflow-hidden ${
              platformMode === 'mobile' ? 'h-1.5' : 'h-2'
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
        </div>

        {/* Kanan Atas: Skor, Kombo & Kontrol */}
        <div
          data-ui="true"
          className={`flex items-center pointer-events-auto ${
            platformMode === 'mobile' ? 'gap-1.5' : 'gap-2.5'
          }`}
        >
          <div
            className={`bg-[#090d18]/92 border border-white/12 flex items-center shadow-xl ${
              platformMode === 'mobile'
                ? 'px-2.5 py-1.5 rounded-xl gap-2.5'
                : 'px-4 py-2.5 rounded-2xl gap-4'
            }`}
          >
            <div>
              <span
                className={`font-bold uppercase tracking-wider text-slate-400 block ${
                  platformMode === 'mobile' ? 'text-[9px]' : 'text-[10px]'
                }`}
              >
                SKOR
              </span>
              <span
                className={`font-extrabold tabular-nums text-white leading-none ${
                  platformMode === 'mobile' ? 'text-sm' : 'text-lg md:text-xl'
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
                      platformMode === 'mobile' ? 'text-[9px]' : 'text-[10px]'
                    }`}
                  >
                    KOMBO
                  </span>
                  <span
                    className={`font-extrabold tabular-nums text-cyan-400 leading-none ${
                      platformMode === 'mobile' ? 'text-xs' : 'text-base md:text-lg'
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
              platformMode === 'mobile' ? 'p-2 rounded-xl' : 'p-3 rounded-2xl'
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

          <button
            type="button"
            onClick={onPause}
            className={`bg-[#090d18]/90 hover:bg-slate-900 border border-white/12 text-slate-200 hover:text-white transition-colors cursor-pointer shadow-xl flex items-center gap-1.5 ${
              platformMode === 'mobile' ? 'p-2 rounded-xl' : 'p-3 rounded-2xl'
            }`}
            title="Jeda [Esc]"
            aria-label="Jeda"
          >
            <Pause className="w-4 h-4 text-cyan-400" />
            <GamepadBadge button="START" visible={isGamepadConnected} size="sm" />
          </button>
        </div>
      </div>

      {/* ====================================================================
          BAGIAN TENGAH ATAS: KOTAK WARNA POLOS (TANPA TEKS NAMA WARNA)
         ==================================================================== */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center ${
          platformMode === 'mobile' ? 'top-2.5 gap-1.5' : 'top-20 md:top-6 gap-2'
        }`}
      >
        <div
          data-ui="true"
          className={`bg-[#090d18]/92 border border-white/15 shadow-2xl pointer-events-auto flex flex-col items-center ${
            platformMode === 'mobile'
              ? 'px-2.5 py-1.5 rounded-xl'
              : 'px-5 py-3 rounded-2xl'
          }`}
        >
          {clue.displayMode === 'direct' ? (
            /* STAGE 1 — SATU KOTAK POLOS BERWARNA */
            <div
              className={`flex items-center ${
                platformMode === 'mobile' ? 'gap-2' : 'gap-3.5'
              }`}
            >
              <span
                className={`font-extrabold uppercase tracking-widest text-slate-300 ${
                  platformMode === 'mobile' ? 'text-[10px]' : 'text-xs'
                }`}
              >
                TARGET
              </span>
              <div
                className={`border-2 border-white shadow-lg ${
                  platformMode === 'mobile'
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
                  platformMode === 'mobile' ? 'gap-1.5' : 'gap-3 md:gap-3.5'
                }`}
              >
                {/* Kotak Polos Warna 1 */}
                <div
                  className={`border-2 border-white shadow-md ${
                    platformMode === 'mobile'
                      ? 'w-7 h-7 rounded-lg'
                      : 'w-11 h-11 md:w-13 md:h-13 rounded-xl'
                  }`}
                  style={{ backgroundColor: clue.ingredient1?.hex }}
                />

                <span
                  className={`font-black text-cyan-400 ${
                    platformMode === 'mobile' ? 'text-sm' : 'text-xl md:text-2xl'
                  }`}
                >
                  +
                </span>

                {/* Kotak Polos Warna 2 */}
                <div
                  className={`border-2 border-white shadow-md ${
                    platformMode === 'mobile'
                      ? 'w-7 h-7 rounded-lg'
                      : 'w-11 h-11 md:w-13 md:h-13 rounded-xl'
                  }`}
                  style={{ backgroundColor: clue.ingredient2?.hex }}
                />

                <span
                  className={`font-black text-slate-400 ${
                    platformMode === 'mobile' ? 'text-sm' : 'text-xl md:text-2xl'
                  }`}
                >
                  =
                </span>

                {/* Kotak Misteri ? */}
                <div
                  className={`bg-white/5 border-2 border-cyan-400/70 flex items-center justify-center font-black text-cyan-300 ${
                    platformMode === 'mobile'
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
                      platformMode === 'mobile'
                        ? 'ml-0.5 p-1.5 rounded-lg'
                        : 'ml-1 p-2 rounded-xl'
                    } ${
                      showHint
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                        : 'bg-white/5 border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    <HelpCircle className={platformMode === 'mobile' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
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
          BAGIAN BAWAH KIRI: HP & SHIELD
         ==================================================================== */}
      <div
        className={`absolute flex flex-col gap-2 pointer-events-auto ${
          platformMode === 'mobile' ? 'top-14 left-3' : 'bottom-6 left-7'
        }`}
      >
        <div
          className={`bg-[#090d18]/92 border border-white/12 shadow-xl ${
            platformMode === 'mobile'
              ? 'px-2.5 py-1.5 rounded-xl min-w-[116px]'
              : 'px-4 py-3.5 rounded-2xl min-w-[200px] md:min-w-[230px]'
          }`}
        >
          {/* HP */}
          <div
            className={`flex items-center justify-between mb-0.5 ${
              platformMode === 'mobile' ? 'text-[10px]' : 'text-xs mb-1'
            }`}
          >
            <div className="flex items-center gap-1 text-slate-300 font-bold">
              <Heart
                className={`text-rose-500 fill-rose-500 ${
                  platformMode === 'mobile' ? 'w-3 h-3' : 'w-3.5 h-3.5'
                }`}
              />
              <span>HP</span>
            </div>
            <span
              className={`font-extrabold tabular-nums text-white ${
                platformMode === 'mobile' ? 'text-xs' : 'text-sm'
              }`}
            >
              {Math.round(player.hp)}
            </span>
          </div>
          <div
            className={`w-full bg-white/10 rounded-full overflow-hidden ${
              platformMode === 'mobile' ? 'h-1.5 mb-1.5' : 'h-2 mb-2.5'
            }`}
          >
            <div
              className="h-full bg-rose-500 transition-all duration-150"
              style={{ width: `${hpPercent}%` }}
            />
          </div>

          {/* SHIELD */}
          <div
            className={`flex items-center justify-between mb-0.5 ${
              platformMode === 'mobile' ? 'text-[10px]' : 'text-xs mb-1'
            }`}
          >
            <div className="flex items-center gap-1 text-slate-300 font-bold">
              <Shield
                className={`text-cyan-400 fill-cyan-400/30 ${
                  platformMode === 'mobile' ? 'w-3 h-3' : 'w-3.5 h-3.5'
                }`}
              />
              <span>SHIELD</span>
            </div>
            <span
              className={`font-extrabold tabular-nums text-white ${
                platformMode === 'mobile' ? 'text-xs' : 'text-sm'
              }`}
            >
              {Math.round(player.shield)}
            </span>
          </div>
          <div
            className={`w-full bg-white/10 rounded-full overflow-hidden ${
              platformMode === 'mobile' ? 'h-1' : 'h-1.5'
            }`}
          >
            <div
              className="h-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${shieldPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ====================================================================
          BAGIAN BAWAH KANAN: AMUNISI & SENJATA
         ==================================================================== */}
      <div
        data-ui="true"
        className={`absolute flex flex-col items-end gap-2 pointer-events-auto ${
          platformMode === 'mobile' ? 'top-14 right-3' : 'bottom-6 right-7'
        }`}
      >
        <div
          className={`bg-[#090d18]/92 border border-white/12 flex flex-col items-end shadow-xl ${
            platformMode === 'mobile'
              ? 'px-3 py-1.5 rounded-xl min-w-[96px]'
              : 'px-5 py-3.5 rounded-2xl min-w-[160px] md:min-w-[190px]'
          }`}
        >
          <div className="flex items-baseline justify-between w-full gap-2.5">
            <span
              className={`font-extrabold uppercase tracking-wider text-slate-400 ${
                platformMode === 'mobile' ? 'text-[10px]' : 'text-xs'
              }`}
            >
              PELURU
            </span>
            <span
              className={`font-black tabular-nums leading-none ${
                platformMode === 'mobile' ? 'text-xl' : 'text-3xl md:text-4xl'
              } ${ammo <= 8 ? 'text-rose-400' : 'text-white'}`}
            >
              {ammo}
            </span>
          </div>
          {ammo === 0 && (
            <span className="text-[11px] font-extrabold text-rose-400 tracking-wide mt-1">
              PELURU HABIS · AMBIL ITEM PELURU
            </span>
          )}

          {(platformMode !== 'mobile' || isGamepadConnected) && unlockedWeapons.length > 1 && (
            <div className="flex items-center gap-1.5 w-full mt-3 pt-2.5 border-t border-white/10">
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
    </div>
  );
};

import React, { useState } from 'react';
import {
  FileText,
  Gamepad2,
  Cpu,
  Target,
  Zap,
  Shield,
  Layers,
  Code2,
  Copy,
  Download,
  Check,
  Calculator,
  Palette,
  Glasses,
} from 'lucide-react';
import {
  WEAPON_REGISTRY,
  ENEMY_ARCHETYPES,
  UPGRADE_POOL,
  META_PERKS_CATALOG,
  ALL_RYB_COLORS,
  STAGE_DEFINITIONS,
  BOSS_PHASES,
  BASE_ELIMINATION_SCORE,
  ACCURACY_DEFINITION_ID,
  validateColorShot,
  calculateEliminationScore,
  getColorDef,
} from '../game/rules';
import { WeaponType, RYBColorId } from '../game/types';

interface GDDWorkbenchProps {
  onLaunchGame: () => void;
}

export const GDDWorkbench: React.FC<GDDWorkbenchProps> = ({ onLaunchGame }) => {
  const [activeTab, setActiveTab] = useState<string>('vision');
  const [copied, setCopied] = useState<boolean>(false);

  // State Simulasi Sandbox Interaktif
  const [calcStage, setCalcStage] = useState<1 | 2 | 3>(1);
  const [calcWeapon, setCalcWeapon] = useState<WeaponType>('laser_rifle');
  const [calcTargetColor, setCalcTargetColor] = useState<RYBColorId>('red');
  const [calcHitColor, setCalcHitColor] = useState<RYBColorId>('red');
  const [calcCombo, setCalcCombo] = useState<number>(3);
  const [calcDamageUpgrade, setCalcDamageUpgrade] = useState<boolean>(false);
  const [calcHeadshot, setCalcHeadshot] = useState<boolean>(false);

  const selectedWeapon = WEAPON_REGISTRY[calcWeapon];
  const stageDef = STAGE_DEFINITIONS[calcStage];
  const dmgMult = calcDamageUpgrade ? 1.35 : 1.0;

  const shotSim = validateColorShot(
    calcTargetColor,
    calcHitColor,
    selectedWeapon.damage,
    calcHeadshot,
    dmgMult,
    calcDamageUpgrade ? 0.25 : 0
  );

  const effectivePelletDmg = selectedWeapon.pellets
    ? shotSim.damage * selectedWeapon.pellets
    : shotSim.damage;
  const effectiveDPS = Math.round(effectivePelletDmg * selectedWeapon.fireRate);

  const normalHp = Math.round(
    ENEMY_ARCHETYPES.chromabot_normal.maxHp * stageDef.enemyHpMult
  );
  const eliteHp = Math.round(
    ENEMY_ARCHETYPES.chromabot_elite.maxHp * stageDef.enemyHpMult
  );
  const titanHp = ENEMY_ARCHETYPES.chroma_titan.maxHp;

  const normalTTK = effectiveDPS > 0 ? (normalHp / effectiveDPS).toFixed(2) : '∞ (0 Dmg)';
  const eliteTTK = effectiveDPS > 0 ? (eliteHp / effectiveDPS).toFixed(2) : '∞ (0 Dmg)';
  const titanTTK = effectiveDPS > 0 ? (titanHp / effectiveDPS).toFixed(2) : '∞ (0 Dmg)';

  const elimSim = calculateEliminationScore(calcCombo);

  const fullGDDMarkdown = `# DOKUMEN DESAIN GAME (GDD): COLOR MISSION
**Slogan**: Kuasai Warna. Selesaikan Misi.  
**Genre**: Educational First-Person Shooter (FPS) / 3D Action  
**Target Platform**: Web 3D — Desktop (Keyboard & Mouse), Mobile/Tablet (Touch), & VR Meta Quest 3S (WebXR)  
**Mesin & Teknologi**: React 19, TypeScript, Three.js WebGL + WebXRManager, Tailwind CSS v4, Web Audio API  

---

## 1. VISI & MEKANIK INTI (TEMBAK TARGET WARNA)
### 1.1 Konsep Utama
Pemain bergerak di arena 3D futuristik dengan kamera orang pertama (FPS), membidik, menembak, melakukan isi ulang amunisi, serta menghindari serangan proyektil sambil mengeliminasi keluarga robot **CHROMABOTS** yang warnanya sesuai dengan instruksi **Target Warna RYB** aktif di layar.

### 1.2 Aturan Validasi Tembakan
- **Tembakan Mengenai Warna Target yang Benar**: Memberikan damage senjata normal (termasuk bonus headshot kritis 1.75x).
- **Eliminasi Target Warna yang Benar**: Memberikan ${BASE_ELIMINATION_SCORE} poin dasar dikali pengali kombo, menaikkan kombo (+1), menjatuhkan Data Cores, lalu memilih Target Warna berikutnya dari stage aktif.
- **Tembakan Mengenai Musuh Berwarna Salah**: Memberikan **0 damage**, mengonsumsi amunisi, dan **mereset kombo menjadi 0**, namun **tidak mengurangi Kesehatan (HP) pemain**.
- **Serangan Musuh**: Proyektil energi dari Chromabots dan Chroma Titan mengurangi Perisai terlebih dahulu sebelum mengurangi Kesehatan pemain.

---

## 2. SISTEM WARNA PIGMEN RYB TERPUSAT (12 WARNA)
| Kategori | Nama Warna | ID Logis | Kode Hex | Resep Pencampuran |
|---|---|---|---|---|
${ALL_RYB_COLORS.map(
  (c) =>
    `| **${c.categoryLabelId}** | ${c.nameId} (${c.nameEn}) | \`${c.id}\` | \`${c.hex}\` | ${c.recipeTextId} |`
).join('\n')}

---

## 3. ALUR TIGA TAHAP BERURUTAN & BOSS CHROMA TITAN
1. **Tahap 1 — Sektor Warna Primer**:
   - Kumpulan Warna: Merah, Kuning, Biru.
   - Target Eliminasi: ${STAGE_DEFINITIONS[1].targetEliminations} Chromabots benar (Bonus Selesai: +${STAGE_DEFINITIONS[1].stageClearBonus} poin).
2. **Tahap 2 — Perimeter Warna Sekunder**:
   - Kumpulan Warna: Jingga (Merah+Kuning), Hijau (Kuning+Biru), Ungu (Merah+Biru).
   - Target Eliminasi: ${STAGE_DEFINITIONS[2].targetEliminations} Chromabots benar (Bonus Selesai: +${STAGE_DEFINITIONS[2].stageClearBonus} poin).
3. **Tahap 3 — Inti Spektrum Tersier & Boss CHROMA TITAN**:
   - Kumpulan Warna Survival: 6 Warna Tersier (${STAGE_DEFINITIONS[3].targetEliminations} eliminasi benar).
   - Pertarungan Boss **CHROMA TITAN** (${ENEMY_ARCHETYPES.chroma_titan.maxHp} HP) dengan titik lemah **COLOR CORE** yang melewati 3 Fase:
     - **Fase 1 (100%–66% HP)**: Kumpulan warna Primer.
     - **Fase 2 (66%–33% HP)**: Kumpulan warna Sekunder, tempo meningkat.
     - **Fase 3 (33%–0% HP)**: Kumpulan 6 warna Tersier + kawalan Chromabots.

---

## 4. ARSENAL SENJATA & KEMAMPUAN
| Nama Senjata | Kategori | Damage | Kecepatan Tembak | Kapasitas Amunisi | Waktu Isi Ulang |
|---|---|---|---|---|---|
${Object.values(WEAPON_REGISTRY)
  .map(
    (w) =>
      `| **${w.name}** | ${w.category} | ${w.damage}${w.pellets ? `x${w.pellets}` : ''} | ${w.fireRate} RPS | ${w.magSize} | ${w.reloadTime}d |`
  )
  .join('\n')}

---

## 5. SKOR, KOMBO, DAN AKURASI
- **Skor Dasar Eliminasi**: ${BASE_ELIMINATION_SCORE} poin.
- **Kombo 3–4 Berturut-turut**: Pengali **x2** (${BASE_ELIMINATION_SCORE * 2} poin).
- **Kombo >= 5 Berturut-turut**: Pengali **x3** (${BASE_ELIMINATION_SCORE * 3} poin).
- **Kombo >= 10 Berturut-turut**: Label **PERFECT STREAK** (x3).
- **Definisi Akurasi**: ${ACCURACY_DEFINITION_ID}
`;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(fullGDDMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([fullGDDMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GDD_COLOR_MISSION_RYB.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'vision', label: '1. Visi & Aturan Inti', icon: <Target className="w-4 h-4" /> },
    { id: 'colors', label: '2. Sistem 12 Warna RYB', icon: <Palette className="w-4 h-4" /> },
    { id: 'stages', label: '3. Tahap, Chromabots & Boss', icon: <Layers className="w-4 h-4" /> },
    { id: 'arsenal', label: '4. Senjata & Augmentasi', icon: <Zap className="w-4 h-4" /> },
    { id: 'sandbox', label: '5. Kalkulator & Simulasi', icon: <Calculator className="w-4 h-4" /> },
    { id: 'architecture', label: '6. Arsitektur Desktop/Mobile/VR', icon: <Glasses className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans select-text">
      {/* Top Bar */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-400">
                GDD WORKBENCH · SINKRON DENGAN KODE SUMBER
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-bold text-white">
              COLOR MISSION — Kuasai Warna. Selesaikan Misi.
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Salin Markdown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Unduh .MD</span>
          </button>

          <button
            type="button"
            onClick={onLaunchGame}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Kembali ke Permainan</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Navigasi Tab */}
        <nav className="w-full md:w-64 bg-slate-900/60 border-b md:border-b-0 md:border-r border-slate-800 p-3 flex md:flex-col gap-1.5 overflow-x-auto shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2.5 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Panel Isi Tab */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6">
          {/* TAB 1: VISI & ATURAN INTI */}
          {activeTab === 'vision' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                  1. Identitas & Konsep Inti
                </span>
                <h2 className="text-2xl font-bold text-white mt-1 mb-3">
                  COLOR MISSION — Educational 3D FPS Action
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                  <strong>COLOR MISSION</strong> menggabungkan aksi First-Person Shooter (FPS) 3D sesungguhnya dengan pembelajaran teori warna pigmen tradisional <strong>RYB (Merah, Kuning, Biru)</strong>. Pemain tidak menjawab kuis statis, melainkan bermanuver di dalam arena 3D, membidik, mengisi ulang peluru, menghindari serangan, dan mengeliminasi <strong>CHROMABOTS</strong> yang sesuai dengan instruksi <strong>Target Warna</strong> aktif.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs font-mono text-emerald-400 font-bold block mb-1">
                      Validasi Warna Logis
                    </span>
                    <p className="text-xs text-slate-400">
                      Pemeriksaan tembakan menggunakan ID warna logis (<code>RYBColorId</code>) dari sumber data tunggal <code>src/game/colors.ts</code>, bebas dari bias pencahayaan layar.
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs font-mono text-amber-400 font-bold block mb-1">
                      Konsekuensi Tembakan Salah
                    </span>
                    <p className="text-xs text-slate-400">
                      Menembak warna yang salah memberikan 0 damage, menghabiskan amunisi, dan mereset kombo menjadi 0 tanpa mengurangi Kesehatan (HP) pemain secara langsung.
                    </p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <span className="text-xs font-mono text-cyan-400 font-bold block mb-1">
                      Skor & Kombo Beruntun
                    </span>
                    <p className="text-xs text-slate-400">
                      Eliminasi benar bernilai {BASE_ELIMINATION_SCORE} poin dasar. 3 beruntun = x2, 5 beruntun = x3, dan 10 beruntun memicu status <strong>PERFECT STREAK</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabel Aturan Tembakan */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4">
                  Matriks Aturan Validasi Tembakan & Akurasi
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="py-2.5 pr-4">Kondisi Gameplay</th>
                        <th className="py-2.5">Dampak Sistem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      <tr>
                        <td className="py-2.5 pr-4 font-bold text-emerald-400">
                          Tembakan mengenai musuh dengan warna target benar
                        </td>
                        <td className="py-2.5">
                          Terapkan damage senjata normal (1.75x bila headshot kritis).
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-bold text-emerald-300">
                          Musuh target berhasil dieliminasi
                        </td>
                        <td className="py-2.5">
                          Berikan skor ({BASE_ELIMINATION_SCORE} × pengali kombo) tepat satu kali, naikkan kombo, lalu pilih target warna berikutnya.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-bold text-rose-400">
                          Menembak musuh dengan warna yang salah
                        </td>
                        <td className="py-2.5">
                          Damage = 0, amunisi tetap berkurang, kombo direset menjadi 0, tampil peringatan WARNA SALAH!, tanpa penalti HP pemain.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-bold text-amber-300">
                          Tembakan meleset ke dinding/lantai
                        </td>
                        <td className="py-2.5">
                          Target warna aktif tidak berubah; amunisi berkurang.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-bold text-purple-300">
                          Serangan proyektil musuh mengenai pemain
                        </td>
                        <td className="py-2.5">
                          Diserap oleh Perisai terlebih dahulu, lalu mengurangi Kesehatan (HP) pemain.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs font-mono text-cyan-300 mt-4">
                  {ACCURACY_DEFINITION_ID}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SISTEM 12 WARNA RYB */}
          {activeTab === 'colors' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-2">
                  Konfigurasi Terpusat 12 Warna Pigmen RYB (<code>src/game/colors.ts</code>)
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  Terdiri dari tepat 3 warna Primer, 3 warna Sekunder, dan 6 warna Tersier dengan kode hex kontras tinggi yang mudah dibedakan di dalam arena 3D.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {ALL_RYB_COLORS.map((col) => (
                    <div
                      key={col.id}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl border-2 border-white shrink-0 shadow"
                          style={{ backgroundColor: col.hex }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{col.nameId}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                              {col.categoryLabelId}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {col.id} · {col.hex}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 mt-1">{col.shortDescId}</div>

                      <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-amber-300">
                        Resep: <strong>{col.recipeTextId}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TAHAP, CHROMABOTS & BOSS CHROMA TITAN */}
          {activeTab === 'stages' && (
            <div className="max-w-4xl space-y-6">
              {/* 3 Stage Berurutan */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4">
                  Progresi Tiga Tahap Berurutan (<code>src/game/stages.ts</code>)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {([1, 2, 3] as const).map((sNum) => {
                    const st = STAGE_DEFINITIONS[sNum];
                    return (
                      <div
                        key={sNum}
                        className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between"
                      >
                        <div>
                          <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                            {st.title} · Kategori {st.categoryLabel}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1 mb-2">
                            {st.subtitle}
                          </h3>
                          <p className="text-xs text-slate-300 mb-3">{st.description}</p>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono border-t border-slate-800 pt-3">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Target Eliminasi:</span>
                            <span className="text-white font-bold">{st.targetEliminations}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Batas Musuh Aktif:</span>
                            <span className="text-white">{st.maxConcurrentEnemies}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Peluang Elite:</span>
                            <span className="text-purple-300">
                              {Math.round(st.eliteChance * 100)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Bonus Tahap Selesai:</span>
                            <span className="text-emerald-400">+{st.stageClearBonus}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Keluarga CHROMABOTS & CHROMA TITAN */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4">
                  Spesifikasi CHROMABOTS & Boss Terakhir CHROMA TITAN
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {Object.values(ENEMY_ARCHETYPES).map((en) => (
                    <div
                      key={en.type}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2"
                    >
                      <div className="text-xs font-mono text-purple-400 uppercase font-bold">
                        {en.role}
                      </div>
                      <h3 className="text-lg font-bold text-white">{en.name}</h3>
                      <div className="text-xs font-mono space-y-1 text-slate-300 pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-slate-400">HP Dasar:</span>
                          <span>{en.maxHp} HP</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Kecepatan Gerak:</span>
                          <span>{en.speed} m/d</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Damage Proyektil:</span>
                          <span>{en.damage}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Data Core Drop:</span>
                          <span className="text-amber-300">+{en.dataCoreDrop} Core</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tiga Fase Boss Chroma Titan */}
                <h3 className="text-sm font-mono font-bold uppercase text-rose-400 mb-3">
                  Tiga Fase Pertarungan CHROMA TITAN & Sinkronisasi COLOR CORE
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.values(BOSS_PHASES).map((bp) => (
                    <div
                      key={bp.phase}
                      className="bg-slate-950 border border-rose-500/30 p-3.5 rounded-xl text-xs"
                    >
                      <div className="font-bold text-white mb-1">{bp.title}</div>
                      <div className="font-mono text-rose-300 text-[11px] mb-1.5">
                        Rentang HP: {Math.round(bp.hpThresholdMax * 100)}% –{' '}
                        {Math.round(bp.hpThresholdMin * 100)}%
                      </div>
                      <p className="text-slate-400">{bp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SENJATA & AUGMENTASI */}
          {activeTab === 'arsenal' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4">
                  Arsenal 4 Senjata Resmi (Semua Tunduk pada Validasi Warna)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(WEAPON_REGISTRY).map((w) => (
                    <div
                      key={w.id}
                      className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-white">{w.name}</h3>
                        <span
                          className="text-[11px] font-mono px-2 py-0.5 rounded border"
                          style={{ borderColor: w.color, color: w.color }}
                        >
                          {w.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{w.description}</p>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">DAMAGE</span>
                          <span className="text-white font-bold">
                            {w.damage}
                            {w.pellets ? ` × ${w.pellets}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">FIRE RATE</span>
                          <span className="text-cyan-300 font-bold">{w.fireRate}/d</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">AMUNISI / ISI ULANG</span>
                          <span className="text-amber-300 font-bold">
                            {w.magSize} / {w.reloadTime}d
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-4">
                  Modul Augmentasi Antar-Tahap & Upgrade Permanen
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {UPGRADE_POOL.map((u) => (
                    <div
                      key={u.id}
                      className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-white">{u.name}</span>
                        <span className="text-[10px] font-mono text-cyan-300 uppercase">
                          {u.rarityLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{u.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KALKULATOR & SIMULASI BALANCING */}
          {activeTab === 'sandbox' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-slate-900 border border-cyan-500/40 p-6 rounded-2xl">
                <h2 className="text-xl font-bold text-white mb-2">
                  Kalkulator Interaktif: Validasi Warna, DPS, Time-to-Kill (TTK) & Skor Kombo
                </h2>
                <p className="text-xs text-slate-400 mb-6">
                  Simulasi ini memanggil fungsi <code>validateColorShot</code> dan <code>calculateEliminationScore</code> langsung dari <code>src/game/rules.ts</code>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Kontrol Input Simulasi */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4 text-xs">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1.5">
                        Pilih Tahap (Stage Scaling):
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([1, 2, 3] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCalcStage(s)}
                            className={`py-2 rounded-lg font-mono font-bold border cursor-pointer ${
                              calcStage === s
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                : 'bg-slate-900 text-slate-300 border-slate-800'
                            }`}
                          >
                            Tahap {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-300 block mb-1.5">
                        Pilih Senjata:
                      </label>
                      <select
                        value={calcWeapon}
                        onChange={(e) => setCalcWeapon(e.target.value as WeaponType)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                      >
                        {Object.values(WEAPON_REGISTRY).map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.damage} Dmg, {w.fireRate} RPS)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-cyan-300 block mb-1">
                          Target Warna HUD:
                        </label>
                        <select
                          value={calcTargetColor}
                          onChange={(e) => setCalcTargetColor(e.target.value as RYBColorId)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono"
                        >
                          {ALL_RYB_COLORS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameId} ({c.categoryLabelId})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-amber-300 block mb-1">
                          Warna Musuh Ditembak:
                        </label>
                        <select
                          value={calcHitColor}
                          onChange={(e) => setCalcHitColor(e.target.value as RYBColorId)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono"
                        >
                          {ALL_RYB_COLORS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameId} ({c.categoryLabelId})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-300">Jumlah Kombo Saat Ini:</span>
                        <span className="font-mono text-amber-300 font-bold">{calcCombo}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="15"
                        value={calcCombo}
                        onChange={(e) => setCalcCombo(parseInt(e.target.value, 10))}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={calcDamageUpgrade}
                          onChange={(e) => setCalcDamageUpgrade(e.target.checked)}
                          className="accent-cyan-400"
                        />
                        <span>Inti Munisi Kuantum (+35% Dmg)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={calcHeadshot}
                          onChange={(e) => setCalcHeadshot(e.target.checked)}
                          className="accent-cyan-400"
                        />
                        <span>Headshot Kritis</span>
                      </label>
                    </div>
                  </div>

                  {/* Hasil Output Kalkulasi */}
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4">
                    <div
                      className={`p-3.5 rounded-xl border font-mono text-xs ${
                        shotSim.isCorrectColor
                          ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                          : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">
                        Status Validasi:{' '}
                        {shotSim.isCorrectColor
                          ? 'WARNA BENAR! (Damage Diterapkan)'
                          : 'WARNA SALAH! (0 Damage · Kombo Reset)'}
                      </div>
                      <div>
                        Target: <strong>{getColorDef(calcTargetColor).nameId}</strong> vs Musuh:{' '}
                        <strong>{getColorDef(calcHitColor).nameId}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">DAMAGE PER TEMBAKAN</span>
                        <span className="text-xl font-bold text-white">
                          {effectivePelletDmg} Dmg
                        </span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">EFEKTIF DPS</span>
                        <span className="text-xl font-bold text-cyan-400">{effectiveDPS} /d</span>
                      </div>
                    </div>

                    <div className="space-y-2 font-mono text-xs border-t border-slate-800 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          TTK Chromabot Normal ({normalHp} HP):
                        </span>
                        <span className="text-white font-bold">{normalTTK} detik</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          TTK Chromabot Elite ({eliteHp} HP):
                        </span>
                        <span className="text-purple-300 font-bold">{eliteTTK} detik</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          TTK CHROMA TITAN ({titanHp} HP):
                        </span>
                        <span className="text-rose-400 font-bold">{titanTTK} detik</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-800">
                        <span className="text-slate-400">Skor Eliminasi pada Kombo {calcCombo}x:</span>
                        <span className="text-amber-300 font-bold">
                          +{elimSim.pointsAwarded} Poin (x{elimSim.multiplier}{' '}
                          {elimSim.streakLabel || ''})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ARSITEKTUR DESKTOP / MOBILE / VR */}
          {activeTab === 'architecture' && (
            <div className="max-w-4xl space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h2 className="text-xl font-bold text-white">
                  Arsitektur Satu Basis Kode — Tiga Mode Platform (Desktop, Mobile, VR Meta Quest 3S)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <h3 className="font-bold text-cyan-400 font-mono mb-2">
                      1. InputManager Terpusat (<code>src/game/input/InputManager.ts</code>)
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      Memisahkan input perangkat (<code>DesktopInput</code>, <code>MobileInput</code>, dan <code>VRInput</code>) menjadi satu struktur perintah standar <code>GameplayInputCommand</code> setiap frame. Mencegah duplikasi aturan gameplay dan membersihkan event listener saat berganti mode.
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <h3 className="font-bold text-purple-400 font-mono mb-2">
                      2. WebXR Meta Quest 3S (<code>src/game/xr/VRManager.ts</code>)
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      Menggunakan Three.js <code>WebXRManager</code> dan <code>navigator.xr.requestSession(&apos;immersive-vr&apos;)</code>. Dilengkapi pelacakan controller kanan untuk membidik/menembak, thumbstick kiri untuk bergerak, Snap/Smooth Turning, serta <code>VRWorldHUD</code> 3D di dalam ruang VR.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

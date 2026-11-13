# COLOR MISSION — Kuasai Warna. Selesaikan Misi.

Game Web 3D First-Person Shooter (FPS) Edukatif Teori Warna Pigmen RYB (**Merah, Kuning, Biru**) yang dirancang untuk **Desktop**, **Mobile/Tablet**, dan **VR Meta Quest 3S (WebXR)**, lengkap dengan **GDD Workbench** interaktif.

## Fitur Utama
- **Mekanik Tembak Target Warna (Color Target Shooting)**: Eliminasi **CHROMABOTS** yang warnanya cocok dengan instruksi **Target Warna** aktif di HUD. Tembakan salah memberikan 0 damage, menghabiskan amunisi, dan mereset kombo tanpa mengurangi Kesehatan pemain.
- **Sistem Warna RYB Terpusat (`src/game/colors.ts`)**: 12 warna pigmen tradisional (3 Primer, 3 Sekunder, 6 Tersier) beserta resep pencampurannya.
- **Tiga Tahap Berurutan & Transisi Edukasi (`src/game/stages.ts`)**:
  - **Tahap 1 (Primer)**: 12 eliminasi benar (Merah, Kuning, Biru).
  - **Tahap 2 (Sekunder)**: 18 eliminasi benar (Jingga, Hijau, Ungu).
  - **Tahap 3 (Tersier + Boss)**: 24 eliminasi benar (6 warna Tersier) dilanjutkan pertarungan boss **CHROMA TITAN** (3 Fase dengan titik lemah **COLOR CORE** yang selalu sinkron).
- **Satu Game Web, Tiga Mode Platform**:
  - **Desktop**: Keyboard (`WASD`, `Spasi`, `R`, `Shift`, `Q`, `E`, `1–4`) & Mouse Pointer Lock.
  - **Mobile / Tablet**: Virtual Joystick kiri, area sentuh kamera kanan, serta tombol aksi yang ramah ibu jari.
  - **VR Meta Quest 3S**: WebXR `immersive-vr` dengan pelacakan kepala & controller, Snap/Smooth Turning, vignette kenyamanan, dan HUD 3D di dalam dunia VR (`VRWorldHUD`).

## Langkah Menjalankan Game Secara Lokal

**Prasyarat:** Node.js (v18+)

1. Instal dependensi:
   ```bash
   npm install
   ```
2. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` di browser.
3. Menjalankan pemeriksaan tipe TypeScript, unit test, dan build produksi:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. **Pengujian VR pada Meta Quest 3S**:
   - Pastikan aplikasi disajikan melalui *secure context* (`https://` atau `localhost` dengan port forwarding ADB).
   - Buka di **Meta Quest Browser**, lalu tekan tombol **MASUK MODE VR** pada menu utama.

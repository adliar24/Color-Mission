// Generator suara prosedural Web Audio API untuk COLOR MISSION
export type BgmMode = 'off' | 'menu' | 'combat' | 'boss';

const MENU_CHORDS = [
  // A minor -> F major -> C major -> G major (Chill cyber-lounge main menu)
  { bass: 55.0, pad: [220.0, 261.63, 329.63], arp: [440.0, 523.25, 659.25, 523.25] }, // Am
  { bass: 43.65, pad: [174.61, 220.0, 261.63], arp: [349.23, 440.0, 523.25, 440.0] }, // F
  { bass: 65.41, pad: [130.81, 164.81, 196.0], arp: [261.63, 329.63, 392.0, 523.25] }, // C
  { bass: 49.0, pad: [196.0, 246.94, 293.66], arp: [392.0, 493.88, 587.33, 493.88] }, // G
];

const BGM_CHORDS = [
  // D minor -> Bb major -> C major -> A minor (Synthwave cyber progression)
  { bass: 73.42, pad: [146.83, 174.61, 220.0], arp: [293.66, 349.23, 440.0, 587.33] }, // Dm
  { bass: 58.27, pad: [116.54, 146.83, 174.61], arp: [233.08, 293.66, 349.23, 466.16] }, // Bb
  { bass: 65.41, pad: [130.81, 164.81, 196.0], arp: [261.63, 329.63, 392.0, 523.25] }, // C
  { bass: 55.0, pad: [110.0, 130.81, 164.81], arp: [220.0, 261.63, 329.63, 440.0] }, // Am
];

const BOSS_CHORDS = [
  // D minor -> Eb major -> F minor -> C#dim/A (Urgent cyber-boss tension)
  { bass: 73.42, pad: [146.83, 174.61, 220.0], arp: [293.66, 349.23, 440.0, 587.33] },
  { bass: 77.78, pad: [155.56, 196.0, 233.08], arp: [311.13, 392.0, 466.16, 622.25] },
  { bass: 69.3, pad: [138.59, 174.61, 207.65], arp: [277.18, 349.23, 415.3, 554.37] },
  { bass: 55.0, pad: [110.0, 138.59, 164.81], arp: [220.0, 277.18, 329.63, 440.0] },
];

class SoundManager {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private bgmMode: BgmMode = 'off';
  private bgmMasterGain: GainNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private nextNoteTime = 0;
  private noiseBuffer: AudioBuffer | null = null;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.bgmMasterGain) {
      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.value = 3400;
      this.bgmMasterGain = this.ctx.createGain();
      this.bgmMasterGain.gain.value = this.isMuted ? 0 : 0.2;
      this.bgmFilter.connect(this.bgmMasterGain);
      this.bgmMasterGain.connect(this.ctx.destination);
    }
  }

  private ensureNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  public playLaser() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playShotgun() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.18);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(now);
  }

  public playRailgun() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playPlasma() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playHitmarker(isCrit: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isCrit ? 2200 : 1350, now);

    gain.gain.setValueAtTime(isCrit ? 0.2 : 0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playCorrectTargetKill(combo: number = 1) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const baseFreq = 523.25 * Math.min(1.5, 1 + (combo - 1) * 0.05); // C5 naik sesuai kombo
    const freqs = [baseFreq, baseFreq * 1.25];

    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  public playWrongColorHit() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.setValueAtTime(145, now + 0.07);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playEnemyDeath() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playDash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playEmp() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playOverdrive() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.3);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playPlayerHurt() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playWaveFanfare() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  public playBossPhaseShift() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const notes = [330, 440, 659.25, 987.77];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.07;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    });
  }

  public playEnemyAttack() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.16);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playProjectileImpact() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playUiClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(1240, now + 0.045);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.bgmMasterGain) {
      this.bgmMasterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime, 0.04);
    }
    return this.isMuted;
  }

  public unlockBgm() {
    this.initContext();
    if (this.bgmMode !== 'off' && this.bgmTimer === null && typeof window !== 'undefined') {
      this.startBgmScheduler();
    }
  }

  public setBgmMode(mode: BgmMode) {
    if (this.bgmMode === mode) return;
    this.bgmMode = mode;

    if (mode === 'off') {
      this.stopBgm();
      return;
    }

    this.initContext();
    if (this.ctx && this.bgmFilter && this.bgmMasterGain) {
      const targetCutoff = mode === 'menu' ? 1900 : mode === 'boss' ? 4200 : 3200;
      const targetVol = this.isMuted ? 0 : mode === 'menu' ? 0.16 : mode === 'boss' ? 0.22 : 0.19;
      this.bgmFilter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.2);
      this.bgmMasterGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.12);
    }

    if (this.bgmTimer === null && typeof window !== 'undefined') {
      this.startBgmScheduler();
    }
  }

  public stopBgm() {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private startBgmScheduler() {
    if (!this.ctx || typeof window === 'undefined') return;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || this.bgmMode === 'off') return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx.state !== 'running') return;

      const bpm = this.bgmMode === 'menu' ? 114 : this.bgmMode === 'boss' ? 138 : 126;
      const stepDur = 60 / bpm / 4; // 16th note
      const lookahead = 0.14;

      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        this.scheduleBgmStep(this.bgmStep, this.nextNoteTime, stepDur);
        this.nextNoteTime += stepDur;
        this.bgmStep = (this.bgmStep + 1) % 64;
      }
    }, 35);
  }

  private scheduleBgmStep(step: number, time: number, stepDur: number) {
    if (!this.ctx || !this.bgmFilter || this.isMuted) return;

    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const prog =
      this.bgmMode === 'menu'
        ? MENU_CHORDS
        : this.bgmMode === 'boss'
          ? BOSS_CHORDS
          : BGM_CHORDS;
    const chord = prog[bar % prog.length];

    // 1. Warm Cyber Pad on beat 1 of each bar
    if (stepInBar === 0) {
      const padDur = stepDur * 15.5;
      chord.pad.forEach((freq) => {
        if (!this.ctx || !this.bgmFilter) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.001, time);
        g.gain.linearRampToValueAtTime(this.bgmMode === 'menu' ? 0.09 : 0.06, time + 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, time + padDur);
        osc.connect(g);
        g.connect(this.bgmFilter);
        osc.start(time);
        osc.stop(time + padDur + 0.02);
      });
    }

    // 2. Driving Synthwave Bass (Menu: upbeat 8th-note groove, Combat/Boss: punchy 16th/8th)
    const playBass =
      this.bgmMode === 'menu'
        ? stepInBar % 2 === 0
        : stepInBar % 2 === 0 || (this.bgmMode === 'boss' && stepInBar % 4 === 3);
    if (playBass) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = this.bgmMode === 'menu' ? 'triangle' : 'sawtooth';
      const octaveBoost = stepInBar % 4 === 2 ? 2 : 1;
      osc.frequency.setValueAtTime(chord.bass * octaveBoost, time);
      const dur = stepDur * (this.bgmMode === 'menu' ? 1.6 : 1.35);
      g.gain.setValueAtTime(this.bgmMode === 'menu' ? 0.14 : 0.18, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(g);
      g.connect(this.bgmFilter);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    }

    // 3. Retro-Futuristic Arpeggio Lead (Menu: upbeat cyber-lounge bell, Combat/Boss: sharp synth lead)
    const playArp =
      this.bgmMode === 'menu'
        ? stepInBar % 2 === 0 || stepInBar === 11
        : stepInBar % 2 === 0 || stepInBar === 7 || stepInBar === 15;
    if (playArp) {
      const arpNote = chord.arp[(stepInBar + bar) % chord.arp.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = this.bgmMode === 'menu' ? 'sine' : this.bgmMode === 'boss' ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(arpNote, time);
      const dur = stepDur * (this.bgmMode === 'menu' ? 1.8 : 1.1);
      g.gain.setValueAtTime(this.bgmMode === 'menu' ? 0.075 : 0.065, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(g);
      g.connect(this.bgmFilter);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    }

    // 4. Punchy Kick & Crisp Hi-Hat/Snare (Menu: ringan & groovy, Combat/Boss: penuh)
    if (stepInBar % 4 === 0) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(this.bgmMode === 'menu' ? 110 : 135, time);
      kick.frequency.exponentialRampToValueAtTime(42, time + 0.09);
      kg.gain.setValueAtTime(this.bgmMode === 'menu' ? 0.14 : 0.32, time);
      kg.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
      kick.connect(kg);
      kg.connect(this.bgmFilter);
      kick.start(time);
      kick.stop(time + 0.12);
    }

    if (
      (this.bgmMode === 'menu' && stepInBar % 4 === 2) ||
      (this.bgmMode !== 'menu' && (stepInBar % 4 === 2 || stepInBar === 4 || stepInBar === 12))
    ) {
      const buf = this.ensureNoiseBuffer();
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        const isSnare = this.bgmMode !== 'menu' && (stepInBar === 4 || stepInBar === 12);
        hp.frequency.value = isSnare ? 1800 : 6200;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(isSnare ? 0.13 : this.bgmMode === 'menu' ? 0.028 : 0.045, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + (isSnare ? 0.1 : 0.04));
        src.connect(hp);
        hp.connect(ng);
        ng.connect(this.bgmFilter);
        src.start(time);
        src.stop(time + 0.11);
      }
    }
  }
}

export const sound = new SoundManager();

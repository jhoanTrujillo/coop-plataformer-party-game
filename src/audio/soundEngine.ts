import {GameEventType} from '../shared/types';

type MusicMode = 'off' | 'lobby' | 'explore' | 'tense' | 'boss' | 'victory';

// Playful GBA-inspired chiptune & dynamic adaptive soundtrack engine (zero external audio files needed)
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private muted = false;
  private mode: MusicMode = 'off';
  private intensity = 0.25;
  private stepIndex = 0;
  private loopTimer: number | null = null;

  public unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.42;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.28;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.72;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicState(mode: MusicMode, intensity = 0.25) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    if (this.mode === mode && this.loopTimer !== null) return;
    this.mode = mode;
    if (mode === 'off') {
      this.stopMusicLoop();
      return;
    }
    if (this.loopTimer === null) {
      this.stepIndex = 0;
      this.scheduleNextStep();
    }
  }

  private stopMusicLoop() {
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private scheduleNextStep() {
    if (this.mode === 'off') {
      this.loopTimer = null;
      return;
    }
    this.playMusicStep(this.stepIndex++);

    // Dynamic BPM scales smoothly with intensity and boss phase!
    let bpm = 128;
    if (this.mode === 'lobby') bpm = 114;
    else if (this.mode === 'explore') bpm = 132 + Math.round(this.intensity * 18);
    else if (this.mode === 'tense') bpm = 152;
    else if (this.mode === 'boss') bpm = this.intensity > 0.9 ? 174 : 156;
    else if (this.mode === 'victory') bpm = 138;

    const sixteenthMs = (60 / bpm / 4) * 1000;
    this.loopTimer = window.setTimeout(() => this.scheduleNextStep(), sixteenthMs);
  }

  private playMusicStep(step: number) {
    if (!this.ctx || !this.musicGain || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const s = step % 32;

    // Melodies in MIDI notes (0 = rest)
    const lobbyLead = [
      72, 0, 76, 0, 79, 0, 84, 0, 81, 0, 79, 0, 76, 0, 74, 0,
      72, 0, 74, 0, 76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 0, 0,
    ];
    const exploreLead = [
      76, 0, 79, 81, 84, 0, 81, 0, 79, 0, 76, 74, 72, 0, 74, 0,
      76, 0, 79, 84, 86, 0, 84, 81, 79, 0, 81, 0, 84, 0, 0, 0,
    ];
    const bossLead = [
      69, 69, 72, 0, 76, 0, 75, 76, 79, 0, 76, 0, 72, 74, 72, 69,
      69, 72, 76, 79, 81, 0, 79, 76, 75, 0, 72, 0, 71, 0, 69, 0,
    ];
    const victoryLead = [
      72, 76, 79, 84, 0, 81, 84, 88, 0, 86, 84, 79, 84, 0, 0, 0,
      76, 79, 84, 88, 0, 86, 84, 81, 84, 0, 88, 0, 84, 0, 0, 0,
    ];

    const exploreBass = [
      48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 57, 0, 55, 0, 50, 0,
      48, 0, 55, 0, 50, 0, 57, 0, 55, 0, 53, 0, 48, 0, 55, 0,
    ];
    const bossBass = [
      45, 45, 57, 45, 45, 45, 55, 45, 48, 48, 60, 48, 47, 47, 59, 47,
      45, 45, 57, 45, 50, 50, 62, 50, 48, 48, 55, 48, 47, 47, 52, 47,
    ];

    const leadSeq =
      this.mode === 'boss'
        ? bossLead
        : this.mode === 'lobby'
          ? lobbyLead
          : this.mode === 'victory'
            ? victoryLead
            : exploreLead;
    const bassSeq = this.mode === 'boss' ? bossBass : exploreBass;

    const leadNote = leadSeq[s];
    if (leadNote > 0) {
      this.playTone(
        midiToFreq(leadNote),
        this.mode === 'lobby' ? 'triangle' : 'square',
        0.13,
        this.mode === 'boss' ? 0.17 : 0.13,
        now,
        this.musicGain,
      );
    }

    const bassNote = bassSeq[s];
    if (bassNote > 0) {
      this.playTone(
        midiToFreq(bassNote),
        'triangle',
        0.14,
        this.mode === 'boss' ? 0.24 : 0.18,
        now,
        this.musicGain,
      );
    }

    // Dynamic intensity layer: sparkle arpeggio + driving hi-hat/kick percussion!
    if (this.mode !== 'lobby') {
      if (s % 4 === 0) {
        this.playKick(now, this.musicGain, this.mode === 'boss' ? 0.26 : 0.16);
      }
      if ((this.intensity > 0.45 || this.mode === 'boss' || this.mode === 'tense') && s % 2 === 1) {
        this.playHiHat(now, this.musicGain, 0.06);
      }
      if ((this.intensity > 0.65 || this.mode === 'boss') && leadNote > 0 && s % 2 === 0) {
        this.playTone(midiToFreq(leadNote + 12), 'sine', 0.08, 0.07, now, this.musicGain);
      }
    }
  }

  public playSfx(type: GameEventType | 'ui_tap') {
    if (!this.ctx || !this.sfxGain || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    switch (type) {
      case 'ui_tap':
        this.sweep(520, 760, 'triangle', 0.055, 0.22, now);
        break;
      case 'jump':
        this.sweep(240, 560, 'square', 0.11, 0.2, now);
        break;
      case 'double_jump':
        // Cute Kirby puff whoosh-hop!
        this.sweep(420, 780, 'sine', 0.12, 0.28, now);
        this.playHiHat(now, this.sfxGain, 0.12);
        break;
      case 'grab':
        this.sweep(300, 480, 'triangle', 0.08, 0.28, now);
        break;
      case 'throw':
        this.sweep(540, 260, 'sawtooth', 0.1, 0.2, now);
        break;
      case 'coin':
        this.playTone(987.77, 'square', 0.07, 0.18, now, this.sfxGain);
        this.playTone(1318.5, 'square', 0.14, 0.18, now + 0.06, this.sfxGain);
        break;
      case 'star':
        [784, 988, 1175, 1568].forEach((f, idx) => {
          this.playTone(f, 'triangle', 0.12, 0.24, now + idx * 0.05, this.sfxGain!);
        });
        break;
      case 'powerup':
        [523, 659, 784, 1046, 1318].forEach((f, idx) => {
          this.playTone(f, 'square', 0.09, 0.18, now + idx * 0.045, this.sfxGain!);
        });
        break;
      case 'stomp':
        this.sweep(320, 140, 'triangle', 0.09, 0.32, now);
        this.sweep(440, 680, 'square', 0.08, 0.15, now + 0.04);
        break;
      case 'brick_break':
        this.playNoiseBurst(now, 0.14, 0.24);
        this.sweep(210, 90, 'square', 0.11, 0.2, now);
        break;
      case 'explode':
        this.playNoiseBurst(now, 0.34, 0.42);
        this.sweep(150, 38, 'sawtooth', 0.32, 0.35, now);
        break;
      case 'mega_explode':
        this.playNoiseBurst(now, 0.5, 0.55);
        this.sweep(190, 28, 'sawtooth', 0.46, 0.45, now);
        break;
      case 'hurt':
        this.sweep(340, 120, 'sawtooth', 0.18, 0.28, now);
        this.sweep(220, 95, 'square', 0.18, 0.22, now + 0.08);
        break;
      case 'revive':
        [587, 740, 880, 1175].forEach((f, idx) => {
          this.playTone(f, 'sine', 0.13, 0.24, now + idx * 0.055, this.sfxGain!);
        });
        break;
      case 'boss_hit':
        this.playNoiseBurst(now, 0.16, 0.32);
        this.sweep(480, 160, 'sawtooth', 0.16, 0.28, now);
        break;
      case 'boss_slam':
        this.playNoiseBurst(now, 0.25, 0.35);
        this.sweep(120, 42, 'triangle', 0.24, 0.4, now);
        break;
      case 'boss_defeat':
      case 'stage_clear':
        [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, idx) => {
          this.playTone(f, 'square', 0.14, 0.22, now + idx * 0.085, this.sfxGain!);
        });
        break;
    }
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    dur: number,
    vol: number,
    startTime: number,
    dest: AudioNode,
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  private sweep(
    f0: number,
    f1: number,
    type: OscillatorType,
    dur: number,
    vol: number,
    startTime: number,
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), startTime + dur);
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  private playKick(startTime: number, dest: AudioNode, vol: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, startTime);
    osc.frequency.exponentialRampToValueAtTime(42, startTime + 0.09);
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.1);
    osc.connect(g);
    g.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.11);
  }

  private playHiHat(startTime: number, dest: AudioNode, vol: number) {
    if (!this.ctx) return;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.03), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.03);
    src.connect(hp);
    hp.connect(g);
    g.connect(dest);
    src.start(startTime);
  }

  private playNoiseBurst(startTime: number, dur: number, vol: number) {
    if (!this.ctx || !this.sfxGain) return;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfxGain);
    src.start(startTime);
  }
}

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export const soundEngine = new SoundEngine();

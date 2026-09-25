import type { AmbienceId, AudioPort, MusicId, SfxId } from '@/application/ports';
import type { GameSettings } from '@/domain/settings';
import type { Logger } from '@/shared/logger';

/**
 * Original, procedurally generated placeholder audio (WebAudio). No audio
 * files ship with the game, so there is nothing to license and nothing to
 * download. Independent gain channels for music, effects, ambience and voice
 * (voice is reserved for future recorded narration).
 *
 * The game never depends on audio: every sound has a visible text
 * equivalent, and ambience/music changes can be captioned.
 */
type Channel = 'music' | 'effects' | 'ambience' | 'voice';

const AMBIENCE_CAPTIONS: Record<AmbienceId, string | null> = {
  market: '[Market sounds: voices and footsteps]',
  wind: '[Wind blowing over dry hills]',
  indoor: '[A quiet room]',
  oasis: '[Birds and rustling palm leaves]',
  none: null,
};
const MUSIC_CAPTIONS: Record<MusicId, string | null> = {
  home: '[Warm lyre music]',
  journey: '[Steady walking music]',
  tension: '[Low, uneasy music]',
  reflection: '[Quiet, thoughtful music]',
  none: null,
};

// D dorian, lyre-like range.
const SCALES: Record<
  Exclude<MusicId, 'none'>,
  { notes: number[]; beat: number; density: number; drone: number[] }
> = {
  home: { notes: [62, 64, 65, 67, 69, 71, 72, 74], beat: 0.42, density: 0.7, drone: [38, 45] },
  journey: { notes: [62, 64, 65, 69, 72, 74, 76], beat: 0.34, density: 0.6, drone: [38, 45] },
  tension: { notes: [50, 51, 55, 57, 58, 62], beat: 0.6, density: 0.35, drone: [38, 39] },
  reflection: { notes: [62, 65, 67, 69, 72, 74], beat: 0.7, density: 0.4, drone: [38, 50] },
};

const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export class SynthAudio implements AudioPort {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly channels = new Map<Channel, GainNode>();
  private settings: GameSettings | null = null;
  private ambienceNodes: AudioNode[] = [];
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private droneNodes: OscillatorNode[] = [];
  private noise: AudioBuffer | null = null;
  private currentAmbience: AmbienceId = 'none';
  private currentMusic: MusicId = 'none';
  private nextNoteTime = 0;
  private lastNote = 0;

  constructor(
    private readonly logger: Logger,
    private readonly onCaption: (caption: string) => void = () => {},
    private readonly createContext: () => AudioContext | null = defaultContext,
  ) {}

  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        this.ctx = this.createContext();
        if (!this.ctx) return false;
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        (['music', 'effects', 'ambience', 'voice'] as Channel[]).forEach((c) => {
          const gain = (this.ctx as AudioContext).createGain();
          gain.connect(this.master as GainNode);
          this.channels.set(c, gain);
        });
        this.noise = this.makeNoise();
        if (this.settings) this.applySettings(this.settings);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      // Re-start whatever should be playing now that we can.
      const ambience = this.currentAmbience;
      const music = this.currentMusic;
      this.currentAmbience = 'none';
      this.currentMusic = 'none';
      this.setAmbience(ambience);
      this.setMusic(music);
      return this.ctx.state === 'running';
    } catch (error) {
      this.logger.warn('Audio unavailable (autoplay policy or no audio device)', error);
      return false;
    }
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume.master, t, 0.05);
    this.channels.get('music')?.gain.setTargetAtTime(settings.volume.music * 0.35, t, 0.05);
    this.channels.get('effects')?.gain.setTargetAtTime(settings.volume.effects * 0.5, t, 0.05);
    this.channels.get('ambience')?.gain.setTargetAtTime(settings.volume.ambience * 0.3, t, 0.05);
    this.channels.get('voice')?.gain.setTargetAtTime(settings.volume.voice, t, 0.05);
  }

  playSfx(id: SfxId): void {
    const ctx = this.ctx;
    const out = this.channels.get('effects');
    if (!ctx || !out || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const tones: Record<SfxId, Array<[number, number, number]>> = {
      interact: [[660, 0, 0.08]],
      item: [
        [784, 0, 0.12],
        [1047, 0.08, 0.18],
      ],
      journal: [
        [523, 0, 0.12],
        [659, 0.07, 0.12],
        [784, 0.14, 0.2],
      ],
      quest: [
        [392, 0, 0.18],
        [523, 0.12, 0.18],
        [659, 0.24, 0.3],
      ],
      solved: [
        [523, 0, 0.15],
        [659, 0.1, 0.15],
        [784, 0.2, 0.15],
        [1047, 0.3, 0.35],
      ],
      error: [[220, 0, 0.2]],
      page: [[1200, 0, 0.04]],
      door: [[150, 0, 0.18]],
    };
    tones[id].forEach(([freq, offset, dur]) => this.pluck(freq, t + offset, dur, out, 0.5));
  }

  setAmbience(id: AmbienceId): void {
    if (id === this.currentAmbience) return;
    this.currentAmbience = id;
    this.stopAmbience();
    const ctx = this.ctx;
    const out = this.channels.get('ambience');
    if (!ctx || !out || !this.noise || id === 'none' || ctx.state !== 'running') return;
    // Caption only what is actually audible.
    const caption = AMBIENCE_CAPTIONS[id];
    if (caption && this.settings?.captions && !this.settings.muted) this.onCaption(caption);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const shape: Record<
      Exclude<AmbienceId, 'none'>,
      { type: BiquadFilterType; freq: number; q: number; level: number; lfo: number }
    > = {
      wind: { type: 'lowpass', freq: 500, q: 0.7, level: 0.6, lfo: 0.12 },
      market: { type: 'bandpass', freq: 900, q: 0.6, level: 0.35, lfo: 0.9 },
      indoor: { type: 'lowpass', freq: 200, q: 0.5, level: 0.15, lfo: 0.05 },
      oasis: { type: 'highpass', freq: 2500, q: 0.4, level: 0.18, lfo: 0.3 },
    };
    const s = shape[id];
    filter.type = s.type;
    filter.frequency.value = s.freq;
    filter.Q.value = s.q;
    gain.gain.value = s.level;
    lfo.frequency.value = s.lfo;
    lfoGain.gain.value = s.level * 0.4;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(out);
    src.start();
    lfo.start();
    this.ambienceNodes = [src, filter, gain, lfo, lfoGain];
  }

  setMusic(id: MusicId): void {
    if (id === this.currentMusic) return;
    this.currentMusic = id;
    this.stopMusic();
    const ctx = this.ctx;
    const out = this.channels.get('music');
    if (!ctx || !out || id === 'none' || ctx.state !== 'running') return;
    const caption = MUSIC_CAPTIONS[id];
    if (caption && this.settings?.captions && !this.settings.muted) this.onCaption(caption);
    const style = SCALES[id];
    this.droneNodes = style.drone.map((m) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(m);
      g.gain.value = 0.08;
      osc.connect(g).connect(out);
      osc.start();
      return osc;
    });
    this.nextNoteTime = ctx.currentTime + 0.2;
    this.lastNote = Math.floor(style.notes.length / 2);
    this.musicTimer = setInterval(() => this.scheduleNotes(style, out), 120);
  }

  dispose(): void {
    this.stopAmbience();
    this.stopMusic();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private scheduleNotes(style: (typeof SCALES)['home'], out: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextNoteTime < ctx.currentTime + 0.3) {
      if (Math.random() < style.density) {
        const step = Math.round((Math.random() - 0.5) * 3);
        this.lastNote = Math.max(0, Math.min(style.notes.length - 1, this.lastNote + step));
        const note = style.notes[this.lastNote] ?? 62;
        this.pluck(midiToHz(note), this.nextNoteTime, style.beat * 2.2, out, 0.35);
      }
      this.nextNoteTime += style.beat;
    }
  }

  private pluck(freq: number, when: number, duration: number, out: AudioNode, level: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(level, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(out);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  private stopAmbience(): void {
    this.ambienceNodes.forEach((n) => {
      if (n instanceof AudioScheduledSourceNode) n.stop();
      n.disconnect();
    });
    this.ambienceNodes = [];
  }

  private stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.droneNodes.forEach((o) => {
      o.stop();
      o.disconnect();
    });
    this.droneNodes = [];
  }

  private makeNoise(): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise: softer and more natural than white noise.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }
}

function defaultContext(): AudioContext | null {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** Silent implementation for tests and browsers without WebAudio. */
export class SilentAudio implements AudioPort {
  async unlock(): Promise<boolean> {
    return false;
  }
  playSfx(): void {}
  setAmbience(): void {}
  setMusic(): void {}
  applySettings(): void {}
  dispose(): void {}
}

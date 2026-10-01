import { filmMusicPlan, trackFor } from '@/application/music';
import type {
  AmbienceId,
  AudioPort,
  FootstepSurface,
  MusicId,
  MusicOptions,
  SfxId,
} from '@/application/ports';
import { MUSIC_TRACKS, musicUrl, type MusicTrack } from '@/domain/music';
import type { GameSettings } from '@/domain/settings';
import type { FilmSection } from '@/domain/teaser';
import type { Logger } from '@/shared/logger';
import { mediaDeckFactory } from './media-deck';
import { musicCacher } from './music-cache';
import {
  RecordedMusic,
  type MusicDeckFactory,
  type MusicStatus,
  type MusicTimers,
} from './recorded-music';
import {
  AMBIENCE,
  FOOTSTEPS,
  scheduleAmbience,
  SFX,
  type AmbientEventKind,
  type Tone,
} from './soundscape';

/**
 * The game's audio, with WebAudio: original, procedurally generated effects,
 * footsteps and ambience (the sound design in soundscape.ts), and recorded
 * background music (recorded-music.ts: four licensed tracks, ADR-0018), on
 * independent gain channels for music, effects, ambience and voice (voice
 * is reserved for future recorded narration).
 *
 * The game never depends on audio: every sound has a visible text
 * equivalent, and ambience and music changes can be captioned.
 */
type Channel = 'music' | 'effects' | 'ambience' | 'voice';

const AMBIENCE_CAPTIONS: Record<AmbienceId, string | null> = {
  market: '[Market sounds: voices, footsteps, clinking pottery]',
  wind: '[Wind gusting over dry hills]',
  indoor: '[A quiet room; a fire crackles]',
  oasis: '[Birdsong, rustling leaves, trickling water]',
  none: null,
};

/**
 * The music channel's level at full music volume: the recorded tracks are
 * mastered loud, and the music should sit under the story, not over it.
 */
export const MUSIC_GAIN = 0.45;

/** What the music is doing, and how loud the music channel is (0 when muted). */
export type MusicReport = MusicStatus & { volume: number };

export interface SynthAudioOptions {
  /** Plays the recorded music into the music channel (tests pass fakes). */
  musicDecks?: (ctx: AudioContext, out: AudioNode) => MusicDeckFactory;
  timers?: MusicTimers;
  /** What the music is doing (the app exposes it for tests and diagnostics). */
  onMusicStatus?: (report: MusicReport) => void;
  /** The site's base URL, e.g. "/witness/". */
  base?: string;
}

export class SynthAudio implements AudioPort {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly channels = new Map<Channel, GainNode>();
  private settings: GameSettings | null = null;
  private ambienceNodes: AudioNode[] = [];
  private ambienceTimer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBuffer | null = null;
  private currentAmbience: AmbienceId = 'none';
  private readonly music: RecordedMusic;
  private musicAttached = false;
  private musicStatus: MusicStatus = { track: null, playing: false };
  private readonly musicDecks: (ctx: AudioContext, out: AudioNode) => MusicDeckFactory;

  constructor(
    private readonly logger: Logger,
    private readonly onCaption: (caption: string) => void = () => {},
    private readonly createContext: () => AudioContext | null = defaultContext,
    private readonly random: () => number = Math.random,
    private readonly options: SynthAudioOptions = {},
  ) {
    this.music = new RecordedMusic(
      logger,
      {
        onStart: (track) => this.captionMusic(track),
        onStatus: (status) => {
          this.musicStatus = status;
          this.reportMusic();
        },
      },
      options.timers,
    );
    this.musicDecks = options.musicDecks ?? defaultMusicDecks(options.base, logger);
  }

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
      if (this.ctx.state !== 'running') await this.ctx.resume();
      const running = this.ctx.state === 'running';
      if (running) {
        // Start whatever should be playing now that we can (once).
        if (this.ambienceNodes.length === 0 && this.currentAmbience !== 'none') {
          const ambience = this.currentAmbience;
          this.currentAmbience = 'none';
          this.setAmbience(ambience);
        }
        const out = this.channels.get('music');
        if (!this.musicAttached && out) {
          this.musicAttached = true;
          this.music.attach(this.musicDecks(this.ctx, out));
        }
        this.music.setPaused('hidden', false);
        this.music.resume();
      }
      return running;
    } catch (error) {
      this.logger.warn('Audio unavailable (autoplay policy or no audio device)', error);
      return false;
    }
  }

  applySettings(settings: GameSettings): void {
    this.settings = settings;
    // Silent music is paused (it costs nothing), and resumes where it was.
    this.music.setPaused(
      'muted',
      settings.muted || settings.volume.master === 0 || settings.volume.music === 0,
    );
    this.reportMusic();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume.master, t, 0.05);
    this.channels.get('music')?.gain.setTargetAtTime(settings.volume.music * MUSIC_GAIN, t, 0.05);
    this.channels.get('effects')?.gain.setTargetAtTime(settings.volume.effects * 0.5, t, 0.05);
    this.channels.get('ambience')?.gain.setTargetAtTime(settings.volume.ambience * 0.3, t, 0.05);
    this.channels.get('voice')?.gain.setTargetAtTime(settings.volume.voice, t, 0.05);
  }

  playSfx(id: SfxId): void {
    const ctx = this.ctx;
    const out = this.channels.get('effects');
    if (!ctx || !out || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    SFX[id].forEach((tone) => this.play(tone, t, out));
  }

  playFootstep(surface: FootstepSurface): void {
    const ctx = this.ctx;
    const out = this.channels.get('effects');
    if (!ctx || !out || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    // A little variation so steps never sound mechanical.
    const pitch = 0.9 + this.random() * 0.2;
    FOOTSTEPS[surface].forEach((tone) =>
      this.play(
        { ...tone, freq: tone.freq * pitch, gain: tone.gain * (0.8 + this.random() * 0.3) },
        t,
        out,
      ),
    );
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
    const { bed } = AMBIENCE[id];
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    filter.type = bed.type;
    filter.frequency.value = bed.freq;
    filter.Q.value = bed.q;
    gain.gain.value = bed.level;
    lfo.frequency.value = bed.lfo;
    lfoGain.gain.value = bed.level * 0.4;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(out);
    src.start();
    lfo.start();
    this.ambienceNodes = [src, filter, gain, lfo, lfoGain];
    // Sparse events on top of the bed, scheduled a second at a time.
    const tick = (): void => {
      const now = ctx.currentTime;
      for (const e of scheduleAmbience(id, 1, this.random))
        this.ambientEvent(e.kind, now + e.at, e.variety, out);
    };
    tick();
    this.ambienceTimer = setInterval(tick, 1000);
  }

  setMusic(id: MusicId, options: MusicOptions = {}): void {
    this.music.play(trackFor(id), options);
  }

  setMusicDucked(ducked: boolean): void {
    this.music.setDucked(ducked);
  }

  playFilmScore(sections: readonly FilmSection[], duration: number, from: number): void {
    this.music.playFilm(filmMusicPlan(sections, duration, from));
  }

  stopFilmScore(): void {
    this.music.stopFilm();
  }

  suspend(): void {
    this.music.setPaused('hidden', true);
    // Ambience events are scheduled on the context's clock: start afresh on return.
    this.stopAmbience();
    void this.ctx?.suspend().catch(() => undefined);
  }

  dispose(): void {
    this.music.dispose();
    this.musicAttached = false;
    this.stopAmbience();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.channels.clear();
    this.master = null;
  }

  private captionMusic(track: MusicTrack): void {
    if (this.settings?.captions && !this.settings.muted) this.onCaption(track.caption);
  }

  private reportMusic(): void {
    const s = this.settings;
    const volume = !s || s.muted ? 0 : s.volume.master * s.volume.music;
    this.options.onMusicStatus?.({ ...this.musicStatus, volume: Math.round(volume * 100) / 100 });
  }

  private ambientEvent(kind: AmbientEventKind, when: number, v: number, out: AudioNode): void {
    switch (kind) {
      case 'voices':
        // A murmur of speech: a few quick formant-like breaths.
        for (let i = 0; i < 3; i++)
          this.play(
            { kind: 'breath', freq: 500 + v * 700 + i * 90, at: i * 0.11, dur: 0.12, gain: 0.05 },
            when,
            out,
          );
        return;
      case 'clink':
        this.play({ kind: 'bell', freq: 1400 + v * 900, at: 0, dur: 0.25, gain: 0.05 }, when, out);
        return;
      case 'crackle':
        this.play(
          { kind: 'breath', freq: 2500 + v * 3000, at: 0, dur: 0.02 + v * 0.03, gain: 0.06 },
          when,
          out,
        );
        return;
      case 'gust':
        this.play(
          { kind: 'breath', freq: 900 + v * 900, at: 0, dur: 1.6 + v, gain: 0.08 },
          when,
          out,
        );
        return;
      case 'chirp':
        for (let i = 0; i < 2 + Math.floor(v * 3); i++)
          this.play(
            {
              kind: 'bell',
              freq: 2600 + v * 1400 + (i % 2) * 300,
              at: i * 0.09,
              dur: 0.07,
              gain: 0.05,
            },
            when,
            out,
          );
        return;
      case 'trickle':
        this.play(
          { kind: 'breath', freq: 1800 + v * 1200, at: 0, dur: 0.08, gain: 0.04 },
          when,
          out,
        );
        return;
    }
  }

  /** Play one tone: a plucked string, a small bell, or a breath of filtered noise. */
  private play(tone: Tone, base: number, out: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const when = base + tone.at;
    const gain = ctx.createGain();
    gain.connect(out);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, tone.gain),
      when + (tone.kind === 'breath' ? 0.02 : 0.008),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, when + tone.dur);
    if (tone.kind === 'breath') {
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = tone.freq;
      filter.Q.value = 1.2;
      src.connect(filter).connect(gain);
      src.start(when, (this.random() * 1.5) % 1.5);
      src.stop(when + tone.dur + 0.05);
      return;
    }
    if (tone.kind === 'knock') {
      // A short thud whose pitch falls quickly, like a heel on the ground.
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq * 1.6, when);
      osc.frequency.exponentialRampToValueAtTime(tone.freq, when + tone.dur * 0.6);
      osc.connect(gain);
      osc.start(when);
      osc.stop(when + tone.dur + 0.05);
      return;
    }
    // Pluck: a triangle with a quieter octave; bell: inharmonic sine partials.
    const partials =
      tone.kind === 'pluck'
        ? ([
            [1, 1, 'triangle'],
            [2, 0.25, 'sine'],
          ] as const)
        : ([
            [1, 1, 'sine'],
            [2.76, 0.4, 'sine'],
            [5.4, 0.15, 'sine'],
          ] as const);
    for (const [ratio, level, type] of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = tone.freq * ratio;
      g.gain.value = level;
      osc.connect(g).connect(gain);
      osc.start(when);
      osc.stop(when + tone.dur + 0.05);
    }
  }

  private stopAmbience(): void {
    if (this.ambienceTimer) clearInterval(this.ambienceTimer);
    this.ambienceTimer = null;
    this.ambienceNodes.forEach((n) => {
      // Sources and LFOs must be stopped; filters and gains just disconnect.
      if ('stop' in n && typeof n.stop === 'function') (n as AudioScheduledSourceNode).stop();
      n.disconnect();
    });
    this.ambienceNodes = [];
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

/** Recorded music from the site's own files, cached for offline play once it has played. */
function defaultMusicDecks(
  base: string = import.meta.env.BASE_URL,
  logger: Logger,
): (ctx: AudioContext, out: AudioNode) => MusicDeckFactory {
  const urls = Object.values(MUSIC_TRACKS).map((t) => musicUrl(t, base));
  const cache = musicCacher(urls, (message, error) => logger.warn(message, error));
  return (ctx, out) =>
    mediaDeckFactory(
      ctx,
      out,
      (track) => musicUrl(track, base),
      (url) => void cache(url),
    );
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
  playFootstep(_surface: FootstepSurface): void {}
  setAmbience(_id: AmbienceId): void {}
  setMusic(_id: MusicId, _options?: MusicOptions): void {}
  setMusicDucked(_ducked: boolean): void {}
  applySettings(): void {}
  suspend(): void {}
  playFilmScore(): void {}
  stopFilmScore(): void {}
  dispose(): void {}
}

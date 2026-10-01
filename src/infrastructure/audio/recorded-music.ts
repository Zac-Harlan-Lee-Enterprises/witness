import type { FilmMusicCue } from '@/application/music';
import { MUSIC_TRACKS, type MusicTrack, type MusicTrackId } from '@/domain/music';
import type { Logger } from '@/shared/logger';

/**
 * One playing copy of a track (media-deck.ts plays it with an <audio>
 * element through WebAudio; tests use fakes). Levels are relative: 0–1
 * before the track's own level is applied by the caller and before the
 * player's volume settings, which the music channel applies.
 */
export interface MusicDeck {
  /**
   * Start, or resume after pause(); `offset` (seconds) only on the first
   * start. Rejects when the file can't be played: blocked by the browser's
   * autoplay policy (a NotAllowedError) or failed to load.
   */
  play(offset?: number): Promise<void>;
  pause(): void;
  /** Ramp to `level` over `seconds` (0 = at once). */
  fade(level: number, seconds: number): void;
  /** Seconds into the file. */
  readonly time: number;
  /** True once the file has played to its end. */
  readonly ended: boolean;
  dispose(): void;
}

export type MusicDeckFactory = (track: MusicTrack) => MusicDeck;

/** What the music is doing, for tests and diagnostics. */
export interface MusicStatus {
  /** The track that should be heard (null: silence). */
  track: MusicTrackId | null;
  /** True while that track is actually playing. */
  playing: boolean;
}

export interface MusicTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

const browserTimers: MusicTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
};

/** Seconds. */
export const MUSIC_TIMING = {
  /** A change of track: the old fades out while the new fades in. */
  crossfade: 2.5,
  /** The gentle return after a silence (Galilee's calm). */
  returnAfterSilence: 4,
  /** The overlap of one pass of a track into the next. */
  loop: 3,
  /** Into and out of a film's sections. */
  film: 1.5,
  /** Lowering the music under dialogue and reading, and raising it again. */
  duck: 0.8,
  /** Older fades cut short when yet another change comes. */
  cut: 0.2,
  /** Muting or hiding the page. */
  pause: 0.3,
} as const;

/** The level under dialogue and reading (about −8 dB). */
export const DUCKED_LEVEL = 0.4;

/** How often a playing track is checked for its loop point (ms). */
const LOOP_CHECK_MS = 250;

type PauseReason = 'muted' | 'hidden';

interface Playing {
  deck: MusicDeck;
  track: MusicTrack;
  /** True once play() has resolved. */
  started: boolean;
}

export interface RecordedMusicHooks {
  /** A new track became audible (not a loop or a resume): for captions. */
  onStart?: (track: MusicTrack) => void;
  onStatus?: (status: MusicStatus) => void;
}

/**
 * The background music: recorded tracks, one at a time.
 *
 * - Asking for the track already playing (or already coming) changes
 *   nothing, so a track never restarts needlessly.
 * - Changes cross-fade; the latest request always wins, and a change that
 *   comes in the middle of another cuts the older fade short, so at most
 *   two tracks are ever heard together, and only while one fades into the
 *   other.
 * - A request may ask for silence first; the new track then returns gently.
 * - Each pass of a track cross-fades into the next at its loop point (the
 *   tracks fade out at their ends rather than loop cleanly).
 * - The music is lowered (ducked) under dialogue and reading.
 * - Muting or hiding the page pauses it; it resumes where it was.
 * - Before audio is allowed (attach) requests are only remembered; a play
 *   blocked by the autoplay policy is retried by resume() on the next user
 *   gesture; a file that fails to load is logged and left silent. Nothing
 *   here ever throws into the game.
 */
export class RecordedMusic {
  private factory: MusicDeckFactory | null = null;
  /** What should be heard once any silence is over (null: silence). */
  private target: MusicTrackId | null = null;
  private current: Playing | null = null;
  private readonly fading = new Map<MusicDeck, unknown>();
  private silenceTimer: unknown = null;
  private loopTimer: unknown = null;
  private filmTimers: unknown[] = [];
  private filmActive = false;
  private ducked = false;
  private blocked = false;
  private readonly paused = new Set<PauseReason>();
  private readonly failed = new Set<MusicTrackId>();
  private lastStatus = '';

  constructor(
    private readonly logger: Logger,
    private readonly hooks: RecordedMusicHooks = {},
    private readonly timers: MusicTimers = browserTimers,
  ) {}

  /** Audio is allowed now: start whatever was asked for. */
  attach(factory: MusicDeckFactory): void {
    this.factory = factory;
    if (this.target && !this.current && this.silenceTimer === null)
      this.start(this.target, 0, MUSIC_TIMING.crossfade, true);
  }

  /** Scene or menu music: cancels any film's cues. */
  play(track: MusicTrackId | null, options: { silence?: number } = {}): void {
    this.clearFilm();
    this.change(track, { silence: options.silence ?? 0 });
  }

  /** A film's music: each cue at its time from now (the first at once). */
  playFilm(cues: readonly FilmMusicCue[]): void {
    this.clearFilm();
    const first = cues[0];
    if (!first) return;
    this.filmActive = true;
    for (const cue of cues) {
      const run = (): void =>
        this.change(cue.track, { offset: cue.offset, fade: MUSIC_TIMING.film });
      if (cue === first) run();
      else this.filmTimers.push(this.timers.setTimeout(run, (cue.at - first.at) * 1000));
    }
  }

  /** The film stopped (paused, skipped or ended): its music fades out. */
  stopFilm(): void {
    if (!this.filmActive) return;
    this.clearFilm();
    this.change(null, { fade: MUSIC_TIMING.film });
  }

  setDucked(ducked: boolean): void {
    if (ducked === this.ducked) return;
    this.ducked = ducked;
    if (this.current?.started)
      this.current.deck.fade(this.level(this.current.track), MUSIC_TIMING.duck);
  }

  /** Muted (or the volume at zero), or the page hidden: pause; resume when neither holds. */
  setPaused(reason: PauseReason, paused: boolean): void {
    const was = this.paused.size > 0;
    if (paused) this.paused.add(reason);
    else this.paused.delete(reason);
    const now = this.paused.size > 0;
    if (was === now) return;
    if (now) {
      for (const deck of [...this.fading.keys()]) this.drop(deck);
      const cur = this.current;
      if (cur?.started) {
        cur.deck.fade(0, MUSIC_TIMING.pause);
        cur.deck.pause();
      } else if (cur) {
        // Not started yet: start afresh on resume.
        cur.deck.dispose();
        this.current = null;
      }
    } else {
      this.resumeCurrent();
    }
    this.report();
  }

  /** A user gesture: retry a play the autoplay policy blocked. */
  resume(): void {
    if (!this.blocked) return;
    this.blocked = false;
    this.resumeCurrent();
  }

  dispose(): void {
    this.clearFilm();
    this.clearSilence();
    this.stopLoopCheck();
    for (const deck of [...this.fading.keys()]) this.drop(deck);
    this.current?.deck.dispose();
    this.current = null;
    this.factory = null;
    this.report();
  }

  // ── Internals ─────────────────────────────────────────────────────────
  private change(
    track: MusicTrackId | null,
    {
      silence = 0,
      offset = 0,
      fade = MUSIC_TIMING.crossfade,
    }: {
      silence?: number;
      offset?: number;
      fade?: number;
    },
  ): void {
    if (track === this.target) return;
    this.target = track;
    this.clearSilence();
    // Older fades end now: never more than two tracks at once.
    for (const deck of [...this.fading.keys()]) this.fadeOut(deck, MUSIC_TIMING.cut);
    const outgoing = this.current;
    this.current = null;
    if (outgoing) this.fadeOut(outgoing.deck, fade);
    if (track !== null) {
      if (silence > 0) {
        this.silenceTimer = this.timers.setTimeout(() => {
          this.silenceTimer = null;
          this.start(track, offset, MUSIC_TIMING.returnAfterSilence, true);
        }, silence * 1000);
      } else {
        this.start(track, offset, fade, true);
      }
    }
    this.report();
  }

  private start(id: MusicTrackId, offset: number, fadeIn: number, announce: boolean): void {
    if (!this.factory || this.paused.size > 0) return;
    const track = MUSIC_TRACKS[id];
    let deck: MusicDeck;
    try {
      deck = this.factory(track);
      deck.fade(0, 0);
    } catch (error) {
      this.logger.warn(`Music unavailable: ${track.file}`, error);
      return;
    }
    const playing: Playing = { deck, track, started: false };
    this.current = playing;
    this.ensureLoopCheck();
    deck.play(offset).then(
      () => {
        if (this.current !== playing) return;
        playing.started = true;
        this.failed.delete(id);
        deck.fade(this.level(track), fadeIn);
        if (announce) this.hooks.onStart?.(track);
        this.report();
      },
      (error: unknown) => {
        if (this.current === playing) this.current = null;
        deck.dispose();
        if (isAutoplayBlock(error)) {
          // Waits for the next gesture (resume()).
          this.blocked = true;
        } else if (!this.failed.has(id)) {
          this.failed.add(id);
          this.logger.warn(`Music could not be played: ${track.file}`, error);
        }
        this.report();
      },
    );
  }

  private resumeCurrent(): void {
    if (this.paused.size > 0) return;
    const cur = this.current;
    if (cur?.started) {
      cur.deck.play().then(
        () => {
          if (this.current === cur) cur.deck.fade(this.level(cur.track), MUSIC_TIMING.pause);
          this.report();
        },
        (error: unknown) => {
          if (this.current === cur) this.current = null;
          cur.deck.dispose();
          if (isAutoplayBlock(error)) this.blocked = true;
          this.report();
        },
      );
    } else if (!cur && this.target && this.silenceTimer === null) {
      this.start(this.target, 0, MUSIC_TIMING.crossfade, true);
    }
  }

  private level(track: MusicTrack): number {
    return track.level * (this.ducked ? DUCKED_LEVEL : 1);
  }

  private fadeOut(deck: MusicDeck, seconds: number): void {
    const pending = this.fading.get(deck);
    if (pending !== undefined) this.timers.clearTimeout(pending);
    deck.fade(0, seconds);
    this.fading.set(
      deck,
      this.timers.setTimeout(() => this.drop(deck), seconds * 1000 + 100),
    );
  }

  private drop(deck: MusicDeck): void {
    const pending = this.fading.get(deck);
    if (pending !== undefined) this.timers.clearTimeout(pending);
    this.fading.delete(deck);
    deck.dispose();
  }

  /** Each pass cross-fades into the next a little before the track's loop point. */
  private ensureLoopCheck(): void {
    if (this.loopTimer !== null) return;
    this.loopTimer = this.timers.setInterval(() => {
      const cur = this.current;
      if (!cur) {
        if (this.fading.size === 0) this.stopLoopCheck();
        return;
      }
      if (!cur.started || this.paused.size > 0) return;
      const { loop } = cur.track;
      if (!cur.deck.ended && cur.deck.time < loop.end - MUSIC_TIMING.loop) return;
      this.current = null;
      this.fadeOut(cur.deck, MUSIC_TIMING.loop);
      this.start(cur.track.id, loop.start, MUSIC_TIMING.loop, false);
    }, LOOP_CHECK_MS);
  }

  private stopLoopCheck(): void {
    if (this.loopTimer === null) return;
    this.timers.clearInterval(this.loopTimer);
    this.loopTimer = null;
  }

  private clearSilence(): void {
    if (this.silenceTimer === null) return;
    this.timers.clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  private clearFilm(): void {
    for (const t of this.filmTimers) this.timers.clearTimeout(t);
    this.filmTimers = [];
    this.filmActive = false;
  }

  private report(): void {
    const status: MusicStatus = {
      track: this.target,
      playing:
        this.paused.size === 0 &&
        this.current !== null &&
        this.current.started &&
        this.current.track.id === this.target,
    };
    const key = `${status.track}|${status.playing}`;
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.hooks.onStatus?.(status);
  }
}

function isAutoplayBlock(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'NotAllowedError'
  );
}

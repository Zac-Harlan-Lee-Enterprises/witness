import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { filmMusicPlan } from '@/application/music';
import { MUSIC_TRACKS, type MusicTrack, type MusicTrackId } from '@/domain/music';
import {
  DUCKED_LEVEL,
  MUSIC_TIMING,
  RecordedMusic,
  type MusicDeck,
  type MusicStatus,
} from '@/infrastructure/audio/recorded-music';
import { createLogger } from '@/shared/logger';
import { TEASER } from '@/content/chapters/road-to-jericho/teaser';

const OUD: MusicTrackId = 'cinematic-oud-and-qanun';
const SANDS: MusicTrackId = 'sacred-sands';
const MYSTERY: MusicTrackId = 'middle-eastern-cinematic-mystery';
const FLUTE: MusicTrackId = 'meditative-middle-eastern-flute';

/** A deck that plays nothing and remembers everything asked of it. */
class FakeDeck implements MusicDeck {
  level = 0;
  fades: Array<[number, number]> = [];
  offsets: Array<number | undefined> = [];
  playing = false;
  disposed = false;
  time = 0;
  ended = false;
  private settle: { resolve: () => void; reject: (e: unknown) => void } | null = null;
  constructor(
    readonly track: MusicTrack,
    private readonly mode: 'ok' | 'manual' | 'blocked' | 'broken',
  ) {}
  play(offset?: number): Promise<void> {
    this.offsets.push(offset);
    if (this.mode === 'blocked')
      return Promise.reject(Object.assign(new Error('no gesture'), { name: 'NotAllowedError' }));
    if (this.mode === 'broken')
      return Promise.reject(Object.assign(new Error('404'), { name: 'NotSupportedError' }));
    if (this.mode === 'manual')
      return new Promise((resolve, reject) => {
        this.settle = {
          resolve: () => {
            this.playing = true;
            resolve();
          },
          reject,
        };
      });
    this.playing = true;
    return Promise.resolve();
  }
  /** For 'manual' decks: the file starts playing now. */
  start(): void {
    this.settle?.resolve();
  }
  pause(): void {
    this.playing = false;
  }
  fade(level: number, seconds: number): void {
    this.level = level;
    this.fades.push([level, seconds]);
  }
  dispose(): void {
    this.disposed = true;
    this.playing = false;
  }
}

function setup(mode: (track: MusicTrack, n: number) => FakeDeck['mode'] = () => 'ok') {
  const decks: FakeDeck[] = [];
  const warnings: string[] = [];
  const logger = createLogger({ level: 'error', echo: false });
  vi.spyOn(logger, 'warn').mockImplementation((message: string) => {
    warnings.push(message);
  });
  const started: string[] = [];
  const statuses: MusicStatus[] = [];
  const music = new RecordedMusic(logger, {
    onStart: (t) => started.push(t.id),
    onStatus: (s) => statuses.push(s),
  });
  const factory = (track: MusicTrack): FakeDeck => {
    const deck = new FakeDeck(track, mode(track, decks.length));
    decks.push(deck);
    return deck;
  };
  const live = () => decks.filter((d) => !d.disposed);
  const audible = () => live().filter((d) => d.playing && d.level > 0);
  return { music, decks, factory, warnings, started, statuses, live, audible };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const seconds = (s: number) => vi.advanceTimersByTimeAsync(s * 1000);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('RecordedMusic', () => {
  it('remembers a request until audio is allowed, then fades the track in', async () => {
    const t = setup();
    t.music.play(OUD);
    expect(t.decks).toHaveLength(0);
    t.music.attach(t.factory);
    await settle();
    expect(t.decks.map((d) => d.track.id)).toEqual([OUD]);
    expect(t.decks[0]?.fades.at(-1)).toEqual([MUSIC_TRACKS[OUD].level, MUSIC_TIMING.crossfade]);
    expect(t.started).toEqual([OUD]);
    expect(t.statuses.at(-1)).toEqual({ track: OUD, playing: true });
  });

  it('never restarts the track that is already playing', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(SANDS);
    await settle();
    t.music.play(SANDS);
    t.music.play(SANDS);
    await seconds(5);
    expect(t.decks).toHaveLength(1);
    expect(t.decks[0]?.disposed).toBe(false);
  });

  it('cross-fades from one track to the next and lets the old one go', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(OUD);
    await settle();
    t.music.play(SANDS);
    await settle();
    const [oud, sands] = t.decks;
    expect(oud?.fades.at(-1)).toEqual([0, MUSIC_TIMING.crossfade]);
    expect(sands?.fades.at(-1)).toEqual([MUSIC_TRACKS[SANDS].level, MUSIC_TIMING.crossfade]);
    expect(oud?.disposed).toBe(false);
    await seconds(MUSIC_TIMING.crossfade + 0.2);
    expect(oud?.disposed).toBe(true);
    expect(t.live().map((d) => d.track.id)).toEqual([SANDS]);
  });

  it('lets the last request win when changes come quickly, with never more than two tracks', async () => {
    const t = setup(() => 'manual');
    t.music.attach(t.factory);
    t.music.play(OUD);
    t.decks[0]?.start();
    await settle();
    t.music.play(SANDS);
    t.music.play(MYSTERY);
    t.music.play(FLUTE);
    // The files that were asked for in between start loading late…
    t.decks[1]?.start();
    t.decks[2]?.start();
    t.decks[3]?.start();
    await settle();
    // …and are never heard.
    expect(t.decks[1]?.level).toBe(0);
    expect(t.decks[2]?.level).toBe(0);
    expect(t.decks[3]?.level).toBe(MUSIC_TRACKS[FLUTE].level);
    await seconds(MUSIC_TIMING.cut + 0.2);
    expect(t.live().length).toBeLessThanOrEqual(2);
    await seconds(MUSIC_TIMING.crossfade);
    expect(t.live().map((d) => d.track.id)).toEqual([FLUTE]);
    expect(t.started).toEqual([OUD, FLUTE]);
  });

  it('turns back to a track it has just let go without stacking copies', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(OUD);
    await settle();
    t.music.play(null);
    t.music.play(OUD);
    await settle();
    expect(t.decks.at(-1)?.track.id).toBe(OUD);
    await seconds(MUSIC_TIMING.crossfade + 0.2);
    expect(t.live()).toHaveLength(1);
  });

  it('lowers the music under dialogue and reading, and raises it after', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(SANDS);
    await settle();
    t.music.setDucked(true);
    const deck = t.decks[0];
    expect(deck?.fades.at(-1)).toEqual([
      MUSIC_TRACKS[SANDS].level * DUCKED_LEVEL,
      MUSIC_TIMING.duck,
    ]);
    t.music.setDucked(true);
    expect(deck?.fades).toHaveLength(3);
    t.music.setDucked(false);
    expect(deck?.fades.at(-1)).toEqual([MUSIC_TRACKS[SANDS].level, MUSIC_TIMING.duck]);
    // A track that starts while ducked starts low.
    t.music.setDucked(true);
    t.music.play(OUD);
    await settle();
    expect(t.decks[1]?.fades.at(-1)?.[0]).toBeCloseTo(MUSIC_TRACKS[OUD].level * DUCKED_LEVEL);
  });

  it('falls silent first when asked, then returns gently (Galilee’s calm)', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(MYSTERY);
    await settle();
    t.music.play(FLUTE, { silence: 5 });
    await settle();
    expect(t.decks).toHaveLength(1);
    expect(t.decks[0]?.fades.at(-1)).toEqual([0, MUSIC_TIMING.crossfade]);
    expect(t.statuses.at(-1)).toEqual({ track: FLUTE, playing: false });
    await seconds(4.9);
    expect(t.audible()).toHaveLength(0);
    expect(t.decks).toHaveLength(1);
    await seconds(0.2);
    expect(t.decks[1]?.track.id).toBe(FLUTE);
    expect(t.decks[1]?.fades.at(-1)).toEqual([
      MUSIC_TRACKS[FLUTE].level,
      MUSIC_TIMING.returnAfterSilence,
    ]);
  });

  it('cancels a silence when another request comes first', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(MYSTERY);
    await settle();
    t.music.play(FLUTE, { silence: 5 });
    t.music.play(SANDS);
    await seconds(6);
    expect(t.decks.map((d) => d.track.id)).toEqual([MYSTERY, SANDS]);
  });

  it('loops each track by cross-fading into its next pass before the fade at its end', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(MYSTERY);
    await settle();
    const first = t.decks[0];
    if (!first) throw new Error('no deck');
    const { loop } = MUSIC_TRACKS[MYSTERY];
    first.time = loop.end - MUSIC_TIMING.loop - 1;
    await seconds(0.5);
    expect(t.decks).toHaveLength(1);
    first.time = loop.end - MUSIC_TIMING.loop + 0.1;
    await seconds(0.3);
    expect(t.decks).toHaveLength(2);
    expect(t.decks[1]?.offsets).toEqual([loop.start]);
    expect(first.fades.at(-1)).toEqual([0, MUSIC_TIMING.loop]);
    expect(t.decks[1]?.fades.at(-1)).toEqual([MUSIC_TRACKS[MYSTERY].level, MUSIC_TIMING.loop]);
    // A loop is not a new track: no new caption.
    expect(t.started).toEqual([MYSTERY]);
    // A file that simply ends loops too.
    const second = t.decks[1];
    if (!second) throw new Error('no deck');
    second.ended = true;
    await seconds(0.3);
    expect(t.decks).toHaveLength(3);
  });

  it('waits for a gesture when the browser blocks playback, then plays', async () => {
    const t = setup((_track, n) => (n === 0 ? 'blocked' : 'ok'));
    t.music.attach(t.factory);
    t.music.play(OUD);
    await settle();
    expect(t.statuses.at(-1)).toEqual({ track: OUD, playing: false });
    expect(t.warnings).toEqual([]);
    t.music.resume();
    await settle();
    expect(t.decks).toHaveLength(2);
    expect(t.statuses.at(-1)).toEqual({ track: OUD, playing: true });
  });

  it('stays silent and logs once when a file cannot be loaded, and never throws', async () => {
    const t = setup((track) => (track.id === SANDS ? 'broken' : 'ok'));
    t.music.attach(t.factory);
    expect(() => t.music.play(SANDS)).not.toThrow();
    await settle();
    t.music.play(OUD);
    t.music.play(SANDS);
    await settle();
    expect(t.warnings).toHaveLength(1);
    expect(t.warnings[0]).toContain('sacred-sands.mp3');
    expect(t.statuses.at(-1)).toEqual({ track: SANDS, playing: false });
    // Other music still plays.
    t.music.play(FLUTE);
    await settle();
    expect(t.statuses.at(-1)).toEqual({ track: FLUTE, playing: true });
  });

  it('survives a deck that cannot even be made', async () => {
    const t = setup();
    t.music.attach(() => {
      throw new Error('no media elements');
    });
    expect(() => t.music.play(OUD)).not.toThrow();
    expect(t.warnings).toHaveLength(1);
  });

  it('pauses while muted or hidden and resumes where it was', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(OUD);
    await settle();
    const deck = t.decks[0];
    t.music.setPaused('muted', true);
    expect(deck?.playing).toBe(false);
    expect(t.statuses.at(-1)).toEqual({ track: OUD, playing: false });
    t.music.setPaused('hidden', true);
    t.music.setPaused('muted', false);
    expect(deck?.playing).toBe(false);
    t.music.setPaused('hidden', false);
    await settle();
    expect(deck?.playing).toBe(true);
    expect(deck?.offsets).toEqual([0, undefined]);
    expect(t.decks).toHaveLength(1);
    expect(t.statuses.at(-1)).toEqual({ track: OUD, playing: true });
  });

  it('starts music asked for while muted once sound is back', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.setPaused('muted', true);
    t.music.play(SANDS);
    await settle();
    expect(t.decks).toHaveLength(0);
    t.music.setPaused('muted', false);
    await settle();
    expect(t.decks.map((d) => d.track.id)).toEqual([SANDS]);
    expect(t.decks[0]?.playing).toBe(true);
  });

  it("plays a film's music cued to the film, and stops it on skip", async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(OUD); // the menus
    await settle();
    t.music.playFilm(filmMusicPlan(TEASER.music, TEASER.duration, 0));
    await settle();
    expect(t.decks).toHaveLength(1); // the dawn has the same music: it carries on
    await seconds(22);
    expect(t.decks.at(-1)?.track.id).toBe(SANDS);
    await seconds(8);
    expect(t.decks.at(-1)?.track.id).toBe(MYSTERY);
    t.music.stopFilm();
    await seconds(MUSIC_TIMING.film + 0.2);
    expect(t.live()).toHaveLength(0);
    // Its later cues never come.
    await seconds(30);
    expect(t.decks.at(-1)?.track.id).toBe(MYSTERY);
    expect(t.statuses.at(-1)).toEqual({ track: null, playing: false });
  });

  it('leaves other music alone when no film is playing, and a scene request cancels a film', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(OUD);
    await settle();
    t.music.stopFilm();
    expect(t.decks[0]?.fades).toHaveLength(2); // fade(0, 0) and the fade in
    t.music.playFilm(filmMusicPlan(TEASER.music, TEASER.duration, 0));
    t.music.play(FLUTE);
    await seconds(40);
    expect(t.live().map((d) => d.track.id)).toEqual([FLUTE]);
  });

  it('lets everything go on dispose, and starts again if audio returns', async () => {
    const t = setup();
    t.music.attach(t.factory);
    t.music.play(OUD);
    await settle();
    t.music.play(SANDS);
    t.music.dispose();
    expect(t.live()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    t.music.attach(t.factory);
    await settle();
    expect(t.live().map((d) => d.track.id)).toEqual([SANDS]);
  });
});

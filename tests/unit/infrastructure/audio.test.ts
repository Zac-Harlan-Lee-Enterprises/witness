import { describe, expect, it } from 'vitest';
import type { AmbienceId, FootstepSurface, SfxId } from '@/application/ports';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { AMBIENCE, FOOTSTEPS, scheduleAmbience, SFX } from '@/infrastructure/audio/soundscape';
import { MUSIC_TRACKS } from '@/domain/music';
import type { MusicDeckFactory } from '@/infrastructure/audio/recorded-music';
import { SynthAudio, type MusicReport } from '@/infrastructure/audio/synth-audio';
import { createLogger } from '@/shared/logger';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0.5;
};

describe('sound design', () => {
  it('gives every sound effect a recipe, and clues their own bell', () => {
    const ids: SfxId[] = [
      'interact',
      'item',
      'journal',
      'discover',
      'quest',
      'solved',
      'error',
      'page',
      'door',
    ];
    for (const id of ids) expect(SFX[id].length).toBeGreaterThan(0);
    expect(SFX.discover.some((t) => t.kind === 'bell')).toBe(true);
    expect(SFX.discover).not.toEqual(SFX.journal);
  });

  it('gives every surface its own quiet footstep', () => {
    const surfaces: FootstepSurface[] = [
      'stone',
      'gravel',
      'sand',
      'earth',
      'grass',
      'mud',
      'mat',
      'wood',
    ];
    for (const s of surfaces) {
      expect(FOOTSTEPS[s].length).toBeGreaterThan(0);
      for (const t of FOOTSTEPS[s]) expect(t.gain).toBeLessThan(0.15);
    }
    expect(FOOTSTEPS.stone).not.toEqual(FOOTSTEPS.sand);
    expect(FOOTSTEPS.stone.some((t) => t.kind === 'knock')).toBe(true);
  });

  it('fills each place with its own sounds', () => {
    const r = seq([0.1, 0.4, 0.7, 0.2, 0.9, 0.5, 0.3]);
    const kinds = (id: AmbienceId) => new Set(scheduleAmbience(id, 30, r).map((e) => e.kind));
    expect(kinds('market')).toContain('voices');
    expect(kinds('indoor')).toContain('crackle');
    expect(kinds('oasis')).toContain('chirp');
    expect(kinds('wind')).not.toContain('chirp');
    expect(scheduleAmbience('none', 30, r)).toEqual([]);
  });

  it('schedules events inside the window, in order', () => {
    const events = scheduleAmbience('market', 2, seq([0.3, 0.6, 0.1, 0.8]));
    for (const e of events) expect(e.at).toBeLessThan(2);
    expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort((a, b) => a - b));
    expect(Object.keys(AMBIENCE).sort()).toEqual(['indoor', 'market', 'oasis', 'wind']);
  });
});

/** Just enough of WebAudio to run the synth and count what it makes. */
function fakeContext() {
  const made: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
  });
  const node = (kind: string) => {
    made.push(kind);
    const n = {
      gain: param(),
      frequency: param(),
      Q: param(),
      type: '',
      buffer: null as unknown,
      loop: false,
      connect: (next: unknown) => next,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
    return n;
  };
  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: async () => undefined,
    suspend: async () => undefined,
    close: async () => undefined,
    createGain: () => node('gain'),
    createOscillator: () => node('osc'),
    createBiquadFilter: () => node('filter'),
    createBufferSource: () => node('source'),
    createBuffer: (_c: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
  };
  return { ctx: ctx as unknown as AudioContext, made };
}

/** Music decks that play nothing, for SynthAudio's music channel. */
function fakeDecks() {
  const decks: Array<{ track: string; playing: boolean; level: number }> = [];
  const make = (): MusicDeckFactory => (track) => {
    const d = { track: track.id as string, playing: false, level: 0 };
    decks.push(d);
    return {
      play: async () => {
        d.playing = true;
      },
      pause: () => {
        d.playing = false;
      },
      fade: (level) => {
        d.level = level;
      },
      time: 0,
      ended: false,
      dispose: () => {
        d.playing = false;
      },
    };
  };
  return { decks, make };
}

describe('SynthAudio', () => {
  const quiet = () => createLogger({ level: 'error', echo: false });

  it('plays effects, ambience and music through WebAudio, captioning what is audible', async () => {
    const { ctx, made } = fakeContext();
    const captions: string[] = [];
    const music = fakeDecks();
    const audio = new SynthAudio(
      quiet(),
      (c) => captions.push(c),
      () => ctx,
      seq([0.2, 0.5, 0.8]),
      {
        musicDecks: () => music.make(),
      },
    );
    audio.applySettings(DEFAULT_SETTINGS);
    expect(await audio.unlock()).toBe(true);
    audio.playSfx('discover');
    expect(made.filter((m) => m === 'osc').length).toBeGreaterThanOrEqual(6); // two bells, three partials each
    audio.setAmbience('oasis');
    audio.setMusic('journey');
    await Promise.resolve();
    expect(captions.some((c) => /Birdsong/.test(c))).toBe(true);
    expect(captions).toContain(MUSIC_TRACKS['sacred-sands'].caption);
    expect(music.decks.map((d) => d.track)).toEqual(['sacred-sands']);
    const before = made.length;
    audio.playFootstep('stone');
    expect(made.length).toBeGreaterThan(before);
    audio.dispose();
  });

  it('remembers music asked for before the first gesture and starts it on unlock', async () => {
    const { ctx } = fakeContext();
    const music = fakeDecks();
    const reports: MusicReport[] = [];
    const audio = new SynthAudio(
      quiet(),
      () => {},
      () => ctx,
      Math.random,
      {
        musicDecks: () => music.make(),
        onMusicStatus: (r) => reports.push(r),
      },
    );
    audio.applySettings(DEFAULT_SETTINGS);
    audio.setMusic('home');
    expect(music.decks).toHaveLength(0);
    expect(reports.at(-1)).toMatchObject({ track: 'cinematic-oud-and-qanun', playing: false });
    await audio.unlock();
    await Promise.resolve();
    expect(music.decks.map((d) => d.track)).toEqual(['cinematic-oud-and-qanun']);
    expect(reports.at(-1)).toMatchObject({ track: 'cinematic-oud-and-qanun', playing: true });
    // Unlocking again (every gesture tries) changes nothing.
    await audio.unlock();
    expect(music.decks).toHaveLength(1);
    audio.dispose();
  });

  it('pauses the music when muted or at zero volume, and when the page is hidden', async () => {
    const { ctx } = fakeContext();
    const music = fakeDecks();
    const reports: MusicReport[] = [];
    const audio = new SynthAudio(
      quiet(),
      () => {},
      () => ctx,
      Math.random,
      {
        musicDecks: () => music.make(),
        onMusicStatus: (r) => reports.push(r),
      },
    );
    audio.applySettings(DEFAULT_SETTINGS);
    await audio.unlock();
    audio.setMusic('reflection');
    await Promise.resolve();
    const deck = music.decks[0];
    expect(deck?.playing).toBe(true);
    expect(reports.at(-1)?.volume).toBeCloseTo(
      DEFAULT_SETTINGS.volume.master * DEFAULT_SETTINGS.volume.music,
    );
    audio.applySettings({ ...DEFAULT_SETTINGS, muted: true });
    expect(deck?.playing).toBe(false);
    expect(reports.at(-1)).toMatchObject({ playing: false, volume: 0 });
    audio.applySettings({
      ...DEFAULT_SETTINGS,
      volume: { ...DEFAULT_SETTINGS.volume, music: 0 },
    });
    expect(deck?.playing).toBe(false);
    audio.applySettings(DEFAULT_SETTINGS);
    await Promise.resolve();
    expect(deck?.playing).toBe(true);
    audio.suspend();
    expect(deck?.playing).toBe(false);
    await audio.unlock();
    await Promise.resolve();
    expect(deck?.playing).toBe(true);
    expect(music.decks).toHaveLength(1);
    audio.dispose();
  });

  it('never captions music while muted or with captions off', async () => {
    const { ctx } = fakeContext();
    const captions: string[] = [];
    const audio = new SynthAudio(
      quiet(),
      (c) => captions.push(c),
      () => ctx,
      Math.random,
      {
        musicDecks: () => fakeDecks().make(),
      },
    );
    audio.applySettings({ ...DEFAULT_SETTINGS, captions: false });
    await audio.unlock();
    audio.setMusic('tension');
    await Promise.resolve();
    expect(captions).toEqual([]);
    audio.dispose();
  });
});

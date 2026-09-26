import { describe, expect, it } from 'vitest';
import type { AmbienceId, FootstepSurface, SfxId } from '@/application/ports';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import {
  AMBIENCE,
  FOOTSTEPS,
  MUSIC,
  nextPhrase,
  scheduleAmbience,
  SFX,
} from '@/infrastructure/audio/soundscape';
import { SynthAudio } from '@/infrastructure/audio/synth-audio';
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

  it('plays phrases in the mode, never repeating a phrase back to back', () => {
    for (const style of Object.values(MUSIC)) {
      for (const phrase of style.phrases)
        for (const d of phrase) expect(d).toBeLessThan(style.notes.length);
      expect(nextPhrase(style, 0, () => 0)).not.toBe(0);
    }
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

describe('SynthAudio', () => {
  it('plays effects, ambience and music through WebAudio, captioning what is audible', async () => {
    const { ctx, made } = fakeContext();
    const captions: string[] = [];
    const audio = new SynthAudio(
      createLogger({ level: 'error', echo: false }),
      (c) => captions.push(c),
      () => ctx,
      seq([0.2, 0.5, 0.8]),
    );
    audio.applySettings(DEFAULT_SETTINGS);
    expect(await audio.unlock()).toBe(true);
    audio.playSfx('discover');
    expect(made.filter((m) => m === 'osc').length).toBeGreaterThanOrEqual(6); // two bells, three partials each
    audio.setAmbience('oasis');
    audio.setMusic('journey');
    expect(captions.some((c) => /Birdsong/.test(c))).toBe(true);
    expect(captions.some((c) => /drum/.test(c))).toBe(true);
    const before = made.length;
    audio.playFootstep('stone');
    expect(made.length).toBeGreaterThan(before);
    audio.dispose();
  });
});

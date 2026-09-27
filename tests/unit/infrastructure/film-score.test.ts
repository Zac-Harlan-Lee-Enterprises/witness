import { describe, expect, it } from 'vitest';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { TeaserSchema } from '@/domain/teaser';
import { composeScore, scoreFrom } from '@/infrastructure/audio/film-score';
import { SynthAudio } from '@/infrastructure/audio/synth-audio';
import { createLogger } from '@/shared/logger';

const teaser = TeaserSchema.parse(ROAD_TO_JERICHO.teaser);
const score = composeScore(teaser.music, teaser.duration);

describe("the teaser's score", () => {
  it('is the same every time', () => {
    expect(composeScore(teaser.music, teaser.duration)).toEqual(score);
  });

  it('plays in every section but the silence, and never past the film', () => {
    teaser.music.forEach((section, i) => {
      const to = teaser.music[i + 1]?.at ?? teaser.duration;
      const inside = score.notes.filter((n) => n.time >= section.at && n.time < to);
      const held = score.pads.filter((p) => p.time >= section.at && p.time < to);
      if (section.mood === 'silence') {
        expect(inside).toEqual([]);
        expect(held).toEqual([]);
      } else expect(inside.length + held.length, section.mood).toBeGreaterThan(0);
    });
    for (const n of score.notes) expect(n.time).toBeLessThan(teaser.duration);
  });

  it('is silent on "What you do next is up to you."', () => {
    const line = teaser.cues.find((c) => c.text === 'What you do next is up to you.');
    if (!line) throw new Error('missing line');
    const during = score.notes.filter((n) => n.time >= line.at && n.time < line.until);
    const held = score.pads.filter((p) => p.time < line.until && p.time + p.dur > line.at + 1.5);
    expect(during).toEqual([]);
    expect(held).toEqual([]);
  });

  it('resolves on D under the title', () => {
    const resolve = teaser.music.find((m) => m.mood === 'resolve');
    const plucks = score.notes.filter((n) => resolve && n.time >= resolve.at && n.kind === 'pluck');
    const last = plucks.at(-1);
    expect(last && Math.round(12 * Math.log2(last.freq / 440) + 69) % 12).toBe(2); // D
  });

  it('starts from any point of the film (resumed after a pause)', () => {
    const later = scoreFrom(score, 30);
    expect(later.notes.every((n) => n.time >= 30)).toBe(true);
    expect(later.pads.every((p) => p.time >= 30 && p.dur > 0)).toBe(true);
  });
});

/** Enough WebAudio to count what the synth makes and whether it stops it. */
function fakeContext() {
  const made: string[] = [];
  let stopped = 0;
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
  });
  const node = (kind: string) => {
    made.push(kind);
    return {
      gain: param(),
      frequency: param(),
      Q: param(),
      type: '',
      buffer: null as unknown,
      loop: false,
      connect: (next: unknown) => next,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => {
        stopped++;
      },
    };
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
  return { ctx: ctx as unknown as AudioContext, made, stopped: () => stopped };
}

describe('SynthAudio film score', () => {
  it('plays the score on the music channel, from where the film is, and stops it', async () => {
    const { ctx, made, stopped } = fakeContext();
    const audio = new SynthAudio(
      createLogger({ level: 'error', echo: false }),
      () => undefined,
      () => ctx,
    );
    audio.applySettings(DEFAULT_SETTINGS);
    await audio.unlock();
    const before = made.filter((m) => m === 'osc').length;
    audio.playFilmScore(teaser.music, teaser.duration, 0);
    expect(made.filter((m) => m === 'osc').length).toBeGreaterThan(before);
    const stops = stopped();
    audio.stopFilmScore();
    expect(stopped()).toBeGreaterThan(stops);
    // Stopping twice is harmless.
    audio.stopFilmScore();
    audio.dispose();
  });
});

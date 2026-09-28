import { describe, expect, it } from 'vitest';
import { ProfileService } from '@/application/profile-service';
import { PlayerProfileSchema } from '@/domain/profile';
import {
  cuesAt,
  shouldPlayTeaser,
  teaserSteps,
  TeaserSchema,
  type TeaserInput,
} from '@/domain/teaser';
import {
  MemoryProfileRepository,
  MemorySaveRepository,
} from '@/infrastructure/persistence/memory-repositories';
import { createLogger } from '@/shared/logger';

const base: TeaserInput = {
  video: [{ src: 'art/teaser/chapter-1/teaser.mp4', type: 'video/mp4' }],
  poster: 'art/teaser/chapter-1/poster.webp',
  duration: 20,
  description: 'A film.',
  recordId: 'rec-teaser',
  cues: [
    { at: 1, until: 4, text: 'One.' },
    { at: 5, until: 8, text: 'Two.' },
    { at: 10, until: 20, text: 'Witness', style: 'title' },
    { at: 11, until: 20, text: 'Chapter 1', style: 'subtitle' },
  ],
  music: [
    { at: 0, mood: 'dawn' },
    { at: 9, mood: 'resolve' },
  ],
};

describe('teaser schema', () => {
  it('accepts a teaser whose cues follow one another inside the film', () => {
    expect(TeaserSchema.safeParse(base).success).toBe(true);
  });

  it('rejects overlapping lines, cues past the film, and music out of order', () => {
    const overlap = { ...base, cues: [base.cues[0], { at: 3, until: 6, text: 'Late.' }] };
    expect(TeaserSchema.safeParse(overlap).success).toBe(false);
    const past = { ...base, cues: [{ at: 18, until: 25, text: 'Too long.' }] };
    expect(TeaserSchema.safeParse(past).success).toBe(false);
    const music = {
      ...base,
      music: [
        { at: 5, mood: 'road' },
        { at: 2, mood: 'dawn' },
      ],
    };
    expect(TeaserSchema.safeParse(music).success).toBe(false);
    const backwards = { ...base, cues: [{ at: 4, until: 3, text: 'Backwards.' }] };
    expect(TeaserSchema.safeParse(backwards).success).toBe(false);
  });

  it('only takes films and posters from the art folder', () => {
    const outside = { ...base, video: [{ src: 'https://example.com/x.mp4', type: 'video/mp4' }] };
    expect(TeaserSchema.safeParse(outside).success).toBe(false);
  });
});

describe('teaser timing', () => {
  const t = TeaserSchema.parse(base);

  it('shows the cue of the moment, nothing between cues, and the title with its subtitle', () => {
    expect(cuesAt(t.cues, 2).map((c) => c.text)).toEqual(['One.']);
    expect(cuesAt(t.cues, 4.5)).toEqual([]);
    expect(cuesAt(t.cues, 12).map((c) => c.text)).toEqual(['Witness', 'Chapter 1']);
  });

  it('steps through the words one card at a time, title and subtitle together', () => {
    expect(teaserSteps(t.cues).map((s) => s.map((c) => c.text))).toEqual([
      ['One.'],
      ['Two.'],
      ['Witness', 'Chapter 1'],
    ]);
  });
});

describe('when the teaser plays', () => {
  const chapter = { id: 'road-to-jericho', teaser: {} };

  it('plays before a new game the first time only', () => {
    expect(shouldPlayTeaser(chapter, { seenTeasers: [] }, false)).toBe(true);
    expect(shouldPlayTeaser(chapter, { seenTeasers: ['road-to-jericho'] }, false)).toBe(false);
  });

  it('never plays when a save is loaded, or for a chapter without one', () => {
    expect(shouldPlayTeaser(chapter, { seenTeasers: [] }, true)).toBe(false);
    expect(shouldPlayTeaser({ id: 'x' }, { seenTeasers: [] }, false)).toBe(false);
  });

  it('reads profiles saved before teasers existed as having seen none', () => {
    const old = {
      id: 'p1',
      displayName: 'Ari',
      look: 'look-1',
      createdAt: new Date(0).toISOString(),
      lastPlayedAt: null,
      completedChapters: [],
    };
    expect(PlayerProfileSchema.parse(old).seenTeasers).toEqual([]);
  });

  it("remembers in the profile that a chapter's teaser was seen", async () => {
    const profiles = new MemoryProfileRepository();
    const service = new ProfileService(
      profiles,
      new MemorySaveRepository(),
      { now: () => 0 },
      createLogger({ level: 'error', echo: false }),
    );
    const created = await service.create('Ari', 'look-1');
    if (!created.ok) throw new Error(created.reason);
    const seen = await service.markTeaserSeen(created.profile, 'road-to-jericho');
    expect(seen.seenTeasers).toEqual(['road-to-jericho']);
    expect(await service.markTeaserSeen(seen, 'road-to-jericho')).toBe(seen);
    const [stored] = await service.list();
    expect(stored?.seenTeasers).toEqual(['road-to-jericho']);
  });
});

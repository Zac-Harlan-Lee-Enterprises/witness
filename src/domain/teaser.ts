import { z } from 'zod';

/**
 * A chapter's teaser: a short film that plays before the chapter the first
 * time a profile starts it, with the words as real text cued to the film's
 * time (never burned into the picture), and music cued to the same
 * timeline. Content data (src/content/chapters/<id>/teaser.ts); the
 * words are a content record like any other and need a human editor's
 * approval (docs/content-governance.md).
 */

/** How a cue is set: a line of the story, or the title and its subtitle. */
export const TEASER_CUE_STYLES = ['line', 'title', 'subtitle'] as const;

export const TeaserCueSchema = z
  .object({
    /** Seconds into the film when the words appear… */
    at: z.number().nonnegative(),
    /** …and when they go. */
    until: z.number().positive(),
    text: z.string().min(1),
    style: z.enum(TEASER_CUE_STYLES).default('line'),
  })
  .refine((c) => c.until > c.at, { message: 'a cue must end after it starts' });
export type TeaserCue = z.infer<typeof TeaserCueSchema>;

/**
 * The moods of a film's music: a section plays from its `at` until the next
 * one starts, each with one of the game's recorded tracks
 * (src/application/music.ts: FILM_MOOD_MUSIC).
 */
export const FILM_MOODS = [
  'dawn',
  'home',
  'market',
  'road',
  'unease',
  'tension',
  'silence',
  'resolve',
] as const;
export type FilmMood = (typeof FILM_MOODS)[number];

export const FilmSectionSchema = z.object({
  at: z.number().nonnegative(),
  mood: z.enum(FILM_MOODS),
});
export type FilmSection = z.infer<typeof FilmSectionSchema>;

export const TeaserVideoSchema = z.object({
  /** Relative to the site's base URL (art/teaser/...). */
  src: z.string().regex(/^art\/teaser\/[\w./-]+\.(mp4|webm)$/),
  type: z.enum(['video/webm', 'video/mp4']),
});

export const TeaserSchema = z
  .object({
    /** The film, in order of preference (the browser plays the first it can). */
    video: z.array(TeaserVideoSchema).min(1),
    /** A still shown before the film plays, when it can't, and under reduced motion. */
    poster: z.string().regex(/^art\/teaser\/[\w./-]+\.(webp|jpg)$/),
    /** Length of the film in seconds. */
    duration: z.number().positive(),
    /** What the film shows, in words (for screen readers; the cues carry the story). */
    description: z.string().min(1),
    /** The content record that holds the teaser's words and their review status. */
    recordId: z.string().min(1),
    cues: z.array(TeaserCueSchema).min(1),
    music: z.array(FilmSectionSchema).min(1),
  })
  .superRefine((t, ctx) => {
    t.cues.forEach((c, i) => {
      const prev = t.cues[i - 1];
      // Cues follow one another; only a subtitle may join the title it goes with.
      const joins = c.style === 'subtitle' && prev?.style === 'title';
      if (prev && c.at < prev.at)
        ctx.addIssue({ code: 'custom', path: ['cues', i], message: 'cues out of order' });
      if (prev && c.at < prev.until && !joins)
        ctx.addIssue({ code: 'custom', path: ['cues', i], message: 'cues must not overlap' });
      if (c.until > t.duration + 1e-6)
        ctx.addIssue({ code: 'custom', path: ['cues', i], message: 'cue runs past the film' });
    });
    t.music.forEach((m, i) => {
      const prev = t.music[i - 1];
      if (prev && m.at <= prev.at)
        ctx.addIssue({
          code: 'custom',
          path: ['music', i],
          message: 'music sections out of order',
        });
      if (m.at >= t.duration)
        ctx.addIssue({
          code: 'custom',
          path: ['music', i],
          message: 'music starts after the film',
        });
    });
  });
export type Teaser = z.infer<typeof TeaserSchema>;
export type TeaserInput = z.input<typeof TeaserSchema>;

/** The cues showing at time t (seconds): none, a line, or a title with its subtitle. */
export function cuesAt(cues: readonly TeaserCue[], t: number): TeaserCue[] {
  return cues.filter((c) => t >= c.at && t < c.until);
}

/**
 * The cue a player stepping through the stills (reduced motion, or a film
 * that couldn't play) sees at step i: title and subtitle cues shown together.
 */
export function teaserSteps(cues: readonly TeaserCue[]): TeaserCue[][] {
  const steps: TeaserCue[][] = [];
  for (const c of cues) {
    const last = steps[steps.length - 1];
    if (c.style === 'subtitle' && last?.some((x) => x.style === 'title')) last.push(c);
    else steps.push([c]);
  }
  return steps;
}

/** Whether a new game should open with the chapter's teaser for this profile. */
export function shouldPlayTeaser(
  chapter: { id: string; teaser?: unknown },
  profile: { seenTeasers: readonly string[] },
  restoringSave: boolean,
): boolean {
  return (
    !restoringSave && chapter.teaser !== undefined && !profile.seenTeasers.includes(chapter.id)
  );
}

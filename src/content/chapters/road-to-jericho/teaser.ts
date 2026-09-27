import type { ChapterInput } from '@/domain/chapter';
import type { TeaserInput } from '@/domain/teaser';
import { withTeaserApproval } from '../../shared/approvals';

/**
 * The teaser that plays before Chapter 1 the first time a profile starts it:
 * a 57-second film (rendered offline by tools/art/build_teaser.py) with its
 * words as text cues and a score from the game's own synthesiser.
 *
 * Every story detail follows the chapter itself: Aunt Miriam's friend
 * Rivka's son Natan has a fever in Jericho, Miriam has made a remedy and
 * the player carries it (d-opening); advice in the market is good and bad
 * (Shimon, Malik, Tobiah); the old shepherd says men wait above the bend
 * and "watch when the road is empty" (d-shimon); below the bend lie a
 * broken jar, footprints, and a man in the shade of the rocks
 * (d-incident-arrival). It never says who the man is or what the player
 * will do.
 *
 * The one historical figure is the road's fall of about 1,000 meters
 * (docs/research/source-verification.md, claim 1: Jerusalem about 754 m,
 * Jericho about 258 m below sea level; rec-hist-descent). "A long day's
 * walk" is the chapter's own hedged wording (claim 21; Aunt Miriam's line).
 *
 * The words await the owner's review: the blanket approval of the chapters
 * (2026-09-26) does not cover them (TEASER_APPROVALS in shared/approvals.ts).
 */
const CUES: TeaserInput['cues'] = [
  { at: 0.8, until: 6.6, text: 'Jerusalem. Before the heat of the day.' },
  { at: 7.4, until: 10.6, text: 'In Jericho, a boy named Natan has a fever that won’t go away.' },
  { at: 10.8, until: 13.8, text: 'Aunt Miriam has made a remedy. Now it’s in your hands.' },
  { at: 14.5, until: 17.8, text: 'In the market, everyone has advice.' },
  { at: 18.0, until: 21.6, text: 'Not all of it is good.' },
  { at: 22.6, until: 25.6, text: 'Then the road down to Jericho:' },
  {
    at: 25.8,
    until: 29.8,
    text: 'a long day’s walk, falling some 1,000 meters through the wilderness.',
  },
  { at: 30.6, until: 36.4, text: 'Travelers say robbers watch this road when it’s empty.' },
  { at: 37.6, until: 43.4, text: 'Below the bend, something has happened.' },
  { at: 45.0, until: 49.6, text: 'What you do next is up to you.' },
  { at: 50.8, until: 57.0, text: 'Witness', style: 'title' },
  { at: 52.2, until: 57.0, text: 'Chapter 1: The Road to Jericho', style: 'subtitle' },
];

export const TEASER_RECORD_ID = 'rec-teaser';

export const TEASER: TeaserInput = {
  video: [
    { src: 'art/teaser/chapter-1/teaser.webm', type: 'video/webm' },
    { src: 'art/teaser/chapter-1/teaser.mp4', type: 'video/mp4' },
  ],
  poster: 'art/teaser/chapter-1/poster.webp',
  duration: 57,
  description:
    'A short film without words or sound of its own: sunrise over Jerusalem’s rooftops; a lamp burning beside a small clay jar and a folded letter; the market waking; the road winding down into the wilderness; a young traveler walking alone above a gorge; a broken jar and footprints in the dust; a man lying in the shade of a rock; the title over the gorge in the evening light.',
  recordId: TEASER_RECORD_ID,
  cues: CUES,
  music: [
    { at: 0, mood: 'dawn' },
    { at: 7, mood: 'home' },
    { at: 14, mood: 'market' },
    { at: 22, mood: 'road' },
    { at: 30, mood: 'unease' },
    { at: 37, mood: 'tension' },
    { at: 44.4, mood: 'silence' },
    { at: 50, mood: 'resolve' },
  ],
};

export const TEASER_RECORD: ChapterInput['records'][number] = withTeaserApproval(
  'road-to-jericho',
  {
    id: TEASER_RECORD_ID,
    kind: 'fiction',
    title: 'Teaser: The Road to Jericho',
    body: CUES.map((c) => c.text).join('\n'),
    sources: ['src-wiki-jerusalem', 'src-wiki-jericho'],
    governance: {
      status: 'in-review',
      provenance: 'ai-assisted',
      ageLevel: '10+',
      denominationalSensitivity: 'none',
      historicalConfidence: 'established',
      editorialNotes:
        'Story lines checked against the chapter (d-opening, d-shimon, d-incident-arrival). One historical figure: the road falls about 1,000 m (source verification claim 1; rec-hist-descent). "A long day’s walk" is the chapter’s own hedged phrase (claim 21). Sent to the owner for approval on 2026-09-27; not covered by the approval of 2026-09-26.',
      version: 1,
      history: [
        {
          version: 1,
          date: '2026-09-27',
          author: 'Claude (AI-assisted draft)',
          summary:
            'Teaser script drafted from the owner’s outline and checked against the chapter.',
        },
      ],
    },
  },
);

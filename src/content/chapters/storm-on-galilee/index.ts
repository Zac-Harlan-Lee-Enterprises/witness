import type { ChapterInput } from '@/domain/chapter';
import { CHARACTERS } from './characters';
import { CHOICES, THEMES } from './choices';
import { CLUES } from './clues';
import { HOME_DIALOGUES } from './dialogue/home';
import { LAKE_DIALOGUES } from './dialogue/lake';
import { RETURN_DIALOGUES } from './dialogue/return';
import { SHORE_DIALOGUES } from './dialogue/shore';
import { SCRIPTURE_CONNECTION, SUMMARY } from './ending';
import { ITEMS } from './items';
import { JOURNAL } from './journal';
import { PUZZLES } from './puzzles';
import { QUESTS } from './quests';
import { RECORDS } from './records';
import { CAPERNAUM_SHORE } from './scenes/capernaum-shore';
import { OPEN_LAKE } from './scenes/open-lake';
import { SHELOMIT_HOUSE } from './scenes/shelomit-house';
import { STORM_SOURCES } from './sources';

const flagIs = (flag: string) => ({ type: 'flag' as const, flag });
const carries = (item: string) => ({ type: 'hasItem' as const, item });

/**
 * Chapter 2 — A Storm on Galilee (Mark 4:35–41; Matthew 8:23–27; Luke 8:22–25).
 *
 * The player is a young member of a fictional fishing family in Capernaum
 * whose boat is one of the "other boats" of Mark 4:36. They share the
 * storm and the calm, but never see or hear what happens in the teacher's
 * boat; the Scripture Connection shows what Mark wrote.
 *
 * Authored as plain data; validated by ChapterSchema + validateChapterIntegrity
 * at build time (scripts/validate-content.ts) and again on load.
 */
export const STORM_ON_GALILEE: ChapterInput = {
  id: 'storm-on-galilee',
  number: 2,
  title: 'A Storm on Galilee',
  subtitle: 'One of the other boats',
  synopsis:
    'Crew the family fishing boat for the first time, on the evening a teacher crosses the Sea of Galilee and other boats go with him. Read the sky, load the boat, and face a storm in the dark — then read what Mark says happened in the boat ahead.',
  estimatedMinutes: { min: 20, max: 30 },
  contentVersion: '1.0.0-draft',
  setting:
    'Capernaum and the Sea of Galilee, early first century AD, during the years of Jesus’ public ministry (dates approximate).',
  start: { scene: 'shelomit-house', spawn: 'start' },
  initial: { flags: {}, counters: { hour: 16 }, inventory: {} },
  opening: [{ type: 'startDialogue', dialogue: 'd-opening' }],
  timeCounter: 'hour',
  // What you visibly carry once the boat is loaded, and what giving things away changes.
  playerLooks: [
    { when: { type: 'all', of: [flagIs('loaded'), carries('lamp')] }, marks: ['lamp'] },
    { when: { type: 'all', of: [flagIs('loaded'), carries('cloak')] }, marks: ['cloak-roll'] },
    {
      when: { type: 'all', of: [flagIs('loaded'), carries('water-skin')] },
      marks: ['water-skin'],
    },
  ],
  lightItem: 'lamp',
  mainQuest: 'q-crossing',
  characters: CHARACTERS,
  items: ITEMS,
  scenes: [SHELOMIT_HOUSE, CAPERNAUM_SHORE, OPEN_LAKE],
  dialogues: [...HOME_DIALOGUES, ...SHORE_DIALOGUES, ...LAKE_DIALOGUES, ...RETURN_DIALOGUES],
  quests: QUESTS,
  clues: CLUES,
  puzzles: PUZZLES,
  journal: JOURNAL,
  records: RECORDS,
  sources: STORM_SOURCES,
  choices: CHOICES,
  themes: THEMES,
  scriptureConnection: SCRIPTURE_CONNECTION,
  summary: SUMMARY,
};

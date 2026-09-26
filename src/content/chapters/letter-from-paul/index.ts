import type { ChapterInput } from '@/domain/chapter';
import { CHARACTERS } from './characters';
import { CHOICES, THEMES } from './choices';
import { CLUES } from './clues';
import { GATHERING_DIALOGUES } from './dialogue/gathering';
import { HOME_DIALOGUES } from './dialogue/home';
import { ROAD_DIALOGUES } from './dialogue/road';
import { STREET_DIALOGUES } from './dialogue/street';
import { SCRIPTURE_CONNECTION, SUMMARY } from './ending';
import { ITEMS } from './items';
import { JOURNAL } from './journal';
import { PUZZLES } from './puzzles';
import { QUESTS } from './quests';
import { RECORDS } from './records';
import { AMMIA_WORKSHOP } from './scenes/ammia-workshop';
import { COLOSSAE_STREET } from './scenes/colossae-street';
import { LYCUS_ROAD } from './scenes/lycus-road';
import { PHILEMON_HOUSE } from './scenes/philemon-house';
import { LETTER_SOURCES } from './sources';
import { withApprovals } from '../../shared/approvals';

const flagIs = (flag: string) => ({ type: 'flag' as const, flag });
const carries = (item: string) => ({ type: 'hasItem' as const, item });

/**
 * Chapter 4 — A Letter from Paul.
 * Philemon, and the end of Colossians (4:7–18): how a letter was carried,
 * read aloud to a gathered assembly, and what reconciliation asks of real
 * people. The player's story (Ammia, Kallias and the road) is fiction that
 * sits beside the letters without rewriting them. See
 * docs/chapters/letter-from-paul.md.
 */
export const LETTER_FROM_PAUL: ChapterInput = {
  id: 'letter-from-paul',
  number: 4,
  title: 'A Letter from Paul',
  subtitle: 'Carried by hand, read aloud in Colossae',
  synopsis:
    'In the wool town of Colossae, a rain-soaked letter arrives from your grandmother’s runaway apprentice. Put it back together, carry her answer down the Laodicea road, and be back in time to hear the letters from Paul read aloud at Philemon’s house.',
  estimatedMinutes: { min: 20, max: 30 },
  contentVersion: '1.0.0-draft',
  setting:
    'Colossae and the Lycus valley, in the Roman province of Asia, around AD 55–62 (dates uncertain).',
  start: { scene: 'ammia-workshop', spawn: 'start' },
  initial: {
    flags: {},
    counters: { hour: 8 },
    inventory: {
      coins: 3,
      bread: 1,
      'hooded-cloak': 1,
      'spare-cloak': 1,
      tablets: 1,
      'letter-case': 1,
    },
  },
  opening: [{ type: 'startDialogue', dialogue: 'd-opening' }],
  timeCounter: 'hour',
  // What you visibly carry once packed (and what you give away).
  playerLooks: [
    {
      when: { type: 'all', of: [flagIs('packed'), carries('letter-case')] },
      marks: ['letter-case'],
    },
    {
      when: { type: 'all', of: [flagIs('packed'), carries('spare-cloak')] },
      marks: ['cloak-roll'],
    },
  ],
  mainQuest: 'q-letters',
  characters: CHARACTERS,
  items: ITEMS,
  scenes: [AMMIA_WORKSHOP, COLOSSAE_STREET, LYCUS_ROAD, PHILEMON_HOUSE],
  dialogues: [...HOME_DIALOGUES, ...STREET_DIALOGUES, ...ROAD_DIALOGUES, ...GATHERING_DIALOGUES],
  quests: QUESTS,
  clues: CLUES,
  puzzles: PUZZLES,
  journal: JOURNAL,
  records: withApprovals('letter-from-paul', RECORDS),
  sources: LETTER_SOURCES,
  choices: CHOICES,
  themes: THEMES,
  scriptureConnection: SCRIPTURE_CONNECTION,
  summary: SUMMARY,
};

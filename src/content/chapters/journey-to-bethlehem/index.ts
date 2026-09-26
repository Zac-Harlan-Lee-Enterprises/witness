import type { ChapterInput } from '@/domain/chapter';
import { CHARACTERS } from './characters';
import { CHOICES, THEMES } from './choices';
import { CLUES } from './clues';
import { FIELDS_DIALOGUES } from './dialogue/fields';
import { HOME_DIALOGUES } from './dialogue/home';
import { VILLAGE_DIALOGUES } from './dialogue/village';
import { SCRIPTURE_CONNECTION, SUMMARY } from './ending';
import { ITEMS } from './items';
import { JOURNAL } from './journal';
import { PUZZLES } from './puzzles';
import { QUESTS } from './quests';
import { RECORDS } from './records';
import { BETHLEHEM_LANES } from './scenes/bethlehem-lanes';
import { SHEPHERDS_FIELDS } from './scenes/shepherds-fields';
import { TAMAR_HOUSE } from './scenes/tamar-house';
import { SOURCES } from './sources';

/**
 * Chapter 3 — A Journey to Bethlehem (Luke 2:1–20).
 *
 * The player is a fictional child of a Bethlehem household during the
 * registration. The people of Luke 2 stay off-stage: the player is one of
 * "all who heard" the shepherds' report (Luke 2:17–18), through a fictional
 * neighbor's labelled paraphrase, and then reads the passage itself.
 * Authored as plain data; validated by ChapterSchema + validateChapterIntegrity.
 */
export const JOURNEY_TO_BETHLEHEM: ChapterInput = {
  id: 'journey-to-bethlehem',
  number: 3,
  title: 'A Journey to Bethlehem',
  subtitle: 'A crowded night in David’s town',
  synopsis:
    'The emperor’s registration has filled Bethlehem, and your family’s house is full. Make room for guests, take supper to the sheepfold, find a lost lamb — and late at night, hear what the shepherds have been telling everyone.',
  estimatedMinutes: { min: 20, max: 30 },
  contentVersion: '1.0.0-draft',
  setting:
    'Bethlehem in Judea, around the time of Jesus’ birth (the exact year is uncertain; see “When was the census?”).',
  start: { scene: 'tamar-house', spawn: 'start' },
  initial: {
    flags: {},
    counters: { hour: 14 },
    inventory: {},
  },
  opening: [{ type: 'startDialogue', dialogue: 'd-opening' }],
  timeCounter: 'hour',
  playerLooks: [
    { when: { type: 'hasItem', item: 'lamp' }, marks: ['lamp'] },
    { when: { type: 'flag', flag: 'carrying-lamb' }, marks: ['carrying-lamb'] },
  ],
  lightItem: 'lamp',
  mainQuest: 'q-room',
  characters: CHARACTERS,
  items: ITEMS,
  scenes: [TAMAR_HOUSE, BETHLEHEM_LANES, SHEPHERDS_FIELDS],
  dialogues: [...HOME_DIALOGUES, ...VILLAGE_DIALOGUES, ...FIELDS_DIALOGUES],
  quests: QUESTS,
  clues: CLUES,
  puzzles: PUZZLES,
  journal: JOURNAL,
  records: RECORDS,
  sources: SOURCES,
  choices: CHOICES,
  themes: THEMES,
  scriptureConnection: SCRIPTURE_CONNECTION,
  summary: SUMMARY,
};

import type { ChapterInput } from '@/domain/chapter';
import { SOURCES } from '../../shared/sources';
import { CHARACTERS } from './characters';
import { CHOICES, THEMES } from './choices';
import { CLUES } from './clues';
import { HOME_DIALOGUES } from './dialogue/home';
import { JERICHO_DIALOGUES } from './dialogue/jericho';
import { MARKET_DIALOGUES } from './dialogue/market';
import { ROAD_DIALOGUES } from './dialogue/road';
import { SCRIPTURE_CONNECTION, SUMMARY } from './ending';
import { ITEMS } from './items';
import { JOURNAL } from './journal';
import { PUZZLES } from './puzzles';
import { QUESTS } from './quests';
import { RECORDS } from './records';
import { JERICHO } from './scenes/jericho';
import { JERICHO_ROAD } from './scenes/jericho-road';
import { JERUSALEM_MARKET } from './scenes/jerusalem-market';
import { MIRIAM_HOUSE } from './scenes/miriam-house';

/**
 * Chapter 1 — The Road to Jericho.
 * Authored as plain data; validated by ChapterSchema + validateChapterIntegrity
 * at build time (scripts/validate-content.ts) and again on load.
 */
export const ROAD_TO_JERICHO: ChapterInput = {
  id: 'road-to-jericho',
  number: 1,
  title: 'The Road to Jericho',
  subtitle: 'A journey down from Jerusalem',
  synopsis:
    'Carry a remedy from Jerusalem to a sick child in Jericho, down a road with a dangerous reputation. Along the way, weigh advice, make hard choices — and hear about a story Jesus told on the very same road.',
  estimatedMinutes: { min: 20, max: 30 },
  contentVersion: '1.0.0-draft',
  setting:
    'Judea, early first century AD, during the years of Jesus’ public ministry (dates approximate).',
  start: { scene: 'miriam-house', spawn: 'start' },
  initial: {
    flags: {},
    counters: { hour: 8 },
    inventory: { coins: 5, 'water-skin': 2, bread: 1, lamp: 1, cloak: 1 },
  },
  opening: [{ type: 'startDialogue', dialogue: 'd-opening' }],
  timeCounter: 'hour',
  lightItem: 'lamp',
  mainQuest: 'q-remedy',
  characters: CHARACTERS,
  items: ITEMS,
  scenes: [MIRIAM_HOUSE, JERUSALEM_MARKET, JERICHO_ROAD, JERICHO],
  dialogues: [...HOME_DIALOGUES, ...MARKET_DIALOGUES, ...ROAD_DIALOGUES, ...JERICHO_DIALOGUES],
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

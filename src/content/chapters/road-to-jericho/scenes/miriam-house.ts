import type { ChapterInput } from '@/domain/chapter';

/** Aunt Miriam's house, Jerusalem (interior). The chapter begins here. */
export const MIRIAM_HOUSE: ChapterInput['scenes'][number] = {
  id: 'miriam-house',
  name: 'Aunt Miriam’s house',
  kind: 'indoor',
  description:
    'A small stone house that smells of drying herbs. Aunt Miriam works by the oven; a travel satchel waits by the table.',
  layout: [
    '################',
    '################',
    '#jj.os....tt.Lj#',
    '#b.........t...#',
    '#..uuuu........#',
    '#..uuuu........#',
    '#..............#',
    '#j.........tt..#',
    '#j...........mm#',
    '#c...........rr#',
    '#######DD#######',
  ],
  legend: {
    '#': 'wall',
    '.': 'floor',
    u: 'rug',
    j: 'jars',
    o: 'oven',
    t: 'table',
    D: 'door',
    s: 'sacks',
    b: 'basket',
    L: 'loom',
    m: 'mat',
    r: 'bedroll',
    c: 'crate',
  },
  baseTile: 'floor',
  spawns: {
    start: { x: 7, y: 5, facing: 'up' },
    'from-market': { x: 7, y: 9, facing: 'up' },
  },
  entities: [
    {
      id: 'miriam',
      kind: 'npc',
      label: 'Aunt Miriam',
      characterId: 'miriam',
      x: 6,
      y: 3,
      facing: 'down',
      interaction: { verb: 'talk', dialogue: 'd-miriam' },
    },
    {
      id: 'satchel',
      kind: 'feature',
      label: 'Travel satchel',
      sprite: 'pack',
      x: 13,
      y: 7,
      visibleWhen: { type: 'not', condition: { type: 'puzzleSolved', puzzle: 'p-satchel' } },
      interaction: {
        verb: 'use',
        requires: {
          type: 'all',
          of: [
            { type: 'objectiveDone', quest: 'q-remedy', objective: 'ask-road' },
            { type: 'objectiveDone', quest: 'q-remedy', objective: 'collect-linen' },
          ],
        },
        blockedText:
          'Better to learn about the road before deciding what to carry — ask travelers in the market — and to have Rivka’s linen from Hadassah to pack with it.',
        effects: [{ type: 'openPuzzle', puzzle: 'p-satchel' }],
      },
    },
    {
      id: 'herbs',
      kind: 'feature',
      label: 'Herb baskets',
      sprite: 'basket',
      x: 3,
      y: 2,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'Bundles of dried herbs hang over baskets of seeds and roots. Aunt Miriam knows what every one is for.',
          },
        ],
      },
    },
  ],
  exits: [
    {
      id: 'house-door',
      label: 'the market',
      x: 7,
      y: 10,
      w: 2,
      h: 1,
      to: { scene: 'jerusalem-market', spawn: 'from-house' },
      requires: { type: 'questStatus', quest: 'q-remedy', status: 'active' },
      blockedText: 'Aunt Miriam is still talking to you.',
    },
  ],
  ambience: 'indoor',
  mood: 'home',
  music: 'home',
};

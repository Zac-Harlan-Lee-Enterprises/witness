import type { ChapterInput } from '@/domain/chapter';

const home = { type: 'not' as const, condition: { type: 'flag' as const, flag: 'returned' } };

/**
 * Grandmother Shelomit's house in Capernaum (interior). The chapter begins
 * here. The family and the house are fictional (record rec-pl-house).
 */
export const SHELOMIT_HOUSE: ChapterInput['scenes'][number] = {
  id: 'shelomit-house',
  name: 'Grandmother Shelomit’s house',
  kind: 'indoor',
  description:
    'A small fisher-family house in Capernaum. Nets hang by the wall, and Grandmother Shelomit sits mending one on a mat.',
  layout: [
    '################',
    '################',
    '#NN.os....bb.jj#',
    '#N.............#',
    '#...mmm........#',
    '#...mmm....tt.c#',
    '#..........tt..#',
    '#j.............#',
    '#jb.........rr.#',
    '#######DD#######',
  ],
  legend: {
    '#': 'wall',
    '.': 'floor',
    N: 'nets',
    o: 'oven',
    s: 'sacks',
    b: 'basket',
    j: 'jars',
    m: 'mat',
    t: 'table',
    c: 'crate',
    r: 'bedroll',
    D: 'door',
  },
  baseTile: 'floor',
  spawns: {
    start: { x: 7, y: 6, facing: 'up' },
    'from-shore': { x: 7, y: 8, facing: 'up' },
  },
  entities: [
    {
      id: 'shelomit',
      kind: 'npc',
      label: 'Grandmother Shelomit',
      characterId: 'shelomit',
      x: 5,
      y: 4,
      facing: 'down',
      pose: 'sit',
      visibleWhen: home,
      interaction: { verb: 'talk', dialogue: 'd-shelomit' },
    },
    {
      id: 'mending',
      kind: 'feature',
      label: 'The net Grandmother is mending',
      sprite: 'net-pile',
      x: 4,
      y: 5,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'A torn net across the mat, with the mended part pulled tight in neat new knots. Every family on the shore mends nets like this, all year round.',
          },
        ],
      },
    },
    {
      id: 'dried-fish',
      kind: 'feature',
      label: 'Baskets of dried fish',
      sprite: 'none',
      x: 10,
      y: 2,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'Small fish, salted and dried, packed in baskets for the winter. The whole house smells of the lake.',
          },
        ],
      },
    },
  ],
  exits: [
    {
      id: 'house-door',
      label: 'the shore',
      x: 7,
      y: 9,
      w: 2,
      h: 1,
      to: { scene: 'capernaum-shore', spawn: 'from-house' },
      requires: { type: 'questStatus', quest: 'q-crossing', status: 'active' },
      blockedText: 'Grandmother is still talking to you.',
    },
  ],
  ambience: 'indoor',
  mood: 'home',
  music: 'home',
};

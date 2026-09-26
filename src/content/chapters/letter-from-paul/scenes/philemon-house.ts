import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const kallias = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-kallias',
  option,
});

/**
 * Philemon's house, in the evening. Philemon 2 names "the assembly in your
 * house"; what the house looked like is unknown. This one is a RECONSTRUCTION
 * modelled on Roman-era houses of the region: a peristyle garden ringed by
 * columns, a dining room with couches and a mosaic floor, lamps on stands.
 *
 * Philemon, Tychicus and Onesimus stand here as silent figures: they have no
 * dialogue and cannot be talked to (see characters.ts).
 *
 * Nobody at the gathering stands just behind a column of the garden's far
 * row (one or two rows north of it, in line with it): the pre-rendered
 * column would hide their legs, as it truly would from where the camera is.
 */
export const PHILEMON_HOUSE: ChapterInput['scenes'][number] = {
  id: 'philemon-house',
  name: 'Philemon’s house',
  kind: 'indoor',
  description:
    'A house built around a garden courtyard ringed with columns. Lamps burn on tall stands, and the assembly is gathering in the dining room at the far end.',
  layout: [
    '##########################',
    '##########################',
    '#aa...YxkkkkkkkkkkxY...rr#',
    '#a.....xkxxxxxxxxkx......#',
    '#......xkxxxxxxxxkx.....t#',
    '#......xxxxxxxxxxxx......#',
    '#j.......................#',
    '#j....I..I..I..I..I......#',
    '#.......ggggggggg........#',
    '#.....I.ggggFgggg.I....o.#',
    '#.....I.ggggFgggg.I......#',
    '#L......ggggggggg.......j#',
    '#.....I..I..I..I..I.....j#',
    '#........................#',
    '#..Y......xxxxxx......Y..#',
    '#....uu...xxxxxx...uu....#',
    '#........................#',
    '############DD############',
  ],
  legend: {
    '#': 'wall',
    '.': 'floor',
    a: 'amphorae',
    Y: 'lampstand',
    x: 'mosaic',
    k: 'couch',
    r: 'bedroll',
    t: 'table',
    j: 'jars',
    I: 'column',
    g: 'garden',
    F: 'fountain',
    L: 'loom',
    o: 'oven',
    u: 'rug',
    D: 'door',
  },
  baseTile: 'floor',
  spawns: { 'from-street': { x: 12, y: 16, facing: 'up' } },
  entities: [
    {
      id: 'ammia-gathering',
      kind: 'npc',
      label: 'Ammia',
      characterId: 'ammia',
      x: 10,
      y: 5,
      facing: 'right',
      // Where she looks shows what you did at the bridge.
      looks: [
        { when: kallias('come-now'), facing: 'left' },
        { when: kallias('leave-it'), facing: 'down' },
      ],
      interaction: { verb: 'talk', dialogue: 'd-ammia-gathering' },
    },
    {
      id: 'kallias-gathering',
      kind: 'npc',
      label: 'Kallias',
      characterId: 'kallias',
      x: 8,
      y: 6,
      facing: 'right',
      visibleWhen: kallias('come-now'),
      // Home in the cloak Ammia kept for him — if you brought it.
      looks: [{ when: { type: 'flag', flag: 'kallias-cloak' }, marks: ['wrapped-in-cloak'] }],
      interaction: { verb: 'talk', dialogue: 'd-kallias-gathering' },
    },
    {
      id: 'reply-tablets',
      kind: 'feature',
      label: 'Kallias’s answer, on your tablets',
      sprite: 'tablets',
      x: 11,
      y: 5,
      solid: false,
      visibleWhen: kallias('carry-reply'),
    },
    {
      id: 'zenon-reader',
      kind: 'npc',
      label: 'Zenon',
      characterId: 'zenon',
      x: 13,
      y: 6,
      facing: 'down',
      interaction: { verb: 'talk', dialogue: 'd-zenon-gathering' },
    },
    {
      id: 'tatia-gathering',
      kind: 'npc',
      label: 'Tatia',
      characterId: 'tatia',
      x: 21,
      y: 10,
      facing: 'left',
      interaction: { verb: 'talk', dialogue: 'd-tatia-gathering' },
    },
    {
      id: 'hermon',
      kind: 'npc',
      label: 'Hermon',
      characterId: 'hermon',
      x: 20,
      y: 5,
      facing: 'left',
    },
    {
      id: 'melitta',
      kind: 'npc',
      label: 'Melitta',
      characterId: 'melitta',
      x: 4,
      y: 13,
      facing: 'right',
    },
    // People named in the New Testament: present, silent, not interactive.
    {
      id: 'philemon',
      kind: 'npc',
      label: 'Philemon',
      characterId: 'philemon',
      x: 13,
      y: 3,
      facing: 'down',
    },
    {
      id: 'tychicus',
      kind: 'npc',
      label: 'Tychicus',
      characterId: 'tychicus',
      x: 14,
      y: 5,
      facing: 'down',
    },
    {
      id: 'onesimus',
      kind: 'npc',
      label: 'Onesimus',
      characterId: 'onesimus',
      x: 16,
      y: 6,
      facing: 'down',
    },
    {
      id: 'guest-room',
      kind: 'feature',
      label: 'A made-up guest room',
      sprite: 'none',
      x: 23,
      y: 3,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'A small room off the courtyard, with sleeping mats laid out for the travellers.',
          },
        ],
      },
    },
  ],
  exits: [
    {
      id: 'to-street',
      label: 'the street',
      x: 12,
      y: 17,
      w: 2,
      h: 1,
      to: { scene: 'colossae-street', spawn: 'from-philemon' },
      requires: { type: 'flag', flag: 'seen:scripture-connection' },
      blockedText: 'The gathering is about to begin. Find Ammia first.',
    },
  ],
  triggers: [
    // As soon as you step inside (before you can walk anywhere): the gathering.
    {
      id: 'gathering-arrive',
      onceFlag: 'gathering-arrived',
      when: { type: 'always' },
      effects: [{ type: 'startDialogue', dialogue: 'd-gathering-arrive' }],
    },
  ],
  ambience: 'indoor',
  mood: 'home',
  music: 'reflection',
};

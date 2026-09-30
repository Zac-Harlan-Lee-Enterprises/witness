import type { ChapterInput } from '@/domain/chapter';

/** Ammia's house and dye workshop, Colossae (interior). The chapter begins here. */
export const AMMIA_WORKSHOP: ChapterInput['scenes'][number] = {
  id: 'ammia-workshop',
  name: 'Ammia’s dye workshop',
  kind: 'indoor',
  description:
    'A plastered workshop that smells of wet wool and madder root. Dye vats steam in rows; skeins of red wool hang drying along the back wall.',
  layout: [
    '######################',
    '######################',
    '#jj.o..t....CC..CC.aa#',
    '#b.....t............a#',
    '#........v..v..v.....#',
    '#..uuu...............#',
    '#..uuu...v..v..v.....#',
    '#m...................#',
    '#m................L..#',
    '#r....t.......ss.....#',
    '#r.c..t..........bb.b#',
    '#########DD###########',
  ],
  legend: {
    '#': 'wall',
    '.': 'floor',
    j: 'jars',
    o: 'oven',
    t: 'table',
    C: 'cloth',
    a: 'amphorae',
    b: 'basket',
    v: 'vat',
    u: 'rug',
    m: 'mat',
    r: 'bedroll',
    L: 'loom',
    s: 'sacks',
    c: 'crate',
    D: 'door',
  },
  baseTile: 'floor',
  spawns: {
    start: { x: 6, y: 6, facing: 'up' },
    'from-street': { x: 9, y: 10, facing: 'up' },
  },
  entities: [
    {
      id: 'ammia',
      kind: 'npc',
      label: 'Ammia',
      characterId: 'ammia',
      x: 11,
      y: 5,
      facing: 'down',
      // By evening she has gone to the gathering at Philemon's house.
      visibleWhen: { type: 'not', condition: { type: 'flag', flag: 'back-in-town' } },
      interaction: { verb: 'talk', dialogue: 'd-ammia' },
    },
    {
      id: 'bag',
      kind: 'feature',
      label: 'Travel bag',
      sprite: 'pack',
      x: 4,
      y: 8,
      visibleWhen: { type: 'not', condition: { type: 'flag', flag: 'packed' } },
      interaction: {
        verb: 'use',
        requires: { type: 'hasItem', item: 'ammia-letter' },
        blockedText:
          'The travel bag. There’s nothing to carry anywhere yet — first find out what Kallias’s letter says.',
        effects: [{ type: 'startDialogue', dialogue: 'd-bag' }],
      },
    },
    {
      id: 'spoiled-wool',
      kind: 'feature',
      label: 'The spoiled batch',
      sprite: 'wool',
      x: 14,
      y: 3,
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'setFlag', flag: 'saw-spoiled-wool', value: true },
          {
            type: 'showMessage',
            text: 'A few skeins from the ruined batch still hang on a peg: a dull, blotchy red, nothing like the clear colour on the drying lines. Ammia kept them. You’re not sure why.',
          },
        ],
      },
    },
    {
      id: 'madder',
      kind: 'feature',
      label: 'Baskets of madder root',
      sprite: 'none',
      x: 1,
      y: 3,
      solid: true,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'Dried madder roots, chopped and ready. Boiled gently, they give the red that Ammia’s wool is known for up and down the street.',
          },
        ],
      },
    },
  ],
  exits: [
    {
      id: 'workshop-door',
      label: 'the street',
      x: 9,
      y: 11,
      w: 2,
      h: 1,
      to: { scene: 'colossae-street', spawn: 'from-workshop' },
      requires: { type: 'questStatus', quest: 'q-letters', status: 'active' },
      blockedText: 'Ammia is still talking to you.',
    },
  ],
  ambience: 'indoor',
  mood: 'home',
  music: 'home',
  weatherChanges: [
    { when: { type: 'flag', flag: 'rain-began' }, weather: 'rain' },
    { when: { type: 'flag', flag: 'back-in-town' }, weather: 'clear' },
  ],
};

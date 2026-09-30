import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const kallias = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-kallias',
  option,
});
const bundleDelivered: Condition = {
  type: 'questStatus',
  quest: 'q-bundle',
  status: 'completed',
};

/**
 * The road down the Lycus valley toward Laodicea. The Roman highway, the
 * milestones' numbers, the bridge, the dye works and the waystation are
 * FICTIONAL details (record rec-rec-road); the white terraces of Hierapolis
 * across the valley are real.
 */
export const LYCUS_ROAD: ChapterInput['scenes'][number] = {
  id: 'lycus-road',
  name: 'The Laodicea road',
  kind: 'outdoor',
  description:
    'A paved highway runs west down the green Lycus valley toward Laodicea. North of the road, a bridge crosses the river beside a dye works; far across the valley, a white hillside shines.',
  layout: [
    'XXXXXXXXXXXXXXXXXXXXXHHHHHHHHHHHHHHHHHHHHHHHHH',
    'XXXXXXXXXXXXXXXXXXXXXHHHHHHHHHHHHHHHHHHHHHHHHH',
    'HXXXXXXHXXXXXHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    ',,f,,,,,,,,,==,f,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    ',,,qqqqqqq,,==,,,qqqqqqqq,,f,,ddddddddd,,,,,,,',
    ',,,qqqqqqq,,==,,,qqqqqqqq,,,,,ddddddddd,,f,,,,',
    ',,,,,,,,,,,,==,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'RRRRR,,RRRRR==RRRRRR,,RRRRRRRRRRR,,RRRRRRRRRRR',
    'wwwwwwwwwwwwBBwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwBBwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
    'RR,,,,,,,,,,==,,,,,,,RRRRR,,RRRRRRRRRRRR,,RRRR',
    ',lTTTTTT,v,,==,v,,v,,,,,,TTTTTTTTTTT,lllllll,,',
    ',l###D##,,,,==,,,,,,,,,,,TTTTTTTTTTT,l,,h,,l,,',
    ',l,,,,,,,,v,==,,CC,aa,,,,#####D#####,l,,,,,l,,',
    ',,,,,,,,,,,,==,,,,,,M,,,,,,,,,,,,,,,,,M,,,,,,,',
    'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
    'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
    ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,b,,,',
    ',b,,,,,,,,,,,,,dddddddd,f,,,,,,,,,,,,,,,,,,,,,',
    ',,,qqqqqqqqq,,,dddddddd,,,,qqqqqqqqqq,,,,,,,,,',
    ',,,qqqqqqqqq,,,dddddddd,,,,qqqqqqqqqq,,,f,,,,,',
    ',,,qqqqqqqqq,,,,,,,,,,,,,,,qqqqqqqqqq,,,,,,,,,',
    ',,,,,,,,,,,,,f,,,,,,,,,,,,,qqqqqqqqqq,,,,,,,,,',
    ',,,,,,,,,,,,,,,,,,,,,,,,,b,,,,,,,,,,,,,,,,,,,,',
    ',,,,,,f,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,b,,,,,,',
    'HHHH,HHHHHHHHHHHHHHH,HHHHHHHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  ],
  legend: {
    X: 'travertine',
    H: 'hill',
    ',': 'grass',
    f: 'fig',
    q: 'crops',
    d: 'soil',
    '=': 'road',
    R: 'reeds',
    w: 'water',
    B: 'bridge',
    T: 'tile-roof',
    '#': 'wall',
    D: 'door',
    l: 'fence',
    v: 'vat',
    C: 'cloth',
    a: 'amphorae',
    h: 'trough',
    M: 'milestone',
    r: 'roman-road',
    b: 'bush',
  },
  baseTile: 'grass',
  spawns: { 'from-colossae': { x: 44, y: 15, facing: 'left' } },
  entities: [
    // ── Along the highway ─────────────────────────────────────────────────
    {
      id: 'milestone-east',
      kind: 'sign',
      label: 'A milestone',
      sprite: 'none',
      x: 38,
      y: 14,
      solid: true,
      interaction: {
        verb: 'read',
        effects: [
          { type: 'setFlag', flag: 'read-milestone', value: true },
          {
            type: 'showMessage',
            text: 'A stone column at the roadside, cut with lines of Latin and then Greek — mostly the names and titles of the emperor. At the bottom, a number: IIII. Four miles.',
          },
        ],
      },
    },
    {
      id: 'milestone-west',
      kind: 'sign',
      label: 'Another milestone',
      sprite: 'none',
      x: 20,
      y: 14,
      solid: true,
      interaction: {
        verb: 'read',
        effects: [
          { type: 'setFlag', flag: 'read-milestone', value: true },
          {
            type: 'showMessage',
            text: 'Another milestone, the same words, a new number: V. Kallias’s letter said the number had run in the rain — but the bridge is right here.',
          },
        ],
      },
    },
    {
      id: 'laodicea-sign',
      kind: 'sign',
      label: 'The road on to Laodicea',
      sprite: 'sign',
      x: 1,
      y: 14,
      interaction: {
        verb: 'read',
        effects: [
          {
            type: 'showMessage',
            text: 'The highway runs on west to Laodicea, and far beyond it to Ephesus and the sea. Your errand ends at the bridge.',
          },
        ],
      },
    },
    {
      id: 'hierapolis-view',
      kind: 'sign',
      label: 'The white hillside across the valley',
      sprite: 'none',
      x: 11,
      y: 10,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'setFlag', flag: 'saw-hierapolis', value: true },
          {
            type: 'showMessage',
            text: 'Far across the river, a whole hillside is white, as if it were made of salt: stone terraces left by hot springs, below the city of Hierapolis.',
          },
        ],
      },
    },
    // ── The dye works by the bridge ───────────────────────────────────────
    {
      id: 'kallias',
      kind: 'npc',
      label: 'Kallias',
      characterId: 'kallias',
      x: 11,
      y: 12,
      facing: 'down',
      // Once he has set off home with you, his place at the vat is empty.
      visibleWhen: not(kallias('come-now')),
      interaction: { verb: 'talk', dialogue: 'd-kallias' },
    },
    {
      id: 'nikon',
      kind: 'npc',
      label: 'Nikon the overseer',
      characterId: 'nikon',
      x: 17,
      y: 12,
      facing: 'left',
      interaction: { verb: 'talk', dialogue: 'd-nikon' },
    },
    {
      id: 'chrysis',
      kind: 'npc',
      label: 'Chrysis',
      characterId: 'chrysis',
      x: 9,
      y: 12,
      facing: 'up',
      interaction: { verb: 'talk', dialogue: 'd-chrysis' },
    },
    {
      id: 'alum-jars',
      kind: 'feature',
      label: 'The test skein and the vats',
      sprite: 'vessels',
      x: 14,
      y: 11,
      visibleWhen: not({ type: 'puzzleSolved', puzzle: 'p-alum' }),
      interaction: {
        verb: 'use',
        requires: flag('alum-task'),
        blockedText:
          'A skein of wool hangs by the madder vat, half dyed. Someone is in the middle of a job.',
        effects: [{ type: 'openPuzzle', puzzle: 'p-alum' }],
      },
    },
    {
      id: 'alum-bath',
      kind: 'feature',
      label: 'The test skein, matched',
      sprite: 'vessels',
      x: 14,
      y: 11,
      visibleWhen: { type: 'puzzleSolved', puzzle: 'p-alum' },
    },
    {
      id: 'drying-skein',
      kind: 'feature',
      label: 'A red skein drying',
      sprite: 'wool',
      x: 8,
      y: 13,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'A skein of wool drying on a pole: a clear, even red. Kallias has learned something since the winter.',
          },
        ],
      },
    },
    // ── The waystation ────────────────────────────────────────────────────
    {
      id: 'waystation',
      kind: 'sign',
      label: 'The waystation',
      sprite: 'none',
      x: 30,
      y: 13,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'A waystation for travellers and their animals: a room to sleep in, a yard, a trough, and a roof to stand under when it rains.',
          },
        ],
      },
    },
    {
      id: 'attalos-road',
      kind: 'npc',
      label: 'Attalos',
      characterId: 'attalos',
      x: 39,
      y: 13,
      facing: 'down',
      // Waiting out the rain, as he said he would — if you helped him.
      visibleWhen: bundleDelivered,
      interaction: { verb: 'talk', dialogue: 'd-attalos-road' },
    },
    {
      id: 'attalos-mule',
      kind: 'feature',
      label: 'Attalos’s mule',
      sprite: 'pack-donkey',
      x: 41,
      y: 13,
      visibleWhen: bundleDelivered,
    },
  ],
  exits: [
    {
      id: 'to-colossae',
      label: 'the road back to Colossae',
      x: 45,
      y: 15,
      w: 1,
      h: 2,
      to: { scene: 'colossae-street', spawn: 'from-road' },
      effects: [{ type: 'adjustCounter', counter: 'hour', delta: 2 }],
    },
  ],
  triggers: [
    {
      id: 'setting-out',
      area: { x: 40, y: 14, w: 5, h: 3 },
      onceFlag: 'setting-out',
      effects: [
        {
          type: 'showMessage',
          text: 'The highway runs straight down the valley between its kerbstones. Somewhere ahead, past the milestones, is the bridge.',
        },
      ],
    },
    // Halfway down: the rain arrives, and it has been a long walk.
    {
      id: 'shower',
      // Every way west passes through this band: north of it is the waystation.
      area: { x: 30, y: 14, w: 2, h: 11 },
      onceFlag: 'shower',
      effects: [
        { type: 'setFlag', flag: 'rain-began', value: true },
        { type: 'adjustCounter', counter: 'hour', delta: 2 },
        {
          type: 'showMessage',
          text: 'Two hours down the road, rain comes sweeping along the valley from the mountain behind you.',
        },
      ],
    },
    {
      id: 'shower-letter',
      area: { x: 30, y: 14, w: 2, h: 11 },
      onceFlag: 'letter-wet',
      when: {
        type: 'all',
        of: [
          not({ type: 'hasItem', item: 'letter-case' }),
          not({ type: 'hasItem', item: 'hooded-cloak' }),
        ],
      },
      effects: [
        {
          type: 'showMessage',
          text: 'You have nothing to keep Ammia’s letter dry. You hold it against your chest, but you can feel the papyrus going soft.',
        },
      ],
    },
    {
      id: 'dye-works',
      area: { x: 2, y: 13, w: 18, h: 2 },
      onceFlag: 'reached-dye-works',
      effects: [
        {
          type: 'showMessage',
          text: 'The bridge, and beside it a dye works: vats, wet wool on the lines, and someone you know bent over a vat.',
        },
      ],
    },
  ],
  ambience: 'oasis',
  mood: 'oasis',
  music: 'journey',
  weather: 'clear',
  weatherChanges: [{ when: flag('rain-began'), weather: 'rain' }],
};

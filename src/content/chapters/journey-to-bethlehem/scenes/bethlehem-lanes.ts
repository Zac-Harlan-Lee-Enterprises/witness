import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const all = (...of: Condition[]): Condition => ({ type: 'all', of });
const stranger = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-stranger',
  option,
});
/** The registration runs through the afternoon; by the time you are back from the fold it has packed up. */
const daytime: Condition = not({ type: 'choiceMade', choice: 'choice-lamb' });

/**
 * The lanes of Bethlehem, crowded for the registration. A FICTIONAL picture
 * of the village (record rec-pl-lanes): houses along the lane, a paved
 * square by the east gate with the well and the clerk's table, Hagit's
 * house and goat yard, and a threshing floor at the windy edge of the
 * village above the terraces.
 */
export const BETHLEHEM_LANES: ChapterInput['scenes'][number] = {
  id: 'bethlehem-lanes',
  name: 'The lanes of Bethlehem',
  kind: 'outdoor',
  description:
    'Stone houses crowd a lane full of people who have come to be registered. In the square by the east gate there is a well and a clerk’s table; beyond the houses, a threshing floor looks out over the terraces.',
  layout: [
    'T^^^^^^^^^T,^^^^^^^^^,T^^^^^^^^^^^,,,,',
    '.^^^^^^^^^..^^^^^^^^^..^^^^^^^^^^^,T,,',
    '.^^^^^^^^^..^^^^^^^^^..^^^^^^^^^^^,,,,',
    '.####D####..####D####..######D####...#',
    '.j.......b..k.......j..C.........k...#',
    '.....................................#',
    ',..rr..a..............===k==c=======j#',
    'T.....................====tt=========#',
    ',..............mm.b...===============#',
    ',...........T.........==========W====g',
    ',....rr...T...........===============g',
    'T................C....===============#',
    ',^^^^^^^^.............=j=============#',
    ',^^^^^^^^....k........==============b#',
    ',^^^^^^^^............................#',
    ',#####D##...^^^^^^^^..............B,,#',
    ',oj.........^^^^^^^^..............,,,#',
    ',llll.llll..^^^^^^^^....,xxxxxxxx,,,,#',
    ',lh,,,,,hl..###D####....xxxxxxxxhx,,,#',
    ',l,,,,,,,l..b......k....xxxxxxxxxx,,B#',
    ',l,,,,,,hl,,,,,,,,,,,T,.xxxxxxxxxx,,,#',
    ',lllllllll,T,,,,,,T,,,,.xhxxxxxxxx,,,#',
    ',.........,,,,T,,,,,,,,.,xxxxhxxx,,,,#',
    'eeeeeeeeeeeeeeeeeeeee,,eeeeeeeeeeeeee#',
  ],
  legend: {
    '#': 'wall',
    '^': 'roof',
    D: 'door',
    g: 'gate',
    '.': 'sand',
    ',': 'scrub',
    '=': 'paving',
    x: 'threshing',
    W: 'well',
    t: 'table',
    T: 'olive',
    B: 'bush',
    l: 'fence',
    e: 'terrace',
    h: 'hay',
    k: 'sacks',
    b: 'basket',
    j: 'jars',
    c: 'crate',
    o: 'oven',
    C: 'cloth',
    // Travellers who found no room indoors sleep out in the lane.
    r: 'bedroll',
    m: 'mat',
    a: 'cart',
  },
  baseTile: 'sand',
  spawns: {
    'from-house': { x: 5, y: 4, facing: 'down' },
    'from-fields': { x: 36, y: 9, facing: 'left' },
  },
  entities: [
    // ── The square by the east gate ─────────────────────────────────────
    {
      id: 'amram',
      kind: 'npc',
      label: 'Saba Amram',
      characterId: 'amram',
      x: 25,
      y: 7,
      facing: 'down',
      visibleWhen: daytime,
      interaction: { verb: 'talk', dialogue: 'd-amram' },
    },
    {
      id: 'kallias',
      kind: 'npc',
      label: 'Kallias the clerk',
      characterId: 'kallias',
      x: 27,
      y: 6,
      facing: 'down',
      visibleWhen: daytime,
      interaction: { verb: 'talk', dialogue: 'd-kallias' },
    },
    {
      id: 'model-tablet',
      kind: 'clue',
      label: 'The clerk’s finished tablet',
      sprite: 'tablet',
      x: 26,
      y: 7,
      visibleWhen: daytime,
      interaction: {
        verb: 'read',
        effects: [
          { type: 'discoverClue', clue: 'clue-model-order' },
          {
            type: 'showMessage',
            text: 'A finished declaration, scratched in wax: first the person declaring, then the town where the household is registered, then everyone in the household with their ages, then what they own — and last a promise that it is all true.',
          },
        ],
      },
    },
    {
      id: 'blank-tablet',
      kind: 'feature',
      label: 'The clerk’s blank tablet',
      sprite: 'tablet',
      x: 27,
      y: 7,
      visibleWhen: all(daytime, not({ type: 'puzzleSolved', puzzle: 'p-register' })),
      interaction: { verb: 'use', dialogue: 'd-register' },
    },
    {
      id: 'asa-queue',
      kind: 'npc',
      label: 'Uncle Asa, waiting in line',
      characterId: 'asa',
      x: 27,
      y: 10,
      facing: 'up',
      visibleWhen: all(daytime, not({ type: 'puzzleSolved', puzzle: 'p-register' })),
      interaction: { verb: 'talk', dialogue: 'd-asa-queue' },
    },
    {
      id: 'well',
      kind: 'feature',
      label: 'The well by the gate',
      sprite: 'none',
      x: 32,
      y: 9,
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'setFlag', flag: 'saw-well', value: true },
          {
            type: 'showMessage',
            text: 'The village well by the east gate. People are waiting for water as well as for the clerk.',
          },
        ],
      },
    },
    {
      id: 'zerah-well',
      kind: 'npc',
      label: 'Zerah, by the well',
      characterId: 'zerah',
      x: 31,
      y: 10,
      facing: 'up',
      pose: 'lie',
      visibleWhen: stranger('no-room'),
      interaction: { verb: 'talk', dialogue: 'd-zerah-lane' },
    },
    {
      id: 'gate-sign',
      kind: 'sign',
      label: 'The east gate',
      sprite: 'sign',
      x: 35,
      y: 8,
      interaction: {
        verb: 'read',
        effects: [
          {
            type: 'showMessage',
            text: 'The east gate. The path beyond drops down the terraces to the fields and the village sheepfold.',
          },
        ],
      },
    },
    // ── Hagit's house and goats ─────────────────────────────────────────
    {
      id: 'hagit',
      kind: 'npc',
      label: 'Hagit',
      characterId: 'hagit',
      x: 4,
      y: 16,
      facing: 'down',
      interaction: { verb: 'talk', dialogue: 'd-hagit' },
    },
    {
      id: 'zerah-hagit',
      kind: 'npc',
      label: 'Zerah, at Hagit’s door',
      characterId: 'zerah',
      x: 5,
      y: 16,
      facing: 'down',
      pose: 'sit',
      visibleWhen: stranger('hagit'),
      interaction: { verb: 'talk', dialogue: 'd-zerah-lane' },
    },
    // ── Travellers camped in the lane ───────────────────────────────────
    {
      id: 'camp',
      kind: 'feature',
      label: 'Bedrolls in the lane',
      sprite: 'none',
      x: 5,
      y: 9,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'Bedrolls and bundles along the wall, where travellers who found no room indoors will sleep tonight. A child’s sandal has been left on top of one, to keep the place.',
          },
        ],
      },
    },
    {
      id: 'lane-donkey',
      kind: 'feature',
      label: 'A traveller’s donkey',
      sprite: 'pack-donkey',
      x: 9,
      y: 7,
    },
    {
      id: 'lane-donkey-2',
      kind: 'feature',
      label: 'A tethered donkey',
      sprite: 'donkey',
      x: 2,
      y: 9,
    },
    { id: 'goat-1', kind: 'feature', label: 'Hagit’s goat', sprite: 'goat', x: 4, y: 19 },
    { id: 'goat-2', kind: 'feature', label: 'Hagit’s goat', sprite: 'goat', x: 6, y: 18 },
    {
      id: 'kid-home',
      kind: 'feature',
      label: 'Hagit’s white kid, home again',
      sprite: 'goat',
      x: 3,
      y: 20,
      visibleWhen: flag('kid-home'),
    },
    // ── Where Hagit's kid has been (the kid puzzle's places) ───────────
    {
      id: 'cart-barley',
      kind: 'feature',
      label: 'Barley spilled by the travellers’ cart',
      sprite: 'none',
      x: 8,
      y: 6,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'Barley has spilled from a torn sack on the travellers’ cart. Someone small has been nibbling it — there are tiny split hoofprints in the spill.',
          },
        ],
      },
    },
    {
      id: 'washing',
      kind: 'feature',
      label: 'Washing by the square',
      sprite: 'none',
      x: 17,
      y: 12,
      solid: false,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'A traveller’s washing hangs out to dry. One blue cloth has a corner chewed ragged.',
          },
        ],
      },
    },
    {
      id: 'kid',
      kind: 'feature',
      label: 'Hagit’s white kid',
      sprite: 'goat',
      x: 29,
      y: 20,
      visibleWhen: all(
        { type: 'puzzleSolved', puzzle: 'p-kid' },
        not(flag('carrying-kid')),
        not(flag('kid-home')),
      ),
      interaction: {
        verb: 'take',
        effects: [
          { type: 'setFlag', flag: 'carrying-kid', value: true },
          { type: 'setFlag', flag: 'saw-threshing', value: true },
          {
            type: 'showMessage',
            text: 'The kid is up to her knees in chaff at the edge of the threshing floor, chewing. She lets you pick her up without a fuss — she’s had a very full afternoon. Take her back to Hagit.',
          },
        ],
      },
    },
    // ── The threshing floor ─────────────────────────────────────────────
    {
      id: 'threshing-floor',
      kind: 'feature',
      label: 'The threshing floor',
      sprite: 'none',
      x: 25,
      y: 21,
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'setFlag', flag: 'saw-threshing', value: true },
          {
            type: 'showMessage',
            text: 'A wide, hard floor at the windy edge of the village, where barley is threshed and then tossed up so the wind blows the chaff away. Chaff drifts in the corners.',
          },
        ],
      },
    },
    {
      id: 'straw-heap',
      kind: 'feature',
      label: 'Heap of clean straw',
      sprite: 'none',
      x: 32,
      y: 18,
      interaction: {
        verb: 'take',
        requires: not(flag('took-straw')),
        blockedText: 'You already have an armful of straw.',
        effects: [
          { type: 'giveItem', item: 'straw' },
          { type: 'setFlag', flag: 'took-straw', value: true },
          { type: 'setFlag', flag: 'saw-threshing', value: true },
          { type: 'showMessage', text: 'You gather an armful of clean straw.' },
        ],
      },
    },
  ],
  exits: [
    {
      id: 'to-house',
      label: 'Tamar’s house',
      x: 5,
      y: 3,
      w: 1,
      h: 1,
      to: { scene: 'tamar-house', spawn: 'from-lanes' },
    },
    {
      id: 'to-fields',
      label: 'the east gate (down to the fold)',
      x: 37,
      y: 9,
      w: 1,
      h: 2,
      to: { scene: 'shepherds-fields', spawn: 'from-village' },
      requires: all(flag('supper-given'), flag('got-milk')),
      blockedText:
        'Tamar asked you to get a jar of milk for Dodi from Hagit before you go down to the fold. Hagit lives by the goat yard, at the south-west end of the lanes.',
      effects: [{ type: 'adjustCounter', counter: 'hour', delta: 1 }],
    },
  ],
  triggers: [
    {
      id: 'lanes-intro',
      onceFlag: 'lanes-intro',
      when: { type: 'visited', scene: 'bethlehem-lanes' },
      effects: [{ type: 'startDialogue', dialogue: 'd-lanes-intro' }],
    },
  ],
  ambience: 'market',
  mood: 'city',
  music: 'home',
  weather: 'clear',
};

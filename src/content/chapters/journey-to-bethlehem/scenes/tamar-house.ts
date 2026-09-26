import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';
import { ROOM_ITEMS } from '../items';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const all = (...of: Condition[]): Condition => ({ type: 'all', of });
const any = (...of: Condition[]): Condition => ({ type: 'any', of });
const solved = (puzzle: string): Condition => ({ type: 'puzzleSolved', puzzle });
const chose = (choice: string, option?: string): Condition =>
  option === undefined ? { type: 'choiceMade', choice } : { type: 'choiceMade', choice, option };
const room = (option: string) => chose('choice-room', option);
const stranger = (option: string) => chose('choice-stranger', option);
const questActive: Condition = { type: 'questStatus', quest: 'q-room', status: 'active' };

/** In the guest room until the room is arranged; afterwards only if you kept it there. */
const inGuestRoom = (option: string): Condition => any(not(solved('p-room')), room(option));
/** Moved down to the animals' end once the room is arranged without it. */
const movedDown = (option: string): Condition => all(solved('p-room'), not(room(option)));
/** Asleep once the evening has come; sitting up again if you woke the house. */
const sleepsAtNight = [
  { when: flag('evening'), pose: 'lie' as const },
  { when: flag('house-awake'), pose: 'sit' as const },
];

/**
 * Tamar's house (interior): a FICTIONAL village house built the way many
 * scholars reconstruct one (record rec-recon-house). West: the lower,
 * straw-strewn end where the animals sleep, with stone mangers along the
 * edge of the raised family floor and steps up. Centre: the raised family
 * floor with the oven, rug and mats. East, through a doorway: the small
 * guest room. The single door opens onto the lane at the animals' end.
 */
export const TAMAR_HOUSE: ChapterInput['scenes'][number] = {
  id: 'tamar-house',
  name: 'Tamar’s house, Bethlehem',
  kind: 'indoor',
  description:
    'A village house crowded with guests. At one end the animals stand in the straw below stone mangers; a step up is the family floor with the oven; through a doorway is the small guest room.',
  layout: [
    '##########################',
    '##########################',
    '#h,,,,,M..jj....o.b#rr.rr#',
    '#,,,,,,M...........#.....#',
    '#,,,,,,M..uuuu.....#.....#',
    '#,,,,,,M..uuuu...........#',
    '#,,,,,,M...........#.....#',
    '#h,,,,,=..........t#.....#',
    '#,,,,,,=...........#.....#',
    '#c,,,,,M....mm.....#.....#',
    '#####DD###################',
  ],
  legend: {
    '#': 'wall',
    ',': 'straw',
    '.': 'platform',
    '=': 'steps',
    M: 'manger',
    h: 'hay',
    c: 'crate',
    j: 'jars',
    o: 'oven',
    b: 'basket',
    t: 'table',
    u: 'rug',
    m: 'mat',
    r: 'bedroll',
    D: 'door',
  },
  baseTile: 'platform',
  spawns: {
    start: { x: 13, y: 6, facing: 'up' },
    'from-lanes': { x: 5, y: 9, facing: 'up' },
  },
  entities: [
    // ── The family floor ────────────────────────────────────────────────
    {
      id: 'tamar',
      kind: 'npc',
      label: 'Tamar',
      characterId: 'tamar',
      x: 14,
      y: 3,
      facing: 'down',
      looks: [{ when: flag('evening'), pose: 'sit' }],
      interaction: { verb: 'talk', dialogue: 'd-tamar' },
    },
    {
      id: 'kneading',
      kind: 'feature',
      label: 'Kneading trough and flour jar',
      sprite: 'kneading-trough',
      x: 15,
      y: 2,
      visibleWhen: not(solved('p-bread')),
      interaction: {
        verb: 'use',
        requires: questActive,
        blockedText: 'The kneading trough, the flour jar and the old grain basket.',
        effects: [{ type: 'openPuzzle', puzzle: 'p-bread' }],
      },
    },
    {
      id: 'bread',
      kind: 'feature',
      label: 'Fresh bread',
      sprite: 'bread-cloth',
      x: 15,
      y: 2,
      visibleWhen: solved('p-bread'),
      interaction: {
        verb: 'examine',
        effects: [{ type: 'showMessage', text: 'Warm bread under a cloth. It smells wonderful.' }],
      },
    },
    {
      id: 'ladder',
      kind: 'feature',
      label: 'Ladder to the roof',
      sprite: 'ladder',
      x: 8,
      y: 2,
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'setFlag', flag: 'roof-store-known', value: true },
          {
            type: 'showMessage',
            text: 'A ladder leads up to the flat roof. Up there, under a lean-to of reed matting, there’s a dry corner — the barley jars would keep there.',
          },
        ],
      },
    },
    {
      id: 'amram-home',
      kind: 'npc',
      label: 'Saba Amram',
      characterId: 'amram',
      x: 10,
      y: 8,
      facing: 'right',
      pose: 'sit',
      looks: sleepsAtNight,
      visibleWhen: chose('choice-lamb'),
      interaction: { verb: 'talk', dialogue: 'd-amram-home' },
    },
    {
      id: 'your-mat',
      kind: 'feature',
      label: 'Your sleeping mat',
      sprite: 'bedroll',
      x: 16,
      y: 8,
      solid: false,
      visibleWhen: not(stranger('own-place')),
      interaction: { verb: 'use', dialogue: 'd-night-news' },
    },
    {
      id: 'zerah-hearth',
      kind: 'npc',
      label: 'Zerah, asleep by the fire',
      characterId: 'zerah',
      x: 16,
      y: 8,
      facing: 'left',
      pose: 'lie',
      looks: [{ when: flag('house-awake'), pose: 'sit' }],
      visibleWhen: stranger('own-place'),
      interaction: { verb: 'talk', dialogue: 'd-zerah' },
    },
    // ── The animals' end ────────────────────────────────────────────────
    {
      id: 'manger',
      kind: 'feature',
      label: 'The stone mangers',
      sprite: 'none',
      x: 7,
      y: 4,
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'setFlag', flag: 'saw-manger', value: true },
          {
            type: 'showMessage',
            text: 'Feeding troughs cut from stone, set along the edge of the family floor. From down in the straw, the donkeys can reach the fodder.',
          },
        ],
      },
    },
    { id: 'donkey', kind: 'feature', label: 'The family donkey', sprite: 'donkey', x: 2, y: 4 },
    {
      id: 'asa-donkey',
      kind: 'feature',
      label: 'Uncle Asa’s donkey',
      sprite: 'pack-donkey',
      x: 2,
      y: 6,
    },
    { id: 'goat', kind: 'feature', label: 'The milk goat', sprite: 'goat', x: 4, y: 3 },
    {
      id: 'stable-loom',
      kind: 'feature',
      label: 'Tamar’s loom, moved down by the animals',
      sprite: 'loom',
      x: 5,
      y: 2,
      visibleWhen: movedDown('kept-loom'),
    },
    {
      id: 'stable-tools',
      kind: 'feature',
      label: 'Uncle Asa’s tools, moved down by the animals',
      sprite: 'tool-bag',
      x: 2,
      y: 9,
      visibleWhen: movedDown('kept-tools'),
    },
    {
      id: 'your-straw',
      kind: 'feature',
      label: 'Your bed in the straw',
      sprite: 'straw-bed',
      x: 4,
      y: 8,
      solid: false,
      visibleWhen: stranger('own-place'),
      interaction: { verb: 'use', dialogue: 'd-night-news' },
    },
    {
      id: 'straw-bed',
      kind: 'feature',
      label: 'A bed of fresh straw',
      sprite: 'straw-bed',
      x: 3,
      y: 7,
      solid: false,
      visibleWhen: stranger('straw-bed'),
    },
    {
      id: 'zerah-straw',
      kind: 'npc',
      label: 'Zerah, asleep in the straw',
      characterId: 'zerah',
      x: 3,
      y: 7,
      facing: 'right',
      pose: 'lie',
      looks: [{ when: flag('house-awake'), pose: 'sit' }],
      visibleWhen: stranger('straw-bed'),
      interaction: { verb: 'talk', dialogue: 'd-zerah' },
    },
    {
      id: 'zerah-door',
      kind: 'npc',
      label: 'The old man at the door',
      characterId: 'zerah',
      x: 6,
      y: 8,
      facing: 'up',
      visibleWhen: all(flag('zerah-arrived'), not(chose('choice-stranger'))),
      interaction: { verb: 'talk', dialogue: 'd-zerah' },
    },
    {
      id: 'hagit-door',
      kind: 'npc',
      label: 'Hagit, at the door with her lamp',
      characterId: 'hagit',
      x: 5,
      y: 8,
      facing: 'up',
      visibleWhen: all(flag('hagit-at-door'), not(chose('choice-news'))),
    },
    // ── The guest room ──────────────────────────────────────────────────
    {
      id: 'peninah',
      kind: 'npc',
      label: 'Aunt Peninah',
      characterId: 'peninah',
      x: 23,
      y: 3,
      facing: 'left',
      pose: 'sit',
      looks: sleepsAtNight,
      interaction: { verb: 'talk', dialogue: 'd-peninah' },
    },
    {
      id: 'dodi',
      kind: 'npc',
      label: 'Little Dodi',
      characterId: 'dodi',
      x: 24,
      y: 2,
      facing: 'left',
      pose: 'lie',
      interaction: { verb: 'talk', dialogue: 'd-dodi' },
    },
    {
      id: 'asa-home',
      kind: 'npc',
      label: 'Uncle Asa',
      characterId: 'asa',
      x: 21,
      y: 3,
      facing: 'down',
      pose: 'sit',
      looks: sleepsAtNight,
      // Home early if you helped the clerk; otherwise not until the day's work is done.
      visibleWhen: any(solved('p-register'), chose('choice-lamb')),
      interaction: { verb: 'talk', dialogue: 'd-asa-home' },
    },
    {
      id: 'bedding',
      kind: 'feature',
      label: 'Guests’ things to arrange',
      sprite: 'bedroll',
      x: 21,
      y: 5,
      visibleWhen: not(solved('p-room')),
      interaction: {
        verb: 'use',
        requires: questActive,
        blockedText: 'Bedding, bundles and jars, all waiting to be sorted.',
        effects: [
          ...ROOM_ITEMS.map((item) => ({ type: 'giveItem' as const, item })),
          { type: 'openPuzzle', puzzle: 'p-room' },
        ],
      },
    },
    {
      id: 'guest-loom',
      kind: 'feature',
      label: 'Tamar’s loom',
      sprite: 'loom',
      x: 20,
      y: 7,
      visibleWhen: inGuestRoom('kept-loom'),
    },
    {
      id: 'guest-grain',
      kind: 'feature',
      label: 'Jars of barley',
      sprite: 'grain-jars',
      x: 24,
      y: 7,
      visibleWhen: inGuestRoom('kept-grain'),
    },
    {
      id: 'guest-tools',
      kind: 'feature',
      label: 'Uncle Asa’s tools',
      sprite: 'tool-bag',
      x: 20,
      y: 9,
      visibleWhen: inGuestRoom('kept-tools'),
    },
    {
      id: 'spare-mat',
      kind: 'feature',
      label: 'The space you left',
      sprite: 'bedroll',
      x: 22,
      y: 8,
      solid: false,
      visibleWhen: room('made-space'),
    },
    {
      id: 'zerah-guest',
      kind: 'npc',
      label: 'Zerah, asleep in the guest room',
      characterId: 'zerah',
      x: 22,
      y: 8,
      facing: 'left',
      pose: 'lie',
      looks: [{ when: flag('house-awake'), pose: 'sit' }],
      visibleWhen: stranger('guest-room'),
      interaction: { verb: 'talk', dialogue: 'd-zerah' },
    },
  ],
  exits: [
    {
      id: 'to-lanes',
      label: 'the lane',
      x: 5,
      y: 10,
      w: 2,
      h: 1,
      to: { scene: 'bethlehem-lanes', spawn: 'from-house' },
      requires: flag('supper-given'),
      blockedDialogue: 'd-door-blocked',
    },
  ],
  triggers: [
    {
      // Back from the fold: supper, lamps, and a knock at the door.
      id: 'evening',
      onceFlag: 'evening-trigger',
      when: all(chose('choice-lamb'), not(flag('evening'))),
      effects: [{ type: 'startDialogue', dialogue: 'd-evening' }],
    },
  ],
  ambience: 'indoor',
  mood: 'home',
  music: 'home',
};

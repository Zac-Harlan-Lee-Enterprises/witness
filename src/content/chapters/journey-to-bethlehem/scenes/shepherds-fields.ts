import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';
import { FOLD_CLUES } from '../clues';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const all = (...of: Condition[]): Condition => ({ type: 'all', of });
const any = (...of: Condition[]): Condition => ({ type: 'any', of });
const lambChoice: Condition = { type: 'choiceMade', choice: 'choice-lamb' };
const lambSolved: Condition = { type: 'puzzleSolved', puzzle: 'p-lamb' };

const sign = (
  id: string,
  label: string,
  clueId: string,
  text: string,
  x: number,
  y: number,
  sprite: string,
  solid = true,
) => ({
  id,
  kind: 'clue' as const,
  label,
  x,
  y,
  sprite,
  solid,
  interaction: {
    verb: 'examine' as const,
    effects: [
      { type: 'discoverClue' as const, clue: clueId },
      { type: 'showMessage' as const, text },
    ],
  },
});

/**
 * The fields below Bethlehem. A FICTIONAL fold on the terraces where the
 * village flock spends the night (record rec-pl-fields) — not the place in
 * Luke 2, whose shepherds were out in the fields and stay off-stage. North:
 * the path from the village and a terraced olive field held by a terrace
 * wall. Centre: the dry-stone sheepfold, its gate, a trough and the
 * shepherds' fire. East: a thorn thicket by an old watch hut. South-east:
 * the gully running down to an old cistern, where the lamb is caught.
 */
export const SHEPHERDS_FIELDS: ChapterInput['scenes'][number] = {
  id: 'shepherds-fields',
  name: 'The fold below Bethlehem',
  kind: 'outdoor',
  description:
    'Terraced hillsides below the village, a dry-stone sheepfold with the flock crowding in for the night, a shepherds’ fire, a thorn thicket and a gully dropping away to an old cistern.',
  layout: [
    'HHH..HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    'HHH..dddddddddddddddddddddddddddddddddddHH',
    'HHH..ddOddddOddddOddddOddddOddddOddddOdddd',
    'HHH..ddddddddddddddddddddddddddddddddddddd',
    'HHH..ddddddddddddddddddddddddddddddddddddd',
    'HHH..eeeeeeeeeeeeeeeeeee,eeeeeeeeeeeeeeeee',
    'HHH..,,,,,,,,,,,,,,r,,,,,,,,,r,,,,,,,b,,,,',
    'HHH..,,,,,,,,,,,,,,,,,,,,,O,,,,,,,bbbbb,r,',
    'HHH..,,,fffffffffff,,,O,,,,,,,^^^,bbbbbbb,',
    'HHH,,,r,f,S,,S,,Shf,,,,l,,,,,,^^^,bbbbbbbb',
    'HHH,,,,,f,,,,,,,,,f,,,,l,,,,,,#D#,bbbbbbb,',
    'HHH,,,,,fS,,S,,S,,f,,,,l,b,,,,,,,,,bbbbbbb',
    'HHH,,,O,f,,,,,,,,,f,,r,l,,,,O,,,,,bbbbbbr,',
    'HHH,b,,,f,S,,,,,S,f,,,,l,,,,,,,,,,,,bbbb,,',
    'HHH,,,,,fffffgfffff,b,,,,,,,,,,b,,,,,,,,,,',
    'HHH,,,,,,,,,,,,,,,,,,,,,,,,r,,,,,,,,,,O,,,',
    'HHH,,,,b,,F,,,,u,,,,,,r,,,,,,,,,,O,,r,,,,,',
    'HHH,,,,,,r,,,,mmmm,,,,,,,,,,b,,,,r,,,,,,,,',
    'HHH,,O,,,,,,,,,,,,,,,,,bwr,,,,,,,,,b,,,,O,',
    'HHH,,,,,,,,,,,,,,,,,HHHrwrHHHHHHHHHHHHHHHH',
    'HHHeeeeeeee,eeeeeeeeHHHHwwwHHHHHHHHHHHHHHH',
    'HHHdddddddddddddddOdHHHHHHwwwHHHHHHHHHHHHH',
    'HHHddqqqqqddqqqqqqddHHHHHHHrwwwHHHHHHHHHHH',
    'HHHddqqqqqddqqqqqqddHHHHHHHHHrwwwHHHHHHHHH',
    'HHHddqqqqqddqqqqqqddHHHHHHHHHHHrwwwHHHHHHH',
    'HHHddqqqqqddqqqqqqddHHHHHHHHHHHHHrwwwwwbHH',
    'HHHdOdddddddddddddddHHHHHHHHHHHHHHmmwwWwHH',
    'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  ],
  legend: {
    H: 'hill',
    '.': 'sand',
    ',': 'scrub',
    d: 'soil',
    q: 'crops',
    O: 'olive',
    e: 'terrace',
    f: 'sheepfold',
    g: 'gate',
    S: 'sheep',
    h: 'hay',
    u: 'trough',
    m: 'mud',
    F: 'campfire',
    r: 'rock',
    b: 'bush',
    l: 'fence',
    w: 'wadi',
    W: 'well',
    '^': 'roof',
    '#': 'wall',
    D: 'door',
  },
  baseTile: 'scrub',
  spawns: { 'from-village': { x: 3, y: 1, facing: 'down' } },
  entities: [
    {
      id: 'path-sign',
      kind: 'sign',
      label: 'The path up to Bethlehem',
      sprite: 'sign',
      x: 5,
      y: 7,
      interaction: {
        verb: 'read',
        effects: [
          {
            type: 'showMessage',
            text: 'The path climbs back up the terraces to the east gate of Bethlehem.',
          },
        ],
      },
    },
    // ── The fold ────────────────────────────────────────────────────────
    {
      id: 'yonatan',
      kind: 'npc',
      label: 'Cousin Yonatan',
      characterId: 'yonatan',
      x: 12,
      y: 15,
      facing: 'up',
      interaction: { verb: 'talk', dialogue: 'd-yonatan' },
    },
    {
      id: 'yoram',
      kind: 'npc',
      label: 'Old Yoram',
      characterId: 'yoram',
      x: 9,
      y: 16,
      facing: 'right',
      pose: 'sit',
      // Gone down the gully with his stick if you left the search to the shepherds.
      visibleWhen: not(flag('yoram-searching')),
      interaction: { verb: 'talk', dialogue: 'd-yoram' },
    },
    {
      id: 'ewe',
      kind: 'clue',
      label: 'The lamb’s mother',
      sprite: 'ewe',
      x: 17,
      y: 12,
      visibleWhen: not(flag('lamb-returned')),
      interaction: {
        verb: 'examine',
        effects: [
          { type: 'discoverClue', clue: 'clue-ewe' },
          {
            type: 'showMessage',
            text: 'The lamb’s mother stands at the fold wall, calling again and again toward the gully.',
          },
        ],
      },
    },
    {
      id: 'ewe-content',
      kind: 'feature',
      label: 'The ewe and her lamb',
      sprite: 'ewe',
      x: 17,
      y: 12,
      visibleWhen: flag('lamb-returned'),
      interaction: {
        verb: 'examine',
        effects: [{ type: 'showMessage', text: 'The ewe has her lamb back and is finally quiet.' }],
      },
    },
    {
      id: 'lamb-home',
      kind: 'feature',
      label: 'The speckled lamb, back with the flock',
      sprite: 'lamb',
      x: 17,
      y: 13,
      visibleWhen: flag('lamb-returned'),
    },
    sign(
      'trough-prints',
      'Hoofprints by the trough',
      'clue-small-prints',
      'Small, sharp hoofprints in the damp earth by the trough. They lead away from the flock, toward the top of the gully.',
      15,
      17,
      'hoofprints',
      false,
    ),
    sign(
      'gully-wool',
      'Thornbush at the top of the gully',
      'clue-wool',
      'A tuft of speckled wool is caught on the thorns where the path drops into the gully.',
      23,
      18,
      'wool',
    ),
    sign(
      'terrace-gap',
      'Gap in the terrace wall',
      'clue-terrace-gap',
      'The only gap in the terrace wall, up toward the village, is closed with a cut thorn branch pulled tight. The soft earth on both sides has no tracks.',
      24,
      5,
      'thorn-branch',
    ),
    sign(
      'thicket-edge',
      'Edge of the thorn thicket',
      'clue-thicket',
      'The thorns at the edge of the thicket are clean — no wool anywhere — and the dead leaves under them lie undisturbed.',
      34,
      12,
      'none',
    ),
    {
      id: 'watch-hut',
      kind: 'feature',
      label: 'The old watch hut',
      sprite: 'none',
      x: 31,
      y: 10,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'An old stone hut, where someone once sat up at night to guard the olive harvest. The thorn thicket grows right up to it.',
          },
        ],
      },
    },
    // ── The gully ───────────────────────────────────────────────────────
    {
      id: 'gully-path',
      kind: 'feature',
      label: 'The steep gully path',
      sprite: 'stone',
      x: 24,
      y: 18,
      visibleWhen: not(lambSolved),
      interaction: {
        verb: 'use',
        requires: all(flag('searching'), not(lambChoice)),
        blockedText:
          'A steep, stony path drops into the gully. There’s no reason to go down there.',
        effects: [{ type: 'openPuzzle', puzzle: 'p-lamb' }],
      },
    },
    {
      id: 'lamb',
      kind: 'feature',
      label: 'The speckled lamb',
      sprite: 'lamb',
      x: 39,
      y: 25,
      visibleWhen: all(not(flag('lamb-found')), not(lambChoice)),
      interaction: {
        verb: 'take',
        effects: [
          { type: 'setFlag', flag: 'lamb-found', value: true },
          { type: 'setFlag', flag: 'carrying-lamb', value: true },
          { type: 'adjustCounter', counter: 'hour', delta: 1 },
          {
            type: 'showMessage',
            text: 'The lamb is caught by its fleece in a thornbush beside the old cistern, cold and bleating. You work it free and lift it onto your shoulders.',
          },
        ],
      },
    },
    {
      id: 'old-cistern',
      kind: 'feature',
      label: 'The old cistern',
      sprite: 'none',
      x: 38,
      y: 26,
      interaction: {
        verb: 'examine',
        effects: [
          {
            type: 'showMessage',
            text: 'An old cistern cut into the rock at the bottom of the gully, half full of rainwater.',
          },
        ],
      },
    },
  ],
  exits: [
    {
      id: 'to-village',
      label: 'the path up to Bethlehem',
      x: 3,
      y: 0,
      w: 2,
      h: 1,
      to: { scene: 'bethlehem-lanes', spawn: 'from-fields' },
      // Once the lamb is missing, leaving is a decision (see d-fields-exit).
      requires: any(not(flag('lamb-missing')), lambChoice),
      blockedDialogue: 'd-fields-exit',
      effects: [{ type: 'adjustCounter', counter: 'hour', delta: 1 }],
    },
  ],
  triggers: [
    {
      id: 'fold-arrival',
      onceFlag: 'fold-arrived',
      when: { type: 'visited', scene: 'shepherds-fields' },
      effects: [{ type: 'startDialogue', dialogue: 'd-fold-arrival' }],
    },
    {
      id: 'think',
      onceFlag: 'think-prompted',
      when: all(
        flag('searching'),
        { type: 'cluesFound', clues: FOLD_CLUES, min: 3 },
        not(lambSolved),
      ),
      effects: [{ type: 'startDialogue', dialogue: 'd-think' }],
    },
  ],
  ambience: 'wind',
  mood: 'wilderness',
  music: 'journey',
  // A cold wind at dusk; it drops to a clear, still night once the lamb business is settled.
  weather: 'wind',
  weatherChanges: [{ when: lambChoice, weather: 'clear' }],
};

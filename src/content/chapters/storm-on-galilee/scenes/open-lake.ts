import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';
import type { Effect } from '@/domain/effects';
import { AMI_WITH_YOU } from '../dialogue/helpers';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const any = (...of: Condition[]): Condition => ({ type: 'any', of });
const all = (...of: Condition[]): Condition => ({ type: 'all', of });
const has = (item: string, min?: number): Condition =>
  min === undefined ? { type: 'hasItem', item } : { type: 'hasItem', item, min };
const storm = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-storm',
  option,
});
const talked = (dialogue: string): Condition => ({ type: 'conversationDone', dialogue });

/** Wind rises once you've been under way a little while: after any talk, or a walk forward. */
const GUST_EFFECTS: Effect[] = [
  { type: 'setFlag', flag: 'wind-rising', value: true },
  { type: 'adjustCounter', counter: 'hour', delta: 1 },
  { type: 'startDialogue', dialogue: 'd-gust' },
];

/**
 * Out on the lake at night: the family boat (a big hull around walkable
 * deck, with the mast stepped just forward of the middle), the little
 * rowing boat off the port side, the teacher's boat ahead to the east, and
 * other boats around. The storm rises and calms with the story
 * (weatherChanges). The boats and everyone in them are fiction; the
 * teacher's boat is only ever seen from a distance.
 */
export const OPEN_LAKE: ChapterInput['scenes'][number] = {
  id: 'open-lake',
  name: 'Out on the lake',
  kind: 'outdoor',
  description:
    'The family boat out on the dark lake, with other boats around it and the teacher’s boat ahead.',
  layout: [
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLBBBBLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLBBBLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLhhhhhhhhhhhhLLLLLLLLLLLLLLLLL',
    'LLLLLLLhhhhhddddddddddhhhhhhLLLLLLLLLLLL',
    'LLLLLLhhdddddddddddddddddddhhhLLLLLLLLLL',
    'LLLLLLhddddddddddddMddddddddddhhLLLBBBBL',
    'LLLLLLhdddddddddddddddddddddddhhLLLBBBBL',
    'LLLLLLhhdddddddddddddddddddhhhLLLLLLLLLL',
    'LLLLLLLhhhhhddddddddddhhhhhhLLLLLLLLLLLL',
    'LLLLLLLLLLLhhhhhhhhhhhhLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LBBBLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLBBBBBLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLBBBBBLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
    'LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL',
  ],
  legend: {
    L: 'lake',
    h: 'hull',
    d: 'deck',
    M: 'mast',
    B: 'boat',
  },
  baseTile: 'deck',
  spawns: { aboard: { x: 11, y: 11, facing: 'right' } },
  entities: [
    // ── Your crew ────────────────────────────────────────────────────────
    {
      id: 'elazar-lake',
      kind: 'npc',
      label: 'Uncle Elazar, at the steering oar',
      characterId: 'elazar',
      x: 8,
      y: 11,
      facing: 'right',
      interaction: { verb: 'talk', dialogue: 'd-elazar-lake' },
    },
    {
      id: 'tamar-lake',
      kind: 'npc',
      label: 'Tamar, rowing',
      characterId: 'tamar',
      x: 13,
      y: 13,
      facing: 'left',
      interaction: { verb: 'talk', dialogue: 'd-tamar-lake' },
    },
    {
      id: 'yoezer-lake',
      kind: 'npc',
      label: 'Yoezer, rowing',
      characterId: 'yoezer',
      x: 15,
      y: 10,
      facing: 'left',
      interaction: { verb: 'talk', dialogue: 'd-yoezer-lake' },
    },
    {
      id: 'ami-aboard',
      kind: 'npc',
      label: 'Ami',
      characterId: 'ami',
      x: 18,
      y: 13,
      facing: 'up',
      pose: 'sit',
      visibleWhen: AMI_WITH_YOU,
      looks: [
        {
          when: { type: 'choiceMade', choice: 'choice-cloak', option: 'given' },
          marks: ['wrapped-in-cloak'],
        },
      ],
      interaction: { verb: 'talk', dialogue: 'd-ami-lake' },
    },
    {
      id: 'shifra-aboard',
      kind: 'npc',
      label: 'Shifra',
      characterId: 'shifra',
      x: 21,
      y: 13,
      facing: 'up',
      pose: 'sit',
      visibleWhen: storm('take-aboard'),
      interaction: { verb: 'talk', dialogue: 'd-shifra-lake' },
    },
    {
      id: 'oded-aboard',
      kind: 'npc',
      label: 'Oded',
      characterId: 'oded',
      x: 23,
      y: 13,
      facing: 'up',
      pose: 'sit',
      visibleWhen: storm('take-aboard'),
    },
    // ── The little boat off the port side ────────────────────────────────
    {
      id: 'oded-small',
      kind: 'npc',
      label: 'Oded, in the little boat',
      characterId: 'oded',
      x: 15,
      y: 5,
      facing: 'down',
      pose: 'sit',
      visibleWhen: not(storm('take-aboard')),
    },
    {
      id: 'shifra-small',
      kind: 'npc',
      label: 'Shifra, in the little boat',
      characterId: 'shifra',
      x: 16,
      y: 5,
      facing: 'down',
      pose: 'sit',
      visibleWhen: not(storm('take-aboard')),
    },
    {
      id: 'ami-small',
      kind: 'npc',
      label: 'Ami, in the little boat',
      characterId: 'ami',
      x: 17,
      y: 5,
      facing: 'down',
      pose: 'sit',
      visibleWhen: not(AMI_WITH_YOU),
      looks: [
        {
          when: { type: 'choiceMade', choice: 'choice-cloak', option: 'given' },
          marks: ['wrapped-in-cloak'],
        },
      ],
    },
    {
      id: 'port-rail',
      kind: 'feature',
      label: 'The little boat off the port side',
      sprite: 'none',
      x: 16,
      y: 8,
      interaction: { verb: 'talk', dialogue: 'd-small-boat' },
    },
    {
      id: 'towline',
      kind: 'feature',
      label: 'Your rope, towing the little boat',
      sprite: 'towline',
      x: 16,
      y: 6,
      solid: false,
      visibleWhen: storm('tow'),
    },
    // ── What you loaded ─────────────────────────────────────────────────
    {
      id: 'cargo-jars',
      kind: 'feature',
      label: 'Nikanor’s jars',
      sprite: 'fish-jars',
      x: 23,
      y: 10,
      visibleWhen: has('fish-jar'),
    },
    {
      id: 'cargo-jars-more',
      kind: 'feature',
      label: 'More of Nikanor’s jars',
      sprite: 'fish-jars',
      x: 24,
      y: 10,
      visibleWhen: has('fish-jar', 4),
    },
    {
      id: 'net-cargo',
      kind: 'feature',
      label: 'The trammel net',
      sprite: 'net-pile',
      x: 25,
      y: 12,
      solid: false,
      visibleWhen: has('net'),
    },
    {
      id: 'rope-coil',
      kind: 'feature',
      label: 'The coil of rope',
      sprite: 'rope',
      x: 11,
      y: 13,
      solid: false,
      visibleWhen: all(has('rope'), not(storm('tow'))),
    },
    {
      id: 'spare-oar-deck',
      kind: 'feature',
      label: 'The spare oar',
      sprite: 'oar',
      x: 14,
      y: 14,
      solid: false,
      visibleWhen: has('spare-oar'),
    },
    {
      id: 'bailer-deck',
      kind: 'feature',
      label: 'The bailing scoop',
      sprite: 'bailer',
      x: 17,
      y: 10,
      solid: false,
      visibleWhen: has('bailer'),
    },
    {
      id: 'floating-jars',
      kind: 'feature',
      label: 'Jars bobbing in the water',
      sprite: 'floating-jars',
      x: 4,
      y: 12,
      solid: false,
      visibleWhen: flag('jettisoned'),
    },
    // ── The sail, and the view ahead ────────────────────────────────────
    {
      id: 'sail',
      kind: 'feature',
      label: 'The sail',
      sprite: 'none',
      x: 19,
      y: 11,
      visibleWhen: not({ type: 'puzzleSolved', puzzle: 'p-sail' }),
      interaction: {
        verb: 'use',
        requires: flag('wind-rising'),
        blockedText: 'The sail is drawing well in the light evening air. Tamar keeps an eye on it.',
        effects: [{ type: 'openPuzzle', puzzle: 'p-sail' }],
      },
    },
    {
      id: 'bow',
      kind: 'feature',
      label: 'Look ahead from the bow',
      sprite: 'none',
      x: 30,
      y: 11,
      interaction: { verb: 'examine', dialogue: 'd-bow' },
    },
  ],
  exits: [],
  triggers: [
    {
      id: 'under-way',
      onceFlag: 'under-way-told',
      when: { type: 'visited', scene: 'open-lake' },
      effects: [{ type: 'startDialogue', dialogue: 'd-under-way' }],
    },
    {
      id: 'gust',
      onceFlag: 'gust',
      when: all(
        flag('under-way'),
        any(
          talked('d-elazar-lake'),
          talked('d-tamar-lake'),
          talked('d-yoezer-lake'),
          talked('d-ami-lake'),
          talked('d-bow'),
          talked('d-small-boat'),
        ),
      ),
      effects: GUST_EFFECTS,
    },
    {
      id: 'gust-forward',
      area: { x: 24, y: 9, w: 6, h: 5 },
      onceFlag: 'gust',
      when: flag('under-way'),
      effects: GUST_EFFECTS,
    },
    {
      id: 'squall',
      onceFlag: 'squall',
      when: { type: 'puzzleSolved', puzzle: 'p-sail' },
      effects: [
        { type: 'setFlag', flag: 'storm-broke', value: true },
        { type: 'adjustCounter', counter: 'hour', delta: 1 },
        { type: 'startDialogue', dialogue: 'd-squall' },
      ],
    },
    {
      id: 'calm',
      onceFlag: 'calm-came',
      when: { type: 'choiceMade', choice: 'choice-storm' },
      effects: [{ type: 'startDialogue', dialogue: 'd-calm' }],
    },
  ],
  ambience: 'wind',
  mood: 'wilderness',
  music: 'tension',
  weather: 'clear',
  weatherChanges: [
    { when: flag('wind-rising'), weather: 'wind' },
    { when: flag('storm-broke'), weather: 'storm' },
    { when: flag('great-calm'), weather: 'clear' },
  ],
};

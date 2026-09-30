import type { Condition } from '@/domain/conditions';
import {
  any,
  has,
  not,
  opt,
  say,
  type ChoiceInput,
  type DialogueInput,
  type NodeInput,
} from '../../road-to-jericho/dialogue/helpers';

/**
 * Packing the travel bag. This used to be a packing puzzle; the chapter's
 * puzzle at this point is now finding the way (p-pack, a map), and what you
 * take is a plain choice made here, one thing at a time. The things for the
 * road wait beside the bag; what goes in is what you carry. The bag holds a
 * load of 4, and if you know rain is coming, something must keep Ammia's
 * letter dry. What you pack is recorded as `choice-packing`, exactly as the
 * puzzle recorded it, and the `packed` flag is set when the bag is tied.
 */
export const BAG_CAPACITY = 4;
export const ROAD_THINGS = [
  { item: 'spare-cloak', name: 'Kallias’s old cloak', load: 2 },
  { item: 'hooded-cloak', name: 'your hooded wool cloak', load: 2 },
  { item: 'bread', name: 'the bread and cheese', load: 1 },
  { item: 'tablets', name: 'the writing tablets', load: 1 },
  { item: 'letter-case', name: 'the leather letter case', load: 1 },
] as const;

const LOAD = 'bag-load';
const node = (load: number) => `load-${load}`;
const letterDry: Condition = any(
  not({ type: 'clueFound', clue: 'clue-rain-coming' }),
  has('letter-case'),
  has('hooded-cloak'),
);

function loadNode(load: number): NodeInput {
  const choices: ChoiceInput[] = ROAD_THINGS.flatMap(({ item, name, load: weight }) => {
    const fits = load + weight <= BAG_CAPACITY;
    return [
      opt(
        `in-${item}`,
        `Put in ${name} (load ${weight})`,
        fits ? node(load + weight) : node(load),
        {
          when: not(has(item)),
          ...(fits
            ? {}
            : {
                requires: { type: 'not', condition: { type: 'always' } },
                unavailableText: 'There isn’t room left in the bag for that.',
              }),
          effects: [
            { type: 'giveItem', item },
            { type: 'adjustCounter', counter: LOAD, delta: weight },
          ],
        },
      ),
      opt(`out-${item}`, `Take out ${name}`, node(Math.max(0, load - weight)), {
        when: has(item),
        effects: [
          { type: 'takeItem', item },
          { type: 'adjustCounter', counter: LOAD, delta: -weight },
        ],
      }),
    ];
  });
  return say(
    node(load),
    'narrator',
    `The travel bag holds a load of ${BAG_CAPACITY}. Ammia’s letter is already in; it weighs nothing. Packed so far: ${load} of ${BAG_CAPACITY}.`,
    {
      kind: 'instruction',
      choices: [
        ...choices,
        opt('tie', 'That’s everything. Tie the bag shut.', 'close', {
          requires: letterDry,
          unavailableText:
            'You heard that rain is coming. Ammia’s letter is ink on papyrus — pack something to keep it dry.',
        }),
        opt('later', 'Not yet.'),
      ],
    },
  );
}

const packed = (option: string, text: string): NodeInput =>
  say(`packed-${option}`, 'narrator', text, {
    effects: [
      { type: 'recordChoice', choice: 'choice-packing', option },
      { type: 'setFlag', flag: 'packed', value: true },
    ],
  });

export const BAG_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-bag',
    entries: Array.from({ length: BAG_CAPACITY + 1 }, (_, load) => ({
      when: { type: 'counter' as const, counter: LOAD, eq: load },
      node: node(load),
    })),
    start: node(0),
    nodes: [
      ...Array.from({ length: BAG_CAPACITY + 1 }, (_, load) => loadNode(load)),
      say('close', 'narrator', 'You buckle the bag shut. Whatever you left out stays at home.', {
        branches: [
          { when: has('spare-cloak'), next: 'packed-for-kallias' },
          { when: has('tablets'), next: 'packed-for-writing' },
          { when: any(has('letter-case'), has('hooded-cloak')), next: 'packed-for-rain' },
          { when: has('bread'), next: 'packed-food' },
        ],
        next: 'packed-light-load',
      }),
      packed(
        'for-kallias',
        'Kallias’s old cloak is rolled tight on top. Perhaps he’ll want it back.',
      ),
      packed('for-writing', 'The tablets go in flat, so you can bring back an answer.'),
      packed('for-rain', 'Whatever the sky does, Ammia’s letter will stay dry.'),
      packed('food', 'There’s bread and cheese enough for two.'),
      packed('light-load', 'The bag is light on your shoulder.'),
    ],
  },
];

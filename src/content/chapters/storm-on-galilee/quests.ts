import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';
import { QUEST_EMITTED_EVENTS } from '@/domain/quests';
import { SKY_CLUES } from './clues';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });

export const QUESTS: ChapterInput['quests'] = [
  {
    id: 'q-crossing',
    name: 'The Crossing',
    description:
      'Your first night as crew on the family boat: carry Nikanor’s jars across the lake with Uncle Elazar.',
    kind: 'main',
    autoStart: false,
    stages: [
      {
        id: 'prepare',
        title: 'Ready the Boat',
        description:
          'Help Grandmother with her net, ask Old Hanina what the sky is saying, collect the jars and the gear, and load the boat.',
        objectives: [
          {
            id: 'corner',
            description: 'Help Grandmother tie the last knots of her net',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-corner' },
            optional: false,
          },
          {
            id: 'look-around',
            description: 'Optional: look for signs of the weather along the shore',
            completeWhen: { type: 'cluesFound', clues: SKY_CLUES, min: 3 },
            optional: true,
          },
          {
            id: 'read-sky',
            description: 'Ask Old Hanina what the sky is saying (end of the jetty)',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-sky' },
            optional: false,
          },
          {
            id: 'sail-lesson',
            description: 'Optional: ask Tamar what to do if the wind gets up',
            completeWhen: { type: 'clueFound', clue: 'clue-tamar-sail' },
            optional: true,
          },
          {
            id: 'jars',
            description: 'Collect Nikanor’s jars (at the salting racks)',
            completeWhen: flag('got-jars'),
            optional: false,
          },
          {
            id: 'gear',
            description: 'Get the boat’s gear from Uncle Elazar (on the jetty)',
            completeWhen: flag('got-gear'),
            optional: false,
          },
          {
            id: 'load',
            description: 'Load the boat',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-load' },
            optional: false,
          },
        ],
        next: 'cast-off',
        onEnter: [],
      },
      {
        id: 'cast-off',
        title: 'Cast Off',
        description: 'Evening. Board the boat with your family.',
        objectives: [
          {
            id: 'board',
            description: 'Board the boat',
            completeWhen: { type: 'visited', scene: 'open-lake' },
            optional: false,
          },
        ],
        next: 'crossing',
        onEnter: [],
      },
      {
        id: 'crossing',
        title: 'Out on the Lake',
        description: 'Out on the dark lake with the other boats.',
        objectives: [
          {
            id: 'shorten',
            description: 'Get the sail in',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-sail' },
            optional: false,
          },
          {
            id: 'decide',
            description: 'Decide what to do for the little boat',
            completeWhen: { type: 'choiceMade', choice: 'choice-storm' },
            optional: false,
          },
        ],
        next: 'after',
        onEnter: [],
      },
      {
        id: 'after',
        title: 'After the Storm',
        description: 'The wind has dropped. See to the others, then talk to Uncle Elazar.',
        objectives: [
          {
            id: 'others',
            description: 'See to the others at the port rail',
            completeWhen: flag('saw-to-others'),
            optional: false,
          },
          {
            id: 'return',
            description: 'Head home with Uncle Elazar',
            completeWhen: flag('returned'),
            optional: false,
          },
        ],
        next: 'home',
        onEnter: [],
      },
      {
        id: 'home',
        title: 'Home Before Dawn',
        description:
          'Grandmother is waiting on the jetty, and Nikanor is waiting for news of his jars.',
        objectives: [
          {
            id: 'nikanor',
            description: 'Tell Nikanor what happened to his jars',
            completeWhen: flag('told-nikanor'),
            optional: false,
          },
          {
            id: 'hear',
            description: 'Talk to Grandmother Shelomit',
            completeWhen: flag('seen:scripture-connection'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    outcomes: [
      {
        id: 'cargo-lost',
        kind: 'alternate',
        title: 'Home, lighter than you left',
        when: flag('jettisoned'),
        description: 'Everyone came home. Some of Nikanor’s jars are at the bottom of the lake.',
        rewards: [],
      },
      {
        id: 'cargo-safe',
        kind: 'success',
        title: 'Home, with the jars',
        when: { type: 'always' },
        description: 'Everyone came home, and Nikanor’s jars are safe for another night.',
        rewards: [],
      },
    ],
    eventsConsumed: [
      'ClueDiscovered',
      'PuzzleCompleted',
      'SceneEntered',
      'ChoiceRecorded',
      'FlagChanged',
      'ItemCollected',
    ],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-mission', onComplete: 'je-home' },
  },
  {
    id: 'q-brine',
    name: 'Nikanor’s Jar Net',
    description:
      'Nikanor’s apprentice has gone to hear the teacher, leaving the torn net that carries Nikanor’s jars unmended.',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'measure',
        title: 'Mend the Net',
        description: 'Tie the torn knots so the net matches its pattern again.',
        objectives: [
          {
            id: 'measure',
            description: 'Mend the jar net (by the salting tubs)',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-brine' },
            optional: false,
          },
        ],
        next: 'tell',
        onEnter: [],
      },
      {
        id: 'tell',
        title: 'Tell Nikanor',
        description: 'Show Nikanor the mended net.',
        objectives: [
          {
            id: 'tell',
            description: 'Talk to Nikanor',
            completeWhen: flag('brine-done'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    failWhen: {
      type: 'all',
      of: [
        { type: 'visited', scene: 'open-lake' },
        { type: 'not', condition: flag('brine-done') },
      ],
    },
    failOutcome: 'unfinished',
    outcomes: [
      {
        id: 'finished',
        kind: 'success',
        title: 'The net is mended',
        description:
          'You mended Nikanor’s jar net, and he agreed that fewer jars need cross tonight.',
        rewards: [
          { type: 'adjustTrust', character: 'nikanor', delta: 2 },
          { type: 'setFlag', flag: 'nikanor-agreed', value: true },
          { type: 'unlockJournal', entry: 'jh-salting' },
        ],
      },
      {
        id: 'unfinished',
        kind: 'alternate',
        title: 'Left for the morning',
        description: 'You cast off before the net was mended.',
        rewards: [],
      },
    ],
    eventsConsumed: ['FlagChanged', 'PuzzleCompleted', 'SceneEntered'],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-brine' },
  },
  {
    id: 'q-leak',
    name: 'Oded’s Leaking Boat',
    description:
      'Oded has stuffed a rag into a cracked seam of his borrowed boat. Before evening, could it be sealed properly?',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'ask',
        title: 'Ask How',
        description: 'Find out how a leaking seam is sealed.',
        objectives: [
          {
            id: 'ask',
            description: 'Ask Uncle Elazar how to seal a seam (on the jetty)',
            completeWhen: { type: 'clueFound', clue: 'clue-elazar-seam' },
            optional: false,
          },
        ],
        next: 'pitch',
        onEnter: [],
      },
      {
        id: 'pitch',
        title: 'Pitch and Tow',
        description: 'Nikanor keeps pitch for sealing his jars.',
        objectives: [
          {
            id: 'pitch',
            description: 'Ask Nikanor for pitch and tow (at the salting racks)',
            completeWhen: {
              type: 'any',
              of: [{ type: 'hasItem', item: 'pitch' }, flag('boat-patched')],
            },
            optional: false,
          },
        ],
        next: 'patch',
        onEnter: [],
      },
      {
        id: 'patch',
        title: 'Seal the Seam',
        description: 'Seal the seam with Oded, by his boat.',
        objectives: [
          {
            id: 'patch',
            description: 'Seal the seam with Oded',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-patch' },
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    failWhen: {
      type: 'all',
      of: [
        { type: 'visited', scene: 'open-lake' },
        { type: 'not', condition: flag('boat-patched') },
      ],
    },
    failOutcome: 'unpatched',
    outcomes: [
      {
        id: 'patched',
        kind: 'success',
        title: 'The seam is sealed',
        description:
          'You sealed the cracked seam of Oded’s borrowed boat before the boats put out.',
        rewards: [
          { type: 'adjustTrust', character: 'oded', delta: 1 },
          { type: 'adjustTrust', character: 'shifra', delta: 1 },
        ],
      },
      {
        id: 'unpatched',
        kind: 'alternate',
        title: 'Still leaking',
        description: 'The boats put out before the seam was sealed.',
        rewards: [],
      },
    ],
    eventsConsumed: [
      'FlagChanged',
      'PuzzleCompleted',
      'SceneEntered',
      'ClueDiscovered',
      'ItemCollected',
    ],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-leak' },
  },
];

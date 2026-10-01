import type { Condition } from '@/domain/conditions';
import type { ChapterInput } from '@/domain/chapter';
import { QUEST_EMITTED_EVENTS } from '@/domain/quests';
import { CLOAK_CLUES, INCIDENT_CLUES, ROAD_ADVICE_CLUES } from './clues';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });

export const QUESTS: ChapterInput['quests'] = [
  {
    id: 'q-remedy',
    name: 'Rivka’s Remedy',
    description:
      'Carry Aunt Miriam’s remedy down the road from Jerusalem to her friend Rivka in Jericho.',
    kind: 'main',
    autoStart: false,
    stages: [
      {
        id: 'prepare',
        title: 'Get Ready for the Road',
        description:
          'Ask travelers in the market about the road, collect Rivka’s linen from Hadassah, then pack your satchel at home.',
        objectives: [
          {
            id: 'ask-road',
            description: 'Ask travelers in the market about the road (at least 2 pieces of advice)',
            completeWhen: { type: 'cluesFound', clues: ROAD_ADVICE_CLUES, min: 2 },
            optional: false,
          },
          {
            id: 'collect-linen',
            description: 'Collect Rivka’s linen from Hadassah the weaver',
            completeWhen: flag('linen-collected'),
            optional: false,
          },
          {
            id: 'shop',
            description: 'Optional: buy anything useful in the market',
            completeWhen: {
              type: 'any',
              of: [
                { type: 'hasItem', item: 'linen' },
                { type: 'hasItem', item: 'map' },
                { type: 'hasItem', item: 'oil' },
              ],
            },
            optional: true,
          },
          {
            id: 'pack',
            description: 'Pack your satchel at home',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-satchel' },
            optional: false,
          },
        ],
        next: 'depart',
        onEnter: [],
      },
      {
        id: 'depart',
        title: 'Set Out',
        description: 'Leave Jerusalem by the east gate.',
        objectives: [
          {
            id: 'leave',
            description: 'Leave by the east gate',
            completeWhen: { type: 'visited', scene: 'jericho-road' },
            optional: false,
          },
        ],
        next: 'route',
        onEnter: [],
      },
      {
        id: 'route',
        title: 'Find a Safe Way Down',
        description:
          'The road divides. Look around, weigh what you heard in Jerusalem, and choose a route.',
        objectives: [
          {
            id: 'look',
            description: 'Look around the fork',
            completeWhen: {
              type: 'cluesFound',
              clues: ['clue-cairn', 'clue-mud-line', 'clue-clouds', 'clue-empty-road'],
              min: 2,
            },
            optional: true,
          },
          {
            id: 'choose',
            description: 'Decide which way to go',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-route' },
            optional: false,
          },
        ],
        next: 'descend',
        onEnter: [],
      },
      {
        id: 'descend',
        title: 'Along the Ridge',
        description:
          'Follow the shepherds’ path along the ridge until it rejoins the road below the bend.',
        objectives: [
          {
            id: 'cistern',
            description: 'Optional: refill your water at the cistern',
            completeWhen: flag('refilled'),
            optional: true,
          },
          {
            id: 'meet-eli',
            description: 'Optional: talk to the shepherd boy by the cistern',
            completeWhen: { type: 'conversationDone', dialogue: 'd-eli' },
            optional: true,
          },
          {
            id: 'rejoin',
            description: 'Follow the path down to the road',
            completeWhen: {
              type: 'any',
              of: [
                flag('incident-seen'),
                { type: 'cluesFound', clues: INCIDENT_CLUES, min: 1 },
                { type: 'choiceMade', choice: 'choice-traveler' },
              ],
            },
            optional: false,
          },
        ],
        next: 'traveler',
        onEnter: [],
      },
      {
        id: 'traveler',
        title: 'Someone on the Road',
        description:
          'A traveler lies hurt in the shade below the bend. Find out what happened, then decide what to do.',
        objectives: [
          {
            id: 'examine',
            description: 'Look for signs of what happened (at least 3)',
            completeWhen: { type: 'cluesFound', clues: INCIDENT_CLUES, min: 3 },
            optional: true,
          },
          {
            id: 'understand',
            description: 'Piece together what happened',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-what-happened' },
            optional: true,
          },
          {
            id: 'decide',
            description: 'Decide what to do',
            completeWhen: { type: 'choiceMade', choice: 'choice-traveler' },
            optional: false,
          },
        ],
        next: 'deliver',
        onEnter: [],
      },
      {
        id: 'deliver',
        title: 'Bring the Remedy to Rivka',
        description: 'Continue to Jericho and bring the remedy to Rivka’s house.',
        objectives: [
          {
            id: 'deliver',
            description: 'Give Rivka the remedy',
            completeWhen: flag('remedy-delivered'),
            optional: false,
          },
        ],
        next: 'natan',
        onEnter: [],
      },
      {
        id: 'natan',
        title: 'While the Remedy Steeps',
        description: 'Rivka is preparing the remedy. Keep Natan company until she comes back.',
        objectives: [
          {
            id: 'keep-company',
            description: 'Sit with Natan',
            completeWhen: flag('sat-with-natan'),
            optional: false,
          },
        ],
        next: 'listen',
        onEnter: [],
      },
      {
        id: 'listen',
        title: 'A Story on the Same Road',
        description: 'Yair has a story to tell you.',
        objectives: [
          {
            id: 'hear',
            description: 'Listen to Yair',
            completeWhen: flag('seen:scripture-connection'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    outcomes: [
      {
        id: 'on-time',
        kind: 'success',
        title: 'Delivered before nightfall',
        when: flag('remedy-on-time'),
        description: 'Rivka received the remedy before dark.',
        rewards: [],
      },
      {
        id: 'by-lamplight',
        kind: 'success',
        title: 'Delivered by lamplight',
        when: flag('remedy-lamplight'),
        description: 'You walked the last stretch by lamplight and reached Rivka after dark.',
        rewards: [],
      },
      {
        id: 'at-dawn',
        kind: 'alternate',
        title: 'Delivered at dawn',
        when: flag('remedy-morning'),
        description: 'You rested at the inn and brought the remedy at first light.',
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
    journal: { onStart: 'je-mission', onComplete: 'je-arrival' },
  },
  {
    id: 'q-honest-measure',
    name: 'An Honest Measure',
    description:
      'Ezer the baker and Menashe the oil merchant are arguing about a jar of oil. Can you find out the truth?',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'listen',
        title: 'Hear Both Sides',
        description: 'Listen to Ezer and to Menashe before deciding anything.',
        objectives: [
          {
            id: 'hear-ezer',
            description: 'Hear what Ezer says',
            completeWhen: flag('heard-ezer'),
            optional: false,
          },
          {
            id: 'hear-menashe',
            description: 'Hear what Menashe says',
            completeWhen: flag('heard-menashe'),
            optional: false,
          },
        ],
        next: 'measure',
        onEnter: [],
      },
      {
        id: 'measure',
        title: 'Measure Fairly',
        description: 'Use Ezer’s crock and pitcher to mark exactly 4 measures.',
        objectives: [
          {
            id: 'measure',
            description: 'Mark exactly 4 measures (the measuring vessels are by Ezer’s stall)',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-measure' },
            optional: false,
          },
        ],
        next: 'settle',
        onEnter: [],
      },
      {
        id: 'settle',
        title: 'Settle It',
        description: 'Show Ezer the result.',
        objectives: [
          {
            id: 'settle',
            description: 'Talk to Ezer',
            completeWhen: flag('dispute-settled'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    failWhen: {
      type: 'all',
      of: [
        { type: 'visited', scene: 'jericho-road' },
        { type: 'not', condition: flag('dispute-settled') },
      ],
    },
    failOutcome: 'unresolved',
    outcomes: [
      {
        id: 'settled',
        kind: 'success',
        title: 'Settled fairly',
        description:
          'The measure proved Menashe honest. Ezer apologized and paid, and the two shook hands.',
        rewards: [
          { type: 'adjustTrust', character: 'menashe', delta: 2 },
          { type: 'adjustTrust', character: 'ezer', delta: 1 },
          { type: 'adjustCounter', counter: 'hour', delta: 1 },
          { type: 'unlockJournal', entry: 'jh-measures' },
        ],
      },
      {
        id: 'unresolved',
        kind: 'alternate',
        title: 'Left unresolved',
        description: 'You left Jerusalem before the argument was settled.',
        rewards: [],
      },
    ],
    eventsConsumed: ['FlagChanged', 'PuzzleCompleted', 'SceneEntered'],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-dispute' },
  },
  {
    id: 'q-message',
    name: 'A Message for Eli',
    description:
      'Old Shimon’s grandson Eli is minding the flock on the ridge. Shimon wants him to bring it down before the sun is low.',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'deliver',
        title: 'Find Eli',
        description: 'Tell Eli, at the cistern on the ridge, to bring the flock down early.',
        objectives: [
          {
            id: 'tell',
            description: 'Give Eli his grandfather’s message (at the cistern on the ridge)',
            completeWhen: flag('eli-told'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    failWhen: {
      type: 'all',
      of: [
        { type: 'visited', scene: 'jericho' },
        { type: 'not', condition: flag('eli-told') },
      ],
    },
    failOutcome: 'undelivered',
    outcomes: [
      {
        id: 'delivered',
        kind: 'success',
        title: 'Message delivered',
        description: 'Eli grumbled, and promised to bring the flock down the gully early.',
        rewards: [{ type: 'adjustTrust', character: 'shimon', delta: 1 }],
      },
      {
        id: 'undelivered',
        kind: 'alternate',
        title: 'Not delivered',
        description: 'You reached Jericho without giving Eli the message.',
        rewards: [],
      },
    ],
    eventsConsumed: ['FlagChanged', 'SceneEntered'],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-message' },
  },
  {
    id: 'q-cloak',
    name: 'Whose Cloak?',
    description:
      'Salome has a cloak with a blue stripe that a goatherd brought in this morning. Whose is it?',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'look',
        title: 'Look Closely',
        description: 'Examine the cloak and hear where it came from, then decide whose it is.',
        objectives: [
          {
            id: 'examine',
            description: 'Examine the striped cloak (on the sacks by the inn)',
            completeWhen: { type: 'cluesFound', clues: CLOAK_CLUES, min: 2 },
            optional: true,
          },
          {
            id: 'identify',
            description: 'Work out whose cloak it is',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-cloak' },
            optional: false,
          },
        ],
        next: 'return',
        onEnter: [],
      },
      {
        id: 'return',
        title: 'Tell Salome',
        description: 'Tell Salome whose cloak it is.',
        objectives: [
          {
            id: 'tell',
            description: 'Talk to Salome',
            completeWhen: flag('cloak-returned'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    outcomes: [
      {
        id: 'returned',
        kind: 'success',
        title: 'Back with its owner',
        description: 'Menashe’s own cloak, thrown away by the robbers, is kept for him at the inn.',
        rewards: [{ type: 'adjustTrust', character: 'salome', delta: 1 }],
      },
    ],
    eventsConsumed: ['FlagChanged', 'PuzzleCompleted', 'ClueDiscovered'],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onComplete: 'je-cloak' },
  },
];

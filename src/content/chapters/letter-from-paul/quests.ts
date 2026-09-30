import type { Condition } from '@/domain/conditions';
import type { ChapterInput } from '@/domain/chapter';
import { QUEST_EMITTED_EVENTS } from '@/domain/quests';
import { BUNDLE_CLUES } from './clues';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const kallias = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-kallias',
  option,
});

export const QUESTS: ChapterInput['quests'] = [
  {
    id: 'q-letters',
    name: 'Carried by Hand',
    description:
      'Help Ammia read a rain-soaked letter from Kallias, carry her answer down the Laodicea road, and be back in Colossae for the evening gathering at Philemon’s house.',
    kind: 'main',
    autoStart: false,
    stages: [
      {
        id: 'read',
        title: 'A Letter in the Rain',
        description:
          'Kallias’s letter arrived soaked and out of order. Take it to Zenon the scribe, then read it to Ammia.',
        objectives: [
          {
            id: 'sort',
            description: 'Put the letter back in order with Zenon, under the colonnade',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-sheets' },
            optional: false,
          },
          {
            id: 'read-aloud',
            description: 'Read the letter to Ammia',
            completeWhen: { type: 'choiceMade', choice: 'choice-reading' },
            optional: false,
          },
        ],
        next: 'road',
        onEnter: [],
      },
      {
        id: 'road',
        title: 'Down the Laodicea Road',
        description:
          'Ammia has answered. Find out the way, pack for the road, then take her letter to Kallias at the dye works by the bridge.',
        objectives: [
          {
            id: 'weather',
            description: 'Optional: find out what the weather will do',
            completeWhen: { type: 'clueFound', clue: 'clue-rain-coming' },
            optional: true,
          },
          {
            id: 'way',
            description: 'Ask Ammia the way to the dye works',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-pack' },
            optional: false,
          },
          {
            id: 'pack',
            description: 'Pack the travel bag at home',
            completeWhen: flag('packed'),
            optional: false,
          },
          {
            id: 'leave',
            description: 'Leave by the west gate',
            completeWhen: { type: 'visited', scene: 'lycus-road' },
            optional: false,
          },
        ],
        next: 'kallias',
        onEnter: [],
      },
      {
        id: 'kallias',
        title: 'The Dye Works by the Bridge',
        description: 'Find Kallias, read him Ammia’s letter, and decide what happens next.',
        objectives: [
          {
            id: 'find',
            description: 'Find Kallias at the dye works',
            completeWhen: { type: 'met', character: 'kallias' },
            optional: false,
          },
          {
            id: 'deliver',
            description: 'Read Ammia’s letter to Kallias',
            completeWhen: flag('read-to-kallias'),
            optional: false,
          },
          {
            id: 'alum',
            description: 'Optional: help Kallias match the buyer’s shade',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-alum' },
            optional: true,
            revealWhen: flag('alum-task'),
          },
          {
            id: 'decide',
            description: 'Decide what to do',
            completeWhen: { type: 'choiceMade', choice: 'choice-kallias' },
            optional: false,
          },
        ],
        next: 'home',
        onEnter: [],
      },
      {
        id: 'home',
        title: 'Home Before Lamp-lighting',
        description: 'Get back to Colossae before the gathering begins.',
        objectives: [
          {
            id: 'return',
            description: 'Return to Colossae',
            completeWhen: flag('back-in-town'),
            optional: false,
          },
        ],
        next: 'gathering',
        onEnter: [],
      },
      {
        id: 'gathering',
        title: 'The Gathering',
        description: 'Tonight the letters from Paul will be read aloud at Philemon’s house.',
        objectives: [
          {
            id: 'arrive',
            description: 'Go to Philemon’s house',
            completeWhen: { type: 'visited', scene: 'philemon-house' },
            optional: false,
          },
          {
            id: 'listen',
            description: 'Find Ammia and listen to the letters',
            completeWhen: flag('seen:scripture-connection'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    outcomes: [
      {
        id: 'together',
        kind: 'success',
        title: 'Home together',
        when: kallias('come-now'),
        description: 'Kallias came home with you and stood beside you at the gathering.',
        rewards: [],
      },
      {
        id: 'carried',
        kind: 'success',
        title: 'An answer carried home',
        when: kallias('carry-reply'),
        description: 'You carried Kallias’s answer home on your own tablets.',
        rewards: [],
      },
      {
        id: 'left-to-him',
        kind: 'alternate',
        title: 'The next step left to Kallias',
        when: kallias('leave-it'),
        description: 'You delivered Ammia’s letter and left the rest to Kallias.',
        rewards: [],
      },
    ],
    eventsConsumed: [
      'ClueDiscovered',
      'PuzzleCompleted',
      'SceneEntered',
      'ChoiceRecorded',
      'FlagChanged',
      'CharacterMet',
    ],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-letter', onComplete: 'je-gathering' },
  },
  {
    id: 'q-bundle',
    name: 'The Mule Driver’s Bundle',
    description:
      'Attalos carried a bundle of letters up from Laodicea. The rain washed the name off one of them, and he can’t read. Can you work out whose it is?',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'look',
        title: 'Look for Clues',
        description: 'Examine the letter and ask around the street.',
        objectives: [
          {
            id: 'clues',
            description: 'Find out something about the letter (at least 2 clues)',
            completeWhen: { type: 'cluesFound', clues: BUNDLE_CLUES, min: 2 },
            optional: false,
          },
        ],
        next: 'decide',
        onEnter: [],
      },
      {
        id: 'decide',
        title: 'Whose Letter?',
        description: 'Tell Attalos whose letter it is — and back it up with evidence.',
        objectives: [
          {
            id: 'deduce',
            description: 'Work out whose letter it is (talk to Attalos)',
            completeWhen: { type: 'puzzleSolved', puzzle: 'p-whose' },
            optional: false,
          },
        ],
        next: 'deliver',
        onEnter: [],
      },
      {
        id: 'deliver',
        title: 'Deliver It',
        description: 'Take the letter to the person it belongs to.',
        objectives: [
          {
            id: 'deliver',
            description: 'Give the letter to Tatia',
            completeWhen: flag('bundle-delivered'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    failWhen: {
      type: 'all',
      of: [
        { type: 'visited', scene: 'lycus-road' },
        { type: 'not', condition: flag('bundle-delivered') },
      ],
    },
    failOutcome: 'unread',
    outcomes: [
      {
        id: 'delivered',
        kind: 'success',
        title: 'Delivered',
        description: 'The letter reached Tatia, and Attalos went on his way with one less worry.',
        rewards: [
          { type: 'adjustTrust', character: 'attalos', delta: 2 },
          { type: 'adjustTrust', character: 'tatia', delta: 1 },
          { type: 'unlockJournal', entry: 'jh-carriers' },
        ],
      },
      {
        id: 'unread',
        kind: 'alternate',
        title: 'Carried back unread',
        description: 'You left Colossae before the letter found its owner.',
        rewards: [],
      },
    ],
    eventsConsumed: ['ClueDiscovered', 'PuzzleCompleted', 'FlagChanged', 'SceneEntered'],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-bundle' },
  },
];

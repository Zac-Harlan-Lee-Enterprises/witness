import type { Condition } from '@/domain/conditions';
import type { ChapterInput } from '@/domain/chapter';
import { QUEST_EMITTED_EVENTS } from '@/domain/quests';
import { FOLD_CLUES } from './clues';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const solved = (puzzle: string): Condition => ({ type: 'puzzleSolved', puzzle });
const chose = (choice: string, option?: string): Condition =>
  option === undefined ? { type: 'choiceMade', choice } : { type: 'choiceMade', choice, option };

export const QUESTS: ChapterInput['quests'] = [
  {
    id: 'q-room',
    name: 'Room for Everyone',
    description:
      'The registration has filled Bethlehem — and your family’s house. Help your mother make room, take your cousin his supper at the fold, and be home by nightfall.',
    kind: 'main',
    autoStart: false,
    stages: [
      {
        id: 'welcome',
        title: 'A House Full of Guests',
        description: 'Bake bread for the guests and make room in the guest room.',
        objectives: [
          {
            id: 'bread',
            description: 'Measure three measures of flour for the bread (by the oven)',
            completeWhen: solved('p-bread'),
            optional: false,
          },
          {
            id: 'room',
            description: 'Decide what stays in the guest room',
            completeWhen: solved('p-room'),
            optional: false,
          },
          {
            id: 'greet',
            description: 'Optional: say hello to Aunt Peninah',
            completeWhen: { type: 'met', character: 'peninah' },
            optional: true,
          },
          {
            id: 'ready',
            description: 'Talk to Tamar when the work is done',
            completeWhen: flag('supper-given'),
            optional: false,
          },
        ],
        next: 'supper',
        onEnter: [],
      },
      {
        id: 'supper',
        title: 'Supper for the Fold',
        description:
          'Take Yonatan his supper and his thick cloak at the sheepfold below the village. The way is through the square and out of the east gate.',
        objectives: [
          {
            id: 'straw',
            description: 'Optional: bring an armful of clean straw from the threshing floor',
            completeWhen: flag('took-straw'),
            optional: true,
          },
          {
            id: 'fold',
            description: 'Give Yonatan his supper at the fold',
            completeWhen: flag('supper-delivered'),
            optional: false,
          },
        ],
        next: 'lamb',
        onEnter: [],
      },
      {
        id: 'lamb',
        title: 'The Lost Lamb',
        description:
          'One lamb is missing from the flock, and the light is going. Search for it — or head home before dark.',
        objectives: [
          {
            id: 'look',
            description: 'Look for signs around the fold (at least 2)',
            completeWhen: { type: 'cluesFound', clues: FOLD_CLUES, min: 2 },
            optional: true,
            revealWhen: flag('searching'),
          },
          {
            id: 'track',
            description: 'Work out where the lamb went',
            completeWhen: solved('p-lamb'),
            optional: true,
            revealWhen: flag('searching'),
          },
          {
            id: 'decide',
            description: 'Bring the lamb back to Yonatan — or leave it to the shepherds',
            completeWhen: chose('choice-lamb'),
            optional: false,
          },
        ],
        next: 'evening',
        onEnter: [],
      },
      {
        id: 'evening',
        title: 'Home at Nightfall',
        description: 'Go back up through the village to your house.',
        objectives: [
          {
            id: 'home',
            description: 'Go home',
            completeWhen: flag('evening'),
            optional: false,
          },
        ],
        next: 'stranger',
        onEnter: [],
      },
      {
        id: 'stranger',
        title: 'A Knock at the Door',
        description: 'An old man has come to the door with nowhere to sleep.',
        objectives: [
          {
            id: 'decide',
            description: 'Decide where Zerah will sleep',
            completeWhen: chose('choice-stranger'),
            optional: false,
          },
        ],
        next: 'night',
        onEnter: [],
      },
      {
        id: 'night',
        title: 'News in the Night',
        description: 'The house is settling down to sleep.',
        objectives: [
          {
            id: 'sleep',
            description: 'Lie down to sleep',
            completeWhen: flag('lay-down'),
            optional: false,
          },
          {
            id: 'hear',
            description: 'Listen to what Hagit has come to tell you',
            completeWhen: flag('heard-report'),
            optional: false,
          },
        ],
        next: 'wonder',
        onEnter: [],
      },
      {
        id: 'wonder',
        title: 'All Who Heard It',
        description: 'Luke’s Gospel tells this part of the story.',
        objectives: [
          {
            id: 'connection',
            description: 'Read the Scripture Connection',
            completeWhen: flag('seen:scripture-connection'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    outcomes: [
      {
        id: 'told',
        kind: 'success',
        title: 'Shared the news',
        when: chose('choice-news', 'told'),
        description: 'You woke the household, and everyone heard the shepherds’ news that night.',
        rewards: [],
      },
      {
        id: 'kept',
        kind: 'success',
        title: 'Kept the news to think about',
        when: chose('choice-news', 'kept'),
        description:
          'You let the household sleep and lay awake thinking about the shepherds’ news.',
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
    journal: { onStart: 'je-mission', onComplete: 'je-news' },
  },
  {
    id: 'q-queue',
    name: 'The Long Line',
    description:
      'Uncle Asa has been waiting to be registered since midday. Maybe you can help the clerk go faster.',
    kind: 'side',
    autoStart: false,
    stages: [
      {
        id: 'ask',
        title: 'A Long Line',
        description: 'Ask Kallias the clerk whether you can help.',
        objectives: [
          {
            id: 'offer',
            description: 'Offer to help Kallias the clerk',
            completeWhen: flag('kallias-help'),
            optional: false,
          },
        ],
        next: 'help',
        onEnter: [],
      },
      {
        id: 'help',
        title: 'Help with the Registration',
        description:
          'Read the clerk’s finished tablet, then give Uncle Asa’s details in the same order.',
        objectives: [
          {
            id: 'declare',
            description:
              'Put Uncle Asa’s declaration in order (the blank tablet on the clerk’s table)',
            completeWhen: solved('p-register'),
            optional: false,
          },
        ],
        onEnter: [],
      },
    ],
    failWhen: {
      type: 'all',
      of: [
        { type: 'visited', scene: 'shepherds-fields' },
        { type: 'not', condition: solved('p-register') },
      ],
    },
    failOutcome: 'waited',
    outcomes: [
      {
        id: 'registered',
        kind: 'success',
        title: 'Registered before dark',
        description:
          'Kallias wrote Uncle Asa’s declaration straight down, and Asa went home to help.',
        rewards: [
          { type: 'adjustCounter', counter: 'hour', delta: 1 },
          { type: 'adjustTrust', character: 'asa', delta: 1 },
          { type: 'adjustTrust', character: 'kallias', delta: 1 },
          { type: 'recordChoice', choice: 'choice-queue', option: 'helped' },
          { type: 'unlockJournal', entry: 'jh-declaration' },
        ],
      },
      {
        id: 'waited',
        kind: 'alternate',
        title: 'Waited in line',
        description: 'Uncle Asa waited in line until the clerk packed up at dusk.',
        rewards: [],
      },
    ],
    eventsConsumed: ['FlagChanged', 'PuzzleCompleted', 'SceneEntered'],
    eventsEmitted: [...QUEST_EMITTED_EVENTS],
    journal: { onStart: 'je-registration' },
  },
];

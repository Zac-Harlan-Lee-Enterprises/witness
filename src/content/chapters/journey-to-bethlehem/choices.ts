import type { ChoiceDefinition, Theme } from '@/domain/chapter';

/**
 * Choices describe what happened, never a score. Every option is something
 * a thoughtful person might pick for a real reason. Themes are descriptive
 * tags, not virtue points.
 */
export const THEMES: Theme[] = [
  {
    id: 'hospitality',
    name: 'Hospitality',
    description: 'Making room for family, guests and strangers when space is short.',
  },
  {
    id: 'stewardship',
    name: 'Stewardship',
    description: 'Using limited space, time and supplies well.',
  },
  {
    id: 'lost',
    name: 'Looking for the lost',
    description: 'Going after what has wandered off, and bringing it home.',
  },
  {
    id: 'discernment',
    name: 'Discernment',
    description: 'Weighing signs and testimony before deciding.',
  },
  {
    id: 'family',
    name: 'Family and belonging',
    description: 'Belonging to a family and a town — and welcoming others in.',
  },
  {
    id: 'good-news',
    name: 'Good news',
    description: 'Hearing news of great joy, and deciding what to do with it.',
  },
  {
    id: 'wonder',
    name: 'Wonder',
    description: 'Taking time to marvel at something too big to understand all at once.',
  },
];

export const CHOICES: ChoiceDefinition[] = [
  {
    id: 'choice-room',
    prompt: 'What stayed in the guest room?',
    themes: ['stewardship', 'hospitality'],
    options: [
      {
        id: 'kept-grain',
        label: 'The jars of barley',
        consequence:
          'The grain stayed safe and dry; the loom and Uncle Asa’s tools went down to the animals’ end of the house.',
      },
      {
        id: 'kept-loom',
        label: 'Tamar’s loom',
        consequence:
          'The loom stayed where it always stands; the grain went up to the roof and the tools went down by the animals.',
      },
      {
        id: 'kept-tools',
        label: 'Uncle Asa’s tools',
        consequence:
          'Uncle Asa slept beside his tools; the loom went down by the animals and the grain up to the roof.',
      },
      {
        id: 'made-space',
        label: 'Nothing else — you left a space',
        consequence:
          'You moved the loom, the grain and the tools out, leaving room for one more sleeper.',
      },
    ],
  },
  {
    id: 'choice-queue',
    prompt: 'Did you help with the registration?',
    themes: ['family'],
    options: [
      {
        id: 'helped',
        label: 'You helped the clerk write Uncle Asa’s declaration',
        consequence: 'Uncle Asa was registered before dark and came home to help.',
      },
    ],
  },
  {
    id: 'choice-lamb',
    prompt: 'What did you do about the lost lamb?',
    themes: ['lost', 'discernment'],
    options: [
      {
        id: 'found',
        label: 'You tracked it down and carried it back',
        consequence: 'The speckled lamb spent the night back beside its mother.',
      },
      {
        id: 'left',
        label: 'You went home and left the search to the shepherds',
        consequence:
          'You were home before dark. Old Yoram found the lamb in the gully near midnight, cold but safe.',
      },
    ],
  },
  {
    id: 'choice-stranger',
    prompt: 'Where did Zerah sleep?',
    themes: ['hospitality'],
    options: [
      {
        id: 'own-place',
        label: 'In your place by the fire',
        consequence:
          'Zerah slept by the fire in your place, and you slept in the straw beside the animals.',
      },
      {
        id: 'guest-room',
        label: 'In the space you left in the guest room',
        consequence: 'Zerah slept in the guest room, in the space you had left that afternoon.',
      },
      {
        id: 'straw-bed',
        label: 'On a bed of fresh straw beside the animals',
        consequence:
          'Zerah slept on fresh straw at the animals’ end of the house, warm from their breath.',
      },
      {
        id: 'hagit',
        label: 'At your neighbor Hagit’s house',
        consequence: 'Zerah slept under Hagit’s dry roof, next door.',
      },
      {
        id: 'no-room',
        label: 'You told him there was no room',
        consequence: 'Zerah spent the night wrapped in his cloak by the well.',
      },
    ],
  },
  {
    id: 'choice-news',
    prompt: 'What did you do with the shepherds’ news?',
    themes: ['good-news', 'wonder'],
    options: [
      {
        id: 'told',
        label: 'You woke the house to hear it',
        consequence: 'Everyone in the house heard the news that night, and wondered at it.',
      },
      {
        id: 'kept',
        label: 'You let them sleep and kept it to think about',
        consequence: 'You kept the news to yourself that night and lay awake thinking about it.',
      },
    ],
  },
];

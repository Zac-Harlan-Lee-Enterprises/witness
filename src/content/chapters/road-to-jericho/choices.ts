import type { ChoiceDefinition, Theme } from '@/domain/chapter';

/**
 * Choices describe concrete consequences, never a score. Themes are
 * descriptive tags ("this choice touched on mercy"), not virtue points.
 */
export const THEMES: Theme[] = [
  {
    id: 'neighbor',
    name: 'Who is my neighbor?',
    description: 'Seeing people outside “our group” as neighbors.',
  },
  {
    id: 'mercy',
    name: 'Mercy',
    description: 'Practical care for someone in need — even when it costs something.',
  },
  {
    id: 'courage',
    name: 'Courage and fear',
    description: 'Weighing real danger honestly, and finding brave, wise ways to help.',
  },
  {
    id: 'stewardship',
    name: 'Stewardship',
    description: 'Using limited time, supplies and money well.',
  },
  { id: 'hospitality', name: 'Hospitality', description: 'Welcoming travelers and strangers.' },
  {
    id: 'reconciliation',
    name: 'Reconciliation',
    description: 'Making peace after a quarrel, fairly and honestly.',
  },
  {
    id: 'discernment',
    name: 'Discernment',
    description: 'Weighing evidence and advice before deciding.',
  },
];

export const CHOICES: ChoiceDefinition[] = [
  {
    id: 'choice-packing',
    prompt: 'What did you pack for the road?',
    themes: ['stewardship'],
    options: [
      {
        id: 'care-kit',
        label: 'Linen and oil',
        consequence: 'You were ready to bind and soothe wounds.',
      },
      {
        id: 'some-care',
        label: 'Some supplies for wounds',
        consequence: 'You had something to help an injured person, though not everything.',
      },
      {
        id: 'provisions',
        label: 'Food to share',
        consequence: 'You had food for yourself and someone else.',
      },
      {
        id: 'warmth-light',
        label: 'A cloak or a lamp',
        consequence: 'You were ready for cold or for walking after dark.',
      },
      {
        id: 'water-only',
        label: 'Mostly water',
        consequence: 'You carried plenty of water and little else.',
      },
    ],
  },
  {
    id: 'choice-malik',
    prompt: 'Did you ask Malik to watch for you on the road?',
    themes: ['courage', 'discernment'],
    options: [
      {
        id: 'asked',
        label: 'You asked Malik to keep watch',
        consequence: 'Malik’s caravan looked out for you as it came down the road.',
      },
    ],
  },
  {
    id: 'choice-prejudice',
    prompt: 'When Hadassah spoke about Samaritans, how did you answer?',
    themes: ['neighbor'],
    options: [
      {
        id: 'challenged',
        label: 'You gently disagreed',
        consequence: 'Hadassah thought about what you said.',
      },
      {
        id: 'listened',
        label: 'You listened and moved on',
        consequence: 'You kept your thoughts to yourself.',
      },
    ],
  },
  {
    id: 'choice-traveler',
    prompt: 'What did you do for the injured traveler?',
    themes: ['mercy', 'courage', 'neighbor', 'stewardship'],
    options: [
      {
        id: 'tend-walk',
        label: 'You tended his wounds and helped him walk to the inn',
        consequence:
          'Menashe reached safety with you — slowly, and at a real cost of time and supplies.',
      },
      {
        id: 'tend-caravan',
        label: 'You tended his wounds and waited for Malik’s caravan',
        consequence: 'Menashe rode to the inn on one of Malik’s animals.',
      },
      {
        id: 'send-help',
        label: 'You left him what you could and hurried to send help',
        consequence: 'Menashe waited alone for a while, but help came from the inn.',
      },
      {
        id: 'hurry-on',
        label: 'You hurried on without stopping',
        consequence: 'You reached safety sooner. Someone else found Menashe later.',
      },
    ],
  },
  {
    id: 'choice-cloak',
    prompt: 'Did you give Menashe your spare cloak?',
    themes: ['mercy'],
    options: [
      {
        id: 'given',
        label: 'You gave him your cloak',
        consequence: 'Menashe was warm through the evening.',
      },
    ],
  },
  {
    id: 'choice-inn',
    prompt: 'How did you arrange Menashe’s care at the inn?',
    themes: ['hospitality', 'stewardship', 'mercy'],
    options: [
      {
        id: 'paid',
        label: 'You paid two coins',
        consequence: 'Salome cared for Menashe on your coins.',
      },
      {
        id: 'promised',
        label: 'You promised to come back and pay',
        consequence: 'Salome trusted your promise — and Aunt Miriam’s good name.',
      },
      {
        id: 'worked',
        label: 'You worked for his lodging',
        consequence: 'You drew water and swept the courtyard to pay for his care.',
      },
      { id: 'malik-paid', label: 'Malik paid', consequence: 'Malik covered the cost himself.' },
      {
        id: 'sent-asher',
        label: 'You told Salome and she sent help',
        consequence: 'Salome’s son went out with a donkey to bring Menashe in.',
      },
    ],
  },
];

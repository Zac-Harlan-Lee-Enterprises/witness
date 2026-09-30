import type { ChoiceDefinition, Theme } from '@/domain/chapter';

/**
 * Choices describe concrete consequences, never a score. Themes are
 * descriptive tags ("this choice touched on reconciliation"), not virtue points.
 */
export const THEMES: Theme[] = [
  {
    id: 'reconciliation',
    name: 'Reconciliation',
    description: 'Mending a broken relationship, when both people have something to face.',
  },
  {
    id: 'debt',
    name: 'Wrongs and debts',
    description: 'What is owed after a wrong, and who is willing to carry it.',
  },
  {
    id: 'advocacy',
    name: 'Speaking for someone',
    description: 'Standing beside someone, or putting your own word on the line for them.',
  },
  {
    id: 'honesty',
    name: 'Reading faithfully',
    description: 'Passing on someone’s words as they said them — even the hard parts.',
  },
  {
    id: 'messengers',
    name: 'Carrying words',
    description: 'Letters only arrive because people carry them, read them and explain them.',
  },
  {
    id: 'freedom',
    name: 'Freedom and slavery',
    description: 'Who was free to walk away in the Roman world, and who was not.',
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Receiving someone back, and what that asks of the one who welcomes.',
  },
];

export const CHOICES: ChoiceDefinition[] = [
  {
    id: 'choice-reading',
    prompt: 'How did you read Kallias’s letter to Ammia?',
    themes: ['honesty'],
    options: [
      {
        id: 'every-word',
        label: 'Every word, just as he wrote it',
        consequence:
          'Ammia heard the whole letter, including the part where Kallias admits he lied.',
      },
      {
        id: 'softened',
        label: 'You left out his confession',
        consequence: 'Ammia heard a gentler letter than the one Kallias sent.',
      },
      {
        id: 'added-plea',
        label: 'Every word, and a plea of your own',
        consequence: 'Ammia heard the whole letter — and that you were on Kallias’s side.',
      },
    ],
  },
  {
    id: 'choice-packing',
    prompt: 'What did you pack for the Laodicea road?',
    themes: ['messengers'],
    options: [
      {
        id: 'for-kallias',
        label: 'Kallias’s old cloak',
        consequence: 'You carried something Kallias had left behind, to give back to him.',
      },
      {
        id: 'for-writing',
        label: 'Tablets to write on',
        consequence: 'You were ready to carry an answer back, not only to deliver one.',
      },
      {
        id: 'for-rain',
        label: 'Something against the rain',
        consequence: 'You made sure Ammia’s letter would stay dry.',
      },
      {
        id: 'food',
        label: 'Food to share',
        consequence: 'You had bread enough for two.',
      },
      {
        id: 'light-load',
        label: 'Very little',
        consequence: 'You travelled light.',
      },
    ],
  },
  {
    id: 'choice-debt',
    prompt: 'When Kallias worried about what he still owed, what did you say?',
    themes: ['debt', 'advocacy'],
    options: [
      {
        id: 'my-account',
        label: 'You put three of your own coins toward it',
        consequence: 'Part of Kallias’s debt was paid with your savings.',
      },
      {
        id: 'speak-for-him',
        label: 'You promised to speak for him',
        consequence: 'You gave Kallias your word that you would stand up for him to Ammia.',
      },
      {
        id: 'their-business',
        label: 'You said it was between him and Ammia',
        consequence: 'You left the debt for Kallias and Ammia to settle themselves.',
      },
    ],
  },
  {
    id: 'choice-kallias',
    prompt: 'What did you do at the dye works?',
    themes: ['reconciliation', 'welcome', 'messengers'],
    options: [
      {
        id: 'come-now',
        label: 'You asked Kallias to come home with you now',
        consequence: 'Kallias walked back with you to face Ammia that same evening.',
      },
      {
        id: 'carry-reply',
        label: 'You wrote down his answer and carried it',
        consequence: 'Kallias stayed at his work, and his words went home with you instead.',
      },
      {
        id: 'leave-it',
        label: 'You left the next step to him',
        consequence: 'You delivered Ammia’s letter and let Kallias decide when to come.',
      },
    ],
  },
  {
    id: 'choice-message',
    prompt: 'How did you give Melitta her sister’s message?',
    themes: ['honesty', 'messengers', 'freedom'],
    options: [
      {
        id: 'every-word',
        label: 'Every word, the master’s “perhaps” included',
        consequence: 'Melitta heard everything Chrysis had sent her, the hard part too.',
      },
      {
        id: 'softened',
        label: 'You left out the master’s “perhaps”',
        consequence: 'Melitta heard that her sister was well and still had their mother’s comb.',
      },
    ],
  },
];

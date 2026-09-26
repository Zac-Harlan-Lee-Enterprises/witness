import type { ChoiceDefinition, Theme } from '@/domain/chapter';

/**
 * Choices describe concrete consequences, never a score. Themes are
 * descriptive tags ("this choice touched on fear and trust"), not virtue
 * points. Nothing the player chooses changes what happens in the teacher's
 * boat: the storm and the calm come the same way on every path.
 */
export const THEMES: Theme[] = [
  {
    id: 'fear-trust',
    name: 'Fear and trust',
    description: 'What people do when they are afraid, and whom they turn to.',
  },
  {
    id: 'neighbor',
    name: 'Who is my neighbor?',
    description: 'Seeing the people in the next boat as your own concern.',
  },
  {
    id: 'courage',
    name: 'Courage',
    description: 'Acting well in real danger — which is not the same as feeling no fear.',
  },
  {
    id: 'stewardship',
    name: 'Stewardship',
    description: 'Using limited room, money and gear well, and weighing what they are for.',
  },
  {
    id: 'preparation',
    name: 'Preparing well',
    description:
      'Listening, reading the signs and getting ready — knowing it can’t prevent every storm.',
  },
  {
    id: 'discernment',
    name: 'Discernment',
    description: 'Weighing advice by how much the person really knows.',
  },
  {
    id: 'wonder',
    name: 'Wonder',
    description: 'Meeting something you can’t explain, and asking “Who is this?”',
  },
];

export const CHOICES: ChoiceDefinition[] = [
  {
    id: 'choice-load',
    prompt: 'How did you load the boat?',
    themes: ['stewardship', 'preparation'],
    options: [
      {
        id: 'all-jars',
        label: 'All six of Nikanor’s jars',
        consequence: 'The boat sat low in the water with the whole load aboard.',
      },
      {
        id: 'jars-and-gear',
        label: 'Most of the jars, and gear for trouble',
        consequence: 'You carried most of the jars and room for a rope or a spare oar.',
      },
      {
        id: 'jars-and-net',
        label: 'Most of the jars, and the fishing net',
        consequence: 'You made room for the net, to fish on the way home.',
      },
      {
        id: 'light',
        label: 'A light load',
        consequence: 'You left jars on the shore so the boat rode high in the water.',
      },
    ],
  },
  {
    id: 'choice-ami',
    prompt: 'When Shifra asked if Ami could cross in your boat, what did you say?',
    themes: ['neighbor', 'stewardship'],
    options: [
      {
        id: 'room',
        label: 'There was room for him',
        consequence: 'Ami crossed in your boat, beside you.',
      },
      {
        id: 'made-room',
        label: 'You left a jar ashore to make room',
        consequence: 'One of Nikanor’s jars stayed on the shore, and Ami crossed in your boat.',
      },
      {
        id: 'no-room',
        label: 'You said there was no room',
        consequence: 'Ami stayed with his mother in the little boat.',
      },
    ],
  },
  {
    id: 'choice-storm',
    prompt: 'What did you do for the little boat in the storm?',
    themes: ['neighbor', 'courage', 'fear-trust', 'stewardship'],
    options: [
      {
        id: 'take-aboard',
        label: 'You brought them aboard your boat',
        consequence:
          'Shifra’s family rode out the storm in your boat — at the cost of room, time and, if you were heavy, cargo.',
      },
      {
        id: 'tow',
        label: 'You threw them a line and towed them',
        consequence: 'The two boats struggled through the storm tied together.',
      },
      {
        id: 'oar',
        label: 'You threw Oded your spare oar',
        consequence: 'With a second oar, Oded could keep their bow to the waves.',
      },
      {
        id: 'hold-course',
        label: 'You kept your own boat afloat',
        consequence:
          'You bailed and held your own course, and lost sight of the little boat until the wind dropped.',
      },
    ],
  },
  {
    id: 'choice-cloak',
    prompt: 'Did you give Ami your cloak?',
    themes: ['neighbor'],
    options: [
      {
        id: 'given',
        label: 'You wrapped Ami in your cloak',
        consequence: 'Ami went home warm, wrapped in your cloak.',
      },
    ],
  },
];

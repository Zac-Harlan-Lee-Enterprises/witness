import type { ChapterInput } from '@/domain/chapter';

/**
 * Every item matters to a decision or a puzzle. The travel bag holds a load
 * of 4 (see puzzles.ts), so what you bring decides what you can offer on the
 * road: a way to write down an answer, a cloak for someone else, protection
 * from the rain, or bread to share.
 */
export const ITEMS: ChapterInput['items'] = [
  {
    id: 'kallias-letter',
    name: 'Kallias’s letter',
    kind: 'letter',
    weight: 0,
    maxStack: 1,
    essential: false,
    icon: '📜',
    description:
      'Four rain-soaked papyrus sheets from Kallias, Ammia’s former apprentice. The cord that held them has come undone.',
  },
  {
    id: 'ammia-letter',
    name: 'Ammia’s answer',
    kind: 'letter',
    weight: 0,
    maxStack: 1,
    essential: true,
    icon: '✉️',
    description:
      'Ammia’s reply to Kallias, in your own careful handwriting. You wrote down every word as she spoke.',
  },
  {
    id: 'coins',
    name: 'Bronze coins',
    kind: 'currency',
    weight: 0,
    maxStack: 20,
    essential: false,
    icon: '🪙',
    description: 'Your own savings, from running errands for Zenon.',
  },
  {
    id: 'bread',
    name: 'Bread and cheese',
    kind: 'food',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '🍞',
    description: 'A round of bread and a wedge of cheese, wrapped in cloth. Enough for two.',
  },
  {
    id: 'hooded-cloak',
    name: 'Hooded wool cloak',
    kind: 'clothing',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🧥',
    description:
      'A thick, hooded wool cloak that sheds rain. Heavy, but you can tuck a letter under it.',
  },
  {
    id: 'spare-cloak',
    name: 'Kallias’s old cloak',
    kind: 'clothing',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🧣',
    description:
      'The cloak Kallias left behind when he went away in the winter. Ammia never gave it away.',
  },
  {
    id: 'tablets',
    name: 'Writing tablets and stylus',
    kind: 'tool',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '📝',
    description:
      'Two wooden tablets, hinged together and filled with wax, and a stylus to write in them. Wax does not run in the rain.',
  },
  {
    id: 'letter-case',
    name: 'Leather letter case',
    kind: 'tool',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '👜',
    description: 'A small leather case with a buckled flap. It keeps letters dry.',
  },
  {
    id: 'kallias-reply',
    name: 'Kallias’s answer',
    kind: 'letter',
    weight: 0,
    maxStack: 1,
    essential: false,
    icon: '📝',
    description: 'Kallias’s answer to Ammia, written on your tablets as he spoke it.',
  },
  {
    id: 'bundle-letter',
    name: 'A letter with no name',
    kind: 'letter',
    weight: 0,
    maxStack: 1,
    essential: false,
    icon: '✉️',
    description:
      'A folded letter from Attalos’s bundle. The rain has washed the name off the outside.',
  },
];

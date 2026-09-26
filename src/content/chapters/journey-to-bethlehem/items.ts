import type { ChapterInput } from '@/domain/chapter';

/**
 * Items. The things for the guest room carry WEIGHT = floor space (the room
 * holds 6); everything you carry around the village weighs nothing, so the
 * only packing decision is the room itself (see puzzles.ts, p-room).
 */
export const ROOM_ITEMS = ['bed-asa', 'bed-peninah', 'loom', 'grain', 'tools'] as const;

export const ITEMS: ChapterInput['items'] = [
  {
    id: 'bed-asa',
    name: 'Uncle Asa’s bedding',
    kind: 'supply',
    weight: 2,
    maxStack: 1,
    essential: true,
    icon: '🛏',
    description: 'A thick sleeping mat and blankets. Uncle Asa walked all the way from Jerusalem.',
  },
  {
    id: 'bed-peninah',
    name: 'Aunt Peninah and Dodi’s bedding',
    kind: 'supply',
    weight: 2,
    maxStack: 1,
    essential: true,
    icon: '🧺',
    description: 'A mat and a warm blanket for Aunt Peninah and little Dodi.',
  },
  {
    id: 'loom',
    name: 'Tamar’s loom',
    kind: 'tool',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🧶',
    description:
      'Your mother’s upright loom, with half a cloak woven on it. It usually stands in the guest room.',
  },
  {
    id: 'grain',
    name: 'Jars of barley',
    kind: 'food',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🏺',
    description:
      'Two big jars of this year’s barley. Grain has to stay dry — and away from hungry animals.',
  },
  {
    id: 'tools',
    name: 'Uncle Asa’s tools',
    kind: 'tool',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🔨',
    description:
      'A mason’s chisels, hammer and set square, rolled in leather. They are how Uncle Asa earns his family’s bread, and he doesn’t like them out of his sight.',
  },
  {
    id: 'supper',
    name: 'Yonatan’s supper',
    kind: 'food',
    weight: 0,
    maxStack: 1,
    essential: true,
    icon: '🍞',
    description:
      'Warm bread, cheese and olives wrapped in a cloth, for your cousin at the sheepfold.',
  },
  {
    id: 'cloak',
    name: 'Yonatan’s thick cloak',
    kind: 'clothing',
    weight: 0,
    maxStack: 1,
    essential: true,
    icon: '🧣',
    description:
      'A heavy wool cloak for the night watch. The wind on the terraces is cold after dark.',
  },
  {
    id: 'lamp',
    name: 'Clay oil lamp',
    kind: 'tool',
    weight: 0,
    maxStack: 1,
    essential: false,
    icon: '🪔',
    description: 'A small clay lamp for the walk home at dusk.',
  },
  {
    id: 'straw',
    name: 'Armful of clean straw',
    kind: 'supply',
    weight: 0,
    maxStack: 1,
    essential: false,
    icon: '🌾',
    description: 'Clean straw from the threshing floor. Good for bedding — animals’ or anyone’s.',
  },
];

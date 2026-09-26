import type { ChapterInput } from '@/domain/chapter';

/**
 * Everything that might go into the family boat. Weights are "loads": the
 * boat takes 10 besides her crew (see puzzles.ts, p-load), and everything
 * on offer weighs 15 — so something stays on the shore, and what you take
 * decides what you can do in the storm.
 */
export const ITEMS: ChapterInput['items'] = [
  {
    id: 'fish-jar',
    name: 'Jar of salted fish',
    kind: 'mission',
    weight: 1,
    maxStack: 6,
    essential: false,
    icon: '🏺',
    description:
      'One of Nikanor’s six jars of salted fish, sealed and roped. Carrying them across pays for much of the family’s fishing this season.',
  },
  {
    id: 'bailer',
    name: 'Bailing scoop',
    kind: 'tool',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '🪣',
    description:
      'A wooden scoop for throwing water out of the boat. Every boat on the lake has one.',
  },
  {
    id: 'rope',
    name: 'Coil of rope',
    kind: 'tool',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '🪢',
    description: 'A long coil of strong rope. Good for mooring — or for throwing to someone.',
  },
  {
    id: 'spare-oar',
    name: 'Spare oar',
    kind: 'tool',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🪵',
    description: 'A spare oar, in case one breaks. Long and awkward to stow.',
  },
  {
    id: 'net',
    name: 'Trammel net',
    kind: 'supply',
    weight: 2,
    maxStack: 1,
    essential: false,
    icon: '🐟',
    description:
      'The family’s trammel net. Set on the way home, it could bring in a catch worth selling — but it is heavy.',
  },
  {
    id: 'lamp',
    name: 'Clay lamp',
    kind: 'tool',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '🪔',
    description: 'A small clay oil lamp, kept low in the boat out of the wind.',
  },
  {
    id: 'bread',
    name: 'Bread and dried fish',
    kind: 'food',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '🍞',
    description: 'Flat bread and a little dried fish, wrapped in a cloth, for the night.',
  },
  {
    id: 'cloak',
    name: 'Your cloak',
    kind: 'clothing',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '🧣',
    description: 'A warm wool cloak. Nights on the water are cold, especially when you are wet.',
  },
  {
    id: 'water-skin',
    name: 'Water skin',
    kind: 'water',
    weight: 1,
    maxStack: 1,
    essential: false,
    icon: '💧',
    description: 'A goatskin of drinking water that Grandmother pressed on you.',
  },
];

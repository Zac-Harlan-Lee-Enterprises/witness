import type { ChapterInput } from '@/domain/chapter';

/**
 * Clues say honestly how reliable they are. The unaddressed letter can be
 * traced from its dust, its torn words and who handed it over; the potter's
 * confident guess is deliberately weak.
 */
export const CLUES: ChapterInput['clues'] = [
  // ── The weather ──────────────────────────────────────────────────────
  {
    id: 'clue-rain-coming',
    title: 'Rain by afternoon',
    kind: 'environmental',
    source: 'Mount Cadmus',
    reliability: 'reliable',
    text: 'Grey cloud sits on the peak of Mount Cadmus above the town. People who work outdoors say rain will come down the valley by afternoon.',
  },
  // ── The unaddressed letter (side quest) ──────────────────────────────
  {
    id: 'clue-white-dust',
    title: 'White dust in the folds',
    kind: 'environmental',
    source: 'The letter',
    reliability: 'reliable',
    text: 'Fine white clay dust is caught in the folds of the letter, like the pale dust that coats everything in Tatia’s yard.',
  },
  {
    id: 'clue-torn-words',
    title: 'Words through a tear',
    kind: 'document',
    source: 'The letter',
    reliability: 'reliable',
    text: 'Through a tear in the outer sheet you can read: “…the cloaks you cleaned for us came back like new…”',
  },
  {
    id: 'clue-cloth-merchant',
    title: 'A cloth merchant’s letter',
    kind: 'witness',
    source: 'Attalos',
    reliability: 'reliable',
    text: 'Attalos remembers who handed it to him in Laodicea: a cloth merchant, who paid him a coin to carry it to Colossae.',
  },
  {
    id: 'clue-not-zenon',
    title: 'Not Zenon’s',
    kind: 'witness',
    source: 'Zenon',
    reliability: 'reliable',
    text: 'Zenon says he is expecting nothing from Laodicea, and that he knows the handwriting of everyone who writes to him. This isn’t one of them.',
  },
  {
    id: 'clue-potter-guess',
    title: '“Letters are for Zenon”',
    kind: 'witness',
    source: 'Menandros',
    reliability: 'unreliable',
    reliabilityNote:
      'Menandros never looked at the letter. Zenon reads letters FOR people; that doesn’t make every letter his.',
    text: 'Menandros the potter says any letter with a seal on it must be for Zenon.',
  },
];

export const BUNDLE_CLUES = [
  'clue-white-dust',
  'clue-torn-words',
  'clue-cloth-merchant',
  'clue-not-zenon',
  'clue-potter-guess',
];

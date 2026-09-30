import type { ChapterInput } from '@/domain/chapter';

/**
 * Clues are explicit about reliability. Reading the sky (p-sky) means
 * weighing an old fisherman's experience, what you can see and feel on the
 * shore, and a confident claim from someone who rarely goes out at night.
 * The observations are the game's fiction; the weather they point to is
 * consistent with record rec-hist-storms, and the puzzle's answer admits
 * that no one can say exactly when a wind will come.
 */
export const CLUES: ChapterInput['clues'] = [
  // ── Reading the sky ──────────────────────────────────────────────────
  {
    id: 'clue-hanina-east',
    title: 'Winds off the heights',
    kind: 'witness',
    source: 'Old Hanina',
    reliability: 'reliable',
    text: 'Hanina says the afternoon wind from the west is only the lake’s everyday temper. The worst winds come down off the heights to the east — and they can come at night.',
    recordIds: ['rec-hist-storms'],
  },
  {
    id: 'clue-cold-breath',
    title: 'Cold air off the eastern hills',
    kind: 'environmental',
    source: 'The far shore',
    reliability: 'reliable',
    text: 'The eastern hills are already in shadow. Now and then a cold breath comes across from them, against the afternoon wind, and the water under them darkens and shivers.',
  },
  {
    id: 'clue-magdala-crew',
    title: 'A crew hauling their boat up high',
    kind: 'witness',
    source: 'A crew from Magdala',
    reliability: 'reliable',
    text: 'A crew just in from Magdala have dragged their boat high up the shingle and are lashing it down. “We don’t like the feel of tonight,” one of them says.',
  },
  {
    id: 'clue-clear-west',
    title: 'A clear western sky',
    kind: 'environmental',
    source: 'The western hills',
    reliability: 'reliable',
    text: 'Over the western hills the sky is clear and golden. No rain clouds are coming in from the sea.',
  },
  {
    id: 'clue-afternoon-wind',
    title: 'The afternoon wind',
    kind: 'environmental',
    source: 'The water’s edge',
    reliability: 'reliable',
    text: 'The afternoon wind from the west is chopping the lake into short waves that slap the shingle, as it does on most summer afternoons.',
    recordIds: ['rec-hist-storms'],
  },
  {
    id: 'clue-nikanor-calm',
    title: '“Never rough at night”',
    kind: 'witness',
    source: 'Nikanor',
    reliability: 'unreliable',
    reliabilityNote:
      'Nikanor admitted he hardly ever crosses the lake at night — and he wants his jars across.',
    text: 'Nikanor insists the lake is never rough at night at this time of year.',
  },
  // ── Handling the boat ────────────────────────────────────────────────
  {
    id: 'clue-tamar-sail',
    title: 'Tamar’s rule for a squall',
    kind: 'witness',
    source: 'Tamar',
    reliability: 'reliable',
    text: 'Tamar’s rule: first take the wind out of the sail by hauling up the brails; then lower the yard and lash it; then oars out and keep the bow to the waves; then bail, and keep bailing.',
    recordIds: ['rec-recon-boat-handling'],
  },
  // ── Sealing a leaking seam (side quest) ──────────────────────────────
  {
    id: 'clue-elazar-seam',
    title: 'Uncle Elazar’s way to seal a seam',
    kind: 'witness',
    source: 'Uncle Elazar',
    reliability: 'reliable',
    text: 'Out with whatever is stuffed in the crack, and let the seam dry — pitch won’t stick to wet wood. Pack it tight with tow, smear warm pitch over it, and let it set before the boat goes back in the water.',
  },
];

export const SKY_CLUES = [
  'clue-hanina-east',
  'clue-cold-breath',
  'clue-magdala-crew',
  'clue-clear-west',
  'clue-afternoon-wind',
  'clue-nikanor-calm',
];

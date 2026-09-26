import type { ChapterInput } from '@/domain/chapter';

/**
 * Clues state their reliability honestly. The lost-lamb puzzle is about
 * weighing signs: most point one way, and one confident sighting turns out
 * to be about something else entirely (Uncle Asa's "lamb" had horns).
 */
export const CLUES: ChapterInput['clues'] = [
  // ── In the village ─────────────────────────────────────────────────────
  {
    id: 'clue-model-order',
    title: 'The clerk’s finished tablet',
    kind: 'document',
    source: 'Kallias the clerk',
    reliability: 'reliable',
    text: 'A finished declaration, scratched in wax: first the person declaring, then the town the household is registered in, then everyone in the household with their ages, then what they own, and last a promise that it is all true.',
    recordIds: ['rec-recon-declaration'],
  },
  {
    id: 'clue-hagit-water',
    title: 'A lamb that likes water',
    kind: 'witness',
    source: 'Hagit',
    reliability: 'reliable',
    text: 'Hagit has watched the flock pass her door for fifty years. She says Yonatan’s speckled lamb with the black ear is always wandering off toward water.',
  },
  {
    id: 'clue-asa-lamb',
    title: 'Uncle Asa’s “lamb”',
    kind: 'witness',
    source: 'Uncle Asa',
    reliability: 'unreliable',
    reliabilityNote:
      'It had little horns, so it was probably one of Hagit’s goat kids — and it was hours before Yonatan’s lamb went missing.',
    text: 'Uncle Asa saw “a little white lamb” trot up the lane in the afternoon — but he admits it had little horns (a goat kid?), and it was hours before Yonatan’s lamb went missing.',
  },
  // ── At the fold ────────────────────────────────────────────────────────
  {
    id: 'clue-small-prints',
    title: 'Small hoofprints',
    kind: 'environmental',
    source: 'The trough by the fold',
    reliability: 'reliable',
    text: 'Small, sharp hoofprints in the damp earth by the trough. They lead away from the flock, toward the top of the gully.',
  },
  {
    id: 'clue-wool',
    title: 'Speckled wool on the thorns',
    kind: 'environmental',
    source: 'The top of the gully',
    reliability: 'reliable',
    text: 'A tuft of speckled wool is caught on a thornbush where the path drops into the gully.',
  },
  {
    id: 'clue-ewe',
    title: 'The ewe’s calling',
    kind: 'environmental',
    source: 'The fold',
    reliability: 'uncertain',
    reliabilityNote:
      'A mother calls toward where she last heard her lamb. It suggests a direction; it proves nothing.',
    text: 'The lamb’s mother stands at the fold wall, calling again and again toward the gully.',
  },
  {
    id: 'clue-terrace-gap',
    title: 'The closed gap',
    kind: 'environmental',
    source: 'The terrace wall',
    reliability: 'reliable',
    text: 'The only gap in the terrace wall up toward the village is closed with a cut thorn branch, pulled tight. There are no tracks in the soft earth on either side.',
  },
  {
    id: 'clue-thicket',
    title: 'Clean thorns',
    kind: 'environmental',
    source: 'The thorn thicket',
    reliability: 'reliable',
    text: 'The thorns at the edge of the thicket by the old watch hut are clean — no wool anywhere — and the dead leaves under them lie undisturbed.',
  },
];

/** Signs you can find around the fold itself (the lamb puzzle is solvable from these alone). */
export const FOLD_CLUES = [
  'clue-small-prints',
  'clue-wool',
  'clue-ewe',
  'clue-terrace-gap',
  'clue-thicket',
];

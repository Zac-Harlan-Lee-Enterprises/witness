import type { ChapterInput } from '@/domain/chapter';

/**
 * Clues are explicit about reliability. Some conflict on purpose (Tobiah vs.
 * Malik about the wadi) so the route puzzle is about WEIGHING testimony,
 * not just collecting it.
 */
export const CLUES: ChapterInput['clues'] = [
  // ── From travelers in Jerusalem ─────────────────────────────────────────
  {
    id: 'clue-bend-watchers',
    title: 'Watchers at the bend',
    kind: 'witness',
    source: 'Old Shimon',
    reliability: 'reliable',
    text: 'Shimon says robbers watch the narrow bend below the red rocks — especially when few travelers are on the road.',
  },
  {
    id: 'clue-cistern',
    title: 'A cistern on the ridge',
    kind: 'witness',
    source: 'Old Shimon',
    reliability: 'reliable',
    text: 'Shimon says the shepherds’ ridge path has a cistern where you can refill water. Cairns of three stones mark the way.',
  },
  {
    id: 'clue-wadi-dead-end',
    title: 'The wadi ends at a drop',
    kind: 'witness',
    source: 'Malik',
    reliability: 'reliable',
    text: 'Malik says the dry wadi looks like a shortcut but ends at a dry waterfall — a sheer drop you can’t climb down with a load.',
  },
  {
    id: 'clue-caravan',
    title: 'Malik’s caravan',
    kind: 'witness',
    source: 'Malik',
    reliability: 'reliable',
    text: 'Malik’s caravan leaves at midday and takes the main road down to Jericho.',
  },
  {
    id: 'clue-wadi-fastest',
    title: '“The wadi is fastest”',
    kind: 'witness',
    source: 'Tobiah',
    reliability: 'unreliable',
    reliabilityNote:
      'Tobiah admitted he has only ever driven his cart on the main road. He has never walked the wadi.',
    text: 'Tobiah insists the dry wadi is the fastest way down.',
  },
  {
    id: 'clue-map',
    title: 'Malik’s sketch map',
    kind: 'document',
    source: 'Malik’s map',
    reliability: 'reliable',
    text: 'The map shows the shepherds’ ridge path rejoining the road below the bend. It marks the end of the wadi “the drop.”',
    recordIds: ['rec-map'],
  },
  // ── At the fork ──────────────────────────────────────────────────────────
  {
    id: 'clue-cairn',
    title: 'Three stones',
    kind: 'environmental',
    source: 'The fork',
    reliability: 'reliable',
    text: 'A cairn of three stacked stones marks a narrow path climbing the ridge. Someone keeps it up on purpose.',
  },
  {
    id: 'clue-mud-line',
    title: 'Fresh mud in the wadi',
    kind: 'environmental',
    source: 'The fork',
    reliability: 'reliable',
    text: 'A line of fresh mud, twigs and pebbles runs along the wadi walls. Water rushed through here recently.',
    recordIds: ['rec-hist-floods'],
  },
  {
    id: 'clue-clouds',
    title: 'Clouds over the hills',
    kind: 'environmental',
    source: 'The fork',
    reliability: 'reliable',
    text: 'Dark clouds hang over the hills to the west. It isn’t raining here — but it may be raining there.',
    recordIds: ['rec-hist-floods'],
  },
  {
    id: 'clue-empty-road',
    title: 'An empty road',
    kind: 'environmental',
    source: 'The fork',
    reliability: 'reliable',
    text: 'The main road ahead is empty. No other travelers are in sight.',
  },
  // ── On the ridge ─────────────────────────────────────────────────────────
  {
    id: 'clue-eli-men',
    title: 'Men on the hills at dawn',
    kind: 'witness',
    source: 'Eli',
    reliability: 'uncertain',
    reliabilityNote:
      'Eli saw them from a long way off, in the grey before sunrise, while he was lying flat behind the rocks.',
    text: 'Eli says four men with nothing to carry came along the hills at first light and went down the gully toward the bend.',
  },
  // ── Below the bend ───────────────────────────────────────────────────────
  {
    id: 'clue-single-prints',
    title: 'One set of sandal prints',
    kind: 'environmental',
    source: 'Below the bend',
    reliability: 'reliable',
    text: 'One set of sandal prints comes down the road from the bend.',
  },
  {
    id: 'clue-many-prints',
    title: 'Many footprints',
    kind: 'environmental',
    source: 'Below the bend',
    reliability: 'reliable',
    text: 'Several sets of footprints come down from the rocks, trample around one spot, then lead away north up a narrow gully. They don’t come back.',
  },
  {
    id: 'clue-broken-jar',
    title: 'A broken jar',
    kind: 'environmental',
    source: 'Below the bend',
    reliability: 'reliable',
    text: 'A broken oil jar. The spilled oil has soaked into the dust, and the edges have dried. This happened hours ago, not minutes.',
  },
  {
    id: 'clue-cut-purse',
    title: 'A cut purse',
    kind: 'environmental',
    source: 'Below the bend',
    reliability: 'reliable',
    text: 'An empty leather purse. Its strings have been cut.',
  },
  {
    id: 'clue-torn-cloth',
    title: 'Torn cloth',
    kind: 'environmental',
    source: 'Below the bend',
    reliability: 'reliable',
    text: 'A strip of cloth with a blue stripe is caught on a thornbush — as if a cloak was pulled away roughly.',
  },
  {
    id: 'clue-drag-marks',
    title: 'Drag marks',
    kind: 'environmental',
    source: 'Below the bend',
    reliability: 'reliable',
    text: 'Scuffed drag marks lead off the road into the shade of the rocks. They cross OVER the other footprints.',
  },
  // ── At the inn: a cloak with a blue stripe ───────────────────────────────
  {
    id: 'clue-cloak-hem',
    title: 'A strip torn from the hem',
    kind: 'environmental',
    source: 'The striped cloak',
    reliability: 'reliable',
    text: 'The cloak’s blue-striped hem has a strip torn right out of it, as if it caught on a thorn and was pulled away hard.',
  },
  {
    id: 'clue-cloak-oil',
    title: 'It smells of olive oil',
    kind: 'environmental',
    source: 'The striped cloak',
    reliability: 'reliable',
    text: 'One side of the cloak is stiff with a dark stain that smells of olive oil.',
  },
  {
    id: 'clue-cloak-found',
    title: 'Found in the rocks north of the road',
    kind: 'witness',
    source: 'Salome',
    reliability: 'reliable',
    text: 'Salome says a goatherd brought the cloak in this morning. He found it thrown down among the rocks north of the road, below the bend, and told her so plainly.',
  },
  {
    id: 'clue-blue-stripes',
    title: '“Half the cloaks in Jericho”',
    kind: 'witness',
    source: 'Salome',
    reliability: 'unreliable',
    reliabilityNote:
      'True enough, but it says nothing about whose cloak this one is. It is a reason to look carefully, not evidence.',
    text: 'Salome shrugs: half the cloaks in Jericho have a blue stripe.',
  },
];

export const CLOAK_CLUES = ['clue-cloak-hem', 'clue-cloak-oil', 'clue-cloak-found'];

export const INCIDENT_CLUES = [
  'clue-single-prints',
  'clue-many-prints',
  'clue-broken-jar',
  'clue-cut-purse',
  'clue-torn-cloth',
  'clue-drag-marks',
];

export const ROAD_ADVICE_CLUES = [
  'clue-bend-watchers',
  'clue-cistern',
  'clue-wadi-dead-end',
  'clue-caravan',
  'clue-wadi-fastest',
  'clue-map',
];

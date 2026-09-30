import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const visited = (scene: string): Condition => ({ type: 'visited', scene });
const SEEN = flag('seen:scripture-connection');

type Entry = ChapterInput['journal'][number];

const person = (
  id: string,
  title: string,
  summary: string,
  characterId: string,
  order: number,
  extra: string[] = [],
): Entry => ({
  id,
  category: 'people',
  title,
  summary,
  recordIds: [`rec-p-${characterId}`, ...extra],
  characterId,
  order,
});

/**
 * The journal. Each entry is a list of labelled ContentRecords, so the
 * journal always shows whether a paragraph is Scripture, paraphrase,
 * history, reconstruction, interpretation or story.
 */
export const JOURNAL: ChapterInput['journal'] = [
  // People (unlocked on meeting, via each character's journalEntry)
  person('jp-shelomit', 'Grandmother Shelomit', 'Your grandmother, a net-mender', 'shelomit', 1),
  person('jp-elazar', 'Uncle Elazar', 'Master of the family boat', 'elazar', 2, [
    'rec-hist-fishing-economy',
  ]),
  person('jp-tamar', 'Tamar', 'Your cousin, a rower', 'tamar', 3),
  person('jp-yoezer', 'Yoezer', 'A hired man on the family boat', 'yoezer', 4),
  person('jp-hanina', 'Old Hanina', 'A fisherman who reads the sky', 'hanina', 5),
  person('jp-nikanor', 'Nikanor', 'A salt-fish trader from Magdala', 'nikanor', 6),
  person('jp-shifra', 'Shifra', 'A potter’s wife from the hills', 'shifra', 7),
  person('jp-ami', 'Ami', 'Shifra’s son', 'ami', 8),
  person('jp-oded', 'Oded', 'Shifra’s brother, a potter', 'oded', 9),
  person('jp-dinah', 'Dinah', 'A listener in the crowd', 'dinah', 10),

  // Places
  {
    id: 'jpl-house',
    category: 'places',
    title: 'Grandmother’s house',
    summary: 'Where your crossing began',
    recordIds: ['rec-pl-house'],
    unlockWhen: visited('shelomit-house'),
    order: 1,
  },
  {
    id: 'jpl-capernaum',
    category: 'places',
    title: 'Capernaum',
    summary: 'A fishing village on the lake',
    recordIds: ['rec-pl-shore', 'rec-hist-capernaum', 'rec-recon-shore', 'rec-matt-4-13-18'],
    unlockWhen: visited('capernaum-shore'),
    order: 2,
  },
  {
    id: 'jpl-lake',
    category: 'places',
    title: 'The Sea of Galilee',
    summary: 'A lake below sea level',
    recordIds: ['rec-pl-lake', 'rec-hist-lake'],
    unlockWhen: visited('open-lake'),
    order: 3,
  },
  {
    id: 'jpl-magdala',
    category: 'places',
    title: 'Magdala',
    summary: 'Nikanor’s town, famous for salted fish',
    recordIds: ['rec-hist-salting'],
    unlockWhen: flag('asked-salt'),
    order: 4,
  },

  // Events
  {
    id: 'je-mission',
    category: 'events',
    title: 'Your first crossing',
    summary: 'Nikanor’s jars, and a place in the crew',
    recordIds: ['rec-e-mission'],
    order: 1,
  },
  {
    id: 'je-brine',
    category: 'events',
    title: 'Nikanor’s jar net',
    summary: 'Every knot where it should be',
    recordIds: ['rec-p-nikanor'],
    order: 2,
  },
  {
    id: 'je-storm',
    category: 'events',
    title: 'The storm',
    summary: 'A squall in the dark',
    recordIds: ['rec-e-storm'],
    unlockWhen: flag('storm-broke'),
    order: 3,
  },
  {
    id: 'je-calm',
    category: 'events',
    title: 'The calm',
    summary: 'All at once',
    recordIds: ['rec-e-calm'],
    unlockWhen: flag('great-calm'),
    order: 4,
  },
  {
    id: 'je-home',
    category: 'events',
    title: 'Home before dawn',
    summary: 'Grandmother’s lamp on the jetty',
    recordIds: ['rec-e-home'],
    order: 5,
  },
  {
    id: 'je-story',
    category: 'events',
    title: 'What happened in the teacher’s boat',
    summary: 'Mark 4:35–41',
    recordIds: ['rec-para-mark-4', 'rec-mark-4-35-41'],
    unlockWhen: SEEN,
    order: 6,
  },

  // History & culture
  {
    id: 'jh-storms',
    category: 'history',
    title: 'Storms on the lake',
    summary: 'Why the wind comes suddenly',
    recordIds: ['rec-hist-storms'],
    unlockWhen: { type: 'clueFound', clue: 'clue-hanina-east' },
    order: 1,
  },
  {
    id: 'jh-boat',
    category: 'history',
    title: 'A boat from Jesus’ time',
    summary: 'Found in the mud at Ginosar, 1986',
    recordIds: ['rec-hist-galilee-boat', 'rec-hist-cushion'],
    unlockWhen: { type: 'any', of: [flag('heard-old-boat'), visited('open-lake')] },
    order: 2,
  },
  {
    id: 'jh-nets',
    category: 'history',
    title: 'Nets on the lake',
    summary: 'Cast nets, dragnets and trammel nets',
    recordIds: ['rec-hist-nets', 'rec-matt-13-47-48'],
    unlockWhen: flag('got-gear'),
    order: 3,
  },
  {
    id: 'jh-fishing',
    category: 'history',
    title: 'A family business',
    summary: 'Crews, hired men and partners',
    recordIds: ['rec-hist-fishing-economy', 'rec-mark-1-16-21', 'rec-luke-5-1-11'],
    unlockWhen: { type: 'met', character: 'yoezer' },
    order: 4,
  },
  {
    id: 'jh-salting',
    category: 'history',
    title: 'Salted fish',
    summary: 'Taricheae, “the salting place”',
    recordIds: ['rec-hist-salting'],
    unlockWhen: flag('asked-salt'),
    order: 5,
  },
  {
    id: 'jh-fish',
    category: 'history',
    title: 'Fish of the lake',
    summary: 'Musht, sardines, barbels — and catfish',
    recordIds: ['rec-hist-fish', 'rec-lev-11-9-12'],
    unlockWhen: flag('saw-catch'),
    order: 6,
  },
  {
    id: 'jh-sail',
    category: 'history',
    title: 'Handling a boat in a squall',
    summary: 'Sail, yard, oars, bail',
    recordIds: ['rec-recon-boat-handling'],
    unlockWhen: { type: 'puzzleSolved', puzzle: 'p-sail' },
    order: 7,
  },
  {
    id: 'jh-other-boats',
    category: 'history',
    title: '“Other boats were with him”',
    summary: 'A detail only Mark gives',
    recordIds: ['rec-hist-other-boats'],
    unlockWhen: SEEN,
    order: 8,
  },

  // Scripture
  {
    id: 'js-mark-4',
    category: 'scripture',
    title: 'Mark 4:35–41',
    summary: 'The storm and the calm',
    recordIds: ['rec-mark-4-35-41', 'rec-para-mark-4'],
    unlockWhen: SEEN,
    order: 1,
  },
  {
    id: 'js-parallels',
    category: 'scripture',
    title: 'Matthew 8 and Luke 8',
    summary: 'The same story, told twice more',
    recordIds: ['rec-matt-8-23-27', 'rec-luke-8-22-25'],
    unlockWhen: SEEN,
    order: 2,
  },
  {
    id: 'js-teaching',
    category: 'scripture',
    title: 'Mark 4:1–9',
    summary: 'Teaching from a boat',
    recordIds: ['rec-mark-4-1-9', 'rec-para-shore', 'rec-para-dinah'],
    unlockWhen: { type: 'conversationDone', dialogue: 'd-opening' },
    order: 3,
  },
  {
    id: 'js-psalm-107',
    category: 'scripture',
    title: 'Psalm 107 and Jonah 1',
    summary: 'Older stories of storms at sea',
    recordIds: ['rec-psalm-107-23-30', 'rec-jonah-1-4-6', 'rec-psalm-89-9'],
    unlockWhen: SEEN,
    order: 4,
  },

  // Themes
  {
    id: 'jt-who',
    category: 'themes',
    title: '“Who then is this?”',
    summary: 'The question Mark leaves us with',
    recordIds: ['rec-interp-who-is-this', 'rec-interp-echoes'],
    unlockWhen: SEEN,
    order: 1,
  },
  {
    id: 'jt-fear',
    category: 'themes',
    title: 'Fear, and turning to him',
    summary: 'Being afraid is not the same as having failed',
    recordIds: ['rec-interp-fear-faith'],
    unlockWhen: SEEN,
    order: 2,
  },
  {
    id: 'jt-same-storm',
    category: 'themes',
    title: 'In the same storm',
    summary: 'Everyone in the other boats',
    recordIds: ['rec-interp-same-storm'],
    unlockWhen: { type: 'choiceMade', choice: 'choice-storm' },
    order: 3,
  },
  {
    id: 'jt-readings',
    category: 'themes',
    title: 'How Christians have read the story',
    summary: 'More than one way of reading',
    recordIds: ['rec-interp-boat-church', 'rec-interp-miracle-views'],
    unlockWhen: SEEN,
    order: 4,
  },

  // Maps
  {
    id: 'jm-crossing',
    category: 'maps',
    title: 'The crossing',
    summary: 'From Capernaum toward the far shore',
    recordIds: ['rec-map-crossing'],
    unlockWhen: visited('open-lake'),
    order: 1,
  },
];

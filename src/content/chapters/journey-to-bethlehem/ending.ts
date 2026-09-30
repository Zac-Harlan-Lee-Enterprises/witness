import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const chose = (choice: string, option?: string): Condition =>
  option === undefined ? { type: 'choiceMade', choice } : { type: 'choiceMade', choice, option };
const stranger = (option: string) => chose('choice-stranger', option);
const all = (...of: Condition[]): Condition => ({ type: 'all', of });
const not = (condition: Condition): Condition => ({ type: 'not', condition });

/**
 * Act 6 — the Scripture Connection — and Act 7 — the summary. Comparisons
 * respond to what the player actually did; none of them grades it.
 */
export const SCRIPTURE_CONNECTION: ChapterInput['scriptureConnection'] = {
  title: 'Good News in David’s Town',
  intro:
    'Hagit repeated what the shepherds said. That was part of a made-up story; this passage is Scripture — Luke 2:1–20. Here is what the passage contains, what we know about its world, and some ways Christians have understood it. Each part is labeled so you can tell them apart.',
  sections: [
    { heading: 'The passage', recordIds: ['rec-luke-2-1-20', 'rec-para-luke-2'] },
    {
      heading: 'The emperor’s registration',
      recordIds: [
        'rec-hist-census',
        'rec-hist-quirinius',
        'rec-hist-own-city',
        'rec-recon-declaration',
      ],
    },
    {
      heading: 'The world of the story',
      recordIds: [
        'rec-hist-bethlehem',
        'rec-recon-house',
        'rec-hist-manger',
        'rec-hist-swaddling',
        'rec-hist-shepherds',
        'rec-hist-shepherd-status',
        'rec-hist-hospitality',
      ],
    },
    {
      heading: 'How Christians have read it',
      recordIds: [
        'rec-interp-good-news',
        'rec-interp-katalyma',
        'rec-interp-wonder',
        'rec-interp-two-accounts',
        'rec-interp-date',
        'rec-hist-cave',
      ],
    },
  ],
  comparisons: [
    {
      text: 'All day your family made room in a house that was already full. Luke says the baby was laid in a feeding trough because there was no room for them in the katalyma — an inn, or a guest room (Luke 2:7). Luke doesn’t say that anyone turned them away.',
    },
    {
      when: stranger('own-place'),
      text: 'You gave Zerah your own place by the fire and slept in the straw, beside the stone mangers. In Luke’s story, a newborn was laid in a feeding trough.',
    },
    {
      when: stranger('guest-room'),
      text: 'Because you left a space in the guest room that afternoon, there was room for Zerah that night. Luke says there was no room in the katalyma for Mary and Joseph.',
    },
    {
      when: stranger('straw-bed'),
      text: 'You made Zerah a bed of straw at the animals’ end of the house — the kind of place where a feeding trough would stand.',
    },
    {
      when: stranger('hagit'),
      text: 'You walked Zerah to a neighbor who had room. Making room sometimes means asking someone else to help.',
    },
    {
      when: stranger('no-room'),
      text: 'Your house really was full, and you said so. Luke doesn’t say who had no room, or why — only that there was no room for them.',
    },
    {
      when: chose('choice-lamb', 'found'),
      text: 'You went looking for one lost lamb as night came on. Luke says shepherds were out in the fields, keeping watch over their flock by night, when the angel came to them (Luke 2:8–9).',
    },
    {
      when: chose('choice-news', 'told'),
      text: 'You woke the house, and everyone who heard the news wondered. Luke says all who heard what the shepherds said wondered at it (Luke 2:18).',
    },
    {
      when: chose('choice-news', 'kept'),
      text: 'You kept the news to think about in the quiet. Luke says Mary kept all these things and thought about them deeply (Luke 2:19).',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-register' },
      text: 'You helped a clerk write down one household. Luke says it was the emperor’s registration that brought Joseph to Bethlehem (Luke 2:1–5).',
    },
  ],
};

export const SUMMARY: ChapterInput['summary'] = {
  recap: [
    {
      text: 'The emperor’s registration filled Bethlehem, and your family’s house, with people coming home to be written down.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-bread' },
      text: 'You baked the guests’ bread and worked out who would sit where for supper.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-room' },
      text: 'You fitted the beds into the small guest room, and decided what else stayed.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-register' },
      text: 'You helped Kallias the clerk write down Uncle Asa’s household.',
    },
    { when: flag('supper-delivered'), text: 'You took Yonatan his supper at the fold.' },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-lamb' },
      text: 'You read the signs around the fold and worked out where the lost lamb had gone.',
    },
    {
      when: chose('choice-lamb', 'found'),
      text: 'You carried the speckled lamb back on your shoulders.',
    },
    {
      when: chose('choice-lamb', 'left'),
      text: 'You went home at dusk and left the search to the shepherds.',
    },
    {
      when: flag('zerah-arrived'),
      text: 'After dark, an old man named Zerah knocked at the door.',
    },
    {
      when: flag('heard-report'),
      text: 'Late that night, Hagit told you what shepherds from the fields had been telling everyone.',
    },
  ],
  consequences: [
    {
      id: 'room-grain',
      when: chose('choice-room', 'kept-grain'),
      text: 'The barley stayed safe in the guest room; Tamar’s loom and Uncle Asa’s tools spent the night with the donkeys.',
    },
    {
      id: 'room-loom',
      when: chose('choice-room', 'kept-loom'),
      text: 'The loom stayed in the guest room; the barley went up to the dry corner of the roof.',
    },
    {
      id: 'room-tools',
      when: chose('choice-room', 'kept-tools'),
      text: 'Uncle Asa slept beside his tools; the loom went down by the animals.',
    },
    {
      id: 'room-space',
      when: chose('choice-room', 'made-space'),
      text: 'You emptied the guest room of everything but beds, leaving a space for one more.',
    },
    {
      id: 'asa-early',
      when: { type: 'puzzleSolved', puzzle: 'p-register' },
      text: 'Uncle Asa was registered before dark and came home to help.',
    },
    {
      id: 'asa-waited',
      when: { type: 'questStatus', quest: 'q-queue', status: 'failed' },
      text: 'Uncle Asa waited in line until the clerk packed up at dusk.',
    },
    {
      id: 'lamb-found',
      when: chose('choice-lamb', 'found'),
      text: 'The speckled lamb spent the night back beside its mother.',
    },
    {
      id: 'lamb-left',
      when: chose('choice-lamb', 'left'),
      text: 'You were home before dark. Old Yoram found the lamb in the gully near midnight, cold but safe.',
    },
    {
      id: 'zerah-own',
      when: stranger('own-place'),
      text: 'Zerah slept by the fire in your place, and you slept in the straw beside the animals.',
    },
    {
      id: 'zerah-guest',
      when: stranger('guest-room'),
      text: 'Zerah slept in the guest room, in the space you had left that afternoon.',
    },
    {
      id: 'zerah-straw',
      when: stranger('straw-bed'),
      text: 'Zerah slept on fresh straw beside the animals, warm from their breath.',
    },
    {
      id: 'zerah-hagit',
      when: stranger('hagit'),
      text: 'Zerah slept under Hagit’s dry roof next door.',
    },
    {
      id: 'zerah-well',
      when: stranger('no-room'),
      text: 'Zerah spent the night wrapped in his cloak by the well. In the morning Hagit found him there and brought him bread.',
    },
    {
      id: 'news-told',
      when: chose('choice-news', 'told'),
      text: 'Everyone in the house heard the shepherds’ news that night, and wondered at it.',
    },
    {
      id: 'news-kept',
      when: all(chose('choice-news', 'kept'), not(stranger('no-room'))),
      text: 'You let the house sleep and lay awake thinking about the shepherds’ news.',
    },
    {
      id: 'news-kept-alone',
      when: all(chose('choice-news', 'kept'), stranger('no-room')),
      text: 'You let the house sleep and lay awake thinking about the shepherds’ news — and about the old man by the well.',
    },
    {
      id: 'always',
      when: { type: 'always' },
      text: 'Everyone in your house had bread and a place to sleep that night.',
    },
  ],
  themes: ['hospitality', 'stewardship', 'lost', 'discernment', 'family', 'good-news', 'wonder'],
  scriptureRecordIds: [
    'rec-luke-2-1-20',
    'rec-luke-22-11',
    'rec-matt-2-1-11',
    'rec-mic-5-2',
    'rec-acts-5-37',
    'rec-gen-18-1-8',
    'rec-lev-19-34',
    'rec-1sam-16-17',
    'rec-2sam-23-15',
    'rec-ruth-bethlehem',
    'rec-john-10-1-4',
    'rec-jer-33-13',
    'rec-ezek-16-4',
  ],
  historyRecordIds: [
    'rec-hist-census',
    'rec-hist-quirinius',
    'rec-hist-own-city',
    'rec-recon-declaration',
    'rec-hist-bethlehem',
    'rec-recon-house',
    'rec-hist-manger',
    'rec-hist-shepherds',
    'rec-hist-shepherd-status',
    'rec-hist-cave',
  ],
  reflectionPrompts: [
    'When was it hardest to make room today — in the house, or in your plans? Why?',
    'Luke says the good news came first to shepherds working through the night. Why do you think the story begins with them?',
    'Luke says that everyone who heard the shepherds wondered. What in this story makes you wonder?',
  ],
};

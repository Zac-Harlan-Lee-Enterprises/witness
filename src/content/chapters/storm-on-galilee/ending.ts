import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const all = (...of: Condition[]): Condition => ({ type: 'all', of });
const any = (...of: Condition[]): Condition => ({ type: 'any', of });
const storm = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-storm',
  option,
});
const ami = (option: string): Condition => ({ type: 'choiceMade', choice: 'choice-ami', option });

/**
 * Act 6 — the Scripture Connection — and Act 7 — the summary.
 * Comparisons respond to what the player actually did, and never grade it.
 * Nothing links what the player chose to the calm: the storm stopped the
 * same way on every path.
 */
export const SCRIPTURE_CONNECTION: ChapterInput['scriptureConnection'] = {
  title: 'What Happened in the Boat Ahead',
  intro:
    'Your crossing was a made-up story; this passage is Scripture. You were in one of the “other boats” — close enough to share the storm, too far away to see what happened in the boat ahead. Here is what Mark wrote, what we know about its world, and some of the ways Christians have understood it. Each part is labeled so you can tell them apart.',
  sections: [
    { heading: 'The passage', recordIds: ['rec-mark-4-35-41', 'rec-para-mark-4'] },
    {
      heading: 'The same story in Matthew and Luke',
      recordIds: ['rec-matt-8-23-27', 'rec-luke-8-22-25', 'rec-hist-other-boats'],
    },
    {
      heading: 'The world of the story',
      recordIds: [
        'rec-hist-lake',
        'rec-hist-storms',
        'rec-hist-galilee-boat',
        'rec-hist-cushion',
        'rec-hist-nets',
        'rec-hist-fishing-economy',
      ],
    },
    {
      heading: 'Echoes of older Scripture',
      recordIds: ['rec-interp-echoes', 'rec-psalm-107-23-30', 'rec-psalm-89-9', 'rec-jonah-1-4-6'],
    },
    {
      heading: 'How Christians have read it',
      recordIds: [
        'rec-interp-who-is-this',
        'rec-interp-fear-faith',
        'rec-interp-boat-church',
        'rec-interp-miracle-views',
        'rec-interp-same-storm',
      ],
    },
  ],
  comparisons: [
    {
      text: 'You were in one of the “other boats.” Mark mentions them in a few words and then tells us only what happened in the boat where Jesus was asleep. What was it like to be close to that story, but not inside it?',
    },
    {
      text: 'You read the sky and got ready — and the storm still came. In Mark’s story, the boat was full of people who knew the lake, and they were afraid too. Being prepared doesn’t mean nothing goes wrong.',
    },
    {
      when: storm('take-aboard'),
      text: 'In the storm, you made room in a crowded boat for people in danger. In Mark’s story, the frightened disciples cried out to Jesus, asking whether he cared that they were dying. How do people in a storm find out who cares for them?',
    },
    {
      when: any(storm('tow'), storm('oar')),
      text: 'You shared what you had — a rope, an oar — so another boat could hold on. One preacher said we may be “in the same storm” without being “in the same boat.” Who were you in the same storm with?',
    },
    {
      when: storm('hold-course'),
      text: 'You kept your own boat afloat, and went to the little boat once you could. Fear and responsibility were both real that night. In Mark’s story, the disciples were afraid too — and they turned to Jesus.',
    },
    {
      when: flag('jettisoned'),
      text: 'You threw valuable cargo overboard to lighten the boat. In Jonah 1:5, frightened sailors in a great storm did the same thing.',
    },
    {
      when: any(ami('room'), ami('made-room')),
      text: 'Before the storm, you found room for Ami in your boat. Small choices made on the shore can matter a great deal out on the water.',
    },
  ],
};

export const SUMMARY: ChapterInput['summary'] = {
  recap: [
    {
      text: 'Your grandmother sent you out as crew on the family boat for the first time, to carry Nikanor’s jars across the lake.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-sky' },
      text: 'On the jetty, you weighed Hanina’s warning and the signs along the shore, and read the sky.',
    },
    {
      when: flag('brine-done'),
      text: 'You measured Nikanor’s brine for him, exactly.',
    },
    { when: { type: 'puzzleSolved', puzzle: 'p-load' }, text: 'You loaded the boat.' },
    {
      when: { type: 'visited', scene: 'open-lake' },
      text: 'At evening, your boat went out with the others behind the teacher’s boat.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-sail' },
      text: 'When the squall hit, you got the sail in in the right order.',
    },
    {
      when: { type: 'choiceMade', choice: 'choice-storm' },
      text: 'In the storm, you decided what to do for the little boat alongside.',
    },
    { when: flag('great-calm'), text: 'Then the wind stopped — all at once.' },
    {
      when: flag('returned'),
      text: 'Your family turned for home, and Grandmother was waiting on the jetty with a lamp.',
    },
  ],
  consequences: [
    {
      id: 'shifra-aboard',
      when: storm('take-aboard'),
      text: 'Shifra’s family rode out the storm in your boat, and their little boat was towed home empty.',
    },
    {
      id: 'shifra-towed',
      when: storm('tow'),
      text: 'Your rope held, and the two boats came home tied together.',
    },
    {
      id: 'shifra-oar',
      when: storm('oar'),
      text: 'With your spare oar, Oded kept their bow to the waves until the wind dropped.',
    },
    {
      id: 'shifra-alone',
      when: storm('hold-course'),
      text: 'You kept your own boat afloat. When the wind dropped, you found the little boat swamped but afloat, with everyone in it.',
    },
    {
      id: 'ami-with-you',
      when: any(ami('room'), ami('made-room')),
      text: 'Ami crossed in your boat, beside you.',
    },
    {
      id: 'ami-cloak',
      when: { type: 'choiceMade', choice: 'choice-cloak', option: 'given' },
      text: 'Ami went home wrapped in your cloak.',
    },
    {
      id: 'jars-lost',
      when: flag('jettisoned'),
      text: 'Three of Nikanor’s jars went over the side. Uncle Elazar will pay for them from his catch — a lean month for the family.',
    },
    {
      id: 'jars-ashore',
      when: all(flag('left-jars'), not(flag('jettisoned'))),
      text: 'The jars you left on the shore were safe on the rack, ready to cross with the Magdala boats.',
    },
    {
      id: 'jars-safe',
      when: all(not(flag('jettisoned')), not(flag('left-jars'))),
      text: 'Nikanor’s jars came home with you, safe to cross another night.',
    },
    {
      id: 'brine',
      when: flag('brine-done'),
      text: 'Nikanor’s brine was ready for the morning’s catch.',
    },
    {
      id: 'brine-open',
      when: { type: 'questStatus', quest: 'q-brine', status: 'failed' },
      text: 'Nikanor’s brine was left unmeasured when you cast off.',
    },
    {
      id: 'always',
      when: { type: 'always' },
      text: 'Everyone who went out with your boat came home.',
    },
  ],
  themes: [
    'fear-trust',
    'neighbor',
    'courage',
    'stewardship',
    'preparation',
    'discernment',
    'wonder',
  ],
  scriptureRecordIds: [
    'rec-mark-4-35-41',
    'rec-matt-8-23-27',
    'rec-luke-8-22-25',
    'rec-mark-4-1-9',
    'rec-mark-5-1',
    'rec-psalm-107-23-30',
    'rec-psalm-89-9',
    'rec-jonah-1-4-6',
    'rec-mark-1-16-21',
    'rec-luke-5-1-11',
  ],
  historyRecordIds: [
    'rec-hist-lake',
    'rec-hist-storms',
    'rec-hist-galilee-boat',
    'rec-hist-cushion',
    'rec-hist-nets',
    'rec-hist-fishing-economy',
    'rec-hist-salting',
    'rec-hist-capernaum',
    'rec-hist-fish',
    'rec-hist-other-boats',
  ],
  reflectionPrompts: [
    'When during the crossing were you most afraid? What helped?',
    'Mark’s story ends with the disciples asking, “Who then is this?” How would you answer that question?',
    'Who do you know who is in a kind of storm right now? What could you do for them?',
  ],
};

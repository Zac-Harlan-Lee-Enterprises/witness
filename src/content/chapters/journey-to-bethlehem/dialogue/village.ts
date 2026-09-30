import {
  all,
  chose,
  clue,
  flag,
  not,
  opt,
  paraphrase,
  questActive,
  say,
  setFlag,
  solved,
  type DialogueInput,
} from './helpers';
import { KID_CLUES } from '../clues';

const startQueue = { type: 'startQuest' as const, quest: 'q-queue' };
/** Hagit's kid is out, and you are looking for it (to get Dodi's milk). */
const kidHunt = all(flag('kid-missing'), not(flag('kid-home')));
const discover = (id: string) => ({ type: 'discoverClue' as const, clue: id });
/** Uncle Asa's "lamb with little horns" turns out to have been Hagit's kid. */
export const KID_SEEN_BY_ASA =
  'A goat? …Oh. My “lamb” with the little horns. It came back past the line with a scrap of blue cloth in its mouth, bold as a king, and went straight on to the well.';
const kidQuestion = opt('kid', 'Did you see a little white goat go past?', 'kid', {
  once: true,
  when: kidHunt,
});

/**
 * The crowded lanes during the registration. Saba Amram's retelling of the
 * well story is a labelled paraphrase (2 Samuel 23:15–16). Kallias and his
 * tablet are fictional; the order of a declaration is modelled on census
 * returns from Roman Egypt (record rec-recon-declaration).
 */
export const VILLAGE_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-amram',
    characterId: 'amram',
    start: 'a1',
    nodes: [
      say(
        'a1',
        'amram',
        '{player}! Come to rescue your old grandfather? Every family that ever belonged to Bethlehem has come home at once.',
        { expression: 'glad', next: 'hub' },
      ),
      say('hub', 'amram', 'The clerk writes, and I tell him who is who.', {
        choices: [
          opt('job', 'What are you doing here?', 'job', { once: true }),
          opt('slow', 'Why is the line so slow?', 'slow', { once: true }),
          opt('well', 'Tell me about the well.', 'well', { once: true }),
          opt('kid', 'Have you seen Hagit’s little white kid?', 'kid', {
            once: true,
            when: kidHunt,
          }),
          opt('bye', 'Goodbye, Saba.'),
        ],
      }),
      say(
        'job',
        'amram',
        'I know every family in this town — whose grandfather owned which field, whose roof leaks. Kallias writes it down; I make sure he writes it down right.',
        { next: 'hub' },
      ),
      say(
        'slow',
        'amram',
        'Every household must be written down: who is declaring, who lives with them and how old they are, and what they own. Your Uncle Asa has been standing in that line since midday.',
        { effects: [startQueue], next: 'hub' },
      ),
      say(
        'well',
        'amram',
        'When David was hiding from the Philistines, he longed for a drink from the well of Bethlehem by the gate. Three of his mighty men broke through the enemy camp to fetch it — and David wouldn’t drink it. He poured it out to the Lord.',
        paraphrase('rec-para-well', {
          effects: [setFlag('heard-well')],
          next: 'well2',
        }),
      ),
      say(
        'well2',
        'amram',
        'Whether it was this very well, nobody really knows. But we like to think so.',
        { next: 'hub' },
      ),
      say(
        'kid',
        'amram',
        'That little thief? The travellers by the cart were shouting about their nibbled barley long before anybody’s washing got chewed. Whatever else she did, the barley came first.',
        { expression: 'glad', effects: [discover('clue-kid-amram')], next: 'hub' },
      ),
    ],
  },
  {
    id: 'd-kallias',
    characterId: 'kallias',
    entries: [
      { when: solved('p-register'), node: 'done' },
      { when: flag('kallias-help'), node: 'waiting' },
    ],
    start: 'k1',
    nodes: [
      say(
        'k1',
        'kallias',
        'Name? Household? Property? — oh. You’re a child. Forgive me; I’ve been saying those three words since dawn.',
        { expression: 'surprised', next: 'hub' },
      ),
      say('hub', 'kallias', 'Next! …Not you. You’re fine.', {
        choices: [
          opt('who', 'Who are you?', 'who', { once: true }),
          opt('home', 'Where do you sleep tonight, with every house full?', 'home', {
            once: true,
          }),
          opt('help', 'Could I help? My uncle has been waiting since midday.', 'help', {
            when: not(flag('kallias-help')),
            effects: [startQueue],
          }),
          kidQuestion,
          opt('bye', 'Goodbye.'),
        ],
      }),
      say(
        'who',
        'kallias',
        'Kallias, a scribe. They need everyone who can write to take down the registration. By tonight my hand will fall off.',
        { next: 'hub' },
      ),
      say(
        'help',
        'kallias',
        'Help? Hm. Look at the finished tablet on the table — every declaration goes in the same order. Give me your uncle’s details in that order and I can write them straight down.',
        { effects: [setFlag('kallias-help')] },
      ),
      say(
        'home',
        'kallias',
        'Where the registration sends me. Last night it was a storeroom full of onions, and tonight I expect it will be something worse. A clerk goes where the lists go.',
        { next: 'hub' },
      ),
      say(
        'kid',
        'kallias',
        'I see everything that goes past this table; I have nothing else to look at. A white kid came to drink at the well trough — already chewing something when it got there. Then it wandered off again. Somewhere with more to eat, I expect.',
        { effects: [discover('clue-kid-kallias')], next: 'kid2' },
      ),
      say('kid2', 'kallias', 'Name? Household? Property? …Sorry. Habit.', {
        expression: 'glad',
        branches: [
          { when: solved('p-register'), next: 'done' },
          { when: flag('kallias-help'), next: 'waiting' },
        ],
        next: 'hub',
      }),
      say(
        'waiting',
        'kallias',
        'Found the order on my finished tablet? The blank one is ready for your uncle.',
        { choices: [kidQuestion, opt('bye', 'I’ll look.')] },
      ),
      say(
        'done',
        'kallias',
        'Asa son of Amram — written down and done. If only every household were so tidy.',
        { expression: 'glad', choices: [kidQuestion, opt('bye', 'Goodbye, Kallias.')] },
      ),
    ],
  },
  {
    id: 'd-asa-queue',
    characterId: 'asa',
    start: 'q1',
    nodes: [
      say(
        'q1',
        'asa',
        '{player}! Tell your mother I’m still alive. I’ve been in this line since midday. I have counted every stone in that wall. Twice.',
        { effects: [startQueue], next: 'hub' },
      ),
      say('hub', 'asa', 'Still here. Still waiting.', {
        choices: [
          opt('why', 'Why did you have to come to Bethlehem?', 'why', { once: true }),
          opt('seen', 'Seen anything interesting while you waited?', 'seen', { once: true }),
          opt('help', 'Maybe I can help speed things up.', 'help', {
            once: true,
            when: not(flag('kallias-help')),
          }),
          opt('kid', 'Have you seen a little white goat kid?', 'kid', {
            once: true,
            when: kidHunt,
          }),
          opt('bye', 'Hang in there, Uncle.'),
        ],
      }),
      say(
        'why',
        'asa',
        'Our family belongs to Bethlehem, whatever Jerusalem thinks. I still own a share of your house, you know. So here I stand.',
        { next: 'hub' },
      ),
      say(
        'seen',
        'asa',
        'Interesting? A little white lamb went trotting up the lane a while ago, bold as a king. …Or was it a goat? It had little horns, now I think of it.',
        {
          expression: 'glad',
          effects: [{ type: 'discoverClue', clue: 'clue-asa-lamb' }],
          next: 'hub',
        },
      ),
      say(
        'help',
        'asa',
        'If you can make that clerk go any faster, I’ll carve you a donkey like Dodi’s.',
        { next: 'hub' },
      ),
      say('kid', 'asa', KID_SEEN_BY_ASA, {
        expression: 'surprised',
        effects: [discover('clue-asa-lamb'), discover('clue-kid-asa')],
        next: 'hub',
      }),
    ],
  },
  {
    id: 'd-hagit',
    characterId: 'hagit',
    entries: [
      { when: all(flag('evening'), chose('choice-stranger', 'hagit')), node: 'night-zerah' },
      { when: flag('evening'), node: 'night' },
      { when: flag('carrying-kid'), node: 'return' },
      { when: all(solved('p-kid'), not(flag('kid-home'))), node: 'fetch' },
    ],
    start: 'h1',
    nodes: [
      say(
        'h1',
        'hagit',
        'Mind my goats, child — that little white one escapes if you so much as look at her. Bethlehem hasn’t been this full since I was a girl.',
        { next: 'hub' },
      ),
      say('hub', 'hagit', 'Well? What is it?', {
        choices: [
          opt('milk', 'Mother asks if you could spare a jar of milk for little Dodi.', 'milk', {
            when: all(flag('supper-given'), not(flag('asked-milk')), not(flag('got-milk'))),
            effects: [setFlag('asked-milk')],
          }),
          opt('think', 'I think I know where your kid went.', undefined, {
            when: all(flag('kid-missing'), not(solved('p-kid'))),
            requires: { type: 'cluesFound', clues: KID_CLUES, min: 3 },
            unavailableText:
              'You don’t know enough yet. Saba Amram, Uncle Asa and Kallias the clerk have been in the lanes all afternoon — ask each of them.',
            effects: [{ type: 'openPuzzle', puzzle: 'p-kid' }],
          }),
          opt('full', 'Is your house full of guests too?', 'full', { once: true }),
          opt('flock', 'Do you know our family’s sheep?', 'flock', { once: true }),
          opt('kid', 'Did one of your goats get out today?', 'kid', {
            once: true,
            when: all(clue('clue-asa-lamb'), not(flag('kid-missing'))),
          }),
          opt('bye', 'Goodbye, Hagit.'),
        ],
      }),
      say(
        'milk',
        'hagit',
        'Milk? Gladly — if I could get near my nanny goat. Her little white kid is off again, and she won’t stand still for anyone while she’s calling for it. And I can’t go chasing up the lanes on these knees.',
        { expression: 'surprised', effects: [setFlag('kid-missing')], next: 'milk2' },
      ),
      say(
        'milk2',
        'hagit',
        'Find my kid and bring her home, and you’ll have your milk. Ask around — somebody always sees a white kid. Your grandfather, the clerk, your uncle in that line: they’ve been standing in the lanes all afternoon.',
        { next: 'hub' },
      ),
      say(
        'full',
        'hagit',
        'Just me and the goats. My people are all gone, or far away. If you meet a tired soul with nowhere to sleep tonight, send them to me. My roof is dry.',
        {
          effects: [
            setFlag('hagit-offered'),
            { type: 'adjustTrust', character: 'hagit', delta: 1 },
          ],
          next: 'hub',
        },
      ),
      say(
        'flock',
        'hagit',
        'Know them? I’ve watched that flock go past my door for fifty years. Yonatan’s speckled lamb with the black ear is the worst of them — always wandering off after water, that one.',
        { effects: [{ type: 'discoverClue', clue: 'clue-hagit-water' }], next: 'hub' },
      ),
      say(
        'kid',
        'hagit',
        'My little white kid? She’s been up the lane three times this afternoon, the rascal — and this time she hasn’t come back. Why?',
        { expression: 'glad', effects: [setFlag('kid-missing')], next: 'hub' },
      ),
      say(
        'fetch',
        'hagit',
        'The threshing floor? The little thief — she’ll eat the chaff and the edging stones with it. Go and fetch her, child, before she does.',
        { expression: 'glad' },
      ),
      say(
        'return',
        'narrator',
        'You set the kid down inside the yard gate. Her mother butts her once, hard, and then licks her ears.',
        {
          effects: [
            { type: 'setFlag', flag: 'carrying-kid', value: false },
            setFlag('kid-home'),
            { type: 'adjustTrust', character: 'hagit', delta: 1 },
          ],
          next: 'return2',
        },
      ),
      say(
        'return2',
        'hagit',
        'There. Now she’ll stand for me. …A jar of milk for little Dodi, still warm. Tell Tamar it’s the least a neighbor can do.',
        {
          expression: 'glad',
          effects: [{ type: 'giveItem', item: 'milk' }, setFlag('got-milk')],
          next: 'return3',
        },
      ),
      say(
        'return3',
        'hagit',
        'When I was your age I lost a kid for a whole night. My father found her in the morning, asleep on top of the olive press, fat as a sack. He didn’t say a word to me. He carried her home and gave me the first cup of milk. I’ve never forgotten it.',
        { expression: 'glad', next: 'hub' },
      ),
      say('night', 'hagit', 'Go home to bed, child. It’s late, even for me.'),
      say('night-zerah', 'hagit', 'Your Zerah is asleep by my fire. He snores like a donkey.', {
        expression: 'glad',
      }),
    ],
  },
  {
    id: 'd-zerah-lane',
    characterId: 'zerah',
    entries: [{ when: chose('choice-stranger', 'hagit'), node: 'hagit' }],
    start: 'well',
    nodes: [
      say(
        'well',
        'zerah',
        'Go home and sleep, child. I have my cloak, and the stars are company enough.',
      ),
      say(
        'hagit',
        'zerah',
        'Your neighbor makes strong tea and asks a great many questions. Thank you, child.',
        { expression: 'glad' },
      ),
    ],
  },
  {
    id: 'd-lanes-intro',
    start: 'l1',
    nodes: [
      say(
        'l1',
        'narrator',
        'The lanes are packed with people who have come to be registered. Your grandfather is at the clerk’s table in the square by the east gate. The fold is out through that gate and down the terraces.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    // The clerk's blank tablet: explains what is missing, or opens the puzzle.
    id: 'd-register',
    entries: [
      { when: not(all(questActive('q-queue'), flag('kallias-help'))), node: 'busy' },
      { when: not(clue('clue-model-order')), node: 'read' },
    ],
    start: 'open',
    nodes: [
      say(
        'busy',
        'narrator',
        'The clerk’s blank tablet. Kallias is busy with the line — perhaps ask him whether you can help.',
        { kind: 'instruction' },
      ),
      say(
        'read',
        'narrator',
        'Before you give the clerk anything, look at his finished tablet so you know the order.',
        { kind: 'instruction' },
      ),
      say(
        'open',
        'narrator',
        'You pick up the blank tablet and think about Uncle Asa’s household.',
        {
          effects: [{ type: 'openPuzzle', puzzle: 'p-register' }],
        },
      ),
    ],
  },
];

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

const startQueue = { type: 'startQuest' as const, quest: 'q-queue' };

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
          opt('help', 'Could I help? My uncle has been waiting since midday.', 'help', {
            when: not(flag('kallias-help')),
            effects: [startQueue],
          }),
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
        'waiting',
        'kallias',
        'Found the order on my finished tablet? The blank one is ready for your uncle.',
      ),
      say(
        'done',
        'kallias',
        'Asa son of Amram — written down and done. If only every household were so tidy.',
        { expression: 'glad' },
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
    ],
  },
  {
    id: 'd-hagit',
    characterId: 'hagit',
    entries: [
      { when: all(flag('evening'), chose('choice-stranger', 'hagit')), node: 'night-zerah' },
      { when: flag('evening'), node: 'night' },
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
          opt('full', 'Is your house full of guests too?', 'full', { once: true }),
          opt('flock', 'Do you know our family’s sheep?', 'flock', { once: true }),
          opt('kid', 'Did one of your goats get out today?', 'kid', {
            once: true,
            when: clue('clue-asa-lamb'),
          }),
          opt('bye', 'Goodbye, Hagit.'),
        ],
      }),
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
        'My little white kid? She’s been up the lane and back three times this afternoon, the rascal. Why?',
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

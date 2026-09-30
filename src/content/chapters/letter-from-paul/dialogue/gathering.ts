import {
  all,
  chose,
  flag,
  not,
  opt,
  say,
  type DialogueInput,
  type NodeInput,
} from '../../road-to-jericho/dialogue/helpers';

const kallias = (option: string) => chose('choice-kallias', option);
/** You promised Chrysis a message for Melitta and haven't given it yet. */
const messagePending = all(
  { type: 'questStatus', quest: 'q-message', status: 'active' },
  not(flag('message-delivered')),
  not(flag('message-waited')),
);
const message = (option: string) => ({
  type: 'recordChoice' as const,
  choice: 'choice-message',
  option,
});
const debt = (option: string) => chose('choice-debt', option);

/** A line of the letter, retold in our own words and labelled as paraphrase. */
const retold = (id: string, recordId: string, text: string, next: string): NodeInput =>
  say(id, 'narrator', text, { kind: 'paraphrase', recordId, next });

/**
 * The evening gathering at Philemon's house. The New Testament does not say
 * where, when or by whom these letters were read aloud; this gathering and
 * its reader (Zenon) are FICTION (record rec-pl-house). The letters' contents
 * are given only as labelled paraphrase, checked against the WEB, and
 * Philemon, Tychicus and Onesimus never speak.
 */
export const GATHERING_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-gathering-arrive',
    start: 'g1',
    nodes: [
      say(
        'g1',
        'narrator',
        'Lamps burn on tall stands around the courtyard. The garden smells of wet earth. People keep arriving: weavers and dyers, a baker’s family, household slaves and the people who own them — all in the same courtyard.',
        { next: 'g2' },
      ),
      say(
        'g2',
        'narrator',
        'By the dining room stand two travellers, still in their road cloaks. One of them holds a leather letter case.',
        {
          effects: [{ type: 'setFlag', flag: 'saw-carriers', value: true }],
          next: 'g3',
        },
      ),
      say('g3', 'narrator', 'Find Ammia, near the couches.', {
        kind: 'instruction',
        branches: [{ when: messagePending, next: 'g3m' }],
      }),
      say(
        'g3m',
        'narrator',
        'Somewhere in this crowd is Chrysis’s sister, Melitta. Find her before the reading begins.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-ammia-gathering',
    characterId: 'ammia',
    entries: [{ when: flag('heard-the-letters'), node: 'later' }],
    start: 'a0',
    nodes: [
      say('a0', 'ammia', 'There you are!', {
        expression: 'glad',
        branches: [
          { when: messagePending, next: 'wait' },
          { when: kallias('come-now'), next: 'together' },
          { when: kallias('carry-reply'), next: 'carry' },
        ],
        next: 'alone',
      }),
      // You still have a message to give: Ammia notices, and lets you go.
      say(
        'wait',
        'ammia',
        'You’re looking round the room like someone who has lost a goat. Who is it?',
        {
          expression: 'surprised',
          choices: [
            opt('find', 'Chrysis’s sister, Melitta. I have a message for her.', 'wait-go'),
            opt('later', 'It can wait.', 'wait-on', {
              effects: [{ type: 'setFlag', flag: 'message-waited', value: true }],
            }),
          ],
        },
      ),
      say(
        'wait-go',
        'ammia',
        'Melitta, the baker’s wife? By the door, with the bread. Go on — Zenon is still finding his place in the letter.',
        { expression: 'glad' },
      ),
      say('wait-on', 'narrator', 'Ammia pats the bench beside her.', {
        branches: [
          { when: kallias('come-now'), next: 'together' },
          { when: kallias('carry-reply'), next: 'carry' },
        ],
        next: 'alone',
      }),
      // Kallias came home with you.
      say(
        'together',
        'narrator',
        'Ammia sees Kallias behind you. For a moment neither of them says anything.',
        { next: 'together2' },
      ),
      say('together2', 'kallias', 'I came.', { expression: 'worried', next: 'together3' }),
      say('together3', 'ammia', 'So you did. Wet as a fish.', {
        expression: 'glad',
        branches: [{ when: chose('choice-reading', 'softened'), next: 'confess' }],
        next: 'hush',
      }),
      say(
        'confess',
        'kallias',
        'Ammia — about the red batch. It wasn’t the madder. I lied about that.',
        { expression: 'sad', next: 'confess2' },
      ),
      say(
        'confess2',
        'narrator',
        'Ammia glances at you. You didn’t read her that part this morning. She doesn’t say a word about it.',
        {
          effects: [{ type: 'setFlag', flag: 'kallias-confessed', value: true }],
          next: 'hush',
        },
      ),
      // You carried his answer.
      say('carry', 'player', 'He answered. I wrote it down for him.', { next: 'carry2' }),
      say(
        'carry2',
        'narrator',
        'You open your tablets and read Kallias’s words to her quietly: the lie was his; he will come tomorrow; he will work for the rest.',
        { next: 'carry3' },
      ),
      say(
        'carry3',
        'ammia',
        'Tomorrow. Good. And he signed it himself — look at those letters, leaning like tired men.',
        { expression: 'glad', next: 'hush' },
      ),
      // You left it to him.
      say('alone', 'ammia', 'He didn’t come?', {
        expression: 'sad',
        choices: [opt('ready', 'He said he’ll come when he’s ready.', 'alone2')],
      }),
      say('alone2', 'ammia', 'Then we wait. I’ve waited all winter.', {
        expression: 'sad',
        next: 'alone3',
      }),
      say('alone3', 'ammia', 'How did he look? Tell me the truth.', {
        choices: [
          opt('thin', 'Thinner. He said he hadn’t eaten since yesterday.', 'alone-thin', {
            when: flag('shared-bread-kallias'),
          }),
          opt(
            'red',
            'Red to the elbows. And his red was clear and even — I saw a skein drying.',
            'alone-red',
          ),
          opt('scared', 'Scared. He ran and hid when he saw me coming.', 'alone-scared', {
            when: { type: 'puzzleSolved', puzzle: 'p-hiding' },
          }),
        ],
      }),
      say(
        'alone-thin',
        'ammia',
        'Hasn’t eaten. Of course he hasn’t. …Well. There will be bread in this house when he comes, whatever else there is.',
        { expression: 'sad', next: 'hush' },
      ),
      say(
        'alone-red',
        'ammia',
        'Clear and even? Hm. Somebody down there has taught him to stay by the vat. …Good.',
        { expression: 'surprised', next: 'hush' },
      ),
      say(
        'alone-scared',
        'ammia',
        'Ran from you? From you, who couldn’t frighten a sparrow? …Then he is more ashamed than I thought. That is something, at least. It means he knows.',
        { expression: 'sad', next: 'hush' },
      ),
      say(
        'hush',
        'narrator',
        'Someone asks for quiet. Zenon has been handed the letter case: he reads well, and his voice carries.',
        { next: 'who' },
      ),
      say(
        'who',
        'ammia',
        'The one who carried the case is Tychicus. He came from Paul. And the man beside him — that’s Onesimus. He’s from Philemon’s household. He has been with Paul.',
        { next: 'who2' },
      ),
      say(
        'who2',
        'ammia',
        'People say he ran off. People say all sorts of things. Hush, now — listen.',
        { effects: [{ type: 'startDialogue', dialogue: 'd-reading' }] },
      ),
      say('later', 'ammia', 'Go home when you’re ready, {player}. I want to sit here a while.'),
    ],
  },
  {
    id: 'd-reading',
    characterId: 'zenon',
    start: 'r1',
    nodes: [
      say(
        'r1',
        'narrator',
        'Zenon unrolls the longer letter first — the one to the whole assembly at Colossae. It takes a long time to read. Near the end, it names the people who carried it.',
        { next: 'r2' },
      ),
      retold(
        'r2',
        'rec-para-col-4',
        'Paul writes that Tychicus, a dear brother and a faithful helper, will tell them all his news. He is sending him to find out how they are and to encourage them, together with Onesimus, a faithful and dear brother who is one of their own.',
        'r3',
      ),
      retold(
        'r3',
        'rec-para-col-4',
        'He asks them to greet the believers in Laodicea, and Nymphas and the assembly in that house. Once the letter has been read among them, they are to have it read in Laodicea too — and to read the letter coming from Laodicea.',
        'r4',
      ),
      retold(
        'r4',
        'rec-para-col-4',
        'At the very end, Paul writes a greeting in his own hand and asks them to remember his chains.',
        'r5',
      ),
      say('r5', 'narrator', 'Then Zenon unfolds a shorter letter. People glance toward Philemon.', {
        next: 'r6',
      }),
      retold(
        'r6',
        'rec-para-philemon',
        'Paul, a prisoner, writes with Timothy to Philemon, to Apphia and Archippus, and to the assembly that meets in Philemon’s house, wishing them grace and peace.',
        'r7',
      ),
      retold(
        'r7',
        'rec-para-philemon',
        'He thanks God for Philemon’s love and faith, and says Philemon has refreshed the hearts of God’s people.',
        'r8',
      ),
      retold(
        'r8',
        'rec-para-philemon',
        'Paul says he could order Philemon to do what is right, but he would rather appeal to him out of love — an old man, and a prisoner. He appeals for Onesimus, who became like a son to him while Paul was in chains.',
        'r9',
      ),
      retold(
        'r9',
        'rec-para-philemon',
        'The name Onesimus means useful, and Paul plays on it: once he was useless to Philemon, but now he is useful to both of them.',
        'r10',
      ),
      retold(
        'r10',
        'rec-para-philemon',
        'Paul is sending him back, and says it is like sending his own heart. He would have liked to keep him, but did not want to do anything without Philemon agreeing freely.',
        'r11',
      ),
      retold(
        'r11',
        'rec-para-philemon',
        'Perhaps, Paul says, they were parted for a while so that Philemon could have him back for good — not as a slave any longer, but as something more than a slave: a brother he loves.',
        'r12',
      ),
      retold(
        'r12',
        'rec-para-philemon',
        'Paul asks Philemon to welcome Onesimus the way he would welcome Paul himself. If Onesimus has wronged him or owes him anything, Paul says, put it on Paul’s account. Paul writes that part in his own hand: he will pay it back.',
        'r13',
      ),
      retold(
        'r13',
        'rec-para-philemon',
        'He says he is sure Philemon will do even more than he asks, and tells him to get a guest room ready, because he hopes to be given back to them through their prayers.',
        'r14',
      ),
      retold(
        'r14',
        'rec-para-philemon',
        'The letter ends with greetings from Epaphras, who is in prison with Paul, and from Mark, Aristarchus, Demas and Luke.',
        'r15',
      ),
      say(
        'r15',
        'narrator',
        'Zenon folds the letter. For a long moment nobody says anything. Philemon is looking at Onesimus.',
        {
          effects: [{ type: 'setFlag', flag: 'heard-the-letters', value: true }],
          next: 'r16',
        },
      ),
      say(
        'r16',
        'narrator',
        'What Philemon said and did next, the letter does not tell us. Neither will this story.',
        { effects: [{ type: 'startDialogue', dialogue: 'd-after' }] },
      ),
    ],
  },
  {
    id: 'd-after',
    characterId: 'ammia',
    entries: [
      { when: kallias('come-now'), node: 'together' },
      { when: kallias('carry-reply'), node: 'carried' },
    ],
    start: 'alone',
    nodes: [
      say('together', 'narrator', 'Ammia turns to Kallias.', { next: 'together2' }),
      say(
        'together2',
        'ammia',
        'Did you hear that? Paul offered to pay whatever Onesimus owed. Out of his own pocket, from a prison.',
        {
          expression: 'surprised',
          branches: [
            { when: debt('my-account'), next: 't-account' },
            { when: debt('speak-for-him'), next: 't-speak' },
          ],
          next: 't-theirs',
        },
      ),
      say(
        't-account',
        'ammia',
        'And I hear somebody here already put three coins on your account.',
        { expression: 'glad', next: 't-account2' },
      ),
      say('t-account2', 'narrator', 'Kallias looks at his feet. You look at yours.', {
        next: 't-end',
      }),
      say('t-speak', 'narrator', 'Kallias looks at you. You gave him your word.', {
        choices: [
          opt('speak', 'He meant every word, Ammia. I saw him.', 't-spoke', {
            effects: [{ type: 'setFlag', flag: 'spoke-for-kallias', value: true }],
          }),
          opt('quiet', 'Say nothing.', 't-quiet'),
        ],
      }),
      say('t-spoke', 'ammia', 'I know. I can see it too.', { expression: 'glad', next: 't-end' }),
      say(
        't-quiet',
        'narrator',
        'The moment passes. Kallias doesn’t hold it against you — you can tell.',
        { next: 't-end' },
      ),
      say('t-theirs', 'kallias', 'I’ll pay it, Ammia. All of it. It may take a while.', {
        next: 't-end',
      }),
      say(
        't-end',
        'ammia',
        'Half days, then, until it’s paid. And you’ll eat with us. Starting tomorrow.',
        { expression: 'glad', next: 'final' },
      ),
      say(
        'carried',
        'ammia',
        'Paul offered to pay whatever Onesimus owed, out of his own pocket. And Kallias offers to work off his. Tomorrow, then. I’ll put the madder to soak.',
        { expression: 'glad', next: 'final' },
      ),
      say(
        'alone',
        'ammia',
        'He asked Philemon to welcome him back. Asked — he didn’t order it. …Perhaps I’ll walk down to the bridge myself tomorrow.',
        { next: 'final' },
      ),
      say(
        'final',
        'narrator',
        'These two letters are in the New Testament: the letter to Philemon, and the last part of the letter to the Colossians. Let’s look at them carefully: what they say, what we know about their world, and the questions they still leave open. Each part is labelled.',
        {
          kind: 'instruction',
          effects: [{ type: 'openPanel', panel: 'scripture-connection' }],
        },
      ),
    ],
  },
  {
    id: 'd-kallias-gathering',
    characterId: 'kallias',
    entries: [{ when: flag('heard-the-letters'), node: 'after' }],
    start: 'before',
    nodes: [
      say('before', 'kallias', 'I’m staying right here. If I move, I’ll run.', {
        expression: 'worried',
      }),
      say('after', 'kallias', 'Half days until it’s paid. I can do that. I can.', {
        expression: 'glad',
      }),
    ],
  },
  {
    id: 'd-zenon-gathering',
    characterId: 'zenon',
    entries: [{ when: flag('heard-the-letters'), node: 'after' }],
    start: 'before',
    nodes: [
      say(
        'before',
        'zenon',
        'Ammia is waiting for you by the couches. They’ve asked me to read. My hands are shaking.',
        {
          expression: 'worried',
          choices: [
            opt('why', 'Why are your hands shaking? You read all day.', 'before2', { once: true }),
            opt('bye', 'You’ll read it well.'),
          ],
        },
      ),
      say(
        'before2',
        'zenon',
        'I read bills of sale, and wills, and a hundred letters about the price of wool. I have never read out anything that people walked across town in the rain to hear.',
        { next: 'before' },
      ),
      say(
        'after',
        'zenon',
        'I’ve read contracts and complaints and bills of sale all my life. Never a letter like that one.',
        { expression: 'surprised' },
      ),
    ],
  },
  {
    id: 'd-melitta',
    characterId: 'melitta',
    entries: [
      { when: flag('message-delivered'), node: 'after' },
      { when: messagePending, node: 'deliver' },
    ],
    start: 'hello',
    nodes: [
      say(
        'hello',
        'narrator',
        'Melitta, a baker’s wife from the far end of the street, is setting a basket of loaves down by the wall. She smiles and makes room for you on the bench.',
      ),
      say(
        'deliver',
        'narrator',
        'You tell Melitta that you have come from the dye works by the bridge, with words from her sister.',
        { next: 'deliver2' },
      ),
      say('deliver2', 'narrator', 'She sets the basket down very carefully, and waits.', {
        choices: [
          opt(
            'every',
            'Tell her every word: Chrysis is well; the master says perhaps, in two years; she still has your mother’s comb.',
            'every',
            { effects: [message('every-word')] },
          ),
          opt(
            'soft',
            'Tell her Chrysis is well and still has the comb, and leave out the master’s perhaps.',
            'soft',
            { effects: [message('softened')] },
          ),
        ],
      }),
      say(
        'every',
        'narrator',
        'Melitta listens with her eyes shut. At the master’s perhaps, her mouth goes tight. At the comb, she laughs out loud and wipes her face on her sleeve.',
        { next: 'back' },
      ),
      say(
        'soft',
        'narrator',
        'Melitta smiles and presses your hand. She says “well, and the comb” over to herself twice, as if to keep it safe.',
        { next: 'back' },
      ),
      say(
        'back',
        'narrator',
        'Before you go, she asks you — if you are ever down that road again — to tell Chrysis that there is always a place for her at the baker’s table by the fountain.',
        { effects: [{ type: 'setFlag', flag: 'message-delivered', value: true }] },
      ),
      say(
        'after',
        'narrator',
        'Melitta is sitting very straight, one hand on the basket of bread, waiting for the reading to begin.',
      ),
    ],
  },
  {
    id: 'd-tatia-gathering',
    characterId: 'tatia',
    entries: [{ when: flag('bundle-delivered'), node: 'glad' }],
    start: 'hello',
    nodes: [
      say('hello', 'tatia', 'Come and sit. They’ll start soon.', {
        choices: [
          opt('quiet', 'Why is everyone so quiet?', 'quiet', { once: true }),
          opt('hermon', 'Who is the old man by the couches?', 'hermon', { once: true }),
          opt('bye', 'I’ll find Ammia.'),
        ],
      }),
      say(
        'quiet',
        'tatia',
        'Because Philemon’s house has never been this full, and nobody wants to be the one who sneezes.',
        { expression: 'glad', next: 'hello' },
      ),
      say(
        'hermon',
        'tatia',
        'Hermon, the weaver. He was weaving before your grandmother was born. He says he has never had a letter read out that was meant for him, and he’s not going to miss a word.',
        { next: 'hello' },
      ),
      say('glad', 'tatia', 'There’s my letter-finder! Twelve cloaks, {player}. Twelve!', {
        expression: 'glad',
      }),
    ],
  },
];

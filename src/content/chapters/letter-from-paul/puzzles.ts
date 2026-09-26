import type { ChapterInput } from '@/domain/chapter';

/**
 * Four puzzles, each growing out of the story:
 *  1. p-sheets  — put a rain-soaked letter back in order (sequence; how ancient letters were built)
 *  2. p-pack    — what to carry down the road (packing; knowing about the rain changes what's needed)
 *  3. p-alum    — set the alum bath so Kallias can leave with his wage (measuring; optional)
 *  4. p-whose   — whose letter lost its name in the rain? (deduction; optional side quest)
 */
export const PUZZLES: ChapterInput['puzzles'] = [
  {
    id: 'p-sheets',
    type: 'sequence',
    title: 'Kallias’s Letter',
    intro:
      'The cord came undone in the rain and the sheets are out of order. Letters in this world were put together in a familiar way. Use what is written on each sheet — and how it is written — to put them back in order. Then decide what Kallias is asking.',
    cards: [
      {
        id: 'greeting',
        text: '“Kallias, to Ammia his teacher: greetings.”',
        reasoning:
          'A letter opens by naming who it is from and who it is to, with a greeting. That comes first, before anything else.',
      },
      {
        id: 'wish',
        text: '“Before anything else, I hope you are well. I think of you every day at the vats.”',
        reasoning:
          'Right after the greeting, writers usually wished the reader good health or gave thanks for them — “before anything else” says so itself.',
      },
      {
        id: 'confession',
        text: '“About the red batch: it was my fault. I left the vat to go to the festival, and I said it was bad madder. That was a lie.”',
        reasoning:
          'The body of the letter is where the business is. Kallias has to explain what happened before he can ask for anything.',
      },
      {
        id: 'request',
        text: '“I have saved eight coins of the twenty. May I come back and work off the rest? Ask for me at the dye works by the bridge, past the milestone marked [the number has run in the rain].”',
        reasoning:
          'The request builds on the confession: he admits the wrong, then asks to put it right. It belongs after the explanation.',
      },
      {
        id: 'own-hand',
        text: 'In different, larger, clumsier letters: “I, Kallias, write this with my own hand. Farewell.”',
        reasoning:
          'The rest was written by a practised scribe. A sender often added the last lines in their own hand, to show the letter was really theirs — so this sheet comes last.',
      },
    ],
    correctOrder: ['greeting', 'wish', 'confession', 'request', 'own-hand'],
    initialOrder: ['request', 'own-hand', 'wish', 'greeting', 'confession'],
    conclusion: {
      question: 'What is Kallias asking — and where is he?',
      options: [
        {
          id: 'cancel',
          text: 'He wants Ammia to cancel his debt, and he is in Laodicea.',
          correct: false,
          explanation:
            'He offers to work off what he owes, not to have it cancelled. And he says to ask for him at the dye works by the bridge.',
        },
        {
          id: 'come-back',
          text: 'He asks to come back and work off the rest of what he owes. He is at the dye works by the bridge on the Laodicea road — though the milestone number has washed away.',
          correct: true,
          explanation:
            'Yes. The request is plain, and so is the bridge. The milestone number is gone, so you will have to find the place by the bridge rather than by the number.',
        },
        {
          id: 'wages',
          text: 'He is demanding the wages Ammia never paid him.',
          correct: false,
          explanation: 'Nothing in the letter asks for wages. He says the fault was his.',
        },
      ],
    },
    hints: [
      {
        tier: 1,
        text: 'Every letter starts the same way: who it is from, who it is to, and a greeting.',
      },
      {
        tier: 2,
        text: 'Look at the handwriting as well as the words. One sheet is in a different hand. Where would a sender add a line of their own?',
      },
      {
        tier: 3,
        text: 'The order is: greeting → good wishes → what happened → the request → the farewell in his own hand.',
      },
    ],
    explanation:
      'Letters in the Greek and Roman world followed a pattern: who it is from and to, a greeting, good wishes, the body, then a farewell. Many people dictated to a scribe and added the last words in their own hand. Kallias did both — and so did Paul.',
    recordIds: ['rec-hist-letter-form', 'rec-hist-scribes'],
    onSolved: [
      { type: 'setFlag', flag: 'letter-sorted', value: true },
      {
        type: 'showMessage',
        text: 'The letter is back in order. Now Ammia needs to hear it.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-pack',
    type: 'packing',
    title: 'Ready for the Road',
    intro:
      'The travel bag holds a load of 4. Ammia’s letter must come. It is a long walk down the valley to the bridge — and back before lamp-lighting. What else will you need, and what might Kallias need?',
    capacity: 4,
    choiceId: 'choice-packing',
    rules: [
      {
        id: 'letter',
        description: 'Bring Ammia’s answer',
        rule: { type: 'includes', item: 'ammia-letter' },
        failureHint: 'The whole journey is to carry Ammia’s answer to Kallias.',
      },
      {
        id: 'capacity',
        description: 'Stay within what the bag can hold',
        rule: { type: 'withinCapacity' },
        failureHint:
          'Too much. A bag that drags on your shoulder all day slows you down. Take something out.',
      },
      {
        id: 'dry',
        description: 'Keep the letter dry if rain is coming',
        rule: {
          type: 'anyOf',
          of: [
            {
              type: 'state',
              condition: {
                type: 'not',
                condition: { type: 'clueFound', clue: 'clue-rain-coming' },
              },
            },
            { type: 'includes', item: 'letter-case' },
            { type: 'includes', item: 'hooded-cloak' },
          ],
        },
        failureHint:
          'You heard that rain is coming down the valley this afternoon. Ammia’s letter is ink on papyrus. How will you keep it dry?',
      },
    ],
    classifications: [
      { option: 'for-kallias', rule: { type: 'includes', item: 'spare-cloak' } },
      { option: 'for-writing', rule: { type: 'includes', item: 'tablets' } },
      {
        option: 'for-rain',
        rule: {
          type: 'anyOf',
          of: [
            { type: 'includes', item: 'letter-case' },
            { type: 'includes', item: 'hooded-cloak' },
          ],
        },
      },
      { option: 'food', rule: { type: 'includes', item: 'bread' } },
      { option: 'light-load', rule: { type: 'withinCapacity' } },
    ],
    hints: [
      {
        tier: 1,
        text: 'Start with what you must carry: Ammia’s letter weighs nothing. Then look at how much room is left.',
      },
      {
        tier: 2,
        text: 'Did anyone say anything about the weather today? If rain is coming, something has to keep the letter dry — the letter case is lighter than the hooded cloak.',
      },
      {
        tier: 3,
        text: 'There is no single right answer. Any load of 4 or less with Ammia’s letter (and, if you know rain is coming, the case or the hooded cloak) works. Think about what Kallias might need: his old cloak, bread, or tablets to write his answer on.',
      },
    ],
    explanation:
      'You packed within the limit, with Ammia’s letter and a way to keep it safe. Whatever else you chose will shape what you can offer Kallias at the bridge.',
    recordIds: ['rec-hist-materials'],
    onSolved: [
      { type: 'setFlag', flag: 'packed', value: true },
      {
        type: 'showMessage',
        text: 'The bag is packed. Whatever you left out stays at home.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-alum',
    type: 'measuring',
    title: 'The Alum Bath',
    intro:
      'Before wool goes into the red dye, it soaks in alum water so the colour holds. Nikon wants exactly 6 measures of water in the big jar for tomorrow’s alum bath. The big jar holds 9 and the small jar holds 4, and neither has marks in between. Water comes from the channel off the river.',
    sourceLabel: 'the river channel',
    unit: 'measures',
    vessels: [
      { id: 'big', label: 'Big jar', capacity: 9 },
      { id: 'small', label: 'Small jar', capacity: 4 },
    ],
    goal: { vessel: 'big', amount: 6 },
    hints: [
      {
        tier: 1,
        text: 'Fill the big jar and pour it into the small one. What is left in the big jar? What if you do that again?',
      },
      {
        tier: 2,
        text: 'After pouring off the small jar twice, the big jar holds exactly 1. Keep that 1 in the small jar — then the small jar only has room for 3 more.',
      },
      {
        tier: 3,
        text: 'Fill the big jar → pour into the small → empty the small → pour into the small again (the big jar now holds 1) → empty the small → pour the 1 into the small → fill the big jar → pour into the small until it is full (3 go). The big jar now holds 6.',
      },
    ],
    explanation:
      'You measured exactly 6 with a 9-jar and a 4-jar by saving a leftover 1. Dyers needed their measures right: too little alum and the colour washes out.',
    recordIds: ['rec-hist-dyeing'],
    onSolved: [
      { type: 'setFlag', flag: 'alum-set', value: true },
      { type: 'adjustCounter', counter: 'hour', delta: 1 },
      {
        type: 'showMessage',
        text: 'The alum bath is set for tomorrow. Nikon nods: Kallias has earned his day’s pay.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-whose',
    type: 'deduction',
    title: 'Whose Letter?',
    intro:
      'Attalos needs to know who this letter is for before he leaves town. Choose who you think it belongs to — and back it up with evidence.',
    question: 'Whose letter is this?',
    options: [
      {
        id: 'tatia',
        label: 'Tatia the fuller',
        description: 'She cleans and finishes cloth in the yard across the street.',
      },
      {
        id: 'zenon',
        label: 'Zenon the scribe',
        description: 'He reads and writes letters for half the street.',
      },
      {
        id: 'menandros',
        label: 'Menandros the potter',
        description: 'He sells pots and lamps by the colonnade.',
      },
    ],
    answer: 'tatia',
    requiredEvidence: 2,
    evidence: [
      {
        clueId: 'clue-white-dust',
        reliable: true,
        bearsOn: [{ option: 'tatia', stance: 'supports' }],
        note: 'The white clay dust in the folds is the same pale dust that covers Tatia’s yard.',
      },
      {
        clueId: 'clue-torn-words',
        reliable: true,
        bearsOn: [{ option: 'tatia', stance: 'supports' }],
        note: '“The cloaks you cleaned for us” — cleaning cloaks is a fuller’s work.',
      },
      {
        clueId: 'clue-cloth-merchant',
        reliable: true,
        bearsOn: [
          { option: 'tatia', stance: 'supports' },
          { option: 'menandros', stance: 'against' },
        ],
        note: 'A cloth merchant sent it. His business is with people who work cloth, not pots.',
      },
      {
        clueId: 'clue-not-zenon',
        reliable: true,
        bearsOn: [{ option: 'zenon', stance: 'against' }],
        note: 'Zenon knows the hand of everyone who writes to him, and this isn’t one of them.',
      },
      {
        clueId: 'clue-potter-guess',
        reliable: false,
        bearsOn: [{ option: 'zenon', stance: 'supports' }],
        note: 'Menandros never looked at the letter. Zenon reads letters for people; that doesn’t make them his.',
      },
    ],
    wrongAnswerFeedback: {
      zenon:
        'Zenon reads letters for other people. Did anything about this letter actually point to him — and what did he say himself?',
      menandros:
        'Think about who sent it, and what the torn words are about. Is that a potter’s business?',
    },
    hints: [
      {
        tier: 1,
        text: 'Look at the letter itself — the folds, the tear — and ask Attalos who gave it to him.',
      },
      {
        tier: 2,
        text: 'What kind of work leaves white dust everywhere, and involves cleaning cloaks?',
      },
      {
        tier: 3,
        text: 'It is Tatia’s. Present two pieces of reliable evidence — for example, the white dust and the words about cleaned cloaks.',
      },
    ],
    explanation:
      'The dust, the words about cleaned cloaks and the cloth merchant who sent it all point to Tatia the fuller. Most letters in the Roman world travelled like this one: with whoever happened to be going that way, and found their reader by asking around.',
    recordIds: ['rec-hist-carriers'],
    onSolved: [
      { type: 'setFlag', flag: 'bundle-solved', value: true },
      {
        type: 'showMessage',
        text: 'It’s Tatia’s. Attalos asks you to take it to her — he has to see to his mule.',
        tone: 'narration',
      },
    ],
  },
];

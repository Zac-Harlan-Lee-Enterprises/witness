import type { ChapterInput } from '@/domain/chapter';

/**
 * Four puzzles, each growing out of the story:
 *  1. p-sheets  — put a rain-soaked letter back in order (sequence; how ancient letters were built)
 *  2. p-pack    — the way to the bridge on Ammia's sketch (map reading). What you carry is
 *                 now a plain choice at the travel bag (dialogue/bag.ts); the id is kept
 *                 because saves and the story name it.
 *  3. p-alum    — match the buyer's shade so Kallias can leave with his wage (colour
 *                 mixing; optional)
 *  4. p-whose   — whose letter lost its name in the rain? (deduction; optional side quest)
 *
 * Map reading and colour mixing are Chapter 4's own puzzle types: no other
 * chapter uses them.
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
    type: 'map',
    title: 'The Way to the Bridge',
    intro:
      'Kallias’s letter says the dye works by the bridge, past a milestone whose number the rain washed away — and there is more than one dye works by a bridge in this valley. Ammia knows the way to Nikon’s. She sketches the valley on a wax tablet and tells you how to get there. Follow her directions on the sketch, and stop where she means.',
    // Ammia's sketch, north at the top: the town gate on the right, the road
    // running west down the valley, and the river along the bottom.
    map: [
      '...H..F........',
      '...#..#........',
      'L####4#3###2#1G',
      '...#..#........',
      '...#..#........',
      '.WA#K.###V.....',
      '.B.......b.....',
      '.X.......Y.....',
    ],
    landmarks: [
      { id: 'gate', label: 'the west gate of Colossae', x: 14, y: 2 },
      { id: 'mile-1', label: 'a milestone', x: 13, y: 2 },
      { id: 'mile-2', label: 'a milestone', x: 11, y: 2 },
      { id: 'mile-3', label: 'a milestone', x: 7, y: 2 },
      { id: 'mile-4', label: 'a milestone', x: 5, y: 2 },
      { id: 'laodicea', label: 'the road on to Laodicea', x: 0, y: 2 },
      { id: 'hut', label: 'a shepherd’s hut', x: 3, y: 0 },
      { id: 'farm', label: 'a farm', x: 6, y: 0 },
      { id: 'waystation', label: 'the waystation', x: 2, y: 5 },
      { id: 'nikon', label: 'a dye works by a stone bridge', x: 1, y: 5 },
      { id: 'kiln', label: 'a potter’s kiln', x: 4, y: 5 },
      { id: 'works-foot', label: 'a dye works by a footbridge', x: 9, y: 5 },
      { id: 'stone-bridge', label: 'the stone bridge', x: 1, y: 6 },
      { id: 'footbridge', label: 'the footbridge', x: 9, y: 6 },
      { id: 'works-across', label: 'a dye works across the river', x: 1, y: 7 },
      { id: 'tannery', label: 'a tannery across the river', x: 9, y: 7 },
    ],
    start: { x: 14, y: 2, facing: 'west' },
    goal: 'nikon',
    directions: [
      'Go out through the west gate and follow the paved road down the valley.',
      'Count the milestones as you pass them. After the fourth, take the first turning on your left, down toward the river.',
      'Where that track meets the river, turn right.',
      'Go past the waystation. Nikon’s dye works is next, by the bridge — on this side of the river. Don’t cross.',
    ],
    wrongStops: {
      'works-foot':
        'A dye works by a footbridge. Did you turn off the road before the fourth milestone? Count them again.',
      'works-across':
        'Ammia said Nikon’s dye works is on this side of the river. You’ve crossed the bridge.',
      kiln: 'A potter’s kiln, not a dye works. Walking south to the river, which way is your right hand?',
      hut: 'A shepherd’s hut, up the hill. Walking west down the road, your left hand is to the south — toward the river.',
      farm: 'A farm, up the hill and away from the river. The turning you want is on your left.',
      laodicea:
        'This road goes on to Laodicea. You’ve walked past the turning — count the milestones again.',
      waystation: 'The waystation. Ammia said Nikon’s dye works is just past it.',
      tannery: 'A tannery, across the river. Nikon’s dye works is on this side.',
    },
    hints: [
      {
        tier: 1,
        text: 'On the sketch, north is at the top and you start at the gate on the right, walking west. Count every milestone you pass.',
      },
      {
        tier: 2,
        text: 'Walking west, your left hand is to the south. After the fourth milestone the first turning to the south is the one you want. At the river you are walking south, so turning right means going west.',
      },
      {
        tier: 3,
        text: 'Full method: walk west past four milestones (and the crossroads between the third and fourth), then keep going west to the next crossroads and turn south. At the river turn west, past the waystation, and stop at the dye works by the stone bridge.',
      },
    ],
    explanation:
      'You followed Ammia’s directions: four milestones, the first turning on the left, right at the river and past the waystation to the dye works by the stone bridge. Left and right depend on which way you are facing; north on a map doesn’t. (The road, its milestones, the bridge and the dye works are made up for the game.)',
    recordIds: ['rec-rec-road'],
    onSolved: [
      { type: 'setFlag', flag: 'knows-the-way', value: true },
      {
        type: 'showMessage',
        text: 'You know the way now: four milestones, left to the river, right past the waystation.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-alum',
    type: 'dyeing',
    title: 'The Buyer’s Shade',
    intro:
      'Nikon won’t start tomorrow’s big batch until a test skein matches the buyer’s sample: mulberry, a deep reddish purple. The skein has already soaked in alum, so the colour will hold. Each dip in the madder vat adds red; each dip in the blue vat adds blue; a dip in the rinsing trough takes a little of both out again. Four dips, and then the skein is spoiled.',
    colours: [
      { id: 'red', label: 'red' },
      { id: 'blue', label: 'blue' },
    ],
    max: 4,
    baths: [
      {
        id: 'madder',
        label: 'The madder vat',
        description: 'Adds 2 red.',
        change: { red: 2 },
      },
      { id: 'blue', label: 'The blue vat', description: 'Adds 2 blue.', change: { blue: 2 } },
      {
        id: 'rinse',
        label: 'The rinsing trough',
        description: 'Takes out 1 red and 1 blue (never less than none).',
        change: { red: -1, blue: -1 },
      },
    ],
    target: { red: 3, blue: 2 },
    maxDips: 4,
    shades: [
      { name: 'undyed cream', levels: { red: 0, blue: 0 } },
      { name: 'pale pink', levels: { red: 1, blue: 0 } },
      { name: 'rose', levels: { red: 2, blue: 0 } },
      { name: 'red', levels: { red: 3, blue: 0 } },
      { name: 'deep red', levels: { red: 4, blue: 0 } },
      { name: 'pale grey-blue', levels: { red: 0, blue: 1 } },
      { name: 'sky blue', levels: { red: 0, blue: 2 } },
      { name: 'blue', levels: { red: 0, blue: 3 } },
      { name: 'deep blue', levels: { red: 0, blue: 4 } },
      { name: 'pale lilac', levels: { red: 1, blue: 1 } },
      { name: 'dusty rose', levels: { red: 2, blue: 1 } },
      { name: 'raspberry', levels: { red: 3, blue: 1 } },
      { name: 'crimson', levels: { red: 4, blue: 1 } },
      { name: 'lavender', levels: { red: 1, blue: 2 } },
      { name: 'purple', levels: { red: 2, blue: 2 } },
      { name: 'mulberry', levels: { red: 3, blue: 2 } },
      { name: 'wine', levels: { red: 4, blue: 2 } },
      { name: 'cornflower', levels: { red: 1, blue: 3 } },
      { name: 'violet', levels: { red: 2, blue: 3 } },
      { name: 'deep purple', levels: { red: 3, blue: 3 } },
      { name: 'plum', levels: { red: 4, blue: 3 } },
      { name: 'blue-violet', levels: { red: 1, blue: 4 } },
      { name: 'indigo', levels: { red: 2, blue: 4 } },
      { name: 'dark violet', levels: { red: 3, blue: 4 } },
      { name: 'near-black purple', levels: { red: 4, blue: 4 } },
    ],
    hints: [
      {
        tier: 1,
        text: 'The madder and blue vats each add 2 at a time, so on their own they only ever make even numbers. How could you end up with 3 red?',
      },
      {
        tier: 2,
        text: 'The rinsing trough takes 1 of each colour out — but never below none. Rinse while there is still no blue in the skein, and only red comes out.',
      },
      {
        tier: 3,
        text: 'Full method: the madder vat (red 2, rose) → the rinsing trough (red 1, pale pink) → the madder vat again (red 3, red) → the blue vat (red 3, blue 2): mulberry.',
      },
    ],
    explanation:
      'Four dips, and the test skein matches the sample: red 3, blue 2. Red dye from the madder root was used on wool in the Roman world, and dyers used alum so that bright colours would hold. (The vats, shades and dips here are made up for the game.)',
    recordIds: ['rec-hist-dyeing'],
    onSolved: [
      { type: 'setFlag', flag: 'alum-set', value: true },
      { type: 'adjustCounter', counter: 'hour', delta: 1 },
      {
        type: 'showMessage',
        text: 'The test skein matches. Nikon nods: Kallias has earned his day’s pay.',
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

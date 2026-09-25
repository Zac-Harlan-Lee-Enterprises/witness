import type { ChapterInput } from '@/domain/chapter';

/**
 * Four puzzles, each growing out of the story:
 *  1. p-satchel         — what to carry (resource allocation; knowledge changes what's "enough")
 *  2. p-measure         — settle a market dispute fairly (environmental logic; optional side quest)
 *  3. p-route           — which way down? (evidence-backed deduction; uses what you learned in Jerusalem)
 *  4. p-what-happened   — read the scene (ordering evidence; a conclusion that admits uncertainty)
 */
export const PUZZLES: ChapterInput['puzzles'] = [
  {
    id: 'p-satchel',
    type: 'packing',
    title: 'Pack the Satchel',
    intro:
      'Your satchel holds a load of 6. The remedy must come. Everything else is a choice: what will you need on a hot road — and what might someone else need?',
    capacity: 6,
    choiceId: 'choice-packing',
    rules: [
      {
        id: 'remedy',
        description: 'Bring Aunt Miriam’s remedy',
        rule: { type: 'includes', item: 'remedy' },
        failureHint: 'You can’t leave without the remedy — it’s the whole reason for the journey.',
      },
      {
        id: 'capacity',
        description: 'Stay within the satchel’s limit',
        rule: { type: 'withinCapacity' },
        failureHint:
          'Too heavy. A load you can’t carry all day doesn’t help anyone. Take something out.',
      },
      {
        id: 'water',
        description: 'Carry enough water for the descent',
        rule: {
          type: 'anyOf',
          of: [
            { type: 'includes', item: 'water-skin', min: 2 },
            {
              type: 'allOf',
              of: [
                { type: 'includes', item: 'water-skin', min: 1 },
                { type: 'state', condition: { type: 'clueFound', clue: 'clue-cistern' } },
              ],
            },
          ],
        },
        failureHint:
          'One skin of water won’t last the whole hot descent — unless you know somewhere to refill it on the way. Did any traveler mention water?',
      },
    ],
    classifications: [
      {
        option: 'care-kit',
        rule: {
          type: 'allOf',
          of: [
            { type: 'includes', item: 'linen' },
            { type: 'includes', item: 'oil' },
          ],
        },
      },
      {
        option: 'some-care',
        rule: {
          type: 'anyOf',
          of: [
            { type: 'includes', item: 'linen' },
            { type: 'includes', item: 'oil' },
          ],
        },
      },
      { option: 'provisions', rule: { type: 'includes', item: 'bread' } },
      {
        option: 'warmth-light',
        rule: {
          type: 'anyOf',
          of: [
            { type: 'includes', item: 'cloak' },
            { type: 'includes', item: 'lamp' },
          ],
        },
      },
      { option: 'water-only', rule: { type: 'withinCapacity' } },
    ],
    hints: [
      {
        tier: 1,
        text: 'Start with what you MUST carry: the remedy, and enough water. Then look at how much room is left.',
      },
      {
        tier: 2,
        text: 'Water skins are heavy (2 each). If you know where to refill on the way, one skin could be enough — and that frees up room.',
      },
      {
        tier: 3,
        text: 'There is no single right answer. Any load of 6 or less that includes the remedy and enough water works. Think about what might matter on the road: food, linen and oil, a lamp, or a warm cloak.',
      },
    ],
    explanation:
      'You packed within your limit and made sure you had the remedy and enough water. Everything else you chose will shape what you can do on the road.',
    recordIds: [],
    onSolved: [
      { type: 'setFlag', flag: 'packed', value: true },
      {
        type: 'showMessage',
        text: 'Your satchel is packed. Whatever you left behind stays safely at home.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-measure',
    type: 'measuring',
    title: 'An Honest Measure',
    intro:
      'Ezer says Menashe’s jar held less than the 4 measures he paid for. To test it fairly, mark exactly 4 measures in Ezer’s big crock using water from the trough — then pour in the oil and compare. The crock holds 5; the pitcher holds 3. Neither has marks in between.',
    sourceLabel: 'the water trough',
    unit: 'measures',
    vessels: [
      { id: 'crock', label: 'Big crock', capacity: 5 },
      { id: 'pitcher', label: 'Pitcher', capacity: 3 },
    ],
    goal: { vessel: 'crock', amount: 4 },
    hints: [
      {
        tier: 1,
        text: 'You can’t pour exactly 4 directly. What amounts CAN you make exactly by pouring the 5 into the 3?',
      },
      {
        tier: 2,
        text: 'Fill the crock (5) and pour it into the pitcher (3). The crock now holds exactly 2. Could you save that 2 somewhere?',
      },
      {
        tier: 3,
        text: 'Full method: fill the crock → pour into the pitcher → empty the pitcher → pour the crock’s 2 into the pitcher → fill the crock again → pour into the pitcher until it’s full (it only takes 1). The crock now holds 4.',
      },
    ],
    explanation:
      'You marked exactly 4 measures with a 5-measure crock and a 3-measure pitcher. When Menashe’s oil reached the same mark, everyone could see the jar was honest.',
    recordIds: ['rec-hist-measures'],
    onSolved: [{ type: 'setFlag', flag: 'measure-proved', value: true }],
  },
  {
    id: 'p-route',
    type: 'deduction',
    title: 'Which Way Down?',
    intro:
      'The road divides. You have heard advice in Jerusalem, and you can see things for yourself here. Choose a route — and back it up with evidence.',
    question: 'Which way can you safely go down today?',
    options: [
      {
        id: 'road',
        label: 'The main road through the bend',
        description: 'Direct and well-worn, squeezing between red cliffs.',
      },
      {
        id: 'wadi',
        label: 'The dry wadi',
        description: 'A stony streambed heading south-east. It looks like a shortcut.',
      },
      {
        id: 'ridge',
        label: 'The shepherds’ ridge path',
        description: 'A narrow path climbing along the ridge. Longer, but open.',
      },
    ],
    answer: 'ridge',
    requiredEvidence: 2,
    evidence: [
      {
        clueId: 'clue-cairn',
        reliable: true,
        bearsOn: [{ option: 'ridge', stance: 'supports' }],
        note: 'The three-stone cairn shows the ridge path is a real, looked-after path.',
      },
      {
        clueId: 'clue-cistern',
        reliable: true,
        bearsOn: [{ option: 'ridge', stance: 'supports' }],
        note: 'Shimon said the ridge path has a cistern and is marked by three-stone cairns — you can refill water there.',
      },
      {
        clueId: 'clue-map',
        reliable: true,
        bearsOn: [
          { option: 'ridge', stance: 'supports' },
          { option: 'wadi', stance: 'against' },
        ],
        note: 'Malik’s map shows the ridge path rejoining the road below the bend — and the wadi ending at a drop.',
      },
      {
        clueId: 'clue-bend-watchers',
        reliable: true,
        bearsOn: [{ option: 'road', stance: 'against' }],
        note: 'Shimon warned that robbers watch the bend when few travelers are on the road.',
      },
      {
        clueId: 'clue-empty-road',
        reliable: true,
        bearsOn: [{ option: 'road', stance: 'against' }],
        note: 'The road is empty today — exactly when Shimon said the bend is most dangerous.',
      },
      {
        clueId: 'clue-wadi-dead-end',
        reliable: true,
        bearsOn: [{ option: 'wadi', stance: 'against' }],
        note: 'Malik said the wadi ends at a dry waterfall you can’t climb down.',
      },
      {
        clueId: 'clue-mud-line',
        reliable: true,
        bearsOn: [{ option: 'wadi', stance: 'against' }],
        note: 'Fresh mud shows water rushed down the wadi recently.',
      },
      {
        clueId: 'clue-clouds',
        reliable: true,
        bearsOn: [{ option: 'wadi', stance: 'against' }],
        note: 'Rain over the western hills can send a flash flood down a dry wadi.',
      },
      {
        clueId: 'clue-wadi-fastest',
        reliable: false,
        bearsOn: [{ option: 'wadi', stance: 'supports' }],
        note: 'Tobiah admitted he’s never actually walked the wadi — he always drives the main road. That makes his claim weak evidence.',
      },
    ],
    wrongAnswerFeedback: {
      road: 'Think about what Shimon said about the bend — and look at how many people are on the road today.',
      wadi: 'Look closely at the wadi’s walls and at the sky over the hills. What can happen in a dry streambed? And what did Malik say about where it ends?',
    },
    hints: [
      {
        tier: 1,
        text: 'Examine everything at the fork: the cairn, the wadi’s edge, the sky to the west, and the road ahead.',
      },
      {
        tier: 2,
        text: 'Try ruling routes OUT. Which one could flood or dead-end? Which one is dangerous when the road is empty?',
      },
      {
        tier: 3,
        text: 'The ridge path is the safe choice. Present two pieces of reliable evidence — for example, the three-stone cairn and the fresh mud in the wadi.',
      },
    ],
    explanation:
      'The ridge path is longer, but it’s open — no hidden bend — and the cairns and cistern show shepherds keep it up. The wadi could flood after rain in the hills and ends at a drop. The bend is where robbers wait when the road is empty.',
    recordIds: ['rec-hist-floods', 'rec-hist-road-danger'],
    onSolved: [
      { type: 'setFlag', flag: 'route', value: 'ridge' },
      {
        type: 'showMessage',
        text: 'You take the shepherds’ path up onto the ridge.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-what-happened',
    type: 'sequence',
    title: 'What Happened Here?',
    intro:
      'Put the events in the order the evidence shows. Then decide what the evidence says about the danger now.',
    requiresClues: {
      clues: [
        'clue-single-prints',
        'clue-many-prints',
        'clue-broken-jar',
        'clue-cut-purse',
        'clue-torn-cloth',
        'clue-drag-marks',
      ],
      min: 3,
    },
    cards: [
      {
        id: 'alone',
        text: 'The traveler walked down from the bend alone.',
        clueId: 'clue-single-prints',
        reasoning:
          'Only one set of sandal prints comes down the road from the bend — so he arrived first, and alone.',
      },
      {
        id: 'stopped',
        text: 'Several people came down from the rocks and stopped him.',
        clueId: 'clue-many-prints',
        reasoning:
          'The other footprints come from the rocks and meet his prints. They arrived after he did.',
      },
      {
        id: 'robbed',
        text: 'They cut his purse and pulled away his cloak; his oil jar broke.',
        clueId: 'clue-cut-purse',
        reasoning:
          'The cut purse, the torn cloth and the broken jar lie where all the prints meet.',
      },
      {
        id: 'left',
        text: 'The robbers went away north, up the gully.',
        clueId: 'clue-many-prints',
        reasoning: 'Their prints lead away north and don’t come back.',
      },
      {
        id: 'crawled',
        text: 'He dragged himself into the shade.',
        clueId: 'clue-drag-marks',
        reasoning:
          'The drag marks cross OVER the robbers’ footprints — so they were made after the robbers left.',
      },
    ],
    correctOrder: ['alone', 'stopped', 'robbed', 'left', 'crawled'],
    initialOrder: ['robbed', 'crawled', 'alone', 'left', 'stopped'],
    conclusion: {
      question: 'What does the evidence tell you about the robbers now?',
      options: [
        {
          id: 'hiding',
          text: 'They are hiding nearby, waiting for the next traveler.',
          correct: false,
          explanation:
            'Their tracks lead away north and don’t return. That doesn’t prove they’re far away — but nothing here suggests they’re waiting.',
        },
        {
          id: 'left',
          text: 'They most likely left hours ago — but you can’t be completely sure.',
          correct: true,
          explanation:
            'Yes. The oil has dried into the dust and the tracks lead away. The evidence points to the danger having passed — but evidence isn’t certainty, so it’s wise to stay alert.',
        },
        {
          id: 'fell',
          text: 'There were no robbers. He just fell and hurt himself.',
          correct: false,
          explanation:
            'A fall doesn’t explain a cut purse, a torn cloak and several sets of footprints.',
        },
      ],
    },
    hints: [
      { tier: 1, text: 'Start with what must have happened FIRST. How did the traveler get here?' },
      {
        tier: 2,
        text: 'Look at which marks lie on top of which. Something made later covers something made earlier.',
      },
      {
        tier: 3,
        text: 'The order is: walked down alone → people came from the rocks → purse cut, cloak torn, jar broken → robbers left north → he dragged himself into the shade.',
      },
    ],
    explanation:
      'Reading tracks in order is how you know the drag marks came last: they cross over the other prints. And a careful conclusion says what the evidence supports — and admits what it can’t prove.',
    recordIds: [],
    onSolved: [
      { type: 'setFlag', flag: 'scene-understood', value: true },
      {
        type: 'showMessage',
        text: 'You understand what happened here. Now — the man in the shade.',
        tone: 'narration',
      },
    ],
  },
];

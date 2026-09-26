import type { ChapterInput } from '@/domain/chapter';

/**
 * Four puzzles, each growing out of the story:
 *  1. p-sky    — what is the sky saying? (deduction: weigh testimony and signs; an answer that admits uncertainty)
 *  2. p-load   — load the boat (packing: the fee against safety, gear and room for others)
 *  3. p-sail   — shorten sail in a squall (sequence: each job makes the next possible)
 *  4. p-brine  — Nikanor's brine (measuring; optional side quest that changes what counts as "enough jars")
 */
export const PUZZLES: ChapterInput['puzzles'] = [
  {
    id: 'p-sky',
    type: 'deduction',
    title: 'What Is the Sky Saying?',
    intro:
      'Hanina hands the question back to you. Put together what you have seen and heard along the shore, choose a reading of the sky — and back it with evidence.',
    question: 'What might the lake do tonight?',
    options: [
      {
        id: 'calm',
        label: 'A calm night',
        description: 'The usual afternoon wind will die away, and the night will be still.',
      },
      {
        id: 'squall',
        label: 'A strong wind could rush down after dark',
        description: 'A wind could come down off the hills onto the lake, with little warning.',
      },
      {
        id: 'rain',
        label: 'Days of rain from the sea',
        description: 'A long spell of rain is blowing in from the west.',
      },
    ],
    answer: 'squall',
    requiredEvidence: 2,
    evidence: [
      {
        clueId: 'clue-hanina-east',
        reliable: true,
        bearsOn: [{ option: 'squall', stance: 'supports' }],
        note: 'Hanina has watched this lake for sixty years: the worst winds come off the eastern heights, and they can come at night.',
      },
      {
        clueId: 'clue-cold-breath',
        reliable: true,
        bearsOn: [
          { option: 'squall', stance: 'supports' },
          { option: 'calm', stance: 'against' },
        ],
        note: 'Cold air is already coming across from the eastern hills, against the afternoon wind.',
      },
      {
        clueId: 'clue-magdala-crew',
        reliable: true,
        bearsOn: [
          { option: 'squall', stance: 'supports' },
          { option: 'calm', stance: 'against' },
        ],
        note: 'Experienced fishers from Magdala are hauling their boat high and lashing it down.',
      },
      {
        clueId: 'clue-clear-west',
        reliable: true,
        bearsOn: [{ option: 'rain', stance: 'against' }],
        note: 'The western sky is clear: no rain is coming in from the sea.',
      },
      {
        clueId: 'clue-nikanor-calm',
        reliable: false,
        bearsOn: [{ option: 'calm', stance: 'supports' }],
        note: 'Nikanor hardly ever crosses at night — and he wants his jars across. That makes his claim weak evidence.',
      },
    ],
    wrongAnswerFeedback: {
      calm: 'A quiet evening isn’t a promise of a quiet night. What did Hanina say about the heights — and what is coming off the eastern hills?',
      rain: 'Look west. Is there any sign of rain coming in from the sea?',
    },
    hints: [
      {
        tier: 1,
        text: 'Look around the shore: the western sky, the far eastern hills, the boats coming in — and remember what Hanina told you.',
      },
      {
        tier: 2,
        text: 'Try ruling readings out. Does anything you have seen point to rain? And is a quiet evening a promise of a quiet night?',
      },
      {
        tier: 3,
        text: 'A strong wind could rush down after dark. Back it with two reliable pieces of evidence — for example, Hanina’s warning about the heights and the cold breath off the eastern hills.',
      },
    ],
    explanation:
      'Wind can reach this lake suddenly from the hills around it, and some of the fiercest winds come off the heights to the east, sometimes at night. No one can say exactly when — or how strong. But you can go out ready: the bailer aboard, the boat not too heavy, and a plan for the sail.',
    recordIds: ['rec-hist-storms'],
    onSolved: [
      { type: 'setFlag', flag: 'sky-read', value: true },
      {
        type: 'showMessage',
        text: 'You tell Hanina what you think. He nods slowly. “Go ready, then. And keep close to the other boats.”',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-load',
    type: 'packing',
    title: 'Load the Boat',
    intro:
      'The boat takes 10 loads besides her crew, and everything piled on the jetty weighs more than that. The bailer must go, and the jars pay the family’s way. What else will you need tonight — and what might someone else need?',
    capacity: 10,
    choiceId: 'choice-load',
    rules: [
      {
        id: 'bailer',
        description: 'Take the bailing scoop',
        rule: { type: 'includes', item: 'bailer' },
        failureHint:
          'Every boat on this lake carries a bailer. Grandmother would never let you leave without one.',
      },
      {
        id: 'capacity',
        description: 'Stay within the boat’s safe load',
        rule: { type: 'withinCapacity' },
        failureHint:
          'Too heavy. Loaded past ten, the boat sits so low that a wave could come over the side. Take something out.',
      },
      {
        id: 'jars',
        description: 'Carry enough of Nikanor’s jars to earn the fee',
        rule: {
          type: 'anyOf',
          of: [
            { type: 'includes', item: 'fish-jar', min: 4 },
            {
              type: 'allOf',
              of: [
                { type: 'includes', item: 'fish-jar', min: 2 },
                { type: 'state', condition: { type: 'flag', flag: 'nikanor-agreed' } },
              ],
            },
          ],
        },
        failureHint:
          'Uncle Elazar needs at least four jars across to earn the fee — unless Nikanor agrees to send fewer tonight.',
      },
    ],
    classifications: [
      { option: 'all-jars', rule: { type: 'includes', item: 'fish-jar', min: 6 } },
      {
        option: 'jars-and-gear',
        rule: {
          type: 'allOf',
          of: [
            { type: 'includes', item: 'fish-jar', min: 4 },
            {
              type: 'anyOf',
              of: [
                { type: 'includes', item: 'rope' },
                { type: 'includes', item: 'spare-oar' },
              ],
            },
          ],
        },
      },
      {
        option: 'jars-and-net',
        rule: {
          type: 'allOf',
          of: [
            { type: 'includes', item: 'fish-jar', min: 4 },
            { type: 'includes', item: 'net' },
          ],
        },
      },
      { option: 'light', rule: { type: 'withinCapacity' } },
    ],
    hints: [
      {
        tier: 1,
        text: 'Start with what must go: the bailer, and at least four jars (two, if Nikanor agreed to fewer). Then see how much room is left.',
      },
      {
        tier: 2,
        text: 'Think about what Hanina told you. If a wind comes, what would you want in the boat? And why carry drinking water across a lake of fresh water?',
      },
      {
        tier: 3,
        text: 'There is no single right answer. Any load of 10 or less with the bailer and enough jars works. Fewer jars leave room for a rope, the spare oar, your cloak or the lamp — or for someone else in the boat.',
      },
    ],
    explanation:
      'You loaded within the safe limit, with the bailer and enough jars. Whatever you left goes back up to the rack. What you carry will shape what you can do out on the water.',
    recordIds: ['rec-hist-galilee-boat'],
    onSolved: [
      { type: 'setFlag', flag: 'loaded', value: true },
      {
        type: 'showMessage',
        text: 'The boat is loaded. Whatever you left behind goes back up to the rack.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-sail',
    type: 'sequence',
    title: 'Shorten Sail!',
    intro:
      'The squall is on you. Put the jobs in the order that works — each one makes the next one possible. Then decide what to do as the wind keeps rising.',
    cards: [
      {
        id: 'brails',
        text: 'Haul on the brails to gather the sail up to the yard.',
        clueId: 'clue-tamar-sail',
        reasoning:
          'While the sail is full, the wind can lay the boat over. Take the wind out of it first.',
      },
      {
        id: 'yard',
        text: 'Lower the yard and lash it down.',
        clueId: 'clue-tamar-sail',
        reasoning:
          'With the sail gathered, the yard can come down — lashed, so it can’t swing into anyone.',
      },
      {
        id: 'oars',
        text: 'Run out the oars and turn the bow to the waves.',
        clueId: 'clue-tamar-sail',
        reasoning:
          'With the yard down there is room to row. Waves that hit the side can roll a boat; meet them with the bow.',
      },
      {
        id: 'bail',
        text: 'Bail — and keep bailing.',
        clueId: 'clue-tamar-sail',
        reasoning:
          'Water coming over the bow has to go back out. It keeps coming, so bailing is the last job and the longest.',
      },
    ],
    correctOrder: ['brails', 'yard', 'oars', 'bail'],
    initialOrder: ['oars', 'bail', 'brails', 'yard'],
    conclusion: {
      question: 'The wind is still rising. What now?',
      options: [
        {
          id: 'run',
          text: 'Raise the sail again and run for home.',
          correct: false,
          explanation:
            'Not in this wind. With the sail up in a squall, the boat could be laid over or driven under.',
        },
        {
          id: 'steady',
          text: 'Keep her bow to the waves, keep bailing, and stay near the other boats.',
          correct: true,
          explanation:
            'Yes. There is no sure way through a storm like this — but a boat held steady and bailed, with other boats nearby, has the best chance.',
        },
        {
          id: 'overboard',
          text: 'Throw everything overboard straight away.',
          correct: false,
          explanation:
            'Not yet. Lighten the boat only if you must. First hold her steady, and bail.',
        },
      ],
    },
    hints: [
      { tier: 1, text: 'What makes the boat heel over in the wind? Deal with that first.' },
      {
        tier: 2,
        text: 'You can’t row with the yard swinging, and bailing is useless while the waves hit the side.',
      },
      { tier: 3, text: 'Tamar’s order: brails, yard, oars — then bail.' },
    ],
    explanation:
      'Take the wind out of the sail, get the yard down, meet the waves with the bow, and bail. Each job makes the next one possible. (Tamar’s order is the game’s fiction, built from how sailors of the time handled a square sail.)',
    recordIds: ['rec-recon-boat-handling'],
    onSolved: [
      { type: 'setFlag', flag: 'sail-in', value: true },
      {
        type: 'showMessage',
        text: 'Sail in, yard lashed, oars out. The boat stops heeling and meets the waves bow first.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-brine',
    type: 'measuring',
    title: 'Nikanor’s Brine',
    intro:
      'The brine tub needs exactly 7 measures of lake water for this basket of salt, measured in the big jar. The big jar holds 8; the small jar holds 5. Neither has marks in between.',
    sourceLabel: 'the lake',
    unit: 'measures',
    vessels: [
      { id: 'big', label: 'Big jar', capacity: 8 },
      { id: 'small', label: 'Small jar', capacity: 5 },
    ],
    goal: { vessel: 'big', amount: 7 },
    hints: [
      {
        tier: 1,
        text: 'You can’t pour exactly 7 straight in. What can you make by pouring the small jar into the big one twice?',
      },
      {
        tier: 2,
        text: 'Pour two small jars into the big one: it fills up, and 2 measures are left in the small jar. Could you keep that 2?',
      },
      {
        tier: 3,
        text: 'Full method: fill the small jar → pour it into the big jar → fill the small jar again → pour into the big jar until it’s full (2 are left) → empty the big jar → pour the 2 into it → fill the small jar → pour it in. The big jar holds 7.',
      },
    ],
    explanation:
      'You measured exactly 7 with an 8-measure jar and a 5-measure jar. Salting fish let them keep for months, so they could be sold far from the lake. (The recipe is made up for the game.)',
    recordIds: ['rec-hist-salting'],
    onSolved: [{ type: 'setFlag', flag: 'brine-measured', value: true }],
  },
];

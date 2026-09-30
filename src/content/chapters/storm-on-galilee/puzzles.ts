import type { ChapterInput } from '@/domain/chapter';

/**
 * Six puzzles, each growing out of the story:
 *  1. p-sky    — what is the sky saying? (deduction: weigh testimony and signs; an answer that admits uncertainty)
 *  2. p-load   — load and trim the boat (trim: the fee against safety, gear and room for others —
 *                and where it all goes, so she sits level)
 *  3. p-sail   — shorten sail in a squall (sequence: each job makes the next possible)
 *  4. p-brine  — mend Nikanor's jar net (netting, a picture logic grid; optional side quest that
 *                changes what counts as "enough jars"). The id is kept from when it was a brine
 *                puzzle, because saves and the story's flags name it.
 *  5. p-corner — Grandmother's corner (netting): tie the last knots of the family's mark before
 *                you go; it teaches how a mending pattern reads.
 *  6. p-patch  — seal the seam of Oded's leaking boat (sequence; optional side quest that changes
 *                how the little boat fares in the storm).
 *
 * Trim and netting are Chapter 2's own puzzle types: no other chapter uses them.
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
    type: 'trim',
    title: 'Load the Boat',
    intro:
      'The boat takes 10 loads besides her crew, and everything piled on the jetty weighs more than that. The bailer must go, and the jars pay the family’s way. The crew are already in their places — and she has to sit level: the bow about as heavy as the stern, and port (the left side, looking forward) about as heavy as starboard. What goes aboard, and where?',
    capacity: 10,
    places: [
      { id: 'bow', label: 'Bow', limit: 4 },
      { id: 'port', label: 'Port side', limit: 3 },
      { id: 'starboard', label: 'Starboard side', limit: 3 },
      { id: 'stern', label: 'Stern', limit: 2 },
    ],
    crew: [
      { id: 'you', name: 'you', place: 'bow', weight: 2 },
      { id: 'yoezer', name: 'Yoezer', place: 'port', weight: 3 },
      { id: 'tamar', name: 'Tamar', place: 'starboard', weight: 2 },
      { id: 'elazar', name: 'Uncle Elazar', place: 'stern', weight: 3 },
    ],
    balance: [
      {
        id: 'fore-aft',
        description: 'Bow and stern about the same',
        between: ['bow', 'stern'],
        tolerance: 1,
        failureHint:
          'She isn’t level from end to end. Uncle Elazar sits in the stern to steer, so the bow needs more cargo than the stern.',
      },
      {
        id: 'side-to-side',
        description: 'Port and starboard about the same',
        between: ['port', 'starboard'],
        tolerance: 1,
        failureHint:
          'She leans to one side. Yoezer is heavier than Tamar, so starboard needs a little more cargo than port.',
      },
    ],
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
        text: 'Start with what must go: the bailer, and at least four jars (two, if Nikanor agreed to fewer). Then look at who is already sitting where — and what Hanina said about the night.',
      },
      {
        tier: 2,
        text: 'Opposite places must weigh within 1 of each other, crew included. Uncle Elazar (3) in the stern outweighs you (2) in the bow, and Yoezer (3) to port outweighs Tamar (2) to starboard — so put more cargo in the bow than the stern, and a little more to starboard than to port.',
      },
      {
        tier: 3,
        text: 'Any load of 10 or less with the bailer and enough jars works, if she sits level. For example: four jars in the bow; the bailer and your lamp in the stern; the spare oar to port; the rope and your cloak to starboard. That makes the bow 6 and the stern 5, port 5 and starboard 4.',
      },
    ],
    explanation:
      'You loaded within the safe limit, with the bailer and enough jars — and she sits level, so no end digs in and no side leans. Whatever you left goes back up to the rack. What you carry will shape what you can do out on the water. (The loads and places are simplified for the game.)',
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
    type: 'netting',
    title: 'Nikanor’s Jar Net',
    intro:
      'The rope net that carries Nikanor’s jars has torn right through his mark: a fish, knotted into the mesh in thick cord. Your grandmother taught you to read a mending pattern. The numbers beside each row and above each column are the runs of knots in that line, in order: “3 1” means three knots together, then a gap, then one more. Tie the torn part so every row and column matches.',
    // The finished mark: a fish swimming left, with its tail on the right.
    pattern: ['..###.#', '.#.####', '######.', '.######', '..###.#'],
    // Columns 2–5 are torn; the nose and the tail are still whole.
    torn: ['.????..', '.????..', '.????..', '.????..', '.????..'],
    hints: [
      {
        tier: 1,
        text: 'Start with the lines that leave no choice. A column of five cells whose number is 5 must be knotted all the way down.',
      },
      {
        tier: 2,
        text: 'The third column needs “1 3”: one knot, a gap, then three — exactly five cells, so there is only one way to fit it. Then check each row against what is already tied.',
      },
      {
        tier: 3,
        text: 'Full method: tie row 1 at columns 3, 4 and 5; row 2 at columns 2, 4 and 5 (leave column 3 open — the fish’s eye); rows 3 and 4 at columns 2, 3, 4 and 5; and row 5 at columns 3, 4 and 5. Everything else in the torn part stays open.',
      },
    ],
    explanation:
      'Every row and column matches, and Nikanor’s fish is whole again. (The jar net and its mark are made up for the game.) Salting fish let them keep for months, so they could be sold far from the lake.',
    recordIds: ['rec-hist-salting'],
    onSolved: [{ type: 'setFlag', flag: 'brine-measured', value: true }],
  },
  {
    id: 'p-corner',
    type: 'netting',
    title: 'Grandmother’s Corner',
    intro:
      'The family’s mark is knotted into Grandmother’s net: a little boat under sail. One corner of it has pulled loose. The numbers beside each row and above each column are the runs of knots in that line, in order: “1 2” means one knot, a gap, then two together. Tie the loose part so every row and column matches.',
    // The family's mark: a mast with its sail, over a hull.
    pattern: ['..#..', '..##.', '..#..', '#####', '.###.'],
    // Columns 2–4 have pulled loose; the edges are still whole.
    torn: ['.???.', '.???.', '.???.', '.???.', '.???.'],
    hints: [
      {
        tier: 1,
        text: 'Start with the line that leaves no choice: the middle column’s number is 5, so every cell in it is a knot.',
      },
      {
        tier: 2,
        text: 'Row 4 is a 5 as well: the whole row is knotted. Row 5 is a 3 with its ends open, so its three knots sit in the middle.',
      },
      {
        tier: 3,
        text: 'Full method: tie column 3 all the way down; column 4 in rows 2, 4 and 5; and column 2 in rows 4 and 5. Everything else in the loose part stays open.',
      },
    ],
    explanation:
      'Every row and column matches, and the little boat is whole again. Grandmother runs her thumb along your knots: tight and even. (The family’s mark is made up for the game.)',
    recordIds: ['rec-hist-nets'],
    onSolved: [
      { type: 'setFlag', flag: 'mended-with-grandmother', value: true },
      {
        type: 'showMessage',
        text: '“Tight and even,” Grandmother says. “Now go and find Hanina.”',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-patch',
    type: 'sequence',
    title: 'Seal the Seam',
    intro:
      'Oded’s borrowed boat is tipped on its side on the shingle, with a rag stuffed in a cracked seam. You have pitch and tow from Nikanor. Put the jobs in the order that works — then decide what the patch can and can’t do.',
    cards: [
      {
        id: 'rag',
        text: 'Pull out the rag Oded stuffed in the crack.',
        clueId: 'clue-elazar-seam',
        reasoning: 'Nothing new can go into a crack that is already full of wet cloth.',
      },
      {
        id: 'dry',
        text: 'Let the seam dry in the sun.',
        clueId: 'clue-elazar-seam',
        reasoning: 'Pitch won’t stick to wet wood, so the seam has to dry before anything else.',
      },
      {
        id: 'tow',
        text: 'Press the tow deep into the crack.',
        clueId: 'clue-elazar-seam',
        reasoning: 'The tow fills the gap. The pitch goes over it, so the tow has to be in first.',
      },
      {
        id: 'pitch',
        text: 'Smear warm pitch over the seam.',
        clueId: 'clue-elazar-seam',
        reasoning: 'The pitch seals the packed tow in and keeps the water out.',
      },
      {
        id: 'set',
        text: 'Let it set before the boat goes back in the water.',
        clueId: 'clue-elazar-seam',
        reasoning:
          'Soft pitch would wash straight out. It has to harden first, so this comes last.',
      },
    ],
    correctOrder: ['rag', 'dry', 'tow', 'pitch', 'set'],
    initialOrder: ['pitch', 'set', 'rag', 'tow', 'dry'],
    conclusion: {
      question: 'Will the patch hold tonight?',
      options: [
        {
          id: 'forever',
          text: 'It will hold for good. Oded can leave his cup behind.',
          correct: false,
          explanation: 'No patch is perfect, and a rough night finds every weak place.',
        },
        {
          id: 'mostly',
          text: 'It should keep most of the water out — but they should still bail, and stay close to the other boats.',
          correct: true,
          explanation:
            'Yes. A sealed seam lets in far less water than a stuffed rag. But water can still come over the side, so they will still need to bail.',
        },
        {
          id: 'useless',
          text: 'It won’t make any difference.',
          correct: false,
          explanation:
            'It will. A crack packed and pitched lets in far less water than a rag does.',
        },
      ],
    },
    hints: [
      {
        tier: 1,
        text: 'What has to come out of the crack before anything new can go in?',
      },
      {
        tier: 2,
        text: 'Pitch won’t stick to wet wood, and it has to harden before the boat goes back in the water.',
      },
      {
        tier: 3,
        text: 'Uncle Elazar’s order: pull out the rag, let the seam dry, press in the tow, smear on the pitch, and let it set.',
      },
    ],
    explanation:
      'Each job makes the next one work: an empty crack can dry, a dry crack takes the tow, and warm pitch over the tow seals it once it has set. (How the seam is sealed is simplified for the game.)',
    recordIds: [],
    onSolved: [
      { type: 'setFlag', flag: 'boat-patched', value: true },
      { type: 'takeItem', item: 'pitch' },
      {
        type: 'showMessage',
        text: 'The seam is sealed, and the pitch is setting in the sun. Oded runs his thumb along it and grins.',
        tone: 'narration',
      },
    ],
  },
];

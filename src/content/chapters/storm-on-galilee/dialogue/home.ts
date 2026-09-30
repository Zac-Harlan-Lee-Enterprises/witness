import { not, opt, say, solved, type DialogueInput } from './helpers';

export const HOME_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-mending',
    entries: [{ when: solved('p-corner'), node: 'done' }],
    start: 'look',
    nodes: [
      say(
        'look',
        'narrator',
        'Grandmother’s net lies across the mat, with the family’s mark knotted into it. One corner of the mark has pulled loose.',
        {
          choices: [
            opt('tie', 'Tie the loose knots.', undefined, {
              effects: [{ type: 'openPuzzle', puzzle: 'p-corner' }],
            }),
            opt('leave', 'Leave it for now.'),
          ],
        },
      ),
      say(
        'done',
        'narrator',
        'The net lies across the mat, the little boat whole again in your knots. Every family on the shore mends nets like this, all year round.',
      ),
    ],
  },
  {
    id: 'd-opening',
    characterId: 'shelomit',
    start: 'n1',
    nodes: [
      say(
        'n1',
        'narrator',
        'Capernaum, on the shore of the Sea of Galilee. Late afternoon. Grandmother Shelomit sits on her mat with a torn net across her knees.',
        { next: 'n2' },
      ),
      say(
        'n2',
        'shelomit',
        '{player}! There you are. Come and sit a moment. Did you see the crowd down on the shore?',
        {
          expression: 'glad',
          choices: [
            opt('c-who', 'So many people! Who are they listening to?', 'n3'),
            opt('c-seen', 'I saw. What’s going on?', 'n3'),
          ],
        },
      ),
      say(
        'n3',
        'shelomit',
        'The teacher everyone is talking about. So many came to hear him that he got into a boat and sat in it, a little way out on the water, and he’s teaching them from there while they stay on the shore.',
        { kind: 'paraphrase', recordId: 'rec-para-shore', next: 'n4' },
      ),
      say(
        'n4',
        'shelomit',
        'But you and I have our own work today. Your uncle Elazar is taking the boat across the lake tonight — and you’re going with him. Your first night as crew.',
        {
          choices: [
            opt('c-me', 'Me? Tonight?', 'n5a'),
            opt('c-ready', 'I’m ready. What do I do?', 'n5b'),
          ],
        },
      ),
      say(
        'n5a',
        'shelomit',
        'You. You’re old enough to pull an oar, and sensible enough to keep your head. Mostly.',
        { expression: 'glad', next: 'n6' },
      ),
      say('n5b', 'shelomit', 'Good. Then listen before you rush off.', { next: 'n6' }),
      say(
        'n6',
        'shelomit',
        'Nikanor the salter wants six jars of his salted fish carried to the far shore by morning. What he pays will cover most of what the family owes for this season’s fishing.',
        { next: 'n7' },
      ),
      say(
        'n7',
        'shelomit',
        'Before anything goes into that boat, go and sit with old Hanina at the end of the jetty, and ask him what the sky is saying. He’s read this lake for sixty years.',
        { next: 'n8' },
      ),
      say(
        'n8',
        'shelomit',
        'Then load the boat with your uncle. She only carries so much, and the jars are heavy. Here — a lamp, some bread, your cloak, and a skin of water.',
        {
          effects: [
            { type: 'giveItem', item: 'lamp' },
            { type: 'giveItem', item: 'bread' },
            { type: 'giveItem', item: 'cloak' },
            { type: 'giveItem', item: 'water-skin' },
            { type: 'startQuest', quest: 'q-crossing' },
          ],
          next: 'n8b',
        },
      ),
      say('n8b', 'shelomit', 'Keep them together, and keep your wits about you.', {
        choices: [
          opt('c-lamp', 'A lamp? Out on the water?', 'n9', { once: true }),
          opt('c-go', 'I’ll go and find Hanina.', 'n9c'),
        ],
      }),
      say(
        'n9c',
        'shelomit',
        'Wait — before you go. Hold this corner for me. The last knots are the fiddly ones, and my eyes aren’t what they were.',
        {
          choices: [opt('c-knots', 'Show me how.', 'n9d')],
        },
      ),
      say(
        'n9d',
        'shelomit',
        'It’s our mark, knotted into the mesh: the little boat, see? The numbers chalked on the frame say how many knots run together in each row and each column. Tie the loose part to match.',
        { effects: [{ type: 'openPuzzle', puzzle: 'p-corner' }], next: 'n10' },
      ),
      say(
        'n9',
        'shelomit',
        'Nights are dark on the lake. A little clay lamp kept low in the boat, out of the wind, is better than no light at all.',
        { next: 'n8b' },
      ),
      say(
        'n10',
        'narrator',
        'How to play: walk with the movement keys or the on-screen pad, and use Talk/Examine when you’re next to someone or something. The “Go to…” list takes you straight to people and places. Your journal keeps everything you learn.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-shelomit',
    characterId: 'shelomit',
    entries: [
      { when: not(solved('p-corner')), node: 'corner' },
      { when: solved('p-load'), node: 'bye' },
      { when: solved('p-sky'), node: 'load' },
    ],
    start: 'ask',
    nodes: [
      say(
        'corner',
        'shelomit',
        'The corner first, {player}. The last few knots, then you can go.',
        {
          choices: [
            opt('tie', 'I’ll tie them now.', undefined, {
              effects: [{ type: 'openPuzzle', puzzle: 'p-corner' }],
            }),
            opt('later', 'In a moment.'),
          ],
        },
      ),
      say(
        'ask',
        'shelomit',
        'Have you been out to Hanina yet? He’ll be at the end of the jetty, watching the sky.',
        {
          choices: [
            opt('why', 'Why ask Hanina? Uncle knows the lake.', 'ask2', { once: true }),
            opt('bye', 'I’m going.'),
          ],
        },
      ),
      say(
        'ask2',
        'shelomit',
        'Your uncle knows the lake by day. Hanina has sat out more storms than anyone in Capernaum. Two good heads are better than one proud one.',
        { next: 'ask' },
      ),
      say(
        'load',
        'shelomit',
        'So you’ve heard what the sky is saying. Keep it in mind when you load the boat. A boat that sits too low takes the waves over her side.',
        {
          choices: [
            opt('how', 'How much can the boat carry?', 'load2', { once: true }),
            opt('ok', 'I’ll go and load her.'),
          ],
        },
      ),
      say(
        'load2',
        'shelomit',
        'Ask your uncle — ten loads, he’ll tell you, besides the crew. The jars are one load each, and they add up quickly.',
        { next: 'load' },
      ),
      say(
        'bye',
        'shelomit',
        'Loaded and ready. Go carefully, {player}. The lake is kind — until it isn’t.',
        {
          expression: 'worried',
          choices: [
            opt('will', 'I will.'),
            opt('worried', 'Are you worried?', 'bye2', { once: true }),
          ],
        },
      ),
      say(
        'bye2',
        'shelomit',
        'A little. Grandmothers worry; it’s our work. I’ll keep a lamp burning until you’re home.',
        { expression: 'worried', next: 'bye' },
      ),
    ],
  },
];

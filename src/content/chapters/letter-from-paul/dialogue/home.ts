import {
  all,
  flag,
  has,
  not,
  opt,
  say,
  solved,
  type DialogueInput,
} from '../../road-to-jericho/dialogue/helpers';

const readingChosen = { type: 'choiceMade' as const, choice: 'choice-reading' };

/** Ammia's workshop: the news, the letter read aloud, and her answer. */
export const HOME_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-opening',
    characterId: 'ammia',
    start: 'n1',
    nodes: [
      say(
        'n1',
        'narrator',
        'Colossae, in the valley of the river Lycus. Morning. Steam drifts up from the dye vats in your grandmother’s workshop.',
        { next: 'n2' },
      ),
      say('n2', 'ammia', '{player}! Good, you’re up. I have two pieces of news for you.', {
        expression: 'glad',
        next: 'n3',
      }),
      say(
        'n3',
        'ammia',
        'Travellers came up the road last night with letters from Paul — the teacher whose message Epaphras brought us. They’re staying at Philemon’s house.',
        { next: 'n4' },
      ),
      say(
        'n4',
        'ammia',
        'Tonight the assembly gathers there, at lamp-lighting, to hear the letters read. Paul has never seen our faces. But he has written to us.',
        { expression: 'glad', next: 'n5' },
      ),
      say(
        'n5',
        'narrator',
        'Then she holds out a bundle of damp papyrus sheets. The cord that tied them has come undone.',
        { next: 'n6' },
      ),
      say(
        'n6',
        'ammia',
        'And this came yesterday with Attalos the mule driver. It’s from Kallias.',
        {
          choices: [
            opt('c-who', 'Kallias? Your apprentice who left?', 'n7a'),
            opt('c-what', 'What does it say?', 'n7b'),
          ],
        },
      ),
      say(
        'n7a',
        'ammia',
        'The same. He went off to Laodicea in the winter, after the red batch. I said hard things. So did he.',
        { expression: 'sad', next: 'n8' },
      ),
      say(
        'n7b',
        'ammia',
        'I don’t know. The rain got into it on the road, the sheets are out of order, and my eyes are no good for small writing any more.',
        { next: 'n8' },
      ),
      say(
        'n8',
        'ammia',
        'Take it to Zenon under the colonnade. He’ll help you put it in order. Then come back and read it to me — all of it.',
        {
          effects: [
            { type: 'giveItem', item: 'kallias-letter' },
            { type: 'startQuest', quest: 'q-letters' },
          ],
          choices: [
            opt('c-batch', 'What happened with the red batch?', 'n9', { once: true }),
            opt('c-go', 'I’ll go to Zenon.', 'n10'),
          ],
        },
      ),
      say(
        'n9',
        'ammia',
        'A merchant’s order: twenty coins’ worth of good wool. Kallias left the madder vat to go to the festival, and when he came back the colour had gone dull and blotchy. I paid the merchant back myself.',
        { next: 'n9b' },
      ),
      say(
        'n9b',
        'ammia',
        'I told him he’d cost me a season. He said the madder was bad. Then he was gone.',
        { expression: 'sad', next: 'n8' },
      ),
      say(
        'n10',
        'narrator',
        'How to play: walk with the movement keys or the on-screen pad. When you’re near someone, use Talk/Examine. The “Go to…” list takes you straight to people and places. Your journal keeps everything you learn.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-ammia',
    characterId: 'ammia',
    entries: [
      { when: all(solved('p-pack'), flag('packed')), node: 'bye' },
      { when: has('ammia-letter'), node: 'pack' },
      { when: all(solved('p-sheets'), not(readingChosen)), node: 'read' },
    ],
    start: 'go',
    nodes: [
      say(
        'go',
        'ammia',
        'Zenon is under the colonnade, by the potter’s stall. He’ll know what to do with it.',
        { choices: [opt('ok', 'I’m going.')] },
      ),

      // ── Reading Kallias's letter aloud ──────────────────────────────────
      say('read', 'ammia', 'You’re back. Did Zenon manage it?', { next: 'read2' }),
      say('read2', 'player', 'We did. It’s all in order now.', { next: 'read3' }),
      say('read3', 'ammia', 'Then sit down and read it to me. Slowly.', { next: 'read4' }),
      say(
        'read4',
        'narrator',
        'You unfold the sheets. The greeting, the good wishes — and then the part about the red batch: it was his fault; he said it was bad madder; that was a lie.',
        {
          choices: [
            opt('every', 'Read every word, just as he wrote it.', 'r-every', {
              effects: [{ type: 'recordChoice', choice: 'choice-reading', option: 'every-word' }],
            }),
            opt('soften', 'Leave out the part where he admits he lied.', 'r-soften', {
              effects: [{ type: 'recordChoice', choice: 'choice-reading', option: 'softened' }],
            }),
            opt('plea', 'Read it all — then add, “He means it, Ammia.”', 'r-plea', {
              effects: [
                { type: 'recordChoice', choice: 'choice-reading', option: 'added-plea' },
                { type: 'adjustTrust', character: 'kallias', delta: 1 },
              ],
            }),
          ],
        },
      ),
      say(
        'r-every',
        'narrator',
        'You read it all, even the hard part. Ammia doesn’t interrupt once.',
        { next: 'r-every2' },
      ),
      say(
        'r-every2',
        'ammia',
        'He wrote that down, did he. That it was a lie. And put his own name under it.',
        { expression: 'surprised', next: 'ask' },
      ),
      say(
        'r-soften',
        'narrator',
        'You read the greeting, the wishes and the request, and skip the lines about the lie. It feels kinder.',
        { next: 'r-soften2' },
      ),
      say('r-soften2', 'ammia', 'Eight coins of twenty. And he wants to come back.', {
        next: 'ask',
      }),
      say(
        'r-plea',
        'narrator',
        'You read every word. Then, before you can stop yourself, you add: “He means it, Ammia.”',
        { next: 'r-plea2' },
      ),
      say('r-plea2', 'ammia', 'So you’re on his side now, are you? …Good. Someone should be.', {
        expression: 'glad',
        next: 'ask',
      }),
      say(
        'ask',
        'ammia',
        'I’ll answer him. You write — your hand is better than mine since Zenon started teaching you.',
        { next: 'dictate' },
      ),
      say('dictate', 'narrator', 'Ammia speaks slowly, and you write down every word:', {
        next: 'letter',
      }),
      say(
        'letter',
        'narrator',
        '“Ammia to Kallias: greetings. I had your letter read to me. What you did cost me dearly, and what I said in anger cost something too. Come home, and we will speak face to face — tonight at Philemon’s house if you are brave, tomorrow if you are not. The debt is still a debt. Farewell.”',
        { next: 'sign' },
      ),
      say(
        'sign',
        'ammia',
        'Now hold it still while I make my mark at the bottom. There. He’s at the dye works by the bridge, down the Laodicea road. Take it to him.',
        {
          effects: [
            { type: 'giveItem', item: 'ammia-letter' },
            { type: 'setFlag', flag: 'ammia-letter-written', value: true },
            { type: 'adjustCounter', counter: 'hour', delta: 1 },
          ],
          next: 'sign2',
        },
      ),
      say(
        'sign2',
        'ammia',
        'Pack the travel bag first, and ask me the way before you go. It’s a long walk down the valley, and back again before lamp-lighting.',
      ),

      // ── Packing ─────────────────────────────────────────────────────────
      say(
        'pack',
        'ammia',
        'The travel bag is by the rug. Take what you need — it only holds so much.',
        {
          choices: [
            opt('c-cloak', 'Is that Kallias’s old cloak on the peg?', 'pack2', { once: true }),
            opt('c-far', 'How far is the bridge?', 'pack3', { once: true }),
            opt('c-angry', 'Are you still angry with him?', 'pack-angry', { once: true }),
            opt('c-spoiled', 'Why did you keep the spoiled wool?', 'pack-spoiled', {
              once: true,
              when: flag('saw-spoiled-wool'),
            }),
            opt('c-if', 'What if he won’t come?', 'pack-if', { once: true }),
            opt('c-way', 'Which way is Nikon’s dye works?', undefined, {
              when: not(solved('p-pack')),
              effects: [{ type: 'openPuzzle', puzzle: 'p-pack' }],
            }),
            opt('c-ok', 'I’ll pack now.'),
          ],
        },
      ),
      say(
        'pack-angry',
        'ammia',
        'Angry? Like a burn is hot. Less every day — but touch it and you’ll know. It isn’t the twenty coins. It’s that he looked me in the eye and blamed the madder.',
        { expression: 'sad', next: 'pack' },
      ),
      say(
        'pack-spoiled',
        'ammia',
        'So I’d remember that a season’s work can go in an afternoon. And so I’d remember that I said things that afternoon I can’t take back either. Wool keeps a memory better than I do.',
        { expression: 'sad', next: 'pack' },
      ),
      say(
        'pack-if',
        'ammia',
        'Then you’ll have done what I asked, and I’ll have said what I meant. The rest is his to carry. …Bring back whatever he says, all the same. Even if it’s nothing.',
        { expression: 'worried', next: 'pack' },
      ),
      say(
        'pack2',
        'ammia',
        'It is. I never gave it away. Take it, if you think he’ll want it. It’s heavy, mind.',
        { next: 'pack' },
      ),
      say(
        'pack3',
        'ammia',
        'Past the fourth milestone. Two hours down and two hours back — and then the gathering.',
        { next: 'pack' },
      ),
      say('bye', 'ammia', 'Go carefully. And {player} — whatever he says, bring it back to me.', {
        expression: 'worried',
        choices: [opt('will', 'I will.')],
      }),
    ],
  },
  {
    id: 'd-gate-blocked',
    entries: [
      { when: not(has('ammia-letter')), node: 'no-letter' },
      { when: not(solved('p-pack')), node: 'way' },
    ],
    start: 'pack',
    nodes: [
      say(
        'no-letter',
        'narrator',
        'Not yet. You don’t even know what Kallias’s letter says. Zenon first, then Ammia.',
      ),
      say(
        'way',
        'narrator',
        'There’s more than one dye works by a bridge down that valley, and you don’t know which is Nikon’s. Go home and ask Ammia the way.',
        { effects: [{ type: 'setFlag', flag: 'tried-gate', value: true }] },
      ),
      say(
        'pack',
        'narrator',
        'It’s a long road to set off on with nothing packed. Go home and pack the travel bag first.',
        { effects: [{ type: 'setFlag', flag: 'tried-gate', value: true }] },
      ),
    ],
  },
];

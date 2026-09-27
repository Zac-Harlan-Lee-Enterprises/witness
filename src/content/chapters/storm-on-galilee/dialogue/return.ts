import { flag, opt, say, type DialogueInput } from './helpers';

/**
 * Home before dawn (Act 5), and the hand-over to Scripture (Act 6). Nobody
 * in the story knows what happened aboard the teacher's boat — they only
 * saw it from a distance — so no one retells it: the Scripture Connection
 * shows what Mark wrote.
 */
export const RETURN_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-homecoming',
    start: 'h1',
    nodes: [
      say(
        'h1',
        'narrator',
        'It’s the middle of the night when the boat bumps against the jetty at Capernaum. A lamp is burning at the end of it.',
        { next: 'h2' },
      ),
      say('h2', 'narrator', 'Grandmother Shelomit is standing there, holding it up.', {
        next: 'h3',
      }),
      say('h3', 'narrator', 'Talk to Grandmother Shelomit.', { kind: 'instruction' }),
    ],
  },
  {
    id: 'd-shelomit-night',
    characterId: 'shelomit',
    entries: [{ when: flag('heard-home'), node: 'again' }],
    start: 'w1',
    nodes: [
      say('w1', 'shelomit', '{player}! Oh, let me look at you. Let me look at all of you.', {
        expression: 'glad',
        next: 'w2',
      }),
      say(
        'w2',
        'shelomit',
        'The wind came howling down the lanes after dark. I came down here with the lamp, and I stood here, and I prayed.',
        {
          expression: 'worried',
          choices: [
            opt('storm', 'The storm was terrible. We nearly went under.', 'w3'),
            opt('stopped', 'And then the wind just stopped. All at once.', 'w4'),
          ],
        },
      ),
      say('w3', 'shelomit', 'I know. I could hear the lake roaring from here. And then?', {
        expression: 'worried',
        choices: [opt('stopped', 'And then the wind just stopped. All at once.', 'w4')],
      }),
      say('w4', 'shelomit', 'Stopped?', { expression: 'surprised', next: 'w5' }),
      say(
        'w5',
        'player',
        'All at once. The waves just… lay down. Uncle says he’s never seen anything like it.',
        { next: 'w6' },
      ),
      say('w6', 'shelomit', 'And the teacher’s boat?', { next: 'w7' }),
      say(
        'w7',
        'player',
        'It was still out there when the wind dropped, going on towards the far shore.',
        { next: 'w8' },
      ),
      say(
        'w8',
        'shelomit',
        'Then whatever happened out there, the people in that boat will be telling it for the rest of their lives.',
        { next: 'w9' },
      ),
      say(
        'w9',
        'narrator',
        'The teacher’s boat went on across the lake. What happened aboard it that night is written in the Gospel of Mark, chapter 4. Let’s look at it carefully: what the passage says, what we know about its world, and how Christians have understood it. Each part is labeled.',
        {
          kind: 'instruction',
          effects: [
            { type: 'setFlag', flag: 'heard-home', value: true },
            { type: 'openPanel', panel: 'scripture-connection' },
          ],
        },
      ),
      say(
        'again',
        'shelomit',
        'Go and sleep, {player}. You’ve earned it. We’ll talk more in the morning.',
        { expression: 'glad' },
      ),
    ],
  },
];

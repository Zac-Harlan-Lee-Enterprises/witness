import { all, opt, say, solved, type DialogueInput } from './helpers';

const objectiveDone = (objective: string) => ({
  type: 'objectiveDone' as const,
  quest: 'q-remedy',
  objective,
});
const inStage = (stage: string) => ({ type: 'questStage' as const, quest: 'q-remedy', stage });

export const HOME_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-opening',
    characterId: 'miriam',
    start: 'n1',
    nodes: [
      say(
        'n1',
        'narrator',
        'Jerusalem, early morning. The smell of drying herbs fills Aunt Miriam’s house.',
        { next: 'n2' },
      ),
      say('n2', 'miriam', '{player}! Good, you’re up. Come here — I need your help today.', {
        expression: 'glad',
        next: 'n3',
      }),
      say(
        'n3',
        'miriam',
        'My friend Rivka sent word from Jericho. Her son Natan has a fever that won’t go away.',
        { expression: 'worried', next: 'n4' },
      ),
      say(
        'n4',
        'miriam',
        'I’ve made a remedy for him. But my knees can’t manage that road anymore. I need you to carry it.',
        {
          choices: [
            opt('c-me', 'Me? All the way to Jericho?', 'n5a'),
            opt('c-yes', 'Of course. What do I need to know?', 'n5b'),
          ],
        },
      ),
      say(
        'n5a',
        'miriam',
        'All the way. It’s a long day’s walk — downhill the whole way, which your legs will feel tomorrow.',
        { next: 'n6' },
      ),
      say('n5b', 'miriam', 'That’s my brave one. Listen carefully, then.', {
        expression: 'glad',
        next: 'n6',
      }),
      say(
        'n6',
        'miriam',
        'The road down to Jericho has a reputation. Robbers. Don’t go blindly — ask travelers in the market what they know.',
        { expression: 'worried', next: 'n7' },
      ),
      say(
        'n7',
        'miriam',
        'When you’ve heard enough, come back and pack your satchel. It only holds so much, so choose wisely.',
        {
          effects: [
            { type: 'giveItem', item: 'remedy' },
            { type: 'giveItem', item: 'letter' },
            { type: 'startQuest', quest: 'q-remedy' },
          ],
          next: 'n8',
        },
      ),
      say(
        'n8',
        'miriam',
        'Here’s the remedy, and a letter telling Rivka how to prepare it. Keep them safe.',
        {
          choices: [
            opt('c-what', 'What’s in the remedy?', 'n9', { once: true }),
            opt('c-go', 'I’ll head to the market.', 'n10'),
          ],
        },
      ),
      say(
        'n9',
        'miriam',
        'Herbs that help with fever. Nothing magic — just good care, and patience.',
        { next: 'n8' },
      ),
      say(
        'n10',
        'narrator',
        'How to play: walk with the movement keys or the on-screen pad. When you’re near someone, use Talk/Examine. Open the “Go to…” list any time to travel straight to people and places. Your journal keeps everything you learn.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-miriam',
    characterId: 'miriam',
    entries: [
      { when: solved('p-satchel'), node: 'bye' },
      { when: all(inStage('prepare'), objectiveDone('ask-road')), node: 'pack' },
    ],
    start: 'ask',
    nodes: [
      say(
        'ask',
        'miriam',
        'Have you asked around the market yet? People who know the road are worth listening to.',
        {
          choices: [
            opt('who', 'Who should I ask?', 'ask2', { once: true }),
            opt('bye', 'I’ll go now.'),
          ],
        },
      ),
      say(
        'ask2',
        'miriam',
        'Try Malik, the Nabataean trader near the east gate. Old Shimon the shepherd often sits there too — he knows the wilderness paths better than anyone.',
        { next: 'ask' },
      ),
      say(
        'pack',
        'miriam',
        'You’ve learned something about the road — I can see it on your face. Now use it. The satchel is by the table. Pack what you’ll truly need.',
        {
          choices: [
            opt('how-much', 'How much can I carry?', 'pack2', { once: true }),
            opt('ok', 'I’ll pack now.'),
          ],
        },
      ),
      say(
        'pack2',
        'miriam',
        'Six measures of weight, no more. Water is heavy. Knowing where to find more is lighter than carrying it.',
        { next: 'pack' },
      ),
      say(
        'bye',
        'miriam',
        'Packed and ready. Go carefully, {player}. Keep your eyes open on the road — and your heart too.',
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
        'miriam',
        'A little. That’s what aunts are for. But I also know you. You’ll think before you act.',
        { expression: 'glad', next: 'bye' },
      ),
    ],
  },
];

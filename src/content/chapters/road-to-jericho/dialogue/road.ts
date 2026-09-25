import { INCIDENT_CLUES } from '../clues';
import { any, chose, flag, has, opt, say, solved, type DialogueInput } from './helpers';

const trustAtLeast = (n: number) => ({ type: 'trust' as const, character: 'menashe', gte: n });
const noWater = 'You have no water left to clean his wounds.';
/** Menashe recognises the player only if they actually spoke in the market. */
const MET_IN_MARKET = { type: 'conversationDone' as const, dialogue: 'd-menashe' };

/**
 * The injured-traveler encounter. The decision weighs safety, supplies,
 * time and prejudice. None of the options is a "morality button": each one
 * is something a reasonable, frightened person might do, and each has
 * concrete consequences later. Options that are impossible are SHOWN, with
 * the reason, so the constraint is visible.
 */
export const ROAD_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-fork',
    start: 'f1',
    nodes: [
      say(
        'f1',
        'narrator',
        'The road divides. Ahead, the main road squeezes into a narrow bend between red cliffs. To the right, a dry wadi runs down into the rocks. To the left, a narrow path climbs the ridge.',
        { next: 'f2' },
      ),
      say(
        'f2',
        'narrator',
        'Before you choose, look around. Examine what you see here — and remember what you heard in Jerusalem. When you’re ready, use the crossroads marker to decide.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-incident-arrival',
    start: 'i1',
    nodes: [
      say('i1', 'narrator', 'The ridge path drops back down to the road, below the bend.', {
        next: 'i2',
      }),
      say(
        'i2',
        'narrator',
        'Something is wrong. A broken jar lies in the road. Footprints scuff the dust. And there, in the shade of the rocks — a man, lying very still.',
        { next: 'i3' },
      ),
      say('i3', 'narrator', 'Go to him, or look around first. It’s up to you.', {
        kind: 'instruction',
      }),
    ],
  },
  {
    id: 'd-think',
    start: 'k1',
    nodes: [
      say('k1', 'narrator', 'You’ve seen enough to start piecing together what happened here.', {
        choices: [
          opt('now', 'Think it through now.', undefined, {
            effects: [{ type: 'openPuzzle', puzzle: 'p-what-happened' }],
          }),
          opt('later', 'Keep looking first.'),
        ],
      }),
    ],
  },
  {
    id: 'd-menashe-road',
    characterId: 'menashe',
    entries: [
      { when: chose('choice-traveler'), node: 'after' },
      { when: solved('p-what-happened'), node: 'd0' },
      { when: MET_IN_MARKET, node: 'known0' },
    ],
    start: 'stranger0',
    nodes: [
      say(
        'known0',
        'narrator',
        'It’s Menashe — the Samaritan oil merchant from the market. There’s a cut on his forehead, his ankle is badly swollen, and his cloak is gone.',
        { next: 'q1' },
      ),
      say(
        'stranger0',
        'narrator',
        'A man lies in the shade — awake, but dazed. There’s a cut on his forehead, his ankle is badly swollen, and his cloak is gone.',
        { next: 'q1' },
      ),
      say('q1', 'menashe', 'Are they… are they gone?', {
        choices: [
          opt('sip', 'Here — have a sip of water.', 'q3', {
            once: true,
            requires: has('water-skin'),
            unavailableText: 'You have no water.',
          }),
          opt('look', 'I don’t know yet. Let me look around.', 'q4'),
          opt('think', 'Let me think through what happened here.', undefined, {
            when: { type: 'cluesFound', clues: INCIDENT_CLUES, min: 3 },
            effects: [{ type: 'openPuzzle', puzzle: 'p-what-happened' }],
          }),
        ],
      }),
      say('q3', 'menashe', 'Thank you… thank you.', {
        effects: [{ type: 'setFlag', flag: 'gave-sip', value: true }],
        next: 'q1',
      }),
      say(
        'q4',
        'narrator',
        'Look for signs of what happened. When you understand it, you’ll know better how safe it is to stay.',
        { kind: 'instruction' },
      ),

      // ── After working out what happened: the decision ────────────────────
      say(
        'd0',
        'narrator',
        'The robbers’ tracks lead away north, and the spilled oil dried long ago. As far as you can tell, the danger has passed — though you can’t be completely sure.',
        {
          branches: [
            { when: trustAtLeast(2), next: 'friend' },
            { when: MET_IN_MARKET, next: 'known' },
          ],
          next: 'stranger',
        },
      ),
      say(
        'friend',
        'menashe',
        'You… it’s you. The one with the measures, from the market. Of all the people to come down this road.',
        { next: 'explain' },
      ),
      say(
        'known',
        'menashe',
        'I know you… from the market. You were there when Ezer was shouting at me.',
        { next: 'explain' },
      ),
      say(
        'stranger',
        'menashe',
        'You don’t have to stop for me. I’m a Samaritan. I know what people say about us.',
        { next: 'explain' },
      ),
      say(
        'explain',
        'menashe',
        'They came down from the rocks. Took my purse and my cloak, broke my oil jar. I twisted my ankle trying to run. I can’t walk far on it.',
        { next: 'decide' },
      ),
      say(
        'decide',
        'narrator',
        'The sun is high. You still have Rivka’s remedy to deliver, and a long way to go. What will you do?',
        {
          choices: [
            opt(
              'tend-walk',
              'Clean and bind his wounds, then help him walk to the inn. (Slow — it will take hours.)',
              'care',
              {
                requires: has('water-skin'),
                unavailableText: noWater,
                effects: [
                  { type: 'recordChoice', choice: 'choice-traveler', option: 'tend-walk' },
                  { type: 'takeItem', item: 'water-skin' },
                  { type: 'adjustCounter', counter: 'hour', delta: 6 },
                  { type: 'adjustTrust', character: 'menashe', delta: 2 },
                ],
              },
            ),
            opt(
              'tend-caravan',
              'Treat his wounds, then wait for Malik’s caravan to carry him.',
              'care',
              {
                when: flag('malik-watching'),
                requires: has('water-skin'),
                unavailableText: noWater,
                effects: [
                  { type: 'recordChoice', choice: 'choice-traveler', option: 'tend-caravan' },
                  { type: 'takeItem', item: 'water-skin' },
                  { type: 'adjustCounter', counter: 'hour', delta: 3 },
                  { type: 'adjustTrust', character: 'menashe', delta: 2 },
                ],
              },
            ),
            opt(
              'send-help',
              'Leave him what water and food you have, and hurry ahead to send help from the inn.',
              'leave',
              {
                requires: any(has('water-skin'), has('bread')),
                unavailableText: 'You have no water or food to leave with him.',
                effects: [
                  { type: 'recordChoice', choice: 'choice-traveler', option: 'send-help' },
                  { type: 'setFlag', flag: 'sent-for-help', value: true },
                  { type: 'adjustCounter', counter: 'hour', delta: 1 },
                ],
              },
            ),
            opt('hurry-on', 'Hurry on to Jericho. It isn’t safe to stay here.', 'hurry', {
              effects: [
                { type: 'recordChoice', choice: 'choice-traveler', option: 'hurry-on' },
                { type: 'adjustCounter', counter: 'hour', delta: 1 },
                { type: 'adjustTrust', character: 'menashe', delta: -1 },
              ],
            }),
          ],
        },
      ),

      // ── Giving care (shared by both "tend" options) ────────────────────────
      say('care', 'narrator', 'You kneel beside him and wash the cut with water from your skin.', {
        branches: [{ when: has('linen'), next: 'linen' }],
        next: 'no-linen',
      }),
      say(
        'linen',
        'narrator',
        'You bind his forehead and his swollen ankle with your linen strips.',
        {
          effects: [
            { type: 'takeItem', item: 'linen' },
            { type: 'setFlag', flag: 'bound-wounds', value: true },
          ],
          branches: [{ when: has('oil'), next: 'oil' }],
          next: 'cloak-check',
        },
      ),
      say(
        'no-linen',
        'narrator',
        'You have no bandages, so you tear a strip from the hem of your own tunic. It will have to do.',
        {
          effects: [{ type: 'setFlag', flag: 'improvised-bandage', value: true }],
          branches: [{ when: has('oil'), next: 'oil' }],
          next: 'cloak-check',
        },
      ),
      say(
        'oil',
        'narrator',
        'You pour a little olive oil on the cut to soothe it, the way Aunt Miriam taught you.',
        {
          effects: [
            { type: 'takeItem', item: 'oil' },
            { type: 'setFlag', flag: 'soothed-wounds', value: true },
          ],
          next: 'cloak-check',
        },
      ),
      say('cloak-check', 'narrator', 'He’s shivering in the shade, even in the heat.', {
        branches: [{ when: has('cloak'), next: 'cloak' }],
        next: 'care-end',
      }),
      say('cloak', 'narrator', 'You have your spare cloak in your satchel.', {
        choices: [
          opt('give', 'Give him your cloak.', 'cloak-given', {
            effects: [
              { type: 'takeItem', item: 'cloak' },
              { type: 'recordChoice', choice: 'choice-cloak', option: 'given' },
              { type: 'adjustTrust', character: 'menashe', delta: 1 },
            ],
          }),
          opt('keep', 'Keep it for yourself.', 'care-end'),
        ],
      }),
      say('cloak-given', 'menashe', 'Your own cloak? I… don’t know what to say.', {
        next: 'care-end',
      }),
      say('care-end', 'narrator', 'That’s the best you can do here.', {
        branches: [{ when: chose('choice-traveler', 'tend-caravan'), next: 'wait' }],
        next: 'walk',
      }),
      say(
        'walk',
        'narrator',
        'Menashe leans on your shoulder. Step by slow step, you help him down the road toward the inn. The sun crawls across the sky.',
        {
          effects: [
            { type: 'setFlag', flag: 'menashe-with-you', value: true },
            { type: 'transition', scene: 'jericho', spawn: 'from-road' },
          ],
        },
      ),
      say(
        'wait',
        'narrator',
        'You wait together in the shade. After a long while, bells jingle on the road — Malik’s caravan, coming down through the bend.',
        { next: 'malik1' },
      ),
      say('malik1', 'malik', 'Ho! My young friend — and who is this? A Samaritan? Hm.', {
        choices: [
          opt('robbed', 'He was robbed. He needs help, whoever he is.', 'malik2'),
          opt('remind', 'You told me travelers must look after each other.', 'malik2'),
        ],
      }),
      say(
        'malik2',
        'malik',
        '…So I did. Up on the donkey with him, then — gently! We’ll all go down to the inn together.',
        {
          effects: [
            { type: 'adjustTrust', character: 'malik', delta: 1 },
            { type: 'setFlag', flag: 'menashe-with-you', value: true },
            { type: 'transition', scene: 'jericho', spawn: 'from-road' },
          ],
        },
      ),

      // ── Leaving supplies and going for help ───────────────────────────────
      say('leave', 'narrator', 'You leave him what you can spare.', {
        branches: [{ when: has('water-skin'), next: 'leave-water' }],
        next: 'leave-bread',
      }),
      say('leave-water', 'narrator', 'You set your water skin beside him.', {
        effects: [{ type: 'takeItem', item: 'water-skin' }],
        branches: [{ when: has('bread'), next: 'leave-bread' }],
        next: 'leave-promise',
      }),
      say('leave-bread', 'narrator', 'You unwrap your bread and dates and put them in his hands.', {
        effects: [{ type: 'takeItem', item: 'bread' }],
        next: 'leave-promise',
      }),
      say('leave-promise', 'player', 'I’ll send someone from the inn. I promise.', {
        branches: [{ when: trustAtLeast(1), next: 'trusting' }],
        next: 'doubting',
      }),
      say('trusting', 'menashe', 'I believe you. Go — and hurry.', {
        effects: [{ type: 'adjustTrust', character: 'menashe', delta: 1 }],
      }),
      say('doubting', 'menashe', 'Will you really? …Go, then. I’ll wait. What else can I do?'),

      // ── Hurrying on ──────────────────────────────────────────────────────
      say(
        'hurry',
        'narrator',
        'You step back onto the road, heart pounding. Maybe someone else will come. Maybe it’s a trap. It’s hard to know what’s right when you’re afraid.',
        { next: 'hurry2' },
      ),
      say('hurry2', 'menashe', '…Go, then.'),

      say('after', 'menashe', 'Please… hurry.'),
    ],
  },
  {
    id: 'd-road-exit-blocked',
    start: 'x1',
    nodes: [
      say(
        'x1',
        'narrator',
        'Behind you, the injured man lies in the shade. Will you really walk past?',
        {
          choices: [
            opt('back', 'Go back to him.'),
            opt('keep', 'Keep walking to Jericho.', 'x2', {
              effects: [
                { type: 'recordChoice', choice: 'choice-traveler', option: 'hurry-on' },
                { type: 'adjustCounter', counter: 'hour', delta: 1 },
                { type: 'adjustTrust', character: 'menashe', delta: -1 },
              ],
            }),
          ],
        },
      ),
      say('x2', 'narrator', 'You keep walking. You tell yourself someone else will come.', {
        effects: [
          { type: 'adjustCounter', counter: 'hour', delta: 1 },
          { type: 'transition', scene: 'jericho', spawn: 'from-road' },
        ],
      }),
    ],
  },
];

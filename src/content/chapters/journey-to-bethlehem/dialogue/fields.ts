import { all, chose, flag, has, not, opt, say, setFlag, type DialogueInput } from './helpers';

const lambFound = { type: 'recordChoice' as const, choice: 'choice-lamb', option: 'found' };
const lambLeft = { type: 'recordChoice' as const, choice: 'choice-lamb', option: 'left' };

/**
 * The fold on the terraces below the village. Yonatan, Old Yoram and the
 * fold are fictional; they are NOT the shepherds of Luke 2, who stay
 * off-stage (Hagit reports their words later, as labelled paraphrase).
 */
export const FIELDS_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-fold-arrival',
    start: 'f1',
    nodes: [
      say(
        'f1',
        'narrator',
        'The path drops through the terraces to the fold. The wind is picking up, and it’s cold. Sheep are crowding toward the gate for the night.',
        { next: 'f2' },
      ),
      say('f2', 'narrator', 'Yonatan is at the fold gate. Take him his supper.', {
        kind: 'instruction',
      }),
    ],
  },
  {
    id: 'd-yonatan',
    characterId: 'yonatan',
    entries: [
      { when: flag('carrying-lamb'), node: 'return' },
      { when: chose('choice-lamb', 'found'), node: 'after-found' },
      { when: chose('choice-lamb', 'left'), node: 'after-left' },
      { when: flag('searching'), node: 'searching' },
    ],
    start: 'y1',
    nodes: [
      say(
        'y1',
        'yonatan',
        '{player}! Is that supper? You’re a hero. Hold on — I’m counting them in.',
        {
          expression: 'glad',
          effects: [
            { type: 'takeItem', item: 'supper' },
            { type: 'takeItem', item: 'cloak' },
            setFlag('supper-delivered'),
          ],
          next: 'y2',
        },
      ),
      say(
        'y2',
        'narrator',
        'Yonatan holds his staff across the gateway. One by one the sheep pass under it, and he counts under his breath.',
        { next: 'y3' },
      ),
      say('y3', 'yonatan', '…thirty-eight, thirty-nine. Thirty-nine? There should be forty.', {
        expression: 'worried',
        next: 'y4',
      }),
      say(
        'y4',
        'yonatan',
        'It’s the speckled lamb — the one with the black ear. Its mother won’t stop calling. It must have wandered off while I was watering them at the trough.',
        { expression: 'worried', effects: [setFlag('lamb-missing')], next: 'y5' },
      ),
      say(
        'y5',
        'yonatan',
        'I can’t leave the flock, and Old Yoram’s knees won’t take the rough ground in the dark.',
        { expression: 'worried', next: 'y6' },
      ),
      say(
        'y6',
        'narrator',
        'The sun is sinking behind the hills. Your mother wants you home by nightfall.',
        {
          choices: [
            opt('search', 'I’ll find the lamb.', 'y7', { effects: [setFlag('searching')] }),
            opt('home', 'It’s getting dark — I should go home.', 'y8', {
              effects: [lambLeft, setFlag('yoram-searching')],
            }),
          ],
        },
      ),
      say(
        'y7',
        'yonatan',
        'Look for signs before you go charging off. Lambs leave traces, and they don’t push through thorns if they can help it. When you know where it went, go and get it.',
      ),
      say('y8', 'yonatan', 'Go on, then. Tell Aunt Tamar I’m well fed. Yoram and I will find it.'),
      say(
        'searching',
        'yonatan',
        'Any sign of it? Look around the trough and the ways out of here — and watch its mother.',
      ),
      say(
        'return',
        'narrator',
        'Yonatan lifts the lamb from your shoulders. Its mother pushes through the flock, calling, and the lamb answers.',
        {
          effects: [
            { type: 'setFlag', flag: 'carrying-lamb', value: false },
            setFlag('lamb-returned'),
            lambFound,
            { type: 'adjustTrust', character: 'yonatan', delta: 2 },
          ],
          next: 'return2',
        },
      ),
      say('return2', 'yonatan', 'Forty. Every one of them. I owe you, {player}.', {
        expression: 'glad',
        next: 'return3',
      }),
      say('return3', 'yonatan', 'Now go home — it’s nearly dark, and Aunt Tamar will worry.'),
      say('after-found', 'yonatan', 'Forty, all asleep. Go home, {player}.', { next: 'watch' }),
      say('after-left', 'yonatan', 'Go on home — Yoram’s gone looking. We’ll manage.', {
        next: 'watch',
      }),
      say('watch', 'yonatan', 'Unless you want to keep me company a moment?', {
        choices: [
          opt('night', 'What do you do out here all night?', 'w-night', { once: true }),
          opt('afraid', 'Do you ever get scared in the dark?', 'w-afraid', { once: true }),
          opt('cloak', 'Is the cloak warm enough?', 'w-cloak', { once: true }),
          opt('go', 'I’d better go home.'),
        ],
      }),
      say(
        'w-night',
        'yonatan',
        'Keep the fire in, listen, count them again when I can’t sleep. Yoram takes the first half of the night and I take the second. Mostly it’s stars, and sheep breathing, and Yoram snoring.',
        { next: 'watch' },
      ),
      say(
        'w-afraid',
        'yonatan',
        'Sometimes. A jackal calls, or a stone rolls down the gully, and your heart jumps. Then you remember the sheep are more scared than you are, and somebody has to be the brave one.',
        { expression: 'worried', next: 'watch' },
      ),
      say(
        'w-cloak',
        'yonatan',
        'Aunt Tamar’s cloak could keep a donkey warm. Tell her I said so. Tell her I said thank you, too — I always forget.',
        { expression: 'glad', next: 'watch' },
      ),
    ],
  },
  {
    id: 'd-yoram',
    characterId: 'yoram',
    start: 'o1',
    nodes: [
      say('o1', 'yoram', 'Sit a moment, child. The fire’s warm, even if my knees aren’t.', {
        expression: 'glad',
        next: 'hub',
      }),
      say('hub', 'yoram', 'The fire’s still warm.', {
        choices: [
          opt('long', 'Have you kept sheep a long time?', 'long', { once: true }),
          opt('count', 'Why does Yonatan count them at the gate?', 'count', { once: true }),
          opt('lamb', 'Where would a lost lamb go?', 'lamb', {
            once: true,
            when: { type: 'all', of: [flag('lamb-missing'), not(chose('choice-lamb'))] },
          }),
          opt('newborn', 'Whose lamb is that you’re holding?', 'newborn', { once: true }),
          opt('milk', 'I have a jar of goat’s milk. Could the lamb have some?', 'milk', {
            when: all(has('milk'), flag('asked-newborn'), not(chose('choice-milk'))),
          }),
          opt('bye', 'Rest well, Yoram.'),
        ],
      }),
      say(
        'long',
        'yoram',
        'Since I was smaller than you. My father kept sheep on these terraces, and his father before him. The sheep don’t change much. Only the shepherds get older.',
        { next: 'hub' },
      ),
      say(
        'count',
        'yoram',
        'So that you know. A flock can look whole from across a field and still be missing one.',
        { next: 'hub' },
      ),
      say('lamb', 'yoram', 'Wherever the signs say. Don’t guess, child — look.', { next: 'hub' }),
      say('newborn', 'yoram', 'Born this morning. Its mother is sulking, so I’m keeping it warm.', {
        expression: 'glad',
        effects: [setFlag('asked-newborn')],
        next: 'newborn2',
      }),
      say(
        'newborn2',
        'yoram',
        'She won’t let it feed yet. She will, by morning, most likely. But it’s a long, cold night to be hungry in.',
        { next: 'hub' },
      ),
      say(
        'milk',
        'yoram',
        'Goat’s milk? …It would take it. It’s hungry enough to take anything. But that jar is for somebody, isn’t it?',
        {
          choices: [
            opt('share', 'Pour some for the lamb. Dodi can have the rest.', 'shared', {
              effects: [
                { type: 'recordChoice', choice: 'choice-milk', option: 'shared' },
                { type: 'adjustTrust', character: 'yoram', delta: 1 },
              ],
            }),
            opt('keep', 'It’s for my little cousin. I’d better not.', 'kept', {
              effects: [{ type: 'recordChoice', choice: 'choice-milk', option: 'kept' }],
            }),
          ],
        },
      ),
      say(
        'shared',
        'narrator',
        'Yoram dips a corner of his cloak in the milk and lets the lamb suck it. Then again. Then again, until half the jar is gone.',
        { next: 'shared2' },
      ),
      say(
        'shared2',
        'yoram',
        'Look at it go. Tell your little cousin he shared his supper with a lamb tonight. He can boast about it when he’s older.',
        { expression: 'glad', next: 'hub' },
      ),
      say(
        'kept',
        'yoram',
        'Quite right. A promise is a promise. Its mother will come round; they usually do.',
        { next: 'hub' },
      ),
    ],
  },
  {
    id: 'd-think',
    start: 't1',
    nodes: [
      say('t1', 'narrator', 'You’ve found enough signs to decide where the lamb went.', {
        choices: [
          opt('now', 'Decide now.', undefined, {
            effects: [{ type: 'openPuzzle', puzzle: 'p-lamb' }],
          }),
          opt('later', 'Keep looking first.'),
        ],
      }),
    ],
  },
  {
    id: 'd-fields-exit',
    entries: [{ when: flag('carrying-lamb'), node: 'carrying' }],
    start: 'x1',
    nodes: [
      say(
        'carrying',
        'narrator',
        'The lamb is still on your shoulders. Take it back to Yonatan at the fold gate first.',
        { kind: 'instruction' },
      ),
      say('x1', 'narrator', 'Behind you, the ewe is still calling for her lamb.', {
        choices: [
          opt('stay', 'Keep looking.'),
          opt('home', 'Go home, and leave the search to Yonatan and Yoram.', 'x2', {
            effects: [lambLeft, setFlag('yoram-searching')],
          }),
        ],
      }),
      say(
        'x2',
        'narrator',
        'You call down to Yonatan that you’re going home. He waves his staff and turns back to the flock.',
        {
          effects: [
            { type: 'adjustCounter', counter: 'hour', delta: 1 },
            { type: 'transition', scene: 'bethlehem-lanes', spawn: 'from-fields' },
          ],
        },
      ),
    ],
  },
];

import {
  all,
  chose,
  flag,
  has,
  not,
  opt,
  say,
  solved,
  type DialogueInput,
} from '../../road-to-jericho/dialogue/helpers';

const bundleDone = {
  type: 'questStatus' as const,
  quest: 'q-bundle',
  status: 'completed' as const,
};

/**
 * The dye works by the bridge. The decision here weighs Kallias's wage,
 * his shame, the rain, the debt and what you packed. Every option is
 * something a thoughtful friend might do; each has a cost that shows later.
 */
export const ROAD_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-kallias',
    characterId: 'kallias',
    entries: [
      { when: chose('choice-kallias'), node: 'after' },
      { when: flag('read-to-kallias'), node: 'again' },
    ],
    start: 'k1',
    nodes: [
      say(
        'k1',
        'narrator',
        'Kallias looks up from the vat. His arms are stained red to the elbow. For a moment he doesn’t move.',
        { next: 'k2' },
      ),
      say('k2', 'kallias', '{player}? From Ammia’s? Is she — has something happened?', {
        expression: 'worried',
        choices: [opt('letter', 'Your letter reached her. She has answered it.', 'k3')],
      }),
      say('k3', 'kallias', 'It reached her? After all that rain? I was sure it would be pulp.', {
        expression: 'surprised',
        effects: [{ type: 'setFlag', flag: 'rain-began', value: true }],
        next: 'k4',
      }),
      say('k4', 'kallias', 'What did she… what did she write?', {
        expression: 'worried',
        branches: [{ when: flag('letter-wet'), next: 'k5-wet' }],
        next: 'k5-dry',
      }),
      say(
        'k5-dry',
        'narrator',
        'You take out Ammia’s letter, dry and flat. Kallias wipes his hands on his tunic, but he doesn’t take it.',
        { next: 'k6' },
      ),
      say(
        'k5-wet',
        'narrator',
        'You take out Ammia’s letter. The rain has blurred half the ink — but you wrote it yourself, and you know every word.',
        { next: 'k6' },
      ),
      say('k6', 'kallias', 'Read it to me? My letters were always worse than my dyeing.', {
        next: 'k7',
      }),
      say(
        'k7',
        'narrator',
        'So you read him Ammia’s answer, all of it: the hard things, the “come home”, and the debt.',
        {
          effects: [{ type: 'setFlag', flag: 'read-to-kallias', value: true }],
          next: 'k8',
        },
      ),
      say(
        'k8',
        'kallias',
        '“Tonight if you are brave, tomorrow if you are not.” That sounds like her.',
        { expression: 'glad', next: 'k9' },
      ),
      say('k9', 'kallias', '“The debt is still a debt.” …I have eight coins. I owe her twenty.', {
        expression: 'sad',
        choices: [
          opt('account', 'Then put some of it on my account. Here — three coins.', 'k-account', {
            requires: has('coins', 3),
            unavailableText: 'You don’t have three coins.',
            effects: [
              { type: 'takeItem', item: 'coins', quantity: 3 },
              { type: 'recordChoice', choice: 'choice-debt', option: 'my-account' },
              { type: 'adjustTrust', character: 'kallias', delta: 2 },
            ],
          }),
          opt('speak', 'I’ll speak for you. I’ll tell her you meant every word.', 'k-speak', {
            effects: [
              { type: 'recordChoice', choice: 'choice-debt', option: 'speak-for-him' },
              { type: 'adjustTrust', character: 'kallias', delta: 1 },
            ],
          }),
          opt('theirs', 'That’s between you and Ammia.', 'k-theirs', {
            effects: [{ type: 'recordChoice', choice: 'choice-debt', option: 'their-business' }],
          }),
        ],
      }),
      say(
        'k-account',
        'kallias',
        'Your savings? {player}, I can’t — …Thank you. That makes eleven. It’s a start.',
        { expression: 'glad', next: 'k10' },
      ),
      say('k-speak', 'kallias', 'You’d do that? Stand up in front of her, for me?', {
        expression: 'surprised',
        next: 'k10',
      }),
      say('k-theirs', 'kallias', 'You’re right. It’s my debt. I’ll carry it.', { next: 'k10' }),
      say(
        'k10',
        'kallias',
        'Nikon pays me at sundown. If I leave now, I lose today’s wage — and I walk into Philemon’s house in front of everyone who knows what I did.',
        {
          expression: 'worried',
          branches: [{ when: not(solved('p-alum')), next: 'k10-alum' }],
          next: 'decide',
        },
      ),
      say(
        'k10-alum',
        'kallias',
        'Unless tomorrow’s alum bath is ready. Then Nikon might let me go and still pay me. I’ve been trying to measure it all morning, but my head is somewhere else.',
        {
          effects: [{ type: 'setFlag', flag: 'alum-task', value: true }],
          next: 'decide',
        },
      ),
      say('again', 'kallias', 'Well?', {
        branches: [{ when: solved('p-alum'), next: 'alum-done' }],
        next: 'decide',
      }),
      say(
        'alum-done',
        'kallias',
        'Nikon says the bath is right — six measures exactly. You didn’t have to do that.',
        { expression: 'glad', next: 'decide' },
      ),
      say('decide', 'narrator', 'Kallias waits to hear what you’ll say.', {
        choices: [
          opt('help', 'Let me help with the alum bath first.', 'help', {
            when: all(flag('alum-task'), not(solved('p-alum'))),
          }),
          opt('bread', 'Share some bread with me first?', 'bread', {
            when: all(has('bread'), not(flag('shared-bread-kallias'))),
          }),
          opt('come', 'Come home with me now. I’ll walk beside you.', 'come', {
            effects: [
              { type: 'recordChoice', choice: 'choice-kallias', option: 'come-now' },
              { type: 'adjustTrust', character: 'kallias', delta: 1 },
            ],
          }),
          opt('write', 'Tell me your answer. I’ll write it down and carry it to her.', 'write', {
            requires: has('tablets'),
            unavailableText: 'You didn’t bring anything to write on.',
            effects: [{ type: 'recordChoice', choice: 'choice-kallias', option: 'carry-reply' }],
          }),
          opt('leave', 'Come when you’re ready. I’ve done what she asked.', 'leave', {
            effects: [{ type: 'recordChoice', choice: 'choice-kallias', option: 'leave-it' }],
          }),
        ],
      }),
      say('help', 'narrator', 'The measuring jars stand by the water channel, next to the vats.'),
      say(
        'bread',
        'narrator',
        'You sit under the eaves of the shed and share the bread and cheese while the rain drums on the roof tiles.',
        {
          effects: [
            { type: 'takeItem', item: 'bread' },
            { type: 'setFlag', flag: 'shared-bread-kallias', value: true },
            { type: 'adjustTrust', character: 'kallias', delta: 1 },
          ],
          next: 'bread2',
        },
      ),
      say('bread2', 'kallias', 'I haven’t eaten since yesterday. Don’t tell Nikon.', {
        next: 'decide',
      }),

      // ── Come home now ─────────────────────────────────────────────────────
      say('come', 'kallias', '…All right. All right. Let me tell Nikon.', {
        expression: 'worried',
        branches: [{ when: solved('p-alum'), next: 'come-paid' }],
        next: 'come-unpaid',
      }),
      say(
        'come-paid',
        'narrator',
        'Nikon looks at the alum bath, nods, and counts Kallias’s day’s wage into his hand.',
        {
          effects: [{ type: 'setFlag', flag: 'kallias-paid', value: true }],
          next: 'come-cloak',
        },
      ),
      say(
        'come-unpaid',
        'narrator',
        'Nikon shrugs: no finished work, no wage. Kallias goes anyway.',
        { next: 'come-cloak' },
      ),
      say('come-cloak', 'narrator', 'The rain is coming down harder.', {
        branches: [{ when: has('spare-cloak'), next: 'cloak-offer' }],
        next: 'walk',
      }),
      say('cloak-offer', 'narrator', 'Kallias’s tunic is already soaked through.', {
        choices: [
          opt('give', 'Here. Ammia kept your old cloak.', 'cloak-given', {
            effects: [
              { type: 'takeItem', item: 'spare-cloak' },
              { type: 'setFlag', flag: 'kallias-cloak', value: true },
              { type: 'adjustTrust', character: 'kallias', delta: 1 },
            ],
          }),
          opt('keep', 'Let’s go before it gets any worse.', 'walk'),
        ],
      }),
      say('cloak-given', 'kallias', 'She kept it? All winter?', {
        expression: 'surprised',
        next: 'walk',
      }),
      say('walk', 'narrator', 'You set off up the road together.', {
        branches: [{ when: bundleDone, next: 'walk-mule' }],
        next: 'walk-foot',
      }),
      say(
        'walk-mule',
        'narrator',
        'At the waystation, Attalos waves you over. “Take the mule to Colossae — leave her at Tatia’s, I’ll fetch her tomorrow.” The mule does not agree, but she goes.',
        {
          effects: [
            { type: 'setFlag', flag: 'rode-mule', value: true },
            { type: 'adjustCounter', counter: 'hour', delta: 2 },
            { type: 'transition', scene: 'colossae-street', spawn: 'from-road' },
          ],
        },
      ),
      say(
        'walk-foot',
        'narrator',
        'It is slow going uphill in the rain, heads down, and neither of you says much.',
        {
          effects: [
            { type: 'adjustCounter', counter: 'hour', delta: 3 },
            { type: 'transition', scene: 'colossae-street', spawn: 'from-road' },
          ],
        },
      ),

      // ── Carry his answer ──────────────────────────────────────────────────
      say('write', 'kallias', 'You’d carry it? Then write this.', { next: 'write2' }),
      say(
        'write2',
        'narrator',
        'You open your tablets and scratch the words into the wax as he says them:',
        { next: 'write3' },
      ),
      say(
        'write3',
        'narrator',
        '“Kallias to Ammia: greetings. The lie was mine and the loss was yours. I will come tomorrow when my work is done, and I will not run away again. I will bring what I have saved, and work for the rest. Farewell.”',
        { next: 'write4' },
      ),
      say(
        'write4',
        'kallias',
        'Now let me put my name at the bottom. In my own hand — such as it is.',
        {
          effects: [
            { type: 'giveItem', item: 'kallias-reply' },
            { type: 'setFlag', flag: 'reply-written', value: true },
          ],
          next: 'write5',
        },
      ),
      say(
        'write5',
        'narrator',
        'He presses the stylus hard into the wax: KALLIAS. The letters lean like tired men.',
      ),

      // ── Leave it to him ───────────────────────────────────────────────────
      say('leave', 'kallias', 'You’re right. It’s my road to walk, not yours.', {
        next: 'leave2',
      }),
      say(
        'leave2',
        'kallias',
        'Tell her — no. Don’t tell her anything. I’ll tell her myself, when I come.',
      ),

      say('after', 'kallias', 'Go on, or you’ll miss the gathering.', {
        branches: [{ when: chose('choice-kallias', 'carry-reply'), next: 'after-write' }],
        next: 'after-leave',
      }),
      say(
        'after-write',
        'kallias',
        'Tomorrow, when the work is done. Tell her I’m coming — no, the tablet tells her. Go!',
      ),
      say('after-leave', 'kallias', 'I’m still thinking. Go on — you’ll miss the gathering.'),
    ],
  },
  {
    id: 'd-nikon',
    characterId: 'nikon',
    entries: [
      { when: solved('p-alum'), node: 'done' },
      { when: flag('alum-task'), node: 'task' },
    ],
    start: 'n1',
    nodes: [
      say(
        'n1',
        'nikon',
        'Looking for Kallias? Good worker, when his head is here. Today it isn’t.',
        {
          choices: [
            opt('work', 'Who does he work for?', 'n2', { once: true }),
            opt('bye', 'Thank you.'),
          ],
        },
      ),
      say(
        'n2',
        'nikon',
        'The master in Laodicea pays him by the day. The master owns the works — the vats, the wool, and Chrysis there. I just keep it all running.',
        { next: 'n1' },
      ),
      say(
        'task',
        'nikon',
        'Tomorrow’s alum bath wants six measures of water in the big jar — exactly six. If it’s set before he goes, he’s earned his day. If not, not.',
      ),
      say('done', 'nikon', 'Six measures, exactly. Somebody in this yard can count.', {
        expression: 'glad',
      }),
    ],
  },
  {
    id: 'd-chrysis',
    characterId: 'chrysis',
    start: 'c1',
    nodes: [
      say(
        'c1',
        'chrysis',
        'You came all the way down from Colossae in this weather? For Kallias?',
        {
          expression: 'surprised',
          choices: [
            opt('you', 'Do you work here too?', 'c2', { once: true }),
            opt('kallias', 'You know Kallias?', 'c-k', { once: true }),
            opt('bread', 'Would you like some bread?', 'c-bread', {
              when: all(has('bread'), not(flag('shared-bread-chrysis'))),
            }),
            opt('bye', 'I should find him.'),
          ],
        },
      ),
      say(
        'c2',
        'chrysis',
        'I belong to the master of these works, in Laodicea. Kallias is hired. I am owned.',
        {
          choices: [
            opt('leave', 'Couldn’t you leave, like Kallias did?', 'c4'),
            opt('sorry', 'I’m sorry.', 'c-sorry'),
          ],
        },
      ),
      say(
        'c4',
        'chrysis',
        'If I walked up that road, they would call me a runaway. There are men who are paid to bring runaways back, and they are not gentle about it.',
        {
          effects: [{ type: 'setFlag', flag: 'talked-chrysis', value: true }],
          next: 'c5',
        },
      ),
      say(
        'c5',
        'chrysis',
        'I save what I can. Some masters let you buy your freedom in the end. Mine says he might. Masters say a lot of things.',
        { expression: 'sad', next: 'c1' },
      ),
      say('c-sorry', 'chrysis', 'Don’t be sorry at me. Just don’t pretend it isn’t so.', {
        effects: [{ type: 'setFlag', flag: 'talked-chrysis', value: true }],
        next: 'c1',
      }),
      say(
        'c-k',
        'chrysis',
        'He talks about Ammia’s workshop every day. He could walk back up that road any day he found the courage.',
        { next: 'c-k2' },
      ),
      say('c-k2', 'chrysis', 'His trouble is shame. Mine is a bill of sale.', {
        expression: 'sad',
        effects: [{ type: 'setFlag', flag: 'talked-chrysis', value: true }],
        next: 'c1',
      }),
      say(
        'c-bread',
        'narrator',
        'You unwrap the bread and cheese and share it. Chrysis eats standing up, one eye on Nikon.',
        {
          effects: [
            { type: 'takeItem', item: 'bread' },
            { type: 'setFlag', flag: 'shared-bread-chrysis', value: true },
          ],
          next: 'c-bread2',
        },
      ),
      say('c-bread2', 'chrysis', 'Thank you.', { expression: 'glad', next: 'c1' }),
    ],
  },
  {
    id: 'd-attalos-road',
    characterId: 'attalos',
    start: 'r1',
    nodes: [
      say('r1', 'attalos', 'Waiting out the rain. The mule and I don’t do wet.', {
        choices: [
          opt('tatia', 'Tatia was glad of her letter.', 'r2', { once: true }),
          opt('bye', 'Stay dry.'),
        ],
      }),
      say(
        'r2',
        'attalos',
        'Good. Most letters in this world get where they’re going on the back of a mule and the word of a stranger.',
        { next: 'r1' },
      ),
    ],
  },
];

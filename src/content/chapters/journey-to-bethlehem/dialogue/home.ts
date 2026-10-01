import {
  all,
  chose,
  flag,
  has,
  not,
  opt,
  paraphrase,
  say,
  setFlag,
  solved,
  type DialogueInput,
} from './helpers';
import { SUPPER_DIALOGUES } from './supper';
import { KID_SEEN_BY_ASA } from './village';

const stranger = (option: string) => chose('choice-stranger', option);
const room = (option: string) => chose('choice-room', option);
/** You kept the last loaf by the oven at supper, for whoever might knock. */
const loafKept = chose('choice-loaf', 'set-aside');
const givenBread = [
  setFlag('zerah-bread'),
  { type: 'adjustTrust' as const, character: 'zerah', delta: 1 },
];
/** Uncle Asa came home before dark (the side quest). */
const asaHomeEarly = solved('p-register');

/**
 * Tamar's house. Everyone here is fictional. When the shepherds' news comes,
 * it arrives as a neighbor's report: her retelling is labelled paraphrase
 * (record rec-para-report), and the people of Luke 2 never appear or speak.
 */
export const HOME_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-opening',
    characterId: 'tamar',
    start: 'n1',
    nodes: [
      say(
        'n1',
        'narrator',
        'Bethlehem, in the afternoon. Your family’s house has never been this full.',
        { next: 'n2' },
      ),
      say(
        'n2',
        'tamar',
        '{player}! Mind the donkey — that one is Uncle Asa’s. Everybody has come home at once.',
        { expression: 'glad', next: 'n3' },
      ),
      say(
        'n3',
        'tamar',
        'The emperor has ordered a registration. They say everyone must be written down in their own family’s town — so half of Judea seems to belong to Bethlehem today.',
        {
          choices: [
            opt('why', 'Why does the emperor want everyone written down?', 'n3b', { once: true }),
            opt('help', 'What can I do?', 'n4'),
          ],
        },
      ),
      say(
        'n3b',
        'tamar',
        'To count us, and everything we own, so they know how much tax to ask for. Your grandfather is helping the clerk in the square. He knows every family in Bethlehem.',
        { next: 'n3' },
      ),
      say(
        'n4',
        'tamar',
        'Uncle Asa, Aunt Peninah and little Dodi are staying with us, and the guest room is small. Help me make room in it before dark.',
        { next: 'n5' },
      ),
      say(
        'n5',
        'tamar',
        'And bread — three measures of flour for the guests, the way my grandmother always did it. Then your cousin Yonatan needs his supper down at the fold.',
        {
          effects: [{ type: 'startQuest', quest: 'q-room' }],
          next: 'n6',
        },
      ),
      say(
        'n6',
        'narrator',
        'How to play: walk with the movement keys or the on-screen pad. When you’re near someone, use Talk/Examine. The “Go to…” list takes you straight to people and places, and the quest log always says what to do next.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-tamar',
    characterId: 'tamar',
    entries: [
      { when: flag('evening'), node: 'night' },
      {
        when: all(solved('p-bread'), solved('p-room'), not(flag('supper-given'))),
        node: 'give',
      },
      { when: all(solved('p-bread'), not(solved('p-room'))), node: 'room' },
      { when: flag('supper-given'), node: 'busy' },
    ],
    start: 'bread',
    nodes: [
      say(
        'bread',
        'tamar',
        'The flour jar and the kneading trough are by the oven. Three measures, remember — the guest measure. And while the bread bakes, set the places for supper.',
        {
          choices: [
            opt('three', 'Why three?', 'three', { once: true }),
            opt('places', 'Who sits where?', 'places', { once: true }),
            opt('ok', 'I’ll do it now.'),
          ],
        },
      ),
      say(
        'three',
        'tamar',
        'Because when Abraham saw three strangers coming, he ran to meet them, gave them water for their feet, and had Sarah bake cakes from three measures of fine flour. My grandmother always said: guests get Abraham’s bread.',
        paraphrase('rec-para-abraham', { next: 'bread' }),
      ),
      say(
        'places',
        'tamar',
        'Everyone has told me where they’d like to sit, and I can’t keep it all in my head. You work it out — you’re good at that.',
        { next: 'bread' },
      ),
      say(
        'room',
        'tamar',
        'The bread smells wonderful. Now the guest room: Asa’s and Peninah’s beds must go in. Mind the water jar and the roof post, and keep the way to the door clear. The rest… we’ll see what fits.',
        {
          expression: 'glad',
          choices: [
            opt('where', 'Where else could things go?', 'where', { once: true }),
            opt('ok', 'I’ll sort it out.'),
          ],
        },
      ),
      say(
        'where',
        'tamar',
        'Down at the animals’ end, if it doesn’t mind the smell. Or up on the roof, if you can find a dry corner up there. Not the barley — the donkeys would eat it.',
        { next: 'room' },
      ),
      say('give', 'tamar', 'Bread baked and the guests settled. You’re a treasure, {player}.', {
        expression: 'glad',
        next: 'give2',
      }),
      say(
        'give2',
        'tamar',
        'Now — Yonatan’s supper, and his thick cloak. The nights are cold on the terraces. And take the little lamp; you’ll be walking back at dusk.',
        {
          effects: [
            { type: 'giveItem', item: 'supper' },
            { type: 'giveItem', item: 'cloak' },
            { type: 'giveItem', item: 'lamp' },
            setFlag('supper-given'),
          ],
          next: 'give-milk',
        },
      ),
      say(
        'give-milk',
        'tamar',
        'Oh — and our goat has given all she has today; Dodi drinks like a calf. Ask Hagit next door for a jar of milk on your way. She’ll have some. She always does.',
        { next: 'give3' },
      ),
      say(
        'give3',
        'tamar',
        'And if you pass the threshing floor, bring back an armful of clean straw. With this many people in the house, I have a feeling we’ll need it.',
        {
          choices: [
            opt('fold', 'Where is the fold?', 'fold', { once: true }),
            opt('go', 'I’m going.'),
          ],
        },
      ),
      say(
        'fold',
        'tamar',
        'Through the square, out of the east gate by the well, and down the terraces. You can’t miss the sheep.',
        { next: 'give3' },
      ),
      say('busy', 'tamar', 'Go on, love — Yonatan will be hungry. And be home by nightfall.'),
      say('night', 'tamar', 'What a day. Sit with me by the fire a moment, {player}.', {
        expression: 'glad',
        branches: [{ when: flag('heard-report'), next: 'night-after' }],
        next: 'fire',
      }),
      say(
        'fire',
        'narrator',
        'The fire has burned down to a red glow. Tamar pulls her shawl round her.',
        {
          choices: [
            opt('tired', 'Are you tired?', 'tired', { once: true }),
            opt('grandmother', 'Tell me about your grandmother.', 'grandmother', { once: true }),
            opt('room', 'Was there really room for everyone today?', 'room-talk', { once: true }),
            opt('bed', 'Good night, Mother.'),
          ],
        },
      ),
      say(
        'tired',
        'tamar',
        'To my bones. But it’s the good kind of tired — the kind you get from a full house, not an empty one. Your father used to say a house with no guests is only a roof.',
        { next: 'fire' },
      ),
      say(
        'grandmother',
        'tamar',
        'She was small and fierce, and she baked for half the lane. Whenever anyone knocked, she said the same thing: “Put more water in the soup.” There was always a bowl for one more.',
        { expression: 'glad', next: 'fire' },
      ),
      say('room-talk', 'tamar', 'Room?', {
        branches: [
          { when: chose('choice-stranger', 'no-room'), next: 'room-none' },
          { when: chose('choice-room', 'made-space'), next: 'room-space' },
        ],
        next: 'room-full',
      }),
      say(
        'room-space',
        'tamar',
        'You left a space in the guest room this afternoon, before anyone knew who would need it. That was well thought of, {player}.',
        { expression: 'glad', next: 'fire' },
      ),
      say(
        'room-none',
        'tamar',
        'Not for everyone, no. I keep thinking of that old man by the well. A house can only hold so much — but it’s hard, isn’t it, saying so at the door.',
        { next: 'fire' },
      ),
      say(
        'room-full',
        'tamar',
        'Just about. The guest room is full to the walls, the donkeys have the loom for company, and your uncle is snoring. That’s what room looks like on a night like this.',
        { expression: 'glad', next: 'fire' },
      ),
      say(
        'night-after',
        'tamar',
        'A baby in a feeding trough, here, tonight. I keep thinking of his mother. Try to sleep, love.',
      ),
    ],
  },
  {
    id: 'd-door-blocked',
    entries: [
      { when: not(solved('p-bread')), node: 'bread' },
      { when: not(solved('p-room')), node: 'room' },
    ],
    start: 'talk',
    nodes: [
      say(
        'bread',
        'narrator',
        'Tamar needs the bread started first. The flour jar and the kneading trough are by the oven.',
        { kind: 'instruction' },
      ),
      say(
        'room',
        'narrator',
        'The guest room isn’t ready yet. Tamar wants it sorted before anyone goes out.',
        { kind: 'instruction' },
      ),
      say(
        'talk',
        'narrator',
        'Tamar has something for you to take to the fold. Talk to her before you go.',
        { kind: 'instruction' },
      ),
    ],
  },
  {
    id: 'd-peninah',
    characterId: 'peninah',
    entries: [
      { when: chose('choice-news', 'told'), node: 'awake' },
      { when: flag('evening'), node: 'night' },
      { when: room('made-space'), node: 'space' },
      { when: room('kept-tools'), node: 'tools' },
      { when: room('kept-loom'), node: 'loom' },
      { when: room('kept-grain'), node: 'grain' },
    ],
    start: 'p1',
    nodes: [
      say(
        'p1',
        'peninah',
        '{player}! Look how tall you’ve grown. Dodi’s finally asleep — we walked all the way from Jerusalem this morning.',
        {
          expression: 'glad',
          choices: [
            opt('why', 'Why did you have to come here to be registered?', 'why', { once: true }),
            opt('things', 'Is there room for everything in here?', 'things', {
              once: true,
              when: not(solved('p-room')),
            }),
            opt('bye', 'I’ll let you rest.'),
          ],
        },
      ),
      say(
        'why',
        'peninah',
        'Asa’s family has always belonged to Bethlehem, even though we live in Jerusalem now. He still owns a share of this very house, you know. So here we are.',
        { next: 'p1' },
      ),
      say(
        'things',
        'peninah',
        'Your mother’s loom, the barley jars, Asa’s tools… Asa won’t let his tools out of his sight. They’re how he earns our bread.',
        { next: 'p1' },
      ),
      say('space', 'peninah', 'It’s so roomy now! We could fit another guest in here.', {
        expression: 'glad',
      }),
      say('tools', 'peninah', 'Asa will sleep better with his tools beside him. Thank you.', {
        expression: 'glad',
      }),
      say('loom', 'peninah', 'Your mother’s loom makes a fine headboard.'),
      say(
        'grain',
        'peninah',
        'We’re sleeping beside the barley jars. Dodi thinks they’re giants.',
        { expression: 'glad' },
      ),
      say('night', 'peninah', 'Shh — Dodi’s asleep. Good night, {player}.'),
      say(
        'awake',
        'peninah',
        'I don’t know what to think. I only know I’ll remember this night as long as I live.',
        { expression: 'surprised' },
      ),
    ],
  },
  {
    id: 'd-dodi',
    characterId: 'dodi',
    start: 'd1',
    nodes: [
      say('d1', 'narrator', 'Little Dodi is fast asleep, one fist curled around a wooden donkey.'),
    ],
  },
  {
    id: 'd-asa-home',
    characterId: 'asa',
    entries: [
      { when: chose('choice-news', 'told'), node: 'awake' },
      { when: all(flag('evening'), not(room('kept-tools'))), node: 'tools' },
      { when: flag('evening'), node: 'night' },
    ],
    start: 'early',
    nodes: [
      say(
        'early',
        'asa',
        'Registered! Kallias wrote me down in no time, thanks to you. Asa son of Amram, a man with a household and a share of a roof. What can I carry?',
        {
          expression: 'glad',
          choices: [
            opt('kid', 'Did you see a little white goat kid while you were in line?', 'kid', {
              once: true,
              when: all(flag('kid-missing'), not(flag('kid-home'))),
            }),
            opt('bye', 'Nothing yet, Uncle.'),
          ],
        },
      ),
      say('kid', 'asa', KID_SEEN_BY_ASA, {
        expression: 'surprised',
        effects: [
          { type: 'discoverClue', clue: 'clue-asa-lamb' },
          { type: 'discoverClue', clue: 'clue-kid-asa' },
        ],
        next: 'early',
      }),
      say(
        'tools',
        'asa',
        'My chisels, down with the donkeys? …Well. At least the donkeys can’t use them. Good night, {player}.',
        { expression: 'sad' },
      ),
      say('night', 'asa', 'Good night, {player}. It’s been a long day of standing still.'),
      say(
        'awake',
        'asa',
        'I came to Bethlehem to be counted. I didn’t expect to go home with news like this.',
        { expression: 'surprised' },
      ),
    ],
  },
  {
    id: 'd-amram-home',
    characterId: 'amram',
    entries: [{ when: flag('heard-report'), node: 'after' }],
    start: 'a1',
    nodes: [
      say(
        'a1',
        'amram',
        'The registration is done, the bread is eaten, and my old bones have earned their rest. Sit with me a moment.',
        {
          expression: 'glad',
          choices: [
            opt('all', 'Did everyone get registered?', 'all', { once: true }),
            opt('bye', 'Good night, Saba.'),
          ],
        },
      ),
      say(
        'all',
        'amram',
        'Every family that ever belonged to Bethlehem, near enough. Kallias’s hand will ache for a week.',
        { next: 'a1' },
      ),
      say('after', 'amram', 'I don’t understand it all. But I won’t forget it.'),
    ],
  },
  {
    id: 'd-evening',
    start: 'e0',
    nodes: [
      say(
        'e0',
        'narrator',
        'By the time you get home, the lamps are lit and the house is warm and loud.',
        {
          effects: [setFlag('evening'), { type: 'setCounter', counter: 'hour', value: 20 }],
          branches: [{ when: chose('choice-lamb', 'found'), next: 'found' }],
          next: 'left',
        },
      ),
      say('found', 'tamar', 'You found Yonatan’s lamb? In the dark? Come here, you.', {
        expression: 'glad',
        next: 'e2',
      }),
      say(
        'left',
        'tamar',
        'Home before dark. Good. Yonatan knows those hills — they’ll find the lamb.',
        { next: 'e2' },
      ),
      say(
        'e2',
        'narrator',
        'Supper is ready. Everyone crowds round the eating mat, in the places you set at midday: Saba Amram nearest the fire, Uncle Asa beside him, Aunt Peninah with Dodi asleep in her lap, and Tamar by the door.',
        { effects: [{ type: 'startDialogue', dialogue: 'd-supper' }] },
      ),
    ],
  },
  ...SUPPER_DIALOGUES,
  {
    id: 'd-zerah',
    characterId: 'zerah',
    entries: [
      { when: stranger('own-place'), node: 'after-own' },
      { when: stranger('guest-room'), node: 'after-guest' },
      { when: stranger('straw-bed'), node: 'after-straw' },
    ],
    start: 'z1',
    nodes: [
      say(
        'z1',
        'zerah',
        'Forgive me for knocking so late. My name is Zerah — I make baskets, in Tekoa. My grandfather was born in Bethlehem, so here I must be registered.',
        { next: 'z2' },
      ),
      say(
        'z2',
        'zerah',
        'My leg is slow, and every door I have tried is full. I don’t need much. A corner out of the wind.',
        { expression: 'worried', branches: [{ when: asaHomeEarly, next: 'z2a' }], next: 'z3' },
      ),
      say(
        'z2a',
        'asa',
        'Come in out of the cold, grandfather. We’ll find you a corner somewhere.',
        { expression: 'glad', next: 'z3' },
      ),
      say(
        'z3',
        'tamar',
        'You decide, {player}. You know better than I do where there’s room tonight.',
        { next: 'z4' },
      ),
      say('z4', 'narrator', 'Where will Zerah sleep?', {
        choices: [
          opt(
            'own',
            'Give him your own place by the fire. (You’ll sleep in the straw with the animals.)',
            'own',
            {
              effects: [
                { type: 'recordChoice', choice: 'choice-stranger', option: 'own-place' },
                { type: 'adjustTrust', character: 'zerah', delta: 2 },
              ],
            },
          ),
          opt('guest', 'There’s a space in the guest room.', 'guest', {
            requires: room('made-space'),
            unavailableText: 'The guest room is full — every space was filled this afternoon.',
            effects: [
              { type: 'recordChoice', choice: 'choice-stranger', option: 'guest-room' },
              { type: 'adjustTrust', character: 'zerah', delta: 2 },
            ],
          }),
          opt(
            'straw',
            'Make him a bed of fresh straw beside the animals. It’s warm down there.',
            'straw',
            {
              requires: has('straw'),
              unavailableText:
                'There’s no clean straw left in the house — you’d need an armful from the threshing floor.',
              effects: [
                { type: 'takeItem', item: 'straw' },
                { type: 'recordChoice', choice: 'choice-stranger', option: 'straw-bed' },
                { type: 'adjustTrust', character: 'zerah', delta: 1 },
              ],
            },
          ),
          opt('hagit', 'Hagit next door has room. I’ll take you there.', 'hagit', {
            requires: flag('hagit-offered'),
            unavailableText: 'You don’t know anyone else with room tonight.',
            effects: [
              { type: 'recordChoice', choice: 'choice-stranger', option: 'hagit' },
              { type: 'adjustTrust', character: 'zerah', delta: 1 },
            ],
          }),
          opt('none', 'I’m sorry. There’s no room left here.', 'none', {
            effects: [{ type: 'recordChoice', choice: 'choice-stranger', option: 'no-room' }],
          }),
        ],
      }),
      say('own', 'zerah', 'Your own bed? …Bless you, child. I won’t forget it.', {
        expression: 'glad',
        next: 'own2',
      }),
      say(
        'own2',
        'narrator',
        'You carry your blanket down to the straw at the animals’ end of the house. The donkey snorts at you.',
        { next: 'end' },
      ),
      say(
        'guest',
        'narrator',
        'You lead Zerah past the sleeping guests to the space by the wall. Aunt Peninah moves over without waking.',
        { next: 'guest2' },
      ),
      say('guest2', 'zerah', 'A roof and a wall and a blanket. Thank you, child.', {
        expression: 'glad',
        next: 'end',
      }),
      say(
        'straw',
        'narrator',
        'You shake out the clean straw beside the animals and spread Tamar’s spare blanket over it.',
        { next: 'straw2' },
      ),
      say('straw2', 'zerah', 'I have slept in far colder places. Their breath will keep me warm.', {
        next: 'end',
      }),
      say('hagit', 'narrator', 'Zerah picks up his stick again.', {
        branches: [{ when: asaHomeEarly, next: 'hagit-asa' }],
        next: 'hagit-you',
      }),
      say(
        'hagit-asa',
        'asa',
        'I’ll walk him over — you go to bed. Come, grandfather, it’s only next door.',
        { next: 'end' },
      ),
      say(
        'hagit-you',
        'narrator',
        'You take Zerah’s arm and walk him slowly next door. Hagit opens before you knock twice. “Come in, come in. I said I’d take one tired soul, and here you are.”',
        {
          effects: [{ type: 'adjustCounter', counter: 'hour', delta: 1 }],
          next: 'end',
        },
      ),
      say(
        'none',
        'zerah',
        'I understand. It has been the same at every door. I’ll find a corner by the well.',
        { expression: 'sad', next: 'none2' },
      ),
      say('none2', 'narrator', 'He lifts his little lamp and goes back out into the lane.', {
        next: 'end',
      }),
      say('end', 'narrator', 'Tamar banks the fire for the night.', {
        branches: [
          { when: all(loafKept, stranger('no-room')), next: 'bread-out' },
          { when: loafKept, next: 'bread' },
        ],
        next: 'sleep',
      }),
      say(
        'bread',
        'narrator',
        'Before anyone lies down, you fetch the loaf you kept by the oven and put it into Zerah’s hands.',
        { effects: givenBread, next: 'bread2' },
      ),
      say(
        'bread-out',
        'narrator',
        'You snatch up the loaf you kept by the oven, run after Zerah and catch him at the corner of the lane.',
        { effects: givenBread, next: 'bread2' },
      ),
      say(
        'bread2',
        'zerah',
        'Bread, at this hour? …Then I have been welcomed in Bethlehem after all. My grandfather always said this town’s bread was the best in Judea.',
        { expression: 'glad', next: 'sleep' },
      ),
      say('sleep', 'narrator', 'When you’re ready, lie down to sleep.', { kind: 'instruction' }),
      say('after-own', 'zerah', 'Go to sleep, child. I’ll keep the fire company.', {
        next: 'talk',
      }),
      say('after-guest', 'zerah', 'Shh. Everyone is asleep. Thank you again.', {
        expression: 'glad',
        next: 'talk',
      }),
      say('after-straw', 'zerah', 'The donkey snores. Did you know that?', {
        expression: 'glad',
        next: 'talk',
      }),
      say('talk', 'narrator', 'Zerah isn’t asleep yet.', {
        choices: [
          opt('tekoa', 'What is it like, where you live?', 'tekoa', { once: true }),
          opt('grandfather', 'Your grandfather was born here?', 'grandfather', { once: true }),
          opt('baskets', 'What kind of baskets do you make?', 'baskets', { once: true }),
          opt('night', 'Good night, Zerah.'),
        ],
      }),
      say(
        'tekoa',
        'zerah',
        'Quiet. A little village on a hill, and dry hills all round it, and sheep. My door looks east. In the mornings I sit in it and weave until the sun gets round to my feet.',
        { next: 'talk' },
      ),
      say(
        'grandfather',
        'zerah',
        'Two lanes from this door, he always said, though he left when he was younger than you. I came to be written down — and to see it. Now I’ve seen it by lamplight, which is the best way to see anything.',
        { expression: 'glad', next: 'talk' },
      ),
      say(
        'baskets',
        'zerah',
        'Big ones for grain, flat ones for bread, and little ones with lids for anything a grandmother wants to hide. You make a basket the way you make a friend: one strand at a time, and you don’t pull too hard.',
        { expression: 'glad', next: 'talk' },
      ),
    ],
  },
  {
    id: 'd-night-news',
    entries: [
      { when: not(chose('choice-stranger')), node: 'early' },
      { when: flag('heard-report'), node: 'after' },
    ],
    start: 'n1',
    nodes: [
      say('early', 'narrator', 'It isn’t time to sleep yet.', { kind: 'instruction' }),
      say(
        'after',
        'narrator',
        'You lie down again, but you can’t stop thinking about what Hagit said.',
      ),
      say(
        'n1',
        'narrator',
        'You lie awake for a long time, listening to everyone breathing in the dark.',
        {
          effects: [setFlag('lay-down'), { type: 'setCounter', counter: 'hour', value: 23 }],
          branches: [{ when: stranger('own-place'), next: 'n1b' }],
          next: 'n2',
        },
      ),
      say(
        'n1b',
        'narrator',
        'The straw prickles. The donkey shifts beside you, and the stone manger is close enough to touch.',
        { next: 'n2' },
      ),
      say(
        'n2',
        'narrator',
        'Late in the night there’s a tapping at the door. It’s Hagit, with her lamp, her shawl pulled tight.',
        { effects: [setFlag('hagit-at-door')], next: 'n3' },
      ),
      say(
        'n3',
        'hagit',
        '{player}! Are you awake? I couldn’t sleep — and now I’m glad I couldn’t.',
        { expression: 'glad', next: 'n4' },
      ),
      say(
        'n4',
        'hagit',
        'Shepherds came up the lane just now, from out in the fields. Not Yonatan and Yoram — others. They were telling everyone who would listen.',
        { next: 'n5' },
      ),
      say(
        'n5',
        'hagit',
        'They said that while they were keeping watch over their flock tonight, an angel of the Lord appeared beside them, and the Lord’s glory blazed all around them. They were terrified.',
        paraphrase('rec-para-report', { next: 'n6' }),
      ),
      say(
        'n6',
        'hagit',
        'They said the angel told them not to be afraid — that he brought good news of great joy for all the people. That today, in David’s town, a Savior has been born, who is Christ the Lord.',
        paraphrase('rec-para-report', { next: 'n7' }),
      ),
      say(
        'n7',
        'hagit',
        'And this would be the sign: a newborn baby wrapped up in cloth, lying in a feeding trough. Then, they said, a great crowd of heaven’s army was there with the angel, praising God.',
        paraphrase('rec-para-report', { next: 'n8' }),
      ),
      say(
        'n8',
        'hagit',
        'So they hurried into Bethlehem — and they found the mother and the father, and the baby lying in a feeding trough, just as they had been told.',
        paraphrase('rec-para-report', { next: 'n9' }),
      ),
      say(
        'n9',
        'hagit',
        'Now they’re on their way back to their flock, praising God for everything they heard and saw.',
        paraphrase('rec-para-report', { next: 'n10' }),
      ),
      say(
        'n10',
        'hagit',
        'I don’t know what to make of it, {player}. I’ve lived in Bethlehem seventy years. I keep turning it over and over.',
        { expression: 'surprised', effects: [setFlag('heard-report')], next: 'hub' },
      ),
      say('hub', 'narrator', 'Hagit waits in the doorway, her lamp flickering.', {
        choices: [
          opt('where', 'Where are they? Can we go and see?', 'where', { once: true }),
          opt('believe', 'Did you believe them?', 'believe', { once: true }),
          opt('tell', 'Wake the others. They should hear this.', 'tell', {
            effects: [
              { type: 'recordChoice', choice: 'choice-news', option: 'told' },
              setFlag('house-awake'),
            ],
          }),
          opt('keep', 'Let them sleep. I’ll think about it.', 'keep', {
            effects: [{ type: 'recordChoice', choice: 'choice-news', option: 'kept' }],
          }),
        ],
      }),
      say(
        'where',
        'hagit',
        'They didn’t say which house, and I didn’t ask. Somewhere with a feeding trough — like ours, like yours. It’s the middle of the night, child. Let that mother and her baby sleep.',
        { next: 'hub' },
      ),
      say(
        'believe',
        'hagit',
        'They weren’t the kind to make up stories. But it’s a great deal to believe. I think I’ll be wondering about it for a long time.',
        { next: 'hub' },
      ),
      say(
        'tell',
        'narrator',
        'You wake the house. Hagit tells it all again. Nobody says much. Everyone sits up in the lamplight, wondering.',
        { next: 'saba' },
      ),
      say(
        'keep',
        'narrator',
        'Hagit squeezes your hand and slips back out into the dark. You lie back and look up at the beams, turning the shepherds’ words over and over.',
        { next: 'saba' },
      ),
      say(
        'saba',
        'amram',
        'David’s town. David kept his father’s sheep on these same hills, you know.',
        paraphrase('rec-para-david', { next: 'saba2' }),
      ),
      say(
        'saba2',
        'amram',
        'I don’t understand it all, {player}. But I won’t forget it. Neither will you.',
        { next: 'luke' },
      ),
      say(
        'luke',
        'narrator',
        'Luke’s Gospel tells this part of the story, beginning with the emperor’s decree. Let’s look at it carefully: what the passage says, what we know about its world, and how Christians have understood it. Each part is labeled.',
        {
          kind: 'instruction',
          effects: [{ type: 'openPanel', panel: 'scripture-connection' }],
        },
      ),
    ],
  },
];

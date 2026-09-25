import { all, any, chose, flag, has, not, opt, say, type DialogueInput } from './helpers';

const traveler = (option: string) => chose('choice-traveler', option);
const helpedHere = any(traveler('tend-walk'), traveler('tend-caravan'));

/**
 * Jericho: consequences play out at the inn; the remedy is delivered; and
 * Yair — a fictional character — introduces the parable Jesus told. Yair's
 * retelling is labelled as a paraphrase; the passage itself is shown in the
 * Scripture Connection with its reference.
 */
export const JERICHO_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-inn-arrival',
    entries: [
      { when: traveler('tend-walk'), node: 'walk' },
      { when: traveler('tend-caravan'), node: 'caravan' },
      { when: traveler('send-help'), node: 'help' },
    ],
    start: 'hurry',
    nodes: [
      say(
        'walk',
        'narrator',
        'At last — palm trees, and a wayside inn with its gate open. Menashe sags against you with relief.',
        { next: 'walk2' },
      ),
      say(
        'walk2',
        'narrator',
        'The innkeeper hurries over. You’ll need to arrange somewhere for Menashe to rest.',
        {
          effects: [{ type: 'startDialogue', dialogue: 'd-salome' }],
        },
      ),
      say(
        'caravan',
        'narrator',
        'Malik’s caravan rattles into the courtyard of a wayside inn. The innkeeper comes out, wiping her hands.',
        {
          effects: [{ type: 'startDialogue', dialogue: 'd-salome' }],
        },
      ),
      say(
        'help',
        'narrator',
        'The road levels out among palm trees. A wayside inn stands beside it. You promised to send help — find the innkeeper.',
      ),
      say(
        'hurry',
        'narrator',
        'The road levels out among palm trees, beside a wayside inn. You made it. Your legs are shaking — from the long walk, or from something else.',
      ),
    ],
  },
  {
    id: 'd-salome',
    characterId: 'salome',
    entries: [
      { when: flag('menashe-care-arranged'), node: 'general' },
      { when: helpedHere, node: 'arrange' },
      { when: all(flag('sent-for-help'), not(flag('asher-sent'))), node: 'send' },
      { when: all(traveler('hurry-on'), not(flag('told-salome'))), node: 'hurry' },
    ],
    start: 'general',
    nodes: [
      say(
        'general',
        'salome',
        'Welcome, traveler. Water for your feet? Rest in the shade as long as you like.',
        {
          choices: [
            opt('far', 'How far is it to Jericho?', 'general2', { once: true }),
            opt('news', 'Any news of the man who was hurt on the road?', 'news', {
              when: all(any(traveler('send-help'), traveler('hurry-on')), flag('asher-sent')),
            }),
            opt('thanks', 'Thank you.'),
          ],
        },
      ),
      say('general2', 'salome', 'Just past the palms. Follow the road east.', { next: 'general' }),
      say(
        'news',
        'salome',
        'Asher went up with the donkey and water. Give him time — it’s a steep road. We’ll look after the man when they come.',
        { next: 'general' },
      ),

      // Arriving together with Menashe
      say(
        'arrange',
        'salome',
        'Oh, the poor man! Robbed on the road? Bring him in, bring him in.',
        { next: 'arrange2' },
      ),
      say(
        'arrange2',
        'salome',
        'I’ll clean him up properly and give him a bed until he can walk. A bed and meals for a few days — two coins.',
        {
          branches: [{ when: traveler('tend-caravan'), next: 'malik-pays' }],
          next: 'pay',
        },
      ),
      say(
        'malik-pays',
        'malik',
        'I’ll pay it. A caravan that won’t stop for a hurt man shouldn’t call itself a caravan.',
        {
          choices: [
            opt('thanks', 'Thank you, Malik.', 'done', {
              effects: [
                { type: 'recordChoice', choice: 'choice-inn', option: 'malik-paid' },
                { type: 'setFlag', flag: 'menashe-care-arranged', value: true },
              ],
            }),
            opt('share', 'Let me pay a share too.', 'done', {
              requires: has('coins', 1),
              unavailableText: 'You have no coins left.',
              effects: [
                { type: 'takeItem', item: 'coins', quantity: 1 },
                { type: 'recordChoice', choice: 'choice-inn', option: 'malik-paid' },
                { type: 'setFlag', flag: 'menashe-care-arranged', value: true },
                { type: 'adjustTrust', character: 'salome', delta: 1 },
              ],
            }),
          ],
        },
      ),
      say('pay', 'salome', 'Well?', {
        choices: [
          opt('coins', 'Here are two coins.', 'done', {
            requires: has('coins', 2),
            unavailableText: 'You have fewer than 2 coins.',
            effects: [
              { type: 'takeItem', item: 'coins', quantity: 2 },
              { type: 'recordChoice', choice: 'choice-inn', option: 'paid' },
              { type: 'setFlag', flag: 'menashe-care-arranged', value: true },
              { type: 'adjustTrust', character: 'salome', delta: 1 },
            ],
          }),
          opt('promise', 'I can’t pay it all now — but I’ll come back and pay.', 'promise', {
            effects: [
              { type: 'recordChoice', choice: 'choice-inn', option: 'promised' },
              { type: 'setFlag', flag: 'menashe-care-arranged', value: true },
            ],
          }),
          opt('work', 'Could I work to pay for his care?', 'work', {
            effects: [
              { type: 'recordChoice', choice: 'choice-inn', option: 'worked' },
              { type: 'setFlag', flag: 'menashe-care-arranged', value: true },
              { type: 'adjustCounter', counter: 'hour', delta: 1 },
              { type: 'adjustTrust', character: 'salome', delta: 1 },
            ],
          }),
        ],
      }),
      say('promise', 'salome', 'Hm. And who are you, to make promises?', {
        choices: [opt('kin', 'I’m family of Miriam the healer, from Jerusalem.', 'promise2')],
      }),
      say(
        'promise2',
        'salome',
        'Miriam’s family? She set my husband’s broken arm years ago. Your promise is good here.',
        {
          effects: [{ type: 'adjustTrust', character: 'salome', delta: 1 }],
          next: 'done',
        },
      ),
      say('work', 'salome', 'Draw water and sweep the courtyard, and we’ll call it fair.', {
        next: 'work2',
      }),
      say(
        'work2',
        'narrator',
        'You draw bucket after bucket and sweep the courtyard while the shadows grow longer.',
        { next: 'done' },
      ),
      say(
        'done',
        'salome',
        'He’ll be looked after. Now — you look like someone with somewhere else to be.',
      ),

      // Came ahead to send help
      say('send', 'salome', 'You look like you ran the whole way. What’s wrong?', {
        choices: [
          opt(
            'tell',
            'A man was robbed below the bend. He’s hurt. Can someone go and help him?',
            'send2',
            {
              effects: [
                { type: 'setFlag', flag: 'asher-sent', value: true },
                { type: 'recordChoice', choice: 'choice-inn', option: 'sent-asher' },
                { type: 'adjustTrust', character: 'salome', delta: 1 },
              ],
            },
          ),
        ],
      }),
      say('send2', 'salome', 'Asher! Take the donkey and a water jar — up the road, quickly!', {
        next: 'send3',
      }),
      say(
        'send3',
        'narrator',
        'Salome’s son grabs a water jar and leads the donkey out onto the road at a run.',
      ),

      // Hurried on
      say(
        'hurry',
        'salome',
        'Welcome, traveler. You look pale. Did something happen on the road?',
        {
          choices: [
            opt('tell', 'A man was lying hurt below the bend. I didn’t stop.', 'hurry2', {
              effects: [
                { type: 'setFlag', flag: 'told-salome', value: true },
                { type: 'setFlag', flag: 'asher-sent', value: true },
                { type: 'recordChoice', choice: 'choice-inn', option: 'sent-asher' },
              ],
            }),
            opt('nothing', 'No. Nothing happened.', 'hurry3', {
              effects: [{ type: 'setFlag', flag: 'told-salome', value: true }],
            }),
          ],
        },
      ),
      say('hurry2', 'salome', 'Then we’ll help him now. Asher! The donkey — quickly!', {
        next: 'hurry2b',
      }),
      say(
        'hurry2b',
        'salome',
        'Being afraid on that road is nothing to be ashamed of. And telling someone was a good next step.',
      ),
      say('hurry3', 'salome', 'Hm. Rest a while, then.'),
    ],
  },
  {
    id: 'd-menashe-inn',
    characterId: 'menashe',
    entries: [{ when: chose('choice-cloak', 'given'), node: 'cloak' }],
    start: 'mi1',
    nodes: [
      say(
        'mi1',
        'menashe',
        'Salome says I’ll walk again in a few days. I’d still be lying up on that road if you hadn’t come.',
        { next: 'mi2' },
      ),
      say(
        'cloak',
        'menashe',
        'Your cloak — I’ll bring it back to you in Jerusalem, I promise. With a flask of my best oil.',
        { next: 'mi2' },
      ),
      say('mi2', 'menashe', 'You’re still here? Don’t you have a remedy to deliver?', {
        choices: [
          opt('ok', 'Will you be all right?', 'mi3', { once: true }),
          opt('rest', 'Rest well, Menashe.'),
        ],
      }),
      say(
        'mi3',
        'menashe',
        'I will. When I’m back on my feet I’ll go home to Samaria and tell my family that a young Judean stopped for me on the Jericho road. They won’t believe it.',
        { next: 'mi2' },
      ),
    ],
  },
  {
    id: 'd-malik-inn',
    characterId: 'malik',
    start: 'm1',
    nodes: [
      say(
        'm1',
        'malik',
        'My donkeys have carried spices, cloth, and once a very rude goat. A robbed Samaritan is an easy load.',
        { next: 'm2' },
      ),
      say(
        'm2',
        'malik',
        'You did a brave thing on that road, little one. Now go — Rivka is waiting.',
      ),
    ],
  },
  {
    id: 'd-night',
    characterId: 'salome',
    start: 'n1',
    nodes: [
      say(
        'n1',
        'salome',
        'It’s too dark to walk the rest of the way without a lamp, dear. The road is full of holes, and the palms hide the stars.',
        {
          choices: [
            opt('rest', 'Could I rest here until morning?', 'n2', {
              effects: [
                { type: 'setFlag', flag: 'stayed-night', value: true },
                { type: 'setCounter', counter: 'hour', value: 6 },
              ],
            }),
          ],
        },
      ),
      say(
        'n2',
        'narrator',
        'You sleep on a mat in the courtyard under the stars. At first light, you set off again.',
      ),
    ],
  },
  {
    id: 'd-rivka',
    characterId: 'rivka',
    entries: [
      { when: flag('remedy-delivered'), node: 'after' },
      { when: flag('stayed-night'), node: 'dawn' },
      { when: { type: 'counter', counter: 'hour', gte: 18 }, node: 'lamp' },
    ],
    start: 'day',
    nodes: [
      say('day', 'rivka', 'Miriam’s {player}? Oh, thank God you’re here. Come in, come in!', {
        effects: [{ type: 'setFlag', flag: 'remedy-on-time', value: true }],
        next: 'deliver',
      }),
      say(
        'lamp',
        'rivka',
        'Who’s there with a lamp at this hour — oh! Miriam’s {player}! You walked in the dark?',
        {
          effects: [{ type: 'setFlag', flag: 'remedy-lamplight', value: true }],
          next: 'deliver',
        },
      ),
      say('dawn', 'rivka', 'Miriam’s {player}! At first light! I was starting to worry.', {
        effects: [{ type: 'setFlag', flag: 'remedy-morning', value: true }],
        next: 'deliver',
      }),
      say('deliver', 'narrator', 'You hand Rivka the jar and Aunt Miriam’s letter.', {
        effects: [
          { type: 'takeItem', item: 'remedy' },
          { type: 'takeItem', item: 'letter' },
          { type: 'setFlag', flag: 'remedy-delivered', value: true },
        ],
        branches: [{ when: flag('remedy-morning'), next: 'natan-dawn' }],
        next: 'natan-day',
      }),
      say(
        'natan-day',
        'rivka',
        'Natan’s fever is still hanging on. I’ll prepare this for him right away. Miriam thinks of everything.',
        { next: 'road' },
      ),
      say(
        'natan-dawn',
        'rivka',
        'Natan slept badly, poor thing, but he’s no worse. I’ll prepare this for him right away.',
        { next: 'road' },
      ),
      say(
        'road',
        'rivka',
        'You look like you walked through more than dust. Sit. Tell me about the road.',
        {
          choices: [
            opt('man', 'I found a man who’d been robbed below the bend.', 'told'),
            opt('long', 'It was long. And hot.', 'long'),
          ],
        },
      ),
      say('told', 'narrator', 'Rivka listens closely as you tell her what happened.', {
        branches: [
          { when: helpedHere, next: 'told-helped' },
          { when: traveler('send-help'), next: 'told-sent' },
        ],
        next: 'told-hurried',
      }),
      say(
        'told-helped',
        'rivka',
        'And you stopped for him? On that road? Miriam raised you well.',
        { next: 'yair' },
      ),
      say('told-sent', 'rivka', 'And you found a way to get help to him. Good.', { next: 'yair' }),
      say(
        'told-hurried',
        'rivka',
        'Oh, child. That road frightens grown men. I’m glad you’re safe.',
        { next: 'yair' },
      ),
      say('long', 'rivka', 'It always is. Downhill all day — your knees will complain tomorrow.', {
        next: 'yair',
      }),
      say(
        'yair',
        'rivka',
        'My brother Yair is here. He’s been telling a story all week — about that very road. Yair! Come tell {player} what you heard.',
        {
          effects: [{ type: 'startDialogue', dialogue: 'd-yair' }],
        },
      ),
      say(
        'after',
        'rivka',
        'Natan is already asking for bread. That’s a good sign. Rest here as long as you like.',
      ),
    ],
  },
  {
    id: 'd-yair',
    characterId: 'yair',
    entries: [
      { when: flag('heard-yair'), node: 'again' },
      { when: not(flag('remedy-delivered')), node: 'wait' },
    ],
    start: 'y1',
    nodes: [
      say(
        'wait',
        'yair',
        'You must be Miriam’s {player}! Go on in to Rivka first — she’s been watching the road all day.',
      ),
      say(
        'y1',
        'yair',
        'So you walked the Jericho road today! Then you’ll understand this better than most.',
        { next: 'y2' },
      ),
      say(
        'y2',
        'yair',
        'Some time ago I was in a crowd listening to a teacher — Jesus of Nazareth. An expert in the Law asked him what he must do to inherit eternal life.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-yair',
          next: 'y3',
        },
      ),
      say(
        'y3',
        'yair',
        'They agreed on the heart of the Law: love God with everything you are, and love your neighbor as yourself. Then the expert asked who his neighbor was.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-yair',
          next: 'y4',
        },
      ),
      say(
        'y4',
        'yair',
        'So the teacher told a story about a man going down this very road, from Jerusalem to Jericho. Robbers attacked him and left him half dead.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-yair',
          next: 'y5',
        },
      ),
      say(
        'y5',
        'yair',
        'A priest came by, and passed by on the other side. Then a Levite, and he passed by too. Then a Samaritan came along — and he stopped.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-yair',
          choices: [opt('samaritan', 'A Samaritan?', 'y6'), opt('what', 'What did he do?', 'y7')],
        },
      ),
      say(
        'y6',
        'yair',
        'That’s what everyone around me whispered! Nobody expected the Samaritan to be the one who stopped.',
        { next: 'y7' },
      ),
      say(
        'y7',
        'yair',
        'He bandaged the man’s wounds, pouring on oil and wine. He put him on his own animal, brought him to an inn, and paid the innkeeper to look after him.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-yair',
          next: 'y8',
        },
      ),
      say(
        'y8',
        'yair',
        'Then the teacher asked the expert which of the three had been a neighbor to the man.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-yair',
          next: 'y9',
        },
      ),
      say(
        'y9',
        'yair',
        'I won’t try to tell you the rest word for word. It’s better to read it for yourself.',
        {
          effects: [{ type: 'setFlag', flag: 'heard-yair', value: true }],
          next: 'y10',
        },
      ),
      say(
        'y10',
        'narrator',
        'This story is written in the Gospel of Luke, chapter 10. Let’s look at it carefully: what the passage says, what we know about its world, and how Christians have understood it. Each part is labeled.',
        {
          kind: 'instruction',
          effects: [{ type: 'openPanel', panel: 'scripture-connection' }],
        },
      ),
      say(
        'again',
        'yair',
        'I keep wondering which of the three I would have been, on a day when I was tired and scared. Have you thought about it?',
      ),
    ],
  },
  {
    id: 'd-natan',
    characterId: 'natan',
    entries: [{ when: flag('remedy-delivered'), node: 'after' }],
    start: 'before',
    nodes: [
      say(
        'before',
        'natan',
        'Are you from Jerusalem? Did you see robbers? Uncle Yair says the road is full of them!',
        {
          choices: [opt('ok', 'The road is dangerous — but I made it.')],
        },
      ),
      say('after', 'natan', 'Mama says the medicine tastes terrible. That means it works, right?'),
    ],
  },
];

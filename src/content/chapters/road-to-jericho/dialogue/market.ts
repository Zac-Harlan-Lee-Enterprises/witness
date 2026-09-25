import { all, chose, flag, has, not, opt, say, solved, type DialogueInput } from './helpers';

const coins = (n: number) => has('coins', n);
const sideQuestActive = {
  type: 'questStatus' as const,
  quest: 'q-honest-measure',
  status: 'active' as const,
};

export const MARKET_DIALOGUES: DialogueInput[] = [
  // ── Malik: a practical trader with good (and paid) advice ──────────────
  {
    id: 'd-malik',
    characterId: 'malik',
    entries: [{ when: chose('choice-malik', 'asked'), node: 'again' }],
    start: 'hello',
    nodes: [
      say(
        'hello',
        'malik',
        'Peace to you, young traveler! Malik — trader in spices, cloth and useful advice. Are you buying, or asking?',
        {
          choices: [
            opt('road', 'I’m walking to Jericho today. What’s the road like?', 'road1', {
              once: true,
            }),
            opt('sell', 'What are you selling?', 'sell', { when: not(has('map')) }),
            opt('caravan', 'When does your caravan leave?', 'caravan', { once: true }),
            opt('bye', 'Goodbye.'),
          ],
        },
      ),
      say(
        'road1',
        'malik',
        'Down, down, down, and hot. Whatever you do, stay out of the dry wadi. It looks like a shortcut, but it ends at a dry waterfall — a sheer drop. I’ve seen travelers climb all the way back up, grumbling the whole time.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-wadi-dead-end' }],
          next: 'hello',
        },
      ),
      say(
        'caravan',
        'malik',
        'At midday, once the last bales are loaded. We take the main road. A caravan is too big a bite for robbers.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-caravan' }],
          choices: [
            opt(
              'watch',
              'Could your people watch for me on the road, in case I need help?',
              'watch',
            ),
            opt('safe', 'Safe travels, then.', 'hello'),
          ],
        },
      ),
      say(
        'watch',
        'malik',
        'Ha! A careful one. Very well — my people will keep their eyes open for a young traveler with a satchel. Out there, travelers must look after each other.',
        {
          effects: [
            { type: 'recordChoice', choice: 'choice-malik', option: 'asked' },
            { type: 'setFlag', flag: 'malik-watching', value: true },
            { type: 'adjustTrust', character: 'malik', delta: 1 },
          ],
          next: 'hello',
        },
      ),
      say(
        'sell',
        'malik',
        'For you? A map, scratched by my own hand. It shows the shepherds’ ridge path — and where the wadi drops away. Two coins.',
        {
          choices: [
            opt('buy', 'I’ll buy the map.', 'sold', {
              requires: coins(2),
              unavailableText: 'You need 2 coins.',
              effects: [
                { type: 'takeItem', item: 'coins', quantity: 2 },
                { type: 'giveItem', item: 'map' },
                { type: 'discoverClue', clue: 'clue-map' },
                { type: 'adjustTrust', character: 'malik', delta: 1 },
                { type: 'setFlag', flag: 'bought-something', value: true },
              ],
            }),
            opt('no', 'Not today.', 'hello'),
          ],
        },
      ),
      say('sold', 'malik', 'Wise. A good map costs less than a wrong turn.', { next: 'hello' }),
      say(
        'again',
        'malik',
        'Still here? My caravan leaves at midday. We’ll watch for you on the road.',
        { next: 'hello' },
      ),
    ],
  },

  // ── Old Shimon: slow, observant, generous with what he knows ───────────
  {
    id: 'd-shimon',
    characterId: 'shimon',
    start: 's1',
    nodes: [
      say('s1', 'shimon', 'Hm. You have the look of someone about to walk somewhere far.', {
        choices: [
          opt('advice', 'I’m going down to Jericho. Any advice?', 's2', { once: true }),
          opt('water', 'Is there any water on the way?', 's4', { once: true }),
          opt('bye', 'Goodbye, Shimon.'),
        ],
      }),
      say(
        's2',
        'shimon',
        'The main road is quicker. But below the red rocks it narrows into a bend, and men sometimes wait in the caves above it.',
        { next: 's3' },
      ),
      say(
        's3',
        'shimon',
        'They watch when the road is empty. When there’s a crowd, they stay hidden. Robbers prefer easy work.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-bend-watchers' }],
          next: 's1',
        },
      ),
      say(
        's4',
        'shimon',
        'Not on the main road. But we shepherds use a path along the ridge. There’s a cistern halfway. Look for cairns — three stones stacked. That’s our mark.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-cistern' }],
          choices: [
            opt('weight', 'That could save a lot of weight in my satchel.', 's6'),
            opt('why', 'Why are you telling me your path?', 's7'),
          ],
        },
      ),
      say('s6', 'shimon', 'Water is heavy. Knowing where to find it weighs nothing.', {
        next: 's1',
      }),
      say(
        's7',
        'shimon',
        'It’s no secret. Anyone who asks can know it. Most people just don’t ask.',
        {
          effects: [{ type: 'adjustTrust', character: 'shimon', delta: 1 }],
          next: 's1',
        },
      ),
    ],
  },

  // ── Tobiah: confident, and not quite reliable ──────────────────────────
  {
    id: 'd-tobiah',
    characterId: 'tobiah',
    start: 't1',
    nodes: [
      say(
        't1',
        'tobiah',
        'Jericho? Easy! Take the wadi. It’s the fastest way down — everyone knows that.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-wadi-fastest' }],
          choices: [
            opt('walked', 'Have you walked the wadi yourself?', 't2', { once: true }),
            opt('thanks', 'Thanks for the tip.'),
          ],
        },
      ),
      say(
        't2',
        'tobiah',
        'Me? Well… no. I drive my cart. Carts stay on the main road, obviously. But I’ve HEARD it’s fastest!',
        {
          effects: [{ type: 'setFlag', flag: 'tobiah-admitted', value: true }],
          next: 't3',
        },
      ),
      say('t3', 'narrator', 'Tobiah sounds very sure — but he has never actually walked the wadi.'),
    ],
  },

  // ── Hadassah: sells linen; repeats a prejudice she's never examined ────
  {
    id: 'd-hadassah',
    characterId: 'hadassah',
    start: 'h1',
    nodes: [
      say('h1', 'hadassah', 'Linen! Fine linen, clean and strong! Oh — hello, dear. Buying?', {
        choices: [
          opt('use', 'What could I use linen for on a journey?', 'h2', { once: true }),
          opt('buy', 'I’ll buy some linen strips.', 'h3', {
            when: all(not(has('linen')), not(flag('bought-linen'))),
            requires: coins(1),
            unavailableText: 'You need 1 coin.',
            effects: [
              { type: 'takeItem', item: 'coins', quantity: 1 },
              { type: 'giveItem', item: 'linen' },
              { type: 'setFlag', flag: 'bought-linen', value: true },
              { type: 'setFlag', flag: 'bought-something', value: true },
            ],
          }),
          opt('argument', 'What’s that argument by the bakery?', 'h4', {
            once: true,
            when: not(flag('dispute-settled')),
          }),
          opt('bye', 'Goodbye.'),
        ],
      }),
      say(
        'h2',
        'hadassah',
        'Wrapping bread. Tying a bundle. Binding a scraped knee — clean linen is good for that. One coin for a bundle of strips.',
        { next: 'h1' },
      ),
      say(
        'h3',
        'hadassah',
        'There you are. May you never need them for anything worse than bread.',
        { next: 'h1' },
      ),
      say(
        'h4',
        'hadassah',
        'Ezer the baker and that Samaritan oil-seller. I’d keep my distance if I were you. You know what they say about Samaritans — can’t trust them.',
        {
          choices: [
            opt('talked', 'Have you ever actually talked with him?', 'h6', {
              effects: [{ type: 'recordChoice', choice: 'choice-prejudice', option: 'challenged' }],
            }),
            opt('sides', 'Maybe it’s better to hear both sides first.', 'h6', {
              effects: [{ type: 'recordChoice', choice: 'choice-prejudice', option: 'challenged' }],
            }),
            opt('quiet', 'Say nothing.', 'h7', {
              effects: [{ type: 'recordChoice', choice: 'choice-prejudice', option: 'listened' }],
            }),
          ],
        },
      ),
      say(
        'h6',
        'hadassah',
        '…Well. No, I suppose I haven’t. My mother always said it, so I always said it. Hm.',
        {
          effects: [{ type: 'adjustTrust', character: 'hadassah', delta: 1 }],
          next: 'h1',
        },
      ),
      say('h7', 'hadassah', 'Anyway! Linen?', { next: 'h1' }),
    ],
  },

  // ── Ezer: the side quest (An Honest Measure) ───────────────────────────
  {
    id: 'd-ezer',
    characterId: 'ezer',
    entries: [
      { when: flag('dispute-settled'), node: 'after' },
      { when: solved('p-measure'), node: 'reveal' },
      { when: all(sideQuestActive, flag('heard-ezer')), node: 'waiting' },
    ],
    start: 'e1',
    nodes: [
      say(
        'e1',
        'ezer',
        'Cheated! I paid for four measures of oil, and that jar didn’t hold four. I measured it myself!',
        {
          effects: [
            { type: 'startQuest', quest: 'q-honest-measure' },
            { type: 'setFlag', flag: 'heard-ezer', value: true },
          ],
          next: 'e2',
        },
      ),
      say('e2', 'ezer', 'Well? Are you going to stand there, or say something?', {
        choices: [
          opt('how', 'How did you measure it?', 'e3', { once: true }),
          opt('mistake', 'Could it have been a mistake?', 'e4', { once: true }),
          opt('help', 'Let me help work out the truth.', 'e5'),
          opt('leave', 'I’d better go.'),
        ],
      }),
      say(
        'e3',
        'ezer',
        'I poured it into my big crock. It holds five measures. The oil didn’t come near the top!',
        { next: 'e3b' },
      ),
      say(
        'e3b',
        'narrator',
        'Four measures in a five-measure crock wouldn’t reach the top anyway. Ezer’s test doesn’t prove what he thinks it proves.',
        {
          effects: [{ type: 'setFlag', flag: 'noticed-flaw', value: true }],
          next: 'e2',
        },
      ),
      say(
        'e4',
        'ezer',
        'A mistake? Hmph. Maybe. But he’s a Samaritan. How would I know he’s honest?',
        { next: 'e2' },
      ),
      say(
        'e5',
        'ezer',
        'You? Fine. My crock holds five, my pitcher holds three. They’re right there by my stall. Show me exactly four measures — if you can.',
        {
          choices: [
            opt('ok', 'I’ll try — after I hear what Menashe says too.'),
            opt('ok2', 'Leave it to me.'),
          ],
        },
      ),
      say(
        'waiting',
        'ezer',
        'Well? My crock and pitcher are by the stall. Show me four measures and we’ll see.',
      ),
      say(
        'reveal',
        'ezer',
        'You marked four measures exactly? Then let’s pour his oil in and see.',
        { next: 'reveal2' },
      ),
      say(
        'reveal2',
        'narrator',
        'Everyone leans in. The oil rises… and stops right at your mark. Four measures, exactly.',
        { next: 'reveal3' },
      ),
      say('reveal3', 'ezer', '…It’s a full measure. I was wrong.', {
        choices: [
          opt('tell', 'Maybe you could tell him that yourself.', 'reveal4'),
          opt('mistakes', 'Everyone makes mistakes.', 'reveal4'),
        ],
      }),
      say(
        'reveal4',
        'narrator',
        'Ezer walks over to Menashe, pays what he owes — and after a long pause, holds out his hand. Menashe shakes it.',
        {
          effects: [{ type: 'setFlag', flag: 'dispute-settled', value: true }],
          next: 'reveal5',
        },
      ),
      say(
        'reveal5',
        'menashe',
        'Thank you, friend. Here — a small flask of my oil for your journey. The road is long.',
        {
          effects: [{ type: 'giveItem', item: 'oil' }],
        },
      ),
      say(
        'after',
        'ezer',
        'Next time I’ll measure before I shout. Tell Menashe his oil is welcome at my bakery.',
      ),
    ],
  },

  // ── Menashe in the market ──────────────────────────────────────────────
  {
    id: 'd-menashe',
    characterId: 'menashe',
    entries: [
      { when: flag('dispute-settled'), node: 'thanks' },
      { when: flag('heard-menashe'), node: 'waiting' },
    ],
    start: 'm1',
    nodes: [
      say(
        'm1',
        'menashe',
        'Please — I’m not trying to cheat anyone. Four measures, fair and full. I filled that jar myself.',
        {
          effects: [
            { type: 'setFlag', flag: 'heard-menashe', value: true },
            { type: 'startQuest', quest: 'q-honest-measure' },
          ],
          next: 'm2',
        },
      ),
      say('m2', 'menashe', 'Is there something I can do for you?', {
        choices: [
          opt('from', 'Where are you from?', 'm3', { once: true }),
          opt('oil', 'Do you sell oil for travelers?', 'm4', { when: not(has('oil')) }),
          opt('prove', 'I think we can prove your jar was full.', 'm5', {
            when: all(sideQuestActive, not(solved('p-measure'))),
          }),
          opt('bye', 'Goodbye.'),
        ],
      }),
      say(
        'm3',
        'menashe',
        'From near Shechem, in Samaria. I bring oil south to Jerusalem, then on down to Jericho. Not everyone here is glad to see a Samaritan.',
        { next: 'm2' },
      ),
      say(
        'm4',
        'menashe',
        'A small flask, two coins. Oil is good on the road — for bread, for a lamp, even for a scrape.',
        {
          choices: [
            opt('buy', 'I’ll buy one.', 'm4b', {
              requires: coins(2),
              unavailableText: 'You need 2 coins.',
              effects: [
                { type: 'takeItem', item: 'coins', quantity: 2 },
                { type: 'giveItem', item: 'oil' },
                { type: 'adjustTrust', character: 'menashe', delta: 1 },
                { type: 'setFlag', flag: 'bought-something', value: true },
              ],
            }),
            opt('not', 'Not right now.', 'm2'),
          ],
        },
      ),
      say('m4b', 'menashe', 'Thank you. You’re the first customer who’s smiled at me today.', {
        next: 'm2',
      }),
      say('m5', 'menashe', 'Prove it? How? Ezer won’t believe anything I say.', { next: 'm6' }),
      say(
        'm6',
        'narrator',
        'Ezer’s measuring vessels — a crock and a pitcher — sit by his stall. Maybe there’s a way to measure fairly, so nobody has to take anyone’s word for it.',
        { kind: 'instruction' },
      ),
      say(
        'waiting',
        'menashe',
        'Any luck with Ezer? I’d rather settle this than lose a customer — and my good name.',
        { next: 'm2' },
      ),
      say(
        'thanks',
        'menashe',
        'Thanks to you, Ezer shook my hand. I won’t forget that. Go safely on the road, friend.',
      ),
    ],
  },

  // ── Hanan: a kind young Levite ─────────────────────────────────────────
  {
    id: 'd-hanan',
    characterId: 'hanan',
    start: 'l1',
    nodes: [
      say('l1', 'hanan', 'Peace to you. You look like someone with a long day ahead.', {
        choices: [
          opt('jericho', 'I’m walking down to Jericho.', 'l2', { once: true }),
          opt('temple', 'What do you do at the Temple?', 'l3', { once: true }),
          opt('law', 'Can I ask you a question about the Law?', 'l4', { once: true }),
          opt('bye', 'Goodbye.'),
        ],
      }),
      say(
        'l2',
        'hanan',
        'Jericho! Plenty of people who serve at the Temple travel that road. Go carefully — and not alone, if you can help it.',
        { next: 'l1' },
      ),
      say(
        'l3',
        'hanan',
        'I’m a Levite. We help the priests with the work of the Temple. My family has served there for generations.',
        { next: 'l1' },
      ),
      say('l4', 'hanan', 'Of course — though I’m still a student of it myself.', {
        choices: [
          opt('greatest', 'What’s the most important command?', 'l6'),
          opt('neighbor', 'Who counts as my neighbor?', 'l7'),
        ],
      }),
      say(
        'l6',
        'hanan',
        'Many would say: love God with all your heart and soul and strength — and love your neighbor as yourself.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-love-commands',
          effects: [{ type: 'setFlag', flag: 'heard-hanan-law', value: true }],
          next: 'l8',
        },
      ),
      say(
        'l7',
        'hanan',
        'The Law teaches us to love our neighbor as ourselves — and a little further on, to love the foreigner who lives among us as ourselves too. So where does “neighbor” stop? I’m still thinking about that.',
        {
          kind: 'paraphrase',
          recordId: 'rec-para-love-commands',
          effects: [{ type: 'setFlag', flag: 'heard-hanan-law', value: true }],
          next: 'l8',
        },
      ),
      say(
        'l8',
        'hanan',
        'Go safely, friend. If you find an answer on the road, come back and tell me.',
        { next: 'l1' },
      ),
    ],
  },

  // ── The east gate, when you're not ready yet ───────────────────────────
  {
    id: 'd-gate-blocked',
    entries: [
      {
        when: not({ type: 'objectiveDone', quest: 'q-remedy', objective: 'ask-road' }),
        node: 'ask',
      },
    ],
    start: 'pack',
    nodes: [
      say(
        'ask',
        'narrator',
        'The road beyond the gate runs down into the wilderness. Aunt Miriam asked you to learn about it first — talk to travelers in the market.',
        { kind: 'instruction' },
      ),
      say(
        'pack',
        'narrator',
        'Your satchel isn’t packed yet. It’s waiting by the table at Aunt Miriam’s house.',
        { kind: 'instruction' },
      ),
    ],
  },
];

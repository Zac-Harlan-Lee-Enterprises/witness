import type { Condition } from '@/domain/conditions';
import {
  all,
  chose,
  flag,
  HEAVY,
  not,
  opt,
  say,
  solved,
  talked,
  type DialogueInput,
} from './helpers';

const RETURNED = flag('returned');
const brine = (status: 'inactive' | 'active' | 'completed'): Condition => ({
  type: 'questStatus',
  quest: 'q-brine',
  status,
});
const storm = (option: string): Condition => chose('choice-storm', option);

/**
 * The fishing quarter: getting ready (Act 2), loading (Act 3), the evening
 * the boats put out (Mark 4:35–36, as a labelled paraphrase), and each
 * character's words when you come home in the night (Act 5).
 */
export const SHORE_DIALOGUES: DialogueInput[] = [
  // ── Old Hanina: the most reliable reader of the sky ────────────────────
  {
    id: 'd-hanina',
    characterId: 'hanina',
    entries: [
      { when: solved('p-sky'), node: 'after' },
      { when: { type: 'clueFound', clue: 'clue-hanina-east' }, node: 'h1' },
    ],
    start: 'h0',
    nodes: [
      say(
        'h0',
        'hanina',
        'Shelomit’s youngster. Sit, sit. Everyone is looking at the crowd today. Nobody is looking up.',
        { next: 'h1' },
      ),
      say('h1', 'hanina', 'Well? What have you come to ask me?', {
        choices: [
          opt('sky', 'Grandmother says to ask you what the sky is saying.', 'h2', { once: true }),
          opt('water', 'Grandmother gave me a skin of water for the crossing.', 'w1', {
            once: true,
          }),
          opt('think', 'Let me work out what I think.', undefined, {
            when: { type: 'clueFound', clue: 'clue-hanina-east' },
            effects: [{ type: 'openPuzzle', puzzle: 'p-sky' }],
          }),
          opt('bye', 'I’ll look around first.'),
        ],
      }),
      say(
        'h2',
        'hanina',
        'What it’s saying? It’s saying: look for yourself. This afternoon wind from the west — that’s only the lake’s everyday temper.',
        { next: 'h3' },
      ),
      say(
        'h3',
        'hanina',
        'The winds to fear come down off the heights on the far side, to the east. They come with little warning — and they can come at night.',
        { effects: [{ type: 'discoverClue', clue: 'clue-hanina-east' }], next: 'h4' },
      ),
      say(
        'h4',
        'hanina',
        'So look west, and look east, and watch what the fishers coming in are doing. Then come and tell me what you think.',
        { next: 'h1' },
      ),
      say(
        'w1',
        'hanina',
        'Water? To cross a lake of sweet water? Dip your hand over the side, child. Carry something more useful.',
        { effects: [{ type: 'setFlag', flag: 'heard-sweet-water', value: true }], next: 'h1' },
      ),
      say(
        'after',
        'hanina',
        'Go ready, and keep close to the other boats. When the wind comes off those hills, it doesn’t knock first.',
      ),
    ],
  },

  // ── Nikanor: cheerful, sure of himself, not a sailor ────────────────────
  {
    id: 'd-nikanor',
    characterId: 'nikanor',
    entries: [
      { when: RETURNED, node: 'night' },
      { when: all(solved('p-brine'), brine('active')), node: 'tell' },
      { when: brine('completed'), node: 'thanks' },
      { when: { type: 'questStage', quest: 'q-brine', stage: 'measure' }, node: 'measuring' },
      { when: flag('got-jars'), node: 'n2' },
    ],
    start: 'n1',
    nodes: [
      say(
        'n1',
        'nikanor',
        'Ah — Elazar’s new crew! Nikanor, from Magdala. The best salted fish on the lake. Here: six jars, sealed and roped, for the far shore by morning.',
        {
          effects: [
            { type: 'giveItem', item: 'fish-jar', quantity: 6 },
            { type: 'setFlag', flag: 'got-jars', value: true },
          ],
          next: 'n2',
        },
      ),
      say('n2', 'nikanor', 'Mind them. That’s a month of salting in there.', {
        choices: [
          opt('weather', 'Hanina thinks a wind could get up tonight.', 'n3', { once: true }),
          opt('salt', 'Why is Magdala famous for salted fish?', 'n5', { once: true }),
          opt('help', 'You look busy. Can I help?', 'b1', { once: true, when: brine('inactive') }),
          opt('bye', 'I’ll take them down to the boat.'),
        ],
      }),
      say(
        'n3',
        'nikanor',
        'Wind? Nonsense. The lake is never rough at night at this time of year. Take all six, and don’t let Elazar tell you otherwise.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-nikanor-calm' }],
          choices: [
            opt('often', 'How often do you cross the lake at night?', 'n4'),
            opt('ok', 'If you say so.', 'n2'),
          ],
        },
      ),
      say(
        'n4',
        'nikanor',
        'Me? …Hardly ever. I salt fish; I don’t catch them. But I’ve never heard of a storm in the dark.',
        { effects: [{ type: 'setFlag', flag: 'nikanor-admitted', value: true }], next: 'n2' },
      ),
      say(
        'n5',
        'nikanor',
        'The boats bring the catch to us by the basketful. We salt it and pack it in jars so it keeps for months and can travel far. Some even call our town Taricheae, after the salted fish.',
        { effects: [{ type: 'setFlag', flag: 'asked-salt', value: true }], next: 'n2' },
      ),
      say(
        'b1',
        'nikanor',
        'Help? Bless you. My apprentice ran off to hear the teacher, and the brine tub needs exactly seven measures of lake water for this basket of salt.',
        { next: 'b2' },
      ),
      say(
        'b2',
        'nikanor',
        'My big jar holds eight and the small one five, and neither has any marks. Seven in the big jar, exactly. Can you do it?',
        {
          choices: [
            opt('yes', 'I’ll try.', 'b3', {
              effects: [{ type: 'startQuest', quest: 'q-brine' }],
            }),
            opt('no', 'Not now — the boat is waiting.', 'n2'),
          ],
        },
      ),
      say(
        'b3',
        'nikanor',
        'The jars are by the tubs. Take your time — Hanina says you’re a thinker.',
      ),
      say('measuring', 'nikanor', 'The jars are by the tubs. Seven in the big jar, exactly.'),
      say(
        'tell',
        'nikanor',
        'Seven measures, exactly? Let me see… yes! Good. In goes the salt, and tomorrow’s catch goes in the brine.',
        { effects: [{ type: 'setFlag', flag: 'brine-done', value: true }], next: 't2' },
      ),
      say(
        't2',
        'nikanor',
        'You’ve saved me a whole morning. Listen: take only as many jars tonight as the boat can carry safely. Even two will do — the rest can go with the Magdala boats tomorrow.',
      ),
      say(
        'thanks',
        'nikanor',
        'The brine is ready. Remember — only as many jars as the boat can carry safely.',
      ),
      say(
        'night',
        'nikanor',
        'You’re back! I heard the wind from my bed and couldn’t sleep a wink.',
        {
          branches: [
            { when: flag('jettisoned'), next: 'night-lost' },
            { when: flag('left-jars'), next: 'night-left' },
          ],
          next: 'night-safe',
        },
      ),
      say('night-lost', 'nikanor', 'Overboard? Three of my jars?', { next: 'night-lost2' }),
      say(
        'night-lost2',
        'nikanor',
        '…Well. Fish can be salted again. Elazar and I will settle it — a few weeks of his catch, I expect. Go and sleep.',
      ),
      say(
        'night-left',
        'nikanor',
        'And the jars you left on the rack can go across with the Magdala boats. The rest can cross another night. Go and sleep.',
      ),
      say(
        'night-safe',
        'nikanor',
        'My jars — every one of them safe. They can cross another night. Go and sleep.',
      ),
    ],
  },

  // ── Uncle Elazar: the boat, the load, the fee ───────────────────────────
  {
    id: 'd-elazar',
    characterId: 'elazar',
    entries: [
      { when: RETURNED, node: 'night' },
      { when: solved('p-load'), node: 'loaded' },
      { when: flag('got-gear'), node: 'e2' },
    ],
    start: 'e1',
    nodes: [
      say(
        'e1',
        'elazar',
        'There’s my new crew! Your grandmother has told you, then. Nikanor’s jars to the far shore tonight — and you’re going to load her.',
        { next: 'e1b' },
      ),
      say(
        'e1b',
        'elazar',
        'Here’s the gear: the bailer, a coil of rope, the spare oar and the trammel net. If there’s room, we’ll set the net on the way home and earn twice from one trip.',
        {
          effects: [
            { type: 'giveItem', item: 'bailer' },
            { type: 'giveItem', item: 'rope' },
            { type: 'giveItem', item: 'spare-oar' },
            { type: 'giveItem', item: 'net' },
            { type: 'setFlag', flag: 'got-gear', value: true },
          ],
          next: 'e2',
        },
      ),
      say('e2', 'elazar', 'Well? Anything you want to know before you load her?', {
        choices: [
          opt('how-much', 'How much can she carry?', 'e3', { once: true }),
          opt('fee', 'Grandmother says the money is for what we owe.', 'e4', { once: true }),
          opt('others', 'Are other boats crossing tonight?', 'e5', { once: true }),
          opt('bye', 'Not yet.'),
        ],
      }),
      say(
        'e3',
        'elazar',
        'Ten loads, besides the four of us. A jar is one load; the bailer, the rope, your lamp, your bread, your cloak and that water skin one each; the oar and the net two each. Past ten, she sits so low that a wave can come over the side.',
        { next: 'e2' },
      ),
      say(
        'e4',
        'elazar',
        'Every family on this shore pays for the right to fish, one way or another. Nikanor’s fee covers most of ours this season. So — as many jars as you can manage.',
        { next: 'e2' },
      ),
      say(
        'e5',
        'elazar',
        'Look at that crowd. If the teacher goes anywhere tonight, half the shore will want to follow him. Good — company is safer on the water at night.',
        { next: 'e2' },
      ),
      say('loaded', 'elazar', 'She’s loaded. Now we wait for evening.'),
      say('night', 'elazar', 'Home. All of us.', { next: 'night2' }),
      say(
        'night2',
        'elazar',
        'I’ve fished this lake since I was younger than you, {player}. I’ve seen squalls come out of nowhere. I have never seen one stop like that.',
        { branches: [{ when: flag('jettisoned'), next: 'night-jars' }], next: 'night-end' },
      ),
      say(
        'night-jars',
        'elazar',
        'As for Nikanor’s jars — we’ll pay him back, one catch at a time. It will be a lean month.',
        { next: 'night-end' },
      ),
      say(
        'night-end',
        'elazar',
        'Go and see your grandmother. She’s been standing on that jetty half the night.',
      ),
    ],
  },

  // ── The family boat: loading (Act 3) ───────────────────────────────────
  {
    id: 'd-boat',
    entries: [
      { when: RETURNED, node: 'night' },
      { when: solved('p-load'), node: 'done' },
      { when: not(solved('p-sky')), node: 'sky' },
      { when: not(flag('got-gear')), node: 'gear' },
      { when: not(flag('got-jars')), node: 'jars' },
    ],
    start: 'ready',
    nodes: [
      say(
        'sky',
        'narrator',
        'Grandmother said to ask Hanina what the sky is saying before anything goes into the boat. He’s sitting at the end of the jetty.',
      ),
      say('gear', 'narrator', 'The boat’s gear is still with Uncle Elazar, here on the jetty.'),
      say('jars', 'narrator', 'Nikanor’s jars are still up at the salting racks.'),
      say(
        'ready',
        'narrator',
        'The boat rocks gently against the jetty. Everything you might take is piled beside her.',
        {
          choices: [
            opt('load', 'Load the boat.', undefined, {
              effects: [{ type: 'openPuzzle', puzzle: 'p-load' }],
            }),
            opt('later', 'Not yet.'),
          ],
        },
      ),
      say('done', 'narrator', 'She’s loaded and ready. The sun is going down.'),
      say(
        'night',
        'narrator',
        'The boat is moored at the jetty again, half full of water, her sail lashed to the yard. She brought you home.',
      ),
    ],
  },

  // ── Tamar: the order for a squall ──────────────────────────────────────
  {
    id: 'd-tamar',
    characterId: 'tamar',
    entries: [
      { when: RETURNED, node: 'night' },
      { when: { type: 'clueFound', clue: 'clue-tamar-sail' }, node: 'again' },
    ],
    start: 't1',
    nodes: [
      say('t1', 'tamar', 'There you are! Your first crossing, and I get to teach you everything.', {
        choices: [
          opt('sail', 'What do we do if the wind gets up?', 't2', { once: true }),
          opt('boat', 'Is our boat old?', 't4', { once: true }),
          opt('bye', 'Later!'),
        ],
      }),
      say(
        't2',
        'tamar',
        'If a squall hits, there’s an order, and the order matters. First, take the wind out of the sail — haul on the brails and gather it up to the yard.',
        { next: 't3' },
      ),
      say(
        't3',
        'tamar',
        'Then lower the yard and lash it, so it can’t swing. Then oars out, and keep her bow to the waves. Then bail — and keep bailing.',
        { effects: [{ type: 'discoverClue', clue: 'clue-tamar-sail' }], next: 't1' },
      ),
      say(
        't4',
        'tamar',
        'Old? Uncle says she’s been patched more times than Grandmother’s cloak. New planks, old planks, borrowed planks — she’s still the same boat.',
        { effects: [{ type: 'setFlag', flag: 'heard-old-boat', value: true }], next: 't1' },
      ),
      say('again', 'tamar', 'Remember: sail, yard, oars, bail. Say it in your sleep.'),
      say(
        'night',
        'tamar',
        'I’ve never been so scared in my life. And then — nothing. Flat water, and stars.',
        { choices: [opt('me', 'Me neither.', 'night2')] },
      ),
      say(
        'night2',
        'tamar',
        'Don’t tell Uncle I said so. He’ll say I’m not ready to take her out on my own.',
      ),
    ],
  },

  // ── Yoezer: the hired man ──────────────────────────────────────────────
  {
    id: 'd-yoezer',
    characterId: 'yoezer',
    entries: [{ when: RETURNED, node: 'night' }],
    start: 'y1',
    nodes: [
      say(
        'y1',
        'yoezer',
        'Your uncle pays me by the day. I row, I haul, and I don’t argue with the weather.',
        {
          choices: [
            opt('storm', 'Have you ever been caught in a storm?', 'y2', { once: true }),
            opt('bye', 'See you in the boat.'),
          ],
        },
      ),
      say(
        'y2',
        'yoezer',
        'Once, years ago. We lost the net, and nearly the boat. Since then I listen to old Hanina.',
        { next: 'y1' },
      ),
      say('night', 'yoezer', 'I’ll take my day’s pay and sleep for a week.'),
    ],
  },

  // ── Shifra's family: following the teacher in a borrowed boat ────────────
  {
    id: 'd-shifra',
    characterId: 'shifra',
    entries: [{ when: RETURNED, node: 'night' }],
    start: 's1',
    nodes: [
      say(
        's1',
        'shifra',
        'Oh — are you from one of the fishing families? We came down from the hills to hear the teacher. I’m Shifra. This is my son, Ami, and my brother, Oded.',
        { next: 's2' },
      ),
      say('s2', 'shifra', 'It’s been such a day.', {
        choices: [
          opt('home', 'Are you going home tonight?', 's3', { once: true }),
          opt('heard', 'What has the teacher been saying?', 's5', { once: true }),
          opt('bye', 'Safe travels.'),
        ],
      }),
      say(
        's3',
        'shifra',
        'Home? If he crosses the lake tonight, we’ll follow him. Oded has borrowed a little boat from a cousin here.',
        { next: 's4' },
      ),
      say('s4', 'oded', 'Two oars and a bit of rope. I’ve rowed it twice. How hard can it be?', {
        next: 's4b',
      }),
      say('s4b', 'shifra', 'Oded makes pots, not voyages. But we’ve come so far.', { next: 's2' }),
      say(
        's5',
        'shifra',
        'He told stories, but I’m no good at remembering them. Ask Dinah — she’s sitting over there with the others. She remembers every word.',
        { next: 's2' },
      ),
      say('night', 'shifra', '{player}!', {
        branches: [
          { when: storm('take-aboard'), next: 'n-aboard' },
          { when: storm('tow'), next: 'n-tow' },
          { when: storm('oar'), next: 'n-oar' },
        ],
        next: 'n-hold',
      }),
      say(
        'n-aboard',
        'shifra',
        'You took us in — all of us — in that sea. I don’t know how to thank you.',
        { next: 'n-end' },
      ),
      say(
        'n-tow',
        'shifra',
        'That rope… I’ll hear it snapping tight in my sleep. You towed us the whole way.',
        { next: 'n-end' },
      ),
      say('n-oar', 'shifra', 'Oded says your oar is the only reason we stayed the right way up.', {
        next: 'n-end',
      }),
      say(
        'n-hold',
        'shifra',
        'We lost sight of you in the dark, and I thought — well. And then the wind dropped, and there you were.',
        { next: 'n-end' },
      ),
      say('n-end', 'shifra', 'We’re all here. Every one of us.', {
        branches: [{ when: chose('choice-cloak', 'given'), next: 'n-cloak' }],
        next: 'n-bye',
      }),
      say(
        'n-cloak',
        'shifra',
        'And Ami won’t take your cloak off. I’ll bring it back in the morning, I promise.',
        { next: 'n-bye' },
      ),
      say(
        'n-bye',
        'shifra',
        'We’ll sleep on the beach tonight and walk home tomorrow. I will never forget this night.',
      ),
    ],
  },
  {
    id: 'd-ami',
    characterId: 'ami',
    entries: [{ when: RETURNED, node: 'night' }],
    start: 'a1',
    nodes: [
      say('a1', 'ami', 'Are you a real fisher? Is your boat big? Does it have a sail?', {
        choices: [
          opt('yes', 'It does. You’ll see it tonight, if you’re crossing.', 'a2'),
          opt('bye', 'I have to go.'),
        ],
      }),
      say('a2', 'ami', 'Uncle Oded’s boat doesn’t have a sail. It has a hole.', { next: 'a3' }),
      say('a3', 'ami', '…A little one. He stuffed some cloth in it.'),
      say('night', 'ami', 'Were you scared? I was scared.', {
        branches: [{ when: chose('choice-cloak', 'given'), next: 'n-cloak' }],
      }),
      say('n-cloak', 'ami', 'Your cloak is warm. Can I keep it until the morning?'),
    ],
  },
  {
    id: 'd-oded',
    characterId: 'oded',
    entries: [{ when: RETURNED, node: 'night' }],
    start: 'o1',
    nodes: [
      say(
        'o1',
        'oded',
        'Pots I understand. Boats… this one leaks a little. I stuffed some cloth in the crack.',
        {
          choices: [
            opt('bail', 'Do you have a bailer?', 'o2', { once: true }),
            opt('bye', 'Good luck.'),
          ],
        },
      ),
      say('o2', 'oded', 'A cup. It will do. We’ll stay close to the fishing boats.'),
      say('night', 'oded', 'Pots. From now on, only pots.', {
        branches: [{ when: storm('oar'), next: 'n-oar' }],
      }),
      say(
        'n-oar',
        'oded',
        'And your oar — I’ll bring it back tomorrow. I held on to it like it was my own arm.',
      ),
    ],
  },

  // ── The crowd: the teacher's boat, seen from the shore (Mark 4:1–9) ─────
  {
    id: 'd-dinah',
    characterId: 'dinah',
    start: 'd1',
    nodes: [
      say(
        'd1',
        'dinah',
        'Shh — oh, it’s all right, he’s stopped for a moment. I’ve been sitting here since the morning.',
        {
          choices: [
            opt('what', 'What has he been talking about?', 'd2'),
            opt('bye', 'I won’t disturb you.'),
          ],
        },
      ),
      say(
        'd2',
        'dinah',
        'Stories, all day. One was about a farmer who went out to sow, and his seed fell on all kinds of ground.',
        { kind: 'paraphrase', recordId: 'rec-para-dinah', next: 'd3' },
      ),
      say(
        'd3',
        'dinah',
        'I’m still turning it over. I think I’ll be turning it over for a long time.',
      ),
    ],
  },
  {
    id: 'd-teacher-boat',
    start: 'tb1',
    nodes: [
      say(
        'tb1',
        'narrator',
        'A boat sits a little way out on the water, with the crowd along the shore facing it. You’re too far back to hear the words — only a voice carrying over the water, and people leaning in to listen.',
      ),
    ],
  },

  // ── Evening: the boats put out (Mark 4:35–36) ───────────────────────────
  {
    id: 'd-evening',
    start: 'ev1',
    nodes: [
      say(
        'ev1',
        'narrator',
        'Evening comes, and the crowd begins to break up. The teacher’s disciples take him with them in the boat, just as he is, to cross to the other side.',
        { kind: 'paraphrase', recordId: 'rec-para-evening', next: 'ev2' },
      ),
      say(
        'ev2',
        'narrator',
        'Other boats push off to go with them. On the jetty, Uncle Elazar waves you down: “That’s us — come on!”',
        { branches: [{ when: talked('d-shifra'), next: 'shifra1' }], next: 'go' },
      ),
      say(
        'shifra1',
        'shifra',
        '{player}, wait! Our boat is so small, and Ami is so little. Could he cross in yours?',
        {
          choices: [
            opt('room', 'Yes — there’s room for him.', 'ami-yes', {
              when: not(HEAVY),
              effects: [{ type: 'recordChoice', choice: 'choice-ami', option: 'room' }],
            }),
            opt('make-room', 'We’ll leave a jar here, so he can come.', 'ami-yes', {
              when: HEAVY,
              effects: [
                { type: 'takeItem', item: 'fish-jar', quantity: 1 },
                { type: 'setFlag', flag: 'left-jars', value: true },
                { type: 'recordChoice', choice: 'choice-ami', option: 'made-room' },
              ],
            }),
            opt('no-room', 'I’m sorry — we’re loaded to the rails.', 'ami-no', {
              when: HEAVY,
              effects: [{ type: 'recordChoice', choice: 'choice-ami', option: 'no-room' }],
            }),
            opt('stay', 'I think he’s better off with you.', 'ami-no', {
              when: not(HEAVY),
              effects: [{ type: 'recordChoice', choice: 'choice-ami', option: 'no-room' }],
            }),
          ],
        },
      ),
      say('ami-yes', 'shifra', 'Thank you! Ami, you do everything they tell you. Everything!', {
        next: 'go',
      }),
      say('ami-no', 'shifra', 'I understand. We’ll keep close behind you, then.', { next: 'go' }),
      say(
        'go',
        'narrator',
        'You climb down into the boat. Tamar and Yoezer push off from the jetty, and the oars bite into the water.',
        { effects: [{ type: 'transition', scene: 'open-lake', spawn: 'aboard' }] },
      ),
    ],
  },
];

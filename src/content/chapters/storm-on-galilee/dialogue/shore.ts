import type { Condition } from '@/domain/conditions';
import {
  all,
  chose,
  flag,
  has,
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
      { when: RETURNED, node: 'night' },
      { when: solved('p-sky'), node: 'after' },
      { when: { type: 'clueFound', clue: 'clue-hanina-east' }, node: 'h1' },
    ],
    start: 'h0',
    nodes: [
      say(
        'h0',
        'hanina',
        'Shelomit’s youngster. Sit, sit. Everyone is looking at the crowd today. Nobody is looking up.',
        { expression: 'glad', next: 'h1' },
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
        {
          expression: 'glad',
          effects: [{ type: 'setFlag', flag: 'heard-sweet-water', value: true }],
          next: 'h1',
        },
      ),
      say(
        'after',
        'hanina',
        'Go ready, and keep close to the other boats. When the wind comes off those hills, it doesn’t knock first.',
      ),
      say(
        'night',
        'hanina',
        'Couldn’t sleep. I told you the wind off those heights doesn’t knock first. Well. It didn’t.',
        { next: 'night2' },
      ),
      say(
        'night2',
        'hanina',
        'Sixty years I’ve watched this lake. I have seen squalls come out of nowhere. I have never seen one stop like that. Never.',
        {
          choices: [
            opt('right', 'You were right about the sky.', 'night3'),
            opt('bye', 'Goodnight, Hanina.'),
          ],
        },
      ),
      say(
        'night3',
        'hanina',
        'I was right about the wind. What came after it, I have no words for. Go to bed, youngster.',
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
          expression: 'glad',
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
          opt('pitch', 'Could you spare some pitch and tow for Oded’s boat?', 'p1', {
            when: all(
              { type: 'clueFound', clue: 'clue-elazar-seam' },
              not(has('pitch')),
              not(flag('boat-patched')),
            ),
          }),
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
        'Help? Bless you. My apprentice ran off to hear the teacher, and he left the jar net half mended — the rope net my jars ride in. It’s torn right through my mark.',
        { expression: 'glad', next: 'b2' },
      ),
      say(
        'b2',
        'nikanor',
        'The pattern is chalked on the frame, but I can salt a fish, not tie a knot. Your grandmother mends nets, doesn’t she? Can you do it?',
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
        'The net is by the tubs. Take your time — Hanina says you’re a thinker.',
      ),
      say(
        'p1',
        'nikanor',
        'Pitch? For a potter’s borrowed boat? …Oh, go on. A leaking boat full of hill people is bad for business. Here — I seal my jar stoppers with it.',
        {
          effects: [{ type: 'giveItem', item: 'pitch' }],
          next: 'p2',
        },
      ),
      say(
        'p2',
        'nikanor',
        'Warm it at my fire first, or it won’t spread. And take this hank of old rope for tow. Don’t tell Elazar I’m soft.',
        { expression: 'glad', next: 'n2' },
      ),
      say(
        'measuring',
        'nikanor',
        'The net is by the tubs. Every row and column has to match the pattern.',
      ),
      say(
        'tell',
        'nikanor',
        'Mended already? Let me see… every knot where it should be, and my fish is whole again. Good!',
        {
          expression: 'glad',
          effects: [{ type: 'setFlag', flag: 'brine-done', value: true }],
          next: 't2',
        },
      ),
      say(
        't2',
        'nikanor',
        'You’ve saved me a whole morning. Listen: take only as many jars tonight as the boat can carry safely. Even two will do — the rest can go with the Magdala boats tomorrow.',
      ),
      say(
        'thanks',
        'nikanor',
        'The net is as good as new. Remember — only as many jars as the boat can carry safely.',
      ),
      say(
        'night',
        'nikanor',
        'You’re back! I heard the wind from my bed and couldn’t sleep a wink. Is everyone…?',
        {
          expression: 'glad',
          effects: [{ type: 'setFlag', flag: 'told-nikanor', value: true }],
          choices: [opt('all', 'Everyone’s safe. Every one of us.', 'night2')],
        },
      ),
      say('night2', 'nikanor', 'Thank God. And — forgive me for asking — my jars?', {
        branches: [
          { when: flag('jettisoned'), next: 'night-lost' },
          { when: flag('left-jars'), next: 'night-left' },
        ],
        next: 'night-safe',
      }),
      say('night-lost', 'nikanor', 'Overboard? Three of my jars?', {
        expression: 'surprised',
        choices: [
          opt('why', 'We threw them over to take Shifra’s family aboard.', 'night-lost2'),
          opt('sorry', 'I’m sorry. We had to make room.', 'night-lost2'),
        ],
      }),
      say(
        'night-lost2',
        'nikanor',
        '…Well. Fish can be salted again; people can’t. Elazar and I will settle it — a few weeks of his catch, I expect.',
        {
          expression: 'sad',
          branches: [{ when: flag('net-set'), next: 'night-catch' }],
          next: 'night-end',
        },
      ),
      say(
        'night-left',
        'nikanor',
        'And the jars you left on the rack can go across with the Magdala boats. The rest can cross another night.',
        { branches: [{ when: flag('net-set'), next: 'night-catch' }], next: 'night-end' },
      ),
      say(
        'night-safe',
        'nikanor',
        'My jars — every one of them safe. They can cross another night.',
        {
          expression: 'glad',
          branches: [{ when: flag('net-set'), next: 'night-catch' }],
          next: 'night-end',
        },
      ),
      say(
        'night-catch',
        'nikanor',
        'And is that a net full of fish in the bottom of your boat? Then my tubs will be busy in the morning. I’ll buy the lot for salting.',
        { expression: 'glad', next: 'night-end' },
      ),
      say('night-end', 'nikanor', 'Go on — go and see your grandmother. And then sleep.'),
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
        { expression: 'glad', next: 'e1b' },
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
          opt('seam', 'How do you seal a leaking seam?', 'e6', {
            when: all(
              { type: 'questStatus', quest: 'q-leak', status: 'active' },
              not({ type: 'clueFound', clue: 'clue-elazar-seam' }),
            ),
          }),
          opt('bye', 'Not yet.'),
        ],
      }),
      say(
        'e3',
        'elazar',
        'Ten loads, besides the four of us. A jar is one load; the bailer, the rope, your lamp, your bread, your cloak and that water skin one each; the oar and the net two each. Past ten, she sits so low that a wave can come over the side. And load her level — nose, tail and both sides.',
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
      say(
        'e6',
        'elazar',
        'The potter’s boat? Hm. Pull out whatever rag he’s stuffed in it, and let the seam dry — pitch won’t stick to wet wood. Pack it tight with tow, smear warm pitch over it, and let it set before she goes back in the water.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-elazar-seam' }],
          next: 'e7',
        },
      ),
      say(
        'e7',
        'elazar',
        'Nikanor keeps a pot of pitch for his jar stoppers. Ask him nicely — and quickly. The teacher won’t sit in that boat all day.',
        { next: 'e2' },
      ),
      say('loaded', 'elazar', 'She’s loaded. Now we wait for evening.'),
      say('night', 'elazar', 'Home. All of us.', { expression: 'glad', next: 'night2' }),
      say(
        'night2',
        'elazar',
        'I’ve fished this lake since I was younger than you, {player}. I’ve seen squalls come out of nowhere. I have never seen one stop like that.',
        {
          expression: 'surprised',
          branches: [{ when: flag('jettisoned'), next: 'night-jars' }],
          next: 'night-end',
        },
      ),
      say(
        'night-jars',
        'elazar',
        'As for Nikanor’s jars — we’ll pay him back, one catch at a time. It will be a lean month.',
        { branches: [{ when: flag('net-set'), next: 'night-net' }], next: 'night-end' },
      ),
      say(
        'night-net',
        'elazar',
        'Though the net came home full, and that’s a start. Your grandmother will say the lake gave something back.',
        { expression: 'glad', next: 'night-end' },
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
        expression: 'glad',
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
        {
          expression: 'glad',
          effects: [{ type: 'setFlag', flag: 'heard-old-boat', value: true }],
          next: 't1',
        },
      ),
      say('again', 'tamar', 'Remember: sail, yard, oars, bail. Say it in your sleep.'),
      say(
        'night',
        'tamar',
        'I’ve never been so scared in my life. And then — nothing. Flat water, and stars.',
        { expression: 'worried', choices: [opt('me', 'Me neither.', 'night2')] },
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
        expression: 'glad',
        next: 's4b',
      }),
      say('s4b', 'shifra', 'Oded makes pots, not voyages. But we’ve come so far.', {
        expression: 'worried',
        next: 's2',
      }),
      say(
        's5',
        'shifra',
        'He told stories, but I’m no good at remembering them. Ask Dinah — she’s sitting over there with the others. She remembers every word.',
        { next: 's2' },
      ),
      say('night', 'shifra', '{player}!', {
        expression: 'glad',
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
        { expression: 'glad', next: 'n-end' },
      ),
      say(
        'n-tow',
        'shifra',
        'That rope… I’ll hear it snapping tight in my sleep. You towed us the whole way.',
        { next: 'n-end' },
      ),
      say('n-oar', 'shifra', 'Oded says your oar is the only reason we stayed the right way up.', {
        expression: 'glad',
        next: 'n-end',
      }),
      say(
        'n-hold',
        'shifra',
        'We lost sight of you in the dark, and I thought — well. And then the wind dropped, and there you were.',
        { next: 'n-end' },
      ),
      say('n-end', 'shifra', 'We’re all here. Every one of us.', {
        expression: 'glad',
        branches: [
          { when: flag('oded-bailer'), next: 'n-bailer' },
          { when: chose('choice-cloak', 'given'), next: 'n-cloak' },
        ],
        next: 'n-bye',
      }),
      say(
        'n-bailer',
        'shifra',
        'And that old scoop you brought us — I bailed with it until my arms gave out, and then Oded did.',
        { branches: [{ when: chose('choice-cloak', 'given'), next: 'n-cloak' }], next: 'n-bye' },
      ),
      say(
        'n-cloak',
        'shifra',
        'And Ami won’t take your cloak off. I’ll bring it back in the morning, I promise.',
        { expression: 'glad', next: 'n-bye' },
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
        expression: 'glad',
        choices: [
          opt('yes', 'It does. You’ll see it tonight, if you’re crossing.', 'a2'),
          opt('bye', 'I have to go.'),
        ],
      }),
      say('a2', 'ami', 'Uncle Oded’s boat doesn’t have a sail. It has a hole.', { next: 'a3' }),
      say('a3', 'ami', '…A little one. He stuffed some cloth in it.'),
      say('night', 'ami', 'Were you scared? I was scared.', {
        expression: 'worried',
        branches: [{ when: chose('choice-cloak', 'given'), next: 'n-cloak' }],
      }),
      say('n-cloak', 'ami', 'Your cloak is warm. Can I keep it until the morning?', {
        expression: 'glad',
      }),
    ],
  },
  {
    id: 'd-oded',
    characterId: 'oded',
    entries: [
      { when: RETURNED, node: 'night' },
      { when: all(flag('boat-patched'), not(flag('oded-thanked'))), node: 'patched' },
    ],
    start: 'o1',
    nodes: [
      say(
        'o1',
        'oded',
        'Pots I understand. Boats… this one leaks a little. I stuffed some cloth in the crack.',
        {
          choices: [
            opt('bail', 'Do you have a bailer?', 'o2', { once: true }),
            opt('seal', 'That crack should be sealed properly before tonight.', 's1', {
              when: { type: 'questStatus', quest: 'q-leak', status: 'inactive' },
            }),
            opt('patch', 'I’ve brought pitch and tow. Let’s seal it together.', 'p1', {
              when: all(has('pitch'), not(flag('boat-patched'))),
            }),
            opt('give-bailer', 'Here — a real bailer for your boat.', 'g1', {
              when: has('spare-bailer'),
              effects: [
                { type: 'takeItem', item: 'spare-bailer' },
                { type: 'setFlag', flag: 'oded-bailer', value: true },
                { type: 'adjustTrust', character: 'oded', delta: 1 },
              ],
            }),
            opt('bye', 'Good luck.'),
          ],
        },
      ),
      say('o2', 'oded', 'A cup. It will do. We’ll stay close to the fishing boats.', {
        next: 'o1',
      }),
      say('s1', 'oded', 'Sealed? With what? I know clay, not boats.', {
        choices: [
          opt('find', 'I’ll find out how.', 's2', {
            effects: [{ type: 'startQuest', quest: 'q-leak' }],
          }),
          opt('no', 'Maybe one of the fishers could help.', 'o1'),
        ],
      }),
      say('s2', 'oded', 'Would you? We’ll be here until the teacher moves.', {
        expression: 'glad',
      }),
      say(
        'p1',
        'narrator',
        'Oded tips the little boat onto its side on the shingle. The crack runs along one seam, a rag jammed into it.',
        { effects: [{ type: 'openPuzzle', puzzle: 'p-patch' }] },
      ),
      say(
        'g1',
        'oded',
        'A proper scoop! Now if the lake comes in, it can go out again twice as fast. Shifra, look!',
        { expression: 'glad', next: 'o1' },
      ),
      say(
        'patched',
        'oded',
        'Look at that seam — hard as a pot glaze already. Not a drop will come through there.',
        {
          expression: 'glad',
          effects: [{ type: 'setFlag', flag: 'oded-thanked', value: true }],
          next: 'o1',
        },
      ),
      say('night', 'oded', 'Pots. From now on, only pots.', {
        branches: [
          { when: storm('oar'), next: 'n-oar' },
          { when: flag('boat-patched'), next: 'n-seam' },
        ],
      }),
      say(
        'n-seam',
        'oded',
        'Though I’ll say this: the waves came over the side, but not one drop came up through that seam.',
      ),
      say(
        'n-oar',
        'oded',
        'And your oar — I’ll bring it back tomorrow. I held on to it like it was my own arm.',
      ),
    ],
  },

  // ── Hodaya: a young fisher from Magdala, hauling her crew's boat up high ──
  {
    id: 'd-hodaya',
    characterId: 'hodaya',
    entries: [
      { when: RETURNED, node: 'night' },
      { when: talked('d-hodaya'), node: 'h2' },
    ],
    start: 'h1',
    nodes: [
      say(
        'h1',
        'hodaya',
        'Mind the rope! We’re hauling her up high tonight — higher than she’s been all summer.',
        { next: 'h2' },
      ),
      say('h2', 'hodaya', 'Hodaya, from Magdala. What can I do for you?', {
        choices: [
          opt('why', 'Why so high? The water’s hardly rough.', 'w1', { once: true }),
          opt('help', 'Can I help you haul?', 'l1', { when: not(flag('helped-hodaya')) }),
          opt('teacher', 'Are you following the teacher tonight?', 't1', { once: true }),
          opt('bye', 'I’ll leave you to it.'),
        ],
      }),
      say(
        'w1',
        'hodaya',
        'It isn’t rough — yet. But the air off the far hills keeps turning cold, against the wind. My father has fished out of Magdala for thirty years, and he doesn’t like the feel of tonight.',
        { effects: [{ type: 'discoverClue', clue: 'clue-magdala-crew' }], next: 'h2' },
      ),
      say('l1', 'hodaya', 'Grab the rope, then. On three — one, two, three!', { next: 'l2' }),
      say(
        'l2',
        'narrator',
        'You heave together. The boat grinds up the shingle a handspan at a time, until her stern is clear of the water.',
        { next: 'l3' },
      ),
      say(
        'l3',
        'hodaya',
        'That’s her safe. Here — take this. Our old bailer: the handle’s cracked, but it still throws water. You look like someone who’ll find a use for it.',
        {
          expression: 'glad',
          effects: [
            { type: 'giveItem', item: 'spare-bailer' },
            { type: 'setFlag', flag: 'helped-hodaya', value: true },
            { type: 'adjustTrust', character: 'hodaya', delta: 1 },
          ],
          next: 'h2',
        },
      ),
      say(
        't1',
        'hodaya',
        'Us? We came to sell fish, not to cross in the dark. But look at them all. If he goes, half the shore will go with him.',
        { next: 'h2' },
      ),
      say(
        'night',
        'hodaya',
        'You’re back! We sat up by the boat and watched the lamps on the water go out, one by one, in the spray.',
        { expression: 'worried', next: 'night2' },
      ),
      say(
        'night2',
        'hodaya',
        'And then the wind just stopped. My father stood up and didn’t say a word for a long time.',
        {
          choices: [
            opt('teacher', 'The teacher’s boat was still out there when it stopped.', 'night3'),
            opt('bailer', 'Your old bailer crossed in Oded’s boat.', 'night4', {
              when: flag('oded-bailer'),
            }),
            opt('bye', 'Goodnight, Hodaya.'),
          ],
        },
      ),
      say(
        'night3',
        'hodaya',
        'Then there’ll be a story told in Magdala tomorrow, and in every town around this lake.',
      ),
      say('night4', 'hodaya', 'Did it? Then it’s earned its keep. Good.', { expression: 'glad' }),
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
        'Evening comes. The teacher’s disciples leave the crowd and take him with them in the boat, just as he is, to cross to the other side.',
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
          expression: 'worried',
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
        expression: 'glad',
        next: 'go',
      }),
      say('ami-no', 'shifra', 'I understand. We’ll keep close behind you, then.', {
        expression: 'sad',
        next: 'go',
      }),
      say(
        'go',
        'narrator',
        'You climb down into the boat. Tamar and Yoezer push off from the jetty, and the oars bite into the water.',
        { effects: [{ type: 'transition', scene: 'open-lake', spawn: 'aboard' }] },
      ),
    ],
  },
];

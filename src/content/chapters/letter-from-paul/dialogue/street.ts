import {
  all,
  chose,
  flag,
  has,
  opt,
  say,
  solved,
  type ChoiceInput,
  type DialogueInput,
} from '../../road-to-jericho/dialogue/helpers';
import { BUNDLE_CLUES } from '../clues';

const bundleActive = { type: 'questStatus' as const, quest: 'q-bundle', status: 'active' as const };
const bundleDone = {
  type: 'questStatus' as const,
  quest: 'q-bundle',
  status: 'completed' as const,
};
const enoughBundleClues = { type: 'cluesFound' as const, clues: BUNDLE_CLUES, min: 2 };

/** Ask Zenon about the letter with no name (side quest). */
const askZenonAboutBundle = (back: string): ChoiceInput =>
  opt('bundle', 'Can you read anything on this letter with no name?', 'bundle1', {
    once: true,
    when: all(bundleActive, has('bundle-letter')),
    effects: [{ type: 'setFlag', flag: `zenon-bundle-from-${back}`, value: true }],
  });

/** What you can do with Attalos's unaddressed letter. */
const investigate = (): ChoiceInput[] => [
  opt('who', 'Who gave it to you?', 'a-who', { once: true }),
  opt('look', 'Let me look at it closely.', 'a-look', { once: true }),
  opt('weather', 'Was the rain bad on the road?', 'a-weather', { once: true }),
  opt('think', 'I think I know whose it is.', 'a-think', {
    requires: enoughBundleClues,
    unavailableText: 'You need to find out more first (at least 2 clues).',
    effects: [{ type: 'openPuzzle', puzzle: 'p-whose' }],
  }),
  opt('later', 'I’ll ask around.'),
];

export const STREET_DIALOGUES: DialogueInput[] = [
  // ── Zenon the scribe ───────────────────────────────────────────────────
  {
    id: 'd-zenon',
    characterId: 'zenon',
    entries: [
      { when: solved('p-sheets'), node: 'after' },
      { when: has('kallias-letter'), node: 'letter' },
    ],
    start: 'hello',
    nodes: [
      say(
        'hello',
        'zenon',
        'Good morning, {player}. No errands for me today? Pity. I have a contract to copy and a hand that wants to rest.',
        {
          choices: [
            opt('about', 'What do you do here, exactly?', 'about', { once: true }),
            askZenonAboutBundle('hello'),
            opt('bye', 'Good morning, Zenon.'),
          ],
        },
      ),
      say(
        'about',
        'zenon',
        'I write letters for people who can’t, and read letters to people who can’t. Contracts and receipts too. Most of this street can’t read — and most who can, can’t write a clean hand.',
        { next: 'about2' },
      ),
      say(
        'about2',
        'zenon',
        'I learned it as a slave, in a merchant’s house in Laodicea. He set me free when I was thirty. I still owe his family my respects and a favour when they ask — that’s how it works when you’re freed.',
        {
          effects: [{ type: 'setFlag', flag: 'zenon-story', value: true }],
          next: 'hello',
        },
      ),
      say('letter', 'zenon', 'That’s a letter that has been through the rain. Let me see.', {
        next: 'letter2',
      }),
      say(
        'letter2',
        'narrator',
        'Zenon spreads the damp sheets on his table and weighs the corners down with pebbles.',
        { next: 'letter3' },
      ),
      say(
        'letter3',
        'zenon',
        'The ink has run in places, but most of it can be read. The trouble is the order. Do you know how a letter goes together?',
        {
          choices: [
            opt('how', 'How does a letter go together?', 'form', { once: true }),
            askZenonAboutBundle('letter'),
            opt('try', 'Let me try to put it in order.', 'try', {
              effects: [{ type: 'openPuzzle', puzzle: 'p-sheets' }],
            }),
          ],
        },
      ),
      say(
        'form',
        'zenon',
        'Who it’s from, who it’s to, and a greeting — always first. Then good wishes: I hope you are well, I give thanks for you. Then the business. Then the farewell.',
        { next: 'form2' },
      ),
      say(
        'form2',
        'zenon',
        'And look at the handwriting. People like me write most letters. But the sender often adds the last lines in their own hand, so you know it’s really from them.',
        {
          effects: [{ type: 'setFlag', flag: 'learned-letter-form', value: true }],
          next: 'letter3',
        },
      ),
      say('try', 'narrator', 'Zenon slides the sheets across the table to you.'),
      say(
        'after',
        'zenon',
        'It came together well. Now go and read it to her. Every word of it is hers to hear.',
        {
          choices: [
            opt('own', 'Why did Kallias write the last lines himself?', 'own', { once: true }),
            askZenonAboutBundle('after'),
            opt('bye', 'Thank you, Zenon.'),
          ],
        },
      ),
      say(
        'own',
        'zenon',
        'So she’d know it was really him. Anyone can pay a scribe. Only Kallias writes like a chicken walking through ink.',
        { next: 'after' },
      ),
      say(
        'bundle1',
        'zenon',
        'Hm. It isn’t mine — I know the hand of everyone who writes to me, and I’m expecting nothing from Laodicea.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-not-zenon' }],
          next: 'bundle2',
        },
      ),
      say(
        'bundle2',
        'narrator',
        'He tilts it to the light. Through a tear in the outer sheet he reads out a few words: “…the cloaks you cleaned for us came back like new…”',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-torn-words' }],
          branches: [
            { when: flag('zenon-bundle-from-letter'), next: 'letter3' },
            { when: flag('zenon-bundle-from-after'), next: 'after' },
          ],
          next: 'hello',
        },
      ),
    ],
  },

  // ── Menandros the potter ───────────────────────────────────────────────
  {
    id: 'd-menandros',
    characterId: 'menandros',
    start: 'm1',
    nodes: [
      say(
        'm1',
        'menandros',
        'Pots! Lamps! Good lamps for tonight — the whole assembly is going to Philemon’s, I hear.',
        {
          choices: [
            opt('going', 'Are you going too?', 'm2', { once: true }),
            opt('bundle', 'Attalos has a letter with no name on it. Any idea whose?', 'm3', {
              once: true,
              when: bundleActive,
            }),
            opt('bye', 'Not today, thanks.'),
          ],
        },
      ),
      say('m2', 'menandros', 'Me? No. I’m not one of your lot. But I’ll sell them lamps.', {
        next: 'm1',
      }),
      say(
        'm3',
        'menandros',
        'Easy! Anything with a seal on it goes to Zenon. He’s the one who gets letters.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-potter-guess' }],
          next: 'm3b',
        },
      ),
      say('m3b', 'narrator', 'Menandros says it without even glancing at the letter.', {
        next: 'm1',
      }),
    ],
  },

  // ── Attalos the mule driver: the side quest ─────────────────────────────
  {
    id: 'd-attalos',
    characterId: 'attalos',
    entries: [
      { when: bundleDone, node: 'thanks' },
      { when: solved('p-whose'), node: 'go-deliver' },
      { when: bundleActive, node: 'again' },
    ],
    start: 'a1',
    nodes: [
      say(
        'a1',
        'attalos',
        'You’re Ammia’s {player}? I brought her that wet letter yesterday. Sorry about the state of it.',
        { next: 'a2' },
      ),
      say(
        'a2',
        'attalos',
        'The rain caught me at the river. Most of my bundle came through, but look at this one — the name’s washed clean off. And I can’t read anyway.',
        {
          choices: [
            opt('help', 'I’ll help you find out whose it is.', 'a3', {
              effects: [
                { type: 'startQuest', quest: 'q-bundle' },
                { type: 'giveItem', item: 'bundle-letter' },
              ],
            }),
            opt('no', 'Sorry, I can’t help today.', 'a-no'),
          ],
        },
      ),
      say(
        'a-no',
        'attalos',
        'Fair enough. I’ll ask around. I leave for Laodicea this afternoon either way.',
      ),
      say(
        'a3',
        'attalos',
        'Good. Letters are like mules: they only get anywhere if somebody takes them. Ask me anything.',
        { choices: investigate() },
      ),
      say('again', 'attalos', 'Any luck with that letter?', { choices: investigate() }),
      say(
        'a-who',
        'attalos',
        'A cloth merchant in Laodicea. Paid me a coin to bring it to Colossae. I didn’t ask more — you don’t, in my trade.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-cloth-merchant' }],
          next: 'again',
        },
      ),
      say(
        'a-look',
        'narrator',
        'The seal has cracked in the wet. Fine white dust is caught in the folds — clay dust, pale as flour.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-white-dust' }],
          next: 'again',
        },
      ),
      say(
        'a-weather',
        'attalos',
        'Bad enough. And there’s more to come. See Cadmus up there, wearing his grey cap? Rain down the valley by afternoon. Twenty years on this road — I know.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-rain-coming' }],
          next: 'again',
        },
      ),
      say('a-think', 'narrator', 'Attalos folds his arms and waits for your answer.'),
      say(
        'go-deliver',
        'attalos',
        'Tatia’s, is it? Would you take it to her? This mule has opinions about standing still.',
      ),
      say(
        'thanks',
        'attalos',
        'Tatia has her letter? Good. I’m off down the Laodicea road this afternoon. If you’re going that way, I’ll be at the waystation by the bridge, waiting out the rain.',
      ),
    ],
  },

  // ── Tatia the fuller ────────────────────────────────────────────────────
  {
    id: 'd-tatia',
    characterId: 'tatia',
    entries: [
      { when: flag('bundle-delivered'), node: 'after' },
      { when: all(solved('p-whose'), has('bundle-letter')), node: 'deliver' },
    ],
    start: 't1',
    nodes: [
      say(
        't1',
        'tatia',
        'Mind the white dust — it gets into everything. Clay, for scrubbing cloth. Are you here for Ammia?',
        {
          choices: [
            opt('weather', 'Will it rain today?', 't-weather', { once: true }),
            opt('gathering', 'Are you going to Philemon’s tonight?', 't-gathering', {
              once: true,
            }),
            opt('bye', 'Goodbye, Tatia.'),
          ],
        },
      ),
      say(
        't-weather',
        'tatia',
        'Cadmus has his cap on. It’ll rain by afternoon — I’m hanging nothing out today.',
        {
          effects: [{ type: 'discoverClue', clue: 'clue-rain-coming' }],
          next: 't1',
        },
      ),
      say(
        't-gathering',
        'tatia',
        'Wouldn’t miss it. A letter from Paul, read out to all of us! Epaphras told us so much about him.',
        { next: 't1' },
      ),
      say('deliver', 'tatia', 'A letter for me? From Laodicea?', { next: 'deliver2' }),
      say('deliver2', 'narrator', 'Tatia wipes the white dust off her hands and breaks the seal.', {
        effects: [
          { type: 'takeItem', item: 'bundle-letter' },
          { type: 'setFlag', flag: 'bundle-delivered', value: true },
          { type: 'adjustCounter', counter: 'hour', delta: 1 },
        ],
        next: 'deliver3',
      }),
      say(
        'deliver3',
        'tatia',
        'It’s from my cloth merchant — twelve more cloaks next month! Thank you, {player}. And thank Attalos, when you see him.',
        { next: 't1' },
      ),
      say('after', 'tatia', 'Twelve cloaks! I’ll need another pair of hands.', {
        choices: [
          opt('weather', 'Will it rain today?', 't-weather', { once: true }),
          opt('bye', 'Goodbye, Tatia.'),
        ],
      }),
    ],
  },

  // ── Coming home from the road ─────────────────────────────────────────
  {
    id: 'd-back-in-town',
    entries: [
      { when: chose('choice-kallias', 'come-now'), node: 'together' },
      { when: chose('choice-kallias', 'carry-reply'), node: 'carry' },
    ],
    start: 'alone',
    nodes: [
      say(
        'together',
        'narrator',
        'You come through the west gate with Kallias, both of you dripping. The rain is easing. Along the street, people are lighting lamps.',
        { next: 'together2' },
      ),
      say('together2', 'kallias', 'You go in first. I’ll be right behind you. …I will.', {
        next: 'go',
      }),
      say(
        'carry',
        'narrator',
        'You come back through the west gate with Kallias’s answer in your tablets. The rain is easing, and lamps are being lit along the street.',
        { next: 'go' },
      ),
      say(
        'alone',
        'narrator',
        'You come back through the west gate on your own. The rain is easing. Along the street, people are lighting lamps and heading for Philemon’s house.',
        { next: 'go' },
      ),
      say('go', 'narrator', 'The gathering begins at lamp-lighting. Go to Philemon’s house.', {
        kind: 'instruction',
      }),
    ],
  },
];

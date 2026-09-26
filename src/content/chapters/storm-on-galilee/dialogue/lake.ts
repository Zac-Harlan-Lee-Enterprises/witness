import type { Condition } from '@/domain/conditions';
import {
  all,
  AMI_WITH_YOU,
  any,
  chose,
  flag,
  has,
  HEAVY,
  not,
  opt,
  say,
  talked,
  type DialogueInput,
} from './helpers';

const CALM = flag('great-calm');
const STORM = flag('storm-broke');
const WIND = flag('wind-rising');
const KNOWN = talked('d-shifra');
/** Ami came with you from the shore (before anyone was taken aboard in the storm). */
const AMI_FROM_SHORE: Condition = any(
  chose('choice-ami', 'room'),
  chose('choice-ami', 'made-room'),
);
const storm = (option: string): Condition => chose('choice-storm', option);
const NO_CLOAK_GIVEN = not(chose('choice-cloak'));

/**
 * Out on the lake (Acts 3–5). The player's boat is one of the "other boats"
 * of Mark 4:36. Nobody here sees or hears what happens in the teacher's
 * boat: it is only ever a shape ahead in the dark. The storm and the calm
 * come the same way whatever the player chooses — the choices change only
 * what happens to the people in the player's own story.
 */
export const LAKE_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-under-way',
    start: 'u1',
    nodes: [
      say(
        'u1',
        'narrator',
        'The shore falls away behind you. The sun has gone down behind the western hills, and the water is dark and smooth.',
        { effects: [{ type: 'setCounter', counter: 'hour', value: 19 }], next: 'u2' },
      ),
      say(
        'u2',
        'narrator',
        'Ahead, the teacher’s boat moves out across the lake, and other boats go with it. Yours is one of them.',
        { next: 'u3' },
      ),
      say('u3', 'elazar', 'Tamar, Yoezer — steady strokes. {player}, keep your eyes on the sky.', {
        effects: [{ type: 'setFlag', flag: 'under-way', value: true }],
        next: 'u4',
      }),
      say('u4', 'narrator', 'Talk to the crew, or go forward and look ahead from the bow.', {
        kind: 'instruction',
      }),
    ],
  },
  {
    id: 'd-gust',
    start: 'g1',
    nodes: [
      say(
        'g1',
        'narrator',
        'A cold breath touches the back of your neck. Then another — stronger, pouring down off the dark eastern hills.',
        { next: 'g2' },
      ),
      say(
        'g2',
        'narrator',
        'The sail slams back against the mast. The boat lurches and heels, and water hisses along the rail.',
        { next: 'g3' },
      ),
      say('g3', 'tamar', 'Squall! {player} — the sail!', {
        choices: [
          opt('now', 'Get the sail in!', undefined, {
            effects: [{ type: 'openPuzzle', puzzle: 'p-sail' }],
          }),
        ],
      }),
    ],
  },
  {
    id: 'd-squall',
    start: 'q1',
    nodes: [
      say(
        'q1',
        'narrator',
        'Then the full storm breaks. Waves come over the bow one after another, and the boat begins to fill.',
        { next: 'q2' },
      ),
      say(
        'q2',
        'narrator',
        'Ahead, the teacher’s boat disappears into the dark and the spray. You can’t see it at all.',
        { next: 'q3' },
      ),
      say('q3', 'elazar', 'Bail! Everyone who isn’t rowing — bail!', {
        branches: [{ when: KNOWN, next: 'q4-known' }],
        next: 'q4',
      }),
      say(
        'q4-known',
        'narrator',
        'Then you see it, off the port side: Shifra’s little boat, wallowing low in the water.',
        { effects: [{ type: 'setFlag', flag: 'small-boat-seen', value: true }], next: 'q5' },
      ),
      say(
        'q4',
        'narrator',
        'Then you see it, off the port side: the little rowing boat, wallowing low in the water.',
        { effects: [{ type: 'setFlag', flag: 'small-boat-seen', value: true }], next: 'q5' },
      ),
      say('q5', 'narrator', 'Go to the port rail.', { kind: 'instruction' }),
    ],
  },

  // ── The hard decision (Act 4) ──────────────────────────────────────────
  {
    id: 'd-small-boat',
    entries: [
      { when: all(CALM, not(AMI_WITH_YOU), NO_CLOAK_GIVEN), node: 'after-ami' },
      { when: CALM, node: 'after-calm' },
      { when: chose('choice-storm'), node: 'after' },
      { when: flag('small-boat-seen'), node: 'sb1' },
    ],
    start: 'before',
    nodes: [
      say('before', 'narrator', 'A little rowing boat is keeping close on your port side.', {
        branches: [{ when: KNOWN, next: 'before-known' }],
        next: 'before-stranger',
      }),
      say(
        'before-known',
        'narrator',
        'It’s Shifra’s family. Oded is rowing hard, and Shifra waves.',
      ),
      say(
        'before-stranger',
        'narrator',
        'A man is at the oars, with a woman and a small boy. They wave.',
      ),
      say(
        'sb1',
        'narrator',
        'Across a gap of black water, the little boat is sitting lower with every wave. One of its oars has snapped, and a woman is bailing with a cup.',
        { branches: [{ when: HEAVY, next: 'sb2-heavy' }], next: 'sb2-light' },
      ),
      say(
        'sb2-heavy',
        'elazar',
        'We’re loaded to the rails ourselves, {player}! Whatever we do, we do it now!',
        { next: 'decide' },
      ),
      say(
        'sb2-light',
        'elazar',
        'We’ve a little room, {player} — but whatever we do, we do it now!',
        { next: 'decide' },
      ),
      say('decide', 'narrator', 'The waves are still rising. What will you do?', {
        choices: [
          opt('take-aboard', 'Bring the boats together and take them aboard.', 'aboard', {
            when: not(HEAVY),
            effects: [
              { type: 'recordChoice', choice: 'choice-storm', option: 'take-aboard' },
              { type: 'adjustCounter', counter: 'hour', delta: 1 },
            ],
          }),
          opt(
            'take-aboard-heavy',
            'Throw jars overboard to make room, and take them aboard.',
            'jettison',
            {
              when: HEAVY,
              effects: [
                { type: 'recordChoice', choice: 'choice-storm', option: 'take-aboard' },
                { type: 'takeItem', item: 'fish-jar', quantity: 3 },
                { type: 'setFlag', flag: 'jettisoned', value: true },
                { type: 'adjustCounter', counter: 'hour', delta: 1 },
              ],
            },
          ),
          opt('tow', 'Throw them the rope and tow them.', 'tow', {
            requires: has('rope'),
            unavailableText: 'You didn’t bring the rope.',
            effects: [{ type: 'recordChoice', choice: 'choice-storm', option: 'tow' }],
          }),
          opt('oar', 'Throw them the spare oar.', 'oar', {
            requires: has('spare-oar'),
            unavailableText: 'You didn’t bring the spare oar.',
            effects: [
              { type: 'recordChoice', choice: 'choice-storm', option: 'oar' },
              { type: 'takeItem', item: 'spare-oar' },
            ],
          }),
          opt('hold', 'Keep our own boat afloat — bail, and keep her bow to the waves.', 'hold', {
            effects: [{ type: 'recordChoice', choice: 'choice-storm', option: 'hold-course' }],
          }),
        ],
      }),
      say(
        'jettison',
        'narrator',
        'Yoezer heaves three of Nikanor’s jars over the side, one after another. The boat lifts a little.',
        { next: 'aboard' },
      ),
      say(
        'aboard',
        'narrator',
        'Uncle Elazar brings the boat round, and Tamar grabs the little boat’s bow as the two hulls slam together.',
        { branches: [{ when: not(AMI_FROM_SHORE), next: 'aboard-ami' }], next: 'aboard2' },
      ),
      say(
        'aboard-ami',
        'narrator',
        'A small boy is passed across to you first. You wrap your arms round him and don’t let go.',
        { next: 'aboard2' },
      ),
      say(
        'aboard2',
        'narrator',
        'Then the woman, then the man at the oars, scrambling in over the rail. Their little boat drifts off behind you, half full of water.',
      ),
      say(
        'tow',
        'narrator',
        'You throw the coil of rope. It falls short — you haul it in and throw again, and this time it’s caught and made fast to their bow. Now both boats lurch through the waves together, the line snapping tight and slack.',
      ),
      say(
        'oar',
        'narrator',
        'You throw the spare oar. It splashes down beside them, and the man snatches it out of the water. Now he can keep their bow to the waves.',
      ),
      say(
        'hold',
        'narrator',
        'You bail, and bail, and bail. Tamar and Yoezer hold the bow to the waves. When you look up again, the little boat has vanished into the dark.',
        { next: 'hold2' },
      ),
      say(
        'hold2',
        'narrator',
        'There is no telling whether you could have reached them. Your own boat is filling too.',
      ),
      say('after', 'narrator', 'The storm is still roaring. There’s nothing to do but bail.'),
      // After the calm: what your choice looks like now.
      say('after-calm', 'narrator', 'The little boat is there, on the still water.', {
        branches: [
          { when: storm('take-aboard'), next: 'calm-aboard' },
          { when: storm('tow'), next: 'calm-tow' },
          { when: storm('oar'), next: 'calm-oar' },
        ],
        next: 'calm-hold',
      }),
      say(
        'calm-aboard',
        'narrator',
        'It drifts nearby, empty and half full of water. Tamar is already reaching for it with an oar, to tow it home.',
      ),
      say('calm-tow', 'narrator', 'It rides at the end of your rope, safe.'),
      say(
        'calm-oar',
        'narrator',
        'It is close alongside, the man at the oars still gripping your spare oar.',
      ),
      say(
        'calm-hold',
        'narrator',
        'It comes gliding towards you out of the dark, swamped to the rails — the man rowing with one oar, the woman bailing, the boy between them. Everyone is there.',
      ),
      say('after-ami', 'narrator', 'The little boat is close alongside now, on the still water.', {
        branches: [
          { when: storm('tow'), next: 'ami-cold' },
          { when: storm('oar'), next: 'ami-cold' },
        ],
        next: 'ami-cold-hold',
      }),
      say(
        'ami-cold-hold',
        'narrator',
        'It came back out of the dark, swamped to the rails, with everyone still in it.',
        { next: 'ami-cold' },
      ),
      say('ami-cold', 'narrator', 'The boy is huddled between the others, soaked and shivering.', {
        choices: [
          opt('pass-cloak', 'Pass your cloak across to him.', 'cloak-passed', {
            requires: has('cloak'),
            unavailableText: 'You didn’t bring your cloak.',
            effects: [
              { type: 'takeItem', item: 'cloak' },
              { type: 'recordChoice', choice: 'choice-cloak', option: 'given' },
            ],
          }),
          opt('call', 'Call across that it will be morning soon.', 'call'),
        ],
      }),
      say('cloak-passed', 'narrator', 'He pulls it round himself and disappears into it.'),
      say('call', 'narrator', 'He nods, and huddles closer to the others.'),
    ],
  },

  // ── The calm (Mark 4:39 happens in the teacher's boat; here, only what the player feels) ──
  {
    id: 'd-calm',
    start: 'c1',
    nodes: [
      say(
        'c1',
        'narrator',
        'The next wave is the biggest yet. Water pours in over the bow. Uncle Elazar is shouting, and no one can hear a word.',
        { next: 'c2' },
      ),
      say('c2', 'narrator', 'And then the wind stops.', { next: 'c3' }),
      say(
        'c3',
        'narrator',
        'Not the way wind dies away at dusk, little by little. All at once. The waves sink down, and the lake around you lies flat and still, shining under the stars.',
        {
          effects: [
            { type: 'setFlag', flag: 'great-calm', value: true },
            { type: 'setCounter', counter: 'hour', value: 23 },
          ],
          next: 'c4',
        },
      ),
      say('c4', 'narrator', 'For a long moment nobody in the boat says anything at all.', {
        next: 'c5',
      }),
      say('c5', 'narrator', 'See to the others, then talk to Uncle Elazar.', {
        kind: 'instruction',
      }),
    ],
  },

  // ── The crew, before, during and after ─────────────────────────────────
  {
    id: 'd-elazar-lake',
    characterId: 'elazar',
    entries: [
      { when: CALM, node: 'calm' },
      { when: STORM, node: 'storm' },
      { when: WIND, node: 'wind' },
    ],
    start: 'e1',
    nodes: [
      say('e1', 'elazar', 'A good night for it. Listen — nothing but the oars.', {
        choices: [
          opt('ahead', 'Is that the teacher’s boat ahead?', 'e2', { once: true }),
          opt('ok', 'It’s beautiful out here.', 'e3'),
        ],
      }),
      say(
        'e2',
        'elazar',
        'It is. Keep us close behind it, and keep the boats together. Company is safer in the dark.',
      ),
      say(
        'e3',
        'elazar',
        'Beautiful, yes. The lake always is, until it isn’t — your grandmother’s words, not mine.',
      ),
      say('wind', 'elazar', 'Get that sail in — like Tamar taught you!'),
      say('storm', 'elazar', 'Bail! Keep bailing!'),
      say('calm', 'elazar', 'What was that? I’ve never… Wind doesn’t stop like that.', {
        choices: [
          opt('home', 'Can we go home?', 'c2'),
          opt('wait', 'Not yet — I want to see to the others.'),
        ],
      }),
      say(
        'c2',
        'elazar',
        'Home. I won’t cross the rest of this lake in a half-swamped boat in the dark. The far shore can wait for another night — and so can Nikanor’s jars.',
        {
          effects: [
            { type: 'setFlag', flag: 'returned', value: true },
            { type: 'setCounter', counter: 'hour', value: 26 },
            { type: 'transition', scene: 'capernaum-shore', spawn: 'from-lake' },
          ],
        },
      ),
    ],
  },
  {
    id: 'd-tamar-lake',
    characterId: 'tamar',
    entries: [
      { when: CALM, node: 'calm' },
      { when: STORM, node: 'storm' },
      { when: WIND, node: 'wind' },
    ],
    start: 't1',
    nodes: [
      say(
        't1',
        'tamar',
        'Pull, rest, pull, rest. You’ll be rowing next trip — watch how I do it.',
        {
          choices: [
            opt('order', 'Tell me the order for a squall again.', 't2', { once: true }),
            opt('ok', 'I’m watching.'),
          ],
        },
      ),
      say(
        't2',
        'tamar',
        'Sail, yard, oars, bail. Brails first to empty the sail, then the yard down and lashed, then oars and the bow to the waves — then bail.',
        { effects: [{ type: 'discoverClue', clue: 'clue-tamar-sail' }] },
      ),
      say('wind', 'tamar', 'The sail, {player}! Brails first!'),
      say(
        'storm',
        'tamar',
        'Keep bailing! Don’t look at the waves — look at the water in the boat!',
      ),
      say('calm', 'tamar', 'Is it… over? Just like that?'),
    ],
  },
  {
    id: 'd-yoezer-lake',
    characterId: 'yoezer',
    entries: [
      { when: CALM, node: 'calm' },
      { when: STORM, node: 'storm' },
    ],
    start: 'y1',
    nodes: [
      say('y1', 'yoezer', 'Quiet night. I don’t trust quiet nights.'),
      say('storm', 'yoezer', 'Bail!'),
      say('calm', 'yoezer', 'All my years on this water, and I’ve never seen the like. Never.'),
    ],
  },
  {
    id: 'd-ami-lake',
    characterId: 'ami',
    entries: [
      { when: all(CALM, chose('choice-cloak', 'given')), node: 'warm' },
      { when: CALM, node: 'calm' },
      { when: STORM, node: 'storm' },
    ],
    start: 'a1',
    nodes: [
      say('a1', 'ami', 'It’s so dark. Is that my mother’s boat? Can you see her?', {
        choices: [opt('there', 'There — just off the side. She’s right there.')],
      }),
      say('storm', 'ami', 'I want my mother!', {
        choices: [opt('hold', 'Hold on to me. Hold on tight.')],
      }),
      say('calm', 'ami', 'I’m c-cold.', {
        choices: [
          opt('cloak', 'Here — take my cloak.', 'cloak', {
            requires: has('cloak'),
            unavailableText: 'You didn’t bring your cloak.',
            effects: [
              { type: 'takeItem', item: 'cloak' },
              { type: 'recordChoice', choice: 'choice-cloak', option: 'given' },
            ],
          }),
          opt('close', 'Sit close to me. It will be morning soon.'),
        ],
      }),
      say('cloak', 'ami', 'It’s so warm. Thank you.'),
      say('warm', 'ami', 'I’m warm now. Is it nearly morning?'),
    ],
  },
  {
    id: 'd-shifra-lake',
    characterId: 'shifra',
    entries: [{ when: CALM, node: 'calm' }],
    start: 's1',
    nodes: [
      say('s1', 'shifra', 'Thank you — oh, thank you. Hold on to Ami, please!'),
      say(
        'calm',
        'shifra',
        'The wind… it just stopped. Did you see? Everyone in every boat must have felt it.',
      ),
    ],
  },
  {
    id: 'd-bow',
    entries: [
      { when: CALM, node: 'calm' },
      { when: STORM, node: 'storm' },
    ],
    start: 'b1',
    nodes: [
      say(
        'b1',
        'narrator',
        'Ahead, the teacher’s boat is a dark shape on the water, moving steadily towards the far shore. The eastern hills stand black against the last of the light.',
      ),
      say(
        'storm',
        'narrator',
        'Spray bursts over the bow. Ahead there is nothing but black water and white foam. You can’t see the teacher’s boat at all.',
      ),
      say(
        'calm',
        'narrator',
        'The teacher’s boat is there again — a dark shape on the still water, going on towards the far shore.',
      ),
    ],
  },
];

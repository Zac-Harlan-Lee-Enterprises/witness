import type { ChapterInput } from '@/domain/chapter';
import { ROOM_ITEMS } from './items';

const flag = (name: string) => ({ type: 'flag' as const, flag: name });

/**
 * Four puzzles, each growing out of the day:
 *  1. p-bread     — places for supper while the guests' bread bakes (logic grid)
 *  2. p-room      — fit the beds, and what else stays, onto the guest room floor (floor plan;
 *                   knowledge changes what is allowed)
 *  3. p-register  — Uncle Asa's declaration in the clerk's order (sequence; optional side quest)
 *  4. p-lamb      — where did the lamb go? (deduction; one confident sighting is not what it seems)
 *
 * The logic grid and the floor plan are Chapter 3's own puzzle types: no
 * other chapter uses them.
 */
export const PUZZLES: ChapterInput['puzzles'] = [
  {
    id: 'p-bread',
    type: 'logicGrid',
    title: 'Places for Supper',
    intro:
      'The dough is kneaded and the bread is baking. While it bakes, Tamar wants the places set for supper: four places along the eating mat, from the one nearest the fire to the one nearest the door. Everyone has said something about where they want to sit. Work out who sits where.',
    subjectsLabel: 'Who',
    optionsLabel: 'Place',
    subjects: [
      { id: 'amram', label: 'Saba Amram' },
      { id: 'asa', label: 'Uncle Asa' },
      { id: 'peninah', label: 'Aunt Peninah (with Dodi)' },
      { id: 'tamar', label: 'Tamar' },
    ],
    options: [
      { id: 'fire', label: 'Nearest the fire', position: 1 },
      { id: 'second', label: 'Second place', position: 2 },
      { id: 'third', label: 'Third place', position: 3 },
      { id: 'door', label: 'Nearest the door', position: 4 },
    ],
    clues: [
      {
        id: 'tamar-end',
        text: 'Tamar will be up and down all evening, bringing more bread, so she sits at one end of the mat.',
        rule: { type: 'oneOf', subject: 'tamar', options: ['fire', 'door'] },
      },
      {
        id: 'dodi-fire',
        text: 'Aunt Peninah wants little Dodi well away from the fire — not in either of the two places nearest it.',
        rule: { type: 'noneOf', subject: 'peninah', options: ['fire', 'second'] },
      },
      {
        id: 'tamar-peninah',
        text: 'Tamar sits right beside Aunt Peninah, to help with Dodi.',
        rule: { type: 'nextTo', a: 'tamar', b: 'peninah' },
      },
      {
        id: 'amram-cold',
        text: 'Saba Amram feels the cold in his bones: he sits nearer the fire than Uncle Asa.',
        rule: { type: 'before', a: 'amram', b: 'asa' },
      },
    ],
    answer: { amram: 'fire', asa: 'second', peninah: 'third', tamar: 'door' },
    hints: [
      {
        tier: 1,
        text: 'Start with Aunt Peninah: only two places are far enough from the fire for Dodi.',
      },
      {
        tier: 2,
        text: 'Tamar must sit at an end AND right beside Aunt Peninah. Only one end is next to either of Peninah’s places — which leaves two places for the men.',
      },
      {
        tier: 3,
        text: 'Full method: Peninah can only have the third place or the one by the door. Tamar must be at an end beside her, so Tamar is by the door and Peninah third. Saba Amram is nearer the fire than Uncle Asa, so Amram sits nearest the fire and Asa second.',
      },
    ],
    explanation:
      'Every clue fits: Saba Amram warm by the fire, Uncle Asa beside him, Aunt Peninah and Dodi well away from the flames, and Tamar by the door to fetch more bread. The Bible treats welcoming guests as something that matters: Abraham had cakes made from three seahs of fine flour for his visitors — a very generous amount (Genesis 18:1–8). (Tamar’s supper is made up for the game.)',
    recordIds: ['rec-hist-hospitality'],
    onSolved: [
      { type: 'adjustCounter', counter: 'hour', delta: 1 },
      { type: 'setFlag', flag: 'bread-baked', value: true },
      {
        type: 'showMessage',
        text: 'Tamar lifts the bread off the oven. Soon the whole house smells of it — and everyone will know where to sit.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-room',
    type: 'floorplan',
    title: 'Room in the Guest Room',
    intro:
      'The guest room floor is five squares long and three wide. The big water jar, the post that holds up the roof beam and the way to the door can’t be moved or covered. Uncle Asa’s and Aunt Peninah’s bedding must go in. Then fit in whatever else you can, turning things as you need. Anything left out must be moved: down to the animals’ end of the house, or somewhere else if you know a good place.',
    floor: ['J....', '.O...', 'DD...'],
    fixtures: [
      { symbol: 'J', label: 'the water jar' },
      { symbol: 'O', label: 'the roof post' },
      { symbol: 'D', label: 'the way to the door' },
    ],
    pieces: [
      { item: 'bed-asa', label: 'Uncle Asa’s bedding', shape: ['###'] },
      { item: 'bed-peninah', label: 'Aunt Peninah and Dodi’s bedding', shape: ['##', '##'] },
      { item: 'grain', label: 'Jars of barley', shape: ['#.', '##'] },
      { item: 'loom', label: 'Tamar’s loom', shape: ['###'] },
      { item: 'tools', label: 'Uncle Asa’s tools', shape: ['##'] },
    ],
    choiceId: 'choice-room',
    rules: [
      {
        id: 'beds',
        description: 'Both guests have their beds',
        rule: {
          type: 'allOf',
          of: [
            { type: 'includes', item: 'bed-asa' },
            { type: 'includes', item: 'bed-peninah' },
          ],
        },
        failureHint:
          'Uncle Asa and Aunt Peninah walked all day to be registered here. Their beds go in first.',
      },
      {
        id: 'grain',
        description: 'The grain stays dry and away from the animals',
        rule: {
          type: 'anyOf',
          of: [
            { type: 'includes', item: 'grain' },
            { type: 'state', condition: flag('roof-store-known') },
          ],
        },
        failureHint:
          'If the barley goes down to the animals’ end, the donkeys will have their noses in it by morning. Is there anywhere else dry in this house? Look around.',
      },
    ],
    classifications: [
      { option: 'kept-grain', rule: { type: 'includes', item: 'grain' } },
      { option: 'kept-loom', rule: { type: 'includes', item: 'loom' } },
      { option: 'kept-tools', rule: { type: 'includes', item: 'tools' } },
      { option: 'made-space', rule: { type: 'withinCapacity' } },
    ],
    hints: [
      {
        tier: 1,
        text: 'The two beds fit in many ways, but most of them leave no room for anything else — and only one more thing will ever fit beside them. Try placing that first.',
      },
      {
        tier: 2,
        text: 'The barley jars make an L of three. It fits in just one place: tucked round the roof post, in the top row next to the water jar. Unless you find a dry place for the barley somewhere else — have you looked at the ladder by the back wall?',
      },
      {
        tier: 3,
        text: 'Full method: put the barley’s L in the top row beside the water jar, wrapped round the roof post; Aunt Peninah’s square in the top-right corner; and Uncle Asa’s bedding along the bottom row, from the middle to the right-hand wall. If you know about the dry corner on the roof, you can keep the loom or the tools instead of the barley — or leave the space free.',
      },
    ],
    explanation:
      'Both guests have their beds and the barley is safe. Whatever you left out has been moved — and whether the guest room is full or has a space left may matter later tonight. (Tamar’s house and its guest room are fictional.)',
    recordIds: ['rec-recon-house'],
    onSolved: [
      // The room is arranged; the things themselves stay where you put them.
      ...ROOM_ITEMS.map((item) => ({ type: 'takeItem' as const, item })),
      { type: 'setFlag', flag: 'room-ready', value: true },
      {
        type: 'showMessage',
        text: 'You and Tamar shift everything until the guest room is ready.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-register',
    type: 'sequence',
    title: 'Uncle Asa’s Declaration',
    intro:
      'Kallias writes fast — if the details come in the right order. Put Uncle Asa’s declaration in the same order as the clerk’s finished tablet. Then answer his question.',
    requiresClues: { clues: ['clue-model-order'], min: 1 },
    cards: [
      {
        id: 'declarant',
        text: 'I, Asa son of Amram, a stonemason, thirty-one years old, make this declaration.',
        clueId: 'clue-model-order',
        reasoning: 'The finished tablet begins with the person making the declaration.',
      },
      {
        id: 'town',
        text: 'My household is registered in the village of Bethlehem, in Judea.',
        reasoning: 'Next comes the place where the household is registered.',
      },
      {
        id: 'members',
        text: 'With me: Peninah, my wife, twenty-six years old; Dodi, my son, two years old.',
        reasoning: 'Then everyone in the household, with their ages.',
      },
      {
        id: 'property',
        text: 'I own a share of a house in Bethlehem, and my mason’s tools.',
        reasoning: 'Then what the household owns.',
      },
      {
        id: 'oath',
        text: 'I swear that this is true. — Asa, his mark.',
        reasoning: 'Last comes the promise that it is true, and the mark or signature.',
      },
    ],
    correctOrder: ['declarant', 'town', 'members', 'property', 'oath'],
    initialOrder: ['property', 'oath', 'declarant', 'members', 'town'],
    conclusion: {
      question: 'Kallias asks: “So why does Rome want all these lists?”',
      options: [
        {
          id: 'land',
          text: 'To give every family more land.',
          correct: false,
          explanation:
            'Nothing on the tablet promises anyone land. It records what people already own.',
        },
        {
          id: 'tax',
          text: 'To know who lives where and what they own, so taxes can be worked out.',
          correct: true,
          explanation:
            'That’s what Kallias thinks too — and historians agree that a Roman census counted people and their property so that taxes could be assessed.',
        },
        {
          id: 'stay',
          text: 'To decide who is allowed to live in Bethlehem.',
          correct: false,
          explanation: 'The tablet records who lives where. It doesn’t decide who may stay.',
        },
      ],
    },
    hints: [
      { tier: 1, text: 'Look at the clerk’s finished tablet. What comes first on it?' },
      { tier: 2, text: 'Who is declaring → where → which people → what they own → the promise.' },
      {
        tier: 3,
        text: 'The order is: Asa himself → registered in Bethlehem → Peninah and Dodi → the house share and tools → the oath and his mark. Then: a census counts people and property for taxes.',
      },
    ],
    explanation:
      'You gave the details in the same order as the clerk’s model, so Kallias could write them straight down. The order is modelled on household census returns that survive from Roman Egypt; nobody knows exactly how registrations were written down in Judea.',
    recordIds: ['rec-recon-declaration', 'rec-hist-census'],
    onSolved: [
      {
        type: 'showMessage',
        text: 'Kallias’s stylus flies. “Asa son of Amram — done!” Uncle Asa nearly hugs him.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-lamb',
    type: 'deduction',
    title: 'Where Did the Lamb Go?',
    intro:
      'The light is going. Choose where to search for the speckled lamb — and back it up with the signs you have found.',
    question: 'Where did the speckled lamb go?',
    options: [
      {
        id: 'terraces',
        label: 'Up the terraces toward the village',
        description: 'Back up the hillside, the way you came.',
      },
      {
        id: 'thicket',
        label: 'Into the thorn thicket by the old watch hut',
        description: 'Dense and dark — a good place to hide.',
      },
      {
        id: 'gully',
        label: 'Down the gully toward the old cistern',
        description: 'A steep, stony path down to water.',
      },
    ],
    answer: 'gully',
    requiredEvidence: 2,
    evidence: [
      {
        clueId: 'clue-small-prints',
        reliable: true,
        bearsOn: [{ option: 'gully', stance: 'supports' }],
        note: 'Small hoofprints lead from the trough toward the top of the gully.',
      },
      {
        clueId: 'clue-wool',
        reliable: true,
        bearsOn: [{ option: 'gully', stance: 'supports' }],
        note: 'Speckled wool on the thorns where the path drops into the gully.',
      },
      {
        clueId: 'clue-ewe',
        reliable: true,
        bearsOn: [{ option: 'gully', stance: 'supports' }],
        note: 'The ewe keeps calling toward the gully. Suggestive — but on its own it proves nothing.',
      },
      {
        clueId: 'clue-hagit-water',
        reliable: true,
        bearsOn: [{ option: 'gully', stance: 'supports' }],
        note: 'Hagit says this lamb always wanders toward water — and the old cistern is at the bottom of the gully.',
      },
      {
        clueId: 'clue-terrace-gap',
        reliable: true,
        bearsOn: [{ option: 'terraces', stance: 'against' }],
        note: 'The only way up the terraces is closed with a thorn branch, and there are no tracks.',
      },
      {
        clueId: 'clue-thicket',
        reliable: true,
        bearsOn: [{ option: 'thicket', stance: 'against' }],
        note: 'A woolly lamb pushing into those thorns would leave wool behind. The edge is clean.',
      },
      {
        clueId: 'clue-asa-lamb',
        reliable: false,
        bearsOn: [{ option: 'terraces', stance: 'supports' }],
        note: 'Uncle Asa’s “lamb” had little horns — and he saw it hours before Yonatan’s lamb went missing.',
      },
    ],
    wrongAnswerFeedback: {
      terraces:
        'Look at the gap in the terrace wall. Could a lamb get through it — and did anything? And think about when Uncle Asa saw his “lamb”, and what was on its head.',
      thicket:
        'Look closely at the edge of the thicket. Would a woolly lamb push through those thorns without leaving anything behind?',
    },
    hints: [
      {
        tier: 1,
        text: 'Look around the fold: the trough, the thorns at the edges, the terrace gap, the thicket — and the ewe.',
      },
      {
        tier: 2,
        text: 'Try ruling places out. Which way up is closed? Which thorns are clean? Where do the signs actually lead?',
      },
      {
        tier: 3,
        text: 'The gully. Present two signs — for example the small hoofprints by the trough and the wool on the thorns at the top of the gully.',
      },
    ],
    explanation:
      'The prints and the wool both lead to the gully, while nothing had gone through the closed gap or the untouched thorns. A sighting from hours earlier — of an animal with horns — couldn’t tell you where this lamb went.',
    recordIds: ['rec-hist-shepherds'],
    onSolved: [
      { type: 'setFlag', flag: 'lamb-tracked', value: true },
      {
        type: 'showMessage',
        text: 'You scramble down the gully path in the last of the light.',
        tone: 'narration',
      },
    ],
  },
];

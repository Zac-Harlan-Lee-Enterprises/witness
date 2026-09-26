import type { ChapterInput } from '@/domain/chapter';
import { ROOM_ITEMS } from './items';

const flag = (name: string) => ({ type: 'flag' as const, flag: name });

/**
 * Four puzzles, one of each type, each growing out of the day:
 *  1. p-bread     — three measures of flour for guests (measuring)
 *  2. p-room      — what stays in the small guest room (packing; knowledge changes what is allowed)
 *  3. p-register  — Uncle Asa's declaration in the clerk's order (sequence; optional side quest)
 *  4. p-lamb      — where did the lamb go? (deduction; one confident sighting is not what it seems)
 */
export const PUZZLES: ChapterInput['puzzles'] = [
  {
    id: 'p-bread',
    type: 'measuring',
    title: 'Three Measures of Flour',
    intro:
      'Tamar wants exactly 3 measures of flour in the kneading trough for the guests’ bread. The one-measure cup is lost somewhere under the guests’ bundles. The trough holds 5 measures; the grain basket holds 4. Neither has marks. Scoop from the flour jar, tip flour back, or pour one into the other.',
    sourceLabel: 'the flour jar',
    unit: 'measures',
    vessels: [
      { id: 'trough', label: 'Kneading trough', capacity: 5 },
      { id: 'basket', label: 'Grain basket', capacity: 4 },
    ],
    goal: { vessel: 'trough', amount: 3 },
    hints: [
      {
        tier: 1,
        text: 'You can’t pour exactly 3 straight away. What happens if you pour a full basket into a trough that already holds 4?',
      },
      {
        tier: 2,
        text: 'Fill the basket and pour it into the trough, then fill the basket again and pour until the trough is full. The basket keeps exactly 3. Can you get those 3 into an empty trough?',
      },
      {
        tier: 3,
        text: 'Full method: fill the basket → pour it into the trough (4) → fill the basket → pour into the trough until it is full (the basket keeps 3) → tip the trough back into the flour jar → pour the basket into the trough. The trough holds 3.',
      },
    ],
    explanation:
      'The basket kept the 3 measures the full trough couldn’t take, and you poured them back into the empty trough. In Genesis 18, Abraham had bread made from three seahs of fine flour for his guests — a very generous amount. (Nobody knows exactly how big a seah was; these “measures” are simplified.)',
    recordIds: ['rec-hist-hospitality'],
    onSolved: [
      { type: 'adjustCounter', counter: 'hour', delta: 1 },
      { type: 'setFlag', flag: 'bread-baked', value: true },
      {
        type: 'showMessage',
        text: 'You knead the dough and Tamar bakes it on the hot oven. Soon the whole house smells of bread.',
        tone: 'narration',
      },
    ],
  },
  {
    id: 'p-room',
    type: 'packing',
    title: 'Room in the Guest Room',
    intro:
      'The guest room has floor space for 6. Uncle Asa’s and Aunt Peninah’s beds must go in. Then choose what else stays. Anything you leave out must be moved: down to the animals’ end of the house, or somewhere else if you know a good place.',
    capacity: 6,
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
        id: 'capacity',
        description: 'Everything fits on the floor',
        rule: { type: 'withinCapacity' },
        failureHint: 'Too much! There would be no floor left to lie down on. Take something out.',
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
        text: 'The two beds take 4 of the 6 spaces. That leaves room for one more thing — or for nothing at all.',
      },
      {
        tier: 2,
        text: 'The barley must stay dry. Unless you find a dry place for it somewhere else, it has to stay in the guest room. Have you looked at the ladder by the back wall?',
      },
      {
        tier: 3,
        text: 'Any arrangement works if both beds are in, it fits in 6, and the barley is either in the guest room or you know about the dry corner on the roof. What you leave out is moved — and a free space might matter tonight.',
      },
    ],
    explanation:
      'Both guests have their beds and the barley is safe. Whatever you left out has been moved — and whether the guest room is full or has a space left may matter later tonight.',
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

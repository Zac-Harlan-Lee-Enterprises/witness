import {
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

const lamb = (option: string) => chose('choice-lamb', option);
const loaf = (option: string) => ({
  type: 'recordChoice' as const,
  choice: 'choice-loaf',
  option,
});

/**
 * Supper by the fire, at nightfall (added when the chapter was made longer).
 * The household hears about the player's day, so what they did comes back
 * to them; Saba Amram retells three verses of Ruth (labelled paraphrase,
 * record rec-para-ruth); and the player decides what happens to the last
 * loaf, which matters when Zerah knocks. Everyone here is fictional.
 */
export const SUPPER_DIALOGUES: DialogueInput[] = [
  {
    id: 'd-supper',
    characterId: 'tamar',
    start: 's1',
    nodes: [
      say('s1', 'narrator', 'Tamar breaks the first loaf and passes it round.', {
        branches: [{ when: has('milk'), next: 'milk' }],
        next: 's2',
      }),
      say('milk', 'narrator', 'You give Aunt Peninah the jar of Hagit’s milk.', {
        effects: [{ type: 'takeItem', item: 'milk' }],
        branches: [{ when: chose('choice-milk', 'shared'), next: 'milk-half' }],
        next: 'milk-full',
      }),
      say(
        'milk-full',
        'peninah',
        'A whole jar! Dodi will think it’s a feast day when he wakes. Thank you, {player} — and thank Hagit.',
        { expression: 'glad', next: 's2' },
      ),
      say(
        'milk-half',
        'peninah',
        'Half a jar? …A newborn lamb had the rest? Well. Dodi won’t mind sharing with a lamb. He shares everything else with the donkey.',
        { expression: 'surprised', next: 's2' },
      ),
      say(
        's2',
        'tamar',
        'Well, {player}? You’ve been all over Bethlehem today. Tell us everything.',
        { expression: 'glad', next: 'hub' },
      ),
      say('hub', 'narrator', 'Everyone is listening, and eating.', {
        choices: [
          opt('found', 'I found Yonatan’s lost lamb, down in the gully.', 'found', {
            once: true,
            when: lamb('found'),
          }),
          opt('left', 'A lamb went missing at the fold. Old Yoram went looking for it.', 'left', {
            once: true,
            when: lamb('left'),
          }),
          opt('kid', 'Hagit’s kid was eating the chaff on the threshing floor.', 'kid', {
            once: true,
            when: flag('kid-home'),
          }),
          opt('line', 'Uncle Asa, tell them about the clerk.', 'line', {
            once: true,
            when: solved('p-register'),
          }),
          opt('waited', 'Uncle Asa, did you get registered in the end?', 'waited', {
            once: true,
            when: not(solved('p-register')),
          }),
          opt('ruth', 'Saba, how old is the threshing floor?', 'ruth', { once: true }),
          opt('done', 'I’m full.', 'loaf'),
        ],
      }),
      say(
        'found',
        'amram',
        'Down the gully, in the dusk, and back with it across your shoulders? Old Yoram will be telling that story for a year.',
        { expression: 'glad', next: 'hub' },
      ),
      say(
        'left',
        'tamar',
        'Then it’s as good as found. Yoram has carried home more lost lambs than you’ve eaten suppers.',
        { next: 'hub' },
      ),
      say(
        'kid',
        'asa',
        'My lamb with little horns! I knew it all along. …All right. I didn’t know it at all.',
        { expression: 'glad', next: 'hub' },
      ),
      say(
        'line',
        'asa',
        'Kallias wrote me down so fast that the man behind me cheered. Asa son of Amram: a wife, a son, a share of a roof and a hammer. All thanks to this one.',
        { expression: 'glad', next: 'hub' },
      ),
      say(
        'waited',
        'asa',
        'At the very end, when the light was going. Kallias wrote my name with his eyes shut. I’ve stood still so long I’ve forgotten how to sit.',
        { expression: 'sad', next: 'hub' },
      ),
      say(
        'ruth',
        'amram',
        'Older than anybody’s grandfather. Do you know the story of Ruth? Long ago, when the judges ruled, a famine came, and a man of Bethlehem went to live in Moab with his wife and their two sons.',
        paraphrase('rec-para-ruth', { next: 'ruth2' }),
      ),
      say(
        'ruth2',
        'amram',
        'Years later his wife, Naomi, came back to Bethlehem, and Ruth came with her. The whole town was stirred up at the sight of them. People could hardly believe it was Naomi.',
        paraphrase('rec-para-ruth', { next: 'ruth3' }),
      ),
      say(
        'ruth3',
        'amram',
        'And one night Naomi told Ruth that Boaz, their relative, would be winnowing barley on the threshing floor.',
        paraphrase('rec-para-ruth', { next: 'ruth4' }),
      ),
      say(
        'ruth4',
        'amram',
        'Whether it was our threshing floor, nobody knows. But people have been coming home to Bethlehem for a very long time — and the town has always made a fuss of them.',
        { expression: 'glad', effects: [setFlag('heard-ruth')], next: 'hub' },
      ),
      say(
        'loaf',
        'tamar',
        'One loaf of the guests’ bread left. What shall we do with it, {player}? You choose.',
        {
          choices: [
            opt('aside', 'Keep it by the oven, in case anyone else comes tonight.', 'aside', {
              effects: [loaf('set-aside')],
            }),
            opt('yonatan', 'Save it for Yonatan’s breakfast at the fold.', 'yonatan', {
              effects: [loaf('yonatan')],
            }),
            opt('share', 'Share it now. Everyone’s still hungry.', 'share', {
              effects: [loaf('shared')],
            }),
          ],
        },
      ),
      say(
        'aside',
        'tamar',
        'Guests get the best bread — even the ones we haven’t met yet. My grandmother would have liked you.',
        { expression: 'glad', next: 'knock' },
      ),
      say(
        'yonatan',
        'tamar',
        'He’ll have it at first light, with his cloak still round him. That boy is always hungry.',
        { next: 'knock' },
      ),
      say(
        'share',
        'narrator',
        'Tamar tears the last loaf into pieces and passes them round. Uncle Asa takes the biggest piece and pretends not to notice.',
        { next: 'knock' },
      ),
      say(
        'knock',
        'narrator',
        'One by one, the guests settle down to sleep. Then — a knock at the door.',
        { effects: [setFlag('supper-eaten')], next: 'door' },
      ),
      say(
        'door',
        'narrator',
        'An old man stands in the doorway, holding up a little clay lamp and leaning on a stick.',
        {
          effects: [setFlag('zerah-arrived'), { type: 'startDialogue', dialogue: 'd-zerah' }],
        },
      ),
    ],
  },
];

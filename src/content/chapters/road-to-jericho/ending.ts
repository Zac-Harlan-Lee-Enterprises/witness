import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const traveler = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-traveler',
  option,
});
const inn = (option: string): Condition => ({ type: 'choiceMade', choice: 'choice-inn', option });
const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const helped: Condition = { type: 'any', of: [traveler('tend-walk'), traveler('tend-caravan')] };

/**
 * Act 6 — the Scripture Connection — and Act 7 — the summary.
 * Comparisons respond to what the player actually did, and never grade it.
 */
export const SCRIPTURE_CONNECTION: ChapterInput['scriptureConnection'] = {
  title: 'A Story on the Same Road',
  intro:
    'Yair’s story comes from the Gospel of Luke. Your journey was a made-up story; this passage is Scripture. Here is what the passage contains, what we know about its world, and some ways Christians have understood it. Each part is labeled so you can tell them apart.',
  sections: [
    { heading: 'The passage', recordIds: ['rec-luke-10-25-37', 'rec-para-luke-10'] },
    {
      heading: 'The question behind the story',
      recordIds: ['rec-hist-love-commands', 'rec-deut-6-5', 'rec-lev-19-18', 'rec-lev-19-34'],
    },
    {
      heading: 'The world of the story',
      recordIds: [
        'rec-hist-descent',
        'rec-hist-road-danger',
        'rec-hist-samaritans',
        'rec-hist-priests-levites',
        'rec-hist-oil-wine',
        'rec-hist-coins',
        'rec-hist-inn',
      ],
    },
    {
      heading: 'How Christians have read it',
      recordIds: ['rec-interp-neighbor', 'rec-interp-augustine', 'rec-interp-fair-reading'],
    },
  ],
  comparisons: [
    {
      text: 'On your road, the person in need was a Samaritan. In Jesus’ story, the one who SHOWED mercy was a Samaritan. Both stretch the edges of who counts as a “neighbor.”',
    },
    {
      when: helped,
      text: 'You spent water, supplies and hours of daylight to care for Menashe. In Jesus’ story, the Samaritan spent oil and wine, his own animal, his time and two denarii. What did caring cost you — and what did it give you?',
    },
    {
      when: traveler('send-help'),
      text: 'You found another way to help: you left what you could and ran for others. Helping doesn’t always look the same.',
    },
    {
      when: traveler('hurry-on'),
      text: 'You kept going. The danger and your errand were real. Luke doesn’t tell us why the priest and the Levite passed by — the story leaves room to wonder what makes stopping so hard.',
    },
    {
      when: flag('dispute-settled'),
      text: 'Back in Jerusalem, you helped settle a quarrel fairly between a Judean baker and a Samaritan merchant. That was being a neighbor too.',
    },
    {
      when: inn('paid'),
      text: 'You paid the innkeeper — like the Samaritan, who left two denarii (about two days’ wages) and promised to pay more.',
    },
    {
      when: inn('promised'),
      text: 'You promised the innkeeper you would come back and pay — like the Samaritan’s promise in Luke 10:35.',
    },
    {
      when: flag('cut-bundle'),
      text: 'You bound a stranger’s wounds with linen that wasn’t yours to give, and Rivka called it well spent. In Jesus’ story, the Samaritan bandaged the man’s wounds too (Luke 10:34).',
    },
  ],
};

export const SUMMARY: ChapterInput['summary'] = {
  recap: [
    {
      text: 'Aunt Miriam sent you from Jerusalem with a remedy for Rivka’s son, Natan, who had a fever in Jericho.',
    },
    {
      when: {
        type: 'cluesFound',
        clues: [
          'clue-bend-watchers',
          'clue-cistern',
          'clue-wadi-dead-end',
          'clue-caravan',
          'clue-wadi-fastest',
          'clue-map',
        ],
        min: 3,
      },
      text: 'You listened carefully to travelers in the market and weighed their advice.',
    },
    {
      when: flag('linen-collected'),
      text: 'You collected Rivka’s linen from Hadassah the weaver and carried it with the remedy.',
    },
    {
      when: flag('dispute-settled'),
      text: 'You settled a dispute between Ezer the baker and Menashe the oil merchant with an honest measure.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-route' },
      text: 'At the fork, you read the evidence and chose the shepherds’ ridge path.',
    },
    { when: flag('refilled'), text: 'You refilled your water at the shepherds’ cistern.' },
    {
      when: { type: 'met', character: 'eli' },
      text: 'On the ridge you met Eli, Old Shimon’s grandson, minding the flock.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-what-happened' },
      text: 'Below the bend, you pieced together what had happened to a robbed traveler.',
    },
    { when: helped, text: 'You cared for the injured traveler and made sure he reached the inn.' },
    {
      when: traveler('send-help'),
      text: 'You left the injured traveler what you could and sent help from the inn.',
    },
    {
      when: traveler('hurry-on'),
      text: 'You hurried past the injured traveler and on toward Jericho.',
    },
    { when: flag('remedy-delivered'), text: 'You delivered Aunt Miriam’s remedy to Rivka.' },
    {
      when: flag('cloak-returned'),
      text: 'At the inn, you worked out whose striped cloak a goatherd had found in the rocks.',
    },
    {
      when: flag('sat-with-natan'),
      text: 'You kept Natan company while his remedy steeped, and told him about the road.',
    },
    {
      when: flag('heard-yair'),
      text: 'Yair told you about a story Jesus once told — about this very road.',
    },
  ],
  consequences: [
    {
      id: 'on-time',
      when: flag('remedy-on-time'),
      text: 'Natan received his remedy before nightfall.',
    },
    {
      id: 'lamplight',
      when: flag('remedy-lamplight'),
      text: 'Your lamp lit the last stretch of road, and Natan received his remedy that night.',
    },
    {
      id: 'dawn',
      when: flag('remedy-morning'),
      text: 'You stayed the night at the inn. Natan had a restless night, but received his remedy at dawn.',
    },
    {
      id: 'menashe-walked',
      when: traveler('tend-walk'),
      text: 'Menashe reached the inn leaning on your shoulder, and is recovering in Salome’s care.',
    },
    {
      id: 'menashe-caravan',
      when: traveler('tend-caravan'),
      text: 'Menashe rode to the inn on one of Malik’s animals, and is recovering in Salome’s care.',
    },
    {
      id: 'menashe-sent',
      when: all(traveler('send-help'), flag('asher-sent')),
      text: 'Salome’s son Asher brought Menashe to the inn on a donkey. He waited alone for a long time with what you had left him.',
    },
    {
      id: 'menashe-sent-untold',
      when: all(traveler('send-help'), not(flag('asher-sent')), not(flag('eli-told'))),
      text: 'You meant to send help, but never told anyone at the inn. Shepherds found Menashe near sunset and brought him in.',
    },
    {
      id: 'menashe-sent-eli',
      when: all(traveler('send-help'), not(flag('asher-sent')), flag('eli-told')),
      text: 'You never told anyone at the inn. But Eli, bringing the flock down the gully early as his grandfather asked, found Menashe in the afternoon and ran for the shepherds.',
    },
    {
      id: 'menashe-told',
      when: all(traveler('hurry-on'), flag('asher-sent')),
      text: 'You told Salome about the injured man, and her son Asher went to bring him in.',
    },
    {
      id: 'menashe-found',
      when: all(traveler('hurry-on'), not(flag('asher-sent')), not(flag('eli-told'))),
      text: 'Shepherds found Menashe near sunset and carried him to the inn.',
    },
    {
      id: 'menashe-found-eli',
      when: all(traveler('hurry-on'), not(flag('asher-sent')), flag('eli-told')),
      text: 'Eli, bringing the flock down the gully early as his grandfather asked, found Menashe in the afternoon and ran for the shepherds, who carried him to the inn.',
    },
    {
      id: 'cloak',
      when: { type: 'choiceMade', choice: 'choice-cloak', option: 'given' },
      text: 'Menashe kept warm in your cloak, and promised to return it in Jerusalem.',
    },
    {
      id: 'own-cloak',
      when: flag('cloak-returned'),
      text: 'Menashe’s own cloak, thrown away by the robbers, was kept for him at the inn.',
    },
    {
      id: 'linen-whole',
      when: all(flag('remedy-delivered'), not(flag('cut-bundle'))),
      text: 'Hadassah’s linen reached Rivka whole, for Natan’s bed.',
    },
    {
      id: 'linen-cut',
      when: flag('cut-bundle'),
      text: 'One of Rivka’s new sheets reached Jericho a strip short: it had bound Menashe’s wounds. Rivka hemmed the edge herself.',
    },
    { id: 'inn-paid', when: inn('paid'), text: 'Your coins paid for Menashe’s bed and meals.' },
    {
      id: 'inn-promised',
      when: inn('promised'),
      text: 'You owe Salome two coins — a promise to keep on your next trip.',
    },
    { id: 'inn-worked', when: inn('worked'), text: 'You worked to pay for Menashe’s care.' },
    { id: 'malik-paid', when: inn('malik-paid'), text: 'Malik paid for Menashe’s care himself.' },
    {
      id: 'ezer-menashe',
      when: flag('dispute-settled'),
      text: 'Ezer and Menashe parted as friends. Menashe’s oil is welcome at Ezer’s bakery.',
    },
    {
      id: 'dispute-open',
      when: all({ type: 'questStatus', quest: 'q-honest-measure', status: 'failed' }),
      text: 'The argument between Ezer and Menashe was left unsettled when you left Jerusalem.',
    },
    {
      id: 'hadassah',
      when: { type: 'choiceMade', choice: 'choice-prejudice', option: 'challenged' },
      text: 'Hadassah started to rethink what she’d always said about Samaritans.',
    },
    {
      id: 'tobiah',
      when: flag('tobiah-rethinks'),
      text: 'Tobiah promised to stop telling travelers the wadi is fastest.',
    },
    {
      id: 'salome-greeting',
      when: flag('greeted-salome'),
      text: 'You gave Salome Aunt Miriam’s greeting, and she sent back an open door.',
    },
    {
      id: 'natan-menashe',
      when: flag('natan-knows-menashe'),
      text: 'Natan knows a Samaritan oil merchant’s name now.',
    },
    {
      id: 'malik-watch',
      when: { type: 'choiceMade', choice: 'choice-malik', option: 'asked' },
      text: 'Malik’s caravan kept watch for you on the road.',
    },
    {
      id: 'always',
      when: { type: 'always' },
      text: 'The remedy reached Jericho because you carried it.',
    },
  ],
  themes: [
    'neighbor',
    'mercy',
    'courage',
    'stewardship',
    'hospitality',
    'reconciliation',
    'discernment',
  ],
  scriptureRecordIds: [
    'rec-luke-10-25-37',
    'rec-deut-6-5',
    'rec-lev-19-18',
    'rec-lev-19-34',
    'rec-john-4-9',
    'rec-matt-20-2',
    'rec-josh-15-7',
    'rec-deut-34-3',
  ],
  historyRecordIds: [
    'rec-hist-descent',
    'rec-hist-road-surface',
    'rec-hist-samaritans',
    'rec-hist-priests-levites',
    'rec-hist-oil-wine',
    'rec-hist-coins',
    'rec-hist-inn',
    'rec-hist-jericho',
  ],
  reflectionPrompts: [
    'When on your journey was it hardest to know the right thing to do? Why?',
    'Who is someone you find it hard to think of as a “neighbor”?',
    'At the end of the story, Jesus asks which man acted as a neighbor. What would acting as a neighbor look like for you this week?',
  ],
};

function all(...of: Condition[]): Condition {
  return { type: 'all', of };
}

function not(condition: Condition): Condition {
  return { type: 'not', condition };
}

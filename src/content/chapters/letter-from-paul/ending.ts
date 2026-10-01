import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

const kallias = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-kallias',
  option,
});
const debt = (option: string): Condition => ({ type: 'choiceMade', choice: 'choice-debt', option });
const reading = (option: string): Condition => ({
  type: 'choiceMade',
  choice: 'choice-reading',
  option,
});
const flag = (name: string): Condition => ({ type: 'flag', flag: name });
const not = (condition: Condition): Condition => ({ type: 'not', condition });
const all = (...of: Condition[]): Condition => ({ type: 'all', of });

/**
 * Act 6 — the Scripture Connection — and Act 7 — the summary.
 * Comparisons respond to what the player actually did, and never grade it.
 */
export const SCRIPTURE_CONNECTION: ChapterInput['scriptureConnection'] = {
  title: 'Two Letters Read Aloud',
  intro:
    'Zenon read two letters from the New Testament. Your journey was a made-up story; these letters are Scripture. Here is what they contain, what we know about the world they were written in, and the questions they still leave open. Each part is labelled so you can tell them apart.',
  sections: [
    { heading: 'The letter to Philemon', recordIds: ['rec-phm', 'rec-para-philemon'] },
    {
      heading: 'The end of the letter to the Colossians',
      recordIds: ['rec-col-4-7-9', 'rec-col-4-15-16', 'rec-col-4-18', 'rec-para-col-4'],
    },
    {
      heading: 'How the letters reached Colossae',
      recordIds: [
        'rec-hist-carriers',
        'rec-hist-scribes',
        'rec-hist-letter-form',
        'rec-hist-reading',
        'rec-hist-house-church',
      ],
    },
    {
      heading: 'The world of the letters',
      recordIds: ['rec-hist-who', 'rec-hist-lycus', 'rec-hist-slavery', 'rec-hist-pliny'],
    },
    {
      heading: 'Questions that are still open',
      recordIds: [
        'rec-interp-onesimus',
        'rec-interp-prison',
        'rec-interp-authorship',
        'rec-interp-slavery',
        'rec-interp-reconciliation',
      ],
    },
  ],
  comparisons: [
    {
      text: 'You carried a letter today, as Tychicus and Onesimus carried theirs. The words weren’t yours — getting them there, and reading them faithfully, was.',
    },
    {
      when: kallias('come-now'),
      text: 'You walked Kallias home to face Ammia. Paul sent Onesimus back with a letter asking Philemon to welcome him as he would welcome Paul himself (Philemon 17). What does it take to walk back through that door?',
    },
    {
      when: kallias('carry-reply'),
      text: 'You wrote down Kallias’s words and carried them home, as a scribe and a carrier both. Paul’s letters reached people the same way — in someone’s hands, and in someone’s voice.',
    },
    {
      when: kallias('leave-it'),
      text: 'You left the next step to Kallias. The letter to Philemon leaves the decision with Philemon too: Paul asks rather than commands (Philemon 8–9, 14), and we never learn what Philemon did.',
    },
    {
      when: debt('my-account'),
      text: 'You put three of your own coins toward Kallias’s debt. Paul offered to take whatever Onesimus owed onto his own account, in his own handwriting (Philemon 18–19).',
    },
    {
      when: debt('speak-for-him'),
      text: 'You promised to speak for Kallias. The whole letter to Philemon is someone speaking up for someone else.',
    },
    {
      when: flag('talked-chrysis'),
      text: 'Chrysis reminded you that Kallias was free to walk away from his trouble, and she was not. Onesimus’s situation was not Kallias’s: the letter’s appeal was made to a man who, it seems, owned him.',
    },
    {
      when: reading('softened'),
      text: 'You left out the hard part when you read Kallias’s letter aloud. Zenon read Paul’s letters to the whole assembly, hard parts and all.',
    },
    {
      when: flag('message-delivered'),
      text: 'You carried Chrysis’s words to her sister by word of mouth. Colossians says its carriers would bring news as well as the letter, and tell the assembly everything that was happening (Colossians 4:7–9).',
    },
  ],
};

export const SUMMARY: ChapterInput['summary'] = {
  recap: [
    {
      text: 'In Colossae, a letter from Kallias reached your grandmother Ammia, soaked by the rain and out of order.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-sheets' },
      text: 'With Zenon the scribe, you put the letter back together the way letters were built: greeting, good wishes, business, farewell in the sender’s own hand.',
    },
    {
      when: flag('ammia-letter-written'),
      text: 'You read Kallias’s letter to Ammia and wrote down her answer.',
    },
    {
      when: flag('bundle-delivered'),
      text: 'You helped Attalos the mule driver work out whose unaddressed letter he was carrying.',
    },
    {
      when: { type: 'visited', scene: 'lycus-road' },
      text: 'You carried Ammia’s answer down the Laodicea road, past the milestones, into the rain.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-alum' },
      text: 'At the dye works, you helped Kallias match the buyer’s shade.',
    },
    {
      when: { type: 'puzzleSolved', puzzle: 'p-hiding' },
      text: 'Kallias ran when he saw you coming. You worked out where he had gone and found him on the riverbank.',
    },
    { when: flag('read-to-kallias'), text: 'You read Ammia’s letter to Kallias yourself.' },
    {
      when: flag('chrysis-message'),
      text: 'Chrysis asked you to carry a message up the valley to her sister.',
    },
    {
      when: flag('heard-the-letters'),
      text: 'At lamp-lighting, you heard the letters from Paul read aloud at Philemon’s house.',
    },
  ],
  consequences: [
    {
      id: 'read-every-word',
      when: reading('every-word'),
      text: 'Ammia heard every word of Kallias’s letter, including the part where he admitted his lie.',
    },
    {
      id: 'read-softened-confessed',
      when: all(reading('softened'), flag('kallias-confessed')),
      text: 'You left Kallias’s confession out when you read his letter aloud. At the gathering, he told Ammia himself.',
    },
    {
      id: 'read-softened-reply',
      when: all(reading('softened'), kallias('carry-reply')),
      text: 'You left Kallias’s confession out when you read his letter aloud. His answer on your tablets said it again, in his own words.',
    },
    {
      id: 'read-softened-later',
      when: all(reading('softened'), kallias('leave-it')),
      text: 'You left Kallias’s confession out when you read his letter aloud. Ammia heard it from him when he came.',
    },
    {
      id: 'read-plea',
      when: reading('added-plea'),
      text: 'You read Kallias’s whole letter to Ammia, and added a plea of your own.',
    },
    {
      id: 'kallias-home',
      when: kallias('come-now'),
      text: 'Kallias walked home with you through the rain and stood beside you at the gathering. He will work half days until the debt is paid.',
    },
    {
      id: 'kallias-reply',
      when: kallias('carry-reply'),
      text: 'You carried Kallias’s answer home on your tablets. He came to Ammia’s door the next morning, with his savings.',
    },
    {
      id: 'kallias-later',
      when: kallias('leave-it'),
      text: 'You left the next step to Kallias. He came to Ammia’s door three days later.',
    },
    {
      id: 'kallias-paid',
      when: flag('kallias-paid'),
      text: 'Because the test skein matched, Kallias left with his day’s wage.',
    },
    {
      id: 'kallias-unpaid',
      when: all(kallias('come-now'), not(flag('kallias-paid'))),
      text: 'Kallias lost a day’s wage to come home with you.',
    },
    {
      id: 'debt-account',
      when: debt('my-account'),
      text: 'Three of your own coins went toward Kallias’s debt.',
    },
    {
      id: 'debt-spoke',
      when: flag('spoke-for-kallias'),
      text: 'You kept your word and spoke up for Kallias in front of Ammia.',
    },
    {
      id: 'debt-theirs',
      when: debt('their-business'),
      text: 'You left the debt between Kallias and Ammia.',
    },
    {
      id: 'cloak',
      when: flag('kallias-cloak'),
      text: 'Kallias walked home warm in the cloak Ammia had kept for him all winter.',
    },
    {
      id: 'mule',
      when: flag('rode-mule'),
      text: 'Attalos lent his mule, and Kallias rode the last miles home.',
    },
    {
      id: 'letter-wet',
      when: flag('letter-wet'),
      text: 'The rain blurred Ammia’s letter — but you had written it yourself and knew every word.',
    },
    {
      id: 'bundle-delivered',
      when: flag('bundle-delivered'),
      text: 'Tatia got her letter from Laodicea: twelve more cloaks to clean.',
    },
    {
      id: 'bundle-unread',
      when: { type: 'questStatus', quest: 'q-bundle', status: 'failed' },
      text: 'Attalos carried the letter with no name back to Laodicea, unread.',
    },
    {
      id: 'chrysis',
      when: flag('talked-chrysis'),
      text: 'At the dye works, Chrysis told you what Kallias’s freedom to walk away meant to someone who had none.',
    },
    {
      id: 'told-kallias',
      when: flag('told-kallias'),
      text: 'On the road home, you told Kallias what you had left out of his letter that morning.',
    },
    {
      id: 'message-every',
      when: { type: 'choiceMade', choice: 'choice-message', option: 'every-word' },
      text: 'Melitta heard every word her sister sent her, the master’s “perhaps” included.',
    },
    {
      id: 'message-softened',
      when: { type: 'choiceMade', choice: 'choice-message', option: 'softened' },
      text: 'Melitta heard that her sister was well and still had their mother’s comb. You kept the master’s “perhaps” to yourself.',
    },
    {
      id: 'message-unspoken',
      when: { type: 'questStatus', quest: 'q-message', status: 'failed' },
      text: 'Chrysis’s words for her sister went home with you, unspoken.',
    },
    {
      id: 'always',
      when: { type: 'always' },
      text: 'Every letter in this story reached its reader because somebody carried it.',
    },
  ],
  themes: ['reconciliation', 'debt', 'advocacy', 'honesty', 'messengers', 'freedom', 'welcome'],
  scriptureRecordIds: [
    'rec-phm',
    'rec-col-4-7-9',
    'rec-col-4-15-16',
    'rec-col-4-18',
    'rec-epaphras',
    'rec-rom-16-22',
    'rec-own-hand',
    'rec-1th-5-27',
    'rec-col-3-22',
    'rec-gal-3-28',
  ],
  historyRecordIds: [
    'rec-hist-lycus',
    'rec-hist-colossae-site',
    'rec-hist-wool',
    'rec-hist-carriers',
    'rec-hist-scribes',
    'rec-hist-letter-form',
    'rec-hist-reading',
    'rec-hist-house-church',
    'rec-hist-roads',
    'rec-hist-slavery',
    'rec-hist-pliny',
    'rec-hist-earthquake',
  ],
  reflectionPrompts: [
    'Kallias and Ammia both had something to face. What does making peace ask of the person who was wronged — and of the person who did wrong?',
    'Paul asked Philemon to welcome Onesimus instead of ordering him to. Why do you think he asked?',
    'Is there someone you could speak up for, or carry a message to, this week?',
  ],
};

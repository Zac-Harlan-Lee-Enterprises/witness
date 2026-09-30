import type { ChapterInput } from '@/domain/chapter';
import type { ScriptureRef } from '@/domain/scripture';
import { draft, STORY } from './governance';

/**
 * Content records for "A Letter from Paul".
 *
 * Kinds are explicit so the UI can label every paragraph. Scripture records
 * carry REFERENCES only; verse text comes from the ScriptureTextProvider
 * (placeholder unless an approved translation is enabled). Paraphrases are
 * our own words, checked against the WEB. Educational records cite sources
 * from ./sources.ts and state confidence. Disputed questions are presented as
 * open. Claim-by-claim notes: docs/research/letter-from-paul-sources.md.
 */
type Record = ChapterInput['records'][number];

const ref = (
  book: ScriptureRef['book'],
  chapter: number,
  verseStart: number,
  verseEnd?: number,
): ScriptureRef =>
  verseEnd === undefined ? { book, chapter, verseStart } : { book, chapter, verseStart, verseEnd };

const SCRIPTURE_REF = draft({ confidence: 'not-applicable', sourced: true, ageLevel: 'all' });

const scripture = (id: string, title: string, refs: ScriptureRef[], sources: string[]): Record => ({
  id,
  kind: 'scripture',
  title,
  scripture: refs,
  sources,
  governance: SCRIPTURE_REF,
});

const fiction = (id: string, title: string, body: string): Record => ({
  id,
  kind: 'fiction',
  title,
  body,
  sources: [],
  governance: STORY,
});

const SLAVERY_NOTE =
  'Slavery is described plainly, as the harm it was, and never as a game mechanic. How these letters bear on slavery is disputed and has a painful history of use; present the range of readings, not a verdict.';

export const RECORDS: ChapterInput['records'] = [
  // ── Scripture references ──────────────────────────────────────────────────
  scripture('rec-phm', 'Philemon 1–25', [ref('Philemon', 1, 1, 25)], ['src-lp-web-phm']),
  scripture(
    'rec-col-4-7-9',
    'Colossians 4:7–9',
    [ref('Colossians', 4, 7, 9)],
    ['src-lp-web-col04'],
  ),
  scripture(
    'rec-col-4-15-16',
    'Colossians 4:15–16',
    [ref('Colossians', 4, 15, 16)],
    ['src-lp-web-col04'],
  ),
  scripture('rec-col-4-18', 'Colossians 4:18', [ref('Colossians', 4, 18)], ['src-lp-web-col04']),
  scripture(
    'rec-epaphras',
    'Colossians 1:7 and 4:12–13',
    [ref('Colossians', 1, 7), ref('Colossians', 4, 12, 13)],
    ['src-lp-web-col01', 'src-lp-web-col04'],
  ),
  scripture('rec-col-2-1', 'Colossians 2:1', [ref('Colossians', 2, 1)], ['src-lp-web-col02']),
  scripture('rec-rom-16-22', 'Romans 16:22', [ref('Romans', 16, 22)], ['src-lp-web-rom16']),
  scripture(
    'rec-own-hand',
    'Galatians 6:11; 1 Corinthians 16:21; 2 Thessalonians 3:17',
    [ref('Galatians', 6, 11), ref('1 Corinthians', 16, 21), ref('2 Thessalonians', 3, 17)],
    ['src-lp-web-gal06', 'src-lp-web-1co16', 'src-lp-web-2th03'],
  ),
  scripture(
    'rec-1th-5-27',
    '1 Thessalonians 5:27',
    [ref('1 Thessalonians', 5, 27)],
    ['src-lp-web-1th05'],
  ),
  scripture('rec-col-3-11', 'Colossians 3:11', [ref('Colossians', 3, 11)], ['src-lp-web-col03']),
  scripture(
    'rec-col-3-22',
    'Colossians 3:22–4:1',
    [ref('Colossians', 3, 22, 25), ref('Colossians', 4, 1)],
    ['src-lp-web-col03', 'src-lp-web-col04'],
  ),
  scripture('rec-gal-3-28', 'Galatians 3:28', [ref('Galatians', 3, 28)], ['src-lp-web-gal03']),
  scripture(
    'rec-1co-7-21',
    '1 Corinthians 7:20–23',
    [ref('1 Corinthians', 7, 20, 23)],
    ['src-lp-web-1co07'],
  ),
  scripture(
    'rec-eph-6-21',
    'Ephesians 6:21–22',
    [ref('Ephesians', 6, 21, 22)],
    ['src-lp-web-eph06'],
  ),
  scripture('rec-rev-1-3', 'Revelation 1:3', [ref('Revelation', 1, 3)], ['src-lp-web-rev01']),

  // ── Paraphrases (our words, always labelled, always cited) ─────────────────
  {
    id: 'rec-para-philemon',
    kind: 'paraphrase',
    title: 'The letter to Philemon, in our own words',
    scripture: [ref('Philemon', 1, 1, 25)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-lp-web-phm'],
    body:
      'Paul, a prisoner, writes with Timothy to Philemon, to Apphia and Archippus, and to the assembly that meets in Philemon’s house, wishing them grace and peace. He thanks God for Philemon’s love and faith, and says Philemon has refreshed the hearts of God’s people.\n\n' +
      'Paul says he could order Philemon to do what is right, but he would rather appeal to him out of love, as an old man and a prisoner. He appeals for Onesimus, who became like a son to him while he was in chains. Onesimus’s name means useful; once he was useless to Philemon, Paul says, but now he is useful to them both. Paul is sending him back — it is like sending his own heart. He would have liked to keep him, but would do nothing without Philemon’s free agreement.\n\n' +
      'Perhaps, Paul says, they were parted for a while so that Philemon might have him back for good — not as a slave any longer, but as something more than a slave: a dear brother. He asks Philemon to welcome Onesimus as he would welcome Paul. If Onesimus has wronged him or owes him anything, Paul will pay it — and he writes that promise in his own hand. He is confident Philemon will do even more than he asks, and asks him to get a guest room ready, hoping to be given back to them through their prayers. Epaphras, Mark, Aristarchus, Demas and Luke send greetings.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      notes:
        'Checked against the WEB text of Philemon (fetched 2026-09-25). Adds nothing the letter does not say: it gives no reason why Onesimus was away and does not say what Philemon did.',
    }),
  },
  {
    id: 'rec-para-col-4',
    kind: 'paraphrase',
    title: 'The end of the letter to the Colossians, in our own words',
    scripture: [ref('Colossians', 4, 7, 18)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-lp-web-col04'],
    body:
      'Paul writes that Tychicus, a dear brother and faithful helper, will tell the Colossians all his news. He is sending him to find out how they are and to encourage them, together with Onesimus, a faithful and dear brother who is one of their own. Aristarchus, Mark, Jesus called Justus, Epaphras, Luke and Demas send greetings; Epaphras, also one of them, prays hard for them and cares deeply for the believers in Laodicea and Hierapolis.\n\n' +
      'Paul asks them to greet the believers in Laodicea, and Nymphas and the assembly in that house. When the letter has been read among them, they are to have it read in the assembly at Laodicea too, and to read the letter from Laodicea. They are to tell Archippus to complete the work he was given. Paul signs off with a greeting in his own hand and asks them to remember his chains.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      notes:
        'Checked against the WEB text of Colossians 4:7–18. The WEB reads “Nymphas … his house” in 4:15; many modern translations read “Nympha … her house” (see rec-interp-laodicea-letter).',
    }),
  },

  // ── Historical background ────────────────────────────────────────────────
  {
    id: 'rec-hist-lycus',
    kind: 'historical',
    title: 'Three cities in the Lycus valley',
    scripture: [ref('Colossians', 4, 13), ref('Colossians', 2, 1), ref('Revelation', 3, 14, 22)],
    sources: [
      'src-lp-web-rev03',
      'src-lp-wiki-colossae',
      'src-lp-wiki-laodicea',
      'src-lp-holylandphotos',
      'src-lp-herodotus',
      'src-lp-xenophon',
      'src-lp-strabo-12',
      'src-lp-web-col04',
      'src-lp-web-col02',
    ],
    body: 'Colossae stood in the valley of the river Lycus, in Phrygia (in today’s western Türkiye, near the town of Honaz), with Mount Cadmus rising above it. Laodicea lay about 15 kilometres down the valley (modern measurements range from about 13 to 17), and Hierapolis about 10 kilometres north of Laodicea. Centuries before Paul, Herodotus called Colossae a great city of Phrygia, and Xenophon called it prosperous and large. By the first century, the geographer Strabo counted Laodicea among the largest cities of Phrygia. Colossians says that Epaphras worked for the believers in all three cities (4:13), and that Paul had never met many of them face to face (2:1). Later, the book of Revelation includes a message to the assembly at Laodicea (Revelation 3:14–22).',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-colossae-site',
    kind: 'historical',
    title: 'What is left of Colossae',
    sources: ['src-lp-bas-colossae', 'src-lp-holylandphotos', 'src-lp-wiki-colossae'],
    body: 'Colossae is now an unexcavated mound about 3 kilometres north of Honaz. Archaeologists began surveying it in 2021, and the first excavation season, in 2025, opened tombs in the city’s northern cemetery — but the city itself has not yet been dug. So nobody knows what its streets looked like in Paul’s day. The street in this game is a reconstruction based on other Roman-era towns of the region.',
    governance: draft({
      confidence: 'established',
      sourced: true,
      notes:
        'Status as of the 2025 season and a July 2026 report. Check for newer excavation news before release.',
    }),
  },
  {
    id: 'rec-hist-wool',
    kind: 'historical',
    title: 'Black wool and the “Colossian” colour',
    sources: ['src-lp-strabo-12', 'src-lp-strabo-13', 'src-lp-pliny-21'],
    body: 'The Lycus valley lived on wool. Strabo wrote that the sheep around Laodicea gave wool prized for its softness and its raven-black colour, and that the neighbouring Colossians earned large revenues from the colour that bore their city’s name. Pliny the Elder compared the flower of the cyclamen to that “Colossian” colour, but no one knows exactly what shade it was — somewhere in the purple or reddish-purple range. Strabo also said the water at Hierapolis was so good for dyeing that wool dyed there with roots (his translators think madder) rivalled wool dyed with far costlier dyes.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Texts: established. The exact hue of the Colossian colour: uncertain. “Madder” for Strabo’s roots is the translator’s note. Strabo does not use the word “colossinus”; Pliny does.',
    }),
  },
  {
    id: 'rec-hist-dyeing',
    kind: 'historical',
    title: 'Madder and alum',
    sources: ['src-lp-pliny-19', 'src-lp-pliny-35', 'src-lp-stockholm'],
    body: 'Red dye from the root of the madder plant was used on wool in the Roman world: Pliny the Elder called madder necessary for dyeing wool and leather. Dyers also used a mineral salt Pliny called alumen for bright colours, and a later Egyptian recipe book (the Stockholm Papyrus, around AD 300) brightens madder red with alum so it will not fade. Ancient “alumen” was not always the same as modern alum. The shades and dips in the game’s dye puzzle are invented.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-earthquake',
    kind: 'historical',
    title: 'An earthquake in the valley',
    sources: ['src-lp-tacitus', 'src-lp-orosius', 'src-lp-jerome-chronicle', 'src-lp-strabo-12'],
    body: 'The Lycus valley was earthquake country; Strabo said so. The Roman historian Tacitus wrote that in AD 60 an earthquake laid Laodicea in ruins, and that the city rebuilt itself from its own wealth, without help from Rome. Later Christian chronicles (Jerome’s version of Eusebius, and Orosius) say an earthquake ruined three cities — Laodicea, Hierapolis and Colossae — dating it a few years later. Whether they describe the same event, and exactly when it happened, is uncertain.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Laodicea in AD 60: established (Tacitus). Colossae damaged: probable (later chronicles only).',
    }),
  },
  {
    id: 'rec-hist-hierapolis',
    kind: 'historical',
    title: 'The white cliffs of Hierapolis',
    sources: ['src-lp-unesco-hierapolis', 'src-lp-wiki-pamukkale', 'src-lp-strabo-13'],
    body: 'Hot springs full of dissolved calcite pour over a cliff below Hierapolis, leaving white stone terraces and pools — today’s Pamukkale. They can be seen from across the valley. Strabo already described how the water there hardens into stone. How far the terraces reached in Paul’s time is not known.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-roads',
    kind: 'historical',
    title: 'Roads and milestones',
    sources: [
      'src-lp-french-roads',
      'src-lp-strabo-14',
      'src-lp-wiki-mile',
      'src-lp-wiki-milestone',
      'src-lp-orbis',
    ],
    body: 'Rome made western Asia Minor into its province of Asia after 129 BC. Milestones bearing the name of its first governor, Manius Aquillius, mark some of the earliest Roman roads there, including a route from Ephesus toward Laodicea; they show the roads were in use, not who first built them. Strabo described a “common road” used by everyone travelling east from Ephesus through Laodicea. A Roman mile was about 1.48 kilometres. Milestones in the Greek-speaking east were often cut in both Latin and Greek, and many simply named the emperor. Travellers on foot managed roughly 20 to 30 kilometres a day.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-rec-road',
    kind: 'reconstruction',
    title: 'The road in this game',
    sources: ['src-lp-wiki-colossae', 'src-lp-holylandphotos', 'src-lp-orbis', 'src-lp-strabo-14'],
    body: 'Colossae was about 15 kilometres up the valley from Laodicea — well under a day’s walk. Strabo’s list of the great road east does not name Colossae, so exactly how the road ran there is uncertain. The game’s paved highway with kerbstones, its milestone numbers, the bridge, the dye works and the waystation are all invented to tell the story.',
    governance: draft({ confidence: 'possible', sourced: true }),
  },
  {
    id: 'rec-hist-carriers',
    kind: 'historical',
    title: 'How letters travelled',
    scripture: [ref('Colossians', 4, 7, 9), ref('Ephesians', 6, 21, 22)],
    sources: [
      'src-lp-suetonius',
      'src-lp-wiki-cursus',
      'src-lp-web-col04',
      'src-lp-web-eph06',
      'src-lp-chapple',
      'src-lp-head',
    ],
    body: 'There was no post office for ordinary people. Augustus set up a relay of messengers and carriages along the main roads so that news from the provinces reached him quickly, but that state post was for government business. Everyone else sent letters with a slave, a friend, or whoever was travelling the right way. Colossians names its carriers: Tychicus, with Onesimus (Colossians 4:7–9). Carriers often brought spoken news as well; Colossians says they would tell the assembly everything that was happening. Scholars disagree about whether carriers usually read the letters aloud themselves.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-scribes',
    kind: 'historical',
    title: 'Written by a scribe, signed by hand',
    scripture: [
      ref('Romans', 16, 22),
      ref('Colossians', 4, 18),
      ref('Philemon', 1, 19),
      ref('Galatians', 6, 11),
    ],
    sources: [
      'src-lp-richards',
      'src-lp-wiki-tiro',
      'src-lp-web-rom16',
      'src-lp-web-col04',
      'src-lp-web-phm',
      'src-lp-web-gal06',
    ],
    body: 'Many letters were dictated to a secretary. In Romans, the scribe Tertius adds his own greeting (Romans 16:22). A sender often wrote the last lines personally, and Paul says so more than once: Colossians ends with a greeting Paul wrote with his own hand (4:18), and in Philemon his own handwriting backs his promise to repay any debt (verse 19). The Roman statesman Cicero relied on his secretary Tiro, who was enslaved and later set free.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-letter-form',
    kind: 'historical',
    title: 'How a letter was put together',
    sources: ['src-lp-stowers', 'src-lp-richards', 'src-lp-wiki-pauline'],
    body: 'Greek and Roman letters followed a familiar pattern: an opening naming the sender and the recipient with a greeting, often a wish for the reader’s health, then the body, then closing greetings and a farewell. Paul’s letters use the same pattern with changes of their own — for example, a long thanksgiving near the start.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-materials',
    kind: 'historical',
    title: 'Papyrus, wax and wood',
    sources: [
      'src-lp-wiki-papyrus',
      'src-lp-wiki-wax',
      'src-lp-wiki-vindolanda',
      'src-lp-richards',
    ],
    body: 'People wrote letters on papyrus, which was used all around the Mediterranean; on wooden tablets coated with wax, which could be smoothed and used again; and in some places on thin wooden leaves written in ink (like the tablets found at Vindolanda in northern Britain). A finished letter could be folded, tied with string and sealed with clay or wax. None of Paul’s original letters survives, so what they were written on is not known.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-reading',
    kind: 'historical',
    title: 'Read aloud to everyone',
    scripture: [ref('Colossians', 4, 16), ref('1 Thessalonians', 5, 27), ref('Revelation', 1, 3)],
    sources: [
      'src-lp-web-col04',
      'src-lp-web-1th05',
      'src-lp-web-rev01',
      'src-lp-zair',
      'src-lp-bmcr',
    ],
    body: 'Paul’s letters to churches were meant to be read out to everyone gathered (Colossians 4:16; 1 Thessalonians 5:27), and Revelation blesses the one who reads aloud and those who hear (1:3). Many people could not read at all. The historian William Harris estimated that no more than about 15 per cent of people in Roman Italy could read, and fewer in the provinces; other scholars think he set the figures too low. Either way, most early Christians met their Scriptures by listening.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Literacy figures are estimates and debated (definitions differ). Harris 1989 via Zair 2023; criticism via BMCR 2019.',
    }),
  },
  {
    id: 'rec-hist-house-church',
    kind: 'historical',
    title: 'Churches in houses',
    scripture: [
      ref('Philemon', 1, 2),
      ref('Colossians', 4, 15),
      ref('Romans', 16, 5),
      ref('1 Corinthians', 16, 19),
    ],
    sources: [
      'src-lp-web-phm',
      'src-lp-web-col04',
      'src-lp-web-rom16',
      'src-lp-web-1co16',
      'src-lp-wiki-dura',
      'src-lp-yale-dura',
    ],
    body: 'The first Christians had no church buildings. They met in people’s homes: Paul greets “the assembly in your house” in Philemon, and churches in other homes in Colossians, Romans and 1 Corinthians. The earliest building we know was set aside for Christian worship, at Dura-Europos in Syria, was converted around AD 240 — nearly two hundred years later — and a 2024 study questions how house-like even that building was.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-rec-house',
    kind: 'reconstruction',
    title: 'What might Philemon’s house have looked like?',
    scripture: [ref('Philemon', 1, 2), ref('Philemon', 1, 22)],
    sources: [
      'src-lp-web-phm',
      'src-lp-ephesus-terrace',
      'src-lp-oeaw-terrace',
      'src-lp-wiki-triclinium',
    ],
    body: 'Nothing is known about Philemon’s house except that an assembly met there and that he could be asked to get a guest room ready (Philemon 2, 22). Wealthy houses in the region, like the Terrace Houses of Ephesus, begun in the time of Augustus, were built around colonnaded garden courtyards, with mosaic and marble floors and dining rooms where guests reclined on couches. The game’s house is modelled on houses like those. Philemon’s may have been much simpler.',
    governance: draft({ confidence: 'possible', sourced: true }),
  },
  {
    id: 'rec-hist-who',
    kind: 'historical',
    title: 'Who is who in the letters',
    scripture: [
      ref('Philemon', 1, 1, 2),
      ref('Philemon', 1, 10),
      ref('Philemon', 1, 23, 24),
      ref('Colossians', 4, 7, 17),
      ref('Colossians', 1, 7),
    ],
    sources: [
      'src-lp-web-phm',
      'src-lp-web-col01',
      'src-lp-web-col04',
      'src-lp-wiki-philemon',
      'src-lp-catholic-colossians',
    ],
    body: 'Philemon is Paul’s “fellow worker”; an assembly meets in his house. Apphia and Archippus are greeted with him; Colossians tells Archippus to complete his work (4:17). Onesimus, whose name means “useful”, is called “one of you” — a Colossian (4:9). Tychicus carries the letter (4:7). Epaphras, who first taught the Colossians (1:7), is with Paul, and in Philemon he is a fellow prisoner. Timothy is named as co-sender of both letters, and Mark, Aristarchus, Demas and Luke send greetings in both. That Philemon lived in Colossae is an inference from these shared names, not something either letter states.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-slavery',
    kind: 'historical',
    title: 'Slavery in the Roman world',
    sources: ['src-lp-wiki-slavery', 'src-lp-scheidel', 'src-lp-wiki-philemon'],
    body: 'Enslaved people were owned as property, and slavery was everywhere in the Roman world — though no one knows how many were enslaved; estimates vary widely. A slave who ran away could be hunted by professional slave-catchers, and Roman law let owners punish runaways almost without limit. Skilled slaves in towns could sometimes save money of their own and buy their freedom, and freeing slaves was a distinctive feature of Roman slavery — but for most, especially unskilled workers, freedom was unlikely. Freed people still owed duties to their former owners.',
    governance: draft({
      confidence: 'established',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote: SLAVERY_NOTE,
      notes:
        'Institutions: established. Population figures: uncertain, and deliberately not given as a number.',
    }),
  },
  {
    id: 'rec-hist-pliny',
    kind: 'historical',
    title: 'Another letter asking for mercy',
    sources: [
      'src-lp-pliny-letters-en',
      'src-lp-pliny-letters-la',
      'src-lp-tolmie-2025',
      'src-lp-white',
    ],
    body: 'About fifty years after Paul, the Roman writer Pliny the Younger wrote to his friend Sabinianus about a freedman who had angered him. The man had come to Pliny in tears, and Pliny asked Sabinianus to forgive him; in a second letter he thanks Sabinianus for taking the man back. Readers have compared it with Philemon since at least the 1600s. There are real differences: Pliny’s man was already free, and Pliny dwells on his remorse, which Paul does not.',
    governance: draft({ confidence: 'established', sourced: true }),
  },

  // ── Interpretation (labelled; traditions and scholars differ) ─────────────
  {
    id: 'rec-interp-onesimus',
    kind: 'interpretation',
    title: 'Why was Onesimus away?',
    scripture: [ref('Philemon', 1, 10, 18)],
    sources: [
      'src-lp-wiki-philemon',
      'src-lp-tolmie-2025',
      'src-lp-digest',
      'src-lp-beavis',
      'src-lp-tolmie-2019',
      'src-lp-head',
    ],
    body: 'The letter never says. The oldest and most common reading is that Onesimus had run away from Philemon, perhaps after stealing something (because of verse 18). Another view is that he went looking for Paul, a friend of his owner, to ask him to plead for him — Roman legal writers said a slave who did that was not a runaway, though whether Roman law applied in Colossae is itself debated. Others think Philemon or the assembly had sent Onesimus to help Paul in prison. A few scholars argue he was not a slave at all, but Philemon’s estranged brother. Christians and scholars still disagree.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Readings of Onesimus’s situation have shaped how Christians thought about slavery, sometimes harmfully. Present every view as a possibility; the game never decides.',
    }),
  },
  {
    id: 'rec-interp-prison',
    kind: 'interpretation',
    title: 'Where was Paul in prison?',
    scripture: [ref('Philemon', 1, 1), ref('Philemon', 1, 22), ref('Colossians', 4, 18)],
    sources: ['src-lp-wiki-philemon', 'src-lp-usccb-philemon', 'src-lp-fuller', 'src-lp-head'],
    body: 'Paul writes as a prisoner, but doesn’t say where. The traditional answer is Rome. Many scholars now suggest Ephesus, much closer to Colossae — which would make his plan to visit and stay in a guest room easier to picture — though the New Testament describes no imprisonment there. Others suggest Caesarea. So the letter may date from the early 50s or the early 60s AD.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'A historical question on which scholars and traditions differ; no position is taken.',
    }),
  },
  {
    id: 'rec-interp-authorship',
    kind: 'interpretation',
    title: 'Who wrote Colossians?',
    sources: ['src-lp-wiki-colossians', 'src-lp-wiki-philemon', 'src-lp-catholic-colossians'],
    body: 'Almost no one doubts that Paul wrote Philemon. Colossians is different: many scholars think a follower of Paul wrote it, perhaps after his death, while others — and many Christian traditions — hold that Paul wrote it. In one 2011 poll of British New Testament scholars, about half favoured Paul, a sixth were against and a third were unsure. The many names Colossians shares with Philemon are part of the argument on both sides.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Authorship of New Testament letters touches on how traditions understand Scripture. Both views are presented as held in good faith.',
    }),
  },
  {
    id: 'rec-interp-slavery',
    kind: 'interpretation',
    title: 'What do these letters say about slavery?',
    scripture: [
      ref('Philemon', 1, 15, 16),
      ref('Colossians', 3, 11),
      ref('Colossians', 3, 22, 25),
      ref('Colossians', 4, 1),
      ref('Galatians', 3, 28),
      ref('1 Corinthians', 7, 21),
    ],
    sources: [
      'src-lp-web-phm',
      'src-lp-web-col03',
      'src-lp-web-col04',
      'src-lp-web-gal03',
      'src-lp-web-1co07',
      'src-lp-daly',
      'src-lp-tolmie-2019',
      'src-lp-beavis',
    ],
    body: 'The letters do not call for slavery to end. Colossians tells enslaved people to obey their masters and masters to treat them justly (3:22–4:1), and also says that in Christ there is neither slave nor free (3:11; compare Galatians 3:28). Philemon asks that Onesimus be received as more than a slave — as a brother — but readers disagree about whether Paul was asking for his freedom. In the United States before the Civil War, defenders of slavery cited Philemon again and again to argue that runaways must be returned, while abolitionists read it very differently, and some enslaved Christians walked out of sermons that used it that way. These are hard passages, and Christians have wrestled with them.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'high',
      sensitivityNote: SLAVERY_NOTE,
    }),
  },
  {
    id: 'rec-interp-reconciliation',
    kind: 'interpretation',
    title: 'A letter read in front of everyone',
    scripture: [ref('Philemon', 1, 1, 2), ref('Philemon', 1, 8, 9), ref('Philemon', 1, 16, 19)],
    sources: ['src-lp-web-phm', 'src-lp-head', 'src-lp-white'],
    body: 'Philemon is a personal letter, but it is addressed to the whole assembly in his house too, so his answer would not be a private matter. Paul asks rather than commands, offers to pay any debt himself, and asks Philemon to welcome Onesimus as he would welcome Paul — as a brother. Many readers see here what reconciliation asks of people: someone willing to stand in the middle and carry a cost, and a welcome that changes how people treat each other. Readers differ on how far Paul meant to challenge the way households were ordered.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'A widely shared reading, presented as interpretation rather than the only one.',
    }),
  },
  {
    id: 'rec-interp-laodicea-letter',
    kind: 'interpretation',
    title: 'The letter from Laodicea, and Nympha’s house',
    scripture: [ref('Colossians', 4, 15, 16)],
    sources: [
      'src-lp-wiki-laodiceans',
      'src-lp-tertullian',
      'src-lp-wiki-nympha',
      'src-lp-web-col04',
    ],
    body: 'Colossians 4:16 mentions a “letter from Laodicea” that no one can identify for sure. It may be lost; it may be the letter we call Ephesians (the second-century teacher Marcion called Ephesians the letter “to the Laodiceans”, as Tertullian complained); some suggest Philemon. A short Latin “Letter to the Laodiceans” from much later is widely regarded as a forgery. In 4:15 the old manuscripts disagree too: some say Nympha and the church in her house, others Nymphas and his house. Most scholars now think Nympha was a woman; the World English Bible follows the other reading.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote: 'Open textual and historical questions; no position is taken.',
    }),
  },
  {
    id: 'rec-interp-later-onesimus',
    kind: 'interpretation',
    title: 'What became of Onesimus?',
    sources: ['src-lp-ignatius', 'src-lp-wiki-onesimus', 'src-lp-knox'],
    body: 'The New Testament doesn’t say. In the second century, Ignatius of Antioch wrote warmly of a bishop of Ephesus called Onesimus. The scholar John Knox (1935) argued that he was the same man, and that this is why the little letter to Philemon was kept. Others are unconvinced. It is possible, and no more than that.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote: 'A possible identification, not established history.',
    }),
  },

  // ── Fiction: people ───────────────────────────────────────────────────────
  fiction(
    'rec-p-ammia',
    'Ammia',
    'Your grandmother, a dyer whose red wool is known up and down the street. Quick with her tongue, slow to forget — and slower to give up on people than she lets on.',
  ),
  fiction(
    'rec-p-kallias',
    'Kallias',
    'Ammia’s apprentice until the winter, when a spoiled batch of wool, a lie and a quarrel sent him down the valley to work at a dye works by the Laodicea road.',
  ),
  fiction(
    'rec-p-zenon',
    'Zenon',
    'A scribe who writes and reads letters for the street from a table under the colonnade. He learned to write while enslaved in a merchant’s house in Laodicea and was freed at thirty. He has been teaching you your letters in exchange for errands.',
  ),
  fiction(
    'rec-p-attalos',
    'Attalos',
    'A mule driver who carries goods — and letters, for a coin — between Laodicea and Colossae. He can’t read, but he never forgets a face.',
  ),
  fiction(
    'rec-p-tatia',
    'Tatia',
    'A fuller: she cleans and finishes cloth in a yard full of vats and white clay dust. A member of the assembly that meets at Philemon’s house.',
  ),
  fiction(
    'rec-p-menandros',
    'Menandros',
    'A potter with a stall by the colonnade. Not part of the assembly, but happy to sell it lamps — and sure of his opinions.',
  ),
  fiction(
    'rec-p-nikon',
    'Nikon',
    'The overseer of a dye works by the bridge, which belongs to a merchant in Laodicea. Fair, in his way, and precise about measures.',
  ),
  fiction(
    'rec-p-chrysis',
    'Chrysis',
    'An enslaved woman who works the vats at the dye works by the bridge. Kallias was free to walk away from his trouble; she is not. She saves what she can, and hopes.',
  ),

  // ── Fiction: places and events ────────────────────────────────────────────
  fiction(
    'rec-pl-workshop',
    'Ammia’s workshop',
    'A fictional dye workshop in Colossae: vats of madder red, wool drying along the wall, and the spoiled batch Ammia never threw away.',
  ),
  fiction(
    'rec-pl-street',
    'A street in Colossae',
    'A fictional street with a colonnade of shops, a fountain and a fullery, imagined from other towns of the region.',
  ),
  fiction(
    'rec-pl-house',
    'The gathering at Philemon’s house',
    'This evening gathering is imagined. The New Testament does not say where, when or by whom these letters were first read aloud in Colossae, how the assembly responded, or what Philemon decided. Zenon, the reader in this story, is fictional. Philemon, Tychicus and Onesimus appear only as silent figures.',
  ),
  fiction(
    'rec-e-letter',
    'A letter in the rain',
    'Kallias’s letter reached Ammia soaked and out of order. You and Zenon put it back together, and you read it to her.',
  ),
  fiction(
    'rec-e-answer',
    'Ammia’s answer',
    'Ammia dictated her reply and you wrote it down: come home, and we will speak face to face. The debt is still a debt.',
  ),
  fiction(
    'rec-e-road',
    'The dye works by the bridge',
    'You carried Ammia’s letter down the Laodicea road through the rain and read it to Kallias yourself.',
  ),
  fiction(
    'rec-e-bundle',
    'The mule driver’s bundle',
    'Attalos carried a bundle of letters up from Laodicea. The rain washed the name off one of them.',
  ),
  fiction(
    'rec-e-gathering',
    'The letters read aloud',
    'At lamp-lighting, the assembly gathered at Philemon’s house to hear the letters from Paul read aloud.',
  ),
];

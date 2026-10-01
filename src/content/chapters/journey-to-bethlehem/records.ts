import type { ChapterInput } from '@/domain/chapter';
import type { Governance, HistoricalConfidence } from '@/domain/content-records';
import type { ScriptureRef } from '@/domain/scripture';
import { aiDraft } from '../../shared/governance';

/**
 * Content records for "A Journey to Bethlehem" (Luke 2:1–20).
 *
 * Scripture records carry REFERENCES only; verse text comes from the
 * ScriptureTextProvider. Retellings are labelled paraphrase records.
 * Historical claims cite sources and state confidence — including the
 * honest uncertainty around the census under Quirinius. Everything here is
 * an AI-assisted draft awaiting human review; nothing is approved.
 * Research notes: docs/research/journey-to-bethlehem-sources.md.
 */
const DRAFTED = '2026-09-25';

type Record = ChapterInput['records'][number];

interface DraftOptions {
  confidence: HistoricalConfidence;
  sourced?: boolean;
  sensitivity?: Governance['denominationalSensitivity'];
  sensitivityNote?: string;
  ageLevel?: Governance['ageLevel'];
  notes?: string;
}

/** The shared AI-draft preset, dated to when this chapter was drafted. */
function draft(options: DraftOptions): Governance {
  const g = aiDraft(options);
  return {
    ...g,
    history: g.history.map((h) => ({
      ...h,
      date: DRAFTED,
      summary: options.sourced
        ? 'Drafted for Chapter 3; sources retrieved and checked by an AI research assistant. Needs human citation verification and review.'
        : 'Drafted for Chapter 3. Needs human review.',
    })),
  };
}

/**
 * Text added on 2026-09-30, when the chapter was made longer. It was written
 * after the owner's approval of 2026-09-26, which therefore does not cover it
 * (see withApprovals): it stays in review until a named person approves it.
 */
const LONGER = '2026-09-30';

/** The AI-draft preset for the longer chapter's new text, dated to when it was written. */
function longerDraft(options: DraftOptions): Governance {
  const g = aiDraft(options);
  return {
    ...g,
    history: g.history.map((h) => ({
      ...h,
      date: LONGER,
      summary: options.sourced
        ? 'Added when Chapter 3 was made longer; checked against the WEB text by an AI assistant. Needs human review.'
        : 'Added when Chapter 3 was made longer. Needs human review.',
    })),
  };
}

const ref = (
  book: ScriptureRef['book'],
  chapter: number,
  verseStart: number,
  verseEnd?: number,
): ScriptureRef =>
  verseEnd === undefined ? { book, chapter, verseStart } : { book, chapter, verseStart, verseEnd };

const scripture = (id: string, title: string, refs: ScriptureRef[], sources: string[]): Record => ({
  id,
  kind: 'scripture',
  title,
  scripture: refs,
  sources,
  governance: draft({ confidence: 'not-applicable', sourced: true, ageLevel: 'all' }),
});

const FICTION = draft({ confidence: 'not-applicable' });
const LONGER_FICTION = longerDraft({ confidence: 'not-applicable' });
const newFiction = (id: string, title: string, body: string): Record => ({
  id,
  kind: 'fiction',
  title,
  body,
  sources: [],
  governance: LONGER_FICTION,
});
const fiction = (id: string, title: string, body: string): Record => ({
  id,
  kind: 'fiction',
  title,
  body,
  sources: [],
  governance: FICTION,
});

export const RECORDS: ChapterInput['records'] = [
  // ── Scripture references ─────────────────────────────────────────────
  scripture('rec-luke-2-1-20', 'Luke 2:1–20', [ref('Luke', 2, 1, 20)], ['src-web-luk02']),
  scripture('rec-luke-2-1-5', 'Luke 2:1–5', [ref('Luke', 2, 1, 5)], ['src-web-luk02']),
  scripture('rec-luke-2-8-20', 'Luke 2:8–20', [ref('Luke', 2, 8, 20)], ['src-web-luk02']),
  scripture('rec-luke-22-11', 'Luke 22:11', [ref('Luke', 22, 11)], ['src-web-luk22']),
  scripture('rec-matt-2-1-11', 'Matthew 2:1–11', [ref('Matthew', 2, 1, 11)], ['src-web-mat02']),
  scripture('rec-gen-18-1-8', 'Genesis 18:1–8', [ref('Genesis', 18, 1, 8)], ['src-web-gen18']),
  scripture('rec-lev-19-34', 'Leviticus 19:34', [ref('Leviticus', 19, 34)], ['src-web-lev19']),
  scripture(
    'rec-1sam-16-17',
    '1 Samuel 16:1, 11 and 17:12, 15',
    [
      ref('1 Samuel', 16, 1),
      ref('1 Samuel', 16, 11),
      ref('1 Samuel', 17, 12),
      ref('1 Samuel', 17, 15),
    ],
    ['src-web-1sa16', 'src-web-1sa17'],
  ),
  scripture(
    'rec-2sam-23-15',
    '2 Samuel 23:15–16',
    [ref('2 Samuel', 23, 15, 16)],
    ['src-web-2sa23'],
  ),
  scripture(
    'rec-ruth-bethlehem',
    'Ruth 1:1, 1:19 and 3:2',
    [ref('Ruth', 1, 1), ref('Ruth', 1, 19), ref('Ruth', 3, 2)],
    ['src-web-rut01', 'src-web-rut03'],
  ),
  scripture('rec-jer-33-13', 'Jeremiah 33:13', [ref('Jeremiah', 33, 13)], ['src-web-jer33']),
  scripture('rec-john-10-1-4', 'John 10:1–4', [ref('John', 10, 1, 4)], ['src-web-jhn10']),
  scripture('rec-ezek-16-4', 'Ezekiel 16:4', [ref('Ezekiel', 16, 4)], ['src-web-ezk16']),
  scripture('rec-mic-5-2', 'Micah 5:2', [ref('Micah', 5, 2)], ['src-web-mic05']),
  scripture('rec-acts-5-37', 'Acts 5:37', [ref('Acts', 5, 37)], ['src-web-act05']),

  // ── Paraphrases (our words, always labelled, always cited) ─────────────
  {
    id: 'rec-para-luke-2',
    kind: 'paraphrase',
    title: 'Luke 2:1–20 in our own words',
    scripture: [ref('Luke', 2, 1, 20)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-luk02'],
    body:
      'In those days the emperor, Caesar Augustus, ordered a registration of the whole world. Luke says this was the first registration, made when Quirinius governed Syria, and that everyone went to be registered in their own town. So Joseph went up from Nazareth in Galilee to Bethlehem in Judea, David’s town, because he belonged to David’s family, to be registered with Mary, who was engaged to him and expecting a child.\n\n' +
      'While they were there, Mary gave birth to her firstborn son. She wrapped the baby snugly in strips of cloth and laid him in an animals’ feeding trough, because there was no space for them in the katalyma — the place to stay.\n\n' +
      'In the same area there were shepherds living out in the fields, keeping watch over their flock at night. An angel of the Lord appeared beside them, the Lord’s glory blazed all around, and they were filled with fear. The angel told them not to be afraid: he brought good news of great joy for all the people. That very day, in David’s town, a Savior had been born — Christ the Lord. They would know him by this sign: a newborn wrapped in cloth and lying in a feeding trough. Suddenly a great company of heaven’s army was with the angel, praising God and speaking of glory to God in the highest and peace on earth.\n\n' +
      'When the angels had gone, the shepherds hurried to Bethlehem and found Mary and Joseph — and the baby, lying in the feeding trough. After they had seen him, they spread the word about what they had been told about this child, and everyone who heard was amazed at what the shepherds told them. Mary kept all these things and thought about them deeply. The shepherds went back to their flock praising God for all they had heard and seen, which was just as they had been told.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      notes:
        'Checked against the WEB text of Luke 2:1–20 (ebible.org). Adds no details the passage does not contain: no innkeeper, no stable, no ox and donkey, no magi or star.',
    }),
  },
  {
    id: 'rec-para-report',
    kind: 'paraphrase',
    title: 'Hagit repeats what the shepherds said',
    scripture: [ref('Luke', 2, 8, 20)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-luk02'],
    body: 'Hagit is a fictional neighbor retelling, in her own words, what Luke 2:8–20 says the shepherds made known about the child. Luke does not name anyone who heard the shepherds; the game invents Hagit, not the shepherds’ words. Read the passage itself in the Scripture Connection.',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },
  {
    id: 'rec-para-abraham',
    kind: 'paraphrase',
    title: 'Three measures of flour for guests',
    scripture: [ref('Genesis', 18, 6)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-gen18'],
    body: 'Tamar’s family saying is a paraphrase, not a quotation. In Genesis 18, Abraham welcomes three visitors and asks Sarah to make cakes from three seahs of fine meal (Genesis 18:6).',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },
  {
    id: 'rec-para-well',
    kind: 'paraphrase',
    title: 'David and the well of Bethlehem',
    scripture: [ref('2 Samuel', 23, 15, 16)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-2sa23'],
    body: 'Saba Amram retells 2 Samuel 23:15–16 in his own words: David longed for water from the well of Bethlehem by the gate, three of his mighty men broke through the Philistine camp to bring it, and David would not drink it but poured it out to the LORD.',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },
  {
    id: 'rec-para-david',
    kind: 'paraphrase',
    title: 'David the shepherd of Bethlehem',
    scripture: [ref('1 Samuel', 16, 11), ref('1 Samuel', 17, 15)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-1sa16', 'src-web-1sa17'],
    body: 'Saba Amram’s remark is a paraphrase: 1 Samuel 16:11 says the youngest son of Jesse was keeping the sheep, and 1 Samuel 17:15 says David went back and forth to feed his father’s sheep at Bethlehem.',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },

  {
    id: 'rec-para-ruth',
    kind: 'paraphrase',
    title: 'Naomi and Ruth come home to Bethlehem',
    scripture: [ref('Ruth', 1, 1), ref('Ruth', 1, 19), ref('Ruth', 3, 2)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-rut01', 'src-web-rut03'],
    body: 'Saba Amram retells three verses of Ruth in his own words: in the days of the judges a famine came, and a man of Bethlehem went to live in Moab with his wife and two sons (Ruth 1:1); later Naomi came back to Bethlehem with Ruth, and the whole town was stirred at their coming (1:19); and Naomi said that Boaz would be winnowing barley on the threshing floor that night (3:2). Whether Bethlehem’s threshing floor in this game is the one in the story, nobody knows; Saba says so.',
    governance: longerDraft({ confidence: 'not-applicable', sourced: true }),
  },

  // ── Historical and cultural background ─────────────────────────────────
  {
    id: 'rec-hist-census',
    kind: 'historical',
    title: 'A decree from Caesar',
    scripture: [ref('Luke', 2, 1), ref('Acts', 5, 37)],
    sources: [
      'src-web-luk02',
      'src-huebner-census',
      'src-wiki-census-quirinius',
      'src-josephus-ant',
      'src-web-act05',
    ],
    body: 'Luke’s story begins with a decree from the emperor Caesar Augustus that the world should be registered (Luke 2:1). A Roman provincial census wrote down the people of a province and what they owned, so that each person’s tax could be worked out. Not everyone accepted it: the historian Josephus says a man named Judas urged the Jews to resist a census in Judea, calling the tax a step toward slavery, and Acts 5:37 mentions a Judas of Galilee who rose up at the time of the registration.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-quirinius',
    kind: 'historical',
    title: 'When was the census?',
    scripture: [ref('Luke', 2, 2), ref('Luke', 1, 5), ref('Matthew', 2, 1)],
    sources: [
      'src-web-luk02',
      'src-web-luk01',
      'src-web-mat02',
      'src-josephus-ant',
      'src-wiki-census-quirinius',
      'src-wiki-herod',
      'src-huebner-census',
      'src-armitage-census',
    ],
    body:
      'This is an open question. Luke says this was the first registration, made while Quirinius governed Syria (Luke 2:2), and Luke and Matthew both place Jesus’ birth while King Herod was alive (Luke 1:5; Matthew 2:1). Josephus describes Quirinius taking an account of Judea after Herod’s son Archelaus was removed — which historians date to about AD 6, some ten years after Herod’s death (usually dated 4 BC; some argue 1 BC).\n\n' +
      'Scholars explain this in different ways. Many historians think Luke’s date for the census is mistaken. Others suggest an earlier registration under Herod, an earlier role for Quirinius, or reading Luke’s word “first” as “before”. No solution has convinced everyone, so this game does not treat the date as settled.',
    governance: draft({
      confidence: 'uncertain',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Touches the historical reliability of Luke. Christians hold different views; the record reports the problem and the main proposals without taking a side.',
      notes:
        'Josephus does not write “AD 6”; he dates the taxing to the 37th year after Actium (a modern conversion gives about AD 6).',
    }),
  },
  {
    id: 'rec-hist-own-city',
    kind: 'historical',
    title: 'Everyone to their own town?',
    scripture: [ref('Luke', 2, 3, 4)],
    sources: [
      'src-web-luk02',
      'src-hanson-edict',
      'src-huebner-census',
      'src-cargill-census',
      'src-wiki-census-quirinius',
    ],
    body: 'Luke says everyone went to be registered in their own town (Luke 2:3), and that Joseph went to Bethlehem because he belonged to David’s family. We have no other evidence of a Roman rule sending people back to their ancestors’ towns. An order from the governor of Egypt in AD 104 did tell people living away from their districts to return to their own homes for a census — but that was in Egypt, a century later, and probably meant the place where a household was registered. Some scholars suggest Joseph went to Bethlehem because his family owned property there. That is possible, but unproven.',
    governance: draft({
      confidence: 'uncertain',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Reports a historical question about Luke’s account; different Christian readers weigh it differently.',
    }),
  },
  {
    id: 'rec-recon-declaration',
    kind: 'reconstruction',
    title: 'What a registration might have looked like',
    sources: ['src-grammateus-census', 'src-huebner-census', 'src-bagnall-frier'],
    body: 'About 300 household census returns survive on papyrus, almost all from Roman Egypt, where the dry climate preserves them. A return named the person making the declaration (usually the head of the household) and the property, listed everyone living there with their ages, and ended with signatures and sometimes an oath that it was true. No record of Joseph’s registration is known, and we do not know exactly how registrations were written down in Judea. The clerk, his wax tablet and the order of the entries in this game are modelled on those Egyptian returns.',
    governance: draft({
      confidence: 'possible',
      sourced: true,
      notes:
        'The Egyptian contents are established; applying them to Judea is a reconstruction. Do not claim that “nothing survives from Judea” — no retrieved source says so.',
    }),
  },
  {
    id: 'rec-hist-bethlehem',
    kind: 'historical',
    title: 'Bethlehem, David’s town',
    scripture: [
      ref('Luke', 2, 4),
      ref('1 Samuel', 16, 1),
      ref('1 Samuel', 17, 12),
      ref('Ruth', 1, 1),
    ],
    sources: [
      'src-wiki-bethlehem',
      'src-web-luk02',
      'src-web-1sa16',
      'src-web-1sa17',
      'src-web-rut01',
      'src-web-2sa05',
    ],
    body: 'Bethlehem sits in the Judean hills about 10 kilometers (6 miles) south of Jerusalem, about 775 meters above sea level. David was the son of Jesse of Bethlehem and kept his father’s sheep there (1 Samuel 16–17), and the story of Ruth is set there too. Luke calls Bethlehem David’s town because it was David’s hometown. (In the Old Testament, the name usually means Zion, in Jerusalem — 2 Samuel 5:7.)',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-well',
    kind: 'historical',
    title: 'The well by the gate',
    scripture: [ref('2 Samuel', 23, 15, 16)],
    sources: ['src-web-2sa23', 'src-biblehub-2sa23-comm'],
    body: 'In 2 Samuel 23:15–16, David longs for water from the well of Bethlehem by the town gate. Nobody knows where that well was. Rock-cut cisterns north of the modern town are called “David’s Wells” by tradition, but older commentators judged them too far from the town to be a well by its gate. The well in this game is fictional.',
    governance: draft({
      confidence: 'established',
      sourced: true,
      notes:
        'Text: established. The location of the biblical well: unknown. The modern site: tradition.',
    }),
  },
  {
    id: 'rec-hist-threshing',
    kind: 'historical',
    title: 'Threshing floors',
    scripture: [ref('Ruth', 3, 2)],
    sources: ['src-wiki-threshing-floor', 'src-web-rut03'],
    body: 'A threshing floor was a flat, hard, open surface — beaten earth, paving or bare rock — where harvested grain was threshed and then winnowed, tossed up so the wind carried the chaff away. In the book of Ruth, set in Bethlehem, Boaz winnows barley at night on the threshing floor (Ruth 3:2).',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-recon-house',
    kind: 'reconstruction',
    title: 'A house with room for the animals',
    scripture: [ref('1 Samuel', 28, 24), ref('Luke', 13, 15)],
    sources: [
      'src-bailey-manger',
      'src-web-1sa28',
      'src-web-luk13',
      'src-wiki-four-room-house',
      'src-byers-manger',
    ],
    body: 'Many scholars think ordinary village houses often had one main room: the family lived and slept on a raised level, and at night the household’s animals were brought in to a lower area near the door, with feeding troughs built into the floor or at the edge of the raised level. This picture comes from village life observed in later centuries, from Bible hints — a calf kept in the house (1 Samuel 28:24), untying an ox or donkey from the stall to lead it to water (Luke 13:15) — and from much older Israelite houses whose ground floors were often used for animals. It is a reconstruction, and not all scholars agree. Tamar’s house in this game is fictional.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Bailey relies on modern ethnography (Dalman 1935) and New Testament inferences, not on excavated first-century houses from Bethlehem.',
    }),
  },
  {
    id: 'rec-hist-manger',
    kind: 'historical',
    title: 'The feeding trough',
    scripture: [ref('Luke', 2, 7), ref('Luke', 2, 12), ref('Luke', 2, 16)],
    sources: ['src-biblehub-5336', 'src-web-luk02', 'src-wiki-megiddo', 'src-byers-manger'],
    body: 'Luke’s Greek word, phatnē, means a manger — a feeding trough for animals. (The World English Bible simply says “feeding trough.”) Stone troughs have been found in ancient buildings in the land of Israel, though scholars debate what some of those buildings were for, and wooden troughs would rarely survive. Luke does not say what this one was made of.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-swaddling',
    kind: 'historical',
    title: 'Bands of cloth',
    scripture: [ref('Luke', 2, 7), ref('Ezekiel', 16, 4)],
    sources: ['src-web-luk02', 'src-web-ezk16', 'src-wiki-swaddling'],
    body: 'Mary wrapped her baby in bands of cloth (Luke 2:7). Wrapping a newborn snugly was ordinary care. Ezekiel 16:4 pictures an abandoned baby who was not washed, not rubbed with salt and not wrapped — which shows those were the normal things done for a newborn.',
    governance: draft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-shepherds',
    kind: 'historical',
    title: 'Sheep, folds and counting',
    scripture: [
      ref('John', 10, 1, 4),
      ref('Jeremiah', 33, 13),
      ref('Leviticus', 27, 32),
      ref('Luke', 2, 8),
    ],
    sources: [
      'src-web-num32',
      'src-web-jhn10',
      'src-web-jer33',
      'src-web-lev27',
      'src-isbe-sheepfold',
      'src-easton-shepherd',
      'src-web-luk02',
    ],
    body: 'Shepherds kept their flocks in folds — walled enclosures, sometimes with thorny brushwood on top — especially at night. Jesus spoke of a sheepfold with a door and a gatekeeper, where the sheep know the shepherd’s voice (John 10:1–4). The Old Testament speaks of counting animals as they passed under a rod (Leviticus 27:32), and of flocks being counted again in the towns of Judah (Jeremiah 33:13). Luke says the shepherds in his story were staying out in the field, keeping watch over their flock by night (Luke 2:8). The fold, Yonatan and Old Yoram in this game are fictional.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'The texts are established; details of practice (counting at the fold) come partly from nineteenth-century descriptions (Easton, ISBE).',
    }),
  },
  {
    id: 'rec-hist-shepherd-status',
    kind: 'historical',
    title: 'Were shepherds looked down on?',
    scripture: [ref('Psalms', 23, 1), ref('1 Samuel', 16, 11)],
    sources: [
      'src-sanhedrin-25b',
      'src-croteau-shepherds',
      'src-mowczko-shepherds',
      'src-web-psa023',
      'src-web-1sa16',
    ],
    body: 'You may hear that shepherds in Jesus’ day were despised and not allowed to be witnesses. That idea comes mostly from rabbinic writings set down long after the first century, which disqualified shepherds who let their flocks graze on other people’s land. Several scholars say there is no first-century evidence that shepherds were outcasts. The Bible often honors shepherds — David was one, and Psalm 23 calls God a shepherd. Shepherds were ordinary working people; exactly how others saw them in Luke’s day is uncertain.',
    governance: draft({
      confidence: 'uncertain',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Interfaith care: later rabbinic texts are reported accurately and in context, not used to caricature Jewish attitudes.',
    }),
  },
  {
    id: 'rec-hist-hospitality',
    kind: 'historical',
    title: 'Welcoming guests',
    scripture: [ref('Genesis', 18, 1, 8), ref('Leviticus', 19, 34), ref('Luke', 7, 44)],
    sources: ['src-web-gen18', 'src-wiki-seah', 'src-web-lev19', 'src-web-luk07'],
    body: 'The Bible treats welcoming guests as something that matters. Abraham runs to meet three visitors, offers water to wash their feet and has cakes made from three seahs of fine flour — a very generous amount (Genesis 18:1–8). Nobody knows exactly how big a seah was; estimates run from about 7 liters to more than 14. Israel was told to love the foreigner living among them as themselves (Leviticus 19:34), and Jesus once noticed that his host had given him no water for his feet (Luke 7:44). Tamar’s supper in this game is made up.',
    governance: draft({
      confidence: 'established',
      sourced: true,
      notes: 'Texts: established. The seah’s volume: uncertain.',
    }),
  },
  {
    id: 'rec-hist-terraces',
    kind: 'historical',
    title: 'Terraced hillsides',
    sources: ['src-unesco-battir', 'src-wiki-terrace'],
    body: 'Farmers in the hills around Jerusalem and Bethlehem have long built dry-stone terraces to hold soil for vines, olives and gardens. The terraced valleys of Battir, a few kilometers from Bethlehem, became a UNESCO World Heritage Site in 2014. It is hard to know how old any particular terrace is: dating near Jerusalem has found many built long after Bible times. The terraces in this game are fictional.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-cave',
    kind: 'historical',
    title: 'A cave in Bethlehem',
    scripture: [ref('Luke', 2, 7)],
    sources: [
      'src-justin-dialogue-78',
      'src-origen-celsum',
      'src-wiki-church-nativity',
      'src-web-luk02',
    ],
    body: 'Luke mentions a feeding trough, but no cave or stable. A very old Christian tradition says Jesus was born in a cave near Bethlehem: Justin Martyr wrote this in the second century, and Origen, around AD 248, said the cave was being shown to visitors. The emperor Constantine had the Church of the Nativity built over that cave, the Grotto of the Nativity; it was dedicated in AD 339 and rebuilt in the sixth century.',
    governance: draft({
      confidence: 'tradition',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'A cherished tradition for many Christians; presented as tradition, neither dismissed nor stated as fact.',
    }),
  },
  {
    id: 'rec-hist-fields',
    kind: 'historical',
    title: 'Shepherds’ Field',
    scripture: [ref('Luke', 2, 8)],
    sources: ['src-web-luk02', 'src-wiki-beit-sahour'],
    body: 'Luke says only that there were shepherds staying out in the fields nearby (Luke 2:8). Christian tradition places the angels’ announcement at Beit Sahour, just east of Bethlehem, where more than one church marks a “Shepherds’ Field.” The exact place is not known.',
    governance: draft({ confidence: 'tradition', sourced: true }),
  },
  {
    id: 'rec-hist-nights',
    kind: 'historical',
    title: 'Cold nights in the hills',
    sources: ['src-wiki-bethlehem'],
    body: 'Bethlehem has hot, dry summers and cool, rainy winters. Modern measurements put average winter night-time lows at around 6–8 °C (the mid-40s °F), so nights in the hills can feel cold. These are modern figures, and Luke does not say what season it was.',
    governance: draft({ confidence: 'established', sourced: true }),
  },

  // ── Interpretation (labelled; traditions may differ) ───────────────────
  {
    id: 'rec-interp-katalyma',
    kind: 'interpretation',
    title: 'An inn, or a guest room?',
    scripture: [ref('Luke', 2, 7), ref('Luke', 22, 11), ref('Luke', 10, 34)],
    sources: [
      'src-sblgnt-luk02',
      'src-sblgnt-luk22',
      'src-sblgnt-luk10',
      'src-biblehub-2646',
      'src-biblehub-3829',
      'src-biblegateway-luk2-7',
      'src-bailey-manger',
      'src-carlson-katalyma',
      'src-wiki-nativity',
    ],
    body: 'Luke says there was no room for them in the katalyma (Luke 2:7). Luke uses the same Greek word for the “guest room” where Jesus later ate the Passover (Luke 22:11), and a different word, pandocheion, for the inn in the story of the Good Samaritan (Luke 10:34). So Bibles differ: some say “inn” (for example the KJV, ESV, NRSV and the World English Bible), others “guest room” (NIV, CSB) or “lodging” (NLT). Kenneth Bailey argued for a family’s guest room; Stephen Carlson argues for a more general “place to stay.” Many Christians still picture an inn. No one can be certain which Luke meant — and Luke never mentions an innkeeper.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'The inn and innkeeper are loved parts of many Christmas traditions and plays. Presented as a question of translation, without mocking any tradition.',
    }),
  },
  {
    id: 'rec-interp-date',
    kind: 'interpretation',
    title: 'When was Jesus born?',
    scripture: [ref('Luke', 2, 8)],
    sources: ['src-wiki-date-birth', 'src-wiki-chronograph-354', 'src-web-luk02'],
    body: 'Neither Luke nor Matthew gives the day or month of Jesus’ birth. The oldest firm evidence for celebrating it on 25 December is a Roman calendar book, the Chronograph of 354, whose list is usually dated to AD 336; why that day was chosen is debated. Some readers think shepherds staying out in the fields at night suggests a warmer season; others reply that this does not settle it. Most historians place the birth a few years before AD 1. Christians celebrate the birth without needing to know the exact date.',
    governance: draft({
      confidence: 'uncertain',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Churches keep Christmas in different ways and on different calendars; the record does not judge any of them.',
    }),
  },
  {
    id: 'rec-interp-two-accounts',
    kind: 'interpretation',
    title: 'Luke’s account and Matthew’s',
    scripture: [ref('Matthew', 2, 1, 11), ref('Micah', 5, 2), ref('Luke', 2, 8, 16)],
    sources: [
      'src-web-mat02',
      'src-web-mic05',
      'src-wiki-biblical-magi',
      'src-wiki-nativity',
      'src-justin-dialogue-78',
    ],
    body: 'The wise men (magi) and the star come from Matthew’s Gospel, not Luke’s. Matthew says the wise men came into a house and found the young child with Mary, and he quotes the prophet Micah about Bethlehem (Micah 5:2). Luke tells of the shepherds and the feeding trough and does not quote Micah. Nativity scenes usually put both accounts together in one picture, and Christians have read them side by side since at least the second century. This chapter follows Luke, so there is no star and no wise men in it.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Christians read the two accounts together in different ways; the record describes what each Gospel says.',
    }),
  },
  {
    id: 'rec-interp-good-news',
    kind: 'interpretation',
    title: 'Good news for all the people',
    scripture: [ref('Luke', 2, 10, 14)],
    sources: ['src-web-luk02'],
    body: 'In Luke’s story, the angel calls the message good news of great joy for all the people: a Savior, who is Christ the Lord, born in David’s town (Luke 2:10–11). Christians across many traditions read this as the heart of the passage. Many notice where Luke tells it: an emperor’s decree fills a small town, a newborn lies in a feeding trough, and the news comes first to shepherds working through the night. Readers weigh these details differently, but most agree Luke wants his readers to notice them.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'A widely shared Christian reading; presented as interpretation, not the only reading.',
    }),
  },
  {
    id: 'rec-interp-wonder',
    kind: 'interpretation',
    title: 'Wondering and pondering',
    scripture: [ref('Luke', 2, 18, 20)],
    sources: ['src-web-luk02'],
    body: 'Luke shows people responding in different ways. All who heard the shepherds wondered at what they said. Mary kept all these things and thought about them deeply. The shepherds went back glorifying and praising God. Many readers see an invitation in this: to wonder, to keep thinking, and to give thanks — not to have everything figured out at once.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Traditions differ in how they honor Mary; this record stays with what Luke says she did.',
    }),
  },

  // ── Fiction: people ────────────────────────────────────────────────────
  fiction(
    'rec-p-tamar',
    'Tamar',
    'Your mother. She runs a house in Bethlehem that is fuller today than it has ever been, and she is determined that every guest gets bread and a place to sleep.',
  ),
  fiction(
    'rec-p-amram',
    'Saba Amram',
    'Your grandfather. He knows every family in Bethlehem, which is why the registration clerk wants him close by.',
  ),
  fiction(
    'rec-p-asa',
    'Uncle Asa',
    'Your mother’s brother, a stonemason who lives in Jerusalem. His family belongs to Bethlehem, so he has come to be registered here — and has been standing in line since midday.',
  ),
  fiction(
    'rec-p-peninah',
    'Aunt Peninah',
    'Uncle Asa’s wife. She walked from Jerusalem this morning with little Dodi and would like nothing more than a quiet corner.',
  ),
  fiction(
    'rec-p-dodi',
    'Dodi',
    'Your little cousin. He is two, and asleep whenever he is not running.',
  ),
  fiction(
    'rec-p-kallias',
    'Kallias',
    'A scribe writing down the registration at a table in the square. He has been saying “Name? Household? Property?” since dawn.',
  ),
  fiction(
    'rec-p-hagit',
    'Hagit',
    'An old neighbor who lives alone with her goats. She notices everything that goes past her door.',
  ),
  fiction(
    'rec-p-yonatan',
    'Cousin Yonatan',
    'Your older cousin, who keeps the family’s sheep with the village flock at a fold on the terraces below the village.',
  ),
  fiction(
    'rec-p-yoram',
    'Old Yoram',
    'An old shepherd who has kept the village flock since he was smaller than you. His knees are bad; his eyes are not.',
  ),
  fiction(
    'rec-p-zerah',
    'Zerah',
    'An old basket-maker from Tekoa who came to Bethlehem to be registered and arrived after dark with nowhere to sleep.',
  ),

  // ── Fiction: events and places ─────────────────────────────────────────
  fiction(
    'rec-e-mission',
    'A house full of guests',
    'The emperor’s registration brought your relatives home to Bethlehem. Your mother asked you to bake bread, make room in the guest room, and take your cousin his supper at the sheepfold.',
  ),
  fiction(
    'rec-e-registration',
    'The long line',
    'All afternoon, families waited in the square while a clerk wrote down each household. Uncle Asa waited longest of all.',
  ),
  fiction(
    'rec-e-lamb',
    'The lost lamb',
    'At dusk, when Yonatan counted the flock into the fold, one lamb was missing: the speckled one with the black ear.',
  ),
  fiction(
    'rec-e-stranger',
    'A knock at the door',
    'After dark, an old man named Zerah knocked at the door. Every house he had tried was full.',
  ),
  fiction(
    'rec-e-news',
    'News in the night',
    'Late in the night, your neighbor Hagit came to the door with what shepherds from the fields had been telling everyone.',
  ),
  fiction(
    'rec-pl-house',
    'Tamar’s house',
    'A fictional village house in Bethlehem: a raised floor where the family lives, a lower end where the animals sleep, stone feeding troughs between them, and a small guest room.',
  ),
  fiction(
    'rec-pl-lanes',
    'The lanes of Bethlehem',
    'A fictional picture of the village crowded for the registration: houses, a square by the gate, a well, and a threshing floor at the edge.',
  ),
  fiction(
    'rec-pl-fields',
    'The fold on the terraces',
    'A fictional sheepfold on the terraces below the village, where your family’s sheep spend the night with the village flock. It is not meant to be the place in Luke’s story.',
  ),

  // ── Added when the chapter was made longer (in review) ─────────────────
  newFiction(
    'rec-e-kid',
    'Hagit’s runaway kid',
    'When you asked Hagit for milk for Dodi, her little white kid was out in the lanes again, and she couldn’t chase it on her old knees. You asked who had seen it and worked out where it had gone.',
  ),
  newFiction(
    'rec-e-supper',
    'Supper by the fire',
    'At nightfall the whole household ate Tamar’s bread around the eating mat, in the places you had set, and heard about your day. There was one loaf left, and Tamar let you decide what to do with it.',
  ),
];

import type { ChapterInput } from '@/domain/chapter';
import { SOURCES as SHARED_SOURCES } from '../../shared/sources';

/**
 * Sources for "A Journey to Bethlehem". Every entry below was retrieved and
 * checked against the claim it supports by an AI research assistant on
 * 2026-09-25 (claim-by-claim notes: docs/research/journey-to-bethlehem-sources.md).
 * `verified: true` records THAT retrieval. A human editor must still confirm
 * each citation before any record is approved.
 */
const ACCESSED = '2026-09-25';
const NOTE =
  'Retrieved and checked by an AI research assistant on 2026-09-25; awaiting human citation verification.';

type Source = ChapterInput['sources'][number];

const web = (id: string, book: string, file: string, locator: string): Source => ({
  id,
  title: `World English Bible, ${book}`,
  kind: 'scripture',
  url: `https://ebible.org/eng-web/${file}.htm`,
  locator,
  accessed: ACCESSED,
  verified: true,
  note: NOTE,
});

const source = (s: Omit<Source, 'accessed' | 'verified'> & { note?: string }): Source => ({
  accessed: ACCESSED,
  verified: true,
  ...s,
  note: s.note ? `${s.note} ${NOTE}` : NOTE,
});

const CHAPTER_SOURCES: Source[] = [
  // ── Scripture (World English Bible, public domain, eBible.org) ─────────
  web('src-web-luk02', 'Luke 2', 'LUK02', '2:1–20'),
  web('src-web-luk01', 'Luke 1', 'LUK01', '1:5'),
  web('src-web-luk07', 'Luke 7', 'LUK07', '7:44'),
  web('src-web-luk13', 'Luke 13', 'LUK13', '13:15'),
  web('src-web-luk22', 'Luke 22', 'LUK22', '22:11 (“guest room”)'),
  web('src-web-mat02', 'Matthew 2', 'MAT02', '2:1–11, 2:16'),
  web('src-web-act05', 'Acts 5', 'ACT05', '5:37'),
  web('src-web-mic05', 'Micah 5', 'MIC05', '5:2'),
  web('src-web-gen18', 'Genesis 18', 'GEN18', '18:1–8 (footnote on the seah)'),
  web('src-web-1sa16', '1 Samuel 16', '1SA16', '16:1, 16:11'),
  web('src-web-1sa17', '1 Samuel 17', '1SA17', '17:12, 17:15, 17:34'),
  web('src-web-1sa28', '1 Samuel 28', '1SA28', '28:24'),
  web('src-web-2sa05', '2 Samuel 5', '2SA05', '5:7'),
  web('src-web-2sa23', '2 Samuel 23', '2SA23', '23:15–16'),
  web('src-web-rut01', 'Ruth 1', 'RUT01', '1:1, 1:19, 1:22'),
  web('src-web-rut03', 'Ruth 3', 'RUT03', '3:2–3'),
  web('src-web-jhn10', 'John 10', 'JHN10', '10:1–4'),
  web('src-web-jer33', 'Jeremiah 33', 'JER33', '33:13'),
  web('src-web-lev27', 'Leviticus 27', 'LEV27', '27:32'),
  web('src-web-num32', 'Numbers 32', 'NUM32', '32:16'),
  web('src-web-ezk16', 'Ezekiel 16', 'EZK16', '16:4'),
  web('src-web-psa023', 'Psalm 23', 'PSA023', '23:1'),
  source({
    id: 'src-sblgnt-luk02',
    title: 'SBL Greek New Testament, Luke 2 (CC BY 4.0)',
    kind: 'scripture',
    url: 'https://ebible.org/grcsbl/LUK02.htm',
    locator: '2:7 (ἐν τῷ καταλύματι)',
    note: 'Greek καταλύματι in 2:7.',
  }),
  source({
    id: 'src-sblgnt-luk22',
    title: 'SBL Greek New Testament, Luke 22 (CC BY 4.0)',
    kind: 'scripture',
    url: 'https://ebible.org/grcsbl/LUK22.htm',
    locator: '22:11 (τὸ κατάλυμα)',
    note: 'The same word, κατάλυμα, for the guest room in 22:11.',
  }),

  // ── Ancient sources ───────────────────────────────────────────────────
  source({
    id: 'src-josephus-ant',
    title: 'Josephus, Antiquities of the Jews (Whiston translation, Project Gutenberg #2848)',
    kind: 'ancient-primary',
    author: 'Flavius Josephus',
    url: 'https://www.gutenberg.org/cache/epub/2848/pg2848.txt',
    locator: 'Whiston 17.13.2, 17.13.5, 18.1.1, 18.2.1',
    note: 'Quirinius (“Cyrenius”) sent “to take an account of their substance”; the taxings made “in the thirty-seventh year of Cæsar’s victory over Antony at Actium”; Judas’s resistance.',
  }),
  source({
    id: 'src-hanson-edict',
    title: 'K. C. Hanson, “Census Edict for Roman Egypt” (P. London 904, AD 104)',
    kind: 'ancient-primary',
    author: 'Gaius Vibius Maximus, prefect of Egypt (tr. adapted from Hunt & Edgar)',
    url: 'https://www.kchanson.com/ANCDOCS/greek/census.html',
    locator: 'Translation, opening sentence',
    note: '“…all those who are away from their nomes be summoned to return to their own hearths.”',
  }),
  source({
    id: 'src-justin-dialogue-78',
    title: 'Justin Martyr, Dialogue with Trypho, chapter 78 (ANF vol. 1, New Advent)',
    kind: 'ancient-primary',
    author: 'Justin Martyr',
    url: 'https://www.newadvent.org/fathers/01286.htm',
    locator: 'Chapter 78',
    note: 'Joseph “took up his quarters in a certain cave near the village”.',
  }),
  source({
    id: 'src-origen-celsum',
    title: 'Origen, Against Celsus I.51 (ANF vol. 4, New Advent)',
    kind: 'ancient-primary',
    author: 'Origen',
    url: 'https://www.newadvent.org/fathers/04161.htm',
    locator: 'Book I, chapter 51',
    note: '“…there is shown at Bethlehem the cave where He was born”.',
  }),
  source({
    id: 'src-sanhedrin-25b',
    title: 'Babylonian Talmud, Sanhedrin 25b (William Davidson edition, Sefaria)',
    kind: 'ancient-primary',
    url: 'https://www.sefaria.org/api/texts/Sanhedrin.25b.16-17',
    locator: 'Sanhedrin 25b:16–18',
    note: 'Shepherds were later disqualified as witnesses because they let flocks graze in others’ fields. Compiled centuries after the first century.',
  }),

  // ── Scholarship and reference works ───────────────────────────────────
  source({
    id: 'src-huebner-census',
    title:
      'Sabine R. Huebner, “‘In those days a decree went out …’”, in Papyri and the Social World of the New Testament (Cambridge UP, 2019), ch. III',
    kind: 'scholarly',
    author: 'Sabine R. Huebner',
    url: 'https://www.cambridge.org/core/books/abs/papyri-and-the-social-world-of-the-new-testament/in-those-days-a-decree-went-out/7D9BD3CA2D29EF513B7805F8FFE28ECB',
    locator: 'Sections “Dating of the Census” and “Return to One’s Own Town” (publisher extract)',
  }),
  source({
    id: 'src-grammateus-census',
    title:
      'Ferretti, Fogarty, Nury & Schubert, “Census Declaration” (grammateus project, University of Geneva)',
    kind: 'scholarly',
    url: 'https://grammateus.unige.ch/descriptions/decl_census',
    locator: 'Paragraphs 1–3 (“Structure”)',
    note: '“about 300 census returns from 3 BCE to 259 CE”; a 14-year cycle from 33/34 CE; declarant usually the male head of household; may end with an oath and signatures.',
  }),
  source({
    id: 'src-bagnall-frier',
    title:
      'Roger S. Bagnall and Bruce W. Frier, The Demography of Roman Egypt (Cambridge UP, 1994), ch. 1 “The census returns”',
    kind: 'scholarly',
    url: 'https://www.cambridge.org/core/books/abs/demography-of-roman-egypt/census-returns/2AB2678F04674AF62220B03C7B0E50A9',
    locator: 'Chapter 1 abstract',
  }),
  source({
    id: 'src-armitage-census',
    title: 'David Armitage, “Was Luke wrong about the census?” (Tyndale House, 21 December 2022)',
    kind: 'scholarly',
    author: 'David Armitage',
    url: 'https://tyndalehouse.com/2022/12/21/was-luke-wrong-about-the-census/',
    locator: 'Section “Has Luke been misunderstood about the date of the census?”',
  }),
  source({
    id: 'src-cargill-census',
    title:
      'Robert R. Cargill, “Can You Explain the Problem with the Census in the Gospel of Luke’s Story of the Birth of Jesus?” (University of Iowa, Bible & Archaeology)',
    kind: 'scholarly',
    author: 'Robert R. Cargill',
    url: 'https://bam.sites.uiowa.edu/faq/can-you-explain-problem-census-gospel-luke',
    locator: 'FAQ answer',
  }),
  source({
    id: 'src-carlson-katalyma',
    title:
      'Stephen C. Carlson, “The Accommodations of Joseph and Mary in Bethlehem: Κατάλυμα in Luke 2.7”, New Testament Studies 56.3 (2010) 326–342',
    kind: 'scholarly',
    author: 'Stephen C. Carlson',
    url: 'https://www.cambridge.org/core/journals/new-testament-studies/article/abs/accommodations-of-joseph-and-mary-in-bethlehem-in-luke-27/E60EB9AEE5215FC0C989DE635DC80A7B',
    locator: 'Abstract',
    note: 'Argues for a generic “place to stay”, in context a room too small for giving birth.',
  }),
  source({
    id: 'src-bailey-manger',
    title:
      'Kenneth E. Bailey, “The Manger and the Inn: The Cultural Background of Luke 2:7” (Theological Review 2, 1979; reprinted by the Associates for Biblical Research)',
    kind: 'scholarly',
    author: 'Kenneth E. Bailey',
    url: 'https://biblearchaeology.org/research-articles/the-manger-and-the-inn/',
    locator:
      'Sections quoting Dalman on the raised terrace and mangers; on kataluma as “guest room”',
  }),
  source({
    id: 'src-byers-manger',
    title:
      'Gary Byers, “Away in a Manger, But Not in a Barn” (Associates for Biblical Research, 15 November 2021)',
    kind: 'web',
    author: 'Gary Byers',
    url: 'https://biblearchaeology.org/research-articles/away-in-a-manger-but-not-in-a-barn-an-archaeological-look-at-the-nativity/',
    locator: 'Article body',
  }),
  source({
    id: 'src-biblehub-2646',
    title: 'BibleHub Greek lexicon G2646, κατάλυμα',
    kind: 'reference-work',
    url: 'https://biblehub.com/greek/2646.htm',
    locator: 'Definition and occurrences (Mark 14:14; Luke 2:7; 22:11)',
  }),
  source({
    id: 'src-biblehub-3829',
    title: 'BibleHub Greek lexicon G3829, πανδοχεῖον',
    kind: 'reference-work',
    url: 'https://biblehub.com/greek/3829.htm',
    locator: 'Definition and occurrence (Luke 10:34)',
  }),
  source({
    id: 'src-biblehub-5336',
    title: 'BibleHub Greek lexicon G5336, φάτνη',
    kind: 'reference-work',
    url: 'https://biblehub.com/greek/5336.htm',
    locator: 'Definition and occurrences (Luke 2:7, 12, 16; 13:15)',
  }),
  source({
    id: 'src-biblegateway-luk2-7',
    title: 'BibleGateway, Luke 2:7 in many translations',
    kind: 'web',
    url: 'https://www.biblegateway.com/verse/en/Luke%202%3A7',
    locator: 'KJV, ESV, NRSV, NLT, CSB, NIV renderings',
  }),
  source({
    id: 'src-croteau-shepherds',
    title:
      'David Croteau, “Christmas Urban Legends: Shepherds as Outcasts” (Lifeway Research, 17 December 2015)',
    kind: 'web',
    author: 'David Croteau',
    url: 'https://research.lifeway.com/2015/12/17/christmas-urban-legends-shepherds-as-outcasts/',
    locator: 'Article body',
  }),
  source({
    id: 'src-mowczko-shepherds',
    title: 'Marg Mowczko, “Were Shepherds Despised Outcasts in Jesus’s time?” (11 November 2025)',
    kind: 'web',
    author: 'Marg Mowczko',
    url: 'https://margmowczko.com/shepherds-despised-outcasts/',
    locator: 'Article body (on Jeremias’s sources)',
  }),
  source({
    id: 'src-easton-shepherd',
    title: 'Easton’s Bible Dictionary (1897), “Shepherd”',
    kind: 'reference-work',
    url: 'https://www.biblestudytools.com/dictionaries/eastons-bible-dictionary/shepherd.html',
    locator: 'Entry “Shepherd”',
    note: 'Describes nineteenth-century observed practice of counting the flock “under the rod” at the fold.',
  }),
  source({
    id: 'src-isbe-sheepfold',
    title: 'International Standard Bible Encyclopedia, “Sheepcote; Sheepfold” (James A. Patch)',
    kind: 'reference-work',
    author: 'James A. Patch',
    url: 'https://www.internationalstandardbible.com/S/sheepcote-sheepfold.html',
    locator: 'Entry body',
  }),
  source({
    id: 'src-biblehub-2sa23-comm',
    title: 'BibleHub commentaries on 2 Samuel 23:15 (Cambridge Bible; Pulpit Commentary)',
    kind: 'reference-work',
    url: 'https://biblehub.com/commentaries/2_samuel/23-15.htm',
    locator: 'Cambridge Bible and Pulpit Commentary notes',
    note: 'Both judge the traditional “David’s well” too far from the town to be the well “by the gate”.',
  }),

  // ── Encyclopedias and heritage bodies ─────────────────────────────────
  source({
    id: 'src-wiki-bethlehem',
    title: 'Wikipedia, “Bethlehem”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Bethlehem',
    locator: 'Lead; Geography; Climate table (Palestinian Meteorological Department)',
  }),
  source({
    id: 'src-wiki-census-quirinius',
    title: 'Wikipedia, “Census of Quirinius”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Census_of_Quirinius',
    locator: 'Lead; Overview; Gospel of Luke; Attempted defences',
  }),
  source({
    id: 'src-wiki-herod',
    title: 'Wikipedia, “Herod the Great”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Herod_the_Great',
    locator: 'Section “Year of death: 4 or 1 BCE”',
  }),
  source({
    id: 'src-wiki-date-birth',
    title: 'Wikipedia, “Date of the birth of Jesus”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Date_of_the_birth_of_Jesus',
    locator: 'Lead; “Choice of 25 December”; “Season of birth”',
  }),
  source({
    id: 'src-wiki-chronograph-354',
    title: 'Wikipedia, “Chronograph of 354”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Chronograph_of_354',
    locator: 'Part 12',
  }),
  source({
    id: 'src-wiki-biblical-magi',
    title: 'Wikipedia, “Biblical Magi”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Biblical_Magi',
    locator: 'Lead',
  }),
  source({
    id: 'src-wiki-nativity',
    title: 'Wikipedia, “Nativity of Jesus”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Nativity_of_Jesus',
    locator: 'Gospel accounts; Date and place of birth',
  }),
  source({
    id: 'src-wiki-church-nativity',
    title: 'Wikipedia, “Church of the Nativity”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Church_of_the_Nativity',
    locator: 'Lead; Constantine; Grotto of the Nativity',
  }),
  source({
    id: 'src-wiki-beit-sahour',
    title: 'Wikipedia, “Beit Sahour”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Beit_Sahour',
    locator: 'Lead',
  }),
  source({
    id: 'src-wiki-threshing-floor',
    title: 'Wikipedia, “Threshing floor”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Threshing_floor',
    locator: 'Lead and description',
  }),
  source({
    id: 'src-wiki-four-room-house',
    title: 'Wikipedia, “Four-room house”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Four-room_house',
    locator: 'Lead',
  }),
  source({
    id: 'src-wiki-megiddo',
    title: 'Wikipedia, “Tel Megiddo”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Tel_Megiddo',
    locator: 'Stables / storehouses discussion',
  }),
  source({
    id: 'src-wiki-swaddling',
    title: 'Wikipedia, “Swaddling”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Swaddling',
    locator: 'Origin and history',
  }),
  source({
    id: 'src-wiki-seah',
    title: 'Wikipedia, “Seah (unit)”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Seah_(unit)',
    locator: 'Estimates of volume',
  }),
  source({
    id: 'src-wiki-terrace',
    title: 'Wikipedia, “Terrace (earthworks)”',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Terrace_(earthworks)',
    locator: 'Israel section',
  }),
  source({
    id: 'src-unesco-battir',
    title:
      'UNESCO, “Palestine: Land of Olives and Vines – Cultural Landscape of Southern Jerusalem, Battir, inscribed on World Heritage List” (20 June 2014)',
    kind: 'web',
    url: 'https://www.unesco.org/en/articles/palestine-land-olives-and-vines-cultural-landscape-southern-jerusalem-battir-inscribed-world',
    locator: 'News article',
  }),
];

/** Shared sources this chapter also cites (Luke 10, Leviticus 19, the SBLGNT of Luke 10). */
const SHARED_IDS = new Set(['src-web-luk10', 'src-web-lev19', 'src-sblgnt-luk10']);

export const SOURCES: ChapterInput['sources'] = [
  ...CHAPTER_SOURCES,
  ...SHARED_SOURCES.filter((s) => SHARED_IDS.has(s.id)),
];

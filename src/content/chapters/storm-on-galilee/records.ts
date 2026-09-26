import type { ChapterInput } from '@/domain/chapter';
import type { ScriptureRef } from '@/domain/scripture';
import { draft, STORY } from './governance';

/**
 * Content records for "A Storm on Galilee".
 *
 * Kinds are explicit so the UI can label every paragraph. Scripture records
 * carry REFERENCES only; verse text comes from the ScriptureTextProvider
 * (placeholder unless an approved translation is enabled). Educational
 * records cite sources from ./sources.ts and state confidence. Claim-by-
 * claim research notes: docs/research/storm-on-galilee-sources.md.
 */
const ref = (
  book: ScriptureRef['book'],
  chapter: number,
  verseStart: number,
  verseEnd?: number,
): ScriptureRef =>
  verseEnd === undefined ? { book, chapter, verseStart } : { book, chapter, verseStart, verseEnd };

type RecordInput = ChapterInput['records'][number];

const SCRIPTURE_REF = draft({ confidence: 'not-applicable', sourced: true, ageLevel: 'all' });

const scripture = (
  id: string,
  title: string,
  refs: ScriptureRef[],
  sources: string[],
): RecordInput => ({
  id,
  kind: 'scripture',
  title,
  scripture: refs,
  sources,
  governance: SCRIPTURE_REF,
});

const fiction = (id: string, title: string, body: string): RecordInput => ({
  id,
  kind: 'fiction',
  title,
  body,
  sources: [],
  governance: STORY,
});

export const RECORDS: ChapterInput['records'] = [
  // ── Scripture references ─────────────────────────────────────────────
  scripture(
    'rec-mark-4-35-41',
    'Mark 4:35–41',
    [ref('Mark', 4, 35, 41)],
    ['src-web-mrk04', 'src-sblgnt-mrk04'],
  ),
  scripture('rec-matt-8-23-27', 'Matthew 8:23–27', [ref('Matthew', 8, 23, 27)], ['src-web-mat08']),
  scripture(
    'rec-luke-8-22-25',
    'Luke 8:22–25',
    [ref('Luke', 8, 22, 25)],
    ['src-web-luk08', 'src-sblgnt-luk08'],
  ),
  scripture('rec-mark-4-1-9', 'Mark 4:1–9', [ref('Mark', 4, 1, 9)], ['src-web-mrk04']),
  scripture('rec-mark-5-1', 'Mark 5:1', [ref('Mark', 5, 1)], ['src-web-mrk05']),
  scripture('rec-mark-1-16-21', 'Mark 1:16–21', [ref('Mark', 1, 16, 21)], ['src-web-mrk01']),
  scripture('rec-luke-5-1-11', 'Luke 5:1–11', [ref('Luke', 5, 1, 11)], ['src-web-luk05']),
  scripture(
    'rec-matt-4-13-18',
    'Matthew 4:13 and 4:18',
    [ref('Matthew', 4, 13), ref('Matthew', 4, 18)],
    ['src-web-mat04'],
  ),
  scripture('rec-mark-2-1-4', 'Mark 2:1–4', [ref('Mark', 2, 1, 4)], ['src-web-mrk02']),
  scripture(
    'rec-psalm-107-23-30',
    'Psalm 107:23–30',
    [ref('Psalms', 107, 23, 30)],
    ['src-web-psa107'],
  ),
  scripture('rec-psalm-89-9', 'Psalm 89:9', [ref('Psalms', 89, 9)], ['src-web-psa089']),
  scripture('rec-jonah-1-4-6', 'Jonah 1:4–6', [ref('Jonah', 1, 4, 6)], ['src-web-jon01']),
  scripture(
    'rec-matt-13-47-48',
    'Matthew 13:47–48',
    [ref('Matthew', 13, 47, 48)],
    ['src-web-mat13'],
  ),
  scripture(
    'rec-lev-11-9-12',
    'Leviticus 11:9–12',
    [ref('Leviticus', 11, 9, 12)],
    ['src-web-lev11'],
  ),

  // ── Paraphrases (our words, always labelled, always cited) ─────────────
  {
    id: 'rec-para-mark-4',
    kind: 'paraphrase',
    title: 'The story in our own words',
    scripture: [ref('Mark', 4, 35, 41)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-mrk04'],
    body:
      'That day, when evening came, Jesus said to his disciples that they should go over to the other side of the lake. They left the crowd and took him with them in the boat, just as he was. Other small boats were with him.\n\n' +
      'A great windstorm arose, and the waves broke into the boat until it was nearly full. Jesus was in the stern, asleep on the cushion. The disciples woke him and asked whether he didn’t care that they were dying.\n\n' +
      'He got up, rebuked the wind, and told the sea to be still. The wind stopped, and there was a great calm. He asked them why they were so afraid, and why they had no faith. They were filled with fear, and asked one another who he could be, that even the wind and the sea obeyed him.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      notes:
        'Paraphrase checked against the WEB text of Mark 4:35–41 (fetched verbatim). Jesus’ words are given in indirect speech so nothing is presented as a quotation. Adds no details the text does not contain (for example, it does not say what happened to the other boats).',
    }),
  },
  {
    id: 'rec-para-shore',
    kind: 'paraphrase',
    title: 'Teaching from a boat',
    scripture: [ref('Mark', 4, 1, 2)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-mrk04'],
    body: 'Grandmother Shelomit is fictional. Her words about the teacher speaking from a boat retell Mark 4:1–2 in our own words: such a great crowd gathered by the lake that he got into a boat on the water and sat down, and taught them from it while they stayed on the shore.',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },
  {
    id: 'rec-para-dinah',
    kind: 'paraphrase',
    title: 'A story about a sower',
    scripture: [ref('Mark', 4, 3, 8)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-mrk04'],
    body: 'Dinah is a fictional listener. She mentions one of the parables Mark says Jesus told from the boat that day: a farmer went out to sow, and his seed fell on different kinds of ground (Mark 4:3–8). She does not retell it word for word — read it for yourself in Mark 4.',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },
  {
    id: 'rec-para-evening',
    kind: 'paraphrase',
    title: 'Evening on the shore',
    scripture: [ref('Mark', 4, 35, 36)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-mrk04'],
    body: 'The narrator’s words about the evening retell Mark 4:35–36 in our own words: when evening came, the disciples left the crowd and took Jesus with them in the boat, just as he was, to cross to the other side, and other boats went with him. Mark does not say who was in the other boats. Your family’s boat is fiction.',
    governance: draft({ confidence: 'not-applicable', sourced: true }),
  },

  // ── Historical and cultural background ─────────────────────────────────
  {
    id: 'rec-hist-lake',
    kind: 'historical',
    title: 'A lake below sea level',
    scripture: [ref('Luke', 5, 1), ref('Luke', 8, 22, 23)],
    sources: [
      'src-wiki-sea-of-galilee',
      'src-bibleplaces-sea',
      'src-josephus-war-lake',
      'src-web-luk05',
      'src-web-luk08',
    ],
    body: 'The Sea of Galilee is a freshwater lake about 21 kilometers (13 miles) long and 11 to 13 kilometers wide. It lies in the Jordan Rift Valley, about 210 meters (nearly 700 feet) below sea level, with the hills of Galilee to the west and the Golan Heights to the east. At its deepest it is about 43 meters. The first-century historian Josephus praised its water as sweet and good to drink. Mark and Matthew call it a “sea”; Luke calls it a “lake” — once, “the lake of Gennesaret” (Luke 5:1).',
    governance: draft({
      confidence: 'established',
      sourced: true,
      notes: 'Measurements vary with the lake level and between sources; stated as approximate.',
    }),
  },
  {
    id: 'rec-hist-storms',
    kind: 'historical',
    title: 'Why storms rush onto the lake',
    scripture: [ref('Luke', 8, 23)],
    sources: [
      'src-alpert-1982',
      'src-bitan-1981',
      'src-saaroni-1998',
      'src-bibleplaces-sea',
      'src-bolen-jp',
      'src-web-luk08',
    ],
    body: 'The lake sits in a deep basin ringed by hills, and wind can reach it suddenly. On most summer afternoons a sea breeze from the Mediterranean crosses the Galilee hills and plunges down onto the warm lake, raising strong winds and waves. Some of the fiercest storms come from the east, off the Golan Heights. In the cooler months these easterly storms can build through the night and into the morning, helped by cold air draining down the slopes. Luke says the storm “came down on the lake” (Luke 8:23). None of the Gospels says which wind it was.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Afternoon westerly: established (Alpert 1982; Bitan 1981). Easterly storms strengthening at night/morning: probable (Saaroni 1998 covers all of Israel). Do not claim which wind struck in Mark 4.',
    }),
  },
  {
    id: 'rec-hist-galilee-boat',
    kind: 'historical',
    title: 'A boat from Jesus’ time',
    sources: [
      'src-wachsmann-bar-1988',
      'src-wachsmann-seafaring',
      'src-wiki-galilee-boat',
      'src-yigal-allon',
      'src-josephus-war-lake',
    ],
    body: 'In January 1986, during a drought that had lowered the lake, two brothers from Kibbutz Ginosar, Moshe and Yuval Lufan, found the remains of an ancient boat in the mud of the shore. It is about 8.2 meters long and 2.3 meters wide, built of planks joined with pegged mortise-and-tenon joints, mostly cedar on oak frames, and it had been repaired again and again. Radiocarbon tests and pottery found with it date it to between the 1st century BC and the 1st century AD. The archaeologist Shelley Wachsmann estimated a crew of five — four rowers and a helmsman — and found traces of a step for a mast. The boat is displayed at the Yigal Allon Centre at Ginosar. Nothing connects this particular boat to Jesus, but it shows what boats of his time were like. Josephus says that he once gathered 230 boats from the lake, with no more than four sailors in each.',
    governance: draft({
      confidence: 'established',
      sourced: true,
      notes:
        'Discovery, dimensions and date range: established. Crew of five and a mast step: probable (Wachsmann). The number of wood types differs between sources, so it is not stated. Josephus’s 230 boats is his own figure.',
    }),
  },
  {
    id: 'rec-hist-cushion',
    kind: 'historical',
    title: '“On the cushion”',
    scripture: [ref('Mark', 4, 38)],
    sources: ['src-web-mrk04', 'src-sblgnt-mrk04', 'src-wachsmann-bar-1988'],
    body: 'Mark says Jesus was “in the stern, asleep on the cushion” (Mark 4:38). The Greek says “the” cushion, as if it belonged to the boat. Shelley Wachsmann suggested it may have been a sandbag used as ballast, stored under the stern deck where the helmsman worked. It is a suggestion, not a certainty.',
    governance: draft({ confidence: 'possible', sourced: true }),
  },
  {
    id: 'rec-hist-nets',
    kind: 'historical',
    title: 'Nets on the lake',
    scripture: [ref('Matthew', 4, 18), ref('Matthew', 13, 47, 48)],
    sources: [
      'src-hanson-fishing',
      'src-nun-nets',
      'src-franz-fish',
      'src-web-mat04',
      'src-web-mat13',
      'src-sblgnt-mat04',
      'src-sblgnt-mat13',
    ],
    body: 'The Gospels mention a cast net (Greek amphiblēstron), thrown from a boat or from the shore to fall over a shoal of fish (Matthew 4:18), and a large dragnet or seine (sagēnē) that brought in “fish of every kind” to be sorted on the beach (Matthew 13:47–48). The trammel net, made of three layers of netting, is set at night, because fish can see the nets by day; the fisherman and historian Mendel Nun called it the only net from ancient times still used commercially on the lake. In Jesus’ time nets were made of linen thread.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Cast net and dragnet: established (Gospel text). That trammel nets were used on the lake in the 1st century is Nun’s view: probable.',
    }),
  },
  {
    id: 'rec-hist-fishing-economy',
    kind: 'historical',
    title: 'A family business',
    scripture: [ref('Mark', 1, 19, 20), ref('Luke', 5, 7, 10)],
    sources: ['src-web-mrk01', 'src-web-luk05', 'src-hanson-fishing', 'src-myles-fishing'],
    body: 'Fishing on the lake was often a family business. Mark says Zebedee worked in his boat with his sons and hired men (Mark 1:19–20), and Luke calls Simon, James and John partners (Luke 5:7–10). The historian K. C. Hanson argues that under Herod Antipas fishers paid for fishing rights and tolls through local middlemen, and that much of the profit went to the powerful. Other scholars think the growing fish trade also brought wealth to the towns around the lake. How fishing was taxed and controlled is still debated. The fee and the family’s debt in this game are fiction.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Family crews and hired workers: established (Gospel text). Leases and tolls under Antipas: possible — a model adapted from Egyptian and Syrian evidence, and debated.',
    }),
  },
  {
    id: 'rec-hist-salting',
    kind: 'historical',
    title: 'Salted fish from Magdala',
    sources: [
      'src-strabo-16-45',
      'src-wiki-magdala',
      'src-bas-magdala',
      'src-magdala-salted',
      'src-hanson-fishing',
    ],
    body: 'Fish were salted or dried so they would keep and could be sold far from the lake. The Greek geographer Strabo wrote that “at the place called Taricheae the lake supplies excellent fish for pickling.” Most scholars identify Taricheae with Magdala, on the western shore, though some disagree. Its Greek name is linked to a word for preserved fish, and the Babylonian Talmud calls the town Magdala Nunayya, “Tower of the Fishes.” Archaeologists at Magdala have found a large harbour, hundreds of fishing weights, and small pools that may have been used for salting fish. The brine recipe in this game is made up.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Taricheae as a fish-salting place: established (Strabo). Magdala = Taricheae: probable (disputed). The salting pools: possible.',
    }),
  },
  {
    id: 'rec-hist-capernaum',
    kind: 'historical',
    title: 'Capernaum, a fishing village',
    scripture: [ref('Matthew', 4, 13), ref('Mark', 1, 21), ref('Mark', 2, 1, 4)],
    sources: [
      'src-wiki-capernaum',
      'src-bolen-jp',
      'src-web-mat04',
      'src-web-mrk01',
      'src-web-mrk02',
    ],
    body: 'Capernaum was a fishing village on the north-west shore of the lake. Matthew says Jesus left Nazareth and lived there (Matthew 4:13), and Mark describes him teaching in its synagogue (Mark 1:21). In the 1st century perhaps 1,500 people lived there. Houses were built of the local black basalt without mortar, with roofs of wooden beams covered with branches and mud — the kind of roof that four people broke open in Mark 2:4 to lower a paralysed man to Jesus. Remains of an old harbour run along the shore.',
    governance: draft({
      confidence: 'probable',
      sourced: true,
      notes:
        'Village, basalt, fishing: established. Roof construction and the population figure (one estimate): probable. That the harbour was in use in the 1st century is assumed by most scholars.',
    }),
  },
  {
    id: 'rec-hist-fish',
    kind: 'historical',
    title: 'Fish of the lake',
    scripture: [ref('Leviticus', 11, 9, 12)],
    sources: [
      'src-wiki-sea-of-galilee',
      'src-bolen-jp',
      'src-web-lev11',
      'src-sciencedaily-kosher',
    ],
    body: 'Local fishermen speak of four main kinds of fish in the lake: musht (tilapia, sometimes sold as “St. Peter’s fish”), a small sardine that swims in large shoals, the barbel, and the catfish. Catfish have no scales, and the Law allowed only fish with fins and scales to be eaten (Leviticus 11:9–12). Bones of fish without scales are mostly missing from Judean settlements of the Roman period and later, which suggests that observant Jews avoided them.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-other-boats',
    kind: 'historical',
    title: '“Other boats were with him”',
    scripture: [
      ref('Mark', 4, 36),
      ref('Mark', 5, 1),
      ref('Matthew', 8, 23, 27),
      ref('Luke', 8, 22, 25),
    ],
    sources: [
      'src-web-mrk04',
      'src-web-mrk05',
      'src-web-mat08',
      'src-web-luk08',
      'src-sblgnt-mrk04',
      'src-black-wp',
    ],
    body: 'Only Mark mentions that other boats went with Jesus’ boat (Mark 4:36); Matthew and Luke tell the story without them. Mark does not say who was in them or what happened to them — as one commentator puts it, the escort “fades away.” He says only that Jesus’ boat came to the other side of the lake (Mark 5:1). Your family’s boat in this game is fiction, imagined as one of those other boats.',
    governance: draft({ confidence: 'established', sourced: true }),
  },

  // ── Reconstruction ───────────────────────────────────────────────────
  {
    id: 'rec-recon-boat-handling',
    kind: 'reconstruction',
    title: 'Handling a boat in a squall',
    sources: ['src-wachsmann-seafaring', 'src-wachsmann-bar-1988', 'src-wiki-square-rig'],
    body: 'A first-century mosaic found at Migdal shows a boat of the lake with a mast, a furled square sail, oars, and a steering oar at the stern; the stern deck was the helmsman’s place. Sailors of the time shortened a square sail with “brails,” lines that gathered it up to the yard. Nobody knows exactly how Galilean fishers handled their boats in a storm, and whether they used brails is not known. The order Tamar teaches you in this game is fiction, built from these general practices.',
    governance: draft({ confidence: 'possible', sourced: true }),
  },
  {
    id: 'rec-recon-shore',
    kind: 'reconstruction',
    title: 'What the shore looked like',
    sources: ['src-wiki-capernaum', 'src-bolen-jp', 'src-hanson-fishing'],
    body: 'This game’s Capernaum is imagined from what is known of fishing villages by the lake: houses of black basalt, boats drawn up on a pebbly beach, nets hung to dry and mended, fish salted and dried, and a harbour along the shore. The layout, the jetty, the houses and everyone you meet are fiction.',
    governance: draft({ confidence: 'probable', sourced: true }),
  },

  // ── Interpretation (labelled; traditions may differ) ───────────────────
  {
    id: 'rec-interp-who-is-this',
    kind: 'interpretation',
    title: '“Who then is this?”',
    scripture: [ref('Mark', 4, 41), ref('Psalms', 89, 9), ref('Psalms', 107, 29)],
    sources: [
      'src-web-mrk04',
      'src-web-psa089',
      'src-web-psa107',
      'src-chrysostom-hom28',
      'src-skinner-wp',
      'src-black-wp',
    ],
    body: 'Mark ends the story with a question: the disciples ask one another who Jesus can be, that even the wind and the sea obey him (Mark 4:41). In the Hebrew Scriptures it is God who rules the raging sea and calms its waves (Psalm 89:9; Psalm 107:29). Many Christians, ancient and modern, read the story as showing Jesus acting with God’s own authority over creation; John Chrysostom wrote that “the sleep and the outward appearance showed man, the sea and the calm declared Him God.” Other readers stress that Mark leaves his readers in the boat with the disciples, still wondering who Jesus really is.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'A widely shared Christian reading, presented as interpretation. Scholars differ on how directly the Psalm echoes identify Jesus with God (Skinner 2018).',
    }),
  },
  {
    id: 'rec-interp-echoes',
    kind: 'interpretation',
    title: 'Echoes of older stories',
    scripture: [ref('Psalms', 107, 23, 30), ref('Jonah', 1, 4, 6)],
    sources: ['src-web-psa107', 'src-web-jon01', 'src-black-wp', 'src-redd-tgc'],
    body: 'Readers have long heard echoes of the Hebrew Scriptures in this story. Psalm 107:23–30 describes sailors in a storm who cry out to God, who makes the storm a calm and brings them to harbour. In Jonah 1, a great wind strikes a ship, the frightened sailors throw the cargo overboard, and Jonah is fast asleep below. One scholar calls Mark’s account a “christological reinterpretation” of Psalm 107; another thinks Mark is deliberately evoking Jonah. These are readings of the text, not statements the text makes about itself.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Scholarly readings presented as interpretation; not all readers weigh the parallels equally.',
    }),
  },
  {
    id: 'rec-interp-fear-faith',
    kind: 'interpretation',
    title: 'Fear, and turning to him',
    scripture: [ref('Mark', 4, 38, 40), ref('Matthew', 8, 26), ref('Luke', 8, 25)],
    sources: [
      'src-web-mrk04',
      'src-web-mat08',
      'src-web-luk08',
      'src-francis-2020',
      'src-calvin-harmony',
      'src-stamper-wp',
    ],
    body: 'After the calm, Jesus asks the disciples why they are so afraid, and how it is that they have no faith (Mark 4:40). Matthew and Luke tell his question a little differently (“you of little faith,” Matthew 8:26; “Where is your faith?”, Luke 8:25). Many readers notice that the frightened disciples still turned to Jesus, and that in Mark’s telling he calmed the storm before he asked his question. Pope Francis put it this way: “They had not stopped believing in him; in fact, they called on him.” John Calvin wrote that “it is not every kind of fear that is opposed to faith.” Christians have also said that following Jesus does not promise a life without storms. Being afraid is not the same as having failed.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Traditions weigh Jesus’ rebuke and his rescue differently. This record guards against reading the passage as “fear or suffering proves weak faith,” which the sources cited here do not teach.',
    }),
  },
  {
    id: 'rec-interp-boat-church',
    kind: 'interpretation',
    title: 'The boat as a picture of the Church',
    scripture: [ref('Mark', 4, 37, 39)],
    sources: ['src-tertullian-baptism', 'src-augustine-sermon-63', 'src-web-mrk04'],
    body: 'Some early Christian teachers read the boat in the storm as a picture of the Church. Around AD 200, Tertullian wrote that “that little ship did present a figure of the Church,” tossed by the waves of persecutions and temptations. Augustine, preaching on Matthew’s account, also called the ship “a figure of the Church,” and urged his listeners, when anger or other passions stirred them up, to “awake Christ.” Christian traditions differ in how much weight they give to readings like these alongside the plain story.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Allegorical and plain readings are weighted differently across traditions; both are presented as views.',
    }),
  },
  {
    id: 'rec-interp-miracle-views',
    kind: 'interpretation',
    title: 'What kind of event was it?',
    scripture: [ref('Mark', 4, 39, 41)],
    sources: [
      'src-ccc-547',
      'src-wiki-miracles',
      'src-schweitzer-paulus',
      'src-strauss-life',
      'src-hultgren-2009',
    ],
    body: 'Christians have understood this story in more than one way. For many Christians — Catholic, Orthodox and Protestant — it is a real miracle that shows who Jesus is; the Catholic Catechism says Jesus’ miracles “bear witness that he is the Son of God.” Some readers, including many liberal Christians, treat the story mainly as a figurative picture of faith. In the 1800s some writers proposed natural explanations — H. E. G. Paulus suggested the boat simply reached the shelter of a hill — while D. F. Strauss treated the story as legend; many Christians reject both readings. Some historians say miracle claims can be neither proved nor disproved by historical methods. This game does not try to settle what happened. It shows you what the text says, and invites you to read it for yourself.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'high',
      sensitivityNote:
        'Views on the nature of the miracle differ between and within traditions. Every view is presented as a view, the traditional view accurately, and none as the game’s verdict. The sources do not say which view is the majority, so the record does not claim one.',
    }),
  },
  {
    id: 'rec-interp-same-storm',
    kind: 'interpretation',
    title: 'In the same storm',
    scripture: [ref('Mark', 4, 36)],
    sources: ['src-jacobsen-wp', 'src-tshehla-2018', 'src-web-mrk04'],
    body: 'Mark’s brief mention of the other boats has led some readers to think about everyone else caught in the same storm. One preacher put it this way: “though we are in the same storm, we are not necessarily in the same boat.” A scholar has asked whether the detail hints at Jesus’ openness to people beyond his closest disciples. These are reflections on the text, not claims about what happened to the other boats.',
    governance: draft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote: 'Pastoral and scholarly reflections, presented as such.',
    }),
  },

  // ── Fiction: people ────────────────────────────────────────────────────
  fiction(
    'rec-p-shelomit',
    'Grandmother Shelomit',
    'Your grandmother. She has mended nets on this shore for fifty years and knows every family’s boat by the patches in its sail.',
  ),
  fiction(
    'rec-p-elazar',
    'Uncle Elazar',
    'Master of the family boat, proud of her and worried about what the family owes this season. Tonight he takes you out as crew for the first time.',
  ),
  fiction(
    'rec-p-tamar',
    'Tamar',
    'Your older cousin, the strongest rower in the family, who has been waiting a long time to teach you everything she knows.',
  ),
  fiction(
    'rec-p-yoezer',
    'Yoezer',
    'A hired man who works the family boat for a day’s wage. He says little, rows hard, and listens to old Hanina about the weather.',
  ),
  fiction(
    'rec-p-hanina',
    'Old Hanina',
    'A retired fisherman who spends his afternoons at the end of the jetty, watching the sky and the water.',
  ),
  fiction(
    'rec-p-nikanor',
    'Nikanor',
    'A salt-fish trader from Magdala, cheerful, busy and sure of himself — more at home at the salting tubs than on the water.',
  ),
  fiction(
    'rec-p-shifra',
    'Shifra',
    'A potter’s wife from a village in the hills, who came down to the lake with her son and brother to hear the teacher.',
  ),
  fiction('rec-p-ami', 'Ami', 'Shifra’s young son, full of questions about boats.'),
  fiction(
    'rec-p-oded',
    'Oded',
    'Shifra’s brother, a potter who has borrowed a little rowing boat from a cousin. He has rowed it twice.',
  ),
  fiction(
    'rec-p-dinah',
    'Dinah',
    'A farmer’s wife who has been sitting on the shore since morning, listening to the teacher.',
  ),

  // ── Fiction: places, events, the crossing ──────────────────────────────
  fiction(
    'rec-pl-house',
    'Grandmother’s house',
    'A small fisher-family house in the lanes above the shore at Capernaum, smelling of nets, salt and the lake. (Fiction.)',
  ),
  fiction(
    'rec-pl-shore',
    'The fishing quarter',
    'The shore below Grandmother’s house, where the family’s boat is moored at the jetty, nets hang to dry, and salters from Magdala buy the catch. (Fiction.)',
  ),
  fiction(
    'rec-pl-lake',
    'Out on the lake',
    'The dark water between Capernaum and the far shore, where your family’s boat crossed with the others. (Fiction.)',
  ),
  fiction(
    'rec-e-mission',
    'Your first crossing',
    'Uncle Elazar is taking the family boat across the lake tonight with six jars of Nikanor’s salted fish. You are going with him as crew for the first time.',
  ),
  fiction(
    'rec-e-storm',
    'The storm',
    'A squall came down on the lake in the dark. Waves broke over the bow, and the boat began to fill.',
  ),
  fiction(
    'rec-e-calm',
    'The calm',
    'And then the wind stopped — all at once — and the lake lay flat and still under the stars.',
  ),
  fiction(
    'rec-e-home',
    'Home before dawn',
    'Your family turned back for Capernaum, and Grandmother was waiting on the jetty with a lamp.',
  ),
  fiction(
    'rec-map-crossing',
    'The crossing',
    'From the jetty at Capernaum, the boats headed east across the lake toward the far shore, with the teacher’s boat ahead. Your family’s boat turned back after the storm. (The route and the boats are fiction.)',
  ),
];

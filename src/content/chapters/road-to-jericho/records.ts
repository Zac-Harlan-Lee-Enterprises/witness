import type { ChapterInput } from '@/domain/chapter';
import type { ScriptureRef } from '@/domain/scripture';
import { aiDraft, FICTION } from '../../shared/governance';

/**
 * Content records for "The Road to Jericho".
 *
 * Kinds are explicit so the UI can label every paragraph. Scripture records
 * carry REFERENCES only; verse text comes from the ScriptureTextProvider
 * (placeholder unless an approved translation is enabled). Educational
 * records cite sources from content/shared/sources.ts and state confidence.
 * Claim-by-claim research notes: docs/research/source-verification.md.
 */
const ref = (
  book: ScriptureRef['book'],
  chapter: number,
  verseStart: number,
  verseEnd?: number,
): ScriptureRef =>
  verseEnd === undefined ? { book, chapter, verseStart } : { book, chapter, verseStart, verseEnd };

const SCRIPTURE_REF = aiDraft({ confidence: 'not-applicable', sourced: true, ageLevel: 'all' });

const scripture = (
  id: string,
  title: string,
  refs: ScriptureRef[],
  sources: string[],
): ChapterInput['records'][number] => ({
  id,
  kind: 'scripture',
  title,
  scripture: refs,
  sources,
  governance: SCRIPTURE_REF,
});

const fiction = (id: string, title: string, body: string): ChapterInput['records'][number] => ({
  id,
  kind: 'fiction',
  title,
  body,
  sources: [],
  governance: FICTION,
});

export const RECORDS: ChapterInput['records'] = [
  // ── Scripture references ─────────────────────────────────────────────
  scripture('rec-luke-10-25-37', 'Luke 10:25–37', [ref('Luke', 10, 25, 37)], ['src-web-luk10']),
  scripture('rec-lev-19-18', 'Leviticus 19:18', [ref('Leviticus', 19, 18)], ['src-web-lev19']),
  scripture('rec-lev-19-34', 'Leviticus 19:34', [ref('Leviticus', 19, 34)], ['src-web-lev19']),
  scripture('rec-deut-6-5', 'Deuteronomy 6:5', [ref('Deuteronomy', 6, 5)], ['src-web-deu06']),
  scripture('rec-john-4-9', 'John 4:9', [ref('John', 4, 9)], ['src-web-jhn04']),
  scripture('rec-luke-9-52-54', 'Luke 9:52–54', [ref('Luke', 9, 52, 54)], ['src-web-luk09']),
  scripture('rec-matt-20-2', 'Matthew 20:2', [ref('Matthew', 20, 2)], ['src-web-mat20']),
  scripture(
    'rec-josh-15-7',
    'Joshua 15:7 and 18:17',
    [ref('Joshua', 15, 7), ref('Joshua', 18, 17)],
    ['src-web-jos15'],
  ),
  scripture('rec-deut-34-3', 'Deuteronomy 34:3', [ref('Deuteronomy', 34, 3)], ['src-web-deu34']),
  scripture('rec-isa-1-6', 'Isaiah 1:6', [ref('Isaiah', 1, 6)], ['src-web-isa01']),

  // ── Paraphrases (our words, always labelled, always cited) ─────────────
  {
    id: 'rec-para-luke-10',
    kind: 'paraphrase',
    title: 'The story in our own words',
    scripture: [ref('Luke', 10, 25, 37)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-luk10'],
    body:
      'An expert in the Jewish Law asked Jesus what he must do to inherit eternal life. Jesus asked him what the Law said. The man answered that you must love God with all your heart, soul, strength and mind — and love your neighbor as yourself. Jesus told him he had answered correctly.\n\n' +
      'But the man, wanting to justify himself, asked Jesus who his neighbor was. Jesus answered with a story. A man going down from Jerusalem to Jericho was attacked by robbers. They stripped him, beat him, and left him half dead. A priest going down that road saw him and passed by on the other side. A Levite did the same. Then a Samaritan traveling that way came to where he was, saw him, and was moved with compassion. He bandaged his wounds, pouring on oil and wine, set him on his own animal, brought him to an inn and took care of him. The next day he gave the innkeeper two denarii and promised to repay anything more it cost when he came back.\n\n' +
      'Then Jesus asked which of the three had been a neighbor to the man who was robbed. The expert answered that it was the one who showed him mercy. Jesus told him to go and do the same.',
    governance: aiDraft({
      confidence: 'not-applicable',
      sourced: true,
      ageLevel: '10+',
      notes:
        'Paraphrase checked against the WEB text of Luke 10:25–37 (fetched verbatim). Deliberately adds no details the text does not contain (e.g., no motives for the priest or Levite; “animal,” not “donkey”).',
    }),
  },
  {
    id: 'rec-para-love-commands',
    kind: 'paraphrase',
    title: 'Love God, love your neighbor',
    scripture: [ref('Deuteronomy', 6, 5), ref('Leviticus', 19, 18), ref('Leviticus', 19, 34)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-deu06', 'src-web-lev19'],
    body: 'Hanan’s words in the market are a paraphrase, not a quotation. Deuteronomy 6:5 teaches love for God with all your heart; Leviticus 19:18 teaches love for your neighbor as yourself; Leviticus 19:34 teaches love for the foreigner living among God’s people.',
    governance: aiDraft({ confidence: 'not-applicable', sourced: true }),
  },
  {
    id: 'rec-para-yair',
    kind: 'paraphrase',
    title: 'Yair retells part of the story',
    scripture: [ref('Luke', 10, 29, 37)],
    checkedAgainstTranslation: 'WEB',
    sources: ['src-web-luk10'],
    body: 'Yair is a fictional character retelling part of Luke 10:29–37 in his own words. Luke does not name who else was present when Jesus told this story. Read the passage itself in the Scripture Connection.',
    governance: aiDraft({ confidence: 'not-applicable', sourced: true }),
  },

  // ── Historical and cultural background ─────────────────────────────────
  {
    id: 'rec-hist-descent',
    kind: 'historical',
    title: '“Going down” to Jericho',
    scripture: [ref('Luke', 10, 30)],
    sources: ['src-wiki-jerusalem', 'src-wiki-jericho', 'src-josephus-war-4', 'src-web-luk10'],
    body: 'Jerusalem sits about 754 meters (about 2,470 feet) above sea level. Jericho lies about 258 meters (about 850 feet) BELOW sea level. So the road drops roughly 1,000 meters — more than 3,000 feet. That is why the man in Jesus’ story was going “down” from Jerusalem to Jericho. The first-century historian Josephus gave the distance as 150 stadia, roughly 27 kilometers (17 miles), across desert, stony country — though ancient measurements varied.',
    governance: aiDraft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-road-danger',
    kind: 'historical',
    title: 'A road with a reputation',
    sources: ['src-strabo-16', 'src-jerome-108', 'src-wiki-adummim', 'src-web-luk10'],
    scripture: [ref('Luke', 10, 30)],
    body: 'Jesus’ story takes it for granted that robbers could strike on this road. Other ancient writers mention danger in the area too. The geographer Strabo wrote that the Roman general Pompey (63 BC) destroyed robbers’ strongholds on the passes near Jericho. Centuries later, Jerome (AD 404) called the climb “the place of blood” because of attacks — but that name is much later than Jesus’ day. The older Hebrew name, Adummim, simply means “red,” after the reddish rock.',
    governance: aiDraft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-road-surface',
    kind: 'reconstruction',
    title: 'What was the road like?',
    sources: ['src-roll-roads'],
    body: 'Scholars think the big engineered Roman road network in Judea — with paved stretches and milestones — was built mostly after AD 66–70. In Jesus’ time the way down to Jericho was probably a well-used track rather than a paved highway, and its exact line is uncertain. This game shows a rough track and invents its details: the fork, the bend and the shepherds’ path are fictional.',
    governance: aiDraft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-adummim',
    kind: 'historical',
    title: 'The Ascent of Adummim',
    scripture: [ref('Joshua', 15, 7), ref('Joshua', 18, 17)],
    sources: ['src-web-jos15', 'src-wiki-adummim'],
    body: 'The book of Joshua names “the ascent of Adummim” as a landmark on a tribal boundary (Joshua 15:7 and 18:17). Adummim comes from the Hebrew word for “red,” probably because of the reddish rock in the area. Its exact location is still debated.',
    governance: aiDraft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-jericho',
    kind: 'historical',
    title: 'Jericho, the city of palm trees',
    scripture: [ref('Deuteronomy', 34, 3)],
    sources: ['src-web-deu34', 'src-josephus-war-4', 'src-strabo-16'],
    body: 'Deuteronomy 34:3 calls Jericho “the city of palm trees.” In the first century, Josephus described its strong spring, its many kinds of palms and its prized balsam. He said the air there was so mild that people wore linen clothes while snow covered the rest of Judea.',
    governance: aiDraft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-samaritans',
    kind: 'historical',
    title: 'Jews and Samaritans',
    scripture: [ref('John', 4, 9), ref('John', 4, 20), ref('Luke', 9, 52, 54)],
    sources: ['src-web-jhn04', 'src-web-luk09', 'src-ryan-scjr', 'src-wiki-gerizim'],
    body: 'Samaritans lived in Samaria, the region north of Judea. They worshiped God on their own holy mountain — traditionally identified as Mount Gerizim (see John 4:20) — rather than at the Temple in Jerusalem. John’s Gospel notes that Jews did not usually associate with Samaritans (John 4:9), and Luke tells of a Samaritan village that would not welcome Jesus (Luke 9:52–54). Historians describe relations in the first century as strained, but not completely broken. Samaritans are still a small, living community today.',
    governance: aiDraft({
      confidence: 'established',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Interfaith sensitivity: Samaritans are a living community. Portray both Samaritans and Jews respectfully and without caricature (Ryan 2021).',
    }),
  },
  {
    id: 'rec-hist-priests-levites',
    kind: 'historical',
    title: 'Priests and Levites',
    scripture: [ref('Luke', 10, 31, 32)],
    sources: ['src-talmud-taanit-27a', 'src-ryan-scjr', 'src-web-luk10'],
    body: 'Priests and Levites served at the Temple in Jerusalem. A much later Jewish tradition (in the Talmud, compiled around AD 500) says that many priests came from Jericho, so it would not have been strange to meet them on this road — though historians debate how reliable that tradition is.\n\nLuke does not say why the priest and the Levite in Jesus’ story passed by. People have suggested reasons, but the text leaves the question open.',
    governance: aiDraft({
      confidence: 'probable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Explanations of the priest’s and Levite’s motives (e.g., ritual purity) are speculation and have been used to stereotype Jewish people. Do not present any motive as fact.',
    }),
  },
  {
    id: 'rec-hist-oil-wine',
    kind: 'historical',
    title: 'Oil and wine',
    scripture: [ref('Luke', 10, 34), ref('Isaiah', 1, 6)],
    sources: ['src-hippocrates-ulcers', 'src-web-isa01', 'src-web-luk10'],
    body: 'In Jesus’ story, the Samaritan pours oil and wine on the man’s wounds (Luke 10:34). That was ordinary first aid in the ancient world. An old Greek medical text, the Hippocratic “On Ulcers,” advises wetting wounds with wine and covering them with cloths soaked in wine and oil. Isaiah 1:6 pictures wounds that have not been bandaged or soothed with oil. (This describes ancient practice. It is not medical advice!)',
    governance: aiDraft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-coins',
    kind: 'historical',
    title: 'Coins and wages',
    scripture: [ref('Matthew', 20, 2), ref('Luke', 10, 35)],
    sources: [
      'src-web-mat20',
      'src-wiki-denarius',
      'src-wiki-procuratorial-coins',
      'src-web-mrk12',
    ],
    body: 'In another of Jesus’ parables, workers are hired for a denarius a day (Matthew 20:2), and historians treat a denarius as a common day’s wage for a laborer. So the Samaritan’s two denarii (Luke 10:35) were roughly two days’ pay. Everyday small change in Judea included little bronze coins such as the prutah, minted in Jerusalem. Exact exchange rates between coins are debated, and the prices in this game are simplified.',
    governance: aiDraft({ confidence: 'probable', sourced: true }),
  },
  {
    id: 'rec-hist-measures',
    kind: 'historical',
    title: 'Measuring oil',
    scripture: [ref('Leviticus', 14, 10)],
    sources: ['src-web-lev14', 'src-wiki-log-unit'],
    body: 'Oil was bought and sold by measure. Leviticus 14:10 mentions a “log” of oil, a small Hebrew liquid measure. Nobody knows its exact modern size — estimates range from about a third of a liter to more than half a liter. The “measures” in the market puzzle are simplified for the game.',
    governance: aiDraft({
      confidence: 'uncertain',
      sourced: true,
      notes: 'The unit is attested; its volume is uncertain. Do not state a precise volume.',
    }),
  },
  {
    id: 'rec-hist-floods',
    kind: 'historical',
    title: 'Flash floods in dry valleys',
    sources: ['src-wiki-judaean-desert', 'src-dayan-floods', 'src-wiki-wadi-qelt'],
    body: 'The Judean Desert lies in a “rain shadow” east of the hills. When storms soak the hills to the west, water can rush down the dry streambeds (called wadis) in a sudden flash flood — even where no rain is falling. One of these valleys, Wadi Qelt, runs between the Jerusalem area and Jericho. (This is geography. The Bible passage itself doesn’t mention floods.)',
    governance: aiDraft({ confidence: 'established', sourced: true }),
  },
  {
    id: 'rec-hist-inn',
    kind: 'historical',
    title: 'Inns on the road',
    scripture: [ref('Luke', 10, 34, 35)],
    sources: ['src-sblgnt-luk10', 'src-wiki-inn-good-samaritan'],
    body: 'Luke uses a Greek word for a public inn — pandocheion, a place that took in any traveler. Much later, Christians began pointing to a spot on the Jericho road as “the Inn of the Good Samaritan.” But the inn in Jesus’ story is part of a parable, so no real building can be identified as that inn. The inn in this game is fictional.',
    governance: aiDraft({
      confidence: 'established',
      sourced: true,
      notes: 'Word: established. Site identification: later tradition only.',
    }),
  },
  {
    id: 'rec-hist-love-commands',
    kind: 'historical',
    title: 'Two great commands',
    scripture: [
      ref('Deuteronomy', 6, 5),
      ref('Leviticus', 19, 18),
      ref('Leviticus', 19, 34),
      ref('Luke', 10, 27),
    ],
    sources: ['src-web-deu06', 'src-web-lev19', 'src-web-luk10'],
    body: 'When the expert in the Law answered Jesus (Luke 10:27), he joined two commands from the Hebrew Scriptures: love God with all your heart (Deuteronomy 6:5) and love your neighbor as yourself (Leviticus 19:18). Luke’s wording lists heart, soul, strength and mind. A few verses after Leviticus 19:18, Leviticus 19:34 tells Israel to love the foreigner who lives among them as themselves.',
    governance: aiDraft({ confidence: 'established', sourced: true }),
  },

  // ── Interpretation (labelled; traditions may differ) ───────────────────
  {
    id: 'rec-interp-neighbor',
    kind: 'interpretation',
    title: 'Who acted as a neighbor?',
    scripture: [ref('Luke', 10, 29, 37)],
    sources: ['src-web-luk10', 'src-augustine-doctrine'],
    body: 'Many readers notice that the story turns the expert’s question around. He asked who his neighbor was — in other words, whom he had to love. Jesus ends by asking which man ACTED as a neighbor. The answer is the one who showed mercy: a Samaritan, the person the listeners might least have expected. Christians across many traditions read the story as a call to show practical mercy to anyone in need, across the lines that divide people. Augustine, for example, taught that every person should be counted as our neighbor.',
    governance: aiDraft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'A widely shared ethical reading; presented as interpretation, not as the only reading.',
    }),
  },
  {
    id: 'rec-interp-augustine',
    kind: 'interpretation',
    title: 'An early Christian reading',
    sources: ['src-augustine-qe', 'src-augustine-doctrine'],
    body: 'Some early Christian teachers also read the parable as a picture of salvation. Augustine of Hippo (around AD 400) described the wounded man as Adam — standing for all humanity — the Samaritan as the Lord, and the inn as the Church. He said the oil meant the comfort of good hope, and the wine meant encouragement to work with a fervent spirit. Augustine ALSO taught the plain moral lesson that every person is our neighbor. Today many scholars focus on the moral reading, while some Christians still treasure the Christ-centered one. Christian traditions differ in how much weight they give each.',
    governance: aiDraft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'moderate',
      sensitivityNote:
        'Allegorical and ethical readings are weighted differently across traditions; both are presented as views, not settled fact.',
    }),
  },
  {
    id: 'rec-interp-fair-reading',
    kind: 'interpretation',
    title: 'Reading the story fairly',
    scripture: [ref('Luke', 10, 31, 32)],
    sources: ['src-ryan-scjr', 'src-web-luk10'],
    body: 'Luke doesn’t tell us why the priest and the Levite passed by. It’s tempting to fill in reasons, but guesses can turn into unfair stereotypes of priests, Levites or Jewish people. Jesus was Jewish, and so was the expert he was talking with. The story’s challenge is for every listener — including us.',
    governance: aiDraft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Guards against anti-Jewish readings; consistent with mainstream Christian teaching.',
    }),
  },
  {
    id: 'rec-interp-mercy-cost',
    kind: 'interpretation',
    title: 'Mercy that costs something',
    scripture: [ref('Luke', 10, 34, 35)],
    sources: ['src-web-luk10'],
    body: 'In the story, the Samaritan’s mercy is practical and it costs him: oil and wine, his own animal, his time, two denarii, and a promise to pay more. Many readers see this as a picture of love that acts — not only feeling sorry, but doing something.',
    governance: aiDraft({ confidence: 'not-applicable', sourced: true, sensitivity: 'none' }),
  },
  {
    id: 'rec-interp-fear',
    kind: 'interpretation',
    title: 'Courage and fear',
    body: 'Helping someone can feel risky. Feeling afraid is normal, and fear can even protect us. The story invites us to notice what makes stopping hard, and to look for wise and brave ways to help — including asking others to help too.',
    scripture: [ref('Luke', 10, 30, 33)],
    sources: ['src-web-luk10'],
    governance: aiDraft({
      confidence: 'not-applicable',
      sourced: true,
      sensitivity: 'low',
      sensitivityNote:
        'Pastoral reflection for young readers; phrased as encouragement, not doctrine.',
    }),
  },

  // ── Fiction: people ────────────────────────────────────────────────────
  fiction(
    'rec-p-miriam',
    'Aunt Miriam',
    'A healer in Jerusalem who has cared for you since you were small. She knows herbs, remedies — and exactly how much a person can carry.',
  ),
  fiction(
    'rec-p-malik',
    'Malik',
    'A Nabataean trader whose caravan carries goods between Jerusalem, Jericho and lands to the east. Practical, funny, and generous with advice — for a price, sometimes.',
  ),
  fiction(
    'rec-p-shimon',
    'Old Shimon',
    'A shepherd who has walked the wilderness paths all his life. He speaks slowly and notices everything.',
  ),
  fiction(
    'rec-p-tobiah',
    'Tobiah',
    'A carter who drives goods along the main road. Confident — sometimes more confident than he should be.',
  ),
  fiction(
    'rec-p-hadassah',
    'Hadassah',
    'A weaver with a stall in the market. She sells linen and hears every piece of news in Jerusalem.',
  ),
  fiction(
    'rec-p-ezer',
    'Ezer',
    'A baker whose ovens start before dawn. Quick-tempered, but quick to make things right.',
  ),
  fiction(
    'rec-p-menashe',
    'Menashe',
    'A Samaritan merchant who brings olive oil to sell in Jerusalem and Jericho. Used to being watched with suspicion.',
  ),
  fiction(
    'rec-p-hanan',
    'Hanan',
    'A young Levite who serves at the Temple. Thoughtful and kind, with questions of his own.',
  ),
  fiction(
    'rec-p-salome',
    'Salome',
    'The keeper of a wayside inn near Jericho. She has seen every kind of traveler — and turns none away.',
  ),
  fiction(
    'rec-p-rivka',
    'Rivka',
    'Aunt Miriam’s old friend in Jericho. Her son Natan has been sick with a fever.',
  ),
  fiction(
    'rec-p-natan',
    'Natan',
    'Rivka’s son. Curious about everything, especially the road you just walked.',
  ),
  fiction(
    'rec-p-yair',
    'Yair',
    'Rivka’s brother, who grows figs near Jericho. He heard a story on his travels that he cannot stop thinking about.',
  ),

  // ── Fiction: events and places ─────────────────────────────────────────
  fiction(
    'rec-e-mission',
    'A remedy for Jericho',
    'Aunt Miriam asked you to carry a remedy to her friend Rivka in Jericho, whose son Natan has a fever. It is a long day’s walk down a road with a dangerous reputation.',
  ),
  fiction(
    'rec-e-dispute',
    'An argument in the market',
    'Ezer the baker accused Menashe, a Samaritan merchant, of selling a jar of oil that held less than he paid for. Voices were raised, and people took sides without knowing the facts.',
  ),
  fiction(
    'rec-e-injured',
    'Someone on the road',
    'Below the bend, you found a traveler who had been robbed and hurt. What you did next was up to you.',
  ),
  fiction(
    'rec-e-arrival',
    'Journey’s end',
    'You reached Jericho, the city of palms, and brought Aunt Miriam’s remedy to Rivka’s house.',
  ),
  fiction(
    'rec-pl-market',
    'The lower market',
    'A busy fictional market in Jerusalem, near the gate where the road leads east and down toward Jericho.',
  ),
  fiction(
    'rec-pl-inn',
    'The wayside inn',
    'A fictional inn near Jericho where Salome takes in travelers. It is not meant to be the inn in Jesus’ story.',
  ),
  fiction(
    'rec-map',
    'The route down',
    'From Jerusalem’s east gate the road runs to a fork. The main road squeezes through a narrow bend between red cliffs. A dry wadi runs south-east and ends at a sudden drop. A shepherds’ path climbs the ridge, passes a cistern marked by cairns of three stones, and rejoins the road below the bend. From there it is a short walk to the inn and to Jericho. (The route details are fictional.)',
  ),
];

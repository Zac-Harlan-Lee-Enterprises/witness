# Source verification: *A Storm on Galilee* (Mark 4:35–41)

The claim-by-claim record behind the historical, geographical and interpretive notes in Chapter 2. It backs [`src/content/chapters/storm-on-galilee/sources.ts`](../../src/content/chapters/storm-on-galilee/sources.ts) and [`records.ts`](../../src/content/chapters/storm-on-galilee/records.ts). The model is Chapter 1's [source-verification.md](source-verification.md).

> **Provenance and status**
>
> - **Retrieval and checking were done by AI research assistants on 2026-09-25.** Every source below was fetched in that session. Most quotations were checked against the page's raw text (downloaded with curl and searched). A few pages were only read through a summarising fetch; these are marked *(summarised fetch)* and their wording must be spot-checked.
> - **Human citation verification is still required.** `verified: true` in `sources.ts` records only that the AI retrieval took place. Every educational record is at governance status `sources-attached`, shows "Awaiting editorial review" in the game, and can't be published until a named human approves it ([content-governance.md](../content-governance.md)).
> - Bible text was taken verbatim from the public-domain World English Bible (eBible.org, "World English Bible Classic") and the SBL Greek New Testament. **No verse text is stored in the game**: Scripture records hold references only, and the WEB text of Mark 4 is not added to the translation registry.
> - Quotations here are short (under 40 words).

**Confidence scale** (as `historicalConfidence`): *established* · *probable* · *possible* · *tradition* · *uncertain*.

## Summary

| # | Topic | Verdict | Confidence | Used by (records) |
|---|---|---|---|---|
| 1 | The storm passage and its parallels; only Mark has the "other boats" | VERIFIED | established | `rec-mark-4-35-41`, `rec-matt-8-23-27`, `rec-luke-8-22-25`, `rec-para-mark-4`, `rec-hist-other-boats` |
| 2 | Teaching from a boat; the sower (Mark 4:1–9); evening crossing (4:35–36) | VERIFIED | established | `rec-mark-4-1-9`, `rec-para-shore`, `rec-para-dinah`, `rec-para-evening` |
| 3 | The Greek of Mark 4:36–38 and Luke 8:22–23 | VERIFIED | established | `rec-hist-cushion`, `rec-hist-other-boats`, `rec-hist-storms` |
| 4 | The lake: size, depth, below sea level; "sea" and "lake" | VERIFIED | established | `rec-hist-lake` |
| 5 | Josephus on the lake, Gennesaret and its boats | VERIFIED (as what Josephus says) | established / uncertain (his numbers) | `rec-hist-lake`, `rec-hist-galilee-boat` |
| 6 | Why storms hit the lake suddenly | VERIFIED / PARTLY | established (afternoon westerly) / probable (night easterlies) | `rec-hist-storms` |
| 7 | The boat found at Ginosar in 1986 | VERIFIED | established; crew and mast probable | `rec-hist-galilee-boat` |
| 8 | "The cushion" as a ballast sandbag | VERIFIED (as a suggestion) | possible | `rec-hist-cushion` |
| 9 | Nets: cast net, dragnet, trammel; linen | VERIFIED | established / probable | `rec-hist-nets` |
| 10 | The fishing economy | PARTLY VERIFIED | established (family crews) / possible (leases and tolls) | `rec-hist-fishing-economy` |
| 11 | Magdala / Taricheae and salted fish | PARTLY VERIFIED | probable | `rec-hist-salting` |
| 12 | Capernaum | VERIFIED / PARTLY | established / probable | `rec-hist-capernaum`, `rec-recon-shore` |
| 13 | Fish of the lake; fins and scales | PARTLY VERIFIED | probable | `rec-hist-fish` |
| 14 | Handling a sail-and-oar boat | PARTLY VERIFIED | possible | `rec-recon-boat-handling` |
| 15 | Echoes of Psalm 107, Psalm 89 and Jonah; "Who is this?" | VERIFIED (as interpretations) | — | `rec-interp-who-is-this`, `rec-interp-echoes` |
| 16 | The boat as a figure of the Church (Tertullian, Augustine) | VERIFIED | — | `rec-interp-boat-church` |
| 17 | Fear and faith (Mark 4:40) read pastorally | VERIFIED | — | `rec-interp-fear-faith` |
| 18 | The range of views on the miracle | VERIFIED | — | `rec-interp-miracle-views` |
| 19 | Reflections on the "other boats" | VERIFIED | — | `rec-interp-same-storm` |
| 20 | The World English Bible is public domain | VERIFIED | established | (supports every `src-web-*` source) |

## Claims

### 1. The storm passage and its parallels

**Checked statement:** Mark 4:35–41, Matthew 8:23–27 and Luke 8:22–25 tell the story; only Mark says other boats were with Jesus' boat (4:36), and none says what happened to them.

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** WEB [Mark 4](https://ebible.org/eng-web/MRK04.htm) — 4:36 "Other small boats were also with him."; 4:38 "He himself was in the stern, asleep on the cushion"; [Matthew 8](https://ebible.org/eng-web/MAT08.htm) (no other boats; 8:26 "O you of little faith"); [Luke 8](https://ebible.org/eng-web/LUK08.htm) (no other boats; 8:25 "Where is your faith?"). C. C. Black, [Working Preacher 2024](https://www.workingpreacher.org/commentaries/revised-common-lectionary/ordinary-12-2/commentary-on-mark-435-41-6): "Only Mark refers to ‘other boats … with him’ (4:36c), but that escort fades away."
- **Notes:** In Mark, Jesus rebukes the wind before asking his question; in Matthew he asks first. `rec-interp-fear-faith` says "in Mark's telling" for that reason. The paraphrase (`rec-para-mark-4`) puts Jesus' words in indirect speech so nothing reads as a quotation.

### 2. Teaching from a boat, the sower, and the evening crossing

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** WEB [Mark 4](https://ebible.org/eng-web/MRK04.htm): 4:1 "he entered into a boat in the sea and sat down. All the multitude were on the land by the sea."; 4:3 "the farmer went out to sow"; 4:35–36 (evening; "they took him with them, even as he was, in the boat"). [Mark 5:1](https://ebible.org/eng-web/MRK05.htm): "They came to the other side of the sea, into the country of the Gadarenes."
- **Used in content:** Grandmother's line (`d-opening/n3`), Dinah's line (`d-dinah/d2`) and the evening narration (`d-evening/ev1`) are `paraphrase` lines linked to paraphrase records. Nobody in the game says what happened on the far shore.

### 3. The Greek

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** SBLGNT [Mark 4](https://ebible.org/grcsbl/MRK04.htm): 4:36 ἄλλα πλοῖα ("other boats"; the RP variant has πλοιάρια, "small boats"); 4:37 λαῖλαψ μεγάλη ἀνέμου; 4:38 ἐν τῇ πρύμνῃ ἐπὶ τὸ προσκεφάλαιον ("in the stern, on the cushion" — with the article). SBLGNT [Luke 8](https://ebible.org/grcsbl/LUK08.htm): 8:22 λίμνης ("lake"); 8:23 κατέβη λαῖλαψ ἀνέμου εἰς τὴν λίμνην ("a windstorm came down on the lake"). [Matthew 4:18](https://ebible.org/grcsbl/MAT04.htm) ἀμφίβληστρον; [Matthew 13:47](https://ebible.org/grcsbl/MAT13.htm) σαγήνῃ.

### 4. The lake

**Checked statement:** A freshwater lake about 21 km long and 11–13 km wide, about 210 m below sea level (it varies with rainfall), at most about 43 m deep, between the Galilee hills and the Golan Heights; Luke calls it a lake, and "the lake of Gennesaret" in 5:1.

- **Verdict:** VERIFIED · **Confidence:** established (approximate figures)
- **Sources:** [Wikipedia: Sea of Galilee](https://en.wikipedia.org/wiki/Sea_of_Galilee) — "elevation fluctuating between 215 and 209 metres … below sea level"; infobox 21 km × 13 km, max depth 43 m. [BiblePlaces](https://www.bibleplaces.com/seagalilee/) — "13 miles (21 km) long and 7 miles (11 km) wide". WEB [Luke 5:1](https://ebible.org/eng-web/LUK05.htm), [Luke 8:22–23](https://ebible.org/eng-web/LUK08.htm).
- **Notes:** Width and depth differ slightly between sources because the level varies; the record gives ranges. Britannica returned 403.

### 5. Josephus on the lake and its boats

- **Verdict:** VERIFIED as what Josephus wrote · **Confidence:** established that he says it; his numbers are his own
- **Source:** Josephus, *Jewish War* (Whiston), [Project Gutenberg #2850](https://www.gutenberg.org/cache/epub/2850/pg2850.txt): 3.506 (Whiston 3.10.7) "its waters are sweet, and very agreeable for drinking"; 3.516–519 the plain of Gennesar; 2.635 (Whiston 2.21.8) "all the ships that were upon the lake, which were found to be two hundred and thirty, and in each of them he put no more than four mariners."
- **Used in content:** Hanina's joke about carrying water across "a lake of sweet water"; `rec-hist-lake`; `rec-hist-galilee-boat`.

### 6. Why storms hit the lake suddenly

**Checked statement:** On most summer afternoons a Mediterranean sea breeze crosses the Galilee hills and plunges onto the warm lake, raising strong winds and waves. Some of the fiercest storms come from the east, off the Golan Heights; easterly storms occur October–May and strengthen at night and in the morning, helped by cold air draining down the slopes.

- **Verdict:** VERIFIED (westerly) / PARTLY VERIFIED (easterly timing) · **Confidence:** established / probable
- **Sources:**
  - P. Alpert et al., *Monthly Weather Review* 110 (1982), abstract via [OpenAlex](https://api.openalex.org/works/doi:10.1175/1520-0493(1982)110%3C0994:AMSOTS%3E2.0.CO;2): "the almost daily development of strong winds and an associated storm on the lake in the afternoon".
  - A. Bitan, *Boundary-Layer Meteorology* 21 (1981), [abstract](https://cris.tau.ac.il/en/publications/lake-kinneret-sea-of-galilee-and-its-exceptional-wind-system/): a westerly "plunges towards the lake"; "Late at night, a wind flow develops from the land towards the lake, which combines with the katabatic winds".
  - H. Saaroni et al., *Theor. Appl. Climatol.* 59 (1998), [PDF](https://www.tau.ac.il/~pinhas/papers/1998/Saaroni_et_al_TAC_1998.pdf): easterly storms "appear only from October-May"; "strengthening in the morning hours"; night-time land breeze and katabatic winds "contribute to the increasing of easterly winds during the night hours" (p. 70).
  - [BiblePlaces](https://www.bibleplaces.com/seagalilee/): "More violent are the winds that come off the hills of the Golan Heights to the east." T. Bolen, [Jerusalem Perspective](https://www.jerusalemperspective.com/1476/): "The most violent storms, however, are caused by the fierce winds which blow off the Golan Heights from the east."
- **Notes:** A secondary source (Saxum, citing Nun) puts the start of easterly storms in the early afternoon; the peer-reviewed climatology puts their peak in the morning. The game says only that such winds "can come at night". Saaroni covers all of Israel. **Nothing in the game says which wind struck in Mark 4.** The sky "signs" in the chapter (a cold breath off the eastern hills; a Magdala crew hauling their boat up high) are fiction consistent with these sources, and the reading-the-sky puzzle's answer admits no one can say when or how strong a wind will come. The chapter never names a season.

### 7. The boat found at Ginosar in 1986

- **Verdict:** VERIFIED · **Confidence:** established (discovery, size, date); probable (crew of five, mast step)
- **Sources:** S. Wachsmann, "The Galilee Boat—2,000-Year-Old Hull Recovered Intact", *BAR* 14:5 (1988), [COJS reproduction](https://cojs.org/galilee-boat-2000-year-old-hull-recovered-intact-shelley-wachsmann-bar-1405-sepoct-1988/): drought of 1985–86; "an average date of 40 B.C., plus or minus 80 years"; cedar planking and oak frames; "it had been repeatedly repaired"; "four rowers … and a helmsman—a crew of five"; "no proof that our boat played any part in these momentous events." Wachsmann, ["Ancient Seafaring on the Sea of Galilee"](https://www.jesusboat.com/jesusboat-archive/ancient-seafaring-and-the-jesus-boat/): "8.2 x 2.3 x 1.2 m"; a mast step ("four nail holes and a discoloration"). [Wikipedia: Sea of Galilee Boat](https://en.wikipedia.org/wiki/Sea_of_Galilee_Boat): "found by brothers Moshe and Yuval Lufan"; "pegged mortise and tenon joints". [Yigal Allon Centre](https://yigal-allon-centre.org.il/en/the-museum/the-ancient-boat/) (the museum; it spells the name "Lopen").
- **Notes:** The number of wood types differs between sources (7, 10, 12), so the game doesn't state one. No source gave "8.27 m"; the game uses 8.2 m. The chapter's painted boats and the player's family boat are loosely modelled on this hull (planked, round-bottomed, one mast, oars, a steering oar).

### 8. "The cushion"

- **Verdict:** VERIFIED as Wachsmann's suggestion · **Confidence:** possible
- **Source:** Wachsmann, *BAR* 1988 (COJS, above): "the definite article used in relation to the pillow indicates that this was part of the boat's equipment. This may have been a sandbag used for ballast." Sandbags "were stored beneath the stern deck".
- **Notes:** Presented as a suggestion. The game never shows Jesus asleep; this is background only.

### 9. Nets

- **Verdict:** VERIFIED · **Confidence:** established (cast net, dragnet); probable (trammel nets in the 1st century)
- **Sources:** K. C. Hanson, ["The Galilean Fishing Economy and the Jesus Tradition"](https://www.kchanson.com/ARTICLES/fishing.html), *BTB* 27 (1997): "the casting net (amphiblêstron), used either from a boat or along the shoreline (Matt 4:18); and the much larger dragnet (sagênê), used from a boat (Matt 13:47)". M. Nun, ["‘Let Down Your Nets’"](https://www.jerusalemperspective.com/2451/): "The trammel net is the only net from ancient times that is still used commercially on the Sea of Galilee."; "trammel-net fishing is done at night"; "In Jesus’ time fishing nets were made of linen thread". G. Franz, ["Greatest Fish Stories Ever Told"](https://www.ldolphin.org/fish-franz.html): trammel nets "are used only at night because the fish can see the nets in daylight." WEB [Matthew 4:18](https://ebible.org/eng-web/MAT04.htm), [13:47–48](https://ebible.org/eng-web/MAT13.htm).
- **Notes:** The New Testament never names a trammel net. The family's "trammel net" is plausible fiction.

### 10. The fishing economy

- **Verdict:** PARTLY VERIFIED · **Confidence:** established (family crews and hired men; partners) / possible (leases and tolls)
- **Sources:** WEB [Mark 1:19–20](https://ebible.org/eng-web/MRK01.htm) ("they left their father, Zebedee, in the boat with the hired servants"); [Luke 5:7, 10](https://ebible.org/eng-web/LUK05.htm) ("partners"). Hanson (above): an explicit model, "Adapting Rostovtzeff's model based on Egyptian and Syrian evidence", in which fishers were "part of a state regulated, elite-profiting enterprise". R. J. Myles, [*Bible and Interpretation* (2019)](https://bibleinterp.arizona.edu/articles/fishing-entrepreneurs-sea-galilee-unmasking-neoliberal-ideology-biblical-interpretation), summarising Hakola: the fish trade "gave an economic boost to the local economy" *(summarised fetch)*.
- **Notes:** The record says the details are debated. The fee, the debt, and Uncle Elazar's line that every family pays "one way or another" are fiction.

### 11. Magdala / Taricheae and salted fish

- **Verdict:** PARTLY VERIFIED · **Confidence:** probable
- **Sources:** Strabo, *Geography* 16.2.45, [LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/16B*.html): "At the place called Taricheae the lake supplies excellent fish for pickling". [Wikipedia: Magdala](https://en.wikipedia.org/wiki/Magdala): the Babylonian Talmud name "Magdala Nunayya … Tower of the Fishes"; the Tarichaea etymology "remains disputed". M. Zapata-Meza, [Bible History Daily (2016)](https://www.biblicalarchaeology.org/daily/archaeology-today/the-fishy-secret-to-ancient-magdalas-economic-growth/): "about 300 fishing weights"; "The port of Magdala is 700 meters long". C. Vilaroig, [Magdala.org (2020)](https://www.magdala.org/journal/history-the-best-salted-fish): "small pools that look like structures designed for salting fish"; "we can continue identifying Tarichaea with Magdala as most scholars do".
- **Notes:** The Talmud passage itself was not seen (cited through Wikipedia). Strabo's sentence sits in a passage about asphalt and does not name the lake. Nikanor's brine recipe ("seven measures") is fiction and labelled so.

### 12. Capernaum

- **Verdict:** VERIFIED / PARTLY · **Confidence:** established (fishing village, basalt) / probable (roofs, population, harbour in use)
- **Sources:** [Wikipedia: Capernaum](https://en.wikipedia.org/wiki/Capernaum): "fishing village"; "population of about 1,500 in the 1st century AD" (Reed 2002); "local black basalt"; roofs of "light wooden beams and thatch mixed with mud"; an ancient harbour west of the modern pier. Bolen, [Jerusalem Perspective](https://www.jerusalemperspective.com/1476/): "The Capernaum harbor … extended for more than 2500 feet (800 m.) along the shore". WEB [Matthew 4:13](https://ebible.org/eng-web/MAT04.htm), [Mark 1:21](https://ebible.org/eng-web/MRK01.htm), [Mark 2:1–4](https://ebible.org/eng-web/MRK02.htm) ("they removed the roof where he was").
- **Notes:** Wikipedia tags the mortarless-basalt sentence "citation needed"; the basalt itself is well attested. The game's jetty, houses and layout are fiction (`rec-recon-shore`). **For the 3D pass:** houses should be dark basalt fieldstone, not the painted placeholder's mudbrick (see [the chapter doc](../chapters/storm-on-galilee.md#notes-for-the-3d-realism-pass)).

### 13. Fish of the lake

- **Verdict:** PARTLY VERIFIED · **Confidence:** probable
- **Sources:** [Wikipedia: Sea of Galilee](https://en.wikipedia.org/wiki/Sea_of_Galilee): "Local fishermen talk of four types of fish: 'musht' (tilapia); sardin … 'biny' or Jordan barbel … and North African sharptooth catfish". Bolen: the catfish "is not considered kosher because of its lack of scales". WEB [Leviticus 11:9–12](https://ebible.org/eng-web/LEV11.htm). [ScienceDaily (2021)](https://www.sciencedaily.com/releases/2021/05/210525084317.htm) on Adler & Lernau: "Non-kosher fish bones were mostly absent from Judean settlements dating to the Roman era and later." *(summarised fetch)*
- **Notes:** Scaleless fish were eaten in earlier periods; the record says observant Jews avoided them, not that no one ate them.

### 14. Handling a sail-and-oar boat

- **Verdict:** PARTLY VERIFIED · **Confidence:** possible
- **Sources:** Wachsmann, jesusboat.com (above): the Migdal mosaic boat "had a mast, and a furled, square sail", oars, and a quarter rudder; *BAR* 1988: "The stern deck was the station of the helmsman." [Wikipedia: Square rig](https://en.wikipedia.org/wiki/Square_rig): classical square sails used "brailing lines which were used to both furl and reef the sail".
- **Notes:** Whether Galilean fishers used brails is not known, and no source on bailing was found (Mark 4:37 says only that the boat was filling). Tamar's order (brails, yard, oars, bail) is the game's fiction and labelled as such in `rec-recon-boat-handling` and in the puzzle's explanation.

### 15. Echoes of the Hebrew Scriptures; "Who is this?"

- **Verdict:** VERIFIED as interpretations
- **Sources:** WEB [Psalm 107:23–30](https://ebible.org/eng-web/PSA107.htm) (29: "He makes the storm a calm"), [Psalm 89:9](https://ebible.org/eng-web/PSA089.htm), [Jonah 1:4–6](https://ebible.org/eng-web/JON01.htm) (1:5 cargo thrown overboard; Jonah "fast asleep"). Black (above): "The correspondences with Psalm 107:23–30 are so striking that Mark 4:35–41 seems to be its christological reinterpretation." M. Skinner, [Working Preacher 2018](https://www.workingpreacher.org/commentaries/revised-common-lectionary/ordinary-12-2/commentary-on-mark-435-41-4): "The intertextual resonances alone do not necessarily mean that Jesus is God, as if the equation were so simple, but clearly he acts with God’s authority." S. Redd, [The Gospel Coalition](https://www.thegospelcoalition.org/article/jesus-sleep-storm/): Jonah "shares similar elements and language … which suggests Mark is evoking the story." John Chrysostom, [Homily 28 on Matthew](https://www.newadvent.org/fathers/200128.htm): "the sleep and the outward appearance showed man, the sea and the calm declared Him God."
- **Notes:** Presented as readings, with Skinner's caution in the sensitivity note. Wikipedia's "Calming the storm" article was checked and not used: it does not mention these echoes, and it quotes a reading (fear as "the want of Heavenly principles") that the game avoids.

### 16. The boat as a figure of the Church

- **Verdict:** VERIFIED
- **Sources:** Tertullian, [On Baptism 12](https://www.newadvent.org/fathers/0321.htm): "But that little ship did present a figure of the Church, in that she is disquieted in the sea, that is, in the world, by the waves, that is, by persecutions and temptations". Augustine, [Sermon 13 on the New Testament (63 Ben.)](https://www.newadvent.org/fathers/160313.htm) §1: "That ship also was a figure of the Church."; §3 "let us not despair; let us awake Christ".
- **Notes:** The words "your faith is asleep" do not occur in this translation, so the game doesn't use them. The sermon's main example of the storm is anger; the record says "anger or other passions".

### 17. Fear and faith

- **Verdict:** VERIFIED
- **Sources:** Pope Francis, [homily of 27 March 2020](https://www.vatican.va/content/francesco/en/homilies/2020/documents/papa-francesco_20200327_omelia-epidemia.html): "They had not stopped believing in him; in fact, they called on him." John Calvin, [Harmony of the Evangelists](https://ccel.org/ccel/c/calvin/calcom31/cache/calcom31.txt): "It is not every kind of fear that is opposed to faith." M. Stamper, [Working Preacher 2012](https://www.workingpreacher.org/commentaries/revised-common-lectionary/ordinary-12-2/commentary-on-mark-435-41): "following Jesus does not guarantee us, as individuals or as a church, a storm-free life".
- **Notes:** Chosen so the game never implies that fear or suffering means spiritual failure. Readings that do (Clowes via Wikipedia; Peter Chrysologus, "our faults provoke them") were found and deliberately not used.

### 18. What kind of event was it?

- **Verdict:** VERIFIED
- **Sources:** [Catechism of the Catholic Church §§547–550](https://www.vatican.va/archive/ENG0015/__P1L.HTM), §548: miracles "bear witness that he is the Son of God" (these paragraphs don't mention the storm). [Wikipedia: Miracles of Jesus](https://en.wikipedia.org/wiki/Miracles_of_Jesus): "For many Christians and Muslims, the miracles are believed to be actual historical events. Others, including many liberal Christians, consider these stories to be figurative."; Ehrman: historians can neither affirm nor deny them. A. Schweitzer, [*Quest*, ch. 5](http://www.earlychristianwritings.com/schweitzer/chapter5.html), on Paulus and the storm: "At that moment they gained the shelter of a hill which protected them from the wind". D. F. Strauss, [*Life of Jesus* §101](https://www.gutenberg.org/cache/epub/64037/pg64037.txt): "how easily legend might come to frame such a narrative". A. J. Hultgren, [*Word & World* 29/2 (2009)](https://wordandworld.luthersem.edu/wp-content/uploads/pdfs/29-2_Jesus/The%20Miracle%20Stories%20in%20the%20Gospels;%20The%20Continuing%20Challenge%20for%20Interpreters.pdf): a survey from Bultmann to the recent tendency "to affirm the essential historicity of the miracles of Jesus (even if not all of them)".
- **Notes:** No retrieved source says which view is the majority, so the record doesn't claim one. Sensitivity is `high`, with a note. No official Orthodox source was found.

### 19. Reflections on the "other boats"

- **Verdict:** VERIFIED
- **Sources:** D. S. Jacobsen, [Working Preacher 2021](https://www.workingpreacher.org/commentaries/revised-common-lectionary/ordinary-12-2/commentary-on-mark-435-41-5): "though we are in the same storm, we are not necessarily in the same boat." M. S. Tshehla, ["There Were Other Boats Too"](https://scriptura.journals.ac.za/pub/article/view/1338), *Scriptura* 116 (2018): asks whether the detail intimates Jesus' "consistent awareness of and openness to ‘others’".
- **Notes:** The idea that the detail preserves eyewitness memory is disputed (Bauckham, quoted by Tshehla), so the game doesn't use it.

### 20. The World English Bible

- **Verdict:** VERIFIED · **Source:** [eBible.org copyright page](https://ebible.org/eng-web/copyright.htm): "The World English Bible is in the Public Domain." The Scripture Connection still shows the placeholder, because no WEB text of Mark 4 is enabled (a human editorial decision; see [content-governance.md §3](../content-governance.md#3-scripture-text)).

## What is fiction

The family (Grandmother Shelomit, Uncle Elazar, Tamar), Yoezer, Old Hanina, Nikanor, Shifra, Ami, Oded, Dinah and the listeners; the house, the jetty and the layout of the shore; the six jars, the fee and the family's debt; the brine recipe; the signs in the sky; Tamar's order for a squall; the little rowing boat and everything that happens to it; and the family boat's turning back. Mark says the teacher's boat came to the other side (Mark 5:1) and says nothing about the other boats; in the game they are only ever seen from a distance.

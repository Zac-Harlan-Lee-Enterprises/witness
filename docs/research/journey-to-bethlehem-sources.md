# Source verification: *A Journey to Bethlehem* (Luke 2:1–20)

This is the claim-by-claim record behind the historical, geographical and interpretive notes in Chapter 3. The sources are catalogued in [`src/content/chapters/journey-to-bethlehem/sources.ts`](../../src/content/chapters/journey-to-bethlehem/sources.ts), and the records that use them are in [`records.ts`](../../src/content/chapters/journey-to-bethlehem/records.ts).

> **Provenance and status**
>
> - **Two AI research assistants retrieved and checked these sources on 2026-09-25.** Each source below was fetched in that session. Quotations were checked word for word against the page text. The lead author spot-checked the World English Bible text of Luke 2, the grammateus census page and the Carlson abstract.
> - "Via search snippet" means the text was seen only in a search result. Nothing seen only that way is cited in the game.
> - **Human citation verification is still required.** `verified: true` in `sources.ts` records only that the AI retrieval took place. All 42 educational records are at governance status `sources-attached`. None is approved, and each one is labelled "Awaiting editorial review" in the game ([content-governance.md](../content-governance.md)).
> - Quotations are short (under 30 words). No Bible passage is reproduced at length. The game never quotes Luke 2: a content test fails if distinctive World English Bible (WEB) wording from Luke 2 appears anywhere in the chapter.

**Confidence scale:** *established* · *probable* · *possible* · *tradition* · *uncertain*.

**Failed fetches:**

| Site | What happened |
|---|---|
| papyri.info | Bot-check page; no citation taken from it |
| whc.unesco.org/en/list/1492 | 403; the unesco.org news article was used instead |
| biblicalstudies.org.uk | 403; Bailey's article was read in its biblearchaeology.org reprint |
| degruyterbrill.com | 405 |
| cchp.ps | Expired TLS certificate |
| ritmeyer.com | Redirect did not load |
| studylight.org | 403 |

## Summary

| # | Topic | Verdict | Confidence | Used by |
|---|---|---|---|---|
| 1 | The census under Quirinius and its date | VERIFIED (disputed) | uncertain | `rec-hist-quirinius` |
| 2 | What a provincial census was for; Judas of Galilee | VERIFIED | established | `rec-hist-census`, `rec-acts-5-37` |
| 3 | "Each to his own city"; the Egyptian edict of AD 104 | PARTLY VERIFIED | uncertain | `rec-hist-own-city` |
| 4 | Roman Egyptian household census returns | PARTLY VERIFIED | established (Egypt) / possible (Judea) | `rec-recon-declaration`, `p-register`, `clue-model-order` |
| 5 | Date of the birth; the Chronograph of 354 | VERIFIED | uncertain | `rec-interp-date` |
| 6 | Magi and star only in Matthew; nativity scenes combine the accounts | VERIFIED | established | `rec-interp-two-accounts` |
| 7 | The cave tradition; the Church of the Nativity | VERIFIED as tradition | tradition | `rec-hist-cave` |
| 8 | Micah 5:2 in Matthew; Luke's "David's city" | VERIFIED (wording corrected) | established | `rec-interp-two-accounts`, `rec-hist-bethlehem` |
| 9 | WEB wording of Luke 2:1–20, 22:11, 10:34 | VERIFIED | established | `rec-luke-2-1-20`, `rec-para-luke-2`, `rec-para-report` |
| 10 | Bethlehem's setting; David and Jesse | VERIFIED | established | `rec-hist-bethlehem`, `rec-1sam-16-17`, `rec-para-david` |
| 11 | The well of Bethlehem by the gate | VERIFIED (text) / tradition (site) | established / tradition | `rec-hist-well`, `rec-para-well`, `rec-2sam-23-15` |
| 12 | Ruth and the threshing floor | VERIFIED | established | `rec-hist-threshing`, `rec-ruth-bethlehem` |
| 13 | Village houses with animals at one end | PARTLY VERIFIED | probable (reconstruction) | `rec-recon-house`, the house map |
| 14 | *katalyma*: inn or guest room? | VERIFIED (word facts) / CORRECTED (Carlson) | uncertain (meaning) | `rec-interp-katalyma`, `rec-luke-22-11` |
| 15 | The manger (*phatnē*) | VERIFIED (word) / PARTLY (archaeology) | probable | `rec-hist-manger` |
| 16 | Swaddling (Ezekiel 16:4) | VERIFIED (wording corrected) | established | `rec-hist-swaddling`, `rec-ezek-16-4` |
| 17 | Sheepfolds and counting the flock | VERIFIED (texts) / PARTLY (practice) | probable | `rec-hist-shepherds`, `rec-john-10-1-4`, `rec-jer-33-13` |
| 18 | Were shepherds despised? | PARTLY VERIFIED / debated | uncertain | `rec-hist-shepherd-status` |
| 19 | Shepherds' Field at Beit Sahour | VERIFIED as tradition | tradition | `rec-hist-fields` |
| 20 | Hospitality: Genesis 18, Leviticus 19:34, Luke 7:44; the seah | VERIFIED | established (texts) / uncertain (seah) | `rec-hist-hospitality`, `rec-para-abraham`, `p-bread` |
| 21 | Terraced hillsides; Battir | VERIFIED (dating caveats) | probable | `rec-hist-terraces` |
| 22 | Cold nights in the hills | VERIFIED (modern data) | established | `rec-hist-nights` |

---

## Claims

### 1. The census under Quirinius and its date

**Checked statement:**
- Luke says Jesus was born during a registration ordered by Augustus, "the first enrollment made when Quirinius was governor of Syria" (Luke 2:2, WEB).
- Luke 1:5 and Matthew 2:1 place the birth while Herod the Great was alive. Herod's death is usually dated to 4 BC; some scholars argue for 1 BC.
- Josephus describes Quirinius taking "an account of their substance" in Judea after Archelaus was removed. Modern scholars convert this to about AD 6.
- Scholars disagree about how these fit together. Many historians think Luke's date is mistaken. Others propose an earlier registration under Herod, an earlier role for Quirinius, or reading "first" as "before".

**Verdict:** VERIFIED that the dating problem is real and disputed. **Confidence:** uncertain (no solution is settled).

**Sources:**
- WEB Luke 2 <https://ebible.org/eng-web/LUK02.htm>, 2:2.
- WEB Luke 1 <https://ebible.org/eng-web/LUK01.htm>, 1:5.
- WEB Matthew 2 <https://ebible.org/eng-web/MAT02.htm>, 2:1.
- Josephus, *Antiquities* (Whiston), Project Gutenberg #2848 <https://www.gutenberg.org/cache/epub/2848/pg2848.txt>:
  - 17.13.2: "in the tenth year of Archelaus's government"
  - 18.1.1: "to take an account of their substance"
  - 18.2.1: "in the thirty-seventh year of Cæsar's victory over Antony at Actium"
  - Whiston's numbering; Loeb/Niese numbering differs.
- Wikipedia, "Census of Quirinius" <https://en.wikipedia.org/wiki/Census_of_Quirinius>: "Most critical scholars agree that Luke is in error…". The article also sets out the proposed defences (Brindle; Marshall on *prōtē*; Tertullian on Saturninus).
- Wikipedia, "Herod the Great" <https://en.wikipedia.org/wiki/Herod_the_Great>, section "Year of death: 4 or 1 BCE".
- S. R. Huebner, *Papyri and the Social World of the New Testament* (Cambridge UP, 2019), ch. III, publisher extract <https://www.cambridge.org/core/books/abs/papyri-and-the-social-world-of-the-new-testament/in-those-days-a-decree-went-out/7D9BD3CA2D29EF513B7805F8FFE28ECB>: "It is beyond historical doubt that Quirinius was governor of Syria from 6 to 12 ce…"
- D. Armitage, "Was Luke wrong about the census?" (Tyndale House, 2022) <https://tyndalehouse.com/2022/12/21/was-luke-wrong-about-the-census/>.

**Notes:**
- Josephus never writes "AD 6"; that is a modern conversion.
- A Judean census in AD 6 would not have covered Galilee.
- The record is marked `sensitivity: moderate` because it touches the historical reliability of Luke. It reports the problem and the proposals without taking a side.

### 2. What a provincial census was for; Judas of Galilee

**Checked statement:** A Roman provincial census recorded people and their taxable property so tax could be assessed. Josephus says Judas urged resistance, calling the taxation "no better than an introduction to slavery". Acts 5:37 mentions "Judas of Galilee" who "rose up in the days of the enrollment" (WEB).

**Verdict:** VERIFIED. **Confidence:** established.

**Sources:**
- Huebner, ch. III (URL above): "the information obtained made it possible to assess the annual tax liability of each individual…"
- Wikipedia, "Census of Quirinius", Overview: "…the names of the owners of taxable property, along with its value…"
- Josephus, *Antiquities* 18.1.1 (Whiston).
- WEB Acts 5 <https://ebible.org/eng-web/ACT05.htm>, 5:37.

**Notes:**
- In the game, the records paraphrase Acts rather than quote it.
- The puzzle's conclusion ("to know who lives where and what they own, so taxes can be worked out") is supported by the clerk's tablet in the game, not only by these sources.
- Huebner notes that censuses could also aid military recruitment. The puzzle therefore does not use "soldiers" as a wrong answer.

### 3. "Each to his own city"; the Egyptian edict

**Checked statement:** Luke 2:3 says "All went to enroll themselves, everyone to his own city" (WEB). No other evidence shows a Roman rule sending people to their *ancestral* towns. In AD 104 the prefect of Egypt, Gaius Vibius Maximus, ordered people away from their districts to "return to their own hearths" for the house-by-house census (P. Lond. 904). That order concerns Egypt a century later, and probably meant a person's registered home. Huebner suggests property ownership could explain Joseph's journey; this is possible but unproven.

**Verdict:** PARTLY VERIFIED. **Confidence:** uncertain.

**Sources:**
- WEB Luke 2:3.
- K. C. Hanson, "Census Edict for Roman Egypt" <https://www.kchanson.com/ANCDOCS/greek/census.html>, P. London 904, 104 CE: "…all those who are away from their nomes be summoned to return to their own hearths".
- Huebner, ch. III, "Return to One's Own Town".
- R. R. Cargill, University of Iowa FAQ <https://bam.sites.uiowa.edu/faq/can-you-explain-problem-census-gospel-luke>: "residents were not required to return to their ancestral homes, but to their present homes".
- Wikipedia, "Census of Quirinius", "Gospel of Luke": "no Roman census required that people travel from their own homes to those of their ancestors".

**Notes:**
- The game hedges this in fiction: Tamar says "*They say* everyone must be written down in their own family's town."
- Uncle Asa owns a share of a Bethlehem house. That gives him a plausible reason to register there, consistent with Huebner's suggestion and without asserting it.

### 4. Roman Egyptian household census returns

**Checked statement:**
- About 300 household returns survive on papyrus (3 BCE–259 CE), almost all from Egypt, where the dry climate preserves papyrus. From 33/34 CE they follow a 14-year cycle.
- A return named the declarant (usually the male head of the household) and the property, and listed household members with ages and relationships. It could end with an oath and the declarant's signature.
- No record of Joseph's registration is known. How registrations were written in Judea is not known.

**Verdict:** PARTLY VERIFIED. The Egyptian contents are verified. No retrieved source says outright that "nothing survives from Judea", so the game does not claim that. **Confidence:** established (Egypt); possible (applying it to Judea).

**Sources:**
- Ferretti, Fogarty, Nury & Schubert, "Census Declaration" (grammateus, University of Geneva) <https://grammateus.unige.ch/descriptions/decl_census>: "There are about 300 census returns from 3 BCE to 259 CE, and from 33/34 CE there appears to be a 14 year cycle…". Also: "may be followed by an oath verifying the contents of the return".
- Huebner, ch. III: returns record "age, sex, occupation, place of residence, familial relationships…".
- Bagnall & Frier, *The Demography of Roman Egypt*, ch. 1 abstract <https://www.cambridge.org/core/books/abs/demography-of-roman-egypt/census-returns/2AB2678F04674AF62220B03C7B0E50A9>.

**Used in the game:**
- The clerk's model tablet and the order of cards in `p-register`: declarant → where the household is registered → members with ages → property → oath and mark.
- Kallias is fictional. The record says the order is modelled on the Egyptian returns.

### 5. The date of the birth

**Checked statement:** Luke and Matthew give no day or month. The earliest firm evidence for 25 December is the Chronograph of 354; that part is usually dated to AD 336. Why that date was chosen is debated. The shepherds in the fields do not settle the season. Most scholars place the birth around 6–4 BC.

**Verdict:** VERIFIED. **Confidence:** uncertain (the date itself).

**Sources:**
- Wikipedia, "Date of the birth of Jesus" <https://en.wikipedia.org/wiki/Date_of_the_birth_of_Jesus>, lead; "Choice of 25 December"; "Season of birth".
- Wikipedia, "Chronograph of 354" <https://en.wikipedia.org/wiki/Chronograph_of_354>, Part 12.

### 6. Luke's account and Matthew's

**Checked statement:** The magi ("wise men" in the WEB) and the star are only in Matthew 2. Matthew says they came into "the house" and saw "the young child". Luke has the shepherds and the feeding trough. Nativity scenes combine both accounts, and Justin Martyr already puts the magi at the cave in the second century.

**Verdict:** VERIFIED. **Confidence:** established.

**Sources:**
- WEB Matthew 2 <https://ebible.org/eng-web/MAT02.htm>, 2:1–2, 9–11.
- Wikipedia, "Biblical Magi" <https://en.wikipedia.org/wiki/Biblical_Magi>.
- Wikipedia, "Nativity of Jesus" <https://en.wikipedia.org/wiki/Nativity_of_Jesus>.
- Justin Martyr, *Dialogue with Trypho* 78 (New Advent) <https://www.newadvent.org/fathers/01286.htm>.

### 7. The cave tradition

**Checked statement:**
- Luke mentions a feeding trough but no cave or stable.
- Justin Martyr (2nd century) says Joseph "took up his quarters in a certain cave near the village".
- Origen (c. AD 248) says "there is shown at Bethlehem the cave where He was born".
- Constantine's Church of the Nativity was built over the grotto and dedicated in AD 339; Justinian rebuilt it in the 6th century.

**Verdict:** VERIFIED as tradition. **Confidence:** tradition.

**Sources:**
- Justin Martyr, *Dialogue* 78 (above).
- Origen, *Against Celsus* I.51 (New Advent) <https://www.newadvent.org/fathers/04161.htm>.
- Wikipedia, "Church of the Nativity" <https://en.wikipedia.org/wiki/Church_of_the_Nativity>.

### 8. Micah 5:2; "David's city"

**Checked statement:** Matthew 2:5–6 quotes Micah about Bethlehem. Micah 5:2 in English Bibles is 5:1 in Hebrew Bibles. Luke does not quote Micah.

**Verdict:** VERIFIED with a correction: the WEB says **"David's city"** in Luke 2:4 and 2:11, not "the city of David". **Confidence:** established.

**Sources:**
- WEB Matthew 2:5–6.
- WEB Micah 5 <https://ebible.org/eng-web/MIC05.htm>, 5:2.
- WEB Luke 2:4, 2:11.

**Notes:** In the Old Testament, "David's city" means Zion in Jerusalem (WEB 2 Samuel 5:7, <https://ebible.org/eng-web/2SA05.htm>). `rec-hist-bethlehem` says so, so readers don't confuse the two.

### 9. WEB wording of Luke 2

**Checked:** the text of Luke 2:1–20 at <https://ebible.org/eng-web/LUK02.htm> was fetched and checked verse by verse.

Wording choices in the WEB:
- The WEB says "feeding trough", never "manger".
- It says "bands of cloth" in 2:7 but "strips of cloth" in 2:12.
- 2:7 says "no room for them in the inn".
- The WEB page labels itself "World English Bible Classic".

The SBLGNT (<https://ebible.org/grcsbl/>) has:
- κατάλυμα in 2:7 and 22:11;
- πανδοχεῖον in 10:34.

**Used for:**
- The paraphrase `rec-para-luke-2` and Hagit's labelled paraphrase lines (`rec-para-report`), both reworded so that no WEB sentence is reproduced.
- The content test's list of forbidden WEB phrases.

### 10. Bethlehem's setting; David and Jesse

**Checked statement:** Bethlehem is about 10 km (6 miles) south of Jerusalem, at about 775 m. David was the son of Jesse of Bethlehem and kept his father's sheep there. The book of Ruth is set there.

**Verdict:** VERIFIED. **Confidence:** established.

**Sources:**
- Wikipedia, "Bethlehem" <https://en.wikipedia.org/wiki/Bethlehem>: "about ten kilometres (six miles) south of Jerusalem"; "an elevation of about 775 meters".
- WEB 1 Samuel 16:1, 16:11 <https://ebible.org/eng-web/1SA16.htm>.
- WEB 1 Samuel 17:12, 17:15 <https://ebible.org/eng-web/1SA17.htm>.
- WEB Ruth 1:1, 1:19 <https://ebible.org/eng-web/RUT01.htm>.

### 11. The well by the gate

**Checked statement:** In 2 Samuel 23:15–16 (and 1 Chronicles 11:17), David longs for water "from the well of Bethlehem, which is by the gate". His mighty men bring it, and he pours it out to the LORD. The biblical well's location is unknown. Cisterns north of the town called "David's Wells" are a later tradition. Older commentators judged them too far from the town to be a well "by the gate".

**Verdict:** VERIFIED (text); tradition (site). **Confidence:** established / tradition.

**Sources:**
- WEB 2 Samuel 23 <https://ebible.org/eng-web/2SA23.htm>.
- BibleHub commentaries on 2 Samuel 23:15 (Cambridge Bible; Pulpit Commentary) <https://biblehub.com/commentaries/2_samuel/23-15.htm>: "…too far from the town to be described as 'at the gate.'"

**Notes:** In the game, Saba Amram retells the story as a labelled paraphrase and adds, in fiction: "Whether it was this very well, nobody really knows." The game's well is fictional.

### 12. Ruth and the threshing floor

**Checked statement:** Boaz winnows barley at night on the threshing floor (Ruth 3:2). A threshing floor is a flat, hard, open surface (beaten earth, paving or bedrock) where grain is threshed and winnowed. It was often in an open, breezy place.

**Verdict:** VERIFIED. **Confidence:** established.

**Sources:**
- WEB Ruth 3 <https://ebible.org/eng-web/RUT03.htm>.
- Wikipedia, "Threshing floor" <https://en.wikipedia.org/wiki/Threshing_floor>: "a specially flattened outdoor surface, usually circular and paved".

**Notes:** Ruth 3:3 says "go down" to the floor, so the game does not put it on a hilltop. It sits at the windy edge of the village.

**Added 2026-09-30 (in review):** Saba Amram's supper-time retelling (`rec-para-ruth`, a labelled paraphrase) was checked by an AI assistant against the WEB text of Ruth 1:1, 1:19 and 3:2 already stored in `translations.ts` (the same sources, `src-web-rut01` and `src-web-rut03`). It adds nothing the verses don't say, and Saba says in his own words that nobody knows whether the village's threshing floor is the one in the story. No new historical claim was added with it.

### 13. Village houses with animals at one end

**Checked statement:** Many scholars think ordinary village houses had one main room. The family lived and slept on a raised level. Animals were brought in at night to a lower area near the door, and mangers were built into the floor or at the edge of the raised level. This is a reconstruction.

**Verdict:** PARTLY VERIFIED. **Confidence:** probable.

**Sources:**
- K. E. Bailey, "The Manger and the Inn" (reprint) <https://biblearchaeology.org/research-articles/the-manger-and-the-inn/>. Bailey quotes Dalman (1935) on "a kind of raised terrace" and "the mangers are fixed either to the floor or to the wall, or at the edge of the terrace".
- WEB 1 Samuel 28:24 <https://ebible.org/eng-web/1SA28.htm>: a calf "in the house".
- WEB Luke 13:15 <https://ebible.org/eng-web/LUK13.htm>.
- Wikipedia, "Four-room house" <https://en.wikipedia.org/wiki/Four-room_house>: Iron Age houses whose ground floor "was used as a stable for livestock".
- G. Byers, ABR (2021) <https://biblearchaeology.org/research-articles/away-in-a-manger-but-not-in-a-barn-an-archaeological-look-at-the-nativity/>.

**Notes:**
- Bailey's evidence is modern ethnography plus New Testament inference. It does not come from excavated first-century houses in Bethlehem.
- Iron Age four-room houses are centuries earlier.
- **Used in the game:** Tamar's house (the straw end, stone mangers at the edge of the raised `platform`, steps up, a separate guest room). The house is labelled fictional.

### 14. *katalyma*: inn or guest room?

**Checked statement:**
- Luke 2:7 uses κατάλυμα. Luke 22:11 (and Mark 14:14) uses the same word for the "guest room" of the Last Supper. Luke 10:34 uses πανδοχεῖον for the Good Samaritan's inn.
- Translations differ: KJV, ESV, NRSV and WEB say "inn"; NIV and CSB say "guest room"; NLT says "lodging".
- Bailey argues for a guest room. Carlson argues for a generic "place to stay"; in context, he suggests a marital room too small for giving birth.
- No one can be certain. Luke never mentions an innkeeper.

**Verdict:** VERIFIED (word facts). CORRECTED on Carlson, whose thesis is "place to stay", not simply "guest room". **Confidence:** uncertain (the meaning in 2:7).

**Sources:**
- BibleHub G2646 <https://biblehub.com/greek/2646.htm> and G3829 <https://biblehub.com/greek/3829.htm>.
- WEB Luke 22:11 <https://ebible.org/eng-web/LUK22.htm>.
- SBLGNT Luke 2, 22 and 10.
- BibleGateway verse comparison <https://www.biblegateway.com/verse/en/Luke%202%3A7>.
- S. C. Carlson, *NTS* 56.3 (2010), abstract <https://www.cambridge.org/core/journals/new-testament-studies/article/abs/accommodations-of-joseph-and-mary-in-bethlehem-in-luke-27/E60EB9AEE5215FC0C989DE635DC80A7B>: "a generic sense of 'place to stay'".
- Bailey (above).
- Wikipedia, "Nativity of Jesus": "…it is impossible to be certain which is meant."

**Notes:** The record is marked `sensitivity: moderate`: the inn and innkeeper are loved parts of Christmas traditions.

### 15. The manger

**Checked statement:**
- *Phatnē* means a manger or feeding trough (sometimes a stall). It occurs in Luke 2:7, 12, 16 and 13:15.
- Stone troughs have been found in ancient buildings, for example at Megiddo, though the buildings' function is debated.
- Wooden troughs would rarely survive. Luke does not say what his was made of.

**Verdict:** VERIFIED (word); PARTLY VERIFIED (archaeology). **Confidence:** probable.

**Sources:**
- BibleHub G5336 <https://biblehub.com/greek/5336.htm>.
- WEB Luke 2.
- Wikipedia, "Tel Megiddo" <https://en.wikipedia.org/wiki/Tel_Megiddo>.
- Byers (ABR, above).

### 16. Swaddling

**Checked statement:** Wrapping a newborn was ordinary care. Ezekiel 16:4 pictures an abandoned baby who was not washed, salted or wrapped.

**Verdict:** VERIFIED, with a wording correction: the WEB says "wrapped in blankets", not "swaddled". **Confidence:** established.

**Sources:**
- WEB Ezekiel 16 <https://ebible.org/eng-web/EZK16.htm>.
- WEB Luke 2:7.
- Wikipedia, "Swaddling" <https://en.wikipedia.org/wiki/Swaddling>.

### 17. Sheepfolds and counting

**Checked statement:**
- Flocks were kept at night in walled folds, sometimes with thorny brushwood on top.
- John 10:1–4 speaks of a fold with a door and a gatekeeper.
- Leviticus 27:32 speaks of animals passing "under the rod". Jeremiah 33:13 speaks of flocks passing under the hands of the one who counts them, in the towns of Judah.
- Luke 2:8 says the shepherds were "staying in the field", not in a fold.

**Verdict:** VERIFIED (texts); PARTLY VERIFIED (details of practice). Easton and ISBE describe 19th-century observed practice. **Confidence:** probable.

**Sources:**
- WEB Numbers 32:16 <https://ebible.org/eng-web/NUM32.htm>.
- WEB John 10 <https://ebible.org/eng-web/JHN10.htm>.
- WEB Leviticus 27 <https://ebible.org/eng-web/LEV27.htm>.
- WEB Jeremiah 33 <https://ebible.org/eng-web/JER33.htm>.
- Easton's, "Shepherd" <https://www.biblestudytools.com/dictionaries/eastons-bible-dictionary/shepherd.html>: "counting them as they passed under the rod at the door".
- ISBE, "Sheepcote; Sheepfold" <https://www.internationalstandardbible.com/S/sheepcote-sheepfold.html>: "These folds are simple walled enclosures".

**Used in the game:**
- The fold is built from `sheepfold` walls with thorn brush.
- Yonatan counts the flock through the gate under his staff.
- The fold and its shepherds are fictional and are **not** the shepherds of Luke 2.

### 18. Were shepherds despised?

**Checked statement:**
- The popular claim that shepherds were despised and barred as witnesses rests mostly on rabbinic texts from well after the first century. The Talmud's disqualification (Sanhedrin 25b) is tied to grazing flocks on other people's land.
- Several writers find no first-century evidence that shepherds were outcasts.
- Scripture often honours shepherds (David; Psalm 23).
- Shepherds were ordinary working people. How others saw them in Luke's day is uncertain.

**Verdict:** PARTLY VERIFIED / debated. **Confidence:** uncertain.

**Sources:**
- Babylonian Talmud, Sanhedrin 25b:16–18 (Sefaria API) <https://www.sefaria.org/api/texts/Sanhedrin.25b.16-17>: "…the Sages issued a decree that they are disqualified from bearing witness."
- D. Croteau (Lifeway Research, 2015) <https://research.lifeway.com/2015/12/17/christmas-urban-legends-shepherds-as-outcasts/>: "I was unable to find even one source from first-century Israel…"
- M. Mowczko (2025) <https://margmowczko.com/shepherds-despised-outcasts/>.
- WEB Psalm 23:1 <https://ebible.org/eng-web/PSA023.htm>.

**Notes:**
- These are popular-level pieces by scholars and writers.
- Joachim Jeremias's *Jerusalem in the Time of Jesus* (the usual source of the "despised" view) was not retrieved.

### 19. Shepherds' Field

**Checked statement:** Luke says only that there were shepherds "in the same country staying in the field". Christian tradition places the announcement at Beit Sahour, east of Bethlehem, where Catholic and Greek Orthodox sites mark a "Shepherds' Field". The exact place is unknown.

**Verdict:** VERIFIED as tradition. **Confidence:** tradition.

**Sources:**
- WEB Luke 2:8.
- Wikipedia, "Beit Sahour" <https://en.wikipedia.org/wiki/Beit_Sahour>.

### 20. Hospitality and the seah

**Checked statement:** Abraham welcomes three visitors, offers water for their feet and has cakes made from "three seahs of fine meal" (Genesis 18:4, 6, WEB). The seah's volume is debated, with estimates from about 7 litres to over 14. Leviticus 19:34 commands love for the foreigner. In Luke 7:44 Jesus notes that his host gave no water for his feet.

**Verdict:** VERIFIED. **Confidence:** established (texts); uncertain (volume).

**Sources:**
- WEB Genesis 18 <https://ebible.org/eng-web/GEN18.htm> (its footnote: "1 seah is about 7 liters").
- Wikipedia, "Seah (unit)" <https://en.wikipedia.org/wiki/Seah_(unit)>: "The exact volume referred to by a se'ah is debated".
- WEB Leviticus 19.
- WEB Luke 7 <https://ebible.org/eng-web/LUK07.htm>.

**Used in the game:**
- Tamar's family saying ("guests get Abraham's bread") is a labelled paraphrase.
- The bread puzzle's "measures" are simplified, and the record says so.

### 21. Terraced hillsides

**Checked statement:** Farmers around Jerusalem and Bethlehem built dry-stone terraces for vines, olives and gardens. Battir became a UNESCO World Heritage Site in 2014. Dating any particular terrace is hard; luminescence dating near Jerusalem found many built long after Bible times.

**Verdict:** VERIFIED with caveats. **Confidence:** probable.

**Sources:**
- UNESCO news (2014) <https://www.unesco.org/en/articles/palestine-land-olives-and-vines-cultural-landscape-southern-jerusalem-battir-inscribed-world>.
- Wikipedia, "Terrace (earthworks)" <https://en.wikipedia.org/wiki/Terrace_(earthworks)>: "a lack of consensus among scholars regarding their construction date".

### 22. Cold nights in the hills

**Checked statement:** By modern measurements, Bethlehem's average winter lows are about 6–8 °C (Dec 7.6, Jan 6.8, Feb 6.4). Luke gives no season.

**Verdict:** VERIFIED (modern data). **Confidence:** established.

**Sources:** Wikipedia, "Bethlehem", climate table (Palestinian Meteorological Department).

**Notes:** Wikipedia's prose ("1 to 13 degree Celsius" in January) disagrees with its own table. The game uses the table.

---

## What is fiction

Everything the player does is fiction:
- **People:** Tamar's household, Uncle Asa, Aunt Peninah and Dodi; Kallias the clerk; Hagit; Yonatan and Old Yoram; Zerah of Tekoa.
- **Places:** the house, the lanes, the well and threshing floor as drawn, the fold, the terraces, the lamb and the gully.

Each has a `fiction` record.

The people of Luke 2 never appear or speak: Mary, Joseph, the baby, the shepherds who saw the angels, and the angels. The player hears of them only through:
- Scripture references;
- the labelled paraphrase `rec-para-luke-2`;
- Hagit's labelled paraphrase of what the shepherds said (`rec-para-report`).

The record notes that Luke names no one who heard the shepherds.

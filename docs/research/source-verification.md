# Source verification: *The Road to Jericho* (Luke 10:25–37)

This is the claim-by-claim record behind the historical, geographical and interpretive notes in Chapter 1. It is referenced from [`src/content/shared/sources.ts`](../../src/content/shared/sources.ts) and [`src/content/chapters/road-to-jericho/records.ts`](../../src/content/chapters/road-to-jericho/records.ts).

> **Provenance and status**
>
> - **Retrieval and checking were done by an AI research assistant on 2026-09-24.** Every source listed below was fetched or read in that session unless the notes say otherwise. ("Via search snippet" means the text was seen only in a search result.)
> - **Human citation verification is still required.** No person has yet opened these sources to confirm the quotations, locators and conclusions. `verified: true` in `sources.ts` records only that the AI retrieval took place. Every educational record is still at governance status `sources-attached`, is labelled "Awaiting editorial review" in the game, and can't be published until a named human approves it ([content-governance.md](../content-governance.md)).
> - The working notes (`research-findings.md`/`.json` and a machine-readable copy of the WEB passage) were kept in a temporary session folder and are **not** in the repository. **This document is the permanent record.** The verbatim WEB text of Luke 10:25–37 is stored, switched off, in [`src/content/scripture/translations.ts`](../../src/content/scripture/translations.ts).
> - Quotations are short, kept under 30 words. Long Bible passages are deliberately not reproduced here.

**Confidence scale** (the same values as `historicalConfidence` in the content model): *established* · *probable* · *possible* · *tradition* · *uncertain*.

**Verdicts:** VERIFIED means the claim as stated is supported. PARTLY VERIFIED means the core is supported but some parts are not, and those parts are marked UNVERIFIED in the notes. The tally is **16 VERIFIED, 5 PARTLY VERIFIED, 0 corrected, 0 unverified.**

---

## Summary

"Used by" lists the content records that cite a source used for the claim (checked by matching source ids between `sources.ts` and `records.ts`).

| # | Topic | Verdict | Confidence | Used by (records) |
|---|---|---|---|---|
| 1 | Road length and descent; elevations | VERIFIED | established (elevations) / probable (length) | `rec-hist-descent` |
| 2 | "Ascent of Adummim" (Josh 15:7; 18:17); "red" | VERIFIED | established | `rec-hist-adummim`, `rec-josh-15-7`, `rec-hist-road-danger` |
| 3 | The road's reputation for robbers | PARTLY VERIFIED | probable | `rec-hist-road-danger` |
| 4 | Jericho, "city of palm trees" | PARTLY VERIFIED | established (Deut 34:3, 2 Chr 28:15) / probable (Judges) | `rec-hist-jericho`, `rec-deut-34-3` |
| 5 | 2 Chr 28:15 as possible background | VERIFIED | established (text) / possible (influence) | *none* |
| 6 | Jews and Samaritans: John 4:9, Luke 9:52–54, John 4:20 | VERIFIED | established | `rec-hist-samaritans`, `rec-john-4-9`, `rec-luke-9-52-54` |
| 7 | Denarius as a day's wage (Matt 20:2) | VERIFIED | probable | `rec-hist-coins`, `rec-matt-20-2` |
| 8 | Oil and wine on wounds | VERIFIED | established | `rec-hist-oil-wine`, `rec-isa-1-6` |
| 9 | Priests living in Jericho | PARTLY VERIFIED | probable (priests) / uncertain (numbers, Levites) | `rec-hist-priests-levites` |
| 10 | *pandocheion*; "Inn of the Good Samaritan" site | VERIFIED | established (word) / tradition (site) | `rec-hist-inn` |
| 11 | Flash floods from rain in the hills | VERIFIED | established | `rec-hist-floods` |
| 12 | Wadi Qelt between Jerusalem and Jericho | VERIFIED | established | `rec-hist-floods` (also `rec-hist-adummim` via the Adummim article) |
| 13 | Augustine's allegory (QE 2.19); the ethical reading | VERIFIED | established | `rec-interp-augustine`, `rec-interp-neighbor` |
| 14 | The prutah | VERIFIED | probable | `rec-hist-coins` |
| 15 | The "log" (Lev 14:10) and its volume | VERIFIED (reference) | established (reference) / uncertain (volume) | `rec-hist-measures` |
| 16 | Josephus, *War* 4.451–475, on Jericho | VERIFIED | established | `rec-hist-jericho`, `rec-hist-descent` |
| 17 | The World English Bible is public domain | VERIFIED | established | *no record*: supports the translation registry |
| 18 | WEB text of Luke 10:25–37 | VERIFIED | established | `rec-luke-10-25-37`, `rec-para-luke-10`, `rec-para-yair` (and every record citing `src-web-luk10`) |
| 19 | Lev 19:18, Lev 19:34, Deut 6:5 | VERIFIED | established | `rec-lev-19-18`, `rec-lev-19-34`, `rec-deut-6-5`, `rec-para-love-commands`, `rec-hist-love-commands` |
| 20 | A Roman road in Jesus' day? | PARTLY VERIFIED | probable | `rec-hist-road-surface` |
| 21 | Walking time | PARTLY VERIFIED | possible | *none* (only hedged fictional wording) |

---

## Claims

### 1. Road length and elevation drop

**Checked statement:** Jerusalem sits at about 754 m (2,474 ft); the Old City is about 760 m. Jericho is about 258 m (846 ft) *below* sea level, so the road drops roughly 1,000 m (about 3,300 ft). Josephus gives the distance from Jericho to Jerusalem as 150 stadia. At the common reckoning of about 185 m per stadion that is about 27–28 km (about 17 miles), but the length of a stadion varied. Modern walking routes are about 24–25 km.

- **Verdict:** VERIFIED · **Confidence:** established (elevations); probable (road length)
- **Sources**
  - Wikipedia, "Jerusalem": <https://en.wikipedia.org/wiki/Jerusalem>. Infobox "754 m (2,474 ft)"; Old City "approximately 760 m".
  - Wikipedia, "Jericho": <https://en.wikipedia.org/wiki/Jericho>. "…258 m (846 ft) below sea level in an oasis in Wadi Qelt…"
  - Josephus, *Jewish War* 4.474. Greek on Perseus: <https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0147:book=4:section=474>. Whiston translation on Project Gutenberg: <https://www.gutenberg.org/cache/epub/2850/pg2850.txt> ("one hundred and fifty furlongs from Jerusalem… desert and stony").
  - Also consulted: Wikipedia, "Wadi Qelt" (<https://en.wikipedia.org/wiki/Wadi_Qelt>), a modern hike of 25 km with an 850 m descent; BiblePlaces.com (claim 21).
- **Notes**
  - The drop, 754 − (−258) ≈ 1,012 m, is the assistant's arithmetic from the cited figures.
  - The Britannica page returned HTTP 403. A search snippet gave "more than 820 feet (250 meters) below sea level", which is consistent.
  - **Do not use** the elevations quoted from Martin Luther King Jr.'s 1968 speech (about 1,200 ft above and 2,200 ft below). Both are wrong.
- **Used in content:** `rec-hist-descent` (`src-wiki-jerusalem`, `src-wiki-jericho`, `src-josephus-war-4`).

### 2. "The ascent of Adummim" and the meaning "red"

**Checked statement:** Joshua 15:7 and 18:17 name "the ascent of Adummim" as a boundary marker between Judah and Benjamin. "Adummim" comes from Hebrew *adom*, "red", usually explained by the reddish rock of the area.

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources**
  - WEB, Joshua 15:7: <https://ebible.org/eng-web/JOS15.htm> ("…faces the ascent of Adummim…")
  - WEB, Joshua 18:17: <https://ebible.org/eng-web/JOS18.htm> ("…opposite the ascent of Adummim.")
  - Wikipedia, "Adummim": <https://en.wikipedia.org/wiki/Adummim> ("related to אָדֹם adom, the Hebrew word for 'red'…")
  - Easton's Bible Dictionary (1897, public domain), CCEL: <https://www.ccel.org/ccel/easton/ebd2.html?term=Adummim> ("The red ones…")
- **Notes:** Wikipedia cites Pitkänen (2010): "The location of Adummim is unclear." The general area is agreed, but not the exact spot. "Ascent of Blood" is a later name (claim 3).
- **Used in content:** `rec-hist-adummim`, `rec-josh-15-7` (`src-web-jos15`, `src-wiki-adummim`); the "red" etymology in `rec-hist-road-danger` (`src-wiki-adummim`).

### 3. The road's reputation for robbers

**Checked statement:** Luke's story takes robbers on this road for granted. The clearest ancient statements come later:
- Strabo (around the turn of the era) says Pompey (63 BCE) destroyed "haunts of robbers" and tyrants' strongholds, two of them "on the passes leading to Hiericus [Jericho]".
- Eusebius (early 4th century) mentions a garrison at Maledomni (Adummim).
- Jerome, Letter 108.12 (404 CE), calls Adummim "the Place of Blood" because of "frequent incursions of marauders".
- Roman and rabbinic sources describe highway robbery in the region generally.

- **Verdict:** PARTLY VERIFIED · **Confidence:** probable that the road was dangerous in Jesus' day. The explicit "blood" name is documented only from the 4th–5th century onward.
- **Sources**
  - Jerome, Letter 108 §12 (NPNF), New Advent: <https://www.newadvent.org/fathers/3001108.htm> ("…the Place of Blood, so-called because much blood was shed there…")
  - Eusebius, *Onomasticon* §70 "Adommim", with Jerome's Latin additions (tertullian.org translation): <https://www.tertullian.org/fathers/eusebius_onomasticon_02_trans.htm> ("…A garrison is there.")
  - Strabo, *Geography* 16.2.40 (Loeb, LacusCurtius): <https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/16B*.html>
  - Israel Roll, "The Roman Road System in Judaea", *The Jerusalem Cathedra* 3 (1983), pp. 136–161: <https://milestones.kinneret.ac.il/wp-content/uploads/2018/02/the_roman_road_system_in_judea2.pdf> ("…many stories and references to incidents of robbery along highways.")
- **Notes**
  - Jerome's "blood" explanation is a folk etymology. The name more likely refers to red rock (claim 2). "Ascent of Blood" is the Crusader-era name, and the Arabic is *Tal'at ed-Damm*.
  - Strabo's phrase joins "haunts of robbers" and "treasure-holds of the tyrants". It does not say directly that robbers lived *on the Jericho road*.
  - The tertullian.org translation of Jerome's Latin says the blood was shed "by the soldiers". The Latin was not checked, so "by soldiers" versus "by robbers" is **UNVERIFIED**.
  - Supportable wording for the game: "People in later centuries called part of this road 'the Place of Blood' because of robbers." **Not** documented: "In Jesus' day it was called the Way of Blood."
- **Used in content:** `rec-hist-road-danger` (`src-strabo-16`, `src-jerome-108`, `src-wiki-adummim`, `src-web-luk10`). Eusebius and Roll's robbery remark are not cited by any record; Roll is cited for claim 20.

### 4. Jericho, "the city of palm trees"

**Checked statement:** Deuteronomy 34:3 and 2 Chronicles 28:15 call Jericho "the city of palm trees" explicitly. Judges 1:16 and 3:13 speak of "the city of palm trees" without naming Jericho. Reading those as Jericho is a common and reasonable inference, not something the verses state.

- **Verdict:** PARTLY VERIFIED (all four references exist; only two name Jericho) · **Confidence:** established (Deut 34:3, 2 Chr 28:15); probable (the Judges identifications)
- **Sources:** WEB Deut 34:3: <https://ebible.org/eng-web/DEU34.htm>; WEB Judg 1:16: <https://ebible.org/eng-web/JDG01.htm>; WEB Judg 3:13: <https://ebible.org/eng-web/JDG03.htm>; WEB 2 Chr 28:15: <https://ebible.org/eng-web/2CH28.htm>.
- **Notes:** Whether any scholars place the Judges "city of palm trees" somewhere else was not researched (UNVERIFIED either way). For Jericho's palms in Roman times, see claim 16.
- **Used in content:** `rec-hist-jericho`, `rec-deut-34-3` (`src-web-deu34`). Judges and 2 Chronicles are not cited in the content.

### 5. 2 Chronicles 28:15 as possible background to the parable

**Checked statement:** In 2 Chronicles 28:8–15, men of the northern kingdom of Israel, urged on by the prophet Oded, release captives from Judah. They clothe, feed and anoint them, carry the weak on donkeys, and bring them to Jericho. Several scholars see a possible model for the parable here, but there is no consensus.

- **Verdict:** VERIFIED · **Confidence:** established (the text); possible (its influence on Luke)
- **Sources**
  - WEB, 2 Chr 28:15: <https://ebible.org/eng-web/2CH28.htm>
  - F. Scott Spencer, "2 Chronicles 28:5–15 and the Parable of the Good Samaritan", *Westminster Theological Journal* 46:2 (1984), from p. 317 (abstract page): <https://www.galaxie.com/article/wtj46-2-04/>
  - Maurice Ryan, "Revisiting the Parable of the Good Samaritan", *Studies in Christian-Jewish Relations* 16/1 (2021): 1–15: <https://ejournals.bc.edu/index.php/scjr/article/download/13987/10613/29105> ("A consensus among scholars on the specific influence of Chronicles on Luke's parable is lacking.")
- **Notes:** The helpers were northern Israelites (Ephraimites, v.12), not the later Samaritan religious community. Calling them "Samaritans" is anachronistic; say "people from Samaria / the northern kingdom of Israel".
- **Used in content:** none. No source id exists for 2 Chronicles 28 in `sources.ts`.

### 6. Jews and Samaritans: John 4:9, Luke 9:52–54, John 4:20

**Checked statement (WEB wording):** John 4:9 notes "(For Jews have no dealings with Samaritans.)". In Luke 9:52–53 a Samaritan village "didn't receive him" because he was heading for Jerusalem. In 9:54 James and John offer to call down fire, and in 9:55 Jesus rebukes them. John 4:20 contrasts "this mountain" with Jerusalem. The verse doesn't name the mountain; it is identified as Mount Gerizim from context and Samaritan tradition.

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** WEB John 4: <https://ebible.org/eng-web/JHN04.htm>; WEB Luke 9: <https://ebible.org/eng-web/LUK09.htm>; Wikipedia, "Mount Gerizim": <https://en.wikipedia.org/wiki/Mount_Gerizim> ("the holiest place for the Samaritans…").
- **Notes**
  - Relations were strained but not uniformly hostile. Ryan (2021): "…strained, but not broken."
  - Wikipedia articles give different dates for John Hyrcanus's destruction of the Gerizim temple: about 110 BCE ("Samaritans"), 112–111 BCE ("Mount Gerizim") and 128 BCE (the parable article). Say "late 2nd century BCE".
  - **Sensitivity:** Samaritans are a small living community today (Wikipedia gives around 800+ people). Portray them respectfully and never use caricatures.
- **Used in content:** `rec-hist-samaritans` (`src-web-jhn04`, `src-web-luk09`, `src-ryan-scjr`, `src-wiki-gerizim`); `rec-john-4-9`; `rec-luke-9-52-54`.

### 7. The denarius as a day's wage (Matthew 20:2)

**Checked statement:** In the parable of the vineyard workers, laborers are hired "for a denarius a day". Historians use this, with other evidence, to treat a denarius as a typical day's pay for an unskilled worker. It was a common rate, not a fixed wage.

- **Verdict:** VERIFIED · **Confidence:** probable
- **Sources:** WEB Matt 20:2: <https://ebible.org/eng-web/MAT20.htm>; Wikipedia, "Denarius": <https://en.wikipedia.org/wiki/Denarius> ("…would be paid 1 denarius/day").
- **Notes:** Matthew 20 is itself a parable. Two denarii (Luke 10:35) is therefore roughly two days' wages. Don't give a modern cash equivalent as fact.
- **Used in content:** `rec-hist-coins` (`src-web-mat20`, `src-wiki-denarius`); `rec-matt-20-2`.

### 8. Oil and wine for wounds

**Checked statement:** In Luke 10:34 the Samaritan binds the wounds, "pouring on oil and wine". Isaiah 1:6 pictures wounds not "soothed with oil" (the WEB wording). The Hippocratic *On Ulcers* advises wetting wounds only with wine and using cloth "wetted in wine and oil".

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** WEB Luke 10:34: <https://ebible.org/eng-web/LUK10.htm>; WEB Isaiah 1:6: <https://ebible.org/eng-web/ISA01.htm>; Hippocrates, *On Ulcers* (tr. Francis Adams), Internet Classics Archive: <https://classics.mit.edu/Hippocrates/ulcers.mb.txt>.
- **Notes:** Use the WEB's "soothed with oil", not "softened". The Hippocratic works are centuries older than Luke. Present oil and wine as the ordinary first aid of the time, not as a proven treatment.
- **Used in content:** `rec-hist-oil-wine` (`src-hippocrates-ulcers`, `src-web-isa01`, `src-web-luk10`), which uses "soothed with oil" and adds "It is not medical advice!"; `rec-isa-1-6`.

### 9. Priests (and Levites) living in Jericho

**Checked statement:** The usual source is a baraita quoted in the Babylonian Talmud, Ta'anit 27a: half of each priestly watch would go up to Jerusalem from Jericho. Joshua Schwartz (JQR 1988) argues that Jericho had a large priestly population in the Second Temple period. The Talmudic text is late (around 500 CE) and its historical reliability is debated. Figures such as John Wesley's "twelve thousand priests and Levites" are unsupported.

- **Verdict:** PARTLY VERIFIED · **Confidence:** probable (many priests); uncertain (any numbers). Levites specifically are **UNVERIFIED**.
- **Sources**
  - Babylonian Talmud, Ta'anit 27a (William Davidson translation), Sefaria: <https://www.sefaria.org/Taanit.27a>
  - Joshua Schwartz, "On Priests and Jericho in the Second Temple Period", *JQR* 79 (1988): 23–48 (JSTOR: <https://www.jstor.org/stable/1454416>). The bibliographic details were confirmed, but **the article itself was not read** (paywalled). It was quoted second-hand through Ryan (2021).
  - Wikipedia, "Jericho": <https://en.wikipedia.org/wiki/Jericho> (Wesley's claim)
- **Notes:** Safe wording is "Many priests are thought to have lived in Jericho." Give no numbers, and don't state "half of all priests" as fact.
- **Used in content:** `rec-hist-priests-levites` (`src-talmud-taanit-27a`, `src-ryan-scjr`, `src-web-luk10`). It says a later tradition links many priests to Jericho, notes that historians debate its reliability, and gives no numbers. Schwartz is not cited.

### 10. The Greek word *pandocheion* and the "Inn of the Good Samaritan"

**Checked statement:** Luke 10:34 uses πανδοχεῖον (*pandocheion*, a public inn), and 10:35 uses πανδοχεύς (host). Strong's defines the word as "all-receptive… a public lodging-place (caravanserai or khan)". Luke 2:7 uses a different word, κατάλυμα. A traditional site on the road is called the Inn of the Good Samaritan (Khan al-Hatrura / al-Hatruri) and is now a mosaic museum. Linking it to the parable is Christian tradition; the inn in a parable can't be identified with a real building.

- **Verdict:** VERIFIED · **Confidence:** established (the word); tradition (the site)
- **Sources:** SBL Greek New Testament (CC BY 4.0), Luke 10: <https://ebible.org/grcsbl/LUK10.htm> (and Luke 2: <https://ebible.org/grcsbl/LUK02.htm>); LSJ/Strong's entry: <https://lsj.gr/wiki/πανδοχεῖον>; Wikipedia, "Inn of the Good Samaritan": <https://en.wikipedia.org/wiki/Inn_of_the_Good_Samaritan>.
- **Notes**
  - The present building was "rebuilt in its present shape in 1903". A 6th-century hostel and church stood there earlier.
  - The site is in the West Bank near Ma'ale Adumim. Keep references to "a traditional site", with no modern political framing.
  - It is sometimes confused with Khan al-Ahmar, which is a different khan.
- **Used in content:** `rec-hist-inn` (`src-sblgnt-luk10`, `src-wiki-inn-good-samaritan`). The game's own inn is fictional and says so (`rec-pl-inn`).

### 11. Flash floods from rain in the hills to the west

**Checked statement:** The Judaean Desert lies in the rain shadow east of the Judaean hills. Western Jerusalem gets about 600 mm of rain a year and the east about 100 mm or less. Rain in the hills can send flash floods down dry wadis where no rain falls. The Dead Sea region is prone to flash floods.

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Wikivoyage, "Judaean Desert": <https://en.wikivoyage.org/wiki/Judaean_Desert> (a travel wiki); Wikipedia, "Judaean Desert": <https://en.wikipedia.org/wiki/Judaean_Desert>; Wikipedia, "Flash flood": <https://en.wikipedia.org/wiki/Flash_flood>; U. Dayan & E. Morin (2006), "Flash flood-producing rainstorms over the Dead Sea: A review", GSA Special Paper 401: 53–62: <https://cris.huji.ac.il/en/publications/flash-flood-producing-rainstorms-over-the-dead-sea-a-review>.
- **Notes:** This is modern physical geography, and the parable doesn't mention floods. Present a flood hazard as a real feature of the landscape, not as part of Luke's story.
- **Used in content:** `rec-hist-floods` (`src-wiki-judaean-desert`, `src-dayan-floods`, `src-wiki-wadi-qelt`), which states "The Bible passage itself doesn't mention floods."

### 12. Wadi Qelt and the ancient road

**Checked statement:** Wadi Qelt (Hebrew Nahal Prat) runs from near Jerusalem to the Jordan near Jericho. The ancient ascent of Adummim followed the ridge on its southern side.

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Wikipedia, "Wadi Qelt": <https://en.wikipedia.org/wiki/Wadi_Qelt>; Wikipedia, "Adummim": <https://en.wikipedia.org/wiki/Adummim> ("the top of a ridge that forms the southern bank of Wadi Qelt"); Wikipedia, "Jericho".
- **Notes:** The exact line of the 1st-century path is uncertain (claim 20). St George's Monastery in the wadi is Byzantine (5th century), so it doesn't belong in a 1st-century scene.
- **Used in content:** `rec-hist-floods` (`src-wiki-wadi-qelt`). The route details on the game's map are fictional and labelled as such (`rec-map`, `rec-hist-road-surface`).

### 13. Augustine's allegory, and the ethical reading

**Checked statement:** Augustine's allegory is in *Quaestiones Evangeliorum* 2.19 (about 399–400 CE, per Higton):
- the man is Adam; Jerusalem is the heavenly city; Jericho is the moon, meaning our mortality;
- the robbers are the devil and his angels; the priest and Levite are the Old Testament priesthood and ministry;
- the Samaritan is the Lord; oil is "comfort of good hope"; wine is "exhortation to work with fervent spirit";
- the inn is the Church; the innkeeper is "the Apostle"; the two denarii are the two love commandments.

Augustine also reads the parable morally in *De Doctrina Christiana* 1.30.31. Most modern critical scholars stress the ethical reading, while some (for example Parsons) defend a Christological one.

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources**
  - Mike Higton, "Boldness and Reserve: A Lesson from St. Augustine", *Anglican Theological Review* 85.3 (2003), quoting QE 2.19 in C. H. Dodd's abridged translation: <https://mikehigton.webspace.durham.ac.uk/wp-content/uploads/sites/193/2021/05/2003-boldness-and-reserve.pdf>
  - Augustine, *On Christian Doctrine* 1.30.31 (NPNF), New Advent: <https://www.newadvent.org/fathers/12021.htm> ("he is our neighbor whom it is our duty to help in his need")
  - Maurice Ryan, SCJR 16 (2021), link in claim 5: the critical consensus "that the Samaritan is not Jesus"
  - Mikeal C. Parsons, "Hearing a Parable with the Early Church" (Baylor, 2006): <https://ifl.web.baylor.edu/sites/g/files/ecbvkj771/files/2023-02/parablesarticleparsons.pdf> (a dissenting view)
  - Supporting: "A Chorus of Voices" reception-history blog: <https://parablesreception.blogspot.com/2014/10/augustine-and-good-samaritan-augustine.html>; Wikipedia, "Parable of the Good Samaritan": <https://en.wikipedia.org/wiki/Parable_of_the_Good_Samaritan>
- **Notes**
  - Ryan's summary that Augustine made oil and wine "the sacraments of baptism and eucharist" does **not** match the QE 2.19 text Higton quotes. Don't use it.
  - That "the Apostle" means Paul is an inference.
  - **Denominational sensitivity:** the Christological reading is traditional in Catholic, Orthodox and many Protestant settings, and the ethical reading dominates modern scholarship. Present both as "ways Christians have read this story".
- **Used in content:** `rec-interp-augustine` (`src-augustine-qe`, `src-augustine-doctrine`); `rec-interp-neighbor` (`src-augustine-doctrine`, `src-web-luk10`). Both are labelled *Interpretation*, and `rec-interp-augustine` is marked moderate denominational sensitivity. Parsons is not cited.

### 14. The prutah

**Checked statement:** The prutah was a small, low-value bronze coin of Second Temple Judea. The Roman prefects and procurators (6–66 CE), including Pilate, minted only this one denomination, in Jerusalem. The New Testament's Greek names for small coins are *lepton* (Mark 12:42) and *kodrantes*; "prutah" comes from Hebrew and rabbinic sources.

- **Verdict:** VERIFIED · **Confidence:** probable
- **Sources:** Wikipedia, "Procuratorial coinage of Roman Judaea": <https://en.wikipedia.org/wiki/Procuratorial_coinage_of_Roman_Judaea>; Wikipedia, "Prutah": <https://en.wikipedia.org/wiki/Prutah>; Mishnah Kiddushin 1:1 (Sefaria): <https://www.sefaria.org/Mishnah_Kiddushin.1.1>; WEB Mark 12:42: <https://ebible.org/eng-web/MRK12.htm> (with SBLGNT).
- **Notes:** Wikipedia contradicts itself on how the lepton and prutah relate, so the exact equivalence is **UNCERTAIN**. Silver denarii and Tyrian shekels also circulated.
- **Used in content:** `rec-hist-coins` (`src-wiki-procuratorial-coins`, `src-web-mrk12`), which says exact exchange rates are debated and the game's prices are simplified.

### 15. The "log" (Leviticus 14:10)

**Checked statement:** Leviticus 14:10 (also vv. 12, 15, 21, 24) requires "one log of oil". A log was a Hebrew liquid measure; the Talmud counts 12 logs to a hin. Its modern volume is uncertain, with estimates from about 0.3 L to a little over 0.5 L.

- **Verdict:** VERIFIED (reference) · **Confidence:** established (reference); uncertain (volume)
- **Sources:** WEB Lev 14:10: <https://ebible.org/eng-web/LEV14.htm>; Wikipedia, "Log (unit)": <https://en.wikipedia.org/wiki/Log_(unit)>; Wikipedia, "Biblical and Talmudic units of measurement": <https://en.wikipedia.org/wiki/Biblical_and_Talmudic_units_of_measurement>.
- **Notes:** The ≈0.3 L figure is the assistant's arithmetic from a 22 L bath. Leviticus 14 is about ritual purification, not wound care. Give no precise volume.
- **Used in content:** `rec-hist-measures` (`src-web-lev14`, `src-wiki-log-unit`), with confidence *uncertain* and the note "Do not state a precise volume."

### 16. Josephus on Jericho's climate, palms and balsam

**Checked statement:** Josephus, *Jewish War* 4.451–475 (Whiston 4.8.2–3), describes Jericho and the Jordan plain:
- 4.459–475: Elisha's spring and gardens, many kinds of palm, honey, balsam, cypress and myrobalanum;
- 4.473: the air is so mild that locals wear linen "when snow covers the rest of Judea";
- 4.474: 150 stadia to Jerusalem across "desert and stony" land.

- **Verdict:** VERIFIED (the passage begins at 4.451, not 4.452 as first claimed) · **Confidence:** established
- **Sources:** Whiston translation (Project Gutenberg): <https://www.gutenberg.org/cache/epub/2850/pg2850.txt>; Perseus section boundaries (English 4.451, 4.459, 4.476; Greek 4.473–474): <https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0148:book=4:section=459>; also Strabo, *Geography* 16.2.41 (LacusCurtius, link in claim 3), Jericho's palm grove and "balsam park".
- **Notes:** Josephus also says the plain is "much burnt up in summer time". That phrase was not pinned to an exact Niese section number.
- **Used in content:** `rec-hist-jericho` (`src-josephus-war-4`, `src-strabo-16`, `src-web-deu34`); `rec-hist-descent` (the 150 stadia).

### 17. The World English Bible is public domain

**Checked statement:** eBible.org states that the WEB is in the public domain. "World English Bible" is a trademark, so altered text must not use the name. eBible.org hosts the Classic WEB (`eng-web`, with "Yahweh" in the Old Testament) and the updated WEB (`engwebp`/`engwebu`, with "the LORD").

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** eBible.org WEB copyright page: <https://ebible.org/eng-web/copyright.htm> ("The World English Bible is in the Public Domain…"); updated WEB, Deut 6: <https://ebible.org/engwebp/DEU06.htm>.
- **Notes:** Luke 10:25–37 is identical in the Classic and updated editions (checked programmatically). For Old Testament quotations, pick one edition and use it consistently.
- **Used in content:** no content record. It supports the licence note in the translation registry [`src/content/scripture/translations.ts`](../../src/content/scripture/translations.ts) (`license: 'public-domain'`, trademark caveat). Source id `src-web-copyright` exists in `sources.ts` but no record cites it.

### 18. The WEB text of Luke 10:25–37

**What was done:** the Classic WEB text (<https://ebible.org/eng-web/LUK10.htm>) was parsed programmatically from the page HTML, with footnote markers removed and verse 37's two parts joined by a single space. It is identical at <https://ebible.org/engwebp/LUK10.htm>. The verbatim text is **not** reproduced here. It is stored, switched off (`approvedForDisplay: false`), in [`translations.ts`](../../src/content/scripture/translations.ts), and must be proofread by a person before it is enabled.

**Checks made against the text:**
- v.27 combines Deut 6:5 and Lev 19:18 (**VERIFIED**; the WEB's own footnotes point there). Luke lists four terms (heart, soul, strength, mind), while Deut 6:5 in the WEB has three (heart, soul, might). The quotation is not word-for-word.
- **The text gives no reason why the priest and the Levite passed by (VERIFIED).** Verses 31–32 say only that each saw him and "passed by on the other side". Every motive (purity, fear, haste) is later interpretation (Ryan 2021). Both men are "going down", away from Jerusalem.
- v.35 "two denarii" (**VERIFIED**). vv.36–37: "He who showed mercy on him" and "Go and do likewise" (**VERIFIED**).
- The Samaritan's mount is "his own animal" (Greek κτῆνος, a general word for a beast of burden). **The text does not say it was a donkey.**

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** WEB Luke 10: <https://ebible.org/eng-web/LUK10.htm>; SBL Greek New Testament, Luke 10: <https://ebible.org/grcsbl/LUK10.htm>.
- **Used in content:** `rec-luke-10-25-37` (a Scripture reference; the game shows the placeholder `[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Luke 10:25-37]` until a translation is approved); `rec-para-luke-10` (a paraphrase checked against this text; its editorial note says "animal," not "donkey", and no motives); `rec-para-yair`. `src-web-luk10` is also cited by `rec-hist-descent`, `rec-hist-road-danger`, `rec-hist-priests-levites`, `rec-hist-oil-wine`, `rec-hist-love-commands`, `rec-interp-neighbor`, `rec-interp-fair-reading`, `rec-interp-mercy-cost` and `rec-interp-fear`.

### 19. Lev 19:18, Lev 19:34, Deut 6:5

**Checked statement (Classic WEB):**
- Lev 19:18 ends "…you shall love your neighbor as yourself. I am Yahweh."
- Lev 19:34 tells Israel to treat the foreigner as native-born and "love him as yourself".
- Deut 6:5 commands love of God with all your heart, soul and might. The updated WEB has "the LORD" where the Classic has "Yahweh".

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** WEB Lev 19: <https://ebible.org/eng-web/LEV19.htm>; WEB Deut 6: <https://ebible.org/eng-web/DEU06.htm>; updated WEB Deut 6: <https://ebible.org/engwebp/DEU06.htm>.
- **Notes:** Lev 19:34 grounds the command in memory ("for you lived as foreigners in the land of Egypt"). It is a good Hebrew Bible cross-reference for love of neighbour across boundaries.
- **Used in content:** `rec-lev-19-18`, `rec-lev-19-34`, `rec-deut-6-5` (references); `rec-para-love-commands` (paraphrase); `rec-hist-love-commands` (`src-web-lev19`, `src-web-deu06`, `src-web-luk10`).

### 20. Was there a Roman road from Jerusalem to Jericho in Jesus' day?

**Checked statement:**
- A well-used route through the ascent of Adummim linked Jerusalem and Jericho long before Jesus.
- The engineered Roman road network in Judaea, with milestones, "evolved gradually from the First Revolt onward" (66–70 CE). Much of it was built in the 2nd century and later. Earlier roads, from "during or prior to the reign of Herod", are poorly known ("Our knowledge… is scanty").
- In 70 CE the Tenth Legion came "through Jericho".
- The surviving milestones on the Jericho–Jerusalem road are Arabic, from Abd al-Malik (685–705 CE).
- So the 1st-century traveller probably walked a known road or track, not a paved Roman highway.

- **Verdict:** PARTLY VERIFIED · **Confidence:** probable
- **Sources:** Israel Roll, "The Roman Road System in Judaea" (1983), pp. 138, 147, 150 (PDF link in claim 3); Josephus, *Jewish War* 5.42 and 5.69–70 (Whiston, Gutenberg link in claim 1).
- **Notes:** Roll cites Tosefta Shekalim 1:1 on repairs to pilgrim roads before festivals, which is plausible background for a busy route. The rock-cut steps at Ma'aleh Adumim (p. 150) are not dated to the 1st century. A specialist study was **not** read: J. Wilkinson, "The Way from Jerusalem to Jericho", *Biblical Archaeologist* 38 (1975): 10–24. For the game, show a rough track, not a paved highway.
- **Used in content:** `rec-hist-road-surface` (`src-roll-roads`), kind *Historical reconstruction*, which also says the game's fork, bend and shepherds' path are fictional.

### 21. Walking time

**Checked statement:** No ancient source gives a walking time. One documented modern walk *up* from Jericho to Jerusalem along the ascent of Adummim covered about 24 km (15 miles) and climbed about 1,060 m (3,400 ft). It took about 6.5 hours of walking, or 8 hours with breaks. "About a day's walk" is a reasonable, hedged way to put it.

- **Verdict:** PARTLY VERIFIED · **Confidence:** possible
- **Sources:** Todd Bolen, "Jericho to Jerusalem", BiblePlaces.com blog (30 Nov 2006): <https://www.bibleplaces.com/blog/2006/11/jericho-to-jerusalem/>
- **Notes:** The downhill time is **UNVERIFIED**. Any "6–8 hours" figure should be presented as a modern estimate ("Today, hikers take most of a day").
- **Used in content:** no educational record cites it, and there is no source id. The fiction uses the hedged phrase "a long day's walk" (`rec-e-mission`; Aunt Miriam's opening dialogue).

---

## Things that should NOT be presented as fact

The right-hand column records how Chapter 1's records handle each point, as of 2026-09-24.

| # | Do not present as fact | Why | How Chapter 1 handles it |
|---|---|---|---|
| 1 | **Why the priest and Levite passed by** | The text gives no reason. Purity and fear explanations are speculation, and the purity explanation has fed anti-Jewish stereotypes (Ryan 2021, quoting Levine). Present them as "people have wondered…" or leave them out. | `rec-hist-priests-levites` and `rec-interp-fair-reading` say Luke doesn't give a reason. The content test "does not attribute a motive to the priest or the Levite" enforces this ([`tests/content/road-to-jericho.test.ts`](../../tests/content/road-to-jericho.test.ts)). |
| 2 | **"The Inn of the Good Samaritan" as the real inn** | It is a parable, and the site is a later Christian tradition. The present building dates from 1903. | `rec-hist-inn`: "no real building can be identified as that inn". `rec-pl-inn` is labelled fictional. |
| 3 | **"In Jesus' day the road was called the Way of Blood"** | The "blood" name is first documented by Jerome (404 CE) and later by the Crusaders. The Hebrew name means "red". | `rec-hist-road-danger`: "that name is much later than Jesus' day". |
| 4 | **Numbers of priests in Jericho** | Wesley's "12,000" is unsupported, and "half the priests" comes from a later Talmudic tradition. | `rec-hist-priests-levites` gives no numbers. |
| 5 | **A paved Roman highway with milestones in Jesus' time** | Most Roman road-building came after 66–70 CE. | `rec-hist-road-surface`: "probably a well-used track rather than a paved highway". |
| 6 | **Martin Luther King Jr.'s elevations** (1,200 ft above / 2,200 ft below) | Both figures are wrong. The correct values are about 754 m and about −258 m. | `rec-hist-descent` uses 754 m and −258 m. |
| 7 | **The people in 2 Chronicles 28 were "Samaritans"** | They were northern Israelites; "Samaritans" is anachronistic. | Not used. |
| 8 | **The Samaritan's donkey** | The Greek says "his own animal" (κτῆνος). | `rec-para-luke-10` says "his own animal". Donkeys do appear in the game's *fictional* events and scenery (for example Salome's son Asher), never as the Samaritan's mount. |
| 9 | **Exact volumes and exchange rates** (the log in litres, prutah-to-lepton) | Scholars disagree. | `rec-hist-measures` and `rec-hist-coins` say these are uncertain or debated and that the game simplifies them. |
| 10 | **Augustine's allegory in the baptism/eucharist version** | QE 2.19 has oil as "comfort of good hope" and wine as "exhortation to work with fervent spirit". | `rec-interp-augustine` follows QE 2.19, paraphrasing "exhortation" as "encouragement". |
| 11 | **Caricatures of Samaritans or Jews** | Samaritans are a living community, and 1st-century relations were "strained, but not broken". | `rec-hist-samaritans` (with a sensitivity note) and `rec-interp-fair-reading`. |

## Points for the human reviewer

These came up while mapping the research to the content. They are not errors that were checked and confirmed; they are wording to confirm against the sources.

1. ~~**`rec-hist-road-danger`** said Pompey "destroyed robbers' strongholds on the passes near Jericho".~~ **Resolved (2026-09-25):** Strabo 16.2.40 (LacusCurtius, re-checked) reads "destroyed the haunts of robbers and the treasure-holds of the tyrants. Two of these were situated on the passes leading to Hiericus". The record now says Pompey destroyed "robbers' hideouts and local rulers' strongholds in the region, two of them on the passes leading to Jericho", which does not claim which kind the two were.
2. ~~**`rec-interp-augustine`** added "standing for all humanity".~~ **Resolved (2026-09-25):** the gloss was removed; the record keeps only what QE 2.19 says (the wounded man is Adam).
3. ~~**`rec-interp-neighbor`**: confirm "every person is our neighbour".~~ **Resolved (2026-09-25):** *On Christian Doctrine* 1.30.32 (NPNF, New Advent, re-checked) says "it is clear that every man is to be considered our neighbor, because we are to work no ill to any man". The source locator is now 1.30.31–32 and the note quotes both sentences.
4. **Sources consulted but not in `sources.ts`:** Easton's dictionary, Eusebius' *Onomasticon*, Spencer (WTJ 1984), Parsons (2006), Schwartz (JQR 1988, not read), lsj.gr, Wikivoyage, Wikipedia ("Flash flood", "Prutah", "Samaritans", "Biblical and Talmudic units", "Parable of the Good Samaritan"), the "A Chorus of Voices" blog, Mishnah Kiddushin 1:1, Perseus, BiblePlaces.com, and the WEB pages for Judges, 2 Chronicles and the updated WEB. No record cites them today. If future content uses those claims, add catalogue entries so they appear in the game's *Sources* lists.

## Checklist for human citation verification

For each source a record cites (the ids in `records.ts`):

1. Open the URL and check that it loads the same work, edition and section as `title` and `locator`.
2. Confirm that every quotation in this document and in the record's `body` matches the source.
3. Confirm the verdict and confidence level, and adjust the record's `historicalConfidence` if needed.
4. Check the record's wording against the "should NOT be presented as fact" list and the reviewer points above.
5. Record the check in the record's governance history, with the reviewer's name and the date. Then move it through the editorial workflow ([content-governance.md](../content-governance.md)). **Only a named human may set a record to `approved`.**

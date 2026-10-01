# Source verification: *A Letter from Paul* (Philemon; Colossians 4:7–18)

This is the claim-by-claim record behind the historical, geographical and interpretive records in Chapter 4. The sources are catalogued in [`src/content/chapters/letter-from-paul/sources.ts`](../../src/content/chapters/letter-from-paul/sources.ts) and cited by the records in [`records.ts`](../../src/content/chapters/letter-from-paul/records.ts).

> **Provenance and status**
>
> - **Today (2026-10-01):** the owner approved the chapter's records drafted by 2026-09-26, and the World English Bible text is displayed; the status notes below are as of the research. Current approval status, record by record: [the chapter document, §12](../chapters/letter-from-paul.md#12-content-and-approval-status).
> - **Retrieval and checking were done by AI research assistants on 2026-09-25.** Every source below was fetched in that session (WebFetch, and where WebFetch only summarised a page, plain HTTP so quotations could be matched word for word). Pages that refused access are listed at the end and are **not** cited.
> - **Human citation verification is still required.** `verified: true` in `sources.ts` records only that the AI retrieval took place. Every educational record is `sources-attached`, is labelled "Awaiting editorial review" in the game, and cannot be published until a named human approves it ([content-governance.md](../content-governance.md)).
> - Quotations are short (under 30 words). No Bible passage is reproduced beyond short phrases; the game shows Scripture only as references and labelled paraphrase.

**Confidence scale** (as `historicalConfidence` in the content model): *established* · *probable* · *possible* · *tradition* · *uncertain*.

**Verdicts:** VERIFIED · PARTLY VERIFIED (the core holds; the rest is marked) · CORRECTED (the draft claim was wrong and the record says what the source says) · OPEN (a disputed question, presented as such).

---

## Summary

| # | Topic | Verdict | Confidence | Used by |
|---|---|---|---|---|
| 1 | The WEB text of every reference used | VERIFIED | established | all `scripture` and `paraphrase` records |
| 2 | Colossae, Laodicea, Hierapolis: where and how far | VERIFIED | established (distances vary) | `rec-hist-lycus`, `rec-rec-road` |
| 3 | Colossae's site: surveyed since 2021, first dig 2025, mound unexcavated | CORRECTED | established | `rec-hist-colossae-site` |
| 4 | Herodotus and Xenophon on Colossae | VERIFIED | established | `rec-hist-lycus` |
| 5 | Wool: Laodicea's black wool; the "Colossian" colour | VERIFIED / CORRECTED | established (texts) / uncertain (hue) | `rec-hist-wool` |
| 6 | Hierapolis: dyeing water; white travertine | VERIFIED | established / probable | `rec-hist-wool`, `rec-hist-hierapolis` |
| 7 | Madder and alum | VERIFIED (stated modestly) | probable | `rec-hist-dyeing` |
| 8 | The earthquake (Tacitus; the chronicles) | VERIFIED | established (Laodicea, AD 60) / probable (Colossae) | `rec-hist-earthquake` |
| 9 | Roads, milestones, the Roman mile, walking speed | PARTLY VERIFIED / CORRECTED | probable | `rec-hist-roads`, `rec-rec-road` |
| 10 | Private letters vs the state post | VERIFIED | established | `rec-hist-carriers` |
| 11 | Scribes and the sender's own hand; Tiro | VERIFIED | established | `rec-hist-scribes` |
| 12 | The shape of an ancient letter | VERIFIED | established | `rec-hist-letter-form`, puzzle `p-sheets` |
| 13 | Papyrus, wax tablets, leaf tablets | VERIFIED | established | `rec-hist-materials` |
| 14 | Reading aloud; literacy | VERIFIED / PARTLY VERIFIED | probable | `rec-hist-reading` |
| 15 | Carriers reading letters aloud | OPEN | possible | `rec-hist-carriers` |
| 16 | House churches; Dura-Europos | VERIFIED | established | `rec-hist-house-church` |
| 17 | Roman-era houses (Ephesus Terrace Houses) | VERIFIED | established (Ephesus) / possible (Philemon's house) | `rec-rec-house` |
| 18 | Roman slavery: runaways, peculium, manumission, freed people | PARTLY VERIFIED / CORRECTED | established (institutions) / uncertain (numbers) | `rec-hist-slavery` |
| 19 | Pliny's letters to Sabinianus | VERIFIED | established | `rec-hist-pliny` |
| 20 | Philemon: authorship, place, date | VERIFIED / OPEN | established / uncertain | `rec-interp-prison` |
| 21 | Why Onesimus was away | OPEN | possible (all views) | `rec-interp-onesimus` |
| 22 | Onesimus the later bishop? | OPEN | possible | `rec-interp-later-onesimus` |
| 23 | Colossians: authorship; the shared names | VERIFIED / OPEN | established that it is disputed | `rec-interp-authorship`, `rec-hist-who` |
| 24 | The letters and slavery; their use in slavery debates | VERIFIED / CORRECTED | established | `rec-interp-slavery` |
| 25 | "The letter from Laodicea"; Nympha / Nymphas | OPEN | uncertain / probable | `rec-interp-laodicea-letter` |

---

## Claims

### 1. The WEB text of every reference used

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** World English Bible (public domain), eBible.org: [PHM01](https://ebible.org/eng-web/PHM01.htm), [COL01](https://ebible.org/eng-web/COL01.htm), [COL02](https://ebible.org/eng-web/COL02.htm), [COL03](https://ebible.org/eng-web/COL03.htm), [COL04](https://ebible.org/eng-web/COL04.htm), [ROM16](https://ebible.org/eng-web/ROM16.htm), [1CO07](https://ebible.org/eng-web/1CO07.htm), [1CO16](https://ebible.org/eng-web/1CO16.htm), [GAL03](https://ebible.org/eng-web/GAL03.htm), [GAL06](https://ebible.org/eng-web/GAL06.htm), [EPH06](https://ebible.org/eng-web/EPH06.htm), [1TH05](https://ebible.org/eng-web/1TH05.htm), [2TH03](https://ebible.org/eng-web/2TH03.htm), [REV01](https://ebible.org/eng-web/REV01.htm), [REV03](https://ebible.org/eng-web/REV03.htm).
- **Checked:** Phm 1–3 ("to the assembly in your house"), 4–7, 8–10 ("Paul, the aged"; "my child Onesimus, whom I have become the father of in my chains"), 11 ("useless to you, but now is useful"), 12–14 ("my own heart"; "not … of necessity, but of free will"), 15–16 ("no longer as a slave, but more than a slave, a beloved brother"), 17–19 ("put that to my account"; "I, Paul, write this with my own hand"), 21–22 ("prepare a guest room"; "restored to you"), 23–24; Col 1:2, 1:7, 2:1, 3:11, 3:22–4:1, 4:7–18; Rom 16:5, 16:22; 1 Cor 7:20–23, 16:19, 16:21; Gal 3:28, 6:11; Eph 6:21–22; 1 Thess 5:27; 2 Thess 3:17; Rev 1:3, 3:14–22.
- **Notes (these shaped the paraphrases):**
  - The WEB footnote at Phm 10 says Onesimus means "useful". The paraphrase uses this, and the historical record credits the footnote, not the Greek.
  - Phm 22 reads "restored to you"; Col 4:18 "Remember my chains"; Col 3:11 "bondservant, or free person"; Col 3:22 and 4:1 "servants". The paraphrases follow the WEB's sense.
  - Col 4:15 in the WEB reads "Nymphas and the assembly that is in his house", with no footnote (see claim 25). The in-game paraphrase follows the WEB.
  - Col 4:8 in the WEB has Tychicus coming "that he may know your circumstances"; Eph 6:22 has the reverse. The paraphrase follows Col 4:8 as printed.
  - Rev 3:17: the riches are the Laodiceans' own claim, which the text rejects. The game only says Revelation includes a message to Laodicea.
  - The WEB is public domain; "World English Bible" is a trademark ([copyright page](https://ebible.org/eng-web/copyright.htm)). No WEB text is stored for this chapter.

### 2. Colossae, Laodicea, Hierapolis: where and how far

- **Checked statement:** Colossae lay in the Lycus valley in Phrygia, near modern Honaz; Laodicea about 15 km down the valley (sources range 13–17 km); Hierapolis about 10 km north of Laodicea; Mount Cadmus above.
- **Verdict:** VERIFIED · **Confidence:** established (location); the distances vary by source
- **Sources:**
  - [Wikipedia, "Colossae"](https://en.wikipedia.org/wiki/Colossae), Location: "located 15 km (9.3 mi) southeast of Laodicea on the road through the Lycus Valley"; the mound "3 km (1.9 mi) to the north of Honaz".
  - [Wikipedia, "Laodicea on the Lycus"](https://en.wikipedia.org/wiki/Laodicea_on_the_Lycus): "17 kilometres (11 mi) west of Colossae, 10 kilometres (6.2 mi) south of Hierapolis".
  - [HolyLandPhotos, "Colossae"](https://holylandphotos.org/browse/colossae) (C. Rasmussen): "Laodecia, 8 mi. [13 km.] to the west".
  - Strabo 12.8.16 ([LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/12H*.html)): "Above the city lies Mt. Cadmus" (the city is Laodicea); 12.8.13 counts Apameia and Laodiceia as "the largest of the Phrygian cities".
- **Notes:** The identification of Cadmus with Honaz Dağı is modern consensus (Wikipedia's sentence is uncited): probable. The record says "about 15 km (modern measurements range from about 13 to 17)".

### 3. Colossae's site

- **Draft claim:** "Colossae has never been excavated."
- **Verdict:** CORRECTED · **Confidence:** established (as of late 2025 to mid-2026)
- **Corrected statement:** Surveys began in 2021 (Pamukkale University); the first excavation season, in 2025, opened tombs in the northern necropolis; the city mound itself has not been excavated.
- **Sources:** [Biblical Archaeology Society, 10 July 2026](https://www.biblicalarchaeology.org/daily/archaeology-today/colossae-a-biblical-city-of-classical-world/): "A new research initiative began in 2021 with the Colossae Archaeological Survey"; "In 2025, our first season of fieldwork focused primarily on the northern necropolis". [HolyLandPhotos](https://holylandphotos.org/browse/colossae): "long-term plans … for the excavation of the mound".
- **Notes:** Several web pages (and Wikipedia) still say digging is yet to start; they are out of date. Check for new excavation news before release.

### 4. Herodotus and Xenophon on Colossae

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Herodotus 7.30.1 (Godley, [Perseus](https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0126:book=7:chapter=30)): "he came to Colossae, a great city in Phrygia". Xenophon, *Anabasis* 1.2.6 (Brownson, [Perseus](https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0202:book=1:chapter=2:section=6)): "an inhabited city, prosperous and large".
- **Notes:** Herodotus also says the Lycus disappears underground there; Godley's note doubts it beyond a few yards, so the game does not repeat it as fact.

### 5. Wool: Laodicea's black wool and the "Colossian" colour

- **Verdict:** VERIFIED (Strabo) / CORRECTED (Pliny) · **Confidence:** established (texts); uncertain (the exact hue)
- **Sources:** Strabo 12.8.16 ([LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/12H*.html)): sheep "excellent, not only for the softness of their wool … but also for its raven-black colour … as do also the neighbouring Colosseni from the colour which bears the same name." Pliny, *Natural History* 21.51 (Latin, [LacusCurtius](https://penelope.uchicago.edu/Thayer/L/Roman/Texts/Pliny_the_Elder/21*.html)): "flos eius Colossinus in coronas admittitur."
- **Corrections:** Strabo does not use the word *colossinus*; Pliny does (Wikipedia attributes it to Strabo). Pliny compares the **cyclamen flower** to the Colossian colour; he does not say Colossae dyed with cyclamen. The Loeb editor glosses the colour as purple or madder-red; the record says only "somewhere in the purple or reddish-purple range" and that the exact shade is unknown.

### 6. Hierapolis: dyeing water; white travertine

- **Verdict:** VERIFIED · **Confidence:** established (texts, modern appearance); probable (the terraces' extent in AD 60)
- **Sources:** Strabo 13.4.14 ([LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/13D*.html)): "wool dyed with the roots rivals that dyed with the coccus or with the marine purple" (Loeb notes: roots = madder, coccus = kermes); the water "so easily congeals and changes into stone". [UNESCO 485 (Wayback copy)](https://web.archive.org/web/2024/https://whc.unesco.org/en/list/485/): "springs in a cliff almost 200 m high overlooking the plain". [Wikipedia, "Pamukkale"](https://en.wikipedia.org/wiki/Pamukkale): visible "from the hills on the opposite side of the valley".
- **Notes:** In the game, the white hillside is seen far across the river from the road: a fair picture of the valley, not a claim about an exact sightline.

### 7. Madder and alum

- **Verdict:** VERIFIED, stated modestly · **Confidence:** probable
- **Sources:** Pliny, *NH* 19.47 (Bostock & Riley 19.17, [Perseus](https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0137:book=19:chapter=17)): "madder, the employment of which is necessary in dyeing wool and leather". *NH* 35.183–4 (B&R 35.52, [Perseus](https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0137:book=35:chapter=52)): "alumen being employed for dyeing wool of bright colours". Stockholm Papyrus, recipe 153 ([Caley 1927, Wayback](https://web.archive.org/web/20210610064634/http://www.clericus.org/etexts/Stockholm%20Papyrus.htm)): "brighten it with alum".
- **Notes:** Ancient *alumen* was not always modern alum; the Stockholm Papyrus is about 240 years after Paul. The alum puzzle's 6 measures are invented.

### 8. The earthquake

- **Verdict:** VERIFIED · **Confidence:** established (Laodicea, AD 60); probable (Colossae); uncertain (same event? exact year?)
- **Sources:** Tacitus, *Annals* 14.27.1 ([LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Tacitus/Annals/14A*.html)): "Laodicea … was laid in ruins by an earthquake, but recovered by its own resources, without assistance from ourselves" (year fixed by 14.20). Orosius 7.7.12 ([attalus.org](https://www.attalus.org/translate/orosius7A.html)): "an earthquake destroyed three cities, Laodicea, Hierapolis, and Colossae". Jerome's *Chronicle* ([tertullian.org](https://www.tertullian.org/fathers/jerome_chronicle_03_part2.htm)): "three cities were ruined in an earthquake; Laodicea, Hierapolis and Colossae" (Nero's 10th year in that edition). Strabo 12.8.16: the country is "subject to earthquakes".
- **Notes:** No ancient source says Colossae rebuilt without help; that is Tacitus about Laodicea. The game's setting ("around AD 55–62, dates uncertain") does not depend on the earthquake.

### 9. Roads, milestones, the Roman mile, walking speed

- **Verdict:** PARTLY VERIFIED / CORRECTED · **Confidence:** probable
- **Correction:** Manius Aquillius did not demonstrably *build* roads. Milestones bearing his name (proconsul 129–126 BC) show roads in use in the new province; the record says exactly that.
- **Sources:** D. H. French, "Pre- and Early-Roman Roads of Asia Minor" ([PDF](http://dlir.org/archive/archive/files/arkeoloji_dergisi_v-5_p179-187_6bb72bd981.pdf)), section 1: "It is not known how many roads in his province were taken over by Manius Aquillius"; the roads include Ephesus to Tralles and Laodiceia. Strabo 14.2.29 ([LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/14B*.html)): "a kind of common road constantly used by all who travel from Ephesus towards the east" (it names Laodiceia, not Colossae). [Wikipedia, "Mile"](https://en.wikipedia.org/wiki/Mile): "the Roman mile (roughly 1.48 km)". [Wikipedia, "Milestone"](https://en.wikipedia.org/wiki/Milestone): "Many Roman milestones only record the name of the reigning emperor". French p. 186: Latin and Greek texts on the same stones. ORBIS v1 paper ([PDF](https://orbis.stanford.edu/orbis2012/ORBIS_v1paper_20120501.pdf)), p. 20: "30km/day for foot travelers".
- **Notes:** "Often bilingual" in the East rests on examples, not a count: probable. The game's milestone numbers (IIII, V), the kerbed highway on this stretch, the bridge, dye works and waystation are invented (`rec-rec-road`).

### 10. Private letters vs the state post

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Suetonius, *Augustus* 49.3 ([LacusCurtius](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Augustus*.html)): "he at first stationed young men at short intervals along the military roads, and afterwards post-chaises". [Wikipedia, "Cursus publicus"](https://en.wikipedia.org/wiki/Cursus_publicus): "only accessible to the government or the military"; others "would use slaves or acquaintances to carry their mail". Col 4:7–9 and Eph 6:21–22 (WEB): the named carriers.

### 11. Scribes and the sender's own hand; Tiro

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Rom 16:22, Col 4:18, Phm 19, Gal 6:11 (WEB). E. R. Richards, ["Paul and First-Century Letter Writing"](https://textandcanon.org/paul-and-first-century-letter-writing/): "the sender usually added a summary comment, any last-minute updates, and/or greeting in his own hand". [Wikipedia, "Marcus Tullius Tiro"](https://en.wikipedia.org/wiki/Marcus_Tullius_Tiro): "first a slave, then a freedman, of Cicero".
- **Notes:** Phm 19 is a promise to repay in Paul's hand, not a greeting; the record says so.

### 12. The shape of an ancient letter

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Review of Stowers, *Letter Writing in Greco-Roman Antiquity* ([WLS](https://wisluthsem.org/review-letter-writing/)): letters "begin with a prescript or salutation … sometimes by a wish for the recipient's health". Richards: "an opening, a body, and a closing"; closing often "another brief health-wish, such as 'Farewell.'" [Wikipedia, "Pauline epistles"](https://en.wikipedia.org/wiki/Pauline_epistles): "opening, thanksgiving or blessing, body, and closing".
- **Used by:** the `p-sheets` puzzle (Kallias's fictional letter follows this pattern) and `rec-hist-letter-form`.

### 13. Papyrus, wax tablets, leaf tablets

- **Verdict:** VERIFIED · **Confidence:** established (materials); unknown (what Paul used — no originals survive)
- **Sources:** [Wikipedia, "Papyrus"](https://en.wikipedia.org/wiki/Papyrus): "used throughout the Mediterranean region". [Wikipedia, "Wax tablet"](https://en.wikipedia.org/wiki/Wax_tablet): "a reusable and portable writing surface". [Wikipedia, "Vindolanda tablets"](https://en.wikipedia.org/wiki/Vindolanda_tablets): "thin, postcard-sized wooden leaf-tablets with carbon-based ink". Richards: letters folded, tied, sometimes sealed with clay or wax.

### 14. Reading aloud; literacy

- **Verdict:** VERIFIED (reading aloud) / PARTLY VERIFIED (literacy figures) · **Confidence:** established / probable
- **Sources:** Col 4:16, 1 Thess 5:27, Rev 1:3 (WEB). N. Zair (CUP 2023, [core reader](https://www.cambridge.org/core/product/AA724B0E4F2ED33ADD5671D99B9A85D1/core-reader)): "Harris (1989: 259–73) estimates levels of literacy under the Roman empire to be no greater than 15% in Italy and 5–10%" in the western provinces, and calls such figures "guesstimates". [BMCR 2019.04.45](https://bmcr.brynmawr.edu/2019/2019.04.45/): later authors think Harris "underestimated the degree of literacy".
- **Correction:** the draft's "10–15% or less" became "no more than about 15 per cent in Roman Italy, and fewer in the provinces; others think the figures too low".

### 15. Carriers reading letters aloud

- **Verdict:** OPEN · **Confidence:** possible
- **Sources:** A. Chapple, *Tyndale Bulletin* 62.2 ([PDF](https://tyndalebulletin.org/article/29314-getting-romans-to-the-right-romans-phoebe-and-the-delivery-of-paul-s-letter.pdf)), pp. 212–13: delivering meant "reading it aloud"; carriers "were often entrusted with verbal messages". P. M. Head, "Onesimus the Letter Carrier" ([ORA preprint](https://ora.ox.ac.uk/objects/uuid:426281c6-0170-42f0-a7e0-6501f777c6ad/files/md3bb5c88be464b61129d13b3ebf4071c)): the carrier "is expected to resolve the ambiguities … in personal dialogue"; elsewhere Head argues there is no evidence carriers read letters aloud.
- **Design consequence:** the in-game reader is a fictional local scribe, and `rec-pl-house` says the New Testament does not say who read the letters.

### 16. House churches; Dura-Europos

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Phm 2, Col 4:15, Rom 16:5, 1 Cor 16:19 (WEB). [Wikipedia, "Dura-Europos church"](https://en.wikipedia.org/wiki/Dura-Europos_church): "the earliest identified Christian house church"; conversion "probably occurred in 240/241". [Yale News, 2024](https://news.yale.edu/2024/08/12/house-call-new-study-rethinks-early-christian-landmark): the renovated building was "almost certainly not domestic in form or function".
- **Notes:** Wikipedia's "House church" article misplaces Philemon's house church in Corinth; it is not cited.

### 17. Roman-era houses

- **Verdict:** VERIFIED (Ephesus) · **Confidence:** established (Ephesus); possible (as a model for Philemon's house)
- **Sources:** [Current World Archaeology, "Ephesus"](https://www.world-archaeology.com/features/ephesus-4/): "originally laid out in the Augustan period"; "typical peristyle layout"; "marble and mosaic floors". [ÖAW Press, Hanghaus 2](https://verlag.oeaw.ac.at/produkt/hanghaus-2-in-ephesos-die-wohneinheit-1-und-2/600978): built "in augusteisch-tiberischer Zeit". [Wikipedia, "Triclinium"](https://en.wikipedia.org/wiki/Triclinium): diners reclined on couches on three sides of a table.
- **Notes:** These were elite homes. Nothing is known of Philemon's house beyond Phm 2 and 22; the record says his may have been much simpler.

### 18. Roman slavery

- **Verdict:** PARTLY VERIFIED / CORRECTED · **Confidence:** established (institutions); uncertain (numbers)
- **Sources:** [Wikipedia, "Slavery in ancient Rome"](https://en.wikipedia.org/wiki/Slavery_in_ancient_Rome): "professional slave-catchers (fugitivarii) were hired to hunt down runaways"; "Slaves with the skills and opportunities to earn money might hope to save enough to buy their freedom"; "Freedmen and patrons had mutual obligations"; unskilled slaves had "little chance of freedom"; population figures: "None of these figures is capable of proof." W. Scheidel, *JRS* 95 (2005) ([PDF](https://gwern.net/doc/history/2005-scheidel.pdf)). [Wikipedia, "Epistle to Philemon"](https://en.wikipedia.org/wiki/Epistle_to_Philemon): "Roman law allowed the owner of a runaway slave nearly unlimited privileges of punishment".
- **Corrections:** "Manumission was common" holds mainly for skilled urban slaves; the record says so. Slave **collars** are 4th–5th century and are not mentioned. No population figure is given.
- **Where this appears in fiction:** Zenon (a freedman scribe) and Chrysis (an enslaved dye worker) are written to match these facts without adding any.

### 19. Pliny's letters to Sabinianus

- **Verdict:** VERIFIED · **Confidence:** established
- **Sources:** Latin 9.21, 9.24 ([The Latin Library](https://www.thelatinlibrary.com/pliny.ep9.html)); English ([Gutenberg #2811](https://www.gutenberg.org/files/2811/2811-h/2811-h.htm)): "YOUR freedman, whom you lately mentioned to me with displeasure, has been with me, and threw himself at my feet". D. F. Tolmie ([LitNet 2025](https://www.litnet.co.za/the-origin-and-development-of-the-amicus-domini-hypothesis-in-philemon-research/)): Grotius already "compared the letter to Pliny's letter to Sabinianus". J. White ([Themelios 49.3](https://www.thegospelcoalition.org/themelios/article/who-was-philemon-what-did-paul-want-from-him-and-why/)).
- **Notes:** Pliny's man was a freedman, not a slave, and Pliny stresses his remorse; the record says both.

### 20. Philemon: authorship, place, date

- **Verdict:** VERIFIED (authorship) / OPEN (place) · **Confidence:** established / uncertain
- **Sources:** [Wikipedia, "Epistle to Philemon"](https://en.wikipedia.org/wiki/Epistle_to_Philemon): attribution "has rarely been questioned by scholars"; "around AD 57–62". [NABRE introduction (USCCB)](https://bible.usccb.org/bible/philemon/0): "perhaps in Rome between A.D. 61 and 63". [Fuller Seminary](https://www.fuller.edu/next-faithful-step/resources/paul-and-philemon/): "Many now hold that Paul was imprisoned in Ephesus", while "no clear account of an Ephesian imprisonment" exists in the NT. Head (preprint), p. 7: "Increasingly, scholars have associated this with an imprisonment of Paul in Ephesus", with Barth and Blanke: "no agreement exists".
- **Record:** `rec-interp-prison` gives Rome, Ephesus and Caesarea and a date range of the early 50s to early 60s.

### 21. Why Onesimus was away

- **Verdict:** OPEN · **Confidence:** possible, for every view
- **Views and sources:**
  - Runaway (perhaps a thief, from verse 18) — the most common reading: [Wikipedia, "Epistle to Philemon"](https://en.wikipedia.org/wiki/Epistle_to_Philemon).
  - Sought Paul as a "friend of the master" to intercede (*amicus domini*), so not legally a fugitive: Tolmie 2025 (LitNet); Justinian's *Digest* 21.1.17.4 and 21.1.43.1 ([Latin](https://droitromain.univ-grenoble-alpes.fr/Corpus/d-21.htm)): "Qui ad amicum domini deprecaturus confugit, non est fugitivus". Critics note Roman law may not have applied in Colossae.
  - Sent by Philemon or the assembly to help Paul: M. A. Beavis ([Bible and Interpretation 2024](https://bibleinterp.arizona.edu/articles/early-christian-slavery-early-christian-slaves)): "More likely, Philemon had sent Onesimus to Paul".
  - Philemon's estranged brother, not a slave (A. D. Callahan; a minority view): Tolmie 2019 ([Acta Theologica](https://scielo.org.za/scielo.php?script=sci_arttext&pid=S1015-87582019000200007)).
- **Correction:** Peter Lampe (1985) systematised the *amicus domini* view; it goes back to Grotius and others (Tolmie).
- **Game:** Ammia voices only a rumour ("People say he ran off. People say all sorts of things."); the comparisons say Philemon "it seems, owned him".

### 22. Onesimus the later bishop?

- **Verdict:** OPEN · **Confidence:** possible
- **Sources:** Ignatius, *To the Ephesians* 1 ([New Advent](https://www.newadvent.org/fathers/0104.htm)): "through Onesimus … your bishop in the flesh". [Wikipedia, "Onesimus"](https://en.wikipedia.org/wiki/Onesimus): "He may also be the same Onesimus". [Kirkus review of John Knox](https://www.kirkusreviews.com/book-reviews/a/john-knox-5/philemon-among-the-letters-of-paul/).
- **Correction:** John Knox here is the 20th-century American New Testament scholar, not the Scottish reformer. Ignatius's letters are dated variously (Trajan's reign or later); the record says "in the second century".

### 23. Colossians: authorship; the shared names

- **Verdict:** VERIFIED that it is disputed · **Confidence:** established
- **Sources:** [Wikipedia, "Epistle to the Colossians"](https://en.wikipedia.org/wiki/Epistle_to_the_Colossians): "Many scholars question Paul's authorship … but others still defend it as authentic"; a 2011 British New Testament Conference poll: 56 of 109 for authenticity, 17 against, 36 uncertain. [Catholic Encyclopedia (1908)](https://www.newadvent.org/cathen/04131b.htm): "In both Colossians and Philemon greetings are sent from Aristarchus, Mark, Epaphras, Luke, and Demas".
- **Notes:** The "fellow prisoner" is Epaphras in Phm 23 but Aristarchus in Col 4:10; `rec-hist-who` describes Epaphras only as in Philemon.

### 24. The letters and slavery

- **Verdict:** VERIFIED / CORRECTED · **Confidence:** established
- **Sources:** Col 3:11, 3:22–4:1; Gal 3:28; 1 Cor 7:20–23; Phm 15–16 (WEB). J. P. Daly, "Proslavery Writing" ([encyclopedia.com](https://www.encyclopedia.com/arts/culture-magazines/proslavery-writing)): Philemon an "endlessly cited passage" for the Fugitive Slave Law. Tolmie 2019, section 3: enslaved hearers of a sermon on Philemon: "one half of my audience deliberately rose up and walked off". Beavis 2024: "the absence of anti-slavery teachings in the NT has been used to uphold it".
- **Correction:** the label "Pauline mandate" could not be found in any reliable retrieved source and is **not** used.
- **Notes:** The WEB renders 1 Cor 7:21 as "if you get an opportunity to become free, use it"; the Greek is ambiguous, but no retrieved source documents that, so the record cites the verse without comment.

### 25. "The letter from Laodicea"; Nympha / Nymphas

- **Verdict:** OPEN · **Confidence:** uncertain (the letter); probable (Nympha a woman)
- **Sources:** [Wikipedia, "Epistle to the Laodiceans"](https://en.wikipedia.org/wiki/Epistle_to_the_Laodiceans): the letter "generally regarded as being lost"; some identify it with Ephesians or Philemon; the Latin epistle a "clumsy forgery". Tertullian, *Against Marcion* 5.17 ([New Advent](https://www.newadvent.org/fathers/03125.htm)): "this epistle was sent to the Ephesians, not to the Laodiceans". [Wikipedia, "Nympha of Laodicea"](https://en.wikipedia.org/wiki/Nympha_of_Laodicea): "Most scholars now agree that Nympha was female".

---

## Blocked, unused or rejected

- **Blocked (not cited):** whc.unesco.org (403; the Wayback copy is cited instead), britannica.com (403), bibleodyssey.org (403), bible.org (403), britishmuseum.org (403), the Lyell Collection (403), loebclassics.com (403), the English Pliny book 21 on LacusCurtius (404).
- **Out of date (not cited for status):** bibleplaces.com ("no excavations have yet taken place"), biblicalturkey.org (2022).
- **Rejected:** Wikipedia's "Mt. Cadmus" redirect (points to a different mountain); Wikipedia's claim that Colossae "rebuilt independently of Rome" (it transfers Tacitus's remark about Laodicea); the phrase "Pauline mandate" (no reliable source found).

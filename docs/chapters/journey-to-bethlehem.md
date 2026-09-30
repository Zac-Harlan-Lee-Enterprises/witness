# Chapter 3: *A Journey to Bethlehem* (Luke 2:1–20)

**Status:** playable end to end on every branch. The owner approved the chapter's AI-drafted content on 2026-09-26. The text added on 2026-09-30, when the chapter was made longer, is **not** covered by that approval: its three records (`rec-para-ruth`, `rec-e-kid`, `rec-e-supper`) are in review (`sources-attached` / `ai-draft`), and so is the new dialogue.
**Content:** [`src/content/chapters/journey-to-bethlehem/`](../../src/content/chapters/journey-to-bethlehem/)
**Research:** [research/journey-to-bethlehem-sources.md](../research/journey-to-bethlehem-sources.md)
**Play time:** about 20–30 minutes (it was nearer 13–19 before the chapter was made longer; see [§13](#13-play-time)).

This document describes the chapter as built.

## 1. The idea

Luke 2:17–18 says that when the shepherds had seen the child, they made known what they had been told about him, and *all who heard it wondered*. The player is one of those people.

The player is a fictional child (ungendered, as in every chapter) of a Bethlehem household during the emperor's registration. Relatives have come home to be registered, so the house is full. Over one afternoon and night the player:

1. bakes bread for the guests;
2. decides what stays in the small guest room;
3. may help the clerk write down Uncle Asa's household (optional);
4. fetches milk for little Dodi from Hagit, whose runaway kid has to be found first;
5. takes supper to a cousin at the sheepfold, and may share the milk with a newborn lamb;
6. tracks a lost lamb, or goes home;
7. eats supper with the whole household, tells them about the day, and decides what happens to the last loaf;
8. decides where a late stranger sleeps;
9. late at night, hears from a neighbour what shepherds from the fields have been telling everyone.

Then the game shows what Luke 2:1–20 actually says. Scripture, paraphrase, history and interpretation are each labelled.

**What stays off-stage.** Mary, Joseph, the baby, the shepherds of Luke 2 and the angels never appear, never speak and are never played. The player meets them only through:
- Scripture references;
- the labelled paraphrase record `rec-para-luke-2`;
- Hagit's labelled paraphrase (`rec-para-report`) of what the shepherds said.

The house, its guests and the stranger are the player's own fiction. The house is not presented as the place of the birth, and nobody in the game turns Mary and Joseph away. When the player asks to go and see, Hagit says the shepherds didn't say which house, and that the mother and baby should be left to sleep.

## 2. The acts

| Act | Where | What happens | Puzzle / choice |
|---|---|---|---|
| **1. A full house** | Tamar's house | Tamar explains the registration, a little hedged ("*They say* everyone must be written down in their own family's town"). She asks for bread, places set for supper, and a ready guest room. | `p-bread` (logic grid) |
| **2. Making room** | Tamar's house | The guest room floor is a grid, five squares by three, around the water jar, the roof post and the way to the door. Both beds must go in; the loom, the barley and Asa's tools compete for the room left, and only one of them ever fits. The barley may only leave the room if the player has noticed the dry corner on the roof (the ladder). | `p-room` (floor plan) → `choice-room` |
| **3. The crowded village** | The lanes | Saba Amram helps the clerk and tells the well story (labelled paraphrase). Uncle Asa has waited in line since midday. Hagit offers her roof "to a tired soul". Clean straw lies on the threshing floor. | Optional side quest `q-queue`: `p-register` (sequence) |
| **4. Hagit's runaway kid** | The lanes | Tamar asks for a jar of Hagit's milk for Dodi, but Hagit's white kid is out and she can't chase it. Saba Amram, Uncle Asa (in the line, or at home if you helped the clerk) and Kallias each saw one part of its afternoon. Put in order, the last stop is the threshing floor, where the kid is burrowed into the chaff. Bring her home; Hagit gives you the milk and tells how her father once found her lost kid. The east gate waits for the milk (and says where Hagit lives). Uncle Asa's "lamb with horns" turns out to have been this kid. | `p-kid` (logic grid) |
| **5. The fold at dusk** | The fields | Yonatan counts the flock through the gate and one lamb is missing. The player can search or go home before dark. Searching means reading signs; one sighting (Uncle Asa's "lamb" with horns) is questionable. Old Yoram's newborn lamb is hungry; half the milk can go to it. Afterwards Yonatan will talk about the night watch. | `p-lamb` (deduction) → `choice-lamb`; optional `choice-milk` |
| **6. Supper by the fire** | Tamar's house, nightfall | The household eats in the places you set at midday. Peninah gets the milk (a whole jar, or half). You tell them about your day: the topics offered are what you did (the lamb found or left, the kid, Asa's line). Saba retells three verses of Ruth, Naomi coming home to a stirred-up Bethlehem and Boaz winnowing on the threshing floor (labelled paraphrase). There is one loaf left: keep it by the oven for whoever knocks, save it for Yonatan's breakfast, or share it round. | `choice-loaf` |
| **7. A knock at the door** | Tamar's house, night | Zerah, an old basket-maker from Tekoa, has found every door full. The five options depend on earlier choices: a space left in the guest room, straw from the threshing floor, Hagit's offer. Unavailable options stay visible, with the reason. If you kept the loaf, Zerah gets it, even if you turned him away (you run after him). He'll talk about home, his grandfather and his baskets; Tamar will talk by the fire. | `choice-stranger` |
| **8. News in the night** | Tamar's house, late | Hagit knocks. Her retelling of the shepherds' report is a labelled paraphrase. The player wakes the house or keeps it to think about. | `choice-news` → Scripture Connection |
| **9. Reflection and summary** | Panels | An optional private reflection, then a summary of what happened. Nothing is graded. | — |

## 3. Places

Three hand-authored maps, all passing the reachability validator. They are drawn as physical places, and each new tile kind names a real, buildable thing for the later 3D pass (section 10).

### 3.1 Tamar's house (`tamar-house`, indoor, `home`, 26×11)

A fictional village house built the way many scholars reconstruct one (record `rec-recon-house`, confidence *probable*):

- **West:** the lower, straw-strewn end (`straw`) where the animals sleep: the family donkey, Asa's pack donkey, a milk goat, and heaps of `hay`.
- **Edge of the family floor:** a column of stone mangers (`manger`), with `steps` up.
- **Centre:** the raised family floor (`platform`) with the oven, jars, a rug, mats and a table.
- **East, through a doorway:** the small guest room (`bedroll` tiles for Asa's and Peninah's beds).
- **Door:** the single door opens at the animals' end.

| Element | Details |
|---|---|
| Spawns | `start` (13,6); `from-lanes` (5,9) |
| Tamar (npc) | `d-tamar`: bread → room → hands over supper, cloak and lamp → night |
| Kneading trough and flour jar | Opens `p-bread`; becomes fresh bread once solved |
| Ladder to the roof | Examine: sets `roof-store-known` (changes the guest room rule) |
| Guests' things to arrange | Gives the five room items and opens `p-room` |
| Loom, barley jars, tool bag | In the guest room or moved down to the animals, depending on `choice-room` |
| Spare mat | Visible only if the player left a space (`made-space`) |
| Saba Amram, Uncle Asa | Asa is home early if the side quest was done; otherwise not until the lamb business is settled |
| Zerah | At the door, then by the fire, in the guest room, or on straw, depending on `choice-stranger` |
| Your sleeping mat / your bed in the straw | Starts `d-night-news` (it explains itself if it's too early) |
| Exit `to-lanes` | Needs `supper-given`; `d-door-blocked` says what is still to do |
| State trigger `evening` | Once the lamb choice is made: `d-evening` (hour set to 20), then Zerah knocks |

### 3.2 The lanes of Bethlehem (`bethlehem-lanes`, outdoor, `city`, 38×24)

A fictional picture of the village crowded for the registration:

- **North:** stone houses along a lane (Tamar's door is in the north-west).
- **In the lane:** travellers camped outside, because every house is full (bedrolls, mats, a cart, tethered donkeys).
- **By the east gate:** a paved square with the well and the clerk's table.
- **South-west:** Hagit's house and goat yard.
- **South-east:** a threshing floor (`threshing`) at the windy edge of the village above a terrace wall (`terrace`).

| Element | Details |
|---|---|
| Saba Amram, Kallias, the tablets, Uncle Asa in line | Daytime only (hidden once the lamb choice is made) |
| The finished tablet | Clue `clue-model-order`: the order of a declaration |
| The blank tablet | `d-register`: explains what is missing, or opens `p-register` |
| The well by the gate | Examine; Saba's paraphrase of 2 Samuel 23:15–16 |
| Hagit | Her offer (`hagit-offered`), her knowledge of the lamb (`clue-hagit-water`), and whether the kid got out |
| Heap of clean straw | One armful (`straw`) |
| Barley by the travellers' cart, washing by the square, bedrolls in the lane | Examine: where the kid has been, and who is sleeping outdoors tonight (`sprite: 'none'`, so nothing new is drawn) |
| Something chewing in the chaff heap | Hagit's kid, once `p-kid` is solved; take her back to Hagit for the milk (`kid-home`, `got-milk`) |
| Zerah by the well / at Hagit's door | Night, depending on `choice-stranger` |
| Exit `to-fields` (east gate) | Needs `supper-given` and Hagit's milk (`got-milk`); the blocked text says where Hagit lives; +1 hour |

### 3.3 The fold below Bethlehem (`shepherds-fields`, outdoor, `wilderness`, 42×28, weather `wind` → `clear`)

- **North:** terraced olive fields (`soil`, `olive`) held up by a `terrace` wall. Its only gap, up toward the village, is closed with a thorn branch.
- **Centre:** a dry-stone sheepfold (`sheepfold`) with the flock (`sheep`) and a gate, a `trough` with damp ground, and the shepherds' `campfire`.
- **East:** a thorn thicket by an old watch hut.
- **South-east:** a gully (`wadi`) running down to an old cistern.
- **South-west:** lower terraces with crops.

The fold is fictional and is not the place in Luke's story (record `rec-pl-fields`). The cold wind drops to a clear night once the lamb choice is made.

| Element | Details |
|---|---|
| Yonatan | Takes the supper, counts the flock, the lamb is missing; search or go home; takes the lamb back |
| Old Yoram | By the fire with a newborn lamb; gone searching if the player leaves it to the shepherds |
| Signs | Hoofprints by the trough, wool at the top of the gully, the ewe, the closed terrace gap, the clean thicket edge |
| Trigger `think` | After 3 signs while searching: offers `p-lamb` |
| The steep gully path | Opens `p-lamb` while searching; disappears once solved |
| The speckled lamb | Take it: the player carries it across the shoulders (`carrying-lamb`) |
| Exit `to-village` | Once the lamb is missing, leaving asks first (`d-fields-exit`); +1 hour |

## 4. Characters

Everyone is fictional (`fictional: true, biblicalFigure: false`), and the content test enforces it.

| Character | Role | Function |
|---|---|---|
| Tamar | Your mother | Runs the crowded house and hands out the tasks. Tired by night, she leaves the decision about Zerah to you. |
| Saba Amram | Your grandfather | Helps the clerk because he knows every family. Retells the well story (paraphrase) and, at night, remembers that David kept sheep on these hills (paraphrase). |
| Uncle Asa | Stonemason from Jerusalem | Waits in line all afternoon. Owns a share of the house, a plausible reason to register here. Saw a "lamb" with horns (unreliable clue). |
| Aunt Peninah, Dodi | Asa's wife and toddler | In the guest room. Peninah reacts to how you arranged it. |
| Kallias | Registration clerk | Writes the declarations and has a model tablet. |
| Hagit | Neighbour who keeps goats | Offers her roof, knows the flock, brings the news at night. |
| Cousin Yonatan | Young shepherd | Keeps the family's sheep with the village flock. |
| Old Yoram | Shepherd of the village flock | "Don't guess, child — look." |
| Zerah | Basket-maker from Tekoa | Arrives after dark to be registered. Every door is full. |

**Carries:**
- Kallias: a wax tablet.
- Old Yoram: a lamb in his arms.
- Zerah: a lamp held up.
- Hagit: a milk jar.
- Tamar: bread.
- Amram and Yonatan: staffs.
- Asa: a bundle.

## 5. Items, clues and puzzles

**Items:**
- **Room items:** Asa's bedding and Peninah's bedding (essential), the loom, the barley and the tools. Each weighs 2 (floor space). They exist only while the room puzzle is open, and solving removes them.
- **Weightless carried items:** Yonatan's supper and thick cloak, a clay lamp (the chapter's `lightItem`), and an armful of straw.

**Clues:** 11, each with an honest reliability.

| Clue | Source | Reliability |
|---|---|---|
| `clue-model-order` | Clerk's tablet | reliable |
| `clue-hagit-water` | Hagit | reliable |
| `clue-kid-amram`, `clue-kid-asa`, `clue-kid-kallias` | Saba Amram, Uncle Asa, Kallias | reliable: each is one clue of the kid's logic grid |
| `clue-asa-lamb` | Uncle Asa | **unreliable**: it had horns, and it was hours earlier |
| `clue-small-prints`, `clue-wool`, `clue-terrace-gap`, `clue-thicket` | The fold | reliable |
| `clue-ewe` | The fold | uncertain |

| Puzzle | Type | Solution | Evidence in the chapter |
|---|---|---|---|
| `p-bread`: Places for Supper | logic grid (Chapter 3's own type) | Four people, four places along the mat, four clues. Peninah can't be in the two places nearest the fire; Tamar is at an end beside her, so Tamar is by the door and Peninah third; Saba Amram is nearer the fire than Asa: Amram nearest the fire, Asa second. Exactly one answer, and every clue is needed (content test). Press a square to rule it out (✗), again to choose it (✓); choosing rules out the rest of that row and column. | Tamar's Abraham saying stays (Genesis 18:6 by paraphrase); the explanation uses only the hospitality record, and says the supper is made up |
| `p-room`: Room in the Guest Room | floor plan (Chapter 3's own type) | Pieces: Asa's bedding (a row of 3), Peninah and Dodi's (a 2×2 square), the barley jars (an L of 3), the loom (a row of 3), the tools (2). Both beds plus one of barley / loom / tools fit, never two; the barley's L fits only one way, round the roof post. Leaving the barley out requires knowing about the roof. Choose a piece, turn it (R), press the square for its first cell; the floor previews where it would land and says why it won't fit. | Classifies `choice-room`: `kept-grain`, `kept-loom`, `kept-tools`, `made-space` |
| `p-register`: Uncle Asa's Declaration | sequence + conclusion | declarant → town → members with ages → property → oath. Conclusion: to know who lives where and what they own, for taxes. | The clerk's model tablet. The order is modelled on Egyptian returns and labelled as a reconstruction. |
| `p-lamb`: Where Did the Lamb Go? | deduction | The gully, with 2 reliable signs. Presenting Asa's sighting fails the attempt. | Solvable from the fold signs alone |
| `p-kid`: The Kid's Afternoon | logic grid | Four places (the cart, the washing, the well trough, the threshing floor) in order, from three witnesses: the cart before the washing (Saba), the washing before the well (Asa), the well neither first nor last (Kallias). The well must be third, so the washing is second, the cart first and the threshing floor last. Exactly one answer, every clue needed (content test). | Hagit's "I think I know where your kid went" waits until all three have been asked, and says who to ask |

## 6. Quests

**Main quest: *Room for Everyone* (`q-room`).** Its stages are:

1. `welcome`: bread, room, optional greeting, collect the supper.
2. `supper`: optional straw; get Dodi's milk from Hagit (with two optional steps once the kid is missing: ask the three witnesses, bring the kid home); give Yonatan his supper.
3. `lamb`: search (optional sub-steps) or leave; the required step completes on `choice-lamb`.
4. `evening`: go home.
5. `hearth`: supper by the fire; completes on `choice-loaf`.
6. `stranger`: decide.
7. `night`: lie down and hear Hagit.
8. `wonder`: the Scripture Connection.

The outcomes are *Shared the news* or *Kept the news to think about*. Both are successes. The main quest never depends on the side quest, and a test enforces this.

**Side quest: *The Long Line* (`q-queue`).** It starts when the player talks to Asa, Kallias or Saba about the line. The stages are: offer to help, then `p-register`.
- **Success:** *Registered before dark*. Costs +1 hour; Asa and Kallias trust the player more; Asa comes home early and walks Zerah to Hagit's if that option is chosen.
- **Alternate:** *Waited in line*, if the player goes down to the fold first.

## 7. Choices and what you see because of them

| Choice | Options | What shows in the world later |
|---|---|---|
| `choice-room` | kept-grain · kept-loom · kept-tools · made-space | Loom, jars and tool bag stand in the guest room or with the animals. A spare mat marks the space. Peninah and Asa comment. The guest-room option for Zerah is available only with `made-space`, otherwise shown with the reason. |
| `choice-queue` | helped | Asa leaves the line and is at home in the afternoon. Summary line. |
| `choice-milk` | shared · kept | Shared: Yoram's newborn drinks from a corner of his cloak, and Peninah gets half a jar. Kept (or never asked): a whole jar for Dodi. Summary line either way. |
| `choice-loaf` | set-aside · yonatan · shared | Set aside: Zerah gets the loaf, wherever he sleeps (`zerah-bread`). Summary line for each. |
| `choice-lamb` | found · left | Found: the lamb rides on your shoulders, then stands with its mother in the fold. Left: Old Yoram's place by the fire is empty (he has gone searching); you are home earlier; the summary says he found it near midnight. |
| `choice-stranger` | own-place · guest-room · straw-bed · hagit · no-room | Where Zerah lies: by the fire, in the guest room, or on fresh straw by the animals. At Hagit's door or by the well (seen in the lane). If you gave your place, your own bed is in the straw beside the mangers when the news comes. Walking him over yourself costs an hour. |
| `choice-news` | told · kept | Told: everyone sits up in the lamplight. Kept: the house sleeps on. |

Choices never grade the player. The Scripture Connection comparisons respond to each option without judging (for `no-room`: "Your house really was full, and you said so…").

**Time of day** (`hour`, shown only in words):

| Event | Hour |
|---|---|
| Start | 14 |
| Bread | +1 |
| Side quest | +1 |
| To the fields | +1 |
| Freeing the lamb | +1 |
| Back up | +1 |
| Evening at home | set to 20 |
| Walking Zerah over yourself | +1 |
| Lying down | set to 23 |

The kid, the milk and supper by the fire don't move the clock: supper is part of the evening (hour 20), so the fold is still seen in the late sun and at sunset on the main path, as before.

## 8. Scripture Connection and summary

**Panel *Good News in David's Town*:**

| Section | Records |
|---|---|
| The passage | `rec-luke-2-1-20` (reference; placeholder text until a translation is approved), `rec-para-luke-2` |
| The emperor's registration | census, **When was the census?** (*uncertain*), *Everyone to their own town?*, the declaration reconstruction |
| The world of the story | Bethlehem, the house, the feeding trough, bands of cloth, shepherds and folds, shepherds' status (debated), hospitality |
| How Christians have read it | good news, *inn or guest room?*, wondering and pondering, Luke's account and Matthew's, the date, the cave tradition |

**Comparisons:** one always shown, plus one per stranger option, the lamb, the news choice and the side quest.

**Reflection prompts:** three, one of them about wonder; no quiz.

**Summary:** a recap, concrete consequences (including where Zerah slept), the side quest, and 13 Scripture and 10 history references. No score.

## 9. Governance

- **Scripture text:**
  - Scripture records hold references only.
  - The content test fails if distinctive WEB wording from Luke 2 appears anywhere in the chapter.
  - Retellings are `paraphrase` lines linked to paraphrase records. Hagit's lines show "Hagit is retelling Scripture in their own words (Luke 2:8–20) — not a direct quotation."
- **Disputed questions:** the census date, "each to his own town", *katalyma*, the date of the birth, Luke and Matthew, and shepherds' status. Each is a record with an honest confidence and, where Christians differ, a sensitivity note.
- **Review status:** every record has provenance `ai-assisted`. Educational records are `sources-attached`; fiction is `ai-draft`. None is approved. 65 sources, all retrieved.

## 10. New art vocabulary (for the realism pass)

**Tile kinds** (`src/domain/world.ts`):

| Kind | Solid | Meaning (model it as) |
|---|---|---|
| `straw` | no | Straw strewn on the lower, animals' end of a village house |
| `platform` | no | The raised family floor, a step above the straw (a plastered lip where they meet) |
| `threshing` | no | A threshing floor: flat beaten ground or bedrock with chaff, ringed with edging stones |
| `manger` | yes | A stone feeding trough cut from one block, fodder in it, set at the edge of the platform |
| `sheepfold` | yes | A waist-high dry-stone fold wall topped with thorny brushwood; a `gate` in it is a gap with two upright gate stones |
| `terrace` | yes | A dry-stone terrace retaining wall: the drop from one hillside field to the next |
| `sheep` | yes | Two or three sheep lying together |
| `hay` | yes | A loose heap of straw and chaff |
| `campfire` | yes | A small fire in a ring of blackened stones (casts a hearth light) |

**Carries** (`src/domain/characters.ts`): `lamb` (a lamb held in the arms), `lamp` (a clay lamp held up), `tablet` (a wax writing tablet).

**Look mark:** `carrying-lamb` (a lamb across the shoulders).

**Prop sprites:** `lamb`, `ewe`, `goat`, `loom`, `grain-jars`, `tool-bag`, `ladder`, `wool`, `hoofprints`, `straw-bed`, `thorn-branch`, `kneading-trough`, `tablet`.

## 11. Where this is verified

- [`tests/content/journey-to-bethlehem.test.ts`](../../tests/content/journey-to-bethlehem.test.ts) (25 tests) checks:
  - integrity and reachability;
  - the lazy registry;
  - all four puzzle types;
  - an optional side quest;
  - no WEB verse text;
  - paraphrase labelling;
  - fictional characters only, with the people of Luke 2 off-stage;
  - no scoring language;
  - nothing self-approved;
  - retrieved sources;
  - an honest census date;
  - sensitivity notes;
  - a real decision at the door;
  - known sprites;
  - painter rules for the new tiles;
  - the kid's logic grid (one answer, every witness needed, the kid hidden until it is solved), the milk before the fold, supper by the fire (topics that follow the day, a labelled Ruth paraphrase, the loaf choice), and enough to do for 20–30 minutes;
  - that the text added on 2026-09-30 stays in review.
- [`tests/integration/journey-to-bethlehem-playthrough.test.ts`](../../tests/integration/journey-to-bethlehem-playthrough.test.ts) runs six headless playthroughs:
  - generous: side quest, space, lamb, guest room, told;
  - careful: grain, home early, own place, kept;
  - straw;
  - neighbour;
  - full house: no room, search given up;
  - dead-end guards.
  Every path now also fetches the milk (Asa asked in the line or at home), and the paths cover sharing or keeping it, and all three loaf choices (including bread for Zerah when he is turned away).
- [`e2e/journey-to-bethlehem.spec.ts`](../../e2e/journey-to-bethlehem.spec.ts) runs in the browser: new profile → chapter select → opening → the main-path puzzles → the kid's logic grid and the milk → the lamb → supper by the fire → the stranger → the news (paraphrase label) → Scripture Connection → reflection → summary.

## 12. Known gaps

- **Pre-rendered art.** All three places are pre-rendered in 3D ([technical art guide](../art/technical-art-guide.md), [`kit_village.py`](../../tools/art/lib/kit_village.py)): the house by day and by lamplight, the lanes and the fold from mid-afternoon into the night. On the main path the fold is seen in the late sun and at sunset; it is at night only if you helped the clerk first (the sun sets while you carry the lamb, and the fields change to their night light around you) or go back down after dark.
- **Hagit may be off-screen.** She is drawn at the door during her report, but the camera may not frame her if the player's bed is across the room.
- **Leaving the house on the stranger branches.** The house exit stays open at night, so a player can visit Zerah at Hagit's or by the well. Leaving the house before lying down is allowed.

## 13. Play time

The owner found the chapter "playing pretty quick" against a target of 20–30 minutes. Measured by replaying the headless playthroughs and counting every word a player is shown (each dialogue line and choice, each message, and each puzzle's introduction, clues and explanation; the Scripture Connection and summary not included):

| Path | Before (2026-09-26) | After (2026-09-30) |
|---|---|---|
| Least: straight through, nothing optional | 1,700 words, 2 puzzles | 2,680 words, 3 puzzles |
| Typical: the lamb searched for | 1,920 words, 3 puzzles | 3,060 words, 4 puzzles |
| Thorough: side quest, lamb, milk shared, every supper topic | 2,690 words, 4 puzzles | 4,070 words, 5 puzzles |

At a brisk adult pace (about 300 words a minute, a little over a minute a puzzle, instant travel, two minutes for the ending), that is **about 13 → 18 minutes** at the least, **15 → 21** typically and **19 → 25** thoroughly. A first-time younger player (about 200 words a minute, two minutes a puzzle, walking rather than instant travel) takes about a third longer. Supper by the fire and the kid are on the main path, so even a player who skips everything optional sees them.

# Chapter 2: "A Storm on Galilee"

**Passage:** Mark 4:35–41 (parallels: Matthew 8:23–27; Luke 8:22–25). **Play time:** 20–30 minutes for a first-time player (measured in [§13](#13-how-long-it-plays)). **Status:** playable end to end on every major branch; every educational record is an AI-assisted draft awaiting human review ([content-governance.md](../content-governance.md)).

This document describes the chapter **as built**, from [`src/content/chapters/storm-on-galilee/`](../../src/content/chapters/storm-on-galilee/). The research behind it is in [research/storm-on-galilee-sources.md](../research/storm-on-galilee-sources.md). Chapter 1's [game-design.md](../game-design.md) explains the engine features used here.

## 1. The idea

Mark 4:36 says, in passing, that *other boats were with him*. The player is a young member (ungendered, named by their nickname) of a fictional fishing family in Capernaum whose boat is one of those other boats. It is their first night as crew.

They share the storm and the calm, but they never see or hear what happens in the teacher's boat: it is only ever a shape ahead in the dark. Nobody in the story retells it either. When the family is home, the Scripture Connection shows what Mark wrote. The player's choices change only the player's own story — who crossed in their boat, who they helped and how, what the family lost — never the storm, the calm or anything in the text.

**Guardrails, enforced by `tests/content/storm-on-galilee.test.ts`:**

- Jesus is never a character, never visible and never voiced; no entity mentioning the teacher has a character. His words in Mark 4 appear in no dialogue, and no dialogue describes what happened aboard his boat (sleeping, the cushion, the rebuke).
- Lines that retell Scripture (Grandmother on Mark 4:1–2, Dinah on the sower, the evening narration of Mark 4:35–36) are `paraphrase` lines linked to paraphrase records, and the dialogue box labels them.
- Nothing ties the calm, safety or loss to faith: no text says the wind stopped because of the player, and no scores exist.
- Interpretations that differ between traditions are labelled, with sensitivity notes (the nature of the miracle is `high`).

## 2. The seven acts

| Act | Where | What happens | Puzzle / choice |
|---|---|---|---|
| **1. The errand** | Grandmother Shelomit's house | Grandmother explains the crossing: six of Nikanor's jars to the far shore; the fee pays much of what the family owes. Ask Old Hanina about the sky before loading. She gives a lamp, bread, a cloak and a water skin — and before you go, has you tie the last knots of the family's mark in her net. | `p-corner` |
| **2. The fishing quarter** | The shore at Capernaum (afternoon, westerly wind) | Gear from Uncle Elazar, jars from Nikanor, Tamar's rule for a squall, Hanina's warning, signs along the shore, Hodaya's Magdala crew hauling their boat up high, the crowd listening to the teacher offshore, Shifra's family planning to follow in a borrowed boat that leaks. Optional: mend Nikanor's torn jar net; help Hodaya haul (she gives you an old bailer for Oded); seal the seam of Oded's boat with pitch from Nikanor. | `p-brine`, `p-patch` (optional), `p-sky` |
| **3. Loading, and evening** | The jetty | Load the boat within ten loads, and trim her level. Evening: the teacher's disciples leave the crowd and take him across, and other boats go with them. Shifra asks if Ami can cross in your boat. | `p-load` → `choice-load`; `choice-ami` |
| **4. The crossing** | Out on the lake (night) | Calm: hang your lamp at the stern for the boats behind. Then a cold wind off the eastern hills: shorten sail in the right order. The storm breaks; the teacher's boat vanishes in the spray. The little boat off the port side is swamping — or less so, if you readied it on the shore. | `p-sail`; `choice-storm` |
| **5. The calm and home** | The lake; the shore at night | The wind stops all at once. See to the others (the cloak) before Uncle Elazar turns for home; set the trammel net on the still water if you brought it. Grandmother waits on the jetty with a lamp and sends you to tell Nikanor about his jars first; Shifra's family, Hodaya, Hanina and the crew respond to what you did. | `choice-cloak`, `choice-net` |
| **6. Scripture Connection** | Full-screen panel | Mark's passage (placeholder text plus a labelled paraphrase), the parallels, the world of the story, echoes of older Scripture, and how Christians have read it, with comparisons that respond to your choices. | — |
| **7. Reflection and summary** | Full-screen panels | Private reflection, then the summary. Nothing is graded. | — |

## 3. Places

```mermaid
flowchart LR
  H["Grandmother Shelomit's house<br/>shelomit-house 16×10 · home"] -- "house-door<br/>needs q-crossing active" --> S["The shore at Capernaum<br/>capernaum-shore 44×28 · oasis"]
  S -- "to-house" --> H
  S -. "evening (after loading):<br/>d-evening transitions" .-> L["Out on the lake<br/>open-lake 40×24 · wilderness"]
  L -. "after the calm: Uncle Elazar,<br/>'Can we go home?'" .-> S
```

The shore is one map used twice: in the afternoon, and at night when you come home. Day-only people (Hanina, the crowd) leave; night-only things appear (Grandmother with her lamp, Nikanor waiting, and the consequences below).

| Place | Weather | What you see |
|---|---|---|
| Grandmother's house | (indoors) | A small plastered room: nets hung on poles, an oven, jars and baskets of dried fish, sleeping mats. Grandmother sits mending a net. |
| The shore at Capernaum | `wind` (the afternoon westerly), `clear` from evening | Three houses along a paved lane; a net-drying yard; fish-drying racks; Nikanor's salting place (jars, salt sacks, brine tubs); a pebbly beach with boats drawn up; reeds at the west end; a stone jetty running out into the shallows and deep water, with the family boat moored beside it and Old Hanina sitting at its end; the crowd on the beach facing a boat offshore. |
| Out on the lake | `clear` → `wind` → `storm` → `clear` | The family boat (a hull around walkable deck, the mast just forward of the middle, a raised stern platform), the crew at the oars and the steering oar, the cargo you loaded on deck, the little rowing boat off the port side, the teacher's boat ahead to the east, other boats around. |

## 4. People

All fictional (`fictional: true, biblicalFigure: false`). Names are ordinary names of the period.

| Character | Role | Function |
|---|---|---|
| Grandmother Shelomit | Net-mender | Sends you out; insists you ask Hanina first; waits on the jetty with a lamp. |
| Uncle Elazar | Master of the family boat | Gives the gear; needs the fee; turns for home after the storm. |
| Tamar | Cousin, rower | Teaches the order for a squall (the clue for `p-sail`). |
| Yoezer | Hired man (compare Mark 1:20) | Rows; "I listen to old Hanina." |
| Old Hanina | Retired fisherman | The reliable witness: the worst winds come off the eastern heights, at night too. |
| Nikanor | Salt-fish trader from Magdala | Gives the jars; confidently claims the lake is never rough at night (unreliable: he hardly ever crosses); the optional jar-net side quest; pitch and tow for Oded's boat; waits up at night for news of his jars. |
| Hodaya | A young fisher from a Magdala crew | Her crew hauls their boat high and stays ashore: she gives their reading of the night in person (`clue-magdala-crew`). Help haul, and she gives you their old bailer. At night she tells how the lamps on the water went out one by one — and then the wind stopped. |
| Shifra, Ami, Oded | A potter's family from the hills | Came to hear the teacher; follow him across in a borrowed rowing boat that leaks. Oded knows clay, not boats: the optional *Oded's Leaking Boat* seals it. |
| Dinah | A farmer's wife in the crowd | Mentions the parable of the sower (labelled paraphrase). |
| Three listeners | The crowd | Non-speaking. |

## 5. Loading the boat (`p-load`, trim)

Chapter 2's own puzzle type (with net mending): no other chapter uses it. You choose what goes aboard **and where it goes**, so the boat sits level. Capacity **10** loads besides the crew. On offer (16): six jars of salted fish (1 each), bailer 1, rope 1, spare oar 2, trammel net 2, lamp 1, bread 1, cloak 1, water skin 1.

(If you helped Hodaya haul and kept her old bailer, it is on the jetty too: one more load.) The boat has four places, each with its own room: **bow** 4, **port side** 3, **starboard side** 3, **stern** 2. The crew are already sitting and count toward the balance (not the cargo): you in the bow (2), Yoezer to port (3), Tamar to starboard (2), Uncle Elazar steering in the stern (3). Pick something up (from the jetty or a place), then choose where it goes; the arrow keys move between the places. Each place shows its cargo and weight in numbers, and each pair of opposite places says in words whether she sits level.

| Rule | Detail |
|---|---|
| Bailer | Must go. |
| Within capacity | ≤ 10. |
| Enough jars | At least 4 jars — or at least 2 if you mended Nikanor's jar net (he agrees the rest can go with the Magdala boats). |
| Room | No place holds more cargo than its room. |
| Bow and stern | Within 1 of each other, crew included (the bow needs more cargo than the stern). |
| Port and starboard | Within 1 of each other, crew included (starboard needs a little more cargo than port). |

The last hint gives a worked example (four jars in the bow; bailer and lamp in the stern; the spare oar to port; rope and cloak to starboard: bow 6, stern 5, port 5, starboard 4); a content test checks it.

Classified into `choice-load`: **all-jars** (6) · **jars-and-gear** (≥4 and rope or oar) · **jars-and-net** (≥4 and net) · **light**. What you load decides what you can do in the storm: a rope lets you tow; the spare oar can be thrown; five or more jars means making room costs cargo; a cloak can warm Ami; the lamp lights the dark lake (the chapter's `lightItem`). Hanina laughs at carrying drinking water across a lake of sweet water.

## 6. The other puzzles

| Puzzle | Type | Where | Answer and reasoning |
|---|---|---|---|
| `p-sky` "What Is the Sky Saying?" | deduction | End of the jetty, after Hanina's warning | **A strong wind could rush down after dark**, backed by 2 reliable clues: Hanina's warning, the cold breath off the eastern hills, the Magdala crew hauling their boat up; the clear western sky rules out rain. Nikanor's claim is unreliable and spoils an argument; the afternoon wind is irrelevant evidence. The explanation admits no one can say exactly when or how strong. |
| `p-sail` "Shorten Sail!" | sequence | On the lake, when the gust hits | Brails → yard → oars and bow to the waves → bail (Tamar's order; labelled fiction). Conclusion: keep her bow to the waves, keep bailing, stay near the other boats. |
| `p-corner` "Grandmother's Corner" | netting (Chapter 2's own type) | Grandmother's house, before you leave (the door waits for it) | A small first net, 5 by 5: the family's mark, a little boat under sail, loose in columns 2–4. The middle column is a 5 and row 4 is a 5, so a first-timer learns how the numbers read. Exactly one mending fits. |
| `p-patch` "Seal the Seam" | sequence (optional) | Oded's boat, once you have pitch and tow | Rag out → let it dry → press in the tow → smear warm pitch → let it set (Uncle Elazar's way; the method is labelled simplified). Conclusion: it should keep most of the water out, but they should still bail and stay near the other boats. |
| `p-brine` "Nikanor's Jar Net" | netting (optional; Chapter 2's own type) | Nikanor's torn jar net, by the salting tubs | A picture logic grid (a nonogram) 7 wide and 5 high: Nikanor's fish mark, torn through columns 2–5. The numbers by each row and column are its runs of knots, in order; tie the torn cells so every line matches. Exactly one mending fits (checked in `chapter-integrity.ts`). Space ties a knot, again leaves it open, again clears it; arrows move. Relaxes the jar rule for loading. (The id is kept from when this was a brine-measuring puzzle.) |

## 7. Choices and what you see because of them

| Choice | Options | What you see later |
|---|---|---|
| `choice-load` | all-jars · jars-and-gear · jars-and-net · light | Jars, rope, oar, net, bailer on the deck; lamp and rolled cloak on you; jars you left on the shore's rack at night. |
| `choice-ami` (at evening, only if you met Shifra) | room (≤4 jars) · made-room (leave a jar) · no-room | Ami on your deck during the crossing, or in the little boat. |
| `choice-storm` | take-aboard (throws 3 jars overboard if you carry 5+) · tow (needs the rope) · oar (needs the spare oar) · hold-course | Shifra's family on your deck and their empty boat; the towline to their boat (and on the beach at night); Oded with your oar (and your oar in their boat at night); jars bobbing in the water. Impossible options are shown with the reason ("You didn't bring the rope."). |
| `choice-cloak` | given (to Ami, on your deck or passed across) | Ami wrapped in your cloak on the lake and at home; the cloak gone from your back. |
| Side quest `q-brine` (Nikanor's Jar Net) | finished · unfinished | Nikanor's words; the summary. |
| Side quest `q-leak` (Oded's Leaking Boat) | sealed · still leaking | In the storm the little boat takes water over its side, not up through the seam; after the calm it is "low in the water but still afloat"; Oded and Shifra say so at night. |
| Hodaya's old bailer (given to Oded) | — | Shifra bails with it in the storm, and says so at night. |
| The lamp at the stern (`lamp-hung`) | — | If you held your own course, the little boat kept your lamp in sight through the storm. |
| `choice-net` (if the net is aboard) | set · home | A catch in the bottom of the boat; home an hour later (3 a.m.); Nikanor buys the catch, and Uncle Elazar calls it a start on any lost jars. |

Main-quest outcomes: **Home, with the jars** (success) or **Home, lighter than you left** (alternate, if jars went overboard). In every branch everyone comes home: the calm comes the same way whatever you chose.

## 8. Weather and time

| Moment | Hour | Weather |
|---|---|---|
| Start (house, shore) | 16 (late afternoon) | shore `wind` |
| Evening, boats put out | 18 | shore `clear`, lake `clear` |
| Under way | 19 | `clear` |
| Gust (after talking to anyone aboard, or walking forward) | 20 | `wind` |
| Storm breaks (after shortening sail) | 21 (+1 if you bring the family aboard) | `storm` |
| The calm | 23 | `clear` |
| Home | 26 (2 a.m.), or 27 if you set the net | shore `clear` |

Weather comes from `weather` + `weatherChanges` on each scene; the world reports it on the canvas as `data-weather` (drawing it is another workstream).

## 9. Scripture Connection and summary

Title: **"What Happened in the Boat Ahead."** Sections: the passage (`rec-mark-4-35-41` + our paraphrase); the same story in Matthew and Luke (+ "only Mark mentions the other boats"); the world of the story (the lake, storms, the Ginosar boat, "the cushion", nets, the fishing economy); echoes of older Scripture (interpretation + Psalm 107:23–30, Psalm 89:9, Jonah 1:4–6); how Christians have read it (who is this; fear and turning to him; the boat as the Church; views on the miracle; in the same storm).

Comparisons respond to what you did (made room, towed or lent an oar, held course, threw cargo overboard — "In Jonah 1:5, frightened sailors did the same thing" — found room for Ami). Reflection prompts: when you were most afraid; how you would answer "Who then is this?"; who you know in a storm now.

## 10. Notes for the 3D realism pass

**New tile kinds** ([`src/domain/world.ts`](../../src/domain/world.ts)) — each names a real thing:

| Kind | Solid | Model |
|---|---|---|
| `shingle` | no | Pebbly beach of dark basalt and pale limestone pebbles. |
| `deck` | no | Deck planking of the boat you're aboard (planks fore and aft, pegs). |
| `jetty` | no | A breakwater / landing stage of large basalt blocks, running out into the water. |
| `lake` | yes | Open lake water (deep blue-green). |
| `shallows` | yes | Shallow water over pebbles, lighter; foam where it meets the shore. |
| `hull` | yes | The rim (gunwale) of the boat you're aboard; its tiles approximate a lens-shaped hull — paint the curve, not the tiles. |
| `mast` | yes | Mast stepped in the keel, a yard across it, the square sail partly brailed up; shrouds to the rail. |
| `boat` | yes | Neighbouring `boat` tiles form ONE boat shaped to its footprint (long axis = length). Afloat: oars out, steering oar, mast and sail if ≥ 4 tiles long. Drawn up on the beach: mast lowered along the boat, sail rolled on the yard, a heap of net. |
| `nets` | yes | Nets hung between two poles to dry: cork floats on the head rope, stone sinkers on the foot. |
| `rack` | yes | A wooden drying rack of split fish on two trestles. |

**Boats:** model loosely on the Ginosar boat: ~8.2 m × 2.3 m, planked, round-bottomed, one mast, four oars and a helmsman, a raised stern deck where the helmsman stood. The player's family boat on `open-lake` is drawn larger than life (26 × 8 tiles) so four crew and cargo fit on a walkable deck.

**Buildings:** Capernaum's houses were **dark local basalt** fieldstone without mortar, roofed with beams, branches and mud. The painted placeholder uses the `oasis` mood (green, golden, lively — right for the fertile lake shore), whose building material is mudbrick; please model basalt. The lake uses the `wilderness` mood (its wind-blown motes read as spray; its occasional hawk shadow is harmless at night).

**New prop sprites** ([`src/game/art/props.ts`](../../src/game/art/props.ts)): `fish-jars`, `bailer`, `rope`, `oar`, `net-pile`, `floating-jars`, `towline`, `fish-basket`. Reused: `vessels`, `lamp`, `none`.

**New carries** ([`src/domain/characters.ts`](../../src/domain/characters.ts)): `net` (a folded net over the shoulder, drawn over the tunic from every side) and `oar` (held upright, blade up). Used by Grandmother Shelomit and Tamar (net), Uncle Elazar and Oded (oar).

**Look marks used:** `wrapped-in-cloak` (Ami), and on the player `lamp`, `cloak-roll`, `water-skin`.

**As built (pre-rendered).** Every place is pre-rendered by the offline Blender pipeline ([technical-art-guide.md](../art/technical-art-guide.md), the `lake` kit in [`tools/art/lib/kit_lake.py`](../../tools/art/lib/kit_lake.py)), in the lights the story shows it in (its light plan: `PLACE_LIGHTS` in [`lighting.py`](../../tools/art/lib/lighting.py); the game picks the `night` set from 18:00 to 05:00, the `late` set from 15:00):

| Place | Lights | What is modelled |
|---|---|---|
| `shelomit-house` | the afternoon sun through a west window and the door (the `late` set); lamplight at night (the `night` set, rendered in `lamplight`; people lit by `lamp`) | A room in cutaway with basalt walls, a mud-plastered back wall with niches and a lamp, a basalt-cobbled earth floor, nets on pegs, a string of small fish drying on a cord, two oars against the wall, baskets of dried fish, the tannur; at night a lamp burns on the table. |
| `capernaum-shore` | afternoon (`late`), and from sunset, as the boats put out, the moonlit night you come home to (`night`; the game changes set as the clock reaches 18:00) | Three houses of undressed basalt fieldstones laid dry, with basalt doorframes and lintels, small grilled windows, beam-and-mud roofs with a low parapet and fish drying on them, water jars and basalt quern stones at the doors; a lane of basalt flags; drying nets (floats and sinkers), fish-drying racks, the salter's jars, salt and brine tubs; a shingle beach of basalt and limestone pebbles, the waterline with foam; the jetty of dressed basalt blocks with pierced mooring stones; boats drawn up (masts lowered) and moored (yards lowered, sails furled); the boat offshore that the crowd faces has a goat-hair shade rigged over it, so no one aboard is ever seen. At night Grandmother's lamp lights the jetty and a lamp burns inside one house. |
| `open-lake` | the moonlit night (`night`, from sunset on) | The family boat as a larger-than-life hull: planked bulwarks with frames, a rounded gunwale, oars out through thole pins, the steering oar on the starboard quarter, the stem and sternpost, the helmsman's raised deck, a lamp hung at the stern after dark, the mast with its yard braced round and the sail half brailed; the boats around (under way, yards braced, stern lamps after dark); the teacher's boat ahead under its shade. |

The storm itself is not baked: the lake is rendered calm, and the engine draws the wind, waves, rain and lightning over it (the live water surface covers `lake` and `shallows` and reflects a sky that matches the light).

## 11. Where this is verified

- **Content rules** ([`tests/content/storm-on-galilee.test.ts`](../../tests/content/storm-on-galilee.test.ts)): integrity, reachability, all four puzzle types, an optional side quest, Scripture as references with labelled paraphrase, no Jesus character or voice, no retelling of his boat in the story, no scoring or faith-reward language, nothing self-approved, every source retrieved and used, a real decision with visible constraints, story-driven weather, and that the painter knows every tile kind.
- **Headless playthroughs** ([`tests/integration/storm-on-galilee-playthrough.test.ts`](../../tests/integration/storm-on-galilee-playthrough.test.ts)): complete branches (tow with Ami aboard and the side quest; full cargo, leave a jar for Ami, jettison to take the family aboard; never met Shifra, hold course with nothing to share; light load after the side quest, the oar, the cloak passed across; Hodaya's bailer, a sealed seam, the lamp at the stern, hold course, set the net, Nikanor, Hanina and Hodaya at night; the seam left unsealed), plus loading gates, Grandmother's knots before the door, loading-and-trim and sky rules, and an unfinished side quest.
- **Play time** ([`tests/integration/play-time.test.ts`](../../tests/integration/play-time.test.ts)): see §13.
- **Browser end to end** ([`e2e/storm-on-galilee.spec.ts`](../../e2e/storm-on-galilee.spec.ts)): new profile → Chapter 2 → opening → Grandmother's corner → sky → loading → the lake as `data-weather` goes `clear` → `wind` → `storm` → `clear` → decision → the others → home → Nikanor → Scripture Connection → reflection → summary.

## 12. Known gaps

- **The storm is drawn over calm art:** the pre-rendered lake is baked calm, and the game's weather (wind, rain, lightning, the swell on the live water surface) carries the storm.
- **One map for day and night** on the shore: the teacher's boat and the other boats stay where they are at night; only the hotspot labelling the teacher's boat is removed.
- **Pre-rendered art:** there is no dusk set: from 18:00 the shore and the lake are shown in their moonlit night sets (the game tints them for sunset at first), so the boats put out under a moonlit sky just as the sun goes down.
- **The summary's banner art** is the game's shared journey picture (Jerusalem-like hills), not a lake.
- **Mood:** no dedicated lakeside mood (see §10); adding one would touch `direction.ts`, the HUD emblem and tests owned by others.
- **The season** isn't stated. Afternoon westerlies are a summer pattern and the fiercest easterlies are Oct–May; the game says only that winds off the eastern heights "can come at night".
- **Scripture text:** the WEB text of Mark 4 is not in the translation registry, so the panel shows the placeholder even if WEB display is later enabled for Luke 10. Adding it is a human editorial decision.

## 13. How long it plays

The owner found the chapters "playing pretty quick. Much shorter than the projected 20 to 30 minutes" (2026-09-30). Measured by [`tests/integration/play-time.test.ts`](../../tests/integration/play-time.test.ts) with the model in [`tests/support/play-time.ts`](../../tests/support/play-time.ts) (explained in [game-design.md §17](../game-design.md#17-how-long-it-plays)): a *steady* first-timer reads every line at 230 words a minute; a *brisk* adult reads at 320 and solves puzzles quickly. *Direct* follows only the main quest; *curious* takes up what the shore offers.

| Run | Before (steady · brisk) | After (steady · brisk) |
|---|---|---|
| Direct | 19 min · 12 min | 23 min · 15 min |
| Curious | 30 min · 20 min | 39 min · 26 min |

**What was added:** Grandmother's corner (a first, small net before the door opens), Hodaya of the Magdala crew (a new person, a witness at night), *Oded's Leaking Boat* (an errand across three people and a sequence puzzle, whose result you see in the storm), the lamp at the stern, seeing to the others before turning home, the net on the still water, and telling Nikanor before Grandmother. None of it touches what happens in the teacher's boat, and none of it ties the calm to anything the player did.

**Art:** Hodaya is pre-rendered like everyone else (people sheets in the `late` and `night` lights; portraits neutral, glad and worried). Old Hanina's night figure reuses his seated sheets. No place was re-rendered: every new hotspot sits on a tile that already draws itself.

# Chapter design documents

One document per chapter, describing the chapter **as built** from its content folder, `src/content/chapters/<id>/`. The game-wide design (pillars, controls, puzzle types, time of day, the ending, the play-time model) is in [game-design.md](../game-design.md); how to add a chapter is in [chapter-authoring-guide.md](../chapter-authoring-guide.md).

## The chapters

| # | Chapter | Content | Document |
|---|---|---|---|
| 1 | *The Road to Jericho* | [`road-to-jericho`](../../src/content/chapters/road-to-jericho/) | [road-to-jericho.md](road-to-jericho.md) |
| 2 | *A Storm on Galilee* | [`storm-on-galilee`](../../src/content/chapters/storm-on-galilee/) | [storm-on-galilee.md](storm-on-galilee.md) |
| 3 | *A Journey to Bethlehem* | [`journey-to-bethlehem`](../../src/content/chapters/journey-to-bethlehem/) | [journey-to-bethlehem.md](journey-to-bethlehem.md) |
| 4 | *A Letter from Paul* | [`letter-from-paul`](../../src/content/chapters/letter-from-paul/) | [letter-from-paul.md](letter-from-paul.md) |

## A new chapter needs one

**Every chapter registered in [`src/content/index.ts`](../../src/content/index.ts) must have `docs/chapters/<id>.md`, listed in the table above.** [`tests/content/chapter-docs.test.ts`](../../tests/content/chapter-docs.test.ts) fails until it does, and checks that each document:

- has the fourteen sections below, with these exact headings, in this order;
- names every scene of the chapter by its id;
- names every puzzle of the chapter by its id and type, on the same row of the §6 table (for example `` | `p-load` Load the Boat | `trim` | … | ``).

The test can't check every sentence. Keep the document true when the chapter changes: new records awaiting review (§12), new puzzles (§6), new play-time numbers (§11), gaps fixed or found (§14).

## Template

Copy this skeleton. Use `###` subsections freely inside a section; backtick every id; link files relative to `docs/chapters/` (`../../src/…`, `../research/…`). Facts come from the code, the research notes and the tests, never from memory.

````markdown
# Chapter N: *Title*

**Passage:** … **Play time:** … (see [§11](#11-how-long-it-plays)). **Status:** playable end to end; approval status in [§12](#12-content-and-approval-status).
**Content:** [`src/content/chapters/<id>/`](../../src/content/chapters/<id>/) is the source of truth; this document describes the chapter as built. Engine-wide design (controls, puzzle types, the ending contract, the play-time model): [game-design.md](../game-design.md).

## 1. The idea and the passage

The premise and the player's role; how the fiction sits beside the passage without rewriting it; every passage reference the content uses; the chapter's guardrails and the test that enforces them.

## 2. Acts

| Act | Where | What happens | Puzzle / choice |
|---|---|---|---|

## 3. Places

Every scene by id: size, mood, weather, what is there, exits and gates (a mermaid flowchart helps).

## 4. People

| Character | id | Role | Function |
|---|---|---|---|

## 5. Quests and stages

Every quest by id: stages, objectives, outcomes. `### Items` (id, weight, how you get it, why it exists).

## 6. Puzzles

| Puzzle | Type | Where | Solution |
|---|---|---|---|
| `p-id` Title | `type` | … | … |

Then each puzzle's rules, hints and what it sets. `### Clues` (id, source, reliability, used by).

## 7. Choices and consequences

Every choice by id, its options, and what the player sees and hears because of it.

## 8. Time, weather and light

What moves the clock, the weather in each scene and what changes it, and which pre-rendered light set is shown when.

## 9. Scripture Connection and summary

Title, sections with record ids, comparisons, reflection prompts, the summary's Scripture references, and the state of the Scripture text.

## 10. Art

Pre-rendered places (kits, light plans), people sheets, portraits and the expressions the dialogue uses, and any teaser.

## 11. How long it plays

Measured numbers, how they were measured, and what pins them.

## 12. Content and approval status

What the owner's approvals cover, and every record still awaiting review (id, kind, title). Chapter-specific governance decisions.

## 13. Sources and verification

Research notes, `sources.ts`, and the tests: content, playthroughs, play time, browser end to end.

## 14. Known gaps

Current, real gaps only.
````

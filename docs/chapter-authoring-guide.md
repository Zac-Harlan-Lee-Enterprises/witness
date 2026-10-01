# Chapter authoring guide

How a developer or content editor adds a new chapter (Chapter 5 and on) **without changing the engine**. Dialogue, quests, inventory, journal, puzzles, saving, input, UI and governance are all reused; a chapter is data, plus its art and its tests.

> Worked examples: the four chapters in [src/content/chapters/](../src/content/chapters/), each described in [chapters/](chapters/README.md). Copy the structure of the one closest to yours: Chapter 2 ([storm-on-galilee](../src/content/chapters/storm-on-galilee/)) is a good template for a later chapter, since it has its own `sources.ts` and `governance.ts`.

The checklist, in order:

| # | Step | Section |
|---|---|---|
| 1 | Choose the passage, research it, write the research notes | [§0](#0-before-you-write-anything) |
| 2 | Create the content folder | [§1](#1-create-the-folder) |
| 3 | Register the chapter | [§2](#2-register-it) |
| 4 | Scenes, people, dialogue (with expressions), quests, puzzles, items, clues, choices, journal, ending | [§3](#3-scenes-and-maps)–[§9](#9-the-ending-contract) |
| 5 | Records and the approvals workflow | [§10](#10-records-sources-and-approvals) |
| 6 | Scripture text | [§11](#11-scripture-text) |
| 7 | Art: places, people, portraits | [§12](#12-art-places-people-and-portraits) |
| 8 | An optional teaser | [§13](#13-an-optional-teaser) |
| 9 | Tests | [§14](#14-tests) |
| 10 | The chapter document | [§15](#15-the-chapter-document) |

## 0. Before you write anything

1. Read [content-governance.md](content-governance.md). Decide which biblical passage the chapter connects to and **how the player's fictional story sits beside it without rewriting it** (Chapter 1: the player walks the same road and hears the parable from a fictional character; Chapter 2: the player is in one of the "other boats" and never sees what happens in the teacher's boat).
2. Research every historical claim you intend to teach, and write it up claim by claim in `docs/research/<chapter-id>-sources.md` (see [research/storm-on-galilee-sources.md](research/storm-on-galilee-sources.md)). Record uncertainty instead of inventing certainty. Never invent verses, citations or historical claims.
3. Sketch the seven-act journey ([game-design.md §7](game-design.md#7-the-shape-of-a-chapter)): mission → preparation choice → travel + puzzle using earlier information → a hard decision with real constraints → consequences → Scripture connection → reflection + summary. Aim for 20–30 minutes for a first-time player.

## 1. Create the folder

```
src/content/chapters/<chapter-id>/
  index.ts          # assembles and exports a ChapterInput (e.g. export const MY_CHAPTER)
  characters.ts     items.ts     clues.ts     choices.ts (+ THEMES)
  records.ts        journal.ts   quests.ts    puzzles.ts   ending.ts
  sources.ts        # this chapter's retrieved sources (+ the shared ones it cites)
  governance.ts     # this chapter's draft() presets, dated (see §10)
  scenes/*.ts       dialogue/*.ts
  teaser.ts         # optional (§13)
```

Dialogue helpers (`say`, `opt`, …) live in each chapter's `dialogue/helpers.ts`; copy one. Type every file against the schema **input** types, e.g. `export const ITEMS: ChapterInput['items'] = [...]`. The Zod schema (`ChapterSchema` in [src/domain/chapter.ts](../src/domain/chapter.ts)) fills defaults; `validateChapterIntegrity` ([src/domain/chapter-integrity.ts](../src/domain/chapter-integrity.ts)) checks every reference, the reachability of every interactive thing and exit, and the fairness of grid, dyeing and map puzzles. Both run in `npm run content:validate` ([scripts/validate-content.ts](../scripts/validate-content.ts)) and again when the chapter loads.

`index.ts` sets `id`, `number`, `title`, `subtitle`, `synopsis`, `estimatedMinutes`, `setting`, `start` (scene and spawn), `initial` (flags, counters such as `hour`, inventory), `opening` effects, `timeCounter`, optional `lightItem` and `playerLooks`, `mainQuest`, and the lists. Wrap the records in `withApprovals('<chapter-id>', RECORDS)` (§10).

## 2. Register it

Add an entry to `REGISTRY` in [src/content/index.ts](../src/content/index.ts):

```ts
{
  meta: {
    id: '<chapter-id>',
    number: 5,
    title: '…',
    subtitle: '…',
    available: true,
    estimatedMinutes: { min: 20, max: 30 },
    // hasTeaser: true,   only with a teaser (§13)
  },
  load: () => import('./chapters/<chapter-id>').then((m) => m.MY_CHAPTER),
},
```

The dynamic `import()` keeps the chapter out of the initial download (an architecture test enforces this). An entry with `available: false` and no `load` shows in the menu as "not available yet". Once registered, every test that walks `chapterSource` (art assets, portraits, Scripture text, the chapter-docs check) includes the new chapter.

## 3. Scenes and maps

A scene ([src/domain/world.ts](../src/domain/world.ts)) is an ASCII `layout` plus a `legend` mapping characters to tile kinds, `spawns`, `entities`, `exits`, `triggers`, `mood`, `weather` (and `weatherChanges`), ambience and music.

- **Tile kinds** and which are solid: `TILE_KINDS` in `world.ts`, the single source of truth (Chapters 2–4 added a lake shore and boats, a village house and fold, and a Roman town). A new kind needs a builder in the Blender pipeline (§12), and the painted fallback draws it in `src/game/art/`.
- **Mood** (`home`, `city`, `wilderness`, `oasis`) chooses the place's palette, ambient life and sound ([ADR-0013](adr/0013-art-direction-system.md)) and the ground palette of its rendered art.
- **Weather** (`clear`, `wind`, `rain`, `storm`) is story-driven: set `weather` on the scene and change it with `weatherChanges` on conditions. The engine draws it over the art.
- **Staging people:** `pose: 'sit' | 'lie'` on an entity, `carry` in a character's appearance (staff, jar, bread, spindle, bundle, basket, net, oar…), and `looks` (marks such as `bandaged` or `wrapped-in-cloak` shown when a condition holds). Every pose and mark needs rendered sheets (§12).
- Every row must be the same width. Generating layouts with a small script and pasting them in is fine.
- **Gate progress with things the player can examine**, not invisible walls (Chapter 1 blocks the wadi and the bend with examinable entities, and the ridge path with a blocker whose `visibleWhen` hides it once the route puzzle is solved).
- **Entities**: `npc` (with `characterId`), `sign`, `clue`, `feature`, `item`, `container`, `door`. `sprite` names come from [src/game/art/props.ts](../src/game/art/props.ts) (`none` = invisible hotspot on a tile that already draws itself). `interaction` = `{ verb, dialogue?, effects?, requires?, blockedText? }`.
- **Exits** move between scenes; restricted exits must explain themselves (`blockedDialogue` or `blockedText`).
- **Triggers** fire once (`onceFlag`): *area* triggers when the player steps into a rectangle; *state* triggers (no `area`) as soon as their `when` becomes true.

## 4. Characters, dialogue and the player

- Characters are fictional unless `biblicalFigure: true`. **Biblical figures are never player-controlled, and Jesus does not appear as a speaking character**; players learn of his words through Scripture (with references) and clearly labelled paraphrase.
- `appearance` drives the rendered person and the portrait (§12).
- Dialogue ([src/domain/dialogue.ts](../src/domain/dialogue.ts)): nodes with `speaker` (character id, `player` or `narrator`), `text` (use `{player}` for the nickname, and keep the player ungendered), `effects`, `choices`, `next`, conditional `branches`, and dialogue-level conditional `entries` (chosen before the meeting is recorded, so `met` means "met before this conversation").
- Choices: `when` hides a choice; `requires` + `unavailableText` shows it **disabled with the reason** ("You have no water left to clean his wounds").
- Retelling Scripture? Use `kind: 'paraphrase'` with a `recordId` pointing at a paraphrase record.
- **Expressions.** Add `expression` (`glad`, `worried`, `sad`, `angry`, `surprised` or `afraid`; `neutral` if omitted) where the feeling is clear from the words and the scene, e.g. `say('e1', 'ezer', 'Cheated! …', { expression: 'angry' })`. It is presentation only (which portrait is shown): never change a line's words for it. Each expression a speaker uses needs a rendered portrait (§12); until then the neutral one stands in, and `tests/content/portraits.test.ts` fails.
- Avoid preachy exposition and "good answer vs. evil answer" choices. Give each option a real reason a thoughtful person might pick it, and a concrete consequence later.

## 5. The declarative language

Conditions and effects are data ([src/domain/conditions.ts](../src/domain/conditions.ts), [src/domain/effects.ts](../src/domain/effects.ts)); there is **no scripting and no `eval`**.

| Conditions | Effects |
|---|---|
| `flag`, `hasItem`, `questStatus`, `questStage`, `objectiveDone`, `choiceMade`, `clueFound`, `cluesFound`, `puzzleSolved`, `visited`, `met`, `conversationDone`, `counter`, `trust`, `journalUnlocked`, `all`, `any`, `not`, `always` | `setFlag`, `giveItem`, `takeItem`, `startQuest`, `completeObjective`, `unlockJournal`, `discoverClue`, `adjustTrust`, `adjustCounter`, `setCounter`, `recordChoice`, `meetCharacter`, `openPuzzle`, `transition`, `startDialogue`, `openPanel`, `showMessage`, `playSound`, `completeChapter` |

Effects that need the screen (`openPuzzle`, `transition`, `startDialogue`, `openPanel`) are queued while a conversation or puzzle is open and run in order afterwards. The story clock is a counter (`timeCounter: 'hour'`): move it with `adjustCounter` on travel and decisions, never in real time ([game-design.md §9](game-design.md#9-time-of-day)).

## 6. Quests

A quest ([src/domain/quests.ts](../src/domain/quests.ts)) has stages → objectives (`completeWhen` condition, `optional`, `revealWhen`), `outcomes` (first matching `when` wins; `success`/`alternate`/`failure`; alternate endings are not punishments), optional `failWhen` + `failOutcome`, `eventsConsumed`/`eventsEmitted` (validated against the event catalogue) and journal hooks. Prefer objectives that complete from **state conditions** rather than one-off effects; they are robust to different play orders. Keep side quests genuinely optional.

## 7. Puzzles

Ten types exist, unioned in [src/domain/puzzles.ts](../src/domain/puzzles.ts) (the originals `packing`, `measuring`, `deduction`, `sequence`) and one `src/domain/puzzle-<type>.ts` module each for `trim`, `netting`, `floorplan`, `logicGrid`, `dyeing` and `map`. [game-design.md §8](game-design.md#8-puzzle-types) says what each does and which chapter uses it.

- **Give each chapter puzzles of its own.** `packing` and `measuring` belong to Chapter 1, and Chapters 2–4 each own two types (`trim` and `netting`; `logicGrid` and `floorplan`; `map` and `dyeing`). [`tests/content/puzzle-variety.test.ts`](../tests/content/puzzle-variety.test.ts) pins this per chapter: add the new chapter to its list (and to the `own` map if it owns a type). `deduction` and `sequence` may appear in any chapter. A new chapter usually wants a new type that fits its setting.
- The grid types (`netting`, `floorplan`, `logicGrid`), `dyeing` and `map` are checked for a fair answer in `chapter-integrity.ts`: exactly one solution, a reachable goal, a target that needs exactly the dips allowed.
- Every puzzle needs an `intro`, tiered `hints` (three or more, numbered from 1; only the last tier explains the answer), an `explanation` shown after solving, and `recordIds` for any factual claim. The house style is pinned by `puzzle-variety.test.ts`.
- When a puzzle has one correct answer, **the evidence available in the chapter must logically support it**, and the puzzle must be solvable even if the player skipped optional conversations. When uncertainty is real, say so in the answer (Chapter 1's "What happened here?" conclusion).

**A new puzzle type** is an engine extension (open/closed): a schema and a pure checker in `src/domain/puzzle-<type>.ts`, added to the union in `puzzles.ts`; integrity checks in `chapter-integrity.ts`; a method on `PuzzleController`; a view in [src/features/puzzles/](../src/features/puzzles/) and a branch in `PuzzleHost`; a first-solve time in `FIRST_SOLVE` ([tests/support/play-time.ts](../tests/support/play-time.ts)); unit, UI and accessibility tests (see [tests/ui/new-puzzles.test.tsx](../tests/ui/new-puzzles.test.tsx)). Keep it playable from the keyboard alone, announced to screen readers, and never reliant on colour alone.

## 8. Items, clues, choices, journal

- Items exist because they matter to a decision or puzzle. Weights make packing and trim meaningful; `essential` items can't be left behind.
- Clues state their `reliability` honestly (`reliable`, `uncertain`, `conflicting`, `unreliable`). Deliberately conflicting testimony makes investigation meaningful.
- Choice definitions describe **consequences, not virtues**; `themes` are descriptive tags.
- Journal entries are lists of labelled records, unlocked by effect or by `unlockWhen`.

## 9. The ending contract

Every chapter ends the same way (engine behaviour): a dialogue emits `openPanel: 'scripture-connection'` → the player reads the labelled passage, background and interpretations plus `comparisons` (conditional on what they did) → **Reflect** (optional text, stored only on the device) → the summary (`summary.recap`, `consequences`, `themes`, `scriptureRecordIds`, `historyRecordIds`, `reflectionPrompts`). The main quest's final objective should complete on the flag `seen:scripture-connection`. Nothing in the summary grades the player.

## 10. Records, sources and approvals

Every piece of educational or story text the player reads in the journal and the Scripture Connection is a **record** ([src/domain/content-records.ts](../src/domain/content-records.ts)) with a kind (Scripture reference, paraphrase, historical, reconstruction, interpretation, fiction), sources, confidence, sensitivity and governance.

1. **Sources.** Put every source you actually retrieved in the chapter's `sources.ts`, with its access date, and cite them from the records. Only retrieved sources may be cited (each content test checks it).
2. **Governance.** Every new record is an AI-assisted draft: give it a governance preset from the chapter's `governance.ts` (built on `aiDraft()` / `draftOn()` in [src/content/shared/governance.ts](../src/content/shared/governance.ts)), dated the day it was written. An agent never marks anything `approved`.
3. **Approvals.** Only a named person approves, by adding an entry to `APPROVALS` in [src/content/shared/approvals.ts](../src/content/shared/approvals.ts) (and the approval log in [content-governance.md](content-governance.md)). `withApprovals('<chapter-id>', RECORDS)` in the chapter's `index.ts` applies it: an approval covers only records drafted, and last changed, on or before its date (`coveredBy`: every entry of the record's history). A new chapter is not named in any approval, so all its records stay awaiting review. Text added to an already-approved chapter later is dated later (as the longer chapters were, `LONGER_CHAPTERS_DRAFTED`) and stays in review until approved again. A teaser's words are approved on their own (`TEASER_APPROVALS`, §13).
4. **Check.** `npm run content:publish-check` lists every record still awaiting a human; in the default `VITE_CONTENT_MODE=preview` they are labelled "Awaiting editorial review" in the game. Add a content test that the chapter's new records are not approved (copy "keeps what was added after the approval … awaiting review" in `tests/content/road-to-jericho.test.ts`).

## 11. Scripture text

Scripture records hold **references only**. [`tests/unit/infrastructure/scripture.test.ts`](../tests/unit/infrastructure/scripture.test.ts) requires every Scripture reference in every registered chapter to have its text stored in [src/content/scripture/translations.ts](../src/content/scripture/translations.ts): copy each new passage verbatim from the World English Bible (`https://ebible.org/eng-web/`, footnote markers removed), add a WEB source for it, and never alter the text while keeping the name ([content-governance.md §3](content-governance.md#3-scripture-text)).

## 12. Art: places, people and portraits

Every place and person is pre-rendered offline by Blender (5.2 or later; set `BLENDER=` to its path). The full guide is [art/technical-art-guide.md](art/technical-art-guide.md) (§7 *Adding things*); portraits are in [art/portraits.md](art/portraits.md) (§11). In outline:

1. **Export the data:** `npm run art:data` writes every available chapter's maps and characters to `tools/art/data/chapter.json`. Run it whenever characters or maps change.
2. **Places.** For each scene: a builder for any new tile kind (`tile_<kind>` in a kit in [tools/art/lib/](../tools/art/lib/); a new world usually gets its own kit, like `kit_lake.py`, `kit_village.py` or `kit_roman.py`), and story props as `entity_<sprite>`. Give the scene its **light plan** in `PLACE_LIGHTS` ([tools/art/lib/lighting.py](../tools/art/lib/lighting.py)) if the story shows it in other than the default morning and later-day light (a `night` set is drawn from 18:00). Probe quickly with `node scripts/art-build.mjs probe <scene-id> x0 y0 x1 y1`, then render with `node scripts/art-build.mjs place <scene-id>` into `public/art/<scene-id>/`. Add the id to `PLACES_WITH_ART` in [src/game/prerendered/select.ts](../src/game/prerendered/select.ts) and `PLACES` in [scripts/art-build.mjs](../scripts/art-build.mjs), and its files to [art/asset-manifest.json](art/asset-manifest.json).
3. **People sheets.** `npm run art:people` renders, for everyone who appears, standing sheets, rest sheets for sit and lie poses, and overlays for every mark their looks can show, in every light the places they appear in were rendered in (render the places first); it renders only what `public/art/people/people.json` lacks, and makes the half-resolution phone copies (`node scripts/art-build.mjs people-low` makes missing ones without rendering).
4. **Portraits.** Give each new speaker a casting entry in `CASTING` ([tools/art/lib/portrait_params.py](../tools/art/lib/portrait_params.py)); `npm run art:fetch-makehuman` once per machine; `npm run art:portrait-data` exports everyone who speaks and the expressions their lines use to `tools/art/data/portrait-people.json`; `npm run art:portraits -- --missing` renders what is missing or out of date into `public/art/portraits/`; `npm run art:portrait-sheets` redraws the review sheets.
5. **Check.** [`tests/content/art-assets.test.ts`](../tests/content/art-assets.test.ts) checks the place list matches `public/art/`, every manifest is valid and matches its map, every story prop and tile kind has art, everyone has sheets for every pose and mark in the right light, and every file is in the asset manifest. [`tests/content/portraits.test.ts`](../tests/content/portraits.test.ts) checks the portrait data is in step with every chapter and every expression is rendered. Review captures per chapter are Playwright specs (`e2e/storm-art.spec.ts`, `e2e/bethlehem-art.spec.ts`, `e2e/letter-art.spec.ts`; technical-art-guide §10).

## 13. An optional teaser

A chapter may have a short film before it plays (only Chapter 1 has one today: [teaser.ts](../src/content/chapters/road-to-jericho/teaser.ts)). It is content (`TeaserSchema` in [src/domain/teaser.ts](../src/domain/teaser.ts)): the film's `src` and `poster` under `art/teaser/`, its length, a description in words for screen readers, the words as timed text cues (never burned into the picture), and score cues in the game's own film moods. Its words are a record that needs its **own** approval (`withTeaserApproval` and `TEASER_APPROVALS` in `approvals.ts`). Set `teaser` in the chapter and `hasTeaser: true` in its registry entry, which adds "Watch the teaser" to chapter select. The film is rendered by `node scripts/art-build.mjs teaser` (`tools/art/build_teaser.py`, with its own sets; [technical-art-guide.md §11](art/technical-art-guide.md#11-the-teaser-film-before-chapter-1)). Pin the approved words and the files in a content test like [tests/content/teaser.test.ts](../tests/content/teaser.test.ts).

## 14. Tests

```bash
npm run content:validate      # schema, references, reachability, puzzle fairness
npm test                      # unit, content, integration, architecture and UI tests
npm run test:e2e              # browser end to end (first time: npx playwright install chromium)
```

1. **Content rules:** copy [tests/content/storm-on-galilee.test.ts](../tests/content/storm-on-galilee.test.ts) to `tests/content/<chapter-id>.test.ts`: integrity, reachability, the lazy registry, puzzle types, an optional side quest, Scripture as references with labelled paraphrase, no Jesus character or voice, no scoring language, no invented motives, nothing self-approved, every source retrieved and used, a real decision with visible constraints, and the chapter's own guardrails.
2. **Puzzle variety:** add the chapter to [tests/content/puzzle-variety.test.ts](../tests/content/puzzle-variety.test.ts) (§7).
3. **Headless playthroughs:** `tests/integration/<chapter-id>-playthrough.test.ts`, with `createHarness({ chapter: loadChapter(MY_CHAPTER) })` and the scripted `Player` ([tests/support/harness.ts](../tests/support/harness.ts)): every major branch to the summary, and each gate. This is the fastest way to find dead ends.
4. **Play time:** add a *direct* and a *curious* run to [tests/integration/play-time.test.ts](../tests/integration/play-time.test.ts) and pin the floor (20–30 minutes for a curious first-timer even at a brisk pace). `PLAY_TIME=1 npx vitest run --project unit tests/integration/play-time.test.ts --silent=false` prints the numbers for the chapter document.
5. **Browser end to end:** `e2e/<chapter-id>.spec.ts` (see [e2e/storm-on-galilee.spec.ts](../e2e/storm-on-galilee.spec.ts), helpers in [e2e/support.ts](../e2e/support.ts)): new profile → the chapter → every puzzle → the decision → Scripture Connection → reflection → summary. Look at every stage with `E2E_SHOTS=1`.
6. **The chapter document:** [tests/content/chapter-docs.test.ts](../tests/content/chapter-docs.test.ts) fails until §15 is done.

## 15. The chapter document

**Required.** Write `docs/chapters/<chapter-id>.md` from the template in [chapters/README.md](chapters/README.md) (the same fourteen sections as every chapter), describing the chapter as built, and add it to the README's list. The test checks that the document exists, has the template's sections in order, names every scene by id, and names every puzzle with its id and type; keep it accurate as the chapter changes (new records awaiting review, new puzzles, new play-time numbers).

## 16. What should NOT require engine changes

If you find yourself editing `src/domain/rules.ts`, the dialogue or quest engines, saving, the journal UI or input for a single chapter, stop: express it as content, or propose a small, general engine feature (with tests and, if consequential, an ADR in [adr/](adr/)). A new puzzle type, tile kind or Blender kit is a welcome, general extension.

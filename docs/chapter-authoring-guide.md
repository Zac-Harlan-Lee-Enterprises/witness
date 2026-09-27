# Chapter authoring guide

How a developer or content editor adds a new chapter (e.g. *A Storm on Galilee*) **without changing the engine**. Dialogue, quests, inventory, journal, puzzles, saving, input, UI and governance are all reused; a chapter is data.

> Worked example throughout: Chapter 1, [src/content/chapters/road-to-jericho/](../src/content/chapters/road-to-jericho/). Copy its structure.

## 0. Before you write anything

1. Read [content-governance.md](content-governance.md). Decide which biblical passage the chapter connects to and **how the player's fictional story sits beside it without rewriting it** (Chapter 1: the player walks the same road and hears the parable from a fictional character; the parable itself is shown as Scripture + labelled paraphrase).
2. Research every historical claim you intend to teach and add the sources you actually retrieved to [src/content/shared/sources.ts](../src/content/shared/sources.ts). Record uncertainty instead of inventing certainty.
3. Sketch the 7-act journey (see [game-design.md](game-design.md)): mission → preparation choice → travel + puzzle using earlier information → a hard decision with real constraints → consequences → Scripture connection → reflection + summary.

## 1. Create the folder

```
src/content/chapters/storm-on-galilee/
  index.ts          # assembles a ChapterInput
  characters.ts     items.ts     clues.ts     choices.ts (+ themes)
  records.ts        journal.ts   quests.ts    puzzles.ts   ending.ts
  scenes/*.ts       dialogue/*.ts (use ../road-to-jericho/dialogue/helpers.ts style helpers)
```

Type every file against the schema **input** types, e.g. `export const ITEMS: ChapterInput['items'] = [...]`. The Zod schema fills defaults and validates when the chapter loads.

## 2. Register it

In [src/content/index.ts](../src/content/index.ts), change the placeholder entry to `available: true` and add a lazy loader:

```ts
{
  meta: { id: 'storm-on-galilee', number: 2, title: 'A Storm on Galilee', subtitle: '…', available: true, estimatedMinutes: { min: 20, max: 30 } },
  load: () => import('./chapters/storm-on-galilee').then((m) => m.STORM_ON_GALILEE),
},
```

The dynamic `import()` keeps the chapter out of the initial download (an architecture test enforces this).

## 3. Scenes and maps

A scene ([src/domain/world.ts](../src/domain/world.ts)) is an ASCII `layout` plus a `legend` mapping characters to tile kinds, `spawns`, `entities`, `exits`, `triggers`, ambience and music.

- **Tile kinds** and which are solid: `TILE_KINDS` in `world.ts`, the single source of truth (Chapters 2–4 added a lake shore, boats, a village house and fold, and a Roman town, among others). Need a new look (e.g. `boat`, `lake`)? Add the kind to `TILE_KINDS`, a painter case (`src/game/art/terrain.ts`, `architecture.ts`, `nature.ts` or `furnishings.ts`) and, if it stands up, a height in `site.ts` — the only engine change a new *environment* may need.
- **Mood** (`Scene.mood`: `home`, `city`, `wilderness`, `oasis`) chooses the place's palette, building material, light and ambient life ([ADR-0013](adr/0013-art-direction-system.md)). Dress a map along its walls and under its trees, keep walkways clear, and let `npm run content:validate` prove every person, clue and exit is still reachable.
- **Staging people:** `pose: 'sit' | 'lie'` on an entity (e.g. someone resting or injured), and `carry` in a character's appearance (staff, jar, bread, spindle, bundle, basket) so their role reads at a glance.
- Every row must be the same width (the loader rejects ragged maps). Generating layouts with a small script and pasting them in is fine.
- **Gate progress with things the player can examine**, not invisible walls: Chapter 1 blocks the wadi and the bend with examinable entities, and the ridge path with a blocker whose `visibleWhen` hides it once the route puzzle is solved.
- **Entities**: `npc` (with `characterId`), `sign`, `clue`, `feature`, `item`, `container`, `door`. `sprite` names come from [src/game/art/props.ts](../src/game/art/props.ts) (`none` = invisible hotspot on a tile that already draws itself). `interaction` = `{ verb, dialogue?, effects?, requires?, blockedText? }`.
- **Exits** move between scenes; restricted exits must explain themselves (`blockedDialogue` or `blockedText`).
- **Triggers** fire once (`onceFlag`): *area* triggers when the player steps into a rectangle; *state* triggers (no `area`) as soon as their `when` becomes true — e.g. "you've found enough clues".
- The validator checks that **every interactive thing and exit is reachable from every spawn** — run it often.

## 4. Characters, dialogue and the player

- Characters are fictional unless `biblicalFigure: true`. **Biblical figures are never player-controlled, and Jesus does not appear as a speaking character** in this design; players learn of his words through Scripture (with references) and clearly labelled paraphrase.
- `appearance` drives both the world sprite and the portrait.
- Dialogue ([src/domain/dialogue.ts](../src/domain/dialogue.ts)): nodes with `speaker` (character id, `player` or `narrator`), `text` (use `{player}` for the nickname — and keep the player ungendered), `effects`, `choices`, `next`, conditional `branches`, and dialogue-level conditional `entries`.
- Choices: `when` hides a choice; `requires` + `unavailableText` shows it **disabled with the reason** — use this to make constraints visible ("You have no water left to clean his wounds").
- Retelling Scripture? Use `kind: 'paraphrase'` with a `recordId` pointing at a paraphrase record.
- A character's face on a line: add `expression` (`glad`, `worried`, `sad`, `angry`, `surprised` or `afraid`; `neutral` if omitted) where the feeling is clear from the words and the scene, e.g. `say('e1', 'ezer', 'Cheated! …', { expression: 'angry' })`. It is presentation only (which portrait is shown): never change a line's words for it. Then `npm run art:portrait-data` and `npm run art:portraits -- --missing` render the faces the lines now use ([portraits guide](art/portraits.md) §11); until then the neutral portrait stands in.
- Avoid preachy exposition and "good answer vs. evil answer" choices. Give each option a real reason a thoughtful person might pick it, and a concrete consequence later.

## 5. The declarative language

Conditions and effects are data ([src/domain/conditions.ts](../src/domain/conditions.ts), [src/domain/effects.ts](../src/domain/effects.ts)) — there is **no scripting and no `eval`**.

| Conditions | Effects |
|---|---|
| `flag`, `hasItem`, `questStatus`, `questStage`, `objectiveDone`, `choiceMade`, `clueFound`, `cluesFound`, `puzzleSolved`, `visited`, `met`, `conversationDone`, `counter`, `trust`, `journalUnlocked`, `all`, `any`, `not`, `always` | `setFlag`, `giveItem`, `takeItem`, `startQuest`, `completeObjective`, `unlockJournal`, `discoverClue`, `adjustTrust`, `adjustCounter`, `setCounter`, `recordChoice`, `meetCharacter`, `openPuzzle`, `transition`, `startDialogue`, `openPanel`, `showMessage`, `playSound`, `completeChapter` |

Effects that need the screen (`openPuzzle`, `transition`, `startDialogue`, `openPanel`) are queued while a conversation or puzzle is open and run in order afterwards, so you can chain them safely.

## 6. Quests

A quest ([src/domain/quests.ts](../src/domain/quests.ts)) has stages → objectives (`completeWhen` condition, `optional`, `revealWhen`), `outcomes` (first matching `when` wins; `success`/`alternate`/`failure` — alternate endings are not punishments), optional `failWhen` + `failOutcome`, `eventsConsumed`/`eventsEmitted` (validated against the event catalogue) and journal hooks. Prefer objectives that complete from **state conditions** rather than one-off effects; they are robust to different play orders. Keep side quests genuinely optional.

## 7. Puzzles

Four types exist ([src/domain/puzzles.ts](../src/domain/puzzles.ts)): `packing`, `measuring`, `deduction`, `sequence`. Each needs tiered `hints` (only the last tier explains the answer), an `explanation` shown after solving, and `recordIds` for any factual claim. When a puzzle has one correct answer, **the evidence available in the chapter must logically support it** — and the puzzle must be solvable even if the player skipped optional conversations (Chapter 1's route puzzle can be solved from clues at the fork alone). When uncertainty is real, say so in the answer (Chapter 1's "What happened here?" conclusion).

Need a **new puzzle type**? That is an engine extension (open/closed): add a schema + pure checker in `puzzles.ts`, a method on `PuzzleController`, a view in [src/features/puzzles/](../src/features/puzzles/) and a branch in `PuzzleHost` — with tests.

## 8. Items, clues, choices, journal

- Items exist because they matter to a decision or puzzle. Weights make packing meaningful; `essential` items can't be left behind.
- Clues state their `reliability` honestly (`reliable`, `uncertain`, `conflicting`, `unreliable`). Deliberately conflicting testimony makes investigation meaningful.
- Choice definitions describe **consequences, not virtues**; `themes` are descriptive tags.
- Journal entries are lists of labelled records, unlocked by effect or by `unlockWhen`.

## 9. The ending contract

Every chapter ends the same way (engine behaviour): a dialogue emits `openPanel: 'scripture-connection'` → the player reads the labelled passage, background and interpretations plus `comparisons` (conditional on what they did) → **Reflect** (optional text, stored only on the device) → the summary (`summary.recap`, `consequences`, `themes`, `scriptureRecordIds`, `historyRecordIds`, `reflectionPrompts`). The main quest's final objective should complete on the flag `seen:scripture-connection`. Nothing in the summary grades the player.

## 10. Validate, test, play

```bash
npm run content:validate                      # schema, references, reachability, governance rules
npm test                                      # includes tests/content and architecture rules
```

1. Copy `tests/content/road-to-jericho.test.ts` for your chapter (integrity, reachability, ≥3 puzzle types if applicable, no scoring language, no invented motives, fiction labelled, nothing self-approved).
2. Copy `tests/integration/playthrough.test.ts` and script a headless playthrough of **every major branch** with the `Player` helper — this is the fastest way to find dead ends.
3. Add or extend an E2E spec, then look at every stage with `E2E_SHOTS=1`.
4. Run `npm run content:publish-check` to see what still needs human review.

## 11. What should NOT require engine changes

If you find yourself editing `src/domain/rules.ts`, the dialogue or quest engines, saving, the journal UI or input for a single chapter, stop: express it as content, or propose a small, general engine feature (with tests and, if consequential, an ADR in [adr/](adr/)).

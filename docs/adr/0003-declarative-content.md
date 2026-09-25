# ADR-0003: Declarative content (conditions/effects as data, Zod-validated) instead of scripts

- **Status:** Accepted
- **Related:** [src/domain/conditions.ts](../../src/domain/conditions.ts), [src/domain/effects.ts](../../src/domain/effects.ts), [src/domain/rules.ts](../../src/domain/rules.ts), [src/domain/chapter.ts](../../src/domain/chapter.ts), [src/domain/chapter-integrity.ts](../../src/domain/chapter-integrity.ts), [src/content/index.ts](../../src/content/index.ts), [src/content/validation.ts](../../src/content/validation.ts), [scripts/validate-content.ts](../../scripts/validate-content.ts), [architecture.md §6–7](../architecture.md#6-the-condition-and-effect-dsls)

## Context

Chapters are authored by writers and editors (with AI assistance for drafts), reviewed for theological and historical accuracy, and must be addable without engine changes. Content that runs arbitrary code is hard to review, can break the game in ways only a playthrough reveals, and is a security risk if content ever comes from somewhere other than the repository. The game also needs every branch to be testable, and needs to know, before shipping, that no id points at nothing.

## Decision

- **All gating and all state changes are data.** A `Condition` is one of 19 predicate types (`flag`, `hasItem`, `questStage`, `choiceMade`, `cluesFound`, `trust`, `all`/`any`/`not`, and so on). An `Effect` is one of 19 effect types (`setFlag`, `giveItem`, `startQuest`, `recordChoice`, `openPuzzle`, `transition`, `completeChapter`, and so on). Both are Zod discriminated unions (`ConditionSchema`, `EffectSchema`) evaluated by pure functions.
- A chapter is a single `ChapterInput` object ([road-to-jericho/index.ts](../../src/content/chapters/road-to-jericho/index.ts)) that must satisfy `ChapterSchema`. Small authoring helpers (for example [dialogue/helpers.ts](../../src/content/chapters/road-to-jericho/dialogue/helpers.ts)) only build plain data.
- Validation happens in layers:
  1. **Shape**: `ChapterSchema.safeParse`.
  2. **Meaning**: `validateChapterIntegrity`, which checks for duplicate ids and makes sure every referenced item, quest, stage, objective, choice option, clue, puzzle, scene, spawn, character, dialogue node, journal entry, content record, source and theme exists, along with per-kind content-record rules, map parsing, walkable spawns and exits, and restricted exits that explain themselves.
  3. **Playability**: `reachabilityIssues`, meaning every interactive entity and exit is reachable from every spawn, and no spawn sits inside an exit.
- These run in `npm run content:validate` (also the first step of `npm run build`), in CI, in [tests/content/](../../tests/content/), and again at runtime in `parseChapter` when a chapter loads. On failure it throws `ChapterLoadError` with every issue.
- A single deterministic runner, `runEffects`, applies effects and advances quests to a fixpoint (details in [architecture.md §7](../architecture.md#7-the-rules-runner)).
- An architecture test forbids `eval(` and `new Function(` anywhere in `src/`.

## Consequences

- Content diffs are readable and reviewable, and an editor can see exactly what a choice does.
- Broken references are build failures, not runtime surprises. The runtime still degrades gracefully: invalid transitions are logged and the batch is dropped (see [architecture.md §13](../architecture.md#13-error-handling)).
- Every branch is testable: [tests/integration/playthrough.test.ts](../../tests/integration/playthrough.test.ts) plays each path of Chapter 1 through the real rules.
- Expressiveness is deliberately limited. A new kind of logic needs a new condition or effect type in the domain (with schema, evaluator, integrity check and tests), which is a reviewed engine change rather than a content hack. The chapter authoring guide says to stop and propose a small, general engine feature instead of special-casing a chapter.
- Rules are data, so content cannot loop forever: the runner caps cascades (`MAX_RULE_ITERATIONS = 64` passes, 512 drained effects) and reports content whose conditions toggle each other.

## Alternatives considered

- **Embedded scripting** (JavaScript snippets, Lua, Ink/Yarn with code hooks). Very expressive, but not reviewable by non-programmers, not statically checkable for dangling ids, and needs a sandbox.
- **An external narrative tool format** (Ink, Yarn Spinner) for dialogue only. Good authoring ergonomics, but it would split the model: quests, puzzles, triggers and the content-integrity labels (Scripture vs paraphrase vs fiction) would live elsewhere, and cross-references between systems would be unchecked.
- **JSON files instead of TypeScript data.** Equivalent at runtime, but TypeScript gives editor completion from `ChapterInput` types and lets chapters be split into modules and lazily imported like code.

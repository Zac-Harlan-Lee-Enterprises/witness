# ADR-0010: No numeric spiritual scoring. Relationships are shown as words, and consequences are concrete facts.

- **Status:** Accepted
- **Related:** [src/domain/state/game-state.ts](../../src/domain/state/game-state.ts), [src/domain/effects.ts](../../src/domain/effects.ts) (`TRUST_MIN`, `TRUST_MAX`), [src/domain/characters.ts](../../src/domain/characters.ts) (`trustLabel`), [src/domain/chapter-summary.ts](../../src/domain/chapter-summary.ts), [src/domain/chapter.ts](../../src/domain/chapter.ts) (`ChoiceDefinition.themes`), [tests/content/road-to-jericho.test.ts](../../tests/content/road-to-jericho.test.ts), [content-governance.md](../content-governance.md)

## Context

Many games reward "good" choices with points: karma meters, morality bars, XP. In a Christian game, a number attached to faith, holiness, righteousness or God's favour would teach something false (grace is not earned by points), would be divisive across traditions, and would turn moral choices into optimisation puzzles. Choices still need to matter, and players and teachers need to see what followed from them.

## Decision

- **No score of faith, holiness, salvation or favour exists anywhere in the state.** `GameState` holds only concrete facts: flags, counters (for example the hour of day), inventory, quest progress, choices made, clues, journal entries, people met, conversations, puzzle progress and the optional reflection.
- **Relationships are the only graded value, and they are shown as words.** `trust` per character is an integer clamped to `TRUST_MIN = -2` … `TRUST_MAX = 3` by `adjustTrust`, and is shown only through `trustLabel()`: "Wary of you", "Unsure about you", "Just met", "Friendly", "Trusts you", "Counts you as a friend". It describes a relationship, not the player's worth.
- **Consequences are facts in the world**, expressed through data: an item given away, a quest resolved with an `alternate` outcome, a character who trusts you, a time of day. `ChoiceDefinition.themes` are descriptive tags ("never scores"), and each option carries a plain-language `consequence`.
- **The chapter summary reports, it does not grade.** `buildChapterSummary` lists recap lines, choices with their consequences, relationships (as words), items left, discoveries, side-quest outcomes, themes, Scripture and history records, and reflection prompts. There is no score, rank or "best ending".
- Failure outcomes are **alternate endings, not punishments**. Puzzle attempts and hints are counted only for optional anonymous analytics, with no penalty.
- The content test suite ([tests/content/road-to-jericho.test.ts](../../tests/content/road-to-jericho.test.ts)) fails in three cases:
  - Chapter text contains scoring language, meaning "(faith | holiness | salvation | righteousness) (score | points | meter | level)", "good Christian answer", or "you sinned / failed God".
  - The injured traveler's decision node offers fewer than three choices.
  - Any of those choices uses words like "good", "evil", "right thing", "wrong thing" or "sin".

## Consequences

- Players reflect on what happened instead of chasing a meter. The Scripture Connection and reflection prompts ask questions rather than pronounce verdicts.
- Designers have to express consequences concretely (and write them as `consequence` text). This takes more writing than adding points, and is intentional.
- Analytics can never report "spiritual" metrics, because none exist.
- Any future feature that ranks players, compares them, or displays trust numerically would contradict this ADR and needs a superseding decision.

## Alternatives considered

- **A visible morality or karma meter.** A common, well-understood mechanic, but theologically misleading, and it turns the parable's point into a points exercise.
- **A hidden score that selects endings.** It avoids showing a number, but still grades the player behind the scenes, and makes the "right" answer something to discover and game.
- **Numeric trust shown to the player.** Precise, but it invites optimisation and reads as a rating of people. Words convey the relationship well enough.

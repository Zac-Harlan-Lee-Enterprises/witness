# Testing strategy

What is tested where, how to run it, and what is **not** tested yet.

**Current results (2026-09-24):**
- **Vitest:** 198 tests in 19 files pass (`npm test`, re-run while writing this document).
- **Playwright:** 17 tests pass and 1 is intentionally skipped, across three browser projects. This is the build session's result; `test-results/.last-run.json` records `"status": "passed"`.

---

## 1. The pyramid

```
                 ┌────────────────────────────┐
                 │  Playwright E2E  (e2e/)    │  18 runs of 7 specs on 3 device projects
                 │  real Chromium, prod build │  → the 15-step journey, a11y, PWA, saves, perf
                 └────────────────────────────┘
            ┌──────────────────────────────────────┐
            │  React UI  (tests/ui, jsdom)         │  21 tests · RTL + axe-core
            └──────────────────────────────────────┘
       ┌────────────────────────────────────────────────┐
       │  Integration  (tests/integration)              │  6 headless full-chapter playthroughs
       │  Content  (tests/content)                      │  12 content-rule tests
       │  Architecture  (tests/architecture)            │  18 executable layer/safety rules
       └────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────┐
  │  Unit  (tests/unit: domain, application, infrastructure,  │  141 fast, deterministic tests
  │  game systems)                                           │
  └──────────────────────────────────────────────────────────┘
```

- Most behaviour lives in **pure domain code** (`src/domain`), so most tests are fast unit tests with no DOM, no Phaser and no storage.
- The **integration** layer drives the *real* application layer and the *real* Chapter 1 content, with a fake world instead of Phaser. It proves that every branch of the story can be finished.
- The **UI** layer tests React components in jsdom with React Testing Library and axe-core.
- **E2E** runs the production build in a real browser.

## 2. Vitest projects

Both projects are defined in [`vite.config.ts`](../vite.config.ts) under `test.projects`.

| Project | Environment | Includes | Setup | Command |
|---|---|---|---|---|
| `unit` | node | `tests/unit/**`, `tests/integration/**`, `tests/content/**`, `tests/architecture/**` | [`tests/setup/unit.ts`](../tests/setup/unit.ts) (`fake-indexeddb/auto`) | `npm run test:unit` (architecture only: `npm run test:arch`) |
| `ui` | jsdom | `tests/ui/**/*.test.tsx` | [`tests/setup/ui.ts`](../tests/setup/ui.ts) (jest-dom matchers, `fake-indexeddb`, RTL cleanup, `matchMedia` stub) | `npm run test:ui` |

`npm test` runs both.

## 3. Vitest inventory

| File | Tests | What it covers |
|---|---:|---|
| [`tests/unit/domain/conditions.test.ts`](../tests/unit/domain/conditions.test.ts) | 33 | Every declarative predicate (flags, items, quest status and stage, objectives, choices, clues, puzzles, visited, met, conversations, counters, trust, journal, all/any/not). Schema rejects executable-looking content. Reference collection for integrity checks. |
| [`tests/unit/domain/effects.test.ts`](../tests/unit/domain/effects.test.ts) | 9 | Flags, items (stack limits), trust clamping, choices recorded once, counters, UI-request events, chapter completion, immutability. |
| [`tests/unit/domain/quests.test.ts`](../tests/unit/domain/quests.test.ts) | 8 | Start, objectives, stage advance, `onEnter`, outcomes and alternate outcomes, `failWhen` endings, invalid transitions, quest log and HUD objective, determinism. |
| [`tests/unit/domain/dialogue.test.ts`](../tests/unit/domain/dialogue.test.ts) | 6 | Entry node chosen by conditions, hidden vs unavailable-with-reason choices, `once` choices, branching, missing nodes, name interpolation. |
| [`tests/unit/domain/inventory.test.ts`](../tests/unit/domain/inventory.test.ts) | 3 | Stack limits, never negative, weight and stable ordering. |
| [`tests/unit/domain/puzzles.test.ts`](../tests/unit/domain/puzzles.test.ts) | 13 | All four puzzle checkers (packing, measuring, route deduction, event sequence), tiered hints, explanations that don't give the answer away. |
| [`tests/unit/domain/save-migrations.test.ts`](../tests/unit/domain/save-migrations.test.ts) | 13 | A migration for every past version, v1 → current, idempotence, corrupt/garbage/newer-version saves, tampered state. |
| [`tests/unit/domain/governance.test.ts`](../tests/unit/domain/governance.test.ts) | 10 | Content-integrity rules (no verse text in Scripture records, cited paraphrases, sourced history with confidence), the editorial workflow (AI drafts can't self-approve), Scripture reference formatting and the exact placeholder. |
| [`tests/unit/domain/misc.test.ts`](../tests/unit/domain/misc.test.ts) | 12 | Event ownership, journal auto-unlock and unseen counts, trust wording, nickname validation, settings fallback, key rebinding, analytics off by default, pathfinding, study-guide answer policy. |
| [`tests/unit/application/services.test.ts`](../tests/unit/application/services.test.ts) | 18 | SaveService (round-trip, migrate-on-load, corrupt neighbours, storage failure), Autosaver, ProfileService (create, rename, remove *with saves*, cap, completion), SettingsService, Analytics (consent, whitelist, **reflection never included**), UiStore, VirtualInput, time-of-day wording, event-bus isolation. |
| [`tests/unit/application/session-controllers.test.ts`](../tests/unit/application/session-controllers.test.ts) | 8 | GameSession with the dialogue, puzzle and game controllers: opening, dialogue log, missing nodes, unavailable choices, queued screen requests, blocked exits, invalid quest transitions, pause and play time. |
| [`tests/unit/infrastructure/persistence.test.ts`](../tests/unit/infrastructure/persistence.test.ts) | 2 | IndexedDB repositories (on `fake-indexeddb`): per-profile save index, persistence across connections. |
| [`tests/unit/infrastructure/scripture.test.ts`](../tests/unit/infrastructure/scripture.test.ts) | 3 | Placeholder by default. Stored text only once approved *and* licensed. |
| [`tests/unit/game/systems.test.ts`](../tests/unit/game/systems.test.ts) | 3 | Collision and wall sliding, diagonal normalisation, interaction-focus choice within reach. |
| [`tests/integration/playthrough.test.ts`](../tests/integration/playthrough.test.ts) | 6 | Four complete playthroughs (thorough, hurried, long, send-help), the "can't leave unprepared" rule, and the too-light water plan unless the player learned about the cistern. |
| [`tests/content/road-to-jericho.test.ts`](../tests/content/road-to-jericho.test.ts) | 12 | Schema and referential integrity, reachability of every object and exit from every spawn, lazy registry load, puzzle and quest variety, no verse text, every retelling labelled, fictional characters only (Jesus is never a character), no scoring language, no invented priest/Levite motives, nothing self-approved, only retrieved sources cited, a real (non-moralistic) choice at the injured traveler. |
| [`tests/architecture/layers.test.ts`](../tests/architecture/layers.test.ts) | 18 | Layer import rules (8). Phaser, IndexedDB and React containment. Phaser and chapters loaded only lazily. No `fetch`/XHR/`sendBeacon`/WebSocket, no `eval`/`new Function`, no `any`, no `console.log`, and reflection text never reaches infrastructure or analytics. |
| [`tests/ui/menus.test.tsx`](../tests/ui/menus.test.tsx) | 8 | Title and About dialog (Escape, focus return), profile creation with validation, profile removal, chapter select, settings (applied, persisted), key remapping, statistics off by default, text scale. |
| [`tests/ui/game-ui.test.tsx`](../tests/ui/game-ui.test.tsx) | 13 | Dialogue (keyboard, number keys, unavailable choices with reasons, paraphrase label), HUD, Go-to list, journal tabs and content labels, quest log text status, satchel, packing and measuring puzzles, tiered hints, Scripture Connection, summary (no grading). |
| **Total** | **198** | |

## 4. Deterministic test support

| Helper | What it gives |
|---|---|
| [`tests/support/state.ts`](../tests/support/state.ts) → `makeState(patch)` | A minimal, deterministic `GameState` built with `createInitialState` and overridden by `patch`. Used by the condition, effect, puzzle and journal tests. |
| [`tests/support/harness.ts`](../tests/support/harness.ts) → `createHarness()` | The real `GameSession`, `UiStore`, `DialogueController`, `PuzzleController` and `GameController`, running on the real Chapter 1 content (validated with `parseChapter`). Around them: a **`FakeWorld`** (a `WorldPort` double that records scenes, entities and travel requests), `SilentAudio`, an event log, a capturing analytics provider (consent optional) and an **injected clock** that moves forward 1,000 ms per call. |
| `Player` (same file) | A scripted player: `choose(id)` (on a missing or unavailable choice it throws and lists the visible ones), `advance`, `finish`, `interact`, `exit`, `step`. `flush()` drains microtasks, because screen requests are queued. |
| [`tests/fixtures/saves/`](../tests/fixtures/saves/) | `v1-market.json` (a legacy v1 save in the market), `v1-corrupt-inventory.json`, `future-v99.json`, `garbage.json`. Used by the save-migration and SaveService tests and by [`e2e/saves.spec.ts`](../e2e/saves.spec.ts). |
| Injected clocks | `SaveService`/`ProfileService` tests use a fixed `Date.parse('2026-09-24T12:00:00Z')`, the persistence tests use `{ now: () => 0 }`, and the harness clock steps by 1 s. Nothing depends on the real time. |
| Memory repositories | [`src/infrastructure/persistence/memory-repositories.ts`](../src/infrastructure/persistence/memory-repositories.ts) follow the same contract as IndexedDB (Liskov). UI tests build services with them in [`tests/ui/helpers.tsx`](../tests/ui/helpers.tsx). |

## 5. End-to-end (Playwright)

### Approach

- **It runs the production build.** [`playwright.config.ts`](../playwright.config.ts) starts `npm run build && npx vite preview --port 4391`, so the service worker, the manifest and the lazy chunks are exactly what players get. Locally it reuses a server that is already running; in CI it always builds fresh.
- **It drives only the accessible HTML UI.** The helpers in [`e2e/support.ts`](../e2e/support.ts) use roles and labels ("Go to…", dialogue buttons, puzzle controls), the same controls a keyboard or screen-reader player would use. No test clicks canvas coordinates. This keeps the tests stable, and it proves the game can be finished without steering.
- `setFastSettings` turns on **Instant** dialogue and **Instant travel** to keep runs short. The touch spec leaves Instant travel off, so walking is covered too.
- **Screenshots for visual review:** `E2E_SHOTS=1 npx playwright test e2e/chapter.spec.ts --project=desktop-chromium` writes 12 stage screenshots to `test-results/shots/` (`snap()` in `support.ts`). Without the variable, `snap()` does nothing.
- Settings: 180 s timeout per test (240 s for the chapter), 1 worker, 1 retry in CI only, and a trace and screenshot kept on failure.

### Device projects and matrix

| Spec | desktop-chromium (Desktop Chrome) | mobile-chromium (Pixel 7) | tablet-chromium (820×1180, touch) |
|---|:-:|:-:|:-:|
| [`chapter.spec.ts`](../e2e/chapter.spec.ts): the required 15-step journey | ✓ | — | — |
| [`smoke.spec.ts`](../e2e/smoke.spec.ts): clean start with no console errors and no horizontal overflow; valid manifest and icons; keyboard-only play | ✓ ✓ ✓ | ✓ ✓ *skip* | ✓ ✓ ✓ |
| [`mobile.spec.ts`](../e2e/mobile.spec.ts): touch pad, target size, Go-to, dialogue width | ✓ | ✓ | ✓ |
| [`a11y.spec.ts`](../e2e/a11y.spec.ts): axe WCAG 2.2 AA incl. contrast and high contrast | ✓ | ✓ | — |
| [`pwa.spec.ts`](../e2e/pwa.spec.ts): service worker, then offline relaunch and play | ✓ | — | — |
| [`saves.spec.ts`](../e2e/saves.spec.ts): legacy v1 save migrated and restored; corrupt save reported | ✓ | — | — |
| [`perf.spec.ts`](../e2e/perf.spec.ts): frame rate and DOMContentLoaded (see [performance.md](performance.md)) | ✓ | — | — |
| **Runs** | 9 | 5 (1 skipped) | 4 |

The one skip is intentional. The keyboard-only test calls `test.skip(isMobile, …)` because a phone profile has no physical keyboard. 9 + 4 + 4 = **17 pass**.

### The required 15-step journey ([`e2e/chapter.spec.ts`](../e2e/chapter.spec.ts))

| # | Step | How the spec proves it |
|---|---|---|
| 1 | Create a profile | `createProfile(page, 'Ari')` reaches the *Chapters* heading |
| 2 | Start Chapter 1 | **New game**, the world loads, and the HUD shows "Aunt Miriam's house" |
| 3 | Complete a conversation | The opening dialogue is played to the end through its choices |
| 4 | Receive the main quest | The Quest log contains "Rivka's Remedy" |
| 5 | Receive an item | The Satchel contains "Aunt Miriam's remedy" |
| 6 | Solve a puzzle | *Pack the Satchel*: a first wrong attempt gets water feedback, then "Solved!" |
| 7 | Make a meaningful choice | What you pack is the preparation choice |
| 8 | Observe its consequence | The Satchel has "Bread and dates" but **not** "Spare cloak" (left at home) |
| 9 | Save | Menu → **Save to slot 1** → toast "Game saved." |
| 10 | Reload | `page.reload()` of the whole app |
| 11 | Restore | Profile → *Load a saved game* → **Load Save slot 1** puts you back in Aunt Miriam's house |
| 12 | Continue | The restored Satchel still reflects the choice; you travel on to the road |
| 13 | Complete the chapter | Route deduction, clue sequence, the injured-traveler decision, Jericho, Rivka and Yair, the Scripture Connection (placeholder and "not a quotation" label) and the Reflection |
| 14 | Open the summary | The *Chapter complete: The Road to Jericho* dialog shows the consequence text |
| 15 | View Scripture references | The *Scripture references* heading lists Luke 10:25–37 and Leviticus 19:18. The spec also asserts there is no score, points or holiness language. |

## 6. Required coverage, mapped to tests

| Area | Tests |
|---|---|
| **Quest transitions** | [`quests.test.ts`](../tests/unit/domain/quests.test.ts) (start, stages, outcomes, fail endings, rejected cross-stage completion, determinism); [`session-controllers.test.ts`](../tests/unit/application/session-controllers.test.ts) ("logs and survives invalid quest transitions in content"); [`playthrough.test.ts`](../tests/integration/playthrough.test.ts) |
| **Inventory** | [`inventory.test.ts`](../tests/unit/domain/inventory.test.ts); `giveItem`/`takeItem` in [`effects.test.ts`](../tests/unit/domain/effects.test.ts); packing leaves items at home ([`puzzles.test.ts`](../tests/unit/domain/puzzles.test.ts)); satchel UI ([`game-ui.test.tsx`](../tests/ui/game-ui.test.tsx)); E2E steps 5, 8 and 12 |
| **Dialogue predicates and consequences** | [`conditions.test.ts`](../tests/unit/domain/conditions.test.ts) (every predicate); [`dialogue.test.ts`](../tests/unit/domain/dialogue.test.ts); [`effects.test.ts`](../tests/unit/domain/effects.test.ts); [`session-controllers.test.ts`](../tests/unit/application/session-controllers.test.ts) ("refuses unavailable dialogue choices", "logs dialogue history with choices"); dialogue UI tests |
| **Choices** | "records a choice once" ([`effects.test.ts`](../tests/unit/domain/effects.test.ts)); "classifies the packing into a recorded choice option" ([`puzzles.test.ts`](../tests/unit/domain/puzzles.test.ts)); "offers a real choice at the injured traveler" ([`road-to-jericho.test.ts`](../tests/content/road-to-jericho.test.ts)); four branch playthroughs; summary consequences ([`game-ui.test.tsx`](../tests/ui/game-ui.test.tsx)); E2E steps 7–8 |
| **Journal unlocks** | "auto-unlocks entries when their condition holds" and "groups unlocked entries and counts unseen ones" ([`misc.test.ts`](../tests/unit/domain/misc.test.ts)); "unlocks the start journal entry" ([`quests.test.ts`](../tests/unit/domain/quests.test.ts)); the `journalUnlocked` predicate; journal UI tabs and labels |
| **Schema validation** | Content: "passes schema and referential integrity validation" ([`road-to-jericho.test.ts`](../tests/content/road-to-jericho.test.ts)), plus `npm run content:validate` in CI and before every build. Conditions: "validates with the schema and rejects executable-looking content". Saves: tampered, corrupt and garbage saves ([`save-migrations.test.ts`](../tests/unit/domain/save-migrations.test.ts)). Settings: field-by-field fallback ([`misc.test.ts`](../tests/unit/domain/misc.test.ts), [`services.test.ts`](../tests/unit/application/services.test.ts)). Governance rules ([`governance.test.ts`](../tests/unit/domain/governance.test.ts)). |
| **Save migrations** | [`save-migrations.test.ts`](../tests/unit/domain/save-migrations.test.ts) with the fixtures; "migrates old saves on load and writes back the upgraded form" ([`services.test.ts`](../tests/unit/application/services.test.ts)); [`e2e/saves.spec.ts`](../e2e/saves.spec.ts) in a real browser and real IndexedDB |
| **Profile management** | ProfileService (create, list, rename, remove *with saves*, cap of 8, completion) in [`services.test.ts`](../tests/unit/application/services.test.ts); nickname rules ([`misc.test.ts`](../tests/unit/domain/misc.test.ts)); UI create and remove ([`menus.test.tsx`](../tests/ui/menus.test.tsx)); repositories ([`persistence.test.ts`](../tests/unit/infrastructure/persistence.test.ts)) |
| **Chapter completion** | "completes the chapter once and asks for a save" ([`effects.test.ts`](../tests/unit/domain/effects.test.ts)); Autosaver "…saves immediately on chapter completion" and ProfileService "marks chapters complete once" ([`services.test.ts`](../tests/unit/application/services.test.ts)); all four playthroughs; the summary UI; E2E steps 13–15 |
| **React: menus** | Title screen and chapter select ([`menus.test.tsx`](../tests/ui/menus.test.tsx)) |
| **React: profiles** | "creates a profile…", "lists and removes profiles after confirmation" ([`menus.test.tsx`](../tests/ui/menus.test.tsx)) |
| **React: journal** | "journal uses tabs and labels every block by content kind" ([`game-ui.test.tsx`](../tests/ui/game-ui.test.tsx)) |
| **React: quests** | "quest log states objective status in text, not colour alone" ([`game-ui.test.tsx`](../tests/ui/game-ui.test.tsx)) |
| **React: settings** | Four settings tests ([`menus.test.tsx`](../tests/ui/menus.test.tsx)) |
| **React: accessibility** | `expectNoAxeViolations` in 10 UI tests (contrast and region rules off in jsdom); [`e2e/a11y.spec.ts`](../e2e/a11y.spec.ts) with contrast on; see [accessibility.md](accessibility.md) |
| **React: dialogue** | Three dialogue tests ([`game-ui.test.tsx`](../tests/ui/game-ui.test.tsx)) |

## 7. Feature registry re-verification

[`feature_list.json`](../feature_list.json) holds 28 entries: **24 marked passing** and 4 open (WebKit, approved Scripture translation, editorial approval, GitHub branch protection). Each entry has a runnable `verification` command and a `hermetic` flag.

[`quality-sweep.sh`](../quality-sweep.sh) **re-runs every hermetic entry that claims `passes: true`** (18 today) and fails if any command now fails, so a green flag can't outlive the behaviour it describes. Non-hermetic entries (the E2E suites and the dev-server bootstrap) are verified by `npm run test:e2e` and `bash init.sh`. The sweep also re-runs the architecture tests and content validation, checks the JSON configs, looks for debug artifacts, checks that paths in `AGENTS.md`/`README.md` resolve, scans for secrets, runs knip, and checks the agent guardrails.

## 8. CI order

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request and on pushes to `main`, as job `build-and-test` (the required status check):

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint` (zero warnings)
4. `npm run format:check`
5. `npm run test:unit` (unit, integration, content, architecture)
6. `npm run test:ui`
7. `npm run content:validate`
8. `npm run deadcode` (knip)
9. `npx vite build`
10. `bash quality-sweep.sh`
11. `npx playwright install --with-deps chromium`
12. `npm run test:e2e` (all three device projects)
13. On failure: upload `playwright-report/` for 7 days

The Pages deploy workflow runs its own shorter gate: typecheck, `test:unit`, `test:ui` and build. See [deployment.md](deployment.md).

## 9. How to run

```bash
npm test                     # all Vitest (unit + ui)
npm run test:unit            # node project only
npm run test:ui              # React/jsdom only
npm run test:arch            # architecture rules only
npx playwright install chromium   # once
npm run test:e2e             # all E2E projects (builds, then previews on :4391)
npx playwright test e2e/chapter.spec.ts --project=desktop-chromium
bash quality-sweep.sh        # drift detector, incl. registry re-verification
```

## 10. Gaps

| Gap | Impact | Next step |
|---|---|---|
| **No WebKit/Safari project** (registry: `e2e-webkit-safari`) | iPhone and iPad are untested. | Add a `desktop-webkit` project (and an iPad profile) and run the smoke and chapter specs. |
| **No real devices** | Touch, performance and audio unlock were only emulated. | A manual pass on a mid-range Android phone and an older iPad. |
| **No visual-regression tests** | Layout or art regressions are caught only by eye (`E2E_SHOTS=1`). | Add `toHaveScreenshot` baselines for key screens, per project. |
| **Very old or low-end devices not load-tested** | Frame rate was measured once in headless Chromium with software rendering. | Throttled CPU/network runs and a low-end phone ([performance.md](performance.md)). |
| **Untested code paths** | The gamepad source; the keyboard source except through E2E; sound captions (tests use `SilentAudio`); reduced-motion effects in the Phaser scene; scene announcements; the modal Tab wrap; the service-worker "Update now" flow (registration and offline use are covered by `pwa.spec.ts`). | Unit tests with fakes (`navigator.getGamepads`, `matchMedia`, the audio port) and a UI test for `LiveAnnouncer`. |
| **Real screen readers** | See [accessibility.md](accessibility.md) (G1). | Manual walkthroughs. |

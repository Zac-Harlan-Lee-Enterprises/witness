# Backlog

Covers what has been delivered, what comes next, and user stories with acceptance criteria for *Witness: A Journey Through Scripture*.

**Sources for status:** the code, the test suites, [feature_list.json](../feature_list.json) (24 of 28 entries passing) and [deferred-features.md](deferred-features.md). Nothing is marked Done unless code exists **and** an automated test or a documented run exercises it.

| Status | Meaning |
|---|---|
| ✅ **Done** | Implemented and verified by automated tests (or a recorded measurement) |
| 🟡 **Partial** | Implemented but not fully verified, or blocked on a human step |
| ⬜ **Not started** | No implementation yet |

---

## 1. Delivered: phases 1–6

The repository doesn't record session boundaries: there is no `claude-progress.txt` yet and nothing has been committed. So the grouping below is **reconstructed from the delivered code**. The one explicit trace is the save-format history in [`src/domain/save.ts`](../src/domain/save.ts), where v1 is described as the "Phase-2 engine format". Status is verified against the code as it stands today.

| Phase | Scope | Key deliverables | Status |
|---|---|---|---|
| **1. Foundation and harness** | Project skeleton, layered architecture, guardrails | Vite + React 19 + TypeScript strict. ESLint (strict, jsx-a11y), Prettier, knip. Layer rules as executable tests ([`layers.test.ts`](../tests/architecture/layers.test.ts)). `init.sh`, `agent-status.sh`, `quality-sweep.sh`. Git hooks and a destructive-command guard with a self-test. The `feature_list.json` registry. CI workflow and a manual, main-only Pages deploy. `harden-github.sh`. | ✅ Done. Server-side branch protection still needs a GitHub remote (⬜). |
| **2. Engine core** | World, movement, scenes, first saves | A single Phaser `WorldScene` behind `WorldPort`. ASCII tile maps with a tile catalogue. Collision, focus and pathfinding. Scene transitions, exits and triggers. Keyboard, touch, pointer and gamepad input through `VirtualInput`. v1 save format. | ✅ Done. Gamepad unverified (🟡). |
| **3. Narrative systems** | The declarative story engine | Conditions and effects, the deterministic rules runner, quests (stages, optional objectives, fail and alternate outcomes), branching dialogue, inventory, journal, trust as words, four puzzle types with tiered hints, chapter schema and integrity checks, the chapter summary builder. Save v2 with a v1 → v2 migration. The content-governance model and workflow. The study-guide answer policy (interface only). | ✅ Done |
| **4. Chapter 1 content and research** | *The Road to Jericho* as data | 4 scenes, 12 fictional characters, 23 dialogues (170 nodes), 2 quests, 4 puzzles, 6 choices, 16 clues, 10 items, 36 journal entries, 50 content records, and 33 sources retrieved and checked by an AI research assistant. WEB Luke 10:25–37 stored but disabled. | ✅ Done as an **AI draft**. Human review ⬜. |
| **5. Player experience, accessibility and PWA** | Everything a player touches | Title, profiles, chapter select, HUD, "Go to…", dialogue, puzzle views, satchel, quest log, journal (9 tabs), pause and save slots, settings (text size, fonts, contrast, motion, speeds, instant travel, captions, volumes, key remapping, statistics consent), Scripture Connection, reflection, summary. Procedural art, synthesised audio with captions. Service worker with a safe update prompt. Sub-path deploy. | ✅ Done. Screen-reader and user testing ⬜. |
| **6. Verification, performance and documentation** | Proving it works | 304 Vitest tests (32 files). 23 Playwright tests passing plus 1 intentional skip across desktop, Pixel 7 and 820×1180 tablet Chromium and the dev server. axe WCAG 2.2 AA in jsdom and in a browser. Offline relaunch. Bundle size 153 KB gzip initial (≈377 KB lazy). 34–40 fps headless while walking in the market. The docs set. | ✅ Done for Chromium. WebKit and on-device performance ⬜. |

## 2. Next

Ordered by dependency: human gates first, then platform confidence, then new content.

### Phase 7: Human gates and release readiness

| Item | Owner | Links |
|---|---|---|
| Make the first commit and push to GitHub. Then run `REQUIRED_REVIEWS=0 bash harden-github.sh <owner>/<repo>` (solo maintainer) and limit the `github-pages` environment to `main`. | Maintainer | Registry `github-branch-protection` |
| Editorial review of all 31 educational records (Scripture references, paraphrases, history, reconstruction, interpretation) by a named pastor, teacher or historian. Record the approvals. | Content editors | Registry `content-editorially-approved`; [content-governance.md](content-governance.md) |
| Proofread the stored WEB Luke 10:25–37 against eBible.org, set `approvedForDisplay: true`, and record the approver in the commit | Content editor | Registry `scripture-translation-approved` |
| **Decide what strict content mode means, then implement it.** Today `VITE_CONTENT_MODE=strict` only hides the "Awaiting editorial review" label. Either make strict mode run `content:publish-check` and fail, or hide unapproved records. Add `content:publish-check` to the deploy workflow for public releases. | Developer + product owner | [risks.md R15](risks.md) |
| Sensitivity review of the Samaritan and priest/Levite material, ideally with Jewish and Samaritan-informed reviewers | Content editors | [risks.md R5](risks.md) |

### Phase 8: Device and platform confidence

| Item | Links |
|---|---|
| Add a `desktop-webkit` Playwright project, `npx playwright install webkit`, and run the smoke and full-chapter specs | Registry `e2e-webkit-safari` |
| Play the whole chapter on a real iPad and iPhone (audio unlock, IndexedDB eviction, canvas sizing, Home Screen install) | [deferred-features.md](deferred-features.md) |
| Measure frame rate on a mid-range Android phone and an older iPad | [performance.md](performance.md) |
| Screen-reader walkthroughs (NVDA, VoiceOver, TalkBack), and a small playtest with 10–12-year-olds including dyslexic readers | [accessibility.md](accessibility.md) |
| Try a physical Xbox/PlayStation controller, and add a unit test with a fake `navigator.getGamepads` | — |
| Throttled first-load test and a loading progress indicator | — |
| Automated test of the PWA update flow ("A new version of the game is ready" → Update now) | — |
| Test the private-browsing fallback (memory storage plus a visible warning) | — |

### Phase 9: Fixes and polish found during documentation

| Item | Detail |
|---|---|
| ~~Fix Menashe's greeting on the road~~ | Done (`d01d11e`): `DialogueController.start` chooses the entry node before recording the meeting. Chapter 1's open gaps: [chapters/road-to-jericho.md §14](chapters/road-to-jericho.md#14-known-gaps). |
| ~~"Go to…" feedback~~ | Done: a destination with no path now says "You can't get there from here yet." |
| Satchel capacity after packing | Decide whether items bought or received after packing should be limited, explained or left as is |
| Delete a single save slot | Today saves are removed only with their profile |
| Visual route map in the journal | Today the Maps entry is a text description |
| Check `navigator.storage.persist()` | The result is ignored today. Consider telling players when the browser declines persistent storage. |
| Save and content-version compatibility | `contentVersion` is stored in every save but not checked on load. Define what happens when content ids change between releases. |

### Phase 10: Chapters 2–4 ✅ Built (AI draft)

| Item | Detail |
|---|---|
| Chapters | *A Storm on Galilee*, *A Journey to Bethlehem* and *A Letter from Paul* are playable end to end, as content only, with headless playthroughs of every branch and one e2e spec each ([chapters/](chapters/)) |
| Research | Claim-by-claim source docs in [research/](research/); every educational record awaits human review |
| Art | Every place pre-rendered in 3D, with day, later-day and night light where the story needs it |
| Extract UI strings | Before any second language |

### Later (only when a concrete need justifies it)

Cloud saves and sign-in behind `SyncProvider`/`AuthProvider` ([future-aws.md](future-aws.md)). An approved-source study guide that must pass `checkGuideAnswer`. A real analytics provider (consent-gated, already sanitised). Voice-over, final art and music. Teacher and parent tools. Content-Security-Policy headers at the host.

---

## 3. User stories

Each story has acceptance criteria in Given/When/Then form. "Evidence" names the test or file that proves the status.

### Players

#### US-01 Create a profile without personal details ✅ Done
*As a young player, I want to make a profile with just a nickname and a look, so that my progress is mine without giving away who I am.*
- **Given** the profile screen, **when** I enter a nickname of 1–20 allowed characters and choose one of four looks, **then** a profile is created and listed.
- **Given** an empty or invalid name, **when** I submit, **then** I see a plain-language reason and no profile is created.
- **Given** 8 profiles already exist on the device, **when** I try to add another, **then** I am told to remove one first.

Evidence: `menus.test.tsx` ("creates a profile with a nickname and a look, validating input"), `services.test.ts` ("caps the number of profiles").

#### US-02 Always know where I am and what to do next ✅ Done
*As a player, I want the game to tell me in words where I am, what my next objective is and what time of day it is, so that I never feel lost.*
- **Given** any scene, **when** the HUD is visible, **then** it shows the place name, the next objective and the time of day as text.
- **Given** a quest stage advances, **when** it happens, **then** a "Next step" notice names the new stage.
- **Given** the quest log is open, **then** each objective's status is stated in text, not colour alone.

Evidence: `game-ui.test.tsx` ("shows place, next objective and time of day as text", "quest log states objective status in text").

#### US-03 Weigh advice from different people ✅ Done
*As a player, I want some advice to be more trustworthy than other advice, so that I learn to think about sources.*
- **Given** I talk to Tobiah, **when** he says the wadi is fastest, **then** the clue is recorded as unreliable, and asking whether he has walked it reveals that he hasn't.
- **Given** the route puzzle, **when** I present Tobiah's claim as evidence, **then** the attempt fails with an explanation of why his claim is weak.
- **Given** I have found at least 2 of the 6 road-advice clues, **then** the satchel can be packed.

Evidence: `playthrough.test.ts`, `puzzles.test.ts`, [`puzzles.ts`](../src/content/chapters/road-to-jericho/puzzles.ts).

#### US-04 Pack a satchel that can't hold everything ✅ Done
*As a player, I want to decide what to carry within a weight limit, so that preparation is a real choice.*
- **Given** the satchel (capacity 6), **when** my load is over 6, **then** I'm told it is too heavy.
- **Given** I haven't learned about the ridge cistern, **when** I pack only one water skin, **then** packing fails with a hint about water.
- **Given** I have learned about the cistern, **when** I pack one water skin and the remedy within 6, **then** packing succeeds, unpacked items stay home, and my packing choice is recorded.

Evidence: `playthrough.test.ts` ("rejects a too-light water plan unless the player learned about the cistern"), `chapter.spec.ts` (cloak left at home).

#### US-05 Prove which way is safe ✅ Done
*As a player, I want to choose a route and back it up with evidence, so that the choice is reasoned and not guessed.*
- **Given** the fork, **when** I choose the ridge and present 2 reliable supporting or ruling-out clues, **then** the puzzle is solved and the ridge path opens.
- **Given** I choose the road or the wadi, **then** I get a targeted nudge, and no dangerous route opens.
- **Given** I learned nothing useful in Jerusalem, **then** the four clues at the fork are enough to solve it.

Evidence: `playthrough.test.ts`, `chapter.spec.ts` (solved with Shimon's two clues).

#### US-06 Work out what happened before deciding ✅ Done
*As a player, I want to read the evidence of the robbery and draw a careful conclusion, so that I understand the risk honestly.*
- **Given** I have found 3 of the 6 incident clues, **then** I am offered the chance to think it through.
- **Given** a wrong order, **when** I check it, **then** I am told how many events are in place and given reasoning for the first wrong one.
- **Given** the right order, **when** I pick "They most likely left hours ago — but you can't be completely sure", **then** the puzzle is solved. Overconfident or contradictory conclusions are explained and rejected.

Evidence: `playthrough.test.ts` (`investigate`), `puzzles.test.ts`, `chapter.spec.ts`.

#### US-07 Make a real choice about the injured traveler ✅ Done
*As a player, I want several reasonable options, each with real costs, so that the decision feels like mine.*
- **Given** I have understood the scene, **then** I see at least three options, none labelled good, evil or right.
- **Given** I have no water, **then** the tending options stay visible with the reason "You have no water left to clean his wounds."
- **Given** I didn't ask Malik to keep watch, **then** the caravan option is not offered.
- **Given** any option, **when** I finish the chapter, **then** it completes, and the summary states what happened to Menashe.

Evidence: `road-to-jericho.test.ts` ("offers a real choice…"), four branch playthroughs in `playthrough.test.ts`.

#### US-08 Characters remember how we met 🟡 Partial
*As a player, I want Menashe to greet me according to our history, so that earlier choices feel noticed.*
- **Given** I settled his dispute (trust ≥ 2), **when** I find him on the road, **then** he recognises me as "the one with the measures". ✅
- **Given** I only saw him in the market, **then** he says he knows me from the market. ✅
- **Given** I never spoke to him, **then** he is introduced as a stranger ("You don't have to stop for me…"). ❌ **Not met today:** the meeting is recorded before the entry node is chosen, so the "known" lines always play.

Evidence: headless probe while writing this document. No regression test yet (see Phase 9).

#### US-09 Feel the cost of time without being rushed ✅ Done
*As a player, I want time of day to reflect my choices without a countdown, so that I can take my time and still see consequences.*
- **Given** the chapter, **then** time advances only on travel and decisions, never in real time.
- **Given** I reach Jericho at hour 18 or later without a lamp, **when** I try to go on to Rivka, **then** Salome offers rest, and the remedy is delivered at dawn.
- **Given** I carry a lamp, **then** I can deliver the remedy by lamplight.

Evidence: `playthrough.test.ts` ("long path: … deliver at dawn"), `services.test.ts` ("labels time of day in words").

#### US-10 Learn the real story, clearly labelled ✅ Done
*As a player, I want to see what the Bible passage says and how it connects to my journey, so that I can tell the game's story from Scripture.*
- **Given** Yair retells the story, **then** each retelling line is labelled as a paraphrase with its reference and "not a direct quotation".
- **Given** the Scripture Connection, **then** Scripture, paraphrase, history and interpretation are separate and labelled in words.
- **Given** my choices, **then** the comparisons reflect what I actually did and never grade me.

Evidence: `game-ui.test.tsx` ("labels a character retelling Scripture…", "Scripture Connection separates…"), `chapter.spec.ts`.

#### US-11 Read the verses themselves in the game 🟡 Partial
*As a player, I want to read the passage's actual text, so that I don't need a separate Bible.*
- **Given** no translation is approved, **then** I see the exact placeholder, an invitation to read the passage in my own Bible, and the labelled paraphrase. ✅
- **Given** a human has approved the stored public-domain WEB text, **then** the verse text is shown with the translation name. ⬜ Provider and stored text are ready; the human approval hasn't happened.

Evidence: `scripture.test.ts`; registry `scripture-translation-approved` (failing by design).

#### US-12 Reflect privately and see a summary without grades ✅ Done
*As a player, I want to think about the story and see what my choices led to, without being scored.*
- **Given** the reflection step, **when** I write something (up to 2,000 characters) or skip it, **then** I continue either way, and I'm told it stays on this device.
- **Given** the summary, **then** it lists my journey, choices, consequences, relationships in words, discoveries, themes, Scripture references and history, and contains no score, points or holiness wording.
- **Given** statistics consent is on, **then** my reflection text is never included in anything sent.

Evidence: `game-ui.test.tsx` ("summary … never grades the player"), `services.test.ts` ("never includes the reflection text…"), `chapter.spec.ts`.

#### US-13 Stop and come back later ✅ Done
*As a player, I want my progress saved automatically and in manual slots, so that I can stop anytime.*
- **Given** a scene change, a puzzle solved or the chapter completed, **then** the autosave slot is written (debounced).
- **Given** the pause menu, **when** I choose "Save to slot 1–3", **then** I see "Game saved."
- **Given** I reload the app, **when** I load my save, **then** I resume in the same place with the same inventory.
- **Given** a save from an older format or a corrupt save, **then** the old one is migrated and the corrupt one is reported without crashing.

Evidence: `chapter.spec.ts` (save → reload → restore), `saves.spec.ts`, `save-migrations.test.ts`, `services.test.ts`.

#### US-14 Play with keyboard, touch or pointer ✅ Done
*As a player on any device, I want to play with whatever input I have.*
- **Given** a keyboard only, **then** I can move and talk (E), and remap keys in Settings.
- **Given** a phone or tablet, **then** the on-screen pad, action button and "Go to…" list work.
- **Given** the "Go to…" list, **then** it lists every person, object and exit, and walks me there (or jumps, with instant travel).

Evidence: `smoke.spec.ts` (keyboard-only), `mobile.spec.ts` (touch on phone and tablet), `menus.test.tsx` (remapping), `game-ui.test.tsx` ("Go to…").

#### US-15 Play with a gamepad 🟡 Partial
*As a player, I want to use a controller.*
- **Given** a standard-mapping gamepad, **then** the d-pad or left stick moves, A interacts, Start pauses, Y opens the journal, X the satchel and Select the quest log.
- Implemented in [`gamepad-source.ts`](../src/infrastructure/input/gamepad-source.ts). **Not tried with a physical controller** and not unit-tested with a fake gamepad.

#### US-16 Adjust the game to how I read and see ✅ Done (automated) · 🟡 not tested with assistive technology
*As a player with dyslexia, low vision or motion sensitivity, I want to change fonts, size, contrast and motion.*
- **Given** Settings, **when** I change text size, font (Atkinson Hyperlegible or OpenDyslexic), high contrast or reduced motion, **then** the change applies immediately and persists.
- **Given** automated WCAG 2.2 AA scans (including contrast and high-contrast mode), **then** no violations are reported on menus, settings, dialogue, HUD, journal and quests.
- **Given** a screen reader, **when** I play the whole chapter, **then** everything needed is available as HTML. ⬜ Not yet verified with real assistive technology or users.

Evidence: `menus.test.tsx`, `a11y.spec.ts`, [accessibility.md](accessibility.md).

#### US-17 Play offline ✅ Done (Chromium)
*As a family on a trip, I want the game to work without internet after the first visit.*
- **Given** I visited once online, **when** I relaunch with no network, **then** the title screen loads and a new chapter starts from the cache.

Evidence: `pwa.spec.ts` (desktop Chromium).

#### US-18 Play on an iPad or iPhone ⬜ Not started
*As a family with Apple devices, I want the game to work in Safari and as a Home Screen app.*
- **Given** WebKit, **when** the smoke and full-chapter tests run, **then** they pass.
- **Given** a real iPad, **when** I play the whole chapter, **then** audio, saving, touch controls and layout work.

Evidence: none yet. Registry `e2e-webkit-safari` is failing.

#### US-19 Know when a place can't be reached yet ⬜ Not started
*As a player, I want the "Go to…" list to tell me when somewhere is out of reach, so that I'm not confused when nothing happens.*
- **Given** a destination behind the route blocker or the night blocker, **when** I choose it, **then** I get a short explanation (or it is marked unavailable).

Evidence: today the world scene logs a warning and nothing visible happens ([`world-scene.ts`](../src/game/scenes/world-scene.ts) `travelTo`).

### Parents and teachers

#### US-20 Trust that nothing personal is collected ✅ Done
*As a parent, I want to know the game collects nothing about my child.*
- **Given** a new install, **then** anonymous statistics are off, and Settings explains what they would include.
- **Given** statistics are turned on, **then** only whitelisted events with slug or integer values can be sent, and in production they go to a no-op provider.
- **Given** the source code, **then** game code contains no network calls (enforced by architecture tests).

Evidence: `menus.test.tsx` ("keeps anonymous statistics off by default"), `services.test.ts` (analytics), `layers.test.ts`.

#### US-21 Tell fiction, Scripture, history and interpretation apart ✅ Done
*As a teacher, I want every paragraph labelled by kind, with sources, so that students learn to tell them apart.*
- **Given** the journal or the Scripture Connection, **then** every block shows its kind in words, its confidence where relevant, a "Christians may understand this differently" note where sensitive, and expandable sources.
- **Given** content still under review, **then** preview builds label it "Awaiting editorial review".

Evidence: `game-ui.test.tsx` ("journal uses tabs and labels every block by content kind"), [`ContentBlock.tsx`](../src/features/common/ContentBlock.tsx).

#### US-22 Rely on content reviewed by qualified people ⬜ Not started
*As a Christian-school teacher, I want the historical and theological content checked by named humans before I use it in class.*
- **Given** the chapter, **when** `npm run content:publish-check` runs, **then** it passes because every educational record is approved by a named reviewer.
- Today 0 of 31 educational records are approved, and the check fails by design.

Evidence: registry `content-editorially-approved`.

#### US-23 Share one device among several children ✅ Done
*As a parent, I want each child to have their own progress on one tablet.*
- **Given** several profiles, **then** each profile has its own autosave and three manual slots.
- **Given** I remove a profile after confirming, **then** its saves are removed too.
- **Given** accessibility settings, **then** they apply to the device and are shared by all profiles (by design).

Evidence: `menus.test.tsx` ("lists and removes profiles after confirmation"), `services.test.ts`, `persistence.test.ts`.

#### US-24 Remove one save without removing the profile ⬜ Not started
- **Given** a save slot, **when** I choose delete and confirm, **then** only that slot is removed.

#### US-25 Use the chapter in a lesson ⬜ Not started
*As a youth leader, I want a short guide with discussion questions and printable reflection prompts.*
- **Given** the chapter, **then** a leader's guide lists the themes, the reflection prompts, the Scripture references and suggested discussion, with no answer key that grades faith.

#### US-26 Get updates without losing a session 🟡 Partial
*As a parent, I want updates never to interrupt my child mid-chapter.*
- **Given** a new version is deployed, **then** the new service worker waits, and the title screen offers "Update now". Nothing is swapped mid-game.
- Implemented (`registerType: 'prompt'`, `skipWaiting: false`). **No automated test** of the update flow.

#### US-27 Be warned when progress can't be kept 🟡 Partial
- **Given** a browser that blocks IndexedDB (for example private browsing), **then** the game falls back to memory and shows a visible warning that progress will be lost when the page closes.
- Implemented in [`indexeddb.ts`](../src/infrastructure/persistence/indexeddb.ts). **Not covered by a test.** The result of the persistent-storage request is not surfaced.

### Content editors

#### US-28 Catch content mistakes before players see them ✅ Done
*As a content editor, I want broken references, unreachable objects and rule-breaking records rejected at build time.*
- **Given** a chapter change, **when** `npm run content:validate` or the build runs, **then** schema, referential integrity, reachability from every spawn and per-kind record rules are checked, and failures list every issue.
- **Given** a Scripture record with embedded verse text, a paraphrase without a passage, or a historical claim without a source or confidence level, **then** validation fails.

Evidence: `road-to-jericho.test.ts`, `governance.test.ts`, [`validate-content.ts`](../scripts/validate-content.ts).

#### US-29 Move content through a review workflow with named approval 🟡 Partial
*As an editor, I want each record to move from AI draft to approved only through the required steps, with my name on the approval.*
- **Given** an AI-drafted record, **when** anyone tries to jump straight to approved or published, **then** the transition is refused. ✅
- **Given** approval, **then** a named human reviewer is required. ✅
- **Given** an editor with no coding background, **then** they can review and approve records without editing TypeScript. ⬜ No editor tooling. Approvals are code changes today.

Evidence: `governance.test.ts`, [`content-records.ts`](../src/domain/content-records.ts).

#### US-30 Turn on an approved Bible translation 🟡 Partial
- **Given** the stored WEB passage, **when** an editor proofreads it and sets `approvedForDisplay: true` and records their name, **then** players see the verse text instead of the placeholder.
- The process is documented and the code path is tested. The human step is outstanding.

Evidence: `scripture.test.ts`, [content-governance.md §3](content-governance.md#3-scripture-text).

#### US-31 A strict build that refuses unreviewed content ⬜ Not started
*As a product owner, I want a public release build to be impossible while educational content is unapproved.*
- **Given** `VITE_CONTENT_MODE=strict`, **when** any educational record is unapproved, **then** the build fails, or those records are not shown.
- Today strict mode only removes the review label, and neither the build nor the deploy workflow runs `content:publish-check`.

### Developers

#### US-32 Add Chapter 2 as content only ✅ Done
*As a developer, I want to add a chapter without changing the engine.*
- **Given** a new chapter folder that passes the schema and integrity checks, **when** it is registered in [`src/content/index.ts`](../src/content/index.ts), **then** it appears in chapter select and loads lazily.
- Chapters 2–4 were added this way (plus small additive engine features: weather, tile kinds, carries), proving the guide.

#### US-33 Architecture boundaries can't silently erode ✅ Done
- **Given** a change that imports Phaser outside `src/game`, IndexedDB outside persistence, React outside the UI layers, or adds `fetch`, `eval`, `any` or `console.log` in `src`, **when** tests run, **then** the architecture test fails with what, why and how to fix.

Evidence: `layers.test.ts`, registry `architecture-rules`.

#### US-34 Prove every branch headlessly ✅ Done
- **Given** the real application layer with a fake world, **when** the playthrough tests run, **then** the caravan, hurried, long/dawn and send-help branches each complete the chapter, and the summary contains the expected consequences.

Evidence: `playthrough.test.ts`.

#### US-35 Keep old saves loading ✅ Done
- **Given** saves of every previous schema version, **when** loaded, **then** they are migrated step by step and validated. Future versions and garbage are rejected with player-friendly messages.

Evidence: `save-migrations.test.ts` with fixtures in `tests/fixtures/saves/`, `saves.spec.ts`.

#### US-36 Run E2E on WebKit ⬜ Not started
- **Given** `playwright.config.ts`, **when** a `desktop-webkit` project is added, **then** smoke and full-chapter specs run and pass.

#### US-37 Protect `main` on the server ⬜ Not started
- **Given** the repository on GitHub, **when** `harden-github.sh` has been applied, **then** `main` changes only through PRs with a green `build-and-test` check, and the registry verification passes.

#### US-38 Guard the Menashe greeting with a test ⬜ Not started
- **Given** a player who never spoke to Menashe in the market, **when** they open his conversation on the road, **then** the entry node is `stranger0`. The test fails today and passes after the Phase 9 fix.

---

## 4. Story status at a glance

| Status | Stories |
|---|---|
| ✅ Done (21) | US-01–07, 09, 10, 12–14, 16 (automated), 17, 20, 21, 23, 28, 33–35 |
| 🟡 Partial (8) | US-08, 11, 15, 26, 27, 29, 30, 32 |
| ⬜ Not started (9) | US-18, 19, 22, 24, 25, 31, 36, 37, 38 |

*(US-16 is counted as Done for its automated criteria. Its assistive-technology criterion is tracked in Phase 8.)*

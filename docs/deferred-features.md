# Deferred and incomplete features

An honest inventory of what is **not** done in this vertical slice: what it is, why, the impact, and the recommended next step. Machine-checkable items are also tracked in [../feature_list.json](../feature_list.json) (currently 24 of 28 passing).

## Needs a human decision (cannot be done by an agent)

| Item | Why it's open | Impact today | Next step |
|---|---|---|---|
| **Display of Bible text** | The public-domain WEB text of Luke 10:25–37 is stored verbatim but `approvedForDisplay: false`: governance requires a human proofread. | Players see the required placeholder, a labelled paraphrase, and an invitation to read the passage in their own Bible. | Proofread and enable — steps in [content-governance.md §3](content-governance.md#3-scripture-text). Registry: `scripture-translation-approved`. |
| **Editorial approval of educational content** | All 31 educational records were AI-drafted; research sources were retrieved and checked by an AI research assistant, but **no human has verified citations or approved content**. | Default "preview" builds label them "Awaiting editorial review". `npm run content:publish-check` and `VITE_CONTENT_MODE=strict` builds fail. | A pastor/teacher/historian reviews per [content-governance.md §5](content-governance.md#5-the-editorial-workflow). Registry: `content-editorially-approved`. |
| **GitHub server-side protection** | The repo has no GitHub remote yet. | Local hooks + Claude Code rules protect `main`; nothing server-side yet. | Push to GitHub, then `REQUIRED_REVIEWS=0 bash harden-github.sh <owner>/<repo>` (solo) and limit the `github-pages` environment to `main`. Registry: `github-branch-protection`. |
| **First git commit** | Commits were not requested in this session; the repo is initialised with nothing committed. | No history yet. | See "Committing" in the [README](../README.md#committing-this-work). |

## Not yet verified

| Item | Why | Impact | Next step |
|---|---|---|---|
| **WebKit / iOS & iPadOS Safari** | Only Chromium was installed and tested (desktop, Pixel 7 phone and 820×1180 tablet emulation). | iPhone/iPad are likely targets for families; unknown issues (audio unlock, IndexedDB eviction, canvas sizing) are possible. | Add a `desktop-webkit` project to `playwright.config.ts`, `npx playwright install webkit`, run smoke + chapter specs; test on a real iPad. Registry: `e2e-webkit-safari`. |
| **60 fps on real phones** | Frame rate was measured at 34–40 fps walking in the market in headless Chromium with *software* rendering (no GPU); the world switches to simpler effects automatically if it runs slowly. | Real devices with GPUs should do better, but it is unmeasured. | Measure on a mid-range Android phone and an older iPad; see [performance.md](performance.md). |
| **Assistive-technology testing with people** | Automated axe checks (jsdom + real browser, WCAG 2.2 AA tags incl. contrast) and keyboard/touch E2E pass; no NVDA/JAWS/VoiceOver/TalkBack sessions or testers with disabilities yet. | Automated checks catch perhaps a third of real barriers. | Screen-reader walkthrough of the whole chapter; a small test with young players, including dyslexic readers. |
| **Physical gamepad** | The standard-mapping gamepad source and menu navigation are unit-tested with a simulated `navigator.getGamepads`, but were not tried with a real controller. | Probably works; unverified on hardware. | Try an Xbox/PlayStation controller in Chrome and Safari. |
| **Slow networks** | Offline-after-first-visit is verified; first load over slow 3G is not measured. | The first chapter start downloads ≈377 KB gzip (Phaser + content). | Throttled Playwright run; consider a loading progress bar. |

## Deliberately out of scope for the vertical slice

| Item | Status | Notes |
|---|---|---|
| Chapters 5+ | Chapters 1–4 are playable ([chapters/](chapters/README.md)); no fifth chapter is registered yet | Build it from content — see [chapter-authoring-guide.md](chapter-authoring-guide.md). |
| Cloud saves, accounts, AWS backend | Interfaces only (`SyncProvider`, `AuthProvider` → `LocalOnlySync`, `LocalOnlyAuth`) | [future-aws.md](future-aws.md). No backend until a concrete need justifies it. |
| AI study guide (RAG) | Interface + enforced answer policy only (`StudyGuide`, `checkGuideAnswer`) | No chatbot ships. |
| Analytics provider | Abstraction + consent + sanitiser; `NoopAnalytics` in production | Nothing is ever sent today. |
| Voice-over | A `voice` volume channel exists; no recordings | The game is fully text-based and understandable without audio. |
| Final sound | Background music is recorded (four Pixabay tracks, [ADR-0018](adr/0018-recorded-music.md)); ambience and effects are still WebAudio-synthesised | Commissioned music could replace the tracks through the catalogue in `src/domain/music.ts`, with no engine change. |
| Localisation | English only; UI strings are in components, story text in content | Extract UI strings before a second language. |
| Visual map in the journal | The "Maps" entry is a text route description | An SVG route map is a small, contained addition. |
| Map editor (Tiled) support | Maps are ASCII in TypeScript, validated at build time | Adequate for authors; a Tiled importer could come later. |
| Teacher/parent tools | None (no backend by design) | E.g. printable reflection prompts, a classroom guide. |
| Deleting a single save slot | Saves are removed with their profile; no per-slot delete button | Small UI addition. |
| Content-Security-Policy headers | Not configured (host-level setting) | Recommended values in [security-privacy.md](security-privacy.md). |
| Multiple browser tabs on one profile | Last write wins for the autosave slot | Low risk for the audience; a `BroadcastChannel` lock could prevent it. |

## Known limitations of what *is* built

- **Storage can be evicted.** IndexedDB is requested as persistent (`navigator.storage.persist()`, best effort). Some browsers (notably Safari for sites not added to the Home Screen) may clear data after long inactivity. Installing the PWA reduces this risk.
- **Private browsing** may block IndexedDB; the game then falls back to memory and shows a visible warning that progress won't be kept.
- **Tile maps are fixed-size and hand-authored**; the camera zooms to fit phones, tablets and desktops but the maps are small by design (a chapter is 20–30 minutes; its length comes from people, errands and puzzles, not walking).
- **Time of day is a story counter**, not a clock: it advances with decisions and travel, never in real time (no timing pressure, by accessibility design).

# Witness: A Journey Through Scripture

A story-driven, local-first adventure game set in the world of the Bible, for ages 10 and up — families, Christian schools, Sunday school and youth groups, and curious adults. You play a fictional young person living near events told in Scripture. You explore, talk with people, gather clues, solve puzzles and make choices with real consequences — and you learn about the Bible and its world **because of** what you explore and decide, not from a quiz bolted on top.

**Chapter 1 — The Road to Jericho** (≈20–30 minutes) is complete and playable: carry a remedy from Jerusalem to a sick child in Jericho, down a road with a dangerous reputation; weigh conflicting advice; pack a satchel that can't hold everything; choose a route from evidence; find a robbed traveler and decide what to do with limited water, time and courage; then hear about a story Jesus told on that very road (Luke 10:25–37).

Three more chapters, each about 20–30 minutes, sit beside other passages without rewriting them:

- **Chapter 2 — A Storm on Galilee** (Mark 4:35–41): a fishing family's boat is one of the "other boats" on the lake the evening the storm comes.
- **Chapter 3 — A Journey to Bethlehem** (Luke 2:1–20): a crowded household during the registration hears what the shepherds tell.
- **Chapter 4 — A Letter from Paul** (Philemon; Colossians 4:7–18): a letter carried by hand and read aloud in Colossae.

Every place is pre-rendered in 3D (Blender, `tools/art/`) and composited by Phaser with live weather, water and light; characters have rendered portraits. All educational content in Chapters 2–4 is an AI draft awaiting human review.

> The working title is configurable (`VITE_GAME_TITLE`).

- Runs in desktop and mobile browsers and on tablets; installable as a PWA; **works offline** after the first visit.
- **No backend, no accounts, no ads, no chat.** Progress is saved only on the device.
- **No combat, and no faith/holiness scores.** Choices change your own story — never Scripture.
- Every piece of text is labelled: *Scripture*, *Scripture paraphrase*, *Historical background*, *Historical reconstruction*, *Interpretation*, *Story (fiction)*.

---

## Quick start

Prerequisites: **Node.js 22+** (see `.nvmrc`), npm, git, and macOS/Linux (or WSL) for the shell scripts.

```bash
bash init.sh           # installs dependencies, git hooks, validates content, starts http://localhost:5391
bash init.sh --stop    # stops it
```

Or manually: `npm ci && npm run dev`.

For the browser tests, once: `npx playwright install chromium`.

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` (port 5391) |
| All unit / integration / content / architecture / React tests | `npm test` |
| Just the Node-side suites · just React UI | `npm run test:unit` · `npm run test:ui` |
| Architecture rules | `npm run test:arch` |
| Browser end-to-end (desktop, phone, tablet) | `npm run test:e2e` |
| Screenshots of every chapter stage | `E2E_SHOTS=1 npx playwright test e2e/chapter.spec.ts --project=desktop-chromium` |
| Type-check · lint · format | `npm run typecheck` · `npm run lint` · `npm run format` |
| Validate chapter content | `npm run content:validate` |
| Editorial-readiness report | `npm run content:publish-check` |
| Production build (validates content first) | `npm run build` → `dist/` |
| Preview the production build | `npm run preview` (port 4391) |
| Bundle sizes | `npm run perf:bundle` |
| Dead code | `npm run deadcode` |
| Status / drift check | `bash agent-status.sh` · `bash quality-sweep.sh` |

Current results (all run in this build session): typecheck, lint and format clean; **198** Vitest tests passing; **17** Playwright tests passing (+1 intentionally skipped) across desktop Chromium, a Pixel 7 phone profile and a portrait tablet profile, including the full chapter from a new profile to the summary with save → reload → restore, WCAG 2.2 AA axe scans, offline play and legacy-save migration.

## Architecture in one picture

```
features/ (React UI) ─┐                     ┌─ game/ (Phaser world, lazy-loaded)
                      ├──► application/ ◄───┤
infrastructure/ ──────┘   (session, controllers, ports)   └─ content/ (chapter data)
  (IndexedDB, audio,              │
   analytics, PWA…)               ▼
                               domain/  (pure rules + Zod schemas)
app/ = composition root (wires ports → implementations)
```

- **React** owns menus, dialogue, journal, puzzles, settings and every accessible control. **Phaser** only renders the world, moves the player and handles collisions. They meet through a `WorldPort` interface; neither reaches into the other.
- **Chapters are data**: scenes (ASCII tile maps), dialogue, quests, puzzles, journal and content records, validated by Zod and an integrity checker at build time. Conditions and effects are declarative — content never contains executable code.
- Layer boundaries are **executable tests** (`tests/architecture/layers.test.ts`).

More: [docs/architecture.md](docs/architecture.md) · decisions: [docs/adr/](docs/adr/) · everything for agents: [AGENTS.md](AGENTS.md).

## Deploying (static hosting)

The build is a plain static site (`dist/`) — no server rendering and no client-side routes.

- **GitHub Pages**: `.github/workflows/deploy-pages.yml` deploys automatically once CI passes on `main`, so merging a pull request publishes it (it can also be re-run from the Actions tab). It builds with `VITE_BASE_PATH=/<repo-name>/` so assets, the manifest and the service worker work under the repository sub-path.
- **Amazon S3 + CloudFront / Netlify / Cloudflare Pages**: upload `dist/`; serve `index.html`, `sw.js` and `manifest.webmanifest` with `Cache-Control: no-cache` and hashed `assets/*` as immutable.
- **Sub-path deploys**: set `VITE_BASE_PATH=/your-path/` at build time (verified: assets, icons, manifest scope and service-worker fallback all follow it; world art is generated in code, so there are no asset URLs to break).

Details: [docs/deployment.md](docs/deployment.md).

## PWA behaviour

- Installable (web app manifest with standard and maskable icons).
- The app shell, fonts, the world engine and chapter content are precached, so after one visit the game **starts and plays offline**.
- Updates never interrupt play: a new version waits, and the title screen offers "Update now" (the game autosaves as you play).

## Accessibility

Keyboard (remappable), gamepad, on-screen touch controls, and a **"Go to…" list** that makes the entire game playable without steering or precise pointing (plus optional instant travel). Text size up to 200%, a dyslexia-friendly font option (OpenDyslexic) and an extra-readable one (Atkinson Hyperlegible), high contrast, reduced motion, adjustable or instant dialogue text, captions, pause at any time, no timed challenges, nothing conveyed by colour alone, and every control and piece of information available as real HTML (the game canvas is decorative for screen readers). See [docs/accessibility.md](docs/accessibility.md) — including what has **not** yet been tested.

## Biblical content governance

- The game **never invents Bible verses**. Scripture is stored as references; verse text is shown only from an approved translation. Until an editor approves one, players see `[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Luke 10:25-37]`, a clearly labelled paraphrase, and an invitation to read it in their own Bible. The public-domain World English Bible text is stored and ready — **switched off until a person proofreads it** (see [docs/content-governance.md](docs/content-governance.md#3-scripture-text)).
- Historical notes cite sources that were actually retrieved and state their confidence; uncertainty is written down rather than papered over. Research notes: [docs/research/source-verification.md](docs/research/source-verification.md).
- Educational content was drafted with AI assistance and is labelled **"Awaiting editorial review"** until a named human approves it. AI content never goes straight to players; there is no chatbot.
- All characters are fictional. Jesus does not appear as a character; the player never controls biblical figures.

## Authoring content and chapters

- Content lives in `src/content/chapters/<chapter-id>/` as typed data files. `npm run content:validate` checks schemas, references, reachability of every object from every spawn point, and the governance rules.
- Adding Chapter 2 means adding content (and perhaps a new tile kind), not rewriting dialogue, quests, inventory, saving or the journal. Step by step: [docs/chapter-authoring-guide.md](docs/chapter-authoring-guide.md).

## Asset licensing

All art and audio are **original and generated by code in this repository**. The lower market and its people are **pre-rendered offline** with Blender from procedural scenes built by [`tools/art/`](tools/art/) (`npm run art:market`, `npm run art:people`; Blender is an authoring tool only). Places and people are pre-rendered the same way (with painted fallbacks), and music, ambience and effects are synthesised with WebAudio. There are no third-party image or sound files, and no image-generation model was used. **One approved exception:** the conversation portraits are rendered on MakeHuman's CC0 human model (its mesh and morph targets only; skin, eyes, teeth, hair, clothes, light and expressions are made here), approved by the owner on 2026-09-26 ([ADR-0016](docs/adr/0016-makehuman-base-for-portraits.md), [portraits guide](docs/art/portraits.md)). The origin and licence of every art file are recorded in [`docs/art/asset-manifest.json`](docs/art/asset-manifest.json), and a test enforces it. Fonts are SIL Open Font License (Alegreya, Atkinson Hyperlegible, OpenDyslexic via `@fontsource`). Any future assets must be original or permissively licensed, with the license recorded next to the file; nothing may imitate the look of a commercial game.

## Privacy

No personal information is requested (a nickname and a chosen look). Saves, settings and optional reflections stay in the browser. Anonymous gameplay statistics are off by default and no provider is connected. Reflections are never sent anywhere. See [docs/security-privacy.md](docs/security-privacy.md) and [SECURITY.md](SECURITY.md).

## Known limitations

Summarised from [docs/deferred-features.md](docs/deferred-features.md):

- Bible verse text is off until proofread; educational content awaits human editorial approval.
- Only Chromium has been tested (desktop, phone and tablet emulation) — Safari/WebKit and real devices still need testing; 60 fps on phones is not yet measured on hardware (34–40 fps measured walking in the market, headless with software rendering; slow devices get simpler effects automatically).
- No testing yet with screen-reader users or players with disabilities.
- Placeholder (procedural) art and audio; no voice-over; English only; one chapter.
- Browsers can evict local data after long inactivity; installing the app helps.

## For AI agents and maintainers

This repository is set up as an **AI-agent harness**: [AGENTS.md](AGENTS.md) (entry point, also loaded via `CLAUDE.md`), `init.sh`, `agent-status.sh`, `quality-sweep.sh`, the feature registry `feature_list.json`, `claude-progress.txt` (session handoff), git hooks in `scripts/hooks/`, shared policy in `scripts/lib/policy.sh`, Claude Code guardrails in `.claude/settings.json`, and CI in `.github/workflows/ci.yml`.

### Committing this work

The repository is initialised on `main` with nothing committed yet. After reviewing:

```bash
bash init.sh                       # installs the git hooks
git add -A
git commit -m "Witness: Road to Jericho vertical slice"   # the root commit on main is allowed once
git switch -c feat/next-thing      # every later change goes through a branch + PR
```

After that, pull requests are optional: pushing to `main` is allowed, and CI then decides whether the site deploys.

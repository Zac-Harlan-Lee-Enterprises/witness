# AGENTS.md

> **Read this first.** Single entry point for any AI agent (Claude, Copilot, Cursor…) or new developer working on **Witness: A Journey Through Scripture** — a local-first Christian narrative adventure (React + Phaser 3 + TypeScript PWA). Vertical slice: **Chapter 1, The Road to Jericho**.

---

## ⛔ Mandatory workflow for every change

1. **Every change ships with a test.** New behaviour → new tests. Bug fix → failing regression test first. Content change → `npm run content:validate` + `tests/content`.
2. **Respect the layers** (below). The architecture tests will fail with *what / why / how to fix* — fix the code, not the test.
3. **Run the full suite after every logical change:** `npm run typecheck && npm run lint && npm test`, plus `npm run test:e2e` for anything a player can see.
4. **Restart and check health:** `bash init.sh` must end with `[ ok ] http://localhost:5391/ is healthy`.
5. **Never present fiction as Scripture, never invent verses or citations, never add scores of faith/holiness/favor.** See [docs/content-governance.md](docs/content-governance.md).
6. Log the session in `claude-progress.txt` before you stop.

---

## 🚀 Quick start

```bash
bash init.sh             # install (if needed) + hooks + content check + dev server on :5391
bash agent-status.sh     # where things stand (always exits 0)
bash quality-sweep.sh    # drift detector (non-zero on any finding)
bash init.sh --stop      # stop everything init.sh started
```

If `bash init.sh` fails, fixing it **is** the task.

---

## 🧱 Stack (discovered, not assumed)

| Thing | Value |
|---|---|
| Runtime | Node ≥ 22 (`.nvmrc`), npm (`package-lock.json`) |
| App | React 19, Phaser 3.90 (lazy-loaded), Vite 8, vite-plugin-pwa, Zod 4, idb |
| Tests | Vitest 5 (projects `unit` = node, `ui` = jsdom), React Testing Library, axe-core, Playwright 1.63 (+ @axe-core/playwright) |
| Quality | TypeScript 6 strict, ESLint 9 (typescript-eslint strict, react-hooks, jsx-a11y strict), Prettier, knip |
| Ports | 5391 dev (`init.sh`), 4391 preview (Playwright `webServer`) |
| Backend / DB | **None.** Player data lives in browser IndexedDB (`witness-game`). |

---

## 🗺 Architecture

```
            ┌──────────────────────── app/ (composition root) ────────────────────────┐
            │  services.ts wires ports → implementations · game-runtime.ts · App.tsx   │
            └───────┬───────────────┬──────────────────┬───────────────┬──────────────┘
                    │               │                  │               │
             features/ (React)   game/ (Phaser)   infrastructure/   content/ (data)
                    │               │                  │               │
                    └───────► application/ ◄───────────┘               │
                                    │   (ports, controllers, session)  │
                                    ▼                                  ▼
                                 domain/  (pure rules + Zod schemas) ◄─┘
                                    shared/ ← every layer except domain (event bus, store, logger)
```

**Layer rules — enforced by [tests/architecture/layers.test.ts](tests/architecture/layers.test.ts):**

| Layer | May import | Never |
|---|---|---|
| `src/domain` | domain (+ zod) | anything else |
| `src/shared` | shared | anything else |
| `src/application` | application, domain, shared | React, Phaser, IndexedDB, infrastructure |
| `src/content` | content, domain, shared (+ `import type` from `src/application/ports.ts` only) | engines, UI, storage |
| `src/infrastructure` | infrastructure, application, domain, shared | UI, Phaser |
| `src/game` | game, application, domain, shared | React, features, storage |
| `src/features` | features, application, domain, shared | Phaser, IndexedDB, infrastructure |
| `src/app` | everything | — |

Also enforced (these scan `src/` only, not tests or scripts): `phaser` only in `src/game`; `idb`/`indexedDB`/`localStorage` only in `src/infrastructure/persistence`; React only in `src/features` + `src/app`; `src/game` and chapter folders only via dynamic `import()` (bundle size); no `fetch`/`eval`/`any`/`console.log` in `src`. Each domain event is built only by the modules listed in `EVENT_OWNERS` ([tests/unit/domain/event-owners.test.ts](tests/unit/domain/event-owners.test.ts)). The pre-commit hook also runs prettier on staged files.

Data flow: **Phaser world ⇄ `WorldPort`/`WorldEvent` ⇄ `GameController` ⇄ `GameSession` (domain rules) ⇄ typed `DomainEvent` bus ⇄ `UiStore` ⇄ React.** Details: [docs/architecture.md](docs/architecture.md).

---

## 📁 Key files

| File | Purpose |
|---|---|
| `src/domain/rules.ts` | The deterministic rules runner: effects → quests → journal unlocks |
| `src/domain/conditions.ts`, `src/domain/effects.ts` | Declarative predicates/effects used by all content |
| `src/domain/chapter.ts`, `src/domain/chapter-integrity.ts` | Chapter schema + referential integrity checks |
| `src/domain/save.ts` | Save schema, version, migrations (`CURRENT_SAVE_VERSION`) |
| `src/domain/content-records.ts` | Content kinds, governance workflow, integrity rules |
| `src/application/game-controller.ts` | Boundary between world, story and UI |
| `src/application/ports.ts` | Every interface infrastructure/Phaser implements |
| `src/app/services.ts` | Composition root (the only place concrete classes are chosen) |
| `src/game/scenes/world-scene.ts` | The single Phaser scene (rendering, movement, travel; composites pre-rendered places) |
| `src/game/prerendered/` | Loading and rules for pre-rendered art (manifests, variants, sorting, shade) |
| `tools/art/` | Offline Blender pipeline: procedural market, people, lighting, export ([guide](docs/art/technical-art-guide.md)) |
| `src/content/chapters/road-to-jericho/` | Chapter 1 content (scenes, dialogue, quests, puzzles, records) |
| `src/content/scripture/translations.ts` | Translation registry — **sensitive** (enabling Bible text) |
| `tests/support/harness.ts` | Headless game harness + scripted `Player` for tests |
| `tests/integration/playthrough.test.ts` | Full chapter playthroughs on every branch |
| `e2e/chapter.spec.ts` | Browser end-to-end: new profile → chapter summary |
| `feature_list.json` | Feature registry / work queue with runnable verifications |
| `claude-progress.txt` | Session handoff log |

---

## 🔧 Environment variables (public build-time only — this app has no secrets)

| Var | Purpose |
|---|---|
| `VITE_BASE_PATH` | Deploy under a sub-path, e.g. `/witness/` for GitHub Pages |
| `VITE_GAME_TITLE`, `VITE_GAME_SHORT_TITLE` | Configurable working title |
| `VITE_CONTENT_MODE` | `preview` (default; label unreviewed content) or `strict` |
| `VITE_CAMERA_FRAMING` | `close` (default: used only in places whose art is sharp enough, standard elsewhere) or `standard` everywhere |
| `VITE_ART_LIGHTING` | Review builds only: force pre-rendered places to `day` or `late` light (default follows the story clock) |
| `CI` | Set by CI; relaxes local-only sweep checks (git hooks, branch protection) |

Everything `VITE_*` is compiled into the public bundle — never put a secret in one.

---

## 🛠 Common tasks

| Task | Command |
|---|---|
| Dev server | `bash init.sh` (or `npm run dev`) |
| All Vitest suites | `npm test` |
| Unit/integration/content/architecture | `npm run test:unit` |
| Architecture rules only | `npm run test:arch` |
| React UI tests | `npm run test:ui` |
| Browser E2E (desktop, phone, tablet) | `npm run test:e2e` (first time: `npx playwright install chromium`) |
| Screenshots of every chapter stage | `E2E_SHOTS=1 npx playwright test e2e/chapter.spec.ts --project=desktop-chromium` → `test-results/shots/` |
| Validate chapter content | `npm run content:validate` |
| Editorial readiness report | `npm run content:publish-check` (fails until humans approve) |
| Type-check / lint / format | `npm run typecheck` · `npm run lint` · `npm run format` |
| Production build + sizes | `npm run build` · `npm run perf:bundle` |
| Dead code | `npm run deadcode` |
| Regenerate PWA icons | `npm run icons` |
| Re-export art data after changing characters/maps | `npm run art:data` |
| Re-render the market / people (needs Blender 5.2+, `BLENDER=` to override) | `npm run art:market` · `npm run art:people` |
| Market art captures / performance (review only) | `E2E_SHOTS=1 ART_SHOTS=<set> npx playwright test e2e/market-art.spec.ts --project=desktop-chromium` · `PERF_MARKET=1 PERF_LABEL=<label> npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium` |
| Drift sweep | `bash quality-sweep.sh` |

---

## 🛡 Guardrails

**Sensitive paths (human approval required)** — authoritative list: `SENSITIVE_PATH_PATTERNS` in `scripts/lib/policy.sh`:
`.github/`, `infra/`, `deploy/`, `cdk/`, `terraform/`, `.claude/settings.json`, `scripts/hooks/`, `scripts/lib/`, `CODEOWNERS`, `src/content/scripture/translations.ts`.
Editing them prompts in Claude Code (ask rules); committing them requires a `SECURITY-REVIEW: <approver>` trailer (`scripts/hooks/commit-msg`). **Agents must never add that trailer themselves.**

**Actions** — `.claude/settings.json` denies PR merges/reviews, releases, workflow dispatch, mutating `gh api`, force-push, hard reset, `npm publish`, S3/CloudFront/CDK/Terraform deploys; `git push` always asks. `scripts/hooks/guard-destructive-commands.sh` backs this up (`--self-test` proves it blocks and allows correctly). Deployment (`.github/workflows/deploy-pages.yml`) is automatic when CI passes on `main` (a merged PR), pinned to `main` and to the commit CI tested ([tests/architecture/deploy-workflow.test.ts](tests/architecture/deploy-workflow.test.ts)). Server-side protection: `harden-github.sh` (run by a human after the repo is on GitHub).

**Hooks** (installed by `init.sh`): `pre-commit` (debug artifacts, secrets, JSON, and — path-gated — typecheck, architecture tests, lint, prettier, content validation), `commit-msg` (sensitive-path trailer), `pre-push` (no direct pushes to `main`). Never use `--no-verify`.

**Content integrity** — never invent Bible verses, citations or historical claims; never mark content `approved` (only named humans do); keep Scripture text behind the provider (placeholder by default). See [docs/content-governance.md](docs/content-governance.md).

---

## 📚 Deep docs

| Doc | What |
|---|---|
| [README.md](README.md) | Product overview, setup, deployment |
| [docs/executive-summary.md](docs/executive-summary.md) | Summary + assumptions |
| [docs/game-design.md](docs/game-design.md) | GDD, player journey, quests, dialogue, puzzles |
| [docs/architecture.md](docs/architecture.md) | Architecture, domain model, events, data flow |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
| [docs/content-governance.md](docs/content-governance.md) | Content model, Scripture rules, AI governance |
| [docs/chapter-authoring-guide.md](docs/chapter-authoring-guide.md) | How to add Chapter 2 |
| [docs/save-data.md](docs/save-data.md) | Save schema + migrations |
| [docs/accessibility.md](docs/accessibility.md) | Accessibility plan + status |
| [docs/testing-strategy.md](docs/testing-strategy.md) | What is tested where |
| [docs/security-privacy.md](docs/security-privacy.md) | Privacy, analytics, security |
| [docs/deployment.md](docs/deployment.md) | Local dev, builds, GitHub Pages, S3/CloudFront, PWA |
| [docs/performance.md](docs/performance.md) | Measured sizes and frame rates |
| [docs/backlog.md](docs/backlog.md) | Phased backlog + user stories |
| [docs/risks.md](docs/risks.md) | Risks and mitigations |
| [docs/deferred-features.md](docs/deferred-features.md) | What is incomplete, why, and next steps |
| [docs/future-aws.md](docs/future-aws.md) | Cloud extension points (not implemented) |
| [docs/research/source-verification.md](docs/research/source-verification.md) | Claim-by-claim source research |

---

## SOLID requirements

- **Single responsibility** — rules in `domain`, orchestration in `application`, rendering in `game`, views in `features`.
- **Open/closed** — new puzzle type = schema + checker + view; new chapter = content only.
- **Liskov** — memory and IndexedDB repositories are interchangeable: one contract suite runs against both ([tests/unit/infrastructure/repository-contract.test.ts](tests/unit/infrastructure/repository-contract.test.ts)).
- **Interface segregation** — small ports (`SaveRepository`, `AudioPort`, `WorldPort`…).
- **Dependency inversion** — application depends on ports; `src/app/services.ts` injects implementations. Clocks are injected for deterministic tests.

## Session end

Append to `claude-progress.txt`: date, agent/model, DONE, TESTS (before → after), NEXT (an exact, cold-start-actionable action), BLOCKED.

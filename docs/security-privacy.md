# Security and privacy

How Witness handles player data, what it deliberately does *not* do, how that is enforced, and what is still recommended before a wider launch. For how to report a problem and the secrets policy in brief, see [SECURITY.md](../SECURITY.md).

**In one sentence:** the game is a static website. It has no backend, no accounts, no ads, no chat, no sharing of player-made content and no connected analytics or AI service. Everything a player creates stays in that browser's IndexedDB.

**Data classification: Public.** The repository and the build contain no secrets. If a change would move the project above "Public" (accounts, emails, real names, cloud saves, AI calls with player text), a human has to decide first ([SECURITY.md](../SECURITY.md)).

> This document describes the software's behaviour. It is **not legal advice**. See [§11](#11-recommendations-not-yet-implemented) for the questions that need a lawyer.

---

## 1. Data inventory

Everything is stored in the browser's IndexedDB database `witness-game`, which has three object stores ([`src/infrastructure/persistence/indexeddb.ts`](../src/infrastructure/persistence/indexeddb.ts)). None of it is sent anywhere.

| Data | Contents and limits | Store | How it is removed |
|---|---|---|---|
| **Nickname** | 1–20 characters: letters, numbers, spaces, `.` `'` `-` (`checkDisplayName` in [`src/domain/profile.ts`](../src/domain/profile.ts)). The form says "Use a nickname — no real names needed." | `profiles` | **Remove profile** (with confirmation) |
| **Look** | One of the preset character looks (`look-1`…) | `profiles` | Remove profile |
| **Profile metadata** | Random id, created and last-played timestamps, completed chapter ids | `profiles` | Remove profile |
| **Saves** | Up to 4 per profile (`auto`, `manual-1..3`). Each holds the game state: place, flags, inventory, quests, choices, clues, puzzle progress, up to 400 dialogue-log entries and play time ([`src/domain/state/game-state.ts`](../src/domain/state/game-state.ts)). | `saves` (indexed by profile) | Removing a profile deletes **all** its saves (`ProfileService.remove`: `deleteForProfile`, then the profile). Tested in [`tests/unit/application/services.test.ts`](../tests/unit/application/services.test.ts). There is no per-slot delete yet ([deferred-features.md](deferred-features.md)). |
| **Optional reflection** | Free text written at the end of the chapter, up to 2,000 characters (`MAX_REFLECTION_LENGTH`). Optional, and can be skipped. Stored inside the save's game state and shown in the Journal's *Reflections* tab with the note "saved only on this device and never sent anywhere." | `saves` | Remove profile |
| **Settings** | Accessibility and display preferences, key bindings, volumes and the analytics-consent flag. **One record per device** (key `device`), shared by all profiles ([`src/domain/settings.ts`](../src/domain/settings.ts)). | `settings` | **Reset all settings** overwrites the record with defaults |
| **App files** | The game's own HTML, JS, CSS, fonts and icons, cached by the service worker | Cache Storage | Cleared with site data; outdated caches are cleaned up automatically |
| **Diagnostics log** | Up to 200 in-memory log entries ([`src/shared/logger.ts`](../src/shared/logger.ts)). Echoed to the console only in development. **Never persisted and never sent.** The logger's rule is "Never log player free text." | memory only | Gone when the page closes |

Clearing the browser's site data for the game, or uninstalling the installed app, removes everything. The game asks the browser for persistent storage (`navigator.storage.persist()`, best effort) so saves are less likely to be evicted. If IndexedDB is unavailable, as in some private-browsing modes, the game keeps data in memory only and **shows a visible warning** that progress won't be kept.

## 2. What the game does not do

| Not present | Evidence |
|---|---|
| Accounts, sign-in, passwords | `LocalOnlyAuth` (`mode: 'local-only'`, `currentUserId() → null`) in [`src/infrastructure/sync/local-only.ts`](../src/infrastructure/sync/local-only.ts) |
| Cloud saves or sync | `LocalOnlySync` (`enabled: false`, no-op push, empty pull), same file |
| Ads, chat, multiplayer, sharing or publishing player content | No such features or code |
| Third-party scripts, fonts, CDNs or trackers | Fonts are bundled with `@fontsource`. The production `index.html` loads only same-origin files. A check of the built JS and CSS on 2026-09-24 found no third-party request URLs, only XML namespace strings and library documentation links. |
| Cookies | No `document.cookie` use in `src/` |
| AI chatbot or study guide | `DisabledStudyGuide` (`available: false`, always refuses) in [`src/infrastructure/ai/disabled-study-guide.ts`](../src/infrastructure/ai/disabled-study-guide.ts). A future guide must pass `checkGuideAnswer` ([`src/domain/guide-policy.ts`](../src/domain/guide-policy.ts)) and must never receive journal or reflection text without explicit permission. |
| Raw HTML from data | React escapes all text. The only `innerHTML` is a fixed startup-error message in [`src/app/main.tsx`](../src/app/main.tsx) that contains no data. |

## 3. No network calls from game code

[`tests/architecture/layers.test.ts`](../tests/architecture/layers.test.ts) ("makes no network requests from game code") fails the build if any file in `src/` contains `fetch(`, `XMLHttpRequest`, `navigator.sendBeacon` or `new WebSocket`. Comments and string literals are stripped first, so prose can't trip the rule. A second rule forbids `eval(` and `new Function(`.

The only requests the browser makes are **same-origin** requests for the game's own files: lazy JS chunks, fonts, icons, the manifest, the service-worker precache and the service-worker update checks.

Links in the Journal's **Sources** lists (Wikipedia, eBible.org, Sefaria, New Advent and others) open third-party sites, but **only when a player clicks one**. They open in a new tab with `rel="noopener noreferrer"` ([`src/features/common/ContentBlock.tsx`](../src/features/common/ContentBlock.tsx), the only `<a href>` in the app).

**Limits of the rule:** it covers first-party code in `src/`. It does not scan `node_modules`. Zod 4, a dependency, uses `new Function` for its fast parsing path when the page allows it (see the CSP note in §11). That code is generated from the app's own schema definitions, not from content or player data.

## 4. Analytics

The code is in [`src/application/analytics.ts`](../src/application/analytics.ts) and [`src/infrastructure/analytics/providers.ts`](../src/infrastructure/analytics/providers.ts), and it is wired up in [`src/app/services.ts`](../src/app/services.ts).

| Safeguard | Detail | Test |
|---|---|---|
| **Consent off by default** | `analyticsConsent: false` in `DEFAULT_SETTINGS`. Consent is checked on **every** `track()` call. | "defaults to anonymous analytics OFF" ([`misc.test.ts`](../tests/unit/domain/misc.test.ts)); "sends nothing without consent" ([`services.test.ts`](../tests/unit/application/services.test.ts)); the Settings UI test |
| **Whitelist sanitiser** | Only 8 event names are allowed, each with fixed property keys. Identifiers must be short slugs (`^[a-z0-9][a-z0-9-]{0,63}$`) and numbers must be integers from 0 to 10,000. Unknown keys are dropped. If an allowed field is missing or out of policy, the **whole event is dropped**. Free text such as names, reflections or journal notes can't pass. | "strips anything outside the whitelist and blocks free text" ([`services.test.ts`](../tests/unit/application/services.test.ts)) |
| **No provider in production** | `NoopAnalytics` discards everything. `LogAnalytics`, which records events in the in-memory log, is used **only in development** (`config.isDev`). No network provider exists. | Composition root |
| **Reflection never included** | A full chapter played **with consent on** produces analytics that don't contain the reflection text | "never includes the reflection text even when the whole chapter is played with consent" ([`services.test.ts`](../tests/unit/application/services.test.ts)) |

Allowed events: `ChapterStarted`, `ChapterCompleted` (with play time as a bucket such as `15-25`), `PuzzleAttempted`, `PuzzleCompleted`, `HintRequested`, `AccessibilityFeatureEnabled`, `SaveRestored`, `OptionalQuestCompleted`.

The Settings toggle says in plain words that it is off by default, what would be counted, and that "this version has no statistics service connected, so nothing leaves your device either way."

**Points to review before connecting any provider:**
- `AccessibilityFeatureEnabled` reports which accessibility features were turned on, such as `high-contrast`, `font-dyslexic` or `reduced-motion`. For a children's product, that can suggest something about a player's disability. Decide deliberately whether to keep it.
- Consent is a **device-wide** setting, so one player's choice applies to every profile on a shared device, and a child can change it. How consent should work for this audience is a question for counsel (§11).

## 5. Reflection text stays on the device

- It is stored only in the save's game state in IndexedDB (§1).
- `tests/architecture/layers.test.ts` ("never passes the reflection text to analytics, sync, AI or other infrastructure") fails if `.reflection` appears in any infrastructure or analytics source file.
- The analytics sanitiser can't carry free text, and a test proves the reflection is absent from a full consented playthrough (§4).
- `DisabledStudyGuide` records the rule for any future guide.
- **On shared devices,** anyone who opens that profile can read it (see §9).

## 6. Validation of everything read from storage or content

Storage is never trusted. Every read is parsed with Zod.

| Input | Validation | If invalid | Tests |
|---|---|---|---|
| Saves | `migrateSave` runs versioned migrations, then `SaveGameSchema` ([`src/domain/save.ts`](../src/domain/save.ts), current version 2) | A friendly "could not be read" message. Other saves still list. Saves from a newer version are refused with an explanation. | [`save-migrations.test.ts`](../tests/unit/domain/save-migrations.test.ts), [`services.test.ts`](../tests/unit/application/services.test.ts), [`e2e/saves.spec.ts`](../e2e/saves.spec.ts) |
| Profiles | `PlayerProfileSchema.safeParse` on every list ([`src/application/profile-service.ts`](../src/application/profile-service.ts)) | That profile is skipped and a warning logged | **No dedicated test** |
| Settings | `parseSettings` with field-by-field fallback to defaults; never throws | Bad fields are reset to defaults | [`misc.test.ts`](../tests/unit/domain/misc.test.ts), [`services.test.ts`](../tests/unit/application/services.test.ts) |
| Chapter content | `parseChapter`: `ChapterSchema`, then `validateChapterIntegrity`, **each time a chapter loads** ([`src/content/index.ts`](../src/content/index.ts)). Also at build time: `npm run build` runs `content:validate` first. Conditions and effects are declarative data, never code. | The chapter refuses to start; developers see the issues | [`road-to-jericho.test.ts`](../tests/content/road-to-jericho.test.ts), [`conditions.test.ts`](../tests/unit/domain/conditions.test.ts) |
| Nickname | `checkDisplayName` (above) | Inline error with `aria-invalid` | [`menus.test.tsx`](../tests/ui/menus.test.tsx) |
| Reflection | Cut to 2,000 characters and trimmed (`GameSession.setReflection`); the text box also has `maxLength` | — | **No dedicated test** of the limit |

## 7. Secrets policy

- **There are no secrets.** No backend and no API keys. Everything named `VITE_*` is compiled into the public JavaScript bundle ([`src/app/config.ts`](../src/app/config.ts)), so a secret must never go in one.
- `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials.json`, `.aws/` and `.azure/`.
- **Secret patterns:** `SECRET_RE` in [`scripts/lib/policy.sh`](../scripts/lib/policy.sh) covers AWS access key IDs, Slack tokens, GitHub tokens (classic and fine-grained), PEM private keys, Azure storage account keys, `Password=…;` connection strings, JWTs, `sk-…` API keys and `sk-ant-…` keys.
  - The **pre-commit** hook scans staged files ([`scripts/hooks/pre-commit`](../scripts/hooks/pre-commit)).
  - [`quality-sweep.sh`](../quality-sweep.sh) scans every shippable file (tracked plus untracked-but-not-ignored, except `package-lock.json`). It also **fails on any `VITE_*SECRET|TOKEN|KEY|PASSWORD` name**.
  - A reviewed false positive can be marked `pragma: allowlist-secret`.
- Claude Code deny rules stop agents from reading `.env*`, `*.pem`, `*.key` and `.aws/` ([`.claude/settings.json`](../.claude/settings.json)).
- `harden-github.sh` turns on GitHub secret scanning and push protection where the plan allows.
- If a secret is ever committed, follow [SECURITY.md](../SECURITY.md): rotate first, then clean, then add the pattern to `SECRET_RE`.

## 8. Guardrails for AI agents

The repository is built to be worked on by AI agents, so the guardrails are layered. [`harden-github.sh`](../harden-github.sh) describes them as three layers.

| Layer | What it does |
|---|---|
| **1. Claude Code permissions** ([`.claude/settings.json`](../.claude/settings.json)) | Bypass-permissions mode is disabled. **Ask** (a human must approve): `git push`, `gh pr create`, and edits to `.github/`, `.claude/settings.json`, `scripts/hooks/`, `scripts/lib/`, `CODEOWNERS`, `infra/`/`deploy/`/`cdk/`/`terraform/` and the Scripture translation registry. **Deny:** PR merge and review, releases, workflow run/enable/disable, `gh api` write methods, `gh secret`/`variable set`, repo delete, force-push, `git reset --hard`, `git clean -fdx`, `git filter-branch`, `npm publish`, `aws s3 sync/rm`, CloudFront invalidations, `cdk deploy`, `terraform apply/destroy`, and reading secret files. |
| **2. Guard hook and git hooks** | [`scripts/hooks/guard-destructive-commands.sh`](../scripts/hooks/guard-destructive-commands.sh) is a `PreToolUse` hook that scans the **whole** command string, so chained or wrapped commands can't slip past prefix-based deny rules. `quality-sweep.sh` runs its `--self-test`. The git hooks: **pre-commit** (no commits on protected branches, debug artifacts, conflict markers, secrets, JSON, typecheck, architecture, lint, content), **commit-msg** (a change to a sensitive path needs a `SECURITY-REVIEW: <approver>` trailer, which **agents must never add themselves**) and **pre-push** (blocks pushes to and deletion of protected branches, and non-fast-forward pushes). |
| **3. Server-side** ([`harden-github.sh`](../harden-github.sh)) | Branch protection on `main` with `enforce_admins`, the required check `build-and-test`, required reviews (`REQUIRED_REVIEWS`), `require_last_push_approval`, no force-push or deletion, and resolved conversations. A `github-pages` environment. Auto-merge off. `GITHUB_TOKEN` read-only, and workflows can't approve PRs. Secret scanning and push protection. See [deployment.md](deployment.md#10-server-side-guardrails). |

Sensitive paths are listed in one place, `SENSITIVE_PATH_PATTERNS` in [`scripts/lib/policy.sh`](../scripts/lib/policy.sh). `quality-sweep.sh` checks that every one has a matching Edit rule in `.claude/settings.json`. Deployment is always a human action: the Pages workflow is manual and runs only on `main`, and the S3 and CloudFront commands are denied to agents.

## 9. Classroom and family considerations

- **No personal information is requested.** The only things asked for are a nickname (the form says no real names are needed) and a choice of look. The game never asks for an email, age, birthday, location, photo or voice.
- **Shared devices.** A device can hold up to 8 profiles. Profiles have **no passwords**: anyone using the device can open any profile, continue it, read its journal and reflection, or delete it. Tell players that reflections are private to the *device*, not to the *person*.
- **Deleting a profile** asks for confirmation ("can't be undone") and removes the profile and all its saves, including the reflection. Device settings are shared and are not deleted with a profile. They hold preferences only, no personal information.
- **Settings are per device.** That includes accessibility choices and analytics consent, which is off by default and currently has no effect because no provider is connected.
- **Leaving no trace.** Private browsing, or clearing site data afterwards, leaves nothing behind. In private mode the game warns that progress won't be kept.
- **External links.** "Sources" links go to third-party sites such as Wikipedia, eBible.org and Sefaria. School filters may block some of them, and teachers may want to know about them.
- **Two tabs, one profile:** the last write wins for the autosave ([deferred-features.md](deferred-features.md)).

## 10. Security properties of the build

- A static site with no server code. The attack surface is the hosting configuration and the supply chain of npm dependencies.
- Content is declarative data that is validated at build time and again when it loads. It is never executed.
- The service worker uses `registerType: 'prompt'`. A new version waits until the player chooses **Update now** on the title screen, so a half-updated app never runs mid-chapter ([deployment.md](deployment.md#8-pwa-behaviour)).
- Source maps are generated (`build.sourcemap: true`) and are deployed with `dist/` unless you exclude them. They reveal the original source code, which contains no secrets. Publishing them or not is a deliberate choice.
- **Saved data belongs to an origin.** IndexedDB is shared by every page on the same origin. On GitHub Pages, all project sites of one owner share `https://<owner>.github.io`, so another project page on that account could read the `witness-game` database. For real players, deploy on a dedicated origin: a custom domain, a dedicated organisation, or your own CloudFront distribution ([deployment.md](deployment.md#4-github-pages)).

## 11. Recommendations not yet implemented

| # | Recommendation | Notes |
|---|---|---|
| R1 | **Content-Security-Policy headers at the host** | Not configured anywhere yet. The suggested starting policy below is **untested**. Deploy it as `Content-Security-Policy-Report-Only` first, play the whole chapter (including offline and **Update now**), and only then enforce it. |
| R2 | **Other security headers** | `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer` (source links then send no referrer); `Permissions-Policy: camera=(), microphone=(), geolocation=()` (the game uses none of these; leave gamepad alone); HSTS on a custom domain. |
| R3 | **Subresource Integrity (SRI): not applicable** | Every script and stylesheet is same-origin and deployed together, with no CDN. If a third-party CDN is ever added, use SRI. |
| R4 | **Dependency auditing in CI** | CI has no `npm audit` step, and `init.sh` installs with `--no-audit`. Add `npm audit --omit=dev --audit-level=high` (or Dependabot or Renovate) to CI, and review alerts regularly. |
| R5 | **Pin GitHub Actions to commit SHAs** | Workflows use major-version tags (`actions/checkout@v4` and others). Pinning to SHAs reduces supply-chain risk. The workflows are a sensitive path, so this needs human approval. |
| R6 | **Review `AccessibilityFeatureEnabled` and per-device consent** before connecting any analytics provider (§4). | |
| R7 | **Legal review for children's privacy laws — needs counsel.** | The game targets ages 10+ and may be used in schools and families in several countries. Questions to put to a qualified lawyer, **not answered here**: which children's-privacy and data-protection laws apply in the target countries; whether local-only storage of a nickname and reflections counts as "collection" under them; how consent should work (including a child switching on analytics) if a provider is ever connected; what school or district agreements may require; and what the privacy notice must say. The in-game About dialog has a short privacy summary, but **there is no formal privacy notice yet**. |

**Suggested CSP starting point (R1).** Tested in a browser: [`e2e/csp.spec.ts`](../e2e/csp.spec.ts) plays the opening under exactly this policy (as a response header) and fails on any violation report. Still try it in Report-Only mode on the real host first.

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
worker-src 'self';
manifest-src 'self';
media-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

Why each part:

- **`script-src 'self'`:** the production `index.html` has no inline scripts, because the PWA register is `injectRegister: false` and is imported as a module.
- **`img-src data: blob:`:** a check of the built Phaser chunk found `data:image/…` URIs and `URL.createObjectURL` calls.
- **`style-src 'self'`:** React `style` props and `--text-scale` are applied through the CSSOM, which CSP does not block. Confirm this in Report-Only mode.
- **Zod 4 probe:** Zod 4 would try `new Function("")` to decide whether to JIT-compile parsers, which shows up as a `script-src` violation. [`src/app/zod-config.ts`](../src/app/zod-config.ts) sets `z.config({ jitless: true })` before anything else runs, so it never tries (the CSP test fails without it).
- **Where to set it:**
  - `frame-ancestors` works only as an HTTP header, not in a `<meta>` tag.
  - **GitHub Pages can't set custom headers.** There you can only use a `<meta http-equiv="Content-Security-Policy">` tag, without `frame-ancestors`.
  - On CloudFront, use a *response headers policy*. On Netlify or Cloudflare Pages, use a `_headers` file ([deployment.md](deployment.md)).

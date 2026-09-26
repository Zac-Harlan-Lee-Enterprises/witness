# Deployment

Witness builds to a **plain static website** in `dist/`. It has no server code, no database and no client-side routes: the only page is `index.html`. Any static host that serves HTTPS will work.

Deploying is always a **human** action. The GitHub Pages workflow is started manually and runs only on `main`, and the S3 and CloudFront commands below are denied to AI agents in [`.claude/settings.json`](../.claude/settings.json).

---

## 1. Local development

**Prerequisites:** Node.js **22+** (the version is in [`.nvmrc`](../.nvmrc)), npm, git, and a POSIX shell (macOS, Linux or WSL).

```bash
bash init.sh          # bootstrap + dev server on http://localhost:5391
bash init.sh --stop   # stop everything init.sh started
npm run dev           # or just the Vite dev server (port 5391, --strictPort)
```

What [`init.sh`](../init.sh) does, in order:

1. Checks the Node version. If `.env.local` exists it uses it (public build-time settings only).
2. Stops stale processes that this user owns on its ports.
3. Runs `npm ci` only when the lockfile has changed.
4. Symlinks the git hooks (`pre-commit`, `pre-push`).
5. Warns (without failing) if Playwright's Chromium isn't installed.
6. **Validates chapter content**, and stops if it is invalid.
7. Starts Vite in the background, writing logs to `.logs/dev.log` and PIDs to `.pids/`.
8. Waits for a real HTTP 200 and prints `[ ok ] http://localhost:5391/ is healthy`.

The **service worker is off in development** (`devOptions.enabled: false`, and `registerServiceWorker` returns early in dev). To test offline or update behaviour, use the preview server (§3).

### Build-time environment variables

All of these are **public**: they are compiled into the JavaScript bundle. Never put a secret in a `VITE_*` variable.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_BASE_PATH` | `/` | Serve the game under a sub-path, for example `/witness/` (see §7) |
| `VITE_GAME_TITLE` | `Witness: A Journey Through Scripture` | Title in the UI, the document title and the manifest `name` |
| `VITE_GAME_SHORT_TITLE` | `Witness` | Manifest `short_name` |
| `VITE_CONTENT_MODE` | `preview` | `preview` labels unreviewed content "Awaiting editorial review". `strict` is for release. |

## 2. Production build

```bash
npm run build         # = npm run content:validate && vite build
npm run perf:bundle   # optional: size report (see performance.md)
```

`npm run build` **validates chapter content first** (schemas, references, reachability, governance rules) and fails if anything is wrong. Output:

| Path in `dist/` | What it is | Caching |
|---|---|---|
| `index.html` | The only page | **no-cache** |
| `sw.js` | Service worker (Workbox, generated) | **no-cache** |
| `manifest.webmanifest` | Web app manifest | **no-cache** |
| `workbox-<hash>.js` | Workbox runtime loaded by `sw.js` | no-cache (safe) |
| `assets/*` | Content-hashed JS, CSS and fonts: `index-*.js`, lazy `mount-world-*.js` (Phaser), lazy `road-to-jericho-*.js`, `*.woff2`/`*.woff` | **immutable**, 1 year |
| `icons/*` | App icons (not hashed) | no-cache or a short max-age |
| `**/*.map` | Source maps (`build.sourcemap: true`) | Optional: see [security-privacy.md §10](security-privacy.md#10-security-properties-of-the-build) |

The build targets `es2022`, which means current evergreen browsers.

## 3. Preview the production build

```bash
npm run build && npm run preview   # http://localhost:4391 (--strictPort)
```

This is the same server Playwright uses. The service worker **is** active here, so you can test installing, working offline and updating. Service workers need a secure context. `localhost` counts; a LAN IP over plain `http://` does not, so the game would still run there but without offline support.

## 4. GitHub Pages

The workflow is [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).

| Property | Value |
|---|---|
| Trigger | **Automatic:** when the CI workflow finishes on a push to `main` (a merged pull request) and succeeded (`workflow_run`). Also `workflow_dispatch`, to re-deploy by hand from the Actions tab |
| What is deployed | The exact commit CI tested (`workflow_run.head_sha`), not whatever `main` is by the time the deploy starts |
| Guards | The job runs only if `github.ref` is `main` **and** either it was dispatched by hand, or the CI run succeeded, was a `push`, was on `main`, and came from this repository. That last check matters: a fork's pull request from a branch named `main` also reports `head_branch == 'main'`. A failed or cancelled CI run deploys nothing. Pinned by [`tests/architecture/deploy-workflow.test.ts`](../tests/architecture/deploy-workflow.test.ts) |
| Environment | `github-pages`. Required reviewers are optional: with them, every deploy waits for your approval (§10) |
| Permissions | `contents: read`, `pages: write`, `id-token: write` |
| Concurrency | Group `pages`; a running deploy is never cancelled |
| Steps | `npm ci` → typecheck → `test:unit` → `test:ui` → `npm run build` with **`VITE_BASE_PATH=/<repository-name>/`** → configure-pages → upload `dist/` → deploy-pages |

**One-time setup**

1. Push the repository to GitHub.
2. Enable Pages with **GitHub Actions** as the source: **Settings → Pages → Source → GitHub Actions**, or `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.
3. Optional: run `bash harden-github.sh <owner>/<repo>` (§10) if you want GitHub to require a pull request and a green `build-and-test` for `main`.
4. Merge a pull request. CI runs on `main`, then the deploy. The site is published at `https://<owner>.github.io/<repo>/`. To deploy without a merge, use **Actions → Deploy to GitHub Pages → Run workflow** on `main`.

**Caveats**

- The workflow always builds for `/<repo>/`. For a **user or organisation site** (a repository named `<owner>.github.io`) or a **custom domain**, the site is served from the root, so `VITE_BASE_PATH` must be `/`. Changing this means editing the workflow.
- The deploy workflow doesn't run lint or E2E itself. It deploys only after CI (which runs both) has passed on that commit.
- **Merging is publishing.** Every merge or push to `main` goes live within about 15 minutes (CI, then the deploy). The site is public, so unapproved educational content appears labelled "Awaiting editorial review" (preview mode; see [risks.md](risks.md) R15).
- GitHub Pages **can't set custom response headers**, so you can't configure cache headers or a CSP header there. A `<meta>` CSP is the only option ([security-privacy.md](security-privacy.md#11-recommendations-not-yet-implemented)). Updates still work, because browsers check `sw.js` for a new version without using the HTTP cache by default.
- **Shared origin.** Every project site of one owner is served from the same origin, `https://<owner>.github.io`. IndexedDB belongs to an origin, not a path. Other Pages sites under the same account (including a second copy of this game) can therefore read and write the `witness-game` database. Use a dedicated account or organisation, or a custom domain, for anything beyond testing.
- The uploaded artifact includes source maps.

## 5. Amazon S3 + CloudFront (manual)

There is no infrastructure-as-code for AWS in this repository. The steps below are done by hand by a person with AWS access.

**Distribution setup (once)**

1. **S3 bucket:** private, with *Block Public Access* on. Static website hosting is **not** needed.
2. **CloudFront distribution** with the bucket as its origin, using **Origin Access Control (OAC)**. Update the bucket policy to allow the distribution.
3. **Default root object:** `index.html`.
4. **Viewer protocol policy:** redirect HTTP to HTTPS. Service workers and installing need HTTPS.
5. **Compress objects automatically:** on (gzip/Brotli). The sizes in [performance.md](performance.md) assume compression.
6. **Cache policy:** it must honour the origin's `Cache-Control`. Use a minimum TTL of 0 so `no-cache` files are revalidated, or invalidate them on every deploy (step 4 below).
7. **Custom error responses are not required.** There is no client-side routing, so there are no deep links to fall back from. Offline navigation is handled by the service worker's `navigateFallback`.
8. Optionally, add a **response headers policy** for CSP and other security headers ([security-privacy.md §11](security-privacy.md#11-recommendations-not-yet-implemented)).

**Each deploy**

```bash
npm run build     # VITE_BASE_PATH defaults to "/" for a distribution root

# 1. Hashed files first, so new HTML never points at missing chunks. Cache for a year.
aws s3 sync dist/assets s3://<bucket>/assets \
  --cache-control "public, max-age=31536000, immutable" --exclude "*.map"

# 2. Everything else: always revalidate.
aws s3 sync dist s3://<bucket> --exclude "assets/*" --exclude "*.map" \
  --cache-control "no-cache"

# 3. Make sure the manifest has the right content type.
aws s3 cp dist/manifest.webmanifest s3://<bucket>/manifest.webmanifest \
  --cache-control "no-cache" --content-type "application/manifest+json"

# 4. Drop any edge copies of the unhashed entry points.
aws cloudfront create-invalidation --distribution-id <id> \
  --paths "/" "/index.html" "/sw.js" "/manifest.webmanifest"
```

- **`index.html`, `sw.js` and `manifest.webmanifest` must be `no-cache`.** Otherwise players can be stuck on an old version, or get a new HTML page that points at old chunks.
- **Hashed `assets/*` are immutable.** A new build produces new file names.
- Drop `--exclude "*.map"` if you want to publish source maps.
- **Don't delete old hashed assets straight away** (for example with `--delete` on the first sync). A visitor who loaded the previous `index.html` just before the deploy may still lazy-load the previous Phaser or chapter chunk. Prune old assets a few days later.
- Check that `.woff2` is served as `font/woff2` and `.webmanifest` as `application/manifest+json`.
- **Sub-path on CloudFront** (for example `/witness/`): build with `VITE_BASE_PATH=/witness/` and upload under the `witness/` prefix. CloudFront's default root object applies **only** to the distribution root. Requests for `/witness/` need a CloudFront Function that rewrites paths ending in `/` to `…/index.html`. The manifest's `start_url` is `/witness/`, so installed apps request exactly that path.

## 6. Other static hosts (Netlify, Cloudflare Pages…)

- **Build command:** `npm run build`
- **Output / publish directory:** `dist`
- **Node:** 22. Many hosts read `.nvmrc` or a `NODE_VERSION` variable; check your host's documentation.
- **No redirects or SPA fallback rules are needed.**
- **Headers:** Netlify and Cloudflare Pages both read a `_headers` file in the published directory. To ship one, add `public/_headers` (Vite copies `public/` into `dist/`). For example:

```
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

With a sub-path build, prefix these paths with the base path. Add CSP and other security headers here once they have been tested ([security-privacy.md](security-privacy.md#11-recommendations-not-yet-implemented)).

## 7. Base-path considerations

`VITE_BASE_PATH` is normalised to `/name/`, with a leading and trailing slash (`normalizeBase` in [`vite.config.ts`](../vite.config.ts)). Everything that refers to a URL comes from it.

| Thing | Where the base path is applied | Verified |
|---|---|---|
| Script and style URLs in `index.html` | Vite `base` | ✓ `/witness/assets/…` |
| Favicon and Apple touch icon | Vite rewrites `/icons/…` in `index.html` | ✓ `/witness/icons/icon.svg`, `/witness/icons/apple-touch-icon.png` |
| Manifest link, `id`, `start_url`, `scope` | Vite `base` and the manifest config | ✓ all `/witness/` |
| Manifest icons | Relative `icons/…`, resolved against the manifest URL | ✓ |
| Service-worker registration URL and scope | `virtual:pwa-register` | ✓ `/witness/sw.js` |
| Offline navigation fallback | `navigateFallback: ${base}index.html` | ✓ `/witness/index.html` |
| Precache entries | Relative URLs in `sw.js` | ✓ |
| Lazy chunks (Phaser, chapter) and fonts | Resolved by Vite relative to `base` | ✓ |
| **Game art and audio** | Nothing to fix. Tiles, characters and props are painted in code, portraits are inline SVG, and all audio is synthesised with WebAudio. There are **no asset URLs to break**. | — |

These were checked on 2026-09-24 with a `VITE_BASE_PATH=/witness/` build. They are re-checked continuously by the feature-registry entry `subpath-deployment` in [`feature_list.json`](../feature_list.json), which [`quality-sweep.sh`](../quality-sweep.sh) re-runs. It asserts `/witness/assets/` in `index.html`, `"scope":"/witness/"` in the manifest and `/witness/index.html` in `sw.js`.

If several deployments (for example production and staging) share one origin under different paths, they also share the IndexedDB database `witness-game`, so saves and settings will mix. Give each environment its own origin.

## 8. PWA behaviour

The configuration is `VitePWA({...})` in [`vite.config.ts`](../vite.config.ts), and registration happens in [`src/infrastructure/pwa/register-sw.ts`](../src/infrastructure/pwa/register-sw.ts).

| Setting | Value | Effect |
|---|---|---|
| `registerType` | `'prompt'` | A new version **never replaces the running game by itself**. It waits until the player chooses to update. |
| `injectRegister` | `false` | Registration is imported lazily by the app (`virtual:pwa-register`), is skipped in dev or when service workers aren't supported, and **a failure is harmless**: the game just works online-only. |
| Precache | `**/*.{js,css,html,svg,png,woff2,webmanifest}`, files up to 3 MB | The app shell, the Phaser chunk (≈1.2 MB raw), the chapter, fonts (`woff2` only) and icons. That is 19 files, about 2.1 MB uncompressed and about 0.84 MB gzip-compressed, computed from `dist/` on 2026-09-24. |
| `navigateFallback` | `${base}index.html` | Offline page loads get the app |
| `cleanupOutdatedCaches` | `true` | Old precaches are removed once a new worker takes over |
| `skipWaiting` / `clientsClaim` | `false` / `false` | No automatic takeover |

- **First visit:** the service worker installs and precaches everything in the background, and the title screen then says "The game is ready to play offline."
- **Offline after the first visit** is verified by [`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts). It waits for `navigator.serviceWorker.ready`, reloads under service-worker control, cuts the network, relaunches, creates a profile, starts a new game, and checks that the world (Phaser and chapter content, both from the precache) loads in "Aunt Miriam's house".
- **Updates:** when a new version is waiting, the **title screen** shows "A new version of the game is ready. **Update now**". Clicking it calls `updateSW(true)`, which tells the waiting worker to skip waiting and then reloads the page. The notice never appears mid-chapter, and progress is autosaved as you play. If the player never clicks it, the new version starts once every tab of the old version has been closed, which is normal service-worker behaviour. The "Update now" flow has no automated test.

## 9. Installing on devices

The manifest has `display: standalone`, `orientation: any`, 192 px and 512 px icons, and a maskable 512 px icon. [`e2e/smoke.spec.ts`](../e2e/smoke.spec.ts) checks that the manifest is valid and that every icon URL loads. The game shows **no install button of its own**; installing uses the browser's own UI.

| Platform | How to install | Tested? |
|---|---|---|
| Chrome or Edge on desktop | The install icon in the address bar, or the browser menu's install option | Manifest and offline behaviour checked in Chromium |
| Android (Chrome) | Menu → *Install app* / *Add to Home screen*. Chrome may also offer it by itself. | Emulated Pixel 7 only; no real device |
| iPhone / iPad (Safari) | Share → **Add to Home Screen** | **Not tested**: WebKit isn't in the test matrix yet ([deferred-features.md](deferred-features.md)) |

Installing also lowers the chance that the browser clears saved games after a long gap, especially in Safari.

## 10. Server-side guardrails

[`harden-github.sh`](../harden-github.sh) applies the server-side protections that local hooks can't guarantee. It needs an admin-authenticated `gh` CLI.

```bash
bash harden-github.sh <owner>/<repo> --dry-run      # show what would change
REQUIRED_REVIEWS=0 bash harden-github.sh <owner>/<repo>   # solo maintainer
bash harden-github.sh <owner>/<repo>                 # team: 1 required review (default)
```

- **Preflight:** it refuses to run unless some workflow has a `pull_request` trigger (`ci.yml` has one). Requiring a check that never runs would lock every PR out of merging.
- **Branch protection on `main`:**
  - required check `build-and-test` (strict)
  - `enforce_admins: true`
  - required reviews = `REQUIRED_REVIEWS`
  - `dismiss_stale_reviews` and `require_last_push_approval`
  - no force-pushes or deletions
  - conversation resolution required
- **`REQUIRED_REVIEWS=0` for solo maintainers.** GitHub never lets you approve your own pull request. With admins included in the rules, a solo maintainer who requires 1 review could never merge. With 0, a PR with green CI is still mandatory, so nothing reaches `main` directly.
- **Environment `github-pages`:** the script creates it. Then, **by hand**, in Settings → Environments → `github-pages`: limit deployment branches to `main`. Optionally add a wait timer (it delays each automatic deploy and gives you time to cancel) or required reviewers (then every deploy waits for your approval instead of going out on merge).
- **Repository settings:** auto-merge off; branch deletion after merge; `GITHUB_TOKEN` read-only by default, and workflows can't approve PRs.
- **Secret scanning and push protection:** turned on where the plan allows.
- **Plan note:** the script's own message says that branch protection on *private* repositories needs a paid GitHub plan (Team or Enterprise).

When a GitHub remote exists, [`quality-sweep.sh`](../quality-sweep.sh) checks that `main` is protected with `enforce_admins` on. The registry entry `github-branch-protection` stays open until that has been done.

## 11. Release checklist

1. CI is green on `main` (`build-and-test`).
2. `bash quality-sweep.sh` is clean locally.
3. Decide on `VITE_CONTENT_MODE`: `strict` fails until the content is editorially approved ([content-governance.md](content-governance.md)).
4. Build with the right `VITE_BASE_PATH` for the host.
5. Deploy (a human runs the Pages workflow or the S3 steps).
6. Smoke-check the live site: title screen, new game, then reload offline once the "ready to play offline" notice has appeared.
7. Check the headers: `index.html`, `sw.js` and `manifest.webmanifest` are `no-cache`, and `assets/*` are immutable.

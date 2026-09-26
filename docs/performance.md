# Performance

This page lists **measured results only**. Anything not measured is labelled as such under [Not measured yet](#5-not-measured-yet).

Sizes come from the build of 2026-09-25 with the pre-rendered market (`npm run perf:bundle`); the font and icon breakdown is from 2026-09-24 and unchanged since. The frame rate is from runs of [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) on 2026-09-25, after the art and lighting upgrade.

---

## 1. Download size

From `npm run perf:bundle` ([`scripts/report-bundle.mjs`](../scripts/report-bundle.mjs)). Gzip sizes are computed with Node's zlib at the default level. What a host actually sends depends on its own compression (gzip or Brotli).

| Asset | Raw | Gzip | Loaded |
|---|---:|---:|---|
| `index-*.js`: React UI, application and domain code, Zod | 494.9 KB | 147.6 KB | initial |
| `index-*.css` | 28.9 KB | 6.7 KB | initial |
| **Initial JS + CSS** | **523.8 KB** | **154.3 KB** | first visit |
| `mount-world-*.js`: **Phaser 3 world engine**, the procedural art and the pre-rendered art loader | 1,303.7 KB | **351.6 KB** | lazy, when a chapter starts |
| `road-to-jericho-*.js`: **Chapter 1 content** | 121.3 KB | **36.7 KB** | lazy, when the chapter starts |
| `workbox-window` + `virtual_pwa-register` | 6.8 KB | 2.8 KB | lazy, after start-up |
| **Lazy total** | | **391.1 KB** | |
| **Pre-rendered market art**, morning set (`art/**`, WebP + JSON) | 2,946.8 KB | (already compressed) | when you enter the market; precached |
| Pre-rendered market art, later-day set (`*-late*`) | 2,661.2 KB | (already compressed) | only if the market is shown after 15:00; cached on first use |

**Against the painted build (commit f2018ef, measured the same way):** initial JS + CSS grew by 1.7 KB gzip and the lazy code by 14.0 KB gzip (Zod manifests, the loader, the people painter). The art is the real addition: **2.9 MB** for the morning set, plus 2.6 MB later-day art that the current story never requests. On a phone the market itself needs about 0.3 MB less, because it loads the half-resolution ground (146 KB instead of 461 KB).

**The whole deployable site is ≈ 8.1 MB** (8,278.7 KB) excluding source maps, up from 2.6 MB (2,609.1 KB); the pre-rendered art is 5.5 MB of it. The code and font breakdown (from 2026-09-24, before the art):

| Category | Size (raw) | Share |
|---|---:|---:|
| Phaser chunk (JS) | 1,193.1 KB | 48% |
| Other JS: app, chapter, service worker, Workbox | 607.8 KB | 24% |
| **Fonts** (each family as `.woff2` + `.woff`, Latin, weights 400/700) | 651.8 KB | 26% |
|   of which OpenDyslexic | 487.8 KB | 19% |
|   of which Alegreya | 102.4 KB | 4% |
|   of which Atkinson Hyperlegible | 61.6 KB | 2% |
| Icons | 35.1 KB | 1% |
| HTML, CSS, manifest | 22.2 KB | 1% |

The Phaser engine is the largest single item. Fonts are about a quarter of the site, and **OpenDyslexic is by far the largest font** (about 75% of all font bytes). Browsers download a font only when text uses it. The `.woff` files are fallbacks and are rarely fetched by current browsers.

**Service-worker precache:** 61 files, **5,249 KB** (all JS and CSS, the HTML, the icons, the manifest, the `.woff2` fonts, and the morning set of market art). Of that, 2,338 KB is code, fonts and icons (the painted build precached 25 files, 2,286 KB) and 2,947 KB is art. A first-time visitor downloads this **in the background** after the page is up, so the game can later be played offline. Later-day art is not precached.

## 2. Runtime

| Metric | Result | Conditions |
|---|---|---|
| **Frame rate, walking in the market** | **33.6–40.3 fps** with full effects (six runs, 2026-09-25) | `requestAnimationFrame` callbacks counted over 3 s while holding → in the market (the largest busy scene, with drifting dust and several people), in **headless Chromium with software rendering (no GPU)**, production build served by `vite preview` |
| **DOMContentLoaded** | **60–86 ms** | Same runs, `localhost`, so no network latency |

**The art-direction overhaul ([ADR-0013](adr/0013-art-direction-system.md)), measured like for like.** The pre-overhaul build (commit `2256d22`, run from a worktree) measured 35.2–39.0 fps with full effects; the new build — painted places, passers-by, pigeons, swaying palms, a closer camera — measured 33.6–40.3 fps. That is the same range within run-to-run noise, not a measured improvement. In some runs *both* builds switched to simpler effects, because headless software rendering hovers around the 34 fps threshold; the new build no longer counts the one-off hitch of loading a scene toward that switch (`restartWarmup` in [`quality.ts`](../src/game/systems/quality.ts)). Download size grew by 6.5 KB gzip initially (icon set, title illustration, styles) and by 13.8 KB gzip lazily (the new painters).

**What changed with the first lighting pass (same conditions).** The first version of the new lighting used two full-screen layers (a colour grade and a vignette) and measured **28.8 fps**; hiding both gave **51.6 fps**. Merging them into one multiply layer, redrawn only when the time of day changes, gave **38.3 fps**. Full-screen blending is costly without a GPU and cheap with one.

**Automatic quality.** If the world runs below 34 fps for two 2-second samples in a row (after a 3-second warm-up), it switches to simpler effects for the rest of the session: no drifting dust, birds or water glints, and the light layer only when the light means something (sunset, dusk, night). It logs a warning (shown in *Copy diagnostics*) and marks the canvas `data-effects="reduced"`. The second test in [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) slows the CPU 8× through the DevTools Protocol and checks that the switch happens. The decision is a pure function, [`src/game/systems/quality.ts`](../src/game/systems/quality.ts), with unit tests.

The frame-rate assertion is only a floor (`fps > 20`), because CI runs without a GPU.

A headless, software-rendered frame rate says little about real devices. It is useful only as a regression signal.

## 2a. The pre-rendered market ([ADR-0014](adr/0014-prerendered-places.md))

Measured on 2026-09-25 with [`e2e/market-perf.spec.ts`](../e2e/market-perf.spec.ts):

- **Setup:** headless Chromium with software rendering (no GPU), production build, Apple M3 Pro host, nothing else running.
- **Comparison:** the new build against commit f2018ef (the painted market), run from a worktree.
- **Runs:** two alternating rounds. The ranges below span both.
- **Not real devices:** no real phone or tablet was available, so the phone and tablet rows are viewport sizes in desktop Chromium.

| | Painted market (before) | Pre-rendered market (after) |
|---|---|---|
| Desktop 1280×720, full effects, standing / walking | 41–42 / 40–41 fps | 36–37 / 36–38 fps |
| Desktop, reduced effects (reduced motion) | 55–56 fps | 47–48 fps |
| Tablet 820×1180, full effects | 38–40 fps | 36 fps |
| Phone 412×915 | 60 fps | 60 fps |
| Frames over 33 ms while walking (desktop, full) | 1–6% | 3–4% |
| Chapter start (New game → world visible) | 0.60 s | 0.60–0.65 s |
| House → market transition (desktop) | 0.96–1.00 s | 1.04–1.06 s |
| House → market transition (phone) | 0.34 s | 0.33–0.36 s |
| **Texture memory in the market** | **21 MB** | **94 MB** on desktop and tablet; about 72 MB on phones (half-resolution ground) |

**Reading these numbers:**

- Software rendering exaggerates fill cost. The 10–15% frame-rate drop on desktop comes from drawing larger textures and more layers, and should shrink on a GPU. That's an expectation, not a measurement.
- The real cost is **memory**: about 4.5× the painted market. It breaks down as:

  | Part | Size |
  |---|---|
  | Ground at 3 px per unit | 29 MB |
  | One atlas page of standing things | 12 MB |
  | 12 people (trimmed, packed) plus shadows | about 45 MB |

- Next steps, not done yet:
  - GPU-compressed textures (ASTC/ETC/BC via KTX2) would cut memory 4–8×.
  - Fewer crowd variants would also help.

**Download:** see §1. The art is precached for offline play. The morning set precaches; later-day files are cached the first time they're used.

## 3. How to reproduce

```bash
# Market: pre-rendered vs painted (run the same spec in a worktree of the older commit for "before")
PERF_MARKET=1 PERF_LABEL=after npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
#   → test-results/market-perf/after.jsonl

# Sizes
npm run build && npm run perf:bundle

# Frame rate + DOMContentLoaded (builds and serves on :4391 via Playwright's webServer)
npx playwright install chromium          # once
npx playwright test e2e/perf.spec.ts --project=desktop-chromium
# look for:  [perf] rAF frame rate over 3s: NN.N fps (full effects); DOMContentLoaded: NN ms
```

`perf:bundle` reports sizes but has **no budget thresholds**. It won't fail a build that grows.

## 4. Design choices that keep it light

| Choice | Where | Why |
|---|---|---|
| **Phaser is loaded lazily** as its own chunk, only when a chapter starts | `await import('@/game/phaser/mount-world')` in [`src/app/game-runtime.ts`](../src/app/game-runtime.ts); enforced by the architecture test "keeps Phaser out of the initial bundle" | Menus, profiles and settings load without the ≈317 KB gzip engine |
| **Chapters are lazy data chunks** | `load: () => import('./chapters/road-to-jericho')` in [`src/content/index.ts`](../src/content/index.ts); enforced by "keeps chapter content lazy" | Each chapter downloads only when it is played, so adding chapters doesn't grow the first load |
| **One ground texture per scene** | `buildScene` in [`src/game/scenes/world-scene.ts`](../src/game/scenes/world-scene.ts) | Ground and props are painted **once** into a single canvas texture at 2× resolution (one draw call; ~24 MB for the largest map), plus one small texture per tree top so canopy memory scales with trees, not map size. Only characters, interactive things, tree tops and ambient effects are separate game objects. |
| **Procedural art** | [`src/game/art/`](../src/game/art/) | Tiles, characters and props are painted with Canvas 2D at runtime, and character sheets are cached per appearance. There are **no image files** to download. |
| **No audio files** | [`src/infrastructure/audio/synth-audio.ts`](../src/infrastructure/audio/synth-audio.ts); Phaser `audio: { noAudio: true }` | Music, ambience and effects are synthesised with WebAudio, so there is nothing to download or decode |
| **Low-power rendering hints** | [`src/game/phaser/mount-world.ts`](../src/game/phaser/mount-world.ts) | `powerPreference: 'low-power'`, a 60 fps target with `smoothStep`, `roundPixels`, and Phaser's own keyboard and gamepad plugins turned off |
| **Cheap frame loop** | `update` in [`world-scene.ts`](../src/game/scenes/world-scene.ts); `refreshEntities` in [`src/application/game-controller.ts`](../src/application/game-controller.ts) | Frame delta is capped at 50 ms. Entity lists are rebuilt **only when the story state changes**, not when the player moves, and identical updates are skipped. |
| **Gamepad polling only while a pad is connected** | [`src/infrastructure/input/gamepad-source.ts`](../src/infrastructure/input/gamepad-source.ts) | No idle `requestAnimationFrame` loop |
| **Debounced autosave** | [`src/application/autosaver.ts`](../src/application/autosaver.ts) | A burst of save requests becomes one IndexedDB write |
| **Self-hosted, subset fonts** | [`src/app/main.tsx`](../src/app/main.tsx) (`@fontsource/*/latin-400/700.css`) | Latin subset, two weights each, no third-party font requests |

## 5. Not measured yet

- **60 fps on typical phones has NOT been measured on real devices.** The only figures are from headless, software-rendered Chromium (above). Real devices have GPUs and may do better, but that is an expectation, not a measurement.
- **Slow-network behaviour beyond offline caching has not been measured.** Offline play after the first visit *is* verified ([`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts)). The time to first load and to start a chapter over a slow connection is not. Starting the chapter fetches ≈377 KB gzip of lazy chunks unless the service worker has already cached them.
- Memory use (the largest ground texture is about 24 MB at 2×), battery drain, real low-end devices, WebKit/Safari, and Lighthouse scores. CPU throttling is used only to check that automatic quality switches on.

## 6. Next steps

1. **Measure on hardware:** a mid-range Android phone (Chrome remote debugging, Performance panel) and an older iPad (Safari Web Inspector). Record the results here.
2. **Throttled-network run** for first load and chapter start. If it is slow, add a loading progress indicator.
3. **Size budgets:** make `perf:bundle` fail above agreed limits, for example initial JS+CSS at 160 KB gzip.
4. **Optional trims, after measuring:** a custom Phaser build without unused systems. Caching OpenDyslexic only once it is selected, rather than precaching it, would save about 230 KB of `woff2` for most players but means it isn't available offline until chosen.

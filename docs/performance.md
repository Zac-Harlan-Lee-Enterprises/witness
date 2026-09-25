# Performance

This page lists **measured results only**. Anything not measured is labelled as such under [Not measured yet](#5-not-measured-yet).

Sizes come from the build of 2026-09-25 (`npm run perf:bundle`); the category breakdown and precache figures below are from 2026-09-24. The frame rate is from runs of [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) on 2026-09-25, after the art and lighting upgrade.

---

## 1. Download size

From `npm run perf:bundle` ([`scripts/report-bundle.mjs`](../scripts/report-bundle.mjs)). Gzip sizes are computed with Node's zlib at the default level. What a host actually sends depends on its own compression (gzip or Brotli).

| Asset | Raw | Gzip | Loaded |
|---|---:|---:|---|
| `index-*.js`: React UI, application and domain code, Zod | 472.2 KB | 140.6 KB | initial |
| `index-*.css` | 22.5 KB | 5.5 KB | initial |
| **Initial JS + CSS** | **494.8 KB** | **146.1 KB** | first visit |
| `mount-world-*.js`: **Phaser 3 world engine** and the procedural art | 1,216.0 KB | **324.5 KB** | lazy, when a chapter starts |
| `road-to-jericho-*.js`: **Chapter 1 content** | 119.3 KB | **36.0 KB** | lazy, when the chapter starts |
| `workbox-window` + `virtual_pwa-register` | 6.8 KB | 2.8 KB | lazy, after start-up |
| **Lazy total** | | **363.3 KB** | |

**The whole deployable site is ≈ 2.5 MB** (2,542.6 KB) excluding source maps. By category:

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

**Service-worker precache:** 19 files (all JS and CSS, the HTML, the icons, the manifest and the `.woff2` fonts). That is 2,151 KB uncompressed and about 842 KB gzip-compressed (computed from `dist/` on 2026-09-24). A first-time visitor downloads this **in the background** after the page is up, including the Phaser chunk and all three fonts, so the game can later be played offline.

## 2. Runtime

| Metric | Result | Conditions |
|---|---|---|
| **Frame rate, walking in the market** | **38.3 fps** (full effects) | `requestAnimationFrame` callbacks counted over 3 s while holding → in the market (the largest busy scene, with drifting dust and several people), in **headless Chromium with software rendering (no GPU)**, production build served by `vite preview` |
| **DOMContentLoaded** | **60–86 ms** | Same runs, `localhost`, so no network latency |

**What changed with the art upgrade (same conditions).** The first version of the new lighting used two full-screen layers (a colour grade and a vignette) and measured **28.8 fps**; hiding both gave **51.6 fps**. Merging them into one multiply layer, redrawn only when the time of day changes, gave **38.3 fps**. Full-screen blending is costly without a GPU and cheap with one.

**Automatic quality.** If the world runs below 34 fps for two 2-second samples in a row (after a 3-second warm-up), it switches to simpler effects for the rest of the session: no drifting dust, birds or water glints, and the light layer only when the light means something (sunset, dusk, night). It logs a warning (shown in *Copy diagnostics*) and marks the canvas `data-effects="reduced"`. The second test in [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) slows the CPU 8× through the DevTools Protocol and checks that the switch happens. The decision is a pure function, [`src/game/systems/quality.ts`](../src/game/systems/quality.ts), with unit tests.

The frame-rate assertion is only a floor (`fps > 20`), because CI runs without a GPU.

A headless, software-rendered frame rate says little about real devices. It is useful only as a regression signal.

## 3. How to reproduce

```bash
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
- **Slow-network behaviour beyond offline caching has not been measured.** Offline play after the first visit *is* verified ([`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts)). The time to first load and to start a chapter over a slow connection is not. Starting the chapter fetches ≈363 KB gzip of lazy chunks unless the service worker has already cached them.
- Memory use (the largest ground texture is about 24 MB at 2×), battery drain, real low-end devices, WebKit/Safari, and Lighthouse scores. CPU throttling is used only to check that automatic quality switches on.

## 6. Next steps

1. **Measure on hardware:** a mid-range Android phone (Chrome remote debugging, Performance panel) and an older iPad (Safari Web Inspector). Record the results here.
2. **Throttled-network run** for first load and chapter start. If it is slow, add a loading progress indicator.
3. **Size budgets:** make `perf:bundle` fail above agreed limits, for example initial JS+CSS at 160 KB gzip.
4. **Optional trims, after measuring:** a custom Phaser build without unused systems. Caching OpenDyslexic only once it is selected, rather than precaching it, would save about 230 KB of `woff2` for most players but means it isn't available offline until chosen.

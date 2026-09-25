# Performance

This page lists **measured results only**. Anything not measured is labelled as such under [Not measured yet](#5-not-measured-yet).

The numbers come from the build of 2026-09-24. The sizes were re-checked with `npm run perf:bundle` against the current `dist/` while writing this page. The frame rate and DOMContentLoaded are from that build session's run of [`e2e/perf.spec.ts`](../e2e/perf.spec.ts).

---

## 1. Download size

From `npm run perf:bundle` ([`scripts/report-bundle.mjs`](../scripts/report-bundle.mjs)). Gzip sizes are computed with Node's zlib at the default level. What a host actually sends depends on its own compression (gzip or Brotli).

| Asset | Raw | Gzip | Loaded |
|---|---:|---:|---|
| `index-*.js`: React UI, application and domain code, Zod | 464.7 KB | 138.2 KB | initial |
| `index-*.css` | 20.6 KB | 5.0 KB | initial |
| **Initial JS + CSS** | **485.3 KB** | **143.3 KB** | first visit |
| `mount-world-*.js`: **Phaser 3 world engine** | 1,193.1 KB | **317.1 KB** | lazy, when a chapter starts |
| `road-to-jericho-*.js`: **Chapter 1 content** | 119.0 KB | **35.9 KB** | lazy, when the chapter starts |
| `workbox-window` + `virtual_pwa-register` | 6.8 KB | 2.8 KB | lazy, after start-up |
| **Lazy total** | | **355.8 KB** | |

**The whole deployable site is ≈ 2.5 MB** (2,510.0 KB) excluding source maps. By category:

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
| **Frame rate** | **51.5 fps** | `requestAnimationFrame` callbacks counted over 3 s in **headless Chromium with software rendering (no GPU)**, on the production build served by `vite preview`, with the Phaser world running |
| **DOMContentLoaded** | **56 ms** | Same run, `localhost`, so no network latency |

**What the frame-rate test actually measures.** [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) creates a profile, starts a new game, waits for the world canvas, and then counts frames. At that point the player is in the **opening scene (Aunt Miriam's house)** with the opening conversation on screen, and **not moving**. The test's name and comment say "while walking in the market", but the code neither walks nor visits the market (see [§6](#6-next-steps)). The assertion is only a floor (`fps > 20`), because CI runs without a GPU.

A headless, software-rendered frame rate says little about real devices. It is useful only as a regression signal.

## 3. How to reproduce

```bash
# Sizes
npm run build && npm run perf:bundle

# Frame rate + DOMContentLoaded (builds and serves on :4391 via Playwright's webServer)
npx playwright install chromium          # once
npx playwright test e2e/perf.spec.ts --project=desktop-chromium
# look for:  [perf] rAF frame rate over 3s: NN.N fps; DOMContentLoaded: NN ms
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

- **60 fps on typical phones has NOT been measured on real devices.** The only figure is 51.5 fps in headless, software-rendered Chromium. Real devices have GPUs and may do better, but that is an expectation, not a measurement.
- **Slow-network behaviour beyond offline caching has not been measured.** Offline play after the first visit *is* verified ([`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts)). The time to first load and to start a chapter over a slow connection is not. Starting the chapter fetches ≈356 KB gzip of lazy chunks unless the service worker has already cached them.
- The frame rate **while walking**, and in the busiest scene (the market).
- Memory use, battery drain, CPU-throttled or low-end devices, WebKit/Safari, and Lighthouse scores.

## 6. Next steps

1. **Make `e2e/perf.spec.ts` match its name:** walk through the market (for example, go to the market and hold an arrow key) while counting frames. Add CPU throttling through the Chrome DevTools Protocol for a low-end profile.
2. **Measure on hardware:** a mid-range Android phone (Chrome remote debugging, Performance panel) and an older iPad (Safari Web Inspector). Record the results here.
3. **Throttled-network run** for first load and chapter start. If it is slow, add a loading progress indicator.
4. **Size budgets:** make `perf:bundle` fail above agreed limits, for example initial JS+CSS at 160 KB gzip.
5. **Optional trims, after measuring:** a custom Phaser build without unused systems. Caching OpenDyslexic only once it is selected, rather than precaching it, would save about 230 KB of `woff2` for most players but means it isn't available offline until chosen.

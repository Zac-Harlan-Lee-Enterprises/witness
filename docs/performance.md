# Performance

This page lists **measured results only**. Anything not measured is labelled as such under [Not measured yet](#5-not-measured-yet).

Sizes come from the build of 2026-09-25 with the pre-rendered market (`npm run perf:bundle`); the font and icon breakdown is from 2026-09-24 and unchanged since. The frame rate is from runs of [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) on 2026-09-25, after the art and lighting upgrade. The rendering upgrade (high-DPI, weather, water, post-processing, texture memory) is measured in [§2b](#2b-the-rendering-upgrade-adr-0015), 2026-09-26.

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

**Automatic quality.** If the world runs below 34 fps for two 2-second samples in a row (after a 3-second warm-up), it steps down a level: first post-processing and half the weather particles go (`lite`), then high-DPI rendering (`crisp`, 1×; skipped on 1× screens), then — the last step, as before — simpler effects for the rest of the session: no drifting dust, birds, water glints or cloud shadows, a fifth of the weather, and the light layer only when the light means something (sunset, dusk, night, a storm). Below 24 fps it goes straight to simpler effects. An isolated frame over 250 ms (a screenshot, a tab coming back) is not counted; long frames in a row are. The canvas reports the level as `data-effects` (`full`, `lite`, `reduced`). Players can also choose **Simpler visual effects** in Settings. It logs a warning (shown in *Copy diagnostics*) and marks the canvas `data-effects="reduced"`. The second test in [`e2e/perf.spec.ts`](../e2e/perf.spec.ts) slows the CPU 8× through the DevTools Protocol and checks that the switch happens. The decision is a pure function, [`src/game/systems/quality.ts`](../src/game/systems/quality.ts), with unit tests.

The frame-rate assertion is only a floor: `fps > 20` locally, and `fps > 6` on CI. GitHub's hosted runners render in software on a few vCPUs and measured **10.4–10.8 fps** in the market for both the painted build (main, f2018ef) and the pre-rendered one (2026-09-26, CI runs 36205809697 and 36207544477), so on CI the check only catches the world stalling.

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

## 2b. The rendering upgrade ([ADR-0015](adr/0015-world-rendering-effects.md))

High-DPI rendering, weather, live water, post-processing and the texture-memory work, measured on 2026-09-26 with [`e2e/market-perf.spec.ts`](../e2e/market-perf.spec.ts) against a copy of commit `eb631ae` (the build before), in alternating runs:

- **GPU:** Chromium's new headless mode (`PERF_GPU=1`), which renders on the host's GPU — an Apple M3 Pro through ANGLE and Metal. Closer to what players see than software rendering, but not a phone or tablet GPU.
- **Software:** headless Chromium's SwiftShader, as in §2 and §2a.
- **Load:** other builds and browsers were running on the machine (load average 12–35 during the runs quoted, far higher during earlier runs that were discarded). Software-rendered figures moved by ±30% between identical runs.

**Texture memory in the market** (`gpuMb`: every WebGL texture uploaded and not deleted, including render targets; `data-texture-mb`: what Phaser's texture manager holds, now counted in each texture's GPU format):

| View | Canvas (before → after) | `data-texture-mb` | All GPU textures and render targets |
|---|---|---:|---:|
| Desktop 1280×720 | 1280×720 | 94.4 → **66.4 MB** | 177.6 → **72.5 MB** (−59%) |
| Desktop 1280×720 on a 2× screen | 1280×720 → **2560×1440** | 94.4 → **66.4 MB** | 177.6 → **83.0 MB** |
| Tablet 820×1180 (touch) | 820×1180 | 94.4 → **52.1 MB** | 199.8 → **58.4 MB** (−71%) |
| Phone 412×915 (Pixel 7, 2.625×) | 412×839 → **824×1678** | 72.9 → **52.1 MB** | 95.0 → **58.8 MB** (−38%) |

Where it went (desktop, 1×):

| Before | MB | After |
|---|---:|---|
| Phaser's pre-FX render targets: 66 squares from 32 to 704 px, three screen-sized | ≈ 61 | Disabled (`disablePreFX`). At 2560×1440 they would have been **≈ 420 MB**. |
| Seven more screen-sized targets for bitmap masks, captures and built-in FX | ≈ 25 | Shrunk to 1×1 |
| Painted figures left over from the house | 18.3 | Released when the market is built |
| People's shadow sheets (RGBA) | ≈ 12 | One channel: ≈ 3 |
| Ground (3264×2304) | 28.7 | Unchanged on desktops; RGB 5-6-5 (14.3) on phones, tablets and ≤ 4 GB devices |
| — | — | Post-processing: one screen-sized target and two bloom targets at half the CSS size (5.3 MB at 1×, 15.8 MB at 2×) |

The phone now loads the **full-resolution** ground (it renders at 2×, so it can show it), stored at 16 bits: sharper art for less memory than the old half-resolution ground in RGBA.

**Frame rate, GPU** (rAF over 3 s standing and 2.5 s walking, full effects):

| View | Before | After, clear | After, storm (`VITE_FORCE_WEATHER=storm`) |
|---|---|---|---|
| Desktop 1280×720 | 60 / 60 fps | 60 / 60 | 60 / 60 |
| Desktop on a 2× screen | 60 / 60 (canvas at 1×) | 60 / 60 (canvas at 2×) | 60 / 60 |
| Tablet 820×1180 | 60 / 60 | 60 / 60 | — |
| Phone (Pixel 7 size, 2×) | 60 / 60 (canvas at 1×) | 60 / 60 (canvas at 2×) | 60 / 60 |

All frames under 33 ms (p95 16.8 ms) in these runs. Every row sits at the 60 fps display cap, so they show no regression but not the headroom left. A CPU profile of the storm at 2× on the GPU (580 raindrops, splashes, sheets of rain, cloud shadows, post-processing) spent **about 3% of the main thread in JavaScript** (100 ms of 3.2 s); the rest was idle.

**Frame rate, software rendering** (SwiftShader; ranges over two to three runs each, standing / walking):

| View | Before | After |
|---|---|---|
| Desktop 1280×720, full effects | 26–30 / 18–28 fps | 16–31 / 17–34 fps |
| Tablet 820×1180, full effects | 24–28 / 27–31 fps | 24–33 / 20–34 fps |
| Phone, full effects | 45–55 / 45–55 fps | 34–60 / 49–60 fps |
| Desktop, storm | — | 18–19 / 12–13 fps, then simpler effects (24.5 fps) |
| Phone, storm | — | 29–43 / 30–42 fps |

Within run-to-run noise of the old build. Without a GPU the world now starts at the `lite` level at 1× (no post-processing or rain sheets, half the weather), and on desktop and tablet sizes both builds step down to simpler effects within a few seconds under this load. A storm costs fill rate in software (the light layer, cloud shadows and several hundred drops, all drawn by the CPU); automatic quality takes it back to about the clear-weather rate.


**Download:** the lazily loaded world-engine chunk grows by **14.5 KB gzip** (351.7 → 366.2 KB) and the initial JS by 0.2 KB (the new setting). There are no new files: weather and water textures are painted at start-up, and the shaders are part of the code.

(The phone's full-resolution ground described above was superseded by §2c: phones now load the half-resolution set, people included.)

## 2c. Phones: half-resolution places and people

Measured on 2026-09-26. **Before:** a phone loaded about the same textures as a desktop. The half-resolution set was chosen by zoom alone (`wantsLowResolution`), and the high-DPI canvas makes a phone's zoom as high as a desktop's (3.5 canvas pixels per unit on a Pixel 7), so phones always took the full set; people sheets had no half-resolution version at all. **After:** phones (a touch screen under 600 CSS px on its shorter side) and devices reporting ≤ 2 GB of memory load the half-resolution place set **and** half-resolution people sheets (1.5 px per unit, made from the full sheets by [`downsample_people.py`](../tools/art/downsample_people.py)); desktops and tablets load the full art as before. See [technical-art-guide §2](art/technical-art-guide.md#2-resolution-and-pixels-per-world-unit).

- **Setup:** the review capture specs (`place-art`, `storm-art`, `bethlehem-art`, `letter-art`, `-g phone`): the Pixel 7 viewport (412 × 839 CSS px, 2.625×, touch, mobile), headless Chromium drawing with the Mac's GPU (Metal), production builds. Before is commit `d37dac5`, after is this change, each played through the same routes.
- **Measure:** `data-texture-mb`, what Phaser's texture manager holds in each texture's GPU format (the ground at 16 bits on phones, shadow sheets at 8), one place in memory at a time. Where a place is seen on two routes, the range spans both.

| Place | Light | Phone, before | Phone, after | Change |
|---|---|---:|---:|---:|
| Aunt Miriam's house | morning | 14.6–14.7 MB | **5.7–5.8 MB** | −61% |
| Lower market | morning | 62.2 MB | **21.2 MB** | −66% |
| Road down to Jericho | morning | 46.8 MB | **16.3 MB** | −65% |
| Jericho | morning | 62.9 MB | **20.8 MB** | −67% |
|  | later day | 70.0 MB | **25.1 MB** | −64% |
| Grandmother Shelomit's house (Ch. 2) | later day | 14.8 MB | **6.0 MB** | −59% |
|  | lamplight | 13.1 MB | **5.3 MB** | −60% |
| The shore at Capernaum (Ch. 2) | later day | 81.0 MB | **30.1 MB** | −63% |
|  | night | 72.6–75.4 MB | **24.5–25.6 MB** | −66% |
| The open lake (Ch. 2) | night | 62.3 MB | **20.6 MB** | −67% |
| Tamar's house (Ch. 3) | by day | 23.9 MB | **8.3 MB** | −65% |
|  | at night | 30.0 MB | **10.8 MB** | −64% |
| The lanes of Bethlehem (Ch. 3) | later day | 74.9 MB | **26.5 MB** | −65% |
|  | night | 64.2 MB | **21.0 MB** | −67% |
| The fold below Bethlehem (Ch. 3) | later day | 53.9 MB | **18.6 MB** | −65% |
|  | night | 53.1 MB | **17.8 MB** | −66% |
| Ammia's dye workshop (Ch. 4) | morning | 17.3–17.4 MB | **6.5–6.6 MB** | −62% |
| A street in Colossae (Ch. 4) | morning | 61.6–62.7 MB | **20.3–20.7 MB** | −67% |
|  | later day | 66.1 MB | **23.8 MB** | −64% |
| The Laodicea road (Ch. 4) | rain cloud | 80.0 MB | **24.7 MB** | −69% |
| Philemon's house (Ch. 4) | lamp-lighting | 31.0–32.3 MB | **11.0–11.4 MB** | −65% |

A phone now holds **31–41%** of the textures it did: 5–30 MB a place instead of 13–81 MB. (Earlier review captures quoted higher figures for the phone, up to 125 MB at the shore, from earlier builds; the before column here was measured on the same machine and routes as the after, so the two compare like for like.)

**All GPU textures** (the market on the GPU, `PERF_GPU=1` in [`market-perf.spec.ts`](../e2e/market-perf.spec.ts): every WebGL texture uploaded and not deleted, render targets included):

| View | `data-texture-mb`, before → after | All GPU textures, before → after |
|---|---:|---:|
| Desktop 1280×720 | 76.6 → 76.6 MB | 76.8 → 84.1 MB (the before run had dropped to `lite` effects: no post-processing targets) |
| Tablet 820×1180 (touch) | 62.2 → 62.2 MB | 70.0 → 70.0 MB |
| Phone (Pixel 7, 2×) | 62.2 → **21.2 MB** | 70.4 → **29.4 MB** (−58%) |

**Where the phone's memory went** (the lanes of Bethlehem in the late sun, from the sizes of the files loaded): ground 16.1 → 4.0 MB (RGB 5-6-5 either way), sprite pages 24.5 → 6.1 MB, people 26.4 → 6.6 MB. Their cast shadows (6.4 MB at one byte a pixel) are kept at full size: halving them would save little, and a phone would magnify each shadow texel to about nine device pixels.

**The look** (captures at the phone's device pixels, before and after, in the review sets): at arm's length the scenes read the same. Side by side at 100% the half-resolution art is softer: the grit of the ground and fine sprite detail (flowers, a mosaic's dots) blur a little, and faces and the stripes of robes are softer; the most visible loss was the fine mesh of the nets drying on the shore at Capernaum, which blurred into a mottled weave (much of this softness came from how the half set was made: see "A sharper half set" below). Nothing is lost that the story needs (marks, carried things, who is who). At a 3× phone's device pixels (a 2× canvas scaled 1.5 by the browser) a full-size person is itself magnified 1.75×; an intermediate size (2 px per unit) was compared and is barely sharper there, for 78% more memory than 1.5.

**Download:** the half-resolution people are 306 files, 7.6 MB (the full colour sheets: 12.4 MB); a phone downloads them instead of the full ones for every person it meets. `people.json` grows from 1.39 to 2.32 MB (85 → 141 KB gzip) with their frame tables. The service worker precaches the morning and indoor ones too, as it does both resolutions of the places' morning sets: the precache grows from 356 files, 17.3 MB, to 458 files, 20.7 MB (`npm run build`).

## 2d. People on MakeHuman bodies ([ADR-0017](adr/0017-makehuman-bodies-for-world-figures.md))

Measured on 2026-10-01. **Before:** the procedural mannequins (`people.py`), commit `c843e5c`. **After:** every sheet rendered again on MakeHuman bodies with simulated clothes. The sheet contract is unchanged: the same 110 entries, frame sizes, lights and files. Only what each frame covers changes.

**Files** (every entry in `people.json`; texture memory as the GPU holds them: colour sheets RGBA, shadow sheets one byte a pixel):

| Set | Files | Download, before → after | Texture memory, before → after |
|---|---:|---:|---:|
| Full colour sheets and overlays (desktops, tablets) | 306 | 12.97 → **13.03 MB** | 277.0 → **259.9 MB** (−6%) |
| Half-resolution copies (`-low`: phones, low memory) | 306 | 8.01 → **7.99 MB** | 70.0 → **64.6 MB** (−8%) |
| Cast-shadow sheets (shared by both) | 177 | 0.86 → **0.85 MB** | 49.6 → **49.3 MB** |
| `people.json` | 1 | 2.33 → 2.33 MB | — |

The download is the same within 0.5%. Real bodies are narrower than the mannequins' tubes, so the trimmed frames pack into slightly smaller atlases: 6–8% less texture memory for the same frames.

**In the game** (`data-texture-mb`, the review captures of [`e2e/people-art.spec.ts`](../e2e/people-art.spec.ts) on the Mac's GPU: Miriam's house and the market, the same route before and after):

| View | Aunt Miriam's house | Lower market |
|---|---:|---:|
| Desktop 1280×720 (full set) | 18.0 → **17.0 MB** | 77.4 → **76.6 MB** |
| Phone, Pixel 7 (half-resolution set) | 6.0 → **5.9 MB** | 22.0 → **21.4 MB** |

Phones keep the gains of §2c. Nothing costs more memory at runtime: a person is still one trimmed atlas page per light, plus the overlays their marks need.

**Build time** (authoring only): a standing sheet takes about a minute of cloth simulation before its frames; all 110 sheets take about 3 hours of rendering on an M3 Pro.

**The people fill and the new outer garments** (2026-10-01, every sheet rendered again, Eli's and Hodaya's for the first time on MakeHuman bodies; 112 entries; download in MB, texture memory in MiB as the GPU holds them):

| Set | Files | Download, before → after | Texture memory, before → after |
|---|---:|---:|---:|
| Full colour sheets and overlays | 310 | 13.24 → **14.10 MB** (+6.5%) | 251.2 → **251.3 MiB** |
| Half-resolution copies (`-low`) | 310 | 8.11 → **8.55 MB** (+5.4%) | 62.7 → **62.7 MiB** |
| Cast-shadow sheets | 181 | 0.87 → **0.87 MB** | 48.2 → **49.3 MiB** |
| `people.json` | 1 | 2.35 → 2.35 MB | — |

Faces, hands and the shaded side of the clothes now carry detail that the dark had hidden, and detail costs WebP bits: the download grows by 0.9 MB (full) and 0.4 MB (half). Frames cover the same area, so memory is unchanged; the longer cloak and mantle widen a few shadow frames. In the game (`data-texture-mb`, the same review route): the house 17.0 → 17.0 MB, the market 76.6 → 76.8 MB, the road 72.7 → 72.8 MB, the shore 103.5 → 103.9 MB on a desktop; 5.9 → 5.8, 21.4 → 21.5, 16.7 → 16.7 and 31.8 → 32.1 MB on a phone. Rendering every sheet took about 1 h 40 min (M3 Pro), three sheets to a Blender run.

### A sharper half set (2026-09-30)

The softness above came as much from how the half set was made as from its size: each 2 × 2 block of the full set was averaged (a box filter, which blurs detail near the new pixel size) and saved at WebP 84 (the ground) and 86 (sprite pages), which smoothed away much of what was left. Options weighed:

| Option | Phone texture memory | Download | Look |
|---|---|---|---|
| The full ground on phones at RGB 5-6-5 | +12–19 MB a place | the ground about 2.5 times the sharp half ground below | Sharp ground; the sprites and nets still soft |
| The same half set re-saved at WebP 92 | unchanged | ground +65–80% | Fewer compression smudges; still box-blurred |
| **Halved with a Lanczos-3 filter and a light unsharp mask, WebP 88** (chosen) | **unchanged** | **ground +36–56%, whole half set +27%** | Grit, pebbles and grass blades crisp; the nets' diamond mesh visible again |
| The same at WebP 92 | unchanged | ground +85–115% | Barely different from 88 |

The chosen half set (`imageio.downsample_sharp`: the colour filtered in premultiplied space, the alpha box-filtered so edges never ring, the colour kept within its alpha) is made by `build_place.py` and was remade for every place from its full set with `upgrade_place.py --sharpen-low`. The textures keep their sizes and formats, so `data-texture-mb` is exactly as in the table above. Download: every place's half set in every light, ground and sprite pages, grew from 9.05 to 11.45 MB (+2.4 MB); a phone loads one place and light at a time, 50 KB to 1.6 MB each (the Laodicea road the most, its ground 3 tiles). Crops of the nets and the ground at Capernaum, before and after, are in the art-polish review captures. (Separately, the open lake's story sails now carry their moon shadow, which made its sprite pages taller: 20.6 → 21.2 MB on a phone.)

## 3. How to reproduce

```bash
# Market: pre-rendered vs painted (run the same spec in a worktree of the older commit for "before")
PERF_MARKET=1 PERF_LABEL=after npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
#   → test-results/market-perf/after.jsonl
# The same on the machine's GPU (Chromium's new headless mode), and in a forced storm
PERF_GPU=1 PERF_MARKET=1 PERF_LABEL=gpu npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
VITE_FORCE_WEATHER=storm PERF_GPU=1 PERF_MARKET=1 PERF_LABEL=storm npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium

# Phone texture memory per place (§2c): the art captures at the Pixel 7 size, logging data-texture-mb,
# the art and people resolution (ppu, people) and the effects level with every shot
E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/place-art.spec.ts e2e/storm-art.spec.ts \
  e2e/bethlehem-art.spec.ts e2e/letter-art.spec.ts --project=desktop-chromium -g phone
#   → test-results/<spec>/after/phone-*-art.txt

# People in the game (§2d): desktop and phone, the house and the market, data-texture-mb with every shot
E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/people-art.spec.ts --project=desktop-chromium
#   → test-results/people-art/after/<viewport>-<nn>-<name>.png (and -crop.png), <viewport>-art.txt

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
| **Only the render targets the world uses** | `disablePreFX`/`disablePostFX` in [`mount-world.ts`](../src/game/phaser/mount-world.ts); `releaseUnusedTargets` in [`src/game/phaser/renderer.ts`](../src/game/phaser/renderer.ts) | Phaser's built-in FX allocated about 70 screen-sized or smaller render targets up front (61 MB at 1280×720; about 420 MB at 2560×1440) that the world never used; bitmap-mask and capture targets are shrunk to 1×1 |
| **Release the last place's art** | `releaseUnusedTextures` in [`world-scene.ts`](../src/game/scenes/world-scene.ts) | Art, people and painted figures from the previous place are freed when a new place is built (18 MB of painted figures from the house were still resident in the market) |
| **Half-resolution art on phones** | `wantsLowResolution` in [`select.ts`](../src/game/prerendered/select.ts), `isPhone`/`isLowMemory` in [`resolution.ts`](../src/game/systems/resolution.ts) | Phones (a touch screen under 600 CSS px on its shorter side) and devices reporting ≤ 2 GB load the half-resolution place set and people sheets: 31–41% of the textures they held before (§2c). Desktops and tablets keep the full art |
| **Smaller GPU formats where they don't show** | [`src/game/phaser/compact-textures.ts`](../src/game/phaser/compact-textures.ts) | Shadow sheets upload as one channel (¼); on phones, tablets and low-memory devices the opaque ground uploads as RGB 5-6-5 (½). The browser converts during upload: no pixel work in JavaScript |
| **Effects step down before the frame rate does** | `stepQuality` in [`quality.ts`](../src/game/systems/quality.ts) | full → lite (no post-processing, half the weather) → crisp (1×) → low; an isolated hitch is ignored, repeated long frames are not; no GPU → 1× and no post-processing from the start |
| **One post-processing pass, bloom at half the CSS resolution** | [`post-fx.ts`](../src/game/fx/post-fx.ts) | One full-screen composite plus small bloom passes, instead of a chain of full-resolution FX |
| **Weather particles on a budget** | `weatherBudget` in [`weather.ts`](../src/game/systems/weather.ts) | Counts scale with the weather, the view size (clamped ½–2×) and the quality level; none with reduced motion or indoors |
| **Water only where there is water** | [`water-surface.ts`](../src/game/fx/water-surface.ts) | One shader quad per body of water (and painted well or trough), masked by an 8-texels-per-tile map |
| **Self-hosted, subset fonts** | [`src/app/main.tsx`](../src/app/main.tsx) (`@fontsource/*/latin-400/700.css`) | Latin subset, two weights each, no third-party font requests |

## 5. Not measured yet

- **60 fps on typical phones has NOT been measured on real devices.** The only figures are from headless, software-rendered Chromium (above). Real devices have GPUs and may do better, but that is an expectation, not a measurement.
- **Slow-network behaviour beyond offline caching has not been measured.** Offline play after the first visit *is* verified ([`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts)). The time to first load and to start a chapter over a slow connection is not. Starting the chapter fetches ≈377 KB gzip of lazy chunks unless the service worker has already cached them.
- Memory use (the largest ground texture is about 24 MB at 2×), battery drain, real low-end devices, WebKit/Safari, and Lighthouse scores. CPU throttling is used only to check that automatic quality switches on.
- **High-DPI, weather, water and post-processing on real phones and tablets.** GPU figures in §2b come from an Apple M3 Pro, which says little about a mid-range phone's GPU. The automatic quality levels are the safety net; they have been exercised only in emulation.

## 6. Next steps

1. **Measure on hardware:** a mid-range Android phone (Chrome remote debugging, Performance panel) and an older iPad (Safari Web Inspector). Record the results here.
2. **Throttled-network run** for first load and chapter start. If it is slow, add a loading progress indicator.
3. **Size budgets:** make `perf:bundle` fail above agreed limits, for example initial JS+CSS at 160 KB gzip.
4. **Optional trims, after measuring:** a custom Phaser build without unused systems. Caching OpenDyslexic only once it is selected, rather than precaching it, would save about 230 KB of `woff2` for most players but means it isn't available offline until chosen.

# Handoff: realism pass and Chapters 2–4 (2026-09-26)

> **Status: complete.** Everything below was finished on the same day: all WIP branches were merged into `feat/realism-and-chapters`, both code reviews' findings were fixed, and the branch went to `main` by pull request. This document is kept as the record of how the work was split and merged.

This is where the realism pass and Chapters 2–4 stand, what's left, and how to finish, on this laptop or a more powerful machine. Read it together with `AGENTS.md` and the latest entries in `claude-progress.txt`.

## What the owner asked for

1. Make the "look" profile pictures (portraits) much more realistic. They looked like cartoons.
2. Build out the remaining chapters: 2 *A Storm on Galilee*, 3 *A Journey to Bethlehem*, 4 *A Letter from Paul*.
3. Make the graphics as realistic as possible, upgrading the engine if needed ("don't spare the tokens … next level").
4. Then do a code review, address the feedback, open a PR, merge it and deploy.

Merging to `main` deploys the site automatically once CI passes: <https://zac-harlan-lee-enterprises.github.io/witness/>. The repo runs without approval gates; see `AGENTS.md` → Guardrails.

## Branch map

| Branch | State | What it holds |
|---|---|---|
| `main` | deployed | Chapter 1 with the pre-rendered market; automatic Pages deploy |
| **`feat/realism-and-chapters`** | **integration branch, pushed, green** | Everything merged so far (next table). 520 Vitest tests pass; the e2e suite passes (world.spec fixed in 76c342b) |
| `feat/art-storm-on-galilee` | WIP, pushed | Chapter 2 art: lake kit and people; **places not finished** |
| `feat/art-journey-to-bethlehem` | WIP, pushed | Chapter 3 art: village kit, night; `tamar-house` done; **two places not finished** |
| `feat/art-letter-from-paul` | WIP, pushed | Chapter 4 art: Roman kit; **places not finished** |
| `feat/portraits-v2` | WIP, pushed | Second-pass portrait pipeline and data for every chapter; **portraits not re-rendered yet** |

The WIP branches all branch from `feat/realism-and-chapters` (`eb1af82`, or `640002b` for portraits) and are not merged yet.

## Already on the integration branch

- **Chapters 2, 3 and 4 as content.** They are playable end to end, with headless playthroughs of every branch and one e2e spec each. The research uses retrieved sources only, and every record is an AI draft awaiting human review.
  - Design docs: `docs/chapters/*.md`
  - Claim-by-claim research: `docs/research/*-sources.md`
- **Story-driven weather.** `Scene.weather` and `weatherChanges`, with `WorldPort.setWeather`.
- **Engine graphics (ADR-0015):**
  - high-DPI canvas;
  - rain, wind and storm with safe lightning;
  - animated water;
  - post-processing;
  - lamplit interiors at night;
  - 59–71% less texture memory in the market;
  - a "Simpler visual effects" setting and `VITE_FORCE_WEATHER`.
- **Portraits, first pass.** Rendered portraits for Chapter 1's characters and the 4 player looks (`docs/art/portraits.md`).
- **Chapter 1 fully pre-rendered.** House, road and Jericho, plus the general place builder (`tools/art/build_place.py`, `kit_*.py`), people at rest and story-mark overlays.
- **Integration fixes:**
  - chapter cards labelled for tests (`newGame(page, title)`);
  - a longer timeout for the architecture scan;
  - footsteps on every chapter's ground;
  - one `appearanceKey`;
  - `choose()` waits for the dialogue box before choosing.

## What each WIP branch still needs

Scene ids: Chapter 2 is `shelomit-house`, `capernaum-shore` and `open-lake`. Chapter 3 is `tamar-house`, `bethlehem-lanes` and `shepherds-fields`. Chapter 4 is `ammia-workshop`, `colossae-street`, `lycus-road` and `philemon-house`.

**`feat/art-storm-on-galilee`**
- Done:
  - `kit_lake.py`;
  - dusk and night light for pre-rendered places;
  - Chapter 2's people in afternoon, dusk and night light;
  - capture spec `e2e/storm-art.spec.ts`;
  - provenance docs.
- Partial: `public/art/capernaum-shore/` has later-day ground and shade only, and no manifest.
- To do:
  1. Render the three places (`node scripts/art-build.mjs place <id>`).
  2. Add them to `PLACES_WITH_ART` (`src/game/prerendered/select.ts`) and `PLACES` (`scripts/art-build.mjs`).
  3. Run the captures, then the required checks.
- Beyond its brief, it edited `src/game/{fx/water-surface,fx/weather-layer,systems/water,scenes/world-scene,scenes/actors,phaser/mount-world}.ts`, `src/app/config.ts` and `src/game/prerendered/*`.

**`feat/art-journey-to-bethlehem`**
- Done:
  - `kit_village.py`;
  - night art, places lit for their story's times, flickering baked lamps;
  - people carrying lambs, lamps and tablets, lit for night;
  - **`tamar-house` rendered (manifest present)**;
  - a GPU out-of-memory retry;
  - capture spec `e2e/bethlehem-art.spec.ts`.
- Partial: `shepherds-fields` has later-day ground and shade only; some later-day people sheets.
- To do: render `bethlehem-lanes` and `shepherds-fields` (night is the heart of this chapter), then the captures and checks.
- Beyond its brief, it edited `src/game/{scenes/world-scene,scenes/ambient,systems/lighting,systems/water,art/site}.ts` and `src/game/prerendered/*`.

**`feat/art-letter-from-paul`**
- Done:
  - `kit_roman.py`;
  - rain-cloud, dusk and lamp lights, and "a place's own light plan";
  - people lit as their place is, and the letter-case overlay;
  - `export-art-data` exporting every chapter;
  - art checks for every chapter's places;
  - a Blender 5.2 fix (`blur_glossy`).
- Partial: `colossae-street` has ground, shade and one sprite page (day), and no manifest.
- To do: render the four places, then the captures and checks.
- Beyond its brief, it edited only `src/game/prerendered/*`, which is the smallest engine footprint of the three.

**`feat/portraits-v2`**
- Done:
  - `tools/art/data/portrait-people.json`: everyone who speaks, in every chapter; biblical figures excluded;
  - the second-pass pipeline: varied face structure and asymmetry, real skin (pores, weathering, stubble), eyes, expressions, cloth wound in bands for turbans, child proportions;
  - hair and test changes, part-finished (the last WIP commit).
- Not done:
  1. Iterate by eye on probes against the v1 contact sheet (`docs/art/portraits/contact-sheet.webp`).
  2. Re-render every portrait (about 49; about 22 minutes per 16 on an M3 Pro when the GPU is free).
  3. Update the manifest, contact sheets and `docs/art/portraits.md`.
- The v1 critique the second pass addresses:
  - faces too alike (one nose, thin flat lips, a blank stare);
  - plastic skin;
  - glassy eyes;
  - turbans read as caps;
  - children have adult faces.

## The one real merge risk: three lighting systems

The three art branches each solved "pre-rendered places need more than morning and later-day light (dusk, night, lamplight, rain cloud)" **independently**. Each changed `manifest.ts`, `select.ts`, `loader.ts`, the art-assets test and (Chapters 2 and 3) `world-scene.ts`. Don't merge them blindly:

1. **Merge `feat/art-letter-from-paul` first.** It has the smallest, data-driven version: a light plan per place in the manifest.
2. **Merge `feat/art-journey-to-bethlehem` next,** porting its night and baked-lamp work onto that light plan rather than keeping a second mechanism.
3. **Then `feat/art-storm-on-galilee`,** likewise. Keep its water and weather tweaks only where they're still needed.
4. **Generated JSON conflicts:**
   - `public/art/people/people.json`: merge as a union of the keyed maps.
   - `docs/art/asset-manifest.json`: union of the entries.
   - `tools/art/data/chapter.json`: regenerate with `npm run art:data`.
5. After each merge, run `npm run typecheck && npm run lint && npm test`, `npm run content:validate`, and the chapter's `e2e/*-art.spec.ts` with `E2E_SHOTS=1`. Look at the captures.

## Decisions to finish before the PR

- **Offline caching (not done yet, in `vite.config.ts`).** Keep precaching Chapter 1's art, which lets a first-time visitor play Chapter 1 offline. Cache Chapters 2–4's art on first use instead of precaching it; otherwise first visits download 30–40 MB in the background. Raise the `witness-art` runtime cache's `maxEntries` (now 200) to hold four chapters, about 1000. People sheets share one folder: measure the precache (`npm run build`, then check the precache size reported by the build) and decide whether new chapters' people need to move to a runtime-cached subfolder.
- **Texture memory.** People sheets have no half-resolution set yet, and they dominate phone memory (30–55 MB per place). This is the next memory step.
- **Code review.** Run the `code-review` skill on the diff from `main` to the final branch. The diff is very large, so review the source directories rather than the binary art. Fix what it finds, then run the full suite, `bash quality-sweep.sh` and `bash init.sh`.
- **PR → merge → deploy.** Open a PR from `feat/realism-and-chapters` to `main`; CI must pass. Merge, then check the Pages deploy (`gh run list --workflow deploy-pages.yml`) and the live site.

## Setting up another machine

```bash
git clone https://github.com/Zac-Harlan-Lee-Enterprises/witness.git && cd witness
git fetch origin && git checkout feat/realism-and-chapters
npm ci && npx playwright install chromium
bash init.sh                        # hooks + dev server on :5391; must end "[ ok ] … is healthy"
# Blender 5.2+ for the art pipeline (set BLENDER=/path/to/blender if not in the default place)
git worktree add ../witness-ch2 feat/art-storm-on-galilee   # one worktree per WIP branch, if you work in parallel
```

**GPU is the bottleneck.** On one GPU, render sequentially; four agents rendering at once slowed each other badly and one ran out of GPU memory. A machine with a bigger GPU and more VRAM can run the chapters' renders in parallel.

## Notes for the record

- **Privacy incident (2026-09-25).** Two research subagents, one working for Chapter 2 and one for Chapter 4, put the owner's email address in the User-Agent header of some Wikipedia API requests. The email is in no file in the repo. Every agent brief now carries an explicit rule never to send personal details.
- **Portraits v1** read as high-end CG rather than photographs. A further jump in realism probably needs a sculpted base mesh. MakeHuman's assets are CC0, but using any downloaded asset is the owner's call, since the realism brief forbade downloading artwork.
- **Content.** All educational records in Chapters 2–4 are AI drafts awaiting a named human reviewer. Nothing is approved, and the Scripture text for Chapters 2–4 is not in the translation registry, so players see the placeholder.

## Progress since the checkpoint (same day)

- **Merged and pushed** to `feat/realism-and-chapters`:
  - portraits second pass: all 43 speakers and the player looks;
  - Chapter 4 art: all four places, with Chapter 4's per-place light plan as the canonical lighting mechanism.
- **Still rendering:** Chapter 3 (`bethlehem-lanes`, `shepherds-fields`) and Chapter 2 (all three places). Both are porting their lighting onto Chapter 4's light plan first.
- **Code review** (the `code-review` skill, high effort, on `feat/realism-and-chapters`). Fixed:
  - the test world's weather getter;
  - the portrait lookup is indexed;
  - the cache-on-first-use art cache is named by a content hash (`scripts/art-revision.ts`), so it can't go stale after a redeploy;
  - later-chapter people lights are cached on first use.
- **Settled by Chapter 2's branch when it merges:** lake and shallows get live water, and no rain splashes on open water.
- **Review findings still to fix after the Chapter 2 and 3 merges** (they touch the same files):
  1. `src/game/fx/weather-layer.ts`: puddles on `roman-road`, `bridge` and `shingle` too.
  2. `src/game/scenes/world-scene.ts`: turning "Simpler visual effects" off must restore the level `create()` chose (`lite` on software renderers), not `full`.
  3. `src/game/prerendered/figures.ts` / `loader.ts`: a person's shadow sheet and its frame metrics must come from the same light as the body sheet.
  4. `src/game/prerendered/loader.ts`: reuse the engine's `textureMegabytes` (GPU formats) instead of a second RGBA-only copy that overwrites `data-texture-mb`.
  5. `src/game/prerendered/loader.ts`: `beginPlace` marks sheets stale before the next place's loads can keep them, so they're dropped and downloaded again on every transition. The module-level `watching` also holds a destroyed scene.
  6. `src/game/scenes/world-scene.ts`: `refreshSky()` runs every frame even when nothing changed.

# Visual prototype report: can Phaser deliver grounded historical realism?

**Scope:** the lower market in Jerusalem (`jerusalem-market`), built as a production-quality slice with pre-rendered 3D-to-2D art. The player, the market's seven characters and four passers-by are rendered people. Sections 1–8 report that prototype as it was.

**Since then** (§9): the pipeline builds any scene from its data, and every Chapter 1 place is pre-rendered (the house, the road and Jericho too), with people at rest, story marks and indoor light.

**Engine question:** stay with Phaser, run a Unity comparison, or migrate to Unity. The answer is in §8.

The screenshots referred to here were captured by [`e2e/market-art.spec.ts`](../../e2e/market-art.spec.ts) and [`e2e/visual-tour.spec.ts`](../../e2e/visual-tour.spec.ts) at identical positions and viewport sizes. The same builds are compared with and without the new art. They are not committed (they are several MB each run); re-create them with the commands in the [technical-art guide](technical-art-guide.md).

## 1. What was built

- **An offline 3D pipeline** in [`tools/art/`](../../tools/art/). Blender builds the market from the game's own tile map and the people from their appearance data, lights them with one sun and a physically based sky, and renders them through the game's exact camera. Details are in the [technical-art guide](technical-art-guide.md).
  - Places are built from procedural limestone ashlar with drafted margins, worn paving, earth, dry grass, grit and litter, stalls with striped awnings and produce, pottery, baskets, sacks, a well, an oven, a goat-hair tent, cloth racks, olive trees and pack donkeys.
  - People have natural proportions, lofted garments with folds, faces, hair, beards, head coverings and the things they carry. They have an 8-frame walk, breathing, blinking, two talking frames and diagonal turning frames.
- **Two lighting variants** for every layer and person:
  - morning: sun in the east-south-east, raking warm light on the stone fronts;
  - later day: low sun in the west-south-west, long amber shadows.
- **Phaser compositing** (see [ADR-0014](../adr/0014-prerendered-places.md)):
  - a ground layer with every shadow baked in;
  - standing things as sprites sorted by the line they stand on, so people walk behind trees, stalls and houses correctly;
  - people with baked shadows that match the buildings';
  - a shade mask that dims and cools anyone standing in shadow;
  - diagonal frames when someone turns;
  - dust motes and passers-by as before;
  - the existing interaction feedback and conversation camera.
- **Kept unchanged:**
  - React owns every menu, dialogue, puzzle, the journal, the HUD, settings and accessible control;
  - the `WorldPort` boundary (`loadScene` now awaits the art);
  - story rules, quests, dialogue, saves and choices;
  - keyboard, touch, pointer and gamepad input, and the accessible Go to… list;
  - reduced motion and high contrast;
  - offline play (the art is precached) and static hosting.

## 2. Before and after

Measured sets are listed in §4. The capture sets are:

| Set | Build | What it shows |
|---|---|---|
| `before` | Commit f2018ef (painted market) | Arrival at the house door, a few steps along the square, talking with Hadassah: desktop 1280×720, tablet 820×1180, phone 412×915 |
| `after-day` | This branch, `VITE_CAMERA_FRAMING=standard` | The same positions and framing, pre-rendered market, morning light |
| `after-late` | This branch, `VITE_CAMERA_FRAMING=standard VITE_ART_LIGHTING=late` | The same positions in the later-day light |
| `after-close` | This branch (close framing is the default) | The same positions with the tighter framing |

## 3. Framing

Two framings were compared at identical positions:

- **standard:** about 15 tiles across a 1280×720 screen, zoom 2.25;
- **close:** about 11.5 tiles across, zoom 3.0 on desktop, 2.75 on tablet and 1.75 on phone.

**Close wins in the pre-rendered market:**

- People go from about 120 to about 160 px tall, and faces, garments and the stone read.
- The conversation camera still frames the player and the speaker above the dialogue box on every screen.
- Walking stays clear, and the "Go to…" list covers the smaller overview.
- Reduced motion still turns off look-ahead and settling.

**Close is only used where the art has the resolution for it** (`framingFor`). Painted places, at 2 px per unit, keep the standard framing; close would blur them. `VITE_CAMERA_FRAMING=standard` restores the standard framing everywhere.

## 4. Performance and size

Measured, not estimated. Setup: headless Chromium with software rendering, an Apple M3 Pro host, and two alternating rounds against the painted build. **No real devices** were available: phone and tablet are viewport sizes in desktop Chromium, and nothing here is an Android or iPad measurement.

| | Painted market | Pre-rendered market |
|---|---|---|
| Desktop, full effects | 41–42 fps | 36–37 fps |
| Desktop, reduced effects | 55–56 fps | 47–48 fps |
| Tablet viewport, full effects | 38–40 fps | 36 fps |
| Phone viewport | 60 fps | 60 fps |
| Frames over 33 ms while walking (desktop) | 1–6% | 3–4% |
| Chapter start | 0.60 s | 0.60–0.65 s |
| House → market | 0.96–1.00 s | 1.04–1.06 s |
| Texture memory in the market | 21 MB | 94 MB (about 72 MB on phones) |
| Initial JS + CSS (gzip) | 152.6 KB | 154.3 KB |
| Lazy code: engine, chapter, loader (gzip) | 377.1 KB | 391.1 KB |
| Market art, morning set (precached) | none | 2.9 MB |
| Market art, later-day set (cached on first use) | none | 2.6 MB |
| Offline precache | 2.3 MB | 5.2 MB |

Download sizes come from `npm run perf:bundle` on both builds. The code barely grew; the art is new. Details in [performance.md §1](../performance.md#1-download-size).

**Findings:**

- Frame rate drops about 10–15% under software rendering, and frame pacing is unchanged.
- Load and transition times are within about 0.1 s.
- **Memory is the cost that matters:** about 4.5× the painted market.
- The fix is known, but not done: GPU-compressed textures (KTX2 or Basis) and fewer crowd variants.

## 5. Asset-production estimate

Relative effort. One unit is about half a day for one technical artist working in this pipeline. "Procedural" means authored as code in `tools/art/`, as in this prototype. "Hand-modelled" means an artist models in Blender and exports through the same camera, lights and packing.

| Asset | Procedural (this pipeline) | Hand-modelled, same export | Notes |
|---|---:|---:|---|
| Major character | 2–3 | 12–20 | The generator is parametric, so a new garment type or carried item is code. Hand-modelled means sculpt, retopology, rig, cloth and animation. |
| Minor NPC | 0.25 | 2–4 | A new appearance record plus review. Rendering takes about 2 minutes. |
| Building front (new type) | 3–4 | 4–8 | The first of a type, such as a mudbrick house with timber beams, or a synagogue front. Variants follow from the map at no extra cost. |
| Prop family | 1–2 | 2–6 | For example a pottery set, carts, looms or baskets |
| Vegetation family | 2–3 | 4–8 | Olive is done. A date palm needs frond geometry; a fig needs leaf clusters. |
| Full map (like the market) | 8–12 | 40–80 | Reuses the families. Includes iteration and review; rendering takes 6–10 minutes. |
| Story-mark variants (bandages, borrowed cloak, gear) | 2–4 in total | 4–8 | Layered sheets rendered with holdouts: one pass per mark, composited in Phaser |

## 6. Limitations attributable to Phaser

These are limits of the engine as used here, not of the art approach:

1. **No first-class high-DPI rendering.** Phaser 3.60+ removed `resolution`. The canvas renders at CSS pixels, and on Retina screens the browser scales it up, softening fine detail. The fix is a known pattern (render at device pixels and set camera zoom to 1/DPR) at 4× the fill cost. Not done in this prototype.
2. **Uncompressed textures in practice.** Phaser can load GPU-compressed formats (KTX, ASTC, ETC, S3TC), but it has no universal transcoder (Basis/KTX2 needs a separate decoder). The art is decoded to RGBA, which is what drives texture memory (§4). This is the largest cost on phones.
3. **2D lighting only.** Light2D offers point lights with normal maps: no shadows, no directional sun, a small light count. Time of day is handled by swapping baked variants and grading. A live sunrise-to-sunset sweep would need many variants or a custom shader.
4. **Sprite animation only.** There's no runtime skeleton. Every pose is a frame in a sheet, so directions × frames × variants multiply memory. Spine or DragonBones plugins exist, with their own licences.
5. **Depth is per sprite.** Correct for this view. Walk-under structures such as arches and bridges need hand-split layers.
6. **Texture size.** Atlas pages are kept at 2048 px for older mobile GPUs. Very large layers such as the ground at 3 ppu are single textures and must stay under 4096 px on those devices.

None of these blocks the target look at gameplay scale. Items 1 and 2 are the next engineering steps if the pipeline goes ahead.

## 7. What didn't work, and what that means

- **Close-ups.** Dialogue portraits rendered from the same procedural people looked like carved wooden figurines. The generated characters hold up at gameplay size (about 110–160 px) but not in close-up, so the illustrated SVG portraits stay.
- **Close-ups need real assets, not another engine.** Realistic portraits would need hand-sculpted heads (in this same pipeline) or painted portraits. A different engine would face the same problem.
- **Story marks** (bandages, a borrowed cloak, the player's gear) were not pre-rendered in the prototype: people who showed marks were painted, even in the market. They are now overlay sheets (§9).

## 8. Recommendation: continue with Phaser

The prototype delivers the grounded historical tone at normal gameplay scale in the browser. Phaser was not the limit; the art was. The market now reads as stone, cloth, pottery and olive wood under one sun, with people of natural proportion and coherent shadows. Phaser composites it:

- with correct depth, shade and conversation framing;
- within about 10–15% of the old frame rate under software rendering;
- with the same load times, working offline, and with every accessible path unchanged.

**A Unity comparison is not warranted by this design.** Its criteria don't apply here:

| Criterion | Applies? |
|---|---|
| Continuous perspective camera | No |
| Close-up character performance | No: portraits are a separate asset problem, as above |
| View-dependent PBR | No |
| Runtime skeletal animation or IK | No |
| Perspective-correct occlusion | No |
| Dynamic 3D light that can't be baked | No: morning and later-day bake cleanly |

A Unity WebGL build would add a runtime of tens of MB, slower start-up and weaker mobile-browser support, and it would not remove the texture-memory question. Revisit only if the design adds cinematic camera moves or close-up acting.

**Next, if the pipeline goes ahead:**

1. GPU-compressed textures and fewer crowd variants, for memory.
2. High-DPI rendering, for crispness.
3. Layered mark sheets (done: §9).
4. Pre-rendering the other three places: 8–12 units each, reusing the families (done: §9).
5. Measuring on a mid-range Android phone and an older iPad before shipping.

## 9. Since the prototype: every place, story marks, one place in memory

The pipeline now builds any place from its scene data, and every place in Chapter 1 is pre-rendered ([technical-art-guide.md](technical-art-guide.md)):

- **Aunt Miriam's house**: a room in cutaway. Its walls and roof block light but are never seen; morning sun slants in through a barred east window and the door, with dust glowing in the beams, an oil lamp in a niche and embers in the tannur. People in it are lit for the room (their `indoor` sheets).
- **The road down to Jericho**: Judean desert. One terrain mesh for hills, stepped cliffs, a wadi and the ridge path, registered with its tiles by a shear; angular stones and boulders, desert scrub, the cistern, and the story's evidence as marks in the dust (sandal prints, drag marks, a broken jar's oil stain).
- **Jericho**: an oasis town. Date palms (their crowns fade while you walk behind them), figs, reeds and irrigated plots round a spring pool; mudbrick houses with timber-beamed roofs; a courtyard inn with a flagged yard worn back to earth in places, a well, a cart; a courtyard with a mud-roofed portico and a tannur.

**Story marks** are pre-rendered too: bandages (plain, or torn from the player's tunic in its colour), the borrowed cloak, the spare cloak rolled on the player's back, the water skin and the lamp are overlay sheets drawn over the person, frame for frame; a torn hem is a sheet of its own; the traveler sits and lies in sheets of their own.

**Memory:** a place's textures are released on the first frame nothing draws them, so one place is in memory at a time (the painted chapter held about 100 MB by Jericho). The ground is cut into tiles of at most 2048 px, so every texture fits any GPU. Per-place download and texture sizes, the in-game figures and the caching decision are in [technical-art-guide.md §9](technical-art-guide.md#9-measurements).

Review captures of every place at desktop, tablet and phone sizes: `E2E_SHOTS=1 ART_SHOTS=<set> npx playwright test e2e/place-art.spec.ts --project=desktop-chromium`.

Still to do: GPU-compressed textures (§8, item 1); the market re-rendered with the newer kit (it predates tiled grounds and holdouts, and was only upgraded in place); and measurements on real phones. (Half-resolution people sheets for phones are done: phones now load the low set and low people, 31–41% of the texture memory they held; see [performance §2c](../performance.md#2c-phones-half-resolution-places-and-people).)

# Technical art guide: pre-rendered 3D-to-2D places and people

This guide is for anyone adding art to the game with the offline Blender pipeline in [`tools/art/`](../../tools/art/). The first place built this way is the lower market in Jerusalem (`jerusalem-market`). Every other place is still painted at runtime by [`src/game/art/`](../../src/game/art/).

- **What players download:** static WebP images and JSON manifests under [`public/art/`](../../public/art/), precached by the service worker, so they work offline.
- **What Phaser does:** composites the layers and sorts sprites against people. Nothing is generated at runtime.
- **What authors need:** Blender 5.2 or later. Players never need it.

## 1. The camera

The game's view is an **oblique three-quarter view**:

- The ground is not foreshortened, so a tile is a square on screen.
- Something `h` units tall rises `h` units up the screen.
- One tile is 32 game units and about 1 metre.

| Setting | World and places ([`view.setup_camera`](../../tools/art/lib/view.py)) | People ([`view.setup_figure_camera`](../../tools/art/lib/view.py)) |
|---|---|---|
| Projection | Orthographic, looking north and down | Orthographic, looking north and down |
| Elevation | **45°** | **32°** (faces and fronts read better) |
| Pixel aspect | 1/sin 45° wide, so the ground is square again | 1/cos 32° wide, so height is still 1:1 |
| Height on screen | 1 unit up per unit of height | 1 unit up per unit of height |
| Blender units | 1 BU = 1 tile = 32 game units; game y (south) = −Blender y | same |

Shadows lie on the ground, so they are always rendered with the world camera, including people's shadows.

## 2. Resolution and pixels per world unit

| Asset | Pixels per game unit (ppu) | Notes |
|---|---|---|
| Place layers and sprites | **3** | 96 px per tile. Sharp up to the close framing's desktop zoom (3.0). |
| Low-resolution ground | 1.5 | Loaded when the camera shows ≤ 1.5 px per unit (phones), or on devices that asked for simpler effects |
| Character sheets | **3** | A 54-unit adult is about 160 px tall in the texture and about 122 px on a 1280×720 screen |
| Shadow sheets | 1 | Soft by nature |

The game shows textures at `1/ppu` scale. The Phaser canvas renders at device pixels (up to 2×; see [ADR-0015](../adr/0015-world-rendering-effects.md)), so on a high-DPI screen at close framing one texture pixel of 3-ppu art covers about two screen pixels, and a 1-ppu shadow sheet about six: richer art would show.

## 3. Lighting (one sun, a physically based sky)

[`tools/art/lib/lighting.py`](../../tools/art/lib/lighting.py):

| Variant | Sun | Used when |
|---|---|---|
| `day` | East-south-east, 40° up, warm white. South-facing fronts catch raking light from the right; shadows reach up and to the left. | Story hour before 15:00 |
| `late` | West-south-west, 21° up, amber. Fronts are lit from the left; long shadows reach right. | Story hour 15:00 or later |

The sky is Blender's multiple-scattering sky, set for the same sun. It gives the cool fill in shade. Colour management is AgX at −1.4 EV.

**Keep cloth sheen tinted and light** (`cloth` in [`materials.py`](../../tools/art/lib/materials.py)). An untinted sheen reflects the blue sky across the whole garment and turns every dye grey: at weight 0.45 a brown robe rendered neutral grey (saturation 0.31 authored → 0.07 rendered). The sheen now takes the dye's colour at weight 0.14, and wool is blended only 12% toward undyed fibre, which keeps garments natural and still tells people apart.

For review builds only, `VITE_ART_LIGHTING=day|late` forces a variant.

## 4. Render passes

**Places** ([`build_market.py`](../../tools/art/build_market.py)), for each lighting variant:

| Pass | What | How |
|---|---|---|
| Ground | Paving, earth, grass, grit, litter, low wall tops, the north city wall | Every standing thing is hidden from the camera but still casts shadows and bounces light, so all shadows and contact occlusion are baked in |
| Shade mask | Sun visibility on the ground | White material override, sun only, ¼ resolution. The game dims and cools people who stand in shade. |
| Sprites | Each standing thing (house, stall, tree, prop, animal, sign) | Rendered alone with a render border around it. Everything else is invisible to the camera but still lights and shadows it. Cropped to its alpha and packed into 2048-pixel atlas pages. |

**People** ([`build_people.py`](../../tools/art/build_people.py)), for each lighting variant:

- a colour sheet from the figure camera, without the ground;
- a shadow sheet from the world camera: the person is hidden from the camera and a shadow-catcher ground records their shadow. It is stored as an opaque cool tint on white and drawn with **multiply** blending, about a tenth of the size of an alpha channel. It fades out when the person stands in shade.

Then every frame is **trimmed** to its visible pixels and packed into an atlas ([`lib/pack.py`](../../tools/art/lib/pack.py)). `people.json` records each frame as `[x, y, w, h, offsetX, offsetY]`, and the game restores each one to its full frame size (Phaser trimmed frames), so origins are unchanged. This roughly halves people's texture memory.

Not produced, because they wouldn't improve anything in this view:

- **Normal maps.** All light is baked, and the only dynamic light at dusk is the lamp glow.
- **Separate albedo passes.** Lighting changes by swapping a variant.
- **An emissive pass.** The oven's glow is baked.

The pipeline could add them as passes. See §8 for when that would matter.

## 5. Sheets and naming

**Place:** `public/art/<scene-id>/`

- `ground-<variant>.webp`
- `ground-<variant>-low.webp`
- `shade-<variant>.webp`
- `sprites-<variant>-<page>.webp`
- `manifest.json`

**Sprite ids:**

- `<kind>-<x>-<y>` for map tiles, for example `stall-11-6` or `olive-2-7`
- `house-<x>-<y>` for buildings
- `entity:<entity-id>` for story entities, so the game draws `vessels` from the atlas when that entity is visible
- `<id>#<n>` for slices of anything wider than a page

**People:** `public/art/people/`

- `<id>-<variant>.webp` (colour)
- `<id>-shadow-<variant>.webp` (shadow)
- `people.json`

Ids are `player-look-N`, character ids (`hadassah`), or `crowd-N`. Each entry carries its **appearance key** (`appearanceKey` in [`select.ts`](../../src/game/prerendered/select.ts)). The game matches people to sheets by that key, not by name.

**People sheet layout** (frame 44 × 68 game units, feet 62 units from the top):

| Row | Contents |
|---|---|
| 0–3 | down, left, right, up |
| 4 | turning in-betweens: down-left, down-right, up-left, up-right |

| Column | Frame |
|---|---|
| 0 | idle |
| 1 | breath |
| 2 | blink |
| 3 | talk (mouth open, hand raised) |
| 4 | talk (mouth half-open) |
| 5–12 | 8-frame walk, from left-foot contact. Only for the player and passers-by; standing characters stop at column 4. |

The frame names the game uses are `<row>-<column>` and `turn-<diagonal>`.

## 6. Compression

Everything is WebP, written by Blender:

| File type | Quality |
|---|---|
| Colour layers and sprite pages | 86–90 |
| Low-resolution ground | 84 |
| Shadow sheets | 62 (opaque tint, multiplied) |
| Shade mask | 90 |

WebP decodes in every current browser, including Safari 14+.

**Offline:**

- The service worker precaches every morning (`day`) file.
- Later-day (`*-late*`) files are cached the first time they're used. The story never shows the market after 15:00.

**Camera:** pre-rendered places use the **close** framing (about 11.5 tiles across a landscape screen). Their art has the resolution for it. Painted places keep the standard framing, since their 2-px-per-unit art would blur. See `framingFor` in [`camera.ts`](../../src/game/systems/camera.ts). `VITE_CAMERA_FRAMING=standard` keeps the standard framing everywhere.

## 7. Adding things

Rebuild data first whenever characters or maps change: `npm run art:data`.

**Another character**

1. Give them an `appearance` in the chapter content, as today.
2. Add their id to `PEOPLE` in [`scripts/art-build.mjs`](../../scripts/art-build.mjs).
3. Run `npm run art:people`.

The generator is parametric. It reads the appearance (build, skin, hair, beard, robe and stripe colours, head covering, what they carry) and builds, rigs and renders the person. New kinds of clothing or carried items go in [`tools/art/lib/people.py`](../../tools/art/lib/people.py).

**A building or prop in the market**

1. Change the map as usual.
2. Run `npm run art:market`.

Buildings come from wall and roof regions: a region with a front row gets an ashlar front, a door and windows. Props come from tile kinds (`_props` in [`tools/art/lib/market.py`](../../tools/art/lib/market.py)). A new tile kind needs a builder method there.

**Another place**

1. Write a builder like `market.py` (it can reuse its ground, masonry, prop and tree builders).
2. Add a build script entry.
3. Add the scene id to `PLACE_ART` in [`select.ts`](../../src/game/prerendered/select.ts).

The content test [`tests/content/art-assets.test.ts`](../../tests/content/art-assets.test.ts) then checks that its manifest is valid, its files exist, it matches the map, and every file is recorded in the [asset manifest](asset-manifest.json).

**Story marks (bandages, a borrowed cloak, the player's gear)** are not rendered yet. Anyone showing marks is painted by the Canvas painter, even in the market.

## 8. Rendering in the game

[`src/game/prerendered/`](../../src/game/prerendered/) and [`world-scene.ts`](../../src/game/scenes/world-scene.ts):

1. **Load.** `prepare()` loads the manifest, the variant for the story hour, the resolution for the zoom, and the sheets for everyone who will appear, all through Phaser's loader.
2. **Composite.** The ground is one image. Each sprite is an image from an atlas page, with depth set by its ground line (`depthRow`). People are sprites with a baked shadow sprite and depth by their feet.
3. **Behaviour.** Turning passes through the diagonal frames (70 ms each). Standing in shade tints a person toward the shade colour, sampled from the shade mask.
4. **Fallback.** If anything fails to load, the place is painted by Canvas as before, and a warning goes to the diagnostics log. The canvas carries `data-art="prerendered:<variant>"` or `data-art="painted"`.

## 9. Review captures and measurements

```bash
# The market at fixed positions (arrival, walking, talking) at desktop, tablet and phone sizes
# (close framing is the default; the standard framing matches the painted build's view)
VITE_CAMERA_FRAMING=standard E2E_SHOTS=1 ART_SHOTS=after-day npx playwright test e2e/market-art.spec.ts --project=desktop-chromium
VITE_CAMERA_FRAMING=standard VITE_ART_LIGHTING=late E2E_SHOTS=1 ART_SHOTS=after-late npx playwright test e2e/market-art.spec.ts --project=desktop-chromium
E2E_SHOTS=1 ART_SHOTS=after-close npx playwright test e2e/market-art.spec.ts --project=desktop-chromium
#   → test-results/market-art/<set>/

# The whole chapter in every presentation variant
E2E_SHOTS=1 npx playwright test e2e/visual-tour.spec.ts --project=desktop-chromium   # → test-results/tour/

# Frame rate, frame pacing, load and transition times, texture memory
PERF_MARKET=1 PERF_LABEL=after npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
```

For "before" images of an older build, run the same specs from a git worktree of that commit.

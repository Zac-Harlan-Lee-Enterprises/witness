# Technical art guide: pre-rendered 3D-to-2D places and people

This guide is for anyone adding art to the game with the offline Blender pipeline in [`tools/art/`](../../tools/art/). Every place in Chapter 1 is pre-rendered: Aunt Miriam's house (`miriam-house`), the lower market (`jerusalem-market`), the road down to Jericho (`jericho-road`) and Jericho (`jericho`). Places without art are still painted at runtime by [`src/game/art/`](../../src/game/art/), and so is anyone the art can't draw.

- **What players download:** static WebP images and JSON manifests under [`public/art/`](../../public/art/), cached by the service worker (§6), so they work offline.
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
| Elevation | **45°** | **32°** standing (faces and fronts read better); 45° sitting or lying |
| Pixel aspect | 1/sin 45° wide, so the ground is square again | 1/cos of the elevation wide, so height is still 1:1 |
| Height on screen | 1 unit up per unit of height | 1 unit up per unit of height |
| Blender units | 1 BU = 1 tile = 32 game units; game y (south) = −Blender y | same |

Shadows lie on the ground, so they are always rendered with the world camera, including people's shadows. So are **people at rest** (sitting, lying): they lie along the ground, which the figure camera foreshortens to about 62% (a man lying on the road came out about 1 m long, shorter than his own shadow).

### Terrain that registers with its tiles (the shear)

Hills, cliffs, a wadi and a spring's basin are built as **one mesh over the whole map** ([`terrain.py`](../../tools/art/lib/terrain.py)). A terrain point that should show at map point (x, s) with height h is placed at game ground position (x, s + h): it lands on screen at (x, s). So every point registers with its own tile at any height, terrain never needs sorting against people, and it all lies in the ground layer.

The one rule: **going south, height may drop by at most one tile per tile** (h(s + d) ≥ h(s) − d). Anything steeper would be an overhang, and someone standing just south of a height would be hidden by terrain that is really behind them. A sweep from south to north enforces it. Each kind's *lean* sets how steep its south-facing sides are (1 is a sheer face, about 0.5 is 45°), and cliffs are stepped by strata: hard beds stand sheer, soft beds slope back into ledges. Pushing a face's vertices a little north or south (buttresses) moves them on screen by the same small amount, so faces get relief and still stay on their tiles.

Walkable kinds keep fixed heights (`WALK`: the wadi is 0.34 below the ground, the pool 0.55); hills and cliffs rise by their distance from walkable ground (`RISE`). Props standing on terrain use `Place.P(x, y, z)`, which returns the Blender point `z` above the terrain at (x, y).

## 2. Resolution and pixels per world unit

| Asset | Pixels per game unit (ppu) | Notes |
|---|---|---|
| Place layers and sprites | **3** | 96 px per tile. Sharp up to the close framing's desktop zoom (3.0). |
| Low-resolution ground and sprite pages | 1.5 | Loaded when the camera shows ≤ 2 px per unit (phones) and on devices that asked for simpler effects (`wantsLowResolution`) |
| Character sheets | **3** | A 54-unit adult is about 160 px tall in the texture and about 122 px on a 1280×720 screen |
| Shadow sheets | 1 | Soft by nature |

The game shows textures at `1/ppu` scale. The Phaser canvas renders at device pixels (up to 2×; see [ADR-0015](../adr/0015-world-rendering-effects.md)), so on a high-DPI screen at close framing one texture pixel of 3-ppu art covers about two screen pixels, and a 1-ppu shadow sheet about six: richer art would show.

**No texture is bigger than 2048 px** (`MAX_ART_TEXTURE`), the size every WebGL 2 GPU must hold; many phones stop at 4096. Atlas pages are 2048 px at most, and a ground bigger than that is cut into tiles (`imageio.save_tiles`): the road's ground, 48 × 30 tiles of map, is 4608 × 2880 px at 3 ppu and ships as six tiles of 1536 × 1440. Neighbouring tiles overlap by 2 px, so no hairline opens between them when the camera sits between pixels. The game draws one image per tile; the content test checks that every texture fits and that the tiles cover the whole place.

## 3. Lighting

[`tools/art/lib/lighting.py`](../../tools/art/lib/lighting.py):

| Variant | Sun | Used for |
|---|---|---|
| `day` | East-south-east, 40° up, warm white. South-facing fronts catch raking light from the right; shadows reach up and to the left. | Places and people when the story hour is before 15:00 |
| `late` | West-south-west, 21° up, amber. Fronts are lit from the left; long shadows reach right. | Places and people from 15:00 |
| `indoor` | No sun: a warm key from a lamp high to the front left, cool soft daylight from a window on the right, warm light bounced off the plaster behind, a dim warm room for the sky | People in rooms (the place's manifest says `peopleLight: "indoor"`) |

The sky is Blender's multiple-scattering sky, set for the same sun. It gives the cool fill in shade. Colour management is AgX at −1.4 EV.

**Rooms** are lit as if closed: their side and front walls and their roof are *occluders*, invisible to the camera but blocking light (§4). Light comes in only through the openings: the sun through a window in the east wall and through the door, plus the room's own lights (an oil lamp in a niche, the oven's embers). A room renders at +3.1 EV over the outdoor exposure, as a camera adapts, and at 512 samples (its light is mostly bounced). Two lights stand in for what the closed shell would bounce: a soft warm panel low in the doorway (daylight off the sunlit ground outside) and a broad, dim warm panel under the roof (light off the floor and walls), without which the corners go black. The cut tops of the walls sit directly under the invisible walls, so no light reaches them: they glow faintly (`limestone(glow=)`) and read as a dark section through the wall, as in an architect's cutaway. The walls that block light are thinner than their tiles (0.45 m): at 40° a sunbeam drops a whole tile crossing a tile-thick wall, which would shut the morning sun out of any window. Dust shows in the sunbeams as a thin scattering volume confined to each beam: lit straight by the sun, it settles quickly (a volume filling the room did not, and the denoiser turned its noise into blotches).

**Keep cloth sheen tinted and light** (`cloth` in [`materials.py`](../../tools/art/lib/materials.py)). An untinted sheen reflects the blue sky across the whole garment and turns every dye grey: at weight 0.45 a brown robe rendered neutral grey (saturation 0.31 authored → 0.07 rendered). The sheen takes the dye's colour at weight 0.14, and wool is blended only 12% toward undyed fibre.

For review builds only, `VITE_ART_LIGHTING=day|late` forces a variant.

## 4. Render passes

**Places** ([`build_place.py`](../../tools/art/build_place.py)), for each lighting variant (rooms: `day` only; the story never shows the house after noon):

| Pass | What | How |
|---|---|---|
| Ground | Terrain, paving, earth, grass, floors, rugs, wall tops, the back wall of a room | Every standing thing is hidden from the camera but still casts shadows and bounces light, so all shadows and contact occlusion are baked in. Things shown only while a story condition holds (a donkey that leaves, a broom, bread left for the traveler) are left out entirely, so they leave no ghost shadow. |
| Shade mask | Sun visibility on the ground | White material override, sun only, ¼ resolution. The game dims and cools people who stand in shade. In rooms it only brightens people a little in the sunbeam (people there are lit by the indoor sheets). |
| Sprites | Each standing thing (house, wall, stall, tree, prop, animal, story prop) | Rendered alone with a render border around it. Everything else is invisible to the camera but still lights and shadows it, except the ground layer, which is a **holdout**: whatever of the thing is sunk into the terrain, a floor or the dust (a boulder's buried side, a jar's foot) is cut away rather than showing black where no light reaches. Cropped to its alpha and packed into 2048-pixel atlas pages. |

Three kinds of sprite need care:

- **Conditional** things carry their own shadow: a shadow-catching patch of ground under them is visible in their render, so the shadow comes and goes with them.
- **Flat** things lying on the ground (prints in the dust, drag marks, a broken jar, a mat) sort by their northern edge, so anyone standing on them draws over them. They are left out of the ground pass (their only shadow is a black patch under themselves), so they can change without re-rendering the ground, and they render with the scattered grit hidden (it would punch holes in them). Marks in the dust use `scuff`, a material that fades out at its edges, so they lie in the ground rather than on it.
- **Canopies** (a palm's crown, a fig's leaves) are sprites of their own, flagged `fade`, sorted with their trunk. The game fades them while the player walks behind them.

Occluders (a room's invisible walls and roof) are never seen by the camera in any pass.

**People** ([`build_people.py`](../../tools/art/build_people.py)), for each light:

- a colour sheet from the figure camera, without the ground;
- a shadow sheet from the world camera: the person is hidden from the camera and a shadow-catcher ground records their shadow. It is stored as an opaque cool tint on white and drawn with **multiply** blending, about a tenth of the size of an alpha channel. It fades out when the person stands in shade.
- **overlays** for story marks: the same frames showing only the mark (a bandage, the spare cloak, a water skin), rendered with the body as a **holdout**. Whatever the body hides stays hidden, and the game draws the overlay over the person.

Then every frame is **trimmed** to its visible pixels and packed into an atlas ([`lib/pack.py`](../../tools/art/lib/pack.py)). `people.json` records each frame as `[x, y, w, h, offsetX, offsetY]`, and the game restores each one to its full frame size (Phaser trimmed frames), so origins are unchanged and overlays line up exactly.

Not produced, because they wouldn't improve anything in this view: normal maps (all light is baked), separate albedo passes (lighting changes by swapping a variant), an emissive pass (lamps and embers are baked).

## 5. Sheets and naming

**Place:** `public/art/<scene-id>/`

- `ground-<variant>.webp`, `ground-<variant>-low.webp`, or tiles `ground-<variant>-x<i>y<j>.webp` (`-low-x<i>y<j>`) when bigger than 2048 px
- `shade-<variant>.webp`
- `sprites-<variant>-<page>.webp`
- `manifest.json` (and `peopleLight: "indoor"` for rooms)

**Sprite ids:**

- `<kind>-<x>-<y>` for map tiles or runs, for example `stall-11-6`, `palm-14-8` and its crown `palm-14-8-crown`
- `house-<x>-<y>`, `portico-<x>-<y>`, `wall-<x>-<y>` for structures
- `entity:<entity-id>` for story entities, so the game draws `vessels` from the atlas when that entity is visible
- `<id>#<n>` for slices of anything wider than a page

**People:** `public/art/people/`

| Sheet id | What |
|---|---|
| `player-look-N`, `<character>`, `crowd-N` | Standing (and walking, for the player and passers-by) |
| `<id>+torn-hem` | Standing with a mark that changes the body itself (a strip torn from the hem): a sheet of its own |
| `<id>~sit`, `<id>~lie` | At rest: rows down, left, right, up (lying: where the head is); columns idle, breath, talk |
| `<sheet>@<mark>` | An overlay for `<sheet>`: `@water-skin`, `@lamp`, `@cloak-roll`, `@bandaged`, `@wrapped-in-cloak` |
| `<sheet>@rag-bandaged-<rrggbb>` | Bandages torn from the player's tunic: one per tunic colour |

Files are `<sheet id>-<light>.webp` and `<sheet id>-shadow-<light>.webp`. Each entry carries its **appearance key** (`appearanceKey` in [`select.ts`](../../src/game/prerendered/select.ts)), its `pose`, its body `marks`, and for overlays `overlay: { mark, of, rag? }`. The game matches people by key, pose and marks (`pickSheets`), not by name.

**Standing sheet layout** (frame 44 × 68 game units, feet 62 units from the top):

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
| 5–12 | 8-frame walk, from left-foot contact. Only for the player and passers-by. |

Rest sheets: frame 84 × 96 units, the ground under the middle of the body 60 units from the top, drawn with the world camera (45°). The frame names the game uses are `<row>-<column>` and `turn-<diagonal>`.

## 6. Compression, download and caching

Everything is WebP, written by Blender:

| File type | Quality |
|---|---|
| Colour layers and sprite pages | 86–90 |
| Low-resolution ground | 84 |
| Shadow sheets | 62 (opaque tint, multiplied) |
| Shade mask | 90 |

WebP decodes in every current browser, including Safari 14+.

**What is cached, and when** (`workbox` in [`vite.config.ts`](../../vite.config.ts)):

- **Precached on install:** the morning (`day`) set of every place, every morning and indoor people sheet, and all manifests. One visit is enough to play the whole chapter offline.
- **Cached on first use:** later-day sets (`*-late*`). Offline before one has been seen, the loader draws the morning set in its place rather than painting the place (`loadPlace`, `loadPersons`).
- Anything that still fails to load falls back to the Canvas painters, and a warning goes to the diagnostics log.

Precaching every later-day set too would roughly double the install for light the player may never see; painting whole places offline would break the look. See §9 for the measured sizes.

**Camera:** pre-rendered places use the **close** framing (about 11.5 tiles across a landscape screen). Their art has the resolution for it. Painted places keep the standard framing, since their 2-px-per-unit art would blur. See `framingFor` in [`camera.ts`](../../src/game/systems/camera.ts). `VITE_CAMERA_FRAMING=standard` keeps the standard framing everywhere.

## 7. Adding things

Rebuild data first whenever characters or maps change: `npm run art:data`. It exports every available chapter's scenes (layout, legend, mood, kind, entities with the poses and marks their looks can show, and whether they are conditional) and characters (with where they appear).

**Another place** (for example a Chapter 2 scene):

1. `npm run art:data`.
2. If its legend has a tile kind no kit builds yet, add a `tile_<kind>` method (below). The build stops and names any kind without one.
3. If its `mood` is new, give it a ground palette in `GROUND` and `LAYER_LOOKS` ([`place.py`](../../tools/art/lib/place.py)) and a branch in `_materials` and `_structures` if its buildings differ.
4. Look at it quickly: `node scripts/art-build.mjs probe <scene-id> x0 y0 x1 y1 [ppu]` → `test-results/art-probes/`.
5. Render it: `node scripts/art-build.mjs place <scene-id>` (about 10–25 minutes).
6. Add the id to `PLACES_WITH_ART` in [`select.ts`](../../src/game/prerendered/select.ts) and `PLACES` in [`art-build.mjs`](../../scripts/art-build.mjs), then `npm run art:people` for everyone who appears there.
7. Add its files to the [asset manifest](asset-manifest.json).

The content test [`tests/content/art-assets.test.ts`](../../tests/content/art-assets.test.ts) then checks that the place list matches `public/art/`, its manifest is valid and matches the map, every story prop in it is pre-rendered, every tile kind it uses has a builder, everyone who appears has sheets for every pose and mark the story can show them in (in the right light), and every file is recorded in the asset manifest.

**Re-rendering part of a place.** A full place takes 10–40 minutes; a fix to one thing needn't redo the rest:

| Command | Re-renders | Keeps |
|---|---|---|
| `node scripts/art-build.mjs place <id> --only ground` | The ground and shade mask (terrain, paving, floors, water) | Every sprite |
| `node scripts/art-build.mjs place <id> --only conditional` | Things shown only while a story condition holds | Every other sprite (taken from the pages as they are and repacked), the ground |
| `node scripts/art-build.mjs place <id> --only sprites --sprites palm-2-0 entity:broom` | The named sprites (ids, or prefixes ending in `-`) | The rest, as above |
| `node scripts/art-build.mjs upgrade [<id>...]` | Nothing: brings an older render up to date (cuts its ground into tiles, adds half-resolution pages) | Everything |

A change to anything that casts shadows onto the ground (a building, a tree) needs the ground re-rendered too. Something lying on paving must rest on top of the stones (`floor_z`): hidden from the camera, the stones would otherwise leave it in total shadow.

**A new tile kind.** Each kind has one builder method, `tile_<kind>(self)`, on a kit mixed into `Place`:

| Kit | Kinds |
|---|---|
| [`kit_ground.py`](../../tools/art/lib/kit_ground.py) | `sand`, `scrub`, `grass`, `road`, `paving`, `steps`, `floor`, `rug`, `mat`, `bedroll`, `wadi`, `mud`, `soil`, `water`, `hill`, `cliff` |
| [`kit_masonry.py`](../../tools/art/lib/kit_masonry.py) | `gate`, `fence` (and the city's houses, city wall, paving and steps) |
| [`kit_props.py`](../../tools/art/lib/kit_props.py) | `stall`, `jars`, `sacks`, `basket`, `crate`, `well`, `oven`, `tent`, `trough`, `cloth`, `cart`, `table`, `loom`, `rock`, `cairn` (and the story entities, `entity_<sprite>`) |
| [`kit_plants.py`](../../tools/art/lib/kit_plants.py) | `olive`, `palm`, `fig`, `bush`, `reeds`, `crops` |
| [`place.py`](../../tools/art/lib/place.py) | `wall`, `roof`, `door`, `void` (built with their region by the style's structure builder) |
| [`kit_mudbrick.py`](../../tools/art/lib/kit_mudbrick.py), [`kit_interior.py`](../../tools/art/lib/kit_interior.py) | The oasis's houses, porticos and courtyard walls; a room in cutaway |

A builder reads `self.map` (tiles, runs, neighbours), builds geometry with the shared helpers (`self.P` for points on the terrain, `_lathe`, `_ellipsoid`, `_branch`, `boulder`, `rocks.stone`, materials in [`materials.py`](../../tools/art/lib/materials.py)), and either adds sprites with `self.sprite(id, base_row, objects, tiles, fade=?, flat=?)` or puts ground dressing in the ground layer with `self.to_ground(obj)` or a scatter emitter (`self.emitter` plus [`scatter.py`](../../tools/art/lib/scatter.py)). Walkable kinds also need a ground layer in `GROUND`. Give the method a docstring saying what it builds, and add the kind to the table above.

**A story entity's prop.** Add `entity_<sprite>(self, name, x, y, e)` to [`kit_props.py`](../../tools/art/lib/kit_props.py) (dashes in the sprite name become underscores). Return the objects, or `(objects, base_in_game_units, flat)` for something lying on the ground.

**Another character.** Give them an `appearance` in the chapter content, then `npm run art:data` and `npm run art:people`. The people job plans from the chapter data: standing sheets for everyone who stands, rest sheets for anyone whose looks sit or lay them down, overlays for every mark their looks can show, the indoor light for anyone who appears in a room, and passers-by for places with a crowd. It renders only what `people.json` doesn't have yet.

The generator is parametric. It reads the appearance (build, skin, hair, beard, robe and stripe colours, head covering, what they carry) and builds, rigs and renders the person. New kinds of clothing, carried items or marks go in [`tools/art/lib/people.py`](../../tools/art/lib/people.py): a mark's parts are tagged `Part(..., mark="<mark>")` so they can be rendered as an overlay. Marks that change the body rather than add to it (a torn hem) go in `BASE_MARKS` ([`build_people.py`](../../tools/art/build_people.py)) and `BODY_MARKS` ([`select.ts`](../../src/game/prerendered/select.ts)) and get a sheet of their own.

## 8. Rendering in the game

[`src/game/prerendered/`](../../src/game/prerendered/) and [`world-scene.ts`](../../src/game/scenes/world-scene.ts):

1. **Load** (`prepareArt` in [`figures.ts`](../../src/game/prerendered/figures.ts)). The place's manifest, the variant for the story hour, the resolution for the zoom, and every sheet the people present might need (`sheetsToLoad`: all sheets of their appearances, and passers-by where the place has a crowd), all through Phaser's loader. Loading everyone's sheets up front means that when the story changes how someone looks (a bandage, the spare cloak, sitting up) the figure is ready at once.
2. **Release.** Textures of the place before are released on the first frame nothing draws them (`beginPlace`), so memory holds one place at a time.
3. **Composite.** The ground is one image per tile. Each sprite is an image from an atlas page, anchored at its bottom centre, with depth set by its ground line (`depthRow`). People are sprites with a baked shadow sprite and depth by their feet; their story marks are overlay sprites kept in step frame by frame just above them (`attachLayers`).
4. **Behaviour.** Turning passes through the diagonal frames (70 ms each). Standing in shade tints a person toward the shade colour, sampled from the shade mask. Canopies fade to 38% while the player is behind them (`CanopyFader`, `behindCanopy`).
5. **Fallback.** If anything fails to load, the place or person is painted by Canvas as before, and a warning goes to the diagnostics log. The canvas carries `data-art="prerendered:<variant>"` or `data-art="painted"`, and `data-texture-mb` with the texture memory in use.

## 9. Measurements

Measured on the art in `public/art/` as rendered (September 2026). Texture memory is what the files decode to on the GPU: RGBA, uncompressed, width × height × 4 bytes. The **full** set is what desktops and tablets load; the **low** set (half resolution: a quarter of the pixels) is what phones and devices that asked for simpler effects load.

| Place | Light | Download, full set | Download, low set | Textures, full | Textures, low | Ground tiles (full / low) | Sprite pages |
|---|---|---|---|---|---|---|---|
| Aunt Miriam's house | morning | 0.15 MB | 0.04 MB | 8.2 MB | 2.3 MB | 1 / 1 | 1 |
| Lower market | morning | 1.07 MB | 0.38 MB | 43.6 MB | 12.2 MB | 4 / 1 | 1 |
| | later day | 1.01 MB | 0.37 MB | 43.6 MB | 12.2 MB | 4 / 1 | 1 |
| Road down to Jericho | morning | 1.79 MB | 0.61 MB | 58.4 MB | 17.0 MB | 6 / 2 | 1 |
| | later day | 1.59 MB | 0.61 MB | 58.4 MB | 17.0 MB | 6 / 2 | 1 |
| Jericho | morning | 2.20 MB | 0.76 MB | 49.7 MB | 13.6 MB | 4 / 1 | 2 |
| | later day | 1.95 MB | 0.70 MB | 48.7 MB | 13.4 MB | 4 / 1 | 2 |
| People (every sheet, shadow and overlay) | morning and indoor | 3.83 MB (107 files) | | | | | |
| | later day | 2.36 MB (76 files) | | | | | |

**Phones** load about 28% of the texture memory desktops do (a place's low set is 12–17 MB against 44–58 MB). People sheets are the same on every device.

**In the game**, the texture memory the canvas reports (`data-texture-mb`: every texture loaded, including people, passers-by and the game's own) with one place in memory at a time, from the review captures (§10; headless Chromium drawing with the Mac's GPU):

| Place | Desktop and tablet (full set) | Phone (low set) |
|---|---|---|
| Aunt Miriam's house | 16–32 MB | 10–26 MB |
| Lower market | 98–101 MB | 67–69 MB |
| Road down to Jericho | 89 MB | 47 MB |
| Jericho, morning | 104 MB | 68 MB |
| Jericho, later day | 122 MB | 87 MB |

People (and the game's own textures) make up 30–55 MB of each figure, most where there are passers-by: their sheets are full resolution on every device, and the later-day shadows are long. Half-resolution people sheets for phones, and GPU-compressed textures, are the next savings.

Before this work only the market was pre-rendered and nothing was released: by Jericho the painted chapter held about 100 MB of textures.

**Offline and caching.** The service worker precaches **10.6 MB of art**: every place's morning set (full and low, 6.8 MB), every morning and indoor person (3.8 MB) and the manifests; with the code, the whole precache is 170 files, 12.9 MB (`npm run build`). The later-day sets (5.8 MB of places, 2.3 MB of people) are cached the first time they are shown. So:

- after one visit online, the whole chapter plays offline, every place pre-rendered;
- once a later-day scene has been seen, it too works offline; before that, offline, the morning set stands in for it (the place is never painted);
- a player who never reaches the afternoon never downloads its light.

Caching the morning sets on first use instead would save the install about 10 MB, but a player who lost the connection on the road would then see Jericho painted. Precaching the later-day sets too would add 8 MB for light some players never see. Both resolutions of the morning sets are precached (the low one adds 1.8 MB) because a desktop can switch to the low set mid-chapter, offline, when it runs slowly.

## 10. Review captures

```bash
# Every place at fixed positions on two routes (help: leave supplies; tend: bandages, the cloak, a torn hem),
# at desktop, tablet and phone sizes, with how each place was drawn and its texture memory:
E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/place-art.spec.ts --project=desktop-chromium
#   → test-results/place-art/<set>/<viewport>-<route>-<nn>-<name>.png and <viewport>-<route>-art.txt

# The market at fixed positions (the capture set the prototype report compares):
E2E_SHOTS=1 ART_SHOTS=after-close npx playwright test e2e/market-art.spec.ts --project=desktop-chromium

# The whole chapter in every presentation variant
E2E_SHOTS=1 npx playwright test e2e/visual-tour.spec.ts --project=desktop-chromium   # → test-results/tour/

# Frame rate, frame pacing, load and transition times, texture memory
PERF_MARKET=1 PERF_LABEL=after npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
```

On a Mac, `place-art.spec.ts` has Chromium draw with the real GPU (Metal): with the software renderer headless Chromium uses otherwise, the game runs slowly enough to switch to its low-power, half-resolution art after the first place, and the captures would not show what players see. Playwright empties `test-results/` at the start of each run: copy a capture set elsewhere before running again. For "before" images of an older build, run the same specs from a git worktree of that commit.

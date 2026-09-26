# Technical art guide: pre-rendered 3D-to-2D places and people

This guide is for anyone adding art to the game with the offline Blender pipeline in [`tools/art/`](../../tools/art/). Every place in Chapter 1 is pre-rendered: Aunt Miriam's house (`miriam-house`), the lower market (`jerusalem-market`), the road down to Jericho (`jericho-road`) and Jericho (`jericho`). So is every place in Chapter 2, built with the lake kit (§7): Grandmother Shelomit's house (`shelomit-house`), the shore at Capernaum (`capernaum-shore`) and the open lake (`open-lake`), in the afternoon and by night (§3). So is every place in Chapter 3, built with the village kit and shown in the lights its story shows them in, night included: Tamar's house (`tamar-house`, by day and by lamplight), the lanes of Bethlehem (`bethlehem-lanes`) and the fold below the village (`shepherds-fields`), both from mid-afternoon into the night. So is every place in Chapter 4, built with the Roman kit (§7): Ammia's dye workshop (`ammia-workshop`), a street in Colossae (`colossae-street`), the Laodicea road in the Lycus valley (`lycus-road`) and Philemon's house (`philemon-house`). Places without art are still painted at runtime by [`src/game/art/`](../../src/game/art/), and so is anyone the art can't draw.

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
| `night` | A bright moon in the south-south-east, 46° up: a dim, cool blue key with soft shadows, under a clear night sky (deep blue, darker overhead, with stars that show only in water). Rendered at +2.2 EV, as the eye adapts. The place's own fires and lamps, lit only at night, carry the warmth. | Places and people from 18:00 (dusk) until 05:00 |
| `indoor` | No sun: a warm key from a lamp high to the front left, cool soft daylight from a window on the right, warm light bounced off the plaster behind, a dim warm room for the sky | People in rooms by day (the place's manifest says `peopleLight: "indoor"`) |
| `overcast` | Rain cloud: an even grey sky, brighter overhead than at the horizon, and only a faint, very soft brightening where the sun is behind the cloud (a sun 50° wide). Shadows are soft pools under things. +1.3 EV. | The Laodicea road (walked as the rain comes; the game draws the rain) and the people there |
| `dusk` | Lamp-lighting: no sun, a deep blue evening sky (seen in a room only through its openings: Philemon's house is open to it over its garden), and the place's own lamps | Philemon's house |
| `lamp` | People at lamp-lighting: a warm key from a lampstand high to the front left, a dimmer warm lamp behind to the right, the last blue of the sky from above, a dark room | People at the gathering (`peopleLight: "lamp"`), and in Tamar's house by its lamps at night (its `night` set's `peopleLight`) |
| `lamplight` | A room at night: its lamps and the oven's embers; the moon through the door faint beside them, the daylight stand-ins dimmed to a warm lamp-bounce. +0.8 EV over the room's step. | Shelomit's house at night (people there are lit by `lamp`: its `night` set's `peopleLight`) |

The sky is Blender's multiple-scattering sky, set for the same sun. It gives the cool fill in shade. Colour management is AgX at −1.4 EV.

**A place is rendered only in the lights its story shows it in** (its light plan, below; default: morning and later day outdoors, morning in a room). Tamar's house is seen by day and at night; the lanes and fields of Bethlehem from mid-afternoon into the night, so their day set is rendered in the later-day light and they have no morning. The game draws the nearest light a place has (`variantFor`), and **re-lights a place while you are in it** when the story clock crosses into another light it has (`relightTo`; the sun sets while you carry the lamb back to the fold): it loads that set and rebuilds the place around everyone where they stand, fading through.

**Things that exist only in some lights** are tagged with the lights they belong to, `obj["variants"] = "night"` (or `"day,late"`); `build_place.py` leaves them out of every other light (`only_in`). At night the lamps in the niches, on the table and by the travellers' bedding are lit, doors are shut (lamplight at the cracks where someone is in), windows glow, and the daylight bounced in at a door is gone. Fires and lamps also go in `Place.flicker`, with the lights they burn in: the manifest lists them per set (`lights`: kind, centre, radius, strength), and the game draws a flickering pool of warm light over each, so the baked glow of a campfire or a lamp moves ([`ambient.ts`](../../src/game/scenes/ambient.ts), from the site's light spots).

**The night bake and the game's grade.** The game grades night on top of any art: a multiply layer (blue-grey, darker at the edges) and a post-processing grade (less saturation, a blue white balance, bloom on bright lamps). Over a night bake the multiply is gentled (`overBakedArt`: 30% strength, the vignette at most 0.42), so the art is not darkened twice but still gathers the dark round the lamps; bloom makes the fire and lamps glow. Day art shown at night (a Chapter 1 place after dark) keeps the full night. Look at a night set's ground after rendering it: once, on a GPU shared with another render, the fold's night ground came out with its terrain unlit (only the scattered grass caught the moon: a median of 1 of 255 against 29 when rendered again), and nothing else flags that.

**A fire burning in day and night sets** needs its own night version. Night is rendered 2.2 EV brighter, so the day's fire (150 W a hand above the coals) blew the shepherds' ring of stones out to near white, and the game's bloom added more. The campfire (`tile_campfire` in [`kit_village.py`](../../tools/art/lib/kit_village.py)) has a separate night light (55 W, set a little higher and as wide as the flames, so its falloff is flatter and its shadows soft), and night copies of its flames and embers (a third of the emission) and of its ring (soot-blackened stone), each tagged with its lights (`_by_light`).

**Rooms** are lit as if closed: their side and front walls and their roof are *occluders*, invisible to the camera but blocking light (§4). Light comes in only through the openings: the sun through a window in the east wall and through the door, plus the room's own lights (an oil lamp in a niche, the oven's embers). A room renders at +3.1 EV over the outdoor exposure, as a camera adapts, and at 512 samples (its light is mostly bounced). Two lights stand in for what the closed shell would bounce: a soft warm panel low in the doorway (daylight off the sunlit ground outside) and a broad, dim warm panel under the roof (light off the floor and walls), without which the corners go black. The cut tops of the walls sit directly under the invisible walls, so no light reaches them: they glow faintly (`limestone(glow=)`) and read as a dark section through the wall, as in an architect's cutaway. The walls that block light are thinner than their tiles (0.45 m): at 40° a sunbeam drops a whole tile crossing a tile-thick wall, which would shut the morning sun out of any window. Dust shows in the sunbeams as a thin scattering volume confined to each beam: lit straight by the sun, it settles quickly (a volume filling the room did not, and the denoiser turned its noise into blotches).

**A village house** (`kit_village.py`) is lit the same way, with more openings: a hatch in the roof where the ladder goes up (a shaft of sun onto the back wall by day, of moonlight at night) and a window in the guest room's east wall. The animals' end lies 0.45 m below the family floor, its mangers standing on it. At night the room is lit only by its lamps (four niches, the table, a stand in the guest room) and the glowing oven: the bounced daylight is gone, the door is shut (its planks cut down to a stub like the walls, the whole door an occluder), and it renders at +1.2 EV over the day's room. Its cut wall tops glow less at night, or they would outshine the lamps.

**Keep cloth sheen tinted and light** (`cloth` in [`materials.py`](../../tools/art/lib/materials.py)). An untinted sheen reflects the blue sky across the whole garment and turns every dye grey: at weight 0.45 a brown robe rendered neutral grey (saturation 0.31 authored → 0.07 rendered). The sheen takes the dye's colour at weight 0.14, and wool is blended only 12% toward undyed fibre.

For review builds only, `VITE_ART_LIGHTING=day|late` forces a variant.

### The story's light, place by place (light plans)

Every place's art is a set of **lighting sets** in its manifest, keyed `day`, `late` and `night` by *when in the story* they are shown: the game draws `night` from 18:00 until 05:00 when the place has one, else `late` from 15:00 when it has one, else `day`, else the earliest set it has (`variantFor` in [`select.ts`](../../src/game/prerendered/select.ts)), and changes set while you are there when the clock crosses into another (`relightTo`). The story clock runs past midnight (26 is 2 a.m.). A place needs at least one set, not every one: the open lake has only `night`. Which **light** each set is rendered in, and how **people** are lit there, is the place's **light plan**:

| Place | Plan (set → light) | People (`peopleLight`) | Why |
|---|---|---|---|
| any room (default) | `{day: day}` | `indoor` | Rooms are seen by day; people are lit by the room's lamp and window |
| any outdoor place (default) | `{day: day, late: late}` | *(none: each set's sun)* | Morning and later-day sun |
| `lycus-road` | `{day: overcast}` | `overcast` | Walked only from hour 11 to 14, as the rain comes down the valley |
| `philemon-house` | `{day: dusk}` | `lamp` | Only ever seen at lamp-lighting (hour 18) |
| `capernaum-shore` | `{late: late, night: night}` | *(none: each set's light)* | Loading the boat from hour 16 (later day); putting out at 18 and coming home at 2 a.m., hour 26 (night) |
| `open-lake` | `{night: night}` | *(none)* | Crossed from sunset into the night |
| `shelomit-house` | `{late: late, night: lamplight}` | `{late: indoor, night: lamp}` | The afternoon the story begins, and the night; its window faces the later-day sun (west) |
| `tamar-house` | `{day: day, night: night}` | `{day: indoor, night: lamp}` | A house by day, and by its lamps when the shepherds come in the night |
| `bethlehem-lanes`, `shepherds-fields` | `{day: late, night: night}` | `{day: late, night: night}` | From mid-afternoon (hour 16) into the night: the sun sets while you are in the fields |

To give a place its own light:

1. **The light** (if it is new): add it to `LIGHTS` in [`lighting.py`](../../tools/art/lib/lighting.py): a sun (`azimuth`, `elevation`, `strength` — 0 for none —, `color`, `angle`: a wide angle is a soft, cloudy sun), a sky (`sky`: a gradient of `zenith`, `horizon` and `ground` colours, or none for the physical clear sky; `sky_strength`), an exposure step `ev`, and where the **shade mask** comes from: `shade` = `sun` (default), `sky` (how much sky a point sees) or `lamps` (the place's own lights), and `shade_floor`, the least light the mask gives (people standing in the darkest spot are tinted to it).
2. **The plan**: add the place to `PLACE_LIGHTS` in the same file: `"<scene id>": ({"day": "<light>"[, "late": "<light>"][, "night": "<light>"]}, people)`, where people is one people light for the place, a people light per set (`{"day": "indoor", "night": "lamp"}`: written to each set's `peopleLight`), or None (each set's sun). `Place.light_plan` and `Place.people_light` read it, so every kit sees it (the Roman kit lays wet stone under `overcast` and opens a room's roof to the evening sky under `dusk`).
3. **People**: if the people light is new, add a `setup_<name>` for it in `lighting.py` (as `setup_indoor` and `setup_lamp`: lights set around a person at the origin), a shadow box for it in `SHADOW_BOX` and `REST_SHADOW_BOX` ([`build_people.py`](../../tools/art/build_people.py)), and its name to `PEOPLE_LIGHTS` and to `peopleLight`, `sheets` and `shadows` in [`manifest.ts`](../../src/game/prerendered/manifest.ts) (the loader falls back from `lamp` to `indoor`, then to the morning's sheets: `pick` in [`loader.ts`](../../src/game/prerendered/loader.ts)).
4. Render the place and its people (in either order): the people job reads each place's `manifest.json`, or its light plan while it has none, and renders exactly the lights it names for everyone seen there.

**Porting dusk, night or lamp light from another branch**: name the light in `LIGHTS`, the place in `PLACE_LIGHTS`, and let the kits read `self.light_plan` / `self.people_light` rather than a chapter or scene id. A place has up to three sets: `day`, `late` (drawn from 15:00) and `night` (drawn from 18:00 until 05:00), and at least one. A place seen by day and at night is `{"day": "day", "night": "night"}`, one seen only at night `{"night": "night"}` (the open lake). Chapters 2 and 3 share one `night` light (the moon), so that people's night sheets suit both; a room at night may have its own (`lamplight`, Shelomit's house). Things that exist in some lights only (a flame after dark and a dark wick by day, the daylight bounced in at a door) are tagged with those lights (`obj["variants"]`, the names of lights, not of sets: `"night,lamplight"`), and fires and lamps the game should make flicker go in `Place.flicker` with the lights they burn in.

A place whose story light changes within one set (a storm rising while you stand there) keeps one plan; the game's own weather, grade and lamp glow ([`weather.ts`](../../src/game/systems/weather.ts), [`grade.ts`](../../src/game/systems/grade.ts), [`lighting.ts`](../../src/game/systems/lighting.ts)) do the rest. The engine also darkens and cools any place in rain and after dark, so a place baked in rain cloud or lamplight should be baked a little brighter than it will look.

**Tests and the engine.** [`art-assets.test.ts`](../../tests/content/art-assets.test.ts) reads each place's manifest and checks, set by set, that everyone seen there has sheets in its people light (the set's own, else the place's, else the set's sun), that a room's people light is its own (`indoor` or `lamp`) in every set while an outdoor place's never is, and that its flickering lights are inside it. [`prerendered.test.ts`](../../tests/unit/game/prerendered.test.ts) covers `variantFor`, `relightTo`, `peopleLightFor` and the manifest schema.


## 4. Render passes

**Places** ([`build_place.py`](../../tools/art/build_place.py)), for each set of the place's light plan (§3; rooms: `day` only, the story never shows Miriam's house after noon):

| Pass | What | How |
|---|---|---|
| Ground | Terrain, paving, earth, grass, floors, rugs, wall tops, the back wall of a room | Every standing thing is hidden from the camera but still casts shadows and bounces light, so all shadows and contact occlusion are baked in. Things shown only while a story condition holds (a donkey that leaves, a broom, bread left for the traveler) are left out entirely, so they leave no ghost shadow. |
| Shade mask | Light on the ground | White material override, ¼ resolution: the sun only, or for `overcast` the sky only (sky visibility, compressed to 70–100%), or for `dusk` and `lamplight` the lamps only (their pools on the floor, 42–100% and 40–100%), or for `night` all the light there is (the moon, and the place's fires and lamps; in a room at night its lamps, floored at 40%). The game dims and cools people who stand out of the light: at night, people far from any fire or lamp, or in a room's dark corners. In daylight rooms it only brightens people a little in the sunbeam (people there are lit by the indoor sheets). |
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
| `<sheet>@<mark>` | An overlay for `<sheet>`: `@water-skin`, `@lamp`, `@cloak-roll`, `@bandaged`, `@wrapped-in-cloak`, `@letter-case` |
| `<id>.<chapter>` | Someone whose name another chapter also uses for a different person (`kallias.letter-from-paul`): sheet ids name the chapter too |
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
| [`kit_mudbrick.py`](../../tools/art/lib/kit_mudbrick.py), [`kit_interior.py`](../../tools/art/lib/kit_interior.py) | The oasis's houses, porticos and courtyard walls; a room in cutaway (its window faces the room's daylight in its light plan: east for the morning, west for the later-day sun) |
| [`kit_lake.py`](../../tools/art/lib/kit_lake.py) (with [`lake_boats.py`](../../tools/art/lib/lake_boats.py), [`lake_houses.py`](../../tools/art/lib/lake_houses.py), [`lake_materials.py`](../../tools/art/lib/lake_materials.py)) | The Sea of Galilee (Chapter 2; the `lake` style: any scene with lake water or a boat's deck): `shingle`, `deck`, `jetty`, `lake`, `shallows`, `boat`, `hull`, `mast`, `nets`, `rack`; the story props `fish-jars`, `bailer`, `rope`, `oar`, `net-pile`, `floating-jars`, `towline`, `fish-basket` (and lakeside versions of `lamp` and `vessels`); Capernaum's basalt houses, basalt lanes, rocks, salt sacks and brine tubs; basalt walls and a cobbled floor for a Galilee room |
| [`kit_village.py`](../../tools/art/lib/kit_village.py) | A Judean hill village (Chapter 3): `straw`, `platform`, `manger`, `hay` (a village house's animals' end and family floor), `threshing`, `terrace`, `sheepfold`, `sheep`, `campfire`; and, in a village, its own `steps`, `gate`, `fence`, `trough`, `soil`, `crops`, `sand`, `paving`, `bedroll`, `bush`, `rock`, `mud`, `wadi`, `hill`; its houses of coursed limestone with flat earthen roofs, the village wall and gate, a field hut, a house in cutaway with its roof hatch; animals (sheep, the speckled lamb, goats, donkeys) and Chapter 3's story props |
| [`kit_roman.py`](../../tools/art/lib/kit_roman.py) (with `roman_*.py`) | Greco-Roman towns of Asia (Chapter 4, `ROMAN_CHAPTERS`): `tile-roof`, `column`, `vat`, `amphorae`, `couch`, `milestone`, `travertine`, `garden`, `lampstand`, `fountain`, `mosaic`, `roman-road`, `bridge`; Roman versions of `table`, `oven`, `cloth`, `bush`, `hill`, `grass`, `crops`, `water`, `fence`, `gate`, `sand`, `scrub`, `floor`, `rug`, paving, the structures of each style (a town frontage and stoa, farm buildings under tile roofs, rooms with Roman walls and floors) and the story props `wool`, `tablets`, `letter-sheets`, `letter-bundle`, `vessels` (the alum jars) and `pack-donkey` (a mule) |

**The village kit.** A place is a village when its map uses any of the kit's own kinds (`VILLAGE_KINDS`: straw, manger, sheepfold, terrace, campfire…). Like the Roman kit it is mixed in ahead of the shared kits, and every override starts with `if not self.village: return super()…`, so no other place changes. Its hooks into [`place.py`](../../tools/art/lib/place.py): `ground_spec` (the ground layers of the lanes, the pasture or the house, `VILLAGE_GROUND`, and their looks, `VILLAGE_LOOKS`), `shape_mask` (layers that follow more than their tiles: the fold's trampled ground spilling out of its gate, ash round the fire, a ragged patch of mud round the trough, trodden ways in the house), and `shape_heights` (the animals' end of a house 0.45 m below the family floor, fields stepped down the hill by vertical terrace walls, the gully falling to its cistern). Some choices worth knowing:

- **Animals are one smooth body.** A sheep, lamb or goat is a single lofted barrel (`_barrel`: superellipse plan and section, broad over the rump), not joined ellipsoids, whose seams showed as creases; the neck is a tapered column with a rounded end. The fleece is soft locks with light crevices (`fleece`): deep dark crevices read as popcorn from above.
- **A house fills exactly its own tiles on screen**: its north wall stands one row in from its top row (`min(n + height, gy - 1)`), so nobody in the lane behind it is hidden.
- **Things of one light only** (lamps lit at night, doors open by day and shut at night, the day's bounced light in a room) are tagged with the lights they belong to, and fires and lamps that should flicker go in `Place.flicker` (see §3).

**The lake.** Every surface people stand on is the terrain, so `P` always finds it: the beach slopes to a waterline that wanders a little across the tiles (a warped, blurred reading of the map), the jetty's blocks stand on a raised strip (the terrain is the bottom of their joints: `floor_z` lifts things set on it), a boat's deck is a plateau inside its bulwarks, and under the water the bed shelves away (going south it never falls more than a tile per tile, so no mesh folds). The water is one flat, refracting surface (not casting shadows) over a principled volume that absorbs red first and scatters a little blue-green, far larger than the map so no ray finds its sides; a lacy band of foam and a wet dark band of pebbles follow the waterline (a contour of the heights). Standing things are sheared by the height of what they stand on (`_at(x, y, z, base)`), never by their own height. Floating hulls are cut at the waterline: the part above is the boat's sprite, the part below goes into the ground, seen dimly through the water. Neighbouring `boat` tiles make one boat after the Ginosar boat, growing toward its proportions only over water (never over ground anyone walks on); drawn up on the beach it rests on its keel, mast lowered. The boat offshore that a crowd on the beach faces has a goat-hair shade rigged over it, so no one aboard can be seen; the boat you are aboard is cut into two sprites per map row (its stern and bow halves: between them a row holds only deck). The lake is baked calm: the game draws the wind, the rain and the storm's swell over it (its water shader covers `lake` and `shallows` tiles, with a darker sky and deep colour in a `night` set: `waterSky` in [`water.ts`](../../src/game/systems/water.ts)).

**The Roman kit.** A place is Roman when its chapter is in `ROMAN_CHAPTERS`. It keeps the style its mood gives it (the street is `city`, the road `oasis`, the rooms `home`), so every shared builder still works; the kit, mixed in ahead of the others, overrides only what differs and calls the shared builder for any other place. It is split by subject: [`roman_geom.py`](../../tools/art/lib/roman_geom.py) (helpers, shared materials), [`roman_materials.py`](../../tools/art/lib/roman_materials.py) (stucco, roof tile, marble, bronze, dyes, river water, paving, opus signinum, mosaic, fresco, travertine, wool, papyrus, and the pattern images drawn by code: a mosaic's design, a painted wall, a milestone's worn lines), [`roman_arch.py`](../../tools/art/lib/roman_arch.py) (tile roofs of tegulae and imbrices with antefixes, the Ionic order, house fronts, doors, windows), [`roman_props.py`](../../tools/art/lib/roman_props.py), [`roman_town.py`](../../tools/art/lib/roman_town.py), [`roman_valley.py`](../../tools/art/lib/roman_valley.py) and [`roman_rooms.py`](../../tools/art/lib/roman_rooms.py). Kinds with a dash are built by `tile_` plus the kind with underscores (`tile-roof`: `tile_tile_roof`).

Some choices worth knowing:

- **Raised floors register like terrain.** A floor that people stand on above the ground (the stoa's stylobate, the bridge's deck) is sheared as the terrain is (`Q`, `QT`: a point at height h is placed h tiles south), so it shows over its own tiles and people walking on it look right; anything standing on it stands at the sheared point.
- **The travertine** is shaped by the terrain (`terrain.RISE['travertine']`) and skinned with its own mesh, stepped into level pools behind scalloped rims (quantized upward, so the skin always lies over the terrain), with `wet` and `depth` attributes the material turns into water.
- **Philemon's house in cutaway**: like its walls, the peristyle's roof and the beams that carried it are cut away, so the columns stand to their capitals and nobody at the gathering is hidden behind a beam; the tops of the abaci are cut sections and glow faintly, like the walls' cut tops (`_ionic_column(cut_top=True)`). The invisible roof is open over the garden, so the evening sky lights it. The colonnade's far (north) row stands between the camera and the room where the gathering is, and every column sorts true: nobody at the gathering stands one or two rows north of a column in line with it, where its shaft would hide their legs (a content rule, checked in [`letter-from-paul.test.ts`](../../tests/content/letter-from-paul.test.ts)). An earlier render sorted that row 1.3 rows north of its base instead, a cheat that drew people behind it in front of the shafts.
- **Decals** (spilt clay, dye splashes, wet floor) are seen by the camera only: bounce, shadow and occlusion rays pass them by, so their see-through margins leave no dark square in the floor's grime. Each is an irregular ellipse (`_decal`), not a rectangle, faded out before its rim: the denoiser's albedo guide sees a decal's whole outline, and a square one printed a faint square on the ground. Decals are tagged (`obj["decal"]`) and left out of every sprite render ([`build_place.py`](../../tools/art/build_place.py)): as a see-through holdout, a decal still left a faint ghost of itself in the alpha of any sprite whose box reached it, which showed as a pale rectangle round the thing in the game.

A builder reads `self.map` (tiles, runs, neighbours), builds geometry with the shared helpers (`self.P` for points on the terrain, `_lathe`, `_ellipsoid`, `_branch`, `boulder`, `rocks.stone`, materials in [`materials.py`](../../tools/art/lib/materials.py)), and either adds sprites with `self.sprite(id, base_row, objects, tiles, fade=?, flat=?)` or puts ground dressing in the ground layer with `self.to_ground(obj)` or a scatter emitter (`self.emitter` plus [`scatter.py`](../../tools/art/lib/scatter.py)). Walkable kinds also need a ground layer in `GROUND`. Give the method a docstring saying what it builds, and add the kind to the table above.

**A story entity's prop.** Add `entity_<sprite>(self, name, x, y, e)` to [`kit_props.py`](../../tools/art/lib/kit_props.py) (or the kit of its chapter's world, like [`kit_village.py`](../../tools/art/lib/kit_village.py)) (dashes in the sprite name become underscores). Return the objects, or `(objects, base_in_game_units, flat)` for something lying on the ground.

**Another character.** Give them an `appearance` in the chapter content, then `npm run art:data` and `npm run art:people`. The people job plans from the chapter data: standing sheets for everyone who stands, rest sheets for anyone whose looks sit or lay them down, overlays for every mark their looks can show, in every light the places they appear in were rendered in (a room's morning is `indoor`, its night `lamplight`; read from each place's manifest, so render the places first), and passers-by for places with a crowd. It renders only what `people.json` doesn't have yet.

The generator is parametric. It reads the appearance (build, skin, hair, beard, robe and stripe colours, head covering, what they carry) and builds, rigs and renders the person. New kinds of clothing, carried items or marks go in [`tools/art/lib/people.py`](../../tools/art/lib/people.py): a mark's parts are tagged `Part(..., mark="<mark>")` so they can be rendered as an overlay. Marks that change the body rather than add to it (a torn hem) go in `BASE_MARKS` ([`build_people.py`](../../tools/art/build_people.py)) and `BODY_MARKS` ([`select.ts`](../../src/game/prerendered/select.ts)) and get a sheet of their own.

## 8. Rendering in the game

[`src/game/prerendered/`](../../src/game/prerendered/) and [`world-scene.ts`](../../src/game/scenes/world-scene.ts):

1. **Load** (`prepareArt` in [`figures.ts`](../../src/game/prerendered/figures.ts)). The place's manifest, the variant for the story hour, the resolution for the zoom, and every sheet the people present might need (`sheetsToLoad`: all sheets of their appearances, and passers-by where the place has a crowd), all through Phaser's loader. Loading everyone's sheets up front means that when the story changes how someone looks (a bandage, the spare cloak, sitting up) the figure is ready at once.
2. **Release.** Textures of the place before are released on the first frame nothing draws them (`beginPlace`), so memory holds one place at a time.
3. **Composite.** The ground is one image per tile. Each sprite is an image from an atlas page, anchored at its bottom centre, with depth set by its ground line (`depthRow`). People are sprites with a baked shadow sprite and depth by their feet; their story marks are overlay sprites kept in step frame by frame just above them (`attachLayers`).
4. **Behaviour.** Turning passes through the diagonal frames (70 ms each). Standing in shade tints a person toward the shade colour, sampled from the shade mask. Canopies fade to 38% while the player is behind them (`CanopyFader`, `behindCanopy`). The fires and lamps the manifest lists for the light flicker: a warm pool drawn over each (at night; a small glow by day). A night bake has no painted lamplight at every door (the lit doors are in the art).
5. **Relight.** When the story clock crosses into another light the place has (`relightTo`), the world loads that set and rebuilds the place around everyone where they stand (never while a scene is loading: it waits a moment, and a scene change wins).
6. **Fallback.** If anything fails to load, the place or person is painted by Canvas as before, and a warning goes to the diagnostics log. The canvas carries `data-art="prerendered:<variant>"` or `data-art="painted"`, and `data-texture-mb` with the texture memory in use.

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
| Grandmother Shelomit's house (Ch. 2) | later day | 0.20 MB | 0.07 MB | 7.4 MB | 2.1 MB | 1 / 1 | 1 |
| | lamplight (night) | 0.14 MB | 0.06 MB | 7.4 MB | 2.1 MB | 1 / 1 | 1 |
| The shore at Capernaum (Ch. 2) | later day | 2.21 MB | 0.86 MB | 65.3 MB | 18.3 MB | 6 / 2 | 2 |
| | night | 1.68 MB | 0.66 MB | 64.1 MB | 18.0 MB | 6 / 2 | 2 |
| The open lake (Ch. 2) | night (its only set) | 0.35 MB | 0.15 MB | 61.4 MB | 16.9 MB | 4 / 1 | 2 |
| Ammia's dye workshop (Ch. 4) | morning | 0.19 MB | 0.06 MB | 12.7 MB | 3.6 MB | 2 / 1 | 1 |
| A street in Colossae (Ch. 4) | morning | 1.02 MB | 0.37 MB | 51.6 MB | 14.3 MB | 4 / 1 | 2 |
| | later day | 0.93 MB | 0.36 MB | 52.9 MB | 14.6 MB | 4 / 1 | 2 |
| The Laodicea road (Ch. 4) | rain cloud (its only set) | 3.98 MB | 1.31 MB | 79.0 MB | 21.9 MB | 6 / 2 | 3 |
| Philemon's house (Ch. 4) | lamp-lighting (its only set) | 0.43 MB | 0.15 MB | 22.9 MB | 6.5 MB | 2 / 1 | 1 |
| Tamar's house (Ch. 3) | morning | 0.43 MB | 0.12 MB | 16.2 MB | 4.5 MB | 2 / 1 | 1 |
| | night (lamplight) | 0.20 MB | 0.07 MB | 16.2 MB | 4.5 MB | 2 / 1 | 1 |
| The lanes of Bethlehem (Ch. 3) | later day (its day set) | 1.50 MB | 0.53 MB | 58.6 MB | 16.1 MB | 4 / 1 | 2 |
| | night | 1.11 MB | 0.40 MB | 57.4 MB | 15.8 MB | 4 / 1 | 2 |
| The fold below Bethlehem (Ch. 3) | later day (its day set) | 3.21 MB | 1.10 MB | 62.8 MB | 17.6 MB | 4 / 1 | 2 |
| | night | 2.68 MB | 0.99 MB | 62.8 MB | 17.6 MB | 4 / 1 | 2 |
| People for Chapter 1 (every sheet, shadow and overlay) | morning and indoor | 3.83 MB (107 files) | | | | | |
| | later day | 2.36 MB (76 files) | | | | | |
| People added for Chapter 2 | later day, indoor and lamp | 1.38 MB (42 files) | | | | | |
| | night (the player looks' night sheets are Chapter 3's) | 1.12 MB (42 files) | | | | | |
| People added for Chapter 4 | morning and indoor | 0.39 MB (18 files) | | | | | |
| | later day | 0.30 MB (12 files) | | | | | |
| | rain cloud | 1.18 MB (32 files) | | | | | |
| | lamp-lighting | 1.08 MB (35 files) | | | | | |
| People seen in Chapter 3 (with the player's looks and the passers-by there) | indoor | 1.01 MB (42 files) | | | | | |
| | lamp (the house at night) | 1.13 MB (42 files) | | | | | |
| | later day | 1.58 MB (40 files) | | | | | |
| | night (moonlight) | 1.21 MB (40 files) | | | | | |

The fold below Bethlehem is the heaviest of Chapter 3 (138 sprites: the flock, olives, thorn shrubs, rocks and stones on the hills); at night its pages compress better (dark, little detail). A night set takes as much texture memory as a day set but downloads a fifth to a quarter less.

The open lake downloads little (its water is smooth and compresses well). Its family boat is cut into sprites by map row, and each row in two, its stern and bow halves: most rows hold only the curved bulwarks at the two ends, and one sprite spanning the boat was mostly transparent texture (four sprite pages, 81.5 MB, before the split; two, 61.4 MB, after).

The Laodicea road is the heaviest download so far: 140 sprites, most of them reeds and young grain whose fine detail WebP compresses poorly (its two big sprite pages are 1.1 and 1.9 MB). Merging the grain into the ground layer (it is solid, so nobody walks through it) would roughly halve it.

**Phones** load about 28% of the texture memory desktops do (a place's low set is 12–17 MB against 44–58 MB). People sheets are the same on every device.

**In the game**, the texture memory the canvas reports (`data-texture-mb`: every texture loaded, including people, passers-by and the game's own) with one place in memory at a time, from the review captures (§10; headless Chromium drawing with the Mac's GPU):

| Place | Desktop and tablet (full set) | Phone (low set) |
|---|---|---|
| Aunt Miriam's house | 16–32 MB | 10–26 MB |
| Lower market | 98–101 MB | 67–69 MB |
| Road down to Jericho | 89 MB | 47 MB |
| Jericho, morning | 104 MB | 68 MB |
| Jericho, later day | 122 MB | 87 MB |
| Ammia's dye workshop (Ch. 4) | 17–22 MB | 17–22 MB |
| A street in Colossae, morning (Ch. 4) | 83–84 MB | 83–84 MB |
| A street in Colossae, later day (Ch. 4) | 97 MB | 97 MB |
| The Laodicea road (Ch. 4) | 105 MB | 105 MB |
| Philemon's house (Ch. 4) | 41–42 MB | 41–42 MB |
| Grandmother Shelomit's house (Ch. 2) | 17–18 MB | 15–17 MB |
| The shore at Capernaum, later day (Ch. 2) | 125 MB | 125 MB |
| The shore at Capernaum, night (Ch. 2) | 103–107 MB | 103–107 MB |
| The open lake (Ch. 2) | 84 MB | 84 MB |
| Tamar's house (Ch. 3), by day / at night | 29 / 40 MB | 24 / 40 MB |
| The lanes of Bethlehem (Ch. 3), later day / night | 109 / 87 MB | 109 / 87 MB |
| The fold below Bethlehem (Ch. 3), later day / night | 81 / 77 MB | 81 / 77 MB |

In the Chapter 2, 3 and 4 captures (`storm-art.spec.ts`, `bethlehem-art.spec.ts`, `letter-art.spec.ts`, September 2026) the phone loaded the full set, as desktops do: its view's zoom (the close framing at a Pixel 7's width, times the render ratio, capped at 2) is above the threshold for the half-resolution set (`wantsLowResolution`). The half-resolution set now goes to devices that ask for simpler effects, and to screens at 1× whose view is zoomed out below it.

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

# Chapter 3's places (Tamar's house by day and by lamplight, the lanes and the fold in the late sun and at night)
# on two routes (home: the main path; helped: the clerk helped first, so the fields turn to night around you):
E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/bethlehem-art.spec.ts --project=desktop-chromium
#   → test-results/bethlehem-art/<set>/<viewport>-<route>-<nn>-<name>.png and <viewport>-<route>-art.txt

# Chapter 4's places (the workshop, the street, the Laodicea road in rain, Philemon's house at lamp-lighting)
# on two routes (home: Kallias in his old cloak; reply: the tablets beside Ammia), at the same three sizes:
E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/letter-art.spec.ts --project=desktop-chromium
#   → test-results/letter-art/<set>/<viewport>-<route>-<nn>-<name>.png and <viewport>-<route>-art.txt

# Chapter 2's places (the house, the shore in the afternoon and as the boats put out, the lake under way,
# in the gust, in the storm and in the calm, the shore and the house at night), at the same three sizes;
# with VITE_FORCE_WEATHER=storm (and ART_SHOTS=forced-storm), the same route in a storm everywhere
# (it stops at the calm, which the forced storm never gives):
E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/storm-art.spec.ts --project=desktop-chromium
#   → test-results/storm-art/<set>/<viewport>-<nn>-<name>.png and <viewport>-art.txt

# The whole chapter in every presentation variant
E2E_SHOTS=1 npx playwright test e2e/visual-tour.spec.ts --project=desktop-chromium   # → test-results/tour/

# Frame rate, frame pacing, load and transition times, texture memory
PERF_MARKET=1 PERF_LABEL=after npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
```

On a Mac, `place-art.spec.ts` has Chromium draw with the real GPU (Metal): with the software renderer headless Chromium uses otherwise, the game runs slowly enough to switch to its low-power, half-resolution art after the first place, and the captures would not show what players see. Playwright empties `test-results/` at the start of each run: copy a capture set elsewhere before running again. For "before" images of an older build, run the same specs from a git worktree of that commit.

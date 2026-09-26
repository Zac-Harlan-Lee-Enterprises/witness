# Realism specification: grounded painterly realism

- **Status:** Accepted. It replaces the "sunlit field sketchbook" look of [ADR-0013](../adr/0013-art-direction-system.md) as the target for every place.
- **How it is delivered:**
  - **Pre-rendered places.** The lower market so far ([ADR-0014](../adr/0014-prerendered-places.md)). Places are built and lit in 3D offline with Blender from the game's own maps and appearance data, then composited by Phaser. See the [technical-art guide](technical-art-guide.md).
  - **Painted places.** Everything else is still painted at runtime by the Canvas painters. People there already use the realistic figure painter (natural proportions, 13 frames per direction). The places themselves keep the ADR-0013 look until they are pre-rendered.
- **Honesty about tools:** no image-generation model was used, and no image, texture, model or photograph was downloaded. Every asset comes from original code in this repository. The [asset manifest](asset-manifest.json) records how each file is made.

## 1. Audit: why the previous look read as a cartoon

| Area | What made it cartoon-like |
|---|---|
| People | Heads about ⅓ of body height, big round eyes, stubby limbs, flat coloured stripes, a 1.6-unit ink outline, and 5 frames per direction (the walk was two poses). |
| Props | Ink outlines, flat saturated fills, icon-like shapes (a symmetric diamond rug, candy-striped awnings), no wear, dust or material grain. |
| Ground | Pastel blotch noise with sparse speckles. No pebbles, cracks, ruts, drifts or worn paths. Transitions were soft blobs. |
| Buildings | Clean plaster boxes. Stones were a regular grid with the same value everywhere. No weathering, damp, soot or dirt at the base. |
| Plants | Olive canopies were cloud-shaped lumps, grass was tick marks, and flowers were stamped dots. |
| Light | Even and pastel. Interiors were bright. Shadows were uniform soft blobs, with no occlusion where things meet the ground. |
| Interface | Cream pill buttons, rounded "paper" cards, emoji-like icons and a round-faced portrait. |

## 2. Principles

1. **Value first, then colour.** Every surface has a lit plane, a turning plane and a shadow plane. The sun is in the upper left in every place. Cast shadows are 45–60% darker than lit ground and are never black: they carry the place's cool shadow hue plus a little warm bounce.
2. **Restrained, historically plausible colour.** Undyed wool (cream, grey-brown), linen (off-white), and plant and mineral dyes (muted madder red, indigo slate, weld and saffron yellow-ochre, walnut brown). Saturation is capped (`naturalColor` in `src/shared/color.ts`). Content colours are softened toward these, so each person stays recognisable without looking candy-coloured.
3. **Materials at three scales.** Macro (broad tonal variation over several tiles), meso (individual stones, bricks, planks, leaf clusters, cloth folds) and micro (grain, grit, fibres). A surface missing any of the three reads as flat.
4. **Wear tells history.** Dirt collects at wall bases. Doorways and paths are polished by feet. Roofs carry rain streaks and patches. Thresholds are worn. Jars are chipped and dusty. Cloth is sun-faded.
5. **No ink outlines.** Edges come from value contrast, contact shadow and occlusion. People get a faint shadow-side rim only, so they read against busy ground.
6. **Natural proportions.** Adults are about 7 heads tall (54 units, 1.7 tiles), children about 6 (44 units) and elders slightly stooped. Heads are drawn a little large (about 1/6.5) so faces read at play scale. Hands, feet, sandals and garment folds are all present.
7. **Believable motion.** An 8-frame walk: contact, down, passing and up for each foot, with an opposite arm swing, head bob, cloth sway and hem lag. A 2-frame idle breath with a weight shift. A blink, and 2 talking frames (mouth plus a small hand gesture). Sitting and lying poses breathe too.
8. **Quiet atmosphere.** Dust in light shafts, heat and haze on the open road, a few birds and cloth moving. Nothing bounces or sparkles for its own sake. Discovery feedback is a soft glint, not confetti.

## 3. Scale at play size

| Thing | World units (1 tile = 32) | On screen at 1280×720 (zoom 2.25) |
|---|---|---|
| Adult standing | 54 | ≈ 122 px |
| Child (the player) | 44 | ≈ 99 px |
| Head (adult) | 8 | ≈ 18 px |
| Storage jar | 18–22 | ≈ 45 px |
| House front (one storey) | tile + 14 rise | — |
| Olive tree canopy | 60–70 wide | — |

Textures are painted at 2 pixels per world unit (`ART_SCALE`), so a standing adult frame is 80 × 128 texture pixels.

## 4. Places

| Place | Identity | Materials | Light |
|---|---|---|---|
| Aunt Miriam's house (interior) | A lived-in, dim, safe home: a healer's workspace | Lime-plastered walls, beaten-earth floor with rushes, a timber lintel, a clay oven, herbs and jars | Dark room (about 45% ambient). Warm window shafts with dust and a hearth glow. Corners fall off into shadow. |
| Lower market, Jerusalem | Dense, stone, busy, noisy | Pale Jerusalem limestone laid in irregular courses, drafted-margin ashlar, worn flagstones, faded awnings | Hard morning sun, crisp shadows, cool shadow hue |
| The road to Jericho | Exposed, dry and dangerous | Chalky marl and limestone hills with strata ledges, red-streaked cliffs, gravel road with ruts, thorn scrub | Harsh overhead light, long ridge shadows, heat haze and dust |
| Jericho oasis | Relief: green, water, shade | Mudbrick with mud plaster, palm-trunk beams, reed roofs, irrigated plots, a spring pool | Warm, soft light, dappled shade under the palms, reflections on water |

## 5. Deliverables and acceptance

- Prototypes first: the player, an NPC, a stone building, trees, a market stall, a terrain transition and a lit interior. Each is compared at play scale with the previous art (see `docs/art/prototypes.md`) before the full pass.
- Every place gets its own identity, as in the table above. The same system is used everywhere.
- Before and after screenshots come from the visual tour (`E2E_SHOTS=1`), covering desktop, phone, tablet, high-contrast and reduced-motion views, plus the "tend" path that shows the choice consequences.
- Performance: no measurable regression in frame rate on the like-for-like walk (see `docs/performance.md`). Scene painting must stay under 1 s on a mid-range laptop.
- Accessibility is unchanged or better. Contrast in the interface meets WCAG AA, the high-contrast theme still works, reduced motion still keeps everything still, and focus rings are still visible.

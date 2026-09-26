# ADR-0013: One art-direction system for every place, painted once per scene

- **Status:** Accepted
- **Related:** [src/game/art/direction.ts](../../src/game/art/direction.ts), [src/game/art/scene-painter.ts](../../src/game/art/scene-painter.ts), [site.ts](../../src/game/art/site.ts), [terrain.ts](../../src/game/art/terrain.ts), [architecture.ts](../../src/game/art/architecture.ts), [nature.ts](../../src/game/art/nature.ts), [furnishings.ts](../../src/game/art/furnishings.ts), [shading.ts](../../src/game/art/shading.ts), [people/](../../src/game/art/people/), [src/game/scenes/](../../src/game/scenes/), [src/game/systems/camera.ts](../../src/game/systems/camera.ts), [src/game/systems/life.ts](../../src/game/systems/life.ts), [ADR-0004](0004-ascii-maps-procedural-art-audio.md), [docs/game-design.md §4](../game-design.md)

## Context

After the first art pass the world was still weak: about 80% of every frame was one pale beige, roofs and walls had no height, maps were sparse, the four places shared materials (Jericho was built from Jerusalem's limestone), people were stiff, and the story's staging contradicted its text (the robbed traveler "lies in the shade" but stood upright). Tuning individual painters could not fix this, because nothing tied colour, light, height and density together.

## Decision

- **A written art direction, as data.** `direction.ts` defines one visual language, the "sunlit field sketchbook", and a `Look` per place `mood` (`home`, `city`, `wilderness`, `oasis`):
  - One sun from the upper left.
  - One hue-shifted shadow colour per place, never black.
  - Ink outlines on people and objects only.
  - Colour reserved for cloth, produce, water and foliage.
  - Detail gathered along walls, with walkways kept clear.

  Each `Look` sets ground materials, building material (plaster, limestone, mudbrick), shadow colour, length and strength, occlusion, textile accents, foliage, grit, clutter and a base colour grade. Tests check the value structure (shadows well darker than ground) and that each place is distinct.
- **Content names the mood** (`Scene.mood`, optional; otherwise derived from the ambience) and stages people (`Entity.pose`: stand, sit, lie; `Appearance.carry`: staff, jar, bread, spindle, bundle, basket, satchel). The engine, not content, decides how a mood looks.
- **Painted once per scene, in passes** (`scene-painter.ts`):
  1. Ground fills, then broad noise variation (a low-resolution noise image, smoothly scaled) instead of per-tile blotches.
  2. Material edges and detail.
  3. Hills, then water.
  4. **One shadow mask:** every tall thing draws its footprint offset down-right, and the mask is laid once, so overlaps don't stack.
  5. Cliffs.
  6. Buildings, whose fronts **rise above their tile** so houses have height; an interior back wall rises a full tile.
  7. Indoor light pools and dark edges.
  8. Outlined objects.
  9. Per-tree canopies.

  The result is one ground texture, small canopy pieces and a list of light spots.
- **The scene is split by responsibility:**
  - `actors.ts`: people who blink, turn to you and talk.
  - `ambient.ts`: passers-by, pigeons, a hawk's shadow, swaying palms, dust in window light, a flickering hearth.
  - `feedback.ts`: focus ring and verb symbol, clue glints, exit chevrons, discovery flourishes.
  - Pure systems for camera framing, look-ahead, conversation framing and the rules of life, all unit-tested.
- **The application stages; the world presents.** `WorldPort.setConversation` (who you're talking with, who's speaking) and `WorldPort.emphasize` (clue, item, solved, objective) are decided in the application layer and are always accompanied by text feedback.

## Consequences

- The four places are distinguishable from a screenshot without reading their names, and the chapter's emotional arc shows in them: safe home, busy city, exposed road, relieving oasis.
- Adding a place means choosing a mood (or adding a `Look`), not writing new painters. A new decor tile kind needs a `TILE_KINDS` entry, a painter case and a height for shadows.
- Performance was measured, not assumed: walking in the market (headless, software rendering) went from 39.0 fps to 40.3 fps, because the closer camera draws fewer ground pixels. The expensive full-screen passes are still limited to one light layer. Slow devices drop ambient extras automatically (`systems/quality.ts`), and reduced motion keeps everything still.
- Maps gained decor tiles and the house gained a wall row. Old saves are protected by `nearestOpen`, which moves a player saved inside something now solid to the nearest open tile.
- Painting is not unit-testable without a canvas. The pure rules (site reading, direction values, camera, life) are; painting is checked by the screenshot tour (`e2e/visual-tour.spec.ts`, run with `E2E_SHOTS=1`) and by the browser tests.

## Alternatives considered

- **Runtime tilemap plus Phaser's Light2D pipeline** (normal-mapped dynamic lights). More dynamic light, but it needs procedural normal maps, costs more per frame (a problem for school laptops without a strong GPU) and doesn't fix composition or density. Rejected.
- **Keep per-tile painters and tune colours.** Cheap, but it keeps the grid look, can't give buildings height or shadows a single shape, and gives every place the same materials. Rejected.
- **A licensed asset pack.** It would look polished faster, but it brings licensing and provenance work, a recognisable "asset store" look, and clashes with the procedural people and props. Rejected, as in ADR-0004.

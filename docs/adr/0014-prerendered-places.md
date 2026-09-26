# ADR-0014: Pre-rendered 3D-to-2D art for grounded realism, composited by Phaser

- **Status:** Accepted for the market slice. The rest of the game is under evaluation (see [the prototype report](../art/prototype-report.md)).
- **Related:** [technical-art guide](../art/technical-art-guide.md), [realism specification](../art/realism-spec.md), [asset manifest](../art/asset-manifest.json), [ADR-0013](0013-art-direction-system.md), [ADR-0004](0004-ascii-maps-procedural-art-audio.md), [`tools/art/`](../../tools/art/), [`src/game/prerendered/`](../../src/game/prerendered/)

## Context

The art direction asked for grounded historical realism:

- believable proportions, materials, light and shade;
- a serious historical-adventure tone, not a cartoon;
- delivered in the browser as a static, offline PWA.

Runtime Canvas painting (ADR-0004, ADR-0013) produced a coherent illustrated style. It could not produce convincing stone, cloth, foliage or light at play scale, and the more it was pushed, the more it cost at scene load. The open question was whether the engine was the limit (and a move to Unity was needed) or the way the art was made.

## Decision

- **Make art offline, in 3D, and ship it as images.** Blender scripts in [`tools/art/`](../../tools/art/) do the whole job:
  - build places from the game's own tile maps, and people from their appearance data;
  - light them with a physically based sun and sky;
  - render them from the game's exact oblique camera;
  - write WebP layers, sprite atlases, character sheets and shadow sheets with JSON manifests into `public/art/`.

  Everything is procedural. There are no downloaded models or textures, and the result is reproducible from the repository.
- **Phaser only composites:**
  - a ground layer with every shadow and contact occlusion baked in;
  - standing things as sprites, sorted against people by the line they stand on;
  - people as sheets with matching baked shadows;
  - a shade mask that dims people standing in shadow.

  The 32-unit collision and navigation grid is unchanged. The art is decoupled from it, and sprites span tiles freely.
- **Light as data.** Each place has a `day` and a `late` variant, chosen from the story clock. The time-of-day grade still darkens toward dusk.
- **Graceful fallback.** A place without art, a failed load, or a person with story marks (bandages, a borrowed cloak, the player's gear) is painted by the existing Canvas painters. The canvas reports which path it used (`data-art`).
- **The application and story layers are untouched by rendering.** `WorldPort.loadScene` awaits the art. Everything else crosses the same boundary as before.

## Consequences

- The market reads as a place built of stone, cloth, pottery, earth and olive wood, lit by one sun. People have natural proportions, cast shadows that match the buildings', turn through in-between poses, and dim in shade.
- **Download and memory grow.** The art is several MB, precached for offline play, and uses more texture memory than painting. Measured costs are in [performance.md](../performance.md) and the prototype report, with the half-resolution path for phones and reduced effects.
- **Authoring needs Blender** (free, GPL; used as a tool and never shipped).
  - The market re-renders in about 6 minutes on an Apple M3 Pro.
  - The 15 people take about 30 minutes.
  - A content test checks that the manifests match the maps, entities and characters, and that every shipped file has recorded provenance.
- **Story marks are not pre-rendered yet.** They would need layered sheets per mark, rendered with the pipeline's holdout technique. Until then, marked people are painted.

## Alternatives considered

- **Keep painting at runtime and push the Canvas painters further.** A per-pixel ground and a realistic figure painter were built and compared. They improved the look but stayed illustrative, and made scene loads slower. Rejected for places; the figure painter stays as the fallback.
- **Real-time 3D in the browser** (three.js) or **Unity WebGL.** These bring perspective cameras and dynamic lighting that this view doesn't need, at a much higher runtime cost and download. Unity would also add a second engine and toolchain. See the recommendation in the prototype report.
- **Licensed asset packs.** Rejected, as in ADR-0004: licensing and provenance work, and a recognisable borrowed look.

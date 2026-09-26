# ADR-0004: ASCII tile maps and procedurally generated original art and audio (no binary assets to license)

- **Status:** Accepted
- **Related:** [src/domain/world.ts](../../src/domain/world.ts) (`TILE_KINDS`, `parseLayout`), [src/game/art/scene-painter.ts](../../src/game/art/scene-painter.ts), [src/game/art/props.ts](../../src/game/art/props.ts), [src/game/art/people/](../../src/game/art/people/), [src/features/common/Portrait.tsx](../../src/features/common/Portrait.tsx), [src/infrastructure/audio/synth-audio.ts](../../src/infrastructure/audio/synth-audio.ts), [scripts/generate-icons.mjs](../../scripts/generate-icons.mjs)

## Context

A vertical slice needs a believable first-century setting (sandstone, olive trees, markets, a desert road) without an art or audio budget and without licensing risk. Every asset in a game aimed at families, churches and classrooms must be clearly original or clearly licensed. Maps also need to be editable and reviewable by contributors who don't have a level editor, and checkable by automated tests (walkable spawns, reachability).

## Decision

- **Maps are ASCII layouts.** Each `Scene` has `layout: string[]` (at least 3 rows) and a `legend` mapping single characters to one of 28 tile kinds in `TILE_KINDS`, each with a fixed `solid` flag. `parseLayout` turns this into a `TileGrid` and throws `MapError` on ragged rows or unknown characters. Entities, exits, triggers and spawns are placed by tile coordinates in the same file.
- **Art is procedural and original.** Tiles (32 world units), props and characters are painted with Canvas 2D at runtime onto canvases at 2× resolution (`ART_SCALE`) so they stay crisp when the camera zooms. Each scene is painted once, in passes, into a ground layer below characters and small tree-top textures above them; how each place looks (palette, materials, light, height, density) is set by the art direction in [ADR-0013](0013-art-direction-system.md). Painting is deterministic per tile, so maps look identical on every load, in an original style "deliberately not imitating any commercial game". Characters are 4 directions × 5 frames (stand, two steps, blink, talk) plus sitting and lying poses, painted from `Appearance` data. The same `Appearance` also drives the React SVG `Portrait`, so a character looks consistent in the world and in dialogue. Unknown prop sprite names fall back to a visible marker and log a warning.
- **Audio is procedural.** `SynthAudio` plays the sound design in [`soundscape.ts`](../../src/infrastructure/audio/soundscape.ts): short modal phrases over drones, a filtered-noise bed plus sparse events per place (voices, clinks, hearth crackle, gusts, birdsong, water), and effect recipes of plucked, bell and breath tones, with WebAudio, on independent gain channels for music, effects, ambience and voice. No audio files ship. Ambience and music changes can be captioned (for example "[Wind gusting over dry hills]"), and every sound has a visible text equivalent.
- **The only binary files** in the build are the PWA icons, which are rasterised from the project's own `public/icons/icon.svg` by `npm run icons`, and the web fonts, which come from the `@fontsource` npm packages (Alegreya, Atkinson Hyperlegible, OpenDyslexic, each declaring `OFL-1.1` in its `package.json`).

## Consequences

- There is nothing to license or attribute for art and audio, and nothing to download beyond code. This also keeps the offline precache small.
- Maps are diffable in pull requests. Content validation can parse them and prove that spawns, exits and interactive entities are walkable and reachable ([src/content/validation.ts](../../src/content/validation.ts)).
- Adding a tile kind means editing `TILE_KINDS` (domain) **and** teaching the painter how to draw it (`terrain.ts`, `architecture.ts`, `nature.ts` or `furnishings.ts`) and, if it stands up, giving it a height in `site.ts` so it casts a shadow. Both changes are in reviewed engine code.
- Visual fidelity is limited to what code can paint. Richer art would come in through the same seams: a texture loader behind the scene's paint functions, or a recorded-audio `AudioPort` (the `voice` channel is already reserved for future narration).
- Painting happens at scene build time. It is done once per scene into one cached ground texture (about 24 MB for the largest map, the road, at 2×) plus a small texture per tree top (see [architecture.md §14](../architecture.md#14-performance-design)).

## Alternatives considered

- **Tiled (TMX/JSON) maps from an external editor.** Nicer to author visually, but it needs a tool installed, produces large diffs, and moves map data out of the validated chapter schema.
- **Licensed or CC asset packs.** Faster to look polished, but they bring attribution and licence tracking, a recognisable "asset store" look, and a risk of style clashes between packs.
- **Commissioned art and audio.** The right long-term option for a full release, but out of scope for the slice. The `Appearance` and `AudioPort` seams leave room for it.

# ADR-0015: High-DPI rendering, live weather and water, and post-processing inside Phaser

- **Status:** Accepted
- **Related:** [ADR-0002](0002-react-ui-phaser-world-port.md), [ADR-0014](0014-prerendered-places.md), [performance.md](../performance.md), [accessibility.md](../accessibility.md), [`src/game/fx/`](../../src/game/fx/), [`src/game/systems/`](../../src/game/systems/), [`src/game/phaser/`](../../src/game/phaser/)

## Context

The prototype report ([§6](../art/prototype-report.md)) found that Phaser was not the limit on realism — the art was — and named the engine-side limits left once the art was pre-rendered: the canvas rendered at CSS pixels (soft on Retina screens), textures cost a lot of memory, lighting was a single 2D grade, and nothing in the world moved except people and a few particles. The story now also names the weather (`Scene.weather`, `weatherChanges`), and Chapter 2's storm on the Sea of Galilee depends on the world actually drawing it.

The constraints stay as before: a static, offline PWA; Phaser only in `src/game`, behind `WorldPort`; nothing that carries information may exist only in the canvas; reduced motion, high contrast and weak devices must all be served; no new dependencies.

## Decision

**Render at device pixels.** The game runs in Phaser's `NONE` scale mode and [`Viewport`](../../src/game/phaser/viewport.ts) sizes the canvas to `CSS size × ratio`, shown at CSS size (`zoom = 1 / ratio`), following parent resizes and device-pixel-ratio changes. The ratio ([`renderResolution`](../../src/game/systems/resolution.ts)) is the device's, capped at 2× and at about 6 million canvas pixels, in quarter steps. Camera framing is still chosen from the CSS size; the camera zoom is multiplied by the ratio, so the view is unchanged and pointer input maps through Phaser's display scale. Pre-rendered art is chosen at the resolution of the canvas pixels it will cover. The canvas reports `data-resolution`.

**Weather is drawn, and follows the story.** [`WeatherLayer`](../../src/game/fx/weather-layer.ts) turns `setWeather` into a blend of channels (rain, wind, cloud, storm) that eases toward the story's weather — a storm rises over a few seconds and calms more slowly ([`stepWeather`](../../src/game/systems/weather.ts)). It draws:

- rain that falls through the view and leans with the gusting wind, splashes on the ground, puddles that gather over a quarter of a minute of rain and dry afterwards, and ripples in them;
- sheets of rain in a downpour;
- dust streamers, blown grit and chaff in the wind; trees and palms that lean and thrash with the gusts;
- cloud shadows drifting over the ground;
- a cooler, darker, flatter light (a second tint in the existing multiply layer, and the post-processing grade);
- lightning in a storm, rationed by a [`FlashGate`](../../src/game/systems/weather.ts) to at most three flashes in any second (WCAG 2.3.1), each a low-contrast brightening (at most +24%).

Interiors feel weather only in their light. `VITE_FORCE_WEATHER` forces a weather everywhere for review builds.

**Light after dark.** Interiors now follow the story clock at night: the room dims and its lamps and hearth become warm, flickering pools of light (the time-of-day multiply layer and the grade); outdoors, lamplight spills from doorways and gates. The player's carried lamp is a pool about three strides across.

**Water is live.** [`WaterSurface`](../../src/game/fx/water-surface.ts) draws a shader over every body of water tiles (and painted wells and troughs): travelling swells and wavelets, sky reflection that brightens at grazing angles, sun glints on wave faces tilted toward the sun (from the story hour and the art's lighting variant), rain rings, and foam-streaked chop in a storm. The painted or rendered water underneath still shows through.

**One post-processing pass.** [`WorldPostFX`](../../src/game/fx/post-fx.ts), a custom camera post pipeline, does a gentle per-place, per-hour, per-weather grade ([`gradeFor`](../../src/game/systems/grade.ts)), a half-resolution bloom for lamps, fire and glints, the lightning flash, a faint heat shimmer in the midday wilderness, and dithering. It sits on top of — and does not replace — the multiply light layer, which also carries the look on the Canvas renderer. High contrast keeps the grade from darkening, flattening or shimmering.

**Effects step down before the frame rate does.** [`stepQuality`](../../src/game/systems/quality.ts) now has levels: `full` → `lite` (post-processing off, half the weather) → `crisp` (1× resolution; skipped on 1× screens) → `low` (the previous "simpler effects"). Very slow frames skip straight to `low`; an isolated long frame (a screenshot, a tab coming back) is not counted, but long frames in a row are. Software GL (no GPU) starts without post-processing. Players can choose **Simpler visual effects** in Settings (a device setting, off by default): the world starts at `low` and stays there.

**Spend GPU memory only on what is shown.** Phaser's built-in pre/post FX are disabled (`disablePreFX`, `disablePostFX`): they allocated dozens of screen-sized render targets the world never used (61 MB at 1280×720, several times that at 2×). Full-screen targets for features the world doesn't use (bitmap masks, captures, built-in FX) are shrunk to 1×1. When a place is built, art, people and painted figures from the previous place are released (they reload or repaint if needed). People's shadow sheets are uploaded as one-channel `LUMINANCE` (a quarter of the memory, no visible change), and on phones, tablets and low-memory devices the opaque ground is uploaded as RGB 5-6-5 (half); the browser converts as it uploads, so there is no pixel work in JavaScript ([`compact-textures.ts`](../../src/game/phaser/compact-textures.ts)).

**The Canvas fallback works again.** Phaser builds its Canvas blend table before its own asynchronous blend-mode test has finished, so `MULTIPLY` drew as a plain image and the light layer covered the view (this was already broken before this change). The world sets the modes it uses directly, keeps Canvas at 1× and skips tinted effects there; an e2e test runs with WebGL disabled.

## Consequences

- Retina and high-DPI phones see crisp edges, people, particles and water instead of an upscaled canvas. Pixels drawn grow with the square of the ratio; the quality levels and the pixel budget contain it. The pre-rendered art's own resolution (3 px per unit) is unchanged: at 2× close framing it is magnified 2×, and the 1-px-per-unit baked shadow sheets show soft stair-steps. Richer art (more pixels per unit, higher-resolution shadows) is an art-pipeline decision.
- Chapter content can make weather happen with data alone (`weather`, `weatherChanges`); the world renders it and the e2e test proves the path end to end.
- Everything in `src/game/fx` that needs shaders needs WebGL. On the Canvas renderer rain, dust, cloud shadows, the light layer and a lightning wash still work; live water, puddles and post-processing are off.
- Reduced motion: no rain, splashes, dust, leaves, cloud drift, sheets or lightning, still water and trees; the light still changes with the weather. Tested (`e2e/rendering.spec.ts`).
- There is still no thunder or rain sound: the world has no path to audio, and adding one is an application-layer change (an `AudioPort` cue from the weather).
- Texture memory in the market is dominated by the pre-rendered ground, atlas and people sheets. GPU-compressed textures would cut it 4–8× but need either a Basis/KTX2 transcoder (a new dependency) or per-format files (ASTC/ETC2/S3TC) produced by the art pipeline; Phaser's loader can already load the latter.

## Alternatives considered

- **Phaser's built-in FX (bloom, vignette, colour matrix) chained on the camera.** Each is a full-screen pass at full resolution, and enabling them keeps Phaser's shared FX render targets alive. One custom pass with a half-resolution bloom does the same job for less.
- **Rendering at 1× and relying on browser upscaling (as before).** Cheapest, but the soft image was the most visible gap on high-DPI screens.
- **Per-object sway or cloth shaders.** Would need per-object render targets or custom vertex pipelines; rotating trees about their foot gives the effect at no cost. Cloth on pre-rendered stalls is baked in and does not move.
- **Runtime GPU-texture encoding (DXT/ETC in a worker).** Possible without dependencies, but costs seconds on phones at every scene load unless cached, and caching derived data outside `src/infrastructure/persistence` breaks the storage boundary.
- **A 3D engine.** As in ADR-0014: the view doesn't need one; the gains here come from the same 2D engine.

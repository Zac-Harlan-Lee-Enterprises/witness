# ADR-0002: React for UI, Phaser only for the world, behind a `WorldPort` adapter (Phaser lazy-loaded)

- **Status:** Accepted
- **Related:** [src/application/ports.ts](../../src/application/ports.ts) (`WorldPort`, `WorldEvent`, `WorldSceneModel`), [src/game/phaser/mount-world.ts](../../src/game/phaser/mount-world.ts), [src/game/scenes/world-scene.ts](../../src/game/scenes/world-scene.ts), [src/app/game-runtime.ts](../../src/app/game-runtime.ts), [src/features/game/GameViewport.tsx](../../src/features/game/GameViewport.tsx), [architecture.md §11](../architecture.md#11-the-react--phaser-boundary)

## Context

Most of what a player reads and does in this game is text and choices: dialogue, the journal, quest log, puzzles, the Scripture Connection and the chapter summary. These must be fully accessible (screen readers, keyboard-only, text scaling, high contrast), which HTML does well and a canvas does not. The walkable world, however, needs a real-time renderer with sprites, a camera and a frame loop.

Phaser is large compared with the rest of the app, and players first see menus and profile screens that don't need it. The story rules must not end up inside an engine scene, where they would be hard to test and hard to reuse.

## Decision

- **React renders all UI** as accessible HTML: the HUD, the dialogue box, and overlays built on a focus-trapping `Modal`. Statuses are always text.
- **Phaser renders only the world**: one scene class, [`WorldScene`](../../src/game/scenes/world-scene.ts), that draws whatever map it is given, moves the player, follows paths and picks the interaction focus. It never evaluates story conditions and never touches React or storage (the layer rules in ADR-0001 enforce this).
- The world is reached **only through `WorldPort`**: `loadScene`, `updateEntities`, `travelTo`, `setControlsEnabled`, `setMotion`, `destroy`. It reports back **only through `WorldEvent`**: `focusChanged`, `playerMoved`, `tileEntered`, `exitReached`, `arrived`, `sceneReady`, and `interact`, which is declared but not emitted by the adapter. The application computes a `WorldSceneModel` (grid, visible entities, exits, player) in [world-model.ts](../../src/application/world-model.ts), so all visibility rules are testable without Phaser.
- **Phaser is lazy-loaded.** `GameViewport` (React) only hands a DOM element to `GameRuntime.mountWorld()`, which does `await import('@/game/phaser/mount-world')`. An architecture test fails if anything outside `src/game` imports it statically.
- Phaser's keyboard, gamepad and audio subsystems are **disabled** in the game config. Input arrives through `VirtualInput` (ADR-0009, [architecture.md §12](../architecture.md#12-input-abstraction)) and sound through `AudioPort`. The canvas is marked `aria-hidden="true"` and `tabindex="-1"`, because every piece of information and every control also exists in HTML.

## Consequences

- Menus load without the engine. The Phaser code is a separate lazy chunk (`mount-world-*`) that the service worker precaches for offline play.
- The full game can be played in tests against a `FakeWorld` implementation of `WorldPort` ([tests/support/harness.ts](../../tests/support/harness.ts)).
- If the engine fails to start, `GameViewport` catches the rejection and shows a recoverable "Something went wrong" modal. The menus, saves and settings are unaffected.
- Replacing the renderer later (a different engine, or a pure DOM/SVG world) would mean re-implementing one adapter, not the game.
- Two UI technologies must be kept visually consistent. The shared `Appearance` data drives both the Phaser sprite sheets and the React SVG portraits to help with this.
- Being disciplined about the port costs some convenience: for example, the world cannot show a toast by itself. It reports an event and the controller decides.

## Alternatives considered

- **All-Phaser UI** (dialogue boxes, menus drawn on canvas). Accessibility would have to be rebuilt from scratch (focus, screen readers, text scaling, contrast), and text-heavy screens are much harder to build and test.
- **All-DOM world** (CSS grid or SVG, no engine). It would need no engine at all, but smooth scrolling, depth sorting, camera following and sprite animation would all have to be built by hand. Phaser gives a mature render loop.
- **Phaser loaded eagerly.** Simpler wiring, but every visit, including title screen and settings, would pay for the engine download.
- **React bindings that put game state inside Phaser scenes.** It is convenient at first, but it couples story rules to the engine lifecycle and makes them untestable in Node.

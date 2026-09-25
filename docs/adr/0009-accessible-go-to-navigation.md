# ADR-0009: Accessible "Go to…" navigation and instant travel as first-class input

- **Status:** Accepted
- **Related:** [src/application/world-model.ts](../../src/application/world-model.ts) (`destinations`), [src/features/navigation/GoToList.tsx](../../src/features/navigation/GoToList.tsx), [src/application/game-controller.ts](../../src/application/game-controller.ts) (`travelTo`, `arrived`), [src/game/scenes/world-scene.ts](../../src/game/scenes/world-scene.ts) (`travelTo`), [src/domain/navigation.ts](../../src/domain/navigation.ts), [src/content/validation.ts](../../src/content/validation.ts) (`reachabilityIssues`), [src/domain/settings.ts](../../src/domain/settings.ts) (`instantTravel`)

## Context

Walking a character around a tile map needs fine motor control and sight of the canvas. Some players use screen readers, switch access or a single button, and some find steering tiring or impossible. The world canvas is decorative to assistive technology (ADR-0002), so the game must be completable without steering at all, and that path must not be a second-class copy that misses story beats.

## Decision

- **A "Go to…" list is part of the core UI.** It is always available from the HUD button and the `goto` action (default key `G`). `destinations()` lists every *visible, interactive* entity in the scene with its action ("Talk to …", "Examine …") and **every exit** ("Go to …"). Blocked exits are listed too: they explain themselves when reached. The list is a `Modal` of plain buttons.
- Choosing a destination calls `GameController.travelTo(id)` → `WorldPort.travelTo(id, settings.instantTravel)`. The scene computes goal tiles (the `approachTiles` around a solid entity, or every tile of an exit rectangle) and a shortest path with BFS (`findPath`).
  - **Walking** follows the path at the chosen movement speed.
  - **Instant travel** (setting `instantTravel`, off by default) moves the player through **every tile of the path in order in one frame**, running the same per-tile bookkeeping (`playerMoved`, `tileEntered`, `exitReached`). Area triggers along the route fire exactly as if the player had walked, so no story beat is skipped.
  - On arrival at an entity, the world emits `arrived`, the player and NPC face each other, and the controller performs the interaction. Arriving on an exit emits `exitReached`.
- Tap-to-move on touch and mouse uses the same path finder.
- **Every destination is guaranteed reachable.** Content validation (`reachabilityIssues`) fails the build if any interactive entity or exit cannot be reached from any spawn (ignoring blockers that disappear once solved, meaning solid entities with `visibleWhen`).
- Scene changes are announced in a polite live region, and the focused interaction is always shown as a text prompt and button.

## Consequences

- The whole chapter can be played with the "Go to…" list, dialogue buttons and puzzle buttons alone. Keyboard-only, switch and screen-reader play need no special mode.
- Content authors get a mechanical guarantee (and a build failure) instead of relying on playtesting to find unreachable objects.
- Instant travel is honest about the world. Because triggers fire along the path, content never has to special-case accessible play.
- Turning on instant travel is reported as the anonymous `AccessibilityFeatureEnabled` event only if the device has opted in to analytics.
- Gamepads have no binding for `goto` today. Gamepad players reach the list through the HUD button.

## Alternatives considered

- **Teleport directly to the target.** Simpler, but area triggers between here and there would never fire, so accessible players could miss scenes and consequences.
- **A separate "accessible mode" with its own flow.** It duplicates logic and drifts from the main game. Making the list the same mechanism as walking keeps one code path.
- **Screen-reader descriptions of the map with arrow-key steering only.** Still needs spatial steering, which is slow and error-prone for many players.

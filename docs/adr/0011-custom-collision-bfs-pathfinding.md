# ADR-0011: Custom tile collision and BFS pathfinding instead of Arcade physics (pure, unit-tested)

- **Status:** Accepted
- **Related:** [src/game/systems/collision.ts](../../src/game/systems/collision.ts), [src/game/systems/focus.ts](../../src/game/systems/focus.ts), [src/domain/navigation.ts](../../src/domain/navigation.ts), [src/domain/world.ts](../../src/domain/world.ts) (`TILE_KINDS`), [src/game/scenes/world-scene.ts](../../src/game/scenes/world-scene.ts), [src/content/validation.ts](../../src/content/validation.ts), [tests/unit/game/systems.test.ts](../../tests/unit/game/systems.test.ts)

## Context

Movement in this game is simple: one walking character on a tile grid, static solid tiles, and solid entities (people, stalls, blockers that disappear once a puzzle is solved). There is no gravity, and there are no projectiles or bouncing bodies. The same notion of "walkable" is needed in three places: the frame loop (collision), "Go to…" and tap-to-move (pathfinding), and the content validator, which must prove in Node, without Phaser, that everything is reachable.

## Decision

- **No Phaser physics system is configured.** The `Phaser.Game` config in [mount-world.ts](../../src/game/phaser/mount-world.ts) has no `physics` section.
- **Walkability is one pure function.** `blockedFn(grid, solidEntities)` returns `blocked(x, y)`, which is true for solid tile kinds (`TILE_KINDS[kind].solid`), out-of-bounds tiles (`void`), and tiles occupied by a solid entity.
- **Collision** ([collision.ts](../../src/game/systems/collision.ts)) is continuous, axis-separated movement in tile units, with a feet hitbox slightly narrower than a tile (`HALF_W = 0.3`, `HALF_H = 0.22`, generous in doorways). `moveWithCollision` tries x then y, so the player slides along walls. `normalise` keeps diagonal movement from being faster. Speed comes from `MOVEMENT_SPEEDS` (3, 4.5 or 6.5 tiles per second).
- **Pathfinding** ([navigation.ts](../../src/domain/navigation.ts)) is a 4-directional breadth-first search (`findPath`, capped at 20 000 visited nodes) to a set of goal tiles. `approachTiles` gives the walkable neighbours of a solid target (or the target itself if it is walkable). `facingToward` orients the player on arrival.
- **Interaction focus** ([focus.ts](../../src/game/systems/focus.ts)) prefers what the player faces within `REACH = 1.9` tiles, and falls back to the nearest thing, so precise positioning is never needed.
- The navigation code lives in `domain`, so `src/content/validation.ts` reuses it for the reachability check. The collision and focus systems are Phaser-free and unit-tested in `tests/unit/game/systems.test.ts`. Path finding and approach tiles are tested in `tests/unit/domain/misc.test.ts`.

## Consequences

- Runtime movement, "Go to…" travel and build-time validation agree on what is walkable. If validation passes, travel can find a path.
- All of it is deterministic and testable in Node, without a canvas or an engine.
- There are fewer engine features to lean on. Diagonal pathing, moving obstacles and physics-driven effects would need new code, which fits this game's scope.
- BFS on 4-connected grids gives shortest paths in steps, and is cheap at the map sizes used (tens of tiles per side).

## Alternatives considered

- **Phaser Arcade physics with tilemap colliders.** It is built in, but it ties collision to the engine (so it can't run in the content validator or in Node unit tests), adds a body-per-sprite model the game doesn't need, and would still need a separate path finder.
- **A* pathfinding.** Better for very large maps. On small uniform-cost grids BFS finds the same shortest paths with simpler code.
- **A third-party pathfinding library.** Another dependency for about 40 lines of well-tested code.

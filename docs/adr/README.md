# Architecture Decision Records

Short records of the decisions that shape **Witness**. They explain *why* the code looks the way it does. Each one describes the decision **as implemented**, with links to the code that carries it out. The technical overview is in [../architecture.md](../architecture.md).

| # | Decision | Status |
|---|---|---|
| [0001](0001-clean-layered-architecture.md) | Clean layered architecture with executable boundary tests | Accepted |
| [0002](0002-react-ui-phaser-world-port.md) | React for UI, Phaser only for the world, behind a `WorldPort` adapter (Phaser lazy-loaded) | Accepted |
| [0003](0003-declarative-content.md) | Declarative content (conditions/effects as data, Zod-validated) instead of scripts | Accepted |
| [0004](0004-ascii-maps-procedural-art-audio.md) | ASCII tile maps and procedurally generated original art and audio (no binary assets to license) | Accepted |
| [0005](0005-local-first-indexeddb-versioned-saves.md) | Local-first persistence in IndexedDB with versioned saves and explicit migrations | Accepted |
| [0006](0006-pwa-prompt-updates.md) | PWA updates use a "prompt" strategy (never swap versions mid-chapter) | Accepted |
| [0007](0007-device-level-settings.md) | Settings are device-level, shared by all profiles (accessibility applies before profile choice) | Accepted |
| [0008](0008-scripture-text-provider.md) | Scripture text only via a provider. Placeholders by default. Stored public-domain text disabled until human proofreading. | Accepted |
| [0009](0009-accessible-go-to-navigation.md) | Accessible "Go to…" navigation and instant travel as first-class input | Accepted |
| [0010](0010-no-numeric-spiritual-scoring.md) | No numeric spiritual scoring. Relationships are shown as words, and consequences are concrete facts. | Accepted |
| [0011](0011-custom-collision-bfs-pathfinding.md) | Custom tile collision and BFS pathfinding instead of Arcade physics (pure, unit-tested) | Accepted |
| [0012](0012-typed-event-bus-small-stores.md) | Custom typed event bus and small observable stores instead of a state library | Accepted |
| [0013](0013-art-direction-system.md) | One art-direction system for every place (palette, materials, light, height, density), painted once per scene | Accepted |
| [0014](0014-prerendered-places.md) | Grounded realism by pre-rendering places and people offline in 3D (Blender) and compositing them in Phaser; painted fallback | Accepted (market slice) |
| [0015](0015-world-rendering-effects.md) | High-DPI rendering, live weather and water, and one post-processing pass inside Phaser; effects step down before the frame rate does | Accepted |

Code comments refer to these by number (for example `ADR-0006` in [vite.config.ts](../../vite.config.ts) and `ADR-0007` in [src/domain/settings.ts](../../src/domain/settings.ts)). **Never renumber a record.**

## Writing a new ADR

Add one when a change is consequential: a new dependency, a new layer or port, a change to saved data, content rules, privacy, or anything a later contributor would otherwise undo by accident. Copy this template to `NNNN-short-slug.md` using the next free number, add it to the table above, and link it from the code it governs.

```markdown
# ADR-NNNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX
- **Related:** links to code, docs, other ADRs

## Context
What forces are at play? What problem are we solving?

## Decision
What we do, stated so it can be checked against the code.

## Consequences
What becomes easier, what becomes harder, what we must keep doing.

## Alternatives considered
Each option and why it was not chosen.
```

To change a decision, write a new ADR that supersedes the old one, and update the old one's status line. Don't rewrite history.

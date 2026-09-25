# ADR-0001: Clean layered architecture with executable boundary tests

- **Status:** Accepted
- **Related:** [tests/architecture/layers.test.ts](../../tests/architecture/layers.test.ts), [src/app/services.ts](../../src/app/services.ts), [src/application/ports.ts](../../src/application/ports.ts), [architecture.md §2](../architecture.md#2-layers-and-dependency-rules)

## Context

The game mixes very different concerns: story rules (quests, dialogue, puzzles), a game engine (Phaser), a UI framework (React), browser storage (IndexedDB), audio and a service worker. It is built as a vertical slice that must grow chapter by chapter, is worked on by AI agents as well as people, and must stay testable without a browser.

Layering conventions that live only in a document drift quickly, especially when many contributors, human or AI, make local changes. A misplaced import (a React hook in a rule, IndexedDB in a component, a static import of Phaser in the menu) is easy to write and costly to undo later.

## Decision

1. The code is split into eight top-level layers under `src/`: `domain`, `application`, `content`, `infrastructure`, `game`, `features`, `shared` and `app`. Each has a fixed set of layers it may import (the `ALLOWED` table in the test):
   - `domain` → domain only (plus `zod`)
   - `shared` → shared only
   - `application` → application, domain, shared
   - `content` → content, domain, shared, plus type-only imports of `application/ports`
   - `infrastructure` → infrastructure, application, domain, shared
   - `game` → game, application, domain, shared
   - `features` → features, application, domain, shared
   - `app` → everything
2. The application layer depends on **ports** (interfaces in [ports.ts](../../src/application/ports.ts)). Concrete classes are chosen only in the composition root [src/app/services.ts](../../src/app/services.ts), and per chapter run in [src/app/game-runtime.ts](../../src/app/game-runtime.ts).
3. The rules are **executable**. [tests/architecture/layers.test.ts](../../tests/architecture/layers.test.ts) parses every static, re-export, side-effect and dynamic import in `src/`, and fails with *what / why / how to fix* when a rule is broken. The same file enforces framework containment:
   - Phaser only in `src/game`
   - `idb`, `indexedDB`, `localStorage` and `sessionStorage` only in `src/infrastructure/persistence`
   - React only in `src/features` and `src/app`
   - `src/game` and chapter folders only through dynamic `import()`

   It also enforces safety rules: no network calls, no `eval` or `new Function`, no explicit `any`, no `console.log`, and no reflection text in infrastructure or analytics code.
4. The test runs in `npm test`, in `npm run test:arch`, in CI, and in `quality-sweep.sh`. `AGENTS.md` tells contributors to fix the code, not the test.

## Consequences

- Domain rules run unchanged in unit tests, the content validator (`scripts/validate-content.ts`) and the browser.
- The whole game loop runs headless through the real application layer in tests ([tests/support/harness.ts](../../tests/support/harness.ts)) with a `FakeWorld` in place of Phaser.
- Swapping an implementation (memory vs IndexedDB repositories, `SynthAudio` vs `SilentAudio`, a future cloud `SyncProvider`) touches only the composition root.
- Some indirection is required. A React view cannot "just read IndexedDB". It goes through `SaveService` / `ProfileService`, which is also where validation and migration happen.
- The test is regex-based, not a full module graph. It resolves only `@/` and relative specifiers, and its code rules run on source with comments and string literals stripped. That keeps it fast and dependency-free, but a very unusual import form could slip past it.

## Alternatives considered

- **Conventions documented only in prose.** No setup cost, but nothing stops drift, and agents in particular follow what the code allows.
- **An ESLint plugin for import boundaries** (such as `eslint-plugin-boundaries` or `no-restricted-imports`). It would give editor feedback, but it means another dependency and configuration, and it is harder to express the Phaser/chapter laziness rule and the privacy rules in the same place with explanatory failure messages. The Vitest test has no extra dependencies and runs everywhere the tests run.
- **A feature-sliced (vertical) structure without layers.** It fits UI-heavy apps, but here the domain rules are shared by every feature and by the content validator, so a single pure `domain` layer is the natural centre.

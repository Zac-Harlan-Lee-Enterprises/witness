# ADR-0012: Custom typed event bus and small observable stores instead of a state library

- **Status:** Accepted
- **Related:** [src/shared/event-bus.ts](../../src/shared/event-bus.ts), [src/shared/store.ts](../../src/shared/store.ts), [src/domain/events.ts](../../src/domain/events.ts), [src/application/game-session.ts](../../src/application/game-session.ts), [src/application/ui-store.ts](../../src/application/ui-store.ts), [src/application/settings-service.ts](../../src/application/settings-service.ts), [src/features/common/hooks.ts](../../src/features/common/hooks.ts), [architecture.md §8 and §10](../architecture.md#8-typed-event-model)

## Context

Three kinds of consumer react to story changes: the application controllers (toasts, audio, deferred screen requests, triggers), autosave and analytics, and the React UI. The domain and application layers must not depend on React (ADR-0001). State is naturally split into a few independent slices: the persistent `GameState`, ephemeral UI state, device settings and app-wide notices. Cross-system messages need to be strongly typed and have clear owners, so that content metadata (`eventsConsumed`/`eventsEmitted`) and the integrity checker can refer to real event names.

## Decision

- **Domain events are a closed TypeScript union** (`DomainEvent`, 31 types), split into *facts* and *requests*. `EVENT_OWNERS` records which module is meant to emit each one, and a unit test asserts every type has an owner.
- **`TypedEventBus<E>`** (about 50 lines): handlers are keyed by the `type` discriminant (`on('QuestStarted', e => e.questId)` is fully typed), `onAny` is for broad listeners, and a throwing handler is **isolated** and reported to `onHandlerError` so the other handlers still run.
- **One publisher per session.** `GameSession.publish()` is the only caller of `bus.emit`. It delivers events through a FIFO queue, so re-entrant publishing (a handler that dispatches more effects) keeps a deterministic, breadth-first order. `dispatch()` commits state before publishing.
- **`Store<T>`** (about 25 lines): `getState`, `setState(value | updater)` (a no-op when `Object.is` equal) and `subscribe`. Its shape matches React's `useSyncExternalStore`, which `useStore()` wraps. There is one store per slice: `GameSession.store`, `UiStore` (a subclass with intent-named methods such as `openOverlay` and `setDialogue`, plus the derived `explorationAllowed`), `SettingsService.store` and `services.notices`. There is no global store.
- **React never subscribes to the bus.** It renders stores and calls application methods. Controllers translate events into UI-store changes.

## Consequences

- There are no state-management dependencies, and the whole mechanism is readable in two short files.
- Domain and application code stay React-free and run in Node tests unchanged.
- Event order is deterministic, and the integration tests assert on it (the harness records every event).
- Discipline is manual. Nothing stops a module from constructing an event it doesn't own, and `EVENT_OWNERS` is documentation plus a presence test, not an enforcement mechanism. It currently differs from the code for `JournalEntryUnlocked`, `SaveRequested` and `SaveRestored` (see [architecture.md §16](../architecture.md#16-known-gaps-observed-in-the-code)).
- There is no built-in devtools time-travel. The logger's ring buffer and the harness's event log serve for debugging.

## Alternatives considered

- **Redux / Redux Toolkit.** Good devtools and conventions, but its reducers and actions would duplicate the domain's own pure `(state, effect) → (state, events)` model, and it brings a dependency and patterns that the domain layer cannot use.
- **Zustand, Jotai, MobX, signals.** Lightweight, but they add a dependency whose idioms leak into non-React layers, when all the game needs is `subscribe`/`getState`.
- **Node `EventEmitter` or DOM `EventTarget`.** Built in, but string-typed, and a throwing listener can disrupt emission (for `EventEmitter`). A typed union with handler isolation gives compile-time safety for free.

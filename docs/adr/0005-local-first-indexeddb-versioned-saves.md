# ADR-0005: Local-first persistence in IndexedDB with versioned saves and explicit migrations

- **Status:** Accepted
- **Related:** [src/domain/save.ts](../../src/domain/save.ts), [src/application/save-service.ts](../../src/application/save-service.ts), [src/application/autosaver.ts](../../src/application/autosaver.ts), [src/infrastructure/persistence/indexeddb.ts](../../src/infrastructure/persistence/indexeddb.ts), [src/infrastructure/persistence/memory-repositories.ts](../../src/infrastructure/persistence/memory-repositories.ts), [save-data.md](../save-data.md)

## Context

The game is for families, churches and classrooms, including children. It should work without accounts, servers or an internet connection, and it should collect as little personal data as possible. Players must not lose progress, and progress saved by an older version must still load after updates. Browser storage can't be trusted: records can be damaged, edited, written by a newer version, or unavailable altogether (some private-browsing modes).

## Decision

- **All player data stays on the device**, in the IndexedDB database `witness-game` (`DB_VERSION = 1`) with three object stores: `profiles`, `saves` (index `byProfile` on `profileId`) and `settings`. Only [src/infrastructure/persistence/](../../src/infrastructure/persistence/) may touch IndexedDB (architecture test). There is no backend, and no code in `src/` calls a network API.
- Storage sits behind small ports (`SaveRepository`, `ProfileRepository`, `SettingsRepository`) whose read methods return **raw `unknown` data**. Validation and migration happen in the application layer on **every** read.
- **Saves are versioned.** `SaveGame.schemaVersion` is a literal equal to `CURRENT_SAVE_VERSION` (2). Every older version has a migration in `MIGRATIONS` (today `1 → 2`). `migrateSave(raw)` never throws: it returns `ok` or one of `corrupt`, `unsupported-version` or `migration-failed`. `describeLoadError` turns each into player-facing wording without internals.
- A save loaded from an older version is **written back** in the current format, so migration runs once.
- **Four slots** per profile (`auto`, `manual-1..3`), with ids `${profileId}:${slot}`. Autosave writes the `auto` slot (debounced 600 ms, immediately on chapter completion). Manual slots are written from the pause menu.
- If IndexedDB cannot open, `createRepositories()` falls back to **in-memory repositories** and reports `persistent: false` with a user-visible warning. It also calls `navigator.storage.persist()` on a best-effort basis.
- Save **schema** versioning is independent of the IndexedDB **database** version, which changes only when stores or indexes change.

## Consequences

- The game works offline and without sign-up, and the privacy posture is simple: nothing leaves the device.
- One damaged save never hides the others. `SaveService.list` returns readable saves plus a list of unreadable ones with messages.
- Every change to the persisted shape carries a fixed cost: bump the version, write a migration, add a fixture, extend the tests (checklist in [save-data.md §8](../save-data.md#8-how-to-add-save-version-3)).
- Progress is tied to one browser profile on one device. Clearing site data deletes it, and there is no cross-device sync. [future-aws.md](../future-aws.md) describes the `SyncProvider` seam kept for that.
- The memory fallback keeps the game playable in restricted browsers, but progress is lost when the tab closes, and the player is told so.

## Alternatives considered

- **`localStorage`.** Synchronous, string-only and small (typically a few MB), and it blocks the main thread on large saves. It is explicitly forbidden outside the persistence module by the architecture test.
- **Cloud saves with accounts from day one.** They would give cross-device play, but they need authentication, a backend, data-protection work for children, and an internet connection. They were deferred to a documented extension point.
- **Unversioned saves ("just parse whatever is there").** Simple until the first shape change. After that, old saves either crash the game or silently lose data.
- **Migrating in place inside IndexedDB upgrade callbacks.** That couples save-format changes to database schema changes, and runs migrations without the domain's validation. Migrating at read time in the domain keeps migrations pure and unit-testable against fixtures.

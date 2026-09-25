# ADR-0006: PWA updates use a "prompt" strategy (never swap versions mid-chapter)

- **Status:** Accepted
- **Related:** [vite.config.ts](../../vite.config.ts) (`VitePWA({ registerType: 'prompt', … })`), [src/infrastructure/pwa/register-sw.ts](../../src/infrastructure/pwa/register-sw.ts), [src/app/main.tsx](../../src/app/main.tsx), [src/features/menu/TitleScreen.tsx](../../src/features/menu/TitleScreen.tsx), [e2e/pwa.spec.ts](../../e2e/pwa.spec.ts)

## Context

The game is an installable, offline-capable PWA. A service worker precaches the app, including the lazily loaded Phaser and chapter chunks. When a new version is deployed, a service worker that activates automatically (`skipWaiting` + `clientsClaim`) can put a running page on a new cache while its old code is still loaded. A later lazy `import()` (for example the Phaser chunk when a chapter starts) could then fail or load mismatched code, and an unexpected reload could interrupt a conversation, a puzzle or an unsaved reflection.

## Decision

- `vite-plugin-pwa` is configured with `registerType: 'prompt'`, `injectRegister: false`, and Workbox `skipWaiting: false`, `clientsClaim: false`, `cleanupOutdatedCaches: true`. A new worker installs in the background and **waits**.
- Registration happens in [register-sw.ts](../../src/infrastructure/pwa/register-sw.ts) through `virtual:pwa-register`, loaded with a dynamic import and skipped in development. `onNeedRefresh` sets `notices.updateAvailable`, and `onOfflineReady` sets `notices.offlineReady`. `registerSW` returns `applyUpdate()`, which calls `updateSW(true)` to activate the waiting worker and reload.
- The prompt is shown by the **title screen's** notices: *A new version of the game is ready.* with an **Update now** button. It is not shown during a chapter, so a version swap can only start from the title screen, never mid-chapter. Before the player reaches the title screen, leaving a chapter disposes the `GameRuntime`, which flushes any pending autosave. "Save and quit to title" also writes the `auto` slot.
- If registration fails, it is logged as a warning, and the game works online-only.

## Consequences

- A running chapter never changes code under the player. The version in memory and the chunks it loads stay consistent until the player chooses to update.
- A player who stays in a chapter keeps the running version for the whole session, and it stays usable offline. The in-app prompt never forces activation. Beyond that, the browser's standard service-worker lifecycle decides when a waiting worker activates by itself (once no page is still controlled by the old one).
- There is no in-game update notice; the prompt appears on the title screen. If one is added, it must still leave the swap to an explicit player action (after an autosave), which keeps this decision.
- The e2e test [pwa.spec.ts](../../e2e/pwa.spec.ts) proves that a second launch works fully offline, including starting a chapter (Phaser and the chapter content come from the precache).

## Alternatives considered

- **`autoUpdate` (skip waiting and claim clients immediately).** Players always get the newest version, but it risks mixed-version lazy chunks and mid-session reloads, which is exactly what must never happen during a conversation or puzzle.
- **No service worker.** Simpler, but there is no offline play and no installability, both of which matter for classrooms and families with unreliable connections.
- **Force-reload on the next navigation without asking.** Less intrusive than `autoUpdate`, but still takes the decision away from the player, and there is no natural "navigation" inside a single-page game.

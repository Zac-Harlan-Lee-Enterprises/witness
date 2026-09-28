# ADR-0006: PWA updates use a "prompt" strategy (never swap versions mid-chapter)

- **Status:** Accepted
- **Related:** [vite.config.ts](../../vite.config.ts) (`VitePWA({ registerType: 'prompt', … })`), [src/infrastructure/pwa/register-sw.ts](../../src/infrastructure/pwa/register-sw.ts), [src/app/main.tsx](../../src/app/main.tsx), [src/features/menu/TitleScreen.tsx](../../src/features/menu/TitleScreen.tsx), [e2e/pwa.spec.ts](../../e2e/pwa.spec.ts)

## Context

The game is an installable, offline-capable PWA. A service worker precaches the app, including the lazily loaded Phaser and chapter chunks. When a new version is deployed, a service worker that activates automatically (`skipWaiting` + `clientsClaim`) can put a running page on a new cache while its old code is still loaded. A later lazy `import()` (for example the Phaser chunk when a chapter starts) could then fail or load mismatched code, and an unexpected reload could interrupt a conversation, a puzzle or an unsaved reflection.

## Decision

- `vite-plugin-pwa` is configured with `registerType: 'prompt'`, `injectRegister: false`, and Workbox `skipWaiting: false`, `clientsClaim: false`, `cleanupOutdatedCaches: true`. A new worker installs in the background and **waits**.
- Registration happens in [register-sw.ts](../../src/infrastructure/pwa/register-sw.ts) through `virtual:pwa-register`, loaded with a dynamic import and skipped in development. `onNeedRefresh` sets `notices.updateAvailable`, and `onOfflineReady` sets `notices.offlineReady`. `registerSW` returns `applyUpdate()`, which calls `updateSW(true)` to activate the waiting worker and reload.
- The prompt is shown by the **title screen's** notices: *A new version of the game is ready.* with an **Update now** button. Before the player reaches the title screen, leaving a chapter disposes the `GameRuntime`, which flushes any pending autosave. "Save and quit to title" also writes the `auto` slot.
- **During a chapter** (added 2026-09-26) the same offer waits in the **pause menu**, as **Save and update**: it flushes the autosave, writes the `auto` slot, then activates the new version. The HUD's **Menu** button shows a dot and reads *a new version is ready*. Nothing swaps until the player chooses, and the pause menu is never open during a conversation or puzzle step.
- **Outside a chapter, a new version is swapped in at once** (added 2026-09-28): on the title, profiles or chapter select screens (or an error) nothing can be interrupted, so the app activates the waiting worker and reloads without asking (`updatesAtOnce` in [update-policy.ts](../../src/app/update-policy.ts)). Players who never pressed **Update now** had kept an old version for days; the owner saw the old portraits again. Inside a chapter, a teaser or while one loads, the swap still waits for **Save and update**.
- **A game left open asks for new versions** (added 2026-09-26): every hour and on coming back to the tab or app, at most every ten minutes (`watchForUpdates` in [update-checks.ts](../../src/infrastructure/pwa/update-checks.ts)). The browser itself only asks when the page loads.
- If registration fails, it is logged as a warning, and the game works online-only.

## Consequences

- A running chapter never changes code under the player. The version in memory and the chunks it loads stay consistent until the player chooses to update.
- A player who stays in a chapter keeps the running version for the whole session, and it stays usable offline. The in-app prompt never forces activation. Beyond that, the browser's standard service-worker lifecycle decides when a waiting worker activates by itself (once no page is still controlled by the old one).
- Before 2026-09-26 the offer was only on the title screen, and the browser only checked for a new version when the page loaded. A player who went straight back into their game, or left it open, kept an old version for hours. The owner saw the old drawn portraits on the live site long after the rendered ones had shipped. The in-game offer and the periodic checks close that gap, and the swap is still an explicit player action after an autosave.
- The e2e test [pwa.spec.ts](../../e2e/pwa.spec.ts) proves that a second launch works fully offline, including starting a chapter (Phaser and the chapter content come from the precache).

## Alternatives considered

- **`autoUpdate` (skip waiting and claim clients immediately).** Players always get the newest version, but it risks mixed-version lazy chunks and mid-session reloads, which is exactly what must never happen during a conversation or puzzle.
- **No service worker.** Simpler, but there is no offline play and no installability, both of which matter for classrooms and families with unreliable connections.
- **Force-reload on the next navigation without asking.** Less intrusive than `autoUpdate`, but still takes the decision away from the player, and there is no natural "navigation" inside a single-page game.

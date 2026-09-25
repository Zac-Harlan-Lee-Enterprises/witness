# ADR-0007: Settings are device-level, shared by all profiles (accessibility applies before profile choice)

- **Status:** Accepted
- **Related:** [src/domain/settings.ts](../../src/domain/settings.ts), [src/application/settings-service.ts](../../src/application/settings-service.ts), [src/app/services.ts](../../src/app/services.ts), [src/app/App.tsx](../../src/app/App.tsx) (`applySettingsToDocument`), [src/infrastructure/persistence/indexeddb.ts](../../src/infrastructure/persistence/indexeddb.ts), [src/domain/profile.ts](../../src/domain/profile.ts)

## Context

Several people (a family, a classroom) may share one device through local profiles. Many settings are accessibility needs: text size, a dyslexia-friendly or hyperlegible font, high contrast, reduced motion, dialogue speed, instant travel, captions, key remapping. A player who needs large text or reduced motion must get it **on the very first screen**, before they can read the profile list or create a profile. Settings tied to a profile would only take effect after a profile is chosen.

## Decision

- `GameSettings` is **one record per device**. It lives in the IndexedDB `settings` store under the fixed key `'device'`. `PlayerProfile` has no settings fields: it holds only an id, nickname, look, timestamps and completed chapters.
- Settings are loaded **before the first render**. `createAppServices()` awaits `settings.load()` before `main.tsx` renders `<App>`. `App` then applies them to `document.documentElement` (`data-contrast`, `data-font`, `data-motion`, and the `--text-scale` CSS variable) on every change.
- The settings panel is reachable from the title screen and from the in-game pause menu.
- Stored settings are parsed with `parseSettings`, which falls back **field by field** to `DEFAULT_SETTINGS` and never throws. That way a single bad field doesn't reset a player's accessibility choices. `GameSettings.version` (currently `1`) versions this record separately from saves.
- Anonymous statistics consent (`analyticsConsent`, default `false`) is also a device setting, so a parent or teacher decides once for the device.

## Consequences

- Accessibility applies everywhere, including the title, profile and chapter screens, and it survives switching profiles.
- All profiles on a device share key bindings, volumes, dialogue speed and the analytics choice. A family where one child needs instant travel and another does not has to toggle it, which was judged an acceptable trade-off for a shared device.
- The settings record is small and separate from saves, so deleting a profile (which deletes its saves) never touches settings.
- If per-profile preferences are ever needed, they should be added as **overrides layered on top of** device settings, so the "before profile choice" guarantee holds.

## Alternatives considered

- **Per-profile settings.** More personal, but accessibility would not apply until after a profile is picked, and every new profile would start inaccessible.
- **Per-profile settings plus a separate "device accessibility" subset.** It covers both needs, at the cost of two places to look and a merge rule. It was deferred until there is a demonstrated need.
- **`localStorage` for settings** (synchronous, so no flash of default styles). The architecture test forbids it outside the persistence module, and loading settings before first render already removes the flash.

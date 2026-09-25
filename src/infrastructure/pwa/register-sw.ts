import type { Logger } from '@/shared/logger';

/**
 * Service-worker registration with a SAFE update flow: a new version waits
 * until the player chooses to reload (after an autosave), so an update never
 * interrupts a conversation or a puzzle. Registration failure is non-fatal —
 * the game simply works online-only.
 */
export interface PwaHandle {
  applyUpdate: () => Promise<void>;
}

export async function registerServiceWorker(options: {
  onUpdateAvailable: () => void;
  onOfflineReady: () => void;
  logger: Logger;
}): Promise<PwaHandle | null> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return null;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh: options.onUpdateAvailable,
      onOfflineReady: options.onOfflineReady,
      onRegisterError: (error: unknown) =>
        options.logger.warn('Service worker registration failed', error),
    });
    return { applyUpdate: () => updateSW(true) };
  } catch (error) {
    options.logger.warn('PWA support unavailable', error);
    return null;
  }
}

import type { Logger } from '@/shared/logger';
import { watchForUpdates } from './update-checks';

/**
 * Service-worker registration with a SAFE update flow: a new version waits
 * until the player chooses to reload (after an autosave), so an update never
 * interrupts a conversation or a puzzle. A game left open still asks for new
 * versions (`watchForUpdates`). Registration failure is non-fatal — the game
 * simply works online-only.
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
      onRegisteredSW: (_url: string, registration: ServiceWorkerRegistration | undefined) => {
        if (!registration) return;
        watchForUpdates(() => registration.update(), {
          now: () => Date.now(),
          setInterval: (fn, ms) => window.setInterval(fn, ms),
          onVisible: (fn) =>
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') fn();
            }),
        });
      },
      onRegisterError: (error: unknown) =>
        options.logger.warn('Service worker registration failed', error),
    });
    return { applyUpdate: () => updateSW(true) };
  } catch (error) {
    options.logger.warn('PWA support unavailable', error);
    return null;
  }
}

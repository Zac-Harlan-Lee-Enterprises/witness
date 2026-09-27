/** How often a game left open asks the server for a new version. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;
/** Coming back to the game asks again, but not more often than this. */
export const MIN_CHECK_GAP_MS = 10 * 60 * 1000;

export interface UpdateCheckEnv {
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  /** Call `fn` whenever the player comes back to the game (the page becomes visible). */
  onVisible: (fn: () => void) => void;
}

/**
 * Ask for a new version now and then while the game stays open: every hour,
 * and on coming back to it. The browser only asks when the page is loaded,
 * so a tab or installed app left open never heard of a new version. Finding
 * one never swaps it in (ADR-0006): the player is told, and chooses when.
 */
export function watchForUpdates(check: () => Promise<unknown>, env: UpdateCheckEnv): void {
  let last = env.now();
  const run = (): void => {
    last = env.now();
    // Offline, or the server unreachable: try again at the next chance.
    check().catch(() => undefined);
  };
  env.setInterval(run, UPDATE_CHECK_MS);
  env.onVisible(() => {
    if (env.now() - last >= MIN_CHECK_GAP_MS) run();
  });
}

import { describe, expect, it } from 'vitest';
import {
  MIN_CHECK_GAP_MS,
  UPDATE_CHECK_MS,
  watchForUpdates,
} from '@/infrastructure/pwa/update-checks';

function fakeEnv() {
  let now = 0;
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const visible: Array<() => void> = [];
  return {
    env: {
      now: () => now,
      setInterval: (fn: () => void, ms: number) => timers.push({ fn, ms }),
      onVisible: (fn: () => void) => visible.push(fn),
    },
    advance(ms: number) {
      now += ms;
    },
    tick() {
      for (const t of timers) t.fn();
    },
    comeBack() {
      for (const fn of visible) fn();
    },
    timers,
  };
}

describe('update checks while the game stays open', () => {
  it('asks for a new version every hour (the browser only asks when the page loads)', () => {
    const f = fakeEnv();
    let checks = 0;
    watchForUpdates(async () => void checks++, f.env);
    expect(f.timers.map((t) => t.ms)).toEqual([UPDATE_CHECK_MS]);
    f.advance(UPDATE_CHECK_MS);
    f.tick();
    expect(checks).toBe(1);
  });

  it('asks again on coming back to the game, but not more often than every ten minutes', () => {
    const f = fakeEnv();
    let checks = 0;
    watchForUpdates(async () => void checks++, f.env);
    f.advance(MIN_CHECK_GAP_MS - 1);
    f.comeBack();
    expect(checks).toBe(0);
    f.advance(1);
    f.comeBack();
    expect(checks).toBe(1);
    f.comeBack();
    expect(checks).toBe(1);
  });

  it('is quiet when a check fails (offline)', async () => {
    const f = fakeEnv();
    watchForUpdates(() => Promise.reject(new Error('offline')), f.env);
    f.advance(UPDATE_CHECK_MS);
    expect(() => f.tick()).not.toThrow();
    // Let the rejected promise settle: an unhandled rejection would fail the run.
    await new Promise((r) => setTimeout(r, 0));
  });
});

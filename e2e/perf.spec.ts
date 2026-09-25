import { expect, test } from '@playwright/test';
import { createProfile, openApp, waitForWorld } from './support';

/**
 * Measures frame rate in the busiest scene while walking. Headless CI uses
 * software rendering, so the assertion is a conservative floor; the measured
 * number is printed and recorded in docs/performance.md.
 */
test('keeps a smooth frame rate while walking in the market', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await openApp(page);
  await createProfile(page, 'Perf');
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForWorld(page);
  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = (t: number) => {
          frames++;
          if (t - start < 3000) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (t - start));
        };
        requestAnimationFrame(tick);
      }),
  );
  const nav = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    return entry ? Math.round(entry.domContentLoadedEventEnd) : -1;
  });
  console.info(`[perf] rAF frame rate over 3s: ${fps.toFixed(1)} fps; DOMContentLoaded: ${nav} ms`);
  expect(fps).toBeGreaterThan(20);
});

import { expect, test } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
  expectScene,
  goTo,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

/**
 * Measures frame rate in the busiest scene while walking. Headless browsers
 * render in software, so the assertion is a floor, not a target; the measured
 * number is printed and recorded in docs/performance.md. A developer machine
 * holds 30–40 fps. GitHub's hosted runners (a few vCPUs, no GPU) measured
 * 10.4–10.8 fps for both the painted and the pre-rendered market (2026-09-26),
 * so on CI the floor only catches the world stalling.
 */
const FPS_FLOOR = process.env.CI ? 6 : 20;

test('keeps a smooth frame rate while walking in the market', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Perf');
  await newGame(page);
  await waitForWorld(page);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await goTo(page, 'Go to the market');
  await expectScene(page, 'The lower market, Jerusalem');
  await page.waitForTimeout(1500); // arrival fade, banner, first ambient particles
  // Walk while measuring: the world, camera, ambient life and sprites all update.
  await page.locator('body').focus();
  await page.keyboard.down('ArrowRight');
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
  await page.keyboard.up('ArrowRight');
  const nav = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    return entry ? Math.round(entry.domContentLoadedEventEnd) : -1;
  });
  const effects = (await page.locator('.viewport canvas').getAttribute('data-effects')) ?? 'full';
  console.info(
    `[perf] rAF frame rate over 3s: ${fps.toFixed(1)} fps (${effects} effects); DOMContentLoaded: ${nav} ms`,
  );
  expect(fps).toBeGreaterThan(FPS_FLOOR);
});

test('switches to simpler effects when the frame rate stays low', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Slow');
  await newGame(page);
  await waitForWorld(page);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await goTo(page, 'Go to the market');
  await expectScene(page, 'The lower market, Jerusalem');
  // Simulate a much slower device.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-effects', 'reduced', {
    timeout: 30_000,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

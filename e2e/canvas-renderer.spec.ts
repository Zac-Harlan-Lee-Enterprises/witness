import { expect, test } from '@playwright/test';
import { choose, continueDialogue, goTo } from './support';
import { canvas, data, picture, stormAfterShimon, toMarket } from './world-probe';

/**
 * Without WebGL, Phaser falls back to its Canvas renderer. The world must
 * still be drawn with its light layer (a multiply blend that once covered
 * the whole view) and its weather; shaders and post-processing are off.
 */
test.use({ launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } });

test('the Canvas renderer still draws the world, with its light and weather', async ({ page }) => {
  test.skip(!!process.env.E2E_SHOTS, 'not a capture run');
  test.setTimeout(120_000);
  await stormAfterShimon(page);
  await toMarket(page);
  await expect(canvas(page)).toHaveAttribute('data-renderer', 'canvas');
  await expect(canvas(page)).toHaveAttribute('data-post-fx', 'off');
  await page.waitForTimeout(2000);
  // The light layer multiplies the world; it must not cover it (a flat wash).
  const clear = await picture(page);
  expect(clear.spread, 'the market is drawn, not a flat wash').toBeGreaterThan(20);
  await goTo(page, 'Talk to Old Shimon');
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await continueDialogue(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'storm');
  await expect
    .poll(async () => Number(await data(page, 'weather-drops')), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

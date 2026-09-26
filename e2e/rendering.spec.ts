import { expect, test } from '@playwright/test';
import { choose, continueDialogue, endDialogue, goTo } from './support';
import { brightness, canvas, data, stormAfterShimon, toMarket } from './world-probe';

/**
 * The world's rendering engine, end to end:
 *
 * 1. Weather follows the story: the market's content is given a storm that
 *    rises once Old Shimon has warned you about the bend and clears once he
 *    has told you about the cistern (content is data, so the test adds the
 *    rule on the fly), and the world visibly darkens and rains, then clears.
 *    The picture is compared within one conversation, so the camera holds still.
 * 2. Reduced motion: the same storm darkens the light but nothing falls.
 *
 * High-DPI rendering is covered by high-dpi.spec.ts, the Canvas fallback by
 * canvas-renderer.spec.ts.
 */
test('the weather follows the story: a storm rises, then clears', async ({ page }) => {
  test.skip(!!process.env.E2E_SHOTS, 'not a capture run');
  test.setTimeout(180_000);
  await stormAfterShimon(page);
  await toMarket(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'clear');
  await goTo(page, 'Talk to Old Shimon');
  await page.waitForTimeout(3000); // the conversation camera settles
  const clear = await brightness(page);
  expect(Number(await data(page, 'weather-drops'))).toBe(0);

  // He warns you about the bend: the storm rises.
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await continueDialogue(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'storm');
  await page.waitForTimeout(6000);
  const stormy = await brightness(page);
  expect(Number(await data(page, 'weather-drops'))).toBeGreaterThan(50);
  expect(stormy, 'a storm darkens the market').toBeLessThan(clear - 12);

  // He tells you about the cistern: the storm passes, more slowly than it came.
  await choose(page, 'Is there any water on the way?');
  await expect(canvas(page)).toHaveAttribute('data-weather', 'clear');
  await expect
    .poll(() => brightness(page), {
      message: 'the light comes back as the storm passes',
      timeout: 30_000,
      intervals: [2000],
    })
    .toBeGreaterThan(stormy + 8);
  expect(Number(await data(page, 'weather-wet')), 'the ground is still wet').toBeGreaterThan(0);
  await choose(page, 'That could save a lot of weight in my satchel.');
  await choose(page, 'Goodbye, Shimon.');
  await endDialogue(page);
});

test('with reduced motion a storm darkens the light but nothing falls', async ({ page }) => {
  test.skip(!!process.env.E2E_SHOTS, 'not a capture run');
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stormAfterShimon(page);
  await toMarket(page);
  await goTo(page, 'Talk to Old Shimon');
  await page.waitForTimeout(1500);
  const clear = await brightness(page);
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await continueDialogue(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'storm');
  await page.waitForTimeout(5000);
  expect(await data(page, 'weather-drops')).toBe('0');
  expect(await data(page, 'weather-dust')).toBe('0');
  expect(await brightness(page)).toBeLessThan(clear - 12);
});

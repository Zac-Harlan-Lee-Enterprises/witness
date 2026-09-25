import { expect, test, type Page } from '@playwright/test';
import { choose, createProfile, endDialogue, goTo, openApp } from './support';

/**
 * "The world responds": exactly one canvas, keyboard walking changes what's on
 * screen, and moving to another place redraws the world. Runs against the
 * production build AND the dev server — React StrictMode in development once
 * left a frozen duplicate canvas on top, which the production-only tests
 * could not see.
 */
async function canvasPixels(page: Page): Promise<string> {
  return (await page.locator('.viewport canvas').screenshot()).toString('base64');
}

test('one canvas; walking and changing place visibly update the world', async ({ page }) => {
  await openApp(page);
  await createProfile(page, 'Walker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.locator('.viewport canvas')).toHaveCount(1, { timeout: 30_000 });
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await page.waitForTimeout(500);
  await expect(page.locator('.viewport canvas')).toHaveCount(1);

  const before = await canvasPixels(page);
  await page.locator('body').focus();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(300);
  const afterWalk = await canvasPixels(page);
  expect(afterWalk, 'walking with the keyboard should change the picture').not.toBe(before);

  await goTo(page, 'Go to the market');
  await expect(page.locator('.hud__scene')).toHaveText('The lower market, Jerusalem', {
    timeout: 15_000,
  });
  await page.waitForTimeout(800);
  await expect(page.locator('.viewport canvas')).toHaveCount(1);
  expect(await canvasPixels(page), 'the market should be drawn, not the house').not.toBe(afterWalk);
});

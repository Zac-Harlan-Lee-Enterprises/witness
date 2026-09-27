import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  createProfile,
  expectScene,
  newGame,
  openApp,
  setFastSettings,
  snap,
  waitForWorld,
} from './support';

/**
 * The teaser film before Chapter 1: it plays before a profile's first new
 * game, can be skipped by button or keyboard, is stills and words under
 * reduced motion or when the film can't load, and can be watched again from
 * chapter select. E2E_SHOTS=1 writes captures to test-results/shots/.
 */
const teaser = (page: Page) => page.getByRole('dialog', { name: /teaser/i });
const words = (page: Page) => page.locator('.teaser__words');

async function start(page: Page, name: string): Promise<void> {
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, name);
  await newGame(page, 'The Road to Jericho', { teaser: 'keep' });
  await expect(teaser(page)).toBeVisible();
}

test('plays before a first new game of Chapter 1, then the chapter begins', async ({ page }) => {
  await start(page, 'Film');
  const film = teaser(page).locator('video');
  await expect(film).toHaveJSProperty('muted', true);
  // The film really plays, and its words come up as text over it.
  await expect
    .poll(() => film.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 })
    .toBeGreaterThan(1.2);
  await expect(words(page)).toContainText('Jerusalem. Before the heat of the day.');
  await expect(teaser(page).getByRole('button', { name: 'Skip' })).toBeFocused();
  await snap(page, 'teaser-01-playing');
  // Pause and play.
  await teaser(page).getByRole('button', { name: 'Pause' }).click();
  await expect(film).toHaveJSProperty('paused', true);
  await teaser(page).getByRole('button', { name: 'Play' }).click();
  await expect(film).toHaveJSProperty('paused', false);
  const results = await new AxeBuilder({ page }).include('.teaser').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await teaser(page).getByRole('button', { name: 'Skip' }).click();
  await waitForWorld(page);
  await expectScene(page, 'Aunt Miriam’s house');
  await snap(page, 'teaser-02-after-skip');

  // Seen once, it doesn't play again by itself.
  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /Film/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
  await page
    .getByRole('listitem', { name: 'The Road to Jericho' })
    .getByRole('button', { name: 'New game' })
    .click();
  const confirm = page.getByRole('button', { name: 'Start new game' });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await waitForWorld(page);
  await expect(teaser(page)).toHaveCount(0);
});

test('Escape skips the teaser', async ({ page }) => {
  await start(page, 'Keys');
  await page.keyboard.press('Escape');
  await expect(teaser(page)).toHaveCount(0);
  await waitForWorld(page);
});

test('under reduced motion shows the poster, and the words step by Next', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, 'Still');
  await expect(teaser(page).locator('video')).toHaveCount(0);
  await expect(teaser(page).locator('img.teaser__film')).toBeVisible();
  await expect(words(page)).toContainText('Jerusalem. Before the heat of the day.');
  await teaser(page).getByRole('button', { name: 'Next' }).click();
  await expect(words(page)).toContainText('Natan');
  await snap(page, 'teaser-03-reduced-motion');
  await teaser(page).getByRole('button', { name: 'Skip' }).click();
  await waitForWorld(page);
});

test('when the film cannot load, the poster and words stand in and never block', async ({
  page,
}) => {
  await page.route(/\/art\/teaser\/.+\.(webm|mp4)/, (route) => route.abort());
  await start(page, 'Offline');
  await expect(teaser(page).getByRole('button', { name: 'Next' })).toBeVisible({ timeout: 15_000 });
  await expect(words(page)).toContainText('Jerusalem.');
  await teaser(page).getByRole('button', { name: 'Skip' }).click();
  await waitForWorld(page);
});

test('can be watched again from chapter select', async ({ page }) => {
  await openApp(page);
  await createProfile(page, 'Again');
  await page.getByRole('button', { name: 'Watch the teaser' }).click();
  await expect(teaser(page)).toBeVisible();
  await snap(page, 'teaser-04-from-chapter-select');
  await teaser(page).getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
  await snap(page, 'teaser-05-chapter-select');
});

test('fits a phone screen, controls in reach, text readable', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await start(page, 'Phone');
  const skip = teaser(page).getByRole('button', { name: 'Skip' });
  const box = await skip.boundingBox();
  expect(box && box.x + box.width <= 412 && box.y + box.height <= 915).toBe(true);
  expect(box && box.height >= 44).toBe(true);
  await expect(words(page)).toContainText('Jerusalem.', { timeout: 15_000 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(412);
  await snap(page, 'teaser-06-phone');
  await page.setViewportSize({ width: 915, height: 412 });
  await snap(page, 'teaser-07-phone-landscape');
  await skip.click();
  await waitForWorld(page);
});

import { expect, test } from '@playwright/test';
import {
  choose,
  createProfile,
  expectScene,
  goTo,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

test('installs a service worker and keeps working offline after the first visit', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'service-worker offline test runs on Chromium');
  await openApp(page);
  // Wait for the worker to finish activating (precache complete), then relaunch once online.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  // The music, once heard online, is stored whole for offline play: the
  // track that plays first, then the others (src/infrastructure/audio/music-cache.ts).
  const html = page.locator('html');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(html).toHaveAttribute('data-music-playing', 'true');
  await expect
    .poll(
      () => page.evaluate(async () => (await (await caches.open('witness-music')).keys()).length),
      { timeout: 60_000 },
    )
    .toBe(4);

  // Relaunch with no network at all.
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  // The music plays from the cache, answered in byte ranges as the <audio> element asks.
  await page.getByRole('heading', { level: 1 }).click();
  await expect(html).toHaveAttribute('data-music', 'cinematic-oud-and-qanun');
  await expect(html).toHaveAttribute('data-music-playing', 'true');
  await setFastSettings(page);
  await createProfile(page, 'Offline');
  await newGame(page);
  await waitForWorld(page); // Phaser + chapter content come from the precache
  await expect(page.locator('.hud__scene')).toHaveText('Aunt Miriam’s house');
  // Neutral portraits are precached; an expression never seen before can't
  // load offline, so Aunt Miriam's neutral portrait stands in for it.
  const box = page.locator('section.dialogue');
  for (
    let i = 0;
    i < 3 && !(await page.locator('#dialogue-speaker').textContent())?.includes('Miriam');
    i++
  )
    await box.getByRole('button', { name: /^(Continue|Show all text)$/ }).click();
  const portrait = box.locator('.dialogue__portrait img.portrait');
  await expect(portrait).toHaveAttribute('data-portrait', 'miriam');
  await expect
    .poll(() => portrait.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)))
    .toBeGreaterThan(0);
  // Every place's morning art is precached: the house and the market are
  // drawn from it offline, not painted.
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-art', 'prerendered:day');
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await page
    .locator('section.dialogue')
    .getByRole('button', { name: /^(Continue|End conversation)$/ })
    .click();
  await goTo(page, 'Go to the market');
  await expectScene(page, 'The lower market, Jerusalem');
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-art', 'prerendered:day');
  await context.setOffline(false);
});

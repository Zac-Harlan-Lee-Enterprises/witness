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

  // Relaunch with no network at all.
  await context.setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await setFastSettings(page);
  await createProfile(page, 'Offline');
  await newGame(page);
  await waitForWorld(page); // Phaser + chapter content come from the precache
  await expect(page.locator('.hud__scene')).toHaveText('Aunt Miriam’s house');
  // The market's pre-rendered art is precached too: it is drawn from it, not painted.
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

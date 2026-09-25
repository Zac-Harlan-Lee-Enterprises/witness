import { expect, test } from '@playwright/test';
import { createProfile, openApp, waitForWorld } from './support';

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
  await createProfile(page, 'Offline');
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForWorld(page); // Phaser + chapter content come from the precache
  await expect(page.locator('.hud__scene')).toHaveText('Aunt Miriam’s house');
  await context.setOffline(false);
});

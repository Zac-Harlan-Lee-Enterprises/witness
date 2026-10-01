import { expect, test, type Page } from '@playwright/test';
import { createProfile, newGame, openApp, setFastSettings, waitForWorld } from './support';

/**
 * The recorded music, observed through the document element's data-music,
 * data-music-playing and data-music-volume (src/app/services.ts), so the
 * tests don't have to listen.
 */
const music = (page: Page) => page.locator('html');
const OUD = 'cinematic-oud-and-qanun';

test('music waits for a gesture, then follows mute and the music volume', async ({ page }) => {
  await openApp(page);
  await expect(music(page)).toHaveAttribute('data-music', OUD);
  // Nothing may play before the player has touched the page.
  await page.waitForTimeout(500);
  await expect(music(page)).toHaveAttribute('data-music-playing', 'false');
  await page.getByRole('heading', { level: 1 }).click();
  await expect(music(page)).toHaveAttribute('data-music-playing', 'true');

  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByLabel('Mute all sound').check();
  await expect(music(page)).toHaveAttribute('data-music-playing', 'false');
  await expect(music(page)).toHaveAttribute('data-music-volume', '0');
  await settings.getByLabel('Mute all sound').uncheck();
  await expect(music(page)).toHaveAttribute('data-music-playing', 'true');
  await expect(music(page)).toHaveAttribute('data-music-volume', '0.4'); // 80% × 50%
  const volume = settings.getByRole('slider', { name: /^Music volume/ });
  await volume.fill('0');
  await expect(music(page)).toHaveAttribute('data-music-playing', 'false');
  await volume.fill('1');
  await expect(music(page)).toHaveAttribute('data-music-volume', '0.8');
  await expect(music(page)).toHaveAttribute('data-music-playing', 'true');
  await settings.getByRole('button', { name: 'Done' }).click();
});

test('the game plays on, silently, when the music files cannot be loaded', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/audio/music/**', (route) => route.abort());
  await openApp(page);
  await page.getByRole('heading', { level: 1 }).click();
  await setFastSettings(page);
  await createProfile(page, 'Quiet');
  await newGame(page);
  await waitForWorld(page);
  await expect(page.locator('.hud__scene')).toHaveText('Aunt Miriam’s house');
  await expect(music(page)).toHaveAttribute('data-music', OUD);
  await expect(music(page)).toHaveAttribute('data-music-playing', 'false');
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

import { expect, test } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

test('starts cleanly with no console errors, on every viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openApp(page);
  await expect(page).toHaveTitle('Witness: A Journey Through Scripture');
  await createProfile(page, 'Smoke');
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForWorld(page);
  await expect(page.locator('section.dialogue')).toBeVisible();
  // HUD must not overflow horizontally on small screens.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('serves a valid web app manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: 'Witness: A Journey Through Scripture',
    short_name: 'Witness',
    display: 'standalone',
  });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
});

test('keyboard-only play: move with keys and talk with E', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test runs on desktop');
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Keys');
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForWorld(page);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  // Walk up toward Aunt Miriam with the arrow key, then press E.
  await page.locator('body').focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowUp');
  await expect(page.getByRole('button', { name: /Talk to Aunt Miriam/ })).toBeVisible({
    timeout: 5000,
  });
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog', { name: /Aunt Miriam/ })).toBeVisible();
  await page
    .getByRole('dialog', { name: /Aunt Miriam/ })
    .getByRole('button')
    .first()
    .press('Escape');
});

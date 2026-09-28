import { expect, test, type Locator } from '@playwright/test';
import { createProfile, newGame, openApp, setFastSettings, waitForWorld } from './support';

/** A rendered portrait that has actually loaded (not a broken image). */
async function expectLoaded(img: Locator): Promise<void> {
  await expect(img).toHaveAttribute('alt', '');
  await expect(img).toHaveAttribute('aria-hidden', 'true');
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)))
    .toBeGreaterThan(0);
}

test('rendered portraits load in the look picker, chapter select and conversation', async ({
  page,
}) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  // Skipping the teaser cancels its film's download: that isn't a failure.
  page.on('requestfailed', (r) => {
    if (!r.url().includes('/art/teaser/')) failed.push(`failed ${r.url()}`);
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Play' }).click();
  const looks = page.getByRole('group', { name: 'Choose your look' }).locator('img.portrait');
  await expect(looks).toHaveCount(4);
  for (const img of await looks.all()) await expectLoaded(img);

  await page.getByLabel('Nickname').fill('Portraits');
  await page.getByRole('button', { name: 'Create and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
  await expectLoaded(page.locator('.player-banner img.portrait'));

  await newGame(page);
  await waitForWorld(page);
  const box = page.locator('section.dialogue');
  await expect(box).toBeVisible();
  // The narrator opens; then Aunt Miriam speaks, with her portrait.
  await box.getByRole('button', { name: /^(Continue|Show all text)$/ }).click();
  if (await box.getByRole('button', { name: 'Continue' }).isVisible())
    await box.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#dialogue-speaker')).toContainText('Aunt Miriam');
  const portrait = box.locator('.dialogue__portrait img.portrait');
  await expect(portrait).toHaveAttribute('data-portrait', 'miriam');
  // Her first line is glad; her next, worried: each face from its own file.
  await expect(portrait).toHaveAttribute('data-expression', 'glad');
  await expectLoaded(portrait);
  await expect(portrait).toHaveAttribute('src', /\/art\/portraits\/glad\/miriam-256\.webp$/);
  if (await box.getByRole('button', { name: 'Show all text' }).isVisible())
    await box.getByRole('button', { name: 'Show all text' }).click();
  await box.getByRole('button', { name: 'Continue' }).click();
  await expect(portrait).toHaveAttribute('data-expression', 'worried');
  await expectLoaded(portrait);
  expect(failed).toEqual([]);
});

test('a later chapter’s namesake has her own portrait (Tamar, the mother, in Chapter 3)', async ({
  page,
}) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Portraits');
  await newGame(page, 'A Journey to Bethlehem');
  await waitForWorld(page);
  // Chapter 2's Tamar (a cousin) and Chapter 3's (the player's mother) are
  // different people with different portraits. The narrator may open first.
  const box = page.locator('section.dialogue');
  const speaker = page.locator('#dialogue-speaker');
  for (let i = 0; i < 4 && !(await speaker.textContent())?.includes('Tamar'); i++)
    await box.getByRole('button', { name: /^(Continue|Show all text)$/ }).click();
  await expect(speaker).toContainText('Tamar');
  const portrait = page.locator('section.dialogue .dialogue__portrait img.portrait');
  await expect(portrait).toHaveAttribute('data-portrait', 'tamar.journey-to-bethlehem');
  await expectLoaded(portrait);
  expect(failed).toEqual([]);
});

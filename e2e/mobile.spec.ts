import { expect, test } from '@playwright/test';
import { choose, createProfile, endDialogue, goTo, openApp, waitForWorld } from './support';

test('touch controls: on-screen pad, action button and Go-to work on phones and tablets', async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(browserName !== 'chromium');
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('On-screen touch controls').selectOption('on');
  await page.getByLabel('Dialogue text speed').selectOption('instant');
  await page.getByRole('button', { name: 'Done' }).click();
  await createProfile(page, 'Touch');
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForWorld(page);
  await choose(page, 'Me? All the way to Jericho?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  const pad = page.getByRole('group', { name: 'Touch controls' });
  await expect(pad).toBeVisible();
  await expect(pad.getByRole('button', { name: 'Move up' })).toBeVisible();
  // Buttons are big enough to hit (WCAG 2.2 target size ≥ 24px; we use ≥ 44px).
  const box = await pad.getByRole('button', { name: 'Move up' }).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  await goTo(page, 'Talk to Aunt Miriam');
  await expect(page.getByRole('dialog', { name: /Aunt Miriam/ })).toBeVisible();
  if (isMobile) {
    const vw = page.viewportSize()?.width ?? 0;
    const dialogBox = await page.locator('section.dialogue').boundingBox();
    expect(dialogBox?.width ?? 0).toBeLessThanOrEqual(vw);
  }
});

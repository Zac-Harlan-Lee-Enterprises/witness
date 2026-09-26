import { expect, test } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
  goTo,
  newGame,
  openApp,
  waitForWorld,
} from './support';
import { canvas, data } from './world-probe';

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
  await newGame(page);
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

test('phones load the half-resolution art, places and people; tablets and desktops the full', async ({
  page,
  isMobile,
}) => {
  // Pixel 7 (mobile-chromium) is a phone; the tablet project (820 × 1180,
  // touch) and desktops are not. Checked in the first place, before automatic
  // quality could lower anything.
  const phone = isMobile && (page.viewportSize()?.width ?? 0) < 600;
  await openApp(page);
  await createProfile(page, 'Memory');
  await newGame(page);
  await waitForWorld(page);
  const world = canvas(page);
  await expect(world).toHaveAttribute('data-art', /^prerendered:/);
  const ppu = phone ? '1.5' : '3';
  await expect(world).toHaveAttribute('data-art-ppu', ppu);
  await expect(world).toHaveAttribute('data-people-ppu', ppu);
  // The half-resolution art is about a quarter of the full art's texture memory.
  const mb = Number(await data(page, 'texture-mb'));
  expect(mb).toBeGreaterThan(0);
  if (phone) expect(mb).toBeLessThan(12);
});

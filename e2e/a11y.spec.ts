import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([]);
}

test('menus, settings and in-game overlays pass automated WCAG checks (incl. colour contrast)', async ({
  page,
}) => {
  await openApp(page);
  await scan(page, 'title');
  await page.getByRole('button', { name: 'Settings' }).click();
  await scan(page, 'settings');
  await page.getByLabel('High contrast').check();
  await scan(page, 'settings (high contrast)');
  await page.getByLabel('High contrast').uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
  await setFastSettings(page);
  await createProfile(page, 'Axe');
  await scan(page, 'chapter select');
  await newGame(page);
  await waitForWorld(page);
  await scan(page, 'dialogue');
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await scan(page, 'HUD');
  await page.getByRole('button', { name: /^Journal/ }).click();
  await scan(page, 'journal');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Quests/ }).click();
  await scan(page, 'quests');
  await page.keyboard.press('Escape');

  // High contrast inside the game, not just on the Settings screen.
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.getByRole('button', { name: 'Recent messages' }).click();
  await scan(page, 'recent messages');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page
    .getByRole('dialog', { name: 'Paused' })
    .getByRole('button', { name: 'Settings' })
    .click();
  await page.getByLabel('High contrast').check();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toHaveCount(0);
  await scan(page, 'HUD (high contrast)');
  await page.getByRole('button', { name: /^Journal/ }).click();
  await scan(page, 'journal (high contrast)');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Go to/ }).click();
  await scan(page, 'go to (high contrast)');
});

test('200% text still fits a 320 px-wide screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await openApp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Text size').fill('2');
  await expect(page.locator('html')).toHaveCSS('--text-scale', '2');
  expect(await overflow(), 'settings').toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Done' }).click();
  expect(await overflow(), 'title').toBeLessThanOrEqual(1);
  await setFastSettings(page);
  await createProfile(page, 'Big');
  expect(await overflow(), 'chapter select').toBeLessThanOrEqual(1);
  await newGame(page);
  await waitForWorld(page);
  expect(await overflow(), 'dialogue').toBeLessThanOrEqual(1);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  expect(await overflow(), 'HUD').toBeLessThanOrEqual(1);
  // The HUD stays clear of the on-screen controls and leaves the world visible.
  const hud = await page.locator('header.hud').boundingBox();
  expect(hud?.height ?? 999, 'HUD height').toBeLessThan(640 / 2);
  await page.getByRole('button', { name: /^Menu/ }).click();
  const paused = page.getByRole('dialog', { name: 'Paused' });
  await expect(paused.getByText('Next:')).toBeVisible();
  expect(await overflow(), 'pause menu').toBeLessThanOrEqual(1);
  await paused.getByRole('button', { name: /^Journal/ }).click();
  expect(await overflow(), 'journal').toBeLessThanOrEqual(1);
});

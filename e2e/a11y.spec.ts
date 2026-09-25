import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
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
  await page.getByRole('button', { name: 'New game' }).click();
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
});

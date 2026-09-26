import { devices, expect, test } from '@playwright/test';
import { choose, goTo, newGame, openApp, setFastSettings, waitForWorld } from './support';

/**
 * Portrait captures for review (not a pass/fail test): the look picker,
 * chapter select, and conversations with Aunt Miriam and Hadassah, at
 * desktop and phone sizes. The `before` set blocks the rendered portraits,
 * so the game falls back to the drawn (SVG) portraits it used to show.
 *
 *   E2E_SHOTS=1 npx playwright test e2e/portrait-art.spec.ts --project=desktop-chromium
 *
 * Output: test-results/portraits/<before|after>/<viewport>-<n>-<name>.png
 */
const VIEWPORTS = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
  {
    name: 'phone',
    use: {
      viewport: devices['Pixel 7'].viewport,
      deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    },
  },
] as const;

for (const set of ['before', 'after'] as const) {
  for (const vp of VIEWPORTS) {
    test.describe(`${set} ${vp.name}`, () => {
      test.use(vp.use);
      test(`portraits (${set}, ${vp.name})`, async ({ page }) => {
        test.skip(!process.env.E2E_SHOTS, 'captures only: set E2E_SHOTS=1');
        test.setTimeout(180_000);
        if (set === 'before') await page.route('**/art/portraits/**', (r) => r.abort());
        let n = 0;
        const shot = async (name: string, settle = 500): Promise<void> => {
          await page.waitForTimeout(settle);
          n++;
          await page.screenshot({
            path: `test-results/portraits/${set}/${vp.name}-${n}-${name}.png`,
          });
        };
        await openApp(page);
        await setFastSettings(page);
        await page.getByRole('button', { name: 'Play' }).click();
        await expect(page.getByRole('group', { name: 'Choose your look' })).toBeVisible();
        await shot('look-picker');
        await page.getByLabel('Nickname').fill('Ari');
        await page.getByRole('button', { name: 'Create and continue' }).click();
        await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
        await shot('chapter-select');
        await newGame(page);
        await waitForWorld(page);
        const box = page.locator('section.dialogue');
        await box.getByRole('button', { name: 'Continue' }).click();
        await expect(page.locator('#dialogue-speaker')).toContainText('Aunt Miriam');
        await shot('miriam', 1200);
        await choose(page, 'Of course. What do I need to know?');
        await choose(page, 'I’ll head to the market.');
        await box.getByRole('button', { name: /^(Continue|End conversation)$/ }).click();
        await goTo(page, 'Go to the market');
        await page.waitForTimeout(4000);
        await goTo(page, 'Talk to Hadassah the weaver');
        await expect(page.locator('#dialogue-speaker')).toContainText('Hadassah');
        await shot('hadassah', 1500);
      });
    });
  }
}

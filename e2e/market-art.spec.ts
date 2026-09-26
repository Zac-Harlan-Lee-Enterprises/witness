import { devices, expect, test } from '@playwright/test';
import {
  choose,
  createProfile,
  expectScene,
  goTo,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

/**
 * Market art captures at fixed positions (not a pass/fail test): arrival
 * at the door, a few steps along the square, and talking with Hadassah,
 * at desktop, tablet and phone sizes. Build-time switches choose what is
 * compared (VITE_CAMERA_FRAMING, VITE_ART_LIGHTING); ART_SHOTS names the set.
 *
 *   E2E_SHOTS=1 ART_SHOTS=after-day npx playwright test e2e/market-art.spec.ts --project=desktop-chromium
 *
 * Output: test-results/market-art/<set>/<viewport>-<n>-<name>.png
 */
const VIEWPORTS = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
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

const SET = process.env.ART_SHOTS ?? 'current';

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use(vp.use);
    test(`market art (${vp.name})`, async ({ page }) => {
      test.setTimeout(180_000);
      let n = 0;
      const shot = async (name: string, settle = 600): Promise<void> => {
        await page.waitForTimeout(settle);
        n++;
        await page.screenshot({
          path: `test-results/market-art/${SET}/${vp.name}-${n}-${name}.png`,
        });
      };
      await openApp(page);
      await setFastSettings(page);
      await createProfile(page, 'Ari');
      await page.getByRole('button', { name: 'New game' }).click();
      await waitForWorld(page);
      await choose(page, 'Of course. What do I need to know?');
      await choose(page, 'I’ll head to the market.');
      await page
        .locator('section.dialogue')
        .getByRole('button', { name: /^(Continue|End conversation)$/ })
        .click();
      await goTo(page, 'Go to the market');
      await expectScene(page, 'The lower market, Jerusalem');
      await shot('arrival', 5200);
      // A few steps along the square (walk cycle, shadow, depth against the stall).
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(700);
      await shot('walking', 0);
      await page.keyboard.up('ArrowRight');
      await goTo(page, 'Talk to Hadassah the weaver');
      await shot('hadassah-dialogue', 1500);
      const art = await page.locator('.viewport canvas').getAttribute('data-art');
      test.info().annotations.push({ type: 'art', description: String(art) });
      await page.keyboard.press('Escape');
      await expect(page.locator('.viewport canvas')).toBeVisible();
    });
  });
}

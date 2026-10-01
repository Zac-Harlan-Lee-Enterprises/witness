import { writeFileSync } from 'node:fs';
import { devices, expect, test, type Page } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
  expectScene,
  goTo,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';
import { artDetails } from './world-probe';

/**
 * Captures of the world's people in the game (not a pass/fail test), for
 * judging their realism at the size players see them: Aunt Miriam and the
 * player (look 1) in her house, the market's passers-by and the player
 * walking among them, and Hadassah. Each shot is taken whole and as a
 * close crop round the middle of the view (where the player stands), at
 * desktop and phone sizes.
 *
 *   E2E_SHOTS=1 ART_SHOTS=before npx playwright test e2e/people-art.spec.ts --project=desktop-chromium
 *
 * Output: test-results/people-art/<set>/<viewport>-<nn>-<name>.png and
 * <viewport>-<nn>-<name>-crop.png, plus <viewport>-art.txt with the texture
 * memory the game reported at each shot.
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

// Draw with the Mac's GPU (as place-art.spec.ts does): the software renderer
// is slow enough to drop the game to its low-power art.
if (process.platform === 'darwin')
  test.use({
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  });
const SET = process.env.ART_SHOTS ?? 'current';
const SETTLE_MS = 5200;

async function canvasInfo(page: Page): Promise<string> {
  const canvas = page.locator('.viewport canvas');
  const [art, mb] = await Promise.all([
    canvas.getAttribute('data-art'),
    canvas.getAttribute('data-texture-mb'),
  ]);
  return `art=${art ?? '?'}\ttextureMb=${mb ?? '?'}`;
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use(vp.use);
    test(`people art (${vp.name})`, async ({ page }) => {
      test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
      test.setTimeout(240_000);
      let n = 0;
      const info: string[] = [];
      const prefix = `test-results/people-art/${SET}/${vp.name}`;
      const shot = async (name: string, settle = 600): Promise<void> => {
        await page.waitForTimeout(settle);
        n++;
        const file = `${prefix}-${String(n).padStart(2, '0')}-${name}`;
        await page.screenshot({ path: `${file}.png` });
        const box = await page.locator('.viewport canvas').boundingBox();
        if (box) {
          // A close crop round the middle of the view, where the camera keeps the player.
          const side = Math.min(box.width, box.height) * (vp.name === 'phone' ? 0.8 : 0.5);
          await page.screenshot({
            path: `${file}-crop.png`,
            clip: {
              x: box.x + (box.width - side) / 2,
              y: box.y + (box.height - side) / 2,
              width: side,
              height: side,
            },
          });
        }
        info.push(
          `${String(n).padStart(2, '0')}-${name}\t${await canvasInfo(page)}\t${await artDetails(page)}`,
        );
        writeFileSync(`${prefix}-art.txt`, info.join('\n') + '\n');
      };

      await openApp(page);
      await setFastSettings(page);
      await createProfile(page, 'Ari');
      await newGame(page);
      await waitForWorld(page);
      await choose(page, 'Of course. What do I need to know?');
      await choose(page, 'I’ll head to the market.');
      await endDialogue(page);
      await shot('house', SETTLE_MS);
      // A few steps toward Miriam and back: the walk, then standing.
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(500);
      await shot('house-walking', 0);
      await page.keyboard.up('ArrowLeft');
      await shot('house-standing', 900);

      await goTo(page, 'Go to the market');
      await expectScene(page, 'The lower market, Jerusalem');
      await shot('market', SETTLE_MS);
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(700);
      await shot('market-walking', 0);
      await page.keyboard.up('ArrowRight');
      await shot('market-standing', 2500);
      await goTo(page, 'Talk to Hadassah the weaver');
      await shot('hadassah', 1500);
      await page.keyboard.press('Escape');
      await expect(page.locator('.viewport canvas')).toBeVisible();
    });
  });
}

import { writeFileSync } from 'node:fs';
import { devices, test, type Page } from '@playwright/test';
import {
  choose,
  continueDialogue,
  createProfile,
  endDialogue,
  expectScene,
  goTo,
  mendNet,
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
 * walking among them, Hadassah and Old Shimon (an elder in his mantle); Eli on
 * the road down to Jericho; Grandmother Shelomit (an elder) and Hodaya on the
 * shore at Capernaum. Each shot is taken whole and as a
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

/** Takes a whole and a cropped capture, and notes the art the game drew. */
function shooter(
  page: Page,
  vp: string,
  part: string,
): (name: string, settle?: number) => Promise<void> {
  let n = 0;
  const info: string[] = [];
  const prefix = `test-results/people-art/${SET}/${vp}`;
  return async (name: string, settle = 600): Promise<void> => {
    await page.waitForTimeout(settle);
    n++;
    const file = `${prefix}-${part}${String(n).padStart(2, '0')}-${name}`;
    await page.screenshot({ path: `${file}.png` });
    const box = await page.locator('.viewport canvas').boundingBox();
    if (box) {
      // A close crop round the middle of the view, where the camera keeps the player.
      const side = Math.min(box.width, box.height) * (vp === 'phone' ? 0.8 : 0.5);
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
      `${part}${String(n).padStart(2, '0')}-${name}\t${await canvasInfo(page)}\t${await artDetails(page)}`,
    );
    writeFileSync(`${prefix}-${part}art.txt`, info.join('\n') + '\n');
  };
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use(vp.use);
    test(`people art (${vp.name})`, async ({ page }) => {
      test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
      test.setTimeout(420_000);
      const shot = shooter(page, vp.name, '');
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
      await goTo(page, 'Talk to Old Shimon');
      await shot('shimon', 1500);
      await choose(page, 'I’m going down to Jericho. Any advice?');
      await choose(page, 'Is there any water on the way?');
      await choose(page, 'That could save a lot of weight in my satchel.');
      await choose(page, 'Goodbye, Shimon.');
      await endDialogue(page);
      await goTo(page, 'Talk to Hadassah the weaver');
      await shot('hadassah', 1500);
      await choose(page, 'Aunt Miriam sent me for Rivka’s linen.');
      await choose(page, 'I’ll keep it safe.');
      await choose(page, 'Goodbye.');
      await endDialogue(page);

      // On to the road, and Eli by the cistern on the ridge.
      await goTo(page, 'Go to Aunt Miriam’s house');
      await goTo(page, 'Use Travel satchel');
      const puzzle = page.getByRole('dialog', { name: 'Pack the Satchel' });
      await puzzle.getByRole('button', { name: 'Pack one Water skin' }).click();
      await puzzle.getByRole('button', { name: 'Pack one Bread and dates' }).click();
      await puzzle.getByRole('button', { name: 'Finish packing' }).click();
      await puzzle.getByRole('button', { name: 'Continue' }).click();
      await goTo(page, 'Go to the market');
      await goTo(page, /Go to the east gate/);
      await expectScene(page, 'The road down to Jericho');
      await goTo(page, 'Use The crossroads — choose a route');
      await continueDialogue(page);
      await endDialogue(page);
      const route = page.getByRole('dialog', { name: 'Which Way Down?' });
      await route.getByLabel(/The shepherds’ ridge path/).check();
      await route.getByLabel(/A cistern on the ridge/).check();
      await route.getByLabel(/Watchers at the bend/).check();
      await route.getByRole('button', { name: 'Present my reasoning' }).click();
      await route.getByRole('button', { name: 'Continue' }).click();
      await goTo(page, 'Talk to Eli, the shepherd boy');
      await choose(page, 'Sorry — I need mine for the road.');
      await shot('eli', 1500);
      await choose(page, 'I have to keep going.');
      await endDialogue(page);
      await shot('eli-after', 1200);
    });

    test(`people art at Capernaum (${vp.name})`, async ({ page }) => {
      test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
      test.setTimeout(300_000);
      const shot = shooter(page, vp.name, 'shore-');
      await openApp(page);
      await setFastSettings(page);
      await createProfile(page, 'Noa');
      await newGame(page, 'A Storm on Galilee');
      await waitForWorld(page);
      await shot('shelomit', SETTLE_MS);
      await choose(page, 'So many people! Who are they listening to?');
      await choose(page, 'I’m ready. What do I do?');
      await choose(page, 'I’ll go and find Hanina.');
      await choose(page, 'Show me how.');
      await endDialogue(page);
      const corner = page.getByRole('dialog', { name: 'Grandmother’s Corner' });
      await mendNet(corner, [
        [1, 3],
        [2, 3], [2, 4],
        [3, 3],
        [4, 2], [4, 3], [4, 4],
        [5, 2], [5, 3], [5, 4],
      ]); // prettier-ignore
      await corner.getByRole('button', { name: 'Continue' }).click();
      await shot('shelomit-after', 1200);
      await goTo(page, 'Go to the shore');
      await expectScene(page, 'The shore at Capernaum');
      await shot('shore', SETTLE_MS);
      await goTo(page, 'Talk to Hodaya, of the Magdala crew');
      await shot('hodaya', 1500);
      await page.keyboard.press('Escape');
      await shot('hodaya-after', 1200);
    });
  });
}

import { writeFileSync } from 'node:fs';
import { devices, expect, test, type Page } from '@playwright/test';
import {
  choose,
  continueDialogue,
  createProfile,
  endDialogue,
  expectScene,
  goTo,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

/**
 * Art captures of every place in Chapter 2 at fixed moments (not a
 * pass/fail test): Grandmother's house in the afternoon, the shore (arrival,
 * the salting place, the jetty), the shore at evening as the boats put out
 * (the world changes to its night set as the clock reaches 18:00), the lake
 * by night (arriving at sunset, under way, the gust, the storm, the calm),
 * home on the shore in the night, and the house by lamplight, at desktop,
 * tablet and phone sizes.
 *
 *   E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/storm-art.spec.ts --project=desktop-chromium
 *
 * Output: test-results/storm-art/<set>/<viewport>-<nn>-<name>.png, plus
 * <viewport>-art.txt with how each place was drawn (its light) and the
 * texture memory the game reported there.
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

// Draw with the real GPU on a Mac (see place-art.spec.ts).
if (process.platform === 'darwin')
  test.use({
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  });
const SET = process.env.ART_SHOTS ?? 'current';
const SETTLE_MS = 5200;
const box = (page: Page) => page.locator('section.dialogue');

async function canvasInfo(page: Page): Promise<string> {
  const canvas = page.locator('.viewport canvas');
  const art = await canvas.getAttribute('data-art');
  const mb = await canvas.getAttribute('data-texture-mb');
  const weather = await canvas.getAttribute('data-weather');
  const scene = await page.locator('.hud__scene').textContent();
  return `${scene ?? '?'}\tart=${art ?? '?'}\tweather=${weather ?? '?'}\ttextureMb=${mb ?? '?'}`;
}

/** Read on through any narration until a choice appears. */
async function readUntilChoice(page: Page, choice: string): Promise<void> {
  for (let i = 0; i < 80; i++) {
    if ((await box(page).locator('.choice').filter({ hasText: choice }).count()) > 0) return;
    const next = box(page).getByRole('button', {
      name: /^(Continue|End conversation|Show all text)$/,
    });
    if (await next.isVisible().catch(() => false)) await next.click();
    else await page.waitForTimeout(100);
  }
  throw new Error(`The choice “${choice}” never appeared`);
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use(vp.use);
    test(`storm art (${vp.name})`, async ({ page }) => {
      test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
      test.setTimeout(600_000);
      let n = 0;
      const info: string[] = [];
      const prefix = `test-results/storm-art/${SET}/${vp.name}`;
      const shot = async (name: string, settle = 600): Promise<void> => {
        await page.waitForTimeout(settle);
        n++;
        await page.screenshot({ path: `${prefix}-${String(n).padStart(2, '0')}-${name}.png` });
        info.push(`${String(n).padStart(2, '0')}-${name}\t${await canvasInfo(page)}`);
      };
      const art = page.locator('.viewport canvas');

      await openApp(page);
      await setFastSettings(page);
      await createProfile(page, 'Noa');
      await newGame(page, 'A Storm on Galilee');
      await waitForWorld(page);
      await expectScene(page, 'Grandmother Shelomit’s house');
      await choose(page, 'So many people! Who are they listening to?');
      await choose(page, 'I’m ready. What do I do?');
      await choose(page, 'I’ll go and find Hanina.');
      await endDialogue(page);
      await shot('house', SETTLE_MS);

      await goTo(page, 'Go to the shore');
      await expectScene(page, 'The shore at Capernaum');
      await shot('shore-arrival', SETTLE_MS);
      await goTo(page, 'Talk to Uncle Elazar');
      await choose(page, 'Not yet.');
      await endDialogue(page);
      await goTo(page, 'Talk to Nikanor the salt-fish trader');
      await choose(page, 'I’ll take them down to the boat.');
      await endDialogue(page);
      await shot('shore-salting', SETTLE_MS);
      await goTo(page, 'Talk to Old Hanina');
      await choose(page, 'Grandmother says to ask you what the sky is saying.');
      await choose(page, 'I’ll look around first.');
      await endDialogue(page);
      await shot('shore-jetty', SETTLE_MS);
      await goTo(page, 'Examine The far shore, across the lake');
      await goTo(page, 'Use The end of the jetty — read the sky');
      const sky = page.getByRole('dialog', { name: 'What Is the Sky Saying?' });
      await sky.getByLabel(/A strong wind could rush down after dark/).check();
      await sky.getByLabel(/Winds off the heights/).check();
      await sky.getByLabel(/Cold air off the eastern hills/).check();
      await sky.getByRole('button', { name: 'Present my reasoning' }).click();
      await sky.getByRole('button', { name: 'Continue' }).click();

      await goTo(page, 'Use The family boat');
      await choose(page, 'Load the boat.');
      await endDialogue(page);
      const load = page.getByRole('dialog', { name: 'Load the Boat' });
      const pack = (name: string) => load.getByRole('button', { name: `Pack one ${name}` }).click();
      await pack('Bailing scoop');
      for (let i = 0; i < 4; i++) await pack('Jar of salted fish');
      await pack('Coil of rope');
      await pack('Spare oar');
      await pack('Your cloak');
      await pack('Clay lamp');
      await load.getByRole('button', { name: 'Finish packing' }).click();
      await load.getByRole('button', { name: 'Continue' }).click();
      // Evening: the sun sets while the boats put out, and the shore
      // changes to its night set.
      await expect(box(page)).toBeVisible();
      await expect(art).toHaveAttribute('data-art', /prerendered:night|painted/, {
        timeout: 20_000,
      });
      await shot('shore-evening', 2500);
      // The boats put out: the lake's arrival narration may open at once, so
      // wait for the place rather than for no conversation.
      await continueDialogue(page);
      await expectScene(page, 'Out on the lake');
      await shot('lake-arrival', 300);
      await page.waitForTimeout(400);
      await endDialogue(page);
      await expect(art).toHaveAttribute('data-art', /prerendered:night|painted/, {
        timeout: 20_000,
      });
      await shot('lake-under-way', SETTLE_MS);
      await goTo(page, 'Examine The view from the bow');
      await readUntilChoice(page, 'Get the sail in!');
      await shot('lake-gust', 2500);
      await choose(page, 'Get the sail in!');
      await endDialogue(page);
      const sail = page.getByRole('dialog', { name: 'Shorten Sail!' });
      const earlier = (text: string) => sail.getByRole('button', { name: `Move earlier: ${text}` });
      for (let i = 0; i < 2; i++)
        await earlier('Haul on the brails to gather the sail up to the yard.').click();
      for (let i = 0; i < 2; i++) await earlier('Lower the yard and lash it down.').click();
      await sail.getByRole('button', { name: 'Check the order' }).click();
      await sail.getByLabel(/Keep her bow to the waves/).check();
      await sail.getByRole('button', { name: 'Decide' }).click();
      await sail.getByRole('button', { name: 'Continue' }).click();
      await expect(art).toHaveAttribute('data-weather', 'storm');
      await shot('lake-storm', 4000);
      await endDialogue(page);
      await goTo(page, 'Talk to The little boat off the port side');
      await continueDialogue(page);
      await choose(page, 'Throw them the rope and tow them.');
      await endDialogue(page);
      await page.waitForTimeout(400);
      await endDialogue(page);
      await expect(art).toHaveAttribute('data-weather', 'clear');
      await shot('lake-calm', SETTLE_MS);

      await goTo(page, 'Talk to Uncle Elazar, at the steering oar');
      await choose(page, 'Can we go home?');
      await endDialogue(page);
      await expectScene(page, 'The shore at Capernaum');
      await page.waitForTimeout(400);
      await endDialogue(page);
      await expect(art).toHaveAttribute('data-art', /prerendered:night|painted/);
      await shot('shore-night', SETTLE_MS);
      await goTo(page, 'Go to Grandmother’s house');
      await expectScene(page, 'Grandmother Shelomit’s house');
      await expect(art).toHaveAttribute('data-art', /prerendered:night|painted/);
      await shot('house-night', SETTLE_MS);
      test.info().annotations.push({ type: 'art', description: info.join('\n') });
      writeFileSync(`${prefix}-art.txt`, info.join('\n') + '\n');
    });
  });
}

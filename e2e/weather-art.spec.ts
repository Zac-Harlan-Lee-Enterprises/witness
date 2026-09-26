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
 * Weather and atmosphere captures for review (not a pass/fail test;
 * E2E_SHOTS=1): the market, the Jericho road and the spring at Jericho, each
 * as a still and a short frame sequence, at a Retina-class desktop size and
 * a phone size. Build with a forced weather to see it before any chapter
 * asks for it:
 *
 *   VITE_FORCE_WEATHER=storm E2E_SHOTS=1 WEATHER_SHOTS=storm E2E_GPU=1 \
 *     npx playwright test e2e/weather-art.spec.ts --project=desktop-chromium
 *
 * WEATHER_HOUR=21 starts the story clock at another hour (night lamps, dusk).
 * E2E_GPU=1 renders on the machine's GPU (Chromium's new headless mode);
 * without it, headless Chromium renders in software and skips
 * post-processing. Output: test-results/weather-art/<set>/<viewport>-<n>-<name>.png
 * (WEATHER_SHOTS_DIR moves it: Playwright empties test-results/ on every run).
 */
const SET = process.env.WEATHER_SHOTS ?? 'current';
const VIEWPORTS = [
  {
    name: 'desktop2x',
    use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 },
  },
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

if (process.env.E2E_GPU) test.use({ channel: 'chromium' });

async function packAndLeave(page: Page): Promise<void> {
  await goTo(page, 'Talk to Old Shimon');
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await choose(page, 'Is there any water on the way?');
  await choose(page, 'That could save a lot of weight in my satchel.');
  await choose(page, 'Goodbye, Shimon.');
  await endDialogue(page);
  await goTo(page, 'Go to Aunt Miriam’s house');
  await goTo(page, 'Use Travel satchel');
  const puzzle = page.getByRole('dialog', { name: 'Pack the Satchel' });
  await puzzle.getByRole('button', { name: 'Pack one Water skin' }).click();
  await puzzle.getByRole('button', { name: 'Pack one Bread and dates' }).click();
  await puzzle.getByRole('button', { name: 'Finish packing' }).click();
  await puzzle.getByRole('button', { name: 'Continue' }).click();
}

async function walkTheRoad(page: Page): Promise<void> {
  await goTo(page, 'Use The crossroads — choose a route');
  await continueDialogue(page);
  await endDialogue(page);
  const route = page.getByRole('dialog', { name: 'Which Way Down?' });
  await route.getByLabel(/The shepherds’ ridge path/).check();
  await route.getByLabel(/A cistern on the ridge/).check();
  await route.getByLabel(/Watchers at the bend/).check();
  await route.getByRole('button', { name: 'Present my reasoning' }).click();
  await route.getByRole('button', { name: 'Continue' }).click();
  await goTo(page, 'Examine Broken jar');
  await endDialogue(page);
  await goTo(page, 'Examine Many footprints');
  await goTo(page, 'Examine Drag marks');
  await choose(page, 'Think it through now.');
  await endDialogue(page);
  const scene = page.getByRole('dialog', { name: 'What Happened Here?' });
  const earlier = (text: string) => scene.getByRole('button', { name: `Move earlier: ${text}` });
  await earlier('The traveler walked down from the bend alone.').click();
  await earlier('The traveler walked down from the bend alone.').click();
  for (let i = 0; i < 3; i++)
    await earlier('Several people came down from the rocks and stopped him.').click();
  await earlier('The robbers went away north, up the gully.').click();
  await scene.getByRole('button', { name: 'Check the order' }).click();
  await scene.getByLabel(/They most likely left hours ago/).check();
  await scene.getByRole('button', { name: 'Decide' }).click();
  await scene.getByRole('button', { name: 'Continue' }).click();
  await goTo(page, 'Talk to The injured traveler');
  await continueDialogue(page);
  await choose(page, /Leave him what water and food you have/);
  await endDialogue(page);
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use(vp.use);
    test(`weather art (${vp.name})`, async ({ page }) => {
      test.skip(!process.env.E2E_SHOTS, 'E2E_SHOTS=1 to capture');
      test.setTimeout(300_000);
      let n = 0;
      const dir = `${process.env.WEATHER_SHOTS_DIR ?? 'test-results/weather-art'}/${SET}`;
      const log: string[] = [];
      page.on('pageerror', (e) => log.push(`pageerror ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') log.push(`console ${m.text()}`);
      });
      const shot = async (name: string, settle = 600): Promise<void> => {
        await page.waitForTimeout(settle);
        n++;
        log.push(
          `${n} ${name} ${await page
            .locator('.viewport canvas')
            .evaluate((c: HTMLCanvasElement) => JSON.stringify(c.dataset))}`,
        );
        await page.screenshot({
          path: `${dir}/${vp.name}-${String(n).padStart(2, '0')}-${name}.png`,
        });
      };
      /** A short frame sequence (for motion: rain, wind, lightning). */
      const frames = async (name: string, count = 4, gap = 90): Promise<void> => {
        for (let i = 0; i < count; i++) await shot(`${name}-f${i}`, i === 0 ? 300 : gap);
      };
      const hour = process.env.WEATHER_HOUR;
      if (hour) {
        // Review only: start the chapter's clock at another hour (the chapter chunk is data).
        await page.route('**/assets/road-to-jericho-*.js', async (route) => {
          const response = await route.fetch();
          const body = (await response.text()).replace(
            /counters:\{hour:8\}/,
            `counters:{hour:${Number(hour)}}`,
          );
          await route.fulfill({ response, body });
        });
      }
      await openApp(page);
      await setFastSettings(page);
      await createProfile(page, 'Ari');
      await newGame(page);
      await waitForWorld(page);
      await shot('house', 2500);
      await choose(page, 'Of course. What do I need to know?');
      await choose(page, 'I’ll head to the market.');
      await endDialogue(page);
      await goTo(page, 'Go to the market');
      await expectScene(page, 'The lower market, Jerusalem');
      await shot('market', 5000);
      await page.locator('body').focus();
      await page.keyboard.down('ArrowRight');
      await frames('market-walk');
      await page.keyboard.up('ArrowRight');
      await frames('market-still', 6, 160);
      await packAndLeave(page);
      await goTo(page, 'Go to the market');
      await goTo(page, /Go to the east gate/);
      await expectScene(page, 'The road down to Jericho');
      await shot('road', 5000);
      await frames('road', 6, 160);
      await walkTheRoad(page);
      await goTo(page, 'Go to the road on to Jericho');
      await expectScene(page, 'Jericho, the city of palm trees');
      await continueDialogue(page);
      await endDialogue(page).catch(() => undefined);
      await shot('jericho', 5000);
      await goTo(page, 'Examine The spring');
      await frames('jericho-spring', 6, 200);
      const canvas = page.locator('.viewport canvas');
      await expect(canvas).toBeVisible();
      const fs = await import('node:fs');
      fs.writeFileSync(`${dir}/${vp.name}-world.txt`, `${log.join('\n')}\n`);
      test.info().annotations.push({
        type: 'world',
        description: JSON.stringify({
          weather: await canvas.getAttribute('data-weather'),
          effects: await canvas.getAttribute('data-effects'),
          postFx: await canvas.getAttribute('data-post-fx'),
          resolution: await canvas.getAttribute('data-resolution'),
          renderer: await canvas.getAttribute('data-renderer'),
        }),
      });
    });
  });
}

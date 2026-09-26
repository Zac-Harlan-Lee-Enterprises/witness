import { expect, test } from '@playwright/test';
import {
  choose,
  continueDialogue,
  createProfile,
  endDialogue,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';
import { canvas, data } from './world-probe';

/**
 * High-DPI rendering on a 2× screen. Chromium's new headless mode is used so
 * that, where the machine has a GPU, the world renders on it:
 *
 * - with a GPU, the canvas holds device pixels (2560 × 1440 for a 1280 × 720
 *   view) and is laid out at CSS size, so the world is crisp;
 * - without one (software GL, as on CI runners), every pixel costs CPU, so the
 *   world stays at 1× — also checked here;
 * - either way, a tap lands on what is under the finger.
 */
test.use({ channel: 'chromium', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

test('renders at device pixels on a 2× screen, and taps land where they should', async ({
  page,
}) => {
  test.skip(!!process.env.E2E_SHOTS, 'not a capture run');
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Crisp');
  await newGame(page);
  await waitForWorld(page);
  const c = canvas(page);
  await expect(c).toHaveAttribute('data-renderer', /webgl/);
  const gpu = (await data(page, 'renderer')) === 'webgl';
  const ratio = gpu ? 2 : 1;
  await expect(c).toHaveAttribute('data-resolution', String(ratio));
  const size = await c.evaluate((el: HTMLCanvasElement) => ({
    width: el.width,
    height: el.height,
    css: el.getBoundingClientRect(),
  }));
  expect(size.css.width).toBeCloseTo(1280, 0);
  expect(size.css.height).toBeCloseTo(720, 0);
  expect(size.width).toBe(1280 * ratio);
  expect(size.height).toBe(720 * ratio);
  test.info().annotations.push({ type: 'renderer', description: gpu ? 'GPU' : 'software GL' });

  // Tap Aunt Miriam (tile 6, 3): the world walks there and she talks.
  await continueDialogue(page);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await page.waitForTimeout(600);
  const view = ((await data(page, 'view')) ?? '').split(',').map(Number);
  const [vx = 0, vy = 0, vw = 1, vh = 1] = view;
  const x = size.css.x + ((6.5 * 32 - vx) / vw) * size.css.width;
  const y = size.css.y + ((3.5 * 32 - vy) / vh) * size.css.height;
  await page.mouse.click(x, y);
  await expect(page.locator('section.dialogue')).toContainText('Miriam', { timeout: 10_000 });
});

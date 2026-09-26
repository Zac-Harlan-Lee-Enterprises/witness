import { expect, test, type Page } from '@playwright/test';
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
 * The world's rendering engine, end to end:
 *
 * 1. High-DPI: on a 2× screen the canvas holds device pixels (crisp), is laid
 *    out at CSS size, and a tap still lands on what is under the finger.
 * 2. Weather follows the story: the market's content is given a storm that
 *    rises once Old Shimon has warned you about the bend and clears once he
 *    has told you about the cistern (content is data, so the test adds the
 *    rule on the fly), and the world visibly darkens and rains, then clears.
 *    The picture is compared within one conversation, so the camera holds still.
 * 3. Reduced motion: the same storm darkens the light but nothing falls.
 */
const canvas = (page: Page) => page.locator('.viewport canvas');

async function data(page: Page, key: string): Promise<string | null> {
  return canvas(page).getAttribute(`data-${key}`);
}

/** Mean brightness (0–255) of the top part of the canvas, above any dialogue box. */
async function brightness(page: Page): Promise<number> {
  const png = (await canvas(page).screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext('2d');
    if (!ctx) return -1;
    ctx.drawImage(img, 0, 0, img.width, img.height * 0.45, 0, 0, 160, 90);
    const px = ctx.getImageData(0, 0, 160, 90).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4)
      sum += 0.2126 * (px[i] ?? 0) + 0.7152 * (px[i + 1] ?? 0) + 0.0722 * (px[i + 2] ?? 0);
    return sum / (px.length / 4);
  }, png);
}

/** Add a story-driven storm to the market (the chapter chunk is plain data). */
async function stormAfterShimon(page: Page): Promise<void> {
  await page.route('**/assets/road-to-jericho-*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const rule =
      'weatherChanges:[{when:{type:"clueFound",clue:"clue-bend-watchers"},weather:"storm"},' +
      '{when:{type:"clueFound",clue:"clue-cistern"},weather:"clear"}],';
    const patched = body.replace(/(id:(["'`])jerusalem-market\2,)(name:)/, `$1${rule}$3`);
    expect(patched, 'the market scene should be found in the chapter chunk').not.toBe(body);
    await route.fulfill({ response, body: patched });
  });
}

async function toMarket(page: Page): Promise<void> {
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Rain');
  await newGame(page);
  await waitForWorld(page);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await goTo(page, 'Go to the market');
  await expectScene(page, 'The lower market, Jerusalem');
}

test.describe('high-DPI rendering', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

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
    await expect(c).toHaveAttribute('data-resolution', '2');
    const size = await c.evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      css: el.getBoundingClientRect(),
    }));
    expect(size.css.width).toBeCloseTo(1280, 0);
    expect(size.css.height).toBeCloseTo(720, 0);
    expect(size.width).toBe(2560);
    expect(size.height).toBe(1440);

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
});

test('the weather follows the story: a storm rises, then clears', async ({ page }) => {
  test.skip(!!process.env.E2E_SHOTS, 'not a capture run');
  test.setTimeout(180_000);
  await stormAfterShimon(page);
  await toMarket(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'clear');
  await goTo(page, 'Talk to Old Shimon');
  await page.waitForTimeout(3000); // the conversation camera settles
  const clear = await brightness(page);
  expect(Number(await data(page, 'weather-drops'))).toBe(0);

  // He warns you about the bend: the storm rises.
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await continueDialogue(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'storm');
  await page.waitForTimeout(6000);
  const stormy = await brightness(page);
  expect(Number(await data(page, 'weather-drops'))).toBeGreaterThan(50);
  expect(stormy, 'a storm darkens the market').toBeLessThan(clear - 12);

  // He tells you about the cistern: the storm passes, more slowly than it came.
  await choose(page, 'Is there any water on the way?');
  await expect(canvas(page)).toHaveAttribute('data-weather', 'clear');
  await expect
    .poll(() => brightness(page), {
      message: 'the light comes back as the storm passes',
      timeout: 30_000,
      intervals: [2000],
    })
    .toBeGreaterThan(stormy + 8);
  expect(Number(await data(page, 'weather-wet')), 'the ground is still wet').toBeGreaterThan(0);
  await choose(page, 'That could save a lot of weight in my satchel.');
  await choose(page, 'Goodbye, Shimon.');
  await endDialogue(page);
});

test('with reduced motion a storm darkens the light but nothing falls', async ({ page }) => {
  test.skip(!!process.env.E2E_SHOTS, 'not a capture run');
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stormAfterShimon(page);
  await toMarket(page);
  await goTo(page, 'Talk to Old Shimon');
  await page.waitForTimeout(1500);
  const clear = await brightness(page);
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await continueDialogue(page);
  await expect(canvas(page)).toHaveAttribute('data-weather', 'storm');
  await page.waitForTimeout(5000);
  expect(await data(page, 'weather-drops')).toBe('0');
  expect(await data(page, 'weather-dust')).toBe('0');
  expect(await brightness(page)).toBeLessThan(clear - 12);
});

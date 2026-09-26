import { expect, type Page } from '@playwright/test';
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

/**
 * Helpers for the rendering specs: the world canvas's diagnostics
 * attributes, a picture's brightness, and story-driven weather added to the
 * chapter's content on the fly (content is data).
 */
export const canvas = (page: Page) => page.locator('.viewport canvas');

export async function data(page: Page, key: string): Promise<string | null> {
  return canvas(page).getAttribute(`data-${key}`);
}

/**
 * Brightness (0–255) of the top part of the canvas, above any dialogue box:
 * its mean and its spread (a flat wash of one colour has almost none).
 */
export async function picture(page: Page): Promise<{ mean: number; spread: number }> {
  const png = (await canvas(page).screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext('2d');
    if (!ctx) return { mean: -1, spread: -1 };
    ctx.drawImage(img, 0, 0, img.width, img.height * 0.45, 0, 0, 160, 90);
    const px = ctx.getImageData(0, 0, 160, 90).data;
    const l: number[] = [];
    for (let i = 0; i < px.length; i += 4)
      l.push(0.2126 * (px[i] ?? 0) + 0.7152 * (px[i + 1] ?? 0) + 0.0722 * (px[i + 2] ?? 0));
    const mean = l.reduce((a, b) => a + b, 0) / l.length;
    const spread = Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length);
    return { mean, spread };
  }, png);
}

export const brightness = async (page: Page): Promise<number> => (await picture(page)).mean;

/** Add a story-driven storm to the market (the chapter chunk is plain data). */
export async function stormAfterShimon(page: Page): Promise<void> {
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

export async function toMarket(page: Page): Promise<void> {
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

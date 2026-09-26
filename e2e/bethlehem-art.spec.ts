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
 * Art captures of Chapter 3's pre-rendered places (not a pass/fail test):
 * Tamar's house by day and by lamplight, the lanes of Bethlehem in the
 * afternoon and after dark, the fold below the village in the late sun and
 * at night, at desktop, tablet and phone sizes. Two routes: "home" takes the
 * main path (the fold at sunset); "helped" helps the clerk first, so the sun
 * goes down while you carry the lamb back and the fields change to their
 * night light around you.
 *
 *   E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/bethlehem-art.spec.ts --project=desktop-chromium
 *
 * Output: test-results/bethlehem-art/<set>/<viewport>-<route>-<nn>-<name>.png,
 * plus <viewport>-<route>-art.txt with how each place was drawn and the
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

const ROUTES = ['home', 'helped'] as const;

// Draw with the real GPU on a Mac (see place-art.spec.ts).
if (process.platform === 'darwin')
  test.use({
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  });
const SET = process.env.ART_SHOTS ?? 'current';
/** Let arrival fades, banners and notices settle before a world shot. */
const SETTLE_MS = 5200;

async function canvasInfo(page: Page): Promise<string> {
  const canvas = page.locator('.viewport canvas');
  const art = await canvas.getAttribute('data-art');
  const mb = await canvas.getAttribute('data-texture-mb');
  const scene = await page.locator('.hud__scene').textContent();
  return `${scene ?? '?'}\tart=${art ?? '?'}\ttextureMb=${mb ?? '?'}`;
}

async function vessel(page: Page, name: string, action: string): Promise<void> {
  const puzzle = page.getByRole('dialog', { name: 'Three Measures of Flour' });
  await puzzle.getByRole('region', { name }).getByRole('button', { name: action }).click();
}

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test.describe(`${vp.name} ${route}`, () => {
      test.use(vp.use);
      test(`Bethlehem art (${vp.name}, ${route})`, async ({ page }) => {
        test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
        test.setTimeout(480_000);
        let n = 0;
        const info: string[] = [];
        const prefix = `test-results/bethlehem-art/${SET}/${vp.name}-${route}`;
        const shot = async (name: string, settle = 600): Promise<void> => {
          await page.waitForTimeout(settle);
          n++;
          await page.screenshot({ path: `${prefix}-${String(n).padStart(2, '0')}-${name}.png` });
          info.push(`${String(n).padStart(2, '0')}-${name}\t${await canvasInfo(page)}`);
        };
        const helped = route === 'helped';

        await openApp(page);
        await setFastSettings(page);
        await createProfile(page, 'Noa');
        await newGame(page, 'A Journey to Bethlehem');
        await waitForWorld(page);
        await expectScene(page, 'Tamar’s house, Bethlehem');
        await choose(page, 'Why does the emperor want everyone written down?');
        await choose(page, 'What can I do?');
        await endDialogue(page);
        await shot('house', SETTLE_MS);

        await goTo(page, 'Use Kneading trough and flour jar');
        await vessel(page, 'Grain basket', 'Fill');
        await vessel(page, 'Grain basket', 'Pour into kneading trough');
        await vessel(page, 'Grain basket', 'Fill');
        await vessel(page, 'Grain basket', 'Pour into kneading trough');
        await vessel(page, 'Kneading trough', 'Empty');
        await vessel(page, 'Grain basket', 'Pour into kneading trough');
        const bread = page.getByRole('dialog', { name: 'Three Measures of Flour' });
        await expect(bread.getByText('Solved!')).toBeVisible();
        await bread.getByRole('button', { name: 'Continue' }).click();
        await goTo(page, 'Examine The stone mangers');
        await shot('house-animals', 1500);
        await goTo(page, 'Examine Ladder to the roof');
        await goTo(page, 'Use Guests’ things to arrange');
        const room = page.getByRole('dialog', { name: 'Room in the Guest Room' });
        await room.getByRole('button', { name: 'Finish packing' }).click();
        await expect(room.getByText('Solved!')).toBeVisible();
        await room.getByRole('button', { name: 'Continue' }).click();
        await shot('house-guest-room', 1500);
        await goTo(page, 'Talk to Tamar');
        await choose(page, 'I’m going.');
        await endDialogue(page);

        await goTo(page, 'Go to the lane');
        await expectScene(page, 'The lanes of Bethlehem');
        await endDialogue(page);
        await shot('lanes', SETTLE_MS);
        if (helped) {
          await goTo(page, 'Talk to Kallias the clerk');
          await choose(page, 'Could I help? My uncle has been waiting since midday.');
          await endDialogue(page);
          await goTo(page, 'Read The clerk’s finished tablet');
          await shot('lanes-square', 1500);
          await goTo(page, 'Use The clerk’s blank tablet');
          await continueDialogue(page);
          const register = page.getByRole('dialog', { name: 'Uncle Asa’s Declaration' });
          const earlier = (text: string) =>
            register.getByRole('button', { name: `Move earlier: ${text}` });
          const declarant =
            'I, Asa son of Amram, a stonemason, thirty-one years old, make this declaration.';
          const town = 'My household is registered in the village of Bethlehem, in Judea.';
          const members =
            'With me: Peninah, my wife, twenty-six years old; Dodi, my son, two years old.';
          for (let i = 0; i < 2; i++) await earlier(declarant).click();
          for (let i = 0; i < 3; i++) await earlier(town).click();
          for (let i = 0; i < 2; i++) await earlier(members).click();
          await register.getByRole('button', { name: 'Check the order' }).click();
          await register.getByLabel(/To know who lives where/).check();
          await register.getByRole('button', { name: 'Decide' }).click();
          await register.getByRole('button', { name: 'Continue' }).click();
        }
        await goTo(page, 'Talk to Hagit');
        await choose(page, 'Is your house full of guests too?');
        await choose(page, 'Goodbye, Hagit.');
        await endDialogue(page);
        await shot('lanes-hagit', 1500);
        await goTo(page, 'Take Heap of clean straw');
        await shot('lanes-threshing', 1500);

        await goTo(page, /Go to the east gate/);
        await expectScene(page, 'The fold below Bethlehem');
        await endDialogue(page);
        await shot('fields-arrival', SETTLE_MS);
        await goTo(page, 'Talk to Cousin Yonatan');
        await choose(page, 'I’ll find the lamb.');
        await endDialogue(page);
        await shot('fields-fold', 1500);
        await goTo(page, 'Examine Hoofprints by the trough');
        await goTo(page, 'Examine Thornbush at the top of the gully');
        await shot('fields-gully-top', 1500);
        await goTo(page, 'Examine The lamb’s mother');
        await choose(page, 'Decide now.');
        await endDialogue(page);
        const lamb = page.getByRole('dialog', { name: 'Where Did the Lamb Go?' });
        await lamb.getByLabel(/Down the gully/).check();
        await lamb.getByLabel(/Small hoofprints/).check();
        await lamb.getByLabel(/Speckled wool on the thorns/).check();
        await lamb.getByRole('button', { name: 'Present my reasoning' }).click();
        await expect(lamb.getByText('Solved!')).toBeVisible();
        await lamb.getByRole('button', { name: 'Continue' }).click();
        await shot('fields-cistern', 1500);
        await goTo(page, 'Take The speckled lamb');
        if (helped) {
          // The sun has gone down: the fields change to their night light around you.
          await expect(page.locator('.viewport canvas')).toHaveAttribute(
            'data-art',
            'prerendered:night',
            { timeout: 20_000 },
          );
          await shot('fields-night-lamb', 2500);
        } else await shot('fields-lamb', 1500);
        await goTo(page, 'Talk to Cousin Yonatan');
        await endDialogue(page);
        await shot(helped ? 'fields-night-fold' : 'fields-fold-sunset', 1500);

        await goTo(page, 'Go to the path up to Bethlehem');
        await expectScene(page, 'The lanes of Bethlehem');
        await shot('lanes-night', SETTLE_MS);
        await goTo(page, 'Go to Tamar’s house');
        await expectScene(page, 'Tamar’s house, Bethlehem');
        await continueDialogue(page);
        await shot('house-night-knock', 1200);
        await choose(page, 'There’s a space in the guest room.');
        await endDialogue(page);
        await shot('house-night', SETTLE_MS);
        await goTo(page, 'Use Your sleeping mat');
        const box = page.locator('section.dialogue');
        for (let i = 0; i < 6 && !(await box.textContent())?.includes('retelling Scripture'); i++)
          await box.getByRole('button', { name: 'Continue' }).click();
        await shot('house-night-news', 1200);
        test.info().annotations.push({ type: 'art', description: info.join('\n') });
        writeFileSync(`${prefix}-art.txt`, info.join('\n') + '\n');
      });
    });
  }
}

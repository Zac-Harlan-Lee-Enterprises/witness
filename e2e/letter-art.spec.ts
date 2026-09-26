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
 * Art captures of every place in Chapter 4 at fixed moments (not a
 * pass/fail test): Ammia's workshop by day, the street in Colossae, the
 * Laodicea road as the rain comes (the waystation, the milestones, the dye
 * works by the bridge), the street again on the way home, and Philemon's
 * house at lamp-lighting; at desktop, tablet and phone sizes. Two routes:
 * "home" brings Kallias home in his old cloak (he stands at the gathering,
 * the player's letter case and rolled cloak show), "reply" carries his
 * answer on the tablets (they lie beside Ammia).
 *
 *   E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/letter-art.spec.ts --project=desktop-chromium
 *
 * Output: test-results/letter-art/<set>/<viewport>-<route>-<nn>-<name>.png,
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

const ROUTES = ['home', 'reply'] as const;

// Draw with the real GPU on a Mac (see place-art.spec.ts).
if (process.platform === 'darwin')
  test.use({
    launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] },
  });
const SET = process.env.ART_SHOTS ?? 'current';
const SETTLE_MS = 5200;

/**
 * Click through every conversation until none is open and none opens again
 * (arriving somewhere can start one a moment later).
 */
async function settleDialogue(page: Page): Promise<void> {
  let quiet = 0;
  for (let i = 0; i < 120 && quiet < 6; i++) {
    const box = page.locator('section.dialogue');
    if ((await box.count()) === 0) {
      quiet++;
      await page.waitForTimeout(500);
      continue;
    }
    quiet = 0;
    const next = box.getByRole('button', { name: /^(Continue|Show all text|End conversation)$/ });
    if (
      await next
        .first()
        .isVisible()
        .catch(() => false)
    )
      await next.first().click();
    else await box.locator('.choice').first().click();
  }
}

async function canvasInfo(page: Page): Promise<string> {
  const canvas = page.locator('.viewport canvas');
  const art = await canvas.getAttribute('data-art');
  const mb = await canvas.getAttribute('data-texture-mb');
  const weather = await canvas.getAttribute('data-weather');
  const scene = await page.locator('.hud__scene').textContent();
  return `${scene ?? '?'}\tart=${art ?? '?'}\ttextureMb=${mb ?? '?'}\tweather=${weather ?? '?'}`;
}

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test.describe(`${vp.name} ${route}`, () => {
      test.use(vp.use);
      test(`letter art (${vp.name}, ${route})`, async ({ page }) => {
        test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
        test.setTimeout(480_000);
        let n = 0;
        const info: string[] = [];
        const prefix = `test-results/letter-art/${SET}/${vp.name}-${route}`;
        const shot = async (name: string, settle = 600): Promise<void> => {
          await page.waitForTimeout(settle);
          n++;
          await page.screenshot({ path: `${prefix}-${String(n).padStart(2, '0')}-${name}.png` });
          info.push(`${String(n).padStart(2, '0')}-${name}\t${await canvasInfo(page)}`);
        };
        const home = route === 'home';

        await openApp(page);
        await setFastSettings(page);
        await createProfile(page, 'Ari');
        await newGame(page, 'A Letter from Paul');
        await waitForWorld(page);
        await expectScene(page, 'Ammia’s dye workshop');
        await choose(page, 'What does it say?');
        await choose(page, 'I’ll go to Zenon.');
        await endDialogue(page);
        await shot('workshop', SETTLE_MS);

        await goTo(page, 'Go to the street');
        await expectScene(page, 'A street in Colossae');
        await shot('street', SETTLE_MS);
        await goTo(page, 'Talk to Tatia the fuller');
        await choose(page, 'Will it rain today?');
        await choose(page, 'Goodbye, Tatia.');
        await endDialogue(page);
        await shot('street-fullery', SETTLE_MS);
        await goTo(page, 'Talk to Zenon the scribe');
        await choose(page, 'Let me try to put it in order.');
        await endDialogue(page);
        const sheets = page.getByRole('dialog', { name: 'Kallias’s Letter' });
        const earlier = (text: RegExp) =>
          sheets.getByRole('button', { name: new RegExp(`Move earlier: .*${text.source}`) });
        for (let i = 0; i < 3; i++) await earlier(/Kallias, to Ammia/).click();
        for (let i = 0; i < 2; i++) await earlier(/Before anything else/).click();
        for (let i = 0; i < 2; i++) await earlier(/About the red batch/).click();
        await sheets.getByRole('button', { name: 'Check the order' }).click();
        await sheets.getByLabel(/He asks to come back/).check();
        await sheets.getByRole('button', { name: 'Decide' }).click();
        await sheets.getByRole('button', { name: 'Continue' }).click();
        await shot('street-stoa', SETTLE_MS);

        await goTo(page, 'Go to Ammia’s workshop');
        await goTo(page, 'Talk to Ammia');
        await choose(page, 'Read every word, just as he wrote it.');
        await endDialogue(page);
        await goTo(page, 'Use Travel bag');
        const bag = page.getByRole('dialog', { name: 'Ready for the Road' });
        if (home) await bag.getByRole('button', { name: 'Pack one Kallias’s old cloak' }).click();
        await bag.getByRole('button', { name: 'Pack one Writing tablets and stylus' }).click();
        await bag.getByRole('button', { name: 'Pack one Leather letter case' }).click();
        await bag.getByRole('button', { name: 'Finish packing' }).click();
        await expect(bag.getByText('Solved!')).toBeVisible();
        await bag.getByRole('button', { name: 'Continue' }).click();
        await shot('workshop-packed', 1500);

        await goTo(page, 'Go to the street');
        await goTo(page, /Go to the west gate/);
        await expectScene(page, 'The Laodicea road');
        await shot('road-arrival', SETTLE_MS);
        await goTo(page, /Read A milestone/);
        await shot('road-milestone', SETTLE_MS);
        await goTo(page, /Examine The waystation/);
        await shot('road-waystation', SETTLE_MS);
        await goTo(page, /Examine The white hillside/);
        await shot('road-hierapolis', SETTLE_MS);
        await goTo(page, 'Talk to Kallias');
        await choose(page, 'Your letter reached her. She has answered it.');
        await continueDialogue(page);
        await shot('road-dye-works', 1500);
        await choose(page, /I’ll speak for you/);
        if (home) {
          await choose(page, /Come home with me now/);
          await choose(page, /Ammia kept your old cloak/);
          await continueDialogue(page);
          await expectScene(page, 'A street in Colossae');
          await settleDialogue(page);
        } else {
          await choose(page, /I’ll write it down and carry it to her/);
          await settleDialogue(page);
          await shot('road-after', SETTLE_MS);
          await goTo(page, /Go to the road back to Colossae/);
          await expectScene(page, 'A street in Colossae');
          await settleDialogue(page);
        }
        await shot('street-return', SETTLE_MS);

        // Travel once more if a conversation opened just as we set off.
        await goTo(page, 'Go to Philemon’s house');
        if ((await page.locator('.hud__scene').textContent()) !== 'Philemon’s house') {
          await settleDialogue(page);
          await goTo(page, 'Go to Philemon’s house');
        }
        await expectScene(page, 'Philemon’s house');
        await settleDialogue(page);
        await shot('gathering', SETTLE_MS);
        await goTo(page, 'Talk to Ammia');
        await continueDialogue(page);
        await shot('gathering-reading', 1200);
        test.info().annotations.push({ type: 'art', description: info.join('\n') });
        writeFileSync(`${prefix}-art.txt`, info.join('\n') + '\n');
      });
    });
  }
}

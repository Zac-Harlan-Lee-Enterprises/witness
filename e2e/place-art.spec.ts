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
import { artDetails } from './world-probe';

/**
 * Art captures of every place in Chapter 1 at fixed positions (not a
 * pass/fail test): the house, the market, the road (arrival, the fork, the
 * ridge, the traveler) and Jericho (arrival, the inn, the courtyard), at
 * desktop, tablet and phone sizes. Two routes: "help" leaves supplies and
 * sends help; "tend" binds the traveler's wounds with a strip of the
 * player's tunic and gives him the spare cloak, so story marks show
 * (bandages, a borrowed cloak, a torn hem, carried gear).
 *
 *   E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/place-art.spec.ts --project=desktop-chromium
 *   E2E_SHOTS=1 ART_SHOTS=after npx playwright test e2e/place-art.spec.ts --project=desktop-chromium -g "desktop help"
 *
 * Output: test-results/place-art/<set>/<viewport>-<route>-<nn>-<name>.png,
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

const ROUTES = ['help', 'tend'] as const;

// Captures are for judging the art. On a Mac, draw with the real GPU: the
// software renderer headless Chromium uses otherwise runs slowly enough that
// the game switches to its low-power (half-resolution) art after the first
// place, so the captures would not show what players see.
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

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test.describe(`${vp.name} ${route}`, () => {
      test.use(vp.use);
      test(`place art (${vp.name}, ${route})`, async ({ page }) => {
        test.skip(!process.env.E2E_SHOTS, 'art captures run only with E2E_SHOTS=1');
        test.setTimeout(420_000);
        let n = 0;
        const info: string[] = [];
        const prefix = `test-results/place-art/${SET}/${vp.name}-${route}`;
        const shot = async (name: string, settle = 600): Promise<void> => {
          await page.waitForTimeout(settle);
          n++;
          await page.screenshot({ path: `${prefix}-${String(n).padStart(2, '0')}-${name}.png` });
          info.push(
            `${String(n).padStart(2, '0')}-${name}\t${await canvasInfo(page)}\t${await artDetails(page)}`,
          );
          // Written after every shot, so a run that stops early keeps what it measured.
          writeFileSync(`${prefix}-art.txt`, info.join('\n') + '\n');
        };
        const tend = route === 'tend';

        await openApp(page);
        await setFastSettings(page);
        await createProfile(page, 'Ari');
        await newGame(page);
        await waitForWorld(page);
        await choose(page, 'Of course. What do I need to know?');
        await choose(page, 'I’ll head to the market.');
        await endDialogue(page);
        await shot('house', SETTLE_MS);

        await goTo(page, 'Go to the market');
        await expectScene(page, 'The lower market, Jerusalem');
        await shot('market', SETTLE_MS);
        await goTo(page, 'Talk to Old Shimon');
        await choose(page, 'I’m going down to Jericho. Any advice?');
        await choose(page, 'Is there any water on the way?');
        await choose(page, 'That could save a lot of weight in my satchel.');
        await choose(page, 'Goodbye, Shimon.');
        await endDialogue(page);

        await goTo(page, 'Go to Aunt Miriam’s house');
        await expectScene(page, 'Aunt Miriam’s house');
        await goTo(page, 'Use Travel satchel');
        const packing = page.getByRole('dialog', { name: 'Pack the Satchel' });
        await packing.getByRole('button', { name: 'Pack one Water skin' }).click();
        if (tend) await packing.getByRole('button', { name: 'Pack one Spare cloak' }).click();
        else await packing.getByRole('button', { name: 'Pack one Bread and dates' }).click();
        await packing.getByRole('button', { name: 'Finish packing' }).click();
        await expect(packing.getByText('Solved!')).toBeVisible();
        await packing.getByRole('button', { name: 'Continue' }).click();
        await shot('house-packed', 1500);

        await goTo(page, 'Go to the market');
        await expectScene(page, 'The lower market, Jerusalem');
        await shot('market-packed', SETTLE_MS);
        await goTo(page, /Go to the east gate/);
        await expectScene(page, 'The road down to Jericho');
        await shot('road-arrival', SETTLE_MS);
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(900);
        await shot('road-walking', 0);
        await page.keyboard.up('ArrowRight');
        await goTo(page, 'Use The crossroads — choose a route');
        await continueDialogue(page);
        await endDialogue(page);
        const routePuzzle = page.getByRole('dialog', { name: 'Which Way Down?' });
        await routePuzzle.getByLabel(/The shepherds’ ridge path/).check();
        await routePuzzle.getByLabel(/A cistern on the ridge/).check();
        await routePuzzle.getByLabel(/Watchers at the bend/).check();
        await routePuzzle.getByRole('button', { name: 'Present my reasoning' }).click();
        await routePuzzle.getByRole('button', { name: 'Continue' }).click();
        await shot('road-fork', SETTLE_MS);
        await goTo(page, 'Use Stone cistern');
        await shot('road-cistern', 1500);
        await goTo(page, 'Examine Broken jar');
        await endDialogue(page);
        await shot('road-incident', SETTLE_MS);
        await goTo(page, 'Examine Many footprints');
        await goTo(page, 'Examine Drag marks');
        await choose(page, 'Think it through now.');
        await endDialogue(page);
        const sequence = page.getByRole('dialog', { name: 'What Happened Here?' });
        const earlier = (text: string) =>
          sequence.getByRole('button', { name: `Move earlier: ${text}` });
        await earlier('The traveler walked down from the bend alone.').click();
        await earlier('The traveler walked down from the bend alone.').click();
        for (let i = 0; i < 3; i++)
          await earlier('Several people came down from the rocks and stopped him.').click();
        await earlier('The robbers went away north, up the gully.').click();
        await sequence.getByRole('button', { name: 'Check the order' }).click();
        await sequence.getByLabel(/They most likely left hours ago/).check();
        await sequence.getByRole('button', { name: 'Decide' }).click();
        await sequence.getByRole('button', { name: 'Continue' }).click();
        await shot('road-traveler', SETTLE_MS);

        await goTo(page, 'Talk to The injured traveler');
        await continueDialogue(page);
        if (tend) {
          await choose(page, /Clean and bind his wounds/);
          await choose(page, 'Give him your cloak.');
          await continueDialogue(page);
          await expectScene(page, 'Jericho, the city of palm trees');
          await goTo(page, 'Talk to Salome the innkeeper');
          await continueDialogue(page);
          await shot('jericho-inn-dialogue', 900);
          await choose(page, 'Here are two coins.');
          await continueDialogue(page);
          const thanks = page.locator('section.dialogue .choice').filter({ hasText: 'Thank you.' });
          if ((await thanks.count()) > 0) await thanks.first().click();
          await endDialogue(page);
          await shot('jericho-inn', SETTLE_MS);
        } else {
          await choose(page, /Leave him what water and food you have/);
          await endDialogue(page);
          await shot('road-after', SETTLE_MS);
          await goTo(page, 'Go to the road on to Jericho');
          await expectScene(page, 'Jericho, the city of palm trees');
          await shot('jericho-arrival', SETTLE_MS);
          await goTo(page, 'Talk to Salome the innkeeper');
          await continueDialogue(page);
          await shot('jericho-inn-dialogue', 900);
          await choose(page, /A man was robbed below the bend/);
          await endDialogue(page);
          await shot('jericho-inn', SETTLE_MS);
        }
        await goTo(page, 'Talk to Natan');
        await choose(page, 'The road is dangerous — but I made it.');
        await endDialogue(page);
        await shot('jericho-courtyard', SETTLE_MS);
        test.info().annotations.push({ type: 'art', description: info.join('\n') });
        writeFileSync(`${prefix}-art.txt`, info.join('\n') + '\n');
      });
    });
  }
}

import { devices, expect, test, type Page } from '@playwright/test';
import {
  choose,
  continueDialogue,
  createProfile,
  endDialogue,
  expectScene,
  goTo,
  openApp,
  waitForWorld,
} from './support';

/**
 * Visual review tour (not a pass/fail test): walks the chapter and captures
 * the same views in several presentation variants, so art changes can be
 * compared screen by screen. Runs only with E2E_SHOTS=1:
 *
 *   E2E_SHOTS=1 npx playwright test e2e/visual-tour.spec.ts --project=desktop-chromium
 *
 * Output: test-results/tour/<variant>/<nn-name>.png
 */
interface Variant {
  name: string;
  use: Parameters<typeof test.use>[0];
  highContrast?: boolean;
  reducedMotion?: boolean;
}

const VARIANTS: Variant[] = [
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
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  { name: 'high-contrast', use: { viewport: { width: 1280, height: 720 } }, highContrast: true },
  { name: 'reduced-motion', use: { viewport: { width: 1280, height: 720 } }, reducedMotion: true },
];

/** Let arrival banners, fades and notices settle before a world shot. */
const SETTLE_MS = 5200;

for (const variant of VARIANTS) {
  test.describe(variant.name, () => {
    test.use(variant.use);

    test(`visual tour (${variant.name})`, async ({ page }) => {
      test.setTimeout(420_000);
      let n = 0;
      const shot = async (name: string, settle = 400): Promise<void> => {
        await page.waitForTimeout(settle);
        n++;
        await page.screenshot({
          path: `test-results/tour/${variant.name}/${String(n).padStart(2, '0')}-${name}.png`,
        });
      };
      if (variant.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });

      await openApp(page);
      await shot('title', 800);
      await configure(page, variant);
      await createProfile(page, 'Ari');
      await shot('chapters');
      await page.getByRole('button', { name: 'New game' }).click();
      await waitForWorld(page);
      await shot('house-opening-dialogue', 1500);
      await choose(page, 'Of course. What do I need to know?');
      await choose(page, 'I’ll head to the market.');
      await endDialogue(page);
      await shot('house-world', SETTLE_MS);

      await goTo(page, 'Go to the market');
      await expectScene(page, 'The lower market, Jerusalem');
      await shot('market-arrival', 900);
      await shot('market-world', SETTLE_MS);
      await goTo(page, 'Talk to Old Shimon');
      await shot('market-dialogue', 800);
      await choose(page, 'I’m going down to Jericho. Any advice?');
      await choose(page, 'Is there any water on the way?');
      await choose(page, 'That could save a lot of weight in my satchel.');
      await choose(page, 'Goodbye, Shimon.');
      await endDialogue(page);
      await shot('market-after-talk', SETTLE_MS);

      await goTo(page, 'Go to Aunt Miriam’s house');
      await goTo(page, 'Use Travel satchel');
      const packing = page.getByRole('dialog', { name: 'Pack the Satchel' });
      await packing.getByRole('button', { name: 'Pack one Water skin' }).click();
      await packing.getByRole('button', { name: 'Pack one Bread and dates' }).click();
      await shot('packing-puzzle');
      await packing.getByRole('button', { name: 'Finish packing' }).click();
      await expect(packing.getByText('Solved!')).toBeVisible();
      await shot('packing-solved');
      await packing.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: /^Journal/ }).click();
      await shot('journal');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /^Satchel/ }).click();
      await shot('satchel');
      await page.keyboard.press('Escape');

      await goTo(page, 'Go to the market');
      await goTo(page, /Go to the east gate/);
      await expectScene(page, 'The road down to Jericho');
      await shot('road-arrival', 900);
      await shot('road-world', SETTLE_MS);
      await goTo(page, 'Use The crossroads — choose a route');
      await continueDialogue(page);
      await endDialogue(page);
      const route = page.getByRole('dialog', { name: 'Which Way Down?' });
      await route.getByLabel(/The shepherds’ ridge path/).check();
      await route.getByLabel(/A cistern on the ridge/).check();
      await route.getByLabel(/Watchers at the bend/).check();
      await shot('route-puzzle');
      await route.getByRole('button', { name: 'Present my reasoning' }).click();
      await route.getByRole('button', { name: 'Continue' }).click();
      await shot('road-fork-world', SETTLE_MS);

      await goTo(page, 'Examine Broken jar');
      await endDialogue(page);
      await shot('road-ridge-world', SETTLE_MS);
      await goTo(page, 'Examine Many footprints');
      await goTo(page, 'Examine Drag marks');
      await choose(page, 'Think it through now.');
      await endDialogue(page);
      const sequence = page.getByRole('dialog', { name: 'What Happened Here?' });
      await shot('sequence-puzzle');
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
      await shot('road-traveler-world', SETTLE_MS);

      await goTo(page, 'Talk to The injured traveler');
      await continueDialogue(page);
      await shot('traveler-decision');
      await choose(page, /Leave him what water and food you have/);
      await endDialogue(page);

      await goTo(page, 'Go to the road on to Jericho');
      await expectScene(page, 'Jericho, the city of palm trees');
      await shot('jericho-arrival', 900);
      await shot('jericho-world', SETTLE_MS);
      await goTo(page, 'Talk to Salome the innkeeper');
      await continueDialogue(page);
      await shot('jericho-inn-dialogue');
      await choose(page, /A man was robbed below the bend/);
      await endDialogue(page);
      await shot('jericho-inn-world', SETTLE_MS);
      await goTo(page, 'Talk to Rivka');
      await shot('jericho-rivka-dialogue', 800);
      await choose(page, 'I found a man who’d been robbed below the bend.');
      await choose(page, 'A Samaritan?');
      await continueDialogue(page);
      await endDialogue(page);
      await shot('connection', 800);
      await page
        .getByRole('dialog', { name: 'A Story on the Same Road' })
        .getByRole('button', { name: 'Continue' })
        .click();
      const reflect = page.getByRole('dialog', { name: 'Reflect' });
      await reflect.getByLabel('Your reflection (optional)').fill('Stopping was hard.');
      await shot('reflection');
      await reflect.getByRole('button', { name: 'Save and continue' }).click();
      await shot('summary', 800);
    });
  });
}

async function configure(page: Page, variant: Variant): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByLabel('Dialogue text speed').selectOption('instant');
  await dialog.getByLabel('Instant travel from the “Go to…” list').check();
  if (variant.highContrast) await dialog.getByLabel('High contrast').check();
  await dialog.getByRole('button', { name: 'Done' }).click();
}

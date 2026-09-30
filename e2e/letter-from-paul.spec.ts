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
  snap,
  waitForWorld,
  timeLimit,
  packBag,
  walkMap,
  checkPuzzleA11y,
} from './support';

/**
 * Chapter 4 end to end, through the accessible UI only: a new profile →
 * chapter select → the opening conversation → the letter puzzle → reading
 * aloud → packing → the Laodicea road in the rain → the decision at the dye
 * works → the gathering → the letters read as labelled paraphrase → the
 * Scripture Connection → reflection → summary.
 */
const dialogueBox = (page: Page) => page.locator('section.dialogue');

/**
 * Click Continue (and End conversation, when one conversation hands over to
 * the next) until the dialogue shows `text`, or offers a choice.
 */
async function continueUntil(page: Page, text: RegExp): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const box = dialogueBox(page);
    if ((await box.count()) === 0) {
      await page.waitForTimeout(150); // the next conversation is about to open
      continue;
    }
    if (text.test((await box.textContent()) ?? '')) return;
    const next = box.getByRole('button', { name: /^(Continue|Show all text|End conversation)$/ });
    if (!(await next.isVisible().catch(() => false))) return;
    await next.click();
  }
}

test('play A Letter from Paul from a new profile to the chapter summary', async ({ page }) => {
  test.setTimeout(timeLimit(240_000));
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Ari');
  await newGame(page, 'A Letter from Paul');
  await waitForWorld(page);
  await expectScene(page, 'Ammia’s dye workshop');
  await snap(page, 'lfp-01-workshop-opening');

  // The opening conversation hands over the letter and starts the quest.
  await choose(page, 'What does it say?');
  await choose(page, 'I’ll go to Zenon.');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Quests/ }).click();
  await expect(page.getByRole('dialog', { name: 'Quests' })).toContainText('Carried by Hand');
  await page.keyboard.press('Escape');

  // The street: learn about the weather, then sort the letter with Zenon.
  await goTo(page, 'Go to the street');
  await expectScene(page, 'A street in Colossae');
  await snap(page, 'lfp-02-street');
  await goTo(page, 'Talk to Tatia the fuller');
  await choose(page, 'Will it rain today?');
  await choose(page, 'Goodbye, Tatia.');
  await endDialogue(page);
  await goTo(page, 'Talk to Zenon the scribe');
  await choose(page, 'Let me try to put it in order.');
  await endDialogue(page);
  const sheets = page.getByRole('dialog', { name: 'Kallias’s Letter' });
  await expect(sheets).toBeVisible();
  const earlier = (text: RegExp) =>
    sheets.getByRole('button', { name: new RegExp(`Move earlier: .*${text.source}`) });
  for (let i = 0; i < 3; i++) await earlier(/Kallias, to Ammia/).click();
  for (let i = 0; i < 2; i++) await earlier(/Before anything else/).click();
  for (let i = 0; i < 2; i++) await earlier(/About the red batch/).click();
  await snap(page, 'lfp-03-letter-sheets');
  await sheets.getByRole('button', { name: 'Check the order' }).click();
  await sheets.getByLabel(/He asks to come back/).check();
  await sheets.getByRole('button', { name: 'Decide' }).click();
  await expect(sheets.getByText('Solved!')).toBeVisible();
  await sheets.getByRole('button', { name: 'Continue' }).click();

  // Read it aloud to Ammia — every word — and write down her answer.
  await goTo(page, 'Go to Ammia’s workshop');
  await goTo(page, 'Talk to Ammia');
  await choose(page, 'Read every word, just as he wrote it.');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Satchel/ }).click();
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toContainText('Ammia’s answer');
  await page.keyboard.press('Escape');

  // Map reading: Ammia's directions to Nikon's dye works, followed on her sketch.
  await goTo(page, 'Talk to Ammia');
  await choose(page, 'Which way is Nikon’s dye works?');
  await endDialogue(page);
  const way = page.getByRole('dialog', { name: 'The Way to the Bridge' });
  await expect(way).toBeVisible();
  await checkPuzzleA11y(page, 'map puzzle');
  await walkMap(way, [
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowDown',
    'ArrowLeft',
    'ArrowLeft',
  ]);
  await snap(page, 'lfp-04-map');
  await expect(way.getByText('Solved!')).toBeVisible();
  await way.getByRole('button', { name: 'Continue' }).click();

  // Packing, one thing at a time: rain is coming, so the letter must be kept dry.
  await goTo(page, 'Use Travel bag');
  await choose(page, 'Put in Kallias’s old cloak');
  await choose(page, 'Put in the writing tablets');
  await expect(
    page.locator('section.dialogue .choice').filter({ hasText: 'Tie the bag shut' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('section.dialogue')).toContainText('keep it dry');
  await snap(page, 'lfp-05-packing');
  await packBag(page, ['the leather letter case']);

  // Down the Laodicea road.
  await goTo(page, 'Go to the street');
  await goTo(page, /Go to the west gate/);
  await expectScene(page, 'The Laodicea road');
  await snap(page, 'lfp-05-road');
  await goTo(page, 'Talk to Kallias');
  await choose(page, 'Your letter reached her. She has answered it.');
  // The rain has come down the valley (the world records the weather).
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-weather', 'rain');
  await snap(page, 'lfp-06-dye-works');
  await choose(page, /I’ll speak for you/);
  // Colour mixing: match the buyer's shade so Kallias keeps his wage.
  await choose(page, 'Let me help with the test skein first.');
  await endDialogue(page);
  await goTo(page, 'Use The test skein and the vats');
  const dye = page.getByRole('dialog', { name: 'The Buyer’s Shade' });
  await expect(dye).toContainText('mulberry (red 3, blue 2)');
  await checkPuzzleA11y(page, 'dyeing puzzle');
  for (const bath of ['the madder vat', 'the rinsing trough', 'the madder vat', 'the blue vat'])
    await dye.getByRole('button', { name: `Dip in ${bath}` }).click();
  await expect(dye.getByText('Solved!')).toBeVisible();
  await dye.getByRole('button', { name: 'Continue' }).click();
  await goTo(page, 'Talk to Kallias');
  await choose(page, /Come home with me now/);
  await choose(page, /Ammia kept your old cloak/);
  await continueDialogue(page);

  // Home through the west gate as the rain eases; on to the gathering.
  await expectScene(page, 'A street in Colossae');
  await endDialogue(page);
  await goTo(page, 'Go to Philemon’s house');
  await expectScene(page, 'Philemon’s house');
  // Stepping inside describes the gathering and the silent travellers.
  await expect(dialogueBox(page)).toContainText('Lamps burn');
  await endDialogue(page);
  await snap(page, 'lfp-07-gathering');
  await page.getByRole('button', { name: /^Journal/ }).click();
  const journal = page.getByRole('dialog', { name: 'Journal' });
  await journal.getByRole('tab', { name: /People/ }).click();
  await expect(journal).toContainText('Onesimus');
  await page.keyboard.press('Escape');
  await goTo(page, 'Talk to Ammia');

  // The letters are read aloud — as labelled paraphrase, never as Scripture text.
  await continueUntil(page, /Paul, a prisoner, writes with Timothy/);
  await expect(dialogueBox(page)).toContainText('A retelling in our own words');
  await expect(dialogueBox(page)).toContainText('not a direct quotation');
  await snap(page, 'lfp-08-reading');
  await choose(page, 'He meant every word, Ammia. I saw him.');
  await continueDialogue(page);
  await endDialogue(page);

  const connection = page.getByRole('dialog', { name: 'Two Letters Read Aloud' });
  await expect(connection).toBeVisible();
  await expect(connection).toContainText(
    'Paul, a prisoner of Christ Jesus, and Ti', // the approved World English Bible text
  );
  await expect(connection).toContainText('In our own words — not a quotation');
  await expect(connection).toContainText('Why was Onesimus away?');
  await snap(page, 'lfp-09-connection');
  await connection.getByRole('button', { name: 'Continue' }).click();
  const reflect = page.getByRole('dialog', { name: 'Reflect' });
  await reflect
    .getByLabel('Your reflection (optional)')
    .fill('It is hard to go back and face someone.');
  await reflect.getByRole('button', { name: 'Save and continue' }).click();

  const summary = page.getByRole('dialog', { name: 'Chapter complete: A Letter from Paul' });
  await expect(summary).toBeVisible();
  await snap(page, 'lfp-10-summary');
  await expect(summary).toContainText('Kallias walked home warm in the cloak');
  await expect(summary).toContainText('You kept your word and spoke up for Kallias');
  await expect(summary.getByRole('heading', { name: 'Scripture references' })).toBeVisible();
  await expect(summary).toContainText('Philemon 1–25');
  await expect(summary).toContainText('Colossians 4:7–9');
  await expect(summary).not.toContainText(/score|points|holiness/i);
});

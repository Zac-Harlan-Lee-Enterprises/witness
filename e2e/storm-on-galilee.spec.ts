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
} from './support';

/** The weather the story has asked the world to show (recorded on the canvas). */
const weather = (page: Page) => page.locator('.viewport canvas');
const dialogueBox = (page: Page) => page.locator('section.dialogue');

/**
 * Read to the end of any narration a place or a story beat starts on its own
 * (it may already have been read through by the previous step).
 */
async function readNarration(page: Page): Promise<void> {
  await page.waitForTimeout(400);
  await endDialogue(page);
}

/** Read on — through this conversation and any the story starts next — until a choice appears. */
async function readUntilChoice(page: Page, choice: string): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const box = dialogueBox(page);
    if ((await box.locator('.choice').filter({ hasText: choice }).count()) > 0) return;
    const next = box.getByRole('button', { name: /^(Continue|End conversation|Show all text)$/ });
    if (await next.isVisible().catch(() => false)) await next.click();
    else await page.waitForTimeout(100);
  }
  throw new Error(`The choice “${choice}” never appeared`);
}

/**
 * Chapter 2 end to end: new profile → chapter select → the opening →
 * reading the sky → loading the boat → out on the lake as the weather rises
 * (data-weather) → the storm and a decision → the calm → home →
 * Scripture Connection → reflection → summary.
 */
test('play A Storm on Galilee from a new profile to the chapter summary', async ({ page }) => {
  test.setTimeout(240_000);
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Noa');
  await newGame(page, 'A Storm on Galilee');
  await waitForWorld(page);
  await expectScene(page, 'Grandmother Shelomit’s house');
  await snap(page, 'storm-01-house-opening');

  // The opening: Grandmother's words about the teacher's boat are a labelled paraphrase.
  await choose(page, 'So many people! Who are they listening to?');
  await expect(dialogueBox(page)).toContainText('Scripture paraphrase');
  await choose(page, 'I’m ready. What do I do?');
  await choose(page, 'I’ll go and find Hanina.');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Quests/ }).click();
  await expect(page.getByRole('dialog', { name: 'Quests' })).toContainText('The Crossing');
  await page.keyboard.press('Escape');

  // The shore on an afternoon of westerly wind.
  await goTo(page, 'Go to the shore');
  await expectScene(page, 'The shore at Capernaum');
  await expect(weather(page)).toHaveAttribute('data-weather', 'wind');
  await snap(page, 'storm-02-shore');
  await goTo(page, 'Talk to Uncle Elazar');
  await choose(page, 'Not yet.');
  await endDialogue(page);
  await goTo(page, 'Talk to Nikanor the salt-fish trader');
  await choose(page, 'I’ll take them down to the boat.');
  await endDialogue(page);
  await snap(page, 'storm-03-salting-racks');

  // Reading the sky (deduction).
  await goTo(page, 'Talk to Old Hanina');
  await choose(page, 'Grandmother says to ask you what the sky is saying.');
  await choose(page, 'I’ll look around first.');
  await endDialogue(page);
  await goTo(page, 'Examine The far shore, across the lake');
  await goTo(page, 'Use The end of the jetty — read the sky');
  const sky = page.getByRole('dialog', { name: 'What Is the Sky Saying?' });
  await expect(sky).toBeVisible();
  await sky.getByLabel(/A strong wind could rush down after dark/).check();
  await sky.getByLabel(/Winds off the heights/).check();
  await sky.getByLabel(/Cold air off the eastern hills/).check();
  await snap(page, 'storm-04-sky-puzzle');
  await sky.getByRole('button', { name: 'Present my reasoning' }).click();
  await expect(sky.getByText('Solved!')).toBeVisible();
  await sky.getByRole('button', { name: 'Continue' }).click();

  // Loading the boat (packing): four jars leaves room for a rope, the spare oar, a cloak and a lamp.
  await goTo(page, 'Use The family boat');
  await choose(page, 'Load the boat.');
  await endDialogue(page);
  const load = page.getByRole('dialog', { name: 'Load the Boat' });
  await expect(load).toBeVisible();
  const pack = (name: string) => load.getByRole('button', { name: `Pack one ${name}` }).click();
  await pack('Bailing scoop');
  for (let i = 0; i < 4; i++) await pack('Jar of salted fish');
  await pack('Coil of rope');
  await pack('Spare oar');
  await pack('Your cloak');
  await pack('Clay lamp');
  await snap(page, 'storm-05-loading');
  await load.getByRole('button', { name: 'Finish packing' }).click();
  await expect(load.getByText('Solved!')).toBeVisible();
  await load.getByRole('button', { name: 'Continue' }).click();

  // Evening: the boats put out (a labelled paraphrase of Mark 4:35–36), and the wind has dropped.
  await expect(dialogueBox(page)).toContainText('Scripture paraphrase');
  await expect(weather(page)).toHaveAttribute('data-weather', 'clear');
  await continueDialogue(page);
  await endDialogue(page);
  await expectScene(page, 'Out on the lake');
  await readNarration(page); // under way
  await expect(weather(page)).toHaveAttribute('data-weather', 'clear');
  await snap(page, 'storm-06-lake-dusk');

  // The wind rises: get the sail in (sequence).
  await goTo(page, 'Examine The view from the bow');
  await readUntilChoice(page, 'Get the sail in!');
  await expect(weather(page)).toHaveAttribute('data-weather', 'wind');
  await snap(page, 'storm-07-gust');
  await choose(page, 'Get the sail in!');
  await endDialogue(page);
  const sail = page.getByRole('dialog', { name: 'Shorten Sail!' });
  await expect(sail).toBeVisible();
  const earlier = (text: string) => sail.getByRole('button', { name: `Move earlier: ${text}` });
  for (let i = 0; i < 2; i++)
    await earlier('Haul on the brails to gather the sail up to the yard.').click();
  for (let i = 0; i < 2; i++) await earlier('Lower the yard and lash it down.').click();
  await snap(page, 'storm-08-sail-puzzle');
  await sail.getByRole('button', { name: 'Check the order' }).click();
  await sail.getByLabel(/Keep her bow to the waves/).check();
  await sail.getByRole('button', { name: 'Decide' }).click();
  await expect(sail.getByText('Solved!')).toBeVisible();
  await sail.getByRole('button', { name: 'Continue' }).click();

  // The storm breaks.
  await expect(dialogueBox(page)).toBeVisible();
  await expect(weather(page)).toHaveAttribute('data-weather', 'storm');
  await snap(page, 'storm-09-storm');
  await endDialogue(page);

  // The decision at the rail, then the calm.
  await goTo(page, 'Talk to The little boat off the port side');
  await continueDialogue(page);
  await snap(page, 'storm-10-decision');
  await choose(page, 'Throw them the rope and tow them.');
  await endDialogue(page);
  await readNarration(page); // the calm
  await expect(weather(page)).toHaveAttribute('data-weather', 'clear');
  await snap(page, 'storm-11-calm');

  // Home in the night.
  await goTo(page, 'Talk to Uncle Elazar, at the steering oar');
  await choose(page, 'Can we go home?');
  await endDialogue(page);
  await expectScene(page, 'The shore at Capernaum');
  await readNarration(page); // homecoming
  await snap(page, 'storm-12-home-night');
  await goTo(page, 'Talk to Grandmother Shelomit, with a lamp');
  await choose(page, 'And then the wind just stopped. All at once.');
  await continueDialogue(page);
  await endDialogue(page);

  // The Scripture Connection shows what Mark wrote; the story never did.
  const connection = page.getByRole('dialog', { name: 'What Happened in the Boat Ahead' });
  await expect(connection).toBeVisible();
  await expect(connection).toContainText(
    '[SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Mark 4:35-41]',
  );
  await expect(connection).toContainText('In our own words — not a quotation');
  await expect(connection).toContainText('Christians may understand this differently');
  await snap(page, 'storm-13-connection');
  await connection.getByRole('button', { name: 'Continue' }).click();
  const reflect = page.getByRole('dialog', { name: 'Reflect' });
  await reflect.getByLabel('Your reflection (optional)').fill('I was afraid for the little boat.');
  await reflect.getByRole('button', { name: 'Save and continue' }).click();

  const summary = page.getByRole('dialog', { name: 'Chapter complete: A Storm on Galilee' });
  await expect(summary).toBeVisible();
  await snap(page, 'storm-14-summary');
  await expect(summary).toContainText('Your rope held, and the two boats came home tied together.');
  await expect(summary.getByRole('heading', { name: 'Scripture references' })).toBeVisible();
  await expect(summary).toContainText('Mark 4:35–41');
  await expect(summary).toContainText('Psalm 107:23–30');
  await expect(summary).not.toContainText(/score|points|holiness/i);
});

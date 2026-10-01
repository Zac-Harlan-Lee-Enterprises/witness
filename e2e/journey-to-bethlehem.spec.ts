import { expect, test } from '@playwright/test';
import {
  choose,
  continueDialogue,
  createProfile,
  endArrivalNarration,
  endDialogue,
  expectScene,
  goTo,
  newGame,
  openApp,
  setFastSettings,
  snap,
  waitForWorld,
  timeLimit,
  chooseInGrid,
  placePiece,
  checkPuzzleA11y,
} from './support';

/**
 * Chapter 3 in a real browser: a new profile → chapter select → A Journey
 * to Bethlehem → the opening → all four kinds of puzzle on the main path and
 * the side quest skipped → Hagit's runaway kid (a second logic grid) for
 * Dodi's milk → the lost lamb → supper by the fire → a stranger at the door →
 * the shepherds' news as labelled paraphrase → Scripture Connection →
 * reflection → summary (with no score language). E2E_SHOTS=1 saves a picture
 * of each stage.
 */
test('play A Journey to Bethlehem from a new profile to the chapter summary', async ({ page }) => {
  test.setTimeout(timeLimit(420_000)); // a longer chapter; generous for busy machines
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Noa');
  await newGame(page, 'A Journey to Bethlehem');
  await waitForWorld(page);
  await expectScene(page, 'Tamar’s house, Bethlehem');
  await snap(page, 'bethlehem-01-house');

  // The opening conversation gives the main quest.
  await choose(page, 'Why does the emperor want everyone written down?');
  await choose(page, 'What can I do?');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Quests/ }).click();
  await expect(page.getByRole('dialog', { name: 'Quests' })).toContainText('Room for Everyone');
  await page.keyboard.press('Escape');

  // Logic grid: who sits where for supper, from four clues.
  await goTo(page, 'Use Kneading trough and flour jar');
  const bread = page.getByRole('dialog', { name: 'Places for Supper' });
  await expect(bread).toBeVisible();
  await checkPuzzleA11y(page, 'logic grid');
  await chooseInGrid(bread, [
    ['Saba Amram', 'Nearest the fire'],
    ['Uncle Asa', 'Second place'],
    ['Aunt Peninah (with Dodi)', 'Third place'],
    ['Tamar', 'Nearest the door'],
  ]);
  await snap(page, 'bethlehem-02-supper');
  await bread.getByRole('button', { name: 'Check my answer' }).click();
  await expect(bread.getByText('Solved!')).toBeVisible();
  await bread.getByRole('button', { name: 'Continue' }).click();

  // Floor plan: noticing the dry corner on the roof lets you leave a space.
  await goTo(page, 'Examine Ladder to the roof');
  await goTo(page, 'Use Guests’ things to arrange');
  const room = page.getByRole('dialog', { name: 'Room in the Guest Room' });
  await expect(room).toBeVisible();
  await placePiece(room, /Aunt Peninah and Dodi’s bedding/, 0, [1, 4]);
  await placePiece(room, /Uncle Asa’s bedding/, 0, [3, 3]);
  await checkPuzzleA11y(page, 'floor plan');
  await snap(page, 'bethlehem-03-room');
  await room.getByRole('button', { name: 'The room is ready' }).click();
  await expect(room.getByText('Solved!')).toBeVisible();
  await room.getByRole('button', { name: 'Continue' }).click();

  await goTo(page, 'Talk to Tamar');
  await choose(page, 'I’m going.');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Satchel/ }).click();
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toContainText('Yonatan’s supper');
  await page.keyboard.press('Escape');

  // The crowded village.
  await goTo(page, 'Go to the lane');
  await expectScene(page, 'The lanes of Bethlehem');
  await endArrivalNarration(page);
  await snap(page, 'bethlehem-04-lanes');
  await goTo(page, 'Talk to Hagit');
  await choose(page, 'Is your house full of guests too?');
  await choose(page, 'Mother asks if you could spare a jar of milk for little Dodi.');
  await choose(page, 'Goodbye, Hagit.');
  await endDialogue(page);

  // Hagit's kid is out: three people each saw part of her afternoon.
  await goTo(page, 'Talk to Saba Amram');
  await choose(page, 'Have you seen Hagit’s little white kid?');
  await choose(page, 'Goodbye, Saba.');
  await endDialogue(page);
  await goTo(page, 'Talk to Uncle Asa, waiting in line');
  await choose(page, 'Have you seen a little white goat kid?');
  await choose(page, 'Hang in there, Uncle.');
  await endDialogue(page);
  await goTo(page, 'Talk to Kallias the clerk');
  await choose(page, 'Did you see a little white goat go past?');
  await choose(page, 'Goodbye.');
  await endDialogue(page);
  await goTo(page, 'Talk to Hagit');
  await choose(page, 'I think I know where your kid went.');
  await endDialogue(page);
  const kid = page.getByRole('dialog', { name: 'The Kid’s Afternoon' });
  await expect(kid).toBeVisible();
  await chooseInGrid(kid, [
    ['The travellers’ cart', 'First'],
    ['The washing by the square', 'Second'],
    ['The trough by the well', 'Third'],
    ['The threshing floor', 'Last'],
  ]);
  await snap(page, 'bethlehem-04b-kid');
  await kid.getByRole('button', { name: 'Check my answer' }).click();
  await expect(kid.getByText('Solved!')).toBeVisible();
  await kid.getByRole('button', { name: 'Continue' }).click();
  await goTo(page, 'Take Something chewing in the chaff heap');
  await goTo(page, 'Talk to Hagit');
  await choose(page, 'Goodbye, Hagit.');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Satchel/ }).click();
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toContainText('Jar of goat’s milk');
  await page.keyboard.press('Escape');
  await goTo(page, 'Take Heap of clean straw');
  await goTo(page, /Go to the east gate/);
  await expectScene(page, 'The fold below Bethlehem');
  await endArrivalNarration(page);

  // The lost lamb: read the signs, then argue for the gully (deduction).
  await goTo(page, 'Talk to Cousin Yonatan');
  await snap(page, 'bethlehem-05-fold');
  await choose(page, 'I’ll find the lamb.');
  await endDialogue(page);
  await goTo(page, 'Examine Hoofprints by the trough');
  await goTo(page, 'Examine Thornbush at the top of the gully');
  await goTo(page, 'Examine The lamb’s mother');
  await choose(page, 'Decide now.');
  await endDialogue(page);
  const lamb = page.getByRole('dialog', { name: 'Where Did the Lamb Go?' });
  await lamb.getByLabel(/Down the gully/).check();
  await lamb.getByLabel(/Small hoofprints/).check();
  await lamb.getByLabel(/Speckled wool on the thorns/).check();
  await snap(page, 'bethlehem-06-lamb-puzzle');
  await lamb.getByRole('button', { name: 'Present my reasoning' }).click();
  await expect(lamb.getByText('Solved!')).toBeVisible();
  await lamb.getByRole('button', { name: 'Continue' }).click();
  await goTo(page, 'Take The speckled lamb');
  await snap(page, 'bethlehem-07-carrying-lamb');
  await goTo(page, 'Talk to Cousin Yonatan');
  await endDialogue(page);

  // Home at night: a knock at the door, and a space left this afternoon.
  await goTo(page, 'Go to the path up to Bethlehem');
  await expectScene(page, 'The lanes of Bethlehem');
  await goTo(page, 'Go to Tamar’s house');
  await expectScene(page, 'Tamar’s house, Bethlehem');
  // Supper by the fire: tell them about the day, and keep the last loaf for whoever knocks.
  await choose(page, 'I found Yonatan’s lost lamb, down in the gully.');
  await snap(page, 'bethlehem-07b-supper');
  await choose(page, 'I’m full.');
  await choose(page, 'Keep it by the oven, in case anyone else comes tonight.');
  await continueDialogue(page);
  await snap(page, 'bethlehem-08-stranger');
  await choose(page, 'There’s a space in the guest room.');
  await endDialogue(page);

  // The shepherds' news, as a neighbor's labelled paraphrase.
  await goTo(page, 'Use Your sleeping mat');
  const box = page.locator('section.dialogue');
  for (let i = 0; i < 6 && !(await box.textContent())?.includes('retelling Scripture'); i++)
    await box.getByRole('button', { name: 'Continue' }).click();
  await expect(box).toContainText('Hagit is retelling Scripture');
  await snap(page, 'bethlehem-09-news');
  await choose(page, 'Wake the others. They should hear this.');
  await endDialogue(page);

  const connection = page.getByRole('dialog', { name: 'Good News in David’s Town' });
  await expect(connection).toBeVisible();
  await expect(connection).toContainText(
    'Now in those days, a decree went out from Cae', // the approved World English Bible text
  );
  await expect(connection).toContainText('In our own words — not a quotation');
  await expect(connection).toContainText('When was the census?');
  await snap(page, 'bethlehem-10-connection');
  await connection.getByRole('button', { name: 'Continue' }).click();
  const reflect = page.getByRole('dialog', { name: 'Reflect' });
  await reflect.getByLabel('Your reflection (optional)').fill('I wondered who else heard it.');
  await reflect.getByRole('button', { name: 'Save and continue' }).click();

  const summary = page.getByRole('dialog', { name: 'Chapter complete: A Journey to Bethlehem' });
  await expect(summary).toBeVisible();
  await snap(page, 'bethlehem-11-summary');
  await expect(summary).toContainText('Zerah slept in the guest room');
  await expect(summary).toContainText('The speckled lamb spent the night back beside its mother.');
  await expect(summary).toContainText('The loaf you kept by the oven went to Zerah');
  await expect(summary.getByRole('heading', { name: 'Scripture references' })).toBeVisible();
  await expect(summary).toContainText('Luke 2:1–20');
  await expect(summary).not.toContainText(/score|points|holiness/i);
});

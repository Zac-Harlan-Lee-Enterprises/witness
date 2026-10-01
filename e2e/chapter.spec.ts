import { expect, test } from '@playwright/test';
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
} from './support';

/**
 * The required end-to-end journey (see docs/testing-strategy.md):
 *  1 create profile · 2 start Chapter 1 · 3 complete a conversation · 4 receive
 *  the main quest · 5 receive an item · 6 solve a puzzle · 7 make a meaningful
 *  choice · 8 observe its consequence · 9 save · 10 reload · 11 restore ·
 *  12 continue · 13 complete the chapter · 14 open the summary · 15 view
 *  Scripture references.
 */
test('play The Road to Jericho from a new profile to the chapter summary', async ({ page }) => {
  test.setTimeout(timeLimit(240_000));
  await openApp(page);
  await setFastSettings(page);
  // The music, as the game exposes it (src/app/services.ts).
  const music = page.locator('html');

  // 1–2
  await createProfile(page, 'Ari');
  await newGame(page);
  await waitForWorld(page);
  await expectScene(page, 'Aunt Miriam’s house');
  await expect(music).toHaveAttribute('data-music', 'cinematic-oud-and-qanun');
  await snap(page, '01-house-opening');

  // 3–5: the opening conversation gives the quest and the remedy.
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await page.getByRole('button', { name: /^Quests/ }).click();
  await expect(page.getByRole('dialog', { name: 'Quests' })).toContainText('Rivka’s Remedy');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Satchel/ }).click();
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toContainText('Aunt Miriam’s remedy');
  await page.keyboard.press('Escape');

  // Ask a traveler about the road.
  await goTo(page, 'Go to the market');
  await expectScene(page, 'The lower market, Jerusalem');
  await snap(page, '02-market');
  await goTo(page, 'Talk to Old Shimon');
  await snap(page, '03-shimon');
  await choose(page, 'I’m going down to Jericho. Any advice?');
  await choose(page, 'Is there any water on the way?');
  await choose(page, 'That could save a lot of weight in my satchel.');
  await choose(page, 'Goodbye, Shimon.');
  await endDialogue(page);

  // Aunt Miriam's errand: Rivka's linen, from Hadassah the weaver.
  await goTo(page, 'Talk to Hadassah the weaver');
  await choose(page, 'Aunt Miriam sent me for Rivka’s linen.');
  await choose(page, 'I’ll keep it safe.');
  await choose(page, 'Goodbye.');
  await endDialogue(page);

  // 6–8: the packing puzzle IS the preparation choice; its consequence is what you carry.
  await goTo(page, 'Go to Aunt Miriam’s house');
  await goTo(page, 'Use Travel satchel');
  const puzzle = page.getByRole('dialog', { name: 'Pack the Satchel' });
  await expect(puzzle).toBeVisible();
  await puzzle.getByRole('button', { name: 'Finish packing' }).click();
  await expect(puzzle.locator('.feedback--problem')).toContainText('water'); // nothing packed yet
  await puzzle.getByRole('button', { name: 'Pack one Water skin' }).click();
  await puzzle.getByRole('button', { name: 'Pack one Bread and dates' }).click();
  await snap(page, '04-packing');
  await puzzle.getByRole('button', { name: 'Finish packing' }).click();
  await expect(puzzle.getByText('Solved!')).toBeVisible();
  await puzzle.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /^Satchel/ }).click();
  const satchel = page.getByRole('dialog', { name: 'Satchel' });
  await expect(satchel).toContainText('Bread and dates');
  await expect(satchel).toContainText('Linen for Rivka');
  await expect(satchel).not.toContainText('Spare cloak'); // left at home — a consequence of the choice
  await page.keyboard.press('Escape');

  // 9: save to a manual slot.
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.getByRole('button', { name: 'Save to slot 1' }).click();
  await expect(page.locator('.toast').filter({ hasText: 'Game saved.' })).toBeVisible();
  await page.keyboard.press('Escape');

  // 10–11: reload the whole app and restore the save.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /Ari/ }).first().click();
  await page.getByText(/Load a saved game/).click();
  await page.getByRole('button', { name: 'Load Save slot 1' }).click();
  await waitForWorld(page);
  await expectScene(page, 'Aunt Miriam’s house');

  // 12: continue — the restored satchel still reflects the earlier choice.
  await page.getByRole('button', { name: /^Satchel/ }).click();
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toContainText('Bread and dates');
  await page.keyboard.press('Escape');
  await goTo(page, 'Go to the market');
  await goTo(page, /Go to the east gate/);
  await expectScene(page, 'The road down to Jericho');
  await expect(music).toHaveAttribute('data-music', 'sacred-sands'); // the music follows the place
  await snap(page, '05-road');

  // 13: the road.
  await goTo(page, 'Use The crossroads — choose a route');
  await continueDialogue(page); // the fork narration
  await endDialogue(page);
  const route = page.getByRole('dialog', { name: 'Which Way Down?' });
  await route.getByLabel(/The shepherds’ ridge path/).check();
  await route.getByLabel(/A cistern on the ridge/).check();
  await route.getByLabel(/Watchers at the bend/).check();
  await snap(page, '06-route-puzzle');
  await route.getByRole('button', { name: 'Present my reasoning' }).click();
  await expect(route.getByText('Solved!')).toBeVisible();
  await route.getByRole('button', { name: 'Continue' }).click();

  // Eli, by the cistern on the ridge: walking up to him starts the conversation.
  await goTo(page, 'Talk to Eli, the shepherd boy');
  await choose(page, 'Sorry — I need mine for the road.'); // the bread may be needed below the bend
  await snap(page, '06b-eli');
  await choose(page, 'I have to keep going.');
  await endDialogue(page);
  // "Go to…" walks through the meeting on the way; arriving, Eli may add a parting line.
  const parting = page.locator('section.dialogue');
  if (
    await parting.waitFor({ timeout: 3_000 }).then(
      () => true,
      () => false,
    )
  )
    await endDialogue(page);

  await goTo(page, 'Examine Broken jar');
  await endDialogue(page); // the ridge-end narration fires on the way down
  // Uneasy music from finding the man until you have chosen what to do.
  await expect(music).toHaveAttribute('data-music', 'middle-eastern-cinematic-mystery');
  await goTo(page, 'Examine Many footprints');
  await goTo(page, 'Examine Drag marks');
  await choose(page, 'Think it through now.');
  await endDialogue(page);
  const scene = page.getByRole('dialog', { name: 'What Happened Here?' });
  const earlier = (text: string) => scene.getByRole('button', { name: `Move earlier: ${text}` });
  await earlier('The traveler walked down from the bend alone.').click();
  await earlier('The traveler walked down from the bend alone.').click();
  for (let i = 0; i < 3; i++)
    await earlier('Several people came down from the rocks and stopped him.').click();
  await earlier('The robbers went away north, up the gully.').click();
  await snap(page, '07-sequence');
  await scene.getByRole('button', { name: 'Check the order' }).click();
  await scene.getByLabel(/They most likely left hours ago/).check();
  await scene.getByRole('button', { name: 'Decide' }).click();
  await expect(scene.getByText('Solved!')).toBeVisible();
  await scene.getByRole('button', { name: 'Continue' }).click();

  await goTo(page, 'Talk to The injured traveler');
  await continueDialogue(page);
  await snap(page, '08-decision');
  await choose(page, /Leave him what water and food you have/);
  await endDialogue(page);
  await expect(music).toHaveAttribute('data-music', 'sacred-sands');
  await goTo(page, 'Go to the road on to Jericho');
  await expectScene(page, 'Jericho, the city of palm trees');
  await snap(page, '09-jericho');

  await goTo(page, 'Talk to Salome the innkeeper');
  await continueDialogue(page); // arrival narration, then Salome
  await choose(page, /A man was robbed below the bend/);
  await endDialogue(page);

  // Whose Cloak? A striped cloak on the sacks by the inn gate.
  await goTo(page, 'Examine A cloak with a blue stripe, on the sacks');
  await choose(page, 'Think it through.');
  await endDialogue(page);
  const cloak = page.getByRole('dialog', { name: 'Whose Cloak?' });
  await cloak.getByLabel(/The robbed traveler’s/).check();
  await cloak.getByLabel(/A strip torn from the hem/).check();
  await cloak.getByLabel(/It smells of olive oil/).check();
  await snap(page, '09b-cloak');
  await cloak.getByRole('button', { name: 'Present my reasoning' }).click();
  await expect(cloak.getByText('Solved!')).toBeVisible();
  await cloak.getByRole('button', { name: 'Continue' }).click();
  await goTo(page, 'Talk to Salome the innkeeper');
  await choose(page, 'I know whose that striped cloak is.');
  await choose(page, 'The man who was robbed below the bend. Menashe.');
  await choose(page, 'Thank you.');
  await endDialogue(page);

  await goTo(page, 'Talk to Rivka');
  await choose(page, 'I found a man who’d been robbed below the bend.');
  await endDialogue(page); // Rivka goes to prepare the remedy

  // While it steeps, keep Natan company; Yair comes in at the end.
  await goTo(page, 'Talk to Natan');
  await choose(page, 'Not quite. I met a shepherd boy on the ridge — Eli.');
  await choose(page, 'No robbers. But I found a man they had robbed.');
  await choose(page, 'His name is Menashe. He sells olive oil. He’s a Samaritan.');
  await choose(page, 'Like anyone. He was hurt, and frightened, and thirsty.');
  await choose(page, 'Yes. More than once.');
  await snap(page, '10-yair');
  await choose(page, 'A Samaritan?');
  await continueDialogue(page);
  await endDialogue(page);

  const connection = page.getByRole('dialog', { name: 'A Story on the Same Road' });
  await expect(connection).toBeVisible();
  await expect(connection).toContainText(
    'Behold, a certain lawyer stood up and tested him', // the approved World English Bible text
  );
  await expect(connection).toContainText('In our own words — not a quotation');
  await expect(music).toHaveAttribute('data-music', 'meditative-middle-eastern-flute');
  await snap(page, '11-connection');
  await connection.getByRole('button', { name: 'Continue' }).click();
  const reflect = page.getByRole('dialog', { name: 'Reflect' });
  await reflect
    .getByLabel('Your reflection (optional)')
    .fill('Stopping was hard because I was scared.');
  await reflect.getByRole('button', { name: 'Save and continue' }).click();

  // 14–15
  const summary = page.getByRole('dialog', { name: 'Chapter complete: The Road to Jericho' });
  await expect(summary).toBeVisible();
  await snap(page, '12-summary');
  await expect(summary).toContainText('Salome’s son Asher brought Menashe to the inn');
  await expect(summary).toContainText('Menashe’s own cloak, thrown away by the robbers');
  await expect(summary).toContainText('Hadassah’s linen reached Rivka whole');
  await expect(summary.getByRole('heading', { name: 'Scripture references' })).toBeVisible();
  await expect(summary).toContainText('Luke 10:25–37');
  await expect(summary).toContainText('Leviticus 19:18');
  await expect(summary).not.toContainText(/score|points|holiness/i);
});

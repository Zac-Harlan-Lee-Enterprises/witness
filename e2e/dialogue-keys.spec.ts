import { expect, test } from '@playwright/test';
import {
  continueDialogue,
  createProfile,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

/**
 * In a conversation, the up and down arrows move between the replies and
 * Space picks one, in the real game (where the world also listens for keys).
 */
test('arrows move between replies and Space picks one', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard play');
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Keys');
  await newGame(page);
  await waitForWorld(page);
  const box = page.locator('section.dialogue');
  await box.waitFor({ state: 'visible', timeout: 60_000 });
  await continueDialogue(page);
  const choices = box.locator('.choice');
  await expect(choices.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(choices.nth(1)).toBeFocused();
  const picked = (await choices.nth(1).locator('.choice__text').textContent()) ?? '';
  await page.keyboard.press('Space');
  // The reply is picked: the conversation moves on from these choices.
  await expect(box.locator('.choice__text', { hasText: picked })).toHaveCount(0);
});

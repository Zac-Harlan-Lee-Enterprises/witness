import { expect, type Page } from '@playwright/test';

/**
 * E2E helpers. They drive the game only through the accessible HTML UI —
 * the same buttons a keyboard or screen-reader player would use (the
 * “Go to…” list, dialogue buttons, puzzle controls).
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function setFastSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByLabel('Dialogue text speed').selectOption('instant');
  await dialog.getByLabel('Instant travel from the “Go to…” list').check();
  await dialog.getByRole('button', { name: 'Done' }).click();
}

export async function createProfile(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Play' }).click();
  const newProfile = page.getByRole('button', { name: 'New profile' });
  if (await newProfile.isVisible().catch(() => false)) await newProfile.click();
  await page.getByLabel('Nickname').fill(name);
  await page.getByRole('button', { name: 'Create and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Chapters' })).toBeVisible();
}

const dialogueBox = (page: Page) => page.locator('section.dialogue');

/** Click Continue / End conversation until the dialogue offers choices or closes. */
export async function continueDialogue(page: Page): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const box = dialogueBox(page);
    if ((await box.count()) === 0) return;
    const next = box.getByRole('button', { name: /^(Continue|End conversation|Show all text)$/ });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      continue;
    }
    if ((await box.locator('.choice').count()) > 0) return;
    await page.waitForTimeout(100);
  }
}

export async function choose(page: Page, text: string | RegExp): Promise<void> {
  await continueDialogue(page);
  await dialogueBox(page).locator('.choice').filter({ hasText: text }).first().click();
}

export async function endDialogue(page: Page): Promise<void> {
  await continueDialogue(page);
  await expect(dialogueBox(page)).toHaveCount(0);
}

/** Use the accessible “Go to…” list. */
export async function goTo(page: Page, action: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: /^Go to…/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Go to…' });
  await dialog.getByRole('button', { name: action }).click();
}

export async function expectScene(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.locator('.hud__scene')).toHaveText(name);
}

export async function waitForWorld(page: Page): Promise<void> {
  await expect(page.locator('.viewport canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.viewport__loading')).toHaveCount(0);
}

/** Opt-in screenshots for visual review: E2E_SHOTS=1 npx playwright test */
export async function snap(page: Page, name: string): Promise<void> {
  if (!process.env.E2E_SHOTS) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/shots/${name}.png` });
}

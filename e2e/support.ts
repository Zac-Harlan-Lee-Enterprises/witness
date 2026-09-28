import { expect, type Page } from '@playwright/test';

/**
 * E2E helpers. They drive the game only through the accessible HTML UI —
 * the same buttons a keyboard or screen-reader player would use (the
 * “Go to…” list, dialogue buttons, puzzle controls).
 */
/**
 * The time limit for a long test (a whole chapter, a storm): doubled on CI,
 * whose shared runners are sometimes half again as slow as usual (every step
 * of a run, not just the browser), which took a chapter past its limit.
 */
export function timeLimit(ms: number): number {
  return process.env.CI ? ms * 2 : ms;
}

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
  // The conversation may still be opening, e.g. while a pre-rendered place loads.
  await dialogueBox(page).waitFor({ state: 'visible', timeout: 60_000 });
  await continueDialogue(page);
  await dialogueBox(page).locator('.choice').filter({ hasText: text }).first().click();
}

export async function endDialogue(page: Page): Promise<void> {
  await continueDialogue(page);
  await expect(dialogueBox(page)).toHaveCount(0);
}

/**
 * Close the narration a place opens with on arrival. It starts once the place
 * has loaded, after the HUD already names it (a pre-rendered place takes a
 * few seconds to load): wait for it rather than finding no dialogue yet.
 */
export async function endArrivalNarration(page: Page): Promise<void> {
  await expect(dialogueBox(page)).toBeVisible({ timeout: 30_000 });
  await endDialogue(page);
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

/**
 * Start a new game of one chapter from chapter select. Each chapter card is
 * labelled by its title, so tests stay unambiguous as chapters are added.
 * A first new game of a chapter with a teaser opens with the film: it is
 * skipped here unless `{ teaser: 'keep' }` (e2e/teaser.spec.ts watches it).
 */
export async function newGame(
  page: Page,
  title: string | RegExp = 'The Road to Jericho',
  options: { teaser?: 'skip' | 'keep' } = {},
): Promise<void> {
  await page
    .getByRole('listitem', { name: title })
    .getByRole('button', { name: 'New game' })
    .click();
  if (options.teaser !== 'keep') await skipTeaser(page);
}

/** Skip the teaser film if it opened (it only does before a first new game). */
export async function skipTeaser(page: Page): Promise<void> {
  const teaser = page.getByRole('dialog', { name: /teaser/i });
  const shown = await teaser
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) return;
  await teaser.getByRole('button', { name: 'Skip' }).click();
  await expect(teaser).toHaveCount(0);
}

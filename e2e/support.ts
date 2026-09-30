import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

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

// ── The later chapters' own puzzles, played through their accessible UI ──

/**
 * An open puzzle passes axe in the browser (colour contrast included) and
 * fits a 320 px-wide phone screen without sideways scrolling. The window is
 * put back to its size afterwards.
 */
export async function checkPuzzleA11y(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id}: ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([]);
  const size = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label} at 320 px`).toBeLessThanOrEqual(1);
  if (size) await page.setViewportSize(size);
}

/** Load and trim the boat: [item name, place] for each thing, one at a time. */
export async function trimBoat(
  puzzle: Locator,
  loads: ReadonlyArray<readonly [item: string, place: string]>,
): Promise<void> {
  for (const [item, place] of loads) {
    const pick = puzzle
      .locator('.trim__jetty')
      .getByRole('button', { name: new RegExp(`^${item}`) });
    // Pressing what you already hold would put it down again.
    if ((await pick.getAttribute('aria-pressed')) !== 'true') await pick.click();
    await puzzle.getByRole('button', { name: `Put the ${item} in the ${place}` }).click();
  }
}

/** Mend a net: tie a knot in each [row, column] (1-based), with the keyboard. */
export async function mendNet(
  puzzle: Locator,
  knots: ReadonlyArray<readonly [row: number, col: number]>,
): Promise<void> {
  for (const [r, c] of knots) {
    await puzzle.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c}:`) }).focus();
    await puzzle.page().keyboard.press('Space');
  }
}

/** Choose a floor plan piece, turn it (R), and put its first square on [row, column] (1-based). */
export async function placePiece(
  puzzle: Locator,
  piece: string | RegExp,
  turns: number,
  [row, col]: readonly [number, number],
): Promise<void> {
  await puzzle.locator('.floorplan__pieces').getByRole('button', { name: piece }).click();
  await puzzle.getByRole('button', { name: new RegExp(`^Row ${row}, column ${col}:`) }).focus();
  for (let i = 0; i < turns; i++) await puzzle.page().keyboard.press('r');
  await puzzle.page().keyboard.press('Enter');
}

/** Choose one option per subject in a logic grid (a square pressed twice is chosen). */
export async function chooseInGrid(
  puzzle: Locator,
  picks: ReadonlyArray<readonly [subject: string, option: string]>,
): Promise<void> {
  for (const [subject, option] of picks) {
    await puzzle.getByRole('button', { name: `${subject}, ${option}: not decided` }).click();
    await puzzle.getByRole('button', { name: `${subject}, ${option}: ruled out` }).click();
  }
}

/** Walk a map puzzle with the arrow keys (the walk buttons take them), then stop there. */
export async function walkMap(puzzle: Locator, arrows: readonly string[]): Promise<void> {
  await puzzle.getByRole('button', { name: /Walk west/ }).focus();
  for (const key of arrows) await puzzle.page().keyboard.press(key);
  await puzzle.getByRole('button', { name: 'This is the place' }).click();
}

/** Put things into the travel bag (choices in the packing conversation), then tie it shut. */
export async function packBag(page: Page, things: readonly string[]): Promise<void> {
  for (const thing of things) await choose(page, `Put in ${thing}`);
  await choose(page, 'That’s everything. Tie the bag shut.');
  await endDialogue(page);
}

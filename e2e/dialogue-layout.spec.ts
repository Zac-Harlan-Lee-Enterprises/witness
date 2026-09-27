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
 * Hovering a choice nudges it to the right. The dialogue scrolls when its
 * text is long, so a nudge that moved the choice's own box overflowed it
 * sideways and a scrollbar flashed up under the pointer. The nudge must stay
 * inside the choice.
 */
test('hovering a line or a choice never brings up a scrollbar in the dialogue', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'hover is a pointer interaction');
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Layout');
  await newGame(page);
  await waitForWorld(page);
  const box = page.locator('section.dialogue');
  await box.waitFor({ state: 'visible', timeout: 60_000 });

  // Any box in the dialogue that would show a scrollbar: wider than it is
  // (never meant to scroll that way), or taller (the short opening lines fit).
  const scrollbars = (axes: 'x' | 'xy') =>
    page.evaluate(
      (both) =>
        [...document.querySelectorAll<HTMLElement>('section.dialogue, section.dialogue *')].flatMap(
          (el) => {
            const style = getComputedStyle(el);
            // Only boxes that can scroll (screen-reader-only text is clipped on purpose).
            const scrolls = (o: string) => o === 'auto' || o === 'scroll';
            const out: string[] = [];
            if (scrolls(style.overflowX) && el.scrollWidth > el.clientWidth)
              out.push(`${el.className} x: ${el.scrollWidth} > ${el.clientWidth}`);
            if (both && scrolls(style.overflowY) && el.scrollHeight > el.clientHeight)
              out.push(`${el.className} y: ${el.scrollHeight} > ${el.clientHeight}`);
            return out;
          },
        ),
      axes === 'xy',
    );
  const settle = () => page.waitForTimeout(400); // the hover transitions

  // A plain line with Continue: hovering the text or the button shows no scrollbar.
  const next = box.getByRole('button', { name: /^(Continue|Show all text)$/ });
  await expect(next).toBeVisible();
  if ((await next.textContent()) === 'Show all text') await next.click();
  expect(await scrollbars('xy')).toEqual([]);
  await box.locator('.dialogue__main').hover();
  await settle();
  expect(await scrollbars('xy')).toEqual([]);
  await box.getByRole('button', { name: 'Continue' }).hover();
  await settle();
  expect(await scrollbars('xy')).toEqual([]);

  // Choices: hovering or focusing one nudges it, and nothing scrolls sideways.
  await continueDialogue(page);
  const choice = box.locator('.choice').first();
  await expect(choice).toBeVisible();
  expect(await scrollbars('x')).toEqual([]);
  await choice.hover();
  await settle();
  expect(await scrollbars('x')).toEqual([]);
  await choice.focus();
  await settle();
  expect(await scrollbars('x')).toEqual([]);
});

import { devices, expect, test, type Page } from '@playwright/test';
import {
  choose,
  createProfile,
  expectScene,
  goTo,
  newGame,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

/**
 * Market performance measurements (not a pass/fail test; PERF_MARKET=1):
 * chapter start, the house → market transition, steady frame rate and
 * frame pacing while walking, and texture memory, at desktop, tablet and
 * phone sizes, with full and with reduced effects (reduced motion).
 *
 *   PERF_MARKET=1 PERF_LABEL=after npx playwright test e2e/market-perf.spec.ts --project=desktop-chromium
 *
 * Output: test-results/market-perf/<label>.json (one line per run).
 * Headless Chromium without a GPU: a regression signal, not a device measurement.
 */
const LABEL = process.env.PERF_LABEL ?? 'current';
const VIEWPORTS = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  {
    name: 'phone',
    use: {
      viewport: devices['Pixel 7'].viewport,
      deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    },
  },
] as const;

async function frames(page: Page, ms: number): Promise<number[]> {
  return page.evaluate(
    (duration) =>
      new Promise<number[]>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const end = last + duration;
        const tick = (t: number): void => {
          deltas.push(t - last);
          last = t;
          if (t < end) requestAnimationFrame(tick);
          else resolve(deltas.slice(1));
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

function stats(deltas: number[]): { fps: number; p95: number; slow: number } {
  const sorted = [...deltas].sort((a, b) => a - b);
  const mean = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
  return {
    fps: Math.round((1000 / mean) * 10) / 10,
    p95: Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10,
    slow:
      Math.round((deltas.filter((d) => d > 33.4).length / Math.max(1, deltas.length)) * 1000) / 10,
  };
}

for (const vp of VIEWPORTS) {
  for (const reduced of [false, true]) {
    test.describe(`${vp.name}${reduced ? ' reduced' : ''}`, () => {
      test.use(vp.use);
      test(`market perf (${vp.name}${reduced ? ', reduced effects' : ''})`, async ({ page }) => {
        test.skip(!process.env.PERF_MARKET, 'PERF_MARKET=1 to measure');
        test.setTimeout(180_000);
        if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
        await openApp(page);
        await setFastSettings(page);
        await createProfile(page, 'Ari');
        const t0 = Date.now();
        await newGame(page);
        await waitForWorld(page);
        const chapterStart = Date.now() - t0;
        await choose(page, 'Of course. What do I need to know?');
        await choose(page, 'I’ll head to the market.');
        await page
          .locator('section.dialogue')
          .getByRole('button', { name: /^(Continue|End conversation)$/ })
          .click();
        const canvas = page.locator('.viewport canvas');
        const t1 = Date.now();
        await goTo(page, 'Go to the market');
        // The place name updates once the world has finished building the scene.
        await expectScene(page, 'The lower market, Jerusalem');
        const transition = Date.now() - t1;
        await expect(canvas).toBeVisible();
        await page.waitForTimeout(3500);
        const standing = stats(await frames(page, 3000));
        await page.keyboard.down('ArrowRight');
        const walking = stats(await frames(page, 2500));
        await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowDown');
        const walking2 = stats(await frames(page, 1500));
        await page.keyboard.up('ArrowDown');
        const result = {
          label: LABEL,
          viewport: vp.name,
          reducedEffects: reduced,
          chapterStartMs: chapterStart,
          marketTransitionMs: transition,
          standing,
          walking: { ...walking, p95: Math.max(walking.p95, walking2.p95) },
          art: (await canvas.getAttribute('data-art')) ?? 'painted',
          effects: (await canvas.getAttribute('data-effects')) ?? 'full',
          textureMb: Number(await canvas.getAttribute('data-texture-mb')),
        };
        console.info(`[market-perf] ${JSON.stringify(result)}`);
        const fs = await import('node:fs');
        fs.mkdirSync('test-results/market-perf', { recursive: true });
        fs.appendFileSync(`test-results/market-perf/${LABEL}.jsonl`, `${JSON.stringify(result)}\n`);
      });
    });
  }
}

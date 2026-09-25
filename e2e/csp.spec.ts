import { expect, test } from '@playwright/test';
import {
  choose,
  createProfile,
  endDialogue,
  openApp,
  setFastSettings,
  waitForWorld,
} from './support';

/**
 * The strict Content-Security-Policy recommended in docs/security-privacy.md
 * (§11) must not break the game or trigger violations. The policy is added
 * to the page response here, as a host would add it as a header.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

test('plays under the recommended strict Content-Security-Policy with no violations', async ({
  page,
}) => {
  await page.route(
    (url) => url.pathname === '/' || url.pathname.endsWith('/index.html'),
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': CSP },
      });
    },
  );
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  await openApp(page);
  await setFastSettings(page);
  await createProfile(page, 'Strict');
  await page.getByRole('button', { name: 'New game' }).click();
  await waitForWorld(page);
  await choose(page, 'Of course. What do I need to know?');
  await choose(page, 'I’ll head to the market.');
  await endDialogue(page);
  await page.waitForTimeout(1000);
  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violations).toEqual([]);
});

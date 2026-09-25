import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.WITNESS_PREVIEW_PORT ?? 4391);
const DEV_PORT = Number(process.env.WITNESS_DEV_PORT ?? 5391);

/**
 * E2E runs against the PRODUCTION build (vite preview) so the service worker,
 * manifest and lazy chunks are exercised exactly as players receive them.
 */
export default defineConfig({
  testDir: './e2e',
  // The visual tour only captures screenshots for review (E2E_SHOTS=1).
  testIgnore: process.env.E2E_SHOTS ? [] : ['**/visual-tour.spec.ts'],
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'dev-server-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${DEV_PORT}` },
      testMatch: /world\.spec\.ts/,
    },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testMatch: /(smoke|mobile|a11y)\.spec\.ts/,
    },
    {
      name: 'tablet-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true },
      testMatch: /(smoke|mobile)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'npm run build && npx vite preview',
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      // Development server (React StrictMode) for dev-only regressions.
      command: 'npx vite',
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openApp, waitForWorld } from './support';

const v1 = JSON.parse(
  readFileSync(new URL('../tests/fixtures/saves/v1-market.json', import.meta.url), 'utf8'),
);

async function seed(page: Page, saves: unknown[]): Promise<void> {
  await page.evaluate(async (records) => {
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open('witness-game', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction(['profiles', 'saves'], 'readwrite');
    tx.objectStore('profiles').put(
      {
        id: 'profile_fixture',
        displayName: 'Fixture',
        look: 'look-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastPlayedAt: null,
        completedChapters: [],
      },
      'profile_fixture',
    );
    for (const r of records as Array<{ id: string }>) tx.objectStore('saves').put(r, r.id);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, saves);
}

test('restores a legacy v1 save by migrating it, and reports a corrupt save without crashing', async ({
  page,
}) => {
  await openApp(page); // creates the database
  await seed(page, [
    v1,
    {
      id: 'profile_fixture:manual-2',
      profileId: 'profile_fixture',
      schemaVersion: 2,
      broken: true,
    },
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /^Fixture/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /could not be read/ })).toBeVisible();
  await page.getByText(/Load a saved game/).click();
  await page.getByRole('button', { name: 'Load Save slot 1' }).click();
  await waitForWorld(page);
  await expect(page.locator('.hud__scene')).toHaveText('The lower market, Jerusalem');
  await page.getByRole('button', { name: /^Satchel/ }).click();
  await expect(page.getByRole('dialog', { name: 'Satchel' })).toContainText('Bronze coins ×3');
});

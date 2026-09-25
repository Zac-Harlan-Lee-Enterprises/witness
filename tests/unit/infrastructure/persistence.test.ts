import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { SaveService } from '@/application/save-service';
import {
  IndexedDbProfileRepository,
  IndexedDbSaveRepository,
  IndexedDbSettingsRepository,
  openWitnessDb,
} from '@/infrastructure/persistence/indexeddb';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import { createLogger } from '@/shared/logger';
import { createHarness } from '../../support/harness';

beforeEach(() => {
  // A fresh, isolated IndexedDB for every test.
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDB repositories', () => {
  it('stores and indexes saves per profile', async () => {
    const db = await openWitnessDb('test-db');
    const repo = new IndexedDbSaveRepository(db);
    const h = await createHarness();
    const saves = new SaveService(
      repo,
      { now: () => 0 },
      createLogger({ level: 'error', echo: false }),
    );
    await saves.save('alice', 'auto', h.chapter, h.session.state);
    await saves.save('alice', 'manual-1', h.chapter, h.session.state);
    await saves.save('bob', 'auto', h.chapter, h.session.state);
    expect((await repo.listRaw('alice')).length).toBe(2);
    await repo.deleteForProfile('alice');
    expect(await repo.listRaw('alice')).toEqual([]);
    expect((await repo.listRaw('bob')).length).toBe(1);
  });

  it('persists profiles and settings across connections', async () => {
    const db1 = await openWitnessDb('persist-db');
    await new IndexedDbProfileRepository(db1).put({
      id: 'p1',
      displayName: 'Ari',
      look: 'look-1',
      createdAt: new Date(0).toISOString(),
      lastPlayedAt: null,
      completedChapters: [],
    });
    await new IndexedDbSettingsRepository(db1).save({ ...DEFAULT_SETTINGS, highContrast: true });
    db1.close();
    const db2 = await openWitnessDb('persist-db');
    expect(await new IndexedDbProfileRepository(db2).listRaw()).toHaveLength(1);
    expect(await new IndexedDbSettingsRepository(db2).loadRaw()).toMatchObject({
      highContrast: true,
    });
  });
});

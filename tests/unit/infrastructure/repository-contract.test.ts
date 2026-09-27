import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProfileRepository, SaveRepository, SettingsRepository } from '@/application/ports';
import { SaveService } from '@/application/save-service';
import type { PlayerProfile } from '@/domain/profile';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import {
  IndexedDbProfileRepository,
  IndexedDbSaveRepository,
  IndexedDbSettingsRepository,
  openWitnessDb,
} from '@/infrastructure/persistence/indexeddb';
import {
  MemoryProfileRepository,
  MemorySaveRepository,
  MemorySettingsRepository,
} from '@/infrastructure/persistence/memory-repositories';
import { createLogger } from '@/shared/logger';
import { createHarness } from '../../support/harness';

/**
 * One contract, every implementation. The memory repositories stand in for
 * IndexedDB when storage is unavailable (private browsing), so they must
 * behave the same — this suite runs identical checks against both.
 */
interface Repos {
  saves: SaveRepository;
  profiles: ProfileRepository;
  settings: SettingsRepository;
}

let dbCount = 0;
const IMPLEMENTATIONS: Array<[string, () => Promise<Repos>]> = [
  [
    'memory',
    async () => ({
      saves: new MemorySaveRepository(),
      profiles: new MemoryProfileRepository(),
      settings: new MemorySettingsRepository(),
    }),
  ],
  [
    'IndexedDB',
    async () => {
      const db = await openWitnessDb(`contract-${++dbCount}`);
      return {
        saves: new IndexedDbSaveRepository(db),
        profiles: new IndexedDbProfileRepository(db),
        settings: new IndexedDbSettingsRepository(db),
      };
    },
  ],
];

const profile = (id: string): PlayerProfile => ({
  id,
  displayName: id,
  look: 'look-1',
  createdAt: new Date(0).toISOString(),
  lastPlayedAt: null,
  completedChapters: [],
  seenTeasers: [],
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe.each(IMPLEMENTATIONS)('repository contract: %s', (_name, make) => {
  it('saves: put, get, list by profile, overwrite, delete, delete for profile', async () => {
    const { saves: repo } = await make();
    const h = await createHarness();
    const service = new SaveService(
      repo,
      { now: () => 0 },
      createLogger({ level: 'error', echo: false }),
    );
    const a = service.build('alice', 'auto', h.chapter, h.session.state);
    const b = service.build('bob', 'auto', h.chapter, h.session.state);
    await repo.put(a);
    await repo.put(b);
    expect(await repo.getRaw(a.id)).toEqual(a);
    expect(await repo.getRaw('missing')).toBeNull();
    expect(await repo.listRaw('alice')).toEqual([a]);
    await repo.put({ ...a, savedAt: new Date(5).toISOString() });
    expect(await repo.listRaw('alice')).toHaveLength(1);
    await repo.delete(a.id);
    expect(await repo.getRaw(a.id)).toBeNull();
    await repo.deleteForProfile('bob');
    expect(await repo.listRaw('bob')).toEqual([]);
  });

  it('saves: returned records are copies, not live references', async () => {
    const { saves: repo } = await make();
    const h = await createHarness();
    const service = new SaveService(
      repo,
      { now: () => 0 },
      createLogger({ level: 'error', echo: false }),
    );
    const a = service.build('alice', 'auto', h.chapter, h.session.state);
    await repo.put(a);
    const read = (await repo.getRaw(a.id)) as { label: { sceneName: string } };
    read.label.sceneName = 'changed';
    expect(((await repo.getRaw(a.id)) as typeof read).label.sceneName).not.toBe('changed');
  });

  it('profiles: put, overwrite, list and delete', async () => {
    const { profiles } = await make();
    await profiles.put(profile('p1'));
    await profiles.put(profile('p2'));
    await profiles.put({ ...profile('p1'), displayName: 'Ari' });
    const list = (await profiles.listRaw()) as PlayerProfile[];
    expect(list.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    expect(list.find((p) => p.id === 'p1')?.displayName).toBe('Ari');
    await profiles.delete('p1');
    expect(((await profiles.listRaw()) as PlayerProfile[]).map((p) => p.id)).toEqual(['p2']);
  });

  it('settings: nothing stored at first, then the last saved value', async () => {
    const { settings } = await make();
    expect(await settings.loadRaw()).toBeNull();
    await settings.save({ ...DEFAULT_SETTINGS, textScale: 1.5 });
    await settings.save({ ...DEFAULT_SETTINGS, textScale: 2 });
    expect(await settings.loadRaw()).toMatchObject({ textScale: 2 });
  });
});

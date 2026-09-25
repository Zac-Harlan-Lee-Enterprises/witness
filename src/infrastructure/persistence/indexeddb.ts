import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  ProfileRepository,
  SaveRepository,
  SettingsRepository,
  StorageStatus,
} from '@/application/ports';
import type { PlayerProfile } from '@/domain/profile';
import type { SaveGame } from '@/domain/save';
import type { GameSettings } from '@/domain/settings';
import {
  MemoryProfileRepository,
  MemorySaveRepository,
  MemorySettingsRepository,
} from './memory-repositories';

/**
 * IndexedDB persistence (the ONLY module allowed to touch IndexedDB — see
 * tests/architecture). Records are stored as plain structured-clone data and
 * validated/migrated by the application layer on every read.
 *
 * DB versioning is separate from save-schema versioning: DB_VERSION changes
 * only when object stores/indexes change.
 */
export const DB_NAME = 'witness-game';
export const DB_VERSION = 1;

interface WitnessDB extends DBSchema {
  profiles: { key: string; value: unknown };
  saves: { key: string; value: unknown; indexes: { byProfile: string } };
  settings: { key: string; value: unknown };
}

export function openWitnessDb(name: string = DB_NAME): Promise<IDBPDatabase<WitnessDB>> {
  return openDB<WitnessDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('profiles');
        const saves = db.createObjectStore('saves');
        saves.createIndex('byProfile', 'profileId');
        db.createObjectStore('settings');
      }
    },
  });
}

export class IndexedDbSaveRepository implements SaveRepository {
  constructor(private readonly db: IDBPDatabase<WitnessDB>) {}
  listRaw(profileId: string): Promise<unknown[]> {
    return this.db.getAllFromIndex('saves', 'byProfile', profileId);
  }
  async getRaw(id: string): Promise<unknown | null> {
    return (await this.db.get('saves', id)) ?? null;
  }
  async put(save: SaveGame): Promise<void> {
    await this.db.put('saves', save, save.id);
  }
  async delete(id: string): Promise<void> {
    await this.db.delete('saves', id);
  }
  async deleteForProfile(profileId: string): Promise<void> {
    const tx = this.db.transaction('saves', 'readwrite');
    let cursor = await tx.store.index('byProfile').openCursor(profileId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

export class IndexedDbProfileRepository implements ProfileRepository {
  constructor(private readonly db: IDBPDatabase<WitnessDB>) {}
  listRaw(): Promise<unknown[]> {
    return this.db.getAll('profiles');
  }
  async put(profile: PlayerProfile): Promise<void> {
    await this.db.put('profiles', profile, profile.id);
  }
  async delete(id: string): Promise<void> {
    await this.db.delete('profiles', id);
  }
}

export class IndexedDbSettingsRepository implements SettingsRepository {
  constructor(private readonly db: IDBPDatabase<WitnessDB>) {}
  async loadRaw(): Promise<unknown | null> {
    return (await this.db.get('settings', 'device')) ?? null;
  }
  async save(settings: GameSettings): Promise<void> {
    await this.db.put('settings', settings, 'device');
  }
}

export interface Repositories {
  saves: SaveRepository;
  profiles: ProfileRepository;
  settings: SettingsRepository;
  status: StorageStatus;
}

/**
 * Open IndexedDB, falling back to memory (with an explicit, user-visible
 * warning) if the browser refuses storage.
 */
export async function createRepositories(): Promise<Repositories> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
    const db = await openWitnessDb();
    // Ask the browser not to evict saves under storage pressure (best effort).
    void navigator.storage?.persist?.().catch(() => false);
    return {
      saves: new IndexedDbSaveRepository(db),
      profiles: new IndexedDbProfileRepository(db),
      settings: new IndexedDbSettingsRepository(db),
      status: { persistent: true, reason: null },
    };
  } catch {
    return {
      saves: new MemorySaveRepository(),
      profiles: new MemoryProfileRepository(),
      settings: new MemorySettingsRepository(),
      status: {
        persistent: false,
        reason:
          'This browser is not allowing the game to save (private browsing can do this). You can play, but progress will be lost when you close the page.',
      },
    };
  }
}

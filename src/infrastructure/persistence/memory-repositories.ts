import type { ProfileRepository, SaveRepository, SettingsRepository } from '@/application/ports';
import type { PlayerProfile } from '@/domain/profile';
import type { SaveGame } from '@/domain/save';
import type { GameSettings } from '@/domain/settings';

/**
 * In-memory repositories: the fallback when IndexedDB is unavailable (some
 * private-browsing modes) and the default in unit tests. Values are cloned
 * so callers can never mutate "stored" data by reference.
 */
const clone = <T>(v: T): T => structuredClone(v);

export class MemorySaveRepository implements SaveRepository {
  readonly records = new Map<string, unknown>();

  async listRaw(profileId: string): Promise<unknown[]> {
    return [...this.records.values()]
      .filter((r) => (r as { profileId?: unknown }).profileId === profileId)
      .map(clone);
  }
  async getRaw(id: string): Promise<unknown | null> {
    const r = this.records.get(id);
    return r === undefined ? null : clone(r);
  }
  async put(save: SaveGame): Promise<void> {
    this.records.set(save.id, clone(save));
  }
  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
  async deleteForProfile(profileId: string): Promise<void> {
    for (const [id, r] of this.records) {
      if ((r as { profileId?: unknown }).profileId === profileId) this.records.delete(id);
    }
  }
}

export class MemoryProfileRepository implements ProfileRepository {
  readonly records = new Map<string, unknown>();
  async listRaw(): Promise<unknown[]> {
    return [...this.records.values()].map(clone);
  }
  async put(profile: PlayerProfile): Promise<void> {
    this.records.set(profile.id, clone(profile));
  }
  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

export class MemorySettingsRepository implements SettingsRepository {
  value: unknown = null;
  async loadRaw(): Promise<unknown | null> {
    return this.value === null ? null : clone(this.value);
  }
  async save(settings: GameSettings): Promise<void> {
    this.value = clone(settings);
  }
}

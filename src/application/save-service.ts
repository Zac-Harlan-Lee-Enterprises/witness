import type { Chapter } from '@/domain/chapter';
import { currentObjective } from '@/domain/quests';
import {
  CURRENT_SAVE_VERSION,
  describeLoadError,
  migrateSave,
  SAVE_SLOTS,
  type SaveGame,
  type SaveSlot,
} from '@/domain/save';
import type { GameState } from '@/domain/state/game-state';
import type { Logger } from '@/shared/logger';
import type { Clock, SaveRepository } from './ports';

/**
 * Local-first saving. Every read is migrated and validated (storage is never
 * trusted); unreadable saves are reported with player-friendly wording and
 * never take down the rest of the save list.
 */
export interface SaveSummary {
  id: string;
  slot: SaveSlot;
  chapterId: string;
  savedAt: string;
  sceneName: string;
  objective: string | null;
  playTimeMs: number;
  chapterComplete: boolean;
}

export interface UnreadableSave {
  id: string;
  message: string;
}

export type LoadResult =
  { ok: true; save: SaveGame; fromVersion: number } | { ok: false; message: string };

export function saveId(profileId: string, slot: SaveSlot): string {
  return `${profileId}:${slot}`;
}

export class SaveService {
  constructor(
    private readonly repo: SaveRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  build(profileId: string, slot: SaveSlot, chapter: Chapter, state: GameState): SaveGame {
    const scene = chapter.scenes.find((s) => s.id === state.sceneId);
    return {
      schemaVersion: CURRENT_SAVE_VERSION,
      id: saveId(profileId, slot),
      profileId,
      slot,
      chapterId: chapter.id,
      contentVersion: chapter.contentVersion,
      savedAt: new Date(this.clock.now()).toISOString(),
      label: {
        sceneName: scene?.name ?? state.sceneId,
        objective: currentObjective(state, chapter.quests),
      },
      state,
    };
  }

  async save(
    profileId: string,
    slot: SaveSlot,
    chapter: Chapter,
    state: GameState,
  ): Promise<boolean> {
    try {
      await this.repo.put(this.build(profileId, slot, chapter, state));
      return true;
    } catch (error) {
      this.logger.error('Save failed', error);
      return false;
    }
  }

  async list(profileId: string): Promise<{ saves: SaveSummary[]; unreadable: UnreadableSave[] }> {
    let raws: unknown[] = [];
    try {
      raws = await this.repo.listRaw(profileId);
    } catch (error) {
      this.logger.error('Could not list saves', error);
      return { saves: [], unreadable: [] };
    }
    const saves: SaveSummary[] = [];
    const unreadable: UnreadableSave[] = [];
    for (const raw of raws) {
      const result = migrateSave(raw);
      if (result.ok) {
        const s = result.save;
        saves.push({
          id: s.id,
          slot: s.slot,
          chapterId: s.chapterId,
          savedAt: s.savedAt,
          sceneName: s.label.sceneName,
          objective: s.label.objective,
          playTimeMs: s.state.playTimeMs,
          chapterComplete: s.state.chapterComplete,
        });
      } else {
        const id =
          typeof raw === 'object' && raw !== null && 'id' in raw ? String(raw.id) : 'unknown';
        this.logger.warn(`Unreadable save ${id}`, result.error);
        unreadable.push({ id, message: describeLoadError(result.error) });
      }
    }
    saves.sort((a, b) => SAVE_SLOTS.indexOf(a.slot) - SAVE_SLOTS.indexOf(b.slot));
    return { saves, unreadable };
  }

  async load(id: string): Promise<LoadResult> {
    let raw: unknown;
    try {
      raw = await this.repo.getRaw(id);
    } catch (error) {
      this.logger.error('Could not read save', error);
      return { ok: false, message: 'The save could not be read from this device’s storage.' };
    }
    if (raw === null || raw === undefined)
      return { ok: false, message: 'That save no longer exists.' };
    const result = migrateSave(raw);
    if (!result.ok) {
      this.logger.warn(`Save ${id} failed to load`, result.error);
      return { ok: false, message: describeLoadError(result.error) };
    }
    if (result.fromVersion !== CURRENT_SAVE_VERSION) {
      // Persist the upgraded form so migration runs once.
      await this.repo
        .put(result.save)
        .catch((e: unknown) => this.logger.warn('Could not persist migrated save', e));
    }
    return { ok: true, save: result.save, fromVersion: result.fromVersion };
  }

  /** Most recently written save for the profile, if any. */
  async latest(profileId: string): Promise<SaveSummary | null> {
    const { saves } = await this.list(profileId);
    return [...saves].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}

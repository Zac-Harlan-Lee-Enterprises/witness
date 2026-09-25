import { z } from 'zod';
import { GameStateSchema } from './state/game-state';

/**
 * Versioned save data.
 *
 * CURRENT_SAVE_VERSION is bumped whenever the persisted shape changes, and a
 * migration from the previous version MUST be added to MIGRATIONS in the same
 * change (tests/unit/domain/save-migrations.test.ts loads fixtures of every
 * old version). Loading never trusts storage: raw data is migrated step by
 * step and then validated against the current schema.
 *
 * History:
 *   v1 — Phase-2 engine format: scene, position, boolean flags, item-id list.
 *   v2 — Full narrative state (quests, journal, clues, puzzles, choices…),
 *        ISO timestamps, a display label for the load menu.
 */
export const CURRENT_SAVE_VERSION = 2;

export const SAVE_SLOTS = ['auto', 'manual-1', 'manual-2', 'manual-3'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

export const SaveGameSchema = z.object({
  schemaVersion: z.literal(CURRENT_SAVE_VERSION),
  id: z.string().min(1),
  profileId: z.string().min(1),
  slot: z.enum(SAVE_SLOTS),
  chapterId: z.string().min(1),
  contentVersion: z.string().min(1),
  savedAt: z.string().datetime(),
  label: z.object({ sceneName: z.string(), objective: z.string().nullable() }),
  state: GameStateSchema,
});
export type SaveGame = z.infer<typeof SaveGameSchema>;

/** The v1 shape, kept so old saves can still be read. */
export const SaveGameV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  profileId: z.string().min(1),
  slot: z.enum(SAVE_SLOTS),
  chapterId: z.string().min(1),
  savedAt: z.number().nonnegative(),
  sceneId: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
  flags: z.record(z.string(), z.boolean()),
  inventory: z.array(z.string()),
});
/** @public Domain-model type (chapter-authoring API). */
export type SaveGameV1 = z.infer<typeof SaveGameV1Schema>;

export type Migration = (raw: unknown) => unknown;

export const MIGRATIONS: Record<number, Migration> = {
  1: (raw) => {
    const v1 = SaveGameV1Schema.parse(raw);
    const inventory: Record<string, number> = {};
    v1.inventory.forEach((id) => {
      inventory[id] = (inventory[id] ?? 0) + 1;
    });
    return {
      schemaVersion: 2,
      id: v1.id,
      profileId: v1.profileId,
      slot: v1.slot,
      chapterId: v1.chapterId,
      contentVersion: 'legacy-v1',
      savedAt: new Date(v1.savedAt).toISOString(),
      label: { sceneName: v1.sceneId, objective: null },
      state: {
        chapterId: v1.chapterId,
        sceneId: v1.sceneId,
        player: { x: v1.position.x, y: v1.position.y, facing: 'down' },
        flags: { ...v1.flags },
        counters: {},
        inventory,
        quests: {},
        trust: {},
        choices: [],
        journal: { unlocked: [], seen: [] },
        clues: [],
        puzzles: {},
        visitedScenes: [v1.sceneId],
        metCharacters: [],
        conversations: [],
        dialogueLog: [],
        reflection: null,
        chapterComplete: false,
        playTimeMs: 0,
      },
    };
  },
};

export type SaveLoadError =
  | { kind: 'corrupt'; message: string }
  | { kind: 'unsupported-version'; version: number }
  | { kind: 'migration-failed'; fromVersion: number; message: string };

export type MigrationResult =
  { ok: true; save: SaveGame; fromVersion: number } | { ok: false; error: SaveLoadError };

/** Bring any stored save up to the current version and validate it. Never throws. */
export function migrateSave(raw: unknown): MigrationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: { kind: 'corrupt', message: 'Save data is not an object' } };
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      error: { kind: 'corrupt', message: 'Save data has no valid schemaVersion' },
    };
  }
  if (version > CURRENT_SAVE_VERSION) {
    return { ok: false, error: { kind: 'unsupported-version', version } };
  }
  let data: unknown = raw;
  for (let v = version; v < CURRENT_SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) {
      return {
        ok: false,
        error: { kind: 'migration-failed', fromVersion: v, message: 'No migration defined' },
      };
    }
    try {
      data = migrate(data);
    } catch (err) {
      return {
        ok: false,
        error: { kind: 'migration-failed', fromVersion: v, message: (err as Error).message },
      };
    }
  }
  const parsed = SaveGameSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: { kind: 'corrupt', message: z.prettifyError(parsed.error) } };
  }
  return { ok: true, save: parsed.data, fromVersion: version };
}

/** Player-facing wording for load failures (no internals). */
export function describeLoadError(error: SaveLoadError): string {
  switch (error.kind) {
    case 'corrupt':
      return 'This save could not be read. It may have been damaged. Your other saves are safe.';
    case 'unsupported-version':
      return 'This save was made by a newer version of the game. Please update the game to load it.';
    case 'migration-failed':
      return 'This older save could not be upgraded to the current version.';
  }
}

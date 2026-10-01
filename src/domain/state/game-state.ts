import { z } from 'zod';
import { QUEST_STATUSES } from '../conditions';

/**
 * Persistent, per-chapter-run game state.
 *
 * This is the ONLY state that is saved. It deliberately contains no
 * rendering data (Phaser owns sprites/cameras) and no UI state (React owns
 * open panels). Everything here is a concrete fact about the story world:
 * who you met, what you carry, what you chose — never a score of faith,
 * holiness or favor (see docs/game-design.md §3, "Design pillars").
 */
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export const DirectionSchema = z.enum(DIRECTIONS);
export type Direction = z.infer<typeof DirectionSchema>;

export const QuestProgressSchema = z.object({
  status: z.enum(QUEST_STATUSES),
  stageId: z.string().nullable(),
  completedObjectives: z.array(z.string()),
  outcomeId: z.string().nullable(),
  startedAtMs: z.number().nonnegative().nullable(),
});
export type QuestProgress = z.infer<typeof QuestProgressSchema>;

export const PuzzleProgressSchema = z.object({
  status: z.enum(['unsolved', 'solved']),
  attempts: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  /** Puzzle-type specific answer snapshot (e.g. the packed satchel), for the summary. */
  solution: z.array(z.string()).nullable(),
});
export type PuzzleProgress = z.infer<typeof PuzzleProgressSchema>;

export const ChoiceRecordSchema = z.object({
  choiceId: z.string(),
  optionId: z.string(),
  sceneId: z.string(),
  atMs: z.number().nonnegative(),
});
/** @public Domain-model type (chapter-authoring API). */
export type ChoiceRecord = z.infer<typeof ChoiceRecordSchema>;

export const DialogueLogEntrySchema = z.object({
  dialogueId: z.string(),
  nodeId: z.string(),
  choiceId: z.string().nullable(),
});
export type DialogueLogEntry = z.infer<typeof DialogueLogEntrySchema>;

export const FlagValueSchema = z.union([z.boolean(), z.number(), z.string()]);
export type FlagValue = z.infer<typeof FlagValueSchema>;

export const MAX_DIALOGUE_LOG = 400;
export const MAX_REFLECTION_LENGTH = 2000;

export const GameStateSchema = z.object({
  chapterId: z.string().min(1),
  sceneId: z.string().min(1),
  player: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    facing: DirectionSchema,
  }),
  flags: z.record(z.string(), FlagValueSchema),
  counters: z.record(z.string(), z.number().finite()),
  inventory: z.record(z.string(), z.number().int().nonnegative()),
  quests: z.record(z.string(), QuestProgressSchema),
  trust: z.record(z.string(), z.number().int()),
  choices: z.array(ChoiceRecordSchema),
  journal: z.object({
    unlocked: z.array(z.string()),
    seen: z.array(z.string()),
  }),
  clues: z.array(z.string()),
  puzzles: z.record(z.string(), PuzzleProgressSchema),
  visitedScenes: z.array(z.string()),
  metCharacters: z.array(z.string()),
  conversations: z.array(z.string()),
  dialogueLog: z.array(DialogueLogEntrySchema).max(MAX_DIALOGUE_LOG),
  /** Stored on-device only. Never sent to analytics or any AI service. */
  reflection: z
    .object({ text: z.string().max(MAX_REFLECTION_LENGTH), savedAtMs: z.number() })
    .nullable(),
  chapterComplete: z.boolean(),
  playTimeMs: z.number().nonnegative(),
});
export type GameState = z.infer<typeof GameStateSchema>;

export interface InitialStateSeed {
  chapterId: string;
  sceneId: string;
  spawn: { x: number; y: number; facing: Direction };
  flags?: Record<string, FlagValue>;
  counters?: Record<string, number>;
  inventory?: Record<string, number>;
}

export function createInitialState(seed: InitialStateSeed): GameState {
  return {
    chapterId: seed.chapterId,
    sceneId: seed.sceneId,
    player: { ...seed.spawn },
    flags: { ...(seed.flags ?? {}) },
    counters: { ...(seed.counters ?? {}) },
    inventory: { ...(seed.inventory ?? {}) },
    quests: {},
    trust: {},
    choices: [],
    journal: { unlocked: [], seen: [] },
    clues: [],
    puzzles: {},
    visitedScenes: [],
    metCharacters: [],
    conversations: [],
    dialogueLog: [],
    reflection: null,
    chapterComplete: false,
    playTimeMs: 0,
  };
}

/** Append without duplicates, preserving first-seen order (used for id lists). */
export function appendUnique(list: readonly string[], value: string): string[] {
  return list.includes(value) ? [...list] : [...list, value];
}

import { z } from 'zod';
import type { GameState } from './state/game-state';

/**
 * Declarative predicates used by dialogue, quests, journal unlocks, scene
 * access and entity visibility.
 *
 * Content NEVER embeds executable code: every condition is data that this
 * module evaluates. That keeps chapter files safe to author, diff and review,
 * and makes every branch unit-testable.
 */
export type Condition =
  | { type: 'always' }
  | { type: 'flag'; flag: string; equals?: boolean | number | string }
  | { type: 'hasItem'; item: string; min?: number }
  | { type: 'questStatus'; quest: string; status: QuestStatusName }
  | { type: 'questStage'; quest: string; stage: string }
  | { type: 'objectiveDone'; quest: string; objective: string }
  | { type: 'choiceMade'; choice: string; option?: string }
  | { type: 'clueFound'; clue: string }
  | { type: 'cluesFound'; clues: string[]; min: number }
  | { type: 'puzzleSolved'; puzzle: string }
  | { type: 'visited'; scene: string }
  | { type: 'met'; character: string }
  | { type: 'conversationDone'; dialogue: string }
  | { type: 'counter'; counter: string; gte?: number; lte?: number; eq?: number }
  | { type: 'trust'; character: string; gte?: number; lte?: number }
  | { type: 'journalUnlocked'; entry: string }
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] }
  | { type: 'not'; condition: Condition };

export const QUEST_STATUSES = ['inactive', 'active', 'completed', 'failed'] as const;
export type QuestStatusName = (typeof QUEST_STATUSES)[number];

const id = z.string().min(1);

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('always') }),
    z.object({
      type: z.literal('flag'),
      flag: id,
      equals: z.union([z.boolean(), z.number(), z.string()]).optional(),
    }),
    z.object({ type: z.literal('hasItem'), item: id, min: z.number().int().positive().optional() }),
    z.object({ type: z.literal('questStatus'), quest: id, status: z.enum(QUEST_STATUSES) }),
    z.object({ type: z.literal('questStage'), quest: id, stage: id }),
    z.object({ type: z.literal('objectiveDone'), quest: id, objective: id }),
    z.object({ type: z.literal('choiceMade'), choice: id, option: id.optional() }),
    z.object({ type: z.literal('clueFound'), clue: id }),
    z.object({
      type: z.literal('cluesFound'),
      clues: z.array(id).min(1),
      min: z.number().int().positive(),
    }),
    z.object({ type: z.literal('puzzleSolved'), puzzle: id }),
    z.object({ type: z.literal('visited'), scene: id }),
    z.object({ type: z.literal('met'), character: id }),
    z.object({ type: z.literal('conversationDone'), dialogue: id }),
    z.object({
      type: z.literal('counter'),
      counter: id,
      gte: z.number().optional(),
      lte: z.number().optional(),
      eq: z.number().optional(),
    }),
    z.object({
      type: z.literal('trust'),
      character: id,
      gte: z.number().optional(),
      lte: z.number().optional(),
    }),
    z.object({ type: z.literal('journalUnlocked'), entry: id }),
    z.object({ type: z.literal('all'), of: z.array(ConditionSchema) }),
    z.object({ type: z.literal('any'), of: z.array(ConditionSchema) }),
    z.object({ type: z.literal('not'), condition: ConditionSchema }),
  ]),
);

/** Evaluate a condition against the current game state. Pure and total. */
export function evaluate(condition: Condition | undefined, state: GameState): boolean {
  if (!condition) return true;
  switch (condition.type) {
    case 'always':
      return true;
    case 'flag': {
      const value = state.flags[condition.flag];
      if (condition.equals === undefined) return value !== undefined && value !== false;
      return value === condition.equals;
    }
    case 'hasItem':
      return (state.inventory[condition.item] ?? 0) >= (condition.min ?? 1);
    case 'questStatus':
      return (state.quests[condition.quest]?.status ?? 'inactive') === condition.status;
    case 'questStage': {
      const quest = state.quests[condition.quest];
      return quest?.status === 'active' && quest.stageId === condition.stage;
    }
    case 'objectiveDone':
      return (
        state.quests[condition.quest]?.completedObjectives.includes(condition.objective) ?? false
      );
    case 'choiceMade':
      return state.choices.some(
        (c) =>
          c.choiceId === condition.choice &&
          (condition.option === undefined || c.optionId === condition.option),
      );
    case 'clueFound':
      return state.clues.includes(condition.clue);
    case 'cluesFound':
      return condition.clues.filter((c) => state.clues.includes(c)).length >= condition.min;
    case 'puzzleSolved':
      return state.puzzles[condition.puzzle]?.status === 'solved';
    case 'visited':
      return state.visitedScenes.includes(condition.scene);
    case 'met':
      return state.metCharacters.includes(condition.character);
    case 'conversationDone':
      return state.conversations.includes(condition.dialogue);
    case 'counter': {
      const value = state.counters[condition.counter] ?? 0;
      return compare(value, condition);
    }
    case 'trust': {
      const value = state.trust[condition.character] ?? 0;
      return compare(value, condition);
    }
    case 'journalUnlocked':
      return state.journal.unlocked.includes(condition.entry);
    case 'all':
      return condition.of.every((c) => evaluate(c, state));
    case 'any':
      return condition.of.some((c) => evaluate(c, state));
    case 'not':
      return !evaluate(condition.condition, state);
  }
}

function compare(value: number, bounds: { gte?: number; lte?: number; eq?: number }): boolean {
  if (bounds.eq !== undefined && value !== bounds.eq) return false;
  if (bounds.gte !== undefined && value < bounds.gte) return false;
  if (bounds.lte !== undefined && value > bounds.lte) return false;
  return true;
}

/** Collect every id a condition references, for content integrity checks. */
export function conditionReferences(condition: Condition | undefined): ConditionRefs {
  const refs: ConditionRefs = {
    items: new Set(),
    quests: new Set(),
    choices: new Set(),
    clues: new Set(),
    puzzles: new Set(),
    scenes: new Set(),
    characters: new Set(),
    dialogues: new Set(),
    journal: new Set(),
  };
  const walk = (c: Condition | undefined): void => {
    if (!c) return;
    switch (c.type) {
      case 'hasItem':
        refs.items.add(c.item);
        break;
      case 'questStatus':
      case 'questStage':
      case 'objectiveDone':
        refs.quests.add(c.quest);
        break;
      case 'choiceMade':
        refs.choices.add(c.choice);
        break;
      case 'clueFound':
        refs.clues.add(c.clue);
        break;
      case 'cluesFound':
        c.clues.forEach((x) => refs.clues.add(x));
        break;
      case 'puzzleSolved':
        refs.puzzles.add(c.puzzle);
        break;
      case 'visited':
        refs.scenes.add(c.scene);
        break;
      case 'met':
      case 'trust':
        refs.characters.add(c.character);
        break;
      case 'conversationDone':
        refs.dialogues.add(c.dialogue);
        break;
      case 'journalUnlocked':
        refs.journal.add(c.entry);
        break;
      case 'all':
      case 'any':
        c.of.forEach(walk);
        break;
      case 'not':
        walk(c.condition);
        break;
      default:
        break;
    }
  };
  walk(condition);
  return refs;
}

export interface ConditionRefs {
  items: Set<string>;
  quests: Set<string>;
  choices: Set<string>;
  clues: Set<string>;
  puzzles: Set<string>;
  scenes: Set<string>;
  characters: Set<string>;
  dialogues: Set<string>;
  journal: Set<string>;
}

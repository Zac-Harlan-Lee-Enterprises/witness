import { z } from 'zod';
import {
  classifyLoadout,
  LoadoutChoice,
  LoadoutRuleSchema,
  loadoutFailures,
  packRuleHolds,
  PuzzleBase,
  type LoadoutFailure,
  type Packing,
} from './puzzle-base';
import { DyeingPuzzleSchema } from './puzzle-dyeing';
import { FloorplanPuzzleSchema } from './puzzle-floorplan';
import { LogicGridPuzzleSchema } from './puzzle-logic-grid';
import { MapPuzzleSchema } from './puzzle-map';
import { NettingPuzzleSchema } from './puzzle-netting';
import { TrimPuzzleSchema } from './puzzle-trim';
import type { GameState } from './state/game-state';

/**
 * Puzzle types, each emerging from the story rather than bolted on. The
 * four originals live here (Chapter 1 uses all four):
 *
 *  packing    — resource allocation under a capacity limit, where knowledge
 *               gathered earlier changes what counts as "enough"
 *  measuring  — environmental logic (pouring between marked vessels)
 *  deduction  — pick an answer AND present evidence that supports it
 *  sequence   — order events so they agree with physical evidence, then
 *               draw a conclusion that states its own uncertainty
 *
 * Six more each belong to one later chapter, in their own modules:
 *  trim (puzzle-trim.ts), netting (puzzle-netting.ts)        — Chapter 2
 *  floorplan (puzzle-floorplan.ts), logicGrid (puzzle-logic-grid.ts) — Chapter 3
 *  dyeing (puzzle-dyeing.ts), map (puzzle-map.ts)             — Chapter 4
 *
 * Every checker is pure and returns reasoning-oriented feedback. Hints are
 * tiered: early tiers nudge reasoning; only the last tier explains the answer.
 */

// ── Packing ────────────────────────────────────────────────────────────────
export const PackingPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('packing'),
  capacity: z.number().int().positive(),
  rules: z.array(LoadoutRuleSchema).min(1),
  ...LoadoutChoice,
});
export type PackingPuzzle = z.infer<typeof PackingPuzzleSchema>;

export interface PackingCheck {
  weight: number;
  valid: boolean;
  failures: LoadoutFailure[];
}

export function checkPacking(
  puzzle: PackingPuzzle,
  packed: Packing,
  state: GameState,
  weightOf: (itemId: string) => number,
): PackingCheck {
  const weight = packingWeight(packed, weightOf);
  const holds = packRuleHolds(packed, state, weight <= puzzle.capacity);
  const failures = loadoutFailures(puzzle.rules, holds);
  return { weight, valid: failures.length === 0, failures };
}

export function packingWeight(packed: Packing, weightOf: (itemId: string) => number): number {
  return Object.entries(packed).reduce((s, [id, q]) => s + weightOf(id) * q, 0);
}

/** Which choice option this packing represents (for the consequence record). */
export function classifyPacking(
  puzzle: PackingPuzzle,
  packed: Packing,
  state: GameState,
  weightOf: (itemId: string) => number,
): string {
  const weight = packingWeight(packed, weightOf);
  return classifyLoadout(
    puzzle.classifications,
    packRuleHolds(packed, state, weight <= puzzle.capacity),
  );
}

// ── Measuring ──────────────────────────────────────────────────────────────
export const MeasuringPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('measuring'),
  sourceLabel: z.string().min(1),
  unit: z.string().min(1),
  vessels: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        capacity: z.number().int().positive(),
      }),
    )
    .min(2),
  goal: z.object({ vessel: z.string().min(1), amount: z.number().int().positive() }),
});
export type MeasuringPuzzle = z.infer<typeof MeasuringPuzzleSchema>;

export type MeasureAction =
  | { type: 'fill'; vessel: string }
  | { type: 'empty'; vessel: string }
  | { type: 'pour'; from: string; to: string };

export type Levels = Readonly<Record<string, number>>;

export function initialLevels(puzzle: MeasuringPuzzle): Levels {
  return Object.fromEntries(puzzle.vessels.map((v) => [v.id, 0]));
}

export function applyMeasure(
  puzzle: MeasuringPuzzle,
  levels: Levels,
  action: MeasureAction,
): Levels {
  const cap = (id: string): number => {
    const vessel = puzzle.vessels.find((v) => v.id === id);
    if (!vessel) throw new Error(`Unknown vessel ${id}`);
    return vessel.capacity;
  };
  switch (action.type) {
    case 'fill':
      return { ...levels, [action.vessel]: cap(action.vessel) };
    case 'empty':
      return { ...levels, [action.vessel]: 0 };
    case 'pour': {
      if (action.from === action.to) return levels;
      const from = levels[action.from] ?? 0;
      const to = levels[action.to] ?? 0;
      const moved = Math.min(from, cap(action.to) - to);
      return { ...levels, [action.from]: from - moved, [action.to]: to + moved };
    }
  }
}

export function isMeasureSolved(puzzle: MeasuringPuzzle, levels: Levels): boolean {
  return (levels[puzzle.goal.vessel] ?? 0) === puzzle.goal.amount;
}

// ── Deduction ──────────────────────────────────────────────────────────────
export const DeductionPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('deduction'),
  question: z.string().min(1),
  options: z
    .array(
      z.object({ id: z.string().min(1), label: z.string().min(1), description: z.string().min(1) }),
    )
    .min(2),
  answer: z.string().min(1),
  evidence: z
    .array(
      z.object({
        clueId: z.string().min(1),
        bearsOn: z.array(z.object({ option: z.string(), stance: z.enum(['supports', 'against']) })),
        reliable: z.boolean(),
        /** Feedback when this clue is presented. */
        note: z.string().min(1),
      }),
    )
    .min(1),
  requiredEvidence: z.number().int().positive(),
  wrongAnswerFeedback: z.record(z.string(), z.string()),
});
export type DeductionPuzzle = z.infer<typeof DeductionPuzzleSchema>;

export interface DeductionCheck {
  correct: boolean;
  feedback: string[];
}

export function checkDeduction(
  puzzle: DeductionPuzzle,
  answer: string,
  presented: readonly string[],
  state: GameState,
): DeductionCheck {
  const feedback: string[] = [];
  if (answer !== puzzle.answer) {
    feedback.push(puzzle.wrongAnswerFeedback[answer] ?? 'The evidence does not point that way.');
    return { correct: false, feedback };
  }
  const known = presented.filter((c) => state.clues.includes(c));
  const entries = known
    .map((c) => puzzle.evidence.find((e) => e.clueId === c))
    .filter((e): e is DeductionPuzzle['evidence'][number] => e !== undefined);
  const unreliable = entries.filter((e) => !e.reliable);
  unreliable.forEach((e) => feedback.push(e.note));
  const consistent = entries.filter(
    (e) =>
      e.reliable &&
      e.bearsOn.some(
        (b) =>
          (b.option === answer && b.stance === 'supports') ||
          (b.option !== answer && b.stance === 'against'),
      ),
  );
  const irrelevant = known.length - entries.length;
  const irrelevantNote = 'Some of what you presented does not bear on this question.';
  if (unreliable.length === 0 && consistent.length >= puzzle.requiredEvidence) {
    return {
      correct: true,
      feedback: [...consistent.map((e) => e.note), ...(irrelevant > 0 ? [irrelevantNote] : [])],
    };
  }
  if (irrelevant > 0) feedback.push(irrelevantNote);
  if (consistent.length < puzzle.requiredEvidence) {
    feedback.push(
      `You have the right idea. Back it up with ${puzzle.requiredEvidence} pieces of reliable evidence.`,
    );
  }
  return { correct: false, feedback };
}

// ── Sequence ───────────────────────────────────────────────────────────────
export const SequencePuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('sequence'),
  cards: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        /** The clue whose evidence places this event; must be found to be shown as "backed". */
        clueId: z.string().optional(),
        reasoning: z.string().min(1),
      }),
    )
    .min(3),
  correctOrder: z.array(z.string()).min(3),
  /** Shown shuffled in this fixed order (deterministic, testable). */
  initialOrder: z.array(z.string()).min(3),
  conclusion: z
    .object({
      question: z.string().min(1),
      options: z
        .array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(1),
            correct: z.boolean(),
            explanation: z.string().min(1),
          }),
        )
        .min(2),
    })
    .optional(),
  /** Clues the player must have found before the puzzle opens. */
  requiresClues: z
    .object({ clues: z.array(z.string()), min: z.number().int().positive() })
    .optional(),
});
export type SequencePuzzle = z.infer<typeof SequencePuzzleSchema>;

export interface SequenceCheck {
  correct: boolean;
  correctPositions: number;
  feedback: string;
}

export function checkSequence(puzzle: SequencePuzzle, order: readonly string[]): SequenceCheck {
  const correctPositions = order.filter((id, i) => puzzle.correctOrder[i] === id).length;
  if (
    correctPositions === puzzle.correctOrder.length &&
    order.length === puzzle.correctOrder.length
  ) {
    return { correct: true, correctPositions, feedback: 'The events fit the evidence.' };
  }
  const firstWrong = order.findIndex((id, i) => puzzle.correctOrder[i] !== id);
  const expectedId = puzzle.correctOrder[firstWrong];
  const card = puzzle.cards.find((c) => c.id === expectedId);
  return {
    correct: false,
    correctPositions,
    feedback: `${correctPositions} of ${puzzle.correctOrder.length} events are in the right place. Think about event ${
      firstWrong + 1
    }: ${card ? card.reasoning : 'what must have happened first?'}`,
  };
}

// ── Union ──────────────────────────────────────────────────────────────────
export const PuzzleSchema = z.discriminatedUnion('type', [
  PackingPuzzleSchema,
  MeasuringPuzzleSchema,
  DeductionPuzzleSchema,
  SequencePuzzleSchema,
  TrimPuzzleSchema,
  NettingPuzzleSchema,
  FloorplanPuzzleSchema,
  LogicGridPuzzleSchema,
  DyeingPuzzleSchema,
  MapPuzzleSchema,
]);
export type Puzzle = z.infer<typeof PuzzleSchema>;
/** @public Domain-model type (chapter-authoring API). */
export type PuzzleType = Puzzle['type'];

export function hintFor(puzzle: Puzzle, tier: number): string | null {
  const sorted = [...puzzle.hints].sort((a, b) => a.tier - b.tier);
  return sorted[Math.min(tier, sorted.length) - 1]?.text ?? null;
}

export function maxHintTier(puzzle: Puzzle): number {
  return puzzle.hints.length;
}

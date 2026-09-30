import type { Effect } from '@/domain/effects';
import { describePacking, packingEffects, type Packing } from '@/domain/puzzle-base';
import {
  checkDeduction,
  checkPacking,
  checkSequence,
  classifyPacking,
  hintFor,
  isMeasureSolved,
  maxHintTier,
  type DeductionCheck,
  type Levels,
  type PackingCheck,
  type Puzzle,
  type SequenceCheck,
} from '@/domain/puzzles';
import type { Logger } from '@/shared/logger';
import type { GameSession } from './game-session';
import type { UiStore } from './ui-store';

/**
 * Application service for puzzles: opens/closes the puzzle UI, validates
 * attempts with the pure domain checkers, tracks attempts and hints, and on
 * success applies the puzzle's `onSolved` effects. Attempts are counted for
 * optional anonymous analytics only — there is no penalty and no score.
 */
export class PuzzleController {
  constructor(
    private readonly session: GameSession,
    private readonly ui: UiStore,
    private readonly logger: Logger,
  ) {}

  find(puzzleId: string): Puzzle | null {
    return this.session.chapter.puzzles.find((p) => p.id === puzzleId) ?? null;
  }

  open(puzzleId: string): void {
    const puzzle = this.find(puzzleId);
    if (!puzzle) {
      this.logger.error(`Unknown puzzle '${puzzleId}'`);
      return;
    }
    if (this.isSolved(puzzleId)) return;
    this.session.updatePuzzle(puzzleId, (p) => p);
    this.ui.setPuzzle(puzzleId);
    this.session.publish([{ type: 'PuzzleStarted', puzzleId }]);
  }

  close(): void {
    this.ui.setPuzzle(null);
  }

  isSolved(puzzleId: string): boolean {
    return this.session.state.puzzles[puzzleId]?.status === 'solved';
  }

  hintsUsed(puzzleId: string): number {
    return this.session.state.puzzles[puzzleId]?.hintsUsed ?? 0;
  }

  /** Reveal the next hint tier and return all revealed hints so far. */
  requestHint(puzzleId: string): string[] {
    const puzzle = this.find(puzzleId);
    if (!puzzle) return [];
    const progress = this.session.updatePuzzle(puzzleId, (p) => ({
      ...p,
      hintsUsed: Math.min(maxHintTier(puzzle), p.hintsUsed + 1),
    }));
    this.session.publish([{ type: 'HintRequested', puzzleId, tier: progress.hintsUsed }]);
    return this.revealedHints(puzzleId);
  }

  revealedHints(puzzleId: string): string[] {
    const puzzle = this.find(puzzleId);
    if (!puzzle) return [];
    const used = this.hintsUsed(puzzleId);
    return Array.from({ length: used }, (_, i) => hintFor(puzzle, i + 1)).filter(
      (h): h is string => h !== null,
    );
  }

  weightOf = (itemId: string): number =>
    this.session.chapter.items.find((i) => i.id === itemId)?.weight ?? 0;

  checkPacking(puzzleId: string, packed: Packing): PackingCheck | null {
    const puzzle = this.find(puzzleId);
    if (puzzle?.type !== 'packing') return null;
    return checkPacking(puzzle, packed, this.session.state, this.weightOf);
  }

  submitPacking(puzzleId: string, packed: Packing): PackingCheck | null {
    const puzzle = this.find(puzzleId);
    if (puzzle?.type !== 'packing') return null;
    const result = checkPacking(puzzle, packed, this.session.state, this.weightOf);
    this.recordAttempt(puzzleId, result.valid);
    if (result.valid) {
      const option = classifyPacking(puzzle, packed, this.session.state, this.weightOf);
      this.complete(puzzle, describePacking(packed), [
        ...packingEffects(this.session.state.inventory, packed, this.weightOf),
        { type: 'recordChoice', choice: puzzle.choiceId, option },
      ]);
    }
    return result;
  }

  submitMeasure(puzzleId: string, levels: Levels): boolean {
    const puzzle = this.find(puzzleId);
    if (puzzle?.type !== 'measuring') return false;
    const solved = isMeasureSolved(puzzle, levels);
    this.recordAttempt(puzzleId, solved);
    if (solved) this.complete(puzzle, [`${puzzle.goal.vessel}:${puzzle.goal.amount}`], []);
    return solved;
  }

  submitDeduction(
    puzzleId: string,
    answer: string,
    presented: readonly string[],
  ): DeductionCheck | null {
    const puzzle = this.find(puzzleId);
    if (puzzle?.type !== 'deduction') return null;
    const result = checkDeduction(puzzle, answer, presented, this.session.state);
    this.recordAttempt(puzzleId, result.correct);
    if (result.correct) this.complete(puzzle, [answer, ...presented], []);
    return result;
  }

  /** Check the event order. When correct and a conclusion exists, the puzzle is not yet complete. */
  submitSequence(puzzleId: string, order: readonly string[]): SequenceCheck | null {
    const puzzle = this.find(puzzleId);
    if (puzzle?.type !== 'sequence') return null;
    const result = checkSequence(puzzle, order);
    this.recordAttempt(puzzleId, result.correct);
    if (result.correct && !puzzle.conclusion) this.complete(puzzle, [...order], []);
    return result;
  }

  submitConclusion(
    puzzleId: string,
    optionId: string,
  ): { correct: boolean; explanation: string } | null {
    const puzzle = this.find(puzzleId);
    if (puzzle?.type !== 'sequence' || !puzzle.conclusion) return null;
    const option = puzzle.conclusion.options.find((o) => o.id === optionId);
    if (!option) return null;
    this.recordAttempt(puzzleId, option.correct);
    if (option.correct) this.complete(puzzle, [...puzzle.correctOrder, optionId], []);
    return { correct: option.correct, explanation: option.explanation };
  }

  private recordAttempt(puzzleId: string, correct: boolean): void {
    const progress = this.session.updatePuzzle(puzzleId, (p) => ({
      ...p,
      attempts: p.attempts + 1,
    }));
    this.session.publish([
      { type: 'PuzzleAttempted', puzzleId, correct, attempt: progress.attempts },
    ]);
  }

  private complete(puzzle: Puzzle, solution: string[], extraEffects: Effect[]): void {
    const progress = this.session.updatePuzzle(puzzle.id, (p) => ({
      ...p,
      status: 'solved',
      solution,
    }));
    this.session.publish([
      {
        type: 'PuzzleCompleted',
        puzzleId: puzzle.id,
        attempts: progress.attempts,
        hintsUsed: progress.hintsUsed,
      },
    ]);
    // Rules run on dispatch, so objectives watching `puzzleSolved` complete here.
    this.session.dispatch([
      ...extraEffects,
      ...puzzle.onSolved,
      { type: 'setFlag', flag: `solved:${puzzle.id}`, value: true },
    ]);
    this.session.publish([{ type: 'SaveRequested', reason: 'puzzle' }]);
  }
}

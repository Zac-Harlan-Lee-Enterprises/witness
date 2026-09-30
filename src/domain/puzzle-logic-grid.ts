import { z } from 'zod';
import { PuzzleBase } from './puzzle-base';

/**
 * Logic grid: match each subject (a person) to one option (a place), using
 * a handful of clues. Every clue has written text for the player and a
 * structured rule so the checker can say which clue an answer breaks. A fair
 * puzzle has exactly one assignment that keeps every clue (checked in
 * chapter-integrity.ts).
 *
 * Options may carry a `position` (their order along a row), which the
 * `nextTo` and `before` rules use.
 */
export type LogicRule =
  | { type: 'is'; subject: string; option: string }
  | { type: 'isNot'; subject: string; option: string }
  | { type: 'oneOf'; subject: string; options: string[] }
  | { type: 'noneOf'; subject: string; options: string[] }
  | { type: 'nextTo'; a: string; b: string }
  | { type: 'notNextTo'; a: string; b: string }
  | { type: 'before'; a: string; b: string };

const id = z.string().min(1);
const LogicRuleSchema: z.ZodType<LogicRule> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('is'), subject: id, option: id }),
  z.object({ type: z.literal('isNot'), subject: id, option: id }),
  z.object({ type: z.literal('oneOf'), subject: id, options: z.array(id).min(1) }),
  z.object({ type: z.literal('noneOf'), subject: id, options: z.array(id).min(1) }),
  z.object({ type: z.literal('nextTo'), a: id, b: id }),
  z.object({ type: z.literal('notNextTo'), a: id, b: id }),
  z.object({ type: z.literal('before'), a: id, b: id }),
]);

export const LogicGridPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('logicGrid'),
  /** What the rows are (e.g. "Who"), and what the columns are (e.g. "Place"). */
  subjectsLabel: z.string().min(1),
  optionsLabel: z.string().min(1),
  subjects: z.array(z.object({ id, label: z.string().min(1) })).min(2),
  options: z
    .array(z.object({ id, label: z.string().min(1), position: z.number().int().optional() }))
    .min(2),
  clues: z.array(z.object({ id, text: z.string().min(1), rule: LogicRuleSchema })).min(1),
  /** subject id → option id */
  answer: z.record(z.string(), z.string()),
});
export type LogicGridPuzzle = z.infer<typeof LogicGridPuzzleSchema>;

/** subject id → option id (possibly incomplete while the player works). */
export type LogicAssignment = Readonly<Record<string, string>>;

/** Whether a rule holds for a complete assignment. */
export function logicRuleHolds(
  puzzle: LogicGridPuzzle,
  rule: LogicRule,
  assignment: LogicAssignment,
): boolean {
  const pos = (subject: string): number | undefined =>
    puzzle.options.find((o) => o.id === assignment[subject])?.position;
  switch (rule.type) {
    case 'is':
      return assignment[rule.subject] === rule.option;
    case 'isNot':
      return assignment[rule.subject] !== rule.option;
    case 'oneOf':
      return rule.options.includes(assignment[rule.subject] ?? '');
    case 'noneOf':
      return !rule.options.includes(assignment[rule.subject] ?? '');
    case 'nextTo':
    case 'notNextTo': {
      const a = pos(rule.a);
      const b = pos(rule.b);
      const adjacent = a !== undefined && b !== undefined && Math.abs(a - b) === 1;
      return rule.type === 'nextTo' ? adjacent : !adjacent;
    }
    case 'before': {
      const a = pos(rule.a);
      const b = pos(rule.b);
      return a !== undefined && b !== undefined && a < b;
    }
  }
}

export interface LogicGridCheck {
  correct: boolean;
  /** Every subject has an option, and no option is used twice. */
  complete: boolean;
  /** Ids of the clues this assignment breaks. */
  broken: string[];
  feedback: string;
}

export function checkLogicGrid(
  puzzle: LogicGridPuzzle,
  assignment: LogicAssignment,
): LogicGridCheck {
  const chosen = puzzle.subjects.map((s) => assignment[s.id]);
  const complete =
    chosen.every((o) => o !== undefined && puzzle.options.some((opt) => opt.id === o)) &&
    new Set(chosen).size === chosen.length;
  if (!complete)
    return {
      correct: false,
      complete,
      broken: [],
      feedback: `Give each ${puzzle.subjectsLabel.toLowerCase()} exactly one ${puzzle.optionsLabel.toLowerCase()}, with no two sharing.`,
    };
  const broken = puzzle.clues
    .filter((c) => !logicRuleHolds(puzzle, c.rule, assignment))
    .map((c) => c.id);
  if (broken.length === 0) return { correct: true, complete, broken, feedback: 'Every clue fits.' };
  const first = puzzle.clues.find((c) => c.id === broken[0]);
  return {
    correct: false,
    complete,
    broken,
    feedback: `${broken.length === 1 ? 'One clue doesn’t fit' : `${broken.length} clues don’t fit`}. Look again at this one: “${first?.text ?? ''}”`,
  };
}

/** Every assignment that keeps all the clues (a fair puzzle has exactly one). */
export function logicGridSolutions(puzzle: LogicGridPuzzle): Array<Record<string, string>> {
  const found: Array<Record<string, string>> = [];
  const assign = (i: number, current: Record<string, string>, used: Set<string>): void => {
    const subject = puzzle.subjects[i];
    if (!subject) {
      if (puzzle.clues.every((c) => logicRuleHolds(puzzle, c.rule, current)))
        found.push({ ...current });
      return;
    }
    for (const option of puzzle.options) {
      if (used.has(option.id)) continue;
      used.add(option.id);
      assign(i + 1, { ...current, [subject.id]: option.id }, used);
      used.delete(option.id);
    }
  };
  assign(0, {}, new Set());
  return found;
}

/** Subjects and options a rule names (for integrity checks). */
export function logicRuleRefs(rule: LogicRule): { subjects: string[]; options: string[] } {
  switch (rule.type) {
    case 'is':
    case 'isNot':
      return { subjects: [rule.subject], options: [rule.option] };
    case 'oneOf':
    case 'noneOf':
      return { subjects: [rule.subject], options: rule.options };
    default:
      return { subjects: [rule.a, rule.b], options: [] };
  }
}

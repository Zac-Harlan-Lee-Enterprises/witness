import { z } from 'zod';
import { ConditionSchema, evaluate, type Condition } from './conditions';
import type { Effect } from './effects';
import { EffectSchema } from './effects';
import type { GameState } from './state/game-state';

/**
 * What every puzzle type shares, and the "loadout" rules that the puzzles
 * which decide what you take with you (packing, trim, floor plan) share.
 * Each puzzle type lives in its own module; `puzzles.ts` unions them.
 */
const HintSchema = z.object({ tier: z.number().int().positive(), text: z.string().min(1) });

export const PuzzleBase = {
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.string().min(1),
  hints: z.array(HintSchema).min(2),
  /** Shown after solving: WHY the answer is right. */
  explanation: z.string().min(1),
  /** ContentRecords backing any factual claim in the puzzle. */
  recordIds: z.array(z.string()).default([]),
  onSolved: z.array(EffectSchema).default([]),
};

// ── Loadout rules: what must (or may) be taken ─────────────────────────────
export type PackRule =
  | { type: 'includes'; item: string; min?: number }
  | { type: 'withinCapacity' }
  | { type: 'state'; condition: Condition }
  | { type: 'allOf'; of: PackRule[] }
  | { type: 'anyOf'; of: PackRule[] };

const PackRuleSchema: z.ZodType<PackRule> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('includes'),
      item: z.string(),
      min: z.number().int().positive().optional(),
    }),
    z.object({ type: z.literal('withinCapacity') }),
    z.object({ type: z.literal('state'), condition: ConditionSchema }),
    z.object({ type: z.literal('allOf'), of: z.array(PackRuleSchema) }),
    z.object({ type: z.literal('anyOf'), of: z.array(PackRuleSchema) }),
  ]),
);

/** A rule the player's loadout must meet, with a reason-giving hint when it doesn't. */
export const LoadoutRuleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  rule: PackRuleSchema,
  failureHint: z.string().min(1),
});
export type LoadoutRule = z.infer<typeof LoadoutRuleSchema>;

/** Record the final loadout as a choice; the first matching classification wins. */
export const LoadoutChoice = {
  /** Choice id to record the final loadout under (for consequences/summary). */
  choiceId: z.string().min(1),
  classifications: z.array(z.object({ option: z.string().min(1), rule: PackRuleSchema })).min(1),
};

/** How many of each item were taken. */
export type Packing = Readonly<Record<string, number>>;

export interface LoadoutFailure {
  ruleId: string;
  description: string;
  hint: string;
}

/**
 * A predicate for pack rules over one loadout. `withinCapacity` is whatever
 * the puzzle type means by "it fits" (a weight limit, or a floor it covers).
 */
export function packRuleHolds(
  packed: Packing,
  state: GameState,
  withinCapacity: boolean,
): (rule: PackRule) => boolean {
  const holds = (rule: PackRule): boolean => {
    switch (rule.type) {
      case 'includes':
        return (packed[rule.item] ?? 0) >= (rule.min ?? 1);
      case 'withinCapacity':
        return withinCapacity;
      case 'state':
        return evaluate(rule.condition, state);
      case 'allOf':
        return rule.of.every(holds);
      case 'anyOf':
        return rule.of.some(holds);
    }
  };
  return holds;
}

export function loadoutFailures(
  rules: readonly LoadoutRule[],
  holds: (rule: PackRule) => boolean,
): LoadoutFailure[] {
  return rules
    .filter((r) => !holds(r.rule))
    .map((r) => ({ ruleId: r.id, description: r.description, hint: r.failureHint }));
}

/** Which choice option a loadout represents (for the consequence record). */
export function classifyLoadout(
  classifications: ReadonlyArray<{ option: string; rule: PackRule }>,
  holds: (rule: PackRule) => boolean,
): string {
  const match = classifications.find((c) => holds(c.rule));
  return (match ?? classifications[classifications.length - 1])?.option ?? 'packed';
}

/** Every item a pack rule mentions (for integrity checks). */
export function packRuleItems(rule: PackRule): string[] {
  switch (rule.type) {
    case 'includes':
      return [rule.item];
    case 'allOf':
    case 'anyOf':
      return rule.of.flatMap(packRuleItems);
    default:
      return [];
  }
}

/**
 * Effects that make the inventory match the loadout: anything with weight
 * that was not taken stays behind.
 */
export function packingEffects(
  owned: Readonly<Record<string, number>>,
  packed: Packing,
  weightOf: (itemId: string) => number,
): Effect[] {
  return Object.entries(owned)
    .filter(([id]) => weightOf(id) > 0)
    .flatMap(([id, qty]) => {
      const leave = qty - Math.min(qty, packed[id] ?? 0);
      return leave > 0 ? [{ type: 'takeItem' as const, item: id, quantity: leave }] : [];
    });
}

export function describePacking(packed: Packing): string[] {
  return Object.entries(packed)
    .filter(([, q]) => q > 0)
    .flatMap(([id, q]) => Array.from({ length: q }, () => id))
    .sort();
}

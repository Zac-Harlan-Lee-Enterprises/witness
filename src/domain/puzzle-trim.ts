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
import type { GameState } from './state/game-state';

/**
 * Trim: load a boat so she sits level. Choose what goes aboard (the loadout
 * rules and a total load limit, as in packing) AND where each thing goes:
 * every place has its own room, the crew already sit where they must, and
 * each pair of opposite places (bow and stern, port and starboard) must weigh
 * about the same. Whatever stays on the jetty is left behind.
 */
export const TrimPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('trim'),
  /** The most cargo the boat can carry, crew aside. */
  capacity: z.number().int().positive(),
  places: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        /** Room for cargo in this place. */
        limit: z.number().int().positive(),
      }),
    )
    .min(2),
  /** People already aboard: they count toward the balance, not the cargo. */
  crew: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        place: z.string().min(1),
        weight: z.number().int().positive(),
      }),
    )
    .default([]),
  balance: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string().min(1),
        between: z.tuple([z.string().min(1), z.string().min(1)]),
        /** How much heavier one side may be than the other. */
        tolerance: z.number().int().nonnegative(),
        failureHint: z.string().min(1),
      }),
    )
    .min(1),
  rules: z.array(LoadoutRuleSchema).default([]),
  ...LoadoutChoice,
});
export type TrimPuzzle = z.infer<typeof TrimPuzzleSchema>;

/** Cargo by place: place id → item id → how many. */
export type TrimLoad = Readonly<Record<string, Packing>>;

export interface TrimPlaceView {
  id: string;
  label: string;
  cargo: number;
  crew: number;
  /** Cargo plus crew: what counts for the balance. */
  total: number;
  limit: number;
}

export interface TrimCheck {
  /** All cargo aboard. */
  weight: number;
  places: TrimPlaceView[];
  valid: boolean;
  failures: LoadoutFailure[];
}

/** Everything aboard, whatever its place. */
export function trimAboard(load: TrimLoad): Packing {
  const out: Record<string, number> = {};
  for (const cargo of Object.values(load))
    for (const [item, q] of Object.entries(cargo)) if (q > 0) out[item] = (out[item] ?? 0) + q;
  return out;
}

export function trimPlaces(
  puzzle: TrimPuzzle,
  load: TrimLoad,
  weightOf: (itemId: string) => number,
): TrimPlaceView[] {
  return puzzle.places.map((p) => {
    const cargo = Object.entries(load[p.id] ?? {}).reduce((s, [id, q]) => s + weightOf(id) * q, 0);
    const crew = puzzle.crew.filter((c) => c.place === p.id).reduce((s, c) => s + c.weight, 0);
    return { id: p.id, label: p.label, cargo, crew, total: cargo + crew, limit: p.limit };
  });
}

/** The difference across one balance pair: positive when the first place is heavier. */
export function trimDifference(
  places: readonly TrimPlaceView[],
  between: readonly [string, string],
): number {
  const total = (id: string) => places.find((p) => p.id === id)?.total ?? 0;
  return total(between[0]) - total(between[1]);
}

export function checkTrim(
  puzzle: TrimPuzzle,
  load: TrimLoad,
  state: GameState,
  weightOf: (itemId: string) => number,
): TrimCheck {
  const places = trimPlaces(puzzle, load, weightOf);
  const weight = places.reduce((s, p) => s + p.cargo, 0);
  const holds = packRuleHolds(trimAboard(load), state, weight <= puzzle.capacity);
  const crowded = places
    .filter((p) => p.cargo > p.limit)
    .map((p) => ({
      ruleId: `room:${p.id}`,
      description: `Nothing more in the ${p.label.toLowerCase()} than it has room for (${p.limit})`,
      hint: `The ${p.label.toLowerCase()} only has room for ${p.limit}, and it holds ${p.cargo}. Move something somewhere else.`,
    }));
  const unbalanced = puzzle.balance
    .filter((b) => Math.abs(trimDifference(places, b.between)) > b.tolerance)
    .map((b) => ({ ruleId: b.id, description: b.description, hint: b.failureHint }));
  const failures = [...loadoutFailures(puzzle.rules, holds), ...crowded, ...unbalanced];
  return { weight, places, valid: failures.length === 0, failures };
}

export function classifyTrim(
  puzzle: TrimPuzzle,
  load: TrimLoad,
  state: GameState,
  weightOf: (itemId: string) => number,
): string {
  const aboard = trimAboard(load);
  const weight = Object.entries(aboard).reduce((s, [id, q]) => s + weightOf(id) * q, 0);
  return classifyLoadout(
    puzzle.classifications,
    packRuleHolds(aboard, state, weight <= puzzle.capacity),
  );
}

/**
 * Move one of an item: from a place (or the jetty, `null`) to a place (or
 * back to the jetty). Nothing changes if there is none of it to move.
 */
export function moveCargo(
  load: TrimLoad,
  owned: Packing,
  item: string,
  from: string | null,
  to: string | null,
): TrimLoad {
  if (from === to) return load;
  const aboard = trimAboard(load)[item] ?? 0;
  const available = from === null ? (owned[item] ?? 0) - aboard : (load[from]?.[item] ?? 0);
  if (available <= 0) return load;
  const next: Record<string, Record<string, number>> = Object.fromEntries(
    Object.entries(load).map(([p, cargo]) => [p, { ...cargo }]),
  );
  if (from !== null) {
    const left = (next[from]?.[item] ?? 0) - 1;
    next[from] = Object.fromEntries(
      Object.entries({ ...next[from], [item]: left }).filter(([, q]) => q > 0),
    );
  }
  if (to !== null) {
    const place = next[to] ?? {};
    place[item] = (place[item] ?? 0) + 1;
    next[to] = place;
  }
  return next;
}

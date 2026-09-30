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
 * Floor plan: fit shaped pieces (bedding, jars, a loom…) onto a room's floor
 * grid around the things that can't move, turning them as needed. Pieces
 * may not overlap, leave the room, or cover a fixed thing. What gets a place
 * on the floor is the loadout; loadout rules say what must be there.
 *
 * `floor` rows use '.' for open floor; any other character is a fixed thing
 * named in `fixtures`. Piece `shape` rows use '#' for a covered cell.
 */
export const FloorplanPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('floorplan'),
  floor: z.array(z.string().min(1)).min(1),
  fixtures: z
    .array(z.object({ symbol: z.string().length(1), label: z.string().min(1) }))
    .default([]),
  pieces: z
    .array(
      z.object({
        /** The item this piece stands for. */
        item: z.string().min(1),
        label: z.string().min(1),
        shape: z.array(z.string().regex(/^[#.]+$/)).min(1),
      }),
    )
    .min(1),
  rules: z.array(LoadoutRuleSchema).default([]),
  ...LoadoutChoice,
});
export type FloorplanPuzzle = z.infer<typeof FloorplanPuzzleSchema>;

export interface PiecePlacement {
  item: string;
  row: number;
  col: number;
  /** Quarter turns clockwise, 0–3. */
  turns: number;
}

export type Cell = readonly [row: number, col: number];

/** The cells a shape covers after `turns` quarter turns, anchored at its top-left. */
export function shapeCells(shape: readonly string[], turns: number): Cell[] {
  let cells: Cell[] = shape.flatMap((row, r) =>
    [...row].flatMap((ch, c) => (ch === '#' ? [[r, c] as const] : [])),
  );
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) cells = cells.map(([r, c]) => [c, -r] as const);
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]) => [r - minR + 0, c - minC + 0] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function placementCells(puzzle: FloorplanPuzzle, placement: PiecePlacement): Cell[] {
  const piece = puzzle.pieces.find((p) => p.item === placement.item);
  if (!piece) return [];
  return shapeCells(piece.shape, placement.turns).map(
    ([r, c]) => [r + placement.row, c + placement.col] as const,
  );
}

export type PlacementProblem =
  { kind: 'outside' } | { kind: 'fixture'; label: string } | { kind: 'overlap'; item: string };

/** Why a piece can't go here, or null if it fits (ignoring any earlier placement of itself). */
export function placementProblem(
  puzzle: FloorplanPuzzle,
  placements: readonly PiecePlacement[],
  candidate: PiecePlacement,
): PlacementProblem | null {
  const height = puzzle.floor.length;
  const width = puzzle.floor[0]?.length ?? 0;
  const others = placements.filter((p) => p.item !== candidate.item);
  for (const [r, c] of placementCells(puzzle, candidate)) {
    if (r < 0 || c < 0 || r >= height || c >= width) return { kind: 'outside' };
    const ch = puzzle.floor[r]?.[c] ?? '.';
    if (ch !== '.')
      return {
        kind: 'fixture',
        label: puzzle.fixtures.find((f) => f.symbol === ch)?.label ?? 'something fixed',
      };
    const clash = others.find((o) =>
      placementCells(puzzle, o).some(([or, oc]) => or === r && oc === c),
    );
    if (clash) return { kind: 'overlap', item: clash.item };
  }
  return null;
}

/** Place (or move) a piece if it fits; otherwise the placements are unchanged. */
export function placePiece(
  puzzle: FloorplanPuzzle,
  placements: readonly PiecePlacement[],
  candidate: PiecePlacement,
): PiecePlacement[] {
  if (placementProblem(puzzle, placements, candidate)) return [...placements];
  return [...placements.filter((p) => p.item !== candidate.item), candidate];
}

export interface FloorplanCheck {
  valid: boolean;
  failures: LoadoutFailure[];
  placed: Packing;
}

export function floorplanLoadout(placements: readonly PiecePlacement[]): Packing {
  return Object.fromEntries(placements.map((p) => [p.item, 1]));
}

/** Pieces that don't fit (overlap, off the floor, on a fixed thing) make the plan invalid. */
export function checkFloorplan(
  puzzle: FloorplanPuzzle,
  placements: readonly PiecePlacement[],
  state: GameState,
): FloorplanCheck {
  const placed = floorplanLoadout(placements);
  const fits = placements.every(
    (p, i) => placementProblem(puzzle, placements.slice(0, i), p) === null,
  );
  const failures = loadoutFailures(puzzle.rules, packRuleHolds(placed, state, fits));
  if (!fits)
    failures.push({
      ruleId: 'fit',
      description: 'Every piece lies flat on open floor',
      hint: 'Something overlaps or covers a fixed thing. Move it.',
    });
  return { valid: failures.length === 0, failures, placed };
}

export function classifyFloorplan(
  puzzle: FloorplanPuzzle,
  placements: readonly PiecePlacement[],
  state: GameState,
): string {
  return classifyLoadout(
    puzzle.classifications,
    packRuleHolds(floorplanLoadout(placements), state, true),
  );
}

/**
 * Every way to lay out exactly these pieces (for integrity checks and
 * tests). Stops after `limit` layouts.
 */
export function floorplanLayouts(
  puzzle: FloorplanPuzzle,
  items: readonly string[],
  limit = 50,
): PiecePlacement[][] {
  const height = puzzle.floor.length;
  const width = puzzle.floor[0]?.length ?? 0;
  const found: PiecePlacement[][] = [];
  const search = (i: number, placed: PiecePlacement[]): void => {
    if (found.length >= limit) return;
    const item = items[i];
    if (item === undefined) {
      found.push([...placed]);
      return;
    }
    const seen = new Set<string>();
    for (let turns = 0; turns < 4; turns++)
      for (let row = 0; row < height; row++)
        for (let col = 0; col < width; col++) {
          const candidate = { item, row, col, turns };
          const key = placementCells(puzzle, candidate)
            .map(([r, c]) => `${r},${c}`)
            .sort()
            .join(' ');
          if (seen.has(key)) continue;
          seen.add(key);
          if (placementProblem(puzzle, placed, candidate)) continue;
          search(i + 1, [...placed, candidate]);
        }
  };
  search(0, []);
  return found;
}

import { z } from 'zod';
import { PuzzleBase } from './puzzle-base';

/**
 * Net mending: a picture logic grid (a "nonogram"). The pattern knotted into
 * the net is `pattern` ('#' = a knot, '.' = open mesh). Along every row and
 * down every column, the numbers give the runs of knots in order — derived
 * from the pattern, so they can never disagree with it. Cells marked '?' in
 * `torn` are torn and must be re-tied (or left open); every other cell is
 * intact and shown as it is.
 */
const Row = z.string().regex(/^[#.]+$/);
export const NettingPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('netting'),
  pattern: z.array(Row).min(2),
  torn: z.array(z.string().regex(/^[?.#]+$/)).min(2),
});
export type NettingPuzzle = z.infer<typeof NettingPuzzleSchema>;

/** A torn cell's state while mending: a knot tied, marked to stay open, or not yet decided. */
export type NetCell = 'knot' | 'open' | 'unknown';
export type NetGrid = readonly (readonly NetCell[])[];

export function runsOf(line: readonly boolean[]): number[] {
  const runs: number[] = [];
  let n = 0;
  for (const on of line) {
    if (on) n++;
    else if (n > 0) {
      runs.push(n);
      n = 0;
    }
  }
  if (n > 0) runs.push(n);
  return runs;
}

const knotsOf = (rows: readonly string[]): boolean[][] =>
  rows.map((r) => [...r].map((ch) => ch === '#'));
const column = (grid: readonly (readonly boolean[])[], c: number) => grid.map((r) => r[c] ?? false);

export function netClues(puzzle: NettingPuzzle): { rows: number[][]; columns: number[][] } {
  const grid = knotsOf(puzzle.pattern);
  const width = puzzle.pattern[0]?.length ?? 0;
  return {
    rows: grid.map(runsOf),
    columns: Array.from({ length: width }, (_, c) => runsOf(column(grid, c))),
  };
}

export const isTorn = (puzzle: NettingPuzzle, row: number, col: number): boolean =>
  puzzle.torn[row]?.[col] === '?';

/** The net as it is before mending: intact cells as in the pattern, torn cells undecided. */
export function initialNet(puzzle: NettingPuzzle): NetCell[][] {
  return puzzle.pattern.map((r, ri) =>
    [...r].map((ch, ci) => (isTorn(puzzle, ri, ci) ? 'unknown' : ch === '#' ? 'knot' : 'open')),
  );
}

/** Cycle a torn cell: undecided → knot → open → undecided. Intact cells never change. */
export function cycleNetCell(
  puzzle: NettingPuzzle,
  net: NetGrid,
  row: number,
  col: number,
): NetCell[][] {
  const next = net.map((r) => [...r]);
  if (!isTorn(puzzle, row, col)) return next;
  const cell = next[row]?.[col];
  const order: NetCell[] = ['unknown', 'knot', 'open'];
  const r = next[row];
  if (r && cell) r[col] = order[(order.indexOf(cell) + 1) % order.length] as NetCell;
  return next;
}

export interface NetLineCheck {
  clue: number[];
  current: number[];
  matches: boolean;
}

export interface NettingCheck {
  solved: boolean;
  rows: NetLineCheck[];
  columns: NetLineCheck[];
}

const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Undecided cells count as open. Solved when every row and column matches its numbers. */
export function checkNetting(puzzle: NettingPuzzle, net: NetGrid): NettingCheck {
  const clues = netClues(puzzle);
  const grid = net.map((r) => r.map((c) => c === 'knot'));
  const line = (clue: number[], cells: boolean[]): NetLineCheck => {
    const current = runsOf(cells);
    return { clue, current, matches: same(clue, current) };
  };
  const rows = clues.rows.map((clue, i) => line(clue, grid[i] ?? []));
  const columns = clues.columns.map((clue, c) => line(clue, column(grid, c)));
  return {
    solved: rows.every((r) => r.matches) && columns.every((c) => c.matches),
    rows,
    columns,
  };
}

/**
 * Every way to mend the torn cells that fits all the numbers (for integrity
 * checks: a fair puzzle has exactly one). Stops after `limit` answers.
 */
export function nettingSolutions(puzzle: NettingPuzzle, limit = 2): string[][] {
  const clues = netClues(puzzle);
  const width = puzzle.pattern[0]?.length ?? 0;
  const rowOptions = puzzle.pattern.map((row, r) => {
    const torn = [...row].map((_, c) => c).filter((c) => isTorn(puzzle, r, c));
    const options: boolean[][] = [];
    for (let m = 0; m < 1 << torn.length; m++) {
      const cells = [...row].map((ch) => ch === '#');
      torn.forEach((c, i) => (cells[c] = ((m >> i) & 1) === 1));
      if (same(runsOf(cells), clues.rows[r] ?? [])) options.push(cells);
    }
    return options;
  });
  const found: string[][] = [];
  const chosen: boolean[][] = [];
  const search = (r: number): void => {
    if (found.length >= limit) return;
    if (r === rowOptions.length) {
      const ok = Array.from({ length: width }, (_, c) => c).every((c) =>
        same(runsOf(column(chosen, c)), clues.columns[c] ?? []),
      );
      if (ok) found.push(chosen.map((cells) => cells.map((k) => (k ? '#' : '.')).join('')));
      return;
    }
    for (const option of rowOptions[r] ?? []) {
      chosen[r] = option;
      search(r + 1);
    }
    chosen.length = r;
  };
  search(0);
  return found;
}

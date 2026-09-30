import { z } from 'zod';
import { PuzzleBase } from './puzzle-base';

/**
 * Colour mixing: dip a skein, one bath at a time, to reach a target shade
 * within a limited number of dips. A shade is a level of each dye colour
 * (0 to `max`); each bath changes the levels (a dye bath adds, a rinse takes
 * some out). Shades have names as well as numbers, so nothing depends on
 * seeing colour. The model is a simplification made up for the game.
 */
const id = z.string().min(1);
export const DyeingPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('dyeing'),
  /** The dye colours that make up a shade, e.g. red and blue. */
  colours: z.array(z.object({ id, label: z.string().min(1) })).min(1),
  max: z.number().int().positive(),
  baths: z
    .array(
      z.object({
        id,
        label: z.string().min(1),
        description: z.string().min(1),
        change: z.record(z.string(), z.number().int()),
      }),
    )
    .min(2),
  target: z.record(z.string(), z.number().int().nonnegative()),
  maxDips: z.number().int().positive(),
  /** Names for shades; a shade without one is described by its levels. */
  shades: z
    .array(z.object({ name: z.string().min(1), levels: z.record(z.string(), z.number().int()) }))
    .default([]),
});
export type DyeingPuzzle = z.infer<typeof DyeingPuzzleSchema>;

export type Shade = Readonly<Record<string, number>>;

export function undyed(puzzle: DyeingPuzzle): Shade {
  return Object.fromEntries(puzzle.colours.map((c) => [c.id, 0]));
}

export function applyDip(puzzle: DyeingPuzzle, shade: Shade, bathId: string): Shade {
  const bath = puzzle.baths.find((b) => b.id === bathId);
  if (!bath) throw new Error(`Unknown bath ${bathId}`);
  return Object.fromEntries(
    puzzle.colours.map((c) => [
      c.id,
      Math.max(0, Math.min(puzzle.max, (shade[c.id] ?? 0) + (bath.change[c.id] ?? 0))),
    ]),
  );
}

export function shadeAfter(puzzle: DyeingPuzzle, dips: readonly string[]): Shade {
  return dips.reduce((s, b) => applyDip(puzzle, s, b), undyed(puzzle));
}

export function sameShade(puzzle: DyeingPuzzle, a: Shade, b: Shade): boolean {
  return puzzle.colours.every((c) => (a[c.id] ?? 0) === (b[c.id] ?? 0));
}

/** "red 3, blue 2" */
export function describeLevels(puzzle: DyeingPuzzle, shade: Shade): string {
  return puzzle.colours.map((c) => `${c.label} ${shade[c.id] ?? 0}`).join(', ');
}

/** The shade's name, or null if it has none. */
export function shadeName(puzzle: DyeingPuzzle, shade: Shade): string | null {
  return puzzle.shades.find((s) => sameShade(puzzle, s.levels, shade))?.name ?? null;
}

export interface DyeingCheck {
  shade: Shade;
  solved: boolean;
  dipsLeft: number;
}

export function checkDyeing(puzzle: DyeingPuzzle, dips: readonly string[]): DyeingCheck {
  const shade = shadeAfter(puzzle, dips);
  return {
    shade,
    solved: dips.length <= puzzle.maxDips && sameShade(puzzle, shade, puzzle.target),
    dipsLeft: Math.max(0, puzzle.maxDips - dips.length),
  };
}

/** The shortest dip sequences that reach the target (breadth first), for integrity checks. */
export function shortestDyeings(puzzle: DyeingPuzzle): string[][] {
  let frontier: string[][] = [[]];
  for (let n = 0; n <= puzzle.maxDips; n++) {
    const hits = frontier.filter((d) => sameShade(puzzle, shadeAfter(puzzle, d), puzzle.target));
    if (hits.length > 0) return hits;
    frontier = frontier.flatMap((d) => puzzle.baths.map((b) => [...d, b.id]));
  }
  return [];
}

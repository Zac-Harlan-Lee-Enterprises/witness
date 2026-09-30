import { z } from 'zod';
import { PuzzleBase } from './puzzle-base';

/**
 * Map reading: follow written directions across a sketch map to the right
 * place. The map is a grid: '.' is open country (not walkable), any other
 * character is road; a landmark sits on a road cell. The walker moves by
 * compass direction, and walks on until something worth stopping for (a
 * landmark, a junction, a bend or a dead end). Directions are written from
 * the walker's point of view ("turn left"), so reading the map means turning
 * them into north, south, east and west.
 */
const id = z.string().min(1);
export const DIRECTIONS = ['north', 'east', 'south', 'west'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const MapPuzzleSchema = z.object({
  ...PuzzleBase,
  type: z.literal('map'),
  map: z.array(z.string().min(1)).min(2),
  landmarks: z
    .array(z.object({ id, label: z.string().min(1), x: z.number().int(), y: z.number().int() }))
    .min(2),
  start: z.object({ x: z.number().int(), y: z.number().int(), facing: z.enum(DIRECTIONS) }),
  goal: id,
  /** The directions, as written. */
  directions: z.array(z.string().min(1)).min(1),
  /** What to say when the player stops at the wrong landmark. */
  wrongStops: z.record(z.string(), z.string()).default({}),
});
export type MapPuzzle = z.infer<typeof MapPuzzleSchema>;

export interface MapPosition {
  x: number;
  y: number;
  facing: Direction;
}

const STEP: Record<Direction, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};

export function isRoad(puzzle: MapPuzzle, x: number, y: number): boolean {
  const ch = puzzle.map[y]?.[x];
  return ch !== undefined && ch !== '.';
}

export function landmarkAt(puzzle: MapPuzzle, x: number, y: number) {
  return puzzle.landmarks.find((l) => l.x === x && l.y === y) ?? null;
}

/** The directions you can walk from here. */
export function exitsFrom(puzzle: MapPuzzle, x: number, y: number): Direction[] {
  return DIRECTIONS.filter((d) => isRoad(puzzle, x + STEP[d][0], y + STEP[d][1]));
}

export interface WalkResult {
  position: MapPosition;
  /** Cells walked through, including where you stopped. */
  steps: number;
}

/**
 * Walk from `from` in direction `dir` until reaching a landmark, a junction,
 * a bend or a dead end. Returns null if there is no road that way.
 */
export function walk(puzzle: MapPuzzle, from: MapPosition, dir: Direction): WalkResult | null {
  let x = from.x;
  let y = from.y;
  let steps = 0;
  for (;;) {
    const nx = x + STEP[dir][0];
    const ny = y + STEP[dir][1];
    if (!isRoad(puzzle, nx, ny)) break;
    x = nx;
    y = ny;
    steps++;
    if (landmarkAt(puzzle, x, y)) break;
    const exits = exitsFrom(puzzle, x, y);
    if (exits.length !== 2 || !exits.includes(dir)) break;
  }
  return steps === 0 ? null : { position: { x, y, facing: dir }, steps };
}

export interface MapCheck {
  correct: boolean;
  feedback: string;
}

export function checkMapStop(puzzle: MapPuzzle, at: { x: number; y: number }): MapCheck {
  const landmark = landmarkAt(puzzle, at.x, at.y);
  if (landmark?.id === puzzle.goal) return { correct: true, feedback: 'This is the place.' };
  if (landmark)
    return {
      correct: false,
      feedback:
        puzzle.wrongStops[landmark.id] ??
        `This is ${landmark.label}. Read the directions again from the start.`,
    };
  return {
    correct: false,
    feedback: 'There is nothing here but the road. Where do the directions take you?',
  };
}

/** Relative turn words for a heading: what "left" and "right" mean when facing `facing`. */
export function turnedTo(facing: Direction, turn: 'left' | 'right' | 'back'): Direction {
  const i = DIRECTIONS.indexOf(facing);
  const by = turn === 'right' ? 1 : turn === 'back' ? 2 : 3;
  return DIRECTIONS[(i + by) % 4] as Direction;
}

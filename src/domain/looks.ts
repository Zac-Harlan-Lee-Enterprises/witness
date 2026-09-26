import { evaluate } from './conditions';
import type { Direction, GameState } from './state/game-state';
import type { Look, LookMark, PlayerLook, Pose } from './world';

/**
 * How someone appears right now: their base pose and facing, changed by
 * every look whose condition holds. Later looks override pose and facing;
 * marks accumulate in first-seen order without duplicates. Pure and
 * deterministic, so every visible consequence of a choice is testable.
 */
export interface ResolvedLook {
  pose: Pose;
  facing: Direction;
  marks: LookMark[];
}

export function resolveLook(
  base: { pose: Pose; facing: Direction },
  looks: readonly Look[],
  state: GameState,
): ResolvedLook {
  let { pose, facing } = base;
  const marks: LookMark[] = [];
  for (const look of looks) {
    if (!evaluate(look.when, state)) continue;
    if (look.pose) pose = look.pose;
    if (look.facing) facing = look.facing;
    for (const mark of look.marks) if (!marks.includes(mark)) marks.push(mark);
  }
  return { pose, facing, marks };
}

/** The marks the player shows (what they carry, what they tore or gave away). */
export function playerMarks(looks: readonly PlayerLook[], state: GameState): LookMark[] {
  return resolveLook({ pose: 'stand', facing: 'down' }, looks, state).marks;
}

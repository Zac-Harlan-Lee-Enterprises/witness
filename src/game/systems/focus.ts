import type { Direction } from '@/domain/state/game-state';

/**
 * Picks which nearby interactive thing the player is "looking at". Prefers
 * the thing in front of the player; falls back to the nearest within reach,
 * so precise positioning is never required.
 */
export interface FocusCandidate {
  id: string;
  x: number;
  y: number;
}

/** Generous enough that standing diagonally next to someone counts as "near". */
export const REACH = 1.9;

export function pickFocus(
  player: { x: number; y: number; facing: Direction },
  candidates: readonly FocusCandidate[],
  reach = REACH,
): string | null {
  const facingVec: Record<Direction, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const [fx, fy] = facingVec[player.facing];
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const dx = c.x + 0.5 - player.x;
    const dy = c.y + 0.5 - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > reach) continue;
    const alignment = dist === 0 ? 1 : (dx * fx + dy * fy) / dist; // -1..1
    const score = dist - alignment * 0.6;
    if (!best || score < best.score) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

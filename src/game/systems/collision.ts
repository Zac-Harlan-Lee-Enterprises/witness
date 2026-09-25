import type { Blocked } from '@/domain/navigation';

/**
 * Continuous movement with axis-separated tile collision. Positions are in
 * TILE units; (x, y) is the player's feet, so the tile under the feet is
 * (floor(x), floor(y)). Pure and Phaser-free for unit testing.
 */
export interface Vec {
  x: number;
  y: number;
}

/** Feet hitbox half-extents (tiles). Slightly narrower than a tile so doorways feel generous. */
export const HALF_W = 0.3;
export const HALF_H = 0.22;

export function overlapsSolid(pos: Vec, blocked: Blocked): boolean {
  const minX = Math.floor(pos.x - HALF_W);
  const maxX = Math.floor(pos.x + HALF_W - 1e-6);
  const minY = Math.floor(pos.y - HALF_H);
  const maxY = Math.floor(pos.y + HALF_H - 1e-6);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (blocked(tx, ty)) return true;
    }
  }
  return false;
}

/** Move by (dx, dy), sliding along walls. */
export function moveWithCollision(pos: Vec, dx: number, dy: number, blocked: Blocked): Vec {
  let next = { ...pos };
  if (dx !== 0) {
    const tryX = { x: next.x + dx, y: next.y };
    if (!overlapsSolid(tryX, blocked)) next = tryX;
  }
  if (dy !== 0) {
    const tryY = { x: next.x, y: next.y + dy };
    if (!overlapsSolid(tryY, blocked)) next = tryY;
  }
  return next;
}

/** Normalise a direction so diagonal movement is not faster. */
export function normalise(dx: number, dy: number): Vec {
  const len = Math.hypot(dx, dy);
  return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
}

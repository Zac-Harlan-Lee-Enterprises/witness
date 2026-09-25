import { describe, expect, it } from 'vitest';
import { moveWithCollision, normalise, overlapsSolid } from '@/game/systems/collision';
import { pickFocus } from '@/game/systems/focus';

// A 5×5 room with walls on the border and a pillar at (2,2).
const blocked = (x: number, y: number) =>
  x <= 0 || y <= 0 || x >= 4 || y >= 4 || (x === 2 && y === 2);

describe('collision', () => {
  it('stops at walls and slides along them', () => {
    const start = { x: 1.5, y: 1.5 };
    expect(moveWithCollision(start, -1, 0, blocked)).toEqual(start); // wall to the left
    // Pressed against the left wall, a diagonal move slides down the wall.
    const slid = moveWithCollision({ x: 1.35, y: 1.5 }, -0.2, 0.3, blocked);
    expect(slid.x).toBe(1.35);
    expect(slid.y).toBeCloseTo(1.8);
    expect(overlapsSolid({ x: 2.5, y: 2.5 }, blocked)).toBe(true);
  });
  it('normalises diagonal movement', () => {
    const d = normalise(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(normalise(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('interaction focus', () => {
  const things = [
    { id: 'left', x: 0, y: 2 },
    { id: 'right', x: 3, y: 2 },
    { id: 'far', x: 9, y: 9 },
  ];
  it('prefers what the player is facing, within reach', () => {
    expect(pickFocus({ x: 2, y: 2.5, facing: 'right' }, things)).toBe('right');
    expect(pickFocus({ x: 1.6, y: 2.5, facing: 'left' }, things)).toBe('left');
    expect(pickFocus({ x: 6, y: 6, facing: 'up' }, things)).toBeNull();
    // Diagonal neighbours count as near, wherever the player stands in their tile.
    expect(pickFocus({ x: 4.7, y: 1.3, facing: 'up' }, [{ id: 'npc', x: 3, y: 2 }])).toBe('npc');
  });
});

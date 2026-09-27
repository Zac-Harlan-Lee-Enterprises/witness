import { describe, expect, it } from 'vitest';
import { hawkGlide, headingRotation } from '@/game/systems/flight';

/** Where a sprite drawn nose-up points after a rotation (screen y grows down). */
function nose(rotation: number): { x: number; y: number } {
  return { x: Math.sin(rotation), y: -Math.cos(rotation) };
}

describe('a bird’s shadow flies head first', () => {
  it('turns a nose-up sprite to face the way it travels', () => {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [3, 1],
      [-2, 1.5],
    ] as const) {
      const n = nose(headingRotation(dx, dy));
      const len = Math.hypot(dx, dy);
      expect(n.x).toBeCloseTo(dx / len);
      expect(n.y).toBeCloseTo(dy / len);
    }
  });

  it('glides across the view head first, from either side (never wingtip first)', () => {
    const view = { x: 100, y: 50, width: 800, height: 600 };
    for (const fromLeft of [true, false]) {
      const g = hawkGlide(view, fromLeft, 0.5);
      // It crosses the whole view, starting and ending out of sight.
      expect(fromLeft ? g.from.x < view.x : g.from.x > view.x + view.width).toBe(true);
      expect(fromLeft ? g.to.x > view.x + view.width : g.to.x < view.x).toBe(true);
      const n = nose(g.rotation);
      const dx = g.to.x - g.from.x;
      const dy = g.to.y - g.from.y;
      const len = Math.hypot(dx, dy);
      expect(n.x).toBeCloseTo(dx / len);
      expect(n.y).toBeCloseTo(dy / len);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { stickDeflection, VirtualInput } from '@/application/input';

describe('VirtualInput directions', () => {
  it('keys walk at full pace; diagonals are no faster', () => {
    const input = new VirtualInput();
    input.press('keyboard', 'right');
    expect(input.direction()).toEqual({ dx: 1, dy: 0 });
    input.press('keyboard', 'down');
    const { dx, dy } = input.direction();
    expect(Math.hypot(dx, dy)).toBeCloseTo(1);
    expect(dx).toBeCloseTo(dy);
  });

  it('a stick sets the pace by its tilt, and (0, 0) lets go', () => {
    const input = new VirtualInput();
    input.setAxis('touch', 0.5, 0);
    expect(input.direction()).toEqual({ dx: 0.5, dy: 0 });
    input.setAxis('touch', 0, -0.25);
    expect(input.direction()).toEqual({ dx: 0, dy: -0.25 });
    input.setAxis('touch', 0, 0);
    expect(input.direction()).toEqual({ dx: 0, dy: 0 });
  });

  it('keys and a stick together never exceed full pace', () => {
    const input = new VirtualInput();
    input.press('keyboard', 'right');
    input.setAxis('touch', 1, 0);
    expect(input.direction()).toEqual({ dx: 1, dy: 0 });
  });

  it('releaseAll lets go of a source’s stick as well as its keys', () => {
    const input = new VirtualInput();
    input.setAxis('touch', 1, 0);
    input.press('touch', 'down');
    input.setAxis('gamepad', 0, 1);
    input.releaseAll('touch');
    expect(input.direction()).toEqual({ dx: 0, dy: 1 });
    input.releaseAll();
    expect(input.direction()).toEqual({ dx: 0, dy: 0 });
  });
});

describe('stickDeflection (the floating stick)', () => {
  const base = { x: 100, y: 100 };
  const radius = 50;
  const dead = 10;

  it('does nothing inside the dead zone (a tap is not a step)', () => {
    const s = stickDeflection(base, { x: 108, y: 100 }, radius, dead);
    expect(s.x).toBe(0);
    expect(s.y).toBe(0);
    expect(s.base).toEqual(base);
    expect(s.knob).toEqual({ x: 108, y: 100 });
  });

  it('rises from the dead zone to full pace at the rim', () => {
    const half = stickDeflection(base, { x: 130, y: 100 }, radius, dead);
    expect(half.x).toBeCloseTo(0.5);
    expect(half.y).toBe(0);
    const rim = stickDeflection(base, { x: 100, y: 150 }, radius, dead);
    expect(rim.x).toBe(0);
    expect(rim.y).toBeCloseTo(1);
    const diagonal = stickDeflection(base, { x: 100 - 50, y: 100 - 50 }, radius, dead);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(diagonal.x).toBeCloseTo(diagonal.y);
    expect(diagonal.x).toBeLessThan(0);
  });

  it('drags the base along behind a thumb past the rim, the knob at the rim', () => {
    const s = stickDeflection(base, { x: 220, y: 100 }, radius, dead);
    expect(s.base).toEqual({ x: 170, y: 100 });
    expect(s.knob).toEqual({ x: 220, y: 100 });
    expect(s.x).toBeCloseTo(1);
    expect(s.y).toBe(0);
    // Coming back the other way steers from the new base.
    const back = stickDeflection(s.base, { x: 140, y: 100 }, radius, dead);
    expect(back.base).toEqual({ x: 170, y: 100 });
    expect(back.x).toBeCloseTo(-0.5);
  });
});

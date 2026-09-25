import { describe, expect, it } from 'vitest';
import { gradeColors, lightingFor } from '@/game/systems/lighting';

describe('time-of-day lighting', () => {
  it('follows the story clock from morning to night', () => {
    expect([6, 8, 12, 16, 17, 18, 21, 2].map((h) => lightingFor(h, false).label)).toEqual([
      'dawn',
      'early morning',
      'day',
      'golden afternoon',
      'sunset',
      'dusk',
      'night',
      'night',
    ]);
  });
  it('is darker at night, and only then does a lamp glow', () => {
    expect(lightingFor(21, false).night).toBe(true);
    expect(lightingFor(12, false).night).toBe(false);
    expect(lightingFor(21, false).alpha).toBeGreaterThan(lightingFor(12, false).alpha);
  });
  it('keeps interiors warm regardless of the hour, and copes with chapters without a clock', () => {
    expect(lightingFor(22, true)).toMatchObject({ label: 'indoor', night: false });
    expect(lightingFor(null, false).label).toBe('day');
  });
});

describe('single-layer colour grade', () => {
  it('matches a tint overlay in the middle and darkens toward the edges', () => {
    const night = lightingFor(22, false);
    const { center, edge } = gradeColors(night);
    // 0x243366 at 0.52 over white.
    expect(center).toEqual([141, 149, 175]);
    expect(edge[0]).toBeLessThan(center[0]);
    expect(edge.every((c, i) => c <= (center[i] ?? 0))).toBe(true);
  });
  it('leaves daylight almost untouched in the middle', () => {
    const { center } = gradeColors(lightingFor(12, false));
    center.forEach((c) => expect(c).toBeGreaterThan(245));
  });
});

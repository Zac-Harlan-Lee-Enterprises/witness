import { describe, expect, it } from 'vitest';
import { takesPuddles, takesSplashes } from '@/game/fx/weather-ground';

describe('where rain lands', () => {
  it("gathers puddles on every chapter's hard ground", () => {
    for (const kind of ['paving', 'road', 'floor', 'deck', 'jetty', 'shingle'] as const)
      expect(takesPuddles(kind), kind).toBe(true);
    // Chapter 4's Roman road, bridge and mosaic floors (code review: they had none).
    for (const kind of ['roman-road', 'bridge', 'mosaic'] as const)
      expect(takesPuddles(kind), kind).toBe(true);
    expect(takesPuddles('grass')).toBe(false);
    expect(takesPuddles('lake')).toBe(false);
  });

  it('splashes on the ground but never on open water or beyond the map', () => {
    expect(takesSplashes('paving')).toBe(true);
    expect(takesSplashes('deck')).toBe(true);
    for (const kind of ['water', 'lake', 'shallows', 'void'] as const)
      expect(takesSplashes(kind), kind).toBe(false);
  });
});

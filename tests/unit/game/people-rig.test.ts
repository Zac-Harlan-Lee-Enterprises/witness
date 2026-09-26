import { describe, expect, it } from 'vitest';
import {
  BUILDS,
  footPhase,
  FRAME,
  frameSpec,
  headTop,
  isFootfall,
  rigFor,
  WALK_FRAMES,
  walkBob,
  walkColumn,
  seatDrop,
} from '@/game/art/people/rig';

describe('the walk cycle', () => {
  it('plants a foot in stance and lifts it in swing', () => {
    expect(footPhase(0.1, 5, 3).lift).toBe(0);
    expect(footPhase(0.75, 5, 3).lift).toBeGreaterThan(2.9);
    // In stance the foot travels back under the body; in swing it comes forward.
    expect(footPhase(0.0, 5, 3).u).toBeGreaterThan(footPhase(0.4, 5, 3).u);
    expect(footPhase(0.6, 5, 3).u).toBeLessThan(footPhase(0.9, 5, 3).u);
  });

  it('is lowest at contact and highest when passing', () => {
    expect(walkBob(0, 1)).toBeCloseTo(0);
    expect(walkBob(0.25, 1)).toBeCloseTo(-1);
    expect(walkBob(0.5, 1)).toBeCloseTo(0);
  });

  it('alternates the feet: one is always on the ground', () => {
    for (let f = 0; f < WALK_FRAMES; f++) {
      const rig = rigFor('adult', 'right', frameSpec(FRAME.walk + f));
      expect(Math.min(rig.feet[0].lift, rig.feet[1].lift)).toBe(0);
    }
  });

  it('keeps feet in step with the ground and sounds a footfall at each contact', () => {
    expect(walkColumn(0, 1.5)).toBe(FRAME.walk);
    expect(walkColumn(0.75, 1.5)).toBe(FRAME.walk + WALK_FRAMES / 2);
    expect(walkColumn(1.5, 1.5)).toBe(FRAME.walk);
    expect(isFootfall(FRAME.walk)).toBe(true);
    expect(isFootfall(FRAME.walk + 4)).toBe(true);
    expect(isFootfall(FRAME.walk + 2)).toBe(false);
    expect(isFootfall(FRAME.idle)).toBe(false);
  });

  it('gives adults natural proportions (about six and a half heads, drawn a little large to read) and children fewer', () => {
    expect(BUILDS.adult.height / BUILDS.adult.head).toBeGreaterThan(6.25);
    expect(BUILDS.child.height / BUILDS.child.head).toBeLessThan(
      BUILDS.adult.height / BUILDS.adult.head,
    );
  });
});

describe('how tall someone is, for marks drawn over them', () => {
  it('follows the rig: a standing adult is about their full height, head cloth included', () => {
    expect(headTop('adult', false)).toBeGreaterThanOrEqual(BUILDS.adult.height);
    expect(headTop('adult', false)).toBeLessThan(BUILDS.adult.height + BUILDS.adult.head / 2);
    expect(headTop('child', false)).toBeLessThan(headTop('adult', false));
  });

  it('lowers a seated person by the seat drop, so the talk symbol clears their head', () => {
    for (const build of ['adult', 'child', 'elder'] as const) {
      expect(headTop(build, true)).toBeCloseTo(headTop(build, false) - seatDrop(BUILDS[build]));
    }
    // Regression: marks over a seated adult were placed as if they were 34
    // units tall above the tile line; their head (plus the 7-unit seat offset)
    // reaches higher, so the symbol sat on their face.
    expect(headTop('adult', true) + 7).toBeGreaterThan(34);
  });
});

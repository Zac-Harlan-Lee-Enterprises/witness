import { describe, expect, it } from 'vitest';
import {
  conversationCentre,
  framingFor,
  LOOK_AHEAD,
  stepLookAhead,
  zoomFor,
} from '@/game/systems/camera';
import {
  crowdSize,
  departed,
  crowdSpots,
  faceToward,
  mouthOpen,
  nextBlinkDelay,
  noticesPlayer,
  passerBy,
  startles,
} from '@/game/systems/life';
import { AppearanceSchema } from '@/domain/characters';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe('camera direction', () => {
  it('frames about 15 tiles across on a laptop and fewer, larger tiles on a phone', () => {
    expect(zoomFor(1280, 720)).toBeCloseTo(2.25, 1);
    expect(zoomFor(412, 915)).toBeGreaterThanOrEqual(1.5);
    expect(zoomFor(412, 915) * 32 * 8.5).toBeLessThanOrEqual(412 + 32);
  });

  it('leans ahead while walking and settles back when you stop', () => {
    let o = { x: 0, y: 0 };
    for (let i = 0; i < 120; i++) o = stepLookAhead(o, { x: 1, y: 0 }, 1 / 60);
    expect(o.x).toBeGreaterThan(LOOK_AHEAD * 0.8);
    expect(o.x).toBeLessThanOrEqual(LOOK_AHEAD);
    for (let i = 0; i < 240; i++) o = stepLookAhead(o, { x: 0, y: 0 }, 1 / 60);
    expect(Math.abs(o.x)).toBeLessThan(1);
  });

  it('frames a conversation above the dialogue box', () => {
    const c = conversationCentre({ x: 100, y: 100 }, { x: 200, y: 100 }, 400, 0.4);
    expect(c.x).toBeCloseTo(145);
    expect(c.y).toBeCloseTo(180); // both people end up in the upper part of the view
  });
});

describe('signs of life', () => {
  it('people notice you nearby and turn toward you', () => {
    expect(noticesPlayer({ x: 5, y: 5 }, { x: 6.5, y: 6.5 })).toBe(true);
    expect(noticesPlayer({ x: 5, y: 5 }, { x: 10, y: 5 })).toBe(false);
    expect(faceToward({ x: 5, y: 5 }, { x: 8, y: 5.5 })).toBe('right');
    expect(faceToward({ x: 5, y: 5 }, { x: 5.5, y: 2 })).toBe('up');
  });

  it('blinks at uneven intervals and talks in an uneven rhythm', () => {
    expect(nextBlinkDelay(() => 0)).toBeGreaterThan(2000);
    expect(nextBlinkDelay(() => 0.99)).toBeLessThan(6000);
    const frames = Array.from({ length: 28 }, (_, i) => mouthOpen(i * 110));
    expect(frames.filter(Boolean).length).toBeGreaterThan(8);
    expect(frames.filter((f) => !f).length).toBeGreaterThan(8);
  });

  it('crowds the market, leaves the wilderness empty, and thins crowds on slow devices', () => {
    expect(crowdSize('city', false)).toBeGreaterThan(crowdSize('oasis', false));
    expect(crowdSize('wilderness', false)).toBe(0);
    expect(crowdSize('home', false)).toBe(0);
    expect(crowdSize('city', true)).toBeLessThan(crowdSize('city', false));
  });

  it('dresses passers-by as valid people', () => {
    const r = seq([0.1, 0.5, 0.9, 0.3, 0.7, 0.2]);
    for (let i = 0; i < 8; i++) expect(() => AppearanceSchema.parse(passerBy(i, r))).not.toThrow();
  });

  it('keeps passers-by away from people, clues and exits', () => {
    const open = (x: number, y: number) => x >= 1 && y >= 1 && x <= 10 && y <= 10;
    const keep = [{ x: 5, y: 5 }];
    const spots = crowdSpots(open, 12, 12, keep, seq([0.13, 0.57, 0.91, 0.33, 0.71]), 4);
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(open(s.x, s.y)).toBe(true);
      expect(Math.abs(s.x - 5) > 1 || Math.abs(s.y - 5) > 1).toBe(true);
    }
  });

  it('pigeons take off only when you come close', () => {
    expect(startles({ x: 5, y: 5 }, { x: 5.5, y: 6 })).toBe(true);
    expect(startles({ x: 5, y: 5 }, { x: 9, y: 5 })).toBe(false);
  });
});

describe('people leaving a scene', () => {
  it('removes someone who is no longer present (e.g. Menashe walking on with you)', () => {
    expect(departed(['miriam', 'menashe-road'], [{ id: 'miriam' }])).toEqual(['menashe-road']);
    expect(departed(['miriam'], [{ id: 'miriam' }, { id: 'new' }])).toEqual([]);
  });
});

describe('camera framing', () => {
  it('brings people and materials closer with the close framing, on every screen', () => {
    for (const [w, h] of [
      [1280, 720],
      [1920, 1080],
      [820, 1180],
      [412, 915],
    ] as const) {
      const standard = zoomFor(w, h, 'standard');
      const close = zoomFor(w, h, 'close');
      // Closer wherever the zoom isn't already at its limit.
      if (standard < 3.25) expect(close).toBeGreaterThan(standard);
      else expect(close).toBe(standard);
      expect(close).toBeLessThanOrEqual(3.25);
    }
  });

  it('still shows several tiles in every direction when close', () => {
    const zoom = zoomFor(1280, 720, 'close');
    expect(1280 / (zoom * 32)).toBeGreaterThanOrEqual(11);
    expect(720 / (zoom * 32)).toBeGreaterThanOrEqual(7);
  });
});

describe('framing by place', () => {
  it('comes close only where the art has the resolution for it', () => {
    expect(framingFor('close', 3)).toBe('close');
    expect(framingFor('close', 2)).toBe('standard');
    expect(framingFor('standard', 3)).toBe('standard');
  });
});

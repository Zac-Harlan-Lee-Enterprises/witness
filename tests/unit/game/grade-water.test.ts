import { describe, expect, it } from 'vitest';
import type { TileGrid, TileKind } from '@/domain/world';
import { gradeFor, type GradeInput } from '@/game/systems/grade';
import { gradeColors, lightingFor } from '@/game/systems/lighting';
import { sunForWater, waterLook, waterRegions, waterSky } from '@/game/systems/water';
import { CALM, WEATHER_MIX } from '@/game/systems/weather';

const base: GradeInput = {
  mood: 'city',
  hour: 12,
  indoor: false,
  weather: CALM,
  wet: 0,
  highContrast: false,
  reducedMotion: false,
};

describe('post-processing grade', () => {
  it('stays close to the art in fair weather (a finish, not a filter)', () => {
    const g = gradeFor(base);
    expect(g.exposure).toBeCloseTo(1, 1);
    expect(Math.abs(g.contrast - 1)).toBeLessThan(0.1);
    expect(Math.abs(g.saturation - 1)).toBeLessThan(0.1);
    g.gain.forEach((c) => expect(Math.abs(c - 1)).toBeLessThan(0.1));
  });

  it('warms golden afternoons and cools and dims nights', () => {
    const golden = gradeFor({ ...base, hour: 16 });
    expect(golden.gain[0]).toBeGreaterThan(golden.gain[2]);
    const night = gradeFor({ ...base, hour: 22 });
    expect(night.gain[2]).toBeGreaterThan(night.gain[0]);
    expect(night.saturation).toBeLessThan(gradeFor(base).saturation);
  });

  it('lets lamplight glow in a room at night', () => {
    const night = gradeFor({ ...base, mood: 'home', indoor: true, hour: 21 });
    const day = gradeFor({ ...base, mood: 'home', indoor: true, hour: 10 });
    expect(night.bloom).toBeGreaterThan(day.bloom);
    expect(night.saturation).toBeLessThan(day.saturation);
  });

  it('lets lamps and fire bloom more at night than the sun does by day', () => {
    const night = gradeFor({ ...base, hour: 22 });
    const day = gradeFor(base);
    expect(night.bloom).toBeGreaterThan(day.bloom);
    expect(night.threshold).toBeLessThan(day.threshold);
  });

  it('flattens, cools and darkens the light under storm cloud', () => {
    const storm = gradeFor({ ...base, weather: WEATHER_MIX.storm });
    const clear = gradeFor(base);
    expect(storm.saturation).toBeLessThan(clear.saturation);
    expect(storm.exposure).toBeLessThan(clear.exposure);
    expect(storm.gain[2]).toBeGreaterThan(storm.gain[0]);
    expect(storm.bloom).toBeLessThan(clear.bloom);
  });

  it('makes wet ground darker and richer after rain, outdoors only', () => {
    const dry = gradeFor(base);
    const wet = gradeFor({ ...base, wet: 1 });
    expect(wet.exposure).toBeLessThan(dry.exposure);
    expect(wet.saturation).toBeGreaterThan(dry.saturation);
    expect(gradeFor({ ...base, indoor: true, wet: 1 })).toEqual(
      gradeFor({ ...base, indoor: true }),
    );
  });

  it('shimmers with heat only in the open wilderness at midday, and never with reduced motion', () => {
    const noon = { ...base, mood: 'wilderness' as const, hour: 12 };
    expect(gradeFor(noon).haze).toBeGreaterThan(0);
    expect(gradeFor({ ...noon, hour: 8 }).haze).toBe(0);
    expect(gradeFor({ ...noon, reducedMotion: true }).haze).toBe(0);
    expect(gradeFor({ ...noon, weather: WEATHER_MIX.storm }).haze).toBe(0);
    expect(gradeFor(base).haze).toBe(0);
  });

  it('keeps the world bright and clear in high contrast, whatever the weather', () => {
    for (const weather of [CALM, WEATHER_MIX.rain, WEATHER_MIX.storm]) {
      const g = gradeFor({ ...base, weather, highContrast: true });
      expect(g.exposure).toBeGreaterThanOrEqual(1);
      expect(g.contrast).toBeGreaterThanOrEqual(1.08);
      expect(g.saturation).toBeGreaterThanOrEqual(1);
      expect(g.haze).toBe(0);
    }
  });
});

describe('light layer with the sky', () => {
  it('multiplies the sky over the time of day, and darkens more at the edges', () => {
    const l = lightingFor(12, false);
    const clear = gradeColors(l);
    const stormy = gradeColors(l, { tint: 0x5a667e, alpha: 0.44, vignette: 0.2 });
    stormy.center.forEach((c, i) => expect(c).toBeLessThan(clear.center[i] ?? 0));
    stormy.edge.forEach((c, i) => expect(c).toBeLessThan(stormy.center[i] ?? 0));
    // No sky: exactly the old single-layer grade.
    expect(gradeColors(l, { tint: 0xffffff, alpha: 0, vignette: 0 })).toEqual(clear);
  });
});

function grid(rows: string[]): TileGrid {
  const kinds: Record<string, TileKind> = {
    '~': 'water',
    '.': 'sand',
    W: 'well',
    L: 'lake',
    s: 'shallows',
    ':': 'shingle',
    h: 'hull',
    d: 'deck',
  };
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    tiles: rows.map((r) => [...r].map((c) => kinds[c] ?? 'sand')),
  };
}

describe('water', () => {
  it('finds each body of water and which tiles of it are wet', () => {
    const regions = waterRegions(grid(['.~~..', '.~...', '....~', '..~~~']));
    expect(regions).toHaveLength(2);
    const [pool, spring] = regions;
    expect(pool).toMatchObject({ x: 2, y: 2, w: 3, h: 2, tiles: 4 });
    expect(pool?.mask).toEqual([false, false, true, true, true, true]);
    expect(spring).toMatchObject({ x: 1, y: 0, w: 2, h: 2, tiles: 3 });
  });

  it('finds the lake and its shallows as water too', () => {
    const lake = grid(['::ssLL', ':ssLLL', '..hhdd']);
    const regions = waterRegions(lake);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.tiles).toBe(9);
  });

  it('reflects a sky that matches the light: pale by day, violet at dusk, dark at night', () => {
    const day = waterSky('late');
    const dusk = waterSky('dusk');
    const night = waterSky('night');
    const lum = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);
    expect(lum(night.sky)).toBeLessThan(lum(dusk.sky));
    expect(lum(dusk.sky)).toBeLessThan(lum(day.sky));
    expect(lum(night.deep)).toBeLessThan(lum(day.deep));
    // Art rendered at dusk or by night has no sun in it to glint.
    expect(sunForWater(18, 'dusk').height).toBe(0);
    expect(sunForWater(16, 'night').height).toBe(0);
  });

  it('has no water where there is none', () => {
    expect(waterRegions(grid(['..W..', '.....']))).toEqual([]);
  });

  it('puts the sun where the art has it: east in the morning, west late, none at night', () => {
    expect(sunForWater(9, 'day').x).toBeGreaterThan(0);
    expect(sunForWater(16, 'late').x).toBeLessThan(0);
    expect(sunForWater(22, 'painted').height).toBe(0);
    expect(sunForWater(12, 'painted').height).toBeGreaterThan(sunForWater(7, 'painted').height);
    const s = sunForWater(10, 'painted');
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 5);
  });

  it('is calm and glinting in fair weather, rough, ringed and foaming in a storm', () => {
    const calm = waterLook(CALM, 0.8, { reducedMotion: false, still: false });
    const storm = waterLook(WEATHER_MIX.storm, 0.8, { reducedMotion: false, still: false });
    expect(calm.glints).toBeGreaterThan(0.9);
    expect(storm.glints).toBe(0);
    expect(storm.waves).toBeGreaterThan(calm.waves);
    expect(storm.rain).toBe(1);
    expect(storm.foam).toBeGreaterThan(0);
    expect(calm.foam).toBe(0);
  });

  it('stands still with reduced motion', () => {
    const still = waterLook(WEATHER_MIX.storm, 0.8, { reducedMotion: true, still: false });
    expect(still.waves + still.rain + still.foam).toBe(0);
  });
});

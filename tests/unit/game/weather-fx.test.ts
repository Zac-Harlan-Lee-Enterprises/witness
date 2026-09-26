import { describe, expect, it } from 'vitest';
import { rng } from '@/game/art/paint';
import {
  CALM,
  FlashGate,
  flashLevel,
  gust,
  lerpRgb,
  Lightning,
  MAX_FLASH,
  MAX_FLASHES_PER_SECOND,
  nextStrikeIn,
  overcast,
  rainSlant,
  sameSky,
  sameWeather,
  stepWeather,
  stepWetness,
  strikePattern,
  WEATHER_MIX,
  weatherBudget,
  type WeatherMix,
} from '@/game/systems/weather';

function ease(from: WeatherMix, to: WeatherMix, seconds: number, step = 1 / 60): WeatherMix {
  let m = from;
  for (let t = 0; t < seconds; t += step) m = stepWeather(m, to, step);
  return m;
}

describe('weather transitions', () => {
  it('names the look of every weather the story can ask for', () => {
    expect(WEATHER_MIX.clear).toEqual(CALM);
    expect(WEATHER_MIX.wind.wind).toBeGreaterThan(0.5);
    expect(WEATHER_MIX.wind.rain).toBe(0);
    expect(WEATHER_MIX.rain.rain).toBeGreaterThan(0.5);
    expect(WEATHER_MIX.storm).toEqual({ rain: 1, wind: 1, cloud: 1, storm: 1 });
  });

  it('lets a storm rise over a few seconds instead of switching on', () => {
    const after1 = ease(CALM, WEATHER_MIX.storm, 1);
    expect(after1.rain).toBeGreaterThan(0.1);
    expect(after1.rain).toBeLessThan(0.5);
    const after15 = ease(CALM, WEATHER_MIX.storm, 16);
    expect(sameWeather(after15, WEATHER_MIX.storm)).toBe(true);
  });

  it('calms more slowly than it rises, and settles exactly', () => {
    const rising = ease(CALM, WEATHER_MIX.storm, 3);
    const calming = ease(WEATHER_MIX.storm, CALM, 3);
    expect(1 - calming.rain).toBeLessThan(rising.rain);
    expect(ease(WEATHER_MIX.storm, CALM, 40)).toEqual(CALM);
  });

  it('never overshoots, and ignores negative time', () => {
    const m = stepWeather(CALM, WEATHER_MIX.storm, 100);
    expect(m.rain).toBeLessThanOrEqual(1);
    expect(stepWeather(WEATHER_MIX.rain, CALM, -1)).toEqual(WEATHER_MIX.rain);
  });

  it('blows in gusts that stay within a sensible range', () => {
    const samples = Array.from({ length: 600 }, (_, i) => gust(i * 0.1, 2));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.35);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.25);
    expect(gust(12.3, 2)).toBe(gust(12.3, 2));
  });

  it('slants rain more the harder the wind blows', () => {
    expect(rainSlant(1)).toBeGreaterThan(rainSlant(0.3));
    expect(rainSlant(0)).toBeGreaterThan(0);
    expect(rainSlant(5)).toBe(rainSlant(1));
  });

  it('gathers puddles in rain and dries them afterwards', () => {
    let wet = 0;
    for (let t = 0; t < 30; t += 0.1) wet = stepWetness(wet, 1, 0.1);
    expect(wet).toBe(1);
    for (let t = 0; t < 20; t += 0.1) wet = stepWetness(wet, 0, 0.1);
    expect(wet).toBeGreaterThan(0);
    expect(wet).toBeLessThan(1);
    for (let t = 0; t < 60; t += 0.1) wet = stepWetness(wet, 0, 0.1);
    expect(wet).toBe(0);
  });
});

describe('weather particle budgets', () => {
  const view = { share: 1, viewTiles: 90, indoor: false, reducedMotion: false };

  it('has nothing to draw in clear weather', () => {
    const b = weatherBudget(CALM, view);
    expect(b.drops + b.splashes + b.dust + b.leaves).toBe(0);
    expect(b.sheets).toBe(false);
  });

  it('rains hardest in a storm, with sheets of rain', () => {
    const storm = weatherBudget(WEATHER_MIX.storm, view);
    const rain = weatherBudget(WEATHER_MIX.rain, view);
    expect(storm.drops).toBeGreaterThan(rain.drops);
    expect(storm.drops).toBeGreaterThan(300);
    expect(storm.sheets).toBe(true);
    expect(storm.splashes).toBeGreaterThan(0);
  });

  it('blows dust only when it is windy and dry (rain lays it)', () => {
    expect(weatherBudget(WEATHER_MIX.wind, view).dust).toBeGreaterThan(20);
    expect(weatherBudget(WEATHER_MIX.storm, view).dust).toBe(0);
    expect(weatherBudget(WEATHER_MIX.wind, view).cloudShadows).toBe(true);
  });

  it('scales down with the quality level: fewer particles, then no sheets or leaves', () => {
    const full = weatherBudget(WEATHER_MIX.storm, view);
    const lite = weatherBudget(WEATHER_MIX.storm, { ...view, share: 0.5 });
    const low = weatherBudget(WEATHER_MIX.storm, { ...view, share: 0.2 });
    expect(lite.drops).toBeLessThan(full.drops);
    expect(low.drops).toBeLessThan(lite.drops);
    expect(low.sheets).toBe(false);
    expect(lite.sheets).toBe(false);
    expect(low.cloudShadows).toBe(false);
    expect(lite.cloudShadows).toBe(true);
    expect(weatherBudget(WEATHER_MIX.wind, { ...view, share: 0.2 }).leaves).toBe(0);
  });

  it('scales with how much of the world is in view, within limits', () => {
    const small = weatherBudget(WEATHER_MIX.storm, { ...view, viewTiles: 20 });
    const big = weatherBudget(WEATHER_MIX.storm, { ...view, viewTiles: 1000 });
    const normal = weatherBudget(WEATHER_MIX.storm, view);
    expect(small.drops).toBe(Math.round(normal.drops / 2));
    expect(big.drops).toBe(normal.drops * 2);
  });

  it('draws nothing that moves with reduced motion, and no precipitation indoors', () => {
    for (const options of [
      { ...view, reducedMotion: true },
      { ...view, indoor: true },
    ]) {
      const b = weatherBudget(WEATHER_MIX.storm, options);
      expect(b.drops + b.splashes + b.ripples + b.dust + b.leaves).toBe(0);
      expect(b.sheets || b.cloudShadows).toBe(false);
    }
  });
});

describe('lightning (WCAG 2.3.1: no more than three flashes in any second)', () => {
  it('gates flashes to at most three in any one-second window', () => {
    const gate = new FlashGate();
    const allowed: number[] = [];
    for (let t = 0; t < 5000; t += 50) if (gate.allow(t)) allowed.push(t);
    expect(allowed.length).toBeGreaterThan(0);
    for (const start of allowed) {
      const inWindow = allowed.filter((t) => t >= start && t < start + 1000);
      expect(inWindow.length).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
  });

  it('never asks for more than two flashes per strike, well apart', () => {
    const r = rng(7);
    for (let i = 0; i < 200; i++) {
      const pattern = strikePattern(r, 1000);
      expect(pattern.length).toBeGreaterThanOrEqual(1);
      expect(pattern.length).toBeLessThanOrEqual(2);
      if (pattern.length === 2) {
        const [a, b] = pattern;
        expect((b?.at ?? 0) - (a?.at ?? 0)).toBeGreaterThanOrEqual(180);
      }
    }
  });

  it('keeps strikes seconds apart, and only in storms', () => {
    const r = rng(3);
    for (let i = 0; i < 100; i++) expect(nextStrikeIn(1, r)).toBeGreaterThanOrEqual(4);
    expect(nextStrikeIn(0.3, r)).toBe(Infinity);
    expect(nextStrikeIn(0, r)).toBe(Infinity);
  });

  it('strikes once a storm rises mid-scene, never in calm or with reduced motion', () => {
    const run = (storm: (t: number) => number, enabled = true) => {
      const l = new Lightning(rng(11));
      const onsets: number[] = [];
      let last = 0;
      for (let t = 0; t < 120_000; t += 16) {
        const level = l.step(storm(t), 0.016, t, enabled);
        if (level > 0 && last === 0) onsets.push(t);
        last = level;
      }
      return { strikes: l.strikes, onsets };
    };
    // Clear for 20 s, then a storm.
    const rising = run((t) => (t < 20_000 ? 0 : 1));
    expect(rising.strikes).toBeGreaterThan(4);
    expect(rising.onsets.every((t) => t >= 20_000)).toBe(true);
    expect(run(() => 0).strikes).toBe(0);
    expect(run(() => 0.3).strikes).toBe(0);
    expect(run(() => 1, false).onsets).toEqual([]);
    // Never more than three flashes in any second.
    for (const start of rising.onsets) {
      expect(
        rising.onsets.filter((t) => t >= start && t < start + 1000).length,
      ).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
    }
  });

  it('brightens quickly and fades, and stays low in contrast', () => {
    const flashes = [{ at: 1000, peak: 1, duration: 150 }];
    expect(flashLevel(flashes, 990)).toBe(0);
    expect(flashLevel(flashes, 1025)).toBeCloseTo(1, 5);
    expect(flashLevel(flashes, 1100)).toBeLessThan(0.5);
    expect(flashLevel(flashes, 1200)).toBe(0);
    expect(MAX_FLASH).toBeLessThanOrEqual(0.25);
  });
});

describe('light under cloud', () => {
  it('leaves clear weather untouched and darkens and cools a storm', () => {
    expect(overcast(CALM, false).alpha).toBe(0);
    const storm = overcast(WEATHER_MIX.storm, false);
    expect(storm.alpha).toBeGreaterThan(0.3);
    expect(storm.alpha).toBeLessThanOrEqual(0.5);
    const b = storm.tint & 255;
    const r = (storm.tint >> 16) & 255;
    expect(b).toBeGreaterThan(r); // cooler
  });

  it('is felt only a little indoors', () => {
    expect(overcast(WEATHER_MIX.storm, true).alpha).toBeLessThan(
      overcast(WEATHER_MIX.storm, false).alpha / 2,
    );
  });

  it('blends colours smoothly (no jump as a storm builds)', () => {
    expect(lerpRgb(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(lerpRgb(0x102030, 0x405060, 0)).toBe(0x102030);
    expect(lerpRgb(0x102030, 0x405060, 2)).toBe(0x405060);
  });
});

describe('the light layer skips frames where nothing moved (code review)', () => {
  const place = {};
  const clear = WEATHER_MIX.clear;
  const base = { place, hour: 10, mix: clear, highContrast: false, lowPower: false };

  it('is the same sky for a new but equal weather mix (the mix is rebuilt every frame)', () => {
    expect(sameSky(base, { ...base, mix: { ...clear } })).toBe(true);
  });

  it('recomputes when the place, hour, weather, contrast or power mode changes, or on the first frame', () => {
    expect(sameSky(null, base)).toBe(false);
    expect(sameSky(base, { ...base, place: {} })).toBe(false);
    expect(sameSky(base, { ...base, hour: 11 })).toBe(false);
    expect(sameSky(base, { ...base, mix: WEATHER_MIX.storm })).toBe(false);
    expect(sameSky(base, { ...base, highContrast: true })).toBe(false);
    expect(sameSky(base, { ...base, lowPower: true })).toBe(false);
  });
});

import type { SceneMood } from '@/application/ports';
import type { WeatherMix } from './weather';

/**
 * The post-processing grade (WebGL only): a gentle, per-place and per-hour
 * finish on top of the art — never a filter over it. Exposure, contrast and
 * saturation stay within a few percent of neutral in fair weather; cloud
 * and rain flatten and cool the light; lamps, fire and sun glints bloom.
 * The multiply light layer (lighting.ts) still does the heavy lifting of
 * time of day, and works without WebGL.
 *
 * Pure so it can be unit-tested.
 */
export type Rgb3 = readonly [number, number, number];

export interface Grade {
  exposure: number;
  /** Contrast around mid-grey (1 = unchanged). */
  contrast: number;
  /** 1 = unchanged, 0 = grey. */
  saturation: number;
  /** Per-channel gain: white balance. */
  gain: Rgb3;
  /** Lifts the shadows toward this colour (0 = none). */
  lift: Rgb3;
  /** Bloom strength (0 = off) and the brightness it starts at. */
  bloom: number;
  threshold: number;
  /** Heat shimmer amplitude, in CSS pixels (0 = none). */
  haze: number;
}

export const NEUTRAL_GRADE: Grade = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  gain: [1, 1, 1],
  lift: [0, 0, 0],
  bloom: 0,
  threshold: 1,
  haze: 0,
};

export interface GradeInput {
  mood: SceneMood;
  hour: number | null;
  indoor: boolean;
  weather: WeatherMix;
  /** Keep the world bright and clear (the player's high-contrast setting). */
  highContrast: boolean;
  reducedMotion: boolean;
}

const mix3 = (a: Rgb3, b: Rgb3, t: number): Rgb3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** The time of day's own finish: warm mornings and evenings, cool dusk, dim blue nights. */
function timeGrade(hour: number | null, indoor: boolean): Grade {
  if (indoor)
    return {
      ...NEUTRAL_GRADE,
      contrast: 1.05,
      saturation: 1.03,
      gain: [1.03, 1, 0.95],
      bloom: 0.3,
      threshold: 0.8,
    };
  const h = hour === null ? 12 : ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 19)
    return {
      ...NEUTRAL_GRADE,
      exposure: 1.02,
      contrast: 1.06,
      saturation: 0.8,
      gain: [0.94, 0.98, 1.08],
      lift: [0.02, 0.03, 0.06],
      bloom: 0.75,
      threshold: 0.55,
    };
  if (h < 7)
    return {
      ...NEUTRAL_GRADE,
      contrast: 1.03,
      saturation: 1.02,
      gain: [1.05, 0.99, 0.95],
      lift: [0.03, 0.015, 0.02],
      bloom: 0.45,
      threshold: 0.7,
    };
  if (h < 9)
    return {
      ...NEUTRAL_GRADE,
      contrast: 1.04,
      saturation: 1.04,
      gain: [1.03, 1, 0.97],
      bloom: 0.35,
      threshold: 0.8,
    };
  if (h < 15)
    return {
      ...NEUTRAL_GRADE,
      contrast: 1.05,
      saturation: 1.04,
      gain: [1.01, 1, 0.99],
      bloom: 0.28,
      threshold: 0.84,
    };
  if (h < 17)
    return {
      ...NEUTRAL_GRADE,
      contrast: 1.05,
      saturation: 1.07,
      gain: [1.05, 1, 0.93],
      bloom: 0.38,
      threshold: 0.78,
    };
  if (h < 18)
    return {
      ...NEUTRAL_GRADE,
      contrast: 1.04,
      saturation: 1.06,
      gain: [1.07, 0.99, 0.9],
      lift: [0.03, 0.01, 0.0],
      bloom: 0.5,
      threshold: 0.7,
    };
  return {
    ...NEUTRAL_GRADE,
    contrast: 1.04,
    saturation: 0.92,
    gain: [0.98, 0.97, 1.05],
    lift: [0.02, 0.015, 0.05],
    bloom: 0.6,
    threshold: 0.62,
  };
}

/** Each place's character: bleached wilderness, lush oasis, warm home. */
function moodGrade(g: Grade, mood: SceneMood): Grade {
  switch (mood) {
    case 'wilderness':
      return { ...g, exposure: g.exposure * 1.01, saturation: g.saturation * 0.95 };
    case 'oasis':
      return { ...g, saturation: g.saturation * 1.05 };
    case 'home':
      return { ...g, gain: mix3(g.gain, [1.05, 1, 0.93], 0.5) };
    case 'city':
      return g;
  }
}

/** Is it the middle of a hot day in the open (heat shimmer)? */
function hazeFor(input: GradeInput): number {
  const h = input.hour;
  if (input.reducedMotion || input.indoor || input.mood !== 'wilderness' || h === null) return 0;
  const hour = ((h % 24) + 24) % 24;
  if (hour < 10 || hour >= 15) return 0;
  return 0.7 * (1 - Math.min(1, input.weather.cloud * 1.5));
}

export function gradeFor(input: GradeInput): Grade {
  const w = input.weather;
  const base = moodGrade(timeGrade(input.hour, input.indoor), input.mood);
  const k = input.indoor ? 0.35 : 1;
  const cloud = w.cloud * k;
  const storm = w.storm * k;
  // Overcast light is flatter, cooler and less saturated; a storm darker still.
  let g: Grade = {
    ...base,
    exposure: base.exposure * (1 - 0.03 * cloud - 0.04 * storm),
    contrast: base.contrast * (1 - 0.05 * cloud) + 0.04 * storm,
    saturation: base.saturation * (1 - 0.16 * cloud - 0.06 * storm),
    gain: mix3(base.gain, [0.95, 0.99, 1.06], Math.min(1, cloud)),
    lift: mix3(base.lift, [0.01, 0.02, 0.035], Math.min(1, cloud * 0.8)),
    // No sun to glint in: bloom only for lamps and lightning under cloud.
    bloom: base.bloom * (1 - 0.5 * cloud),
    haze: hazeFor(input),
  };
  if (input.highContrast) {
    // Legibility first: no darkening, no flattening, no shimmer.
    g = {
      ...g,
      exposure: Math.max(1, g.exposure),
      contrast: Math.max(1.08, g.contrast),
      saturation: Math.max(1, g.saturation),
      lift: [0, 0, 0],
      haze: 0,
    };
  }
  return g;
}

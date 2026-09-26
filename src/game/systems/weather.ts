import type { Weather } from '@/domain/world';

/**
 * Weather as the world draws it, as pure functions (unit-tested):
 *
 * - The story names the weather (clear, wind, rain, storm). The world eases
 *   between them — a storm rises over several seconds and calms more slowly
 *   — by blending a few channels (`WeatherMix`).
 * - Wind comes in gusts.
 * - Particle budgets scale with the weather, the size of the view and the
 *   automatic quality level; reduced motion and interiors get none.
 * - Lightning is rationed: never more than three flashes in any second
 *   (WCAG 2.3.1), low in contrast, and none at all with reduced motion.
 */
export interface WeatherMix {
  /** How hard it is raining (0–1). */
  rain: number;
  /** Wind strength (0–1). */
  wind: number;
  /** Cloud cover: darker, cooler, flatter light (0–1). */
  cloud: number;
  /** Storm: lightning, low dark sky, gusts (0–1). */
  storm: number;
}

export const CALM: WeatherMix = { rain: 0, wind: 0, cloud: 0, storm: 0 };

export const WEATHER_MIX: Readonly<Record<Weather, WeatherMix>> = {
  clear: CALM,
  wind: { rain: 0, wind: 0.65, cloud: 0.2, storm: 0 },
  rain: { rain: 0.6, wind: 0.2, cloud: 0.7, storm: 0 },
  storm: { rain: 1, wind: 1, cloud: 1, storm: 1 },
};

/** Seconds for a channel to move most (63%) of the way: weather builds faster than it clears. */
export const WEATHER_EASE = { rise: 3.2, fall: 6 } as const;

const CHANNELS = ['rain', 'wind', 'cloud', 'storm'] as const;

/** Ease the drawn weather toward the story's weather over `dt` seconds. */
export function stepWeather(mix: WeatherMix, target: WeatherMix, dt: number): WeatherMix {
  const next = { ...mix };
  for (const c of CHANNELS) {
    const from = mix[c];
    const to = target[c];
    const tau = to > from ? WEATHER_EASE.rise : WEATHER_EASE.fall;
    const v = from + (to - from) * (1 - Math.exp(-Math.max(0, dt) / tau));
    next[c] = Math.abs(to - v) < 0.01 ? to : v;
  }
  return next;
}

export function sameWeather(a: WeatherMix, b: WeatherMix): boolean {
  return CHANNELS.every((c) => a[c] === b[c]);
}

/**
 * Gusts: wind rises and falls irregularly. Returns 0.35–1, a multiplier of
 * the wind's strength at time `t` (seconds). Deterministic for a seed.
 */
export function gust(t: number, seed = 0): number {
  const s = seed * 1.7;
  const g =
    0.5 +
    0.22 * Math.sin(t * 0.61 + s) +
    0.16 * Math.sin(t * 1.37 + 2.1 + s) +
    0.12 * Math.sin(t * 2.9 + 0.7 + s * 0.5);
  return 0.35 + 0.65 * Math.min(1, Math.max(0, g));
}

/** How far rain slants (horizontal speed per unit of fall) for a wind strength. */
export function rainSlant(wind: number): number {
  return 0.08 + 0.55 * Math.min(1, Math.max(0, wind));
}

export interface WeatherBudget {
  /** Rain streaks falling at once. */
  drops: number;
  /** Splashes on the ground per second. */
  splashes: number;
  /** Ripples on puddles and water per second. */
  ripples: number;
  /** Blown dust wisps at once. */
  dust: number;
  /** Leaves and chaff tumbling in the wind at once. */
  leaves: number;
  /** Sheets of rain sweeping across the view. */
  sheets: boolean;
  /** Cloud shadows drifting over the ground. */
  cloudShadows: boolean;
}

export const NO_WEATHER_FX: WeatherBudget = {
  drops: 0,
  splashes: 0,
  ripples: 0,
  dust: 0,
  leaves: 0,
  sheets: false,
  cloudShadows: false,
};

/** The full budget for a view of about 90 tiles (a landscape screen at close framing). */
export const WEATHER_BUDGET = {
  drops: 520,
  splashes: 240,
  ripples: 40,
  dust: 70,
  leaves: 14,
} as const;

/**
 * Particle budget for the weather now. `share` is the quality level's share
 * (1 full, 0.5 lite, 0.2 low); `viewTiles` is how many tiles the view shows.
 */
export function weatherBudget(
  mix: WeatherMix,
  options: { share: number; viewTiles: number; indoor: boolean; reducedMotion: boolean },
): WeatherBudget {
  if (options.indoor || options.reducedMotion || options.share <= 0) return NO_WEATHER_FX;
  const area = Math.min(2, Math.max(0.5, options.viewTiles / 90));
  const k = options.share * area;
  const n = (base: number, amount: number): number => Math.round(base * amount * k);
  const dry = 1 - mix.rain;
  return {
    drops: n(WEATHER_BUDGET.drops, mix.rain),
    splashes: n(WEATHER_BUDGET.splashes, mix.rain),
    ripples: n(WEATHER_BUDGET.ripples, mix.rain),
    // Dust blows when it's windy and dry; rain lays it.
    dust: n(WEATHER_BUDGET.dust, Math.max(0, mix.wind - 0.15) * dry),
    leaves: options.share >= 0.5 ? n(WEATHER_BUDGET.leaves, Math.max(0, mix.wind - 0.2)) : 0,
    // Two full-screen layers: only at full quality.
    sheets: options.share >= 1 && mix.rain > 0.55,
    // A full-screen layer: dropped in the simplest effects.
    cloudShadows: options.share >= 0.5 && (mix.cloud > 0.05 || mix.wind > 0.3),
  };
}

/**
 * How wet the ground is (0–1): puddles gather over a quarter of a minute of
 * rain and dry out over most of a minute once it stops.
 */
export function stepWetness(wet: number, rain: number, dt: number): number {
  if (rain > 0.05) return Math.min(1, wet + Math.max(0, dt) * (0.03 + 0.07 * rain));
  return Math.max(0, wet - Math.max(0, dt) / 45);
}

// ── Lightning ───────────────────────────────────────────────────────────────

/** One brightening of the sky (times in ms). */
export interface Flash {
  at: number;
  /** Peak strength, 0–1 (scaled by MAX_FLASH on screen). */
  peak: number;
  duration: number;
}

/**
 * The strongest a flash ever gets: a brightening of the scene of at most this
 * much, well short of a full-screen white flash.
 */
export const MAX_FLASH = 0.24;
/** WCAG 2.3.1: no more than three flashes in any one-second period. */
export const MAX_FLASHES_PER_SECOND = 3;

/**
 * A lightning strike's flicker: a main flash and sometimes one fainter
 * return stroke, never closer than 180 ms apart.
 */
export function strikePattern(r: () => number, start: number): Flash[] {
  const main: Flash = { at: start, peak: 0.75 + r() * 0.25, duration: 110 + r() * 60 };
  if (r() < 0.55) return [main];
  const gap = 180 + r() * 140;
  return [main, { at: start + gap, peak: 0.35 + r() * 0.3, duration: 90 + r() * 50 }];
}

/** Seconds until the next strike (storms only; Infinity otherwise). */
export function nextStrikeIn(storm: number, r: () => number): number {
  if (storm < 0.5) return Infinity;
  const pace = 1.4 - storm * 0.6; // stronger storm, more often
  return (5 + r() * 9) * pace;
}

/**
 * Rations flashes so there are never more than `max` onsets in any window of
 * one second, whatever asks for them.
 */
export class FlashGate {
  private onsets: number[] = [];

  constructor(private readonly max: number = MAX_FLASHES_PER_SECOND) {}

  /** Record and allow a flash starting at `at` (ms), or refuse it. */
  allow(at: number): boolean {
    this.onsets = this.onsets.filter((t) => at - t < 1000);
    if (this.onsets.length >= this.max) return false;
    this.onsets.push(at);
    return true;
  }

  reset(): void {
    this.onsets = [];
  }
}

/** How bright the flashes are at time `now` (ms), 0–1: a quick rise, then a fade. */
export function flashLevel(flashes: readonly Flash[], now: number): number {
  let level = 0;
  for (const f of flashes) {
    const t = now - f.at;
    if (t < 0 || t > f.duration) continue;
    const rise = 25;
    const v = t < rise ? t / rise : Math.exp(-((t - rise) / (f.duration - rise)) * 3);
    level = Math.max(level, f.peak * v);
  }
  return Math.min(1, level);
}

/**
 * Lightning over time: waits a few seconds between strikes while a storm is
 * strong enough (and starts counting as soon as a storm rises mid-scene),
 * lets each strike's flicker through the FlashGate, and reports how bright
 * the sky is now (0–1). Disabled (reduced motion), it never flashes.
 */
export class Lightning {
  private wait = Infinity;
  private flashes: Flash[] = [];
  private readonly gate = new FlashGate();
  /** Strikes so far (diagnostics). */
  strikes = 0;

  constructor(private readonly r: () => number) {}

  /** Advance by `dt` seconds to time `now` (ms) in a storm of strength `storm` (0–1). */
  step(storm: number, dt: number, now: number, enabled: boolean): number {
    if (!enabled) {
      this.flashes = [];
      this.wait = Infinity;
      return 0;
    }
    // A storm has risen: start counting (the first strike comes sooner).
    if (!Number.isFinite(this.wait)) this.wait = nextStrikeIn(storm, this.r) * 0.5;
    this.wait -= Math.max(0, dt);
    if (this.wait <= 0) {
      this.wait = nextStrikeIn(storm, this.r);
      if (storm >= 0.5) {
        this.strikes++;
        for (const f of strikePattern(this.r, now)) if (this.gate.allow(f.at)) this.flashes.push(f);
      }
    }
    this.flashes = this.flashes.filter((f) => now - f.at <= f.duration);
    return flashLevel(this.flashes, now);
  }

  reset(): void {
    this.flashes = [];
    this.wait = Infinity;
    this.gate.reset();
  }
}

// ── Light under cloud ───────────────────────────────────────────────────────

/**
 * How cloud and rain change the light layer: a cooler, darker grade and a
 * deeper vignette. Interiors feel only a little of it (through the windows).
 * Returns a multiply tint colour, its strength and extra vignette.
 */
export function overcast(
  mix: WeatherMix,
  indoor: boolean,
): { tint: number; alpha: number; vignette: number } {
  const k = indoor ? 0.35 : 1;
  const alpha = Math.min(0.5, (mix.cloud * 0.26 + mix.storm * 0.14 + mix.rain * 0.04) * k);
  const vignette = (mix.cloud * 0.1 + mix.storm * 0.1) * k;
  return { tint: lerpRgb(0x7a869a, 0x5a667e, mix.storm), alpha, vignette };
}

/** Blend two 0xRRGGBB colours. */
export function lerpRgb(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (shift: number): number => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * k) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

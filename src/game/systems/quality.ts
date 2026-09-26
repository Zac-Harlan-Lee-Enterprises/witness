/**
 * Automatic quality: if the world keeps running slowly, simplify the
 * effects step by step so movement stays smooth on weak GPUs. Pure so the
 * decisions can be unit-tested.
 *
 * The steps, cheapest to lose first:
 *
 * | level | what is dropped                                                         |
 * |-------|-------------------------------------------------------------------------|
 * | full  | nothing: post-processing, full weather, device-pixel resolution (≤ 2×)  |
 * | lite  | post-processing (grade, bloom), sheets of rain, half the weather       |
 * | crisp | high-DPI rendering: back to 1× (skipped where the screen is 1× anyway)  |
 * | low   | "simpler effects": dust, birds, glints, cloud shadows, most weather    |
 *
 * Very slow frames (below `severeFps`) skip straight to `low`.
 */
export const QUALITY = {
  /** Ignore the first seconds (textures uploading, fade-in). */
  warmupMs: 3000,
  sampleMs: 2000,
  /** Below this for `strikes` samples in a row → the next level. */
  minFps: 34,
  /** Below this for `strikes` samples in a row → straight to `low`. */
  severeFps: 24,
  strikes: 2,
  /** After a step, let the change take effect before measuring again. */
  settleMs: 1000,
  /**
   * A single frame longer than this is a hitch (a tab coming back, a
   * garbage collection, a screenshot), not a slow device: it isn't counted.
   * Long frames in a row are counted: that is a slow device.
   */
  hitchMs: 250,
} as const;

export const EFFECTS_LEVELS = ['full', 'lite', 'crisp', 'low'] as const;
export type EffectsLevel = (typeof EFFECTS_LEVELS)[number];

export interface QualityState {
  elapsedMs: number;
  sinceSampleMs: number;
  frames: number;
  strikes: number;
  /** Samples in a row below `severeFps`. */
  severe: number;
  level: EffectsLevel;
  /** The last level: simpler effects for the rest of the session. */
  lowPower: boolean;
  /** The previous frame was longer than `hitchMs`. */
  long: boolean;
}

export const INITIAL_QUALITY: QualityState = {
  elapsedMs: 0,
  sinceSampleMs: 0,
  frames: 0,
  strikes: 0,
  severe: 0,
  level: 'full',
  lowPower: false,
  long: false,
};

function atLevel(level: EffectsLevel): QualityState {
  return {
    elapsedMs: QUALITY.warmupMs - QUALITY.settleMs,
    sinceSampleMs: 0,
    frames: 0,
    strikes: 0,
    severe: 0,
    level,
    lowPower: level === 'low',
    long: false,
  };
}

/** The level after `level` (`crisp` is skipped where rendering is already at 1×). */
export function nextLevel(level: EffectsLevel, highDpi: boolean): EffectsLevel {
  if (level === 'full') return 'lite';
  if (level === 'lite') return highDpi ? 'crisp' : 'low';
  return 'low';
}

/**
 * Advance by one rendered frame of `deltaMs`. Levels only ever go down.
 * `highDpi`: the world is rendering above 1×, so there is a resolution step to take.
 */
export function stepQuality(state: QualityState, deltaMs: number, highDpi = false): QualityState {
  if (state.lowPower) return state;
  const long = deltaMs > QUALITY.hitchMs;
  // An isolated long frame is a hitch, not the device: skip it.
  if (long && !state.long) return { ...state, long };
  const s = { ...state, long };
  const elapsedMs = s.elapsedMs + deltaMs;
  if (elapsedMs < QUALITY.warmupMs) return { ...s, elapsedMs };
  const sinceSampleMs = s.sinceSampleMs + deltaMs;
  const frames = s.frames + 1;
  if (sinceSampleMs < QUALITY.sampleMs) return { ...s, elapsedMs, sinceSampleMs, frames };
  const fps = (frames * 1000) / sinceSampleMs;
  const strikes = fps < QUALITY.minFps ? s.strikes + 1 : 0;
  const severe = fps < QUALITY.severeFps ? s.severe + 1 : 0;
  if (severe >= QUALITY.strikes) return atLevel('low');
  if (strikes >= QUALITY.strikes) return atLevel(nextLevel(s.level, highDpi));
  return { ...s, elapsedMs, sinceSampleMs: 0, frames: 0, strikes, severe };
}

/**
 * Where the world starts before measuring itself: without a GPU every pixel
 * costs CPU, so software renderers start without post-processing or
 * full-screen weather (lite). Also where it returns when the player turns
 * "Simpler visual effects" off again.
 */
export function startLevel(softwareRenderer: boolean): EffectsLevel {
  return softwareRenderer ? 'lite' : 'full';
}

/**
 * A level the player chose (simpler effects on, or back off): start there,
 * and measure afresh from it.
 */
export function chosenLevel(level: EffectsLevel): QualityState {
  return { ...INITIAL_QUALITY, level, lowPower: level === 'low' };
}

/**
 * A new scene is being painted and uploaded: that one-off hitch isn't the
 * device being slow, so start measuring again after a fresh warm-up.
 * (The level reached so far is kept.)
 */
export function restartWarmup(s: QualityState): QualityState {
  return s.lowPower ? s : { ...INITIAL_QUALITY, level: s.level };
}

/** What each level allows. */
export interface EffectsBudget {
  /** WebGL post-processing: colour grade, bloom, lightning flash, heat haze. */
  postFx: boolean;
  /** Highest render resolution (device pixels per CSS pixel). */
  maxResolution: number;
  /** Share of the full weather particle budget. */
  weather: number;
  /** Decorative extras (dust, birds, water glints, swaying trees). */
  decor: boolean;
}

export function effectsFor(level: EffectsLevel): EffectsBudget {
  switch (level) {
    case 'full':
      return { postFx: true, maxResolution: 2, weather: 1, decor: true };
    case 'lite':
      return { postFx: false, maxResolution: 2, weather: 0.5, decor: true };
    case 'crisp':
      return { postFx: false, maxResolution: 1, weather: 0.5, decor: true };
    case 'low':
      return { postFx: false, maxResolution: 1, weather: 0.2, decor: false };
  }
}

/** The canvas marker for tests and diagnostics (`data-effects`). */
export function effectsLabel(level: EffectsLevel): 'full' | 'lite' | 'reduced' {
  return level === 'full' ? 'full' : level === 'low' ? 'reduced' : 'lite';
}

/** Whether the light layer is worth drawing in low-power mode (strong light carries meaning). */
export function lightMatters(alpha: number): boolean {
  return alpha >= 0.2;
}

/**
 * Automatic quality: if the world keeps running slowly, drop decorative
 * effects (vignette in mild light, drifting dust, water glints) so movement
 * stays smooth on weak GPUs. Pure so the decision can be unit-tested.
 */
export const QUALITY = {
  /** Ignore the first seconds (textures uploading, fade-in). */
  warmupMs: 3000,
  sampleMs: 2000,
  /** Below this for `strikes` samples in a row → low-power effects. */
  minFps: 34,
  strikes: 2,
} as const;

export interface QualityState {
  elapsedMs: number;
  sinceSampleMs: number;
  frames: number;
  strikes: number;
  lowPower: boolean;
}

export const INITIAL_QUALITY: QualityState = {
  elapsedMs: 0,
  sinceSampleMs: 0,
  frames: 0,
  strikes: 0,
  lowPower: false,
};

/** Advance by one rendered frame of `deltaMs`. Once low-power, it stays low-power. */
export function stepQuality(s: QualityState, deltaMs: number): QualityState {
  if (s.lowPower) return s;
  const elapsedMs = s.elapsedMs + deltaMs;
  if (elapsedMs < QUALITY.warmupMs) return { ...s, elapsedMs };
  const sinceSampleMs = s.sinceSampleMs + deltaMs;
  const frames = s.frames + 1;
  if (sinceSampleMs < QUALITY.sampleMs) return { ...s, elapsedMs, sinceSampleMs, frames };
  const fps = (frames * 1000) / sinceSampleMs;
  const strikes = fps < QUALITY.minFps ? s.strikes + 1 : 0;
  return {
    elapsedMs,
    sinceSampleMs: 0,
    frames: 0,
    strikes,
    lowPower: strikes >= QUALITY.strikes,
  };
}

/** Whether the light layer is worth drawing in low-power mode (strong light carries meaning). */
export function lightMatters(alpha: number): boolean {
  return alpha >= 0.2;
}

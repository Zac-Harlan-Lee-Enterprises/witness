import type { AmbienceId, FootstepSurface, SfxId } from '@/application/ports';

/**
 * Sound design as data (pure, unit-tested); synth-audio.ts turns it into
 * WebAudio. Every effect and ambience is original and synthesised.
 *
 * - Effects have recipes of plucked (lyre-like), bell and breath (noise)
 *   partials, so each moment has its own voice: a bright bell for a clue,
 *   a warm double pluck for an item, a rising cadence for a solved puzzle.
 * - Each place has a bed of filtered noise plus sparse events: voices and
 *   pottery clinks in the market, a crackling hearth at home, whistling
 *   gusts on the road, birdsong and trickling water in Jericho.
 *
 * The background music is recorded (recorded-music.ts), not synthesised.
 */
export interface Tone {
  /** pluck: lyre-like string; bell: inharmonic partials; breath: filtered noise; knock: a short falling thud. */
  kind: 'pluck' | 'bell' | 'breath' | 'knock';
  freq: number;
  /** Seconds after the trigger. */
  at: number;
  dur: number;
  gain: number;
}

export const SFX: Record<SfxId, readonly Tone[]> = {
  interact: [{ kind: 'pluck', freq: 660, at: 0, dur: 0.1, gain: 0.35 }],
  item: [
    { kind: 'pluck', freq: 523, at: 0, dur: 0.18, gain: 0.45 },
    { kind: 'pluck', freq: 784, at: 0.07, dur: 0.26, gain: 0.4 },
  ],
  journal: [
    { kind: 'pluck', freq: 523, at: 0, dur: 0.12, gain: 0.35 },
    { kind: 'pluck', freq: 659, at: 0.07, dur: 0.12, gain: 0.35 },
    { kind: 'pluck', freq: 784, at: 0.14, dur: 0.22, gain: 0.35 },
  ],
  discover: [
    { kind: 'bell', freq: 988, at: 0, dur: 0.9, gain: 0.3 },
    { kind: 'bell', freq: 1319, at: 0.09, dur: 1.1, gain: 0.22 },
    { kind: 'breath', freq: 4000, at: 0, dur: 0.35, gain: 0.05 },
  ],
  quest: [
    { kind: 'pluck', freq: 392, at: 0, dur: 0.2, gain: 0.4 },
    { kind: 'pluck', freq: 523, at: 0.12, dur: 0.2, gain: 0.4 },
    { kind: 'pluck', freq: 659, at: 0.24, dur: 0.4, gain: 0.4 },
    { kind: 'bell', freq: 1047, at: 0.24, dur: 0.8, gain: 0.12 },
  ],
  solved: [
    { kind: 'pluck', freq: 523, at: 0, dur: 0.16, gain: 0.4 },
    { kind: 'pluck', freq: 659, at: 0.1, dur: 0.16, gain: 0.4 },
    { kind: 'pluck', freq: 784, at: 0.2, dur: 0.16, gain: 0.4 },
    { kind: 'bell', freq: 1047, at: 0.3, dur: 1.2, gain: 0.28 },
  ],
  error: [{ kind: 'pluck', freq: 196, at: 0, dur: 0.25, gain: 0.35 }],
  page: [{ kind: 'breath', freq: 3000, at: 0, dur: 0.08, gain: 0.08 }],
  door: [
    { kind: 'pluck', freq: 147, at: 0, dur: 0.22, gain: 0.35 },
    { kind: 'breath', freq: 600, at: 0, dur: 0.3, gain: 0.08 },
  ],
};

/**
 * Footsteps, quiet and short, one recipe per surface: a hard tap on stone,
 * a gritty crunch on gravel, a soft hiss in sand, a dull thud on earth, a
 * swish in grass, a squelch in mud, a muffled pat on a mat.
 */
export const FOOTSTEPS: Record<FootstepSurface, readonly Tone[]> = {
  stone: [
    { kind: 'breath', freq: 3200, at: 0, dur: 0.035, gain: 0.05 },
    { kind: 'knock', freq: 190, at: 0, dur: 0.05, gain: 0.12 },
  ],
  gravel: [
    { kind: 'breath', freq: 2600, at: 0, dur: 0.05, gain: 0.05 },
    { kind: 'breath', freq: 3600, at: 0.02, dur: 0.04, gain: 0.04 },
    { kind: 'breath', freq: 2000, at: 0.045, dur: 0.05, gain: 0.035 },
  ],
  sand: [{ kind: 'breath', freq: 1400, at: 0, dur: 0.09, gain: 0.035 }],
  // A hollow knock on planking, with a little give.
  wood: [
    { kind: 'knock', freq: 260, at: 0, dur: 0.06, gain: 0.11 },
    { kind: 'knock', freq: 150, at: 0.012, dur: 0.08, gain: 0.06 },
  ],
  earth: [
    { kind: 'knock', freq: 120, at: 0, dur: 0.07, gain: 0.1 },
    { kind: 'breath', freq: 700, at: 0, dur: 0.06, gain: 0.03 },
  ],
  grass: [
    { kind: 'breath', freq: 4200, at: 0, dur: 0.1, gain: 0.025 },
    { kind: 'breath', freq: 2600, at: 0.03, dur: 0.07, gain: 0.02 },
  ],
  mud: [
    { kind: 'knock', freq: 90, at: 0, dur: 0.09, gain: 0.08 },
    { kind: 'breath', freq: 500, at: 0.02, dur: 0.1, gain: 0.04 },
  ],
  mat: [
    { kind: 'breath', freq: 900, at: 0, dur: 0.05, gain: 0.02 },
    { kind: 'knock', freq: 110, at: 0, dur: 0.04, gain: 0.05 },
  ],
};

export interface Bed {
  type: BiquadFilterType;
  freq: number;
  q: number;
  level: number;
  /** Slow swell of the bed (Hz). */
  lfo: number;
}

export type AmbientEventKind = 'voices' | 'clink' | 'crackle' | 'gust' | 'chirp' | 'trickle';

export interface Ambience {
  bed: Bed;
  /** Average events per second for each kind of sound. */
  events: Partial<Record<AmbientEventKind, number>>;
}

export const AMBIENCE: Record<Exclude<AmbienceId, 'none'>, Ambience> = {
  market: {
    bed: { type: 'bandpass', freq: 850, q: 0.6, level: 0.32, lfo: 0.4 },
    events: { voices: 1.4, clink: 0.25 },
  },
  wind: {
    bed: { type: 'lowpass', freq: 480, q: 0.7, level: 0.55, lfo: 0.09 },
    events: { gust: 0.12 },
  },
  indoor: {
    bed: { type: 'lowpass', freq: 220, q: 0.5, level: 0.14, lfo: 0.05 },
    events: { crackle: 2.2 },
  },
  oasis: {
    bed: { type: 'highpass', freq: 2400, q: 0.4, level: 0.14, lfo: 0.25 },
    events: { chirp: 0.35, trickle: 0.6 },
  },
};

export interface ScheduledEvent {
  kind: AmbientEventKind;
  /** Seconds from now. */
  at: number;
  /** 0–1 variation (pitch, length, loudness) chosen per event. */
  variety: number;
}

/**
 * Which ambient sounds happen in the next `window` seconds (Poisson-like:
 * each kind fires at its average rate, at random moments).
 */
export function scheduleAmbience(
  id: AmbienceId,
  window: number,
  r: () => number,
): ScheduledEvent[] {
  if (id === 'none') return [];
  const out: ScheduledEvent[] = [];
  for (const [kind, rate] of Object.entries(AMBIENCE[id].events) as Array<
    [AmbientEventKind, number]
  >) {
    let t = 0;
    for (;;) {
      t += -Math.log(1 - r() * 0.999) / rate;
      if (t >= window) break;
      out.push({ kind, at: t, variety: r() });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

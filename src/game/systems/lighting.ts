/**
 * Time-of-day lighting as a pure function of the story clock (the chapter's
 * hour counter). The world applies it as ONE multiply-blend layer (colour
 * grade in the middle, darker towards the edges — see `gradeColors`); at
 * night a carried lamp adds a warm pool of light around the player, and
 * indoors the lamps and the hearth become the room's light.
 * Pure and Phaser-free so it can be unit-tested.
 */
export interface Lighting {
  /** Multiply-blend overlay colour (0xRRGGBB). */
  tint: number;
  /** Overlay strength 0–1. */
  alpha: number;
  /** Vignette strength 0–1. */
  vignette: number;
  /** Dark enough that a lamp should glow. */
  night: boolean;
  /** Short description (for tests / debugging). */
  label: string;
}

export function lightingFor(hour: number | null, indoor: boolean): Lighting {
  if (indoor) {
    // Interiors keep their warm daylight; after dark only lamps and the hearth light the room.
    const h = hour === null ? 12 : ((hour % 24) + 24) % 24;
    if (h < 5 || h >= 19)
      return { tint: 0x2e2640, alpha: 0.6, vignette: 0.75, night: true, label: 'indoor night' };
    if (h >= 18)
      return { tint: 0x8a6a70, alpha: 0.3, vignette: 0.6, night: true, label: 'indoor evening' };
    return { tint: 0xffd49a, alpha: 0.12, vignette: 0.5, night: false, label: 'indoor' };
  }
  if (hour === null)
    return { tint: 0xfff4dc, alpha: 0.04, vignette: 0.3, night: false, label: 'day' };
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) return { tint: 0x243366, alpha: 0.55, vignette: 0.6, night: true, label: 'night' };
  if (h < 7) return { tint: 0xffb088, alpha: 0.2, vignette: 0.4, night: false, label: 'dawn' };
  if (h < 9)
    return { tint: 0xffd9a0, alpha: 0.13, vignette: 0.32, night: false, label: 'early morning' };
  if (h < 15) return { tint: 0xfff4dc, alpha: 0.04, vignette: 0.28, night: false, label: 'day' };
  if (h < 17)
    return { tint: 0xffc070, alpha: 0.15, vignette: 0.32, night: false, label: 'golden afternoon' };
  if (h < 18) return { tint: 0xff8c4a, alpha: 0.26, vignette: 0.4, night: false, label: 'sunset' };
  if (h < 19) return { tint: 0x8a6aa8, alpha: 0.36, vignette: 0.5, night: true, label: 'dusk' };
  return { tint: 0x243366, alpha: 0.52, vignette: 0.6, night: true, label: 'night' };
}

/**
 * The time-of-day layer over pre-rendered art, which carries its own light.
 * Over day or later-day art only a trace of the hour's tint; over a night
 * bake (the moon, the fires and the lamps are in the art) a gentle night
 * that keeps the dark gathering round the lamps without darkening the art
 * twice. (Day art shown at night keeps the full night: see world-scene.)
 */
export function overBakedArt(l: Lighting, variant: 'day' | 'late' | 'night'): Lighting {
  if (variant === 'night')
    return { ...l, alpha: l.alpha * 0.3, vignette: Math.min(l.vignette, 0.42), night: true };
  return { ...l, alpha: l.alpha * 0.35, vignette: Math.min(l.vignette, 0.2) };
}

export type Rgb = readonly [number, number, number];

/** A second multiply tint over the time of day's: cloud, rain, a storm's gloom. */
export interface SkyTint {
  tint: number;
  alpha: number;
  vignette: number;
}

/**
 * The two colours of the single multiply layer. Multiplying by `center` is
 * the same as a `tint` overlay at `alpha` (times the sky's own tint, if
 * any); `edge` additionally darkens by the vignette strength. One
 * full-screen pass instead of two keeps the frame rate up on weak or
 * software-rendered GPUs.
 */
export function gradeColors(l: Lighting, sky?: SkyTint): { center: Rgb; edge: Rgb } {
  const overlay = (tint: number, alpha: number, shift: number): number =>
    1 - alpha + (((tint >> shift) & 255) / 255) * alpha;
  const graded = (shift: number): number =>
    Math.round(
      255 * overlay(l.tint, l.alpha, shift) * (sky ? overlay(sky.tint, sky.alpha, shift) : 1),
    );
  const center: Rgb = [graded(16), graded(8), graded(0)];
  const keep = 1 - 0.85 * Math.min(1, l.vignette + (sky?.vignette ?? 0));
  const edge: Rgb = [
    Math.round(center[0] * keep),
    Math.round(center[1] * keep),
    Math.round(center[2] * keep),
  ];
  return { center, edge };
}

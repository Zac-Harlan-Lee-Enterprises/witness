/**
 * Time-of-day lighting as a pure function of the story clock (the chapter's
 * hour counter). The world applies it as ONE multiply-blend layer (colour
 * grade in the middle, darker towards the edges — see `gradeColors`); at
 * night a carried lamp adds a warm glow around the player.
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
  if (indoor) return { tint: 0xffd49a, alpha: 0.12, vignette: 0.5, night: false, label: 'indoor' };
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

export type Rgb = readonly [number, number, number];

/**
 * The two colours of the single multiply layer. Multiplying by `center` is
 * the same as a `tint` overlay at `alpha`; `edge` additionally darkens by the
 * vignette strength. One full-screen pass instead of two keeps the frame rate
 * up on weak or software-rendered GPUs.
 */
export function gradeColors(l: Lighting): { center: Rgb; edge: Rgb } {
  const channel = (shift: number): number => (l.tint >> shift) & 255;
  const graded = (shift: number): number =>
    Math.round(255 * (1 - l.alpha) + channel(shift) * l.alpha);
  const center: Rgb = [graded(16), graded(8), graded(0)];
  const keep = 1 - 0.85 * l.vignette;
  const edge: Rgb = [
    Math.round(center[0] * keep),
    Math.round(center[1] * keep),
    Math.round(center[2] * keep),
  ];
  return { center, edge };
}

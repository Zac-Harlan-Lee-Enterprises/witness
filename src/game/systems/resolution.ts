/**
 * Render resolution: how many canvas pixels the world draws per CSS pixel.
 *
 * Browsers show a canvas at CSS size and scale it up on high-DPI screens,
 * which softens everything. Drawing at device pixels keeps edges, people,
 * particles and effects crisp — at the cost of fill rate (2× is 4× the
 * pixels). So the ratio is capped (2×, and a total pixel budget for very
 * large windows), snapped to quarter steps so scaling stays even, and it
 * falls to 1× when the device is struggling (see quality.ts).
 *
 * Pure so it can be unit-tested.
 */
export const RESOLUTION = {
  /** Never more than this many device pixels per CSS pixel. */
  max: 2,
  /** Never more canvas pixels than this in total (about 3000 × 2000). */
  maxPixels: 6_000_000,
} as const;

/**
 * The ratio to render at for a device pixel ratio and a CSS viewport size.
 * `cap` lowers the maximum (1 in simpler-effects modes).
 */
export function renderResolution(
  deviceRatio: number,
  cssWidth: number,
  cssHeight: number,
  cap: number = RESOLUTION.max,
): number {
  const dpr = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const area = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const budget = Math.sqrt(RESOLUTION.maxPixels / area);
  const ratio = Math.min(dpr, cap, RESOLUTION.max, budget);
  // Quarter steps: 1, 1.25, 1.5, 1.75, 2 (never below CSS resolution).
  return Math.max(1, Math.floor(ratio * 4 + 1e-6) / 4);
}

/** The canvas's pixel size for a CSS size at a render ratio. */
export function canvasPixels(
  cssWidth: number,
  cssHeight: number,
  ratio: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}

/**
 * Whether to store the opaque ground at 16 bits a pixel (RGB 5-6-5, half the
 * memory) instead of 32. The saving matters on phones and tablets and on
 * low-memory devices; it costs a faint hue noise in soft shadows that only
 * shows when magnified, so desktops keep full colour.
 */
export function wantsCompactGround(device: {
  coarsePointer: boolean;
  /** navigator.deviceMemory in GB, where the browser reports it. */
  deviceMemory: number | undefined;
  lowPower: boolean;
}): boolean {
  return (
    device.lowPower ||
    device.coarsePointer ||
    (device.deviceMemory !== undefined && device.deviceMemory <= 4)
  );
}

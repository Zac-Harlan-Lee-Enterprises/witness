import type { DeviceClass } from '../systems/resolution';

/**
 * The device the game runs on, from the browser: its primary pointer, its
 * memory (Chromium reports it; Safari and Firefox don't) and its screen's
 * shorter side. The rules that use it are pure (systems/resolution.ts).
 */
export function readDeviceClass(): DeviceClass {
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const width = window.screen?.width || window.innerWidth;
  const height = window.screen?.height || window.innerHeight;
  return { coarsePointer, deviceMemory, screenShortSide: Math.min(width, height) };
}

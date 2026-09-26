import { describe, expect, it } from 'vitest';
import {
  canvasPixels,
  renderResolution,
  RESOLUTION,
  wantsCompactGround,
} from '@/game/systems/resolution';

describe('render resolution (device pixels per CSS pixel)', () => {
  it('renders at the device pixel ratio on ordinary screens, up to 2×', () => {
    expect(renderResolution(1, 1280, 720)).toBe(1);
    expect(renderResolution(2, 1280, 720)).toBe(2);
    expect(renderResolution(1.5, 1280, 720)).toBe(1.5);
    // Phones report odd ratios (Pixel 7: 2.625): capped at 2.
    expect(renderResolution(2.625, 412, 915)).toBe(2);
    expect(renderResolution(3, 390, 844)).toBe(2);
  });

  it('never renders below CSS resolution, whatever the browser zoom', () => {
    expect(renderResolution(0.5, 1280, 720)).toBe(1);
    expect(renderResolution(0.9, 1280, 720)).toBe(1);
    expect(renderResolution(Number.NaN, 1280, 720)).toBe(1);
    expect(renderResolution(0, 1280, 720)).toBe(1);
  });

  it('snaps to quarter steps so scaling stays even', () => {
    expect(renderResolution(1.33, 1280, 720)).toBe(1.25);
    expect(renderResolution(1.8, 1280, 720)).toBe(1.75);
  });

  it('keeps very large windows within the pixel budget (fill rate)', () => {
    // A 1920×1080 window on a 4K screen would be 8.3 million pixels at 2×.
    const r = renderResolution(2, 1920, 1080);
    expect(r).toBeLessThan(2);
    const px = canvasPixels(1920, 1080, r);
    expect(px.width * px.height).toBeLessThanOrEqual(RESOLUTION.maxPixels);
    // A laptop-sized window still gets full Retina resolution.
    expect(renderResolution(2, 1440, 900)).toBe(2);
  });

  it('drops to 1× when the cap is lowered (simpler effects)', () => {
    expect(renderResolution(2, 1280, 720, 1)).toBe(1);
    expect(renderResolution(3, 412, 915, 1)).toBe(1);
  });

  it('sizes the canvas in whole device pixels', () => {
    expect(canvasPixels(1280, 720, 2)).toEqual({ width: 2560, height: 1440 });
    expect(canvasPixels(412, 915, 1.75)).toEqual({ width: 721, height: 1601 });
    expect(canvasPixels(0, 0, 2)).toEqual({ width: 1, height: 1 });
  });
});

describe('compact ground textures', () => {
  const desktop = { coarsePointer: false, deviceMemory: 16, lowPower: false };
  it('keeps full colour on desktops', () => {
    expect(wantsCompactGround(desktop)).toBe(false);
    expect(wantsCompactGround({ ...desktop, deviceMemory: undefined })).toBe(false);
  });
  it('halves the ground on phones, tablets, small-memory devices and in simpler effects', () => {
    expect(wantsCompactGround({ ...desktop, coarsePointer: true })).toBe(true);
    expect(wantsCompactGround({ ...desktop, deviceMemory: 4 })).toBe(true);
    expect(wantsCompactGround({ ...desktop, lowPower: true })).toBe(true);
  });
});

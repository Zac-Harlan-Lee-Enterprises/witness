import { describe, expect, it } from 'vitest';
import { INITIAL_QUALITY, lightMatters, QUALITY, stepQuality } from '@/game/systems/quality';

function run(fps: number, seconds: number) {
  let s = INITIAL_QUALITY;
  const frame = 1000 / fps;
  for (let t = 0; t < seconds * 1000; t += frame) s = stepQuality(s, frame);
  return s;
}

describe('automatic quality', () => {
  it('keeps full effects when the frame rate is fine', () => {
    expect(run(58, 12).lowPower).toBe(false);
  });
  it('switches to low-power after sustained slow frames, not during warm-up', () => {
    expect(run(20, QUALITY.warmupMs / 1000).lowPower).toBe(false);
    expect(run(20, 10).lowPower).toBe(true);
  });
  it('ignores a single slow patch', () => {
    let s = run(58, 5);
    for (let t = 0; t < 2100; t += 50) s = stepQuality(s, 50); // one slow sample (20 fps)
    for (let t = 0; t < 6000; t += 16) s = stepQuality(s, 16);
    expect(s.lowPower).toBe(false);
  });
  it('keeps night, dusk and sunset light even in low-power mode', () => {
    expect(lightMatters(0.52)).toBe(true);
    expect(lightMatters(0.04)).toBe(false);
  });
});

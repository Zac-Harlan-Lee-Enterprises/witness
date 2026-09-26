import { describe, expect, it } from 'vitest';
import {
  chosenLevel,
  startLevel,
  effectsFor,
  effectsLabel,
  INITIAL_QUALITY,
  lightMatters,
  nextLevel,
  QUALITY,
  restartWarmup,
  stepQuality,
  type QualityState,
} from '@/game/systems/quality';

function run(fps: number, seconds: number, highDpi = false, from: QualityState = INITIAL_QUALITY) {
  let s = from;
  const frame = 1000 / fps;
  for (let t = 0; t < seconds * 1000; t += frame) s = stepQuality(s, frame, highDpi);
  return s;
}

describe('where quality starts', () => {
  it('starts software renderers at lite and GPUs at full, including after simpler effects are turned off', () => {
    expect(startLevel(true)).toBe('lite');
    expect(startLevel(false)).toBe('full');
  });
});

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

  it('does not count the hitch of loading a new scene, but never undoes low-power mode', () => {
    let s = run(58, 6);
    s = { ...s, strikes: 1 };
    const fresh = restartWarmup(s);
    expect(fresh.strikes).toBe(0);
    expect(fresh.elapsedMs).toBe(0);
    const low = { ...INITIAL_QUALITY, lowPower: true };
    expect(restartWarmup(low)).toBe(low);
  });

  it('simplifies step by step: post-processing and weather first, then resolution', () => {
    // 30 fps: slow, but not severe.
    const lite = run(30, 7.5, true);
    expect(lite.level).toBe('lite');
    const crisp = run(30, 5.5, true, lite);
    expect(crisp.level).toBe('crisp');
    const low = run(30, 5.5, true, crisp);
    expect(low.level).toBe('low');
    expect(low.lowPower).toBe(true);
  });

  it('skips the resolution step where rendering is already at 1×', () => {
    expect(nextLevel('lite', false)).toBe('low');
    expect(nextLevel('lite', true)).toBe('crisp');
    expect(run(30, 13, false).level).toBe('low');
  });

  it('goes straight to simpler effects when frames are very slow', () => {
    const s = run(12, 8, true);
    expect(s.level).toBe('low');
  });

  it('does not count one-off hitches (a screenshot, a tab coming back)', () => {
    let s = run(60, 4);
    // A long single frame every second: the frames in between are smooth.
    for (let i = 0; i < 10; i++) {
      s = stepQuality(s, 900);
      for (let t = 0; t < 1000; t += 16) s = stepQuality(s, 16);
    }
    expect(s.level).toBe('full');
  });

  it('counts long frames in a row: a device drawing a few frames a second is slow, not hitching', () => {
    expect(run(3, 20).level).toBe('low');
  });

  it('keeps the level reached when a new scene restarts the warm-up', () => {
    const lite = run(30, 7.5, true);
    expect(restartWarmup(lite).level).toBe('lite');
    expect(restartWarmup(lite).elapsedMs).toBe(0);
  });

  it('starts where the player chose, and never steps down from simpler effects', () => {
    const simple = chosenLevel('low');
    expect(simple).toMatchObject({ level: 'low', lowPower: true });
    expect(run(10, 20, true, simple).level).toBe('low');
    const full = chosenLevel('full');
    expect(full).toMatchObject({ level: 'full', lowPower: false, elapsedMs: 0 });
  });

  it('says what each level allows, dropping the costliest first', () => {
    expect(effectsFor('full')).toMatchObject({ postFx: true, maxResolution: 2, weather: 1 });
    expect(effectsFor('lite')).toMatchObject({ postFx: false, maxResolution: 2 });
    expect(effectsFor('lite').weather).toBeLessThan(1);
    expect(effectsFor('crisp')).toMatchObject({ postFx: false, maxResolution: 1 });
    expect(effectsFor('low')).toMatchObject({ postFx: false, maxResolution: 1, decor: false });
    expect(effectsFor('low').weather).toBeLessThan(effectsFor('crisp').weather);
    expect(['full', 'lite', 'crisp', 'low'].map((l) => effectsLabel(l as never))).toEqual([
      'full',
      'lite',
      'lite',
      'reduced',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { footstepSurface } from '@/application/footsteps';
import { createHarness, flush, Player } from '../../support/harness';

describe('footsteps', () => {
  it('sound like the ground underfoot', () => {
    expect(footstepSurface('paving')).toBe('stone');
    expect(footstepSurface('steps')).toBe('stone');
    expect(footstepSurface('road')).toBe('gravel');
    expect(footstepSurface('wadi')).toBe('gravel');
    expect(footstepSurface('sand')).toBe('sand');
    expect(footstepSurface('floor')).toBe('earth');
    expect(footstepSurface('grass')).toBe('grass');
    expect(footstepSurface('mud')).toBe('mud');
    expect(footstepSurface('rug')).toBe('mat');
    expect(footstepSurface('wall')).toBe('earth');
  });

  it('play when the world reports a footfall, for the tile it landed on', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    await p.exit('house-door');
    expect(p.scene()).toBe('jerusalem-market');
    // (3,5) is sand by the door, (12,8) paving in the square, (3,9) dry scrub.
    h.controller.handleWorldEvent({ type: 'footstep', x: 3, y: 5 });
    h.controller.handleWorldEvent({ type: 'footstep', x: 12, y: 8 });
    h.controller.handleWorldEvent({ type: 'footstep', x: 3, y: 9 });
    await flush();
    expect(h.audio.footsteps).toEqual(['sand', 'stone', 'earth']);
  });
});

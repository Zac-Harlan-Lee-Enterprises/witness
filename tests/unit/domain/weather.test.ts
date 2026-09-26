import { describe, expect, it } from 'vitest';
import { validateChapterIntegrity } from '@/domain/chapter-integrity';
import { weatherOf } from '@/domain/weather';
import { createHarness, flush, loadJericho, Player } from '../../support/harness';

const flag = (name: string) => ({ type: 'flag' as const, flag: name });

describe('weather driven by the story', () => {
  const scene = {
    weather: 'clear' as const,
    weatherChanges: [
      { when: flag('put-out'), weather: 'wind' as const },
      { when: flag('storm'), weather: 'storm' as const },
      { when: flag('calm'), weather: 'clear' as const },
    ],
  };
  const state = (flags: Record<string, boolean>) => {
    const s = structuredClone(loadJericho().initial) as unknown as Parameters<typeof weatherOf>[1];
    return { ...s, flags } as Parameters<typeof weatherOf>[1];
  };

  it('uses the base weather until a change applies, and the last matching change wins', () => {
    expect(weatherOf(scene, state({}))).toBe('clear');
    expect(weatherOf(scene, state({ 'put-out': true }))).toBe('wind');
    expect(weatherOf(scene, state({ 'put-out': true, storm: true }))).toBe('storm');
    expect(weatherOf(scene, state({ 'put-out': true, storm: true, calm: true }))).toBe('clear');
  });

  it('tells the world when the story changes the weather, and only then', async () => {
    const chapter = structuredClone(loadJericho());
    const house = chapter.scenes.find((s) => s.id === 'miriam-house');
    if (!house) throw new Error('no house');
    house.weatherChanges = [{ when: flag('test-storm'), weather: 'rain' }];
    const h = await createHarness({ chapter });
    expect(h.world.weather).toBe('clear');
    h.session.dispatch([{ type: 'setFlag', flag: 'unrelated', value: true }]);
    await flush();
    h.controller.handleWorldEvent({ type: 'playerMoved', x: 3, y: 5, facing: 'down' });
    expect(h.world.weathers).toEqual([]);
    h.session.dispatch([{ type: 'setFlag', flag: 'test-storm', value: true }]);
    await flush();
    h.controller.handleWorldEvent({ type: 'playerMoved', x: 3, y: 5, facing: 'down' });
    expect(h.world.weather).toBe('rain');
  });

  it("reports the new scene's weather after a scene change, not the last scene's", async () => {
    const chapter = structuredClone(loadJericho());
    const house = chapter.scenes.find((s) => s.id === 'miriam-house');
    if (!house) throw new Error('no house');
    house.weatherChanges = [{ when: flag('test-rain'), weather: 'rain' }];
    const h = await createHarness({ chapter });
    h.session.dispatch([{ type: 'setFlag', flag: 'test-rain', value: true }]);
    await flush();
    h.controller.handleWorldEvent({ type: 'playerMoved', x: 3, y: 5, facing: 'down' });
    expect(h.world.weather).toBe('rain');
    const p = new Player(h);
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    await p.exit('house-door');
    expect(h.world.currentScene).toBe('jerusalem-market');
    expect(h.world.weather).toBe('clear');
  });

  it('rejects a weather change that refers to something that does not exist', () => {
    const chapter = structuredClone(loadJericho());
    const house = chapter.scenes.find((s) => s.id === 'miriam-house');
    if (!house) throw new Error('no house');
    house.weatherChanges = [{ when: { type: 'hasItem', item: 'no-such-item' }, weather: 'storm' }];
    const issues = validateChapterIntegrity(chapter);
    expect(issues.some((i) => i.where.includes('weather change 0'))).toBe(true);
  });
});

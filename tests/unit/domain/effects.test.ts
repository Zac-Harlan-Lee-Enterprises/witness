import { describe, expect, it } from 'vitest';
import { applyEffect, TRUST_MAX, TRUST_MIN, type EffectContext } from '@/domain/effects';
import { makeState } from '../../support/state';

const ctx: EffectContext = { nowMs: 42, maxStack: (id) => (id === 'coins' ? 20 : 2) };

describe('effects', () => {
  it('sets flags and emits FlagChanged only on change', () => {
    const r1 = applyEffect(makeState(), { type: 'setFlag', flag: 'a', value: true }, ctx);
    expect(r1.state.flags.a).toBe(true);
    expect(r1.events).toEqual([{ type: 'FlagChanged', flag: 'a', value: true }]);
    const r2 = applyEffect(r1.state, { type: 'setFlag', flag: 'a', value: true }, ctx);
    expect(r2.events).toEqual([]);
    expect(r2.state).toBe(r1.state);
  });

  it('gives items up to the stack limit and reports what was added', () => {
    const r = applyEffect(
      makeState({ inventory: { oil: 1 } }),
      { type: 'giveItem', item: 'oil', quantity: 5 },
      ctx,
    );
    expect(r.state.inventory.oil).toBe(2);
    expect(r.events).toEqual([{ type: 'ItemCollected', itemId: 'oil', quantity: 1, total: 2 }]);
  });

  it('takes items and removes empty stacks', () => {
    const r = applyEffect(
      makeState({ inventory: { oil: 1 } }),
      { type: 'takeItem', item: 'oil' },
      ctx,
    );
    expect(r.state.inventory.oil).toBeUndefined();
    expect(r.events[0]).toMatchObject({ type: 'ItemRemoved', itemId: 'oil', total: 0 });
    expect(applyEffect(r.state, { type: 'takeItem', item: 'oil' }, ctx).events).toEqual([]);
  });

  it('clamps trust to a small readable range (a relationship, not a score)', () => {
    let s = makeState();
    s = applyEffect(s, { type: 'adjustTrust', character: 'm', delta: 99 }, ctx).state;
    expect(s.trust.m).toBe(TRUST_MAX);
    s = applyEffect(s, { type: 'adjustTrust', character: 'm', delta: -99 }, ctx).state;
    expect(s.trust.m).toBe(TRUST_MIN);
  });

  it('records a choice once, keeping the first answer', () => {
    const r1 = applyEffect(makeState(), { type: 'recordChoice', choice: 'c', option: 'a' }, ctx);
    const r2 = applyEffect(r1.state, { type: 'recordChoice', choice: 'c', option: 'b' }, ctx);
    expect(r2.state.choices).toEqual([
      { choiceId: 'c', optionId: 'a', sceneId: 'scene-a', atMs: 42 },
    ]);
    expect(r2.events).toEqual([]);
  });

  it('adjusts and sets counters', () => {
    let s = makeState({ counters: { hour: 8 } });
    s = applyEffect(s, { type: 'adjustCounter', counter: 'hour', delta: 3 }, ctx).state;
    expect(s.counters.hour).toBe(11);
    const r = applyEffect(s, { type: 'setCounter', counter: 'hour', value: 6 }, ctx);
    expect(r.events).toEqual([{ type: 'CounterChanged', counter: 'hour', from: 11, to: 6 }]);
  });

  it('turns UI-bound effects into request events without changing state', () => {
    const s = makeState();
    expect(applyEffect(s, { type: 'openPuzzle', puzzle: 'p' }, ctx)).toEqual({
      state: s,
      events: [{ type: 'PuzzleRequested', puzzleId: 'p' }],
    });
    expect(applyEffect(s, { type: 'transition', scene: 'b', spawn: 'x' }, ctx).events[0]).toEqual({
      type: 'SceneTransitionRequested',
      sceneId: 'b',
      spawnId: 'x',
    });
  });

  it('completes the chapter once and asks for a save', () => {
    const r = applyEffect(makeState(), { type: 'completeChapter' }, ctx);
    expect(r.state.chapterComplete).toBe(true);
    expect(r.events.map((e) => e.type)).toEqual(['ChapterCompleted', 'SaveRequested']);
    expect(applyEffect(r.state, { type: 'completeChapter' }, ctx).events).toEqual([]);
  });

  it('never mutates the input state', () => {
    const s = makeState({ inventory: { oil: 1 } });
    const frozen = structuredClone(s);
    applyEffect(s, { type: 'giveItem', item: 'oil' }, ctx);
    applyEffect(s, { type: 'discoverClue', clue: 'k' }, ctx);
    expect(s).toEqual(frozen);
  });
});

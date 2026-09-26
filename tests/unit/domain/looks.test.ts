import { describe, expect, it } from 'vitest';
import { playerMarks, resolveLook } from '@/domain/looks';
import type { Look } from '@/domain/world';
import { makeState } from '../../support/state';

const flag = (f: string) => ({ type: 'flag' as const, flag: f });

describe('looks: how the story shows on people', () => {
  const state = makeState({ flags: { tended: true, cloak: true } });
  const looks: Look[] = [
    { when: flag('tended'), marks: ['bandaged'] },
    { when: flag('cloak'), marks: ['wrapped-in-cloak', 'bandaged'] },
    { when: flag('resting'), pose: 'lie', marks: [] },
    { when: flag('tended'), pose: 'sit', facing: 'left', marks: [] },
  ];

  it('applies every look whose condition holds, later ones overriding pose and facing', () => {
    expect(resolveLook({ pose: 'stand', facing: 'down' }, looks, state)).toEqual({
      pose: 'sit',
      facing: 'left',
      marks: ['bandaged', 'wrapped-in-cloak'],
    });
  });

  it('keeps the base pose and facing when nothing applies', () => {
    const plain = { ...state, flags: {} };
    expect(resolveLook({ pose: 'lie', facing: 'right' }, looks, plain)).toEqual({
      pose: 'lie',
      facing: 'right',
      marks: [],
    });
  });

  it('gives the player only marks', () => {
    expect(playerMarks([{ when: flag('cloak'), marks: ['cloak-roll'] }], state)).toEqual([
      'cloak-roll',
    ]);
    expect(playerMarks([{ when: flag('nope'), marks: ['lamp'] }], state)).toEqual([]);
  });
});

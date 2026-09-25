import { describe, expect, it } from 'vitest';
import {
  conditionReferences,
  ConditionSchema,
  evaluate,
  type Condition,
} from '@/domain/conditions';
import { makeState } from '../../support/state';

describe('conditions', () => {
  const state = makeState({
    flags: { brave: true, route: 'ridge', zero: 0, off: false },
    inventory: { coins: 3, water: 1 },
    quests: {
      q1: {
        status: 'active',
        stageId: 's2',
        completedObjectives: ['o1'],
        outcomeId: null,
        startedAtMs: 0,
      },
    },
    choices: [{ choiceId: 'c1', optionId: 'a', sceneId: 'x', atMs: 0 }],
    clues: ['k1', 'k2'],
    puzzles: { p1: { status: 'solved', attempts: 2, hintsUsed: 0, solution: null } },
    visitedScenes: ['scene-a'],
    metCharacters: ['miriam'],
    conversations: ['d1'],
    counters: { hour: 17 },
    trust: { menashe: 2 },
    journal: { unlocked: ['j1'], seen: [] },
  });

  const cases: Array<[string, Condition, boolean]> = [
    ['always', { type: 'always' }, true],
    ['flag truthy', { type: 'flag', flag: 'brave' }, true],
    ['flag false is falsy', { type: 'flag', flag: 'off' }, false],
    ['flag missing', { type: 'flag', flag: 'nope' }, false],
    ['flag equals string', { type: 'flag', flag: 'route', equals: 'ridge' }, true],
    ['flag equals mismatch', { type: 'flag', flag: 'route', equals: 'wadi' }, false],
    ['flag equals 0', { type: 'flag', flag: 'zero', equals: 0 }, true],
    ['hasItem default min', { type: 'hasItem', item: 'water' }, true],
    ['hasItem min', { type: 'hasItem', item: 'coins', min: 4 }, false],
    ['questStatus active', { type: 'questStatus', quest: 'q1', status: 'active' }, true],
    [
      'questStatus inactive default',
      { type: 'questStatus', quest: 'qx', status: 'inactive' },
      true,
    ],
    ['questStage', { type: 'questStage', quest: 'q1', stage: 's2' }, true],
    ['objectiveDone', { type: 'objectiveDone', quest: 'q1', objective: 'o1' }, true],
    ['choiceMade any', { type: 'choiceMade', choice: 'c1' }, true],
    ['choiceMade option', { type: 'choiceMade', choice: 'c1', option: 'b' }, false],
    ['clueFound', { type: 'clueFound', clue: 'k2' }, true],
    ['cluesFound min', { type: 'cluesFound', clues: ['k1', 'k2', 'k3'], min: 2 }, true],
    ['cluesFound not enough', { type: 'cluesFound', clues: ['k1', 'k3'], min: 2 }, false],
    ['puzzleSolved', { type: 'puzzleSolved', puzzle: 'p1' }, true],
    ['visited', { type: 'visited', scene: 'scene-a' }, true],
    ['met', { type: 'met', character: 'miriam' }, true],
    ['conversationDone', { type: 'conversationDone', dialogue: 'd1' }, true],
    ['counter gte', { type: 'counter', counter: 'hour', gte: 17 }, true],
    ['counter lte', { type: 'counter', counter: 'hour', lte: 16 }, false],
    ['counter missing = 0', { type: 'counter', counter: 'none', eq: 0 }, true],
    ['trust', { type: 'trust', character: 'menashe', gte: 2 }, true],
    ['journalUnlocked', { type: 'journalUnlocked', entry: 'j1' }, true],
    ['all', { type: 'all', of: [{ type: 'always' }, { type: 'flag', flag: 'brave' }] }, true],
    [
      'any',
      {
        type: 'any',
        of: [
          { type: 'flag', flag: 'nope' },
          { type: 'flag', flag: 'brave' },
        ],
      },
      true,
    ],
    ['not', { type: 'not', condition: { type: 'flag', flag: 'brave' } }, false],
  ];

  it.each(cases)('%s', (_name, condition, expected) => {
    expect(evaluate(condition, state)).toBe(expected);
  });

  it('treats a missing condition as true', () => {
    expect(evaluate(undefined, state)).toBe(true);
  });

  it('validates with the schema and rejects executable-looking content', () => {
    expect(
      ConditionSchema.safeParse({ type: 'all', of: [{ type: 'flag', flag: 'x' }] }).success,
    ).toBe(true);
    expect(ConditionSchema.safeParse({ type: 'script', code: 'alert(1)' }).success).toBe(false);
    expect(ConditionSchema.safeParse({ type: 'flag' }).success).toBe(false);
  });

  it('collects references for integrity checks', () => {
    const refs = conditionReferences({
      type: 'all',
      of: [
        { type: 'hasItem', item: 'oil' },
        { type: 'not', condition: { type: 'met', character: 'malik' } },
        { type: 'cluesFound', clues: ['a', 'b'], min: 1 },
      ],
    });
    expect([...refs.items]).toEqual(['oil']);
    expect([...refs.characters]).toEqual(['malik']);
    expect([...refs.clues]).toEqual(['a', 'b']);
  });
});

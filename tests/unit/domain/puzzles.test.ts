import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import {
  applyMeasure,
  checkDeduction,
  checkPacking,
  checkSequence,
  classifyPacking,
  hintFor,
  initialLevels,
  isMeasureSolved,
  type DeductionPuzzle,
  type MeasuringPuzzle,
  type PackingPuzzle,
  type SequencePuzzle,
} from '@/domain/puzzles';
import { packingEffects } from '@/domain/puzzle-base';
import { makeState } from '../../support/state';

const chapter = parseChapter(ROAD_TO_JERICHO);
const get = <T>(id: string) => chapter.puzzles.find((p) => p.id === id) as T;
const weights = (id: string) => chapter.items.find((i) => i.id === id)?.weight ?? 0;

describe('packing puzzle', () => {
  const puzzle = get<PackingPuzzle>('p-satchel');

  it('requires the remedy, enough water and a load within capacity', () => {
    const s = makeState();
    expect(
      checkPacking(puzzle, { 'water-skin': 2 }, s, weights).failures.map((f) => f.ruleId),
    ).toEqual(['remedy']);
    expect(
      checkPacking(puzzle, { remedy: 1, 'water-skin': 2, cloak: 1 }, s, weights).failures.map(
        (f) => f.ruleId,
      ),
    ).toEqual(['capacity']);
    expect(
      checkPacking(puzzle, { remedy: 1, 'water-skin': 1 }, s, weights).failures.map(
        (f) => f.ruleId,
      ),
    ).toEqual(['water']);
    expect(checkPacking(puzzle, { remedy: 1, 'water-skin': 2, bread: 1 }, s, weights).valid).toBe(
      true,
    );
  });

  it('accepts one water skin once the player knows about the cistern (knowledge changes what is enough)', () => {
    const informed = makeState({ clues: ['clue-cistern'] });
    const result = checkPacking(
      puzzle,
      { remedy: 1, 'water-skin': 1, linen: 1, oil: 1, bread: 1 },
      informed,
      weights,
    );
    expect(result).toMatchObject({ valid: true, weight: 6 });
  });

  it('classifies the packing into a recorded choice option', () => {
    const s = makeState({ clues: ['clue-cistern'] });
    expect(
      classifyPacking(puzzle, { remedy: 1, 'water-skin': 1, linen: 1, oil: 1 }, s, weights),
    ).toBe('care-kit');
    expect(classifyPacking(puzzle, { remedy: 1, 'water-skin': 1, oil: 1 }, s, weights)).toBe(
      'some-care',
    );
    expect(classifyPacking(puzzle, { remedy: 1, 'water-skin': 2, bread: 1 }, s, weights)).toBe(
      'provisions',
    );
    expect(classifyPacking(puzzle, { remedy: 1, 'water-skin': 2, lamp: 1 }, s, weights)).toBe(
      'warmth-light',
    );
    expect(classifyPacking(puzzle, { remedy: 1, 'water-skin': 2 }, s, weights)).toBe('water-only');
  });

  it('leaves unpacked weighted items at home but keeps weightless ones', () => {
    const effects = packingEffects(
      { remedy: 1, 'water-skin': 2, cloak: 1, coins: 5 },
      { remedy: 1, 'water-skin': 1 },
      weights,
    );
    expect(effects).toEqual([
      { type: 'takeItem', item: 'water-skin', quantity: 1 },
      { type: 'takeItem', item: 'cloak', quantity: 1 },
    ]);
  });
});

describe('measuring puzzle', () => {
  const puzzle = get<MeasuringPuzzle>('p-measure');

  it('pours correctly and can reach exactly 4', () => {
    let levels = initialLevels(puzzle);
    levels = applyMeasure(puzzle, levels, { type: 'fill', vessel: 'crock' });
    levels = applyMeasure(puzzle, levels, { type: 'pour', from: 'crock', to: 'pitcher' });
    expect(levels).toEqual({ crock: 2, pitcher: 3 });
    levels = applyMeasure(puzzle, levels, { type: 'empty', vessel: 'pitcher' });
    levels = applyMeasure(puzzle, levels, { type: 'pour', from: 'crock', to: 'pitcher' });
    levels = applyMeasure(puzzle, levels, { type: 'fill', vessel: 'crock' });
    levels = applyMeasure(puzzle, levels, { type: 'pour', from: 'crock', to: 'pitcher' });
    expect(levels).toEqual({ crock: 4, pitcher: 3 });
    expect(isMeasureSolved(puzzle, levels)).toBe(true);
  });

  it('ignores pouring a vessel into itself', () => {
    const levels = { crock: 3, pitcher: 0 };
    expect(applyMeasure(puzzle, levels, { type: 'pour', from: 'crock', to: 'crock' })).toBe(levels);
  });

  it('offers tiered hints, with the full method only last', () => {
    expect(hintFor(puzzle, 1)).toMatch(/What amounts CAN you make/);
    expect(hintFor(puzzle, 3)).toMatch(/Full method/);
    expect(hintFor(puzzle, 9)).toMatch(/Full method/);
  });
});

describe('route deduction puzzle', () => {
  const puzzle = get<DeductionPuzzle>('p-route');
  const clues = [
    'clue-cairn',
    'clue-mud-line',
    'clue-wadi-fastest',
    'clue-bend-watchers',
    'clue-caravan',
  ];
  const state = makeState({ clues });

  it('explains wrong answers by pointing at evidence, not by revealing the answer', () => {
    const r = checkDeduction(puzzle, 'wadi', ['clue-mud-line'], state);
    expect(r.correct).toBe(false);
    expect(r.feedback[0]).toMatch(/wadi’s walls/);
  });

  it('requires enough reliable, relevant evidence', () => {
    expect(checkDeduction(puzzle, 'ridge', ['clue-cairn'], state).correct).toBe(false);
    expect(checkDeduction(puzzle, 'ridge', ['clue-cairn', 'clue-mud-line'], state).correct).toBe(
      true,
    );
    expect(
      checkDeduction(puzzle, 'ridge', ['clue-cairn', 'clue-bend-watchers'], state).correct,
    ).toBe(true);
  });

  it('rejects unreliable testimony and irrelevant clues with an explanation', () => {
    const r = checkDeduction(
      puzzle,
      'ridge',
      ['clue-cairn', 'clue-mud-line', 'clue-wadi-fastest'],
      state,
    );
    expect(r.correct).toBe(false);
    expect(r.feedback.join(' ')).toMatch(/never actually walked the wadi/);
    // An irrelevant clue doesn't spoil a sound argument, but the player is told.
    const r2 = checkDeduction(
      puzzle,
      'ridge',
      ['clue-cairn', 'clue-mud-line', 'clue-caravan'],
      state,
    );
    expect(r2.correct).toBe(true);
    expect(r2.feedback.join(' ')).toMatch(/does not bear/);
  });

  it('ignores clues the player has not actually found', () => {
    const r = checkDeduction(puzzle, 'ridge', ['clue-map', 'clue-cistern'], makeState());
    expect(r.correct).toBe(false);
  });
});

describe('what-happened sequence puzzle', () => {
  const puzzle = get<SequencePuzzle>('p-what-happened');

  it('counts correct positions and explains the first misplaced event', () => {
    const r = checkSequence(puzzle, puzzle.initialOrder);
    expect(r.correct).toBe(false);
    expect(r.feedback).toMatch(/events are in the right place/);
    expect(checkSequence(puzzle, puzzle.correctOrder).correct).toBe(true);
  });

  it('has a conclusion that explicitly states its uncertainty', () => {
    const correct = puzzle.conclusion?.options.filter((o) => o.correct) ?? [];
    expect(correct).toHaveLength(1);
    expect(correct[0]?.text).toMatch(/can’t be completely sure/);
  });
});

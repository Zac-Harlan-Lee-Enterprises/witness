import { describe, expect, it } from 'vitest';
import {
  applyDip,
  checkDyeing,
  describeLevels,
  DyeingPuzzleSchema,
  shadeName,
  shortestDyeings,
  undyed,
} from '@/domain/puzzle-dyeing';
import {
  checkFloorplan,
  classifyFloorplan,
  FloorplanPuzzleSchema,
  floorplanLayouts,
  placementCells,
  placementProblem,
  placePiece,
  shapeCells,
} from '@/domain/puzzle-floorplan';
import {
  checkLogicGrid,
  LogicGridPuzzleSchema,
  logicGridSolutions,
} from '@/domain/puzzle-logic-grid';
import { checkMapStop, exitsFrom, MapPuzzleSchema, turnedTo, walk } from '@/domain/puzzle-map';
import {
  checkNetting,
  cycleNetCell,
  initialNet,
  netClues,
  NettingPuzzleSchema,
  nettingSolutions,
  runsOf,
} from '@/domain/puzzle-netting';
import {
  checkTrim,
  classifyTrim,
  moveCargo,
  TrimPuzzleSchema,
  trimAboard,
} from '@/domain/puzzle-trim';
import { makeState } from '../../support/state';

const base = {
  title: 'T',
  intro: 'I',
  explanation: 'E',
  hints: [
    { tier: 1, text: 'a' },
    { tier: 2, text: 'b' },
  ],
};

describe('trim puzzle', () => {
  const puzzle = TrimPuzzleSchema.parse({
    ...base,
    id: 'p-trim',
    type: 'trim',
    capacity: 4,
    places: [
      { id: 'bow', label: 'Bow', limit: 2 },
      { id: 'stern', label: 'Stern', limit: 2 },
    ],
    crew: [{ id: 'skipper', name: 'Skipper', place: 'stern', weight: 1 }],
    balance: [
      {
        id: 'level',
        description: 'Level',
        between: ['bow', 'stern'],
        tolerance: 0,
        failureHint: 'Down by one end.',
      },
    ],
    rules: [
      {
        id: 'bailer',
        description: 'Take the bailer',
        rule: { type: 'includes', item: 'bailer' },
        failureHint: 'Bailer!',
      },
    ],
    choiceId: 'choice',
    classifications: [
      { option: 'heavy', rule: { type: 'includes', item: 'jar', min: 2 } },
      { option: 'light', rule: { type: 'withinCapacity' } },
    ],
  });
  const weight = (id: string) => ({ jar: 1, bailer: 1, oar: 2 })[id] ?? 0;
  const owned = { jar: 3, bailer: 1, oar: 1 };

  it('moves one thing at a time between the jetty and the places, never more than you own', () => {
    let load = moveCargo({}, owned, 'jar', null, 'bow');
    load = moveCargo(load, owned, 'jar', null, 'bow');
    expect(load).toEqual({ bow: { jar: 2 } });
    load = moveCargo(load, owned, 'jar', 'bow', 'stern');
    expect(load).toEqual({ bow: { jar: 1 }, stern: { jar: 1 } });
    load = moveCargo(load, owned, 'jar', 'stern', null);
    expect(trimAboard(load)).toEqual({ jar: 1 });
    // Nothing to move: unchanged.
    expect(moveCargo(load, owned, 'jar', 'stern', 'bow')).toBe(load);
    const full = moveCargo(moveCargo(load, owned, 'jar', null, 'bow'), owned, 'jar', null, 'bow');
    expect(moveCargo(full, owned, 'jar', null, 'bow')).toBe(full);
  });

  it('counts the crew in the balance, and reports rules, crowding and balance in turn', () => {
    const s = makeState();
    expect(checkTrim(puzzle, { bow: { jar: 1 } }, s, weight).failures.map((f) => f.ruleId)).toEqual(
      ['bailer'],
    );
    expect(
      checkTrim(puzzle, { bow: { jar: 1, bailer: 1 } }, s, weight).failures.map((f) => f.ruleId),
    ).toEqual(['level']);
    expect(
      checkTrim(puzzle, { bow: { oar: 1, jar: 1 }, stern: { bailer: 1 } }, s, weight).failures.map(
        (f) => f.ruleId,
      ),
    ).toEqual(['room:bow', 'level']);
    const good = { bow: { jar: 2 }, stern: { bailer: 1 } };
    const result = checkTrim(puzzle, good, s, weight);
    expect(result).toMatchObject({ valid: true, weight: 3 });
    expect(result.places.map((p) => p.total)).toEqual([2, 2]);
    expect(classifyTrim(puzzle, good, s, weight)).toBe('heavy');
  });

  it('fails a load past the capacity through the withinCapacity rule', () => {
    const capped = TrimPuzzleSchema.parse({
      ...puzzle,
      capacity: 2,
      rules: [
        ...puzzle.rules,
        {
          id: 'cap',
          description: 'Within',
          rule: { type: 'withinCapacity' },
          failureHint: 'Too much',
        },
      ],
    });
    const load = { bow: { jar: 2 }, stern: { bailer: 1 } };
    expect(checkTrim(capped, load, makeState(), weight).failures.map((f) => f.ruleId)).toEqual([
      'cap',
    ]);
  });
});

describe('netting puzzle', () => {
  const puzzle = NettingPuzzleSchema.parse({
    ...base,
    id: 'p-net',
    type: 'netting',
    pattern: ['##.', '.##', '#.#'],
    torn: ['??.', '.??', '#.#'],
  });

  it('derives the numbers from the pattern', () => {
    expect(runsOf([true, true, false, true])).toEqual([2, 1]);
    expect(netClues(puzzle)).toEqual({
      rows: [[2], [2], [1, 1]],
      columns: [[1, 1], [2], [2]],
    });
  });

  it('starts with torn cells undecided and cycles only torn cells', () => {
    const net = initialNet(puzzle);
    expect(net[0]).toEqual(['unknown', 'unknown', 'open']);
    expect(net[2]).toEqual(['knot', 'open', 'knot']);
    const once = cycleNetCell(puzzle, net, 0, 0);
    expect(once[0]?.[0]).toBe('knot');
    expect(cycleNetCell(puzzle, once, 0, 0)[0]?.[0]).toBe('open');
    expect(cycleNetCell(puzzle, cycleNetCell(puzzle, once, 0, 0), 0, 0)[0]?.[0]).toBe('unknown');
    expect(cycleNetCell(puzzle, net, 2, 0)).toEqual(net);
  });

  it('is solved when every row and column matches, and has exactly one answer', () => {
    let net = initialNet(puzzle);
    expect(checkNetting(puzzle, net).solved).toBe(false);
    for (const [r, c] of [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ] as const)
      net = cycleNetCell(puzzle, net, r, c);
    const result = checkNetting(puzzle, net);
    expect(result.solved).toBe(true);
    expect(result.rows.every((r) => r.matches)).toBe(true);
    expect(nettingSolutions(puzzle)).toEqual([['##.', '.##', '#.#']]);
  });
});

describe('floor plan puzzle', () => {
  const puzzle = FloorplanPuzzleSchema.parse({
    ...base,
    id: 'p-floor',
    type: 'floorplan',
    floor: ['...', '.P.'],
    fixtures: [{ symbol: 'P', label: 'the post' }],
    pieces: [
      { item: 'bed', label: 'Bed', shape: ['###'] },
      { item: 'jar', label: 'Jar', shape: ['#'] },
    ],
    rules: [
      {
        id: 'bed',
        description: 'The bed is in',
        rule: { type: 'includes', item: 'bed' },
        failureHint: 'Bed!',
      },
    ],
    choiceId: 'choice',
    classifications: [
      { option: 'kept-jar', rule: { type: 'includes', item: 'jar' } },
      { option: 'space', rule: { type: 'withinCapacity' } },
    ],
  });

  it('turns shapes a quarter at a time', () => {
    expect(shapeCells(['###'], 0)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    expect(shapeCells(['###'], 1)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(shapeCells(['#.', '##'], 2)).toEqual([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
  });

  it('says why a piece will not fit: off the floor, on a fixed thing, or on another piece', () => {
    expect(placementProblem(puzzle, [], { item: 'bed', row: 0, col: 1, turns: 0 })).toEqual({
      kind: 'outside',
    });
    expect(placementProblem(puzzle, [], { item: 'bed', row: 1, col: 0, turns: 0 })).toEqual({
      kind: 'fixture',
      label: 'the post',
    });
    const bed = { item: 'bed', row: 0, col: 0, turns: 0 };
    expect(placementProblem(puzzle, [bed], { item: 'jar', row: 0, col: 2, turns: 0 })).toEqual({
      kind: 'overlap',
      item: 'bed',
    });
    expect(placementCells(puzzle, bed)).toHaveLength(3);
    // placePiece ignores a placement that doesn't fit, and moves a piece that does.
    expect(placePiece(puzzle, [bed], { item: 'jar', row: 0, col: 2, turns: 0 })).toEqual([bed]);
    expect(placePiece(puzzle, [bed], { item: 'jar', row: 1, col: 2, turns: 0 })).toHaveLength(2);
  });

  it('checks the loadout rules and classifies what is on the floor', () => {
    const s = makeState();
    expect(checkFloorplan(puzzle, [], s).failures.map((f) => f.ruleId)).toEqual(['bed']);
    const plan = [
      { item: 'bed', row: 0, col: 0, turns: 0 },
      { item: 'jar', row: 1, col: 0, turns: 0 },
    ];
    expect(checkFloorplan(puzzle, plan, s)).toMatchObject({
      valid: true,
      placed: { bed: 1, jar: 1 },
    });
    expect(classifyFloorplan(puzzle, plan, s)).toBe('kept-jar');
    expect(classifyFloorplan(puzzle, plan.slice(0, 1), s)).toBe('space');
    const clash = [plan[0], { item: 'jar', row: 0, col: 1, turns: 0 }] as typeof plan;
    expect(checkFloorplan(puzzle, clash, s).failures.map((f) => f.ruleId)).toEqual(['fit']);
  });

  it('can list every layout of a set of pieces', () => {
    expect(floorplanLayouts(puzzle, ['bed'])).toHaveLength(1);
    expect(floorplanLayouts(puzzle, ['bed', 'jar'])).toHaveLength(2);
  });
});

describe('logic grid puzzle', () => {
  const puzzle = LogicGridPuzzleSchema.parse({
    ...base,
    id: 'p-logic',
    type: 'logicGrid',
    subjectsLabel: 'Who',
    optionsLabel: 'Place',
    subjects: [
      { id: 'a', label: 'Asa' },
      { id: 'b', label: 'Bela' },
      { id: 'c', label: 'Chava' },
    ],
    options: [
      { id: 'p1', label: 'First', position: 1 },
      { id: 'p2', label: 'Second', position: 2 },
      { id: 'p3', label: 'Third', position: 3 },
    ],
    clues: [
      { id: 'c1', text: 'Asa is not first.', rule: { type: 'isNot', subject: 'a', option: 'p1' } },
      { id: 'c2', text: 'Bela sits before Asa.', rule: { type: 'before', a: 'b', b: 'a' } },
      { id: 'c3', text: 'Chava is next to Asa.', rule: { type: 'nextTo', a: 'c', b: 'a' } },
      {
        id: 'c4',
        text: 'Chava is at an end.',
        rule: { type: 'oneOf', subject: 'c', options: ['p1', 'p3'] },
      },
    ],
    answer: { a: 'p2', b: 'p1', c: 'p3' },
  });

  it('has exactly one assignment that keeps every clue', () => {
    expect(logicGridSolutions(puzzle)).toEqual([{ a: 'p2', b: 'p1', c: 'p3' }]);
  });

  it('asks for a complete assignment, then names a clue that is broken', () => {
    expect(checkLogicGrid(puzzle, { a: 'p1' })).toMatchObject({ correct: false, complete: false });
    expect(checkLogicGrid(puzzle, { a: 'p1', b: 'p1', c: 'p3' }).complete).toBe(false);
    const wrong = checkLogicGrid(puzzle, { a: 'p1', b: 'p2', c: 'p3' });
    expect(wrong).toMatchObject({ correct: false, complete: true, broken: ['c1', 'c2', 'c3'] });
    expect(wrong.feedback).toContain('Asa is not first.');
    expect(checkLogicGrid(puzzle, puzzle.answer).correct).toBe(true);
  });
});

describe('dyeing puzzle', () => {
  const puzzle = DyeingPuzzleSchema.parse({
    ...base,
    id: 'p-dye',
    type: 'dyeing',
    colours: [
      { id: 'red', label: 'red' },
      { id: 'blue', label: 'blue' },
    ],
    max: 4,
    baths: [
      { id: 'madder', label: 'Madder', description: 'red', change: { red: 2 } },
      { id: 'blue', label: 'Blue', description: 'blue', change: { blue: 2 } },
      { id: 'rinse', label: 'Rinse', description: 'lighter', change: { red: -1, blue: -1 } },
    ],
    target: { red: 3, blue: 2 },
    maxDips: 4,
    shades: [{ name: 'mulberry', levels: { red: 3, blue: 2 } }],
  });

  it('adds and takes out colour, within 0 and the maximum', () => {
    const s = applyDip(puzzle, undyed(puzzle), 'rinse');
    expect(s).toEqual({ red: 0, blue: 0 });
    const deep = ['madder', 'madder', 'madder'].reduce((x, b) => applyDip(puzzle, x, b), s);
    expect(deep.red).toBe(4);
    expect(() => applyDip(puzzle, s, 'nope')).toThrow();
  });

  it('names shades and always describes their levels in words', () => {
    expect(shadeName(puzzle, { red: 3, blue: 2 })).toBe('mulberry');
    expect(shadeName(puzzle, { red: 1, blue: 0 })).toBeNull();
    expect(describeLevels(puzzle, { red: 1, blue: 0 })).toBe('red 1, blue 0');
  });

  it('is solved only by reaching the target within the dips allowed', () => {
    expect(checkDyeing(puzzle, ['madder', 'madder', 'blue'])).toMatchObject({
      solved: false,
      dipsLeft: 1,
    });
    expect(checkDyeing(puzzle, ['madder', 'rinse', 'madder', 'blue']).solved).toBe(true);
    expect(checkDyeing(puzzle, ['blue', 'madder', 'madder', 'rinse', 'blue']).solved).toBe(false);
    expect(shortestDyeings(puzzle).every((d) => d.length === 4)).toBe(true);
  });
});

describe('map puzzle', () => {
  const puzzle = MapPuzzleSchema.parse({
    ...base,
    id: 'p-map',
    type: 'map',
    map: ['H#M#G', '..#..', '..W..'],
    landmarks: [
      { id: 'gate', label: 'the gate', x: 4, y: 0 },
      { id: 'mile', label: 'a milestone', x: 2, y: 0 },
      { id: 'hut', label: 'a hut', x: 0, y: 0 },
      { id: 'works', label: 'the dye works', x: 2, y: 2 },
    ],
    start: { x: 4, y: 0, facing: 'west' },
    goal: 'works',
    directions: ['West to the milestone, then left.'],
    wrongStops: { hut: 'Too far.' },
  });

  it('walks on to the next landmark or junction, facing the way it went', () => {
    expect(exitsFrom(puzzle, 4, 0)).toEqual(['west']);
    expect(walk(puzzle, puzzle.start, 'north')).toBeNull();
    const mile = walk(puzzle, puzzle.start, 'west');
    expect(mile).toEqual({ position: { x: 2, y: 0, facing: 'west' }, steps: 2 });
    const works = mile && walk(puzzle, mile.position, turnedTo('west', 'left'));
    expect(works?.position).toEqual({ x: 2, y: 2, facing: 'south' });
  });

  it('turns relative directions into compass directions', () => {
    expect(turnedTo('west', 'left')).toBe('south');
    expect(turnedTo('west', 'right')).toBe('north');
    expect(turnedTo('north', 'back')).toBe('south');
  });

  it('accepts only the goal, with feedback for wrong stops', () => {
    expect(checkMapStop(puzzle, { x: 2, y: 2 }).correct).toBe(true);
    expect(checkMapStop(puzzle, { x: 0, y: 0 })).toEqual({ correct: false, feedback: 'Too far.' });
    expect(checkMapStop(puzzle, { x: 2, y: 0 }).feedback).toContain('a milestone');
    expect(checkMapStop(puzzle, { x: 1, y: 0 }).feedback).toContain('nothing here');
  });
});

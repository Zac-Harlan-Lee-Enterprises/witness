import { describe, expect, it } from 'vitest';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';
import { applyMeasure, initialLevels, type MeasuringPuzzle } from '@/domain/puzzles';
import { createHarness, flush, loadChapter, Player } from '../support/harness';
import { BRISK, PlayMeter, STEADY, type PlayTime } from '../support/play-time';

/**
 * How long a first-time player's run lasts (tests/support/play-time.ts has
 * the model). Each run is a curious first-timer's: they talk to the people
 * the story points them to, take up the errands they're offered and look at
 * what they pass, but they don't replay branches.
 */

async function roadToJericho(): Promise<PlayMeter> {
  const h = await createHarness();
  const meter = new PlayMeter(h);
  const p = new Player(h);
  await p.choose('c-yes');
  await p.choose('c-what');
  await p.choose('c-rivka');
  await p.choose('c-go');
  await p.finish();
  await p.interact('herbs');
  await p.exit('house-door');

  await p.interact('shimon');
  await p.choose('advice');
  await p.choose('water');
  await p.choose('weight');
  await p.choose('favor');
  await p.choose('yes');
  await p.choose('bye');
  await p.finish();
  await p.interact('malik');
  await p.choose('road');
  await p.choose('caravan');
  await p.choose('watch');
  await p.choose('sell');
  await p.choose('buy');
  await p.choose('bye');
  await p.finish();
  await p.interact('tobiah');
  await p.choose('walked');
  await p.choose('why');
  await p.finish();
  await p.interact('hadassah');
  await p.choose('rivka');
  await p.choose('heavy');
  await p.choose('use');
  await p.choose('buy');
  await p.choose('argument');
  await p.choose('talked');
  await p.choose('bye');
  await p.finish();
  await p.interact('hanan');
  await p.choose('jericho');
  await p.choose('law');
  await p.choose('neighbor');
  await p.choose('another');
  await p.choose('hard');
  await p.choose('bye');
  await p.finish();
  await p.interact('ezer');
  await p.choose('how');
  await p.choose('help');
  await p.choose('ok');
  await p.finish();
  await p.interact('menashe');
  await p.choose('from');
  await p.choose('bye');
  await p.finish();
  await p.interact('vessels');
  const puzzle = h.puzzles.find('p-measure') as MeasuringPuzzle;
  let levels = initialLevels(puzzle);
  for (const s of [
    { type: 'fill', vessel: 'crock' },
    { type: 'pour', from: 'crock', to: 'pitcher' },
    { type: 'empty', vessel: 'pitcher' },
    { type: 'pour', from: 'crock', to: 'pitcher' },
    { type: 'fill', vessel: 'crock' },
    { type: 'pour', from: 'crock', to: 'pitcher' },
  ] as const)
    levels = applyMeasure(puzzle, levels, s);
  expect(h.puzzles.submitMeasure('p-measure', levels)).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('ezer');
  await p.choose('tell');
  await p.finish();
  await p.interact('well');
  await p.interact('gate-sign');

  await p.exit('to-house');
  await p.interact('miriam');
  await p.choose('how-much');
  await p.choose('ok');
  await p.finish();
  await p.interact('satchel');
  expect(
    h.puzzles.submitPacking('p-satchel', {
      remedy: 1,
      'linen-bundle': 1,
      'water-skin': 1,
      oil: 1,
      bread: 1,
    })?.valid,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('miriam');
  await p.choose('salome');
  await p.choose('will');
  await p.finish();
  await p.exit('house-door');
  await p.exit('east-gate');

  await p.step(12, 13);
  await p.finish();
  for (const id of ['cairn', 'clouds', 'wadi-edge', 'bend-entrance', 'red-rocks'])
    await p.interact(id);
  await p.interact('crossroads');
  expect(
    h.puzzles.submitDeduction('p-route', 'ridge', ['clue-cairn', 'clue-mud-line'])?.correct,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.step(20, 4);
  await p.step(24, 4);
  await p.interact('cistern');
  await p.step(30, 4);
  await p.choose('share');
  await p.choose('message');
  await p.choose('sheep');
  await p.choose('bye');
  await p.finish();
  await p.step(38, 9);
  await p.finish();
  for (const id of ['single-prints', 'broken-jar', 'many-prints']) await p.interact(id);
  await p.choose('later');
  await p.finish();
  await p.interact('cut-purse');
  await p.interact('torn-cloth');
  await p.interact('drag-marks');
  await p.interact('menashe-road');
  await p.choose('sip');
  await p.choose('think');
  await p.finish();
  const seq = h.puzzles.find('p-what-happened');
  if (seq?.type !== 'sequence') throw new Error('expected sequence');
  expect(h.puzzles.submitSequence('p-what-happened', seq.correctOrder)?.correct).toBe(true);
  expect(h.puzzles.submitConclusion('p-what-happened', 'left')?.correct).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('menashe-road');
  await p.choose('tend-caravan');
  await p.choose('cut');
  await p.choose('robbed');
  await p.finish();

  await p.step(1, 10);
  await p.advance();
  await p.choose('thanks');
  await p.finish();
  await p.interact('striped-cloak');
  await p.choose('later');
  await p.finish();
  await p.interact('salome');
  await p.choose('cloak');
  await p.choose('bend');
  await p.choose('miriam');
  await p.choose('thanks');
  await p.finish();
  await p.interact('striped-cloak');
  await p.choose('now');
  await p.finish();
  expect(
    h.puzzles.submitDeduction('p-cloak', 'menashe', ['clue-cloak-hem', 'clue-torn-cloth'])?.correct,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('salome');
  await p.choose('whose');
  await p.choose('menashe');
  await p.choose('thanks');
  await p.finish();
  await p.interact('menashe-inn');
  await p.choose('evidence');
  await p.choose('ok');
  await p.choose('rest');
  await p.finish();
  await p.interact('malik-inn');
  await p.finish();
  await p.interact('spring');
  await p.interact('natan');
  await p.choose('ok');
  await p.finish();
  await p.interact('rivka');
  await p.choose('explain');
  await p.choose('man');
  await p.finish();
  await p.interact('natan');
  for (const c of ['eli', 'robbed', 'name', 'oil', 'yes']) await p.choose(c);
  await p.choose('samaritan');
  await p.finish();
  h.controller.panelFinished('scripture-connection');
  h.controller.panelFinished('reflection');
  await flush();
  expect(h.state().chapterComplete).toBe(true);
  return meter;
}

async function stormOnGalilee(): Promise<PlayMeter> {
  const h = await createHarness({ chapter: loadChapter(STORM_ON_GALILEE) });
  const meter = new PlayMeter(h);
  const p = new Player(h);
  await p.choose('c-who');
  await p.choose('c-ready');
  await p.choose('c-lamp');
  await p.choose('c-go');
  await p.choose('c-knots');
  await p.finish();
  expect(p.mendNet('p-corner')?.solved).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('mending');
  await p.finish();
  await p.interact('dried-fish');
  await p.exit('house-door');

  await p.interact('elazar');
  await p.choose('how-much');
  await p.choose('fee');
  await p.choose('others');
  await p.choose('bye');
  await p.finish();
  await p.interact('hodaya');
  await p.choose('why');
  await p.choose('help');
  await p.choose('teacher');
  await p.choose('bye');
  await p.finish();
  await p.interact('oded');
  await p.choose('bail');
  await p.choose('seal');
  await p.choose('find');
  await p.finish();
  await p.interact('elazar');
  await p.choose('seam');
  await p.choose('bye');
  await p.finish();
  await p.interact('tamar');
  await p.choose('sail');
  await p.choose('boat');
  await p.choose('bye');
  await p.finish();
  await p.interact('yoezer');
  await p.choose('storm');
  await p.choose('bye');
  await p.finish();
  await p.interact('nikanor');
  await p.choose('weather');
  await p.choose('often');
  await p.choose('salt');
  await p.choose('pitch');
  await p.choose('help');
  await p.choose('yes');
  await p.finish();
  await p.interact('brine-jars');
  expect(p.mendNet('p-brine')?.solved).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('nikanor');
  await p.finish();
  await p.interact('fish-rack');
  await p.interact('teacher-boat');
  await p.finish();
  await p.interact('dinah');
  await p.choose('what');
  await p.finish();
  await p.interact('shifra');
  await p.choose('home');
  await p.choose('heard');
  await p.choose('bye');
  await p.finish();
  await p.interact('ami');
  await p.choose('yes');
  await p.finish();
  await p.interact('oded');
  await p.choose('give-bailer');
  await p.choose('patch');
  await p.finish();
  const patch = h.puzzles.find('p-patch');
  if (patch?.type !== 'sequence') throw new Error('expected sequence');
  expect(h.puzzles.submitSequence('p-patch', patch.correctOrder)?.correct).toBe(true);
  expect(h.puzzles.submitConclusion('p-patch', 'mostly')?.correct).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('oded');
  await p.choose('bye');
  await p.finish();
  await p.interact('hanina');
  await p.choose('sky');
  await p.choose('water');
  await p.choose('bye');
  await p.finish();
  for (const id of ['far-shore', 'magdala-boat', 'western-hills', 'waters-edge'])
    await p.interact(id);
  await p.interact('lake-view');
  expect(
    h.puzzles.submitDeduction('p-sky', 'squall', ['clue-hanina-east', 'clue-cold-breath'])?.correct,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('family-boat');
  await p.choose('load');
  await p.finish();
  expect(
    p.loadAndTrim('p-load', {
      bailer: 1,
      'fish-jar': 4,
      rope: 1,
      'spare-oar': 1,
      cloak: 1,
      lamp: 1,
    })?.valid,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.choose('room');
  await p.finish();
  await p.finish();

  await p.interact('elazar-lake');
  await p.choose('lamp');
  await p.advance();
  await p.choose('now');
  await p.finish();
  const sail = h.puzzles.find('p-sail');
  if (sail?.type !== 'sequence') throw new Error('expected sequence');
  expect(h.puzzles.submitSequence('p-sail', sail.correctOrder)?.correct).toBe(true);
  expect(h.puzzles.submitConclusion('p-sail', 'steady')?.correct).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.finish();
  await p.interact('port-rail');
  await p.choose('tow');
  await p.finish();
  await p.finish();
  await p.interact('ami-aboard');
  await p.choose('cloak');
  await p.finish();
  await p.interact('port-rail');
  await p.finish();
  await p.interact('bow');
  await p.finish();
  await p.interact('tamar-lake');
  await p.finish();
  await p.interact('elazar-lake');
  await p.choose('home');
  await p.finish();
  await p.finish();

  await p.interact('shelomit-night');
  await p.finish();
  await p.interact('nikanor-night');
  await p.choose('all');
  await p.finish();
  await p.interact('elazar');
  await p.finish();
  await p.interact('shifra');
  await p.finish();
  await p.interact('hanina-night');
  await p.choose('right');
  await p.finish();
  await p.interact('hodaya');
  await p.choose('teacher');
  await p.finish();
  await p.interact('shelomit-night');
  await p.choose('storm');
  await p.choose('stopped');
  await p.finish();
  h.controller.panelFinished('scripture-connection');
  h.controller.panelFinished('reflection');
  await flush();
  expect(h.state().chapterComplete).toBe(true);
  return meter;
}

/** The shortest honest run: only what the story asks for, every line read. */
async function roadToJerichoDirect(): Promise<PlayMeter> {
  const h = await createHarness();
  const meter = new PlayMeter(h);
  const p = new Player(h);
  await p.choose('c-yes');
  await p.choose('c-go');
  await p.finish();
  await p.exit('house-door');
  await p.interact('shimon');
  await p.choose('advice');
  await p.choose('water');
  await p.choose('weight');
  await p.choose('bye');
  await p.finish();
  await p.interact('hadassah');
  await p.choose('rivka');
  await p.choose('thanks');
  await p.choose('bye');
  await p.finish();
  await p.exit('to-house');
  await p.interact('satchel');
  expect(
    h.puzzles.submitPacking('p-satchel', {
      remedy: 1,
      'linen-bundle': 1,
      'water-skin': 1,
      bread: 1,
      lamp: 1,
    })?.valid,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.exit('house-door');
  await p.exit('east-gate');
  await p.step(12, 13);
  await p.finish();
  await p.interact('crossroads');
  expect(
    h.puzzles.submitDeduction('p-route', 'ridge', ['clue-bend-watchers', 'clue-cistern'])?.correct,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.step(30, 4); // Eli, by the cistern
  await p.choose('keep');
  await p.choose('bye');
  await p.finish();
  await p.step(38, 9);
  await p.finish();
  for (const id of ['single-prints', 'broken-jar', 'drag-marks']) await p.interact(id);
  await p.choose('now');
  await p.finish();
  const seq = h.puzzles.find('p-what-happened');
  if (seq?.type !== 'sequence') throw new Error('expected sequence');
  expect(h.puzzles.submitSequence('p-what-happened', seq.correctOrder)?.correct).toBe(true);
  expect(h.puzzles.submitConclusion('p-what-happened', 'left')?.correct).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('menashe-road');
  await p.choose('send-help');
  await p.finish();
  await p.exit('to-jericho');
  await p.step(1, 10);
  await p.finish();
  await p.interact('salome');
  await p.choose('tell');
  await p.finish();
  await p.interact('rivka');
  await p.choose('man');
  await p.finish();
  await p.interact('natan');
  for (const c of ['alone', 'robbed', 'stranger', 'yes']) await p.choose(c);
  await p.choose('what');
  await p.finish();
  h.controller.panelFinished('scripture-connection');
  h.controller.panelFinished('reflection');
  await flush();
  expect(h.state().chapterComplete).toBe(true);
  return meter;
}

async function stormOnGalileeDirect(): Promise<PlayMeter> {
  const h = await createHarness({ chapter: loadChapter(STORM_ON_GALILEE) });
  const meter = new PlayMeter(h);
  const p = new Player(h);
  await p.choose('c-seen');
  await p.choose('c-ready');
  await p.choose('c-go');
  await p.choose('c-knots');
  await p.finish();
  expect(p.mendNet('p-corner')?.solved).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.exit('house-door');
  await p.interact('elazar');
  await p.choose('bye');
  await p.finish();
  await p.interact('nikanor');
  await p.choose('bye');
  await p.finish();
  await p.interact('hanina');
  await p.choose('sky');
  await p.choose('bye');
  await p.finish();
  await p.interact('far-shore');
  await p.interact('lake-view');
  expect(
    h.puzzles.submitDeduction('p-sky', 'squall', ['clue-hanina-east', 'clue-cold-breath'])?.correct,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.interact('family-boat');
  await p.choose('load');
  await p.finish();
  expect(
    p.loadAndTrim('p-load', { bailer: 1, 'fish-jar': 4, lamp: 1, cloak: 1, rope: 1 })?.valid,
  ).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.finish();
  await p.finish();
  await p.step(25, 11);
  await p.choose('now');
  await p.finish();
  const sail = h.puzzles.find('p-sail');
  if (sail?.type !== 'sequence') throw new Error('expected sequence');
  expect(h.puzzles.submitSequence('p-sail', sail.correctOrder)?.correct).toBe(true);
  expect(h.puzzles.submitConclusion('p-sail', 'steady')?.correct).toBe(true);
  h.controller.closePuzzle();
  await flush();
  await p.finish();
  await p.interact('port-rail');
  await p.choose('tow');
  await p.finish();
  await p.finish();
  await p.interact('port-rail');
  await p.choose('call');
  await p.finish();
  await p.interact('elazar-lake');
  await p.choose('home');
  await p.finish();
  await p.finish();
  await p.interact('shelomit-night');
  await p.finish();
  await p.interact('nikanor-night');
  await p.choose('all');
  await p.finish();
  await p.interact('shelomit-night');
  await p.choose('stopped');
  await p.finish();
  h.controller.panelFinished('scripture-connection');
  h.controller.panelFinished('reflection');
  await flush();
  expect(h.state().chapterComplete).toBe(true);
  return meter;
}

/** Print the estimates when asked (PLAY_TIME=1), for the chapter documents (docs/chapters/<id>.md §11). */
function report(label: string, meter: PlayMeter): { steady: PlayTime; brisk: PlayTime } {
  const steady = meter.estimate(STEADY);
  const brisk = meter.estimate(BRISK);
  if (process.env.PLAY_TIME)
    console.info(label, JSON.stringify({ steady, brisk: brisk.minutes }, null, 0));
  return { steady, brisk };
}

describe('how long each chapter plays for a first-time player', () => {
  // The target (the owner, 2026-09-30): 20–30 minutes of real play for a
  // first-time player. A curious first-timer who reads every line lands
  // above it; one who only follows the main quest, or an adult reading
  // fast, lands in it.
  it('The Road to Jericho: the main quest alone is most of 20 minutes', async () => {
    const { steady, brisk } = report('road-to-jericho direct', await roadToJerichoDirect());
    expect(steady.minutes).toBeGreaterThanOrEqual(18);
    expect(brisk.minutes).toBeGreaterThanOrEqual(12);
    expect(steady.puzzles).toHaveLength(3);
  });

  it('The Road to Jericho: a curious first run is 20–30 minutes even for a fast reader', async () => {
    const { steady, brisk } = report('road-to-jericho curious', await roadToJericho());
    expect(steady.minutes).toBeGreaterThanOrEqual(30);
    expect(steady.minutes).toBeLessThanOrEqual(45);
    expect(brisk.minutes).toBeGreaterThanOrEqual(20);
    expect(steady.puzzles).toHaveLength(5);
  });

  it('A Storm on Galilee: the main quest alone is 20 minutes', async () => {
    const { steady, brisk } = report('storm-on-galilee direct', await stormOnGalileeDirect());
    expect(steady.minutes).toBeGreaterThanOrEqual(20);
    expect(brisk.minutes).toBeGreaterThanOrEqual(13);
    expect(steady.puzzles).toHaveLength(4);
  });

  it('A Storm on Galilee: a curious first run is 20–30 minutes even for a fast reader', async () => {
    const { steady, brisk } = report('storm-on-galilee curious', await stormOnGalilee());
    expect(steady.minutes).toBeGreaterThanOrEqual(30);
    expect(steady.minutes).toBeLessThanOrEqual(45);
    expect(brisk.minutes).toBeGreaterThanOrEqual(20);
    expect(steady.puzzles).toHaveLength(6);
  });
});

import { describe, expect, it } from 'vitest';
import { buildChapterSummary } from '@/domain/chapter-summary';
import { applyMeasure, initialLevels, type MeasuringPuzzle } from '@/domain/puzzles';
import { createHarness, flush, Player, type Harness } from '../support/harness';

/**
 * Headless playthroughs of the whole chapter, driving the REAL application
 * layer (session, controllers, rules, content) with a fake world. These are
 * the deterministic proof that every major branch can be completed.
 */

/** How someone is currently shown in the (fake) world. */
function shown(h: Harness, id: string) {
  return h.world.entities.find((e) => e.id === id);
}

/** What the player visibly carries now (last update sent to the world). */
function playerMarks(h: Harness): string[] {
  return h.world.playerMarks.at(-1) ?? h.world.scenes.at(-1)?.player.marks ?? [];
}

async function opening(p: Player): Promise<void> {
  expect(p.dialogueView?.dialogueId).toBe('d-opening');
  await p.choose('c-yes');
  await p.choose('c-go');
  await p.finish();
  expect(p.h.state().quests['q-remedy']?.status).toBe('active');
  expect(p.h.state().inventory.remedy).toBe(1);
  await p.exit('house-door');
  expect(p.scene()).toBe('jerusalem-market');
}

async function askShimonAboutWater(p: Player): Promise<void> {
  await p.interact('shimon');
  await p.choose('advice');
  await p.choose('water');
  await p.choose('weight');
  await p.choose('bye');
  await p.finish();
}

async function packAndLeave(p: Player, packed: Record<string, number>): Promise<void> {
  await p.exit('to-house');
  expect(p.scene()).toBe('miriam-house');
  await p.interact('satchel');
  expect(p.h.ui.getState().puzzleId).toBe('p-satchel');
  const result = p.h.puzzles.submitPacking('p-satchel', packed);
  expect(result?.valid, JSON.stringify(result?.failures)).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  await p.exit('house-door');
  await p.exit('east-gate');
  expect(p.scene()).toBe('jericho-road');
}

async function forkAndRidge(p: Player): Promise<void> {
  await p.step(12, 13); // fork trigger
  await p.finish();
  await p.interact('cairn');
  await p.interact('wadi-edge');
  await p.interact('crossroads');
  expect(p.h.ui.getState().puzzleId).toBe('p-route');
  const route = p.h.puzzles.submitDeduction('p-route', 'ridge', ['clue-cairn', 'clue-mud-line']);
  expect(route?.correct, route?.feedback.join(' | ')).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  expect(p.h.world.entities.some((e) => e.id === 'ridge-path')).toBe(false); // blocker gone
  await p.step(20, 4); // drink
  await p.interact('cistern'); // refill
  await p.step(38, 9); // ridge end → incident
  await p.finish();
  expect(p.h.state().flags['incident-seen']).toBe(true);
}

async function investigate(p: Player): Promise<void> {
  await p.interact('broken-jar');
  await p.interact('many-prints');
  await p.interact('drag-marks');
  await p.step(40, 14); // think trigger
  await p.choose('now');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-what-happened');
  const puzzle = p.h.puzzles.find('p-what-happened');
  if (puzzle?.type !== 'sequence') throw new Error('expected sequence');
  expect(p.h.puzzles.submitSequence('p-what-happened', puzzle.initialOrder)?.correct).toBe(false);
  expect(p.h.puzzles.submitSequence('p-what-happened', puzzle.correctOrder)?.correct).toBe(true);
  expect(p.h.puzzles.submitConclusion('p-what-happened', 'hiding')?.correct).toBe(false);
  expect(p.h.puzzles.submitConclusion('p-what-happened', 'left')?.correct).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
}

async function finishInJericho(p: Player): Promise<void> {
  await p.interact('rivka');
  await p.choose('man');
  await p.advance();
  // Rivka hands over to Yair automatically.
  expect(p.dialogueView?.dialogueId).toBe('d-yair');
  await p.choose('samaritan');
  await p.finish();
  expect(p.h.ui.getState().panel).toBe('scripture-connection');
  p.h.controller.panelFinished('scripture-connection');
  expect(p.h.ui.getState().panel).toBe('reflection');
  p.h.session.setReflection('It was hard to stop because I was scared.');
  p.h.controller.panelFinished('reflection');
  await flush();
  expect(p.h.ui.getState().panel).toBe('summary');
  expect(p.h.state().chapterComplete).toBe(true);
  expect(p.h.state().quests['q-remedy']?.status).toBe('completed');
}

function solveMeasure(h: Harness): void {
  const puzzle = h.puzzles.find('p-measure') as MeasuringPuzzle;
  let levels = initialLevels(puzzle);
  const steps = [
    { type: 'fill', vessel: 'crock' },
    { type: 'pour', from: 'crock', to: 'pitcher' },
    { type: 'empty', vessel: 'pitcher' },
    { type: 'pour', from: 'crock', to: 'pitcher' },
    { type: 'fill', vessel: 'crock' },
    { type: 'pour', from: 'crock', to: 'pitcher' },
  ] as const;
  steps.forEach((s) => {
    levels = applyMeasure(puzzle, levels, s);
  });
  expect(h.puzzles.submitMeasure('p-measure', levels)).toBe(true);
}

describe('Road to Jericho — full playthroughs', () => {
  it('thorough path: side quest, map, caravan help, Malik pays, delivered on time', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);

    await askShimonAboutWater(p);
    await p.interact('malik');
    await p.choose('road');
    await p.choose('caravan');
    await p.choose('watch');
    await p.choose('sell');
    await p.choose('buy');
    await p.choose('bye');
    await p.finish();
    expect(h.state().inventory.map).toBe(1);
    expect(h.state().inventory.coins).toBe(3);

    await p.interact('hadassah');
    await p.choose('buy');
    await p.choose('argument');
    await p.choose('talked');
    await p.choose('bye');
    await p.finish();

    // Side quest: hear both sides, measure, settle.
    await p.interact('ezer');
    await p.choose('help');
    await p.choose('ok');
    await p.finish();
    await p.interact('menashe');
    await p.choose('bye');
    await p.finish();
    expect(h.state().quests['q-honest-measure']?.stageId).toBe('measure');
    await p.interact('vessels');
    solveMeasure(h);
    h.controller.closePuzzle();
    await flush();
    await p.interact('ezer');
    await p.choose('tell');
    await p.finish();
    expect(h.state().quests['q-honest-measure']?.status).toBe('completed');
    expect(h.state().inventory.oil).toBe(1);
    expect(h.state().trust.menashe).toBe(2);

    await packAndLeave(p, { remedy: 1, 'water-skin': 1, linen: 1, oil: 1, bread: 1 });
    expect(h.state().inventory.cloak).toBeUndefined(); // left at home
    // What you packed shows: a water skin at your hip, no rolled cloak or lamp.
    expect(playerMarks(h)).toEqual(['water-skin']);

    await forkAndRidge(p);
    await investigate(p);

    await p.interact('menashe-road');
    await p.advance();
    expect(p.dialogueView?.nodeId).toBe('decide');
    await p.choose('tend-caravan');
    await p.choose('robbed');
    await p.finish();
    expect(p.scene()).toBe('jericho');
    expect(h.state().flags['bound-wounds']).toBe(true);
    expect(h.state().flags['soothed-wounds']).toBe(true);

    await p.step(1, 10); // inn arrival → Salome
    await p.advance();
    expect(p.dialogueView?.dialogueId).toBe('d-salome');
    await p.choose('thanks');
    await p.finish();
    expect(h.world.entities.some((e) => e.id === 'menashe-inn')).toBe(true);
    // Choices show in the world: your linen on his wounds, resting once cared for,
    // and Malik's pack donkey in the yard.
    expect(shown(h, 'menashe-inn')?.marks).toEqual(['bandaged']);
    expect(shown(h, 'menashe-inn')?.pose).toBe('lie');
    expect(shown(h, 'pack-donkey')).toBeDefined();
    expect(shown(h, 'inn-donkey')).toBeDefined();
    expect(shown(h, 'broom')).toBeUndefined();
    // Natan is feverish on his mat until the remedy comes.
    expect(shown(h, 'natan')?.pose).toBe('lie');

    await finishInJericho(p);
    expect(shown(h, 'natan')?.pose).toBe('sit');
    expect(h.state().flags['remedy-on-time']).toBe(true);
    expect(h.state().quests['q-remedy']?.outcomeId).toBe('on-time');

    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain('Malik paid for Menashe’s care himself.');
    expect(summary.sideQuests).toEqual([{ name: 'An Honest Measure', outcome: 'Settled fairly' }]);
    expect(summary.scripture.map((r) => r.id)).toContain('rec-luke-10-25-37');
  });

  it('hurried path: pass by, tell the innkeeper, still completes the chapter', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await p.interact('tobiah');
    await p.choose('walked');
    await p.finish();
    await askShimonAboutWater(p);
    await packAndLeave(p, { remedy: 1, 'water-skin': 2 });
    await forkAndRidge(p);

    // Walk straight to the exit without stopping.
    await p.exit('to-jericho');
    expect(p.dialogueView?.dialogueId).toBe('d-road-exit-blocked');
    await p.choose('keep');
    await p.finish();
    expect(p.scene()).toBe('jericho');
    expect(h.state().quests['q-honest-measure']).toBeUndefined();

    await p.step(1, 10);
    await p.finish();
    expect(shown(h, 'inn-donkey')).toBeDefined();
    expect(shown(h, 'bedroll')).toBeUndefined();
    await p.interact('salome');
    await p.choose('tell');
    await p.finish();
    expect(h.state().flags['asher-sent']).toBe(true);
    // Asher has taken the donkey up the road; a mat is laid out ready.
    expect(shown(h, 'inn-donkey')).toBeUndefined();
    expect(shown(h, 'bedroll')).toBeDefined();
    await finishInJericho(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'You told Salome about the injured man, and her son Asher went to bring him in.',
    );
    expect(summary.choices.find((c) => c.prompt.startsWith('What did you do'))?.chosen).toMatch(
      /hurried/,
    );
  });

  it('long path: tend and walk, work at the inn, arrive after dark, rest, deliver at dawn', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await askShimonAboutWater(p);
    // Side quest costs an hour.
    await p.interact('ezer');
    await p.choose('help');
    await p.choose('ok2');
    await p.finish();
    await p.interact('menashe');
    await p.choose('bye');
    await p.finish();
    await p.interact('vessels');
    solveMeasure(h);
    h.controller.closePuzzle();
    await flush();
    await p.interact('ezer');
    await p.choose('mistakes');
    await p.finish();

    // No lamp packed.
    await packAndLeave(p, { remedy: 1, 'water-skin': 1, oil: 1, cloak: 1 });
    expect(playerMarks(h)).toEqual(['water-skin', 'cloak-roll']);
    await forkAndRidge(p);
    await investigate(p);
    await p.interact('menashe-road');
    await p.choose('tend-walk');
    await p.choose('give'); // cloak
    await p.finish();
    expect(p.scene()).toBe('jericho');
    // No linen: you tore strips from your own tunic, and gave him your cloak.
    expect(playerMarks(h)).toEqual(['torn-hem']);
    expect(shown(h, 'menashe-inn')?.marks).toEqual(['rag-bandaged', 'wrapped-in-cloak']);
    expect(shown(h, 'menashe-inn')?.pose).toBe('sit');

    await p.step(1, 10);
    await p.advance();
    expect(p.dialogueView?.dialogueId).toBe('d-salome');
    await p.choose('work');
    await p.finish();
    expect(shown(h, 'broom')).toBeDefined();
    expect(shown(h, 'menashe-inn')?.pose).toBe('lie');
    expect(h.state().counters.hour).toBeGreaterThanOrEqual(18);
    expect(h.world.entities.some((e) => e.id === 'night')).toBe(true);
    await p.interact('night');
    await p.choose('rest');
    await p.finish();
    expect(h.world.entities.some((e) => e.id === 'night')).toBe(false);
    await finishInJericho(p);
    expect(h.state().quests['q-remedy']?.outcomeId).toBe('at-dawn');
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Menashe kept warm in your cloak, and promised to return it in Jerusalem.',
    );
  });

  it('send-help path: leave supplies, run to the inn, Salome sends Asher', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await askShimonAboutWater(p);
    await p.interact('malik');
    await p.choose('road');
    await p.choose('bye');
    await p.finish();
    await packAndLeave(p, { remedy: 1, 'water-skin': 1, bread: 1, lamp: 1 });
    await forkAndRidge(p);
    await investigate(p);
    expect(shown(h, 'menashe-road')?.pose).toBe('lie');
    await p.interact('menashe-road');
    await p.choose('send-help');
    await p.finish();
    expect(h.state().inventory['water-skin']).toBeUndefined();
    expect(h.state().inventory.bread).toBeUndefined();
    // He sits up to wait, with what you left him beside him.
    expect(shown(h, 'menashe-road')?.pose).toBe('sit');
    expect(shown(h, 'left-water')).toBeDefined();
    expect(shown(h, 'left-bread')).toBeDefined();
    expect(playerMarks(h)).toEqual(['lamp']);
    await p.exit('to-jericho');
    await p.step(1, 10);
    await p.finish();
    await p.interact('salome');
    await p.choose('tell');
    await p.finish();
    await finishInJericho(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences.join(' ')).toMatch(/Asher brought Menashe/);
  });

  it('never lets the player leave Jerusalem unprepared, and explains why', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await p.exit('east-gate');
    expect(p.scene()).toBe('jerusalem-market');
    expect(p.dialogueView?.dialogueId).toBe('d-gate-blocked');
    expect(p.dialogueView?.nodeId).toBe('ask');
    await p.finish();
    await p.exit('to-house');
    await p.interact('satchel');
    expect(h.ui.getState().puzzleId).toBeNull();
    expect(h.ui.getState().toasts.some((t) => t.text.includes('learn about the road'))).toBe(true);
  });

  it('rejects a too-light water plan unless the player learned about the cistern', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await p.interact('malik');
    await p.choose('road');
    await p.choose('caravan');
    await p.choose('safe');
    await p.choose('bye');
    await p.finish();
    await p.exit('to-house');
    await p.interact('satchel');
    const tooLittle = h.puzzles.submitPacking('p-satchel', {
      remedy: 1,
      'water-skin': 1,
      bread: 1,
    });
    expect(tooLittle?.valid).toBe(false);
    expect(tooLittle?.failures.map((f) => f.ruleId)).toEqual(['water']);
    const tooHeavy = h.puzzles.submitPacking('p-satchel', { remedy: 1, 'water-skin': 2, cloak: 1 });
    expect(tooHeavy?.failures.map((f) => f.ruleId)).toEqual(['capacity']);
  });
});

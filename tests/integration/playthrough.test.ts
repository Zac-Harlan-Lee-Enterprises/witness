import { describe, expect, it } from 'vitest';
import { buildChapterSummary } from '@/domain/chapter-summary';
import { evaluate } from '@/domain/conditions';
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

/** Collect Rivka's linen from Hadassah (Aunt Miriam's errand). */
async function collectLinen(p: Player): Promise<void> {
  await p.interact('hadassah');
  await p.choose('rivka');
  await p.choose('thanks');
  await p.choose('bye');
  await p.finish();
  expect(p.h.state().inventory['linen-bundle']).toBe(1);
  expect(p.h.state().quests['q-remedy']?.completedObjectives).toContain('collect-linen');
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

async function forkAndRidge(p: Player, onRidge?: (p: Player) => Promise<void>): Promise<void> {
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
  if (onRidge) await onRidge(p);
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

/** Rivka takes the remedy and the linen, and asks you to sit with Natan. */
async function deliverToRivka(p: Player, before: string[] = []): Promise<void> {
  await p.interact('rivka');
  for (const c of before) await p.choose(c);
  await p.choose('man');
  await p.finish();
  expect(p.h.state().flags['remedy-delivered']).toBe(true);
  expect(p.h.state().inventory['linen-bundle']).toBeUndefined();
  expect(p.h.state().quests['q-remedy']?.stageId).toBe('natan');
}

/** Keep Natan company while the remedy steeps; Yair comes in at the end. */
async function sitWithNatan(p: Player, ...choices: string[]): Promise<void> {
  await p.interact('natan');
  for (const c of choices) await p.choose(c);
  await p.advance();
  expect(p.h.state().flags['sat-with-natan']).toBe(true);
  // Natan hands over to Yair, back from the orchard.
  expect(p.dialogueView?.dialogueId).toBe('d-yair');
}

async function finishInJericho(
  p: Player,
  natan: string[] = ['alone', 'robbed', 'name', 'anyone', 'yes'],
  rivka: string[] = [],
): Promise<void> {
  await deliverToRivka(p, rivka);
  await sitWithNatan(p, ...natan);
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

/** Meet Eli on the ridge: walking past the cistern starts the conversation. */
async function meetEli(p: Player, ...choices: string[]): Promise<void> {
  await p.step(30, 4);
  expect(p.dialogueView?.dialogueId).toBe('d-eli');
  for (const c of choices) await p.choose(c);
  await p.choose('bye');
  await p.finish();
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
    await p.choose('rivka');
    await p.choose('heavy');
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

    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, linen: 1, oil: 1 });
    expect(h.state().inventory.cloak).toBeUndefined(); // left at home
    expect(h.state().inventory.bread).toBeUndefined();
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
    // Your own linen strips bound him: Rivka's linen is untouched.
    expect(h.state().flags['cut-bundle']).toBeUndefined();
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

    await finishInJericho(p, ['alone', 'robbed', 'name', 'oil', 'no']);
    expect(shown(h, 'natan')?.pose).toBe('sit');
    expect(h.state().flags['remedy-on-time']).toBe(true);
    expect(h.state().flags['natan-knows-menashe']).toBe(true);
    expect(h.state().quests['q-remedy']?.outcomeId).toBe('on-time');

    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain('Malik paid for Menashe’s care himself.');
    expect(summary.consequences).toContain(
      'Hadassah’s linen reached Rivka whole, for Natan’s bed.',
    );
    expect(summary.consequences).toContain('Natan knows a Samaritan oil merchant’s name now.');
    expect(summary.sideQuests).toEqual([{ name: 'An Honest Measure', outcome: 'Settled fairly' }]);
    expect(summary.scripture.map((r) => r.id)).toContain('rec-luke-10-25-37');
  });

  it('hurried path: pass by, tell the innkeeper, still completes the chapter', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await p.interact('tobiah');
    await p.choose('walked');
    await p.choose('why');
    await p.finish();
    expect(h.state().flags['tobiah-rethinks']).toBe(true);
    await askShimonAboutWater(p);
    await collectLinen(p);
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 2 });
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
    await finishInJericho(p, ['alone', 'robbed', 'stranger', 'honest', 'yes']);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'You told Salome about the injured man, and her son Asher went to bring him in.',
    );
    expect(summary.consequences).toContain(
      'Tobiah promised to stop telling travelers the wadi is fastest.',
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
    await collectLinen(p);
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

    // No lamp packed, and no oil: Menashe's gift of oil stays at home.
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, cloak: 1 });
    expect(playerMarks(h)).toEqual(['water-skin', 'cloak-roll']);
    await forkAndRidge(p);
    await investigate(p);
    await p.interact('menashe-road');
    await p.choose('tend-walk');
    // No linen strips of your own: Rivka's linen, or your tunic?
    await p.choose('tunic');
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
    expect(h.state().choices).toContainEqual(
      expect.objectContaining({ choiceId: 'choice-bandage', optionId: 'tunic' }),
    );
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
    await collectLinen(p);
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, bread: 1, lamp: 1 });
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
    await finishInJericho(p, ['alone', 'none', 'no']);
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
    await collectLinen(p);
    await p.exit('to-house');
    await p.interact('satchel');
    const tooLittle = h.puzzles.submitPacking('p-satchel', {
      remedy: 1,
      'linen-bundle': 1,
      'water-skin': 1,
      bread: 1,
    });
    expect(tooLittle?.valid).toBe(false);
    expect(tooLittle?.failures.map((f) => f.ruleId)).toEqual(['water']);
    const tooHeavy = h.puzzles.submitPacking('p-satchel', {
      remedy: 1,
      'linen-bundle': 1,
      'water-skin': 2,
      bread: 1,
    });
    expect(tooHeavy?.failures.map((f) => f.ruleId)).toEqual(['capacity']);
    const noLinen = h.puzzles.submitPacking('p-satchel', { remedy: 1, 'water-skin': 2 });
    expect(noLinen?.failures.map((f) => f.ruleId)).toEqual(['linen']);
  });

  it('Eli on the ridge: carry his grandfather’s message, share your bread — hurry past, and Eli finds Menashe', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await p.interact('shimon');
    await p.choose('advice');
    await p.choose('water');
    await p.choose('weight');
    await p.choose('favor'); // only offered once you know about the cistern
    await p.choose('yes');
    await p.choose('bye');
    await p.finish();
    expect(h.state().quests['q-message']?.status).toBe('active');
    await collectLinen(p);
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, bread: 1, lamp: 1 });
    await forkAndRidge(p, (q) => meetEli(q, 'share', 'message', 'saw'));
    expect(h.state().inventory.bread).toBeUndefined(); // Eli ate it
    expect(h.state().clues).toContain('clue-eli-men');
    expect(h.state().quests['q-message']?.status).toBe('completed');
    expect(h.state().trust.shimon).toBeGreaterThanOrEqual(1);
    expect(h.state().journal.unlocked).toContain('jp-eli');
    // Walking past the cistern again doesn't start the conversation over.
    await p.step(30, 5);
    expect(p.dialogueView).toBeNull();

    await p.exit('to-jericho');
    await p.choose('keep');
    await p.finish();
    await p.step(1, 10);
    await p.finish();
    await finishInJericho(p, ['eli', 'robbed', 'name', 'anyone', 'honest', 'yes']);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences.join(' ')).toMatch(/Eli, bringing the flock down the gully early/);
    expect(summary.consequences.join(' ')).not.toMatch(/Shepherds found Menashe near sunset/);
    expect(summary.sideQuests).toContainEqual({
      name: 'A Message for Eli',
      outcome: 'Message delivered',
    });
    expect(summary.choices.find((c) => c.prompt.startsWith('When Eli said'))?.chosen).toMatch(
      /shared/,
    );
  });

  it('a message never given is left undelivered, and shepherds find Menashe at sunset', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await p.interact('shimon');
    await p.choose('water');
    await p.choose('weight');
    await p.choose('favor');
    await p.choose('yes');
    await p.choose('advice');
    await p.choose('bye');
    await p.finish();
    await collectLinen(p);
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, bread: 1, lamp: 1 });
    await forkAndRidge(p, (q) => meetEli(q, 'keep'));
    expect(h.state().inventory.bread).toBe(1);
    await p.exit('to-jericho');
    await p.choose('keep');
    await p.finish();
    expect(h.state().quests['q-message']?.status).toBe('failed');
    await p.step(1, 10);
    await p.finish();
    await finishInJericho(p, ['alone', 'none', 'yes']);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Shepherds found Menashe near sunset and carried him to the inn.',
    );
    expect(summary.sideQuests).toContainEqual({
      name: 'A Message for Eli',
      outcome: 'Not delivered',
    });
  });

  it('Rivka’s linen binds the wounds: Rivka hems the sheet, and Menashe gets his own cloak back at the inn', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await askShimonAboutWater(p);
    await collectLinen(p);
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 1, bread: 1, lamp: 1 });
    await forkAndRidge(p, (q) => meetEli(q, 'keep', 'saw'));
    await investigate(p);
    // What Eli saw is part of the careful reading of the scene.
    await p.interact('menashe-road');
    expect(p.dialogueView?.nodeId).toBe('d0');
    h.dialogue.advance();
    await flush();
    expect(p.dialogueView?.nodeId).toBe('d0-eli');
    await p.choose('tend-walk');
    await p.choose('cut'); // Rivka's linen, not your tunic
    await p.finish();
    expect(p.scene()).toBe('jericho');
    expect(h.state().flags['cut-bundle']).toBe(true);
    expect(h.state().inventory['linen-bundle']).toBe(1); // still carried, a strip short
    expect(playerMarks(h)).not.toContain('torn-hem');
    expect(shown(h, 'menashe-inn')?.marks).toEqual(['bandaged']);

    await p.step(1, 10);
    await p.advance();
    await p.choose('coins');
    await p.finish();
    // The striped cloak by the gate.
    await p.interact('striped-cloak');
    expect(p.dialogueView?.dialogueId).toBe('d-cloak');
    await p.choose('later');
    await p.finish();
    expect(h.state().quests['q-cloak']?.status).toBe('active');
    expect(h.state().clues).toEqual(expect.arrayContaining(['clue-cloak-hem', 'clue-cloak-oil']));
    await p.interact('salome');
    await p.choose('cloak');
    await p.choose('bend');
    await p.choose('thanks');
    await p.finish();
    expect(h.state().clues).toEqual(
      expect.arrayContaining(['clue-cloak-found', 'clue-blue-stripes']),
    );
    await p.interact('striped-cloak');
    await p.choose('now');
    await p.finish();
    expect(h.ui.getState().puzzleId).toBe('p-cloak');
    expect(h.puzzles.submitDeduction('p-cloak', 'jericho', ['clue-blue-stripes'])?.correct).toBe(
      false,
    );
    const spoiled = h.puzzles.submitDeduction('p-cloak', 'menashe', [
      'clue-cloak-hem',
      'clue-cloak-oil',
      'clue-blue-stripes',
    ]);
    expect(spoiled?.correct).toBe(false); // an unreliable claim spoils the argument
    const cloak = h.puzzles.submitDeduction('p-cloak', 'menashe', [
      'clue-cloak-hem',
      'clue-cloak-found',
    ]);
    expect(cloak?.correct, cloak?.feedback.join(' | ')).toBe(true);
    h.controller.closePuzzle();
    await flush();
    await p.interact('salome');
    await p.choose('whose');
    await p.choose('menashe');
    await p.advance();
    expect(p.dialogueView?.nodeId).toBe('general');
    await p.choose('thanks');
    await p.finish();
    expect(h.state().quests['q-cloak']?.status).toBe('completed');
    expect(h.state().journal.unlocked).toContain('je-cloak');
    await p.interact('menashe-inn');
    expect(p.dialogueView?.nodeId).toBe('own');
    await p.choose('evidence');
    await p.choose('rest');
    await p.finish();

    await finishInJericho(p, ['alone', 'robbed', 'name', 'anyone', 'yes'], ['explain']);
    expect(h.state().flags['rivka-knows-linen']).toBe(true);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'One of Rivka’s new sheets reached Jericho a strip short: it had bound Menashe’s wounds. Rivka hemmed the edge herself.',
    );
    expect(summary.consequences).toContain(
      'Menashe’s own cloak, thrown away by the robbers, was kept for him at the inn.',
    );
    expect(summary.sideQuests).toContainEqual({
      name: 'Whose Cloak?',
      outcome: 'Back with its owner',
    });
    const comparisons = h.chapter.scriptureConnection.comparisons.filter((c) =>
      evaluate(c.when, h.state()),
    );
    expect(comparisons.map((c) => c.text).join(' ')).toMatch(/linen that wasn’t yours/);
  });

  it('greets Salome for Aunt Miriam, and keeps a cloak for a man who hasn’t been found yet', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await askShimonAboutWater(p);
    await collectLinen(p);
    await p.exit('to-house');
    await p.interact('satchel');
    expect(
      h.puzzles.submitPacking('p-satchel', {
        remedy: 1,
        'linen-bundle': 1,
        'water-skin': 1,
        lamp: 1,
        bread: 1,
      })?.valid,
    ).toBe(true);
    h.controller.closePuzzle();
    await flush();
    await p.interact('miriam');
    await p.choose('salome');
    await p.choose('will');
    await p.finish();
    expect(h.state().flags['miriam-greeting']).toBe(true);
    await p.exit('house-door');
    await p.exit('east-gate');
    await forkAndRidge(p);
    await p.exit('to-jericho');
    await p.choose('keep');
    await p.finish();
    await p.step(1, 10);
    await p.finish();
    await p.interact('salome');
    await p.choose('nothing'); // said nothing about the man on the road
    await p.finish();
    await p.interact('salome');
    await p.choose('miriam');
    await p.choose('cloak');
    await p.choose('look');
    await p.choose('thanks');
    await p.finish();
    expect(h.state().trust.salome).toBe(1);
    await p.interact('striped-cloak');
    await p.choose('now');
    await p.finish();
    expect(
      h.puzzles.submitDeduction('p-cloak', 'menashe', ['clue-cloak-hem', 'clue-cloak-oil'])
        ?.correct,
    ).toBe(true);
    h.controller.closePuzzle();
    await flush();
    await p.interact('salome');
    await p.choose('whose');
    await p.choose('menashe');
    await p.advance();
    expect(h.state().flags['cloak-returned']).toBe(true);
    await p.choose('thanks');
    await p.finish();
    await finishInJericho(p, ['alone', 'robbed', 'stranger', 'quiet', 'no']);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'You gave Salome Aunt Miriam’s greeting, and she sent back an open door.',
    );
  });

  it('waits for Rivka’s linen before packing, and for Natan before Yair’s story', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await opening(p);
    await askShimonAboutWater(p);
    await p.exit('to-house');
    await p.interact('satchel');
    expect(h.ui.getState().puzzleId).toBeNull();
    expect(h.ui.getState().toasts.some((t) => t.text.includes('Rivka’s linen'))).toBe(true);
    await p.interact('miriam');
    expect(p.dialogueView?.nodeId).toBe('linen');
    await p.finish();
    await p.exit('house-door');
    await collectLinen(p);
    await packAndLeave(p, { remedy: 1, 'linen-bundle': 1, 'water-skin': 2 });
    expect(h.state().quests['q-remedy']?.stageId).toBe('route');
    await forkAndRidge(p);
    await investigate(p);
    await p.interact('menashe-road');
    await p.choose('send-help');
    await p.finish();
    await p.exit('to-jericho');
    await p.step(1, 10);
    await p.finish();
    await deliverToRivka(p);
    // Yair waits until you've sat with Natan.
    await p.interact('yair');
    expect(p.dialogueView?.nodeId).toBe('natan-first');
    await p.finish();
    expect(h.state().flags['heard-yair']).toBeUndefined();
    await sitWithNatan(p, 'alone', 'robbed', 'name', 'anyone', 'yes');
    await p.choose('what');
    await p.finish();
    expect(h.ui.getState().panel).toBe('scripture-connection');
    expect(h.state().quests['q-remedy']?.completedObjectives).toContain('keep-company');
  });
});

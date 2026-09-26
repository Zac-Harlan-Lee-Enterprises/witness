import { describe, expect, it } from 'vitest';
import { JOURNEY_TO_BETHLEHEM } from '@/content/chapters/journey-to-bethlehem';
import { buildChapterSummary } from '@/domain/chapter-summary';
import { applyMeasure, initialLevels, type MeasuringPuzzle } from '@/domain/puzzles';
import { createHarness, flush, loadChapter, Player, type Harness } from '../support/harness';

/**
 * Headless playthroughs of Chapter 3 through the REAL application layer
 * (session, controllers, rules, content) with a fake world: every major
 * branch reaches the summary, and choices show up in the world.
 */
const chapter = () => loadChapter(JOURNEY_TO_BETHLEHEM);

async function start(): Promise<{ h: Harness; p: Player }> {
  const h = await createHarness({ chapter: chapter() });
  return { h, p: new Player(h) };
}

function shown(h: Harness, id: string) {
  return h.world.entities.find((e) => e.id === id);
}

function playerMarks(h: Harness): string[] {
  return h.world.playerMarks.at(-1) ?? h.world.scenes.at(-1)?.player.marks ?? [];
}

const hour = (h: Harness) => h.state().counters.hour;

async function opening(p: Player): Promise<void> {
  expect(p.dialogueView?.dialogueId).toBe('d-opening');
  await p.choose('why');
  await p.choose('help');
  await p.finish();
  expect(p.h.state().quests['q-room']?.status).toBe('active');
  expect(p.scene()).toBe('tamar-house');
}

async function bakeBread(p: Player): Promise<void> {
  await p.interact('kneading');
  expect(p.h.ui.getState().puzzleId).toBe('p-bread');
  const puzzle = p.h.puzzles.find('p-bread') as MeasuringPuzzle;
  let levels = initialLevels(puzzle);
  expect(p.h.puzzles.submitMeasure('p-bread', levels)).toBe(false);
  for (const step of [
    { type: 'fill', vessel: 'basket' },
    { type: 'pour', from: 'basket', to: 'trough' },
    { type: 'fill', vessel: 'basket' },
    { type: 'pour', from: 'basket', to: 'trough' },
    { type: 'empty', vessel: 'trough' },
    { type: 'pour', from: 'basket', to: 'trough' },
  ] as const)
    levels = applyMeasure(puzzle, levels, step);
  expect(levels.trough).toBe(3);
  expect(p.h.puzzles.submitMeasure('p-bread', levels)).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
}

async function arrangeRoom(p: Player, keep: 'grain' | 'loom' | 'tools' | null): Promise<void> {
  await p.interact('bedding');
  expect(p.h.ui.getState().puzzleId).toBe('p-room');
  const packed: Record<string, number> = { 'bed-asa': 1, 'bed-peninah': 1 };
  if (keep) packed[keep] = 1;
  const result = p.h.puzzles.submitPacking('p-room', packed);
  expect(result?.valid, JSON.stringify(result?.failures)).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  // The room things are arranged, not carried around.
  expect(p.h.state().inventory.loom).toBeUndefined();
  expect(p.h.state().inventory['bed-asa']).toBeUndefined();
}

async function collectSupper(p: Player): Promise<void> {
  await p.interact('tamar');
  await p.choose('fold');
  await p.choose('go');
  await p.finish();
  expect(p.h.state().inventory.supper).toBe(1);
  expect(p.h.state().inventory.lamp).toBe(1);
  // The lamp hangs at your belt from now on.
  expect(playerMarks(p.h)).toContain('lamp');
}

async function toLanes(p: Player): Promise<void> {
  await p.exit('to-lanes');
  expect(p.scene()).toBe('bethlehem-lanes');
  if (p.dialogueView?.dialogueId === 'd-lanes-intro') await p.finish();
}

async function toFieldsAndDeliver(p: Player): Promise<void> {
  await p.exit('to-fields');
  expect(p.scene()).toBe('shepherds-fields');
  expect(p.dialogueView?.dialogueId).toBe('d-fold-arrival');
  await p.finish();
  await p.interact('yonatan');
  await p.advance();
  expect(p.dialogueView?.nodeId).toBe('y6');
  expect(p.h.state().flags['supper-delivered']).toBe(true);
  expect(p.h.state().inventory.supper).toBeUndefined();
}

async function findTheLamb(p: Player): Promise<void> {
  await p.choose('search');
  await p.finish();
  expect(p.h.world.weather).toBe('wind');
  await p.interact('trough-prints');
  await p.interact('gully-wool');
  await p.interact('ewe');
  // The third sign offers to think it through.
  expect(p.dialogueView?.dialogueId).toBe('d-think');
  await p.choose('now');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-lamb');
  const wrong = p.h.puzzles.submitDeduction('p-lamb', 'thicket', ['clue-wool', 'clue-ewe']);
  expect(wrong?.correct).toBe(false);
  const right = p.h.puzzles.submitDeduction('p-lamb', 'gully', ['clue-small-prints', 'clue-wool']);
  expect(right?.correct, right?.feedback.join(' | ')).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  expect(shown(p.h, 'gully-path')).toBeUndefined(); // the way down is open
  await p.interact('lamb');
  expect(playerMarks(p.h)).toContain('carrying-lamb');
  await p.interact('yonatan');
  await p.finish();
  expect(p.h.state().choices.find((c) => c.choiceId === 'choice-lamb')?.optionId).toBe('found');
  expect(playerMarks(p.h)).not.toContain('carrying-lamb');
  expect(shown(p.h, 'lamb-home')).toBeDefined();
  expect(p.h.world.weather).toBe('clear'); // the wind drops at nightfall
}

async function homeAtNight(p: Player): Promise<void> {
  await p.exit('to-village');
  expect(p.scene()).toBe('bethlehem-lanes');
  // The registration has packed up for the night.
  expect(shown(p.h, 'kallias')).toBeUndefined();
  expect(shown(p.h, 'amram')).toBeUndefined();
  await p.exit('to-house');
  expect(p.scene()).toBe('tamar-house');
  // Supper, lamps, and a knock at the door: Zerah's conversation follows.
  await p.advance();
  expect(p.dialogueView?.dialogueId).toBe('d-zerah');
  expect(p.dialogueView?.nodeId).toBe('z4');
  expect(hour(p.h)).toBe(20);
}

function strangerOption(p: Player, id: string) {
  return p.dialogueView?.choices.find((c) => c.id === id);
}

async function hearTheNews(p: Player, bed: string, answer: 'tell' | 'keep'): Promise<void> {
  await p.interact(bed);
  await p.advance();
  expect(p.dialogueView?.dialogueId).toBe('d-night-news');
  expect(p.h.state().flags['heard-report']).toBe(true);
  expect(hour(p.h)).toBeGreaterThanOrEqual(23);
  await p.choose('where');
  await p.choose(answer);
  await p.finish();
  expect(p.h.ui.getState().panel).toBe('scripture-connection');
  p.h.controller.panelFinished('scripture-connection');
  expect(p.h.ui.getState().panel).toBe('reflection');
  p.h.session.setReflection('I wondered what it would be like to hear that news.');
  p.h.controller.panelFinished('reflection');
  await flush();
  expect(p.h.ui.getState().panel).toBe('summary');
  expect(p.h.state().chapterComplete).toBe(true);
  expect(p.h.state().quests['q-room']?.status).toBe('completed');
}

describe('A Journey to Bethlehem — full playthroughs', () => {
  it('generous path: side quest, a space left, the lamb found, Zerah in the guest room, the house woken', async () => {
    const { h, p } = await start();
    await opening(p);
    expect(hour(h)).toBe(14);

    // The door stays shut until the work at home is done — and says why.
    await p.exit('to-lanes');
    expect(p.scene()).toBe('tamar-house');
    expect(p.dialogueView?.nodeId).toBe('bread');
    await p.finish();

    await bakeBread(p);
    expect(hour(h)).toBe(15);
    await p.interact('peninah');
    await p.choose('why');
    await p.choose('things');
    await p.choose('bye');
    await p.finish();

    // Knowing about the dry corner on the roof lets the barley leave the room.
    await p.interact('ladder');
    await arrangeRoom(p, null);
    expect(h.state().choices.find((c) => c.choiceId === 'choice-room')?.optionId).toBe(
      'made-space',
    );
    // The loom and tools now stand with the animals; a space is left in the guest room.
    expect(shown(h, 'stable-loom')).toBeDefined();
    expect(shown(h, 'stable-tools')).toBeDefined();
    expect(shown(h, 'guest-loom')).toBeUndefined();
    expect(shown(h, 'guest-grain')).toBeUndefined();
    expect(shown(h, 'spare-mat')).toBeDefined();

    await collectSupper(p);
    await toLanes(p);

    // Village: Hagit's offer and her knowledge of the flock; Asa in the long line.
    await p.interact('hagit');
    await p.choose('full');
    await p.choose('flock');
    await p.choose('bye');
    await p.finish();
    expect(h.state().flags['hagit-offered']).toBe(true);
    await p.interact('asa-queue');
    await p.choose('seen');
    await p.choose('bye');
    await p.finish();
    expect(h.state().quests['q-queue']?.status).toBe('active');
    await p.interact('amram');
    await p.choose('well');
    await p.choose('bye');
    await p.finish();
    expect(h.state().journal.unlocked).toContain('js-well');

    // Side quest: the clerk's order, then Uncle Asa's declaration.
    await p.interact('blank-tablet');
    expect(p.dialogueView?.nodeId).toBe('busy');
    await p.finish();
    await p.interact('kallias');
    await p.choose('who');
    await p.choose('help');
    await p.finish();
    await p.interact('model-tablet');
    await p.interact('blank-tablet');
    await p.finish();
    expect(h.ui.getState().puzzleId).toBe('p-register');
    const puzzle = h.puzzles.find('p-register');
    if (puzzle?.type !== 'sequence') throw new Error('expected a sequence puzzle');
    expect(h.puzzles.submitSequence('p-register', puzzle.initialOrder)?.correct).toBe(false);
    expect(h.puzzles.submitSequence('p-register', puzzle.correctOrder)?.correct).toBe(true);
    expect(h.puzzles.submitConclusion('p-register', 'land')?.correct).toBe(false);
    expect(h.puzzles.submitConclusion('p-register', 'tax')?.correct).toBe(true);
    h.controller.closePuzzle();
    await flush();
    expect(h.state().quests['q-queue']?.status).toBe('completed');
    expect(h.state().quests['q-queue']?.outcomeId).toBe('registered');
    expect(shown(h, 'asa-queue')).toBeUndefined(); // gone home early
    expect(hour(h)).toBe(16);

    await p.interact('straw-heap');
    expect(h.state().inventory.straw).toBe(1);

    await toFieldsAndDeliver(p);
    await findTheLamb(p);
    await homeAtNight(p);

    // Every door is open tonight: the space, the straw, and Hagit's offer.
    for (const id of ['own', 'guest', 'straw', 'hagit', 'none'])
      expect(strangerOption(p, id)?.available, id).toBe(true);
    await p.choose('guest');
    await p.finish();
    expect(shown(h, 'zerah-guest')?.pose).toBe('lie');
    expect(shown(h, 'zerah-door')).toBeUndefined();
    expect(shown(h, 'asa-home')?.pose).toBe('lie');

    await hearTheNews(p, 'your-mat', 'tell');
    // Everyone sits up in the lamplight, wondering.
    expect(shown(h, 'zerah-guest')?.pose).toBe('sit');
    expect(shown(h, 'peninah')?.pose).toBe('sit');
    expect(h.state().quests['q-room']?.outcomeId).toBe('told');

    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Zerah slept in the guest room, in the space you had left that afternoon.',
    );
    expect(summary.consequences).toContain(
      'Uncle Asa was registered before dark and came home to help.',
    );
    expect(summary.sideQuests).toEqual([
      { name: 'The Long Line', outcome: 'Registered before dark' },
    ]);
    expect(summary.scripture.map((r) => r.id)).toContain('rec-luke-2-1-20');
  });

  it('careful path: grain kept, home before dark, your own place given, the news kept', async () => {
    const { h, p } = await start();
    await opening(p);
    await bakeBread(p);
    // Without knowing about the roof, the barley has to stay in the guest room.
    await p.interact('bedding');
    const noGrain = h.puzzles.submitPacking('p-room', { 'bed-asa': 1, 'bed-peninah': 1 });
    expect(noGrain?.valid).toBe(false);
    expect(noGrain?.failures.map((f) => f.ruleId)).toEqual(['grain']);
    const tooMuch = h.puzzles.submitPacking('p-room', {
      'bed-asa': 1,
      'bed-peninah': 1,
      grain: 1,
      loom: 1,
    });
    expect(tooMuch?.failures.map((f) => f.ruleId)).toEqual(['capacity']);
    h.controller.closePuzzle();
    await flush();
    await arrangeRoom(p, 'grain');
    expect(shown(h, 'guest-grain')).toBeDefined();
    expect(shown(h, 'stable-loom')).toBeDefined();
    expect(shown(h, 'spare-mat')).toBeUndefined();
    // Uncle Asa is still in the line: not at home.
    expect(shown(h, 'asa-home')).toBeUndefined();

    await collectSupper(p);
    await toLanes(p);
    // Say hello to Uncle Asa in the line, but don't stay to help.
    await p.interact('asa-queue');
    await p.choose('why');
    await p.choose('bye');
    await p.finish();
    await toFieldsAndDeliver(p);
    expect(hour(h)).toBe(16);
    await p.choose('home');
    await p.finish();
    expect(h.state().choices.find((c) => c.choiceId === 'choice-lamb')?.optionId).toBe('left');
    expect(shown(h, 'yoram')).toBeUndefined(); // gone looking with his stick
    await homeAtNight(p);
    expect(shown(h, 'asa-home')).toBeDefined(); // home at last, after the line

    // The constraints of the day are visible: no space, no straw, no one else with room.
    expect(strangerOption(p, 'guest')?.available).toBe(false);
    expect(strangerOption(p, 'guest')?.unavailableText).toMatch(/full/);
    expect(strangerOption(p, 'straw')?.available).toBe(false);
    expect(strangerOption(p, 'hagit')?.available).toBe(false);
    await p.choose('own');
    await p.finish();
    expect(shown(h, 'zerah-hearth')?.pose).toBe('lie');
    expect(shown(h, 'your-mat')).toBeUndefined();
    expect(shown(h, 'your-straw')).toBeDefined();

    await hearTheNews(p, 'your-straw', 'keep');
    expect(shown(h, 'zerah-hearth')?.pose).toBe('lie'); // the house sleeps on
    expect(h.state().quests['q-room']?.outcomeId).toBe('kept');
    expect(h.state().quests['q-queue']?.status).toBe('failed');

    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Zerah slept by the fire in your place, and you slept in the straw beside the animals.',
    );
    expect(summary.consequences).toContain(
      'Uncle Asa waited in line until the clerk packed up at dusk.',
    );
    expect(summary.sideQuests).toEqual([{ name: 'The Long Line', outcome: 'Waited in line' }]);
  });

  it('straw path: the lamb found without the side quest, Zerah on fresh straw', async () => {
    const { h, p } = await start();
    await opening(p);
    await bakeBread(p);
    await p.interact('ladder');
    await arrangeRoom(p, 'tools');
    expect(shown(h, 'guest-tools')).toBeDefined();
    expect(shown(h, 'stable-tools')).toBeUndefined();
    await collectSupper(p);
    await toLanes(p);
    await p.interact('straw-heap');
    await p.interact('straw-heap'); // only one armful
    expect(h.state().inventory.straw).toBe(1);
    await toFieldsAndDeliver(p);
    await findTheLamb(p);
    await homeAtNight(p);
    expect(strangerOption(p, 'guest')?.available).toBe(false);
    await p.choose('straw');
    await p.finish();
    expect(h.state().inventory.straw).toBeUndefined();
    expect(shown(h, 'zerah-straw')?.pose).toBe('lie');
    expect(shown(h, 'straw-bed')).toBeDefined();
    await hearTheNews(p, 'your-mat', 'tell');
    expect(buildChapterSummary(h.chapter, h.state()).consequences).toContain(
      'Zerah slept on fresh straw beside the animals, warm from their breath.',
    );
  });

  it('neighbor path: Zerah goes to Hagit, and you can see him there', async () => {
    const { h, p } = await start();
    await opening(p);
    await bakeBread(p);
    await p.interact('ladder');
    await arrangeRoom(p, 'loom');
    await collectSupper(p);
    await toLanes(p);
    await p.interact('hagit');
    await p.choose('full');
    await p.choose('bye');
    await p.finish();
    await toFieldsAndDeliver(p);
    await p.choose('home');
    await p.finish();
    await homeAtNight(p);
    const before = hour(h) ?? 0;
    await p.choose('hagit');
    await p.finish();
    expect(hour(h)).toBe(before + 1); // you walked him over yourself
    expect(shown(h, 'zerah-door')).toBeUndefined();
    // Next door, Zerah sits at Hagit's fire.
    await p.exit('to-lanes');
    expect(shown(h, 'zerah-hagit')).toBeDefined();
    await p.interact('hagit');
    expect(p.dialogueView?.nodeId).toBe('night-zerah');
    await p.finish();
    await p.exit('to-house');
    await hearTheNews(p, 'your-mat', 'keep');
    expect(buildChapterSummary(h.chapter, h.state()).consequences).toContain(
      'Zerah slept under Hagit’s dry roof next door.',
    );
  });

  it('full-house path: no room, Zerah by the well, and the search given up halfway', async () => {
    const { h, p } = await start();
    await opening(p);
    await bakeBread(p);
    await arrangeRoom(p, 'grain');
    await collectSupper(p);
    await toLanes(p);
    await toFieldsAndDeliver(p);
    await p.choose('search');
    await p.finish();
    // Leaving while the lamb is still out there is a decision, not a wall.
    await p.exit('to-village');
    expect(p.scene()).toBe('shepherds-fields');
    expect(p.dialogueView?.dialogueId).toBe('d-fields-exit');
    await p.choose('stay');
    await p.finish();
    await p.exit('to-village');
    await p.choose('home');
    await p.finish();
    expect(p.scene()).toBe('bethlehem-lanes');
    expect(h.state().choices.find((c) => c.choiceId === 'choice-lamb')?.optionId).toBe('left');
    await p.exit('to-house');
    await p.advance();
    expect(p.dialogueView?.nodeId).toBe('z4');
    await p.choose('none');
    await p.finish();
    expect(shown(h, 'zerah-door')).toBeUndefined();
    await p.exit('to-lanes');
    expect(shown(h, 'zerah-well')?.pose).toBe('lie');
    await p.interact('zerah-well');
    await p.finish();
    await p.exit('to-house');
    await hearTheNews(p, 'your-mat', 'keep');
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Zerah spent the night wrapped in his cloak by the well. In the morning Hagit found him there and brought him bread.',
    );
    expect(summary.consequences.join(' ')).toMatch(/old man by the well/);
    expect(summary.consequences.join(' ')).not.toMatch(/score|points/i);
  });

  it('never leaves the player stuck: bed before bedtime, the gully before the search, the lamb at the exit', async () => {
    const { h, p } = await start();
    await opening(p);
    await p.interact('your-mat');
    expect(p.dialogueView?.nodeId).toBe('early');
    await p.finish();
    await bakeBread(p);
    await arrangeRoom(p, 'grain');
    await collectSupper(p);
    await toLanes(p);
    await toFieldsAndDeliver(p);
    await p.choose('search');
    await p.finish();
    await p.interact('trough-prints');
    await p.interact('terrace-gap');
    // Two signs are enough to argue it; the gully path opens the puzzle itself.
    await p.interact('gully-path');
    expect(h.ui.getState().puzzleId).toBe('p-lamb');
    const ok = h.puzzles.submitDeduction('p-lamb', 'gully', [
      'clue-small-prints',
      'clue-terrace-gap',
    ]);
    expect(ok?.correct, ok?.feedback.join(' | ')).toBe(true);
    h.controller.closePuzzle();
    await flush();
    await p.interact('lamb');
    await p.exit('to-village');
    expect(p.dialogueView?.nodeId).toBe('carrying');
    await p.finish();
    expect(p.scene()).toBe('shepherds-fields');
  });
});

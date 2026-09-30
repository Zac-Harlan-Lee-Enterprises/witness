import { describe, expect, it } from 'vitest';
import { LETTER_FROM_PAUL } from '@/content/chapters/letter-from-paul';
import { buildChapterSummary } from '@/domain/chapter-summary';
import { createHarness, flush, loadChapter, Player, type Harness } from '../support/harness';

/**
 * Headless playthroughs of Chapter 4, driving the REAL application layer
 * (session, controllers, rules, content) with a fake world: proof that every
 * major branch reaches the summary with no dead ends, and that choices show
 * up in the world.
 */
const chapter = () => loadChapter(LETTER_FROM_PAUL);
const start = async (): Promise<{ h: Harness; p: Player }> => {
  const h = await createHarness({ chapter: chapter() });
  return { h, p: new Player(h) };
};

const shown = (h: Harness, id: string) => h.world.entities.find((e) => e.id === id);
const playerMarks = (h: Harness): string[] =>
  h.world.playerMarks.at(-1) ?? h.world.scenes.at(-1)?.player.marks ?? [];

/** Continue through narration until the next choice, even across chained conversations. */
async function advanceAll(p: Player): Promise<void> {
  for (let i = 0; i < 6; i++) await p.advance();
}

async function opening(p: Player): Promise<void> {
  expect(p.dialogueView?.dialogueId).toBe('d-opening');
  await p.choose('c-who');
  await p.choose('c-batch');
  await p.choose('c-go');
  await p.finish();
  expect(p.h.state().quests['q-letters']?.status).toBe('active');
  expect(p.h.state().inventory['kallias-letter']).toBe(1);
  await p.exit('workshop-door');
  expect(p.scene()).toBe('colossae-street');
}

async function sortLetter(p: Player): Promise<void> {
  await p.interact('zenon');
  await p.choose('how');
  await p.choose('try');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-sheets');
  const puzzle = p.h.puzzles.find('p-sheets');
  if (puzzle?.type !== 'sequence') throw new Error('expected a sequence puzzle');
  expect(p.h.puzzles.submitSequence('p-sheets', puzzle.initialOrder)?.correct).toBe(false);
  expect(p.h.puzzles.submitSequence('p-sheets', puzzle.correctOrder)?.correct).toBe(true);
  expect(p.h.puzzles.submitConclusion('p-sheets', 'cancel')?.correct).toBe(false);
  expect(p.h.puzzles.submitConclusion('p-sheets', 'come-back')?.correct).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
}

async function readToAmmia(p: Player, how: 'every' | 'soften' | 'plea'): Promise<void> {
  await p.exit('to-workshop');
  expect(p.scene()).toBe('ammia-workshop');
  await p.interact('ammia');
  await p.choose(how);
  await p.finish();
  expect(p.h.state().inventory['ammia-letter']).toBe(1);
  expect(p.h.state().quests['q-letters']?.stageId).toBe('road');
}

/** Ask Ammia the way, and follow her directions on the sketch (one wrong turn first). */
async function findTheWay(p: Player): Promise<void> {
  expect(p.scene()).toBe('ammia-workshop');
  await p.interact('ammia');
  await p.choose('c-way');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-pack');
  // Turning left after the third milestone finds the wrong dye works.
  const early = p.followMap('p-pack', ['west', 'west', 'west', 'west', 'south', 'east']);
  expect(early?.correct).toBe(false);
  expect(early?.feedback).toMatch(/before the fourth milestone/);
  const right = p.followMap('p-pack', WAY_TO_NIKON);
  expect(right?.correct).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  expect(p.h.state().flags['knows-the-way']).toBe(true);
}

/** Four milestones west, left (south) to the river, right (west) past the waystation. */
const WAY_TO_NIKON = [
  'west',
  'west',
  'west',
  'west',
  'west',
  'west',
  'south',
  'west',
  'west',
] as const;

/** Pack the travel bag, one thing at a time, and tie it shut. */
async function pack(p: Player, packed: readonly string[]): Promise<void> {
  expect(p.scene()).toBe('ammia-workshop');
  await p.interact('bag');
  expect(p.dialogueView?.dialogueId).toBe('d-bag');
  for (const item of packed) await p.choose(`in-${item}`);
  await p.choose('tie');
  await p.finish();
  expect(p.h.state().flags['packed']).toBe(true);
  // What went in is what you carry; the rest stays at home. The letter always comes.
  for (const item of packed) expect(p.h.state().inventory[item], item).toBe(1);
  expect(p.h.state().inventory['ammia-letter']).toBe(1);
}

/** Ready for the road: the way, then the bag. */
async function prepare(p: Player, packed: readonly string[]): Promise<void> {
  await findTheWay(p);
  await pack(p, packed);
}

async function toTheBridge(p: Player): Promise<void> {
  await p.exit('workshop-door');
  await p.exit('west-gate');
  expect(p.scene()).toBe('lycus-road');
  expect(p.h.world.weather).toBe('clear');
  await p.step(42, 15); // setting out
  await p.step(30, 15); // the rain comes
  expect(p.h.state().flags['rain-began']).toBe(true);
  expect(p.h.world.weather).toBe('rain');
  await p.step(12, 14); // the dye works
}

/** Meet Kallias and read him Ammia's letter; ends at the debt question. */
async function meetKallias(p: Player): Promise<void> {
  await p.interact('kallias');
  await p.choose('letter');
  await p.advance();
  expect(p.dialogueView?.nodeId).toBe('k9');
  expect(p.h.state().flags['read-to-kallias']).toBe(true);
}

function solveAlum(h: Harness): void {
  const p = new Player(h);
  // Two madder dips and a blue make wine, not mulberry: the red must come out first.
  expect(p.dye('p-alum', ['madder', 'madder', 'blue'])?.solved).toBe(false);
  expect(p.dye('p-alum', ['madder', 'rinse', 'madder', 'blue'])?.solved).toBe(true);
}

async function helpTheMuleDriver(p: Player): Promise<void> {
  expect(p.scene()).toBe('colossae-street');
  await p.interact('attalos');
  await p.choose('help');
  expect(p.h.state().quests['q-bundle']?.status).toBe('active');
  await p.choose('who');
  await p.choose('look');
  await p.choose('think');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-whose');
  // An unreliable guess spoils the argument; the evidence decides.
  expect(p.h.puzzles.submitDeduction('p-whose', 'zenon', ['clue-white-dust'])?.correct).toBe(false);
  const result = p.h.puzzles.submitDeduction('p-whose', 'tatia', [
    'clue-white-dust',
    'clue-cloth-merchant',
  ]);
  expect(result?.correct, result?.feedback.join(' | ')).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  await p.interact('tatia');
  await p.choose('bye');
  await p.finish();
  expect(p.h.state().quests['q-bundle']?.status).toBe('completed');
  expect(p.h.state().inventory['bundle-letter']).toBeUndefined();
}

async function arriveAtGathering(p: Player): Promise<void> {
  expect(p.scene()).toBe('colossae-street');
  expect(p.h.state().flags['back-in-town']).toBe(true);
  expect(p.h.world.weather).toBe('clear');
  await p.finish(); // the return narration
  await p.exit('to-philemon');
  expect(p.scene()).toBe('philemon-house');
  expect(p.h.state().counters.hour).toBe(18);
  expect(p.dialogueView?.dialogueId).toBe('d-gathering-arrive'); // opens on arrival
  await p.finish();
  expect(p.h.state().journal.unlocked).toContain('jp-onesimus');
  // The people named in the New Testament are present but silent.
  for (const id of ['philemon', 'tychicus', 'onesimus']) {
    expect(shown(p.h, id)).toBeDefined();
    expect(shown(p.h, id)?.interactive).toBe(false);
  }
}

async function finishTheChapter(p: Player): Promise<void> {
  expect(p.h.ui.getState().panel).toBe('scripture-connection');
  p.h.controller.panelFinished('scripture-connection');
  expect(p.h.ui.getState().panel).toBe('reflection');
  p.h.session.setReflection('Saying sorry is hard, and so is forgiving.');
  p.h.controller.panelFinished('reflection');
  await flush();
  expect(p.h.ui.getState().panel).toBe('summary');
  expect(p.h.state().chapterComplete).toBe(true);
  expect(p.h.state().quests['q-letters']?.status).toBe('completed');
}

describe('A Letter from Paul — full playthroughs', () => {
  it('home together: side quest, alum bath, three coins, the old cloak, a mule ride', async () => {
    const { h, p } = await start();
    await opening(p);
    await helpTheMuleDriver(p);
    await sortLetter(p);
    await readToAmmia(p, 'every');
    await prepare(p, ['spare-cloak', 'tablets', 'letter-case']);
    expect(h.state().inventory['hooded-cloak']).toBeUndefined(); // left at home
    expect(playerMarks(h)).toEqual(['letter-case', 'cloak-roll']);
    await toTheBridge(p);
    // Attalos waits out the rain at the waystation, as he said he would.
    expect(shown(h, 'attalos-road')).toBeDefined();
    await meetKallias(p);
    await p.choose('account');
    expect(h.state().inventory.coins).toBeUndefined();
    await p.choose('help');
    await p.finish();
    await p.interact('alum-jars');
    solveAlum(h);
    h.controller.closePuzzle();
    await flush();
    expect(shown(h, 'alum-bath')).toBeDefined();
    await p.interact('kallias');
    await p.choose('come');
    await p.choose('give');
    await p.finish();
    expect(h.state().flags['kallias-paid']).toBe(true);
    expect(h.state().flags['rode-mule']).toBe(true);
    expect(playerMarks(h)).toEqual(['letter-case']); // the cloak went to Kallias
    await arriveAtGathering(p);
    // Kallias stands beside you, in his old cloak; Ammia turns to him.
    expect(shown(h, 'kallias-gathering')?.marks).toEqual(['wrapped-in-cloak']);
    expect(shown(h, 'ammia-gathering')?.facing).toBe('left');
    expect(shown(h, 'reply-tablets')).toBeUndefined();
    await p.interact('ammia-gathering');
    await advanceAll(p);
    expect(h.state().flags['heard-the-letters']).toBe(true);
    await finishTheChapter(p);
    expect(h.state().quests['q-letters']?.outcomeId).toBe('together');

    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Kallias walked home warm in the cloak Ammia had kept for him all winter.',
    );
    expect(summary.consequences).toContain('Three of your own coins went toward Kallias’s debt.');
    expect(summary.sideQuests).toEqual([
      { name: 'The Mule Driver’s Bundle', outcome: 'Delivered' },
    ]);
    expect(summary.scripture.map((r) => r.id)).toContain('rec-phm');
  });

  it('an answer carried home: softened reading, rain cloak, tablets, a promise kept', async () => {
    const { h, p } = await start();
    await opening(p);
    // Learn that rain is coming: now the letter must be kept dry.
    await p.interact('tatia');
    await p.choose('weather');
    await p.choose('bye');
    await p.finish();
    expect(h.state().clues).toContain('clue-rain-coming');
    await sortLetter(p);
    await readToAmmia(p, 'soften');
    await findTheWay(p);
    // The gate stays shut until the bag is packed, even once you know the way.
    await p.exit('workshop-door');
    await p.exit('west-gate');
    expect(p.dialogueView?.nodeId).toBe('pack');
    await p.finish();
    await p.exit('to-workshop');
    await p.interact('bag');
    const choice = (id: string) => p.dialogueView?.choices.find((c) => c.id === id);
    await p.choose('in-tablets');
    await p.choose('in-bread');
    // Rain is coming and nothing keeps the letter dry: the bag can't be tied yet.
    expect(choice('tie')?.available).toBe(false);
    expect(choice('tie')?.unavailableText).toMatch(/keep it dry/);
    await p.choose('in-hooded-cloak');
    // Four is full: two cloaks don't fit.
    expect(choice('in-spare-cloak')?.available).toBe(false);
    expect(p.dialogueView?.nodeId).toBe('load-4');
    await p.choose('tie');
    await p.finish();
    expect(h.state().choices.find((c) => c.choiceId === 'choice-packing')?.optionId).toBe(
      'for-writing',
    );
    expect(h.state().inventory['spare-cloak']).toBeUndefined(); // left at home
    await toTheBridge(p);
    expect(h.state().flags['letter-wet']).toBeUndefined(); // under the hooded cloak
    expect(shown(h, 'attalos-road')).toBeUndefined(); // you didn't help him
    await meetKallias(p);
    await p.choose('speak');
    await p.choose('bread');
    await p.choose('write');
    await p.finish();
    expect(h.state().inventory['kallias-reply']).toBe(1);
    expect(shown(h, 'kallias')).toBeDefined(); // he stays at his work
    await p.exit('to-colossae');
    await arriveAtGathering(p);
    expect(shown(h, 'kallias-gathering')).toBeUndefined();
    expect(shown(h, 'reply-tablets')).toBeDefined();
    await p.interact('ammia-gathering');
    await advanceAll(p);
    await finishTheChapter(p);
    expect(h.state().quests['q-letters']?.outcomeId).toBe('carried');
    expect(h.state().quests['q-bundle']).toBeUndefined();

    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences.join(' ')).toMatch(/His answer on your tablets said it again/);
    expect(summary.consequences.join(' ')).toMatch(/came to Ammia’s door the next morning/);
  });

  it('left to him: a plea, a wet letter, Chrysis, and a speech you promised', async () => {
    const { h, p } = await start();
    await opening(p);
    // Start the side quest, then leave town without finishing it.
    await p.interact('attalos');
    await p.choose('help');
    await p.choose('later');
    await p.finish();
    await sortLetter(p);
    await readToAmmia(p, 'plea');
    await prepare(p, ['bread']); // nobody mentioned rain, so nothing forces a cover
    await toTheBridge(p);
    expect(h.state().flags['letter-wet']).toBe(true);
    expect(h.state().quests['q-bundle']?.status).toBe('failed');
    await p.interact('chrysis');
    await p.choose('you');
    await p.choose('leave');
    await p.choose('bread');
    await p.choose('bye');
    await p.finish();
    expect(h.state().flags['talked-chrysis']).toBe(true);
    expect(h.state().inventory.bread).toBeUndefined();
    await meetKallias(p);
    expect(p.dialogueView?.nodeId).toBe('k9');
    await p.choose('theirs');
    // Without tablets, writing his answer down is visibly impossible.
    await p.advance();
    const write = p.dialogueView?.choices.find((c) => c.id === 'write');
    expect(write?.available).toBe(false);
    expect(write?.unavailableText).toMatch(/anything to write on/);
    await p.choose('leave');
    await p.finish();
    await p.exit('to-colossae');
    await arriveAtGathering(p);
    expect(shown(h, 'ammia-gathering')?.facing).toBe('down'); // watching the door
    await p.interact('ammia-gathering');
    await p.choose('ready');
    await advanceAll(p);
    await finishTheChapter(p);
    expect(h.state().quests['q-letters']?.outcomeId).toBe('left-to-him');

    const summary = buildChapterSummary(h.chapter, h.state());
    const text = summary.consequences.join(' ');
    expect(text).toMatch(/came to Ammia’s door three days later/);
    expect(text).toMatch(/The rain blurred Ammia’s letter/);
    expect(text).toMatch(/Chrysis told you/);
    expect(text).toMatch(/back to Laodicea, unread/);
  });

  it('keeping a promise at the gathering: speak up for Kallias when he comes home with you', async () => {
    const { h, p } = await start();
    await opening(p);
    await sortLetter(p);
    await readToAmmia(p, 'soften');
    await prepare(p, ['spare-cloak', 'letter-case']);
    await toTheBridge(p);
    await meetKallias(p);
    await p.choose('speak');
    await p.choose('come');
    await p.choose('keep');
    await p.finish();
    expect(h.state().flags['kallias-paid']).toBeUndefined(); // he gave up his wage
    await arriveAtGathering(p);
    expect(shown(h, 'kallias-gathering')?.marks).toEqual([]);
    await p.interact('ammia-gathering');
    await advanceAll(p);
    // Kallias tells Ammia the part you left out.
    expect(h.state().flags['kallias-confessed']).toBe(true);
    await p.choose('speak');
    await advanceAll(p);
    expect(h.state().flags['spoke-for-kallias']).toBe(true);
    await finishTheChapter(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    const text = summary.consequences.join(' ');
    expect(text).toMatch(/At the gathering, he told Ammia himself/);
    expect(text).toMatch(/Kallias lost a day’s wage/);
    expect(text).toMatch(/spoke up for Kallias/);
  });

  it('never sends the player down the road unprepared, and explains why', async () => {
    const { h, p } = await start();
    await opening(p);
    await p.exit('west-gate');
    expect(p.scene()).toBe('colossae-street');
    expect(p.dialogueView?.dialogueId).toBe('d-gate-blocked');
    expect(p.dialogueView?.nodeId).toBe('no-letter');
    await p.finish();
    await p.exit('to-philemon');
    expect(p.scene()).toBe('colossae-street');
    expect(h.ui.getState().toasts.some((t) => t.text.includes('lamp-lighting'))).toBe(true);
    await p.exit('to-workshop');
    await p.interact('bag');
    expect(h.ui.getState().puzzleId).toBeNull();
  });
});

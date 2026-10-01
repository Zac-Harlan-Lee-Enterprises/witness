import { describe, expect, it } from 'vitest';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';
import { buildChapterSummary } from '@/domain/chapter-summary';
import { createHarness, flush, loadChapter, Player, type Harness } from '../support/harness';

/**
 * Headless playthroughs of "A Storm on Galilee", driving the REAL
 * application layer (session, controllers, rules, content) with a fake
 * world. Every major branch reaches the summary, and each branch's choices
 * show up in the world afterwards.
 */
const storm = () => createHarness({ chapter: loadChapter(STORM_ON_GALILEE) });

function shown(h: Harness, id: string) {
  return h.world.entities.find((e) => e.id === id);
}

function playerMarks(h: Harness): string[] {
  return h.world.playerMarks.at(-1) ?? h.world.scenes.at(-1)?.player.marks ?? [];
}

async function opening(p: Player): Promise<void> {
  expect(p.dialogueView?.dialogueId).toBe('d-opening');
  await p.choose('c-who');
  await p.choose('c-ready');
  await p.choose('c-go');
  await p.choose('c-knots');
  await p.finish();
  expect(p.h.state().quests['q-crossing']?.status).toBe('active');
  // Grandmother's corner: tie the last knots of the family's mark.
  expect(p.h.ui.getState().puzzleId).toBe('p-corner');
  expect(p.mendNet('p-corner')?.solved).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  expect(p.h.state().quests['q-crossing']?.completedObjectives).toContain('corner');
  expect(p.h.state().inventory).toMatchObject({ lamp: 1, bread: 1, cloak: 1, 'water-skin': 1 });
  await p.exit('house-door');
  expect(p.scene()).toBe('capernaum-shore');
  expect(p.h.world.weather).toBe('wind'); // the afternoon westerly
}

async function getGear(p: Player): Promise<void> {
  await p.interact('elazar');
  await p.choose('how-much');
  await p.choose('bye');
  await p.finish();
  expect(p.h.state().flags['got-gear']).toBe(true);
}

async function getJars(p: Player, askAboutWeather = true): Promise<void> {
  await p.interact('nikanor');
  if (askAboutWeather) {
    await p.choose('weather');
    await p.choose('often');
  }
  await p.choose('bye');
  await p.finish();
  expect(p.h.state().inventory['fish-jar']).toBe(6);
}

async function learnSail(p: Player): Promise<void> {
  await p.interact('tamar');
  await p.choose('sail');
  await p.choose('bye');
  await p.finish();
  expect(p.h.state().clues).toContain('clue-tamar-sail');
}

async function meetShifra(p: Player): Promise<void> {
  await p.interact('shifra');
  await p.choose('home');
  await p.choose('bye');
  await p.finish();
}

async function brineSideQuest(p: Player): Promise<void> {
  await p.interact('nikanor');
  await p.choose('help');
  await p.choose('yes');
  await p.finish();
  expect(p.h.state().quests['q-brine']?.stageId).toBe('measure');
  await p.interact('brine-jars');
  expect(p.h.ui.getState().puzzleId).toBe('p-brine');
  expect(p.mendNet('p-brine')?.solved).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  await p.interact('nikanor');
  await p.finish();
  expect(p.h.state().quests['q-brine']?.status).toBe('completed');
  expect(p.h.state().flags['nikanor-agreed']).toBe(true);
}

/** Talk to Hanina, look around the shore, and read the sky with evidence. */
async function readSky(p: Player): Promise<void> {
  await p.interact('hanina');
  await p.choose('sky');
  await p.choose('bye');
  await p.finish();
  await p.interact('far-shore');
  await p.interact('magdala-boat');
  await p.interact('western-hills');
  await p.interact('waters-edge');
  expect(p.h.state().quests['q-crossing']?.completedObjectives).toContain('look-around');
  await p.interact('lake-view');
  expect(p.h.ui.getState().puzzleId).toBe('p-sky');
  expect(p.h.puzzles.submitDeduction('p-sky', 'calm', ['clue-hanina-east'])?.correct).toBe(false);
  const shaky = p.h.puzzles.submitDeduction('p-sky', 'squall', [
    'clue-hanina-east',
    'clue-cold-breath',
    'clue-afternoon-wind',
  ]);
  expect(shaky?.correct).toBe(true); // an irrelevant clue is flagged, not fatal
  expect(shaky?.feedback.join(' ')).toMatch(/does not bear/);
  p.h.controller.closePuzzle();
  await flush();
  expect(p.h.state().flags['sky-read']).toBe(true);
}

/** Load the boat; evening comes and the boats put out. */
async function loadBoat(p: Player, packed: Record<string, number>): Promise<void> {
  await p.interact('family-boat');
  await p.choose('load');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-load');
  const result = p.loadAndTrim('p-load', packed);
  expect(result?.valid, JSON.stringify(result?.failures)).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  expect(p.dialogueView?.dialogueId).toBe('d-evening');
  expect(p.h.state().counters.hour).toBe(18);
  expect(p.h.world.weather).toBe('clear'); // the westerly has dropped
}

/** Cast off. (The harness reads straight on into the arrival narration once the lake loads.) */
async function castOff(p: Player): Promise<void> {
  await p.finish();
  await p.finish();
  expect(p.scene()).toBe('open-lake');
  expect(p.h.state().conversations).toContain('d-under-way');
  expect(p.h.state().flags['under-way']).toBe(true);
  expect(p.h.state().counters.hour).toBe(19);
  expect(p.h.world.weather).toBe('clear');
}

/** The wind rises; get the sail in; the storm breaks. */
async function squall(p: Player, how: 'talk' | 'walk'): Promise<void> {
  if (how === 'talk') {
    await p.interact('tamar-lake');
    await p.choose('ok'); // the conversation ends, and the wind gets up
    await p.advance();
  } else {
    await p.step(25, 11);
  }
  expect(p.dialogueView?.dialogueId).toBe('d-gust');
  expect(p.h.world.weather).toBe('wind');
  await p.choose('now');
  await p.finish();
  expect(p.h.ui.getState().puzzleId).toBe('p-sail');
  const puzzle = p.h.puzzles.find('p-sail');
  if (puzzle?.type !== 'sequence') throw new Error('expected sequence');
  expect(p.h.puzzles.submitSequence('p-sail', puzzle.initialOrder)?.correct).toBe(false);
  expect(p.h.puzzles.submitSequence('p-sail', puzzle.correctOrder)?.correct).toBe(true);
  expect(p.h.puzzles.submitConclusion('p-sail', 'run')?.correct).toBe(false);
  expect(p.h.puzzles.submitConclusion('p-sail', 'steady')?.correct).toBe(true);
  p.h.controller.closePuzzle();
  await flush();
  expect(p.dialogueView?.dialogueId).toBe('d-squall');
  expect(p.h.world.weather).toBe('storm');
  await p.finish();
  expect(p.h.state().flags['small-boat-seen']).toBe(true);
}

/** The decision at the port rail; the calm follows (the harness reads on through it). */
async function decide(p: Player, choice: string): Promise<void> {
  await p.interact('port-rail');
  await p.choose(choice);
  await p.finish();
  await p.finish();
  expect(p.h.state().conversations).toContain('d-calm');
  expect(p.h.state().flags['great-calm']).toBe(true);
  expect(p.h.state().counters.hour).toBe(23);
  expect(p.h.world.weather).toBe('clear');
}

/** See to the others at the port rail once the wind has dropped (if not done already). */
async function seeToOthers(p: Player): Promise<void> {
  if (p.h.state().flags['saw-to-others']) return;
  await p.interact('port-rail');
  await p.advance();
  if (p.dialogueView?.choices.some((c) => c.id === 'call')) await p.choose('call');
  await p.finish();
  expect(p.h.state().flags['saw-to-others']).toBe(true);
}

async function goHome(p: Player, net?: 'set' | 'home'): Promise<void> {
  await seeToOthers(p);
  await p.interact('elazar-lake');
  await p.choose('home');
  if (net) await p.choose(net);
  await p.finish();
  await p.finish();
  expect(p.scene()).toBe('capernaum-shore');
  expect(p.h.state().counters.hour).toBe(net === 'set' ? 27 : 26);
  expect(p.h.state().conversations).toContain('d-homecoming');
  expect(shown(p.h, 'shelomit-night')).toBeDefined();
  expect(shown(p.h, 'hanina')).toBeUndefined();
  expect(p.h.world.weather).toBe('clear');
}

/** Tell Nikanor everyone is safe, and what became of his jars. */
async function tellNikanor(p: Player, ...choices: string[]): Promise<void> {
  await p.interact('nikanor-night');
  await p.choose('all');
  for (const c of choices) await p.choose(c);
  await p.finish();
  expect(p.h.state().flags['told-nikanor']).toBe(true);
}

async function ending(p: Player): Promise<void> {
  if (!p.h.state().flags['told-nikanor']) await tellNikanor(p);
  await p.interact('shelomit-night');
  await p.choose('storm');
  await p.choose('stopped');
  await p.finish();
  expect(p.h.ui.getState().panel).toBe('scripture-connection');
  p.h.controller.panelFinished('scripture-connection');
  expect(p.h.ui.getState().panel).toBe('reflection');
  p.h.session.setReflection('I was most afraid when I lost sight of the little boat.');
  p.h.controller.panelFinished('reflection');
  await flush();
  expect(p.h.ui.getState().panel).toBe('summary');
  expect(p.h.state().chapterComplete).toBe(true);
  expect(p.h.state().quests['q-crossing']?.status).toBe('completed');
}

describe('A Storm on Galilee — full playthroughs', () => {
  it('prepared and generous: side quest, Ami aboard, a tow in the storm, the cloak', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await learnSail(p);
    await getJars(p);
    await brineSideQuest(p);
    await readSky(p);
    await meetShifra(p);
    await loadBoat(p, { bailer: 1, 'fish-jar': 4, rope: 1, 'spare-oar': 1, cloak: 1, lamp: 1 });
    expect(h.state().inventory.net).toBeUndefined(); // left on the jetty
    expect(h.state().flags['left-jars']).toBe(true);
    expect(playerMarks(h)).toEqual(['lamp', 'cloak-roll']);
    await p.choose('room'); // four jars: there is room for Ami
    await castOff(p);
    expect(shown(h, 'ami-aboard')).toBeDefined();
    expect(shown(h, 'ami-small')).toBeUndefined();
    expect(shown(h, 'rope-coil')).toBeDefined();
    expect(h.world.lighting?.lamp).toBe(true);
    await squall(p, 'talk');
    await decide(p, 'tow');
    expect(shown(h, 'towline')).toBeDefined();
    expect(shown(h, 'rope-coil')).toBeUndefined();
    await p.interact('ami-aboard');
    await p.choose('cloak');
    await p.finish();
    expect(shown(h, 'ami-aboard')?.marks).toEqual(['wrapped-in-cloak']);
    expect(playerMarks(h)).toEqual(['lamp']);
    await goHome(p);
    // What came home with you: Ami in your cloak, the towed boat's rope, the jars you left.
    expect(shown(h, 'ami')?.marks).toEqual(['wrapped-in-cloak']);
    expect(shown(h, 'towline')).toBeDefined();
    expect(shown(h, 'jars-ashore')).toBeDefined();
    await ending(p);
    expect(h.state().quests['q-crossing']?.outcomeId).toBe('cargo-safe');
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Your rope held, and the two boats came home tied together.',
    );
    expect(summary.consequences).toContain('Ami went home wrapped in your cloak.');
    expect(summary.consequences).toContain(
      'Nikanor’s jar net was mended and ready for the morning.',
    );
    expect(summary.sideQuests).toEqual([
      { name: 'Nikanor’s Jar Net', outcome: 'The net is mended' },
    ]);
    expect(summary.scripture.map((r) => r.id)).toContain('rec-mark-4-35-41');
    expect(summary.choices.find((c) => c.prompt.startsWith('How did you load'))?.chosen).toMatch(
      /gear for trouble/,
    );
  });

  it('full cargo: leave a jar for Ami, then throw jars overboard to take the family aboard', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p, false);
    await readSky(p);
    await meetShifra(p);
    await loadBoat(p, { bailer: 1, 'fish-jar': 6, lamp: 1, cloak: 1, bread: 1 });
    expect(h.state().flags['left-jars']).toBeUndefined();
    await p.choose('make-room'); // six jars: a jar stays ashore so Ami can come
    expect(h.state().inventory['fish-jar']).toBe(5);
    await castOff(p);
    expect(shown(h, 'cargo-jars-more')).toBeDefined();
    await squall(p, 'walk');
    await decide(p, 'take-aboard-heavy');
    expect(h.state().flags.jettisoned).toBe(true);
    expect(h.state().inventory['fish-jar']).toBe(2);
    expect(shown(h, 'floating-jars')).toBeDefined();
    expect(shown(h, 'shifra-aboard')).toBeDefined();
    expect(shown(h, 'shifra-small')).toBeUndefined();
    expect(shown(h, 'cargo-jars-more')).toBeUndefined();
    await goHome(p);
    expect(shown(h, 'jars-ashore')).toBeDefined(); // the jar you left for Ami
    await p.interact('nikanor-night');
    expect(p.dialogueView?.nodeId).toBe('night');
    await p.choose('all');
    await p.advance();
    expect(p.dialogueView?.nodeId).toBe('night-lost');
    await p.choose('why');
    await p.finish();
    await ending(p);
    expect(h.state().quests['q-crossing']?.outcomeId).toBe('cargo-lost');
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences.join(' ')).toMatch(/Three of Nikanor’s jars went over the side/);
    expect(summary.consequences).toContain('Ami crossed in your boat, beside you.');
    expect(summary.sideQuests).toEqual([]);
  });

  it('never met Shifra: keep your own boat afloat, with no rope, oar or cloak to share', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p);
    await readSky(p);
    await loadBoat(p, { bailer: 1, 'fish-jar': 4, net: 1, 'water-skin': 1, bread: 1, lamp: 1 });
    expect(p.dialogueView?.choices ?? []).toEqual([]); // nobody asks about Ami
    await castOff(p);
    expect(shown(h, 'ami-small')).toBeDefined();
    expect(shown(h, 'net-cargo')).toBeDefined();
    await squall(p, 'talk');
    await p.interact('port-rail');
    await p.advance();
    const view = p.dialogueView;
    expect(view?.nodeId).toBe('decide');
    // What you didn't pack is shown as the reason, not hidden.
    expect(view?.choices.find((c) => c.id === 'tow')).toMatchObject({
      available: false,
      unavailableText: 'You didn’t bring the rope.',
    });
    expect(view?.choices.find((c) => c.id === 'oar')?.available).toBe(false);
    await p.choose('hold');
    await p.finish();
    await p.finish(); // the calm
    expect(h.state().flags['great-calm']).toBe(true);
    await p.interact('port-rail');
    await p.advance();
    expect(p.dialogueView?.choices.find((c) => c.id === 'pass-cloak')?.available).toBe(false);
    await p.choose('call');
    await p.finish();
    await goHome(p, 'home');
    await ending(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences.join(' ')).toMatch(/You kept your own boat afloat/);
    expect(summary.consequences).toContain('Everyone who went out with your boat came home.');
    expect(summary.choices.some((c) => c.prompt.startsWith('When Shifra asked'))).toBe(false);
  });

  it('light load after the side quest: no room for Ami, the spare oar in the storm, the cloak passed across', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p);
    await brineSideQuest(p);
    await readSky(p);
    await meetShifra(p);
    await loadBoat(p, {
      bailer: 1,
      'fish-jar': 2,
      'spare-oar': 1,
      rope: 1,
      cloak: 1,
      lamp: 1,
      bread: 1,
      'water-skin': 1,
    });
    await p.choose('stay');
    await castOff(p);
    await squall(p, 'talk');
    await decide(p, 'oar');
    expect(h.state().inventory['spare-oar']).toBeUndefined();
    await p.interact('port-rail');
    await p.choose('pass-cloak');
    await p.finish();
    expect(shown(h, 'ami-small')?.marks).toEqual(['wrapped-in-cloak']);
    await goHome(p);
    expect(shown(h, 'spare-oar-returned')).toBeDefined();
    expect(shown(h, 'ami')?.marks).toEqual(['wrapped-in-cloak']);
    await ending(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'With your spare oar, Oded kept their bow to the waves until the wind dropped.',
    );
    expect(summary.choices.find((c) => c.prompt.startsWith('How did you load'))?.chosen).toMatch(
      /light load/i,
    );
  });

  it('won’t load the boat before the sky is read or the gear is in, and explains why', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await p.interact('family-boat');
    expect(p.dialogueView?.nodeId).toBe('sky');
    await p.finish();
    expect(h.ui.getState().puzzleId).toBeNull();
    await p.interact('lake-view');
    expect(h.ui.getState().puzzleId).toBeNull();
    expect(h.ui.getState().toasts.some((t) => t.text.includes('Ask Old Hanina'))).toBe(true);
    await readSky(p);
    await p.interact('family-boat');
    expect(p.dialogueView?.nodeId).toBe('gear');
    await p.finish();
  });

  it('rejects a load that is too heavy, has no bailer, or carries too few jars', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p);
    await readSky(p);
    await p.interact('family-boat');
    await p.choose('load');
    await p.finish();
    const failures = (packed: Record<string, number>) =>
      p.loadAndTrim('p-load', packed)?.failures.map((f) => f.ruleId);
    expect(failures({ bailer: 1, 'fish-jar': 6, net: 1, 'spare-oar': 1 })).toEqual(['capacity']);
    expect(failures({ 'fish-jar': 4 })).toEqual(['bailer']);
    expect(failures({ bailer: 1, 'fish-jar': 2 })).toEqual(['jars']);
    // Nikanor's untested claim spoils a reading of the sky, as unreliable evidence.
    const hasty = h.puzzles.submitDeduction('p-sky', 'squall', [
      'clue-hanina-east',
      'clue-cold-breath',
      'clue-nikanor-calm',
    ]);
    expect(hasty?.correct).toBe(false);
  });

  it('starting the brine and casting off before finishing leaves it for the morning', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p);
    await p.interact('nikanor');
    await p.choose('help');
    await p.choose('yes');
    await p.finish();
    await readSky(p);
    await loadBoat(p, { bailer: 1, 'fish-jar': 6, rope: 1, lamp: 1, bread: 1 });
    await castOff(p);
    expect(h.state().quests['q-brine']?.status).toBe('failed');
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain('Nikanor’s jar net was left torn when you cast off.');
  });

  it('won’t leave the house until Grandmother’s knots are tied, and explains why', async () => {
    const h = await storm();
    const p = new Player(h);
    await p.choose('c-who');
    await p.choose('c-ready');
    await p.choose('c-go');
    await p.choose('c-knots');
    await p.finish();
    expect(h.ui.getState().puzzleId).toBe('p-corner');
    h.controller.closePuzzle(); // walk away without tying them
    await flush();
    await p.exit('house-door');
    expect(p.scene()).toBe('shelomit-house');
    expect(h.ui.getState().toasts.some((t) => t.text.includes('last knots'))).toBe(true);
    await p.interact('shelomit');
    expect(p.dialogueView?.nodeId).toBe('corner');
    await p.choose('later');
    await p.finish();
    await p.interact('mending');
    await p.choose('tie');
    await p.finish();
    expect(h.ui.getState().puzzleId).toBe('p-corner');
    expect(p.mendNet('p-corner')?.solved).toBe(true);
    h.controller.closePuzzle();
    await flush();
    expect(h.state().flags['mended-with-grandmother']).toBe(true);
    await p.exit('house-door');
    expect(p.scene()).toBe('capernaum-shore');
    await p.interact('mending'); // nothing to do: the house is behind you
    expect(h.state().journal.unlocked).toContain('je-corner');
  });

  it('readies the little boat before the storm: Hodaya’s old bailer and a sealed seam keep it afloat', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p);
    // Hodaya of the Magdala crew: her reading of the night, and the haul.
    await p.interact('hodaya');
    await p.choose('why');
    await p.choose('help');
    await p.choose('bye');
    await p.finish();
    expect(h.state().clues).toContain('clue-magdala-crew');
    expect(h.state().inventory['spare-bailer']).toBe(1);
    // Oded's leaking boat: ask Elazar how, get pitch from Nikanor, seal it together.
    await p.interact('oded');
    await p.choose('seal');
    await p.choose('find');
    await p.finish();
    expect(h.state().quests['q-leak']?.stageId).toBe('ask');
    await p.interact('elazar');
    await p.choose('seam');
    await p.choose('bye');
    await p.finish();
    expect(h.state().quests['q-leak']?.stageId).toBe('pitch');
    await p.interact('nikanor');
    await p.choose('pitch');
    await p.choose('bye');
    await p.finish();
    expect(h.state().inventory.pitch).toBe(1);
    await p.interact('oded');
    await p.choose('give-bailer');
    await p.choose('patch');
    await p.finish();
    expect(h.state().flags['oded-bailer']).toBe(true);
    expect(h.ui.getState().puzzleId).toBe('p-patch');
    const patch = h.puzzles.find('p-patch');
    if (patch?.type !== 'sequence') throw new Error('expected sequence');
    const first = h.puzzles.submitSequence('p-patch', patch.initialOrder);
    expect(first?.correct).toBe(false);
    expect(first?.feedback).toMatch(/wet cloth/);
    expect(h.puzzles.submitSequence('p-patch', patch.correctOrder)?.correct).toBe(true);
    expect(h.puzzles.submitConclusion('p-patch', 'forever')?.correct).toBe(false);
    expect(h.puzzles.submitConclusion('p-patch', 'mostly')?.correct).toBe(true);
    h.controller.closePuzzle();
    await flush();
    expect(h.state().quests['q-leak']?.status).toBe('completed');
    expect(h.state().inventory.pitch).toBeUndefined();
    await p.interact('oded');
    expect(p.dialogueView?.nodeId).toBe('patched');
    await p.choose('bye');
    await p.finish();

    await readSky(p);
    await loadBoat(p, { bailer: 1, 'fish-jar': 4, lamp: 1, net: 1, cloak: 1 });
    await castOff(p);
    // Hang the lamp at the stern, for the little boats behind.
    await p.interact('elazar-lake');
    await p.choose('lamp');
    await p.advance();
    expect(h.state().flags['lamp-hung']).toBe(true);
    expect(p.dialogueView?.dialogueId).toBe('d-gust');
    await p.choose('now');
    await p.finish();
    const sail = h.puzzles.find('p-sail');
    if (sail?.type !== 'sequence') throw new Error('expected sequence');
    h.puzzles.submitSequence('p-sail', sail.correctOrder);
    h.puzzles.submitConclusion('p-sail', 'steady');
    h.controller.closePuzzle();
    await flush();
    await p.finish();
    await p.interact('port-rail');
    await p.advance();
    expect(p.dialogueView?.nodeId).toBe('decide');
    await p.choose('hold');
    await p.finish();
    await p.finish(); // the calm
    // Elazar won't turn for home until you've seen to the others.
    await p.interact('elazar-lake');
    await p.advance();
    expect(p.dialogueView?.choices.find((c) => c.id === 'home')).toMatchObject({
      available: false,
      unavailableText: 'First see to the others, at the port rail.',
    });
    await p.choose('wait');
    await p.finish();
    await p.interact('port-rail');
    await p.advance();
    await p.choose('call');
    await p.finish();
    expect(h.state().flags['followed-lamp']).toBe(true);
    // The net is aboard: set it on the still water on the way home.
    await goHome(p, 'set');
    expect(h.state().flags['net-set']).toBe(true);
    // Grandmother sends you to Nikanor first.
    await p.interact('shelomit-night');
    await p.finish();
    await p.interact('shelomit-night');
    expect(p.dialogueView?.nodeId).toBe('first3');
    await p.finish();
    await tellNikanor(p);
    await p.interact('hanina-night');
    await p.choose('right');
    await p.finish();
    await p.interact('hodaya');
    await p.choose('bailer');
    await p.finish();
    await p.interact('oded');
    await p.finish();
    await ending(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toEqual(
      expect.arrayContaining([
        'You kept your own boat afloat. When the wind dropped, you found the little boat low in the water but still afloat, with everyone in it.',
        'The seam you sealed on Oded’s boat held through the storm: not a drop came up through it.',
        'Shifra bailed through the storm with the old scoop you brought her from the Magdala crew.',
        'Shifra’s family kept your lamp in sight all through the storm.',
        'The trammel net came home full, and Nikanor will buy the catch for salting.',
      ]),
    );
    expect(summary.sideQuests).toContainEqual({
      name: 'Oded’s Leaking Boat',
      outcome: 'The seam is sealed',
    });
    expect(summary.choices.find((c) => c.prompt.startsWith('On the still water'))?.chosen).toMatch(
      /set the trammel net/,
    );
    expect(h.state().quests['q-crossing']?.completedObjectives).toEqual(
      expect.arrayContaining(['others', 'nikanor']),
    );
  });

  it('casting off with the seam unsealed leaves the little boat swamped', async () => {
    const h = await storm();
    const p = new Player(h);
    await opening(p);
    await getGear(p);
    await getJars(p);
    await meetShifra(p);
    await p.interact('oded');
    await p.choose('seal');
    await p.choose('find');
    await p.finish();
    await readSky(p);
    await loadBoat(p, { bailer: 1, 'fish-jar': 4, lamp: 1, rope: 1 });
    await p.choose('stay');
    await castOff(p);
    expect(h.state().quests['q-leak']?.status).toBe('failed');
    await squall(p, 'walk');
    await p.interact('port-rail');
    await p.advance();
    expect(p.dialogueView?.nodeId).toBe('decide');
    await p.choose('hold');
    await p.finish();
    await p.finish();
    await goHome(p);
    await ending(p);
    const summary = buildChapterSummary(h.chapter, h.state());
    expect(summary.consequences).toContain(
      'Oded’s boat put out with a rag still stuffed in its cracked seam.',
    );
    expect(summary.consequences.join(' ')).toMatch(/swamped but afloat/);
  });
});

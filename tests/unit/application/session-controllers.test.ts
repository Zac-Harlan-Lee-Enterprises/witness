import { describe, expect, it } from 'vitest';
import { emphasisFor } from '@/application/game-controller';
import { createHarness, flush, Player } from '../../support/harness';

describe('GameSession + controllers', () => {
  it('starts a new game with the opening conversation and an autosave request after scene changes', async () => {
    const h = await createHarness();
    expect(h.events[0]).toEqual({ type: 'ChapterStarted', chapterId: 'road-to-jericho' });
    expect(h.ui.getState().dialogue?.dialogueId).toBe('d-opening');
    expect(h.world.currentScene).toBe('miriam-house');
  });

  it('logs dialogue history with choices', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.choose('c-me');
    expect(h.state().dialogueLog.some((l) => l.choiceId === 'c-me')).toBe(true);
  });

  it('ends a conversation gracefully when content points at a missing node', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.finish().catch(() => undefined);
    h.dialogue.end();
    await flush();
    const dialogue = h.chapter.dialogues.find((d) => d.id === 'd-natan');
    if (!dialogue) throw new Error('missing');
    // Simulate a broken content reference.
    const original = dialogue.start;
    (dialogue as { start: string }).start = 'does-not-exist';
    h.ui.setDialogue(null);
    h.dialogue.start('d-natan');
    await flush();
    (dialogue as { start: string }).start = original;
    expect(h.ui.getState().dialogue).toBeNull();
    expect(h.state().conversations).toContain('d-natan');
  });

  it('refuses unavailable dialogue choices', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    await p.exit('house-door');
    await p.interact('malik');
    await p.choose('sell');
    // Spend coins elsewhere first by hacking state: 0 coins.
    h.session.dispatch([{ type: 'takeItem', item: 'coins', quantity: 5 }]);
    h.dialogue.render();
    const buy = p.dialogueView?.choices.find((c) => c.id === 'buy');
    expect(buy).toMatchObject({ available: false, unavailableText: 'You need 2 coins.' });
    h.dialogue.choose('buy');
    expect(h.state().inventory.map).toBeUndefined();
  });

  it('queues screen requests while a conversation is open and runs them in order afterwards', async () => {
    const h = await createHarness();
    const p = new Player(h);
    h.session.dispatch([{ type: 'openPuzzle', puzzle: 'p-satchel' }]);
    await flush();
    expect(h.ui.getState().puzzleId).toBeNull(); // opening dialogue still active
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    await flush();
    expect(h.ui.getState().puzzleId).toBe('p-satchel');
  });

  it('blocks restricted exits with an explanation and keeps the player in place', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.exit('house-door');
    expect(p.scene()).toBe('miriam-house');
  });

  it('logs and survives invalid quest transitions in content', async () => {
    const h = await createHarness();
    const before = h.state();
    h.session.dispatch([{ type: 'completeObjective', quest: 'q-remedy', objective: 'hear' }]);
    expect(h.state()).toEqual(before);
  });

  it('counts play time only while not paused', async () => {
    const h = await createHarness();
    h.controller.tick(5000);
    h.ui.openOverlay('pause');
    h.controller.tick(5000);
    expect(h.state().playTimeMs).toBe(5000);
  });

  it('shows the place name on arrival and lights the world from the story clock and lamp', async () => {
    const h = await createHarness();
    expect(h.ui.getState().place?.name).toBe('Aunt Miriam’s house');
    expect(h.world.scenes[0]?.lighting.hour).toBe(h.state().counters.hour);

    h.session.dispatch([{ type: 'setCounter', counter: 'hour', value: 21 }]);
    await flush();
    expect(h.world.lighting?.hour).toBe(21);

    h.session.dispatch([{ type: 'takeItem', item: 'lamp' }]);
    await flush();
    expect(h.world.lighting).toEqual({ hour: 21, lamp: false });

    h.session.dispatch([{ type: 'giveItem', item: 'lamp' }]);
    await flush();
    expect(h.world.lighting).toEqual({ hour: 21, lamp: true });
  });

  it('goes where you chose in "Go to…" even if you chose it while the place was still loading', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.choose('c-yes');
    await p.choose('c-go');
    await p.finish();
    h.world.holdLoads = true;
    await p.exit('house-door');
    // The story is already in the market, but the world still shows the house.
    expect(h.ui.getState().transitioning).toBe(true);
    expect(h.world.currentScene).toBe('miriam-house');
    h.ui.openOverlay('goto');
    h.controller.travelTo('shimon');
    expect(h.ui.getState().overlay).toBeNull();
    expect(h.world.travels).toEqual([]);
    h.world.releaseLoads();
    await flush();
    expect(h.world.currentScene).toBe('jerusalem-market');
    expect(h.world.travels).toEqual(['shimon']);
  });

  it('tells the player when a destination cannot be reached yet', async () => {
    const h = await createHarness();
    h.controller.handleWorldEvent({ type: 'unreachable', targetId: 'anywhere' });
    expect(h.ui.getState().toasts.at(-1)).toMatchObject({ label: 'Not yet' });
  });

  it('greets you as a stranger the first time, even though meeting him is recorded', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.choose('c-me');
    await p.finish().catch(() => undefined);
    h.dialogue.end();
    await flush();
    h.ui.setDialogue(null);

    h.dialogue.start('d-menashe-road');
    await flush();
    expect(h.ui.getState().dialogue?.nodeId).toBe('stranger0');
    expect(h.state().metCharacters).toContain('menashe');
  });

  it('evaluates a `met` entry against who you had met BEFORE this conversation', async () => {
    const h = await createHarness();
    const p = new Player(h);
    await p.choose('c-me');
    await p.finish().catch(() => undefined);
    h.dialogue.end();
    await flush();
    h.ui.setDialogue(null);
    const dialogue = h.chapter.dialogues.find((d) => d.id === 'd-menashe-road');
    if (!dialogue) throw new Error('missing');
    const original = dialogue.entries;
    (dialogue as { entries: typeof original }).entries = [
      { when: { type: 'met', character: 'menashe' }, node: 'known0' },
    ];
    try {
      h.dialogue.start('d-menashe-road');
      await flush();
      expect(h.ui.getState().dialogue?.nodeId).toBe('stranger0');
      h.dialogue.end();
      await flush();
      h.ui.setDialogue(null);
      h.dialogue.start('d-menashe-road');
      await flush();
      expect(h.ui.getState().dialogue?.nodeId).toBe('known0');
    } finally {
      (dialogue as { entries: typeof original }).entries = original;
    }
  });

  it('publishes ChapterStarted once everyone is listening, so analytics (when allowed) sees it', async () => {
    const h = await createHarness({ analyticsConsent: true });
    expect(h.analytics.map((e) => e.name)).toContain('ChapterStarted');
    expect(h.events.filter((e) => e.type === 'ChapterStarted')).toHaveLength(1);
    // Re-attaching the world (a remount) does not start the chapter again.
    await h.controller.attachWorld(h.world);
    expect(h.events.filter((e) => e.type === 'ChapterStarted')).toHaveLength(1);
  });

  it('records the original save version on restore and flags saves from older chapter content', async () => {
    const h = await createHarness({ analyticsConsent: true });
    h.controller.noteRestored('p1:road-to-jericho:auto', 1, h.chapter.contentVersion);
    expect(h.events.at(-1)).toEqual({
      type: 'SaveRestored',
      saveId: 'p1:road-to-jericho:auto',
      fromSchemaVersion: 1,
    });
    expect(h.ui.getState().messages.some((m) => /earlier version/.test(m.text))).toBe(false);

    h.controller.noteRestored('p1:road-to-jericho:auto', 2, 'legacy-v1');
    expect(h.ui.getState().toasts.at(-1)?.text).toMatch(/earlier version of this chapter/);
  });

  it('places a player saved inside a wall (an older map) on the nearest open tile', async () => {
    const h = await createHarness();
    const state = { ...h.state(), player: { ...h.state().player, x: 5, y: 1 } }; // the house's back wall
    const restored = await createHarness({ restore: state });
    const model = restored.world.scenes.at(-1);
    expect(model?.player).toMatchObject({ x: 6, y: 2 }); // (5,2) holds grain sacks
  });

  it('stages conversations for the world: who you talk with and who is speaking', async () => {
    const h = await createHarness();
    const p = new Player(h);
    // The opening begins with narration inside Miriam's conversation.
    expect(h.world.conversations.at(-1)).toEqual({ with: 'miriam', speaking: null });
    await p.advance();
    expect(h.world.conversations.some((c) => c?.speaking === 'miriam')).toBe(true);
    await p.choose('c-me');
    await p.finish().catch(() => undefined);
    h.dialogue.end();
    await flush();
    h.ui.setDialogue(null);
    expect(h.world.conversations.at(-1)).toBeNull();
  });

  it('asks the world for a flourish where a clue is found, and for items, solved puzzles and objectives', async () => {
    expect(emphasisFor({ type: 'ClueDiscovered', clueId: 'c' }, 'broken-jar')).toEqual({
      kind: 'clue',
      at: 'broken-jar',
    });
    expect(
      emphasisFor({ type: 'ItemCollected', itemId: 'i', quantity: 1, total: 1 }, null),
    ).toEqual({
      kind: 'item',
      at: null,
    });
    expect(
      emphasisFor({ type: 'PuzzleCompleted', puzzleId: 'p', attempts: 1, hintsUsed: 0 }, null)
        ?.kind,
    ).toBe('solved');
    expect(emphasisFor({ type: 'QuestStarted', questId: 'q' }, null)?.kind).toBe('objective');
    expect(emphasisFor({ type: 'FlagChanged', flag: 'f', value: true }, null)).toBeNull();
    const h = await createHarness();
    h.session.dispatch([{ type: 'takeItem', item: 'lamp' }]);
    h.session.dispatch([{ type: 'giveItem', item: 'lamp' }]);
    await flush();
    expect(h.world.emphases.at(-1)).toEqual({ kind: 'item', at: null });
  });
});

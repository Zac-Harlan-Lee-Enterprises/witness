import { describe, expect, it } from 'vitest';
import { ChapterSchema, type Chapter } from '@/domain/chapter';
import {
  QuestSchema,
  questLog,
  currentObjective,
  completeObjective,
  QuestTransitionError,
  type Quest,
} from '@/domain/quests';
import { runEffects } from '@/domain/rules';
import { makeState } from '../../support/state';

const quest: Quest = QuestSchema.parse({
  id: 'q',
  name: 'Test quest',
  description: 'd',
  kind: 'main',
  stages: [
    {
      id: 'one',
      title: 'Stage one',
      description: 'd',
      objectives: [
        { id: 'a', description: 'Find the clue', completeWhen: { type: 'clueFound', clue: 'k' } },
        {
          id: 'opt',
          description: 'Optional',
          optional: true,
          completeWhen: { type: 'flag', flag: 'never' },
        },
      ],
      next: 'two',
    },
    {
      id: 'two',
      title: 'Stage two',
      description: 'd',
      onEnter: [{ type: 'setFlag', flag: 'entered-two', value: true }],
      objectives: [
        { id: 'b', description: 'Decide', completeWhen: { type: 'choiceMade', choice: 'c' } },
      ],
    },
  ],
  outcomes: [
    {
      id: 'good',
      kind: 'success',
      title: 'Good',
      description: 'd',
      when: { type: 'choiceMade', choice: 'c', option: 'x' },
      rewards: [{ type: 'giveItem', item: 'medal' }],
    },
    { id: 'other', kind: 'alternate', title: 'Other', description: 'd' },
    { id: 'left', kind: 'failure', title: 'Left', description: 'd' },
  ],
  failWhen: { type: 'flag', flag: 'abandoned' },
  failOutcome: 'left',
  eventsConsumed: ['ClueDiscovered'],
  eventsEmitted: ['QuestStarted'],
  journal: { onStart: 'j-start', onComplete: 'j-done' },
});

// Minimal chapter shell around the quest so the real rules runner can run.
function chapterWith(q: Quest): Chapter {
  return ChapterSchema.parse({
    id: 't',
    number: 1,
    title: 't',
    subtitle: 't',
    synopsis: 't',
    estimatedMinutes: { min: 1, max: 2 },
    contentVersion: '1',
    setting: 's',
    start: { scene: 's', spawn: 'p' },
    initial: {},
    mainQuest: q.id,
    characters: [],
    items: [
      {
        id: 'medal',
        name: 'Medal',
        description: 'd',
        kind: 'tool',
        weight: 0,
        maxStack: 1,
        icon: '*',
      },
    ],
    scenes: [
      {
        id: 's',
        name: 's',
        kind: 'indoor',
        description: 'd',
        layout: ['...', '...', '...'],
        legend: { '.': 'floor' },
        baseTile: 'floor',
        spawns: { p: { x: 1, y: 1, facing: 'down' } },
        entities: [],
        exits: [],
      },
    ],
    dialogues: [],
    quests: [q],
    clues: [],
    puzzles: [],
    journal: [
      { id: 'j-start', category: 'events', title: 's', summary: 's', recordIds: ['r'] },
      { id: 'j-done', category: 'events', title: 'd', summary: 'd', recordIds: ['r'] },
    ],
    records: [],
    sources: [],
    choices: [],
    themes: [{ id: 't', name: 't', description: 't' }],
    scriptureConnection: {
      title: 't',
      intro: 'i',
      sections: [{ heading: 'h', recordIds: ['r'] }],
      comparisons: [{ text: 'c' }],
    },
    summary: {
      recap: [{ text: 'r' }],
      consequences: [{ id: 'c', when: { type: 'always' }, text: 'c' }],
      themes: ['t'],
      scriptureRecordIds: ['r'],
      historyRecordIds: ['r'],
      reflectionPrompts: ['p'],
    },
  });
}

const chapter = chapterWith(quest);
const run = (state: ReturnType<typeof makeState>, effects: Parameters<typeof runEffects>[1]) =>
  runEffects(state, effects, { chapter, nowMs: 0 });

describe('quest engine', () => {
  it('starts, unlocks the start journal entry, and ignores duplicate starts', () => {
    const r = run(makeState(), [{ type: 'startQuest', quest: 'q' }]);
    expect(r.state.quests.q).toMatchObject({ status: 'active', stageId: 'one' });
    expect(r.state.journal.unlocked).toContain('j-start');
    expect(r.events.map((e) => e.type)).toEqual(['QuestStarted', 'JournalEntryUnlocked']);
    const again = run(r.state, [{ type: 'startQuest', quest: 'q' }]);
    expect(again.events).toEqual([]);
  });

  it('completes objectives from state, advances stages, runs onEnter, and ignores optional objectives', () => {
    let s = run(makeState(), [{ type: 'startQuest', quest: 'q' }]).state;
    const r = run(s, [{ type: 'discoverClue', clue: 'k' }]);
    s = r.state;
    expect(s.quests.q?.stageId).toBe('two');
    expect(s.flags['entered-two']).toBe(true);
    expect(r.events.map((e) => e.type)).toEqual(
      expect.arrayContaining([
        'ClueDiscovered',
        'QuestObjectiveCompleted',
        'QuestStageAdvanced',
        'SaveRequested',
      ]),
    );
  });

  it('picks the first matching outcome and applies its rewards', () => {
    let s = run(makeState(), [
      { type: 'startQuest', quest: 'q' },
      { type: 'discoverClue', clue: 'k' },
    ]).state;
    s = run(s, [{ type: 'recordChoice', choice: 'c', option: 'x' }]).state;
    expect(s.quests.q).toMatchObject({ status: 'completed', outcomeId: 'good' });
    expect(s.inventory.medal).toBe(1);
    expect(s.journal.unlocked).toContain('j-done');
  });

  it('falls back to an alternate outcome when conditions differ', () => {
    let s = run(makeState(), [
      { type: 'startQuest', quest: 'q' },
      { type: 'discoverClue', clue: 'k' },
    ]).state;
    s = run(s, [{ type: 'recordChoice', choice: 'c', option: 'y' }]).state;
    expect(s.quests.q?.outcomeId).toBe('other');
  });

  it('ends with the fail outcome when failWhen holds (an alternate ending, not a punishment)', () => {
    let s = run(makeState(), [{ type: 'startQuest', quest: 'q' }]).state;
    const r = run(s, [{ type: 'setFlag', flag: 'abandoned', value: true }]);
    s = r.state;
    expect(s.quests.q).toMatchObject({ status: 'failed', outcomeId: 'left' });
    expect(r.events.some((e) => e.type === 'QuestFailed')).toBe(true);
  });

  it('rejects completing an objective from another stage', () => {
    const s = run(makeState(), [{ type: 'startQuest', quest: 'q' }]).state;
    expect(() => completeObjective(s, quest, 'b')).toThrow(QuestTransitionError);
    // …and the rules runner turns that into a logged no-op rather than a crash (via GameSession).
  });

  it('builds the quest log and the HUD objective', () => {
    const s = run(makeState(), [{ type: 'startQuest', quest: 'q' }]).state;
    const log = questLog(s, [quest]);
    expect(log[0]?.objectives.map((o) => [o.id, o.done])).toEqual([
      ['a', false],
      ['opt', false],
    ]);
    expect(currentObjective(s, [quest])).toBe('Find the clue');
  });

  it('is deterministic: same effects, same state and events', () => {
    const a = run(makeState(), [
      { type: 'startQuest', quest: 'q' },
      { type: 'discoverClue', clue: 'k' },
    ]);
    const b = run(makeState(), [
      { type: 'startQuest', quest: 'q' },
      { type: 'discoverClue', clue: 'k' },
    ]);
    expect(a).toEqual(b);
  });
});

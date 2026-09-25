import { z } from 'zod';
import { ConditionSchema, evaluate } from './conditions';
import { EffectSchema, type Effect } from './effects';
import type { DomainEvent, DomainEventType } from './events';
import type { GameState, QuestProgress } from './state/game-state';

/**
 * Quest definitions are pure data; progression is deterministic and lives
 * here — never inside a Phaser scene. Objectives complete either when their
 * `completeWhen` condition becomes true (re-evaluated after every state
 * change) or explicitly via a `completeObjective` effect.
 */
export const QuestObjectiveSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  completeWhen: ConditionSchema.optional(),
  optional: z.boolean().default(false),
  /** Hide from the quest log until this is true (for surprises). */
  revealWhen: ConditionSchema.optional(),
});
/** @public Domain-model type (chapter-authoring API). */
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;

export const QuestStageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  objectives: z.array(QuestObjectiveSchema).min(1),
  /** Next stage id; omit on the final stage. */
  next: z.string().optional(),
  onEnter: z.array(EffectSchema).default([]),
});
/** @public Domain-model type (chapter-authoring API). */
export type QuestStage = z.infer<typeof QuestStageSchema>;

export const QuestOutcomeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['success', 'alternate', 'failure']),
  title: z.string().min(1),
  description: z.string().min(1),
  /** First matching outcome wins when the final stage completes. */
  when: ConditionSchema.optional(),
  rewards: z.array(EffectSchema).default([]),
});
/** @public Domain-model type (chapter-authoring API). */
export type QuestOutcome = z.infer<typeof QuestOutcomeSchema>;

export const QuestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['main', 'side']),
  prerequisites: ConditionSchema.optional(),
  /** Start automatically once prerequisites hold (otherwise via a startQuest effect). */
  autoStart: z.boolean().default(false),
  stages: z.array(QuestStageSchema).min(1),
  outcomes: z.array(QuestOutcomeSchema).min(1),
  /** When true while active, the quest ends with `failOutcome` (alternate endings, not punishments). */
  failWhen: ConditionSchema.optional(),
  failOutcome: z.string().optional(),
  eventsConsumed: z.array(z.string()),
  eventsEmitted: z.array(z.string()),
  journal: z.object({
    onStart: z.string().optional(),
    onComplete: z.string().optional(),
  }),
});
export type Quest = z.infer<typeof QuestSchema>;

export const QUEST_EMITTED_EVENTS: readonly DomainEventType[] = [
  'QuestStarted',
  'QuestObjectiveCompleted',
  'QuestStageAdvanced',
  'QuestCompleted',
  'QuestFailed',
];

export interface QuestStepResult {
  state: GameState;
  events: DomainEvent[];
  /** Effects the caller must apply (stage onEnter, outcome rewards, journal unlocks). */
  effects: Effect[];
  changed: boolean;
}

export class QuestTransitionError extends Error {}

function setProgress(state: GameState, questId: string, progress: QuestProgress): GameState {
  return { ...state, quests: { ...state.quests, [questId]: progress } };
}

export function startQuest(state: GameState, quest: Quest, nowMs: number): QuestStepResult {
  const existing = state.quests[quest.id];
  if (existing && existing.status !== 'inactive') {
    return { state, events: [], effects: [], changed: false };
  }
  if (!evaluate(quest.prerequisites, state)) {
    return { state, events: [], effects: [], changed: false };
  }
  const first = quest.stages[0];
  if (!first) throw new QuestTransitionError(`Quest ${quest.id} has no stages`);
  const next = setProgress(state, quest.id, {
    status: 'active',
    stageId: first.id,
    completedObjectives: [],
    outcomeId: null,
    startedAtMs: nowMs,
  });
  const effects: Effect[] = [...first.onEnter];
  if (quest.journal.onStart) effects.push({ type: 'unlockJournal', entry: quest.journal.onStart });
  return {
    state: next,
    events: [{ type: 'QuestStarted', questId: quest.id }],
    effects,
    changed: true,
  };
}

/** Explicitly complete an objective (from a completeObjective effect). */
export function completeObjective(
  state: GameState,
  quest: Quest,
  objectiveId: string,
): QuestStepResult {
  const progress = state.quests[quest.id];
  if (!progress || progress.status !== 'active') {
    return { state, events: [], effects: [], changed: false };
  }
  const stage = quest.stages.find((s) => s.id === progress.stageId);
  if (!stage?.objectives.some((o) => o.id === objectiveId)) {
    throw new QuestTransitionError(
      `Objective '${objectiveId}' is not part of the current stage '${progress.stageId}' of quest '${quest.id}'`,
    );
  }
  if (progress.completedObjectives.includes(objectiveId)) {
    return { state, events: [], effects: [], changed: false };
  }
  return {
    state: setProgress(state, quest.id, {
      ...progress,
      completedObjectives: [...progress.completedObjectives, objectiveId],
    }),
    events: [{ type: 'QuestObjectiveCompleted', questId: quest.id, objectiveId }],
    effects: [],
    changed: true,
  };
}

/**
 * One evaluation pass over a single quest: auto-start, fail checks, objective
 * conditions, stage advancement and completion. Call repeatedly until
 * `changed` is false (the rules runner does this with an iteration cap).
 */
export function stepQuest(state: GameState, quest: Quest, nowMs: number): QuestStepResult {
  const progress = state.quests[quest.id];

  if (!progress || progress.status === 'inactive') {
    if (quest.autoStart) return startQuest(state, quest, nowMs);
    return { state, events: [], effects: [], changed: false };
  }
  if (progress.status !== 'active') return { state, events: [], effects: [], changed: false };

  if (quest.failWhen && evaluate(quest.failWhen, state)) {
    const outcome = quest.outcomes.find((o) => o.id === quest.failOutcome);
    if (!outcome) throw new QuestTransitionError(`Quest ${quest.id} failWhen has no failOutcome`);
    return {
      state: setProgress(state, quest.id, { ...progress, status: 'failed', outcomeId: outcome.id }),
      events: [{ type: 'QuestFailed', questId: quest.id, outcomeId: outcome.id }],
      effects: [...outcome.rewards],
      changed: true,
    };
  }

  const stage = quest.stages.find((s) => s.id === progress.stageId);
  if (!stage)
    throw new QuestTransitionError(`Quest ${quest.id} is in unknown stage ${progress.stageId}`);

  // Objectives whose conditions now hold.
  const newlyDone = stage.objectives.filter(
    (o) =>
      !progress.completedObjectives.includes(o.id) &&
      o.completeWhen !== undefined &&
      evaluate(o.completeWhen, state),
  );
  if (newlyDone.length > 0) {
    return {
      state: setProgress(state, quest.id, {
        ...progress,
        completedObjectives: [...progress.completedObjectives, ...newlyDone.map((o) => o.id)],
      }),
      events: newlyDone.map((o) => ({
        type: 'QuestObjectiveCompleted' as const,
        questId: quest.id,
        objectiveId: o.id,
      })),
      effects: [],
      changed: true,
    };
  }

  const stageDone = stage.objectives
    .filter((o) => !o.optional)
    .every((o) => progress.completedObjectives.includes(o.id));
  if (!stageDone) return { state, events: [], effects: [], changed: false };

  if (stage.next) {
    const nextStage = quest.stages.find((s) => s.id === stage.next);
    if (!nextStage)
      throw new QuestTransitionError(`Quest ${quest.id}: unknown next stage ${stage.next}`);
    return {
      state: setProgress(state, quest.id, { ...progress, stageId: nextStage.id }),
      events: [
        {
          type: 'QuestStageAdvanced',
          questId: quest.id,
          fromStage: stage.id,
          toStage: nextStage.id,
        },
        { type: 'SaveRequested', reason: 'quest-progress' },
      ],
      effects: [...nextStage.onEnter],
      changed: true,
    };
  }

  const outcome =
    quest.outcomes.find(
      (o) => o.kind !== 'failure' && (o.when === undefined || evaluate(o.when, state)),
    ) ?? quest.outcomes[0];
  if (!outcome) throw new QuestTransitionError(`Quest ${quest.id} has no outcomes`);
  const effects: Effect[] = [...outcome.rewards];
  if (quest.journal.onComplete)
    effects.push({ type: 'unlockJournal', entry: quest.journal.onComplete });
  return {
    state: setProgress(state, quest.id, {
      ...progress,
      status: 'completed',
      outcomeId: outcome.id,
    }),
    events: [
      { type: 'QuestCompleted', questId: quest.id, outcomeId: outcome.id },
      { type: 'SaveRequested', reason: 'quest-progress' },
    ],
    effects,
    changed: true,
  };
}

/** View model for the quest log (visible objectives only). */
export interface QuestLogEntry {
  questId: string;
  name: string;
  kind: 'main' | 'side';
  status: QuestProgress['status'];
  stageTitle: string | null;
  stageDescription: string | null;
  objectives: Array<{ id: string; description: string; done: boolean; optional: boolean }>;
  outcome: { title: string; description: string; kind: string } | null;
}

export function questLog(state: GameState, quests: readonly Quest[]): QuestLogEntry[] {
  return quests
    .filter((q) => {
      const status = state.quests[q.id]?.status;
      return status !== undefined && status !== 'inactive';
    })
    .map((q) => {
      const progress = state.quests[q.id] as QuestProgress;
      const stage = q.stages.find((s) => s.id === progress.stageId) ?? null;
      const outcome = q.outcomes.find((o) => o.id === progress.outcomeId) ?? null;
      return {
        questId: q.id,
        name: q.name,
        kind: q.kind,
        status: progress.status,
        stageTitle: progress.status === 'active' ? (stage?.title ?? null) : null,
        stageDescription: progress.status === 'active' ? (stage?.description ?? null) : null,
        objectives:
          progress.status === 'active' && stage
            ? stage.objectives
                .filter((o) => o.revealWhen === undefined || evaluate(o.revealWhen, state))
                .map((o) => ({
                  id: o.id,
                  description: o.description,
                  done: progress.completedObjectives.includes(o.id),
                  optional: o.optional,
                }))
            : [],
        outcome: outcome
          ? { title: outcome.title, description: outcome.description, kind: outcome.kind }
          : null,
      };
    })
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'main' ? -1 : 1));
}

/** The single most relevant "what do I do next" line for the HUD. */
export function currentObjective(state: GameState, quests: readonly Quest[]): string | null {
  const main = questLog(state, quests).find((q) => q.kind === 'main' && q.status === 'active');
  if (!main) return null;
  const next = main.objectives.find((o) => !o.done && !o.optional);
  return next?.description ?? main.stageTitle;
}

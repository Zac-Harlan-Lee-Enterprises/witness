import type { Chapter } from './chapter';
import { applyEffect, type Effect } from './effects';
import type { DomainEvent } from './events';
import { autoUnlockJournal } from './journal';
import { completeObjective, startQuest, stepQuest } from './quests';
import type { GameState } from './state/game-state';

/**
 * The rules runner: applies a batch of effects, then lets quests and journal
 * auto-unlocks react until nothing changes. This single deterministic entry
 * point is what the application layer calls — so the same input always
 * produces the same state and the same ordered events.
 */
export const MAX_RULE_ITERATIONS = 64;

export class RulesError extends Error {}

export interface RulesContext {
  chapter: Chapter;
  nowMs: number;
}

export interface RulesResult {
  state: GameState;
  events: DomainEvent[];
}

export function runEffects(
  state: GameState,
  effects: readonly Effect[],
  ctx: RulesContext,
): RulesResult {
  const itemIndex = new Map(ctx.chapter.items.map((i) => [i.id, i]));
  const questIndex = new Map(ctx.chapter.quests.map((q) => [q.id, q]));
  const effectCtx = {
    nowMs: ctx.nowMs,
    maxStack: (id: string) => itemIndex.get(id)?.maxStack ?? 1,
  };

  let current = state;
  const events: DomainEvent[] = [];
  const queue: Effect[] = [...effects];
  let guard = 0;

  const drain = (): void => {
    while (queue.length > 0) {
      if (++guard > MAX_RULE_ITERATIONS * 8) throw new RulesError('Effect cascade did not settle');
      const effect = queue.shift() as Effect;
      if (effect.type === 'startQuest' || effect.type === 'completeObjective') {
        const quest = questIndex.get(effect.quest);
        if (!quest) throw new RulesError(`Unknown quest '${effect.quest}'`);
        const step =
          effect.type === 'startQuest'
            ? startQuest(current, quest, ctx.nowMs)
            : completeObjective(current, quest, effect.objective);
        current = step.state;
        events.push(...step.events);
        queue.push(...step.effects);
        continue;
      }
      const result = applyEffect(current, effect, effectCtx);
      current = result.state;
      events.push(...result.events);
    }
  };

  drain();
  for (let i = 0; i < MAX_RULE_ITERATIONS; i++) {
    let changed = false;
    for (const quest of ctx.chapter.quests) {
      const step = stepQuest(current, quest, ctx.nowMs);
      if (step.changed) {
        changed = true;
        current = step.state;
        events.push(...step.events);
        queue.push(...step.effects);
        drain();
      }
    }
    const journal = autoUnlockJournal(current, ctx.chapter.journal);
    if (journal.events.length > 0) {
      changed = true;
      current = journal.state;
      events.push(...journal.events);
    }
    if (!changed) return { state: current, events };
  }
  throw new RulesError('Quest rules did not settle — check for conditions that toggle each other');
}

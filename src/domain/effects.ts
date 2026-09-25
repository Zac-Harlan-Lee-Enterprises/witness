import { z } from 'zod';
import type { DomainEvent, MessageTone, PanelId } from './events';
import { addItem, removeItem } from './inventory';
import { appendUnique, type FlagValue, type GameState } from './state/game-state';

/**
 * Declarative state changes. Content describes WHAT should happen; this
 * module is the only place that turns an effect into a new GameState plus the
 * domain events describing the change. Pure: (state, effect) → (state, events).
 */
export type Effect =
  | { type: 'setFlag'; flag: string; value: FlagValue }
  | { type: 'giveItem'; item: string; quantity?: number }
  | { type: 'takeItem'; item: string; quantity?: number }
  | { type: 'startQuest'; quest: string }
  | { type: 'completeObjective'; quest: string; objective: string }
  | { type: 'unlockJournal'; entry: string }
  | { type: 'discoverClue'; clue: string }
  | { type: 'adjustTrust'; character: string; delta: number }
  | { type: 'adjustCounter'; counter: string; delta: number }
  | { type: 'setCounter'; counter: string; value: number }
  | { type: 'recordChoice'; choice: string; option: string }
  | { type: 'meetCharacter'; character: string }
  | { type: 'openPuzzle'; puzzle: string }
  | { type: 'transition'; scene: string; spawn: string }
  | { type: 'startDialogue'; dialogue: string }
  | { type: 'openPanel'; panel: PanelId }
  | { type: 'showMessage'; text: string; tone?: MessageTone }
  | { type: 'playSound'; sound: string }
  | { type: 'completeChapter' };

const id = z.string().min(1);

export const EffectSchema: z.ZodType<Effect> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setFlag'),
    flag: id,
    value: z.union([z.boolean(), z.number(), z.string()]),
  }),
  z.object({
    type: z.literal('giveItem'),
    item: id,
    quantity: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('takeItem'),
    item: id,
    quantity: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal('startQuest'), quest: id }),
  z.object({ type: z.literal('completeObjective'), quest: id, objective: id }),
  z.object({ type: z.literal('unlockJournal'), entry: id }),
  z.object({ type: z.literal('discoverClue'), clue: id }),
  z.object({ type: z.literal('adjustTrust'), character: id, delta: z.number().int() }),
  z.object({ type: z.literal('adjustCounter'), counter: id, delta: z.number() }),
  z.object({ type: z.literal('setCounter'), counter: id, value: z.number() }),
  z.object({ type: z.literal('recordChoice'), choice: id, option: id }),
  z.object({ type: z.literal('meetCharacter'), character: id }),
  z.object({ type: z.literal('openPuzzle'), puzzle: id }),
  z.object({ type: z.literal('transition'), scene: id, spawn: id }),
  z.object({ type: z.literal('startDialogue'), dialogue: id }),
  z.object({
    type: z.literal('openPanel'),
    panel: z.enum(['scripture-connection', 'reflection', 'summary', 'journal', 'satchel']),
  }),
  z.object({
    type: z.literal('showMessage'),
    text: z.string().min(1),
    tone: z.enum(['narration', 'info', 'warning']).optional(),
  }),
  z.object({ type: z.literal('playSound'), sound: id }),
  z.object({ type: z.literal('completeChapter') }),
]);

/** Trust is a relationship fact, clamped to a small readable range. */
export const TRUST_MIN = -2;
export const TRUST_MAX = 3;

export interface EffectContext {
  /** Monotonic play clock in ms (injected for determinism in tests). */
  nowMs: number;
  /** Item stacking limits, from chapter content. */
  maxStack: (itemId: string) => number;
}

export interface EffectResult {
  state: GameState;
  events: DomainEvent[];
}

/**
 * Apply one effect. Quest-related effects (startQuest, completeObjective) are
 * delegated to the quest engine by the rules runner; here they only record
 * intent so this module stays free of quest-definition knowledge.
 */
export function applyEffect(state: GameState, effect: Effect, ctx: EffectContext): EffectResult {
  const events: DomainEvent[] = [];
  switch (effect.type) {
    case 'setFlag': {
      if (state.flags[effect.flag] === effect.value) return { state, events };
      events.push({ type: 'FlagChanged', flag: effect.flag, value: effect.value });
      return {
        state: { ...state, flags: { ...state.flags, [effect.flag]: effect.value } },
        events,
      };
    }
    case 'giveItem': {
      const quantity = effect.quantity ?? 1;
      const result = addItem(state.inventory, effect.item, quantity, ctx.maxStack(effect.item));
      if (result.added === 0) return { state, events };
      events.push({
        type: 'ItemCollected',
        itemId: effect.item,
        quantity: result.added,
        total: result.inventory[effect.item] ?? 0,
      });
      return { state: { ...state, inventory: result.inventory }, events };
    }
    case 'takeItem': {
      const quantity = effect.quantity ?? 1;
      const result = removeItem(state.inventory, effect.item, quantity);
      if (result.removed === 0) return { state, events };
      events.push({
        type: 'ItemRemoved',
        itemId: effect.item,
        quantity: result.removed,
        total: result.inventory[effect.item] ?? 0,
      });
      return { state: { ...state, inventory: result.inventory }, events };
    }
    case 'unlockJournal': {
      if (state.journal.unlocked.includes(effect.entry)) return { state, events };
      events.push({ type: 'JournalEntryUnlocked', entryId: effect.entry });
      return {
        state: {
          ...state,
          journal: {
            ...state.journal,
            unlocked: appendUnique(state.journal.unlocked, effect.entry),
          },
        },
        events,
      };
    }
    case 'discoverClue': {
      if (state.clues.includes(effect.clue)) return { state, events };
      events.push({ type: 'ClueDiscovered', clueId: effect.clue });
      return { state: { ...state, clues: appendUnique(state.clues, effect.clue) }, events };
    }
    case 'adjustTrust': {
      const from = state.trust[effect.character] ?? 0;
      const to = Math.max(TRUST_MIN, Math.min(TRUST_MAX, from + effect.delta));
      if (from === to) return { state, events };
      events.push({ type: 'TrustChanged', characterId: effect.character, from, to });
      return { state: { ...state, trust: { ...state.trust, [effect.character]: to } }, events };
    }
    case 'adjustCounter':
    case 'setCounter': {
      const from = state.counters[effect.counter] ?? 0;
      const to = effect.type === 'setCounter' ? effect.value : from + effect.delta;
      if (from === to) return { state, events };
      events.push({ type: 'CounterChanged', counter: effect.counter, from, to });
      return { state: { ...state, counters: { ...state.counters, [effect.counter]: to } }, events };
    }
    case 'recordChoice': {
      // A choice is recorded once; re-recording the same choice keeps the first answer.
      if (state.choices.some((c) => c.choiceId === effect.choice)) return { state, events };
      events.push({ type: 'ChoiceRecorded', choiceId: effect.choice, optionId: effect.option });
      return {
        state: {
          ...state,
          choices: [
            ...state.choices,
            {
              choiceId: effect.choice,
              optionId: effect.option,
              sceneId: state.sceneId,
              atMs: ctx.nowMs,
            },
          ],
        },
        events,
      };
    }
    case 'meetCharacter': {
      if (state.metCharacters.includes(effect.character)) return { state, events };
      events.push({ type: 'CharacterMet', characterId: effect.character });
      return {
        state: { ...state, metCharacters: appendUnique(state.metCharacters, effect.character) },
        events,
      };
    }
    case 'completeChapter': {
      if (state.chapterComplete) return { state, events };
      events.push({ type: 'ChapterCompleted', chapterId: state.chapterId });
      events.push({ type: 'SaveRequested', reason: 'chapter-complete' });
      return { state: { ...state, chapterComplete: true }, events };
    }
    case 'openPuzzle':
      events.push({ type: 'PuzzleRequested', puzzleId: effect.puzzle });
      return { state, events };
    case 'transition':
      events.push({
        type: 'SceneTransitionRequested',
        sceneId: effect.scene,
        spawnId: effect.spawn,
      });
      return { state, events };
    case 'startDialogue':
      events.push({ type: 'DialogueRequested', dialogueId: effect.dialogue });
      return { state, events };
    case 'openPanel':
      events.push({ type: 'PanelRequested', panel: effect.panel });
      return { state, events };
    case 'showMessage':
      events.push({
        type: 'MessageRequested',
        text: effect.text,
        tone: effect.tone ?? 'narration',
      });
      return { state, events };
    case 'playSound':
      events.push({ type: 'SoundRequested', sound: effect.sound });
      return { state, events };
    case 'startQuest':
    case 'completeObjective':
      // Handled by the rules runner (domain/rules.ts), which knows quest definitions.
      return { state, events };
  }
}

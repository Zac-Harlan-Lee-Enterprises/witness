import { z } from 'zod';
import { ConditionSchema, evaluate } from './conditions';
import type { DomainEvent } from './events';
import { appendUnique, type GameState } from './state/game-state';

/**
 * Clues are investigation facts; journal entries are what the player keeps.
 * Both point at ContentRecords for their labelled text, so the journal can
 * always say whether a paragraph is Scripture, history, interpretation or
 * part of the story.
 */
export const ClueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** What was observed or said, in the game's words. */
  text: z.string().min(1),
  kind: z.enum(['witness', 'environmental', 'document', 'historical', 'scripture']),
  /** Where it came from (character or place name). */
  source: z.string().min(1),
  /** Explicit about reliability instead of pretending certainty. */
  reliability: z.enum(['reliable', 'uncertain', 'conflicting', 'unreliable']),
  reliabilityNote: z.string().optional(),
  recordIds: z.array(z.string()).default([]),
});
/** @public Domain-model type (chapter-authoring API). */
export type Clue = z.infer<typeof ClueSchema>;

export const JOURNAL_CATEGORIES = [
  'people',
  'places',
  'events',
  'history',
  'scripture',
  'themes',
  'maps',
] as const;
export type JournalCategory = (typeof JOURNAL_CATEGORIES)[number];

export const JOURNAL_CATEGORY_LABELS: Record<JournalCategory | 'clues' | 'reflections', string> = {
  people: 'People',
  places: 'Places',
  events: 'Events',
  history: 'History & Culture',
  scripture: 'Scripture',
  themes: 'Themes',
  maps: 'Maps',
  clues: 'Clues',
  reflections: 'Reflections',
};

export const JournalEntrySchema = z.object({
  id: z.string().min(1),
  category: z.enum(JOURNAL_CATEGORIES),
  title: z.string().min(1),
  /** One-line teaser shown in lists. */
  summary: z.string().min(1),
  /** Ordered, labelled blocks of content. */
  recordIds: z.array(z.string()).min(1),
  /** Auto-unlock when this becomes true (otherwise via an unlockJournal effect). */
  unlockWhen: ConditionSchema.optional(),
  characterId: z.string().optional(),
  order: z.number().int().default(0),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

/** Unlock every entry whose `unlockWhen` now holds. */
export function autoUnlockJournal(
  state: GameState,
  entries: readonly JournalEntry[],
): { state: GameState; events: DomainEvent[] } {
  let next = state;
  const events: DomainEvent[] = [];
  for (const entry of entries) {
    if (
      entry.unlockWhen &&
      !next.journal.unlocked.includes(entry.id) &&
      evaluate(entry.unlockWhen, next)
    ) {
      next = {
        ...next,
        journal: { ...next.journal, unlocked: appendUnique(next.journal.unlocked, entry.id) },
      };
      events.push({ type: 'JournalEntryUnlocked', entryId: entry.id });
    }
  }
  return { state: next, events };
}

export function markJournalSeen(state: GameState, entryId: string): GameState {
  if (state.journal.seen.includes(entryId)) return state;
  return {
    ...state,
    journal: { ...state.journal, seen: appendUnique(state.journal.seen, entryId) },
  };
}

export function unlockedByCategory(
  state: GameState,
  entries: readonly JournalEntry[],
): Record<JournalCategory, JournalEntry[]> {
  const result = Object.fromEntries(
    JOURNAL_CATEGORIES.map((c) => [c, [] as JournalEntry[]]),
  ) as Record<JournalCategory, JournalEntry[]>;
  entries
    .filter((e) => state.journal.unlocked.includes(e.id))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .forEach((e) => result[e.category].push(e));
  return result;
}

export function unseenCount(state: GameState): number {
  return state.journal.unlocked.filter((id) => !state.journal.seen.includes(id)).length;
}

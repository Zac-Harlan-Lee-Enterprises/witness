import type { Chapter } from './chapter';
import { trustLabel } from './characters';
import { evaluate } from './conditions';
import type { ContentRecord } from './content-records';
import type { GameState } from './state/game-state';

/**
 * Builds the end-of-chapter summary from concrete facts. It reports what the
 * player did and what followed — it never grades their spirituality, and
 * there is no score, rank or "best ending".
 */
export interface ChapterSummaryView {
  chapterTitle: string;
  recap: string[];
  choices: Array<{ prompt: string; chosen: string; consequence: string }>;
  consequences: string[];
  relationships: Array<{ name: string; role: string; label: string }>;
  itemsRemaining: Array<{ name: string; quantity: number }>;
  discoveries: { clues: number; journalEntries: number; totalJournalEntries: number };
  sideQuests: Array<{ name: string; outcome: string }>;
  themes: Array<{ name: string; description: string }>;
  scripture: ContentRecord[];
  history: ContentRecord[];
  reflectionPrompts: string[];
}

export function buildChapterSummary(chapter: Chapter, state: GameState): ChapterSummaryView {
  const records = new Map(chapter.records.map((r) => [r.id, r]));
  const pick = (ids: readonly string[]): ContentRecord[] =>
    ids.map((id) => records.get(id)).filter((r): r is ContentRecord => r !== undefined);

  const choices = chapter.choices.flatMap((def) => {
    const made = state.choices.find((c) => c.choiceId === def.id);
    const option = made ? def.options.find((o) => o.id === made.optionId) : undefined;
    return option
      ? [{ prompt: def.prompt, chosen: option.label, consequence: option.consequence }]
      : [];
  });

  const relationships = chapter.characters
    .filter((c) => state.metCharacters.includes(c.id) && state.trust[c.id] !== undefined)
    .map((c) => ({ name: c.name, role: c.role, label: trustLabel(state.trust[c.id] ?? 0) }));

  const itemsRemaining = chapter.items
    .filter((i) => (state.inventory[i.id] ?? 0) > 0)
    .map((i) => ({ name: i.name, quantity: state.inventory[i.id] ?? 0 }));

  const sideQuests = chapter.quests
    .filter(
      (q) => q.kind === 'side' && state.quests[q.id] && state.quests[q.id]?.status !== 'inactive',
    )
    .map((q) => {
      const progress = state.quests[q.id];
      const outcome = q.outcomes.find((o) => o.id === progress?.outcomeId);
      return { name: q.name, outcome: outcome?.title ?? 'Still unresolved' };
    });

  const themes = chapter.summary.themes
    .map((id) => chapter.themes.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)
    .map((t) => ({ name: t.name, description: t.description }));

  return {
    chapterTitle: chapter.title,
    recap: chapter.summary.recap.filter((r) => evaluate(r.when, state)).map((r) => r.text),
    choices,
    consequences: chapter.summary.consequences
      .filter((c) => evaluate(c.when, state))
      .map((c) => c.text),
    relationships,
    itemsRemaining,
    discoveries: {
      clues: state.clues.length,
      journalEntries: state.journal.unlocked.length,
      totalJournalEntries: chapter.journal.length,
    },
    sideQuests,
    themes,
    scripture: pick(chapter.summary.scriptureRecordIds),
    history: pick(chapter.summary.historyRecordIds),
    reflectionPrompts: chapter.summary.reflectionPrompts,
  };
}

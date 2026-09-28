import { z } from 'zod';
import { CharacterSchema } from './characters';
import { ConditionSchema } from './conditions';
import { ContentRecordSchema, SourceSchema } from './content-records';
import { EffectSchema } from './effects';
import { DialogueSchema } from './dialogue';
import { ItemSchema } from './inventory';
import { ClueSchema, JournalEntrySchema } from './journal';
import { PuzzleSchema } from './puzzles';
import { QuestSchema } from './quests';
import { FlagValueSchema } from './state/game-state';
import { TeaserSchema } from './teaser';
import { PlayerLookSchema, SceneSchema } from './world';

/**
 * A chapter is a self-contained bundle of content. Adding Chapter 2 means
 * adding another object that satisfies this schema (plus its maps) — no
 * engine code changes. See docs/chapter-authoring-guide.md.
 */
export const ChoiceDefinitionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  /** Virtues/tensions the choice touches — descriptive tags, never scores. */
  themes: z.array(z.string().min(1)).min(1),
  options: z
    .array(
      z.object({ id: z.string().min(1), label: z.string().min(1), consequence: z.string().min(1) }),
    )
    .min(1),
});
export type ChoiceDefinition = z.infer<typeof ChoiceDefinitionSchema>;

export const ThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const SummaryConfigSchema = z.object({
  /** Recap lines; each shown when its condition holds (in order). */
  recap: z.array(z.object({ when: ConditionSchema.optional(), text: z.string().min(1) })).min(1),
  /** Concrete consequences of the player's choices. */
  consequences: z
    .array(z.object({ id: z.string().min(1), when: ConditionSchema, text: z.string().min(1) }))
    .min(1),
  themes: z.array(z.string()).min(1),
  scriptureRecordIds: z.array(z.string()).min(1),
  historyRecordIds: z.array(z.string()).min(1),
  reflectionPrompts: z.array(z.string().min(1)).min(1),
});

export const ScriptureConnectionSchema = z.object({
  title: z.string().min(1),
  intro: z.string().min(1),
  /** Ordered labelled sections (each a ContentRecord). */
  sections: z
    .array(z.object({ heading: z.string().min(1), recordIds: z.array(z.string()).min(1) }))
    .min(1),
  /** Prompts comparing the player's journey with the passage — conditional on what they did. */
  comparisons: z
    .array(z.object({ when: ConditionSchema.optional(), text: z.string().min(1) }))
    .min(1),
});

export const ChapterSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  synopsis: z.string().min(1),
  estimatedMinutes: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  contentVersion: z.string().min(1),
  setting: z.string().min(1),
  start: z.object({ scene: z.string().min(1), spawn: z.string().min(1) }),
  initial: z.object({
    flags: z.record(z.string(), FlagValueSchema).default({}),
    counters: z.record(z.string(), z.number()).default({}),
    inventory: z.record(z.string(), z.number().int().nonnegative()).default({}),
  }),
  /** Effects applied once when a NEW game's first scene has loaded (e.g. the opening conversation). */
  opening: z.array(EffectSchema).default([]),
  /** Item that lights the way after dark (drives the lamp glow in the world). */
  lightItem: z.string().optional(),
  /** Counter shown to the player as time of day (hours, 0–24+). */
  timeCounter: z.string().optional(),
  /** How the story shows on the player (gear carried, a torn hem…). */
  playerLooks: z.array(PlayerLookSchema).default([]),
  mainQuest: z.string().min(1),
  characters: z.array(CharacterSchema),
  items: z.array(ItemSchema),
  scenes: z.array(SceneSchema).min(1),
  dialogues: z.array(DialogueSchema),
  quests: z.array(QuestSchema).min(1),
  clues: z.array(ClueSchema),
  puzzles: z.array(PuzzleSchema),
  journal: z.array(JournalEntrySchema),
  records: z.array(ContentRecordSchema),
  sources: z.array(SourceSchema),
  choices: z.array(ChoiceDefinitionSchema),
  themes: z.array(ThemeSchema),
  scriptureConnection: ScriptureConnectionSchema,
  summary: SummaryConfigSchema,
  /** A short film played before the chapter the first time a profile starts it. */
  teaser: TeaserSchema.optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;
export type ChapterInput = z.input<typeof ChapterSchema>;

/** Lightweight listing entry so the menu can show chapters without loading them. */
export interface ChapterMeta {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  available: boolean;
  estimatedMinutes: { min: number; max: number } | null;
  /** The chapter has a teaser film (chapter select offers to watch it). */
  hasTeaser?: boolean;
}

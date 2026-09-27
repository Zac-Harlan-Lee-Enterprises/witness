import { z } from 'zod';
import { ConditionSchema, evaluate } from './conditions';
import { CONTENT_KINDS } from './content-records';
import { EffectSchema } from './effects';
import type { GameState } from './state/game-state';

/**
 * Branching dialogue as data. The engine (this module + the application
 * DialogueController) knows nothing about any particular chapter.
 *
 * Speaker ids are character ids, or the reserved 'player' / 'narrator'.
 * Text may contain {player} which is replaced with the profile's chosen name.
 *
 * `kind` labels what the line IS (fiction by default). A line that retells
 * Scripture must be kind 'paraphrase' and link a ContentRecord via
 * `recordId`, so the UI can show "Paraphrase of Luke 10:30–35" — fictional
 * dialogue is never presented as Scripture.
 */
export const RESERVED_SPEAKERS = ['player', 'narrator'] as const;

export const DialogueChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  /** Hidden entirely unless true. */
  when: ConditionSchema.optional(),
  /** Shown but disabled (with `unavailableText`) unless true — makes constraints visible. */
  requires: ConditionSchema.optional(),
  unavailableText: z.string().optional(),
  effects: z.array(EffectSchema).default([]),
  next: z.string().optional(),
  /** Hide after it has been picked once (for "ask about…" menus). */
  once: z.boolean().default(false),
});
/** @public Domain-model type (chapter-authoring API). */
export type DialogueChoice = z.infer<typeof DialogueChoiceSchema>;

/**
 * The face a speaker makes while saying a line: presentation only (which
 * portrait is shown), never part of the story's rules. `neutral` is the
 * person at rest. Keep in step with EXPRESSIONS in
 * tools/art/lib/portrait_face.py, which renders them.
 */
export const EXPRESSIONS = [
  'neutral',
  'glad',
  'worried',
  'sad',
  'angry',
  'surprised',
  'afraid',
] as const;
export const ExpressionSchema = z.enum(EXPRESSIONS);
export type Expression = z.infer<typeof ExpressionSchema>;

export const DialogueNodeSchema = z.object({
  id: z.string().min(1),
  speaker: z.string().min(1),
  text: z.string().min(1),
  /** The speaker's face on this line (their portrait); neutral unless the feeling is clear. */
  expression: ExpressionSchema.default('neutral'),
  kind: z.enum(CONTENT_KINDS).default('fiction'),
  recordId: z.string().optional(),
  effects: z.array(EffectSchema).default([]),
  choices: z.array(DialogueChoiceSchema).default([]),
  /** Auto-continue target when there are no choices. Omit + no choices = end. */
  next: z.string().optional(),
  /** Conditional continuation: first matching branch wins, else `next`. */
  branches: z.array(z.object({ when: ConditionSchema, next: z.string().min(1) })).default([]),
});
export type DialogueNode = z.infer<typeof DialogueNodeSchema>;

/** Where "Continue" goes from a node without choices (null = end of conversation). */
export function continuationOf(node: DialogueNode, state: GameState): string | null {
  return node.branches.find((b) => evaluate(b.when, state))?.next ?? node.next ?? null;
}

export const DialogueSchema = z.object({
  id: z.string().min(1),
  /** Default character for portrait / ConversationStarted. */
  characterId: z.string().optional(),
  /** Conditional entry points, first match wins; falls back to `start`. */
  entries: z.array(z.object({ when: ConditionSchema, node: z.string().min(1) })).default([]),
  start: z.string().min(1),
  nodes: z.array(DialogueNodeSchema).min(1),
});
export type Dialogue = z.infer<typeof DialogueSchema>;

export class DialogueError extends Error {}

export function entryNodeId(dialogue: Dialogue, state: GameState): string {
  return dialogue.entries.find((e) => evaluate(e.when, state))?.node ?? dialogue.start;
}

export function findNode(dialogue: Dialogue, nodeId: string): DialogueNode {
  const node = dialogue.nodes.find((n) => n.id === nodeId);
  if (!node) throw new DialogueError(`Dialogue '${dialogue.id}' has no node '${nodeId}'`);
  return node;
}

export interface ChoiceView {
  id: string;
  text: string;
  available: boolean;
  unavailableText: string | null;
}

/** Visible choices for a node, with availability computed from state. */
export function visibleChoices(
  dialogue: Dialogue,
  node: DialogueNode,
  state: GameState,
): ChoiceView[] {
  return node.choices
    .filter((c) => evaluate(c.when, state))
    .filter(
      (c) =>
        !c.once ||
        !state.dialogueLog.some(
          (l) => l.dialogueId === dialogue.id && l.nodeId === node.id && l.choiceId === c.id,
        ),
    )
    .map((c) => {
      const available = evaluate(c.requires, state);
      return {
        id: c.id,
        text: c.text,
        available,
        unavailableText: available ? null : (c.unavailableText ?? 'Not possible right now.'),
      };
    });
}

export function interpolate(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}

/** Every node id a dialogue references, for integrity validation. */
export function danglingNodeRefs(dialogue: Dialogue): string[] {
  const ids = new Set(dialogue.nodes.map((n) => n.id));
  const refs = [
    dialogue.start,
    ...dialogue.entries.map((e) => e.node),
    ...dialogue.nodes.flatMap((n) => [
      n.next,
      ...n.branches.map((b) => b.next),
      ...n.choices.map((c) => c.next),
    ]),
  ].filter((x): x is string => typeof x === 'string');
  return refs.filter((r) => !ids.has(r));
}

import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

/**
 * Tiny authoring helpers so dialogue reads like a script. They only build
 * plain data — every dialogue is still validated by the Zod schema and the
 * integrity checker when the chapter loads.
 */
export type DialogueInput = ChapterInput['dialogues'][number];
export type NodeInput = DialogueInput['nodes'][number];
export type ChoiceInput = NonNullable<NodeInput['choices']>[number];

export const say = (
  id: string,
  speaker: string,
  text: string,
  rest: Partial<NodeInput> = {},
): NodeInput => ({
  id,
  speaker,
  text,
  ...rest,
});

export const opt = (
  id: string,
  text: string,
  next?: string,
  rest: Partial<ChoiceInput> = {},
): ChoiceInput => ({
  id,
  text,
  ...(next === undefined ? {} : { next }),
  ...rest,
});

export const flag = (name: string): Condition => ({ type: 'flag', flag: name });
export const has = (item: string, min?: number): Condition =>
  min === undefined ? { type: 'hasItem', item } : { type: 'hasItem', item, min };
export const chose = (choice: string, option?: string): Condition =>
  option === undefined ? { type: 'choiceMade', choice } : { type: 'choiceMade', choice, option };
export const not = (condition: Condition): Condition => ({ type: 'not', condition });
export const all = (...of: Condition[]): Condition => ({ type: 'all', of });
export const any = (...of: Condition[]): Condition => ({ type: 'any', of });
export const met = (character: string): Condition => ({ type: 'met', character });
export const solved = (puzzle: string): Condition => ({ type: 'puzzleSolved', puzzle });

import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

/**
 * Authoring helpers so dialogue reads like a script (the same shape as
 * Chapter 1's). They only build plain data — every dialogue is validated by
 * the Zod schema and the integrity checker when the chapter loads.
 */
export type DialogueInput = ChapterInput['dialogues'][number];
export type NodeInput = DialogueInput['nodes'][number];
export type ChoiceInput = NonNullable<NodeInput['choices']>[number];

export const say = (
  id: string,
  speaker: string,
  text: string,
  rest: Partial<NodeInput> = {},
): NodeInput => ({ id, speaker, text, ...rest });

export const opt = (
  id: string,
  text: string,
  next?: string,
  rest: Partial<ChoiceInput> = {},
): ChoiceInput => ({ id, text, ...(next === undefined ? {} : { next }), ...rest });

export const flag = (name: string): Condition => ({ type: 'flag', flag: name });
export const has = (item: string, min?: number): Condition =>
  min === undefined ? { type: 'hasItem', item } : { type: 'hasItem', item, min };
export const chose = (choice: string, option?: string): Condition =>
  option === undefined ? { type: 'choiceMade', choice } : { type: 'choiceMade', choice, option };
export const not = (condition: Condition): Condition => ({ type: 'not', condition });
export const all = (...of: Condition[]): Condition => ({ type: 'all', of });
export const any = (...of: Condition[]): Condition => ({ type: 'any', of });
export const solved = (puzzle: string): Condition => ({ type: 'puzzleSolved', puzzle });
export const talked = (dialogue: string): Condition => ({ type: 'conversationDone', dialogue });

/** Ami is in your boat: you made room on the shore, or took his family aboard in the storm. */
export const AMI_WITH_YOU: Condition = any(
  chose('choice-ami', 'room'),
  chose('choice-ami', 'made-room'),
  chose('choice-storm', 'take-aboard'),
);

/** A load heavy enough that taking people aboard means throwing jars overboard. */
export const HEAVY: Condition = has('fish-jar', 5);

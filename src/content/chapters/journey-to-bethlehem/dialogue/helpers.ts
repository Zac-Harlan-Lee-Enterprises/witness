import type { ChapterInput } from '@/domain/chapter';
import type { Condition } from '@/domain/conditions';

/**
 * Small authoring helpers so dialogue reads like a script. They only build
 * plain data — every dialogue is still validated by the Zod schema and the
 * integrity checker when the chapter loads.
 */
export type DialogueInput = ChapterInput['dialogues'][number];
type NodeInput = DialogueInput['nodes'][number];
type ChoiceInput = NonNullable<NodeInput['choices']>[number];

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
export const has = (item: string): Condition => ({ type: 'hasItem', item });
export const chose = (choice: string, option?: string): Condition =>
  option === undefined ? { type: 'choiceMade', choice } : { type: 'choiceMade', choice, option };
export const not = (condition: Condition): Condition => ({ type: 'not', condition });
export const all = (...of: Condition[]): Condition => ({ type: 'all', of });
export const solved = (puzzle: string): Condition => ({ type: 'puzzleSolved', puzzle });
export const clue = (id: string): Condition => ({ type: 'clueFound', clue: id });
export const questActive: (quest: string) => Condition = (quest) => ({
  type: 'questStatus',
  quest,
  status: 'active',
});

/** Paraphrase lines retell Scripture in our words and always link their record. */
export const paraphrase = (
  recordId: string,
  rest: Partial<NodeInput> = {},
): Partial<NodeInput> => ({
  kind: 'paraphrase',
  recordId,
  ...rest,
});

/** Choices that set a flag. */
export const setFlag = (name: string) => ({ type: 'setFlag' as const, flag: name, value: true });

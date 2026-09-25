import type { VirtualInput } from '@/application/input';
import type { InputAction } from '@/domain/settings';

/**
 * Keyboard → VirtualInput, using remappable bindings (KeyboardEvent.code).
 * Keys typed into text fields are ignored, and keys are ignored while a
 * modal dialog/overlay owns focus (those use native button semantics).
 */
const MOVEMENT: ReadonlySet<InputAction> = new Set(['up', 'down', 'left', 'right']);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function attachKeyboard(
  input: VirtualInput,
  bindings: () => Readonly<Record<InputAction, string[]>>,
  isWorldFocused: () => boolean,
  target: Window = window,
): () => void {
  const lookup = (code: string): InputAction | null => {
    for (const [action, codes] of Object.entries(bindings()) as Array<[InputAction, string[]]>) {
      if (codes.includes(code)) return action;
    }
    return null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (isTypingTarget(event.target)) return;
    const action = lookup(event.code);
    if (!action) return;
    const worldFocused = isWorldFocused();
    // Only movement/interact keys belong to the world; menus keep native keys.
    if ((MOVEMENT.has(action) || action === 'interact') && !worldFocused) return;
    if (worldFocused && (MOVEMENT.has(action) || action === 'interact')) event.preventDefault();
    if (event.repeat && !MOVEMENT.has(action)) return;
    input.press('keyboard', action);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const action = lookup(event.code);
    if (action) input.release('keyboard', action);
  };
  const onBlur = (): void => input.releaseAll('keyboard');

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
    input.releaseAll('keyboard');
  };
}

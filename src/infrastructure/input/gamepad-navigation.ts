import type { VirtualInput } from '@/application/input';
import type { InputAction } from '@/domain/settings';

/**
 * Gamepad control of the HTML interface (menus, dialogue, puzzles, overlays).
 * While the world isn't taking movement, gamepad directions move focus
 * through the buttons of the top-most dialog (or the page), A presses the
 * focused control, and B/Start goes back (Escape) outside the game screen.
 * Keyboard users keep native Tab/Enter/Escape; this only reacts to the
 * 'gamepad' source.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isShown(el: HTMLElement): boolean {
  return !el.closest('[hidden], [inert], [aria-hidden="true"]');
}

/** The container that currently owns interaction: the last open dialog, else the page. */
export function activeScope(doc: Document): HTMLElement {
  const dialogs = [
    ...doc.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
  ].filter(isShown);
  return dialogs[dialogs.length - 1] ?? doc.body;
}

export function focusables(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isShown);
}

/** Move focus to the next (+1) or previous (−1) control, wrapping around. */
export function moveFocus(doc: Document, step: 1 | -1): void {
  const items = focusables(activeScope(doc));
  if (items.length === 0) return;
  const index = items.indexOf(doc.activeElement as HTMLElement);
  const next =
    index === -1
      ? step === 1
        ? items[0]
        : items[items.length - 1]
      : items[(index + step + items.length) % items.length];
  next?.focus();
}

/** Step a <select> to its next/previous option and notify React. */
function stepSelect(select: HTMLSelectElement, step: 1 | -1): void {
  const index = Math.max(0, Math.min(select.options.length - 1, select.selectedIndex + step));
  if (index === select.selectedIndex) return;
  select.selectedIndex = index;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function activateFocused(doc: Document): void {
  const scope = activeScope(doc);
  const el = doc.activeElement;
  if (el instanceof HTMLElement && el !== doc.body && scope.contains(el)) {
    el.click();
    return;
  }
  focusables(scope)[0]?.focus();
}

function back(doc: Document): void {
  const scope = activeScope(doc);
  const target =
    doc.activeElement instanceof HTMLElement && scope.contains(doc.activeElement)
      ? doc.activeElement
      : scope;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

export function attachGamepadNavigation(
  input: VirtualInput,
  /** True while the world is taking movement (exploring); UI navigation pauses then. */
  worldActive: () => boolean,
  /** True on the in-game screen, where the game itself handles pause/back. */
  inGame: () => boolean,
  doc: Document = document,
): () => void {
  return input.onAction((action: InputAction, source: string) => {
    if (source !== 'gamepad' || worldActive()) return;
    // In the game, only drive an open dialog or overlay. (The press that opens a
    // conversation must not also "click" whatever HUD button last had focus.)
    if (inGame() && activeScope(doc) === doc.body) return;
    const focused = doc.activeElement;
    switch (action) {
      case 'up':
        moveFocus(doc, -1);
        break;
      case 'down':
        moveFocus(doc, 1);
        break;
      case 'left':
      case 'right':
        if (focused instanceof HTMLSelectElement) stepSelect(focused, action === 'right' ? 1 : -1);
        else moveFocus(doc, action === 'right' ? 1 : -1);
        break;
      case 'interact':
        activateFocused(doc);
        break;
      case 'pause':
        if (!inGame()) back(doc);
        break;
      default:
        break;
    }
  });
}

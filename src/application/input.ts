import type { InputAction } from '@/domain/settings';

/**
 * Device-independent input. Keyboard, gamepad, on-screen touch controls and
 * tests all "press" and "release" abstract actions here; the Phaser world
 * reads held directions and the app listens for edge-triggered actions.
 * Nothing else needs to know which device the player is using.
 */
export type ActionListener = (action: InputAction) => void;

export class VirtualInput {
  private readonly held = new Map<string, Set<InputAction>>();
  private readonly listeners = new Set<ActionListener>();

  press(source: string, action: InputAction): void {
    const set = this.held.get(source) ?? new Set<InputAction>();
    const wasActive = this.isActive(action);
    set.add(action);
    this.held.set(source, set);
    if (!wasActive) this.listeners.forEach((l) => l(action));
  }

  release(source: string, action: InputAction): void {
    this.held.get(source)?.delete(action);
  }

  releaseAll(source?: string): void {
    if (source === undefined) this.held.clear();
    else this.held.delete(source);
  }

  /** Fire an edge action without holding it (taps, clicks). */
  trigger(action: InputAction): void {
    this.listeners.forEach((l) => l(action));
  }

  isActive(action: InputAction): boolean {
    for (const set of this.held.values()) if (set.has(action)) return true;
    return false;
  }

  /** Normalised movement vector from held directions (−1…1 per axis). */
  direction(): { dx: number; dy: number } {
    const dx = (this.isActive('right') ? 1 : 0) - (this.isActive('left') ? 1 : 0);
    const dy = (this.isActive('down') ? 1 : 0) - (this.isActive('up') ? 1 : 0);
    return { dx, dy };
  }

  onAction(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

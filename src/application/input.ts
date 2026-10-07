import type { InputAction } from '@/domain/settings';

/**
 * Device-independent input. Keyboard, gamepad, on-screen touch controls and
 * tests all "press" and "release" abstract actions here; the Phaser world
 * reads held directions and the app listens for edge-triggered actions.
 * Nothing else needs to know which device the player is using.
 */
/** `source` names the device ('keyboard', 'gamepad', 'touch'…) for the few listeners that care. */
export type ActionListener = (action: InputAction, source: string) => void;

export interface Point {
  x: number;
  y: number;
}

export class VirtualInput {
  private readonly held = new Map<string, Set<InputAction>>();
  /** Analogue movement per source (an on-screen stick), each at most 1 long. */
  private readonly axes = new Map<string, Point>();
  private readonly listeners = new Set<ActionListener>();

  press(source: string, action: InputAction): void {
    const set = this.held.get(source) ?? new Set<InputAction>();
    const wasActive = this.isActive(action);
    set.add(action);
    this.held.set(source, set);
    if (!wasActive) this.listeners.forEach((l) => l(action, source));
  }

  release(source: string, action: InputAction): void {
    this.held.get(source)?.delete(action);
  }

  /**
   * An analogue direction from `source` (a stick): `x` right, `y` down, each
   * −1…1. Its length is the pace asked for, so a barely tilted stick walks
   * slowly. (0, 0) lets go.
   */
  setAxis(source: string, x: number, y: number): void {
    if (x === 0 && y === 0) this.axes.delete(source);
    else this.axes.set(source, { x, y });
  }

  releaseAll(source?: string): void {
    if (source === undefined) {
      this.held.clear();
      this.axes.clear();
    } else {
      this.held.delete(source);
      this.axes.delete(source);
    }
  }

  isActive(action: InputAction): boolean {
    for (const set of this.held.values()) if (set.has(action)) return true;
    return false;
  }

  /**
   * Movement vector from held directions and sticks, at most 1 long. Its
   * length is the pace: full for keys and d-pads, a stick's tilt otherwise.
   */
  direction(): { dx: number; dy: number } {
    let dx = (this.isActive('right') ? 1 : 0) - (this.isActive('left') ? 1 : 0);
    let dy = (this.isActive('down') ? 1 : 0) - (this.isActive('up') ? 1 : 0);
    for (const axis of this.axes.values()) {
      dx += axis.x;
      dy += axis.y;
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy };
  }

  onAction(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export interface StickState {
  /** Where the stick's base sits now (it follows a thumb that goes past the rim). */
  base: Point;
  /** Where the knob is drawn: within `radius` of the base. */
  knob: Point;
  /** The direction asked for, at most 1 long (0 inside the dead zone). */
  x: number;
  y: number;
}

/**
 * A floating on-screen stick: where the knob and base go for a thumb at
 * `point`, and the direction that means.
 *
 * - Within `deadZone` pixels of the base nothing happens (a tap is not a step).
 * - From there the pace rises to full at the rim, `radius` pixels out.
 * - Past the rim the base is dragged along behind the thumb, so a long swipe
 *   never runs out of stick and the knob always points where the thumb went.
 */
export function stickDeflection(
  base: Point,
  point: Point,
  radius: number,
  deadZone: number,
): StickState {
  let ox = point.x - base.x;
  let oy = point.y - base.y;
  const len = Math.hypot(ox, oy);
  let at = base;
  if (len > radius) {
    const over = len - radius;
    at = { x: base.x + (ox / len) * over, y: base.y + (oy / len) * over };
    ox = (ox / len) * radius;
    oy = (oy / len) * radius;
  }
  const d = Math.min(len, radius);
  const pace = d <= deadZone ? 0 : (d - deadZone) / (radius - deadZone);
  return {
    base: at,
    knob: { x: at.x + ox, y: at.y + oy },
    x: pace === 0 ? 0 : (ox / d) * pace,
    y: pace === 0 ? 0 : (oy / d) * pace,
  };
}

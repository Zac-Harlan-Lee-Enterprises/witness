import { useEffect, useRef, useState } from 'react';
import { stickDeflection, type Point, type StickState } from '@/application/input';
import { useServices } from '../common/services';
import type { GameRuntimeLike } from '../game/types';

/** How far the knob travels from the base (CSS px); full pace at the rim. */
export const STICK_RADIUS = 56;
/** Movement under this (CSS px) is not a step, and a touch that stays within it is a tap. */
export const STICK_DEAD_ZONE = 10;
/** A touch let go within this many ms, without steering, is a tap. */
export const TAP_MS = 350;

interface Touch {
  pointerId: number;
  base: Point;
  startedAt: number;
  /** Once the thumb has left the dead zone it is steering, not tapping. */
  steered: boolean;
}

/**
 * The floating stick for touch screens. Put a thumb down anywhere on the
 * world and a stick appears under it; drag to walk in that direction, as far
 * as the tilt asks; let go to stop. A tap that never steers walks to the spot
 * (or the person, object or exit) tapped, as a tap on the canvas does with a
 * mouse. One thumb steers; a second touch is left for the ✋ button.
 *
 * The stick is pointer-only: it is hidden from assistive technology, and the
 * "Go to…" list and the ✋ button are the no-gesture route (WCAG 2.5.1).
 */
export function Joystick({ runtime }: { runtime: GameRuntimeLike }) {
  const { input } = useServices();
  const [stick, setStick] = useState<StickState | null>(null);
  const touch = useRef<Touch | null>(null);
  useEffect(() => () => input.setAxis('touch', 0, 0), [input]);

  const letGo = (): Touch | null => {
    const held = touch.current;
    touch.current = null;
    input.setAxis('touch', 0, 0);
    setStick(null);
    return held;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (touch.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const base = { x: e.clientX, y: e.clientY };
    touch.current = { pointerId: e.pointerId, base, startedAt: e.timeStamp, steered: false };
    setStick({ base, knob: base, x: 0, y: 0 });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = touch.current;
    if (!held || e.pointerId !== held.pointerId) return;
    const next = stickDeflection(
      held.base,
      { x: e.clientX, y: e.clientY },
      STICK_RADIUS,
      STICK_DEAD_ZONE,
    );
    held.base = next.base;
    if (next.x !== 0 || next.y !== 0) held.steered = true;
    input.setAxis('touch', next.x, next.y);
    setStick(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== touch.current?.pointerId) return;
    const held = letGo();
    if (held && !held.steered && e.timeStamp - held.startedAt < TAP_MS)
      runtime.controller.pointAt(e.pageX, e.pageY);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === touch.current?.pointerId) letGo();
  };

  return (
    <div
      className="joystick"
      data-active={stick ? 'true' : 'false'}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
    >
      {stick ? (
        <div
          className="joystick__base"
          style={{ left: stick.base.x, top: stick.base.y, width: STICK_RADIUS * 2 }}
        >
          <div
            className="joystick__knob"
            style={{
              transform: `translate(${stick.knob.x - stick.base.x}px, ${stick.knob.y - stick.base.y}px)`,
            }}
          />
        </div>
      ) : (
        <div className="joystick__rest" style={{ width: STICK_RADIUS * 2 }}>
          <div className="joystick__knob" />
          <span className="joystick__hint">drag to walk</span>
        </div>
      )}
    </div>
  );
}

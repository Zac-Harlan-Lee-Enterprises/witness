/**
 * Birds overhead. Their sprites (and the shadows they cast) are drawn
 * nose-up, wings spread left and right, so a bird must be turned to face the
 * way it travels: moved sideways unturned, it flew wingtip first.
 */

/** Rotation (radians) that turns a sprite drawn nose-up to face a direction of travel. */
export function headingRotation(dx: number, dy: number): number {
  return Math.atan2(dy, dx) + Math.PI / 2;
}

export interface Glide {
  from: { x: number; y: number };
  to: { x: number; y: number };
  rotation: number;
}

/**
 * A hawk's shadow gliding across the view: from beyond one side to beyond
 * the other, drifting a little down, head first. `t` (0–1) sets the height
 * it crosses at.
 */
export function hawkGlide(
  view: { x: number; y: number; width: number; height: number },
  fromLeft: boolean,
  t: number,
): Glide {
  const y = view.y + view.height * (0.2 + t * 0.4);
  const left = view.x - 40;
  const right = view.x + view.width + 60;
  const from = { x: fromLeft ? left : right, y };
  const to = { x: fromLeft ? right : left, y: y + view.height * 0.3 };
  return { from, to, rotation: headingRotation(to.x - from.x, to.y - from.y) };
}

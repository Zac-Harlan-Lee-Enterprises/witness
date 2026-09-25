/**
 * Camera direction, as pure functions (Phaser-free, unit-tested):
 *
 * - Framing: close enough that faces and objects read, far enough to see
 *   where you're going. Fewer, larger tiles on phones and portrait screens.
 * - Look-ahead: while walking, the view eases a little ahead of you so you
 *   see what you're walking into; it settles back when you stop.
 * - Conversations: the view settles between you and the person you're
 *   talking to, lifted so both stay visible above the dialogue box.
 */
export const TILE_UNITS = 32;

export function zoomFor(width: number, height: number): number {
  const portrait = height > width;
  const tilesAcross = width < 640 ? 8.5 : portrait ? 11 : 15;
  const tilesDown = height < 640 ? 8.5 : 10;
  const zoom = Math.min(width / (tilesAcross * TILE_UNITS), height / (tilesDown * TILE_UNITS));
  return Math.max(1, Math.min(3.25, Math.round(zoom * 4) / 4));
}

export interface Vec {
  x: number;
  y: number;
}

/** How far ahead to look while walking, in world units. */
export const LOOK_AHEAD = TILE_UNITS * 1.4;

/**
 * Ease the look-ahead offset toward the walking direction (or back to zero).
 * `dir` is a normalised movement direction or {0,0} when standing still.
 */
export function stepLookAhead(offset: Vec, dir: Vec, dtSeconds: number): Vec {
  const moving = dir.x !== 0 || dir.y !== 0;
  const target = moving ? { x: dir.x * LOOK_AHEAD, y: dir.y * LOOK_AHEAD * 0.75 } : { x: 0, y: 0 };
  // Slow to lean out, a little quicker to settle back.
  const rate = moving ? 1.6 : 2.4;
  const k = 1 - Math.exp(-dtSeconds * rate);
  return { x: offset.x + (target.x - offset.x) * k, y: offset.y + (target.y - offset.y) * k };
}

/**
 * Where the camera should centre during a conversation: between the two
 * people (weighted to the player), pushed down so they sit in the part of
 * the screen the dialogue box doesn't cover.
 */
export function conversationCentre(
  player: Vec,
  partner: Vec | null,
  viewHeight: number,
  boxFraction: number,
): Vec {
  const mid = partner
    ? { x: player.x * 0.55 + partner.x * 0.45, y: player.y * 0.55 + partner.y * 0.45 }
    : { x: player.x, y: player.y };
  return { x: mid.x, y: mid.y + viewHeight * boxFraction * 0.5 };
}

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

/**
 * "standard" shows about 15 tiles across a landscape screen; "close" brings
 * people and materials forward (about 11 across), still leaving room above
 * the dialogue box and keeping the next few steps in view.
 */
export type Framing = 'standard' | 'close';

const FRAMES: Record<
  Framing,
  { across: number; portrait: number; phone: number; down: number; phoneDown: number }
> = {
  standard: { across: 15, portrait: 11, phone: 8.5, down: 10, phoneDown: 8.5 },
  close: { across: 11.5, portrait: 9, phone: 7.5, down: 7.6, phoneDown: 7.5 },
};

/**
 * The framing for a place: the close framing only where the art has the
 * resolution for it (pixels per world unit ≥ the close zoom); painted places,
 * at 2 px per unit, would blur, so they keep the standard framing.
 */
export function framingFor(wanted: Framing, artPpu: number): Framing {
  return wanted === 'close' && artPpu >= 3 ? 'close' : 'standard';
}

export function zoomFor(width: number, height: number, framing: Framing = 'standard'): number {
  const f = FRAMES[framing];
  const portrait = height > width;
  const tilesAcross = width < 640 ? f.phone : portrait ? f.portrait : f.across;
  const tilesDown = height < 640 ? f.phoneDown : f.down;
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

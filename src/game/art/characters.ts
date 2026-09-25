import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import { ART_SCALE, ellipse, makeCanvas, mix, rgba, shade, softShadow, type Ctx } from './paint';

/**
 * Procedural people. Proportions favour readability at play size: a large
 * head (about a third of the figure) with clear eyes, a simple robe shape,
 * a head covering and — for most people — something they carry that says
 * who they are (a shepherd's staff, an oil jar, a tray of bread, a spindle).
 *
 * Standing sheet: 4 directions × 5 frames — stand, step A, step B, blink,
 * talk. Pose sheets ("sit", "lie") have 2 frames — rest and talk.
 * The same Appearance drives the React portrait, so people look the same in
 * the world and in conversation. Dress is first-century-inspired and
 * stylised: a belted tunic with two coloured stripes, sandals, a cloak or
 * head covering for many.
 */
export const CHAR_W = 32;
export const CHAR_H = 48;
export const DIRECTION_ROWS: Direction[] = ['down', 'left', 'right', 'up'];
export const FRAMES_PER_DIRECTION = 5;
export const FRAME = { stand: 0, stepA: 1, stepB: 2, blink: 3, talk: 4 } as const;

/** Sitting and lying figures need a wider frame. */
export const POSE_W = 48;
export const POSE_H = 48;
export const POSE_FRAMES = 2;
export type Pose = 'sit' | 'lie';

export function frameName(direction: Direction, frame: number): string {
  return `${direction}-${frame}`;
}

export function appearanceKey(a: Appearance): string {
  return `char3-${[
    a.skin,
    a.hair,
    a.robe,
    a.accent,
    a.headwear,
    a.headwearColor,
    a.beard ? 1 : 0,
    a.build,
    a.carry,
  ]
    .join('-')
    .replace(/#/g, '')}`;
}

export function poseKey(a: Appearance, pose: Pose): string {
  return `${appearanceKey(a)}-${pose}`;
}

interface FigureState {
  dir: Direction;
  /** −1, 0 or 1: which foot is forward. */
  step: number;
  blink: boolean;
  talk: boolean;
  /** Draw the carried item (not when sitting or lying). */
  carry: boolean;
}

const outlineFor = (a: Appearance): string => mix('#24130a', a.robe, 0.12);
const SANDAL = '#5b3d22';
const WOOD = '#7a5836';

// ── Body parts ───────────────────────────────────────────────────────────
function paintHead(ctx: Ctx, a: Appearance, s: FigureState, hx: number, hy: number): void {
  const side = s.dir === 'left' || s.dir === 'right';
  const flip = s.dir === 'left' ? -1 : 1;
  const back = s.dir === 'up';
  const elder = a.build === 'elder';
  const hairColor = elder ? '#dcd5c8' : a.hair;
  const rx = 7.6;
  const ry = 8;

  const skin = ctx.createRadialGradient(hx - 2.5, hy - 2.5, 1, hx, hy, 9);
  skin.addColorStop(0, shade(a.skin, 0.14));
  skin.addColorStop(1, shade(a.skin, -0.12));
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(hx, hy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (side) ellipse(ctx, hx - flip * 2, hy + 0.8, 1.6, 2.2, shade(a.skin, -0.14)); // ear

  const covered = a.headwear === 'scarf' || a.headwear === 'veil' || a.headwear === 'hood';
  if (!covered) {
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    if (back) ctx.ellipse(hx, hy - 0.4, rx + 0.4, ry - 0.2, 0, 0, Math.PI * 2);
    else if (side) ctx.ellipse(hx - flip * 2.2, hy - 2.8, 6.6, 5.6, 0, 0, Math.PI * 2);
    else ctx.ellipse(hx, hy - 3.4, rx + 0.3, 5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (!back)
      for (let i = -2; i <= 2; i++)
        ellipse(ctx, hx + i * 2.8, hy - 7, 1.7, 1.4, shade(hairColor, 0.12));
  }

  if (!back) {
    // Face: large, clear eyes; brows; a small mouth that opens when talking.
    const eyeY = hy + 0.2;
    const brow = shade(hairColor, -0.25);
    const eye = (ex: number): void => {
      if (s.blink) {
        ctx.strokeStyle = '#2a1a10';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(ex - 1.3, eyeY + 0.2);
        ctx.quadraticCurveTo(ex, eyeY + 1, ex + 1.3, eyeY + 0.2);
        ctx.stroke();
        return;
      }
      ellipse(ctx, ex, eyeY, 1.35, 1.65, '#fdf6ea');
      ellipse(ctx, ex + (side ? flip * 0.35 : 0), eyeY + 0.15, 1, 1.3, '#2a1a10');
      ellipse(ctx, ex + 0.35, eyeY - 0.45, 0.38, 0.38, rgba('#ffffff', 0.95));
    };
    ctx.strokeStyle = brow;
    ctx.lineWidth = 0.9;
    if (side) {
      eye(hx + flip * 3.1);
      ctx.beginPath();
      ctx.moveTo(hx + flip * 1.8, eyeY - 2.5);
      ctx.lineTo(hx + flip * 4.4, eyeY - 2.8);
      ctx.stroke();
      ellipse(ctx, hx + flip * 7, hy + 1.4, 1.2, 1.4, shade(a.skin, -0.06)); // nose
      if (s.talk) ellipse(ctx, hx + flip * 4.6, hy + 4.4, 1.1, 0.9, '#5a2416');
      else {
        ctx.strokeStyle = rgba('#5a2c1a', 0.85);
        ctx.beginPath();
        ctx.moveTo(hx + flip * 3.8, hy + 4.2);
        ctx.lineTo(hx + flip * 5.4, hy + 4.1);
        ctx.stroke();
      }
    } else {
      eye(hx - 2.9);
      eye(hx + 2.9);
      ctx.beginPath();
      ctx.moveTo(hx - 4.2, eyeY - 2.4);
      ctx.lineTo(hx - 1.7, eyeY - 2.8);
      ctx.moveTo(hx + 1.7, eyeY - 2.8);
      ctx.lineTo(hx + 4.2, eyeY - 2.4);
      ctx.stroke();
      ellipse(ctx, hx - 4.4, hy + 2.6, 1.5, 0.9, rgba('#d0674f', 0.25));
      ellipse(ctx, hx + 4.4, hy + 2.6, 1.5, 0.9, rgba('#d0674f', 0.25));
      if (s.talk) ellipse(ctx, hx, hy + 4.2, 1.4, 1.1, '#5a2416');
      else {
        ctx.strokeStyle = rgba('#5a2c1a', 0.85);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(hx - 1.4, hy + 3.9);
        ctx.quadraticCurveTo(hx, hy + 4.7, hx + 1.4, hy + 3.9);
        ctx.stroke();
      }
    }
    if (a.beard) {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      if (side) ctx.ellipse(hx + flip * 1.6, hy + 5, 4.6, 3.8, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(hx - 6.8, hy + 0.8);
        ctx.quadraticCurveTo(hx - 6, hy + 9, hx, hy + 9.8);
        ctx.quadraticCurveTo(hx + 6, hy + 9, hx + 6.8, hy + 0.8);
        ctx.quadraticCurveTo(hx + 3, hy + 3.4, hx + 2, hy + 3.4);
        ctx.lineTo(hx + 2, hy + 5.6);
        ctx.lineTo(hx - 2, hy + 5.6);
        ctx.lineTo(hx - 2, hy + 3.4);
        ctx.quadraticCurveTo(hx - 3, hy + 3.4, hx - 6.8, hy + 0.8);
      }
      ctx.fill();
      if (s.talk && !side) ellipse(ctx, hx, hy + 4.6, 1.4, 1, '#3a1a0e');
    }
  }

  // Head coverings.
  const hw = a.headwear === 'hood' ? shade(a.robe, 0.06) : a.headwearColor;
  switch (a.headwear) {
    case 'scarf':
    case 'veil':
    case 'hood': {
      const drape = a.headwear === 'veil' ? 22 : 12;
      const cloth = ctx.createLinearGradient(hx - 9, hy - 9, hx + 9, hy + drape);
      cloth.addColorStop(0, shade(hw, 0.14));
      cloth.addColorStop(1, shade(hw, -0.2));
      ctx.fillStyle = cloth;
      ctx.beginPath();
      if (back) {
        ctx.moveTo(hx - 8.6, hy);
        ctx.quadraticCurveTo(hx, hy - 13, hx + 8.6, hy);
        ctx.lineTo(hx + 10, hy + drape);
        ctx.quadraticCurveTo(hx, hy + drape + 2, hx - 10, hy + drape);
      } else if (side) {
        ctx.moveTo(hx + flip * 6.6, hy - 3.4);
        ctx.quadraticCurveTo(hx, hy - 13, hx - flip * 8.4, hy - 1);
        ctx.lineTo(hx - flip * 9.4, hy + drape);
        ctx.lineTo(hx - flip * 3, hy + drape - 1);
        ctx.lineTo(hx - flip * 3.4, hy + 1);
        ctx.quadraticCurveTo(hx + flip * 1.2, hy - 6, hx + flip * 6.6, hy - 3.4);
      } else {
        ctx.moveTo(hx - 8.6, hy + 1);
        ctx.quadraticCurveTo(hx, hy - 14, hx + 8.6, hy + 1);
        ctx.lineTo(hx + 9.6, hy + drape);
        ctx.lineTo(hx + 6, hy + drape);
        ctx.lineTo(hx + 6, hy + 1.6);
        ctx.quadraticCurveTo(hx, hy - 7.6, hx - 6, hy + 1.6);
        ctx.lineTo(hx - 6, hy + drape);
        ctx.lineTo(hx - 9.6, hy + drape);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(shade(hw, -0.4), 0.45);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy - 7);
      ctx.quadraticCurveTo(hx, hy - 9.4, hx + 5, hy - 7);
      ctx.stroke();
      break;
    }
    case 'wrap': {
      ctx.fillStyle = hw;
      ctx.beginPath();
      ctx.ellipse(hx, hy - 5, 8.6, 5.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(shade(hw, -0.35), 0.7);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(
          hx,
          hy - 6.4 + i * 1.8,
          7.8 - i * 0.4,
          2.5,
          0.15 * (i - 1),
          Math.PI * 0.05,
          Math.PI * 0.95,
        );
        ctx.stroke();
      }
      ellipse(ctx, hx - 2.4, hy - 7.6, 3, 1.2, rgba('#ffffff', 0.3));
      break;
    }
    case 'band':
      ctx.fillStyle = hw;
      ctx.fillRect(hx - 7.8, hy - 5.2, 15.6, 2.6);
      if (back) ctx.fillRect(hx + 1, hy - 3.4, 1.6, 7);
      break;
    case 'none':
      break;
  }
}

/** Items carried in the hands or on the shoulder, drawn after the body. */
function paintCarry(
  ctx: Ctx,
  a: Appearance,
  s: FigureState,
  shoulderY: number,
  handY: number,
  step: number,
): void {
  const side = s.dir === 'left' || s.dir === 'right';
  const flip = s.dir === 'left' ? -1 : 1;
  const back = s.dir === 'up';
  const handX = side ? flip * 4 : 9.5;
  switch (a.carry) {
    case 'staff': {
      const sx = side ? flip * 7.5 : 12;
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx, -0.5);
      ctx.lineTo(sx + (side ? flip * 0.8 : 0.6), shoulderY - 15);
      ctx.stroke();
      ctx.strokeStyle = shade(WOOD, 0.2);
      ctx.beginPath();
      ctx.arc(sx + (side ? flip * 2.8 : 3.2), shoulderY - 15, 2.8, Math.PI, 2 * Math.PI);
      ctx.stroke();
      return;
    }
    case 'jar': {
      // A jar carried on the shoulder.
      if (back) return;
      const jx = side ? -flip * 3 : -7.5;
      const jy = shoulderY - 4;
      ellipse(ctx, jx, jy, 4.6, 6, '#b8683e');
      ellipse(ctx, jx - 1.4, jy - 1.6, 1.4, 2.6, rgba('#ffffff', 0.25));
      ellipse(ctx, jx, jy - 6.4, 2.2, 1.2, '#8c4f2e');
      return;
    }
    case 'bread': {
      // A tray of flat loaves held in front.
      if (back) return;
      const tx = side ? flip * 6 : 0;
      ellipse(ctx, tx, handY - 1, 8, 3, '#8a623c');
      for (let i = -1; i <= 1; i++) ellipse(ctx, tx + i * 4.4, handY - 2.2, 2.8, 1.6, '#e0b070');
      return;
    }
    case 'basket': {
      const bx = side ? flip * 6.5 : 9;
      const by = handY + 2;
      ellipse(ctx, bx, by, 5, 3.6, '#b8904e');
      ctx.strokeStyle = rgba('#7a5a2c', 0.8);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.ellipse(bx, by, 4.6, 1.2, 0, 0, Math.PI);
      ctx.stroke();
      ellipse(ctx, bx, by - 2.6, 4.4, 1.6, '#6f8a3a');
      ctx.strokeStyle = '#8a6a34';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(bx, by - 2, 4, Math.PI, 2 * Math.PI);
      ctx.stroke();
      return;
    }
    case 'bundle': {
      // A travelling bundle slung on the back (a strap across the chest from the front).
      if (!back && !side) {
        ctx.strokeStyle = shade(a.accent, -0.3);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-6, shoulderY + 1);
        ctx.lineTo(6, shoulderY + 12);
        ctx.stroke();
        return;
      }
      const bx = back ? 0 : -flip * 6;
      const by = shoulderY + 6;
      ellipse(ctx, bx, by, 6.5, 6, '#a88a5c');
      ellipse(ctx, bx - 1.5, by - 1.5, 2.4, 2.4, rgba('#ffffff', 0.2));
      return;
    }
    case 'spindle': {
      // A drop spindle turning below the hand.
      const sx = handX;
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(sx, handY);
      ctx.lineTo(sx + 0.5, handY + 6);
      ctx.stroke();
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 0.5, handY + 5);
      ctx.lineTo(sx + 0.5, handY + 11);
      ctx.stroke();
      ellipse(ctx, sx + 0.5, handY + 9.5, 2.2, 1, '#8a623c');
      return;
    }
    case 'satchel': {
      // The traveller's satchel: a strap across the chest, the bag at the hip.
      const bagX = back ? -6 : side ? -flip * 5 : -7.5;
      if (!back) {
        ctx.strokeStyle = '#6b4a2a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(side ? flip * 3 : 6, shoulderY + 1);
        ctx.lineTo(bagX, shoulderY + 12);
        ctx.stroke();
      }
      ctx.fillStyle = '#8f6a40';
      ctx.fillRect(bagX - 3.6, shoulderY + 11 + step * 0.3, 7.2, 6);
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(bagX - 3.6, shoulderY + 11 + step * 0.3, 7.2, 2.2);
      return;
    }
    case 'none':
      return;
  }
}

/** One standing figure with its feet at (0, 0) (up is negative y). */
function paintFigure(ctx: Ctx, a: Appearance, s: FigureState): void {
  const side = s.dir === 'left' || s.dir === 'right';
  const flip = s.dir === 'left' ? -1 : 1;
  const back = s.dir === 'up';
  const step = s.step;
  const bob = step === 0 ? 0 : 0.9;
  const robe = a.robe;

  // Feet and sandals.
  const foot = (fx: number, fy: number): void => {
    ellipse(ctx, fx, fy, 2.8, 1.7, a.skin);
    ellipse(ctx, fx, fy + 1, 3, 1, SANDAL);
  };
  if (side) {
    foot(3 * flip + step * 2.6, -2);
    foot(-2 * flip - step * 2.6, -1.6);
  } else {
    foot(-3.8, -1.8 - (step > 0 ? 1 : 0));
    foot(3.8, -1.8 - (step < 0 ? 1 : 0));
  }

  const lift = -bob + (s.talk ? -0.5 : 0);
  const hemY = -4 + lift;
  const shoulderY = -24 + lift;
  const waistY = -14 + lift;
  const halfTop = side ? 7 : 9;
  const halfHem = side ? 8.4 : 11;
  // Some things are carried behind the body from these angles.
  const slung = (a.carry === 'bundle' && (back || side)) || (a.carry === 'jar' && side);

  // Items behind the body.
  if (slung && s.carry) paintCarry(ctx, a, s, shoulderY, waistY, step);

  // Robe, lit from the upper left.
  const grad = ctx.createLinearGradient(-halfHem, shoulderY, halfHem, hemY);
  grad.addColorStop(0, shade(robe, 0.16));
  grad.addColorStop(0.6, robe);
  grad.addColorStop(1, shade(robe, -0.22));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-halfTop, shoulderY + 1);
  ctx.quadraticCurveTo(0, shoulderY - 2.4, halfTop, shoulderY + 1);
  ctx.lineTo(halfHem, hemY);
  ctx.quadraticCurveTo(0, hemY + 2, -halfHem, hemY);
  ctx.closePath();
  ctx.fill();
  // Two stripes (clavi).
  ctx.fillStyle = a.accent;
  if (!side) {
    ctx.fillRect(-4.6, shoulderY + 1, 1.8, hemY - shoulderY - 1.6);
    ctx.fillRect(2.8, shoulderY + 1, 1.8, hemY - shoulderY - 1.6);
  } else ctx.fillRect(1.4 * flip - 0.9, shoulderY + 1, 1.8, hemY - shoulderY - 1.6);
  // Folds.
  ctx.strokeStyle = rgba(shade(robe, -0.42), 0.5);
  ctx.lineWidth = 0.7;
  for (const fx of side ? [-2, 3] : [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(fx * 0.7, waistY + 2);
    ctx.quadraticCurveTo(fx + step * 0.7, (waistY + hemY) / 2, fx * 1.1, hemY - 0.5);
    ctx.stroke();
  }
  // Belt.
  ctx.fillStyle = shade(a.accent, -0.15);
  ctx.fillRect(-halfTop - 0.6, waistY, halfTop * 2 + 1.2, 2.6);
  if (!back && !side) ctx.fillRect(2.2, waistY + 2.4, 1.7, 4.2);

  // Arms: swing when walking; when talking, one hand gestures.
  const sleeve = shade(robe, -0.06);
  const arm = (ax: number, swing: number, raise: number): void => {
    ctx.fillStyle = sleeve;
    ctx.beginPath();
    ctx.ellipse(
      ax,
      shoulderY + 6.5 + swing - raise * 0.5,
      3,
      6.6 - raise * 0.6,
      raise * 0.25,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ellipse(ctx, ax + raise * 0.8, shoulderY + 12.5 + swing - raise * 2.6, 2, 2, a.skin);
  };
  const gesture = s.talk ? 3 : 0;
  if (side) arm(step * 2.3 * flip, 0, gesture);
  else {
    arm(-halfTop - 1.3, step, 0);
    arm(halfTop + 1.3, -step, back ? 0 : gesture);
  }

  // Head.
  const headY = shoulderY - 7.6 + (a.build === 'elder' ? 0.8 : 0);
  const headX = a.build === 'elder' && side ? flip : 0;
  paintHead(ctx, a, s, headX, headY);

  // Items in front of the body.
  if (s.carry && !slung) paintCarry(ctx, a, s, shoulderY, waistY + 4, step);
}

/** A figure sitting on the ground (legs folded forward), feet line at (0, 0). */
function paintSitting(ctx: Ctx, a: Appearance, dir: Direction, talk: boolean): void {
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const robe = a.robe;
  // Folded legs under the robe.
  ellipse(ctx, side ? flip * 4 : 0, -3, side ? 11 : 12, 5, shade(robe, -0.1));
  const s: FigureState = { dir, step: 0, blink: false, talk, carry: false };
  const shoulderY = -18;
  const grad = ctx.createLinearGradient(-10, shoulderY, 10, -3);
  grad.addColorStop(0, shade(robe, 0.16));
  grad.addColorStop(1, shade(robe, -0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-8, shoulderY + 1);
  ctx.quadraticCurveTo(0, shoulderY - 2.4, 8, shoulderY + 1);
  ctx.lineTo(9, -4);
  ctx.lineTo(-9, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = a.accent;
  if (!side) {
    ctx.fillRect(-4.6, shoulderY + 1, 1.8, 12);
    ctx.fillRect(2.8, shoulderY + 1, 1.8, 12);
  }
  // Hands resting on the knees (one lifts when talking).
  ellipse(ctx, -6, -6, 2, 2, a.skin);
  ellipse(ctx, 6 + (talk ? 1 : 0), talk ? -9 : -6, 2, 2, a.skin);
  paintHead(ctx, a, s, side ? flip * 0.5 : 0, shoulderY - 7.6);
}

/** A figure lying down, head toward `dir` (left or right), body along y = −6. */
function paintLying(ctx: Ctx, a: Appearance, dir: 'left' | 'right', stir: boolean): void {
  const flip = dir === 'left' ? -1 : 1;
  const robe = a.robe;
  const grad = ctx.createLinearGradient(0, -12, 0, 0);
  grad.addColorStop(0, shade(robe, 0.12));
  grad.addColorStop(1, shade(robe, -0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(-flip * 3, -6, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = a.accent;
  ctx.fillRect(flip > 0 ? -14 : -8, -7.5, 22, 1.6);
  // Feet at the far end.
  ellipse(ctx, -flip * 18, -5, 2.2, 2.8, a.skin);
  // An arm across the body; it lifts a little when stirring.
  ellipse(ctx, flip * 2, stir ? -12 : -10, 5, 2.2, shade(robe, -0.06));
  ellipse(ctx, flip * 6, stir ? -13 : -10.5, 1.9, 1.9, a.skin);
  // Head resting on the ground.
  const s: FigureState = { dir: 'down', step: 0, blink: !stir, talk: stir, carry: false };
  ctx.save();
  ctx.translate(flip * 15, -8);
  ctx.rotate(flip * -1.2);
  paintHead(ctx, { ...a, headwear: a.headwear === 'veil' ? 'scarf' : a.headwear }, s, 0, 0);
  ctx.restore();
}

// ── Sheets ───────────────────────────────────────────────────────────────
/** Stamp `paint` into a frame cell with an ink outline and a ground shadow. */
function stampFrame(
  ctx: Ctx,
  doc: Document,
  cell: { x: number; y: number; w: number; h: number },
  shadow: { rx: number; ry: number },
  outline: string,
  paint: (c: Ctx) => void,
): void {
  const { x: ox, y: oy, w, h } = cell;
  const fig = makeCanvas(w, h, doc);
  const fctx = fig.ctx;
  if (!fctx) return;
  paint(fctx);
  const sil = makeCanvas(w, h, doc);
  if (sil.ctx) {
    sil.ctx.setTransform(1, 0, 0, 1, 0, 0);
    sil.ctx.drawImage(fig.canvas, 0, 0);
    sil.ctx.globalCompositeOperation = 'source-in';
    sil.ctx.fillStyle = outline;
    sil.ctx.fillRect(0, 0, sil.canvas.width, sil.canvas.height);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, w, h);
  ctx.clip();
  softShadow(ctx, ox + w / 2, oy + h - 3, shadow.rx, shadow.ry, 0.42);
  const px = 1.6 / ART_SCALE;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.drawImage(sil.canvas, ox + dx * px, oy + dy * px, w, h);
  }
  ctx.drawImage(fig.canvas, ox, oy, w, h);
  ctx.restore();
}

/** The full standing sheet (4 directions × 5 frames) at ART_SCALE. */
export function paintCharacterSheet(
  appearance: Appearance,
  doc: Document = document,
): HTMLCanvasElement {
  const sheet = makeCanvas(CHAR_W * FRAMES_PER_DIRECTION, CHAR_H * DIRECTION_ROWS.length, doc);
  const ctx = sheet.ctx;
  if (!ctx) return sheet.canvas;
  const scale = appearance.build === 'child' ? 0.86 : 1;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIRECTION; f++) {
      const state: FigureState = {
        dir,
        step: f === FRAME.stepA ? 1 : f === FRAME.stepB ? -1 : 0,
        blink: f === FRAME.blink,
        talk: f === FRAME.talk,
        carry: true,
      };
      stampFrame(
        ctx,
        doc,
        { x: f * CHAR_W, y: row * CHAR_H, w: CHAR_W, h: CHAR_H },
        { rx: 10 * scale, ry: 3.4 * scale },
        outlineFor(appearance),
        (c) => {
          c.translate(CHAR_W / 2, CHAR_H - 3);
          c.scale(scale, scale);
          paintFigure(c, appearance, state);
        },
      );
    }
  });
  return sheet.canvas;
}

/** A pose sheet (4 directions × 2 frames: rest, talk/stir) at ART_SCALE. */
export function paintPoseSheet(
  appearance: Appearance,
  pose: Pose,
  doc: Document = document,
): HTMLCanvasElement {
  const sheet = makeCanvas(POSE_W * POSE_FRAMES, POSE_H * DIRECTION_ROWS.length, doc);
  const ctx = sheet.ctx;
  if (!ctx) return sheet.canvas;
  const scale = appearance.build === 'child' ? 0.86 : 1;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < POSE_FRAMES; f++) {
      stampFrame(
        ctx,
        doc,
        { x: f * POSE_W, y: row * POSE_H, w: POSE_W, h: POSE_H },
        pose === 'lie' ? { rx: 20, ry: 4 } : { rx: 13, ry: 4 },
        outlineFor(appearance),
        (c) => {
          c.translate(POSE_W / 2, POSE_H - 5);
          c.scale(scale, scale);
          if (pose === 'sit') paintSitting(c, appearance, dir, f === 1);
          else paintLying(c, appearance, dir === 'left' ? 'left' : 'right', f === 1);
        },
      );
    }
  });
  return sheet.canvas;
}

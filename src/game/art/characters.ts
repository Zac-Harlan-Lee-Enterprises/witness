import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import { ART_SCALE, ellipse, makeCanvas, mix, rgba, shade, softShadow, type Ctx } from './paint';

/**
 * Procedural character sprites: 4 directions × 3 frames (stand, step A,
 * step B), painted at ART_SCALE with shading, clothing detail and a dark
 * outline for readability. The same Appearance drives the React portrait,
 * so people look consistent in the world and in conversation.
 *
 * Dress is first-century-inspired and stylised: a belted tunic, often with
 * two vertical coloured stripes, sandals, and a head covering for many.
 */
export const CHAR_W = 32;
export const CHAR_H = 48;
export const DIRECTION_ROWS: Direction[] = ['down', 'left', 'right', 'up'];
export const FRAMES_PER_DIRECTION = 3;

export function frameName(direction: Direction, frame: number): string {
  return `${direction}-${frame}`;
}

export function appearanceKey(a: Appearance): string {
  return `char2-${[
    a.skin,
    a.hair,
    a.robe,
    a.accent,
    a.headwear,
    a.headwearColor,
    a.beard ? 1 : 0,
    a.build,
  ]
    .join('-')
    .replace(/#/g, '')}`;
}

/** Paint one figure with its feet at (0, 0) in local coordinates (up is negative y). */
function paintFigure(ctx: Ctx, a: Appearance, dir: Direction, frame: number): void {
  const elder = a.build === 'elder';
  const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const bob = frame === 0 ? 0 : 0.8;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const back = dir === 'up';
  const robe = a.robe;
  const hairColor = elder ? '#d9d2c4' : a.hair;

  // Feet and sandals.
  const sandal = '#5b3d22';
  const foot = (fx: number, fy: number): void => {
    ellipse(ctx, fx, fy, 2.6, 1.6, a.skin);
    ctx.strokeStyle = sandal;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(fx - 2.2, fy - 0.2);
    ctx.lineTo(fx + 2.2, fy - 0.2);
    ctx.stroke();
    ellipse(ctx, fx, fy + 1, 2.8, 0.9, sandal);
  };
  if (side) {
    foot(3 * flip + step * 2.5, -2);
    foot(-2 * flip - step * 2.5, -1.6);
  } else {
    foot(-3.6, -1.8 - (step > 0 ? 1 : 0));
    foot(3.6, -1.8 - (step < 0 ? 1 : 0));
  }

  const lift = -bob;
  const hemY = -4 + lift;
  const shoulderY = -26 + lift;
  const waistY = -15 + lift;
  const halfTop = side ? 6.5 : 8.5;
  const halfHem = side ? 8 : 10.5;

  // Robe body, lit from the upper left.
  const grad = ctx.createLinearGradient(-halfHem, shoulderY, halfHem, hemY);
  grad.addColorStop(0, shade(robe, 0.14));
  grad.addColorStop(0.6, robe);
  grad.addColorStop(1, shade(robe, -0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-halfTop, shoulderY + 1);
  ctx.quadraticCurveTo(0, shoulderY - 2, halfTop, shoulderY + 1);
  ctx.lineTo(halfHem, hemY);
  ctx.quadraticCurveTo(0, hemY + 1.8, -halfHem, hemY);
  ctx.closePath();
  ctx.fill();

  // Two vertical stripes down the tunic.
  ctx.fillStyle = a.accent;
  if (!side) {
    ctx.fillRect(-4.2, shoulderY + 1, 1.6, hemY - shoulderY - 1.5);
    ctx.fillRect(2.6, shoulderY + 1, 1.6, hemY - shoulderY - 1.5);
  } else {
    ctx.fillRect(1.2 * flip - 0.8, shoulderY + 1, 1.6, hemY - shoulderY - 1.5);
  }
  // Folds.
  ctx.strokeStyle = rgba(shade(robe, -0.4), 0.5);
  ctx.lineWidth = 0.7;
  for (const fx of side ? [-2, 3] : [-6.5, 0, 6.5]) {
    ctx.beginPath();
    ctx.moveTo(fx * 0.7, waistY + 2);
    ctx.quadraticCurveTo(fx + step * 0.6, (waistY + hemY) / 2, fx * 1.1, hemY - 0.5);
    ctx.stroke();
  }
  // Belt and hanging sash ends.
  ctx.fillStyle = shade(a.accent, -0.15);
  ctx.fillRect(-halfTop - 0.5, waistY, halfTop * 2 + 1, 2.4);
  if (!back && !side) {
    ctx.fillRect(2, waistY + 2, 1.6, 4);
    ctx.fillRect(3.8, waistY + 2, 1.4, 3.2);
  }

  // Arms: sleeves and hands, swinging when walking.
  const sleeve = shade(robe, -0.06);
  const arm = (ax: number, swing: number): void => {
    ctx.fillStyle = sleeve;
    ctx.beginPath();
    ctx.ellipse(ax, shoulderY + 7 + swing, 2.8, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, ax, shoulderY + 13 + swing, 1.8, 1.8, a.skin);
  };
  if (side) arm(step * 2.2 * flip, 0);
  else {
    arm(-halfTop - 1.2, step);
    arm(halfTop + 1.2, -step);
  }

  // An elder's shepherd staff.
  if (elder) {
    const sx = side ? 7 * flip : 12;
    ctx.strokeStyle = '#6b4f30';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, -1);
    ctx.lineTo(sx + (side ? flip : 0.5), -38 + lift);
    ctx.stroke();
    ctx.strokeStyle = '#8a6a42';
    ctx.beginPath();
    ctx.arc(sx + (side ? flip * 2.5 : 3), -38 + lift, 2.5, Math.PI, 2 * Math.PI);
    ctx.stroke();
  }

  // Head.
  const headY = shoulderY - 6.5 + (elder ? 0.8 : 0);
  const headX = elder && side ? flip : 0;
  const skinGrad = ctx.createRadialGradient(headX - 2, headY - 2, 1, headX, headY, 8);
  skinGrad.addColorStop(0, shade(a.skin, 0.12));
  skinGrad.addColorStop(1, shade(a.skin, -0.1));
  ctx.fillStyle = skinGrad;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 6.2, 6.8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (side) ellipse(ctx, headX - flip * 1.5, headY + 0.5, 1.4, 2, shade(a.skin, -0.12)); // ear

  // Hair (when the head isn't fully covered).
  const covered = a.headwear === 'scarf' || a.headwear === 'veil' || a.headwear === 'hood';
  if (!covered) {
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    if (back) ctx.ellipse(headX, headY - 0.5, 6.5, 6.6, 0, 0, Math.PI * 2);
    else if (side) ctx.ellipse(headX - flip * 1.8, headY - 2.2, 5.4, 4.8, 0, 0, Math.PI * 2);
    else ctx.ellipse(headX, headY - 3, 6.5, 4.3, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (!back) {
      for (let i = -2; i <= 2; i++)
        ellipse(ctx, headX + i * 2.4, headY - 5.8, 1.5, 1.3, shade(hairColor, 0.1));
    }
  }

  // Face.
  if (!back) {
    const eyeY = headY - 0.2;
    const eye = (ex: number): void => {
      ellipse(ctx, ex, eyeY, 0.95, 1.15, '#2a1a10');
      ellipse(ctx, ex + 0.3, eyeY - 0.4, 0.3, 0.3, rgba('#ffffff', 0.9));
    };
    ctx.strokeStyle = shade(hairColor, -0.2);
    ctx.lineWidth = 0.7;
    if (side) {
      eye(headX + flip * 2.6);
      ctx.beginPath();
      ctx.moveTo(headX + flip * 1.6, eyeY - 2);
      ctx.lineTo(headX + flip * 3.6, eyeY - 2.2);
      ctx.stroke();
      ellipse(ctx, headX + flip * 5.9, headY + 1, 1, 1.2, shade(a.skin, -0.05)); // nose
    } else {
      eye(headX - 2.4);
      eye(headX + 2.4);
      ctx.beginPath();
      ctx.moveTo(headX - 3.4, eyeY - 2);
      ctx.lineTo(headX - 1.4, eyeY - 2.3);
      ctx.moveTo(headX + 1.4, eyeY - 2.3);
      ctx.lineTo(headX + 3.4, eyeY - 2);
      ctx.stroke();
      ellipse(ctx, headX - 3.6, headY + 2, 1.3, 0.8, rgba('#d0674f', 0.22));
      ellipse(ctx, headX + 3.6, headY + 2, 1.3, 0.8, rgba('#d0674f', 0.22));
      ctx.strokeStyle = rgba('#5a2c1a', 0.8);
      ctx.beginPath();
      ctx.moveTo(headX - 1.2, headY + 3.2);
      ctx.quadraticCurveTo(headX, headY + 3.9, headX + 1.2, headY + 3.2);
      ctx.stroke();
    }
    if (a.beard) {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      if (side) ctx.ellipse(headX + flip * 1.5, headY + 4, 4, 3.4, 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(headX - 5.6, headY + 0.5);
        ctx.quadraticCurveTo(headX - 5, headY + 7.5, headX, headY + 8.2);
        ctx.quadraticCurveTo(headX + 5, headY + 7.5, headX + 5.6, headY + 0.5);
        ctx.quadraticCurveTo(headX, headY + 4.5, headX - 5.6, headY + 0.5);
      }
      ctx.fill();
      if (!side) {
        ctx.strokeStyle = rgba(shade(hairColor, -0.3), 0.6);
        ctx.lineWidth = 0.5;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(headX + i * 1.8, headY + 4);
          ctx.lineTo(headX + i * 1.6, headY + 7);
          ctx.stroke();
        }
      }
    }
  }

  // Head coverings.
  const hw = a.headwear === 'hood' ? shade(robe, 0.06) : a.headwearColor;
  switch (a.headwear) {
    case 'scarf':
    case 'veil':
    case 'hood': {
      const drape = a.headwear === 'veil' ? 20 : 11;
      const cloth = ctx.createLinearGradient(headX - 8, headY - 8, headX + 8, headY + drape);
      cloth.addColorStop(0, shade(hw, 0.12));
      cloth.addColorStop(1, shade(hw, -0.18));
      ctx.fillStyle = cloth;
      ctx.beginPath();
      if (back) {
        ctx.moveTo(headX - 7.2, headY);
        ctx.quadraticCurveTo(headX, headY - 11, headX + 7.2, headY);
        ctx.lineTo(headX + 8.5, headY + drape);
        ctx.quadraticCurveTo(headX, headY + drape + 2, headX - 8.5, headY + drape);
      } else if (side) {
        ctx.moveTo(headX + flip * 5.5, headY - 3);
        ctx.quadraticCurveTo(headX, headY - 11, headX - flip * 7, headY - 1);
        ctx.lineTo(headX - flip * 8, headY + drape);
        ctx.lineTo(headX - flip * 2.5, headY + drape - 1);
        ctx.lineTo(headX - flip * 3, headY + 1);
        ctx.quadraticCurveTo(headX + flip * 1, headY - 5, headX + flip * 5.5, headY - 3);
      } else {
        ctx.moveTo(headX - 7.2, headY + 1);
        ctx.quadraticCurveTo(headX, headY - 12, headX + 7.2, headY + 1);
        ctx.lineTo(headX + 8.2, headY + drape);
        ctx.lineTo(headX + 5, headY + drape);
        ctx.lineTo(headX + 5, headY + 1.5);
        ctx.quadraticCurveTo(headX, headY - 6.5, headX - 5, headY + 1.5);
        ctx.lineTo(headX - 5, headY + drape);
        ctx.lineTo(headX - 8.2, headY + drape);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(shade(hw, -0.4), 0.45);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(headX - 4, headY - 6);
      ctx.quadraticCurveTo(headX, headY - 8, headX + 4, headY - 6);
      ctx.stroke();
      break;
    }
    case 'wrap': {
      ctx.fillStyle = hw;
      ctx.beginPath();
      ctx.ellipse(headX, headY - 4.2, 7.2, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(shade(hw, -0.35), 0.7);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(
          headX,
          headY - 5.5 + i * 1.6,
          6.6 - i * 0.4,
          2.2,
          0.15 * (i - 1),
          Math.PI * 0.05,
          Math.PI * 0.95,
        );
        ctx.stroke();
      }
      ellipse(ctx, headX - 2, headY - 6.5, 2.5, 1, rgba('#ffffff', 0.3));
      break;
    }
    case 'band':
      ctx.fillStyle = hw;
      ctx.fillRect(headX - 6.6, headY - 4.4, 13.2, 2.2);
      if (back) ctx.fillRect(headX + 1, headY - 3, 1.4, 6);
      break;
    case 'none':
      break;
  }
}

/** Paint the full 4×3 sheet (at ART_SCALE) with outlines and ground shadows. */
export function paintCharacterSheet(
  appearance: Appearance,
  doc: Document = document,
): HTMLCanvasElement {
  const sheet = makeCanvas(CHAR_W * FRAMES_PER_DIRECTION, CHAR_H * DIRECTION_ROWS.length, doc);
  const ctx = sheet.ctx;
  if (!ctx) return sheet.canvas;
  const scale = appearance.build === 'child' ? 0.84 : 1;
  const outline = mix('#2a170b', appearance.robe, 0.15);

  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIRECTION; f++) {
      const ox = f * CHAR_W;
      const oy = row * CHAR_H;
      // Paint the figure alone, then build a dark outline from its silhouette.
      const fig = makeCanvas(CHAR_W, CHAR_H, doc);
      const fctx = fig.ctx;
      if (!fctx) continue;
      fctx.save();
      fctx.translate(CHAR_W / 2, CHAR_H - 3);
      fctx.scale(scale, scale);
      paintFigure(fctx, appearance, dir, f);
      fctx.restore();

      const sil = makeCanvas(CHAR_W, CHAR_H, doc);
      if (sil.ctx) {
        sil.ctx.setTransform(1, 0, 0, 1, 0, 0);
        sil.ctx.drawImage(fig.canvas, 0, 0);
        sil.ctx.globalCompositeOperation = 'source-in';
        sil.ctx.fillStyle = outline;
        sil.ctx.fillRect(0, 0, sil.canvas.width, sil.canvas.height);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, CHAR_W, CHAR_H);
      ctx.clip();
      softShadow(ctx, ox + CHAR_W / 2, oy + CHAR_H - 3, 10 * scale, 3.4 * scale, 0.38);
      const px = 1.4 / ART_SCALE; // ~1.4 texture pixels of outline
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
        ctx.drawImage(sil.canvas, ox + dx * px, oy + dy * px, CHAR_W, CHAR_H);
      }
      ctx.drawImage(fig.canvas, ox, oy, CHAR_W, CHAR_H);
      ctx.restore();
    }
  });
  return sheet.canvas;
}

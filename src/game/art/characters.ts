import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';

/**
 * Procedural character sprites: 4 directions × 3 frames (stand, step A,
 * step B) on one canvas. Robed, stylised figures in first-century-inspired
 * dress; the same Appearance data drives the React portraits, so a character
 * looks consistent in the world and in dialogue.
 */
export const CHAR_W = 32;
export const CHAR_H = 44;
export const DIRECTION_ROWS: Direction[] = ['down', 'left', 'right', 'up'];
export const FRAMES_PER_DIRECTION = 3;

export function frameName(direction: Direction, frame: number): string {
  return `${direction}-${frame}`;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintFigure(
  ctx: CanvasRenderingContext2D,
  a: Appearance,
  dir: Direction,
  frame: number,
  ox: number,
  oy: number,
): void {
  const scale = a.build === 'child' ? 0.84 : 1;
  ctx.save();
  // Clip to this frame so shadows never bleed into the neighbouring frame.
  ctx.beginPath();
  ctx.rect(ox, oy, CHAR_W, CHAR_H);
  ctx.clip();
  ctx.translate(ox + CHAR_W / 2, oy + CHAR_H - 2);
  ctx.scale(scale, scale);
  // Local coordinates: x centred, y = 0 at the feet, negative upwards.
  const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;

  ellipse(ctx, 0, -2, 10, 3.5, 'rgba(40,25,10,0.28)');

  // Feet
  const footColor = '#4a3522';
  if (side) {
    ellipse(ctx, 3 * flip + step * 2, -3, 3, 2, footColor);
    ellipse(ctx, -2 * flip - step * 2, -3, 3, 2, shade(footColor, -0.2));
  } else {
    ellipse(ctx, -4, -3 + (step > 0 ? -1 : 0), 3, 2, footColor);
    ellipse(ctx, 4, -3 + (step < 0 ? -1 : 0), 3, 2, footColor);
  }

  // Robe (a gently flared tunic/cloak)
  const robe = a.robe;
  const width = side ? 7 : 9;
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-width + 1, -24);
  ctx.lineTo(width - 1, -24);
  ctx.lineTo(width + 2, -4);
  ctx.lineTo(-width - 2, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(robe, -0.18);
  ctx.fillRect(side ? -width * flip - (flip > 0 ? 0 : 3) : width - 2, -22, 3, 18);
  // Hem stripe and sash
  ctx.fillStyle = a.accent;
  ctx.fillRect(-width - 2, -7, (width + 2) * 2, 2);
  ctx.fillRect(-width, -15, width * 2, 2.5);

  // Arms
  const arm = shade(robe, -0.08);
  if (side) {
    ellipse(ctx, step * 2 * flip, -18, 2.6, 5, arm);
  } else {
    ellipse(ctx, -width - 1, -17 + step, 2.6, 5, arm);
    ellipse(ctx, width + 1, -17 - step, 2.6, 5, arm);
  }

  // Elder's staff
  if (a.build === 'elder') {
    ctx.strokeStyle = '#6b5236';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const sx = side ? 6 * flip : 11;
    ctx.moveTo(sx, -2);
    ctx.lineTo(sx, -34);
    ctx.stroke();
  }

  // Head
  const headY = -30;
  ellipse(ctx, 0, headY, 6.5, 7, a.skin);

  // Hair (behind/around face)
  if (a.headwear === 'none' || a.headwear === 'band') {
    ctx.fillStyle = a.hair;
    ctx.beginPath();
    if (dir === 'up') ctx.ellipse(0, headY, 6.8, 7.2, 0, 0, Math.PI * 2);
    else ctx.ellipse(0, headY - 3, 6.8, 4.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // Face
  if (dir !== 'up') {
    ctx.fillStyle = '#2a1a10';
    if (side) {
      ctx.fillRect(3 * flip - 0.8, headY - 1, 1.8, 1.8);
    } else {
      ctx.fillRect(-3, headY - 1, 1.8, 1.8);
      ctx.fillRect(1.4, headY - 1, 1.8, 1.8);
    }
    if (a.beard) {
      ctx.fillStyle = a.hair;
      ctx.beginPath();
      if (side) ctx.ellipse(2 * flip, headY + 4.5, 4, 3, 0, 0, Math.PI * 2);
      else ctx.ellipse(0, headY + 4.5, 5, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (a.beard) {
    // nothing visible from behind
  }

  // Headwear
  const hw = a.headwearColor;
  switch (a.headwear) {
    case 'scarf':
    case 'veil':
    case 'hood': {
      const color = a.headwear === 'hood' ? shade(robe, 0.05) : hw;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, headY - 2, 7.8, 7, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      // drape down the sides / back
      const drape = a.headwear === 'veil' ? 18 : 10;
      if (dir === 'up') {
        ctx.fillRect(-7.5, headY - 2, 15, drape + 6);
      } else if (side) {
        ctx.fillRect(-6 * flip - (flip > 0 ? 3 : 0), headY - 2, 4, drape);
      } else {
        ctx.fillRect(-7.8, headY - 2, 3, drape);
        ctx.fillRect(4.8, headY - 2, 3, drape);
      }
      break;
    }
    case 'wrap':
      ctx.fillStyle = hw;
      ctx.beginPath();
      ctx.ellipse(0, headY - 4.5, 7.2, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(hw, -0.15);
      ctx.fillRect(-7, headY - 4, 14, 1.5);
      break;
    case 'band':
      ctx.fillStyle = hw;
      ctx.fillRect(-6.8, headY - 4, 13.6, 2.2);
      break;
    case 'none':
      break;
  }
  ctx.restore();
}

/** Paint the full 4×3 sheet onto a new canvas. */
export function paintCharacterSheet(
  appearance: Appearance,
  doc: Document = document,
): HTMLCanvasElement {
  const canvas = doc.createElement('canvas');
  canvas.width = CHAR_W * FRAMES_PER_DIRECTION;
  canvas.height = CHAR_H * DIRECTION_ROWS.length;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIRECTION; f++) {
      paintFigure(ctx, appearance, dir, f, f * CHAR_W, row * CHAR_H);
    }
  });
  return canvas;
}

export function appearanceKey(a: Appearance): string {
  return `char-${[a.skin, a.hair, a.robe, a.accent, a.headwear, a.headwearColor, a.beard ? 1 : 0, a.build].join('-').replace(/#/g, '')}`;
}

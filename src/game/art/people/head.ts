import { ellipse, mix, rgba, shade, type Ctx } from '../paint';
import type { Dress } from './dress';
import type { Pt, Rig } from './rig';

/**
 * Heads, faces, hair, beards and head coverings, drawn with light from the
 * upper left. At play size a head is about 18 pixels tall, so faces are
 * suggested by value (brow shadow, eyes, the shadow side of the nose, a
 * mouth) rather than drawn line by line.
 */
const EYE = '#20140d';

function skinFill(ctx: Ctx, d: Dress, c: Pt, h: number): CanvasGradient {
  const g = ctx.createRadialGradient(c.x - h * 0.16, c.y - h * 0.18, h * 0.05, c.x, c.y, h * 0.72);
  g.addColorStop(0, shade(d.skin, 0.12));
  g.addColorStop(0.5, d.skin);
  g.addColorStop(1, d.skinShadow);
  return g;
}

function hairFill(ctx: Ctx, color: string, c: Pt, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(c.x - h * 0.4, c.y - h * 0.5, c.x + h * 0.4, c.y + h * 0.2);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.35));
  return g;
}

function clothFill(ctx: Ctx, color: string, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(color, 0.14));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -0.3));
  return g;
}

/** Fine strands or weave lines inside the current clip. */
function strands(
  ctx: Ctx,
  color: string,
  alpha: number,
  lines: Array<[number, number, number, number, number, number]>,
  width = 0.28,
): void {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  for (const [x0, y0, cx, cy, x1, y1] of lines) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
  }
}

// ── Front ────────────────────────────────────────────────────────────────
function headShapeFront(ctx: Ctx, c: Pt, h: number): void {
  const rx = h * 0.37;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - h * 0.5);
  ctx.bezierCurveTo(c.x + rx * 0.9, c.y - h * 0.5, c.x + rx * 1.02, c.y - h * 0.22, c.x + rx, c.y);
  ctx.bezierCurveTo(
    c.x + rx * 0.98,
    c.y + h * 0.2,
    c.x + rx * 0.62,
    c.y + h * 0.42,
    c.x,
    c.y + h * 0.5,
  );
  ctx.bezierCurveTo(c.x - rx * 0.62, c.y + h * 0.42, c.x - rx * 0.98, c.y + h * 0.2, c.x - rx, c.y);
  ctx.bezierCurveTo(
    c.x - rx * 1.02,
    c.y - h * 0.22,
    c.x - rx * 0.9,
    c.y - h * 0.5,
    c.x,
    c.y - h * 0.5,
  );
  ctx.closePath();
}

function faceFront(ctx: Ctx, d: Dress, r: Rig, c: Pt, h: number): void {
  const rx = h * 0.37;
  // Ears (hidden by most head coverings).
  if (d.headwear === 'none' || d.headwear === 'band' || d.headwear === 'wrap') {
    for (const s of [-1, 1]) {
      ellipse(
        ctx,
        c.x + s * rx * 0.98,
        c.y + h * 0.04,
        h * 0.07,
        h * 0.12,
        s < 0 ? d.skin : d.skinShadow,
      );
    }
  }
  ctx.fillStyle = skinFill(ctx, d, c, h);
  headShapeFront(ctx, c, h);
  ctx.fill();
  // Cheeks and the shadow side of the face.
  ctx.save();
  headShapeFront(ctx, c, h);
  ctx.clip();
  const side = ctx.createLinearGradient(c.x + rx * 0.2, 0, c.x + rx, 0);
  side.addColorStop(0, rgba(d.skinShadow, 0));
  side.addColorStop(1, rgba(d.skinShadow, 0.55));
  ctx.fillStyle = side;
  ctx.fillRect(c.x, c.y - h * 0.5, rx, h);
  for (const s of [-1, 1]) {
    const blush = ctx.createRadialGradient(
      c.x + s * h * 0.19,
      c.y + h * 0.16,
      0,
      c.x + s * h * 0.19,
      c.y + h * 0.16,
      h * 0.14,
    );
    blush.addColorStop(0, 'rgba(160,60,40,0.14)');
    blush.addColorStop(1, 'rgba(160,60,40,0)');
    ctx.fillStyle = blush;
    ctx.fillRect(c.x - rx, c.y, rx * 2, h * 0.4);
  }
  // Brow ridge shadow.
  ctx.fillStyle = rgba(d.skinShadow, 0.45);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + h * 0.01, h * 0.27, h * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eyes.
  const ey = c.y + h * 0.02;
  for (const s of [-1, 1]) {
    const ex = c.x + s * h * 0.145;
    if (r.eyesClosed) {
      ctx.strokeStyle = rgba(shade(d.skinShadow, -0.3), 0.8);
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(ex - h * 0.06, ey + 0.1);
      ctx.quadraticCurveTo(ex, ey + h * 0.03, ex + h * 0.06, ey + 0.1);
      ctx.stroke();
    } else {
      ellipse(ctx, ex, ey, h * 0.075, h * 0.042, rgba('#efe4d2', 0.55));
      ellipse(ctx, ex + h * 0.01, ey, h * 0.045, h * 0.042, EYE);
    }
  }
  // Brows.
  ctx.strokeStyle = rgba(d.brow, 0.75);
  ctx.lineWidth = 0.55;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c.x + s * h * 0.06, ey - h * 0.1);
    ctx.quadraticCurveTo(c.x + s * h * 0.15, ey - h * 0.14, c.x + s * h * 0.23, ey - h * 0.09);
    ctx.stroke();
  }
  // Nose: shadow side, tip highlight and nostril.
  ctx.strokeStyle = rgba(d.skinShadow, 0.9);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(c.x + h * 0.03, ey + h * 0.02);
  ctx.quadraticCurveTo(c.x + h * 0.07, ey + h * 0.12, c.x + h * 0.045, ey + h * 0.18);
  ctx.stroke();
  ellipse(ctx, c.x - h * 0.015, ey + h * 0.15, h * 0.04, h * 0.03, rgba(shade(d.skin, 0.25), 0.7));
  ellipse(
    ctx,
    c.x + h * 0.025,
    ey + h * 0.2,
    h * 0.05,
    h * 0.018,
    rgba(shade(d.skinShadow, -0.3), 0.55),
  );
  // Mouth.
  const my = c.y + h * 0.3;
  if (r.mouth > 0.05) {
    ellipse(ctx, c.x, my + 0.1, h * 0.075, h * 0.05 * r.mouth + 0.2, '#3a1610');
  } else {
    ctx.strokeStyle = mix(d.skin, '#4a1a12', 0.6);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(c.x - h * 0.09, my);
    ctx.quadraticCurveTo(c.x, my + h * 0.025, c.x + h * 0.09, my);
    ctx.stroke();
  }
  ellipse(ctx, c.x, my + h * 0.08, h * 0.06, h * 0.025, rgba(shade(d.skin, 0.2), 0.45));
  if (d.elder) {
    // Lines of age across the brow and beside the mouth.
    strands(ctx, d.skinShadow, 0.55, [
      [c.x - h * 0.16, c.y - h * 0.2, c.x, c.y - h * 0.23, c.x + h * 0.16, c.y - h * 0.2],
      [c.x - h * 0.12, my - h * 0.12, c.x - h * 0.16, my - h * 0.02, c.x - h * 0.12, my + h * 0.06],
      [c.x + h * 0.12, my - h * 0.12, c.x + h * 0.16, my - h * 0.02, c.x + h * 0.12, my + h * 0.06],
    ]);
  }
}

function beardFront(ctx: Ctx, d: Dress, r: Rig, c: Pt, h: number): void {
  const rx = h * 0.37;
  ctx.fillStyle = hairFill(ctx, d.beardColor, c, h);
  ctx.beginPath();
  ctx.moveTo(c.x - rx * 0.98, c.y + h * 0.02);
  ctx.bezierCurveTo(
    c.x - rx * 1.02,
    c.y + h * 0.36,
    c.x - rx * 0.5,
    c.y + h * 0.64,
    c.x,
    c.y + h * 0.66,
  );
  ctx.bezierCurveTo(
    c.x + rx * 0.5,
    c.y + h * 0.64,
    c.x + rx * 1.02,
    c.y + h * 0.36,
    c.x + rx * 0.98,
    c.y + h * 0.02,
  );
  // Inner edge: cheeks are bare, the mouth shows through the moustache.
  ctx.bezierCurveTo(
    c.x + rx * 0.8,
    c.y + h * 0.2,
    c.x + rx * 0.45,
    c.y + h * 0.22,
    c.x + h * 0.12,
    c.y + h * 0.24,
  );
  ctx.quadraticCurveTo(c.x, c.y + h * 0.2, c.x - h * 0.12, c.y + h * 0.24);
  ctx.bezierCurveTo(
    c.x - rx * 0.45,
    c.y + h * 0.22,
    c.x - rx * 0.8,
    c.y + h * 0.2,
    c.x - rx * 0.98,
    c.y + h * 0.02,
  );
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  const lines: Array<[number, number, number, number, number, number]> = [];
  for (let i = -3; i <= 3; i++) {
    const x = c.x + i * h * 0.075;
    lines.push([x, c.y + h * 0.26, x + i * 0.2, c.y + h * 0.45, x + i * 0.35, c.y + h * 0.64]);
  }
  strands(ctx, shade(d.beardColor, 0.3), 0.35, lines, 0.3);
  ctx.restore();
  // Mouth over the beard.
  const my = c.y + h * 0.3;
  if (r.mouth > 0.05) ellipse(ctx, c.x, my + 0.1, h * 0.07, h * 0.045 * r.mouth + 0.2, '#2a120c');
  else {
    ctx.strokeStyle = '#3a1a12';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(c.x - h * 0.08, my);
    ctx.lineTo(c.x + h * 0.08, my);
    ctx.stroke();
  }
}

function hairFront(ctx: Ctx, d: Dress, c: Pt, h: number): void {
  const rx = h * 0.37;
  ctx.fillStyle = hairFill(ctx, d.hair, c, h);
  ctx.beginPath();
  ctx.moveTo(c.x - rx * 1.04, c.y + h * 0.04);
  ctx.bezierCurveTo(
    c.x - rx * 1.12,
    c.y - h * 0.4,
    c.x - rx * 0.5,
    c.y - h * 0.58,
    c.x,
    c.y - h * 0.56,
  );
  ctx.bezierCurveTo(
    c.x + rx * 0.5,
    c.y - h * 0.58,
    c.x + rx * 1.12,
    c.y - h * 0.4,
    c.x + rx * 1.04,
    c.y + h * 0.04,
  );
  ctx.lineTo(c.x + rx * 0.9, c.y - h * 0.08);
  ctx.bezierCurveTo(
    c.x + rx * 0.7,
    c.y - h * 0.3,
    c.x + rx * 0.3,
    c.y - h * 0.28,
    c.x,
    c.y - h * 0.3,
  );
  ctx.bezierCurveTo(
    c.x - rx * 0.3,
    c.y - h * 0.28,
    c.x - rx * 0.7,
    c.y - h * 0.3,
    c.x - rx * 0.9,
    c.y - h * 0.08,
  );
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  const lines: Array<[number, number, number, number, number, number]> = [];
  for (let i = -4; i <= 4; i++) {
    lines.push([
      c.x + i * 0.4,
      c.y - h * 0.55,
      c.x + i * 1.1,
      c.y - h * 0.42,
      c.x + i * 1.5,
      c.y - h * 0.2,
    ]);
  }
  strands(ctx, shade(d.hair, 0.4), 0.3, lines);
  ctx.restore();
}

/** Parts of a head covering that hang behind the body (drawn before it). */
export function headwearBack(ctx: Ctx, d: Dress, r: Rig): void {
  const c = r.head;
  const h = r.build.head;
  const kind = d.headwear;
  if (kind !== 'veil' && kind !== 'hood' && kind !== 'scarf') return;
  const long = kind === 'scarf' ? 0.35 : 1;
  const shoulderY = r.shoulders[0].y;
  const side = r.dir === 'left' || r.dir === 'right';
  const flip = r.dir === 'left' ? -1 : 1;
  const w = r.build.shoulder * (side ? 0.42 : 0.62);
  const cx = side ? c.x - flip * h * 0.45 : c.x;
  const bottom = shoulderY + (r.build.shoulderY - r.build.hipY) * 0.95 * long + 3;
  ctx.fillStyle = clothFill(ctx, shade(d.headColor, -0.12), cx - w, c.y, cx + w, bottom);
  ctx.beginPath();
  ctx.moveTo(cx - h * 0.4, c.y - h * 0.2);
  ctx.quadraticCurveTo(cx - w * 1.05, shoulderY, cx - w * 0.95, bottom);
  ctx.quadraticCurveTo(cx, bottom + 1.5, cx + w * 0.95, bottom);
  ctx.quadraticCurveTo(cx + w * 1.05, shoulderY, cx + h * 0.4, c.y - h * 0.2);
  ctx.closePath();
  ctx.fill();
}

function headwearFront(ctx: Ctx, d: Dress, c: Pt, h: number): void {
  const rx = h * 0.37;
  const color = d.headColor;
  switch (d.headwear) {
    case 'wrap': {
      // A cloth wound around the head: a full crown, a wound edge over the brow.
      ctx.fillStyle = rgba(d.skinShadow, 0.5);
      ctx.fillRect(c.x - rx, c.y - h * 0.2, rx * 2, h * 0.06);
      ctx.fillStyle = clothFill(ctx, color, c.x - rx, c.y - h * 0.7, c.x + rx, c.y - h * 0.1);
      ctx.beginPath();
      ctx.moveTo(c.x - rx * 1.12, c.y - h * 0.14);
      ctx.bezierCurveTo(
        c.x - rx * 1.3,
        c.y - h * 0.62,
        c.x - rx * 0.4,
        c.y - h * 0.78,
        c.x + rx * 0.1,
        c.y - h * 0.74,
      );
      ctx.bezierCurveTo(
        c.x + rx * 0.8,
        c.y - h * 0.72,
        c.x + rx * 1.3,
        c.y - h * 0.55,
        c.x + rx * 1.12,
        c.y - h * 0.14,
      );
      ctx.quadraticCurveTo(c.x, c.y - h * 0.26, c.x - rx * 1.12, c.y - h * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      strands(
        ctx,
        shade(color, -0.35),
        0.45,
        [
          [c.x - rx * 1.2, c.y - h * 0.3, c.x, c.y - h * 0.5, c.x + rx * 1.2, c.y - h * 0.62],
          [
            c.x - rx * 1.2,
            c.y - h * 0.45,
            c.x - rx * 0.1,
            c.y - h * 0.62,
            c.x + rx * 1.0,
            c.y - h * 0.74,
          ],
          [
            c.x - rx * 1.2,
            c.y - h * 0.18,
            c.x + rx * 0.2,
            c.y - h * 0.34,
            c.x + rx * 1.2,
            c.y - h * 0.4,
          ],
        ],
        0.5,
      );
      strands(
        ctx,
        shade(color, 0.3),
        0.35,
        [
          [
            c.x - rx * 1.1,
            c.y - h * 0.36,
            c.x - rx * 0.1,
            c.y - h * 0.55,
            c.x + rx * 0.9,
            c.y - h * 0.66,
          ],
        ],
        0.45,
      );
      ctx.restore();
      return;
    }
    case 'band': {
      ctx.fillStyle = clothFill(ctx, color, c.x - rx, c.y - h * 0.26, c.x + rx, c.y - h * 0.14);
      ctx.beginPath();
      ctx.moveTo(c.x - rx * 1.05, c.y - h * 0.16);
      ctx.quadraticCurveTo(c.x, c.y - h * 0.3, c.x + rx * 1.05, c.y - h * 0.16);
      ctx.lineTo(c.x + rx * 1.02, c.y - h * 0.06);
      ctx.quadraticCurveTo(c.x, c.y - h * 0.19, c.x - rx * 1.02, c.y - h * 0.06);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'scarf':
    case 'veil':
    case 'hood': {
      // Cloth over the head, framing the face and draped over the shoulders.
      const veil = d.headwear !== 'scarf';
      const sy = c.y + h * 0.98;
      const reach = veil ? h * 1.08 : h * 0.78;
      const drop = veil ? h * 0.55 : h * 0.22;
      ctx.fillStyle = clothFill(ctx, color, c.x - reach, c.y - h * 0.6, c.x + reach, sy + drop);
      ctx.beginPath();
      ctx.moveTo(c.x - reach * 0.78, sy + drop);
      ctx.quadraticCurveTo(c.x - reach * 1.06, sy + drop * 0.3, c.x - reach, sy);
      ctx.bezierCurveTo(
        c.x - rx * 1.55,
        c.y + h * 0.3,
        c.x - rx * 1.32,
        c.y - h * 0.7,
        c.x,
        c.y - h * 0.68,
      );
      ctx.bezierCurveTo(
        c.x + rx * 1.32,
        c.y - h * 0.7,
        c.x + rx * 1.55,
        c.y + h * 0.3,
        c.x + reach,
        sy,
      );
      ctx.quadraticCurveTo(c.x + reach * 1.06, sy + drop * 0.3, c.x + reach * 0.78, sy + drop);
      ctx.quadraticCurveTo(c.x + rx * 1.2, sy + drop * 0.2, c.x + rx * 0.95, c.y + h * 0.62);
      // Face opening.
      ctx.bezierCurveTo(
        c.x + rx * 1.06,
        c.y + h * 0.12,
        c.x + rx * 1.0,
        c.y - h * 0.42,
        c.x,
        c.y - h * 0.43,
      );
      ctx.bezierCurveTo(
        c.x - rx * 1.0,
        c.y - h * 0.42,
        c.x - rx * 1.06,
        c.y + h * 0.12,
        c.x - rx * 0.95,
        c.y + h * 0.62,
      );
      ctx.quadraticCurveTo(c.x - rx * 1.2, sy + drop * 0.2, c.x - reach * 0.78, sy + drop);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      strands(
        ctx,
        shade(color, -0.45),
        0.4,
        [
          [
            c.x - rx * 1.25,
            c.y - h * 0.2,
            c.x - rx * 1.4,
            c.y + h * 0.5,
            c.x - reach * 0.9,
            sy + drop,
          ],
          [
            c.x + rx * 1.25,
            c.y - h * 0.2,
            c.x + rx * 1.4,
            c.y + h * 0.5,
            c.x + reach * 0.9,
            sy + drop,
          ],
          [
            c.x - reach * 0.6,
            sy - h * 0.1,
            c.x - reach * 0.75,
            sy + drop * 0.5,
            c.x - reach * 0.65,
            sy + drop,
          ],
          [
            c.x + reach * 0.62,
            sy - h * 0.1,
            c.x + reach * 0.78,
            sy + drop * 0.5,
            c.x + reach * 0.7,
            sy + drop,
          ],
          [c.x - rx * 0.6, c.y - h * 0.62, c.x, c.y - h * 0.52, c.x + rx * 0.6, c.y - h * 0.62],
        ],
        0.5,
      );
      // The shadow side of the drape.
      const g = ctx.createLinearGradient(c.x, 0, c.x + reach, 0);
      g.addColorStop(0, rgba(shade(color, -0.5), 0));
      g.addColorStop(1, rgba(shade(color, -0.5), 0.35));
      ctx.fillStyle = g;
      ctx.fillRect(c.x, c.y - h, reach * 1.2, h * 3);
      ctx.restore();
      // Soft shadow the cloth casts on the brow.
      ctx.fillStyle = rgba(d.skinShadow, 0.35);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - h * 0.34, rx * 0.85, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    default:
      return;
  }
}

function bandageFront(ctx: Ctx, d: Dress, c: Pt, h: number): void {
  if (!d.bandage) return;
  const rx = h * 0.37;
  ctx.fillStyle = d.bandage;
  ctx.beginPath();
  ctx.moveTo(c.x - rx * 1.04, c.y - h * 0.2);
  ctx.quadraticCurveTo(c.x, c.y - h * 0.34, c.x + rx * 1.04, c.y - h * 0.2);
  ctx.lineTo(c.x + rx * 1.02, c.y - h * 0.09);
  ctx.quadraticCurveTo(c.x, c.y - h * 0.22, c.x - rx * 1.02, c.y - h * 0.09);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(shade(d.bandage, -0.35), 0.6);
  ctx.lineWidth = 0.3;
  ctx.stroke();
  // Knot and a frayed end at the side.
  ellipse(ctx, c.x - rx * 1.05, c.y - h * 0.15, 0.9, 0.8, shade(d.bandage, -0.1));
  ctx.strokeStyle = d.bandage;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(c.x - rx * 1.05, c.y - h * 0.12);
  ctx.lineTo(c.x - rx * 1.25, c.y + h * 0.08);
  ctx.stroke();
}

export function headFront(ctx: Ctx, d: Dress, r: Rig): void {
  const c = r.head;
  const h = r.build.head;
  // Neck.
  ctx.fillStyle = d.skinShadow;
  ctx.beginPath();
  ctx.ellipse(r.neck.x, r.neck.y, h * 0.2, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  faceFront(ctx, d, r, c, h);
  if (d.beard) beardFront(ctx, d, r, c, h);
  if (d.headwear === 'none' || d.headwear === 'band') hairFront(ctx, d, c, h);
  else if (d.headwear === 'wrap') hairFront(ctx, d, { x: c.x, y: c.y + h * 0.04 }, h);
  bandageFront(ctx, d, c, h);
  headwearFront(ctx, d, c, h);
}

// ── Profile ──────────────────────────────────────────────────────────────
function headShapeSide(ctx: Ctx, c: Pt, h: number, f: number): void {
  const rx = h * 0.42;
  const X = (u: number): number => c.x + u * f;
  ctx.beginPath();
  ctx.moveTo(X(0), c.y - h * 0.5);
  ctx.bezierCurveTo(
    X(rx * 0.7),
    c.y - h * 0.5,
    X(rx * 0.95),
    c.y - h * 0.3,
    X(rx * 0.92),
    c.y - h * 0.08,
  );
  // Brow, nose, lips, chin.
  ctx.lineTo(X(rx * 1.02), c.y + h * 0.02);
  ctx.lineTo(X(rx * 1.14), c.y + h * 0.17);
  ctx.lineTo(X(rx * 0.98), c.y + h * 0.21);
  ctx.lineTo(X(rx * 1.02), c.y + h * 0.3);
  ctx.quadraticCurveTo(X(rx * 1.0), c.y + h * 0.46, X(rx * 0.72), c.y + h * 0.48);
  ctx.quadraticCurveTo(X(rx * 0.2), c.y + h * 0.48, X(-rx * 0.35), c.y + h * 0.3);
  ctx.bezierCurveTo(
    X(-rx * 1.0),
    c.y + h * 0.18,
    X(-rx * 1.08),
    c.y - h * 0.3,
    X(0),
    c.y - h * 0.5,
  );
  ctx.closePath();
}

export function headSide(ctx: Ctx, d: Dress, r: Rig): void {
  const c = r.head;
  const h = r.build.head;
  const f = r.dir === 'left' ? -1 : 1;
  const rx = h * 0.42;
  const X = (u: number): number => c.x + u * f;
  ctx.fillStyle = d.skinShadow;
  ctx.beginPath();
  ctx.ellipse(r.neck.x - f * 0.6, r.neck.y, h * 0.19, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinFill(ctx, d, { x: X(rx * 0.2), y: c.y }, h);
  headShapeSide(ctx, c, h, f);
  ctx.fill();
  // Ear.
  if (d.headwear === 'none' || d.headwear === 'band' || d.headwear === 'wrap')
    ellipse(ctx, X(-rx * 0.12), c.y + h * 0.05, h * 0.08, h * 0.13, d.skinShadow);
  // Eye, brow, mouth.
  const ey = c.y + h * 0.02;
  if (r.eyesClosed) {
    ctx.strokeStyle = rgba(shade(d.skinShadow, -0.3), 0.8);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(X(rx * 0.55), ey);
    ctx.lineTo(X(rx * 0.8), ey + 0.2);
    ctx.stroke();
  } else {
    ellipse(ctx, X(rx * 0.72), ey, h * 0.05, h * 0.042, EYE);
  }
  ctx.strokeStyle = rgba(d.brow, 0.75);
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(X(rx * 0.55), ey - h * 0.11);
  ctx.lineTo(X(rx * 0.95), ey - h * 0.1);
  ctx.stroke();
  if (r.mouth > 0.05)
    ellipse(ctx, X(rx * 0.92), c.y + h * 0.3, h * 0.05, h * 0.04 * r.mouth + 0.2, '#3a1610');
  else {
    ctx.strokeStyle = mix(d.skin, '#4a1a12', 0.6);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(X(rx * 0.8), c.y + h * 0.29);
    ctx.lineTo(X(rx * 1.0), c.y + h * 0.28);
    ctx.stroke();
  }
  // Cheek shade toward the back of the head.
  ctx.save();
  headShapeSide(ctx, c, h, f);
  ctx.clip();
  const g = ctx.createLinearGradient(X(rx * 0.5), 0, X(-rx), 0);
  g.addColorStop(0, rgba(d.skinShadow, 0));
  g.addColorStop(1, rgba(d.skinShadow, 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(c.x - rx * 1.2, c.y - h * 0.5, rx * 2.4, h);
  ctx.restore();

  if (d.beard) {
    ctx.fillStyle = hairFill(ctx, d.beardColor, c, h);
    ctx.beginPath();
    ctx.moveTo(X(-rx * 0.2), c.y + h * 0.06);
    ctx.quadraticCurveTo(X(rx * 0.3), c.y + h * 0.25, X(rx * 0.78), c.y + h * 0.26);
    ctx.lineTo(X(rx * 1.0), c.y + h * 0.26);
    ctx.quadraticCurveTo(X(rx * 1.12), c.y + h * 0.56, X(rx * 0.7), c.y + h * 0.62);
    ctx.quadraticCurveTo(X(rx * 0.1), c.y + h * 0.6, X(-rx * 0.35), c.y + h * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  if (d.headwear === 'none' || d.headwear === 'band' || d.headwear === 'wrap') {
    ctx.fillStyle = hairFill(ctx, d.hair, c, h);
    ctx.beginPath();
    ctx.moveTo(X(rx * 0.78), c.y - h * 0.3);
    ctx.bezierCurveTo(
      X(rx * 0.6),
      c.y - h * 0.62,
      X(-rx * 1.2),
      c.y - h * 0.55,
      X(-rx * 1.02),
      c.y - h * 0.02,
    );
    ctx.quadraticCurveTo(X(-rx * 0.9), c.y + h * 0.3, X(-rx * 0.45), c.y + h * 0.32);
    ctx.lineTo(X(-rx * 0.02), c.y + h * 0.16);
    ctx.quadraticCurveTo(X(rx * 0.05), c.y - h * 0.12, X(rx * 0.4), c.y - h * 0.18);
    ctx.closePath();
    ctx.fill();
  }
  if (d.bandage) {
    ctx.fillStyle = d.bandage;
    ctx.beginPath();
    ctx.moveTo(X(rx * 0.95), c.y - h * 0.26);
    ctx.lineTo(X(-rx * 1.02), c.y - h * 0.16);
    ctx.lineTo(X(-rx * 1.02), c.y - h * 0.05);
    ctx.lineTo(X(rx * 0.97), c.y - h * 0.14);
    ctx.closePath();
    ctx.fill();
  }
  const color = d.headColor;
  if (d.headwear === 'wrap') {
    ctx.fillStyle = clothFill(ctx, color, c.x - rx, c.y - h * 0.7, c.x + rx, c.y - h * 0.1);
    ctx.beginPath();
    ctx.moveTo(X(rx * 1.0), c.y - h * 0.18);
    ctx.bezierCurveTo(
      X(rx * 1.2),
      c.y - h * 0.7,
      X(-rx * 0.8),
      c.y - h * 0.86,
      X(-rx * 1.15),
      c.y - h * 0.32,
    );
    ctx.quadraticCurveTo(X(-rx * 1.2), c.y - h * 0.06, X(-rx * 0.8), c.y - h * 0.02);
    ctx.quadraticCurveTo(X(0), c.y - h * 0.24, X(rx * 1.0), c.y - h * 0.18);
    ctx.closePath();
    ctx.fill();
    strands(
      ctx,
      shade(color, -0.35),
      0.45,
      [
        [X(rx * 1.05), c.y - h * 0.34, X(0), c.y - h * 0.5, X(-rx * 1.1), c.y - h * 0.28],
        [X(rx * 0.9), c.y - h * 0.52, X(-rx * 0.1), c.y - h * 0.7, X(-rx * 1.0), c.y - h * 0.46],
      ],
      0.5,
    );
  } else if (d.headwear === 'band') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(X(rx * 0.95), c.y - h * 0.26);
    ctx.lineTo(X(-rx * 1.02), c.y - h * 0.18);
    ctx.lineTo(X(-rx * 1.02), c.y - h * 0.08);
    ctx.lineTo(X(rx * 0.97), c.y - h * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (d.headwear !== 'none') {
    const fall = d.headwear === 'scarf' ? h * 0.8 : h * 1.1;
    ctx.fillStyle = clothFill(ctx, color, c.x - rx, c.y - h * 0.6, c.x + rx, c.y + fall);
    ctx.beginPath();
    ctx.moveTo(X(rx * 0.95), c.y - h * 0.08);
    ctx.bezierCurveTo(
      X(rx * 1.1),
      c.y - h * 0.62,
      X(-rx * 0.6),
      c.y - h * 0.72,
      X(-rx * 1.2),
      c.y - h * 0.1,
    );
    ctx.quadraticCurveTo(X(-rx * 1.5), c.y + fall * 0.6, X(-rx * 1.35), c.y + fall);
    ctx.lineTo(X(-rx * 0.1), c.y + fall);
    ctx.quadraticCurveTo(X(rx * 0.1), c.y + h * 0.4, X(rx * 0.25), c.y + h * 0.1);
    ctx.quadraticCurveTo(X(rx * 0.45), c.y - h * 0.3, X(rx * 0.95), c.y - h * 0.08);
    ctx.closePath();
    ctx.fill();
    strands(
      ctx,
      shade(color, -0.4),
      0.4,
      [
        [X(-rx * 0.5), c.y - h * 0.3, X(-rx * 0.8), c.y + h * 0.4, X(-rx * 0.7), c.y + fall],
        [X(rx * 0.2), c.y - h * 0.4, X(-rx * 0.2), c.y + h * 0.2, X(-rx * 0.2), c.y + fall],
      ],
      0.5,
    );
  }
}

// ── Back ─────────────────────────────────────────────────────────────────
export function headBack(ctx: Ctx, d: Dress, r: Rig): void {
  const c = r.head;
  const h = r.build.head;
  const rx = h * 0.37;
  ctx.fillStyle = d.skinShadow;
  ctx.beginPath();
  ctx.ellipse(r.neck.x, r.neck.y, h * 0.2, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (d.headwear === 'none' || d.headwear === 'band' || d.headwear === 'wrap') {
    for (const s of [-1, 1])
      ellipse(ctx, c.x + s * rx * 0.98, c.y + h * 0.04, h * 0.07, h * 0.12, d.skinShadow);
    ctx.fillStyle = hairFill(ctx, d.hair, c, h);
    headShapeFront(ctx, c, h);
    ctx.fill();
    ctx.save();
    headShapeFront(ctx, c, h);
    ctx.clip();
    const lines: Array<[number, number, number, number, number, number]> = [];
    for (let i = -4; i <= 4; i++)
      lines.push([c.x + i * 0.3, c.y - h * 0.5, c.x + i * 0.9, c.y, c.x + i * 1.1, c.y + h * 0.45]);
    strands(ctx, shade(d.hair, 0.35), 0.28, lines);
    ctx.restore();
  }
  if (d.bandage) {
    ctx.fillStyle = d.bandage;
    ctx.fillRect(c.x - rx * 1.02, c.y - h * 0.2, rx * 2.04, h * 0.1);
  }
  const color = d.headColor;
  if (d.headwear === 'wrap') {
    ctx.fillStyle = clothFill(ctx, color, c.x - rx, c.y - h * 0.7, c.x + rx, c.y - h * 0.1);
    ctx.beginPath();
    ctx.moveTo(c.x - rx * 1.12, c.y - h * 0.08);
    ctx.bezierCurveTo(
      c.x - rx * 1.3,
      c.y - h * 0.62,
      c.x - rx * 0.4,
      c.y - h * 0.78,
      c.x,
      c.y - h * 0.74,
    );
    ctx.bezierCurveTo(
      c.x + rx * 0.4,
      c.y - h * 0.78,
      c.x + rx * 1.3,
      c.y - h * 0.62,
      c.x + rx * 1.12,
      c.y - h * 0.08,
    );
    ctx.quadraticCurveTo(c.x, c.y + h * 0.02, c.x - rx * 1.12, c.y - h * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    strands(
      ctx,
      shade(color, -0.38),
      0.45,
      [
        [c.x - rx * 1.2, c.y - h * 0.5, c.x, c.y - h * 0.3, c.x + rx * 1.2, c.y - h * 0.46],
        [c.x - rx * 1.2, c.y - h * 0.26, c.x, c.y - h * 0.12, c.x + rx * 1.2, c.y - h * 0.22],
        [
          c.x - rx * 1.0,
          c.y - h * 0.66,
          c.x + rx * 0.2,
          c.y - h * 0.5,
          c.x + rx * 1.1,
          c.y - h * 0.66,
        ],
      ],
      0.5,
    );
    ctx.restore();
  } else if (d.headwear === 'band') {
    ctx.fillStyle = color;
    ctx.fillRect(c.x - rx * 1.02, c.y - h * 0.24, rx * 2.04, h * 0.11);
  } else if (d.headwear !== 'none') {
    const veil = d.headwear !== 'scarf';
    const fall = veil ? h * 2.1 : h * 1.05;
    const wide = veil ? r.build.shoulder * 0.5 + 1 : rx * 1.5;
    ctx.fillStyle = clothFill(ctx, color, c.x - wide, c.y - h * 0.6, c.x + wide, c.y + fall);
    ctx.beginPath();
    ctx.moveTo(c.x - wide * 0.9, c.y + fall);
    ctx.quadraticCurveTo(c.x - wide * 1.08, c.y + h * 0.9, c.x - wide, c.y + h * 0.75);
    ctx.bezierCurveTo(
      c.x - rx * 1.6,
      c.y + h * 0.2,
      c.x - rx * 1.3,
      c.y - h * 0.7,
      c.x,
      c.y - h * 0.68,
    );
    ctx.bezierCurveTo(
      c.x + rx * 1.3,
      c.y - h * 0.7,
      c.x + rx * 1.6,
      c.y + h * 0.2,
      c.x + wide,
      c.y + h * 0.75,
    );
    ctx.quadraticCurveTo(c.x + wide * 1.08, c.y + h * 0.9, c.x + wide * 0.9, c.y + fall);
    ctx.quadraticCurveTo(c.x, c.y + fall + 1.4, c.x - wide * 0.9, c.y + fall);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    const lines: Array<[number, number, number, number, number, number]> = [];
    for (const k of [-0.7, -0.35, 0, 0.35, 0.7]) {
      lines.push([
        c.x + k * rx,
        c.y - h * 0.3,
        c.x + k * wide * 0.9,
        c.y + h * 0.6,
        c.x + k * wide * 0.95,
        c.y + fall,
      ]);
    }
    strands(ctx, shade(color, -0.42), 0.38, lines, 0.55);
    const g = ctx.createLinearGradient(c.x, 0, c.x + wide, 0);
    g.addColorStop(0, rgba(shade(color, -0.5), 0));
    g.addColorStop(1, rgba(shade(color, -0.5), 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(c.x, c.y - h, wide * 1.2, fall + h * 2);
    ctx.restore();
  }
}

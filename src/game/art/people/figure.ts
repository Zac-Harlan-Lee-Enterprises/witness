import { ellipse, rgba, shade, type Ctx } from '../paint';
import type { Dress } from './dress';
import { headBack, headFront, headSide, headwearBack } from './head';
import { torsoFrame, type TorsoFrame } from './frame';
import { paintCarry } from './gear';
import { type Pt, type Rig } from './rig';

/**
 * A standing or walking person, painted from its rig: sandalled feet, a
 * belted tunic with folds that follow the legs, sleeves and hands, head and
 * covering, and whatever they carry. Light comes from the upper left, so
 * every form is lit on its left and shaded on its right. There is no ink
 * outline; the sheet adds a faint shadow-side rim for separation.
 */
const SANDAL = '#4a3020';
const STRAP = '#6b4a2e';

/** A tapered limb between two joints, lit from the upper left. */
export function limb(ctx: Ctx, a: Pt, b: Pt, ra: number, rb: number, color: string): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  // The side whose normal points up-left is lit.
  const lit = nx * -0.7 + ny * -0.7 > 0 ? 1 : -1;
  const g = ctx.createLinearGradient(
    a.x + nx * ra * lit,
    a.y + ny * ra * lit,
    a.x - nx * ra * lit,
    a.y - ny * ra * lit,
  );
  g.addColorStop(0, shade(color, 0.14));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fill();
}

function clothGradient(ctx: Ctx, color: string, x0: number, x1: number, y: number) {
  const g = ctx.createLinearGradient(x0, y, x1, y);
  g.addColorStop(0, shade(color, 0.16));
  g.addColorStop(0.42, color);
  g.addColorStop(1, shade(color, -0.32));
  return g;
}

function stroke(ctx: Ctx, color: string, width: number, pts: Pt[], close = false): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (close) ctx.closePath();
  ctx.stroke();
}

function curve(ctx: Ctx, color: string, width: number, a: Pt, c: Pt, b: Pt): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
  ctx.stroke();
}

// ── Legs and feet ────────────────────────────────────────────────────────
function shinRadius(d: Dress): [number, number] {
  return d.build === 'child' ? [1.35, 1.0] : [1.6, 1.15];
}

function footFront(ctx: Ctx, d: Dress, f: Rig['feet'][number], away: boolean): void {
  const y = f.y + 1.2;
  ellipse(ctx, f.x, y + 0.35, 1.9, 1.15, SANDAL);
  if (!away) {
    ellipse(ctx, f.x, y - 0.15, 1.45, 1.0, d.skin);
    ellipse(ctx, f.x + 0.35, y + 0.15, 1.0, 0.6, rgba(d.skinShadow, 0.6));
    ctx.strokeStyle = STRAP;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(f.x - 1.3, y - 0.3);
    ctx.lineTo(f.x + 1.3, y - 0.1);
    ctx.stroke();
  } else {
    // Heels seen from behind.
    ellipse(ctx, f.x, y - 0.5, 1.2, 1.0, d.skinShadow);
  }
}

function footSide(ctx: Ctx, d: Dress, f: Rig['feet'][number], flip: number): void {
  const tilt = f.lift > 0.5 ? -0.35 * flip : 0;
  ctx.save();
  ctx.translate(f.x, f.y + 1.1);
  ctx.rotate(tilt);
  ctx.fillStyle = SANDAL;
  ctx.beginPath();
  ctx.ellipse(flip * 1.5, 0.6, 3.1, 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  ctx.moveTo(-flip * 1.1, -1.2);
  ctx.quadraticCurveTo(flip * 1.0, -1.6, flip * 3.9, -0.1);
  ctx.lineTo(flip * 3.9, 0.3);
  ctx.lineTo(-flip * 1.3, 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = STRAP;
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(flip * 0.3, -1.3);
  ctx.lineTo(flip * 1.1, 0.3);
  ctx.stroke();
  ctx.restore();
}

function ankleBandage(ctx: Ctx, d: Dress, f: Pt): void {
  if (!d.bandage) return;
  ctx.fillStyle = d.bandage;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - 0.6, 1.9, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(shade(d.bandage, -0.35), 0.6);
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(f.x - 1.7, f.y - 1.2);
  ctx.lineTo(f.x + 1.7, f.y - 0.2);
  ctx.stroke();
}

// ── The tunic ────────────────────────────────────────────────────────────
/** Hem points from screen-left to screen-right, torn on one side if needed. */
function hemPoints(d: Dress, t: TorsoFrame, r: Rig, sign: number): Pt[] {
  const [s0, s1] = r.legSwing;
  const left = { x: t.cx - t.hemHalf - Math.abs(s0) * 0.35, y: t.hem + s0 * 0.9 * sign };
  const right = { x: t.cx + t.hemHalf + Math.abs(s1) * 0.35, y: t.hem + s1 * 0.9 * sign };
  const mid = { x: t.cx, y: t.hem + 1.2 + ((s0 + s1) / 2) * 0.6 * sign };
  if (!d.tornHem) return [left, mid, right];
  // A strip torn from the left of the hem: shorter, with a ragged edge.
  const pts: Pt[] = [{ x: left.x + 0.3, y: left.y - 2.2 }];
  const n = 6;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const x = left.x + (mid.x - left.x) * k;
    pts.push({ x, y: left.y - 2.2 + (mid.y - left.y) * k * 0.4 + (i % 2 ? 0.7 : -0.3) });
  }
  pts.push({ x: mid.x, y: mid.y - 0.6 }, mid, right);
  return pts;
}

function tunicFront(ctx: Ctx, d: Dress, r: Rig, back: boolean): void {
  const t = torsoFrame(d, r);
  const sign = back ? -1 : 1;
  const [sl, sr] = r.shoulders;
  const hem = hemPoints(d, t, r, sign);
  const first = hem[0] as Pt;
  const last = hem[hem.length - 1] as Pt;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(sl.x - 0.6, sl.y + 1.6);
    ctx.quadraticCurveTo(sl.x - 0.3, sl.y - 0.7, sl.x + 2.4, t.top - 1.1);
    if (back) ctx.quadraticCurveTo(t.cx, t.top - 1.6, sr.x - 2.4, t.top - 1.1);
    else {
      ctx.lineTo(t.cx - 1.9, t.top - 1.1);
      ctx.quadraticCurveTo(t.cx, t.top + 1.3, t.cx + 1.9, t.top - 1.1);
      ctx.lineTo(sr.x - 2.4, t.top - 1.1);
    }
    ctx.quadraticCurveTo(sr.x + 0.3, sr.y - 0.7, sr.x + 0.6, sr.y + 1.6);
    ctx.quadraticCurveTo(
      t.cx + t.shoulder * 0.95,
      (t.top + t.waist) / 2,
      t.cx + t.waistHalf,
      t.waist,
    );
    ctx.quadraticCurveTo(t.cx + t.waistHalf + 0.9, (t.waist + t.hem) / 2, last.x, last.y);
    for (let i = hem.length - 2; i >= 0; i--) {
      const p = hem[i] as Pt;
      if (hem.length === 3 && i === 1) {
        ctx.quadraticCurveTo(p.x, p.y, first.x, first.y);
        break;
      }
      ctx.lineTo(p.x, p.y);
    }
    ctx.quadraticCurveTo(
      t.cx - t.waistHalf - 0.9,
      (t.waist + t.hem) / 2,
      t.cx - t.waistHalf,
      t.waist,
    );
    ctx.quadraticCurveTo(t.cx - t.shoulder * 0.95, (t.top + t.waist) / 2, sl.x - 0.6, sl.y + 1.6);
    ctx.closePath();
  };
  ctx.fillStyle = clothGradient(ctx, d.tunic, t.cx - t.hemHalf, t.cx + t.hemHalf, t.waist);
  path();
  ctx.fill();

  ctx.save();
  path();
  ctx.clip();
  // Darker toward the hem (less light reaches it) and under the belt.
  const v = ctx.createLinearGradient(0, t.waist, 0, t.hem + 2);
  v.addColorStop(0, rgba(shade(d.tunic, -0.5), 0));
  v.addColorStop(1, rgba(shade(d.tunic, -0.5), 0.3));
  ctx.fillStyle = v;
  ctx.fillRect(t.cx - t.hemHalf - 3, t.waist, t.hemHalf * 2 + 6, t.hem - t.waist + 3);
  ctx.fillStyle = rgba(shade(d.tunic, -0.55), 0.3);
  ctx.fillRect(t.cx - t.hemHalf, t.waist + 0.6, t.hemHalf * 2, 1.5);
  // Coloured stripes (clavi) from shoulder to hem.
  ctx.fillStyle = rgba(d.stripe, 0.8);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(t.cx + s * 2.2, t.top - 1.2);
    ctx.lineTo(t.cx + s * 3.2, t.top - 1.2);
    ctx.lineTo(t.cx + s * 3.9, t.hem + 2);
    ctx.lineTo(t.cx + s * 2.8, t.hem + 2);
    ctx.closePath();
    ctx.fill();
  }
  // Folds: the skirt falls from the belt and follows the legs.
  const [l0, l1] = r.legSwing;
  const dark = rgba(shade(d.tunic, -0.55), 0.32);
  const light = rgba(shade(d.tunic, 0.35), 0.18);
  for (let i = -2; i <= 2; i++) {
    const pull = (i < 0 ? l0 : i > 0 ? l1 : (l0 + l1) / 2) * sign;
    const a = { x: t.cx + i * 1.5, y: t.waist + 1.8 };
    const b = { x: t.cx + i * t.hemHalf * 0.4 + pull * 0.4, y: t.hem + 0.8 + pull * 0.6 };
    const c = { x: (a.x + b.x) / 2 + i * 0.3, y: (a.y + b.y) / 2 };
    curve(ctx, dark, 0.55, a, c, b);
    curve(
      ctx,
      light,
      0.45,
      { x: a.x - 0.6, y: a.y },
      { x: c.x - 0.6, y: c.y },
      { x: b.x - 0.6, y: b.y },
    );
  }
  // Chest folds toward the belt.
  curve(
    ctx,
    dark,
    0.45,
    { x: sl.x + 2, y: t.top + 1 },
    { x: t.cx - 1.5, y: t.waist - 3 },
    { x: t.cx - 0.5, y: t.waist - 0.6 },
  );
  curve(
    ctx,
    dark,
    0.45,
    { x: sr.x - 2, y: t.top + 1 },
    { x: t.cx + 1.8, y: t.waist - 3 },
    { x: t.cx + 0.8, y: t.waist - 0.6 },
  );
  ctx.restore();
  // Hem edge.
  stroke(ctx, rgba(shade(d.tunic, -0.5), 0.55), 0.5, hem);

  // Belt (a woven sash) with its knot at the front.
  const bw = t.waistHalf + 0.25;
  ctx.fillStyle = clothGradient(ctx, d.belt, t.cx - bw, t.cx + bw, t.waist);
  ctx.beginPath();
  ctx.moveTo(t.cx - bw, t.waist - 0.9);
  ctx.quadraticCurveTo(t.cx, t.waist - 0.3 * sign, t.cx + bw, t.waist - 0.9);
  ctx.lineTo(t.cx + bw, t.waist + 0.8);
  ctx.quadraticCurveTo(t.cx, t.waist + 1.4 * sign, t.cx - bw, t.waist + 0.8);
  ctx.closePath();
  ctx.fill();
  if (!back) {
    ellipse(ctx, t.cx - 1.6, t.waist + 0.3, 1.0, 0.8, shade(d.belt, -0.15));
    ctx.fillStyle = shade(d.belt, -0.08);
    ctx.beginPath();
    ctx.moveTo(t.cx - 2.1, t.waist + 0.8);
    ctx.lineTo(t.cx - 2.6, t.waist + 5.2);
    ctx.lineTo(t.cx - 1.7, t.waist + 5.4);
    ctx.lineTo(t.cx - 1.3, t.waist + 0.9);
    ctx.closePath();
    ctx.fill();
  }
}

function mantleFront(ctx: Ctx, d: Dress, r: Rig, back: boolean): void {
  if (!d.mantle) return;
  const t = torsoFrame(d, r);
  const [sl, sr] = r.shoulders;
  // Coarse wool over the shoulders, falling to the knees, open at the front.
  const bottom = t.hem - (r.build.hipY - r.build.kneeY) * 0.25;
  ctx.fillStyle = clothGradient(ctx, d.mantle, sl.x - 2, sr.x + 2, t.waist);
  ctx.beginPath();
  ctx.moveTo(sl.x - 1.4, sl.y + 0.6);
  ctx.quadraticCurveTo(t.cx, t.top - 2.6, sr.x + 1.4, sr.y + 0.6);
  ctx.quadraticCurveTo(sr.x + 2.6, t.waist, t.cx + t.hemHalf + 0.6, bottom);
  if (back) ctx.quadraticCurveTo(t.cx, bottom + 1.4, t.cx - t.hemHalf - 0.6, bottom);
  else {
    ctx.lineTo(t.cx + 2.6, bottom - 0.4);
    ctx.quadraticCurveTo(t.cx + 1.9, t.waist, t.cx + 1.6, t.top + 1.2);
    ctx.lineTo(t.cx - 1.6, t.top + 1.2);
    ctx.quadraticCurveTo(t.cx - 1.9, t.waist, t.cx - 2.6, bottom - 0.4);
    ctx.lineTo(t.cx - t.hemHalf - 0.6, bottom);
  }
  ctx.quadraticCurveTo(sl.x - 2.6, t.waist, sl.x - 1.4, sl.y + 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Woven stripes of a shepherd's mantle.
  ctx.fillStyle = rgba(shade(d.mantle, -0.35), 0.35);
  for (let x = sl.x - 3; x < sr.x + 3; x += 2.6)
    ctx.fillRect(x, t.top - 3, 0.9, bottom - t.top + 4);
  ctx.restore();
}

function cloakWrapFront(ctx: Ctx, d: Dress, r: Rig): void {
  if (!d.cloak) return;
  const t = torsoFrame(d, r);
  const [sl, sr] = r.shoulders;
  // The borrowed cloak around the shoulders, open at the front.
  const bottom = t.waist + 5;
  ctx.fillStyle = clothGradient(ctx, d.cloak, sl.x - 3, sr.x + 3, t.waist);
  ctx.beginPath();
  ctx.moveTo(sl.x - 2, sl.y + 0.4);
  ctx.quadraticCurveTo(t.cx, t.top - 3, sr.x + 2, sr.y + 0.4);
  ctx.quadraticCurveTo(sr.x + 3.2, t.waist, sr.x + 1.2, bottom);
  ctx.lineTo(t.cx + 2.2, bottom - 1);
  ctx.quadraticCurveTo(t.cx + 1.6, t.waist - 3, t.cx + 1.4, t.top + 0.8);
  ctx.lineTo(t.cx - 1.4, t.top + 0.8);
  ctx.quadraticCurveTo(t.cx - 1.6, t.waist - 3, t.cx - 2.2, bottom - 1);
  ctx.lineTo(sl.x - 1.2, bottom);
  ctx.quadraticCurveTo(sl.x - 3.2, t.waist, sl.x - 2, sl.y + 0.4);
  ctx.closePath();
  ctx.fill();
  const fold = rgba(shade(d.cloak, -0.55), 0.4);
  curve(
    ctx,
    fold,
    0.6,
    { x: sl.x, y: sl.y + 2 },
    { x: sl.x - 1, y: t.waist },
    { x: sl.x + 0.4, y: bottom - 0.5 },
  );
  curve(
    ctx,
    fold,
    0.6,
    { x: sr.x, y: sr.y + 2 },
    { x: sr.x + 1, y: t.waist },
    { x: sr.x - 0.4, y: bottom - 0.5 },
  );
}

// ── Arms ─────────────────────────────────────────────────────────────────
function armRadii(d: Dress): { upper: [number, number]; fore: [number, number]; hand: number } {
  return d.build === 'child'
    ? { upper: [1.6, 1.35], fore: [1.1, 0.9], hand: 1.15 }
    : { upper: [1.95, 1.6], fore: [1.3, 1.05], hand: 1.35 };
}

function arm(ctx: Ctx, d: Dress, r: Rig, i: 0 | 1, dim = 0): void {
  const s = r.shoulders[i];
  const e = r.elbows[i];
  const h = r.hands[i];
  const k = armRadii(d);
  const sleeve = dim ? shade(d.tunic, dim) : d.tunic;
  const skin = dim ? shade(d.skin, dim) : d.skin;
  // Sleeve to just below the elbow, then the forearm.
  const cuff = { x: e.x + (h.x - e.x) * 0.2, y: e.y + (h.y - e.y) * 0.2 };
  limb(ctx, e, h, k.fore[0], k.fore[1], skin);
  limb(ctx, { x: s.x, y: s.y + 0.8 }, cuff, k.upper[0], k.upper[1], sleeve);
  const gesturing = r.gesture === i;
  ellipse(
    ctx,
    h.x,
    h.y + 0.3,
    k.hand * (gesturing ? 1.15 : 1),
    k.hand * (gesturing ? 0.9 : 1.05),
    skin,
  );
  ellipse(ctx, h.x + 0.35, h.y + 0.6, k.hand * 0.6, k.hand * 0.5, rgba(d.skinShadow, 0.55));
}

// ── Views ────────────────────────────────────────────────────────────────
function paintFront(ctx: Ctx, d: Dress, r: Rig): void {
  const [sr0, sr1] = shinRadius(d);
  headwearBack(ctx, d, r);
  paintCarry(ctx, d, r, 'behind');
  // Legs: the one further from the camera first.
  const order = r.feet[0].y <= r.feet[1].y ? [0, 1] : [1, 0];
  for (const i of order as Array<0 | 1>) {
    limb(ctx, r.knees[i], r.feet[i], sr0, sr1, d.skin);
    if (i === 0) ankleBandage(ctx, d, r.feet[i]);
    footFront(ctx, d, r.feet[i], false);
  }
  tunicFront(ctx, d, r, false);
  mantleFront(ctx, d, r, false);
  paintCarry(ctx, d, r, 'body');
  arm(ctx, d, r, 0);
  arm(ctx, d, r, 1);
  cloakWrapFront(ctx, d, r);
  headFront(ctx, d, r);
  paintCarry(ctx, d, r, 'front');
}

function paintBackView(ctx: Ctx, d: Dress, r: Rig): void {
  const [sr0, sr1] = shinRadius(d);
  paintCarry(ctx, d, r, 'behind');
  const order = r.feet[0].y >= r.feet[1].y ? [0, 1] : [1, 0];
  for (const i of order as Array<0 | 1>) {
    limb(ctx, r.knees[i], r.feet[i], sr0, sr1, d.skinShadow);
    if (i === 1) ankleBandage(ctx, d, r.feet[i]);
    footFront(ctx, d, r.feet[i], true);
  }
  tunicFront(ctx, d, r, true);
  mantleFront(ctx, d, r, true);
  paintCarry(ctx, d, r, 'body');
  arm(ctx, d, r, 0);
  arm(ctx, d, r, 1);
  cloakWrapFront(ctx, d, r);
  headwearBack(ctx, d, r);
  headBack(ctx, d, r);
  paintCarry(ctx, d, r, 'front');
}

function tunicSide(ctx: Ctx, d: Dress, r: Rig): void {
  const f = r.dir === 'left' ? -1 : 1;
  const t = torsoFrame(d, r);
  const cx = t.cx;
  const kneeFront = Math.max(r.knees[0].x * f, r.knees[1].x * f, (cx + 2) * f) * f;
  const kneeBack = Math.min(r.knees[0].x * f, r.knees[1].x * f, (cx - 1) * f) * f;
  const front = kneeFront + f * 2.3;
  const backX = kneeBack - f * 2.6;
  const depth = r.build.shoulder * 0.27;
  const shoulderY = r.shoulders[1].y;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - f * depth * 0.9, shoulderY + 0.6);
    ctx.quadraticCurveTo(cx, shoulderY - 1.6, cx + f * depth * 0.8, shoulderY + 0.5);
    ctx.quadraticCurveTo(
      cx + f * depth * 1.25,
      (shoulderY + t.waist) / 2,
      cx + f * depth * 0.95,
      t.waist,
    );
    ctx.quadraticCurveTo(cx + f * depth * 1.2, (t.waist + t.hem) / 2, front, t.hem + 0.4);
    ctx.quadraticCurveTo((front + backX) / 2, t.hem + 1.3, backX, t.hem + 0.2);
    ctx.quadraticCurveTo(
      cx - f * depth * 1.15,
      (t.waist + t.hem) / 2,
      cx - f * depth * 0.9,
      t.waist,
    );
    ctx.quadraticCurveTo(
      cx - f * depth * 1.25,
      (shoulderY + t.waist) / 2,
      cx - f * depth * 0.9,
      shoulderY + 0.6,
    );
    ctx.closePath();
  };
  const x0 = Math.min(front, backX);
  const x1 = Math.max(front, backX);
  ctx.fillStyle = clothGradient(ctx, d.tunic, x0, x1, t.waist);
  path();
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  const v = ctx.createLinearGradient(0, t.waist, 0, t.hem + 2);
  v.addColorStop(0, rgba(shade(d.tunic, -0.5), 0));
  v.addColorStop(1, rgba(shade(d.tunic, -0.5), 0.3));
  ctx.fillStyle = v;
  ctx.fillRect(x0 - 2, t.waist, x1 - x0 + 4, t.hem - t.waist + 3);
  ctx.fillStyle = rgba(d.stripe, 0.8);
  ctx.beginPath();
  ctx.moveTo(cx + f * 0.6, shoulderY - 0.5);
  ctx.lineTo(cx + f * 1.7, shoulderY - 0.5);
  ctx.lineTo(cx + f * 2.6 + (front - cx) * 0.25, t.hem + 2);
  ctx.lineTo(cx + f * 1.5 + (front - cx) * 0.25, t.hem + 2);
  ctx.closePath();
  ctx.fill();
  const dark = rgba(shade(d.tunic, -0.55), 0.32);
  for (const k of [0.2, 0.5, 0.8]) {
    const hx = backX + (front - backX) * k;
    curve(
      ctx,
      dark,
      0.55,
      { x: cx + (k - 0.5) * 3, y: t.waist + 1.6 },
      { x: (cx + hx) / 2, y: (t.waist + t.hem) / 2 },
      { x: hx, y: t.hem + 0.8 },
    );
  }
  if (d.tornHem) {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(backX - 1, t.hem - 2);
    for (let i = 0; i <= 6; i++) {
      ctx.lineTo(backX + ((front - backX) * i) / 12, t.hem - 1.8 + (i % 2 ? 0.8 : -0.2));
    }
    ctx.lineTo(backX + (front - backX) / 2, t.hem + 3);
    ctx.lineTo(backX - 1, t.hem + 3);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // Belt across the side.
  ctx.fillStyle = shade(d.belt, -0.05);
  ctx.fillRect(Math.min(cx - f * depth, cx + f * depth) - 0.3, t.waist - 0.9, depth * 2 + 0.6, 1.8);
  if (d.mantle) {
    ctx.fillStyle = clothGradient(ctx, d.mantle, x0, x1, t.waist);
    ctx.beginPath();
    ctx.moveTo(cx - f * depth * 1.3, shoulderY - 0.4);
    ctx.quadraticCurveTo(cx + f * depth, shoulderY - 1.6, cx + f * depth * 1.2, shoulderY + 3);
    ctx.lineTo(cx + f * depth * 0.4, t.hem - 4);
    ctx.lineTo(backX - f * 0.6, t.hem - 3);
    ctx.quadraticCurveTo(cx - f * depth * 1.6, t.waist, cx - f * depth * 1.3, shoulderY - 0.4);
    ctx.closePath();
    ctx.fill();
  }
  if (d.cloak) {
    ctx.fillStyle = clothGradient(ctx, d.cloak, x0, x1, t.waist);
    ctx.beginPath();
    ctx.moveTo(cx - f * depth * 1.4, shoulderY - 0.6);
    ctx.quadraticCurveTo(cx + f * depth, shoulderY - 2, cx + f * depth * 1.4, shoulderY + 2.4);
    ctx.lineTo(cx + f * depth * 1.2, t.waist + 6);
    ctx.lineTo(cx - f * depth * 1.5, t.waist + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function paintSide(ctx: Ctx, d: Dress, r: Rig): void {
  const f = r.dir === 'left' ? -1 : 1;
  const [sr0, sr1] = shinRadius(d);
  paintCarry(ctx, d, r, 'behind');
  // Far arm and far leg, a little darker.
  arm(ctx, d, r, 0, -0.2);
  limb(ctx, r.knees[0], r.feet[0], sr0, sr1, shade(d.skin, -0.18));
  footSide(ctx, { ...d, skin: shade(d.skin, -0.15) }, r.feet[0], f);
  limb(ctx, r.knees[1], r.feet[1], sr0, sr1, d.skin);
  ankleBandage(ctx, d, r.feet[1]);
  footSide(ctx, d, r.feet[1], f);
  headwearBack(ctx, d, r);
  tunicSide(ctx, d, r);
  paintCarry(ctx, d, r, 'body');
  arm(ctx, d, r, 1);
  headSide(ctx, d, r);
  paintCarry(ctx, d, r, 'front');
}

export function paintStanding(ctx: Ctx, d: Dress, r: Rig): void {
  if (r.dir === 'down') paintFront(ctx, d, r);
  else if (r.dir === 'up') paintBackView(ctx, d, r);
  else paintSide(ctx, d, r);
}

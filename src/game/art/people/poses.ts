import type { Direction } from '@/domain/state/game-state';
import { ellipse, rgba, shade, type Ctx } from '../paint';
import type { Dress } from './dress';
import { limb, paintStanding } from './figure';
import { torsoFrame } from './frame';
import { headwearBack } from './head';
import { rigFor, seatDrop, type Pt, type Rig } from './rig';

/**
 * People at rest: sitting cross-legged (someone recovering at the inn, a
 * feverish child on his mat) and lying down (the injured traveler in the
 * shade). Frames: 0 rest, 1 breath, 2 talking.
 *
 * Origin: the ground point under the middle of the body.
 */
export const POSE_FRAMES = 3;

function withRig(r: Rig, change: Partial<Rig>): Rig {
  return { ...r, ...change };
}

function clipAbove(ctx: Ctx, y: number, paint: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-60, -120, 120, 120 + y);
  ctx.clip();
  paint();
  ctx.restore();
}

function sandal(ctx: Ctx, d: Dress, at: Pt): void {
  ellipse(ctx, at.x, at.y + 0.4, 1.8, 1.1, '#4a3020');
  ellipse(ctx, at.x, at.y, 1.35, 0.95, d.skin);
}

// ── Sitting ──────────────────────────────────────────────────────────────
export function paintSitting(ctx: Ctx, d: Dress, dir: Direction, frame: number): void {
  const breathing = frame === 1;
  const talking = frame === 2;
  const base = rigFor(d.build, dir, {
    walk: null,
    breath: breathing,
    blink: false,
    talk: talking ? 1 : 0,
  });
  const b = base.build;
  const drop = seatDrop(b);
  const lift = (p: Pt): Pt => ({ x: p.x, y: p.y + drop });
  const side = dir === 'left' || dir === 'right';
  const f = dir === 'left' ? -1 : 1;
  const knee = b.hip * 0.72;
  const t0 = torsoFrame(d, base);
  const waist = t0.waist + drop;

  // Upper body from the standing rig, lowered onto the ground.
  const r = withRig(base, {
    shoulders: [lift(base.shoulders[0]), lift(base.shoulders[1])],
    hips: [lift(base.hips[0]), lift(base.hips[1])],
    neck: lift(base.neck),
    head: lift(base.head),
    bob: base.bob + drop,
  });
  const hands: [Pt, Pt] = side
    ? [
        { x: f * knee * 0.8, y: -3.6 },
        { x: f * (knee * 0.95 + (talking ? 2.4 : 0)), y: talking ? -9 : -3.2 },
      ]
    : [
        { x: -knee + 0.8, y: -2.6 },
        { x: knee - 0.8 - (talking ? 1.6 : 0), y: talking ? -8 : -2.6 },
      ];
  const elbows: [Pt, Pt] = [0, 1].map((i) => {
    const s = r.shoulders[i as 0 | 1];
    const h = hands[i as 0 | 1];
    return { x: (s.x + h.x) / 2 + (side ? 0 : (i === 0 ? -1 : 1) * 1.6), y: (s.y + h.y) / 2 + 1.5 };
  }) as [Pt, Pt];
  const rr = withRig(r, { hands, elbows });

  if (!side) {
    const away = dir === 'up';
    if (!away) headwearBack(ctx, d, rr);
    // Folded legs: knees out to the sides, shins crossed in front.
    const lap = d.tunic;
    const g = ctx.createLinearGradient(-knee - 2, 0, knee + 2, 0);
    g.addColorStop(0, shade(lap, 0.14));
    g.addColorStop(1, shade(lap, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-t0.waistHalf, waist + 1);
    ctx.quadraticCurveTo(-knee - 3, waist + 2, -knee - 1.6, -1.2);
    ctx.quadraticCurveTo(0, 1.6, knee + 1.6, -1.2);
    ctx.quadraticCurveTo(knee + 3, waist + 2, t0.waistHalf, waist + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(shade(lap, -0.55), 0.3);
    ctx.lineWidth = 0.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1.5, waist + 2);
      ctx.quadraticCurveTo(s * knee * 0.5, -3, s * knee, -1.5);
      ctx.stroke();
    }
    if (!away) {
      limb(ctx, { x: -knee + 1, y: -0.8 }, { x: 2.2, y: 0.4 }, 1.4, 1.1, d.skin);
      limb(ctx, { x: knee - 1, y: -0.4 }, { x: -2.2, y: 0.9 }, 1.4, 1.1, shade(d.skin, -0.06));
      sandal(ctx, d, { x: 2.8, y: 0.6 });
      sandal(ctx, d, { x: -2.8, y: 1.1 });
      if (d.bandage) ellipse(ctx, -2, 0.6, 1.9, 1.3, d.bandage);
    }
    clipAbove(ctx, waist + 2.5, () => paintStanding(ctx, { ...d, carry: 'none' }, rr));
    return;
  }

  // Seen from the side: knees forward in a low mound, back upright.
  const lap = d.tunic;
  ctx.fillStyle = shade(lap, -0.05);
  ctx.beginPath();
  ctx.moveTo(-f * t0.waistHalf * 0.8, waist + 1);
  ctx.quadraticCurveTo(f * knee * 1.4, waist - 1, f * (knee + 3), -2.2);
  ctx.quadraticCurveTo(f * (knee + 2), 0.8, -f * 3, 0.8);
  ctx.quadraticCurveTo(-f * t0.waistHalf, 0.4, -f * t0.waistHalf * 0.8, waist + 1);
  ctx.closePath();
  ctx.fill();
  sandal(ctx, d, { x: f * (knee + 1.5), y: 0.2 });
  if (d.bandage) ellipse(ctx, f * (knee + 0.6), -0.4, 1.8, 1.3, d.bandage);
  clipAbove(ctx, waist + 2.5, () => paintStanding(ctx, { ...d, carry: 'none' }, rr));
}

// ── Lying ────────────────────────────────────────────────────────────────
/**
 * Lying on the back, seen from above at the game's angle: a front-view
 * figure turned on its side and foreshortened, head toward `dir`.
 */
export function paintLying(ctx: Ctx, d: Dress, dir: Direction, frame: number): void {
  const f = dir === 'left' ? -1 : 1;
  const base = rigFor(d.build, 'down', {
    walk: null,
    breath: frame === 1,
    blink: frame !== 2,
    talk: frame === 2 ? 1 : 0,
  });
  const b = base.build;
  // One knee drawn up (the hurt ankle), one arm across the chest.
  const knees: [Pt, Pt] = [
    { x: base.knees[0].x - 0.6, y: base.knees[0].y },
    { x: base.knees[1].x + 1.6, y: base.knees[1].y + 2.4 },
  ];
  const feet: Rig['feet'] = [
    { ...base.feet[0], x: base.feet[0].x - 1.2 },
    { ...base.feet[1], x: base.feet[1].x + 2.6, y: base.feet[1].y - 3.2, lift: 0 },
  ];
  const t = torsoFrame(d, base);
  const hands: [Pt, Pt] = [
    { x: base.hands[0].x - 0.6, y: base.hands[0].y },
    { x: t.cx - 1.5, y: t.waist - 4 },
  ];
  const elbows: [Pt, Pt] = [base.elbows[0], { x: base.shoulders[1].x + 1.6, y: t.waist - 1 }];
  const rr = withRig(base, {
    knees,
    feet,
    hands,
    elbows,
    head: { ...base.head, y: base.head.y + (frame === 2 ? -0.6 : 0) },
  });

  const lay = (paint: () => void): void => {
    ctx.save();
    // Lay the figure down: head toward `dir`, body foreshortened by the view angle.
    ctx.translate(0, -4.2);
    ctx.scale(1, 0.74);
    ctx.rotate((f * Math.PI) / 2);
    ctx.translate(0, b.height / 2 - 1);
    paint();
    ctx.restore();
  };
  const dress = {
    ...d,
    carry: 'none' as const,
    headwear: d.headwear === 'veil' ? ('scarf' as const) : d.headwear,
  };
  // The body's side, seen below its top: a darker copy shifted down.
  ctx.save();
  ctx.translate(0, 2.2);
  lay(() =>
    paintStanding(
      ctx,
      {
        ...dress,
        tunic: shade(d.tunic, -0.4),
        skin: shade(d.skin, -0.35),
        skinShadow: shade(d.skinShadow, -0.3),
        stripe: shade(d.stripe, -0.4),
        cloak: d.cloak ? shade(d.cloak, -0.4) : null,
      },
      rr,
    ),
  );
  ctx.restore();
  lay(() => {
    paintStanding(ctx, dress, rr);
    if (!d.cloak) return;
    // The borrowed cloak laid over him like a blanket, spilling onto the ground.
    const w = b.shoulder * 0.78;
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, shade(d.cloak, 0.16));
    g.addColorStop(0.5, d.cloak);
    g.addColorStop(1, shade(d.cloak, -0.34));
    ctx.fillStyle = g;
    const top = rr.shoulders[0].y + 1.6;
    const bottom = -b.kneeY + 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.8, top);
    ctx.quadraticCurveTo(0, top - 1.4, w * 0.8, top);
    ctx.quadraticCurveTo(w * 1.1, (top + bottom) / 2, w, bottom);
    ctx.quadraticCurveTo(0, bottom + 2.4, -w, bottom);
    ctx.quadraticCurveTo(-w * 1.1, (top + bottom) / 2, -w * 0.8, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(shade(d.cloak, -0.55), 0.4);
    ctx.lineWidth = 0.6;
    for (const k of [-0.6, -0.1, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(k * w, top + 2);
      ctx.quadraticCurveTo(k * w * 1.3, (top + bottom) / 2, k * w * 1.1, bottom + 1);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(shade(d.cloak, 0.3), 0.3);
    ctx.beginPath();
    ctx.moveTo(-w * 0.75, top + 0.4);
    ctx.quadraticCurveTo(0, top - 0.8, w * 0.75, top + 0.4);
    ctx.stroke();
  });
}

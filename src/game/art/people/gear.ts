import { ellipse, mix, rgba, shade, type Ctx } from '../paint';
import type { Dress } from './dress';
import { torsoFrame } from './frame';
import { rightHandIndex, type Pt, type Rig } from './rig';

/**
 * Things people carry and wear over their clothes: a shepherd's staff, a
 * basket, an oil jar, a baker's tray, a spindle, a traveller's bundle, and
 * the player's satchel, water skin, lamp and rolled cloak. Each is drawn in
 * the layer where it belongs for the view:
 *   behind — hidden by the body (drawn first)
 *   body   — over the tunic, under the arms
 *   front  — over everything
 */
export type CarryLayer = 'behind' | 'body' | 'front';

type Item =
  | 'staff'
  | 'basket'
  | 'jar'
  | 'bundle'
  | 'bread'
  | 'spindle'
  | 'satchel'
  | 'water-skin'
  | 'lamp'
  | 'cloak-roll';

const WOOD = '#7a5634';
const LEATHER = '#6e4a2c';
const STRAW = '#b08c56';
const CLAY = '#b2714a';

export function itemsOf(d: Dress): Item[] {
  const items: Item[] = [];
  if (d.carry !== 'none') items.push(d.carry);
  if (d.gear.waterSkin) items.push('water-skin');
  if (d.gear.lamp) items.push('lamp');
  if (d.gear.cloakRoll) items.push('cloak-roll');
  return items;
}

/** Which side of the body an item hangs on, as a hand index for this view. */
function sideIndex(item: Item, r: Rig): 0 | 1 {
  const right = rightHandIndex(r.dir);
  const left: 0 | 1 = right === 0 ? 1 : 0;
  switch (item) {
    case 'staff':
    case 'spindle':
    case 'bread':
    case 'water-skin':
      return right;
    default:
      return left;
  }
}

/** The layer each item is drawn in, for this view. */
export function layerOf(item: Item, r: Rig): CarryLayer {
  const side = r.dir === 'left' || r.dir === 'right';
  const onBack = item === 'bundle' || item === 'cloak-roll';
  if (onBack) return r.dir === 'up' ? 'front' : 'behind';
  const near = side ? sideIndex(item, r) === 1 : true;
  if (!near) return 'behind';
  if (r.dir === 'up') {
    // Seen from behind, things held in front are hidden; hip bags still show.
    return item === 'satchel' || item === 'water-skin' ? 'body' : 'behind';
  }
  if (item === 'spindle' || item === 'bread') return 'front';
  return 'body';
}

export function paintCarry(ctx: Ctx, d: Dress, r: Rig, layer: CarryLayer): void {
  for (const item of itemsOf(d)) {
    if (layer === 'body') strapFor(ctx, d, r, item);
    if (layerOf(item, r) !== layer) continue;
    PAINT[item](ctx, d, r);
  }
}

// ── Straps across the body ───────────────────────────────────────────────
function strapFor(ctx: Ctx, d: Dress, r: Rig, item: Item): void {
  if (item !== 'satchel' && item !== 'water-skin' && item !== 'bundle' && item !== 'cloak-roll')
    return;
  const t = torsoFrame(d, r);
  const side = r.dir === 'left' || r.dir === 'right';
  const color = item === 'cloak-roll' ? '#5a3c26' : shade(LEATHER, item === 'bundle' ? 0.25 : 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  if (side) {
    const f = r.dir === 'left' ? -1 : 1;
    const s = r.shoulders[1];
    ctx.moveTo(s.x - f * 1.6, s.y - 0.3);
    ctx.quadraticCurveTo(s.x + f * 0.4, (s.y + t.waist) / 2, s.x - f * 0.6, t.waist + 2.5);
  } else {
    // Across the chest from one shoulder to the opposite hip.
    const fromRight = item === 'satchel' || item === 'bundle';
    const rightScreen = rightHandIndex(r.dir);
    const shoulderIdx = fromRight ? rightScreen : rightScreen === 0 ? 1 : 0;
    const s = r.shoulders[shoulderIdx];
    const dir = s.x < t.cx ? 1 : -1;
    const toX = t.cx + dir * (t.waistHalf + 0.6);
    const toY = item === 'bundle' || item === 'cloak-roll' ? t.waist - 1 : t.waist + 2.4;
    ctx.moveTo(s.x + dir * 0.8, s.y - 0.2);
    ctx.quadraticCurveTo(t.cx, (s.y + toY) / 2 + 1.2, toX, toY);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(color, 0.35), 0.5);
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

// ── Items ────────────────────────────────────────────────────────────────
function hipPoint(d: Dress, r: Rig, item: Item): Pt {
  const t = torsoFrame(d, r);
  const i = sideIndex(item, r);
  const side = r.dir === 'left' || r.dir === 'right';
  if (side) {
    const f = r.dir === 'left' ? -1 : 1;
    const depth = r.build.shoulder * 0.27;
    return { x: t.cx - f * depth * 0.2 + (i === 1 ? f * 0.6 : -f * 0.6), y: t.waist + 3.4 };
  }
  const out = r.shoulders[i].x < t.cx ? -1 : 1;
  return { x: t.cx + out * (t.waistHalf + 0.8), y: t.waist + 3.4 };
}

function staff(ctx: Ctx, _d: Dress, r: Rig): void {
  const h = r.hands[rightHandIndex(r.dir)];
  const side = r.dir === 'left' || r.dir === 'right';
  const f = r.dir === 'left' ? -1 : 1;
  const len = r.build.height * 1.02;
  const bottom = { x: h.x + (side ? f * 1.4 : -0.6), y: 0.4 };
  const top = { x: h.x + (side ? -f * 1.2 : 0.4), y: bottom.y - len };
  const g = ctx.createLinearGradient(top.x - 1, 0, top.x + 1, 0);
  g.addColorStop(0, shade(WOOD, 0.2));
  g.addColorStop(1, shade(WOOD, -0.35));
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bottom.x, bottom.y);
  ctx.lineTo(top.x, top.y + 3);
  // A shepherd's crook.
  ctx.quadraticCurveTo(top.x, top.y - 1.6, top.x + 2.4 * (side ? f : 1), top.y - 0.8);
  ctx.quadraticCurveTo(
    top.x + 3.6 * (side ? f : 1),
    top.y,
    top.x + 3.2 * (side ? f : 1),
    top.y + 1.6,
  );
  ctx.stroke();
  // Worn grip and a knot.
  ellipse(
    ctx,
    top.x + (bottom.x - top.x) * 0.55,
    top.y + (bottom.y - top.y) * 0.55,
    0.9,
    0.6,
    shade(WOOD, -0.3),
  );
}

function basket(ctx: Ctx, _d: Dress, r: Rig): void {
  const h = r.hands[sideIndex('basket', r)];
  const x = h.x;
  const y = h.y - 0.6;
  const w = 7.2;
  const top = y - 2.4;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(STRAW, 0.15));
  g.addColorStop(1, shade(STRAW, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x + w / 2, top);
  ctx.quadraticCurveTo(x + w * 0.45, y + 2.8, x, y + 3);
  ctx.quadraticCurveTo(x - w * 0.45, y + 2.8, x - w / 2, top);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(shade(STRAW, -0.45), 0.55);
  ctx.lineWidth = 0.3;
  for (let yy = top + 0.9; yy < y + 3; yy += 1.1) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yy);
    ctx.quadraticCurveTo(x, yy + 0.6, x + w / 2, yy);
    ctx.stroke();
  }
  ctx.restore();
  // Contents: herbs and fruit, then the rim.
  ellipse(ctx, x, top, w / 2, 1.1, shade(STRAW, -0.4));
  const fruit = ['#5b6e3a', '#6c7d45', '#5e3a4a', '#7b8a4c'];
  fruit.forEach((c, i) => ellipse(ctx, x - 2.2 + i * 1.5, top - 0.4 + (i % 2) * 0.3, 1.0, 0.8, c));
  ctx.strokeStyle = shade(STRAW, 0.1);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(x, top, w / 2, 1.1, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function jar(ctx: Ctx, _d: Dress, r: Rig): void {
  const h = r.hands[sideIndex('jar', r)];
  const x = h.x;
  const base = h.y + 2.4;
  const hgt = 9.5;
  const w = 3.3;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, shade(CLAY, 0.18));
  g.addColorStop(0.45, CLAY);
  g.addColorStop(1, shade(CLAY, -0.38));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 1.1, base - hgt);
  ctx.lineTo(x + 1.1, base - hgt);
  ctx.quadraticCurveTo(x + 1.2, base - hgt + 1.6, x + w, base - hgt * 0.6);
  ctx.quadraticCurveTo(x + w * 1.1, base - 2, x + 0.8, base);
  ctx.lineTo(x - 0.8, base);
  ctx.quadraticCurveTo(x - w * 1.1, base - 2, x - w, base - hgt * 0.6);
  ctx.quadraticCurveTo(x - 1.2, base - hgt + 1.6, x - 1.1, base - hgt);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, x, base - hgt, 1.3, 0.45, shade(CLAY, -0.45));
  // Handles, a painted band and dust.
  ctx.strokeStyle = shade(CLAY, -0.2);
  ctx.lineWidth = 0.55;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 1.1, base - hgt + 1.2);
    ctx.quadraticCurveTo(x + s * 2.6, base - hgt + 1.2, x + s * 2.4, base - hgt * 0.62);
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#5a2e1a', 0.35);
  ctx.fillRect(x - w + 0.2, base - hgt * 0.5, w * 2 - 0.4, 0.6);
  ctx.fillStyle = rgba('#d8c4a0', 0.25);
  ctx.fillRect(x - w, base - 1.6, w * 2, 1.6);
}

function bread(ctx: Ctx, _d: Dress, r: Rig): void {
  const h = r.hands[sideIndex('bread', r)];
  const x = h.x;
  const y = h.y - 0.4;
  ellipse(ctx, x, y + 0.5, 5, 1.8, shade(STRAW, -0.35));
  ellipse(ctx, x, y, 4.8, 1.6, STRAW);
  for (let i = 0; i < 4; i++) {
    const lx = x - 2.8 + i * 1.9;
    const ly = y - 0.5 - (i % 2) * 0.4;
    ellipse(ctx, lx, ly, 1.3, 0.95, '#a8743e');
    ellipse(ctx, lx - 0.3, ly - 0.3, 0.7, 0.45, '#c99a5e');
  }
}

function spindle(ctx: Ctx, _d: Dress, r: Rig): void {
  const h = r.hands[sideIndex('spindle', r)];
  ctx.strokeStyle = '#e8dfcc';
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(h.x, h.y);
  ctx.lineTo(h.x + 0.2, h.y + 3.4);
  ctx.stroke();
  ctx.strokeStyle = WOOD;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(h.x + 0.2, h.y + 3.2);
  ctx.lineTo(h.x + 0.3, h.y + 7.4);
  ctx.stroke();
  ellipse(ctx, h.x + 0.28, h.y + 6.6, 1.2, 0.5, shade(CLAY, -0.1));
  ellipse(ctx, h.x + 0.2, h.y + 3.6, 0.7, 0.9, '#ddd3be');
}

function bundle(ctx: Ctx, d: Dress, r: Rig): void {
  const t = torsoFrame(d, r);
  const side = r.dir === 'left' || r.dir === 'right';
  const f = r.dir === 'left' ? -1 : 1;
  const cloth = '#8a7a5c';
  const cx = side ? t.cx - f * (r.build.shoulder * 0.27 + 2.6) : t.cx + (r.dir === 'up' ? 0 : 1.5);
  const cy = t.top + 5;
  const w = side ? 5 : 6.4;
  const g = ctx.createLinearGradient(cx - w, cy - 6, cx + w, cy + 6);
  g.addColorStop(0, shade(cloth, 0.15));
  g.addColorStop(1, shade(cloth, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, 7, side ? f * 0.15 : 0, 0, Math.PI * 2);
  ctx.fill();
  // The knot at the top.
  ellipse(ctx, cx, cy - 6.6, 1.6, 1.1, shade(cloth, -0.2));
  ctx.strokeStyle = rgba(shade(cloth, -0.5), 0.4);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.7, cy - 3);
  ctx.quadraticCurveTo(cx, cy + 1, cx + w * 0.6, cy + 4);
  ctx.stroke();
}

function satchel(ctx: Ctx, d: Dress, r: Rig): void {
  const p = hipPoint(d, r, 'satchel');
  const w = 5.2;
  const h = 4.6;
  const g = ctx.createLinearGradient(p.x - w / 2, p.y, p.x + w / 2, p.y + h);
  g.addColorStop(0, shade(LEATHER, 0.15));
  g.addColorStop(1, shade(LEATHER, -0.4));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y - h / 2);
  ctx.lineTo(p.x + w / 2, p.y - h / 2);
  ctx.quadraticCurveTo(p.x + w / 2 + 0.3, p.y + h / 2, p.x + w / 2 - 0.8, p.y + h / 2);
  ctx.lineTo(p.x - w / 2 + 0.8, p.y + h / 2);
  ctx.quadraticCurveTo(p.x - w / 2 - 0.3, p.y + h / 2, p.x - w / 2, p.y - h / 2);
  ctx.closePath();
  ctx.fill();
  // Flap and stitching.
  ctx.fillStyle = shade(LEATHER, -0.15);
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y - h / 2);
  ctx.lineTo(p.x + w / 2, p.y - h / 2);
  ctx.lineTo(p.x + w / 2 - 0.4, p.y + 0.2);
  ctx.quadraticCurveTo(p.x, p.y + 1, p.x - w / 2 + 0.4, p.y + 0.2);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, p.x, p.y + 0.4, 0.45, 0.45, '#c9a66a');
}

function waterSkin(ctx: Ctx, d: Dress, r: Rig): void {
  const p = hipPoint(d, r, 'water-skin');
  const skin = '#5b3b24';
  const g = ctx.createRadialGradient(p.x - 1, p.y - 0.5, 0.3, p.x, p.y + 1, 4.2);
  g.addColorStop(0, shade(skin, 0.3));
  g.addColorStop(1, shade(skin, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(p.x - 0.6, p.y - 3.4);
  ctx.quadraticCurveTo(p.x - 3.2, p.y - 1, p.x - 2.6, p.y + 2.4);
  ctx.quadraticCurveTo(p.x, p.y + 4.2, p.x + 2.6, p.y + 2.2);
  ctx.quadraticCurveTo(p.x + 3, p.y - 1, p.x + 0.6, p.y - 3.4);
  ctx.closePath();
  ctx.fill();
  // Tied neck and a highlight on the leather.
  ellipse(ctx, p.x, p.y - 3.6, 0.8, 0.5, '#3a2616');
  ellipse(ctx, p.x - 1.2, p.y + 0.2, 0.7, 1.4, rgba('#e6c9a0', 0.18));
}

function lamp(ctx: Ctx, d: Dress, r: Rig): void {
  const t = torsoFrame(d, r);
  const side = r.dir === 'left' || r.dir === 'right';
  const f = r.dir === 'left' ? -1 : 1;
  const x = side ? t.cx + f * 2.2 : t.cx + (r.dir === 'up' ? -2.6 : 2.6);
  const y = t.waist + 2.6;
  ctx.strokeStyle = '#4a3322';
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(x, t.waist + 0.6);
  ctx.lineTo(x, y - 0.6);
  ctx.stroke();
  ellipse(ctx, x, y, 1.5, 0.85, CLAY);
  ellipse(ctx, x + 1.4, y + 0.1, 0.6, 0.4, shade(CLAY, -0.1));
  ellipse(ctx, x - 0.2, y - 0.25, 0.45, 0.25, '#3a2014');
}

function cloakRoll(ctx: Ctx, d: Dress, r: Rig): void {
  const t = torsoFrame(d, r);
  const side = r.dir === 'left' || r.dir === 'right';
  const f = r.dir === 'left' ? -1 : 1;
  const cloth = mix('#7a4a34', '#8a6a50', 0.2);
  const y = t.top + 2.6;
  if (side) {
    const x = t.cx - f * (r.build.shoulder * 0.27 + 1.6);
    ellipse(ctx, x, y, 2.3, 2.3, shade(cloth, -0.1));
    ctx.strokeStyle = rgba(shade(cloth, -0.5), 0.6);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0.5, 5.2);
    ctx.stroke();
    return;
  }
  const half = r.build.shoulder / 2 + 1.8;
  const g = ctx.createLinearGradient(0, y - 2.2, 0, y + 2.2);
  g.addColorStop(0, shade(cloth, 0.2));
  g.addColorStop(1, shade(cloth, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(t.cx - half, y - 2.1);
  ctx.lineTo(t.cx + half, y - 2.1);
  ctx.arc(t.cx + half, y, 2.1, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(t.cx - half, y + 2.1);
  ctx.arc(t.cx - half, y, 2.1, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fill();
  // Ties.
  ctx.fillStyle = '#4a3322';
  for (const s of [-1, 1]) ctx.fillRect(t.cx + s * half * 0.55 - 0.4, y - 2.2, 0.8, 4.4);
}

const PAINT: Record<Item, (ctx: Ctx, d: Dress, r: Rig) => void> = {
  staff,
  basket,
  jar,
  bundle,
  bread,
  spindle,
  satchel,
  'water-skin': waterSkin,
  lamp,
  'cloak-roll': cloakRoll,
};

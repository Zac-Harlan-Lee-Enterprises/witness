import type { TileKind } from '@/domain/world';
import { shadowOffset, type Look } from './direction';
import { ellipse, makeCanvas, rgba, TILE, type Ctx } from './paint';
import { backWallSlots, heightOf, isLowWall, isPropTile, type Site } from './site';

/**
 * Light and shade baked into the ground: one sun from the upper left.
 *
 * Every tall thing draws its shadow shape into a single mask, and the mask
 * is laid down once in the place's shadow colour — so where two shadows
 * overlap they don't stack into mud. Then soft contact shadows where things
 * meet the ground. Indoors: pools of window light, warmth around the hearth,
 * and darker edges so the room feels enclosed.
 */
export function paintShadows(
  ctx: Ctx,
  site: Site,
  look: Look,
  doc: Document,
  which: 'hills' | 'rest',
): void {
  const { grid } = site;
  const mask = makeCanvas(grid.width * TILE, grid.height * TILE, doc);
  const m = mask.ctx;
  if (!m) return;
  m.fillStyle = '#000';
  site.forEach((x, y) => {
    const k = site.kindAt(x, y);
    const h = heightOf(k);
    if (h === 0 || (k === 'hill') !== (which === 'hills')) return;
    const { dx, dy } = shadowOffset(look, h);
    const X = x * TILE;
    const Y = y * TILE;
    castShape(m, k, X + dx, Y + dy, h);
  });
  m.globalCompositeOperation = 'source-in';
  m.fillStyle = look.shadow.color;
  m.fillRect(0, 0, grid.width * TILE, grid.height * TILE);
  ctx.save();
  ctx.globalAlpha = look.shadow.alpha;
  if ('filter' in ctx) ctx.filter = 'blur(1.5px)';
  ctx.drawImage(mask.canvas, 0, 0, grid.width * TILE, grid.height * TILE);
  ctx.restore();
  if (which === 'hills') return;

  // Contact shadows: darkening where walls, cliffs and objects meet the ground.
  const ao = look.occlusion;
  site.forEach((x, y) => {
    const k = site.groundAt(x, y);
    if (heightOf(k) > 0 || k === 'water' || k === 'void') return;
    const X = x * TILE;
    const Y = y * TILE;
    const tallAt = (dx: number, dy: number): boolean => {
      const n = site.kindAt(x + dx, y + dy);
      return n === 'wall' || n === 'roof' || n === 'cliff' || isLowWall(n);
    };
    const c = look.shadow.color;
    if (tallAt(0, -1)) band(ctx, [X, Y], [X, Y + 10], [X, Y, TILE, 10], c, ao * 0.9);
    if (tallAt(-1, 0)) band(ctx, [X, Y], [X + 7, Y], [X, Y, 7, TILE], c, ao * 0.6);
    if (tallAt(1, 0))
      band(ctx, [X + TILE, Y], [X + TILE - 5, Y], [X + TILE - 5, Y, 5, TILE], c, ao * 0.4);
  });
  site.forEach((x, y) => {
    const k = site.kindAt(x, y);
    if (!isPropTile(k) || heightOf(k) === 0) return;
    ellipse(ctx, x * TILE + 16, y * TILE + 27, 12, 4, rgba(look.shadow.color, ao * 0.7));
  });
}

/** A linear fade from (x0,y0) to (x1,y1), filling the rectangle `rect`. */
function band(
  ctx: Ctx,
  from: readonly [number, number],
  to: readonly [number, number],
  rect: readonly [number, number, number, number],
  color: string,
  alpha: number,
): void {
  const g = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
}

/** The shape a thing throws on the ground, already offset down-right. */
function castShape(m: Ctx, kind: TileKind, x: number, y: number, h: number): void {
  switch (kind) {
    case 'wall':
    case 'roof':
    case 'cliff':
    case 'hill':
      m.fillRect(x, y, TILE, TILE);
      return;
    case 'fence':
    case 'sheepfold':
      m.fillRect(x, y + 10, TILE, 12);
      return;
    case 'terrace':
      // A terrace drops toward the viewer: its shadow lies along its foot.
      m.fillRect(x, y + 18, TILE, 10);
      return;
    case 'sheep':
      m.beginPath();
      m.ellipse(x + 16, y + 20, 13, 6, 0.1, 0, Math.PI * 2);
      m.fill();
      return;
    case 'olive':
    case 'fig': {
      m.beginPath();
      m.ellipse(
        x + 16,
        y + 14,
        kind === 'fig' ? 19 : 16,
        kind === 'fig' ? 11 : 9,
        0.2,
        0,
        Math.PI * 2,
      );
      m.fill();
      m.fillRect(x + 13, y + 16, 5, 12);
      return;
    }
    case 'palm': {
      // A star of fronds on a thin trunk.
      for (let i = 0; i < 8; i++) {
        m.beginPath();
        m.ellipse(x + 16, y + 10, 18, 3, (i / 8) * Math.PI, 0, Math.PI * 2);
        m.fill();
      }
      m.fillRect(x + 14, y + 12, 4, 16);
      return;
    }
    case 'tent':
    case 'stall':
    case 'loom':
    case 'cloth':
      m.beginPath();
      m.moveTo(x + 2, y + 28);
      m.lineTo(x + 6, y + 6);
      m.lineTo(x + 30, y + 6);
      m.lineTo(x + 32, y + 28);
      m.closePath();
      m.fill();
      return;
    default:
      if (isPropTile(kind)) {
        m.beginPath();
        m.ellipse(x + 16, y + 24 - h * 0.1, 12, 6 + h * 0.08, 0.3, 0, Math.PI * 2);
        m.fill();
      }
  }
}

/** Indoors: the room is lit by its windows and the hearth; corners fall into shade. */
export function paintInteriorLight(ctx: Ctx, site: Site, look: Look): void {
  const shade = look.shadow.color;
  // Darker toward the walls.
  site.forEach((x, y) => {
    const k = site.groundAt(x, y);
    if (k === 'wall' || k === 'roof' || k === 'void') return;
    const X = x * TILE;
    const Y = y * TILE;
    const wall = (dx: number, dy: number): boolean => site.kindAt(x + dx, y + dy) === 'wall';
    if (wall(0, 1))
      band(ctx, [X, Y + TILE], [X, Y + TILE - 26], [X, Y + TILE - 26, TILE, 26], shade, 0.35);
    if (wall(-1, 0)) band(ctx, [X, Y], [X + 26, Y], [X, Y, 26, TILE], shade, 0.3);
    if (wall(1, 0))
      band(ctx, [X + TILE, Y], [X + TILE - 26, Y], [X + TILE - 26, Y, 26, TILE], shade, 0.3);
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const slot of backWallSlots(site)) {
    if (slot.use !== 'window') continue;
    // A slanting shaft of sunlight falling from a high window onto the floor.
    const wx = slot.x * TILE + 11;
    const wy = (slot.y + 1) * TILE;
    const g = ctx.createLinearGradient(wx, wy, wx + 30, wy + 80);
    g.addColorStop(0, 'rgba(255,226,160,0.2)');
    g.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + 10, wy);
    ctx.lineTo(wx + 46, wy + 84);
    ctx.lineTo(wx + 22, wy + 84);
    ctx.closePath();
    ctx.fill();
    const pool = ctx.createRadialGradient(wx + 30, wy + 62, 2, wx + 30, wy + 62, 26);
    pool.addColorStop(0, 'rgba(255,230,170,0.22)');
    pool.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(wx, wy + 30, 64, 64);
  }
  site.forEach((x, y) => {
    if (site.kindAt(x, y) !== 'oven') return;
    const cx = x * TILE + 16;
    const cy = y * TILE + 24;
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
    glow.addColorStop(0, 'rgba(255,170,80,0.28)');
    glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 70, cy - 70, 140, 140);
  });
  ctx.restore();
}

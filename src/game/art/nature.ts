import type { TileKind } from '@/domain/world';
import type { Look } from './direction';
import { ellipse, hash, lumpy, mix, rgba, rng, shade, speckle, TILE, type Ctx } from './paint';
import type { Site } from './site';

/**
 * The land itself — wilderness hills and red cliffs, water — and growing
 * things: rocks, scrub, reeds, crops and the three trees of the chapter
 * (olive, date palm, sycamore-fig). Trees are split into a trunk (painted
 * on the ground layer) and a canopy (drawn above characters).
 */
const TRUNK = '#6a4f33';
const RED_ROCK = '#b4583c';

export function hillColors(look: Look): { base: string; top: string; face: string } {
  const base = mix(look.ground.sand, '#8f6438', 0.42);
  return { base, top: shade(base, 0.12), face: shade(base, -0.28) };
}

// ── Hills ────────────────────────────────────────────────────────────────
export function paintHills(ctx: Ctx, site: Site, look: Look): void {
  const { base, top } = hillColors(look);
  const hillish = (x: number, y: number): boolean => {
    const k = site.groundAt(x, y);
    return k === 'hill' || k === 'cliff' || k === 'void';
  };
  site.forEach((x, y) => {
    if (site.groundAt(x, y) !== 'hill') return;
    ctx.fillStyle = base;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  });
  site.forEach((x, y) => {
    if (site.groundAt(x, y) !== 'hill') return;
    const X = x * TILE;
    const Y = y * TILE;
    const r = rng(hash(x, y, 23));
    for (let i = 0; i < 3; i++)
      lumpy(
        ctx,
        X + r() * TILE,
        Y + r() * TILE,
        8 + r() * 9,
        r,
        rgba(shade(top, (r() - 0.5) * 0.22), 0.45),
        8,
      );
    speckle(ctx, X, Y, TILE, TILE, r, [shade(base, -0.2), shade(top, 0.2)], 12, 1.1);
    // Erosion contours following the slope.
    ctx.strokeStyle = rgba(shade(base, -0.35), 0.35);
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const cy = Y + 9 + i * 13;
      ctx.beginPath();
      ctx.moveTo(X, cy + Math.sin(X * 0.08 + y) * 2);
      for (let sx = 4; sx <= TILE; sx += 4)
        ctx.lineTo(X + sx, cy + Math.sin((X + sx) * 0.08 + y) * 2);
      ctx.stroke();
    }
    if (r() < 0.5) shrub(ctx, X + 6 + r() * 20, Y + 6 + r() * 20, 3 + r() * 2.5, look, r);
    if (r() < 0.35) stone(ctx, X + 5 + r() * 22, Y + 6 + r() * 20, 2.2 + r() * 2, r);
  });
  site.forEach((x, y) => {
    if (site.groundAt(x, y) === 'hill') hillLedges(ctx, x, y, hillish, look);
  });
}

function shrub(ctx: Ctx, sx: number, sy: number, size: number, look: Look, r: () => number): void {
  lumpy(ctx, sx, sy, size, r, look.foliage.dark, 7);
  lumpy(ctx, sx - size * 0.25, sy - size * 0.3, size * 0.6, r, look.foliage.mid, 6);
  ellipse(
    ctx,
    sx - size * 0.35,
    sy - size * 0.45,
    size * 0.22,
    size * 0.16,
    rgba(look.foliage.light, 0.8),
  );
}

function stone(ctx: Ctx, sx: number, sy: number, size: number, r: () => number): void {
  ellipse(ctx, sx + 1, sy + size * 0.6, size * 1.1, size * 0.5, 'rgba(50,32,15,0.35)');
  lumpy(ctx, sx, sy, size, r, '#bba88a', 6);
  ellipse(ctx, sx - size * 0.3, sy - size * 0.35, size * 0.45, size * 0.3, rgba('#ffffff', 0.35));
}

function hillLedges(
  ctx: Ctx,
  tx: number,
  ty: number,
  hillAt: (x: number, y: number) => boolean,
  look: Look,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 29));
  const { face, top } = hillColors(look);
  const isHill = (dx: number, dy: number): boolean => hillAt(tx + dx, ty + dy);
  const wave = (wx: number): number => Math.sin(wx * 0.19) * 1.5 + Math.sin(wx * 0.07 + 1) * 1.5;
  if (!isHill(0, 1)) {
    // The drop to the road: a band of layered rock.
    const t = Y + TILE - 13;
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.moveTo(X, t + wave(X));
    for (let sx = 2; sx <= TILE; sx += 2) ctx.lineTo(X + sx, t + wave(X + sx));
    ctx.lineTo(X + TILE, Y + TILE);
    ctx.lineTo(X, Y + TILE);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(shade(top, 0.25), 0.9);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(X, t + wave(X));
    for (let sx = 2; sx <= TILE; sx += 2) ctx.lineTo(X + sx, t + wave(X + sx));
    ctx.stroke();
    ctx.strokeStyle = rgba(shade(face, -0.35), 0.55);
    ctx.lineWidth = 0.8;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(X, t + i * 4 + wave(X + 9 * i) * 0.5);
      for (let sx = 3; sx <= TILE; sx += 3)
        ctx.lineTo(X + sx, t + i * 4 + wave(X + sx + 9 * i) * 0.5);
      ctx.stroke();
    }
    if (r() < 0.5) {
      const bx = X + 4 + r() * 24;
      ellipse(ctx, bx + 1, Y + TILE - 0.5, 3.4, 1.4, 'rgba(50,30,12,0.35)');
      lumpy(ctx, bx, Y + TILE - 2.5, 2.6, r, shade(face, 0.25), 6);
    }
  }
  if (!isHill(0, -1)) {
    ctx.strokeStyle = rgba(shade(top, 0.3), 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X, Y + 2 + wave(X) * 0.5);
    for (let sx = 2; sx <= TILE; sx += 2) ctx.lineTo(X + sx, Y + 2 + wave(X + sx) * 0.5);
    ctx.stroke();
  }
  for (const side of [-1, 1] as const) {
    if (isHill(side, 0)) continue;
    const x0 = side === -1 ? X : X + TILE - 7;
    const grad = ctx.createLinearGradient(
      side === -1 ? X : X + TILE,
      0,
      side === -1 ? X + 7 : X + TILE - 7,
      0,
    );
    grad.addColorStop(0, side === -1 ? rgba(shade(top, 0.3), 0.5) : rgba(shade(face, -0.3), 0.5));
    grad.addColorStop(1, rgba(face, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x0, Y, 7, TILE);
  }
}

// ── Cliffs (the red rock of Adummim) ─────────────────────────────────────
export function paintCliffs(ctx: Ctx, site: Site): void {
  site.forEach((x, y) => {
    if (site.kindAt(x, y) !== 'cliff') return;
    const X = x * TILE;
    const Y = y * TILE;
    const r = rng(hash(x, y, 31));
    const at = (dx: number, dy: number): TileKind => site.kindAt(x + dx, y + dy);
    const topEdge = at(0, -1) !== 'cliff';
    const face = at(0, 1) !== 'cliff';
    ctx.fillStyle = RED_ROCK;
    ctx.fillRect(X, Y, TILE, TILE);
    const wave = (wx: number, i: number): number =>
      Math.sin(wx * 0.11 + i * 1.7) * 1.6 + Math.sin(wx * 0.037 + i) * 1.2;
    for (let i = 0; i < 4; i++) {
      const sy = Y + 4 + i * 7;
      ctx.fillStyle = rgba(shade(RED_ROCK, -0.28), 0.55);
      ctx.beginPath();
      ctx.moveTo(X, sy + wave(X, i));
      for (let sx = 0; sx <= TILE; sx += 2) ctx.lineTo(X + sx, sy + wave(X + sx, i));
      for (let sx = TILE; sx >= 0; sx -= 2) ctx.lineTo(X + sx, sy + 2 + wave(X + sx, i) * 0.6);
      ctx.fill();
    }
    for (let i = 0; i < 2; i++)
      lumpy(
        ctx,
        X + r() * TILE,
        Y + r() * TILE,
        6 + r() * 8,
        r,
        rgba(r() > 0.5 ? '#dc8e6c' : '#8a3f2a', 0.3),
        7,
      );
    if (r() < 0.55) {
      ctx.strokeStyle = rgba('#5a2416', 0.6);
      ctx.lineWidth = 0.9;
      const cx = X + 4 + r() * 24;
      ctx.beginPath();
      ctx.moveTo(cx, Y + r() * 8);
      ctx.lineTo(cx + (r() - 0.5) * 4, Y + 12 + r() * 6);
      ctx.lineTo(cx + (r() - 0.5) * 6, Y + 22 + r() * 8);
      ctx.stroke();
    }
    speckle(ctx, X, Y, TILE, TILE, r, ['#e09474', '#7e3a26'], 8, 1.2);
    if (topEdge) {
      // Sunlit brink with a little dry growth.
      ctx.fillStyle = rgba('#f4bf98', 0.75);
      ctx.fillRect(X, Y, TILE, 2.5);
      if (r() < 0.4) ellipse(ctx, X + 6 + r() * 20, Y + 3, 3, 1.6, '#7a7a44');
    }
    if (face) {
      // A sheer face: darker, fluted by runoff, sinking into shadow at its foot.
      ctx.fillStyle = rgba('#5a2416', 0.28);
      ctx.fillRect(X, Y, TILE, TILE);
      ctx.strokeStyle = rgba('#4a1c10', 0.45);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 5; i++) {
        const fx = X + 3 + i * 6.5 + r() * 2;
        ctx.beginPath();
        ctx.moveTo(fx, Y + 2);
        ctx.quadraticCurveTo(fx + (r() - 0.5) * 3, Y + 16, fx + (r() - 0.5) * 2, Y + TILE);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba('#e89a78', 0.35);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        const fx = X + 5 + i * 10 + r() * 2;
        ctx.beginPath();
        ctx.moveTo(fx, Y + 3);
        ctx.lineTo(fx + (r() - 0.5) * 2, Y + 20);
        ctx.stroke();
      }
      const grad = ctx.createLinearGradient(0, Y + 8, 0, Y + TILE);
      grad.addColorStop(0, 'rgba(50,16,10,0)');
      grad.addColorStop(1, 'rgba(50,16,10,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(X, Y + 8, TILE, TILE - 8);
      for (let i = 0; i < 3; i++) stone(ctx, X + 4 + r() * 24, Y + TILE - 3, 1.6 + r() * 1.5, r);
    }
  });
}

// ── Water ────────────────────────────────────────────────────────────────
export function paintWater(ctx: Ctx, site: Site, look: Look): void {
  const deep = look.mood === 'oasis' ? '#1f6f86' : '#2f7690';
  site.forEach((x, y) => {
    if (site.kindAt(x, y) !== 'water') return;
    ctx.fillStyle = deep;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  });
  site.forEach((x, y) => {
    if (site.kindAt(x, y) !== 'water') return;
    const X = x * TILE;
    const Y = y * TILE;
    const r = rng(hash(x, y, 13));
    const at = (dx: number, dy: number): boolean => site.kindAt(x + dx, y + dy) === 'water';
    if (at(0, -1) && at(0, 1) && at(-1, 0) && at(1, 0))
      lumpy(ctx, X + 16, Y + 16, 16, r, rgba(shade(deep, -0.3), 0.5), 8);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      if (at(dx, dy)) continue;
      const x0 = dx === 1 ? X + TILE : X;
      const y0 = dy === 1 ? Y + TILE : Y;
      const grad = ctx.createLinearGradient(x0, y0, x0 - dx * 11, y0 - dy * 11);
      grad.addColorStop(0, rgba('#a6dccf', 0.8));
      grad.addColorStop(1, rgba('#a6dccf', 0));
      ctx.fillStyle = grad;
      ctx.fillRect(
        dx === 1 ? X + TILE - 11 : X,
        dy === 1 ? Y + TILE - 11 : Y,
        dx === 0 ? TILE : 11,
        dy === 0 ? TILE : 11,
      );
      // Wet, darker earth and shore stones.
      for (let i = 0; i < 4; i++) {
        const t = r() * TILE;
        const sx = dy !== 0 ? X + t : dx === 1 ? X + TILE - 2 : X + 2;
        const sy = dx !== 0 ? Y + t : dy === 1 ? Y + TILE - 2 : Y + 2;
        ellipse(ctx, sx, sy, 2.6 + r() * 1.6, 1.8, r() > 0.5 ? '#b8a585' : '#8f7c5e');
      }
    }
    // Reflected sky and ripples.
    ctx.strokeStyle = rgba('#d8f0f2', 0.6);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const wy = Y + 6 + i * 9 + r() * 3;
      const wx = X + 2 + r() * 10;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 5, wy - 2, wx + 11, wy);
      ctx.stroke();
    }
    if (look.mood === 'oasis' && r() < 0.3) {
      // A lily pad.
      ellipse(ctx, X + 8 + r() * 16, Y + 8 + r() * 16, 3.2, 2.4, '#5f8f3a');
    }
  });
}

// ── Growing things and stones (drawn as outlined props, local coords 0–32) ─
export function paintNatureProp(c: Ctx, kind: TileKind, look: Look, seed: number): boolean {
  const r = rng(seed);
  switch (kind) {
    case 'rock': {
      const base = '#b09a78';
      c.fillStyle = base;
      c.beginPath();
      c.moveTo(4, 26);
      c.lineTo(6, 13);
      c.lineTo(15, 7);
      c.lineTo(26, 10);
      c.lineTo(29, 25);
      c.closePath();
      c.fill();
      c.fillStyle = shade(base, 0.24);
      c.beginPath();
      c.moveTo(6, 13);
      c.lineTo(15, 7);
      c.lineTo(18, 15);
      c.lineTo(9, 18);
      c.closePath();
      c.fill();
      c.fillStyle = shade(base, -0.24);
      c.beginPath();
      c.moveTo(18, 15);
      c.lineTo(26, 10);
      c.lineTo(29, 25);
      c.lineTo(17, 26);
      c.closePath();
      c.fill();
      c.strokeStyle = shade(base, -0.4);
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(12 + r() * 4, 20);
      c.lineTo(15, 25);
      c.stroke();
      if (look.mood === 'oasis') ellipse(c, 7, 24, 3, 2, look.foliage.mid);
      return true;
    }
    case 'bush': {
      c.strokeStyle = '#573b22';
      c.lineWidth = 0.9;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(16, 26);
        c.lineTo(4 + r() * 24, 8 + r() * 12);
        c.stroke();
      }
      for (let i = 0; i < 7; i++)
        lumpy(
          c,
          7 + r() * 18,
          10 + r() * 12,
          4.5 + r() * 2,
          r,
          i % 2 ? look.foliage.mid : look.foliage.dark,
          6,
        );
      for (let i = 0; i < 5; i++) ellipse(c, 7 + r() * 18, 9 + r() * 12, 1, 1, look.foliage.light);
      return true;
    }
    case 'cairn': {
      const st = (sx: number, sy: number, rx: number, ry: number, col: string): void => {
        ellipse(c, sx, sy, rx, ry, col);
        ellipse(c, sx - rx * 0.3, sy - ry * 0.35, rx * 0.4, ry * 0.3, rgba('#ffffff', 0.3));
      };
      st(16, 24, 9, 5, '#8d8069');
      st(16, 17, 7, 4, '#a39478');
      st(16, 11, 5, 3, '#bcae90');
      st(16, 6.5, 3, 2, '#c8bb9e');
      return true;
    }
    case 'reeds': {
      for (let i = 0; i < 14; i++) {
        const bx = 4 + r() * 24;
        const h = 14 + r() * 12;
        c.strokeStyle = i % 3 ? look.foliage.mid : look.foliage.dark;
        c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(bx, 28);
        c.quadraticCurveTo(bx + (r() - 0.5) * 4, 28 - h / 2, bx + (r() - 0.5) * 7, 28 - h);
        c.stroke();
        if (r() < 0.35) ellipse(c, bx + (r() - 0.5) * 6, 28 - h - 1, 1.2, 3, '#7a5a34');
      }
      return true;
    }
    case 'sheep': {
      // Two or three sheep lying close together, fleece against fleece.
      const sheep = (sx: number, sy: number, s: number, face: string, flip: number): void => {
        ellipse(c, sx + 1, sy + 3 * s, 8 * s, 3 * s, 'rgba(50,34,20,0.3)');
        ellipse(c, sx, sy, 8 * s, 5 * s, '#e6ddc8');
        for (let i = 0; i < 6; i++)
          ellipse(
            c,
            sx - 5 * s + i * 2 * s,
            sy - 2 * s + (i % 2) * 1.5 * s,
            2.2 * s,
            1.8 * s,
            i % 2 ? '#f2ecde' : '#d6ccb4',
          );
        ellipse(c, sx - 2 * s, sy - 2.2 * s, 3 * s, 1.6 * s, rgba('#ffffff', 0.45));
        // Head resting forward, ears out.
        ellipse(c, sx + flip * 7.5 * s, sy + 0.5 * s, 2.3 * s, 1.8 * s, face);
        ellipse(c, sx + flip * 6.2 * s, sy - 1 * s, 1.3 * s, 0.6 * s, face, flip * 0.6);
        ellipse(c, sx + flip * 8.4 * s, sy - 0.4 * s, 0.35 * s, 0.35 * s, '#1c1410');
      };
      const faces = ['#3b2e26', '#e0d4bc', '#6a5444'];
      const pickFace = (): string => faces[Math.floor(r() * faces.length)] ?? '#3b2e26';
      sheep(13, 13, 0.9, pickFace(), r() < 0.5 ? -1 : 1);
      sheep(19, 22, 1, pickFace(), r() < 0.5 ? -1 : 1);
      if (r() < 0.5) sheep(8, 24, 0.75, pickFace(), 1);
      return true;
    }
    case 'crops': {
      // Rows of vegetables or young barley in dark soil.
      c.fillStyle = look.ground.soil;
      c.fillRect(1, 3, 30, 26);
      for (let row = 0; row < 3; row++) {
        const yy = 8 + row * 9;
        c.fillStyle = shade(look.ground.soil, -0.3);
        c.fillRect(1, yy + 3, 30, 1.2);
        for (let i = 0; i < 5; i++) {
          const px = 4 + i * 6 + r() * 2;
          lumpy(c, px, yy, 2.8 + r(), r, i % 2 ? look.foliage.mid : look.foliage.light, 6);
          if (r() < 0.2) ellipse(c, px + 1, yy + 1, 1, 1, '#d0573d');
        }
      }
      return true;
    }
    default:
      return false;
  }
}

// ── Trees ────────────────────────────────────────────────────────────────
/** The trunk, on the ground layer (local coordinates, tile at 0–32). */
export function paintTrunk(c: Ctx, kind: TileKind, seed: number): boolean {
  const r = rng(seed);
  if (kind === 'olive') {
    c.fillStyle = TRUNK;
    c.beginPath();
    c.moveTo(10, 29);
    c.bezierCurveTo(13, 22, 9, 18, 13, 9);
    c.lineTo(19, 9);
    c.bezierCurveTo(17, 17, 23, 22, 22, 29);
    c.closePath();
    c.fill();
    c.strokeStyle = shade(TRUNK, -0.35);
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(15, 27);
    c.bezierCurveTo(14, 21, 17, 17, 16, 11);
    c.stroke();
    ellipse(c, 12, 24, 1.4, 2.4, shade(TRUNK, 0.2));
    return true;
  }
  if (kind === 'palm') {
    const lean = (r() - 0.5) * 4;
    for (let i = 0; i < 9; i++) {
      const yy = 29 - i * 3.6;
      const xx = 14 + lean * (i / 9) + Math.sin(i * 0.6) * 0.8;
      c.fillStyle = i % 2 ? TRUNK : shade(TRUNK, 0.14);
      c.beginPath();
      c.ellipse(xx + 2, yy, 3.3, 2.3, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = rgba(shade(TRUNK, -0.4), 0.6);
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(xx - 1, yy - 0.8);
      c.lineTo(xx + 5, yy - 0.6);
      c.stroke();
    }
    return true;
  }
  if (kind === 'fig') {
    // A broad, low-branching sycamore-fig.
    c.fillStyle = '#7a6448';
    c.beginPath();
    c.moveTo(9, 30);
    c.bezierCurveTo(12, 24, 12, 18, 8, 12);
    c.lineTo(13, 12);
    c.bezierCurveTo(15, 16, 16, 16, 18, 12);
    c.lineTo(24, 11);
    c.bezierCurveTo(19, 18, 20, 24, 24, 30);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#4d3b28', 0.7);
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(16, 29);
    c.lineTo(16, 18);
    c.stroke();
    return true;
  }
  return false;
}

/** How big a canopy piece is and where the tile sits inside it. */
export const CANOPY_BOX = { left: 18, top: 28, width: 68, height: 60 };

/** A tree top, drawn above characters (local coords; the tile's top-left is at CANOPY_BOX.left/top). */
export function paintCanopy(c: Ctx, kind: TileKind, look: Look, seed: number): void {
  const r = rng(seed);
  const ox = CANOPY_BOX.left;
  const oy = CANOPY_BOX.top;
  const f = look.foliage;
  if (kind === 'olive') {
    for (let i = 0; i < 8; i++)
      lumpy(c, ox + 4 + r() * 24, oy - 3 + r() * 15, 8 + r() * 3.5, r, shade(f.dark, -0.05), 8);
    for (let i = 0; i < 9; i++)
      lumpy(
        c,
        ox + 4 + r() * 24,
        oy - 6 + r() * 13,
        6 + r() * 3,
        r,
        mix(f.mid, '#9aa37e', 0.35),
        8,
      );
    for (let i = 0; i < 12; i++)
      ellipse(
        c,
        ox + 4 + r() * 24,
        oy - 8 + r() * 13,
        2.3 + r(),
        1.2,
        rgba(mix(f.light, '#d6dcc2', 0.5), 0.9),
        r() * Math.PI,
      );
    if (r() < 0.5)
      for (let i = 0; i < 5; i++) ellipse(c, ox + 6 + r() * 20, oy - 2 + r() * 10, 1, 1, '#3d4a2a');
    return;
  }
  if (kind === 'fig') {
    for (let i = 0; i < 9; i++)
      lumpy(c, ox + 1 + r() * 30, oy - 6 + r() * 18, 10 + r() * 4, r, f.dark, 8);
    for (let i = 0; i < 10; i++)
      lumpy(c, ox + 2 + r() * 28, oy - 9 + r() * 16, 7 + r() * 3, r, f.mid, 8);
    for (let i = 0; i < 14; i++) {
      const lx = ox + 2 + r() * 28;
      const ly = oy - 10 + r() * 16;
      ellipse(c, lx, ly, 2.6, 1.8, rgba(f.light, 0.8), r() * Math.PI);
    }
    for (let i = 0; i < 6; i++)
      ellipse(c, ox + 4 + r() * 24, oy - 4 + r() * 12, 1.3, 1.3, '#9a6a3a');
    return;
  }
  if (kind === 'palm') {
    const cx = ox + 16 + (r() - 0.5) * 3;
    const cy = oy + 1;
    const fronds = 10;
    for (let i = 0; i < fronds; i++) {
      const angle = (i / fronds) * Math.PI * 2 + r() * 0.35;
      const len = 18 + r() * 5;
      const droop = 6 + r() * 4;
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len * 0.62 + droop;
      const mx = cx + Math.cos(angle) * len * 0.55;
      const my = cy + Math.sin(angle) * len * 0.34 - 6;
      c.strokeStyle = i % 2 ? f.mid : shade(f.mid, 0.15);
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(mx, my, ex, ey);
      c.stroke();
      c.lineWidth = 0.85;
      for (let t = 0.25; t <= 0.97; t += 0.1) {
        const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
        const py = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
        const leaf = 3.6 * (1 - t * 0.5);
        c.strokeStyle = t > 0.6 ? f.dark : f.mid;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(angle + 1.4) * leaf, py + Math.sin(angle + 1.4) * leaf + 1.3);
        c.moveTo(px, py);
        c.lineTo(px + Math.cos(angle - 1.4) * leaf, py + Math.sin(angle - 1.4) * leaf + 1.3);
        c.stroke();
      }
    }
    // Hanging date clusters.
    for (let i = 0; i < 2; i++) {
      const dx = cx + (i ? 4 : -4);
      for (let d = 0; d < 7; d++)
        ellipse(
          c,
          dx + (d % 3) - 1,
          cy + 4 + Math.floor(d / 3) * 1.7,
          1.2,
          1.2,
          mix('#d0702a', '#8a3f14', d / 7),
        );
    }
    ellipse(c, cx, cy, 2.4, 2, shade(TRUNK, 0.1));
  }
}

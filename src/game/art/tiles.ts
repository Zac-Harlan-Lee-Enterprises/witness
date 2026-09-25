import type { TileGrid, TileKind } from '@/domain/world';
import { tileAt } from '@/domain/world';
import {
  ellipse,
  lumpy,
  makeCanvas,
  mix,
  rgba,
  rng,
  hash,
  shade,
  softShadow,
  speckle,
  TILE,
  type Ctx,
} from './paint';

/**
 * Original procedural scenery (Canvas 2D), painted once per scene in layers:
 *
 *   1. textured ground materials          4. buildings, cliffs and water
 *   2. organic blended edges between them  5. cast shadows (sun from top-left)
 *   3. scattered detail (flowers, stones)  6. props, then tree canopies (separate layer)
 *
 * Warm, illustrated and stylised; deliberately not imitating any commercial
 * game. Deterministic: seeded by tile position.
 */
export { TILE };

export const PALETTE = {
  sand: '#e3cc9b',
  scrub: '#cbb87d',
  grass: '#8f9d57',
  grassLight: '#b3bf73',
  road: '#dbc398',
  paving: '#dac8a3',
  floor: '#cfad7f',
  rug: '#973d2d',
  rugTrim: '#e0b453',
  wadi: '#c6ab80',
  mud: '#8f6d4a',
  limestone: '#e8d8b6',
  mortar: '#bfa780',
  roof: '#e2cfa8',
  water: '#3f8aa3',
  trunk: '#6a4f33',
  olive: '#8a9a68',
  oliveLight: '#b9c496',
  oliveDark: '#5f6f45',
  palm: '#5c7c37',
  palmLight: '#8aab52',
  rock: '#aa9474',
  redRock: '#b8674a',
  hill: '#a98357',
  hillTop: '#b99467',
  wood: '#8a623c',
  woodDark: '#573b22',
  clay: '#bc7248',
  clayDark: '#8c5231',
  awningA: '#b3432d',
  awningB: '#efe0ba',
  void: '#2a2018',
} as const;

/** Tiles drawn as an object standing on ground (the ground beneath comes from neighbours). */
const PROP_TILES: ReadonlySet<TileKind> = new Set([
  'olive',
  'palm',
  'rock',
  'bush',
  'stall',
  'table',
  'jars',
  'cairn',
  'oven',
  'well',
]);
const STRUCTURES: ReadonlySet<TileKind> = new Set([
  'wall',
  'roof',
  'cliff',
  'hill',
  'water',
  'void',
  'door',
  'gate',
  'fence',
]);
const TALL: ReadonlySet<TileKind> = new Set(['wall', 'roof', 'cliff', 'hill']);

/** Which ground material spreads over which at a boundary (higher wins). Rugs keep crisp edges. */
const SPREAD: Partial<Record<TileKind, number>> = {
  scrub: 6,
  sand: 5,
  wadi: 4,
  mud: 4,
  road: 3,
  paving: 2,
  steps: 2,
  floor: 1,
};

const GROUND_COLOR: Partial<Record<TileKind, string>> = {
  sand: PALETTE.sand,
  scrub: PALETTE.scrub,
  road: PALETTE.road,
  paving: PALETTE.paving,
  steps: PALETTE.paving,
  floor: PALETTE.floor,
  wadi: PALETTE.wadi,
  mud: PALETTE.mud,
};

export function isPropTile(kind: TileKind): boolean {
  return PROP_TILES.has(kind);
}

export function hasCanopy(kind: TileKind): boolean {
  return kind === 'olive' || kind === 'palm';
}

/** The ground a prop stands on: the most common ground-like neighbour (hills count as ground). */
export function groundUnder(grid: TileGrid, tx: number, ty: number, fallback: TileKind): TileKind {
  const counts = new Map<TileKind, number>();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const k = tileAt(grid, tx + dx, ty + dy);
    if (!PROP_TILES.has(k) && (k === 'hill' || !STRUCTURES.has(k)))
      counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: TileKind = fallback;
  let bestCount = 0;
  counts.forEach((n, k) => {
    if (n > bestCount) {
      best = k;
      bestCount = n;
    }
  });
  return best;
}

/** A tree top drawn above characters; x/y is the canvas's top-left in world units. */
export interface CanopyPiece {
  x: number;
  y: number;
  canvas: HTMLCanvasElement;
}

/** Canopy canvases cover the tree's tile plus overhang (see paintCanopy). */
const CANOPY_BOX = { left: 16, top: 24, width: 64, height: 56 };

/**
 * Paint a whole scene: one ground texture (below characters) and a small
 * texture per tree top (above characters). Per-tree canopies keep texture
 * memory proportional to the number of trees rather than the map size.
 */
export function paintSceneLayers(
  grid: TileGrid,
  baseTile: TileKind,
  doc: Document = document,
): { ground: HTMLCanvasElement; canopies: CanopyPiece[] } {
  const w = grid.width * TILE;
  const h = grid.height * TILE;
  const ground = makeCanvas(w, h, doc);
  const canopies: CanopyPiece[] = [];
  const g = ground.ctx;
  if (!g) return { ground: ground.canvas, canopies };

  const kindAt = (x: number, y: number): TileKind => tileAt(grid, x, y);
  const groundAt = (x: number, y: number): TileKind => {
    const k = kindAt(x, y);
    return PROP_TILES.has(k) ? groundUnder(grid, x, y, baseTile) : k;
  };
  const forEachTile = (fn: (x: number, y: number) => void): void => {
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) fn(x, y);
  };

  // 1. Ground materials (structures get their own pass). Flat fills first, then
  //    texture in a second pass so blotches flow across tile seams (no grid look).
  forEachTile((x, y) => {
    const k = groundAt(x, y);
    if (!STRUCTURES.has(k)) paintGroundMaterial(g, k, x, y, grid);
  });
  forEachTile((x, y) => {
    const k = groundAt(x, y);
    if (!STRUCTURES.has(k)) paintGroundTexture(g, k, x, y);
  });
  // 2. Organic edges between materials.
  forEachTile((x, y) => {
    const k = groundAt(x, y);
    const mine = SPREAD[k];
    if (mine === undefined) return;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const n = groundAt(x + dx, y + dy);
      const theirs = SPREAD[n];
      const color = GROUND_COLOR[n];
      if (theirs === undefined || theirs <= mine || !color) continue;
      bleedEdge(g, x, y, dx, dy, color, n === 'scrub', rng(hash(x, y, 31 + dx * 3 + dy)));
    }
  });
  // 3. Detail scatter.
  forEachTile((x, y) => paintDetail(g, groundAt(x, y), x, y, grid));
  // 4. Structures. Hills are painted in three passes (base, texture, ledges)
  //    so each pass flows across tile seams.
  const hillish = (x: number, y: number): boolean => {
    const k = groundAt(x, y);
    return k === 'hill' || k === 'cliff' || k === 'void';
  };
  forEachTile((x, y) => {
    const k = groundAt(x, y);
    if (k === 'hill') paintHillBase(g, x, y);
    if (k === 'water') {
      g.fillStyle = PALETTE.water;
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  });
  forEachTile((x, y) => {
    const k = groundAt(x, y);
    if (STRUCTURES.has(k)) paintStructure(g, k, x, y, grid);
  });
  forEachTile((x, y) => {
    if (groundAt(x, y) === 'hill') paintHillLedges(g, x, y, hillish);
  });
  // 5. Cast shadows from tall things onto the ground to their south/east.
  forEachTile((x, y) => {
    const k = groundAt(x, y);
    if (TALL.has(k) || k === 'water' || k === 'void') return;
    const X = x * TILE;
    const Y = y * TILE;
    if (TALL.has(groundAt(x, y - 1))) {
      const grad = g.createLinearGradient(0, Y, 0, Y + 12);
      grad.addColorStop(0, 'rgba(60,35,15,0.38)');
      grad.addColorStop(1, 'rgba(60,35,15,0)');
      g.fillStyle = grad;
      g.fillRect(X, Y, TILE, 12);
    }
    if (TALL.has(groundAt(x - 1, y))) {
      const grad = g.createLinearGradient(X, 0, X + 8, 0);
      grad.addColorStop(0, 'rgba(60,35,15,0.28)');
      grad.addColorStop(1, 'rgba(60,35,15,0)');
      g.fillStyle = grad;
      g.fillRect(X, Y, 8, TILE);
    }
  });
  // 6. Props and canopies.
  forEachTile((x, y) => {
    const k = kindAt(x, y);
    if (!PROP_TILES.has(k)) return;
    paintProp(g, k, x, y);
    if (!hasCanopy(k)) return;
    const piece = makeCanvas(CANOPY_BOX.width, CANOPY_BOX.height, doc);
    if (!piece.ctx) return;
    const left = x * TILE - CANOPY_BOX.left;
    const top = y * TILE - CANOPY_BOX.top;
    piece.ctx.translate(-left, -top);
    paintCanopy(piece.ctx, k, x, y);
    canopies.push({ x: left, y: top, canvas: piece.canvas });
  });
  return { ground: ground.canvas, canopies };
}

// ── Ground ────────────────────────────────────────────────────────────────
function paintGroundMaterial(
  ctx: Ctx,
  kind: TileKind,
  tx: number,
  ty: number,
  grid: TileGrid,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const base = GROUND_COLOR[kind] ?? PALETTE.sand;
  switch (kind) {
    case 'rug': {
      const edge = (dx: number, dy: number): boolean => tileAt(grid, tx + dx, ty + dy) !== 'rug';
      ctx.fillStyle = PALETTE.floor;
      ctx.fillRect(X, Y, TILE, TILE);
      ctx.fillStyle = PALETTE.rug;
      ctx.fillRect(X, Y, TILE, TILE);
      // woven texture
      ctx.fillStyle = rgba('#5a1e14', 0.25);
      for (let i = 0; i < TILE; i += 3) ctx.fillRect(X, Y + i, TILE, 1);
      ctx.fillStyle = PALETTE.rugTrim;
      if (edge(0, -1)) ctx.fillRect(X, Y + 2, TILE, 2.5);
      if (edge(0, 1)) ctx.fillRect(X, Y + TILE - 4.5, TILE, 2.5);
      if (edge(-1, 0)) ctx.fillRect(X + 2, Y, 2.5, TILE);
      if (edge(1, 0)) ctx.fillRect(X + TILE - 4.5, Y, 2.5, TILE);
      // central diamond motif
      ctx.fillStyle = rgba(PALETTE.rugTrim, 0.8);
      ctx.beginPath();
      ctx.moveTo(X + 16, Y + 10);
      ctx.lineTo(X + 22, Y + 16);
      ctx.lineTo(X + 16, Y + 22);
      ctx.lineTo(X + 10, Y + 16);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, X + 16, Y + 16, 2, 2, PALETTE.rug);
      return;
    }
    case 'paving':
    case 'steps':
      // Mortar shows between the slabs painted in the detail pass.
      ctx.fillStyle = shade(base, -0.16);
      ctx.fillRect(X, Y, TILE, TILE);
      return;
    default:
      ctx.fillStyle = base;
      ctx.fillRect(X, Y, TILE, TILE);
  }
}

/** Soft tonal blotches and grit; allowed to spill over tile edges. */
function paintGroundTexture(ctx: Ctx, kind: TileKind, tx: number, ty: number): void {
  if (kind === 'rug' || kind === 'paving' || kind === 'steps') return;
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 7));
  const base = GROUND_COLOR[kind] ?? PALETTE.sand;
  for (let i = 0; i < 3; i++) {
    lumpy(
      ctx,
      X + r() * TILE,
      Y + r() * TILE,
      7 + r() * 10,
      r,
      rgba(shade(base, (r() - 0.5) * 0.16), 0.35),
      8,
    );
  }
  speckle(ctx, X, Y, TILE, TILE, r, [shade(base, -0.14), shade(base, 0.14)], 10, 1);
}

function bleedEdge(
  ctx: Ctx,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  color: string,
  grassy: boolean,
  r: () => number,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const along = (t: number): [number, number] => {
    if (dy === -1) return [X + t, Y];
    if (dy === 1) return [X + t, Y + TILE];
    if (dx === -1) return [X, Y + t];
    return [X + TILE, Y + t];
  };
  for (let i = 0; i < 5; i++) {
    const [px, py] = along(r() * TILE);
    lumpy(ctx, px, py, 3 + r() * 5, r, color, 6);
  }
  if (grassy) {
    ctx.strokeStyle = PALETTE.grass;
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      const [px, py] = along(r() * TILE);
      const ix = px - dx * (2 + r() * 4);
      const iy = py - dy * (2 + r() * 4);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix - 1, iy - 3);
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + 1.5, iy - 2.5);
      ctx.stroke();
    }
  }
}

function paintDetail(ctx: Ctx, kind: TileKind, tx: number, ty: number, grid: TileGrid): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 17));
  const pebble = (px: number, py: number, s: number, color: string): void => {
    ellipse(ctx, px + 0.5, py + 0.7, s, s * 0.7, 'rgba(60,40,20,0.25)');
    ellipse(ctx, px, py, s, s * 0.7, color);
    ellipse(ctx, px - s * 0.3, py - s * 0.25, s * 0.35, s * 0.25, rgba('#ffffff', 0.35));
  };
  switch (kind) {
    case 'scrub': {
      for (let i = 0; i < 5; i++) {
        const gx = X + 3 + r() * 26;
        const gy = Y + 5 + r() * 24;
        ctx.strokeStyle = r() > 0.5 ? PALETTE.grass : PALETTE.grassLight;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [ex, ey] of [
          [-2.5, -4],
          [0, -5.5],
          [2.5, -4],
          [1.2, -3],
        ] as const) {
          ctx.moveTo(gx, gy);
          ctx.quadraticCurveTo(gx + ex * 0.4, gy + ey * 0.6, gx + ex, gy + ey);
        }
        ctx.stroke();
      }
      if (r() < 0.35) {
        // Wild flowers: red anemones and yellow chrysanthemums grow wild in the region.
        const colors = ['#c8372d', '#e0b53a', '#f2efe4'];
        for (let i = 0; i < 3; i++) {
          const fx = X + 4 + r() * 24;
          const fy = Y + 4 + r() * 24;
          const col = colors[Math.floor(r() * colors.length)] ?? '#c8372d';
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ellipse(ctx, fx + Math.cos(a) * 1.3, fy + Math.sin(a) * 1.3, 1.1, 1.1, col);
          }
          ellipse(ctx, fx, fy, 0.8, 0.8, '#3a2a14');
        }
      }
      if (r() < 0.2) pebble(X + 6 + r() * 20, Y + 6 + r() * 20, 1.8, '#a89574');
      return;
    }
    case 'sand': {
      for (let i = 0; i < 2; i++)
        pebble(X + 4 + r() * 24, Y + 4 + r() * 24, 1 + r() * 1.3, '#b79f78');
      if (r() < 0.3) {
        ctx.strokeStyle = rgba('#b8995f', 0.35);
        ctx.lineWidth = 0.8;
        const wy = Y + 8 + r() * 16;
        ctx.beginPath();
        ctx.moveTo(X + 3, wy);
        ctx.quadraticCurveTo(X + 16, wy - 2.5, X + 29, wy);
        ctx.stroke();
      }
      return;
    }
    case 'road': {
      const horizontal =
        SPREAD[tileAt(grid, tx - 1, ty)] === 3 || SPREAD[tileAt(grid, tx + 1, ty)] === 3;
      ctx.strokeStyle = rgba('#8e7250', 0.3);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(X, Y + 11 + r());
        ctx.lineTo(X + TILE, Y + 11 + r());
        ctx.moveTo(X, Y + 21 + r());
        ctx.lineTo(X + TILE, Y + 21 + r());
      } else {
        ctx.moveTo(X + 11 + r(), Y);
        ctx.lineTo(X + 11 + r(), Y + TILE);
        ctx.moveTo(X + 21 + r(), Y);
        ctx.lineTo(X + 21 + r(), Y + TILE);
      }
      ctx.stroke();
      for (let i = 0; i < 4; i++)
        pebble(
          X + 2 + r() * 28,
          Y + 2 + r() * 28,
          1.2 + r() * 1.8,
          r() > 0.5 ? '#a58c67' : '#bda27a',
        );
      return;
    }
    case 'paving':
    case 'steps': {
      // Irregular dressed-stone slabs.
      const rows = kind === 'steps' ? 4 : 2;
      const rowH = TILE / rows;
      for (let row = 0; row < rows; row++) {
        let x0 = X;
        const yy = Y + row * rowH;
        while (x0 < X + TILE - 1) {
          const wSlab = Math.min(X + TILE - x0, 10 + r() * 12);
          ctx.fillStyle = shade(PALETTE.paving, (r() - 0.5) * 0.12);
          ctx.fillRect(x0 + 0.6, yy + 0.6, wSlab - 1.2, rowH - 1.2);
          ctx.fillStyle = rgba('#ffffff', 0.18);
          ctx.fillRect(x0 + 0.6, yy + 0.6, wSlab - 1.2, 1);
          ctx.fillStyle = rgba('#7d6848', 0.28);
          ctx.fillRect(x0 + 0.6, yy + rowH - 1.4, wSlab - 1.2, 0.8);
          x0 += wSlab;
        }
      }
      if (kind === 'steps') {
        ctx.fillStyle = rgba('#5a4428', 0.25);
        for (let row = 1; row < rows; row++) ctx.fillRect(X, Y + row * rowH - 1, TILE, 1.2);
      }
      if (r() < 0.25) {
        ctx.strokeStyle = rgba('#7d6848', 0.4);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        const cx = X + 6 + r() * 20;
        const cy = Y + 6 + r() * 20;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 3 + r() * 3, cy + 2);
        ctx.lineTo(cx + 5, cy + 5 + r() * 2);
        ctx.stroke();
      }
      return;
    }
    case 'floor': {
      speckle(ctx, X, Y, TILE, TILE, r, ['#b99468', '#e0c393'], 8, 1);
      if (r() < 0.3) {
        ctx.strokeStyle = rgba('#d9b870', 0.8);
        ctx.lineWidth = 0.7;
        for (let i = 0; i < 3; i++) {
          const sx = X + r() * 28;
          const sy = Y + r() * 28;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 3 + r() * 3, sy + (r() - 0.5) * 3);
          ctx.stroke();
        }
      }
      return;
    }
    case 'wadi': {
      for (let i = 0; i < 7; i++)
        pebble(
          X + 3 + r() * 26,
          Y + 3 + r() * 26,
          1.3 + r() * 2.2,
          r() > 0.5 ? '#a48e6c' : '#c9b595',
        );
      return;
    }
    case 'mud': {
      ctx.strokeStyle = rgba('#5e4127', 0.5);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        const sx = X + r() * TILE;
        const sy = Y + r() * TILE;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (r() - 0.5) * 12, sy + (r() - 0.5) * 12);
        ctx.stroke();
      }
      ellipse(ctx, X + 10 + r() * 12, Y + 10 + r() * 12, 6, 2.5, rgba('#c7a47a', 0.35));
      return;
    }
    default:
      return;
  }
}

// ── Structures ────────────────────────────────────────────────────────────
function paintStructure(ctx: Ctx, kind: TileKind, tx: number, ty: number, grid: TileGrid): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 23));
  const at = (dx: number, dy: number): TileKind => tileAt(grid, tx + dx, ty + dy);
  switch (kind) {
    case 'wall': {
      const facade = at(0, 1) !== 'wall' && at(0, 1) !== 'roof';
      if (!facade) {
        // Top of a thick wall seen from above: plaster cap.
        ctx.fillStyle = shade(PALETTE.limestone, -0.04 + (r() - 0.5) * 0.04);
        ctx.fillRect(X, Y, TILE, TILE);
        speckle(ctx, X, Y, TILE, TILE, r, ['#cdb892', '#f3e7cb'], 10, 1);
        ctx.fillStyle = rgba('#8c7450', 0.35);
        if (at(-1, 0) !== 'wall') ctx.fillRect(X, Y, 1.5, TILE);
        if (at(1, 0) !== 'wall') ctx.fillRect(X + TILE - 1.5, Y, 1.5, TILE);
        if (at(0, -1) !== 'wall' && at(0, -1) !== 'roof') ctx.fillRect(X, Y, TILE, 1.5);
        return;
      }
      // Front face: dressed limestone blocks.
      const grad = ctx.createLinearGradient(0, Y, 0, Y + TILE);
      grad.addColorStop(0, shade(PALETTE.limestone, 0.06));
      grad.addColorStop(1, shade(PALETTE.limestone, -0.12));
      ctx.fillStyle = grad;
      ctx.fillRect(X, Y, TILE, TILE);
      for (let row = 0; row < 4; row++) {
        const yy = Y + row * 8;
        let x0 = X - (row % 2) * 7;
        while (x0 < X + TILE) {
          const bw = 11 + r() * 6;
          const bx = Math.max(x0, X);
          const bwClip = Math.min(x0 + bw, X + TILE) - bx;
          if (bwClip > 0.5) {
            ctx.fillStyle = rgba(shade(PALETTE.limestone, (r() - 0.5) * 0.14), 0.7);
            ctx.fillRect(bx + 0.5, yy + 0.5, bwClip - 1, 7);
            ctx.fillStyle = rgba('#ffffff', 0.2);
            ctx.fillRect(bx + 0.5, yy + 0.5, bwClip - 1, 0.8);
          }
          x0 += bw;
        }
        ctx.fillStyle = rgba(PALETTE.mortar, 0.9);
        ctx.fillRect(X, yy + 7.5, TILE, 0.8);
      }
      // Occasional small window with a wooden lintel.
      if (hash(tx, ty, 5) % 4 === 0 && at(-1, 0) === 'wall' && at(1, 0) === 'wall') {
        ctx.fillStyle = PALETTE.woodDark;
        ctx.fillRect(X + 10, Y + 7, 12, 2);
        ctx.fillStyle = '#2d2016';
        ctx.fillRect(X + 11.5, Y + 9, 9, 10);
        ctx.fillStyle = rgba('#8a623c', 0.9);
        ctx.fillRect(X + 11.5, Y + 9, 2, 10);
        ctx.fillRect(X + 18.5, Y + 9, 2, 10);
      }
      // Ground contact shadow.
      ctx.fillStyle = rgba('#4b3219', 0.28);
      ctx.fillRect(X, Y + TILE - 2.5, TILE, 2.5);
      return;
    }
    case 'roof': {
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(X, Y, TILE, TILE);
      speckle(ctx, X, Y, TILE, TILE, r, ['#d1bc92', '#f1e3c3'], 14, 1);
      if (r() < 0.2) {
        ctx.strokeStyle = rgba('#a88c62', 0.5);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        const cx = X + 5 + r() * 20;
        const cy = Y + 5 + r() * 20;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 4, cy + 2 + r() * 3);
        ctx.lineTo(cx + 6, cy + 6);
        ctx.stroke();
      }
      // Parapet lip on roof edges.
      const lip = '#c7ad7f';
      const light = '#f4e8cc';
      if (at(0, -1) !== 'roof') {
        ctx.fillStyle = lip;
        ctx.fillRect(X, Y, TILE, 3.5);
        ctx.fillStyle = light;
        ctx.fillRect(X, Y, TILE, 1);
      }
      if (at(-1, 0) !== 'roof') {
        ctx.fillStyle = lip;
        ctx.fillRect(X, Y, 3.5, TILE);
        ctx.fillStyle = light;
        ctx.fillRect(X, Y, 1, TILE);
      }
      if (at(1, 0) !== 'roof') {
        ctx.fillStyle = shade(lip, -0.15);
        ctx.fillRect(X + TILE - 3.5, Y, 3.5, TILE);
      }
      if (at(0, 1) !== 'roof') {
        ctx.fillStyle = shade(lip, -0.12);
        ctx.fillRect(X, Y + TILE - 3.5, TILE, 3.5);
      }
      // Rooftop life: jars, a rolled mat, drying herbs.
      const interior =
        at(0, -1) === 'roof' && at(0, 1) === 'roof' && at(-1, 0) === 'roof' && at(1, 0) === 'roof';
      if (interior) {
        const v = hash(tx, ty, 41) % 9;
        if (v === 0) {
          softShadow(ctx, X + 17, Y + 22, 7, 3, 0.3);
          ellipse(ctx, X + 14, Y + 17, 4, 5, PALETTE.clay);
          ellipse(ctx, X + 20, Y + 19, 3, 4, PALETTE.clayDark);
          ellipse(ctx, X + 13, Y + 14, 1.5, 1, rgba('#ffffff', 0.3));
        } else if (v === 1) {
          softShadow(ctx, X + 16, Y + 20, 10, 3, 0.25);
          ctx.fillStyle = '#b89a62';
          ctx.fillRect(X + 6, Y + 14, 20, 6);
          ctx.fillStyle = '#9b7c47';
          for (let i = 0; i < 5; i++) ctx.fillRect(X + 7 + i * 4, Y + 14, 1, 6);
        } else if (v === 2) {
          ctx.strokeStyle = '#6a4f33';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(X + 4, Y + 10);
          ctx.lineTo(X + 28, Y + 12);
          ctx.stroke();
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 ? '#7a8a4c' : '#9c5a3c';
            ctx.fillRect(X + 7 + i * 5, Y + 10.5 + i * 0.3, 3, 5);
          }
        }
      }
      return;
    }
    case 'door':
    case 'gate': {
      const inWall = at(-1, 0) === 'wall' || at(1, 0) === 'wall';
      ctx.fillStyle = kind === 'gate' ? PALETTE.paving : shade(PALETTE.floor, -0.05);
      ctx.fillRect(X, Y, TILE, TILE);
      if (inWall && at(0, 1) !== 'wall' && at(0, -1) !== 'floor') {
        // Arched doorway in a facade.
        ctx.fillStyle = shade(PALETTE.limestone, -0.1);
        ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = '#2d2016';
        ctx.beginPath();
        ctx.moveTo(X + 6, Y + TILE);
        ctx.lineTo(X + 6, Y + 12);
        ctx.quadraticCurveTo(X + 16, Y + 1, X + 26, Y + 12);
        ctx.lineTo(X + 26, Y + TILE);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.wood;
        ctx.fillRect(X + 8, Y + 13, 16, TILE - 13);
        ctx.fillStyle = PALETTE.woodDark;
        for (let i = 0; i < 4; i++) ctx.fillRect(X + 8 + i * 4, Y + 13, 0.8, TILE - 13);
        ellipse(ctx, X + 21, Y + 22, 1, 1, '#d8b460');
        ctx.strokeStyle = shade(PALETTE.limestone, -0.3);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X + 6, Y + TILE);
        ctx.lineTo(X + 6, Y + 12);
        ctx.quadraticCurveTo(X + 16, Y + 1, X + 26, Y + 12);
        ctx.lineTo(X + 26, Y + TILE);
        ctx.stroke();
      } else {
        // Threshold / open doorway seen from inside or a gate passage.
        ctx.fillStyle = shade(PALETTE.paving, -0.08);
        ctx.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        const grad = ctx.createLinearGradient(0, Y, 0, Y + TILE);
        grad.addColorStop(0, 'rgba(40,25,10,0.05)');
        grad.addColorStop(1, 'rgba(40,25,10,0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(X, Y, TILE, TILE);
        ctx.fillStyle = PALETTE.woodDark;
        ctx.fillRect(X + 1, Y + 1, TILE - 2, 3);
      }
      return;
    }
    case 'cliff': {
      const face = at(0, 1) !== 'cliff';
      ctx.fillStyle = PALETTE.redRock;
      ctx.fillRect(X, Y, TILE, TILE);
      // Strata follow continuous waves in world space, so they line up across tiles.
      const wave = (wx: number, i: number): number =>
        Math.sin(wx * 0.11 + i * 1.7) * 1.6 + Math.sin(wx * 0.037 + i) * 1.2;
      for (let i = 0; i < 4; i++) {
        const sy = Y + 4 + i * 7;
        ctx.fillStyle = rgba(shade(PALETTE.redRock, -0.25), 0.55);
        ctx.beginPath();
        ctx.moveTo(X, sy + wave(X, i));
        for (let sx = 0; sx <= TILE; sx += 2) ctx.lineTo(X + sx, sy + wave(X + sx, i));
        for (let sx = TILE; sx >= 0; sx -= 2) ctx.lineTo(X + sx, sy + 2 + wave(X + sx, i) * 0.6);
        ctx.fill();
      }
      for (let i = 0; i < 2; i++) {
        lumpy(
          ctx,
          X + r() * TILE,
          Y + r() * TILE,
          6 + r() * 8,
          r,
          rgba(r() > 0.5 ? '#d2876a' : '#8f4a35', 0.28),
          7,
        );
      }
      if (r() < 0.5) {
        ctx.strokeStyle = rgba('#6a2c1c', 0.55);
        ctx.lineWidth = 0.9;
        const cx = X + 4 + r() * 24;
        ctx.beginPath();
        ctx.moveTo(cx, Y + r() * 8);
        ctx.lineTo(cx + (r() - 0.5) * 4, Y + 12 + r() * 6);
        ctx.lineTo(cx + (r() - 0.5) * 6, Y + 22 + r() * 8);
        ctx.stroke();
      }
      speckle(ctx, X, Y, TILE, TILE, r, ['#d98c6a', '#8f4a35'], 8, 1.2);
      if (at(0, -1) !== 'cliff') {
        ctx.fillStyle = rgba('#f0b08e', 0.6);
        ctx.fillRect(X, Y, TILE, 2);
      }
      if (face) {
        const grad = ctx.createLinearGradient(0, Y + 14, 0, Y + TILE);
        grad.addColorStop(0, 'rgba(70,25,12,0)');
        grad.addColorStop(1, 'rgba(70,25,12,0.45)');
        ctx.fillStyle = grad;
        ctx.fillRect(X, Y + 14, TILE, TILE - 14);
      }
      return;
    }
    case 'hill': {
      // Rounded chalk-and-ochre hills of the Judean wilderness: texture, dry scrub, stones.
      for (let i = 0; i < 3; i++) {
        lumpy(
          ctx,
          X + r() * TILE,
          Y + r() * TILE,
          8 + r() * 9,
          r,
          rgba(shade(PALETTE.hillTop, (r() - 0.5) * 0.22), 0.45),
          8,
        );
      }
      speckle(
        ctx,
        X,
        Y,
        TILE,
        TILE,
        r,
        [shade(PALETTE.hill, -0.2), shade(PALETTE.hillTop, 0.2)],
        12,
        1.1,
      );
      // Terracing lines (erosion contours) follow the slope in world space.
      ctx.strokeStyle = rgba('#6e5230', 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const cy = Y + 9 + i * 13;
        ctx.beginPath();
        ctx.moveTo(X, cy + Math.sin(X * 0.08 + ty) * 2);
        for (let sx = 4; sx <= TILE; sx += 4)
          ctx.lineTo(X + sx, cy + Math.sin((X + sx) * 0.08 + ty) * 2);
        ctx.stroke();
      }
      const shrub = (sx: number, sy: number, size: number): void => {
        softShadow(ctx, sx + 1.5, sy + size * 0.7, size * 1.3, size * 0.55, 0.4);
        lumpy(ctx, sx, sy, size, r, '#5f6536', 7);
        lumpy(ctx, sx - size * 0.25, sy - size * 0.3, size * 0.6, r, '#7f8446', 6);
        ellipse(
          ctx,
          sx - size * 0.35,
          sy - size * 0.45,
          size * 0.22,
          size * 0.16,
          rgba('#c9cf8a', 0.7),
        );
      };
      const stone = (sx: number, sy: number, size: number): void => {
        ellipse(ctx, sx + 1, sy + size * 0.6, size * 1.1, size * 0.5, 'rgba(50,32,15,0.35)');
        lumpy(ctx, sx, sy, size, r, '#bba88a', 6);
        ellipse(
          ctx,
          sx - size * 0.3,
          sy - size * 0.35,
          size * 0.45,
          size * 0.3,
          rgba('#ffffff', 0.35),
        );
      };
      if (r() < 0.55) shrub(X + 6 + r() * 20, Y + 6 + r() * 20, 3 + r() * 2.5);
      if (r() < 0.4) stone(X + 5 + r() * 22, Y + 6 + r() * 20, 2.2 + r() * 2);
      if (r() < 0.25) shrub(X + 6 + r() * 20, Y + 6 + r() * 20, 2.5 + r() * 1.5);
      return;
    }
    case 'water': {
      // The flat base was laid in an earlier pass; here: deep centre, sunlit shallows, ripples.
      if (
        at(0, -1) === 'water' &&
        at(0, 1) === 'water' &&
        at(-1, 0) === 'water' &&
        at(1, 0) === 'water'
      ) {
        lumpy(ctx, X + 16, Y + 16, 16, r, rgba(shade(PALETTE.water, -0.25), 0.45), 8);
      }
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        if (at(dx, dy) === 'water') continue;
        const x0 = dx === 1 ? X + TILE : X;
        const y0 = dy === 1 ? Y + TILE : Y;
        const grad = ctx.createLinearGradient(x0, y0, x0 - dx * 9, y0 - dy * 9);
        grad.addColorStop(0, rgba('#9fd6d2', 0.7));
        grad.addColorStop(1, rgba('#9fd6d2', 0));
        ctx.fillStyle = grad;
        ctx.fillRect(
          dx === 1 ? X + TILE - 9 : X,
          dy === 1 ? Y + TILE - 9 : Y,
          dx === 0 ? TILE : 9,
          dy === 0 ? TILE : 9,
        );
      }
      ctx.strokeStyle = rgba('#bfe6ef', 0.55);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const wy = Y + 6 + i * 9 + r() * 3;
        const wx = X + 2 + r() * 10;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 5, wy - 2, wx + 11, wy);
        ctx.stroke();
      }
      // Shoreline stones.
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        if (at(dx, dy) === 'water') continue;
        for (let i = 0; i < 4; i++) {
          const t = r() * TILE;
          const sx = dy !== 0 ? X + t : dx === 1 ? X + TILE - 2 : X + 2;
          const sy = dx !== 0 ? Y + t : dy === 1 ? Y + TILE - 2 : Y + 2;
          ellipse(ctx, sx, sy, 2.5 + r() * 1.5, 1.8, r() > 0.5 ? '#b8a585' : '#9d8a6a');
        }
      }
      return;
    }
    case 'fence': {
      paintGroundMaterial(ctx, 'sand', tx, ty, grid);
      softShadow(ctx, X + 17, Y + 24, 18, 4, 0.3);
      ctx.fillStyle = shade(PALETTE.limestone, -0.08);
      ctx.fillRect(X, Y + 11, TILE, 10);
      ctx.fillStyle = rgba('#ffffff', 0.35);
      ctx.fillRect(X, Y + 11, TILE, 1.5);
      ctx.strokeStyle = rgba(PALETTE.mortar, 0.9);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(X + 4 + i * 11 + r() * 2, Y + 12);
        ctx.lineTo(X + 4 + i * 11 + r() * 2, Y + 21);
        ctx.stroke();
      }
      return;
    }
    case 'void':
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(X, Y, TILE, TILE);
      return;
    default:
      return;
  }
}

function paintHillBase(ctx: Ctx, tx: number, ty: number): void {
  ctx.fillStyle = PALETTE.hill;
  ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
}

/**
 * Where a hill meets walkable ground it drops away: a lit rim on the north
 * edge, a shadowed rock face on the south edge, darker flanks east/west.
 * This is what makes hills read as "not a path" at a glance.
 */
function paintHillLedges(
  ctx: Ctx,
  tx: number,
  ty: number,
  hillAt: (x: number, y: number) => boolean,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 29));
  const isHill = (dx: number, dy: number): boolean => hillAt(tx + dx, ty + dy);
  const edgeWave = (wx: number): number =>
    Math.sin(wx * 0.19) * 1.5 + Math.sin(wx * 0.07 + 1) * 1.5;
  if (!isHill(0, 1)) {
    // South face: a band of layered rock dropping to the ground.
    const top = Y + TILE - 11;
    ctx.fillStyle = '#8a6841';
    ctx.beginPath();
    ctx.moveTo(X, top + edgeWave(X));
    for (let sx = 2; sx <= TILE; sx += 2) ctx.lineTo(X + sx, top + edgeWave(X + sx));
    ctx.lineTo(X + TILE, Y + TILE);
    ctx.lineTo(X, Y + TILE);
    ctx.closePath();
    ctx.fill();
    const grad = ctx.createLinearGradient(0, top, 0, Y + TILE);
    grad.addColorStop(0, 'rgba(60,38,18,0.05)');
    grad.addColorStop(1, 'rgba(60,38,18,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(X, top - 3, TILE, Y + TILE - top + 3);
    ctx.strokeStyle = rgba('#e2c79a', 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(X, top + edgeWave(X));
    for (let sx = 2; sx <= TILE; sx += 2) ctx.lineTo(X + sx, top + edgeWave(X + sx));
    ctx.stroke();
    ctx.strokeStyle = rgba('#5b4126', 0.5);
    ctx.lineWidth = 0.8;
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(X, top + i * 3.5 + edgeWave(X + 9 * i) * 0.5);
      for (let sx = 3; sx <= TILE; sx += 3)
        ctx.lineTo(X + sx, top + i * 3.5 + edgeWave(X + sx + 9 * i) * 0.5);
      ctx.stroke();
    }
    if (r() < 0.5) {
      const bx = X + 4 + r() * 24;
      ellipse(ctx, bx + 1, Y + TILE - 0.5, 3.4, 1.4, 'rgba(50,30,12,0.35)');
      lumpy(ctx, bx, Y + TILE - 2.5, 2.6, r, '#a38a66', 6);
    }
  }
  if (!isHill(0, -1)) {
    // North rim catches the light.
    ctx.strokeStyle = rgba('#ecd3a3', 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X, Y + 2 + edgeWave(X) * 0.5);
    for (let sx = 2; sx <= TILE; sx += 2) ctx.lineTo(X + sx, Y + 2 + edgeWave(X + sx) * 0.5);
    ctx.stroke();
  }
  for (const side of [-1, 1] as const) {
    if (isHill(side, 0)) continue;
    const x0 = side === -1 ? X : X + TILE - 6;
    const grad = ctx.createLinearGradient(
      side === -1 ? X : X + TILE,
      0,
      side === -1 ? X + 6 : X + TILE - 6,
      0,
    );
    grad.addColorStop(0, side === -1 ? 'rgba(236,211,163,0.45)' : 'rgba(60,38,18,0.4)');
    grad.addColorStop(1, 'rgba(60,38,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0, Y, 6, TILE);
  }
}

// ── Props ─────────────────────────────────────────────────────────────────
function paintProp(ctx: Ctx, kind: TileKind, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 11));
  switch (kind) {
    case 'olive': {
      softShadow(ctx, X + 19, Y + 27, 15, 6, 0.35);
      // Gnarled, twisting trunk.
      ctx.fillStyle = PALETTE.trunk;
      ctx.beginPath();
      ctx.moveTo(X + 11, Y + 29);
      ctx.bezierCurveTo(X + 13, Y + 22, X + 10, Y + 18, X + 14, Y + 10);
      ctx.lineTo(X + 19, Y + 10);
      ctx.bezierCurveTo(X + 17, Y + 17, X + 22, Y + 22, X + 21, Y + 29);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(PALETTE.trunk, -0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(X + 15, Y + 27);
      ctx.bezierCurveTo(X + 14, Y + 21, X + 17, Y + 17, X + 16, Y + 12);
      ctx.stroke();
      return;
    }
    case 'palm': {
      softShadow(ctx, X + 20, Y + 28, 12, 5, 0.32);
      for (let i = 0; i < 7; i++) {
        const yy = Y + 28 - i * 4;
        const xx = X + 14 + Math.sin(i * 0.5) * 1.5;
        ctx.fillStyle = i % 2 ? PALETTE.trunk : shade(PALETTE.trunk, 0.12);
        ctx.beginPath();
        ctx.ellipse(xx + 2, yy, 3.4, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case 'rock': {
      softShadow(ctx, X + 19, Y + 26, 14, 5, 0.35);
      ctx.fillStyle = PALETTE.rock;
      ctx.beginPath();
      ctx.moveTo(X + 4, Y + 25);
      ctx.lineTo(X + 7, Y + 11);
      ctx.lineTo(X + 16, Y + 6);
      ctx.lineTo(X + 26, Y + 10);
      ctx.lineTo(X + 29, Y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(PALETTE.rock, 0.22);
      ctx.beginPath();
      ctx.moveTo(X + 7, Y + 11);
      ctx.lineTo(X + 16, Y + 6);
      ctx.lineTo(X + 18, Y + 15);
      ctx.lineTo(X + 9, Y + 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(PALETTE.rock, -0.2);
      ctx.beginPath();
      ctx.moveTo(X + 18, Y + 15);
      ctx.lineTo(X + 26, Y + 10);
      ctx.lineTo(X + 29, Y + 24);
      ctx.lineTo(X + 17, Y + 25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(PALETTE.rock, -0.38);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(X + 12 + r() * 4, Y + 20);
      ctx.lineTo(X + 15, Y + 24);
      ctx.stroke();
      return;
    }
    case 'bush': {
      softShadow(ctx, X + 18, Y + 25, 13, 5, 0.32);
      ctx.strokeStyle = PALETTE.woodDark;
      ctx.lineWidth = 0.9;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(X + 16, Y + 24);
        ctx.lineTo(X + 4 + r() * 24, Y + 6 + r() * 12);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++)
        lumpy(
          ctx,
          X + 8 + r() * 16,
          Y + 10 + r() * 11,
          4.5 + r() * 2,
          r,
          i % 2 ? '#7d7a49' : '#66683a',
          6,
        );
      for (let i = 0; i < 4; i++) ellipse(ctx, X + 7 + r() * 18, Y + 9 + r() * 12, 1, 1, '#d9cf9a');
      return;
    }
    case 'stall': {
      softShadow(ctx, X + 17, Y + 28, 17, 4, 0.3);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(X + 3, Y + 16, 2.5, 14);
      ctx.fillRect(X + 26.5, Y + 16, 2.5, 14);
      // counter with goods
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(X + 1, Y + 20, 30, 6);
      const goods = ['#b3432d', '#d8a13c', '#6f7d3e', '#7a3b62', '#e8dcc0'];
      for (let i = 0; i < 5; i++)
        ellipse(
          ctx,
          X + 5 + i * 5.5,
          Y + 20,
          2.3,
          1.8,
          goods[(i + hash(tx, ty, 2)) % goods.length] ?? '#b3432d',
        );
      // striped awning
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? PALETTE.awningA : PALETTE.awningB;
        ctx.beginPath();
        ctx.moveTo(X + i * 8, Y + 2);
        ctx.lineTo(X + i * 8 + 8, Y + 2);
        ctx.lineTo(X + i * 8 + 8, Y + 15);
        ctx.quadraticCurveTo(X + i * 8 + 4, Y + 18, X + i * 8, Y + 15);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(X, Y + 2, TILE, 2);
      return;
    }
    case 'table': {
      softShadow(ctx, X + 18, Y + 27, 15, 4, 0.3);
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(X + 2, Y + 8, 28, 15);
      ctx.fillStyle = shade(PALETTE.wood, 0.15);
      for (let i = 0; i < 4; i++) ctx.fillRect(X + 2, Y + 9 + i * 3.6, 28, 0.6);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(X + 2, Y + 22, 28, 3);
      ctx.fillRect(X + 3, Y + 25, 2, 4);
      ctx.fillRect(X + 27, Y + 25, 2, 4);
      if (hash(tx, ty, 3) % 2 === 0) {
        ellipse(ctx, X + 10, Y + 14, 4, 2.2, '#e8dcc0');
        ellipse(ctx, X + 21, Y + 13, 2.5, 2.5, PALETTE.clay);
      }
      return;
    }
    case 'jars': {
      softShadow(ctx, X + 18, Y + 28, 13, 4, 0.32);
      const jar = (jx: number, jy: number, s: number, col: string): void => {
        ellipse(ctx, jx, jy, 6 * s, 8 * s, col);
        ellipse(ctx, jx - 2 * s, jy - 2 * s, 2 * s, 3.5 * s, rgba('#ffffff', 0.25));
        ellipse(ctx, jx, jy - 8 * s, 3 * s, 1.5 * s, shade(col, -0.25));
        ctx.strokeStyle = rgba('#5c3a1f', 0.6);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(jx, jy - 2 * s, 5.5 * s, 1.5 * s, 0, 0, Math.PI);
        ctx.stroke();
      };
      jar(X + 11, Y + 19, 1, PALETTE.clay);
      jar(X + 22, Y + 22, 0.8, PALETTE.clayDark);
      return;
    }
    case 'cairn': {
      softShadow(ctx, X + 18, Y + 27, 11, 4, 0.35);
      const stone = (sx: number, sy: number, rx: number, ry: number, col: string): void => {
        ellipse(ctx, sx, sy, rx, ry, col);
        ellipse(ctx, sx - rx * 0.3, sy - ry * 0.35, rx * 0.4, ry * 0.3, rgba('#ffffff', 0.3));
      };
      stone(X + 16, Y + 23, 9, 5, '#8d8069');
      stone(X + 16, Y + 16, 7, 4, '#a39478');
      stone(X + 16, Y + 10, 5, 3, '#bcae90');
      return;
    }
    case 'oven': {
      softShadow(ctx, X + 18, Y + 27, 13, 4, 0.3);
      ellipse(ctx, X + 16, Y + 19, 12, 10, PALETTE.clay);
      ellipse(ctx, X + 12, Y + 15, 4, 3, rgba('#ffffff', 0.18));
      ellipse(ctx, X + 16, Y + 13, 5, 3, '#2d2016');
      ellipse(ctx, X + 16, Y + 13, 3, 1.6, rgba('#e3823a', 0.8));
      return;
    }
    case 'well': {
      softShadow(ctx, X + 18, Y + 26, 15, 6, 0.35);
      ellipse(ctx, X + 16, Y + 18, 14, 11, '#9c8a6c');
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ellipse(
          ctx,
          X + 16 + Math.cos(a) * 11.5,
          Y + 18 + Math.sin(a) * 8.5,
          3.5,
          2.6,
          i % 2 ? '#b4a383' : '#a08e6e',
        );
      }
      const grad = ctx.createRadialGradient(X + 16, Y + 18, 1, X + 16, Y + 18, 8);
      grad.addColorStop(0, '#16303a');
      grad.addColorStop(1, '#2f5566');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(X + 16, Y + 18, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(X + 2, Y + 2, 2.5, 16);
      ctx.fillRect(X + 27.5, Y + 2, 2.5, 16);
      ctx.fillRect(X + 2, Y + 2, 28, 2.5);
      ctx.strokeStyle = '#c9b48a';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(X + 16, Y + 4);
      ctx.lineTo(X + 16, Y + 13);
      ctx.stroke();
      ellipse(ctx, X + 16, Y + 14, 2.5, 2, PALETTE.wood);
      return;
    }
    default:
      return;
  }
}

function paintCanopy(ctx: Ctx, kind: TileKind, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 13));
  if (kind === 'olive') {
    // Layered clusters: dark underside, mid tone, silvery highlights.
    for (let i = 0; i < 7; i++)
      lumpy(ctx, X + 5 + r() * 22, Y - 2 + r() * 14, 8 + r() * 3, r, PALETTE.oliveDark, 8);
    for (let i = 0; i < 8; i++)
      lumpy(ctx, X + 5 + r() * 22, Y - 5 + r() * 13, 6 + r() * 3, r, PALETTE.olive, 8);
    for (let i = 0; i < 9; i++)
      ellipse(
        ctx,
        X + 5 + r() * 22,
        Y - 7 + r() * 13,
        2.2 + r(),
        1.2,
        rgba(PALETTE.oliveLight, 0.9),
        r() * Math.PI,
      );
    return;
  }
  if (kind === 'palm') {
    const cx = X + 16;
    const cy = Y + 2;
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + r() * 0.3;
      const len = 15 + r() * 4;
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len * 0.6 + 3;
      const mx = cx + Math.cos(angle) * len * 0.5;
      const my = cy + Math.sin(angle) * len * 0.3 - 5;
      ctx.strokeStyle = i % 2 ? PALETTE.palm : PALETTE.palmLight;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      // leaflets
      ctx.lineWidth = 0.8;
      for (let t = 0.3; t <= 0.95; t += 0.13) {
        const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
        const py = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(angle + 1.3) * 3.2, py + Math.sin(angle + 1.3) * 3.2 + 1);
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(angle - 1.3) * 3.2, py + Math.sin(angle - 1.3) * 3.2 + 1);
        ctx.stroke();
      }
    }
    // date clusters
    for (let i = 0; i < 2; i++) {
      const dx = cx + (i ? 4 : -4);
      for (let d = 0; d < 5; d++)
        ellipse(
          ctx,
          dx + (d % 3) - 1,
          cy + 4 + Math.floor(d / 3) * 1.6,
          1.1,
          1.1,
          mix('#c4631e', '#8a3f14', d / 5),
        );
    }
  }
}

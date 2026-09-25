import type { TileGrid, TileKind } from '@/domain/world';
import { isSolidTile, tileAt } from '@/domain/world';

function isSolidAt(grid: TileGrid, x: number, y: number): boolean {
  return isSolidTile(tileAt(grid, x, y));
}

/**
 * Original procedural tile art (Canvas 2D). Warm, illustrated, stylised —
 * sandstone, olive and ochre — and deliberately not imitating any commercial
 * game. Painting is deterministic per tile so maps look identical every load.
 */
export const TILE = 32;

export const PALETTE = {
  sand: '#e6d0a1',
  sandDark: '#d4b985',
  sandLight: '#f1e0b6',
  scrub: '#cdb97f',
  grassDark: '#7f8f4f',
  grassLight: '#9fae68',
  road: '#cbb38b',
  roadStone: '#b39a72',
  paving: '#d9c8a2',
  pavingLine: '#bba77f',
  floor: '#cfae80',
  floorLine: '#bf9c6c',
  rug: '#9a3f2f',
  rugTrim: '#e2b555',
  wadi: '#bfa47a',
  pebble: '#9f8762',
  mud: '#8d6b48',
  mudShine: '#a88660',
  wall: '#e4d3b1',
  wallMortar: '#c6b089',
  wallShadow: '#b09972',
  roof: '#d8c199',
  roofEdge: '#bca27a',
  water: '#4f8fa8',
  waterLight: '#86bdd0',
  trunk: '#6b5236',
  olive: '#8b9b6a',
  oliveLight: '#b1bf8c',
  palm: '#5f7f3a',
  palmLight: '#86a553',
  rock: '#a89272',
  rockShade: '#86735a',
  rockLight: '#c7b08c',
  redRock: '#b3654a',
  redRockShade: '#8f4a35',
  bush: '#7f7a49',
  wood: '#8a623c',
  woodDark: '#5f4127',
  clay: '#b86f45',
  clayDark: '#8f5232',
  awningA: '#b4452f',
  awningB: '#ecdcb6',
  void: '#2a2018',
} as const;

export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function speckle(
  ctx: Ctx,
  x: number,
  y: number,
  r: () => number,
  colors: readonly string[],
  count: number,
  size = 2,
): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)] ?? colors[0] ?? '#000';
    ctx.fillRect(
      x + Math.floor(r() * (TILE - size)),
      y + Math.floor(r() * (TILE - size)),
      size,
      size,
    );
  }
}

function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Tiles that are drawn on top of a ground tile rather than filling the square. */
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

export function isPropTile(kind: TileKind): boolean {
  return PROP_TILES.has(kind);
}

const NOT_GROUND: ReadonlySet<TileKind> = new Set([
  ...PROP_TILES,
  'wall',
  'roof',
  'door',
  'gate',
  'void',
  'water',
  'fence',
]);

/** The ground a prop stands on: the most common walkable-looking neighbour. */
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
    if (!NOT_GROUND.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
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

export function paintGround(
  ctx: Ctx,
  kind: TileKind,
  tx: number,
  ty: number,
  grid: TileGrid,
): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const r = rng(hash(tx, ty, 7));
  switch (kind) {
    case 'sand':
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x, y, TILE, TILE);
      speckle(ctx, x, y, r, [PALETTE.sandDark, PALETTE.sandLight], 7);
      break;
    case 'scrub':
      ctx.fillStyle = PALETTE.scrub;
      ctx.fillRect(x, y, TILE, TILE);
      speckle(ctx, x, y, r, [PALETTE.sandDark, PALETTE.sandLight], 4);
      for (let i = 0; i < 3; i++) {
        const gx = x + 4 + r() * 22;
        const gy = y + 6 + r() * 20;
        ctx.strokeStyle = r() > 0.5 ? PALETTE.grassDark : PALETTE.grassLight;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx, gy + 5);
        ctx.lineTo(gx - 2, gy);
        ctx.moveTo(gx, gy + 5);
        ctx.lineTo(gx + 1, gy - 1);
        ctx.moveTo(gx, gy + 5);
        ctx.lineTo(gx + 3, gy + 1);
        ctx.stroke();
      }
      break;
    case 'road':
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 4; i++)
        blob(ctx, x + 4 + r() * 24, y + 4 + r() * 24, 3 + r() * 3, 2 + r() * 2, PALETTE.roadStone);
      speckle(ctx, x, y, r, [PALETTE.sandDark], 4);
      break;
    case 'paving':
      ctx.fillStyle = PALETTE.paving;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = PALETTE.pavingLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
      ctx.strokeRect(x + 16.5, y + 0.5, 15, 15);
      ctx.strokeRect(x + 8.5, y + 16.5, 15, 15);
      break;
    case 'floor':
      ctx.fillStyle = PALETTE.floor;
      ctx.fillRect(x, y, TILE, TILE);
      speckle(ctx, x, y, r, [PALETTE.floorLine], 5);
      break;
    case 'rug': {
      // One continuous rug: trim only on its outer edges.
      const edge = (dx: number, dy: number): boolean => tileAt(grid, tx + dx, ty + dy) !== 'rug';
      ctx.fillStyle = PALETTE.rug;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.rugTrim;
      if (edge(0, -1)) ctx.fillRect(x, y + 3, TILE, 3);
      if (edge(0, 1)) ctx.fillRect(x, y + TILE - 6, TILE, 3);
      if (edge(-1, 0)) ctx.fillRect(x + 3, y, 3, TILE);
      if (edge(1, 0)) ctx.fillRect(x + TILE - 6, y, 3, TILE);
      ctx.fillStyle = 'rgba(226,181,85,0.55)';
      ctx.fillRect(x + 14, y + 14, 4, 4);
      break;
    }
    case 'wadi':
      ctx.fillStyle = PALETTE.wadi;
      ctx.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 6; i++)
        blob(
          ctx,
          x + 3 + r() * 26,
          y + 3 + r() * 26,
          1.5 + r() * 2,
          1.2 + r() * 1.5,
          PALETTE.pebble,
        );
      break;
    case 'mud':
      ctx.fillStyle = PALETTE.mud;
      ctx.fillRect(x, y, TILE, TILE);
      blob(ctx, x + 10 + r() * 12, y + 10 + r() * 12, 7, 3, PALETTE.mudShine);
      break;
    case 'steps':
      ctx.fillStyle = PALETTE.paving;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.pavingLine;
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y + 7 + i * 8, TILE, 2);
      break;
    case 'door':
    case 'gate': {
      const below = tileAt(grid, tx, ty + 1);
      ctx.fillStyle = kind === 'gate' ? PALETTE.paving : PALETTE.floor;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(x + 4, y, TILE - 8, below === 'wall' ? TILE : 6);
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(x + 6, y + 2, TILE - 12, 3);
      break;
    }
    case 'wall': {
      const below = tileAt(grid, tx, ty + 1);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = PALETTE.wallMortar;
      ctx.lineWidth = 1;
      for (let row = 0; row < 4; row++) {
        const oy = y + row * 8 + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, oy);
        ctx.lineTo(x + TILE, oy);
        ctx.stroke();
        const off = row % 2 === 0 ? 0 : 8;
        for (let c = off; c < TILE; c += 16) {
          ctx.beginPath();
          ctx.moveTo(x + c + 0.5, oy);
          ctx.lineTo(x + c + 0.5, oy + 8);
          ctx.stroke();
        }
      }
      if (below !== 'wall' && below !== 'roof') {
        ctx.fillStyle = PALETTE.wallShadow;
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
      }
      break;
    }
    case 'roof': {
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(x, y, TILE, TILE);
      speckle(ctx, x, y, r, [PALETTE.roofEdge, PALETTE.sandLight], 5);
      ctx.fillStyle = PALETTE.roofEdge;
      if (tileAt(grid, tx, ty - 1) !== 'roof') ctx.fillRect(x, y, TILE, 4);
      if (tileAt(grid, tx - 1, ty) !== 'roof') ctx.fillRect(x, y, 4, TILE);
      if (tileAt(grid, tx + 1, ty) !== 'roof') ctx.fillRect(x + TILE - 4, y, 4, TILE);
      break;
    }
    case 'water': {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = PALETTE.waterLight;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        const wy = y + 8 + i * 12 + r() * 4;
        ctx.beginPath();
        ctx.moveTo(x + 4 + r() * 6, wy);
        ctx.quadraticCurveTo(x + 16, wy - 3, x + 26, wy);
        ctx.stroke();
      }
      break;
    }
    case 'cliff': {
      ctx.fillStyle = PALETTE.redRock;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.redRockShade;
      for (let i = 0; i < 3; i++) ctx.fillRect(x, y + 6 + i * 10 + Math.floor(r() * 3), TILE, 3);
      speckle(ctx, x, y, r, [PALETTE.rockLight], 3);
      break;
    }
    case 'hill': {
      // Rugged hillside: tonal variation + broken contour strokes so the grid doesn't show.
      const tones = ['#c4a473', '#bf9f6d', '#c9aa79'];
      ctx.fillStyle = tones[Math.floor(r() * tones.length)] ?? '#c4a473';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(140,105,65,0.55)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        const cx = x + r() * 18;
        const cy = y + 6 + r() * 22;
        const len = 8 + r() * 12;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + len / 2, cy - 3 - r() * 3, cx + len, cy);
        ctx.stroke();
      }
      if (r() > 0.7) blob(ctx, x + 6 + r() * 20, y + 8 + r() * 16, 3, 2, 'rgba(110,120,60,0.6)');
      speckle(ctx, x, y, r, ['#b39463', '#d8bd8d'], 5);
      if (!isSolidAt(grid, tx, ty + 1)) {
        ctx.fillStyle = 'rgba(90,60,30,0.22)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
      }
      break;
    }
    case 'fence': {
      paintGround(ctx, 'sand', tx, ty, grid);
      ctx.fillStyle = PALETTE.wallShadow;
      ctx.fillRect(x, y + 12, TILE, 12);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x, y + 10, TILE, 9);
      ctx.strokeStyle = PALETTE.wallMortar;
      ctx.strokeRect(x + 0.5, y + 10.5, 15, 8);
      ctx.strokeRect(x + 16.5, y + 10.5, 15, 8);
      break;
    }
    case 'void':
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(x, y, TILE, TILE);
      break;
    default:
      // Prop tiles: caller paints the base ground first, then paintProp.
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x, y, TILE, TILE);
  }
}

/** Props drawn on top of ground (trees are split: trunk here, crown in the canopy layer). */
export function paintPropTile(ctx: Ctx, kind: TileKind, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const r = rng(hash(tx, ty, 11));
  switch (kind) {
    case 'olive':
      blob(ctx, x + 16, y + 28, 11, 4, 'rgba(60,40,20,0.25)');
      ctx.fillStyle = PALETTE.trunk;
      ctx.fillRect(x + 13, y + 14, 6, 14);
      ctx.fillRect(x + 10, y + 24, 12, 4);
      break;
    case 'palm':
      blob(ctx, x + 16, y + 29, 9, 3, 'rgba(60,40,20,0.25)');
      ctx.fillStyle = PALETTE.trunk;
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 13 + (i % 2), y + 4 + i * 4, 6, 4);
      break;
    case 'rock':
      blob(ctx, x + 16, y + 26, 13, 5, 'rgba(60,40,20,0.25)');
      blob(ctx, x + 16, y + 18, 13, 11, PALETTE.rock);
      blob(ctx, x + 12, y + 14, 6, 4, PALETTE.rockLight);
      blob(ctx, x + 20, y + 23, 7, 3, PALETTE.rockShade);
      break;
    case 'bush':
      blob(ctx, x + 16, y + 26, 11, 4, 'rgba(60,40,20,0.2)');
      for (let i = 0; i < 5; i++)
        blob(
          ctx,
          x + 8 + r() * 16,
          y + 10 + r() * 12,
          6,
          5,
          i % 2 ? PALETTE.bush : PALETTE.grassDark,
        );
      ctx.strokeStyle = PALETTE.woodDark;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 22);
        ctx.lineTo(x + 6 + r() * 20, y + 6 + r() * 10);
        ctx.stroke();
      }
      break;
    case 'stall':
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(x + 3, y + 18, 3, 12);
      ctx.fillRect(x + 26, y + 18, 3, 12);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 === 0 ? PALETTE.awningA : PALETTE.awningB;
        ctx.fillRect(x + i * 8, y + 2, 8, 18);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x, y + 18, TILE, 3);
      break;
    case 'table':
      blob(ctx, x + 16, y + 27, 13, 3, 'rgba(60,40,20,0.25)');
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(x + 2, y + 8, 28, 16);
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(x + 2, y + 22, 28, 3);
      break;
    case 'jars':
      blob(ctx, x + 11, y + 20, 7, 9, PALETTE.clay);
      blob(ctx, x + 22, y + 22, 6, 7, PALETTE.clayDark);
      blob(ctx, x + 11, y + 12, 3, 2, PALETTE.clayDark);
      blob(ctx, x + 22, y + 16, 2.5, 1.5, PALETTE.woodDark);
      break;
    case 'cairn':
      blob(ctx, x + 16, y + 27, 10, 3, 'rgba(60,40,20,0.25)');
      blob(ctx, x + 16, y + 23, 9, 5, PALETTE.rockShade);
      blob(ctx, x + 16, y + 16, 7, 4, PALETTE.rock);
      blob(ctx, x + 16, y + 10, 5, 3, PALETTE.rockLight);
      break;
    case 'oven':
      blob(ctx, x + 16, y + 20, 12, 10, PALETTE.clay);
      blob(ctx, x + 16, y + 14, 5, 3, PALETTE.clayDark);
      break;
    case 'well':
      blob(ctx, x + 16, y + 17, 14, 13, PALETTE.rockShade);
      blob(ctx, x + 16, y + 16, 12, 11, PALETTE.rock);
      blob(ctx, x + 16, y + 16, 8, 7, '#2f4f5f');
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(x + 3, y + 2, 26, 3);
      break;
    default:
      break;
  }
}

/** Crowns that overhang the tile above (drawn above characters). */
export function paintCanopy(ctx: Ctx, kind: TileKind, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const r = rng(hash(tx, ty, 13));
  if (kind === 'olive') {
    for (let i = 0; i < 7; i++) {
      blob(
        ctx,
        x + 6 + r() * 20,
        y - 6 + r() * 16,
        8 + r() * 3,
        7 + r() * 2,
        i % 3 === 0 ? PALETTE.oliveLight : PALETTE.olive,
      );
    }
  } else if (kind === 'palm') {
    ctx.strokeStyle = PALETTE.palm;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + r() * 0.3;
      ctx.lineWidth = 4;
      ctx.strokeStyle = i % 2 ? PALETTE.palm : PALETTE.palmLight;
      ctx.beginPath();
      ctx.moveTo(x + 16, y + 2);
      ctx.quadraticCurveTo(
        x + 16 + Math.cos(angle) * 10,
        y + 2 + Math.sin(angle) * 6 - 6,
        x + 16 + Math.cos(angle) * 18,
        y + 2 + Math.sin(angle) * 12,
      );
      ctx.stroke();
    }
  }
}

export function hasCanopy(kind: TileKind): boolean {
  return kind === 'olive' || kind === 'palm';
}

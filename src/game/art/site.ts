import { tileAt, type TileGrid, type TileKind } from '@/domain/world';

/**
 * Reading a tile map the way a painter would: what stands on what, which
 * walls face the viewer, how tall things are (for cast shadows) and where
 * light comes from. Pure functions over the grid — no canvas — so the rules
 * are unit-tested.
 */

/** Objects standing on the ground (the ground beneath comes from their neighbours). */
const PROP_TILES: ReadonlySet<TileKind> = new Set<TileKind>([
  'olive',
  'palm',
  'fig',
  'rock',
  'bush',
  'stall',
  'table',
  'jars',
  'cairn',
  'oven',
  'well',
  'crate',
  'sacks',
  'basket',
  'loom',
  'cart',
  'tent',
  'trough',
  'crops',
  'reeds',
  'cloth',
  'mat',
  'bedroll',
  'mast',
  'nets',
  'rack',
]);

/** Painted as part of the land or buildings rather than as a standing object. */
const STRUCTURES: ReadonlySet<TileKind> = new Set<TileKind>([
  'wall',
  'roof',
  'cliff',
  'hill',
  'water',
  'void',
  'door',
  'gate',
  'fence',
  // The lake and its boats are painted in their own passes (nature.ts, boats.ts).
  'lake',
  'shallows',
  'hull',
  'boat',
]);

/** Tall things whose tops are drawn above people: trees, and a boat's mast and yard. */
const CANOPIES: ReadonlySet<TileKind> = new Set<TileKind>(['olive', 'palm', 'fig', 'mast']);

/**
 * Height in world units (a tile is 32) — how far a thing's shadow reaches.
 * Flat things (mats, ground) have no entry.
 */
const HEIGHTS: Partial<Record<TileKind, number>> = {
  wall: 46,
  roof: 46,
  cliff: 64,
  hill: 16,
  fence: 12,
  olive: 52,
  palm: 70,
  fig: 58,
  rock: 16,
  bush: 12,
  stall: 30,
  table: 12,
  jars: 16,
  cairn: 16,
  oven: 16,
  well: 12,
  crate: 16,
  sacks: 12,
  basket: 10,
  loom: 30,
  cart: 18,
  tent: 34,
  trough: 8,
  crops: 12,
  reeds: 22,
  cloth: 26,
  mast: 70,
  nets: 26,
  rack: 22,
};

export function isPropTile(kind: TileKind): boolean {
  return PROP_TILES.has(kind);
}

export function isStructure(kind: TileKind): boolean {
  return STRUCTURES.has(kind);
}

export function hasCanopy(kind: TileKind): boolean {
  return CANOPIES.has(kind);
}

export function heightOf(kind: TileKind): number {
  return HEIGHTS[kind] ?? 0;
}

const isBuilding = (k: TileKind): boolean => k === 'wall' || k === 'roof';

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

export interface Site {
  grid: TileGrid;
  /** The tile as authored. */
  kindAt(x: number, y: number): TileKind;
  /** What the ground is at a tile (props resolved to the ground they stand on). */
  groundAt(x: number, y: number): TileKind;
  /** A wall seen from the front: its south side opens onto something you can stand on. */
  isFrontWall(x: number, y: number): boolean;
  /** A doorway or gate set into a building front. */
  isFacadeOpening(x: number, y: number): boolean;
  /** How far a building front rises above its tile (it overlaps the tile above). */
  facadeRise(x: number, y: number): number;
  forEach(fn: (x: number, y: number) => void): void;
}

/** How far a front wall visibly rises into the tile behind it, in world units. */
export const FACADE_RISE = 14;

/**
 * @param options.tallInterior — indoors, the back wall rises a whole tile so
 *   the room feels enclosed (and there's room for shelves, windows, herbs).
 */
export function readSite(
  grid: TileGrid,
  baseTile: TileKind,
  options: { tallInterior?: boolean } = {},
): Site {
  const kindAt = (x: number, y: number): TileKind => tileAt(grid, x, y);
  const inside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < grid.width && y < grid.height;
  const groundAt = (x: number, y: number): TileKind => {
    const k = kindAt(x, y);
    // A boat sits on whatever is around it: the beach it's drawn up on (boats afloat get water from boats.ts).
    return PROP_TILES.has(k) || k === 'fence' || k === 'boat'
      ? groundUnder(grid, x, y, baseTile)
      : k;
  };
  const opensSouth = (x: number, y: number): boolean => {
    if (!inside(x, y + 1)) return false;
    const south = kindAt(x, y + 1);
    return !isBuilding(south) && south !== 'void' && south !== 'cliff';
  };
  const isFrontWall = (x: number, y: number): boolean =>
    kindAt(x, y) === 'wall' && opensSouth(x, y);
  const isFacadeOpening = (x: number, y: number): boolean => {
    const k = kindAt(x, y);
    if (k !== 'door' && k !== 'gate') return false;
    const beside = isBuilding(kindAt(x - 1, y)) || isBuilding(kindAt(x + 1, y));
    return beside && opensSouth(x, y) && isBuilding(kindAt(x, y - 1));
  };
  const facadeRise = (x: number, y: number): number => {
    if (!(isFrontWall(x, y) || isFacadeOpening(x, y)) || !inside(x, y - 1)) return 0;
    const above = kindAt(x, y - 1);
    if (options.tallInterior && above === 'wall') return 32;
    return isBuilding(above) ? FACADE_RISE : 0;
  };
  return {
    grid,
    kindAt,
    groundAt,
    isFrontWall,
    isFacadeOpening,
    facadeRise,
    forEach(fn) {
      for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) fn(x, y);
    },
  };
}

/** A warm light in the world (drawn with a gentle flicker at runtime). */
export interface LightSpot {
  kind: 'hearth' | 'lamp' | 'window';
  /** World units (centre). */
  x: number;
  y: number;
  radius: number;
}

/** Hearth glows at ovens; indoors, lamp niches and windows along the back wall. */
export function findLights(site: Site, indoor: boolean): LightSpot[] {
  const lights: LightSpot[] = [];
  site.forEach((x, y) => {
    if (site.kindAt(x, y) === 'oven')
      lights.push({ kind: 'hearth', x: x * 32 + 16, y: y * 32 + 12, radius: indoor ? 70 : 40 });
  });
  if (indoor) {
    backWallSlots(site).forEach(({ x, y, use }) => {
      if (use === 'window')
        lights.push({ kind: 'window', x: x * 32 + 16, y: y * 32 + 16, radius: 60 });
      if (use === 'lamp') lights.push({ kind: 'lamp', x: x * 32 + 16, y: y * 32 + 14, radius: 34 });
    });
  }
  return lights;
}

/**
 * Decorations along an interior back wall, chosen deterministically: windows
 * spaced apart, lamp niches and shelves between them.
 */
export function backWallSlots(
  site: Site,
): Array<{ x: number; y: number; use: 'window' | 'lamp' | 'shelf' | 'herbs' | 'plain' }> {
  const slots: Array<{
    x: number;
    y: number;
    use: 'window' | 'lamp' | 'shelf' | 'herbs' | 'plain';
  }> = [];
  const pattern = [
    'plain',
    'herbs',
    'window',
    'shelf',
    'lamp',
    'plain',
    'window',
    'shelf',
  ] as const;
  let i = 0;
  site.forEach((x, y) => {
    if (!site.isFrontWall(x, y)) return;
    // Only long runs of wall (not the stubs beside a doorway).
    if (site.kindAt(x - 1, y) !== 'wall' || site.kindAt(x + 1, y) !== 'wall') return;
    slots.push({ x, y, use: pattern[i % pattern.length] ?? 'plain' });
    i++;
  });
  return slots;
}

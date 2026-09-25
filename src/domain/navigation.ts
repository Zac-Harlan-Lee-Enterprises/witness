import { isSolidTile, tileAt, type TileGrid } from './world';

/**
 * Grid navigation shared by the world ("Go to…" / tap-to-move) and content
 * validation (every interactive thing must be reachable from every spawn).
 */
export interface Tile {
  x: number;
  y: number;
}

export type Blocked = (x: number, y: number) => boolean;

export function blockedFn(grid: TileGrid, solidEntities: readonly Tile[]): Blocked {
  const occupied = new Set(solidEntities.map((e) => `${e.x},${e.y}`));
  return (x, y) => isSolidTile(tileAt(grid, x, y)) || occupied.has(`${x},${y}`);
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Breadth-first shortest path (4-directional). Returns the tiles to walk
 * through AFTER `start`, ending on a goal tile; [] if already there; null if
 * unreachable.
 */
export function findPath(
  start: Tile,
  goals: readonly Tile[],
  blocked: Blocked,
  maxNodes = 20_000,
): Tile[] | null {
  const key = (t: Tile): string => `${t.x},${t.y}`;
  const goalSet = new Set(goals.map(key));
  if (goalSet.has(key(start))) return [];
  const prev = new Map<string, string | null>([[key(start), null]]);
  const queue: Tile[] = [start];
  while (queue.length > 0 && prev.size < maxNodes) {
    const cur = queue.shift() as Tile;
    for (const [dx, dy] of DIRS) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      const k = key(next);
      if (prev.has(k) || (blocked(next.x, next.y) && !goalSet.has(k))) continue;
      if (blocked(next.x, next.y)) continue;
      prev.set(k, key(cur));
      if (goalSet.has(k)) {
        const path: Tile[] = [];
        let walk: string | null = k;
        while (walk && walk !== key(start)) {
          const [x, y] = walk.split(',').map(Number) as [number, number];
          path.unshift({ x, y });
          walk = prev.get(walk) ?? null;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Walkable tiles from which a target tile can be interacted with. */
export function approachTiles(target: Tile, targetIsSolid: boolean, blocked: Blocked): Tile[] {
  const around = DIRS.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).filter(
    (t) => !blocked(t.x, t.y),
  );
  return targetIsSolid ? around : [target, ...around];
}

/** Direction to face when standing on `from` and looking at `to`. */
export function facingToward(from: Tile, to: Tile): 'up' | 'down' | 'left' | 'right' {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

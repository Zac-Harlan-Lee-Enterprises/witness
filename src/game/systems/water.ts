import type { TileGrid, TileKind } from '@/domain/world';
import type { WeatherMix } from './weather';

/**
 * Where the water is and how it moves, as pure functions (unit-tested).
 * The world draws a live surface (shimmer, ripples, sun glints, rain rings,
 * wind-driven waves) over every body of water tiles; the art underneath
 * stays as painted or rendered.
 */
export interface WaterRegion {
  /** Bounding box, in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which tiles of the box are water (row-major, w × h). */
  mask: boolean[];
  tiles: number;
}

/** Tiles of open water: a spring's pool, a lake and the shallows at its edge. */
const WATER_KINDS: ReadonlySet<TileKind> = new Set<TileKind>(['water', 'lake', 'shallows']);

/** Connected bodies of water tiles (4-neighbour), largest first. */
export function waterRegions(grid: TileGrid): WaterRegion[] {
  const seen = new Set<number>();
  const regions: WaterRegion[] = [];
  const isWater = (x: number, y: number): boolean => {
    const kind = x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.tiles[y]?.[x];
    return kind !== undefined && kind !== false && WATER_KINDS.has(kind);
  };
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const id = y * grid.width + x;
      if (seen.has(id) || !isWater(x, y)) continue;
      const cells: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[x, y]];
      seen.add(id);
      while (stack.length > 0) {
        const cell = stack.pop() as [number, number];
        cells.push(cell);
        const [cx, cy] = cell;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          const nid = ny * grid.width + nx;
          if (isWater(nx, ny) && !seen.has(nid)) {
            seen.add(nid);
            stack.push([nx, ny]);
          }
        }
      }
      const xs = cells.map((c) => c[0]);
      const ys = cells.map((c) => c[1]);
      const rx = Math.min(...xs);
      const ry = Math.min(...ys);
      const w = Math.max(...xs) - rx + 1;
      const h = Math.max(...ys) - ry + 1;
      const mask = new Array<boolean>(w * h).fill(false);
      for (const [cx, cy] of cells) mask[(cy - ry) * w + (cx - rx)] = true;
      regions.push({ x: rx, y: ry, w, h, mask, tiles: cells.length });
    }
  }
  return regions.sort((a, b) => b.tiles - a.tiles);
}

/**
 * The sun as the water sees it: a direction on the ground plane (x east,
 * y south, unit length) and its height (0–1). Glints lie between the viewer
 * and the sun. Painted places are lit from the upper left; pre-rendered
 * ones from the east-south-east in the morning and the west-south-west late.
 */
export function sunForWater(
  hour: number | null,
  variant: 'painted' | 'day' | 'late' | 'dusk' | 'night',
): { x: number; y: number; height: number } {
  const h = hour === null ? 12 : ((hour % 24) + 24) % 24;
  // Art rendered at dusk or by night has no sun in it to glint.
  const night = h < 5 || h >= 19 || variant === 'dusk' || variant === 'night';
  let x: number;
  let y: number;
  if (variant === 'day') [x, y] = [0.92, 0.38];
  else if (variant !== 'painted') [x, y] = [-0.92, 0.38];
  else {
    // Painted art: light from the upper left, swinging with the hour.
    const t = Math.min(1, Math.max(0, (h - 6) / 12));
    x = 0.9 - 1.8 * t;
    y = -0.45;
  }
  const len = Math.hypot(x, y) || 1;
  const noon = 1 - Math.min(1, Math.abs(h - 12.5) / 7);
  return { x: x / len, y: y / len, height: night ? 0 : 0.2 + 0.7 * noon };
}

export type WaterRgb = readonly [number, number, number];

/**
 * The sky the moving surface reflects and the colour of the water under it,
 * for the light the place is shown in: a pale day sky, a violet dusk, a
 * dark blue night (the art underneath is already that dark, and a day sky
 * over it would light the lake up).
 */
export function waterSky(light: 'painted' | 'day' | 'late' | 'dusk' | 'night'): {
  sky: WaterRgb;
  deep: WaterRgb;
} {
  switch (light) {
    case 'dusk':
      return { sky: [0.5, 0.46, 0.58], deep: [0.05, 0.1, 0.15] };
    case 'night':
      return { sky: [0.14, 0.18, 0.27], deep: [0.015, 0.03, 0.05] };
    default:
      return { sky: [0.78, 0.88, 0.95], deep: [0.05, 0.16, 0.22] };
  }
}

/** The surface's state for the shader: waves, glints, rain rings, darkness. */
export interface WaterLook {
  /** Wave height and speed (calm pool 0.2 … storm 1). */
  waves: number;
  /** How bright sun glints are (0 under cloud or at night). */
  glints: number;
  /** Rain rings (0–1). */
  rain: number;
  /** Foam on wave crests (storms). */
  foam: number;
  /** How much the sky's reflection darkens (cloud). */
  gloom: number;
}

export function waterLook(
  mix: WeatherMix,
  sunHeight: number,
  options: { reducedMotion: boolean; still: boolean },
): WaterLook {
  const wind = Math.min(1, mix.wind);
  return {
    waves: options.reducedMotion ? 0 : 0.22 + 0.78 * wind,
    glints: Math.max(0, sunHeight > 0 ? 1 - mix.cloud * 1.4 : 0) * (options.still ? 0.6 : 1),
    rain: options.reducedMotion ? 0 : mix.rain,
    foam: options.reducedMotion ? 0 : Math.max(0, wind - 0.55) * 2 * mix.storm,
    gloom: Math.min(1, mix.cloud * 0.8 + mix.storm * 0.3),
  };
}

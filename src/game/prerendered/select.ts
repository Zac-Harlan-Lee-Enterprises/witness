import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import type { LookMark } from '@/domain/world';
import type { LightingVariant, PeopleArt } from './manifest';

/**
 * The rules for using pre-rendered art, as pure functions (unit-tested):
 * which places have it, which lighting variant and resolution to load,
 * how sprites sort against people, which sheet draws a person, how shade
 * on the ground tints someone standing in it, and how people turn.
 */

/** Places with pre-rendered art, and where it is served (relative to the site base). */
export const PLACE_ART: Readonly<Record<string, string>> = {
  'jerusalem-market': 'art/jerusalem-market/',
};

export const PEOPLE_ART = 'art/people/';

export function artPathFor(sceneId: string): string | null {
  return PLACE_ART[sceneId] ?? null;
}

/** Later-day light from mid-afternoon; the morning light otherwise. */
export const LATE_FROM_HOUR = 15;

export function variantFor(
  hour: number | null,
  available: readonly LightingVariant[],
): LightingVariant {
  if (hour !== null && hour >= LATE_FROM_HOUR && available.includes('late')) return 'late';
  return 'day';
}

/**
 * Half-resolution art when the view is small enough that it barely shows
 * (below two-thirds of the full set's resolution: phones), saving about
 * 20 MB of texture memory, or when the device has asked for simpler effects.
 */
export function wantsLowResolution(zoom: number, ppu: number, lowPower: boolean): boolean {
  return lowPower || zoom < (ppu * 2) / 3;
}

/** A sprite's ground line (game units) as the tile row people are sorted by. */
export function depthRow(base: number): number {
  return base / 32;
}

/** A stable key for an authored appearance (matches the offline art build). */
export function appearanceKey(a: Appearance): string {
  return [
    a.skin,
    a.hair,
    a.robe,
    a.accent,
    a.headwear,
    a.headwearColor,
    a.beard ? 'beard' : 'clean',
    a.build,
    a.carry,
  ]
    .join('|')
    .toLowerCase();
}

/**
 * The pre-rendered sheet for someone, or null to fall back to the painted
 * figure: sheets are rendered without story marks (bandages, a borrowed
 * cloak), so anyone showing marks is painted instead.
 */
export function sheetFor(
  people: PeopleArt | null,
  appearance: Appearance,
  marks: readonly LookMark[],
): string | null {
  if (!people || marks.length > 0) return null;
  const key = appearanceKey(appearance);
  for (const [id, sheet] of Object.entries(people)) if (sheet.appearance === key) return id;
  return null;
}

export interface ShadeMask {
  width: number;
  height: number;
  /** RGBA bytes; the red channel is sun visibility (255 = full sun). */
  data: Uint8ClampedArray;
}

/** Sun visibility (0–1) at a point in game units, bilinearly sampled. */
export function sampleShade(
  mask: ShadeMask,
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number,
): number {
  const fx = Math.min(mask.width - 1.001, Math.max(0, (x / mapWidth) * mask.width - 0.5));
  const fy = Math.min(mask.height - 1.001, Math.max(0, (y / mapHeight) * mask.height - 0.5));
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const at = (i: number, j: number): number => (mask.data[(j * mask.width + i) * 4] ?? 255) / 255;
  const a = at(ix, iy);
  const b = at(ix + 1, iy);
  const c = at(ix, iy + 1);
  const d = at(ix + 1, iy + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/**
 * Tint for someone standing where the ground gets `visibility` sun: fully
 * lit is untinted; in shade they are dimmer and cooler, like the ground.
 */
export function shadeTint(visibility: number): number {
  const v = Math.min(1, Math.max(0, visibility));
  const r = Math.round(255 * (0.62 + 0.38 * v));
  const g = Math.round(255 * (0.66 + 0.34 * v));
  const b = Math.round(255 * (0.78 + 0.22 * v));
  return (r << 16) | (g << 8) | b;
}

const DIAGONAL: Record<string, string> = {
  'down>right': 'down-right',
  'right>down': 'down-right',
  'down>left': 'down-left',
  'left>down': 'down-left',
  'up>right': 'up-right',
  'right>up': 'up-right',
  'up>left': 'up-left',
  'left>up': 'up-left',
};

const CLOCKWISE: Direction[] = ['up', 'right', 'down', 'left'];

/**
 * The in-between poses when someone turns from one facing to another: one
 * diagonal for a quarter turn; diagonal, side, diagonal for a half turn
 * (turning clockwise). Names are directions or diagonals ("down-right").
 */
export function turnPath(from: Direction, to: Direction): string[] {
  if (from === to) return [];
  const a = CLOCKWISE.indexOf(from);
  const b = CLOCKWISE.indexOf(to);
  const steps = (b - a + 4) % 4;
  if (steps === 2) {
    const side = CLOCKWISE[(a + 1) % 4] as Direction;
    return [DIAGONAL[`${from}>${side}`] ?? side, side, DIAGONAL[`${side}>${to}`] ?? to];
  }
  return [DIAGONAL[`${from}>${to}`] ?? to];
}

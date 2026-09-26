import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import type { LookMark, Pose } from '@/domain/world';
import { naturalColor } from '@/shared/color';
import type { ArtSprite, ArtVariant, LightingVariant, PeopleArt, PeopleLight } from './manifest';

/**
 * The rules for using pre-rendered art, as pure functions (unit-tested):
 * which places have it, which lighting variant and resolution to load,
 * how sprites sort against people, which sheets draw a person (and the
 * overlays for their story marks), how shade on the ground tints someone
 * standing in it, how people turn, and when a canopy fades.
 */

/**
 * Places with pre-rendered art: each has public/art/<id>/manifest.json,
 * written by tools/art/build_place.py. (tests/content/art-assets.test.ts
 * checks this list against the folders, both ways.)
 */
export const PLACES_WITH_ART = [
  'miriam-house',
  'jerusalem-market',
  'jericho-road',
  'jericho',
  'tamar-house',
  'bethlehem-lanes',
  'shepherds-fields',
] as const;

/** Where each place's art is served (relative to the site base). */
export const PLACE_ART: Readonly<Record<string, string>> = Object.fromEntries(
  PLACES_WITH_ART.map((id) => [id, `art/${id}/`]),
);

export const PEOPLE_ART = 'art/people/';

export function artPathFor(sceneId: string): string | null {
  return PLACE_ART[sceneId] ?? null;
}

/** Later-day light from mid-afternoon; the morning light otherwise. */
export const LATE_FROM_HOUR = 15;
/** Night art from dusk (when the world's lamps start to glow) until before dawn. */
export const NIGHT_FROM_HOUR = 18;
export const NIGHT_UNTIL_HOUR = 5;

export function isNightHour(hour: number | null): boolean {
  if (hour === null) return false;
  const h = ((hour % 24) + 24) % 24;
  return h >= NIGHT_FROM_HOUR || h < NIGHT_UNTIL_HOUR;
}

/**
 * The light to draw a place in: its night art after dark, its later-day art
 * from mid-afternoon, else its morning art; if it has no art in that light,
 * the nearest it has (a place is rendered only in the lights its story shows).
 */
export function variantFor(
  hour: number | null,
  available: readonly LightingVariant[],
): LightingVariant {
  const wanted: LightingVariant = isNightHour(hour)
    ? 'night'
    : hour !== null && hour >= LATE_FROM_HOUR
      ? 'late'
      : 'day';
  return variantOrder(wanted).find((v) => available.includes(v)) ?? wanted;
}

/**
 * The light a place already drawn should change to as the story clock moves
 * on (the sun sets while you are in the fields), or null to stay as it is.
 */
export function relightTo(
  loaded: LightingVariant,
  hour: number | null,
  available: readonly LightingVariant[],
): LightingVariant | null {
  const wanted = variantFor(hour, available);
  return wanted === loaded ? null : wanted;
}

/** A light and then the others, nearest first (what stands in when one is missing). */
function variantOrder(wanted: LightingVariant): LightingVariant[] {
  if (wanted === 'night') return ['night', 'late', 'day'];
  if (wanted === 'late') return ['late', 'day', 'night'];
  return ['day', 'late', 'night'];
}

/**
 * The sets to try loading, in order: the light wanted, then (should it fail,
 * offline before it was cached) the morning's if the place has one, else
 * the nearest light it has.
 */
export function variantLoadOrder(
  wanted: LightingVariant,
  available: readonly LightingVariant[],
): LightingVariant[] {
  if (available.includes('day')) return wanted === 'day' ? ['day'] : [wanted, 'day'];
  return variantOrder(wanted).filter((v) => available.includes(v));
}

/**
 * How people are lit in a place: indoors by the room's own light (lamps and
 * the hearth after dark), else by the place's sun or moon.
 */
export function peopleLightFor(variant: LightingVariant, room: 'indoor' | undefined): PeopleLight {
  if (room) return variant === 'night' ? 'lamplight' : room;
  return variant;
}

/** A people light and then those that may stand in for it, nearest first. */
export function peopleLightOrder(light: PeopleLight): PeopleLight[] {
  switch (light) {
    case 'lamplight':
      return ['lamplight', 'indoor', 'night', 'day', 'late'];
    case 'night':
      return ['night', 'late', 'day', 'lamplight', 'indoor'];
    case 'indoor':
      return ['indoor', 'day', 'late', 'lamplight', 'night'];
    case 'late':
      return ['late', 'day', 'indoor', 'night', 'lamplight'];
    case 'day':
      return ['day', 'late', 'indoor', 'night', 'lamplight'];
  }
}

/**
 * Half-resolution art when the view is small enough that it barely shows
 * (below two-thirds of the full set's resolution: phones), saving about
 * three quarters of the texture memory, or when the device has asked for
 * simpler effects. (No texture is bigger than MAX_ART_TEXTURE, so the GPU's
 * own limit never forces it.)
 */
export function wantsLowResolution(zoom: number, ppu: number, lowPower: boolean): boolean {
  return lowPower || zoom < (ppu * 2) / 3;
}

/** Where a ground tile goes in the world (game units), from its pixel offset and the ground's ppu. */
export function tileOrigin(tile: { x: number; y: number }, ppu: number): { x: number; y: number } {
  return { x: tile.x / ppu, y: tile.y / ppu };
}

/**
 * The sprite atlas pages to load, and the scale of their pixels against the
 * manifest's (1, or 0.5 for the half-resolution pages when the view asked
 * for low resolution and they exist).
 */
export function pagesFor(
  variant: Pick<ArtVariant, 'pages' | 'pagesLow'>,
  low: boolean,
): { files: readonly string[]; scale: number } {
  if (low && variant.pagesLow && variant.pagesLow.length === variant.pages.length)
    return { files: variant.pagesLow, scale: 0.5 };
  return { files: variant.pages, scale: 1 };
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

/** Marks that change the body itself (so they have sheets of their own, not overlays). */
export const BODY_MARKS: readonly LookMark[] = ['torn-hem'];

/** Overlays draw in this order, bottom to top. */
const OVERLAY_ORDER: readonly LookMark[] = [
  'wrapped-in-cloak',
  'cloak-roll',
  'water-skin',
  'lamp',
  'bandaged',
  'rag-bandaged',
];

export interface FigureSheets {
  /** The sheet that draws the person (with any body marks built in). */
  base: string;
  /** Overlay sheets for the other marks, bottom to top. */
  overlays: string[];
}

const sameMarks = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().every((m, i) => m === [...b].sort()[i]);

/**
 * The pre-rendered sheets that draw someone with these story marks in this
 * pose, or null to paint them instead (no sheet for them, or a mark without
 * art). `rag` is the colour of the player's tunic, for bandages torn from it.
 */
export function pickSheets(
  people: PeopleArt | null,
  appearance: Appearance,
  marks: readonly LookMark[],
  pose: Pose = 'stand',
  rag: string | null = null,
): FigureSheets | null {
  if (!people) return null;
  const key = appearanceKey(appearance);
  const entries = Object.entries(people).filter(([, s]) => s.appearance === key && s.pose === pose);
  const body = marks.filter((m) => BODY_MARKS.includes(m));
  const base = entries.find(([, s]) => !s.overlay && sameMarks(s.marks, body));
  // Overlays are made over the sheet without body marks.
  const plain = entries.find(([, s]) => !s.overlay && s.marks.length === 0);
  if (!base || !plain) return null;
  const want = rag ? naturalColor(rag).toLowerCase() : null;
  const overlays: string[] = [];
  for (const mark of OVERLAY_ORDER) {
    if (!marks.includes(mark)) continue;
    const found = entries.find(
      ([, s]) =>
        s.overlay?.of === plain[0] &&
        s.overlay.mark === mark &&
        (mark !== 'rag-bandaged' || s.overlay.rag === want),
    );
    if (!found) return null;
    overlays.push(found[0]);
  }
  if (marks.some((m) => !BODY_MARKS.includes(m) && !OVERLAY_ORDER.includes(m))) return null;
  return { base: base[0], overlays };
}

/**
 * Every sheet a place may need, loaded before it is shown so the story can
 * change how people look without a pause: for each appearance present,
 * all its sheets (standing, at rest, with body marks, overlays), except
 * bandages torn from another tunic than the player's (`rag`); and the
 * passers-by if the place has any.
 */
export function sheetsToLoad(
  people: PeopleArt,
  appearances: readonly Appearance[],
  crowd: boolean,
  rag: string | null = null,
): string[] {
  const keys = new Set(appearances.map(appearanceKey));
  const want = rag ? naturalColor(rag).toLowerCase() : null;
  return Object.entries(people)
    .filter(([id, s]) => keys.has(s.appearance) || (crowd && id.startsWith('crowd-')))
    .filter(([, s]) => s.overlay?.rag === undefined || s.overlay.rag === want)
    .map(([id]) => id)
    .sort();
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

/** How far a canopy fades while someone is behind it. */
export const CANOPY_FADED = 0.38;

/**
 * Whether someone standing at (x, y) (their feet, game units) is hidden by
 * a canopy sprite: they are behind its trunk's ground line, and their body
 * (about 50 units tall) overlaps the middle of its box (crowns are round,
 * so the corners are left out).
 */
export function behindCanopy(
  sprite: Pick<ArtSprite, 'x' | 'y' | 'w' | 'h' | 'base'>,
  ppu: number,
  x: number,
  y: number,
): boolean {
  if (y >= sprite.base) return false;
  const w = sprite.w / ppu;
  const h = sprite.h / ppu;
  const insetX = w * 0.15;
  const insetY = h * 0.1;
  const left = sprite.x + insetX;
  const right = sprite.x + w - insetX;
  const top = sprite.y + insetY;
  const bottom = sprite.y + h - insetY;
  return x + 8 > left && x - 8 < right && y > top && y - 50 < bottom;
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

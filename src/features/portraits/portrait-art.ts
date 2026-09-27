import { appearanceKey } from '@/domain/appearance-key';
import type { Appearance } from '@/domain/characters';
import type { Expression } from '@/domain/dialogue';
import manifest from './portrait-manifest.json';

/**
 * Pre-rendered portraits (tools/art/build_portraits.py → public/art/portraits).
 *
 * The manifest is written by the art build next to this file and bundled, so
 * the menus know which portraits exist without a network request. Each entry
 * records the appearance key it was rendered from: a portrait is only used
 * while the person still looks that way, otherwise the drawn portrait is.
 *
 * Each person has a neutral portrait (`<id>-<size>.webp`) and one for each
 * expression their lines carry (`<expression>/<id>-<size>.webp`, listed in
 * the entry's `expressions`).
 */
export interface PortraitEntry {
  /** appearanceKey() of the appearance the portrait was rendered from. */
  appearance: string;
  kind: string;
  /** Expressions other than neutral rendered for this person. */
  expressions?: readonly string[];
}

export type PortraitManifest = Readonly<Record<string, PortraitEntry>>;

/**
 * Square sizes (px) rendered for every portrait: `<id>-<size>.webp`, all
 * offered to the browser, which picks by display size and pixel density
 * (a 104 px dialogue portrait takes 256 px at 2x, 512 px at 3x; a 152 px
 * one takes 512 px at 2x and 3x).
 */
export const PORTRAIT_SIZES = [128, 256, 512] as const;

export const PORTRAIT_DIR = 'art/portraits/';

const BUNDLED: PortraitManifest = manifest;

export interface PortraitImage {
  id: string;
  /** The expression shown: the one asked for if it was rendered, else neutral. */
  expression: Expression;
  src: string;
  srcSet: string;
}

/** For each manifest: appearance key → the first portrait id (sorted) rendered from it. */
const byAppearance = new WeakMap<PortraitManifest, ReadonlyMap<string, string>>();

function appearanceIndex(entries: PortraitManifest): ReadonlyMap<string, string> {
  let index = byAppearance.get(entries);
  if (!index) {
    const map = new Map<string, string>();
    for (const id of Object.keys(entries).sort()) {
      const key = entries[id]?.appearance;
      if (key !== undefined && !map.has(key)) map.set(key, id);
    }
    index = map;
    byAppearance.set(entries, index);
  }
  return index;
}

/** Where a portrait's files are: neutral at the top, each expression in its own folder. */
export function portraitFolder(expression: Expression): string {
  return expression === 'neutral' ? PORTRAIT_DIR : `${PORTRAIT_DIR}${expression}/`;
}

/**
 * The rendered portrait for someone, or null if there is none for how they
 * look now. `characterId` picks that person's own portrait when two people
 * share an appearance; players (and anyone else) are found by appearance.
 * `expression` picks the face for a line, falling back to neutral when that
 * expression wasn't rendered for them.
 */
export function portraitImage(
  appearance: Appearance,
  characterId: string | null = null,
  expression: Expression = 'neutral',
  entries: PortraitManifest = BUNDLED,
  base: string = import.meta.env.BASE_URL,
): PortraitImage | null {
  const key = appearanceKey(appearance);
  const own = characterId ? entries[characterId] : undefined;
  // Built once per manifest: Portrait renders on every typewriter tick.
  const id = own?.appearance === key ? characterId : (appearanceIndex(entries).get(key) ?? null);
  if (!id) return null;
  const shown: Expression =
    expression !== 'neutral' && entries[id]?.expressions?.includes(expression) === true
      ? expression
      : 'neutral';
  const url = (size: number) => `${base}${portraitFolder(shown)}${id}-${size}.webp`;
  return {
    id,
    expression: shown,
    src: url(256),
    srcSet: PORTRAIT_SIZES.map((s) => `${url(s)} ${s}w`).join(', '),
  };
}

/**
 * Load and decode portraits ahead of time (everyone in a chapter at its
 * start; the faces a conversation will need when it opens), so the first
 * time someone speaks, or changes expression, their portrait appears at
 * once. Failures are ignored: the portrait falls back when shown.
 */
export function preloadPortraits(
  people: ReadonlyArray<{ appearance: Appearance; id?: string | null; expression?: Expression }>,
  size: number,
): void {
  if (typeof Image === 'undefined') return;
  for (const p of people) {
    const art = portraitImage(p.appearance, p.id ?? null, p.expression ?? 'neutral');
    if (!art) continue;
    const img = new Image();
    img.sizes = `${size}px`;
    img.srcset = art.srcSet;
    img.src = art.src;
    if (typeof img.decode === 'function') img.decode().catch(() => undefined);
  }
}

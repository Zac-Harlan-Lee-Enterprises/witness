import { appearanceKey } from '@/domain/appearance-key';
import type { Appearance } from '@/domain/characters';
import manifest from './portrait-manifest.json';

/**
 * Pre-rendered portraits (tools/art/build_portraits.py → public/art/portraits).
 *
 * The manifest is written by the art build next to this file and bundled, so
 * the menus know which portraits exist without a network request. Each entry
 * records the appearance key it was rendered from: a portrait is only used
 * while the person still looks that way, otherwise the drawn portrait is.
 */
export interface PortraitEntry {
  /** appearanceKey() of the appearance the portrait was rendered from. */
  appearance: string;
  kind: string;
}

export type PortraitManifest = Readonly<Record<string, PortraitEntry>>;

/**
 * Square sizes (px) rendered for every portrait: `<id>-<size>.webp`, all
 * offered to the browser, which picks by display size and pixel density
 * (a 104 px dialogue portrait takes 256 px at 2x, 512 px at 3x).
 */
export const PORTRAIT_SIZES = [128, 256, 512] as const;

export const PORTRAIT_DIR = 'art/portraits/';

const BUNDLED: PortraitManifest = manifest;

export interface PortraitImage {
  id: string;
  src: string;
  srcSet: string;
}

/**
 * The rendered portrait for someone, or null if there is none for how they
 * look now. `characterId` picks that person's own portrait when two people
 * share an appearance; players (and anyone else) are found by appearance.
 */
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

export function portraitImage(
  appearance: Appearance,
  characterId: string | null = null,
  entries: PortraitManifest = BUNDLED,
  base: string = import.meta.env.BASE_URL,
): PortraitImage | null {
  const key = appearanceKey(appearance);
  const own = characterId ? entries[characterId] : undefined;
  // Built once per manifest: Portrait renders on every typewriter tick.
  const id = own?.appearance === key ? characterId : (appearanceIndex(entries).get(key) ?? null);
  if (!id) return null;
  const url = (size: number) => `${base}${PORTRAIT_DIR}${id}-${size}.webp`;
  return {
    id,
    src: url(256),
    srcSet: PORTRAIT_SIZES.map((s) => `${url(s)} ${s}w`).join(', '),
  };
}

/**
 * Load and decode portraits ahead of time (e.g. everyone in a chapter), so
 * the first time someone speaks their portrait appears at once. Failures are
 * ignored: the portrait falls back to its drawing when shown.
 */
export function preloadPortraits(
  people: ReadonlyArray<{ appearance: Appearance; id?: string | null }>,
  size: number,
): void {
  if (typeof Image === 'undefined') return;
  for (const p of people) {
    const art = portraitImage(p.appearance, p.id ?? null);
    if (!art) continue;
    const img = new Image();
    img.sizes = `${size}px`;
    img.srcset = art.srcSet;
    img.src = art.src;
    if (typeof img.decode === 'function') img.decode().catch(() => undefined);
  }
}

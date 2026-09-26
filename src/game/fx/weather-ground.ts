import type { TileKind } from '@/domain/world';

/** Hard or packed ground where rain collects in puddles (every chapter's paving, floors, decks). */
const PUDDLE_GROUND: ReadonlySet<TileKind> = new Set<TileKind>([
  'paving',
  'road',
  'sand',
  'mud',
  'floor',
  'steps',
  'deck',
  'jetty',
  'shingle',
  'mosaic',
  'roman-road',
  'bridge',
]);

/** Open water and the void beyond the map: rain makes rings there, not splashes. */
const NO_SPLASH: ReadonlySet<TileKind> = new Set<TileKind>(['water', 'lake', 'shallows', 'void']);

export function takesPuddles(kind: TileKind): boolean {
  return PUDDLE_GROUND.has(kind);
}

export function takesSplashes(kind: TileKind): boolean {
  return !NO_SPLASH.has(kind);
}

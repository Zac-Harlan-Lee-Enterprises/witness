import type { TileKind } from '@/domain/world';
import type { FootstepSurface } from './ports';

/**
 * Which footstep sound a tile makes. Walkable tiles only; anything else (a
 * wall, a tree) never has a foot on it, but maps to earth to be safe.
 */
const SURFACES: Partial<Record<TileKind, FootstepSurface>> = {
  paving: 'stone',
  steps: 'stone',
  door: 'stone',
  gate: 'stone',
  road: 'gravel',
  wadi: 'gravel',
  sand: 'sand',
  scrub: 'earth',
  soil: 'earth',
  floor: 'earth',
  grass: 'grass',
  mud: 'mud',
  rug: 'mat',
  mat: 'mat',
  bedroll: 'mat',
  // Chapter 2: the lake shore, a basalt jetty, a boat's planked deck.
  shingle: 'gravel',
  jetty: 'stone',
  deck: 'wood',
  // Chapter 3: straw on the animals' floor, the plastered family floor, a threshing floor.
  straw: 'mat',
  platform: 'stone',
  threshing: 'earth',
  // Chapter 4: mosaic floors, a paved Roman highway, a stone bridge.
  mosaic: 'stone',
  'roman-road': 'stone',
  bridge: 'stone',
};

export function footstepSurface(kind: TileKind): FootstepSurface {
  return SURFACES[kind] ?? 'earth';
}

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
};

export function footstepSurface(kind: TileKind): FootstepSurface {
  return SURFACES[kind] ?? 'earth';
}

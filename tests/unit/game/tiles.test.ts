import { describe, expect, it } from 'vitest';
import type { TileGrid, TileKind } from '@/domain/world';
import { groundUnder, hasCanopy, isPropTile } from '@/game/art/tiles';

const grid = (rows: TileKind[][]): TileGrid => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  tiles: rows,
});

describe('tile art rules', () => {
  it('a prop takes the ground of its most common neighbour', () => {
    const g = grid([
      ['road', 'road', 'sand'],
      ['road', 'rock', 'road'],
      ['sand', 'road', 'road'],
    ]);
    expect(groundUnder(g, 1, 1, 'sand')).toBe('road');
  });

  it('a rock or bush inside the hills sits on hill, not on a pale ground square', () => {
    const g = grid([
      ['hill', 'hill', 'hill'],
      ['hill', 'bush', 'road'],
      ['hill', 'hill', 'road'],
    ]);
    expect(groundUnder(g, 1, 1, 'sand')).toBe('hill');
  });

  it('never picks walls or other props as ground', () => {
    const g = grid([
      ['wall', 'wall', 'wall'],
      ['olive', 'jars', 'olive'],
      ['wall', 'floor', 'wall'],
    ]);
    expect(groundUnder(g, 1, 1, 'sand')).toBe('floor');
  });

  it('knows which tiles are props and which have tree canopies', () => {
    expect(isPropTile('palm')).toBe(true);
    expect(isPropTile('road')).toBe(false);
    expect(hasCanopy('olive')).toBe(true);
    expect(hasCanopy('rock')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { TileGrid, TileKind } from '@/domain/world';
import { LOOKS, luminance, shadowOffset } from '@/game/art/direction';
import { backWallSlots, findLights, readSite } from '@/game/art/site';

const grid = (rows: string[], legend: Record<string, TileKind>): TileGrid => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  tiles: rows.map((r) => [...r].map((c) => legend[c] ?? 'sand')),
});

describe('art direction', () => {
  it('gives each place its own palette and building material', () => {
    const materials = Object.values(LOOKS).map((l) => l.building.material);
    expect(new Set(materials)).toEqual(new Set(['plaster', 'limestone', 'mudbrick']));
    expect(LOOKS.oasis.ground.grass).not.toBe(LOOKS.city.ground.grass);
    // Jericho is green; Jerusalem's paving is pale stone.
    const g = parseInt(LOOKS.oasis.ground.grass.slice(3, 5), 16);
    const r = parseInt(LOOKS.oasis.ground.grass.slice(1, 3), 16);
    expect(g).toBeGreaterThan(r);
  });

  it('keeps a readable value structure: shadows much darker than the ground they fall on', () => {
    for (const look of Object.values(LOOKS)) {
      expect(luminance(look.ground.sand) - luminance(look.shadow.color)).toBeGreaterThan(0.3);
      expect(luminance(look.building.face)).toBeGreaterThan(luminance(look.shadow.color));
    }
  });

  it('casts longer shadows in the wilderness than in the city, all down-right', () => {
    const road = shadowOffset(LOOKS.wilderness, 46);
    const city = shadowOffset(LOOKS.city, 46);
    expect(road.dx).toBeGreaterThan(city.dx);
    expect(road.dx).toBeGreaterThan(0);
    expect(road.dy).toBeGreaterThan(0);
  });
});

describe('reading a site', () => {
  const legend: Record<string, TileKind> = {
    '#': 'wall',
    '^': 'roof',
    '.': 'sand',
    D: 'door',
    o: 'oven',
    r: 'rock',
  };

  it('finds building fronts and lets them rise over the roof behind', () => {
    const site = readSite(grid(['^^^^', '^^^^', '##D#', '....'], legend), 'sand');
    expect(site.isFrontWall(0, 2)).toBe(true);
    expect(site.isFrontWall(0, 1)).toBe(false);
    expect(site.isFacadeOpening(2, 2)).toBe(true);
    expect(site.facadeRise(0, 2)).toBeGreaterThan(0);
  });

  it('gives an interior back wall a full extra tile of height', () => {
    const room = grid(['#####', '#####', '#...#', '#####'], legend);
    expect(readSite(room, 'floor', { tallInterior: true }).facadeRise(2, 1)).toBe(32);
    expect(readSite(room, 'floor').facadeRise(2, 1)).toBeLessThan(32);
  });

  it('decorates long interior walls and lights hearths and windows', () => {
    const room = grid(['##########', '##########', '#...o....#', '##########'], legend);
    const site = readSite(room, 'floor', { tallInterior: true });
    const slots = backWallSlots(site);
    expect(slots.length).toBeGreaterThan(3);
    expect(slots.some((s) => s.use === 'window')).toBe(true);
    const lights = findLights(site, true);
    expect(lights.some((l) => l.kind === 'hearth')).toBe(true);
    expect(lights.some((l) => l.kind === 'window')).toBe(true);
  });

  it('puts props and low walls on the ground around them', () => {
    const site = readSite(grid(['.....', '..r..', '.....'], legend), 'grass');
    expect(site.groundAt(2, 1)).toBe('sand');
  });
});

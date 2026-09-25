import type { TileGrid, TileKind } from '@/domain/world';
import { paintBuildings } from './architecture';
import { lookFor, type Mood } from './direction';
import { paintFurnishing } from './furnishings';
import {
  CANOPY_BOX,
  paintCanopy,
  paintCliffs,
  paintHills,
  paintNatureProp,
  paintTrunk,
  paintWater,
} from './nature';
import { hash, makeCanvas, TILE, withOutline, type Ctx } from './paint';
import { paintInteriorLight, paintShadows } from './shading';
import { findLights, hasCanopy, isPropTile, readSite, type LightSpot } from './site';
import { paintGround } from './terrain';

/** A tree top drawn above characters; x/y is the canvas's top-left in world units. */
export interface CanopyPiece {
  kind: TileKind;
  x: number;
  y: number;
  /** Where the trunk meets the crown (for gentle swaying). */
  pivotX: number;
  pivotY: number;
  canvas: HTMLCanvasElement;
}

export interface PaintedScene {
  ground: HTMLCanvasElement;
  canopies: CanopyPiece[];
  lights: LightSpot[];
}

/** The ink line around people and objects (never around terrain). */
const INK = 'rgba(38,22,10,0.82)';
const PROP_MARGIN = 16;

/**
 * Paint a whole place once, in passes: ground → raised land → water →
 * cast shadows → cliffs → buildings → indoor light → objects → tree tops.
 */
export function paintScene(
  grid: TileGrid,
  baseTile: TileKind,
  mood: Mood,
  indoor: boolean,
  doc: Document = document,
): PaintedScene {
  const look = lookFor(mood);
  const site = readSite(grid, baseTile, { tallInterior: indoor });
  const ground = makeCanvas(grid.width * TILE, grid.height * TILE, doc);
  const canopies: CanopyPiece[] = [];
  const g = ground.ctx;
  if (!g) return { ground: ground.canvas, canopies, lights: [] };

  paintGround(g, site, look, doc);
  paintShadows(g, site, look, doc, 'hills');
  paintHills(g, site, look);
  paintWater(g, site, look);
  paintShadows(g, site, look, doc, 'rest');
  paintCliffs(g, site);
  paintBuildings(g, site, look);
  if (indoor) paintInteriorLight(g, site, look);

  // Objects, each with an ink outline. Flat ones (mats) first so upright things overlap them.
  const props: Array<[number, number, TileKind]> = [];
  site.forEach((x, y) => {
    const k = site.kindAt(x, y);
    if (isPropTile(k)) props.push([x, y, k]);
  });
  const flat = (k: TileKind): boolean => k === 'mat' || k === 'bedroll';
  props.sort((a, b) => Number(flat(b[2])) - Number(flat(a[2])) || a[1] - b[1]);
  for (const [x, y, k] of props) paintObject(g, k, x, y, look, doc);

  for (const [x, y, k] of props) {
    if (!hasCanopy(k)) continue;
    const piece = makeCanvas(CANOPY_BOX.width, CANOPY_BOX.height, doc);
    if (!piece.ctx) continue;
    const seed = hash(x, y, 13);
    withOutline(
      piece.ctx,
      0,
      0,
      CANOPY_BOX.width,
      CANOPY_BOX.height,
      INK,
      (c) => paintCanopy(c, k, look, seed),
      doc,
      0.6,
    );
    const left = x * TILE - CANOPY_BOX.left;
    const top = y * TILE - CANOPY_BOX.top;
    canopies.push({
      kind: k,
      x: left,
      y: top,
      pivotX: x * TILE + 16,
      pivotY: y * TILE + (k === 'palm' ? 1 : 8),
      canvas: piece.canvas,
    });
  }
  return { ground: ground.canvas, canopies, lights: findLights(site, indoor) };
}

function paintObject(
  g: Ctx,
  kind: TileKind,
  x: number,
  y: number,
  look: ReturnType<typeof lookFor>,
  doc: Document,
): void {
  const seed = hash(x, y, 11);
  const size = TILE + PROP_MARGIN * 2;
  withOutline(
    g,
    x * TILE - PROP_MARGIN,
    y * TILE - PROP_MARGIN,
    size,
    size,
    INK,
    (c) => {
      c.translate(PROP_MARGIN, PROP_MARGIN);
      if (!paintTrunk(c, kind, seed) && !paintNatureProp(c, kind, look, seed))
        paintFurnishing(c, kind, look, seed);
    },
    doc,
    kind === 'mat' || kind === 'bedroll' ? 0.4 : 0.7,
  );
}

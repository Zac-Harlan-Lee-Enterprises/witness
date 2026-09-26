import type { TileKind } from '@/domain/world';
import type { Look } from './direction';
import { ellipse, fbm, hash, lumpy, rgba, rng, shade, type Ctx, TILE } from './paint';
import { groundUnder, type Site } from './site';
import { groundColor } from './terrain';

/**
 * Boats of the lake, loosely after the first-century boat recovered at
 * Ginosar in 1986: a low, round-bottomed hull of planks, one mast with a
 * square sail on a yard, oars along the sides and a steering oar at the
 * stern.
 *
 *  - Neighbouring `boat` tiles form ONE boat shaped to its footprint: afloat
 *    (with oars, a mast and sail) or drawn up on the shore (mast lowered,
 *    gear inside). Long footprints lie east–west, tall ones north–south.
 *  - The boat you are aboard is its `hull` rim around walkable `deck`, with
 *    a `mast` stepped in it (the mast's top is a canopy drawn above people).
 */
const HULL = '#4a3521';
const PLANK = '#8e653d';
const RAIL = '#b3895a';
const BILGE = '#6a4a2e';
const DECK = '#a27d52';
const SAIL = '#e8dec4';
const ROPE = '#c9b184';
const WOOD_DARK = '#4f3520';
const FOAM = '#e6f0ec';

/** Open water and shallows (nature.ts paints them; boats float on the same colours). */
export const LAKE_DEEP = '#2d5e71';
export const LAKE_SHALLOW = '#5f978f';

interface Footprint {
  x: number;
  y: number;
  w: number;
  h: number;
  tiles: Array<[number, number]>;
  /** Mostly surrounded by water (a boat pulled up at the water's edge is not). */
  afloat: boolean;
  /** Deep water alongside (else the shallows). */
  deep: boolean;
  /** Bow direction along the long axis: +1 east/south, -1 west/north. */
  bow: 1 | -1;
}

const WET: ReadonlySet<TileKind> = new Set<TileKind>(['lake', 'shallows', 'water']);

/** Connected groups of tiles (4-neighbour) whose kind passes `member`, as bounding boxes. */
function footprints(site: Site, member: (k: TileKind) => boolean, needs?: TileKind): Footprint[] {
  const { width, height } = site.grid;
  const seen = new Set<number>();
  const out: Footprint[] = [];
  site.forEach((sx, sy) => {
    if (seen.has(sy * width + sx) || !member(site.kindAt(sx, sy))) return;
    let x0 = sx;
    let x1 = sx;
    let y0 = sy;
    let y1 = sy;
    let wet = 0;
    let dry = 0;
    let deep = false;
    let hasNeeded = needs === undefined;
    const tiles: Array<[number, number]> = [];
    const stack: Array<[number, number]> = [[sx, sy]];
    seen.add(sy * width + sx);
    while (stack.length > 0) {
      const [x, y] = stack.pop() as [number, number];
      tiles.push([x, y]);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      if (site.kindAt(x, y) === needs) hasNeeded = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const k = site.kindAt(nx, ny);
        if (seen.has(ny * width + nx)) continue;
        if (!member(k)) {
          if (WET.has(k)) wet++;
          else dry++;
          if (k === 'lake') deep = true;
          continue;
        }
        seen.add(ny * width + nx);
        stack.push([nx, ny]);
      }
    }
    if (!hasNeeded) return;
    const afloat = wet > dry;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    // Point the bow at open water when drawn up on a beach; otherwise east (or south).
    const horizontal = w >= h;
    const wetBefore = horizontal
      ? WET.has(site.kindAt(x0 - 1, y0 + Math.floor(h / 2)))
      : WET.has(site.kindAt(x0 + Math.floor(w / 2), y0 - 1));
    const wetAfter = horizontal
      ? WET.has(site.kindAt(x1 + 1, y0 + Math.floor(h / 2)))
      : WET.has(site.kindAt(x0 + Math.floor(w / 2), y1 + 1));
    const bow: 1 | -1 = !afloat && wetBefore && !wetAfter ? -1 : 1;
    out.push({ x: x0, y: y0, w, h, tiles, afloat, deep, bow });
  });
  return out;
}

/** The hull outline in local coordinates: bow at +half, a rounder stern at -half. */
function lens(c: Ctx, half: number, beam: number, inset: number): void {
  const hl = half - inset;
  const hb = beam / 2 - inset;
  c.beginPath();
  c.moveTo(hl, 0);
  c.bezierCurveTo(hl * 0.55, -hb * 1.08, -hl * 0.45, -hb * 1.04, -hl * 0.9, -hb * 0.58);
  c.quadraticCurveTo(-hl * 1.03, 0, -hl * 0.9, hb * 0.58);
  c.bezierCurveTo(-hl * 0.45, hb * 1.04, hl * 0.55, hb * 1.08, hl, 0);
  c.closePath();
}

/** Work in a frame where the boat lies along +x (bow forward) centred on its footprint. */
function inFrame(c: Ctx, fp: Footprint, draw: (half: number, beam: number) => void): void {
  const horizontal = fp.w >= fp.h;
  const cx = (fp.x + fp.w / 2) * TILE;
  const cy = (fp.y + fp.h / 2) * TILE;
  const length = (horizontal ? fp.w : fp.h) * TILE - 4;
  const beam = (horizontal ? fp.h : fp.w) * TILE - 6;
  c.save();
  c.translate(cx, cy);
  c.rotate((horizontal ? 0 : Math.PI / 2) + (fp.bow === -1 ? Math.PI : 0));
  draw(length / 2, beam);
  c.restore();
}

function hullBody(c: Ctx, half: number, beam: number, afloat: boolean): void {
  // Shadow on the water (or the beach), then a line of foam where the hull meets the lake.
  c.save();
  c.translate(3, 4);
  lens(c, half, beam, 0);
  c.fillStyle = afloat ? 'rgba(8,24,34,0.35)' : 'rgba(45,28,12,0.32)';
  c.fill();
  c.restore();
  if (afloat) {
    lens(c, half + 1.5, beam + 3, 0);
    c.strokeStyle = rgba(FOAM, 0.5);
    c.lineWidth = 1.3;
    c.stroke();
  }
  lens(c, half, beam, 0);
  const g = c.createLinearGradient(0, -beam / 2, 0, beam / 2);
  g.addColorStop(0, shade(HULL, 0.22));
  g.addColorStop(1, shade(HULL, -0.2));
  c.fillStyle = g;
  c.fill();
  // Strakes: the planks running the length of the hull.
  c.strokeStyle = rgba(shade(HULL, -0.45), 0.6);
  c.lineWidth = 0.6;
  for (const inset of [1.4, 2.8]) {
    lens(c, half, beam, inset);
    c.stroke();
  }
}

function thwarts(c: Ctx, half: number, beam: number, every: number): void {
  for (let x = -half + every * 0.8; x < half - every * 0.6; x += every) {
    c.fillStyle = PLANK;
    c.fillRect(x - 2.2, -beam / 2, 4.4, beam);
    c.fillStyle = rgba('#ffffff', 0.18);
    c.fillRect(x - 2.2, -beam / 2, 1, beam);
  }
}

/** A boat afloat or drawn up on the shore. */
function paintFreeBoat(c: Ctx, fp: Footprint): void {
  const r = rng(hash(fp.x, fp.y, 71));
  inFrame(c, fp, (half, beam) => {
    if (fp.afloat) {
      // Oars in the water, two a side, and the steering oar trailing astern.
      c.strokeStyle = WOOD_DARK;
      c.lineWidth = 1.2;
      const oars = half > 40 ? [-0.1, 0.25] : [0.05];
      for (const t of oars)
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(t * half * 2 - 4, side * (beam / 2 - 2));
          c.lineTo(t * half * 2 - 12, side * (beam / 2 + 11));
          c.stroke();
          ellipse(c, t * half * 2 - 12.5, side * (beam / 2 + 12), 2.4, 1.2, WOOD_DARK, -0.6 * side);
        }
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-half * 0.8, beam / 2 - 3);
      c.lineTo(-half - 8, beam / 2 + 6);
      c.stroke();
    }
    hullBody(c, half, beam, fp.afloat);
    c.strokeStyle = RAIL;
    c.lineWidth = 2;
    lens(c, half, beam, 2.4);
    c.stroke();
    lens(c, half, beam, 4);
    c.save();
    c.clip();
    c.fillStyle = BILGE;
    c.fillRect(-half, -beam / 2, half * 2, beam);
    // Ribs across the bottom, then the benches.
    c.strokeStyle = rgba(shade(BILGE, -0.4), 0.7);
    c.lineWidth = 0.8;
    for (let x = -half; x < half; x += 6) {
      c.beginPath();
      c.moveTo(x, -beam / 2);
      c.lineTo(x, beam / 2);
      c.stroke();
    }
    thwarts(c, half, beam, 26);
    if (!fp.afloat) {
      // Drawn up for the day: the mast lowered along the boat, the sail rolled on its yard.
      c.fillStyle = shade(PLANK, -0.1);
      c.fillRect(-half * 0.85, -1.4, half * 1.6, 2.8);
      ellipse(c, -half * 0.1, beam * 0.18, half * 0.55, 2.6, SAIL);
      c.strokeStyle = rgba(ROPE, 0.9);
      c.lineWidth = 0.6;
      for (let x = -half * 0.6; x < half * 0.4; x += 7) {
        c.beginPath();
        c.moveTo(x, beam * 0.18 - 2.6);
        c.lineTo(x + 1, beam * 0.18 + 2.6);
        c.stroke();
      }
      if (r() < 0.7) {
        // A heap of net with its cork floats.
        const nx = half * 0.45;
        lumpy(c, nx, -beam * 0.12, Math.min(9, beam * 0.3), r, '#cdbf9c', 8);
        for (let i = 0; i < 5; i++)
          ellipse(c, nx - 6 + r() * 12, -beam * 0.12 - 4 + r() * 8, 1.3, 1, '#b07a3a');
      }
    }
    c.restore();
  });
  // Afloat and big enough to sail: a mast stands up from it (drawn in screen space).
  if (fp.afloat && Math.max(fp.w, fp.h) >= 4) paintUprightMast(c, fp);
}

/** A mast and sail seen standing up from a boat afloat (screen-space, rising north). */
function paintUprightMast(c: Ctx, fp: Footprint): void {
  const horizontal = fp.w >= fp.h;
  const cx = (fp.x + fp.w / 2) * TILE + (horizontal ? fp.bow * fp.w * TILE * 0.09 : 0);
  const cy = (fp.y + fp.h / 2) * TILE + (horizontal ? 0 : fp.bow * fp.h * TILE * 0.09);
  const height = 46;
  const top = cy - height;
  // Mast.
  c.strokeStyle = WOOD_DARK;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx, cy);
  c.lineTo(cx, top);
  c.stroke();
  // Yard across the mast and a square sail bellying below it.
  const span = 22;
  c.fillStyle = SAIL;
  c.beginPath();
  c.moveTo(cx - span, top + 6);
  c.quadraticCurveTo(cx, top + 2, cx + span, top + 6);
  c.lineTo(cx + span - 3, top + 30);
  c.quadraticCurveTo(cx, top + 36, cx - span + 3, top + 30);
  c.closePath();
  c.fill();
  c.fillStyle = rgba('#7a6a4a', 0.25);
  c.fillRect(cx + 4, top + 7, span - 6, 24);
  c.strokeStyle = rgba('#8a7650', 0.6);
  c.lineWidth = 0.6;
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(cx + i * 8, top + 5);
    c.lineTo(cx + i * 8.6, top + 31);
    c.stroke();
  }
  c.strokeStyle = WOOD_DARK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(cx - span - 2, top + 6);
  c.quadraticCurveTo(cx, top + 1.5, cx + span + 2, top + 6);
  c.stroke();
}

/** The boat you are aboard: a big hull around walkable deck planking. */
function paintBoardedBoat(c: Ctx, fp: Footprint): void {
  const r = rng(hash(fp.x, fp.y, 73));
  inFrame(c, fp, (half, beam) => {
    // Oars shipped along both sides, and the big steering oar on the stern quarter.
    c.strokeStyle = WOOD_DARK;
    c.lineWidth = 2;
    for (const t of [-0.25, 0.1, 0.4])
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(t * half, side * (beam / 2 - 6));
        c.lineTo(t * half - 20, side * (beam / 2 + 18));
        c.stroke();
        ellipse(c, t * half - 21, side * (beam / 2 + 19), 4, 1.8, WOOD_DARK, -0.7 * side);
      }
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-half * 0.78, beam / 2 - 8);
    c.lineTo(-half - 16, beam / 2 + 10);
    c.stroke();
    ellipse(c, -half - 17, beam / 2 + 11, 6, 2.6, WOOD_DARK, 0.5);
    hullBody(c, half, beam, true);
    // Deck planking inside the rail.
    lens(c, half, beam, 9);
    c.save();
    c.clip();
    c.fillStyle = DECK;
    c.fillRect(-half, -beam / 2, half * 2, beam);
    c.strokeStyle = rgba(shade(DECK, -0.45), 0.55);
    c.lineWidth = 0.7;
    for (let y = -beam / 2; y < beam / 2; y += 5.4) {
      c.beginPath();
      c.moveTo(-half, y);
      c.lineTo(half, y);
      c.stroke();
    }
    for (let i = 0; i < half / 3; i++) {
      const jx = -half + r() * half * 2;
      const jy = -beam / 2 + Math.floor(r() * (beam / 5.4)) * 5.4;
      c.beginPath();
      c.moveTo(jx, jy);
      c.lineTo(jx, jy + 5.4);
      c.stroke();
      ellipse(c, jx + 2, jy + 2.7, 0.5, 0.5, '#3c2a1a');
    }
    // A raised platform in the stern, where the helmsman sits.
    c.fillStyle = shade(DECK, -0.18);
    c.fillRect(-half, -beam / 2, half * 0.22, beam);
    c.strokeStyle = rgba(shade(DECK, -0.5), 0.8);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-half + half * 0.22, -beam / 2);
    c.lineTo(-half + half * 0.22, beam / 2);
    c.stroke();
    c.restore();
    // The rail (gunwale) and the frames' heads along it.
    lens(c, half, beam, 5);
    c.strokeStyle = RAIL;
    c.lineWidth = 4.5;
    c.stroke();
    c.strokeStyle = rgba('#ffffff', 0.2);
    c.lineWidth = 1;
    lens(c, half, beam, 3.6);
    c.stroke();
    c.strokeStyle = rgba(shade(RAIL, -0.5), 0.7);
    lens(c, half, beam, 7.3);
    c.stroke();
    for (let x = -half * 0.8; x < half * 0.85; x += 22)
      for (const side of [-1, 1]) {
        const y = side * (beam / 2 - 5) * Math.sqrt(Math.max(0, 1 - (x / half) ** 2));
        ellipse(c, x, y, 1.6, 1.6, shade(RAIL, -0.35));
      }
  });
}

/**
 * Paint every boat in the place: the one you are aboard (hull + deck) and
 * any others, afloat or drawn up. Runs after the water and before objects.
 */
export function paintBoats(c: Ctx, site: Site, look: Look): void {
  for (const fp of footprints(site, (k) => k === 'hull' || k === 'deck' || k === 'mast', 'hull')) {
    underlay(c, site, look, fp, (x, y) => site.kindAt(x, y) === 'hull');
    paintBoardedBoat(c, fp);
  }
  for (const fp of footprints(site, (k) => k === 'boat')) {
    underlay(c, site, look, fp, () => true);
    paintFreeBoat(c, fp);
  }
}

/** What shows round a boat's curved ends: the water it floats on, or the beach it's drawn up on. */
function underlay(
  c: Ctx,
  site: Site,
  look: Look,
  fp: Footprint,
  paintHere: (x: number, y: number) => boolean,
): void {
  for (const [x, y] of fp.tiles) {
    if (!paintHere(x, y)) continue;
    c.fillStyle = fp.afloat
      ? shade(fp.deep ? LAKE_DEEP : LAKE_SHALLOW, (fbm(x / 6, y / 6, 41) - 0.5) * 0.3)
      : groundColor(look, groundUnder(site.grid, x, y, 'shingle'));
    c.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
}

// ── The mast of the boat you're aboard ───────────────────────────────────
/** The foot of the mast, on the deck (local tile coordinates, 0–32; may rise above 0). */
export function paintMastFoot(c: Ctx, seed: number): void {
  const r = rng(seed);
  // The mast step: a heavy block on the keel, with coiled halyard beside it.
  c.fillStyle = WOOD_DARK;
  c.fillRect(9, 22, 14, 7);
  c.fillStyle = shade(PLANK, 0.1);
  c.fillRect(9, 22, 14, 2);
  const g = c.createLinearGradient(13, 0, 19, 0);
  g.addColorStop(0, shade(PLANK, 0.25));
  g.addColorStop(1, shade(PLANK, -0.35));
  c.fillStyle = g;
  c.fillRect(13.6, -14, 4.8, 38);
  c.strokeStyle = ROPE;
  c.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.ellipse(26, 26 - i * 0.8, 4 - i * 0.6, 2.2 - i * 0.3, 0, 0, Math.PI * 2);
    c.stroke();
  }
  if (r() < 0.5) ellipse(c, 5, 27, 2, 1.2, rgba(ROPE, 0.8));
}

/**
 * The top of the mast, yard and sail — drawn above people. (ox, oy) is the
 * mast tile's top-left inside the canopy canvas.
 */
export function paintMastTop(c: Ctx, ox: number, oy: number, seed: number): void {
  const r = rng(seed);
  const mx = ox + 16;
  const top = oy - 26;
  const g = c.createLinearGradient(mx - 2.4, 0, mx + 2.4, 0);
  g.addColorStop(0, shade(PLANK, 0.25));
  g.addColorStop(1, shade(PLANK, -0.35));
  c.fillStyle = g;
  c.fillRect(mx - 2.2, top, 4.4, oy + 10 - top);
  // Shrouds down to the rail.
  c.strokeStyle = rgba(ROPE, 0.85);
  c.lineWidth = 0.7;
  for (const [ex, ey] of [
    [ox - 14, oy + 30],
    [ox + 46, oy + 30],
  ] as const) {
    c.beginPath();
    c.moveTo(mx, top + 3);
    c.lineTo(ex, ey);
    c.stroke();
  }
  // The yard, slanting across, with the sail gathered up to it by its brails.
  const yl = { x: ox - 14, y: top + 9 };
  const yr = { x: ox + 46, y: top + 3 };
  c.fillStyle = SAIL;
  c.beginPath();
  c.moveTo(yl.x + 2, yl.y);
  c.lineTo(yr.x - 2, yr.y);
  c.quadraticCurveTo(yr.x - 1, yr.y + 12, yr.x - 5, yr.y + 16);
  for (let i = 5; i >= 0; i--) {
    const t = i / 5;
    const px = yl.x + 5 + (yr.x - yl.x - 10) * t;
    const py = yl.y + (yr.y - yl.y) * t + 16 + (i % 2) * 2.5;
    c.lineTo(px, py);
  }
  c.closePath();
  c.fill();
  c.fillStyle = rgba('#7a6a4a', 0.22);
  c.beginPath();
  c.moveTo(mx + 3, top + 6);
  c.lineTo(yr.x - 3, yr.y + 1);
  c.lineTo(yr.x - 5, yr.y + 16);
  c.lineTo(mx + 3, top + 24);
  c.closePath();
  c.fill();
  c.strokeStyle = rgba('#8a7650', 0.7);
  c.lineWidth = 0.6;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const px = yl.x + (yr.x - yl.x) * t;
    const py = yl.y + (yr.y - yl.y) * t;
    c.beginPath();
    c.moveTo(px, py + 1);
    c.lineTo(px + (r() - 0.5), py + 16);
    c.stroke();
  }
  c.strokeStyle = WOOD_DARK;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(yl.x, yl.y);
  c.lineTo(yr.x, yr.y);
  c.stroke();
  // Masthead block.
  c.fillStyle = WOOD_DARK;
  c.fillRect(mx - 3, top - 2, 6, 4);
}

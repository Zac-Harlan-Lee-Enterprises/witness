import type { Look } from './direction';
import {
  ellipse,
  hash,
  lumpy,
  mix,
  rgba,
  rng,
  shade,
  softShadow,
  speckle,
  TILE,
  type Ctx,
} from './paint';
import { backWallSlots, type Site } from './site';

/**
 * Buildings. A wall that faces the viewer is drawn as a FRONT that rises
 * above its tile (overlapping the roof behind it), so houses have height.
 * Jerusalem is dressed limestone, Jericho mudbrick with timber beam ends,
 * and Miriam's home is warm lime plaster with a timber band.
 *
 * Order matters: caps and roofs first, then fronts (which overlap them).
 */
const WOOD = '#8a623c';
const WOOD_DARK = '#4f3520';
const OPENING = '#2a1a10';

export function paintBuildings(ctx: Ctx, site: Site, look: Look): void {
  site.forEach((x, y) => {
    const k = site.kindAt(x, y);
    if (k === 'roof') paintRoof(ctx, site, look, x, y);
    else if (k === 'wall' && !site.isFrontWall(x, y)) paintWallCap(ctx, site, look, x, y);
  });
  site.forEach((x, y) => {
    const k = site.kindAt(x, y);
    if (k === 'fence') paintLowWall(ctx, site, look, x, y);
    else if (k === 'sheepfold') paintFoldWall(ctx, site, look, x, y);
    else if (k === 'terrace') paintTerraceWall(ctx, site, look, x, y);
    else if (k === 'gate' && isFoldGate(site, x, y)) paintFoldGate(ctx, look, x, y);
    else if (k === 'door' || k === 'gate') paintOpening(ctx, site, look, x, y);
  });
  site.forEach((x, y) => {
    if (site.isFrontWall(x, y)) paintFront(ctx, site, look, x, y);
  });
  if (look.mood === 'home') paintBackWallLife(ctx, site, look);
}

// ── Wall tops and roofs ──────────────────────────────────────────────────
function paintWallCap(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 23));
  const wallish = (dx: number, dy: number): boolean => {
    const k = site.kindAt(tx + dx, ty + dy);
    return k === 'wall' || k === 'roof' || k === 'door' || k === 'gate';
  };
  if (look.mood === 'home') {
    // Interior: the thickness of the walls, framing the room in dark timber-and-earth tones.
    ctx.fillStyle = '#4a3222';
    ctx.fillRect(X, Y, TILE, TILE);
    speckle(ctx, X, Y, TILE, TILE, r, ['#3b271a', '#5a3e2a'], 12, 1.4);
    ctx.fillStyle = rgba('#a57c52', 0.55);
    if (!wallish(1, 0)) ctx.fillRect(X + TILE - 2, Y, 2, TILE);
    if (!wallish(-1, 0)) ctx.fillRect(X, Y, 2, TILE);
    if (!wallish(0, -1)) ctx.fillRect(X, Y, TILE, 2);
    return;
  }
  const top = look.building.top;
  ctx.fillStyle = shade(top, (r() - 0.5) * 0.03);
  ctx.fillRect(X, Y, TILE, TILE);
  speckle(ctx, X, Y, TILE, TILE, r, [shade(top, -0.12), shade(top, 0.08)], 10, 1);
  // Coping stones along the run of the wall.
  ctx.strokeStyle = rgba(shade(top, -0.25), 0.55);
  ctx.lineWidth = 0.7;
  for (let i = 8 + r() * 6; i < TILE; i += 10 + r() * 6) {
    ctx.beginPath();
    ctx.moveTo(X + i, Y + 2);
    ctx.lineTo(X + i, Y + TILE - 2);
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#ffffff', 0.28);
  if (!wallish(-1, 0)) ctx.fillRect(X, Y, 2, TILE);
  if (!wallish(0, -1)) ctx.fillRect(X, Y, TILE, 2);
  ctx.fillStyle = rgba(shade(top, -0.45), 0.5);
  if (!wallish(1, 0)) ctx.fillRect(X + TILE - 2.5, Y, 2.5, TILE);
}

function paintRoof(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 29));
  const roofAt = (dx: number, dy: number): boolean => {
    const k = site.kindAt(tx + dx, ty + dy);
    return k === 'roof' || k === 'wall';
  };
  const reed = look.building.material === 'mudbrick';
  const base = reed ? '#b8955a' : shade(look.building.top, -0.02);
  ctx.fillStyle = base;
  ctx.fillRect(X, Y, TILE, TILE);
  if (reed) {
    // Palm-frond and reed thatch laid over timber: long strokes, a few darker bundles.
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 16; i++) {
      const yy = Y + r() * TILE;
      ctx.strokeStyle = rgba(r() > 0.5 ? '#8e6d3c' : '#d4b777', 0.7);
      ctx.beginPath();
      ctx.moveTo(X, yy);
      ctx.quadraticCurveTo(X + 16, yy + (r() - 0.5) * 3, X + TILE, yy + (r() - 0.5) * 2);
      ctx.stroke();
    }
    if (r() < 0.25) lumpyBundle(ctx, X + 6 + r() * 16, Y + 8 + r() * 14, look);
  } else {
    // Plaster roof, rolled smooth; faint patching and rain stains.
    speckle(ctx, X, Y, TILE, TILE, r, [shade(base, -0.08), shade(base, 0.08)], 14, 1);
    if (r() < 0.3) {
      ctx.fillStyle = rgba(shade(base, -0.1), 0.35);
      ctx.beginPath();
      ctx.ellipse(
        X + 6 + r() * 20,
        Y + 6 + r() * 20,
        5 + r() * 5,
        3 + r() * 3,
        r(),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  // Parapet lip: lit on the north and west, shaded on the south and east.
  const lip = shade(look.building.face, reed ? -0.05 : -0.08);
  if (!roofAt(0, -1)) {
    ctx.fillStyle = lip;
    ctx.fillRect(X, Y, TILE, 4);
    ctx.fillStyle = rgba('#ffffff', 0.4);
    ctx.fillRect(X, Y, TILE, 1.2);
  }
  if (!roofAt(-1, 0)) {
    ctx.fillStyle = lip;
    ctx.fillRect(X, Y, 4, TILE);
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.fillRect(X, Y, 1.2, TILE);
  }
  if (!roofAt(1, 0)) {
    ctx.fillStyle = shade(lip, -0.2);
    ctx.fillRect(X + TILE - 4, Y, 4, TILE);
  }
  // Big roofs are several houses: parapet seams every few tiles.
  if (!reed) {
    const seamX = hash(Math.floor(tx / 4), ty >> 3, 51) % 2 === 0 && tx % 4 === 0 && roofAt(-1, 0);
    const seamY = ty % 3 === 0 && roofAt(0, -1);
    if (seamX) {
      ctx.fillStyle = lip;
      ctx.fillRect(X - 1.5, Y, 3, TILE);
      ctx.fillStyle = rgba('#ffffff', 0.35);
      ctx.fillRect(X - 1.5, Y, 1, TILE);
      ctx.fillStyle = rgba(look.shadow.color, 0.25);
      ctx.fillRect(X + 1.5, Y, 4, TILE);
    }
    if (seamY) {
      ctx.fillStyle = lip;
      ctx.fillRect(X, Y - 1.5, TILE, 3);
      ctx.fillStyle = rgba(look.shadow.color, 0.22);
      ctx.fillRect(X, Y + 1.5, TILE, 4);
    }
  }
  // Rooftop life, away from the edges.
  const interior = roofAt(0, -1) && roofAt(0, 1) && roofAt(-1, 0) && roofAt(1, 0);
  if (!interior) return;
  const v = hash(tx, ty, 41) % 11;
  const accent = look.accents[hash(tx, ty, 43) % look.accents.length] ?? '#b23a2c';
  if (v === 0) {
    softShadow(ctx, X + 18, Y + 23, 8, 3, 0.3);
    ellipse(ctx, X + 14, Y + 17, 4.2, 5.2, '#b8683e');
    ellipse(ctx, X + 21, Y + 20, 3.2, 4, '#8c4f2e');
    ellipse(ctx, X + 13, Y + 14, 1.5, 1, rgba('#ffffff', 0.3));
  } else if (v === 1) {
    // A reed mat with drying figs or grain.
    softShadow(ctx, X + 17, Y + 22, 11, 3, 0.25);
    ctx.fillStyle = '#c9a868';
    ctx.fillRect(X + 5, Y + 12, 22, 10);
    ctx.fillStyle = '#a88a4c';
    for (let i = 0; i < 6; i++) ctx.fillRect(X + 6 + i * 3.6, Y + 12, 0.8, 10);
    for (let i = 0; i < 8; i++)
      ellipse(ctx, X + 8 + r() * 16, Y + 14 + r() * 6, 1.3, 1.1, reed ? '#6a3a1c' : '#d9b35a');
  } else if (v === 2) {
    // A washing line with cloth.
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(X + 3, Y + 9);
    ctx.lineTo(X + 29, Y + 11);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 1 ? accent : '#ece2c8';
      ctx.fillRect(X + 6 + i * 8, Y + 9.5 + i * 0.4, 6, 8 + (i % 2) * 3);
      ctx.fillStyle = rgba('#000000', 0.12);
      ctx.fillRect(X + 6 + i * 8, Y + 15 + i * 0.4, 6, 2);
    }
  } else if (v === 3 && !reed) {
    // A ladder resting on the roof.
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(X + 10, Y + 4);
    ctx.lineTo(X + 12, Y + 28);
    ctx.moveTo(X + 17, Y + 4);
    ctx.lineTo(X + 19, Y + 28);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(X + 10.3 + i * 0.4, Y + 7 + i * 5);
      ctx.lineTo(X + 17.3 + i * 0.4, Y + 7 + i * 5);
      ctx.stroke();
    }
  }
}

function lumpyBundle(ctx: Ctx, x: number, y: number, look: Look): void {
  ellipse(ctx, x + 1, y + 2, 7, 3, rgba('#000000', 0.15));
  ellipse(ctx, x, y, 7, 3.4, shade(look.foliage.dark, 0.1));
  ctx.strokeStyle = rgba(look.foliage.light, 0.6);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 6, y - 0.5);
  ctx.stroke();
}

// ── Building fronts ──────────────────────────────────────────────────────
function paintFront(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const rise = site.facadeRise(tx, ty);
  const top = ty * TILE - rise;
  const bottom = (ty + 1) * TILE;
  const r = rng(hash(tx, ty, 37));
  const b = look.building;
  const faceGrad = ctx.createLinearGradient(0, top, 0, bottom);
  faceGrad.addColorStop(0, shade(b.face, 0.07));
  faceGrad.addColorStop(0.75, b.face);
  faceGrad.addColorStop(1, shade(b.face, -0.18));
  ctx.fillStyle = faceGrad;
  ctx.fillRect(X, top, TILE, bottom - top);

  const bodyTop = top + 5;
  if (b.material === 'limestone') {
    // Dressed ashlar courses with drafted (recessed) margins, laid in bond.
    const course = 9;
    let row = 0;
    for (let yy = bodyTop; yy < bottom - 4; yy += course, row++) {
      let x0 = X - (row % 2) * 8 - (hash(tx, row, 3) % 5);
      while (x0 < X + TILE) {
        const bw = 13 + ((hash(Math.floor(x0), row, 9) % 7) as number);
        const bx = Math.max(x0, X);
        const bwClip = Math.min(x0 + bw, X + TILE) - bx;
        if (bwClip > 1) {
          ctx.fillStyle = shade(b.face, (r() - 0.5) * 0.1);
          ctx.fillRect(bx + 0.6, yy + 0.6, bwClip - 1.2, course - 1.2);
          // Drafted margin: a lighter frame around a slightly raised boss.
          ctx.strokeStyle = rgba(shade(b.face, 0.18), 0.6);
          ctx.lineWidth = 0.6;
          ctx.strokeRect(bx + 1.4, yy + 1.4, bwClip - 2.8, course - 2.8);
        }
        x0 += bw;
      }
      ctx.fillStyle = b.mortar;
      ctx.fillRect(X, yy + course - 0.8, TILE, 0.9);
    }
  } else if (b.material === 'mudbrick') {
    // Smaller sun-dried bricks under a patchy mud plaster.
    const course = 5;
    let row = 0;
    for (let yy = bodyTop; yy < bottom - 4; yy += course, row++) {
      ctx.fillStyle = rgba(b.mortar, 0.55);
      ctx.fillRect(X, yy + course - 0.8, TILE, 0.8);
      for (let bx = X - (row % 2) * 4; bx < X + TILE; bx += 8) {
        ctx.fillRect(Math.max(X, bx), yy, 0.7, course);
      }
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = rgba(shade(b.face, 0.14), 0.75);
      ctx.beginPath();
      ctx.ellipse(
        X + r() * TILE,
        bodyTop + 4 + r() * (bottom - bodyTop - 10),
        5 + r() * 6,
        3 + r() * 4,
        r(),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    // Timber beam ends poking out under the roof line.
    if (rise > 0 && hash(tx, ty, 13) % 2 === 0) {
      for (const bx of [X + 7, X + 22]) {
        ellipse(ctx, bx + 0.8, top + 7.5, 2.4, 1.4, rgba('#000000', 0.25));
        ellipse(ctx, bx, top + 6.5, 2.2, 2.2, WOOD);
        ellipse(ctx, bx - 0.5, top + 6, 1, 1, shade(WOOD, 0.2));
      }
    }
  } else {
    // Interior lime plaster: smooth, with a timber band near the top.
    speckle(
      ctx,
      X,
      bodyTop,
      TILE,
      bottom - bodyTop,
      r,
      [shade(b.face, -0.06), shade(b.face, 0.06)],
      10,
      1.2,
    );
    ctx.fillStyle = b.trim;
    ctx.fillRect(X, top + 3, TILE, 4);
    ctx.fillStyle = rgba('#ffffff', 0.15);
    ctx.fillRect(X, top + 3, TILE, 1);
  }
  // Cornice.
  if (b.material !== 'plaster') {
    ctx.fillStyle = shade(b.face, 0.12);
    ctx.fillRect(X, top, TILE, 3.5);
    ctx.fillStyle = rgba(shade(b.face, -0.5), 0.45);
    ctx.fillRect(X, top + 3.5, TILE, 1.2);
  }
  // Windows on longer runs.
  const run = site.kindAt(tx - 1, ty) === 'wall' && site.kindAt(tx + 1, ty) === 'wall';
  if (run && b.material !== 'plaster' && hash(tx, ty, 5) % 3 === 0)
    paintWindow(ctx, X + 11, top + 10, look);
  // A plinth and the grime of the street at the foot of the wall.
  ctx.fillStyle = shade(b.face, -0.2);
  ctx.fillRect(X, bottom - 4, TILE, 4);
  ctx.fillStyle = rgba('#000000', 0.12);
  ctx.fillRect(X, bottom - 4, TILE, 0.8);
  // Ends of a front: a dark corner line so buildings read as blocks.
  ctx.fillStyle = rgba(shade(b.face, -0.55), 0.6);
  if (!site.isFrontWall(tx - 1, ty) && !site.isFacadeOpening(tx - 1, ty))
    ctx.fillRect(X, top, 1.2, bottom - top);
  if (!site.isFrontWall(tx + 1, ty) && !site.isFacadeOpening(tx + 1, ty))
    ctx.fillRect(X + TILE - 1.2, top, 1.2, bottom - top);
}

function paintWindow(ctx: Ctx, x: number, y: number, look: Look): void {
  const w = 10;
  const h = 12;
  ctx.fillStyle = shade(look.building.face, -0.3);
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = OPENING;
  ctx.fillRect(x, y, w, h);
  // Wooden lattice.
  ctx.strokeStyle = shade(WOOD, 0.1);
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 3, y);
    ctx.lineTo(x + (w * i) / 3, y + h);
    ctx.moveTo(x, y + (h * i) / 3);
    ctx.lineTo(x + w, y + (h * i) / 3);
    ctx.stroke();
  }
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x - 2, y - 3, w + 4, 2);
  ctx.fillStyle = shade(look.building.face, 0.15);
  ctx.fillRect(x - 2, y + h + 1, w + 4, 1.5);
}

// ── Doors and gates ──────────────────────────────────────────────────────
function paintOpening(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const kind = site.kindAt(tx, ty);
  const b = look.building;
  if (site.isFacadeOpening(tx, ty)) {
    const rise = site.facadeRise(tx, ty);
    const top = Y - rise;
    ctx.fillStyle = shade(b.face, -0.04);
    ctx.fillRect(X, top, TILE, TILE + rise);
    const inset = kind === 'gate' ? 3 : 7;
    const archTop = top + (kind === 'gate' ? 5 : 11);
    // The opening: arched stone for limestone, a timber lintel for mudbrick.
    ctx.fillStyle = OPENING;
    ctx.beginPath();
    ctx.moveTo(X + inset, Y + TILE);
    if (b.material === 'mudbrick') {
      ctx.lineTo(X + inset, archTop);
      ctx.lineTo(X + TILE - inset, archTop);
    } else {
      ctx.lineTo(X + inset, archTop + 8);
      ctx.quadraticCurveTo(X + 16, archTop - 6, X + TILE - inset, archTop + 8);
    }
    ctx.lineTo(X + TILE - inset, Y + TILE);
    ctx.closePath();
    ctx.fill();
    if (kind === 'door') {
      // A cloth curtain half drawn across the doorway.
      const cloth = look.accents[hash(tx, ty, 17) % look.accents.length] ?? '#b23a2c';
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(X + inset, archTop + (b.material === 'mudbrick' ? 0 : 6));
      ctx.lineTo(X + 17, archTop + (b.material === 'mudbrick' ? 0 : 3));
      ctx.quadraticCurveTo(X + 15, Y + 16, X + 19, Y + TILE - 2);
      ctx.lineTo(X + inset, Y + TILE - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(shade(cloth, -0.35), 0.7);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(X + inset + 2 + i * 3, archTop + 7);
        ctx.quadraticCurveTo(X + inset + 1 + i * 3, Y + 18, X + inset + 3 + i * 3.4, Y + TILE - 3);
        ctx.stroke();
      }
    } else {
      // A gate passage: daylight seen through, with the leaves of a heavy door folded back.
      const grad = ctx.createLinearGradient(0, archTop, 0, Y + TILE);
      grad.addColorStop(0, '#3a2718');
      grad.addColorStop(1, mix(look.ground.road, '#3a2718', 0.35));
      ctx.fillStyle = grad;
      ctx.fillRect(X + inset + 2, archTop + 6, TILE - inset * 2 - 4, Y + TILE - archTop - 6);
      ctx.fillStyle = WOOD_DARK;
      ctx.fillRect(X + inset, archTop + 8, 3, Y + TILE - archTop - 8);
      ctx.fillRect(X + TILE - inset - 3, archTop + 8, 3, Y + TILE - archTop - 8);
    }
    // Frame.
    ctx.strokeStyle = shade(b.face, -0.35);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(X + inset, Y + TILE);
    if (b.material === 'mudbrick') {
      ctx.lineTo(X + inset, archTop);
      ctx.lineTo(X + TILE - inset, archTop);
    } else {
      ctx.lineTo(X + inset, archTop + 8);
      ctx.quadraticCurveTo(X + 16, archTop - 6, X + TILE - inset, archTop + 8);
    }
    ctx.lineTo(X + TILE - inset, Y + TILE);
    ctx.stroke();
    if (b.material === 'mudbrick') {
      ctx.fillStyle = WOOD;
      ctx.fillRect(X + inset - 3, archTop - 3, TILE - inset * 2 + 6, 3);
    }
    // Threshold stone.
    ctx.fillStyle = shade(look.ground.paving, -0.08);
    ctx.fillRect(X + inset - 1, Y + TILE - 3, TILE - inset * 2 + 2, 3);
    return;
  }
  // A doorway seen from inside, or a gap in an outer wall: a threshold, lit
  // from outside when it leads out of a home.
  ctx.fillStyle = shade(look.ground.paving, -0.06);
  ctx.fillRect(X, Y, TILE, TILE);
  ctx.fillStyle = shade(look.ground.paving, 0.05);
  ctx.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
  if (look.mood === 'home') {
    const grad = ctx.createLinearGradient(0, Y + TILE, 0, Y - 20);
    grad.addColorStop(0, 'rgba(255,238,196,0.85)');
    grad.addColorStop(1, 'rgba(255,238,196,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(X, Y - 20, TILE, TILE + 20);
  }
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(X, Y, TILE, 2.5);
}

function paintLowWall(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 19));
  const along = (dx: number, dy: number): boolean => site.kindAt(tx + dx, ty + dy) === 'fence';
  const vertical = (along(0, -1) || along(0, 1)) && !(along(-1, 0) || along(1, 0));
  const face = shade(look.building.face, -0.06);
  const x0 = vertical ? X + 9 : X;
  const w = vertical ? 14 : TILE;
  const y0 = vertical ? Y : Y + 9;
  const h = vertical ? TILE : 13;
  ctx.fillStyle = face;
  ctx.fillRect(x0, y0, w, h);
  // Field stones.
  for (let i = 0; i < 6; i++) {
    const sx = x0 + 1 + r() * (w - 6);
    const sy = y0 + 2 + r() * (h - 6);
    ellipse(ctx, sx + 2, sy + 2, 3 + r() * 2, 2 + r(), shade(face, (r() - 0.5) * 0.2));
  }
  ctx.fillStyle = rgba('#ffffff', 0.3);
  ctx.fillRect(x0, y0, w, 1.5);
  ctx.fillStyle = rgba(shade(face, -0.5), 0.45);
  if (vertical) ctx.fillRect(x0 + w - 2, y0, 2, h);
  else ctx.fillRect(x0, y0 + h - 2, w, 2);
}

// ── Fields: sheepfolds and terraces ─────────────────────────────────────
/** Rough field stones in a dry-stone course, no mortar. */
function fieldStones(
  ctx: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  face: string,
  r: () => number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const sx = x0 + 1 + r() * (w - 5);
    const sy = y0 + 1.5 + r() * (h - 5);
    const rx = 2.6 + r() * 2.2;
    const ry = 1.8 + r() * 1.1;
    ellipse(ctx, sx + rx, sy + ry + 0.8, rx, ry, rgba(shade(face, -0.55), 0.35));
    ellipse(ctx, sx + rx, sy + ry, rx, ry, shade(face, (r() - 0.5) * 0.24));
    ellipse(ctx, sx + rx - 1, sy + ry - 0.7, rx * 0.4, ry * 0.3, rgba('#ffffff', 0.22));
  }
}

/**
 * A sheepfold wall: waist-high dry stone, thicker than a garden wall, with
 * thorny brushwood laid along the top to keep animals in and thieves out.
 */
function paintFoldWall(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 41));
  const along = (dx: number, dy: number): boolean => {
    const k = site.kindAt(tx + dx, ty + dy);
    return k === 'sheepfold' || k === 'gate';
  };
  const vertical = (along(0, -1) || along(0, 1)) && !(along(-1, 0) || along(1, 0));
  const face = mix(look.building.face, '#9c8a6c', 0.45);
  const x0 = vertical ? X + 6 : X;
  const w = vertical ? 20 : TILE;
  const y0 = vertical ? Y : Y + 5;
  const h = vertical ? TILE : 20;
  ctx.fillStyle = shade(face, -0.12);
  ctx.fillRect(x0, y0, w, h);
  fieldStones(ctx, x0, y0, w, h, face, r, 9);
  // Brushwood along the top: dark twiggy clumps with thorny tips.
  const twig = '#4a3620';
  for (let i = 0; i < 6; i++) {
    const bx = vertical ? x0 + 3 + r() * (w - 6) : x0 + 2 + r() * (w - 4);
    const by = vertical ? y0 + 2 + r() * (h - 4) : y0 + 1 + r() * 5;
    lumpy(ctx, bx, by, 2.6 + r() * 1.6, r, rgba(mix(look.foliage.dark, twig, 0.5), 0.9), 6);
    ctx.strokeStyle = rgba(twig, 0.9);
    ctx.lineWidth = 0.6;
    for (let t = 0; t < 3; t++) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (r() - 0.5) * 8, by - 1 - r() * 4);
      ctx.stroke();
    }
  }
  ctx.fillStyle = rgba(shade(face, -0.5), 0.4);
  if (vertical) ctx.fillRect(x0 + w - 2, y0, 2, h);
  else ctx.fillRect(x0, y0 + h - 2, w, 2);
}

function isFoldGate(site: Site, tx: number, ty: number): boolean {
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => site.kindAt(tx + (dx ?? 0), ty + (dy ?? 0)) === 'sheepfold');
}

/** The fold's single way in: trodden earth between two upright gate stones. */
function paintFoldGate(ctx: Ctx, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 43));
  ctx.fillStyle = shade(look.ground.sand, -0.12);
  ctx.fillRect(X + 2, Y, TILE - 4, TILE);
  for (let i = 0; i < 8; i++)
    ellipse(ctx, X + 6 + r() * 20, Y + 4 + r() * 24, 1.3, 1, rgba('#4a3620', 0.4));
  const stone = mix(look.building.face, '#9c8a6c', 0.45);
  for (const sx of [X + 1, X + TILE - 6]) {
    ctx.fillStyle = rgba('#2a1a10', 0.3);
    ctx.fillRect(sx + 1.5, Y + 6, 5, 22);
    ctx.fillStyle = stone;
    ctx.fillRect(sx, Y + 3, 5, 22);
    ctx.fillStyle = rgba('#ffffff', 0.25);
    ctx.fillRect(sx, Y + 3, 5, 1.5);
  }
}

/**
 * A terrace wall: the dry-stone step that holds up a hillside field. The
 * upper field's edge is on top; the stone face drops toward the viewer.
 */
function paintTerraceWall(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 47));
  const face = mix(look.building.face, '#a89272', 0.5);
  // Top: the lip of the field above, with a few weeds.
  ctx.fillStyle = shade(face, 0.1);
  ctx.fillRect(X, Y + 4, TILE, 6);
  // Face: coursed field stones, shadowed toward the foot.
  ctx.fillStyle = shade(face, -0.18);
  ctx.fillRect(X, Y + 10, TILE, 18);
  fieldStones(ctx, X, Y + 10, TILE, 18, face, r, 10);
  const grad = ctx.createLinearGradient(0, Y + 14, 0, Y + 28);
  grad.addColorStop(0, rgba(look.shadow.color, 0));
  grad.addColorStop(1, rgba(look.shadow.color, 0.4));
  ctx.fillStyle = grad;
  ctx.fillRect(X, Y + 14, TILE, 14);
  if (r() < 0.6) {
    ctx.strokeStyle = look.foliage.mid;
    ctx.lineWidth = 0.9;
    const gx = X + 4 + r() * 24;
    ctx.beginPath();
    ctx.moveTo(gx, Y + 9);
    ctx.lineTo(gx - 1.5, Y + 4);
    ctx.moveTo(gx, Y + 9);
    ctx.lineTo(gx + 2, Y + 5);
    ctx.stroke();
  }
  // Where the wall ends, a rounded end stone.
  if (site.kindAt(tx - 1, ty) !== 'terrace') ellipse(ctx, X + 3, Y + 18, 4, 9, shade(face, -0.05));
  if (site.kindAt(tx + 1, ty) !== 'terrace')
    ellipse(ctx, X + TILE - 3, Y + 18, 4, 9, shade(face, -0.25));
}

// ── Inside Miriam's house: the back wall is where life hangs ─────────────
function paintBackWallLife(ctx: Ctx, site: Site, look: Look): void {
  for (const slot of backWallSlots(site)) {
    const X = slot.x * TILE;
    // Decorations sit in the upper part of a tall interior wall.
    const Y = slot.y * TILE - site.facadeRise(slot.x, slot.y) * 0.55;
    switch (slot.use) {
      case 'window': {
        // A small high window; the light pool it throws is painted by the shading pass.
        ctx.fillStyle = shade(look.building.face, -0.25);
        ctx.fillRect(X + 9, Y + 9, 14, 13);
        ctx.fillStyle = '#fff0c8';
        ctx.fillRect(X + 11, Y + 11, 10, 9);
        ctx.strokeStyle = WOOD_DARK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X + 16, Y + 11);
        ctx.lineTo(X + 16, Y + 20);
        ctx.moveTo(X + 11, Y + 15.5);
        ctx.lineTo(X + 21, Y + 15.5);
        ctx.stroke();
        break;
      }
      case 'lamp': {
        // An arched niche with a clay oil lamp.
        ctx.fillStyle = shade(look.building.face, -0.35);
        ctx.beginPath();
        ctx.moveTo(X + 9, Y + 24);
        ctx.lineTo(X + 9, Y + 15);
        ctx.quadraticCurveTo(X + 16, Y + 7, X + 23, Y + 15);
        ctx.lineTo(X + 23, Y + 24);
        ctx.closePath();
        ctx.fill();
        const glow = ctx.createRadialGradient(X + 16, Y + 17, 0, X + 16, Y + 17, 10);
        glow.addColorStop(0, 'rgba(255,214,140,0.85)');
        glow.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(X + 6, Y + 7, 20, 20);
        ellipse(ctx, X + 16, Y + 22, 4, 1.8, '#b8683e');
        ellipse(ctx, X + 19.5, Y + 21, 1.2, 1.9, '#ffe7a8');
        break;
      }
      case 'shelf': {
        ctx.fillStyle = WOOD;
        ctx.fillRect(X + 2, Y + 17, 28, 2.5);
        ctx.fillStyle = rgba('#000000', 0.2);
        ctx.fillRect(X + 2, Y + 19.5, 28, 1.5);
        const items = ['#b8683e', '#e8dcc0', '#7d5a86', '#8c4f2e'];
        for (let i = 0; i < 4; i++) {
          const ix = X + 6 + i * 6.5;
          const h = 5 + (hash(slot.x, i, 7) % 4);
          ellipse(
            ctx,
            ix,
            Y + 17 - h / 2,
            2.3,
            h / 2,
            items[(i + slot.x) % items.length] ?? '#b8683e',
          );
        }
        break;
      }
      case 'herbs': {
        // Bundles of drying herbs hung from a peg rail.
        ctx.fillStyle = WOOD_DARK;
        ctx.fillRect(X + 1, Y + 8, 30, 2);
        const greens = [look.foliage.dark, look.foliage.mid, '#8a6a3a', look.foliage.light];
        for (let i = 0; i < 4; i++) {
          const hx = X + 5 + i * 7;
          ctx.strokeStyle = '#6b4f30';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(hx, Y + 10);
          ctx.lineTo(hx, Y + 12);
          ctx.stroke();
          ctx.fillStyle = greens[i % greens.length] ?? look.foliage.mid;
          ctx.beginPath();
          ctx.moveTo(hx - 3, Y + 12);
          ctx.lineTo(hx + 3, Y + 12);
          ctx.lineTo(hx + 1, Y + 22);
          ctx.lineTo(hx - 1, Y + 22);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'plain':
        break;
    }
  }
}

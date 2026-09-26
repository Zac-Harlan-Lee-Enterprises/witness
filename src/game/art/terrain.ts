import type { TileKind } from '@/domain/world';
import type { Look } from './direction';
import { ellipse, fbm, hash, lumpy, mix, rgba, rng, shade, speckle, TILE, type Ctx } from './paint';
import { isPropTile, isStructure, type Site } from './site';

/**
 * Ground: flat material fills, broad light/dark variation that ignores the
 * tile grid, soft edges where materials meet, then material detail. Detail
 * gathers along walls and props and thins out in open walkways.
 */

/** Which ground material spreads over which at a boundary (higher wins). Rugs keep crisp edges. */
const SPREAD: Partial<Record<TileKind, number>> = {
  grass: 7,
  scrub: 6,
  sand: 5,
  wadi: 4,
  mud: 3.5,
  soil: 3,
  road: 3,
  paving: 2,
  'roman-road': 2,
  steps: 2,
  floor: 1,
};

export function groundColor(look: Look, kind: TileKind): string {
  switch (kind) {
    case 'sand':
    case 'scrub':
    case 'grass':
    case 'soil':
    case 'road':
    case 'paving':
    case 'floor':
    case 'wadi':
    case 'mud':
      return look.ground[kind];
    case 'steps':
    case 'door':
    case 'gate':
    case 'bridge':
      return look.ground.paving;
    case 'roman-road':
      return shade(look.ground.paving, -0.12);
    case 'mosaic':
      return '#e6dcc4';
    case 'rug':
    case 'mat':
    case 'bedroll':
      return look.ground.floor;
    default:
      return look.ground.sand;
  }
}

const isGround = (k: TileKind): boolean => !isStructure(k) || k === 'door' || k === 'gate';

export function paintGround(ctx: Ctx, site: Site, look: Look, doc: Document): void {
  const { grid } = site;
  // 1. Flat fills.
  site.forEach((x, y) => {
    const k = site.groundAt(x, y);
    if (!isGround(k)) return;
    ctx.fillStyle =
      k === 'paving' || k === 'steps' ? shade(groundColor(look, k), -0.18) : groundColor(look, k);
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
  });
  // 2. Broad variation: a low-resolution noise image, smoothly scaled up, so
  //    light and shade drift across many tiles instead of following the grid.
  const cells = 8; // world units per noise pixel
  const nw = Math.ceil((grid.width * TILE) / cells);
  const nh = Math.ceil((grid.height * TILE) / cells);
  const macro = doc.createElement('canvas');
  macro.width = nw;
  macro.height = nh;
  const mctx = macro.getContext('2d');
  if (mctx) {
    const img = mctx.createImageData(nw, nh);
    for (let j = 0; j < nh; j++) {
      for (let i = 0; i < nw; i++) {
        const n = fbm(i / 14, j / 14, 3) - 0.5;
        const o = (j * nw + i) * 4;
        const light = n > 0;
        img.data[o] = light ? 255 : 40;
        img.data[o + 1] = light ? 246 : 26;
        img.data[o + 2] = light ? 225 : 16;
        img.data[o + 3] = Math.min(255, Math.abs(n) * 2 * 110 * (0.5 + look.grit * 0.5));
      }
    }
    mctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(macro, 0, 0, nw * cells, nh * cells);
    ctx.restore();
  }
  // 3. Texture blotches (allowed to spill across tile edges).
  site.forEach((x, y) => {
    const k = site.groundAt(x, y);
    if (
      !isGround(k) ||
      k === 'rug' ||
      k === 'paving' ||
      k === 'steps' ||
      k === 'door' ||
      k === 'gate' ||
      k === 'mosaic' ||
      k === 'roman-road' ||
      k === 'bridge'
    )
      return;
    const r = rng(hash(x, y, 7));
    const base = groundColor(look, k);
    for (let i = 0; i < 3; i++)
      lumpy(
        ctx,
        x * TILE + r() * TILE,
        y * TILE + r() * TILE,
        7 + r() * 10,
        r,
        rgba(shade(base, (r() - 0.5) * 0.18), 0.32),
        8,
      );
    speckle(
      ctx,
      x * TILE,
      y * TILE,
      TILE,
      TILE,
      r,
      [shade(base, -0.16), shade(base, 0.16)],
      Math.round(6 + 10 * look.grit),
      1,
    );
  });
  // 4. Soft edges between materials.
  site.forEach((x, y) => {
    const mine = SPREAD[site.groundAt(x, y)];
    if (mine === undefined) return;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const n = site.groundAt(x + dx, y + dy);
      const theirs = SPREAD[n];
      if (theirs === undefined || theirs <= mine) continue;
      bleedEdge(
        ctx,
        x,
        y,
        dx,
        dy,
        groundColor(look, n),
        n === 'scrub' || n === 'grass',
        look,
        rng(hash(x, y, 31 + dx * 3 + dy)),
      );
    }
  });
  // 5. Material detail.
  site.forEach((x, y) => paintDetail(ctx, site, look, site.groundAt(x, y), x, y));
}

function bleedEdge(
  ctx: Ctx,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  color: string,
  grassy: boolean,
  look: Look,
  r: () => number,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const along = (t: number): [number, number] => {
    if (dy === -1) return [X + t, Y];
    if (dy === 1) return [X + t, Y + TILE];
    if (dx === -1) return [X, Y + t];
    return [X + TILE, Y + t];
  };
  for (let i = 0; i < 6; i++) {
    const [px, py] = along(r() * TILE);
    lumpy(ctx, px, py, 3 + r() * 6, r, color, 6);
  }
  if (grassy) {
    ctx.strokeStyle = look.foliage.mid;
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const [px, py] = along(r() * TILE);
      const ix = px - dx * (2 + r() * 5);
      const iy = py - dy * (2 + r() * 5);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix - 1, iy - 3.5);
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + 1.5, iy - 3);
      ctx.stroke();
    }
  }
}

function pebble(ctx: Ctx, px: number, py: number, s: number, color: string): void {
  ellipse(ctx, px + 0.6, py + 0.8, s, s * 0.65, 'rgba(50,32,16,0.28)');
  ellipse(ctx, px, py, s, s * 0.7, color);
  ellipse(ctx, px - s * 0.3, py - s * 0.25, s * 0.35, s * 0.25, rgba('#ffffff', 0.35));
}

function tuft(
  ctx: Ctx,
  gx: number,
  gy: number,
  size: number,
  dark: string,
  light: string,
  r: () => number,
): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = r() > 0.5 ? dark : light;
  ctx.beginPath();
  for (const [ex, ey] of [
    [-2.5, -4],
    [0, -5.5],
    [2.5, -4],
    [1.2, -3],
  ] as const) {
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(
      gx + ex * 0.4 * size,
      gy + ey * 0.6 * size,
      gx + ex * size,
      gy + ey * size,
    );
  }
  ctx.stroke();
}

function flower(ctx: Ctx, fx: number, fy: number, color: string): void {
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    ellipse(ctx, fx + Math.cos(a) * 1.3, fy + Math.sin(a) * 1.3, 1.1, 1.1, color);
  }
  ellipse(ctx, fx, fy, 0.8, 0.8, '#3a2a14');
}

/** True where something stands next to a tile — detail gathers there. */
function besideSomething(site: Site, x: number, y: number): boolean {
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
  ] as const) {
    const k = site.kindAt(x + dx, y + dy);
    if (
      k === 'wall' ||
      k === 'roof' ||
      k === 'tile-roof' ||
      k === 'fence' ||
      k === 'cliff' ||
      isPropTile(k)
    )
      return true;
  }
  return false;
}

function paintDetail(
  ctx: Ctx,
  site: Site,
  look: Look,
  kind: TileKind,
  tx: number,
  ty: number,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const r = rng(hash(tx, ty, 17));
  const edge = besideSomething(site, tx, ty);
  switch (kind) {
    case 'grass': {
      const n = 9 + Math.round(r() * 4);
      for (let i = 0; i < n; i++)
        tuft(
          ctx,
          X + 2 + r() * 28,
          Y + 5 + r() * 25,
          0.8 + r() * 0.5,
          look.foliage.mid,
          look.foliage.light,
          r,
        );
      if (r() < 0.5) {
        const colors = ['#e2d25a', '#f2efe4', '#d0573d', '#b98ad6'];
        for (let i = 0; i < 3; i++)
          flower(
            ctx,
            X + 4 + r() * 24,
            Y + 4 + r() * 24,
            colors[Math.floor(r() * colors.length)] ?? '#f2efe4',
          );
      }
      return;
    }
    case 'scrub': {
      const n = look.mood === 'wilderness' ? 3 : 5;
      for (let i = 0; i < n; i++)
        tuft(ctx, X + 3 + r() * 26, Y + 5 + r() * 24, 1, look.foliage.mid, look.foliage.light, r);
      // Wild flowers: red anemones and yellow chrysanthemums grow wild in the region.
      if (r() < (look.mood === 'wilderness' ? 0.12 : 0.35)) {
        const colors = ['#c8372d', '#e0b53a', '#f2efe4'];
        for (let i = 0; i < 3; i++)
          flower(
            ctx,
            X + 4 + r() * 24,
            Y + 4 + r() * 24,
            colors[Math.floor(r() * colors.length)] ?? '#c8372d',
          );
      }
      if (r() < 0.25)
        pebble(ctx, X + 6 + r() * 20, Y + 6 + r() * 20, 1.8, shade(look.ground.sand, -0.25));
      return;
    }
    case 'sand': {
      for (let i = 0; i < 2; i++)
        pebble(
          ctx,
          X + 4 + r() * 24,
          Y + 4 + r() * 24,
          1 + r() * 1.3,
          shade(look.ground.sand, -0.22),
        );
      if (look.mood === 'wilderness' || r() < 0.3) {
        // Wind ripples.
        ctx.strokeStyle = rgba(shade(look.ground.sand, -0.25), 0.3);
        ctx.lineWidth = 0.8;
        const wy = Y + 8 + r() * 16;
        ctx.beginPath();
        ctx.moveTo(X + 1, wy);
        ctx.quadraticCurveTo(X + 16, wy - 2.5, X + 31, wy);
        ctx.stroke();
      }
      if (edge) paintClutter(ctx, look, X, Y, r);
      return;
    }
    case 'soil': {
      // Tilled garden beds: furrows with young shoots.
      ctx.strokeStyle = rgba(shade(look.ground.soil, -0.35), 0.7);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(X, Y + 5 + i * 8);
        ctx.lineTo(X + TILE, Y + 5 + i * 8);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++)
        ellipse(ctx, X + 3 + r() * 26, Y + 3 + Math.floor(r() * 4) * 8, 1.4, 1, look.foliage.light);
      return;
    }
    case 'road': {
      const neighbourRoad = (dx: number, dy: number): boolean =>
        site.groundAt(tx + dx, ty + dy) === 'road';
      const horizontal = neighbourRoad(-1, 0) || neighbourRoad(1, 0);
      const worn = shade(look.ground.road, 0.1);
      // A paler, packed centre where feet and hooves go, with two cart ruts.
      ctx.fillStyle = rgba(worn, 0.5);
      if (horizontal) ctx.fillRect(X, Y + 9, TILE, 14);
      else ctx.fillRect(X + 9, Y, 14, TILE);
      ctx.strokeStyle = rgba(shade(look.ground.road, -0.3), 0.35);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(X, Y + 11 + r());
        ctx.lineTo(X + TILE, Y + 11 + r());
        ctx.moveTo(X, Y + 21 + r());
        ctx.lineTo(X + TILE, Y + 21 + r());
      } else {
        ctx.moveTo(X + 11 + r(), Y);
        ctx.lineTo(X + 11 + r(), Y + TILE);
        ctx.moveTo(X + 21 + r(), Y);
        ctx.lineTo(X + 21 + r(), Y + TILE);
      }
      ctx.stroke();
      for (let i = 0; i < 3; i++)
        pebble(
          ctx,
          X + 2 + r() * 28,
          Y + 2 + r() * 28,
          1.2 + r() * 1.6,
          shade(look.ground.road, -0.2 - r() * 0.1),
        );
      // Edge stones where the road meets rough ground.
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const n = site.groundAt(tx + dx, ty + dy);
        if (n === 'road' || n === 'paving' || n === 'steps' || !isGround(n)) continue;
        for (let i = 0; i < 3; i++) {
          const t = 3 + r() * 26;
          const sx = dy !== 0 ? X + t : dx === 1 ? X + TILE - 2 : X + 2;
          const sy = dx !== 0 ? Y + t : dy === 1 ? Y + TILE - 2 : Y + 2;
          pebble(ctx, sx, sy, 1.6 + r() * 1.4, shade(look.ground.road, -0.15));
        }
      }
      return;
    }
    case 'paving':
    case 'steps': {
      // Dressed-stone slabs over dark mortar, polished paler where people walk.
      const base = look.ground.paving;
      const rows = kind === 'steps' ? 4 : 2;
      const rowH = TILE / rows;
      const wear = 1 - Math.min(1, edge ? 1 : 0.2 + r() * 0.3);
      for (let row = 0; row < rows; row++) {
        let x0 = X;
        const yy = Y + row * rowH;
        while (x0 < X + TILE - 1) {
          const wSlab = Math.min(X + TILE - x0, 10 + r() * 12);
          ctx.fillStyle = shade(base, (r() - 0.5) * 0.14 + wear * 0.05);
          ctx.fillRect(x0 + 0.7, yy + 0.7, wSlab - 1.4, rowH - 1.4);
          ctx.fillStyle = rgba('#ffffff', 0.2);
          ctx.fillRect(x0 + 0.7, yy + 0.7, wSlab - 1.4, 0.9);
          ctx.fillStyle = rgba(shade(base, -0.45), 0.3);
          ctx.fillRect(x0 + 0.7, yy + rowH - 1.5, wSlab - 1.4, 0.8);
          x0 += wSlab;
        }
      }
      if (kind === 'steps') {
        ctx.fillStyle = rgba(shade(base, -0.55), 0.35);
        for (let row = 1; row < rows; row++) ctx.fillRect(X, Y + row * rowH - 1.2, TILE, 1.5);
      }
      if (look.mood === 'oasis' && r() < 0.35) {
        // Green in the joints.
        for (let i = 0; i < 4; i++)
          ellipse(
            ctx,
            X + r() * TILE,
            Y + Math.floor(r() * 2) * 16 + 15.5,
            1.6,
            0.8,
            look.foliage.mid,
          );
      }
      if (r() < 0.2) {
        ctx.strokeStyle = rgba(shade(base, -0.45), 0.45);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        const cx = X + 6 + r() * 20;
        const cy = Y + 6 + r() * 20;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 3 + r() * 3, cy + 2);
        ctx.lineTo(cx + 5, cy + 5 + r() * 2);
        ctx.stroke();
      }
      if (edge && r() < look.clutter * 0.5) paintClutter(ctx, look, X, Y, r);
      return;
    }
    case 'floor': {
      // Packed earth and lime plaster: trowel arcs, a little straw.
      ctx.strokeStyle = rgba(shade(look.ground.floor, 0.1), 0.22);
      ctx.lineWidth = 1;
      for (let i = 0; i < (r() < 0.4 ? 1 : 0); i++) {
        const cx = X + r() * TILE;
        const cy = Y + r() * TILE;
        ctx.beginPath();
        ctx.arc(cx, cy, 8 + r() * 8, r() * 6, r() * 6 + 1.2);
        ctx.stroke();
      }
      speckle(
        ctx,
        X,
        Y,
        TILE,
        TILE,
        r,
        [shade(look.ground.floor, -0.2), shade(look.ground.floor, 0.14)],
        8,
        1,
      );
      if (edge || r() < 0.2) paintClutter(ctx, look, X, Y, r);
      return;
    }
    case 'rug':
      paintRug(ctx, site, look, tx, ty);
      return;
    case 'mosaic':
      paintMosaic(ctx, site, tx, ty);
      return;
    case 'roman-road':
      paintRomanRoad(ctx, site, look, tx, ty, r);
      return;
    case 'bridge':
      paintBridge(ctx, site, look, tx, ty, r);
      return;
    case 'wadi': {
      for (let i = 0; i < 7; i++)
        pebble(
          ctx,
          X + 3 + r() * 26,
          Y + 3 + r() * 26,
          1.3 + r() * 2.2,
          r() > 0.5 ? shade(look.ground.wadi, -0.18) : shade(look.ground.wadi, 0.1),
        );
      return;
    }
    case 'mud': {
      ctx.strokeStyle = rgba(shade(look.ground.mud, -0.35), 0.5);
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        const sx = X + r() * TILE;
        const sy = Y + r() * TILE;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (r() - 0.5) * 12, sy + (r() - 0.5) * 12);
        ctx.stroke();
      }
      ellipse(
        ctx,
        X + 10 + r() * 12,
        Y + 10 + r() * 12,
        6,
        2.5,
        rgba(shade(look.ground.mud, 0.3), 0.35),
      );
      return;
    }
    default:
      return;
  }
}

/** Small lived-in things on the ground: straw, sherds, stones, grain, leaves. */
function paintClutter(ctx: Ctx, look: Look, X: number, Y: number, r: () => number): void {
  if (r() > look.clutter * 0.8) return;
  const x = X + 4 + r() * 24;
  const y = Y + 6 + r() * 22;
  switch (look.mood) {
    case 'home':
    case 'city': {
      if (r() < 0.5) {
        // Straw wisps.
        ctx.strokeStyle = rgba('#e4c36e', 0.8);
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x + r() * 4, y + r() * 3);
          ctx.lineTo(x + 3 + r() * 5, y + r() * 3 - 1);
          ctx.stroke();
        }
      } else {
        // A pottery sherd.
        ctx.fillStyle = mix('#b8683e', look.ground.sand, 0.2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 3.5, y - 1);
        ctx.lineTo(x + 3, y + 2);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    case 'oasis': {
      // Fallen palm leaflets and dates.
      ctx.strokeStyle = rgba(look.foliage.dark, 0.7);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 4, y - 2, x + 8, y + 1);
      ctx.stroke();
      if (r() < 0.5) ellipse(ctx, x + 2, y + 3, 1, 1, '#8a3f14');
      return;
    }
    case 'wilderness': {
      // Dry twigs and flints.
      ctx.strokeStyle = rgba('#7a6040', 0.7);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - 1.5);
      ctx.moveTo(x + 3, y - 0.8);
      ctx.lineTo(x + 5, y + 1.2);
      ctx.stroke();
      return;
    }
  }
}

/**
 * A floor of small stone tesserae: a cream field with a guilloche-like border
 * where the floor meets a wall, and a repeating rosette-and-diamond motif.
 */
function paintMosaic(ctx: Ctx, site: Site, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const field = '#e6dcc4';
  const red = '#9a3b2a';
  const dark = '#3b3430';
  const ochre = '#c9953e';
  const r = rng(hash(tx, ty, 61));
  // The grain of the tesserae.
  ctx.fillStyle = rgba('#8a7a60', 0.18);
  for (let i = 0; i < TILE; i += 2.6) ctx.fillRect(X, Y + i, TILE, 0.35);
  for (let i = 0; i < TILE; i += 2.6) ctx.fillRect(X + i, Y, 0.35, TILE);
  speckle(ctx, X, Y, TILE, TILE, r, [shade(field, -0.08), shade(field, 0.06)], 18, 1.2);
  const edge = (dx: number, dy: number): boolean => site.kindAt(tx + dx, ty + dy) !== 'mosaic';
  // Border bands where the mosaic ends.
  const band = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = red;
    if (w > h) for (let i = 0; i < w; i += 4) ellipse(ctx, x + i + 2, y + h / 2, 1.6, h / 3, red);
    else for (let i = 0; i < h; i += 4) ellipse(ctx, x + w / 2, y + i + 2, w / 3, 1.6, red);
  };
  if (edge(0, -1)) band(X, Y + 1, TILE, 4);
  if (edge(0, 1)) band(X, Y + TILE - 5, TILE, 4);
  if (edge(-1, 0)) band(X + 1, Y, 4, TILE);
  if (edge(1, 0)) band(X + TILE - 5, Y, 4, TILE);
  // Alternate a rosette and a diamond, like panels in a carpet of stone.
  if ((tx + ty) % 2 === 0) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ellipse(ctx, X + 16 + Math.cos(a) * 4.5, Y + 16 + Math.sin(a) * 4.5, 2.4, 1.2, red, a);
    }
    ellipse(ctx, X + 16, Y + 16, 2.2, 2.2, ochre);
  } else {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(X + 16, Y + 9);
    ctx.lineTo(X + 23, Y + 16);
    ctx.lineTo(X + 16, Y + 23);
    ctx.lineTo(X + 9, Y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ochre;
    ctx.beginPath();
    ctx.moveTo(X + 16, Y + 12);
    ctx.lineTo(X + 20, Y + 16);
    ctx.lineTo(X + 16, Y + 20);
    ctx.lineTo(X + 12, Y + 16);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A paved Roman highway: big, closely fitted paving stones, a slight camber
 * (lighter along the crown), and a line of kerbstones where the road ends.
 */
function paintRomanRoad(
  ctx: Ctx,
  site: Site,
  look: Look,
  tx: number,
  ty: number,
  r: () => number,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const stone = shade(look.ground.paving, -0.1);
  const road = (dx: number, dy: number): boolean => {
    const k = site.groundAt(tx + dx, ty + dy);
    return k === 'roman-road' || k === 'bridge' || k === 'gate';
  };
  // Irregular slabs laid in rough courses across the road.
  for (let row = 0; row < 3; row++) {
    let x0 = X + (row % 2) * -5;
    const y0 = Y + row * 10.7;
    while (x0 < X + TILE) {
      const w = 9 + r() * 7;
      const sx = Math.max(X, x0);
      const sw = Math.min(X + TILE, x0 + w) - sx;
      if (sw > 1.2) {
        ctx.fillStyle = shade(stone, (r() - 0.5) * 0.16);
        ctx.beginPath();
        ctx.moveTo(sx + 0.8, y0 + 1 + r());
        ctx.lineTo(sx + sw - 0.8, y0 + 0.8 + r());
        ctx.lineTo(sx + sw - 0.6, y0 + 10 - r());
        ctx.lineTo(sx + 0.7, y0 + 10.2 - r());
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.16);
        ctx.fillRect(sx + 1.2, y0 + 1.4, sw - 2.4, 0.8);
      }
      x0 += w;
    }
  }
  // Worn wheel ruts along the road.
  const horizontal = road(-1, 0) || road(1, 0);
  ctx.strokeStyle = rgba(shade(stone, -0.45), 0.28);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  if (horizontal) {
    ctx.moveTo(X, Y + 11);
    ctx.lineTo(X + TILE, Y + 11);
    ctx.moveTo(X, Y + 21);
    ctx.lineTo(X + TILE, Y + 21);
  } else {
    ctx.moveTo(X + 11, Y);
    ctx.lineTo(X + 11, Y + TILE);
    ctx.moveTo(X + 21, Y);
    ctx.lineTo(X + 21, Y + TILE);
  }
  ctx.stroke();
  // Kerbstones: a raised line of long blocks where the road meets the verge.
  const kerb = shade(look.ground.paving, 0.08);
  const kerbRun = (x: number, y: number, w: number, h: number, alongX: boolean): void => {
    ctx.fillStyle = rgba(look.shadow.color, 0.35);
    ctx.fillRect(x + 1, y + 1.2, w, h);
    ctx.fillStyle = kerb;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.fillRect(x, y, alongX ? w : 1, alongX ? 1 : h);
    ctx.fillStyle = rgba(shade(kerb, -0.5), 0.5);
    const len = alongX ? w : h;
    for (let i = 8 + r() * 4; i < len; i += 9 + r() * 5)
      if (alongX) ctx.fillRect(x + i, y, 0.7, h);
      else ctx.fillRect(x, y + i, w, 0.7);
  };
  if (!road(0, -1)) kerbRun(X, Y, TILE, 3.2, true);
  if (!road(0, 1)) kerbRun(X, Y + TILE - 3.2, TILE, 3.2, true);
  if (!road(-1, 0)) kerbRun(X, Y, 3.2, TILE, false);
  if (!road(1, 0)) kerbRun(X + TILE - 3.2, Y, 3.2, TILE, false);
}

/** A stone bridge deck, with a low parapet wherever the deck meets water. */
function paintBridge(
  ctx: Ctx,
  site: Site,
  look: Look,
  tx: number,
  ty: number,
  r: () => number,
): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const stone = shade(look.ground.paving, -0.05);
  for (let row = 0; row < 4; row++) {
    ctx.fillStyle = shade(stone, (r() - 0.5) * 0.12);
    ctx.fillRect(X + 0.6, Y + row * 8 + 0.6, TILE - 1.2, 6.8);
    ctx.fillStyle = rgba(shade(stone, -0.5), 0.35);
    ctx.fillRect(X, Y + row * 8 + 7.4, TILE, 0.8);
  }
  const water = (dx: number, dy: number): boolean => site.kindAt(tx + dx, ty + dy) === 'water';
  const parapet = (x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = rgba(look.shadow.color, 0.4);
    ctx.fillRect(x + 1.5, y + 2, w, h);
    ctx.fillStyle = shade(look.building.face, -0.08);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rgba('#ffffff', 0.4);
    ctx.fillRect(x, y, w, 1.2);
  };
  if (water(-1, 0)) parapet(X, Y, 4.5, TILE);
  if (water(1, 0)) parapet(X + TILE - 4.5, Y, 4.5, TILE);
  if (water(0, -1)) parapet(X, Y, TILE, 4.5);
  if (water(0, 1)) parapet(X, Y + TILE - 4.5, TILE, 4.5);
}

function paintRug(ctx: Ctx, site: Site, look: Look, tx: number, ty: number): void {
  const X = tx * TILE;
  const Y = ty * TILE;
  const main = look.accents[0] ?? '#973d2d';
  const trim = look.accents[2] ?? '#e0b453';
  const blue = look.accents[1] ?? '#35527a';
  const edge = (dx: number, dy: number): boolean => site.kindAt(tx + dx, ty + dy) !== 'rug';
  ctx.fillStyle = main;
  ctx.fillRect(X, Y, TILE, TILE);
  ctx.fillStyle = rgba('#3a1008', 0.22);
  for (let i = 0; i < TILE; i += 3) ctx.fillRect(X, Y + i, TILE, 1);
  // Border bands.
  ctx.fillStyle = blue;
  if (edge(0, -1)) ctx.fillRect(X, Y + 2, TILE, 4);
  if (edge(0, 1)) ctx.fillRect(X, Y + TILE - 6, TILE, 4);
  if (edge(-1, 0)) ctx.fillRect(X + 2, Y, 4, TILE);
  if (edge(1, 0)) ctx.fillRect(X + TILE - 6, Y, 4, TILE);
  ctx.fillStyle = trim;
  if (edge(0, -1)) ctx.fillRect(X, Y + 3.3, TILE, 1.2);
  if (edge(0, 1)) ctx.fillRect(X, Y + TILE - 4.6, TILE, 1.2);
  if (edge(-1, 0)) ctx.fillRect(X + 3.3, Y, 1.2, TILE);
  if (edge(1, 0)) ctx.fillRect(X + TILE - 4.6, Y, 1.2, TILE);
  // Tassels on the short ends.
  if (edge(-1, 0) || edge(1, 0)) {
    ctx.strokeStyle = shade(trim, -0.1);
    ctx.lineWidth = 0.6;
    const sx = edge(-1, 0) ? X : X + TILE;
    const dir = edge(-1, 0) ? -1 : 1;
    for (let i = 3; i < TILE; i += 3) {
      ctx.beginPath();
      ctx.moveTo(sx, Y + i);
      ctx.lineTo(sx + dir * 2.5, Y + i + 0.5);
      ctx.stroke();
    }
  }
  // Central diamond motif.
  ctx.fillStyle = rgba(trim, 0.85);
  ctx.beginPath();
  ctx.moveTo(X + 16, Y + 9);
  ctx.lineTo(X + 23, Y + 16);
  ctx.lineTo(X + 16, Y + 23);
  ctx.lineTo(X + 9, Y + 16);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, X + 16, Y + 16, 2.4, 2.4, blue);
}

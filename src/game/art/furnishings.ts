import type { TileKind } from '@/domain/world';
import { paintMastFoot } from './boats';
import type { Look } from './direction';
import { ellipse, mix, rgba, rng, shade, type Ctx } from './paint';

/**
 * Things people made: stalls, pottery, the bread oven, a well, crates and
 * sacks, a loom, mats, a cart, a caravan tent, a stone manger, a heap of
 * straw and a shepherds' fire; in the Greek cities of Asia Minor, stone
 * columns, dye vats, amphorae, dining couches, milestones, bronze lampstands
 * and public fountains; and by the lake, nets hung to dry, a fish-drying
 * rack and the foot of a boat's mast. Painted in local coordinates
 * (the tile spans 0–32; tall things may rise above 0). Returns false for
 * kinds it doesn't paint.
 */
const WOOD = '#8a623c';
const WOOD_DARK = '#573b22';
const CLAY = '#b8683e';
const CLAY_DARK = '#8c4f2e';
const LINEN = '#ece2c8';
const ROPE_COLOR = '#c9b184';

function pick<T>(items: readonly T[], r: () => number, fallback: T): T {
  return items[Math.floor(r() * items.length)] ?? fallback;
}

function jar(c: Ctx, jx: number, jy: number, s: number, col: string): void {
  ellipse(c, jx, jy, 6 * s, 8 * s, col);
  ellipse(c, jx - 2 * s, jy - 2 * s, 2 * s, 3.5 * s, rgba('#ffffff', 0.25));
  ellipse(c, jx, jy - 8 * s, 3 * s, 1.5 * s, shade(col, -0.3));
  c.strokeStyle = rgba('#5c3a1f', 0.6);
  c.lineWidth = 0.6;
  c.beginPath();
  c.ellipse(jx, jy - 2 * s, 5.5 * s, 1.5 * s, 0, 0, Math.PI);
  c.stroke();
}

function produce(c: Ctx, x: number, y: number, w: number, look: Look, r: () => number): void {
  const goods =
    look.mood === 'oasis'
      ? ['#d0702a', '#8a3f14', '#e2b13a', '#6a9a3a', '#7d4a86']
      : ['#b3432d', '#d8a13c', '#6f7d3e', '#7a3b62', '#e8dcc0'];
  for (let i = 0; i < w / 3.2; i++)
    ellipse(
      c,
      x + 1.5 + i * 3.2 + r() * 0.8,
      y + (i % 2) * 1.4,
      1.8,
      1.5,
      pick(goods, r, '#b3432d'),
    );
}

export function paintFurnishing(c: Ctx, kind: TileKind, look: Look, seed: number): boolean {
  const r = rng(seed);
  const accent = (i: number): string => look.accents[(seed + i) % look.accents.length] ?? '#b23a2c';
  switch (kind) {
    case 'stall': {
      c.fillStyle = WOOD_DARK;
      c.fillRect(2, 5, 2.4, 25);
      c.fillRect(27.6, 5, 2.4, 25);
      // Counter with baskets of goods.
      c.fillStyle = WOOD;
      c.fillRect(0, 19, 32, 8);
      c.fillStyle = shade(WOOD, -0.25);
      c.fillRect(0, 25, 32, 2);
      for (let i = 0; i < 3; i++) {
        const bx = 2 + i * 10;
        ellipse(c, bx + 4, 20, 4.6, 2.4, '#c9a868');
        produce(c, bx + 0.5, 18.5, 7, look, r);
      }
      // A sloping cloth awning in two alternating colours.
      const a = accent(0);
      const b = look.mood === 'oasis' ? '#e8dcc0' : accent(3);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 === 0 ? a : b;
        c.beginPath();
        c.moveTo(-1 + i * 8.5, 1);
        c.lineTo(7.5 + i * 8.5, 1);
        c.lineTo(7.5 + i * 8.5, 12);
        c.quadraticCurveTo(3.25 + i * 8.5, 15.5, -1 + i * 8.5, 12);
        c.closePath();
        c.fill();
      }
      c.fillStyle = rgba('#000000', 0.14);
      c.fillRect(-1, 1, 34, 2.5);
      c.fillStyle = rgba('#ffffff', 0.22);
      c.fillRect(-1, 3.5, 34, 1);
      return true;
    }
    case 'table': {
      c.fillStyle = WOOD;
      c.fillRect(2, 9, 28, 14);
      c.fillStyle = shade(WOOD, 0.15);
      for (let i = 0; i < 4; i++) c.fillRect(2, 10 + i * 3.4, 28, 0.6);
      c.fillStyle = WOOD_DARK;
      c.fillRect(2, 22, 28, 3);
      c.fillRect(3, 25, 2, 4);
      c.fillRect(27, 25, 2, 4);
      if (r() < 0.6) {
        ellipse(c, 10, 14, 4.2, 2.4, LINEN);
        ellipse(c, 10, 13.6, 2.6, 1.3, '#c9a868');
        ellipse(c, 21, 13, 2.6, 2.6, CLAY);
        ellipse(c, 21, 12, 1.6, 0.8, shade(CLAY, -0.3));
      } else {
        // Bread and a bowl of olives.
        ellipse(c, 11, 14, 5, 3, '#d8a860');
        ellipse(c, 11, 13, 3.6, 1.6, '#e8c283');
        ellipse(c, 22, 15, 3.4, 2, shade(CLAY, 0.1));
        for (let i = 0; i < 4; i++)
          ellipse(c, 21 + (i % 2) * 1.6, 14.4 + Math.floor(i / 2), 0.8, 0.8, '#3d4a2a');
      }
      return true;
    }
    case 'jars': {
      jar(c, 11, 20, 1, CLAY);
      jar(c, 22, 23, 0.8, CLAY_DARK);
      if (r() < 0.5) jar(c, 17, 25.5, 0.55, mix(CLAY, LINEN, 0.35));
      return true;
    }
    case 'oven': {
      // A domed clay bread oven (tabun) with a fire glowing in its mouth.
      ellipse(c, 16, 20, 12.5, 10, CLAY);
      ellipse(c, 16, 22, 12.5, 7, shade(CLAY, -0.15));
      ellipse(c, 11, 15, 4, 3, rgba('#ffffff', 0.18));
      ellipse(c, 16, 22, 5.5, 4, '#2a150c');
      ellipse(c, 16, 23, 3.6, 2.2, '#e3823a');
      ellipse(c, 16, 23.4, 2, 1.1, '#ffd27a');
      // Flat bread baking on top.
      ellipse(c, 16, 12, 5, 2.4, '#d8a860');
      return true;
    }
    case 'well': {
      ellipse(c, 16, 19, 14, 11, '#9c8a6c');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ellipse(
          c,
          16 + Math.cos(a) * 11.5,
          19 + Math.sin(a) * 8.5,
          3.4,
          2.6,
          i % 2 ? '#b4a383' : '#a08e6e',
        );
      }
      const grad = c.createRadialGradient(16, 19, 1, 16, 19, 8);
      grad.addColorStop(0, '#0f2530');
      grad.addColorStop(1, '#2f5566');
      c.fillStyle = grad;
      c.beginPath();
      c.ellipse(16, 19, 8, 5.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = WOOD_DARK;
      c.fillRect(2, 1, 2.6, 18);
      c.fillRect(27.4, 1, 2.6, 18);
      c.fillRect(2, 1, 28, 2.6);
      c.strokeStyle = '#c9b48a';
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(16, 3.6);
      c.lineTo(16, 13);
      c.stroke();
      ellipse(c, 16, 14, 2.6, 2, WOOD);
      jar(c, 27, 27, 0.45, CLAY);
      return true;
    }
    case 'crate': {
      const box = (x: number, y: number, w: number, h: number): void => {
        c.fillStyle = WOOD;
        c.fillRect(x, y, w, h);
        c.fillStyle = shade(WOOD, 0.18);
        c.fillRect(x, y, w, 3);
        c.strokeStyle = WOOD_DARK;
        c.lineWidth = 0.8;
        c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        c.beginPath();
        c.moveTo(x + 1, y + h - 1);
        c.lineTo(x + w - 1, y + 3);
        c.stroke();
      };
      box(3, 12, 15, 15);
      box(15, 17, 14, 12);
      if (r() < 0.6) box(6, 2, 12, 11);
      return true;
    }
    case 'sacks': {
      const sack = (x: number, y: number, s: number, col: string, open: boolean): void => {
        ellipse(c, x, y, 7 * s, 8.5 * s, col);
        ellipse(c, x - 2 * s, y - 2 * s, 2.4 * s, 4 * s, rgba('#ffffff', 0.2));
        c.fillStyle = shade(col, -0.25);
        c.fillRect(x - 3 * s, y - 9 * s, 6 * s, 2 * s);
        if (open)
          ellipse(c, x, y - 8.5 * s, 4 * s, 1.8 * s, look.mood === 'oasis' ? '#8a3f14' : '#e2c170');
      };
      sack(10, 20, 1, '#cdb58a', false);
      sack(21, 22, 0.9, '#b89e70', true);
      if (r() < 0.5) sack(15, 26, 0.6, '#d8c49a', true);
      return true;
    }
    case 'basket': {
      const bk = (x: number, y: number, s: number): void => {
        ellipse(c, x, y, 8 * s, 5.5 * s, '#b8904e');
        c.strokeStyle = rgba('#7a5a2c', 0.8);
        c.lineWidth = 0.6;
        for (let i = -2; i <= 2; i++) {
          c.beginPath();
          c.ellipse(x, y + i * 1.6 * s, 7.6 * s, 1.4 * s, 0, 0, Math.PI);
          c.stroke();
        }
        ellipse(c, x, y - 3.6 * s, 7.2 * s, 2.8 * s, '#8a6a34');
        produce(c, x - 6 * s, y - 4.4 * s, 12 * s, look, r);
      };
      bk(11, 20, 1);
      bk(22, 24, 0.75);
      return true;
    }
    case 'loom': {
      // An upright warp-weighted loom with cloth half woven.
      c.fillStyle = WOOD_DARK;
      c.fillRect(3, -8, 2.6, 36);
      c.fillRect(26.4, -8, 2.6, 36);
      c.fillRect(1, -8, 30, 3);
      c.strokeStyle = rgba(LINEN, 0.9);
      c.lineWidth = 0.5;
      for (let i = 0; i < 12; i++) {
        c.beginPath();
        c.moveTo(6.5 + i * 1.8, -5);
        c.lineTo(6.5 + i * 1.8, 22);
        c.stroke();
      }
      const cloth = accent(1);
      c.fillStyle = cloth;
      c.fillRect(6, -5, 20.5, 13);
      c.fillStyle = rgba(accent(2), 0.9);
      c.fillRect(6, 1, 20.5, 2);
      for (let i = 0; i < 6; i++) ellipse(c, 7.5 + i * 3.4, 24, 1.8, 2.2, '#9c8a6c');
      return true;
    }
    case 'mat': {
      c.fillStyle = '#c9a868';
      c.fillRect(1, 4, 30, 24);
      c.strokeStyle = rgba('#8a6a34', 0.7);
      c.lineWidth = 0.7;
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.moveTo(1, 6 + i * 3);
        c.lineTo(31, 6 + i * 3);
        c.stroke();
      }
      c.fillStyle = accent(0);
      c.fillRect(1, 4, 30, 2);
      c.fillRect(1, 26, 30, 2);
      return true;
    }
    case 'bedroll': {
      // A rolled sleeping mat and a folded blanket.
      c.fillStyle = accent(1);
      c.fillRect(3, 10, 26, 12);
      c.fillStyle = rgba('#ffffff', 0.2);
      c.fillRect(3, 10, 26, 2);
      c.fillStyle = rgba(accent(2), 0.9);
      c.fillRect(3, 15, 26, 1.5);
      ellipse(c, 16, 25, 13, 3.4, '#c9a868');
      ellipse(c, 4, 25, 2.2, 3.4, '#a88a4c');
      return true;
    }
    case 'cart': {
      c.fillStyle = WOOD;
      c.fillRect(1, 8, 26, 12);
      c.fillStyle = shade(WOOD, 0.15);
      c.fillRect(1, 8, 26, 2.5);
      c.strokeStyle = WOOD_DARK;
      c.lineWidth = 0.8;
      for (let i = 1; i < 4; i++) {
        c.beginPath();
        c.moveTo(1 + i * 6.5, 8);
        c.lineTo(1 + i * 6.5, 20);
        c.stroke();
      }
      // Load.
      ellipse(c, 9, 7, 6, 4, '#cdb58a');
      ellipse(c, 18, 6, 5, 3.5, '#b89e70');
      // Wheel and shaft.
      ellipse(c, 12, 22, 6, 6, WOOD_DARK);
      ellipse(c, 12, 22, 4.2, 4.2, WOOD);
      ellipse(c, 12, 22, 1.4, 1.4, WOOD_DARK);
      c.strokeStyle = WOOD_DARK;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(27, 14);
      c.lineTo(34, 16);
      c.stroke();
      return true;
    }
    case 'tent': {
      // A caravan tent of dark goat-hair cloth, with a stripe.
      const cloth = look.mood === 'oasis' ? '#5a4232' : '#4a3a30';
      c.fillStyle = cloth;
      c.beginPath();
      c.moveTo(-2, 28);
      c.lineTo(3, 2);
      c.lineTo(29, 2);
      c.lineTo(34, 28);
      c.closePath();
      c.fill();
      c.fillStyle = shade(cloth, 0.18);
      c.beginPath();
      c.moveTo(3, 2);
      c.lineTo(16, 0);
      c.lineTo(29, 2);
      c.lineTo(16, 6);
      c.closePath();
      c.fill();
      c.fillStyle = accent(2);
      c.fillRect(1, 17, 30, 2);
      // The open flap.
      c.fillStyle = '#1e140c';
      c.beginPath();
      c.moveTo(11, 28);
      c.lineTo(16, 12);
      c.lineTo(21, 28);
      c.closePath();
      c.fill();
      c.strokeStyle = rgba('#c9b48a', 0.8);
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(-2, 28);
      c.lineTo(-5, 31);
      c.moveTo(34, 28);
      c.lineTo(37, 31);
      c.stroke();
      return true;
    }
    case 'trough': {
      c.fillStyle = '#a08e6e';
      c.fillRect(1, 12, 30, 12);
      c.fillStyle = shade('#a08e6e', 0.2);
      c.fillRect(1, 12, 30, 2);
      c.fillStyle = '#2f6f86';
      c.fillRect(3, 14.5, 26, 6);
      c.fillStyle = rgba('#d8f0f2', 0.5);
      c.fillRect(5, 15.5, 8, 1);
      return true;
    }
    case 'cloth': {
      // Dyed cloth drying on a line between two posts.
      c.fillStyle = WOOD_DARK;
      c.fillRect(1, -4, 2.2, 32);
      c.fillRect(28.8, -4, 2.2, 32);
      c.strokeStyle = WOOD_DARK;
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(2, -2);
      c.quadraticCurveTo(16, 1, 30, -2);
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const col = accent(i);
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(4 + i * 8.5, -1 + (i === 1 ? 1 : 0));
        c.lineTo(11 + i * 8.5, -1 + (i === 1 ? 1 : 0));
        c.lineTo(11 + i * 8.5, 16 + (i % 2) * 3);
        c.lineTo(4 + i * 8.5, 15 + (i % 2) * 3);
        c.closePath();
        c.fill();
        c.fillStyle = rgba('#000000', 0.12);
        c.fillRect(9.5 + i * 8.5, 0, 1.5, 15 + (i % 2) * 3);
      }
      return true;
    }
    case 'manger': {
      // A feeding trough cut from one block of limestone, with fodder in it.
      const stone = '#b3a283';
      c.fillStyle = shade(stone, -0.28);
      c.beginPath();
      c.roundRect(2, 12, 28, 15, 3);
      c.fill();
      c.fillStyle = stone;
      c.beginPath();
      c.roundRect(2, 9, 28, 13, 3);
      c.fill();
      // The hollow, then straw heaped in it.
      c.fillStyle = shade(stone, -0.45);
      c.beginPath();
      c.roundRect(5, 11, 22, 8, 2);
      c.fill();
      for (let i = 0; i < 14; i++) {
        c.strokeStyle = i % 2 ? '#d9bd72' : '#b99a52';
        c.lineWidth = 0.8;
        const sx = 6 + r() * 20;
        const sy = 12 + r() * 6;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + (r() - 0.5) * 7, sy - 1 - r() * 2.5);
        c.stroke();
      }
      c.fillStyle = rgba('#ffffff', 0.25);
      c.fillRect(3, 9.5, 26, 1.2);
      // Chisel marks on the face.
      c.strokeStyle = rgba(shade(stone, -0.5), 0.45);
      c.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) {
        const mx = 5 + i * 5.5 + r();
        c.beginPath();
        c.moveTo(mx, 21);
        c.lineTo(mx + 1.2, 25);
        c.stroke();
      }
      return true;
    }
    case 'hay': {
      // A loose heap of straw and chaff.
      ellipse(c, 16, 22, 14, 8, '#a8894a');
      ellipse(c, 15, 18, 12, 9, '#c9aa62');
      ellipse(c, 13, 14, 8, 6, '#d9bd72');
      for (let i = 0; i < 24; i++) {
        const sx = 4 + r() * 24;
        const sy = 9 + r() * 18;
        c.strokeStyle = i % 3 ? '#e6cf8a' : '#9c7c3e';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + (r() - 0.5) * 8, sy + (r() - 0.5) * 4);
        c.stroke();
      }
      return true;
    }
    case 'campfire': {
      // A ring of blackened stones, embers and a low flame.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ellipse(
          c,
          16 + Math.cos(a) * 9,
          22 + Math.sin(a) * 5,
          3,
          2.2,
          i % 2 ? '#8d8069' : '#6e6252',
        );
      }
      ellipse(c, 16, 22, 6.5, 3.6, '#2a1a10');
      c.strokeStyle = WOOD_DARK;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(11, 24);
      c.lineTo(21, 20);
      c.moveTo(12, 20);
      c.lineTo(20, 24);
      c.stroke();
      ellipse(c, 16, 22, 4, 2.2, '#c2481e');
      ellipse(c, 16, 19, 3.2, 4.5, rgba('#f08a2a', 0.9));
      ellipse(c, 16, 18.5, 1.8, 3, rgba('#ffd27a', 0.95));
      return true;
    }
    case 'column': {
      // A stone column: moulded base, a fluted shaft that swells slightly,
      // and an Ionic capital with its scrolls, rising well above its tile.
      const stone = shade(look.building.face, 0.08);
      const g = c.createLinearGradient(10, 0, 22, 0);
      g.addColorStop(0, shade(stone, 0.16));
      g.addColorStop(0.45, stone);
      g.addColorStop(1, shade(stone, -0.3));
      c.fillStyle = shade(stone, -0.12);
      c.fillRect(7, 25, 18, 4.5);
      ellipse(c, 16, 24.5, 8, 2.2, shade(stone, 0.04));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(11, 24);
      c.quadraticCurveTo(10.3, 0, 11.6, -20);
      c.lineTo(20.4, -20);
      c.quadraticCurveTo(21.7, 0, 21, 24);
      c.closePath();
      c.fill();
      c.strokeStyle = rgba(shade(stone, -0.45), 0.35);
      c.lineWidth = 0.5;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(12.8 + i * 2.2, -19);
        c.lineTo(12.6 + i * 2.2, 23.5);
        c.stroke();
      }
      // Capital: echinus and the two volutes, then the square abacus.
      ellipse(c, 16, -21, 6.4, 2, shade(stone, 0.05));
      ellipse(c, 9.4, -23.5, 2.6, 2.6, shade(stone, -0.05));
      ellipse(c, 22.6, -23.5, 2.6, 2.6, shade(stone, -0.12));
      c.strokeStyle = rgba(shade(stone, -0.5), 0.5);
      c.beginPath();
      c.arc(9.4, -23.5, 1.2, 0, Math.PI * 1.6);
      c.moveTo(23.8, -23.5);
      c.arc(22.6, -23.5, 1.2, 0, Math.PI * 1.6);
      c.stroke();
      c.fillStyle = shade(stone, 0.12);
      c.fillRect(6.5, -28.5, 19, 3.4);
      c.fillStyle = rgba('#ffffff', 0.35);
      c.fillRect(6.5, -28.5, 19, 0.9);
      return true;
    }
    case 'vat': {
      // A round dye vat set in a plastered stone surround, full of colour.
      const dyes = ['#8e2a26', '#6a2a4f', '#2f4a78', '#a8322a', '#d6cfae'];
      const dye = dyes[seed % dyes.length] ?? '#8e2a26';
      c.fillStyle = '#b7a888';
      c.fillRect(2, 8, 28, 20);
      c.fillStyle = shade('#b7a888', 0.18);
      c.fillRect(2, 8, 28, 2.4);
      c.fillStyle = shade('#b7a888', -0.25);
      c.fillRect(2, 25.5, 28, 2.5);
      ellipse(c, 16, 18, 11.5, 7.5, shade('#b7a888', -0.35));
      const d = c.createRadialGradient(13, 16, 1, 16, 18, 11);
      d.addColorStop(0, shade(dye, 0.2));
      d.addColorStop(1, shade(dye, -0.3));
      c.fillStyle = d;
      c.beginPath();
      c.ellipse(16, 18.5, 10, 6.4, 0, 0, Math.PI * 2);
      c.fill();
      ellipse(c, 12.5, 16.5, 3, 1, rgba('#ffffff', 0.3));
      // Stained rim and a stirring pole.
      c.strokeStyle = rgba(dye, 0.5);
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(16, 18, 11.5, 7.5, 0, Math.PI * 0.1, Math.PI * 0.9);
      c.stroke();
      if (r() < 0.6) {
        c.strokeStyle = WOOD;
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(18, 19);
        c.lineTo(28, 4);
        c.stroke();
      }
      return true;
    }
    case 'amphorae': {
      // Tall two-handled transport jars leaning together on their pointed feet.
      const amph = (x: number, lean: number, s: number, col: string): void => {
        c.save();
        c.translate(x, 28);
        c.rotate(lean);
        c.scale(s, s);
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(-6.5, -8, -5.5, -17);
        c.quadraticCurveTo(-4.5, -24, -1.6, -26);
        c.lineTo(-1.6, -31);
        c.lineTo(1.6, -31);
        c.lineTo(1.6, -26);
        c.quadraticCurveTo(4.5, -24, 5.5, -17);
        c.quadraticCurveTo(6.5, -8, 0, 0);
        c.closePath();
        c.fill();
        ellipse(c, -2.4, -16, 1.6, 6, rgba('#ffffff', 0.22));
        c.strokeStyle = shade(col, -0.25);
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(-1.6, -29);
        c.quadraticCurveTo(-5, -29, -4.6, -24.5);
        c.moveTo(1.6, -29);
        c.quadraticCurveTo(5, -29, 4.6, -24.5);
        c.stroke();
        ellipse(c, 0, -31, 1.8, 0.7, shade(col, -0.4));
        c.restore();
      };
      amph(10, -0.12, 0.95, CLAY);
      amph(21, 0.1, 0.9, mix(CLAY, '#d8b48a', 0.3));
      if (r() < 0.6) amph(16, 0.02, 0.8, CLAY_DARK);
      return true;
    }
    case 'couch': {
      // A dining couch: a wooden frame, a thick mattress and a bolster.
      const cloth = accent(0);
      c.fillStyle = WOOD_DARK;
      c.fillRect(1, 12, 30, 15);
      c.fillStyle = WOOD;
      c.fillRect(1, 12, 30, 3);
      c.fillStyle = WOOD_DARK;
      c.fillRect(2, 26, 2.4, 4);
      c.fillRect(27.6, 26, 2.4, 4);
      c.fillStyle = cloth;
      c.beginPath();
      c.roundRect(1.5, 8, 29, 13, 4);
      c.fill();
      c.fillStyle = rgba('#ffffff', 0.18);
      c.fillRect(3, 9, 26, 2);
      c.fillStyle = rgba(accent(2), 0.9);
      c.fillRect(1.5, 17, 29, 1.4);
      ellipse(c, 6, 11, 5, 3.4, shade(accent(1), 0.1));
      ellipse(c, 5, 10, 2.4, 1.4, rgba('#ffffff', 0.2));
      return true;
    }
    case 'milestone': {
      // A cylindrical milestone on a square base, cut with lines of letters.
      const stone = '#cfc3a6';
      c.fillStyle = shade(stone, -0.18);
      c.fillRect(8, 25, 16, 5);
      const g = c.createLinearGradient(10, 0, 22, 0);
      g.addColorStop(0, shade(stone, 0.18));
      g.addColorStop(1, shade(stone, -0.3));
      c.fillStyle = g;
      c.fillRect(10.5, 1, 11, 25);
      ellipse(c, 16, 1, 5.5, 2, shade(stone, 0.2));
      c.strokeStyle = rgba('#4a3c28', 0.7);
      c.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(12.5, 6 + i * 3.4);
        c.lineTo(19.5 - (i % 2) * 2, 6 + i * 3.4);
        c.stroke();
      }
      ellipse(c, 13, 22, 2, 1.4, rgba('#7a8a4c', 0.6));
      return true;
    }
    case 'lampstand': {
      // A tall bronze lampstand on three feet, with a lit clay lamp on top.
      const bronze = '#8a6a3a';
      c.strokeStyle = shade(bronze, -0.2);
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(16, 26);
      c.lineTo(10, 30);
      c.moveTo(16, 26);
      c.lineTo(22, 30);
      c.moveTo(16, 26);
      c.lineTo(16, 30);
      c.stroke();
      const g = c.createLinearGradient(15, 0, 17.5, 0);
      g.addColorStop(0, shade(bronze, 0.35));
      g.addColorStop(1, shade(bronze, -0.3));
      c.fillStyle = g;
      c.fillRect(15, -10, 2.4, 36);
      ellipse(c, 16.2, 6, 2, 1, shade(bronze, 0.2));
      ellipse(c, 16.2, -10.5, 5, 1.6, shade(bronze, 0.1));
      ellipse(c, 16.2, -12, 4.2, 2, CLAY);
      ellipse(c, 20.2, -12.5, 1.4, 2.2, '#f7c653');
      ellipse(c, 20.2, -13.3, 0.7, 1.2, '#fff1b8');
      return true;
    }
    case 'fountain': {
      // A public fountain: a stone basin fed by a spout set in a back slab.
      const stone = shade(look.building.face, -0.04);
      c.fillStyle = shade(stone, -0.1);
      c.fillRect(6, -6, 20, 14);
      c.fillStyle = rgba('#ffffff', 0.3);
      c.fillRect(6, -6, 20, 1.2);
      ellipse(c, 16, 1, 3.4, 3, shade(stone, -0.3));
      c.fillStyle = stone;
      c.fillRect(1, 9, 30, 19);
      c.fillStyle = shade(stone, 0.15);
      c.fillRect(1, 9, 30, 2.4);
      c.fillStyle = shade(stone, -0.28);
      c.fillRect(1, 25.5, 30, 2.5);
      const w = c.createLinearGradient(0, 12, 0, 25);
      w.addColorStop(0, '#5f9fae');
      w.addColorStop(1, '#2f6f86');
      c.fillStyle = w;
      c.fillRect(3.5, 12.5, 25, 12);
      // The falling stream and its ripples.
      c.fillStyle = rgba('#d8f0f2', 0.8);
      c.fillRect(15.2, 2, 1.6, 12);
      c.strokeStyle = rgba('#d8f0f2', 0.7);
      c.lineWidth = 0.7;
      c.beginPath();
      c.ellipse(16, 15, 4, 1.4, 0, 0, Math.PI * 2);
      c.ellipse(16, 15, 7, 2.4, 0, 0.3, Math.PI - 0.3);
      c.stroke();
      return true;
    }
    case 'mast':
      paintMastFoot(c, seed);
      return true;
    case 'nets': {
      // Nets hung to dry between two poles: cork floats along the head rope,
      // stone sinkers along the foot, and a mended patch.
      c.fillStyle = WOOD_DARK;
      c.fillRect(1.5, -6, 2.4, 34);
      c.fillRect(28.1, -6, 2.4, 34);
      const top = (x: number): number => -3 + Math.sin((x / 32) * Math.PI) * 3;
      c.save();
      c.fillStyle = rgba('#d8ccad', 0.35);
      c.beginPath();
      c.moveTo(3, top(3));
      for (let x = 3; x <= 29; x += 2) c.lineTo(x, top(x));
      c.lineTo(29, 22);
      c.quadraticCurveTo(16, 26, 3, 22);
      c.closePath();
      c.fill();
      // The mesh, kept inside the hanging net.
      c.clip();
      c.strokeStyle = rgba('#e6dcc0', 0.85);
      c.lineWidth = 0.45;
      for (let i = -8; i < 14; i++) {
        c.beginPath();
        c.moveTo(3 + i * 3, top(3));
        c.lineTo(3 + i * 3 + 22, 22);
        c.moveTo(3 + i * 3 + 22, top(3));
        c.lineTo(3 + i * 3, 22);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = ROPE_COLOR;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(2, top(2));
      for (let x = 2; x <= 30; x += 2) c.lineTo(x, top(x));
      c.stroke();
      for (let x = 5; x < 29; x += 4.5) ellipse(c, x, top(x) + 0.8, 1.6, 1.1, '#b07a3a');
      for (let x = 6; x < 28; x += 5) ellipse(c, x, 22.5 + Math.sin(x) * 0.8, 1.3, 1.2, '#5a554c');
      if (r() < 0.6) {
        c.fillStyle = rgba(accent(1), 0.55);
        c.fillRect(11 + r() * 8, 6 + r() * 6, 5, 4);
      }
      return true;
    }
    case 'rack': {
      // A drying rack: two trestles and poles hung with split fish.
      c.fillStyle = WOOD_DARK;
      for (const x of [2, 28]) {
        c.beginPath();
        c.moveTo(x - 1.5, 28);
        c.lineTo(x + 0.5, 0);
        c.lineTo(x + 2.5, 28);
        c.lineTo(x + 1.2, 28);
        c.lineTo(x + 0.5, 6);
        c.lineTo(x - 0.2, 28);
        c.closePath();
        c.fill();
      }
      for (const y of [2, 13]) {
        c.fillStyle = WOOD;
        c.fillRect(0, y, 32, 2);
        for (let i = 0; i < 6; i++) {
          const fx = 3 + i * 4.8 + r() * 0.8;
          const len = 7 + r() * 2;
          const fish = mix('#c9b89a', '#8f8a7e', r());
          ellipse(c, fx, y + 2 + len / 2, 1.9, len / 2, fish);
          ellipse(c, fx - 0.5, y + 2 + len / 2 - 1, 0.7, len / 2 - 1.5, rgba('#ffffff', 0.35));
          c.fillStyle = shade(fish, -0.35);
          c.beginPath();
          c.moveTo(fx - 1.6, y + 2 + len);
          c.lineTo(fx + 1.6, y + 2 + len);
          c.lineTo(fx, y + len - 0.5);
          c.closePath();
          c.fill();
        }
      }
      ellipse(c, 16, 28, 12, 1.6, rgba('#8a7a5a', 0.4));
      return true;
    }
    default:
      return false;
  }
}

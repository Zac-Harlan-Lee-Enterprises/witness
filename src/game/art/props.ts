import {
  ellipse,
  makeCanvas,
  MATERIAL as PALETTE,
  rgba,
  shade,
  softShadow,
  type Ctx,
} from './paint';

/**
 * Original prop sprites for placed entities (signs, clues, vessels…),
 * painted at ART_SCALE. Unknown sprite names fall back to a neutral marker
 * and are reported, so a typo in content never produces an invisible,
 * un-findable object.
 */
export const PROP_SIZE = 32;

type Painter = (ctx: Ctx) => void;

const wood = (ctx: Ctx, x: number, y: number, w: number, h: number): void => {
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba('#ffffff', 0.15);
  ctx.fillRect(x, y, w, 0.8);
  ctx.strokeStyle = rgba(PALETTE.woodDark, 0.6);
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 1, y + (h * i) / 3);
    ctx.lineTo(x + w - 1, y + (h * i) / 3 + 0.4);
    ctx.stroke();
  }
};

const PAINTERS: Record<string, Painter> = {
  sign: (ctx) => {
    softShadow(ctx, 18, 29, 7, 2.5, 0.35);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(14.5, 12, 3, 17);
    wood(ctx, 4, 4, 24, 12);
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 0.9;
    ctx.strokeRect(4, 4, 24, 12);
    ctx.fillStyle = rgba('#3a2412', 0.8);
    for (let i = 0; i < 3; i++) ctx.fillRect(8, 7.5 + i * 2.8, 16 - i * 4, 1);
  },
  stone: (ctx) => {
    softShadow(ctx, 18, 29, 9, 3, 0.35);
    const g = ctx.createLinearGradient(9, 0, 23, 0);
    g.addColorStop(0, shade(PALETTE.rock, 0.2));
    g.addColorStop(1, shade(PALETTE.rock, -0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(10, 29);
    ctx.lineTo(10, 9);
    ctx.quadraticCurveTo(16, 4, 22, 9);
    ctx.lineTo(22, 29);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('#5d4c36', 0.5);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(12, 13 + i * 5);
      ctx.lineTo(19, 13.5 + i * 5);
      ctx.stroke();
    }
  },
  pack: (ctx) => {
    softShadow(ctx, 16, 27, 11, 3.5, 0.35);
    ctx.fillStyle = '#8a6a3e';
    ctx.beginPath();
    ctx.roundRect(6, 10, 20, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#a07e4b';
    ctx.beginPath();
    ctx.roundRect(6, 10, 20, 7, [5, 5, 1, 1]);
    ctx.fill();
    ctx.fillStyle = '#5a3f22';
    ctx.fillRect(15, 14, 2, 6);
    ellipse(ctx, 16, 20.5, 1.4, 1.4, '#d9b460');
    ctx.strokeStyle = '#5a3f22';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(16, 11, 7, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  },
  vessels: (ctx) => {
    softShadow(ctx, 16, 28, 14, 3.5, 0.35);
    const jar = (x: number, y: number, rx: number, ry: number, col: string): void => {
      ellipse(ctx, x, y, rx, ry, col);
      ellipse(ctx, x - rx * 0.35, y - ry * 0.3, rx * 0.3, ry * 0.45, rgba('#ffffff', 0.25));
      ellipse(ctx, x, y - ry, rx * 0.45, ry * 0.18, shade(col, -0.3));
      ctx.strokeStyle = rgba('#5c3a1f', 0.7);
      ctx.lineWidth = 0.6;
      // painted measure marks
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + rx * 0.55, y - ry + (ry * 2 * i) / 4);
        ctx.lineTo(x + rx * 0.85, y - ry + (ry * 2 * i) / 4);
        ctx.stroke();
      }
    };
    jar(11, 18, 8, 10, PALETTE.clay);
    jar(24, 21, 5, 7, '#c9905e');
  },
  'broken-jar': (ctx) => {
    ellipse(ctx, 16, 22, 12, 5, 'rgba(140,110,40,0.35)');
    ellipse(ctx, 16, 22, 8, 3, 'rgba(120,95,30,0.25)');
    ctx.fillStyle = PALETTE.clay;
    for (const [x, y, s] of [
      [8, 20, 1],
      [19, 22, 0.9],
      [13, 25, 0.6],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5 * s, y - 6 * s);
      ctx.lineTo(x + 8 * s, y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.clayDark;
    }
  },
  cloth: (ctx) => {
    ctx.strokeStyle = '#5c5a30';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(6, 28);
    ctx.lineTo(14, 9);
    ctx.lineTo(25, 26);
    ctx.moveTo(14, 9);
    ctx.lineTo(9, 16);
    ctx.stroke();
    ctx.fillStyle = '#6f5a3a';
    ctx.beginPath();
    ctx.moveTo(12, 11);
    ctx.lineTo(21, 13);
    ctx.lineTo(18, 22);
    ctx.lineTo(13, 19);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f6f8f';
    ctx.fillRect(15, 12, 2, 9);
  },
  prints: (ctx) => {
    const print = (x: number, y: number, a: number): void =>
      ellipse(ctx, x, y, 1.9, 3, 'rgba(95,68,40,0.45)', a);
    for (let i = 0; i < 4; i++) {
      print(9 + (i % 2) * 6, 27 - i * 6, -0.2);
      print(20 + (i % 2) * 5, 25 - i * 6, 0.2);
    }
  },
  drag: (ctx) => {
    ctx.strokeStyle = 'rgba(95,68,40,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 26);
    ctx.bezierCurveTo(12, 20, 18, 22, 28, 12);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(4, 30);
    ctx.bezierCurveTo(12, 24, 18, 26, 28, 16);
    ctx.stroke();
  },
  purse: (ctx) => {
    softShadow(ctx, 16, 26, 7, 2.5, 0.35);
    ellipse(ctx, 16, 21, 7, 6, '#7a5a3a');
    ellipse(ctx, 14, 19, 2.5, 2, rgba('#ffffff', 0.15));
    ctx.strokeStyle = '#4a3522';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(12, 15);
    ctx.lineTo(8, 10);
    ctx.moveTo(20, 15);
    ctx.lineTo(23, 11);
    ctx.stroke();
  },
  basket: (ctx) => {
    softShadow(ctx, 16, 27, 12, 3.5, 0.35);
    ellipse(ctx, 16, 20, 11, 8, '#c49a5a');
    ctx.strokeStyle = rgba('#8a6a3e', 0.8);
    ctx.lineWidth = 0.7;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(16, 20 + i * 2.5, 10.5 - Math.abs(i), 1.2, 0, 0, Math.PI);
      ctx.stroke();
    }
    ellipse(ctx, 16, 15, 9, 4, '#8a6a3e');
    for (const [x, col] of [
      [12, '#6b3f6b'],
      [16, '#8a4f2f'],
      [20, '#7a8a4c'],
    ] as const)
      ellipse(ctx, x, 14.5, 2.6, 2.6, col);
  },
  lamp: (ctx) => {
    softShadow(ctx, 16, 25, 8, 2.5, 0.35);
    ellipse(ctx, 16, 22, 8, 4, PALETTE.clay);
    ellipse(ctx, 14, 21, 3, 1.2, rgba('#ffffff', 0.25));
    ellipse(ctx, 23.5, 20.5, 2, 3, '#f7c653');
    ellipse(ctx, 23.5, 19.5, 1, 1.6, '#fff1b8');
  },
  donkey: (ctx) => {
    softShadow(ctx, 16, 28, 14, 3.5, 0.35);
    ctx.fillStyle = '#7d6a58';
    for (const x of [8, 11, 19, 22]) ctx.fillRect(x, 20, 2.4, 8);
    ellipse(ctx, 15, 17, 10, 6.5, '#8b7765');
    ellipse(ctx, 13, 15, 6, 2.5, rgba('#ffffff', 0.12));
    ellipse(ctx, 26, 11, 3.8, 5, '#8b7765');
    ellipse(ctx, 27.5, 14.5, 2.2, 2, '#c9b8a6');
    ctx.fillStyle = '#6f5f50';
    ctx.fillRect(24, 2, 2, 6);
    ctx.fillRect(27.5, 2, 2, 6);
    ellipse(ctx, 27, 9.5, 0.7, 0.7, '#1c140e');
    ctx.fillStyle = '#b4452f';
    ctx.fillRect(10, 10.5, 10, 4);
    ctx.fillStyle = '#e0b453';
    ctx.fillRect(10, 14, 10, 1);
  },
  'pack-donkey': (ctx) => {
    PAINTERS.donkey?.(ctx);
    // Panniers and a bundle on a pack saddle.
    ellipse(ctx, 10.5, 17, 4, 5, '#b08c56');
    ellipse(ctx, 19.5, 17, 4, 5, '#a8844e');
    ctx.strokeStyle = rgba('#6e5230', 0.8);
    ctx.lineWidth = 0.5;
    for (const x of [10.5, 19.5])
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(x, 17 + i * 1.8, 3.6 - Math.abs(i) * 0.5, 0.8, 0, 0, Math.PI);
        ctx.stroke();
      }
    ellipse(ctx, 15, 10.5, 5.5, 3, '#9c8660');
    ellipse(ctx, 14, 9.6, 3, 1.2, rgba('#ffffff', 0.15));
  },
  waterskin: (ctx) => {
    softShadow(ctx, 16, 25, 8, 2.5, 0.35);
    ctx.fillStyle = '#5b3b24';
    ctx.beginPath();
    ctx.moveTo(14, 13);
    ctx.quadraticCurveTo(8, 18, 10, 24);
    ctx.quadraticCurveTo(16, 27, 22, 24);
    ctx.quadraticCurveTo(24, 18, 18, 13);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 16, 12.5, 2, 1.2, '#3a2616');
    ellipse(ctx, 13, 19, 1.6, 3, rgba('#e6c9a0', 0.18));
  },
  'bread-cloth': (ctx) => {
    softShadow(ctx, 16, 24, 10, 2.5, 0.3);
    ctx.fillStyle = '#e6dcc6';
    ctx.beginPath();
    ctx.moveTo(6, 22);
    ctx.lineTo(16, 16);
    ctx.lineTo(27, 21);
    ctx.lineTo(17, 26);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 15, 20, 4.5, 2.4, '#b9854a');
    ellipse(ctx, 14, 19.4, 2.2, 1, rgba('#ffffff', 0.2));
    for (const [x, y] of [
      [20, 21],
      [21.5, 22.5],
      [19, 23],
    ] as const)
      ellipse(ctx, x, y, 1.2, 0.8, '#4a2616');
  },
  broom: (ctx) => {
    softShadow(ctx, 18, 27, 6, 2, 0.3);
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(12, 3);
    ctx.lineTo(18, 21);
    ctx.stroke();
    ctx.fillStyle = '#c2a86a';
    ctx.beginPath();
    ctx.moveTo(16, 20);
    ctx.lineTo(21, 19);
    ctx.lineTo(24, 27);
    ctx.lineTo(15, 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('#8a6e3c', 0.8);
    ctx.lineWidth = 0.4;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(17 + i, 20);
      ctx.lineTo(16 + i * 1.8, 27.5);
      ctx.stroke();
    }
  },
  bedroll: (ctx) => {
    softShadow(ctx, 16, 23, 13, 3, 0.3);
    ellipse(ctx, 16, 20, 13, 6, '#9c7b54');
    ellipse(ctx, 16, 18, 11, 4, '#c9a878');
    ctx.strokeStyle = rgba('#7a5c38', 0.7);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(6 + i * 6, 16);
      ctx.lineTo(7 + i * 6, 22);
      ctx.stroke();
    }
  },
  clouds: (ctx) => {
    ellipse(ctx, 11, 13, 8, 5, '#6d7280');
    ellipse(ctx, 20, 11, 9, 6, '#7c8190');
    ellipse(ctx, 16, 16, 11, 4, '#5f6470');
    ellipse(ctx, 18, 9, 5, 3, rgba('#ffffff', 0.15));
    ctx.strokeStyle = '#8fa6b8';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(8 + i * 4, 21);
      ctx.lineTo(6 + i * 4, 28);
      ctx.stroke();
    }
  },
  'mud-line': (ctx) => {
    ctx.strokeStyle = '#6f4f30';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(2, 18);
    ctx.bezierCurveTo(10, 14, 22, 22, 30, 16);
    ctx.stroke();
    ellipse(ctx, 10, 22, 3, 1.5, '#7f8f4f');
    ellipse(ctx, 22, 21, 4, 1.5, PALETTE.woodDark);
    ellipse(ctx, 16, 24, 2, 1, '#9f8762');
  },
  scroll: (ctx) => {
    softShadow(ctx, 16, 25, 9, 2.5, 0.3);
    ctx.fillStyle = '#efe0bd';
    ctx.fillRect(7, 12, 18, 11);
    ellipse(ctx, 7, 17.5, 3, 5.5, PALETTE.wood);
    ellipse(ctx, 25, 17.5, 3, 5.5, PALETTE.wood);
  },
  marker: (ctx) => {
    ellipse(ctx, 16, 16, 7, 7, '#f2b441');
  },
  /** Invisible: for interactive spots on tiles that already draw themselves (wells, cairns). */
  none: () => undefined,
};

export function paintProp(
  name: string,
  doc: Document = document,
): { canvas: HTMLCanvasElement; known: boolean } {
  const { canvas, ctx } = makeCanvas(PROP_SIZE, PROP_SIZE, doc);
  const painter = PAINTERS[name];
  if (ctx) (painter ?? PAINTERS.marker)?.(ctx);
  return { canvas, known: painter !== undefined };
}

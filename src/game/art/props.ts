import { PALETTE } from './tiles';

/**
 * Small original prop sprites for placed entities (signs, clues, vessels…).
 * Unknown sprite names fall back to a neutral marker and are reported, so a
 * typo in content never produces an invisible, un-findable object.
 */
export const PROP_SIZE = 32;

type Painter = (ctx: CanvasRenderingContext2D) => void;

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

const shadow = (ctx: CanvasRenderingContext2D, w = 10): void =>
  ellipse(ctx, 16, 28, w, 3, 'rgba(60,40,20,0.25)');

const PAINTERS: Record<string, Painter> = {
  sign: (ctx) => {
    shadow(ctx, 7);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(14, 12, 4, 17);
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(5, 5, 22, 11);
    ctx.fillStyle = PALETTE.woodDark;
    for (let i = 0; i < 3; i++) ctx.fillRect(8, 8 + i * 3, 16 - i * 3, 1);
  },
  stone: (ctx) => {
    shadow(ctx, 8);
    ctx.fillStyle = PALETTE.rock;
    ctx.fillRect(10, 6, 12, 22);
    ctx.fillStyle = PALETTE.rockShade;
    ctx.fillRect(18, 6, 4, 22);
    ctx.fillStyle = PALETTE.rockLight;
    for (let i = 0; i < 3; i++) ctx.fillRect(12, 10 + i * 5, 5, 1.5);
  },
  pack: (ctx) => {
    shadow(ctx, 11);
    ctx.fillStyle = '#8a6a3e';
    ctx.beginPath();
    ctx.roundRect(7, 10, 18, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#6a4e2c';
    ctx.fillRect(7, 14, 18, 3);
    ctx.strokeStyle = '#5a3f22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 11, 6, Math.PI, 0);
    ctx.stroke();
  },
  vessels: (ctx) => {
    shadow(ctx, 13);
    ellipse(ctx, 11, 18, 8, 10, PALETTE.clay);
    ellipse(ctx, 11, 9, 4, 2, PALETTE.clayDark);
    ellipse(ctx, 24, 21, 5, 7, '#c9905e');
    ellipse(ctx, 24, 15, 2.5, 1.5, PALETTE.clayDark);
  },
  'broken-jar': (ctx) => {
    ellipse(ctx, 16, 22, 12, 5, 'rgba(120,90,30,0.35)');
    ctx.fillStyle = PALETTE.clay;
    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(13, 14);
    ctx.lineTo(15, 21);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, 22);
    ctx.lineTo(24, 16);
    ctx.lineTo(26, 23);
    ctx.fill();
    ctx.fillStyle = PALETTE.clayDark;
    ctx.fillRect(14, 24, 5, 3);
  },
  cloth: (ctx) => {
    ctx.strokeStyle = PALETTE.bush;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 28);
    ctx.lineTo(14, 10);
    ctx.lineTo(24, 26);
    ctx.stroke();
    ctx.fillStyle = '#3f6f8f';
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.lineTo(20, 14);
    ctx.lineTo(17, 22);
    ctx.lineTo(13, 19);
    ctx.fill();
  },
  prints: (ctx) => {
    ctx.fillStyle = 'rgba(90,65,40,0.45)';
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, 9 + (i % 2) * 7, 27 - i * 6, 2.2, 3.2, 'rgba(90,65,40,0.45)');
      ellipse(ctx, 20 + (i % 2) * 5, 25 - i * 6, 2.2, 3.2, 'rgba(90,65,40,0.35)');
    }
  },
  drag: (ctx) => {
    ctx.strokeStyle = 'rgba(90,65,40,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 26);
    ctx.bezierCurveTo(12, 20, 18, 22, 28, 12);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 30);
    ctx.bezierCurveTo(12, 24, 18, 26, 28, 16);
    ctx.stroke();
  },
  purse: (ctx) => {
    shadow(ctx, 6);
    ellipse(ctx, 16, 21, 7, 6, '#7a5a3a');
    ctx.strokeStyle = '#4a3522';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, 15);
    ctx.lineTo(8, 10);
    ctx.moveTo(20, 15);
    ctx.lineTo(23, 11);
    ctx.stroke();
  },
  basket: (ctx) => {
    shadow(ctx, 10);
    ellipse(ctx, 16, 20, 11, 8, '#c49a5a');
    ellipse(ctx, 16, 16, 9, 4, '#8a6a3e');
    ellipse(ctx, 13, 15, 2.5, 2.5, '#6b3f6b');
    ellipse(ctx, 18, 15, 2.5, 2.5, '#8a4f2f');
  },
  lamp: (ctx) => {
    shadow(ctx, 6);
    ellipse(ctx, 16, 22, 8, 4, PALETTE.clay);
    ellipse(ctx, 23, 20, 2, 3, '#f2b441');
  },
  donkey: (ctx) => {
    shadow(ctx, 13);
    ellipse(ctx, 15, 17, 10, 6, '#8b7765');
    ellipse(ctx, 26, 12, 4, 5, '#8b7765');
    ctx.fillStyle = '#6f5f50';
    ctx.fillRect(24, 3, 2, 6);
    ctx.fillRect(28, 3, 2, 6);
    ctx.fillRect(8, 21, 3, 7);
    ctx.fillRect(19, 21, 3, 7);
    ctx.fillStyle = '#b4452f';
    ctx.fillRect(10, 11, 10, 4);
  },
  bedroll: (ctx) => {
    ellipse(ctx, 16, 20, 13, 6, '#9c7b54');
    ellipse(ctx, 16, 18, 11, 4, '#c9a878');
  },
  clouds: (ctx) => {
    ellipse(ctx, 12, 14, 8, 5, '#6d7280');
    ellipse(ctx, 20, 12, 9, 6, '#7c8190');
    ellipse(ctx, 16, 17, 10, 4, '#5f6470');
    ctx.strokeStyle = '#8fa6b8';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(9 + i * 5, 22);
      ctx.lineTo(7 + i * 5, 28);
      ctx.stroke();
    }
  },
  'mud-line': (ctx) => {
    ctx.strokeStyle = '#6f4f30';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, 18);
    ctx.bezierCurveTo(10, 14, 22, 22, 30, 16);
    ctx.stroke();
    ellipse(ctx, 10, 22, 3, 1.5, '#7f8f4f');
    ellipse(ctx, 22, 21, 4, 1.5, PALETTE.woodDark);
  },
  scroll: (ctx) => {
    shadow(ctx, 8);
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
  const canvas = doc.createElement('canvas');
  canvas.width = PROP_SIZE;
  canvas.height = PROP_SIZE;
  const ctx = canvas.getContext('2d');
  const painter = PAINTERS[name];
  if (ctx) (painter ?? PAINTERS.marker)?.(ctx);
  return { canvas, known: painter !== undefined };
}

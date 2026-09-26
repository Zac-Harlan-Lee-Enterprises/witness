import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import type { LookMark } from '@/domain/world';
import { ART_SCALE, makeCanvas, softShadow, type Ctx } from '../paint';
import { dressFor, type Dress } from './dress';
import { paintStanding } from './figure';
import { paintLying, paintSitting, POSE_FRAMES } from './poses';
import { FRAMES_PER_DIRECTION, frameSpec, rigFor } from './rig';

/**
 * Sprite sheets for people. A standing sheet is 4 directions × 13 frames
 * (idle, breath, blink, two talking frames and an 8-frame walk); a pose
 * sheet (sitting or lying) is 4 × 3 (rest, breath, talk). Every frame gets a
 * contact shadow and a faint shadow-side rim instead of an ink outline.
 */
export const DIRECTION_ROWS: Direction[] = ['down', 'left', 'right', 'up'];
export const CHAR_W = 40;
export const CHAR_H = 64;
/** Feet rest this far above the bottom of a frame. */
export const FOOT_MARGIN = 4;
export const POSE_W = 64;
export const POSE_H = 48;
export const POSE_GROUND = 6;
export { FRAMES_PER_DIRECTION, POSE_FRAMES };
export type RestPose = 'sit' | 'lie';

export function frameName(direction: Direction, frame: number): string {
  return `${direction}-${frame}`;
}

/** Texture key: everything that changes how the person is painted. */
export function figureKey(a: Appearance, marks: readonly LookMark[], rag: string): string {
  const parts = [
    a.skin,
    a.hair,
    a.robe,
    a.accent,
    a.headwear,
    a.headwearColor,
    a.beard ? 1 : 0,
    a.build,
    a.carry,
    [...marks].sort().join('+'),
    marks.includes('rag-bandaged') ? rag : '',
  ];
  return `fig1-${parts.join('-').replace(/#/g, '')}`;
}

export function poseKey(
  a: Appearance,
  pose: RestPose,
  marks: readonly LookMark[],
  rag: string,
): string {
  return `${figureKey(a, marks, rag)}-${pose}`;
}

interface Scratch {
  fig: HTMLCanvasElement;
  figCtx: Ctx;
  sil: HTMLCanvasElement;
  silCtx: Ctx;
}

function scratch(w: number, h: number, doc: Document): Scratch | null {
  const fig = makeCanvas(w, h, doc);
  const sil = makeCanvas(w, h, doc);
  if (!fig.ctx || !sil.ctx) return null;
  return { fig: fig.canvas, figCtx: fig.ctx, sil: sil.canvas, silCtx: sil.ctx };
}

/** Paint one frame into (ox, oy) of the sheet: shadow, rim, then the figure. */
function stamp(
  ctx: Ctx,
  s: Scratch,
  cell: { x: number; y: number; w: number; h: number },
  shadow: { x: number; y: number; rx: number; ry: number },
  paint: (c: Ctx) => void,
): void {
  const { figCtx, silCtx } = s;
  figCtx.setTransform(1, 0, 0, 1, 0, 0);
  figCtx.clearRect(0, 0, s.fig.width, s.fig.height);
  figCtx.setTransform(ART_SCALE, 0, 0, ART_SCALE, 0, 0);
  paint(figCtx);
  silCtx.setTransform(1, 0, 0, 1, 0, 0);
  silCtx.globalCompositeOperation = 'source-over';
  silCtx.clearRect(0, 0, s.sil.width, s.sil.height);
  silCtx.drawImage(s.fig, 0, 0);
  silCtx.globalCompositeOperation = 'source-in';
  silCtx.fillStyle = 'rgba(28,16,8,0.55)';
  silCtx.fillRect(0, 0, s.sil.width, s.sil.height);
  silCtx.globalCompositeOperation = 'source-over';

  const { x, y, w, h } = cell;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  softShadow(ctx, x + shadow.x, y + shadow.y, shadow.rx, shadow.ry, 0.5);
  // A faint rim on the shadow side keeps people readable on busy ground.
  ctx.drawImage(s.sil, x + 0.45, y + 0.4, w, h);
  ctx.drawImage(s.fig, x, y, w, h);
  ctx.restore();
}

export function paintFigureSheet(
  appearance: Appearance,
  marks: readonly LookMark[] = [],
  rag = '#8a6a4a',
  doc: Document = document,
): HTMLCanvasElement {
  const dress = dressFor(appearance, marks, rag);
  const sheet = makeCanvas(CHAR_W * FRAMES_PER_DIRECTION, CHAR_H * DIRECTION_ROWS.length, doc);
  const ctx = sheet.ctx;
  const s = scratch(CHAR_W, CHAR_H, doc);
  if (!ctx || !s) return sheet.canvas;
  const width = dress.build === 'child' ? 6.2 : 7.4;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIRECTION; f++) {
      const rig = rigFor(dress.build, dir, frameSpec(f));
      stamp(
        ctx,
        s,
        { x: f * CHAR_W, y: row * CHAR_H, w: CHAR_W, h: CHAR_H },
        { x: CHAR_W / 2 + 0.6, y: CHAR_H - FOOT_MARGIN + 0.4, rx: width, ry: 2.4 },
        (c) => {
          c.translate(CHAR_W / 2, CHAR_H - FOOT_MARGIN);
          paintStanding(c, dress, rig);
        },
      );
    }
  });
  return sheet.canvas;
}

export function paintPoseSheet(
  appearance: Appearance,
  pose: RestPose,
  marks: readonly LookMark[] = [],
  rag = '#8a6a4a',
  doc: Document = document,
): HTMLCanvasElement {
  const dress: Dress = dressFor(appearance, marks, rag);
  const sheet = makeCanvas(POSE_W * POSE_FRAMES, POSE_H * DIRECTION_ROWS.length, doc);
  const ctx = sheet.ctx;
  const s = scratch(POSE_W, POSE_H, doc);
  if (!ctx || !s) return sheet.canvas;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < POSE_FRAMES; f++) {
      stamp(
        ctx,
        s,
        { x: f * POSE_W, y: row * POSE_H, w: POSE_W, h: POSE_H },
        pose === 'lie'
          ? { x: POSE_W / 2, y: POSE_H - POSE_GROUND - 2, rx: 25, ry: 5 }
          : { x: POSE_W / 2, y: POSE_H - POSE_GROUND, rx: 12, ry: 4 },
        (c) => {
          c.translate(POSE_W / 2, POSE_H - POSE_GROUND);
          if (pose === 'sit') paintSitting(c, dress, dir, f);
          else paintLying(c, dress, dir, f);
        },
      );
    }
  });
  return sheet.canvas;
}

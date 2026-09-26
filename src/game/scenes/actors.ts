import type Phaser from 'phaser';
import type { WorldConversation, WorldEntityView } from '@/application/ports';
import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import type { LookMark } from '@/domain/world';
import { ART_SCALE, hash, rng } from '../art/paint';
import { FRAME } from '../art/people/rig';
import {
  CHAR_H,
  CHAR_W,
  DIRECTION_ROWS,
  figureKey,
  FOOT_MARGIN,
  frameName,
  FRAMES_PER_DIRECTION,
  paintFigureSheet,
  paintPoseSheet,
  POSE_FRAMES,
  POSE_GROUND,
  POSE_H,
  POSE_W,
  poseKey,
  type RestPose,
} from '../art/people/sheet';
import { shadeTint, turnPath } from '../prerendered/select';
import { BLINK_MS, faceToward, mouthOpen, nextBlinkDelay, noticesPlayer } from '../systems/life';

/**
 * The people in a scene: their sprites, their cast shadows and the small
 * behaviours that make them feel present — they breathe, blink at their own
 * pace, turn toward you when you come close, and gesture as they speak.
 */
const INV = 1 / ART_SCALE;
const TILE = 32;
/** Where a standing person's feet are, below the centre of their tile. */
export const FEET_BELOW_CENTRE = 10;
/** Where someone sitting or lying rests, below the centre of their tile. */
export const SEAT_BELOW_CENTRE = 9;

export interface Mover {
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
}

/** How a person's cast shadow falls: tip offset for a figure of `height` units. */
export interface ShadowCast {
  dx: number;
  dy: number;
  height: number;
  alpha: number;
  color: number;
}

interface Npc {
  view: WorldEntityView;
  lookKey: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite | null;
  pose: 'stand' | RestPose;
  home: Direction;
  facing: Direction;
  noticedAt: number;
  nextBlink: number;
  blinkUntil: number;
  breathEvery: number;
  seed: number;
  /** Pre-rendered sheet, when there is one (turn frames, shade tint). */
  rendered: RenderedFigure | null;
  turn: { frames: string[]; next: number };
  light: number;
}

/**
 * A person drawn from a pre-rendered sheet (tools/art): frames named
 * "<direction>-<column>" and "turn-<diagonal>", with a matching shadow sheet
 * rendered from the same sun.
 */
export interface RenderedFigure {
  key: string;
  shadowKey: string;
  ppu: number;
  originX: number;
  originY: number;
  frameWidth: number;
  frameHeight: number;
  turns: readonly string[];
  shadow: {
    ppu: number;
    originX: number;
    originY: number;
    frameWidth: number;
    frameHeight: number;
  };
}

/** Strength of a rendered person's own shadow in full sun (it fades out in shade). */
export const RENDERED_SHADOW_ALPHA = 0.9;

/** How long each in-between pose shows while someone turns. */
export const TURN_STEP_MS = 70;

/** A rendered person and its baked cast shadow. */
export function addRenderedFigure(
  scene: Phaser.Scene,
  fig: RenderedFigure,
  frame: string,
  shadowDepth: number,
): { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Sprite } {
  const sprite = scene.add
    .sprite(0, 0, fig.key, frame)
    .setOrigin(fig.originX / fig.frameWidth, fig.originY / fig.frameHeight)
    .setScale(1 / fig.ppu);
  // Shadow sheets are opaque tints on white, multiplied onto the ground.
  const shadow = scene.add
    .sprite(0, 0, fig.shadowKey, frame)
    .setOrigin(
      fig.shadow.originX / fig.shadow.frameWidth,
      fig.shadow.originY / fig.shadow.frameHeight,
    )
    .setScale(1 / fig.shadow.ppu)
    .setBlendMode('MULTIPLY')
    .setAlpha(RENDERED_SHADOW_ALPHA)
    .setDepth(shadowDepth);
  return { sprite, shadow };
}

/** Frame name for a pose in a turn path (a diagonal, or a direction's standing frame). */
export function turnFrame(pose: string): string {
  return pose.includes('-') ? `turn-${pose}` : `${pose}-0`;
}

export function ensureFigureTexture(
  scene: Phaser.Scene,
  appearance: Appearance,
  marks: readonly LookMark[] = [],
  rag = '#8a6a4a',
): string {
  const key = figureKey(appearance, marks, rag);
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.addCanvas(key, paintFigureSheet(appearance, marks, rag));
  if (!tex) return key;
  const fw = CHAR_W * ART_SCALE;
  const fh = CHAR_H * ART_SCALE;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIRECTION; f++)
      tex.add(frameName(dir, f), 0, f * fw, row * fh, fw, fh);
  });
  return key;
}

function ensurePoseTexture(
  scene: Phaser.Scene,
  appearance: Appearance,
  pose: RestPose,
  marks: readonly LookMark[],
  rag: string,
): string {
  const key = poseKey(appearance, pose, marks, rag);
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.addCanvas(key, paintPoseSheet(appearance, pose, marks, rag));
  if (!tex) return key;
  const fw = POSE_W * ART_SCALE;
  const fh = POSE_H * ART_SCALE;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < POSE_FRAMES; f++) tex.add(frameName(dir, f), 0, f * fw, row * fh, fw, fh);
  });
  return key;
}

/** Origin for a standing figure: the point between its feet. */
export const STAND_ORIGIN_Y = (CHAR_H - FOOT_MARGIN) / CHAR_H;
const POSE_ORIGIN_Y = (POSE_H - POSE_GROUND) / POSE_H;

/** Add a flattened, rotated silhouette that falls away from the sun. */
export function addCastShadow(
  scene: Phaser.Scene,
  texture: string,
  frame: string,
  cast: ShadowCast,
  originY: number,
  depth: number,
): Phaser.GameObjects.Sprite {
  const length = Math.hypot(cast.dx, cast.dy);
  const squash = Math.min(0.7, length / cast.height);
  return scene.add
    .sprite(0, 0, texture, frame)
    .setOrigin(0.5, originY)
    .setScale(INV * 0.92, -INV * squash)
    .setRotation(-Math.atan2(cast.dx, cast.dy))
    .setTintFill(cast.color)
    .setAlpha(cast.alpha)
    .setDepth(depth);
}

function lookKeyOf(view: WorldEntityView): string {
  return `${view.pose}|${[...view.marks].sort().join('+')}`;
}

export class Actors {
  private readonly npcs = new Map<string, Npc>();
  private conversation: WorldConversation | null = null;
  private talkStart = 0;
  private playerBlink = { next: 2500, until: 0 };
  private readonly r = rng(97);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depthFor: (y: number) => number,
    private readonly reducedMotion: () => boolean,
    /** Colour of the player's tunic (bandages torn from it are drawn in it). */
    private readonly rag: string,
    private readonly cast: ShadowCast | null,
    private readonly shadowDepth: number,
    /** A pre-rendered sheet for someone, if the place has one. */
    private readonly renderedFor: (view: WorldEntityView) => RenderedFigure | null = () => null,
    /** Sun visibility (0–1) on the ground at a point in game units, if known. */
    private readonly sunAt: ((x: number, y: number) => number) | null = null,
  ) {}

  add(view: WorldEntityView): Phaser.GameObjects.Sprite | null {
    if (!view.appearance) return null;
    const pose = view.pose === 'stand' ? 'stand' : view.pose;
    const frame = frameName(view.facing, 0);
    const x = (view.x + 0.5) * TILE;
    const y = (view.y + 0.5) * TILE + (pose === 'stand' ? FEET_BELOW_CENTRE : SEAT_BELOW_CENTRE);
    const rendered = pose === 'stand' ? this.renderedFor(view) : null;
    let sprite: Phaser.GameObjects.Sprite;
    let shadow: Phaser.GameObjects.Sprite | null = null;
    if (rendered) {
      ({ sprite, shadow } = addRenderedFigure(this.scene, rendered, frame, this.shadowDepth));
    } else {
      const key =
        pose === 'stand'
          ? ensureFigureTexture(this.scene, view.appearance, view.marks, this.rag)
          : ensurePoseTexture(this.scene, view.appearance, pose, view.marks, this.rag);
      const originY = pose === 'stand' ? STAND_ORIGIN_Y : POSE_ORIGIN_Y;
      sprite = this.scene.add.sprite(0, 0, key, frame).setScale(INV).setOrigin(0.5, originY);
      shadow =
        this.cast && pose === 'stand'
          ? addCastShadow(this.scene, key, frame, this.cast, originY, this.shadowDepth)
          : null;
    }
    sprite.setPosition(x, y).setDepth(this.depthFor(view.y + 0.5));
    shadow?.setPosition(x, y);
    const seed = hash(view.x, view.y, 61);
    this.npcs.set(view.id, {
      view,
      lookKey: lookKeyOf(view),
      sprite,
      shadow,
      pose,
      home: view.facing,
      facing: view.facing,
      noticedAt: -Infinity,
      nextBlink: 800 + (seed % 3000),
      blinkUntil: 0,
      breathEvery: 1500 + (seed % 700),
      seed,
      rendered,
      turn: { frames: [], next: 0 },
      light: 1,
    });
    return sprite;
  }

  has(id: string): boolean {
    return this.npcs.has(id);
  }

  /** Ids of the people currently shown. */
  ids(): string[] {
    return [...this.npcs.keys()];
  }

  sprite(id: string): Phaser.GameObjects.Sprite | null {
    return this.npcs.get(id)?.sprite ?? null;
  }

  /** Keep a person in step with the story: redraw them if how they look has changed. */
  setView(view: WorldEntityView): void {
    const npc = this.npcs.get(view.id);
    if (!npc) return;
    if (npc.lookKey !== lookKeyOf(view)) {
      this.remove(view.id);
      this.add(view);
      return;
    }
    npc.view = view;
    if (view.facing !== npc.home) {
      npc.home = view.facing;
      npc.facing = view.facing;
    }
  }

  remove(id: string): void {
    const npc = this.npcs.get(id);
    if (!npc) return;
    npc.sprite.destroy();
    npc.shadow?.destroy();
    this.npcs.delete(id);
  }

  clear(): void {
    for (const id of [...this.npcs.keys()]) this.remove(id);
    this.conversation = null;
  }

  setConversation(conversation: WorldConversation | null, now: number): void {
    if (conversation?.speaking !== this.conversation?.speaking) this.talkStart = now;
    this.conversation = conversation;
  }

  /** Turn someone to face the player right away (on arriving to talk). */
  faceNow(id: string, player: Mover): void {
    const npc = this.npcs.get(id);
    if (!npc || npc.pose === 'lie') return;
    this.turnTo(npc, faceToward({ x: npc.view.x, y: npc.view.y }, player), this.scene.time.now);
    npc.noticedAt = this.scene.time.now;
  }

  /** Change facing; rendered people pass through in-between poses. */
  private turnTo(npc: Npc, facing: Direction, now: number): void {
    if (facing === npc.facing) return;
    if (npc.rendered && npc.rendered.turns.length > 0 && !this.reducedMotion()) {
      npc.turn = { frames: turnPath(npc.facing, facing).map(turnFrame), next: now + TURN_STEP_MS };
    }
    npc.facing = facing;
  }

  update(now: number, player: Mover): void {
    const c = this.conversation;
    const still = this.reducedMotion();
    for (const npc of this.npcs.values()) {
      if (npc.pose !== 'lie') {
        const talkingTo = c?.with === npc.view.id;
        if (talkingTo || noticesPlayer(npc.view, player)) {
          this.turnTo(npc, faceToward({ x: npc.view.x, y: npc.view.y }, player), now);
          npc.noticedAt = now;
        } else if (now - npc.noticedAt > 1500) {
          this.turnTo(npc, npc.home, now);
        }
      }
      if (now >= npc.nextBlink) {
        npc.blinkUntil = now + BLINK_MS;
        npc.nextBlink = now + nextBlinkDelay(this.r);
      }
      const speaking = c?.speaking === npc.view.id;
      const mouth = still || mouthOpen(now - this.talkStart);
      const breathIn = !still && Math.floor((now + npc.seed) / npc.breathEvery) % 2 === 1;
      let frame: number;
      if (npc.pose === 'stand') {
        frame = speaking
          ? mouth
            ? FRAME.talk
            : FRAME.talk2
          : now < npc.blinkUntil
            ? FRAME.blink
            : breathIn
              ? FRAME.breath
              : FRAME.idle;
      } else {
        frame = speaking && mouth ? 2 : breathIn ? 1 : 0;
      }
      let name = frameName(npc.facing, frame);
      if (npc.turn.frames.length > 0) {
        if (now >= npc.turn.next) {
          npc.turn.frames.shift();
          npc.turn.next = now + TURN_STEP_MS;
        }
        name = npc.turn.frames[0] ?? name;
      }
      npc.sprite.setFrame(name);
      npc.shadow?.setFrame(name);
      if (npc.rendered && this.sunAt) {
        // Someone standing in shade takes on its dimmer, cooler light.
        const target = this.sunAt(npc.sprite.x, npc.sprite.y);
        npc.light += (target - npc.light) * 0.2;
        npc.sprite.setTint(shadeTint(npc.light));
        // No direct sun in shade, so no shadow of one's own.
        npc.shadow?.setAlpha(RENDERED_SHADOW_ALPHA * npc.light);
      }
    }
  }

  /** The player's frame: a walk column, or breathing, blinking and talking when standing. */
  playerFrame(now: number, player: Mover, walkColumn: number): number {
    if (player.moving) return walkColumn;
    if (this.conversation?.speaking === 'player')
      return this.reducedMotion() || mouthOpen(now - this.talkStart) ? FRAME.talk : FRAME.talk2;
    if (now >= this.playerBlink.next) {
      this.playerBlink = { next: now + nextBlinkDelay(this.r), until: now + BLINK_MS };
    }
    if (now < this.playerBlink.until) return FRAME.blink;
    const breathIn = !this.reducedMotion() && Math.floor(now / 1700) % 2 === 1;
    return breathIn ? FRAME.breath : FRAME.idle;
  }
}

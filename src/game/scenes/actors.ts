import type Phaser from 'phaser';
import type { WorldConversation, WorldEntityView } from '@/application/ports';
import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import {
  appearanceKey,
  CHAR_H,
  CHAR_W,
  DIRECTION_ROWS,
  FRAME,
  frameName,
  FRAMES_PER_DIRECTION,
  paintCharacterSheet,
  paintPoseSheet,
  POSE_FRAMES,
  POSE_H,
  POSE_W,
  poseKey,
  type Pose,
} from '../art/characters';
import { ART_SCALE, hash, rng } from '../art/paint';
import { BLINK_MS, faceToward, mouthOpen, nextBlinkDelay, noticesPlayer } from '../systems/life';

/**
 * The people in a scene: their sprites and the small behaviours that make
 * them feel present — they turn toward you when you come close, blink at
 * their own pace, and move their mouths when they speak.
 */
const INV = 1 / ART_SCALE;
const TILE = 32;

export interface Mover {
  x: number;
  y: number;
  facing: Direction;
  moving: boolean;
}

interface Npc {
  view: WorldEntityView;
  sprite: Phaser.GameObjects.Sprite;
  pose: 'stand' | Pose;
  home: Direction;
  facing: Direction;
  noticedAt: number;
  nextBlink: number;
  blinkUntil: number;
  breathing: Phaser.Tweens.Tween | null;
}

export function ensureCharacterTexture(scene: Phaser.Scene, appearance: Appearance): string {
  const key = appearanceKey(appearance);
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.addCanvas(key, paintCharacterSheet(appearance));
  if (!tex) return key;
  const fw = CHAR_W * ART_SCALE;
  const fh = CHAR_H * ART_SCALE;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES_PER_DIRECTION; f++)
      tex.add(frameName(dir, f), 0, f * fw, row * fh, fw, fh);
  });
  return key;
}

function ensurePoseTexture(scene: Phaser.Scene, appearance: Appearance, pose: Pose): string {
  const key = poseKey(appearance, pose);
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.addCanvas(key, paintPoseSheet(appearance, pose));
  if (!tex) return key;
  const fw = POSE_W * ART_SCALE;
  const fh = POSE_H * ART_SCALE;
  DIRECTION_ROWS.forEach((dir, row) => {
    for (let f = 0; f < POSE_FRAMES; f++) tex.add(frameName(dir, f), 0, f * fw, row * fh, fw, fh);
  });
  return key;
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
  ) {}

  add(view: WorldEntityView): Phaser.GameObjects.Sprite | null {
    if (!view.appearance) return null;
    const pose = view.pose === 'stand' ? 'stand' : view.pose;
    const key =
      pose === 'stand'
        ? ensureCharacterTexture(this.scene, view.appearance)
        : ensurePoseTexture(this.scene, view.appearance, pose);
    const sprite = this.scene.add.sprite(0, 0, key, frameName(view.facing, 0)).setScale(INV);
    if (pose === 'stand')
      sprite.setOrigin(0.5, 1).setPosition((view.x + 0.5) * TILE, (view.y + 1) * TILE + 1);
    else
      sprite
        .setOrigin(0.5, (POSE_H - 5) / POSE_H)
        .setPosition((view.x + 0.5) * TILE, (view.y + 1) * TILE - 3);
    sprite.setDepth(this.depthFor(view.y + 0.5));
    const seed = hash(view.x, view.y, 61);
    const npc: Npc = {
      view,
      sprite,
      pose,
      home: view.facing,
      facing: view.facing,
      noticedAt: -Infinity,
      nextBlink: 800 + (seed % 3000),
      blinkUntil: 0,
      breathing: null,
    };
    if (pose === 'stand' && !this.reducedMotion()) {
      // A gentle breathing motion (feet stay planted).
      npc.breathing = this.scene.tweens.add({
        targets: sprite,
        scaleY: INV * 1.02,
        duration: 1400 + (seed % 600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    this.npcs.set(view.id, npc);
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

  setView(view: WorldEntityView): void {
    const npc = this.npcs.get(view.id);
    if (npc) npc.view = view;
  }

  remove(id: string): void {
    const npc = this.npcs.get(id);
    if (!npc) return;
    npc.breathing?.remove();
    npc.sprite.destroy();
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
    npc.facing = faceToward({ x: npc.view.x, y: npc.view.y }, player);
    npc.noticedAt = this.scene.time.now;
  }

  update(now: number, player: Mover): void {
    const c = this.conversation;
    for (const npc of this.npcs.values()) {
      if (npc.pose !== 'lie') {
        const talkingTo = c?.with === npc.view.id;
        if (talkingTo || noticesPlayer(npc.view, player)) {
          npc.facing = faceToward({ x: npc.view.x, y: npc.view.y }, player);
          npc.noticedAt = now;
        } else if (now - npc.noticedAt > 1500) {
          npc.facing = npc.home;
        }
      }
      if (now >= npc.nextBlink) {
        npc.blinkUntil = now + BLINK_MS;
        npc.nextBlink = now + nextBlinkDelay(this.r);
      }
      const speaking = c?.speaking === npc.view.id;
      let frame: number;
      if (npc.pose === 'stand') {
        frame = speaking
          ? this.reducedMotion() || mouthOpen(now - this.talkStart)
            ? FRAME.talk
            : FRAME.stand
          : now < npc.blinkUntil
            ? FRAME.blink
            : FRAME.stand;
      } else {
        frame = speaking && (this.reducedMotion() || mouthOpen(now - this.talkStart)) ? 1 : 0;
      }
      npc.sprite.setFrame(frameName(npc.facing, frame));
    }
  }

  /** The player's frame: walk cycle, or blink/talk when standing. */
  playerFrame(now: number, player: Mover, walkFrame: number): number {
    if (player.moving) return walkFrame;
    if (this.conversation?.speaking === 'player')
      return this.reducedMotion() || mouthOpen(now - this.talkStart) ? FRAME.talk : FRAME.stand;
    if (now >= this.playerBlink.next) {
      this.playerBlink = { next: now + nextBlinkDelay(this.r), until: now + BLINK_MS };
    }
    return now < this.playerBlink.until ? FRAME.blink : FRAME.stand;
  }
}

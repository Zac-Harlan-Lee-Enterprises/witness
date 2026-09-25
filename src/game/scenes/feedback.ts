import Phaser from 'phaser';
import type { WorldEmphasis, WorldEntityView, WorldSceneModel } from '@/application/ports';
import { ART_SCALE } from '../art/paint';
import { TEX } from './textures';

/**
 * Interaction feedback in the world. Shapes carry the meaning (a ring on
 * the ground, a speech/lens/hand symbol, a glint, a little satchel), and
 * the same information is always in the HTML prompt and notices too.
 *
 * With reduced motion nothing bobs, flies or pulses: marks simply appear
 * and fade.
 */
const INV = 1 / ART_SCALE;
const TILE = 32;

interface Anchor {
  x: number;
  y: number;
  /** Height of the thing, for placing the symbol above it. */
  top: number;
}

export class Feedback {
  private readonly ring: Phaser.GameObjects.Image;
  private readonly glyph: Phaser.GameObjects.Image;
  private readonly chevrons: Array<{
    image: Phaser.GameObjects.Image;
    x: number;
    y: number;
    dx: number;
    dy: number;
  }> = [];
  private readonly twinkles: Array<{ image: Phaser.GameObjects.Image; phase: number; id: string }> =
    [];
  private readonly transient: Phaser.GameObjects.GameObject[] = [];
  private elapsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depths: { ground: number; marker: number },
    private readonly reducedMotion: () => boolean,
  ) {
    this.ring = scene.add
      .image(0, 0, TEX.ring)
      .setScale(INV)
      .setVisible(false)
      .setDepth(depths.ground + 3);
    this.glyph = scene.add
      .image(0, 0, TEX.glyphTalk)
      .setScale(INV)
      .setVisible(false)
      .setDepth(depths.marker);
  }

  /** Exit chevrons (shown when you're near) and glints on clues you haven't examined. */
  build(model: WorldSceneModel): void {
    const w = model.grid.width;
    const h = model.grid.height;
    for (const exit of model.exits) {
      const cx = exit.x + exit.w / 2;
      const cy = exit.y + exit.h / 2;
      const [dx, dy] =
        exit.x + exit.w >= w
          ? [1, 0]
          : exit.x <= 0
            ? [-1, 0]
            : exit.y + exit.h >= h
              ? [0, 1]
              : exit.y <= 0
                ? [0, -1]
                : [0, 1];
      const image = this.scene.add
        .image(cx * TILE - dx * 10, cy * TILE - dy * 10, TEX.chevron)
        .setScale(INV)
        .setAngle(dx === 1 ? 0 : dx === -1 ? 180 : dy === 1 ? 90 : -90)
        .setDepth(this.depths.marker - 1)
        .setAlpha(0);
      this.chevrons.push({ image, x: cx, y: cy, dx, dy });
    }
    this.syncClues(model.entities);
  }

  syncClues(entities: readonly WorldEntityView[]): void {
    const ids = new Set(entities.filter((e) => e.kind === 'clue').map((e) => e.id));
    for (let i = this.twinkles.length - 1; i >= 0; i--) {
      const t = this.twinkles[i];
      if (t && !ids.has(t.id)) {
        t.image.destroy();
        this.twinkles.splice(i, 1);
      }
    }
    for (const e of entities) {
      if (e.kind !== 'clue' || this.twinkles.some((t) => t.id === e.id)) continue;
      const image = this.scene.add
        .image((e.x + 0.62) * TILE, (e.y + 0.45) * TILE, TEX.star)
        .setScale(INV * 0.8)
        .setDepth(this.depths.marker - 2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.35);
      this.twinkles.push({ image, phase: (e.x * 13 + e.y * 7) % 10, id: e.id });
    }
  }

  /** Point out the thing you'd interact with now (or nothing). */
  focus(target: (Anchor & { verb: WorldEntityView['verb'] }) | null): void {
    if (!target) {
      this.ring.setVisible(false);
      this.glyph.setVisible(false);
      return;
    }
    const key =
      target.verb === 'talk'
        ? TEX.glyphTalk
        : target.verb === 'examine' || target.verb === 'read'
          ? TEX.glyphLook
          : TEX.glyphUse;
    if (this.glyph.texture.key !== key) this.glyph.setTexture(key);
    const bob = this.reducedMotion() ? 0 : Math.sin(this.elapsed * 4) * 1.6;
    this.ring.setVisible(true).setPosition(target.x, target.y - 2);
    this.ring.setAlpha(this.reducedMotion() ? 0.9 : 0.75 + Math.sin(this.elapsed * 3) * 0.2);
    this.glyph.setVisible(true).setPosition(target.x, target.y - target.top - 10 + bob);
  }

  update(dt: number, player: { x: number; y: number }): void {
    this.elapsed += dt;
    for (const c of this.chevrons) {
      const near = Math.hypot(c.x - player.x, c.y - player.y) < 5;
      const target = near ? 0.9 : 0;
      c.image.setAlpha(c.image.alpha + (target - c.image.alpha) * Math.min(1, dt * 4));
      if (!this.reducedMotion()) {
        const nudge = Math.sin(this.elapsed * 3) * 2.5;
        c.image.setPosition(c.x * TILE - c.dx * (10 - nudge), c.y * TILE - c.dy * (10 - nudge));
      }
    }
    for (const t of this.twinkles) {
      if (this.reducedMotion()) {
        t.image.setAlpha(0.55).setScale(INV * 0.8);
        continue;
      }
      // A slow glint every few seconds, different for each clue.
      const cycle = (this.elapsed + t.phase) % 3.2;
      const k = cycle < 0.6 ? Math.sin((cycle / 0.6) * Math.PI) : 0;
      t.image.setAlpha(0.15 + k * 0.85).setScale(INV * (0.6 + k * 0.5));
    }
  }

  /** A short flourish at a place (entity) or at the player. */
  emphasize(emphasis: WorldEmphasis, at: Anchor): void {
    const still = this.reducedMotion();
    const icon = emphasis.kind === 'item' ? TEX.bundle : TEX.star;
    const mark = this.scene.add
      .image(at.x, at.y - at.top - 6, icon)
      .setScale(INV * (emphasis.kind === 'item' ? 1.2 : 1.4))
      .setDepth(this.depths.marker + 1)
      .setAlpha(0);
    this.transient.push(mark);
    this.scene.tweens.add({
      targets: mark,
      alpha: { from: 0, to: 1 },
      y: still ? mark.y : mark.y - 14,
      duration: still ? 200 : 450,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: still ? 700 : 350,
      onComplete: () => mark.destroy(),
    });
    if (still) return;
    // A soft ring spreading on the ground, and a few sparks.
    const ring = this.scene.add
      .image(at.x, at.y - 2, TEX.ring)
      .setScale(INV * 0.6)
      .setDepth(this.depths.ground + 3)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.transient.push(ring);
    this.scene.tweens.add({
      targets: ring,
      scale: INV * (emphasis.kind === 'solved' || emphasis.kind === 'objective' ? 2.6 : 1.8),
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    const sparks = emphasis.kind === 'objective' ? 4 : 7;
    for (let i = 0; i < sparks; i++) {
      const a = (i / sparks) * Math.PI * 2;
      const spark = this.scene.add
        .image(at.x, at.y - at.top * 0.5, TEX.sparkle)
        .setScale(INV)
        .setDepth(this.depths.marker)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.transient.push(spark);
      this.scene.tweens.add({
        targets: spark,
        x: at.x + Math.cos(a) * 16,
        y: at.y - at.top * 0.5 + Math.sin(a) * 9 - 8,
        alpha: 0,
        duration: 650 + i * 30,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  clear(): void {
    this.chevrons.forEach((c) => c.image.destroy());
    this.chevrons.length = 0;
    this.twinkles.forEach((t) => t.image.destroy());
    this.twinkles.length = 0;
    this.transient.forEach((o) => o.destroy());
    this.transient.length = 0;
    this.ring.setVisible(false);
    this.glyph.setVisible(false);
  }

  destroy(): void {
    this.clear();
    this.ring.destroy();
    this.glyph.destroy();
  }
}

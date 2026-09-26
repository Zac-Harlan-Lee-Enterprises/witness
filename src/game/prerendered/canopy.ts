import type Phaser from 'phaser';
import type { ArtSprite } from './manifest';
import { behindCanopy, CANOPY_FADED } from './select';

/**
 * Canopies (a palm's crown, a fig's leaves) are sprites of their own that
 * fade while the player walks behind them, so nobody is lost under the
 * trees. The fade eases in and out (at once with reduced motion).
 */
export class CanopyFader {
  private readonly items: Array<{ image: Phaser.GameObjects.Image; sprite: ArtSprite }> = [];

  constructor(
    private readonly ppu: number,
    private readonly reducedMotion: () => boolean,
  ) {}

  track(image: Phaser.GameObjects.Image, sprite: ArtSprite): void {
    if (sprite.fade) this.items.push({ image, sprite });
  }

  /** Call every frame with where the player's feet are (game units). */
  update(x: number, y: number, dt: number): void {
    const k = this.reducedMotion() ? 1 : Math.min(1, dt * 6);
    for (const { image, sprite } of this.items) {
      const target = behindCanopy(sprite, this.ppu, x, y) ? CANOPY_FADED : 1;
      image.setAlpha(image.alpha + (target - image.alpha) * k);
    }
  }
}

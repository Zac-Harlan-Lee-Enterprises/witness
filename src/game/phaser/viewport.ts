import type Phaser from 'phaser';
import { canvasPixels, renderResolution, RESOLUTION } from '../systems/resolution';

/**
 * Keeps the world canvas at device-pixel resolution (capped; see
 * systems/resolution.ts) while it is laid out at its parent's CSS size.
 * Phaser's own RESIZE mode always renders at CSS pixels, so the game runs
 * in NONE mode and this sizes it: the canvas holds `css × ratio` pixels
 * and is shown at `css` size (Phaser's `zoom = 1 / ratio`), so pointer
 * input maps through Phaser's display scale unchanged.
 *
 * Follows parent resizes (ResizeObserver) and device-pixel-ratio changes
 * (moving the window between screens, browser zoom).
 */
export class Viewport {
  private cap: number = RESOLUTION.max;
  private current = { width: 0, height: 0, ratio: 0 };
  private observer: ResizeObserver | null = null;
  private media: MediaQueryList | null = null;
  private game: Phaser.Game | null = null;
  private readonly onChange = (): void => this.fit();

  constructor(private readonly parent: HTMLElement) {}

  /** CSS size of the view (what layout and camera framing are based on). */
  get cssWidth(): number {
    return this.current.width || this.parent.clientWidth || 800;
  }

  get cssHeight(): number {
    return this.current.height || this.parent.clientHeight || 600;
  }

  /** Canvas pixels per CSS pixel. */
  get ratio(): number {
    return this.current.ratio || 1;
  }

  /** The canvas size to create the game with, before it is attached. */
  initial(): { width: number; height: number; zoom: number } {
    const w = this.parent.clientWidth || 800;
    const h = this.parent.clientHeight || 600;
    const ratio = renderResolution(window.devicePixelRatio, w, h, this.cap);
    return { ...canvasPixels(w, h, ratio), zoom: 1 / ratio };
  }

  attach(game: Phaser.Game): void {
    this.game = game;
    if (typeof ResizeObserver === 'function') {
      this.observer = new ResizeObserver(this.onChange);
      this.observer.observe(this.parent);
    } else {
      window.addEventListener('resize', this.onChange);
    }
    this.watchPixelRatio();
    this.fit();
  }

  /** Lower (or restore) the highest resolution, e.g. when frames are slow. */
  setCap(cap: number): void {
    if (cap === this.cap) return;
    this.cap = cap;
    this.fit();
  }

  /** Resize the canvas to the parent at the current ratio (no-op when nothing changed). */
  fit(): void {
    const game = this.game;
    if (!game?.canvas) return;
    const width = this.parent.clientWidth;
    const height = this.parent.clientHeight;
    if (width === 0 || height === 0) return;
    const ratio = renderResolution(window.devicePixelRatio, width, height, this.cap);
    const c = this.current;
    if (c.width === width && c.height === height && c.ratio === ratio) return;
    this.current = { width, height, ratio };
    const px = canvasPixels(width, height, ratio);
    const scale = game.scale;
    scale.zoom = 1 / ratio;
    scale.resize(px.width, px.height);
    game.canvas.style.width = `${width}px`;
    game.canvas.style.height = `${height}px`;
    game.canvas.dataset.resolution = String(ratio);
    // Recompute the input bounds and display scale now that the CSS size is set.
    scale.refresh();
  }

  /** Re-fit when the device pixel ratio changes (a matchMedia query per ratio). */
  private watchPixelRatio(): void {
    this.media?.removeEventListener('change', this.onRatio);
    if (typeof window.matchMedia !== 'function') return;
    this.media = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.media.addEventListener('change', this.onRatio);
  }

  private readonly onRatio = (): void => {
    this.watchPixelRatio();
    this.fit();
  };

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener('resize', this.onChange);
    this.media?.removeEventListener('change', this.onRatio);
    this.media = null;
    this.game = null;
  }
}

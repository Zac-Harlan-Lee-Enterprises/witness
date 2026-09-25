import Phaser from 'phaser';
import type { WorldSceneModel } from '@/application/ports';
import { findPath, type Blocked, type Tile } from '@/domain/navigation';
import type { Direction } from '@/domain/state/game-state';
import type { TileKind } from '@/domain/world';
import { FRAME, frameName } from '../art/characters';
import { ART_SCALE, hash, rng } from '../art/paint';
import type { CanopyPiece } from '../art/scene-painter';
import type { LightSpot } from '../art/site';
import { crowdSize, crowdSpots, passerBy, startles } from '../systems/life';
import { ensureCharacterTexture } from './actors';
import { TEX } from './textures';

/**
 * Ambient life: the things that make a place feel inhabited without
 * asking anything of the player. Passers-by in the market, pigeons that
 * take off when you walk up, a hawk's shadow over the road, palms swaying
 * in Jericho, dust in the window light at home, a flickering hearth.
 *
 * Nothing here is interactive or carries information, and everything
 * stands still (or is left out) with reduced motion or on slow devices.
 */
const INV = 1 / ART_SCALE;
const TILE = 32;
const WALK_CYCLE = [FRAME.stepA, FRAME.stand, FRAME.stepB, FRAME.stand];
const OPEN_GROUND: ReadonlySet<TileKind> = new Set<TileKind>([
  'paving',
  'sand',
  'road',
  'grass',
  'scrub',
  'steps',
  'floor',
]);

export interface AmbientDeps {
  scene: Phaser.Scene;
  model: WorldSceneModel;
  canopies: Array<{ image: Phaser.GameObjects.Image; piece: CanopyPiece }>;
  lights: LightSpot[];
  blocked: () => Blocked;
  player: () => { x: number; y: number };
  depthFor: (y: number) => number;
  depths: { ground: number; fx: number; light: number };
  reducedMotion: boolean;
  lowPower: boolean;
}

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  facing: Direction;
  path: Tile[];
  wait: number;
  walk: number;
}

interface Flock {
  birds: Phaser.GameObjects.Image[];
  at: { x: number; y: number };
  away: number;
}

export class AmbientLife {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];
  private readonly walkers: Walker[] = [];
  private readonly flickers: Array<{
    image: Phaser.GameObjects.Image;
    base: number;
    seed: number;
  }> = [];
  private flock: Flock | null = null;
  private spots: Tile[] = [];
  private hawkIn = 6;
  private elapsed = 0;
  private readonly r: () => number;

  constructor(private readonly d: AmbientDeps) {
    this.r = rng(hash(d.model.grid.width, d.model.grid.height, 5));
    this.build();
  }

  private get still(): boolean {
    return this.d.reducedMotion;
  }

  private build(): void {
    const { model } = this.d;
    this.buildLights();
    this.buildCrowd();
    if (this.d.lowPower) return;
    if (model.mood === 'city') this.buildPigeons();
    if (this.still) return;
    this.buildSway();
    this.buildMotes();
    this.buildBirds();
    this.buildGlints();
  }

  // ── Light: hearth fire and lamps flicker; window light holds dust ────────
  private buildLights(): void {
    for (const light of this.d.lights) {
      if (light.kind === 'window') continue;
      const image = this.d.scene.add
        .image(light.x, light.y, TEX.glow)
        .setScale((light.radius / 80) * INV)
        .setDepth(this.d.depths.light + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(light.kind === 'hearth' ? 0.55 : 0.4);
      this.objects.push(image);
      this.flickers.push({ image, base: image.alpha, seed: light.x * 0.37 + light.y });
    }
  }

  // ── Passers-by ───────────────────────────────────────────────────────────
  private buildCrowd(): void {
    const { model } = this.d;
    const count = crowdSize(model.mood, this.d.lowPower);
    if (count === 0) return;
    const blocked = this.d.blocked();
    const keep: Tile[] = [
      ...model.entities.map((e) => ({ x: e.x, y: e.y })),
      ...model.exits.flatMap((x) => [{ x: x.x, y: x.y }]),
      { x: model.player.x, y: model.player.y },
    ];
    const open = (x: number, y: number): boolean =>
      !blocked(x, y) && OPEN_GROUND.has(model.grid.tiles[y]?.[x] ?? 'void');
    this.spots = crowdSpots(open, model.grid.width, model.grid.height, keep, this.r, count * 3);
    for (let i = 0; i < count && i < this.spots.length; i++) {
      const spot = this.spots[i] as Tile;
      const key = ensureCharacterTexture(this.d.scene, passerBy(i, this.r));
      const facing = (['down', 'left', 'right', 'up'] as const)[i % 4] ?? 'down';
      const sprite = this.d.scene.add
        .sprite(0, 0, key, frameName(facing, 0))
        .setOrigin(0.5, 1)
        .setScale(INV);
      const walker: Walker = {
        sprite,
        x: spot.x + 0.5,
        y: spot.y + 0.5,
        facing,
        path: [],
        wait: this.r() * 3,
        walk: 0,
      };
      this.place(walker);
      this.walkers.push(walker);
      this.objects.push(sprite);
    }
  }

  private place(w: Walker): void {
    w.sprite.setPosition(w.x * TILE, w.y * TILE + 12).setDepth(this.d.depthFor(w.y));
  }

  private stepWalkers(dt: number): void {
    const player = this.d.player();
    const ptx = Math.floor(player.x);
    const pty = Math.floor(player.y);
    for (const w of this.walkers) {
      let moving = false;
      if (w.wait > 0) w.wait -= dt;
      else if (w.path.length === 0) {
        const dest = this.spots[Math.floor(this.r() * this.spots.length)];
        const from = { x: Math.floor(w.x), y: Math.floor(w.y) };
        const path = dest ? findPath(from, [dest], this.d.blocked()) : null;
        if (path && path.length > 0) w.path = path.slice(0, 14);
        else w.wait = 1.5;
      } else {
        const next = w.path[0] as Tile;
        if (next.x === ptx && next.y === pty) {
          w.wait = 0.6; // make way for the player
        } else {
          const tx = next.x + 0.5;
          const ty = next.y + 0.5;
          const dx = tx - w.x;
          const dy = ty - w.y;
          const dist = Math.hypot(dx, dy);
          const step = 1.5 * dt;
          if (Math.abs(dx) > Math.abs(dy)) w.facing = dx > 0 ? 'right' : 'left';
          else if (dy !== 0) w.facing = dy > 0 ? 'down' : 'up';
          if (dist <= step) {
            w.x = tx;
            w.y = ty;
            w.path.shift();
            if (w.path.length === 0) w.wait = 1.5 + this.r() * 4;
          } else {
            w.x += (dx / dist) * step;
            w.y += (dy / dist) * step;
          }
          moving = true;
        }
      }
      w.walk = moving ? w.walk + dt : 0;
      const frame = moving
        ? (WALK_CYCLE[Math.floor(w.walk / 0.15) % WALK_CYCLE.length] ?? 0)
        : FRAME.stand;
      w.sprite.setFrame(frameName(w.facing, frame));
      this.place(w);
    }
  }

  // ── Pigeons ──────────────────────────────────────────────────────────────
  private buildPigeons(): void {
    const paving = this.spots.filter((s) => this.d.model.grid.tiles[s.y]?.[s.x] === 'paving');
    const home = paving[0] ?? this.spots[0];
    if (!home) return;
    const birds: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 5; i++) {
      const bird = this.d.scene.add
        .image(
          (home.x + 0.2 + this.r() * 0.9) * TILE,
          (home.y + 0.3 + this.r() * 0.7) * TILE,
          TEX.pigeon,
        )
        .setScale(INV)
        .setFlipX(this.r() > 0.5)
        .setDepth(this.d.depthFor(home.y + 0.5));
      birds.push(bird);
      this.objects.push(bird);
    }
    this.flock = { birds, at: { x: home.x + 0.5, y: home.y + 0.5 }, away: 0 };
  }

  private stepPigeons(dt: number): void {
    const flock = this.flock;
    if (!flock) return;
    if (flock.away > 0) {
      flock.away -= dt;
      if (flock.away <= 0) this.landFlock(flock);
      return;
    }
    if (startles(flock.at, this.d.player())) {
      flock.away = 9;
      for (const bird of flock.birds) {
        if (this.still) {
          bird.setVisible(false);
          continue;
        }
        bird.setTexture(TEX.pigeonFly);
        this.tweens.push(
          this.d.scene.tweens.add({
            targets: bird,
            x: bird.x + (this.r() - 0.3) * 260,
            y: bird.y - 160 - this.r() * 80,
            alpha: 0,
            duration: 1300 + this.r() * 500,
            ease: 'Quad.easeIn',
          }),
        );
      }
      return;
    }
    if (!this.still && this.r() < dt * 1.5) {
      // Pecking.
      const bird = flock.birds[Math.floor(this.r() * flock.birds.length)];
      if (bird)
        this.tweens.push(
          this.d.scene.tweens.add({ targets: bird, y: bird.y + 1.2, duration: 90, yoyo: true }),
        );
    }
  }

  private landFlock(flock: Flock): void {
    const spot = this.spots[Math.floor(this.r() * this.spots.length)];
    if (!spot) return;
    flock.at = { x: spot.x + 0.5, y: spot.y + 0.5 };
    for (const bird of flock.birds) {
      bird
        .setTexture(TEX.pigeon)
        .setPosition((spot.x + 0.2 + this.r() * 0.9) * TILE, (spot.y + 0.3 + this.r() * 0.7) * TILE)
        .setDepth(this.d.depthFor(spot.y + 0.5))
        .setVisible(true)
        .setAlpha(this.still ? 1 : 0);
      if (!this.still)
        this.tweens.push(this.d.scene.tweens.add({ targets: bird, alpha: 1, duration: 600 }));
    }
  }

  // ── Trees sway, dust drifts, birds cross, water glints ───────────────────
  private buildSway(): void {
    for (const { image, piece } of this.d.canopies) {
      const w = image.width;
      const h = image.height;
      if (w === 0 || h === 0) continue;
      image.setOrigin(
        ((piece.pivotX - piece.x) * ART_SCALE) / w,
        ((piece.pivotY - piece.y) * ART_SCALE) / h,
      );
      image.setPosition(piece.pivotX, piece.pivotY);
      const seed = hash(piece.pivotX, piece.pivotY, 3) % 1000;
      this.tweens.push(
        this.d.scene.tweens.add({
          targets: image,
          angle: { from: -0.5 - (seed % 3) * 0.2, to: 0.6 + (seed % 4) * 0.2 },
          duration: 2600 + seed * 2,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: seed,
        }),
      );
    }
  }

  private buildMotes(): void {
    const { model, scene } = this.d;
    const mapW = model.grid.width * TILE;
    const mapH = model.grid.height * TILE;
    if (model.mood === 'wilderness' || model.mood === 'city') {
      const windy = model.mood === 'wilderness';
      const emitter = scene.add.particles(0, 0, TEX.mote, {
        x: { min: 0, max: mapW },
        y: { min: 0, max: mapH },
        lifespan: 7000,
        speedX: { min: windy ? 8 : 1, max: windy ? 20 : 5 },
        speedY: { min: -3, max: 2 },
        scale: { min: 0.25, max: 0.6 },
        alpha: { start: 0.5, end: 0 },
        frequency: windy ? 110 : 240,
        blendMode: 'ADD',
      });
      emitter.setDepth(this.d.depths.fx);
      this.objects.push(emitter);
    }
    for (const light of this.d.lights) {
      if (light.kind !== 'window') continue;
      // Dust turning slowly in a shaft of sunlight.
      const emitter = scene.add.particles(0, 0, TEX.mote, {
        x: { min: light.x - 4, max: light.x + 40 },
        y: { min: light.y + 20, max: light.y + 90 },
        lifespan: 5000,
        speedX: { min: -2, max: 3 },
        speedY: { min: -2, max: 2 },
        scale: { min: 0.2, max: 0.45 },
        alpha: { start: 0, end: 0, ease: (t: number) => Math.sin(t * Math.PI) * 0.6 },
        frequency: 420,
        blendMode: 'ADD',
      });
      emitter.setDepth(this.d.depths.fx);
      this.objects.push(emitter);
    }
  }

  private buildBirds(): void {
    const { model, scene } = this.d;
    if (model.mood !== 'oasis') return;
    const mapW = model.grid.width * TILE;
    for (let i = 0; i < 4; i++) {
      const bird = scene.add
        .image(-20, 20 + i * 40, TEX.bird)
        .setScale(INV)
        .setDepth(this.d.depths.fx)
        .setAlpha(0.8);
      this.objects.push(bird);
      this.tweens.push(
        scene.tweens.add({
          targets: bird,
          x: mapW + 40,
          y: { from: 30 + i * 35, to: 10 + i * 45 },
          duration: 14000 + i * 2500,
          delay: i * 3500,
          repeat: -1,
          repeatDelay: 4000 + i * 1500,
        }),
      );
    }
  }

  private buildGlints(): void {
    const { model, scene } = this.d;
    for (let y = 0; y < model.grid.height; y++) {
      for (let x = 0; x < model.grid.width; x++) {
        if (model.grid.tiles[y]?.[x] !== 'water') continue;
        const glint = scene.add
          .image(x * TILE, y * TILE, TEX.glint)
          .setOrigin(0, 0)
          .setScale(INV)
          .setDepth(this.d.depths.ground + 1)
          .setAlpha(0)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.objects.push(glint);
        this.tweens.push(
          scene.tweens.add({
            targets: glint,
            alpha: 0.8,
            duration: 1600,
            delay: ((x * 7 + y * 13) % 10) * 250,
            yoyo: true,
            repeat: -1,
          }),
        );
      }
    }
  }

  /** Over the open road, now and then, the shadow of a hawk glides across. */
  private stepHawk(dt: number): void {
    if (this.d.model.mood !== 'wilderness' || this.still || this.d.lowPower) return;
    this.hawkIn -= dt;
    if (this.hawkIn > 0) return;
    this.hawkIn = 18 + this.r() * 14;
    const cam = this.d.scene.cameras.main;
    const view = cam.worldView;
    const fromLeft = this.r() > 0.5;
    const shadow = this.d.scene.add
      .image(
        fromLeft ? view.x - 40 : view.right + 40,
        view.y + view.height * (0.2 + this.r() * 0.4),
        TEX.hawk,
      )
      .setScale(INV * 1.2)
      .setAlpha(0.22)
      .setFlipX(!fromLeft)
      .setDepth(this.d.depths.ground + 2);
    this.objects.push(shadow);
    this.tweens.push(
      this.d.scene.tweens.add({
        targets: shadow,
        x: fromLeft ? view.right + 60 : view.x - 60,
        y: shadow.y + view.height * 0.3,
        duration: 6500,
        onComplete: () => shadow.destroy(),
      }),
    );
  }

  update(dt: number): void {
    this.elapsed += dt;
    if (!this.still) this.stepWalkers(dt);
    this.stepPigeons(dt);
    this.stepHawk(dt);
    if (this.still) return;
    for (const f of this.flickers) {
      const t = this.elapsed * 6 + f.seed;
      f.image.setAlpha(
        f.base * (0.85 + Math.sin(t) * 0.08 + Math.sin(t * 2.7) * 0.05 + Math.sin(t * 5.3) * 0.03),
      );
    }
  }

  /** Drop the decorative extras (the device is struggling). */
  reduce(): void {
    this.flock?.birds.forEach((b) => b.destroy());
    this.flock = null;
    const keep = crowdSize(this.d.model.mood, true);
    while (this.walkers.length > keep) this.walkers.pop()?.sprite.destroy();
    this.tweens.forEach((t) => t.remove());
    this.tweens.length = 0;
    for (const o of this.objects) {
      if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter) o.destroy();
    }
    this.d.canopies.forEach(({ image }) => image.setAngle(0));
  }

  destroy(): void {
    this.tweens.forEach((t) => t.remove());
    this.tweens.length = 0;
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
    this.walkers.length = 0;
    this.flickers.length = 0;
    this.flock = null;
  }
}

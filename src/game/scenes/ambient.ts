import Phaser from 'phaser';
import type { WorldSceneModel } from '@/application/ports';
import { findPath, type Blocked, type Tile } from '@/domain/navigation';
import type { Direction } from '@/domain/state/game-state';
import type { TileKind } from '@/domain/world';
import { ART_SCALE, hash, rng } from '../art/paint';
import { FRAME, walkColumn, WALK_CYCLE_TILES } from '../art/people/rig';
import { frameName } from '../art/people/sheet';
import type { CanopyPiece } from '../art/scene-painter';
import type { LightSpot } from '../art/site';
import { crowdSize, crowdSpots, passerBy, startles } from '../systems/life';
import {
  addCastShadow,
  addRenderedFigure,
  ensureFigureTexture,
  FEET_BELOW_CENTRE,
  STAND_ORIGIN_Y,
  type RenderedFigure,
  type ShadowCast,
} from './actors';
import { FX } from '../fx/fx-textures';
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
const CROWD_SPEED = 1.5;
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
  depths: { ground: number; shadows: number; fx: number; light: number };
  reducedMotion: boolean;
  lowPower: boolean;
  /** The sun's shadow for people (null indoors). */
  cast: ShadowCast | null;
  /** Pre-rendered passers-by for this place (empty: paint them). */
  crowd: readonly RenderedFigure[];
  /** The place is pre-rendered: leave out painted extras (pigeons) that would clash. */
  prerendered: boolean;
  /** Pre-rendered trees that sway (origin already at the foot of the trunk). */
  trees: readonly Phaser.GameObjects.Image[];
  /** Water is drawn live by a shader (fx/water-surface.ts): no painted glints. */
  liveWater: boolean;
}

/** Something that sways in the wind about its foot. */
interface Swayer {
  image: Phaser.GameObjects.Image;
  seed: number;
  /** Palms bend more than olive trees. */
  give: number;
}

interface Walker {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite | null;
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
    radius: number;
    kind: LightSpot['kind'];
  }> = [];
  private readonly swayers: Swayer[] = [];
  private wind = 0;
  private night = false;
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
    if (model.mood === 'city' && !this.d.prerendered) this.buildPigeons();
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
        .setDepth(this.d.depths.light + 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.objects.push(image);
      this.flickers.push({
        image,
        base: 0,
        seed: light.x * 0.37 + light.y,
        radius: light.radius,
        kind: light.kind,
      });
    }
    this.lightPools();
  }

  /**
   * By day a lamp or hearth is a small warm glow; at night it is the light
   * in the room: a wider, warmer pool that the dark gathers around.
   */
  private lightPools(): void {
    for (const f of this.flickers) {
      const hearth = f.kind === 'hearth';
      if (this.night) {
        f.image.setTexture(FX.pool).setScale((f.radius * 2.3) / 256);
        f.base = hearth ? 0.85 : 0.7;
      } else {
        f.image.setTexture(TEX.glow).setScale((f.radius / 80) * INV);
        f.base = hearth ? 0.55 : 0.4;
      }
      f.image.setAlpha(f.base);
    }
  }

  /** Night or day (the story clock): lamps and hearths become pools of light. */
  setNight(night: boolean): void {
    if (night === this.night) return;
    this.night = night;
    this.lightPools();
  }

  /** Wind strength now, 0–1 with gusts (from the weather). */
  setWind(wind: number): void {
    this.wind = wind;
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
      const facing = (['down', 'left', 'right', 'up'] as const)[i % 4] ?? 'down';
      const frame = frameName(facing, 0);
      const rendered = this.d.crowd[i % Math.max(1, this.d.crowd.length)];
      let sprite: Phaser.GameObjects.Sprite;
      let shadow: Phaser.GameObjects.Sprite | null;
      if (rendered) {
        ({ sprite, shadow } = addRenderedFigure(
          this.d.scene,
          rendered,
          frame,
          this.d.depths.shadows,
        ));
      } else {
        const key = ensureFigureTexture(this.d.scene, passerBy(i, this.r));
        sprite = this.d.scene.add
          .sprite(0, 0, key, frame)
          .setOrigin(0.5, STAND_ORIGIN_Y)
          .setScale(INV);
        shadow = this.d.cast
          ? addCastShadow(
              this.d.scene,
              key,
              frame,
              this.d.cast,
              STAND_ORIGIN_Y,
              this.d.depths.shadows,
            )
          : null;
      }
      if (shadow) this.objects.push(shadow);
      const walker: Walker = {
        sprite,
        shadow,
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
    w.sprite.setPosition(w.x * TILE, w.y * TILE + FEET_BELOW_CENTRE).setDepth(this.d.depthFor(w.y));
    w.shadow?.setPosition(w.sprite.x, w.sprite.y);
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
          const step = CROWD_SPEED * dt;
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
      w.walk = moving ? w.walk + CROWD_SPEED * dt : 0;
      const frame = moving ? walkColumn(w.walk, WALK_CYCLE_TILES.crowd) : FRAME.idle;
      const name = frameName(w.facing, frame);
      w.sprite.setFrame(name);
      w.shadow?.setFrame(name);
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
      this.swayers.push({
        image,
        seed: hash(piece.pivotX, piece.pivotY, 3) % 1000,
        give: piece.kind === 'palm' ? 1.5 : 1,
      });
    }
    for (const image of this.d.trees) {
      this.swayers.push({ image, seed: hash(image.x | 0, image.y | 0, 3) % 1000, give: 0.8 });
    }
  }

  /**
   * Trees breathe in still air and lean and thrash in the wind: a slow sway,
   * a lean downwind, and a quicker flutter that grows with the gusts.
   */
  private stepSway(): void {
    const t = this.elapsed;
    const w = this.wind;
    for (const s of this.swayers) {
      const phase = s.seed * 0.0063;
      const calm = Math.sin(t * (2.1 + (s.seed % 7) * 0.08) + phase) * (0.55 + (s.seed % 4) * 0.12);
      const flutter = Math.sin(t * (5.3 + (s.seed % 5) * 0.4) + phase * 2) * 1.6 * w;
      s.image.setAngle(s.give * (calm * (1 - 0.4 * w) + w * 2.4 + flutter));
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
    if (this.d.liveWater) return;
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
      const flicker = Math.sin(t) * 0.08 + Math.sin(t * 2.7) * 0.05 + Math.sin(t * 5.3) * 0.03;
      f.image.setAlpha(f.base * (0.85 + flicker * (this.night ? 1.4 : 1)));
    }
    if (!this.d.lowPower) this.stepSway();
  }

  /** Drop the decorative extras (the device is struggling). */
  reduce(): void {
    this.flock?.birds.forEach((b) => b.destroy());
    this.flock = null;
    const keep = crowdSize(this.d.model.mood, true);
    while (this.walkers.length > keep) {
      const w = this.walkers.pop();
      w?.sprite.destroy();
      w?.shadow?.destroy();
    }
    this.tweens.forEach((t) => t.remove());
    this.tweens.length = 0;
    for (const o of this.objects) {
      if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter) o.destroy();
    }
    this.swayers.forEach(({ image }) => image.setAngle(0));
    this.swayers.length = 0;
  }

  destroy(): void {
    this.tweens.forEach((t) => t.remove());
    this.tweens.length = 0;
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
    this.walkers.length = 0;
    this.flickers.length = 0;
    this.swayers.forEach(({ image }) => image.setAngle(0));
    this.swayers.length = 0;
    this.flock = null;
  }
}

import Phaser from 'phaser';
import type { SceneMood } from '@/application/ports';
import type { TileGrid, TileKind, Weather } from '@/domain/world';
import { hash, rng } from '../art/paint';
import {
  flashLevel,
  FlashGate,
  gust,
  MAX_FLASH,
  nextStrikeIn,
  NO_WEATHER_FX,
  rainSlant,
  stepWeather,
  stepWetness,
  strikePattern,
  WEATHER_MIX,
  weatherBudget,
  type Flash,
  type WeatherBudget,
  type WeatherMix,
} from '../systems/weather';
import { FX, FX_PPU } from './fx-textures';

/**
 * The weather in the world: rain that falls through the view and splashes
 * on the ground, puddles that gather and take ripples, sheets of rain in a
 * downpour, dust and chaff on the wind, cloud shadows racing over the
 * ground, and — in a storm — lightning.
 *
 * Everything is decorative and carries no information. With reduced motion
 * nothing moves or flashes (the light still changes); indoors the weather
 * is only felt in the light. Particle counts follow `weatherBudget`, so the
 * automatic quality level scales them down first.
 */
const TILE = 32;
const PUDDLE_GROUND: ReadonlySet<TileKind> = new Set<TileKind>([
  'paving',
  'road',
  'sand',
  'mud',
  'floor',
  'steps',
]);
/** Where splashes land: anything but open water and the void beyond the map. */
const NO_SPLASH: ReadonlySet<TileKind> = new Set<TileKind>(['water', 'void']);
/** How fast rain falls on screen (world units per second). */
const FALL = 430;

export interface WeatherLayerDeps {
  scene: Phaser.Scene;
  grid: TileGrid;
  mood: SceneMood;
  indoor: boolean;
  depths: { ground: number; shadows: number; fx: number; light: number };
  initial: Weather;
  reducedMotion: boolean;
  /** The quality level's share of the full particle budget (1, 0.5, 0.2). */
  share: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A random-point source for particle zones, re-aimed every frame. */
class Zone {
  constructor(private readonly pick: (p: Phaser.Types.Math.Vector2Like) => void) {}
  getRandomPoint(point: Phaser.Types.Math.Vector2Like): void {
    this.pick(point);
  }
}

interface Puddle {
  x: number;
  y: number;
  dark: Phaser.GameObjects.Image;
  sheen: Phaser.GameObjects.Image;
}

export class WeatherLayer {
  private target: WeatherMix;
  private current: WeatherMix;
  private wet: number;
  private reducedMotion: boolean;
  private share: number;
  private readonly r: () => number;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private splashes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ripples: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private grit: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private leaves: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private clouds: Phaser.GameObjects.TileSprite | null = null;
  private sheets: Phaser.GameObjects.TileSprite[] = [];
  private readonly puddles: Puddle[] = [];
  private view: Rect = { x: 0, y: 0, width: 1, height: 1 };
  private drift = { x: 0, y: 0 };
  private sheetFall = 0;
  private elapsed = 0;
  private windNow = 0;
  private strikeIn: number;
  private flashes: Flash[] = [];
  private readonly gate = new FlashGate();
  private flashNow = 0;

  constructor(private readonly d: WeatherLayerDeps) {
    this.target = WEATHER_MIX[d.initial];
    this.current = this.target;
    this.wet = this.target.rain > 0.05 ? 1 : 0;
    this.reducedMotion = d.reducedMotion;
    this.share = d.share;
    this.r = rng(hash(d.grid.width, d.grid.height, 41));
    this.strikeIn = nextStrikeIn(this.current.storm, this.r) * 0.3;
    this.build();
  }

  /** The weather drawn right now (eased toward the story's). */
  get mix(): WeatherMix {
    return this.current;
  }

  /** Wind strength with gusts, 0–1 (for swaying trees). */
  get wind(): number {
    return this.windNow;
  }

  /** Lightning's brightening of the scene now (0 … MAX_FLASH). */
  get flash(): number {
    return this.flashNow;
  }

  /** What is on screen now, for diagnostics and tests. */
  stats(): { drops: number; splashes: number; dust: number; leaves: number; wet: number } {
    return {
      drops: this.rain?.getAliveParticleCount() ?? 0,
      splashes: this.splashes?.getAliveParticleCount() ?? 0,
      dust: this.dust?.getAliveParticleCount() ?? 0,
      leaves: this.leaves?.getAliveParticleCount() ?? 0,
      wet: Math.round(this.wet * 100) / 100,
    };
  }

  setWeather(weather: Weather): void {
    this.target = WEATHER_MIX[weather];
  }

  setMotion(reducedMotion: boolean): void {
    if (reducedMotion === this.reducedMotion) return;
    this.reducedMotion = reducedMotion;
    this.flashes = [];
    this.rebuild();
  }

  setShare(share: number): void {
    if (share === this.share) return;
    this.share = share;
    this.rebuild();
  }

  private rebuild(): void {
    this.destroyObjects();
    this.build();
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  private build(): void {
    this.buildPuddles();
    if (this.d.indoor || this.reducedMotion || this.share <= 0) return;
    const s = this.d.scene;
    const pickSplash = new Zone((p) => this.splashPoint(p));
    const pickView = new Zone((p) => {
      p.x = this.view.x + this.r() * this.view.width;
      p.y = this.view.y + this.r() * this.view.height;
    });
    // Rain: spawned above and across the view (it falls into it), leaning with the wind.
    this.rain = this.emitter(FX.streak, {
      emitZone: {
        type: 'random',
        source: new Zone((p) => {
          const slant = rainSlant(this.windNow) * FALL * 0.5;
          p.x = this.view.x - slant - 40 + this.r() * (this.view.width + slant + 80);
          p.y = this.view.y - 180 + this.r() * (this.view.height + 160);
        }),
      },
      lifespan: { min: 300, max: 520 },
      speedY: { min: FALL * 0.9, max: FALL * 1.1 },
      // Wind: read when each drop is born (so gusts lean new rain).
      speedX: { onEmit: () => FALL * rainSlant(this.windNow) * (0.85 + this.r() * 0.3) },
      rotate: { onEmit: () => (-Math.atan(rainSlant(this.windNow)) * 180) / Math.PI },
      scaleX: { min: 0.7 / FX_PPU, max: 1 / FX_PPU },
      scaleY: { min: 0.8 / FX_PPU, max: 1.25 / FX_PPU },
      alpha: { start: 0.75, end: 0.35 },
      emitting: false,
    });
    this.rain.setDepth(this.d.depths.fx + 2);
    this.splashes = this.emitter(FX.splash, {
      emitZone: { type: 'random', source: pickSplash },
      lifespan: { min: 180, max: 280 },
      scale: { start: 0.35 / FX_PPU, end: 1.1 / FX_PPU },
      alpha: { start: 0.8, end: 0 },
      emitting: false,
    });
    this.splashes.setDepth(this.d.depths.shadows + 1);
    if (this.puddles.length > 0) {
      this.ripples = this.emitter(FX.ripple, {
        emitZone: {
          type: 'random',
          source: new Zone((p) => {
            const pd = this.puddles[Math.floor(this.r() * this.puddles.length)];
            p.x = (pd?.x ?? 0) + (this.r() - 0.5) * 22;
            p.y = (pd?.y ?? 0) + (this.r() - 0.5) * 9;
          }),
        },
        lifespan: { min: 600, max: 900 },
        scale: { start: 0.05 / FX_PPU, end: 0.9 / FX_PPU },
        alpha: { start: 0.55, end: 0 },
        emitting: false,
      });
      this.ripples.setDepth(this.d.depths.shadows + 1);
    }
    this.dust = this.emitter(FX.dust, {
      emitZone: { type: 'random', source: pickView },
      lifespan: { min: 1600, max: 3000 },
      speedX: { onEmit: () => 50 + 110 * this.windNow + this.r() * (40 + 80 * this.windNow) },
      speedY: { min: -6, max: 6 },
      scaleX: { min: 0.8 / FX_PPU, max: 1.9 / FX_PPU },
      scaleY: { min: 0.7 / FX_PPU, max: 1.3 / FX_PPU },
      alpha: {
        onEmit: () => 0,
        onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8,
      },
      emitting: false,
    });
    this.dust.setDepth(this.d.depths.fx + 1);
    this.grit = this.emitter(FX.grit, {
      emitZone: { type: 'random', source: pickView },
      lifespan: { min: 450, max: 900 },
      speedX: { onEmit: () => (170 + this.r() * 170) * (0.5 + this.windNow) },
      speedY: { min: -14, max: 20 },
      scale: { min: 0.35 / FX_PPU, max: 0.75 / FX_PPU },
      alpha: {
        onEmit: () => 0,
        onUpdate: (_p: unknown, _k: string, t: number) => Math.min(1, Math.sin(t * Math.PI) * 1.6),
      },
      emitting: false,
    });
    this.grit.setDepth(this.d.depths.fx + 1);
    if (this.d.mood !== 'home') {
      this.leaves = this.emitter(FX.leaf, {
        emitZone: { type: 'random', source: pickView },
        lifespan: { min: 2200, max: 4200 },
        speedX: { onEmit: () => 60 + 120 * this.windNow + this.r() * (50 + 80 * this.windNow) },
        speedY: { min: -30, max: 25 },
        accelerationY: { min: -10, max: 22 },
        rotate: { start: 0, end: 900 },
        scale: { min: 0.55 / FX_PPU, max: 0.9 / FX_PPU },
        alpha: {
          onEmit: () => 0,
          onUpdate: (_p: unknown, _k: string, t: number) => Math.min(1, Math.sin(t * Math.PI) * 2),
        },
        emitting: false,
      });
      this.leaves.setDepth(this.d.depths.fx + 1);
    }
    // Cloud shadows: soft patches of shade drifting with the wind.
    this.clouds = s.add
      .tileSprite(0, 0, 16, 16, FX.cloud)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(this.d.depths.fx - 1)
      .setVisible(false);
    this.clouds.setTileScale(5, 5);
    this.objects.push(this.clouds);
    if (this.share >= 0.5) {
      for (const [scale, depth] of [
        [1.5, 3],
        [1, 1],
      ] as const) {
        const sheet = s.add
          .tileSprite(0, 0, 16, 16, FX.sheet)
          .setOrigin(0, 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(this.d.depths.fx + depth)
          .setVisible(false);
        sheet.setTileScale(scale, scale);
        this.sheets.push(sheet);
        this.objects.push(sheet);
      }
    }
  }

  private emitter(
    texture: string,
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  ): Phaser.GameObjects.Particles.ParticleEmitter {
    const e = this.d.scene.add.particles(0, 0, texture, config);
    this.objects.push(e);
    return e;
  }

  /** Puddles gather on flat, open ground outdoors (a few per place, always the same ones). */
  private buildPuddles(): void {
    if (this.d.indoor) return;
    const { grid } = this.d;
    const spots: Array<{ x: number; y: number; seed: number }> = [];
    for (let y = 1; y < grid.height - 1; y++) {
      for (let x = 1; x < grid.width - 1; x++) {
        if (!PUDDLE_GROUND.has(grid.tiles[y]?.[x] ?? 'void')) continue;
        const seed = hash(x, y, 31);
        if (seed % 100 < 6) spots.push({ x, y, seed });
      }
    }
    for (const spot of spots.slice(0, 28)) {
      const r = rng(spot.seed);
      const x = (spot.x + 0.2 + r() * 0.6) * TILE;
      const y = (spot.y + 0.25 + r() * 0.5) * TILE;
      const scale = (0.22 + r() * 0.2) * (r() > 0.5 ? 1 : -1);
      const dark = this.d.scene.add
        .image(x, y, FX.puddle)
        .setScale(scale, Math.abs(scale) * (0.8 + r() * 0.4))
        .setTint(0x5d6878)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setDepth(this.d.depths.shadows)
        .setAlpha(0);
      const sheen = this.d.scene.add
        .image(x, y, FX.puddle)
        .setScale(dark.scaleX * 0.8, dark.scaleY * 0.7)
        .setTint(0x9fb6cc)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.d.depths.shadows)
        .setAlpha(0);
      this.objects.push(dark, sheen);
      this.puddles.push({ x, y, dark, sheen });
    }
  }

  private splashPoint(p: Phaser.Types.Math.Vector2Like): void {
    const v = this.view;
    for (let tries = 0; tries < 4; tries++) {
      const x = v.x + this.r() * v.width;
      const y = v.y + this.r() * v.height;
      const kind = this.d.grid.tiles[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? 'void';
      p.x = x;
      p.y = y;
      if (!NO_SPLASH.has(kind)) return;
    }
  }

  // ── Frame ─────────────────────────────────────────────────────────────────
  /**
   * Advance the weather by `dt` seconds at time `now` (ms); `view` is the
   * camera's view of the world (world units).
   */
  update(dt: number, now: number, view: Rect): void {
    this.view = view;
    this.elapsed += dt;
    this.current = stepWeather(this.current, this.target, dt);
    const m = this.current;
    this.wet = this.reducedMotion ? (m.rain > 0.05 ? 1 : 0) : stepWetness(this.wet, m.rain, dt);
    this.windNow = this.reducedMotion ? m.wind * 0.5 : m.wind * gust(this.elapsed, 3);
    const budget: WeatherBudget =
      this.rain || this.dust
        ? weatherBudget(m, {
            share: this.share,
            viewTiles: (view.width * view.height) / (TILE * TILE),
            indoor: this.d.indoor,
            reducedMotion: this.reducedMotion,
          })
        : NO_WEATHER_FX;
    this.updateRain(budget);
    this.updateWind(budget);
    this.updateSky(budget, dt);
    this.updatePuddles(now);
    this.updateLightning(dt, now);
  }

  private updateRain(b: WeatherBudget): void {
    if (this.rain) flow(this.rain, b.drops / 0.41, b.drops);
    if (this.splashes) flow(this.splashes, b.splashes, b.splashes);
    if (this.ripples) flow(this.ripples, b.ripples * Math.min(1, this.wet * 1.5), b.ripples);
  }

  private updateWind(b: WeatherBudget): void {
    if (this.dust) flow(this.dust, b.dust / 2.3, b.dust);
    if (this.grit) flow(this.grit, (b.dust * 1.6) / 0.68, b.dust * 1.6);
    if (this.leaves) flow(this.leaves, b.leaves / 3.2, b.leaves);
  }

  private updateSky(b: WeatherBudget, dt: number): void {
    const m = this.current;
    const v = this.view;
    const margin = 64;
    const x = v.x - margin;
    const y = v.y - margin;
    const w = v.width + margin * 2;
    const h = v.height + margin * 2;
    // Clouds drift downwind, faster in a storm; rain sheets fall and slant.
    this.drift.x += (12 + 60 * this.windNow) * dt;
    this.drift.y += (3 + 8 * this.windNow) * dt;
    this.sheetFall += FALL * 0.9 * dt;
    const clouds = this.clouds;
    if (clouds) {
      const strength = Math.min(0.85, m.wind * 0.35 + m.cloud * 0.55 + m.storm * 0.1);
      const show = b.cloudShadows && strength > 0.02;
      clouds.setVisible(show);
      if (show) {
        if (clouds.width !== w || clouds.height !== h) clouds.setSize(w, h);
        clouds.setPosition(x, y).setAlpha(strength);
        clouds.setTilePosition((x - this.drift.x) / 5, (y - this.drift.y) / 5);
      }
    }
    const slant = rainSlant(this.windNow);
    this.sheets.forEach((sheet, i) => {
      const show = b.sheets;
      sheet.setVisible(show);
      if (!show) return;
      const speed = i === 0 ? 1.25 : 0.8;
      const scale = i === 0 ? 1.5 : 1;
      if (sheet.width !== w || sheet.height !== h) sheet.setSize(w, h);
      sheet
        .setPosition(x, y)
        .setAlpha(
          Math.min(1, (m.rain - 0.5) * 2) * (i === 0 ? 0.55 : 0.4) * (0.7 + 0.3 * this.windNow),
        );
      sheet.setTilePosition(
        (x - this.sheetFall * slant * speed) / scale,
        (y - this.sheetFall * speed) / scale,
      );
    });
  }

  private updatePuddles(now: number): void {
    const wet = this.wet;
    for (const p of this.puddles) {
      p.dark.setAlpha(wet * 0.55);
      // The sheen catches a little light, and trembles in the rain.
      const tremble = this.reducedMotion ? 0 : Math.sin(now / 170 + p.x) * 0.04 * this.current.rain;
      p.sheen.setAlpha(Math.max(0, wet * (0.22 - 0.1 * this.current.cloud) + tremble));
    }
  }

  private updateLightning(dt: number, now: number): void {
    const m = this.current;
    if (this.reducedMotion) {
      this.flashNow = 0;
      return;
    }
    this.strikeIn -= dt;
    if (this.strikeIn <= 0) {
      this.strikeIn = nextStrikeIn(m.storm, this.r);
      if (Number.isFinite(this.strikeIn)) {
        for (const f of strikePattern(this.r, now)) if (this.gate.allow(f.at)) this.flashes.push(f);
      }
    }
    this.flashes = this.flashes.filter((f) => now - f.at <= f.duration);
    const indoor = this.d.indoor ? 0.35 : 1;
    this.flashNow = flashLevel(this.flashes, now) * MAX_FLASH * indoor * Math.min(1, m.storm * 1.5);
  }

  private destroyObjects(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects.length = 0;
    this.rain = null;
    this.splashes = null;
    this.ripples = null;
    this.dust = null;
    this.grit = null;
    this.leaves = null;
    this.clouds = null;
    this.sheets = [];
    this.puddles.length = 0;
  }

  destroy(): void {
    this.destroyObjects();
    this.flashes = [];
    this.gate.reset();
  }
}

/** Emit about `perSecond` particles, with at most `max` alive. */
function flow(
  e: Phaser.GameObjects.Particles.ParticleEmitter,
  perSecond: number,
  max: number,
): void {
  if (perSecond < 0.5 || max < 1) {
    e.emitting = false;
    return;
  }
  e.maxAliveParticles = Math.ceil(max * 1.15);
  const frequency = 1000 / perSecond;
  if (Math.abs(e.frequency - frequency) > frequency * 0.05) e.frequency = frequency;
  e.emitting = true;
}

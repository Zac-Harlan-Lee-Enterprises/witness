import Phaser from 'phaser';
import type { VirtualInput } from '@/application/input';
import type {
  WorldEntityView,
  WorldLighting,
  WorldListener,
  WorldSceneModel,
} from '@/application/ports';
import {
  approachTiles,
  blockedFn,
  facingToward,
  findPath,
  type Blocked,
  type Tile,
} from '@/domain/navigation';
import type { Direction } from '@/domain/state/game-state';
import { inRect } from '@/domain/world';
import type { Logger } from '@/shared/logger';
import {
  appearanceKey,
  CHAR_H,
  CHAR_W,
  DIRECTION_ROWS,
  frameName,
  FRAMES_PER_DIRECTION,
  paintCharacterSheet,
} from '../art/characters';
import { ART_SCALE, makeCanvas, TILE } from '../art/paint';
import { paintProp } from '../art/props';
import { paintSceneLayers } from '../art/tiles';
import { moveWithCollision, normalise } from '../systems/collision';
import { pickFocus } from '../systems/focus';
import { gradeColors, lightingFor, type Lighting } from '../systems/lighting';
import { INITIAL_QUALITY, lightMatters, stepQuality, type QualityState } from '../systems/quality';

/**
 * The single Phaser scene that renders whichever map the application asks
 * for. It owns ONLY ephemeral presentation state (sprites, camera, walk
 * animation, lighting, ambient effects, current path). It never evaluates
 * story conditions and never touches React: it receives a WorldSceneModel
 * and reports WorldEvents.
 */
export interface WorldSceneOptions {
  input: VirtualInput;
  onEvent: WorldListener;
  logger: Logger;
  onReady: () => void;
}

interface EntitySprite {
  view: WorldEntityView;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
}

const INV = 1 / ART_SCALE;
const WALK_CYCLE = [1, 0, 2, 0];
const DEPTH = {
  ground: 0,
  actors: 10,
  canopy: 100_000,
  fx: 100_500,
  light: 101_000,
  marker: 102_000,
};

export class WorldScene extends Phaser.Scene {
  private model: WorldSceneModel | null = null;
  private blocked: Blocked = () => true;
  private layers: Phaser.GameObjects.GameObject[] = [];
  private sceneTextures: string[] = [];
  private fx: Phaser.GameObjects.GameObject[] = [];
  private tweensOwned: Phaser.Tweens.Tween[] = [];
  private readonly entitySprites = new Map<string, EntitySprite>();
  private player: {
    x: number;
    y: number;
    facing: Direction;
    sprite: Phaser.GameObjects.Sprite | null;
    walk: number;
  } = { x: 0, y: 0, facing: 'down', sprite: null, walk: 0 };
  private focusId: string | null = null;
  private focusMarker: Phaser.GameObjects.Image | null = null;
  /** Colour grade + vignette in one multiply layer (texture redrawn only when the light changes). */
  private light: Phaser.GameObjects.Image | null = null;
  private lampGlow: Phaser.GameObjects.Image | null = null;
  private lighting: WorldLighting = { hour: null, lamp: false };
  private path: Tile[] | null = null;
  private pathTarget: { id: string; kind: 'entity' | 'exit' | 'tile' } | null = null;
  private controlsEnabled = true;
  private reducedMotion = false;
  private tilesPerSecond = 4.5;
  private lastTile = { x: -1, y: -1 };
  private insideExit: string | null = null;
  private generation = 0;
  private elapsed = 0;
  /** Automatic quality: decorative effects are dropped if frames stay slow. */
  private quality: QualityState = INITIAL_QUALITY;
  private fxTweens: Phaser.Tweens.Tween[] = [];

  constructor(private readonly opts: WorldSceneOptions) {
    super('world');
  }

  create(): void {
    this.scale.on('resize', () => this.fitCamera());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.makeSharedTextures();
    this.opts.onReady();
  }

  // ── WorldPort operations (called via the adapter) ───────────────────────
  buildScene(model: WorldSceneModel): void {
    this.clear();
    this.generation++;
    this.model = model;
    this.lighting = model.lighting;

    const { ground, canopies } = paintSceneLayers(model.grid, model.baseTile);
    const groundKey = `ground-${this.generation}`;
    this.textures.addCanvas(groundKey, ground);
    this.sceneTextures.push(groundKey);
    this.layers.push(
      this.add.image(0, 0, groundKey).setOrigin(0, 0).setScale(INV).setDepth(DEPTH.ground),
    );
    canopies.forEach((piece, i) => {
      const key = `canopy-${this.generation}-${i}`;
      this.textures.addCanvas(key, piece.canvas);
      this.sceneTextures.push(key);
      this.layers.push(
        this.add.image(piece.x, piece.y, key).setOrigin(0, 0).setScale(INV).setDepth(DEPTH.canopy),
      );
    });

    this.rebuildBlocked(model.entities);
    model.entities.forEach((e) => this.addEntity(e));

    const pKey = this.ensureCharacterTexture(model.player.appearance);
    this.player = {
      x: model.player.x + 0.5,
      y: model.player.y + 0.5,
      facing: model.player.facing,
      sprite: this.add
        .sprite(0, 0, pKey, frameName(model.player.facing, 0))
        .setOrigin(0.5, 1)
        .setScale(INV),
      walk: 0,
    };
    this.placePlayer();
    this.lastTile = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
    this.insideExit = this.exitAt(this.lastTile.x, this.lastTile.y);

    this.focusMarker = this.add
      .image(0, 0, 'focus-marker')
      .setScale(INV)
      .setDepth(DEPTH.marker)
      .setVisible(false);
    this.focusId = null;
    this.path = null;
    this.pathTarget = null;

    this.buildAtmosphere(model);
    this.fitCamera();
    const cam = this.cameras.main;
    const lerp = this.reducedMotion ? 1 : 0.12;
    cam.startFollow(this.player.sprite as Phaser.GameObjects.Sprite, true, lerp, lerp);
    if (!this.reducedMotion) cam.fadeIn(260, 24, 16, 8);
    this.opts.onEvent({ type: 'sceneReady', sceneId: model.sceneId });
  }

  updateEntities(entities: WorldEntityView[]): void {
    if (!this.model) return;
    this.model = { ...this.model, entities };
    const ids = new Set(entities.map((e) => e.id));
    for (const [id, es] of this.entitySprites) {
      if (!ids.has(id)) {
        this.tweens.killTweensOf(es.sprite);
        es.sprite.destroy();
        this.entitySprites.delete(id);
      }
    }
    entities.forEach((e) => {
      const existing = this.entitySprites.get(e.id);
      if (!existing) this.addEntity(e);
      else existing.view = e;
    });
    this.rebuildBlocked(entities);
  }

  travelTo(targetId: string, instant: boolean): void {
    const model = this.model;
    if (!model) return;
    const entity = model.entities.find((e) => e.id === targetId);
    const exit = model.exits.find((x) => x.id === targetId);
    if (!entity && !exit) return;
    const start = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
    let goals: Tile[];
    if (entity) {
      goals = approachTiles({ x: entity.x, y: entity.y }, entity.solid, this.blocked);
    } else {
      goals = [];
      const x = exit as NonNullable<typeof exit>;
      for (let yy = x.y; yy < x.y + x.h; yy++)
        for (let xx = x.x; xx < x.x + x.w; xx++) goals.push({ x: xx, y: yy });
    }
    const path = findPath(start, goals, this.blocked);
    if (path === null) {
      this.opts.logger.warn(`No path to ${targetId}`);
      this.opts.onEvent({ type: 'unreachable', targetId });
      return;
    }
    const kind = entity ? 'entity' : 'exit';
    if (instant || path.length === 0) {
      // Pass through every tile so triggers along the way still fire in order.
      for (const tile of path) {
        this.player.x = tile.x + 0.5;
        this.player.y = tile.y + 0.5;
        this.afterStep(false);
      }
      const end = path[path.length - 1] ?? start;
      if (entity) this.player.facing = facingToward(end, entity);
      this.placePlayer();
      this.afterStep(true);
      this.finishTravel({ id: targetId, kind });
      return;
    }
    this.path = path;
    this.pathTarget = { id: targetId, kind };
  }

  setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
    if (!enabled) {
      this.path = null;
      this.pathTarget = null;
    }
  }

  setMotion(options: { reducedMotion: boolean; tilesPerSecond: number }): void {
    const changed = this.reducedMotion !== options.reducedMotion;
    this.reducedMotion = options.reducedMotion;
    this.tilesPerSecond = options.tilesPerSecond;
    const lerp = this.reducedMotion ? 1 : 0.12;
    this.cameras.main?.setLerp(lerp, lerp);
    if (changed && this.model) this.buildAtmosphere(this.model);
  }

  setLighting(lighting: WorldLighting): void {
    this.lighting = lighting;
    this.applyLighting();
  }

  // ── Frame loop ──────────────────────────────────────────────────────────
  override update(_time: number, deltaMs: number): void {
    if (!this.model || !this.player.sprite) return;
    if (!this.quality.lowPower) {
      this.quality = stepQuality(this.quality, this.game.loop.rawDelta);
      if (this.quality.lowPower) this.enterLowPower();
    }
    const dt = Math.min(deltaMs, 50) / 1000;
    this.elapsed += dt;
    let moving = false;

    if (this.controlsEnabled) {
      const { dx, dy } = this.opts.input.direction();
      if (dx !== 0 || dy !== 0) {
        this.path = null;
        this.pathTarget = null;
        const n = normalise(dx, dy);
        const step = this.tilesPerSecond * dt;
        const next = moveWithCollision(this.player, n.x * step, n.y * step, this.blocked);
        moving = next.x !== this.player.x || next.y !== this.player.y;
        this.player.x = next.x;
        this.player.y = next.y;
        this.player.facing =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      } else if (this.path && this.path.length > 0) {
        moving = this.followPath(dt);
      }
    }

    this.player.walk = moving ? this.player.walk + dt : 0;
    const frame = moving
      ? (WALK_CYCLE[Math.floor(this.player.walk / 0.12) % WALK_CYCLE.length] ?? 0)
      : 0;
    this.player.sprite.setFrame(frameName(this.player.facing, frame));
    this.placePlayer();
    if (moving) this.afterStep(false);
    this.updateFocus();
    this.animateIdle();
  }

  // ── Movement internals ──────────────────────────────────────────────────
  private followPath(dt: number): boolean {
    const next = this.path?.[0];
    if (!next) return false;
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - this.player.x;
    const dy = ty - this.player.y;
    const dist = Math.hypot(dx, dy);
    const step = this.tilesPerSecond * dt;
    if (Math.abs(dx) > Math.abs(dy)) this.player.facing = dx > 0 ? 'right' : 'left';
    else if (dy !== 0) this.player.facing = dy > 0 ? 'down' : 'up';
    if (dist <= step) {
      this.player.x = tx;
      this.player.y = ty;
      this.path?.shift();
      if (this.path && this.path.length === 0) {
        const target = this.pathTarget;
        this.path = null;
        this.pathTarget = null;
        if (target) {
          this.afterStep(false);
          this.finishTravel(target);
        }
      }
    } else {
      this.player.x += (dx / dist) * step;
      this.player.y += (dy / dist) * step;
    }
    return true;
  }

  private finishTravel(target: { id: string; kind: 'entity' | 'exit' | 'tile' }): void {
    if (target.kind === 'entity') {
      const entity = this.model?.entities.find((e) => e.id === target.id);
      if (entity) {
        const here = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
        if (here.x !== entity.x || here.y !== entity.y)
          this.player.facing = facingToward(here, entity);
        this.placePlayer();
        this.faceNpcToPlayer(entity.id);
      }
      this.opts.onEvent({ type: 'arrived', targetId: target.id });
    } else if (target.kind === 'exit' && this.insideExit === target.id) {
      this.opts.onEvent({ type: 'exitReached', exitId: target.id });
    }
  }

  /** Tile-change bookkeeping: position report, triggers, exits. */
  private afterStep(force: boolean): void {
    const tx = Math.floor(this.player.x);
    const ty = Math.floor(this.player.y);
    if (!force && tx === this.lastTile.x && ty === this.lastTile.y) return;
    const changed = tx !== this.lastTile.x || ty !== this.lastTile.y;
    this.lastTile = { x: tx, y: ty };
    this.opts.onEvent({ type: 'playerMoved', x: tx, y: ty, facing: this.player.facing });
    if (changed) this.opts.onEvent({ type: 'tileEntered', x: tx, y: ty });
    const exit = this.exitAt(tx, ty);
    if (exit && exit !== this.insideExit) {
      this.insideExit = exit;
      this.opts.onEvent({ type: 'exitReached', exitId: exit });
    } else if (!exit) {
      this.insideExit = null;
    }
  }

  private exitAt(x: number, y: number): string | null {
    return this.model?.exits.find((e) => inRect(x, y, e))?.id ?? null;
  }

  private updateFocus(): void {
    const model = this.model;
    if (!model || !this.focusMarker) return;
    const candidates = model.entities.filter((e) => e.interactive);
    const id = this.controlsEnabled ? pickFocus(this.player, candidates) : null;
    if (id !== this.focusId) {
      this.focusId = id;
      this.opts.onEvent({ type: 'focusChanged', entityId: id });
    }
    const focused = id ? this.entitySprites.get(id) : undefined;
    if (!focused) {
      this.focusMarker.setVisible(false);
      return;
    }
    const bob = this.reducedMotion ? 0 : Math.sin(this.elapsed * 4) * 2;
    const top = focused.view.appearance ? CHAR_H - 4 : focused.sprite.displayHeight;
    this.focusMarker
      .setVisible(true)
      .setPosition(focused.sprite.x, focused.sprite.y - top - 6 + bob);
  }

  private animateIdle(): void {
    if (this.reducedMotion) return;
    for (const es of this.entitySprites.values()) {
      if (es.view.kind === 'clue') es.sprite.setAlpha(0.78 + Math.sin(this.elapsed * 3) * 0.22);
    }
    if (this.lampGlow?.visible) {
      this.lampGlow.setScale(
        INV * (1 + Math.sin(this.elapsed * 7) * 0.03 + Math.sin(this.elapsed * 13) * 0.02),
      );
    }
  }

  private placePlayer(): void {
    const s = this.player.sprite;
    if (!s) return;
    s.setPosition(this.player.x * TILE, this.player.y * TILE + 12);
    s.setDepth(DEPTH.actors + this.player.y * 100);
    this.lampGlow?.setPosition(s.x, s.y - 18);
  }

  private addEntity(e: WorldEntityView): void {
    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    if (e.appearance) {
      const key = this.ensureCharacterTexture(e.appearance);
      sprite = this.add.sprite(0, 0, key, frameName(e.facing, 0)).setOrigin(0.5, 1).setScale(INV);
      if (!this.reducedMotion) {
        // A gentle breathing motion so people feel alive (feet stay planted).
        this.tweensOwned.push(
          this.tweens.add({
            targets: sprite,
            scaleY: INV * 1.02,
            duration: 1400 + ((e.x * 37 + e.y * 11) % 600),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
      }
    } else {
      const key = this.ensurePropTexture(e.sprite ?? (e.kind === 'clue' ? 'marker' : 'sign'));
      sprite = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(INV);
    }
    const baseY = (e.y + 1) * TILE + (e.appearance ? 1 : 0);
    sprite.setPosition((e.x + 0.5) * TILE, baseY).setDepth(DEPTH.actors + (e.y + 0.5) * 100);
    this.entitySprites.set(e.id, { view: e, sprite });
  }

  private faceNpcToPlayer(entityId: string): void {
    const es = this.entitySprites.get(entityId);
    if (!es?.view.appearance || !(es.sprite instanceof Phaser.GameObjects.Sprite)) return;
    const dir = facingToward(
      { x: es.view.x, y: es.view.y },
      { x: Math.floor(this.player.x), y: Math.floor(this.player.y) },
    );
    es.sprite.setFrame(frameName(dir, 0));
  }

  // ── Textures ────────────────────────────────────────────────────────────
  private ensureCharacterTexture(appearance: WorldSceneModel['player']['appearance']): string {
    const key = appearanceKey(appearance);
    if (this.textures.exists(key)) return key;
    const tex = this.textures.addCanvas(key, paintCharacterSheet(appearance));
    if (!tex) return key;
    const fw = CHAR_W * ART_SCALE;
    const fh = CHAR_H * ART_SCALE;
    DIRECTION_ROWS.forEach((dir, row) => {
      for (let f = 0; f < FRAMES_PER_DIRECTION; f++)
        tex.add(frameName(dir, f), 0, f * fw, row * fh, fw, fh);
    });
    return key;
  }

  private ensurePropTexture(name: string): string {
    const key = `prop2-${name}`;
    if (this.textures.exists(key)) return key;
    const { canvas, known } = paintProp(name);
    if (!known) this.opts.logger.warn(`Unknown prop sprite '${name}' — using fallback marker`);
    this.textures.addCanvas(key, canvas);
    return key;
  }

  private makeSharedTextures(): void {
    const add = (
      key: string,
      w: number,
      h: number,
      paint: (ctx: CanvasRenderingContext2D) => void,
    ): void => {
      if (this.textures.exists(key)) return;
      const { canvas, ctx } = makeCanvas(w, h);
      if (ctx) paint(ctx);
      this.textures.addCanvas(key, canvas);
    };
    add('focus-marker', 22, 24, (ctx) => {
      ctx.fillStyle = '#fff8e8';
      ctx.strokeStyle = '#6b3f22';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(2, 2, 18, 15, 5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 16.5);
      ctx.lineTo(11, 21.5);
      ctx.lineTo(14, 16.5);
      ctx.fill();
      ctx.fillStyle = '#6b3f22';
      [7, 11, 15].forEach((x) => {
        ctx.beginPath();
        ctx.arc(x, 9.5, 1.4, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    add('mote', 6, 6, (ctx) => {
      const g = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
      g.addColorStop(0, 'rgba(255,245,220,0.9)');
      g.addColorStop(1, 'rgba(255,245,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 6, 6);
    });
    add('bird', 12, 6, (ctx) => {
      ctx.strokeStyle = '#3a2c20';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(1, 4);
      ctx.quadraticCurveTo(3.5, 0.5, 6, 3.5);
      ctx.quadraticCurveTo(8.5, 0.5, 11, 4);
      ctx.stroke();
    });
    add('glint', 32, 32, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 32, 32);
      g.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(230,248,255,0.55)');
      g.addColorStop(0.65, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
    });
    add('lamp-glow', 160, 160, (ctx) => {
      const g = ctx.createRadialGradient(80, 80, 4, 80, 80, 80);
      g.addColorStop(0, 'rgba(255,214,140,0.75)');
      g.addColorStop(0.45, 'rgba(255,170,80,0.28)');
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 160, 160);
    });
  }

  // ── Atmosphere: light, vignette, ambient life ────────────────────────────
  private clearFx(): void {
    this.fxTweens.forEach((t) => t.remove());
    this.fxTweens = [];
    this.fx.forEach((o) => o.destroy());
    this.fx = [];
  }

  private enterLowPower(): void {
    // Recorded in "Copy diagnostics", and visible to tests as data-effects="reduced".
    this.opts.logger.warn('Frame rate is low: switching to simpler effects');
    this.game.canvas.dataset.effects = 'reduced';
    this.clearFx();
    this.applyLighting();
  }

  private buildAtmosphere(model: WorldSceneModel): void {
    this.clearFx();
    this.light?.destroy();
    this.lampGlow?.destroy();

    this.light = this.add.image(0, 0, this.lightTexture()).setScrollFactor(0).setDepth(DEPTH.light);
    this.light.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lampGlow = this.add
      .image(0, 0, 'lamp-glow')
      .setScale(INV)
      .setDepth(DEPTH.light + 1)
      .setVisible(false);
    this.lampGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.applyLighting();

    if (this.reducedMotion || this.quality.lowPower) return;
    const mapW = model.grid.width * TILE;
    const mapH = model.grid.height * TILE;
    if (model.ambience === 'wind' || model.ambience === 'market') {
      const emitter = this.add.particles(0, 0, 'mote', {
        x: { min: 0, max: mapW },
        y: { min: 0, max: mapH },
        lifespan: 7000,
        speedX: { min: model.ambience === 'wind' ? 6 : 1, max: model.ambience === 'wind' ? 16 : 5 },
        speedY: { min: -3, max: 2 },
        scale: { min: 0.25, max: 0.6 },
        alpha: { start: 0.55, end: 0 },
        frequency: model.ambience === 'wind' ? 90 : 220,
        blendMode: 'ADD',
      });
      emitter.setDepth(DEPTH.fx);
      this.fx.push(emitter);
    }
    if (model.ambience === 'oasis') {
      for (let i = 0; i < 4; i++) {
        const bird = this.add
          .image(-20, 20 + i * 40, 'bird')
          .setScale(INV)
          .setDepth(DEPTH.fx)
          .setAlpha(0.8);
        this.fx.push(bird);
        this.fxTweens.push(
          this.tweens.add({
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
    // Water shimmer.
    for (let y = 0; y < model.grid.height; y++) {
      for (let x = 0; x < model.grid.width; x++) {
        if (model.grid.tiles[y]?.[x] !== 'water') continue;
        const glint = this.add
          .image(x * TILE, y * TILE, 'glint')
          .setOrigin(0, 0)
          .setScale(INV)
          .setDepth(DEPTH.ground + 1)
          .setAlpha(0);
        glint.setBlendMode(Phaser.BlendModes.ADD);
        this.fx.push(glint);
        this.fxTweens.push(
          this.tweens.add({
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

  private applyLighting(): void {
    if (!this.model || !this.light) return;
    const l = lightingFor(this.lighting.hour, this.model.kind === 'indoor');
    // In low-power mode only light that means something (dusk, night) is drawn.
    const show = !this.quality.lowPower || lightMatters(l.alpha);
    this.light.setVisible(show);
    if (show) this.paintLight(l);
    this.lampGlow?.setVisible(l.night && this.lighting.lamp);
  }

  private static readonly LIGHT_KEY = 'light-grade';
  private static readonly LIGHT_SIZE = 128;

  private lightTexture(): string {
    const key = WorldScene.LIGHT_KEY;
    if (!this.textures.exists(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = WorldScene.LIGHT_SIZE;
      canvas.height = WorldScene.LIGHT_SIZE;
      this.textures.addCanvas(key, canvas);
    }
    return key;
  }

  /** Redraw the grade texture: `center` colour in the middle, `edge` at the rim. */
  private paintLight(l: Lighting): void {
    const texture = this.textures.get(WorldScene.LIGHT_KEY) as Phaser.Textures.CanvasTexture;
    const ctx = texture.getContext?.();
    if (!ctx) return;
    const size = WorldScene.LIGHT_SIZE;
    const { center, edge } = gradeColors(l);
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.28,
      size / 2,
      size / 2,
      size * 0.72,
    );
    g.addColorStop(0, `rgb(${center.join(',')})`);
    g.addColorStop(1, `rgb(${edge.join(',')})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    texture.refresh();
  }

  private rebuildBlocked(entities: readonly WorldEntityView[]): void {
    if (!this.model) return;
    this.blocked = blockedFn(
      this.model.grid,
      entities.filter((e) => e.solid).map((e) => ({ x: e.x, y: e.y })),
    );
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.controlsEnabled || !this.model) return;
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const tx = Math.floor(world.x / TILE);
    const ty = Math.floor(world.y / TILE);
    const near = this.model.entities
      .filter((e) => e.interactive)
      .map((e) => ({ e, d: Math.hypot(e.x + 0.5 - world.x / TILE, e.y + 0.5 - world.y / TILE) }))
      .filter((x) => x.d < 0.9)
      .sort((a, b) => a.d - b.d)[0];
    if (near) {
      this.travelTo(near.e.id, false);
      return;
    }
    const exit = this.exitAt(tx, ty);
    if (exit) {
      this.travelTo(exit, false);
      return;
    }
    if (this.blocked(tx, ty)) return;
    const path = findPath(
      { x: Math.floor(this.player.x), y: Math.floor(this.player.y) },
      [{ x: tx, y: ty }],
      this.blocked,
    );
    if (path && path.length > 0) {
      this.path = path;
      this.pathTarget = { id: `${tx},${ty}`, kind: 'tile' };
    }
  }

  private fitCamera(): void {
    const model = this.model;
    const cam = this.cameras.main;
    if (!model || !cam) return;
    const w = this.scale.width;
    const h = this.scale.height;
    // Fewer, bigger tiles on phones and portrait tablets (easier to see and tap).
    const portrait = h > w;
    const tilesW = w < 640 ? 9 : portrait ? 12 : 17;
    const tilesH = h < 640 ? 9 : 11;
    const zoom = Math.max(1, Math.min(3, Math.min(w / (tilesW * TILE), h / (tilesH * TILE))));
    cam.setZoom(Math.round(zoom * 4) / 4);
    const mapW = model.grid.width * TILE;
    const mapH = model.grid.height * TILE;
    const viewW = w / cam.zoom;
    const viewH = h / cam.zoom;
    // Center small maps instead of pinning them to the corner.
    const bx = mapW < viewW ? (mapW - viewW) / 2 : 0;
    const by = mapH < viewH ? (mapH - viewH) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mapW, viewW), Math.max(mapH, viewH));
    // Screen-space overlays: sized in world units so they exactly cover the view at this zoom.
    this.light?.setPosition(w / 2, h / 2).setDisplaySize(viewW + 4, viewH + 4);
  }

  private clear(): void {
    this.tweensOwned.forEach((t) => t.remove());
    this.tweensOwned = [];
    this.clearFx();
    this.layers.forEach((l) => l.destroy());
    this.layers = [];
    this.entitySprites.forEach((es) => es.sprite.destroy());
    this.entitySprites.clear();
    this.player.sprite?.destroy();
    this.player.sprite = null;
    this.focusMarker?.destroy();
    this.focusMarker = null;
    this.light?.destroy();
    this.light = null;
    this.lampGlow?.destroy();
    this.lampGlow = null;
    this.sceneTextures.forEach((k) => {
      if (this.textures.exists(k)) this.textures.remove(k);
    });
    this.sceneTextures = [];
  }
}

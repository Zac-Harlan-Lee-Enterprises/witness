import Phaser from 'phaser';
import type { VirtualInput } from '@/application/input';
import type {
  WorldConversation,
  WorldEmphasis,
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
import { FRAME, frameName } from '../art/characters';
import { ART_SCALE, TILE } from '../art/paint';
import { paintProp } from '../art/props';
import { paintScene, type CanopyPiece } from '../art/scene-painter';
import type { LightSpot } from '../art/site';
import { conversationCentre, stepLookAhead, zoomFor, type Vec } from '../systems/camera';
import { moveWithCollision, normalise } from '../systems/collision';
import { pickFocus } from '../systems/focus';
import { gradeColors, lightingFor, type Lighting } from '../systems/lighting';
import { departed } from '../systems/life';
import {
  INITIAL_QUALITY,
  lightMatters,
  restartWarmup,
  stepQuality,
  type QualityState,
} from '../systems/quality';
import { Actors, ensureCharacterTexture } from './actors';
import { AmbientLife } from './ambient';
import { Feedback } from './feedback';
import { makeSharedTextures, TEX } from './textures';

/**
 * The single Phaser scene that renders whichever place the application asks
 * for. It owns ONLY presentation state (sprites, camera, animation, light,
 * ambient life, the current walking path). It never evaluates story
 * conditions and never touches React: it receives a WorldSceneModel and
 * reports WorldEvents.
 *
 * Helpers: Actors (people's behaviour), AmbientLife (crowds, birds, light
 * flicker…), Feedback (focus ring, exits, discovery flourishes).
 */
export interface WorldSceneOptions {
  input: VirtualInput;
  onEvent: WorldListener;
  logger: Logger;
  onReady: () => void;
}

const INV = 1 / ART_SCALE;
const WALK_CYCLE = [FRAME.stepA, FRAME.stand, FRAME.stepB, FRAME.stand];
const DEPTH = {
  ground: 0,
  actors: 10,
  canopy: 100_000,
  fx: 100_500,
  light: 101_000,
  marker: 102_000,
};
const depthFor = (y: number): number => DEPTH.actors + y * 100;

export class WorldScene extends Phaser.Scene {
  private model: WorldSceneModel | null = null;
  private blocked: Blocked = () => true;
  private layers: Phaser.GameObjects.GameObject[] = [];
  private sceneTextures: string[] = [];
  private canopies: Array<{ image: Phaser.GameObjects.Image; piece: CanopyPiece }> = [];
  private lightSpots: LightSpot[] = [];
  private readonly props = new Map<
    string,
    { view: WorldEntityView; image: Phaser.GameObjects.Image }
  >();
  private actors: Actors | null = null;
  private ambient: AmbientLife | null = null;
  private feedback: Feedback | null = null;
  private player: {
    x: number;
    y: number;
    facing: Direction;
    sprite: Phaser.GameObjects.Sprite | null;
    walk: number;
    moving: boolean;
  } = { x: 0, y: 0, facing: 'down', sprite: null, walk: 0, moving: false };
  private focusId: string | null = null;
  /** Colour grade + vignette in one multiply layer (texture redrawn only when the light changes). */
  private light: Phaser.GameObjects.Image | null = null;
  private lampGlow: Phaser.GameObjects.Image | null = null;
  private lighting: WorldLighting = { hour: null, lamp: false };
  private conversation: WorldConversation | null = null;
  private path: Tile[] | null = null;
  private pathTarget: { id: string; kind: 'entity' | 'exit' | 'tile' } | null = null;
  private controlsEnabled = true;
  private reducedMotion = false;
  private tilesPerSecond = 4.5;
  private lastTile = { x: -1, y: -1 };
  private insideExit: string | null = null;
  private generation = 0;
  private lookAhead: Vec = { x: 0, y: 0 };
  private cameraCentre: Vec | null = null;
  /** Automatic quality: decorative effects are dropped if frames stay slow. */
  private quality: QualityState = INITIAL_QUALITY;

  constructor(private readonly opts: WorldSceneOptions) {
    super('world');
  }

  create(): void {
    this.scale.on('resize', () => this.fitCamera());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    makeSharedTextures(this.textures);
    this.opts.onReady();
  }

  // ── WorldPort operations (called via the adapter) ───────────────────────
  buildScene(model: WorldSceneModel): void {
    this.clear();
    this.generation++;
    this.model = model;
    this.lighting = model.lighting;
    const still = this.reducedMotion;

    const painted = paintScene(model.grid, model.baseTile, model.mood, model.kind === 'indoor');
    this.lightSpots = painted.lights;
    const groundKey = `ground-${this.generation}`;
    this.textures.addCanvas(groundKey, painted.ground);
    this.sceneTextures.push(groundKey);
    this.layers.push(
      this.add.image(0, 0, groundKey).setOrigin(0, 0).setScale(INV).setDepth(DEPTH.ground),
    );
    painted.canopies.forEach((piece, i) => {
      const key = `canopy-${this.generation}-${i}`;
      this.textures.addCanvas(key, piece.canvas);
      this.sceneTextures.push(key);
      const image = this.add
        .image(piece.x, piece.y, key)
        .setOrigin(0, 0)
        .setScale(INV)
        .setDepth(DEPTH.canopy);
      this.layers.push(image);
      this.canopies.push({ image, piece });
    });

    this.actors = new Actors(this, depthFor, () => this.reducedMotion);
    this.feedback = new Feedback(
      this,
      { ground: DEPTH.ground, marker: DEPTH.marker },
      () => this.reducedMotion,
    );
    this.rebuildBlocked(model.entities);
    model.entities.forEach((e) => this.addEntity(e));

    const pKey = ensureCharacterTexture(this, model.player.appearance);
    this.player = {
      x: model.player.x + 0.5,
      y: model.player.y + 0.5,
      facing: model.player.facing,
      sprite: this.add
        .sprite(0, 0, pKey, frameName(model.player.facing, 0))
        .setOrigin(0.5, 1)
        .setScale(INV),
      walk: 0,
      moving: false,
    };
    this.placePlayer();
    this.lastTile = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
    this.insideExit = this.exitAt(this.lastTile.x, this.lastTile.y);
    this.focusId = null;
    this.path = null;
    this.pathTarget = null;
    this.lookAhead = { x: 0, y: 0 };
    this.cameraCentre = null;
    this.quality = restartWarmup(this.quality);

    this.feedback.build(model);
    this.buildLight();
    this.buildAmbient();
    this.fitCamera();
    this.updateCamera(1);
    const cam = this.cameras.main;
    if (!still) {
      // Arrival: fade up from dark while the view settles in slightly.
      cam.fadeIn(420, 24, 16, 8);
      const zoom = cam.zoom;
      cam.setZoom(zoom * 1.06);
      this.tweens.add({ targets: cam, zoom, duration: 900, ease: 'Sine.easeOut' });
    }
    this.opts.onEvent({ type: 'sceneReady', sceneId: model.sceneId });
  }

  updateEntities(entities: WorldEntityView[]): void {
    if (!this.model) return;
    this.model = { ...this.model, entities };
    const ids = new Set(entities.map((e) => e.id));
    for (const [id, p] of this.props) {
      if (!ids.has(id)) {
        p.image.destroy();
        this.props.delete(id);
      }
    }
    const actors = this.actors;
    for (const e of this.model.entities) {
      if (actors?.has(e.id)) actors.setView(e);
      else if (this.props.has(e.id)) {
        const p = this.props.get(e.id);
        if (p) p.view = e;
      } else this.addEntity(e);
    }
    // People who are no longer in the scene (e.g. someone who left with you).
    if (actors) departed(actors.ids(), entities).forEach((id) => actors.remove(id));
    this.feedback?.syncClues(entities);
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
    if (changed && this.model) this.buildAmbient();
  }

  setLighting(lighting: WorldLighting): void {
    this.lighting = lighting;
    this.applyLighting();
  }

  setConversation(conversation: WorldConversation | null): void {
    this.conversation = conversation;
    this.actors?.setConversation(conversation, this.time.now);
    if (conversation?.with) this.actors?.faceNow(conversation.with, this.mover());
  }

  emphasize(emphasis: WorldEmphasis): void {
    const at = (emphasis.at && this.anchorFor(emphasis.at)) || this.playerAnchor();
    if (at) this.feedback?.emphasize(emphasis, at);
  }

  // ── Frame loop ──────────────────────────────────────────────────────────
  override update(time: number, deltaMs: number): void {
    if (!this.model || !this.player.sprite) return;
    if (!this.quality.lowPower) {
      this.quality = stepQuality(this.quality, this.game.loop.rawDelta);
      if (this.quality.lowPower) this.enterLowPower();
    }
    const dt = Math.min(deltaMs, 50) / 1000;
    let moving = false;
    let dir: Vec = { x: 0, y: 0 };

    if (this.controlsEnabled) {
      const { dx, dy } = this.opts.input.direction();
      if (dx !== 0 || dy !== 0) {
        this.path = null;
        this.pathTarget = null;
        const n = normalise(dx, dy);
        const step = this.tilesPerSecond * dt;
        const next = moveWithCollision(this.player, n.x * step, n.y * step, this.blocked);
        moving = next.x !== this.player.x || next.y !== this.player.y;
        if (moving) dir = { x: n.x, y: n.y };
        this.player.x = next.x;
        this.player.y = next.y;
        this.player.facing =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      } else if (this.path && this.path.length > 0) {
        const before = { x: this.player.x, y: this.player.y };
        moving = this.followPath(dt);
        const len = Math.hypot(this.player.x - before.x, this.player.y - before.y);
        if (len > 0)
          dir = { x: (this.player.x - before.x) / len, y: (this.player.y - before.y) / len };
      }
    }

    this.player.moving = moving;
    this.player.walk = moving ? this.player.walk + dt : 0;
    const walkFrame =
      WALK_CYCLE[Math.floor(this.player.walk / 0.12) % WALK_CYCLE.length] ?? FRAME.stand;
    const frame = this.actors?.playerFrame(time, this.mover(), walkFrame) ?? walkFrame;
    this.player.sprite.setFrame(frameName(this.player.facing, frame));
    this.placePlayer();
    if (moving) this.afterStep(false);

    this.actors?.update(time, this.mover());
    this.updateFocus();
    this.ambient?.update(dt);
    this.feedback?.update(dt, this.player);
    if (!this.reducedMotion) this.lookAhead = stepLookAhead(this.lookAhead, dir, dt);
    this.updateCamera(dt);
    if (this.lampGlow?.visible && !this.reducedMotion) {
      const t = time / 1000;
      this.lampGlow.setScale(INV * (1 + Math.sin(t * 7) * 0.03 + Math.sin(t * 13) * 0.02));
    }
  }

  // ── Camera ──────────────────────────────────────────────────────────────
  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    if (!cam || !this.player.sprite) return;
    const px = this.player.x * TILE;
    const py = this.player.y * TILE;
    let target: Vec;
    const c = this.conversation;
    if (c) {
      const partner = c.with ? this.anchorFor(c.with) : null;
      // The dialogue box covers roughly the bottom third (more on small screens).
      const box = this.scale.height < 700 ? 0.42 : 0.34;
      target = conversationCentre(
        { x: px, y: py - 20 },
        partner ? { x: partner.x, y: partner.y - 20 } : null,
        cam.height / cam.zoom,
        box,
      );
    } else {
      target = { x: px + this.lookAhead.x, y: py - 8 + this.lookAhead.y };
    }
    const snap = this.reducedMotion || !this.cameraCentre || dt >= 1;
    const k = snap ? 1 : 1 - Math.exp(-dt * (c ? 3 : 6));
    const from = this.cameraCentre ?? target;
    this.cameraCentre = {
      x: from.x + (target.x - from.x) * k,
      y: from.y + (target.y - from.y) * k,
    };
    cam.centerOn(this.cameraCentre.x, this.cameraCentre.y);
  }

  private fitCamera(): void {
    const model = this.model;
    const cam = this.cameras.main;
    if (!model || !cam) return;
    const w = this.scale.width;
    const h = this.scale.height;
    cam.setZoom(zoomFor(w, h));
    const mapW = model.grid.width * TILE;
    const mapH = model.grid.height * TILE;
    const viewW = w / cam.zoom;
    const viewH = h / cam.zoom;
    // Centre small maps instead of pinning them to the corner.
    const bx = mapW < viewW ? (mapW - viewW) / 2 : 0;
    const by = mapH < viewH ? (mapH - viewH) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mapW, viewW), Math.max(mapH, viewH));
    // The light layer is screen-space, sized in world units to cover the view at this zoom.
    this.light?.setPosition(w / 2, h / 2).setDisplaySize(viewW * 1.1 + 4, viewH * 1.1 + 4);
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
        this.actors?.faceNow(entity.id, this.mover());
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
    if (!model) return;
    const candidates = model.entities.filter((e) => e.interactive);
    const id = this.controlsEnabled ? pickFocus(this.player, candidates) : null;
    if (id !== this.focusId) {
      this.focusId = id;
      this.opts.onEvent({ type: 'focusChanged', entityId: id });
    }
    const view = id ? model.entities.find((e) => e.id === id) : undefined;
    const anchor = id ? this.anchorFor(id) : null;
    this.feedback?.focus(view && anchor ? { ...anchor, verb: view.verb } : null);
  }

  private mover(): { x: number; y: number; facing: Direction; moving: boolean } {
    return {
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      moving: this.player.moving,
    };
  }

  private placePlayer(): void {
    const s = this.player.sprite;
    if (!s) return;
    s.setPosition(this.player.x * TILE, this.player.y * TILE + 12);
    s.setDepth(depthFor(this.player.y));
    this.lampGlow?.setPosition(s.x, s.y - 18);
  }

  private playerAnchor(): { x: number; y: number; top: number } | null {
    const s = this.player.sprite;
    return s ? { x: s.x, y: s.y, top: 40 } : null;
  }

  /** Where something stands (feet) and how tall it is, in world units. */
  private anchorFor(id: string): { x: number; y: number; top: number } | null {
    const actor = this.actors?.sprite(id);
    if (actor) {
      const view = this.model?.entities.find((e) => e.id === id);
      const top = view?.pose === 'lie' ? 18 : view?.pose === 'sit' ? 30 : 42;
      return { x: actor.x, y: view ? (view.y + 1) * TILE : actor.y, top };
    }
    const prop = this.props.get(id);
    if (prop)
      return { x: prop.image.x, y: prop.image.y, top: Math.max(14, prop.image.displayHeight - 6) };
    return null;
  }

  private addEntity(e: WorldEntityView): void {
    if (e.appearance) {
      this.actors?.add(e);
      return;
    }
    const key = this.ensurePropTexture(e.sprite ?? (e.kind === 'clue' ? 'marker' : 'sign'));
    const image = this.add
      .image((e.x + 0.5) * TILE, (e.y + 1) * TILE, key)
      .setOrigin(0.5, 1)
      .setScale(INV)
      .setDepth(depthFor(e.y + 0.5));
    this.props.set(e.id, { view: e, image });
  }

  private ensurePropTexture(name: string): string {
    const key = `prop3-${name}`;
    if (this.textures.exists(key)) return key;
    const { canvas, known } = paintProp(name);
    if (!known) this.opts.logger.warn(`Unknown prop sprite '${name}' — using fallback marker`);
    this.textures.addCanvas(key, canvas);
    return key;
  }

  // ── Light and ambient life ──────────────────────────────────────────────
  private buildLight(): void {
    this.light?.destroy();
    this.lampGlow?.destroy();
    this.light = this.add.image(0, 0, this.lightTexture()).setScrollFactor(0).setDepth(DEPTH.light);
    this.light.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lampGlow = this.add
      .image(0, 0, TEX.glow)
      .setScale(INV)
      .setDepth(DEPTH.light + 1)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.applyLighting();
  }

  private buildAmbient(): void {
    const model = this.model;
    if (!model) return;
    this.ambient?.destroy();
    this.ambient = new AmbientLife({
      scene: this,
      model,
      canopies: this.canopies,
      lights: this.lightSpots,
      blocked: () => this.blocked,
      player: () => ({ x: this.player.x, y: this.player.y }),
      depthFor,
      depths: { ground: DEPTH.ground, fx: DEPTH.fx, light: DEPTH.light },
      reducedMotion: this.reducedMotion,
      lowPower: this.quality.lowPower,
    });
  }

  private enterLowPower(): void {
    // Recorded in "Copy diagnostics", and visible to tests as data-effects="reduced".
    this.opts.logger.warn('Frame rate is low: switching to simpler effects');
    this.game.canvas.dataset.effects = 'reduced';
    this.ambient?.reduce();
    this.applyLighting();
  }

  private applyLighting(): void {
    if (!this.model || !this.light) return;
    const base = lightingFor(this.lighting.hour, this.model.kind === 'indoor');
    const l = this.withMood(base);
    // In low-power mode only light that means something (dusk, night) is drawn.
    const show = !this.quality.lowPower || lightMatters(l.alpha);
    this.light.setVisible(show);
    if (show) this.paintLight(l);
    this.lampGlow?.setVisible(l.night && this.lighting.lamp);
  }

  /** The place's own light: warmer at home and in Jericho, harsher on the open road. */
  private withMood(l: Lighting): Lighting {
    const mood = this.model?.mood;
    if (mood === 'home') return { ...l, vignette: Math.max(l.vignette, 0.62) };
    if (mood === 'wilderness') return { ...l, vignette: Math.min(l.vignette, 0.24) };
    if (mood === 'oasis' && !l.night)
      return { ...l, tint: 0xffe2a8, alpha: Math.max(l.alpha, 0.1) };
    return l;
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

  private clear(): void {
    this.ambient?.destroy();
    this.ambient = null;
    this.feedback?.destroy();
    this.feedback = null;
    this.actors?.clear();
    this.actors = null;
    this.props.forEach((p) => p.image.destroy());
    this.props.clear();
    this.layers.forEach((l) => l.destroy());
    this.layers = [];
    this.canopies = [];
    this.player.sprite?.destroy();
    this.player.sprite = null;
    this.light?.destroy();
    this.light = null;
    this.lampGlow?.destroy();
    this.lampGlow = null;
    this.conversation = null;
    this.sceneTextures.forEach((k) => {
      if (this.textures.exists(k)) this.textures.remove(k);
    });
    this.sceneTextures = [];
  }
}

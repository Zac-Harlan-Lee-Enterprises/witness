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
import type { Appearance } from '@/domain/characters';
import type { Direction } from '@/domain/state/game-state';
import type { LookMark, Pose, Weather } from '@/domain/world';
import { inRect } from '@/domain/world';
import type { Logger } from '@/shared/logger';
import { lookFor, shadowOffset } from '../art/direction';
import { ART_SCALE, TILE } from '../art/paint';
import { headTop, isFootfall, walkColumn, WALK_CYCLE_TILES } from '../art/people/rig';
import { frameName } from '../art/people/sheet';
import { FX, makeFxTextures } from '../fx/fx-textures';
import { POST_FX_KEY, WorldPostFX } from '../fx/post-fx';
import { bytesPerPixel, compactTexture } from '../phaser/compact-textures';
import { WaterSurface } from '../fx/water-surface';
import { WeatherLayer } from '../fx/weather-layer';
import {
  fixCanvasBlendModes,
  releaseUnusedTargets,
  registerPostFx,
  rendererInfo,
  type RendererInfo,
} from '../phaser/renderer';
import type { Viewport } from '../phaser/viewport';
import { CanopyFader } from '../prerendered/canopy';
import { prepareArt, type FigureBook } from '../prerendered/figures';
import type { PlaceTextures } from '../prerendered/loader';
import type { ArtSprite } from '../prerendered/manifest';
import { depthRow, firstVariant, sampleShade, shadeTint, turnPath } from '../prerendered/select';
import { paintProp } from '../art/props';
import { paintScene, type CanopyPiece } from '../art/scene-painter';
import type { LightSpot } from '../art/site';
import {
  conversationCentre,
  framingFor,
  stepLookAhead,
  zoomFor,
  type Framing,
  type Vec,
} from '../systems/camera';
import { moveWithCollision, normalise } from '../systems/collision';
import { pickFocus } from '../systems/focus';
import { gradeFor } from '../systems/grade';
import { gradeColors, lightingFor, type Lighting } from '../systems/lighting';
import { departed } from '../systems/life';
import {
  chosenLevel,
  effectsFor,
  effectsLabel,
  INITIAL_QUALITY,
  lightMatters,
  restartWarmup,
  stepQuality,
  type EffectsLevel,
  type QualityState,
} from '../systems/quality';
import { wantsCompactGround } from '../systems/resolution';
import { overcast, WEATHER_MIX, type WeatherMix } from '../systems/weather';
import { sunForWater, waterLook, waterSky } from '../systems/water';
import {
  Actors,
  addCastShadow,
  addRenderedFigure,
  ensureFigureTexture,
  FEET_BELOW_CENTRE,
  SEAT_BELOW_CENTRE,
  RENDERED_SHADOW_ALPHA,
  STAND_ORIGIN_Y,
  TURN_STEP_MS,
  turnFrame,
  type RenderedFigure,
  type ShadowCast,
} from './actors';
import { AmbientLife } from './ambient';
import { Feedback } from './feedback';
import { makeSharedTextures } from './textures';

/**
 * The single Phaser scene that renders whichever place the application asks
 * for. It owns ONLY presentation state (sprites, camera, animation, light,
 * weather, ambient life, the current walking path). It never evaluates story
 * conditions and never touches React: it receives a WorldSceneModel and
 * reports WorldEvents.
 *
 * Helpers: Actors (people's behaviour), AmbientLife (crowds, birds, light
 * flicker, swaying trees…), Feedback (focus ring, exits, discovery
 * flourishes), WeatherLayer (rain, wind, storms), WaterSurface (live water)
 * and the camera's post-processing (WorldPostFX).
 */
export interface WorldSceneOptions {
  input: VirtualInput;
  onEvent: WorldListener;
  logger: Logger;
  onReady: () => void;
  framing: Framing;
  /** Force a lighting variant for pre-rendered places ('auto': follow the story clock). */
  artLighting: 'auto' | 'day' | 'late';
  /** Force the weather everywhere (review builds); null follows the story. */
  forceWeather: Weather | null;
  highContrast: boolean;
  /** The player asked for simpler visual effects (the lowest quality level). */
  simpleEffects: boolean;
  /** The canvas's size and render resolution (device pixels per CSS pixel). */
  viewport: Viewport;
}

const INV = 1 / ART_SCALE;
const DEPTH = {
  ground: 0,
  water: 0.5,
  shadows: 5,
  actors: 10,
  canopy: 100_000,
  fx: 100_500,
  light: 101_000,
  marker: 102_000,
};
const depthFor = (y: number): number => DEPTH.actors + y * 100;
/** Gap above a head for the symbol over a person (its pointer hangs 2.5 units below the anchor's top). */
const MARK_CLEARANCE = 4;
/** Pre-rendered sprites that sway in the wind (by id prefix). */
const TREE_SPRITE = /^(olive|palm|fig)-/;

export class WorldScene extends Phaser.Scene {
  private model: WorldSceneModel | null = null;
  private blocked: Blocked = () => true;
  private layers: Phaser.GameObjects.GameObject[] = [];
  private sceneTextures: string[] = [];
  private canopies: Array<{ image: Phaser.GameObjects.Image; piece: CanopyPiece }> = [];
  private trees: Phaser.GameObjects.Image[] = [];
  private lightSpots: LightSpot[] = [];
  private readonly props = new Map<
    string,
    { view: WorldEntityView; image: Phaser.GameObjects.Image }
  >();
  private actors: Actors | null = null;
  private ambient: AmbientLife | null = null;
  private feedback: Feedback | null = null;
  private weather: WeatherLayer | null = null;
  private water: WaterSurface | null = null;
  private weatherNow: Weather = 'clear';
  private player: {
    x: number;
    y: number;
    facing: Direction;
    sprite: Phaser.GameObjects.Sprite | null;
    shadow: Phaser.GameObjects.Sprite | null;
    /** Tiles walked, which drives the walk cycle (so feet keep pace with the ground). */
    walked: number;
    column: number;
    moving: boolean;
  } = {
    x: 0,
    y: 0,
    facing: 'down',
    sprite: null,
    shadow: null,
    walked: 0,
    column: 0,
    moving: false,
  };
  private playerMarks: WorldSceneModel['player']['marks'] = [];
  private cast: ShadowCast | null = null;
  /** Pre-rendered art for the place being shown (null: it is painted). */
  private place: PlaceTextures | null = null;
  private book: FigureBook | null = null;
  private canopyFader: CanopyFader | null = null;
  private entitySprites = new Map<string, ArtSprite>();
  private playerFigure: RenderedFigure | null = null;
  private playerTurn: { frames: string[]; next: number } = { frames: [], next: 0 };
  private playerLight = 1;
  private focusId: string | null = null;
  /** Colour grade + vignette in one multiply layer (texture redrawn only when the light changes). */
  private light: Phaser.GameObjects.Image | null = null;
  private lightKey = '';
  private lampGlow: Phaser.GameObjects.Image | null = null;
  private lighting: WorldLighting = { hour: null, lamp: false };
  /** Lightning without post-processing: a brief additive wash over the view. */
  private flashOverlay: Phaser.GameObjects.Image | null = null;
  private conversation: WorldConversation | null = null;
  private path: Tile[] | null = null;
  private pathTarget: { id: string; kind: 'entity' | 'exit' | 'tile' } | null = null;
  private controlsEnabled = true;
  private reducedMotion = false;
  private highContrast: boolean;
  private simpleEffects: boolean;
  private tilesPerSecond = 4.5;
  private lastTile = { x: -1, y: -1 };
  private insideExit: string | null = null;
  private generation = 0;
  private lookAhead: Vec = { x: 0, y: 0 };
  private cameraCentre: Vec | null = null;
  /** Automatic quality: effects are simplified step by step if frames stay slow. */
  private quality: QualityState = INITIAL_QUALITY;
  private gpu: RendererInfo = { webgl: false, software: true };
  private postFx: WorldPostFX | null = null;
  /** Seconds of animated time (stands still with reduced motion). */
  private clock = 0;
  private statsAt = 0;
  private viewKey = '';

  constructor(private readonly opts: WorldSceneOptions) {
    super('world');
    this.highContrast = opts.highContrast;
    this.simpleEffects = opts.simpleEffects;
    if (opts.simpleEffects) this.quality = chosenLevel('low');
  }

  create(): void {
    this.scale.on('resize', () => this.fitCamera());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.gpu = rendererInfo(this.game);
    // Without a GPU every pixel costs CPU: start without post-processing or
    // full-screen weather layers (the lite level), and step down from there.
    if (this.gpu.software && this.quality.level === 'full') this.quality = chosenLevel('lite');
    registerPostFx(this.game);
    releaseUnusedTargets(this.game);
    fixCanvasBlendModes(this.game);
    this.opts.viewport.setCap(this.maxResolution(this.quality.level));
    makeSharedTextures(this.textures);
    makeFxTextures(this.textures);
    this.game.canvas.dataset.effects = effectsLabel(this.quality.level);
    this.game.canvas.dataset.renderer = this.gpu.webgl
      ? this.gpu.software
        ? 'webgl-software'
        : 'webgl'
      : 'canvas';
    this.opts.onReady();
  }

  // ── WorldPort operations (called via the adapter) ───────────────────────
  /**
   * Load pre-rendered art for the place, if it has any, before building it:
   * the ground and sprite atlases for the time of day, and sheets for the
   * people who will be shown. Anything missing falls back to painting.
   */
  async prepare(model: WorldSceneModel): Promise<void> {
    const vp = this.opts.viewport;
    // The art's resolution is chosen for the canvas pixels it will cover.
    const zoom = zoomFor(vp.cssWidth, vp.cssHeight, framingFor(this.opts.framing, 3)) * vp.ratio;
    const forced = this.opts.artLighting;
    const hour = forced === 'late' ? 24 : forced === 'day' ? 8 : model.lighting.hour;
    const art = await prepareArt(
      this,
      model,
      { hour, zoom, lowPower: this.quality.lowPower },
      this.opts.logger,
    );
    this.place = art.place;
    this.book = art.book;
    this.compactArt();
  }

  /**
   * Smaller GPU formats for art that doesn't need RGBA: people's multiplied
   * shadow sheets (one channel) and, on phones, tablets and low-memory
   * devices, the opaque ground (RGB 5-6-5).
   */
  private compactArt(): void {
    const compactGround = wantsCompactGround({
      coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      lowPower: this.quality.lowPower,
    });
    if (this.place && compactGround)
      for (const tile of this.place.ground)
        compactTexture(this.game, this.textures, tile.key, 'rgb565');
    for (const key of this.book?.shadowKeys() ?? [])
      compactTexture(this.game, this.textures, key, 'luminance');
  }

  /** Close framing only where the place's art has the resolution for it. */
  private framing(): Framing {
    const place = this.place?.art.scene === this.model?.sceneId ? this.place : null;
    return framingFor(this.opts.framing, place ? place.art.ppu : ART_SCALE);
  }

  private figureFor(
    appearance: Appearance,
    marks: readonly LookMark[],
    pose: Pose = 'stand',
  ): RenderedFigure | null {
    const rag = this.model?.player.appearance.robe ?? null;
    return this.book?.figure(appearance, marks, pose, rag) ?? null;
  }

  private sunAt = (x: number, y: number): number => {
    const p = this.place;
    const m = this.model;
    if (!p?.shade || !m) return 1;
    return sampleShade(p.shade, x, y, m.grid.width * TILE, m.grid.height * TILE);
  };

  buildScene(model: WorldSceneModel): void {
    this.clear();
    this.generation++;
    this.model = model;
    this.lighting = model.lighting;
    const still = this.reducedMotion;

    const place = this.place?.art.scene === model.sceneId ? this.place : null;
    this.entitySprites = new Map();
    if (place) this.buildFromArt(place);
    else this.paintPlace(model);
    // Visible to diagnostics and tests: how this place is being drawn.
    this.game.canvas.dataset.art = place ? `prerendered:${place.variant}` : 'painted';
    this.game.canvas.dataset.artPpu = String(place ? place.groundPpu : ART_SCALE);

    this.cast = castFor(model);
    this.actors = new Actors(
      this,
      depthFor,
      () => this.reducedMotion,
      model.player.appearance.robe,
      this.cast,
      DEPTH.shadows,
      (view) => (view.appearance ? this.figureFor(view.appearance, view.marks, view.pose) : null),
      place ? this.sunAt : null,
    );
    this.feedback = new Feedback(
      this,
      { ground: DEPTH.ground, marker: DEPTH.marker },
      () => this.reducedMotion,
    );
    this.rebuildBlocked(model.entities);
    model.entities.forEach((e) => this.addEntity(e));

    this.playerMarks = model.player.marks;
    this.player = {
      x: model.player.x + 0.5,
      y: model.player.y + 0.5,
      facing: model.player.facing,
      sprite: null,
      shadow: null,
      walked: 0,
      column: 0,
      moving: false,
    };
    this.makePlayerSprite();
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
    this.buildWater(model, place !== null);
    this.buildWeather(model);
    this.buildLight();
    this.buildAmbient();
    this.applyPostFx();
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
    this.releaseUnusedTextures();
    this.game.canvas.dataset.textureMb = textureMegabytes(this.textures).toFixed(1);
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

  /**
   * The weather the story asks for (or the review build forces). Recorded on
   * the canvas (`data-weather`) for tests and diagnostics; the world eases
   * into it — a storm rises over a few seconds and calms more slowly.
   */
  setWeather(weather: Weather): void {
    const w = this.opts.forceWeather ?? weather;
    this.weatherNow = w;
    if (this.game?.canvas) this.game.canvas.dataset.weather = w;
    this.weather?.setWeather(w);
  }

  /**
   * Display settings from the player: high contrast keeps the world bright
   * and clear; simpler effects drop to the lowest quality level (and turning
   * them off again lets the world measure afresh).
   */
  setDisplay(options: { highContrast: boolean; simpleEffects: boolean }): void {
    if (options.highContrast !== this.highContrast) {
      this.highContrast = options.highContrast;
      this.lightKey = '';
      this.applyLighting();
    }
    if (options.simpleEffects !== this.simpleEffects) {
      this.simpleEffects = options.simpleEffects;
      const level = options.simpleEffects ? 'low' : 'full';
      this.quality = chosenLevel(level);
      this.onQualityLevel(level, false);
      // Rebuild what the level decides at build time (crowds, decoration).
      if (this.model) this.buildAmbient();
    }
  }

  setPlayerMarks(marks: WorldSceneModel['player']['marks']): void {
    this.playerMarks = marks;
    if (!this.player.sprite || !this.model) return;
    this.makePlayerSprite();
  }

  /** The player's sprite and shadow: pre-rendered if there's a sheet, painted otherwise. */
  private makePlayerSprite(): void {
    const model = this.model;
    if (!model) return;
    const frame = this.player.sprite?.frame.name ?? frameName(this.player.facing, 0);
    this.player.sprite?.destroy();
    this.player.shadow?.destroy();
    const fig = this.figureFor(model.player.appearance, this.playerMarks);
    this.playerFigure = fig;
    if (fig) {
      const made = addRenderedFigure(this, fig, frame, DEPTH.shadows);
      this.player.sprite = made.sprite;
      this.player.shadow = made.shadow;
    } else {
      const key = this.playerTexture();
      this.player.sprite = this.add
        .sprite(0, 0, key, frame)
        .setOrigin(0.5, STAND_ORIGIN_Y)
        .setScale(INV);
      this.player.shadow = this.cast
        ? addCastShadow(this, key, frame, this.cast, STAND_ORIGIN_Y, DEPTH.shadows)
        : null;
    }
    this.placePlayer();
  }

  private playerTexture(): string {
    const appearance = this.model?.player.appearance;
    if (!appearance) return '__MISSING';
    return ensureFigureTexture(this, appearance, this.playerMarks, appearance.robe);
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
    if (changed && this.model) {
      this.buildAmbient();
      this.weather?.setMotion(this.reducedMotion);
    }
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
      const level = this.quality.level;
      this.quality = stepQuality(
        this.quality,
        this.game.loop.rawDelta,
        this.opts.viewport.ratio > 1,
      );
      if (this.quality.level !== level) this.onQualityLevel(this.quality.level);
    }
    const dt = Math.min(deltaMs, 50) / 1000;
    if (!this.reducedMotion) this.clock += dt;
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
    if (moving) this.player.walked += this.tilesPerSecond * dt;
    else this.player.walked = 0;
    const walkCol = walkColumn(this.player.walked, WALK_CYCLE_TILES.player);
    const frame = this.actors?.playerFrame(time, this.mover(), walkCol) ?? walkCol;
    if (moving && frame !== this.player.column && isFootfall(frame)) this.footfall();
    this.player.column = frame;
    let name = frameName(this.player.facing, frame);
    if (this.playerTurn.frames.length > 0) {
      if (moving) this.playerTurn.frames = [];
      else {
        if (time >= this.playerTurn.next) {
          this.playerTurn.frames.shift();
          this.playerTurn.next = time + TURN_STEP_MS;
        }
        name = this.playerTurn.frames[0] ?? name;
      }
    }
    this.player.sprite.setFrame(name);
    this.player.shadow?.setFrame(name);
    this.canopyFader?.update(this.player.sprite.x, this.player.sprite.y, dt);
    if (this.playerFigure && this.place) {
      const target = this.sunAt(this.player.sprite.x, this.player.sprite.y);
      this.playerLight += (target - this.playerLight) * 0.2;
      this.player.sprite.setTint(shadeTint(this.playerLight));
      this.player.shadow?.setAlpha(RENDERED_SHADOW_ALPHA * this.playerLight);
    }
    this.placePlayer();
    if (moving) this.afterStep(false);

    this.actors?.update(time, this.mover());
    this.updateFocus();
    this.ambient?.update(dt);
    this.feedback?.update(dt, this.player);
    if (!this.reducedMotion) this.lookAhead = stepLookAhead(this.lookAhead, dir, dt);
    this.updateCamera(dt);
    // Weather eases in wall-clock time (a storm takes as long on a slow device).
    this.updateWeather(Math.min(this.game.loop.rawDelta, 250) / 1000, time);
    if (this.lampGlow?.visible && !this.reducedMotion) {
      const t = time / 1000;
      const flicker = 1 + Math.sin(t * 7) * 0.03 + Math.sin(t * 13) * 0.02;
      this.lampGlow.setScale(this.lampScale * flicker);
    }
  }

  // ── Weather, water and post-processing ──────────────────────────────────
  private buildWeather(model: WorldSceneModel): void {
    this.weatherNow = this.opts.forceWeather ?? model.weather;
    this.game.canvas.dataset.weather = this.weatherNow;
    this.weather = new WeatherLayer({
      scene: this,
      grid: model.grid,
      mood: model.mood,
      indoor: model.kind === 'indoor',
      depths: { ground: DEPTH.ground, shadows: DEPTH.shadows, fx: DEPTH.fx, light: DEPTH.light },
      initial: this.weatherNow,
      reducedMotion: this.reducedMotion,
      share: effectsFor(this.quality.level).weather,
      // Puddles are tinted; the Canvas renderer can't tint.
      puddles: this.gpu.webgl,
    });
  }

  private buildWater(model: WorldSceneModel, prerendered: boolean): void {
    if (!this.gpu.webgl) return;
    this.water = new WaterSurface({
      scene: this,
      grid: model.grid,
      depth: DEPTH.water,
      painted: !prerendered,
    });
  }

  private updateWeather(dt: number, time: number): void {
    const weather = this.weather;
    if (!weather) return;
    const cam = this.cameras.main;
    weather.update(dt, time, cam.worldView);
    const mix = weather.mix;
    if (time - this.statsAt > 1000) {
      // Diagnostics and tests: how much weather is on screen.
      this.statsAt = time;
      const s = weather.stats();
      const c = this.game.canvas.dataset;
      c.weatherDrops = String(s.drops);
      c.weatherDust = String(s.dust + s.leaves);
      c.weatherWet = String(s.wet);
      c.weatherStrikes = String(s.strikes);
    }
    this.ambient?.setWind(weather.wind);
    const flash = weather.flash;
    // Light layer: repainted only when the weather has visibly moved on.
    this.refreshSky();
    if (this.postFx) {
      const model = this.model;
      if (model) {
        this.postFx.setLook(
          gradeFor({
            mood: model.mood,
            hour: this.lighting.hour,
            indoor: model.kind === 'indoor',
            weather: mix,
            wet: weather.wetness,
            highContrast: this.highContrast,
            reducedMotion: this.reducedMotion,
          }),
          flash,
          this.opts.viewport.ratio,
        );
      }
      this.flashOverlay?.setVisible(false);
    } else if (this.flashOverlay) {
      this.flashOverlay.setVisible(flash > 0.001).setAlpha(flash);
    }
    if (this.water && this.water.count > 0) {
      const place = this.place?.art.scene === this.model?.sceneId ? this.place : null;
      const variant = place ? place.variant : 'painted';
      const sun = sunForWater(this.lighting.hour, variant);
      const decor = effectsFor(this.quality.level).decor;
      this.water.setLook(
        waterLook(mix, sun.height, { reducedMotion: this.reducedMotion, still: !decor }),
        sun,
        variant === 'late' || (this.lighting.hour ?? 12) >= 16,
        decor ? 1 : 0.6,
        this.clock,
        waterSky(variant),
      );
    }
  }

  /** Post-processing on or off for the current quality level and renderer. */
  private applyPostFx(): void {
    const want = this.gpu.webgl && !this.gpu.software && effectsFor(this.quality.level).postFx;
    const cam = this.cameras.main;
    if (want && !this.postFx) {
      cam.setPostPipeline(POST_FX_KEY);
      const p = cam.getPostPipeline(POST_FX_KEY);
      this.postFx = p instanceof WorldPostFX ? p : null;
    } else if (!want && this.postFx) {
      cam.removePostPipeline(POST_FX_KEY);
      this.postFx = null;
    }
    this.game.canvas.dataset.postFx = this.postFx ? 'on' : 'off';
  }

  /**
   * The highest render resolution for a level. Without a GPU (the Canvas
   * renderer, or software GL) every pixel is drawn by the CPU: stay at 1×.
   */
  private maxResolution(level: EffectsLevel): number {
    return this.gpu.webgl && !this.gpu.software ? effectsFor(level).maxResolution : 1;
  }

  /** The quality level changed (automatically, or by the player): apply what it allows. */
  private onQualityLevel(level: EffectsLevel, automatic = true): void {
    const fx = effectsFor(level);
    this.game.canvas.dataset.effects = effectsLabel(level);
    if (!automatic) {
      this.lightKey = '';
      this.applyLighting();
      if (level === 'low') this.ambient?.reduce();
    } else if (level === 'low') {
      this.enterLowPower();
    } else {
      // Recorded in "Copy diagnostics".
      this.opts.logger.warn(
        level === 'lite'
          ? 'Frame rate is low: dropping post-processing and some weather'
          : 'Frame rate is low: rendering at 1× resolution',
      );
    }
    this.applyPostFx();
    this.weather?.setShare(fx.weather);
    this.opts.viewport.setCap(this.maxResolution(level));
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
      const box = this.opts.viewport.cssHeight < 700 ? 0.42 : 0.34;
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
    // Diagnostics and tests: the part of the world in view (world units, last frame).
    const v = cam.worldView;
    const view = `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.width.toFixed(1)},${v.height.toFixed(1)}`;
    if (view !== this.viewKey) {
      this.viewKey = view;
      this.game.canvas.dataset.view = view;
    }
  }

  private fitCamera(): void {
    const model = this.model;
    const cam = this.cameras.main;
    if (!model || !cam) return;
    const vp = this.opts.viewport;
    const w = this.scale.width;
    const h = this.scale.height;
    // Framing is chosen for the CSS size; the zoom maps world units to canvas pixels.
    cam.setZoom(zoomFor(vp.cssWidth, vp.cssHeight, this.framing()) * vp.ratio);
    const mapW = model.grid.width * TILE;
    const mapH = model.grid.height * TILE;
    const viewW = w / cam.zoom;
    const viewH = h / cam.zoom;
    // Centre small maps instead of pinning them to the corner.
    const bx = mapW < viewW ? (mapW - viewW) / 2 : 0;
    const by = mapH < viewH ? (mapH - viewH) / 2 : 0;
    cam.setBounds(bx, by, Math.max(mapW, viewW), Math.max(mapH, viewH));
    // Screen-space layers are sized in world units to cover the view at this zoom.
    this.light?.setPosition(w / 2, h / 2).setDisplaySize(viewW * 1.1 + 4, viewH * 1.1 + 4);
    this.flashOverlay?.setPosition(w / 2, h / 2).setDisplaySize(viewW * 1.1 + 4, viewH * 1.1 + 4);
    if (this.cameraCentre) cam.centerOn(this.cameraCentre.x, this.cameraCentre.y);
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

  /** Turn the player; a rendered player passes through in-between poses. */
  private facePlayer(facing: Direction): void {
    if (facing === this.player.facing) return;
    if (this.playerFigure && !this.reducedMotion) {
      this.playerTurn = {
        frames: turnPath(this.player.facing, facing).map(turnFrame),
        next: this.time.now + TURN_STEP_MS,
      };
    }
    this.player.facing = facing;
  }

  private finishTravel(target: { id: string; kind: 'entity' | 'exit' | 'tile' }): void {
    if (target.kind === 'entity') {
      const entity = this.model?.entities.find((e) => e.id === target.id);
      if (entity) {
        const here = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
        if (here.x !== entity.x || here.y !== entity.y) this.facePlayer(facingToward(here, entity));
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
    s.setPosition(this.player.x * TILE, this.player.y * TILE + FEET_BELOW_CENTRE);
    s.setDepth(depthFor(this.player.y));
    this.player.shadow?.setPosition(s.x, s.y);
    this.lampGlow?.setPosition(s.x, s.y - 22);
  }

  /** A foot touched the ground: report the tile so the right footstep can sound. */
  private footfall(): void {
    this.opts.onEvent({
      type: 'footstep',
      x: Math.floor(this.player.x),
      y: Math.floor(this.player.y),
    });
  }

  private playerAnchor(): { x: number; y: number; top: number } | null {
    const s = this.player.sprite;
    return s ? { x: s.x, y: s.y, top: 50 } : null;
  }

  /** Where something stands (feet) and how tall it is, in world units. */
  private anchorFor(id: string): { x: number; y: number; top: number } | null {
    const actor = this.actors?.sprite(id);
    if (actor) {
      const view = this.model?.entities.find((e) => e.id === id);
      const pose = view?.pose ?? 'stand';
      const rest = pose === 'stand' ? FEET_BELOW_CENTRE : SEAT_BELOW_CENTRE;
      const top =
        pose === 'lie'
          ? 16
          : TILE / 2 -
            rest +
            headTop(view?.appearance?.build ?? 'adult', pose === 'sit') +
            MARK_CLEARANCE;
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
    const art = this.entitySprites.get(e.id);
    if (art && this.place) {
      const image = this.artImage(this.place, art);
      // A story prop that stands high over people (a boat's sail) fades like a canopy.
      this.canopyFader?.track(image, art);
      this.props.set(e.id, { view: e, image });
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

  /** Paint the place procedurally (places without pre-rendered art). */
  private paintPlace(model: WorldSceneModel): void {
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
  }

  /**
   * Composite a place from its pre-rendered layers: the ground (with every
   * shadow baked in), then each standing thing as a sprite sorted against
   * people by the line it stands on. Trees pivot at their foot so they can
   * sway in the wind.
   */
  private buildFromArt(place: PlaceTextures): void {
    const v = place.art.variants[place.variant] ?? firstVariant(place.art);
    this.lightSpots = [];
    this.canopyFader = new CanopyFader(place.art.ppu, () => this.reducedMotion);
    if (!v) return;
    for (const tile of place.ground)
      this.layers.push(
        this.add
          .image(tile.x, tile.y, tile.key)
          .setOrigin(0, 0)
          .setScale(1 / place.groundPpu)
          .setDepth(DEPTH.ground),
      );
    for (const sprite of v.sprites) {
      if (sprite.id.startsWith('entity:')) {
        this.entitySprites.set(sprite.id.slice('entity:'.length), sprite);
        continue;
      }
      const image = this.artImage(place, sprite);
      if (TREE_SPRITE.test(sprite.id)) {
        // Trees pivot at their foot so they can lean in the wind.
        const w = sprite.w / place.art.ppu;
        const h = sprite.h / place.art.ppu;
        const foot = Math.min(sprite.y + h, Math.max(sprite.y, sprite.base));
        image.setOrigin(0.5, (foot - sprite.y) / h).setPosition(sprite.x + w / 2, foot);
        this.trees.push(image);
      }
      this.canopyFader.track(image, sprite);
      this.layers.push(image);
    }
  }

  private artImage(place: PlaceTextures, sprite: ArtSprite): Phaser.GameObjects.Image {
    const page = place.pages[sprite.page] ?? place.pages[0] ?? '';
    const tex = this.textures.get(page);
    const frame = `sprite:${sprite.id}`;
    const k = place.spriteScale;
    if (!tex.has(frame))
      tex.add(
        frame,
        0,
        sprite.u * k,
        sprite.v * k,
        Math.ceil(sprite.w * k),
        Math.ceil(sprite.h * k),
      );
    // Anchored at the bottom centre, like painted props, so focus marks sit on it.
    const ppu = place.art.ppu;
    return this.add
      .image(sprite.x + sprite.w / (2 * ppu), sprite.y + sprite.h / ppu, page, frame)
      .setOrigin(0.5, 1)
      .setScale(1 / (ppu * k))
      .setDepth(depthFor(depthRow(sprite.base)));
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
  /** The carried lamp's pool of light: about three strides across. */
  private readonly lampScale = 104 / 256;

  private buildLight(): void {
    this.light?.destroy();
    this.lampGlow?.destroy();
    this.flashOverlay?.destroy();
    this.lightKey = '';
    this.light = this.add.image(0, 0, this.lightTexture()).setScrollFactor(0).setDepth(DEPTH.light);
    this.light.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lampGlow = this.add
      .image(0, 0, FX.pool)
      .setDepth(DEPTH.light + 1)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.flashOverlay = this.add
      .image(0, 0, '__WHITE')
      .setScrollFactor(0)
      .setDepth(DEPTH.light + 2)
      .setTint(0xdfe8ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
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
      depths: { ground: DEPTH.ground, shadows: DEPTH.shadows, fx: DEPTH.fx, light: DEPTH.light },
      reducedMotion: this.reducedMotion,
      lowPower: this.quality.lowPower,
      cast: this.cast,
      crowd: this.book?.crowd() ?? [],
      prerendered: this.place?.art.scene === model.sceneId,
      trees: this.trees,
      liveWater: (this.water?.count ?? 0) > 0,
    });
    this.ambient.setNight(this.isNight());
  }

  private enterLowPower(): void {
    // Recorded in "Copy diagnostics", and visible to tests as data-effects="reduced".
    this.opts.logger.warn('Frame rate is low: switching to simpler effects');
    this.game.canvas.dataset.effects = 'reduced';
    this.ambient?.reduce();
    this.lightKey = '';
    this.applyLighting();
  }

  private isNight(): boolean {
    const model = this.model;
    return model ? lightingFor(this.lighting.hour, model.kind === 'indoor').night : false;
  }

  private applyLighting(): void {
    if (!this.model || !this.light) return;
    const l = this.withMood(lightingFor(this.lighting.hour, this.model.kind === 'indoor'));
    const lamp = l.night && this.lighting.lamp;
    // A carried lamp at night: a warm pool about three strides across.
    this.lampGlow?.setVisible(lamp).setScale(this.lampScale).setAlpha(0.8);
    this.ambient?.setNight(l.night);
    this.refreshSky();
  }

  /** The multiply layer: time of day, the place's mood and the sky (repainted when they change). */
  private refreshSky(): void {
    if (!this.model || !this.light) return;
    const indoor = this.model.kind === 'indoor';
    const l = this.withMood(lightingFor(this.lighting.hour, indoor));
    const mix: WeatherMix = this.weather?.mix ?? WEATHER_MIX[this.weatherNow];
    const o = overcast(mix, indoor);
    // High contrast: keep the world bright and clear (only a trace of the weather).
    const sky = this.highContrast ? { ...o, alpha: o.alpha * 0.35, vignette: 0 } : o;
    // In low-power mode only light that means something (dusk, night, a storm) is drawn.
    const show = !this.quality.lowPower || lightMatters(l.alpha + sky.alpha);
    this.light.setVisible(show);
    if (show) {
      const key = [
        l.tint,
        l.alpha.toFixed(3),
        l.vignette.toFixed(3),
        sky.tint,
        sky.alpha.toFixed(2),
        sky.vignette.toFixed(2),
      ].join('|');
      if (key !== this.lightKey) {
        this.lightKey = key;
        this.paintLight(l, sky);
      }
    }
  }

  /** The place's own light: warmer at home and in Jericho, harsher on the open road. */
  private withMood(l: Lighting): Lighting {
    // Pre-rendered places carry their own light; keep only what time of day adds.
    if (this.place?.art.scene === this.model?.sceneId && !l.night)
      return { ...l, alpha: l.alpha * 0.35, vignette: Math.min(l.vignette, 0.2) };
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
  private paintLight(l: Lighting, sky: { tint: number; alpha: number; vignette: number }): void {
    const texture = this.textures.get(WorldScene.LIGHT_KEY) as Phaser.Textures.CanvasTexture;
    const ctx = texture.getContext?.();
    if (!ctx) return;
    const size = WorldScene.LIGHT_SIZE;
    const { center, edge } = gradeColors(l, sky);
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

  /**
   * Free painted figures nobody wears any more (they repaint if needed).
   * Pre-rendered places and people are released by the loader, per place,
   * once nothing draws them (`beginPlace` in prerendered/loader.ts).
   */
  private releaseUnusedTextures(): void {
    const keep = new Set<string>();
    for (const o of this.children.list) {
      const t = (o as { texture?: Phaser.Textures.Texture }).texture;
      if (t) keep.add(t.key);
    }
    for (const key of this.textures.getTextureKeys())
      if (!keep.has(key) && key.startsWith('fig1-')) this.textures.remove(key);
  }

  private clear(): void {
    this.ambient?.destroy();
    this.ambient = null;
    this.feedback?.destroy();
    this.feedback = null;
    this.weather?.destroy();
    this.weather = null;
    this.water?.destroy();
    this.water = null;
    this.actors?.clear();
    this.actors = null;
    this.props.forEach((p) => p.image.destroy());
    this.props.clear();
    this.layers.forEach((l) => l.destroy());
    this.layers = [];
    this.canopies = [];
    this.trees = [];
    this.canopyFader = null;
    this.player.sprite?.destroy();
    this.player.sprite = null;
    this.player.shadow?.destroy();
    this.player.shadow = null;
    this.light?.destroy();
    this.light = null;
    this.lampGlow?.destroy();
    this.lampGlow = null;
    this.flashOverlay?.destroy();
    this.flashOverlay = null;
    this.conversation = null;
    this.sceneTextures.forEach((k) => {
      if (this.textures.exists(k)) this.textures.remove(k);
    });
    this.sceneTextures = [];
  }
}

/** The sun's shadow for people outdoors (indoors, light comes from windows and the hearth). */
function castFor(model: WorldSceneModel): ShadowCast | null {
  if (model.kind === 'indoor') return null;
  const look = lookFor(model.mood);
  const height = 54;
  const { dx, dy } = shadowOffset(look, height);
  return {
    dx,
    dy,
    height,
    alpha: look.shadow.alpha * 0.75,
    color: parseInt(look.shadow.color.slice(1), 16),
  };
}

/** Approximate GPU memory of every loaded texture (level 0, in its GPU format), in MB. */
function textureMegabytes(textures: Phaser.Textures.TextureManager): number {
  let bytes = 0;
  for (const key of textures.getTextureKeys()) {
    for (const src of textures.get(key).source)
      bytes += src.width * src.height * bytesPerPixel(src);
  }
  return bytes / (1024 * 1024);
}

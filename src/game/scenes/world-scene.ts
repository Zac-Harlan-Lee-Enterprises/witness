import Phaser from 'phaser';
import type { VirtualInput } from '@/application/input';
import type { WorldEntityView, WorldListener, WorldSceneModel } from '@/application/ports';
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
import { paintProp } from '../art/props';
import {
  groundUnder,
  hasCanopy,
  isPropTile,
  paintCanopy,
  paintGround,
  paintPropTile,
  TILE,
} from '../art/tiles';
import { moveWithCollision, normalise } from '../systems/collision';
import { pickFocus } from '../systems/focus';

/**
 * The single Phaser scene that renders whichever map the application asks
 * for. It owns ONLY ephemeral presentation state (sprites, camera, walk
 * animation, current path). It never evaluates story conditions and never
 * touches React: it receives a WorldSceneModel and reports WorldEvents.
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
  baseY: number;
}

export class WorldScene extends Phaser.Scene {
  private model: WorldSceneModel | null = null;
  private blocked: Blocked = () => true;
  private layers: Phaser.GameObjects.GameObject[] = [];
  private readonly entitySprites = new Map<string, EntitySprite>();
  private player: {
    x: number;
    y: number;
    facing: Direction;
    sprite: Phaser.GameObjects.Sprite | null;
    walk: number;
  } = {
    x: 0,
    y: 0,
    facing: 'down',
    sprite: null,
    walk: 0,
  };
  private focusId: string | null = null;
  private focusMarker: Phaser.GameObjects.Image | null = null;
  private path: Tile[] | null = null;
  private pathTarget: { id: string; kind: 'entity' | 'exit' | 'tile' } | null = null;
  private controlsEnabled = true;
  private reducedMotion = false;
  private tilesPerSecond = 4.5;
  private lastTile = { x: -1, y: -1 };
  private insideExit: string | null = null;
  private generation = 0;
  private elapsed = 0;

  constructor(private readonly opts: WorldSceneOptions) {
    super('world');
  }

  create(): void {
    this.scale.on('resize', () => this.fitCamera());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer));
    this.makeMarkerTexture();
    this.opts.onReady();
  }

  // ── WorldPort operations (called via the adapter) ───────────────────────
  buildScene(model: WorldSceneModel): void {
    this.clear();
    this.generation++;
    this.model = model;
    const { grid } = model;

    // Ground + props painted once into a single texture (one draw call).
    const ground = document.createElement('canvas');
    ground.width = grid.width * TILE;
    ground.height = grid.height * TILE;
    const g = ground.getContext('2d');
    const canopy = document.createElement('canvas');
    canopy.width = ground.width;
    canopy.height = ground.height;
    const c = canopy.getContext('2d');
    if (g && c) {
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const kind = grid.tiles[y]?.[x] ?? 'void';
          if (isPropTile(kind)) {
            paintGround(g, groundUnder(grid, x, y, model.baseTile), x, y, grid);
            paintPropTile(g, kind, x, y);
            if (hasCanopy(kind)) paintCanopy(c, kind, x, y);
          } else {
            paintGround(g, kind, x, y, grid);
          }
        }
      }
    }
    const groundKey = `ground-${this.generation}`;
    const canopyKey = `canopy-${this.generation}`;
    this.textures.addCanvas(groundKey, ground);
    this.textures.addCanvas(canopyKey, canopy);
    this.layers.push(this.add.image(0, 0, groundKey).setOrigin(0, 0).setDepth(0));
    this.layers.push(this.add.image(0, 0, canopyKey).setOrigin(0, 0).setDepth(100_000));

    this.rebuildBlocked(model.entities);
    model.entities.forEach((e) => this.addEntity(e));

    // Player
    const pKey = this.ensureCharacterTexture(model.player.appearance);
    this.player = {
      x: model.player.x + 0.5,
      y: model.player.y + 0.5,
      facing: model.player.facing,
      sprite: this.add.sprite(0, 0, pKey, frameName(model.player.facing, 0)).setOrigin(0.5, 1),
      walk: 0,
    };
    this.placePlayer();
    this.lastTile = { x: Math.floor(this.player.x), y: Math.floor(this.player.y) };
    this.insideExit = this.exitAt(this.lastTile.x, this.lastTile.y);

    this.focusMarker = this.add.image(0, 0, 'focus-marker').setDepth(100_001).setVisible(false);
    this.focusId = null;
    this.path = null;
    this.pathTarget = null;

    this.fitCamera();
    const cam = this.cameras.main;
    cam.startFollow(
      this.player.sprite as Phaser.GameObjects.Sprite,
      true,
      this.reducedMotion ? 1 : 0.12,
      this.reducedMotion ? 1 : 0.12,
    );
    if (!this.reducedMotion) cam.fadeIn(220, 20, 14, 8);
    this.opts.onEvent({ type: 'sceneReady', sceneId: model.sceneId });
  }

  updateEntities(entities: WorldEntityView[]): void {
    if (!this.model) return;
    this.model = { ...this.model, entities };
    const ids = new Set(entities.map((e) => e.id));
    for (const [id, es] of this.entitySprites) {
      if (!ids.has(id)) {
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
    this.reducedMotion = options.reducedMotion;
    this.tilesPerSecond = options.tilesPerSecond;
    const lerp = this.reducedMotion ? 1 : 0.12;
    this.cameras.main?.setLerp(lerp, lerp);
  }

  // ── Frame loop ──────────────────────────────────────────────────────────
  override update(_time: number, deltaMs: number): void {
    if (!this.model || !this.player.sprite) return;
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
    const frame = moving ? 1 + (Math.floor(this.player.walk / 0.16) % 2) : 0;
    this.player.sprite.setFrame(frameName(this.player.facing, frame));
    this.placePlayer();
    if (moving) this.afterStep(false);
    this.updateFocus();
    this.animateIdle();
  }

  // ── Internals ───────────────────────────────────────────────────────────
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
    this.focusMarker
      .setVisible(true)
      .setPosition(focused.sprite.x, focused.sprite.y - focused.sprite.displayHeight - 6 + bob);
  }

  private animateIdle(): void {
    if (this.reducedMotion) return;
    for (const es of this.entitySprites.values()) {
      if (es.view.kind === 'clue') es.sprite.setAlpha(0.75 + Math.sin(this.elapsed * 3) * 0.25);
    }
  }

  private placePlayer(): void {
    const s = this.player.sprite;
    if (!s) return;
    s.setPosition(this.player.x * TILE, this.player.y * TILE + 10);
    s.setDepth(10 + this.player.y * 100);
  }

  private addEntity(e: WorldEntityView): void {
    let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
    if (e.appearance) {
      const key = this.ensureCharacterTexture(e.appearance);
      sprite = this.add.sprite(0, 0, key, frameName(e.facing, 0)).setOrigin(0.5, 1);
    } else {
      const key = this.ensurePropTexture(e.sprite ?? (e.kind === 'clue' ? 'marker' : 'sign'));
      sprite = this.add.image(0, 0, key).setOrigin(0.5, 1);
    }
    const baseY = (e.y + 1) * TILE + (e.appearance ? -2 : 0);
    sprite.setPosition((e.x + 0.5) * TILE, baseY).setDepth(10 + (e.y + 0.5) * 100);
    this.entitySprites.set(e.id, { view: e, sprite, baseY });
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

  private ensureCharacterTexture(appearance: WorldSceneModel['player']['appearance']): string {
    const key = appearanceKey(appearance);
    if (this.textures.exists(key)) return key;
    const tex = this.textures.addCanvas(key, paintCharacterSheet(appearance));
    if (!tex) return key;
    DIRECTION_ROWS.forEach((dir, row) => {
      for (let f = 0; f < FRAMES_PER_DIRECTION; f++)
        tex.add(frameName(dir, f), 0, f * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H);
    });
    return key;
  }

  private ensurePropTexture(name: string): string {
    const key = `prop-${name}`;
    if (this.textures.exists(key)) return key;
    const { canvas, known } = paintProp(name);
    if (!known) this.opts.logger.warn(`Unknown prop sprite '${name}' — using fallback marker`);
    this.textures.addCanvas(key, canvas);
    return key;
  }

  private makeMarkerTexture(): void {
    if (this.textures.exists('focus-marker')) return;
    const canvas = document.createElement('canvas');
    canvas.width = 22;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff8e8';
      ctx.strokeStyle = '#6b3f22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(2, 2, 18, 15, 5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 17);
      ctx.lineTo(11, 22);
      ctx.lineTo(14, 17);
      ctx.fill();
      ctx.fillStyle = '#6b3f22';
      [7, 11, 15].forEach((x) => ctx.fillRect(x - 1, 9, 2.5, 2.5));
    }
    this.textures.addCanvas('focus-marker', canvas);
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
  }

  private clear(): void {
    this.layers.forEach((l) => l.destroy());
    this.layers = [];
    this.entitySprites.forEach((es) => es.sprite.destroy());
    this.entitySprites.clear();
    this.player.sprite?.destroy();
    this.player.sprite = null;
    this.focusMarker?.destroy();
    this.focusMarker = null;
    const gen = this.generation;
    [`ground-${gen}`, `canopy-${gen}`].forEach((k) => {
      if (this.textures.exists(k)) this.textures.remove(k);
    });
  }
}

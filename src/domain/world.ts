import { z } from 'zod';
import { ConditionSchema } from './conditions';
import { EffectSchema } from './effects';
import { DirectionSchema } from './state/game-state';

/**
 * World content: tile maps authored as ASCII layouts plus placed entities.
 * ASCII keeps maps reviewable in a pull request and authorable without an
 * external editor; the tile catalogue below fixes which kinds block movement.
 */
export const TILE_KINDS = {
  sand: { solid: false },
  scrub: { solid: false },
  road: { solid: false },
  paving: { solid: false },
  floor: { solid: false },
  rug: { solid: false },
  wadi: { solid: false },
  mud: { solid: false },
  steps: { solid: false },
  grass: { solid: false },
  soil: { solid: false },
  mat: { solid: false },
  bedroll: { solid: false },
  door: { solid: false },
  gate: { solid: false },
  wall: { solid: true },
  roof: { solid: true },
  water: { solid: true },
  well: { solid: true },
  olive: { solid: true },
  palm: { solid: true },
  rock: { solid: true },
  cliff: { solid: true },
  hill: { solid: true },
  bush: { solid: true },
  stall: { solid: true },
  table: { solid: true },
  jars: { solid: true },
  cairn: { solid: true },
  fence: { solid: true },
  oven: { solid: true },
  crate: { solid: true },
  sacks: { solid: true },
  basket: { solid: true },
  loom: { solid: true },
  cart: { solid: true },
  tent: { solid: true },
  trough: { solid: true },
  crops: { solid: true },
  reeds: { solid: true },
  fig: { solid: true },
  cloth: { solid: true },
  void: { solid: true },
} as const;
export type TileKind = keyof typeof TILE_KINDS;
export const TILE_KIND_NAMES = Object.keys(TILE_KINDS) as TileKind[];

export function isSolidTile(kind: TileKind): boolean {
  return TILE_KINDS[kind].solid;
}

export const ENTITY_KINDS = [
  'npc',
  'sign',
  'container',
  'clue',
  'item',
  'door',
  'feature',
] as const;

export const POSES = ['stand', 'sit', 'lie'] as const;
export type Pose = (typeof POSES)[number];

/**
 * Visible marks of what has happened to someone — how the story shows up on
 * a person in the world. Each one is drawn by the world adapter; none is a
 * score or a judgement.
 */
export const LOOK_MARKS = [
  /** Clean linen bandages on the forehead and ankle. */
  'bandaged',
  /** Bandages torn from the player's own tunic (drawn in the player's tunic colour). */
  'rag-bandaged',
  /** Wearing the player's spare cloak around the shoulders. */
  'wrapped-in-cloak',
  /** A rolled cloak strapped to the satchel. */
  'cloak-roll',
  /** A clay oil lamp hanging from the belt. */
  'lamp',
  /** A water skin slung at the hip. */
  'water-skin',
  /** A tunic hem with a strip torn away. */
  'torn-hem',
] as const;
export const LookMarkSchema = z.enum(LOOK_MARKS);
export type LookMark = (typeof LOOK_MARKS)[number];

/**
 * A conditional change in how someone appears. Every look whose `when` holds
 * applies, in order: later looks override pose and facing; marks accumulate.
 */
export const LookSchema = z.object({
  when: ConditionSchema,
  pose: z.enum(POSES).optional(),
  facing: DirectionSchema.optional(),
  marks: z.array(LookMarkSchema).default([]),
});
export type Look = z.infer<typeof LookSchema>;

/** The player's looks only add marks (what they carry, what they gave away). */
export const PlayerLookSchema = LookSchema.pick({ when: true, marks: true });
export type PlayerLook = z.infer<typeof PlayerLookSchema>;

export const EntitySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ENTITY_KINDS),
  /** Label shown in prompts and the accessible "Go to…" list. */
  label: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  facing: DirectionSchema.default('down'),
  characterId: z.string().optional(),
  /** Prop sprite for non-character entities (see game/art/props.ts). */
  sprite: z.string().optional(),
  visibleWhen: ConditionSchema.optional(),
  solid: z.boolean().default(true),
  /** How a character is shown (e.g. an injured traveler lying in the shade). */
  pose: z.enum(POSES).default('stand'),
  /** How the story changes the way this character appears (see LookSchema). */
  looks: z.array(LookSchema).default([]),
  /** What interacting does: if `requires` holds, apply `effects`, then start `dialogue`. */
  interaction: z
    .object({
      verb: z.enum(['talk', 'examine', 'read', 'open', 'take', 'use', 'enter']),
      dialogue: z.string().optional(),
      effects: z.array(EffectSchema).default([]),
      /** If present and false, show `blockedText` instead. */
      requires: ConditionSchema.optional(),
      blockedText: z.string().optional(),
    })
    .optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const ExitSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive().default(1),
  h: z.number().int().positive().default(1),
  to: z.object({ scene: z.string().min(1), spawn: z.string().min(1) }),
  requires: ConditionSchema.optional(),
  /** Dialogue shown when blocked (preferred) … */
  blockedDialogue: z.string().optional(),
  /** … or a plain message. */
  blockedText: z.string().optional(),
  /** Effects applied when the exit is used (e.g. time passing on the road). */
  effects: z.array(EffectSchema).default([]),
});
export type Exit = z.infer<typeof ExitSchema>;

/**
 * Triggers fire once (guarded by `onceFlag`):
 *  - AREA triggers (with x/y/w/h) when the player steps into the rectangle
 *    and `when` holds;
 *  - STATE triggers (no area) as soon as `when` becomes true while the
 *    player is in this scene — e.g. after finding the third clue.
 */
export const TriggerSchema = z
  .object({
    id: z.string().min(1),
    area: z
      .object({
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        w: z.number().int().positive(),
        h: z.number().int().positive(),
      })
      .optional(),
    when: ConditionSchema.optional(),
    /** Flag set after firing so each trigger fires once. */
    onceFlag: z.string().min(1),
    effects: z.array(EffectSchema).min(1),
  })
  .refine((t) => t.area !== undefined || t.when !== undefined, {
    message: 'State triggers (without an area) need a `when` condition',
  });
/** @public Domain-model type (chapter-authoring API). */
export type Trigger = z.infer<typeof TriggerSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['indoor', 'outdoor']),
  /** Short description for screen readers when the scene loads. */
  description: z.string().min(1),
  layout: z.array(z.string().min(1)).min(3),
  legend: z.record(z.string().length(1), z.enum(TILE_KIND_NAMES as [TileKind, ...TileKind[]])),
  /** Tile drawn beneath props like trees, stalls and jars. */
  baseTile: z.enum(TILE_KIND_NAMES as [TileKind, ...TileKind[]]),
  spawns: z.record(
    z.string(),
    z.object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      facing: DirectionSchema,
    }),
  ),
  entities: z.array(EntitySchema),
  exits: z.array(ExitSchema),
  triggers: z.array(TriggerSchema).default([]),
  onEnter: z.array(EffectSchema).default([]),
  ambience: z.enum(['market', 'wind', 'indoor', 'oasis', 'none']).default('none'),
  /**
   * Art direction for the place (palette, materials, light, ambient life):
   * a home interior, a stone city, open wilderness or a green oasis town.
   * When omitted it follows the ambience.
   */
  mood: z.enum(['home', 'city', 'wilderness', 'oasis']).optional(),
  music: z.enum(['home', 'journey', 'tension', 'reflection', 'none']).default('none'),
});
export type Scene = z.infer<typeof SceneSchema>;

export interface TileGrid {
  width: number;
  height: number;
  tiles: TileKind[][];
}

export class MapError extends Error {}

/** Parse an ASCII layout into a tile grid. Throws on unknown characters or ragged rows. */
export function parseLayout(scene: Pick<Scene, 'id' | 'layout' | 'legend'>): TileGrid {
  const width = scene.layout[0]?.length ?? 0;
  const tiles = scene.layout.map((row, y) => {
    if (row.length !== width) {
      throw new MapError(`Scene ${scene.id}: row ${y} has length ${row.length}, expected ${width}`);
    }
    return [...row].map((ch, x) => {
      const kind = scene.legend[ch];
      if (!kind) throw new MapError(`Scene ${scene.id}: unknown tile '${ch}' at ${x},${y}`);
      return kind;
    });
  });
  return { width, height: tiles.length, tiles };
}

export function tileAt(grid: TileGrid, x: number, y: number): TileKind {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return 'void';
  return grid.tiles[y]?.[x] ?? 'void';
}

export function inRect(
  px: number,
  py: number,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

import { z } from 'zod';

/**
 * Pre-rendered art for a place, produced offline by tools/art (Blender) and
 * served as static files under public/art/<scene>/. The manifest says where
 * each layer and sprite goes; the game only composites them.
 *
 * Units: positions and sizes of placements are in game units (32 per tile);
 * `w`/`h`/`u`/`v` are texture pixels (ppu pixels per game unit).
 */
const SpriteSchema = z.object({
  id: z.string().min(1),
  /** Top-left of the sprite on screen (game units). */
  x: z.number(),
  y: z.number(),
  /** Size and position in its atlas page (texture pixels). */
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  page: z.number().int().nonnegative(),
  u: z.number().int().nonnegative(),
  v: z.number().int().nonnegative(),
  /** The ground line it stands on (game units, y): people further south draw in front. */
  base: z.number(),
  tiles: z.array(z.tuple([z.number().int(), z.number().int()])).default([]),
  /** A canopy (a palm's crown): faded while someone walks behind it. */
  fade: z.boolean().default(false),
});
export type ArtSprite = z.infer<typeof SpriteSchema>;

/**
 * Every GPU the game runs on holds a texture this big (WebGL 2's minimum;
 * many phones stop at 4096). Bigger images (a large place's ground) are cut
 * into tiles no bigger, and atlas pages are this size at most.
 */
export const MAX_ART_TEXTURE = 2048;

/** One tile of an image cut up to fit the GPU (neighbours overlap by a pixel or two). */
const TileSchema = z.object({
  file: z.string().min(1),
  /** Its top-left in the whole image (texture pixels). */
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});
export type ArtTile = z.infer<typeof TileSchema>;

const VariantSchema = z.object({
  /** The ground, in tiles of at most MAX_ART_TEXTURE px (one, for a small place). */
  ground: z.array(TileSchema).min(1),
  groundLow: z.array(TileSchema).min(1),
  shade: z.string().min(1),
  pages: z.array(z.string().min(1)).min(1),
  /** The same pages at half resolution (phones, reduced effects), if built. */
  pagesLow: z.array(z.string().min(1)).optional(),
  sprites: z.array(SpriteSchema),
});
export type ArtVariant = z.infer<typeof VariantSchema>;

/**
 * Sets of a place's art, keyed by when in the story they are shown: the
 * morning, the later day (from 15:00) and the night (19:00 to 05:00). A
 * place has the sets its story shows (at least one).
 */
export const LIGHTING_VARIANTS = ['day', 'late', 'night'] as const;
export type LightingVariant = (typeof LIGHTING_VARIANTS)[number];

/**
 * How people are lit: by the sun of the place's variant, indoors (a lamp and
 * a window), under rain cloud (soft light from the whole sky), or at
 * lamp-lighting (lampstands, the last blue of the evening).
 */
export const PEOPLE_LIGHTS = ['day', 'late', 'night', 'indoor', 'overcast', 'lamp'] as const;
export type PeopleLight = (typeof PEOPLE_LIGHTS)[number];

export const PlaceArtSchema = z.object({
  version: z.literal(1),
  scene: z.string().min(1),
  tiles: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  ppu: z.number().positive(),
  /**
   * How people are lit here when not by the sun of the variant: rooms by
   * their own lamp and window ('indoor'), a road under rain cloud
   * ('overcast'), a house at lamp-lighting ('lamp').
   */
  peopleLight: z.enum(['indoor', 'overcast', 'lamp']).optional(),
  variants: z
    .object({
      day: VariantSchema.optional(),
      late: VariantSchema.optional(),
      night: VariantSchema.optional(),
    })
    .refine((v) => LIGHTING_VARIANTS.some((k) => v[k] !== undefined), {
      message: 'a place needs at least one set',
    }),
});
export type PlaceArt = z.infer<typeof PlaceArtSchema>;

const ShadowSheetSchema = z.object({
  sheet: z.string().min(1),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  originX: z.number(),
  originY: z.number(),
  ppu: z.number().positive(),
});

export const POSES = ['stand', 'sit', 'lie'] as const;

const PersonSheetSchema = z.object({
  /** Stable key of the authored appearance (see appearanceKey). */
  appearance: z.string().min(1),
  /** Standing (and walking), or at rest: sitting cross-legged or lying on the back. */
  pose: z.enum(POSES).default('stand'),
  /** Story marks built into this sheet (ones that change the body, like a torn hem). */
  marks: z.array(z.string().min(1)).default([]),
  /**
   * An overlay: only a mark (a bandage, the spare cloak, a water skin), with
   * the same frames as the sheet `of`, drawn over it. Rag bandages are made
   * from the player's tunic, so they carry its colour (`rag`).
   */
  overlay: z
    .object({
      mark: z.string().min(1),
      of: z.string().min(1),
      rag: z.string().optional(),
    })
    .optional(),
  sheets: z.object({
    day: z.string().min(1).optional(),
    late: z.string().min(1).optional(),
    night: z.string().min(1).optional(),
    indoor: z.string().min(1).optional(),
    overcast: z.string().min(1).optional(),
    lamp: z.string().min(1).optional(),
  }),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  originX: z.number(),
  originY: z.number(),
  ppu: z.number().positive(),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.string().min(1)).min(1),
  turns: z.array(z.string().min(1)).default([]),
  /** Cast shadows per light (overlays have none: the sheet under them casts it). */
  shadows: z
    .object({
      day: ShadowSheetSchema.optional(),
      late: ShadowSheetSchema.optional(),
      night: ShadowSheetSchema.optional(),
      indoor: ShadowSheetSchema.optional(),
      overcast: ShadowSheetSchema.optional(),
      lamp: ShadowSheetSchema.optional(),
    })
    .default({}),
  /**
   * Trimmed frames packed into atlases, per image file: frame name →
   * [x, y, w, h, offsetX, offsetY] (the offset places the trimmed pixels
   * inside the full frame). Without it, a file is a plain grid of frames.
   */
  atlas: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
      ),
    )
    .default({}),
});
export type PersonSheet = z.infer<typeof PersonSheetSchema>;

export const PeopleArtSchema = z.record(z.string(), PersonSheetSchema);
export type PeopleArt = z.infer<typeof PeopleArtSchema>;

/** Validate a manifest; returns null (and the reason) instead of throwing. */
export function parsePlaceArt(json: unknown): { art: PlaceArt | null; error: string | null } {
  const r = PlaceArtSchema.safeParse(json);
  return r.success ? { art: r.data, error: null } : { art: null, error: r.error.message };
}

export function parsePeopleArt(json: unknown): { people: PeopleArt | null; error: string | null } {
  const r = PeopleArtSchema.safeParse(json);
  return r.success ? { people: r.data, error: null } : { people: null, error: r.error.message };
}

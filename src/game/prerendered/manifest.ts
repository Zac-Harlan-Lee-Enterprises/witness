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
});
export type ArtSprite = z.infer<typeof SpriteSchema>;

const VariantSchema = z.object({
  ground: z.string().min(1),
  groundLow: z.string().min(1),
  shade: z.string().min(1),
  pages: z.array(z.string().min(1)).min(1),
  sprites: z.array(SpriteSchema),
});

export const LIGHTING_VARIANTS = ['day', 'late'] as const;
export type LightingVariant = (typeof LIGHTING_VARIANTS)[number];

export const PlaceArtSchema = z.object({
  version: z.literal(1),
  scene: z.string().min(1),
  tiles: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  ppu: z.number().positive(),
  variants: z.object({ day: VariantSchema, late: VariantSchema.optional() }),
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

const PersonSheetSchema = z.object({
  /** Stable key of the authored appearance (see appearanceKey). */
  appearance: z.string().min(1),
  sheets: z.object({ day: z.string().min(1), late: z.string().min(1).optional() }),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  originX: z.number(),
  originY: z.number(),
  ppu: z.number().positive(),
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.string().min(1)).min(1),
  turns: z.array(z.string().min(1)).default([]),
  shadows: z.object({ day: ShadowSheetSchema, late: ShadowSheetSchema.optional() }),
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

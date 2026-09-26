import { z } from 'zod';
import { TRUST_MAX, TRUST_MIN } from './effects';

/**
 * Characters. Appearance is described as data so the SAME description drives
 * the procedurally drawn world sprite (Phaser) and the portrait (React SVG).
 * All characters in this game are fictional unless `biblicalFigure` is true —
 * and biblical figures are never player-controlled.
 */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const AppearanceSchema = z.object({
  skin: HexColor,
  hair: HexColor,
  robe: HexColor,
  accent: HexColor,
  headwear: z.enum(['none', 'scarf', 'wrap', 'band', 'veil', 'hood']),
  headwearColor: HexColor,
  beard: z.boolean(),
  build: z.enum(['child', 'adult', 'elder']),
  /** Something the person usually carries — it makes roles readable at a glance. */
  carry: z
    .enum([
      'none',
      'staff',
      'basket',
      'jar',
      'bundle',
      'bread',
      'spindle',
      'satchel',
      /** A pair of wooden writing tablets and a stylus (a scribe). */
      'tablets',
      /** A cylindrical leather case for carrying letters (a letter carrier). */
      'scroll-case',
    ])
    .default('none'),
});
export type Appearance = z.infer<typeof AppearanceSchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** One-line role shown under the name, e.g. "Nabataean trader". */
  role: z.string().min(1),
  appearance: AppearanceSchema,
  fictional: z.boolean(),
  biblicalFigure: z.boolean().default(false),
  /** Journal "People" entry id unlocked on meeting. */
  journalEntry: z.string().optional(),
});
/** @public Domain-model type (chapter-authoring API). */
export type Character = z.infer<typeof CharacterSchema>;

/**
 * Trust is shown as words, never as a number or a score. It describes a
 * relationship, not the player's worth.
 */
export function trustLabel(value: number): string {
  const v = Math.max(TRUST_MIN, Math.min(TRUST_MAX, value));
  if (v <= -2) return 'Wary of you';
  if (v === -1) return 'Unsure about you';
  if (v === 0) return 'Just met';
  if (v === 1) return 'Friendly';
  if (v === 2) return 'Trusts you';
  return 'Counts you as a friend';
}

export const PLAYER_LOOKS = ['look-1', 'look-2', 'look-3', 'look-4'] as const;
export type PlayerLook = (typeof PLAYER_LOOKS)[number];

/** Player appearance presets (chosen at profile creation; not gendered). */
export const PLAYER_APPEARANCES: Record<PlayerLook, Appearance> = {
  'look-1': {
    skin: '#a8734a',
    hair: '#2b1d14',
    robe: '#3f6f8f',
    accent: '#d9b25f',
    headwear: 'wrap',
    headwearColor: '#e8dcc0',
    beard: false,
    build: 'child',
    carry: 'satchel',
  },
  'look-2': {
    skin: '#8d5a3a',
    hair: '#1f1611',
    robe: '#7a3b2e',
    accent: '#e3c27a',
    headwear: 'scarf',
    headwearColor: '#c96f3b',
    beard: false,
    build: 'child',
    carry: 'satchel',
  },
  'look-3': {
    skin: '#c08a5e',
    hair: '#3a2a1c',
    robe: '#556b3a',
    accent: '#f0e0b0',
    headwear: 'band',
    headwearColor: '#8a2f2f',
    beard: false,
    build: 'child',
    carry: 'satchel',
  },
  'look-4': {
    skin: '#6f4630',
    hair: '#141010',
    robe: '#6b5a8e',
    accent: '#e8d49a',
    headwear: 'none',
    headwearColor: '#6b5a8e',
    beard: false,
    build: 'child',
    carry: 'satchel',
  },
};

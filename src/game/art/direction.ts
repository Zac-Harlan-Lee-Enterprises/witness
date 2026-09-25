import type { SceneMood } from '@/application/ports';

/**
 * ART DIRECTION — "sunlit field sketchbook".
 *
 * One original visual language for the whole game, tuned per place:
 *
 * - Shape language: soft, hand-cut shapes; rounded stone, drooping cloth,
 *   leaning palms. Nothing perfectly straight except dressed stone courses.
 * - Light: one sun from the upper left. Every tall thing casts a shadow
 *   down-right; shadows are one shared, hue-shifted colour (never black) so
 *   overlapping shadows don't stack into mud.
 * - Values: ground in the middle values, tops of walls and cloth brightest,
 *   shadows and openings darkest. Characters sit on a mid-value ground with a
 *   dark warm outline, so they read at a glance.
 * - Colour: large areas are quiet; saturated colour is kept for textiles,
 *   produce, water and foliage, which is where the eye should go.
 * - Outline: characters and props get a thin dark-warm outline; terrain never.
 * - Density: detail gathers along walls, under trees and at thresholds, and
 *   thins out where people walk, so paths stay readable.
 *
 * The four chapter places each get their own palette, materials and light:
 *
 * | mood        | place             | feeling                         | motifs                           |
 * |-------------|-------------------|---------------------------------|----------------------------------|
 * | home        | Miriam's house    | intimate, warm, safe            | beams, niches, herbs, lamp pools |
 * | city        | Jerusalem market  | busy, bright stone, colourful   | awnings, crowds, pots, pigeons   |
 * | wilderness  | the Jericho road  | exposed, harsh, lonely          | chalk hills, red rock, long shade|
 * | oasis       | Jericho           | green, golden, relieving        | palms, mudbrick, channels, figs  |
 */
export type Mood = SceneMood;

export interface Look {
  mood: Mood;
  /** Ground materials (walkable surfaces). */
  ground: {
    sand: string;
    scrub: string;
    grass: string;
    soil: string;
    road: string;
    paving: string;
    floor: string;
    wadi: string;
    mud: string;
  };
  /** Building material: dressed limestone, mudbrick or an interior plaster. */
  building: {
    material: 'limestone' | 'mudbrick' | 'plaster';
    face: string;
    top: string;
    mortar: string;
    trim: string;
  };
  /** One shared cast-shadow colour and strength. */
  shadow: { color: string; alpha: number; length: number };
  /** Darkening where things meet the ground (ambient occlusion). */
  occlusion: number;
  /** Textile/produce accents, used for awnings, rugs, cloth, stalls. */
  accents: readonly string[];
  foliage: { dark: string; mid: string; light: string };
  /** Speckle/grit strength on ground (0–1). */
  grit: number;
  /** How much small detail gathers along walls and props (0–1). */
  clutter: number;
  /** Base colour grade (multiply) and edge darkening for this place. */
  grade: { tint: number; alpha: number; vignette: number };
}

export const LOOKS: Record<Mood, Look> = {
  home: {
    mood: 'home',
    ground: {
      sand: '#c9a674',
      scrub: '#b9a068',
      grass: '#8a9a55',
      soil: '#7a5838',
      road: '#c39e6c',
      paving: '#c7ab80',
      floor: '#bf9868',
      wadi: '#b8996c',
      mud: '#7d5b3c',
    },
    building: {
      material: 'plaster',
      face: '#d9bf92',
      top: '#8f6b45',
      mortar: '#b08f63',
      trim: '#5a3a22',
    },
    shadow: { color: '#3a2112', alpha: 0.42, length: 10 },
    occlusion: 0.5,
    accents: ['#9a3a2c', '#35527a', '#c98f2e', '#5f7438', '#7a4468'],
    foliage: { dark: '#4f5f35', mid: '#76884a', light: '#aebd7a' },
    grit: 0.6,
    clutter: 0.9,
    grade: { tint: 0xffcf96, alpha: 0.16, vignette: 0.62 },
  },
  city: {
    mood: 'city',
    ground: {
      sand: '#d8bf8e',
      scrub: '#b9ae70',
      grass: '#8d9c56',
      soil: '#8a6a45',
      road: '#cdb183',
      paving: '#d6c29a',
      floor: '#cfad7f',
      wadi: '#c6ab80',
      mud: '#8f6d4a',
    },
    building: {
      material: 'limestone',
      face: '#e7d6ae',
      top: '#efe2c2',
      mortar: '#bca27a',
      trim: '#6d4a2c',
    },
    shadow: { color: '#3b3560', alpha: 0.4, length: 18 },
    occlusion: 0.35,
    accents: ['#b23a2c', '#2f5590', '#dca334', '#5a7c34', '#8a3f6e', '#e8dcc0'],
    foliage: { dark: '#55663b', mid: '#7f9258', light: '#b9c493' },
    grit: 0.5,
    clutter: 1,
    grade: { tint: 0xfff0d6, alpha: 0.06, vignette: 0.3 },
  },
  wilderness: {
    mood: 'wilderness',
    ground: {
      sand: '#dccaa0',
      scrub: '#c3b27a',
      grass: '#9aa060',
      soil: '#8c6c48',
      road: '#e6d6b0',
      paving: '#d8c7a0',
      floor: '#cfad7f',
      wadi: '#c9b08a',
      mud: '#8f6d4a',
    },
    building: {
      material: 'limestone',
      face: '#e2d2ae',
      top: '#ecdfc0',
      mortar: '#b69d76',
      trim: '#6d4a2c',
    },
    shadow: { color: '#2c2445', alpha: 0.5, length: 26 },
    occlusion: 0.3,
    accents: ['#a8452f', '#445c7a', '#c98f2e'],
    foliage: { dark: '#5d6036', mid: '#838449', light: '#b3b075' },
    grit: 0.8,
    clutter: 0.35,
    grade: { tint: 0xfff2dc, alpha: 0.05, vignette: 0.24 },
  },
  oasis: {
    mood: 'oasis',
    ground: {
      sand: '#d8b27a',
      scrub: '#98a653',
      grass: '#6f9a3e',
      soil: '#6a4a2a',
      road: '#caa06a',
      paving: '#cfae82',
      floor: '#c29a6a',
      wadi: '#b99468',
      mud: '#7a5634',
    },
    building: {
      material: 'mudbrick',
      face: '#c08a5a',
      top: '#a8784a',
      mortar: '#94643c',
      trim: '#4d3218',
    },
    shadow: { color: '#233522', alpha: 0.4, length: 16 },
    occlusion: 0.4,
    accents: ['#c0452f', '#2e6f8e', '#e2b13a', '#7d4a86', '#e8dcc0'],
    foliage: { dark: '#2f5a2a', mid: '#4f8a38', light: '#9cc462' },
    grit: 0.45,
    clutter: 0.8,
    grade: { tint: 0xffe2a8, alpha: 0.12, vignette: 0.3 },
  },
};

export function lookFor(mood: Mood): Look {
  return LOOKS[mood];
}

/** Relative luminance (0–1) of a #rrggbb colour, for value-structure checks. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Shadow offset (down-right, away from the upper-left sun) for something `height` units tall. */
export function shadowOffset(look: Look, height: number): { dx: number; dy: number } {
  const k = Math.min(1.6, height / 32);
  return { dx: look.shadow.length * 0.72 * k, dy: look.shadow.length * 0.5 * k };
}

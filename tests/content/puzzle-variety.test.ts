import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { JOURNEY_TO_BETHLEHEM } from '@/content/chapters/journey-to-bethlehem';
import { LETTER_FROM_PAUL } from '@/content/chapters/letter-from-paul';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';

/**
 * The owner asked for different puzzles, not jar filling in every chapter:
 * Chapter 1 keeps the four originals, and each later chapter has two puzzle
 * types of its own that no other chapter uses. Deduction and sequence
 * puzzles appear throughout.
 */
const chapters = [ROAD_TO_JERICHO, STORM_ON_GALILEE, JOURNEY_TO_BETHLEHEM, LETTER_FROM_PAUL].map(
  (c) => parseChapter(c),
);
const typesOf = (id: string) =>
  new Set(chapters.find((c) => c.id === id)?.puzzles.map((p) => p.type) ?? []);

describe('puzzle variety across the chapters', () => {
  it('only Chapter 1 fills jars or packs a bag', () => {
    for (const c of chapters.filter((x) => x.id !== 'road-to-jericho')) {
      const types = typesOf(c.id);
      expect(types.has('measuring'), c.id).toBe(false);
      expect(types.has('packing'), c.id).toBe(false);
    }
    expect(typesOf('road-to-jericho')).toEqual(
      new Set(['packing', 'measuring', 'deduction', 'sequence']),
    );
  });

  it('gives each later chapter two puzzle types that appear nowhere else', () => {
    const own: Record<string, string[]> = {
      'storm-on-galilee': ['trim', 'netting'],
      'journey-to-bethlehem': ['logicGrid', 'floorplan'],
      'letter-from-paul': ['map', 'dyeing'],
    };
    for (const [chapter, types] of Object.entries(own))
      for (const type of types) {
        const where = chapters.filter((c) => typesOf(c.id).has(type as never)).map((c) => c.id);
        expect(where, type).toEqual([chapter]);
      }
  });

  it('keeps the house style for every puzzle: intro, tiered hints ending in the full method, an explanation', () => {
    for (const c of chapters)
      for (const p of c.puzzles) {
        expect(p.intro.length, p.id).toBeGreaterThan(40);
        expect(p.hints.length, p.id).toBeGreaterThanOrEqual(3);
        expect(
          p.hints.map((h) => h.tier),
          p.id,
        ).toEqual(p.hints.map((_, i) => i + 1));
        expect(p.explanation.length, p.id).toBeGreaterThan(40);
      }
  });
});

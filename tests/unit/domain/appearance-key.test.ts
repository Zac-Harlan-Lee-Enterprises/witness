import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { appearanceKey } from '@/domain/appearance-key';
import { PLAYER_APPEARANCES } from '@/domain/characters';

describe('appearanceKey (domain)', () => {
  const chapter = parseChapter(ROAD_TO_JERICHO);
  const appearances = [
    ...chapter.characters.map((c) => c.appearance),
    ...Object.values(PLAYER_APPEARANCES),
  ];

  it('joins every appearance field in a fixed order (the art build computes the same key)', () => {
    expect(appearanceKey(PLAYER_APPEARANCES['look-1'])).toBe(
      [
        PLAYER_APPEARANCES['look-1'].skin,
        PLAYER_APPEARANCES['look-1'].hair,
        PLAYER_APPEARANCES['look-1'].robe,
        PLAYER_APPEARANCES['look-1'].accent,
        PLAYER_APPEARANCES['look-1'].headwear,
        PLAYER_APPEARANCES['look-1'].headwearColor,
        PLAYER_APPEARANCES['look-1'].beard ? 'beard' : 'clean',
        PLAYER_APPEARANCES['look-1'].build,
        PLAYER_APPEARANCES['look-1'].carry,
      ]
        .join('|')
        .toLowerCase(),
    );
  });

  it('is case-insensitive in its colours and tells appearances apart', () => {
    const a = PLAYER_APPEARANCES['look-1'];
    expect(appearanceKey({ ...a, robe: a.robe.toUpperCase() })).toBe(appearanceKey(a));
    const keys = new Set(appearances.map(appearanceKey));
    expect(keys.size).toBe(appearances.length);
  });
});

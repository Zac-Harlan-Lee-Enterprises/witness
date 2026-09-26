import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { appearanceKey } from '@/domain/appearance-key';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { appearanceKey as gameAppearanceKey } from '@/game/prerendered/select';

describe('appearanceKey (domain)', () => {
  const chapter = parseChapter(ROAD_TO_JERICHO);
  const appearances = [
    ...chapter.characters.map((c) => c.appearance),
    ...Object.values(PLAYER_APPEARANCES),
  ];

  it('gives exactly the key the pre-rendered art build and the game use', () => {
    for (const a of appearances) expect(appearanceKey(a)).toBe(gameAppearanceKey(a));
  });

  it('is case-insensitive in its colours and tells appearances apart', () => {
    const a = PLAYER_APPEARANCES['look-1'];
    expect(appearanceKey({ ...a, robe: a.robe.toUpperCase() })).toBe(appearanceKey(a));
    const keys = new Set(appearances.map(appearanceKey));
    expect(keys.size).toBe(appearances.length);
  });
});

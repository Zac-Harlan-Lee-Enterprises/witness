import { describe, expect, it } from 'vitest';
import { updatesAtOnce } from '@/app/update-policy';

describe('when a new version is swapped in', () => {
  it('at once outside a chapter, where nothing can be interrupted', () => {
    for (const screen of ['title', 'profiles', 'chapters', 'error'])
      expect(updatesAtOnce(screen), screen).toBe(true);
  });

  it('never by itself in a chapter, a teaser or while one loads (the player chooses)', () => {
    for (const screen of ['game', 'teaser', 'loading'])
      expect(updatesAtOnce(screen), screen).toBe(false);
  });
});

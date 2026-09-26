import type { Appearance } from './characters';

/**
 * A stable key for an authored appearance. Pre-rendered art (people sheets,
 * portraits) records the key of the appearance it was rendered from, so the
 * game only uses a picture while the appearance is unchanged.
 *
 * The output is identical to `appearanceKey` in src/game/prerendered/select.ts
 * (tests/unit/domain/appearance-key.test.ts proves it); this copy lets the
 * React features use it without importing the game layer.
 */
export function appearanceKey(a: Appearance): string {
  return [
    a.skin,
    a.hair,
    a.robe,
    a.accent,
    a.headwear,
    a.headwearColor,
    a.beard ? 'beard' : 'clean',
    a.build,
    a.carry,
  ]
    .join('|')
    .toLowerCase();
}

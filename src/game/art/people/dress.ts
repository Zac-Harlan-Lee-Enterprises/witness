import type { Appearance } from '@/domain/characters';
import type { LookMark } from '@/domain/world';
import { naturalColor, naturalSkin } from '@/shared/color';
import { mix, shade } from '../paint';
import type { Build } from './rig';

/**
 * What a person wears, in painted colours: the authored Appearance pulled
 * toward natural dyes, plus the marks the story has left on them.
 */
export interface Dress {
  build: Build;
  elder: boolean;
  skin: string;
  skinShadow: string;
  hair: string;
  beardColor: string;
  brow: string;
  tunic: string;
  stripe: string;
  belt: string;
  headwear: Appearance['headwear'];
  headColor: string;
  /** An outer wool mantle over the shoulders (shepherds, elders). */
  mantle: string | null;
  beard: boolean;
  carry: Appearance['carry'];
  /** Bandage colour on the forehead and ankle, if bandaged. */
  bandage: string | null;
  /** The player's spare cloak, if this person is wrapped in it. */
  cloak: string | null;
  tornHem: boolean;
  gear: {
    waterSkin: boolean;
    lamp: boolean;
    cloakRoll: boolean;
    lambOnShoulders: boolean;
    letterCase: boolean;
  };
}

/** The player's spare cloak: undyed brown wool with a madder cast. */
export const SPARE_CLOAK = '#7a4a34';
/** Clean linen bandage. */
export const LINEN = '#e8dfcb';

export function dressFor(a: Appearance, marks: readonly LookMark[], rag: string): Dress {
  const elder = a.build === 'elder';
  const skin = naturalSkin(a.skin);
  const hair = elder ? mix(a.hair, '#cfc8bb', 0.5) : a.hair;
  const tunic = naturalColor(a.robe);
  const stripe = naturalColor(a.accent);
  const has = (m: LookMark): boolean => marks.includes(m);
  return {
    build: a.build,
    elder,
    skin,
    skinShadow: mix(shade(skin, -0.34), '#6a2818', 0.16),
    hair,
    beardColor: elder ? mix(hair, '#e4dfd6', 0.3) : shade(hair, 0.06),
    brow: shade(hair, 0.08),
    tunic,
    stripe,
    belt: mix(stripe, '#4a3222', 0.5),
    headwear: a.headwear,
    headColor: naturalColor(a.headwearColor),
    mantle: elder ? mix(tunic, '#5e5140', 0.55) : null,
    beard: a.beard,
    carry: a.carry,
    bandage: has('bandaged') ? LINEN : has('rag-bandaged') ? naturalColor(rag) : null,
    cloak: has('wrapped-in-cloak') ? SPARE_CLOAK : null,
    tornHem: has('torn-hem'),
    gear: {
      waterSkin: has('water-skin'),
      lamp: has('lamp'),
      cloakRoll: has('cloak-roll'),
      lambOnShoulders: has('carrying-lamb'),
      letterCase: has('letter-case'),
    },
  };
}

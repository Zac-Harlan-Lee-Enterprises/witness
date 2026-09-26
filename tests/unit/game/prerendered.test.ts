import { describe, expect, it } from 'vitest';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { parsePeopleArt, parsePlaceArt } from '@/game/prerendered/manifest';
import {
  appearanceKey,
  artPathFor,
  depthRow,
  LATE_FROM_HOUR,
  sampleShade,
  shadeTint,
  sheetFor,
  turnPath,
  variantFor,
  wantsLowResolution,
} from '@/game/prerendered/select';

const variant = {
  ground: 'ground-day.webp',
  groundLow: 'ground-day-low.webp',
  shade: 'shade-day.webp',
  pages: ['sprites-day-0.webp'],
  sprites: [
    {
      id: 'stall-11-6',
      x: 342,
      y: 134,
      w: 345,
      h: 291,
      page: 0,
      u: 0,
      v: 0,
      base: 222.4,
      tiles: [[11, 6]],
    },
  ],
};

describe('pre-rendered place art', () => {
  it('validates a manifest and reports what is wrong with a bad one', () => {
    const ok = parsePlaceArt({
      version: 1,
      scene: 'jerusalem-market',
      tiles: { w: 34, h: 24 },
      ppu: 3,
      variants: { day: variant, late: variant },
    });
    expect(ok.error).toBeNull();
    expect(ok.art?.variants.day.sprites[0]?.id).toBe('stall-11-6');
    const bad = parsePlaceArt({
      version: 1,
      scene: 'x',
      tiles: { w: 0, h: 1 },
      ppu: 3,
      variants: {},
    });
    expect(bad.art).toBeNull();
    expect(bad.error).toBeTruthy();
  });

  it('knows which places have art and where it is served', () => {
    expect(artPathFor('jerusalem-market')).toBe('art/jerusalem-market/');
    expect(artPathFor('jericho-road')).toBeNull();
  });

  it('uses the later-day light from mid-afternoon, only when it exists', () => {
    expect(variantFor(8, ['day', 'late'])).toBe('day');
    expect(variantFor(LATE_FROM_HOUR, ['day', 'late'])).toBe('late');
    expect(variantFor(17, ['day'])).toBe('day');
    expect(variantFor(null, ['day', 'late'])).toBe('day');
  });

  it('loads half-resolution art on small views (phones) and in low-power mode', () => {
    expect(wantsLowResolution(3, 3, false)).toBe(false); // desktop, close framing
    expect(wantsLowResolution(2.75, 3, false)).toBe(false); // tablet
    expect(wantsLowResolution(1.75, 3, false)).toBe(true); // phone
    expect(wantsLowResolution(3, 3, true)).toBe(true);
  });

  it('sorts a sprite against people by its ground line', () => {
    // A stall standing on row 6 (front edge at 6.95 tiles) is behind someone on row 7…
    expect(depthRow((6 + 0.95) * 32)).toBeLessThan(7.5);
    // …and in front of someone on row 6.
    expect(depthRow((6 + 0.95) * 32)).toBeGreaterThan(6.5);
  });
});

describe('pre-rendered people', () => {
  const player = PLAYER_APPEARANCES['look-1'];
  const people = parsePeopleArt({
    'player-look-1': {
      appearance: appearanceKey(player),
      sheets: { day: 'player-look-1-day.webp' },
      frameWidth: 132,
      frameHeight: 204,
      originX: 66,
      originY: 186,
      ppu: 3,
      columns: ['idle'],
      rows: ['down'],
      shadows: {
        day: {
          sheet: 's.webp',
          frameWidth: 117,
          frameHeight: 81,
          originX: 21,
          originY: 21,
          ppu: 1.5,
        },
      },
    },
  }).people;

  it('finds a sheet by the authored appearance, and paints anyone with story marks', () => {
    expect(sheetFor(people, player, [])).toBe('player-look-1');
    expect(sheetFor(people, player, ['water-skin'])).toBeNull();
    expect(sheetFor(people, PLAYER_APPEARANCES['look-2'], [])).toBeNull();
    expect(sheetFor(null, player, [])).toBeNull();
  });

  it('keys appearances stably and distinctly', () => {
    expect(appearanceKey(player)).toBe(appearanceKey({ ...player }));
    expect(appearanceKey(player)).not.toBe(appearanceKey({ ...player, carry: 'none' }));
  });

  it('turns through a diagonal for a quarter turn and round the side for a half turn', () => {
    expect(turnPath('down', 'down')).toEqual([]);
    expect(turnPath('down', 'right')).toEqual(['down-right']);
    expect(turnPath('left', 'up')).toEqual(['up-left']);
    expect(turnPath('down', 'up')).toEqual(['down-left', 'left', 'up-left']);
  });

  it('dims and cools people in shade, and leaves them alone in sun', () => {
    expect(shadeTint(1)).toBe(0xffffff);
    const shaded = shadeTint(0);
    const r = (shaded >> 16) & 255;
    const b = shaded & 255;
    expect(r).toBeLessThan(200);
    expect(b).toBeGreaterThan(r);
  });

  it('samples sun visibility from the shade mask', () => {
    // 2x1 mask: sunlit on the left, shaded on the right.
    const mask = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
    };
    expect(sampleShade(mask, 0, 0, 64, 32)).toBeCloseTo(1, 2);
    expect(sampleShade(mask, 64, 0, 64, 32)).toBeCloseTo(0, 2);
    expect(sampleShade(mask, 32, 0, 64, 32)).toBeGreaterThan(0.3);
  });
});

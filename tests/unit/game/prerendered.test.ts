import { describe, expect, it } from 'vitest';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { parsePeopleArt, parsePlaceArt } from '@/game/prerendered/manifest';
import {
  appearanceKey,
  artPathFor,
  behindCanopy,
  depthRow,
  LATE_FROM_HOUR,
  pagesFor,
  peopleLightFor,
  pickSheets,
  PLACE_ART,
  sampleShade,
  shadeTint,
  sheetsToLoad,
  tileOrigin,
  turnPath,
  variantFor,
  wantsLowResolution,
} from '@/game/prerendered/select';
import { naturalColor } from '@/shared/color';

const variant = {
  ground: [
    { file: 'ground-day-x0y0.webp', x: 0, y: 0 },
    { file: 'ground-day-x1y0.webp', x: 1632, y: 0 },
  ],
  groundLow: [{ file: 'ground-day-low.webp', x: 0, y: 0 }],
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
    {
      id: 'palm-14-8-crown',
      x: 400,
      y: 100,
      w: 300,
      h: 240,
      page: 0,
      u: 0,
      v: 300,
      base: 275,
      tiles: [[14, 8]],
      fade: true,
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
    expect(ok.art?.variants.day.sprites[0]?.fade).toBe(false);
    expect(ok.art?.variants.day.sprites[1]?.fade).toBe(true);
    const bad = parsePlaceArt({
      version: 1,
      scene: 'x',
      tiles: { w: 0, h: 1 },
      ppu: 3,
      variants: {},
    });
    expect(bad.art).toBeNull();
    expect(bad.error).toBeTruthy();
    // A ground given as one file (before grounds were tiled) is refused, not guessed at.
    const untiled = parsePlaceArt({
      version: 1,
      scene: 'x',
      tiles: { w: 34, h: 24 },
      ppu: 3,
      variants: { day: { ...variant, ground: 'ground-day.webp' } },
    });
    expect(untiled.art).toBeNull();
  });

  it('places each ground tile at its pixel offset, in game units', () => {
    expect(tileOrigin({ x: 0, y: 0 }, 3)).toEqual({ x: 0, y: 0 });
    expect(tileOrigin({ x: 1536, y: 1440 }, 3)).toEqual({ x: 512, y: 480 });
    // The half-resolution ground has half the pixels per unit.
    expect(tileOrigin({ x: 1152, y: 0 }, 1.5)).toEqual({ x: 768, y: 0 });
  });

  it('knows which places have art and where it is served', () => {
    expect(artPathFor('jerusalem-market')).toBe('art/jerusalem-market/');
    expect(artPathFor('jericho-road')).toBe('art/jericho-road/');
    expect(artPathFor('miriam-house')).toBe('art/miriam-house/');
    expect(artPathFor('nowhere')).toBeNull();
    expect(Object.keys(PLACE_ART)).toContain('jericho');
  });

  it('uses the later-day light from mid-afternoon, only when it exists', () => {
    expect(variantFor(8, ['day', 'late'])).toBe('day');
    expect(variantFor(LATE_FROM_HOUR, ['day', 'late'])).toBe('late');
    expect(variantFor(17, ['day'])).toBe('day');
    expect(variantFor(null, ['day', 'late'])).toBe('day');
  });

  it('lights people for the room indoors, and by the place’s sun outdoors', () => {
    expect(peopleLightFor('day', undefined)).toBe('day');
    expect(peopleLightFor('late', undefined)).toBe('late');
    expect(peopleLightFor('day', 'indoor')).toBe('indoor');
    const room = parsePlaceArt({
      version: 1,
      scene: 'miriam-house',
      tiles: { w: 16, h: 11 },
      ppu: 3,
      peopleLight: 'indoor',
      variants: { day: variant },
    });
    expect(room.art?.peopleLight).toBe('indoor');
  });

  it('lights people as a place asks: under rain cloud, or at lamp-lighting', () => {
    expect(peopleLightFor('day', 'overcast')).toBe('overcast');
    expect(peopleLightFor('day', 'lamp')).toBe('lamp');
    for (const light of ['overcast', 'lamp'] as const) {
      const place = parsePlaceArt({
        version: 1,
        scene: 'lycus-road',
        tiles: { w: 46, h: 28 },
        ppu: 3,
        peopleLight: light,
        variants: { day: variant },
      });
      expect(place.error).toBeNull();
      expect(place.art?.peopleLight).toBe(light);
    }
    expect(
      parsePlaceArt({
        version: 1,
        scene: 'x',
        tiles: { w: 1, h: 1 },
        ppu: 3,
        peopleLight: 'moonlight',
        variants: { day: variant },
      }).art,
    ).toBeNull();
  });

  it('knows Chapter 4’s places', () => {
    for (const id of ['ammia-workshop', 'colossae-street', 'lycus-road', 'philemon-house'])
      expect(artPathFor(id)).toBe(`art/${id}/`);
  });

  it('loads half-resolution art on small views and in low-power mode', () => {
    expect(wantsLowResolution(3, 3, false)).toBe(false); // desktop, close framing
    expect(wantsLowResolution(2.75, 3, false)).toBe(false); // tablet
    expect(wantsLowResolution(1.75, 3, false)).toBe(true); // phone
    expect(wantsLowResolution(3, 3, true)).toBe(true);
  });

  it('takes the half-resolution sprite pages with the half-resolution ground, when they exist', () => {
    const both = { pages: ['a.webp', 'b.webp'], pagesLow: ['a-low.webp', 'b-low.webp'] };
    expect(pagesFor(both, false)).toEqual({ files: both.pages, scale: 1 });
    expect(pagesFor(both, true)).toEqual({ files: both.pagesLow, scale: 0.5 });
    expect(pagesFor({ pages: ['a.webp'] }, true)).toEqual({ files: ['a.webp'], scale: 1 });
    // A mismatched set is not trusted.
    expect(pagesFor({ pages: ['a.webp', 'b.webp'], pagesLow: ['a-low.webp'] }, true).scale).toBe(1);
  });

  it('sorts a sprite against people by its ground line', () => {
    // A stall standing on row 6 (front edge at 6.95 tiles) is behind someone on row 7…
    expect(depthRow((6 + 0.95) * 32)).toBeLessThan(7.5);
    // …and in front of someone on row 6.
    expect(depthRow((6 + 0.95) * 32)).toBeGreaterThan(6.5);
  });

  it('fades a canopy only while someone is behind it and under it', () => {
    const crown = { x: 400, y: 100, w: 300, h: 240, base: 275 }; // 100 x 80 units at 3 ppu
    expect(behindCanopy(crown, 3, 450, 170)).toBe(true); // under the crown, north of the trunk
    expect(behindCanopy(crown, 3, 450, 290)).toBe(false); // in front of the tree
    expect(behindCanopy(crown, 3, 300, 170)).toBe(false); // off to the side
    expect(behindCanopy(crown, 3, 450, 90)).toBe(false); // above the crown on screen
  });
});

describe('pre-rendered people', () => {
  const player = PLAYER_APPEARANCES['look-1'];
  const key = appearanceKey(player);
  const sheet = (extra: object) => ({
    appearance: key,
    sheets: { day: 'x.webp' },
    frameWidth: 132,
    frameHeight: 204,
    originX: 66,
    originY: 186,
    ppu: 3,
    columns: ['idle'],
    rows: ['down'],
    shadows: {
      day: { sheet: 's.webp', frameWidth: 117, frameHeight: 81, originX: 21, originY: 21, ppu: 1 },
    },
    ...extra,
  });
  const rag = naturalColor(player.robe).toLowerCase();
  const people = parsePeopleArt({
    'player-look-1': sheet({ sheets: { day: 'x.webp', overcast: 'o.webp', lamp: 'l.webp' } }),
    'player-look-1@letter-case': sheet({
      overlay: { mark: 'letter-case', of: 'player-look-1' },
      shadows: undefined,
    }),
    'player-look-1+torn-hem': sheet({ marks: ['torn-hem'] }),
    'player-look-1@water-skin': sheet({
      overlay: { mark: 'water-skin', of: 'player-look-1' },
      shadows: undefined,
    }),
    'player-look-1@lamp': sheet({ overlay: { mark: 'lamp', of: 'player-look-1' } }),
    'player-look-1~sit': sheet({ pose: 'sit' }),
    'player-look-1~sit@rag-bandaged-x': sheet({
      pose: 'sit',
      overlay: { mark: 'rag-bandaged', of: 'player-look-1~sit', rag },
    }),
    'crowd-0': sheet({ appearance: 'someone|else' }),
  }).people;

  it('reads sheets with poses, body marks and overlays', () => {
    expect(people).not.toBeNull();
    expect(people?.['player-look-1']?.pose).toBe('stand');
    expect(people?.['player-look-1~sit']?.pose).toBe('sit');
    expect(people?.['player-look-1@water-skin']?.shadows).toEqual({});
  });

  it('picks the sheet for someone, with overlays for what they carry', () => {
    expect(pickSheets(people, player, [])).toEqual({ base: 'player-look-1', overlays: [] });
    expect(pickSheets(people, player, ['lamp', 'water-skin'])).toEqual({
      base: 'player-look-1',
      overlays: ['player-look-1@water-skin', 'player-look-1@lamp'],
    });
  });

  it('draws the letter case at the hip over the rolled cloak, under a lamp', () => {
    expect(pickSheets(people, player, ['letter-case'])).toEqual({
      base: 'player-look-1',
      overlays: ['player-look-1@letter-case'],
    });
    expect(pickSheets(people, player, ['lamp', 'letter-case', 'water-skin'])?.overlays).toEqual([
      'player-look-1@water-skin',
      'player-look-1@letter-case',
      'player-look-1@lamp',
    ]);
    expect(people?.['player-look-1']?.sheets.overcast).toBe('o.webp');
    expect(people?.['player-look-1']?.sheets.lamp).toBe('l.webp');
  });

  it('uses the torn-hem sheet for a torn hem, with the same overlays', () => {
    expect(pickSheets(people, player, ['torn-hem', 'water-skin'])).toEqual({
      base: 'player-look-1+torn-hem',
      overlays: ['player-look-1@water-skin'],
    });
  });

  it('draws people at rest from their own sheets, and matches rag bandages by tunic colour', () => {
    expect(pickSheets(people, player, [], 'sit')?.base).toBe('player-look-1~sit');
    expect(pickSheets(people, player, ['rag-bandaged'], 'sit', player.robe)).toEqual({
      base: 'player-look-1~sit',
      overlays: ['player-look-1~sit@rag-bandaged-x'],
    });
    // Another tunic's rags have no overlay: painted.
    expect(pickSheets(people, player, ['rag-bandaged'], 'sit', '#112233')).toBeNull();
    expect(pickSheets(people, player, [], 'lie')).toBeNull();
  });

  it('paints anyone whose marks have no art, or who has no sheet at all', () => {
    expect(pickSheets(people, player, ['cloak-roll'])).toBeNull();
    expect(pickSheets(people, PLAYER_APPEARANCES['look-2'], [])).toBeNull();
    expect(pickSheets(null, player, [])).toBeNull();
  });

  it('loads every sheet of the people present, and the crowd only where there is one', () => {
    if (!people) throw new Error('no people');
    const ids = sheetsToLoad(people, [player], false, player.robe);
    expect(ids).toContain('player-look-1+torn-hem');
    expect(ids).toContain('player-look-1~sit@rag-bandaged-x');
    expect(ids).not.toContain('crowd-0');
    // Bandages torn from another tunic are never needed: not loaded.
    expect(sheetsToLoad(people, [player], false, '#112233')).not.toContain(
      'player-look-1~sit@rag-bandaged-x',
    );
    expect(sheetsToLoad(people, [player], false, '#112233')).toContain('player-look-1@lamp');
    expect(sheetsToLoad(people, [], true)).toEqual(['crowd-0']);
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

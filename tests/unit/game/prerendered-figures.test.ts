import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { CanopyFader } from '@/game/prerendered/canopy';
import { FigureBook } from '@/game/prerendered/figures';
import { attachLayers } from '@/game/prerendered/layers';
import { parsePeopleArt, type ArtSprite } from '@/game/prerendered/manifest';
import { appearanceKey, CANOPY_FADED } from '@/game/prerendered/select';

const player = PLAYER_APPEARANCES['look-1'];
const shadow = {
  sheet: 's.webp',
  frameWidth: 90,
  frameHeight: 60,
  originX: 60,
  originY: 40,
  ppu: 1,
};
const sheet = (extra: object) => ({
  appearance: appearanceKey(player),
  sheets: { day: 'x.webp', indoor: 'x-indoor.webp' },
  frameWidth: 132,
  frameHeight: 204,
  originX: 66,
  originY: 186,
  ppu: 3,
  columns: ['idle'],
  rows: ['down'],
  shadows: { day: shadow, indoor: shadow },
  ...extra,
});
const people = parsePeopleArt({
  'player-look-1': sheet({}),
  'player-look-1@lamp': sheet({ overlay: { mark: 'lamp', of: 'player-look-1' }, shadows: {} }),
  'crowd-0': sheet({ appearance: 'someone|else' }),
}).people;

describe('the figure book', () => {
  if (!people) throw new Error('people');
  const book = FigureBook.from(
    people,
    new Map([
      ['player-look-1', { key: 'person:x.webp', shadow: 'person:s.webp', light: 'day' as const }],
      ['player-look-1@lamp', { key: 'person:lamp.webp', shadow: null, light: 'day' as const }],
      ['crowd-0', { key: 'person:c.webp', shadow: 'person:s.webp', light: 'day' as const }],
    ]),
  );

  it('draws someone from their sheet, with the overlays for their marks as layers', () => {
    const plain = book.figure(player, [], 'stand', null);
    expect(plain?.key).toBe('person:x.webp');
    expect(plain?.layers).toBeUndefined();
    expect(book.figure(player, ['lamp'], 'stand', null)?.layers).toEqual(['person:lamp.webp']);
  });

  it('paints people it cannot draw (a mark or pose without art)', () => {
    expect(book.figure(player, ['cloak-roll'], 'stand', null)).toBeNull();
    expect(book.figure(player, [], 'lie', null)).toBeNull();
  });

  it("takes a shadow's frame metrics from the light its sheet was loaded in, not the body's", () => {
    const lateShadow = { ...shadow, sheet: 's-late.webp', frameWidth: 160, originX: 12 };
    const art = parsePeopleArt({
      'player-look-1': sheet({ shadows: { day: shadow, late: lateShadow } }),
    }).people;
    if (!art) throw new Error('people');
    // The body fell back to its day sheet; the shadow loaded is the late one.
    const lit = FigureBook.from(
      art,
      new Map([
        [
          'player-look-1',
          {
            key: 'person:x.webp',
            shadow: 'person:s-late.webp',
            light: 'day' as const,
            shadowLight: 'late' as const,
          },
        ],
      ]),
    );
    const figure = lit.figure(player, [], 'stand', null);
    expect(figure?.shadow.frameWidth).toBe(160);
    expect(figure?.shadow.originX).toBe(12);
  });

  it('lists the passers-by it has', () => {
    expect(book.crowd().map((f) => f.key)).toEqual(['person:c.webp']);
  });
});

describe('canopies', () => {
  const crown: ArtSprite = {
    id: 'palm-1-1-crown',
    x: 0,
    y: 0,
    w: 300,
    h: 300,
    page: 0,
    u: 0,
    v: 0,
    base: 200,
    tiles: [[1, 1]],
    fade: true,
  };
  const image = () => {
    const img = { alpha: 1, setAlpha: (a: number) => ((img.alpha = a), img) };
    return img;
  };

  it('fade while the player is behind them and come back after (at once with reduced motion)', () => {
    const fader = new CanopyFader(3, () => true);
    const img = image();
    fader.track(img as unknown as Phaser.GameObjects.Image, crown);
    fader.update(50, 120, 0.016);
    expect(img.alpha).toBeCloseTo(CANOPY_FADED);
    fader.update(50, 260, 0.016);
    expect(img.alpha).toBe(1);
  });

  it('ease the fade with motion allowed, and leave other sprites alone', () => {
    const fader = new CanopyFader(3, () => false);
    const img = image();
    const other = image();
    fader.track(img as unknown as Phaser.GameObjects.Image, crown);
    fader.track(other as unknown as Phaser.GameObjects.Image, { ...crown, fade: false });
    fader.update(50, 120, 0.05);
    expect(img.alpha).toBeLessThan(1);
    expect(img.alpha).toBeGreaterThan(CANOPY_FADED);
    expect(other.alpha).toBe(1);
  });

  it('forget a story prop once it is taken away (a sail brailed up and destroyed)', () => {
    const fader = new CanopyFader(3, () => true);
    const sail = {
      alpha: 1,
      active: true,
      scene: {} as unknown,
      setAlpha: (a: number) => ((sail.alpha = a), sail),
    };
    fader.track(sail as unknown as Phaser.GameObjects.Image, crown);
    fader.update(50, 120, 0.016);
    expect(sail.alpha).toBeCloseTo(CANOPY_FADED);
    // Destroyed: Phaser clears its scene and makes it inactive.
    sail.active = false;
    sail.scene = undefined;
    sail.alpha = 0.5;
    fader.update(50, 260, 0.016);
    expect(sail.alpha).toBe(0.5);
  });
});

describe('story-mark layers', () => {
  it('follow the person frame by frame, hide where they have nothing, and go with them', () => {
    const listeners = new Map<string, () => void>();
    const made: Array<Record<string, unknown>> = [];
    const fakeSprite = (frames: string[]) => {
      const s: Record<string, unknown> = {
        x: 0,
        y: 0,
        depth: 0,
        alpha: 1,
        visible: true,
        scaleX: 1 / 3,
        scaleY: 1 / 3,
        originX: 0.5,
        originY: 0.9,
        tintTopLeft: 0xffffff,
        tintTopRight: 0xffffff,
        tintBottomLeft: 0xffffff,
        tintBottomRight: 0xffffff,
        frame: { name: '__BASE' },
        texture: { has: (n: string) => frames.includes(n) },
        destroyed: false,
      };
      const chain =
        (fn: (...a: unknown[]) => void) =>
        (...a: unknown[]) => {
          fn(...a);
          return s;
        };
      Object.assign(s, {
        setOrigin: chain(() => undefined),
        setScale: chain(() => undefined),
        setFrame: chain((n) => (s.frame = { name: n })),
        setVisible: chain((v) => (s.visible = v)),
        setPosition: chain((x, y) => ((s.x = x), (s.y = y))),
        setDepth: chain((d) => (s.depth = d)),
        setAlpha: chain((a) => (s.alpha = a)),
        setTint: chain((t) => (s.tintTopLeft = t)),
        destroy: chain(() => (s.destroyed = true)),
      });
      return s;
    };
    const scene = {
      add: {
        sprite: vi.fn(() => {
          const s = fakeSprite(['down-0']);
          made.push(s);
          return s;
        }),
      },
      events: {
        on: (e: string, fn: () => void) => listeners.set(e, fn),
        off: (e: string) => listeners.delete(e),
      },
    };
    let onDestroy: () => void = () => undefined;
    const base = fakeSprite(['down-0', 'down-1']);
    Object.assign(base, {
      x: 100,
      y: 200,
      depth: 1210,
      frame: { name: 'down-0' },
      once: (_e: string, fn: () => void) => (onDestroy = fn),
    });
    const layers = attachLayers(
      scene as unknown as Phaser.Scene,
      base as unknown as Phaser.GameObjects.Sprite,
      ['person:lamp.webp'],
    );
    expect(layers).toHaveLength(1);
    const layer = made[0] as Record<string, unknown>;
    expect(layer.frame).toEqual({ name: 'down-0' });
    expect(layer.x).toBe(100);
    expect(layer.depth as number).toBeGreaterThan(1210);
    // The person moves on to a frame the overlay has nothing in.
    Object.assign(base, { frame: { name: 'down-1' }, x: 120, tintTopLeft: 0x9fa8c7 });
    listeners.get('postupdate')?.();
    expect(layer.visible).toBe(false);
    expect(layer.x).toBe(120);
    expect(layer.tintTopLeft).toBe(0x9fa8c7);
    onDestroy();
    expect(layer.destroyed).toBe(true);
    expect(listeners.has('postupdate')).toBe(false);
  });
});

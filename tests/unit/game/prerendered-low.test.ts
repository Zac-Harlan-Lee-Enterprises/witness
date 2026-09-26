import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { FigureBook } from '@/game/prerendered/figures';
import { loadPersons } from '@/game/prerendered/loader';
import { parsePeopleArt } from '@/game/prerendered/manifest';
import { appearanceKey } from '@/game/prerendered/select';

/**
 * Half-resolution people (phones): the loader takes a person's low sheets
 * when asked, falls back to the full ones when a low sheet can't load, and
 * the figure is drawn with the metrics of the sheet actually loaded.
 */
const player = PLAYER_APPEARANCES['look-1'];
const shadow = (sheet: string, ppu: number) => ({
  sheet,
  frameWidth: 84 * ppu,
  frameHeight: 54 * ppu,
  originX: 64 * ppu,
  originY: 42 * ppu,
  ppu,
});
const frame = { 'down-0': [0, 0, 10, 20, 1, 2] };
const person = (id: string, extra: object = {}) => ({
  appearance: appearanceKey(player),
  sheets: { day: `${id}-day.webp`, late: `${id}-late.webp` },
  frameWidth: 132,
  frameHeight: 204,
  originX: 66,
  originY: 186,
  ppu: 3,
  columns: ['idle'],
  rows: ['down'],
  shadows: { day: shadow(`${id}-shadow-day.webp`, 1), late: shadow(`${id}-shadow-late.webp`, 1) },
  low: {
    ppu: 1.5,
    frameWidth: 66,
    frameHeight: 102,
    originX: 33,
    originY: 93,
    sheets: { day: `${id}-day-low.webp`, late: `${id}-late-low.webp` },
    shadows: {
      day: shadow(`${id}-shadow-day-low.webp`, 0.5),
      late: shadow(`${id}-shadow-late-low.webp`, 0.5),
    },
  },
  atlas: Object.fromEntries(
    [
      `${id}-day.webp`,
      `${id}-late.webp`,
      `${id}-day-low.webp`,
      `${id}-late-low.webp`,
      `${id}-shadow-day.webp`,
      `${id}-shadow-late.webp`,
      `${id}-shadow-day-low.webp`,
      `${id}-shadow-late-low.webp`,
    ].map((f) => [f, frame]),
  ),
  ...extra,
});
const people = parsePeopleArt({
  'player-look-1': person('player-look-1'),
  'player-look-1@lamp': {
    ...person('lamp', { overlay: { mark: 'lamp', of: 'player-look-1' } }),
    shadows: {},
    low: { ...person('lamp').low, shadows: {} },
  },
  // Someone whose half-resolution sheets were never made.
  'crowd-0': { ...person('crowd-0', { appearance: 'someone|else' }), low: undefined },
}).people;

/** Just enough of a Phaser scene for the loader: files whose names match `fail` don't load. */
function fakeScene(fail: RegExp | null = null) {
  const textures = new Map<string, Set<string>>();
  const requested: string[] = [];
  const handlers = new Map<string, (arg?: unknown) => void>();
  let queue: string[] = [];
  const texture = (key: string) => {
    const frames = textures.get(key) ?? new Set<string>();
    return {
      has: (name: string) => frames.has(name),
      add: (name: string) => {
        frames.add(name);
        return { setTrim: () => undefined };
      },
    };
  };
  const scene = {
    textures: { exists: (k: string) => textures.has(k), get: texture },
    load: {
      image: (key: string) => queue.push(key),
      on: (event: string, fn: (arg?: unknown) => void) => handlers.set(event, fn),
      once: (event: string, fn: () => void) => handlers.set(event, fn),
      off: () => undefined,
      start: () => {
        for (const key of queue) {
          requested.push(key);
          if (fail?.test(key)) handlers.get('loaderror')?.({ key });
          else textures.set(key, new Set());
        }
        queue = [];
        handlers.get('complete')?.();
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, requested };
}

describe('half-resolution people', () => {
  if (!people) throw new Error('people');
  const ids = ['player-look-1', 'player-look-1@lamp', 'crowd-0'];

  it('loads the low sheets and shadows when asked, and the full ones otherwise', async () => {
    const { scene, requested } = fakeScene();
    const low = await loadPersons(scene, people, ids, 'late', true);
    expect(low.get('player-look-1')).toMatchObject({
      key: 'person:player-look-1-late-low.webp',
      shadow: 'person:player-look-1-shadow-late-low.webp',
      low: true,
    });
    expect(low.get('player-look-1@lamp')?.key).toBe('person:lamp-late-low.webp');
    // Without low sheets: the full ones.
    expect(low.get('crowd-0')).toMatchObject({ key: 'person:crowd-0-late.webp', low: false });
    expect(requested.filter((k) => k.startsWith('person:player-look-1'))).toEqual([
      'person:player-look-1-late-low.webp',
      'person:player-look-1-shadow-late-low.webp',
    ]);

    const full = await loadPersons(fakeScene().scene, people, ids, 'late');
    expect(full.get('player-look-1')).toMatchObject({
      key: 'person:player-look-1-late.webp',
      low: false,
    });
  });

  it('falls back to the full sheet in the same light when a low one fails, then to the morning', async () => {
    const lowLate = await loadPersons(fakeScene(/late-low/).scene, people, ids, 'late', true);
    expect(lowLate.get('player-look-1')).toMatchObject({
      key: 'person:player-look-1-late.webp',
      light: 'late',
      low: false,
    });
    const anyLate = await loadPersons(fakeScene(/late/).scene, people, ids, 'late', true);
    expect(anyLate.get('player-look-1')).toMatchObject({
      key: 'person:player-look-1-day-low.webp',
      light: 'day',
      low: true,
    });
  });

  it('draws someone with the size and origin of the sheet loaded', async () => {
    const book = FigureBook.from(
      people,
      await loadPersons(fakeScene().scene, people, ids, 'day', true),
    );
    const fig = book.figure(player, ['lamp'], 'stand', null);
    expect(fig).toMatchObject({
      key: 'person:player-look-1-day-low.webp',
      ppu: 1.5,
      frameWidth: 66,
      frameHeight: 102,
      originX: 33,
      originY: 93,
      layers: ['person:lamp-day-low.webp'],
    });
    expect(fig?.shadow).toMatchObject({ ppu: 0.5, frameWidth: 42, originX: 32 });
    expect(book.resolutions()).toEqual([1.5, 3]); // the crowd has no low sheets
  });

  it('paints someone whose overlay loaded at another resolution (it would not line up)', async () => {
    const mixed = await loadPersons(fakeScene(/lamp-day-low/).scene, people, ids, 'day', true);
    expect(mixed.get('player-look-1')?.low).toBe(true);
    expect(mixed.get('player-look-1@lamp')?.low).toBe(false);
    const book = FigureBook.from(people, mixed);
    expect(book.figure(player, ['lamp'], 'stand', null)).toBeNull();
    expect(book.figure(player, [], 'stand', null)?.ppu).toBe(1.5);
  });
});

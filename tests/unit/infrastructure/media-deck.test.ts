import { describe, expect, it } from 'vitest';
import { MUSIC_TRACKS, musicUrl } from '@/domain/music';
import { mediaDeckFactory } from '@/infrastructure/audio/media-deck';
import { MUSIC_CACHE, MUSIC_FILE, musicCacher } from '@/infrastructure/audio/music-cache';

/** Just enough of an <audio> element. */
class FakeElement {
  preload = '';
  src = '';
  currentTime = 0;
  paused = true;
  loads = 0;
  failWith: Error | null = null;
  private listeners = new Map<string, () => void>();
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, fn);
  }
  removeEventListener(type: string) {
    this.listeners.delete(type);
  }
  emit(type: string) {
    this.listeners.get(type)?.();
  }
  async play() {
    if (this.failWith) throw this.failWith;
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
  load() {
    this.loads++;
  }
}

function fakeContext() {
  const ramps: Array<[string, number, number]> = [];
  const disconnected: string[] = [];
  const node = (kind: string) => ({
    gain: {
      value: 0,
      cancelScheduledValues: () => undefined,
      setValueAtTime: (v: number, t: number) => ramps.push(['set', v, t]),
      linearRampToValueAtTime: (v: number, t: number) => ramps.push(['ramp', v, t]),
    },
    connect: (next: unknown) => next,
    disconnect: () => disconnected.push(kind),
  });
  const ctx = {
    currentTime: 10,
    createMediaElementSource: () => node('source'),
    createGain: () => node('gain'),
  };
  return { ctx: ctx as unknown as AudioContext, ramps, disconnected };
}

describe('mediaDeckFactory', () => {
  const track = MUSIC_TRACKS['sacred-sands'];
  const url = musicUrl(track, '/witness/');

  it('streams the file under the base path and fades through its own gain', async () => {
    const { ctx, ramps } = fakeContext();
    const el = new FakeElement();
    const played: string[] = [];
    const make = mediaDeckFactory(
      ctx,
      {} as AudioNode,
      (t) => musicUrl(t, '/witness/'),
      (u) => played.push(u),
      () => el as unknown as HTMLAudioElement,
    );
    const deck = make(track);
    expect(el.src).toBe('/witness/audio/music/sacred-sands.mp3?v=08aff384');
    expect(el.preload).toBe('auto');
    await deck.play(12);
    expect(el.currentTime).toBe(12);
    expect(el.paused).toBe(false);
    expect(played).toEqual([url]);
    deck.fade(0.8, 2);
    expect(ramps.at(-1)).toEqual(['ramp', 0.8, 12]);
    deck.fade(0, 0);
    expect(ramps.at(-1)).toEqual(['set', 0, 10]);
    el.currentTime = 30;
    expect(deck.time).toBe(30);
    expect(deck.ended).toBe(false);
    el.emit('ended');
    expect(deck.ended).toBe(true);
  });

  it('passes on a failed play, and lets the file go on dispose', async () => {
    const { ctx, disconnected } = fakeContext();
    const el = new FakeElement();
    el.failWith = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
    const deck = mediaDeckFactory(
      ctx,
      {} as AudioNode,
      (t) => musicUrl(t, '/'),
      () => {},
      () => el as unknown as HTMLAudioElement,
    )(track);
    await expect(deck.play()).rejects.toThrow('blocked');
    deck.dispose();
    deck.dispose();
    expect(el.src).toBe('');
    expect(el.loads).toBe(1);
    expect(disconnected).toEqual(['source', 'gain']);
    await expect(deck.play()).rejects.toThrow();
  });
});

/** A Cache Storage double. */
function fakeCaches() {
  const stored = new Map<string, true>();
  const added: string[] = [];
  let failAdd = false;
  const cache = {
    keys: async () => [...stored.keys()].map((url) => ({ url }) as Request),
    delete: async (r: Request) => stored.delete(r.url),
    match: async (url: string) =>
      stored.has(new URL(url, 'https://x.test/').href) ? {} : undefined,
    add: async (url: string) => {
      if (failAdd) throw new Error('quota');
      added.push(url);
      stored.set(new URL(url, 'https://x.test/').href, true);
    },
  };
  const opened: string[] = [];
  const caches = {
    open: async (name: string) => {
      opened.push(name);
      return cache;
    },
  } as unknown as CacheStorage;
  return {
    caches,
    stored,
    added,
    opened,
    fail: () => {
      failAdd = true;
    },
  };
}

describe('musicCacher', () => {
  const all = Object.values(MUSIC_TRACKS).map((t) => musicUrl(t, '/witness/'));
  const [oud = '', sands = ''] = all;
  globalThis.location ??= { href: 'https://x.test/witness/' } as Location;

  it('stores the playing track first, then the others, once', async () => {
    const c = fakeCaches();
    const errors: string[] = [];
    const cache = musicCacher(
      all,
      (m) => errors.push(m),
      () => ({
        caches: c.caches,
        controlled: true,
        saveData: false,
      }),
    );
    await cache(sands);
    await cache(oud);
    expect(c.opened).toEqual([MUSIC_CACHE]);
    expect(c.added[0]).toBe(sands);
    expect([...c.added].sort()).toEqual([...all].sort());
    expect(errors).toEqual([]);
  });

  it('removes files from older versions of the game', async () => {
    const c = fakeCaches();
    c.stored.set('https://x.test/witness/audio/music/sacred-sands.mp3?v=00000000', true);
    await musicCacher(
      all,
      () => {},
      () => ({ caches: c.caches, controlled: true, saveData: false }),
    )(oud);
    expect([...c.stored.keys()].some((k) => k.includes('v=00000000'))).toBe(false);
    expect(c.stored.size).toBe(all.length);
  });

  it('stores nothing without a service worker, on save-data, or without Cache Storage', async () => {
    for (const env of [
      { controlled: false, saveData: false },
      { controlled: true, saveData: true },
    ]) {
      const c = fakeCaches();
      await musicCacher(
        all,
        () => {},
        () => ({ caches: c.caches, ...env }),
      )(oud);
      expect(c.added).toEqual([]);
    }
    await expect(
      musicCacher(
        all,
        () => {},
        () => ({ caches: undefined, controlled: true, saveData: false }),
      )(oud),
    ).resolves.toBeUndefined();
  });

  it('reports a failure quietly (the music keeps streaming)', async () => {
    const c = fakeCaches();
    c.fail();
    const errors: string[] = [];
    await musicCacher(
      all,
      (m) => errors.push(m),
      () => ({
        caches: c.caches,
        controlled: true,
        saveData: false,
      }),
    )(oud);
    expect(errors).toEqual(['Music could not be stored for offline play']);
  });

  it("matches the game's music files for the service worker's route, under any base path", () => {
    for (const url of all) expect(MUSIC_FILE.test(`https://x.test${url}`)).toBe(true);
    expect(MUSIC_FILE.test('https://x.test/audio/music/music-sources.json')).toBe(false);
    expect(MUSIC_FILE.test('https://x.test/art/teaser/chapter-1/teaser.mp4')).toBe(false);
  });
});

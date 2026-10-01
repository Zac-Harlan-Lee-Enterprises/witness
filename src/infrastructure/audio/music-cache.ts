/**
 * Offline music (read by vite.config.ts, so the constants import nothing).
 *
 * The music files are several megabytes each and an <audio> element asks
 * for them with range requests, whose 206 partial answers can't be cached
 * whole. So the service worker serves them from the `witness-music` cache
 * with Workbox's range-request support (a cached 200 is cut into the 206
 * the element asked for), and this module fills that cache the documented
 * way (developer.chrome.com/docs/workbox/serving-cached-audio-and-video):
 * the first time music plays, the whole track is added to the cache
 * (Cache.add, a plain same-origin GET of the game's own file), then the
 * other tracks one after another, so a later chapter's music plays offline
 * too. Only where a service worker serves the game, never on a connection
 * that asks to save data, and quietly: a failure leaves the music
 * streaming as before.
 */
export const MUSIC_CACHE = 'witness-music';

/** The game's music files, as the service worker's route sees them (with or without ?v=). */
export const MUSIC_FILE = /\/audio\/music\/[^/?#]+\.mp3(?:[?#].*)?$/;

interface CacheEnv {
  caches?: CacheStorage;
  /** True when a service worker serves the page. */
  controlled: boolean;
  saveData: boolean;
}

function browserEnv(): CacheEnv {
  const nav = globalThis.navigator as
    (Navigator & { connection?: { saveData?: boolean } }) | undefined;
  return {
    caches: 'caches' in globalThis ? globalThis.caches : undefined,
    controlled: Boolean(nav?.serviceWorker?.controller),
    saveData: Boolean(nav?.connection?.saveData),
  };
}

/**
 * Caches the music for offline play: `first` (the track that just started)
 * at once, then the rest of `all` in order. Entries for URLs no longer in
 * `all` (an older ?v=) are removed. Returns a function to call each time a
 * track starts; the work runs once.
 */
export function musicCacher(
  all: readonly string[],
  onError: (message: string, error: unknown) => void,
  env: () => CacheEnv = browserEnv,
): (first: string) => Promise<void> {
  let started: Promise<void> | null = null;
  return (first) => {
    started ??= fill(first);
    return started;
  };

  async function fill(first: string): Promise<void> {
    const { caches, controlled, saveData } = env();
    if (!caches || !controlled || saveData) return;
    try {
      const cache = await caches.open(MUSIC_CACHE);
      const wanted = new Set(all.map((u) => new URL(u, globalThis.location?.href).href));
      for (const request of await cache.keys())
        if (!wanted.has(request.url)) await cache.delete(request);
      for (const url of [first, ...all.filter((u) => u !== first)])
        if (!(await cache.match(url))) await cache.add(url);
    } catch (error) {
      onError('Music could not be stored for offline play', error);
    }
  }
}

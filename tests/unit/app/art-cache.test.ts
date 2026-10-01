import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ART_RUNTIME_CACHE_ENTRIES,
  CACHED_ON_FIRST_USE_PEOPLE_LIGHTS,
  CACHED_ON_FIRST_USE_PLACES,
  CACHED_ON_FIRST_USE_PORTRAITS,
  TEASER_FILM,
} from '@/app/art-cache';
import { JOURNEY_TO_BETHLEHEM } from '@/content/chapters/journey-to-bethlehem';
import { LETTER_FROM_PAUL } from '@/content/chapters/letter-from-paul';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { STORM_ON_GALILEE } from '@/content/chapters/storm-on-galilee';

describe('offline caching of pre-rendered art', () => {
  const later = [STORM_ON_GALILEE, JOURNEY_TO_BETHLEHEM, LETTER_FROM_PAUL];

  it("caches every later chapter's places on first use instead of precaching them", () => {
    const places = new Set<string>(CACHED_ON_FIRST_USE_PLACES);
    for (const chapter of later)
      for (const scene of chapter.scenes)
        expect(places.has(scene.id), `${chapter.id}/${scene.id} is precached`).toBe(true);
  });

  it("keeps Chapter 1's places precached, so a first visit can play it offline", () => {
    const places = new Set<string>(CACHED_ON_FIRST_USE_PLACES);
    for (const scene of ROAD_TO_JERICHO.scenes) expect(places.has(scene.id)).toBe(false);
  });

  it('never leaves a Chapter 1 place needing people lit in a cached-on-first-use light', () => {
    const later = new Set<string>(CACHED_ON_FIRST_USE_PEOPLE_LIGHTS);
    for (const scene of ROAD_TO_JERICHO.scenes) {
      const file = join(__dirname, '../../../public/art', scene.id, 'manifest.json');
      const art = JSON.parse(readFileSync(file, 'utf8')) as {
        peopleLight?: string;
        variants: Record<string, unknown>;
      };
      expect(later.has(art.peopleLight ?? 'day'), scene.id).toBe(false);
      for (const variant of Object.keys(art.variants))
        expect(later.has(variant), scene.id).toBe(false);
    }
  });

  it('keeps room for several chapters of art in the runtime cache', () => {
    expect(ART_RUNTIME_CACHE_ENTRIES).toBeGreaterThanOrEqual(1000);
  });

  it('precaches every neutral portrait and caches the other expressions on first use', async () => {
    // Workbox's own matcher, on the files as they are (a glob that looked
    // right once left every portrait out of the precache).
    const { getManifest } = await import('workbox-build');
    const { manifestEntries = [] } = await getManifest({
      globDirectory: join(__dirname, '../../../public'),
      globPatterns: ['art/portraits/**/*.webp'],
      globIgnores: [CACHED_ON_FIRST_USE_PORTRAITS],
    });
    const urls = manifestEntries.map((e) => e.url);
    const manifest = JSON.parse(
      readFileSync(
        join(__dirname, '../../../src/features/portraits/portrait-manifest.json'),
        'utf8',
      ),
    ) as Record<string, { expressions?: string[] }>;
    const people = Object.keys(manifest);
    expect(people.length).toBeGreaterThan(40);
    for (const id of people)
      for (const size of [128, 256, 512])
        expect(urls).toContain(`art/portraits/${id}-${size}.webp`);
    expect(urls.filter((u) => u.split('/').length > 3)).toEqual([]);
    const config = readFileSync(join(__dirname, '../../../vite.config.ts'), 'utf8');
    expect(config).toContain('CACHED_ON_FIRST_USE_PORTRAITS,\n          ]');
    // Room in the runtime cache for every expression rendered, besides the places.
    const files = Object.values(manifest).reduce((n, e) => n + (e.expressions?.length ?? 0) * 3, 0);
    expect(files).toBeGreaterThan(0);
    expect(files).toBeLessThan(ART_RUNTIME_CACHE_ENTRIES / 3);
    // workbox-build is a heavy import: well under a second on an idle machine,
    // 16 s while Blender renders alongside (it timed out at the default 5 s).
  }, 60_000);

  it('never caches the teaser films, and fetches them from the network first', () => {
    for (const url of [
      '/art/teaser/chapter-1/teaser.mp4',
      '/witness/art/teaser/chapter-1/teaser.webm',
      'https://x.test/art/teaser/chapter-1/teaser.mp4?v=3',
    ])
      expect(TEASER_FILM.test(url), url).toBe(true);
    // The poster is an ordinary (precached) image, for the offline fallback.
    expect(TEASER_FILM.test('/art/teaser/chapter-1/poster.webp')).toBe(false);
    expect(TEASER_FILM.test('/art/jericho-road/ground-day.webp')).toBe(false);
    const config = readFileSync(join(__dirname, '../../../vite.config.ts'), 'utf8');
    const film = config.indexOf('urlPattern: TEASER_FILM');
    const art = config.indexOf("handler: 'CacheFirst'");
    expect(film).toBeGreaterThan(0);
    // Workbox takes the first route that matches: the teaser's comes before the art's.
    expect(film).toBeLessThan(art);
    expect(config.slice(film, film + 80)).toContain("handler: 'NetworkOnly'");
  });

  it("precaches the menus' key art, so the title and chapter select look right offline", async () => {
    // The build's own patterns (vite.config.ts), on the files as they are.
    const { getManifest } = await import('workbox-build');
    const { manifestEntries = [] } = await getManifest({
      globDirectory: join(__dirname, '../../../public'),
      globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2,webmanifest}'],
      globIgnores: [
        '**/art/**/*-late*.webp',
        ...CACHED_ON_FIRST_USE_PLACES.map((id) => `**/art/${id}/**`),
        ...CACHED_ON_FIRST_USE_PEOPLE_LIGHTS.map((light) => `**/art/people/*-${light}*.webp`),
        CACHED_ON_FIRST_USE_PORTRAITS,
        '**/art/people/**',
        '**/art/portraits/**',
      ],
    });
    const urls = manifestEntries.map((e) => e.url);
    for (const id of [
      'title',
      'road-to-jericho',
      'storm-on-galilee',
      'journey-to-bethlehem',
      'letter-from-paul',
    ]) {
      const small = id === 'title' ? 'title-960' : `${id}-800`;
      expect(urls).toContain(`art/key-art/${id}.webp`);
      expect(urls).toContain(`art/key-art/${small}.webp`);
    }
    const config = readFileSync(join(__dirname, '../../../vite.config.ts'), 'utf8');
    expect(config).toContain(
      "globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2,webmanifest}']",
    );
    expect(config).toContain("'**/art/**/*-late*.webp'");
  }, 60_000);

  it('precaches the teaser poster (the film itself is too big and not an image)', async () => {
    const { getManifest } = await import('workbox-build');
    const { manifestEntries = [] } = await getManifest({
      globDirectory: join(__dirname, '../../../public'),
      globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2,webmanifest}'],
      globIgnores: ['**/art/people/**', '**/art/portraits/**'],
    });
    const urls = manifestEntries.map((e) => e.url);
    expect(urls).toContain('art/teaser/chapter-1/poster.webp');
    expect(urls.some((u) => /\.(mp4|webm)$/.test(u))).toBe(false);
  }, 60_000);
});

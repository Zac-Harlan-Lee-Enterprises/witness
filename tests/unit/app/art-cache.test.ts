import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ART_RUNTIME_CACHE_ENTRIES,
  CACHED_ON_FIRST_USE_PEOPLE_LIGHTS,
  CACHED_ON_FIRST_USE_PLACES,
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
});

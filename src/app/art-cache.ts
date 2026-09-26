/**
 * Offline caching of pre-rendered art (read by vite.config.ts; no imports,
 * so the build config can load it directly).
 *
 * Chapter 1's places are precached, so a first-time visitor can play it
 * offline. Later chapters' places are cached the first time they are shown
 * instead: precaching every chapter would make a first visit download tens of
 * megabytes of art in the background. Offline before a place has been seen,
 * the game paints it (src/game/prerendered falls back to the Canvas painter).
 */
export const CACHED_ON_FIRST_USE_PLACES = [
  // Chapter 2, A Storm on Galilee
  'shelomit-house',
  'capernaum-shore',
  'open-lake',
  // Chapter 3, A Journey to Bethlehem
  'tamar-house',
  'bethlehem-lanes',
  'shepherds-fields',
  // Chapter 4, A Letter from Paul
  'ammia-workshop',
  'colossae-street',
  'lycus-road',
  'philemon-house',
] as const;

/**
 * People sheets in lights only later chapters use (a road under rain cloud,
 * lamplight, dusk, night) are cached on first use too; Chapter 1's people
 * are lit by day, later day or indoors, and stay precached.
 */
export const CACHED_ON_FIRST_USE_PEOPLE_LIGHTS = ['overcast', 'lamp', 'dusk', 'night'] as const;

/** Art files kept by the cache-on-first-use cache: room for every chapter's places, people and light variants. */
export const ART_RUNTIME_CACHE_ENTRIES = 1000;

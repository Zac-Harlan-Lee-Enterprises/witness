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
 * lamplight, night) are cached on first use too; Chapter 1's people
 * are lit by day, later day or indoors, and stay precached.
 */
export const CACHED_ON_FIRST_USE_PEOPLE_LIGHTS = ['overcast', 'lamp', 'night'] as const;

/**
 * Portraits: every person's neutral portrait is precached (the look picker,
 * chapter select and every first line need them), but the other
 * expressions (in folders under art/portraits/, one per expression) are
 * cached the first time a conversation that uses them opens (the dialogue
 * box preloads them then). Offline before that, the neutral portrait is
 * shown in their place.
 */
export const CACHED_ON_FIRST_USE_PORTRAITS = '**/art/portraits/*/*.webp';

/** Art files kept by the cache-on-first-use cache: room for every chapter's places, people, light variants and portrait expressions. */
export const ART_RUNTIME_CACHE_ENTRIES = 1500;

/**
 * Teaser films (art/teaser/<chapter>/teaser.mp4, .webm) are never cached:
 * they are several megabytes, watched once, and played with range requests
 * (a 206 partial response can't be cached whole). They are fetched from the
 * network only; offline, the teaser shows its poster and words instead
 * (src/features/teaser/TeaserPlayer.tsx). Their posters are small and
 * precached, so that fallback works offline.
 */
export const TEASER_FILM = /\/art\/teaser\/[^?#]+\.(?:mp4|webm)(?:[?#].*)?$/;

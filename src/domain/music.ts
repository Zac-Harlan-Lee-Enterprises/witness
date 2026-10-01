import { evaluate } from './conditions';
import type { GameState } from './state/game-state';
import type { Scene, SceneMusic } from './world';

/**
 * The game's background music: four recorded tracks from Pixabay, used
 * under the Pixabay Content License by the owner's decision of 2026-10-01
 * (docs/adr/0018-recorded-music.md). Their provenance (source page, file
 * size and SHA-256) is kept in public/audio/music/music-sources.json, and
 * tests/content/music.test.ts checks this catalogue against it.
 *
 * Pure data: the application chooses a track for each mood
 * (src/application/music.ts), infrastructure plays it, and the credits
 * list it.
 */
export const MUSIC_TRACK_IDS = [
  'cinematic-oud-and-qanun',
  'sacred-sands',
  'middle-eastern-cinematic-mystery',
  'meditative-middle-eastern-flute',
] as const;
export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number];

export interface MusicTrack {
  id: MusicTrackId;
  /** Relative to the site's base URL. */
  file: string;
  /**
   * The first 8 hex digits of the file's SHA-256 (music-sources.json): part
   * of its URL (?v=), so a replaced file is never served from an old cache.
   */
  version: string;
  title: string;
  artist: string;
  /** The track's page on Pixabay. */
  source: string;
  /** What a sound caption says while it plays. */
  caption: string;
  /**
   * Playback level (0–1) that evens out the tracks' loudness: measured
   * (whole-track RMS) at about −15, −15, −12 and −16.5 dBFS.
   */
  level: number;
  /**
   * The tracks fade out at their ends rather than looping cleanly, so a
   * pass ends at `end` seconds (cross-fading into the next pass) and the
   * next starts at `start`, past the first quiet half-second.
   */
  loop: { start: number; end: number };
}

/** A track's URL under the site's base URL (e.g. "/witness/"). */
export function musicUrl(track: Pick<MusicTrack, 'file' | 'version'>, base: string): string {
  return `${base}${track.file}?v=${track.version}`;
}

export const MUSIC_LICENSE = {
  name: 'Pixabay Content License',
  summaryUrl: 'https://pixabay.com/service/license-summary/',
  termsUrl: 'https://pixabay.com/service/terms/',
} as const;

export const MUSIC_TRACKS: Readonly<Record<MusicTrackId, MusicTrack>> = {
  'cinematic-oud-and-qanun': {
    id: 'cinematic-oud-and-qanun',
    file: 'audio/music/cinematic-oud-and-qanun.mp3',
    version: '8afd3874',
    title: 'Cinematic Oud and Qanun',
    artist: 'vjgalaxy',
    source: 'https://pixabay.com/music/arabic-cinematic-oud-and-qanun-588125/',
    caption: '[Warm music: oud and qanun]',
    level: 0.85,
    loop: { start: 0.6, end: 122 },
  },
  'sacred-sands': {
    id: 'sacred-sands',
    file: 'audio/music/sacred-sands.mp3',
    version: '08aff384',
    title: 'Sacred Sands Arabic Background Music with Ancient Desert Vibes',
    artist: 'DesiFreeMusic',
    source:
      'https://pixabay.com/music/world-sacred-sands-arabic-background-music-with-ancient-desert-vibes-504051/',
    caption: '[Steady travelling music with a hand drum]',
    level: 0.8,
    loop: { start: 0.8, end: 167.5 },
  },
  'middle-eastern-cinematic-mystery': {
    id: 'middle-eastern-cinematic-mystery',
    file: 'audio/music/middle-eastern-cinematic-mystery.mp3',
    version: '29a6be70',
    title: 'Middle Eastern Cinematic Mystery',
    artist: 'Sonican',
    source: 'https://pixabay.com/music/world-middle-eastern-cinematic-mystery-532031/',
    caption: '[Low, uneasy music]',
    level: 0.6,
    loop: { start: 0.6, end: 67 },
  },
  'meditative-middle-eastern-flute': {
    id: 'meditative-middle-eastern-flute',
    file: 'audio/music/meditative-middle-eastern-flute.mp3',
    version: '6cc46493',
    title: 'Meditative Middle Eastern Flute',
    artist: 'Ashot_Danielyan',
    source: 'https://pixabay.com/music/meditationspiritual-meditative-middle-eastern-flute-113656/',
    caption: '[Quiet flute music]',
    level: 1,
    loop: { start: 0.5, end: 212 },
  },
};

/** A place's music as the story stands, and any silence before it. */
export interface SceneMusicNow {
  music: SceneMusic;
  /** Seconds of silence before it, when the story has just changed it. */
  silence: number;
}

/**
 * The music in a scene right now: its base music, replaced by every change
 * whose condition holds (the last one wins). Pure, like weatherOf.
 */
export function musicOf(
  scene: Pick<Scene, 'music' | 'musicChanges'>,
  state: GameState,
): SceneMusicNow {
  let now: SceneMusicNow = { music: scene.music, silence: 0 };
  for (const change of scene.musicChanges)
    if (evaluate(change.when, state)) now = { music: change.music, silence: change.silence ?? 0 };
  return now;
}

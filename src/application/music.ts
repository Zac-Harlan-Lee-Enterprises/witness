import type { MusicTrackId } from '@/domain/music';
import type { FilmMood, FilmSection } from '@/domain/teaser';
import type { MusicId } from './ports';
import type { UiState } from './ui-store';

/**
 * Which recorded track plays for each mood (the owner's choice, 2026-10-01):
 *
 * - home, the markets and the menus: Cinematic Oud and Qanun;
 * - the journey and exploring: Sacred Sands;
 * - danger and the storm's tension: Middle Eastern Cinematic Mystery;
 * - reflection, Scripture, Paul's letter and the chapter endings:
 *   Meditative Middle Eastern Flute.
 *
 * Pure, so the choices are unit-tested without any audio.
 */
export const TRACK_FOR_MUSIC: Readonly<Record<Exclude<MusicId, 'none'>, MusicTrackId>> = {
  home: 'cinematic-oud-and-qanun',
  journey: 'sacred-sands',
  tension: 'middle-eastern-cinematic-mystery',
  reflection: 'meditative-middle-eastern-flute',
};

export function trackFor(music: MusicId): MusicTrackId | null {
  return music === 'none' ? null : TRACK_FOR_MUSIC[music];
}

/** The music for each section of a teaser's cue sheet. */
export const FILM_MOOD_MUSIC: Readonly<Record<FilmMood, MusicId>> = {
  dawn: 'home',
  home: 'home',
  market: 'home',
  road: 'journey',
  unease: 'tension',
  tension: 'tension',
  silence: 'none',
  resolve: 'reflection',
};

/** A change of track in a film: at `at` seconds of film, play `track` from `offset` seconds. */
export interface FilmMusicCue {
  at: number;
  track: MusicTrackId | null;
  offset: number;
}

/**
 * A film's music from `from` seconds on: one cue per change of track
 * (neighbouring sections with the same track are joined, so it never
 * restarts), the first at `from`, part-way into its track when the film
 * resumes in the middle of a section.
 */
export function filmMusicPlan(
  sections: readonly FilmSection[],
  duration: number,
  from: number,
): FilmMusicCue[] {
  const spans: Array<{ at: number; track: MusicTrackId | null }> = [];
  for (const s of sections) {
    const track = trackFor(FILM_MOOD_MUSIC[s.mood]);
    if (spans[spans.length - 1]?.track !== track) spans.push({ at: s.at, track });
  }
  return spans.flatMap((span, i) => {
    const end = spans[i + 1]?.at ?? duration;
    if (end <= from) return [];
    return span.at >= from
      ? [{ at: span.at, track: span.track, offset: 0 }]
      : [{ at: from, track: span.track, offset: from - span.at }];
  });
}

/** The ending's panels (Scripture Connection, reflection, summary) call for reflective music. */
export function musicWithPanel(scene: MusicId, panel: UiState['panel']): MusicId {
  return panel ? 'reflection' : scene;
}

/** Music is lowered under dialogue and while reading (the journal, Scripture Connection, reflection). */
export function musicDucked(ui: Pick<UiState, 'dialogue' | 'overlay' | 'panel'>): boolean {
  return (
    ui.dialogue !== null ||
    ui.overlay === 'journal' ||
    ui.panel === 'scripture-connection' ||
    ui.panel === 'reflection'
  );
}

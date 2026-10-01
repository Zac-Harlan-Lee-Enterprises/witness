import { MUSIC_LICENSE, MUSIC_TRACK_IDS, MUSIC_TRACKS } from '@/domain/music';

/**
 * Credits for the recorded music (docs/music.md): every track's title,
 * artist and source, and the licence it is used under.
 */
export function MusicCredits() {
  return (
    <section aria-labelledby="music-credits">
      <h3 id="music-credits">Music</h3>
      <ul className="credits">
        {MUSIC_TRACK_IDS.map((id) => {
          const track = MUSIC_TRACKS[id];
          return (
            <li key={id}>
              <cite>{track.title}</cite> by {track.artist} ·{' '}
              <a href={track.source} target="_blank" rel="noopener noreferrer">
                Pixabay<span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p>
        Used under the{' '}
        <a href={MUSIC_LICENSE.summaryUrl} target="_blank" rel="noopener noreferrer">
          {MUSIC_LICENSE.name}
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
        . The game’s sound effects and ambient sounds are its own.
      </p>
    </section>
  );
}

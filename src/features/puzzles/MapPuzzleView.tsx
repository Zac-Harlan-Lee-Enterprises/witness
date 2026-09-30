import { useState, type KeyboardEvent } from 'react';
import {
  DIRECTIONS,
  exitsFrom,
  isRoad,
  landmarkAt,
  walk,
  type Direction,
  type MapCheck,
  type MapPosition,
  type MapPuzzle,
} from '@/domain/puzzle-map';
import type { GameRuntimeLike } from '../game/types';

const ARROW: Record<string, Direction> = {
  ArrowUp: 'north',
  ArrowRight: 'east',
  ArrowDown: 'south',
  ArrowLeft: 'west',
};
const SIGN: Record<Direction, string> = { north: '↑', east: '→', south: '↓', west: '←' };

const list = (dirs: readonly string[]) =>
  dirs.length <= 1
    ? (dirs[0] ?? 'nowhere')
    : `${dirs.slice(0, -1).join(', ')} and ${dirs[dirs.length - 1] ?? ''}`;

/**
 * Map reading: follow written directions on a sketch map. The walk buttons
 * (or the arrow keys, while one of them has focus) walk north, east, south
 * or west until the next landmark or junction. Where you are, which way you
 * face and which ways the road goes are always written out, so the map
 * picture is never the only way to know.
 */
export function MapPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: MapPuzzle;
  runtime: GameRuntimeLike;
}) {
  const [at, setAt] = useState<MapPosition>(puzzle.start);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<MapCheck | null>(null);
  const exits = exitsFrom(puzzle, at.x, at.y);
  const here = landmarkAt(puzzle, at.x, at.y);
  const whereText = `${here ? `You are at ${here.label}` : 'You are on the road'}, facing ${at.facing}. The road goes ${list(exits)}.`;

  const go = (dir: Direction) => {
    const next = walk(puzzle, at, dir);
    setResult(null);
    if (!next) {
      setLog((l) => [...l, `There is no road ${dir} from here.`].slice(-8));
      return;
    }
    setAt(next.position);
    const landmark = landmarkAt(puzzle, next.position.x, next.position.y);
    const onward = exitsFrom(puzzle, next.position.x, next.position.y);
    setLog((l) =>
      [
        ...l,
        `Walked ${dir} ${next.steps === 1 ? 'a short way' : 'on'} to ${landmark ? landmark.label : 'a place where the road branches'}. The road goes ${list(onward)}.`,
      ].slice(-8),
    );
  };

  const onKey = (event: KeyboardEvent) => {
    const dir = ARROW[event.key];
    if (!dir) return;
    event.preventDefault();
    go(dir);
  };

  const width = puzzle.map[0]?.length ?? 0;
  // Landmarks are marked with letters and named in a key (one letter per kind: every milestone is M…).
  const labels = [...new Set(puzzle.landmarks.map((l) => l.label))];
  const letterOf = (label: string) => String.fromCharCode(65 + labels.indexOf(label));
  return (
    <div className="map-puzzle">
      <section aria-labelledby={`${puzzle.id}-directions`}>
        <h3 id={`${puzzle.id}-directions`} className="map-puzzle__heading">
          The directions
        </h3>
        <ol className="map-puzzle__directions">
          {puzzle.directions.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ol>
      </section>
      <div className="map-puzzle__body">
        <div
          className="map-grid"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {puzzle.map.flatMap((row, y) =>
            [...row].map((_, x) => {
              const landmark = landmarkAt(puzzle, x, y);
              const walker = at.x === x && at.y === y;
              const classes = [
                'map-cell',
                isRoad(puzzle, x, y) ? 'map-cell--road' : '',
                landmark ? 'map-cell--landmark' : '',
                walker ? 'map-cell--you' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={`${x},${y}`} className={classes} title={landmark?.label}>
                  {walker ? (
                    <span className="map-cell__you">{SIGN[at.facing]}</span>
                  ) : landmark ? (
                    letterOf(landmark.label)
                  ) : (
                    ''
                  )}
                </div>
              );
            }),
          )}
        </div>
        <section className="map-puzzle__key" aria-labelledby={`${puzzle.id}-key`}>
          <h3 id={`${puzzle.id}-key`} className="map-puzzle__heading">
            Key
          </h3>
          <ul>
            <li>
              <span className="map-key map-key--you" aria-hidden="true">
                {SIGN[at.facing]}
              </span>{' '}
              You
            </li>
            {labels.map((label) => (
              <li key={label}>
                <span className="map-key" aria-hidden="true">
                  {letterOf(label)}
                </span>{' '}
                {label}
              </li>
            ))}
          </ul>
        </section>
        <div className="map-puzzle__controls">
          <p className="map-puzzle__where" aria-live="polite">
            {whereText}
          </p>
          <div className="compass" role="group" aria-label="Walk">
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`button button--small compass__${d}`}
                aria-disabled={!exits.includes(d)}
                onClick={() => go(d)}
                onKeyDown={onKey}
              >
                <span aria-hidden="true">{SIGN[d]} </span>Walk {d}
              </button>
            ))}
          </div>
          <p className="meta-note">Arrow keys walk too, while a walk button has focus.</p>
          <div className="map-puzzle__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => setResult(runtime.puzzles.submitMapStop(puzzle.id, at))}
            >
              This is the place
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                setAt(puzzle.start);
                setResult(null);
                setLog((l) => [...l, 'Back to the start.'].slice(-8));
              }}
            >
              Back to the start
            </button>
          </div>
        </div>
      </div>
      <div aria-live="polite">
        {result && !result.correct && (
          <p className="feedback feedback--problem">{result.feedback}</p>
        )}
      </div>
      <ol className="step-log" aria-label="Where you’ve walked">
        {log.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ol>
    </div>
  );
}

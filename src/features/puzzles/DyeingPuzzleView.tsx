import { useState } from 'react';
import {
  checkDyeing,
  describeLevels,
  shadeName,
  type DyeingPuzzle,
  type Shade,
} from '@/domain/puzzle-dyeing';
import type { GameRuntimeLike } from '../game/types';

/**
 * A swatch colour for a shade (presentation only: every shade is also named
 * and described in words). Red and blue levels pull undyed cream toward a
 * madder red and a deep blue.
 */
function swatch(puzzle: DyeingPuzzle, shade: Shade): string {
  const cream = [240, 228, 205];
  const red = [165, 28, 40];
  const blue = [38, 48, 128];
  const wr = (shade.red ?? 0) / puzzle.max;
  const wb = (shade.blue ?? 0) / puzzle.max;
  const depth = Math.max(wr, wb);
  const channel = (i: number) => {
    const tint = wr + wb > 0 ? ((red[i] ?? 0) * wr + (blue[i] ?? 0) * wb) / (wr + wb) : 0;
    return Math.round((cream[i] ?? 0) * (1 - depth) + tint * depth);
  };
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

const nameOrLevels = (puzzle: DyeingPuzzle, shade: Shade): string => {
  const name = shadeName(puzzle, shade);
  const levels = describeLevels(puzzle, shade);
  return name ? `${name} (${levels})` : levels;
};

/**
 * Colour mixing: every bath is a button; the skein's shade is shown as a
 * swatch AND named in words, with its levels; a log narrates each dip. When
 * the dips run out, start again with a fresh skein.
 */
export function DyeingPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: DyeingPuzzle;
  runtime: GameRuntimeLike;
}) {
  const [dips, setDips] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const check = checkDyeing(puzzle, dips);
  const target = nameOrLevels(puzzle, puzzle.target);
  const spent = check.dipsLeft === 0 && !check.solved;

  const dip = (bathId: string) => {
    if (check.dipsLeft === 0) return;
    const next = [...dips, bathId];
    const result = checkDyeing(puzzle, next);
    const bath = puzzle.baths.find((b) => b.id === bathId);
    setDips(next);
    setLog((l) =>
      [
        ...l,
        `Dipped in ${bath?.label.toLowerCase() ?? bathId} → ${nameOrLevels(puzzle, result.shade)}. ${result.dipsLeft} ${result.dipsLeft === 1 ? 'dip' : 'dips'} left.`,
      ].slice(-8),
    );
    if (result.solved) runtime.puzzles.submitDyeing(puzzle.id, next);
  };

  return (
    <div className="dyeing">
      <div className="dyeing__swatches">
        <figure className="dyeing__swatch-box">
          <div
            className="dyeing__swatch"
            style={{ background: swatch(puzzle, puzzle.target) }}
            aria-hidden="true"
          />
          <figcaption>
            <strong>The sample:</strong> {target}
          </figcaption>
        </figure>
        <figure className="dyeing__swatch-box">
          <div
            className="dyeing__swatch"
            style={{ background: swatch(puzzle, check.shade) }}
            aria-hidden="true"
          />
          <figcaption>
            <strong>Your skein:</strong> {nameOrLevels(puzzle, check.shade)}
          </figcaption>
        </figure>
      </div>
      <p className="dyeing__dips">
        Dips used: <strong>{dips.length}</strong> of {puzzle.maxDips}
      </p>
      <ul className="dyeing__baths">
        {puzzle.baths.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              className="button button--small"
              disabled={check.dipsLeft === 0}
              onClick={() => dip(b.id)}
            >
              Dip in {b.label.toLowerCase()}
            </button>{' '}
            <span className="meta-note">{b.description}</span>
          </li>
        ))}
      </ul>
      {spent && (
        <p className="feedback feedback--problem" role="status">
          No dips left, and the skein is {nameOrLevels(puzzle, check.shade)}, not {target}. Try
          again with a fresh skein.
        </p>
      )}
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => {
          setDips([]);
          setLog([]);
        }}
      >
        Start with a fresh skein
      </button>
      <ol className="step-log" aria-live="polite" aria-label="What you’ve done">
        {log.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ol>
    </div>
  );
}

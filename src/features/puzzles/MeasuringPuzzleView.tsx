import { useState } from 'react';
import {
  applyMeasure,
  initialLevels,
  isMeasureSolved,
  type Levels,
  type MeasureAction,
  type MeasuringPuzzle,
} from '@/domain/puzzles';
import type { GameRuntimeLike } from '../game/types';

/** Pouring puzzle: vessels drawn as labelled bars; every action is a button; a step log narrates. */
export function MeasuringPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: MeasuringPuzzle;
  runtime: GameRuntimeLike;
}) {
  const [levels, setLevels] = useState<Levels>(() => initialLevels(puzzle));
  const [log, setLog] = useState<string[]>([]);
  const label = (id: string) => puzzle.vessels.find((v) => v.id === id)?.label ?? id;

  const act = (action: MeasureAction, description: string) => {
    const next = applyMeasure(puzzle, levels, action);
    setLevels(next);
    const summary = puzzle.vessels.map((v) => `${v.label}: ${next[v.id] ?? 0}`).join(', ');
    setLog((l) => [...l, `${description} → ${summary}`].slice(-8));
    if (isMeasureSolved(puzzle, next)) runtime.puzzles.submitMeasure(puzzle.id, next);
  };

  return (
    <div className="measuring">
      <p className="measuring__goal">
        Goal: exactly{' '}
        <strong>
          {puzzle.goal.amount} {puzzle.unit}
        </strong>{' '}
        in the {label(puzzle.goal.vessel).toLowerCase()}.
      </p>
      <div className="vessels">
        {puzzle.vessels.map((v) => {
          const level = levels[v.id] ?? 0;
          const others = puzzle.vessels.filter((o) => o.id !== v.id);
          return (
            <section key={v.id} className="vessel" aria-labelledby={`vessel-${v.id}`}>
              <h3 id={`vessel-${v.id}`} className="vessel__name">
                {v.label}
              </h3>
              <div className="vessel__jar" aria-hidden="true">
                {Array.from({ length: v.capacity }, (_, i) => (
                  <div
                    key={i}
                    className={`vessel__unit ${v.capacity - i <= level ? 'vessel__unit--full' : ''}`}
                  />
                ))}
              </div>
              <p className="vessel__level">
                {level} of {v.capacity} {puzzle.unit}
              </p>
              <div className="vessel__actions">
                <button
                  type="button"
                  className="button button--small"
                  onClick={() =>
                    act(
                      { type: 'fill', vessel: v.id },
                      `Filled the ${v.label.toLowerCase()} from ${puzzle.sourceLabel}`,
                    )
                  }
                >
                  Fill
                </button>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() =>
                    act({ type: 'empty', vessel: v.id }, `Emptied the ${v.label.toLowerCase()}`)
                  }
                >
                  Empty
                </button>
                {others.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="button button--small"
                    onClick={() =>
                      act(
                        { type: 'pour', from: v.id, to: o.id },
                        `Poured the ${v.label.toLowerCase()} into the ${o.label.toLowerCase()}`,
                      )
                    }
                  >
                    Pour into {o.label.toLowerCase()}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => {
          setLevels(initialLevels(puzzle));
          setLog([]);
        }}
      >
        Start over
      </button>
      <ol className="step-log" aria-live="polite" aria-label="What you’ve done">
        {log.map((entry, i) => (
          <li key={i}>{entry}</li>
        ))}
      </ol>
    </div>
  );
}

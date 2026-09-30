import { useState } from 'react';
import type { LogicGridCheck, LogicGridPuzzle } from '@/domain/puzzle-logic-grid';
import type { GameRuntimeLike } from '../game/types';
import { useGridFocus } from './useGridFocus';

type Mark = 'blank' | 'no' | 'yes';
const NEXT: Record<Mark, Mark> = { blank: 'no', no: 'yes', yes: 'blank' };
const MARK_TEXT: Record<Mark, string> = { blank: 'not decided', no: 'ruled out', yes: 'chosen' };
const MARK_SIGN: Record<Mark, string> = { blank: '', no: '✗', yes: '✓' };

/**
 * A logic grid: people down the side, places across the top. Press a cell
 * to rule it out (✗), again to choose it (✓), again to clear it. Choosing a
 * place rules out the rest of that row and column. Arrow keys move around.
 */
export function LogicGridPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: LogicGridPuzzle;
  runtime: GameRuntimeLike;
}) {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<LogicGridCheck | null>(null);
  const grid = useGridFocus(puzzle.subjects.length, puzzle.options.length);
  const key = (s: string, o: string) => `${s}|${o}`;
  const markOf = (s: string, o: string): Mark => marks[key(s, o)] ?? 'blank';

  const assignment = Object.fromEntries(
    puzzle.subjects.flatMap((s) => {
      const chosen = puzzle.options.find((o) => markOf(s.id, o.id) === 'yes');
      return chosen ? [[s.id, chosen.id]] : [];
    }),
  );

  const press = (subjectId: string, optionId: string) => {
    const mark = NEXT[markOf(subjectId, optionId)];
    const next: Record<string, Mark> = { ...marks, [key(subjectId, optionId)]: mark };
    if (mark === 'yes') {
      // The same row and column can't have another choice.
      for (const o of puzzle.options) if (o.id !== optionId) next[key(subjectId, o.id)] = 'no';
      for (const s of puzzle.subjects) if (s.id !== subjectId) next[key(s.id, optionId)] = 'no';
    }
    setMarks(next);
    setResult(null);
    const subject = puzzle.subjects.find((s) => s.id === subjectId)?.label ?? '';
    const option = puzzle.options.find((o) => o.id === optionId)?.label ?? '';
    setAnnounce(
      `${subject}, ${option}: ${MARK_TEXT[mark]}.${mark === 'yes' ? ' The rest of that row and column are ruled out.' : ''}`,
    );
  };

  return (
    <div className="logic-grid">
      <section aria-labelledby={`${puzzle.id}-clues`}>
        <h3 id={`${puzzle.id}-clues`} className="logic-grid__title">
          What you know
        </h3>
        <ol className="logic-grid__clues">
          {puzzle.clues.map((c) => (
            <li
              key={c.id}
              className={result?.broken.includes(c.id) ? 'logic-grid__clue--broken' : undefined}
            >
              {c.text}
              {result?.broken.includes(c.id) && (
                <span className="visually-hidden"> — this one doesn’t fit your answer</span>
              )}
            </li>
          ))}
        </ol>
      </section>
      <p className="meta-note">
        Press a square to rule it out (✗), again to choose it (✓), again to clear it. Arrow keys
        move around the grid.
      </p>
      <div className="table-scroll">
        <table className="logic-grid__table">
          <caption className="visually-hidden">
            {puzzle.subjectsLabel} down the side, {puzzle.optionsLabel.toLowerCase()} across the top
          </caption>
          <thead>
            <tr>
              <td />
              {puzzle.options.map((o) => (
                <th key={o.id} scope="col">
                  {o.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {puzzle.subjects.map((s, r) => (
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                {puzzle.options.map((o, c) => {
                  const mark = markOf(s.id, o.id);
                  return (
                    <td key={o.id}>
                      <button
                        type="button"
                        className={`logic-cell logic-cell--${mark}`}
                        aria-label={`${s.label}, ${o.label}: ${MARK_TEXT[mark]}`}
                        onClick={() => press(s.id, o.id)}
                        {...grid.cellProps(r, c)}
                      >
                        <span aria-hidden="true">{MARK_SIGN[mark]}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      <div className="logic-grid__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => setResult(runtime.puzzles.submitLogicGrid(puzzle.id, assignment))}
        >
          Check my answer
        </button>
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => {
            setMarks({});
            setResult(null);
            setAnnounce('The grid is cleared.');
          }}
        >
          Clear the grid
        </button>
      </div>
      <div aria-live="polite">
        {result && !result.correct && (
          <p className="feedback feedback--problem">{result.feedback}</p>
        )}
      </div>
    </div>
  );
}

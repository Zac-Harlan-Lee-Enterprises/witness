import { useState } from 'react';
import {
  checkNetting,
  cycleNetCell,
  initialNet,
  isTorn,
  type NetCell,
  type NetLineCheck,
  type NettingPuzzle,
} from '@/domain/puzzle-netting';
import type { GameRuntimeLike } from '../game/types';
import { useGridFocus } from './useGridFocus';

const CELL_TEXT: Record<NetCell, string> = {
  knot: 'knot tied',
  open: 'left open',
  unknown: 'torn, not yet mended',
};
const CELL_MARK: Record<NetCell, string> = { knot: '●', open: '×', unknown: '' };

const numbers = (runs: readonly number[]) => (runs.length > 0 ? runs.join(' ') : '0');
const lineStatus = (name: string, line: NetLineCheck | undefined) =>
  line
    ? `${name}: needs ${numbers(line.clue)}, ${line.matches ? 'matches' : `now ${numbers(line.current)}`}`
    : '';

/**
 * Net mending, a picture logic grid. Every torn cell is a button: press it
 * (Space or Enter) to tie a knot, again to mark it open, again to clear it.
 * Arrow keys move around the net. Each row and column shows its numbers
 * and whether it matches yet, in words as well as marks.
 */
export function NettingPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: NettingPuzzle;
  runtime: GameRuntimeLike;
}) {
  const [net, setNet] = useState(() => initialNet(puzzle));
  const [announce, setAnnounce] = useState('');
  const rows = puzzle.pattern.length;
  const cols = puzzle.pattern[0]?.length ?? 0;
  const firstTorn = (() => {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if (isTorn(puzzle, r, c)) return [r, c] as const;
    return [0, 0] as const;
  })();
  const grid = useGridFocus(rows, cols, firstTorn);
  const check = checkNetting(puzzle, net);

  const press = (r: number, c: number) => {
    if (!isTorn(puzzle, r, c)) {
      setAnnounce(`Row ${r + 1}, column ${c + 1} is not torn.`);
      return;
    }
    const next = cycleNetCell(puzzle, net, r, c);
    setNet(next);
    const result = checkNetting(puzzle, next);
    const cell = next[r]?.[c] ?? 'unknown';
    setAnnounce(
      `Row ${r + 1}, column ${c + 1}: ${CELL_TEXT[cell]}. ${lineStatus(`Row ${r + 1}`, result.rows[r])}. ${lineStatus(`Column ${c + 1}`, result.columns[c])}.`,
    );
    if (result.solved) runtime.puzzles.submitNetting(puzzle.id, next);
  };

  return (
    <div className="netting">
      <p className="meta-note">
        Press a torn cell to tie a knot (●), again to leave it open (×), and again to clear it.
        Arrow keys move around the net.
      </p>
      <div className="table-scroll">
        <table className="netting__grid">
          <caption className="visually-hidden">
            The net. Row numbers are on the left and column numbers along the top: the runs of
            knots, in order.
          </caption>
          <thead>
            <tr>
              <td />
              {check.columns.map((col, c) => (
                <th
                  key={c}
                  scope="col"
                  className={col.matches ? 'netting__clue netting__clue--done' : 'netting__clue'}
                >
                  <span className="visually-hidden">Column {c + 1}: </span>
                  {col.clue.map((n, i) => (
                    <span key={i} className="netting__num">
                      {n}
                    </span>
                  ))}
                  <span className="visually-hidden">
                    {col.matches ? ' — matches' : ' — not yet'}
                  </span>
                  {col.matches && <span aria-hidden="true">✓</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {net.map((row, r) => {
              const line = check.rows[r];
              return (
                <tr key={r}>
                  <th
                    scope="row"
                    className={
                      line?.matches ? 'netting__clue netting__clue--done' : 'netting__clue'
                    }
                  >
                    <span className="visually-hidden">Row {r + 1}: </span>
                    {numbers(line?.clue ?? [])}
                    <span className="visually-hidden">
                      {line?.matches ? ' — matches' : ' — not yet'}
                    </span>
                    {line?.matches && <span aria-hidden="true"> ✓</span>}
                  </th>
                  {row.map((cell, c) => {
                    const torn = isTorn(puzzle, r, c);
                    return (
                      <td key={c}>
                        <button
                          type="button"
                          className={`net-cell net-cell--${cell}${torn ? ' net-cell--torn' : ''}`}
                          aria-label={`Row ${r + 1}, column ${c + 1}: ${torn ? CELL_TEXT[cell] : cell === 'knot' ? 'knot, intact' : 'open, intact'}`}
                          aria-disabled={!torn}
                          onClick={() => press(r, c)}
                          {...grid.cellProps(r, c)}
                        >
                          <span aria-hidden="true">{CELL_MARK[cell]}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => {
          setNet(initialNet(puzzle));
          setAnnounce('The torn cells are cleared.');
        }}
      >
        Start over
      </button>
    </div>
  );
}

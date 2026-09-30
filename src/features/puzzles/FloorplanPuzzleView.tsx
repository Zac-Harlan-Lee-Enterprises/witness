import { useState, type KeyboardEvent } from 'react';
import {
  placementCells,
  placementProblem,
  placePiece,
  shapeCells,
  type FloorplanCheck,
  type FloorplanPuzzle,
  type PiecePlacement,
  type PlacementProblem,
} from '@/domain/puzzle-floorplan';
import type { GameRuntimeLike } from '../game/types';
import { useGridFocus } from './useGridFocus';

const TURNS = ['as drawn', 'turned a quarter', 'turned half way', 'turned three quarters'];

/**
 * Fit pieces onto a floor grid. Choose a piece, turn it if you like (the
 * Turn button, or R), then press the floor square where its first square
 * should go (Space or Enter on a square; arrows move around the floor). The
 * floor shows where the chosen piece would land, and says why it won't fit
 * when it won't.
 */
export function FloorplanPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: FloorplanPuzzle;
  runtime: GameRuntimeLike;
}) {
  const rows = puzzle.floor.length;
  const cols = puzzle.floor[0]?.length ?? 0;
  const [placements, setPlacements] = useState<PiecePlacement[]>([]);
  const [selected, setSelected] = useState<string | null>(puzzle.pieces[0]?.item ?? null);
  const [turns, setTurns] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<FloorplanCheck | null>(null);
  const live = runtime.puzzles.checkFloorplan(puzzle.id, placements);
  const labelOf = (item: string) => puzzle.pieces.find((p) => p.item === item)?.label ?? item;
  const piece = puzzle.pieces.find((p) => p.item === selected);
  const turn = () => {
    const next = (turns + 1) % 4;
    setTurns(next);
    if (piece) setAnnounce(`${piece.label}: ${TURNS[next] ?? ''}.`);
  };

  const grid = useGridFocus(rows, cols, [0, 0], (event: KeyboardEvent) => {
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      turn();
    }
  });

  const candidateAt = (row: number, col: number): PiecePlacement | null => {
    if (!piece) return null;
    const [first] = shapeCells(piece.shape, turns);
    return { item: piece.item, row: row - (first?.[0] ?? 0), col: col - (first?.[1] ?? 0), turns };
  };
  const [ar, ac] = grid.active;
  const preview = candidateAt(ar, ac);
  const previewProblem = preview ? placementProblem(puzzle, placements, preview) : null;
  const previewCells = new Set(
    preview ? placementCells(puzzle, preview).map(([r, c]) => `${r},${c}`) : [],
  );

  const occupant = (r: number, c: number) =>
    placements.find((p) => placementCells(puzzle, p).some(([pr, pc]) => pr === r && pc === c));
  const describeCell = (r: number, c: number): string => {
    const ch = puzzle.floor[r]?.[c] ?? '.';
    if (ch !== '.') return puzzle.fixtures.find((f) => f.symbol === ch)?.label ?? 'something fixed';
    const on = occupant(r, c);
    return on ? labelOf(on.item) : 'open floor';
  };
  const problemText = (p: PlacementProblem): string =>
    p.kind === 'outside'
      ? 'it would stick out past the wall'
      : p.kind === 'fixture'
        ? `it would cover ${p.label}`
        : `it would lie on ${labelOf(p.item)}`;

  const place = (r: number, c: number) => {
    const candidate = candidateAt(r, c);
    if (!candidate) {
      setAnnounce('Choose a piece first.');
      return;
    }
    const problem = placementProblem(puzzle, placements, candidate);
    if (problem) {
      setAnnounce(`${labelOf(candidate.item)} won’t go there: ${problemText(problem)}.`);
      return;
    }
    const next = placePiece(puzzle, placements, candidate);
    setPlacements(next);
    setResult(null);
    const cells = placementCells(puzzle, candidate)
      .map(([pr, pc]) => `row ${pr + 1} column ${pc + 1}`)
      .join(', ');
    setAnnounce(`${labelOf(candidate.item)} placed on ${cells}.`);
    const nextPiece = puzzle.pieces.find((p) => !next.some((n) => n.item === p.item));
    setSelected(nextPiece?.item ?? null);
    setTurns(0);
  };

  return (
    <div className="floorplan">
      <section aria-labelledby={`${puzzle.id}-pieces`}>
        <h3 id={`${puzzle.id}-pieces`} className="floorplan__heading">
          What could go in
        </h3>
        <ul className="floorplan__pieces">
          {puzzle.pieces.map((p) => {
            const onFloor = placements.some((x) => x.item === p.item);
            return (
              <li key={p.item} className="floorplan__piece">
                <button
                  type="button"
                  className="trim__item"
                  aria-pressed={selected === p.item}
                  onClick={() => {
                    setSelected(p.item);
                    setTurns(placements.find((x) => x.item === p.item)?.turns ?? 0);
                    setAnnounce(
                      `${p.label} chosen${onFloor ? ' (it is on the floor; place it again to move it)' : ''}. Press a floor square to put it there.`,
                    );
                  }}
                >
                  <ShapePicture shape={p.shape} turns={selected === p.item ? turns : 0} />
                  {p.label}
                  <span className="meta-note"> · {onFloor ? 'on the floor' : 'not placed'}</span>
                </button>
                {onFloor && (
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => {
                      setPlacements(placements.filter((x) => x.item !== p.item));
                      setResult(null);
                      setAnnounce(`${p.label} taken off the floor.`);
                    }}
                  >
                    Take it out
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <button type="button" className="button button--small" onClick={turn} disabled={!piece}>
          Turn it (R)
        </button>{' '}
        <span className="meta-note">
          {piece ? `${piece.label}, ${TURNS[turns] ?? ''}` : 'Nothing chosen'}
        </span>
      </section>
      <p className="meta-note floorplan__preview">
        {piece
          ? previewProblem
            ? `At row ${ar + 1}, column ${ac + 1}: ${problemText(previewProblem)}.`
            : `At row ${ar + 1}, column ${ac + 1}: it would fit.`
          : 'Choose a piece to place.'}
      </p>
      <div className="table-scroll">
        <table className="floorplan__floor">
          <caption className="visually-hidden">
            The floor, {rows} rows by {cols} columns
          </caption>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => {
                  const ch = puzzle.floor[r]?.[c] ?? '.';
                  const on = occupant(r, c);
                  const fixture = ch !== '.';
                  const text = describeCell(r, c);
                  const pieceIndex = on ? puzzle.pieces.findIndex((p) => p.item === on.item) : -1;
                  const classes = [
                    'floor-cell',
                    fixture ? 'floor-cell--fixture' : '',
                    on ? `floor-cell--piece floor-cell--piece-${pieceIndex}` : '',
                    previewCells.has(`${r},${c}`)
                      ? previewProblem
                        ? 'floor-cell--preview-bad'
                        : 'floor-cell--preview'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={c}>
                      <button
                        type="button"
                        className={classes}
                        aria-label={`Row ${r + 1}, column ${c + 1}: ${text}`}
                        onClick={() => place(r, c)}
                        {...grid.cellProps(r, c)}
                      >
                        <span aria-hidden="true" className="floor-cell__text">
                          {fixture
                            ? text.replace(/^the /, '')
                            : on
                              ? labelOf(on.item).slice(0, 12)
                              : ''}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-labelledby={`${puzzle.id}-room-rules`}>
        <h3 id={`${puzzle.id}-room-rules`} className="floorplan__heading">
          Checklist
        </h3>
        <ul className="checklist">
          {puzzle.rules.map((rule) => {
            const failing = live?.failures.some((f) => f.ruleId === rule.id) ?? true;
            return (
              <li
                key={rule.id}
                className={failing ? 'checklist__item' : 'checklist__item checklist__item--done'}
              >
                <span aria-hidden="true">{failing ? '○' : '✓'} </span>
                {rule.description}
                <span className="visually-hidden">{failing ? ' — not yet' : ' — done'}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      <div className="packing__submit">
        <button
          type="button"
          className="button button--primary"
          onClick={() => setResult(runtime.puzzles.submitFloorplan(puzzle.id, placements))}
        >
          The room is ready
        </button>
      </div>
      <div aria-live="polite">
        {result && !result.valid && (
          <ul className="feedback feedback--problem">
            {result.failures.map((f) => (
              <li key={f.ruleId}>{f.hint}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A small drawing of a piece's shape (decorative: the label says what it is). */
function ShapePicture({ shape, turns }: { shape: readonly string[]; turns: number }) {
  const cells = shapeCells(shape, turns);
  const h = Math.max(...cells.map(([r]) => r)) + 1;
  const w = Math.max(...cells.map(([, c]) => c)) + 1;
  const covered = new Set(cells.map(([r, c]) => `${r},${c}`));
  return (
    <span className="shape-picture" aria-hidden="true" data-cols={w}>
      {Array.from({ length: h }, (_, r) => (
        <span key={r} className="shape-picture__row">
          {Array.from({ length: w }, (_, c) => (
            <span
              key={c}
              className={
                covered.has(`${r},${c}`)
                  ? 'shape-picture__cell shape-picture__cell--on'
                  : 'shape-picture__cell'
              }
            />
          ))}
        </span>
      ))}
    </span>
  );
}

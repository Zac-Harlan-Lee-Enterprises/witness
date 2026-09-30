import { useState } from 'react';
import type { Puzzle } from '@/domain/puzzles';
import { ContentBlock } from '../common/ContentBlock';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';
import { DeductionPuzzleView } from './DeductionPuzzleView';
import { DyeingPuzzleView } from './DyeingPuzzleView';
import { FloorplanPuzzleView } from './FloorplanPuzzleView';
import { LogicGridPuzzleView } from './LogicGridPuzzleView';
import { MapPuzzleView } from './MapPuzzleView';
import { MeasuringPuzzleView } from './MeasuringPuzzleView';
import { PackingPuzzleView } from './PackingPuzzleView';
import { NettingPuzzleView } from './NettingPuzzleView';
import { SequencePuzzleView } from './SequencePuzzleView';
import { TrimPuzzleView } from './TrimPuzzleView';

/**
 * Hosts whichever puzzle is open. Each puzzle type has its own view
 * (open/closed: add a type → add a view). Hints are tiered and never
 * required; there is no timer and no penalty.
 */
export function PuzzleHost({ runtime }: { runtime: GameRuntimeLike }) {
  const ui = useStore(runtime.ui);
  const puzzle = ui.puzzleId ? runtime.puzzles.find(ui.puzzleId) : null;
  if (!puzzle) return null;
  return <PuzzleModal key={puzzle.id} puzzle={puzzle} runtime={runtime} />;
}

function PuzzleModal({ puzzle, runtime }: { puzzle: Puzzle; runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const solved = state.puzzles[puzzle.id]?.status === 'solved';
  const close = () => runtime.controller.closePuzzle();
  const records = runtime.chapter.records.filter((r) => puzzle.recordIds.includes(r.id));

  return (
    <Modal
      title={puzzle.title}
      onClose={solved ? undefined : close}
      closeLabel="Step away"
      className="modal--wide puzzle"
    >
      <p className="puzzle__intro">{puzzle.intro}</p>
      {solved ? (
        <div className="puzzle__solved" role="status">
          <p className="puzzle__solved-title">
            <span aria-hidden="true">✓ </span>Solved!
          </p>
          <p>{puzzle.explanation}</p>
          {records.length > 0 && (
            <details className="puzzle__background">
              <summary>Learn more about the background</summary>
              {records.map((r) => (
                <ContentBlock
                  key={r.id}
                  record={r}
                  sources={runtime.chapter.sources}
                  headingLevel={4}
                />
              ))}
            </details>
          )}
          <button type="button" className="button button--primary" onClick={close}>
            Continue
          </button>
        </div>
      ) : (
        <>
          {puzzle.type === 'packing' && <PackingPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'measuring' && <MeasuringPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'deduction' && <DeductionPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'sequence' && <SequencePuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'trim' && <TrimPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'netting' && <NettingPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'floorplan' && <FloorplanPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'logicGrid' && <LogicGridPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'dyeing' && <DyeingPuzzleView puzzle={puzzle} runtime={runtime} />}
          {puzzle.type === 'map' && <MapPuzzleView puzzle={puzzle} runtime={runtime} />}
          <Hints puzzleId={puzzle.id} runtime={runtime} total={puzzle.hints.length} />
        </>
      )}
    </Modal>
  );
}

function Hints({
  puzzleId,
  runtime,
  total,
}: {
  puzzleId: string;
  runtime: GameRuntimeLike;
  total: number;
}) {
  const [hints, setHints] = useState<string[]>(() => runtime.puzzles.revealedHints(puzzleId));
  return (
    <section className="hints" aria-labelledby={`${puzzleId}-hints`}>
      <h3 id={`${puzzleId}-hints`} className="hints__title">
        Hints
      </h3>
      <ol className="hints__list" aria-live="polite">
        {hints.map((h, i) => (
          <li key={i}>
            <strong>{i === total - 1 ? 'Full explanation: ' : `Hint ${i + 1}: `}</strong>
            {h}
          </li>
        ))}
      </ol>
      {hints.length < total && (
        <button
          type="button"
          className="button button--small"
          onClick={() => setHints(runtime.puzzles.requestHint(puzzleId))}
        >
          {hints.length === total - 1 ? 'Show the full explanation' : 'Get a hint'}
        </button>
      )}
    </section>
  );
}

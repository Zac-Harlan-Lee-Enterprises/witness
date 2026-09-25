import { useState } from 'react';
import type { SequenceCheck, SequencePuzzle } from '@/domain/puzzles';
import { useStore } from '../common/hooks';
import type { GameRuntimeLike } from '../game/types';

/**
 * Order the events (move up / move down buttons — no dragging required),
 * then choose a conclusion that honestly states what the evidence can and
 * can't prove.
 */
export function SequencePuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: SequencePuzzle;
  runtime: GameRuntimeLike;
}) {
  const state = useStore(runtime.session.store);
  const [order, setOrder] = useState<string[]>(puzzle.initialOrder);
  const [check, setCheck] = useState<SequenceCheck | null>(null);
  const [ordered, setOrdered] = useState(false);
  const [conclusion, setConclusion] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [announce, setAnnounce] = useState('');

  const found = puzzle.requiresClues
    ? puzzle.requiresClues.clues.filter((c) => state.clues.includes(c)).length
    : 0;
  if (puzzle.requiresClues && found < puzzle.requiresClues.min) {
    return (
      <p>
        You need to look around more before you can piece this together ({found} of{' '}
        {puzzle.requiresClues.min} signs found).
      </p>
    );
  }

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [card] = next.splice(index, 1);
    next.splice(target, 0, card as string);
    setOrder(next);
    setCheck(null);
    const text = puzzle.cards.find((c) => c.id === card)?.text ?? '';
    setAnnounce(`Moved to position ${target + 1}: ${text}`);
  };

  if (ordered && puzzle.conclusion) {
    return (
      <form
        className="sequence-conclusion"
        onSubmit={(e) => {
          e.preventDefault();
          if (conclusion) setVerdict(runtime.puzzles.submitConclusion(puzzle.id, conclusion));
        }}
      >
        <p className="feedback feedback--good">
          <span aria-hidden="true">✓ </span>The events fit the evidence.
        </p>
        <fieldset>
          <legend>{puzzle.conclusion.question}</legend>
          {puzzle.conclusion.options.map((o) => (
            <label key={o.id} className="option">
              <input
                type="radio"
                name="conclusion"
                checked={conclusion === o.id}
                onChange={() => {
                  setConclusion(o.id);
                  setVerdict(null);
                }}
              />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="button button--primary" disabled={!conclusion}>
          Decide
        </button>
        <div aria-live="polite">
          {verdict && !verdict.correct && (
            <p className="feedback feedback--problem">{verdict.explanation}</p>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="sequence">
      <ol className="sequence__list">
        {order.map((id, i) => {
          const card = puzzle.cards.find((c) => c.id === id);
          if (!card) return null;
          const evidence =
            card.clueId && state.clues.includes(card.clueId)
              ? runtime.chapter.clues.find((c) => c.id === card.clueId)
              : undefined;
          return (
            <li key={id} className="sequence__card">
              <div className="sequence__text">
                <span className="sequence__pos" aria-hidden="true">
                  {i + 1}.
                </span>{' '}
                {card.text}
                {evidence && <p className="meta-note">Evidence: {evidence.text}</p>}
              </div>
              <div className="sequence__buttons">
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move earlier: ${card.text}`}
                >
                  ↑ Earlier
                </button>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move later: ${card.text}`}
                >
                  ↓ Later
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          const result = runtime.puzzles.submitSequence(puzzle.id, order);
          setCheck(result);
          if (result?.correct) setOrdered(true);
        }}
      >
        Check the order
      </button>
      <div aria-live="polite">
        {check && !check.correct && <p className="feedback feedback--problem">{check.feedback}</p>}
      </div>
    </div>
  );
}

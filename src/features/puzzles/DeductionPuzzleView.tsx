import { useState } from 'react';
import type { DeductionCheck, DeductionPuzzle } from '@/domain/puzzles';
import { useStore } from '../common/hooks';
import type { GameRuntimeLike } from '../game/types';

const RELIABILITY: Record<string, string> = {
  reliable: 'Reliable',
  uncertain: 'Uncertain',
  conflicting: 'Conflicts with other evidence',
  unreliable: 'Questionable',
};

/** "Choose an answer, then present evidence" — weighing testimony, not guessing. */
export function DeductionPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: DeductionPuzzle;
  runtime: GameRuntimeLike;
}) {
  const state = useStore(runtime.session.store);
  const [answer, setAnswer] = useState<string | null>(null);
  const [presented, setPresented] = useState<string[]>([]);
  const [result, setResult] = useState<DeductionCheck | null>(null);
  const clues = runtime.chapter.clues.filter((c) => state.clues.includes(c.id));
  const missing = puzzle.evidence.filter((e) => !state.clues.includes(e.clueId)).length;

  const toggle = (id: string) => {
    setResult(null);
    setPresented((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <form
      className="deduction"
      onSubmit={(e) => {
        e.preventDefault();
        if (answer) setResult(runtime.puzzles.submitDeduction(puzzle.id, answer, presented));
      }}
    >
      <fieldset>
        <legend>{puzzle.question}</legend>
        {puzzle.options.map((o) => (
          <label key={o.id} className="option">
            <input
              type="radio"
              name="answer"
              value={o.id}
              checked={answer === o.id}
              onChange={() => {
                setAnswer(o.id);
                setResult(null);
              }}
            />
            <span>
              <strong>{o.label}</strong> — {o.description}
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Evidence to present (choose at least {puzzle.requiredEvidence})</legend>
        {clues.length === 0 && <p>You haven’t gathered any clues yet.</p>}
        {clues.map((c) => (
          <label key={c.id} className="option option--evidence">
            <input
              type="checkbox"
              checked={presented.includes(c.id)}
              onChange={() => toggle(c.id)}
            />
            <span>
              <strong>{c.title}</strong>{' '}
              <span className="meta-note">
                ({c.source} · {RELIABILITY[c.reliability]})
              </span>
              <br />
              {c.text}
              {c.reliabilityNote && state.flags['tobiah-admitted'] ? (
                <em> {c.reliabilityNote}</em>
              ) : null}
            </span>
          </label>
        ))}
        {missing > 0 && (
          <p className="hint">
            There may be more to discover — look around, and remember what people told you.
          </p>
        )}
      </fieldset>
      <button type="submit" className="button button--primary" disabled={!answer}>
        Present my reasoning
      </button>
      <div aria-live="polite">
        {result && !result.correct && (
          <ul className="feedback feedback--problem">
            {result.feedback.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}

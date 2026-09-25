import { useMemo, useState } from 'react';
import type { PackingCheck, PackingPuzzle } from '@/domain/puzzles';
import type { GameRuntimeLike } from '../game/types';
import { ItemIcon } from '../common/Icon';

/** Satchel packing: a stepper per item, a live load meter and a live rules checklist. */
export function PackingPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: PackingPuzzle;
  runtime: GameRuntimeLike;
}) {
  const { chapter, session, puzzles } = runtime;
  // Snapshot what you own when the puzzle opens: things with weight are packable.
  const [owned] = useState(() => ({ ...session.state.inventory }));
  const candidates = useMemo(
    () =>
      chapter.items
        .filter((i) => (owned[i.id] ?? 0) > 0 && i.weight > 0)
        .sort((a, b) => Number(b.essential) - Number(a.essential) || a.name.localeCompare(b.name)),
    [chapter.items, owned],
  );
  const [packed, setPacked] = useState<Record<string, number>>(() =>
    Object.fromEntries(candidates.filter((i) => i.essential).map((i) => [i.id, owned[i.id] ?? 0])),
  );
  const [result, setResult] = useState<PackingCheck | null>(null);
  const live = puzzles.checkPacking(puzzle.id, packed);
  const weight = live?.weight ?? 0;

  const change = (id: string, delta: number) => {
    setResult(null);
    setPacked((p) => ({ ...p, [id]: Math.max(0, Math.min(owned[id] ?? 0, (p[id] ?? 0) + delta)) }));
  };

  return (
    <div className="packing">
      <div className="packing__load">
        <label htmlFor="load-meter">
          Load: <strong>{weight}</strong> of {puzzle.capacity}
          {weight > puzzle.capacity ? ' — too heavy!' : ''}
        </label>
        <meter
          id="load-meter"
          min={0}
          max={puzzle.capacity}
          high={puzzle.capacity}
          optimum={puzzle.capacity - 1}
          value={Math.min(weight, puzzle.capacity + 2)}
        >
          {weight} of {puzzle.capacity}
        </meter>
      </div>
      <ul className="packing__items">
        {candidates.map((item) => {
          const count = packed[item.id] ?? 0;
          const max = owned[item.id] ?? 0;
          return (
            <li key={item.id} className="packing__item">
              <span className="packing__icon" aria-hidden="true">
                <ItemIcon icon={item.icon} />
              </span>
              <div className="packing__info">
                <p className="packing__name">
                  {item.name}{' '}
                  <span className="meta-note">
                    weight {item.weight} each · you have {max}
                  </span>
                </p>
                <p className="packing__desc">{item.description}</p>
              </div>
              {item.essential ? (
                <p className="packing__locked">Must bring ({count})</p>
              ) : (
                <div className="stepper" role="group" aria-label={`${item.name}: ${count} packed`}>
                  <button
                    type="button"
                    className="stepper__btn"
                    onClick={() => change(item.id, -1)}
                    disabled={count === 0}
                    aria-label={`Take out one ${item.name}`}
                  >
                    −
                  </button>
                  <span className="stepper__value" aria-hidden="true">
                    {count}
                  </span>
                  <button
                    type="button"
                    className="stepper__btn"
                    onClick={() => change(item.id, 1)}
                    disabled={count >= max}
                    aria-label={`Pack one ${item.name}`}
                  >
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <section aria-labelledby="packing-rules">
        <h3 id="packing-rules" className="packing__rules-title">
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
      <div className="packing__submit">
        <button
          type="button"
          className="button button--primary"
          onClick={() => setResult(puzzles.submitPacking(puzzle.id, packed))}
        >
          Finish packing
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

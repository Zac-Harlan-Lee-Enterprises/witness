import { useRef, useState, type KeyboardEvent } from 'react';
import {
  moveCargo,
  trimAboard,
  trimDifference,
  type TrimCheck,
  type TrimLoad,
  type TrimPuzzle,
} from '@/domain/puzzle-trim';
import { ItemIcon } from '../common/Icon';
import type { GameRuntimeLike } from '../game/types';

interface Selection {
  item: string;
  /** Where it is picked up from: a place, or the jetty (null). */
  from: string | null;
}

/**
 * Load and trim a boat. Pick something up (from the jetty or from a place in
 * the boat), then choose where it goes; the arrow keys move between the
 * places. Each place shows its load in numbers, and each pair of opposite
 * places says in words whether the boat sits level.
 */
export function TrimPuzzleView({
  puzzle,
  runtime,
}: {
  puzzle: TrimPuzzle;
  runtime: GameRuntimeLike;
}) {
  const { chapter, session, puzzles } = runtime;
  // Snapshot what you own when the puzzle opens: things with weight can go aboard.
  const [owned] = useState<Record<string, number>>(() => ({ ...session.state.inventory }));
  const items = chapter.items
    .filter((i) => (owned[i.id] ?? 0) > 0 && i.weight > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const [load, setLoad] = useState<TrimLoad>({});
  const [selected, setSelected] = useState<Selection | null>(null);
  const [announce, setAnnounce] = useState('');
  const [result, setResult] = useState<TrimCheck | null>(null);
  const targets = useRef<HTMLButtonElement[]>([]);
  const live = puzzles.checkTrim(puzzle.id, load);
  const aboard = trimAboard(load);
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const placeLabel = (id: string | null) =>
    id === null
      ? 'the jetty'
      : `the ${(puzzle.places.find((p) => p.id === id)?.label ?? id).toLowerCase()}`;
  const onJetty = (id: string) => (owned[id] ?? 0) - (aboard[id] ?? 0);

  const balanceText = (b: TrimPuzzle['balance'][number]): string => {
    const places = live?.places ?? [];
    const diff = trimDifference(places, b.between);
    const [a, z] = b.between.map((id) => puzzle.places.find((p) => p.id === id)?.label ?? id);
    const total = (id: string) => places.find((p) => p.id === id)?.total ?? 0;
    const numbers = `${a} ${total(b.between[0])}, ${z} ${total(b.between[1])}`;
    if (diff === 0) return `${numbers}: level`;
    const heavier = diff > 0 ? a : z;
    const ok = Math.abs(diff) <= b.tolerance;
    return `${numbers}: the ${(heavier ?? '').toLowerCase()} is heavier by ${Math.abs(diff)}${ok ? ' (close enough)' : ''}`;
  };

  const put = (to: string | null) => {
    if (!selected) return;
    const next = moveCargo(load, owned, selected.item, selected.from, to);
    if (next === load) return;
    setLoad(next);
    setResult(null);
    const check = puzzles.checkTrim(puzzle.id, next);
    const place = check?.places.find((p) => p.id === to);
    setAnnounce(
      `Moved one ${nameOf(selected.item)} from ${placeLabel(selected.from)} to ${placeLabel(to)}.` +
        (place ? ` ${place.label} holds ${place.cargo} of ${place.limit}.` : '') +
        ` Total aboard: ${check?.weight ?? 0} of ${puzzle.capacity}.`,
    );
    const left =
      selected.from === null
        ? (owned[selected.item] ?? 0) - (trimAboard(next)[selected.item] ?? 0)
        : (next[selected.from]?.[selected.item] ?? 0);
    if (left <= 0) setSelected(null);
  };

  const pick = (item: string, from: string | null) => {
    const same = selected?.item === item && selected.from === from;
    setSelected(same ? null : { item, from });
    setAnnounce(
      same
        ? 'Put down.'
        : `Holding ${nameOf(item)} from ${placeLabel(from)}. Choose where it goes.`,
    );
  };

  const onTargetKey = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const count = puzzle.places.length + 1;
    targets.current[(index + step + count) % count]?.focus();
  };

  const holding = selected ? nameOf(selected.item) : null;

  return (
    <div className="trim">
      <p className="trim__load" aria-live="off">
        Cargo aboard: <strong>{live?.weight ?? 0}</strong> of {puzzle.capacity}
        {(live?.weight ?? 0) > puzzle.capacity ? ' — too heavy!' : ''}
      </p>
      <p className="meta-note" aria-live="polite">
        {holding
          ? `You are holding: ${holding}. Choose where it goes.`
          : 'Pick something up, then choose where it goes.'}
      </p>
      <section className="trim__jetty" aria-labelledby={`${puzzle.id}-jetty`}>
        <h3 id={`${puzzle.id}-jetty`} className="trim__heading">
          On the jetty
        </h3>
        <ul className="trim__items">
          {items.map((item) =>
            onJetty(item.id) > 0 ? (
              <li key={item.id}>
                <button
                  type="button"
                  className="trim__item"
                  aria-pressed={selected?.item === item.id && selected.from === null}
                  onClick={() => pick(item.id, null)}
                >
                  <span aria-hidden="true">
                    <ItemIcon icon={item.icon} />
                  </span>{' '}
                  {item.name}{' '}
                  <span className="meta-note">
                    ×{onJetty(item.id)} · weight {item.weight} each
                  </span>
                </button>
              </li>
            ) : null,
          )}
        </ul>
        <button
          type="button"
          className="button button--small"
          aria-disabled={!selected || selected.from === null}
          ref={(el) => {
            if (el) targets.current[puzzle.places.length] = el;
          }}
          onKeyDown={(e) => onTargetKey(e, puzzle.places.length)}
          onClick={() => put(null)}
        >
          {holding && selected?.from !== null
            ? `Put the ${holding} back on the jetty`
            : 'Back on the jetty'}
        </button>
      </section>
      <div className="trim__boat">
        {puzzle.places.map((place, index) => {
          const view = live?.places.find((p) => p.id === place.id);
          const crew = puzzle.crew.filter((c) => c.place === place.id);
          const cargo = Object.entries(load[place.id] ?? {}).filter(([, q]) => q > 0);
          return (
            <section
              key={place.id}
              className={`trim__place trim__place--${index}`}
              aria-labelledby={`${puzzle.id}-${place.id}`}
            >
              <h3 id={`${puzzle.id}-${place.id}`} className="trim__heading">
                {place.label}
              </h3>
              <p className="trim__numbers">
                Cargo {view?.cargo ?? 0} of {place.limit}
                {(view?.cargo ?? 0) > place.limit ? ' — no room!' : ''}
                {crew.length > 0 && (
                  <>
                    {' · '}
                    {crew.map((c) => `${c.name} (${c.weight})`).join(', ')}
                  </>
                )}
                {' · '}weighs {view?.total ?? 0}
              </p>
              {cargo.length > 0 && (
                <ul className="trim__cargo">
                  {cargo.map(([id, q]) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="trim__item trim__item--small"
                        aria-pressed={selected?.item === id && selected.from === place.id}
                        aria-label={`Pick up a ${nameOf(id)} from the ${place.label.toLowerCase()} (${q} there)`}
                        onClick={() => pick(id, place.id)}
                      >
                        {nameOf(id)} ×{q}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="button button--small trim__put"
                aria-disabled={!selected || selected.from === place.id}
                ref={(el) => {
                  if (el) targets.current[index] = el;
                }}
                onKeyDown={(e) => onTargetKey(e, index)}
                onClick={() => put(place.id)}
                aria-label={
                  holding
                    ? `Put the ${holding} in the ${place.label.toLowerCase()}`
                    : `Put it in the ${place.label.toLowerCase()}`
                }
              >
                Put it here
              </button>
            </section>
          );
        })}
      </div>
      <section aria-labelledby={`${puzzle.id}-trim-rules`}>
        <h3 id={`${puzzle.id}-trim-rules`} className="trim__heading">
          How she sits
        </h3>
        <ul className="checklist">
          {puzzle.balance.map((b) => {
            const failing = live?.failures.some((f) => f.ruleId === b.id) ?? true;
            return (
              <li
                key={b.id}
                className={failing ? 'checklist__item' : 'checklist__item checklist__item--done'}
              >
                <span aria-hidden="true">{failing ? '○' : '✓'} </span>
                {b.description}: {balanceText(b)}
                <span className="visually-hidden">{failing ? ' — not yet' : ' — done'}</span>
              </li>
            );
          })}
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
          onClick={() => setResult(puzzles.submitTrim(puzzle.id, load))}
        >
          Finish loading
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

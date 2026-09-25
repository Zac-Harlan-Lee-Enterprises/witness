import { useState } from 'react';
import { trustLabel } from '@/domain/characters';
import {
  JOURNAL_CATEGORY_LABELS,
  unlockedByCategory,
  type JournalCategory,
} from '@/domain/journal';
import { ContentBlock } from '../common/ContentBlock';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';

type Tab = JournalCategory | 'clues' | 'reflections';
const TABS: Tab[] = [
  'people',
  'places',
  'events',
  'clues',
  'history',
  'scripture',
  'themes',
  'maps',
  'reflections',
];

const RELIABILITY: Record<string, string> = {
  reliable: 'Reliable',
  uncertain: 'Uncertain',
  conflicting: 'Conflicting',
  unreliable: 'Questionable',
};

/**
 * The journal: people, places, events, clues, history, Scripture, themes,
 * maps and reflections. Every paragraph carries its content label.
 */
export function JournalOverlay({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const { chapter } = runtime;
  const [tab, setTab] = useState<Tab>('people');
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const byCategory = unlockedByCategory(state, chapter.journal);

  const count = (t: Tab): number =>
    t === 'clues'
      ? state.clues.length
      : t === 'reflections'
        ? state.reflection
          ? 1
          : 0
        : byCategory[t].length;

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length] as Tab;
    setTab(next);
    setOpenEntry(null);
    document.getElementById(`tab-${next}`)?.focus();
  };

  const entry = openEntry ? chapter.journal.find((j) => j.id === openEntry) : undefined;

  return (
    <Modal
      title="Journal"
      onClose={() => runtime.ui.closeOverlay()}
      className="modal--wide journal"
    >
      <div role="tablist" aria-label="Journal sections" className="tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            id={`tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className="tab"
            onClick={() => {
              setTab(t);
              setOpenEntry(null);
            }}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {JOURNAL_CATEGORY_LABELS[t]} <span className="tab__count">({count(t)})</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === 'clues' &&
          (state.clues.length === 0 ? (
            <p>No clues yet. Talk to people and examine things around you.</p>
          ) : (
            <ul className="clue-list">
              {chapter.clues
                .filter((c) => state.clues.includes(c.id))
                .map((c) => (
                  <li key={c.id} className="clue">
                    <h3 className="clue__title">{c.title}</h3>
                    <p className="meta-note">
                      From: {c.source} · {RELIABILITY[c.reliability]}
                    </p>
                    <p>{c.text}</p>
                    {c.reliabilityNote && state.flags['tobiah-admitted'] && (
                      <p className="meta-note">{c.reliabilityNote}</p>
                    )}
                  </li>
                ))}
            </ul>
          ))}

        {tab === 'reflections' && (
          <div>
            <p className="hint">
              Your reflections are saved only on this device and are never sent anywhere.
            </p>
            {state.reflection ? (
              <blockquote className="reflection-text">{state.reflection.text}</blockquote>
            ) : (
              <p>
                No reflections yet. You’ll have a chance to write one at the end of the chapter.
              </p>
            )}
          </div>
        )}

        {tab !== 'clues' &&
          tab !== 'reflections' &&
          !entry &&
          (byCategory[tab].length === 0 ? (
            <p>Nothing here yet — keep exploring.</p>
          ) : (
            <ul className="entry-list">
              {byCategory[tab].map((j) => {
                const isNew = !state.journal.seen.includes(j.id);
                const character = j.characterId
                  ? chapter.characters.find((c) => c.id === j.characterId)
                  : undefined;
                const trust =
                  character && state.trust[character.id] !== undefined
                    ? trustLabel(state.trust[character.id] ?? 0)
                    : null;
                return (
                  <li key={j.id}>
                    <button
                      type="button"
                      className="entry-button"
                      onClick={() => {
                        setOpenEntry(j.id);
                        runtime.session.markJournalSeen(j.id);
                      }}
                    >
                      <span className="entry-button__title">
                        {j.title} {isNew && <span className="new-label">New</span>}
                      </span>
                      <span className="entry-button__summary">
                        {j.summary}
                        {trust ? ` · ${trust}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}

        {entry && (
          <div className="entry">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setOpenEntry(null)}
            >
              ← Back to {JOURNAL_CATEGORY_LABELS[entry.category]}
            </button>
            <h3 className="entry__title">{entry.title}</h3>
            {entry.recordIds
              .map((id) => chapter.records.find((r) => r.id === id))
              .filter((r) => r !== undefined)
              .map((r) => (
                <ContentBlock key={r.id} record={r} sources={chapter.sources} headingLevel={4} />
              ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

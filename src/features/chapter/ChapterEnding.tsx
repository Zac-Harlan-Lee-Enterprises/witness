import { useId, useState } from 'react';
import { buildChapterSummary } from '@/domain/chapter-summary';
import { evaluate } from '@/domain/conditions';
import type { ContentRecord } from '@/domain/content-records';
import { MAX_REFLECTION_LENGTH } from '@/domain/state/game-state';
import { formatPlayTime } from '../menu/ChapterSelect';
import { ContentBlock } from '../common/ContentBlock';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';

/**
 * Act 6 and 7: the Scripture Connection, an optional reflection, and the
 * chapter summary. Nothing here grades the player; comparisons describe
 * what they did and invite thought.
 */
export function ScriptureConnection({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const { chapter } = runtime;
  const connection = chapter.scriptureConnection;
  const records = (ids: string[]) =>
    ids
      .map((id) => chapter.records.find((r) => r.id === id))
      .filter((r): r is ContentRecord => r !== undefined);
  const comparisons = connection.comparisons.filter((c) => evaluate(c.when, state));

  return (
    <Modal title={connection.title} className="modal--full scripture-connection">
      <p className="lead">{connection.intro}</p>
      {connection.sections.map((section) => (
        <section
          key={section.heading}
          className="connection-section"
          aria-labelledby={`sec-${section.heading}`}
        >
          <h3 id={`sec-${section.heading}`}>{section.heading}</h3>
          {records(section.recordIds).map((r) => (
            <ContentBlock key={r.id} record={r} sources={chapter.sources} headingLevel={4} />
          ))}
        </section>
      ))}
      <section
        className="connection-section connection-section--journey"
        aria-labelledby="sec-journey"
      >
        <h3 id="sec-journey">Your journey and the story</h3>
        <p className="meta-note">
          Questions to think about — there are no right or wrong scores here.
        </p>
        <ul className="comparisons">
          {comparisons.map((c) => (
            <li key={c.text}>{c.text}</li>
          ))}
        </ul>
      </section>
      <button
        type="button"
        className="button button--primary button--large"
        onClick={() => runtime.controller.panelFinished('scripture-connection')}
      >
        Continue
      </button>
    </Modal>
  );
}

export function ReflectionPanel({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const [text, setText] = useState(state.reflection?.text ?? '');
  const id = useId();
  const prompts = runtime.chapter.summary.reflectionPrompts;
  return (
    <Modal title="Reflect" className="modal--wide">
      <p>
        Take a moment with one of these questions — in your head, out loud with someone, or written
        below.
      </p>
      <ul className="prompts">
        {prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <label htmlFor={id}>Your reflection (optional)</label>
      <textarea
        id={id}
        rows={5}
        maxLength={MAX_REFLECTION_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={`${id}-privacy`}
      />
      <p id={`${id}-privacy`} className="hint">
        Saved only on this device, in your journal. It is never sent anywhere or shared. (
        {text.length}/{MAX_REFLECTION_LENGTH})
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            runtime.session.setReflection(text);
            runtime.controller.panelFinished('reflection');
          }}
        >
          {text.trim() ? 'Save and continue' : 'Continue'}
        </button>
      </div>
    </Modal>
  );
}

export function ChapterSummary({
  runtime,
  onReturnToTitle,
}: {
  runtime: GameRuntimeLike;
  onReturnToTitle: () => void;
}) {
  const state = useStore(runtime.session.store);
  const summary = buildChapterSummary(runtime.chapter, state);
  return (
    <Modal title={`Chapter complete: ${summary.chapterTitle}`} className="modal--full summary">
      <p className="meta-note">{formatPlayTime(state.playTimeMs)}</p>
      <section aria-labelledby="sum-journey">
        <h3 id="sum-journey">Your journey</h3>
        <ul>
          {summary.recap.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
      {summary.choices.length > 0 && (
        <section aria-labelledby="sum-choices">
          <h3 id="sum-choices">Your choices</h3>
          <dl className="choices-list">
            {summary.choices.map((c) => (
              <div key={c.prompt}>
                <dt>{c.prompt}</dt>
                <dd>
                  <strong>{c.chosen}.</strong> {c.consequence}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section aria-labelledby="sum-consequences">
        <h3 id="sum-consequences">What happened because of your choices</h3>
        <ul>
          {summary.consequences.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
      {summary.relationships.length > 0 && (
        <section aria-labelledby="sum-people">
          <h3 id="sum-people">People you met</h3>
          <ul className="people-list">
            {summary.relationships.map((r) => (
              <li key={r.name}>
                <strong>{r.name}</strong> ({r.role}) — {r.label}
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.sideQuests.length > 0 && (
        <section aria-labelledby="sum-side">
          <h3 id="sum-side">Side quests</h3>
          <ul>
            {summary.sideQuests.map((q) => (
              <li key={q.name}>
                {q.name}: {q.outcome}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="sum-found">
        <h3 id="sum-found">Discoveries</h3>
        <p>
          {summary.discoveries.clues} clues found · {summary.discoveries.journalEntries} of{' '}
          {summary.discoveries.totalJournalEntries} journal entries
        </p>
      </section>
      <section aria-labelledby="sum-themes">
        <h3 id="sum-themes">Themes</h3>
        <ul>
          {summary.themes.map((t) => (
            <li key={t.name}>
              <strong>{t.name}</strong> — {t.description}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sum-scripture" className="summary__scripture">
        <h3 id="sum-scripture">Scripture references</h3>
        {summary.scripture.map((r) => (
          <ContentBlock key={r.id} record={r} sources={runtime.chapter.sources} headingLevel={4} />
        ))}
      </section>
      <section aria-labelledby="sum-history">
        <h3 id="sum-history">Historical context</h3>
        {summary.history.map((r) => (
          <details key={r.id} className="summary__history">
            <summary>{r.title}</summary>
            <ContentBlock record={r} sources={runtime.chapter.sources} headingLevel={4} />
          </details>
        ))}
      </section>
      <div className="button-row">
        <button
          type="button"
          className="button"
          onClick={() => runtime.controller.panelFinished('summary')}
        >
          Keep exploring Jericho
        </button>
        <button type="button" className="button button--primary" onClick={onReturnToTitle}>
          Return to title
        </button>
      </div>
    </Modal>
  );
}

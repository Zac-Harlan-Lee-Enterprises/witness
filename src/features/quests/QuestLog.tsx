import { questLog } from '@/domain/quests';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';

export function QuestLog({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const entries = questLog(state, runtime.chapter.quests);
  return (
    <Modal title="Quests" onClose={() => runtime.ui.closeOverlay()} className="modal--wide">
      {entries.length === 0 && <p>No quests yet.</p>}
      {entries.map((q) => (
        <section
          key={q.questId}
          className={`quest quest--${q.status}`}
          aria-labelledby={`q-${q.questId}`}
        >
          <h3 id={`q-${q.questId}`} className="quest__name">
            {q.name}{' '}
            <span className="badge">{q.kind === 'main' ? 'Main quest' : 'Side quest'}</span>{' '}
            <span className="meta-note">
              {q.status === 'active'
                ? 'In progress'
                : q.status === 'completed'
                  ? 'Finished'
                  : 'Ended'}
            </span>
          </h3>
          {q.stageTitle && (
            <>
              <h4 className="quest__stage">{q.stageTitle}</h4>
              <p>{q.stageDescription}</p>
              <ul className="checklist">
                {q.objectives.map((o) => (
                  <li
                    key={o.id}
                    className={o.done ? 'checklist__item checklist__item--done' : 'checklist__item'}
                  >
                    <span aria-hidden="true">{o.done ? '✓' : '○'} </span>
                    {o.description}
                    <span className="visually-hidden">{o.done ? ' — done' : ' — to do'}</span>
                    {o.optional && !o.description.startsWith('Optional') && (
                      <span className="meta-note"> (optional)</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {q.outcome && (
            <p>
              <strong>{q.outcome.title}.</strong> {q.outcome.description}
            </p>
          )}
        </section>
      ))}
    </Modal>
  );
}

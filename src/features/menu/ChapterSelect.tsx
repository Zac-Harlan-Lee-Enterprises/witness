import { useEffect, useState } from 'react';
import type { SaveSummary, UnreadableSave } from '@/application/save-service';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import type { PlayerProfile } from '@/domain/profile';
import { Modal } from '../common/Modal';
import { Portrait } from '../common/Portrait';
import { useServices } from '../common/services';
import { Icon } from '../common/Icon';
import { KeyArtImage } from './KeyArtImage';

const SLOT_LABELS: Record<string, string> = {
  auto: 'Autosave',
  'manual-1': 'Save slot 1',
  'manual-2': 'Save slot 2',
  'manual-3': 'Save slot 3',
};

export function formatPlayTime(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  return minutes < 1 ? 'under a minute' : `${minutes} min played`;
}

export function ChapterSelect({
  profile,
  onStart,
  onWatchTeaser,
  onBack,
}: {
  profile: PlayerProfile;
  onStart: (chapterId: string, saveId: string | null) => void;
  /** Watch a chapter's teaser film again. */
  onWatchTeaser?: (chapterId: string) => void;
  onBack: () => void;
}) {
  const { chapters, saves } = useServices();
  const [saveList, setSaveList] = useState<SaveSummary[] | null>(null);
  const [unreadable, setUnreadable] = useState<UnreadableSave[]>([]);
  const [confirmNew, setConfirmNew] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void saves.list(profile.id).then((r) => {
      if (!alive) return;
      setSaveList(r.saves);
      setUnreadable(r.unreadable);
    });
    return () => {
      alive = false;
    };
  }, [saves, profile.id]);

  return (
    <main className="screen chapter-select" aria-labelledby="chapters-title">
      <div className="player-banner">
        <Portrait appearance={PLAYER_APPEARANCES[profile.look]} size={56} />
        <p>
          Playing as <strong>{profile.displayName}</strong>
        </p>
      </div>
      <h1 id="chapters-title">Chapters</h1>
      <ul className="chapter-list">
        {chapters.list().map((meta) => {
          const chapterSaves = (saveList ?? []).filter((s) => s.chapterId === meta.id);
          const latest = [...chapterSaves].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0];
          const complete = profile.completedChapters.includes(meta.id);
          return (
            <li
              key={meta.id}
              className={`chapter-card ${meta.available ? '' : 'chapter-card--locked'}`}
              aria-labelledby={`chapter-title-${meta.id}`}
            >
              {meta.available && meta.keyArt && (
                <KeyArtImage
                  art={meta.keyArt}
                  className="chapter-card__art"
                  sizes="(max-width: 50rem) 100vw, 46rem"
                />
              )}
              <h2 className="chapter-card__title" id={`chapter-title-${meta.id}`}>
                <span className="chapter-card__number">Chapter {meta.number}</span> {meta.title}
              </h2>
              <p className="chapter-card__subtitle">{meta.subtitle}</p>
              {meta.estimatedMinutes && (
                <p className="meta-note">
                  About {meta.estimatedMinutes.min}–{meta.estimatedMinutes.max} minutes
                  {complete ? ' · Completed' : ''}
                </p>
              )}
              {meta.available ? (
                <div className="button-row">
                  {latest && (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => onStart(meta.id, latest.id)}
                    >
                      Continue <span className="button__detail">({latest.sceneName})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`button ${latest ? '' : 'button--primary'}`}
                    onClick={() => (latest ? setConfirmNew(meta.id) : onStart(meta.id, null))}
                  >
                    New game
                  </button>
                  {meta.hasTeaser && onWatchTeaser && (
                    <button type="button" className="button" onClick={() => onWatchTeaser(meta.id)}>
                      Watch the teaser
                    </button>
                  )}
                </div>
              ) : (
                <p className="meta-note">
                  <Icon name="lock" /> Not available yet
                </p>
              )}
              {meta.available && chapterSaves.length > 0 && (
                <details className="save-list">
                  <summary>Load a saved game ({chapterSaves.length})</summary>
                  <ul>
                    {chapterSaves.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="button button--small"
                          onClick={() => onStart(meta.id, s.id)}
                        >
                          Load {SLOT_LABELS[s.slot] ?? s.slot}
                        </button>{' '}
                        <span className="meta-note">
                          {s.sceneName} · {formatPlayTime(s.playTimeMs)} ·{' '}
                          {new Date(s.savedAt).toLocaleString()}
                          {s.objective ? ` · ${s.objective}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {unreadable.length > 0 && (
        <div className="notice notice--warning" role="status">
          {unreadable.map((u) => (
            <p key={u.id}>{u.message}</p>
          ))}
        </div>
      )}
      <button type="button" className="button button--ghost" onClick={onBack}>
        Change profile
      </button>
      {confirmNew && (
        <Modal title="Start a new game?" onClose={() => setConfirmNew(null)}>
          <p>
            Your autosave for this chapter will be replaced when the new game saves. Manual save
            slots are kept.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button--primary"
              onClick={() => onStart(confirmNew, null)}
            >
              Start new game
            </button>
            <button type="button" className="button" onClick={() => setConfirmNew(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

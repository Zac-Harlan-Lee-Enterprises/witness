import { useEffect, useId, useState } from 'react';
import { PLAYER_APPEARANCES, PLAYER_LOOKS, type PlayerLook } from '@/domain/characters';
import { PROFILE_NAME_MAX, type PlayerProfile } from '@/domain/profile';
import { Modal } from '../common/Modal';
import { Portrait } from '../common/Portrait';
import { useServices } from '../common/services';

/**
 * Local profiles for families and classrooms. Only a nickname and a look —
 * no personal information is requested or stored.
 */
export function ProfileScreen({
  onSelect,
  onBack,
}: {
  onSelect: (p: PlayerProfile) => void;
  onBack: () => void;
}) {
  const { profiles } = useServices();
  const [list, setList] = useState<PlayerProfile[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<PlayerProfile | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void profiles.list().then((all) => {
      if (!alive) return;
      setList(all);
      if (all.length === 0) setCreating(true);
    });
    return () => {
      alive = false;
    };
  }, [profiles, version]);

  return (
    <main className="screen profile-screen" aria-labelledby="profiles-title">
      <h1 id="profiles-title">Who’s playing?</h1>
      {list === null ? (
        <p role="status">Loading profiles…</p>
      ) : (
        <>
          {list.length > 0 && (
            <ul className="profile-list">
              {list.map((p) => (
                <li key={p.id} className="profile-card">
                  <button
                    type="button"
                    className="profile-card__select"
                    onClick={() => onSelect(p)}
                  >
                    <Portrait appearance={PLAYER_APPEARANCES[p.look]} size={56} />
                    <span className="profile-card__name">{p.displayName}</span>
                    <span className="profile-card__meta">
                      {p.completedChapters.length > 0
                        ? 'Chapter 1 complete'
                        : p.lastPlayedAt
                          ? 'In progress'
                          : 'New'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setRemoving(p)}
                    aria-label={`Remove profile ${p.displayName}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {creating ? (
            <NewProfileForm
              onCreated={(p) => {
                setCreating(false);
                onSelect(p);
              }}
              onCancel={list.length > 0 ? () => setCreating(false) : undefined}
            />
          ) : (
            <button
              type="button"
              className="button button--primary"
              onClick={() => setCreating(true)}
            >
              New profile
            </button>
          )}
        </>
      )}
      <button type="button" className="button button--ghost" onClick={onBack}>
        Back
      </button>
      {removing && (
        <Modal title={`Remove ${removing.displayName}?`} onClose={() => setRemoving(null)}>
          <p>
            This deletes the profile and all of its saved games on this device. This can’t be
            undone.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button--danger"
              onClick={async () => {
                await profiles.remove(removing.id);
                setRemoving(null);
                setVersion((v) => v + 1);
              }}
            >
              Remove profile
            </button>
            <button type="button" className="button" onClick={() => setRemoving(null)}>
              Keep it
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function NewProfileForm({
  onCreated,
  onCancel,
}: {
  onCreated: (p: PlayerProfile) => void;
  onCancel?: () => void;
}) {
  const { profiles } = useServices();
  const [name, setName] = useState('');
  const [look, setLook] = useState<PlayerLook>('look-1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const hintId = useId();
  const errorId = useId();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await profiles.create(name, look);
    setBusy(false);
    if (result.ok) onCreated(result.profile);
    else setError(result.reason);
  };

  return (
    <form className="panel new-profile" onSubmit={submit} aria-labelledby={`${nameId}-legend`}>
      <h2 id={`${nameId}-legend`}>New profile</h2>
      <label htmlFor={nameId}>Nickname</label>
      <input
        id={nameId}
        name="nickname"
        value={name}
        maxLength={PROFILE_NAME_MAX}
        autoComplete="off"
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
        aria-invalid={error ? true : undefined}
        required
      />
      <p id={hintId} className="hint">
        Use a nickname — no real names needed. Characters in the story will call you this.
      </p>
      <fieldset className="look-picker">
        <legend>Choose your look</legend>
        {PLAYER_LOOKS.map((l, i) => (
          <label key={l} className={`look-option ${look === l ? 'look-option--selected' : ''}`}>
            <input
              type="radio"
              name="look"
              value={l}
              checked={look === l}
              onChange={() => setLook(l)}
            />
            <Portrait appearance={PLAYER_APPEARANCES[l]} size={56} />
            <span>Look {i + 1}</span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="button button--primary" disabled={busy}>
          Create and continue
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

import { useState } from 'react';
import { timeOfDayLabel } from '@/application/time-of-day';
import { unseenCount } from '@/domain/journal';
import { currentObjective } from '@/domain/quests';
import { SAVE_SLOTS, type SaveSlot } from '@/domain/save';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import { useServices } from '../common/services';
import type { GameRuntimeLike } from '../game/types';

const MANUAL_SLOTS = SAVE_SLOTS.filter((s): s is Exclude<SaveSlot, 'auto'> => s !== 'auto');

/** Pause at any time: the world stops, nothing is lost. */
export function PauseMenu({
  runtime,
  onSettings,
  onQuit,
}: {
  runtime: GameRuntimeLike;
  onSettings: () => void;
  onQuit: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const state = useStore(runtime.session.store);
  const { chapter } = runtime;
  const scene = chapter.scenes.find((s) => s.id === state.sceneId);
  const objective = currentObjective(state, chapter.quests);
  const hour = chapter.timeCounter ? state.counters[chapter.timeCounter] : undefined;
  const newEntries = unseenCount(state);
  const { notices, applyUpdate } = useServices();
  const updateReady = useStore(notices).updateAvailable;
  const close = () => runtime.ui.closeOverlay();
  return (
    <Modal title="Paused" onClose={close}>
      <p className="hint">The game is paused. Your progress is saved automatically as you play.</p>
      {/* The same facts as the HUD, which is trimmed on small screens with large text. */}
      <div className="pause-status">
        <p>
          <strong>Where:</strong> {scene?.name}
        </p>
        {objective && (
          <p>
            <strong>Next:</strong> {objective}
          </p>
        )}
        {hour !== undefined && (
          <p>
            <strong>Time:</strong> {timeOfDayLabel(hour)}
          </p>
        )}
      </div>
      {updateReady && applyUpdate && (
        // The swap is the player's choice, after an autosave (ADR-0006).
        <p className="notice">
          A new version of the game is ready.{' '}
          <button
            type="button"
            className="button button--small"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              runtime.autosaver.flush();
              await runtime.saveTo('auto');
              await applyUpdate();
            }}
          >
            Save and update
          </button>
        </p>
      )}
      <nav className="menu" aria-label="Pause menu">
        <button type="button" className="button button--primary" onClick={close}>
          Resume
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('goto')}>
          Go to…
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('journal')}>
          Journal{newEntries > 0 ? ` (${newEntries} new)` : ''}
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('satchel')}>
          Satchel
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('quests')}>
          Quests
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('messages')}>
          Recent messages
        </button>
        <button type="button" className="button" onClick={onSettings}>
          Settings
        </button>
      </nav>
      <section aria-labelledby="save-heading">
        <h3 id="save-heading">Save your game</h3>
        <div className="button-row">
          {MANUAL_SLOTS.map((slot, i) => (
            <button
              key={slot}
              type="button"
              className="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await runtime.saveTo(slot);
                setSaving(false);
              }}
            >
              Save to slot {i + 1}
            </button>
          ))}
        </div>
      </section>
      <button
        type="button"
        className="button button--ghost"
        onClick={async () => {
          runtime.autosaver.flush();
          await runtime.saveTo('auto');
          onQuit();
        }}
      >
        Save and quit to title
      </button>
    </Modal>
  );
}

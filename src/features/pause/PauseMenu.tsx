import { useState } from 'react';
import { SAVE_SLOTS, type SaveSlot } from '@/domain/save';
import { Modal } from '../common/Modal';
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
  const close = () => runtime.ui.closeOverlay();
  return (
    <Modal title="Paused" onClose={close}>
      <p className="hint">The game is paused. Your progress is saved automatically as you play.</p>
      <nav className="menu" aria-label="Pause menu">
        <button type="button" className="button button--primary" onClick={close}>
          Resume
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('journal')}>
          Journal
        </button>
        <button type="button" className="button" onClick={() => runtime.ui.openOverlay('quests')}>
          Quests
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

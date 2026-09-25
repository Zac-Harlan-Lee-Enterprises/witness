import { useSettings, useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';

/**
 * "Go to…": every person, object and exit in the current place as a list of
 * buttons. Choosing one walks you there (or jumps, with Instant travel) and
 * interacts. The whole game is playable from this list — no precise
 * pointing or steering required.
 */
export function GoToList({ runtime }: { runtime: GameRuntimeLike }) {
  useStore(runtime.session.store);
  const settings = useSettings();
  const destinations = runtime.controller.destinations();
  const people = destinations.filter((d) => d.kind === 'entity');
  const exits = destinations.filter((d) => d.kind === 'exit');
  return (
    <Modal title="Go to…" onClose={() => runtime.ui.closeOverlay()}>
      <p className="hint">
        {settings.instantTravel
          ? 'You’ll arrive instantly.'
          : 'You’ll walk there. (Turn on Instant travel in Settings to skip walking.)'}
      </p>
      <h3>People and things</h3>
      <ul className="goto-list">
        {people.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              className="button goto-button"
              onClick={() => runtime.controller.travelTo(d.id)}
            >
              {d.action}
            </button>
          </li>
        ))}
      </ul>
      {exits.length > 0 && (
        <>
          <h3>Leave this place</h3>
          <ul className="goto-list">
            {exits.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="button goto-button"
                  onClick={() => runtime.controller.travelTo(d.id)}
                >
                  {d.action}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

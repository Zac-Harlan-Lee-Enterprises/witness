import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';

/**
 * Every notification shown this session, newest first. Notices disappear
 * after a few seconds, so this lets slower readers catch up — especially
 * the short "Note:" and "Not yet:" messages that aren't recorded anywhere else.
 */
export function MessageLog({ runtime }: { runtime: GameRuntimeLike }) {
  const { messages } = useStore(runtime.ui);
  const newestFirst = [...messages].reverse();
  return (
    <Modal title="Recent messages" onClose={() => runtime.ui.closeOverlay()}>
      {newestFirst.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <ol className="message-log">
          {newestFirst.map((m) => (
            <li key={m.id} className={`toast toast--${m.tone}`}>
              <strong className="toast__label">{m.label}:</strong> {m.text}
            </li>
          ))}
        </ol>
      )}
      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          onClick={() => runtime.ui.closeOverlay()}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

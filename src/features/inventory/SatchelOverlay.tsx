import { listItems } from '@/domain/inventory';
import { useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import type { GameRuntimeLike } from '../game/types';
import { ItemIcon } from '../common/Icon';

/** A small, purposeful inventory: every item matters to a decision. */
export function SatchelOverlay({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const items = listItems(state.inventory)
    .map(({ itemId, quantity }) => ({
      item: runtime.chapter.items.find((i) => i.id === itemId),
      quantity,
    }))
    .filter(
      (x): x is { item: NonNullable<typeof x.item>; quantity: number } => x.item !== undefined,
    );
  const load = items.reduce((sum, { item, quantity }) => sum + item.weight * quantity, 0);
  const packed = state.puzzles['p-satchel']?.status === 'solved';
  return (
    <Modal title="Satchel" onClose={() => runtime.ui.closeOverlay()}>
      <p className="meta-note">
        {packed
          ? `Carrying a load of ${load}.`
          : 'You haven’t packed for the road yet — some of these things are still at home.'}
      </p>
      {items.length === 0 ? (
        <p>Your satchel is empty.</p>
      ) : (
        <ul className="satchel">
          {items.map(({ item, quantity }) => (
            <li key={item.id} className="satchel__item">
              <span className="satchel__icon" aria-hidden="true">
                <ItemIcon icon={item.icon} />
              </span>
              <div>
                <p className="satchel__name">
                  {item.name}
                  {quantity > 1 ? ` ×${quantity}` : ''}
                  {item.essential && <span className="badge">Must deliver</span>}
                </p>
                <p className="satchel__desc">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

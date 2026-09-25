import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Accessible modal dialog: labelled, focus moves inside on open and is
 * trapped while open, Escape closes (when closable), and focus returns to
 * wherever it was before. Used for every overlay in the game.
 */
interface ModalProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** Visually hide the heading (still announced) when the content has its own. */
  hideTitle?: boolean;
  describedBy?: string;
  initialFocus?: 'first' | 'container';
  closeLabel?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children,
  className,
  hideTitle,
  describedBy,
  initialFocus = 'first',
  closeLabel = 'Close',
}: ModalProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    if (node) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      if (initialFocus === 'first' && first) first.focus();
      else node.focus();
    }
    return () => {
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [initialFocus]);

  // Escape to close + focus trap (native listener: the dialog itself isn't a widget).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && closeRef.current) {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`modal ${className ?? ''}`}
      >
        <div className="modal__header">
          <h2 id={titleId} className={hideTitle ? 'visually-hidden' : 'modal__title'}>
            {title}
          </h2>
          {onClose && (
            <button type="button" className="button button--ghost modal__close" onClick={onClose}>
              {closeLabel}
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

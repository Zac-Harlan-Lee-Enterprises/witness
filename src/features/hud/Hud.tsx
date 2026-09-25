import { useEffect, useState } from 'react';
import { timeOfDayLabel } from '@/application/time-of-day';
import type { UiState } from '@/application/ui-store';
import { unseenCount } from '@/domain/journal';
import { currentObjective } from '@/domain/quests';
import { keyLabel, type InputAction } from '@/domain/settings';
import { useSettings, useStore } from '../common/hooks';
import { useServices } from '../common/services';
import type { GameRuntimeLike } from '../game/types';

function useKey(action: InputAction): string {
  const settings = useSettings();
  const first = settings.keyBindings[action]?.[0];
  return first ? keyLabel(first) : '';
}

/** Always-visible HTML heads-up display: where you are, what to do, and menu buttons. */
export function Hud({ runtime }: { runtime: GameRuntimeLike }) {
  const state = useStore(runtime.session.store);
  const { chapter, ui } = runtime;
  const scene = chapter.scenes.find((s) => s.id === state.sceneId);
  const objective = currentObjective(state, chapter.quests);
  const hour = chapter.timeCounter ? state.counters[chapter.timeCounter] : undefined;
  const newEntries = unseenCount(state);
  const keys = {
    journal: useKey('journal'),
    satchel: useKey('satchel'),
    quests: useKey('quests'),
    goto: useKey('goto'),
    pause: useKey('pause'),
  };

  return (
    <header className="hud" aria-label="Game status">
      <div className="hud__status">
        <p className="hud__scene">{scene?.name}</p>
        {objective && (
          <p className="hud__objective">
            <span className="hud__label">Next:</span> {objective}
          </p>
        )}
        {hour !== undefined && (
          <p className="hud__time">
            <span className="hud__label">Time:</span> {timeOfDayLabel(hour)}
          </p>
        )}
      </div>
      <nav className="hud__buttons" aria-label="Game menus">
        <HudButton label="Go to…" shortcut={keys.goto} onClick={() => ui.toggleOverlay('goto')} />
        <HudButton
          label="Journal"
          shortcut={keys.journal}
          badge={newEntries}
          onClick={() => ui.toggleOverlay('journal')}
        />
        <HudButton
          label="Satchel"
          shortcut={keys.satchel}
          onClick={() => ui.toggleOverlay('satchel')}
        />
        <HudButton
          label="Quests"
          shortcut={keys.quests}
          onClick={() => ui.toggleOverlay('quests')}
        />
        <HudButton label="Menu" shortcut={keys.pause} onClick={() => ui.toggleOverlay('pause')} />
      </nav>
    </header>
  );
}

function HudButton({
  label,
  shortcut,
  badge,
  onClick,
}: {
  label: string;
  shortcut: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="hud-button"
      onClick={onClick}
      aria-keyshortcuts={shortcut || undefined}
    >
      {label}
      {badge ? (
        <span className="hud-button__badge">
          {badge} <span className="visually-hidden">new</span>
        </span>
      ) : null}
      {shortcut && (
        <kbd className="hud-button__key" aria-hidden="true">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

function useTouchControlsVisible(): boolean {
  const settings = useSettings();
  const [coarse] = useState(
    () =>
      typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches),
  );
  return settings.touchControls === 'on' || (settings.touchControls === 'auto' && coarse);
}

/**
 * The contextual "Talk to Aunt Miriam" prompt. It is a clickable button on
 * desktop; when the on-screen ✋ button is showing, the prompt is a text label
 * so there aren't two identical controls.
 */
export function InteractionPrompt({ runtime }: { runtime: GameRuntimeLike }) {
  const ui = useStore(runtime.ui);
  const key = useKey('interact');
  const touch = useTouchControlsVisible();
  if (!ui.focus || !runtime.ui.explorationAllowed) return null;
  const content = (
    <>
      <span aria-hidden="true">✋ </span>
      {ui.focus.verb} {ui.focus.label}
      {key && !touch && (
        <kbd className="interaction-prompt__key" aria-hidden="true">
          {key}
        </kbd>
      )}
    </>
  );
  return (
    <div className="interaction-prompt">
      {touch ? (
        <p className="interaction-prompt__label">{content}</p>
      ) : (
        <button
          type="button"
          className="button button--primary interaction-prompt__button"
          onClick={() => runtime.controller.interactFocused()}
        >
          {content}
        </button>
      )}
    </div>
  );
}

/** On-screen d-pad + action button for touch devices. */
export function TouchControls({ runtime }: { runtime: GameRuntimeLike }) {
  const { input } = useServices();
  const ui = useStore(runtime.ui);
  const visible = useTouchControlsVisible();
  useEffect(() => () => input.releaseAll('touch'), [input]);
  if (!visible) return null;

  const hold = (action: InputAction) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      input.press('touch', action);
    },
    onPointerUp: () => input.release('touch', action),
    onPointerCancel: () => input.release('touch', action),
    onLostPointerCapture: () => input.release('touch', action),
  });

  return (
    <div className="touch-controls" aria-label="Touch controls" role="group">
      <div className="dpad">
        <button type="button" className="dpad__btn dpad__up" aria-label="Move up" {...hold('up')}>
          ▲
        </button>
        <button
          type="button"
          className="dpad__btn dpad__left"
          aria-label="Move left"
          {...hold('left')}
        >
          ◀
        </button>
        <button
          type="button"
          className="dpad__btn dpad__right"
          aria-label="Move right"
          {...hold('right')}
        >
          ▶
        </button>
        <button
          type="button"
          className="dpad__btn dpad__down"
          aria-label="Move down"
          {...hold('down')}
        >
          ▼
        </button>
      </div>
      <button
        type="button"
        className="action-button"
        disabled={!ui.focus}
        aria-label={
          ui.focus ? `${ui.focus.verb} ${ui.focus.label}` : 'Nothing nearby to interact with'
        }
        onClick={() => runtime.controller.interactFocused()}
      >
        ✋
      </button>
    </div>
  );
}

const TOAST_MS = 4500;

/** Notifications (new clue, item received…) with a text label — never colour alone. */
export function Toasts({ ui }: { ui: GameRuntimeLike['ui'] }) {
  const state: UiState = useStore(ui);
  useEffect(() => {
    const timers = state.toasts.map((t) => setTimeout(() => ui.dismissToast(t.id), TOAST_MS));
    return () => timers.forEach(clearTimeout);
  }, [state.toasts, ui]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {state.toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <strong className="toast__label">{t.label}:</strong> {t.text}
        </div>
      ))}
    </div>
  );
}

export function Captions() {
  const { notices } = useServices();
  const settings = useSettings();
  const n = useStore(notices);
  if (!settings.captions || n.captions.length === 0) return null;
  return (
    <div className="captions" aria-hidden="true">
      {n.captions.map((c) => (
        <p key={c.id}>{c.text}</p>
      ))}
    </div>
  );
}

/** Polite screen-reader announcements (arriving in a new place, etc.). */
export function LiveAnnouncer({ ui }: { ui: GameRuntimeLike['ui'] }) {
  const state = useStore(ui);
  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {state.announcement}
    </div>
  );
}

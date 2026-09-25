import { useEffect, useRef, useState } from 'react';
import { timeOfDayLabel } from '@/application/time-of-day';
import { moodOf } from '@/application/world-model';
import type { UiState } from '@/application/ui-store';
import { unseenCount } from '@/domain/journal';
import { currentObjective } from '@/domain/quests';
import { ariaKeyName, keyLabel, type InputAction } from '@/domain/settings';
import { useSettings, useStore } from '../common/hooks';
import { Icon, type IconName } from '../common/Icon';
import { useServices } from '../common/services';
import type { GameRuntimeLike } from '../game/types';

interface KeyHint {
  /** What to show on screen, e.g. "Esc" or "↑". */
  label: string;
  /** What to put in aria-keyshortcuts, e.g. "Escape" or "ArrowUp". */
  aria: string;
}

function useKey(action: InputAction): KeyHint {
  const settings = useSettings();
  const first = settings.keyBindings[action]?.[0];
  return first ? { label: keyLabel(first), aria: ariaKeyName(first) } : { label: '', aria: '' };
}

const EMBLEMS: Record<ReturnType<typeof moodOf>, IconName> = {
  home: 'home',
  city: 'city',
  wilderness: 'hills',
  oasis: 'palm',
};

function timeIcon(hour: number): IconName {
  if (hour < 5 || hour >= 19) return 'moon';
  if (hour >= 17 || hour < 7) return 'dusk';
  return 'sun';
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
      <div className="hud__status" data-mood={scene ? moodOf(scene) : undefined}>
        <p className="hud__scene">
          {scene && <Icon name={EMBLEMS[moodOf(scene)]} className="hud__emblem" />}
          {scene?.name}
        </p>
        {objective && (
          <p className="hud__objective hud__detail">
            <Icon name="flag" className="hud__icon" />
            <span className="hud__label">Next:</span> {objective}
          </p>
        )}
        {hour !== undefined && (
          <p className="hud__time hud__detail">
            <Icon name={timeIcon(hour)} className="hud__icon" />
            <span className="hud__label">Time:</span> {timeOfDayLabel(hour)}
          </p>
        )}
      </div>
      <nav className="hud__buttons" aria-label="Game menus">
        <HudButton
          label="Go to…"
          icon="goto"
          shortcut={keys.goto}
          onClick={() => ui.toggleOverlay('goto')}
        />
        <HudButton
          label="Journal"
          icon="journal"
          shortcut={keys.journal}
          badge={newEntries}
          secondary
          onClick={() => ui.toggleOverlay('journal')}
        />
        <HudButton
          label="Satchel"
          icon="satchel"
          shortcut={keys.satchel}
          secondary
          onClick={() => ui.toggleOverlay('satchel')}
        />
        <HudButton
          label="Quests"
          icon="quests"
          shortcut={keys.quests}
          secondary
          onClick={() => ui.toggleOverlay('quests')}
        />
        <HudButton
          label="Menu"
          icon="menu"
          shortcut={keys.pause}
          onClick={() => ui.toggleOverlay('pause')}
        />
      </nav>
    </header>
  );
}

function HudButton({
  label,
  icon,
  shortcut,
  badge,
  secondary,
  onClick,
}: {
  label: string;
  icon: IconName;
  shortcut: KeyHint;
  badge?: number;
  /** Also reachable from the pause menu; hidden on small screens with large text. */
  secondary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={secondary ? 'hud-button hud-button--secondary' : 'hud-button'}
      onClick={onClick}
      aria-keyshortcuts={shortcut.aria || undefined}
    >
      <Icon name={icon} className="hud-button__icon" />
      {label}
      {badge ? (
        <span className="hud-button__badge">
          {badge} <span className="visually-hidden">new</span>
        </span>
      ) : null}
      {shortcut.label && (
        <kbd className="hud-button__key" aria-hidden="true">
          {shortcut.label}
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
      {key.label && !touch && (
        <kbd className="interaction-prompt__key" aria-hidden="true">
          {key.label}
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
          aria-keyshortcuts={key.aria || undefined}
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

/** A symbol for each kind of notice (the text label always says the same thing). */
export function toastIcon(label: string): IconName {
  switch (label) {
    case 'New clue':
      return 'lens';
    case 'Received':
    case 'Used':
      return 'satchel';
    case 'New quest':
    case 'Side quest':
    case 'Quest resolved':
    case 'Next step':
      return 'quests';
    case 'Journal':
      return 'journal';
    case 'Careful':
      return 'warning';
    case 'Time passes':
      return 'sun';
    default:
      return 'info';
  }
}

/** Notifications (new clue, item received…) with a text label — never colour alone. */
export function Toasts({ ui }: { ui: GameRuntimeLike['ui'] }) {
  const state: UiState = useStore(ui);
  // One timer per toast, started when it appears. (Restarting every timer when
  // any toast arrives would keep a busy stream of notices on screen forever.)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const live = timers.current;
    state.toasts.forEach((t) => {
      if (!live.has(t.id))
        live.set(
          t.id,
          setTimeout(() => ui.dismissToast(t.id), TOAST_MS),
        );
    });
  }, [state.toasts, ui]);
  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach(clearTimeout);
      live.clear();
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {state.toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <Icon name={toastIcon(t.label)} className="toast__icon" />
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

const PLACE_MS = 2800;

/**
 * A large place-name card shown on arrival, so a change of scene is
 * unmistakable. Purely visual (the LiveAnnouncer already speaks it).
 */
export function PlaceBanner({ ui }: { ui: GameRuntimeLike['ui'] }) {
  const { place } = useStore(ui);
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);
  useEffect(() => {
    if (!place) return;
    const show = setTimeout(() => setVisibleSeq(place.seq), 0);
    const hide = setTimeout(() => setVisibleSeq(null), PLACE_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [place]);
  if (!place || visibleSeq !== place.seq) return null;
  return (
    <div key={place.seq} className="place-banner" aria-hidden="true" data-testid="place-banner">
      <span className="place-banner__rule" />
      <span className="place-banner__name">{place.name}</span>
      <span className="place-banner__rule" />
    </div>
  );
}

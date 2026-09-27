import type { Appearance } from '@/domain/characters';
import type { ContentKind, ContentRecord } from '@/domain/content-records';
import type { ChoiceView, Expression } from '@/domain/dialogue';
import type { MessageTone, PanelId } from '@/domain/events';
import { Store } from '@/shared/store';

/**
 * UI state: which overlays are open, the current dialogue view, prompts and
 * notifications. It is ephemeral (never saved) and separate from GameState.
 * React renders it; the application layer writes it. Phaser never sees it.
 */
export type OverlayId =
  'journal' | 'satchel' | 'quests' | 'pause' | 'goto' | 'history' | 'messages';

export interface DialogueSpeakerView {
  id: string;
  name: string;
  role: string | null;
  appearance: Appearance | null;
  kind: 'character' | 'player' | 'narrator';
}

export interface DialogueView {
  dialogueId: string;
  nodeId: string;
  speaker: DialogueSpeakerView;
  text: string;
  /** The speaker's face on this line (which portrait to show). */
  expression: Expression;
  kind: ContentKind;
  record: ContentRecord | null;
  choices: ChoiceView[];
  /** True when the node has no choices: "Continue" advances or ends. */
  canContinue: boolean;
  isLast: boolean;
}

export interface Toast {
  id: number;
  text: string;
  tone: MessageTone | 'success';
  /** Short visible label, e.g. "New clue" — status is never conveyed by colour alone. */
  label: string;
}

export interface FocusPrompt {
  entityId: string;
  label: string;
  verb: string;
}

export interface UiState {
  overlay: OverlayId | null;
  dialogue: DialogueView | null;
  puzzleId: string | null;
  panel: Exclude<PanelId, 'journal' | 'satchel'> | null;
  focus: FocusPrompt | null;
  toasts: Toast[];
  /** Every notification this session (newest last), so short notices can be re-read. */
  messages: Toast[];
  /** Polite screen-reader announcement (scene changes, arrivals). */
  announcement: string;
  /** Visual place-name banner shown on arrival (seq changes each time). */
  place: { name: string; seq: number } | null;
  transitioning: boolean;
  fatalError: string | null;
  storageWarning: string | null;
}

export const INITIAL_UI_STATE: UiState = {
  overlay: null,
  dialogue: null,
  puzzleId: null,
  panel: null,
  focus: null,
  toasts: [],
  messages: [],
  announcement: '',
  place: null,
  transitioning: false,
  fatalError: null,
  storageWarning: null,
};

const MAX_TOASTS = 4;
const MAX_MESSAGES = 50;

export class UiStore extends Store<UiState> {
  private toastId = 0;

  constructor(initial: UiState = INITIAL_UI_STATE) {
    super(initial);
  }

  /** The world only accepts movement when nothing modal is on screen. */
  get explorationAllowed(): boolean {
    const s = this.getState();
    return (
      !s.overlay && !s.dialogue && !s.puzzleId && !s.panel && !s.transitioning && !s.fatalError
    );
  }

  openOverlay(overlay: OverlayId): void {
    this.setState((s) => ({ ...s, overlay }));
  }

  closeOverlay(): void {
    this.setState((s) => (s.overlay ? { ...s, overlay: null } : s));
  }

  toggleOverlay(overlay: OverlayId): void {
    this.setState((s) => ({ ...s, overlay: s.overlay === overlay ? null : overlay }));
  }

  setDialogue(dialogue: DialogueView | null): void {
    this.setState((s) => ({ ...s, dialogue, overlay: dialogue ? null : s.overlay }));
  }

  setPuzzle(puzzleId: string | null): void {
    this.setState((s) => ({ ...s, puzzleId }));
  }

  setPanel(panel: UiState['panel']): void {
    this.setState((s) => ({ ...s, panel }));
  }

  setFocus(focus: FocusPrompt | null): void {
    this.setState((s) =>
      s.focus?.entityId === focus?.entityId && s.focus?.label === focus?.label
        ? s
        : { ...s, focus },
    );
  }

  pushToast(text: string, tone: Toast['tone'], label: string): number {
    const id = ++this.toastId;
    this.setState((s) => ({
      ...s,
      toasts: [...s.toasts, { id, text, tone, label }].slice(-MAX_TOASTS),
      messages: [...s.messages, { id, text, tone, label }].slice(-MAX_MESSAGES),
    }));
    return id;
  }

  dismissToast(id: number): void {
    this.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
  }

  announce(text: string): void {
    this.setState((s) => ({ ...s, announcement: text }));
  }

  showPlace(name: string): void {
    this.setState((s) => ({ ...s, place: { name, seq: (s.place?.seq ?? 0) + 1 } }));
  }

  setTransitioning(transitioning: boolean): void {
    this.setState((s) => ({ ...s, transitioning }));
  }

  setFatalError(message: string | null): void {
    this.setState((s) => ({ ...s, fatalError: message }));
  }

  setStorageWarning(message: string | null): void {
    this.setState((s) => ({ ...s, storageWarning: message }));
  }

  reset(): void {
    this.setState({ ...INITIAL_UI_STATE, storageWarning: this.getState().storageWarning });
  }
}

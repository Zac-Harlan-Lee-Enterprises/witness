import { useEffect } from 'react';
import type { InputAction } from '@/domain/settings';
import { ChapterSummary, ReflectionPanel, ScriptureConnection } from '../chapter/ChapterEnding';
import { useSettings, useStore } from '../common/hooks';
import { Modal } from '../common/Modal';
import { useServices } from '../common/services';
import { DialogueHistory, DialogueOverlay } from '../dialogue/DialogueOverlay';
import {
  Captions,
  Hud,
  InteractionPrompt,
  LiveAnnouncer,
  PlaceBanner,
  Toasts,
  TouchControls,
} from '../hud/Hud';
import { SatchelOverlay } from '../inventory/SatchelOverlay';
import { JournalOverlay } from '../journal/JournalOverlay';
import { MessageLog } from '../hud/MessageLog';
import { GoToList } from '../navigation/GoToList';
import { PauseMenu } from '../pause/PauseMenu';
import { PuzzleHost } from '../puzzles/PuzzleHost';
import { QuestLog } from '../quests/QuestLog';
import { GameViewport } from './GameViewport';
import { useSystemReducedMotion } from './motion';
import type { GameRuntimeLike } from './types';

export interface KeyboardAttacher {
  (onWorldFocus: () => boolean): () => void;
}

/**
 * The in-game screen: the world viewport plus every HTML overlay. Input
 * actions (from keyboard, gamepad or touch via VirtualInput) are routed here
 * to UI actions; movement itself is read by the world.
 */
export function GameScreen({
  runtime,
  attachKeyboard,
  onOpenSettings,
  onQuit,
}: {
  runtime: GameRuntimeLike;
  attachKeyboard: KeyboardAttacher;
  onOpenSettings: () => void;
  onQuit: () => void;
}) {
  const { input } = useServices();
  const ui = useStore(runtime.ui);
  const settings = useSettings();

  // Keyboard/gamepad → actions.
  useEffect(() => attachKeyboard(() => runtime.ui.explorationAllowed), [attachKeyboard, runtime]);
  useEffect(() => {
    const onAction = (action: InputAction): void => {
      const s = runtime.ui.getState();
      switch (action) {
        case 'interact':
          if (runtime.ui.explorationAllowed) runtime.controller.interactFocused();
          break;
        case 'pause':
          if (s.overlay) runtime.ui.closeOverlay();
          else if (!s.puzzleId && !s.panel) runtime.ui.openOverlay('pause');
          break;
        case 'journal':
        case 'satchel':
        case 'quests':
        case 'goto':
          if (!s.puzzleId && !s.panel && (!s.dialogue || action === 'journal'))
            runtime.ui.toggleOverlay(action);
          break;
        default:
          break;
      }
    };
    return input.onAction(onAction);
  }, [input, runtime]);

  // Play time, autosave on hide, motion settings.
  useEffect(() => {
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') runtime.controller.tick(5000);
    }, 5000);
    const flush = () => runtime.autosaver.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      clearInterval(tick);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [runtime]);
  const systemReducedMotion = useSystemReducedMotion();
  useEffect(() => {
    runtime.controller.applyMotionSettings();
  }, [runtime, settings.movementSpeed, settings.reducedMotion, systemReducedMotion]);

  return (
    <div className="game" data-exploring={runtime.ui.explorationAllowed ? 'true' : 'false'}>
      <h1 className="visually-hidden">{runtime.chapter.title}</h1>
      <GameViewport runtime={runtime} />
      <Hud runtime={runtime} />
      <PlaceBanner ui={runtime.ui} />
      {ui.storageWarning && (
        <p className="notice notice--warning notice--floating" role="status">
          {ui.storageWarning}
        </p>
      )}
      <InteractionPrompt runtime={runtime} />
      <TouchControls runtime={runtime} />
      <Toasts ui={runtime.ui} />
      <Captions />
      <LiveAnnouncer ui={runtime.ui} />
      <DialogueOverlay runtime={runtime} />
      <PuzzleHost runtime={runtime} />
      {ui.overlay === 'journal' && <JournalOverlay runtime={runtime} />}
      {ui.overlay === 'satchel' && <SatchelOverlay runtime={runtime} />}
      {ui.overlay === 'quests' && <QuestLog runtime={runtime} />}
      {ui.overlay === 'goto' && <GoToList runtime={runtime} />}
      {ui.overlay === 'history' && <DialogueHistory runtime={runtime} />}
      {ui.overlay === 'messages' && <MessageLog runtime={runtime} />}
      {ui.overlay === 'pause' && (
        <PauseMenu runtime={runtime} onSettings={onOpenSettings} onQuit={onQuit} />
      )}
      {ui.panel === 'scripture-connection' && <ScriptureConnection runtime={runtime} />}
      {ui.panel === 'reflection' && <ReflectionPanel runtime={runtime} />}
      {ui.panel === 'summary' && <ChapterSummary runtime={runtime} onReturnToTitle={onQuit} />}
      {ui.fatalError && (
        <Modal title="Something went wrong">
          <p>{ui.fatalError}</p>
          <button type="button" className="button button--primary" onClick={onQuit}>
            Return to title
          </button>
        </Modal>
      )}
    </div>
  );
}

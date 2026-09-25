import { Autosaver } from '@/application/autosaver';
import { DialogueController } from '@/application/dialogue-controller';
import { GameController } from '@/application/game-controller';
import { GameSession } from '@/application/game-session';
import { PuzzleController } from '@/application/puzzle-controller';
import { UiStore } from '@/application/ui-store';
import type { Chapter } from '@/domain/chapter';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import type { DomainEvent } from '@/domain/events';
import type { PlayerProfile } from '@/domain/profile';
import type { SaveGame, SaveSlot } from '@/domain/save';
import { prefersReducedMotionSetting } from '@/features/game/motion';
import { TypedEventBus } from '@/shared/event-bus';
import type { AppServices } from './services';

/**
 * Everything that lives for exactly one chapter run: the session, its
 * controllers, the UI store, autosave, and (lazily) the Phaser world.
 * React's GameScreen owns one GameRuntime and disposes it on exit.
 */
export class GameRuntime {
  readonly bus: TypedEventBus<DomainEvent>;
  readonly session: GameSession;
  readonly ui = new UiStore();
  readonly dialogue: DialogueController;
  readonly puzzles: PuzzleController;
  readonly controller: GameController;
  readonly autosaver: Autosaver;
  private disposed = false;
  private unmountWorld: (() => void) | null = null;

  constructor(
    readonly services: AppServices,
    readonly chapter: Chapter,
    readonly profile: PlayerProfile,
    save: SaveGame | null,
    onChapterComplete: (chapterId: string) => void,
  ) {
    const { logger, clock, settings, audio, analytics } = services;
    this.bus = new TypedEventBus<DomainEvent>((error, event) =>
      logger.error(`Event handler failed for ${event.type}`, error),
    );
    this.session = save
      ? GameSession.restore(chapter, save.state, this.bus, clock, logger)
      : GameSession.newGame(chapter, this.bus, clock, logger);
    const appearance = PLAYER_APPEARANCES[profile.look];
    this.dialogue = new DialogueController(
      this.session,
      this.ui,
      () => ({ player: profile.displayName }),
      () => ({ id: 'player', name: profile.displayName, role: null, appearance, kind: 'player' }),
      logger,
    );
    this.puzzles = new PuzzleController(this.session, this.ui, logger);
    this.controller = new GameController({
      session: this.session,
      bus: this.bus,
      ui: this.ui,
      dialogue: this.dialogue,
      puzzles: this.puzzles,
      audio,
      analytics,
      settings: () => settings.current,
      reducedMotion: () => prefersReducedMotionSetting(settings.current.reducedMotion),
      playerAppearance: appearance,
      logger,
      onChapterComplete,
    });
    this.autosaver = new Autosaver(this.session, services.saves, profile.id, this.bus, (ok) => {
      if (!ok)
        this.ui.pushToast(
          'Your progress could not be saved on this device.',
          'warning',
          'Save failed',
        );
    });
    if (save) {
      this.session.publish([
        { type: 'SaveRestored', saveId: save.id, fromSchemaVersion: save.schemaVersion },
      ]);
    }
    if (!services.repositories.status.persistent) {
      this.ui.setStorageWarning(services.repositories.status.reason);
    }
  }

  /** Lazy-load Phaser and attach the world to a DOM element. */
  async mountWorld(parent: HTMLElement): Promise<void> {
    const { mountWorld } = await import('@/game/phaser/mount-world');
    if (this.disposed) return;
    const port = await mountWorld({
      parent,
      input: this.services.input,
      onEvent: this.controller.handleWorldEvent,
      logger: this.services.logger,
    });
    if (this.disposed) {
      port.destroy();
      return;
    }
    this.unmountWorld = () => {
      this.controller.detachWorld();
      port.destroy();
    };
    await this.controller.attachWorld(port);
  }

  async saveTo(slot: SaveSlot): Promise<boolean> {
    const ok = await this.autosaver.write(slot);
    this.ui.pushToast(
      ok ? 'Game saved.' : 'The game could not be saved.',
      ok ? 'success' : 'warning',
      ok ? 'Saved' : 'Save failed',
    );
    return ok;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.autosaver.dispose();
    this.unmountWorld?.();
    this.controller.dispose();
    this.bus.clear();
    this.services.input.releaseAll();
  }
}

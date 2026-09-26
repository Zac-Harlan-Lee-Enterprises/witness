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
import type { mountWorld as mountWorldFn } from '@/game/phaser/mount-world';
import type { AppServices } from './services';

export type WorldLoader = () => Promise<typeof mountWorldFn>;

/** Default loader: Phaser and the world scene download only when a chapter starts. */
const loadPhaserWorld: WorldLoader = () =>
  import('@/game/phaser/mount-world').then((m) => m.mountWorld);

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
  private mountGeneration = 0;

  constructor(
    readonly services: AppServices,
    readonly chapter: Chapter,
    readonly profile: PlayerProfile,
    /** A loaded save and the schema version it was stored in (before migration). */
    restored: { save: SaveGame; fromVersion: number } | null,
    onChapterComplete: (chapterId: string) => void,
  ) {
    const save = restored?.save ?? null;
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
    if (restored) {
      this.controller.noteRestored(
        restored.save.id,
        restored.fromVersion,
        restored.save.contentVersion,
      );
    }
    if (!services.repositories.status.persistent) {
      this.ui.setStorageWarning(services.repositories.status.reason);
    }
  }

  /**
   * Lazy-load Phaser and attach the world to a DOM element.
   *
   * Only the most recent mount ever survives. React (StrictMode in
   * development, or a fast remount) can mount → unmount → mount before the
   * first engine has finished loading; without this guard two Phaser
   * canvases end up stacked and the visible one is frozen. See
   * tests/ui/game-runtime.test.tsx.
   */
  async mountWorld(parent: HTMLElement, loadWorld: WorldLoader = loadPhaserWorld): Promise<void> {
    const generation = ++this.mountGeneration;
    this.unmountWorld?.();
    const isStale = (): boolean => this.disposed || generation !== this.mountGeneration;
    const mount = await loadWorld();
    if (isStale()) return;
    const port = await mount({
      parent,
      input: this.services.input,
      onEvent: this.controller.handleWorldEvent,
      logger: this.services.logger,
      framing: this.services.config.cameraFraming,
      artLighting: this.services.config.artLighting,
    });
    if (isStale()) {
      port.destroy();
      return;
    }
    const unmount = (): void => {
      if (this.unmountWorld !== unmount) return;
      this.unmountWorld = null;
      this.controller.detachWorld();
      port.destroy();
    };
    this.unmountWorld = unmount;
    await this.controller.attachWorld(port);
  }

  /** Tear down the world (and cancel any mount still loading). */
  releaseWorld(): void {
    this.mountGeneration++;
    this.unmountWorld?.();
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

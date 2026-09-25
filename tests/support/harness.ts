import { AnalyticsService } from '@/application/analytics';
import { DialogueController } from '@/application/dialogue-controller';
import { GameController } from '@/application/game-controller';
import { GameSession } from '@/application/game-session';
import type {
  AnalyticsEvent,
  WorldEntityView,
  WorldPort,
  WorldSceneModel,
} from '@/application/ports';
import { PuzzleController } from '@/application/puzzle-controller';
import { UiStore } from '@/application/ui-store';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import type { Chapter } from '@/domain/chapter';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import type { DomainEvent } from '@/domain/events';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import type { GameState } from '@/domain/state/game-state';
import { SilentAudio } from '@/infrastructure/audio/synth-audio';
import { TypedEventBus } from '@/shared/event-bus';
import { createLogger } from '@/shared/logger';

let cached: Chapter | null = null;
export function loadJericho(): Chapter {
  cached ??= parseChapter(ROAD_TO_JERICHO);
  return cached;
}

/** A WorldPort double: records what the app asked the world to do. */
export class FakeWorld implements WorldPort {
  scenes: WorldSceneModel[] = [];
  entities: WorldEntityView[] = [];
  controlsEnabled = true;
  travels: string[] = [];
  async loadScene(model: WorldSceneModel): Promise<void> {
    this.scenes.push(model);
    this.entities = model.entities;
  }
  updateEntities(entities: WorldEntityView[]): void {
    this.entities = entities;
  }
  travelTo(targetId: string): void {
    this.travels.push(targetId);
  }
  setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
  }
  setMotion(): void {}
  destroy(): void {}
  get currentScene(): string | undefined {
    return this.scenes[this.scenes.length - 1]?.sceneId;
  }
}

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

export interface Harness {
  chapter: Chapter;
  bus: TypedEventBus<DomainEvent>;
  session: GameSession;
  ui: UiStore;
  dialogue: DialogueController;
  puzzles: PuzzleController;
  controller: GameController;
  world: FakeWorld;
  events: DomainEvent[];
  analytics: AnalyticsEvent[];
  state: () => GameState;
}

export async function createHarness(
  options: { restore?: GameState; analyticsConsent?: boolean } = {},
): Promise<Harness> {
  const chapter = loadJericho();
  const logger = createLogger({ level: 'error', echo: false });
  const bus = new TypedEventBus<DomainEvent>((error) => {
    throw error;
  });
  const events: DomainEvent[] = [];
  bus.onAny((e) => events.push(e));
  let t = 0;
  const clock = { now: () => (t += 1000) };
  const session = options.restore
    ? GameSession.restore(chapter, options.restore, bus, clock, logger)
    : GameSession.newGame(chapter, bus, clock, logger);
  const ui = new UiStore();
  const dialogue = new DialogueController(
    session,
    ui,
    () => ({ player: 'Ari' }),
    () => ({
      id: 'player',
      name: 'Ari',
      role: null,
      appearance: PLAYER_APPEARANCES['look-1'],
      kind: 'player',
    }),
    logger,
  );
  const puzzles = new PuzzleController(session, ui, logger);
  const analyticsSent: AnalyticsEvent[] = [];
  const analytics = new AnalyticsService(
    { name: 'test', track: (e) => analyticsSent.push(e) },
    () => options.analyticsConsent ?? false,
  );
  const controller = new GameController({
    session,
    bus,
    ui,
    dialogue,
    puzzles,
    audio: new SilentAudio(),
    analytics,
    settings: () => DEFAULT_SETTINGS,
    reducedMotion: () => false,
    playerAppearance: PLAYER_APPEARANCES['look-1'],
    logger,
  });
  const world = new FakeWorld();
  await controller.attachWorld(world);
  await flush();
  return {
    chapter,
    bus,
    session,
    ui,
    dialogue,
    puzzles,
    controller,
    world,
    events,
    analytics: analyticsSent,
    state: () => session.state,
  };
}

/** Scripted player actions built on the real application layer. */
export class Player {
  constructor(readonly h: Harness) {}

  get dialogueView() {
    return this.h.ui.getState().dialogue;
  }

  /** Continue through narration until a node with choices (or the end). */
  async advance(): Promise<void> {
    for (let i = 0; i < 50; i++) {
      const view = this.dialogueView;
      if (!view || !view.canContinue) break;
      this.h.dialogue.advance();
      await flush();
    }
  }

  async choose(choiceId: string): Promise<void> {
    await this.advance();
    const view = this.dialogueView;
    if (!view) throw new Error(`No dialogue open when choosing '${choiceId}'`);
    const choice = view.choices.find((c) => c.id === choiceId);
    if (!choice) {
      throw new Error(
        `Choice '${choiceId}' not visible in ${view.dialogueId}/${view.nodeId}. Visible: ${view.choices.map((c) => c.id).join(', ')}`,
      );
    }
    if (!choice.available)
      throw new Error(`Choice '${choiceId}' unavailable: ${choice.unavailableText}`);
    this.h.dialogue.choose(choiceId);
    await flush();
  }

  /** Finish the current conversation, following Continue only. */
  async finish(): Promise<void> {
    await this.advance();
    if (this.dialogueView && this.dialogueView.choices.length > 0) {
      throw new Error(
        `Dialogue ${this.dialogueView.dialogueId}/${this.dialogueView.nodeId} is waiting for a choice`,
      );
    }
    await flush();
  }

  async interact(entityId: string): Promise<void> {
    if (!this.h.ui.explorationAllowed) {
      throw new Error(`Cannot interact with '${entityId}': UI busy ${JSON.stringify(this.busy())}`);
    }
    this.h.controller.interact(entityId);
    await flush();
  }

  async exit(exitId: string): Promise<void> {
    this.h.controller.handleWorldEvent({ type: 'exitReached', exitId });
    await flush();
  }

  async step(x: number, y: number): Promise<void> {
    this.h.controller.handleWorldEvent({ type: 'tileEntered', x, y });
    await flush();
  }

  busy() {
    const s = this.h.ui.getState();
    return {
      overlay: s.overlay,
      dialogue: s.dialogue?.dialogueId,
      puzzle: s.puzzleId,
      panel: s.panel,
      transitioning: s.transitioning,
    };
  }

  scene(): string {
    return this.h.session.state.sceneId;
  }
}

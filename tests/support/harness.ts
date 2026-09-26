import { AnalyticsService } from '@/application/analytics';
import { DialogueController } from '@/application/dialogue-controller';
import { GameController } from '@/application/game-controller';
import { GameSession } from '@/application/game-session';
import type {
  AnalyticsEvent,
  FootstepSurface,
  WorldConversation,
  WorldEmphasis,
  WorldEntityView,
  WorldPort,
  WorldSceneModel,
} from '@/application/ports';
import { PuzzleController } from '@/application/puzzle-controller';
import { UiStore } from '@/application/ui-store';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import type { Chapter, ChapterInput } from '@/domain/chapter';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import type { DomainEvent } from '@/domain/events';
import { DEFAULT_SETTINGS } from '@/domain/settings';
import type { GameState } from '@/domain/state/game-state';
import type { LookMark, Weather } from '@/domain/world';
import { SilentAudio } from '@/infrastructure/audio/synth-audio';
import { TypedEventBus } from '@/shared/event-bus';
import { createLogger } from '@/shared/logger';

const parsed = new Map<string, Chapter>();
/** Parse (once per test run) any chapter's content, e.g. `loadChapter(STORM_ON_GALILEE)`. */
export function loadChapter(input: ChapterInput): Chapter {
  let chapter = parsed.get(input.id);
  if (!chapter) {
    chapter = parseChapter(input);
    parsed.set(input.id, chapter);
  }
  return chapter;
}
export function loadJericho(): Chapter {
  return loadChapter(ROAD_TO_JERICHO);
}

/** An AudioPort double that records footsteps (everything else is silent). */
export class RecordingAudio extends SilentAudio {
  footsteps: FootstepSurface[] = [];
  override playFootstep(surface: FootstepSurface): void {
    this.footsteps.push(surface);
  }
}

/** A WorldPort double: records what the app asked the world to do. */
export class FakeWorld implements WorldPort {
  scenes: WorldSceneModel[] = [];
  entities: WorldEntityView[] = [];
  controlsEnabled = true;
  travels: string[] = [];
  /** Hold scene loads open (like art still downloading) until `releaseLoads()`. */
  holdLoads = false;
  private held: Array<() => void> = [];
  async loadScene(model: WorldSceneModel): Promise<void> {
    if (this.holdLoads) await new Promise<void>((resolve) => this.held.push(resolve));
    this.scenes.push(model);
    this.entities = model.entities;
  }
  releaseLoads(): void {
    this.holdLoads = false;
    for (const resolve of this.held.splice(0)) resolve();
  }
  updateEntities(entities: WorldEntityView[]): void {
    this.entities = entities;
  }
  playerMarks: LookMark[][] = [];
  setPlayerMarks(marks: LookMark[]): void {
    this.playerMarks.push(marks);
  }
  weathers: Weather[] = [];
  setWeather(weather: Weather): void {
    this.weathers.push(weather);
  }
  /** The weather now: the last change, else what the scene loaded with. */
  get weather(): Weather | undefined {
    return this.weathers.at(-1) ?? this.scenes.at(-1)?.weather;
  }
  travelTo(targetId: string): void {
    this.travels.push(targetId);
  }
  setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
  }
  setMotion(): void {}
  lighting: { hour: number | null; lamp: boolean } | null = null;
  setLighting(lighting: { hour: number | null; lamp: boolean }): void {
    this.lighting = lighting;
  }
  conversations: Array<WorldConversation | null> = [];
  setConversation(conversation: WorldConversation | null): void {
    this.conversations.push(conversation);
  }
  emphases: WorldEmphasis[] = [];
  emphasize(emphasis: WorldEmphasis): void {
    this.emphases.push(emphasis);
  }
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
  audio: RecordingAudio;
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
  options: { restore?: GameState; analyticsConsent?: boolean; chapter?: Chapter } = {},
): Promise<Harness> {
  const chapter = options.chapter ?? loadJericho();
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
  const audio = new RecordingAudio();
  const controller = new GameController({
    session,
    bus,
    ui,
    dialogue,
    puzzles,
    audio,
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
    audio,
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

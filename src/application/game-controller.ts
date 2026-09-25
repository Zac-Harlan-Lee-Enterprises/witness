import type { Appearance } from '@/domain/characters';
import { evaluate } from '@/domain/conditions';
import type { DomainEvent } from '@/domain/events';
import { MOVEMENT_SPEEDS, type GameSettings } from '@/domain/settings';
import type { GameState } from '@/domain/state/game-state';
import { inRect } from '@/domain/world';
import type { TypedEventBus } from '@/shared/event-bus';
import type { Logger } from '@/shared/logger';
import type { AnalyticsService } from './analytics';
import type { DialogueController } from './dialogue-controller';
import type { GameSession } from './game-session';
import type { AudioPort, WorldEvent, WorldPort } from './ports';
import type { PuzzleController } from './puzzle-controller';
import { timeOfDayLabel } from './time-of-day';
import type { UiStore } from './ui-store';
import {
  buildSceneModel,
  destinations,
  findScene,
  lightingOf,
  VERB_LABELS,
  visibleEntities,
  type Destination,
} from './world-model';

/**
 * The boundary between the world (Phaser adapter), the story (session +
 * domain) and the UI (UiStore → React):
 *
 *   Phaser adapter ──WorldEvent──▶ GameController ──effects──▶ GameSession
 *        ▲                              │  ▲                        │
 *        └──────── WorldPort ◀──────────┘  └──── DomainEvent bus ◀──┘
 *                                       │
 *                                       └──▶ UiStore ──▶ React
 *
 * Requests that need the screen (open a puzzle, change scene, start a
 * conversation, show a panel) are queued while something modal is open and
 * run in order once it closes, so content can chain them safely.
 */
export interface GameControllerDeps {
  session: GameSession;
  bus: TypedEventBus<DomainEvent>;
  ui: UiStore;
  dialogue: DialogueController;
  puzzles: PuzzleController;
  audio: AudioPort;
  analytics: AnalyticsService;
  settings: () => GameSettings;
  reducedMotion: () => boolean;
  playerAppearance: Appearance;
  logger: Logger;
  onChapterComplete?: (chapterId: string) => void;
}

type RequestEvent = Extract<
  DomainEvent,
  { type: 'SceneTransitionRequested' | 'PuzzleRequested' | 'DialogueRequested' | 'PanelRequested' }
>;

export class GameController {
  private world: WorldPort | null = null;
  private readonly deferred: RequestEvent[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  private entitiesKey = '';
  private lastStoryState: GameState | null = null;
  private disposed = false;
  private chapterStarted = false;

  constructor(private readonly deps: GameControllerDeps) {
    const { bus, session, ui } = deps;
    this.unsubscribers.push(
      bus.onAny((event) => this.onDomainEvent(event)),
      session.store.subscribe(() => this.refreshEntities()),
      ui.subscribe(() => this.syncControls()),
    );
  }

  // ── World lifecycle ─────────────────────────────────────────────────────
  async attachWorld(world: WorldPort): Promise<void> {
    this.world = world;
    this.applyMotionSettings();
    const { session } = this.deps;
    const opening = !session.state.flags['chapter:opened'];
    if (opening && !this.chapterStarted) {
      this.chapterStarted = true;
      session.publish([{ type: 'ChapterStarted', chapterId: session.chapter.id }]);
    }
    await this.loadCurrentScene();
    if (opening && !session.state.flags['chapter:opened']) {
      session.dispatch([
        { type: 'setFlag', flag: 'chapter:opened', value: true },
        ...session.chapter.opening,
      ]);
    }
  }

  /**
   * Record that play resumed from a save (published once subscribers exist),
   * and say so if the save came from a different version of the chapter.
   */
  noteRestored(saveId: string, fromSchemaVersion: number, contentVersion: string): void {
    const { session, ui, logger } = this.deps;
    session.publish([{ type: 'SaveRestored', saveId, fromSchemaVersion }]);
    if (contentVersion !== session.chapter.contentVersion) {
      logger.info(
        `Save ${saveId} was made with content ${contentVersion}; chapter is ${session.chapter.contentVersion}`,
      );
      ui.pushToast(
        'This save was made with an earlier version of this chapter. If anything seems out of place, starting the chapter again will fix it.',
        'info',
        'Note',
      );
    }
  }

  detachWorld(): void {
    this.world = null;
  }

  applyMotionSettings(): void {
    this.world?.setMotion({
      reducedMotion: this.deps.reducedMotion(),
      tilesPerSecond: MOVEMENT_SPEEDS[this.deps.settings().movementSpeed],
    });
  }

  private async loadCurrentScene(): Promise<void> {
    const { session, ui, audio } = this.deps;
    const scene = findScene(session.chapter, session.state.sceneId);
    ui.setTransitioning(true);
    try {
      const model = buildSceneModel(session.chapter, session.state, this.deps.playerAppearance);
      this.entitiesKey = JSON.stringify(model.entities);
      await this.world?.loadScene(model);
      audio.setAmbience(scene.ambience);
      audio.setMusic(scene.music);
      ui.announce(`${scene.name}. ${scene.description}`);
      ui.showPlace(scene.name);
    } catch (error) {
      this.deps.logger.error('Scene failed to load', error);
      ui.setFatalError(
        'This area could not be loaded. Your progress is saved — try returning to the menu.',
      );
    } finally {
      ui.setTransitioning(false);
      this.flushDeferred();
      // Story state may already satisfy a state trigger in the new place.
      this.queueStateTriggers();
    }
  }

  // ── Input from the world / UI ───────────────────────────────────────────
  handleWorldEvent = (event: WorldEvent): void => {
    if (this.disposed) return;
    switch (event.type) {
      case 'playerMoved':
        this.deps.session.updatePlayer(event.x, event.y, event.facing);
        break;
      case 'focusChanged':
        this.updateFocus(event.entityId);
        break;
      case 'exitReached':
        this.useExit(event.exitId);
        break;
      case 'tileEntered':
        this.checkTriggers(event.x, event.y);
        break;
      case 'arrived':
        this.arrived(event.targetId);
        break;
      case 'unreachable':
        this.deps.ui.pushToast('You can’t get there from here yet.', 'info', 'Not yet');
        break;
      case 'sceneReady':
        break;
    }
  };

  interactFocused(): void {
    const focus = this.deps.ui.getState().focus;
    if (focus) this.interact(focus.entityId);
  }

  interact(entityId: string): void {
    const { session, ui, dialogue, audio } = this.deps;
    if (!ui.explorationAllowed) return;
    const scene = findScene(session.chapter, session.state.sceneId);
    const entity = scene.entities.find((e) => e.id === entityId);
    if (!entity?.interaction || !evaluate(entity.visibleWhen, session.state)) return;
    audio.playSfx('interact');
    const { interaction } = entity;
    if (!evaluate(interaction.requires, session.state)) {
      ui.pushToast(interaction.blockedText ?? 'Not right now.', 'info', 'Note');
      return;
    }
    if (interaction.effects.length > 0) session.dispatch(interaction.effects);
    if (interaction.dialogue) dialogue.start(interaction.dialogue);
  }

  /** "Go to…" — walk (or jump) to an entity or exit, then use it. */
  travelTo(targetId: string): void {
    if (!this.deps.ui.explorationAllowed && this.deps.ui.getState().overlay !== 'goto') return;
    this.deps.ui.closeOverlay();
    this.world?.travelTo(targetId, this.deps.settings().instantTravel);
  }

  destinations(): Destination[] {
    return destinations(this.deps.session.chapter, this.deps.session.state);
  }

  /** Engine-level chapter ending: connection → reflection → summary. */
  panelFinished(panel: 'scripture-connection' | 'reflection' | 'summary'): void {
    const { session, ui } = this.deps;
    if (panel === 'scripture-connection') {
      session.dispatch([{ type: 'setFlag', flag: 'seen:scripture-connection', value: true }]);
      ui.setPanel('reflection');
    } else if (panel === 'reflection') {
      session.dispatch([{ type: 'completeChapter' }]);
      ui.setPanel('summary');
    } else {
      ui.setPanel(null);
      this.flushDeferred();
    }
  }

  closePuzzle(): void {
    this.deps.puzzles.close();
    this.flushDeferred();
  }

  tick(ms: number): void {
    if (this.deps.ui.getState().overlay === 'pause') return;
    this.deps.session.addPlayTime(ms);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribers.forEach((u) => u());
    this.world = null;
  }

  // ── Internals ───────────────────────────────────────────────────────────
  private arrived(targetId: string): void {
    const { session } = this.deps;
    const scene = findScene(session.chapter, session.state.sceneId);
    if (scene.exits.some((x) => x.id === targetId)) this.useExit(targetId);
    else if (scene.entities.some((e) => e.id === targetId)) this.interact(targetId);
  }

  private updateFocus(entityId: string | null): void {
    const { session, ui } = this.deps;
    if (!entityId) {
      ui.setFocus(null);
      return;
    }
    const scene = findScene(session.chapter, session.state.sceneId);
    const entity = scene.entities.find((e) => e.id === entityId);
    if (!entity?.interaction) {
      ui.setFocus(null);
      return;
    }
    ui.setFocus({ entityId, label: entity.label, verb: VERB_LABELS[entity.interaction.verb] });
  }

  private useExit(exitId: string): void {
    const { session, ui, dialogue } = this.deps;
    if (!ui.explorationAllowed) return;
    const scene = findScene(session.chapter, session.state.sceneId);
    const exit = scene.exits.find((x) => x.id === exitId);
    if (!exit) return;
    if (!evaluate(exit.requires, session.state)) {
      if (exit.blockedDialogue) dialogue.start(exit.blockedDialogue);
      else ui.pushToast(exit.blockedText ?? 'You can’t go that way yet.', 'info', 'Not yet');
      return;
    }
    this.deps.audio.playSfx('door');
    session.dispatch(exit.effects);
    void this.changeScene(exit.to.scene, exit.to.spawn);
  }

  private checkTriggers(x: number, y: number): void {
    const { session } = this.deps;
    const scene = findScene(session.chapter, session.state.sceneId);
    for (const trigger of scene.triggers) {
      if (!trigger.area || !inRect(x, y, trigger.area)) continue;
      if (session.state.flags[trigger.onceFlag]) continue;
      if (!evaluate(trigger.when, session.state)) continue;
      session.dispatch([
        { type: 'setFlag', flag: trigger.onceFlag, value: true },
        ...trigger.effects,
      ]);
    }
  }

  private stateCheckQueued = false;

  /** State triggers: evaluated (once per burst of events) after the story changes. */
  private queueStateTriggers(): void {
    if (this.stateCheckQueued) return;
    this.stateCheckQueued = true;
    queueMicrotask(() => {
      this.stateCheckQueued = false;
      if (this.disposed || this.deps.ui.getState().transitioning) return;
      const { session } = this.deps;
      const scene = findScene(session.chapter, session.state.sceneId);
      for (const trigger of scene.triggers) {
        if (trigger.area || session.state.flags[trigger.onceFlag]) continue;
        if (!evaluate(trigger.when, session.state)) continue;
        session.dispatch([
          { type: 'setFlag', flag: trigger.onceFlag, value: true },
          ...trigger.effects,
        ]);
      }
    });
  }

  private async changeScene(sceneId: string, spawnId: string): Promise<void> {
    this.deps.session.enterScene(sceneId, spawnId);
    await this.loadCurrentScene();
  }

  private isBusy(): boolean {
    const s = this.deps.ui.getState();
    return (
      this.deps.dialogue.isActive || s.puzzleId !== null || s.transitioning || s.panel !== null
    );
  }

  private flushDeferred(): void {
    while (this.deferred.length > 0 && !this.isBusy()) {
      this.runRequest(this.deferred.shift() as RequestEvent);
    }
  }

  private runRequest(event: RequestEvent): void {
    switch (event.type) {
      case 'SceneTransitionRequested':
        void this.changeScene(event.sceneId, event.spawnId);
        break;
      case 'PuzzleRequested':
        this.deps.puzzles.open(event.puzzleId);
        break;
      case 'DialogueRequested':
        this.deps.dialogue.start(event.dialogueId);
        break;
      case 'PanelRequested':
        if (event.panel === 'journal') this.deps.ui.openOverlay('journal');
        else if (event.panel === 'satchel') this.deps.ui.openOverlay('satchel');
        else this.deps.ui.setPanel(event.panel);
        break;
    }
  }

  private onDomainEvent(event: DomainEvent): void {
    const { ui, audio, session, analytics } = this.deps;
    const chapter = session.chapter;
    analytics.fromDomainEvent(event, {
      playTimeMs: session.state.playTimeMs,
      isSideQuest: (id) => chapter.quests.some((q) => q.id === id && q.kind === 'side'),
    });
    if (
      event.type === 'ClueDiscovered' ||
      event.type === 'FlagChanged' ||
      event.type === 'ItemCollected' ||
      event.type === 'ItemRemoved' ||
      event.type === 'PuzzleCompleted' ||
      event.type === 'ChoiceRecorded' ||
      event.type === 'SceneEntered'
    ) {
      this.queueStateTriggers();
    }
    switch (event.type) {
      case 'SceneTransitionRequested':
      case 'PuzzleRequested':
      case 'DialogueRequested':
      case 'PanelRequested':
        this.deferred.push(event);
        // Defer to a microtask so the effect batch that produced this finishes first.
        queueMicrotask(() => this.flushDeferred());
        break;
      case 'ConversationCompleted':
        queueMicrotask(() => this.flushDeferred());
        break;
      case 'MessageRequested':
        ui.pushToast(event.text, event.tone, event.tone === 'warning' ? 'Careful' : 'Note');
        break;
      case 'SoundRequested':
        audio.playSfx(event.sound as Parameters<typeof audio.playSfx>[0]);
        break;
      case 'ItemCollected': {
        const item = chapter.items.find((i) => i.id === event.itemId);
        ui.pushToast(
          `${item?.name ?? event.itemId}${event.quantity > 1 ? ` ×${event.quantity}` : ''}`,
          'success',
          'Received',
        );
        audio.playSfx('item');
        break;
      }
      case 'ItemRemoved': {
        if (ui.getState().puzzleId) break; // packing removes many items at once; the puzzle UI explains it
        const item = chapter.items.find((i) => i.id === event.itemId);
        ui.pushToast(
          `${item?.name ?? event.itemId}${event.quantity > 1 ? ` ×${event.quantity}` : ''}`,
          'info',
          'Used',
        );
        break;
      }
      case 'ClueDiscovered': {
        const clue = chapter.clues.find((c) => c.id === event.clueId);
        ui.pushToast(clue?.title ?? 'A new clue', 'success', 'New clue');
        audio.playSfx('journal');
        break;
      }
      case 'JournalEntryUnlocked': {
        const entry = chapter.journal.find((j) => j.id === event.entryId);
        if (entry && entry.category !== 'people') ui.pushToast(entry.title, 'info', 'Journal');
        break;
      }
      case 'QuestStarted': {
        const quest = chapter.quests.find((q) => q.id === event.questId);
        ui.pushToast(
          quest?.name ?? event.questId,
          'success',
          quest?.kind === 'side' ? 'Side quest' : 'New quest',
        );
        audio.playSfx('quest');
        break;
      }
      case 'QuestStageAdvanced': {
        const quest = chapter.quests.find((q) => q.id === event.questId);
        const stage = quest?.stages.find((s) => s.id === event.toStage);
        if (stage) ui.pushToast(stage.title, 'info', 'Next step');
        break;
      }
      case 'QuestCompleted':
      case 'QuestFailed': {
        const quest = chapter.quests.find((q) => q.id === event.questId);
        const outcome = quest?.outcomes.find((o) => o.id === event.outcomeId);
        ui.pushToast(`${quest?.name ?? ''}: ${outcome?.title ?? ''}`, 'success', 'Quest resolved');
        audio.playSfx('quest');
        break;
      }
      case 'CounterChanged':
        if (
          chapter.timeCounter &&
          event.counter === chapter.timeCounter &&
          timeOfDayLabel(event.from) !== timeOfDayLabel(event.to)
        ) {
          ui.pushToast(
            `It is now ${timeOfDayLabel(event.to).toLowerCase()}.`,
            'narration',
            'Time passes',
          );
        }
        break;
      case 'PuzzleCompleted':
        audio.playSfx('solved');
        break;
      case 'ChapterCompleted':
        this.deps.onChapterComplete?.(event.chapterId);
        break;
      default:
        break;
    }
    // Keep the world's light in step with the story clock and the lamp.
    if (
      (event.type === 'CounterChanged' && event.counter === chapter.timeCounter) ||
      ((event.type === 'ItemCollected' || event.type === 'ItemRemoved') &&
        event.itemId === chapter.lightItem)
    ) {
      this.world?.setLighting(lightingOf(chapter, session.state));
    }
    // Re-render the dialogue so choice availability tracks state changes.
    if (
      this.deps.dialogue.isActive &&
      (event.type === 'ItemRemoved' || event.type === 'FlagChanged')
    ) {
      this.deps.dialogue.render();
    }
  }

  private refreshEntities(): void {
    if (!this.world || this.deps.ui.getState().transitioning) return;
    const { session } = this.deps;
    // Position updates arrive often; only story changes can alter visibility.
    const prev = this.lastStoryState;
    const next = session.state;
    this.lastStoryState = next;
    if (prev && !storyChanged(prev, next)) return;
    const scene = findScene(session.chapter, session.state.sceneId);
    const entities = visibleEntities(session.chapter, scene, session.state);
    const key = JSON.stringify(entities);
    if (key === this.entitiesKey) return;
    this.entitiesKey = key;
    this.world.updateEntities(entities);
  }

  private syncControls(): void {
    this.world?.setControlsEnabled(this.deps.ui.explorationAllowed);
  }
}

const STORY_KEYS: ReadonlyArray<keyof GameState> = [
  'sceneId',
  'flags',
  'counters',
  'inventory',
  'quests',
  'trust',
  'choices',
  'clues',
  'puzzles',
  'metCharacters',
  'conversations',
  'journal',
];

function storyChanged(a: GameState, b: GameState): boolean {
  return STORY_KEYS.some((k) => a[k] !== b[k]);
}

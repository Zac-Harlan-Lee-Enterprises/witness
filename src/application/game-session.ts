import type { Chapter } from '@/domain/chapter';
import type { Effect } from '@/domain/effects';
import type { DomainEvent } from '@/domain/events';
import { markJournalSeen } from '@/domain/journal';
import { runEffects } from '@/domain/rules';
import {
  appendUnique,
  createInitialState,
  MAX_DIALOGUE_LOG,
  MAX_REFLECTION_LENGTH,
  type DialogueLogEntry,
  type Direction,
  type GameState,
  type PuzzleProgress,
} from '@/domain/state/game-state';
import type { TypedEventBus } from '@/shared/event-bus';
import type { Logger } from '@/shared/logger';
import { Store } from '@/shared/store';
import type { Clock } from './ports';

/**
 * GameSession owns the persistent GameState for one chapter run.
 *
 * - All story changes go through `dispatch(effects)` → domain rules runner.
 * - The resulting domain events are published on the typed bus AFTER the new
 *   state is committed, via a FIFO queue so re-entrant dispatches (a handler
 *   that dispatches) keep a deterministic, breadth-first event order.
 * - React reads `store`; Phaser never touches GameState directly.
 */
export class GameSession {
  readonly store: Store<GameState>;
  private readonly queue: DomainEvent[] = [];
  private emitting = false;

  private constructor(
    readonly chapter: Chapter,
    state: GameState,
    private readonly bus: TypedEventBus<DomainEvent>,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {
    this.store = new Store(state);
  }

  static newGame(
    chapter: Chapter,
    bus: TypedEventBus<DomainEvent>,
    clock: Clock,
    logger: Logger,
  ): GameSession {
    const scene = chapter.scenes.find((s) => s.id === chapter.start.scene);
    const spawn = scene?.spawns[chapter.start.spawn];
    if (!scene || !spawn) throw new Error(`Chapter ${chapter.id} has an invalid start location`);
    const state = createInitialState({
      chapterId: chapter.id,
      sceneId: scene.id,
      spawn,
      flags: chapter.initial.flags,
      counters: chapter.initial.counters,
      inventory: chapter.initial.inventory,
    });
    const session = new GameSession(chapter, state, bus, clock, logger);
    session.publish([{ type: 'ChapterStarted', chapterId: chapter.id }]);
    return session;
  }

  static restore(
    chapter: Chapter,
    state: GameState,
    bus: TypedEventBus<DomainEvent>,
    clock: Clock,
    logger: Logger,
  ): GameSession {
    return new GameSession(chapter, state, bus, clock, logger);
  }

  get state(): GameState {
    return this.store.getState();
  }

  /** Apply effects through the domain rules and publish resulting events. */
  dispatch(effects: readonly Effect[]): DomainEvent[] {
    if (effects.length === 0) return [];
    try {
      const result = runEffects(this.state, effects, {
        chapter: this.chapter,
        nowMs: this.state.playTimeMs,
      });
      this.store.setState(result.state);
      this.publish(result.events);
      return result.events;
    } catch (error) {
      // Invalid content transitions must not crash the game: log and continue.
      this.logger.error('Effect dispatch failed', error);
      return [];
    }
  }

  /** Move to a scene (called by the controller once the transition is approved). */
  enterScene(sceneId: string, spawnId: string | null): void {
    const scene = this.chapter.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      this.logger.error(`enterScene: unknown scene ${sceneId}`);
      return;
    }
    const spawn = spawnId ? scene.spawns[spawnId] : undefined;
    this.store.setState((s) => ({
      ...s,
      sceneId,
      player: spawn ? { ...spawn } : s.player,
      visitedScenes: appendUnique(s.visitedScenes, sceneId),
    }));
    this.publish([{ type: 'SceneEntered', sceneId, spawnId }]);
    // Visiting a scene can satisfy objectives, so always run the rules.
    this.dispatch([...scene.onEnter, { type: 'setFlag', flag: `entered:${sceneId}`, value: true }]);
    this.publish([{ type: 'SaveRequested', reason: 'scene-change' }]);
  }

  /** Frequent, silent position updates from the world (no events). */
  updatePlayer(x: number, y: number, facing: Direction): void {
    const p = this.state.player;
    if (p.x === x && p.y === y && p.facing === facing) return;
    this.store.setState((s) => ({ ...s, player: { x, y, facing } }));
  }

  logDialogue(entry: DialogueLogEntry): void {
    this.store.setState((s) => ({
      ...s,
      dialogueLog: [...s.dialogueLog, entry].slice(-MAX_DIALOGUE_LOG),
    }));
  }

  markConversationDone(dialogueId: string): void {
    this.store.setState((s) => ({
      ...s,
      conversations: appendUnique(s.conversations, dialogueId),
    }));
    // Completing a conversation can satisfy objectives.
    this.dispatch([{ type: 'setFlag', flag: `talked:${dialogueId}`, value: true }]);
  }

  updatePuzzle(puzzleId: string, update: (prev: PuzzleProgress) => PuzzleProgress): PuzzleProgress {
    const prev: PuzzleProgress = this.state.puzzles[puzzleId] ?? {
      status: 'unsolved',
      attempts: 0,
      hintsUsed: 0,
      solution: null,
    };
    const next = update(prev);
    this.store.setState((s) => ({ ...s, puzzles: { ...s.puzzles, [puzzleId]: next } }));
    return next;
  }

  markJournalSeen(entryId: string): void {
    this.store.setState((s) => markJournalSeen(s, entryId));
  }

  setReflection(text: string): void {
    const trimmed = text.slice(0, MAX_REFLECTION_LENGTH);
    this.store.setState((s) => ({
      ...s,
      reflection: trimmed.trim() ? { text: trimmed, savedAtMs: this.clock.now() } : null,
    }));
  }

  addPlayTime(ms: number): void {
    if (ms <= 0) return;
    this.store.setState((s) => ({ ...s, playTimeMs: s.playTimeMs + ms }));
  }

  requestSave(): void {
    this.publish([{ type: 'SaveRequested', reason: 'manual' }]);
  }

  /** Publish events emitted by application services that belong to this session. */
  publish(events: readonly DomainEvent[]): void {
    this.queue.push(...events);
    if (this.emitting) return;
    this.emitting = true;
    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift() as DomainEvent;
        this.bus.emit(event);
      }
    } finally {
      this.emitting = false;
    }
  }
}

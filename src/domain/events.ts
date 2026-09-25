/**
 * Typed domain events.
 *
 * Every cross-system message is one of these — the event bus is not an
 * untyped dumping ground. Each event has exactly one OWNER (the only module
 * allowed to emit it); `EVENT_OWNERS` records that and a unit test checks
 * it against where the source actually constructs each event.
 *
 * Two families:
 *  - Facts: something happened in the story world (ItemCollected, …).
 *  - Requests: the domain asks the application layer to do something it
 *    cannot do purely (load a scene, open a puzzle UI, play a sound).
 */
export type DomainEvent =
  // ── Facts ────────────────────────────────────────────────────────────
  | { type: 'ChapterStarted'; chapterId: string }
  | { type: 'ChapterCompleted'; chapterId: string }
  | { type: 'SceneEntered'; sceneId: string; spawnId: string | null }
  | { type: 'ItemCollected'; itemId: string; quantity: number; total: number }
  | { type: 'ItemRemoved'; itemId: string; quantity: number; total: number }
  | { type: 'ConversationStarted'; dialogueId: string; characterId: string | null }
  | { type: 'ConversationCompleted'; dialogueId: string }
  | { type: 'QuestStarted'; questId: string }
  | { type: 'QuestObjectiveCompleted'; questId: string; objectiveId: string }
  | { type: 'QuestStageAdvanced'; questId: string; fromStage: string; toStage: string }
  | { type: 'QuestCompleted'; questId: string; outcomeId: string }
  | { type: 'QuestFailed'; questId: string; outcomeId: string }
  | { type: 'ChoiceRecorded'; choiceId: string; optionId: string }
  | { type: 'JournalEntryUnlocked'; entryId: string }
  | { type: 'ClueDiscovered'; clueId: string }
  | { type: 'CharacterMet'; characterId: string }
  | { type: 'TrustChanged'; characterId: string; from: number; to: number }
  | { type: 'FlagChanged'; flag: string; value: boolean | number | string }
  | { type: 'CounterChanged'; counter: string; from: number; to: number }
  | { type: 'PuzzleStarted'; puzzleId: string }
  | { type: 'PuzzleAttempted'; puzzleId: string; correct: boolean; attempt: number }
  | { type: 'PuzzleCompleted'; puzzleId: string; attempts: number; hintsUsed: number }
  | { type: 'HintRequested'; puzzleId: string; tier: number }
  | { type: 'SaveRequested'; reason: SaveReason }
  | { type: 'SaveRestored'; saveId: string; fromSchemaVersion: number }
  // ── Requests to the application layer ────────────────────────────────
  | { type: 'SceneTransitionRequested'; sceneId: string; spawnId: string }
  | { type: 'PuzzleRequested'; puzzleId: string }
  | { type: 'DialogueRequested'; dialogueId: string }
  | { type: 'PanelRequested'; panel: PanelId }
  | { type: 'MessageRequested'; text: string; tone: MessageTone }
  | { type: 'SoundRequested'; sound: string };

export type DomainEventType = DomainEvent['type'];
/** @public Domain-model type (chapter-authoring API). */
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;

export type SaveReason =
  'scene-change' | 'quest-progress' | 'puzzle' | 'chapter-complete' | 'manual';
export type PanelId = 'scripture-connection' | 'reflection' | 'summary' | 'journal' | 'satchel';
export type MessageTone = 'narration' | 'info' | 'warning';

/**
 * Which modules construct each event. Documented in docs/architecture.md and
 * checked against the source by tests/unit/domain/event-owners.test.ts.
 */
export const EVENT_OWNERS: Record<DomainEventType, readonly string[]> = {
  ChapterStarted: ['application/game-controller'],
  ChapterCompleted: ['domain/effects'],
  SceneEntered: ['application/game-session'],
  ItemCollected: ['domain/effects'],
  ItemRemoved: ['domain/effects'],
  ConversationStarted: ['application/dialogue-controller'],
  ConversationCompleted: ['application/dialogue-controller'],
  QuestStarted: ['domain/quests'],
  QuestObjectiveCompleted: ['domain/quests'],
  QuestStageAdvanced: ['domain/quests'],
  QuestCompleted: ['domain/quests'],
  QuestFailed: ['domain/quests'],
  ChoiceRecorded: ['domain/effects'],
  JournalEntryUnlocked: ['domain/effects', 'domain/journal'],
  ClueDiscovered: ['domain/effects'],
  CharacterMet: ['domain/effects'],
  TrustChanged: ['domain/effects'],
  FlagChanged: ['domain/effects'],
  CounterChanged: ['domain/effects'],
  PuzzleStarted: ['application/puzzle-controller'],
  PuzzleAttempted: ['application/puzzle-controller'],
  PuzzleCompleted: ['application/puzzle-controller'],
  HintRequested: ['application/puzzle-controller'],
  SaveRequested: [
    'application/game-session',
    'application/puzzle-controller',
    'domain/effects',
    'domain/quests',
  ],
  SaveRestored: ['application/game-controller'],
  SceneTransitionRequested: ['domain/effects'],
  PuzzleRequested: ['domain/effects'],
  DialogueRequested: ['domain/effects'],
  PanelRequested: ['domain/effects'],
  MessageRequested: ['domain/effects'],
  SoundRequested: ['domain/effects'],
};

export const ALL_EVENT_TYPES = Object.keys(EVENT_OWNERS) as DomainEventType[];

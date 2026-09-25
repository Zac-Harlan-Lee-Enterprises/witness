import type { Chapter, ChapterMeta } from '@/domain/chapter';
import type { PlayerProfile } from '@/domain/profile';
import type { SaveGame } from '@/domain/save';
import type { ScriptureRef, Translation } from '@/domain/scripture';
import type { GameSettings } from '@/domain/settings';
import type { GuideAnswer } from '@/domain/guide-policy';
import type { Direction } from '@/domain/state/game-state';
import type { Entity, Exit, TileGrid } from '@/domain/world';
import type { Appearance } from '@/domain/characters';

/**
 * Ports: the interfaces the application layer depends on. Infrastructure and
 * the Phaser adapter implement them; tests substitute in-memory fakes.
 * (Dependency inversion — application code never imports IndexedDB, Phaser,
 * WebAudio or a network client.)
 */

// ── Persistence ────────────────────────────────────────────────────────────
export interface SaveRepository {
  /** Raw records; validation + migration happen in SaveService. */
  listRaw(profileId: string): Promise<unknown[]>;
  getRaw(id: string): Promise<unknown | null>;
  put(save: SaveGame): Promise<void>;
  delete(id: string): Promise<void>;
  deleteForProfile(profileId: string): Promise<void>;
}

export interface ProfileRepository {
  listRaw(): Promise<unknown[]>;
  put(profile: PlayerProfile): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  loadRaw(): Promise<unknown | null>;
  save(settings: GameSettings): Promise<void>;
}

export interface StorageStatus {
  persistent: boolean;
  /** Human-readable reason when not persistent. */
  reason: string | null;
}

// ── Content ────────────────────────────────────────────────────────────────
export interface ChapterSource {
  list(): ChapterMeta[];
  /** Lazily loads, schema-validates and integrity-checks a chapter. */
  load(id: string): Promise<Chapter>;
}

export interface PassageText {
  status: 'placeholder' | 'text';
  text: string;
  translation: Translation | null;
}

export interface ScriptureTextProvider {
  getPassage(ref: ScriptureRef): PassageText;
  translations(): readonly Translation[];
}

// ── World (implemented by the Phaser adapter) ───────────────────────────────
export interface WorldEntityView {
  id: string;
  kind: Entity['kind'];
  label: string;
  x: number;
  y: number;
  facing: Direction;
  solid: boolean;
  appearance: Appearance | null;
  sprite: string | null;
  interactive: boolean;
}

export interface WorldSceneModel {
  sceneId: string;
  name: string;
  kind: 'indoor' | 'outdoor';
  grid: TileGrid;
  baseTile: TileGrid['tiles'][number][number];
  entities: WorldEntityView[];
  exits: Array<Pick<Exit, 'id' | 'label' | 'x' | 'y' | 'w' | 'h'>>;
  player: { x: number; y: number; facing: Direction; appearance: Appearance };
}

export type WorldEvent =
  | { type: 'interact'; entityId: string }
  | { type: 'exitReached'; exitId: string }
  | { type: 'tileEntered'; x: number; y: number }
  | { type: 'focusChanged'; entityId: string | null }
  | { type: 'playerMoved'; x: number; y: number; facing: Direction }
  | { type: 'arrived'; targetId: string }
  | { type: 'sceneReady'; sceneId: string };

export interface WorldPort {
  loadScene(model: WorldSceneModel): Promise<void>;
  updateEntities(entities: WorldEntityView[]): void;
  /** Walk (or jump, if instant) to a target entity/exit id, then report `arrived`. */
  travelTo(targetId: string, instant: boolean): void;
  setControlsEnabled(enabled: boolean): void;
  setMotion(options: { reducedMotion: boolean; tilesPerSecond: number }): void;
  destroy(): void;
}

export type WorldListener = (event: WorldEvent) => void;

// ── Audio ──────────────────────────────────────────────────────────────────
export type AmbienceId = 'market' | 'wind' | 'indoor' | 'oasis' | 'none';
export type MusicId = 'home' | 'journey' | 'tension' | 'reflection' | 'none';
export type SfxId =
  'interact' | 'item' | 'journal' | 'quest' | 'solved' | 'error' | 'page' | 'door';

export interface AudioPort {
  /** Must be called from a user gesture to satisfy autoplay policies. */
  unlock(): Promise<boolean>;
  playSfx(id: SfxId): void;
  setAmbience(id: AmbienceId): void;
  setMusic(id: MusicId): void;
  applySettings(settings: GameSettings): void;
  dispose(): void;
}

// ── Analytics (anonymous, optional) ────────────────────────────────────────
export type AnalyticsEvent =
  | { name: 'ChapterStarted'; props: { chapterId: string } }
  | { name: 'ChapterCompleted'; props: { chapterId: string; minutesBucket: string } }
  | { name: 'PuzzleAttempted'; props: { puzzleId: string; attempt: number } }
  | { name: 'PuzzleCompleted'; props: { puzzleId: string; attempts: number; hintsUsed: number } }
  | { name: 'HintRequested'; props: { puzzleId: string; tier: number } }
  | { name: 'AccessibilityFeatureEnabled'; props: { feature: string } }
  | { name: 'SaveRestored'; props: { fromSchemaVersion: number } }
  | { name: 'OptionalQuestCompleted'; props: { questId: string } };

export interface AnalyticsProvider {
  readonly name: string;
  track(event: AnalyticsEvent): void;
}

// ── Future extension points (interfaces only; see docs/future-aws.md) ──────
export interface SyncProvider {
  readonly enabled: boolean;
  push(saves: readonly SaveGame[]): Promise<void>;
  pull(profileId: string): Promise<SaveGame[]>;
}

export interface AuthProvider {
  readonly mode: 'local-only' | 'cloud';
  currentUserId(): Promise<string | null>;
}

export interface StudyGuide {
  readonly available: boolean;
  ask(
    question: string,
    context: { chapterId: string; approvedSourceIds: readonly string[] },
  ): Promise<GuideAnswer>;
}

// ── Misc ───────────────────────────────────────────────────────────────────
export interface Clock {
  now(): number;
}

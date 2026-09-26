import type { Chapter, ChapterMeta } from '@/domain/chapter';
import type { PlayerProfile } from '@/domain/profile';
import type { SaveGame } from '@/domain/save';
import type { ScriptureRef, Translation } from '@/domain/scripture';
import type { GameSettings } from '@/domain/settings';
import type { GuideAnswer } from '@/domain/guide-policy';
import type { Direction } from '@/domain/state/game-state';
import type { Entity, Exit, LookMark, Scene, TileGrid } from '@/domain/world';
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
  /** What interacting does (shown as a small symbol over the focused thing). */
  verb: NonNullable<Entity['interaction']>['verb'] | null;
  /** Pose and facing after the entity's looks are applied. */
  pose: Entity['pose'];
  /** Visible marks of what has happened (bandages, a borrowed cloak…). */
  marks: LookMark[];
}

/** Art direction of a place: palette, materials, light and ambient life. */
export type SceneMood = NonNullable<Scene['mood']>;

export interface WorldLighting {
  /** Story clock hour (null when the chapter has no clock). */
  hour: number | null;
  /** The player carries the chapter's light source. */
  lamp: boolean;
}

export interface WorldSceneModel {
  sceneId: string;
  name: string;
  kind: 'indoor' | 'outdoor';
  ambience: 'market' | 'wind' | 'indoor' | 'oasis' | 'none';
  mood: SceneMood;
  lighting: WorldLighting;
  grid: TileGrid;
  baseTile: TileGrid['tiles'][number][number];
  entities: WorldEntityView[];
  exits: Array<Pick<Exit, 'id' | 'label' | 'x' | 'y' | 'w' | 'h'>>;
  player: {
    x: number;
    y: number;
    facing: Direction;
    appearance: Appearance;
    /** What the player visibly carries or has given away. */
    marks: LookMark[];
  };
}

export type WorldEvent =
  | { type: 'exitReached'; exitId: string }
  | { type: 'tileEntered'; x: number; y: number }
  | { type: 'focusChanged'; entityId: string | null }
  | { type: 'playerMoved'; x: number; y: number; facing: Direction }
  | { type: 'arrived'; targetId: string }
  | { type: 'unreachable'; targetId: string }
  | { type: 'sceneReady'; sceneId: string }
  /** The player's foot touched the ground on this tile (for footstep sounds). */
  | { type: 'footstep'; x: number; y: number };

export interface WorldPort {
  loadScene(model: WorldSceneModel): Promise<void>;
  updateEntities(entities: WorldEntityView[]): void;
  /** Redraw the player when what they visibly carry changes. */
  setPlayerMarks(marks: LookMark[]): void;
  /** Walk (or jump, if instant) to a target entity/exit id, then report `arrived`. */
  travelTo(targetId: string, instant: boolean): void;
  setControlsEnabled(enabled: boolean): void;
  setMotion(options: { reducedMotion: boolean; tilesPerSecond: number }): void;
  /** Time-of-day colour grade and lamp glow. */
  setLighting(lighting: WorldLighting): void;
  /**
   * Stage a conversation: who it is with (framed by the camera) and who is
   * speaking now (animated). `null` when no conversation is open.
   */
  setConversation(conversation: WorldConversation | null): void;
  /** A brief, decorative flourish for something that just happened (never the only feedback). */
  emphasize(emphasis: WorldEmphasis): void;
  destroy(): void;
}

export interface WorldConversation {
  /** Entity id of the person you're talking with, if they are in this scene. */
  with: string | null;
  /** Entity id of whoever is speaking now, `'player'`, or null for narration. */
  speaking: string | null;
}

export interface WorldEmphasis {
  kind: 'clue' | 'item' | 'solved' | 'objective';
  /** Where it happened (an entity id); otherwise at the player. */
  at: string | null;
}

export type WorldListener = (event: WorldEvent) => void;

// ── Audio ──────────────────────────────────────────────────────────────────
export type AmbienceId = 'market' | 'wind' | 'indoor' | 'oasis' | 'none';
export type MusicId = 'home' | 'journey' | 'tension' | 'reflection' | 'none';
export type SfxId =
  'interact' | 'item' | 'journal' | 'discover' | 'quest' | 'solved' | 'error' | 'page' | 'door';

/** What a footstep sounds like: the surface underfoot. */
export type FootstepSurface = 'stone' | 'gravel' | 'sand' | 'earth' | 'grass' | 'mud' | 'mat';

export interface AudioPort {
  /** Must be called from a user gesture to satisfy autoplay policies. */
  unlock(): Promise<boolean>;
  playSfx(id: SfxId): void;
  playFootstep(surface: FootstepSurface): void;
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

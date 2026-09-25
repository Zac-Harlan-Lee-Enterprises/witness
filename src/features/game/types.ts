import type { DialogueController } from '@/application/dialogue-controller';
import type { GameController } from '@/application/game-controller';
import type { GameSession } from '@/application/game-session';
import type { PuzzleController } from '@/application/puzzle-controller';
import type { UiStore } from '@/application/ui-store';
import type { Chapter } from '@/domain/chapter';
import type { PlayerProfile } from '@/domain/profile';
import type { SaveSlot } from '@/domain/save';

/** What the game UI needs from a running chapter (implemented by app/GameRuntime). */
export interface GameRuntimeLike {
  chapter: Chapter;
  profile: PlayerProfile;
  session: GameSession;
  ui: UiStore;
  dialogue: DialogueController;
  puzzles: PuzzleController;
  controller: GameController;
  autosaver: { flush(): void };
  mountWorld(parent: HTMLElement): Promise<void>;
  saveTo(slot: SaveSlot): Promise<boolean>;
}

import { createInitialState, type GameState } from '@/domain/state/game-state';

/** Deterministic GameState fixture builder for unit tests. */
export function makeState(patch: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState({
      chapterId: 'test',
      sceneId: 'scene-a',
      spawn: { x: 1, y: 1, facing: 'down' },
    }),
    ...patch,
  };
}

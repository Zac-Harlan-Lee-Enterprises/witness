import { evaluate } from './conditions';
import type { GameState } from './state/game-state';
import type { Scene, Weather } from './world';

/**
 * The weather in a scene right now: its base weather, replaced by every
 * change whose condition holds (the last one wins). Pure, so a storm that
 * rises and calms with the story is testable without a renderer.
 */
export function weatherOf(
  scene: Pick<Scene, 'weather' | 'weatherChanges'>,
  state: GameState,
): Weather {
  let weather = scene.weather;
  for (const change of scene.weatherChanges)
    if (evaluate(change.when, state)) weather = change.weather;
  return weather;
}

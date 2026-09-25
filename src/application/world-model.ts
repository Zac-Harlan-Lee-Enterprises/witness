import type { Chapter } from '@/domain/chapter';
import type { Appearance } from '@/domain/characters';
import { evaluate } from '@/domain/conditions';
import type { GameState } from '@/domain/state/game-state';
import { parseLayout, type Entity, type Scene } from '@/domain/world';
import type { WorldEntityView, WorldSceneModel } from './ports';

/**
 * Translates content + state into the render model the world adapter draws.
 * The adapter never evaluates conditions itself — it just shows what it is
 * given — so all visibility rules stay testable here.
 */
export const VERB_LABELS: Record<NonNullable<Entity['interaction']>['verb'], string> = {
  talk: 'Talk to',
  examine: 'Examine',
  read: 'Read',
  open: 'Open',
  take: 'Take',
  use: 'Use',
  enter: 'Enter',
};

export function findScene(chapter: Chapter, sceneId: string): Scene {
  const scene = chapter.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`Unknown scene '${sceneId}'`);
  return scene;
}

export function visibleEntities(
  chapter: Chapter,
  scene: Scene,
  state: GameState,
): WorldEntityView[] {
  return scene.entities
    .filter((e) => evaluate(e.visibleWhen, state))
    .map((e) => {
      const character = e.characterId
        ? chapter.characters.find((c) => c.id === e.characterId)
        : undefined;
      return {
        id: e.id,
        kind: e.kind,
        label: e.label,
        x: e.x,
        y: e.y,
        facing: e.facing,
        solid: e.solid,
        appearance: character?.appearance ?? null,
        sprite: e.sprite ?? null,
        interactive: e.interaction !== undefined,
      };
    });
}

export function buildSceneModel(
  chapter: Chapter,
  state: GameState,
  playerAppearance: Appearance,
): WorldSceneModel {
  const scene = findScene(chapter, state.sceneId);
  return {
    sceneId: scene.id,
    name: scene.name,
    kind: scene.kind,
    grid: parseLayout(scene),
    baseTile: scene.baseTile,
    entities: visibleEntities(chapter, scene, state),
    exits: scene.exits.map(({ id, label, x, y, w, h }) => ({ id, label, x, y, w, h })),
    player: { ...state.player, appearance: playerAppearance },
  };
}

export interface Destination {
  id: string;
  label: string;
  action: string;
  kind: 'entity' | 'exit';
}

/** The accessible "Go to…" list: every interactive thing and exit in the scene. */
export function destinations(chapter: Chapter, state: GameState): Destination[] {
  const scene = findScene(chapter, state.sceneId);
  const entities: Destination[] = visibleEntities(chapter, scene, state)
    .filter((e) => e.interactive)
    .map((e) => {
      const def = scene.entities.find((x) => x.id === e.id);
      const verb = def?.interaction?.verb ?? 'examine';
      return {
        id: e.id,
        label: e.label,
        action: `${VERB_LABELS[verb]} ${e.label}`,
        kind: 'entity' as const,
      };
    });
  const exits: Destination[] = scene.exits.map((x) => ({
    id: x.id,
    label: x.label,
    action: `Go to ${x.label}`,
    kind: 'exit' as const,
  }));
  return [...entities, ...exits];
}

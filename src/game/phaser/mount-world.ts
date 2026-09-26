import Phaser from 'phaser';
import type { VirtualInput } from '@/application/input';
import type { WorldListener, WorldPort } from '@/application/ports';
import type { Weather } from '@/domain/world';
import type { Logger } from '@/shared/logger';
import { WorldScene } from '../scenes/world-scene';
import type { Framing } from '../systems/camera';
import { Viewport } from './viewport';

/**
 * The Phaser adapter. This module (and everything under src/game) is loaded
 * lazily with `import()` when a chapter starts, so the ~1 MB engine is not in
 * the initial bundle. It returns a WorldPort — the only surface the rest of
 * the app sees — plus display settings only the composition root sets.
 */
export interface MountWorldOptions {
  parent: HTMLElement;
  input: VirtualInput;
  onEvent: WorldListener;
  logger: Logger;
  /** Camera framing where the art allows it (default "close"; painted places stay standard). */
  framing?: Framing;
  /** Force a lighting variant for pre-rendered places (review builds). */
  artLighting?: 'auto' | 'day' | 'late' | 'dusk' | 'night';
  /** Force the weather everywhere, whatever the story says (review builds). */
  forceWeather?: Weather | null;
  /** The player's high-contrast setting: keep the world bright and clear. */
  highContrast?: boolean;
  /** The player asked for simpler visual effects. */
  simpleEffects?: boolean;
}

/** Display settings the world follows (from the player's settings). */
export interface WorldDisplay {
  highContrast: boolean;
  simpleEffects: boolean;
}

/** The world as the composition root sees it: the port, and display settings. */
export interface WorldHandle extends WorldPort {
  /** The player's display settings changed (optional: test doubles may leave it out). */
  setDisplay?(options: WorldDisplay): void;
}

export function mountWorld(options: MountWorldOptions): Promise<WorldHandle> {
  return new Promise((resolve, reject) => {
    let game: Phaser.Game | null = null;
    const viewport = new Viewport(options.parent);
    const size = viewport.initial();
    const scene = new WorldScene({
      input: options.input,
      onEvent: options.onEvent,
      logger: options.logger,
      framing: options.framing ?? 'close',
      artLighting: options.artLighting ?? 'auto',
      forceWeather: options.forceWeather ?? null,
      highContrast: options.highContrast ?? false,
      simpleEffects: options.simpleEffects ?? false,
      viewport,
      onReady: () => {
        const canvas = game?.canvas;
        if (canvas) {
          // The canvas is decorative for assistive tech: every piece of
          // information and every control is also available as HTML.
          canvas.setAttribute('aria-hidden', 'true');
          canvas.setAttribute('tabindex', '-1');
        }
        if (game) viewport.attach(game);
        resolve(
          createPort(scene, () => {
            viewport.destroy();
            game?.destroy(true);
          }),
        );
      },
    });
    try {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: options.parent,
        backgroundColor: '#2a2018',
        // Sized by Viewport: device pixels, shown at CSS size.
        scale: { mode: Phaser.Scale.NONE, width: size.width, height: size.height, zoom: size.zoom },
        // The world uses its own post-processing; Phaser's built-in FX would
        // allocate dozens of screen-sized render targets it never uses.
        disablePreFX: true,
        disablePostFX: true,
        render: { antialias: true, roundPixels: true, powerPreference: 'low-power' },
        input: { keyboard: false, gamepad: false, touch: true, mouse: true },
        audio: { noAudio: true },
        banner: false,
        fps: { target: 60, smoothStep: true },
        scene: [scene],
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function createPort(scene: WorldScene, destroy: () => void): WorldHandle {
  return {
    loadScene: async (model) => {
      await scene.prepare(model);
      scene.buildScene(model);
    },
    updateEntities: (entities) => scene.updateEntities(entities),
    setPlayerMarks: (marks) => scene.setPlayerMarks(marks),
    setWeather: (weather) => scene.setWeather(weather),
    travelTo: (targetId, instant) => scene.travelTo(targetId, instant),
    setControlsEnabled: (enabled) => scene.setControlsEnabled(enabled),
    setMotion: (options) => scene.setMotion(options),
    setLighting: (lighting) => scene.setLighting(lighting),
    setConversation: (conversation) => scene.setConversation(conversation),
    emphasize: (emphasis) => scene.emphasize(emphasis),
    setDisplay: (options) => scene.setDisplay(options),
    destroy,
  };
}

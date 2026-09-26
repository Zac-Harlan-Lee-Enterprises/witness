import Phaser from 'phaser';
import type { VirtualInput } from '@/application/input';
import type { WorldListener, WorldPort } from '@/application/ports';
import type { Logger } from '@/shared/logger';
import { WorldScene } from '../scenes/world-scene';
import type { Framing } from '../systems/camera';

/**
 * The Phaser adapter. This module (and everything under src/game) is loaded
 * lazily with `import()` when a chapter starts, so the ~1 MB engine is not in
 * the initial bundle. It returns a WorldPort — the only surface the rest of
 * the app sees.
 */
export interface MountWorldOptions {
  parent: HTMLElement;
  input: VirtualInput;
  onEvent: WorldListener;
  logger: Logger;
  /** Camera framing where the art allows it (default "close"; painted places stay standard). */
  framing?: Framing;
  /** Force a lighting variant for pre-rendered places (review builds). */
  artLighting?: 'auto' | 'day' | 'late';
}

export function mountWorld(options: MountWorldOptions): Promise<WorldPort> {
  return new Promise((resolve, reject) => {
    let game: Phaser.Game | null = null;
    const scene = new WorldScene({
      input: options.input,
      onEvent: options.onEvent,
      logger: options.logger,
      framing: options.framing ?? 'close',
      artLighting: options.artLighting ?? 'auto',
      onReady: () => {
        const canvas = game?.canvas;
        if (canvas) {
          // The canvas is decorative for assistive tech: every piece of
          // information and every control is also available as HTML.
          canvas.setAttribute('aria-hidden', 'true');
          canvas.setAttribute('tabindex', '-1');
        }
        resolve(createPort(scene, () => game?.destroy(true)));
      },
    });
    try {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: options.parent,
        backgroundColor: '#2a2018',
        scale: {
          mode: Phaser.Scale.RESIZE,
          width: options.parent.clientWidth || 800,
          height: options.parent.clientHeight || 600,
        },
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

function createPort(scene: WorldScene, destroy: () => void): WorldPort {
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
    destroy,
  };
}

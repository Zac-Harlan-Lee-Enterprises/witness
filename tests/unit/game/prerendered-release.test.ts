import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { beginPlace, endPlace } from '@/game/prerendered/loader';

/** Just enough of a Phaser scene for the loader's texture release. */
function fakeScene(keys: string[]) {
  const textures = new Set(keys);
  const handlers = new Map<string, Array<() => void>>();
  const on = (event: string, fn: () => void) =>
    handlers.set(event, [...(handlers.get(event) ?? []), fn]);
  const scene = {
    textures: {
      getTextureKeys: () => [...textures],
      exists: (k: string) => textures.has(k),
      remove: (k: string) => textures.delete(k),
      get: () => ({ source: [] }),
    },
    children: { list: [] as unknown[] },
    events: { on, once: on },
    game: { canvas: { dataset: {} as Record<string, string> } },
  };
  const emit = (event: string) => (handlers.get(event) ?? []).forEach((fn) => fn());
  return { scene: scene as unknown as Phaser.Scene, textures, emit };
}

describe('releasing the last place’s art', () => {
  it('waits until the next place has loaded, then frees what nothing uses', () => {
    const { scene, textures, emit } = fakeScene(['art:market/ground', 'person:miriam-day.webp']);
    beginPlace(scene);
    // Frames go by while the new place is still loading: nothing is released yet,
    // so a sheet the new place is about to keep is not dropped and fetched again.
    emit('postupdate');
    expect(textures.has('person:miriam-day.webp')).toBe(true);
    endPlace();
    emit('postupdate');
    expect([...textures]).toEqual([]);
    emit('destroy');
  });
});

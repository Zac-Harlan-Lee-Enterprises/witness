import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GameRuntime, type WorldLoader } from '@/app/game-runtime';
import type { WorldPort } from '@/application/ports';
import { GameViewport } from '@/features/game/GameViewport';
import type { GameRuntimeLike } from '@/features/game/types';
import { FakeWorld, flush, loadJericho } from '../support/harness';
import { makeServices, makeRuntime, TEST_PROFILE } from './helpers';

/**
 * Regression tests for the "two canvases" bug: in development React mounts,
 * unmounts and re-mounts components (StrictMode). The first world must be
 * torn down, or a frozen duplicate canvas covers the live one — the player
 * appears unable to walk and scene changes never show.
 */
function fakeLoader() {
  const worlds: Array<FakeWorld & { destroyed: boolean }> = [];
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loader: WorldLoader = async () => {
    await gate; // simulate the lazy Phaser download taking a while
    return async () => {
      const world = Object.assign(new FakeWorld(), { destroyed: false });
      world.destroy = () => {
        world.destroyed = true;
      };
      worlds.push(world);
      return world as WorldPort;
    };
  };
  return { loader, worlds, finishLoading: () => release?.() };
}

describe('GameRuntime world mounting', () => {
  it('keeps exactly one live world when mounted, released and re-mounted before loading finishes', async () => {
    const services = await makeServices();
    const runtime = new GameRuntime(services, loadJericho(), TEST_PROFILE, null, () => undefined);
    const el = document.createElement('div');
    const { loader, worlds, finishLoading } = fakeLoader();

    const first = runtime.mountWorld(el, loader);
    runtime.releaseWorld(); // StrictMode cleanup
    const second = runtime.mountWorld(el, loader);
    finishLoading();
    await Promise.all([first, second]);

    const live = worlds.filter((w) => !w.destroyed);
    expect(live).toHaveLength(1);
    expect(live[0]?.currentScene).toBe('miriam-house');

    runtime.releaseWorld();
    expect(worlds.every((w) => w.destroyed)).toBe(true);
    runtime.dispose();
  });

  it('destroys a world that finishes booting after its mount was cancelled', async () => {
    const services = await makeServices();
    const runtime = new GameRuntime(services, loadJericho(), TEST_PROFILE, null, () => undefined);
    const destroyed = vi.fn();
    let bootWorld: ((w: WorldPort) => void) | null = null;
    const loader: WorldLoader = async () => () =>
      new Promise<WorldPort>((resolve) => {
        bootWorld = resolve;
      });
    const mounting = runtime.mountWorld(document.createElement('div'), loader);
    await flush();
    runtime.releaseWorld();
    const world = Object.assign(new FakeWorld(), { destroy: destroyed });
    (bootWorld as unknown as (w: WorldPort) => void)(world);
    await mounting;
    expect(destroyed).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });
});

describe('GameViewport', () => {
  it('releases the world on unmount, so StrictMode never leaves a duplicate', async () => {
    const { runtime } = await makeRuntime();
    const releaseWorld = vi.fn();
    const mountWorld = vi.fn(async () => undefined);
    const stub: GameRuntimeLike = { ...runtime, mountWorld, releaseWorld };
    const { unmount } = render(
      <StrictMode>
        <GameViewport runtime={stub} />
      </StrictMode>,
    );
    await waitFor(() => expect(mountWorld).toHaveBeenCalledTimes(2));
    expect(releaseWorld).toHaveBeenCalledTimes(1); // between the two StrictMode mounts
    unmount();
    expect(releaseWorld).toHaveBeenCalledTimes(2);
  });
});

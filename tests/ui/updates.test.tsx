import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Hud } from '@/features/hud/Hud';
import { PauseMenu } from '@/features/pause/PauseMenu';
import { expectNoAxeViolations, makeRuntime, makeServices, renderWithServices } from './helpers';

/**
 * A new version found while playing waits in the pause menu (ADR-0006): the
 * swap is the player's choice, after an autosave, never mid-conversation.
 * Before this, the offer was only on the title screen, so a player who went
 * straight back into their game kept an old version indefinitely.
 */
async function setup({ ready, worker = true }: { ready: boolean; worker?: boolean }) {
  const services = await makeServices();
  if (ready) services.notices.setState((n) => ({ ...n, updateAvailable: true }));
  const order: string[] = [];
  const applyUpdate = vi.fn(async () => {
    order.push('update');
  });
  const { runtime: base } = await makeRuntime();
  const runtime = {
    ...base,
    saveTo: vi.fn(async (slot: string) => {
      order.push(`save:${slot}`);
      return true;
    }),
  };
  return {
    services: { ...services, applyUpdate: worker ? applyUpdate : null },
    runtime,
    applyUpdate,
    order,
  };
}

describe('updating from inside a chapter', () => {
  it('the pause menu offers the new version, and saves before it updates', async () => {
    const { services, runtime, applyUpdate, order } = await setup({ ready: true });
    const { container } = await renderWithServices(
      <PauseMenu runtime={runtime} onSettings={() => undefined} onQuit={() => undefined} />,
      services,
    );
    expect(screen.getByText(/A new version of the game is ready/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save and update' }));
    await waitFor(() => expect(applyUpdate).toHaveBeenCalledOnce());
    expect(order).toEqual(['save:auto', 'update']);
    await expectNoAxeViolations(container);
  });

  it('offers nothing when no new version is waiting, or there is no service worker', async () => {
    for (const s of [await setup({ ready: false }), await setup({ ready: true, worker: false })]) {
      const { unmount } = await renderWithServices(
        <PauseMenu runtime={s.runtime} onSettings={() => undefined} onQuit={() => undefined} />,
        s.services,
      );
      expect(screen.queryByRole('button', { name: 'Save and update' })).toBeNull();
      unmount();
    }
  });

  it('the HUD’s Menu button says a new version is ready', async () => {
    const waiting = await setup({ ready: true });
    const first = await renderWithServices(<Hud runtime={waiting.runtime} />, waiting.services);
    expect(screen.getByRole('button', { name: /^Menu, a new version is ready/ })).toBeTruthy();
    first.unmount();
    const idle = await setup({ ready: false });
    await renderWithServices(<Hud runtime={idle.runtime} />, idle.services);
    expect(screen.queryByRole('button', { name: /a new version is ready/ })).toBeNull();
  });
});

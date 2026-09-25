import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VirtualInput } from '@/application/input';
import { DialogueOverlay } from '@/features/dialogue/DialogueOverlay';
import { attachGamepadNavigation } from '@/infrastructure/input/gamepad-navigation';
import { attachGamepad } from '@/infrastructure/input/gamepad-source';
import { makeRuntime, makeServices, renderWithServices } from './helpers';

/** Tap a gamepad action (press + release), as the poller would. */
function tap(input: VirtualInput, action: Parameters<VirtualInput['press']>[1]): void {
  act(() => {
    input.press('gamepad', action);
    input.release('gamepad', action);
  });
}

function menu(): { onA: ReturnType<typeof vi.fn>; onEscape: ReturnType<typeof vi.fn> } {
  const onA = vi.fn();
  const onEscape = vi.fn();
  document.body.innerHTML = `
    <main>
      <button id="behind">Behind</button>
      <div role="dialog" aria-label="Menu">
        <button id="one">One</button>
        <button id="two">Two</button>
        <select id="speed"><option>slow</option><option>normal</option><option>fast</option></select>
      </div>
    </main>`;
  document.getElementById('two')?.addEventListener('click', onA);
  document
    .querySelector('[role="dialog"]')
    ?.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && onEscape());
  return { onA, onEscape };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('gamepad navigation of menus', () => {
  it('moves focus within the top-most dialog, presses with A, goes back with B', () => {
    const input = new VirtualInput();
    const { onA, onEscape } = menu();
    const detach = attachGamepadNavigation(
      input,
      () => false,
      () => false,
    );
    tap(input, 'down');
    expect(document.activeElement?.id).toBe('one');
    tap(input, 'down');
    expect(document.activeElement?.id).toBe('two');
    tap(input, 'interact');
    expect(onA).toHaveBeenCalledTimes(1);
    tap(input, 'up');
    tap(input, 'up');
    expect(document.activeElement?.id).toBe('speed'); // wraps around, never leaves the dialog
    tap(input, 'pause');
    expect(onEscape).toHaveBeenCalledTimes(1);
    detach();
  });

  it('steps a select with left/right', () => {
    const input = new VirtualInput();
    menu();
    const detach = attachGamepadNavigation(
      input,
      () => false,
      () => false,
    );
    const select = document.getElementById('speed') as HTMLSelectElement;
    const changed = vi.fn();
    select.addEventListener('change', changed);
    select.focus();
    tap(input, 'right');
    expect(select.value).toBe('normal');
    expect(changed).toHaveBeenCalled();
    detach();
  });

  it('ignores the keyboard (native keys already work) and stays out of the way while exploring', () => {
    const input = new VirtualInput();
    const { onA } = menu();
    let exploring = true;
    const detach = attachGamepadNavigation(
      input,
      () => exploring,
      () => true,
    );
    document.getElementById('two')?.focus();
    tap(input, 'interact');
    expect(onA).not.toHaveBeenCalled();
    exploring = false;
    act(() => {
      input.press('keyboard', 'interact');
      input.release('keyboard', 'interact');
    });
    expect(onA).not.toHaveBeenCalled();
    tap(input, 'interact');
    expect(onA).toHaveBeenCalledTimes(1);
    detach();
  });

  it('in the game, never clicks page buttons when no dialog is open', () => {
    const input = new VirtualInput();
    document.body.innerHTML = '<button id="hud">Journal</button>';
    const onClick = vi.fn();
    document.getElementById('hud')?.addEventListener('click', onClick);
    document.getElementById('hud')?.focus();
    const detach = attachGamepadNavigation(
      input,
      () => false,
      () => true,
    );
    tap(input, 'interact');
    expect(onClick).not.toHaveBeenCalled();
    detach();
  });

  it('advances a real conversation with the A button', async () => {
    const { runtime } = await makeRuntime();
    const services = await makeServices();
    await services.settings.update({ dialogueSpeed: 'instant' });
    await renderWithServices(<DialogueOverlay runtime={runtime} />, services);
    expect(screen.getByRole('dialog', { name: 'Narration' })).toBeInTheDocument();
    const detach = attachGamepadNavigation(
      services.input,
      () => false,
      () => true,
    );
    tap(services.input, 'interact');
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Aunt Miriam/ })).toBeInTheDocument(),
    );
    detach();
  });
});

describe('gamepad buttons', () => {
  it('maps A, B, Start and LB to actions, from the gamepad source', () => {
    const input = new VirtualInput();
    const seen: Array<[string, string]> = [];
    input.onAction((action, source) => seen.push([action, source]));
    const pressed = new Set<number>();
    const pad = {
      connected: true,
      axes: [0, 0],
      get buttons() {
        return Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.has(i) }));
      },
    };
    let frame: FrameRequestCallback | null = null;
    const win = {
      navigator: { getGamepads: () => [pad] },
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        frame = cb;
        return 1;
      },
      cancelAnimationFrame: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as Window;
    const detach = attachGamepad(input, win);
    const step = (buttons: number[]): void => {
      pressed.clear();
      buttons.forEach((b) => pressed.add(b));
      const run = frame;
      frame = null;
      run?.(0);
    };
    step([0]);
    step([]);
    step([1]);
    step([]);
    step([4]);
    step([]);
    expect(seen).toEqual([
      ['interact', 'gamepad'],
      ['pause', 'gamepad'],
      ['goto', 'gamepad'],
    ]);
    detach();
  });
});

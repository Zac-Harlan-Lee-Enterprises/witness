import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TouchControls } from '@/features/hud/Hud';
import { STICK_RADIUS } from '@/features/hud/Joystick';
import { expectNoAxeViolations, makeRuntime, makeServices, renderWithServices } from './helpers';

async function touchServices() {
  const services = await makeServices();
  await services.settings.update({ touchControls: 'on' });
  return services;
}

const at = (x: number, y: number, pointerId = 1) => ({
  pointerId,
  pointerType: 'touch',
  button: 0,
  clientX: x,
  clientY: y,
  isPrimary: pointerId === 1,
});

function stick(): HTMLElement {
  const zone = document.querySelector('.joystick');
  if (!(zone instanceof HTMLElement)) throw new Error('no joystick zone');
  return zone;
}

describe('Touch controls: the floating stick', () => {
  it('appears under the thumb, steers by its tilt and lets go', async () => {
    const { runtime } = await makeRuntime();
    const { services, container } = await renderWithServices(
      <TouchControls runtime={runtime} />,
      await touchServices(),
    );
    expect(screen.getByRole('group', { name: 'Touch controls' })).toBeInTheDocument();
    const zone = stick();
    expect(zone.dataset.active).toBe('false');
    expect(container.querySelector('.joystick__rest')).not.toBeNull();

    act(() => {
      fireEvent.pointerDown(zone, at(200, 300));
    });
    expect(zone.dataset.active).toBe('true');
    expect(container.querySelector('.joystick__rest')).toBeNull();
    expect(services.input.direction()).toEqual({ dx: 0, dy: 0 });

    // Halfway to the rim: half pace, to the right.
    act(() => {
      fireEvent.pointerMove(zone, at(200 + 10 + (STICK_RADIUS - 10) / 2, 300));
    });
    expect(services.input.direction().dx).toBeCloseTo(0.5);
    expect(services.input.direction().dy).toBe(0);

    // Straight up past the rim: full pace, and the base follows.
    act(() => {
      fireEvent.pointerMove(zone, at(200, 300 - STICK_RADIUS - 40));
    });
    const up = services.input.direction();
    expect(Math.hypot(up.dx, up.dy)).toBeCloseTo(1);
    expect(up.dy).toBeLessThan(0);
    const base = container.querySelector<HTMLElement>('.joystick__base');
    expect(base?.style.top).toBe(`${300 - 40}px`);

    act(() => {
      fireEvent.pointerUp(zone, at(200, 300 - STICK_RADIUS - 40));
    });
    expect(services.input.direction()).toEqual({ dx: 0, dy: 0 });
    expect(zone.dataset.active).toBe('false');
    await expectNoAxeViolations(container);
  });

  it('a tap that never steers walks to the spot; a drag does not', async () => {
    const { runtime } = await makeRuntime();
    const pointAt = vi.spyOn(runtime.controller, 'pointAt').mockImplementation(() => undefined);
    const { services } = await renderWithServices(
      <TouchControls runtime={runtime} />,
      await touchServices(),
    );
    const zone = stick();
    act(() => {
      fireEvent.pointerDown(zone, at(120, 240));
      fireEvent.pointerMove(zone, at(124, 243));
      fireEvent.pointerUp(zone, at(124, 243));
    });
    expect(pointAt).toHaveBeenCalledWith(124, 243);
    expect(services.input.direction()).toEqual({ dx: 0, dy: 0 });

    pointAt.mockClear();
    act(() => {
      fireEvent.pointerDown(zone, at(120, 240));
      fireEvent.pointerMove(zone, at(120 + STICK_RADIUS, 240));
      fireEvent.pointerMove(zone, at(121, 240));
      fireEvent.pointerUp(zone, at(121, 240));
    });
    expect(pointAt).not.toHaveBeenCalled();
  });

  it('one thumb steers; a second touch neither moves nor releases the stick', async () => {
    const { runtime } = await makeRuntime();
    const { services } = await renderWithServices(
      <TouchControls runtime={runtime} />,
      await touchServices(),
    );
    const zone = stick();
    act(() => {
      fireEvent.pointerDown(zone, at(200, 300));
      fireEvent.pointerMove(zone, at(200 + STICK_RADIUS, 300));
    });
    expect(services.input.direction().dx).toBeCloseTo(1);
    act(() => {
      fireEvent.pointerDown(zone, at(400, 300, 2));
      fireEvent.pointerMove(zone, at(400, 300 + STICK_RADIUS, 2));
      fireEvent.pointerUp(zone, at(400, 300 + STICK_RADIUS, 2));
    });
    expect(services.input.direction().dx).toBeCloseTo(1);
    expect(services.input.direction().dy).toBe(0);
    act(() => {
      fireEvent.pointerCancel(zone, at(200 + STICK_RADIUS, 300));
    });
    expect(services.input.direction()).toEqual({ dx: 0, dy: 0 });
  });

  it('lets go of the stick when the controls unmount', async () => {
    const { runtime } = await makeRuntime();
    const { services, unmount } = await renderWithServices(
      <TouchControls runtime={runtime} />,
      await touchServices(),
    );
    const zone = stick();
    act(() => {
      fireEvent.pointerDown(zone, at(200, 300));
      fireEvent.pointerMove(zone, at(200 + STICK_RADIUS, 300));
    });
    expect(services.input.direction().dx).toBeCloseTo(1);
    unmount();
    expect(services.input.direction()).toEqual({ dx: 0, dy: 0 });
  });
});

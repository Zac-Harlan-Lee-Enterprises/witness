import type { VirtualInput } from '@/application/input';
import type { InputAction } from '@/domain/settings';

/**
 * Standard-mapping gamepad → VirtualInput (d-pad/left stick move, A interact,
 * Start pause, Y journal, X satchel, Select quests). Polled on animation
 * frames only while a pad is connected.
 */
const BUTTONS: Array<[number, InputAction]> = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
  [0, 'interact'],
  [9, 'pause'],
  [3, 'journal'],
  [2, 'satchel'],
  [8, 'quests'],
];
const DEADZONE = 0.4;

export function attachGamepad(input: VirtualInput, win: Window = window): () => void {
  let frame = 0;
  let running = false;

  const poll = (): void => {
    const pads = win.navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p): p is Gamepad => p !== null && p.connected);
    if (!pad) {
      input.releaseAll('gamepad');
      running = false;
      return;
    }
    const active = new Set<InputAction>();
    BUTTONS.forEach(([index, action]) => {
      if (pad.buttons[index]?.pressed) active.add(action);
    });
    const [ax = 0, ay = 0] = pad.axes;
    if (ax < -DEADZONE) active.add('left');
    if (ax > DEADZONE) active.add('right');
    if (ay < -DEADZONE) active.add('up');
    if (ay > DEADZONE) active.add('down');
    (
      [
        'up',
        'down',
        'left',
        'right',
        'interact',
        'pause',
        'journal',
        'satchel',
        'quests',
      ] as InputAction[]
    ).forEach((action) =>
      active.has(action) ? input.press('gamepad', action) : input.release('gamepad', action),
    );
    frame = win.requestAnimationFrame(poll);
  };

  const start = (): void => {
    if (running) return;
    running = true;
    frame = win.requestAnimationFrame(poll);
  };
  win.addEventListener('gamepadconnected', start);
  if ([...(win.navigator.getGamepads?.() ?? [])].some((p) => p?.connected)) start();

  return () => {
    win.removeEventListener('gamepadconnected', start);
    win.cancelAnimationFrame(frame);
    input.releaseAll('gamepad');
  };
}

import { z } from 'zod';

/**
 * Device-level settings (shared by all profiles on the device, because
 * accessibility needs must apply before a profile is chosen). See ADR-0007.
 */
export const INPUT_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'interact',
  'pause',
  'journal',
  'satchel',
  'quests',
  'goto',
] as const;
export type InputAction = (typeof INPUT_ACTIONS)[number];

export const INPUT_ACTION_LABELS: Record<InputAction, string> = {
  up: 'Move up',
  down: 'Move down',
  left: 'Move left',
  right: 'Move right',
  interact: 'Talk / examine',
  pause: 'Pause menu',
  journal: 'Open journal',
  satchel: 'Open satchel',
  quests: 'Open quest log',
  goto: 'Open "Go to…" list',
};

/** KeyboardEvent.code values. */
export const DEFAULT_KEY_BINDINGS: Record<InputAction, string[]> = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  interact: ['KeyE', 'Space', 'Enter'],
  pause: ['Escape', 'KeyP'],
  journal: ['KeyJ'],
  satchel: ['KeyI'],
  quests: ['KeyQ'],
  goto: ['KeyG'],
};

const Volume = z.number().min(0).max(1);

export const GameSettingsSchema = z.object({
  version: z.literal(1),
  textScale: z.number().min(1).max(2),
  font: z.enum(['standard', 'hyperlegible', 'dyslexic']),
  highContrast: z.boolean(),
  reducedMotion: z.enum(['system', 'on', 'off']),
  dialogueSpeed: z.enum(['instant', 'fast', 'normal', 'slow']),
  movementSpeed: z.enum(['slow', 'normal', 'fast']),
  /** "Go to…" moves you instantly instead of walking (motor-accessibility aid). */
  instantTravel: z.boolean(),
  touchControls: z.enum(['auto', 'on', 'off']),
  captions: z.boolean(),
  muted: z.boolean(),
  volume: z.object({
    master: Volume,
    music: Volume,
    effects: Volume,
    ambience: Volume,
    voice: Volume,
  }),
  keyBindings: z.record(z.enum(INPUT_ACTIONS), z.array(z.string().min(1)).max(4)),
  /** Anonymous, optional, off by default. */
  analyticsConsent: z.boolean(),
});
export type GameSettings = z.infer<typeof GameSettingsSchema>;

export const DEFAULT_SETTINGS: GameSettings = {
  version: 1,
  textScale: 1,
  font: 'standard',
  highContrast: false,
  reducedMotion: 'system',
  dialogueSpeed: 'normal',
  movementSpeed: 'normal',
  instantTravel: false,
  touchControls: 'auto',
  captions: true,
  muted: false,
  volume: { master: 0.8, music: 0.5, effects: 0.8, ambience: 0.5, voice: 1 },
  keyBindings: DEFAULT_KEY_BINDINGS,
  analyticsConsent: false,
};

/** Parse stored settings, falling back field-by-field to defaults. Never throws. */
export function parseSettings(raw: unknown): GameSettings {
  const full = GameSettingsSchema.safeParse(raw);
  if (full.success)
    return { ...full.data, keyBindings: { ...DEFAULT_KEY_BINDINGS, ...full.data.keyBindings } };
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, value] of Object.entries(raw)) {
    const field = GameSettingsSchema.shape[key as keyof GameSettings];
    if (field && field.safeParse(value).success) merged[key] = value;
  }
  const retry = GameSettingsSchema.safeParse(merged);
  return retry.success ? retry.data : DEFAULT_SETTINGS;
}

/** Tiles per second. */
export const MOVEMENT_SPEEDS: Record<GameSettings['movementSpeed'], number> = {
  slow: 3,
  normal: 4.5,
  fast: 6.5,
};

/** Milliseconds per character for the dialogue reveal (0 = instant). */
export const DIALOGUE_SPEEDS: Record<GameSettings['dialogueSpeed'], number> = {
  instant: 0,
  fast: 12,
  normal: 28,
  slow: 50,
};

/** Rebind one action; a key can only belong to one action at a time. */
export function rebindKey(
  bindings: Readonly<Record<InputAction, string[]>>,
  action: InputAction,
  code: string,
): Record<InputAction, string[]> {
  const next = Object.fromEntries(
    Object.entries(bindings).map(([a, codes]) => [a, codes.filter((c) => c !== code)]),
  ) as Record<InputAction, string[]>;
  next[action] = [code, ...(next[action] ?? []).filter((c) => c !== code)].slice(0, 3);
  return next;
}

/** Human-friendly key names for help text. */
/** Key name for `aria-keyshortcuts` (UI Events key values, e.g. "Escape", "ArrowUp", "J"). */
export function ariaKeyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code; // ArrowUp, Escape, Enter, Space… are already valid names.
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
  };
  return map[code] ?? code;
}

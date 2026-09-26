import { useEffect, useId, useState } from 'react';
import {
  INPUT_ACTION_LABELS,
  INPUT_ACTIONS,
  keyLabel,
  rebindKey,
  type GameSettings,
  type InputAction,
} from '@/domain/settings';
import { useSettings } from '../common/hooks';
import { Modal } from '../common/Modal';
import { useServices } from '../common/services';
import { formatDiagnostics } from './diagnostics';

/**
 * Settings: every option is a native, labelled form control. Changes apply
 * immediately and persist on this device.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings: service } = useServices();
  const s = useSettings();
  const update = (patch: Partial<GameSettings>) => void service.update(patch);

  return (
    <Modal title="Settings" onClose={onClose} className="modal--wide">
      <section aria-labelledby="set-display">
        <h3 id="set-display">Text and display</h3>
        <Range
          label="Text size"
          min={1}
          max={2}
          step={0.25}
          value={s.textScale}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => update({ textScale: v })}
        />
        <Select
          label="Font"
          value={s.font}
          options={[
            ['standard', 'Standard'],
            ['hyperlegible', 'Extra readable (Atkinson Hyperlegible)'],
            ['dyslexic', 'Dyslexia-friendly (OpenDyslexic)'],
          ]}
          onChange={(v) => update({ font: v as GameSettings['font'] })}
        />
        <Toggle
          label="High contrast"
          checked={s.highContrast}
          onChange={(v) => update({ highContrast: v })}
        />
        <Select
          label="Reduce motion"
          value={s.reducedMotion}
          options={[
            ['system', 'Follow my device setting'],
            ['on', 'On — no camera sway, fades or bobbing'],
            ['off', 'Off'],
          ]}
          onChange={(v) => update({ reducedMotion: v as GameSettings['reducedMotion'] })}
        />
        <Toggle
          label="Simpler visual effects (lighter on battery)"
          checked={s.simpleEffects}
          onChange={(v) => update({ simpleEffects: v })}
        />
      </section>

      <section aria-labelledby="set-play">
        <h3 id="set-play">Gameplay</h3>
        <Select
          label="Dialogue text speed"
          value={s.dialogueSpeed}
          options={[
            ['instant', 'Instant'],
            ['fast', 'Fast'],
            ['normal', 'Normal'],
            ['slow', 'Slow'],
          ]}
          onChange={(v) => update({ dialogueSpeed: v as GameSettings['dialogueSpeed'] })}
        />
        <Select
          label="Walking speed"
          value={s.movementSpeed}
          options={[
            ['slow', 'Slow'],
            ['normal', 'Normal'],
            ['fast', 'Fast'],
          ]}
          onChange={(v) => update({ movementSpeed: v as GameSettings['movementSpeed'] })}
        />
        <Toggle
          label="Instant travel from the “Go to…” list"
          hint="Jump straight to people and places instead of walking there."
          checked={s.instantTravel}
          onChange={(v) => update({ instantTravel: v })}
        />
        <Select
          label="On-screen touch controls"
          value={s.touchControls}
          options={[
            ['auto', 'Automatic (touch screens)'],
            ['on', 'Always show'],
            ['off', 'Hide'],
          ]}
          onChange={(v) => update({ touchControls: v as GameSettings['touchControls'] })}
        />
      </section>

      <section aria-labelledby="set-audio">
        <h3 id="set-audio">Sound</h3>
        <Toggle label="Mute all sound" checked={s.muted} onChange={(v) => update({ muted: v })} />
        {(['master', 'music', 'effects', 'ambience', 'voice'] as const).map((ch) => (
          <Range
            key={ch}
            label={`${ch === 'master' ? 'Overall' : ch[0]?.toUpperCase() + ch.slice(1)} volume`}
            min={0}
            max={1}
            step={0.1}
            value={s.volume[ch]}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ volume: { ...s.volume, [ch]: v } })}
          />
        ))}
        <Toggle
          label="Sound captions"
          hint="Describe music and background sounds in text. (The game never needs sound to be understood.)"
          checked={s.captions}
          onChange={(v) => update({ captions: v })}
        />
      </section>

      <section aria-labelledby="set-keys">
        <h3 id="set-keys">Keyboard controls</h3>
        <KeyBindings bindings={s.keyBindings} onChange={(keyBindings) => update({ keyBindings })} />
        <p className="hint">
          Gamepads work too: d-pad or stick to move (and to pick buttons in menus), A to talk,
          examine or press, B to go back, Start for the menu, LB for “Go to…”.
        </p>
      </section>

      <section aria-labelledby="set-privacy">
        <h3 id="set-privacy">Privacy</h3>
        <Toggle
          label="Share anonymous gameplay statistics"
          hint="Off by default. If on, only things like “puzzle solved after 2 tries” are counted — never names, reflections or journal text. This version has no statistics service connected, so nothing leaves your device either way."
          checked={s.analyticsConsent}
          onChange={(v) => update({ analyticsConsent: v })}
        />
      </section>

      <Diagnostics />

      <div className="button-row">
        <button type="button" className="button" onClick={() => void service.reset()}>
          Reset all settings
        </button>
        <button type="button" className="button button--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="field field--toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="field field--range">
      <label htmlFor={id}>
        {label}: <output htmlFor={id}>{format(value)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function KeyBindings({
  bindings,
  onChange,
}: {
  bindings: Record<InputAction, string[]>;
  onChange: (b: Record<InputAction, string[]>) => void;
}) {
  const [listening, setListening] = useState<InputAction | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code !== 'Tab') {
        if (event.code !== 'Escape' || listening === 'pause')
          onChange(rebindKey(bindings, listening, event.code));
      }
      setListening(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [listening, bindings, onChange]);

  // Its own sideways scroll at very large text on narrow screens, so the rest of
  // Settings still reflows (tables are allowed to scroll under WCAG 1.4.10).
  return (
    <div className="table-scroll">
      <table className="key-table">
        <caption className="visually-hidden">Keyboard controls</caption>
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Keys</th>
            <th scope="col">
              <span className="visually-hidden">Change</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {INPUT_ACTIONS.map((action) => (
            <tr key={action}>
              <th scope="row">{INPUT_ACTION_LABELS[action]}</th>
              <td>{(bindings[action] ?? []).map(keyLabel).join(', ') || 'None'}</td>
              <td>
                <button
                  type="button"
                  className="button button--small"
                  aria-live="polite"
                  onClick={() => setListening(action)}
                  aria-label={
                    listening === action
                      ? `Press a key for ${INPUT_ACTION_LABELS[action]}`
                      : `Change key for ${INPUT_ACTION_LABELS[action]}`
                  }
                >
                  {listening === action ? 'Press a key…' : 'Change'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Copy diagnostics" for bug reports; falls back to a selectable text box. */
function Diagnostics() {
  const { config, logger } = useServices();
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const text = () => formatDiagnostics(config, logger.entries(), navigator.userAgent);
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text());
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  };
  return (
    <section aria-labelledby="set-diagnostics">
      <h3 id="set-diagnostics">Something not working?</h3>
      <p className="hint">
        Copy technical details to paste into a bug report: the game version, your browser and recent
        error messages. They never include player names, reflections or journal text.
      </p>
      <button type="button" className="button" onClick={() => void copy()}>
        Copy diagnostics
      </button>
      <p role="status" className="hint">
        {status === 'copied' ? 'Copied.' : ''}
      </p>
      {status === 'manual' && (
        <textarea
          className="diagnostics"
          aria-label="Diagnostics (select all and copy)"
          readOnly
          rows={6}
          value={text()}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </section>
  );
}

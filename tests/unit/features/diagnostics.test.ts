import { describe, expect, it } from 'vitest';
import { formatDiagnostics } from '@/features/settings/diagnostics';

describe('diagnostics text', () => {
  it('lists version, browser and log lines', () => {
    const text = formatDiagnostics(
      { title: 'Witness', version: '1.2.3', contentMode: 'strict' },
      [
        { at: '2026-01-01T00:00:00Z', level: 'warn', message: 'No path to x' },
        { at: '2026-01-01T00:00:01Z', level: 'error', message: 'Save failed', detail: 'Quota' },
      ],
      'TestBrowser/1',
    );
    expect(text.split('\n')).toEqual([
      'Witness 1.2.3 (content: strict)',
      'Browser: TestBrowser/1',
      'Log (2 recent entries):',
      '2026-01-01T00:00:00Z WARN No path to x',
      '2026-01-01T00:00:01Z ERROR Save failed — Quota',
    ]);
  });
});

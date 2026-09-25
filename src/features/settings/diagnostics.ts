import type { LogEntry } from '@/shared/logger';

/**
 * Plain-text diagnostics for a bug report: version, browser and the recent
 * developer log. The logger never records player free text (names,
 * reflections), so this contains nothing personal.
 */
export function formatDiagnostics(
  app: { title: string; version: string; contentMode: string },
  entries: readonly LogEntry[],
  userAgent: string,
): string {
  const lines = [
    `${app.title} ${app.version} (content: ${app.contentMode})`,
    `Browser: ${userAgent}`,
    `Log (${entries.length} recent entries):`,
    ...entries.map(
      (e) => `${e.at} ${e.level.toUpperCase()} ${e.message}${e.detail ? ` — ${e.detail}` : ''}`,
    ),
  ];
  return lines.join('\n');
}

/**
 * Developer diagnostics. Messages go to the console in development and are
 * kept in a small ring buffer that Settings → "Copy diagnostics" exports for
 * bug reports, without exposing internals to players.
 * Never log player free text (reflections, names) here.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
  entries(): readonly LogEntry[];
}

export interface LogEntry {
  at: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createLogger(options: {
  level: LogLevel;
  echo: boolean;
  capacity?: number;
}): Logger {
  const buffer: LogEntry[] = [];
  const capacity = options.capacity ?? 200;
  const write = (level: LogLevel, message: string, detail?: unknown): void => {
    if (ORDER[level] < ORDER[options.level]) return;
    const entry: LogEntry = { at: new Date().toISOString(), level, message };
    if (detail !== undefined) entry.detail = describe(detail);
    buffer.push(entry);
    if (buffer.length > capacity) buffer.shift();
    if (!options.echo) return;
    if (level === 'error') console.error(`[witness] ${message}`, detail ?? '');
    else if (level === 'warn') console.warn(`[witness] ${message}`, detail ?? '');
    else console.info(`[witness] ${message}`, detail ?? '');
  };
  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
    entries: () => [...buffer],
  };
}

function describe(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  try {
    return JSON.stringify(detail).slice(0, 500);
  } catch {
    return String(detail);
  }
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_EVENT_TYPES, EVENT_OWNERS } from '@/domain/events';

const SRC = join(__dirname, '../../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Module id as used in EVENT_OWNERS, e.g. 'domain/effects'. */
const moduleId = (path: string): string => relative(SRC, path).replace(/\.tsx?$/, '');

describe('EVENT_OWNERS matches the code', () => {
  const files = sourceFiles(SRC)
    .filter((f) => moduleId(f) !== 'domain/events')
    .map((f) => ({ id: moduleId(f), text: readFileSync(f, 'utf8') }));

  it.each(ALL_EVENT_TYPES)('%s is constructed exactly where EVENT_OWNERS says', (type) => {
    // An event construction looks like `{ type: 'Name', …` or `{ type: 'Name' }`.
    const construction = new RegExp(`type:\\s*'${type}'\\s*[,}]`);
    const builders = files
      .filter((f) => construction.test(f.text))
      .map((f) => f.id)
      .sort();
    expect(
      builders,
      `Update EVENT_OWNERS['${type}'] in src/domain/events.ts (and the event table in docs/architecture.md) to list the modules that build it.`,
    ).toEqual([...EVENT_OWNERS[type]].sort());
  });
});

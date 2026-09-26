import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artRevision } from '../../../scripts/art-revision';

function artDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'art-revision-'));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

describe('art revision (names the cache-on-first-use art cache)', () => {
  it('is the same for the same art, whatever order the files were written in', () => {
    const a = artDir({ 'lake/manifest.json': '{"v":1}', 'lake/ground-day.webp': 'A' });
    const b = artDir({ 'lake/ground-day.webp': 'A', 'lake/manifest.json': '{"v":1}' });
    expect(artRevision(a)).toBe(artRevision(b));
  });

  it('changes when any file changes, is added or is renamed', () => {
    const base = artRevision(artDir({ 'lake/manifest.json': '{"v":1}', 'lake/p0.webp': 'A' }));
    expect(artRevision(artDir({ 'lake/manifest.json': '{"v":2}', 'lake/p0.webp': 'A' }))).not.toBe(
      base,
    );
    expect(artRevision(artDir({ 'lake/manifest.json': '{"v":1}', 'lake/p0.webp': 'B' }))).not.toBe(
      base,
    );
    expect(
      artRevision(
        artDir({ 'lake/manifest.json': '{"v":1}', 'lake/p0.webp': 'A', 'lake/p1.webp': 'C' }),
      ),
    ).not.toBe(base);
    expect(artRevision(artDir({ 'lake/manifest.json': '{"v":1}', 'lake/p9.webp': 'A' }))).not.toBe(
      base,
    );
  });
});

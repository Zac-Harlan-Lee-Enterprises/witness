import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * A short fingerprint of every file under `dir` (paths and contents), the
 * same on every machine. The service worker names its cache-on-first-use art
 * cache after it (vite.config.ts), so a deploy with new art starts a fresh,
 * self-consistent cache instead of mixing an old manifest with new pages.
 */
export function artRevision(dir: string): string {
  const hash = createHash('sha1');
  if (!existsSync(dir)) return 'none';
  const walk = (d: string): string[] =>
    readdirSync(d)
      .sort()
      .flatMap((name) => {
        const full = join(d, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
  for (const file of walk(dir)) {
    hash.update(relative(dir, file).split(sep).join('/'));
    hash.update('\0');
    hash.update(readFileSync(file));
  }
  return hash.digest('hex').slice(0, 10);
}

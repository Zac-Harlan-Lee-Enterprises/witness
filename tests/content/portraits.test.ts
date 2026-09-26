import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { appearanceKey } from '@/domain/appearance-key';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { PORTRAIT_DIR, PORTRAIT_SIZES } from '@/features/portraits/portrait-art';
import manifest from '@/features/portraits/portrait-manifest.json';

/**
 * Portraits (tools/art/build_portraits.py, `npm run art:portraits`): everyone
 * the art build knows about has one, rendered from how they look now, with
 * every size on disk and recorded provenance.
 */
const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'public', PORTRAIT_DIR);
const entries: Record<string, { appearance: string; kind: string }> = manifest;

const data = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'chapter.json'), 'utf8'),
) as {
  characters: Array<{ id: string; chapter: string; key: string }>;
  players: Array<{ id: string; key: string }>;
};
/**
 * Chapters whose portraits have been rendered. The art data holds every
 * available chapter (for the place and people art); the portrait pass for
 * later chapters is its own job, and people named in the New Testament
 * never get a portrait at all.
 */
const PORTRAIT_CHAPTERS = new Set(['road-to-jericho']);
const people = [
  ...data.characters
    .filter((c) => PORTRAIT_CHAPTERS.has(c.chapter))
    .map((c) => ({ id: c.id, key: c.key, kind: 'character' })),
  ...data.players.map((p) => ({ id: `player-${p.id}`, key: p.key, kind: 'player' })),
];

function glob(pattern: string, path: string): boolean {
  const re = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
  );
  return re.test(path);
}

describe('portraits', () => {
  it('everyone in the art data (every character and player look) has a portrait of how they look', () => {
    expect(people.length).toBeGreaterThan(0);
    for (const p of people) {
      const entry = entries[p.id];
      expect(entry, `${p.id}: run npm run art:portraits`).toBeDefined();
      expect(entry?.appearance, `${p.id} was rendered from a different appearance`).toBe(p.key);
      expect(entry?.kind).toBe(p.kind);
      for (const size of PORTRAIT_SIZES)
        expect(existsSync(join(DIR, `${p.id}-${size}.webp`)), `${p.id}-${size}.webp`).toBe(true);
    }
  });

  it('matches the chapter content and player looks as the game sees them (not stale)', () => {
    const chapter = parseChapter(ROAD_TO_JERICHO);
    for (const c of chapter.characters)
      expect(entries[c.id]?.appearance, c.id).toBe(appearanceKey(c.appearance));
    for (const [look, a] of Object.entries(PLAYER_APPEARANCES))
      expect(entries[`player-${look}`]?.appearance, look).toBe(appearanceKey(a));
  });

  it('ships no stray files, and every file has recorded provenance', () => {
    const assets = (
      JSON.parse(readFileSync(join(ROOT, 'docs', 'art', 'asset-manifest.json'), 'utf8')) as {
        assets: Array<{ path: string; origin: string }>;
      }
    ).assets;
    const files = readdirSync(DIR);
    expect(files.length).toBe(Object.keys(entries).length * PORTRAIT_SIZES.length);
    for (const f of files) {
      const m = /^(.+)-(\d+)\.webp$/.exec(f);
      expect(m, f).not.toBeNull();
      if (!m) continue;
      expect(entries[m[1] ?? ''], `${f} belongs to someone in the manifest`).toBeDefined();
      expect(PORTRAIT_SIZES as readonly number[]).toContain(Number(m[2]));
      const rel = `public/${PORTRAIT_DIR}${f}`;
      expect(
        assets.some((a) => glob(a.path, rel) && a.origin.includes('build_portraits.py')),
        `${rel} is recorded in docs/art/asset-manifest.json`,
      ).toBe(true);
    }
  });

  it('stays small enough to precache for offline play', () => {
    let total = 0;
    for (const f of readdirSync(DIR)) {
      const size = statSync(join(DIR, f)).size;
      total += size;
      if (f.endsWith('-128.webp')) expect(size, f).toBeLessThan(12_000);
      if (f.endsWith('-256.webp')) expect(size, f).toBeLessThan(30_000);
      if (f.endsWith('-512.webp')) expect(size, f).toBeLessThan(64_000);
    }
    expect(total).toBeLessThan(2_000_000);
  });
});

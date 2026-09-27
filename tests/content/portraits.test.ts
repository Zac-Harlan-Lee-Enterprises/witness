import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { chapterSource } from '@/content';
import { portraitCast } from '@/content/portrait-cast';
import { appearanceKey } from '@/domain/appearance-key';
import type { Chapter } from '@/domain/chapter';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { PORTRAIT_DIR, PORTRAIT_SIZES, portraitImage } from '@/features/portraits/portrait-art';
import manifest from '@/features/portraits/portrait-manifest.json';

/**
 * Portraits (tools/art/build_portraits.py, `npm run art:portraits`): everyone
 * who speaks in any chapter, and every player look, has one, rendered from
 * how they look now, with every size on disk and recorded provenance.
 *
 * Two steps can fall behind the content, and each has a check here:
 * the portrait data (`npm run art:portrait-data`) and the renders.
 */
const ROOT = join(__dirname, '..', '..');
const DIR = join(ROOT, 'public', PORTRAIT_DIR);
const entries: Record<string, { appearance: string; kind: string }> = manifest;

const data = JSON.parse(
  readFileSync(join(ROOT, 'tools', 'art', 'data', 'portrait-people.json'), 'utf8'),
) as {
  characters: Array<{ id: string; character: string; chapter: string; key: string }>;
  players: Array<{ id: string; key: string }>;
};
const people = [
  ...data.characters.map((c) => ({ id: c.id, key: c.key, kind: 'character' })),
  ...data.players.map((p) => ({ id: `player-${p.id}`, key: p.key, kind: 'player' })),
];

let chapters: Chapter[] = [];
beforeAll(async () => {
  chapters = await Promise.all(
    chapterSource
      .list()
      .filter((m) => m.available)
      .map((m) => chapterSource.load(m.id)),
  );
});

/** Width and height of a WebP file, from its header (lossy, lossless or extended). */
function webpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP')
    return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ')
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X')
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  return null;
}

function glob(pattern: string, path: string): boolean {
  const re = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
  );
  return re.test(path);
}

describe('portraits', () => {
  it('the portrait data covers every chapter as it is now (else: npm run art:portrait-data)', () => {
    expect(chapters.length).toBeGreaterThanOrEqual(4);
    const { sitters } = portraitCast(chapters);
    expect(
      data.characters.map((c) => [c.id, c.chapter, c.character, c.key]),
      'tools/art/data/portrait-people.json is stale: run npm run art:portrait-data',
    ).toEqual(
      sitters.map((s) => [
        s.portraitId,
        s.chapterId,
        s.characterId,
        appearanceKey(s.character.appearance),
      ]),
    );
    expect(data.players.map((p) => [p.id, p.key])).toEqual(
      Object.entries(PLAYER_APPEARANCES).map(([id, a]) => [id, appearanceKey(a)]),
    );
  });

  it('everyone in the portrait data has a portrait of how they look now, in every size', () => {
    expect(people.length).toBeGreaterThan(40);
    const missing = people.filter((p) => !entries[p.id]).map((p) => p.id);
    expect(missing, `no portrait for ${missing.join(', ')}: run npm run art:portraits`).toEqual([]);
    for (const p of people) {
      const entry = entries[p.id];
      expect(entry?.appearance, `${p.id} was rendered from a different appearance (stale)`).toBe(
        p.key,
      );
      expect(entry?.kind).toBe(p.kind);
      for (const size of PORTRAIT_SIZES)
        expect(existsSync(join(DIR, `${p.id}-${size}.webp`)), `${p.id}-${size}.webp`).toBe(true);
    }
  });

  it('every character who speaks, in every chapter, is shown their own portrait', () => {
    const { sitters } = portraitCast(chapters);
    expect(sitters.length).toBeGreaterThan(35);
    for (const s of sitters) {
      const art = portraitImage(s.character.appearance, s.characterId, 'neutral', entries, '/');
      expect(art?.id, `${s.chapterId}: ${s.characterId}`).toBe(s.portraitId);
    }
    for (const [look, a] of Object.entries(PLAYER_APPEARANCES))
      expect(portraitImage(a, null, 'neutral', entries, '/')?.id, look).toBe(`player-${look}`);
  });

  it('never shows a biblical figure in close-up', () => {
    const figures = chapters.flatMap((c) => c.characters.filter((x) => x.biblicalFigure));
    expect(figures.length).toBeGreaterThan(0);
    for (const f of figures) {
      expect(portraitImage(f.appearance, f.id, 'neutral', entries, '/'), f.id).toBeNull();
      expect(data.characters.some((c) => c.character === f.id)).toBe(false);
    }
  });

  it('ships no stray files, and every file has recorded provenance', () => {
    const assets = (
      JSON.parse(readFileSync(join(ROOT, 'docs', 'art', 'asset-manifest.json'), 'utf8')) as {
        assets: Array<{ path: string; origin: string }>;
      }
    ).assets;
    const files = readdirSync(DIR);
    expect(files.length).toBe(Object.keys(entries).length * PORTRAIT_SIZES.length);
    for (const id of Object.keys(entries))
      expect(
        people.some((p) => p.id === id),
        `${id} is in the manifest but nobody needs it`,
      ).toBe(true);
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

  it('every file is a square WebP of the size its name gives', () => {
    for (const f of readdirSync(DIR)) {
      const size = Number(/-(\d+)\.webp$/.exec(f)?.[1]);
      expect(webpSize(readFileSync(join(DIR, f))), f).toEqual({ width: size, height: size });
    }
  });

  it('the portraits guide shows only review pictures that exist, and every one of them', () => {
    const guide = readFileSync(join(ROOT, 'docs', 'art', 'portraits.md'), 'utf8');
    const linked = new Set([...guide.matchAll(/\(portraits\/([^)\s]+\.webp)\)/g)].map((m) => m[1]));
    const sheets = readdirSync(join(ROOT, 'docs', 'art', 'portraits'));
    expect(linked.size).toBeGreaterThan(10);
    for (const f of linked) expect(sheets, `docs/art/portraits/${f ?? ''}`).toContain(f);
    for (const f of sheets)
      expect([...linked], `${f} is not in docs/art/portraits.md`).toContain(f);
  });

  it('stays small enough to precache for offline play', () => {
    let total = 0;
    for (const f of readdirSync(DIR)) {
      const size = statSync(join(DIR, f)).size;
      total += size;
      if (f.endsWith('-128.webp')) expect(size, f).toBeLessThan(12_000);
      if (f.endsWith('-256.webp')) expect(size, f).toBeLessThan(32_000);
      if (f.endsWith('-512.webp')) expect(size, f).toBeLessThan(80_000);
    }
    expect(total).toBeLessThan(3_500_000);
  });
});

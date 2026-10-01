import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapterSource } from '@/content';
import type { KeyArt } from '@/domain/chapter';
import { TITLE_ART } from '@/features/menu/key-art';

const ROOT = join(__dirname, '../..');
const PUBLIC = join(ROOT, 'public');

/** A WebP's pixel size, from its header (VP8, VP8L or VP8X). */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.toString('ascii', 0, 4), `${file} is RIFF`).toBe('RIFF');
  expect(b.toString('ascii', 8, 12), `${file} is WebP`).toBe('WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  expect(chunk, file).toBe('VP8 ');
  return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
}

function checkOnDisk(art: KeyArt, label: string): void {
  const full = join(PUBLIC, art.src);
  const small = join(PUBLIC, art.srcSmall);
  expect(existsSync(full), `${label}: ${art.src} is on disk`).toBe(true);
  expect(existsSync(small), `${label}: ${art.srcSmall} is on disk`).toBe(true);
  expect(webpSize(full), `${label}: ${art.src}`).toEqual({ width: art.width, height: art.height });
  expect(webpSize(small), `${label}: ${art.srcSmall}`).toEqual({
    width: art.width / 2,
    height: art.height / 2,
  });
  // Small enough to precache for the menus offline (vite.config.ts precaches
  // public/art/key-art/), big enough to be a real render and not a stub.
  expect(statSync(full).size, `${label}: ${art.src} bytes`).toBeLessThan(330_000);
  expect(statSync(full).size, `${label}: ${art.src} bytes`).toBeGreaterThan(40_000);
  expect(statSync(small).size, `${label}: ${art.srcSmall} bytes`).toBeLessThan(120_000);
  expect(art.alt.length, `${label}: alt text`).toBeGreaterThan(40);
}

describe('key art', () => {
  it('gives every playable chapter its own key art, on disk at the sizes it declares', () => {
    const chapters = chapterSource.list().filter((c) => c.available);
    expect(chapters.length).toBeGreaterThanOrEqual(4);
    for (const meta of chapters) {
      expect(meta.keyArt, `${meta.id} has key art`).toBeDefined();
      if (!meta.keyArt) continue;
      expect(meta.keyArt.src).toBe(`art/key-art/${meta.id}.webp`);
      checkOnDisk(meta.keyArt, meta.id);
    }
    const alts = chapters.map((c) => c.keyArt?.alt);
    expect(new Set(alts).size, 'each chapter describes its own picture').toBe(alts.length);
  });

  it('has the title screen hero on disk', () => {
    checkOnDisk(TITLE_ART, 'title');
  });

  it('renders each picture from a shot the build knows, reproducibly', () => {
    const shots = readFileSync(join(ROOT, 'tools/art/lib/key_art_shots.py'), 'utf8');
    for (const id of ['title', ...chapterSource.list().map((c) => c.id)])
      expect(shots, `a shot "${id}" in key_art_shots.py`).toContain(`"${id}"`);
    const build = readFileSync(join(ROOT, 'scripts/art-build.mjs'), 'utf8');
    expect(build).toContain("'key-art'");
    expect(build).toContain('tools/art/build_key_art.py');
  });
});

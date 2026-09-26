import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseChapter } from '@/content';
import { ROAD_TO_JERICHO } from '@/content/chapters/road-to-jericho';
import { parseLayout } from '@/domain/world';
import { parsePeopleArt, parsePlaceArt } from '@/game/prerendered/manifest';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { appearanceKey, PLACE_ART } from '@/game/prerendered/select';

const ROOT = join(__dirname, '..', '..');
const ART = join(ROOT, 'public', 'art');

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Glob with `*` (within a path segment) only. */
function matches(pattern: string, path: string): boolean {
  const re = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
  );
  return re.test(path);
}

interface AssetEntry {
  path: string;
  origin: string;
  license: string;
}

describe('art asset provenance', () => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'docs', 'art', 'asset-manifest.json'), 'utf8'),
  ) as { assets: AssetEntry[] };

  it('records the origin and licence of every art file the game ships', () => {
    const shipped = files(ART).map((f) => relative(ROOT, f));
    expect(shipped.length).toBeGreaterThan(0);
    const unlisted = shipped.filter((f) => !manifest.assets.some((a) => matches(a.path, f)));
    expect(unlisted, `Add these to docs/art/asset-manifest.json: ${unlisted.join(', ')}`).toEqual(
      [],
    );
    for (const a of manifest.assets) {
      expect(a.origin.length, `origin of ${a.path}`).toBeGreaterThan(10);
      expect(a.license.length, `licence of ${a.path}`).toBeGreaterThan(5);
    }
  });
});

describe('pre-rendered places', () => {
  const chapter = parseChapter(ROAD_TO_JERICHO);

  for (const [sceneId, path] of Object.entries(PLACE_ART)) {
    it(`${sceneId}: the manifest is valid, its files exist, and it matches the map`, () => {
      const dir = join(ROOT, 'public', path);
      const { art, error } = parsePlaceArt(
        JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')),
      );
      expect(error).toBeNull();
      if (!art) return;
      expect(art.scene).toBe(sceneId);
      const scene = chapter.scenes.find((s) => s.id === sceneId);
      expect(scene).toBeDefined();
      if (!scene) return;
      const grid = parseLayout(scene);
      expect(art.tiles).toEqual({ w: grid.width, h: grid.height });
      for (const v of [art.variants.day, art.variants.late]) {
        if (!v) continue;
        for (const f of [v.ground, v.groundLow, v.shade, ...v.pages])
          expect(existsSync(join(dir, f)), `${f} exists`).toBe(true);
        for (const s of v.sprites) {
          expect(s.page).toBeLessThan(v.pages.length);
          for (const [x, y] of s.tiles) {
            expect(
              x >= 0 && x < grid.width && y >= 0 && y < grid.height,
              `${s.id} tile ${x},${y}`,
            ).toBe(true);
          }
          if (s.id.startsWith('entity:')) {
            const id = s.id.slice('entity:'.length);
            expect(
              scene.entities.some((e) => e.id === id),
              `entity ${id} exists`,
            ).toBe(true);
          }
        }
      }
    });
  }

  it('the art build data is in step with the chapter (re-run npm run art:data if not)', () => {
    const data = JSON.parse(
      readFileSync(join(ROOT, 'tools', 'art', 'data', 'chapter.json'), 'utf8'),
    ) as {
      characters: Array<{ id: string; key: string }>;
      players: Array<{ id: string; key: string }>;
    };
    for (const c of chapter.characters)
      expect(data.characters.find((d) => d.id === c.id)?.key, c.id).toBe(
        appearanceKey(c.appearance),
      );
    for (const [id, a] of Object.entries(PLAYER_APPEARANCES))
      expect(data.players.find((d) => d.id === id)?.key, id).toBe(appearanceKey(a));
  });

  it('people sheets are valid, their files exist, and each belongs to someone in the chapter', () => {
    const dir = join(ART, 'people');
    const { people, error } = parsePeopleArt(
      JSON.parse(readFileSync(join(dir, 'people.json'), 'utf8')),
    );
    expect(error).toBeNull();
    if (!people) return;
    const data = JSON.parse(
      readFileSync(join(ROOT, 'tools', 'art', 'data', 'chapter.json'), 'utf8'),
    ) as {
      characters: Array<{ key: string }>;
      players: Array<{ key: string }>;
      crowd: Array<{ key: string }>;
    };
    const known = new Set([...data.characters, ...data.players, ...data.crowd].map((c) => c.key));
    for (const [id, sheet] of Object.entries(people)) {
      expect(known.has(sheet.appearance), `${id} matches a known appearance`).toBe(true);
      for (const f of [
        sheet.sheets.day,
        sheet.sheets.late,
        sheet.shadows.day.sheet,
        sheet.shadows.late?.sheet,
      ])
        if (f) expect(existsSync(join(dir, f)), `${f} exists`).toBe(true);
    }
  });
});

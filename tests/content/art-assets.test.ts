import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapterSource } from '@/content';
import type { Chapter } from '@/domain/chapter';
import { PLAYER_APPEARANCES } from '@/domain/characters';
import { parseLayout, type LookMark, type Pose } from '@/domain/world';
import {
  LIGHTING_VARIANTS,
  MAX_ART_TEXTURE,
  parsePeopleArt,
  parsePlaceArt,
  type ArtTile,
  type PeopleArt,
  type PeopleLight,
} from '@/game/prerendered/manifest';
import { appearanceKey, PLACE_ART, PLACES_WITH_ART, pickSheets } from '@/game/prerendered/select';

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

/** Width and height of a WebP image, from its header. */
function webpSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >>> 14) & 0x3fff) };
  }
  // Lossy VP8: after the frame tag and start code, 14-bit sizes.
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
}

/** Points of a w x h image (every 16 px, and its last row and column) no tile covers. */
function uncovered(tiles: ReadonlyArray<ArtTile & { w: number; h: number }>, w: number, h: number) {
  const out: string[] = [];
  const steps = (n: number) => [
    ...Array.from({ length: Math.ceil(n / 16) }, (_, i) => i * 16),
    n - 1,
  ];
  for (const y of steps(h))
    for (const x of steps(w))
      if (!tiles.some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h))
        out.push(`${x},${y}`);
  return out;
}

/** Every combination of the given mark lists (as the story can apply any of them). */
function subsets(lists: ReadonlyArray<readonly LookMark[]>): LookMark[][] {
  let out: LookMark[][] = [[]];
  for (const l of lists) out = out.flatMap((s) => [s, [...new Set([...s, ...l])]]);
  return out;
}

interface AssetEntry {
  path: string;
  origin: string;
  license: string;
}

/** Every available chapter: places with art may come from any of them. */
const chapters: Chapter[] = await Promise.all(
  chapterSource
    .list()
    .filter((m) => m.available)
    .map((m) => chapterSource.load(m.id)),
);

/** A scene and the chapter it belongs to. */
function sceneOf(id: string): { chapter: Chapter; scene: Chapter['scenes'][number] } | null {
  for (const chapter of chapters) {
    const scene = chapter.scenes.find((s) => s.id === id);
    if (scene) return { chapter, scene };
  }
  return null;
}

/** The Python method that builds a tile kind (dashes become underscores). */
const builderOf = (kind: string): string => `def tile_${kind.replaceAll('-', '_')}(self)`;

const people: PeopleArt | null = parsePeopleArt(
  JSON.parse(readFileSync(join(ART, 'people', 'people.json'), 'utf8')),
).people;

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
  it('lists exactly the places that have art (public/art/<scene>/manifest.json)', () => {
    const dirs = readdirSync(ART).filter((d) => existsSync(join(ART, d, 'manifest.json')));
    expect([...PLACES_WITH_ART].sort()).toEqual(dirs.sort());
  });

  for (const [sceneId, path] of Object.entries(PLACE_ART)) {
    const scene = sceneOf(sceneId)?.scene;
    const read = () => {
      const dir = join(ROOT, 'public', path);
      const { art, error } = parsePlaceArt(
        JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')),
      );
      expect(error).toBeNull();
      return { dir, art };
    };

    it(`${sceneId}: the manifest is valid, its files exist, and it matches the map`, () => {
      const { dir, art } = read();
      if (!art) return;
      expect(art.scene).toBe(sceneId);
      expect(scene).toBeDefined();
      if (!scene) return;
      const grid = parseLayout(scene);
      expect(art.tiles).toEqual({ w: grid.width, h: grid.height });
      // Rooms light people with their own light (by day, or by lamps);
      // outdoors the sun of the variant does, or rain cloud.
      expect(
        art.peopleLight === 'indoor' || art.peopleLight === 'lamp',
        'rooms light people with their own light',
      ).toBe(scene.kind === 'indoor');
      for (const v of LIGHTING_VARIANTS.map((k) => art.variants[k])) {
        if (!v) continue;
        for (const f of [
          ...[...v.ground, ...v.groundLow].map((t) => t.file),
          v.shade,
          ...v.pages,
          ...(v.pagesLow ?? []),
        ])
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

    it(`${sceneId}: every texture fits any GPU, and the ground's tiles cover the whole place`, () => {
      const { dir, art } = read();
      if (!art) return;
      for (const v of LIGHTING_VARIANTS.map((k) => art.variants[k])) {
        if (!v) continue;
        for (const f of [...v.pages, ...(v.pagesLow ?? [])]) {
          const size = webpSize(join(dir, f));
          expect(Math.max(size.w, size.h), f).toBeLessThanOrEqual(MAX_ART_TEXTURE);
        }
        for (const [tiles, ppu] of [
          [v.ground, art.ppu],
          [v.groundLow, art.ppu / 2],
        ] as const) {
          const sized = tiles.map((t) => ({ ...t, ...webpSize(join(dir, t.file)) }));
          for (const t of sized)
            expect(Math.max(t.w, t.h), t.file).toBeLessThanOrEqual(MAX_ART_TEXTURE);
          const w = Math.round(art.tiles.w * 32 * ppu);
          const h = Math.round(art.tiles.h * 32 * ppu);
          expect(Math.max(...sized.map((t) => t.x + t.w)), 'ground width').toBe(w);
          expect(Math.max(...sized.map((t) => t.y + t.h)), 'ground height').toBe(h);
          expect(uncovered(sized, w, h), 'gaps between ground tiles').toEqual([]);
        }
      }
    });

    it(`${sceneId}: every story prop is pre-rendered (none is painted over the art)`, () => {
      const { art } = read();
      if (!art || !scene) return;
      for (const v of LIGHTING_VARIANTS.map((k) => art.variants[k])) {
        if (!v) continue;
        const ids = new Set(v.sprites.map((s) => s.id));
        const missing = scene.entities
          .filter((e) => !e.characterId && e.sprite && e.sprite !== 'none')
          .filter((e) => !ids.has(`entity:${e.id}`))
          .map((e) => `${e.id} (${e.sprite ?? ''})`);
        expect(missing, `Add entity_<sprite> builders in tools/art/lib`).toEqual([]);
      }
    });
  }

  it('has a builder for every tile kind a pre-rendered place uses', () => {
    const lib = join(ROOT, 'tools', 'art', 'lib');
    const source = readdirSync(lib)
      .filter((f) => f.endsWith('.py'))
      .map((f) => readFileSync(join(lib, f), 'utf8'))
      .join('\n');
    for (const id of PLACES_WITH_ART) {
      const scene = sceneOf(id)?.scene;
      expect(scene, `${id} is a scene of an available chapter`).toBeDefined();
      for (const kind of new Set(Object.values(scene?.legend ?? {})))
        expect(source, `${builderOf(kind)} (tools/art/lib)`).toContain(builderOf(kind));
    }
  });

  it('the art build data is in step with the chapter (re-run npm run art:data if not)', () => {
    const data = JSON.parse(
      readFileSync(join(ROOT, 'tools', 'art', 'data', 'chapter.json'), 'utf8'),
    ) as {
      characters: Array<{ id: string; chapter: string; key: string }>;
      players: Array<{ id: string; key: string }>;
      scenes: Array<{ id: string; layout: string[]; legend: Record<string, string> }>;
    };
    for (const chapter of chapters) {
      for (const c of chapter.characters)
        expect(
          data.characters.find((d) => d.id === c.id && d.chapter === chapter.id)?.key,
          `${chapter.id}: ${c.id}`,
        ).toBe(appearanceKey(c.appearance));
      for (const s of chapter.scenes) {
        const exported = data.scenes.find((d) => d.id === s.id);
        expect(exported?.layout, s.id).toEqual(s.layout);
        expect(exported?.legend, s.id).toEqual(s.legend);
      }
    }
    for (const [id, a] of Object.entries(PLAYER_APPEARANCES))
      expect(data.players.find((d) => d.id === id)?.key, id).toBe(appearanceKey(a));
  });
});

describe('pre-rendered people', () => {
  it('people sheets are valid, their files exist, and each belongs to someone in the chapter', () => {
    expect(people).not.toBeNull();
    if (!people) return;
    const dir = join(ART, 'people');
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
      if (sheet.overlay) expect(people[sheet.overlay.of], `${id} overlays a sheet`).toBeDefined();
      else expect(Object.keys(sheet.shadows).length, `${id} casts a shadow`).toBeGreaterThan(0);
      for (const f of [
        ...Object.values(sheet.sheets),
        ...Object.values(sheet.shadows).map((s) => s.sheet),
      ])
        if (f) expect(existsSync(join(dir, f)), `${f} exists`).toBe(true);
    }
  });

  const rags = Object.values(PLAYER_APPEARANCES).map((a) => a.robe);

  for (const id of PLACES_WITH_ART) {
    const found = sceneOf(id);
    if (!found) continue;
    const { chapter, scene } = found;
    // The lights people are seen in there: the place's own, else the sun of each variant.
    const manifest = join(ART, id, 'manifest.json');
    const art = existsSync(manifest)
      ? parsePlaceArt(JSON.parse(readFileSync(manifest, 'utf8'))).art
      : null;
    const lights: readonly PeopleLight[] = art?.peopleLight
      ? [art.peopleLight]
      : art
        ? LIGHTING_VARIANTS.filter((k) => art.variants[k])
        : [scene.kind === 'indoor' ? 'indoor' : 'day'];

    it(`${id}: everyone who appears has sheets for every pose and story mark they can show`, () => {
      const missing: string[] = [];
      for (const e of scene.entities) {
        const c = chapter.characters.find((ch) => ch.id === e.characterId);
        if (!c) continue;
        const poses = new Set<Pose>([e.pose, ...e.looks.flatMap((l) => (l.pose ? [l.pose] : []))]);
        for (const pose of poses)
          for (const marks of subsets(e.looks.map((l) => l.marks)))
            for (const rag of marks.includes('rag-bandaged') ? rags : [null]) {
              const pick = pickSheets(people, c.appearance, marks, pose, rag);
              if (!pick) missing.push(`${c.id} ${pose} [${marks.join(', ')}] ${rag ?? ''}`);
              else
                for (const light of lights)
                  for (const sid of [pick.base, ...pick.overlays])
                    if (!people?.[sid]?.sheets[light]) missing.push(`${sid}: no ${light} light`);
            }
      }
      expect(missing, 'Run node scripts/art-build.mjs people').toEqual([]);
    });

    it(`${id}: the player has sheets for every look and everything they can carry`, () => {
      const missing: string[] = [];
      for (const [look, a] of Object.entries(PLAYER_APPEARANCES))
        for (const marks of subsets(chapter.playerLooks.map((l) => l.marks))) {
          const pick = pickSheets(people, a, marks, 'stand', null);
          if (!pick) missing.push(`${look} [${marks.join(', ')}]`);
          else
            for (const light of lights)
              for (const sid of [pick.base, ...pick.overlays])
                if (!people?.[sid]?.sheets[light]) missing.push(`${sid}: no ${light} light`);
        }
      expect(missing, 'Run node scripts/art-build.mjs people').toEqual([]);
    });
  }
});

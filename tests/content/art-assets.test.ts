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
  type ArtVariant,
  type LightingVariant,
  type PeopleArt,
  type PeopleLight,
  type PersonSheet,
  type PlaceArt,
} from '@/game/prerendered/manifest';
import {
  appearanceKey,
  behindCanopy,
  peopleLightFor,
  PLACE_ART,
  PLACES_WITH_ART,
  pickSheets,
} from '@/game/prerendered/select';

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

/** Each set of a place's art (day, later day, night) it has, with its name. */
function setsOf(art: PlaceArt): Array<[LightingVariant, ArtVariant]> {
  return LIGHTING_VARIANTS.flatMap((name) => {
    const v = art.variants[name];
    return v ? [[name, v] as [LightingVariant, ArtVariant]] : [];
  });
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

describe('Philemon’s house', () => {
  it('fades a column while the player stands behind it, rather than cutting them in half', () => {
    // The colonnade sorts true (no cheat): someone just north of a column in
    // line with it is behind its shaft. The player can stand there (talking
    // to Ammia at the gathering), so the house's columns fade like canopies.
    const { art } = parsePlaceArt(
      JSON.parse(readFileSync(join(ART, 'philemon-house', 'manifest.json'), 'utf8')),
    );
    const v = art?.variants.day;
    if (!art || !v) throw new Error('no art for philemon-house');
    const columns = v.sprites.filter((s) => s.id.startsWith('column-'));
    expect(columns.length).toBeGreaterThan(0);
    for (const c of columns) {
      expect(c.fade, c.id).toBe(true);
      // Each sorts by its own base (the old cheat drew the far row 1.3 rows north of it).
      const row = Number(c.id.split('-')[2]);
      expect(c.base, c.id).toBeCloseTo((row + 0.72) * 32, 1);
    }
    // The player at (9,5), beside Ammia and in line with column (9,7): feet at
    // the tile centre plus FEET_BELOW_CENTRE (src/game/scenes/actors.ts).
    const far = columns.find((c) => c.id === 'column-9-7');
    if (!far) throw new Error('no column-9-7');
    expect(behindCanopy(far, art.ppu, 9.5 * 32, 5.5 * 32 + 10)).toBe(true);
  });
});

describe('the art pipeline', () => {
  it('kits never shadow each other’s helpers: a shared helper is an override that calls super()', () => {
    // Place mixes every kit into one class, so a private helper defined in two
    // kits resolves to the first in the MRO for all of them: the lake kit's
    // _tube once broke every Roman place, and the Roman _window every
    // Chapter 1 house. A deliberate override keeps the signature and hands
    // other places on (super()).
    const lib = join(ROOT, 'tools', 'art', 'lib');
    const kits = readdirSync(lib).filter(
      (f) => /^(kit_|lake_|roman_)\w+\.py$/.test(f) || f === 'place.py',
    );
    const defs = new Map<string, Array<{ file: string; params: string; overrides: boolean }>>();
    for (const file of kits) {
      const source = readFileSync(join(lib, file), 'utf8');
      const methods = [...source.matchAll(/^ {4}def (_[a-z0-9_]+)\(self([^)]*)\)/gm)];
      methods.forEach((m, i) => {
        const [, name = '', params = ''] = m;
        if (name.startsWith('__')) return;
        const body = source.slice(m.index, methods[i + 1]?.index ?? source.length);
        const list = defs.get(name) ?? [];
        list.push({
          file,
          params: params.replace(/\s+/g, ' ').trim(),
          overrides: body.includes('super()'),
        });
        defs.set(name, list);
      });
    }
    const clashes = [...defs.entries()]
      .filter(([, list]) => list.length > 1)
      .filter(
        ([, list]) =>
          new Set(list.map((d) => d.params)).size > 1 ||
          list.filter((d) => !d.overrides).length > 1,
      )
      .map(([name, list]) => `${name} in ${list.map((d) => d.file).join(', ')}`);
    expect(clashes, 'Rename the helper, or make it an override that calls super()').toEqual([]);
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
      for (const [name, v] of setsOf(art)) {
        // Rooms light people with their own light (by day, or by lamps), in
        // every set; outdoors the sun (or moon) of the set does, or rain cloud.
        const light = peopleLightFor(name, art.peopleLight, v.peopleLight);
        expect(
          light === 'indoor' || light === 'lamp',
          `${name}: rooms light people with their own light (${light})`,
        ).toBe(scene.kind === 'indoor');
        // The fires and lamps made to flicker are inside the place.
        for (const l of v.lights)
          expect(
            l.x >= 0 && l.x <= grid.width * 32 && l.y >= 0 && l.y <= grid.height * 32,
            `${name}: ${l.kind} light at ${l.x},${l.y}`,
          ).toBe(true);
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
      for (const [, v] of setsOf(art)) {
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
      for (const [, v] of setsOf(art)) {
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

  it('every sheet has a half-resolution copy for phones, with the same frames at half the size', () => {
    expect(people).not.toBeNull();
    if (!people) return;
    const dir = join(ART, 'people');
    const problems: string[] = [];
    /** A low atlas: it exists, fits any GPU, and packs every frame of its full sheet. */
    const packed = (sheet: PersonSheet, full: string, half: string): void => {
      if (!existsSync(join(dir, half))) {
        problems.push(`${half} is missing`);
        return;
      }
      const size = webpSize(join(dir, half));
      if (Math.max(size.w, size.h) > MAX_ART_TEXTURE) problems.push(`${half} is too big`);
      const names = Object.keys(sheet.atlas[full] ?? {}).sort();
      const table = sheet.atlas[half] ?? {};
      if (Object.keys(table).sort().join() !== names.join())
        problems.push(`${half}: frames differ from ${full}`);
      for (const [name, [x, y, w, h]] of Object.entries(table))
        if (x + w > size.w || y + h > size.h) problems.push(`${half}: ${name} is outside it`);
    };
    for (const [id, sheet] of Object.entries(people)) {
      const low = sheet.low;
      if (!low) {
        problems.push(`${id}: no low sheets (node scripts/art-build.mjs people-low)`);
        continue;
      }
      const k = low.ppu / sheet.ppu;
      // Half the pixels per unit, and a frame that lies exactly where the full one does.
      if (low.ppu !== 1.5) problems.push(`${id}: low ppu ${low.ppu}`);
      for (const [a, b] of [
        [low.frameWidth, sheet.frameWidth],
        [low.frameHeight, sheet.frameHeight],
        [low.originX, sheet.originX],
        [low.originY, sheet.originY],
      ] as const)
        if (a !== b * k) problems.push(`${id}: low frame ${a} is not ${b} × ${k}`);
      for (const [light, full] of Object.entries(sheet.sheets)) {
        const half = low.sheets[light as PeopleLight];
        if (half !== full.replace(/\.webp$/, '-low.webp'))
          problems.push(`${id}: ${light} has no low sheet (${String(half)})`);
        else packed(sheet, full, half);
      }
      // Cast shadows: the full sheet itself (one byte a pixel, soft already),
      // or a smaller copy with its frame scaled to match.
      if (Object.keys(low.shadows).sort().join() !== Object.keys(sheet.shadows).sort().join())
        problems.push(`${id}: low shadows are not in the lights of the full ones`);
      for (const light of Object.keys(sheet.shadows) as PeopleLight[]) {
        const full = sheet.shadows[light];
        const half = low.shadows[light];
        if (!full || !half) continue;
        if (half.sheet === full.sheet) {
          if (JSON.stringify(half) !== JSON.stringify(full))
            problems.push(`${id}: ${light} shadow differs from the sheet it names`);
          continue;
        }
        if (half.sheet !== full.sheet.replace(/\.webp$/, '-low.webp'))
          problems.push(`${id}: ${light} shadow sheet ${half.sheet}`);
        else packed(sheet, full.sheet, half.sheet);
        if (half.frameWidth !== full.frameWidth * (half.ppu / full.ppu))
          problems.push(`${id}: ${light} shadow frame is not scaled`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('the half-resolution sheets are recorded as derived from the rendered ones', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'docs', 'art', 'asset-manifest.json'), 'utf8'),
    ) as { assets: AssetEntry[] };
    const entry = manifest.assets.find((a) => a.path === 'public/art/people/*-low.webp');
    expect(entry?.origin).toContain('tools/art/downsample_people.py');
    // Listed before the rendered sheets' entry, which would match them too.
    const rendered = manifest.assets.findIndex((a) => a.path === 'public/art/people/*.webp');
    expect(manifest.assets.indexOf(entry as AssetEntry)).toBeLessThan(rendered);
    const low = files(join(ART, 'people')).filter((f) => f.endsWith('-low.webp'));
    expect(low.length).toBeGreaterThan(0);
    for (const f of low) expect(matches(entry?.path ?? '', relative(ROOT, f)), f).toBe(true);
  });

  const rags = Object.values(PLAYER_APPEARANCES).map((a) => a.robe);

  for (const id of PLACES_WITH_ART) {
    const found = sceneOf(id);
    if (!found) continue;
    const { chapter, scene } = found;
    // The lights people are seen in there, in each of its sets: the set's
    // own, else the place's, else the sun of the set.
    const manifest = join(ART, id, 'manifest.json');
    const art = existsSync(manifest)
      ? parsePlaceArt(JSON.parse(readFileSync(manifest, 'utf8'))).art
      : null;
    const lights: PeopleLight[] = art
      ? [
          ...new Set(
            setsOf(art).map(([name, v]) => peopleLightFor(name, art.peopleLight, v.peopleLight)),
          ),
        ]
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

describe('the half-resolution set phones load', () => {
  // It was box-filtered and saved at WebP 84, which smeared the grit of the
  // ground and a drying net's mesh into a mottled blur. It is now halved
  // with a Lanczos filter and a light unsharp mask and saved at 88
  // (imageio.downsample_sharp, docs/performance.md §2c). Detail costs bits: a
  // half ground that kept its detail carries more bits per pixel than the
  // full ground it was made from (the old ones carried 0.89-1.45 times as
  // many; the sharp ones 1.21-1.92).
  const bpp = (dir: string, tiles: readonly ArtTile[]): number => {
    let bytes = 0;
    let px = 0;
    for (const t of tiles) {
      const f = join(dir, t.file);
      const { w, h } = webpSize(f);
      bytes += statSync(f).size;
      px += w * h;
    }
    return (bytes * 8) / px;
  };
  for (const id of PLACES_WITH_ART) {
    it(`${id}: its half-resolution ground keeps the full ground's detail`, () => {
      const dir = join(ART, id);
      const { art } = parsePlaceArt(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')));
      for (const [name, v] of Object.entries(art?.variants ?? {})) {
        const ratio = bpp(dir, v.groundLow) / bpp(dir, v.ground);
        expect(ratio, `${name}: half/full bits per pixel`).toBeGreaterThan(1.15);
      }
    });
  }
});

describe("the lake's story sails", () => {
  // The other boats' sails are story sprites (shown until the squall), so they
  // must carry their own shadow; for a while they carried none, and the set
  // sails lost their moon shadow on the water (2026-09-26 → 2026-09-30).
  it('carry their own shadow, caught on the water rather than the lake bed', () => {
    const boats = readFileSync(join(ROOT, 'tools', 'art', 'lib', 'lake_boats.py'), 'utf8');
    const yard = boats.slice(boats.indexOf('def _story_yard'), boats.indexOf('def _furled'));
    expect(yard).toContain('"shadow": True');
    expect(yard).toContain('"catch": "water"');
    const build = readFileSync(join(ROOT, 'tools', 'art', 'build_place.py'), 'utf8');
    expect(build).toContain('def catcher_at');
  });

  it('are wider than the sail alone in the night set (their shadow lies beside them)', () => {
    const { art } = parsePlaceArt(
      JSON.parse(readFileSync(join(ART, 'open-lake', 'manifest.json'), 'utf8')),
    );
    const sprites = art?.variants.night?.sprites ?? [];
    for (const id of ['entity:teacher-boat-sail', 'entity:fishing-boat-sail']) {
      const s = sprites.find((x) => x.id === id);
      expect(s, id).toBeDefined();
      // Rendered without a shadow these were 308 and 359 px wide.
      expect(s?.w ?? 0, id).toBeGreaterThan(440);
    }
  });
});

describe("Chapter 4's dye works", () => {
  // The hot vats' stoke-holes were once flat white slabs; they are coals now,
  // each with a small flickering light at the vat's foot. The Laodicea road
  // kept the old slabs until it was rendered again (2026-09-30).
  for (const id of ['ammia-workshop', 'lycus-road']) {
    it(`${id}: its hot vats burn coals that flicker at their stoke-holes`, () => {
      const { art } = parsePlaceArt(
        JSON.parse(readFileSync(join(ART, id, 'manifest.json'), 'utf8')),
      );
      expect(art).toBeDefined();
      for (const [name, v] of Object.entries(art?.variants ?? {})) {
        const vats = v.sprites.filter((s) => s.id.startsWith('vat-'));
        const hearths = v.lights.filter((l) => l.kind === 'hearth');
        expect(vats.length, `${name}: vats`).toBeGreaterThan(0);
        expect(hearths.length, `${name}: a hot vat's coals`).toBeGreaterThan(0);
        for (const l of hearths) {
          const atVat = vats.some((s) =>
            s.tiles.some(([x, y]) => l.x === (x + 0.5) * 32 && l.y === (y + 1) * 32),
          );
          expect(atVat, `${name}: hearth light at ${l.x},${l.y} is at a vat's foot`).toBe(true);
        }
      }
    });
  }
});
